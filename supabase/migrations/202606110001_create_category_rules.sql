-- Learned merchant/keyword -> category mappings from user corrections.
create table if not exists public.category_rules (
    id bigint generated always as identity primary key,
    user_id bigint not null references public.users(id) on delete cascade,
    keyword varchar(120) not null,
    category varchar(80) not null,
    updated_at timestamptz not null default now(),
    constraint uq_category_rules_user_keyword unique (user_id, keyword)
);

create index if not exists idx_category_rules_user_id on public.category_rules (user_id);
create index if not exists idx_category_rules_keyword on public.category_rules (keyword);
