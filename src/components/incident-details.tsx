"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  Clock3,
  MapPin,
  MessageSquare,
  Navigation,
  Printer,
  Radio,
  Send,
  ShieldCheck,
  UserRound,
  XCircle,
} from "lucide-react";
import { useDemo } from "./demo-provider";
import {
  CategoryIcon,
  EmptyState,
  Modal,
  PageHeader,
  PriorityBadge,
  StatusBadge,
} from "./ui";
import {
  date,
  isActive,
  nextStatus,
  teamName,
  time,
  validCoordinates,
} from "@/lib/utils";
import { noteSchema } from "@/lib/schemas";
import { MapPanel } from "./map-panel";
import type { Incident } from "@/lib/types";

export function IncidentDetails({ id }: { id: string }) {
  const {
    visibleIncidents,
    state,
    isAdmin,
    actor,
    assign,
    transition,
    addNote,
  } = useDemo();
  const incident = visibleIncidents.find((i) => i.id === id);
  const [selectedResponder, setSelectedResponder] = useState("");
  const [error, setError] = useState("");
  const [cancel, setCancel] = useState(false);
  const [reason, setReason] = useState("");
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<{ note: string }>({ resolver: zodResolver(noteSchema) });
  if (!incident)
    return (
      <>
        <Link href="/incidents" className="back-link">
          <ArrowLeft size={15} />
          Back to incidents
        </Link>
        <EmptyState
          title="Incident unavailable"
          description="This incident may belong to another team or may have been removed when the demonstration was reset."
        />
      </>
    );
  const responder = state.responders.find((r) => r.id === incident.responderId);
  const canUpdate =
    isAdmin || (incident.responderId === state.role && responder?.active);
  const next = nextStatus(incident.status);
  const eligible = state.responders.filter(
    (r) =>
      r.category === incident.category &&
      r.active &&
      r.availability !== "Off duty" &&
      !state.incidents.some(
        (i) => i.id !== incident.id && isActive(i) && i.responderId === r.id,
      ),
  );
  const actions = {
    Accepted: "Accept incident",
    Responding: "Start responding",
    Resolved: "Mark as resolved",
    Pending: "Pending",
    Cancelled: "Cancel",
  };
  const notes = incident.timeline.filter((e) => e.kind === "note");
  function update() {
    if (!incident || !next) return;
    const result = transition(incident.id, next);
    setError(result.ok ? "" : result.error);
  }
  function submitNote(value: { note: string }) {
    if (!incident) return;
    const result = addNote(incident.id, value.note);
    if (result.ok) {
      reset();
      setError("");
    } else setError(result.error);
  }
  return (
    <div className="incident-detail-page">
      <Link href="/incidents" className="back-link">
        <ArrowLeft size={15} />
        Back to incidents
      </Link>
      <PageHeader
        eyebrow={`${incident.reference} · SIMULATED INCIDENT`}
        title={incident.title}
        description={`${incident.category} · Reported ${date(incident.reportedAt)} at ${time(incident.reportedAt)} EAT`}
      >
        <button className="button" onClick={() => window.print()}>
          <Printer size={16} />
          Print report
        </button>
      </PageHeader>
      <div className="detail-status-bar">
        <div>
          <StatusBadge status={incident.status} />
          <PriorityBadge priority={incident.priority} />
          <span className="detail-category">
            <CategoryIcon category={incident.category} size={15} />
            {incident.category}
          </span>
        </div>
        <span className="small-note">
          Updated {date(incident.updatedAt, true)} · {time(incident.updatedAt)}{" "}
          EAT
        </span>
      </div>
      <div className="detail-grid">
        <div className="detail-main">
          <section className="panel detail-description">
            <div className="panel-heading">
              <h2>Incident information</h2>
              <span className="training-tag">TRAINING DATA</span>
            </div>
            <p>{incident.description}</p>
            <div className="detail-facts">
              <div>
                <MapPin size={17} />
                <span>
                  Location<strong>{incident.location}</strong>
                </span>
              </div>
              <div>
                <UserRound size={17} />
                <span>
                  Response team<strong>{teamName(incident.category)}</strong>
                </span>
              </div>
              <div>
                <Clock3 size={17} />
                <span>
                  Reported at
                  <strong>
                    {date(incident.reportedAt)} · {time(incident.reportedAt)}{" "}
                    EAT
                  </strong>
                </span>
              </div>
              <div>
                <Navigation size={17} />
                <span>
                  Coordinates
                  <strong>
                    {validCoordinates(incident.coordinates)
                      ? `${incident.coordinates[0].toFixed(5)}, ${incident.coordinates[1].toFixed(5)}`
                      : "Awaiting confirmation"}
                  </strong>
                </span>
              </div>
            </div>
          </section>
          <section className="panel detail-map">
            <div className="panel-heading">
              <div>
                <h2>Incident location</h2>
                <p>
                  {validCoordinates(incident.coordinates)
                    ? "Fictional training position on a real basemap"
                    : "No confirmed coordinates; the map shows the training area"}
                </p>
              </div>
              <MapPin size={17} />
            </div>
            <MapPanel incidents={[incident]} />
          </section>
          <section className="panel notes-panel">
            <div className="panel-heading">
              <div>
                <h2>
                  Response notes{" "}
                  <span className="count-label">{notes.length}</span>
                </h2>
                <p>Keep your team informed as the response progresses.</p>
              </div>
              <MessageSquare size={18} />
            </div>
            <div className="notes-content">
              {notes.length ? (
                notes.map((n) => (
                  <article className="response-note" key={n.id}>
                    <div>
                      <strong>{n.actor}</strong>
                      <small>
                        {date(n.at, true)} · {time(n.at)} EAT
                      </small>
                    </div>
                    <p>{n.detail}</p>
                  </article>
                ))
              ) : (
                <p className="small-note">No response notes yet.</p>
              )}
              {canUpdate && isActive(incident) ? (
                <form onSubmit={handleSubmit(submitNote)} className="note-form">
                  <label htmlFor="response-note">
                    Add a response note <span>as {actor}</span>
                  </label>
                  <textarea
                    id="response-note"
                    rows={3}
                    placeholder="Add observations or a response update…"
                    {...register("note")}
                    aria-invalid={!!errors.note}
                  />
                  {errors.note && (
                    <span className="field-error">{errors.note.message}</span>
                  )}
                  <button className="button primary" type="submit">
                    <Send size={15} />
                    Add note
                  </button>
                </form>
              ) : (
                <p className="small-note">
                  {isActive(incident)
                    ? "Response notes are managed by the assigned responder and administrator."
                    : "This incident is closed. Notes are retained in the record."}
                </p>
              )}
            </div>
          </section>
        </div>
        <aside className="detail-aside">
          <section className="panel response-controls">
            <div className="panel-heading">
              <h2>Response management</h2>
              <Radio size={18} />
            </div>
            <div className="control-body">
              <div className="assigned-person">
                {responder ? (
                  <>
                    <span
                      className={`avatar ${incident.category === "Fire Outbreak" ? "amber" : "blue"}`}
                    >
                      {responder.initials}
                    </span>
                    <div>
                      <strong>{responder.name}</strong>
                      <span>{responder.callsign} · Assigned responder</span>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="avatar">
                      <UserRound size={20} />
                    </span>
                    <div>
                      <strong>Awaiting assignment</strong>
                      <span>Coordinate the next response</span>
                    </div>
                  </>
                )}
              </div>
              {isAdmin && incident.status === "Pending" && (
                <div className="assignment-form">
                  <label htmlFor="assign-responder">
                    {responder ? "Reassign responder" : "Assign a responder"}
                  </label>
                  <select
                    id="assign-responder"
                    value={selectedResponder}
                    onChange={(e) => setSelectedResponder(e.target.value)}
                  >
                    <option value="">Select available responder</option>
                    {eligible.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} · {r.callsign}
                      </option>
                    ))}
                  </select>
                  <button
                    className="button"
                    disabled={!selectedResponder}
                    onClick={() => {
                      const result = assign(incident.id, selectedResponder);
                      setError(result.ok ? "" : result.error);
                      if (result.ok) setSelectedResponder("");
                    }}
                  >
                    Assign responder <ArrowRight size={15} />
                  </button>
                  {!eligible.length && (
                    <p className="small-note">
                      No eligible responders are available. Review team
                      availability.
                    </p>
                  )}
                </div>
              )}
              <div className="workflow-steps">
                {(
                  ["Pending", "Accepted", "Responding", "Resolved"] as const
                ).map((s, index, all) => (
                  <div
                    key={s}
                    className={`workflow-step ${all.indexOf(incident.status as typeof s) >= index ? "complete" : ""} ${incident.status === s ? "current" : ""}`}
                  >
                    <span>
                      {all.indexOf(incident.status as typeof s) > index ? (
                        <Check size={12} />
                      ) : (
                        index + 1
                      )}
                    </span>
                    <small>{s}</small>
                  </div>
                ))}
              </div>
              {canUpdate && next && (
                <button
                  className="button primary full-width"
                  disabled={!incident.responderId}
                  onClick={update}
                >
                  {next === "Resolved" ? (
                    <ShieldCheck size={17} />
                  ) : (
                    <Radio size={17} />
                  )}
                  {actions[next]}
                </button>
              )}
              {!incident.responderId && isActive(incident) && (
                <p className="small-note">
                  A responder must be assigned before the incident can be
                  accepted.
                </p>
              )}
              {!canUpdate && isActive(incident) && (
                <div className="info-callout">
                  <CircleAlert size={17} />
                  <span>
                    Only the assigned responder or an administrator can update
                    this response.
                  </span>
                </div>
              )}
              {isAdmin && isActive(incident) && (
                <button
                  className="button danger-subtle full-width"
                  onClick={() => setCancel(true)}
                >
                  <XCircle size={16} />
                  Cancel incident
                </button>
              )}
              {!isActive(incident) && (
                <div className="closed-notice">
                  <ShieldCheck size={18} />
                  Incident {incident.status.toLowerCase()} · Record retained
                </div>
              )}
              {error && (
                <p className="field-error" role="alert">
                  {error}
                </p>
              )}
            </div>
          </section>
          <Timeline incident={incident} />
        </aside>
      </div>
      {cancel && (
        <Modal
          title="Cancel training incident"
          description="A reason will be recorded in the incident timeline."
          onClose={() => setCancel(false)}
        >
          <label className="form-label">
            Cancellation reason
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Duplicate report confirmed"
              maxLength={500}
            />
          </label>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <button className="button" onClick={() => setCancel(false)}>
              Keep incident
            </button>
            <button
              className="button primary"
              onClick={() => {
                const result = transition(incident.id, "Cancelled", reason);
                if (result.ok) {
                  setCancel(false);
                  setError("");
                } else setError(result.error);
              }}
            >
              Confirm cancellation
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Timeline({ incident }: { incident: Incident }) {
  return (
    <section className="panel timeline-panel">
      <div className="panel-heading">
        <h2>Incident timeline</h2>
        <Clock3 size={17} />
      </div>
      <ol className="timeline-list">
        {[...incident.timeline].reverse().map((e) => (
          <li key={e.id}>
            <span className={`timeline-dot ${e.kind}`} />{" "}
            <div>
              <strong>{e.title}</strong>
              {e.detail && <p>{e.detail}</p>}
              <small>
                {e.actor}
                <br />
                {date(e.at, true)} · {time(e.at)} EAT
              </small>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
