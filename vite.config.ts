import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => {
  const base = process.env.VITE_APP_BASE_PATH || (command === 'build' ? '/ai-repair/' : '/')
  if (!/^\/(?:[^?#]*\/)?$/.test(base) || base.startsWith('//')) throw new Error('VITE_APP_BASE_PATH must be an absolute path with a trailing slash')
  return {
    // Supply public configuration explicitly, without loading local secret files.
    envDir: false,
    base,
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        [`${base}api`]: {
          rewrite: (path) => base === '/' ? path : path.slice(base.length - 1),
          target: 'http://localhost:8080',
          changeOrigin: true,
        },
      },
    },
  }
})
