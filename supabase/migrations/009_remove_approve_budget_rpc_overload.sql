-- PostgREST cannot resolve named RPC arguments when two overloads expose the
-- same parameter names and types in a different declaration order.
drop function if exists public.approve_budget_and_create_event(
  text,
  text,
  date,
  text,
  text,
  uuid,
  numeric,
  jsonb,
  numeric,
  numeric,
  text
);

notify pgrst, 'reload schema';
