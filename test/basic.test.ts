import { expect } from "chai";
import { createServer, createConnection } from "net";
import type { Server } from "net";
import debug from "debug";

import { WarpgateNode } from "../src/index";

const TCP_SERVER_PORT = 8881;
const log = debug("test");

describe("TCP Forward", () => {
  let server: Server;
  let node: WarpgateNode;
  before((done) => {
    server = createServer((skt) => {
      skt.on("data", (data) => {
        log("server rec data... %s", data.toString());
        skt.write("ok");
      });
    });
    server.listen(TCP_SERVER_PORT, "127.0.0.1", () => {
      log("listem:tcp test server");
      done();
    });
  });

  after((done) => {
    server.close((err) => {
      done(err);
    });
    node.distroy();
  });

  it("TCP Forward", (done) => {
    const TCP_TEST_PORT = 31188;
    node = new WarpgateNode();

    node.addForward({
      host: "127.0.0.1",
      port: TCP_TEST_PORT,
    }, {
      host: "127.0.0.1",
      port: TCP_SERVER_PORT,
    });

    const socket = createConnection({
      host: "127.0.0.1",
      port: TCP_TEST_PORT
    });

    socket.on("data", (data) => {
      socket.end()
      log("client rec data %s", data.toString());
      expect(data.toString()).equal("ok");
      const socket2 = createConnection({
        host: "127.0.0.1",
        port: TCP_TEST_PORT
      });
      socket2.on("data", (data) => {
        log("client2 rec data %s", data.toString());
        expect(data.toString()).equal("ok");
        socket2.end();
        done();
      });
      socket2.write("hello");
    });

    socket.write("hello");
  });
})
