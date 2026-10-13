import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// One IIFE file, no runtime to load: Svelte compiles away, and the pure rules
// are imported straight from the admin's src/lib through the same '@/' alias,
// so the website and the editor run one copy of each rule.
export default defineConfig({
  plugins: [svelte({ compilerOptions: { customElement: true } })],
  resolve: { alias: { '@': new URL('../src/', import.meta.url).pathname } },
  build: {
    lib: { entry: 'src/main.ts', formats: ['iife'], name: 'CampaignWidget', fileName: () => 'campaign.js' },
    target: 'es2022',
    minify: true,
  },
  test: { environment: 'happy-dom', include: ['src/**/*.test.ts'] },
});
