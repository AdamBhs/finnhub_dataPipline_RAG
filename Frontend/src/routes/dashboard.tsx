import { useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useOverview } from "@/features/market/hooks";
import { rangeSchema, type Range } from "@/features/market/schemas";
import { cn } from "@/lib/utils";

const chartConfig = {
  price: { label: "Price", color: "#0284c7" },
} satisfies ChartConfig;

function RangeSelect({
  value,
  onChange,
}: {
  value: Range;
  onChange: (r: Range) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(rangeSchema.parse(v))}>
      <SelectTrigger className="w-32">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="7d">Last 7 days</SelectItem>
        <SelectItem value="30d">Last 30 days</SelectItem>
      </SelectContent>
    </Select>
  );
}

const nf = new Intl.NumberFormat("en-US");

export default function DashboardPage() {
  const [range, setRange] = useState<Range>("7d");
  const { data, isPending, isError } = useOverview(range);

  if (isPending) return <p className="text-slate-500">Loading...</p>;
  if (isError) return <p className="text-red-600">Failed to load data.</p>;

  const totalTrades = data.summary.reduce((s, r) => s + r.trades, 0);
  const totalVolume = data.summary.reduce((s, r) => s + r.volume, 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Price overview</CardTitle>
              <CardDescription>Tracked symbol price trend</CardDescription>
            </div>
            <RangeSelect value={range} onChange={setRange} />
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={chartConfig}
              className="h-56 w-full sm:h-64"
            >
              <AreaChart data={data.prices}>
                <defs>
                  <linearGradient id="fillPrice" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="var(--color-price)"
                      stopOpacity={0.25}
                    />
                    <stop
                      offset="100%"
                      stopColor="var(--color-price)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="date" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} width={40} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  dataKey="price"
                  type="monotone"
                  stroke="var(--color-price)"
                  strokeWidth={2}
                  fill="url(#fillPrice)"
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <CardTitle>Market summary</CardTitle>
            <RangeSelect value={range} onChange={setRange} />
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Trades</TableHead>
                  <TableHead>Avg price</TableHead>
                  <TableHead className="text-right">Volume</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.summary.map((r) => (
                  <TableRow key={r.symbol}>
                    <TableCell className="font-medium">{r.symbol}</TableCell>
                    <TableCell>{nf.format(r.trades)}</TableCell>
                    <TableCell>{nf.format(r.avgPrice)}</TableCell>
                    <TableCell className="text-right">
                      {nf.format(r.volume)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell>Total</TableCell>
                  <TableCell>{nf.format(totalTrades)}</TableCell>
                  <TableCell />
                  <TableCell className="text-right text-blue-600">
                    {nf.format(totalVolume)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Watchlist & Streams</CardTitle>
            <CardDescription>
              Real-time prices per symbol and stream status
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
              {data.watchlist.length} Active symbols
            </Badge>
            <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-50">
              Kafka online
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead>Exchange</TableHead>
                <TableHead>Last price</TableHead>
                <TableHead>Change</TableHead>
                <TableHead>Volume</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.watchlist.map((r) => (
                <TableRow key={r.symbol}>
                  <TableCell className="font-medium">{r.symbol}</TableCell>
                  <TableCell>{r.exchange}</TableCell>
                  <TableCell>{nf.format(r.last)}</TableCell>
                  <TableCell
                    className={cn(
                      r.changePct >= 0 ? "text-emerald-600" : "text-red-600",
                    )}
                  >
                    {r.changePct > 0 ? "+" : ""}
                    {r.changePct}%
                  </TableCell>
                  <TableCell>{nf.format(r.volume)}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        r.status === "streaming" ? "default" : "secondary"
                      }
                    >
                      {r.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="mt-4 flex flex-col items-center gap-3 text-sm text-slate-500 sm:flex-row sm:justify-between">
            <span>
              Showing {data.watchlist.length} of {data.watchlist.length} symbols
            </span>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" disabled>
                Previous
              </Button>
              <span>Page 1 of 1</span>
              <Button variant="outline" size="sm" disabled>
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
