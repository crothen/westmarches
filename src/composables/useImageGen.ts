import { ref } from 'vue'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from '../firebase/config'

const apiKey = import.meta.env.VITE_GEMINI_API_KEY

const TEXTURE_STYLE_SYSTEM = `You are a texture prompt engineer for a fantasy RPG hex map.
Given a terrain name and fallback color, generate a concise image generation prompt.

RULES:
- The texture is viewed TOP-DOWN (bird's eye view, looking straight down)
- Style: painterly, soft round organic shapes, subtle variation
- Must be SEAMLESS and TILEABLE with uniform coverage
- No focal point, no borders, no text, no labels, no perspective
- Keep it simple — recognizable as the terrain at both small and large sizes
- Output ONLY the prompt text, nothing else

GOOD EXAMPLES (use these as style reference):
- Forest: "Top-down view of a light forest canopy texture. Soft greens with dappled sunlight. Painterly style, seamless tile, no borders. Simple and readable at any zoom level."
- Forest (dense): "Dense but soft forest canopy texture from above. Overlapping round treetops, light forest greens. Slightly varied sizes. Subtle depth, no harsh shadows. Seamless tileable, painterly, no text or borders."

Adapt the subject, shapes, and color palette to match the terrain. Keep a similar sentence structure and style keywords.`

export function useImageGen() {
  const generating = ref(false)
  const error = ref<string | null>(null)

  /**
   * Auto-generate a texture prompt for a terrain type using the text model.
   */
  async function generateTexturePrompt(terrainName: string, fallbackColor: string): Promise<string | null> {
    if (!apiKey) {
      error.value = 'Gemini API key not configured'
      return null
    }

    try {
      const genAI = new GoogleGenerativeAI(apiKey)
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

      const result = await model.generateContent({
        contents: [{
          role: 'user',
          parts: [{ text: `Terrain: "${terrainName}"\nFallback color: ${fallbackColor}\n\nGenerate the texture prompt.` }]
        }],
        systemInstruction: { role: 'system', parts: [{ text: TEXTURE_STYLE_SYSTEM }] },
      })

      const text = result.response.text()?.trim()
      return text || null
    } catch (e: any) {
      console.error('Prompt generation failed:', e)
      error.value = e.message || 'Prompt generation failed'
      return null
    }
  }

  async function generateImage(prompt: string, storagePath: string): Promise<string | null> {
    if (!apiKey) {
      error.value = 'Gemini API key not configured'
      return null
    }

    generating.value = true
    error.value = null

    try {
      const genAI = new GoogleGenerativeAI(apiKey)
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash-image',
        generationConfig: {
          // @ts-ignore - responseModalities is valid for image generation
          responseModalities: ['TEXT', 'IMAGE'],
        },
      })

      const result = await model.generateContent(prompt)
      const response = result.response

      // Extract image from response
      let imageData: Uint8Array | null = null
      let mimeType = 'image/png'

      for (const candidate of response.candidates || []) {
        for (const part of candidate.content?.parts || []) {
          if (part.inlineData) {
            // Convert base64 to Uint8Array
            const base64 = part.inlineData.data
            mimeType = part.inlineData.mimeType || 'image/png'
            const binaryString = atob(base64!)
            const bytes = new Uint8Array(binaryString.length)
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i)
            }
            imageData = bytes
            break
          }
        }
        if (imageData) break
      }

      if (!imageData) {
        error.value = 'No image was generated. Try a different prompt.'
        return null
      }

      // Upload to Firebase Storage
      const ext = mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'jpg' : 'png'
      const fileRef = storageRef(storage, `${storagePath}.${ext}`)
      await uploadBytes(fileRef, imageData, { contentType: mimeType })
      const url = await getDownloadURL(fileRef)

      return url
    } catch (e: any) {
      console.error('Image generation failed:', e)
      error.value = e.message || 'Image generation failed'
      return null
    } finally {
      generating.value = false
    }
  }

  return { generating, error, generateImage, generateTexturePrompt }
}
