import { z } from "zod";

export const rangeSchema = z.enum(["7d", "30d"]);
export type Range = z.infer<typeof rangeSchema>;

export const overviewSchema = z.object({
  prices: z.array(z.object({ date: z.string(), price: z.number() })),
  summary: z.array(
    z.object({
      symbol: z.string(),
      trades: z.number(),
      avgPrice: z.number(),
      volume: z.number(),
    }),
  ),
  watchlist: z.array(
    z.object({
      symbol: z.string(),
      exchange: z.string(),
      last: z.number(),
      changePct: z.number(),
      volume: z.number(),
      status: z.enum(["streaming", "delayed"]),
    }),
  ),
});
export type Overview = z.infer<typeof overviewSchema>;
