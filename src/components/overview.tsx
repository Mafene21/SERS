"use client";

import Link from "next/link";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  CheckCheck,
  CircleAlert,
  ClipboardList,
  Clock3,
  Radio,
  Users,
  CarFront,
  Flame,
  ShieldCheck,
  MapPin,
  ChevronRight,
} from "lucide-react";
import { useDemo } from "./demo-provider";
import { date, exportCSV, isActive, time, sparkPoints } from "@/lib/utils";
import { PageHeader } from "./ui";
import { SimulateButton } from "./report-dialog";
import { MapPanel } from "./map-panel";
import { CategoryDistribution, TrendsChart } from "./charts";
import { IncidentTable } from "./incident-table";

export function Overview() {
  const { visibleIncidents: incidents, state, isAdmin, actor } = useDemo();
  const active = incidents.filter(isActive);
  const pending = incidents.filter((i) => i.status === "Pending");
  const responding = incidents.filter(
    (i) => i.status === "Accepted" || i.status === "Responding",
  );
  const resolved = incidents.filter((i) => i.status === "Resolved");
  const urgent = active.filter(
    (i) => i.priority === "Critical" || i.priority === "High",
  );
  const team = state.responders.filter(
    (r) =>
      isAdmin ||
      r.category ===
        state.responders.find((p) => p.id === state.role)?.category,
  );
  const available = team.filter(
    (r) =>
      r.active &&
      r.availability !== "Off duty" &&
      !active.some((i) => i.responderId === r.id),
  );
  const events = incidents
    .flatMap((i) =>
      i.timeline.map((e) => ({
        ...e,
        incidentId: i.id,
        reference: i.reference,
        category: i.category,
      })),
    )
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 4);
  const stats = [
    {
      label: "Total incidents",
      value: incidents.length,
      icon: ClipboardList,
      color: "neutral",
      description: "All training records",
      spark: sparkPoints(incidents, incidents),
    },
    {
      label: "Pending incidents",
      value: pending.length,
      icon: Clock3,
      color: "red",
      description: `${pending.filter((i) => !i.responderId).length} awaiting assignment`,
      spark: sparkPoints(pending, incidents),
    },
    {
      label: "Active responses",
      value: responding.length,
      icon: Radio,
      color: "blue",
      description: "Accepted & responding",
      spark: sparkPoints(responding, incidents),
    },
    {
      label: "Resolved incidents",
      value: resolved.length,
      icon: ShieldCheck,
      color: "green",
      description: "Completed training responses",
      spark: sparkPoints(resolved, incidents),
    },
  ];
  return (
    <>
      <PageHeader
        eyebrow="RESPONSE COMMAND CENTER"
        title={isAdmin ? "Operational overview" : `Your response overview`}
        description={
          isAdmin
            ? "A clear view of every incident. A coordinated response, every time."
            : `Welcome back, ${actor.split(" ")[0]}. Your team’s incidents and response activity.`
        }
      >
        <button className="button" onClick={() => exportCSV(incidents)}>
          <ArrowDownToLine size={16} />
          Export report
        </button>
        <SimulateButton />
      </PageHeader>
      <div className="overview-meta">
        <span className="date-label">
          <span className="green-dot" />
          Training operations <span className="meta-divider">/</span> Kampala,
          Uganda
        </span>
        <span>
          {date(new Date().toISOString())} <span className="muted">· EAT</span>
        </span>
      </div>
      <div className="stats-grid">
        {stats.map(
          ({ label, value, icon: Icon, color, description, spark }) => (
            <div className={`stat-card stat-${color}`} key={label}>
              <div className="stat-top">
                <span>{label}</span>
                <span className={`stat-icon ${color}`}>
                  <Icon size={18} />
                </span>
              </div>
              <div className="stat-value">
                <strong>{String(value).padStart(2, "0")}</strong>
                <svg viewBox="0 0 84 32" aria-hidden="true">
                  <polyline points={spark} />
                </svg>
              </div>
              <div className="stat-description">
                <span className={`mini-dot ${color}`} />
                {description}
              </div>
            </div>
          ),
        )}
      </div>
      {urgent.length > 0 && (
        <div className="attention-strip">
          <div className="attention-icon">
            <CircleAlert size={19} />
          </div>
          <div>
            <strong>
              {urgent.length} high-priority{" "}
              {urgent.length === 1 ? "incident needs" : "incidents need"}{" "}
              attention
            </strong>
            <span>
              {pending.filter((i) => i.priority === "Critical").length} critical
              reports pending · Review and coordinate your team’s next response.
            </span>
          </div>
          <Link href="/incidents?priority=urgent">
            Review incidents <ArrowRight size={16} />
          </Link>
        </div>
      )}
      <div className="operations-grid">
        <section className="panel map-panel">
          <div className="panel-heading">
            <div>
              <h2>
                <span className="heading-dot" />
                Emergency map
              </h2>
              <p>Active incidents across the training area</p>
            </div>
            <Link className="text-link" href="/map">
              Open map <ArrowUpRight size={15} />
            </Link>
          </div>
          <MapPanel incidents={active} />
          <div className="map-panel-footer">
            <span>
              <i className="legend-dot red" />
              <CarFront size={14} />
              Road accident
            </span>
            <span>
              <i className="legend-dot amber" />
              <Flame size={14} />
              Fire outbreak
            </span>
            <span className="map-active-count">{active.length} active</span>
          </div>
        </section>
        <section className="panel activity-panel">
          <div className="panel-heading">
            <div>
              <h2>Recent activity</h2>
              <p>The latest from your response team</p>
            </div>
            <span className="subtle-icon">
              <Radio size={16} />
            </span>
          </div>
          <div className="activity-list">
            {events.map((e, index) => (
              <Link
                href={`/incidents/${e.incidentId}`}
                className="activity-row"
                key={`${e.incidentId}-${e.id}`}
              >
                <div
                  className={`activity-marker ${e.kind === "report" ? "red" : e.kind === "status" ? "green" : "blue"}`}
                >
                  {e.kind === "report" ? (
                    <CircleAlert size={15} />
                  ) : e.kind === "status" ? (
                    <CheckCheck size={15} />
                  ) : (
                    <Users size={15} />
                  )}
                  {index < events.length - 1 && <span />}
                </div>
                <div>
                  <strong>{e.title}</strong>
                  <p>
                    {e.reference} <span>· {e.category}</span>
                  </p>
                  <small>{time(e.at)} EAT</small>
                </div>
                <ChevronRight size={14} />
              </Link>
            ))}
          </div>
          <Link href="/reports" className="panel-footer-link">
            View response history <ArrowRight size={15} />
          </Link>
        </section>
      </div>
      <section className="panel queue-panel">
        <div className="panel-heading">
          <div>
            <h2>
              Active incident queue{" "}
              <span className="count-label">{active.length}</span>
            </h2>
            <p>Prioritize, coordinate, and keep the response moving.</p>
          </div>
          <Link className="text-link" href="/incidents">
            View all incidents <ArrowRight size={15} />
          </Link>
        </div>
        <IncidentTable
          incidents={[...active].sort((a, b) =>
            a.priority.localeCompare(b.priority),
          )}
          compact
        />
      </section>
      <div className="analytics-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Incident trends</h2>
              <p>Reported incidents over the last 7 days</p>
            </div>
            <div className="chart-key">
              <span>
                <i className="legend-dot red" />
                Road accidents
              </span>
              <span>
                <i className="legend-dot amber" />
                Fire outbreaks
              </span>
            </div>
          </div>
          <TrendsChart incidents={incidents} />
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Incident categories</h2>
              <p>Distribution across all records</p>
            </div>
            <span className="subtle-icon">
              <MapPin size={16} />
            </span>
          </div>
          <CategoryDistribution incidents={incidents} />
        </section>
        <section className="panel availability-panel">
          <div className="panel-heading">
            <div>
              <h2>Team readiness</h2>
              <p>Ready for the next response</p>
            </div>
            <Users size={17} />
          </div>
          <div className="readiness-count">
            <strong>{String(available.length).padStart(2, "0")}</strong>
            <span>
              <span className="green-dot" />
              responders available
            </span>
          </div>
          <div className="readiness-bar">
            {team.map((r) => (
              <span
                key={r.id}
                className={
                  available.some((a) => a.id === r.id)
                    ? "ready"
                    : r.availability === "Off duty" || !r.active
                      ? "off"
                      : "busy"
                }
                title={`${r.name}: ${available.some((a) => a.id === r.id) ? "Available" : r.availability}`}
              />
            ))}
          </div>
          <div className="readiness-legend">
            <span>
              <i className="legend-dot green" />
              Available {available.length}
            </span>
            <span>
              <i className="legend-dot amber" />
              Assigned{" "}
              {
                team.filter((r) => active.some((i) => i.responderId === r.id))
                  .length
              }
            </span>
          </div>
          <Link href="/responders" className="panel-footer-link">
            View response teams <ArrowRight size={15} />
          </Link>
        </section>
      </div>
    </>
  );
}
