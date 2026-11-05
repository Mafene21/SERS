import type { Incident, IncidentStatus, Category } from "./types";

export const isActive = (incident: Incident) =>
  incident.status !== "Resolved" && incident.status !== "Cancelled";
export const teamName = (category: Category) =>
  category === "Road Accident" ? "Road Accident Response" : "Fire Response";
export const time = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Kampala",
  }).format(new Date(value));
export const date = (value: string, short = false) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    ...(short ? {} : { year: "numeric" }),
    timeZone: "Africa/Kampala",
  }).format(new Date(value));
export const nextStatus = (
  status: IncidentStatus,
): IncidentStatus | undefined =>
  (
    ({
      Pending: "Accepted",
      Accepted: "Responding",
      Responding: "Resolved",
    }) as Partial<Record<IncidentStatus, IncidentStatus>>
  )[status];
export const validCoordinates = (
  coords: Incident["coordinates"],
): coords is [number, number] =>
  !!coords &&
  Number.isFinite(coords[0]) &&
  Number.isFinite(coords[1]) &&
  Math.abs(coords[0]) <= 90 &&
  Math.abs(coords[1]) <= 180;

// Decorative sparklines still use actual training-record counts grouped by report day.
export function sparkPoints(records: Incident[], all: Incident[]) {
  const latest = all.length
    ? Math.max(...all.map((i) => new Date(i.reportedAt).getTime()))
    : 0;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Africa/Kampala",
  });
  const counts = Array.from({ length: 7 }, (_, index) => {
    const day = formatter.format(new Date(latest - (6 - index) * 86_400_000));
    return records.filter(
      (i) => formatter.format(new Date(i.reportedAt)) === day,
    ).length;
  });
  const max = Math.max(1, ...counts);
  return counts
    .map((count, index) => `${index * 14},${29 - (count / max) * 25}`)
    .join(" ");
}

export function exportCSV(incidents: Incident[]) {
  const quote = (value: string) =>
    `"${(/^[=+\-@\t\r]/.test(value) ? "'" : "") + value.replaceAll('"', '""')}"`;
  const rows = [
    ["SIMULATED DATA — SERS training report"],
    [
      "Reference",
      "Category",
      "Title",
      "Location",
      "Priority",
      "Status",
      "Reported at (UTC)",
    ],
    ...incidents.map((i) => [
      i.reference,
      i.category,
      i.title,
      i.location,
      i.priority,
      i.status,
      i.reportedAt,
    ]),
  ];
  const blob = new Blob(
    ["\uFEFF" + rows.map((row) => row.map(quote).join(",")).join("\r\n")],
    { type: "text/csv;charset=utf-8;" },
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "sers-training-incidents.csv";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
