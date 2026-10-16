import type {LobbyClient} from './network.js';
import type {RollbackManager} from '../../../packages/networking/RollbackManager.js';
import type {MatchPerformance} from '../../../packages/shared/matchPerformance.js';
/** Opt-in development overlay; never changes input, simulation or render settings. */
export class OnlineDiagnostics {
 private panel?:HTMLPreElement;
 private next=0;private lastFrame=0;private lastTime=0;private match?:RollbackManager;
 constructor(private enabled:boolean){}
 update(now:number,peer:RollbackManager|undefined,network:LobbyClient,fps:number,sample?:MatchPerformance):void{
  if(!this.enabled)return;
  if(!peer){if(this.panel)this.panel.hidden=true;this.match=undefined;return;}
  if(now<this.next)return;this.next=now+250;
  if(!this.panel){this.panel=document.createElement('pre');this.panel.setAttribute('aria-label','Online performance diagnostics');this.panel.style.cssText='position:fixed;bottom:12px;left:12px;z-index:10000;pointer-events:none;background:#07121ee8;color:#c8f4ff;padding:12px;font:12px/1.4 monospace;';document.body.append(this.panel);}
  const same=peer===this.match,dt=now-this.lastTime;
  const tickRate=same&&dt>0?Math.max(0,peer.simulation.state.frame-this.lastFrame)*1000/dt:0;
  this.lastFrame=peer.simulation.state.frame;this.lastTime=now;this.match=peer;
  const server=network.serverTiming;
  this.panel.hidden=false;
  this.panel.textContent=`ONLINE DIAGNOSTICS\nRTT ${network.ping} ms | jitter ${(sample?.pingJitterMs??0).toFixed(1)} ms\nFPS ${fps.toFixed(0)} | simulation ${tickRate.toFixed(1)} Hz (target 60)\nLocal response estimate ${((peer.inputDelay)*1000/60).toFixed(1)}–${((peer.inputDelay+1)*1000/60).toFixed(1)} ms + display/device\nRollback ${peer.rollbackCount} | latest ${peer.rollbackFrames} frames\nInput backlog ${Math.max(0,peer.simulation.state.frame-peer.confirmed-1)} frames | stalls ${sample?.stallCount??0}\nServer step mean/max ${server?server.simulationStepMeanMs.toFixed(2)+' / '+server.simulationStepMaxMs.toFixed(2):'—'} ms\nServer ping-handler ${server?.processingMs.toFixed(2)??'—'} ms | send queue ${network.socket?.bufferedAmount??0} bytes\nPacket loss: unavailable (reliable WebSocket/TCP)\n${peer.stalled?'STALLED: response estimate does not apply':peer.desync}`;
 }
 dispose():void{this.panel?.remove();}
}
