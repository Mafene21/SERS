"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, ShieldPlus } from "lucide-react";

export function AuthForm({
  mode = "login",
  configured = true,
  initialError = "",
}: {
  mode?: "login" | "signup" | "reset" | "password";
  configured?: boolean;
  initialError?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);
  const [message, setMessage] = useState("");
  const title = {
    login: "Welcome to SERS",
    signup: "Activate your account",
    reset: "Reset your password",
    password: "Choose a new password",
  }[mode];
  return (
    <main className="auth-page">
      <section className="auth-intro">
        <Link href="/login" className="brand">
          <span className="brand-mark">
            <ShieldPlus size={28} />
          </span>
          <span className="brand-copy">
            <strong>SERS.</strong>
            <small>EMERGENCY RESPONSE</small>
          </span>
        </Link>
        <span className="eyebrow">RESPONDERS & ADMINISTRATORS</span>
        <h1>
          A clear view.
          <br />A coordinated response.
        </h1>
        <p>Your workspace for road accident and fire incident coordination.</p>
        <div className="auth-assurance">
          <LockKeyhole size={18} />
          Access is limited to approved staff.
        </div>
      </section>
      <section className="auth-card panel">
        <span className="auth-symbol">
          <ShieldPlus size={30} />
        </span>
        <h2>{configured ? title : "Workspace setup in progress"}</h2>
        <p>
          {!configured
            ? "Your administrator is connecting the workspace. Please check back shortly."
            : mode === "signup"
              ? "Use the email address approved by your administrator. Confirm your email before signing in."
              : mode === "reset"
                ? "Enter your account email and we’ll send a reset link."
                : mode === "password"
                  ? "Use at least 12 characters for your new password."
                  : "Sign in to your response workspace."}
        </p>
        {configured && (
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy) return;
              const form = new FormData(e.currentTarget);
              const password = String(form.get("password") ?? "");
              if (
                (mode === "signup" || mode === "password") &&
                password !== form.get("confirmation")
              ) {
                setError("The passwords do not match.");
                return;
              }
              setBusy(true);
              setError("");
              setMessage("");
              try {
                const response = await fetch("/api/auth", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    action: mode,
                    ...(mode !== "password"
                      ? { email: form.get("email") }
                      : {}),
                    ...(mode !== "reset" ? { password } : {}),
                  }),
                });
                const data = await response.json();
                if (!response.ok)
                  setError(
                    data.error ?? "Unable to continue. Please try again.",
                  );
                else if (mode === "login" || mode === "password") {
                  router.replace("/");
                  router.refresh();
                } else setMessage(data.message);
              } catch {
                setError(
                  "Unable to connect. Check your connection and try again.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {mode !== "password" && (
              <label>
                Email address
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  disabled={busy}
                />
              </label>
            )}
            {mode !== "reset" && (
              <label>
                {mode === "password" ? "New password" : "Password"}
                <input
                  name="password"
                  type="password"
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  required
                  minLength={mode === "login" ? 1 : 12}
                  maxLength={128}
                  disabled={busy}
                />
              </label>
            )}
            {(mode === "signup" || mode === "password") && (
              <label>
                Confirm password
                <input
                  name="confirmation"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={12}
                  maxLength={128}
                  disabled={busy}
                />
              </label>
            )}
            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}
            {message && (
              <p className="info-callout" role="status">
                {message}
              </p>
            )}
            <button className="button primary full-width" disabled={busy}>
              {busy
                ? "Please wait…"
                : {
                    login: "Sign in",
                    signup: "Create account",
                    reset: "Send reset link",
                    password: "Save password",
                  }[mode]}
            </button>
          </form>
        )}
        {configured && (
          <div className="auth-links">
            {mode === "login" ? (
              <>
                <Link href="/recover?request=true">Forgot password?</Link>
                <Link href="/activate">Activate approved account</Link>
              </>
            ) : (
              <Link href="/login">Back to sign in</Link>
            )}
          </div>
        )}
        <p className="auth-footnote">SERS staff portal · East Africa Time</p>
      </section>
    </main>
  );
}
