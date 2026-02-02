import { ref } from 'vue'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from '../firebase/config'

const apiKey = import.meta.env.VITE_GEMINI_API_KEY

const TEXTURE_STYLE_SYSTEM = `You are a texture prompt engineer for a fantasy RPG hex map.
Given a terrain name and its color (hex code), generate a concise image generation prompt.

CRITICAL RULES:
- STRICTLY TOP-DOWN bird's eye view — camera pointing STRAIGHT DOWN at the ground. No horizon, no side view, no perspective, no 3D depth, no vanishing points. Imagine a satellite photo or a drone looking directly downward.
- The given hex color MUST be the DOMINANT color of the texture. Mention the exact color and describe it. Variations should stay close to that hue.
- Style: painterly, soft round organic shapes, subtle variation
- Must be SEAMLESS and TILEABLE with uniform coverage across the entire image
- No focal point, no borders, no text, no labels
- Keep it simple — recognizable as the terrain at both small and large sizes
- Output ONLY the prompt text, nothing else

GOOD EXAMPLES (use these as style reference):
- Forest (color #4a7c3f): "Strictly top-down bird's eye view of a forest canopy. Dominant color: muted green (#4a7c3f). Soft overlapping round treetops in shades of #4a7c3f with subtle lighter and darker variations. Dappled sunlight. Painterly style, seamless tileable texture. No perspective, no horizon, no borders, no text."
- Forest dense (color #2d5a1e): "Strictly top-down bird's eye view, looking straight down at dense forest canopy. Dominant color: dark green (#2d5a1e). Tightly packed round treetops, varying sizes, all shades close to #2d5a1e. Subtle depth between canopy layers. Painterly, seamless tileable, no borders, no text."

Always start with "Strictly top-down bird's eye view" and always specify "Dominant color: {description} ({hex})". Adapt shapes and subject to match the terrain type.`

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
