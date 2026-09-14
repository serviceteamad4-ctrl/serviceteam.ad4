alter table public.requests enable row level security;

drop policy if exists "allow anon all" on public.requests;
create policy "allow anon all" on public.requests
  for all
  to anon
  using (true)
  with check (true);
