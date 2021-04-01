import Libp2p, { Multiaddr, MuxedStream } from "libp2p";
import TCP from "libp2p-tcp";
import pipe from "it-pipe";
import { Transport } from "libp2p-interfaces/src/transport/types";
import { WarpgateNode, WarpgateForwarder, WarpgateListener } from "./define";

export class WarpgateNodeImp implements WarpgateNode {
  public readonly node: Libp2p = null;
  private forwards: WarpgateForwarder[] = [];
  private listens: WarpgateListener[] = [];

  constructor(node: Libp2p) {
    this.node = node;
  }

  addListener(protoName: string, target: Multiaddr): void {
    this.node.handle(protoName, async ({ stream }) => {
      const targetProtoName = target.protoNames();
      let socket: MuxedStream;

      if (targetProtoName.includes("tcp")) {
        const upgrader = {
          upgradeInbound: (maConn: unknown) => maConn,
          upgradeOutbound: (maConn: unknown) => maConn,
        };
        const tcp = new TCP({ upgrader });
        socket = await tcp.dial(target);
      } else if (targetProtoName.includes("udp")) {
        throw new Error("Support for the UDP protocol is in development");
      } else {
        throw new Error("The protocol must include either tcp or udp");
      }

      await pipe(stream, socket, stream);
      socket.close();
      stream.close();
    });
  }

  private async createTargetSocket(targetAddr: Multiaddr, protoName?: string) {
    const targetProtoName = targetAddr.protoNames();
    let socket: MuxedStream;

    const upgrader = {
      upgradeInbound: (maConn: unknown) => maConn,
      upgradeOutbound: (maConn: unknown) => maConn,
    };

    if (targetProtoName.includes("tcp")) {
      if (protoName && targetAddr.getPeerId()) {
        const { stream } = await this.node.dialProtocol(targetAddr, protoName);
        socket = stream;
      } else {
        const tcp = new TCP({ upgrader });
        socket = await tcp.dial(targetAddr);
      }
    } else if (targetProtoName.includes("udp")) {
      throw new Error("Support for the UDP protocol is in development");
    } else {
      throw new Error("The protocol must include either tcp or udp");
    }

    return socket;
  }

  addForward(listenAddr: Multiaddr, targetAddr: Multiaddr, protoName?: string): void {
    const upgrader = {
      upgradeInbound: (maConn) => maConn,
      upgradeOutbound: (maConn) => maConn,
    };
    const listenProtoName = listenAddr.protoNames();

    if (listenProtoName.includes("tcp")) {
      const tcp: Transport<unknown, unknown> = new TCP({ upgrader });
      const listener = tcp.createListener(async (srcStream: MuxedStream) => {
        const socket: MuxedStream = await this.createTargetSocket(targetAddr, protoName);
        await pipe(srcStream, socket, srcStream);
      });
      listener.listen(listenAddr);
    } else if (listenProtoName.includes("udp")) {
      throw new Error("Support for the UDP protocol is in development");
    } else {
      throw new Error("The protocol must include either tcp or udp");
    }
  }
}