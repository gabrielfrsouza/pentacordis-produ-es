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
SET search_path = public, pg_temp
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
