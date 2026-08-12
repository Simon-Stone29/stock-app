"use client";
import { useState } from "react";

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
      className="modal show d-block"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      tabIndex={-1}
    >
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Choose a Display Name</h5>
          </div>
          <div className="modal-body">
            <p className="text-muted mb-3">
              This will be shown on the leaderboard instead of your email.
            </p>
            <input
              type="text"
              className="form-control"
              placeholder="Enter username (or skip for random)"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              autoFocus
            />
            {error && <div className="text-danger small mt-2">{error}</div>}
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onSkip}
            >
              Skip (Random Name)
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSubmit}
            >
              Set Username
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
