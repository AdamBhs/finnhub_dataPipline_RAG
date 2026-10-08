import unittest

from stream_processor.processor import StreamProcessor, normalize_message


class StreamProcessorTests(unittest.TestCase):
    def setUp(self):
        self.message = {
            "type": "trade",
            "data": [
                {"c": ["@", None], "p": 100.0, "s": "AAPL", "t": 1_700_000_000_123, "v": 2.0},
                {"c": None, "p": 50.0, "s": "AAPL", "t": 1_700_000_001_456, "v": 4.0},
            ],
        }

    def test_normalizes_and_explodes_trades(self):
        trades = normalize_message(self.message, ingest_timestamp="2024-01-01T00:00:00+00:00")
        self.assertEqual(len(trades), 2)
        self.assertEqual(trades[0].symbol, "AAPL")
        self.assertEqual(trades[0].trade_conditions, ["@", None])
        self.assertEqual(trades[0].trade_timestamp, "2023-11-14T22:13:20.123000+00:00")

    def test_produces_running_price_volume_average(self):
        processor = StreamProcessor()
        trades, summaries = processor.process(self.message, ingest_timestamp="2024-01-01T00:00:00+00:00")
        self.assertEqual(len(trades), 2)
        self.assertEqual([item["price_volume_multiply"] for item in summaries], [200.0])

        _, summaries = processor.process(
            {"type": "trade", "data": [{"c": [], "p": 100.0, "s": "AAPL", "t": 1, "v": 5.0}]},
            ingest_timestamp="2024-01-01T00:00:00+00:00",
        )
        self.assertEqual(summaries[0]["price_volume_multiply"], 300.0)

    def test_ignores_non_trade_messages(self):
        self.assertEqual(StreamProcessor().process({"type": "ping", "data": []}), ([], []))


if __name__ == "__main__":
    unittest.main()
