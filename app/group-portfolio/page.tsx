"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase";

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

      // Get stock names
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

  return (
    <div className="container mt-4">
      <h1 className="mb-4">Group Portfolio</h1>
      {weekStart && (
        <div className="mb-2">
          <p className="text-muted mb-1">Week of {weekStart}</p>
          <p className="text-muted small">
            Current Group Change: <strong>{groupPerformance !== null ? (groupPerformance >= 0 ? "+" : "") + groupPerformance.toFixed(2) + "%" : "—"}</strong>
            <br />
            <small>(Since Monday {weekStart})</small>
          </p>
        </div>
      )}
      <div className="card">
        <div className="card-body">
          <table className="table">
            <thead>
              <tr>
                <th>Stock</th>
                <th>Allocation</th>
              </tr>
            </thead>
            <tbody>
              {portfolio.map((p) => (
                <tr key={p.symbol}>
                  <td>
                    <strong>{p.symbol}</strong> — {stocks[p.symbol]}
                  </td>
                  <td>{p.percentage.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}