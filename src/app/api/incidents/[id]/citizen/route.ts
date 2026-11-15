import { z } from "zod";
import { authorize } from "@/lib/server/workspace";
import { checkRequest, json } from "@/lib/server/http";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const blocked = checkRequest(request);
  if (blocked) return blocked;
  const id = z.uuid().safeParse((await context.params).id);
  if (!id.success) return json({ error: "Invalid incident." }, 400);
  try {
    const auth = await authorize();
    if (!auth.account) return json({ error: auth.error }, auth.status);
    const { data, error } = await auth.client
      .from("sers_citizen_contacts")
      .select("name,phone,photo_path")
      .eq("incident_id", id.data)
      .maybeSingle();
    if (error) return json({ error: "Unable to load reporter details." }, 503);
    return json({
      contact: data
        ? { name: data.name, phone: data.phone, hasPhoto: !!data.photo_path }
        : null,
    });
  } catch {
    return json({ error: "Unable to load reporter details." }, 503);
  }
}
