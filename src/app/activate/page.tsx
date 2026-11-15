import { AuthForm } from "@/components/auth-form";
import { backendConfigured } from "@/lib/supabase/config";
export default function ActivatePage() {
  return <AuthForm mode="signup" configured={backendConfigured()} />;
}
