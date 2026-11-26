create extension if not exists pgcrypto;

create type lead_status as enum ('novo', 'proposta', 'fechado', 'perdido');
create type contract_status as enum ('rascunho', 'assinado', 'cancelado');
create type payment_status as enum ('pendente', 'pago', 'atrasado');
create type musician_tier as enum ('nucleo_fixo', 'convidado_a', 'convidado_b');
create type invite_status as enum ('pendente', 'convidado', 'confirmado', 'recusado');
create type event_status as enum ('planejamento', 'escalado', 'concluido', 'cancelado');

create table leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  event_type text,
  event_date date,
  status lead_status not null default 'novo',
  estimated_value numeric(12,2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table contracts (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete set null,
  client_name text not null,
  cpf_cnpj text,
  total_value numeric(12,2) not null,
  producer_margin_pct numeric(5,2) not null default 30,
  tax_pct numeric(5,2) not null default 6,
  contract_pdf_url text,
  status contract_status not null default 'rascunho',
  signed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table installments (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts(id) on delete cascade,
  installment_number integer not null,
  amount numeric(12,2) not null,
  due_date date not null,
  paid_at timestamptz,
  payment_method text,
  status payment_status not null default 'pendente',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contract_id, installment_number)
);

create table musicians (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  stage_name text,
  phone text,
  email text,
  city text,
  tier musician_tier not null default 'convidado_a',
  sight_reading_score smallint check (sight_reading_score between 1 and 5),
  base_fee numeric(12,2),
  pix_key text,
  has_own_transport boolean not null default false,
  conduct_term_signed_at timestamptz,
  tags text[] not null default '{}',
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table musician_roles (
  id uuid primary key default gen_random_uuid(),
  musician_id uuid not null references musicians(id) on delete cascade,
  role_name text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table events (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid references contracts(id) on delete set null,
  title text not null,
  event_type text,
  event_date date not null,
  load_in_time time,
  soundcheck_time time,
  start_time time,
  end_time time,
  venue_name text,
  venue_address text,
  maps_url text,
  dress_code text,
  logistics_notes text,
  public_token uuid not null unique default gen_random_uuid(),
  status event_status not null default 'planejamento',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table event_lineup (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  role_needed text not null,
  musician_id uuid references musicians(id),
  backup_musician_id uuid references musicians(id),
  invite_status invite_status not null default 'pendente',
  negotiated_fee numeric(12,2),
  payment_status payment_status not null default 'pendente',
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table equipment (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in ('som', 'instrumento', 'uniforme_acessorio', 'cabos')),
  quantity_total integer not null default 0 check (quantity_total >= 0),
  serial_or_notes text,
  status text not null default 'disponivel' check (status in ('disponivel', 'manutencao')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table event_equipment (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  equipment_id uuid not null references equipment(id),
  quantity_allocated integer not null default 1 check (quantity_allocated > 0),
  checked_out boolean not null default false,
  checked_in boolean not null default false,
  responsible_musician_id uuid references musicians(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table event_expenses (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  category text not null check (category in ('frete', 'alimentacao', 'imposto', 'aluguel_som', 'outros')),
  description text not null,
  amount numeric(12,2) not null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table songs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  composer text,
  category text,
  default_key text,
  duration_seconds integer,
  is_pentacordis_arrangement boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table song_assets (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references songs(id) on delete cascade,
  asset_type text not null check (asset_type in ('partitura_geral', 'partitura_naipe', 'audio_guia', 'letra')),
  target_role text not null default 'todos',
  file_url text not null,
  key_signature text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table event_setlist (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  song_id uuid not null references songs(id),
  order_index integer not null,
  moment_label text,
  event_key text,
  performance_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, order_index)
);

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'leads','contracts','installments','musicians','musician_roles','events',
    'event_lineup','equipment','event_equipment','event_expenses','songs',
    'song_assets','event_setlist'
  ]
  loop
    execute format(
      'create trigger %I_set_updated_at before update on %I for each row execute function set_updated_at()',
      table_name, table_name
    );
  end loop;
end;
$$;

create or replace view event_financial_summary as
select
  e.id as event_id,
  coalesce(c.total_value, 0)::numeric(12,2) as contract_total_value,
  coalesce((select sum(y.negotiated_fee) from event_lineup y where y.event_id = e.id), 0)::numeric(12,2) as total_musician_fees,
  coalesce((select sum(x.amount) from event_expenses x where x.event_id = e.id), 0)::numeric(12,2) as total_expenses,
  (coalesce(c.total_value, 0)
   - coalesce((select sum(y.negotiated_fee) from event_lineup y where y.event_id = e.id), 0)
   - coalesce((select sum(x.amount) from event_expenses x where x.event_id = e.id), 0))::numeric(12,2) as net_profit,
  case
    when coalesce(c.total_value, 0) = 0 then 0
    else round(
      ((coalesce(c.total_value, 0)
        - coalesce((select sum(y.negotiated_fee) from event_lineup y where y.event_id = e.id), 0)
        - coalesce((select sum(x.amount) from event_expenses x where x.event_id = e.id), 0))
       / c.total_value) * 100, 2
    )
  end::numeric(7,2) as net_margin_pct
from events e
left join contracts c on c.id = e.contract_id
group by e.id, c.total_value;

alter table leads enable row level security;
alter table contracts enable row level security;
alter table installments enable row level security;
alter table musicians enable row level security;
alter table musician_roles enable row level security;
alter table events enable row level security;
alter table event_lineup enable row level security;
alter table equipment enable row level security;
alter table event_equipment enable row level security;
alter table event_expenses enable row level security;
alter table songs enable row level security;
alter table song_assets enable row level security;
alter table event_setlist enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'leads','contracts','installments','musicians','musician_roles','events',
    'event_lineup','equipment','event_equipment','event_expenses','songs',
    'song_assets','event_setlist'
  ]
  loop
    execute format(
      'create policy authenticated_all_%I on %I for all to authenticated using (true) with check (true)',
      table_name, table_name
    );
  end loop;
end;
$$;

create or replace function get_public_event_by_token(p_token uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', e.id,
    'title', e.title,
    'event_type', e.event_type,
    'event_date', e.event_date,
    'load_in_time', e.load_in_time,
    'soundcheck_time', e.soundcheck_time,
    'start_time', e.start_time,
    'end_time', e.end_time,
    'venue_name', e.venue_name,
    'venue_address', e.venue_address,
    'maps_url', e.maps_url,
    'dress_code', e.dress_code,
    'logistics_notes', e.logistics_notes,
    'lineup', coalesce((
      select jsonb_agg(jsonb_build_object(
        'role_needed', el.role_needed,
        'stage_name', coalesce(m.stage_name, m.full_name)
      ) order by el.role_needed)
      from event_lineup el
      left join musicians m on m.id = el.musician_id
      where el.event_id = e.id
        and el.invite_status in ('convidado', 'confirmado')
    ), '[]'::jsonb),
    'setlist', coalesce((
      select jsonb_agg(jsonb_build_object(
        'order_index', es.order_index,
        'moment_label', es.moment_label,
        'event_key', es.event_key,
        'performance_notes', es.performance_notes,
        'title', s.title,
        'composer', s.composer,
        'assets', coalesce((
          select jsonb_agg(jsonb_build_object(
            'asset_type', sa.asset_type,
            'target_role', sa.target_role,
            'file_url', sa.file_url,
            'key_signature', sa.key_signature
          ) order by sa.asset_type)
          from song_assets sa
          where sa.song_id = s.id
        ), '[]'::jsonb)
      ) order by es.order_index)
      from event_setlist es
      join songs s on s.id = es.song_id
      where es.event_id = e.id
    ), '[]'::jsonb)
  )
  from events e
  where e.public_token = p_token
  limit 1;
$$;

revoke all on function get_public_event_by_token(uuid) from public;
grant execute on function get_public_event_by_token(uuid) to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pentacordis-assets',
  'pentacordis-assets',
  true,
  52428800,
  array['application/pdf', 'audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/x-wav']
) on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy pentacordis_assets_authenticated_select
on storage.objects for select
to authenticated
using (bucket_id = 'pentacordis-assets');

create policy pentacordis_assets_authenticated_insert
on storage.objects for insert
to authenticated
with check (bucket_id = 'pentacordis-assets');

create policy pentacordis_assets_authenticated_update
on storage.objects for update
to authenticated
using (bucket_id = 'pentacordis-assets')
with check (bucket_id = 'pentacordis-assets');

create policy pentacordis_assets_authenticated_delete
on storage.objects for delete
to authenticated
using (bucket_id = 'pentacordis-assets');

create or replace function approve_budget_and_create_event(
  p_lead_id uuid,
  p_client_name text,
  p_cpf_cnpj text,
  p_total_value numeric,
  p_margin_pct numeric,
  p_tax_pct numeric,
  p_event_title text,
  p_event_type text,
  p_event_date date,
  p_venue_name text,
  p_roles jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contract_id uuid;
  v_event_id uuid;
  v_role jsonb;
begin
  insert into contracts (
    lead_id, client_name, cpf_cnpj, total_value,
    producer_margin_pct, tax_pct, status
  )
  values (
    p_lead_id, p_client_name, p_cpf_cnpj, p_total_value,
    p_margin_pct, p_tax_pct, 'rascunho'
  )
  returning id into v_contract_id;

  insert into events (
    contract_id, title, event_type, event_date,
    venue_name, status
  )
  values (
    v_contract_id, p_event_title, p_event_type, p_event_date,
    p_venue_name, 'planejamento'
  )
  returning id into v_event_id;

  for v_role in select * from jsonb_array_elements(coalesce(p_roles, '[]'::jsonb))
  loop
    insert into event_lineup (
      event_id, role_needed, negotiated_fee,
      invite_status, payment_status
    )
    values (
      v_event_id,
      v_role->>'role_needed',
      nullif(v_role->>'fee', '')::numeric,
      'pendente',
      'pendente'
    );
  end loop;

  if p_lead_id is not null then
    update leads set status = 'fechado' where id = p_lead_id;
  end if;

  return v_event_id;
end;
$$;

revoke all on function approve_budget_and_create_event(
  uuid, text, text, numeric, numeric, numeric,
  text, text, date, text, jsonb
) from public;
grant execute on function approve_budget_and_create_event(
  uuid, text, text, numeric, numeric, numeric,
  text, text, date, text, jsonb
) to authenticated;
