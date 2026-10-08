import {surfaceBelow} from '../../../../packages/game-core/simulation/StageCollision.js';
import type {StageDefinition,Structure} from '../../../../packages/game-core/types.js';
export type VisualQuality='low'|'medium'|'high';
export const visualPresets={low:{lights:0,dpr:1,bloom:false,rim:false,particles:.4},medium:{lights:4,dpr:1.5,bloom:true,rim:false,particles:.7},high:{lights:8,dpr:2,bloom:true,rim:true,particles:1}} as const;
export interface ArenaIllumination {
 sky:string;ground:string;key:string;keyIntensity:number;rim:string;fill:string;fillIntensity:number;
 skyIntensity:number;rimIntensity:number;direction:{x:number;y:number;z:number};
}
export interface StageLighting {
 /** Native geometry lights are authored separately from subtle flat-sprite shading. */
 geometry?:Partial<ArenaIllumination>;
 mainLightDirection:{x:number;y:number};mainLightColor:string;mainLightIntensity:number;
 ambientColor:string;ambientIntensity:number;shadowDirection:number;shadowOpacity:number;shadowSoftness:number;shadowLength:number;
 shadingStrength:number;rimColor:string;rimIntensity:number;bloomStrength:number;tint:string;tintStrength:number;
 fogColor:string;fogDistance:number;dust:number;vignette:number;grain:number;dynamicLighting:boolean;dynamicMultiplier:number;
}
export const neutralLighting:StageLighting={mainLightDirection:{x:-.5,y:-1},mainLightColor:'#fff0dd',mainLightIntensity:.8,ambientColor:'#c5d0df',ambientIntensity:.25,shadowDirection:.5,shadowOpacity:.3,shadowSoftness:.6,shadowLength:1.2,shadingStrength:.10,rimColor:'#d8e6ff',rimIntensity:.08,bloomStrength:.10,tint:'#ffffff',tintStrength:0,fogColor:'#776c61',fogDistance:18,dust:0,vignette:.06,grain:0,dynamicLighting:true,dynamicMultiplier:.7};
/** Client-only art direction: never part of deterministic match state. */
export const stageLighting:Record<string,Partial<StageLighting>>={
 'the-foundry':{mainLightColor:'#ffd5a0',ambientColor:'#a9b9d5',rimColor:'#ffcc99',rimIntensity:.12,shadowDirection:.6,bloomStrength:.12,dust:.08},
 'basketball-court':{mainLightColor:'#d2ebff',ambientColor:'#a7c9df',rimColor:'#8ac9ed',fogColor:'#526d80',shadowDirection:-.4,mainLightDirection:{x:.4,y:-1},bloomStrength:.07},
 'shopping-mall':{mainLightColor:'#ffe8ce',ambientColor:'#d4bed0',rimColor:'#e9b9df',fogColor:'#6c5a64',shadowLength:.9,bloomStrength:.14},
 'aeroporto-church':{mainLightColor:'#f4ecd9',ambientColor:'#cbd8e8',rimColor:'#bdcde6',fogColor:'#737b84',shadowLength:.8,bloomStrength:.06,vignette:.03},
};
const clamp=(n:number,min:number,max:number)=>Number.isFinite(n)?Math.max(min,Math.min(max,n)):min;
export function lightingFor(stage:StageDefinition,overrides:Partial<StageLighting>={}):StageLighting{
 const c={...neutralLighting,mainLightColor:stage.lighting?.key??neutralLighting.mainLightColor,...stageLighting[stage.id],...overrides};
 for(const key of ['ambientIntensity','shadingStrength','rimIntensity','bloomStrength','tintStrength','vignette','grain'] as const)c[key]=clamp(c[key],0,key==='grain'?.025:key==='shadingStrength'?.22:key==='vignette'?.2:.3);
 for(const key of ['mainLightColor','ambientColor','rimColor','tint','fogColor'] as const)
  if(!/^#[\da-f]{6}$/i.test(c[key]))c[key]=neutralLighting[key];
 c.mainLightDirection={x:clamp(c.mainLightDirection.x,-1,1),y:clamp(c.mainLightDirection.y,-1,1)};
 c.dust=clamp(c.dust,0,.18);c.shadowOpacity=clamp(c.shadowOpacity,0,.45);c.shadowSoftness=clamp(c.shadowSoftness,.2,1);c.shadowLength=clamp(c.shadowLength,.5,2);c.shadowDirection=clamp(c.shadowDirection,-1,1);c.mainLightIntensity=clamp(c.mainLightIntensity,0,1.5);c.dynamicMultiplier=clamp(c.dynamicMultiplier,0,1);c.fogDistance=clamp(c.fogDistance,12,60);
 return c;
}
/** The receiving surface includes horizontal limits so a shadow cannot float past an edge. */
export function visualShadowSurface(stage:StageDefinition,x:number,y:number,structures:readonly Structure[]=[]){
 let surface={height:surfaceBelow(stage,x,y),left:0,right:stage.width};
 for(const p of stage.platforms??[])if(x>=p.x&&x<=p.x+p.width&&p.y<=y&&p.y===surface.height)
  surface={height:p.y,left:p.x,right:p.x+p.width};
 for(const b of structures)if(b.phase==='built'&&b.health>0&&(b.kind==='house'||b.kind==='wall')&&x>=b.x-b.width/2&&x<=b.x+b.width/2&&b.y+b.height<=y&&b.y+b.height>surface.height)
  surface={height:b.y+b.height,left:b.x-b.width/2,right:b.x+b.width/2};
 return surface;
}
export function visualSurfaceBelow(stage:StageDefinition,x:number,y:number,structures:readonly Structure[]=[]):number{
 return visualShadowSurface(stage,x,y,structures).height;
}
export function shadowProfile(height:number,c:StageLighting,quality:VisualQuality){
 const h=Math.max(0,height)/100,fade=1/(1+h*.55);
 return {opacity:c.shadowOpacity*fade,contact:Math.max(0,1-h*5)*.16,size:Math.max(.4,1-h*.08),stretch:quality==='low'?1:c.shadowLength,offset:quality==='low'?0:c.shadowDirection*Math.min(.45,h*.12+.04),softness:Math.min(1,c.shadowSoftness+h*.1)};
}
export function readVisualQuality():VisualQuality{try{const value=localStorage.getItem('abroz-visual-quality');if(value==='low'||value==='high')return value;}catch{/* storage unavailable */}return 'medium';}

/** Preserve the established illumination of lit arena geometry at every quality level.
 * Sprite shading and optional rim effects must not disable these scene lights. */
export function arenaIlluminationFor(stage:StageDefinition,overrides:Partial<ArenaIllumination>={}):ArenaIllumination{
 const court=stage.theme==='basketball',mall=stage.theme==='mall',church=stage.theme==='church';
 const base:ArenaIllumination={
  sky:church?'#e3e7ed':mall?'#e8d8e2':court?'#b5d4ee':'#c9d4e0',
  ground:church?'#776650':mall?'#57404f':court?'#24464b':'#645347',
  key:church?'#f4ecd9':mall?'#ffe8ce':court?'#d2ebff':'#ffe0b4',
  keyIntensity:church?2.2:court?2.4:2.7,
  rim:church?'#bdcde6':mall?'#bb91ab':court?'#5b9edc':'#b6c9e2',
  fill:court?'#8de3e5':'#ffd3a1',fillIntensity:church?2:mall?3:court?3:6,
  skyIntensity:1.3,rimIntensity:1.4,direction:{x:-3,y:6,z:5},
 };
 const c={...base,...overrides};
 for(const key of ['sky','ground','key','rim','fill'] as const)if(!/^#[\da-f]{6}$/i.test(c[key]))c[key]=base[key];
 // A readable ambient floor is independent of optional sprite/post effects.
 c.skyIntensity=clamp(c.skyIntensity,.8,2);c.keyIntensity=clamp(c.keyIntensity,1.2,3.5);
 c.rimIntensity=clamp(c.rimIntensity,.3,2);c.fillIntensity=clamp(c.fillIntensity,1,6);
 c.direction={x:clamp(c.direction.x,-6,6),y:clamp(c.direction.y,3,8),z:clamp(c.direction.z,3,8)};
 return c;
}
