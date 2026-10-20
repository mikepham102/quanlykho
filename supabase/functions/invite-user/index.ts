import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors });
  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return Response.json({ error: 'Cần đăng nhập.' }, { status: 401, headers: cors });
  const caller = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: { user }, error: authError } = await caller.auth.getUser(token);
  if (authError || !user) return Response.json({ error: 'Phiên đăng nhập không hợp lệ.' }, { status: 401, headers: cors });
  const { data: role, error: roleError } = await caller.rpc('current_workspace_role');
  if (roleError || role !== 'owner') return Response.json({ error: 'Chỉ chủ quán được tạo tài khoản.' }, { status: 403, headers: cors });
  let body: { email?: string; role?: string };
  try { body = await req.json(); } catch { return Response.json({ error: 'Dữ liệu không hợp lệ.' }, { status: 400, headers: cors }); }
  const email = body.email?.trim().toLowerCase();
  const accountRole = body.role;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !['manager', 'employee'].includes(accountRole || '')) {
    return Response.json({ error: 'Nhập email hợp lệ và chọn Quản lý hoặc Nhân viên.' }, { status: 400, headers: cors });
  }
  const admin = createClient(url, service);
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email);
  if (error || !data.user) return Response.json({ error: error?.message || 'Không gửi được lời mời.' }, { status: 400, headers: cors });
  const { error: updateError } = await admin.from('user_profiles').update({ role: accountRole }).eq('user_id', data.user.id);
  if (updateError) return Response.json({ error: updateError.message }, { status: 500, headers: cors });
  return Response.json({ ok: true, email, role: accountRole }, { headers: cors });
});
