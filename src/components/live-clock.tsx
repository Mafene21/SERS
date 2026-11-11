"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { Clock3 } from "lucide-react";
import { date, elapsedTime, time } from "@/lib/utils";

const ClockContext = createContext(0);

// All incident ages share one timer, including after a backgrounded tab resumes.
export function LiveClock({ children }: { children: React.ReactNode }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const timer = setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  return <ClockContext.Provider value={now}>{children}</ClockContext.Provider>;
}

export const useNow = () => useContext(ClockContext);

export function WaitingBadge({ reportedAt }: { reportedAt: string }) {
  const now = useNow();
  const minutes = Math.max(
    0,
    Math.floor((now - Date.parse(reportedAt)) / 60_000),
  );
  return (
    <span
      className={`waiting-badge ${minutes >= 30 ? "waiting-long" : ""}`}
      title={`Waiting since ${date(reportedAt)} at ${time(reportedAt)} EAT`}
      aria-label={`Waiting ${elapsedTime(reportedAt, now)}`}
    >
      <Clock3 size={12} />
      {elapsedTime(reportedAt, now)}
    </span>
  );
}
