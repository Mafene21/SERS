import { createClient } from "npm:@supabase/supabase-js@2.119.0";

const respond = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });

// The gateway JWT switch is off because this function performs its own live
// authentication and database membership check, including revoked sessions.
Deno.serve(async (request: Request) => {
  if (request.method !== "POST")
    return respond({ error: "Method not allowed." }, 405);
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer "))
    return respond({ error: "Sign in first." }, 401);
  const url = Deno.env.get("SUPABASE_URL")!;
  const publicKeys = JSON.parse(
    Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}",
  );
  const client = createClient(
    url,
    publicKeys.default ?? Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser(authorization.slice(7));
  if (authError || !user) return respond({ error: "Sign in first." }, 401);
  const membership = await client.rpc("sers_claim_account");
  if (membership.error || membership.data?.role !== "admin")
    return respond({ error: "Administrator access required." }, 403);
  const body = await request.json().catch(() => null);
  if (!body || typeof body.accountId !== "string")
    return respond({ error: "Choose an approved account." }, 400);
  const list = await client.rpc("sers_accounts");
  const account = list.data?.find(
    (a: { id: string }) => a.id === body.accountId,
  );
  if (list.error || !account?.active)
    return respond({ error: "Choose an active, approved account." }, 403);
  const audit = await client.rpc("sers_authorize_account_link", {
    account_id: account.id,
  });
  if (audit.error)
    return respond(
      { error: "The account link could not be authorized. Try again later." },
      429,
    );
  const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
  const admin = createClient(
    url,
    keys.default ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  let type: "invite" | "recovery" = account.enrolled ? "recovery" : "invite";
  let result = await admin.auth.admin.generateLink({
    type,
    email: account.email,
  });
  if (
    result.error?.code === "email_exists" ||
    result.error?.code === "user_already_exists"
  ) {
    type = "recovery";
    result = await admin.auth.admin.generateLink({
      type,
      email: account.email,
    });
  }
  if (result.error || !result.data.properties?.hashed_token)
    return respond(
      { error: "The account link could not be created. Try again later." },
      503,
    );
  return respond({ tokenHash: result.data.properties.hashed_token, type });
});
