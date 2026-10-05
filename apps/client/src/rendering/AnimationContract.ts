export type AtlasFrame=readonly number[];
export function validateAtlasFrames(frames:readonly AtlasFrame[],width:number,height:number):void{
 if(!frames.length||width<=0||height<=0)throw new Error('Empty animation atlas');
 frames.forEach((b,i)=>{
  if(b.length<4||b.some(n=>!Number.isFinite(n))||b[2]<=b[0]||b[3]<=b[1])throw new Error(`Invalid animation frame ${i}: ${JSON.stringify(b)} (${width}×${height})`);
  // Some authored frames intentionally overhang their nominal cells, but not the image.
  if(b[0]<0||b[1]<0||b[2]>width||b[3]>height)throw new Error(`Animation frame ${i} is outside the atlas`);
 });
}
export interface AnimationManifest{actions:Record<string,readonly number[]>;frameCount:number;attachments?:Record<string,readonly [number,number]>;}
export function validateAnimationManifest(manifest:AnimationManifest,required:readonly string[]):void{
 for(const action of required){
  const frames=manifest.actions[action];
  if(!frames?.length||frames.some(i=>!Number.isInteger(i)||i<0||i>=manifest.frameCount))throw new Error(`Missing or invalid animation: ${action}`);
 }
 for(const [name,point] of Object.entries(manifest.attachments??{}))if(point.some(n=>!Number.isFinite(n)))throw new Error(`Invalid attachment ${name}`);
}
/** Convert an authored attachment pixel to an offset from a shared gameplay origin. */
export function attachmentOffset(bounds:AtlasFrame,pixel:readonly [number,number],target:readonly [number,number],scale:number){
 return {x:target[0]-(pixel[0]-(bounds[0]+bounds[2])/2)*scale,y:target[1]-((bounds[1]+bounds[3])/2-pixel[1])*scale};
}
