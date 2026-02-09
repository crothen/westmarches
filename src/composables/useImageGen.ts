import { ref } from 'vue'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage, auth } from '../firebase/config'

const FUNCTION_URL = 'https://us-central1-westmarches-dnd.cloudfunctions.net/generateImage'

async function callGenerateImage(prompt: string): Promise<{ success: boolean; image: { mimeType: string; data: string } }> {
  const user = auth.currentUser
  if (!user) throw new Error('Not authenticated')
  
  const token = await user.getIdToken()
  const response = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ prompt }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error.error || `HTTP ${response.status}`)
  }

  const data = await response.json()
  return data.result
}

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
   * Note: This still uses client-side API key for text generation (lower risk).
   */
  async function generateTexturePrompt(terrainName: string, fallbackColor: string): Promise<string | null> {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY
    if (!apiKey) {
      error.value = 'Gemini API key not configured'
      return null
    }

    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai')
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
   * Load a Uint8Array image into an HTMLImageElement.
   */
  function loadImage(imageData: Uint8Array, mimeType: string): Promise<HTMLImageElement> {
    const blob = new Blob([imageData as BlobPart], { type: mimeType })
    const url = URL.createObjectURL(blob)
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => { URL.revokeObjectURL(url); resolve(el) }
      el.onerror = (e) => { URL.revokeObjectURL(url); reject(e) }
      el.src = url
    })
  }

  /**
   * Crop image to a target aspect ratio at a given vertical position (0-1).
   * yPosition 0 = top, 0.5 = center, 1 = bottom.
   */
  async function cropToAspectRatio(
    imageData: Uint8Array, mimeType: string, targetRatio: number, yPosition = 0.5
  ): Promise<Blob> {
    const img = await loadImage(imageData, mimeType)
    const srcW = img.naturalWidth
    const srcH = img.naturalHeight

    // Always use full width, crop height
    const cropW = srcW
    const cropH = Math.round(srcW / targetRatio)
    const maxY = srcH - cropH
    const cropY = Math.round(Math.max(0, Math.min(maxY, yPosition * maxY)))

    const canvas = document.createElement('canvas')
    canvas.width = cropW
    canvas.height = cropH
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, cropY, cropW, cropH, 0, 0, cropW, cropH)

    return new Promise<Blob>((resolve) => canvas.toBlob(b => resolve(b!), 'image/png'))
  }

  /**
   * Generate an image via Cloud Function and return the raw data (no upload).
   * Use for preview/crop workflows.
   */
  async function generateImageRaw(prompt: string): Promise<{ data: Uint8Array; mimeType: string; objectUrl: string } | null> {
    generating.value = true
    error.value = null

    try {
      const result = await callGenerateImage(prompt)
      
      if (!result.success || !result.image) {
        error.value = 'No image was generated. Try a different prompt.'
        return null
      }

      const { mimeType, data: base64 } = result.image
      
      // Convert base64 to Uint8Array
      const binaryString = atob(base64)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }

      const blob = new Blob([bytes as BlobPart], { type: mimeType })
      const objectUrl = URL.createObjectURL(blob)
      
      return { data: bytes, mimeType, objectUrl }
    } catch (e: any) {
      console.error('Image generation failed:', e)
      error.value = e.message || 'Image generation failed'
      return null
    } finally {
      generating.value = false
    }
  }

  /**
   * Upload image data (Uint8Array or Blob) to Firebase Storage and return the URL.
   */
  async function uploadImageData(data: Uint8Array | Blob, mimeType: string, storagePath: string): Promise<string> {
    const ext = mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'jpg' : 'png'
    const fileRef = storageRef(storage, `${storagePath}.${ext}`)
    await uploadBytes(fileRef, data, { contentType: mimeType })
    return getDownloadURL(fileRef)
  }

  /**
   * Generate an image via Cloud Function and upload to Firebase Storage.
   */
  async function generateImage(prompt: string, storagePath: string, options?: { cropAspectRatio?: number }): Promise<string | null> {
    generating.value = true
    error.value = null

    try {
      const result = await callGenerateImage(prompt)
      
      if (!result.success || !result.image) {
        error.value = 'No image was generated. Try a different prompt.'
        return null
      }

      const { mimeType: rawMimeType, data: base64 } = result.image
      let mimeType = rawMimeType
      
      // Convert base64 to Uint8Array
      const binaryString = atob(base64)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }

      // Post-process: center-crop to target aspect ratio if requested
      let uploadData: Uint8Array | Blob = bytes
      if (options?.cropAspectRatio) {
        uploadData = await cropToAspectRatio(bytes, mimeType, options.cropAspectRatio)
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
   * Note: This still uses client-side API key for text generation (lower risk).
   */
  async function generateEntryImagePrompt(context: {
    title: string
    description: string
    type: string
    characters: { name: string; race?: string; class?: string; appearance?: string }[]
    npcs: { name: string; race?: string; appearance?: string }[]
  }): Promise<string | null> {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY
    if (!apiKey) {
      error.value = 'Gemini API key not configured'
      return null
    }

    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai')
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

  return {
    generating, error,
    generateImage, generateImageRaw, uploadImageData, cropToAspectRatio,
    generateTexturePrompt, generateEntryImagePrompt,
  }
}
