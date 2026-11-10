# Deployment Checklist

Complete this checklist before deploying to production.

## 🏗️ Pre-Deployment Setup

### Supabase Project
- [ ] Project created at supabase.com
- [ ] Database migration run (SQL from `001_init_marketplace.sql`)
- [ ] All tables created successfully
- [ ] RLS policies enabled on all tables
- [ ] Storage bucket `listing-images` created
- [ ] Storage bucket set to public
- [ ] CORS policy configured in storage bucket
- [ ] API keys copied:
  - [ ] `VITE_SUPABASE_URL`
  - [ ] `VITE_SUPABASE_ANON_KEY`

### GitHub Repository
- [ ] Repository created (public or private)
- [ ] `.env.local` is in `.gitignore` (verify with `git status`)
- [ ] No secrets committed (run `git log --all -p | grep -i password`)
- [ ] Meaningful commit history
- [ ] Main branch protection rules set (optional but recommended)

### Cloudflare Account
- [ ] Account created
- [ ] Billing information updated (even for free tier)
- [ ] Project name decided: `marketplace`

## 🔧 Cloudflare Pages Setup

### Connection
- [ ] GitHub account connected to Cloudflare
- [ ] Repository authorized for Cloudflare
- [ ] Cloudflare project created
- [ ] GitHub repository connected to project

### Build Configuration
- [ ] Build command: `npm run build`
- [ ] Build output directory: `dist`
- [ ] Framework preset: None (blank)
- [ ] Production branch: `main`

### Environment Variables
- [ ] `VITE_SUPABASE_URL` set in Cloudflare dashboard
- [ ] `VITE_SUPABASE_ANON_KEY` set in Cloudflare dashboard
- [ ] Variables verified (not in .env file)

### Custom Domain (Optional)
- [ ] Domain registered (if using custom domain)
- [ ] Domain connected to Cloudflare
- [ ] SSL/TLS certificate generated

## ✅ Code Quality

### TypeScript
- [ ] `npm run type-check` passes
- [ ] No TypeScript errors in terminal
- [ ] No `any` types without reason

### Build
- [ ] `npm run build` completes successfully
- [ ] `dist/` directory created
- [ ] `dist/index.html` exists
- [ ] Bundle size reasonable (~200KB gzipped)

### Dependencies
- [ ] `npm audit` shows no critical vulnerabilities
- [ ] All dependencies up to date
- [ ] No unused dependencies
- [ ] Lock file (package-lock.json) committed

### Code Standards
- [ ] No console.log left in production code
- [ ] No hardcoded API keys or secrets
- [ ] Error messages don't expose system details
- [ ] No sensitive data in localStorage

## 🔐 Security Review

### Database Security
- [ ] RLS policies reviewed and correct
- [ ] Foreign key constraints in place
- [ ] Passwords never stored in plain text
- [ ] Sensitive operations logged

### Authentication
- [ ] Login validation working
- [ ] Signup validation working
- [ ] Session handling secure
- [ ] Logout clears session properly

### Authorization
- [ ] Admin routes check `is_admin` status
- [ ] Protected routes check authentication
- [ ] Cart/orders only accessible to owner
- [ ] Listing edit/delete only by owner

### File Uploads
- [ ] Image type validation working
- [ ] Image size limit enforced (5MB)
- [ ] Files stored with user ID in path
- [ ] No directory traversal possible

### API Security
- [ ] All API calls use parameterized queries
- [ ] Rate limiting ready to enable
- [ ] CORS properly configured
- [ ] No secrets in error responses

## 🧪 Testing

### User Flows
- [ ] Can create account
- [ ] Can sign in
- [ ] Can create listing with images
- [ ] Can browse listings
- [ ] Can search and filter
- [ ] Can view listing detail
- [ ] Can add to cart
- [ ] Can checkout (simulated)
- [ ] Can view order history
- [ ] Can message seller
- [ ] Can sign out

### Admin Features
- [ ] Can set user as admin in database
- [ ] Can access `/admin` page
- [ ] Can view all users
- [ ] Can view all listings
- [ ] Can delete users
- [ ] Can delete listings
- [ ] Can promote/revoke admin status

### Mobile Testing
- [ ] Tested on iPhone (if possible)
- [ ] Tested on Android (if possible)
- [ ] Responsive design works
- [ ] Touch interactions work
- [ ] Images load correctly

### Edge Cases
- [ ] Very long product names work
- [ ] Very long descriptions handled
- [ ] Many images (5 max) work
- [ ] Large image files rejected
- [ ] Missing images handled gracefully
- [ ] Network errors handled
- [ ] Session expiration handled

### Performance
- [ ] Page loads in < 3 seconds
- [ ] Images optimized
- [ ] No layout shifts
- [ ] Smooth interactions
- [ ] Mobile performance acceptable

## 📊 Monitoring Setup

### Supabase
- [ ] Logs access enabled
- [ ] Alerts configured (optional)
- [ ] Database size monitored
- [ ] Connection pool monitored

### Cloudflare
- [ ] Analytics dashboard checked
- [ ] Error rates monitored
- [ ] Build success rate tracked
- [ ] Performance metrics reviewed

### GitHub Actions
- [ ] Build workflow configured
- [ ] Tests passing
- [ ] Deploy workflow configured
- [ ] Secrets properly set

## 📝 Documentation

### README
- [ ] Updated with deployment instructions
- [ ] Quick start guide clear
- [ ] Links to other docs
- [ ] Feature list complete
- [ ] Troubleshooting section helpful

### Deployment Documentation
- [ ] SETUP.md complete
- [ ] SECURITY.md reviewed
- [ ] GITHUB_DEPLOYMENT.md accurate
- [ ] CONTRIBUTING.md present

### Code Documentation
- [ ] Complex functions documented
- [ ] Component props documented
- [ ] Database schema documented
- [ ] API endpoints documented

## 🚀 Final Deployment

### Before Push
- [ ] Local build successful
- [ ] All tests passing
- [ ] No uncommitted changes
- [ ] All secrets in environment, not code

### Push to Main
```bash
git add .
git commit -m "Release v1.0.0"
git push origin main
```

### Verify Deployment
- [ ] GitHub Actions build succeeds (green checkmark)
- [ ] Cloudflare Pages deployment succeeds
- [ ] App loads at deployment URL
- [ ] All features work on live URL

### Post-Deployment
- [ ] Test live marketplace one more time
- [ ] Verify environment variables working
- [ ] Check Cloudflare analytics
- [ ] Monitor for errors in logs

## 📞 Troubleshooting Deployment

### Build Fails
```
Check:
- GitHub Actions logs (Actions tab)
- Node version (needs 18+)
- Dependencies (npm ci)
- TypeScript errors (npm run type-check)
```

### Deploy Fails
```
Check:
- Cloudflare Pages logs
- Build output directory (dist/)
- Environment variables set
- Project name correct
```

### App Not Working Live
```
Check:
- Browser console (F12)
- Cloudflare Analytics
- Supabase logs
- Environment variables correct
- Storage bucket permissions
```

### Performance Issues
```
Check:
- Bundle size (npm run build)
- Image optimization
- Database query performance
- Supabase connection pool
- Cloudflare cache settings
```

## 📋 Rollback Procedure

If something goes wrong:

```bash
# Revert to previous commit
git revert <commit-hash>
git push origin main

# Or reset main to previous state
git reset --hard <previous-commit>
git push origin main --force
```

Then Cloudflare will auto-redeploy.

## ✨ Success Criteria

Deployment is successful when:

- [ ] All automated checks pass
- [ ] App loads on public URL
- [ ] All features work correctly
- [ ] No console errors
- [ ] Mobile design looks good
- [ ] Database operations work
- [ ] File uploads work
- [ ] Authentication works
- [ ] Admin features work (after setup)
- [ ] Monitoring shows green status

---

## 🎉 Post-Launch

After successful deployment:

1. Share the link with beta testers
2. Monitor logs for errors
3. Respond to feedback
4. Plan improvements
5. Set up regular monitoring
6. Schedule security reviews

---

**Remember:** Security and reliability > speed. Take time to verify everything works correctly!
