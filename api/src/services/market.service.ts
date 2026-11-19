
import cassandra from "../db/cassandra.js";

export interface MarketData {
  symbol: string;
  window_start: string;
  avg_price: number;
  total_volume: number;
  trade_count: number;
  window_end: string;
}

export async function getMarketData(
  symbol: string,
): Promise<MarketData[]> {
  if (!/^[A-Za-z0-9:_-]+$/.test(symbol)) {
    throw new Error("Invalid market symbol");
  }

  const result = await cassandra.execute(
    `SELECT symbol, window_start, avg_price,
            total_volume, trade_count, window_end
     FROM aggregations_by_symbol
     WHERE symbol = ?
     LIMIT 20`,
    [symbol],
    { prepare: true },
  );

  return result.rows.map((row) => ({
    symbol: row.symbol as string,
    window_start: (row.window_start as Date).toISOString(),
    avg_price: row.avg_price as number,
    total_volume: row.total_volume as number,
    trade_count: row.trade_count as number,
    window_end: (row.window_end as Date).toISOString(),
  }));
}
