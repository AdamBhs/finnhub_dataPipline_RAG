# StreamProcessorPython

A local-first Python rewrite of `StreamProcessor`. It has no Spark, Cassandra,
Docker, or Terraform dependency. The processing logic is testable entirely with
decoded Finnhub/Avro-shaped JSON messages.

It preserves the Scala service's transformation:

- expands every trade in a message;
- maps `c`, `p`, `s`, `t`, and `v` to readable trade fields;
- converts Finnhub epoch milliseconds to UTC timestamps;
- generates a UUID and ingest timestamp per output record; and
- emits the per-symbol running average of `price * volume` once per input
  message (the local equivalent of Spark's micro-batch update).

The Scala job's aggregate is not actually a 15-second window: it groups by
symbol without a time window. This implementation intentionally matches that
current behavior. The output name remains `running_averages.jsonl` to make its
eventual Cassandra mapping clear.

## Run locally, no services required

From this directory:

```bash
python -m unittest discover -s tests -v
python -m stream_processor jsonl examples/trades.jsonl --output-dir output
```

This produces `output/trades.jsonl` and `output/running_averages.jsonl`. Each
line is an independent JSON record, easy to inspect or load into a future sink.

## Optional local Kafka input

When a local Kafka broker and Schema Registry are available, install the
optional dependency and run:

```bash
python3 -m pip install -r StreamProcessorPython/requirements.txt
python3 StreamProcessorPython/run_kafka_processor.py kafka --output-dir StreamProcessorPython/output
```

Kafka mode is a consumer for `FinnhubProducer`: it subscribes to
`stock-prices-avro`, reads Confluent's Avro wire format, and uses Schema
Registry to obtain the producer's writer schema before deserializing each
message. It writes only local JSONL files and commits each Kafka offset after
those files have been flushed. Cassandra is not used anywhere in this folder.

Both programs default to `localhost:9092` and `http://localhost:8081`. Override
them with `KAFKA_BOOTSTRAP_SERVERS`, `SCHEMA_REGISTRY_URL`, `KAFKA_TOPIC`, and
`KAFKA_GROUP_ID` if needed. For a short end-to-end check, append
`--max-messages 10` to stop after ten decoded producer records.

## Container image

Build the processor image from the repository root:

```bash
docker build -t stream-processor-python:local StreamProcessorPython
```

The image starts the Kafka consumer automatically. When Kafka and Schema
Registry are running on the host, use `host.docker.internal` (on Linux, the
`--add-host` flag supplies that name):

```bash
docker run --rm \
  --add-host=host.docker.internal:host-gateway \
  -e KAFKA_BOOTSTRAP_SERVERS=host.docker.internal:9092 \
  -e SCHEMA_REGISTRY_URL=http://host.docker.internal:8081 \
  -v "$(pwd)/StreamProcessorPython/output:/data" \
  stream-processor-python:local
```

For Kubernetes, set `KAFKA_BOOTSTRAP_SERVERS` and `SCHEMA_REGISTRY_URL` to
their cluster service addresses and mount `/data` only if the JSONL output must
survive a pod restart. The image contains no broker address, credentials,
Cassandra setting, or Terraform-specific value.
