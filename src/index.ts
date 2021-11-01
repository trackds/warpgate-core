import SimplePeerjs, { SimplePeerJsOpts } from "simple-peerjs";
import { nanoid } from "nanoid";
import { SmartBuffer } from "smart-buffer";
import { Duplex, DuplexOptions } from "stream";
import { createConnection, createServer } from "net";
import type { Socket } from "net";
import fetch from "node-fetch";
import wrtc from "wrtc";
import WS from "ws";
import debug from "debug";
import {
  WarpgateAddr,
  HostAddr,
  // isWarpgateAddr,
  isHostAddr,
  ForwardId,
  ForwardRuleId,
} from "./defined";

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
  Error = 0x41,
  Data = 0xfe,
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
  private socket: Socket = null;
  private bufs: Buffer[] = [];
  private log = debug("Warpgate:WarpgateTcpStream");
  constructor(rule: WarpgateTcpStreamRule, opt?: DuplexOptions) {
    super(opt);
    this.ruleId = rule.id;
    this.rule = rule;
    this.forwardId = nanoid();
  }

  _read() {
    if (!this.socket) {
      this.socket = createConnection({
        host: this.rule.target.host,
        port: this.rule.target.port,
      });

      this.socket.on("close", () => {
        this.log(
          "id:%s rule:%s %s:%d close",
          this.forwardId,
          this.ruleId,
          this.rule.target.host,
          this.rule.target.port
        );
        this.socket = null;
        this.end(null);
      });

      this.socket.on("error", (err) => {
        this.log(
          "id:%s %s:%d error:%O",
          this.forwardId,
          this.ruleId,
          this.rule.target.host,
          this.rule.target.port,
          err
        );
        this.socket = null;
        this.end(null);
      });

      this.socket.on("data", (data) => {
        this.log("rec data %o", data);
        this.push(data);
      });
    }
  }
  _write(
    chunk: Buffer | string,
    _encoding: BufferEncoding,
    done: (error?: Error | null) => void
  ) {
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
  private log = debug("Warpgate:WarpgateNode");
  constructor(opts?: SimplePeerJsOpts) {
    this.node = new SimplePeerjs({ ...{ fetch, wrtc, WS }, ...opts });

    this.node.on("connect", (conn) => {
      const nodeStreamId: {[id: string]: string[]} = {};
      conn.peer.on("data", (data) => {
        const buf = SmartBuffer.fromBuffer(data);
        const type: MessageType = buf.readUInt8();
        const requestId = buf.readStringNT();
        let res: SmartBuffer;

        switch (type) {
          case MessageType.CreateStream: {
            const serviceName = buf.readStringNT();
            const rule = this.rules.find((rule) => {
              return rule.listener === serviceName;
            });
            res = SmartBuffer.fromSize(64);
            if (rule) {
              const stream = this.createStream(rule);
              if (nodeStreamId[conn.peerId]) {
                nodeStreamId[conn.peerId].push(stream.forwardId);
              } else {
                nodeStreamId[conn.peerId] = [stream.forwardId];
              }
              res.writeUInt8(MessageType.Respone);
              res.writeUInt8(MessageType.CreateStream);
              res.writeStringNT(requestId);
              res.writeStringNT(stream.forwardId);
            } else {
              res.writeUInt8(MessageType.Error);
              res.writeUInt8(MessageType.CreateStream);
              res.writeStringNT(requestId);
              res.writeStringNT("rules don't exist");
            }
            break;
          }
          default:
            res = SmartBuffer.fromSize(64);
            res.writeUInt8(MessageType.Error);
            res.writeUInt8(type);
            res.writeStringNT(requestId);
            res.writeStringNT("unknown type");
            break;
        }

        if (res)
          conn.peer.write(res);
      });

      conn.peer.on("close", () => {
        const thisNodeStreamId = nodeStreamId[conn.peerId]
        thisNodeStreamId.forEach((id) => {
          const stream = this.streams.find((s) => s.forwardId === id);

          if (stream) {
            stream.end();
          }
        });
      });
    });
  }

  private createStream(rule: ForwardRule): WarpgateStream {
    let stream: WarpgateStream = null;

    if (isHostAddr(rule.target)) {
      const proto = rule.target.proto || "TCP";
      switch (proto) {
        case "TCP":
          stream = new WarpgateTcpStream({ id: rule.id, target: rule.target });
          stream.on("close", () => {
            this.streams = this.streams.filter((s) => {
              return !(s === stream)
            });
          });
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

  addForward(
    param1: string | HostAddr,
    param2: WarpgateAddr | HostAddr
  ): ForwardRuleId {
    const id = (() => {
      let _id = nanoid(8);
      while (this.rules.some((r) => r.id === _id)) {
        _id = nanoid(8);
      }
      return _id;
    })();

    const rule: ForwardRule = {
      id,
      listener: param1,
      target: param2,
    };

    this.rules.push(rule);

    if (isHostAddr(param1)) {
      const listenAddr = param1;
      const proto = listenAddr.proto || "TCP";

      switch (proto) {
        case "TCP": {
          const server = createServer((socket) => {
            const stream = this.createStream(rule);
            if (stream) {
              socket
                .on("error", (err) => {
                  this.log("client:%O", err);
                })
                .pipe(stream)
                .on("error", (err) => {
                  this.log("target:%O", err);
                })
                .pipe(socket);

                socket.once("close", () => stream.end());
            }
          });

          server.listen(listenAddr.port, listenAddr.host);
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
