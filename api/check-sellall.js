// api/check-sellall.js
module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ok: false, error: "method_not_allowed" }));
  }

  const query = req.query || {};
  const username = (query.username || query.user || "").toString().trim();

  if (!username) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ok: false, error: "missing_username" }));
  }

  const channelId = process.env.DISCORD_CHANNEL_ID;
  const botToken  = process.env.DISCORD_BOT_TOKEN;
  const ttlSec    = Number(process.env.SELL_TTL_SECONDS || "60");

  if (!channelId || !botToken) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({
      ok: false,
      error: "missing_bot_or_channel"
    }));
  }

  try {
    const resp = await fetch(
      `https://discord.com/api/v10/channels/${channelId}/messages?limit=50`,
      {
        headers: {
          Authorization: `Bot ${botToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      console.error("discord messages error:", resp.status, text);
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify({ ok: false, error: "discord_error" }));
    }

    const messages = await resp.json();
    const now = Date.now();
    const targetPrefix = `.sellall ${username.toLowerCase()}`;
    let sells = 0;
    const toDelete   = [];
    const toMarkUsed = [];

    for (const m of messages) {
      if (!m || !m.id || !m.timestamp) continue;

      const created = new Date(m.timestamp).getTime();
      const ageSec  = (now - created) / 1000;
      const rawContent = (m.content || "").trim();
      const content    = rawContent.toLowerCase();

      // Hết TTL -> xoá
      if (ageSec > ttlSec) {
        toDelete.push(m.id);
        continue;
      }

      // Đã USED rồi -> bỏ
      if (content.startsWith(targetPrefix) && content.includes("[used]")) {
        continue;
      }

      // Lệnh mới cho user này
      if (content === targetPrefix) {
        sells = sells + 1;
        toMarkUsed.push(m.id);
      }
    }

    // dọn rác
    if (toDelete.length > 0) {
      Promise.allSettled(
        toDelete.map((id) =>
          fetch(
            `https://discord.com/api/v10/channels/${channelId}/messages/${id}`,
            {
              method: "DELETE",
              headers: { Authorization: `Bot ${botToken}` },
            }
          )
        )
      ).catch(() => {});
    }

    // đánh dấu USED các lệnh đã dùng
    if (toMarkUsed.length > 0) {
      Promise.allSettled(
        toMarkUsed.map((id) =>
          fetch(
            `https://discord.com/api/v10/channels/${channelId}/messages/${id}`,
            {
              method: "PATCH",
              headers: {
                Authorization: `Bot ${botToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                content: `.sellall ${username} [USED]`,
              }),
            }
          )
        )
      ).catch(() => {});
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ok: true, sells }));
  } catch (err) {
    console.error("check-sellall error:", err);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ok: false, error: "internal_error" }));
  }
};
