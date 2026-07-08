# Render Deploy Guide

## Step 1: GitHub repo push karo

```bash
git init
git add .
git commit -m "initial"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/viralflows.git
git push -u origin main
```

---

## Step 2: Render mein account banao

1. https://dashboard.render.com/register — **Sign up with GitHub** (no CC required)
2. Dashboard pe aaoge

---

## Step 3: Backend deploy (Web Service)

1. Dashboard → **New +** → **Web Service**
2. Connect your `viralflows` repo
3. Fill this:

| Field | Value |
|-------|-------|
| **Name** | `viralflows-api` |
| **Region** | `Singapore` (closest to Neon DB) |
| **Branch** | `main` |
| **Root Directory** | `artifacts/api-server` |
| **Runtime** | `Node` |
| **Build Command** | `npm install && npx tsc` |
| **Start Command** | `node dist/artifacts/api-server/src/index.js` |
| **Plan** | **Free** ($0/month) |

4. **Environment Variables** — Add ALL of these:

```
NODE_ENV=production
PORT=10000

DATABASE_URL=postgresql://... (Neon DB connection string dari hui hai)
JWT_SECRET=<apna-random-secret-dalo>

GROQ_API_KEYS=<apni-groq-keys-comma-separated>
OPENROUTER_API_KEYS=<apni-openrouter-key>

FRONTEND_URL=https://viralflows.vercel.app

S3_ACCESS_KEY=<apna-s3-access-key>
S3_SECRET_KEY=<apna-s3-secret-key>
S3_BUCKET=<apna-bucket-name>
S3_ENDPOINT=<apna-s3-endpoint>
S3_REGION=<apna-s3-region>

# YouTube OAuth — baad mein production URL update karna
YOUTUBE_CLIENT_ID=
YOUTUBE_CLIENT_SECRET=
YOUTUBE_REDIRECT_URI=https://viralflows-api.onrender.com/api/connect/youtube/callback
```

5. Click **Deploy Web Service** → wait 5-10 min for first build

---

## Step 4: Frontend deploy (Vercel — better than Render for static)

1. https://vercel.com — sign up with GitHub (no CC)
2. **Add New Project** → Import `viralflows` repo
3. **Root Directory**: `artifacts/web`
4. **Framework Preset**: `Vite`
5. **Build Command**: `npm run build`
6. **Output Directory**: `dist`
7. **Environment Variables** — Add:

```
VITE_API_URL=https://viralflows-api.onrender.com
```

8. Click **Deploy**

---

## Step 5: Keep backend alive (cron-job.org)

Render free tier sleeps after 15min without traffic. Fix:

1. https://cron-job.org — sign up (free, no CC)
2. **Create Cron Job**:

| Field | Value |
|-------|-------|
| **Title** | `ViralFlows keep-alive` |
| **URL** | `https://viralflows-api.onrender.com/api/health` |
| **Schedule** | `Every 10 minutes` |
| **Request Method** | `GET` |

3. Click **Create**

---

## Step 6: Verify

1. Open `https://viralflows-api.onrender.com/api/health`
2. Expected: `{"status":"ok","uptime":...}`
3. Open `https://viralflows.vercel.app`
4. Login → Register → everything working

---

## Important Notes

- **Neon DB**: already configured, stays active via scheduler keepalive
- **Filebase (S3)**: stays same, no changes needed
- **YouTube OAuth**: `YOUTUBE_REDIRECT_URI` must match production domain
- **Free tier limits**: 512MB RAM, 512GB bandwidth, 15min sleep
- **Neon storage**: 0.5GB — 30-day auto-cleanup already configured ✅

---

## Cost breakdown

| Service | Cost |
|---------|------|
| Render (backend) | **$0** |
| Vercel (frontend) | **$0** |
| Neon (DB) | **$0** |
| Filebase (S3) | **$0** (5GB free) |
| cron-job.org | **$0** |
| Groq API (3 keys) | **$0** |
| OpenRouter API | **$0** (free tier) |
| **Total** | **$0/month** |
