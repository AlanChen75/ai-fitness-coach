import { defineConfig } from 'vite'
import { resolve } from 'node:path'

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        deviceCheck: resolve(__dirname, 'device-check.html'),
        train: resolve(__dirname, 'train.html'),
        review: resolve(__dirname, 'review.html')
      }
    }
  }
})
