"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase";

const MAX_STOCKS = 10;
const MAX_SINGLE_ALLOCATION = 100;
const WEEK_START = "2026-05-25";

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [stocks, setStocks] = useState<any[]>([]);
  const [picks, setPicks] = useState<{ symbol: string; percentage: number }[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState("");

useEffect(() => {
  supabase.auth.getUser().then(async ({ data }) => {
    if (data.user) {
      setUser(data.user);
      
      // Create user in public.users if they don't exist
      await supabase.from("users").upsert(
        { id: data.user.id, email: data.user.email },
        { onConflict: "id" }
      );
    }
  });
}, []);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("stocks")
      .select("Symbol, Name")
      .then(({ data }) => setStocks(data || []));
  }, [user]);

  const login = () => supabase.auth.signInWithOAuth({ provider: "google" });

  const addStock = () => {
    if (!selectedSymbol) return;
    if (picks.length >= MAX_STOCKS) return alert("Max 10 stocks");
    if (picks.find((p) => p.symbol === selectedSymbol)) return alert("Already added");
    setPicks([...picks, { symbol: selectedSymbol, percentage: 0 }]);
    setSelectedSymbol("");
  };

  const updatePercentage = (symbol: string, value: number) => {
    const newPicks = picks.map((p) =>
      p.symbol === symbol ? { ...p, percentage: value } : p
    );
    const total = newPicks.reduce((sum, p) => sum + p.percentage, 0);
    if (total > 100) return;
    setPicks(newPicks);
  };

  const removeStock = (symbol: string) => {
    setPicks(picks.filter((p) => p.symbol !== symbol));
  };

  const totalAllocated = picks.reduce((sum, p) => sum + p.percentage, 0);

  const submitPicks = async () => {
    if (!user) return;
    if (totalAllocated !== 100) return alert("Total must equal 100%");

    await supabase
      .from("weekly_picks")
      .delete()
      .eq("user_id", user.id)
      .eq("week_start", WEEK_START);

    await supabase.from("weekly_picks").insert(
      picks.map((p) => ({
        user_id: user.id,
        symbol: p.symbol,
        percentage: p.percentage,
        week_start: WEEK_START,
      }))
    );

    alert("Picks submitted!");
  };

  if (!user) return (
    <div className="container mt-5 text-center">
      <h1>Stock Picker</h1>
      <button className="btn btn-primary mt-3" onClick={login}>
        Login with Google
      </button>
    </div>
  );

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h3">Stock Picker</h1>
        <span className="text-muted small">{user.email}</span>
      </div>

      {/* Add Stock */}
      <div className="card mb-4">
        <div className="card-body">
          <h5 className="card-title">Add a Stock</h5>
          <div className="d-flex gap-2">
            <select
              className="form-select"
              value={selectedSymbol}
              onChange={(e) => setSelectedSymbol(e.target.value)}
            >
              <option value="">Select a stock...</option>
              {stocks.map((s) => (
                <option key={s.Symbol} value={s.Symbol}>
                  {s.Symbol} — {s.Name}
                </option>
              ))}
            </select>
            <button className="btn btn-primary" onClick={addStock}>
              Add
            </button>
          </div>
        </div>
      </div>

      {/* Picks */}
      {picks.length > 0 && (
        <div className="card mb-4">
          <div className="card-body">
            <h5 className="card-title">Your Picks</h5>
            {picks.map((p) => (
              <div key={p.symbol} className="mb-3">
                <div className="d-flex justify-content-between">
                  <span className="fw-bold">{p.symbol}</span>
                  <div className="d-flex align-items-center gap-2">
                    <span>{p.percentage}%</span>
                    <button
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => removeStock(p.symbol)}
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <input
                  type="range"
                  className="form-range"
                  min={0}
                  max={MAX_SINGLE_ALLOCATION}
                  value={p.percentage}
                  onChange={(e) => updatePercentage(p.symbol, Number(e.target.value))}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Total + Submit */}
      {picks.length > 0 && (
        <div className="card">
          <div className="card-body d-flex justify-content-between align-items-center">
            <span className={totalAllocated === 100 ? "text-success fw-bold" : "text-danger fw-bold"}>
              Total: {totalAllocated}% {totalAllocated === 100 ? "✓" : `(${100 - totalAllocated}% remaining)`}
            </span>
            <button
              className="btn btn-success"
              onClick={submitPicks}
              disabled={totalAllocated !== 100}
            >
              Submit Picks
            </button>
          </div>
        </div>
      )}
    </div>
  );
}