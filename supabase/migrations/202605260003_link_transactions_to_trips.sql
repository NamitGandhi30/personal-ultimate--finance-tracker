alter table public.transactions
    add column if not exists trip_id bigint references public.trips(id) on delete set null;

create index if not exists idx_transactions_trip_id on public.transactions (trip_id);
