# Pin a Python minor release so the runtime is reproducible in Kubernetes.
FROM python:3.12.11-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# The Confluent client ships wheels containing librdkafka for supported Linux
# platforms, so no compiler or runtime build tooling is needed in the image.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY stream_processor ./stream_processor

# Keep the application process unprivileged and make its local output location
# writable for either the container filesystem or a mounted Kubernetes volume.
RUN groupadd --gid 10001 streamprocessor \
    && useradd --uid 10001 --gid streamprocessor --create-home --shell /usr/sbin/nologin streamprocessor \
    && mkdir /data \
    && chown streamprocessor:streamprocessor /data

USER 10001:10001

# Runtime configuration is supplied with KAFKA_BOOTSTRAP_SERVERS,
# SCHEMA_REGISTRY_URL, KAFKA_TOPIC, and KAFKA_GROUP_ID. See README.md.
ENTRYPOINT ["python3", "-m", "stream_processor", "kafka"]
CMD ["--output-dir", "/data"]
