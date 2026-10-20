import os
from cassandra.cluster import Cluster


def write_aggregations(batch_df, batch_id):
    if batch_df.isEmpty():
        return

    contact_points = os.getenv("CASSANDRA_CONTACT_POINTS", "localhost").split(",")
    cassandra_port = int(os.getenv("CASSANDRA_PORT", "9042"))

    def write_partition(rows):
        cluster = Cluster(contact_points, port=cassandra_port)

        try:
            session = cluster.connect("finnhub")

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
