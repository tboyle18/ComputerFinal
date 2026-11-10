import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { UserFacingError } from '../lib/errors';
import { CARD_COLUMNS, type ListingStatus } from './listings';

/*
 * NOTE: hiding the admin UI from non-admins is only cosmetic. Every function
 * below is authorised by the database (or the Edge Function, which asks the
 * database), and requires an admin account on a 2FA (aal2) session.
 */

export async function getAdminStatus(): Promise<{ is_admin: boolean; aal: string }> {
  const { data, error } = await supabase.rpc('admin_status');
  if (error) throw error;
  return data as { is_admin: boolean; aal: string };
}

export interface AdminStats {
  users: number;
  users_7d: number;
  suspended_users: number;
  active_listings: number;
  sold_listings: number;
  removed_listings: number;
  orders: number;
  gmv_cents: number;
  open_reports: number;
}

export async function getAdminStats(): Promise<AdminStats> {
  const { data, error } = await supabase.rpc('admin_stats');
  if (error) throw error;
  return data as unknown as AdminStats;
}

export async function listUsers(search: string, page: number, pageSize = 25) {
  const { data, error } = await supabase.rpc('admin_list_users', {
    p_search: search || undefined,
    p_limit: pageSize,
    p_offset: page * pageSize,
  });
  if (error) throw error;
  return data ?? [];
}
export type AdminUser = Awaited<ReturnType<typeof listUsers>>[number];

export async function adminListings(search: string, status: ListingStatus, page: number, pageSize = 25) {
  const { data, error } = await supabase
    .rpc('search_listings', {
      p_query: search || undefined,
      p_status: status,
      p_limit: pageSize,
      p_offset: page * pageSize,
    })
    .select(`${CARD_COLUMNS}, removed_reason, seller:profiles!listings_seller_fkey(id, display_name)`);
  if (error) throw error;
  return data ?? [];
}

export async function setListingStatus(listingId: string, action: 'remove' | 'restore', reason?: string) {
  const { error } = await supabase.rpc('admin_set_listing_status', {
    p_listing_id: listingId,
    p_action: action,
    p_reason: reason,
  });
  if (error) throw error;
}

export async function listReports(status: 'open' | 'resolved') {
  const { data, error } = await supabase
    .from('reports')
    .select(
      'id, reason, details, status, created_at, resolved_at, listing:listings(id, title, status, image_paths, seller_id), reporter:profiles!reports_reporter_fkey(id, display_name)',
    )
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return data ?? [];
}

export async function resolveReport(reportId: string) {
  const { error } = await supabase.rpc('admin_resolve_report', { p_report_id: reportId });
  if (error) throw error;
}

export async function getAuditLog() {
  const { data, error } = await supabase
    .from('admin_audit_log')
    .select('id, admin_id, action, target_type, target_id, details, created_at')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  const adminIds = [...new Set((data ?? []).map((r) => r.admin_id).filter((x): x is string => !!x))];
  const names = new Map<string, string>();
  if (adminIds.length) {
    const { data: profiles } = await supabase.from('profiles').select('id, display_name').in('id', adminIds);
    for (const p of profiles ?? []) names.set(p.id, p.display_name);
  }
  return (data ?? []).map((r) => ({ ...r, admin_name: r.admin_id ? (names.get(r.admin_id) ?? 'Unknown') : 'Deleted admin' }));
}

/** Calls an Edge Function and surfaces its (self-written, safe) error message. */
export async function invokeFunction(name: 'admin-users' | 'delete-account', body: Record<string, unknown>) {
  const { error } = await supabase.functions.invoke(name, { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const payload = (await error.context.json().catch(() => null)) as { error?: unknown } | null;
      if (payload && typeof payload.error === 'string') throw new UserFacingError(payload.error);
    }
    throw new UserFacingError('The request failed. Please try again.');
  }
}

export const moderateUser = (action: 'suspend' | 'unsuspend' | 'delete', userId: string, reason?: string) =>
  invokeFunction('admin-users', { action, user_id: userId, reason });
