// api/check-sellall.js

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const token = process.env.DISCORD_BOT_TOKEN;
  const channelId = process.env.DISCORD_CHANNEL_ID;
  const ttlSeconds = Number(process.env.SELL_TTL_SECONDS || 60);

  if (!token || !channelId) {
    return res
      .status(500)
      .json({ ok: false, error: "missing_discord_env" });
  }

  const username = (req.query.username || "").trim().toLowerCase();
  if (!username) {
    return res.status(400).json({ ok: false, error: "missing_username" });
  }

  try {
    // 1) Lấy vài tin nhắn mới nhất trong channel
    const discordResp = await fetch(
      `https://discord.com/api/v10/channels/${channelId}/messages?limit=10`,
      {
        headers: {
          Authorization: `Bot ${token}`,
        },
      }
    );

    if (!discordResp.ok) {
      const text = await discordResp.text();
      return res.status(200).json({
        ok: true,
        sells: 0,
        debug: { status: discordResp.status, body: text },
      });
    }

    const messages = await discordResp.json();
    const now = Date.now();
    let sells = 0;

    for (const msg of messages) {
      const content = (msg.content || "");
      const lower = content.toLowerCase();

      // bỏ qua message đã [USED]
      if (lower.startsWith("[used]")) continue;

      // phải có ".sellall" + username
      if (!lower.includes(".sellall")) continue;
      if (!lower.includes(username)) continue;

      // TTL 60s
      const created = new Date(msg.timestamp).getTime();
      const ageSec = (now - created) / 1000;
      if (ageSec > ttlSeconds) continue;

      // Đến đây là 1 lệnh hợp lệ -> mark USED để không dùng lần 2
      try {
        await fetch(
          `https://discord.com/api/v10/channels/${channelId}/messages/${msg.id}`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bot ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              content: `[USED] ${content}`,
            }),
          }
        );
      } catch (e) {
        // ignore lỗi edit, nhưng vẫn tính là đã sell
      }

      sells += 1;
      // mỗi message chỉ dùng 1 lần, nên break nếu muốn 1 sell / 1 lần check
      // break;
    }

    return res.status(200).json({ ok: true, sells });
  } catch (err) {
    console.error("check-sellall error:", err);
    return res.status(200).json({
      ok: true,
      sells: 0,
      debug: { error: "exception" },
    });
  }
}
