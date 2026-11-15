"use client";
import { usePathname } from "next/navigation";
import { AuthForm } from "./auth-form";
import { DemoProvider } from "./demo-provider";
import { LiveProvider } from "./live-provider";
import { LiveClock } from "./live-clock";
import { Shell } from "./shell";

export function AppFrame({
  children,
  demo,
  configured,
}: {
  children: React.ReactNode;
  demo: boolean;
  configured: boolean;
}) {
  const path = usePathname();
  if (
    ["/login", "/activate", "/recover"].includes(path) ||
    path.startsWith("/auth/")
  )
    return children;
  if (!demo && !configured) return <AuthForm configured={false} />;
  const content = (
    <LiveClock>
      <Shell>{children}</Shell>
    </LiveClock>
  );
  return demo ? (
    <DemoProvider>{content}</DemoProvider>
  ) : (
    <LiveProvider>{content}</LiveProvider>
  );
}
