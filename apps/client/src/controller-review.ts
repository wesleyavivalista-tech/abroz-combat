import type {PadSample} from './input/GamepadManager.js';
const names=['Xbox Wireless Controller','DualSense Wireless Controller','Xbox Wireless Controller','USB Standard Controller','DualSense Wireless Controller','Xbox Wireless Controller','USB Standard Controller','Xbox Wireless Controller'];
const devices:PadSample[]=names.map((id,i)=>({index:4+i*3,id,connected:false,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))}));
const picker=document.querySelector<HTMLSelectElement>('#device')!;
picker.innerHTML=names.map((n,i)=>`<option value="${i}">Device ${i+1}: ${n}</option>`).join('');
const frame=document.querySelector<HTMLIFrameElement>('iframe')!;
const target=()=>devices[Number(picker.value)];
// A separate iframe runs the real application. Only the browser's physical-device boundary is simulated.
const host=window as unknown as {controllerReviewSamples:()=>Array<PadSample|null>};
host.controllerReviewSamples=()=>{const result:Array<PadSample|null>=Array(26).fill(null);for(const d of devices)if(d.connected)result[d.index]=d;return result;};
const html=await(await fetch('/')).text();
frame.srcdoc=html.replace('</head>',`<script>Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>parent.controllerReviewSamples()});</script></head>`);
document.querySelector('#connect')!.addEventListener('click',()=>{target().connected=!target().connected;frame.contentWindow?.focus();});
document.querySelectorAll<HTMLButtonElement>('[data-button]').forEach(el=>el.onclick=()=>{const d=target(),i=Number(el.dataset.button),buttons=d.buttons as {pressed:boolean;value:number}[];buttons[i]={pressed:true,value:1};frame.contentWindow?.focus();setTimeout(()=>{buttons[i]={pressed:false,value:0};},120);});
document.querySelector('#drift')!.addEventListener('click',()=>{const axes=target().axes as number[];axes[0]=axes[0]?0:.1;});
// Keep the game focused when operating virtual pad buttons, like a real hardware press.
document.querySelectorAll('button').forEach(el=>el.addEventListener('mousedown',event=>event.preventDefault()));
