import {
  Baby,
  Bike,
  BookOpen,
  Gamepad2,
  Gem,
  Laptop,
  Music,
  Package,
  Shirt,
  Sofa,
  type LucideIcon,
} from 'lucide-react'

export type CategoryInfo = { slug: string; name: string; icon: LucideIcon; tint: string }

// Mirrors the rows seeded into public.categories. If you add a category in the
// database, add it here too so it gets an icon and shows up in the filters.
export const CATEGORIES: CategoryInfo[] = [
  { slug: 'electronics', name: 'Electronics', icon: Laptop, tint: '#7c8cff' },
  { slug: 'fashion', name: 'Fashion', icon: Shirt, tint: '#ff7a9c' },
  { slug: 'home', name: 'Home & Living', icon: Sofa, tint: '#f2a65a' },
  { slug: 'sports', name: 'Sports & Outdoors', icon: Bike, tint: '#45c486' },
  { slug: 'collectibles', name: 'Collectibles & Art', icon: Gem, tint: '#b07cff' },
  { slug: 'books', name: 'Books', icon: BookOpen, tint: '#d6a36b' },
  { slug: 'gaming', name: 'Gaming', icon: Gamepad2, tint: '#4cc3e0' },
  { slug: 'music', name: 'Music', icon: Music, tint: '#ff8a5c' },
  { slug: 'kids', name: 'Kids & Baby', icon: Baby, tint: '#f5c84c' },
  { slug: 'other', name: 'Other', icon: Package, tint: '#9a9a92' },
]

export function getCategory(slug: string | null | undefined): CategoryInfo {
  return CATEGORIES.find((c) => c.slug === slug) ?? CATEGORIES[CATEGORIES.length - 1]
}
