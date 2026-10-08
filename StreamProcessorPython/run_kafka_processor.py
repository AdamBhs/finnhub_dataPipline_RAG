"""Run the local Kafka/Avro stream processor from the repository root.

Usage: python3 StreamProcessorPython/run_kafka_processor.py
"""

from stream_processor.__main__ import main


if __name__ == "__main__":
    raise SystemExit(main())
