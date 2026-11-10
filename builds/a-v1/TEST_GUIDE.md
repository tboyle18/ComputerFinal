# 🧪 Test Guide - HaikuMart Marketplace

Complete testing guide for the marketplace. Follow these steps to thoroughly test all features.

## Prerequisites

- Supabase project created and database set up (see README)
- App running locally: `npm run dev`
- Browser open to `http://localhost:5173`

---

## 1. Authentication Testing

### Sign Up
- [ ] Click "Sign Up"
- [ ] Enter new email (e.g., buyer1@test.com)
- [ ] Enter password (e.g., password123)
- [ ] Click "Sign Up"
- [ ] Should redirect to home page
- [ ] Email should appear in navbar

### Login
- [ ] Click "Logout" 
- [ ] Click "Sign Up" → switch to "Sign In"
- [ ] Login with previous credentials
- [ ] Should see home page and email in navbar

### Multiple Accounts
- [ ] Create at least 3 test accounts:
  - seller1@test.com
  - seller2@test.com
  - buyer1@test.com

---

## 2. Seller Testing (Create Listings)

**Login as:** seller1@test.com

### Create Listing
- [ ] Click "Sell" in navbar
- [ ] Fill in:
  - **Title:** "Vintage Camera"
  - **Category:** "Electronics"
  - **Price:** "150"
  - **Description:** "Great condition, works perfectly"
  - **Image:** Upload any image
- [ ] Click "Create Listing"
- [ ] Should redirect to profile page
- [ ] Listing should appear in "My Listings" table

### Create Multiple Listings
- [ ] Create at least 5 listings with different:
  - Titles
  - Categories
  - Prices
  - Images
- [ ] Verify all appear in profile

### Edit/Delete Listings
- [ ] Go to Profile
- [ ] Click "Delete" on one listing
- [ ] Confirm deletion
- [ ] Listing should be removed

---

## 3. Buyer Testing (Browse & Search)

**Login as:** buyer1@test.com

### Browse Listings
- [ ] Go to Home page
- [ ] Verify all seller listings appear
- [ ] Check listing cards show:
  - Product image
  - Title
  - Category badge
  - Price
  - Seller name

### Search Functionality
- [ ] Type in search box: "camera"
- [ ] Results should filter to matching listings
- [ ] Clear search and verify all listings return

### Category Filtering
- [ ] Click "Electronics" category
- [ ] Only electronics listings should show
- [ ] Try other categories
- [ ] Click "All" to reset

### Favorites/Wishlist
- [ ] Click heart icon on a listing
- [ ] Heart should turn red
- [ ] Click again to unfavorite
- [ ] Heart should turn gray

---

## 4. Listing Detail Testing

**Still logged in as:** buyer1@test.com

### View Listing Details
- [ ] Click on any listing card
- [ ] Should see full details page with:
  - Large product image
  - Full title
  - Full description
  - Price
  - Seller info
  - Message form
  - "Add to Cart" button
  - "Share" button

### Message Seller
- [ ] Type message: "Is this still available?"
- [ ] Click "Send Message"
- [ ] Message should send (success notification)
- [ ] Message should save in database

---

## 5. Shopping Cart Testing

**Still logged in as:** buyer1@test.com

### Add to Cart
- [ ] On listing detail page, click "Add to Cart"
- [ ] Should see confirmation message
- [ ] Should redirect to cart page

### View Cart
- [ ] Click cart icon in navbar
- [ ] Should see items with:
  - Product image
  - Title
  - Price
  - Quantity
  - Subtotal
- [ ] Total should calculate correctly

### Remove from Cart
- [ ] Click trash icon next to item
- [ ] Item should remove
- [ ] Total should recalculate

### Multiple Items in Cart
- [ ] Add items from different sellers
- [ ] All should appear in cart
- [ ] Subtotals should be correct

---

## 6. Checkout Testing

**Still logged in as:** buyer1@test.com

### Complete Checkout
- [ ] Have items in cart
- [ ] Click "Proceed to Checkout"
- [ ] Should see order confirmation
- [ ] Cart should empty

### Verify Order Created
- [ ] Click "Orders" in navbar
- [ ] Should see completed order with:
  - Order ID
  - Date
  - Items purchased
  - Quantities
  - Total amount
  - "Completed" status

---

## 7. User Profile Testing

**Try each account:**

### View Profile
- [ ] Click username in navbar
- [ ] Should see:
  - Username
  - Email
  - Join date
  - Number of listings (for sellers)

### My Listings
- [ ] Seller profile should show "My Listings" table
- [ ] Buyer profile shows "No listings yet"
- [ ] Can delete listings from table

---

## 8. Admin Testing

### Make User Admin
- [ ] Login to Supabase Dashboard
- [ ] Go to profiles table
- [ ] Find buyer1@test.com row
- [ ] Set `is_admin = true`
- [ ] Click "Update"

### Access Admin Dashboard
- [ ] Logout and login again as buyer1@test.com
- [ ] Should see "Admin" link in navbar
- [ ] Click it

### Admin Features
- [ ] View "Overview" tab - see:
  - Total users count
  - Total listings count
  - Total orders count

- [ ] View "Users" tab - see:
  - List of all users
  - Their emails
  - Join dates
  - Delete button for each

- [ ] View "Listings" tab - see:
  - All listings
  - Titles, prices, categories
  - Status badges
  - Delete button for each

### Delete User
- [ ] Click delete on a test user
- [ ] Confirm deletion
- [ ] User should be removed from list

### Delete Listing
- [ ] Click delete on a test listing
- [ ] Listing should be removed from list

---

## 9. Mobile Responsiveness Testing

**Resize browser to test mobile (or use mobile device):**

- [ ] Home page responsive
- [ ] Navigation collapses/adapts
- [ ] Cards stack vertically
- [ ] Buttons still clickable
- [ ] Images scale properly
- [ ] Forms readable and usable
- [ ] Cart page responsive
- [ ] All text readable

---

## 10. Performance Testing

### Page Load Times
- [ ] Home page loads in < 2 seconds
- [ ] Listing details load quickly
- [ ] Cart loads instantly
- [ ] Admin dashboard responsive

### Image Loading
- [ ] Images load without flickering
- [ ] Lazy loading works (scroll to see)
- [ ] Images responsive on different sizes

---

## 11. Edge Cases & Error Handling

### Empty States
- [ ] New buyer with no orders - shows "No orders"
- [ ] New seller with no listings - shows "No listings yet"
- [ ] Empty cart - shows appropriate message
- [ ] Empty search results - shows "No listings found"

### Form Validation
- [ ] Try creating listing without title - should show error
- [ ] Try empty description - should show error
- [ ] Try invalid email on signup - should show error
- [ ] Try weak password - should accept or show error

### Data Persistence
- [ ] Refresh page - should stay logged in
- [ ] Refresh on listing detail - should persist data
- [ ] Refresh in cart - items should still be there
- [ ] Logout and login - should see same profile

---

## 12. Cross-User Interactions

**Use 2 browser windows/tabs:**

### Window 1: Login as seller1@test.com
- [ ] Create a listing

### Window 2: Login as buyer1@test.com
- [ ] Refresh home page
- [ ] New listing should appear
- [ ] Can add to cart and purchase
- [ ] Can message seller

### Back to Window 1
- [ ] Refresh orders page (if implemented)
- [ ] Should see new order

---

## 13. Database Verification

### Check Supabase Tables
- [ ] Open Supabase Dashboard
- [ ] Verify data in each table:
  - **profiles** - all users present
  - **listings** - all created items
  - **orders** - all purchases
  - **order_items** - items in orders
  - **messages** - seller messages
  - **cart_items** - items in carts
  - **favorites** - favorited items

---

## 14. Deployment Readiness Checklist

- [ ] All features tested locally
- [ ] No console errors (check DevTools)
- [ ] No database errors in Supabase logs
- [ ] Mobile responsive tested
- [ ] Performance acceptable
- [ ] Images upload and display
- [ ] All CRUD operations work (Create, Read, Update, Delete)

---

## Test Results Summary

| Feature | Status | Notes |
|---------|--------|-------|
| Sign up | ✓/✗ | |
| Login/Logout | ✓/✗ | |
| Create Listing | ✓/✗ | |
| Browse Listings | ✓/✗ | |
| Search | ✓/✗ | |
| Filter Categories | ✓/✗ | |
| View Details | ✓/✗ | |
| Message Seller | ✓/✗ | |
| Add to Cart | ✓/✗ | |
| Checkout | ✓/✗ | |
| Order History | ✓/✗ | |
| Admin Dashboard | ✓/✗ | |
| Delete User | ✓/✗ | |
| Delete Listing | ✓/✗ | |
| Mobile Responsive | ✓/✗ | |
| Image Upload | ✓/✗ | |

---

## Issues Found

Document any bugs or issues:

1. **Issue:** [Description]
   - **Steps to reproduce:**
   - **Expected behavior:**
   - **Actual behavior:**

2. **Issue:** [Description]
   - **Steps to reproduce:**
   - **Expected behavior:**
   - **Actual behavior:**

---

## Ready to Deploy?

When all tests pass:
1. ✅ All features working
2. ✅ No console errors
3. ✅ Mobile responsive
4. ✅ Database verified

You're ready to deploy to Cloudflare Pages! 🚀

See README.md for deployment instructions.
