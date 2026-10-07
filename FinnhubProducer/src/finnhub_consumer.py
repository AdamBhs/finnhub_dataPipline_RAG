import os
from confluent_kafka import Consumer
from confluent_kafka.schema_registry import SchemaRegistryClient
from confluent_kafka.schema_registry.avro import AvroDeserializer
from confluent_kafka.serialization import MessageField, SerializationContext


class FinnhubKafkaConsumer:
    def __init__(
        self,
        topic,
        group_id,
        bootstrap_servers="localhost:9092",
        schema_registry_url="http://localhost:8081",
    ):
        self.topic = topic

        schema_registry = SchemaRegistryClient(
            {"url": schema_registry_url}
        )

        self.avro_deserializer = AvroDeserializer(
            schema_registry
        )

        self.consumer = Consumer({
            "bootstrap.servers": bootstrap_servers,
            "group.id": group_id,
            "auto.offset.reset": "earliest",
        })

        self.consumer.subscribe([topic])

    def run(self):
        print(f"Listening to topic: {self.topic}")

        try:
            while True:
                message = self.consumer.poll(1.0)

                if message is None:
                    continue

                if message.error():
                    print(f"Kafka error: {message.error()}")
                    continue

                data = self.avro_deserializer(
                    message.value(),
                    SerializationContext(
                        message.topic(),
                        MessageField.VALUE,
                    ),
                )

                print(
                    f"Received message | "
                    f"partition={message.partition()} | "
                    f"offset={message.offset()} | "
                    f"data={data}"
                )

        except KeyboardInterrupt:
            print("Consumer stopped.")

        finally:
            self.consumer.close()


if __name__ == "__main__":
    consumer = FinnhubKafkaConsumer(
        topic="stock-prices-avro",
        group_id="finnhub-consumer-group",
        bootstrap_servers=os.getenv(
            "KAFKA_BOOTSTRAP_SERVERS",
            "localhost:9092",
        ),
        schema_registry_url=os.getenv(
            "SCHEMA_REGISTRY_URL",
            "http://localhost:8081",
        ),
    )

    consumer.run()