import { GoogleGenAI } from '@google/genai'
import * as fs from 'fs'
import * as path from 'path'

/**
 * Demo: Using Google GenAI to generate images with Imagen 3
 * 
 * This demo shows how to:
 * 1. Initialize GoogleGenAI client with Vertex AI
 * 2. Generate images from text prompts
 * 3. Save generated images to disk
 */

// =======================
// Configuration
// =======================

// Load credentials from environment variables
const credentials = {
  type: process.env.GEMINI_TYPE || '',
  project_id: process.env.GEMINI_PROJECT_ID || '',
  private_key_id: process.env.GEMINI_PRIVATE_KEY_ID || '',
  private_key: process.env.GEMINI_PRIVATE_KEY || '',
  client_email: process.env.GEMINI_CLIENT_EMAIL || '',
  client_id: process.env.GEMINI_CLIENT_ID || '',
  auth_uri: process.env.GEMINI_AUTH_URI || '',
  token_uri: process.env.GEMINI_TOKEN_URI || '',
  auth_provider_x509_cert_url: process.env.GEMINI_AUTH_PROVIDER_X509_CERT_URL || '',
  client_x509_cert_url: process.env.GEMINI_CLIENT_X509_CERT_URL || '',
  universe_domain: process.env.GEMINI_UNIVERSE_DOMAIN || '',
}

const PROJECT_ID = process.env.GEMINI_PROJECT_ID || ''
const LOCATION = process.env.VERTEXAI_LOCATION || 'us-central1'

// =======================
// Initialize Client
// =======================

const genai = new GoogleGenAI({
  vertexai: true,
  project: PROJECT_ID,
  location: LOCATION,
  googleAuthOptions: {
    credentials: credentials,
  },
})

// =======================
// Image Generation Functions
// =======================

/**
 * Generate an image from a text prompt using Imagen 3
 */
async function generateImage(prompt: string, outputPath: string) {
  try {
    console.log('🎨 Generating image with prompt:', prompt)
    console.log('📍 Using location:', LOCATION)
    
    // Get the Imagen model
    const model = genai.getGenerativeModel({
      model: 'imagen-3.0-generate-001', // Imagen 3 model for image generation
    })

    // Generate image
    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
      generationConfig: {
        // Image generation specific configs
        responseModalities: ['image'], // Request image output
        // Optional: Add more configs like aspect ratio, style, etc.
      },
    })

    // Extract image data from response
    const response = result.response
    
    if (!response.candidates || response.candidates.length === 0) {
      throw new Error('No image generated')
    }

    const candidate = response.candidates[0]
    const imagePart = candidate.content.parts.find((part: any) => part.inlineData)

    if (!imagePart || !imagePart.inlineData) {
      throw new Error('No image data found in response')
    }

    // Get base64 image data
    const imageData = imagePart.inlineData.data
    const mimeType = imagePart.inlineData.mimeType || 'image/png'
    
    console.log('✅ Image generated successfully')
    console.log('📦 MIME type:', mimeType)
    console.log('📏 Data size:', imageData.length, 'characters (base64)')

    // Convert base64 to buffer and save
    const buffer = Buffer.from(imageData, 'base64')
    fs.writeFileSync(outputPath, buffer)
    
    console.log('💾 Image saved to:', outputPath)
    
    return {
      success: true,
      path: outputPath,
      mimeType,
      size: buffer.length,
    }
  } catch (error) {
    console.error('❌ Error generating image:', error)
    throw error
  }
}

/**
 * Generate multiple images with different prompts
 */
async function generateMultipleImages(prompts: string[], outputDir: string) {
  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const results = []

  for (let i = 0; i < prompts.length; i++) {
    const prompt = prompts[i]
    const filename = `image_${i + 1}_${Date.now()}.png`
    const outputPath = path.join(outputDir, filename)

    try {
      const result = await generateImage(prompt, outputPath)
      results.push({ prompt, ...result })
    } catch (error) {
      results.push({
        prompt,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }

    // Add delay between requests to avoid rate limiting
    if (i < prompts.length - 1) {
      console.log('⏳ Waiting 2 seconds before next generation...\n')
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }

  return results
}

// =======================
// Main Demo
// =======================

async function main() {
  console.log('🚀 Google GenAI Image Generation Demo\n')
  console.log('=' .repeat(50))
  console.log('Project ID:', PROJECT_ID)
  console.log('Location:', LOCATION)
  console.log('=' .repeat(50))
  console.log()

  // Check if credentials are configured
  if (!PROJECT_ID || !credentials.project_id) {
    console.error('❌ Error: Vertex AI credentials not configured')
    console.error('Please set the required environment variables:')
    console.error('  - GEMINI_PROJECT_ID')
    console.error('  - GEMINI_PRIVATE_KEY')
    console.error('  - GEMINI_CLIENT_EMAIL')
    console.error('  - etc.')
    process.exit(1)
  }

  // Example 1: Generate a single image
  console.log('📝 Example 1: Single Image Generation\n')
  
  try {
    await generateImage(
      'A serene Japanese garden with cherry blossoms, koi pond, and traditional wooden bridge at sunset',
      './generated_image_1.png'
    )
  } catch (error) {
    console.error('Failed to generate single image')
  }

  console.log('\n' + '=' .repeat(50) + '\n')

  // Example 2: Generate multiple images
  console.log('📝 Example 2: Multiple Image Generation\n')

  const prompts = [
    'A futuristic cyberpunk city with neon lights and flying cars',
    'A cute robot assistant with a friendly smile, anime style',
    'An abstract representation of artificial intelligence, colorful and geometric',
  ]

  try {
    const results = await generateMultipleImages(prompts, './generated_images')
    
    console.log('\n📊 Generation Summary:')
    console.log('=' .repeat(50))
    results.forEach((result, index) => {
      console.log(`\nImage ${index + 1}:`)
      console.log('  Prompt:', result.prompt)
      console.log('  Success:', result.success)
      if (result.success) {
        console.log('  Path:', result.path)
        console.log('  Size:', (result.size! / 1024).toFixed(2), 'KB')
      } else {
        console.log('  Error:', result.error)
      }
    })
  } catch (error) {
    console.error('Failed to generate multiple images')
  }

  console.log('\n✨ Demo completed!')
}

// Run the demo
if (require.main === module) {
  main().catch(console.error)
}

// Export functions for use in other modules
export { generateImage, generateMultipleImages }

