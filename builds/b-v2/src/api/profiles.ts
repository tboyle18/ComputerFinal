import { supabase } from '../lib/supabase';
import { processImage, removeImages, uploadImage } from '../lib/images';

// Only public columns. Email and suspension status are never selectable.
const PROFILE_COLUMNS = 'id, display_name, bio, location, avatar_path, created_at' as const;

export async function getProfile(id: string) {
  const { data, error } = await supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}
export type Profile = NonNullable<Awaited<ReturnType<typeof getProfile>>>;

export async function updateProfile(
  id: string,
  patch: Partial<Pick<Profile, 'display_name' | 'bio' | 'location' | 'avatar_path'>>,
) {
  const { data, error } = await supabase.from('profiles').update(patch).eq('id', id).select(PROFILE_COLUMNS).single();
  if (error) throw error;
  return data;
}

export async function replaceAvatar(userId: string, file: File, previousPath: string | null) {
  const blob = await processImage(file, 'avatars');
  const path = await uploadImage('avatars', userId, blob);
  try {
    const profile = await updateProfile(userId, { avatar_path: path });
    if (previousPath) await removeImages('avatars', [previousPath]);
    return profile;
  } catch (err) {
    await removeImages('avatars', [path]);
    throw err;
  }
}

export async function removeAvatar(userId: string, path: string) {
  const profile = await updateProfile(userId, { avatar_path: null });
  await removeImages('avatars', [path]);
  return profile;
}

export async function getSellerStats(sellerId: string) {
  const [active, sold] = await Promise.all(
    (['active', 'sold'] as const).map((status) =>
      supabase.from('listings').select('id', { count: 'exact', head: true }).eq('seller_id', sellerId).eq('status', status),
    ),
  );
  return { active: active?.count ?? 0, sold: sold?.count ?? 0 };
}
