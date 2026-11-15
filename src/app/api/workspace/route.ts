import { authorize, getSnapshot } from "@/lib/server/workspace";
import { checkRequest, json } from "@/lib/server/http";
import { z } from "zod";
import { CATEGORIES, STATUSES } from "@/lib/types";
import { noteSchema, reportSchema } from "@/lib/schemas";

const id = z.uuid();
const input = z.discriminatedUnion("command", [
  z.object({
    command: z.literal("assign"),
    payload: z.object({ id, responderId: id }),
  }),
  z.object({
    command: z.literal("transition"),
    payload: z.object({
      id,
      status: z.enum(STATUSES),
      reason: z.string().trim().max(500).optional(),
    }),
  }),
  z.object({ command: z.literal("note"), payload: noteSchema.extend({ id }) }),
  z.object({
    command: z.literal("report"),
    payload: reportSchema.extend({ id }),
  }),
  z.object({
    command: z.literal("availability"),
    payload: z.object({
      id,
      availability: z.enum(["Available", "On duty", "Off duty"]),
    }),
  }),
  z.object({
    command: z.literal("active"),
    payload: z.object({ id, active: z.boolean() }),
  }),
  z.object({
    command: z.literal("preferences"),
    payload: z.object({
      dark: z.boolean().optional(),
      notifications: z.boolean().optional(),
    }),
  }),
  z.object({ command: z.literal("read_notifications"), payload: z.object({}) }),
  z.object({
    command: z.literal("approve_account"),
    payload: z
      .object({
        email: z.email().max(254),
        name: z.string().trim().min(2).max(60),
        role: z.enum(["admin", "responder"]),
        category: z.enum(CATEGORIES).nullable(),
        callsign: z.string().trim().max(30),
      })
      .refine(
        (p) => p.role === "admin" || p.category !== null,
        "Choose the responder's team.",
      ),
  }),
]);

export async function GET(request: Request) {
  const blocked = checkRequest(request);
  if (blocked) return blocked;
  try {
    const auth = await authorize();
    if (!auth.account) return json({ error: auth.error }, auth.status);
    return json(await getSnapshot(auth.client, auth.account));
  } catch {
    return json(
      {
        error:
          "Shared records could not be loaded. Check your connection and retry.",
      },
      503,
    );
  }
}

export async function POST(request: Request) {
  const blocked = checkRequest(request, true);
  if (blocked) return blocked;
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return json({ error: parsed.error.issues[0].message }, 400);
  try {
    const auth = await authorize();
    if (!auth.account) return json({ error: auth.error }, auth.status);
    const { command, payload } = parsed.data;
    const result = await auth.client.rpc("sers_mutate", { command, payload });
    if (result.error) {
      const safe =
        result.error.code === "42501" || result.error.code === "P0001";
      return json(
        {
          error: safe
            ? result.error.message
            : "The change could not be saved. Refresh and try again.",
        },
        result.error.code === "42501" ? 403 : 409,
      );
    }
    return json(result.data);
  } catch {
    return json(
      {
        error:
          "The connection was interrupted. Refresh to check whether the change was saved.",
      },
      503,
    );
  }
}
