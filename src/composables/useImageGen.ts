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

  /**
   * Center-crop image bytes to a target aspect ratio using an offscreen canvas.
   * Returns new image bytes (PNG).
   */
  async function cropToAspectRatio(imageData: Uint8Array, mimeType: string, targetRatio: number): Promise<Blob> {
    // Load image into an HTMLImageElement
    const blob = new Blob([imageData as BlobPart], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = reject
      el.src = url
    })
    URL.revokeObjectURL(url)

    const srcW = img.naturalWidth
    const srcH = img.naturalHeight
    const srcRatio = srcW / srcH

    let cropW: number, cropH: number, cropX: number, cropY: number

    if (srcRatio > targetRatio) {
      // Source is wider than target — crop width
      cropH = srcH
      cropW = Math.round(srcH * targetRatio)
      cropX = Math.round((srcW - cropW) / 2)
      cropY = 0
    } else {
      // Source is taller than target — crop height (center slice)
      cropW = srcW
      cropH = Math.round(srcW / targetRatio)
      cropX = 0
      cropY = Math.round((srcH - cropH) / 2)
    }

    const canvas = document.createElement('canvas')
    canvas.width = cropW
    canvas.height = cropH
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH)

    // Export as PNG bytes
    const outBlob: Blob = await new Promise<Blob>((resolve) => canvas.toBlob(b => resolve(b!), 'image/png'))
    return outBlob
  }

  async function generateImage(prompt: string, storagePath: string, options?: { cropAspectRatio?: number }): Promise<string | null> {
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

      // Post-process: center-crop to target aspect ratio if requested
      let uploadData: Uint8Array | Blob = imageData
      if (options?.cropAspectRatio) {
        uploadData = await cropToAspectRatio(imageData, mimeType, options.cropAspectRatio)
        mimeType = 'image/png'
      }

      // Upload to Firebase Storage
      const ext = mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'jpg' : 'png'
      const fileRef = storageRef(storage, `${storagePath}.${ext}`)
      await uploadBytes(fileRef, uploadData, { contentType: mimeType })
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

  /**
   * Generate a focused image prompt for a session timeline entry using the text model.
   */
  async function generateEntryImagePrompt(context: {
    title: string
    description: string
    type: string
    characters: { name: string; race?: string; class?: string; appearance?: string }[]
    npcs: { name: string; race?: string; appearance?: string }[]
  }): Promise<string | null> {
    if (!apiKey) {
      error.value = 'Gemini API key not configured'
      return null
    }

    try {
      const genAI = new GoogleGenerativeAI(apiKey)
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

      const charList = context.characters.map(c => {
        const parts = [c.name]
        if (c.race) parts.push(c.race)
        if (c.class) parts.push(c.class)
        if (c.appearance) parts.push(`Appearance: ${c.appearance}`)
        return parts.join(', ')
      }).join('\n- ')

      const npcList = context.npcs.map(n => {
        const parts = [n.name]
        if (n.race) parts.push(n.race)
        if (n.appearance) parts.push(`Appearance: ${n.appearance}`)
        return parts.join(', ')
      }).join('\n- ')

      const systemPrompt = `You are an image prompt engineer for a D&D fantasy RPG campaign.
Given a session timeline entry (title, description, type, characters, NPCs), generate a concise image generation prompt.

RULES:
- Focus on ONE key visual moment from the entry — the most dramatic or interesting scene
- Include specific character appearances when provided — these are critical for visual consistency
- Style: detailed fantasy art, dramatic lighting, painterly, medieval setting
- Keep it under 200 words
- Output ONLY the prompt text, nothing else
- If the entry is long, pick the single most visually compelling moment
- Always describe the scene composition, lighting, and mood`

      const userPrompt = `Entry type: ${context.type}
Title: "${context.title}"
Description: ${context.description.substring(0, 800)}
${charList ? `\nCharacters present:\n- ${charList}` : ''}
${npcList ? `\nNPCs present:\n- ${npcList}` : ''}

Generate the image prompt.`

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        systemInstruction: { role: 'system', parts: [{ text: systemPrompt }] },
      })

      return result.response.text()?.trim() || null
    } catch (e: any) {
      console.error('Entry prompt generation failed:', e)
      error.value = e.message || 'Prompt generation failed'
      return null
    }
  }

  return { generating, error, generateImage, generateTexturePrompt, generateEntryImagePrompt }
}
