-- Las funciones de premio solo se invocan desde triggers: no exponer como RPC.
revoke execute on function public.award_loyalty_for_online_order() from public, anon, authenticated;
revoke execute on function public.award_loyalty_for_payment() from public, anon, authenticated;
revoke execute on function public.send_guest_campaign(uuid) from public, anon;
grant execute on function public.send_guest_campaign(uuid) to authenticated;

-- Separar lectura y mutación evita políticas permisivas solapadas.
drop policy if exists timekeeping_employee_rates_read on public.timekeeping_employee_rates;
drop policy if exists timekeeping_employee_rates_write on public.timekeeping_employee_rates;
create policy timekeeping_employee_rates_read on public.timekeeping_employee_rates for select to authenticated using (public.has_operational_tenant_role(tenant_id, array['owner','manager']::public.tenant_role[]));
create policy timekeeping_employee_rates_insert on public.timekeeping_employee_rates for insert to authenticated with check (public.has_operational_tenant_role(tenant_id, array['owner','manager']::public.tenant_role[]));
create policy timekeeping_employee_rates_update on public.timekeeping_employee_rates for update to authenticated using (public.has_operational_tenant_role(tenant_id, array['owner','manager']::public.tenant_role[])) with check (public.has_operational_tenant_role(tenant_id, array['owner','manager']::public.tenant_role[]));
create policy timekeeping_employee_rates_delete on public.timekeeping_employee_rates for delete to authenticated using (public.has_operational_tenant_role(tenant_id, array['owner','manager']::public.tenant_role[]));

drop policy if exists workforce_shifts_read on public.workforce_shifts;
drop policy if exists workforce_shifts_write on public.workforce_shifts;
create policy workforce_shifts_read on public.workforce_shifts for select to authenticated using (public.is_tenant_member(tenant_id));
create policy workforce_shifts_insert on public.workforce_shifts for insert to authenticated with check (public.has_tenant_role(tenant_id, array['owner','manager']::public.tenant_role[]));
create policy workforce_shifts_update on public.workforce_shifts for update to authenticated using (public.has_tenant_role(tenant_id, array['owner','manager']::public.tenant_role[])) with check (public.has_tenant_role(tenant_id, array['owner','manager']::public.tenant_role[]));
create policy workforce_shifts_delete on public.workforce_shifts for delete to authenticated using (public.has_tenant_role(tenant_id, array['owner','manager']::public.tenant_role[]));

drop policy if exists workforce_availability_read on public.workforce_availability;
drop policy if exists workforce_availability_write on public.workforce_availability;
create policy workforce_availability_read on public.workforce_availability for select to authenticated using (public.is_tenant_member(tenant_id));
create policy workforce_availability_insert on public.workforce_availability for insert to authenticated with check (public.has_tenant_role(tenant_id, array['owner','manager']::public.tenant_role[]));
create policy workforce_availability_update on public.workforce_availability for update to authenticated using (public.has_tenant_role(tenant_id, array['owner','manager']::public.tenant_role[])) with check (public.has_tenant_role(tenant_id, array['owner','manager']::public.tenant_role[]));
create policy workforce_availability_delete on public.workforce_availability for delete to authenticated using (public.has_tenant_role(tenant_id, array['owner','manager']::public.tenant_role[]));

drop policy if exists workforce_absences_read on public.workforce_absences;
drop policy if exists workforce_absences_write on public.workforce_absences;
create policy workforce_absences_read on public.workforce_absences for select to authenticated using (public.is_tenant_member(tenant_id));
create policy workforce_absences_insert on public.workforce_absences for insert to authenticated with check (public.has_tenant_role(tenant_id, array['owner','manager']::public.tenant_role[]));
create policy workforce_absences_update on public.workforce_absences for update to authenticated using (public.has_tenant_role(tenant_id, array['owner','manager']::public.tenant_role[])) with check (public.has_tenant_role(tenant_id, array['owner','manager']::public.tenant_role[]));
create policy workforce_absences_delete on public.workforce_absences for delete to authenticated using (public.has_tenant_role(tenant_id, array['owner','manager']::public.tenant_role[]));

drop policy if exists guest_campaigns_read on public.guest_campaigns;
drop policy if exists guest_campaigns_write on public.guest_campaigns;
create policy guest_campaigns_read on public.guest_campaigns for select to authenticated using (public.is_tenant_member(tenant_id));
create policy guest_campaigns_insert on public.guest_campaigns for insert to authenticated with check (public.has_tenant_role(tenant_id, array['owner','manager']::public.tenant_role[]));
create policy guest_campaigns_update on public.guest_campaigns for update to authenticated using (public.has_tenant_role(tenant_id, array['owner','manager']::public.tenant_role[])) with check (public.has_tenant_role(tenant_id, array['owner','manager']::public.tenant_role[]));
create policy guest_campaigns_delete on public.guest_campaigns for delete to authenticated using (public.has_tenant_role(tenant_id, array['owner','manager']::public.tenant_role[]));

drop policy if exists guest_campaign_recipients_read on public.guest_campaign_recipients;
drop policy if exists guest_campaign_recipients_write on public.guest_campaign_recipients;
create policy guest_campaign_recipients_read on public.guest_campaign_recipients for select to authenticated using (public.is_tenant_member(tenant_id));
create policy guest_campaign_recipients_insert on public.guest_campaign_recipients for insert to authenticated with check (public.has_tenant_role(tenant_id, array['owner','manager']::public.tenant_role[]));
create policy guest_campaign_recipients_update on public.guest_campaign_recipients for update to authenticated using (public.has_tenant_role(tenant_id, array['owner','manager']::public.tenant_role[])) with check (public.has_tenant_role(tenant_id, array['owner','manager']::public.tenant_role[]));
create policy guest_campaign_recipients_delete on public.guest_campaign_recipients for delete to authenticated using (public.has_tenant_role(tenant_id, array['owner','manager']::public.tenant_role[]));

drop policy if exists profitability_recommendations_read on public.profitability_recommendations;
drop policy if exists profitability_recommendations_write on public.profitability_recommendations;
create policy profitability_recommendations_read on public.profitability_recommendations for select to authenticated using (public.is_tenant_member(tenant_id));
create policy profitability_recommendations_insert on public.profitability_recommendations for insert to authenticated with check (public.has_tenant_role(tenant_id, array['owner','manager']::public.tenant_role[]));
create policy profitability_recommendations_update on public.profitability_recommendations for update to authenticated using (public.has_tenant_role(tenant_id, array['owner','manager']::public.tenant_role[])) with check (public.has_tenant_role(tenant_id, array['owner','manager']::public.tenant_role[]));
create policy profitability_recommendations_delete on public.profitability_recommendations for delete to authenticated using (public.has_tenant_role(tenant_id, array['owner','manager']::public.tenant_role[]));

drop policy if exists online_orders_read on public.online_orders;
drop policy if exists online_orders_write on public.online_orders;
create policy online_orders_read on public.online_orders for select to authenticated using (public.is_tenant_member(tenant_id));
create policy online_orders_insert on public.online_orders for insert to authenticated with check (public.has_tenant_role(tenant_id, array['owner','manager','waiter']::public.tenant_role[]));
create policy online_orders_update on public.online_orders for update to authenticated using (public.has_tenant_role(tenant_id, array['owner','manager','waiter']::public.tenant_role[])) with check (public.has_tenant_role(tenant_id, array['owner','manager','waiter']::public.tenant_role[]));
create policy online_orders_delete on public.online_orders for delete to authenticated using (public.has_tenant_role(tenant_id, array['owner','manager','waiter']::public.tenant_role[]));

drop policy if exists gift_cards_read on public.gift_cards;
drop policy if exists gift_cards_write on public.gift_cards;
create policy gift_cards_read on public.gift_cards for select to authenticated using (public.has_tenant_role(tenant_id, array['owner','manager','waiter','accountant']::public.tenant_role[]));
create policy gift_cards_insert on public.gift_cards for insert to authenticated with check (public.has_tenant_role(tenant_id, array['owner','manager']::public.tenant_role[]));
create policy gift_cards_update on public.gift_cards for update to authenticated using (public.has_tenant_role(tenant_id, array['owner','manager']::public.tenant_role[])) with check (public.has_tenant_role(tenant_id, array['owner','manager']::public.tenant_role[]));
create policy gift_cards_delete on public.gift_cards for delete to authenticated using (public.has_tenant_role(tenant_id, array['owner','manager']::public.tenant_role[]));

drop policy if exists purchase_document_reviews_read on public.purchase_document_reviews;
drop policy if exists purchase_document_reviews_write on public.purchase_document_reviews;
create policy purchase_document_reviews_read on public.purchase_document_reviews for select to authenticated using (public.has_tenant_role(tenant_id, array['owner','manager','accountant']::public.tenant_role[]));
create policy purchase_document_reviews_insert on public.purchase_document_reviews for insert to authenticated with check (public.has_tenant_role(tenant_id, array['owner','manager']::public.tenant_role[]));
create policy purchase_document_reviews_update on public.purchase_document_reviews for update to authenticated using (public.has_tenant_role(tenant_id, array['owner','manager']::public.tenant_role[])) with check (public.has_tenant_role(tenant_id, array['owner','manager']::public.tenant_role[]));
create policy purchase_document_reviews_delete on public.purchase_document_reviews for delete to authenticated using (public.has_tenant_role(tenant_id, array['owner','manager']::public.tenant_role[]));

-- Índices de cobertura para relaciones añadidas recientemente.
create index if not exists timekeeping_employee_rates_employee_idx on public.timekeeping_employee_rates(employee_id);
create index if not exists timekeeping_employee_rates_created_by_idx on public.timekeeping_employee_rates(created_by);
create index if not exists workforce_shifts_venue_idx on public.workforce_shifts(venue_id);
create index if not exists workforce_shifts_employee_fk_idx on public.workforce_shifts(employee_id);
create index if not exists workforce_shifts_created_by_idx on public.workforce_shifts(created_by);
create index if not exists workforce_availability_employee_fk_idx on public.workforce_availability(employee_id);
create index if not exists workforce_absences_employee_fk_idx on public.workforce_absences(employee_id);
create index if not exists workforce_absences_created_by_idx on public.workforce_absences(created_by);
create index if not exists guest_campaigns_created_by_idx on public.guest_campaigns(created_by);
create index if not exists guest_campaign_recipients_guest_idx on public.guest_campaign_recipients(guest_id);
create index if not exists profitability_recommendations_venue_idx on public.profitability_recommendations(venue_id);
create index if not exists profitability_recommendations_decided_by_idx on public.profitability_recommendations(decided_by);
create index if not exists online_orders_venue_idx on public.online_orders(venue_id);
create index if not exists online_orders_guest_idx on public.online_orders(guest_id);
create index if not exists purchase_orders_venue_idx on public.purchase_orders(venue_id);
create index if not exists purchase_orders_supplier_idx on public.purchase_orders(supplier_id);
create index if not exists purchase_orders_approved_by_idx on public.purchase_orders(approved_by);
create index if not exists purchase_orders_created_by_idx on public.purchase_orders(created_by);
create index if not exists purchase_order_lines_ingredient_idx on public.purchase_order_lines(ingredient_id);
create index if not exists purchase_order_lines_tenant_idx on public.purchase_order_lines(tenant_id);
create index if not exists loyalty_accounts_guest_idx on public.loyalty_accounts(guest_id);
create index if not exists loyalty_transactions_guest_idx on public.loyalty_transactions(guest_id);
create index if not exists loyalty_transactions_created_by_idx on public.loyalty_transactions(created_by);
create index if not exists gift_cards_created_by_idx on public.gift_cards(created_by);
create index if not exists gift_card_transactions_created_by_idx on public.gift_card_transactions(created_by);
create index if not exists purchase_document_reviews_venue_idx on public.purchase_document_reviews(venue_id);
create index if not exists purchase_document_reviews_reviewed_by_idx on public.purchase_document_reviews(reviewed_by);