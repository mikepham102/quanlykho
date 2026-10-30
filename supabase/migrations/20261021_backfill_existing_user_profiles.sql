-- Add workspace role rows for accounts that were created before the
-- auth.users trigger was installed. Existing role assignments are preserved.
insert into public.user_profiles(user_id,role)
select id,'employee' from auth.users
on conflict (user_id) do nothing;

-- After this backfill, promote the shop owner using their Supabase Auth email:
-- update public.user_profiles
-- set role='owner'
-- where user_id=(select id from auth.users where email='OWNER_EMAIL');
