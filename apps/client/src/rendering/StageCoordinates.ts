import {trainingRoom} from '../../../../packages/game-core/stages/registry.js';
import type {StageDefinition} from '../../../../packages/game-core/types.js';
export let renderStage=trainingRoom;
export let arenaWidth=renderStage.width/100;
export const worldX=(x:number):number=>x/100-arenaWidth/2;
export let cameraBounds=renderStage.cameraBounds.map(worldX);
export function withRenderStage<T>(stage:StageDefinition,draw:()=>T):T{
 const previous=renderStage;
 const select=(value:StageDefinition)=>{renderStage=value;arenaWidth=value.width/100;cameraBounds=value.cameraBounds.map(worldX);};
 select(stage);try{return draw();}finally{select(previous);}
}
