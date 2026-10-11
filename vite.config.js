import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    env: {
      // Email OTP is the primary panel by default (unset => ON). The flag is
      // pinned explicitly here for clarity; the confirmation-LINK rollback is
      // covered by verifyEmailLinkMode.test.jsx, which stubs the flag to
      // "false" per case.
      VITE_OTP_ENABLED: 'true',
    },
  },
})
