import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `base: './'` makes every asset URL relative, so the build works when
// served from a GitHub Pages repository subpath (e.g. /my-repo/).
export default defineConfig({
  base: './',
  plugins: [react()],
});
