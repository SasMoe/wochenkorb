-- Already applied to the Supabase Cloud project 2026-11-08.
-- Keep this file for fresh database installations and migration history.
revoke execute on function public.create_household(text,jsonb) from anon;
revoke execute on function public.create_household_invite(uuid) from anon;
revoke execute on function public.join_household(text) from anon;
revoke execute on function public.save_household_state(uuid,bigint,jsonb) from anon;
revoke execute on function public.is_household_member(uuid) from anon;
