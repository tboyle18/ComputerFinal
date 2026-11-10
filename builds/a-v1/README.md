# 🛍️ HaikuMart - Test Marketplace

A modern online marketplace for testing. Browse, buy, and sell items with a full-featured backend.

## ⚡ Quick Start (2 minutes)

```bash
npm install
npm run dev
```

Visit: **http://localhost:5173**

## 🎯 Features

**Buyers:**
- 🔍 Search & filter listings
- 💬 Message sellers
- 🛒 Shopping cart & checkout
- ⭐ Save favorites
- 📦 Order history

**Sellers:**
- 📤 Create listings with images
- 💰 Set prices & categories
- 📊 View sales

**Admins:**
- 👥 Manage users
- 📋 Manage listings
- 📈 View stats

## 🛠️ Tech Stack

- React 18 + Vite (frontend)
- Supabase (database + auth + storage)
- Cloudflare (deployment)

## 📋 Setup Instructions

### Step 1: Supabase Setup

1. Go to [supabase.com](https://supabase.com) → Create project
2. In SQL Editor → New Query
3. Copy all code from `SUPABASE_SETUP.sql` in this folder
4. Paste & run it in Supabase SQL Editor
5. Go to Settings → API, copy:
   - **Project URL**
   - **anon public key**

### Step 2: Environment Variables

Create `.env.local`:
```bash
cp .env.example .env.local
```

Edit with your Supabase credentials:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Step 3: Run Locally

```bash
npm install
npm run dev
```

Open **http://localhost:5173** and start testing! 🎉

## 🧪 Testing the Marketplace

### Create Test Accounts

1. Click **"Sign Up"**
2. Create accounts with different emails
3. Each user can create listings and buy from others

### Test as a Buyer

1. Browse listings on home page
2. Search for items
3. Filter by category
4. Click a listing to view details
5. Message the seller
6. Add to cart → Checkout
7. View order history

### Test as a Seller

1. Click **"Sell"**
2. Create a listing with:
   - Title
   - Description
   - Price
   - Category
   - Image upload
3. View in profile
4. Edit or delete your listings

### Test as Admin

1. Make your user admin:
   - In Supabase Dashboard
   - Open "profiles" table
   - Set `is_admin = true` for your user
2. Refresh app - see Admin dashboard link
3. Manage users and listings

## 📁 Project Structure

```
marketplace-app/
├── src/
│   ├── config/
│   │   └── supabase.js          # Supabase client setup
│   ├── components/
│   │   ├── Navigation.jsx       # Top navigation bar
│   │   └── Navigation.css
│   ├── pages/
│   │   ├── Home.jsx             # Browse all listings
│   │   ├── Auth.jsx             # Login & signup
│   │   ├── Profile.jsx          # User profile
│   │   ├── ListingDetail.jsx    # Single listing view
│   │   ├── CreateListing.jsx    # Create new listing
│   │   ├── Cart.jsx             # Shopping cart
│   │   ├── OrderHistory.jsx     # Past orders
│   │   ├── AdminDashboard.jsx   # Admin panel
│   │   └── *.css                # Styles for each page
│   ├── App.jsx                  # Main app with routing
│   └── App.css                  # Global styles
├── SUPABASE_SETUP.sql           # Database schema
├── .env.example                 # Environment variables template
├── package.json
└── vite.config.js
```

## Available Pages

| Page | Path | Access |
|------|------|--------|
| Browse Listings | / | Anyone |
| Login/Signup | /auth | Not logged in |
| My Profile | /profile | Logged in |
| Create Listing | /create | Logged in |
| Listing Details | /listing/:id | Anyone |
| Shopping Cart | /cart | Logged in |
| Order History | /orders | Logged in |
| Admin Dashboard | /admin | Admins only |

## Deploying to Cloudflare Pages (10 minutes)

### Step 1: Push to GitHub

1. Create a GitHub repository
2. Push your code:
```bash
git init
git add .
git commit -m "Initial marketplace commit"
git remote add origin https://github.com/YOUR_USERNAME/marketplace-app.git
git push -u origin main
```

### Step 2: Connect Cloudflare

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Click "Workers & Pages" → "Pages"
3. Click "Create a project" → "Connect to Git"
4. Authorize GitHub and select your repo
5. Click "Begin setup"

### Step 3: Configure Build

Cloudflare should auto-detect these, but verify:
- **Framework:** Vite
- **Build command:** `npm run build`
- **Build output directory:** `dist`

### Step 4: Add Environment Variables

1. In Cloudflare Pages settings, click "Environment variables"
2. Click "Add variables"
3. Add these for Production:
   - `VITE_SUPABASE_URL` = your Supabase URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon key
4. Click "Save"

### Step 5: Deploy!

1. Click "Save and deploy"
2. Cloudflare will build and deploy automatically
3. Your app is live at `your-project-name.pages.dev`

### (Optional) Custom Domain

1. In Cloudflare Pages, click "Custom domain"
2. Enter your domain (example.com)
3. Follow the DNS instructions
4. Your site is now at your custom domain!

## How It Works

### User Registration Flow
```
User signs up → Supabase Auth creates account → Profile created automatically
```

### Shopping Flow
```
Browse listings → Click listing → Add to cart → View cart → Checkout → Order created → Listings marked sold
```

### Messaging Flow
```
User clicks "Message Seller" → Message stored in database → Seller sees messages in their messages
```

### Admin Flow
```
Admin logs in → Can see Admin dashboard → View/delete users and listings
```

## Database Tables

### profiles
- `id` - User ID (from auth)
- `email` - User email
- `is_admin` - Admin flag
- `created_at` - Join date

### listings
- `id` - Unique listing ID
- `seller_id` - Who created it
- `title` - Item name
- `description` - Full description
- `price` - Item price
- `category` - Category (Electronics, Fashion, etc.)
- `image_url` - Picture URL
- `status` - active/sold/inactive
- `created_at` - When listed

### cart_items
- `id` - Cart item ID
- `user_id` - Buyer
- `listing_id` - Item in cart
- `quantity` - How many

### orders
- `id` - Order ID
- `user_id` - Buyer
- `total_amount` - Total price paid
- `status` - completed/pending/cancelled
- `created_at` - Purchase date

### order_items
- `id` - Item in order ID
- `order_id` - Which order
- `listing_id` - What was bought
- `quantity` - How many
- `price` - Price paid

### messages
- `id` - Message ID
- `sender_id` - Who sent it
- `receiver_id` - Who gets it
- `listing_id` - About which listing
- `content` - Message text
- `created_at` - When sent

### favorites
- `id` - Favorite ID
- `user_id` - Who favorited
- `listing_id` - What's favorited
- `created_at` - When favorited

## Customization

### Change App Name
Edit `Navigation.jsx` line 14:
```jsx
<span className="logo-text">🛍️ MyShop</span>
```

### Change Colors
Edit the gradient colors in CSS files. Currently using:
- Primary: `#667eea` (purple-ish)
- Secondary: `#764ba2` (darker purple)

Replace with your brand colors in:
- `Navigation.css`
- `Auth.css`
- `Home.css`
- `CreateListing.css`
- etc.

### Add More Categories
Edit `Home.jsx` and `CreateListing.jsx`:
```jsx
const CATEGORIES = ['Electronics', 'Fashion', 'Home', 'Books', 'Sports', 'Art', 'YOUR_CATEGORY'];
```

### Change Image Upload Size Limit
In `CreateListing.jsx`, add to file input:
```jsx
<input accept="image/*" onChange={handleImageChange} />
// Change accepted image types or add file size check
```

## Testing Checklist

- [ ] Sign up with new account
- [ ] Create a listing with image
- [ ] Search for a listing
- [ ] Filter by category
- [ ] Add listing to cart
- [ ] Complete checkout
- [ ] View order history
- [ ] Message another user
- [ ] Favorite a listing
- [ ] View profile
- [ ] (Admin) View admin dashboard
- [ ] (Admin) Delete a listing

## Troubleshooting

**"Cannot find module 'supabase'"**
```bash
npm install @supabase/supabase-js
```

**"Environment variables not loading"**
- Restart dev server after editing `.env.local`
- Make sure file is named `.env.local` (not `.env` or other)

**"Images not uploading"**
- Check Supabase storage bucket "listing-images" exists
- Verify RLS policies allow uploads
- Check image file size (keep under 5MB)

**"Admin dashboard not showing"**
- Make sure user has `is_admin = true` in profiles table
- Refresh page after updating

**"Cloudflare deploy fails"**
- Run `npm run build` locally to check for errors
- Verify environment variables are set in Cloudflare
- Check Cloudflare build logs for details

**"Listings not showing**
- Make sure listings have `status = 'active'`
- Check RLS policies in Supabase

## Next Steps

1. ✅ Run locally and test all features
2. 🎨 Customize colors and branding
3. 📱 Test on mobile (responsive design ready)
4. 🚀 Deploy to Cloudflare Pages
5. 💳 (Future) Add real payment processing with Stripe
6. ⭐ (Future) Add user reviews and ratings
7. 📧 (Future) Add email notifications

## Performance

- All images are lazy-loaded
- Database queries optimized with indexes
- CSS is minified in production
- Typical page load: < 2 seconds

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Android)

## Need Help?

- Supabase Docs: https://supabase.com/docs
- React Docs: https://react.dev
- Cloudflare Pages: https://pages.cloudflare.com
- Vite Docs: https://vite.dev

## License

MIT - Use freely for personal and commercial projects

---

**Built with ❤️ using React, Supabase, and Cloudflare**
