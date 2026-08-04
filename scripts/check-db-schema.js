import { createClient } from '@supabase/supabase-js'
import WebSocket from 'ws'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !serviceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey, { realtime: { transport: WebSocket } })

const checks = [
  ['communities', 'id,creator_id,name,slug,platform,telegram_chat_id,whatsapp_group_invite_link,whatsapp_group_id,welcome_message_enabled,invite_link_ttl_minutes,msg_auto_delete_seconds,is_active,created_at'],
  ['plans', 'id,community_id,name,price,currency,duration_minutes,is_active,created_at'],
  ['payments', 'id,community_id,plan_id,email,telegram_user_id,whatsapp_phone,paystack_reference,amount,status,created_at'],
  ['payment_events', 'id,paystack_reference,event,status,message,payload,created_at'],
  ['subscriptions', 'id,community_id,plan_id,email,telegram_user_id,whatsapp_phone,paystack_reference,status,started_at,expires_at,created_at'],
  ['telegram_uid_tokens', 'token,uid,created_at'],
  ['baileys_sessions', 'id,data,updated_at'],
  ['whatsapp_pending_invites', 'id,phone,invite_link,community_name,community_id,group_id,custom_message,created_at'],
  ['automation_settings', 'creator_id,ai_responder,daily_digest,scheduler,digest_time,updated_at'],
  ['scheduled_posts', 'id,creator_id,community_id,content,scheduled_time,status,personalize_ai,sent_at,created_at'],
  ['automation_runs', 'id,creator_id,type,status,message,metadata,created_at'],
  ['ai_escalations', 'id,phone,intent,action,message,ai_reply,status,assigned_to_email,priority,created_at,resolved_at'],
  ['member_conversations', 'id,phone,role,content,created_at'],
  ['ops_notes', 'id,entity_type,entity_id,note,created_by_email,created_at'],
]

let failed = 0

for (const [table, columns] of checks) {
  const { error } = await supabase.from(table).select(columns).limit(1)
  if (error) {
    failed++
    console.log(`❌ ${table}: ${error.message}`)
  } else {
    console.log(`✅ ${table}`)
  }
}

const { data: buckets, error: bucketError } = await supabase.storage.listBuckets()
if (bucketError) {
  failed++
  console.log(`❌ storage buckets: ${bucketError.message}`)
} else if ((buckets || []).some(b => b.name === 'avatars')) {
  console.log('✅ storage bucket: avatars')
} else {
  failed++
  console.log('❌ storage bucket: avatars missing')
}

if (failed) {
  console.log(`\n${failed} check(s) failed. Run supabase-current-schema.sql in Supabase SQL Editor.`)
  process.exit(1)
}

console.log('\nAll schema checks passed.')
