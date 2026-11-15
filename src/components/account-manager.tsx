"use client";

import { useState } from "react";
import { Plus, Users } from "lucide-react";
import { useDemo } from "./demo-provider";
import { useLiveWorkspace } from "./live-provider";
import { Modal } from "./ui";
import { CATEGORIES, type Category, type Account } from "@/lib/types";
import { memberCategories } from "@/lib/utils";

export function AccountManager() {
  const workspace = useLiveWorkspace();
  const { isAdmin, busy } = useDemo();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [role, setRole] = useState("responder");
  const [linkAccount, setLinkAccount] = useState<Account | null>(null);
  const [link, setLink] = useState("");
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkError, setLinkError] = useState("");
  const [copied, setCopied] = useState(false);
  if (!workspace || !isAdmin) return null;
  return (
    <section className="panel account-management">
      <div className="panel-heading">
        <div>
          <h2>
            <Users size={18} /> Staff accounts
          </h2>
          <p>Approve access before staff activate their accounts.</p>
        </div>
        <button
          className="button primary"
          onClick={() => {
            setError("");
            setMessage("");
            setOpen(true);
          }}
        >
          <Plus size={16} />
          Add account
        </button>
      </div>
      <div className="table-scroll">
        <table className="incident-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role / team</th>
              <th>Account</th>
              <th>Manage access</th>
            </tr>
          </thead>
          <tbody>
            {workspace.snapshot.accounts.map((a) => (
              <tr key={a.id}>
                <td>{a.name}</td>
                <td>{a.email}</td>
                <td>
                  {a.role === "admin"
                    ? "Administrator"
                    : memberCategories(a).join(" / ")}
                </td>
                <td>
                  {!a.active
                    ? "Inactive"
                    : a.enrolled
                      ? "Activated"
                      : "Awaiting activation"}
                </td>
                <td>
                  <button
                    className="button"
                    disabled={!a.active || busy || linkBusy}
                    onClick={async () => {
                      setLinkAccount(a);
                      setLink("");
                      setLinkError("");
                      setCopied(false);
                      setLinkBusy(true);
                      try {
                        const response = await fetch("/api/accounts/link", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ accountId: a.id }),
                        });
                        const data = await response.json();
                        if (!response.ok)
                          setLinkError(
                            data.error ?? "Unable to create the account link.",
                          );
                        else setLink(data.link);
                      } catch {
                        setLinkError("Unable to connect. Please try again.");
                      } finally {
                        setLinkBusy(false);
                      }
                    }}
                  >
                    {a.enrolled ? "Reset link" : "Activation link"}
                  </button>
                  {a.id !== workspace.snapshot.account.id && (
                    <button
                      className="button"
                      disabled={busy || linkBusy}
                      onClick={async () => {
                        const result = await workspace.mutate("active", {
                          id: a.id,
                          active: !a.active,
                        });
                        if (!result.ok) setError(result.error);
                        else setError("");
                      }}
                    >
                      {a.active ? "Deactivate" : "Reactivate"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="account-instructions">
        Approve the account, create an <strong>Activation link</strong>, and
        share it privately with that staff member. They choose their own
        password. Use <strong>Reset link</strong> when an activated staff member
        needs a new password.
      </p>
      {error && !open && (
        <p className="field-error account-instructions" role="alert">
          {error}
        </p>
      )}
      {linkAccount && (
        <Modal
          title={`Private account link · ${linkAccount.name}`}
          description={linkAccount.email}
          onClose={() => {
            setLinkAccount(null);
            setLink("");
          }}
        >
          {linkBusy && <p role="status">Creating a single-use link…</p>}
          {linkError && (
            <p className="field-error" role="alert">
              {linkError}
            </p>
          )}
          {link && (
            <div className="form-stack">
              <p className="small-note">
                Share this single-use link directly with the approved account
                holder. Anyone with the link can activate or reset this account.
                It expires according to your authentication settings.
              </p>
              <label>
                Private account link
                <input
                  type="password"
                  readOnly
                  value={link}
                  onFocus={(e) => e.currentTarget.select()}
                />
              </label>
              <button
                className="button primary"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(link);
                    setCopied(true);
                  } catch {
                    setLinkError(
                      "Copy unavailable. Select the link field and copy it using your keyboard.",
                    );
                  }
                }}
              >
                {copied ? "Copied" : "Copy private link"}
              </button>
            </div>
          )}
        </Modal>
      )}
      {open && (
        <Modal
          title="Approve a staff account"
          description="The account holder chooses their own password and confirms their email."
          onClose={() => {
            if (!busy) setOpen(false);
          }}
        >
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy) return;
              const form = new FormData(e.currentTarget);
              const categories: Category[] =
                role === "admin"
                  ? []
                  : form.get("category") === "both"
                    ? [...CATEGORIES]
                    : [form.get("category") as Category];
              const result = await workspace.mutate("approve_account", {
                email: String(form.get("email")).trim().toLowerCase(),
                name: form.get("name"),
                role,
                category: categories[0] ?? null,
                ...(categories.length ? { categories } : {}),
                callsign: form.get("callsign") ?? "",
              });
              if (!result.ok) setError(result.error);
              else {
                setError("");
                setMessage(
                  "Account approved. Close this window, then create and privately share its activation link.",
                );
              }
            }}
          >
            <fieldset
              disabled={busy || !!message}
              className="plain-fieldset form-stack"
            >
              <label>
                Full name
                <input name="name" required minLength={2} maxLength={60} />
              </label>
              <label>
                Email address
                <input name="email" type="email" required maxLength={254} />
              </label>
              <label>
                Role
                <select value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="responder">Responder</option>
                  <option value="admin">Administrator</option>
                </select>
              </label>
              {role === "responder" && (
                <label>
                  Response team
                  <select name="category">
                    {CATEGORIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                    <option value="both">Fire and road</option>
                  </select>
                </label>
              )}
              <label>
                Call sign
                <input
                  name="callsign"
                  maxLength={30}
                  placeholder="e.g. ROAD-01"
                  required={role === "responder"}
                />
              </label>
            </fieldset>
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
            <div className="modal-actions">
              <button
                className="button"
                type="button"
                onClick={() => setOpen(false)}
                disabled={busy}
              >
                {message ? "Done" : "Cancel"}
              </button>
              {!message && (
                <button className="button primary" disabled={busy}>
                  {busy ? "Saving…" : "Approve account"}
                </button>
              )}
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
