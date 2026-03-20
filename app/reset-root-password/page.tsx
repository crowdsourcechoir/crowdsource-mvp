"use client";

import { useState } from "react";
import Link from "next/link";

export default function ResetRootPasswordPage() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      if (newPassword.length < 8) {
        setError("Password must be at least 8 characters.");
        return;
      }
      if (newPassword !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }

      const res = await fetch("/api/auth/reset-root-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Reset failed.");
        return;
      }

      setSuccess(true);
      // After reset, go sign in with the new password.
    } catch {
      setError("Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0c0c0e] px-4 pb-[env(safe-area-inset-bottom)]">
      <div className="w-full max-w-xs space-y-6">
        <Link href="/" className="text-sm text-gray-400 hover:text-gray-200 hover:underline">
          Back to sign in
        </Link>

        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-gray-100">Reset admin password</h1>
          <p className="text-sm text-gray-400">
            This only works on your local dev server.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label htmlFor="newPassword" className="block text-sm font-medium text-gray-400">
            New password
          </label>
          <input
            id="newPassword"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            className="w-full rounded-xl border border-gray-600 bg-[#1a1a1a] px-4 py-3 text-gray-100 placeholder-gray-500 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
            placeholder="Enter a new password"
            required
            disabled={submitting}
          />

          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-400">
            Confirm new password
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            className="w-full rounded-xl border border-gray-600 bg-[#1a1a1a] px-4 py-3 text-gray-100 placeholder-gray-500 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
            placeholder="Re-enter the new password"
            required
            disabled={submitting}
          />

          {error && <p className="text-sm text-red-400">{error}</p>}

          {success ? (
            <div className="space-y-3">
              <p className="text-sm text-green-400">Password reset. Please sign in again.</p>
              <Link
                href="/"
                className="block w-full min-h-[48px] rounded-xl bg-white px-4 py-3 text-center text-base font-medium text-gray-900 hover:bg-gray-200 active:bg-gray-300"
              >
                Go to sign in
              </Link>
            </div>
          ) : (
            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-[48px] rounded-xl bg-white px-4 py-3 text-base font-medium text-gray-900 hover:bg-gray-200 active:bg-gray-300 disabled:opacity-50"
            >
              {submitting ? "Resetting…" : "Reset password"}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

