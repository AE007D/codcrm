import express from "express";
import cors from "cors";
import QRCode from "qrcode";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { Client, LocalAuth, Poll, MessageMedia } = require("whatsapp-web.js");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE_FILE = path.join(__dirname, "conversations.json");

const app = express();
app.use(cors());
app.use(express.json());

/* ── Conversation store ── */
const MAX_MSGS = 200;
let conversations = {};
try {
  if (fs.existsSync(STORE_FILE))
    conversations = JSON.parse(fs.readFileSync(STORE_FILE, "utf8"));
} catch { conversations = {}; }

let saveTimer = null;
function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try { fs.writeFileSync(STORE_FILE, JSON.stringify(conversations)); } catch {}
  }, 1000);
}

function normalizePhone(raw) {
  // Strip JID suffix (@c.us, @lid, @s.whatsapp.net, etc.) first
  let p = (raw ?? "").split("@")[0];
  // Strip device ID (e.g. "212644587812:5" → "212644587812")
  p = p.split(":")[0];
  // Remove formatting chars
  p = p.replace(/[\s\-().+]/g, "");
  if (p.startsWith("00")) p = p.slice(2);
  if (p.startsWith("0")) return "212" + p.slice(1);
  return p;
}

function storeMessage(phone, msg) {
  const key = normalizePhone(phone);
  if (!conversations[key]) conversations[key] = [];
  if (msg.id && conversations[key].some(m => m.id === msg.id)) return;
  conversations[key].push(msg);
  if (conversations[key].length > MAX_MSGS) conversations[key].shift();
  scheduleSave();
}

/* ── Pending confirmations: phone → { orderId, crmUrl, apiToken, pollMsgId } ── */
const pendingConfirmations = {};
const pendingByPollId = {}; // pollMsgId → phone

function isConfirmText(text) {
  return /^(1|👍|نعم|yes|oui|confirm|تأكيد|ok|موافق)$/i.test((text ?? "").trim());
}
function isCancelText(text) {
  return /^(2|👎|لا|no|non|annul|إلغاء|cancel)$/i.test((text ?? "").trim());
}

async function notifyCRM(crmUrl, apiToken, orderId, newStatus) {
  try {
    const r = await fetch(`${crmUrl}/api/wa-confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-wa-token": apiToken },
      body: JSON.stringify({ id: orderId, status: newStatus }),
    });
    const data = await r.json().catch(() => ({}));
    console.log(`[WA] Order ${orderId} → ${newStatus} (${r.status})`, data.shipped ? "[SHIPPED - no change]" : "");
    return data; // { ok, shipped? }
  } catch (err) {
    console.error("[WA] CRM notify error:", err.message);
    return {};
  }
}

/* ── WhatsApp client ── */
let status = "disconnected";
let qrBase64 = null;
let connectedJid = null;

function createClient() {
  return new Client({
    authStrategy: new LocalAuth({ dataPath: path.join(__dirname, "auth_info_wwjs") }),
    puppeteer: {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--single-process",
        "--disable-extensions",
      ],
    },
  });
}

let client = createClient();
let restarting = false;
let everConnected = false; // true once we've had a successful connection

async function restartClient(reason) {
  if (restarting) return;
  // If we've never connected and we're just waiting for QR, don't restart on disconnect
  if (!everConnected && status === "qr") {
    console.log("[WA] Skipping restart — waiting for QR scan");
    return;
  }
  restarting = true;
  status = "disconnected";
  connectedJid = null;
  qrBase64 = null;
  console.log(`[WA] Restarting — reason: ${reason}`);
  try { await client.destroy(); } catch {}
  await new Promise(r => setTimeout(r, 4000));
  client = createClient();
  attachClientEvents();
  try { await client.initialize(); } catch (e) { console.error("[WA] init error:", e.message); }
  restarting = false;
}

function attachClientEvents() {
  client.on("qr", async (qr) => {
    status = "qr";
    qrBase64 = await QRCode.toDataURL(qr);
    console.log("[WA] QR ready — scan in CRM");
  });

  client.on("ready", async () => {
    everConnected = true;
    status = "connected";
    qrBase64 = null;
    connectedJid = client.info?.wid?.user ?? null;
    console.log("[WA] Connected as", connectedJid);
    // Build LID → phone map from all contacts
    try {
      const contacts = await client.getContacts();
      // Step 1: map pushname → phone from @c.us contacts
      const nameToPhone = {};
      for (const c of contacts) {
        const jid = c.id?._serialized ?? "";
        if (!jid.includes("@lid") && c.number && c.pushname) {
          nameToPhone[c.pushname.trim().toLowerCase()] = normalizePhone(c.number);
        }
      }
      // Step 2: for @lid contacts, resolve via id.user or pushname
      for (const c of contacts) {
        const jid = c.id?._serialized ?? "";
        const lidUser = c.id?.user ?? "";
        if (!jid.includes("@lid")) continue;
        // Best: id.user contains the real phone
        if (c.id?.user && c.id.user !== lidUser.replace(/\D/g, "") && c.id.user.length > 5) {
          // This won't help since lidUser IS c.id.user — skip this path
        }
        // Use pushname matching
        if (c.pushname) {
          const realPhone = nameToPhone[c.pushname.trim().toLowerCase()];
          if (realPhone) lidCache[jid] = realPhone;
        }
      }
      console.log(`[WA] LID cache built: ${Object.keys(lidCache).length} entries`);
    } catch (e) {
      console.error("[WA] getContacts error:", e.message);
    }
  });

  client.on("disconnected", (reason) => {
    console.log("[WA] Disconnected:", reason);
    restartClient(reason);
  });

  client.on("message", handleIncomingMessage);
  client.on("vote_update", handleVoteUpdate);
}

// Catch unhandled Puppeteer / frame errors globally
process.on("unhandledRejection", (reason) => {
  const msg = String(reason?.message ?? reason);
  if (msg.includes("detached Frame") || msg.includes("Session closed") || msg.includes("Target closed") || msg.includes("Protocol error")) {
    console.error("[WA] Puppeteer crash detected:", msg.slice(0, 120));
    restartClient("puppeteer-crash");
  } else {
    console.error("[WA] Unhandled rejection:", msg.slice(0, 200));
  }
});

/* ── LID → phone cache ── */
const lidCache = {};

async function resolvePhone(msg) {
  const raw = msg.from ?? "";
  // If it's a @lid JID, resolve to real phone via contact lookup
  if (raw.includes("@lid")) {
    const cached = lidCache[raw];
    if (cached) return cached;
    try {
      const contact = await msg.getContact();
      console.log(`[WA] LID contact: jid=${raw} number="${contact.number}" name="${contact.pushname}" user="${contact.id?.user}"`);
      let realPhone = "";

      const lidUser = raw.split("@")[0];
      // Try 1: contact.id.user (often contains real phone for LID contacts)
      if (contact.id?.user && contact.id.user !== lidUser) {
        realPhone = normalizePhone(contact.id.user);
      }
      // Try 2: contact.number (if different from LID)
      if (!realPhone && contact.number && contact.number !== lidUser && contact.number.length > 5) {
        realPhone = normalizePhone(contact.number);
      }

      // Try 2: get chat and check contact
      if (!realPhone) {
        try {
          const chat = await client.getChatById(raw);
          const chatContact = chat?.contact;
          console.log(`[WA] LID chat contact: number="${chatContact?.number}" name="${chatContact?.pushname}"`);
          if (chatContact?.number && chatContact.number !== lidUser) {
            realPhone = normalizePhone(chatContact.number);
          }
        } catch {}
      }

      // Try 3: match by pushname against existing conversations
      if (!realPhone && contact.pushname) {
        // Check if any existing conversation has same notifyName
        for (const [phone, msgs] of Object.entries(conversations)) {
          if (phone.includes("lid")) continue;
          const arr = Array.isArray(msgs) ? msgs : [];
          const hasName = arr.some(m => m.notifyName?.toLowerCase() === contact.pushname.toLowerCase());
          if (hasName) { realPhone = phone; break; }
        }
      }

      // Try 4: match by pushname against all @c.us contacts
      if (!realPhone && contact.pushname) {
        try {
          const allContacts = await client.getContacts();
          const match = allContacts.find(c =>
            !c.id?._serialized?.includes("@lid") &&
            c.pushname?.trim().toLowerCase() === contact.pushname.trim().toLowerCase() &&
            c.number
          );
          if (match) {
            realPhone = normalizePhone(match.number);
            console.log(`[WA] LID resolved by name "${contact.pushname}" → ${realPhone}`);
          }
        } catch {}
      }

      if (realPhone) {
        lidCache[raw] = realPhone;
        return realPhone;
      }
    } catch (e) {
      console.error("[WA] LID resolve error:", e.message);
    }
    // Last resort: use the LID number as-is
    return normalizePhone(raw);
  }
  return normalizePhone(raw);
}

/* ── Named event handlers (re-attached on restart) ── */
async function handleIncomingMessage(msg) {
  if (msg.isGroupMsg) return;
  const phone = await resolvePhone(msg);
  const text = (msg.body ?? "").trim();

  let mediaData = null;
  if (msg.hasMedia) {
    try {
      const media = await msg.downloadMedia();
      if (media) mediaData = { mimetype: media.mimetype, data: media.data };
    } catch (e) { console.error("[WA] media download error:", e.message); }
  }

  const notifyName = msg._data?.notifyName ?? msg.notifyName ?? null;
  storeMessage(phone, {
    id: msg.id?.id ?? String(Date.now()),
    from: phone,
    text: text || (mediaData ? "" : "[message]"),
    media: mediaData,
    ts: (msg.timestamp ?? 0) * 1000 || Date.now(),
    fromMe: false,
    notifyName,
  });
  // Store sender name in conversation metadata
  if (notifyName && !conversations[phone]?._name) {
    if (!conversations[phone]) conversations[phone] = [];
    conversations[phone]._name = notifyName;
    scheduleSave();
  }

  console.log(`[WA] msg from=${phone} text="${text.slice(0, 60)}"`);

  if (pendingConfirmations[phone]) {
    const pending = pendingConfirmations[phone];
    let newStatus = null;
    if (isConfirmText(text)) newStatus = "confirmé";
    else if (isCancelText(text)) newStatus = "annulé";
    if (newStatus) {
      const result = await notifyCRM(pending.crmUrl, pending.apiToken, pending.orderId, newStatus);
      if (result?.shipped) {
        await msg.reply("📦 طلبكم في الطريق إليكم بالفعل ولا يمكن إلغاؤه.\n\nVotre commande est déjà expédiée, annulation impossible.");
      } else if (newStatus === "confirmé") {
        await msg.reply("✅ شكراً! تم تأكيد طلبكم بنجاح 🚚\n\nMerci ! Commande confirmée ✅");
      } else {
        await msg.reply("❌ تم إلغاء طلبكم. شكراً 🙏\n\nCommande annulée.");
      }
    }
  }
}

async function handleVoteUpdate(vote) {
  try {
    const pollMsgId = vote.parentMessage?.id?.id ?? vote.parentMessage?._serialized;
    const voterRaw = vote.voter ?? "";
    const voterPhone = lidCache[voterRaw] ?? normalizePhone(voterRaw);
    console.log(`[WA] vote pollId=${pollMsgId} voter=${voterPhone} selected=${JSON.stringify(vote.selectedOptions)}`);

    const phone = pendingByPollId[pollMsgId] ?? voterPhone;
    if (!phone || !pendingConfirmations[phone]) return;

    const pending = pendingConfirmations[phone];
    const selected = vote.selectedOptions?.map(o => o.name ?? o) ?? [];
    const confirmed = selected.some(s => String(s).includes("✅") || String(s).includes("نعم"));
    const cancelled = selected.some(s => String(s).includes("❌") || String(s).includes("لا"));

    if (!confirmed && !cancelled) return;

    const newStatus = confirmed ? "confirmé" : "annulé";
    const result = await notifyCRM(pending.crmUrl, pending.apiToken, pending.orderId, newStatus);

    let replyText;
    if (result?.shipped) {
      replyText = "📦 طلبكم في الطريق إليكم بالفعل ولا يمكن إلغاؤه.\n\nVotre commande est déjà expédiée et ne peut pas être annulée.";
    } else if (confirmed) {
      replyText = "✅ شكراً! تم تأكيد طلبكم بنجاح 🚚\n\nMerci ! Commande confirmée ✅";
    } else {
      replyText = "❌ تم إلغاء طلبكم. شكراً 🙏\n\nCommande annulée.";
    }

    await client.sendMessage(phone + "@c.us", replyText);
    storeMessage(phone, { id: "auto-" + Date.now(), from: "me", text: replyText, ts: Date.now(), fromMe: true });
  } catch (e) {
    console.error("[WA] vote_update error:", e.message);
  }
}

attachClientEvents();
client.initialize();

/* ── API ── */

app.get("/status", (req, res) => {
  res.json({ status, jid: connectedJid, qr: qrBase64 });
});

app.get("/conversations", (req, res) => {
  const list = Object.entries(conversations).map(([phone, msgs]) => {
    const msgArray = Array.isArray(msgs) ? msgs : [];
    const name = msgs._name ?? msgArray.find(m => m.notifyName)?.notifyName ?? null;
    return {
      phone,
      name,
      lastMsg: msgArray[msgArray.length - 1] ?? null,
      unread: msgArray.filter(m => !m.fromMe).length,
    };
  });
  list.sort((a, b) => (b.lastMsg?.ts ?? 0) - (a.lastMsg?.ts ?? 0));
  res.json(list);
});

app.get("/messages/:phone", (req, res) => {
  const key = normalizePhone(req.params.phone);
  res.json(conversations[key] ?? []);
});

app.post("/send", async (req, res) => {
  const { phone, message } = req.body;
  if (!phone || !message) return res.status(400).json({ ok: false, error: "phone and message required" });
  if (status !== "connected") return res.status(503).json({ ok: false, error: "WhatsApp not connected" });
  try {
    const norm = normalizePhone(phone);
    await client.sendMessage(norm + "@c.us", message);
    storeMessage(norm, { id: "out-" + Date.now(), from: "me", text: message, ts: Date.now(), fromMe: true });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

app.post("/send-media", async (req, res) => {
  const { phone, mimetype, data, caption } = req.body;
  if (!phone || !mimetype || !data) return res.status(400).json({ ok: false, error: "phone, mimetype, data required" });
  if (status !== "connected") return res.status(503).json({ ok: false, error: "WhatsApp not connected" });
  try {
    const norm = normalizePhone(phone);
    const media = new MessageMedia(mimetype, data, "image");
    await client.sendMessage(norm + "@c.us", media, { caption: caption || "" });
    storeMessage(norm, {
      id: "out-" + Date.now(), from: "me",
      text: caption || "",
      media: { mimetype, data },
      ts: Date.now(), fromMe: true,
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

app.post("/send-confirm", async (req, res) => {
  const { phone, bodyText, orderId, crmUrl, apiToken } = req.body;
  if (!phone || !bodyText || !orderId) return res.status(400).json({ ok: false, error: "phone, bodyText, orderId required" });
  if (status !== "connected") return res.status(503).json({ ok: false, error: "WhatsApp not connected" });
  try {
    const norm = normalizePhone(phone);
    const jid = norm + "@c.us";

    // Send info text
    await client.sendMessage(jid, bodyText);
    storeMessage(norm, { id: "out-" + Date.now(), from: "me", text: bodyText, ts: Date.now(), fromMe: true });

    // Send native WhatsApp poll
    const poll = new Poll(
      "هل تريد تأكيد طلبكم؟ / Confirmer la commande ?",
      ["✅ نعم / Oui", "❌ لا / Non"],
      { allowMultipleAnswers: false }
    );
    const pollMsg = await client.sendMessage(jid, poll);
    const pollMsgId = pollMsg?.id?.id ?? pollMsg?._data?.id?.id ?? null;
    console.log(`[WA] poll sent pollMsgId=${pollMsgId}`);

    const pending = { orderId, crmUrl: crmUrl || "http://localhost:3000", apiToken: apiToken || "", pollMsgId };
    pendingConfirmations[norm] = pending;
    if (pollMsgId) pendingByPollId[pollMsgId] = norm;

    setTimeout(() => {
      delete pendingConfirmations[norm];
      if (pollMsgId) delete pendingByPollId[pollMsgId];
    }, 24 * 60 * 60 * 1000);

    res.json({ ok: true, pending: true });
  } catch (err) {
    console.error("[WA] send-confirm error:", err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

app.get("/pending", (req, res) => {
  res.json(Object.keys(pendingConfirmations));
});

app.post("/logout", async (req, res) => {
  status = "disconnected"; qrBase64 = null; connectedJid = null;
  res.json({ ok: true });
  // Destroy client and wipe saved session so next init always shows a fresh QR
  try { await client.destroy(); } catch {}
  const authDir = path.join(__dirname, "auth_info_wwjs");
  try { fs.rmSync(authDir, { recursive: true, force: true }); } catch {}
  setTimeout(() => restartClient("logout"), 1000);
});

app.listen(3001, "0.0.0.0", () => console.log("[WA] Server running on :3001"));

/* ── Auto-confirm scheduler ── */
const CRM_URL = process.env.CRM_URL ?? "http://127.0.0.1:3000";
const WA_API_TOKEN = process.env.WA_INTERNAL_TOKEN ?? "codcrm-wa-secret-2024";

// Track order IDs we've already sent confirmations to (persisted to disk)
const SENT_FILE = path.join(__dirname, "sent_confirms.json");
let sentConfirms = new Set();
try {
  if (fs.existsSync(SENT_FILE)) {
    const arr = JSON.parse(fs.readFileSync(SENT_FILE, "utf8"));
    sentConfirms = new Set(arr);
  }
} catch {}

function saveSentConfirms() {
  try {
    const arr = [...sentConfirms].slice(-5000); // keep last 5000
    fs.writeFileSync(SENT_FILE, JSON.stringify(arr));
  } catch {}
}

function buildAutoMsg(lang, order, templates) {
  const tpl = templates?.confirm?.[lang];
  if (tpl) {
    return tpl
      .replace(/\{\{name\}\}/g, order.customer)
      .replace(/\{\{product\}\}/g, order.product)
      .replace(/\{\{amount\}\}/g, String(order.amount))
      .replace(/\{\{currency\}\}/g, order.currency)
      .replace(/\{\{city\}\}/g, order.city);
  }
  if (lang === "fr") {
    return `Bonjour ${order.customer} 👋\n\nVous avez une nouvelle commande en attente :\n\n📦 *${order.product}*\n💵 *${order.amount} ${order.currency}*\n📍 *${order.city}*\n\nSouhaitez-vous confirmer ?`;
  }
  return `السلام عليكم ${order.customer} 👋\n\nلديكم طلب جديد في انتظار التأكيد:\n\n📦 المنتج : *${order.product}*\n💵 المبلغ : *${order.amount} ${order.currency}*\n📍 المدينة : *${order.city}*\n\nهل تريد تأكيد هذا الطلب؟`;
}

async function runAutoCheck() {
  if (status !== "connected") return;
  try {
    const r = await fetch(`${CRM_URL}/api/wa-auto-check`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-wa-token": WA_API_TOKEN },
      body: "{}",
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return;
    const d = await r.json().catch(() => ({}));
    const workspaces = d.workspaces ?? [];

    for (const ws of workspaces) {
      for (const order of ws.orders ?? []) {
        if (sentConfirms.has(order.id)) continue;
        const msg = buildAutoMsg(ws.lang, order, ws.templates);
        try {
          const jid = normalizePhone(order.phone) + "@c.us";
          await client.sendMessage(jid, msg);
          storeMessage(normalizePhone(order.phone), { id: "auto-" + Date.now(), from: "me", text: msg, ts: Date.now(), fromMe: true });

          const poll = new Poll(
            "هل تريد تأكيد طلبكم؟ / Confirmer la commande ?",
            ["✅ نعم / Oui", "❌ لا / Non"],
            { allowMultipleAnswers: false }
          );
          const pollMsg = await client.sendMessage(jid, poll);
          const pollMsgId = pollMsg?.id?.id ?? null;

          const pending = { orderId: order.id, crmUrl: CRM_URL, apiToken: WA_API_TOKEN, pollMsgId };
          const norm = normalizePhone(order.phone);
          pendingConfirmations[norm] = pending;
          if (pollMsgId) pendingByPollId[pollMsgId] = norm;

          sentConfirms.add(order.id);
          saveSentConfirms();
          console.log(`[WA Auto] Confirm sent → ${order.phone} order=${order.id}`);
        } catch (e) {
          console.error("[WA Auto] send error:", e.message);
        }
      }
    }
  } catch (e) {
    // CRM not ready — silent
  }
}

setInterval(runAutoCheck, 60_000);
