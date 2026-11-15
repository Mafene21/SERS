import type { Metadata } from "next";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import { AppFrame } from "@/components/app-frame";
import { backendConfigured, demoEnabled } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "SERS · Responder Dashboard", template: "%s · SERS" },
  description:
    "SERS staff dashboard for road accident and fire incident coordination.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <AppFrame demo={demoEnabled()} configured={backendConfigured()}>
          {children}
        </AppFrame>
      </body>
    </html>
  );
}
