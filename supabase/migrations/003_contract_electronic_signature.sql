ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS sign_token UUID UNIQUE DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS signer_name TEXT,
  ADD COLUMN IF NOT EXISTS signer_document TEXT,
  ADD COLUMN IF NOT EXISTS signer_email TEXT,
  ADD COLUMN IF NOT EXISTS signer_ip TEXT,
  ADD COLUMN IF NOT EXISTS signer_user_agent TEXT,
  ADD COLUMN IF NOT EXISTS document_hash TEXT,
  ADD COLUMN IF NOT EXISTS signature_image TEXT,
  ADD COLUMN IF NOT EXISTS signed_snapshot JSONB;

UPDATE public.contracts
SET sign_token = gen_random_uuid()
WHERE sign_token IS NULL;

ALTER TABLE public.contracts
  ALTER COLUMN sign_token SET NOT NULL;

CREATE OR REPLACE FUNCTION public.get_public_contract_by_token(p_token UUID)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
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
      'signer_document', c.signer_document,
      'signer_ip', c.signer_ip,
      'document_hash', c.document_hash,
      'signature_image', c.signature_image,
      'signed_snapshot', c.signed_snapshot
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
    )
  )
  FROM public.contracts c
  WHERE c.sign_token = p_token
    AND c.status <> 'cancelado';
$$;

CREATE OR REPLACE FUNCTION public.sign_public_contract(
  p_token UUID,
  p_signer_name TEXT,
  p_signer_document TEXT,
  p_signer_email TEXT,
  p_signer_ip TEXT,
  p_signer_user_agent TEXT,
  p_document_hash TEXT,
  p_signature_image TEXT,
  p_signed_snapshot JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_contract public.contracts%ROWTYPE;
BEGIN
  SELECT *
  INTO target_contract
  FROM public.contracts
  WHERE sign_token = p_token
  FOR UPDATE;

  IF NOT FOUND OR target_contract.status = 'cancelado' THEN
    RAISE EXCEPTION 'Contrato inexistente ou cancelado';
  END IF;

  IF target_contract.status = 'assinado' OR target_contract.document_hash IS NOT NULL THEN
    RAISE EXCEPTION 'Contrato já foi assinado anteriormente';
  END IF;

  IF p_signed_snapshot->'document' IS DISTINCT FROM public.get_public_contract_by_token(p_token) THEN
    RAISE EXCEPTION 'Contrato atualizado durante assinatura; recarregue e revise o documento';
  END IF;

  IF length(trim(COALESCE(p_signer_name, ''))) < 3
    OR p_signer_document IS NULL
    OR p_signer_document !~ '^[0-9]{11}$|^[A-Z0-9]{12}[0-9]{2}$'
    OR p_document_hash IS NULL
    OR p_document_hash !~ '^[a-f0-9]{64}$'
    OR p_signer_ip IS NULL
    OR p_signed_snapshot IS NULL THEN
    RAISE EXCEPTION 'Dados de assinatura inválidos';
  END IF;

  UPDATE public.contracts
  SET status = 'assinado',
      signed_at = NOW(),
      signer_name = trim(p_signer_name),
      signer_document = p_signer_document,
      signer_email = NULLIF(trim(COALESCE(p_signer_email, '')), ''),
      signer_ip = p_signer_ip,
      signer_user_agent = p_signer_user_agent,
      document_hash = p_document_hash,
      signature_image = p_signature_image,
      signed_snapshot = p_signed_snapshot
  WHERE id = target_contract.id
  RETURNING * INTO target_contract;

  RETURN jsonb_build_object(
    'signed_at', target_contract.signed_at,
    'document_hash', target_contract.document_hash,
    'signer_ip', target_contract.signer_ip
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_signed_contract_audit_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.document_hash IS NOT NULL AND (
    NEW.signer_name IS DISTINCT FROM OLD.signer_name
    OR NEW.signer_document IS DISTINCT FROM OLD.signer_document
    OR NEW.signer_email IS DISTINCT FROM OLD.signer_email
    OR NEW.signer_ip IS DISTINCT FROM OLD.signer_ip
    OR NEW.signer_user_agent IS DISTINCT FROM OLD.signer_user_agent
    OR NEW.document_hash IS DISTINCT FROM OLD.document_hash
    OR NEW.signature_image IS DISTINCT FROM OLD.signature_image
    OR NEW.signed_snapshot IS DISTINCT FROM OLD.signed_snapshot
    OR NEW.signed_at IS DISTINCT FROM OLD.signed_at
  ) THEN
    RAISE EXCEPTION 'A trilha de auditoria da assinatura eletrônica é imutável';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_signed_contract_audit_changes ON public.contracts;
CREATE TRIGGER prevent_signed_contract_audit_changes
BEFORE UPDATE ON public.contracts
FOR EACH ROW
EXECUTE FUNCTION public.prevent_signed_contract_audit_changes();

REVOKE ALL ON FUNCTION public.get_public_contract_by_token(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_contract_by_token(UUID) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.sign_public_contract(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sign_public_contract(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO service_role;
