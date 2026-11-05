"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import { z } from "zod";
import { createDemoState } from "@/lib/demo-data";
import {
  CATEGORIES,
  PRIORITIES,
  STATUSES,
  type ActionResult,
  type Availability,
  type DemoState,
  type Incident,
  type IncidentStatus,
  type Preferences,
  type ViewRole,
} from "@/lib/types";
import { isActive, nextStatus } from "@/lib/utils";
import { noteSchema, reportSchema, type ReportInput } from "@/lib/schemas";

const KEY = "sers-demo-v1";
const savedSchema = z.object({
  version: z.literal(1),
  role: z.enum(["admin", "road-1", "fire-1"]),
  preferences: z.object({
    dark: z.boolean(),
    name: z.string().min(2).max(60),
    notifications: z.boolean(),
  }),
  responders: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      initials: z.string(),
      callsign: z.string(),
      category: z.enum(CATEGORIES),
      availability: z.enum(["Available", "On duty", "Off duty"]),
      active: z.boolean(),
    }),
  ),
  incidents: z.array(
    z.object({
      id: z.string(),
      reference: z.string(),
      category: z.enum(CATEGORIES),
      title: z.string(),
      description: z.string(),
      location: z.string(),
      coordinates: z
        .tuple([z.number().min(-90).max(90), z.number().min(-180).max(180)])
        .nullable(),
      priority: z.enum(PRIORITIES),
      status: z.enum(STATUSES),
      responderId: z.string().nullable(),
      reportedAt: z.iso.datetime(),
      updatedAt: z.iso.datetime(),
      timeline: z.array(
        z.object({
          id: z.string(),
          at: z.iso.datetime(),
          actor: z.string(),
          title: z.string(),
          detail: z.string().optional(),
          kind: z.enum(["status", "assignment", "note", "report"]),
        }),
      ),
    }),
  ),
  notifications: z.array(
    z.object({
      id: z.string(),
      incidentId: z.string(),
      title: z.string(),
      at: z.iso.datetime(),
      read: z.boolean(),
    }),
  ),
});

interface DemoContextValue {
  state: DemoState;
  visibleIncidents: Incident[];
  hydrated: boolean;
  storageError: string | null;
  isAdmin: boolean;
  actor: string;
  toast: string | null;
  notify: (message: string) => void;
  setRole: (role: ViewRole) => void;
  assign: (id: string, responderId: string) => ActionResult;
  transition: (
    id: string,
    status: IncidentStatus,
    reason?: string,
  ) => ActionResult;
  addNote: (id: string, note: string) => ActionResult;
  simulate: (input: ReportInput) => ActionResult;
  setAvailability: (id: string, availability: Availability) => ActionResult;
  setActive: (id: string, active: boolean) => ActionResult;
  updatePreferences: (value: Partial<Preferences>) => void;
  readNotifications: () => void;
  reset: () => void;
}

const DemoContext = createContext<DemoContextValue | null>(null);

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [state, replace] = useReducer(
    (_: DemoState, next: DemoState) => next,
    undefined,
    createDemoState,
  );
  const latest = useRef(state);
  const [hydrated, markHydrated] = useReducer(() => true, false);
  const [storageError, setStorageError] = useReducer(
    (_: string | null, message: string | null) => message,
    null,
  );
  const [toast, setToast] = useState<string | null>(null);
  const commit = useCallback((next: DemoState) => {
    latest.current = next;
    replace(next);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = savedSchema.safeParse(JSON.parse(raw));
        if (parsed.success) commit(parsed.data);
        else
          setStorageError(
            "Saved training data was incompatible. A fresh demo has been loaded.",
          );
      }
    } catch {
      setStorageError(
        "Browser storage is unavailable. Changes will last for this session only.",
      );
    }
    markHydrated();
  }, [commit]);

  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.classList.toggle("dark", state.preferences.dark);
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      setStorageError(
        "Browser storage is unavailable. Changes will last for this session only.",
      );
    }
  }, [hydrated, state]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(timer);
  }, [toast]);

  const actorFor = (s: DemoState) =>
    s.role === "admin"
      ? s.preferences.name
      : (s.responders.find((r) => r.id === s.role)?.name ?? "Demo responder");
  const canSee = (incident: Incident, s: DemoState) =>
    s.role === "admin" ||
    incident.category === s.responders.find((r) => r.id === s.role)?.category;
  const find = (id: string) =>
    latest.current.incidents.find((i) => i.id === id);
  function modify(
    id: string,
    update: (incident: Incident) => Incident,
    title: string,
  ) {
    const s = latest.current;
    const now = new Date().toISOString();
    commit({
      ...s,
      incidents: s.incidents.map((i) =>
        i.id === id ? update({ ...i, updatedAt: now }) : i,
      ),
      notifications: [
        {
          id: crypto.randomUUID(),
          incidentId: id,
          title,
          at: now,
          read: false,
        },
        ...s.notifications,
      ].slice(0, 100),
    });
    setToast(title);
  }

  function assign(id: string, responderId: string): ActionResult {
    const s = latest.current;
    const incident = find(id);
    const responder = s.responders.find((r) => r.id === responderId);
    if (s.role !== "admin")
      return {
        ok: false,
        error: "Only the administrator preview can assign responders.",
      };
    if (!incident || !isActive(incident))
      return { ok: false, error: "This incident is closed." };
    if (incident.status !== "Pending")
      return {
        ok: false,
        error:
          "Only pending incidents can be reassigned in this demonstration.",
      };
    if (
      !responder ||
      !responder.active ||
      responder.category !== incident.category ||
      responder.availability === "Off duty"
    )
      return {
        ok: false,
        error: "Select an active, on-duty responder from the correct team.",
      };
    if (
      s.incidents.some(
        (i) => i.id !== id && i.responderId === responderId && isActive(i),
      )
    )
      return {
        ok: false,
        error: "This responder already has an active assignment.",
      };
    modify(
      id,
      (i) => ({
        ...i,
        responderId,
        timeline: [
          ...i.timeline,
          {
            id: crypto.randomUUID(),
            at: new Date().toISOString(),
            actor: actorFor(s),
            title: `Assigned to ${responder.name}`,
            kind: "assignment",
          },
        ],
      }),
      `${incident.reference} assigned to ${responder.name}`,
    );
    return { ok: true };
  }

  function transition(
    id: string,
    status: IncidentStatus,
    reason?: string,
  ): ActionResult {
    const s = latest.current;
    const incident = find(id);
    if (!incident || !canSee(incident, s))
      return { ok: false, error: "Incident unavailable in this role preview." };
    const self = s.responders.find((r) => r.id === s.role);
    if (
      s.role !== "admin" &&
      (!self?.active || incident.responderId !== s.role)
    )
      return {
        ok: false,
        error: "You can only update your own active assignments.",
      };
    if (!isActive(incident))
      return { ok: false, error: "Closed incidents cannot be updated." };
    if (status === "Cancelled") {
      if (s.role !== "admin")
        return {
          ok: false,
          error: "Only an administrator can cancel an incident.",
        };
      if (!reason || reason.trim().length < 5 || reason.trim().length > 500)
        return {
          ok: false,
          error: "Enter a cancellation reason between 5 and 500 characters.",
        };
    } else {
      if (status !== nextStatus(incident.status))
        return { ok: false, error: "Invalid status transition." };
      if (!incident.responderId)
        return {
          ok: false,
          error: "Assign a responder before accepting this incident.",
        };
      if (!s.responders.find((r) => r.id === incident.responderId)?.active)
        return {
          ok: false,
          error: "The assigned responder account is inactive.",
        };
    }
    modify(
      id,
      (i) => ({
        ...i,
        status,
        timeline: [
          ...i.timeline,
          {
            id: crypto.randomUUID(),
            at: new Date().toISOString(),
            actor: actorFor(s),
            title: `Status changed to ${status.toLowerCase()}`,
            ...(reason ? { detail: reason.trim() } : {}),
            kind: "status",
          },
        ],
      }),
      `${incident.reference} marked ${status.toLowerCase()}`,
    );
    return { ok: true };
  }

  function addNote(id: string, note: string): ActionResult {
    const s = latest.current;
    const incident = find(id);
    const parsed = noteSchema.safeParse({ note });
    if (!parsed.success)
      return { ok: false, error: parsed.error.issues[0].message };
    if (
      !incident ||
      !canSee(incident, s) ||
      !isActive(incident) ||
      (s.role !== "admin" &&
        (incident.responderId !== s.role ||
          !s.responders.find((r) => r.id === s.role)?.active))
    )
      return {
        ok: false,
        error: "Notes can only be added to authorized, active assignments.",
      };
    modify(
      id,
      (i) => ({
        ...i,
        timeline: [
          ...i.timeline,
          {
            id: crypto.randomUUID(),
            at: new Date().toISOString(),
            actor: actorFor(s),
            title: "Response note added",
            detail: parsed.data.note,
            kind: "note",
          },
        ],
      }),
      `Note added to ${incident.reference}`,
    );
    return { ok: true };
  }

  function simulate(input: ReportInput): ActionResult {
    const s = latest.current;
    if (s.role !== "admin")
      return {
        ok: false,
        error:
          "Switch to the administrator preview to simulate a new incident.",
      };
    const parsed = reportSchema.safeParse(input);
    if (!parsed.success)
      return { ok: false, error: parsed.error.issues[0].message };
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const reference = `SERS-D${s.incidents.filter((i) => i.reference.startsWith("SERS-D")).length + 1}`;
    const incident: Incident = {
      ...parsed.data,
      id,
      reference,
      coordinates: null,
      responderId: null,
      status: "Pending",
      reportedAt: now,
      updatedAt: now,
      timeline: [
        {
          id: crypto.randomUUID(),
          at: now,
          actor: actorFor(s),
          title: "Simulated incident reported",
          detail:
            "Training record created in this browser. No emergency services contacted. Coordinates awaiting confirmation.",
          kind: "report",
        },
      ],
    };
    commit({
      ...s,
      incidents: [incident, ...s.incidents],
      notifications: [
        {
          id: crypto.randomUUID(),
          incidentId: id,
          title: `New training incident: ${reference}`,
          at: now,
          read: false,
        },
        ...s.notifications,
      ],
    });
    setToast("Training incident created");
    return { ok: true, incidentId: id };
  }

  function setAvailability(
    id: string,
    availability: Availability,
  ): ActionResult {
    const s = latest.current;
    if (s.role !== "admin" && s.role !== id)
      return { ok: false, error: "You can only change your own availability." };
    if (!s.responders.find((r) => r.id === id)?.active)
      return { ok: false, error: "This account is inactive." };
    if (
      availability !== "On duty" &&
      s.incidents.some((i) => i.responderId === id && isActive(i))
    )
      return {
        ok: false,
        error: "Complete active assignments before changing availability.",
      };
    commit({
      ...s,
      responders: s.responders.map((r) =>
        r.id === id ? { ...r, availability } : r,
      ),
    });
    setToast("Availability updated");
    return { ok: true };
  }

  function setActive(id: string, active: boolean): ActionResult {
    const s = latest.current;
    if (s.role !== "admin")
      return { ok: false, error: "Only an administrator can manage accounts." };
    if (!active && s.incidents.some((i) => i.responderId === id && isActive(i)))
      return {
        ok: false,
        error:
          "This responder has active assignments. Resolve or reassign them first.",
      };
    commit({
      ...s,
      responders: s.responders.map((r) => (r.id === id ? { ...r, active } : r)),
    });
    setToast(active ? "Demo account activated" : "Demo account deactivated");
    return { ok: true };
  }

  const isAdmin = state.role === "admin";
  return (
    <DemoContext.Provider
      value={{
        state,
        hydrated,
        storageError,
        isAdmin,
        actor: actorFor(state),
        toast,
        notify: setToast,
        visibleIncidents: state.incidents.filter((i) => canSee(i, state)),
        setRole: (role) => {
          commit({ ...latest.current, role });
          setToast("Role preview changed — this is not authentication");
        },
        assign,
        transition,
        addNote,
        simulate,
        setAvailability,
        setActive,
        updatePreferences: (value) =>
          commit({
            ...latest.current,
            preferences: { ...latest.current.preferences, ...value },
          }),
        readNotifications: () =>
          commit({
            ...latest.current,
            notifications: latest.current.notifications.map((n) => ({
              ...n,
              read: true,
            })),
          }),
        reset: () => {
          commit(createDemoState());
          setToast("Training data reset");
        },
      }}
    >
      {children}
    </DemoContext.Provider>
  );
}

export function useDemo() {
  const value = useContext(DemoContext);
  if (!value) throw new Error("useDemo must be used inside DemoProvider");
  return value;
}
