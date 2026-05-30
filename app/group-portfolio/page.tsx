"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase";

const WEEK_START = "2026-05-25";

export default function GroupPortfolio() {
  const [portfolio, setPortfolio] = useState<any[]>([]);
  const [stocks, setStocks] = useState<any>({});

  useEffect(() => {
    const fetchPortfolio = async () => {
      const { data: portfolioData } = await supabase
        .from("weekly_portfolio")
        .select("symbol, percentage")
        .eq("week_start", WEEK_START)
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
  }, []);

  return (
    <div className="container mt-4">
      <h1 className="mb-4">Group Portfolio</h1>
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