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
  const [groupBalance, setGroupBalance] = useState<number>(0);
  const [userCount, setUserCount] = useState<number>(0);
  const [portfolioHistory, setPortfolioHistory] = useState<{ snapshot_date: string; portfolio_change_pct: number }[]>([]);

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
    const fetchGroupBalance = async () => {
      // Get latest score for all users who have scores
      const { data: scores } = await supabase
        .from("scores")
        .select("user_id, competence_score, week_start")
        .order("week_start", { ascending: false });

      if (!scores?.length) {
        setGroupBalance(0);
        setUserCount(0);
        return;
      }

      // Get latest score per user
      const userLatestScores: Record<string, number> = {};
      scores.forEach(s => {
        if (!userLatestScores[s.user_id]) {
          userLatestScores[s.user_id] = s.competence_score;
        }
      });

      // Sum all user balances
      const totalBalance = Object.values(userLatestScores).reduce((sum, score) => sum + score, 0);
      const numUsers = Object.keys(userLatestScores).length;

      setGroupBalance(totalBalance);
      setUserCount(numUsers);
    };

    fetchGroupBalance();
  }, []);

  useEffect(() => {
    const fetchPortfolioHistory = async () => {
      const { data } = await supabase
        .from("group_portfolio_daily")
        .select("snapshot_date, portfolio_change_pct")
        .order("snapshot_date", { ascending: true });

      setPortfolioHistory(
        (data ?? []).map((row) => ({
          snapshot_date: row.snapshot_date,
          portfolio_change_pct: Number(row.portfolio_change_pct),
        }))
      );
    };

    fetchPortfolioHistory();
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
          Group Average
        </div>
        <div className="mt-1 flex items-baseline gap-3">
          <div className="text-4xl font-semibold tabular-nums">
            ${userCount > 0 ? (groupBalance / userCount).toFixed(0) : '0'}
          </div>
          {userCount > 0 && (
            <div className={cn(
              "text-lg tabular-nums",
              ((groupBalance / userCount) - 1000) >= 0 ? "text-success" : "text-destructive"
            )}>
              {((groupBalance / userCount) - 1000) >= 0 ? "+" : ""}{((((groupBalance / userCount) - 1000) / 1000) * 100).toFixed(1)}%
            </div>
          )}
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

      {/* Performance Chart */}
      {portfolioHistory.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Performance History</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={portfolioHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="snapshot_date"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  tickFormatter={(val) => new Date(val).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                />
                <YAxis
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  tickFormatter={(val) => `${val.toFixed(1)}%`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                  }}
                  labelFormatter={(val) => new Date(val).toLocaleDateString()}
                  formatter={(val: number) => [`${val.toFixed(2)}%`, "Change"]}
                />
                <Line
                  type="monotone"
                  dataKey="portfolio_change_pct"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
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
    </div>
  );
}