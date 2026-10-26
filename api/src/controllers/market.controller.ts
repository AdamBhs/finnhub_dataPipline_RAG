import type { Request, Response, NextFunction } from "express";
import cassandra from "../db/cassandra.js";

export async function getMarketData(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const symbol = req.params.symbol;

    if (!symbol || !/^[A-Za-z0-9:_-]+$/.test(symbol)) {
      res.status(400).json({
        error: "A valid market symbol is required",
      });
      return;
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

    res.json({
      symbol,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
}
