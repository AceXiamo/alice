import type { Route } from './+types/api.genai'
import { GoogleGenAI } from '@google/genai'

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
const LOCATION = process.env.VERTEXAI_LOCATION || 'global'

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

// Initialize Vertex AI client
const genai = new GoogleGenAI({
  vertexai: true,
  project: '***REMOVED***',
  location: 'us-central1',
  googleAuthOptions: {
    credentials: credentials,
  },
})

export async function action({ request }: Route.ActionFunctionArgs) {
  try {
    const { input, history } = (await request.json()) as {
      input?: string
      history?: Array<{ role: 'user' | 'assistant'; content: string }>
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

    // Build conversation contents with system prompt and history
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
      config: { temperature: 0.7, tools: [groundingTool] }
    })

    // 尝试从多个位置提取文本
    const text = extractText(response)
    if (!text) {
      return new Response(JSON.stringify({ error: 'empty_response' }), {
        status: 502,
        headers: { 'content-type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ text }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  } catch (err) {
    console.error('/api/genai error:', err)
    return new Response(JSON.stringify({ error: 'server_error' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }
}

function extractText(resp: any): string | null {
  // exam.ts 风格
  const c = resp?.candidates?.[0]
  const parts = c?.content?.parts
  if (Array.isArray(parts)) {
    const buf = parts.map((p: any) => p?.text || '').join('')
    if (buf?.trim()) return buf
  }
  // 兼容部分 SDK 的统一 text 方法
  if (typeof resp?.text === 'function') {
    try {
      const t = resp.text()
      if (t && typeof t === 'string' && t.trim()) return t
    } catch {}
  }
  // 兜底
  const plain = resp?.output_text || resp?.result || resp?.text
  return typeof plain === 'string' && plain.trim() ? plain : null
}
