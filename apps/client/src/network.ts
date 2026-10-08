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
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private lastDelivery = 0;
  private pendingInputs: {message:ClientMessage;ready:boolean}[]=[];
  private cancelConnect?: () => void;
  async connect(): Promise<void> {
    this.disconnect();
    diagnostics.record('connection-attempt');
    const env = (import.meta as ImportMeta & { env: Record<string, string> })
      .env;
    const url = multiplayerEndpoint(env?.VITE_WS_URL,!!desktopBridge(),location.protocol,location.hostname);
    await new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(url);
      this.socket = socket;
      let opened = false;
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
        reject(new Error("Cannot connect to room server on " + url));
      };
      socket.onclose = (event) => {
        diagnostics.record('connection-close',undefined,event?.code);
        clearTimeout(timeout);
        if (!opened) reject(new Error("Room server closed the connection"));
        if (this.socket !== socket) return;
        this.socket = null;
        this.cancelConnect = undefined;
        this.onClose();
      };
      socket.onmessage = (event) => {
        if (this.socket !== socket) return;
        let message: ServerMessage;
        try { message = JSON.parse(event.data) as ServerMessage; } catch { return; }
        if (!message || typeof message.type !== "string") return;
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
      this.socket.send(JSON.stringify(message.type==='create'||message.type==='join'?{...message,contentVersion:contentVersion()}:message));
  }
  measurePing(): void {
    this.send({ type: "ping", sent: performance.now() });
  }
  disconnect(): void {
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
