# Push to GitHub - Quick Guide

Your local repository is ready. Follow these steps to push to GitHub.

## Step 1: Create GitHub Repository

1. Go to https://github.com/new
2. Fill in details:
   - **Repository name**: `marketplace`
   - **Description**: "Secure online marketplace with React, Supabase, Cloudflare"
   - **Visibility**: Public (recommended for Cloudflare Pages)
   - **Initialize this repository with**: Leave all unchecked
3. Click **Create repository**

## Step 2: Connect Local to GitHub

Copy the URL from the GitHub repo page, then run:

```bash
cd /Users/thomasboyle/Desktop/Haiku-sec

# Add remote (replace YOUR-USERNAME)
git remote add origin https://github.com/YOUR-USERNAME/marketplace.git

# Ensure main branch
git branch -M main

# Push to GitHub
git push -u origin main
```

## Step 3: Verify on GitHub

1. Go to your GitHub repository
2. Refresh the page
3. You should see all your files:
   - ✅ `src/` folder with React code
   - ✅ `supabase/` folder with migrations
   - ✅ `.github/` folder with workflows
   - ✅ Documentation (README.md, SETUP.md, etc.)
   - ✅ Configuration files (package.json, vite.config.ts, etc.)

## Step 4: Connect to Cloudflare Pages

1. Go to https://dash.cloudflare.com
2. Click **Pages** (left sidebar)
3. Click **Create a project** → **Connect to Git**
4. Authorize GitHub (first time only)
5. Select your `marketplace` repository
6. Fill in build settings:
   - **Framework preset**: None
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
7. Add environment variables:
   - `VITE_SUPABASE_URL`: Your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase public key
8. Click **Save and Deploy**

**Done!** Your marketplace is live! 🎉

---

## Troubleshooting

### "fatal: pathspec 'origin' does not match any file"
- Make sure you ran `git remote add origin ...` first

### "Permission denied (publickey)"
- Set up SSH key or use HTTPS instead of SSH
- [GitHub SSH Setup Guide](https://docs.github.com/en/authentication/connecting-to-github-with-ssh)

### "Nothing to commit"
- All files are already committed
- New changes can be committed with: `git commit -am "message"`

### Can't see files on GitHub
- Refresh the page
- Check that `git push` completed successfully
- Run `git log` to verify commit was made locally

---

## Common Git Commands (After Initial Push)

```bash
# See recent commits
git log --oneline

# See current status
git status

# Make changes to a file and commit
git add .
git commit -m "Description of changes"
git push origin main

# Create a new branch for features
git checkout -b feature/my-feature
# ... make changes ...
git add .
git commit -m "Add my feature"
git push origin feature/my-feature
# Then create Pull Request on GitHub
```

---

## What Happens Next

Once you push to GitHub and connect to Cloudflare:

1. **GitHub Actions Runs**
   - Automatically builds and tests your code
   - Runs security checks
   - Takes ~2 minutes

2. **Cloudflare Deploys**
   - If build succeeds, automatically deploys to edge
   - Your site goes live at `marketplace.pages.dev`
   - You can set custom domain in Cloudflare

3. **Future Pushes**
   - Every push to `main` triggers automatic deployment
   - Changes live in ~2 minutes
   - No manual deploy needed!

---

## ✅ Checklist

- [ ] Created GitHub repository
- [ ] Ran `git remote add origin ...`
- [ ] Pushed with `git push -u origin main`
- [ ] Verified all files on GitHub
- [ ] Connected to Cloudflare Pages
- [ ] Set environment variables in Cloudflare
- [ ] Deployment succeeded
- [ ] App is live! 🚀

---

You're all set! Your marketplace is now on GitHub and ready for deployment! 🎉
