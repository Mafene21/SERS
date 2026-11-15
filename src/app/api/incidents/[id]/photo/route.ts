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
    const { data: contact } = await auth.client
      .from("sers_citizen_contacts")
      .select("photo_path")
      .eq("incident_id", id.data)
      .maybeSingle();
    if (!contact?.photo_path) return json({ error: "Photo not found." }, 404);
    const { data, error } = await auth.client.storage
      .from("sers-citizen-photos")
      .download(contact.photo_path);
    if (error || !data)
      return json({ error: "Photo could not be loaded." }, 503);
    return new Response(data, {
      headers: {
        "Content-Type": data.type || "image/jpeg",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch {
    return json({ error: "Photo could not be loaded." }, 503);
  }
}
