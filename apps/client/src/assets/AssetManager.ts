export class AssetManager {
  private lifetime=new AbortController();
  dispose():void{this.lifetime.abort();this.cache.clear();}
  cache = new Map<string, ArrayBuffer>();
  async load(
    assets: Record<string, string>,
    progress: (value: number) => void,
  ): Promise<void> {
    const urls = [...new Set(Object.values(assets))];
    progress(0);
    let done = 0;
    for (const url of urls) {
      if (!this.cache.has(url)) {
        const response = await fetch(url,{signal:this.lifetime.signal});
        if (!response.ok) throw new Error("Could not load " + url);
        this.cache.set(url, await response.arrayBuffer());
      }
      progress(++done / urls.length);
    }
    progress(1);
  }
}
