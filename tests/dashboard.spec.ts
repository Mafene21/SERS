import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // Functional tests avoid third-party tile downloads. Geographic positions and
  // marker interactions still render; map networking is checked separately.
  await page.route("https://tile.openstreetmap.org/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jDe0AAAAASUVORK5CYII=",
        "base64",
      ),
    }),
  );
});

test("control centre updates waiting ages and assigns from the queue", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-11-11T08:30:00Z") });
  await page.goto("/");
  const row = page.locator("tbody tr").filter({ hasText: "SERS-001" });
  await expect(row.locator(".waiting-badge")).toContainText("12 min");
  await page.clock.fastForward(120_000);
  await expect(row.locator(".waiting-badge")).toContainText("14 min");
  const readiness = page
    .locator(".stat-card")
    .filter({ hasText: "Available responders" });
  await expect(readiness.locator(".stat-value strong")).toHaveText("03");
  await page
    .getByRole("link", { name: "Assign SERS-001", exact: true })
    .click();
  await expect(page).toHaveURL(/\/incidents\/001#response-management$/);
  await page.getByLabel("Assign a responder").selectOption("road-3");
  await page
    .getByRole("button", { name: "Assign responder", exact: true })
    .click();
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await expect(readiness.locator(".stat-value strong")).toHaveText("02");
  await expect(row).toContainText("Sarah Namuli");
  await expect(
    page.locator(".team-availability-row").filter({ hasText: "Road response" }),
  ).toContainText("1 available");
});

test("responder mobile home supports location, notes, status changes, history and duty", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByLabel("Preview role").selectOption("road-1");
  await expect(
    page.getByRole("heading", { name: "My assignments", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".assignment-focus")).toHaveCount(1);
  await expect(page.locator(".assignment-focus")).toContainText(
    "Motorcycle collision",
  );
  await expect(page.locator(".leaflet-marker-icon")).toHaveCount(1);
  const nav = page.getByRole("navigation", {
    name: "Responder quick navigation",
  });
  await expect(nav).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Assign responder", exact: true }),
  ).toHaveCount(0);
  const destination = await page
    .getByRole("link", { name: /Directions to fictional/ })
    .getAttribute("href");
  expect(new URL(destination!).searchParams.get("destination")).toBe(
    "0.3395,32.5745",
  );
  await page
    .getByRole("button", { name: "Copy location", exact: true })
    .click();
  await expect(page.locator(".location-feedback")).toHaveText(
    "Coordinates copied.",
  );
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "0.33950, 32.57450",
  );
  await page.getByLabel("My availability").selectOption("Off duty");
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Complete active assignments",
  );
  await expect(page.getByLabel("My availability")).toHaveValue("On duty");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "test-results/responder-mobile-home.png",
    fullPage: true,
    animations: "disabled",
  });
  const completed = Number(
    await page.locator(".responder-stats strong").nth(1).innerText(),
  );
  await page
    .getByRole("link", { name: "Add response note", exact: true })
    .click();
  await expect(page).toHaveURL(/\/incidents\/003#response-notes$/);
  await page
    .getByLabel("Add a response note", { exact: false })
    .fill("Training update from the responder workspace.");
  await page.getByRole("button", { name: "Add note", exact: true }).click();
  await nav.getByRole("link", { name: "Assignments", exact: true }).click();
  await page
    .getByRole("button", { name: "Start responding", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Mark as resolved", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "No active assignments" }),
  ).toBeVisible();
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  await expect(page.locator(".responder-stats strong").nth(1)).toHaveText(
    String(completed + 1),
  );
  await page.getByLabel("My availability").selectOption("Off duty");
  await page.reload();
  await expect(page.getByLabel("My availability")).toHaveValue("Off duty");
  await nav.getByRole("link", { name: "History", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "My response history", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Search incidents", { exact: true }).fill("SERS-003");
  await page.getByRole("link", { name: "View SERS-003", exact: true }).click();
  await expect(page.locator(".response-note")).toContainText(
    "Training update from the responder workspace.",
  );
  await expect(page.locator(".closed-notice")).toContainText("resolved");
});

test("responder map defaults to personal assignments and history stays personal", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Preview role").selectOption("fire-1");
  await expect(page.locator(".assignment-focus")).toContainText(
    "Commercial building fire",
  );
  await page.goto("/map");
  await expect(page.getByLabel("Map scope")).toHaveValue("mine");
  await expect(page.locator(".map-incident-card")).toHaveCount(1);
  await page.getByLabel("Map scope").selectOption("team");
  await expect(page.locator(".map-incident-card")).toHaveCount(3);
  await expect(page.locator(".map-incident-list")).not.toContainText(
    "Two-vehicle collision",
  );
  await page.goto("/reports");
  await expect(
    page.getByRole("heading", { name: "My response history", exact: true }),
  ).toBeVisible();
  const names = await page
    .locator(".responder-cell strong, .responder-cell > span:last-child")
    .allTextContents();
  expect(names.length).toBeGreaterThan(0);
  expect(names.every((name) => name.includes("Nina Patel"))).toBeTruthy();
});

test("location controls handle missing coordinates and clipboard rejection", async ({
  page,
}) => {
  await page.goto("/incidents/012");
  await expect(
    page.getByText(
      "Directions and copying will be available when coordinates are confirmed.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Directions to fictional/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Copy location", exact: true }),
  ).toHaveCount(0);
  await page.goto("/incidents/003");
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error("Denied")) },
    }),
  );
  await page
    .getByRole("button", { name: "Copy location", exact: true })
    .click();
  await expect(page.locator(".location-feedback")).toContainText(
    "Copy unavailable. Select these coordinates: 0.33950, 32.57450",
  );
});

test("dashboard renders consistent records, map markers, and accessible navigation", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Incident control centre" }),
  ).toBeVisible();
  await expect(
    page.getByText("Demonstration workspace", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".stat-card")).toHaveCount(4);
  await expect(page.locator(".leaflet-marker-icon")).toHaveCount(7);
  await page.screenshot({
    path: "test-results/desktop-overview.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("link", { name: "Emergency map", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Emergency map", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Map category").selectOption("Fire Outbreak");
  await expect(page.locator(".leaflet-marker-icon")).toHaveCount(3);
  await expect(page.locator(".map-incident-card")).toHaveCount(3);
  await page.screenshot({
    path: "test-results/emergency-map.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("administrator assigns a report and responder completes the full persistent workflow", async ({
  page,
}) => {
  await page.goto("/incidents/003");
  await page
    .getByRole("button", { name: "Start responding", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Mark as resolved", exact: true })
    .click();
  await expect(page.locator(".closed-notice")).toContainText("resolved");
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await page
    .getByRole("button", { name: "Simulate incident", exact: true })
    .click();
  await page
    .getByLabel("Incident title")
    .fill("Training collision workflow test");
  await page.getByLabel("Location label").fill("Fictional road training area");
  await page
    .getByLabel("Description", { exact: true })
    .fill("A fictional collision for the full response workflow test.");
  await page.getByRole("button", { name: "Create training incident" }).click();
  await expect(
    page.getByRole("heading", { name: "Training collision workflow test" }),
  ).toBeVisible();
  await page.getByLabel("Assign a responder").selectOption("road-1");
  await page
    .getByRole("button", { name: "Assign responder", exact: true })
    .click();
  await page.getByLabel("Preview role").selectOption("road-1");
  await expect(
    page.getByRole("button", { name: "Assign responder", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Accept incident", exact: true })
    .click();
  await page
    .getByLabel("Add a response note", { exact: false })
    .fill("Training scene assessed; coordinating the response.");
  await page.getByRole("button", { name: "Add note", exact: true }).click();
  await expect(page.locator(".response-note")).toContainText(
    "Training scene assessed",
  );
  await page
    .getByRole("button", { name: "Start responding", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Mark as resolved", exact: true })
    .click();
  await page.reload();
  await expect(page.locator(".closed-notice")).toContainText("resolved");
  await expect(page.locator(".response-note")).toContainText(
    "Training scene assessed",
  );
  await expect(page.locator(".timeline-list")).toContainText(
    "Assigned to Alex Morgan",
  );
  await expect(
    page.getByRole("button", { name: "Mark as resolved", exact: true }),
  ).toHaveCount(0);
});

test("role previews restrict team records and another responder’s actions", async ({
  page,
}) => {
  await page.goto("/incidents/001");
  await page.getByLabel("Preview role").selectOption("fire-1");
  await expect(
    page.getByRole("heading", { name: "Incident unavailable" }),
  ).toBeVisible();
  await page.goto("/incidents/007");
  await expect(
    page.getByRole("heading", { name: "Small workshop fire" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start responding", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Add note", exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Preview role").selectOption("road-1");
  await expect(
    page.getByRole("heading", { name: "Incident unavailable" }),
  ).toBeVisible();
});

test("incident search, filters, pagination, and CSV download work", async ({
  page,
}) => {
  await page.goto("/incidents");
  await expect(page.locator("tbody tr")).toHaveCount(8);
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByText("Page 2 of", { exact: false })).toBeVisible();
  await page.getByLabel("Search incidents", { exact: true }).fill("workshop");
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await page.getByLabel("Filter by category").selectOption("Road Accident");
  await expect(
    page.getByRole("heading", { name: "No incidents found" }),
  ).toBeVisible();
  await page.getByLabel("Filter by category").selectOption("");
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await page.getByLabel("Filter by status").selectOption("Cancelled");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("sers-training-incidents.csv");
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const csv = Buffer.concat(chunks).toString("utf-8");
  expect(csv).toContain("SIMULATED DATA");
  expect(csv).toContain("Duplicate workshop report");
  expect(csv).not.toContain("Two-vehicle collision");
});

test("cancellation requires a reason and is retained in history", async ({
  page,
}) => {
  await page.goto("/incidents/001");
  await page
    .getByRole("button", { name: "Cancel incident", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirm cancellation" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "cancellation reason",
  );
  await page
    .getByLabel("Cancellation reason")
    .fill("Duplicate report confirmed in training.");
  await page.getByRole("button", { name: "Confirm cancellation" }).click();
  await expect(page.locator(".closed-notice")).toContainText("cancelled");
  await expect(page.locator(".timeline-list")).toContainText(
    "Duplicate report confirmed",
  );
  await page
    .getByRole("link", { name: "History & reports", exact: true })
    .click();
  await page.getByLabel("Search incidents", { exact: true }).fill("SERS-001");
  await expect(page.locator("tbody tr")).toHaveCount(1);
});

test("mobile navigation, dark theme, and reset work without page overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Incident control centre" }),
  ).toBeVisible();
  await expect(page.locator(".leaflet-marker-icon")).toHaveCount(7);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "test-results/mobile-overview.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await expect(page.locator("html")).toHaveClass("dark");
  await page.reload();
  await expect(page.locator("html")).toHaveClass("dark");
  await page.screenshot({
    path: "test-results/mobile-settings-dark.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Reset training workspace" }).click();
  await page
    .getByRole("button", { name: "Reset demonstration", exact: true })
    .click();
  await expect(page.locator("html")).not.toHaveClass("dark");
});

test("notifications can be read and active responders cannot go off duty", async ({
  page,
}) => {
  await page.goto("/responders");
  await expect(
    page.getByRole("heading", { name: "Response teams", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Notifications, 2 unread" }).click();
  await page
    .getByRole("button", { name: "Mark all notifications as read" })
    .click();
  await expect(
    page.getByRole("button", { name: "Notifications, 0 unread" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Notifications, 0 unread" }).click();
  await page
    .locator(".responder-card")
    .filter({ has: page.getByRole("heading", { name: "Alex Morgan" }) })
    .getByRole("button", { name: "View profile" })
    .click();
  await page
    .getByLabel("Availability", { exact: true })
    .selectOption("Off duty");
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Complete active assignments",
  );
  await expect(page.getByLabel("Availability", { exact: true })).toHaveValue(
    "On duty",
  );
  await page.getByRole("button", { name: "Deactivate demo account" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "active assignments",
  );
});
