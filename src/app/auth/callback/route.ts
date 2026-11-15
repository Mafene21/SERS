import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { backendConfigured } from "@/lib/supabase/config";
import { requestOrigin } from "@/lib/server/http";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = requestOrigin(request);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") === "/recover" ? "/recover" : "/";
  if (backendConfigured() && code) {
    const client = await createClient();
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) {
      const response = NextResponse.redirect(new URL(next, origin));
      response.headers.set("Cache-Control", "private, no-store");
      response.headers.set("Referrer-Policy", "no-referrer");
      return response;
    }
  }
  return NextResponse.redirect(new URL("/login?error=expired", origin));
}
