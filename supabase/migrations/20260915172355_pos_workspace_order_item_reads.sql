-- Covers the TPV kitchen-ticket and account item reads.
-- tenant_id stays first for RLS-scoped access; created_at supports the board order.
create index if not exists order_items_tenant_order_created_idx
  on public.order_items (tenant_id, order_id, created_at);
