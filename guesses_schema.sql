-- Tabela de Palpites (Guesses)
create table public.guesses (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  group_id uuid references public.groups(id) on delete cascade not null,
  match_id bigint references public.matches(id) on delete cascade not null,
  score_home integer not null,
  score_away integer not null,
  points integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, group_id, match_id)
);

-- Habilitar RLS
alter table public.guesses enable row level security;
create policy "Guesses viewable by everyone in group" on public.guesses for select using (true);
create policy "Users can insert own guesses" on public.guesses for insert with check (auth.uid() = user_id);
create policy "Users can update own guesses" on public.guesses for update using (auth.uid() = user_id);
