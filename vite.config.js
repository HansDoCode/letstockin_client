import { defineConfig } from 'vite';

// Keep the documented workspace-level env files available to Vite. During
// local development, .env.local overrides .env; production deployments that
// do not include .env.local continue to use .env or hosting-provided values.
// Only VITE_* variables are exposed by Vite to browser code.
export default defineConfig({
  envDir: '..'
});
