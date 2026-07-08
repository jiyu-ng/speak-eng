import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages 프로젝트 사이트: https://jiyu-ng.github.io/speak-eng/
export default defineConfig({
  base: '/speak-eng/',
  plugins: [react()],
});
