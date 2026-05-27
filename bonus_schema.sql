-- Tabela de Perguntas Bônus
create table public.bonus_questions (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references public.groups(id) on delete cascade not null,
  question text not null,
  question_type text not null check (question_type in ('text', 'options', 'range')),
  options jsonb,
  points integer not null default 10,
  deadline timestamp with time zone not null,
  correct_answer text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Tabela de Respostas Bônus
create table public.bonus_answers (
  id uuid default gen_random_uuid() primary key,
  question_id uuid references public.bonus_questions(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  answer text not null,
  points_earned integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(question_id, user_id)
);

-- Habilitar RLS
alter table public.bonus_questions enable row level security;
alter table public.bonus_answers enable row level security;

-- Políticas para Perguntas
create policy "Bonus questions viewable by group members" on public.bonus_questions for select using (
  exists(select 1 from group_members where group_id = bonus_questions.group_id and user_id = auth.uid())
);
create policy "Owners can manage bonus questions" on public.bonus_questions for all using (
  exists(select 1 from groups where id = bonus_questions.group_id and owner_id = auth.uid())
);

-- Políticas para Respostas
create policy "Users can view own answers and others after deadline" on public.bonus_answers for select using (
  user_id = auth.uid() or exists(
    select 1 from bonus_questions bq 
    where bq.id = bonus_answers.question_id and bq.deadline < now()
  )
);
create policy "Users can insert own answer before deadline" on public.bonus_answers for insert with check (
  user_id = auth.uid() and exists(
    select 1 from bonus_questions bq where bq.id = bonus_answers.question_id and bq.deadline > now()
  )
);
create policy "Users can update own answer before deadline" on public.bonus_answers for update using (
  user_id = auth.uid() and exists(
    select 1 from bonus_questions bq where bq.id = bonus_answers.question_id and bq.deadline > now()
  )
);

-- Trigger para atualização automática dos pontos de respostas bônus
create or replace function public.update_bonus_answers_points()
returns trigger as $$
begin
  -- Se o correct_answer foi modificado (e não é nulo)
  if new.correct_answer is distinct from old.correct_answer then
    if new.correct_answer is not null then
      -- Atualiza todas as respostas relacionadas àquela pergunta
      update public.bonus_answers
      set points_earned = case
        -- Comparação ignorando maiúsculas e espaços no início/fim
        when trim(lower(answer)) = trim(lower(new.correct_answer)) then new.points
        else 0
      end
      where question_id = new.id;
    else
      -- Se o correct_answer foi resetado para nulo
      update public.bonus_answers
      set points_earned = 0
      where question_id = new.id;
    end if;
  end if;
  
  -- Se a pontuação (points) da pergunta for alterada, recalcula os pontos ganhos para os que acertaram
  if new.points is distinct from old.points and new.correct_answer is not null then
    update public.bonus_answers
    set points_earned = new.points
    where question_id = new.id
      and trim(lower(answer)) = trim(lower(new.correct_answer));
  end if;

  return new;
end;
$$ language plpgsql security definer;

create trigger on_bonus_question_updated
  after update on public.bonus_questions
  for each row execute procedure public.update_bonus_answers_points();
