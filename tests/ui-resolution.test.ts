import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
import ts from 'typescript';
import {visualPresets} from '../apps/client/src/rendering/StageLighting.js';
// Exercise the actual resize method without constructing WebGL or loading artwork.
const source=ts.createSourceFile('SceneRenderer.ts',readFileSync(new URL('../apps/client/src/rendering/SceneRenderer.ts',import.meta.url),'utf8'),ts.ScriptTarget.Latest,true);
const declaration=source.statements.find(s=>ts.isClassDeclaration(s)&&s.name?.text==='SceneRenderer') as ts.ClassDeclaration;
const method=declaration.members.find(m=>m.name?.getText(source)==='resize')!;
const code=ts.transpileModule(`class ResizeFixture { ${method.getText(source)} }; fixture.resize = ResizeFixture.prototype.resize;`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
for(const quality of ['low','medium','high'] as const)test(`canvas and postprocessing follow density changes within ${quality} quality cap`,()=>{
 let ratio=1,composerRatio=1,changes=0,updates=0;
 const parent={clientWidth:1366,clientHeight:768};
 const fixture={environment:{quality},renderer:{domElement:{parentElement:parent,get clientWidth(){return parent.clientWidth;},get clientHeight(){return parent.clientHeight;}},getPixelRatio:()=>ratio,setPixelRatio:(n:number)=>{ratio=n;changes++;},setSize:(w:number,h:number,css:boolean)=>{assert.equal(w,parent.clientWidth);assert.equal(h,parent.clientHeight);assert.equal(css,false);}},composer:{setPixelRatio:(n:number)=>{composerRatio=n;},setSize:(w:number,h:number)=>{assert.equal(w,parent.clientWidth);assert.equal(h,parent.clientHeight);}},camera:{aspect:0,updateProjectionMatrix:()=>updates++},resize:()=>{}};
 const context=createContext({fixture,visualPresets,devicePixelRatio:1});runInContext(code,context);
 for(const dpr of [1,1.25,1.5,2,3,1]){
  context.devicePixelRatio=dpr;fixture.resize();assert.equal(ratio,Math.min(dpr,visualPresets[quality].dpr));assert.equal(composerRatio,ratio);
  const before=changes;fixture.resize();assert.equal(changes,before,'unchanged density must not recreate render targets');
 }
 for(const [w,h] of [[1920,1080],[1366,768],[1440,900],[2560,1440],[3440,1440],[960,540]]){
  parent.clientWidth=w;parent.clientHeight=h;fixture.resize();assert.equal(fixture.camera.aspect,w/h);
 }
 assert.equal(updates,18);
});
