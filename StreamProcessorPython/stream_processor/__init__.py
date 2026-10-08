"""Local Python implementation of the StreamProcessor service."""

from .processor import StreamProcessor, Trade, normalize_message

__all__ = ["StreamProcessor", "Trade", "normalize_message"]
