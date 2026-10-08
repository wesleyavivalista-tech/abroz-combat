import type {StageDefinition} from '../../../../packages/game-core/types.js';
import type {FighterSkin} from '../../../../packages/game-core/characters/skins.js';
import {en, type MessageKey} from './en.js';
import {t} from './index.js';
import {roundName, type Championship} from '../../../../packages/game-core/tournament/Championship.js';
import {eliminationFormat, type EliminationState} from '../../../../packages/game-core/simulation/EliminationSystem.js';

/** Translate display content without changing serialized stage or skin identities. */
export function arenaName(stage: StageDefinition): string {
  const key = `arena.${stage.theme}.name`;
  return Object.hasOwn(en,key) ? t(key as MessageKey) : stage.name;
}
export function skinName(fighterId: string, skin: FighterSkin): string {
  const key = `skin.${fighterId}.${skin.id}`;
  return Object.hasOwn(en,key) ? t(key as MessageKey) : skin.name;
}

export function championshipRoundName(bracket: Championship, round: number): string {
  const label=roundName(bracket,round);
  const keys:Record<string,MessageKey>={Final:'championship.round.final',Semifinals:'championship.round.semi',Quarterfinals:'championship.round.quarter','Round of 16':'championship.round.sixteen'};
  return Object.hasOwn(keys,label)?t(keys[label]):label;
}

export function eliminationFormatLabel(state: EliminationState): string {
  const label=eliminationFormat(state);
  const keys:Record<string,MessageKey>={'FIRST OUT':'elimination.format.first','FINAL 1v1':'elimination.format.final','1v1 · LOSER OUT':'elimination.format.duel','FREE-FOR-ALL · WINNER SAFE':'elimination.format.ffa'};
  return Object.hasOwn(keys,label)?t(keys[label]):label;
}

/** Existing simulation messages stay byte-for-byte unchanged in snapshots. */
export function eliminationMessage(message: string): string {
  const fixed:Record<string,MessageKey>={
    'Competition ended by forfeit':'elimination.message.forfeit',
    'Simultaneous elimination · tied players fight to decide who leaves':'elimination.message.simultaneous',
    'Draw · replay this fight':'elimination.message.draw',
  };
  if(Object.hasOwn(fixed,message))return t(fixed[message]);
  const patterns:readonly [RegExp,MessageKey,readonly string[]][]=[
    [/^(P\d+(?:, P\d+)*) withdrew · remaining players advance$/,'elimination.message.withdrawn',['players']],
    [/^(P\d+) is first out and eliminated$/,'elimination.message.first',['player']],
    [/^(P\d+) wins the competition$/,'elimination.message.winner',['player']],
    [/^(P\d+(?:, P\d+)*) are safe · losing team fights for survival$/,'elimination.message.team',['players']],
    [/^(P\d+) is safe · (P\d+) is eliminated$/,'elimination.message.safeOut',['winner','loser']],
    [/^(P\d+) is safe and sits out the next fight$/,'elimination.message.safe',['player']],
  ];
  for(const [pattern,key,fields] of patterns){const match=message.match(pattern);if(match)return t(key,Object.fromEntries(fields.map((field,i)=>[field,match[i+1]])));}
  return message;
}
