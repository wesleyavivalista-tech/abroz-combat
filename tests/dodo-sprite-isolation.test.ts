import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isolateSprites} from '../apps/client/src/rendering/DodoSpriteIsolation.js';
test('Dodo frames follow whole silhouettes crossing grid lines and exclude overlapping neighboring bounds',()=>{
 const w=40,h=20,data=new Uint8ClampedArray(w*h*4);
 const pixel=(x:number,y:number)=>data[(y*w+x)*4+3]=255;
 for(let y=2;y<18;y++)for(let x=2;x<6;x++)pixel(x,y);
 for(let x=2;x<27;x++)pixel(x,2); // Arm crosses nominal halfway cell boundary.
 for(let y=6;y<18;y++)for(let x=23;x<37;x++)pixel(x,y);
 const [left,right]=isolateSprites(data,w,h,2,1);
 assert.equal(left.right,26);assert.equal(right.left,23);
 assert.ok(left.pixels.includes(2*w+26));assert.ok(!left.pixels.includes(8*w+25));
 assert.equal(new Set([...left.pixels,...right.pixels]).size,left.pixels.length+right.pixels.length);
});
