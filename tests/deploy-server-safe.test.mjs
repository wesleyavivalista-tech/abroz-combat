import {test} from 'node:test';
import assert from 'node:assert/strict';
import {guardedDeploy,deploymentArgs} from '../scripts/deploy-server-safe.mjs';
const machine=[{id:'one',version:'v1',state:'started'}];
const empty={status:'draining',rooms:0,connections:0,waitingRooms:0,activeRooms:0,activeMatches:0,resultRooms:0,contentVersion:'v1'};
async function run({inventory=()=>machine,health=()=>empty}={}){
 let deployments=0;
 try{await guardedDeploy({inventory,health,wait:async()=>{},deploy:()=>deployments++});return deployments;}
 catch(error){assert.equal(deployments,0);throw error;}
}
test('deploys only after two empty drained samples',async()=>assert.equal(await run(),1));
test('all room types, sockets, missing fields and non-drained states block deployment',async()=>{
 for(const key of ['rooms','connections','waitingRooms','activeRooms','activeMatches','resultRooms']){
  await assert.rejects(run({health:()=>({...empty,[key]:1})}));
  await assert.rejects(run({health:()=>({...empty,[key]:undefined})}));
 }
 await assert.rejects(run({health:()=>({...empty,status:'ok'})}));
});
test('failures, topology changes and newly observed activity block deployment',async()=>{
 await assert.rejects(run({inventory:()=>[]}));
 await assert.rejects(run({inventory:()=>[...machine,...machine]}));
 await assert.rejects(run({health:()=>{throw Error('timeout');}}));
 let n=0;await assert.rejects(run({health:()=>++n===1?empty:{...empty,connections:1}}));
 n=0;await assert.rejects(run({inventory:()=>++n===1?machine:[{...machine[0],version:'v2'}]}));
 n=0;await assert.rejects(run({health:()=>++n===1?empty:{...empty,contentVersion:'v2'}}));
});
test('requires immutable same-app image and explicit config',()=>{
 const image='registry.fly.io/abroz-combat@sha256:'+'a'.repeat(64);
 assert.ok(deploymentArgs('abroz-combat',image,'deploy/local/fly.toml').includes('--ha=false'));
 for(const bad of ['registry.fly.io/other@sha256:'+'a'.repeat(64),'registry.fly.io/abroz-combat:latest'])assert.throws(()=>deploymentArgs('abroz-combat',bad,'config'));
 assert.throws(()=>deploymentArgs('abroz-combat',image,''));
});
