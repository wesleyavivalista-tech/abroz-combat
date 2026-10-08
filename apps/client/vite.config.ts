import {readdirSync,rmSync,renameSync} from 'node:fs';
import {resolve,relative,join} from 'node:path';
import {isAuthoringAsset} from './release-assets.js';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const revisionScript=fileURLToPath(new URL('../../scripts/simulation-revision.mjs',import.meta.url));
const updateRevision=()=>execFileSync(process.execPath,[revisionScript]);
import { defineConfig } from "vite";
export default defineConfig(({mode})=>({
  plugins:[{
    name:'exclude-authoring-assets',apply:'build',
    writeBundle(options){
      const root=resolve(options.dir!);
      const prune=(directory:string)=>{for(const item of readdirSync(directory,{withFileTypes:true})){
        const path=join(directory,item.name),name=relative(root,path);
        if(isAuthoringAsset(name+(item.isDirectory()?'/':'')))rmSync(path,{recursive:true,force:true});
        else if(item.isDirectory())prune(path);
      }};
      prune(root);
      if(mode==='desktop')renameSync(join(root,'play.html'),join(root,'index.html'));
    },
  },{name:'simulation-revision',buildStart(){updateRevision();},configureServer(server){server.watcher.on('change',file=>{if(/packages\/(game-core|networking)\/|packages\/shared\/protocol\.ts$/.test(file))updateRevision();});}}],
  root: "apps/client",
  server: { host: "0.0.0.0", port: 5173, strictPort: true },
  build: { outDir: mode==='desktop'?"../../dist-desktop":"../../dist", emptyOutDir: true, rollupOptions: { output: { manualChunks(id) {
    // Stable engine chunks can be cached independently from frequently edited game code.
    if(id.includes('/node_modules/three/'))return id.includes('three.core')?'three-core':'three-renderer';
    if(id.includes('/packages/game-core/'))return 'combat';
  } }, input: { main:fileURLToPath(new URL(mode==='desktop'?"./play.html":"./index.html",import.meta.url)), ...(mode==='desktop'?{}:{play:fileURLToPath(new URL('./play.html',import.meta.url)),download:fileURLToPath(new URL('./download.html',import.meta.url)),basicAttacks:fileURLToPath(new URL("./basic-attacks.html",import.meta.url))}) } } },
  envDir: "../..",
}));
