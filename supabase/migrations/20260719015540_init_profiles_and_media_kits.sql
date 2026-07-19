create extension if not exists "pgcrypto";

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles (id, email, full_name)
    values (
        new.id,
        new.email,
        coalesce(new.raw_user_meta_data ->> 'name', '')
    )
    on conflict (id) do update
    set
        email = excluded.email,
        full_name = case
            when excluded.full_name <> '' then excluded.full_name
            else public.profiles.full_name
        end;

    return new;
end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = timezone('utc', now());
    return new;
end;
$$;

create table if not exists public.profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    email text unique,
    full_name text not null default '',
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.media_kits (
    user_id uuid primary key references auth.users (id) on delete cascade,
    payload jsonb not null,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint media_kits_payload_is_object check (jsonb_typeof(payload) = 'object')
);

alter table public.profiles enable row level security;
alter table public.media_kits enable row level security;

drop policy if exists "Profiles are viewable by owner" on public.profiles;
create policy "Profiles are viewable by owner"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

drop policy if exists "Profiles are insertable by owner" on public.profiles;
create policy "Profiles are insertable by owner"
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) = id);

drop policy if exists "Profiles are updatable by owner" on public.profiles;
create policy "Profiles are updatable by owner"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "Media kits are viewable by owner" on public.media_kits;
create policy "Media kits are viewable by owner"
on public.media_kits
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Media kits are insertable by owner" on public.media_kits;
create policy "Media kits are insertable by owner"
on public.media_kits
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Media kits are updatable by owner" on public.media_kits;
create policy "Media kits are updatable by owner"
on public.media_kits
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Media kits are deletable by owner" on public.media_kits;
create policy "Media kits are deletable by owner"
on public.media_kits
for delete
to authenticated
using ((select auth.uid()) = user_id);

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute procedure public.handle_new_user();

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
    before update on public.profiles
    for each row execute procedure public.set_updated_at();

drop trigger if exists set_media_kits_updated_at on public.media_kits;
create trigger set_media_kits_updated_at
    before update on public.media_kits
    for each row execute procedure public.set_updated_at();
