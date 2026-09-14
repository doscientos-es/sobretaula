-- La evidencia de anulación es append-only, incluso para responsables.
drop policy if exists order_item_cancellations_update on public.order_item_cancellations;
drop policy if exists order_item_cancellations_delete on public.order_item_cancellations;