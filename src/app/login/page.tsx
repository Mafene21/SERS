import { AuthForm } from "@/components/auth-form";
import { backendConfigured } from "@/lib/supabase/config";
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  return (
    <AuthForm
      configured={backendConfigured()}
      initialError={
        params.error
          ? "This link has expired, was already used, or was opened in a different browser. Request a new link from your administrator or open the original email in the browser that requested it."
          : ""
      }
    />
  );
}
