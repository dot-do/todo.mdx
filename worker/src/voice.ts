/**
 * Voice API routes
 * STT (Whisper) + TTS (Aura-2) + Chat (Claude)
 */

import { Hono } from 'hono'
import { authMiddleware } from './auth'
import type { Ai } from '@cloudflare/workers-types'

interface VoiceEnv {
  AI: Ai
  ANTHROPIC_API_KEY: string
}

const voice = new Hono<{ Bindings: VoiceEnv }>()

// All voice routes require authentication
voice.use('/*', authMiddleware)

/**
 * POST /api/voice/transcribe
 * Convert audio to text using Whisper
 */
voice.post('/transcribe', async (c) => {
  const formData = await c.req.formData()
  const audio = formData.get('audio') as File | null

  if (!audio) {
    return c.json({ error: 'No audio file provided' }, 400)
  }

  const audioBuffer = await audio.arrayBuffer()

  const result = await c.env.AI.run('@cf/openai/whisper', {
    audio: [...new Uint8Array(audioBuffer)],
  })

  return c.json({
    text: result.text,
    // vtt: result.vtt,
    // word_count: result.word_count,
  })
})

/**
 * POST /api/voice/speak
 * Convert text to audio using Aura-2
 */
voice.post('/speak', async (c) => {
  const { text, voice: voiceName = 'aura-asteria-en' } = await c.req.json<{
    text: string
    voice?: string
  }>()

  if (!text) {
    return c.json({ error: 'No text provided' }, 400)
  }

  const result = await c.env.AI.run('@cf/deepgram/aura-1', {
    text,
    voice: voiceName,
  })

  // Return audio as binary
  return new Response(result, {
    headers: {
      'Content-Type': 'audio/mpeg',
    },
  })
})

/**
 * POST /api/voice/chat
 * Full voice flow: audio in → transcribe → Claude → TTS → audio out
 */
voice.post('/chat', async (c) => {
  const formData = await c.req.formData()
  const audio = formData.get('audio') as File | null
  const systemPrompt = formData.get('system') as string | null
  const conversationHistory = formData.get('history') as string | null

  if (!audio) {
    return c.json({ error: 'No audio file provided' }, 400)
  }

  // 1. Transcribe audio with Whisper
  const audioBuffer = await audio.arrayBuffer()
  const transcription = await c.env.AI.run('@cf/openai/whisper', {
    audio: [...new Uint8Array(audioBuffer)],
  })

  const userMessage = transcription.text

  // 2. Build messages for Claude
  const messages: Array<{ role: string; content: string }> = []

  if (conversationHistory) {
    try {
      const history = JSON.parse(conversationHistory)
      messages.push(...history)
    } catch {
      // Ignore invalid history
    }
  }

  messages.push({ role: 'user', content: userMessage })

  // 3. Call Claude API
  const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': c.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt || 'You are Priya, a helpful AI product manager. Be concise and friendly.',
      messages,
    }),
  })

  if (!claudeResponse.ok) {
    const error = await claudeResponse.text()
    return c.json({ error: 'Claude API error', details: error }, 500)
  }

  const claudeResult = await claudeResponse.json() as {
    content: Array<{ type: string; text: string }>
  }

  const assistantMessage = claudeResult.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('')

  // 4. Convert response to speech with Aura-2
  const ttsResult = await c.env.AI.run('@cf/deepgram/aura-1', {
    text: assistantMessage,
    voice: 'aura-asteria-en', // Female voice for Priya
  })

  // Return both text and audio
  return new Response(ttsResult, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'X-Transcription': encodeURIComponent(userMessage),
      'X-Response': encodeURIComponent(assistantMessage),
    },
  })
})

/**
 * GET /api/voice/voices
 * List available TTS voices
 */
voice.get('/voices', (c) => {
  return c.json({
    voices: [
      { id: 'aura-asteria-en', name: 'Asteria', gender: 'female', language: 'en' },
      { id: 'aura-luna-en', name: 'Luna', gender: 'female', language: 'en' },
      { id: 'aura-stella-en', name: 'Stella', gender: 'female', language: 'en' },
      { id: 'aura-athena-en', name: 'Athena', gender: 'female', language: 'en' },
      { id: 'aura-hera-en', name: 'Hera', gender: 'female', language: 'en' },
      { id: 'aura-orion-en', name: 'Orion', gender: 'male', language: 'en' },
      { id: 'aura-arcas-en', name: 'Arcas', gender: 'male', language: 'en' },
      { id: 'aura-perseus-en', name: 'Perseus', gender: 'male', language: 'en' },
      { id: 'aura-angus-en', name: 'Angus', gender: 'male', language: 'en' },
      { id: 'aura-orpheus-en', name: 'Orpheus', gender: 'male', language: 'en' },
      { id: 'aura-helios-en', name: 'Helios', gender: 'male', language: 'en' },
      { id: 'aura-zeus-en', name: 'Zeus', gender: 'male', language: 'en' },
    ],
  })
})

export { voice }
