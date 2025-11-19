
-- Enable UUID extension
create extension if not exists "uuid-ossp";

create table if not exists public.projects (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null,
  title text,
  original_url text,
  status text default 'pending', -- pending, downloading, separating, uploading, completed, failed
  stems jsonb, -- Stores URLs like {"vocals": "url", "drums": "url"}
  error text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.projects enable row level security;

do $$
begin
  create policy "Users can view their own projects"
    on public.projects for select
    using ( auth.uid() = user_id );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "Users can insert their own projects"
    on public.projects for insert
    with check ( auth.uid() = user_id );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "Users can update their own projects"
    on public.projects for update
    using ( auth.uid() = user_id );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.stems (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references public.projects(id) on delete cascade,
  user_id uuid references auth.users not null,
  name text not null,
  stem_type text not null,
  url text not null,
  duration double precision,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create unique index if not exists stems_project_type_idx on public.stems(project_id, stem_type);

alter table public.stems enable row level security;

do $$
begin
  create policy "Users can view their stems"
    on public.stems for select
    using ( auth.uid() = user_id );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "Users can insert their stems"
    on public.stems for insert
    with check ( auth.uid() = user_id );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "Users can update their stems"
    on public.stems for update
    using ( auth.uid() = user_id );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "Users can delete their stems"
    on public.stems for delete
    using ( auth.uid() = user_id );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.stem_segments (
  id uuid primary key default uuid_generate_v4(),
  stem_id uuid references public.stems(id) on delete cascade,
  user_id uuid references auth.users not null,
  name text not null,
  start_time double precision not null,
  end_time double precision not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint start_before_end check (start_time < end_time)
);

alter table public.stem_segments enable row level security;

do $$
begin
  create policy "Users can view their segments"
    on public.stem_segments for select
    using ( auth.uid() = user_id );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "Users can insert their segments"
    on public.stem_segments for insert
    with check ( auth.uid() = user_id );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "Users can update their segments"
    on public.stem_segments for update
    using ( auth.uid() = user_id );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "Users can delete their segments"
    on public.stem_segments for delete
    using ( auth.uid() = user_id );
exception
  when duplicate_object then null;
end $$;

insert into storage.buckets (id, name, public)
values ('stems', 'stems', true)
on conflict (id) do nothing;

-- Storage Policies
do $$
begin
  create policy "Anyone can read stems"
    on storage.objects for select
    using ( bucket_id = 'stems' );
exception
  when duplicate_object then null;
  when insufficient_privilege then null;
end $$;

do $$
begin
  create policy "Authenticated users can upload stems"
    on storage.objects for insert
    with check ( bucket_id = 'stems' and auth.role() = 'authenticated' );
exception
  when duplicate_object then null;
  when insufficient_privilege then null;
end $$;
