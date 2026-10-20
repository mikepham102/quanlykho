-- Role and shared state foundation for Mộc Inventory.
-- Run after creating the first Supabase Auth user; assign the shop owner role
-- manually using the bootstrap statement at the bottom of this file.
create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'employee' check (role in ('owner','manager','employee')),
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_state (
  id smallint primary key default 1 check (id = 1),
  state jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table public.user_profiles enable row level security;
alter table public.workspace_state enable row level security;
revoke all on public.user_profiles, public.workspace_state from anon, authenticated;

create or replace function public.current_workspace_role()
returns text language sql stable security definer set search_path = '' as $$
  select role from public.user_profiles where user_id = auth.uid()
$$;
revoke all on function public.current_workspace_role() from public, anon;
grant execute on function public.current_workspace_role() to authenticated;

create or replace function public.create_workspace_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.user_profiles(user_id, role) values(new.id, 'employee') on conflict (user_id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created_workspace_profile on auth.users;
create trigger on_auth_user_created_workspace_profile after insert on auth.users
for each row execute function public.create_workspace_profile();

create or replace function public.load_workspace_state()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare r text; s jsonb;
begin
  r := public.current_workspace_role();
  if r is null then raise exception 'Tài khoản chưa được phân quyền.' using errcode = '42501'; end if;
  select state into s from public.workspace_state where id = 1;
  if s is null then return null; end if;
  if r in ('employee','manager') then
    return s || jsonb_build_object('pos','[]'::jsonb,'imports','[]'::jsonb,'audits','[]'::jsonb,'suppliers','[]'::jsonb,'categories','[]'::jsonb,'favorites',jsonb_build_object('raw','[]'::jsonb,'prep','[]'::jsonb));
  end if;
  return s;
end $$;
revoke all on function public.load_workspace_state() from public, anon;
grant execute on function public.load_workspace_state() to authenticated;

create or replace function public.workspace_op_delta(o jsonb)
returns numeric language sql immutable set search_path = '' as $$
  select case o->>'kind'
    when 'stockin' then coalesce((o->>'rawQty')::numeric,0)
    when 'prep' then coalesce((o->>'rawQty')::numeric,0)
    when 'sale_return' then coalesce((o->>'rawQty')::numeric,0)
    when 'stockout' then -coalesce((o->>'rawQty')::numeric,0)
    when 'sale_issue' then -coalesce((o->>'rawQty')::numeric,0)
    when 'waste' then -coalesce((o->>'rawQty')::numeric,0)
    else 0 end
$$;

drop function if exists public.save_workspace_state(jsonb);
create function public.save_workspace_state(p_state jsonb)
returns bigint language plpgsql security definer set search_path = '' as $$
declare r text; old_state jsonb; next_state jsonb; old_item jsonb; new_item jsonb; iid text; delta numeric; expected numeric; next_revision bigint;
begin
  r := public.current_workspace_role();
  if r is null then raise exception 'Tài khoản chưa được phân quyền.' using errcode = '42501'; end if;
  if jsonb_typeof(p_state->'items') <> 'array' or jsonb_typeof(p_state->'ops') <> 'array' then
    raise exception 'Dữ liệu kho không hợp lệ.' using errcode = '22023';
  end if;
  select state into old_state from public.workspace_state where id = 1 for update;

  if old_state is null then
    if r <> 'owner' then raise exception 'Chủ quán cần khởi tạo dữ liệu dùng chung trước.' using errcode = '42501'; end if;
    next_state := jsonb_set(p_state,'{_revision}',to_jsonb(1::bigint),true);
    insert into public.workspace_state(id,state,updated_by) values(1,next_state,auth.uid());
    return 1;
  end if;

  if coalesce((p_state->>'_revision')::bigint,0) <> coalesce((old_state->>'_revision')::bigint,0) then
    raise exception 'Dữ liệu vừa được cập nhật trên thiết bị khác. Hãy tải lại trang trước khi lưu tiếp.' using errcode = '40001';
  end if;

  if r = 'owner' then
    next_state := p_state;
  else
    -- Managers and employees may update operations and quantities only. The
    -- canonical catalog, recipes, POS mappings and settings remain server-owned.
    select jsonb_agg(e.value - 'qty' order by e.value->>'id') into old_item from jsonb_array_elements(old_state->'items') as e(value);
    select jsonb_agg(e.value - 'qty' order by e.value->>'id') into new_item from jsonb_array_elements(p_state->'items') as e(value);
    if old_item is distinct from new_item then raise exception 'Vai trò này không được thay đổi cấu hình mặt hàng.' using errcode = '42501'; end if;

    if r = 'manager' and exists (
      select 1 from jsonb_array_elements(p_state->'ops') as n(value)
      where not exists(select 1 from jsonb_array_elements(old_state->'ops') as o(value) where o.value->>'id'=n.value->>'id' and o.value=n.value)
        and (n.value->>'kind' not in ('stockin','stockout','prep','sale_issue','sale_return','sale_waste','waste')
          or coalesce((n.value->>'rawQty')::numeric,0)<=0
          or not exists(select 1 from jsonb_array_elements(p_state->'items') as i(value)
            where i.value->>'id'=n.value->>'itemId'
              and ((n.value->>'kind' in ('stockin','stockout','waste') and i.value->>'type'='raw')
                or (n.value->>'kind' in ('prep','sale_issue','sale_return','sale_waste') and i.value->>'type'='prep'))))
    ) then raise exception 'Phiếu kho không hợp lệ.' using errcode = '22023'; end if;

    if r = 'employee' then
      if exists (
        select 1 from jsonb_array_elements(old_state->'ops') as o(oldop)
        where not exists (
          select 1 from jsonb_array_elements(p_state->'ops') as n(newop)
          where n.newop->>'id' = o.oldop->>'id' and n.newop = o.oldop
        )
      ) then raise exception 'Nhân viên không được sửa hoặc xóa phiếu đã lưu.' using errcode = '42501'; end if;
      if exists (
        select 1 from jsonb_array_elements(p_state->'ops') as n(newop)
        where not exists (select 1 from jsonb_array_elements(old_state->'ops') as o(oldop) where o.oldop->>'id' = n.newop->>'id')
          and ((n.newop->>'createdBy') is distinct from auth.uid()::text
            or n.newop->>'kind' not in ('stockin','stockout','prep','sale_issue','sale_return','sale_waste','waste')
            or coalesce((n.newop->>'rawQty')::numeric,0)<=0
            or not exists(select 1 from jsonb_array_elements(p_state->'items') as i(value)
              where i.value->>'id'=n.newop->>'itemId'
                and ((n.newop->>'kind' in ('stockin','stockout','waste') and i.value->>'type'='raw')
                  or (n.newop->>'kind' in ('prep','sale_issue','sale_return','sale_waste') and i.value->>'type'='prep'))))
      ) then raise exception 'Phiếu mới không hợp lệ với quyền nhân viên.' using errcode = '42501'; end if;
    end if;

    -- Prevent changing a balance directly: the balance difference must equal
    -- the net effect of operations added/edited/deleted in this save.
    for new_item in select e.value from jsonb_array_elements(p_state->'items') as e(value) loop
      iid := new_item->>'id';
      select e.value into old_item from jsonb_array_elements(old_state->'items') as e(value) where e.value->>'id' = iid;
      if old_item is null then raise exception 'Không được thêm hoặc xóa mặt hàng ở vai trò này.' using errcode = '42501'; end if;
      select coalesce(sum(delta_value),0) into delta from (
        select public.workspace_op_delta(n.value) as delta_value from jsonb_array_elements(p_state->'ops') as n(value)
          where n.value->>'itemId'=iid and not exists(select 1 from jsonb_array_elements(old_state->'ops') as o(value) where o.value->>'id'=n.value->>'id')
        union all
        select -public.workspace_op_delta(o.value) from jsonb_array_elements(old_state->'ops') as o(value)
          where o.value->>'itemId'=iid and not exists(select 1 from jsonb_array_elements(p_state->'ops') as n(value) where n.value->>'id'=o.value->>'id')
        union all
        select public.workspace_op_delta(n.value)-public.workspace_op_delta(o.value)
          from jsonb_array_elements(p_state->'ops') as n(value) join jsonb_array_elements(old_state->'ops') as o(value) on n.value->>'id'=o.value->>'id'
          where (n.value->>'itemId'=iid or o.value->>'itemId'=iid) and n.value is distinct from o.value
      ) effects;
      expected := coalesce((old_item->>'qty')::numeric,0) + delta;
      if expected < -0.000001 then raise exception 'Giao dịch không thể làm tồn kho âm.' using errcode = '22023'; end if;
      if abs(coalesce((new_item->>'qty')::numeric,0)-expected) > 0.000001 then
        raise exception 'Số tồn chỉ được thay đổi theo phiếu kho.' using errcode = '42501';
      end if;
    end loop;
    next_state := old_state || jsonb_build_object('ops',p_state->'ops','items',p_state->'items');
  end if;

  next_revision := coalesce((old_state->>'_revision')::bigint,0)+1;
  next_state := jsonb_set(next_state,'{_revision}',to_jsonb(next_revision),true);
  insert into public.workspace_state(id,state,updated_by) values(1,next_state,auth.uid())
  on conflict(id) do update set state=excluded.state,updated_at=now(),updated_by=auth.uid();
  return next_revision;
end $$;
revoke all on function public.save_workspace_state(jsonb) from public, anon;
grant execute on function public.save_workspace_state(jsonb) to authenticated;

create or replace function public.list_workspace_users()
returns table(user_id uuid,email text,role text,created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if public.current_workspace_role() <> 'owner' then raise exception 'Chỉ chủ quán được quản lý tài khoản.' using errcode = '42501'; end if;
  return query select p.user_id,u.email::text,p.role,p.created_at from public.user_profiles p join auth.users u on u.id=p.user_id order by p.created_at;
end $$;
revoke all on function public.list_workspace_users() from public, anon;
grant execute on function public.list_workspace_users() to authenticated;

create or replace function public.change_workspace_role(target_user uuid, target_role text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if public.current_workspace_role() <> 'owner' then raise exception 'Chỉ chủ quán được phân quyền.' using errcode = '42501'; end if;
  if target_role not in ('manager','employee') then raise exception 'Vai trò không hợp lệ.' using errcode = '22023'; end if;
  if target_user = auth.uid() then raise exception 'Không thể đổi quyền tài khoản đang đăng nhập.' using errcode = '42501'; end if;
  update public.user_profiles set role=target_role where user_id=target_user;
  if not found then raise exception 'Không tìm thấy tài khoản.' using errcode = 'P0002'; end if;
end $$;
revoke all on function public.change_workspace_role(uuid,text) from public, anon;
grant execute on function public.change_workspace_role(uuid,text) to authenticated;

-- After signing up the first owner in Supabase Auth, run once in SQL Editor:
-- update public.user_profiles set role='owner' where user_id=(select id from auth.users where email='OWNER_EMAIL');
