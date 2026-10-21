// React front end lives in client/. `npm run build` writes client/dist, which Express serves.
// In development Vite runs on :5173 and forwards /api calls to the Express server.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'client',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': `http://localhost:${process.env.PORT || 3000}` },
  },
  build: { outDir: 'dist', emptyOutDir: true },
});
