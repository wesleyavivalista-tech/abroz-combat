import { test } from "node:test";
import assert from "node:assert/strict";
import { LobbyClient } from "../apps/client/src/network.js";

class Socket {
  static OPEN = 1;
  static instances: Socket[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: {data: string}) => void) | null = null;
  constructor(_url: string) { Socket.instances.push(this); }
  close() { this.readyState = 3; this.onclose?.(); }
  sent: string[] = [];
  send(data: string) { this.sent.push(data); }
}
test("lobby cancels pending connections and ignores stale or malformed messages", async (t) => {
  t.mock.method(globalThis, "setTimeout", setTimeout);
  const ws = Object.getOwnPropertyDescriptor(globalThis, "WebSocket");
  const location = Object.getOwnPropertyDescriptor(globalThis, "location");
  Object.defineProperty(globalThis,"WebSocket",{value:Socket,configurable:true});
  Object.defineProperty(globalThis,"location",{value:{protocol:"http:",hostname:"localhost"},configurable:true});
  const client = new LobbyClient();
  try {
    const pending = client.connect();
    const cancelled = assert.rejects(pending,/cancelled/);
    const old = Socket.instances.at(-1)!;
    const oldMessage = old.onmessage!;
    client.disconnect(); await cancelled;
    assert.equal(client.socket,null);
    const next = client.connect();const socket = Socket.instances.at(-1)!;
    socket.readyState=1;socket.onopen!();await next;
    let received=0;client.onMessage=()=>{received++;};
    oldMessage({data:'{"type":"error","message":"stale"}'});
    socket.onmessage!({data:'invalid json'});
    socket.onmessage!({data:'null'});
    assert.equal(received,0);
    socket.onmessage!({data:'{"type":"error","message":"current"}'});
    assert.equal(received,1);
    client.disconnect();
    const closed = client.connect();const rejected=assert.rejects(closed,/closed/);
    Socket.instances.at(-1)!.close();await rejected;
  } finally {
    client.disconnect();
    if(ws) Object.defineProperty(globalThis,"WebSocket",ws);else Reflect.deleteProperty(globalThis,"WebSocket");
    if(location) Object.defineProperty(globalThis,"location",location);else Reflect.deleteProperty(globalThis,"location");
  }
});


test("delayed input is cancelled across reconnect and never enters a new match", async (t) => {
  t.mock.timers.enable({apis:['setTimeout']});
  const ws=Object.getOwnPropertyDescriptor(globalThis,'WebSocket');
  const location=Object.getOwnPropertyDescriptor(globalThis,'location');
  Object.defineProperty(globalThis,'WebSocket',{value:Socket,configurable:true});
  Object.defineProperty(globalThis,'location',{value:{protocol:'http:',hostname:'localhost'},configurable:true});
  const client=new LobbyClient();
  try {
    const first=client.connect(),old=Socket.instances.at(-1)!;
    old.readyState=1;old.onopen!();await first;
    client.latency=200;
    client.send({type:'input',frame:200,mask:512,matchId:'old-match'});
    client.disconnect();
    const second=client.connect(),fresh=Socket.instances.at(-1)!;
    fresh.readyState=1;fresh.onopen!();await second;
    client.latency=0;client.send({type:'input',frame:2,mask:0,matchId:'new-match'});
    t.mock.timers.tick(500);
    assert.equal(old.sent.length,0);
    assert.deepEqual(fresh.sent.map(s=>JSON.parse(s)),[{type:'input',frame:2,mask:0,matchId:'new-match'}]);
  } finally {
    client.disconnect();
    if(ws)Object.defineProperty(globalThis,'WebSocket',ws);else Reflect.deleteProperty(globalThis,'WebSocket');
    if(location)Object.defineProperty(globalThis,'location',location);else Reflect.deleteProperty(globalThis,'location');
  }
});
