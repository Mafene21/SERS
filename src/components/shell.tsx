"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Activity,
  ArrowDownLeft,
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FlaskConical,
  LayoutDashboard,
  Map,
  Menu,
  Moon,
  Search,
  Settings,
  ShieldPlus,
  Sun,
  Users,
  X,
  FileChartColumn,
  Radio,
  CircleHelp,
  CheckCheck,
} from "lucide-react";
import { useDemo } from "./demo-provider";
import { date, time } from "@/lib/utils";
import type { ViewRole } from "@/lib/types";

const links = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/incidents", label: "Incidents", icon: ClipboardList },
  { href: "/map", label: "Emergency map", icon: Map },
  { href: "/assignments", label: "My assignments", icon: Radio },
  { href: "/responders", label: "Response teams", icon: Users },
  { href: "/reports", label: "History & reports", icon: FileChartColumn },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const {
    state,
    visibleIncidents,
    isAdmin,
    actor,
    setRole,
    updatePreferences,
    readNotifications,
    hydrated,
    storageError,
    toast,
  } = useDemo();
  const [mobile, setMobile] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [help, setHelp] = useState(false);
  const [search, setSearch] = useState("");
  const readableNotifications = state.notifications.filter((n) =>
    visibleIncidents.some((i) => i.id === n.incidentId),
  );
  const unread = readableNotifications.filter((n) => !n.read).length;
  const pending = visibleIncidents.filter((i) => i.status === "Pending").length;
  const page =
    links.find((l) => l.href === path)?.label ??
    (path.startsWith("/incidents/") ? "Incident details" : "Settings");

  useEffect(() => {
    if (!mobile && !notifications && !help) return;
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobile(false);
        setNotifications(false);
        setHelp(false);
      }
    };
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, [mobile, notifications, help]);

  return (
    <div className={`app-shell ${collapsed ? "sidebar-collapsed" : ""}`}>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      {mobile && (
        <button
          className="sidebar-scrim"
          onClick={() => setMobile(false)}
          aria-label="Close navigation"
        />
      )}
      <aside
        className={`sidebar ${mobile ? "mobile-open" : ""}`}
        aria-label="Main navigation"
      >
        <Link className="brand" href="/" onClick={() => setMobile(false)}>
          <span className="brand-mark">
            <ShieldPlus size={26} strokeWidth={2} />
          </span>
          <span className="brand-copy">
            <strong>
              SERS<span className="brand-period">.</span>
            </strong>
            <small>EMERGENCY RESPONSE</small>
          </span>
        </Link>
        <div className="workspace-label">
          <span className="workspace-dot" />
          <span>Kampala operations</span>
          <ChevronDown size={14} />
        </div>
        <div className="nav-section-label">WORKSPACE</div>
        <nav>
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              onClick={() => setMobile(false)}
              aria-current={
                path === href ||
                (href === "/incidents" && path.startsWith("/incidents/"))
                  ? "page"
                  : undefined
              }
              className={`nav-link ${path === href || (href === "/incidents" && path.startsWith("/incidents/")) ? "active" : ""}`}
            >
              <Icon size={19} />
              <span>{label}</span>
              {href === "/incidents" && pending > 0 && (
                <span className="nav-count">{pending}</span>
              )}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="training-card">
            <span className="training-icon">
              <FlaskConical size={19} />
            </span>
            <strong>A space to prepare.</strong>
            <p>
              Practice the response.
              <br />
              Be ready for what matters.
            </p>
            <span className="training-tag">TRAINING WORKSPACE</span>
          </div>
          <Link
            className={`nav-link ${path === "/settings" ? "active" : ""}`}
            href="/settings"
            onClick={() => setMobile(false)}
          >
            <Settings size={19} />
            <span>Settings</span>
          </Link>
          <button className="nav-link" onClick={() => setHelp(!help)}>
            <CircleHelp size={19} />
            <span>Help & information</span>
          </button>
          <div className="sidebar-footer">
            <span>
              <span className="green-dot" />
              Demo mode
            </span>
            <button
              className="icon-button"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? (
                <ChevronRight size={17} />
              ) : (
                <ChevronLeft size={17} />
              )}
            </button>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              aria-expanded={mobile}
              onClick={() => setMobile(true)}
            >
              <Menu size={21} />
            </button>
            <span className="breadcrumb-home">Workspace</span>
            <ChevronRight size={14} />
            <strong>{page}</strong>
          </div>
          <div className="topbar-actions">
            <form
              className="global-search"
              role="search"
              onSubmit={(e) => {
                e.preventDefault();
                router.push(`/incidents?q=${encodeURIComponent(search)}`);
              }}
            >
              <Search size={16} />
              <input
                aria-label="Search all incidents"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search incidents…"
              />
              <kbd>↵</kbd>
            </form>
            <button
              className="icon-button"
              aria-label={
                state.preferences.dark
                  ? "Switch to light theme"
                  : "Switch to dark theme"
              }
              onClick={() =>
                updatePreferences({ dark: !state.preferences.dark })
              }
            >
              {state.preferences.dark ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <button
              className="icon-button notification-button"
              aria-label={`Notifications, ${unread} unread`}
              aria-expanded={notifications}
              onClick={() => setNotifications(!notifications)}
            >
              <Bell size={19} />
              {unread > 0 && state.preferences.notifications && (
                <span className="notification-dot" />
              )}
            </button>
            <span className="topbar-separator" />
            <div className="profile-avatar">
              {isAdmin
                ? "JW"
                : state.responders.find((r) => r.id === state.role)?.initials}
            </div>
            <div className="profile-summary">
              <strong>{actor}</strong>
              <span>
                {isAdmin ? "Operations coordinator" : "Emergency responder"}
              </span>
            </div>
          </div>
          {notifications && (
            <div className="notification-panel">
              <div className="panel-heading">
                <h3>
                  Notifications <span className="count-label">{unread}</span>
                </h3>
                <button
                  className="icon-button"
                  title="Mark all as read"
                  aria-label="Mark all notifications as read"
                  onClick={readNotifications}
                >
                  <CheckCheck size={18} />
                </button>
              </div>
              <p className="small-note">
                Simulated activity ·{" "}
                {state.preferences.notifications
                  ? "alerts enabled"
                  : "alerts muted"}
              </p>
              {readableNotifications.length ? (
                readableNotifications.map((n) => (
                  <Link
                    className={`notification-item ${!n.read ? "unread" : ""}`}
                    href={`/incidents/${n.incidentId}`}
                    onClick={() => setNotifications(false)}
                    key={n.id}
                  >
                    <span className="activity-icon">
                      <Bell size={16} />
                    </span>
                    <span>
                      <strong>{n.title}</strong>
                      <small>
                        {date(n.at, true)} · {time(n.at)} EAT
                      </small>
                    </span>
                    <ArrowDownLeft size={15} />
                  </Link>
                ))
              ) : (
                <p className="small-note">No notifications for this team.</p>
              )}
            </div>
          )}
        </header>
        <div className="demo-banner">
          <div>
            <FlaskConical size={14} />
            <span>
              <strong>Demonstration workspace</strong>
              <span className="banner-detail">
                {" "}
                · All incidents and people are fictional. No emergency services
                are contacted.
              </span>
            </span>
          </div>
          <label className="role-select">
            <span>Preview as</span>
            <select
              aria-label="Preview role"
              value={state.role}
              onChange={(e) => {
                setRole(e.target.value as ViewRole);
                setNotifications(false);
              }}
            >
              <option value="admin">Administrator</option>
              <option value="road-1">Alex · Road responder</option>
              <option value="fire-1">Nina · Fire responder</option>
            </select>
          </label>
        </div>
        {storageError && (
          <div className="storage-warning" role="status">
            {storageError}
          </div>
        )}
        <main id="main-content" className="main-content">
          {hydrated ? (
            children
          ) : (
            <div className="page-loading">
              <Activity size={26} />
              <span>Preparing your training workspace…</span>
              <div className="skeleton" />
            </div>
          )}
        </main>
        <footer className="workspace-footer">
          <span>
            SERS <span className="footer-divider">/</span> Road Accident & Fire
            Emergency Response
          </span>
          <span>
            <span className="green-dot" />
            {hydrated ? "Local demo" : "Loading"}
            <span className="footer-divider">·</span>East Africa Time (UTC+3)
          </span>
        </footer>
      </div>
      {toast && (
        <div className="toast" role="status">
          <span className="green-dot" />
          {toast}
        </div>
      )}
      {help && (
        <div className="help-panel">
          <div className="panel-heading">
            <h3>About this workspace</h3>
            <button
              className="icon-button"
              onClick={() => setHelp(false)}
              aria-label="Close help"
            >
              <X size={18} />
            </button>
          </div>
          <p>
            SERS is a university project for coordinating road accident and fire
            responses.
          </p>
          <p>
            Use <strong>Preview as</strong> to try administrator and responder
            views. Administrators assign incidents; responders update their own
            assignments.
          </p>
          <p>
            Changes are saved in this browser. Reset the demonstration in
            Settings. Authentication, shared records, and live dispatch are
            outside Phase 1.
          </p>
          <Link
            href="/settings"
            className="text-link"
            onClick={() => setHelp(false)}
          >
            Workspace settings <ChevronRight size={14} />
          </Link>
        </div>
      )}
    </div>
  );
}
