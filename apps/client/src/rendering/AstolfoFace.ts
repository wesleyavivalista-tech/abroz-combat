import type {Frame} from './DodoRenderer.js';

type Mouth={x:number;y:number};
type Point=readonly [number,number]|null;
const anchors=new WeakMap<Frame,Mouth>();
/** Authored mouth centres in the source atlas, before sprite isolation.
 * Never infer them from skin colour: ears, hands and disconnected face pixels
 * are not reliable facial landmarks. A covered mouth has no overlay. */
const atlasMouths:Record<string,readonly Point[]>={
 'neutral-poses-v1':[null,[711,374],null,null,[711,951]],
 'combat-1':[[171,94],[483,103],[728,98],null,[128,427],[477,511],[774,408],[1117,433],null,null,[795,711],[1110,805],[172,1019],[487,1021],[797,1010],[1108,1022]],
 'combat-2':[[175,99],[500,104],[747,86],null,[108,411],[448,493],[809,391],null,null,null,[789,706],[1121,809],[163,1018],[484,1016],[787,1016],[1094,1020]],
 'walk-1':[[298,86],[600,86]],
 'walk-2':[[225,90],[574,87]],
 'walk-far-v2':[[248,80],[614,80],null,[248,443],[614,443]],
 'movement-v2':[[343,156],[815,160],[1202,147],[1644,150],[343,598],[815,601],[1202,582],[1644,587]],
};
export function registerAstolfoMouths(name:string,frames:Frame[]){
 atlasMouths[name]?.forEach((point,i)=>{const frame=frames[i];if(point&&frame)anchors.set(frame,{x:point[0]-(frame.sourceLeft??0)+2,y:point[1]-(frame.sourceTop??0)+2});});
}
export function astolfoMouth(frame:Frame){return anchors.get(frame);}
