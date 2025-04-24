import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Log the configuration for debugging
console.log('Vite configuration loading...');
console.log('NODE_ENV:', process.env.NODE_ENV);

// Create configuration
const config = defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    // Removing the proxy configuration to avoid URL redirect issues
    // proxy: {
    //   '/api': {
    //     target: 'https://ai-tool.marmeto.com',
    //     changeOrigin: true,
    //   }
    // }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});

console.log('Vite configuration created:', JSON.stringify(config, null, 2));

export default config; 