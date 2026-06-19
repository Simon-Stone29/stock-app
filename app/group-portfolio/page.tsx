"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase";

export default function GroupPortfolio() {
  const [portfolio, setPortfolio] = useState<any[]>([]);
  const [stocks, setStocks] = useState<any>({});
  const [weekStart, setWeekStart] = useState<string>("");

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

  return (
    <div className="container mt-4">
      <h1 className="mb-4">Group Portfolio</h1>
      {weekStart && <p className="text-muted">Week of {weekStart}</p>}
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