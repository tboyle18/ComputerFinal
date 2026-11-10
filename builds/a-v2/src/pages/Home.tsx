import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Search, ChevronRight } from 'lucide-react'

interface Category {
  id: number
  name: string
  slug: string
}

interface Listing {
  id: number
  title: string
  price: number
  category: Category
  seller_id: string
  listing_images: Array<{ image_url: string }>
}

export default function Home() {
  const [listings, setListings] = useState<Listing[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadListings()
    loadCategories()
  }, [searchTerm, selectedCategory])

  const loadListings = async () => {
    try {
      setLoading(true)
      setError('')

      let query = supabase
        .from('listings')
        .select(`
          id,
          title,
          price,
          seller_id,
          category:categories(id, name, slug),
          listing_images(image_url)
        `)
        .eq('status', 'active')

      if (selectedCategory) {
        query = query.eq('category_id', selectedCategory)
      }

      if (searchTerm) {
        query = query.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
      }

      const { data, error: err } = await query

      if (err) throw err
      setListings((data as any) || [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load listings'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const loadCategories = async () => {
    try {
      const { data, error: err } = await supabase
        .from('categories')
        .select('*')
        .order('name', { ascending: true })

      if (err) throw err
      setCategories(data || [])
    } catch (err) {
      console.error('Failed to load categories:', err)
    }
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-primary to-blue-600 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold mb-4">Find Amazing Deals</h1>
          <p className="text-blue-100 mb-8 text-lg">Buy and sell items from people in your community</p>

          <div className="relative max-w-2xl">
            <input
              type="text"
              placeholder="Search listings..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-6 py-3 rounded-lg text-gray-900 text-lg"
            />
            <Search className="absolute right-4 top-3.5 text-gray-400" size={24} />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Categories */}
        <div className="mb-12">
          <h2 className="text-xl font-bold mb-4">Browse Categories</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                className={`p-4 rounded-lg border-2 transition text-center font-medium ${
                  selectedCategory === cat.id
                    ? 'border-primary bg-blue-50 text-primary'
                    : 'border-gray-200 bg-white hover:border-primary'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Listings Grid */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-8">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : listings.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg">No listings found. Try adjusting your search.</p>
          </div>
        ) : (
          <div>
            <h2 className="text-xl font-bold mb-6">
              {selectedCategory ? `${categories.find(c => c.id === selectedCategory)?.name} Listings` : 'All Listings'} ({listings.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {listings.map((listing) => (
                <Link
                  key={listing.id}
                  to={`/listing/${listing.id}`}
                  className="group bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-lg transition"
                >
                  {/* Image */}
                  <div className="relative h-48 bg-gray-200 overflow-hidden">
                    {listing.listing_images && listing.listing_images.length > 0 ? (
                      <img
                        src={listing.listing_images[0].image_url}
                        alt={listing.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full bg-gray-300 text-gray-500">
                        No Image
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-4">
                    <p className="text-sm text-primary font-medium mb-1">
                      {listing.category.name}
                    </p>
                    <h3 className="font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-primary transition">
                      {listing.title}
                    </h3>
                    <div className="flex justify-between items-center">
                      <p className="text-lg font-bold text-primary">
                        ${listing.price.toFixed(2)}
                      </p>
                      <ChevronRight size={20} className="text-gray-400 group-hover:text-primary transition" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
