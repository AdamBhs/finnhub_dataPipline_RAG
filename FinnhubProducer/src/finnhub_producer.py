import json
import os
from pathlib import Path

import websocket
from confluent_kafka import Producer
from confluent_kafka.schema_registry import SchemaRegistryClient
from confluent_kafka.schema_registry.avro import AvroSerializer
from confluent_kafka.serialization import MessageField, SerializationContext


class FinnhubKafkaProducer:
    """Reads trades from the Finnhub websocket and publishes them to Kafka as Avro."""

    FINNHUB_URL = "wss://ws.finnhub.io"

    def __init__(
        self,
        token,
        symbols,
        topic,
        schema_path,
        bootstrap_servers="localhost:9092",
        schema_registry_url="http://localhost:8081",
    ):
        if not token:
            raise RuntimeError("FINNHUB_TOKEN environment variable is not set")

        self.symbols = symbols
        self.topic = topic

        # Schema Registry + Avro serializer
        with Path(schema_path).open() as file:
            schema_str = file.read()

        self.schema_registry = SchemaRegistryClient({"url": schema_registry_url})
        self.avro_serializer = AvroSerializer(
            self.schema_registry,
            schema_str,
            conf={"auto.register.schemas": True},
        )

        # Kafka producer
        self.producer = Producer({"bootstrap.servers": bootstrap_servers})

        # Finnhub websocket
        self.ws = websocket.WebSocketApp(
            f"{self.FINNHUB_URL}?token={token}",
            on_open=self.on_open,
            on_message=self.on_message,
            on_error=self.on_error,
            on_close=self.on_close,
        )

    # ---------------- Kafka ----------------

    def delivery_report(self, error, message):
        if error:
            print(f"Kafka delivery failed: {error}")
            return

        print(
            f"Kafka delivery successful | "
            f"topic={message.topic()} | "
            f"partition={message.partition()} | "
            f"offset={message.offset()}"
        )

    # ---------------- WebSocket callbacks ----------------

    def on_open(self, ws):
        print("Connected to Finnhub")
        for symbol in self.symbols:
            ws.send(json.dumps({"type": "subscribe", "symbol": symbol}))
            print(f"Subscribed to {symbol}")

    def on_message(self, ws, message):
        try:
            data = json.loads(message)

            # Finnhub also sends ping messages.
            if data.get("type") != "trade":
                print(f"Finnhub message: {data}")
                return

            print(f"Received trade message: {data}")

            # Build the object expected by the Avro schema.
            event = {"type": data["type"], "data": data["data"]}

            serialized_value = self.avro_serializer(
                event,
                SerializationContext(self.topic, MessageField.VALUE),
            )

            # Use the first trade's symbol as the Kafka key.
            symbol = event["data"][0]["s"]

            self.producer.produce(
                topic=self.topic,
                key=symbol,
                value=serialized_value,
                on_delivery=self.delivery_report,
            )

            # Serve delivery callbacks.
            self.producer.poll(0)

        except Exception as error:
            print(f"Processing error: {error}")

    def on_error(self, ws, error):
        print(f"WebSocket error: {error}")

    def on_close(self, ws, close_status_code, close_msg):
        print(
            f"Finnhub connection closed | "
            f"code={close_status_code} | "
            f"message={close_msg}"
        )

    # ---------------- Start ----------------

    def run(self):
        try:
            self.ws.run_forever()
        finally:
            print("Flushing Kafka producer...")
            self.producer.flush()
            print("Producer stopped.")


if __name__ == "__main__":
    ROOT_DIR = Path(__file__).resolve().parents[2]

    app = FinnhubKafkaProducer(
        token=os.environ["FINNHUB_TOKEN"],
        symbols=["BINANCE:BTCUSDT"],
        topic="stock-prices-avro",
        schema_path=ROOT_DIR / "schemas" / "stock-price.avsc",
        bootstrap_servers=os.getenv(
            "KAFKA_BOOTSTRAP_SERVERS",
            "localhost:9092",
        ),
        schema_registry_url=os.getenv(
            "SCHEMA_REGISTRY_URL",
            "http://localhost:8081",
        ),
    )

    app.run()