import { defineConfig } from 'vite'
import { resolve } from 'node:path'

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        exercises: resolve(__dirname, 'exercises.html'),
        more: resolve(__dirname, 'more.html'),
        deviceCheck: resolve(__dirname, 'device-check.html'),
        train: resolve(__dirname, 'train.html'),
        demo: resolve(__dirname, 'demo.html'),
        review: resolve(__dirname, 'review.html')
      }
    }
  }
})
