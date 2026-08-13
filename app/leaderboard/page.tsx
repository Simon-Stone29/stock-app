"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import { Card, CardHeader, CardTitle, CardContent } from "@/src/components/ui/card";
import { cn } from "@/src/lib/utils";

export default function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdateDate, setLastUpdateDate] = useState<string | null>(null);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const { data: users, error: usersError } = await supabase
          .from("user_profiles")
          .select("id, username");

        console.log("Users:", users, usersError);

        const { data: scores, error: scoresError } = await supabase
          .from("scores")
          .select("user_id, competence_score, week_start")
          .order("week_start", { ascending: false });

        console.log("Scores:", scores, scoresError);

        const scoreMap: Record<string, number> = {};
        scores?.forEach((score) => {
          if (!scoreMap[score.user_id]) {
            scoreMap[score.user_id] = score.competence_score;
          }
        });

        const latestWeekStart = scores?.length
          ? scores.reduce((latest, score) =>
              score.week_start > latest ? score.week_start : latest,
              scores[0].week_start
            )
          : null;

        setLastUpdateDate(latestWeekStart);

        const combined = users
          ?.map((user) => ({
            user_id: user.id,
            username: user.username,
            competence_score: scoreMap[user.id] ?? 1000,
          }))
          .sort((a, b) => b.competence_score - a.competence_score);

        setLeaderboard(combined || []);
      } catch (err) {
        console.error("Error fetching leaderboard:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Leaderboard</h1>
        {lastUpdateDate && (
          <span className="text-xs text-muted-foreground">
            Updated as of {lastUpdateDate}
          </span>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Rankings</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border p-0">
          {leaderboard.map((entry, index) => {
            const rank = index + 1;
            const topThree = rank <= 3;
            const balance = entry.competence_score;
            const totalGained = balance - 1000;
            return (
              <div
                key={entry.user_id}
                className="flex items-center justify-between px-5 py-3"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "tabular-nums text-sm font-semibold",
                      topThree ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    #{rank}
                  </span>
                  <span className="text-sm font-medium">
                    {entry.username || "Anonymous"}
                  </span>
                </div>
                <div className="text-right">
                  <div className="tabular-nums text-sm font-semibold">
                    ${balance.toFixed(0)}
                  </div>
                  <div className={cn(
                    "tabular-nums text-xs",
                    totalGained >= 0 ? "text-success" : "text-destructive"
                  )}>
                    {totalGained >= 0 ? "+" : ""}${totalGained.toFixed(0)}
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}