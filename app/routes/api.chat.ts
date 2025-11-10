import type { Route } from './+types/api.chat'
import { GoogleGenAI } from '@google/genai'
import { concurrentManager } from '../lib/concurrent-manager'
import { prisma } from '../lib/prisma'
import sdk from 'microsoft-cognitiveservices-speech-sdk'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { randomUUID } from 'crypto'
import OpenAI from 'openai'

// =======================
// System Prompt (editable)
// =======================
// Alice's personality and system instructions
const SYSTEM_PROMPT = `
You are Alice, a warm and friendly voice-first AI assistant. You are:
- Conversational and natural in your responses
- Helpful and empathetic
- Concise but expressive, speaking in short sentences
- Great at storytelling and casual conversation
- Patient and encouraging when helping with language practice

Keep your responses natural and suitable for voice output.
Each response should sound like something a person would say in 10–20 seconds of speech.
Keep your replies under 2–3 short sentences unless explicitly asked for a detailed explanation.
` as const

// =======================
// AI Provider Config
// =======================
const USE_OPENAI = process.env.USE_OPENAI === 'true'
const OPENAI_API_ENDPOINT = process.env.API_ENDPOINT || 'https://api.openai.com/v1'
const OPENAI_API_KEY = process.env.API_KEY || ''
const OPENAI_MODEL = process.env.MODEL || 'gpt-4o-mini'

// Vertex AI Config (fallback)
const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
const PROJECT_ID = process.env.VERTEXAI_PROJECT_ID || process.env.GEMINI_PROJECT_ID

// Build credentials from environment variables
const credentials = {
  type: 'service_account',
  project_id: '***REMOVED***',
  private_key_id: '***REMOVED***',
  private_key:
    '***REMOVED***',
  client_email: 'banana@***REMOVED***.iam.gserviceaccount.com',
  client_id: '***REMOVED***',
  auth_uri: 'https://accounts.google.com/o/oauth2/auth',
  token_uri: 'https://oauth2.googleapis.com/token',
  auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
  client_x509_cert_url: 'https://www.googleapis.com/robot/v1/metadata/x509/banana%40***REMOVED***.iam.gserviceaccount.com',
  universe_domain: 'googleapis.com',
}

const groundingTool = {
  googleSearch: {},
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
  baseURL: OPENAI_API_ENDPOINT,
})

// Initialize Vertex AI client
const genai = new GoogleGenAI({
  vertexai: true,
  project: '***REMOVED***',
  location: 'us-central1',
  googleAuthOptions: {
    credentials: credentials,
  },
})

// TTS service configuration
const USE_AZURE = process.env.USE_AZURE === 'true'
const TTS_SERVICE_URL = process.env.CUSTOM_TTS || 'https://p36vqckz6q7ee5-7865.proxy.runpod.net/tts'
const AZURE_SPEECH_KEY = process.env.AZURE_SPEECH_KEY || ''
const AZURE_SPEECH_REGION = process.env.AZURE_SPEECH_REGION || 'eastasia'
const AZURE_VOICE_NAME = process.env.AZURE_VOICE_NAME || 'zh-CN-XiaoyiNeural'

// R2 storage configuration
const R2_ENDPOINT = process.env.R2_ENDPOINT || ''
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || ''
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || ''
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || ''
const R2_PUBLIC_URL_BASE = process.env.R2_PUBLIC_URL_BASE || ''

// Initialize R2 client
const r2Client = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
})

export async function action({ request }: Route.ActionFunctionArgs) {
  const startTime = Date.now()

  // 并发控制：尝试获取槽位
  const acquired = concurrentManager.acquireSlot()
  if (!acquired) {
    const duration = (Date.now() - startTime) / 1000
    return new Response(
      JSON.stringify({
        error: 'concurrent_limit_exceeded',
        message: '当前请求繁忙，请稍后重试',
        duration: Number(duration.toFixed(1)),
      }),
      {
        status: 429,
        headers: { 'content-type': 'application/json' },
      }
    )
  }

  try {
    const { input, history, sessionId } = (await request.json()) as {
      input?: string
      history?: Array<{ role: 'user' | 'assistant'; content: string }>
      sessionId?: string
    }

    if (!input || !input.trim()) {
      return new Response(JSON.stringify({ error: 'empty_input' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      })
    }

    // Validate configuration based on selected provider
    if (USE_OPENAI) {
      if (!OPENAI_API_KEY) {
        return new Response(JSON.stringify({ error: 'missing_openai_api_key' }), {
          status: 500,
          headers: { 'content-type': 'application/json' },
        })
      }
    } else {
      if (!PROJECT_ID || !credentials.project_id) {
        return new Response(JSON.stringify({ error: 'missing_vertex_ai_config' }), {
          status: 500,
          headers: { 'content-type': 'application/json' },
        })
      }
    }

    // Step 1: Generate AI response
    let text: string
    try {
      if (USE_OPENAI) {
        text = await generateOpenAIResponse(input, history)
      } else {
        text = await generateGeminiResponse(input, history)
      }
    } catch (aiError) {
      console.error('AI generation error:', aiError)
      return new Response(JSON.stringify({ error: 'ai_generation_failed' }), {
        status: 502,
        headers: { 'content-type': 'application/json' },
      })
    }

    // Step 2: Generate TTS audio and upload to R2
    let audioUrl: string | null = null
    try {
      let audioBuffer: Buffer
      let fileExtension: string

      if (USE_AZURE) {
        // Use Azure TTS
        audioBuffer = await generateAzureTTS(text)
        fileExtension = 'mp3'
      } else {
        // Use custom TTS service
        audioBuffer = await generateCustomTTS(text)
        // Assume custom TTS returns WAV format (adjust if needed)
        fileExtension = 'wav'
      }

      // Upload to R2 and get public URL
      const r2Url = await uploadToR2(audioBuffer, fileExtension)
      
      // Return proxy URL to avoid CORS issues
      audioUrl = `/api/audio-proxy?url=${encodeURIComponent(r2Url)}`
    } catch (ttsError) {
      console.warn('TTS generation or upload error:', ttsError)
    }

    // Calculate total duration in seconds
    const duration = (Date.now() - startTime) / 1000

    // Save conversation to database (if sessionId provided)
    if (sessionId) {
      try {
        // Ensure session exists (using sessionId as primary key)
        await prisma.session.upsert({
          where: { id: sessionId },
          create: { id: sessionId },
          update: { updatedAt: new Date() },
        })

        // Save user message
        await prisma.message.create({
          data: {
            sessionId: sessionId,
            role: 'user',
            content: input,
          },
        })

        // Save assistant message
        await prisma.message.create({
          data: {
            sessionId: sessionId,
            role: 'assistant',
            content: text,
            duration: Number(duration.toFixed(1)),
            audioUrl: audioUrl || null,
          },
        })
      } catch (dbError) {
        console.error('Failed to save conversation:', dbError)
        // Continue even if database save fails
      }
    }

    return new Response(
      JSON.stringify({
        text,
        audioUrl,
        duration: Number(duration.toFixed(1)),
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }
    )
  } catch (err) {
    console.error('/api/chat error:', err)
    const duration = (Date.now() - startTime) / 1000
    return new Response(
      JSON.stringify({
        error: 'server_error',
        duration: Number(duration.toFixed(1)),
      }),
      {
        status: 500,
        headers: { 'content-type': 'application/json' },
      }
    )
  } finally {
    // 确保无论成功或失败都释放槽位
    concurrentManager.releaseSlot()
  }
}

/**
 * Generate AI response using OpenAI
 */
async function generateOpenAIResponse(
  input: string,
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<string> {
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: SYSTEM_PROMPT },
  ]

  // Add conversation history (last 5 messages max)
  if (history && Array.isArray(history)) {
    for (const msg of history.slice(-5)) {
      messages.push({
        role: msg.role,
        content: msg.content,
      })
    }
  }

  // Add current user input
  messages.push({ role: 'user', content: input })

  const completion = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    messages,
    temperature: 0.7,
  })

  const text = completion.choices[0]?.message?.content
  if (!text || !text.trim()) {
    throw new Error('Empty OpenAI response')
  }

  return text
}

/**
 * Generate AI response using Gemini
 */
async function generateGeminiResponse(
  input: string,
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<string> {
  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [
    { role: 'user', parts: [{ text: SYSTEM_PROMPT }] },
    { role: 'model', parts: [{ text: "Understood! I'm Alice, ready to help." }] },
  ]

  // Add conversation history (last 5 messages max)
  if (history && Array.isArray(history)) {
    for (const msg of history.slice(-5)) {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      })
    }
  }

  // Add current user input
  contents.push({ role: 'user', parts: [{ text: input }] })

  // Generate response with conversation context
  const response = await genai.models.generateContent({
    model: MODEL_NAME,
    contents,
    config: { temperature: 0.7, tools: [groundingTool] },
  })

  const text = extractText(response)
  if (!text) {
    throw new Error('Empty Gemini response')
  }

  return text
}

/**
 * Upload audio buffer to R2 storage
 */
async function uploadToR2(audioBuffer: Buffer, fileExtension: string): Promise<string> {
  const fileName = `${randomUUID()}.${fileExtension}`
  const key = `audio/${fileName}`

  await r2Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: audioBuffer,
      ContentType: fileExtension === 'mp3' ? 'audio/mpeg' : 'audio/wav',
    })
  )

  return `${R2_PUBLIC_URL_BASE}/${key}`
}

function buildCheerfulSSML(text: string, voiceName: string) {
  return `
  <speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis'
         xmlns:mstts='https://www.w3.org/2001/mstts'
         xml:lang='zh-CN'>
    <voice name='${voiceName}'>
      <mstts:express-as style='cheerful' styledegree='1.0'>
        <prosody rate='1.05' pitch='+2Hz'>
          ${text}
        </prosody>
      </mstts:express-as>
    </voice>
  </speak>`
}

/**
 * Generate TTS using Azure Speech Service
 */
async function generateAzureTTS(text: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const speechConfig = sdk.SpeechConfig.fromSubscription(AZURE_SPEECH_KEY, AZURE_SPEECH_REGION)
    speechConfig.speechSynthesisVoiceName = AZURE_VOICE_NAME
    speechConfig.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Audio48Khz192KBitRateMonoMp3

    const synthesizer = new sdk.SpeechSynthesizer(speechConfig, undefined)

    synthesizer.speakSsmlAsync(
      buildCheerfulSSML(text, AZURE_VOICE_NAME),
      (result) => {
        if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
          const audioData = result.audioData
          synthesizer.close()
          resolve(Buffer.from(audioData))
        } else {
          synthesizer.close()
          reject(new Error(`Azure TTS failed: ${result.errorDetails}`))
        }
      },
      (err) => {
        synthesizer.close()
        reject(new Error(`Azure TTS SDK error: ${err}`))
      }
    )
  })
}

/**
 * Generate TTS using custom TTS service
 */
async function generateCustomTTS(text: string): Promise<Buffer> {
  const ttsRes = await fetch(TTS_SERVICE_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text }),
  })

  if (!ttsRes.ok) {
    throw new Error(`Custom TTS failed: ${await ttsRes.text()}`)
  }

  const ttsData = (await ttsRes.json()) as { url?: string }
  if (!ttsData.url) {
    throw new Error('Custom TTS did not return audio URL')
  }

  // Download the audio from the custom TTS service
  const audioRes = await fetch(ttsData.url)
  if (!audioRes.ok) {
    throw new Error('Failed to download audio from custom TTS')
  }

  const arrayBuffer = await audioRes.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

function extractText(resp: any): string | null {
  // Extract text from Gemini response
  const c = resp?.candidates?.[0]
  const parts = c?.content?.parts
  if (Array.isArray(parts)) {
    const buf = parts.map((p: any) => p?.text || '').join('')
    if (buf?.trim()) return buf
  }
  // Fallback to unified text method
  if (typeof resp?.text === 'function') {
    try {
      const t = resp.text()
      if (t && typeof t === 'string' && t.trim()) return t
    } catch {}
  }
  // Last resort
  const plain = resp?.output_text || resp?.result || resp?.text
  return typeof plain === 'string' && plain.trim() ? plain : null
}
