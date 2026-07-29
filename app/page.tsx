"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import { getLastMonday, getNextMonday, getPreviousMonday, isVotingOpen } from "@/src/lib/weekDates";
const MAX_STOCKS = 10;
const MAX_SINGLE_ALLOCATION = 100;

// Formats a Date as YYYY-MM-DD using LOCAL calendar components.
// Never use toISOString() for calendar dates — it converts to UTC first,
// which can shift the date near midnight depending on the user's timezone.


export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [stocks, setStocks] = useState<any[]>([]);
  const [picks, setPicks] = useState<{ symbol: string; percentage: number }[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState("");
  const [currentDateTime, setCurrentDateTime] = useState<Date>(new Date());
  const [isVotingPhase, setIsVotingPhase] = useState(true);
  const [weekStart, setWeekStart] = useState("");
  const [lastWeekGain, setLastWeekGain] = useState<number | null>(null);
  const [currentWeekGain, setCurrentWeekGain] = useState<number | null>(null);
  const [serverTime, setServerTime] = useState<any>(null);

  useEffect(() => {
    setCurrentDateTime(new Date());
    const interval = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 60000);

    let isMounted = true;

    const syncUser = async (nextUser: any) => {
      if (!isMounted) return;
      setUser(nextUser);

      if (nextUser) {
        await supabase.from("users").upsert(
          { id: nextUser.id, email: nextUser.email },
          { onConflict: "id" }
        );
      }
    };

    const initializeAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      await syncUser(session?.user ?? null);
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncUser(session?.user ?? null);
    });

    return () => {
      isMounted = false;
      clearInterval(interval);
      subscription.unsubscribe();
    };
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
      // In production, use the live current time
      const testDate = currentDateTime;
  const votingOpen = isVotingOpen(testDate);
  setIsVotingPhase(votingOpen);
  setWeekStart(getNextMonday(testDate)); // Always next Monday
    }
  }, [currentDateTime, serverTime]);

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
      const testDate = currentDateTime;
      const previousWeekMonday = getPreviousMonday(testDate);

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
  }, [user, currentDateTime]);

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
    const redirectTo = typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}` : undefined;

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

  return (
    <div className="container mt-4">
      {!user && (
        <div className="text-center py-4">
          <h1>Stock Picker</h1>
          <button className="btn btn-primary mt-3" onClick={login}>
            Login with Google
          </button>
        </div>
      )}

      {user && (
        <>
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h1 className="h3">Stock Picker</h1>
            <span className="text-muted small">{user.email}</span>
          </div>

          {!serverTime?.isSimulation && (
            <div className="card mb-4 bg-light">
              <div className="card-body d-flex justify-content-between align-items-center">
                <div>
                  <div className="small text-muted">Current time</div>
                  <div className="fw-semibold">{currentDateTime.toLocaleString()}</div>
                </div>
                <span className="badge bg-info">{isVotingPhase ? "🔓 VOTING" : "🔒 LOCKED"}</span>
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
            <br />
            <small className="text-muted">(Week of {getPreviousMonday(currentDateTime)})</small>
          </div>
          <div className="alert alert-secondary">
            Current Week Change: <strong>{currentWeekGain !== null ? (currentWeekGain >= 0 ? "+" : "") + currentWeekGain.toFixed(2) + "%" : "—"}</strong>
            <br />
            <small className="text-muted">(Since {getLastMonday(currentDateTime)})</small>
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
        </>
      )}
    </div>
  );
}