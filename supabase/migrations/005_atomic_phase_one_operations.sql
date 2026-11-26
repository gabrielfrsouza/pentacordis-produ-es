CREATE OR REPLACE FUNCTION public.convert_lead_to_contract_and_event(p_lead_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_lead public.leads%ROWTYPE;
  v_contract public.contracts%ROWTYPE;
  v_event public.events%ROWTYPE;
BEGIN
  SELECT *
  INTO v_lead
  FROM public.leads
  WHERE id = p_lead_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead não encontrado';
  END IF;

  SELECT *
  INTO v_contract
  FROM public.contracts
  WHERE lead_id = p_lead_id
  ORDER BY created_at
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.contracts (
      lead_id,
      client_name,
      cpf_cnpj,
      total_value,
      producer_margin_pct,
      tax_pct,
      status
    )
    VALUES (
      v_lead.id,
      v_lead.name,
      NULL,
      COALESCE(v_lead.estimated_value, 0),
      30,
      6,
      'rascunho'
    )
    RETURNING * INTO v_contract;
  END IF;

  SELECT *
  INTO v_event
  FROM public.events
  WHERE contract_id = v_contract.id
  ORDER BY created_at
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.events (
      contract_id,
      title,
      event_type,
      event_date,
      status
    )
    VALUES (
      v_contract.id,
      COALESCE(v_lead.event_type, 'Evento') || ' - ' || v_lead.name,
      v_lead.event_type,
      COALESCE(v_lead.event_date, CURRENT_DATE),
      'planejamento'
    )
    RETURNING * INTO v_event;
  END IF;

  UPDATE public.leads
  SET status = 'fechado'
  WHERE id = v_lead.id;

  RETURN jsonb_build_object(
    'contract', to_jsonb(v_contract),
    'event', to_jsonb(v_event)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.convert_lead_to_contract_and_event(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.convert_lead_to_contract_and_event(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.reorder_event_setlist(
  p_event_id UUID,
  p_ordered_ids UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_expected_count INTEGER;
  v_matching_count INTEGER;
  v_max_order INTEGER;
  v_offset BIGINT;
BEGIN
  IF p_ordered_ids IS NULL OR EXISTS (
    SELECT 1 FROM unnest(p_ordered_ids) AS requested(id) WHERE id IS NULL
  ) THEN
    RAISE EXCEPTION 'A ordem do repertório é inválida';
  END IF;

  PERFORM 1
  FROM public.event_setlist
  WHERE event_id = p_event_id
  FOR UPDATE;

  SELECT COUNT(*)::INTEGER, COALESCE(MAX(order_index), -1)
  INTO v_expected_count, v_max_order
  FROM public.event_setlist
  WHERE event_id = p_event_id;

  SELECT COUNT(DISTINCT requested.id)::INTEGER
  INTO v_matching_count
  FROM unnest(p_ordered_ids) AS requested(id)
  JOIN public.event_setlist item
    ON item.id = requested.id
   AND item.event_id = p_event_id;

  IF cardinality(p_ordered_ids) <> v_expected_count
    OR v_matching_count <> v_expected_count
    OR (
      SELECT COUNT(DISTINCT requested.id)
      FROM unnest(p_ordered_ids) AS requested(id)
    ) <> cardinality(p_ordered_ids) THEN
    RAISE EXCEPTION 'A lista de músicas mudou; atualize o evento e tente novamente';
  END IF;

  v_offset := v_max_order::BIGINT + cardinality(p_ordered_ids) + 1;
  IF v_offset + cardinality(p_ordered_ids) > 2147483647 THEN
    RAISE EXCEPTION 'O repertório excede a quantidade permitida para reordenação';
  END IF;

  UPDATE public.event_setlist item
  SET order_index = (v_offset + requested.ordinality)::INTEGER
  FROM unnest(p_ordered_ids) WITH ORDINALITY AS requested(id, ordinality)
  WHERE item.id = requested.id
    AND item.event_id = p_event_id;

  UPDATE public.event_setlist item
  SET order_index = (requested.ordinality - 1)::INTEGER
  FROM unnest(p_ordered_ids) WITH ORDINALITY AS requested(id, ordinality)
  WHERE item.id = requested.id
    AND item.event_id = p_event_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reorder_event_setlist(UUID, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reorder_event_setlist(UUID, UUID[]) TO authenticated;
