# Deploy to Cloudflare Without GitHub

If you can't create a new GitHub repository, deploy directly to Cloudflare Pages using Wrangler CLI.

## Step 1: Setup Supabase (5 min)

1. Create project at https://supabase.com
2. Run SQL migration in Supabase SQL Editor:
   - Copy contents of `supabase/migrations/001_init_marketplace.sql`
   - Paste into SQL Editor
   - Execute
3. Create storage bucket:
   - Go to Storage
   - Create bucket: `listing-images`
   - Set to public
4. Get API keys:
   - Settings → API
   - Copy `Project URL` and `Anon public key`

## Step 2: Setup Local Environment

```bash
cd /Users/thomasboyle/Desktop/Haiku-sec

# Copy env template
cp .env.example .env.local

# Edit .env.local with your Supabase keys
# Add:
# VITE_SUPABASE_URL=your-url
# VITE_SUPABASE_ANON_KEY=your-key
```

## Step 3: Build Project

```bash
# Install dependencies
npm install

# Build
npm run build

# Verify dist folder was created
ls -la dist/
```

## Step 4: Deploy to Cloudflare Pages

### Option A: Using Wrangler CLI (Recommended)

```bash
# Install Wrangler globally (one time)
npm install -g @cloudflare/wrangler

# Login to Cloudflare
wrangler login

# Deploy to Cloudflare Pages
wrangler pages deploy dist --project-name=marketplace
```

### Option B: Using Cloudflare Dashboard (No CLI)

1. Go to https://dash.cloudflare.com
2. Click **Pages** (left sidebar)
3. Click **Upload assets**
4. Upload the `dist/` folder contents
5. Your site is live!

## Step 5: Set Environment Variables in Cloudflare

After deployment:

1. Go to Cloudflare dashboard
2. Click **Pages** → **marketplace**
3. Click **Settings** → **Environment variables**
4. Add:
   - `VITE_SUPABASE_URL`: Your Supabase URL
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase key
5. Trigger a redeploy

## That's It! 🎉

Your marketplace is live at: `https://marketplace.pages.dev`

---

## Updates & Redeployment

Every time you make changes:

```bash
# Make changes to code
# Then:

npm run build
wrangler pages deploy dist --project-name=marketplace
```

Done! Updated in seconds.

---

## No GitHub, No Problem!

This deployment method:
- ✅ Works without GitHub repository
- ✅ No GitHub permissions needed
- ✅ Direct Cloudflare deployment
- ✅ Still gets HTTPS and global CDN
- ✅ Still gets DDoS protection
- ✅ Super fast deploys

---

## If You Later Get GitHub Access

Once you can create repos, you can:

1. Create a GitHub repository
2. Push your code
3. Connect it to Cloudflare Pages for automatic deployments
4. CI/CD workflows will run automatically

For now, the direct deployment works great!

---

## Troubleshooting

### "wrangler: command not found"
```bash
npm install -g @cloudflare/wrangler
```

### "Build failed"
```bash
# Make sure dist folder exists
npm run build
ls dist/index.html
```

### "Environment variables not working"
```bash
# Set them in Cloudflare dashboard AFTER deployment
# Then redeploy
```

### "dist folder is empty"
```bash
# Check build worked
npm run type-check
npm run build

# Make sure index.html exists
ls dist/index.html
```

---

Your marketplace is ready to deploy! 🚀
