-- Run this once in Supabase SQL Editor.
-- It lets coaches/admins securely see client profiles without opening
-- the profiles table to everyone.

alter table public.pg_client_invites
  add column if not exists client_auth_id uuid references public.profiles(id) on delete set null;

create or replace function public.get_coach_clients()
returns table (
  id uuid,
  full_name text,
  email text,
  role text
)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.full_name, p.email, p.role
  from public.profiles p
  where p.role = 'client'
    and public.is_coach(auth.uid());
$$;

create or replace function public.get_coach_client_count()
returns bigint
language sql
security definer
set search_path = public
stable
as $$
  select count(*)
  from public.profiles p
  where p.role = 'client'
    and public.is_coach(auth.uid());
$$;

grant execute on function public.get_coach_clients() to authenticated;
grant execute on function public.get_coach_client_count() to authenticated;
