import { supabase } from '../lib/supabase.js'

export const DEFAULT_AUTOMATION_SETTINGS = {
  ai_responder: true,
  daily_digest: true,
  scheduler: true,
  digest_time: '08:00',
}

export async function getAutomationSettings(creatorId) {
  if (!creatorId) return DEFAULT_AUTOMATION_SETTINGS

  const { data, error } = await supabase
    .from('automation_settings')
    .select('*')
    .eq('creator_id', creatorId)
    .maybeSingle()

  if (error) {
    console.warn('[automation] settings lookup failed:', error.message)
    return DEFAULT_AUTOMATION_SETTINGS
  }

  return { ...DEFAULT_AUTOMATION_SETTINGS, ...(data || {}) }
}

export async function findCreatorForWhatsAppPhone(phone) {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('status, communities(creator_id, name, slug)')
    .eq('whatsapp_phone', phone)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.warn('[automation] creator lookup failed:', error.message)
    return null
  }

  return data?.communities?.creator_id || null
}

export async function isAIResponderEnabledForPhone(phone) {
  const creatorId = await findCreatorForWhatsAppPhone(phone)
  // Unknown members still get AI by default so the bot can explain next steps.
  if (!creatorId) return true
  const settings = await getAutomationSettings(creatorId)
  return settings.ai_responder !== false
}

export async function isSchedulerEnabledForCreator(creatorId) {
  const settings = await getAutomationSettings(creatorId)
  return settings.scheduler !== false
}

export async function isAnyDailyDigestEnabled() {
  const { data, error } = await supabase
    .from('automation_settings')
    .select('daily_digest')
    .eq('daily_digest', true)
    .limit(1)

  if (error) {
    console.warn('[automation] daily digest settings lookup failed:', error.message)
    return true
  }

  // If no creator has settings yet, keep the previous default behavior.
  const { count } = await supabase
    .from('automation_settings')
    .select('*', { count: 'exact', head: true })

  if (!count) return true
  return Boolean(data?.length)
}

export async function logAutomationRun({ creatorId = null, type, status, message = null, metadata = {} }) {
  try {
    const { error } = await supabase.from('automation_runs').insert({
      creator_id: creatorId,
      type,
      status,
      message,
      metadata,
    })
    if (error) console.warn('[automation] run log skipped:', error.message)
  } catch (err) {
    console.warn('[automation] run log skipped:', err.message)
  }
}
