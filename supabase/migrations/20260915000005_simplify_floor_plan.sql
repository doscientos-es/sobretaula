-- The test product keeps one operational map per area.
-- Event layouts and table-group presets are intentionally removed: they add
-- state and failure modes without helping the core service workflow.
drop table if exists public.event_layout_templates cascade;
drop table if exists public.table_group_presets cascade;
