# GitHub → Cloudflare Deployment Guide

This guide shows how to deploy MarketHub from GitHub to Cloudflare Pages with automatic updates.

## 🚀 One-Click Setup (Recommended)

### Step 1: Fork to GitHub

1. Click the **Fork** button on this repository
2. This creates your own copy at `github.com/your-username/marketplace`

### Step 2: Connect to Cloudflare Pages

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Go to **Pages** (left sidebar)
3. Click **Create a project** → **Connect to Git**
4. Authorize GitHub (first time only)
5. Select your forked repository
6. Click **Begin setup**

### Step 3: Configure Build Settings

In Cloudflare Pages setup form:

**Project name:** `marketplace` (or any name)

**Production branch:** `main`

**Framework preset:** None (leave blank)

**Build command:** `npm run build`

**Build output directory:** `dist`

### Step 4: Add Environment Variables

Click "Environment variables" and add:

| Variable | Value | Source |
|----------|-------|--------|
| `VITE_SUPABASE_URL` | `https://your-project.supabase.co` | Supabase Dashboard |
| `VITE_SUPABASE_ANON_KEY` | `your-public-key` | Supabase Dashboard → Settings > API |

**How to get these:**
1. Go to [supabase.com](https://supabase.com) → Your Project
2. Click **Settings** → **API**
3. Copy "Project URL" and "Anon public key"
4. Paste into Cloudflare

### Step 5: Deploy

Click **Save and Deploy**

Done! Your app is live at `https://marketplace.pages.dev`

---

## 🔄 Automatic Deploys

Every time you push to `main`:

```bash
git add .
git commit -m "Update marketplace"
git push origin main
```

Cloudflare automatically:
1. Pulls your latest code
2. Installs dependencies
3. Builds the project
4. Deploys to edge network

**Deploy status:** Check GitHub Actions tab or Cloudflare dashboard

---

## 📋 Setup Supabase

Before deploying, you need a Supabase project:

### 1. Create Project
1. Go to [supabase.com](https://supabase.com)
2. Click **New project**
3. Choose region closest to you
4. Wait for project to be ready

### 2. Run Database Migration
1. In Supabase, go to **SQL Editor**
2. Click **New query**
3. Copy entire contents of `supabase/migrations/001_init_marketplace.sql`
4. Paste into SQL Editor
5. Click **Run**

### 3. Create Storage Bucket
1. Go to **Storage** (left sidebar)
2. Click **Create new bucket**
3. Name: `listing-images`
4. Uncheck "private bucket" (make it public)
5. Click **Create bucket**
6. Click on bucket, then **CORS** tab
7. Add this CORS policy:
```json
[
  {
    "origin": ["*"],
    "methods": ["GET", "POST", "PUT", "DELETE"],
    "allowedHeaders": ["*"]
  }
]
```

### 4. Get API Keys
1. Go to **Settings** → **API**
2. Copy "Project URL" → Use as `VITE_SUPABASE_URL`
3. Copy "Anon public key" → Use as `VITE_SUPABASE_ANON_KEY`

---

## 🔐 Create Admin User (Optional)

To access the admin dashboard:

1. Sign up through the marketplace UI
2. Go to [Supabase Dashboard](https://supabase.com) → Your Project
3. Click **Table Editor**
4. Select `user_profiles` table
5. Find your user row
6. Click the row to edit
7. Change `is_admin` from `false` to `true`
8. Save
9. Visit `/admin` in your marketplace

---

## 🧪 Test Deployment

After deployment:

1. Visit `https://marketplace.pages.dev`
2. Create an account
3. Create a listing with images
4. Add item to cart
5. Test checkout
6. Try messaging (create 2nd account)

If anything fails, check:
- GitHub Actions tab (build logs)
- Cloudflare Pages dashboard (deployment logs)
- Browser console (F12) for frontend errors

---

## 📝 Local Development

To test locally before pushing to GitHub:

```bash
# Clone your fork
git clone https://github.com/your-username/marketplace.git
cd marketplace

# Install dependencies
npm install

# Setup .env.local with Supabase credentials
cp .env.example .env.local
# Edit .env.local and add your keys

# Run dev server
npm run dev
```

---

## 🔄 GitHub Actions Workflows

Automatic workflows run on every push:

### 1. Build & Test (`build.yml`)
- Tests on Node 18 and 20
- Checks TypeScript compilation
- Verifies build output
- Uploads artifacts

### 2. Deploy to Cloudflare (`deploy-cloudflare.yml`)
- Runs only on `main` branch
- Builds and deploys automatically
- Comments deployment link on PRs

### 3. Security Checks (`security.yml`)
- Runs `npm audit` weekly
- Checks for vulnerabilities
- Runs on every push/PR

**View results:** GitHub → Actions tab

---

## 🚨 Troubleshooting

### Build Fails
```
❌ npm install failed
```
**Fix:**
- Make sure `package.json` is correct
- Run locally: `npm ci`
- Check Node version: needs 18+

### Deployment Fails
```
❌ Build output directory not found
```
**Fix:**
- Build command: `npm run build`
- Output directory: `dist`
- Make sure these match exactly

### Images Not Uploading
```
❌ 403 Forbidden uploading to storage
```
**Fix:**
- Check `listing-images` bucket is public
- Verify CORS policy is set
- Check Supabase API key is correct

### Env Variables Not Working
```
❌ Cannot find Supabase
```
**Fix:**
- Add variables in Cloudflare dashboard (not .env)
- Exact names: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Redeploy after adding

---

## 📊 Monitoring Deployment

### Cloudflare Dashboard
- View deployments: **Pages** → **marketplace**
- Check deployment status: green = live, red = failed
- View build logs: click deployment
- Check analytics: **Analytics** tab

### GitHub Actions
- View workflows: **Actions** tab
- Check build logs: click workflow run
- See deployment status: look for green checkmark

### Supabase Monitoring
- View logs: **Logs** (left sidebar)
- Check database queries
- Monitor API usage

---

## 🎯 Production Checklist

Before telling others about your marketplace:

- [ ] Supabase project created
- [ ] Database migration run
- [ ] Storage bucket created and public
- [ ] GitHub repo connected to Cloudflare
- [ ] Environment variables set in Cloudflare
- [ ] First deployment successful (green checkmark)
- [ ] Can sign up and create listing
- [ ] Images upload working
- [ ] Checkout completes
- [ ] Admin panel accessible

---

## 🔗 Quick Links

- **Cloudflare Dashboard**: https://dash.cloudflare.com
- **Supabase Dashboard**: https://supabase.com/dashboard
- **Your Marketplace**: https://marketplace.pages.dev (after deployment)
- **GitHub Repo**: https://github.com/your-username/marketplace

---

## 📞 Need Help?

1. Check build logs in GitHub Actions
2. Check deployment logs in Cloudflare Pages
3. Check browser console (F12) for frontend errors
4. Review [SETUP.md](./SETUP.md) for detailed help
5. Check [SECURITY.md](./SECURITY.md) for security questions

---

## 🎓 Learning Resources

- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
- [Supabase Docs](https://supabase.com/docs)
- [React Documentation](https://react.dev)
- [GitHub Actions Docs](https://docs.github.com/en/actions)

---

**That's it!** Your marketplace is now deployed and updating automatically. 🎉
