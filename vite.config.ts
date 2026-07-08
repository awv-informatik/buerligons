/* eslint-disable @typescript-eslint/ban-ts-comment */
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
// @ts-ignore
import checker from 'vite-plugin-checker'
import svgrPlugin from 'vite-plugin-svgr'
import viteTsconfigPaths from 'vite-tsconfig-paths'

// https://vitejs.dev/config/
export default () => {
  const env = loadEnv('', process.cwd(), '')

  return defineConfig({
    define: {
      'CLASSCAD_WASM_KEY': JSON.stringify(env.CLASSCAD_WASM_KEY ?? ''),
      'SOCKETIO_URL': JSON.stringify(env.SOCKETIO_URL ?? ''),
      'WSCLIENT_URL': JSON.stringify(env.WSCLIENT_URL ?? ''),
    },
    build: {
      outDir: './build',
    },
    plugins: [
      react(),
      checker({
        overlay: { initialIsOpen: false },
        typescript: true,
        eslint: {
          lintCommand: 'eslint "./src/**/*.{ts,tsx}"',
        },
      }),
      viteTsconfigPaths(),
      svgrPlugin(),
    ],
    css: {
      preprocessorOptions: {
        less: {
          math: 'always',
          relativeUrls: true,
          javascriptEnabled: true,
        },
      },
    },
  })
}
