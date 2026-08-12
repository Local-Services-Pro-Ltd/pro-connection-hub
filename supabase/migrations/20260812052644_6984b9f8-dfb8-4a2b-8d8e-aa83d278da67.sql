-- ============ waiting_list ============
create table if not exists public.waiting_list (
    id uuid primary key default gen_random_uuid(),
    email text not null,
    postcode text not null,
    postcode_area text generated always as (
        upper(regexp_replace(split_part(postcode, ' ', 1), '[0-9]', '', 'g'))
    ) stored,
    role text not null check (role in ('homeowner','trader')),
    trade text,
    source text not null default 'waiting_list_page',
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    unique (email, postcode, role)
);

create index if not exists waiting_list_postcode_area_idx on public.waiting_list (postcode_area);
create index if not exists waiting_list_role_idx on public.waiting_list (role);
create index if not exists waiting_list_created_at_idx on public.waiting_list (created_at desc);

comment on table public.waiting_list is
    'Homeowners and traders in unserved areas. Written via add_to_waiting_list RPC. No client-side read.';

grant all on public.waiting_list to service_role;

alter table public.waiting_list enable row level security;

create policy "waiting_list no client read"
    on public.waiting_list for select to anon, authenticated using (false);

create policy "waiting_list no client write"
    on public.waiting_list for insert to anon, authenticated with check (false);

create or replace view public.waiting_list_counts_by_area
with (security_invoker = true) as
select postcode_area, role, count(*) as signups,
       min(created_at) as first_signup_at,
       max(created_at) as latest_signup_at
from public.waiting_list
group by postcode_area, role;

grant select on public.waiting_list_counts_by_area to service_role;

create or replace function public.add_to_waiting_list(
    p_email text,
    p_postcode text,
    p_role text,
    p_trade text default null,
    p_source text default 'waiting_list_page'
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_id uuid;
begin
    if p_email is null or p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
        raise exception 'invalid_email';
    end if;
    if p_postcode is null or length(trim(p_postcode)) < 2 then
        raise exception 'invalid_postcode';
    end if;
    if p_role not in ('homeowner','trader') then
        raise exception 'invalid_role';
    end if;

    insert into public.waiting_list (email, postcode, role, trade, source)
    values (lower(trim(p_email)), upper(trim(p_postcode)), p_role,
            nullif(trim(coalesce(p_trade,'')), ''), p_source)
    on conflict (email, postcode, role) do update
        set metadata = public.waiting_list.metadata
                       || jsonb_build_object('last_resubmit_at', now())
    returning id into v_id;

    return v_id;
end;
$$;

grant execute on function public.add_to_waiting_list(text, text, text, text, text) to anon, authenticated;

-- ============ plan_visibility ============
create table if not exists public.plan_visibility (
    plan_slug text primary key,
    display_name text not null,
    is_public boolean not null default false,
    display_order integer not null default 100,
    hidden_reason text,
    updated_at timestamptz not null default now(),
    updated_by uuid references auth.users(id) on delete set null
);

comment on table public.plan_visibility is
    'Display-only visibility control for subscription plans on /for-tradesmen. Does not affect billing or entitlements.';

grant select on public.plan_visibility to anon, authenticated;
grant all on public.plan_visibility to service_role;

create or replace function public.plan_visibility_touch()
returns trigger language plpgsql set search_path = public as $$
begin
    NEW.updated_at := now();
    return NEW;
end $$;

drop trigger if exists trg_plan_visibility_touch on public.plan_visibility;
create trigger trg_plan_visibility_touch
    before update on public.plan_visibility
    for each row execute function public.plan_visibility_touch();

insert into public.plan_visibility (plan_slug, display_name, is_public, display_order, hidden_reason)
values
    ('starter','Starter',true,10,null),
    ('trade','Trade',true,20,null),
    ('contractor','Contractor',false,30,
     'Hidden until we have 3 named Contractor customer logos on the page. Tier remains fully functional via /signin?plan=contractor. Flip is_public to true to re-enable.')
on conflict (plan_slug) do update
    set display_name = excluded.display_name,
        display_order = excluded.display_order,
        updated_at = now();

alter table public.plan_visibility enable row level security;

create policy "plan_visibility public read"
    on public.plan_visibility for select to anon, authenticated using (true);

create policy "plan_visibility admin write"
    on public.plan_visibility for all to authenticated
    using (auth.jwt() ->> 'role' = 'admin' or auth.jwt() ->> 'app_role' = 'admin')
    with check (auth.jwt() ->> 'role' = 'admin' or auth.jwt() ->> 'app_role' = 'admin');

-- ============ plans: visibility now driven by plan_visibility ============
update public.plans set visible = true where slug in ('starter','trade','contractor');
drop policy if exists "plans public read" on public.plans;
create policy "plans public read"
    on public.plans for select to anon, authenticated using (true);

-- ============ areas: London / Kent / Surrey live ============
update public.areas set name = 'Greater London', note = 'All 32 boroughs plus the City', sort_order = 1, status = 'live'
where slug = 'london';

insert into public.areas (slug, name, note, sort_order, status) values
    ('kent','Kent','Bromley and Dartford across to Canterbury, Ashford and the coast',2,'live'),
    ('surrey','Surrey','Guildford, Woking, Reigate, Epsom and the M25 belt',3,'live'),
    ('essex','Essex','Opening next — Q4 2026',10,'coming_soon'),
    ('sussex','Sussex','Opening next — Q4 2026',11,'coming_soon'),
    ('hertfordshire','Hertfordshire','Opening next — Q4 2026',12,'coming_soon'),
    ('berkshire','Berkshire','Opening — Q1 2027',13,'coming_soon'),
    ('buckinghamshire','Buckinghamshire','Opening — Q1 2027',14,'coming_soon'),
    ('hampshire','Hampshire','Opening — Q1 2027',15,'coming_soon')
on conflict (slug) do update
    set name = excluded.name, note = excluded.note,
        sort_order = excluded.sort_order, status = excluded.status;

update public.areas set sort_order = sort_order + 20
where slug in ('manchester','birmingham','bristol','leeds','glasgow','cardiff','newcastle');