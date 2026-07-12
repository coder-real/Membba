-- ============================================
-- MEMBBA — AI Conversation Memory
-- Run in Supabase SQL Editor
-- ============================================

-- One row per message turn in a DM conversation with the bot
CREATE TABLE IF NOT EXISTS member_conversations (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  phone      text NOT NULL,        -- E.164 without '+' e.g. '2348012345678'
  role       text NOT NULL,        -- 'user' | 'assistant'
  content    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Fast lookup for history by member + recency
CREATE INDEX IF NOT EXISTS idx_member_conversations_phone
  ON member_conversations (phone, created_at DESC);
