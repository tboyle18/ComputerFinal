# ⚡ Quick Start Guide - 5 Minute Setup

Get HaikuMart running locally in 5 minutes!

## Prerequisites
- Node.js installed: https://nodejs.org/
- A GitHub account: https://github.com
- A Supabase account: https://supabase.com

All are free!

## Step 1: Clone/Setup (1 min)

```bash
# Navigate to the app folder
cd marketplace-app

# Install dependencies
npm install
```

## Step 2: Create Supabase Project (2 min)

1. Go to https://supabase.com/dashboard
2. Click "New Project"
3. Enter a name and password
4. Wait for it to initialize

## Step 3: Set Up Database (1 min)

1. In Supabase, go to SQL Editor
2. Click "New Query"
3. Copy all code from `SUPABASE_SETUP.sql` file
4. Paste into SQL Editor and click "Run"

✅ Database is ready!

## Step 4: Get Credentials (1 min)

1. In Supabase, go to Settings → API
2. Copy:
   - **Project URL** (e.g., https://xxxxx.supabase.co)
   - **anon public** key

## Step 5: Configure App (1 min)

1. Create `.env.local` file in project root:
   ```bash
   cp .env.example .env.local
   ```

2. Edit `.env.local` and paste your credentials:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

## Step 6: Run! (1 min)

```bash
npm run dev
```

Open http://localhost:5173 in your browser

## Step 7: Test

1. Click "Sign Up"
2. Create an account
3. Create a listing
4. Add it to cart
5. Checkout

🎉 Done! Your marketplace is running!

## Next: Deploy to Cloudflare Pages

See `DEPLOYMENT.md` for complete step-by-step instructions to go live.

## Need Help?

- Check `README.md` for detailed docs
- See `DEPLOYMENT.md` for troubleshooting
- Supabase docs: https://supabase.com/docs

---

**That's it! You now have a fully functional marketplace running locally.** 🚀
