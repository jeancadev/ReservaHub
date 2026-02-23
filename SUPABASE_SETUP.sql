-- ReservaHub + Supabase base schema (MVP)
-- Run this in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    name text not null,
    email text not null,
    phone text default '',
    role text not null check (role in ('business', 'client')),
    business_name text default '',
    category text default 'barberia',
    address text default '',
    description text default '',
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

alter table public.profiles add column if not exists business_photo_url text default '';
alter table public.profiles add column if not exists business_photo_path text default '';

create table if not exists public.app_state (
    key text primary key,
    value jsonb not null default '{}'::jsonb,
    updated_by uuid references auth.users(id) on delete set null,
    updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_created_at on public.profiles(created_at);
create index if not exists idx_app_state_updated_at on public.app_state(updated_at);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = timezone('utc', now());
    return new;
end;
$$;

create or replace function public.delete_current_user()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    _uid uuid;
begin
    _uid := auth.uid();
    if _uid is null then
        raise exception 'Not authenticated';
    end if;
    delete from auth.users where id = _uid;
end;
$$;

revoke all on function public.delete_current_user() from public;
grant execute on function public.delete_current_user() to authenticated;

drop trigger if exists trg_profiles_touch_updated_at on public.profiles;
create trigger trg_profiles_touch_updated_at
before update on public.profiles
for each row
execute function public.touch_updated_at();

drop trigger if exists trg_app_state_touch_updated_at on public.app_state;
create trigger trg_app_state_touch_updated_at
before update on public.app_state
for each row
execute function public.touch_updated_at();

alter table public.profiles enable row level security;
alter table public.app_state enable row level security;

drop policy if exists profiles_select_authenticated on public.profiles;
create policy profiles_select_authenticated
on public.profiles
for select
to authenticated
using (true);

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists profiles_delete_self on public.profiles;
create policy profiles_delete_self
on public.profiles
for delete
to authenticated
using (id = auth.uid());

drop policy if exists app_state_select_authenticated on public.app_state;
create policy app_state_select_authenticated
on public.app_state
for select
to authenticated
using (true);

drop policy if exists app_state_insert_authenticated on public.app_state;
create policy app_state_insert_authenticated
on public.app_state
for insert
to authenticated
with check (auth.uid() is not null);

drop policy if exists app_state_update_authenticated on public.app_state;
create policy app_state_update_authenticated
on public.app_state
for update
to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);

drop policy if exists app_state_delete_authenticated on public.app_state;
create policy app_state_delete_authenticated
on public.app_state
for delete
to authenticated
using (auth.uid() is not null);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'reservahub-media',
    'reservahub-media',
    true,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists reservahub_media_insert_own on storage.objects;
create policy reservahub_media_insert_own
on storage.objects
for insert
to authenticated
with check (
    bucket_id = 'reservahub-media'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = auth.uid()::text
);

drop policy if exists reservahub_media_update_own on storage.objects;
create policy reservahub_media_update_own
on storage.objects
for update
to authenticated
using (
    bucket_id = 'reservahub-media'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = auth.uid()::text
)
with check (
    bucket_id = 'reservahub-media'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = auth.uid()::text
);

drop policy if exists reservahub_media_delete_own on storage.objects;
create policy reservahub_media_delete_own
on storage.objects
for delete
to authenticated
using (
    bucket_id = 'reservahub-media'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = auth.uid()::text
);
