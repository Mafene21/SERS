"use client";
import Link from "next/link";
import { LockKeyhole, LogOut, Moon, Radio, UserRound } from "lucide-react";
import { useDemo } from "./demo-provider";
import { useLiveWorkspace } from "./live-provider";
import { PageHeader } from "./ui";
import { memberCategories } from "@/lib/utils";

export function LiveSettings() {
  const { state, actor, isAdmin, busy, updatePreferences, signOut } = useDemo();
  const live = useLiveWorkspace();
  return (
    <>
      <PageHeader
        eyebrow="YOUR WORKSPACE"
        title={isAdmin ? "Settings" : "My profile"}
        description="Manage your appearance, activity alerts, and account security."
      />
      <div className="settings-layout">
        <section className="panel settings-section">
          <div className="panel-heading">
            <div>
              <h2>Profile</h2>
              <p>Your approved staff account</p>
            </div>
            <UserRound size={19} />
          </div>
          <div className="settings-body form-stack">
            <label>
              Full name
              <input value={actor} readOnly />
            </label>
            <label>
              Email address
              <input value={live?.snapshot.account.email ?? ""} readOnly />
            </label>
            <label>
              Workspace role
              <input
                value={
                  isAdmin
                    ? "Administrator"
                    : `Responder · ${memberCategories(live?.snapshot.account).join(" / ")}`
                }
                readOnly
              />
            </label>
            <p className="small-note">
              Contact your administrator to change your staff details or team.
            </p>
          </div>
        </section>
        <section className="panel settings-section">
          <div className="panel-heading">
            <div>
              <h2>Appearance</h2>
              <p>Saved to your account</p>
            </div>
            <Moon size={19} />
          </div>
          <div className="settings-body">
            <label className="toggle-setting">
              <span>
                <strong>Dark theme</strong>
                <small>Use a darker workspace.</small>
              </span>
              <input
                type="checkbox"
                checked={state.preferences.dark}
                disabled={busy}
                onChange={(e) => updatePreferences({ dark: e.target.checked })}
              />
            </label>
          </div>
        </section>
        <section className="panel settings-section">
          <div className="panel-heading">
            <div>
              <h2>Notifications</h2>
              <p>Shared incident activity</p>
            </div>
            <Radio size={19} />
          </div>
          <div className="settings-body">
            <label className="toggle-setting">
              <span>
                <strong>Show activity alerts</strong>
                <small>Display unread indicators for incident updates.</small>
              </span>
              <input
                type="checkbox"
                checked={state.preferences.notifications}
                disabled={busy}
                onChange={(e) =>
                  updatePreferences({ notifications: e.target.checked })
                }
              />
            </label>
            <p className="small-note">
              Records refresh every 30 seconds and when you return to the
              window. SMS and mobile push are planned separately.
            </p>
          </div>
        </section>
        <section className="panel settings-section">
          <div className="panel-heading">
            <div>
              <h2>Account & security</h2>
              <p>Sign-in and access permissions</p>
            </div>
            <LockKeyhole size={19} />
          </div>
          <div className="settings-body form-stack">
            <p className="small-note">
              Your account determines which team records you can see and which
              assignments you can change. Administrator approval is required for
              access.
            </p>
            <Link href="/recover?request=true" className="button">
              Request password reset
            </Link>
            <button
              className="button danger-subtle"
              disabled={busy}
              onClick={() => void signOut()}
            >
              <LogOut size={16} />
              Sign out of all sessions
            </button>
          </div>
        </section>
      </div>
    </>
  );
}
