import test from 'node:test';
import assert from 'node:assert/strict';
import {isAuthoringAsset} from '../apps/client/release-assets.js';
test('release excludes authoring reviews and prompts, preserving playable assets and licenses',()=>{
 for(const path of ['art/reviews/','art/reviews/jopa-v1/index.html','art/reviews/bozo-v1/portrait.png','art/zombies/prompt-grave-v1.json','art/roms/user-v7-prompts.txt','art/roms/ART-NOTES.md','art/aeroporto-church-v1.json','art\\reviews\\index.html'])assert.ok(isAuthoringAsset(path),path);
 for(const path of ['art/zombies/grave-v1.png','art/roms/atlas.json','art/roms/idle.png','fonts/barlow-OFL.txt','audio/music/user-tracks.json','art/LICENSE.txt','index.html','basic-attacks.html'])assert.equal(isAuthoringAsset(path),false,path);
});
