import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/openai': {
        target: 'https://api.openai.com/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/openai/, ''),
      },
      '/api/anthropic': {
        target: 'https://api.anthropic.com/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/anthropic/, ''),
      },
      '/api/google': {
        target: 'https://generativelanguage.googleapis.com/v1beta',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/google/, ''),
      },
      '/api/openrouter': {
        target: 'https://openrouter.ai/api/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/openrouter/, ''),
      },
      '/api/xai': {
        target: 'https://api.x.ai/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/xai/, ''),
      },
      '/api/groq': {
        target: 'https://api.groq.com/openai/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/groq/, ''),
      },
      '/api/cerebras': {
        target: 'https://api.cerebras.ai/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/cerebras/, ''),
      },
      '/api/mistral': {
        target: 'https://api.mistral.ai/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/mistral/, ''),
      },
      '/api/cohere': {
        target: 'https://api.cohere.com/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/cohere/, ''),
      },
      '/api/together': {
        target: 'https://api.together.xyz/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/together/, ''),
      },
      '/api/replicate': {
        target: 'https://api.replicate.com/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/replicate/, ''),
      },
      '/api/huggingface': {
        target: 'https://api-inference.huggingface.co/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/huggingface/, ''),
      },
      '/api/deepseek': {
        target: 'https://api.deepseek.com/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/deepseek/, ''),
      },
      '/api/fireworks': {
        target: 'https://api.fireworks.ai/inference/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/fireworks/, ''),
      },
      '/api/githubapi': {
        target: 'https://api.github.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/githubapi/, ''),
      },
      '/api/gitlabapi': {
        target: 'https://gitlab.com/api/v4',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/gitlabapi/, ''),
      },
      '/api/sourcegraph': {
        target: 'https://sourcegraph.com/.api',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/sourcegraph/, ''),
      },
      '/api/grepapp': {
        target: 'https://grep.app/api',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/grepapp/, ''),
      },
    },
  },
})
