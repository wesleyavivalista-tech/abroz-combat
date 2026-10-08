/** Central mix calibration, separate from saved player preferences. */
export const mixLevels={music:.38,combat:3.375,ui:5.5,voice:.9,ambience:.18,critical:3.375} as const;
export const duckProfiles={impact:{gain:.82,ms:260},special:{gain:.75,ms:450},ultimate:{gain:.62,ms:700},ko:{gain:.55,ms:900},voice:{gain:.50,ms:1200}} as const;
export type DuckKind=keyof typeof duckProfiles;
export class MusicDucking {
 private until=new Map<DuckKind,number>();
 request(kind:DuckKind,now:number):void{this.until.set(kind,Math.max(this.until.get(kind)??0,now+duckProfiles[kind].ms));}
 gain(now:number):number{let gain=1;for(const [kind,end] of this.until)if(end>now)gain=Math.min(gain,duckProfiles[kind].gain);else this.until.delete(kind);return gain;}
 next(now:number):number|undefined{this.gain(now);return this.until.size?Math.max(1,Math.min(...this.until.values())-now):undefined;}
 clear():void{this.until.clear();}
}
/** Measured once on decode; only active 20ms windows, so silence cannot inflate gain. */
export function sampleCalibration(buffer:Pick<AudioBuffer,'numberOfChannels'|'length'|'sampleRate'|'getChannelData'>):{gain:number;rms:number;peak:number}{
 let peak=0,energy=0,count=0;const window=Math.max(1,Math.round(buffer.sampleRate*.02));
 for(let channel=0;channel<buffer.numberOfChannels;channel++){
  const data=buffer.getChannelData(channel);
  for(let start=0;start<data.length;start+=window){let sum=0;const end=Math.min(data.length,start+window);
   for(let i=start;i<end;i++){const v=data[i];peak=Math.max(peak,Math.abs(v));sum+=v*v;}
   if(sum/(end-start)>.0001){energy+=sum;count+=end-start;}
  }
 }
 const rms=Math.sqrt(energy/Math.max(1,count));
 return {gain:rms>0?Math.min(1.8,Math.max(.65,.18/rms),.88/Math.max(.001,peak)):1,rms,peak};
}
/** Soft safety ceiling, linear below 0.8; compression does the normal peak control. */
export function safetyCurve():Float32Array<ArrayBuffer>{
 const curve=new Float32Array(4097);
 for(let i=0;i<curve.length;i++){const x=i/(curve.length-1)*2-1,a=Math.abs(x);curve[i]=Math.sign(x)*(a<=.8?a:.8+.14*(1-Math.exp(-(a-.8)/.14)));}
 return curve;
}

export function createMixProtection(c:BaseAudioContext):{compressor:DynamicsCompressorNode;safety:WaveShaperNode}{
 const compressor=c.createDynamicsCompressor();compressor.threshold.value=-6;compressor.knee.value=6;compressor.ratio.value=4;compressor.attack.value=.003;compressor.release.value=.12;
 const safety=c.createWaveShaper();safety.curve=safetyCurve();safety.oversample='2x';compressor.connect(safety);safety.connect(c.destination);
 return {compressor,safety};
}
