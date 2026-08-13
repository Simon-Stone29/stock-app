"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import { Card, CardHeader, CardTitle, CardContent } from "@/src/components/ui/card";
import { cn } from "@/src/lib/utils";

export default function GroupPortfolio() {
  const [portfolio, setPortfolio] = useState<any[]>([]);
  const [stocks, setStocks] = useState<any>({});
  const [weekStart, setWeekStart] = useState<string>("");
  const [groupPerformance, setGroupPerformance] = useState<number | null>(null);

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
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-xl font-semibold tracking-tight">Group Portfolio</h1>

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