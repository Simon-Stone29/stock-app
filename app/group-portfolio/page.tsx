"use client";
import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/src/lib/supabase";
import { Card, CardHeader, CardTitle, CardContent } from "@/src/components/ui/card";
import { cn } from "@/src/lib/utils";

export default function GroupPortfolio() {
  const [portfolio, setPortfolio] = useState<any[]>([]);
  const [stocks, setStocks] = useState<any>({});
  const [weekStart, setWeekStart] = useState<string>("");
  const [summaryDate, setSummaryDate] = useState<string | null>(null);
  const [dailyOutput, setDailyOutput] = useState<string | null>(null);
  const [dailyOutputLoading, setDailyOutputLoading] = useState(true);
  const [dailyOutputError, setDailyOutputError] = useState(false);
  const [groupPerformance, setGroupPerformance] = useState<number | null>(null);
  const [groupPortfolioValue, setGroupPortfolioValue] = useState<number>(1000);
  const [portfolioHistory, setPortfolioHistory] = useState<{ snapshot_date: string; portfolio_value: number }[]>([]);
  const [benchmarkHistory, setBenchmarkHistory] = useState<{ snapshot_date: string; week_start: string; benchmark_value: number }[]>([]);

  useEffect(() => {
    fetch("/api/time-context")
      .then((res) => res.json())
      .then((data) => setWeekStart(data.weekStart))
      .catch((error) => {
        console.error("Failed to load time context:", error);
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fetchDailyOutput = async () => {
      setDailyOutputLoading(true);
      const { data, error } = await supabase
        .from("llm_output")
        .select("output, output_date")
        .order("output_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        console.error("Failed to load daily group update:", error);
        setDailyOutputError(true);
      } else {
        setDailyOutput(data?.output ?? null);
        setSummaryDate(data?.output_date ?? null);
      }
      setDailyOutputLoading(false);
    };

    void fetchDailyOutput();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!weekStart) return;

    const fetchPortfolio = async () => {
      const { data: portfolioData } = await supabase
        .from("weekly_portfolio")
        .select("symbol, percentage")
        .eq("week_start", weekStart)
        .order("percentage", { ascending: false });

      const { data: stockData } = await supabase
        .from("stocks")
        .select("Symbol, Name");

      const stockMap: any = {};
      stockData?.forEach(s => stockMap[s.Symbol] = s.Name);
      setStocks(stockMap);
      setPortfolio(portfolioData || []);
    };

    fetchPortfolio();
  }, [weekStart]);

  useEffect(() => {
    const fetchPortfolioHistory = async () => {
      const { data } = await supabase
        .from("group_portfolio_daily")
        .select("snapshot_date, portfolio_value")
        .order("snapshot_date", { ascending: true });

      const history = (data ?? []).map((row) => ({
        snapshot_date: row.snapshot_date,
        portfolio_value: Number(row.portfolio_value),
      }));

      setPortfolioHistory(history);
      if (history.length) setGroupPortfolioValue(history[history.length - 1].portfolio_value);
    };

    void fetchPortfolioHistory();

    const fetchBenchmarkHistory = async () => {
      const { data } = await supabase
        .from("benchmark_daily")
        .select("snapshot_date, week_start, benchmark_value")
        .order("snapshot_date", { ascending: true });

      setBenchmarkHistory(
        (data ?? []).map((row) => ({
          snapshot_date: row.snapshot_date,
          week_start: row.week_start,
          benchmark_value: Number(row.benchmark_value),
        }))
      );
    };

    void fetchBenchmarkHistory();
  }, []);

  useEffect(() => {
    if (!weekStart || !portfolio.length) {
      setGroupPerformance(null);
      return;
    }

    const calculateGroupPerformance = async () => {
      const { data: prices } = await supabase
        .from("stock_prices")
        .select("symbol, open_price, close_price")
        .eq("week_start", weekStart);

      if (!prices?.length) {
        setGroupPerformance(null);
        return;
      }

      const priceMap: Record<string, { open: number; close: number }> = {};
      prices.forEach((p) => {
        priceMap[p.symbol] = { open: p.open_price, close: p.close_price };
      });

      let weeklyReturn = 0;
      let hasData = false;

      portfolio.forEach((p) => {
        const price = priceMap[p.symbol];
        if (!price || price.open === 0) return;
        const stockReturn = (price.close - price.open) / price.open;
        weeklyReturn += stockReturn * (p.percentage / 100);
        hasData = true;
      });

      setGroupPerformance(hasData ? weeklyReturn * 100 : null);
    };

    calculateGroupPerformance();
  }, [weekStart, portfolio]);

  const positive = (groupPerformance ?? 0) >= 0;
  const benchmarkPortfolioValue = benchmarkHistory.at(-1)?.benchmark_value ?? 1000;
  const benchmarkTotalReturn = ((benchmarkPortfolioValue - 1000) / 1000) * 100;
  const currentWeekBenchmarkHistory = benchmarkHistory.filter((row) => row.week_start === weekStart);
  const previousBenchmarkValue = benchmarkHistory
    .filter((row) => row.week_start < weekStart)
    .at(-1)?.benchmark_value ?? 1000;
  const latestCurrentWeekBenchmark = currentWeekBenchmarkHistory.at(-1)?.benchmark_value;
  const benchmarkWeekPerformance = latestCurrentWeekBenchmark === undefined
    ? null
    : ((latestCurrentWeekBenchmark / previousBenchmarkValue) - 1) * 100;
  const benchmarkPositive = (benchmarkWeekPerformance ?? 0) >= 0;
  const portfolioValuesByDate = new Map<string, number>();
  portfolioHistory.forEach((row) => portfolioValuesByDate.set(row.snapshot_date, row.portfolio_value));
  const benchmarkValuesByDate = new Map<string, number>();
  benchmarkHistory.forEach((row) => benchmarkValuesByDate.set(row.snapshot_date, row.benchmark_value));
  const chartDates = Array.from(new Set([
    ...portfolioHistory.map((row) => row.snapshot_date),
    ...benchmarkHistory.map((row) => row.snapshot_date),
  ])).sort();
  const comparisonHistory = chartDates.map((snapshot_date) => ({
    snapshot_date,
    portfolio_value: portfolioValuesByDate.get(snapshot_date),
    benchmark_value: benchmarkValuesByDate.get(snapshot_date),
  }));

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-xl font-semibold tracking-tight">Group Portfolio</h1>

      <section className="mb-8 border-l-2 border-primary pl-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {summaryDate ? `Performance Summary as of ${summaryDate}` : "Performance Summary"}
        </div>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
          {dailyOutputLoading
            ? "Loading latest performance summary..."
            : dailyOutputError
            ? "Couldn't load the latest performance summary."
            : dailyOutput ?? "No performance summary has been generated yet."}
        </p>
      </section>

      <div className="mb-8 grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="md:border-r md:border-border md:pr-8">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Group Portfolio Value
          </div>
          <div className="mt-1 flex items-baseline gap-3">
            <div className="text-4xl font-semibold tabular-nums">
              ${groupPortfolioValue.toFixed(0)}
            </div>
            <div className={cn(
              "text-lg tabular-nums",
              groupPortfolioValue >= 1000 ? "text-success" : "text-destructive"
            )}>
              {groupPortfolioValue >= 1000 ? "+" : ""}{(((groupPortfolioValue - 1000) / 1000) * 100).toFixed(1)}%
            </div>
          </div>
          <div className="mt-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Current week change
          </div>
          <div
            className={cn(
              "mt-1 text-3xl font-semibold tabular-nums",
              groupPerformance === null
                ? "text-muted-foreground"
                : positive
                ? "text-success"
                : "text-destructive"
            )}
          >
            {groupPerformance !== null
              ? `${positive ? "+" : ""}${groupPerformance.toFixed(2)}%`
              : "—"}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Since Monday {weekStart}
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            S&amp;P 500 Value
          </div>
          <div className="mt-1 flex items-baseline gap-3">
            <div className="text-4xl font-semibold tabular-nums">
              ${benchmarkPortfolioValue.toFixed(0)}
            </div>
            <div className={cn(
              "text-lg tabular-nums",
              benchmarkPortfolioValue >= 1000 ? "text-success" : "text-destructive"
            )}>
              {benchmarkTotalReturn >= 0 ? "+" : ""}{benchmarkTotalReturn.toFixed(1)}%
            </div>
          </div>
          <div className="mt-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Current week change
          </div>
          <div
            className={cn(
              "mt-1 text-3xl font-semibold tabular-nums",
              benchmarkWeekPerformance === null
                ? "text-muted-foreground"
                : benchmarkPositive
                ? "text-success"
                : "text-destructive"
            )}
          >
            {benchmarkWeekPerformance !== null
              ? `${benchmarkPositive ? "+" : ""}${benchmarkWeekPerformance.toFixed(2)}%`
              : "—"}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Since Monday {weekStart}
          </div>
        </div>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Allocations</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border p-0">
          {portfolio.map((p) => (
            <div key={p.symbol} className="flex items-center justify-between px-5 py-3">
              <span className="text-sm">
                <span className="font-medium">{p.symbol}</span>
                <span className="text-muted-foreground"> — {stocks[p.symbol]}</span>
              </span>
              <span className="tabular-nums text-sm text-muted-foreground">
                {p.percentage.toFixed(1)}%
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Group portfolio vs S&amp;P 500</CardTitle>
        </CardHeader>
        <CardContent>
          {comparisonHistory.length > 0 ? (
            <div style={{ width: "100%", height: 320 }}>
              <ResponsiveContainer>
                <LineChart data={comparisonHistory} margin={{ top: 10, right: 16, left: 12, bottom: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="snapshot_date"
                    tickFormatter={(value: string) => value.slice(5)}
                    minTickGap={24}
                    stroke="var(--muted-foreground)"
                    fontSize={12}
                  />
                  <YAxis
                    stroke="var(--muted-foreground)"
                    fontSize={12}
                    domain={["dataMin - 10", "dataMax + 10"]}
                    tickFormatter={(value: number) => `$${value.toFixed(0)}`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(value, name) => [`$${Number(value ?? 0).toFixed(2)}`, String(name)]}
                    labelFormatter={(label) => String(label)}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="portfolio_value"
                    name="Group portfolio"
                    stroke="var(--primary)"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 5 }}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="benchmark_value"
                    name="S&amp;P 500 (SPY)"
                    stroke="var(--success)"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 5 }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No portfolio or S&amp;P 500 history yet.</p>
          )}
          </CardContent>
        </Card>
    </div>
  );
}