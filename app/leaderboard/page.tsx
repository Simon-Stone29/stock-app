"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import { Card, CardHeader, CardTitle, CardContent } from "@/src/components/ui/card";
import { cn } from "@/src/lib/utils";

export default function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdateDate, setLastUpdateDate] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      // get signed-in user id (if any) to highlight on the leaderboard
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setCurrentUserId(user?.id ?? null);
      } catch (err) {
        // ignore - not signed in or no session
      }
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
            competence_score: scoreMap[user.id] ?? 0,
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
      <div className="mx-auto max-w-4xl px-4 py-8 text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
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
            return (
                <div
                  key={entry.user_id}
                  className={cn(
                    "flex items-center justify-between px-5 py-3",
                    entry.user_id === currentUserId ? "rounded-lg" : ""
                  )}
                  style={entry.user_id === currentUserId ? { background: "rgba(11,92,255,0.06)" } : undefined}
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
                    <span className={cn("text-sm font-medium", entry.user_id === currentUserId ? "text-white" : "") }>
                      {entry.username || "Anonymous"}
                    </span>
                </div>
                  <span className={cn("tabular-nums text-sm", entry.user_id === currentUserId ? "text-white font-semibold" : "text-muted-foreground")}>
                    {entry.competence_score.toFixed(0)}
                  </span>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}