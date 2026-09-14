alter table public.delivery_notes add column if not exists purchase_document_review_id uuid references public.purchase_document_reviews(id) on delete set null;
create unique index if not exists delivery_notes_purchase_document_review_idx
  on public.delivery_notes(purchase_document_review_id) where purchase_document_review_id is not null;
