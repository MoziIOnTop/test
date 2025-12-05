// api/sellall-dispatch.js
// Nhận { content } từ Railway A, forward sang Discord webhook thật

const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  if (!WEBHOOK_URL) {
    console.error("[VERCEL] Missing DISCORD_WEBHOOK_URL env");
    return res.status(500).json({ ok: false, error: "missing_webhook" });
  }

  const body = req.body || {};
  const content = (body.content || "").trim();

  if (!content) {
    return res.status(400).json({ ok: false, error: "missing_content" });
  }

  try {
    const resp = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error("[VERCEL] Discord webhook error", resp.status, text);
      return res
        .status(500)
        .json({ ok: false, error: "discord_error", status: resp.status });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[VERCEL] Unexpected error:", err);
    return res.status(500).json({ ok: false, error: "exception" });
  }
}
