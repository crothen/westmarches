import { ref, onMounted, onUnmounted } from 'vue'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase/config'

export function useMapData() {
  const hexData = ref<Record<string, any>>({})
  const terrainConfig = ref<Record<string, any>>({})
  const tagsConfig = ref<Record<string, any>>({})
  const loading = ref(true)
  let unsubMap: (() => void) | null = null
  let unsubTerrain: (() => void) | null = null
  let unsubTags: (() => void) | null = null

  onMounted(() => {
    // Listen to map data
    unsubMap = onSnapshot(doc(db, 'maps', 'world'), (snap) => {
      if (snap.exists()) {
        hexData.value = snap.data()?.hexes || {}
      }
      loading.value = false
    })

    // Listen to terrain config
    unsubTerrain = onSnapshot(doc(db, 'config', 'terrain'), (snap) => {
      if (snap.exists()) {
        terrainConfig.value = snap.data() || {}
      }
    })

    // Listen to tags config
    unsubTags = onSnapshot(doc(db, 'config', 'tags'), (snap) => {
      if (snap.exists()) {
        tagsConfig.value = snap.data() || {}
      }
    })
  })

  onUnmounted(() => {
    unsubMap?.()
    unsubTerrain?.()
    unsubTags?.()
  })

  return { hexData, terrainConfig, tagsConfig, loading }
}
