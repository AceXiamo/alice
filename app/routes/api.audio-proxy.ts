import type { Route } from './+types/api.audio-proxy'

/**
 * Audio Proxy API
 * Proxies audio files from external TTS service to avoid CORS issues
 *
 * Example usage:
 * GET /api/audio-proxy?url=https://axm-dev.acexiamo.com/audio/d0f01e6e-d43f-48ee-8285-b30c8972810a.wav
 */
export async function loader({ request }: Route.LoaderFunctionArgs) {
  try {
    const url = new URL(request.url)
    const audioUrl = url.searchParams.get('url')

    if (!audioUrl) {
      return new Response('Missing url parameter', { status: 400 })
    }

    // Validate URL to prevent abuse
    try {
      const parsedUrl = new URL(audioUrl)
      // Only allow specific domains for security
      const allowedDomains = ['axm-dev.acexiamo.com', '70uoabtdcq08ye-7865.proxy.runpod.net', 'fii0brhpejciqj-8188.proxy.runpod.net']
      if (!allowedDomains.some(domain => parsedUrl.hostname === domain)) {
        return new Response('Invalid audio URL domain', { status: 403 })
      }
    } catch {
      return new Response('Invalid URL format', { status: 400 })
    }

    // Fetch the audio file
    const response = await fetch(audioUrl)

    if (!response.ok) {
      console.error('Failed to fetch audio:', response.status, response.statusText)
      return new Response('Failed to fetch audio file', { status: response.status })
    }

    // Get the audio data
    const audioBuffer = await response.arrayBuffer()
    const contentType = response.headers.get('content-type') || 'audio/wav'

    // Return the audio with proper headers
    return new Response(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (error) {
    console.error('Audio proxy error:', error)
    return new Response('Internal server error', { status: 500 })
  }
}
