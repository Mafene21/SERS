"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  Clock3,
  FileText,
  FlaskConical,
  LockKeyhole,
  MapPin,
  Moon,
  Printer,
  Radio,
  RotateCcw,
  Search,
  ShieldCheck,
  Sun,
  Users,
} from "lucide-react";
import { useDemo } from "./demo-provider";
import { IncidentTable } from "./incident-table";
import {
  CategoryIcon,
  EmptyState,
  Modal,
  PageHeader,
  PriorityBadge,
  StatusBadge,
} from "./ui";
import { SimulateButton } from "./report-dialog";
import { MapPanel } from "./map-panel";
import {
  CATEGORIES,
  PRIORITIES,
  STATUSES,
  type Availability,
} from "@/lib/types";
import { date, exportCSV, isActive, teamName } from "@/lib/utils";
import { TrendsChart } from "./charts";
import { ResponderHome } from "./responder-home";

export function IncidentsPage() {
  const { visibleIncidents } = useDemo();
  const params = useSearchParams();
  const [tab, setTab] = useState(
    params.get("priority") === "urgent" ? "urgent" : "all",
  );
  const tabs = [
    { id: "all", label: "All incidents", count: visibleIncidents.length },
    {
      id: "active",
      label: "Active",
      count: visibleIncidents.filter(isActive).length,
    },
    {
      id: "pending",
      label: "Pending",
      count: visibleIncidents.filter((i) => i.status === "Pending").length,
    },
    {
      id: "urgent",
      label: "High priority",
      count: visibleIncidents.filter(
        (i) => isActive(i) && ["Critical", "High"].includes(i.priority),
      ).length,
    },
  ];
  const incidents = visibleIncidents.filter(
    (i) =>
      tab === "all" ||
      (tab === "active" && isActive(i)) ||
      (tab === "pending" && i.status === "Pending") ||
      (tab === "urgent" &&
        isActive(i) &&
        ["Critical", "High"].includes(i.priority)),
  );
  return (
    <>
      <PageHeader
        eyebrow="INCIDENT COORDINATION"
        title="Incident management"
        description="Every report, every response, and every update in one place."
      >
        <SimulateButton />
      </PageHeader>
      <section className="panel">
        <div className="tabs" aria-label="Incident views">
          {tabs.map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? "active" : ""}
              onClick={() => setTab(t.id)}
              aria-pressed={tab === t.id}
            >
              {t.label}
              <span>{t.count}</span>
            </button>
          ))}
        </div>
        <IncidentTable
          key={params.get("q") ?? "all"}
          incidents={incidents}
          initialSearch={params.get("q") ?? ""}
        />
      </section>
      <p className="page-footnote">
        <FlaskConical size={14} />
        All incident records are simulated. Role previews apply to this browser
        only.
      </p>
    </>
  );
}

export function MapPage() {
  const { visibleIncidents, isAdmin, state } = useDemo();
  const [scope, setScope] = useState("mine");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("active");
  const [priority, setPriority] = useState("");
  const incidents = visibleIncidents.filter(
    (i) =>
      (isAdmin || scope === "team" || i.responderId === state.role) &&
      (!category || i.category === category) &&
      (!priority || i.priority === priority) &&
      (!status || (status === "active" ? isActive(i) : i.status === status)),
  );
  return (
    <>
      <PageHeader
        eyebrow="LOCATION & SITUATIONAL AWARENESS"
        title="Emergency map"
        description="Locate incidents, understand priorities, and coordinate your response."
      />
      <section className="panel map-page-panel">
        <div className="map-toolbar">
          {!isAdmin && (
            <label>
              Show
              <select
                aria-label="Map scope"
                value={scope}
                onChange={(e) => setScope(e.target.value)}
              >
                <option value="mine">My assignments</option>
                <option value="team">My team</option>
              </select>
            </label>
          )}
          <label>
            Category
            <select
              aria-label="Map category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select
              aria-label="Map status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="active">Active incidents</option>
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Priority
            <select
              aria-label="Map priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <option value="">All priorities</option>
              {PRIORITIES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <span className="map-filter-count">
            {incidents.length} matching incidents
          </span>
        </div>
        <div className="full-map-layout">
          <div className="full-map">
            <MapPanel incidents={incidents} />
          </div>
          <div className="map-incident-list">
            <div className="map-list-heading">
              <h2>Incident locations</h2>
              <span className="count-label">{incidents.length}</span>
            </div>
            {incidents.length ? (
              incidents.map((i) => (
                <Link
                  key={i.id}
                  href={`/incidents/${i.id}`}
                  className="map-incident-card"
                >
                  <div>
                    <span
                      className={`category-icon ${i.category === "Fire Outbreak" ? "fire" : "road"}`}
                    >
                      <CategoryIcon category={i.category} />
                    </span>
                    <span className="incident-reference">{i.reference}</span>
                    <PriorityBadge priority={i.priority} />
                  </div>
                  <strong>{i.title}</strong>
                  <p>
                    <MapPin size={12} />
                    {i.location}
                  </p>
                  <div>
                    <StatusBadge status={i.status} />
                    {!i.coordinates && <small>Coordinates needed</small>}
                    <ArrowRight size={14} />
                  </div>
                </Link>
              ))
            ) : (
              <EmptyState
                title="No matching incidents"
                description="Adjust the map filters to show more reports."
              />
            )}
          </div>
        </div>
      </section>
      <p className="page-footnote">
        <FlaskConical size={14} />
        Fictional incident positions on an OpenStreetMap basemap. Shared
        real-time updates arrive in a later phase.
      </p>
    </>
  );
}

export function AssignmentsPage() {
  const { isAdmin, state } = useDemo();
  return isAdmin ? <AssignedResponses /> : <ResponderHome key={state.role} />;
}

function AssignedResponses() {
  const { state, visibleIncidents, isAdmin, transition, notify } = useDemo();
  const [tab, setTab] = useState("active");
  const assigned = visibleIncidents.filter((i) =>
    isAdmin ? !!i.responderId : i.responderId === state.role,
  );
  const incidents = assigned.filter((i) =>
    tab === "active" ? isActive(i) : !isActive(i),
  );
  return (
    <>
      <PageHeader
        eyebrow="YOUR RESPONSE WORKSPACE"
        title={isAdmin ? "Assigned responses" : "My assignments"}
        description={
          isAdmin
            ? "Monitor assigned incidents across both operational teams."
            : "Your assigned incidents, next actions, and response progress."
        }
      />
      <div className="assignment-summary">
        <div>
          <span className="stat-icon blue">
            <Radio size={20} />
          </span>
          <strong>{assigned.filter(isActive).length}</strong>
          <span>Active assignments</span>
        </div>
        <div>
          <span className="stat-icon red">
            <Clock3 size={20} />
          </span>
          <strong>
            {assigned.filter((i) => i.status === "Pending").length}
          </strong>
          <span>Awaiting acceptance</span>
        </div>
        <div>
          <span className="stat-icon green">
            <ShieldCheck size={20} />
          </span>
          <strong>
            {assigned.filter((i) => i.status === "Resolved").length}
          </strong>
          <span>Resolved</span>
        </div>
      </div>
      <div className="tabs standalone">
        <button
          className={tab === "active" ? "active" : ""}
          onClick={() => setTab("active")}
        >
          Active assignments
        </button>
        <button
          className={tab === "closed" ? "active" : ""}
          onClick={() => setTab("closed")}
        >
          Response history
        </button>
      </div>
      {incidents.length ? (
        <div className="assignment-grid">
          {incidents.map((i) => {
            const responder = state.responders.find(
              (r) => r.id === i.responderId,
            );
            return (
              <article className="panel assignment-card" key={i.id}>
                <div className="assignment-card-top">
                  <span
                    className={`category-icon ${i.category === "Fire Outbreak" ? "fire" : "road"}`}
                  >
                    <CategoryIcon category={i.category} size={21} />
                  </span>
                  <PriorityBadge priority={i.priority} />
                  <StatusBadge status={i.status} />
                </div>
                <span className="eyebrow">{i.reference}</span>
                <h2>
                  <Link href={`/incidents/${i.id}`}>{i.title}</Link>
                </h2>
                <p>
                  <MapPin size={14} />
                  {i.location}
                </p>
                <div className="assignment-person">
                  <span className="avatar small blue">
                    {responder?.initials}
                  </span>
                  <span>
                    {responder?.name}
                    <small>{teamName(i.category)}</small>
                  </span>
                </div>
                <div className="assignment-card-footer">
                  <Link href={`/incidents/${i.id}`} className="button">
                    View details <ArrowRight size={15} />
                  </Link>
                  {i.status === "Pending" && (
                    <button
                      className="button primary"
                      onClick={() => {
                        const result = transition(i.id, "Accepted");
                        if (!result.ok) notify(result.error);
                      }}
                    >
                      Accept incident
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <section className="panel">
          <EmptyState
            title={
              tab === "active" ? "No active assignments" : "No response history"
            }
            description={
              isAdmin
                ? "Assign a pending incident to a responder to begin."
                : "Your assigned incidents will appear here when a coordinator assigns them."
            }
          >
            <Link href="/incidents" className="button">
              Browse team incidents <ArrowRight size={15} />
            </Link>
          </EmptyState>
        </section>
      )}
    </>
  );
}

export function RespondersPage() {
  const { state, visibleIncidents, isAdmin, setActive, setAvailability } =
    useDemo();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [profile, setProfile] = useState<string | null>(null);
  const [profileMessage, setProfileMessage] = useState<{
    error: boolean;
    message: string;
  } | null>(null);
  const responders = state.responders.filter(
    (r) =>
      (isAdmin ||
        r.category ===
          state.responders.find((p) => p.id === state.role)?.category) &&
      (!category || r.category === category) &&
      `${r.name} ${r.callsign}`.toLowerCase().includes(query.toLowerCase()),
  );
  const selected = state.responders.find((r) => r.id === profile);
  return (
    <>
      <PageHeader
        eyebrow="PEOPLE & READINESS"
        title="Response teams"
        description="Know who is available, who is responding, and how your teams are doing."
      />
      <div className="team-intro-grid">
        {CATEGORIES.filter(
          (c) =>
            isAdmin ||
            c === state.responders.find((r) => r.id === state.role)?.category,
        ).map((c) => {
          const team = state.responders.filter((r) => r.category === c);
          const available = team.filter(
            (r) =>
              r.active &&
              r.availability !== "Off duty" &&
              !state.incidents.some(
                (i) => i.responderId === r.id && isActive(i),
              ),
          ).length;
          return (
            <section className="panel team-intro" key={c}>
              <span
                className={`category-icon ${c === "Fire Outbreak" ? "fire" : "road"}`}
              >
                <CategoryIcon category={c} size={25} />
              </span>
              <div>
                <h2>{teamName(c)} Team</h2>
                <p>
                  {team.length} responders <span>·</span>{" "}
                  <span className="green-text">{available} available</span>
                </p>
              </div>
              <Users size={20} />
            </section>
          );
        })}
      </div>
      <section className="panel">
        <div className="table-toolbar">
          <div className="table-search">
            <Search size={17} />
            <input
              aria-label="Search responders"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or call sign…"
            />
          </div>
          <select
            aria-label="Filter responder team"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">All authorized teams</option>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="responder-grid">
          {responders.map((r) => {
            const assignments = visibleIncidents.filter(
              (i) => i.responderId === r.id && isActive(i),
            );
            const availability = assignments.length
              ? "Assigned"
              : r.availability === "Off duty"
                ? "Off duty"
                : "Available";
            return (
              <article
                className={`responder-card ${!r.active ? "inactive" : ""}`}
                key={r.id}
              >
                <div className="responder-card-top">
                  <span
                    className={`avatar large ${r.category === "Fire Outbreak" ? "amber" : "blue"}`}
                  >
                    {r.initials}
                  </span>
                  <span
                    className={`badge availability-${!r.active ? "inactive" : availability.toLowerCase().replace(" ", "-")}`}
                  >
                    <span className="status-dot" />
                    {r.active ? availability : "Inactive"}
                  </span>
                </div>
                <h3>{r.name}</h3>
                <span className="callsign">{r.callsign}</span>
                <p>
                  <CategoryIcon category={r.category} size={14} />
                  {teamName(r.category)}
                </p>
                <div className="responder-metrics">
                  <div>
                    <strong>{assignments.length}</strong>
                    <span>Active</span>
                  </div>
                  <div>
                    <strong>
                      {
                        visibleIncidents.filter(
                          (i) =>
                            i.responderId === r.id && i.status === "Resolved",
                        ).length
                      }
                    </strong>
                    <span>Resolved</span>
                  </div>
                </div>
                <button
                  className="button full-width"
                  onClick={() => {
                    setProfileMessage(null);
                    setProfile(r.id);
                  }}
                >
                  View profile <ArrowRight size={14} />
                </button>
              </article>
            );
          })}
        </div>
        {responders.length === 0 && (
          <EmptyState
            title="No responders found"
            description="Try another name or team."
          />
        )}
      </section>
      {!isAdmin && (
        <p className="page-footnote">
          <LockKeyhole size={14} />
          Administrators manage accounts and team assignments.
        </p>
      )}
      {selected && (
        <Modal
          title={selected.name}
          description={`${selected.callsign} · ${teamName(selected.category)} Team`}
          onClose={() => setProfile(null)}
        >
          <div className="profile-detail">
            <span
              className={`avatar large ${selected.category === "Fire Outbreak" ? "amber" : "blue"}`}
            >
              {selected.initials}
            </span>
            <div>
              <strong>
                {selected.active
                  ? "Active training account"
                  : "Inactive training account"}
              </strong>
              <p>Fictional responder profile</p>
            </div>
          </div>
          <h3 className="section-subheading">Active assignments</h3>
          {visibleIncidents
            .filter((i) => i.responderId === selected.id && isActive(i))
            .map((i) => (
              <Link
                href={`/incidents/${i.id}`}
                key={i.id}
                onClick={() => setProfile(null)}
                className="profile-assignment"
              >
                <span>
                  {i.reference} · {i.title}
                </span>
                <StatusBadge status={i.status} />
              </Link>
            ))}
          {!visibleIncidents.some(
            (i) => i.responderId === selected.id && isActive(i),
          ) && <p className="small-note">No active assignments.</p>}
          {(isAdmin || state.role === selected.id) && (
            <div className="form-label">
              <label htmlFor="responder-availability">Availability</label>
              <select
                id="responder-availability"
                value={selected.availability}
                onChange={(e) => {
                  const result = setAvailability(
                    selected.id,
                    e.target.value as Availability,
                  );
                  setProfileMessage({
                    error: !result.ok,
                    message: result.ok ? "Availability updated." : result.error,
                  });
                }}
              >
                {["Available", "On duty", "Off duty"].map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </div>
          )}
          <h3 className="section-subheading">Recent response history</h3>
          {visibleIncidents
            .filter((i) => i.responderId === selected.id && !isActive(i))
            .slice(0, 4)
            .map((i) => (
              <Link
                className="profile-assignment"
                href={`/incidents/${i.id}`}
                key={i.id}
                onClick={() => setProfile(null)}
              >
                <span>
                  {i.reference} · {date(i.reportedAt, true)}
                </span>
                <StatusBadge status={i.status} />
              </Link>
            ))}
          {profileMessage && (
            <p
              className={profileMessage.error ? "field-error" : "small-note"}
              role={profileMessage.error ? "alert" : "status"}
            >
              {profileMessage.message}
            </p>
          )}
          {isAdmin && (
            <div className="modal-actions">
              <button
                className={`button ${selected.active ? "danger-subtle" : "primary"}`}
                onClick={() => {
                  const result = setActive(selected.id, !selected.active);
                  setProfileMessage({
                    error: !result.ok,
                    message: result.ok
                      ? selected.active
                        ? "Demo account deactivated."
                        : "Demo account activated."
                      : result.error,
                  });
                }}
              >
                {selected.active
                  ? "Deactivate demo account"
                  : "Activate demo account"}
              </button>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}

export function ReportsPage() {
  const { visibleIncidents, isAdmin, state } = useDemo();
  const records = visibleIncidents.filter(
    (i) => isAdmin || i.responderId === state.role,
  );
  const closed = records.filter((i) => !isActive(i));
  const resolved = closed.filter((i) => i.status === "Resolved");
  const average = resolved.length
    ? Math.round(
        resolved.reduce(
          (sum, i) =>
            sum +
            (new Date(i.updatedAt).getTime() -
              new Date(i.reportedAt).getTime()) /
              60000,
          0,
        ) / resolved.length,
      )
    : 0;
  return (
    <div className="reports-page">
      <PageHeader
        eyebrow="RECORDS & INSIGHTS"
        title={isAdmin ? "History & reports" : "My response history"}
        description={
          isAdmin
            ? "Review completed responses and understand your incident trends."
            : "Your own completed assignments, notes, and response records."
        }
      >
        <button className="button" onClick={() => window.print()}>
          <Printer size={16} />
          Print report
        </button>
        <button className="button primary" onClick={() => exportCSV(closed)}>
          <ArrowDownToLine size={16} />
          Export history
        </button>
      </PageHeader>
      <div className="assignment-summary report-summary">
        <div>
          <span className="stat-icon green">
            <ShieldCheck size={20} />
          </span>
          <strong>{resolved.length}</strong>
          <span>Resolved incidents</span>
        </div>
        <div>
          <span className="stat-icon neutral">
            <FileText size={20} />
          </span>
          <strong>
            {closed.filter((i) => i.status === "Cancelled").length}
          </strong>
          <span>Cancelled incidents</span>
        </div>
        <div>
          <span className="stat-icon blue">
            <Clock3 size={20} />
          </span>
          <strong>
            {average}
            <small>min</small>
          </strong>
          <span>Average time to resolution</span>
        </div>
      </div>
      <section className="panel report-chart">
        <div className="panel-heading">
          <div>
            <h2>Seven-day reporting trend</h2>
            <p>Counts derive from your current training records.</p>
          </div>
          <span className="training-tag">SIMULATED DATA</span>
        </div>
        <TrendsChart incidents={records} />
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Closed incident records</h2>
            <p>Resolved and cancelled records remain available for review.</p>
          </div>
          <span className="count-label">{closed.length}</span>
        </div>
        <IncidentTable incidents={closed} />
      </section>
      <p className="page-footnote">
        <FlaskConical size={14} />
        Resolution time measures reported-to-resolved duration. It does not
        measure arrival time. All figures are simulated.
      </p>
    </div>
  );
}

export function SettingsPage() {
  const { state, updatePreferences, reset, notify, isAdmin, actor } = useDemo();
  const [name, setName] = useState(state.preferences.name);
  const [resetOpen, setResetOpen] = useState(false);
  return (
    <>
      <PageHeader
        eyebrow="MAKE THE WORKSPACE YOURS"
        title="Settings"
        description="Manage your training profile, appearance, and workspace preferences."
      />
      <div className="settings-layout">
        <section className="panel settings-section">
          <div className="panel-heading">
            <div>
              <h2>Profile</h2>
              <p>Your identity in this training workspace</p>
            </div>
            <span className="avatar blue">
              {isAdmin
                ? "JW"
                : state.responders.find((r) => r.id === state.role)?.initials}
            </span>
          </div>
          <form
            className="settings-body"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim().length < 2 || name.trim().length > 60) {
                notify("Use a name between 2 and 60 characters.");
                return;
              }
              updatePreferences({ name: name.trim() });
              notify("Training profile saved");
            }}
          >
            <label className="form-label">
              {isAdmin ? "Coordinator display name" : "Responder name"}
              <input
                value={isAdmin ? name : actor}
                onChange={(e) => setName(e.target.value)}
                disabled={!isAdmin}
                maxLength={60}
              />
            </label>
            <label className="form-label">
              Workspace role
              <input
                value={
                  isAdmin
                    ? "Administrator preview"
                    : "Emergency responder preview"
                }
                disabled
              />
            </label>
            <p className="small-note">
              Use the role selector above to explore different training views.
            </p>
            {isAdmin && (
              <button className="button primary" type="submit">
                <Check size={16} />
                Save profile
              </button>
            )}
          </form>
        </section>
        <section className="panel settings-section">
          <div className="panel-heading">
            <div>
              <h2>Appearance</h2>
              <p>Choose the theme that works for you</p>
            </div>
            <Moon size={18} />
          </div>
          <div className="settings-body theme-options">
            <button
              className={!state.preferences.dark ? "selected" : ""}
              onClick={() => updatePreferences({ dark: false })}
            >
              <span className="theme-preview light-preview">
                <i />
                <span>
                  <i />
                  <i />
                  <i />
                </span>
              </span>
              <span>
                <Sun size={15} />
                Light{!state.preferences.dark && <Check size={15} />}
              </span>
            </button>
            <button
              className={state.preferences.dark ? "selected" : ""}
              onClick={() => updatePreferences({ dark: true })}
            >
              <span className="theme-preview dark-preview">
                <i />
                <span>
                  <i />
                  <i />
                  <i />
                </span>
              </span>
              <span>
                <Moon size={15} />
                Dark{state.preferences.dark && <Check size={15} />}
              </span>
            </button>
          </div>
        </section>
        <section className="panel settings-section">
          <div className="panel-heading">
            <div>
              <h2>Notifications</h2>
              <p>Control in-app training alerts</p>
            </div>
            <Radio size={18} />
          </div>
          <div className="settings-body">
            <label className="toggle-setting">
              <span>
                <strong>Show activity alerts</strong>
                <small>
                  Display the unread indicator for new simulated activity.
                </small>
              </span>
              <input
                type="checkbox"
                checked={state.preferences.notifications}
                onChange={(e) =>
                  updatePreferences({ notifications: e.target.checked })
                }
              />
            </label>
            <p className="small-note">
              Notification history remains available. SMS and mobile push are
              planned integrations.
            </p>
          </div>
        </section>
        <section className="panel settings-section">
          <div className="panel-heading">
            <div>
              <h2>Account & security</h2>
              <p>Phase 2 integration</p>
            </div>
            <LockKeyhole size={18} />
          </div>
          <div className="settings-body">
            <div className="info-callout">
              <LockKeyhole size={19} />
              <span>
                Secure sign-in, password reset, administrator-provisioned
                accounts, and backend permissions will be implemented with
                Supabase after Phase 1 approval.
              </span>
            </div>
            <p className="small-note">
              Role previews are interface demonstrations and do not provide
              authentication.
            </p>
          </div>
        </section>
        <section className="panel settings-section reset-section">
          <div className="panel-heading">
            <div>
              <h2>Reset demonstration</h2>
              <p>Start again with the original fictional records</p>
            </div>
            <FlaskConical size={18} />
          </div>
          <div className="settings-body">
            <p>
              Reset incidents, assignments, notes, preferences, and
              notifications saved in this browser.
            </p>
            <button
              className="button danger-subtle"
              onClick={() => setResetOpen(true)}
            >
              <RotateCcw size={15} />
              Reset training workspace
            </button>
          </div>
        </section>
      </div>
      {resetOpen && (
        <Modal
          title="Reset the training workspace?"
          description="This removes your local demo changes and restores the original fictional records."
          onClose={() => setResetOpen(false)}
        >
          <div className="modal-actions">
            <button className="button" onClick={() => setResetOpen(false)}>
              Keep changes
            </button>
            <button
              className="button primary"
              onClick={() => {
                reset();
                setName("Jordan Williams");
                setResetOpen(false);
              }}
            >
              Reset demonstration
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
