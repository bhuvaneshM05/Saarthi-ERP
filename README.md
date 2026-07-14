# Saarthi ERP — Setup Guide

## Stack

|Layer|Technology|
|-|-|
|Frontend|React 18 + Vite (plain JS, no TypeScript)|
|Backend|Node.js + Express|
|Database|MongoDB + Mongoose|
|AI|Groq SDK (llama-3.3-70b-versatile)|
|Email|Nodemailer (Gmail)|
|WhatsApp|Twilio|
|Telegram|Telegram Bot API|

\---

## Prerequisites

* Node.js 18+
* MongoDB running locally (`mongod`) **OR** a MongoDB Atlas connection string
* A free Groq API key from https://console.groq.com

\---

## 1 — Backend Setup

```bash
cd backend
npm install
```

Edit `.env` — only GROQ\_API\_KEY and MONGO\_URI are required to start:

```
GROQ\_API\_KEY=gsk\_your\_key\_here
MONGO\_URI=mongodb://localhost:27017/saarthi\_erp
PORT=8000
```

Start the backend:

```bash
npm run dev        # development (auto-restarts)
# or
npm start          # production
```

The backend seeds sample data automatically on first run.
Verify it works: http://localhost:8000/health

\---

## 2 — Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

Vite proxies all `/api` requests to `http://localhost:8000` automatically.

\---

## 3 — Optional: Notifications

### Email (Gmail)

1. Go to myaccount.google.com → Security → 2-Step Verification → App Passwords
2. Create an App Password for "Mail"
3. Add to `.env`:

```
SMTP\_EMAIL=your@gmail.com
SMTP\_PASSWORD=xxxx xxxx xxxx xxxx   # 16-char app password, no spaces
```

### Telegram (Recommended — free \& instant)

1. Open Telegram → search @BotFather → /newbot → copy token
2. Start a chat with your bot
3. Visit: `https://api.telegram.org/botYOUR\_TOKEN/getUpdates`
4. Copy the `chat.id` number
5. Add to `.env`:

```
TELEGRAM\_BOT\_TOKEN=your\_bot\_token
```

6. Use the chat ID number in the Reports tab

### WhatsApp (Twilio Sandbox)

1. Sign up at twilio.com
2. Go to Messaging → Try it out → Send a WhatsApp message
3. Join sandbox: send "join <word>" to the sandbox number
4. Add to `.env`:

```
TWILIO\_ACCOUNT\_SID=ACxxxxxxxx
TWILIO\_AUTH\_TOKEN=your\_token
TWILIO\_WHATSAPP\_FROM=whatsapp:+14155238886
```

\---

## Project Structure

```
saarthi\_erp/
├── backend/
│   ├── server.js      ← Express app, all API routes, AI actions
│   ├── models.js      ← Mongoose schemas (9 collections)
│   ├── utils.js       ← callLLM, getSnapshot, email/WA/Telegram
│   ├── package.json
│   └── .env           ← Your API keys (never commit this)
│
└── frontend/
    ├── src/
    │   ├── App.jsx    ← Entire UI (13 tabs, all CRUD, AI chat)
    │   ├── main.jsx   ← React entry point
    │   └── index.css  ← All styles (CSS variables, no Tailwind)
    ├── index.html
    ├── vite.config.js ← Proxy /api → localhost:8000
    └── package.json
```

\---

## AI Assistant — Example Commands

|Command|Action|
|-|-|
|"Check stock of Steel Rods"|Reads live inventory|
|"Increase copper wire by 200"|Updates stock in MongoDB|
|"Create PO for 100 bearings from SKF at ₹125"|Creates purchase order|
|"Create sales order for L\&T, 5 control panels at 15000"|Creates SO|
|"Mark WO-2024-001 as completed"|Updates production status|
|"Add expense: office rent ₹40000"|Adds finance entry|
|"Send report to manager@company.com"|Sends email report|
|"Send report to telegram chat 123456789"|Sends Telegram report|

\---

## Troubleshooting

**"MongoDB connection error"** → Make sure `mongod` is running or update MONGO\_URI to Atlas

**"Invalid API Key"** → Check GROQ\_API\_KEY in .env, restart backend after editing .env

**"Gmail authentication failed"** → Use App Password, not your Gmail login password

**Frontend shows blank / network error** → Make sure backend is running on port 8000 first

**Inputs lose focus while typing** → Already fixed: FormWrap is defined outside App component

