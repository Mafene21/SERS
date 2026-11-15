import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { backendConfigured } from "@/lib/supabase/config";
import { requestOrigin } from "@/lib/server/http";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const hash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  let next = "/login?error=expired";
  if (
    backendConfigured() &&
    hash &&
    hash.length < 512 &&
    (type === "invite" || type === "recovery")
  ) {
    const client = await createClient();
    const { error } = await client.auth.verifyOtp({ token_hash: hash, type });
    if (!error) next = "/recover";
  }
  const response = NextResponse.redirect(new URL(next, requestOrigin(request)));
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
