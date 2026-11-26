CREATE OR REPLACE FUNCTION public.preview_delete_dependencies(
  p_resource TEXT,
  p_record_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária';
  END IF;

  CASE p_resource
    WHEN 'events' THEN
      IF NOT public.pentacordis_has_permission('events', 'delete')
         OR NOT EXISTS (SELECT 1 FROM public.events WHERE id = p_record_id) THEN
        RAISE EXCEPTION 'Evento não encontrado ou sem permissão para excluir';
      END IF;
      RETURN jsonb_build_object(
        'lineup', (SELECT count(*) FROM public.event_lineup WHERE event_id = p_record_id),
        'equipment', (SELECT count(*) FROM public.event_equipment WHERE event_id = p_record_id),
        'expenses', (SELECT count(*) FROM public.event_expenses WHERE event_id = p_record_id),
        'setlist', (SELECT count(*) FROM public.event_setlist WHERE event_id = p_record_id),
        'checklist', (SELECT count(*) FROM public.event_checklist_items WHERE event_id = p_record_id),
        'tasks', (SELECT count(*) FROM public.tasks WHERE event_id = p_record_id),
        'transactions_preserved', (SELECT count(*) FROM public.financial_transactions WHERE event_id = p_record_id)
      );
    WHEN 'leads' THEN
      IF NOT public.pentacordis_has_permission('leads', 'delete')
         OR NOT EXISTS (SELECT 1 FROM public.leads WHERE id = p_record_id) THEN
        RAISE EXCEPTION 'Lead não encontrado ou sem permissão para excluir';
      END IF;
      RETURN jsonb_build_object(
        'contracts', (SELECT count(*) FROM public.contracts WHERE lead_id = p_record_id),
        'signed_contracts', (
          SELECT count(*) FROM public.contracts
          WHERE lead_id = p_record_id AND status = 'assinado'
        ),
        'proposals', (
          SELECT count(*) FROM public.proposals p
          WHERE p.lead_id = p_record_id
             OR p.contract_id IN (SELECT c.id FROM public.contracts c WHERE c.lead_id = p_record_id)
        ),
        'events', (
          SELECT count(*) FROM public.events e
          WHERE e.contract_id IN (SELECT c.id FROM public.contracts c WHERE c.lead_id = p_record_id)
        ),
        'tasks', (
          SELECT count(*) FROM public.tasks t
          WHERE t.lead_id = p_record_id
             OR t.contract_id IN (SELECT c.id FROM public.contracts c WHERE c.lead_id = p_record_id)
             OR t.event_id IN (
               SELECT e.id FROM public.events e
               WHERE e.contract_id IN (SELECT c.id FROM public.contracts c WHERE c.lead_id = p_record_id)
             )
        ),
        'transactions_preserved', (
          SELECT count(*) FROM public.financial_transactions ft
          WHERE ft.contract_id IN (SELECT c.id FROM public.contracts c WHERE c.lead_id = p_record_id)
             OR ft.installment_id IN (
               SELECT i.id FROM public.installments i
               WHERE i.contract_id IN (SELECT c.id FROM public.contracts c WHERE c.lead_id = p_record_id)
             )
             OR ft.event_id IN (
               SELECT e.id FROM public.events e
               WHERE e.contract_id IN (SELECT c.id FROM public.contracts c WHERE c.lead_id = p_record_id)
             )
        )
      );
    WHEN 'contracts' THEN
      IF NOT public.pentacordis_has_permission('contracts', 'delete')
         OR NOT EXISTS (SELECT 1 FROM public.contracts WHERE id = p_record_id) THEN
        RAISE EXCEPTION 'Contrato não encontrado ou sem permissão para excluir';
      END IF;
      RETURN jsonb_build_object(
        'signed_contracts', (
          SELECT count(*) FROM public.contracts
          WHERE id = p_record_id AND status = 'assinado'
        ),
        'installments', (SELECT count(*) FROM public.installments WHERE contract_id = p_record_id),
        'events', (SELECT count(*) FROM public.events WHERE contract_id = p_record_id),
        'proposals', (SELECT count(*) FROM public.proposals WHERE contract_id = p_record_id),
        'tasks', (
          SELECT count(*) FROM public.tasks t
          WHERE t.contract_id = p_record_id
             OR t.event_id IN (SELECT e.id FROM public.events e WHERE e.contract_id = p_record_id)
        ),
        'transactions_preserved', (
          SELECT count(*) FROM public.financial_transactions ft
          WHERE ft.contract_id = p_record_id
             OR ft.installment_id IN (SELECT i.id FROM public.installments i WHERE i.contract_id = p_record_id)
             OR ft.event_id IN (SELECT e.id FROM public.events e WHERE e.contract_id = p_record_id)
        )
      );
    WHEN 'proposals' THEN
      IF NOT public.pentacordis_has_permission('proposals', 'delete')
         OR NOT EXISTS (SELECT 1 FROM public.proposals WHERE id = p_record_id) THEN
        RAISE EXCEPTION 'Proposta não encontrada ou sem permissão para excluir';
      END IF;
      RETURN jsonb_build_object(
        'items', (SELECT count(*) FROM public.proposal_items WHERE proposal_id = p_record_id)
      );
    WHEN 'songs' THEN
      IF NOT public.pentacordis_has_permission('songs', 'delete')
         OR NOT EXISTS (SELECT 1 FROM public.songs WHERE id = p_record_id) THEN
        RAISE EXCEPTION 'Música não encontrada ou sem permissão para excluir';
      END IF;
      RETURN jsonb_build_object(
        'setlist_entries', (SELECT count(*) FROM public.event_setlist WHERE song_id = p_record_id),
        'assets', (SELECT count(*) FROM public.song_assets WHERE song_id = p_record_id),
        'recommendations', (SELECT count(*) FROM public.maestro_recommendations WHERE song_id = p_record_id)
      );
    ELSE
      RAISE EXCEPTION 'Tipo de registro inválido para exclusão';
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_event_cascade(p_event_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.pentacordis_has_permission('events', 'delete') THEN
    RAISE EXCEPTION 'Sem permissão para excluir eventos';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.events WHERE id = p_event_id) THEN
    RAISE EXCEPTION 'Evento não encontrado';
  END IF;
  IF EXISTS (SELECT 1 FROM public.event_lineup WHERE event_id = p_event_id)
     AND NOT public.pentacordis_has_permission('event_lineup', 'delete') THEN
    RAISE EXCEPTION 'Sem permissão para excluir a escala vinculada ao evento';
  END IF;
  IF EXISTS (SELECT 1 FROM public.event_equipment WHERE event_id = p_event_id)
     AND NOT public.pentacordis_has_permission('event_equipment', 'delete') THEN
    RAISE EXCEPTION 'Sem permissão para excluir os equipamentos vinculados ao evento';
  END IF;
  IF EXISTS (SELECT 1 FROM public.event_expenses WHERE event_id = p_event_id)
     AND NOT public.pentacordis_has_permission('event_expenses', 'delete') THEN
    RAISE EXCEPTION 'Sem permissão para excluir as despesas vinculadas ao evento';
  END IF;
  IF EXISTS (SELECT 1 FROM public.event_setlist WHERE event_id = p_event_id)
     AND NOT public.pentacordis_has_permission('event_setlist', 'delete') THEN
    RAISE EXCEPTION 'Sem permissão para excluir o repertório vinculado ao evento';
  END IF;
  IF EXISTS (SELECT 1 FROM public.event_checklist_items WHERE event_id = p_event_id)
     AND NOT public.pentacordis_has_permission('event_checklist_items', 'delete') THEN
    RAISE EXCEPTION 'Sem permissão para excluir o checklist vinculado ao evento';
  END IF;
  IF EXISTS (SELECT 1 FROM public.tasks WHERE event_id = p_event_id)
     AND NOT public.pentacordis_has_permission('tasks', 'delete') THEN
    RAISE EXCEPTION 'Sem permissão para excluir as tarefas vinculadas ao evento';
  END IF;

  DELETE FROM public.tasks WHERE event_id = p_event_id;
  DELETE FROM public.events WHERE id = p_event_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_proposal_cascade(p_proposal_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.pentacordis_has_permission('proposals', 'delete') THEN
    RAISE EXCEPTION 'Sem permissão para excluir propostas';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.proposals WHERE id = p_proposal_id) THEN
    RAISE EXCEPTION 'Proposta não encontrada';
  END IF;
  IF EXISTS (SELECT 1 FROM public.proposal_items WHERE proposal_id = p_proposal_id)
     AND NOT public.pentacordis_has_permission('proposal_items', 'delete') THEN
    RAISE EXCEPTION 'Sem permissão para excluir os itens da proposta';
  END IF;

  DELETE FROM public.proposals WHERE id = p_proposal_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_contract_cascade(p_contract_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_event_id UUID;
  v_proposal_id UUID;
BEGIN
  IF auth.uid() IS NULL OR NOT public.pentacordis_has_permission('contracts', 'delete') THEN
    RAISE EXCEPTION 'Sem permissão para excluir contratos';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.contracts WHERE id = p_contract_id) THEN
    RAISE EXCEPTION 'Contrato não encontrado';
  END IF;
  IF EXISTS (SELECT 1 FROM public.installments WHERE contract_id = p_contract_id)
     AND NOT public.pentacordis_has_permission('installments', 'delete') THEN
    RAISE EXCEPTION 'Sem permissão para excluir as parcelas do contrato';
  END IF;
  IF EXISTS (SELECT 1 FROM public.events WHERE contract_id = p_contract_id)
     AND NOT public.pentacordis_has_permission('events', 'delete') THEN
    RAISE EXCEPTION 'Sem permissão para excluir os eventos vinculados ao contrato';
  END IF;
  IF EXISTS (SELECT 1 FROM public.proposals WHERE contract_id = p_contract_id)
     AND NOT public.pentacordis_has_permission('proposals', 'delete') THEN
    RAISE EXCEPTION 'Sem permissão para excluir as propostas vinculadas ao contrato';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.contract_id = p_contract_id
       OR t.event_id IN (SELECT e.id FROM public.events e WHERE e.contract_id = p_contract_id)
  ) AND NOT public.pentacordis_has_permission('tasks', 'delete') THEN
    RAISE EXCEPTION 'Sem permissão para excluir as tarefas vinculadas ao contrato';
  END IF;

  DELETE FROM public.tasks
  WHERE contract_id = p_contract_id
     OR event_id IN (SELECT e.id FROM public.events e WHERE e.contract_id = p_contract_id);
  FOR v_proposal_id IN
    SELECT id FROM public.proposals WHERE contract_id = p_contract_id
  LOOP
    PERFORM public.delete_proposal_cascade(v_proposal_id);
  END LOOP;
  FOR v_event_id IN
    SELECT id FROM public.events WHERE contract_id = p_contract_id
  LOOP
    PERFORM public.delete_event_cascade(v_event_id);
  END LOOP;
  DELETE FROM public.contracts WHERE id = p_contract_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_lead_cascade(p_lead_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_contract_id UUID;
  v_proposal_id UUID;
BEGIN
  IF auth.uid() IS NULL OR NOT public.pentacordis_has_permission('leads', 'delete') THEN
    RAISE EXCEPTION 'Sem permissão para excluir leads';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.leads WHERE id = p_lead_id) THEN
    RAISE EXCEPTION 'Lead não encontrado';
  END IF;
  IF EXISTS (SELECT 1 FROM public.contracts WHERE lead_id = p_lead_id)
     AND NOT public.pentacordis_has_permission('contracts', 'delete') THEN
    RAISE EXCEPTION 'Sem permissão para excluir os contratos vinculados ao lead';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.proposals p
    WHERE p.lead_id = p_lead_id
       OR p.contract_id IN (SELECT c.id FROM public.contracts c WHERE c.lead_id = p_lead_id)
  ) AND NOT public.pentacordis_has_permission('proposals', 'delete') THEN
    RAISE EXCEPTION 'Sem permissão para excluir as propostas vinculadas ao lead';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.contract_id IN (SELECT c.id FROM public.contracts c WHERE c.lead_id = p_lead_id)
  ) AND NOT public.pentacordis_has_permission('events', 'delete') THEN
    RAISE EXCEPTION 'Sem permissão para excluir os eventos vinculados ao lead';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.lead_id = p_lead_id
       OR t.contract_id IN (SELECT c.id FROM public.contracts c WHERE c.lead_id = p_lead_id)
       OR t.event_id IN (
         SELECT e.id FROM public.events e
         WHERE e.contract_id IN (SELECT c.id FROM public.contracts c WHERE c.lead_id = p_lead_id)
       )
  ) AND NOT public.pentacordis_has_permission('tasks', 'delete') THEN
    RAISE EXCEPTION 'Sem permissão para excluir as tarefas vinculadas ao lead';
  END IF;

  DELETE FROM public.tasks
  WHERE lead_id = p_lead_id
     OR contract_id IN (SELECT c.id FROM public.contracts c WHERE c.lead_id = p_lead_id)
     OR event_id IN (
       SELECT e.id FROM public.events e
       WHERE e.contract_id IN (SELECT c.id FROM public.contracts c WHERE c.lead_id = p_lead_id)
     );
  FOR v_proposal_id IN
    SELECT p.id FROM public.proposals p
    WHERE p.lead_id = p_lead_id
       OR p.contract_id IN (SELECT c.id FROM public.contracts c WHERE c.lead_id = p_lead_id)
  LOOP
    PERFORM public.delete_proposal_cascade(v_proposal_id);
  END LOOP;
  FOR v_contract_id IN
    SELECT id FROM public.contracts WHERE lead_id = p_lead_id
  LOOP
    PERFORM public.delete_contract_cascade(v_contract_id);
  END LOOP;
  DELETE FROM public.leads WHERE id = p_lead_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_song_cascade(p_song_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_event_ids UUID[];
  v_event_id UUID;
  v_ordered_ids UUID[];
BEGIN
  IF auth.uid() IS NULL OR NOT public.pentacordis_has_permission('songs', 'delete') THEN
    RAISE EXCEPTION 'Sem permissão para excluir músicas';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.songs WHERE id = p_song_id) THEN
    RAISE EXCEPTION 'Música não encontrada';
  END IF;
  IF EXISTS (SELECT 1 FROM public.event_setlist WHERE song_id = p_song_id)
     AND NOT public.pentacordis_has_permission('event_setlist', 'delete') THEN
    RAISE EXCEPTION 'Sem permissão para remover a música dos repertórios vinculados';
  END IF;
  IF EXISTS (SELECT 1 FROM public.event_setlist WHERE song_id = p_song_id)
     AND NOT public.pentacordis_has_permission('event_setlist', 'update') THEN
    RAISE EXCEPTION 'Sem permissão para reorganizar os repertórios vinculados';
  END IF;
  IF EXISTS (SELECT 1 FROM public.song_assets WHERE song_id = p_song_id)
     AND NOT public.pentacordis_has_permission('song_assets', 'delete') THEN
    RAISE EXCEPTION 'Sem permissão para excluir os arquivos vinculados à música';
  END IF;
  IF EXISTS (SELECT 1 FROM public.maestro_recommendations WHERE song_id = p_song_id)
     AND NOT public.pentacordis_has_permission('maestro_recommendations', 'delete') THEN
    RAISE EXCEPTION 'Sem permissão para excluir as recomendações vinculadas à música';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT event_id), ARRAY[]::UUID[])
  INTO v_event_ids
  FROM public.event_setlist
  WHERE song_id = p_song_id;
  DELETE FROM public.event_setlist WHERE song_id = p_song_id;
  FOREACH v_event_id IN ARRAY v_event_ids
  LOOP
    SELECT COALESCE(array_agg(id ORDER BY order_index), ARRAY[]::UUID[])
    INTO v_ordered_ids
    FROM public.event_setlist
    WHERE event_id = v_event_id;
    PERFORM public.reorder_event_setlist(v_event_id, v_ordered_ids);
  END LOOP;
  DELETE FROM public.songs WHERE id = p_song_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_event_setlist_item(
  p_event_id UUID,
  p_item_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ordered_ids UUID[];
BEGIN
  IF auth.uid() IS NULL
     OR NOT public.pentacordis_has_permission('event_setlist', 'delete')
     OR NOT public.pentacordis_has_permission('event_setlist', 'update') THEN
    RAISE EXCEPTION 'Sem permissão para editar o repertório';
  END IF;

  DELETE FROM public.event_setlist
  WHERE id = p_item_id AND event_id = p_event_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Música não encontrada neste evento';
  END IF;

  SELECT COALESCE(array_agg(id ORDER BY order_index), ARRAY[]::UUID[])
  INTO v_ordered_ids
  FROM public.event_setlist
  WHERE event_id = p_event_id;
  PERFORM public.reorder_event_setlist(p_event_id, v_ordered_ids);
END;
$$;

REVOKE ALL ON FUNCTION public.preview_delete_dependencies(TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_event_cascade(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_proposal_cascade(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_contract_cascade(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_lead_cascade(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_song_cascade(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_event_setlist_item(UUID, UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.preview_delete_dependencies(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_event_cascade(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_proposal_cascade(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_contract_cascade(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_lead_cascade(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_song_cascade(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_event_setlist_item(UUID, UUID) TO authenticated;
