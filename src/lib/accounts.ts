import { supabase } from './supabase';
import { friendlyError } from '@/store/authStore';

// Worker login accounts live in Supabase Auth (auth.users). They are created
// / updated / deleted by SECURITY DEFINER SQL functions that only an admin
// may call (see supabase/schema.sql).

type Res<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

export async function createWorkerAccount(p: { workerId: string; name: string; username: string; email: string; password: string }): Promise<Res<string>> {
  const { data, error } = await supabase.rpc('create_worker_account', {
    p_worker_id: p.workerId,
    p_name: p.name.trim(),
    p_username: p.username.trim(),
    p_email: p.email.trim().toLowerCase(),
    p_password: p.password,
  });
  if (error) return { ok: false, error: friendlyError(error) };
  return { ok: true, data: data as string };
}

export async function updateWorkerAccount(p: { userId: string; name: string; username: string; email: string; password?: string }): Promise<Res> {
  const { error } = await supabase.rpc('update_worker_account', {
    p_user_id: p.userId,
    p_name: p.name.trim(),
    p_username: p.username.trim(),
    p_email: p.email.trim().toLowerCase(),
    p_password: p.password || null,
  });
  if (error) return { ok: false, error: friendlyError(error) };
  return { ok: true };
}

export async function deleteWorkerAccount(userId: string): Promise<Res> {
  const { error } = await supabase.rpc('delete_worker_account', { p_user_id: userId });
  if (error) return { ok: false, error: friendlyError(error) };
  return { ok: true };
}
