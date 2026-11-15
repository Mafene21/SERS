import { AuthForm } from "@/components/auth-form";
import { backendConfigured } from "@/lib/supabase/config";
export default async function RecoveryPage({
  searchParams,
}: {
  searchParams: Promise<{ request?: string }>;
}) {
  const params = await searchParams;
  return (
    <AuthForm
      mode={params.request === "true" ? "reset" : "password"}
      configured={backendConfigured()}
    />
  );
}
