import Libp2p, { Multiaddr } from "libp2p";


export interface WarpgateConfig {
  bootstraps: string[];
}

export interface WarpgateNode {
  readonly node: Libp2p;
  addListener: (protoName: string, target: Multiaddr) => void;
  addForward: (listenAddr: Multiaddr, targetAddr: Multiaddr, protoName?: string) => void;
}

export interface WarpgateListener {
  protoName: string;
  target: Multiaddr;
}

export interface WarpgateForwarder {
  listenAddr: Multiaddr;
  targetAddr: Multiaddr;
  protoName?: string;
}
