create index if not exists purchase_document_reviews_tenant_venue_created_idx
  on public.purchase_document_reviews (tenant_id, venue_id, created_at desc, id asc);

create index if not exists purchase_document_reviews_tenant_status_idx
  on public.purchase_document_reviews (tenant_id, status, created_at desc, id asc);

grant select, insert, update on public.purchase_document_reviews to authenticated;
