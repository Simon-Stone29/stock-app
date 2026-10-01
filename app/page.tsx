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
  Legend,
} from "recharts";
import { supabase } from "@/src/lib/supabase";
import { getLastMonday, getNextMonday, getPreviousMonday, isVotingOpen } from "@/src/lib/weekDates";
import UsernameSetupModal from "@/src/components/UsernameSetupModal";
import { Button } from "@/src/components/ui/button";
import { Badge } from "@/src/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/src/components/ui/card";
import { cn } from "@/src/lib/utils";

const MAX_STOCKS = 10;
const MAX_SINGLE_ALLOCATION = 100;

function GainLabel({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground">—</span>;
  const positive = value >= 0;
  return (
    <span className={cn("tabular-nums", positive ? "text-success" : "text-destructive")}>
      {positive ? "+" : ""}
      {value.toFixed(2)}%
    </span>
  );
}

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
  const [portfolioHistory, setPortfolioHistory] = useState<{ snapshot_date: string; portfolio_value: number }[]>([]);
  const [groupPortfolioHistory, setGroupPortfolioHistory] = useState<{ snapshot_date: string; portfolio_value: number }[]>([]);
  const [serverTime, setServerTime] = useState<any>(null);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [portfolioBalance, setPortfolioBalance] = useState<number>(1000);

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
        const { data: existingUser } = await supabase
          .from("users")
          .select("username")
          .eq("id", nextUser.id)
          .single();

        if (!existingUser) {
          const randomUsername = await generateUniqueUsername();
          await supabase.from("users").insert({
            id: nextUser.id,
            email: nextUser.email,
            username: randomUsername,
          });
          setShowUsernameModal(true);
        } else if (!existingUser.username) {
          const randomUsername = await generateUniqueUsername();
          await supabase
            .from("users")
            .update({ username: randomUsername })
            .eq("id", nextUser.id);
          setShowUsernameModal(true);
        }
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

  useEffect(() => {
    const fetchServerTime = () => {
      fetch("/api/time-context")
        .then((res) => res.json())
        .then((data) => setServerTime(data));
    };

    fetchServerTime();
    const interval = setInterval(fetchServerTime, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (serverTime?.isSimulation) {
      setWeekStart(serverTime.weekStart);
      setIsVotingPhase(serverTime.votingOpen);
    } else {
      const testDate = currentDateTime;
      const votingOpen = isVotingOpen(testDate);
      setIsVotingPhase(votingOpen);
      setWeekStart(votingOpen ? getNextMonday(testDate) : getLastMonday(testDate));
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

  useEffect(() => {
    if (!user) {
      setPortfolioHistory([]);
      setPortfolioBalance(1000);
      return;
    }

    const fetchPortfolioHistory = async () => {
      const { data } = await supabase
        .from("scores")
        .select("score_date, portfolio_value")
        .eq("user_id", user.id)
        .order("score_date", { ascending: true });

      setPortfolioHistory(
        (data ?? []).map((row) => ({
          snapshot_date: row.score_date,
          portfolio_value: Number(row.portfolio_value),
        }))
      );
    };

    const fetchPortfolioBalance = async () => {
      const { data } = await supabase
        .from("scores")
        .select("portfolio_value")
        .eq("user_id", user.id)
        .order("score_date", { ascending: false })
        .limit(1)
        .single();

      setPortfolioBalance(data?.portfolio_value ?? 1000);
    };

    void fetchPortfolioHistory();
    void fetchPortfolioBalance();
  }, [user]);

  useEffect(() => {
    const fetchSharedHistory = async () => {
      const { data, error } = await supabase
        .from("group_portfolio_daily")
        .select("snapshot_date, portfolio_value")
        .order("snapshot_date", { ascending: true });

      if (error) console.error("Failed to load group portfolio history:", error);

      setGroupPortfolioHistory((data ?? []).map((row) => ({
        snapshot_date: row.snapshot_date,
        portfolio_value: Number(row.portfolio_value),
      })));
    };

    void fetchSharedHistory();
  }, []);

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

  const generateUniqueUsername = async (): Promise<string> => {
    while (true) {
      const randomNum = Math.floor(10000 + Math.random() * 90000);
      const username = `Trader_${randomNum}`;

      const { data } = await supabase
        .from("users")
        .select("id")
        .eq("username", username)
        .single();

      if (!data) return username;
    }
  };

  const handleUsernameSubmit = async (username: string) => {
    if (!user) return;

    const { error } = await supabase
      .from("users")
      .update({ username })
      .eq("id", user.id);

    if (error) {
      if (error.code === "23505") {
        alert("Username already taken. Please choose another.");
        return;
      }
      alert("Error setting username. Please try again.");
      return;
    }

    setShowUsernameModal(false);
  };

  const handleUsernameSkip = () => {
    setShowUsernameModal(false);
  };

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

  const individualValuesByDate = new Map(portfolioHistory.map((row) => [row.snapshot_date, row.portfolio_value]));
  const groupValuesByDate = new Map(groupPortfolioHistory.map((row) => [row.snapshot_date, row.portfolio_value]));
  const chartDates = Array.from(new Set([
    ...portfolioHistory.map((row) => row.snapshot_date),
    ...groupPortfolioHistory.map((row) => row.snapshot_date),
  ])).sort();
  const comparisonHistory = chartDates.map((snapshot_date) => ({
    snapshot_date,
    individual_value: individualValuesByDate.get(snapshot_date) ?? null,
    group_value: groupValuesByDate.get(snapshot_date) ?? null,
  }));

  if (!user) {
    return (
      <div className="mx-auto flex min-h-[80vh] max-w-3xl flex-col items-center justify-center px-4 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Alpha<span className="text-primary">Pool</span>
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Pick your stocks. Beat the group.
        </p>
        <Button className="mt-6" onClick={login}>
          Continue with Google
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {showUsernameModal && (
        <UsernameSetupModal
          onSubmit={handleUsernameSubmit}
          onSkip={handleUsernameSkip}
        />
      )}

      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">My Picks</h1>
        <span className="text-sm text-muted-foreground">{user.email}</span>
      </div>

      {/* Status row */}
      <div className="mb-6 flex items-center justify-between border-b border-border pb-4">
        {serverTime?.isSimulation ? (
          <Badge variant="default">Simulation — {serverTime.currentTime}</Badge>
        ) : (
          <span className="text-sm text-muted-foreground">
            {currentDateTime.toLocaleString()}
          </span>
        )}
        <Badge variant={isVotingPhase ? "success" : "outline"}>
          {isVotingPhase ? "Voting open" : "Voting locked"}
        </Badge>
      </div>

      {/* Portfolio Balance */}
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Portfolio Balance
        </div>
        <div className="mt-1 flex items-baseline gap-3">
          <div className="text-4xl font-semibold tabular-nums">
            ${portfolioBalance.toFixed(0)}
          </div>
          <div className={cn(
            "text-lg tabular-nums",
            (portfolioBalance - 1000) >= 0 ? "text-success" : "text-destructive"
          )}>
            {(portfolioBalance - 1000) >= 0 ? "+" : ""}{(((portfolioBalance - 1000) / 1000) * 100).toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Stat row */}
      <div className="mb-8 grid grid-cols-2 gap-6">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Last week
          </div>
          <div className="mt-1 text-3xl font-semibold">
            <GainLabel value={lastWeekGain} />
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Week of {getPreviousMonday(currentDateTime)}
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Current week
          </div>
          <div className="mt-1 text-3xl font-semibold">
            <GainLabel value={currentWeekGain} />
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Since {getLastMonday(currentDateTime)}
          </div>
        </div>
      </div>

      {/* Add stock */}
      <div className="mb-8">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Add a stock
        </div>
        <div className="flex gap-2">
          <select
            className="h-10 flex-1 rounded-lg border border-border bg-muted px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-40"
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
          <Button onClick={addStock} disabled={!isVotingPhase}>
            Add
          </Button>
        </div>
        {!isVotingPhase && (
          <p className="mt-2 text-xs text-muted-foreground">
            Voting closed. Try again Saturday 9 AM.
          </p>
        )}
      </div>

      {/* Picks */}
      {picks.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Your picks</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            {picks.map((p) => (
              <div key={p.symbol} className="py-4 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{p.symbol}</span>
                  <div className="flex items-center gap-3">
                    <span className="tabular-nums text-sm text-muted-foreground">
                      {p.percentage}%
                    </span>
                    <button
                      className="text-muted-foreground transition-colors hover:text-destructive disabled:pointer-events-none disabled:opacity-40"
                      onClick={() => removeStock(p.symbol)}
                      disabled={!isVotingPhase}
                      aria-label={`Remove ${p.symbol}`}
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <input
                  type="range"
                  className="mt-3 w-full accent-primary"
                  min={0}
                  max={MAX_SINGLE_ALLOCATION}
                  value={p.percentage}
                  onChange={(e) => updatePercentage(p.symbol, Number(e.target.value))}
                  disabled={!isVotingPhase}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Submit */}
      {picks.length > 0 && (
        <div className="mb-8 flex items-center justify-between rounded-xl border border-border p-4">
          <span
            className={cn(
              "tabular-nums text-sm font-medium",
              totalAllocated === 100 ? "text-success" : "text-destructive"
            )}
          >
            Total: {totalAllocated}%{" "}
            {totalAllocated === 100 ? "✓" : `(${100 - totalAllocated}% remaining)`}
          </span>
          <Button
            onClick={submitPicks}
            disabled={!isVotingPhase || totalAllocated !== 100}
          >
            Submit picks
          </Button>
        </div>
      )}

      {/* Performance chart */}
      <Card>
        <CardHeader>
          <CardTitle>Portfolio performance</CardTitle>
        </CardHeader>
        <CardContent>
          {comparisonHistory.length > 0 ? (
            <div style={{ width: "100%", height: 260 }}>
              <ResponsiveContainer>
                <LineChart data={comparisonHistory} margin={{ top: 10, right: 12, left: 0, bottom: 10 }}>
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
                    dataKey="individual_value"
                    name="Individual"
                     stroke="#ffdd47"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 5 }}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="group_value"
                    name="Group"
                    stroke="var(--primary)"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 5 }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No portfolio history yet for this user.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}