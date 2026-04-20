import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  base: './', // 设为相对路径以完美兼容 GitHub Pages 子目录等任意部署环境
  plugins: [
    vue(),
    tailwindcss(),
  ],
})
