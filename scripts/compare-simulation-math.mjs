import {build} from 'vite';
import process from 'node:process';
import console from 'node:console';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const dir=mkdtempSync(join(tmpdir(),'afterglow-math-'));
try{
 const entry=join(dir,'trace.ts');writeFileSync(entry,`import {GameSimulation} from ${JSON.stringify(resolve('packages/game-core/simulation/GameSimulation.ts'))};
 const result=[];for(const move of ['straight','straight2','straight3']){const g=new GameSimulation(['roms','gut'],true);const [f,d]=g.state.fighters;Object.assign(f,{x:700,move,moveFrame:0,state:'SpecialMove',meter:100});d.x=820;for(let i=0;i<1801;i++){if(i===91)g.state.hitstop=8;g.step([i%120<20?2:i%120>100?1:0,0]);result.push(g.snapshot());}}console.log(JSON.stringify(result));`);
 const results=[];
 for(const native of [true,false]){
  const bundle=await build({configFile:false,logLevel:'silent',plugins:native?[{name:'native-reference',enforce:'pre',transform(_,id){if(id.endsWith('/DeterministicMath.ts'))return 'export const deterministicHypot=Math.hypot,deterministicSin=Math.sin,deterministicCos=Math.cos;';}}]:[],build:{write:false,minify:false,lib:{entry,name:'Trace',formats:['iife']}}});
  const file=join(dir,'trace.js');writeFileSync(file,(Array.isArray(bundle)?bundle[0]:bundle).output.find(o=>o.type==='chunk').code);results.push(JSON.parse(execFileSync(process.execPath,[file],{maxBuffer:128*1024*1024}).toString()));
 }
 let max=0,changed=0;
 function compare(a,b){if(typeof a==='number'&&typeof b==='number'){const delta=Math.abs(a-b);assert.ok(delta<1e-9,`Numeric change ${delta}`);max=Math.max(max,delta);if(delta)changed++;return;}if(a&&typeof a==='object'){assert.deepEqual(Object.keys(a),Object.keys(b));for(const k of Object.keys(a))compare(a[k],b[k]);return;}assert.equal(a,b);}
 compare(...results);console.log(`Native/shared math: discrete state identical across 5,403 frames; ${changed} numeric differences, maximum ${max}.`);
}finally{rmSync(dir,{recursive:true,force:true});}
