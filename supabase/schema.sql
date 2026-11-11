-- =====================================================================
--  Altech Food / Redbox — full Supabase database schema
-- ---------------------------------------------------------------------
--  Run this whole file once in: Supabase Dashboard → SQL Editor → Run.
--  It is idempotent: running it again updates functions/policies without
--  losing data.
--
--  Contents
--    0. Extensions & helpers
--    1. Profiles (link between Supabase Auth users and the app)
--    2. Business tables (stock, purchases, production, POS, caisse, …)
--    3. Account functions (admin creation from the login page, worker
--       accounts created in auth.users, login by username, my account)
--    4. Row Level Security policies
--    5. Realtime publication
--    6. Storage buckets for images (+ policies)
--    7. Reference data (store settings row, measurement units)
--
--  Column names are the snake_case version of the TypeScript fields used
--  by the front-end (src/lib/cloudSync.ts), e.g. currentQuantity →
--  current_quantity. Dates coming from the app (YYYY-MM-DD, HH:mm, ISO)
--  are stored as text exactly as the app writes them.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Extensions & helpers
-- ---------------------------------------------------------------------
create extension if not exists pgcrypto with schema extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 1. Profiles
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text not null default '',
  username    text not null,
  email       text not null,
  role        text not null default 'worker' check (role in ('admin', 'worker')),
  worker_id   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists profiles_username_key on public.profiles (lower(username));
create unique index if not exists profiles_email_key on public.profiles (lower(email));
create index if not exists profiles_worker_id_idx on public.profiles (worker_id);

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Is the current user an administrator?
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- ---------------------------------------------------------------------
-- 2. Business tables
-- ---------------------------------------------------------------------

-- Store profile (single row, id = 1) + image optimisation settings
create table if not exists public.app_settings (
  id             integer primary key default 1 check (id = 1),
  logo           text,
  name           text default '',
  description    text default '',
  email          text default '',
  phone          text default '',
  address        text default '',
  social_media   text default '',
  nif            text default '',
  nis            text default '',
  article        text default '',
  rc             text default '',
  image_optimize boolean default true,
  image_max_size integer default 800,
  image_quality  numeric default 0.72,
  inserted_at    timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ---- Stock reference data ----
create table if not exists public.units (
  id text primary key, name text not null,
  inserted_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.marques (
  id text primary key, name text not null,
  inserted_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.stock_categories (
  id text primary key, name text not null,
  inserted_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

-- ---- Stock products ----
create table if not exists public.products (
  id                  text primary key,
  name                text not null,
  description         text default '',
  image               text,                      -- public URL in the product-images bucket
  barcode             text default '',
  marque_id           text,
  category_id         text,
  principal_quantity  numeric default 0,
  current_quantity    numeric default 0,
  min_alert_quantity  numeric default 0,
  purchase_price      numeric default 0,
  unit_enabled        boolean default false,     -- "achat au détail" (g / kg / litre …)
  unit                text,
  expiration_enabled  boolean default false,
  expiration_date     text,
  sell_on_pos         boolean default false,  -- vente directe au POS (sinon production uniquement)
  selling_price       numeric default 0,
  created_at          text,
  created_by          text,
  inserted_at         timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
-- Columns added after the first version of this script
alter table public.products add column if not exists sell_on_pos boolean default false;
alter table public.products add column if not exists selling_price numeric default 0;
create index if not exists products_category_idx on public.products (category_id);
create index if not exists products_pos_idx on public.products (sell_on_pos) where sell_on_pos;

-- ---- Suppliers & purchases ----
create table if not exists public.suppliers (
  id text primary key, name text not null, phone text default '', address text default '',
  inserted_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.purchases (
  id            text primary key,
  reference     text not null,
  supplier_id   text,
  date          text,
  products      jsonb default '[]'::jsonb,   -- PurchaseLine[]
  total_amount  numeric default 0,
  paid_amount   numeric default 0,
  rest_amount   numeric default 0,
  payments      jsonb default '[]'::jsonb,   -- Payment[]
  created_by    text,
  inserted_at   timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists purchases_supplier_idx on public.purchases (supplier_id);

-- ---- Clients & sales ----
create table if not exists public.clients (
  id text primary key, name text not null, phone text default '',
  inserted_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.sales (
  id                text primary key,
  reference         text not null,
  client_id         text,
  date              text,
  products          jsonb default '[]'::jsonb,  -- SaleLine[] (source: comptoir | stock)
  total_amount      numeric default 0,
  reduction         numeric default 0,
  final_amount      numeric default 0,
  paid_amount       numeric default 0,
  rest_amount       numeric default 0,
  status            text default 'paid',
  payments          jsonb default '[]'::jsonb,
  created_by        text,
  cash_session_id   text,
  from_command_id   text,
  order_type        text,
  table_number      text,
  delivery_address  text,
  delivery_phone    text,
  deliverer_id      text,
  deliverer_name    text,
  inserted_at       timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists sales_client_idx on public.sales (client_id);
create index if not exists sales_session_idx on public.sales (cash_session_id);

-- ---- Production ----
create table if not exists public.production_categories (
  id text primary key, name text not null,
  inserted_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.productions (
  id                text primary key,
  name              text not null,
  description       text default '',
  image             text,
  date              text,
  hour              text,
  category_id       text,
  category_name     text,
  used_products     jsonb default '[]'::jsonb,  -- UsedProduct[]
  total_cost        numeric default 0,
  output_quantity   numeric default 0,
  unit_price        numeric default 0,
  total_value       numeric default 0,
  sell_by_unit      boolean default false,
  sell_unit         text,
  created_by        text,
  sent_to_comptoir  numeric default 0,
  inserted_at       timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ---- Fiches techniques (recipes) ----
create table if not exists public.fiche_categories (
  id text primary key, name text not null,
  inserted_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.fiche_technics (
  id                    text primary key,
  name                  text not null,
  image                 text,
  category_id           text,
  category_name         text,
  description           text,
  used_products         jsonb default '[]'::jsonb,
  sell_by_unit          boolean default false,
  sell_unit             text,
  usable_in_production  boolean default false,
  product_unit          text,
  output_quantity       numeric default 0,
  unit_price            numeric default 0,
  total_cost            numeric default 0,
  cost_per_unit         numeric default 0,
  total_value           numeric default 0,
  gains_per_unit        numeric default 0,
  total_gains           numeric default 0,
  created_at            text,
  inserted_at           timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ---- Comptoir & destructions ----
create table if not exists public.comptoir_items (
  id             text primary key,
  production_id  text,
  product_name   text not null,
  image          text,
  description    text,
  quantity       numeric default 0,
  unit_price     numeric default 0,
  date           text,
  category_id    text,
  category_name  text,
  sell_by_unit   boolean default false,
  unit           text,
  created_by     text,
  inserted_at    timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create table if not exists public.destructions (
  id            text primary key,
  comptoir_id   text,
  product_name  text not null,
  quantity      numeric default 0,
  value         numeric default 0,
  reason        text default '',
  date          text,
  unit          text,
  created_by    text,
  inserted_at   timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---- Workers (employees) ----
create table if not exists public.worker_roles (
  id text primary key, name text not null,
  inserted_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.workers (
  id               text primary key,
  full_name        text not null,
  birthday         text,
  id_card_number   text,
  phone            text,
  role_id          text,
  post             text default 'general',      -- general | kitchen | cashier | deliverer
  payment_enabled  boolean default true,
  payment_type     text default 'monthly',      -- monthly | daily
  payment_amount   numeric default 0,
  has_account      boolean default false,
  email            text default '',
  username         text default '',
  auth_user_id     uuid references auth.users (id) on delete set null,  -- login account (Supabase Auth)
  start_date       text,
  permissions      jsonb default '{}'::jsonb,
  acomptes         jsonb default '[]'::jsonb,
  absences         jsonb default '[]'::jsonb,
  payments         jsonb default '[]'::jsonb,
  inserted_at      timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists workers_auth_user_idx on public.workers (auth_user_id);

-- ---- Expenses ----
create table if not exists public.expenses (
  id text primary key, name text not null, description text default '', amount numeric default 0,
  date text, created_by text,
  inserted_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

-- ---- Caisse (cash register) ----
create table if not exists public.caisse_transactions (
  id           text primary key,
  type         text not null check (type in ('deposit', 'withdrawal')),
  amount       numeric default 0,
  date         text,
  description  text default '',
  created_at   text,
  created_by   text,
  session_id   text,
  inserted_at  timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create table if not exists public.cash_sessions (
  id               text primary key,
  username         text not null,
  worker_id        text,
  worker_name      text,
  opened_at        text,
  opening_amount   numeric default 0,
  opening_note     text,
  status           text default 'open' check (status in ('open', 'closed')),
  closed_at        text,
  closing_amount   numeric,
  closing_note     text,
  expected_amount  numeric,
  difference       numeric,
  closed_by        text,
  inserted_at      timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create table if not exists public.caisse_reports (
  id               text primary key,
  report_type      text default 'day',          -- day | period
  date             text,
  end_date         text,
  hour             text,
  description      text default '',
  declared_amount  numeric default 0,
  created_at       text,
  created_by       text,
  inserted_at      timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ---- Commands (orders) ----
create table if not exists public.commands (
  id                    text primary key,
  reference             text not null,
  client_id             text,
  client_name           text,
  client_phone          text,
  created_at            text,
  receive_date          text,
  receive_hour          text,
  receive_minute        text,
  items                 jsonb default '[]'::jsonb,   -- CommandLine[]
  total_amount          numeric default 0,
  paid_amount           numeric default 0,
  rest_amount           numeric default 0,
  status                text default 'pending',     -- pending | finalised
  payments              jsonb default '[]'::jsonb,
  created_by            text,
  source                text,
  note                  text,
  kitchen_status        text,                                 -- new | preparing | ready
  kitchen_printed       boolean default false,
  cash_session_id       text,
  finalised_at          text,
  finalised_by          text,
  finalised_session_id  text,
  sale_id               text,
  delivered_at          text,
  order_type            text,
  table_number          text,
  delivery_address      text,
  delivery_phone        text,
  deliverer_id          text,
  deliverer_name        text,
  inserted_at           timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists commands_status_idx on public.commands (status);

-- Optional fields may be written as NULL by the app: make sure no
-- business column (except ids / names) keeps a NOT NULL constraint
-- (useful when this script is re-run on an older database).
do $$
declare r record;
begin
  for r in
    select c.table_name, c.column_name
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.is_nullable = 'NO'
      and c.table_name in (
        'app_settings','units','marques','stock_categories','products','suppliers','purchases','clients','sales',
        'production_categories','productions','fiche_categories','fiche_technics','comptoir_items','destructions',
        'worker_roles','workers','expenses','caisse_transactions','cash_sessions','caisse_reports','commands')
      and c.column_name not in ('id','name','reference','product_name','full_name','username','type','inserted_at','updated_at')
  loop
    execute format('alter table public.%I alter column %I drop not null', r.table_name, r.column_name);
  end loop;
end $$;

-- updated_at triggers on every business table
do $$
declare t text;
begin
  foreach t in array array[
    'app_settings','units','marques','stock_categories','products','suppliers','purchases','clients','sales',
    'production_categories','productions','fiche_categories','fiche_technics','comptoir_items','destructions',
    'worker_roles','workers','expenses','caisse_transactions','cash_sessions','caisse_reports','commands'
  ] loop
    execute format('drop trigger if exists %I on public.%I', t || '_updated_at', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', t || '_updated_at', t);
  end loop;
end $$;

-- Can the current user manage employees? (admin, or a worker granted the "workers" module)
create or replace function public.can_manage_workers()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or exists (
    select 1
    from public.profiles p
    join public.workers w on w.id = p.worker_id
    where p.id = auth.uid()
      and w.has_account
      and (
        coalesce((w.permissions -> 'workers' ->> 'create')::boolean, false)
        or coalesce((w.permissions -> 'workers' ->> 'edit')::boolean, false)
        or coalesce((w.permissions -> 'workers' ->> 'delete')::boolean, false)
        or coalesce((w.permissions -> 'workers' ->> 'pay')::boolean, false)
      )
  );
$$;

-- ---------------------------------------------------------------------
-- 3. Account functions
-- ---------------------------------------------------------------------

-- Is there already an administrator? (used by the login page to show or
-- hide the "Créer un compte admin" option)
create or replace function public.admin_exists()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where role = 'admin');
$$;

-- Login with a username: returns the e-mail used by Supabase Auth.
create or replace function public.resolve_login_email(p_identifier text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select email from public.profiles
  where lower(username) = lower(trim(p_identifier)) or lower(email) = lower(trim(p_identifier))
  limit 1;
$$;

-- Internal: create a confirmed e-mail/password user directly in auth.users
-- (+ its identity) so the account can sign in immediately, without any
-- confirmation e-mail.
create or replace function public._create_auth_user(p_email text, p_password text, p_meta jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, auth
as $$
declare
  v_id    uuid := gen_random_uuid();
  v_email text := lower(trim(p_email));
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid_email';
  end if;
  if length(coalesce(p_password, '')) < 6 then
    raise exception 'weak_password: minimum 6 caractères';
  end if;
  if exists (select 1 from auth.users where lower(email) = v_email) then
    raise exception 'email_taken';
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    now(), jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')), coalesce(p_meta, '{}'::jsonb),
    now(), now(),
    '', '', '', '',
    '', '', '', ''
  );

  insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (
    gen_random_uuid(), v_id::text, v_id,
    jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
    'email', now(), now(), now()
  );

  return v_id;
end;
$$;

create or replace function public._check_username(p_username text, p_ignore uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if length(trim(coalesce(p_username, ''))) < 3 or p_username ~ '[\s@]' then
    raise exception 'invalid_username: 3 caractères minimum, sans espace ni @';
  end if;
  if exists (select 1 from public.profiles where lower(username) = lower(trim(p_username)) and id is distinct from p_ignore) then
    raise exception 'username_taken';
  end if;
end;
$$;

-- Create THE administrator account from the login page. Only works while
-- no admin exists (afterwards the login page hides the option).
create or replace function public.create_admin_account(p_name text, p_username text, p_email text, p_password text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  perform pg_advisory_xact_lock(84210001);
  if exists (select 1 from public.profiles where role = 'admin') then
    raise exception 'admin_already_exists';
  end if;
  perform public._check_username(p_username);
  v_id := public._create_auth_user(p_email, p_password,
    jsonb_build_object('name', trim(p_name), 'username', trim(p_username), 'role', 'admin'));
  insert into public.profiles (id, name, username, email, role)
  values (v_id, trim(p_name), trim(p_username), lower(trim(p_email)), 'admin');
  return v_id;
end;
$$;

-- Create a worker login account (admin only). The account is created in
-- Supabase Authentication (auth.users) and linked to the worker row.
create or replace function public.create_worker_account(p_worker_id text, p_name text, p_username text, p_email text, p_password text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if not public.can_manage_workers() then
    raise exception 'not_admin';
  end if;
  perform public._check_username(p_username);
  v_id := public._create_auth_user(p_email, p_password,
    jsonb_build_object('name', trim(p_name), 'username', trim(p_username), 'role', 'worker', 'worker_id', p_worker_id));
  insert into public.profiles (id, name, username, email, role, worker_id)
  values (v_id, trim(p_name), trim(p_username), lower(trim(p_email)), 'worker', p_worker_id);
  update public.workers set auth_user_id = v_id, has_account = true where id = p_worker_id;
  return v_id;
end;
$$;

-- Update a worker login account: name / username / e-mail / password (admin only)
create or replace function public.update_worker_account(p_user_id uuid, p_name text, p_username text, p_email text, p_password text default null)
returns void
language plpgsql
security definer
set search_path = public, extensions, auth
as $$
declare v_email text := lower(trim(p_email));
begin
  if not public.can_manage_workers() then
    raise exception 'not_admin';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id and role = 'worker') then
    raise exception 'worker_account_not_found';
  end if;
  perform public._check_username(p_username, p_user_id);
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid_email';
  end if;
  if exists (select 1 from auth.users where lower(email) = v_email and id <> p_user_id) then
    raise exception 'email_taken';
  end if;
  if p_password is not null and length(p_password) > 0 and length(p_password) < 6 then
    raise exception 'weak_password: minimum 6 caractères';
  end if;

  update auth.users set
    email = v_email,
    email_confirmed_at = coalesce(email_confirmed_at, now()),
    encrypted_password = case when coalesce(p_password, '') <> ''
                              then extensions.crypt(p_password, extensions.gen_salt('bf'))
                              else encrypted_password end,
    raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('name', trim(p_name), 'username', trim(p_username)),
    updated_at = now()
  where id = p_user_id;

  update auth.identities
     set identity_data = coalesce(identity_data, '{}'::jsonb) || jsonb_build_object('email', v_email),
         updated_at = now()
   where user_id = p_user_id and provider = 'email';

  update public.profiles
     set name = trim(p_name), username = trim(p_username), email = v_email
   where id = p_user_id;
end;
$$;

-- Delete a worker login account (admin only)
create or replace function public.delete_worker_account(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.can_manage_workers() then
    raise exception 'not_admin';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id and role = 'worker') then
    raise exception 'worker_account_not_found';
  end if;
  update public.workers set auth_user_id = null where auth_user_id = p_user_id;
  delete from auth.users where id = p_user_id;   -- cascades to profiles + identities
end;
$$;

-- Update the account of the logged-in user (Paramètres → Mon compte)
create or replace function public.update_my_account(
  p_name text, p_username text, p_email text, p_password text default null, p_old_password text default null)
returns void
language plpgsql
security definer
set search_path = public, extensions, auth
as $$
declare
  v_uid   uuid := auth.uid();
  v_email text := lower(trim(p_email));
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  perform public._check_username(p_username, v_uid);
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid_email';
  end if;
  if exists (select 1 from auth.users where lower(email) = v_email and id <> v_uid) then
    raise exception 'email_taken';
  end if;
  if coalesce(p_password, '') <> '' then
    if length(p_password) < 6 then
      raise exception 'weak_password: minimum 6 caractères';
    end if;
    if not exists (
      select 1 from auth.users
      where id = v_uid and encrypted_password = extensions.crypt(coalesce(p_old_password, ''), encrypted_password)
    ) then
      raise exception 'wrong_password';
    end if;
  end if;

  update auth.users set
    email = v_email,
    encrypted_password = case when coalesce(p_password, '') <> ''
                              then extensions.crypt(p_password, extensions.gen_salt('bf'))
                              else encrypted_password end,
    raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('name', trim(p_name), 'username', trim(p_username)),
    updated_at = now()
  where id = v_uid;

  update auth.identities
     set identity_data = coalesce(identity_data, '{}'::jsonb) || jsonb_build_object('email', v_email),
         updated_at = now()
   where user_id = v_uid and provider = 'email';

  update public.profiles
     set name = trim(p_name), username = trim(p_username), email = v_email
   where id = v_uid;
end;
$$;

-- Function privileges
revoke all on function public._create_auth_user(text, text, jsonb) from public, anon, authenticated;
revoke all on function public._check_username(text, uuid) from public, anon, authenticated;
grant execute on function public.admin_exists() to anon, authenticated;
grant execute on function public.resolve_login_email(text) to anon, authenticated;
grant execute on function public.create_admin_account(text, text, text, text) to anon, authenticated;
revoke all on function public.create_worker_account(text, text, text, text, text) from public, anon;
revoke all on function public.update_worker_account(uuid, text, text, text, text) from public, anon;
revoke all on function public.delete_worker_account(uuid) from public, anon;
revoke all on function public.update_my_account(text, text, text, text, text) from public, anon;
grant execute on function public.create_worker_account(text, text, text, text, text) to authenticated;
grant execute on function public.update_worker_account(uuid, text, text, text, text) to authenticated;
grant execute on function public.delete_worker_account(uuid) to authenticated;
grant execute on function public.update_my_account(text, text, text, text, text) to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.can_manage_workers() to authenticated;

-- Atomic quantity changes sent by the app (stock / comptoir / production)
create or replace function public.apply_counter_deltas(p_table text, p_id text, p_deltas jsonb)
returns jsonb
language plpgsql
security invoker            -- Row Level Security still applies
set search_path = public
as $$
declare
  allowed text[];
  k       text;
  d       numeric;
  sets    text := '';
  result  jsonb;
begin
  allowed := case p_table
    when 'products'       then array['current_quantity', 'principal_quantity']
    when 'comptoir_items' then array['quantity']
    when 'productions'    then array['sent_to_comptoir']
    else null
  end;
  if allowed is null then
    raise exception 'table_not_allowed: %', p_table;
  end if;
  for k in select jsonb_object_keys(coalesce(p_deltas, '{}'::jsonb)) loop
    if not (k = any (allowed)) then
      raise exception 'column_not_allowed: %', k;
    end if;
    d := (p_deltas ->> k)::numeric;      -- cast guarantees a plain number
    if d is null or d = 0 then continue; end if;
    sets := sets || case when sets = '' then '' else ', ' end
         || format('%I = greatest(0, coalesce(%I, 0) + (%s)::numeric)', k, k, d::text);
  end loop;
  if sets = '' then
    return null;
  end if;
  execute format('update public.%I set %s where id = $1 returning to_jsonb(%I.*)', p_table, sets, p_table)
    into result using p_id;
  return result;
end;
$$;

revoke all on function public.apply_counter_deltas(text, text, jsonb) from public, anon;
grant execute on function public.apply_counter_deltas(text, text, jsonb) to authenticated;


-- ---------------------------------------------------------------------
-- 4. Row Level Security
-- ---------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.app_settings to anon;

-- Profiles: readable by logged-in users; written only through the functions above.
alter table public.profiles enable row level security;
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (true);

-- Store settings: public read (login page branding), admin write.
alter table public.app_settings enable row level security;
drop policy if exists app_settings_select on public.app_settings;
drop policy if exists app_settings_insert on public.app_settings;
drop policy if exists app_settings_update on public.app_settings;
create policy app_settings_select on public.app_settings for select to anon, authenticated using (true);
create policy app_settings_insert on public.app_settings for insert to authenticated with check (public.is_admin());
create policy app_settings_update on public.app_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Business tables: every logged-in account (admin + workers) can work on
-- them. Fine-grained permissions per module are enforced by the app.
do $$
declare t text;
begin
  foreach t in array array[
    'units','marques','stock_categories','products','suppliers','purchases','clients','sales',
    'production_categories','productions','fiche_categories','fiche_technics','comptoir_items','destructions',
    'expenses','caisse_transactions','cash_sessions','caisse_reports','commands'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_all', t);
    execute format('create policy %I on public.%I for all to authenticated using (true) with check (true)', t || '_all', t);
  end loop;
end $$;

-- Workers & roles: readable by everyone logged in (permissions of the
-- current worker), writable only by admins / workers allowed to manage staff.
do $$
declare t text;
begin
  foreach t in array array['workers', 'worker_roles'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_all', t);
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_write', t);
    execute format('create policy %I on public.%I for select to authenticated using (true)', t || '_select', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.can_manage_workers()) with check (public.can_manage_workers())', t || '_write', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 5. Realtime (instant sync between POS, kitchen and admin devices)
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach t in array array[
    'app_settings','units','marques','stock_categories','products','suppliers','purchases','clients','sales',
    'production_categories','productions','fiche_categories','fiche_technics','comptoir_items','destructions',
    'worker_roles','workers','expenses','caisse_transactions','cash_sessions','caisse_reports','commands'
  ] loop
    if not exists (
      select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 6. Storage buckets for images
-- ---------------------------------------------------------------------
--  product-images : products, fiches techniques, productions (optimised WebP)
--  store-assets   : store logo
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('product-images', 'product-images', true, 2097152, array['image/webp', 'image/jpeg', 'image/png', 'image/gif']),
  ('store-assets',   'store-assets',   true, 2097152, array['image/webp', 'image/jpeg', 'image/png', 'image/gif', 'image/svg+xml'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "images public read" on storage.objects;
drop policy if exists "images authenticated insert" on storage.objects;
drop policy if exists "images authenticated update" on storage.objects;
drop policy if exists "images authenticated delete" on storage.objects;

create policy "images public read" on storage.objects
  for select to anon, authenticated
  using (bucket_id in ('product-images', 'store-assets'));

create policy "images authenticated insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images' or (bucket_id = 'store-assets' and public.is_admin()));

create policy "images authenticated update" on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images' or (bucket_id = 'store-assets' and public.is_admin()))
  with check (bucket_id = 'product-images' or (bucket_id = 'store-assets' and public.is_admin()));

create policy "images authenticated delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images' or (bucket_id = 'store-assets' and public.is_admin()));

-- ---------------------------------------------------------------------
-- 7. Reference data (no demo data — only the empty store profile and the
--    standard measurement units)
-- ---------------------------------------------------------------------
insert into public.app_settings (id) values (1) on conflict (id) do nothing;

insert into public.units (id, name) values
  ('unit-g', 'g'), ('unit-kg', 'kg'), ('unit-l', 'litre'), ('unit-m', 'm')
on conflict (id) do nothing;

-- Tell PostgREST to reload its schema cache
notify pgrst, 'reload schema';
