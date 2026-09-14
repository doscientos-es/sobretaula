-- Extend the plan element vocabulary without rewriting existing layouts.
alter type public.plan_element_kind add value if not exists 'pillar';
alter type public.plan_element_kind add value if not exists 'bathroom';
alter type public.plan_element_kind add value if not exists 'kitchen';
alter type public.plan_element_kind add value if not exists 'exit';
alter type public.plan_element_kind add value if not exists 'obstacle';
