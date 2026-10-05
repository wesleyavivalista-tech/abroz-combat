import {test} from 'node:test';
import assert from 'node:assert/strict';
import {labelSpritePixels} from '../apps/client/src/rendering/SpriteIsolation.js';
test('overlapping sprite crops exclude neighboring artwork without shortening limbs',()=>{
 const width=20,height=10,alpha=new Uint8Array(width*height);
 // An L-shaped left pose extends over the upper part of the right pose's crop.
 for(let y=1;y<=8;y++)for(let x=1;x<=3;x++)alpha[y*width+x]=255;
 for(let x=1;x<=12;x++)alpha[width+x]=255;
 for(let y=3;y<=8;y++)for(let x=9;x<=17;x++)alpha[y*width+x]=255;
 const owner=labelSpritePixels(alpha,width,height,[[1,1,12,8],[9,3,17,8]]);
 assert.equal(owner[width+12],1);assert.equal(owner[4*width+10],2);
 let contamination=0;
 for(let y=1;y<=8;y++)for(let x=1;x<=12;x++)if(alpha[y*width+x]&&owner[y*width+x]!==1)contamination++;
 assert.ok(contamination>0,'old rectangular crop included part of the other fighter');
 assert.equal([...owner].filter(n=>n===1).length,33);
 assert.equal([...owner].filter(n=>n===2).length,54);
});
test('separate flame particles remain with their pose and transparent padding stays empty',()=>{
 const alpha=new Uint8Array(100);alpha[22]=254;alpha[23]=254;alpha[42]=254;alpha[28]=254;alpha[58]=254;
 const owners=labelSpritePixels(alpha,10,10,[[1,1,4,6],[7,1,9,6]]);
 assert.equal(owners[42],1);assert.equal(owners[58],2);assert.equal(owners[0],0);
});
