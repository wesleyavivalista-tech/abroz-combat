import type {MatchPerformance} from '../../../packages/shared/matchPerformance.js';
export class MatchPerformanceTracker {
 private current?:MatchPerformance;private previous?:number;private previousRender?:number;private previousPing?:number;private pingTotal=0;private jitterTotal=0;private wasStalled=false;
 private hidden=false;private unfocused=false;
 readonly recent:MatchPerformance[]=[];
 begin():void {
  if(this.current){this.recent.push({...this.current});if(this.recent.length>3)this.recent.shift();}
  this.current={samples:0,elapsedMs:0,fps:0,longFrames:0,longestFrameMs:0,pingSamples:0,pingMeanMs:0,pingMaxMs:0,pingJitterMs:0,stallCount:0,stalledMs:0,hiddenMs:0,unfocusedMs:0,rollbackCount:0,rollbackMaxFrames:0,inputBacklogFrames:0};
  this.previous=undefined;this.previousRender=undefined;this.previousPing=undefined;this.pingTotal=this.jitterTotal=0;this.wasStalled=false;this.hidden=this.unfocused=false;
 }
 observe(now:number,stalled:boolean,hidden:boolean,unfocused:boolean,rollbacks:number,rollbackFrames:number,backlog:number,countFrame=true):void {
  const s=this.current;if(!s||!Number.isFinite(now))return;
  if(this.previous!==undefined){const dt=Math.max(0,now-this.previous);if(countFrame&&this.previousRender!==undefined){const renderDt=Math.max(0,now-this.previousRender);s.samples++;if(renderDt>34)s.longFrames++;s.longestFrameMs=Math.max(s.longestFrameMs,renderDt);}s.elapsedMs+=dt;s.fps=s.elapsedMs?s.samples*1000/s.elapsedMs:0;if(this.wasStalled)s.stalledMs+=dt;if(this.hidden)s.hiddenMs+=dt;if(this.unfocused)s.unfocusedMs+=dt;}
  if(stalled&&!this.wasStalled)s.stallCount++;
  if(countFrame)this.previousRender=now;
  this.previous=now;this.wasStalled=stalled;this.hidden=hidden;this.unfocused=unfocused;
  s.rollbackCount=rollbacks;s.rollbackMaxFrames=Math.max(s.rollbackMaxFrames,rollbackFrames);s.inputBacklogFrames=Math.max(0,backlog);
 }
 visibility(now:number,hidden:boolean,unfocused:boolean):void {const s=this.current;if(s&&this.previous!==undefined)this.observe(now,this.wasStalled,hidden,unfocused,s.rollbackCount,s.rollbackMaxFrames,s.inputBacklogFrames,false);}
 ping(ms:number):void {const s=this.current;if(!s||!Number.isFinite(ms)||ms<0||ms>60000)return;s.pingSamples++;this.pingTotal+=ms;s.pingMeanMs=this.pingTotal/s.pingSamples;s.pingMaxMs=Math.max(s.pingMaxMs,ms);if(this.previousPing!==undefined)this.jitterTotal+=Math.abs(ms-this.previousPing);s.pingJitterMs=s.pingSamples>1?this.jitterTotal/(s.pingSamples-1):0;this.previousPing=ms;}
 snapshot():MatchPerformance|undefined{return this.current?{...this.current}:undefined;}
}
export const matchPerformance=new MatchPerformanceTracker();
