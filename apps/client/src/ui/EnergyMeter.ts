import type {CharacterDefinition} from '../../../../packages/game-core/types.js';
import {escapeMarkup} from './FighterPresentation.js';
/** Group shared costs so overlapping specials use one readable marker. */
export function energyThresholds(character:CharacterDefinition){
 const groups=new Map<number,string[]>();
 for(const id of [...character.specialButtons,...character.superButtons]){
  const move=character.moves[id],cost=move.meterCost;
  if(cost<=0||cost>100)continue;
  const names=groups.get(cost)??[];
  const name=move.displayName??id;if(!names.includes(name))names.push(name);
  groups.set(cost,names);
 }
 return [...groups].sort(([a],[b])=>a-b).map(([cost,names])=>({cost,label:names.join(' / ')}));
}
export function energyMeter(character:CharacterDefinition,seat:number):string{
 return `<div class="meter energy-meter" id="energy${seat}" role="meter" aria-label="Player ${seat+1} energy" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i id="meter${seat}"></i>${energyThresholds(character).map(({cost,label})=>`<span class="energy-threshold" data-cost="${cost}" data-label="${escapeMarkup(label)}" style="--threshold:${cost}%" title="${escapeMarkup(label)} · ${cost} energy"><b aria-hidden="true"></b></span>`).join('')}</div>`;
}
