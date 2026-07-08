"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase";

export default function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        // Get users
        const { data: users, error: usersError } = await supabase
          .from("users")
          .select("id, email");
        
        console.log("Users:", users, usersError);

        // Get latest score for each user
        const { data: scores, error: scoresError } = await supabase
          .from("scores")
          .select("user_id, competence_score, week_start")
          .order("week_start", { ascending: false });

        console.log("Scores:", scores, scoresError);

        // Create score map with only the latest score per user
        const scoreMap: Record<string, number> = {};
        scores?.forEach((score) => {
          if (!scoreMap[score.user_id]) {
            scoreMap[score.user_id] = score.competence_score;
          }
        });

        console.log("Score map:", scoreMap);

        // Combine and sort
        const combined = users
          ?.map((user) => ({
            user_id: user.id,
            email: user.email,
            competence_score: scoreMap[user.id] ?? 0,
          }))
          .sort((a, b) => b.competence_score - a.competence_score);

        console.log("Combined leaderboard:", combined);
        setLeaderboard(combined || []);
      } catch (err) {
        console.error("Error fetching leaderboard:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  if (loading) return <div className="container mt-4">Loading...</div>;

  return (
    <div className="container mt-4">
      <div className="mb-3">
        <a href="/" className="btn btn-link">Home</a>
        <a href="/group-portfolio" className="btn btn-link">Group Portfolio</a>
      </div>
      <h1 className="mb-4">Leaderboard</h1>
      <div className="card">
        <div className="card-body">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: "60px" }}>Rank</th>
                <th>Email</th>
                <th style={{ width: "150px" }}>Score</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry, index) => (
                <tr key={entry.user_id}>
                  <td className="fw-bold">#{index + 1}</td>
                  <td>{entry.email}</td>
                  <td>{entry.competence_score.toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}