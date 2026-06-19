-- AI Chat tables: conversations (threads) + messages
-- Run this in your Supabase SQL editor.
-- If upgrading from the old single-table version, drop it first:
drop table if exists public.ai_chat_messages;
drop table if exists public.ai_chat_threads;

-- Conversations / threads
create table public.ai_chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null default 'New conversation',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index if not exists idx_ai_threads_user on public.ai_chat_threads (user_id, updated_at desc);

alter table public.ai_chat_threads enable row level security;
create policy "Users read own threads" on public.ai_chat_threads for select using (auth.uid() = user_id);
create policy "Users insert own threads" on public.ai_chat_threads for insert with check (auth.uid() = user_id);
create policy "Users update own threads" on public.ai_chat_threads for update using (auth.uid() = user_id);
create policy "Users delete own threads" on public.ai_chat_threads for delete using (auth.uid() = user_id);

-- Messages within a thread
create table public.ai_chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid references public.ai_chat_threads(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null check (role in ('user', 'model')),
  text text not null,
  created_at timestamptz default now() not null
);

create index if not exists idx_ai_chat_thread_time on public.ai_chat_messages (thread_id, created_at asc);

alter table public.ai_chat_messages enable row level security;
create policy "Users read own messages" on public.ai_chat_messages for select using (auth.uid() = user_id);
create policy "Users insert own messages" on public.ai_chat_messages for insert with check (auth.uid() = user_id);
create policy "Users delete own messages" on public.ai_chat_messages for delete using (auth.uid() = user_id);

-- Function to auto-update thread's updated_at when a message is inserted
create or replace function public.update_thread_timestamp()
returns trigger as $$
begin
  update public.ai_chat_threads set updated_at = now() where id = NEW.thread_id;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_update_thread_ts on public.ai_chat_messages;
create trigger trg_update_thread_ts after insert on public.ai_chat_messages
  for each row execute function public.update_thread_timestamp();
