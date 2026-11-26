export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type LeadStatus = "novo" | "proposta" | "fechado" | "perdido";
export type ContractStatus = "rascunho" | "assinado" | "cancelado";
export type PaymentStatus = "pendente" | "pago" | "atrasado";
export type MusicianTier = "nucleo_fixo" | "convidado_a" | "convidado_b";
export type InviteStatus = "pendente" | "convidado" | "confirmado" | "recusado";
export type EventStatus = "planejamento" | "escalado" | "concluido" | "cancelado";

type PublicContractDocument = {
  contract: Pick<
    Contract,
    | "id"
    | "client_name"
    | "client_address"
    | "client_phone"
    | "client_email"
    | "total_value"
    | "duration_label"
    | "included_structure"
    | "extra_hour_fee"
    | "contractor_city"
    | "status"
    | "signed_at"
  > & {
    cpf_cnpj?: string | null;
    signer_name?: string | null;
    signer_document?: string | null;
    signature_image?: string | null;
    has_electronic_signature?: boolean;
  };
  installments: Pick<Installment, "installment_number" | "amount" | "due_date" | "status">[];
  event: (Pick<EventRow, "title" | "event_type" | "event_date" | "start_time" | "venue_name" | "venue_address"> & {
    lineup: { role_needed: string }[];
  }) | null;
};

export type PublicContractPayload = {
  contract: PublicContractDocument["contract"];
  installments: PublicContractDocument["installments"];
  event: PublicContractDocument["event"];
  signed_document?: PublicContractDocument | null;
};

export type Database = {
  public: {
    Tables: {
      leads: { Row: Lead; Insert: LeadInsert; Update: LeadUpdate; Relationships: [] };
      contracts: { Row: Contract; Insert: ContractInsert; Update: ContractUpdate; Relationships: [] };
      installments: { Row: Installment; Insert: InstallmentInsert; Update: InstallmentUpdate; Relationships: [] };
      musicians: { Row: Musician; Insert: MusicianInsert; Update: MusicianUpdate; Relationships: [] };
      musician_roles: { Row: MusicianRole; Insert: MusicianRoleInsert; Update: MusicianRoleUpdate; Relationships: [] };
      events: { Row: EventRow; Insert: EventInsert; Update: EventUpdate; Relationships: [] };
      event_lineup: { Row: EventLineup; Insert: EventLineupInsert; Update: EventLineupUpdate; Relationships: [] };
      equipment: { Row: Equipment; Insert: EquipmentInsert; Update: EquipmentUpdate; Relationships: [] };
      event_equipment: { Row: EventEquipment; Insert: EventEquipmentInsert; Update: EventEquipmentUpdate; Relationships: [] };
      event_expenses: { Row: EventExpense; Insert: EventExpenseInsert; Update: EventExpenseUpdate; Relationships: [] };
      songs: { Row: Song; Insert: SongInsert; Update: SongUpdate; Relationships: [] };
      song_assets: { Row: SongAsset; Insert: SongAssetInsert; Update: SongAssetUpdate; Relationships: [] };
      event_setlist: { Row: EventSetlist; Insert: EventSetlistInsert; Update: EventSetlistUpdate; Relationships: [] };
      proposals: { Row: Proposal; Insert: ProposalInsert; Update: ProposalUpdate; Relationships: [] };
      proposal_items: { Row: ProposalItem; Insert: ProposalItemInsert; Update: ProposalItemUpdate; Relationships: [] };
      financial_transactions: { Row: FinancialTransaction; Insert: FinancialTransactionInsert; Update: FinancialTransactionUpdate; Relationships: [] };
      financial_transaction_audit: { Row: FinancialTransactionAudit; Insert: FinancialTransactionAuditInsert; Update: never; Relationships: [] };
      equipment_assets: { Row: EquipmentAsset; Insert: EquipmentAssetInsert; Update: EquipmentAssetUpdate; Relationships: [] };
      equipment_maintenance: { Row: EquipmentMaintenance; Insert: EquipmentMaintenanceInsert; Update: never; Relationships: [] };
      musician_availability: { Row: MusicianAvailability; Insert: MusicianAvailabilityInsert; Update: MusicianAvailabilityUpdate; Relationships: [] };
      maestro_rule_sets: { Row: MaestroRuleSet; Insert: MaestroRuleSetInsert; Update: MaestroRuleSetUpdate; Relationships: [] };
      maestro_rules: { Row: MaestroRule; Insert: MaestroRuleInsert; Update: MaestroRuleUpdate; Relationships: [] };
      maestro_recommendations: { Row: MaestroRecommendation; Insert: MaestroRecommendationInsert; Update: MaestroRecommendationUpdate; Relationships: [] };
      maestro_feedback: { Row: MaestroFeedback; Insert: MaestroFeedbackInsert; Update: never; Relationships: [] };
      tasks: { Row: Task; Insert: TaskInsert; Update: TaskUpdate; Relationships: [] };
      notifications: { Row: Notification; Insert: NotificationInsert; Update: NotificationUpdate; Relationships: [] };
      activity_log: { Row: ActivityLog; Insert: ActivityLogInsert; Update: never; Relationships: [] };
    };
    Views: {
      event_financial_summary: {
        Row: EventFinancialSummary;
        Relationships: [];
      };
      pentacordis_cashflow_monthly: {
        Row: CashflowMonthly;
        Relationships: [];
      };
      pentacordis_event_readiness: {
        Row: EventReadiness;
        Relationships: [];
      };
    };
    Functions: {
      get_public_contract_by_token: {
        Args: { p_token: string };
        Returns: PublicContractPayload | null;
      };
      sign_public_contract: {
        Args: {
          p_token: string;
          p_signer_name: string;
          p_signer_document: string;
          p_signer_email: string | null;
          p_signer_ip: string | null;
          p_signer_user_agent: string;
          p_document_hash: string;
          p_signature_image: string | null;
          p_signed_snapshot: Json;
        };
        Returns: { signed_at: string; document_hash: string; signer_ip: string | null } | null;
      };
      get_public_event_by_token: {
        Args: { p_token: string };
        Returns: Json;
      };
      approve_budget_and_create_event: {
        Args: {
          p_lead_id: string | null;
          p_client_name: string;
          p_cpf_cnpj: string | null;
          p_total_value: number;
          p_margin_pct: number;
          p_tax_pct: number;
          p_event_title: string;
          p_event_type: string;
          p_event_date: string;
          p_venue_name: string | null;
          p_roles: Json;
        };
        Returns: string;
      };
      convert_lead_to_contract_and_event: {
        Args: { p_lead_id: string };
        Returns: { contract: Contract; event: EventRow };
      };
      reorder_event_setlist: {
        Args: { p_event_id: string; p_ordered_ids: string[] };
        Returns: undefined;
      };
      save_proposal: {
        Args: { p_proposal_id: string | null; p_proposal: Json; p_items: Json };
        Returns: string;
      };
      record_equipment_maintenance: {
        Args: { p_asset_id: string; p_maintenance: Json };
        Returns: string;
      };
      reverse_financial_transaction: {
        Args: { p_transaction_id: string; p_reason: string };
        Returns: string;
      };
    };
    Enums: {
      lead_status: LeadStatus;
      contract_status: ContractStatus;
      payment_status: PaymentStatus;
      musician_tier: MusicianTier;
      invite_status: InviteStatus;
      event_status: EventStatus;
    };
  };
};

type Timestamps = {
  created_at: string;
  updated_at: string;
};

export type Lead = Timestamps & { id: string; name: string; phone: string | null; email: string | null; event_type: string | null; event_date: string | null; status: LeadStatus; estimated_value: number | null; notes: string | null };
export type LeadInsert = Partial<Timestamps> & Omit<Lead, "id" | "created_at" | "updated_at"> & { id?: string };
export type LeadUpdate = Partial<Lead>;
export type Contract = Timestamps & { id: string; lead_id: string | null; client_name: string; cpf_cnpj: string | null; total_value: number; producer_margin_pct: number; tax_pct: number; contract_pdf_url: string | null; status: ContractStatus; signed_at: string | null; client_address: string | null; client_phone: string | null; client_email: string | null; duration_label: string | null; included_structure: string | null; extra_hour_fee: number | null; contractor_city: string | null; sign_token: string | null; signer_name: string | null; signer_document: string | null; signer_email: string | null; signer_ip: string | null; signer_user_agent: string | null; document_hash: string | null; signature_image: string | null; signed_snapshot: Json | null };
export type ContractInsert = Partial<Omit<Contract, "id" | "created_at" | "updated_at">> & { id?: string };
export type ContractUpdate = Partial<Contract>;
export type ProposalStatus = "rascunho" | "enviada" | "visualizada" | "aprovada" | "recusada" | "expirada" | "cancelada";
export type Proposal = Timestamps & { id: string; proposal_number: number; lead_id: string | null; contract_id: string | null; client_name: string; client_email: string | null; client_phone: string | null; client_document: string | null; event_type: string | null; event_date: string | null; venue_name: string | null; venue_address: string | null; subtotal: number; discount_amount: number; tax_pct: number; producer_margin_pct: number; total_value: number; status: ProposalStatus; valid_until: string | null; version: number; public_token: string; notes: string | null; terms: string | null; sent_at: string | null; viewed_at: string | null; approved_at: string | null; created_by: string | null };
export type ProposalInsert = Partial<Omit<Proposal, "id" | "created_at" | "updated_at">> & { id?: string };
export type ProposalUpdate = Partial<Proposal>;
export type ProposalItem = { id: string; proposal_id: string; item_type: string; description: string; quantity: number; unit_price: number; total_price: number; sort_order: number; metadata: Json; created_at: string };
export type ProposalItemInsert = Partial<Omit<ProposalItem, "id" | "total_price" | "created_at">> & { id?: string };
export type ProposalItemUpdate = Partial<ProposalItem>;
export type FinancialTransactionStatus = "previsto" | "pendente" | "pago" | "atrasado" | "cancelado" | "estornado";
export type FinancialTransaction = {
  id: string;
  event_id: string | null;
  contract_id: string | null;
  installment_id: string | null;
  direction: "entrada" | "saida";
  category: string;
  description: string;
  amount: number;
  competence_date: string;
  due_date: string | null;
  paid_at: string | null;
  status: FinancialTransactionStatus;
  payment_method: string | null;
  external_reference: string | null;
  receipt_path: string | null;
  notes: string | null;
  reversed_transaction_id: string | null;
  source_type: "installment" | "event_expense" | "manual" | null;
  source_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};
export type FinancialTransactionInsert = Partial<Omit<FinancialTransaction, "id" | "created_at" | "updated_at">> & { id?: string };
export type FinancialTransactionUpdate = Partial<FinancialTransaction>;
export type FinancialTransactionAudit = { id: number; transaction_id: string; action: string; old_data: Json | null; new_data: Json | null; changed_by: string | null; changed_at: string };
export type FinancialTransactionAuditInsert = Partial<Omit<FinancialTransactionAudit, "id" | "changed_at">> & { id?: number };
export type EquipmentAssetCondition = "novo" | "bom" | "regular" | "danificado" | "baixado";
export type EquipmentAsset = Timestamps & { id: string; equipment_id: string; asset_code: string; serial_number: string | null; brand: string | null; model: string | null; condition: EquipmentAssetCondition; current_location: string | null; acquired_at: string | null; purchase_value: number | null; last_maintenance_at: string | null; next_maintenance_at: string | null; notes: string | null; is_active: boolean };
export type EquipmentAssetInsert = Partial<Timestamps> & Omit<EquipmentAsset, "id" | "created_at" | "updated_at"> & { id?: string };
export type EquipmentAssetUpdate = Partial<EquipmentAsset>;
export type EquipmentMaintenance = { id: string; asset_id: string; maintenance_type: string; description: string | null; cost: number; performed_at: string; next_due_at: string | null; performed_by: string | null; created_at: string };
export type EquipmentMaintenanceInsert = Partial<Omit<EquipmentMaintenance, "id" | "created_at">> & { id?: string };
export type MusicianAvailability = Timestamps & { id: string; musician_id: string; availability_date: string; start_time: string | null; end_time: string | null; status: "disponivel" | "indisponivel" | "preferencial" | "consulta"; notes: string | null };
export type MusicianAvailabilityInsert = Partial<Timestamps> & Omit<MusicianAvailability, "id" | "created_at" | "updated_at"> & { id?: string };
export type MusicianAvailabilityUpdate = Partial<MusicianAvailability>;
export type Task = { id: string; title: string; description: string | null; status: "aberta" | "em_andamento" | "concluida" | "cancelada"; priority: "baixa" | "normal" | "alta" | "urgente"; due_at: string | null; assigned_to: string | null; created_by: string | null; lead_id: string | null; contract_id: string | null; event_id: string | null; completed_at: string | null; created_at: string; updated_at: string };
export type TaskInsert = Partial<Omit<Task, "id" | "created_at" | "updated_at">> & { id?: string };
export type TaskUpdate = Partial<Task>;
export type Notification = { id: string; user_id: string | null; title: string; message: string | null; category: string; severity: "info" | "success" | "warning" | "critical"; target_url: string | null; related_table: string | null; related_id: string | null; read_at: string | null; created_at: string };
export type NotificationInsert = Partial<Omit<Notification, "id" | "created_at">> & { id?: string };
export type NotificationUpdate = Partial<Notification>;
export type ActivityLog = { id: number; actor_user_id: string | null; action: string; resource: string; resource_id: string | null; description: string | null; old_data: Json | null; new_data: Json | null; ip_address: string | null; user_agent: string | null; created_at: string };
export type ActivityLogInsert = Partial<Omit<ActivityLog, "id" | "created_at">> & { id?: number };
export type CashflowMonthly = { month: string; inflows: number; outflows: number; net: number };
export type EventReadiness = { event_id: string; title: string; event_date: string; status: EventStatus; confirmed_musicians: number; required_roles: number; songs_selected: number; equipment_items: number; required_tasks_open: number };
export type Installment = Timestamps & { id: string; contract_id: string; installment_number: number; amount: number; due_date: string; paid_at: string | null; payment_method: string | null; status: PaymentStatus };
export type InstallmentInsert = Partial<Timestamps> & Omit<Installment, "id" | "created_at" | "updated_at"> & { id?: string };
export type InstallmentUpdate = Partial<Installment>;
export type Musician = Timestamps & { id: string; full_name: string; stage_name: string | null; phone: string | null; email: string | null; city: string | null; tier: MusicianTier; sight_reading_score: number | null; base_fee: number | null; pix_key: string | null; has_own_transport: boolean; conduct_term_signed_at: string | null; tags: string[]; is_active: boolean; notes: string | null };
export type MusicianInsert = Partial<Timestamps> & Omit<Musician, "id" | "created_at" | "updated_at"> & { id?: string };
export type MusicianUpdate = Partial<Musician>;
export type MusicianRole = Timestamps & { id: string; musician_id: string; role_name: string; is_primary: boolean };
export type MusicianRoleInsert = Partial<Timestamps> & Omit<MusicianRole, "id" | "created_at" | "updated_at"> & { id?: string };
export type MusicianRoleUpdate = Partial<MusicianRole>;
export type EventRow = Timestamps & { id: string; contract_id: string | null; title: string; event_type: string | null; event_date: string; load_in_time: string | null; soundcheck_time: string | null; start_time: string | null; end_time: string | null; venue_name: string | null; venue_address: string | null; maps_url: string | null; dress_code: string | null; logistics_notes: string | null; public_token: string; status: EventStatus };
export type EventInsert = Partial<Omit<EventRow, "id" | "created_at" | "updated_at" | "public_token">> & { id?: string; public_token?: string };
export type EventUpdate = Partial<EventRow>;
export type EventLineup = Timestamps & { id: string; event_id: string; role_needed: string; musician_id: string | null; backup_musician_id: string | null; invite_status: InviteStatus; negotiated_fee: number | null; payment_status: PaymentStatus; paid_at: string | null; notes: string | null };
export type EventLineupInsert = Partial<Omit<EventLineup, "id" | "created_at" | "updated_at">> & { id?: string };
export type EventLineupUpdate = Partial<EventLineup>;
export type Equipment = Timestamps & { id: string; name: string; category: "som" | "instrumento" | "uniforme_acessorio" | "cabos"; quantity_total: number; serial_or_notes: string | null; status: "disponivel" | "manutencao" };
export type EquipmentInsert = Partial<Timestamps> & Omit<Equipment, "id" | "created_at" | "updated_at"> & { id?: string };
export type EquipmentUpdate = Partial<Equipment>;
export type EventEquipment = Timestamps & { id: string; event_id: string; equipment_id: string; quantity_allocated: number; checked_out: boolean; checked_in: boolean; responsible_musician_id: string | null };
export type EventEquipmentInsert = Partial<Omit<EventEquipment, "id" | "created_at" | "updated_at">> & { id?: string };
export type EventEquipmentUpdate = Partial<EventEquipment>;
export type EventExpense = Timestamps & { id: string; event_id: string; category: "frete" | "alimentacao" | "imposto" | "aluguel_som" | "outros"; description: string; amount: number; paid_at: string | null };
export type EventExpenseInsert = Partial<Omit<EventExpense, "id" | "created_at" | "updated_at">> & { id?: string };
export type EventExpenseUpdate = Partial<EventExpense>;
export type Song = Timestamps & { id: string; title: string; composer: string | null; category: string | null; default_key: string | null; duration_seconds: number | null; is_pentacordis_arrangement: boolean; liturgical_moments: string[]; instrumentation: string[]; mood_tags: string[]; difficulty: number | null; liturgical_approval_status: string; maestro_metadata: Json };
export type SongInsert = Partial<Timestamps> & Omit<Song, "id" | "created_at" | "updated_at" | "liturgical_moments" | "instrumentation" | "mood_tags" | "difficulty" | "liturgical_approval_status" | "maestro_metadata"> & Partial<Pick<Song, "liturgical_moments" | "instrumentation" | "mood_tags" | "difficulty" | "liturgical_approval_status" | "maestro_metadata">> & { id?: string };
export type SongUpdate = Partial<Song>;
export type MaestroRuleSet = Timestamps & { id: string; name: string; description: string | null; version: number; is_active: boolean; created_by: string | null };
export type MaestroRuleSetInsert = Partial<Timestamps> & Omit<MaestroRuleSet, "id" | "created_at" | "updated_at"> & { id?: string };
export type MaestroRuleSetUpdate = Partial<MaestroRuleSet>;
export type MaestroRule = Timestamps & { id: string; rule_set_id: string; rule_key: string; name: string; description: string | null; category: string; conditions: Json; effect: Json; weight: number; priority: number; is_active: boolean };
export type MaestroRuleInsert = Partial<Timestamps> & Omit<MaestroRule, "id" | "created_at" | "updated_at"> & { id?: string };
export type MaestroRuleUpdate = Partial<MaestroRule>;
export type MaestroRecommendationStatus = "suggested" | "accepted" | "rejected" | "played" | "skipped";
export type MaestroRecommendation = Timestamps & { id: string; event_id: string | null; song_id: string; rule_set_id: string | null; liturgical_moment: string | null; score: number; explanation: Json; context_snapshot: Json; status: MaestroRecommendationStatus; generated_by: string | null };
export type MaestroRecommendationInsert = Partial<Timestamps> & Omit<MaestroRecommendation, "id" | "created_at" | "updated_at"> & { id?: string };
export type MaestroRecommendationUpdate = Partial<MaestroRecommendation>;
export type MaestroFeedbackType = "accepted" | "rejected" | "edited" | "played" | "not_played";
export type MaestroFeedback = { id: string; recommendation_id: string | null; event_id: string | null; song_id: string | null; feedback_type: MaestroFeedbackType; rating: number | null; reason: string | null; feedback_by: string | null; created_at: string };
export type MaestroFeedbackInsert = Partial<Omit<MaestroFeedback, "id" | "created_at">> & { id?: string };
export type SongAsset = Timestamps & { id: string; song_id: string; asset_type: "partitura_geral" | "partitura_naipe" | "audio_guia" | "letra"; target_role: string; file_url: string; key_signature: string | null };
export type SongAssetInsert = Partial<Timestamps> & Omit<SongAsset, "id" | "created_at" | "updated_at"> & { id?: string };
export type SongAssetUpdate = Partial<SongAsset>;
export type EventSetlist = Timestamps & { id: string; event_id: string; song_id: string; order_index: number; moment_label: string | null; event_key: string | null; performance_notes: string | null };
export type EventSetlistInsert = Partial<Timestamps> & Omit<EventSetlist, "id" | "created_at" | "updated_at"> & { id?: string };
export type EventSetlistUpdate = Partial<EventSetlist>;
export type EventFinancialSummary = { event_id: string; contract_total_value: number; total_musician_fees: number; total_expenses: number; net_profit: number; net_margin_pct: number };
