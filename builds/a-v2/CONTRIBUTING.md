# Contributing to MarketHub

Thank you for your interest in contributing! This document provides guidelines and instructions.

## 🤝 Code of Conduct

- Be respectful and inclusive
- Welcome differing opinions
- Focus on constructive feedback
- No harassment or discrimination

## 🐛 Reporting Bugs

1. Check if the bug is already reported (search Issues)
2. Create a new issue with:
   - Clear description
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots if applicable
   - Environment info (browser, OS, Node version)

## 💡 Suggesting Features

1. Check if the feature is already requested
2. Create a new issue explaining:
   - What problem it solves
   - How it should work
   - Why it's needed

## 🚀 Development Setup

### 1. Fork & Clone
```bash
# Fork on GitHub, then:
git clone https://github.com/your-username/marketplace.git
cd marketplace
```

### 2. Setup Environment
```bash
# Run setup script
bash scripts/setup.sh

# Or manually:
npm install
cp .env.example .env.local
# Edit .env.local with Supabase credentials
```

### 3. Create Feature Branch
```bash
git checkout -b feature/your-feature-name
```

### 4. Make Changes

#### Code Style
- Use TypeScript - strict mode enabled
- Follow existing patterns
- Keep components small and focused
- Use meaningful variable names
- Comment non-obvious logic

#### Components
- Functional components with hooks
- Prop types clearly defined
- Reusable and composable

#### Styles
- Use Tailwind CSS classes
- Mobile-first responsive design
- No inline styles

#### Security
- Validate user inputs
- No hardcoded secrets
- Check for XSS vulnerabilities
- Use parameterized queries (Supabase handles)

### 5. Test Changes
```bash
# Type check
npm run type-check

# Build
npm run build

# Run locally
npm run dev
```

Test all affected features:
- Sign up / Sign in
- Create/edit/delete listings
- Browse and search
- Shopping cart
- Messaging
- Admin features

### 6. Commit Changes
```bash
git add .
git commit -m "feat: description of your change"
```

**Commit message format:**
- `feat:` - new feature
- `fix:` - bug fix
- `docs:` - documentation
- `style:` - formatting
- `refactor:` - code reorganization
- `test:` - tests
- `chore:` - maintenance

### 7. Push & Create PR
```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub with:
- Clear title
- Description of changes
- Related issue number
- Testing notes

## 📋 Pull Request Checklist

- [ ] Code follows TypeScript guidelines
- [ ] No TypeScript errors (`npm run type-check`)
- [ ] Builds successfully (`npm run build`)
- [ ] No console errors or warnings
- [ ] Tested on mobile
- [ ] Security implications reviewed
- [ ] Documentation updated if needed
- [ ] Commit messages are clear

## 🔍 Code Review Process

1. **Automated checks**
   - Build must pass
   - Type checking must pass
   - Security scan must pass

2. **Manual review**
   - Code quality
   - Security review
   - Performance impact
   - UX/UI alignment

3. **Approval**
   - At least one approval needed
   - All conversations resolved
   - Merge to main

## 📁 File Structure

```
src/
├── pages/           # Route components
├── components/      # Reusable components
├── store/          # State management
├── lib/            # Utilities & Supabase client
└── App.tsx         # Main app
```

Add new files in appropriate directories.

## 🔐 Security Guidelines

### Do's
- ✅ Validate all inputs
- ✅ Use TypeScript strict mode
- ✅ Check for XSS vulnerabilities
- ✅ Verify user permissions
- ✅ Use environment variables for secrets

### Don'ts
- ❌ Hardcode API keys or secrets
- ❌ Use `innerHTML` with user data
- ❌ Trust client-side validation alone
- ❌ Store sensitive data in localStorage
- ❌ Skip authentication checks

## 🎨 Design Guidelines

- Keep UI consistent
- Follow Tailwind CSS conventions
- Mobile-first responsive design
- Accessible colors and contrast
- Clear error messages

## 📚 Documentation

Update docs when you:
- Add new features
- Change how something works
- Fix unclear documentation

Files to update:
- `README.md` - overview
- `SETUP.md` - setup instructions
- `SECURITY.md` - security changes
- Code comments for complex logic

## 🚀 Deployment

After merge to main:
1. GitHub Actions builds automatically
2. Cloudflare Pages deploys automatically
3. Takes ~2 minutes
4. Check Cloudflare dashboard for status

## 📝 Common Tasks

### Add a new page
1. Create `src/pages/YourPage.tsx`
2. Add route in `src/App.tsx`
3. Add navigation link in `src/components/Navigation.tsx`

### Add a new database table
1. Add SQL to migration file
2. Create RLS policies
3. Update Supabase docs
4. Test locally

### Update dependencies
```bash
npm update
npm audit fix
npm run type-check
```

## 🐛 Debugging Tips

### Frontend Issues
- Open DevTools (F12)
- Check Console for errors
- Check Network tab for API calls
- Use React DevTools extension

### Supabase Issues
- Check Supabase logs (Dashboard → Logs)
- Verify RLS policies are correct
- Check API response in Network tab

### Build Issues
- Clear cache: `rm -rf node_modules && npm install`
- Check build log: `npm run build`
- Verify TypeScript: `npm run type-check`

## 📞 Getting Help

- Create a Discussion for questions
- Comment on related issues
- Check existing issues and docs
- Ask in pull request reviews

## 🎯 Good First Issues

Look for issues labeled `good-first-issue` to get started!

Examples:
- Documentation improvements
- Bug fixes with clear steps
- Small features or enhancements
- Code cleanup

## 📚 Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [React Docs](https://react.dev)
- [Supabase Docs](https://supabase.com/docs)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Git Documentation](https://git-scm.com/doc)

## 🎉 Thank You!

Your contributions make MarketHub better. Thank you for being part of the community!

---

Questions? Open an issue or start a discussion.
