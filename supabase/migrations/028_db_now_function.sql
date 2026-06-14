-- RPC to return the current database timestamp
-- This lets the app determine "today" from Supabase's clock
create or replace function public.get_db_now()
returns timestamptz
language sql
stable
as $$
  select now();
$$;
