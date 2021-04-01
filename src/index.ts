import Libp2p from "libp2p";
// import { generate } from "libp2p/src/pnet";
import TCP from "libp2p-tcp";
import WS from "libp2p-websockets";
import MPLEX from "libp2p-mplex";
import { NOISE } from "libp2p-noise";
import MulticastDNS from "libp2p-mdns";
import DHT from "libp2p-kad-dht";
import GossipSub from "libp2p-gossipsub";
import Bootstrap from "libp2p-bootstrap";
import PeerId from "peer-id";
import { WarpgateNodeImp } from "./WarpgateNodeImp";
import type { WarpgateConfig, WarpgateNode } from "./define";

export type {
  WarpgateNode,
  WarpgateConfig,
  WarpgateForwarder,
  WarpgateListener,
} from "./define";
/**
 * Create a Warpgate node
 */
export async function createNode(
  config: WarpgateConfig = { bootstraps: [] }
): Promise<WarpgateNode> {
  const peerId = await PeerId.create();
  const node = await Libp2p.create({
    peerId,
    modules: {
      transport: [TCP, WS],
      streamMuxer: [MPLEX],
      connEncryption: [NOISE],
      peerDiscovery: [MulticastDNS, Bootstrap],
      dht: DHT,
      pubsub: GossipSub,
    } as Libp2p.Libp2pModules,
    addresses: {
      listen: ["/ip4/0.0.0.0/tcp/0", "/ip4/0.0.0.0/tcp/0/ws"],
    },
    config: {
      peerDiscovery: {
        autoDial: true,
        [MulticastDNS.tag]: {
          interval: 1000,
          enabled: true,
        },
        [Bootstrap.tag]: {
          list: [
            ...config.bootstraps,
            // // A list of bootstrap peers to connect to starting up the node
            // "/ip4/104.131.131.82/tcp/4001/ipfs/QmaCpDMGvV2BGHeYERUEnRQAwe3N8SzbUtfsmvsqQLuvuJ",
            // "/dnsaddr/bootstrap.libp2p.io/ipfs/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN",
            // "/dnsaddr/bootstrap.libp2p.io/ipfs/QmQCU2EcMqAqQPR2i9bChDtGNJchTbq5TbXJJ16u19uLTa",
          ],
          interval: 2000,
          enabled: config.bootstraps.length ? true : false,
        },
      },
      dht: {
        enabled: true,
      },
    },
    connectionManager: {
      maxConnections: 100,
      minConnections: 50,
    },
  });

  node.on("peer:discovery", (peer) => {
    console.log(`discovery ${peer.toB58String()}`);
  });

  node.connectionManager.on("peer:connect", async (connection) => {
    console.log("connect", connection.remoteAddr.toString());
  });

  return new WarpgateNodeImp(node);
}
