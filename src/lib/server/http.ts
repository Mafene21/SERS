import "server-only";
import { NextResponse } from "next/server";
import { backendConfigured } from "@/lib/supabase/config";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export function checkRequest(request: Request, mutation = false) {
  if (!backendConfigured())
    return json(
      {
        error:
          "SERS is waiting for its database connection. Contact the administrator.",
      },
      503,
    );
  if (mutation && !sameOrigin(request))
    return json(
      { error: "This request must come from the SERS website." },
      403,
    );
  if (mutation && Number(request.headers.get("content-length")) > 12_000)
    return json({ error: "Request is too large." }, 413);
  return null;
}

function sameOrigin(request: Request) {
  try {
    const origin = new URL(request.headers.get("origin") ?? "");
    return (
      ["http:", "https:"].includes(origin.protocol) &&
      origin.host === request.headers.get("host") &&
      (!process.env.VERCEL || origin.protocol === "https:")
    );
  } catch {
    return false;
  }
}

export function requestOrigin(request: Request) {
  const url = new URL(request.url);
  const host = request.headers.get("host") ?? url.host;
  return `${process.env.VERCEL ? "https:" : url.protocol}//${host}`;
}
