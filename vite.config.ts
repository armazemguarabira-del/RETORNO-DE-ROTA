import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Dynamically compute base URL:
// In GitHub Actions environment: /<repo-name>/ (e.g. /RETORNO-DE-ROTA-PRINCIPAL-/)
// In local / Cloud Run container / preview: ./
const base = process.env.GITHUB_REPOSITORY
  ? `/${process.env.GITHUB_REPOSITORY.split('/')[1]}/`
  : './';

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
});
