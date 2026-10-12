CREATE KEYSPACE IF NOT EXISTS finnhub
WITH replication = {
    'class': 'SimpleStrategy',
    'replication_factor': 1
};

USE finnhub;

CREATE TABLE IF NOT EXISTS trades_by_symbol (
    symbol TEXT,
    event_time TIMESTAMP,
    price DOUBLE,
    volume DOUBLE,
    conditions LIST<TEXT>,
    trade_type TEXT,
    PRIMARY KEY (symbol, event_time)
) WITH CLUSTERING ORDER BY (event_time DESC);

CREATE TABLE IF NOT EXISTS aggregations_by_symbol (
    symbol TEXT,
    window_start TIMESTAMP,
    window_end TIMESTAMP,
    trade_count BIGINT,
    avg_price DOUBLE,
    total_volume DOUBLE,
    PRIMARY KEY (symbol, window_start)
) WITH CLUSTERING ORDER BY (window_start DESC);
