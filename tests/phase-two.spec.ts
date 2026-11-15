import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

type Credentials = { id: string; email: string; password: string };
const path = process.env.SERS_INTEGRATION_ACCOUNTS;
const accounts = path
  ? (JSON.parse(readFileSync(path, "utf8")) as Record<
      "admin" | "road" | "fire" | "outsider",
      Credentials
    >)
  : null;
test.skip(
  !accounts,
  "Provide disposable accounts to run the real database integration suite.",
);

async function login(page: Page, account: Credentials) {
  await page.goto("/login");
  await page.getByLabel("Email address", { exact: true }).fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

test("real sessions persist shared assignments and enforce permissions", async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(180_000);
  const adminContext = await browser.newContext();
  const roadContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const fireContext = await browser.newContext();
  for (const context of [adminContext, roadContext, fireContext])
    await context.route("https://tile.openstreetmap.org/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "image/png",
        body: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jDe0AAAAASUVORK5CYII=",
          "base64",
        ),
      }),
    );
  const admin = await adminContext.newPage();
  const road = await roadContext.newPage();
  const fire = await fireContext.newPage();
  const origin = new URL(baseURL!).origin;
  const failures: string[] = [];
  [admin, road, fire].forEach((page) =>
    page.on("pageerror", (error) => failures.push(error.message)),
  );
  try {
    await login(admin, accounts!.admin);
    await expect(
      admin.getByRole("heading", { name: "Incident control centre" }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(admin.getByLabel("Preview role")).toHaveCount(0);
    const ready = await admin.request.post("/api/workspace", {
      headers: { Origin: origin },
      data: {
        command: "active",
        payload: { id: accounts!.road.id, active: true },
      },
    });
    expect(ready.ok()).toBeTruthy();
    await login(road, accounts!.road);
    await expect(
      road.getByRole("heading", { name: "My assignments", exact: true }),
    ).toBeVisible({ timeout: 30_000 });
    await road.getByLabel("My availability").selectOption("Available");
    await expect(
      road.getByText("Change saved to shared records", { exact: true }),
    ).toBeVisible();
    await login(fire, accounts!.fire);
    await expect(
      fire.getByRole("heading", { name: "My assignments", exact: true }),
    ).toBeVisible({ timeout: 30_000 });

    await admin
      .getByRole("button", { name: "Record incident", exact: true })
      .click();
    const dialog = admin.getByRole("dialog");
    await dialog
      .getByLabel("Incident title", { exact: true })
      .fill("Verification shared road incident");
    await dialog
      .getByLabel("Location label", { exact: true })
      .fill("Verification area, Kampala");
    await dialog
      .getByLabel("Description", { exact: true })
      .fill(
        "A disposable report used to verify the shared responder workflow.",
      );
    await dialog.getByLabel("Latitude", { exact: true }).fill("0.32");
    await dialog.getByLabel("Longitude", { exact: true }).fill("32.58");
    await dialog
      .getByRole("button", { name: "Save incident", exact: true })
      .click();
    await expect(
      admin.getByRole("heading", {
        name: "Verification shared road incident",
        exact: true,
      }),
    ).toBeVisible();
    const incidentURL = admin.url();
    const incidentId = new URL(incidentURL).pathname.split("/").pop()!;
    await admin
      .getByLabel("Assign a responder")
      .selectOption(accounts!.road.id);
    await admin
      .getByRole("button", { name: "Assign responder", exact: true })
      .click();
    await expect(
      admin.getByText("Assigned to Verification road", { exact: true }),
    ).toBeVisible();

    await road.reload();
    await expect(road.locator(".assignment-focus")).toContainText(
      "Verification shared road incident",
    );
    await expect(
      road.getByRole("button", { name: "Record incident", exact: true }),
    ).toHaveCount(0);
    await expect(
      road.getByRole("navigation", { name: "Responder quick navigation" }),
    ).toBeVisible();
    await road
      .getByRole("button", { name: "Accept incident", exact: true })
      .click();
    await expect(road.locator(".assignment-focus")).toContainText("Accepted");
    await road.getByRole("link", { name: /Add response note/ }).click();
    await road
      .getByLabel(/Add a response note/)
      .fill("Verification note persisted across separate browser sessions.");
    await road.getByRole("button", { name: "Add note", exact: true }).click();
    await expect(
      road
        .getByText(
          "Verification note persisted across separate browser sessions.",
          { exact: true },
        )
        .first(),
    ).toBeVisible();
    await admin.reload();
    await expect(
      admin
        .getByText(
          "Verification note persisted across separate browser sessions.",
          { exact: true },
        )
        .first(),
    ).toBeVisible();
    await fire.goto(incidentURL);
    await expect(
      fire.getByRole("heading", { name: "Incident unavailable" }),
    ).toBeVisible();
    const forbidden = await fire.request.post("/api/workspace", {
      headers: { Origin: origin },
      data: {
        command: "transition",
        payload: { id: incidentId, status: "Responding" },
      },
    });
    expect(forbidden.status()).toBe(403);
    const promote = await road.request.post("/api/workspace", {
      headers: { Origin: origin },
      data: {
        command: "approve_account",
        payload: {
          email: "unapproved@example.invalid",
          name: "Unauthorized admin",
          role: "admin",
          callsign: "",
          category: null,
        },
      },
    });
    expect(promote.status()).toBe(403);
    await road
      .getByRole("button", { name: "Start responding", exact: true })
      .click();
    await expect(
      road.getByRole("button", { name: "Mark as resolved", exact: true }),
    ).toBeVisible();
    await road
      .getByRole("button", { name: "Mark as resolved", exact: true })
      .click();
    await expect(road.locator(".detail-status-bar")).toContainText("Resolved");
    await road.reload();
    await expect(road.locator(".detail-status-bar")).toContainText("Resolved");

    await admin.goto("/responders");
    await admin
      .locator(".responder-card")
      .filter({ hasText: "Verification road" })
      .getByRole("button", { name: /View profile/ })
      .click();
    await admin
      .getByRole("button", { name: "Deactivate account", exact: true })
      .click();
    await expect(admin.getByRole("dialog")).toContainText("Inactive account");
    await road.reload();
    await expect(
      road.getByRole("heading", { name: "Workspace unavailable" }),
    ).toBeVisible();
    await expect(road.locator(".access-card [role=alert]")).toContainText(
      "inactive",
    );
    await admin.getByRole("button", { name: "Close dialog" }).click();
    await admin.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(admin).toHaveURL(/\/login$/);
    expect((await admin.request.get("/api/workspace")).status()).toBe(401);
    expect(failures).toEqual([]);
  } finally {
    await adminContext.close();
    await roadContext.close();
    await fireContext.close();
  }
});

test("unauthenticated and unapproved accounts cannot read shared data", async ({
  page,
  request,
  baseURL,
}) => {
  expect((await request.get("/api/workspace")).status()).toBe(401);
  expect(
    (
      await request.post("/api/auth", {
        headers: { Origin: "https://untrusted.example" },
        data: { action: "logout" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post("/api/auth", {
        headers: { Origin: new URL(baseURL!).origin },
        data: { action: "password", password: "LongTestPassword12345!" },
      })
    ).status(),
  ).toBe(401);
  await page.goto("/incidents");
  await expect(page).toHaveURL(/\/login$/);
  await login(page, accounts!.outsider);
  await expect(
    page.getByRole("heading", { name: "Workspace unavailable" }),
  ).toBeVisible();
  await expect(page.locator(".access-card [role=alert]")).toContainText(
    "not been approved",
  );
});

test("administrator activation links let approved staff choose a password without email", async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(120_000);
  const adminContext = await browser.newContext();
  const staffContext = await browser.newContext();
  const admin = await adminContext.newPage();
  const staff = await staffContext.newPage();
  try {
    await login(admin, accounts!.admin);
    await expect(
      admin.getByRole("heading", { name: "Incident control centre" }),
    ).toBeVisible({ timeout: 30_000 });
    await admin.goto("/responders");
    await admin
      .getByRole("button", { name: "Add account", exact: true })
      .click();
    const dialog = admin.getByRole("dialog");
    const email = accounts!.admin.email.replace(
      "-admin@",
      `-enrol-${Date.now()}@`,
    );
    await dialog
      .getByLabel("Full name", { exact: true })
      .fill("Verification invited responder");
    await dialog.getByLabel("Email address", { exact: true }).fill(email);
    await dialog.getByLabel("Call sign", { exact: true }).fill("VERIFY-INVITE");
    await dialog
      .getByRole("button", { name: "Approve account", exact: true })
      .click();
    await expect(dialog.getByRole("status")).toContainText("Account approved");
    await dialog.getByRole("button", { name: "Done", exact: true }).click();
    const row = admin
      .locator(".account-management tbody tr")
      .filter({ hasText: email });
    await row
      .getByRole("button", { name: "Activation link", exact: true })
      .click();
    await expect(
      admin.getByRole("button", { name: "Copy private link", exact: true }),
    ).toBeVisible({ timeout: 30_000 });
    const link = await admin
      .getByLabel("Private account link", { exact: true })
      .inputValue();
    await staff.goto(link);
    await expect(staff).toHaveURL(/\/recover$/);
    const password = randomUUID() + "!92";
    await staff.getByLabel("New password", { exact: true }).fill(password);
    await staff.getByLabel("Confirm password", { exact: true }).fill(password);
    await staff
      .getByRole("button", { name: "Save password", exact: true })
      .click();
    await expect(
      staff.getByRole("heading", { name: "My assignments", exact: true }),
    ).toBeVisible({ timeout: 30_000 });
    const origin = new URL(baseURL!).origin;
    const denied = await staff.request.post("/api/accounts/link", {
      headers: { Origin: origin },
      data: { accountId: accounts!.admin.id },
    });
    expect(denied.status()).toBe(403);
    await staff.goto(link);
    await expect(staff).toHaveURL(/\/login\?error=expired$/);
    await expect(staff.locator(".auth-card [role=alert]")).toContainText(
      "already used",
    );
    await login(staff, { id: "", email, password });
    await expect(
      staff.getByRole("heading", { name: "My assignments", exact: true }),
    ).toBeVisible({ timeout: 30_000 });
    await admin.getByRole("button", { name: "Close dialog" }).click();
    await admin.getByRole("button", { name: "Refresh shared records" }).click();
    await expect(row).toContainText("Activated");
  } finally {
    await adminContext.close();
    await staffContext.close();
  }
});
