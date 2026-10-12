/** Sixteen full-body aiming poses, interleaving the original and intermediate atlases. */
export const hosePose=(angle:number):number=>((Math.round(angle/22.5)%16)+16)%16;
export const HOSE_SCALE=181/323;
export const HOSE_CELL=443.5;
const originalBaselines=[435,435,435,435,839,839,839,839];
const intermediateBaselines=[438,438,438,438,848,848,848,848];
const originalNozzles=[[428,214],[818,122],[1145,42],[1440,109],[31,621],[501,771],[1111,822],[1718,779]];
const intermediateNozzles=[[440,127],[814,40],[1040,36],[1394,110],[58,677],[525,795],[1174,808],[1735,769]];
export const hoseFrame=(angle:number)=>{
 const pose=hosePose(angle),sheet=pose%2,cell=Math.floor(pose/2);
 return {sheet,cell,baseline:(sheet?intermediateBaselines:originalBaselines)[cell],nozzle:(sheet?intermediateNozzles:originalNozzles)[cell]};
};
export function hoseVisualOrigin(angle:number):{x:number;y:number}{
 const {cell,baseline,nozzle:[x,y]}=hoseFrame(angle);
 return {x:(x-((cell%4)+.5)*HOSE_CELL)*HOSE_SCALE,y:(baseline-y)*HOSE_SCALE};
}

/** Preserve the existing collision origin; extra authored poses are cosmetic. */
export function hoseOrigin(angle:number):{x:number;y:number}{
 const pose=((Math.round(angle/45)%8)+8)%8,[x,y]=originalNozzles[pose];
 return {x:(x-((pose%4)+.5)*HOSE_CELL)*HOSE_SCALE,y:(originalBaselines[pose]-y)*HOSE_SCALE};
}
