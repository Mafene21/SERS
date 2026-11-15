import { captureCurrentLocation } from "./location-service.js";
import {
  createPhotoTicket,
  createTrackingCode,
  isBackendConfigured,
  submitIncident,
  uploadEvidence,
} from "./incident-service.js";
import {
  forgetReport,
  getSavedReports,
  rememberReport,
  trackReport,
} from "./tracking-service.js";

const app = document.querySelector("#app");
const toast = document.querySelector("#toast");
const categories = ["Road Accident", "Fire Outbreak"];
const stages = [
  "Report submitted",
  "Report received",
  "Responder assigned",
  "Responder responding",
  "Incident resolved",
];
const emptyForm = () => ({ category: "", description: "", reporterName: "", phone: "", photo: null, photoUrl: "", photoPath: "", uploadTicket: null, accessToken: "" });
const state = {
  screen: "welcome",
  form: emptyForm(),
  submitted: null,
  detail: null,
  trackError: "",
  trackBusy: false,
  submitError: "",
  submitting: false,
  detailsError: "",
  photoError: "",
  localSaveError: "",
  listBusy: false,
  listError: "",
  refreshedReports: [],
};

function esc(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function icon(name, size = 22) {
  const paths = {
    shield: '<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/>',
    road: '<path d="M5 3 3 21M19 3l2 18M12 4v3m0 4v3m0 4v3"/><path d="M7 3h10"/>',
    fire: '<path d="M12 22c4.4 0 7-3 7-7 0-2.8-1.5-5.2-4-7-.2 2-1.3 3.2-2.5 3.6C13 7.8 11.8 4.8 9 2 9.2 6 7.8 8 5.8 10.5 4.6 12 4 13.7 4 15c0 4.1 3.1 7 8 7Z"/><path d="M12 22c2 0 3.5-1.4 3.5-3.4 0-1.4-.8-2.6-2.4-3.7-.1 1.1-.7 1.8-1.5 2-.2-1.3-.8-2.5-2-3.7 0 2-1.1 3-1.1 4.6 0 2.4 1.4 4.2 3.5 4.2Z"/>',
    pin: '<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    arrow: '<path d="M5 12h14m-7-7 7 7-7 7"/>',
    back: '<path d="m15 18-6-6 6-6"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6m-12 5h8m-8 4h8"/>',
    camera: '<path d="M14 5 15.5 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h4.5L10 5z"/><circle cx="12" cy="13" r="3"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.4 2.8a2 2 0 0 1-.6 1.7L7.5 9.6a16 16 0 0 0 6 6l1.4-1.4a2 2 0 0 1 1.7-.6l2.8.4a2 2 0 0 1 1.7 1.9Z"/>',
    close: '<path d="m18 6-12 12M6 6l12 12"/>',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.shield}</svg>`;
}

function header() {
  const simple = state.screen === "welcome";
  return `<header class="topbar"><button class="brand" data-action="home" aria-label="SERS home"><span class="brand-mark">S</span><span class="brand-text"><strong>SERS</strong><small>Emergency response</small></span></button>${simple ? `<a class="staff-link" href="https://sers-tawny.vercel.app/" target="_blank" rel="noreferrer">Responder portal <span aria-hidden="true">↗</span></a>` : `<nav class="top-links" aria-label="Main navigation"><button data-action="home">Home</button><button data-action="reports">My reports</button></nav>`}</header>`;
}

function shell(content) {
  app.innerHTML = `${header()}<main class="main-content">${content}</main><footer class="footer"><span>Smart Emergency Response System</span><span>For road accidents and fire outbreaks</span></footer>`;
  bind();
}

function render() {
  if (state.screen === "welcome") return renderWelcome();
  if (state.screen === "home") return renderHome();
  if (state.screen === "type") return renderType();
  if (state.screen === "details") return renderDetails();
  if (state.screen === "review") return renderReview();
  if (state.screen === "confirmation") return renderConfirmation();
  if (state.screen === "track") return renderTrack();
  if (state.screen === "reports") return renderReports();
  if (state.screen === "detail") return renderDetail();
  state.screen = "welcome";
  return renderWelcome();
}

function renderWelcome() {
  shell(`<section class="welcome-grid"><div class="welcome-copy"><div class="eyebrow"><span class="pulse-dot"></span> Community emergency reporting</div><h1>Help can start<br /><em>with one report.</em></h1><p class="lead">SERS connects your emergency report with the response team, so they can understand what is happening and where help is needed.</p><div class="category-pills"><span>${icon("road", 18)} Road accidents</span><span>${icon("fire", 18)} Fire outbreaks</span></div><button class="button button-primary button-large" data-action="get-started">Get started ${icon("arrow", 19)}</button><p class="quiet-note">No account needed. Share only the details needed to respond.</p></div><div class="welcome-art" aria-label="Emergency response illustration"><div class="art-orbit orbit-one"></div><div class="art-orbit orbit-two"></div><div class="art-card art-card-top"><span class="art-icon">${icon("pin", 20)}</span><span><strong>Location captured</strong><small>With your permission</small></span><span class="art-tick">${icon("check", 15)}</span></div><div class="art-emblem"><div class="emblem-ring">${icon("shield", 76)}</div><span class="emblem-star">+</span></div><div class="art-card art-card-bottom"><span class="art-live"></span><span><strong>Report received</strong><small>Response team notified</small></span></div><span class="art-spark spark-one">✳</span><span class="art-spark spark-two">✦</span></div></section><section class="welcome-note"><span>${icon("shield", 20)}</span><p><strong>Two emergencies. One clear process.</strong><br />Use this service to report a road accident or fire outbreak. If you are in immediate danger, move to safety first.</p></section>`);
}

function renderHome() {
  shell(`<div class="page-heading"><div><div class="eyebrow">SERS PUBLIC REPORTING</div><h1>Welcome</h1><p>What would you like to do?</p></div><span class="heading-icon">${icon("shield", 28)}</span></div><button class="report-hero" data-action="start-report"><span class="report-hero-icon">${icon("file", 26)}</span><span><strong>Report an emergency</strong><small>Share what happened and your location</small></span><span class="report-hero-arrow">${icon("arrow", 22)}</span></button><div class="home-grid"><section class="panel"><div class="panel-heading"><div><h2>Supported emergencies</h2><p>Choose one when you make a report.</p></div></div><div class="supported-list"><div class="supported-item road-item"><span>${icon("road", 23)}</span><div><strong>Road accident</strong><small>Collision, vehicle crash or road incident</small></div></div><div class="supported-item fire-item"><span>${icon("fire", 23)}</span><div><strong>Fire outbreak</strong><small>Building, vehicle or outdoor fire</small></div></div></div></section><section class="panel how-panel"><div class="panel-heading"><div><h2>How it works</h2><p>A few quick steps to send your report.</p></div></div><ol class="how-list"><li><span>1</span><div><strong>Choose the emergency</strong><small>Road accident or fire outbreak</small></div></li><li><span>2</span><div><strong>Describe what happened</strong><small>Add your contact and an optional photo</small></div></li><li><span>3</span><div><strong>Share your location</strong><small>Your device will ask when you submit</small></div></li></ol></section></div><div class="secondary-actions"><button class="button button-outline" data-action="reports">${icon("file", 18)} My reports</button><button class="button button-quiet" data-action="open-track">Track with reference and code ${icon("arrow", 17)}</button></div>`);
}

function renderType() {
  shell(`<div class="flow-header"><button class="back-button" data-action="home">${icon("back", 18)} Home</button><span class="step-count">STEP 1 OF 3</span></div><div class="form-wrap"><div class="eyebrow">START A REPORT</div><h1>What is happening?</h1><p class="form-intro">Select the type of emergency you are reporting.</p><div class="choice-list">${categories.map((category) => `<button class="choice-card ${state.form.category === category ? "selected" : ""}" data-category="${esc(category)}"><span class="choice-icon ${category === "Road Accident" ? "road-color" : "fire-color"}">${icon(category === "Road Accident" ? "road" : "fire", 27)}</span><span class="choice-copy"><strong>${esc(category)}</strong><small>${category === "Road Accident" ? "A vehicle collision or road incident needs attention." : "A fire is burning or creating a risk nearby."}</small></span><span class="choice-chevron">${icon("arrow", 20)}</span></button>`).join("")}</div><div class="form-actions"><button class="button button-primary" data-action="type-continue" ${state.form.category ? "" : "disabled"}>Continue ${icon("arrow", 18)}</button></div></div>`);
}

function renderDetails() {
  const f = state.form;
  shell(`<div class="flow-header"><button class="back-button" data-action="type">${icon("back", 18)} Emergency type</button><span class="step-count">STEP 2 OF 3</span></div><div class="form-wrap form-wrap-wide"><div class="selected-type"><span class="choice-icon ${f.category === "Road Accident" ? "road-color" : "fire-color"}">${icon(f.category === "Road Accident" ? "road" : "fire", 21)}</span><span><small>REPORTING</small><strong>${esc(f.category)}</strong></span><button data-action="type" aria-label="Change emergency type">Change</button></div><h1>Tell us what happened</h1><p class="form-intro">A short, clear description can help the response team prepare.</p>${state.detailsError ? `<p class="inline-error" data-details-error role="alert">${esc(state.detailsError)}</p>` : ""}<label class="field-label" for="description">Emergency description <span class="required">Required</span></label><textarea id="description" name="description" rows="4" maxlength="2000" placeholder="Describe what happened and any immediate risks…">${esc(f.description)}</textarea><div class="field-meta"><span>Share the main details. Avoid including private information about others.</span><span data-count>${f.description.length}/2,000</span></div><label class="field-label" for="reporterName">Your name <span class="required">Required</span></label><input id="reporterName" name="reporterName" maxlength="60" autocomplete="name" placeholder="Name of the person reporting" value="${esc(f.reporterName)}" /><label class="field-label" for="phone">Contact telephone <span class="required">Required</span></label><div class="input-with-icon">${icon("phone", 17)}<input id="phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" maxlength="25" placeholder="For example, +256 7XX XXX XXX" value="${esc(f.phone)}" /></div><p class="field-hint">Include the country code if you are outside Uganda.</p><label class="field-label" for="photo">Photograph <span class="optional">Optional</span></label><label class="upload-zone" for="photo"><span class="upload-icon">${icon("camera", 23)}</span><span><strong>Add a photograph</strong><small>JPG, PNG or WebP · up to 5 MB</small></span><span class="upload-browse">Choose photo</span><input id="photo" type="file" accept="image/jpeg,image/png,image/webp" /></label>${f.photoUrl ? `<div class="photo-preview"><img src="${esc(f.photoUrl)}" alt="Selected emergency photo preview"/><div><strong>${esc(f.photo?.name || "Selected photo")}</strong><small>Preview only. The photo will be sent with your report.</small></div><button data-action="remove-photo" aria-label="Remove photo">${icon("close", 17)}</button></div>` : ""}${state.photoError ? `<p class="inline-error" role="alert">${esc(state.photoError)}</p>` : ""}<div class="location-note">${icon("pin", 20)}<p><strong>Your location is captured when you submit.</strong><br />SERS will ask permission to use your device's current location. No manual location is needed.</p></div><div class="form-actions split-actions"><button class="button button-outline" data-action="type">Back</button><button class="button button-primary" data-action="details-continue">Review report ${icon("arrow", 18)}</button></div></div>`);
  const photoHint = app.querySelector(".upload-zone small");
  if (photoHint) photoHint.textContent = "JPG, PNG or WebP · up to 3 MB";
  const description = app.querySelector("#description");
  description?.addEventListener("input", (event) => {
    state.detailsError = "";
    app.querySelector("[data-details-error]")?.remove();
    state.form.description = event.target.value;
    app.querySelector("[data-count]").textContent = `${event.target.value.length}/2,000`;
  });
  app.querySelector("#reporterName")?.addEventListener("input", (event) => { state.detailsError = ""; app.querySelector("[data-details-error]")?.remove(); state.form.reporterName = event.target.value; });
  app.querySelector("#phone")?.addEventListener("input", (event) => { state.detailsError = ""; app.querySelector("[data-details-error]")?.remove(); state.form.phone = event.target.value; });
  app.querySelector("#photo")?.addEventListener("change", handlePhoto);
}

function renderReview() {
  const f = state.form;
  shell(`<div class="flow-header"><button class="back-button" data-action="details">${icon("back", 18)} Edit details</button><span class="step-count">STEP 3 OF 3</span></div><div class="form-wrap form-wrap-wide"><div class="eyebrow">FINAL CHECK</div><h1>Review your report</h1><p class="form-intro">Check these details before sending them to SERS.</p><div class="review-card"><div class="review-row"><span>Emergency type</span><strong>${esc(f.category)}</strong></div><div class="review-row review-description"><span>Description</span><p>${esc(f.description)}</p></div><div class="review-row"><span>Your name</span><strong>${esc(f.reporterName)}</strong></div><div class="review-row"><span>Contact telephone</span><strong>${esc(f.phone)}</strong></div><div class="review-row"><span>Photograph</span><strong>${f.photo ? esc(f.photo.name) : "Not attached"}</strong></div><div class="review-location">${icon("pin", 19)}<span><strong>Device location requested at submission</strong><small>Your report will not be sent if location cannot be captured.</small></span></div></div>${state.submitError ? `<p class="error-callout" role="alert">${icon("pin", 19)}<span>${esc(state.submitError)}</span></p>` : ""}<div class="privacy-note">${icon("shield", 18)} Your name and contact are stored privately for response coordination.</div><div class="form-actions split-actions"><button class="button button-outline" data-action="details" ${state.submitting ? "disabled" : ""}>Edit report</button><button class="button button-primary submit-button" data-action="submit" ${state.submitting ? "disabled" : ""}>${state.submitting ? `<span class="spinner"></span> Sending report…` : `Submit report ${icon("arrow", 18)}`}</button></div><p class="fine-print">Your current location is used only for this report. SERS does not track you in the background.</p></div>`);
}

function renderConfirmation() {
  const r = state.submitted;
  shell(`<section class="confirmation"><div class="success-mark">${icon("check", 38)}</div><div class="eyebrow success-eyebrow">REPORT SUBMITTED</div><h1>Your report has been sent.</h1><p class="confirmation-copy">SERS has saved your ${esc(r.category.toLowerCase())} report and received your location.</p><div class="confirmation-card"><div class="ref-heading"><span>Incident reference</span><strong>${esc(r.reference)}</strong></div><div class="tracking-code"><span>Private tracking code</span><strong>${esc(r.accessToken)}</strong><small>Keep this code private. It is needed with the incident reference to view report progress.</small></div><div class="confirm-meta"><div><small>Emergency type</small><strong>${esc(r.category)}</strong></div><div><small>Submitted</small><strong>${dateTime(r.submittedAt)}</strong></div></div><div class="location-received">${icon("pin", 18)} Location received</div></div>${state.localSaveError ? `<p class="inline-error" role="alert">${esc(state.localSaveError)} Copy the reference and code above.</p>` : ""}<div class="confirmation-actions"><button class="button button-primary" data-action="track-submitted">Track my report ${icon("arrow", 18)}</button><button class="button button-outline" data-action="home">Return home</button></div><p class="fine-print">${state.localSaveError ? "Keep the reference and tracking code to access the report again." : "Your reference and tracking code are also saved in My Reports on this device."}</p></section>`);
}

function renderTrack() {
  shell(`<div class="flow-header"><button class="back-button" data-action="home">${icon("back", 18)} Home</button></div><div class="form-wrap tracking-wrap"><div class="tracking-icon">${icon("file", 25)}</div><div class="eyebrow">REPORT PROGRESS</div><h1>Track a report</h1><p class="form-intro">Enter the incident reference and private tracking code shown after submission.</p><form id="trackForm"><label class="field-label" for="trackReference">Incident reference</label><input id="trackReference" name="reference" autocomplete="off" placeholder="For example, SERS-00124" required value="${esc(state.trackReference || "")}"/><label class="field-label" for="trackCode">Private tracking code</label><input id="trackCode" name="accessToken" autocomplete="off" spellcheck="false" placeholder="43-character code" required value="${esc(state.trackCode || "")}"/><p class="field-hint">A reference alone cannot reveal a report. Keep the tracking code private.</p>${state.trackError ? `<p class="inline-error" role="alert">${esc(state.trackError)}</p>` : ""}<button class="button button-primary full-button" type="submit" ${state.trackBusy ? "disabled" : ""}>${state.trackBusy ? `<span class="spinner"></span> Checking report…` : `Find report ${icon("arrow", 18)}`}</button></form><div class="track-divider"><span>or</span></div><button class="button button-outline full-button" data-action="reports">Open My Reports</button></div>`);
  app.querySelector("#trackForm")?.addEventListener("submit", handleTrackForm);
  app.querySelector("#trackReference")?.addEventListener("input", (e) => { state.trackReference = e.target.value; });
  app.querySelector("#trackCode")?.addEventListener("input", (e) => { state.trackCode = e.target.value; });
}

function renderReports() {
  const local = getSavedReports();
  const refreshed = new Map(state.refreshedReports.map((item) => [item.reference, item]));
  const cards = local.map((item) => {
    const fresh = refreshed.get(item.reference);
    const status = fresh?.status || item.status || "Refresh to check";
    return `<article class="saved-report"><button class="saved-report-main" data-open-reference="${esc(item.reference)}"><span class="saved-category-icon ${item.category === "Road Accident" ? "road-color" : "fire-color"}">${icon(item.category === "Road Accident" ? "road" : "fire", 20)}</span><span class="saved-copy"><strong>${esc(item.reference)}</strong><small>${esc(item.category)} · ${dateOnly(item.submittedAt)}</small><span class="saved-description">${esc(item.description)}</span></span><span class="status-pill status-${statusSlug(status)}">${esc(status)}</span></button><button class="forget-link" data-forget-reference="${esc(item.reference)}" title="Remove this report from this device">Remove from this device</button></article>`;
  }).join("");
  shell(`<div class="page-heading compact-heading"><div><div class="eyebrow">YOUR DEVICE</div><h1>My reports</h1><p>Reports saved on this browser.</p></div><button class="icon-button" data-action="refresh-list" aria-label="Refresh report statuses" title="Refresh statuses">${state.listBusy ? `<span class="spinner spinner-dark"></span>` : icon("clock", 20)}</button></div>${state.listError ? `<p class="inline-error" role="alert">${esc(state.listError)}</p>` : ""}<div class="reports-toolbar"><span>${local.length} saved ${local.length === 1 ? "report" : "reports"}</span><button data-action="open-track">Track with code</button></div>${cards ? `<div class="saved-reports">${cards}</div>` : `<div class="empty-reports"><div class="empty-icon">${icon("file", 27)}</div><h2>No saved reports</h2><p>Reports you submit on this device will appear here. SERS does not show demonstration records as real reports.</p><button class="button button-primary" data-action="start-report">Report an emergency ${icon("arrow", 18)}</button></div>`}<div class="reports-footnote">The private tracking code is saved only in this browser. Removing a report here does not delete the incident from SERS.</div>`);
}

function renderDetail() {
  const report = state.detail;
  if (!report) return renderTrack();
  const current = report.status;
  const currentIndex = ({ Pending: 1, Accepted: 2, Responding: 3, Resolved: 4, Cancelled: 1 })[current] ?? 1;
  const events = Array.isArray(report.events) ? report.events : [];
  const eventFor = (title) => events.find((event) => event.title === title)?.at;
  const timeForStage = [eventFor("Report submitted"), eventFor("Report received"), eventFor("Responder assigned"), eventFor("Responder responding"), eventFor("Incident resolved")];
  const timeline = stages.map((stage, index) => {
    const complete = Boolean(timeForStage[index]);
    const active = current !== "Cancelled" && index === currentIndex;
    const time = timeForStage[index];
    return `<li class="timeline-item ${complete ? "completed" : ""} ${active ? "active" : ""}"><span class="timeline-marker">${complete ? icon("check", 14) : ""}</span><div><strong>${esc(stage)}</strong><small>${time ? dateTime(time) : complete && index === 1 ? "Received by SERS" : "Waiting for update"}</small></div></li>`;
  }).join("");
  shell(`<div class="flow-header"><button class="back-button" data-action="reports">${icon("back", 18)} My reports</button><button class="refresh-link" data-action="refresh-detail">${icon("clock", 17)} Refresh status</button></div><section class="detail-head"><div class="eyebrow">LIVE REPORT STATUS</div><div class="detail-title-row"><div><h1>${esc(report.reference)}</h1><p>${esc(report.category)} · Submitted ${dateTime(report.reported_at)}</p></div><span class="status-pill status-${statusSlug(current)}">${esc(current)}</span></div></section>${current === "Cancelled" ? `<p class="cancelled-note">This incident was marked cancelled by the response team. Contact local emergency services if you still need help.</p>` : ""}<section class="detail-layout"><div class="panel progress-panel"><div class="panel-heading"><div><h2>Response progress</h2><p>Updates from the SERS response team</p></div>${state.trackBusy ? `<span class="spinner spinner-dark"></span>` : ""}</div><ol class="timeline">${timeline}</ol>${state.trackError ? `<p class="inline-error" role="alert">${esc(state.trackError)}</p>` : ""}</div><aside class="panel incident-summary"><div class="panel-heading"><div><h2>Report details</h2><p>Reference ${esc(report.reference)}</p></div></div><span class="summary-category ${report.category === "Road Accident" ? "road-color" : "fire-color"}">${icon(report.category === "Road Accident" ? "road" : "fire", 22)} ${esc(report.category)}</span><p class="summary-description">${esc(report.description)}</p><div class="summary-date">${icon("clock", 16)} Submitted ${dateTime(report.reported_at)}</div><div class="summary-location">${icon("pin", 17)} Location received with report</div></aside></section><div class="bottom-actions"><button class="button button-outline" data-action="home">Return home</button><button class="button button-primary" data-action="start-report">Report another emergency</button></div>`);
}

function dateTime(value) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("en-UG", { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}

function dateOnly(value) {
  if (!value) return "Date unavailable";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat("en-UG", { dateStyle: "medium" }).format(parsed);
}

function statusSlug(status) {
  return String(status).toLowerCase().replaceAll(" ", "-");
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("visible"), 3200);
}

function navigate(screen) {
  state.screen = screen;
  state.trackError = "";
  state.submitError = "";
  if (screen === "details") state.detailsError = "";
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function bind() {
  app.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", onAction));
  app.querySelectorAll("[data-category]").forEach((button) => button.addEventListener("click", () => {
    state.form.category = button.dataset.category;
    render();
  }));
  app.querySelectorAll("[data-open-reference]").forEach((button) => button.addEventListener("click", () => {
    const report = getSavedReports().find((item) => item.reference === button.dataset.openReference);
    if (report) void loadReport(report.reference, report.accessToken);
  }));
  app.querySelectorAll("[data-forget-reference]").forEach((button) => button.addEventListener("click", () => {
    forgetReport(button.dataset.forgetReference);
    state.refreshedReports = state.refreshedReports.filter((item) => item.reference !== button.dataset.forgetReference);
    render();
    showToast("Removed from My Reports on this device.");
  }));
}

function onAction(event) {
  const action = event.currentTarget.dataset.action;
  if (action === "home") return navigate(state.screen === "welcome" ? "welcome" : "home");
  if (action === "get-started") return navigate("home");
  if (action === "start-report") {
    if (state.form.photoUrl) URL.revokeObjectURL(state.form.photoUrl);
    state.form = emptyForm();
    return navigate("type");
  }
  if (action === "type") return navigate("type");
  if (action === "type-continue") {
    if (!state.form.category) return showToast("Choose an emergency type to continue.");
    return navigate("details");
  }
  if (action === "details") return navigate("details");
  if (action === "details-continue") return continueToReview();
  if (action === "remove-photo") {
    if (state.form.photoUrl) URL.revokeObjectURL(state.form.photoUrl);
    state.form.photo = null;
    state.form.photoUrl = "";
    state.form.photoPath = "";
    state.form.uploadTicket = null;
    state.photoError = "";
    return render();
  }
  if (action === "submit") return void submit();
  if (action === "track-submitted") {
    if (state.submitted) return void loadReport(state.submitted.reference, state.submitted.accessToken);
    return navigate("track");
  }
  if (action === "track" || action === "open-track") {
    state.trackReference = "";
    state.trackCode = "";
    return navigate("track");
  }
  if (action === "reports") {
    state.refreshedReports = [];
    navigate("reports");
    return void refreshSavedReports();
  }
  if (action === "refresh-list") return void refreshSavedReports();
  if (action === "refresh-detail" && state.detail) return void loadReport(state.detail.reference, state.detail.accessToken || state.trackCode);
}

function continueToReview() {
  state.form.description = app.querySelector("#description")?.value.trim() || "";
  state.form.reporterName = app.querySelector("#reporterName")?.value.trim() || "";
  state.form.phone = app.querySelector("#phone")?.value.trim() || "";
  if (state.form.description.length < 10) {
    state.detailsError = "Add a description of at least 10 characters.";
    render();
    app.querySelector("#description")?.focus();
    return;
  }
  if (state.form.reporterName.length < 2) {
    state.detailsError = "Enter your name so the response team can identify the reporter.";
    render();
    app.querySelector("#reporterName")?.focus();
    return;
  }
  const digits = state.form.phone.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15 || !/^\+?[0-9 ()-]+$/.test(state.form.phone)) {
    state.detailsError = "Enter a valid telephone number with 7 to 15 digits.";
    render();
    app.querySelector("#phone")?.focus();
    return;
  }
  if (!state.form.category) return navigate("type");
  state.detailsError = "";
  state.form.accessToken ||= createTrackingCode();
  navigate("review");
}

function handlePhoto(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.type) || file.size > 3 * 1024 * 1024 || file.size === 0) {
    state.photoError = "Choose a JPG, PNG or WebP image under 3 MB.";
    if (state.form.photoUrl) URL.revokeObjectURL(state.form.photoUrl);
    state.form.photo = null;
    state.form.photoUrl = "";
    state.form.photoPath = "";
    state.form.uploadTicket = null;
    render();
    return;
  }
  if (state.form.photoUrl) URL.revokeObjectURL(state.form.photoUrl);
  state.form.photo = file;
  state.form.photoUrl = URL.createObjectURL(file);
  state.form.photoPath = "";
  state.form.uploadTicket = null;
  state.photoError = "";
  render();
}

async function submit() {
  if (state.submitting) return;
  if (!isBackendConfigured()) {
    state.submitError = "SERS is not connected to its reporting database yet. The report has not been sent.";
    return render();
  }
  state.submitting = true;
  state.submitError = "";
  render();
  try {
    const location = await captureCurrentLocation();
    if (state.form.photo && !state.form.photoPath) {
      state.submitError = "Uploading your photograph securely…";
      render();
      const ticket = await createPhotoTicket(state.form.photo);
      state.form.uploadTicket = ticket.ticket;
      await uploadEvidence(state.form.photo, ticket.path);
      state.form.photoPath = ticket.path;
    }
    const result = await submitIncident({
      category: state.form.category,
      description: state.form.description,
      reporterName: state.form.reporterName,
      phone: state.form.phone,
      latitude: location.latitude,
      longitude: location.longitude,
      accessToken: state.form.accessToken,
      photoPath: state.form.photoPath || null,
    });
    const report = {
      reference: result.reference,
      accessToken: state.form.accessToken,
      category: result.category,
      description: state.form.description,
      submittedAt: result.submitted_at,
      status: result.status,
    };
    state.submitted = report;
    state.localSaveError = "";
    try {
      rememberReport(report);
    } catch (error) {
      state.localSaveError = error.message;
    }
    state.submitting = false;
    state.screen = "confirmation";
    render();
  } catch (error) {
    state.submitError = error.message || "The report could not be confirmed as saved. Retry when the connection and location are available.";
    state.submitting = false;
    render();
  }
}

async function handleTrackForm(event) {
  event.preventDefault();
  state.trackReference = app.querySelector("#trackReference").value.trim().toUpperCase();
  state.trackCode = app.querySelector("#trackCode").value.trim();
  if (!state.trackReference || !state.trackCode) {
    state.trackError = "Enter both the incident reference and private tracking code.";
    return render();
  }
  await loadReport(state.trackReference, state.trackCode);
}

async function loadReport(reference, accessToken) {
  const previousScreen = state.screen;
  state.trackBusy = true;
  state.trackError = "";
  state.trackReference = reference;
  state.trackCode = accessToken;
  render();
  try {
    const result = await trackReport(reference, accessToken);
    state.detail = { ...result, accessToken };
    state.trackBusy = false;
    state.screen = "detail";
    state.refreshedReports = state.refreshedReports.filter((item) => item.reference !== result.reference);
    state.refreshedReports.push(result);
    updateSavedStatus(result);
    render();
  } catch (error) {
    state.trackBusy = false;
    if (previousScreen === "reports") {
      state.listError = error.message || "Could not refresh report status.";
      state.screen = "reports";
    } else {
      state.trackError = error.message || "Could not refresh report status.";
      state.screen = previousScreen === "detail" ? "detail" : "track";
    }
    render();
  }
}

function updateSavedStatus(result) {
  const saved = getSavedReports().find((item) => item.reference === result.reference);
  if (saved) {
    saved.status = result.status;
    try {
      localStorage.setItem("sers-public-reports-v1", JSON.stringify([saved, ...getSavedReports().filter((item) => item.reference !== saved.reference)]));
    } catch { /* The report still remains available for this session. */ }
  }
}

async function refreshSavedReports() {
  const saved = getSavedReports();
  if (!saved.length) return render();
  state.listBusy = true;
  state.listError = "";
  state.refreshedReports = [];
  render();
  const results = await Promise.all(saved.map(async (item) => {
    try { return await trackReport(item.reference, item.accessToken); }
    catch { return null; }
  }));
  state.refreshedReports = results.filter(Boolean);
  state.listBusy = false;
  if (!state.refreshedReports.length && saved.length) {
    state.listError = "Could not refresh report statuses. Check your connection and try again.";
  } else if (state.refreshedReports.length < saved.length) {
    state.listError = "Some reports could not be refreshed. Retry when you have a connection.";
  }
  state.refreshedReports.forEach(updateSavedStatus);
  render();
}

render();
