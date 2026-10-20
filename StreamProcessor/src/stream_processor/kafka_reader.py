import json
import os
from pathlib import Path

from pyspark.sql import SparkSession
from pyspark.sql.functions import (
    avg,
    col,
    count,
    explode,
    expr,
    sum,
    timestamp_millis,
    window,
)
from pyspark.sql.avro.functions import from_avro
from stream_processor.cassandra_writer import write_aggregations

def main():
    project_root = Path(__file__).resolve().parents[3]
    schema_path = project_root / "schemas" / "stock-price.avsc"
    kafka_bootstrap_servers = os.getenv(
        "KAFKA_BOOTSTRAP_SERVERS", "localhost:9092"
    )
    checkpoint_dir = Path(
        os.getenv(
            "SPARK_CHECKPOINT_DIR",
            str(project_root / "StreamProcessor" / "checkpoints" / "query2"),
        )
    )

    with schema_path.open("r", encoding="utf-8") as schema_file:
        avro_schema = json.dumps(json.load(schema_file))

    spark = (
        SparkSession.builder
        .appName("Finnhub Avro Trade Processor")
        .master("local[*]")
        .getOrCreate()
    )

    spark.sparkContext.setLogLevel("WARN")

    print(f"Spark version: {spark.version}")
    print(f"Loading Avro schema from: {schema_path}")
    print(f"Kafka bootstrap servers: {kafka_bootstrap_servers}")
    print(f"Aggregation checkpoint directory: {checkpoint_dir}")

    kafka_df = (
        spark.readStream
        .format("kafka")
        .option("kafka.bootstrap.servers", kafka_bootstrap_servers)
        .option("subscribe", "stock-prices-avro")
        .option("startingOffsets", "earliest")
        .load()
    )

    # Decode the Confluent Avro wire format.
    # The first 5 bytes contain the magic byte and schema ID.
    decoded_df = kafka_df.select(
        from_avro(
            expr("substring(value, 6, length(value) - 5)"),
            avro_schema,
            {"mode": "FAILFAST"},
        ).alias("message")
    )

    # Extract each trade from the message.
    trades_df = decoded_df.select(
        explode(col("message.data")).alias("trade"),
        col("message.type").alias("type"),
    )

    # Query 1 input: clean individual trade records.
    output_df = trades_df.select(
        col("trade.s").alias("symbol"),
        col("trade.p").alias("price"),
        timestamp_millis(col("trade.t")).alias("event_time"),
        col("trade.v").alias("volume"),
        col("trade.c").alias("conditions"),
        col("type"),
    )

    # Query 2 input: aggregate trades into 5-second event-time windows.
    aggregated_df = (
        output_df
        .withWatermark("event_time", "10 seconds")
        .groupBy(
            window(col("event_time"), "5 seconds"),
            col("symbol"),
        )
        .agg(
            count("*").alias("trade_count"),
            avg("price").alias("avg_price"),
            sum("volume").alias("total_volume"),
        )
    )

    # Query 1: display individual cleaned trades.
    query1 = (
        output_df.writeStream
        .queryName("clean_trades")
        .format("console")
        .outputMode("append")
        .option("truncate", "false")
        .start()
    )

    # Query 2: display completed 5-second aggregation windows.
    query2 = (
        aggregated_df.writeStream
        .queryName("trade_aggregations")
        .foreachBatch(write_aggregations)
        .outputMode("append")
        .option(
            "checkpointLocation",
            str(checkpoint_dir),
        )
        .trigger(processingTime="5 seconds")
        .start()
    )

    print("Query 1 started: clean individual trades")
    print("Query 2 started: 5-second event-time aggregations")

    spark.streams.awaitAnyTermination()


if __name__ == "__main__":
    main()
