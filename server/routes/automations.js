/**
 * routes/automations.js — Membba Automations API
 * 
 * Endpoints:
 *   GET  /api/automations/settings          — get creator's feature toggles
 *   POST /api/automations/settings          — save feature toggles
 *   GET  /api/automations/posts             — list scheduled posts
 *   POST /api/automations/posts             — create a scheduled post
 *   DELETE /api/automations/posts/:id       — cancel/delete a post
 */

import express from 'express'
import { supabase } from '../lib/supabase.js'

const router = express.Router()

// ── Verify the caller is a real JWT session ────────────────────────────────
async function getCreatorId(req) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return null
  const { data } = await supabase.auth.getUser(token)
  return data?.user?.id || null
}

// ── GET /api/automations/settings ──────────────────────────────────────────
router.get('/settings', async (req, res) => {
  const creatorId = await getCreatorId(req)
  if (!creatorId) return res.status(401).json({ error: 'Unauthorized' })

  const { data, error } = await supabase
    .from('automation_settings')
    .select('*')
    .eq('creator_id', creatorId)
    .maybeSingle()

  if (error) return res.status(500).json({ error: error.message })

  // Return defaults if no row yet
  if (!data) {
    return res.json({
      creator_id: creatorId,
      ai_responder: true,
      daily_digest: true,
      scheduler: true,
      digest_time: '08:00',
    })
  }

  res.json(data)
})

// ── POST /api/automations/settings ─────────────────────────────────────────
router.post('/settings', async (req, res) => {
  const creatorId = await getCreatorId(req)
  if (!creatorId) return res.status(401).json({ error: 'Unauthorized' })

  const { ai_responder, daily_digest, scheduler, digest_time } = req.body

  const { data, error } = await supabase
    .from('automation_settings')
    .upsert({
      creator_id: creatorId,
      ai_responder: ai_responder ?? true,
      daily_digest: daily_digest ?? true,
      scheduler: scheduler ?? true,
      digest_time: digest_time || '08:00',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'creator_id' })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// ── GET /api/automations/posts ─────────────────────────────────────────────
router.get('/posts', async (req, res) => {
  const creatorId = await getCreatorId(req)
  if (!creatorId) return res.status(401).json({ error: 'Unauthorized' })

  const { data, error } = await supabase
    .from('scheduled_posts')
    .select('*, communities(name, platform)')
    .eq('creator_id', creatorId)
    .order('scheduled_time', { ascending: true })
    .limit(50)

  if (error) return res.status(500).json({ error: error.message })
  res.json(data || [])
})

// ── POST /api/automations/posts ────────────────────────────────────────────
router.post('/posts', async (req, res) => {
  const creatorId = await getCreatorId(req)
  if (!creatorId) return res.status(401).json({ error: 'Unauthorized' })

  const { community_id, content, scheduled_time, personalize_ai } = req.body
  if (!community_id || !content || !scheduled_time) {
    return res.status(400).json({ error: 'community_id, content, and scheduled_time are required' })
  }

  const { data, error } = await supabase
    .from('scheduled_posts')
    .insert({
      creator_id: creatorId,
      community_id,
      content,
      scheduled_time,
      personalize_ai: personalize_ai || false,
    })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// ── DELETE /api/automations/posts/:id ──────────────────────────────────────
router.delete('/posts/:id', async (req, res) => {
  const creatorId = await getCreatorId(req)
  if (!creatorId) return res.status(401).json({ error: 'Unauthorized' })

  const { error } = await supabase
    .from('scheduled_posts')
    .update({ status: 'cancelled' })
    .eq('id', req.params.id)
    .eq('creator_id', creatorId) // security: can only cancel your own posts
    .eq('status', 'pending')

  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true })
})

export default router
