import { ref } from 'vue'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from '../firebase/config'

const apiKey = import.meta.env.VITE_GEMINI_API_KEY

export function useImageGen() {
  const generating = ref(false)
  const error = ref<string | null>(null)

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
        model: 'gemini-2.0-flash',
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

  return { generating, error, generateImage }
}
