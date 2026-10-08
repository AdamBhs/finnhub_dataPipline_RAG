from pyspark.sql import SparkSession
from pyspark.sql.functions import col, udf
from pyspark.sql.types import BinaryType
from fastavro import schemaless_reader

import io
import json
import requests


spark = (
    SparkSession.builder
    .appName("FinnhubStreaming")
    .master("local[*]")
    .getOrCreate()
)

spark.sparkContext.setLogLevel("WARN")


# Get the Avro schema from Schema Registry
response = requests.get(
    "http://localhost:8081/subjects/stock-prices-avro-value/versions/latest"
)

schema = response.json()["schema"]
schema = json.loads(schema)


def decode_avro(value):
    if value is None:
        return None

    # Confluent wire format:
    # byte 0     = magic byte
    # bytes 1-4  = schema ID
    # bytes 5+   = Avro payload

    payload = value[5:]

    return schemaless_reader(
        io.BytesIO(payload),
        schema
    )


decode_udf = udf(decode_avro)


df = (
    spark.readStream
    .format("kafka")
    .option("kafka.bootstrap.servers", "localhost:9092")
    .option("subscribe", "stock-prices-avro")
    .option("startingOffsets", "earliest")
    .load()
)


decoded = df.select(
    decode_udf(col("value")).alias("data")
)


decoded.writeStream \
    .format("console") \
    .outputMode("append") \
    .option("truncate", "false") \
    .start() \
    .awaitTermination()