/**
 * AppZed it-helpdesk (managed=true). Classify tickets, answer the routine
 * ones from a runbook, escalate the rest. Schema self-initializes.
 * Bindings: AI, DB (d1).
 */
const SCHEMA = "CREATE TABLE IF NOT EXISTS tickets (id TEXT PRIMARY KEY, requester TEXT, subject TEXT, detail TEXT, category TEXT DEFAULT 'pending', resolution TEXT, status TEXT DEFAULT 'open', created_at TEXT DEFAULT (datetime('now')))";
const MODEL = "@cf/meta/llama-3.1-8b-instruct-fp8";

const RUNBOOK = `password-reset: Have the user visit the SSO portal and click Forgot Password; confirm in the identity admin that the account is unlocked.
vpn: Confirm the client version, re-import the profile from the IT share, retry on another network.
printer: Power-cycle, re-add via system settings using the office print server name, test page.
access-request: Needs manager approval in writing; provision only listed apps with least privilege.
equipment: Check spares inventory; ship with tracking and open a return label for the old unit.`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, solution: "it-helpdesk" });
    }
    if (request.method === "POST" && url.pathname === "/tickets") {
      const body = await request.json().catch(() => null);
      if (!body || !body.subject) return bad("ticket subject is required.");
      await env.DB.exec(SCHEMA);
      let category = "other";
      let resolution = "";
      let status = "escalated";
      try {
        const out = await env.AI.run(MODEL, {
          messages: [
            { role: "system", content: `Classify the IT request into one of: password-reset, vpn, printer, access-request, equipment, other. Then answer using ONLY this runbook. First line the category. If the runbook covers it, add RESOLVED plus the steps. Otherwise add ESCALATE plus one sentence why.\n\nRUNBOOK:\n${RUNBOOK}` },
            { role: "user", content: `Subject: ${String(body.subject).slice(0, 500)}\nDetail: ${String(body.detail || "").slice(0, 2000)}` },
          ],
          max_tokens: 384,
        });
        const text = String(out.response || "");
        const first = text.split("\n")[0] || "";
        const match = first.match(/password-reset|vpn|printer|access-request|equipment|other/i);
        if (match) category = match[0].toLowerCase();
        if (/RESOLVED/i.test(text)) {
          status = "resolved";
          resolution = text.split("\n").slice(1).join("\n").replace(/^RESOLVED\s*/i, "");
        } else {
          resolution = text.split("\n").slice(1).join("\n").replace(/^ESCALATE\s*/i, "");
        }
      } catch (err) {
        return Response.json({ error: String((err && err.message) || err) }, { status: 502 });
      }
      const id = crypto.randomUUID();
      await env.DB.prepare(
        "INSERT INTO tickets (id, requester, subject, detail, category, resolution, status) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).bind(id, body.requester || "", body.subject, body.detail || "", category, resolution, status).run();
      return Response.json({ id, category, status, resolution }, { status: 201 });
    }
    if (request.method === "GET" && url.pathname === "/escalations") {
      await env.DB.exec(SCHEMA);
      const rows = await env.DB.prepare(
        "SELECT * FROM tickets WHERE status = 'escalated' ORDER BY created_at DESC LIMIT 50"
      ).all();
      return Response.json({ escalations: rows.results || [] });
    }
    return new Response("Not found", { status: 404 });
  },
};

function bad(message) {
  return Response.json({ error: message }, { status: 400 });
}
