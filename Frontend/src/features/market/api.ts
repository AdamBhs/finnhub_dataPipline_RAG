import { overviewSchema, type Overview, type Range } from "./schemas";
// import { api } from "@/lib/api"

export async function fetchOverview(range: Range): Promise<Overview> {
  // Later, replace the mock below with:
  // const { data } = await api.get("/market/overview", { params: { range } })
  // return overviewSchema.parse(data)
  void range;
  const data = {
    prices: [
      { date: "Oct 11", price: 182 },
      { date: "Oct 12", price: 205 },
      { date: "Oct 13", price: 168 },
      { date: "Oct 14", price: 190 },
      { date: "Oct 15", price: 222 },
      { date: "Oct 16", price: 198 },
      { date: "Oct 17", price: 241 },
    ],
    summary: [
      { symbol: "AAPL", trades: 1520, avgPrice: 231.4, volume: 550000 },
      { symbol: "MSFT", trades: 1210, avgPrice: 418.9, volume: 230530 },
      { symbol: "TSLA", trades: 2040, avgPrice: 252.1, volume: 150540 },
      { symbol: "NVDA", trades: 3010, avgPrice: 131.7, volume: 234500 },
      { symbol: "BTCUSDT", trades: 2500, avgPrice: 67250, volume: 340000 },
    ],
    watchlist: [
      {
        symbol: "AAPL",
        exchange: "NASDAQ",
        last: 231.52,
        changePct: 1.24,
        volume: 550000,
        status: "streaming",
      },
      {
        symbol: "MSFT",
        exchange: "NASDAQ",
        last: 418.1,
        changePct: -0.42,
        volume: 230530,
        status: "streaming",
      },
      {
        symbol: "TSLA",
        exchange: "NASDAQ",
        last: 251.9,
        changePct: 2.8,
        volume: 150540,
        status: "delayed",
      },
      {
        symbol: "BTCUSDT",
        exchange: "BINANCE",
        last: 67310,
        changePct: -1.1,
        volume: 340000,
        status: "streaming",
      },
    ],
  };
  return overviewSchema.parse(data);
}
