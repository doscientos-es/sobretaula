-- Los índices únicos parciales mantienen la idempotencia; estos cubren las
-- acciones de las claves foráneas cuando las referencias son nulas o cambian.
create index if not exists loyalty_transactions_source_online_order_fk_idx
  on public.loyalty_transactions(source_online_order_id);

create index if not exists loyalty_transactions_source_payment_fk_idx
  on public.loyalty_transactions(source_payment_id);