import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Expose to network (allows phone access)
    port: 5173,
    allowedHosts: ['.trycloudflare.com', 'localhost', '172.20.214.157', 'run.huvadhoodhekunufulusclub.events', 'huvadhoodhekunufulusclub.events'],
  },
})

