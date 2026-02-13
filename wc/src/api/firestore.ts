// Firestore REST API client for Web Components

const PROJECT_ID = 'westmarches-dnd'
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`

export class FirestoreAPI {
  private token: string | null = null

  setToken(token: string | null) {
    this.token = token
  }

  private headers() {
    const h: Record<string, string> = { 'Content-Type': 'application/json' }
    if (this.token) h['Authorization'] = `Bearer ${this.token}`
    return h
  }

  // Parse Firestore document fields to JS object
  private parseFields(fields: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {}
    for (const [key, value] of Object.entries(fields)) {
      result[key] = this.parseValue(value)
    }
    return result
  }

  private parseValue(value: any): any {
    if (value.stringValue !== undefined) return value.stringValue
    if (value.integerValue !== undefined) return parseInt(value.integerValue)
    if (value.doubleValue !== undefined) return value.doubleValue
    if (value.booleanValue !== undefined) return value.booleanValue
    if (value.nullValue !== undefined) return null
    if (value.timestampValue !== undefined) return new Date(value.timestampValue)
    if (value.arrayValue !== undefined) {
      return (value.arrayValue.values || []).map((v: any) => this.parseValue(v))
    }
    if (value.mapValue !== undefined) {
      return this.parseFields(value.mapValue.fields || {})
    }
    return value
  }

  // Convert JS value to Firestore format
  private toFirestoreValue(value: any): any {
    if (value === null || value === undefined) return { nullValue: null }
    if (typeof value === 'string') return { stringValue: value }
    if (typeof value === 'number') {
      return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value }
    }
    if (typeof value === 'boolean') return { booleanValue: value }
    if (value instanceof Date) return { timestampValue: value.toISOString() }
    if (Array.isArray(value)) {
      return { arrayValue: { values: value.map(v => this.toFirestoreValue(v)) } }
    }
    if (typeof value === 'object') {
      const fields: Record<string, any> = {}
      for (const [k, v] of Object.entries(value)) {
        fields[k] = this.toFirestoreValue(v)
      }
      return { mapValue: { fields } }
    }
    return { stringValue: String(value) }
  }

  private toFirestoreFields(obj: Record<string, any>): Record<string, any> {
    const fields: Record<string, any> = {}
    for (const [key, value] of Object.entries(obj)) {
      fields[key] = this.toFirestoreValue(value)
    }
    return fields
  }

  async getDocument(collection: string, docId: string): Promise<any | null> {
    try {
      const response = await fetch(`${BASE_URL}/${collection}/${docId}`, {
        headers: this.headers()
      })
      if (!response.ok) {
        if (response.status === 404) return null
        throw new Error(`Firestore error: ${response.status}`)
      }
      const data = await response.json()
      return { id: docId, ...this.parseFields(data.fields || {}) }
    } catch (e) {
      console.error('Firestore getDocument error:', e)
      return null
    }
  }

  async listDocuments(collection: string, pageSize = 100): Promise<any[]> {
    try {
      const response = await fetch(`${BASE_URL}/${collection}?pageSize=${pageSize}`, {
        headers: this.headers()
      })
      if (!response.ok) throw new Error(`Firestore error: ${response.status}`)
      const data = await response.json()
      return (data.documents || []).map((doc: any) => {
        const pathParts = doc.name.split('/')
        const id = pathParts[pathParts.length - 1]
        return { id, ...this.parseFields(doc.fields || {}) }
      })
    } catch (e) {
      console.error('Firestore listDocuments error:', e)
      return []
    }
  }

  async createDocument(collection: string, data: Record<string, any>): Promise<any | null> {
    try {
      const response = await fetch(`${BASE_URL}/${collection}`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ fields: this.toFirestoreFields(data) })
      })
      if (!response.ok) throw new Error(`Firestore error: ${response.status}`)
      const result = await response.json()
      const pathParts = result.name.split('/')
      const id = pathParts[pathParts.length - 1]
      return { id, ...this.parseFields(result.fields || {}) }
    } catch (e) {
      console.error('Firestore createDocument error:', e)
      return null
    }
  }

  async updateDocument(collection: string, docId: string, data: Record<string, any>): Promise<boolean> {
    try {
      const updateMask = Object.keys(data).map(k => `updateMask.fieldPaths=${k}`).join('&')
      const response = await fetch(`${BASE_URL}/${collection}/${docId}?${updateMask}`, {
        method: 'PATCH',
        headers: this.headers(),
        body: JSON.stringify({ fields: this.toFirestoreFields(data) })
      })
      return response.ok
    } catch (e) {
      console.error('Firestore updateDocument error:', e)
      return false
    }
  }

  async deleteDocument(collection: string, docId: string): Promise<boolean> {
    try {
      const response = await fetch(`${BASE_URL}/${collection}/${docId}`, {
        method: 'DELETE',
        headers: this.headers()
      })
      return response.ok
    } catch (e) {
      console.error('Firestore deleteDocument error:', e)
      return false
    }
  }
}

export const firestore = new FirestoreAPI()
