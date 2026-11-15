import { z } from "zod";
import { authorize } from "@/lib/server/workspace";
import { checkRequest, json } from "@/lib/server/http";

const incidentId = z.uuid();
const photo = z.object({
  content_type: z.enum(["image/jpeg", "image/png", "image/webp"]),
  data_base64: z.string().min(4).max(4_194_304),
});

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const blocked = checkRequest(request);
  if (blocked) return blocked;
  const parsed = incidentId.safeParse((await context.params).id);
  if (!parsed.success) return json({ error: "Invalid incident." }, 400);

  try {
    const auth = await authorize();
    if (!auth.account) return json({ error: auth.error }, auth.status);
    const result = await auth.client.rpc("sers_public_reporter_photo", {
      p_incident_id: parsed.data,
    });
    if (result.error || !result.data)
      return json({ error: "Photo unavailable." }, 404);
    const source = photo.parse(result.data);
    const bytes = Buffer.from(source.data_base64, "base64");
    if (!bytes.length || bytes.length > 3 * 1024 * 1024)
      return json({ error: "Photo unavailable." }, 404);
    return new Response(bytes, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": source.content_type,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return json({ error: "Photo unavailable." }, 503);
  }
}
