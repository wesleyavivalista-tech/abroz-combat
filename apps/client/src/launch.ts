interface InstallPrompt extends Event {prompt():Promise<unknown>;userChoice:Promise<{outcome:string}>}
let saved:string|null=null;try{saved=localStorage.getItem('abroz-language');}catch{/* Storage can be restricted. */}
const pt=saved?saved==='pt-BR':navigator.language.toLowerCase().startsWith('pt');
document.documentElement.lang=pt?'pt-BR':'en';
for(const el of document.querySelectorAll<HTMLElement>('[data-en]'))el.textContent=el.dataset[pt?'pt':'en']??el.textContent;
const button=document.querySelector<HTMLButtonElement>('#install'),status=document.querySelector<HTMLElement>('#install-status');
let prompt:InstallPrompt|null=null;
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();prompt=event as InstallPrompt;if(button)button.hidden=false;});
window.addEventListener('appinstalled',()=>{prompt=null;if(button)button.hidden=true;if(status)status.textContent=pt?'Aplicativo instalado.':'App installed.';});
button?.addEventListener('click',async()=>{if(!prompt)return;const current=prompt;prompt=null;button.disabled=true;try{await current.prompt();const choice=await current.userChoice;if(status)status.textContent=choice.outcome==='accepted'?(pt?'Instalação solicitada.':'Installation requested.'):(pt?'Você pode instalar depois pelo menu do navegador.':'You can install later from your browser menu.');}catch{if(status)status.textContent=pt?'Use o menu do navegador para instalar.':'Use your browser menu to install.';}finally{button.disabled=false;button.hidden=prompt===null;}});

export {};
