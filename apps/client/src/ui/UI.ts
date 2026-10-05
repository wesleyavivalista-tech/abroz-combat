export class UI {
  private lifetime=new AbortController();
  dispose():void{this.lifetime.abort();}
  root = document.querySelector<HTMLDivElement>("#ui")!;
  render(html: string): void {
    this.root.innerHTML = html;
  }
  shell(body: string, footer = "ABROZ ARENAS / VOL. 01", back = true): void {
    const header = back ? `<header><div class="brand"><span class="brand-symbol"></span> ABROZ COMBAT </div><div class="build"><button class="text-button" data-action="home">← MAIN MENU</button><nav class="utility-nav"><button data-action="characters">FIGHTERS</button><button data-action="settings">SETTINGS</button></nav></div></header>` : "";
    this.render(
      `<div class="shell">${header}${body}<div class="footer"><span>${footer}</span><span>ORIGINAL FIGHTERS. INFINITE POSSIBILITIES.</span><nav class="footer-actions" aria-label="Display and settings">${back ? "" : '<button class="text-button" data-action="settings">SETTINGS</button>'}<button class="text-button" data-action="fullscreen">⛶ FULLSCREEN</button></nav></div></div>`,
    );
  }
  onAction(callback: (action: string, element: HTMLElement) => void): void {
    this.root.addEventListener("click", (e) => {
      const element = (e.target as HTMLElement).closest<HTMLElement>(
        "[data-action]",
      );
      if (element) callback(element.dataset.action!, element);
    },{signal:this.lifetime.signal});
  }
  text(id: string, value: string): void {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }
}
