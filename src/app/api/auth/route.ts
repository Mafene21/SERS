import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { checkRequest, json, requestOrigin } from "@/lib/server/http";

const email = z
  .email()
  .max(254)
  .transform((v) => v.trim().toLowerCase());
const password = z.string().min(12, "Use at least 12 characters.").max(128);
const input = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("login"),
    email,
    password: z.string().min(1).max(128),
  }),
  z.object({ action: z.literal("signup"), email, password }),
  z.object({ action: z.literal("reset"), email }),
  z.object({ action: z.literal("password"), password }),
  z.object({ action: z.literal("logout") }),
]);

export async function POST(request: Request) {
  const blocked = checkRequest(request, true);
  if (blocked) return blocked;
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return json({ error: parsed.error.issues[0].message }, 400);
  const value = parsed.data;
  const client = await createClient();
  const origin = requestOrigin(request);
  if (value.action === "login") {
    const { error } = await client.auth.signInWithPassword({
      email: value.email,
      password: value.password,
    });
    if (error)
      return json(
        {
          error:
            error.code === "email_not_confirmed"
              ? "Confirm your email using the link in your inbox before signing in."
              : "Sign-in failed. Check your email and password, then try again.",
        },
        error.status === 429 ? 429 : 400,
      );
    return json({ ok: true });
  }
  if (value.action === "signup") {
    const { error } = await client.auth.signUp({
      email: value.email,
      password: value.password,
      options: { emailRedirectTo: `${origin}/auth/callback` },
    });
    if (error)
      return json(
        {
          error:
            error.status === 429
              ? "Too many requests. Wait a few minutes before trying again."
              : "Unable to create the account. Contact your administrator if the problem continues.",
        },
        400,
      );
    return json({
      ok: true,
      message:
        "Check your email to confirm your account, then return here to sign in. Only administrator-approved accounts can enter the dashboard.",
    });
  }
  if (value.action === "reset") {
    const { error } = await client.auth.resetPasswordForEmail(value.email, {
      redirectTo: `${origin}/auth/callback?next=/recover`,
    });
    if (error)
      return json(
        {
          error:
            "Unable to send a reset link right now. Wait a few minutes and try again.",
        },
        400,
      );
    return json({
      ok: true,
      message:
        "If this email has an account, a password reset link has been sent. Check your inbox and spam folder.",
    });
  }
  if (value.action === "password") {
    const {
      data: { user },
      error,
    } = await client.auth.getUser();
    if (error || !user)
      return json(
        { error: "Open the password reset link from your email first." },
        401,
      );
    const result = await client.auth.updateUser({ password: value.password });
    if (result.error)
      return json(
        {
          error:
            "Unable to update your password. Request a fresh reset link and try again.",
        },
        400,
      );
    return json({ ok: true });
  }
  const { error } = await client.auth.signOut({ scope: "global" });
  if (error)
    return json(
      {
        error:
          "Unable to end your session. Check your connection and try again.",
      },
      503,
    );
  return json({ ok: true });
}
