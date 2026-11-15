import { createClient } from "npm:@supabase/supabase-js@2.119.0";
import { z } from "npm:zod@4.6.7";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "content-type, authorization, apikey, x-report-id, x-access-key",
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
};
const reply = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: cors });
const hex = z.string().regex(/^[0-9a-f]{64}$/);
const tracking = z.object({ id: z.uuid(), accessKey: hex });
const report = z.object({
  id: z.uuid(),
  category: z.enum(["Road Accident", "Fire Outbreak"]),
  title: z.string().trim().min(5).max(100),
  description: z.string().trim().min(10).max(2000),
  location: z.string().trim().min(3).max(150),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  name: z.string().trim().max(60).default(""),
  phone: z
    .string()
    .trim()
    .max(30)
    .regex(/^[+\d ()-]*$/)
    .default(""),
});
const input = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("submit"),
    accessKey: hex,
    deviceKey: hex,
    report,
  }),
  tracking.extend({ action: z.literal("track") }),
]);
const hash = async (s: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
async function boundedBody(req: Request, limit: number) {
  const reader = req.body?.getReader();
  if (!reader) throw Error("empty");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) {
        await reader.cancel();
        throw Error("large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let position = 0;
  for (const c of chunks) {
    bytes.set(c, position);
    position += c.length;
  }
  return bytes;
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return reply({ error: "Use POST." }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    const key = keys.default ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    // Hash network identifiers with a server-only key; retain no raw IP addresses.
    const network = (
      req.headers.get("x-forwarded-for") ??
      req.headers.get("x-real-ip") ??
      "unknown"
    )
      .split(",")[0]
      .trim();
    const ipHash = await hash(`${key}:sers-rate:${network}`);
    const rate = await admin.rpc("sers_guest_throttle", { ip_hash: ipHash });
    if (rate.error)
      return reply(
        { error: "Reporting is temporarily unavailable. Please retry." },
        503,
      );
    if (!rate.data)
      return reply(
        { error: "Too many requests. Wait a minute and try again." },
        429,
      );
    const action = new URL(req.url).searchParams.get("action");
    if (action === "photo") {
      const parsed = tracking.safeParse({
        id: req.headers.get("x-report-id"),
        accessKey: req.headers.get("x-access-key"),
      });
      if (!parsed.success)
        return reply({ error: "Invalid tracking credentials." }, 400);
      const accessHash = await hash(parsed.data.accessKey);
      const owner = await admin.rpc("sers_guest_status", {
        report_id: parsed.data.id,
        access_hash: accessHash,
      });
      if (owner.error) return reply({ error: "Report not found." }, 404);
      const bytes = await boundedBody(req, 3145728);
      const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
      const png = [137, 80, 78, 71, 13, 10, 26, 10].every(
        (b, i) => bytes[i] === b,
      );
      const webp =
        new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
        new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
      if (!jpeg && !png && !webp)
        return reply(
          { error: "Choose a JPEG, PNG or WebP photo under 3 MB." },
          400,
        );
      const path = `${parsed.data.id}/scene`;
      const uploaded = await admin.storage
        .from("sers-citizen-photos")
        .upload(path, bytes, {
          contentType: jpeg ? "image/jpeg" : png ? "image/png" : "image/webp",
          upsert: true,
        });
      if (uploaded.error)
        return reply(
          {
            error:
              "The report was received, but its photo could not be saved. Retry the photo.",
          },
          503,
        );
      const saved = await admin.rpc("sers_guest_photo", {
        report_id: parsed.data.id,
        access_hash: accessHash,
        photo_path: path,
      });
      if (saved.error)
        return reply(
          { error: "Photo could not be attached. Retry the photo." },
          503,
        );
      return reply({ ok: true });
    }
    const bytes = await boundedBody(req, 14000);
    let raw;
    try {
      raw = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      return reply({ error: "Enter valid report details." }, 400);
    }
    const parsed = input.safeParse(raw);
    if (!parsed.success)
      return reply({ error: parsed.error.issues[0].message }, 400);
    const p = parsed.data;
    const accessHash = await hash(p.accessKey);
    const result =
      p.action === "submit"
        ? await admin.rpc("sers_guest_submit", {
            payload: p.report,
            access_hash: accessHash,
            device_hash: await hash(p.deviceKey),
            ip_hash: ipHash,
          })
        : await admin.rpc("sers_guest_status", {
            report_id: p.id,
            access_hash: accessHash,
          });
    if (result.error) {
      if (result.error.code === "42501")
        return reply(
          { error: "Report not found. Check your private tracking code." },
          404,
        );
      if (result.error.code === "P0001")
        return reply(
          {
            error:
              "Please check the report details. If you recently sent several reports, wait before retrying.",
          },
          429,
        );
      return reply(
        { error: "Unable to save or load the report. Please retry." },
        503,
      );
    }
    return reply({ report: result.data });
  } catch (error) {
    return reply(
      {
        error:
          error instanceof Error && error.message === "large"
            ? "Photo or report is too large."
            : "Unable to connect to reporting. Please retry.",
      },
      400,
    );
  }
});
