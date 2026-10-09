import {connectionFailureReason} from './connectionStatus.js';
import {diagnostics} from './diagnostics.js';
import {desktopBridge,multiplayerEndpoint} from './platform/runtime.js';
import {contentVersion} from '../../../packages/shared/contentVersion.js';
import type {
  ClientMessage,
  ServerMessage,
} from "../../../packages/shared/protocol.js";
export class LobbyClient {
  socket: WebSocket | null = null;
  latency = 0;
  jitter = false;
  ping = 0;
  onMessage: (message: ServerMessage) => void = () => {};
  onClose: () => void = () => {};
  onRecovering: () => void = () => {};
  private resumeToken?:string;
  private recoveryGeneration=0;
  private recovering=false;
  private resumeResult?: (success:boolean)=>void;
  private async recover():Promise<void>{
    if(this.recovering)return;
    this.recovering=true;const generation=this.recoveryGeneration;const deadline=Date.now()+30_000;
    this.onRecovering();
    while(generation===this.recoveryGeneration&&Date.now()<deadline&&this.resumeToken){
      try{
        await this.connect(true);
        if(generation!==this.recoveryGeneration)return;
        const success=await new Promise<boolean>(resolve=>{
          const timeout=setTimeout(()=>{this.resumeResult=undefined;resolve(false);},Math.min(5000,Math.max(1,deadline-Date.now())));
          this.resumeResult=ok=>{clearTimeout(timeout);this.resumeResult=undefined;resolve(ok);};
          this.transmit({type:'resume',token:this.resumeToken!});
        });
        if(success)return;
      }catch{/* Retry only within the reservation window. */}
      if(generation!==this.recoveryGeneration)return;
      await new Promise(resolve=>setTimeout(resolve,1000));
    }
    if(generation===this.recoveryGeneration){this.disconnect();this.onClose();}
  }
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private lastDelivery = 0;
  private pendingInputs: {message:ClientMessage;ready:boolean}[]=[];
  private cancelConnect?: () => void;
  async connect(preserveRecovery=false): Promise<void> {
    this.disconnect(preserveRecovery);
    diagnostics.record('connection-attempt');
    const env = (import.meta as ImportMeta & { env: Record<string, string> })
      .env;
    const url = multiplayerEndpoint(env?.VITE_WS_URL,!!desktopBridge(),location.protocol,location.hostname);
    await new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(url);
      this.socket = socket;
      let opened = false;
      let failurePending=false;
      const fail=(fallback:string)=>{
        if(failurePending)return;failurePending=true;
        void connectionFailureReason(url).then(reason=>reject(new Error(reason??fallback)));
      };
      this.cancelConnect = () => { clearTimeout(timeout); reject(new Error("Connection cancelled")); };
      const timeout = setTimeout(() => {
        diagnostics.record('connection-timeout');
        socket.close();
        reject(new Error("Room server did not respond"));
      }, 5000);
      socket.onopen = () => {
        if (this.socket !== socket) return;
        opened = true;diagnostics.record('connection-open');
        this.cancelConnect = undefined;
        clearTimeout(timeout);
        resolve();
      };
      socket.onerror = () => {
        diagnostics.record('connection-error');
        clearTimeout(timeout);
        if(!opened)fail("Cannot connect to room server on " + url);
      };
      socket.onclose = (event) => {
        diagnostics.record('connection-close',undefined,event?.code);
        clearTimeout(timeout);
        if (!opened) {
          fail("Room server closed the connection");
          if(this.socket===socket)this.socket=null;
          // A rejected handshake belongs to connect(), not the active-match disconnect UI.
          return;
        }
        if (this.socket !== socket) return;
        this.socket = null;
        this.cancelConnect = undefined;
        if(this.resumeToken)void this.recover();else this.onClose();
      };
      socket.onmessage = (event) => {
        if (this.socket !== socket) return;
        let message: ServerMessage;
        try { message = JSON.parse(event.data) as ServerMessage; } catch { return; }
        if (!message || typeof message.type !== "string") return;
        if(message.type==='resume-token'){this.resumeToken=message.token;return;}
        if(this.recovering){
          if(message.type==='resume'){this.recovering=false;this.resumeResult?.(true);}
          else if(message.type==='error'){this.resumeResult?.(false);this.disconnect();this.onMessage(message);return;}
          else return;
        }
        if (message.type === "pong") {
          this.ping = Math.round(performance.now() - message.sent);
          return;
        }
        if(['room','start','championship-start','left','error'].includes(message.type))diagnostics.record('network-'+message.type);
        this.onMessage(message);
      };
    });
  }
  send(message: ClientMessage): void {
    if(this.recovering)return;
    if (message.type === "input" && (this.latency > 0 || this.timers.size > 0)) {
      const now = performance.now();
      const due = Math.max(
        now + this.latency + (this.jitter ? Math.random() * 20 : 0),
        this.lastDelivery,
      );
      this.lastDelivery = due;
      const pending={message,ready:false};
      this.pendingInputs.push(pending);
      const timer = setTimeout(() => {
        this.timers.delete(timer);
        pending.ready=true;
        while(this.pendingInputs[0]?.ready)this.transmit(this.pendingInputs.shift()!.message);
      }, due - now);
      this.timers.add(timer);
    } else this.transmit(message);
  }
  private transmit(message: ClientMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN)
      this.socket.send(JSON.stringify(message.type==='create'||message.type==='join'||message.type==='resume'?{...message,contentVersion:contentVersion(),recovery:1}:message));
  }
  measurePing(): void {
    this.send({ type: "ping", sent: performance.now() });
  }
  disconnect(preserveRecovery=false): void {
    if(!preserveRecovery){
      this.recoveryGeneration++;this.recovering=false;
      if(this.resumeToken&&this.socket?.readyState===WebSocket.OPEN)this.transmit({type:'leave'});
      this.resumeToken=undefined;
    }
    this.resumeResult?.(false);
    this.cancelConnect?.();
    this.cancelConnect = undefined;
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
    this.lastDelivery = 0;
    this.pendingInputs=[];
    if (this.socket) {
      diagnostics.record('connection-leave');
      this.socket.onclose = null;
      this.socket.onopen = null;
      this.socket.onmessage = null;
      this.socket.onerror = null;
      this.socket.close();
      this.socket = null;
    }
  }
}
