const Groq     = require("groq-sdk");
const nodemailer = require("nodemailer");
const https    = require("https");
const querystring = require("querystring");

const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL  = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

// ── Central LLM call ──────────────────────────────────
async function callLLM(system, messages, maxTokens = 2000) {
  const res = await client.chat.completions.create({
    model: MODEL,
    max_tokens: maxTokens,
    temperature: 0.7,
    messages: [{ role: "system", content: system }, ...messages],
  });
  return res.choices[0].message.content.trim();
}

// ── JSON parser with fallback ─────────────────────────
function parseJSON(text) {
  text = text.replace(/^```(?:json)?\s*/m, "").replace(/\s*```$/m, "").trim();
  try { return JSON.parse(text); } catch (_) {}
  const m = text.match(/\{[\s\S]*\}/);
  if (m) try { return JSON.parse(m[0]); } catch (_) {}
  throw new Error("Could not parse JSON from AI response");
}

// ── Build ERP snapshot from MongoDB ───────────────────
async function getSnapshot(models) {
  const {
    Inventory, Production, Procurement, Sales, Finance, HR
  } = models;

  const [inv, prod, proc, sales, fin, hr] = await Promise.all([
    Inventory.find(),
    Production.find(),
    Procurement.find(),
    Sales.find(),
    Finance.find(),
    HR.find(),
  ]);

  const lowStock = inv.filter(i => i.quantity <= i.reorder_point);
  const revenue  = fin.filter(f => f.type === "Revenue").reduce((s, f) => s + f.amount, 0);
  const expenses = fin.filter(f => f.type === "Expense").reduce((s, f) => s + f.amount, 0);

  return {
    total_inventory_items:   inv.length,
    inventory_value:         inv.reduce((s, i) => s + i.quantity * i.unit_cost, 0),
    low_stock_items:         lowStock.map(i => ({ name: i.name, qty: i.quantity, reorder: i.reorder_point })),
    total_revenue:           revenue,
    total_expenses:          expenses,
    net_profit:              revenue - expenses,
    open_sales_orders:       sales.filter(s => ["Pending","Processing"].includes(s.status)).length,
    active_production_orders:prod.filter(p => p.status === "In Progress").length,
    pending_purchase_orders: proc.filter(p => p.status === "Pending").length,
    total_employees:         hr.length,
    employees_on_leave:      hr.filter(e => e.status === "On Leave").length,
    // Live data for AI
    inventory_list:    inv.map(i => `${i.name}(${i.quantity}${i.unit},reorder@${i.reorder_point})`).join(", "),
    sales_list:        sales.map(s => `${s.order_no}:${s.customer}-${s.product} x${s.quantity}[${s.status}]`).join(" | "),
    production_list:   prod.map(p => `${p.order_no}:${p.product}[${p.status} ${p.completion_pct}%]`).join(" | "),
    procurement_list:  proc.map(p => `${p.po_number}:${p.supplier}-${p.item} x${p.quantity}[${p.status}]`).join(" | "),
    hr_list:           hr.map(e => `${e.name}(${e.department},${e.status})`).join(", "),
  };
}

// ── Email report ──────────────────────────────────────
async function sendEmailReport(toEmail, snap) {
  const smtpEmail = process.env.SMTP_EMAIL;
  const smtpPass  = process.env.SMTP_PASSWORD;

  if (!smtpEmail || !smtpPass) {
    return { success: false, message: "SMTP not configured — add SMTP_EMAIL and SMTP_PASSWORD to .env" };
  }

  const lowHtml = snap.low_stock_items.length
    ? `<p style="color:#e53e3e">⚠ Low stock: ${snap.low_stock_items.map(i => `${i.name} (${i.qty} left)`).join(", ")}</p>`
    : `<p style="color:#38a169">✅ All stock levels normal</p>`;

  const html = `
    <html><body style="font-family:Arial,sans-serif;background:#f5f5f5;padding:20px">
    <div style="max-width:600px;margin:0 auto;background:white;border-radius:12px;overflow:hidden">
      <div style="background:#4f46e5;padding:24px;color:white">
        <h2 style="margin:0">Saarthi ERP Daily Report</h2>
        <p style="margin:4px 0 0;opacity:.8">${new Date().toDateString()}</p>
      </div>
      <div style="padding:24px">
        <h3 style="color:#4f46e5">Inventory</h3>
        <p>Total Items: <b>${snap.total_inventory_items}</b></p>${lowHtml}
        <h3 style="color:#4f46e5">Production</h3>
        <p>Active Orders: <b>${snap.active_production_orders}</b></p>
        <h3 style="color:#4f46e5">Finance</h3>
        <p>Revenue: <b style="color:#38a169">Rs.${snap.total_revenue.toLocaleString()}</b> &nbsp;|&nbsp;
           Expenses: <b style="color:#e53e3e">Rs.${snap.total_expenses.toLocaleString()}</b> &nbsp;|&nbsp;
           Net: <b>Rs.${snap.net_profit.toLocaleString()}</b></p>
        <h3 style="color:#4f46e5">Sales</h3>
        <p>Open Orders: <b>${snap.open_sales_orders}</b> | Pending POs: <b>${snap.pending_purchase_orders}</b></p>
        <h3 style="color:#4f46e5">HR</h3>
        <p>Employees: <b>${snap.total_employees}</b> | On Leave: <b>${snap.employees_on_leave}</b></p>
      </div>
      <div style="padding:12px 24px;background:#f9f9f9;font-size:12px;color:#999;text-align:center">Sent by Saarthi ERP</div>
    </div></body></html>`;

  try {
    const transport = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: { user: smtpEmail, pass: smtpPass },
    });
    await transport.sendMail({
      from: smtpEmail,
      to: toEmail,
      subject: `Saarthi ERP Report — ${new Date().toLocaleDateString()}`,
      html,
    });
    return { success: true, message: `✅ Email report sent to ${toEmail}` };
  } catch (err) {
    if (err.message.includes("Invalid login") || err.message.includes("535")) {
      return { success: false, message: "Gmail authentication failed. Use App Password — not your Gmail password. Go to myaccount.google.com → Security → App Passwords" };
    }
    return { success: false, message: `Email error: ${err.message}` };
  }
}

// ── WhatsApp report (Twilio) ──────────────────────────
const waCooldown = {};
function sendWhatsAppReport(toNumber, snap) {
  return new Promise(resolve => {
    const sid   = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from  = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";

    if (!sid || !token) {
      return resolve({ success: false, message: "Twilio not configured — add credentials to .env" });
    }

    // 30-second cooldown
    const now  = Date.now();
    const last = waCooldown[toNumber] || 0;
    if (now - last < 30000) {
      const wait = Math.ceil((30000 - (now - last)) / 1000);
      return resolve({ success: false, message: `Please wait ${wait}s before sending again (Twilio rate limit)` });
    }

    // Normalize number
    let clean = toNumber.replace(/[\s\-]/g, "");
    if (!clean.startsWith("+")) clean = "+" + clean;
    const toWa = clean.startsWith("whatsapp:") ? clean : `whatsapp:${clean}`;

    const lowStr = snap.low_stock_items.length
      ? snap.low_stock_items.map(i => i.name).join(", ")
      : "All stock levels normal";

    const body = [
      `Saarthi ERP Daily Report`,
      new Date().toLocaleString(),
      ``,
      `Inventory: ${snap.total_inventory_items} items | Low: ${snap.low_stock_items.length}`,
      lowStr,
      ``,
      `Production: ${snap.active_production_orders} active orders`,
      ``,
      `Finance:`,
      `  Revenue  : Rs.${snap.total_revenue.toLocaleString()}`,
      `  Expenses : Rs.${snap.total_expenses.toLocaleString()}`,
      `  Net P&L  : Rs.${snap.net_profit.toLocaleString()}`,
      ``,
      `Sales: ${snap.open_sales_orders} open | POs: ${snap.pending_purchase_orders}`,
      `HR: ${snap.total_employees} staff | ${snap.employees_on_leave} on leave`,
    ].join("\n");

    const postData = querystring.stringify({ From: from, To: toWa, Body: body });
    const auth     = Buffer.from(`${sid}:${token}`).toString("base64");
    const url      = `/2010-04-01/Accounts/${sid}/Messages.json`;

    const req = https.request({
      hostname: "api.twilio.com",
      path: url,
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type":  "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(postData),
      },
    }, res => {
      let data = "";
      res.on("data", d => data += d);
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          waCooldown[toNumber] = Date.now();
          resolve({ success: true, message: `✅ WhatsApp report sent to ${toNumber}` });
        } else {
          resolve({ success: false, message: `WhatsApp error ${res.statusCode}: ${data}` });
        }
      });
    });
    req.on("error", err => resolve({ success: false, message: `WhatsApp error: ${err.message}` }));
    req.write(postData);
    req.end();
  });
}

// ── Telegram report ───────────────────────────────────
function sendTelegramReport(chatId, snap) {
  return new Promise(resolve => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      return resolve({ success: false, message: "Telegram not configured — add TELEGRAM_BOT_TOKEN to .env" });
    }

    const lowStr = snap.low_stock_items.length
      ? snap.low_stock_items.map(i => i.name).join(", ")
      : "All good";

    const text = [
      `Saarthi ERP Daily Report`,
      new Date().toLocaleString(),
      `------------------------------`,
      `INVENTORY: ${snap.total_inventory_items} items | Low: ${snap.low_stock_items.length}`,
      `  ${lowStr}`,
      `PRODUCTION: ${snap.active_production_orders} active orders`,
      `FINANCE:`,
      `  Revenue  : Rs.${snap.total_revenue.toLocaleString()}`,
      `  Expenses : Rs.${snap.total_expenses.toLocaleString()}`,
      `  Net P&L  : Rs.${snap.net_profit.toLocaleString()}`,
      `SALES: ${snap.open_sales_orders} open | POs: ${snap.pending_purchase_orders}`,
      `HR: ${snap.total_employees} staff | ${snap.employees_on_leave} on leave`,
      ``,
      `Sent by Saarthi ERP`,
    ].join("\n");

    const postData = JSON.stringify({ chat_id: chatId, text });
    const req = https.request({
      hostname: "api.telegram.org",
      path: `/bot${token}/sendMessage`,
      method: "POST",
      headers: {
        "Content-Type":   "application/json",
        "Content-Length": Buffer.byteLength(postData),
      },
    }, res => {
      let data = "";
      res.on("data", d => data += d);
      res.on("end", () => {
        if (res.statusCode === 200) {
          resolve({ success: true, message: `✅ Telegram report sent to chat ${chatId}` });
        } else {
          resolve({ success: false, message: `Telegram error: ${data}` });
        }
      });
    });
    req.on("error", err => resolve({ success: false, message: `Telegram error: ${err.message}` }));
    req.write(postData);
    req.end();
  });
}

module.exports = { callLLM, parseJSON, getSnapshot, sendEmailReport, sendWhatsAppReport, sendTelegramReport };
