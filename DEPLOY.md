# Pentacordis OS — Checklist de deploy

## Supabase

1. Crie um projeto Supabase e configure o banco PostgreSQL.
2. Em um projeto novo, execute `001_initial_schema.sql` até `007_allow_unverified_signature_ip.sql`, em ordem. Em um banco que já aplicou `001`–`003`, aplique somente `004`–`007`.
   `Pentacordis_Database_Master.sql` é uma alternativa de esquema completo; use o Master ou a sequência de migrations, nunca os dois sobre o mesmo banco.
3. Execute `supabase/seed.sql` somente em ambiente descartável de desenvolvimento; ele apaga os dados existentes.
4. Confirme que `pentacordis-assets` está privado e que as policies de `storage.objects` permitem acesso apenas a usuários autenticados.
5. Execute as migrations em um ambiente onde a extensão `pgcrypto` esteja disponível.
6. Crie pelo menos um usuário em Authentication → Users.
7. Nesta versão, todos os usuários autenticados são considerados equipe confiável e recebem as mesmas permissões administrativas. Não crie contas de clientes ou músicos até implementar papéis separados.
8. Teste no SQL Editor:
   - `select * from get_public_event_by_token('50000000-0000-0000-0000-000000000001');`
   - Confirme que o resultado não contém cachês, Pix, contratos ou dados financeiros.

### Módulos da Fase 3

Se o banco já recebeu `Pentacordis_Database_Master.sql`, aplique uma única vez o arquivo `supabase/migrations/008_phase_three_business_modules.sql` no SQL Editor do Supabase. Ele adiciona as gravações transacionais de propostas e manutenção, estorno financeiro, notificações de tarefas e registros de atividade. Não reexecute o SQL Master nem as migrations anteriores para habilitar estes módulos.

### Correção da RPC de aprovação

Se a aprovação do orçamento apresentar `Could not choose the best candidate function`, aplique uma única vez `supabase/migrations/009_remove_approve_budget_rpc_overload.sql` no SQL Editor do Supabase. A migration remove somente a assinatura antiga e ambígua; mantém a assinatura atual usada pelo app. Não reexecute o SQL Master para corrigir esse erro.

A conta que aprova precisa ter um papel ativo com `insert` em `contracts` e `events`. O SQL Master prevê isso para `commercial` e concede tudo a `owner`/`admin`; o perfil `production`, sozinho, não pode criar contratos. Atribua somente o perfil compatível com a função real da pessoa.

Como a conta `pentacordis@gmail.com` foi designada administradora, aplique uma única vez `supabase/migrations/010_assign_admin_to_pentacordis_account.sql` no SQL Editor. A conta já deve existir em Supabase Auth; a migration falha explicitamente se não a encontrar. Ela ativa somente o papel `admin` dessa conta.

### Inteligência Maestro — Fase 4

Não há migration adicional para a Fase 4: a página `/maestro` usa as tabelas e colunas já criadas pelo `Pentacordis_Database_Master.sql`. As permissões de leitura/gravação do perfil de produção para `maestro_rule_sets`, `maestro_rules`, `maestro_recommendations`, `maestro_feedback`, disponibilidade, acervo e eventos precisam estar ativas.

As regras configuráveis usam `conditions` com as chaves `match_context_moment`, `match_mood_tags`, `match_instrumentation`, `liturgical_moments`, `mood_tags`, `instrumentation`, `event_types`, `difficulty_min`, `difficulty_max`, `liturgical_approval_status` e `is_pentacordis_arrangement`. O `effect` aceita `score` ou `points` numérico e `reason` textual; `weight` multiplica a pontuação e `priority` ordena a avaliação. Regras com chaves não reconhecidas aparecem como não aplicadas na tela. Sem conjunto ativo, o Maestro usa regras padrão determinísticas.

O retorno de recomendações é registrado em `maestro_feedback` e passa a afetar a pontuação depois de pelo menos três respostas por música. Os indicadores comerciais e de prontidão são heurísticos e exibem a amostra usada; não são garantias de resultado.

## Vercel

1. Importe o repositório do projeto.
2. Configure `NEXT_PUBLIC_SUPABASE_URL`.
3. Configure `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Configure `SUPABASE_SERVICE_ROLE_KEY` somente como variável de servidor; ela é usada na assinatura e para gerar links temporários dos arquivos públicos de eventos.
5. Não exponha a chave de serviço em variáveis `NEXT_PUBLIC_*` ou código cliente.
6. Deixe `TRUSTED_CLIENT_IP_HEADER` vazio até confirmar que o proxy sobrescreve um cabeçalho com um único IP. Sem essa configuração, o IP da assinatura não é coletado.
7. Execute o deploy.
8. Teste `/login` com o usuário criado no Supabase.
9. Teste uma rota pública como `/evento/50000000-0000-0000-0000-000000000001`.

## Validação pós-deploy

- `/login` aceita somente usuários autenticados.
- Rotas administrativas redirecionam usuários não autenticados.
- O portal público não solicita login.
- O RPC público de contrato não retorna IP, navegador, hash, imagem de assinatura ou snapshot privado.
- O portal de evento exibe somente arquivos marcados como `todos`; os links de arquivos têm validade limitada.
- PDFs e áudio administrativos são abertos por links temporários do bucket privado.
- Criar, editar e excluir registros funciona com RLS autenticada.
