-- Tabela centralizada de Partidas (Matches)
create table public.matches (
  id bigint primary key, -- O ID original da api-football (ex: 104234)
  league_id integer not null,
  season integer not null,
  home_team text not null,
  home_team_id integer not null,
  away_team text not null,
  away_team_id integer not null,
  kickoff timestamp with time zone not null,
  status text not null, -- 'UPC', 'LIVE', 'FIN'
  score_home integer,
  score_away integer,
  minute text,
  round text,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Habilitar RLS para Matches (leitura pública, escrita só pelo backend)
alter table public.matches enable row level security;

-- Todos podem ler os jogos
create policy "Matches are viewable by everyone" on public.matches for select using (true);

-- (A escrita será feita pelo backend usando a Service Role, que ignora RLS, então não precisamos de política de insert)
