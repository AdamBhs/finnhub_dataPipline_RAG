import os
from cassandra.cluster import Cluster


def get_cassandra_session():
    contact_points = os.getenv(
        "CASSANDRA_CONTACT_POINTS", "localhost"
    ).split(",")
    cassandra_port = int(os.getenv("CASSANDRA_PORT", "9042"))

    cluster = Cluster(contact_points, port=cassandra_port)
    session = cluster.connect("finnhub")

    return cluster, session


def write_trades(batch_df, batch_id):
    if batch_df.isEmpty():
        return

    def write_partition(rows):
        cluster, session = get_cassandra_session()

        try:
            insert_query = session.prepare("""
                INSERT INTO trades_by_symbol (
                    symbol,
                    event_time,
                    price,
                    volume,
                    conditions,
                    trade_type
                ) VALUES (?, ?, ?, ?, ?, ?)
            """)

            pending = []
            max_pending = 100

            for row in rows:
                future = session.execute_async(
                    insert_query,
                    (
                        row["symbol"],
                        row["event_time"].replace(tzinfo=None),
                        row["price"],
                        row["volume"],
                        row["conditions"] or [],
                        row["type"],
                    ),
                )

                pending.append(future)

                if len(pending) >= max_pending:
                    for future in pending:
                        future.result()
                    pending.clear()

            for future in pending:
                future.result()

        finally:
            cluster.shutdown()

    batch_df.foreachPartition(write_partition)


def write_aggregations(batch_df, batch_id):
    if batch_df.isEmpty():
        return

    def write_partition(rows):
        cluster, session = get_cassandra_session()

        try:
            insert_query = session.prepare("""
                INSERT INTO aggregations_by_symbol (
                    symbol,
                    window_start,
                    window_end,
                    trade_count,
                    avg_price,
                    total_volume
                ) VALUES (?, ?, ?, ?, ?, ?)
            """)

            pending = []
            max_pending = 100

            for row in rows:
                future = session.execute_async(
                    insert_query,
                    (
                        row["symbol"],
                        row["window"]["start"].replace(tzinfo=None),
                        row["window"]["end"].replace(tzinfo=None),
                        row["trade_count"],
                        row["avg_price"],
                        row["total_volume"],
                    ),
                )

                pending.append(future)

                if len(pending) >= max_pending:
                    for future in pending:
                        future.result()
                    pending.clear()

            for future in pending:
                future.result()

        finally:
            cluster.shutdown()

    batch_df.foreachPartition(write_partition)
