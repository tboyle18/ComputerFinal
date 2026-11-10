import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})

// Security: Validate user before any data operation
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// Security: Get user profile with verification
export async function getUserProfile(userId: string) {
  const currentUser = await getCurrentUser()
  if (!currentUser) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) throw error
  return data
}

// Security: Sanitize and validate file uploads
export function validateImageFile(file: File): boolean {
  const maxSize = 5 * 1024 * 1024 // 5MB
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']

  if (file.size > maxSize) return false
  if (!allowedTypes.includes(file.type)) return false

  return true
}

// Security: Upload image with validation and secure path
export async function uploadListingImage(
  userId: string,
  listingId: number,
  file: File
): Promise<string> {
  if (!validateImageFile(file)) {
    throw new Error('Invalid image file')
  }

  const fileExt = file.name.split('.').pop()
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(7)
  const fileName = `${userId}/${listingId}/${timestamp}-${random}.${fileExt}`

  const { error } = await supabase.storage
    .from('listing-images')
    .upload(fileName, file)

  if (error) throw error

  const { data: { publicUrl } } = supabase.storage
    .from('listing-images')
    .getPublicUrl(fileName)

  return publicUrl
}

// Security: Delete image with ownership verification
export async function deleteListingImage(imageUrl: string) {
  const currentUser = await getCurrentUser()
  if (!currentUser) throw new Error('Not authenticated')

  const path = imageUrl.split('/storage/v1/object/public/listing-images/')[1]
  if (!path) throw new Error('Invalid image URL')

  // Verify ownership by checking if path starts with user ID
  if (!path.startsWith(currentUser.id)) {
    throw new Error('Unauthorized to delete this image')
  }

  const { error } = await supabase.storage
    .from('listing-images')
    .remove([path])

  if (error) throw error
}
