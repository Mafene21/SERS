import type { Metadata } from "next";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import { DemoProvider } from "@/components/demo-provider";
import { Shell } from "@/components/shell";
import { LiveClock } from "@/components/live-clock";

export const metadata: Metadata = {
  title: { default: "SERS · Responder Dashboard", template: "%s · SERS" },
  description:
    "Road Accident and Fire Emergency Response Dashboard. Phase 1 university project with fictional training data.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <DemoProvider>
          <LiveClock>
            <Shell>{children}</Shell>
          </LiveClock>
        </DemoProvider>
      </body>
    </html>
  );
}
