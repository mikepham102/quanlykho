-- P1.4 locations (2026-10-29)
-- Vị trí bảo quản (quầy bar / tủ mát / khu pha chế): hàng xuất khỏi kho nằm tại vị trí và dùng dần.
-- Tồn kho (items.qty) vẫn là nguồn duy nhất bị trừ khi xuất; `items.at` chỉ là dữ liệu dẫn xuất từ phiếu.

create or replace function public.workspace_op_delta(o jsonb)
returns numeric language sql immutable set search_path = '' as $$
  select case
    when coalesce(o->>'status','') = 'voided' then 0
    when o->>'kind' = 'adjust' then coalesce((o->>'rawQty')::numeric,0)
    when o->>'kind' in ('stockin','prep','sale_return','return_location') then coalesce((o->>'rawQty')::numeric,0)
    when o->>'kind' in ('stockout','sale_issue','waste','issue_location') then -coalesce((o->>'rawQty')::numeric,0)
    else 0
  end
$$;

create or replace function public.save_workspace_state(p_state jsonb)
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

  if r <> 'owner' then
    -- `at` là dữ liệu dẫn xuất từ phiếu vị trí, không phải cấu hình mặt hàng.
    select jsonb_agg(e.value - 'qty' - 'at' order by e.value->>'id') into old_item from jsonb_array_elements(old_state->'items') as e(value);
    select jsonb_agg(e.value - 'qty' - 'at' order by e.value->>'id') into new_item from jsonb_array_elements(p_state->'items') as e(value);
    if old_item is distinct from new_item then raise exception 'Vai trò này không được thay đổi cấu hình mặt hàng.' using errcode = '42501'; end if;


    if r = 'manager' and exists (
      select 1 from jsonb_array_elements(p_state->'ops') as n(value)
      where not exists(select 1 from jsonb_array_elements(old_state->'ops') as o(value) where o.value->>'id'=n.value->>'id' and o.value=n.value)
        and (n.value->>'kind' not in ('stockin','stockout','prep','sale_issue','sale_return','sale_waste','waste','issue_location','return_location','use_location')
          or coalesce((n.value->>'rawQty')::numeric,0)<=0
          or not exists(select 1 from jsonb_array_elements(p_state->'items') as i(value)
            where i.value->>'id'=n.value->>'itemId'
              and ((n.value->>'kind' in ('stockin','stockout','waste') and i.value->>'type'='raw')
                or (n.value->>'kind' in ('prep','sale_issue','sale_return','sale_waste') and i.value->>'type'='prep')
                or (n.value->>'kind' in ('issue_location','return_location','use_location')))))
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
            or n.newop->>'kind' not in ('stockin','stockout','prep','sale_issue','sale_return','sale_waste','waste','issue_location','return_location','use_location')
            or coalesce((n.newop->>'rawQty')::numeric,0)<=0
            or not exists(select 1 from jsonb_array_elements(p_state->'items') as i(value)
              where i.value->>'id'=n.newop->>'itemId'
                and ((n.newop->>'kind' in ('stockin','stockout','waste') and i.value->>'type'='raw')
                  or (n.newop->>'kind' in ('prep','sale_issue','sale_return','sale_waste') and i.value->>'type'='prep')
                  or (n.newop->>'kind' in ('issue_location','return_location','use_location')))))
      ) then raise exception 'Phiếu mới không hợp lệ với quyền nhân viên.' using errcode = '42501'; end if;
    end if;
  end if;

  -- Balances may only change by the net effect of operations, for every role.
  for new_item in select e.value from jsonb_array_elements(p_state->'items') as e(value) loop
    iid := new_item->>'id';
    select e.value into old_item from jsonb_array_elements(old_state->'items') as e(value) where e.value->>'id' = iid;
    if old_item is null then
      if r <> 'owner' then raise exception 'Không được thêm hoặc xóa mặt hàng ở vai trò này.' using errcode = '42501'; end if;
      continue;
    end if;
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

  if r = 'owner' then
    next_state := p_state;
  else
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

