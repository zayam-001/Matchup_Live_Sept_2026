import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(() => {
    return {
      // Dev server on this machine only; set VITE_HOST=0.0.0.0 to test from a phone on the same Wi-Fi.
      server: {
        port: 3000,
        host: process.env.VITE_HOST || '127.0.0.1',
      },
      preview: {
        host: process.env.VITE_HOST || '127.0.0.1',
      },
      plugins: [
        react(),
        tailwindcss()
      ],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
