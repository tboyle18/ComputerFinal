# 🚀 Deployment Guide - HaikuMart

Complete step-by-step guide to deploy your marketplace to Cloudflare Pages and set up Supabase.

## Prerequisites

Before you start, make sure you have:
- GitHub account (github.com)
- Supabase account (supabase.com)
- Cloudflare account (cloudflare.com)
- Node.js 16+ installed locally
- Git installed locally

All are free with generous free tiers!

---

## Part 1: Supabase Setup (5 minutes)

### 1.1 Create Supabase Project

1. Go to https://supabase.com and click "Start your project"
2. Sign in with GitHub (easiest option)
3. Click "New project"
4. Fill in:
   - **Name:** marketplace-db (or any name)
   - **Database Password:** Create a strong password (save it!)
   - **Region:** Choose closest to you (US-East, EU-West, etc.)
5. Click "Create new project"
6. Wait 2-3 minutes for the database to initialize

### 1.2 Create Database Tables

1. In your Supabase project, go to **SQL Editor** (left sidebar)
2. Click **"New query"**
3. Open `SUPABASE_SETUP.sql` from this project in a text editor
4. Copy all the SQL code
5. Paste into the Supabase SQL Editor
6. Click the **"Run"** button (or press Ctrl+Enter)
7. You should see: "Query complete" at the bottom
   
✅ All tables, storage buckets, and security policies are now set up!

### 1.3 Get Your Credentials

1. In Supabase, go to **Settings** → **API** (bottom of left sidebar)
2. Copy these values:
   - **Project URL** - looks like: `https://xxxxx.supabase.co`
   - **anon public** key - long string of characters
3. Save both in a text file (we'll need them soon)

### 1.4 Create Demo User (Optional)

For testing locally:

1. Go to **Authentication** → **Users** (left sidebar)
2. Click **"Invite user"**
3. Enter:
   - **Email:** demo@test.com
   - **Password:** password123
4. Click **"Invite user"**
5. Go back to Users and you should see the user created

---

## Part 2: GitHub Setup (5 minutes)

### 2.1 Create GitHub Repository

1. Go to https://github.com/new
2. Fill in:
   - **Repository name:** marketplace-app
   - **Description:** Modern online marketplace
   - **Public or Private:** Your choice
3. Click **"Create repository"**
4. Copy the HTTPS URL from the "Quick setup" section

### 2.2 Push Code to GitHub

In your terminal, in the `marketplace-app` folder:

```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial marketplace app commit"

# Add remote (replace with your GitHub URL)
git remote add origin https://github.com/YOUR_USERNAME/marketplace-app.git

# Push to GitHub
git push -u origin main
```

If you get an error about "main" vs "master", run:
```bash
git branch -M main
git push -u origin main
```

✅ Your code is now on GitHub!

---

## Part 3: Local Testing (5 minutes)

Before deploying, test everything works locally.

### 3.1 Set Up Environment

1. Create `.env.local` in your project root:
   ```bash
   cp .env.example .env.local
   ```

2. Edit `.env.local` with your Supabase credentials:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

### 3.2 Run Locally

```bash
# Install dependencies
npm install

# Start dev server
npm run dev
```

Open http://localhost:5173 in your browser

### 3.3 Test Key Features

- [ ] Sign up with new email
- [ ] Create a listing with image
- [ ] Search for listings
- [ ] Add to cart and checkout
- [ ] View order history
- [ ] View admin dashboard (if admin user)

If everything works, you're ready to deploy! ✅

---

## Part 4: Cloudflare Pages Deployment (10 minutes)

### 4.1 Connect Cloudflare to GitHub

1. Go to https://dash.cloudflare.com
2. In the left sidebar, click **"Workers & Pages"**
3. Click **"Pages"** → **"Create a project"**
4. Click **"Connect to Git"**
5. Click **"GitHub"** and authorize Cloudflare
6. Select your **marketplace-app** repository
7. Click **"Begin setup"**

### 4.2 Configure Build Settings

Cloudflare should auto-detect these, but verify:

- **Framework preset:** Vite
- **Build command:** `npm run build`
- **Build output directory:** `dist`

Keep all other settings as defaults.

### 4.3 Add Environment Variables

1. Scroll down to **"Environment variables"** section
2. Click **"Add environment variable"**
3. Add Production variables:
   - **Name:** `VITE_SUPABASE_URL`
   - **Value:** Your Supabase Project URL
   - Click **"Add variable"**
   
4. Add another variable:
   - **Name:** `VITE_SUPABASE_ANON_KEY`
   - **Value:** Your Supabase anon key
   - Click **"Add variable"**

### 4.4 Deploy!

1. Click **"Save and deploy"**
2. Cloudflare will automatically:
   - Pull your code from GitHub
   - Run `npm install`
   - Run `npm run build`
   - Deploy to their CDN

3. Wait for the build to complete (usually 1-2 minutes)
4. You'll see a message: "✅ Deployment successful"
5. Your site is now live at: `your-project-name.pages.dev`

### 4.5 Test Live Deployment

Visit your live URL and test:
- [ ] Can sign up
- [ ] Can create listings
- [ ] Images upload
- [ ] Search works
- [ ] Cart/checkout works

✅ Your marketplace is now live!

---

## Part 5: Optional - Custom Domain (5 minutes)

Want to use your own domain instead of `pages.dev`?

### 5.1 Add Custom Domain

1. In Cloudflare Pages, go to **"Custom domain"**
2. Enter your domain (example.com)
3. Click **"Continue"**
4. Follow the DNS setup instructions:
   - Add CNAME record: point to your Cloudflare Pages domain
   - Wait 5-10 minutes for DNS to propagate

### 5.2 Verify Domain

1. Go back to **"Custom domain"**
2. You should see a checkmark (✅) next to your domain
3. Your site is now at yourdomain.com

---

## Making Updates

After you deploy, if you make changes to your code:

1. **Edit files locally**
2. **Commit changes:**
   ```bash
   git add .
   git commit -m "Description of changes"
   git push origin main
   ```
3. **Cloudflare automatically redeploys** (1-2 minutes)

No need to manually trigger deploys!

---

## Monitoring & Debugging

### Check Build Logs

1. In Cloudflare Pages, click on the latest deployment
2. Click **"View build log"**
3. See detailed build output and any errors

### Check Performance

1. In Cloudflare Pages dashboard, see metrics like:
   - Deployment status
   - Build time
   - Page load times

### View Real-Time Analytics

1. In Cloudflare Pages, click **"Analytics"**
2. See traffic, errors, and geographic distribution

---

## Common Issues & Fixes

### "Build Failed: npm install error"
- Make sure `package.json` and `package-lock.json` are committed
- Check for typos in dependencies

### "Build successful but app doesn't work"
- Verify environment variables are set in Cloudflare
- Check browser console (F12) for JavaScript errors
- Verify Supabase credentials are correct

### "Images not loading on production"
- Check Supabase Storage bucket allows public access
- Verify RLS policy on storage objects

### "Cloudflare shows 500 error"
- Check the build log for errors
- Verify `.env.local` is NOT committed to GitHub
  (it should be in `.gitignore`)

### "Can't upload images"
- In Supabase, verify Storage bucket "listing-images" exists
- Check Storage → listing-images → Public access is enabled

---

## Scaling Tips

As your marketplace grows:

1. **Database optimization:**
   - Supabase gives you 500MB on free tier
   - Add indexes for frequently searched columns
   - Archive old orders after 1 year

2. **Image optimization:**
   - Compress images before uploading
   - Consider image CDN for faster delivery
   - Limit image file size to 5MB

3. **Performance:**
   - Use Cloudflare caching
   - Enable Brotli compression
   - Monitor Core Web Vitals

4. **Scalability:**
   - Supabase auto-scales with usage
   - Cloudflare distributes globally
   - No action needed until you hit limits

---

## Going Production

Before launching publicly:

- [ ] Test thoroughly on multiple devices
- [ ] Set up real payment processor (Stripe, PayPal)
- [ ] Add terms of service and privacy policy
- [ ] Implement user verification (email confirmation)
- [ ] Set up email notifications
- [ ] Add user ratings/reviews
- [ ] Implement content moderation
- [ ] Set up customer support system

---

## Troubleshooting Checklist

**App works locally but not on Cloudflare:**
1. Check build logs in Cloudflare
2. Verify environment variables match `.env.local`
3. Ensure code is pushed to GitHub
4. Clear browser cache and hard-refresh

**Changes not showing after push:**
1. Wait 2-3 minutes for deployment to complete
2. Check Cloudflare deployment status
3. Hard-refresh browser (Ctrl+Shift+R)
4. Check GitHub shows your latest commit

**Login not working:**
1. Verify Supabase credentials in `.env.local`
2. Check Supabase project is active
3. Verify user exists in Supabase Authentication

**Images not showing:**
1. Check image uploads in Supabase Storage
2. Verify Storage bucket is public
3. Check RLS policies allow access

---

## Support Resources

- **Supabase Docs:** https://supabase.com/docs
- **Cloudflare Pages:** https://pages.cloudflare.com
- **React Docs:** https://react.dev
- **Vite Docs:** https://vite.dev

---

## Next Steps

1. ✅ Deploy to Cloudflare Pages (you are here!)
2. 📊 Monitor your live app
3. 🎨 Customize branding
4. 👥 Invite users to test
5. 💳 Add real payment processing
6. 🚀 Market your marketplace!

Congratulations! Your marketplace is live! 🎉
