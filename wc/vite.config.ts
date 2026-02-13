import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'WestMarchesComponents',
      fileName: 'westmarches',
      formats: ['es']
    },
    outDir: '../public/wc',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: 'westmarches.js'
      }
    }
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production')
  }
})
