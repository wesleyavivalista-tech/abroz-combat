import {th} from '../i18n/index.js';
export class UI {
  private lifetime=new AbortController();
  dispose():void{this.lifetime.abort();}
  root = document.querySelector<HTMLDivElement>("#ui")!;
  render(html: string): void {
    this.root.innerHTML = html;
  }
  shell(body: string, footer = "ABROZ ARENAS / VOL. 01", back = true): void {
    const header = back ? `<header><div class="brand"><span class="brand-symbol"></span> ABROZ COMBAT </div><div class="build"><button class="text-button" data-action="home">← ${th('nav.menu')}</button><nav class="utility-nav"><button data-action="characters">${th('nav.fighters')}</button><button data-action="settings">${th('nav.settings')}</button></nav></div></header>` : "";
    this.render(
      `<div class="shell">${header}${body}<div class="footer"><span>${footer}</span><span>${th('shell.motto')}</span><nav class="footer-actions" aria-label="${th('nav.displaySettings')}">${back ? "" : `<button class="text-button" data-action="settings">${th('nav.settings')}</button>`}<button class="text-button" data-action="fullscreen">${th('nav.fullscreen')}</button></nav></div></div>`,
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

/** Preserve existing nodes when a frequently refreshed HUD section is unchanged. */
export function updateMarkup(element: Element, value: string): void {
  if (element.innerHTML !== value) element.innerHTML = value;
}
