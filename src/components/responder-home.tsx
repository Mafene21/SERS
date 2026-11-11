"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  CheckCheck,
  Clock3,
  MapPin,
  MessageSquare,
  Radio,
  ShieldCheck,
} from "lucide-react";
import { useDemo } from "./demo-provider";
import { EmptyState, PageHeader, PriorityBadge, StatusBadge } from "./ui";
import { MapPanel } from "./map-panel";
import { LocationActions } from "./location-actions";
import { useNow } from "./live-clock";
import {
  date,
  elapsedTime,
  isActive,
  isTodayEAT,
  nextStatus,
  teamName,
  time,
} from "@/lib/utils";
import type { Availability, Incident } from "@/lib/types";

export function ResponderHome() {
  const { state, actor, visibleIncidents, setAvailability } = useDemo();
  const now = useNow();
  const [availabilityError, setAvailabilityError] = useState("");
  const responder = state.responders.find((r) => r.id === state.role);
  const assigned = visibleIncidents.filter((i) => i.responderId === state.role);
  const active = assigned.filter(isActive);
  const history = assigned
    .filter((i) => !isActive(i))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const completed = history.filter(
    (i) => i.status === "Resolved" && isTodayEAT(i.updatedAt, now),
  );
  return (
    <div className="responder-home">
      <PageHeader
        eyebrow="YOUR RESPONSE WORKSPACE"
        title="My assignments"
        description={`Welcome back, ${actor.split(" ")[0]}. Your next response starts here.`}
      >
        <label className="duty-control">
          <span className="sr-only">My availability</span>
          <span
            className={`duty-dot ${responder?.availability === "Off duty" ? "off" : ""}`}
          />
          <select
            aria-label="My availability"
            value={responder?.availability ?? "Off duty"}
            disabled={!responder?.active}
            onChange={(e) => {
              if (!responder) return;
              const result = setAvailability(
                responder.id,
                e.target.value as Availability,
              );
              setAvailabilityError(result.ok ? "" : result.error);
            }}
          >
            <option>On duty</option>
            <option>Available</option>
            <option>Off duty</option>
          </select>
        </label>
      </PageHeader>
      {availabilityError && active.length > 0 && (
        <p className="field-error responder-availability-error" role="alert">
          {availabilityError}
        </p>
      )}
      <p className="responder-team-label">
        <Radio size={15} />
        {responder ? teamName(responder.category) : "Response team"}
        <span>·</span>
        {responder?.callsign}
      </p>
      <div className="responder-stats">
        <div>
          <span className="stat-icon red">
            <Radio size={22} />
          </span>
          <span>
            Active assignments<strong>{active.length}</strong>
          </span>
        </div>
        <div>
          <span className="stat-icon green">
            <ShieldCheck size={22} />
          </span>
          <span>
            Completed today<strong>{completed.length}</strong>
          </span>
        </div>
      </div>
      <div className="responder-workspace-grid">
        <div className="responder-current">
          <div className="section-caption">
            <h2>Current assignment{active.length === 1 ? "" : "s"}</h2>
            <span className="count-label">{active.length}</span>
          </div>
          {active.length ? (
            active.map((incident) => (
              <AssignmentFocus
                key={`${state.role}-${incident.id}`}
                incident={incident}
              />
            ))
          ) : (
            <section className="panel">
              <EmptyState
                title="No active assignments"
                description="Your next assignment will appear here when a coordinator assigns it in this demo."
              >
                <Link href="/reports" className="button">
                  View my history <ArrowRight size={16} />
                </Link>
              </EmptyState>
            </section>
          )}
        </div>
        <aside className="responder-recent">
          <section className="panel personal-history">
            <div className="panel-heading">
              <div>
                <h2>My response history</h2>
                <p>Your most recent completed assignments</p>
              </div>
              <CheckCheck size={19} />
            </div>
            {history.length ? (
              <div className="personal-history-list">
                {history.slice(0, 4).map((i) => (
                  <Link href={`/incidents/${i.id}`} key={i.id}>
                    <span className="history-check">
                      <ShieldCheck size={18} />
                    </span>
                    <div>
                      <small>{i.reference}</small>
                      <strong>{i.title}</strong>
                      <span>
                        {date(i.updatedAt, true)} · {time(i.updatedAt)} EAT
                      </span>
                    </div>
                    <StatusBadge status={i.status} />
                  </Link>
                ))}
              </div>
            ) : (
              <p className="responder-history-empty">
                Completed assignments will appear here.
              </p>
            )}
            <Link href="/reports" className="panel-footer-link">
              View my history <ArrowRight size={16} />
            </Link>
          </section>
          <div className="responder-help-card">
            <Radio size={20} />
            <strong>One response at a time.</strong>
            <p>
              Use the main action to advance your response. Record observations
              in the incident notes.
            </p>
            <Link href="/incidents" className="text-link">
              Browse team incidents <ArrowRight size={15} />
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

function AssignmentFocus({ incident }: { incident: Incident }) {
  const { transition, state } = useDemo();
  const [error, setError] = useState("");
  const now = useNow();
  const responder = state.responders.find((r) => r.id === state.role);
  const next = nextStatus(incident.status);
  const action =
    next === "Accepted"
      ? "Accept incident"
      : next === "Responding"
        ? "Start responding"
        : "Mark as resolved";
  return (
    <article
      className="panel assignment-focus"
      aria-label={`${incident.reference} assignment`}
    >
      <div className="assignment-focus-body">
        <div className="focus-reference">
          <PriorityBadge priority={incident.priority} />
          <span>
            {incident.reference} · {incident.category}
          </span>
        </div>
        <div className="focus-heading">
          <h2>
            <Link href={`/incidents/${incident.id}`}>{incident.title}</Link>
          </h2>
          <StatusBadge status={incident.status} />
        </div>
        <p className="focus-location">
          <MapPin size={17} />
          {incident.location}
        </p>
        <p className="focus-reported">
          <Clock3 size={15} />
          Reported {elapsedTime(incident.reportedAt, now)} ago
        </p>
        <p className="focus-description">{incident.description}</p>
      </div>
      <div className="focus-map">
        <MapPanel incidents={[incident]} />
      </div>
      <div className="assignment-focus-body focus-actions">
        <LocationActions coordinates={incident.coordinates} />
        {next && (
          <button
            className="button primary response-primary"
            disabled={!responder?.active}
            onClick={() => {
              const result = transition(incident.id, next);
              setError(result.ok ? "" : result.error);
            }}
          >
            {next === "Resolved" ? (
              <ShieldCheck size={21} />
            ) : (
              <Radio size={21} />
            )}
            {action}
          </button>
        )}
        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
        <Link
          href={`/incidents/${incident.id}#response-notes`}
          className="button response-note-link"
        >
          <MessageSquare size={19} />
          Add response note
        </Link>
        <div className="focus-timeline">
          <h3>Response history</h3>
          {incident.timeline
            .filter((e) => e.kind !== "note")
            .slice(-3)
            .map((e) => (
              <div key={e.id}>
                <span className="history-check">
                  <CheckCheck size={16} />
                </span>
                <div>
                  <strong>{e.title}</strong>
                  <small>
                    {date(e.at, true)} · {time(e.at)} EAT
                  </small>
                </div>
              </div>
            ))}
        </div>
        <Link className="text-link" href={`/incidents/${incident.id}`}>
          Full incident record <ArrowRight size={15} />
        </Link>
      </div>
    </article>
  );
}
