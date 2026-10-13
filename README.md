# Finnhub Real-Time Market Data Pipeline

## Handoff context for a new ChatGPT session

This repository is a **work-in-progress real-time data-engineering project**. Its target is to take live market trades from Finnhub, move them through Kafka using Avro and Confluent Schema Registry, process them with PySpark Structured Streaming, persist five-second aggregates in Cassandra, and visualize them in Grafana.

When helping with this repository, preserve the architecture and first determine which layer is being worked on. Do not treat generated state in `StreamProcessor/checkpoints/` as source code or project context; it is intentionally ignored by Git.

```text
Finnhub WebSocket
  -> Python producer
  -> Kafka topic: stock-prices-avro (Confluent Avro)
  -> PySpark Structured Streaming
  -> Apache Cassandra
  -> Grafana dashboard
```

## Current objective and status

The local end-to-end pipeline has been made to work. This repository is now being restarted from a clean Docker state: `docker compose down` was run and all named volumes were deleted. Consequently there is currently no retained Kafka data, Schema Registry history, Cassandra data, Grafana user state, or Spark checkpoint state. The source/configuration files are the durable project definition.

- Finnhub ingestion and Kafka publication are implemented in Python.
- Kafka, Schema Registry, Kafdrop, Cassandra, and Grafana are defined for local Docker Compose.
- A Spark reader decodes the Confluent Avro payload, cleans individual trades, and writes five-second per-symbol aggregates to Cassandra.
- Terraform provisions only part of the Kubernetes deployment: Kafka, Schema Registry, Kafdrop, the producer, a secret, and Kafka storage. It does **not** currently provision Cassandra, Grafana, or the Spark processor.
- `PYSPARK_AVRO_DEBUG.md` records an earlier debugging session. At that point raw Kafka input was confirmed readable by Spark, while a manual `fastavro` Python-UDF attempt failed on the nested Avro union. The current `kafka_reader.py` instead uses Spark's native `from_avro` approach.

The next practical goal is to bring the clean local stack back up in the correct order and confirm that Grafana displays new Cassandra aggregation rows. Avoid expanding to unrelated RAG/AI-agent work unless explicitly requested.

## Repository map

```text
.
├── docker-compose.yml                 # Local Kafka, Registry, Kafdrop, Cassandra, Grafana
├── schemas/
│   ├── stock-price.avsc               # Active Avro schema, shared by producer and Spark
│   └── .trades.avsc                   # Old/commented schema artifact; not active code
├── FinnhubProducer/
│   ├── Dockerfile                     # Builds the Python producer image
│   ├── requirements.txt               # confluent-kafka with Avro/Registry support, websocket-client
│   └── src/
│       ├── finnhub_producer.py        # Finnhub WebSocket -> Kafka producer
│       └── finnhub_consumer.py        # Small Kafka/Avro inspection consumer
├── StreamProcessor/
│   ├── requirements.txt               # Cassandra driver only (incomplete for full local Spark setup)
│   └── src/stream_processor/
│       ├── kafka_reader.py            # Spark streaming job
│       └── cassandra_writer.py        # foreachBatch Cassandra sink
├── Cassandra/
│   ├── Dockerfile                     # Custom Cassandra image that copies init CQL
│   └── scripts/init.cql               # Keyspace/table definitions
├── grafana/
│   ├── Dockerfile                     # Installs Cassandra datasource plugin
│   ├── provisioning/                  # Datasource and dashboard provisioning
│   └── dashboards/dashboard.json      # BTC price, volume, and trade-count charts
├── terraform-k8s/                     # Partial Kubernetes Terraform configuration
└── PYSPARK_AVRO_DEBUG.md               # Historical detailed Avro debugging notes
```

## Data contracts

### Kafka topic and serialization

- Topic: `stock-prices-avro`
- Key: first trade's symbol, currently normally `BINANCE:BTCUSDT`
- Value: Confluent Avro wire format
  - byte 0: Confluent magic byte
  - bytes 1-4: schema ID
  - remaining bytes: Avro payload
- Schema Registry default URL locally: `http://localhost:8081`
- Default Registry value subject: `stock-prices-avro-value`

The active schema is `schemas/stock-price.avsc`. A message has this shape:

```json
{
  "type": "trade",
  "data": [
    {
      "c": ["condition"],
      "p": 123.45,
      "s": "BINANCE:BTCUSDT",
      "t": 1700000000000,
      "v": 0.01
    }
  ]
}
```

Field meanings: `c` = trade conditions (nullable nested union), `p` = price, `s` = symbol, `t` = epoch milliseconds, and `v` = volume. A Finnhub WebSocket message can carry several trades in `data`; Spark explodes that array so every trade becomes one row.

### Cassandra schema

`Cassandra/scripts/init.cql` creates keyspace `finnhub` with `SimpleStrategy`, replication factor 1.

`trades_by_symbol` is designed for raw trades but the current processor does **not** write to it:

```sql
PRIMARY KEY (symbol, event_time)
```

`aggregations_by_symbol` is the active sink:

```sql
PRIMARY KEY (symbol, window_start)
```

It stores `window_end`, `trade_count`, `avg_price`, and `total_volume`, clustered newest-first by `window_start` for each symbol.

## Component behavior

### 1. `FinnhubProducer/src/finnhub_producer.py`

`FinnhubKafkaProducer` connects to `wss://ws.finnhub.io?token=<FINNHUB_TOKEN>`, subscribes to the hard-coded list `['BINANCE:BTCUSDT']`, ignores non-`trade` messages such as pings, and publishes each WebSocket message to Kafka.

It loads `schemas/stock-price.avsc`, creates a Confluent `AvroSerializer` with `auto.register.schemas=True`, and serializes `{type, data}`. Delivery success/failure is printed. The `SEND_DELAY_SECONDS` constant is set to 5, but the actual `time.sleep(...)` is commented out, so there is no active delay.

Required environment variables:

| Variable | Required | Local default |
| --- | --- | --- |
| `FINNHUB_TOKEN` | Yes | none; program fails if absent |
| `KAFKA_BOOTSTRAP_SERVERS` | No | `localhost:9092` |
| `SCHEMA_REGISTRY_URL` | No | `http://localhost:8081` |

### 2. `FinnhubProducer/src/finnhub_consumer.py`

This is a diagnostic consumer, not part of the processing pipeline. It subscribes to `stock-prices-avro`, uses Confluent's `AvroDeserializer`, prints partition/offset/deserialized data, and closes cleanly on Ctrl-C. Its consumer group is `finnhub-consumer-group`.

### 3. `StreamProcessor/src/stream_processor/kafka_reader.py`

This is the intended Spark job.

1. Loads the shared Avro schema as compact JSON.
2. Reads Kafka `stock-prices-avro` from `localhost:9092`, starting at earliest offsets.
3. Removes the 5-byte Confluent framing header using `substring(value, 6, length(value) - 5)`. Spark substring positions are 1-based, hence `6` skips bytes 1-5.
4. Decodes the remaining Avro bytes with `pyspark.sql.avro.functions.from_avro` in `FAILFAST` mode.
5. Explodes `message.data` and creates clean columns: `symbol`, `price`, `event_time` via `timestamp_millis(trade.t)`, `volume`, `conditions`, and `type`.
6. Starts two streaming queries:
   - `clean_trades`: appends cleaned individual trades to the console.
   - `trade_aggregations`: applies a 10-second event-time watermark; aggregates 5-second windows by symbol; uses `foreachBatch(write_aggregations)` every 5 seconds.

Checkpoint state belongs under `StreamProcessor/checkpoints/query2` and is ignored by Git. Do not add it to any handoff or documentation as source material.

### 4. `StreamProcessor/src/stream_processor/cassandra_writer.py`

`write_aggregations(batch_df, batch_id)` skips empty microbatches, then opens a Cassandra connection to `localhost:9042` for each Spark partition. It prepares an insert into `finnhub.aggregations_by_symbol`, writes asynchronously, waits every 100 pending operations, then shuts down the cluster connection. Spark timestamps are made timezone-naive before insertion.

Important deployment implication: both the Spark reader and writer hard-code `localhost`. This is appropriate only when Spark runs on the same host/network namespace as the local Cassandra/Kafka ports. It must be parameterized (or changed to service names) for a Docker/Kubernetes deployment.

## Local infrastructure: `docker-compose.yml`

The Compose file currently starts infrastructure only; it does **not** start the producer or Spark processor.

| Service | Image/build | Host port | Internal address |
| --- | --- | ---: | --- |
| Kafka (single-node KRaft) | `apache/kafka:4.1.1` | 9092 | `kafka:19092` |
| Schema Registry | `confluentinc/cp-schema-registry:8.1.1` | 8081 | `schema-registry:8081` |
| Kafdrop | `obsidiandynamics/kafdrop:latest` | 9000 | `kafdrop:9000` |
| Cassandra | `cassandra:5.0` | 9042 | `cassandra:9042` |
| Grafana | local `grafana/Dockerfile` | 3000 | `grafana:3000` |

Kafka exposes `localhost:9092` to host programs and advertises `kafka:19092` to other Compose services. It uses three partitions and single-replica internal topics. Compose volumes are `kafka_data`, `cassandra_data`, and `grafana_data`. For the exact clean-start sequence, follow the next section.

### Clean restart procedure (current situation)

All named volumes were deliberately deleted. A clean startup is therefore expected to have no old Kafka topic data, no registered Avro schema, no Cassandra keyspace/tables, and no saved Grafana configuration/database. This is not an error.

Start the infrastructure:

```bash
docker compose up -d --build
docker compose ps
```

Watch the services until each is ready. Cassandra normally takes longer than Kafka or Grafana on a fresh volume:

```bash
docker compose logs -f kafka schema-registry cassandra grafana
```

Use Ctrl-C to stop viewing logs; it does not stop the containers. Confirm readiness before starting application processes:

```bash
curl http://localhost:8081/subjects
docker exec -it cassandra cqlsh -e "DESCRIBE KEYSPACES"
```

### Cassandra schema initialization

Although `Cassandra/Dockerfile` copies `init.cql` to `/docker-entrypoint-initdb.d/`, the Compose service currently uses `image: cassandra:5.0`, not that Dockerfile. Therefore, on a fresh Compose volume, create the schema explicitly after Cassandra is ready:

```bash
docker exec -i cassandra cqlsh < Cassandra/scripts/init.cql
docker exec -it cassandra cqlsh -e "DESCRIBE KEYSPACE finnhub"
```

Verify both tables before starting Spark:

```bash
docker exec -it cassandra cqlsh -e "DESCRIBE KEYSPACE finnhub"
docker exec -it cassandra cqlsh -e "SELECT * FROM finnhub.aggregations_by_symbol LIMIT 5"
```

An empty result from the last query is correct until the producer and Spark processor are running. The new `cassandra_data` volume will retain data through ordinary Compose restarts; it is reset only when the volume is removed again.

## Running the applications locally

Prerequisites: Docker/Compose, a Finnhub API token with WebSocket access, Java compatible with the chosen Spark/PySpark version, and Python dependencies. The existing `.venv` is local machine state, not a reproducible dependency lockfile.

Start Docker infrastructure first, wait for Kafka/Registry/Cassandra readiness, initialize Cassandra as above, then run the producer from the repository root:

```bash
export FINNHUB_TOKEN='replace-with-your-token'
export KAFKA_BOOTSTRAP_SERVERS='localhost:9092'
export SCHEMA_REGISTRY_URL='http://localhost:8081'
python FinnhubProducer/src/finnhub_producer.py
```

For an independent producer verification, run in another terminal:

```bash
python FinnhubProducer/src/finnhub_consumer.py
```

The Spark job needs more than the checked-in `StreamProcessor/requirements.txt`: it imports PySpark and needs Spark's Kafka and Avro connector modules available. The existing local debug environment recorded Spark 4.2.0, Scala 2.13.18, Java 25.0.4.1, and Python 3.14. Use compatible connector artifacts for the actual Spark version, then launch with `PYTHONPATH` set so `stream_processor` resolves:

```bash
export PYTHONPATH="$PWD/StreamProcessor/src"
spark-submit StreamProcessor/src/stream_processor/kafka_reader.py
```

The exact `spark-submit --packages ...` coordinates must match the installed Spark/Scala version; they are not pinned in this repository. Do not silently substitute arbitrary versions.

Useful URLs after Compose starts:

- Kafdrop: <http://localhost:9000>
- Schema Registry: <http://localhost:8081>
- Grafana: <http://localhost:3000>

Grafana provisions a Cassandra datasource with UID `finnhub-cassandra` and dashboard UID `finnhub-overview`. The dashboard filters for `BINANCE:BTCUSDT` and graphs average price, aggregate volume, and number of trades per window.

## Grafana: detailed operation and verification

Grafana is the presentation layer only. It does not read Kafka or Spark directly. Its data dependency chain is:

```text
Finnhub producer -> Kafka -> Spark 5-second aggregation -> Cassandra rows -> Grafana query -> dashboard panels
```

If the dashboard is empty, work backwards from Cassandra. A successful Grafana container does not prove that Spark has inserted data.

### How Grafana is built and provisioned

`grafana/Dockerfile` starts from `grafana/grafana:latest` and installs the `hadesarchitect-cassandra-datasource` plugin. It also copies the provisioning and dashboard files into the image. Compose additionally bind-mounts the same local provisioning/dashboard directories, so source-file changes on the host are available inside the container.

At container startup Grafana reads two provisioning definitions:

| File | Purpose | Important configured values |
| --- | --- | --- |
| `grafana/provisioning/datasources/cassandra.yaml` | Creates the Cassandra datasource | Name `Apache Cassandra`; UID `finnhub-cassandra`; plugin `hadesarchitect-cassandra-datasource`; URL `cassandra:9042`; keyspace `finnhub`; consistency `ONE`; default datasource |
| `grafana/provisioning/dashboards/dashboard.yaml` | Loads dashboards from files | Provider `Finnhub`; folder `Finnhub`; directory `/var/lib/grafana/dashboards`; refreshes its file scan every 10 seconds |

The dashboard definition is `grafana/dashboards/dashboard.json`. It has UID `finnhub-overview`, title **Finnhub Real-Time Market Monitoring**, a browser-timezone setting, a default range of the last 30 minutes, and automatic refresh every 10 seconds.

Because `grafana_data` was deleted, Grafana will recreate its own database on the next startup. The provisioning files then re-create the datasource and dashboard. With an empty `grafana.ini`, Grafana uses its standard initial login; use `admin` / `admin` unless the login flow asks you to set a new password. Do not place a real password in this repository.

### Opening the dashboard after the clean restart

1. Start the Compose stack and wait for both `cassandra` and `grafana` to be running.
2. Open <http://localhost:3000> and sign in.
3. Navigate to **Dashboards** -> **Finnhub** -> **Finnhub Real-Time Market Monitoring**. It may also be opened by its dashboard UID, `finnhub-overview`.
4. Confirm the datasource under **Connections** -> **Data sources** -> **Apache Cassandra**. It should point to `cassandra:9042`, not `localhost:9042`: Grafana runs inside the Compose network, where `localhost` would mean the Grafana container itself.
5. Start the producer and Spark job. After Spark writes completed event-time windows, wait at least one dashboard refresh cycle (10 seconds) and keep the dashboard time range covering the new rows, for example `now-30m` to `now`.

### The three existing panels

All panels use the same datasource and the table `finnhub.aggregations_by_symbol`. They filter the identifier column `symbol` to exactly `BINANCE:BTCUSDT`.

| Panel | Position | Cassandra time column | Value column | Display |
| --- | --- | --- | --- | --- |
| **Average BTC Price** | top row, full width | `window_start` | `avg_price` | USD, two decimal places |
| **Trading Volume per Window** | lower-left half | `window_start` | `total_volume` | numeric, four decimal places |
| **Trades per Window** | lower-right half | `window_start` | `trade_count` | integer |

Each plotted point represents one Spark **five-second event-time window** for the selected symbol. It is not an individual trade. The source table also contains `window_end`, which identifies the end of that same window. The dashboard does not currently chart raw rows from `trades_by_symbol`, because the present Spark writer only inserts aggregates.

### End-to-end Grafana verification checklist

Run these checks in order after a fresh start:

1. **Grafana process and plugin:** `docker compose logs grafana` should show normal startup and no Cassandra-plugin load error.
2. **Cassandra schema:** `docker exec -it cassandra cqlsh -e "DESCRIBE TABLE finnhub.aggregations_by_symbol"` must succeed.
3. **Spark output:** keep the Spark console query visible. It should print cleaned `BINANCE:BTCUSDT` rows once Kafka messages arrive.
4. **Cassandra data:** query the exact symbol:

   ```bash
   docker exec -it cassandra cqlsh -e "SELECT symbol, window_start, window_end, trade_count, avg_price, total_volume FROM finnhub.aggregations_by_symbol WHERE symbol = 'BINANCE:BTCUSDT' LIMIT 20"
   ```

5. **Grafana datasource:** use its UI to save/test the `Apache Cassandra` datasource. It must reach `cassandra:9042` from inside the Docker network.
6. **Dashboard time range:** select a range that contains the `window_start` timestamps returned by Cassandra. With a new pipeline, `Last 30 minutes` is normally sufficient; switch to `Last 5 minutes` once current data is continuously arriving.
7. **Dashboard refresh:** press Grafana's refresh button or wait 10 seconds. The panels should show the same timestamps/values as Cassandra, subject to chart formatting.

### Grafana troubleshooting map

| Symptom | Most likely layer | Check or fix |
| --- | --- | --- |
| Grafana page cannot open | Compose/Grafana | `docker compose ps`; `docker compose logs grafana`; check port 3000 is free |
| Dashboard or datasource is missing | Provisioning | Confirm the YAML/JSON files exist, rebuild/restart Grafana, then inspect `docker compose logs grafana` |
| Datasource test fails | Docker networking, Cassandra, or plugin | Ensure Cassandra is healthy and schema exists; datasource URL must remain `cassandra:9042`; inspect Grafana logs for plugin errors |
| Dashboard opens but all panels say no data | Data pipeline or time range | Query Cassandra directly first; if rows exist, expand the Grafana time range and verify the symbol filter |
| Cassandra has no aggregation rows | Spark/producer/Kafka | Check producer logs, Kafdrop topic messages, and Spark query logs; Grafana cannot create these rows |
| A panel has data for the wrong asset | Dashboard target | Its `idValue` currently hard-codes `BINANCE:BTCUSDT`; update the dashboard JSON or add a Grafana variable when multi-symbol support is needed |
| Data looks delayed | Spark window/watermark | Results are event-time five-second windows with a 10-second watermark and a five-second processing trigger; allow time for a window to complete |

### Safely changing the dashboard

The dashboard is file-provisioned, but `allowUiUpdates: true` means UI edits are allowed. The canonical, shareable version remains `grafana/dashboards/dashboard.json`.

- For durable changes, edit the JSON file, then restart Grafana (`docker compose restart grafana`) or wait for the provisioning provider's 10-second file scan.
- If changing the datasource configuration/plugin, rebuild the image: `docker compose up -d --build grafana`.
- If editing in the Grafana UI, export the dashboard JSON afterwards and update `grafana/dashboards/dashboard.json`; otherwise a clean-volume restart can lose UI-only changes.
- Keep UID `finnhub-overview` stable unless intentionally creating a separate dashboard. Existing links/bookmarks rely on it.
- When adding new symbols, do not just change Grafana: ensure the producer subscribes to the symbol and the Spark/Cassandra data contains it. Then either alter `idValue` or add a dashboard variable to choose symbols.

## Kubernetes / Terraform state

Terraform resides in `terraform-k8s/` and expects a Kubernetes provider version around `2.38`, a kubeconfig (default `~/.kube/config`), and context `minikube`. Its default namespace is `finnhub-pipeline`.

Defined resources:

- Namespace.
- Kafka ConfigMap, headless Service, one-replica StatefulSet, and a 3 GiB `ReadWriteMany` PVC.
- Schema Registry ConfigMap, Service, and one-replica Deployment.
- Kafdrop ConfigMap, ClusterIP Service, and one-replica Deployment.
- Finnhub producer Deployment using image `finnhub-producer:1.0` with its token taken from a Kubernetes Secret.

The producer deployment correctly uses in-cluster endpoints `kafka:9092` and `http://schema-registry:8081`.

To apply, a user needs to provide the sensitive `finnhub_token` Terraform variable without committing it:

```bash
cd terraform-k8s
terraform init
terraform plan -var='finnhub_token=replace-with-your-token'
terraform apply -var='finnhub_token=replace-with-your-token'
```

`terraform.tfvars`, state files, and `.terraform/` are ignored. Never place the Finnhub token into source, a README, a prompt, or a Git commit.

## Known limitations and next practical checks

1. Verify the currently implemented native Spark `from_avro` path against real producer messages. The historical manual `fastavro` UDF error should not be reintroduced unless diagnosing a specific regression.
2. Make the local Spark runtime reproducible: pin PySpark, Kafka connector, Avro connector, Java, and all Python dependencies. `StreamProcessor/requirements.txt` currently lists only `cassandra-driver==3.30.1`.
3. Ensure Cassandra initialization is automated or clearly run via `cqlsh`; the existing Compose configuration does not use `Cassandra/Dockerfile`.
4. Add health checks/readiness handling before applications start, particularly Kafka, Schema Registry, and Cassandra.
5. Parameterize Kafka/Cassandra hostnames and ports for host, Compose, and Kubernetes execution instead of relying on `localhost`.
6. Decide whether raw `trades_by_symbol` should also be populated; the table exists but no current writer uses it.
7. Complete the Kubernetes path by deploying Cassandra, Grafana, and Spark (or document that local Compose is the supported execution model).
8. Pin images currently using `latest`, particularly Kafdrop and Grafana, for reproducibility.

## Change safety rules for future assistants

- Treat `schemas/stock-price.avsc` as a shared producer/consumer contract. Coordinate schema changes across Finnhub producer, Spark decoder, Schema Registry compatibility, and any existing topic data.
- Do not expose or commit `FINNHUB_TOKEN`; pass it through environment variables or Terraform/Kubernetes secrets.
- Do not edit/delete `StreamProcessor/checkpoints/*`; it is generated Spark state and intentionally ignored.
- Preserve existing user changes in the working tree. At the time this handoff was generated, some infrastructure/Grafana changes may be uncommitted, so inspect `git status` before making broad changes.
- Prefer validating a single layer at a time: Finnhub -> producer -> Kafka/Registry -> Spark decoding -> Cassandra rows -> Grafana query.

## Suggested prompt for a new ChatGPT session

> Read `README.md` first, then inspect the referenced source files. This is a work-in-progress Finnhub real-time market-data pipeline. Preserve the existing Avro schema and architecture unless I specifically ask for a redesign. Ignore `StreamProcessor/checkpoints/*` because it is generated Spark state. Before editing, explain which pipeline layer you are changing and validate it without exposing secrets.
