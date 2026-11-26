ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS client_address TEXT,
  ADD COLUMN IF NOT EXISTS client_phone TEXT,
  ADD COLUMN IF NOT EXISTS client_email TEXT,
  ADD COLUMN IF NOT EXISTS duration_label TEXT DEFAULT 'Até 1h30 de apresentação',
  ADD COLUMN IF NOT EXISTS included_structure TEXT DEFAULT 'Sonorização compatível com o ambiente, microfonação da equipe e direção musical em cena',
  ADD COLUMN IF NOT EXISTS extra_hour_fee NUMERIC(10, 2) DEFAULT 450.00,
  ADD COLUMN IF NOT EXISTS contractor_city TEXT DEFAULT 'Recife / PE';
