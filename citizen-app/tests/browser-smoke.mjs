import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { chromium } from "@playwright/test";

const url = process.env.SERS_CITIZEN_URL || "http://127.0.0.1:4173";
const browserCandidates = [
  ["Chrome", process.env.SERS_TEST_CHROME || "/usr/bin/google-chrome"],
  ["Edge", process.env.SERS_TEST_EDGE || "/usr/bin/microsoft-edge"],
];

async function available(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function completeForm(page, category, withPhoto = false) {
  if (await page.locator('[data-action="get-started"]').count()) {
    await page.getByRole("button", { name: "Get started" }).click();
  }
  await page.getByRole("button", { name: "Report an emergency" }).click();
  await page.locator(`[data-category="${category}"]`).click();
  await page.getByRole("button", { name: /Continue/ }).click();
  await page.getByRole("button", { name: /Review report/ }).click();
  await page.getByRole("alert").filter({ hasText: "at least 10 characters" }).waitFor();
  await page.locator("#description").fill("Smoke test report for a roadside incident.");
  await page.getByRole("button", { name: /Review report/ }).click();
  await page.getByRole("alert").filter({ hasText: "Enter your name" }).waitFor();
  await page.locator("#reporterName").fill("Test Reporter");
  await page.getByRole("button", { name: /Review report/ }).click();
  await page.getByRole("alert").filter({ hasText: "valid telephone number" }).waitFor();
  await page.locator("#phone").fill("+256 700 123 456");
  if (withPhoto) {
    await page.locator("#photo").setInputFiles({
      name: "scene.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jDe0AAAAASUVORK5CYII=",
        "base64",
      ),
    });
    await page.locator(".photo-preview").waitFor({ state: "visible" });
  }
  await page.getByRole("button", { name: /Review report/ }).click();
  await page.getByRole("heading", { name: "Review your report" }).waitFor();
}

async function run(name, executablePath) {
  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const denied = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await denied.addInitScript(() => {
      Object.defineProperty(navigator, "geolocation", {
        configurable: true,
        value: {
          getCurrentPosition(_success, failure) {
            failure({ code: 1, PERMISSION_DENIED: 1 });
          },
        },
      });
    });
    await denied.goto(url);
    assert.equal(await denied.title(), "SERS · Emergency reporting");
    await denied.getByRole("heading", { name: "Help can start with one report." }).waitFor();
    await denied.getByRole("button", { name: "Privacy" }).click();
    await denied.getByRole("heading", { name: "Your report information" }).waitFor();
    await denied.getByText("Move to safety and call your local emergency number first.").waitFor();
    await denied.getByRole("button", { name: "Return home" }).click();
    await denied.getByRole("button", { name: "Get started" }).click();
    await denied.getByRole("heading", { name: "Welcome" }).waitFor();
    assert.equal(await denied.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    if (name === "Chrome") await denied.screenshot({ path: "/tmp/sers-citizen-home.png", fullPage: true });

    await completeForm(denied, "Fire Outbreak", true);
    await denied.getByRole("button", { name: /Submit report/ }).click();
    await denied.getByRole("alert").filter({ hasText: "needs location access" }).waitFor();
    assert.equal(await denied.getByRole("heading", { name: "Your report has been sent." }).count(), 0);
    await denied.close();

    const unavailable = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await unavailable.addInitScript(() => {
      Object.defineProperty(navigator, "geolocation", {
        configurable: true,
        value: {
          getCurrentPosition(success) {
            success({ coords: { latitude: 0.33, longitude: 32.58, accuracy: 20 } });
          },
        },
      });
    });
    await unavailable.route("**/rest/v1/rpc/sers_submit_public_report", (route) =>
      route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "Unavailable" }) }),
    );
    await unavailable.route("**/rest/v1/rpc/sers_track_public_report", (route) =>
      route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ message: "Report not found or tracking details are incorrect." }) }),
    );
    await unavailable.goto(url);
    await completeForm(unavailable, "Road Accident");
    await unavailable.getByRole("button", { name: /Submit report/ }).click();
    await unavailable.getByRole("alert").filter({ hasText: "could not complete this request" }).waitFor();
    assert.equal(await unavailable.getByRole("heading", { name: "Your report has been sent." }).count(), 0);
    await unavailable.locator('[data-action="home"]').first().click();
    await unavailable.locator('[data-action="open-track"]').click();
    await unavailable.getByRole("heading", { name: "Track a report" }).waitFor();
    await unavailable.locator("#trackReference").fill("SERS-00001");
    await unavailable.locator("#trackCode").fill("not-a-valid-private-code");
    await unavailable.getByRole("button", { name: /Find report/ }).click();
    await unavailable.getByRole("alert").filter({ hasText: "tracking details are incorrect" }).waitFor();
    await unavailable.getByRole("button", { name: "Open My Reports" }).click();
    await unavailable.getByRole("heading", { name: "No saved reports" }).waitFor();
    assert.equal(await unavailable.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await unavailable.close();
    console.log(`${name}: welcome, responsive layout, report form, photo preview, location-denial handling, failed-save handling, tracking and empty My Reports passed.`);
  } finally {
    await browser.close();
  }
}

let count = 0;
for (const [name, path] of browserCandidates) {
  if (!await available(path)) {
    console.log(`${name}: skipped; browser executable not found at ${path}.`);
    continue;
  }
  await run(name, path);
  count += 1;
}
assert.ok(count > 0, "Install Chrome or Edge, or set SERS_TEST_CHROME/SERS_TEST_EDGE.");
