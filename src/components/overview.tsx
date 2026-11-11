"use client";

import Link from "next/link";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  CheckCheck,
  CircleAlert,
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
import { ResponderHome } from "./responder-home";
import { CATEGORIES } from "@/lib/types";

export function Overview() {
  const { visibleIncidents: incidents, state, isAdmin } = useDemo();
  if (!isAdmin) return <ResponderHome key={state.role} />;
  const active = incidents.filter(isActive);
  const pending = incidents.filter((i) => i.status === "Pending");
  const responding = incidents.filter(
    (i) => i.status === "Accepted" || i.status === "Responding",
  );
  const resolved = incidents.filter((i) => i.status === "Resolved");
  const urgent = active.filter(
    (i) => i.priority === "Critical" || i.priority === "High",
  );
  const team = state.responders;
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
    .slice(0, 3);
  const stats = [
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
      label: "Available responders",
      value: available.length,
      icon: Users,
      color: "green",
      description: "Active, on duty & unassigned",
      spark: undefined,
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
    <div className="control-centre">
      <PageHeader
        eyebrow="RESPONSE COMMAND CENTER"
        title="Incident control centre"
        description="Coordinate incoming reports, available teams, and every active response."
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
                {spark && (
                  <svg viewBox="0 0 84 32" aria-hidden="true">
                    <polyline points={spark} />
                  </svg>
                )}
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
        <div className="control-centre-side">
          <section className="panel team-availability">
            <div className="panel-heading">
              <div>
                <h2>Team availability</h2>
                <p>On-duty responders ready for assignment</p>
              </div>
              <Users size={18} />
            </div>
            {CATEGORIES.map((category) => {
              const members = team.filter((r) => r.category === category);
              const ready = available.filter(
                (r) => r.category === category,
              ).length;
              const onDuty = members.filter(
                (r) => r.active && r.availability !== "Off duty",
              ).length;
              return (
                <div className="team-availability-row" key={category}>
                  <span
                    className={`category-icon ${category === "Fire Outbreak" ? "fire" : "road"}`}
                  >
                    {category === "Fire Outbreak" ? (
                      <Flame size={18} />
                    ) : (
                      <CarFront size={18} />
                    )}
                  </span>
                  <strong>
                    {category === "Fire Outbreak"
                      ? "Fire response"
                      : "Road response"}
                    <small>On duty: {onDuty}</small>
                  </strong>
                  <span className="team-ready-count">{ready} available</span>
                </div>
              );
            })}
            <Link href="/responders" className="panel-footer-link">
              Manage response teams <ArrowRight size={15} />
            </Link>
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
        <IncidentTable incidents={active} compact />
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
      </div>
    </div>
  );
}
