import { defineConfig } from 'vite';

// Keep the documented workspace-level .env available to the client build.
// Only VITE_* variables are exposed by Vite to browser code.
export default defineConfig({
  envDir: '..'
});
