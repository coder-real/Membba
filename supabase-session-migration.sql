-- ============================================
-- MEMBBA — WhatsApp Session Store (v4)
-- Run this in Supabase SQL Editor
-- Stores serialized whatsapp-web.js sessions
-- so they survive Render redeploys.
-- ============================================

CREATE TABLE IF NOT EXISTS whatsapp_sessions (
  id         text PRIMARY KEY,   -- session name, e.g. 'membba-default'
  session    text NOT NULL,      -- base64-encoded zip of .wwebjs_auth folder
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Only the service role (backend) should access this table
ALTER TABLE whatsapp_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages whatsapp sessions"
  ON whatsapp_sessions FOR ALL
  USING (true)
  WITH CHECK (true);
