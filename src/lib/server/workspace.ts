import "server-only";
import { z } from "zod";
import {
  CATEGORIES,
  PRIORITIES,
  STATUSES,
  type Account,
  type WorkspaceSnapshot,
} from "@/lib/types";
import { createClient } from "@/lib/supabase/server";

const accountSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  name: z.string(),
  role: z.enum(["admin", "responder"]),
  category: z.enum(CATEGORIES).nullable(),
  callsign: z.string(),
  active: z.boolean(),
  enrolled: z.boolean(),
});
const snapshotSchema = z.object({
  incidents: z.array(
    z.object({
      id: z.uuid(),
      number: z.number(),
      category: z.enum(CATEGORIES),
      title: z.string(),
      description: z.string(),
      location: z.string(),
      latitude: z.number().nullable(),
      longitude: z.number().nullable(),
      priority: z.enum(PRIORITIES),
      status: z.enum(STATUSES),
      responder_id: z.uuid().nullable(),
      reported_at: z.string(),
      updated_at: z.string(),
    }),
  ),
  responders: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      callsign: z.string(),
      category: z.enum(CATEGORIES),
      availability: z.enum(["Available", "On duty", "Off duty"]),
      active: z.boolean(),
      enrolled: z.boolean(),
    }),
  ),
  timeline: z.array(
    z.object({
      id: z.uuid(),
      incident_id: z.uuid(),
      actor: z.string(),
      title: z.string(),
      detail: z.string().nullable(),
      kind: z.enum(["status", "assignment", "note", "report"]),
      at: z.string(),
    }),
  ),
  notifications: z.array(
    z.object({
      id: z.uuid(),
      incident_id: z.uuid(),
      title: z.string(),
      at: z.string(),
      read: z.boolean(),
    }),
  ),
  preferences: z
    .object({ dark: z.boolean(), notifications: z.boolean() })
    .nullable(),
});

export async function authorize() {
  const client = await createClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user)
    return {
      client,
      account: null,
      error: "Sign in to continue.",
      status: 401,
    };
  const result = await client.rpc("sers_claim_account");
  if (result.error)
    return {
      client,
      account: null,
      error:
        "Your account has not been approved or is inactive. Contact your administrator.",
      status: 403,
    };
  const account = accountSchema.parse(result.data) as Account;
  return { client, account, error: null, status: 200 };
}

export async function getSnapshot(
  client: Awaited<ReturnType<typeof createClient>>,
  account: Account,
): Promise<WorkspaceSnapshot> {
  const [snapshot, accounts] = await Promise.all([
    client.rpc("sers_snapshot"),
    client.rpc("sers_accounts"),
  ]);
  if (snapshot.error || accounts.error)
    throw new Error("Unable to load shared records. Please retry.");
  const data = snapshotSchema.parse(snapshot.data);
  return {
    account,
    accounts: z.array(accountSchema).parse(accounts.data),
    state: {
      version: 1,
      role: account.role === "admin" ? "admin" : account.id,
      preferences: {
        dark: data.preferences?.dark ?? false,
        notifications: data.preferences?.notifications ?? true,
        name: account.name,
      },
      responders: data.responders.map((r) => ({
        ...r,
        initials: r.name
          .split(/\s+/)
          .slice(0, 2)
          .map((n) => n[0])
          .join("")
          .toUpperCase(),
      })),
      incidents: data.incidents.map((i) => ({
        id: i.id,
        reference: `SERS-${String(i.number).padStart(5, "0")}`,
        category: i.category,
        title: i.title,
        description: i.description,
        location: i.location,
        coordinates:
          i.latitude === null || i.longitude === null
            ? null
            : [i.latitude, i.longitude],
        priority: i.priority,
        status: i.status,
        responderId: i.responder_id,
        reportedAt: i.reported_at,
        updatedAt: i.updated_at,
        timeline: data.timeline
          .filter((t) => t.incident_id === i.id)
          .map((t) => ({
            id: t.id,
            actor: t.actor,
            title: t.title,
            ...(t.detail ? { detail: t.detail } : {}),
            kind: t.kind,
            at: t.at,
          })),
      })),
      notifications: data.notifications.map((n) => ({
        id: n.id,
        incidentId: n.incident_id,
        title: n.title,
        at: n.at,
        read: n.read,
      })),
    },
  };
}
