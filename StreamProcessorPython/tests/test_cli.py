import os
import sys
import unittest
from unittest.mock import patch

from stream_processor.__main__ import main


class KafkaCliTests(unittest.TestCase):
    def test_kafka_defaults_match_the_producer(self):
        with patch.dict(os.environ, {}, clear=True), patch.object(
            sys, "argv", ["stream_processor", "kafka", "--max-messages", "0"]
        ), patch("stream_processor.__main__._kafka_command", return_value=0) as command:
            self.assertEqual(main(), 0)
            args = command.call_args.args[0]

        self.assertEqual(args.topic, "stock-prices-avro")
        self.assertEqual(args.bootstrap_servers, "localhost:9092")
        self.assertEqual(args.schema_registry_url, "http://localhost:8081")
        self.assertEqual(args.group_id, "stream-processor-python-local")
