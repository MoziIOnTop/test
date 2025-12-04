// api/sellall-dispatch.js
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const { user, cmd } = req.body || {};
  const username = (user || "").trim();
  const command  = (cmd  || "").trim().toLowerCase();

  if (!username || command !== "sellall") {
    return res.status(400).json({ ok: false, error: "bad_payload" });
  }

  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    return res.status(500).json({ ok: false, error: "missing_webhook" });
  }

  const content = `.sellall ${username}`;

  try {
    await fetch(webhookUrl + "?wait=true", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content,
        allowed_mentions: { parse: [] } // không ping @everyone
      })
    });

    // Ở đây KHÔNG xoá tin nhắn.
    // Tin sẽ tồn tại <= 60s, check-sellall mới dọn.
    return res.json({ ok: true });
  } catch (err) {
    console.error("send sellall webhook error:", err);
    return res.status(500).json({ ok: false, error: "webhook_failed" });
  }
}
