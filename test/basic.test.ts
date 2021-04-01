import { expect } from "chai";
import delay from "delay";
import { createNode } from "../src/index";
import type { WarpgateNode } from "../src/index";
import multiaddr from "multiaddr";
import pipe from "it-pipe";
import {createServer, AddressInfo, createConnection} from "net";

let node1: WarpgateNode;
let node2: WarpgateNode;

before(async () => {
  node1 = await createNode();
  node2 = await createNode();
  await Promise.all([node1.node.start(), node2.node.start()]);
  await delay(1000);
});

after(async () => {
  await Promise.all([node1.node.stop(), node2.node.stop()]);
});

describe("basic test", () => {
  it("ping test", async () => {
    const delayTime = await node2.node.ping(node1.node.peerId);
    expect(delayTime).lte(200);
  });

  it("dail tcp stream test", async () => {

    const tcpServer = createServer((scoket) => {
      scoket.on("data", (data) => {
        scoket.end(`pong: ${data.toString()}`);
      })
    });

    tcpServer.listen();
    node1.addListener("/test", multiaddr(`/ip4/127.0.0.1/tcp/${(tcpServer.address() as AddressInfo).port}`));
    const {stream} = await node2.node.dialProtocol(node1.node.peerId, "/test");
    let rep = "";

    await pipe(
      ["hello"],
      stream,
      async (source) => {
        for await (const chunk of source) {
          rep += chunk.toString();
        }
      }
    );

    tcpServer.close();

    expect(rep).equal("pong: hello");
  });

  it("forward tcp stream to tcp server test", async () => {

    const listenPort = 11680;
    const tcpServer = createServer((scoket) => {
      scoket.on("data", (data) => {
        scoket.end(`pong: ${data.toString()}`);
      })
    });

    tcpServer.listen();
    
    node1.addForward(multiaddr(`/ip4/127.0.0.1/tcp/${listenPort}`), multiaddr(`/ip4/127.0.0.1/tcp/${(tcpServer.address() as AddressInfo).port}`));
    const tcpClient = createConnection({
      host: "127.0.0.1",
      port: listenPort
    });
    let rep = "";

    await pipe(
      ["hello"],
      (source) => {
        for (const chunk of source) {
          tcpClient.write(chunk);
        }
        return tcpClient;
      },
      async (source) => {
        for await (const chunk of source) {
          rep += chunk.toString();
        }
      }
    );

    tcpServer.close();
    expect(rep).equal("pong: hello");
  });
});
