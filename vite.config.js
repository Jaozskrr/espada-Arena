import { defineConfig } from 'vite';

export default defineConfig({
    base: '/espada-Arena/', // Correct base path for GitHub Pages repository subfolder
    build: {
        outDir: 'dist',
        assetsDir: 'assets',
    }
});
