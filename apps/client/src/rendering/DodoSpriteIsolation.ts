/** Connected silhouettes, not fixed grid rectangles. Bounding boxes may overlap;
 * each frame carries only the pixels belonging to its own figure. */
export interface SpriteIsland {left:number;top:number;right:number;bottom:number;pixels:number[]}
export function isolateSprites(rgba:Uint8ClampedArray,width:number,height:number,columns:number,rows:number,seam?:{xFrom:number;y:number}):SpriteIsland[]{
 const visited=new Uint8Array(width*height),islands:SpriteIsland[]=[];
 for(let seed=0;seed<visited.length;seed++){
  if(visited[seed]||rgba[seed*4+3]<32)continue;
  const pixels=[seed];visited[seed]=1;
  let left=width,top=height,right=0,bottom=0;
  for(let cursor=0;cursor<pixels.length;cursor++){
   const p=pixels[cursor],x=p%width,y=Math.floor(p/width);
   left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    const nx=x+dx,ny=y+dy,n=ny*width+nx;
    if(seam&&x>=seam.xFrom&&nx>=seam.xFrom&&(y<seam.y)!==(ny<seam.y))continue;
    if(nx<0||nx>=width||ny<0||ny>=height||visited[n]||rgba[n*4+3]<32)continue;
    visited[n]=1;pixels.push(n);
   }
  }
  if(pixels.length>=8)islands.push({left,top,right,bottom,pixels});
 }
 const count=columns*rows;
 const figures=islands.sort((a,b)=>b.pixels.length-a.pixels.length).slice(0,count);
 if(figures.length!==count)throw new Error(`Expected ${count} isolated poses, found ${figures.length}`);
 // Group by visual row, then by horizontal location. Unequal pose heights are allowed.
 figures.sort((a,b)=>(a.top+a.bottom)-(b.top+b.bottom));
 const ordered:SpriteIsland[]=[];
 for(let row=0;row<rows;row++)ordered.push(...figures.slice(row*columns,(row+1)*columns).sort((a,b)=>(a.left+a.right)-(b.left+b.right)));
 return ordered;
}
