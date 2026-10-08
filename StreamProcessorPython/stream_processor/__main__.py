"""Command-line interface for local and optional Kafka processing."""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from .local import process_jsonl
from .processor import StreamProcessor


def _jsonl_command(args: argparse.Namespace) -> int:
    if args.input == "-":
        trades, summaries = process_jsonl(sys.stdin, args.output_dir)
    else:
        with Path(args.input).open(encoding="utf-8") as input_file:
            trades, summaries = process_jsonl(input_file, args.output_dir)
    print(f"Processed {trades} trades and wrote {summaries} running-average updates to {args.output_dir}")
    return 0


def _kafka_command(args: argparse.Namespace) -> int:
    try:
        from confluent_kafka import Consumer
        from confluent_kafka.schema_registry import SchemaRegistryClient
        from confluent_kafka.schema_registry.avro import AvroDeserializer
        from confluent_kafka.serialization import MessageField, SerializationContext
    except ImportError as error:
        raise RuntimeError("Kafka mode requires: pip install -r requirements.txt") from error

    args.output_dir.mkdir(parents=True, exist_ok=True)
    consumer = Consumer({
        "bootstrap.servers": args.bootstrap_servers,
        "group.id": args.group_id,
        "auto.offset.reset": args.offset_reset,
        # Only acknowledge input after its JSONL records have reached disk.
        "enable.auto.commit": False,
    })
    consumer.subscribe([args.topic])
    deserializer = AvroDeserializer(SchemaRegistryClient({"url": args.schema_registry_url}))
    processor = StreamProcessor()

    processed_messages = 0
    try:
        with (args.output_dir / "trades.jsonl").open("a", encoding="utf-8") as trades_file, (
            args.output_dir / "running_averages.jsonl"
        ).open("a", encoding="utf-8") as summaries_file:
            while True:
                kafka_message = consumer.poll(1.0)
                if kafka_message is None:
                    continue
                if kafka_message.error():
                    print(f"Kafka error: {kafka_message.error()}", file=sys.stderr)
                    continue
                decoded = deserializer(
                    kafka_message.value(),
                    SerializationContext(kafka_message.topic(), MessageField.VALUE),
                )
                if not isinstance(decoded, dict):
                    raise ValueError("Schema Registry returned a non-record Avro value")
                trades, summaries = processor.process(decoded)
                for record in trades:
                    trades_file.write(json.dumps(record) + "\n")
                for record in summaries:
                    summaries_file.write(json.dumps(record) + "\n")
                trades_file.flush()
                summaries_file.flush()
                consumer.commit(message=kafka_message, asynchronous=False)
                processed_messages += 1
                print(
                    f"Processed Kafka record partition={kafka_message.partition()} "
                    f"offset={kafka_message.offset()} trades={len(trades)}"
                )
                if args.max_messages and processed_messages >= args.max_messages:
                    return 0
    except KeyboardInterrupt:
        return 0
    finally:
        consumer.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="Local Python version of StreamProcessor")
    commands = parser.add_subparsers(dest="command", required=True)

    jsonl = commands.add_parser("jsonl", help="process decoded messages from a JSON Lines file")
    jsonl.add_argument("input", help="input JSONL path, or - for stdin")
    jsonl.add_argument("--output-dir", type=Path, default=Path("output"))
    jsonl.set_defaults(handler=_jsonl_command)

    kafka = commands.add_parser("kafka", help="consume Avro records from a local Kafka broker")
    kafka.add_argument("--topic", default=os.getenv("KAFKA_TOPIC", "stock-prices-avro"))
    kafka.add_argument(
        "--bootstrap-servers",
        default=os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092"),
    )
    kafka.add_argument(
        "--schema-registry-url",
        default=os.getenv("SCHEMA_REGISTRY_URL", "http://localhost:8081"),
    )
    kafka.add_argument(
        "--group-id",
        default=os.getenv("KAFKA_GROUP_ID", "stream-processor-python-local"),
    )
    kafka.add_argument("--offset-reset", choices=("earliest", "latest"), default="earliest")
    kafka.add_argument("--output-dir", type=Path, default=Path("output"))
    kafka.add_argument(
        "--max-messages",
        type=int,
        help="stop cleanly after this many Kafka records (useful for a local smoke test)",
    )
    kafka.set_defaults(handler=_kafka_command)

    args = parser.parse_args()
    return args.handler(args)


if __name__ == "__main__":
    raise SystemExit(main())
