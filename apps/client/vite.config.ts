import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const revisionScript=fileURLToPath(new URL('../../scripts/simulation-revision.mjs',import.meta.url));
const updateRevision=()=>execFileSync(process.execPath,[revisionScript]);
import { defineConfig } from "vite";
export default defineConfig({
  plugins:[{name:'simulation-revision',buildStart(){updateRevision();},configureServer(server){server.watcher.on('change',file=>{if(/packages\/(game-core|networking)\/|packages\/shared\/protocol\.ts$/.test(file))updateRevision();});}}],
  root: "apps/client",
  server: { host: "0.0.0.0", port: 5173, strictPort: true },
  build: { outDir: "../../dist", emptyOutDir: true, rollupOptions: { input: { main:fileURLToPath(new URL("./index.html",import.meta.url)), basicAttacks:fileURLToPath(new URL("./basic-attacks.html",import.meta.url)) } } },
  envDir: "../..",
});
