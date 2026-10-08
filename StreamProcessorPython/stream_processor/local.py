"""Local JSON Lines input/output adapter for the stream processor."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, TextIO

from .processor import StreamProcessor


def process_jsonl(input_file: TextIO, output_dir: Path) -> tuple[int, int]:
    """Process one decoded Avro message per input line into local JSONL sinks."""
    output_dir.mkdir(parents=True, exist_ok=True)
    processor = StreamProcessor()
    trade_count = summary_count = 0

    with (output_dir / "trades.jsonl").open("w", encoding="utf-8") as trades_file, (
        output_dir / "running_averages.jsonl"
    ).open("w", encoding="utf-8") as summaries_file:
        for line_number, line in enumerate(input_file, start=1):
            if not line.strip():
                continue
            try:
                message: dict[str, Any] = json.loads(line)
            except json.JSONDecodeError as error:
                raise ValueError(f"Invalid JSON on line {line_number}: {error.msg}") from error

            trades, summaries = processor.process(message)
            for trade in trades:
                trades_file.write(json.dumps(trade) + "\n")
            for summary in summaries:
                summaries_file.write(json.dumps(summary) + "\n")
            trade_count += len(trades)
            summary_count += len(summaries)

    return trade_count, summary_count
