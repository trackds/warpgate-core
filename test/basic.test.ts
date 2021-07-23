import { expect } from "chai";
import { createServer, createConnection } from "net";
import type { Server } from "net";
import debug from "debug";

import { WarpgateNode } from "../src/index";

const TCP_SERVER_PORT = 8881;
const log = debug("test");

describe("TCP Forward", () => {
  let server: Server;
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
    })
  });

  it("TCP Forward", (done) => {
    const TCP_TEST_PORT = 31188;
    const node = new WarpgateNode();
    node.addForward({
      address: "127.0.0.1",
      port: TCP_TEST_PORT,
      family: "ipv4"
    }, {
      address: "127.0.0.1",
      port: TCP_SERVER_PORT,
      family: "ipv4"
    });

    const socket = createConnection({
      host: "127.0.0.1",
      port: TCP_TEST_PORT
    });

    socket.on("data", (data) => {
      socket.end()
      log("client rec data %s", data.toString());
      expect(data.toString()).equal("ok");
      done();
    });

    socket.on("error", (err) => {
      done(err);
    });

    socket.write("hello");
  });
})
