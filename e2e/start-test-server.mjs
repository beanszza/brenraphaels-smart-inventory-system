import "dotenv/config";
import http from "node:http";
import { createHash, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";

const PORTAL_PORT = 3999;
const PORTAL_ORIGIN = `http://localhost:${PORTAL_PORT}`;
const APP_ORIGIN = "https://localhost:3003";
const CALLBACK_URL = `${APP_ORIGIN}/api/portal/callback`;
const SYSTEM_NAME = "IMS";
const SYSTEM_SECRET = "fake-system-secret-fake-system-secret";

const ADMIN_STAFF = {
  id: "admin-1",
  name: "Jude Nitram",
  username: "2026-ADMIN-001",
  email: "admin@localhost",
};

const MODULES = new Set([
  "Dashboard",
  "Resources & Suppliers",
  "Orders & Procurement",
  "Goods Receiving",
  "Inventory",
  "Production & Quality",
  "Stock Transfer",
]);

const codes = new Map();
const handles = new Map();

const FIXED_ISO = "2026-10-16T06:15:00.000Z";

const FIXED_NOTIFICATIONS = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    type: "stock.low",
    title: "Low stock alert",
    body: "Purple yam (ube) is below minimum stock level.",
    link: `${APP_ORIGIN}/inventory`,
    sendingApp: "IMS",
    targetApp: "IMS",
    userId: ADMIN_STAFF.id,
    createdAt: FIXED_ISO,
    readAt: null,
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    type: "po.approved",
    title: "Purchase order approved",
    body: "PO-2026-0151 has been approved for receiving.",
    link: `${APP_ORIGIN}/orders-procurement`,
    sendingApp: "IMS",
    targetApp: "IMS",
    userId: ADMIN_STAFF.id,
    createdAt: FIXED_ISO,
    readAt: FIXED_ISO,
  },
];

const FIXED_AUDIT_EVENTS = [
  {
    id: "evt-baseline-001",
    source: "IMS",
    module: "Inventory",
    action: "ims.stock_adjustment.recorded",
    outcome: "success",
    actor: { type: "user", id: ADMIN_STAFF.id, display_name: ADMIN_STAFF.name },
    target: { type: "item", id: "ITM-001", display_name: "Purple yam (ube)" },
    description: "Recorded cycle count adjustment for Purple yam (ube)",
    occurred_at: FIXED_ISO,
  },
  {
    id: "evt-baseline-002",
    source: "IMS",
    module: "Inventory",
    action: "ims.write_off.approved",
    outcome: "success",
    actor: { type: "user", id: ADMIN_STAFF.id, display_name: ADMIN_STAFF.name },
    target: { type: "write_off", id: "SWO-2026-001", display_name: "SWO-2026-001" },
    description: "Approved stock write-off SWO-2026-001",
    occurred_at: FIXED_ISO,
  },
];

function readJsonBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  res.end(body);
}

const mockServer = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", PORTAL_ORIGIN);

  // 1. Portal Handoff Endpoints
  if (url.pathname === "/logout") {
    res.writeHead(302, { Location: `${PORTAL_ORIGIN}/login` });
    res.end();
    return;
  }

  if (url.pathname === "/api/integrations/authorize") {
    const p = url.searchParams;
    const callback = p.get("redirect_uri");
    const state = p.get("state");
    const challenge = p.get("code_challenge");
    if (
      p.get("system") !== SYSTEM_NAME ||
      callback !== CALLBACK_URL ||
      !state ||
      !challenge ||
      p.get("code_challenge_method") !== "S256"
    ) {
      sendJson(res, 400, { error: "invalid_request" });
      return;
    }
    const code = randomBytes(24).toString("base64url");
    codes.set(code, { callback, state, challenge, staff: ADMIN_STAFF });
    const redirectUrl = new URL(callback);
    redirectUrl.searchParams.set("code", code);
    redirectUrl.searchParams.set("state", state);
    res.writeHead(302, { Location: redirectUrl.toString() });
    res.end();
    return;
  }

  if (url.pathname === "/api/integrations/exchange" && req.method === "POST") {
    const expected = `Basic ${Buffer.from(`${SYSTEM_NAME}:${SYSTEM_SECRET}`).toString("base64")}`;
    if (req.headers.authorization !== expected) {
      sendJson(res, 401, { error: "invalid_client" });
      return;
    }
    const body = await readJsonBody(req);
    const stored = codes.get(body.code);
    codes.delete(body.code);
    const verified =
      stored &&
      stored.callback === body.redirect_uri &&
      stored.state === body.state &&
      stored.challenge ===
        createHash("sha256").update(String(body.code_verifier)).digest("base64url");
    if (!stored || !verified) {
      sendJson(res, 400, { error: "invalid_grant" });
      return;
    }
    const handle = randomBytes(32).toString("base64url");
    handles.set(handle, stored.staff);
    sendJson(res, 200, { handle, token_type: "opaque", expires_in: 28800 });
    return;
  }

  if (url.pathname === "/api/integrations/validate" && req.method === "POST") {
    const body = await readJsonBody(req);
    const staff = handles.get(body.handle) ?? ADMIN_STAFF;
    if (!MODULES.has(body.module)) {
      sendJson(res, 403, { error: "module_not_granted" });
      return;
    }
    sendJson(res, 200, {
      active: true,
      user_id: staff.id,
      system: SYSTEM_NAME,
      module: body.module,
      staff,
    });
    return;
  }

  // 2. Gateway Notification & Audit Endpoints (deterministic baseline data)
  if (url.pathname === "/notifications/notifications/unread-count") {
    sendJson(res, 200, { unread: 0 });
    return;
  }

  if (url.pathname === "/notifications/notifications") {
    if (req.method === "POST") {
      sendJson(res, 200, { ok: true });
      return;
    }
    sendJson(res, 200, { notifications: [] });
    return;
  }

  if (url.pathname.startsWith("/notifications/notifications/") && req.method === "POST") {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (url.pathname === "/live-tickets" && req.method === "POST") {
    sendJson(res, 200, { ticket: "baseline-static-ticket" });
    return;
  }

  if (url.pathname === "/audit/events") {
    if (req.method === "POST") {
      sendJson(res, 201, { id: "evt-created" });
      return;
    }
    sendJson(res, 200, { events: FIXED_AUDIT_EVENTS, next_cursor: null });
    return;
  }

  sendJson(res, 404, { error: "not_found" });
});

mockServer.listen(PORTAL_PORT, "127.0.0.1", () => {
  console.log(`[e2e] Mock Portal & Gateway listening on ${PORTAL_ORIGIN}`);

  const env = {
    ...process.env,
    PORTAL_URL: PORTAL_ORIGIN,
    PORTAL_SYSTEM_NAME: SYSTEM_NAME,
    PORTAL_SYSTEM_SECRET: SYSTEM_SECRET,
    IMS_APP_URL: APP_ORIGIN,
    IMS_LOCAL_APP_URL: APP_ORIGIN,
    IMS_DEV_BYPASS: "false",
    IMS_GATEWAY_URL: PORTAL_ORIGIN,
    IMS_GATEWAY_CALLER_KEY: "fake-caller-key",
    IMS_GATEWAY_AUDIT_READ_CALLER_KEY: "fake-audit-read-key",
  };

  const child = spawn(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["run", "dev"],
    {
      stdio: "inherit",
      env,
      shell: process.platform === "win32",
    },
  );

  const cleanup = () => {
    mockServer.close();
    child.kill();
  };
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
  child.on("exit", (code) => {
    mockServer.close();
    process.exit(code ?? 0);
  });
});
