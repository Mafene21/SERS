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

test("dashboard renders consistent records, map markers, and accessible navigation", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Operational overview" }),
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
    page.getByRole("heading", { name: "Operational overview" }),
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
