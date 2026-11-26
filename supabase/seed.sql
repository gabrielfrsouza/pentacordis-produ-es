truncate table
  event_setlist, song_assets, songs, event_expenses, event_equipment, equipment,
  event_lineup, events, installments, contracts, musician_roles, musicians, leads
restart identity cascade;

insert into leads (id, name, phone, email, event_type, event_date, status, estimated_value, notes) values
  ('10000000-0000-0000-0000-000000000001', 'Família Andrade', '+55 11 98888-1001', 'contato@andrade.com', 'Casamento', '2026-12-12', 'proposta', 18000, 'Cerimônia religiosa e recepção'),
  ('10000000-0000-0000-0000-000000000002', 'Instituto Aurora', '+55 11 97777-2002', 'eventos@institutoaurora.org', 'Corporativo', '2026-12-20', 'novo', 12000, 'Confraternização de fim de ano'),
  ('10000000-0000-0000-0000-000000000003', 'Paróquia São Gabriel', '+55 11 96666-3003', 'musica@sga.org', 'Missa', '2026-12-24', 'fechado', 7000, 'Missa de Natal');

insert into musicians (id, full_name, stage_name, phone, email, city, tier, sight_reading_score, base_fee, pix_key, has_own_transport, conduct_term_signed_at, tags) values
  ('20000000-0000-0000-0000-000000000001', 'Marina Alves', 'Marina A.', '+55 11 99111-0001', 'marina@pentacordis.com', 'São Paulo', 'nucleo_fixo', 5, 900, 'marina@pix.com', true, now(), array['líder','casamento']),
  ('20000000-0000-0000-0000-000000000002', 'Lucas Moreira', 'Lucas M.', '+55 11 99111-0002', 'lucas@pentacordis.com', 'São Paulo', 'nucleo_fixo', 5, 850, 'lucas@pix.com', true, now(), array['coral','gospel']),
  ('20000000-0000-0000-0000-000000000003', 'Beatriz Carvalho', 'Bea', '+55 11 99111-0003', 'bea@pentacordis.com', 'Campinas', 'nucleo_fixo', 4, 800, '41999990003', false, now(), array['soprano','maestro']),
  ('20000000-0000-0000-0000-000000000004', 'Felipe Santos', 'Felipe', '+55 11 99111-0004', 'felipe@pentacordis.com', 'São Paulo', 'nucleo_fixo', 4, 850, 'felipe.santos@pix.com', true, now(), array['baixo','jazz']),
  ('20000000-0000-0000-0000-000000000005', 'Camila Rocha', 'Cami', '+55 11 99111-0005', 'camila@pentacordis.com', 'Guarulhos', 'convidado_a', 5, 700, 'camila.rocha@pix.com', false, now(), array['violino','clássico']),
  ('20000000-0000-0000-0000-000000000006', 'Thiago Lima', 'Thiago', '+55 11 99111-0006', 'thiago@pentacordis.com', 'Osasco', 'convidado_a', 4, 750, '11911110006', true, null, array['piano','teclado']),
  ('20000000-0000-0000-0000-000000000007', 'Gabriel Nunes', 'G.Nunes', '+55 11 99111-0007', 'gabriel@pentacordis.com', 'São Paulo', 'convidado_b', 3, 650, 'gabriel.nunes@pix.com', true, now(), array['trompete']),
  ('20000000-0000-0000-0000-000000000008', 'Julia Prado', 'Julia P.', '+55 11 99111-0008', 'julia@pentacordis.com', 'Santo André', 'convidado_a', 4, 700, '11911110008', false, now(), array['técnica','som']);

insert into musician_roles (musician_id, role_name, is_primary) values
  ('20000000-0000-0000-0000-000000000001', 'soprano', true),
  ('20000000-0000-0000-0000-000000000002', 'tenor', true),
  ('20000000-0000-0000-0000-000000000003', 'contralto', true),
  ('20000000-0000-0000-0000-000000000004', 'baixo', true),
  ('20000000-0000-0000-0000-000000000005', 'violino', true),
  ('20000000-0000-0000-0000-000000000006', 'piano', true),
  ('20000000-0000-0000-0000-000000000007', 'trompete', true),
  ('20000000-0000-0000-0000-000000000008', 'tecnico_som', true);

insert into contracts (id, lead_id, client_name, cpf_cnpj, total_value, producer_margin_pct, tax_pct, status, signed_at) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Família Andrade', '12.345.678/0001-90', 18000, 30, 6, 'assinado', now()),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003', 'Paróquia São Gabriel', '12.345.678/0001-91', 7000, 30, 6, 'assinado', now());

insert into installments (contract_id, installment_number, amount, due_date, paid_at, payment_method, status) values
  ('30000000-0000-0000-0000-000000000001', 1, 9000, '2026-11-20', '2026-11-20', 'PIX', 'pago'),
  ('30000000-0000-0000-0000-000000000001', 2, 9000, '2026-12-05', null, null, 'pendente'),
  ('30000000-0000-0000-0000-000000000002', 1, 3500, '2026-12-10', null, null, 'pendente'),
  ('30000000-0000-0000-0000-000000000002', 2, 3500, '2026-12-24', null, null, 'pendente');

insert into events (id, contract_id, title, event_type, event_date, load_in_time, soundcheck_time, start_time, end_time, venue_name, venue_address, maps_url, dress_code, logistics_notes, public_token, status) values
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Casamento Andrade', 'Casamento', '2026-12-12', '15:00', '16:30', '18:00', '21:00', 'Igreja Nossa Senhora', 'Av. Paulista, 1000 - São Paulo/SP', 'https://maps.google.com/?q=Av.Paulista.1000', 'Preto longo; gravata verde musgo', 'Entrada pelo lateral da igreja.', '50000000-0000-0000-0000-000000000001', 'escalado'),
  ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', 'Missa de Natal São Gabriel', 'Missa', '2026-12-24', '18:30', '19:30', '21:00', '22:30', 'Paróquia São Gabriel', 'Rua das Palmeiras, 45 - São Paulo/SP', 'https://maps.google.com/?q=Rua.das.Palmeiras.45', 'Roupa preta e pasta vermelha', 'Chegar pela sacristia.', '50000000-0000-0000-0000-000000000002', 'planejamento'),
  ('40000000-0000-0000-0000-000000000003', null, 'Concerto Sentimental', 'Concerto', '2026-11-15', '13:00', '14:30', '17:00', '19:30', 'Teatro Luminis', 'Rua Augusta, 300 - São Paulo/SP', 'https://maps.google.com/?q=Rua.Augusta.300', 'Traje social total preto', 'Ponto de carga nos fundos.', '50000000-0000-0000-0000-000000000003', 'concluido');

insert into event_lineup (event_id, role_needed, musician_id, backup_musician_id, invite_status, negotiated_fee, payment_status) values
  ('40000000-0000-0000-0000-000000000001', 'soprano', '20000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', 'confirmado', 900, 'pendente'),
  ('40000000-0000-0000-0000-000000000001', 'tenor', '20000000-0000-0000-0000-000000000002', null, 'confirmado', 850, 'pendente'),
  ('40000000-0000-0000-0000-000000000001', 'contralto', '20000000-0000-0000-0000-000000000003', null, 'convidado', 800, 'pendente'),
  ('40000000-0000-0000-0000-000000000001', 'piano', '20000000-0000-0000-0000-000000000006', null, 'pendente', 750, 'pendente'),
  ('40000000-0000-0000-0000-000000000002', 'soprano', '20000000-0000-0000-0000-000000000001', null, 'confirmado', 900, 'pendente'),
  ('40000000-0000-0000-0000-000000000003', 'violino', '20000000-0000-0000-0000-000000000005', null, 'confirmado', 700, 'pago');

insert into equipment (id, name, category, quantity_total, serial_or_notes, status) values
  ('60000000-0000-0000-0000-000000000001', 'Caixa ativa 12"', 'som', 4, 'Modelo P12 - série 101', 'disponivel'),
  ('60000000-0000-0000-0000-000000000002', 'Mesa digital 16 canais', 'som', 2, 'Mesa XR16', 'disponivel'),
  ('60000000-0000-0000-0000-000000000003', 'Teclado 88 teclas', 'instrumento', 2, 'Inclui pedal sustain', 'disponivel'),
  ('60000000-0000-0000-0000-000000000004', 'Microfone vocal', 'som', 8, 'Dinâmico cardioide', 'disponivel'),
  ('60000000-0000-0000-0000-000000000005', 'Cabo XLR 10m', 'cabos', 20, 'Verificar plugs', 'manutencao');

insert into event_equipment (event_id, equipment_id, quantity_allocated, checked_out, checked_in) values
  ('40000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 2, true, false),
  ('40000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000004', 6, true, false),
  ('40000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-000000000003', 1, true, true);

insert into event_expenses (event_id, category, description, amount, paid_at) values
  ('40000000-0000-0000-0000-000000000001', 'frete', 'Transporte para Campinas', 800, null),
  ('40000000-0000-0000-0000-000000000001', 'alimentacao', 'Café e jantar da equipe', 650, null),
  ('40000000-0000-0000-0000-000000000003', 'aluguel_som', 'Locação complementar', 2200, now());

insert into songs (id, title, composer, category, default_key, duration_seconds, is_pentacordis_arrangement) values
  ('70000000-0000-0000-0000-000000000001', 'Ave Maria', 'Franz Schubert', 'Litúrgica', 'F', 240, true),
  ('70000000-0000-0000-0000-000000000002', 'Panis Angelicus', 'Franck', 'Litúrgica', 'G', 210, true),
  ('70000000-0000-0000-0000-000000000003', 'Cântico de Simeão', 'Taizé', 'Meditação', 'D', 180, true),
  ('70000000-0000-0000-0000-000000000004', 'Oceans', 'Hillsong', 'Louvor', 'C', 360, true),
  ('70000000-0000-0000-0000-000000000005', 'At Last', 'H. Warren / M. Gordon', 'Casamento', 'F', 180, true),
  ('70000000-0000-0000-0000-000000000006', 'Time to Say Goodbye', 'F. Sartori', 'Clássico', 'Bm', 250, true);

insert into song_assets (song_id, asset_type, target_role, file_url, key_signature) values
  ('70000000-0000-0000-0000-000000000001', 'partitura_geral', 'todos', 'https://example.com/assets/ave-maria-geral.pdf', 'F'),
  ('70000000-0000-0000-0000-000000000001', 'audio_guia', 'todos', 'https://example.com/assets/ave-maria-guia.mp3', 'F'),
  ('70000000-0000-0000-0000-000000000002', 'partitura_naipe', 'soprano', 'https://example.com/assets/panis-soprano.pdf', 'G'),
  ('70000000-0000-0000-0000-000000000005', 'partitura_geral', 'todos', 'https://example.com/assets/at-last.pdf', 'F'),
  ('70000000-0000-0000-0000-000000000006', 'letra', 'todos', 'https://example.com/assets/time-to-say-goodbye.txt', 'Bm');

insert into event_setlist (event_id, song_id, order_index, moment_label, event_key, performance_notes) values
  ('40000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 1, 'Entrada', 'F', 'Entrada da noiva, 20 compasses'),
  ('40000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000005', 2, 'Comunhão', 'F', 'Versão instrumental'),
  ('40000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000002', 1, 'Entrada', 'G', 'Soprano a cappella'),
  ('40000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000003', 2, 'Oração', 'D', 'Repetir 4 vezes');
