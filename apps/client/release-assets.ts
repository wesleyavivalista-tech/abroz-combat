/** Authoring references stay in public/ for local review, not in distributed builds. */
export function isAuthoringAsset(relativePath:string):boolean{
 const path=relativePath.replaceAll('\\','/');
 if(path.startsWith('art/reviews/'))return true;
 if(!path.startsWith('art/'))return false;
 const name=path.slice(path.lastIndexOf('/')+1);
 return /\.(json|txt|md)$/i.test(name)&&(/prompt|generation/i.test(name)||['BRIEF.md','IMPLEMENTATION.md','ART-NOTES.md','aeroporto-church-v1.json','shopping-mall-v1.json','hose-directions-v1.txt','hose-inbetweens-v1.txt'].includes(name));
}
