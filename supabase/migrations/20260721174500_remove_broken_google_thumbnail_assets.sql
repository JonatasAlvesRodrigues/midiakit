update public.media_kits
set payload = jsonb_set(
    payload,
    '{partners}',
    coalesce(
        (
            select jsonb_agg(partner)
            from jsonb_array_elements(payload -> 'partners') as partner
            where coalesce(partner ->> 'logo', '') !~* 'encrypted-tbn[0-9]*\.gstatic\.com/images'
        ),
        '[]'::jsonb
    ),
    true
)
where payload ? 'partners';

update public.media_kits
set payload = jsonb_set(
    payload,
    '{portfolio}',
    coalesce(
        (
            select jsonb_agg(item)
            from jsonb_array_elements(payload -> 'portfolio') as item
            where coalesce(item ->> 'url', '') !~* 'encrypted-tbn[0-9]*\.gstatic\.com/images'
        ),
        '[]'::jsonb
    ),
    true
)
where payload ? 'portfolio';
