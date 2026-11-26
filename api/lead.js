// api/lead.js: receives the visitor's name and phone from the menu and forwards them to your Telegram bot.
// The bot token stays here on the server (Vercel Environment Variables), never in the public page.
const recent = new Map();   // phone -> time of the last entry (best-effort protection against repeats and floods)
let windowStart = 0, windowCount = 0;

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ ok: false });

  // Only requests coming from this same website are accepted.
  const origin = req.headers.origin;
  if (origin && new URL(origin).host !== req.headers.host) return res.status(403).json({ ok: false });

  let d = req.body;
  if (typeof d === "string") { try { d = JSON.parse(d); } catch (e) { d = null; } }
  const clean = (v, n) => String(v || "").replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
  const name = clean(d && d.name, 60);
  const phone = String((d && d.phone) || "").replace(/[^\d+]/g, "").slice(0, 16);
  if (name.length < 2 || !/^\+?\d{8,15}$/.test(phone)) return res.status(400).json({ ok: false });

  const now = Date.now();
  if (now - windowStart > 60000) { windowStart = now; windowCount = 0; }
  if (++windowCount > 60 || now - (recent.get(phone) || 0) < 60000) return res.status(429).json({ ok: false });
  recent.set(phone, now);
  if (recent.size > 500) recent.clear();

  const { TELEGRAM_BOT_TOKEN: token, TELEGRAM_CHAT_ID: chat } = process.env;
  if (!token || !chat) return res.status(500).json({ ok: false });
  try {
    const r = await fetch("https://api.telegram.org/bot" + token + "/sendMessage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text: "New customer\nName: " + name + "\nPhone: " + phone }),
    });
    return res.status(r.ok ? 200 : 502).json({ ok: r.ok });
  } catch (e) {
    return res.status(502).json({ ok: false });
  }
};
