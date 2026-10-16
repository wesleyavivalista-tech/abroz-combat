import {test} from 'node:test';
import assert from 'node:assert/strict';
import {OnlineDiagnostics} from '../apps/client/src/onlineDiagnostics.js';
import type {LobbyClient} from '../apps/client/src/network.js';
import {RollbackManager} from '../packages/networking/RollbackManager.js';
import {GameSimulation,hashState} from '../packages/game-core/simulation/GameSimulation.js';
test('online diagnostics are opt-in, read-only, throttled and removed on disposal',()=>{
 const peer=new RollbackManager(new GameSimulation(),0),network={ping:80,serverTiming:{processingMs:.1,simulationStepMeanMs:.3,simulationStepMaxMs:2},socket:{bufferedAmount:0}} as LobbyClient;
 new OnlineDiagnostics(false).update(0,peer,network,60); // No document is needed when disabled.
 let appended=0,removed=false;const panel={hidden:false,textContent:'',style:{cssText:''},setAttribute(){},remove(){removed=true;}};
 const old=Object.getOwnPropertyDescriptor(globalThis,'document');
 Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>panel,body:{append:()=>appended++}}});
 try{
  const hud=new OnlineDiagnostics(true),hash=hashState(peer.simulation.state);hud.update(0,peer,network,60);
  assert.equal(appended,1);assert.match(panel.textContent,/RTT 80 ms/);assert.match(panel.textContent,/unavailable/);assert.doesNotMatch(panel.textContent,/NaN/);
  hud.update(10,peer,network,30);assert.match(panel.textContent,/FPS 60/);
  hud.update(300,peer,network,30);assert.match(panel.textContent,/FPS 30/);
  assert.equal(hashState(peer.simulation.state),hash);hud.update(310,undefined,network,60);assert.equal(panel.hidden,true);
  hud.dispose();assert.equal(removed,true);
 }finally{if(old)Object.defineProperty(globalThis,'document',old);else Reflect.deleteProperty(globalThis,'document');}
});
