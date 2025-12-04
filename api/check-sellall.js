// api/check-sellall.js
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const username =
    (req.query.username || req.query.user || "").toString().trim();

  if (!username) {
    return res.status(400).json({ ok: false, error: "missing_username" });
  }

  const channelId = process.env.DISCORD_CHANNEL_ID;
  const botToken  = process.env.DISCORD_BOT_TOKEN;
  const ttlSec    = Number(process.env.SELL_TTL_SECONDS || "60");

  if (!channelId || !botToken) {
    return res
      .status(500)
      .json({ ok: false, error: "missing_bot_or_channel" });
  }

  try {
    // Lấy 50 tin nhắn gần nhất trong channel SellAll
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
      return res.status(500).json({ ok: false, error: "discord_error" });
    }

    const messages = await resp.json();
    const now = Date.now();

    const target = `.sellall ${username.toLowerCase()}`;
    let shouldSell = false;
    const toDelete = [];

    for (const m of messages) {
      if (!m || !m.id || !m.timestamp) continue;

      const created = new Date(m.timestamp).getTime();
      const ageSec = (now - created) / 1000;

      // Quá 60s => dọn rác
      if (ageSec > ttlSec) {
        toDelete.push(m.id);
        continue;
      }

      // Còn trong TTL => check nội dung
      if (!shouldSell && typeof m.content === "string") {
        const content = m.content.toLowerCase().trim();
        if (content === target) {
          // Có ít nhất 1 lệnh còn hạn cho username này
          shouldSell = true;
          // KHÔNG xoá. Giữ đến hết 60s rồi lần sau sẽ bị dọn.
        }
      }
    }

    // Dọn tin nhắn hết hạn (> TTL)
    if (toDelete.length > 0) {
      Promise.allSettled(
        toDelete.map((id) =>
          fetch(
            `https://discord.com/api/v10/channels/${channelId}/messages/${id}`,
            {
              method: "DELETE",
              headers: {
                Authorization: `Bot ${botToken}`,
              },
            }
          )
        )
      ).catch(() => {});
    }

    return res.json({ ok: true, shouldSell });
  } catch (err) {
    console.error("check-sellall error:", err);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
}
