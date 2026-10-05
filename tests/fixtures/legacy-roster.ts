import { registerCharacter } from '../../packages/game-core/characters/registry.js';
import { character as a } from '../../packages/game-core/characters/prototype-a/character.js';
import { character as b } from '../../packages/game-core/characters/prototype-b/character.js';
// Retired prototypes inherited cancel targets that never existed; remove inert fixture entries.
for(const c of [a,b])for(const m of Object.values(c.moves))m.cancelRules=m.cancelRules.filter(id=>Object.hasOwn(c.moves,id));
registerCharacter(a);registerCharacter(b);
