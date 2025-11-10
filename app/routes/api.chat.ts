import type { Route } from './+types/api.chat'
import { GoogleGenAI } from '@google/genai'
import { concurrentManager } from '../lib/concurrent-manager'
import { prisma } from '../lib/prisma'

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
// Vertex AI Config
// =======================
const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
const PROJECT_ID = process.env.VERTEXAI_PROJECT_ID || process.env.GEMINI_PROJECT_ID

// Build credentials from environment variables
const credentials = {
  type: 'service_account',
  project_id: 'framio-474722',
  private_key_id: '65d79b98337ea086c2ee48c41dae778a5c3a07f3',
  private_key:
    '-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCxwScQYT8FF0Wq\nx0gkgZLQ6gLwKWF29bVInOK9qN3X+aDcxZyUg2fySgXNBVHnGwmVVmXz0JmRbPX8\nPx+diNiDgpOEfS6mP92BdRkJMTTFrTHZHlszQaQjYGiGMXS2LKbBwPtEWGp9IxFa\nFGnZ9wMEJnDCGnD4WEv2eOEt0ol0+GDqTkrM7y3HbGF9nRS5EmD+IWmpjZ3HrH49\njlzqpByOmh0pjfQd2y9QBI7gC4yoXWKr3QPk9VQ4swK5PowJH5vLJLD0G6kmn7jK\nRZPUnQz+/g5FVRI813lfjD4AHWDcwpe67bl5ukuTjEnmWEiI9RFl0ReFLfjQc0E5\nFwosCl2lAgMBAAECggEAA001TdGGzvc7ak/pmrxtKaCONNwX570/YOvW2MGJ7OGl\nRBZHxt4uMFydufeI1E0hpn4rm5zJABip9MWkC9tOkOFuEFkWOclKAOm7YtBEcGLY\nNXXpDL7zp7DIV1cUYLdqYNhdK0wXHrUgpowREwif5OJXAtMPPKr5Z4+8OFJ/nMZF\ncKshmzxxJomN9xkfK9CC/+s5rBim/sAfb0xZDplF9sMdCiSYUUpBMzA3uJzLzH3l\nKFqIVMzqZRh5HUWwZdLSMslz8QQLty4OMizeLk85OXcKMsEtpA133DsG0lMxIPXP\nj6GEJy8avOE/8bbcZ5zBMQJLMnoS/ozmFvmRTFAAIQKBgQDgT8C6Bt4/N2HHOEGA\nFznWwfWlEKYs2Bj4SntuNDZC+sHj7aSVlGRruouBOXzWlWkvpZkk8p0uiaub4W1B\nlK33Tz/vLydOaLyqUfnClt3FMacqasDQJiLNKjpnCZ5tl/K+JyfEfwNs9lcbRLio\nYYixxJa7A1TYL1KMG93CSDcUNQKBgQDK3akRw/bvsEq1zO2Owc8RjskLpdzxFDb2\nLPocoPqE8g6MIkXUhOFkEgyi99M+ILYjtpzldFrFHbxWRVKjvQ7yQDeCwSL7Xhgj\nUso6uv4PqF0SR/PCPp4STgTwUv4K91y3B4G5JvDuKBf5m132QZud3xiNZJ33teOA\npWv6IyJxsQKBgFKfjdH37a1DbRTAt//Cjl94mk7uzwb9olTyunxhZwtM6lZWlqUy\nP7sev3wd/Mndxxzx1nMxmowl0bxdUK0zYtERs+8aY1QSaEwkXec7Qvz7ySNqpxME\nuRTxVQnXFTAxJAy+x3stfcmJA5Tbv1jmdD9mtk60b3AiHjnVmd2SVBdxAoGAZ7/3\nUJOlPa4ud03oDIOIEBWzMlbQaScKeNpFy9B0bvuQfxCkH+0ZjGFCvzH5giOeoyMo\nmJzqMzdi88geXIk7FJ/NA/0ck+vqcl5L+L9bYcycVNYhjy0REJGAKxx2uksJyr13\nFacZvuMYZ9qSsneZS6MmXmGf/Gi0gj2XvGStn/ECgYBuwi4HpA88y73+Z7vu3yW/\n9zZCmPfQkuQvAu5jzo7kbNUapBcl14jkNY8Z77ledbaXEl8err6pzHIBCCQ0TgYE\nZE21UTgLupK6qC3+1qjdj96im4lstdoHOopnx04mIfcsy2M7tNSZjbZkmKzRf2QH\nEAi5KYmLK2sc8iTLCOoLvA==\n-----END PRIVATE KEY-----\n',
  client_email: 'banana@framio-474722.iam.gserviceaccount.com',
  client_id: '116771621652202903501',
  auth_uri: 'https://accounts.google.com/o/oauth2/auth',
  token_uri: 'https://oauth2.googleapis.com/token',
  auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
  client_x509_cert_url: 'https://www.googleapis.com/robot/v1/metadata/x509/banana%40framio-474722.iam.gserviceaccount.com',
  universe_domain: 'googleapis.com',
}

const groundingTool = {
  googleSearch: {},
}

// Initialize Vertex AI client
const genai = new GoogleGenAI({
  vertexai: true,
  project: 'framio-474722',
  location: 'us-central1',
  googleAuthOptions: {
    credentials: credentials,
  },
})

// TTS service configuration
const TTS_SERVICE_URL = 'https://p36vqckz6q7ee5-7865.proxy.runpod.net/tts'

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

    if (!PROJECT_ID || !credentials.project_id) {
      return new Response(JSON.stringify({ error: 'missing_vertex_ai_config' }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      })
    }

    // Step 1: Generate AI response
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
      return new Response(JSON.stringify({ error: 'empty_ai_response' }), {
        status: 502,
        headers: { 'content-type': 'application/json' },
      })
    }

    // Step 2: Generate TTS audio
    let audioUrl: string | null = null
    try {
      const ttsRes = await fetch(TTS_SERVICE_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
      })

      if (ttsRes.ok) {
        const ttsData = (await ttsRes.json()) as { url?: string }
        if (ttsData.url) {
          // Return proxy URL to avoid CORS issues
          audioUrl = `/api/audio-proxy?url=${encodeURIComponent(ttsData.url)}`
        }
      } else {
        console.warn('TTS generation failed:', await ttsRes.text())
      }
    } catch (ttsError) {
      console.warn('TTS service error:', ttsError)
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
