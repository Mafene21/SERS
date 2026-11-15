import { z } from "zod";
import { authorize } from "@/lib/server/workspace";
import { checkRequest, json, requestOrigin } from "@/lib/server/http";

export async function POST(request: Request) {
  const blocked = checkRequest(request, true);
  if (blocked) return blocked;
  const input = z
    .object({ accountId: z.uuid() })
    .safeParse(await request.json().catch(() => null));
  if (!input.success) return json({ error: "Choose a staff account." }, 400);
  try {
    const auth = await authorize();
    if (!auth.account) return json({ error: auth.error }, auth.status);
    if (auth.account.role !== "admin")
      return json({ error: "Administrator access required." }, 403);
    // getUser above validates identity. getSession is used only to forward the
    // already-validated token to the function, never to decide authorization.
    const {
      data: { session },
    } = await auth.client.auth.getSession();
    if (!session) return json({ error: "Sign in first." }, 401);
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/sers-account-link`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        },
        body: JSON.stringify(input.data),
        cache: "no-store",
      },
    );
    const data = await response.json();
    if (!response.ok)
      return json(
        { error: data.error ?? "Unable to create the account link." },
        response.status,
      );
    if (
      typeof data.tokenHash !== "string" ||
      !["invite", "recovery"].includes(data.type)
    )
      throw new Error("Invalid account link response");
    const link = new URL("/auth/confirm", requestOrigin(request));
    link.searchParams.set("token_hash", data.tokenHash);
    link.searchParams.set("type", data.type);
    return json({ link: link.href });
  } catch {
    return json(
      { error: "Unable to create the account link. Try again later." },
      503,
    );
  }
}
