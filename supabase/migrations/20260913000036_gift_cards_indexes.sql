create index if not exists gift_cards_tenant_created_idx
  on public.gift_cards (tenant_id, created_at desc, id asc);

create index if not exists gift_cards_tenant_status_idx
  on public.gift_cards (tenant_id, status, created_at desc);

create index if not exists gift_card_transactions_tenant_created_idx
  on public.gift_card_transactions (tenant_id, created_at desc, id asc);

create index if not exists gift_card_transactions_card_created_idx
  on public.gift_card_transactions (gift_card_id, created_at desc, id asc);

grant select, insert, update on public.gift_cards to authenticated;
grant select, insert on public.gift_card_transactions to authenticated;
