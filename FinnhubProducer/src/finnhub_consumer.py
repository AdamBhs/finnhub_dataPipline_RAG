from confluent_kafka import Consumer
from confluent_kafka.schema_registry import SchemaRegistryClient
from confluent_kafka.schema_registry.avro import AvroDeserializer
from confluent_kafka.serialization import MessageField, SerializationContext


TOPIC = "stock-prices-avro"


schema_registry = SchemaRegistryClient({
    "url": "http://localhost:8081"
})

avro_deserializer = AvroDeserializer(
    schema_registry
)


consumer = Consumer({
    "bootstrap.servers": "localhost:9092",
    "group.id": "finnhub-consumer-group",
    "auto.offset.reset": "earliest"
})

consumer.subscribe([TOPIC])

print("Waiting for Finnhub trade events...")

try:
    while True:

        message = consumer.poll(1.0)

        if message is None:
            continue

        if message.error():
            print(f"Kafka error: {message.error()}")
            continue

        event = avro_deserializer(
            message.value(),
            SerializationContext(
                message.topic(),
                MessageField.VALUE
            )
        )
        print(event)

        # print(
        #     f"Received | "
        #     f"type={event['type']} | "
        #     f"trades={len(event['data'])}"
        # )

        for trade in event["data"]:
            print(
                f"  symbol={trade['s']} "
                f"price={trade['p']} "
                f"volume={trade['v']} "
                f"timestamp={trade['t']} "
                f"conditions={trade['c']}"
            )

except KeyboardInterrupt:
    print("\nStopping consumer...")

finally:
    consumer.close()