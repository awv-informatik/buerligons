/* eslint-disable @typescript-eslint/ban-ts-comment */
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
// @ts-ignore
import checker from 'vite-plugin-checker'
import svgrPlugin from 'vite-plugin-svgr'
import viteTsconfigPaths from 'vite-tsconfig-paths'

// https://vitejs.dev/config/
export default ({ mode }: { mode: string }) => {
  // How ClassCAD is reached is set in .env (a worker over WebSocket by default).
  // Mode-specific env files (.env.<mode>) overlay it — `vite --mode <mode>`
  // additionally loads .env.<mode>. Used instead of inline VAR=... env prefixes,
  // which do not work on Windows (cmd.exe).
  const env = loadEnv(mode, process.cwd(), '')

  return defineConfig({
    resolve: {
      // One copy of each, the app's own: the linked buerli packages may have installs of their own next to them.
      dedupe: ['three', '@react-three/fiber', '@react-three/drei', 'react', 'react-dom', 'antd', 'styled-components'],
    },
    define: {
      CLASSCAD_WASM_KEY: JSON.stringify(env.CLASSCAD_WASM_KEY ?? ''),
      CLASSCAD_TOKEN: JSON.stringify(env.CLASSCAD_TOKEN ?? ''),
      CLASSCAD_KEY_URL: JSON.stringify(env.CLASSCAD_KEY_URL ?? ''),
      SOCKETIO_URL: JSON.stringify(env.SOCKETIO_URL ?? ''),
      WSCLIENT_URL: JSON.stringify(env.WSCLIENT_URL ?? ''),
      SESSION_URL: JSON.stringify(env.CLASSCAD_SESSION_URL ?? ''),
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
