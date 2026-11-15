import { z } from "zod";
import { authorize } from "@/lib/server/workspace";
import { checkRequest, json } from "@/lib/server/http";

const incidentId = z.uuid();
const reporter = z.object({
  name: z.string().min(2).max(60),
  phone: z.string().min(7).max(25),
  photo_path: z.string().nullable(),
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
    const result = await auth.client.rpc("sers_public_reporter_details", {
      p_incident_id: parsed.data,
    });
    if (result.error)
      return json({ error: "Reporter details are unavailable." }, 404);
    if (!result.data) return json({ reporter: null });
    const details = reporter.parse(result.data);
    return json({
      reporter: {
        name: details.name,
        phone: details.phone,
        hasPhoto: Boolean(details.photo_path),
      },
    });
  } catch {
    return json({ error: "Reporter details are unavailable." }, 503);
  }
}
