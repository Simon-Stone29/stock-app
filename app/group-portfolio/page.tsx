"use client";
import { useEffect, useState } from "react";
import {
  CartesianGrid,
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
  const [groupPerformance, setGroupPerformance] = useState<number | null>(null);
  const [groupPortfolioValue, setGroupPortfolioValue] = useState<number>(1000);
  const [portfolioHistory, setPortfolioHistory] = useState<{ snapshot_date: string; portfolio_value: number }[]>([]);

  useEffect(() => {
    fetch("/api/time-context")
      .then((res) => res.json())
      .then((data) => setWeekStart(data.weekStart));
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

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-xl font-semibold tracking-tight">Group Portfolio</h1>

      {/* Group Balance */}
      <div className="mb-6">
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
      </div>

      {weekStart && (
        <div className="mb-8">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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
      )}

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

      {/* Performance chart */}
      <Card>
        <CardHeader>
          <CardTitle>Portfolio performance</CardTitle>
        </CardHeader>
        <CardContent>
          {portfolioHistory.length > 0 ? (
            <div style={{ width: "100%", height: 260 }}>
              <ResponsiveContainer>
                <LineChart data={portfolioHistory} margin={{ top: 10, right: 12, left: 0, bottom: 10 }}>
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
                    formatter={(value) => [`$${Number(value ?? 0).toFixed(2)}`, "Portfolio value"]}
                    labelFormatter={(label) => String(label)}
                  />
                  <Line
                    type="monotone"
                    dataKey="portfolio_value"
                    stroke="var(--primary)"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: "var(--primary)" }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No portfolio history yet for the group.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}