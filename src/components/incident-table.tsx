"use client";

import Link from "next/link";
import {
  ArrowDown,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Download,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useState } from "react";
import { CATEGORIES, PRIORITIES, STATUSES, type Incident } from "@/lib/types";
import { date, time, teamName, exportCSV } from "@/lib/utils";
import { useDemo } from "./demo-provider";
import { CategoryIcon, EmptyState, PriorityBadge, StatusBadge } from "./ui";
import { WaitingBadge } from "./live-clock";

export function IncidentTable({
  incidents,
  compact = false,
  initialSearch = "",
}: {
  incidents: Incident[];
  compact?: boolean;
  initialSearch?: string;
}) {
  const { state, isAdmin } = useDemo();
  const [query, setQuery] = useState(initialSearch);
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest" | "priority">(
    compact ? "priority" : "newest",
  );
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState(false);
  const matching = incidents.filter(
    (i) =>
      (!category || i.category === category) &&
      (!status || i.status === status) &&
      (!priority || i.priority === priority) &&
      `${i.reference} ${i.title} ${i.location} ${i.category}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  matching.sort((a, b) =>
    sort === "priority"
      ? PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority) ||
        b.reportedAt.localeCompare(a.reportedAt)
      : sort === "newest"
        ? b.reportedAt.localeCompare(a.reportedAt)
        : a.reportedAt.localeCompare(b.reportedAt),
  );
  const pageSize = compact ? 5 : 8;
  const pages = Math.max(1, Math.ceil(matching.length / pageSize));
  const current = Math.min(page, pages);
  const rows = matching.slice((current - 1) * pageSize, current * pageSize);
  const change = (setter: (value: string) => void, value: string) => {
    setter(value);
    setPage(1);
  };
  return (
    <div className="incident-table-wrapper">
      {!compact && (
        <>
          <div className="table-toolbar">
            <div className="table-search">
              <Search size={17} />
              <input
                aria-label="Search incidents"
                placeholder="Search by reference, location, or incident…"
                value={query}
                onChange={(e) => change(setQuery, e.target.value)}
              />
              {query && (
                <button
                  className="icon-button"
                  aria-label="Clear search"
                  onClick={() => change(setQuery, "")}
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <div className="table-toolbar-actions">
              <select
                aria-label="Filter by category"
                value={category}
                onChange={(e) => change(setCategory, e.target.value)}
              >
                <option value="">All categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <button
                className={`button filter-button ${filters ? "selected" : ""}`}
                aria-expanded={filters}
                onClick={() => setFilters(!filters)}
              >
                <SlidersHorizontal size={15} />
                Filters{(status || priority) && <span className="filter-dot" />}
              </button>
              <button
                className="button filter-button"
                onClick={() => exportCSV(matching)}
              >
                <Download size={14} />
                Export CSV
              </button>
            </div>
          </div>
          {filters && (
            <div className="expanded-filters">
              <label>
                Status
                <select
                  value={status}
                  aria-label="Filter by status"
                  onChange={(e) => change(setStatus, e.target.value)}
                >
                  <option value="">All statuses</option>
                  {STATUSES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label>
                Priority
                <select
                  value={priority}
                  aria-label="Filter by priority"
                  onChange={(e) => change(setPriority, e.target.value)}
                >
                  <option value="">All priorities</option>
                  {PRIORITIES.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </label>
              <label>
                Sort by
                <select
                  value={sort}
                  aria-label="Sort incidents"
                  onChange={(e) => {
                    setSort(e.target.value as typeof sort);
                    setPage(1);
                  }}
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="priority">Highest priority</option>
                </select>
              </label>
              <button
                className="text-link"
                onClick={() => {
                  setQuery("");
                  setCategory("");
                  setPriority("");
                  setStatus("");
                  setPage(1);
                }}
              >
                Clear filters
              </button>
            </div>
          )}
        </>
      )}
      {rows.length ? (
        <div className="table-scroll">
          <table className="incident-table">
            <thead>
              <tr>
                <th scope="col">
                  Incident <ArrowDown size={12} />
                </th>
                <th scope="col">Priority</th>
                <th scope="col">Status</th>
                <th scope="col">Responder</th>
                <th scope="col">Waiting</th>
                {!compact && <th scope="col">Reported</th>}
                <th scope="col">
                  <span className="sr-only">View incident</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => {
                const responder = state.responders.find(
                  (r) => r.id === i.responderId,
                );
                return (
                  <tr key={i.id}>
                    <td>
                      <Link
                        href={`/incidents/${i.id}`}
                        className="incident-name"
                      >
                        <span
                          className={`category-icon ${i.category === "Fire Outbreak" ? "fire" : "road"}`}
                        >
                          <CategoryIcon category={i.category} />
                        </span>
                        <span>
                          <span className="incident-reference">
                            {i.reference} <span>· {i.category}</span>
                          </span>
                          <strong>{i.title}</strong>
                          <small>{i.location}</small>
                        </span>
                      </Link>
                    </td>
                    <td>
                      <PriorityBadge priority={i.priority} />
                    </td>
                    <td>
                      <StatusBadge status={i.status} />
                    </td>
                    <td>
                      {responder ? (
                        <div className="responder-cell">
                          <span
                            className={`avatar small ${responder.category === "Fire Outbreak" ? "amber" : "blue"}`}
                          >
                            {responder.initials}
                          </span>
                          <span>
                            {responder.name}
                            <small>{responder.callsign}</small>
                          </span>
                        </div>
                      ) : (
                        <span className="unassigned">
                          Unassigned<small>{teamName(i.category)}</small>
                        </span>
                      )}
                    </td>
                    <td>
                      {i.status === "Pending" ? (
                        <WaitingBadge reportedAt={i.reportedAt} />
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    {!compact && (
                      <td>
                        <span className="table-date">
                          {date(i.reportedAt, true)}
                          <small>{time(i.reportedAt)} EAT</small>
                        </span>
                      </td>
                    )}
                    <td>
                      {compact && isAdmin && i.status === "Pending" ? (
                        <Link
                          className="button queue-assign"
                          href={`/incidents/${i.id}#response-management`}
                          aria-label={`${i.responderId ? "Reassign" : "Assign"} ${i.reference}`}
                        >
                          {i.responderId ? "Reassign" : "Assign"}
                        </Link>
                      ) : (
                        <Link
                          className="icon-button"
                          aria-label={`View ${i.reference}`}
                          href={`/incidents/${i.id}`}
                        >
                          <ArrowUpRight size={18} />
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState />
      )}
      {!compact && (
        <div className="pagination">
          <span>
            Showing {matching.length ? (current - 1) * pageSize + 1 : 0}–
            {Math.min(current * pageSize, matching.length)} of {matching.length}{" "}
            incidents
          </span>
          <div>
            <button
              className="button page-button"
              disabled={current === 1}
              aria-label="Previous page"
              onClick={() => setPage(current - 1)}
            >
              <ChevronLeft size={16} />
            </button>
            <span>
              Page {current} of {pages}
            </span>
            <button
              className="button page-button"
              disabled={current === pages}
              aria-label="Next page"
              onClick={() => setPage(current + 1)}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
