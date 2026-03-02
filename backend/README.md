# TeleTransfer Backend

Standalone Express backend for the Telegram Group Transfer tool.

## Deploy on Railway

1. Push this `backend/` folder to a GitHub repo (or use a monorepo)
2. Go to [railway.app](https://railway.app) and create a new project from GitHub
3. Set the **root directory** to `backend` (if monorepo)
4. Add environment variables:
   - `TELEGRAM_API_ID` — Your Telegram API ID
   - `TELEGRAM_API_HASH` — Your Telegram API Hash
5. Railway will auto-detect the Dockerfile and deploy

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TELEGRAM_API_ID` | Yes | From https://my.telegram.org/apps |
| `TELEGRAM_API_HASH` | Yes | From https://my.telegram.org/apps |
| `PORT` | No | Defaults to 3000 |

## Local Development

```bash
cd backend
npm install
TELEGRAM_API_ID=123456 TELEGRAM_API_HASH=abc123 npm run dev
```

## After Deploy

Copy the Railway URL (e.g. `https://your-app.up.railway.app`) and set it as `VITE_BACKEND_URL` in the Lovable frontend.
