
import json
from pathlib import Path

from pyspark.sql import SparkSession
from pyspark.sql.functions import col, explode, expr
from pyspark.sql.avro.functions import from_avro


def main():
    project_root = Path(__file__).resolve().parents[3]
    schema_path = project_root / "schemas" / "stock-price.avsc"

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

    kafka_df = (
        spark.readStream
        .format("kafka")
        .option("kafka.bootstrap.servers", "localhost:9092")
        .option("subscribe", "stock-prices-avro")
        .option("startingOffsets", "earliest")
        .load()
    )

    # Confluent wire format:
    # byte 1 = magic byte; bytes 2-5 = schema ID.
    # Spark's substring is 1-based, so payload starts at position 6.
    decoded_df = kafka_df.select(
        from_avro(
            expr("substring(value, 6, length(value) - 5)"),
            avro_schema,
            {"mode": "FAILFAST"},
        ).alias("message")
    )

    # Each Kafka message can contain multiple trades.
    trades_df = decoded_df.select(
        explode(col("message.data")).alias("trade"),
        col("message.type").alias("type"),
    )

    output_df = trades_df.select(
        col("trade.s").alias("symbol"),
        col("trade.p").alias("price"),
        col("trade.t").alias("timestamp_ms"),
        col("trade.v").alias("volume"),
        col("trade.c").alias("conditions"),
        col("type"),
    )

    query = (
        output_df.writeStream
        .format("console")
        .outputMode("append")
        .option("truncate", "false")
        .start()
    )

    query.awaitTermination()


if __name__ == "__main__":
    main()
