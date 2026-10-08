"""Core, infrastructure-free trade transformation logic.

This module deliberately has no Kafka, Spark, or Cassandra dependency so it can
be exercised locally with ordinary Python data structures.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Any, Iterable
from uuid import uuid4


@dataclass(frozen=True)
class Trade:
    """The local equivalent of a row written to Cassandra's `trades` table."""

    uuid: str
    trade_conditions: list[str | None] | None
    price: float
    symbol: str
    trade_timestamp: str
    volume: float
    ingest_timestamp: str

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


def _utc_timestamp(milliseconds: int | float) -> str:
    """Convert Finnhub epoch milliseconds to a UTC ISO-8601 timestamp."""
    return datetime.fromtimestamp(milliseconds / 1000, tz=timezone.utc).isoformat()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_message(message: dict[str, Any], *, ingest_timestamp: str | None = None) -> list[Trade]:
    """Explode one Avro-decoded Finnhub message into normalized trade records.

    The field mapping mirrors the Scala processor: c/p/s/t/v become
    trade_conditions/price/symbol/trade_timestamp/volume.
    """
    if message.get("type") != "trade":
        return []

    received_at = ingest_timestamp or _now()
    trades: list[Trade] = []
    for event in message.get("data", []):
        required = {"p", "s", "t", "v"}
        missing = required.difference(event)
        if missing:
            raise ValueError(f"Trade event is missing required fields: {sorted(missing)}")

        conditions = event.get("c")
        if conditions is not None and not isinstance(conditions, list):
            raise ValueError("Trade field 'c' must be a list or null")

        trades.append(
            Trade(
                uuid=str(uuid4()),
                trade_conditions=conditions,
                price=float(event["p"]),
                symbol=str(event["s"]),
                trade_timestamp=_utc_timestamp(event["t"]),
                volume=float(event["v"]),
                ingest_timestamp=received_at,
            )
        )
    return trades


class StreamProcessor:
    """Transforms messages and maintains the Scala job's per-symbol aggregate.

    The original Scala code uses ``groupBy(symbol).avg(price * volume)`` without
    a window. Despite its table name/comment, that is a running average over all
    trades observed since the process started; this class intentionally matches
    that behavior.
    """

    def __init__(self) -> None:
        self._totals: dict[str, float] = {}
        self._counts: dict[str, int] = {}

    def process(
        self, message: dict[str, Any], *, ingest_timestamp: str | None = None
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        trades = normalize_message(message, ingest_timestamp=ingest_timestamp)
        # Spark emits one updated aggregate per grouping key for a micro-batch,
        # not one aggregate for each input row. Retain insertion order so local
        # output is deterministic and mirrors that batch-level shape.
        updated_symbols: dict[str, None] = {}
        summary_timestamp = ingest_timestamp or _now()

        for trade in trades:
            value = trade.price * trade.volume
            self._totals[trade.symbol] = self._totals.get(trade.symbol, 0.0) + value
            self._counts[trade.symbol] = self._counts.get(trade.symbol, 0) + 1
            updated_symbols[trade.symbol] = None

        summaries = [
            {
                "uuid": str(uuid4()),
                "symbol": symbol,
                "price_volume_multiply": self._totals[symbol] / self._counts[symbol],
                "ingest_timestamp": summary_timestamp,
            }
            for symbol in updated_symbols
        ]

        return [trade.as_dict() for trade in trades], summaries

    def process_messages(
        self, messages: Iterable[dict[str, Any]]
    ) -> Iterable[tuple[list[dict[str, Any]], list[dict[str, Any]]]]:
        for message in messages:
            yield self.process(message)
