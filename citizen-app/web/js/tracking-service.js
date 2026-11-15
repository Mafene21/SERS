const config = window.SERS_CONFIG || {};
const STORAGE_KEY = "sers-public-reports-v1";

export function getSavedReports() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(value)
      ? value.filter((item) => item && typeof item.reference === "string" && typeof item.accessToken === "string")
      : [];
  } catch {
    return [];
  }
}

export function rememberReport(report) {
  const saved = getSavedReports().filter((item) => item.reference !== report.reference);
  saved.unshift({
    reference: report.reference,
    accessToken: report.accessToken,
    category: report.category,
    description: report.description,
    submittedAt: report.submittedAt,
    status: report.status || "Pending",
  });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved.slice(0, 30)));
  } catch {
    throw new Error("The report was submitted, but this browser could not save it to My Reports. Keep the reference and tracking code shown here.");
  }
}

export function forgetReport(reference) {
  const remaining = getSavedReports().filter((item) => item.reference !== reference);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
}

export async function trackReport(reference, accessToken) {
  if (!config.supabaseUrl || !config.publishableKey) {
    throw new Error("SERS is not connected to its reporting database yet. Ask the project administrator to configure it.");
  }
  let response;
  try {
    response = await fetch(`${config.supabaseUrl}/rest/v1/rpc/sers_track_public_report`, {
      method: "POST",
      cache: "no-store",
      headers: {
        apikey: config.publishableKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_reference: reference.trim().toUpperCase(), p_access_token: accessToken.trim() }),
    });
  } catch {
    throw new Error("Could not reach SERS. Check your internet connection and retry.");
  }
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    if (result?.message === "Report not found or tracking details are incorrect.") {
      throw new Error(result.message);
    }
    throw new Error("SERS could not refresh this report. Check your connection and retry.");
  }
  return result;
}
