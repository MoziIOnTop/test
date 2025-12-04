// api/sellall-dispatch.js
module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ok: false, error: "method_not_allowed" }));
  }

  let body = "";
  for await (const chunk of req) {
    body += chunk;
  }

  let payload = {};
  try {
    payload = JSON.parse(body || "{}");
  } catch (e) {
    payload = {};
  }

  const username = (payload.user || "").trim();
  const cmd      = (payload.cmd  || "").trim().toLowerCase();

  if (!username || cmd !== "sellall") {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ok: false, error: "bad_payload" }));
  }

  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ok: false, error: "missing_webhook" }));
  }

  try {
    const resp = await fetch(webhookUrl + "?wait=true", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `.sellall ${username}`,
        allowed_mentions: { parse: [] }
      }),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      console.error("Discord webhook error", resp.status, text);
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify({
        ok: false,
        error: "discord_error",
        status: resp.status
      }));
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ok: true }));
  } catch (err) {
    console.error("sellall-dispatch exception:", err);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ok: false, error: "exception" }));
  }
};
