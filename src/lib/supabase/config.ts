export function backendConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

// Demonstration mode is an explicit local development option. Vercel always
// requires authentication, even if this variable was accidentally copied.
export function demoEnabled() {
  return process.env.SERS_DEMO_MODE === "true" && !process.env.VERCEL;
}
