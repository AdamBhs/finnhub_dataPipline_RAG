FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64 \
    SPARK_LOCAL_IP=127.0.0.1

RUN apt-get update \
    && apt-get install --no-install-recommends -y openjdk-21-jre-headless \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV PYTHONPATH=/app/StreamProcessor/src

COPY StreamProcessor/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY StreamProcessor/src/ ./StreamProcessor/src/
COPY schemas/ ./schemas/

RUN mkdir -p /app/StreamProcessor/checkpoints/query2

CMD ["spark-submit", "--packages", "org.apache.spark:spark-sql-kafka-0-10_2.13:4.2.0,org.apache.spark:spark-avro_2.13:4.2.0", "--conf", "spark.driver.bindAddress=127.0.0.1", "--conf", "spark.driver.host=127.0.0.1", "--conf", "spark.sql.shuffle.partitions=3", "--conf", "spark.sql.streaming.forceDeleteTempCheckpointLocation=true", "/app/StreamProcessor/src/stream_processor/kafka_reader.py"]
