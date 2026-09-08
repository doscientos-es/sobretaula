-- Índice de cobertura para cada clave ajena. `tenant_id` entra en todas las
-- consultas por RLS, así que su índice no es opcional.

create index tenant_slug_history_tenant_idx on public.tenant_slug_history (tenant_id);
create index subscriptions_plan_idx on public.subscriptions (plan_id);
create index support_access_log_tenant_idx on public.support_access_log (tenant_id);
create index support_access_log_user_idx on public.support_access_log (platform_user_id);

create index areas_venue_idx on public.areas (venue_id);
create index floor_plan_versions_tenant_idx on public.floor_plan_versions (tenant_id);
create index floor_plan_versions_author_idx on public.floor_plan_versions (created_by);
create index plan_elements_tenant_idx on public.plan_elements (tenant_id);
create index tables_venue_idx on public.tables (venue_id);
create index tables_area_idx on public.tables (area_id);
create index table_placements_tenant_idx on public.table_placements (tenant_id);
create index table_placements_table_idx on public.table_placements (table_id);
create index table_group_presets_area_idx on public.table_group_presets (area_id);

create index services_venue_idx on public.services (venue_id);
create index availability_rules_tenant_idx on public.availability_rules (tenant_id);
create index closures_tenant_idx on public.closures (tenant_id);
create index closures_venue_idx on public.closures (venue_id);
create index closures_area_idx on public.closures (area_id);
create index reservations_venue_idx on public.reservations (venue_id);
create index reservations_area_idx on public.reservations (area_id);
create index reservations_guest_idx on public.reservations (guest_id);
create index reservations_author_idx on public.reservations (created_by);
create index reservation_tables_table_idx on public.reservation_tables (table_id);
create index holds_tenant_idx on public.holds (tenant_id);
create index holds_venue_idx on public.holds (venue_id);
create index holds_table_idx on public.holds (table_id);
create index waitlist_tenant_idx on public.waitlist (tenant_id);
create index waitlist_venue_idx on public.waitlist (venue_id);
create index waitlist_guest_idx on public.waitlist (guest_id);

create index table_sessions_venue_idx on public.table_sessions (venue_id);
create index table_sessions_reservation_idx on public.table_sessions (reservation_id);
create index table_sessions_author_idx on public.table_sessions (opened_by);
create index menu_categories_tenant_idx on public.menu_categories (tenant_id);
create index menu_items_category_idx on public.menu_items (category_id);
create index orders_tenant_idx on public.orders (tenant_id);
create index orders_session_idx on public.orders (session_id);
create index orders_author_idx on public.orders (created_by);
create index order_items_tenant_idx on public.order_items (tenant_id);
create index order_items_menu_item_idx on public.order_items (menu_item_id);
create index payments_tenant_idx on public.payments (tenant_id);
create index payments_author_idx on public.payments (created_by);

create index fiscal_settings_audit_tenant_idx on public.fiscal_settings_audit (tenant_id);
create index fiscal_settings_audit_actor_idx on public.fiscal_settings_audit (actor_id);
create index invoices_series_idx on public.invoices (series_id);
create index invoices_session_idx on public.invoices (session_id);
create index invoice_documents_tenant_idx on public.invoice_documents (tenant_id);
create index verifactu_ledger_tenant_idx on public.verifactu_ledger (tenant_id);
create index verifactu_outbox_tenant_idx on public.verifactu_outbox (tenant_id);
