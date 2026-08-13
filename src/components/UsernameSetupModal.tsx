"use client";
import { useState } from "react";
import { Button } from "@/src/components/ui/button";

interface UsernameSetupModalProps {
  onSubmit: (username: string) => void;
  onSkip: () => void;
}

export default function UsernameSetupModal({ onSubmit, onSkip }: UsernameSetupModalProps) {
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    const trimmed = username.trim();

    if (trimmed.length === 0) {
      onSkip();
      return;
    }

    if (trimmed.length < 3) {
      setError("Username must be at least 3 characters");
      return;
    }

    if (trimmed.length > 20) {
      setError("Username must be 20 characters or less");
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      setError("Username can only contain letters, numbers, and underscores");
      return;
    }

    onSubmit(trimmed);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
      tabIndex={-1}
    >
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">Choose a display name</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This will be shown on the leaderboard instead of your email.
        </p>

        <input
          type="text"
          className="mt-4 h-10 w-full rounded-lg border border-border bg-muted px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          placeholder="Enter username (or skip for random)"
          value={username}
          onChange={(e) => {
            setUsername(e.target.value);
            setError("");
          }}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          autoFocus
        />
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onSkip}>
            Skip (random name)
          </Button>
          <Button onClick={handleSubmit}>Set username</Button>
        </div>
      </div>
    </div>
  );
}