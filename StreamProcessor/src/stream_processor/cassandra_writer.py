
from cassandra.cluster import Cluster


def write_aggregations(batch_df, batch_id):
    if batch_df.isEmpty():
        return

    def write_partition(rows):
        cluster = Cluster(["localhost"], port=9042)

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
