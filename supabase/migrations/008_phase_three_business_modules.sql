create or replace function public.save_proposal(
  p_proposal_id uuid,
  p_proposal jsonb,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_proposal_id uuid;
  v_total_value numeric;
begin
  if auth.uid() is null then
    raise exception 'Autenticação necessária';
  end if;

  if jsonb_typeof(p_proposal) is distinct from 'object'
     or jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items) > 100 then
    raise exception 'Dados da proposta inválidos';
  end if;

  if nullif(trim(p_proposal->>'client_name'), '') is null then
    raise exception 'Informe o nome do cliente';
  end if;
  if coalesce((p_proposal->>'subtotal')::numeric, 0) < 0
     or coalesce((p_proposal->>'discount_amount')::numeric, 0) < 0
     or coalesce((p_proposal->>'total_value')::numeric, 0) < 0
     or coalesce((p_proposal->>'tax_pct')::numeric, 0) not between 0 and 100
     or coalesce((p_proposal->>'producer_margin_pct')::numeric, 0) not between 0 and 100 then
    raise exception 'Valores ou percentuais da proposta inválidos';
  end if;
  v_total_value := coalesce((p_proposal->>'total_value')::numeric, 0);

  if p_proposal_id is null then
    if not public.pentacordis_has_permission('proposals', 'insert') then
      raise exception 'Sem permissão para criar propostas';
    end if;

    insert into public.proposals (
      lead_id, client_name, client_email, client_phone, client_document,
      event_type, event_date, venue_name, venue_address, subtotal,
      discount_amount, tax_pct, producer_margin_pct, total_value,
      status, valid_until, notes, terms, created_by
    )
    values (
      nullif(p_proposal->>'lead_id', '')::uuid,
      trim(p_proposal->>'client_name'),
      nullif(p_proposal->>'client_email', ''),
      nullif(p_proposal->>'client_phone', ''),
      nullif(p_proposal->>'client_document', ''),
      nullif(p_proposal->>'event_type', ''),
      nullif(p_proposal->>'event_date', '')::date,
      nullif(p_proposal->>'venue_name', ''),
      nullif(p_proposal->>'venue_address', ''),
      coalesce((p_proposal->>'subtotal')::numeric, 0),
      coalesce((p_proposal->>'discount_amount')::numeric, 0),
      coalesce((p_proposal->>'tax_pct')::numeric, 0),
      coalesce((p_proposal->>'producer_margin_pct')::numeric, 0),
      coalesce((p_proposal->>'total_value')::numeric, 0),
      'rascunho',
      nullif(p_proposal->>'valid_until', '')::date,
      nullif(p_proposal->>'notes', ''),
      nullif(p_proposal->>'terms', ''),
      auth.uid()
    )
    returning id into v_proposal_id;
  else
    if not public.pentacordis_has_permission('proposals', 'update') then
      raise exception 'Sem permissão para editar propostas';
    end if;

    update public.proposals
    set client_name = trim(p_proposal->>'client_name'),
        client_email = nullif(p_proposal->>'client_email', ''),
        client_phone = nullif(p_proposal->>'client_phone', ''),
        client_document = nullif(p_proposal->>'client_document', ''),
        event_type = nullif(p_proposal->>'event_type', ''),
        event_date = nullif(p_proposal->>'event_date', '')::date,
        venue_name = nullif(p_proposal->>'venue_name', ''),
        venue_address = nullif(p_proposal->>'venue_address', ''),
        subtotal = coalesce((p_proposal->>'subtotal')::numeric, 0),
        discount_amount = coalesce((p_proposal->>'discount_amount')::numeric, 0),
        tax_pct = coalesce((p_proposal->>'tax_pct')::numeric, 0),
        producer_margin_pct = coalesce((p_proposal->>'producer_margin_pct')::numeric, 0),
        total_value = coalesce((p_proposal->>'total_value')::numeric, 0),
        valid_until = nullif(p_proposal->>'valid_until', '')::date,
        notes = nullif(p_proposal->>'notes', ''),
        terms = nullif(p_proposal->>'terms', ''),
        version = version + 1
    where id = p_proposal_id and status = 'rascunho'
    returning id into v_proposal_id;

    if v_proposal_id is null then
      raise exception 'Proposta não encontrada ou não está em rascunho';
    end if;

    delete from public.proposal_items where proposal_id = v_proposal_id;
  end if;

  insert into public.proposal_items (
    proposal_id, item_type, description, quantity, unit_price, sort_order, metadata
  )
  select
    v_proposal_id,
    coalesce(nullif(item.item_type, ''), 'servico'),
    trim(item.description),
    item.quantity,
    item.unit_price,
    coalesce(item.sort_order, 0),
    coalesce(item.metadata, '{}'::jsonb)
  from jsonb_to_recordset(p_items) as item(
    item_type text,
    description text,
    quantity numeric,
    unit_price numeric,
    sort_order integer,
    metadata jsonb
  )
  where nullif(trim(item.description), '') is not null
    and item.quantity > 0
    and item.unit_price >= 0;

  if (select count(*) from public.proposal_items where proposal_id = v_proposal_id)
     <> jsonb_array_length(p_items) then
    raise exception 'Um ou mais itens da proposta são inválidos';
  end if;
  if round((select coalesce(sum(total_price), 0) from public.proposal_items where proposal_id = v_proposal_id), 2)
     <> round(v_total_value, 2) then
    raise exception 'O total da proposta não corresponde à soma dos itens';
  end if;

  return v_proposal_id;
end;
$$;

revoke all on function public.save_proposal(uuid, jsonb, jsonb) from public;
grant execute on function public.save_proposal(uuid, jsonb, jsonb) to authenticated;

create or replace function public.record_equipment_maintenance(
  p_asset_id uuid,
  p_maintenance jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_maintenance_id uuid;
  v_performed_at date;
  v_next_due_at date;
begin
  if auth.uid() is null
     or not public.pentacordis_has_permission('equipment_maintenance', 'insert')
     or not public.pentacordis_has_permission('equipment_assets', 'update') then
    raise exception 'Sem permissão para registrar manutenção';
  end if;
  if nullif(trim(p_maintenance->>'maintenance_type'), '') is null
     or coalesce((p_maintenance->>'cost')::numeric, 0) < 0 then
    raise exception 'Tipo ou custo de manutenção inválido';
  end if;

  v_performed_at := coalesce(nullif(p_maintenance->>'performed_at', '')::date, current_date);
  v_next_due_at := nullif(p_maintenance->>'next_due_at', '')::date;

  insert into public.equipment_maintenance (
    asset_id, maintenance_type, description, cost, performed_at, next_due_at, performed_by
  )
  values (
    p_asset_id,
    trim(p_maintenance->>'maintenance_type'),
    nullif(p_maintenance->>'description', ''),
    coalesce((p_maintenance->>'cost')::numeric, 0),
    v_performed_at,
    v_next_due_at,
    nullif(p_maintenance->>'performed_by', '')
  )
  returning id into v_maintenance_id;

  update public.equipment_assets as asset
  set last_maintenance_at = v_performed_at,
      next_maintenance_at = coalesce(v_next_due_at, asset.next_maintenance_at),
      updated_at = now()
  where id = p_asset_id;

  if not found then
    raise exception 'Patrimônio não encontrado';
  end if;

  return v_maintenance_id;
end;
$$;

revoke all on function public.record_equipment_maintenance(uuid, jsonb) from public;
grant execute on function public.record_equipment_maintenance(uuid, jsonb) to authenticated;

create or replace function public.reverse_financial_transaction(
  p_transaction_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_original public.financial_transactions%rowtype;
  v_reversal_id uuid;
begin
  if auth.uid() is null
     or not public.pentacordis_has_permission('financial_transactions', 'insert')
     or not public.pentacordis_has_permission('financial_transactions', 'update') then
    raise exception 'Sem permissão para estornar lançamentos';
  end if;

  select * into v_original
  from public.financial_transactions
  where id = p_transaction_id
  for update;

  if not found then
    raise exception 'Lançamento não encontrado';
  end if;
  if v_original.status <> 'pago' then
    raise exception 'Somente lançamentos pagos podem ser estornados; cancele lançamentos em aberto';
  end if;
  if exists (
    select 1 from public.financial_transactions
    where reversed_transaction_id = p_transaction_id
  ) then
    raise exception 'Este lançamento já possui estorno';
  end if;
  if nullif(trim(p_reason), '') is null then
    raise exception 'Informe o motivo do estorno';
  end if;

  insert into public.financial_transactions (
    event_id, contract_id, installment_id, direction, category, description,
    amount, competence_date, paid_at, status, payment_method, notes,
    reversed_transaction_id, source_type, created_by
  )
  values (
    v_original.event_id,
    v_original.contract_id,
    v_original.installment_id,
    case when v_original.direction = 'entrada' then 'saida' else 'entrada' end,
    'estorno',
    'Estorno: ' || v_original.description,
    v_original.amount,
    current_date,
    now(),
    'pago',
    v_original.payment_method,
    trim(p_reason),
    v_original.id,
    'manual',
    auth.uid()
  )
  returning id into v_reversal_id;

  update public.financial_transactions
  set status = 'estornado', updated_at = now()
  where id = v_original.id;

  return v_reversal_id;
end;
$$;

revoke all on function public.reverse_financial_transaction(uuid, text) from public;
grant execute on function public.reverse_financial_transaction(uuid, text) to authenticated;

create or replace function public.pentacordis_log_business_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_record_id uuid;
begin
  if tg_op = 'DELETE' then
    v_record_id := old.id;
  else
    v_record_id := new.id;
  end if;

  insert into public.activity_log(actor_user_id, action, resource, resource_id, description)
  values (
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    v_record_id,
    case lower(tg_op)
      when 'insert' then 'Registro criado'
      when 'update' then 'Registro atualizado'
      else 'Registro removido'
    end
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function public.pentacordis_notify_assigned_task()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_should_notify boolean := false;
begin
  if tg_op = 'INSERT' then
    v_should_notify := true;
  elsif tg_op = 'UPDATE' then
    v_should_notify := old.assigned_to is distinct from new.assigned_to;
  end if;

  if v_should_notify and new.assigned_to is not null then
    insert into public.notifications(
      user_id, title, message, category, severity, target_url, related_table, related_id
    )
    values (
      new.assigned_to,
      'Nova tarefa atribuída',
      new.title,
      'tarefa',
      case when new.priority in ('alta', 'urgente') then 'warning' else 'info' end,
      '/calendario',
      'tasks',
      new.id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists pentacordis_task_notification on public.tasks;
create trigger pentacordis_task_notification
after insert or update of assigned_to on public.tasks
for each row execute function public.pentacordis_notify_assigned_task();

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'leads',
    'contracts',
    'events',
    'proposals',
    'financial_transactions',
    'equipment_assets',
    'equipment_maintenance',
    'tasks'
  ] loop
    execute format('drop trigger if exists pentacordis_activity_log on public.%I', v_table);
    execute format(
      'create trigger pentacordis_activity_log after insert or update or delete on public.%I for each row execute function public.pentacordis_log_business_activity()',
      v_table
    );
  end loop;
end;
$$;
