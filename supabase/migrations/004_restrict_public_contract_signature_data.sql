CREATE OR REPLACE FUNCTION public.get_public_contract_by_token(p_token UUID)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'contract', jsonb_build_object(
      'id', c.id,
      'client_name', c.client_name,
      'cpf_cnpj', c.cpf_cnpj,
      'client_address', c.client_address,
      'client_phone', c.client_phone,
      'client_email', c.client_email,
      'total_value', c.total_value,
      'duration_label', c.duration_label,
      'included_structure', c.included_structure,
      'extra_hour_fee', c.extra_hour_fee,
      'contractor_city', c.contractor_city,
      'status', c.status,
      'signed_at', c.signed_at,
      'signer_name', c.signer_name,
      'has_electronic_signature', c.document_hash IS NOT NULL
    ),
    'installments', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'installment_number', i.installment_number,
            'amount', i.amount,
            'due_date', i.due_date,
            'status', i.status
          )
          ORDER BY i.installment_number
        )
        FROM public.installments i
        WHERE i.contract_id = c.id
      ),
      '[]'::jsonb
    ),
    'event', (
      SELECT jsonb_build_object(
        'title', e.title,
        'event_type', e.event_type,
        'event_date', e.event_date,
        'start_time', e.start_time,
        'venue_name', e.venue_name,
        'venue_address', e.venue_address,
        'lineup', COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object('role_needed', el.role_needed)
              ORDER BY el.role_needed
            )
            FROM public.event_lineup el
            WHERE el.event_id = e.id
          ),
          '[]'::jsonb
        )
      )
      FROM public.events e
      WHERE e.contract_id = c.id
      ORDER BY e.event_date
      LIMIT 1
    ),
    'signed_document', CASE
      WHEN c.document_hash IS NOT NULL THEN c.signed_snapshot->'document'
      ELSE NULL
    END
  )
  FROM public.contracts c
  WHERE c.sign_token = p_token
    AND c.status <> 'cancelado';
$$;

REVOKE ALL ON FUNCTION public.get_public_contract_by_token(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_contract_by_token(UUID) TO anon, authenticated, service_role;
