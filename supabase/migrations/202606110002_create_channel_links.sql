-- Links chat-platform identities (Telegram / WhatsApp / Notion) to PUFT users.
create table if not exists public.channel_links (
    id bigint generated always as identity primary key,
    user_id bigint not null references public.users(id) on delete cascade,
    platform varchar(20),
    external_id varchar(120),
    display_name varchar(120),
    code varchar(12),
    verified boolean not null default false,
    created_at timestamptz not null default now()
);

create index if not exists idx_channel_links_user_id on public.channel_links (user_id);
create index if not exists idx_channel_links_code on public.channel_links (code);
-- One verified identity maps to exactly one user per platform.
create unique index if not exists uq_channel_links_identity
    on public.channel_links (platform, external_id)
    where verified;
