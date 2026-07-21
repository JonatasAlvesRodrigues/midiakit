alter table public.media_kits
add column if not exists public_slug text,
add column if not exists is_public boolean not null default false;

create unique index if not exists media_kits_public_slug_unique
on public.media_kits (public_slug)
where public_slug is not null;

drop policy if exists "Public media kits are viewable by slug" on public.media_kits;
create policy "Public media kits are viewable by slug"
on public.media_kits
for select
to anon, authenticated
using (
    is_public = true
    and public_slug is not null
);
