# Live Answer Assistant (Chrome Extension)

A transparent companion extension for the AutoApply CV **Interview / Live Answer Assistant**.
It drafts polished, resume-personalized answers to client and interview questions you feed it,
and can score the answers you actually gave — right from the extension popup on any tab.

> Transparent by design: this is an assist/practice tool, not a hidden cheat overlay.

## How it works

1. The extension's content script runs on your dashboard origin (`http://localhost:3000`
   or `https://autoapplycv.in`). While you are logged in, it quietly swaps the httpOnly
   session cookie for a short-lived **Bearer access token** (via `/api/extension/token`).
2. The popup calls `POST /api/interview/assist` with that token from any page.
3. The API drafts the answer using your saved resume context (skills, experience, projects)
   and your configured AI provider (Groq free by default).

## Install in Chrome (2 minutes)

1. Run the app so the API + token endpoint are live:
   - Dev: `npm run dev` → `http://localhost:3000`
   - Or use production `https://autoapplycv.in`
2. In Chrome go to `chrome://extensions`.
3. Turn **Developer mode** ON (top-right).
4. Click **Load unpacked**.
5. Select this folder: `LiveAnswerAssistantExtension`.
6. Pin the extension (puzzle icon → pin) and open the popup.

## Connect

1. Open `http://localhost:3000/dashboard` (or autoapplycv.in) in the same browser and log in.
2. That's it — the content script grabs a token automatically. The popup shows **Connected**.
3. If the popup says **Not connected / Session expiring**, click **Reconnect** (or reopen the
   dashboard tab) and retry.

## Use

- Paste/type a client or interview question → pick a style → **Generate answer** → **Copy**.
- Switch to **Score my answer**: type what you actually said and get a scorecard with
  strengths, improvements, and a stronger rewrite.

## Config (server side, `.env`)

| Var | Default | Purpose |
| --- | --- | --- |
| `INTERVIEW_ASSIST_ENABLED` | `true` | Master on/off switch (`false` disables the API) |
| `INTERVIEW_ASSIST_PROVIDER` | `groq` | `groq`, `openai`, or `custom` |
| `INTERVIEW_ASSIST_MODEL` | `llama-3.3-70b-versatile` | Model key |
| `INTERVIEW_ASSIST_API_KEY` | *(falls back to `GROQ_API_KEY` / `OPENAI_API_KEY`)* | Override key |
| `INTERVIEW_ASSIST_BASE_URL` | provider default | Custom endpoint |
| `INTERVIEW_ASSIST_CONCURRENCY` | `2` | Max parallel AI runs (2–5) |
| `INTERVIEW_ASSIST_RATE_LIMIT` | `10` | Requests per user per minute |
| `INTERVIEW_ASSIST_MAX_TOKENS` | `2048` | Max output tokens |

> Note: `INTERVIEW_ASSIST_CONCURRENCY`/`RATE_LIMIT` are picked up per request; `MODEL`/`KEY`/`BASE_URL`
> changes require a server restart.

## Files

```
manifest.json   MV3 manifest (host perms + content script on dashboard origins)
background.js   Service worker: stores the Bearer token for the popup
content.js      Grabs a short-lived token while you're logged into the dashboard
popup.html/css/js  The assistant UI
icons/          Extension icons
```
