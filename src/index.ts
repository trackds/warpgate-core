import SimplePeerjs, { SimplePeerJsOpts } from "simple-peerjs";
import { nanoid } from "nanoid";
import { SmartBuffer } from "smart-buffer";
import { Duplex, DuplexOptions } from "stream";
import { createConnection, createServer } from "net";
import type {Socket} from "net";
import fetch from "node-fetch";
import wrtc from "wrtc";
import WebSocket from "ws";
import debug from "debug";
import { WarpgateAddr, HostAddr, isWarpgateAddr, isHostAddr, ForwardId, ForwardRuleId } from "./defined";

interface ForwardRule {
  id: ForwardRuleId;
  listener: string | HostAddr;
  target: WarpgateAddr | HostAddr;
}

const enum MessageType {
  Auth = 0x30,
  CreateStream = 0x31,
  CloseStream = 0x32,
  Respone = 0x40,
  Data = 0xFE
}

interface WarpgateStream extends Duplex {
  ruleId: string;
  forwardId: ForwardId;
}

interface WarpgateTcpStreamRule {
  id: ForwardRuleId;
  target: HostAddr;
}
class WarpgateTcpStream extends Duplex implements WarpgateStream {
  readonly ruleId: string;
  readonly forwardId: string;
  private readonly rule: WarpgateTcpStreamRule;
  private readonly socket: Socket;
  private bufs: Buffer[] = [];
  private log = debug("Warpgate:WarpgateTcpStream");
  constructor(rule: WarpgateTcpStreamRule, opt?: DuplexOptions) {
    super(opt);
    this.ruleId = rule.id;
    this.rule = rule;
    this.forwardId = nanoid();
    this.socket = createConnection({
      host: rule.target.address,
      port: rule.target.port
    });

    this.socket.on("close", () => {
      this.push(null);
    });

    this.socket.on("error", () => {
      this.push(null);
    });
  }

  _read() {
    this.socket.on("data", (data) => {
      this.push(data);
    });
  }
  _write(chunk: Buffer | string, _encoding: BufferEncoding, done: (error?: Error | null) => void) {
    this.socket.write(chunk, done);
  }
  _final(cb: (error?: Error | null) => void) {
    this.socket.end(cb);
  }
}

export class WarpgateNode {
  private node: SimplePeerjs;
  private streams: WarpgateStream[] = [];
  private rules: ForwardRule[] = [];

  constructor(opts?: SimplePeerJsOpts) {
    this.node = new SimplePeerjs({...{fetch, wrtc, WebSocket}, ...opts});

    this.node.on("connect", (conn) => {
      conn.peer.on("data", (data) => {
        const buf = SmartBuffer.fromBuffer(data);
        const type: MessageType = buf.readUInt8();

        switch (type) {
          case MessageType.CreateStream: {
            const serviceName = buf.readStringNT();
            const rule = this.rules.find((rule) => {
              return rule.listener === serviceName;
            });
            if (rule) 
              this.createStream(rule);
            break;
          }
          default:
            break;
        }
      });
    });

  }

  private createStream(rule: ForwardRule): WarpgateStream {
    let stream: WarpgateStream = this.streams.find((s) => s.ruleId === rule.id);

    if (stream) {
      //流已存在
      return stream;
    }

    if (isHostAddr(rule.target)) {
      const proto = rule.target.proto || "TCP";
      switch (proto) {
        case "TCP":
          stream = new WarpgateTcpStream({id: rule.id, target: rule.target});
          break;
        case "UDP":
        default:
          break;
      }
    }

    if (stream) {
      this.streams.push(stream);
    }
    return stream;
  }

  addForward(serviceName: string, targetHost: HostAddr): ForwardRuleId;
  addForward(serviceName: string, targetNode: WarpgateAddr): ForwardRuleId;
  addForward(listenAddr: HostAddr, targetAddr: WarpgateAddr): ForwardRuleId;
  addForward(listenAddr: HostAddr, targetHost: HostAddr): ForwardRuleId;

  addForward(param1: string | HostAddr, param2: WarpgateAddr | HostAddr): ForwardRuleId {
    const id = nanoid(8);
    const rule: ForwardRule = {
      id,
      listener: param1,
      target: param2
    };

    this.rules.push(rule);
    
    if (isHostAddr(param1)) {
      const listenAddr = param1;
      const proto = listenAddr.proto || "TCP";

      this.createStream(rule);
      switch(proto) {
        case "TCP": {
          const server = createServer((socket) => {
            const stream = this.streams.find((s) => s.ruleId === id);
            if (stream) {
              socket.on("error", (err) => {
                console.error("client:", err);
              }).pipe(stream).on("error", (err) => {
                console.error("target:", err);
              }).pipe(socket);
            }
          });

          server.listen(listenAddr.port, listenAddr.address);
          break;
        }
        case "UDP":
        default:
          break;
      }
    }
  
    return id;
  }
}
