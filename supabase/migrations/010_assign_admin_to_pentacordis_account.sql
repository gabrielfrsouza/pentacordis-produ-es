do $$
declare
  v_user_id uuid;
begin
  select id
  into v_user_id
  from auth.users
  where lower(email) = lower('pentacordis@gmail.com')
  limit 1;

  if v_user_id is null then
    raise exception 'Conta pentacordis@gmail.com nao encontrada em Supabase Auth';
  end if;

  insert into public.user_roles(user_id, role_key, is_active)
  values (v_user_id, 'admin', true)
  on conflict (user_id, role_key)
  do update set is_active = true;
end
$$;
