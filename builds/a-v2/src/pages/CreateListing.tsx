import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import { supabase, uploadListingImage, validateImageFile, deleteListingImage } from '../lib/supabase'
import { Plus, X } from 'lucide-react'

interface Category {
  id: number
  name: string
}

interface PreviewImage {
  url: string
  file?: File
  isPreview?: boolean
}

export default function CreateListing() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [categories, setCategories] = useState<Category[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [images, setImages] = useState<PreviewImage[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [uploadProgress, setUploadProgress] = useState(0)

  useEffect(() => {
    loadCategories()
  }, [])

  const loadCategories = async () => {
    try {
      const { data, error: err } = await supabase
        .from('categories')
        .select('*')
        .order('name', { ascending: true })

      if (err) throw err
      setCategories(data || [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load categories'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const maxImages = 5

    if (images.length + files.length > maxImages) {
      setError(`Maximum ${maxImages} images allowed`)
      return
    }

    files.forEach((file) => {
      // Security: Validate image file
      if (!validateImageFile(file)) {
        setError('Invalid image file (max 5MB, JPEG/PNG/WebP only)')
        return
      }

      const reader = new FileReader()
      reader.onload = (event) => {
        setImages((prev) => [
          ...prev,
          {
            url: event.target?.result as string,
            file,
            isPreview: true,
          },
        ])
      }
      reader.readAsDataURL(file)
    })

    // Reset input
    e.target.value = ''
  }

  const handleRemoveImage = async (index: number) => {
    const image = images[index]

    // If it's an uploaded image, delete from storage
    if (!image.isPreview) {
      try {
        await deleteListingImage(image.url)
      } catch (err) {
        console.error('Failed to delete image:', err)
      }
    }

    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Security: Validate input
    if (!title.trim() || !description.trim() || !price || !categoryId) {
      setError('All fields are required')
      return
    }

    if (parseFloat(price) <= 0) {
      setError('Price must be greater than 0')
      return
    }

    if (images.length === 0) {
      setError('At least one image is required')
      return
    }

    if (title.length > 200) {
      setError('Title must be 200 characters or less')
      return
    }

    if (description.length > 5000) {
      setError('Description must be 5000 characters or less')
      return
    }

    try {
      setSaving(true)
      setUploadProgress(0)

      // Create listing
      const { data: listing, error: listingError } = await supabase
        .from('listings')
        .insert({
          seller_id: user?.id,
          title: title.trim(),
          description: description.trim(),
          price: parseFloat(price),
          category_id: categoryId,
        })
        .select()
        .single()

      if (listingError) throw listingError

      // Upload images
      const uploadPromises = images.map(async (img, idx) => {
        if (img.isPreview && img.file) {
          try {
            const imageUrl = await uploadListingImage(user!.id, listing.id, img.file)
            return { image_url: imageUrl, display_order: idx }
          } catch (err) {
            console.error('Failed to upload image:', err)
            return null
          }
        }
        return null
      })

      const uploadedImages = await Promise.all(uploadPromises)
      const validImages = uploadedImages.filter((img) => img !== null)

      if (validImages.length > 0) {
        const { error: imagesError } = await supabase
          .from('listing_images')
          .insert(validImages.map((img) => ({ listing_id: listing.id, ...img })))

        if (imagesError) throw imagesError
      }

      navigate(`/listing/${listing.id}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create listing'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-50 py-12">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold mb-2">Create a Listing</h1>
          <p className="text-gray-600 mb-8">List an item for sale on MarketHub</p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="Excellent used laptop..."
                disabled={saving}
              />
              <p className="text-sm text-gray-500 mt-1">{title.length}/200</p>
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                value={categoryId || ''}
                onChange={(e) => setCategoryId(parseInt(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                disabled={saving}
              >
                <option value="">Select a category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Price */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Price ($)
              </label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                step="0.01"
                min="0"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="99.99"
                disabled={saving}
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={5000}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-none h-32"
                placeholder="Describe your item in detail..."
                disabled={saving}
              />
              <p className="text-sm text-gray-500 mt-1">{description.length}/5000</p>
            </div>

            {/* Images */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Images (Max 5)
              </label>

              {/* Image Preview Grid */}
              {images.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                  {images.map((img, idx) => (
                    <div key={idx} className="relative group">
                      <img
                        src={img.url}
                        alt={`Preview ${idx + 1}`}
                        className="w-full h-32 object-cover rounded-lg border-2 border-gray-200"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(idx)}
                        className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload Area */}
              {images.length < 5 && (
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-6 cursor-pointer hover:border-primary transition">
                  <Plus size={32} className="text-gray-400 mb-2" />
                  <p className="text-gray-600 font-medium">Click to upload images</p>
                  <p className="text-gray-500 text-sm">JPEG, PNG or WebP (Max 5MB)</p>
                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleImageSelect}
                    className="hidden"
                    disabled={saving}
                  />
                </label>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-primary text-white py-3 rounded-lg hover:bg-blue-600 disabled:bg-gray-400 transition font-medium"
            >
              {saving ? `Creating Listing... ${uploadProgress}%` : 'Create Listing'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
