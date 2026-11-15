const config = window.SERS_CONFIG || {};

export function isBackendConfigured() {
  return Boolean(config.supabaseUrl && config.publishableKey);
}

async function rpc(name, params) {
  if (!isBackendConfigured()) {
    throw new Error("SERS is not connected to its reporting database yet. Ask the project administrator to configure it.");
  }
  let response;
  try {
    response = await fetch(`${config.supabaseUrl}/rest/v1/rpc/${name}`, {
      method: "POST",
      cache: "no-store",
      headers: {
        apikey: config.publishableKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });
  } catch {
    throw new Error("Could not reach SERS. Check your internet connection and retry.");
  }
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = result?.message || result?.details || "";
    const allowed = [
      "Choose Road Accident or Fire Outbreak.",
      "Enter a valid reporter name.",
      "Enter a valid telephone number.",
      "Write a description between 10 and 2,000 characters.",
      "A confirmed location is required.",
      "The photograph upload expired. Please retry the submission.",
      "The photograph could not be verified. Please choose it again.",
      "Report not found or tracking details are incorrect.",
      "Choose a supported image under 3 MB.",
    ];
    throw new Error(allowed.includes(detail) ? detail : "SERS could not complete this request. Check the connection and retry.");
  }
  return result;
}

export function createTrackingCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export async function createPhotoTicket(file) {
  const ticket = await rpc("sers_create_public_upload_ticket", {
    p_content_type: file.type,
    p_size: file.size,
  });
  return ticket;
}

async function encodeBase64(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const chunkSize = 0x8000;
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

export async function uploadEvidence(file, path) {
  try {
    await rpc("sers_store_public_evidence", {
      p_path: path,
      p_content_type: file.type,
      p_data_base64: await encodeBase64(file),
    });
  } catch {
    throw new Error("The photograph could not be uploaded. Choose it again or continue without a photograph.");
  }
}

export async function submitIncident(report) {
  return rpc("sers_submit_public_report", {
    p_category: report.category,
    p_description: report.description,
    p_reporter_name: report.reporterName,
    p_contact_phone: report.phone,
    p_latitude: report.latitude,
    p_longitude: report.longitude,
    p_access_token: report.accessToken,
    p_photo_path: report.photoPath,
  });
}
