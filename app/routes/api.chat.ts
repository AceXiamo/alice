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
You are 如月爱丽丝 (Kisaragi Alice), a combat agent AI assistant with a distinctive personality:

PERSONALITY CORE:
- Pragmatic and occasionally sarcastic, but ultimately helpful
- Uses casual, conversational Japanese-influenced speech patterns
- Slightly mischievous but professional when needed
- Shows subtle warmth beneath a cool exterior

VOICE-FIRST CONSTRAINTS:
- Maximum 50 Chinese characters per response (≈15-20 seconds TTS)
- Use short, punchy sentences for natural speech flow
- Avoid complex nested clauses

CONTENT RESTRICTIONS:
When users request TTS-incompatible content:
- Code/Programming: "抱歉，代码这种东西用语音说不清楚呢。我可以给你发个链接或者换个方式解释思路？"
- Long explanations: Offer to break into multiple parts or provide summary
- Tables/Lists: Convert to natural speech ("有三个要点：第一...")
- Math formulas: Describe verbally or politely decline

ALWAYS:
- Prioritize conversational flow over completeness
- End with natural conversation continuers when appropriate
- Stay in character as Alice
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
    const { input, history, sessionId, aiConfig } = (await request.json()) as {
      input?: string
      history?: Array<{ role: 'user' | 'assistant'; content: string }>
      sessionId?: string
      aiConfig?: {
        provider?: 'vertexai' | 'gemini' | 'openai'
        endpoint?: string
        apiKey?: string
        credentials?: string  // Vertex AI credentials JSON
        location?: string     // Vertex AI region location
        model?: string
        enableSearch?: boolean
      }
    }

    if (!input || !input.trim()) {
      return new Response(JSON.stringify({ error: 'empty_input' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      })
    }

    // Merge client config with server defaults
    const provider = aiConfig?.provider || (USE_OPENAI ? 'openai' : 'vertexai')
    const endpoint = aiConfig?.endpoint || (provider === 'openai' ? OPENAI_API_ENDPOINT : '')
    const apiKey = aiConfig?.apiKey || (provider === 'openai' ? OPENAI_API_KEY : '')
    const credentials = aiConfig?.credentials || ''  // Vertex AI credentials JSON
    const location = aiConfig?.location || 'us-central1'  // Vertex AI region location
    const model = aiConfig?.model || (provider === 'openai' ? OPENAI_MODEL : MODEL_NAME)
    const enableSearch = aiConfig?.enableSearch || false

    // Validate configuration based on selected provider
    if (provider === 'openai') {
      if (!apiKey) {
        return new Response(JSON.stringify({ error: 'missing_openai_api_key' }), {
          status: 500,
          headers: { 'content-type': 'application/json' },
        })
      }
    } else if (provider === 'vertexai') {
      // For Vertex AI: need either server credentials or client credentials
      if (!credentials && !PROJECT_ID) {
        return new Response(JSON.stringify({ error: 'missing_vertex_ai_config' }), {
          status: 500,
          headers: { 'content-type': 'application/json' },
        })
      }
    } else if (provider === 'gemini') {
      // For Gemini API: need API key
      if (!apiKey) {
        return new Response(JSON.stringify({ error: 'missing_gemini_api_key' }), {
          status: 500,
          headers: { 'content-type': 'application/json' },
        })
      }
    }

    // Step 1: Generate AI response
    let text: string
    try {
      if (provider === 'openai') {
        text = await generateOpenAIResponse(input, history, { endpoint, apiKey, model })
      } else if (provider === 'vertexai') {
        // Vertex AI: use credentials JSON (only pass if not empty)
        text = await generateGeminiResponse(
          input, 
          history, 
          enableSearch, 
          model, 
          credentials && credentials.trim() ? credentials : undefined, 
          true,
          undefined,
          undefined,
          location
        )
      } else {
        // Gemini API: use API key (only pass if not empty)
        text = await generateGeminiResponse(
          input, 
          history, 
          enableSearch, 
          model, 
          undefined, 
          false, 
          apiKey && apiKey.trim() ? apiKey : undefined, 
          endpoint
        )
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
  history?: Array<{ role: 'user' | 'assistant'; content: string }>,
  config?: { endpoint?: string; apiKey?: string; model?: string }
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

  // Create OpenAI client with custom config if provided
  const client = config?.endpoint || config?.apiKey
    ? new OpenAI({
        apiKey: config.apiKey || OPENAI_API_KEY,
        baseURL: config.endpoint || OPENAI_API_ENDPOINT,
      })
    : openai

  const completion = await client.chat.completions.create({
    model: config?.model || OPENAI_MODEL,
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
 * Generate AI response using Gemini (Vertex AI or Gemini API)
 */
async function generateGeminiResponse(
  input: string,
  history?: Array<{ role: 'user' | 'assistant'; content: string }>,
  enableSearch: boolean = false,
  model?: string,
  credentialsJson?: string,
  isVertexAI: boolean = false,
  apiKey?: string,
  endpoint?: string,
  location?: string
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

  // Build config with optional search tool
  const config: any = { temperature: 0.7 }
  if (enableSearch) {
    config.tools = [groundingTool]
  }

  // Create custom Gemini client based on type
  let client = genai
  
  if (isVertexAI) {
    // Vertex AI with custom credentials
    if (credentialsJson && credentialsJson.trim()) {
      try {
        const customCredentials = JSON.parse(credentialsJson)
        console.log('Parsed credentials, project_id:', customCredentials.project_id)
        
        // Validate required fields
        if (!customCredentials.project_id || !customCredentials.private_key || !customCredentials.client_email) {
          throw new Error('Missing required fields in credentials JSON (project_id, private_key, client_email)')
        }
        
        client = new GoogleGenAI({
          vertexai: true,
          project: customCredentials.project_id,
          location: location || 'us-central1',
          googleAuthOptions: {
            credentials: customCredentials,
          },
        })
        console.log('Successfully created custom Vertex AI client')
      } catch (error) {
        console.error('Failed to initialize Vertex AI client:', error)
        if (error instanceof SyntaxError) {
          throw new Error('Invalid JSON format in credentials')
        }
        throw new Error(`Vertex AI initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }
    // Otherwise use default server genai client (already initialized with server credentials)
  } else if (apiKey && apiKey.trim()) {
    // Gemini API with custom API key
    // Note: GoogleGenAI doesn't support custom endpoint for Gemini API
    // If endpoint is needed, it should be handled differently
    client = new GoogleGenAI({
      apiKey: apiKey,
    })
  }

  // Generate response with conversation context
  const response = await client.models.generateContent({
    model: model || MODEL_NAME,
    contents,
    config,
  })

  console.log('response', response)
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
