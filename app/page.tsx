"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase";

export default function Home() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  const login = () => supabase.auth.signInWithOAuth({ provider: "google" });

  const createProfile = async () => {
    if (!user) return;
    await supabase.from("users").upsert({ id: user.id, email: user.email });
    alert("Row created — check Supabase table editor");
  };

  if (!user) return (
    <div style={{ padding: 40 }}>
      <button onClick={login}>Login with Google</button>
    </div>
  );

  return (
    <div style={{ padding: 40 }}>
      <h1>Logged in as {user.email}</h1>
      <button onClick={createProfile}>Create DB Row</button>
    </div>
  );
}