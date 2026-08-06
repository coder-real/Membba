-- ============================================
-- MEMBBA — WhatsApp Setup Mode
-- Run in Supabase SQL Editor
-- ============================================

alter table communities
  add column if not exists whatsapp_setup_mode text not null default 'basic';

do $$ begin
  alter table communities add constraint communities_whatsapp_setup_mode_check
    check (whatsapp_setup_mode in ('basic', 'advanced'));
exception when duplicate_object then null;
end $$;

-- Backfill: existing WhatsApp communities with a group_id likely used advanced automation.
update communities
set whatsapp_setup_mode = 'advanced'
where platform = 'whatsapp'
  and whatsapp_group_id is not null
  and (whatsapp_setup_mode is null or whatsapp_setup_mode = 'basic');
