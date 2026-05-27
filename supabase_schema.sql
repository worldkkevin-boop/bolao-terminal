-- Criação da tabela de Usuários (estendendo a auth.users do Supabase)
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Habilitar RLS (Row Level Security) para Profiles
alter table public.profiles enable row level security;
create policy "Public profiles are viewable by everyone." on public.profiles for select using (true);
create policy "Users can insert their own profile." on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile." on public.profiles for update using (auth.uid() = id);

-- Tabela de Grupos (Bolões)
create table public.groups (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  invite_code text unique not null,
  owner_id uuid references public.profiles(id) not null,
  player_limit integer default 5, -- começa com 5 no grátis
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Habilitar RLS para Groups
alter table public.groups enable row level security;
create policy "Groups are viewable by everyone" on public.groups for select using (true);
create policy "Authenticated users can create groups" on public.groups for insert with check (auth.uid() = owner_id);
create policy "Owners can update their groups" on public.groups for update using (auth.uid() = owner_id);

-- Tabela de Membros do Grupo
create table public.group_members (
  group_id uuid references public.groups(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text default 'member' check (role in ('owner', 'member')),
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (group_id, user_id)
);

-- Habilitar RLS para Group Members
alter table public.group_members enable row level security;
create policy "Group members are viewable by everyone" on public.group_members for select using (true);
create policy "Authenticated users can join groups" on public.group_members for insert with check (auth.uid() = user_id);

-- Criar função (Trigger) para criar automaticamente um Profile quando logar com Google
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
