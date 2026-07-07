"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase";

const MAX_STOCKS = 10;
const MAX_SINGLE_ALLOCATION = 100;

function getNextMonday(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  let daysUntilNextMonday;
  
  if (day === 6) {
    daysUntilNextMonday = 2; // Saturday -> Monday (2 days)
  } else if (day === 0) {
    daysUntilNextMonday = 1; // Sunday -> Monday (1 day)
  } else {
    daysUntilNextMonday = 8 - day; // Mon-Fri -> next Monday
  }
  
  d.setDate(d.getDate() + daysUntilNextMonday);
  return d.toISOString().split("T")[0];
}

function getLastMonday(date: Date): string {
  const thisMonday = new Date(date);
  const day = thisMonday.getDay();
  const daysBack = day === 0 ? 6 : day - 1;
  thisMonday.setDate(thisMonday.getDate() - daysBack);
  
  const lastMonday = new Date(thisMonday);
  return lastMonday.toISOString().split("T")[0];
}

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [stocks, setStocks] = useState<any[]>([]);
  const [picks, setPicks] = useState<{ symbol: string; percentage: number }[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState("");
  const [testDateTime, setTestDateTime] = useState(new Date().toISOString().slice(0, 16));
  const [isVotingPhase, setIsVotingPhase] = useState(true);
  const [weekStart, setWeekStart] = useState("");
  const [lastWeekGain, setLastWeekGain] = useState<number | null>(null);
  const [currentWeekGain, setCurrentWeekGain] = useState<number | null>(null);
  const [serverTime, setServerTime] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        setUser(data.user);
        
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

  // Fetch server time context
  useEffect(() => {
    const fetchServerTime = () => {
      fetch("/api/time-context")
        .then((res) => res.json())
        .then((data) => setServerTime(data));
    };

    fetchServerTime();
    const interval = setInterval(fetchServerTime, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  // Calculate week_start from test date or server time
  useEffect(() => {
    if (serverTime?.isSimulation) {
      // In simulation mode, server controls time
      setWeekStart(serverTime.weekStart);
      setIsVotingPhase(serverTime.votingOpen);
    } else {
      // In production, use local test controls
      const testDate = new Date(testDateTime);
      setWeekStart(getNextMonday(testDate));

      const day = testDate.getDay();
      const hour = testDate.getHours();
      const isSat = day === 6;
      const isSun = day === 0;
      const isAfter9AM = hour >= 9;
      const isBeforeMidnight = hour < 24;
      const voting = (isSat && isAfter9AM) || (isSun && isBeforeMidnight);
      setIsVotingPhase(voting);
    }
  }, [testDateTime, serverTime]);

  useEffect(() => {
    if (!user || !weekStart) return;
    supabase
      .from("weekly_picks")
      .select("symbol, percentage")
      .eq("user_id", user.id)
      .eq("week_start", weekStart)
      .then(({ data }) => {
        if (data?.length) setPicks(data);
      });
  }, [user, weekStart]);

  // Calculate last week's gain
  useEffect(() => {
    if (!user) return;

    const calculateLastWeekGain = async () => {
      const testDate = new Date(testDateTime);
      const previousWeekMonday = getLastMonday(testDate);

      const { data: prevPicks } = await supabase
        .from("weekly_picks")
        .select("symbol, percentage")
        .eq("user_id", user.id)
        .eq("week_start", previousWeekMonday);

      if (!prevPicks?.length) {
        setLastWeekGain(null);
        return;
      }

      const { data: prices } = await supabase
        .from("stock_prices")
        .select("symbol, open_price, close_price")
        .eq("week_start", previousWeekMonday);

      if (!prices?.length) {
        setLastWeekGain(null);
        return;
      }

      const priceMap: Record<string, { open: number; close: number }> = {};
      prices.forEach(p => {
        priceMap[p.symbol] = { open: p.open_price, close: p.close_price };
      });

      let weeklyReturn = 0;
      for (const pick of prevPicks) {
        const price = priceMap[pick.symbol];
        if (!price || price.open === 0) continue;
        const stockReturn = (price.close - price.open) / price.open;
        weeklyReturn += stockReturn * (pick.percentage / 100);
      }

      setLastWeekGain(weeklyReturn * 100);
    };

    calculateLastWeekGain();
  }, [user, testDateTime]);

  useEffect(() => {
    if (!user || !weekStart) return;

    const calculateCurrentWeekGain = async () => {
      const { data: prices } = await supabase
        .from("stock_prices")
        .select("symbol, open_price, close_price")
        .eq("week_start", weekStart);

      if (!prices?.length || !picks?.length) {
        setCurrentWeekGain(null);
        return;
      }

      const priceMap: Record<string, { open: number; close: number }> = {};
      prices.forEach(p => {
        priceMap[p.symbol] = { open: p.open_price, close: p.close_price };
      });

      let weeklyReturn = 0;
      for (const pick of picks) {
        const price = priceMap[pick.symbol];
        if (!price || price.open === 0) continue;
        const stockReturn = (price.close - price.open) / price.open;
        weeklyReturn += stockReturn * (pick.percentage / 100);
      }

      setCurrentWeekGain(picks.length ? weeklyReturn * 100 : null);
    };

    calculateCurrentWeekGain();
  }, [user, weekStart, picks]);


  const login = () => {
    const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/` : undefined;

    return supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
      },
    });
  };

  const addStock = () => {
    if (!isVotingPhase) return alert("Voting phase is closed");
    if (!selectedSymbol) return;
    if (picks.length >= MAX_STOCKS) return alert("Max 10 stocks");
    if (picks.find((p) => p.symbol === selectedSymbol)) return alert("Already added");
    setPicks([...picks, { symbol: selectedSymbol, percentage: 0 }]);
    setSelectedSymbol("");
  };

  const updatePercentage = (symbol: string, value: number) => {
    if (!isVotingPhase) return;
    const newPicks = picks.map((p) =>
      p.symbol === symbol ? { ...p, percentage: value } : p
    );
    const total = newPicks.reduce((sum, p) => sum + p.percentage, 0);
    if (total > 100) return;
    setPicks(newPicks);
  };

  const removeStock = (symbol: string) => {
    if (!isVotingPhase) return;
    setPicks(picks.filter((p) => p.symbol !== symbol));
  };

  const totalAllocated = picks.reduce((sum, p) => sum + p.percentage, 0);

  const submitPicks = async () => {
    if (!isVotingPhase) return alert("Voting phase is closed");
    if (!user || !weekStart) return;
    if (totalAllocated !== 100) return alert("Total must equal 100%");

    await supabase
      .from("weekly_picks")
      .delete()
      .eq("user_id", user.id)
      .eq("week_start", weekStart);

    await supabase.from("weekly_picks").insert(
      picks.map((p) => ({
        user_id: user.id,
        symbol: p.symbol,
        percentage: p.percentage,
        week_start: weekStart,
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

      {/* TEST CONTROLS */}
      {!serverTime?.isSimulation && (
        <div className="card mb-4 bg-light">
          <div className="card-body">
            <label className="form-label small">TEST: Set Date/Time</label>
            <div className="d-flex gap-2 align-items-center">
              <input
                type="datetime-local"
                className="form-control form-control-sm"
                value={testDateTime}
                onChange={(e) => setTestDateTime(e.target.value)}
              />
              <span className="badge bg-info">{isVotingPhase ? "🔓 VOTING" : "🔒 LOCKED"}</span>
            </div>
          </div>
        </div>
      )}

      {serverTime?.isSimulation && (
        <div className="alert alert-warning">
          <strong>Simulation Mode Active</strong> - Server time: {serverTime.currentTime}
        </div>
      )}

      {/* Last Week Gain */}
      <div className="alert alert-info mb-2">
        Last Week's Change: <strong>{lastWeekGain !== null ? (lastWeekGain >= 0 ? "+" : "") + lastWeekGain.toFixed(2) + "%" : "—"}</strong>
      </div>
      <div className="alert alert-secondary">
        Current Week Change: <strong>{currentWeekGain !== null ? (currentWeekGain >= 0 ? "+" : "") + currentWeekGain.toFixed(2) + "%" : "—"}</strong>
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
              disabled={!isVotingPhase}
            >
              <option value="">Select a stock...</option>
              {stocks.map((s) => (
                <option key={s.Symbol} value={s.Symbol}>
                  {s.Symbol} — {s.Name}
                </option>
              ))}
            </select>
            <button className="btn btn-primary" onClick={addStock} disabled={!isVotingPhase}>
              Add
            </button>
          </div>
          {!isVotingPhase && <small className="text-muted d-block mt-2">Voting closed. Try again Saturday 9 AM.</small>}
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
                      disabled={!isVotingPhase}
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
                  disabled={!isVotingPhase}
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
              disabled={!isVotingPhase || totalAllocated !== 100}
            >
              Submit Picks
            </button>
          </div>
        </div>
      )}
    </div>
  );
}