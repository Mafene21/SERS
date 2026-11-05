export const CATEGORIES = ["Road Accident", "Fire Outbreak"] as const;
export const STATUSES = [
  "Pending",
  "Accepted",
  "Responding",
  "Resolved",
  "Cancelled",
] as const;
export const PRIORITIES = ["Critical", "High", "Medium", "Low"] as const;
export type Category = (typeof CATEGORIES)[number];
export type IncidentStatus = (typeof STATUSES)[number];
export type Priority = (typeof PRIORITIES)[number];
export type Availability = "Available" | "On duty" | "Off duty";
export type ViewRole = "admin" | "road-1" | "fire-1";

export interface TimelineEvent {
  id: string;
  at: string;
  actor: string;
  title: string;
  detail?: string;
  kind: "status" | "assignment" | "note" | "report";
}

export interface Incident {
  id: string;
  reference: string;
  category: Category;
  title: string;
  description: string;
  location: string;
  coordinates: [number, number] | null;
  priority: Priority;
  status: IncidentStatus;
  responderId: string | null;
  reportedAt: string;
  updatedAt: string;
  timeline: TimelineEvent[];
}

export interface Responder {
  id: string;
  name: string;
  initials: string;
  callsign: string;
  category: Category;
  availability: Availability;
  active: boolean;
}

export interface Notification {
  id: string;
  incidentId: string;
  title: string;
  at: string;
  read: boolean;
}

export interface Preferences {
  dark: boolean;
  name: string;
  notifications: boolean;
}

export interface DemoState {
  version: 1;
  incidents: Incident[];
  responders: Responder[];
  notifications: Notification[];
  role: ViewRole;
  preferences: Preferences;
}

export type ActionResult =
  { ok: true; incidentId?: string } | { ok: false; error: string };
