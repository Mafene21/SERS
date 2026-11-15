"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Activity, ShieldAlert } from "lucide-react";
import { DemoContext, type DemoContextValue } from "./demo-provider";
import type { ActionResult, WorkspaceSnapshot } from "@/lib/types";

type Mutate = (command: string, payload: object) => Promise<ActionResult>;
const LiveWorkspaceContext = createContext<{
  snapshot: WorkspaceSnapshot;
  mutate: Mutate;
} | null>(null);
export function useLiveWorkspace() {
  return useContext(LiveWorkspaceContext);
}

export function LiveProvider({ children }: { children: React.ReactNode }) {
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const operation = useRef(false);
  const sequence = useRef(0);
  const mounted = useRef(true);
  const refresh = useCallback(async () => {
    const current = ++sequence.current;
    try {
      const response = await fetch("/api/workspace", { cache: "no-store" });
      if (response.status === 401) {
        window.location.replace("/login");
        return;
      }
      const data = await response.json();
      if (!mounted.current || current !== sequence.current) return;
      if (!response.ok) {
        setSnapshot(null);
        setError(data.error ?? "Unable to load shared records.");
        return;
      }
      setSnapshot(data);
      setError("");
    } catch {
      if (mounted.current && current === sequence.current) {
        setSnapshot(null);
        setError(
          "Unable to connect to shared records. Check your connection and retry.",
        );
      }
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    void Promise.resolve().then(refresh);
    const timer = setInterval(() => {
      if (!operation.current && document.visibilityState === "visible")
        void refresh();
    }, 30_000);
    const focus = () => {
      if (!operation.current) void refresh();
    };
    window.addEventListener("focus", focus);
    return () => {
      mounted.current = false;
      clearInterval(timer);
      window.removeEventListener("focus", focus);
    };
  }, [refresh]);
  useEffect(() => {
    if (snapshot)
      document.documentElement.classList.toggle(
        "dark",
        snapshot.state.preferences.dark,
      );
  }, [snapshot]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  const mutate: Mutate = async (command, payload) => {
    if (operation.current)
      return {
        ok: false,
        error: "A change is already being saved. Please wait.",
      };
    operation.current = true;
    setBusy(true);
    ++sequence.current;
    try {
      const response = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command, payload }),
      });
      const data = await response.json();
      if (response.status === 401 || response.status === 403) await refresh();
      if (!response.ok)
        return {
          ok: false,
          error: data.error ?? "The change could not be saved.",
        };
      setToast("Change saved to shared records");
      await refresh();
      return data;
    } catch {
      return {
        ok: false,
        error:
          "Connection interrupted. Refresh to check whether your change was saved.",
      };
    } finally {
      operation.current = false;
      setBusy(false);
    }
  };
  async function signOut() {
    if (operation.current) return;
    operation.current = true;
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      });
      if (!response.ok) {
        setError(
          "Unable to end your session. Check your connection and try again.",
        );
        return;
      }
      ++sequence.current;
      setSnapshot(null);
      window.location.replace("/login");
    } catch {
      setError(
        "Unable to end your session. Check your connection and try again.",
      );
    } finally {
      operation.current = false;
    }
  }
  if (!snapshot)
    return (
      <main className="access-page">
        <section className="panel access-card">
          {error ? <ShieldAlert size={32} /> : <Activity size={32} />}
          <h1>{error ? "Workspace unavailable" : "Opening your workspace…"}</h1>
          <p role={error ? "alert" : "status"}>
            {error || "Checking your account and loading shared records."}
          </p>
          {error && (
            <div className="modal-actions">
              <button className="button" onClick={() => void signOut()}>
                Sign out
              </button>
              <button className="button primary" onClick={() => void refresh()}>
                Try again
              </button>
            </div>
          )}
        </section>
      </main>
    );
  const value: DemoContextValue = {
    state: snapshot.state,
    visibleIncidents: snapshot.state.incidents,
    hydrated: true,
    isDemo: false,
    busy,
    refresh,
    signOut,
    storageError: error || null,
    isAdmin: snapshot.account.role === "admin",
    actor: snapshot.account.name,
    toast,
    notify: setToast,
    setRole: () => {},
    reset: () => {},
    assign: (id, responderId) => mutate("assign", { id, responderId }),
    transition: (id, status, reason) =>
      mutate("transition", { id, status, reason }),
    addNote: (id, note) => mutate("note", { id, note }),
    simulate: (input) =>
      mutate("report", { ...input, id: crypto.randomUUID() }),
    setAvailability: (id, availability) =>
      mutate("availability", { id, availability }),
    setActive: (id, active) => mutate("active", { id, active }),
    updatePreferences: (preferences) => {
      void mutate("preferences", preferences).then((result) => {
        if (!result.ok) setToast(result.error);
      });
    },
    readNotifications: () => {
      void mutate("read_notifications", {}).then((result) => {
        if (!result.ok) setToast(result.error);
      });
    },
  };
  return (
    <LiveWorkspaceContext.Provider value={{ snapshot, mutate }}>
      <DemoContext.Provider value={value}>{children}</DemoContext.Provider>
    </LiveWorkspaceContext.Provider>
  );
}
