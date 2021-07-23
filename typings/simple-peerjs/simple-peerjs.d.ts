
declare module 'simple-peerjs' {
  import {Instance as SimplePeer, Options as SimplePeerOpts} from"@types/simple-peer";

  export interface SimplePeerJsOpts {
    /**
     * PeerJs id (if absent, peerjs server will assign a free id)
    */
    id?: string;

    /**
     * [`simple-peer` configuration options](https://github.com/feross/simple-peer#peer--new-peeropts)
    */
    simplePeer?: SimplePeerOpts; 

    /**
     * custom webrtc implementation, mainly useful in node to specify in the wrtc package. Contains an object with the properties:
     * - [RTCPeerConnection](https://www.w3.org/TR/webrtc/#dom-rtcpeerconnection)
     * - [RTCSessionDescription](https://www.w3.org/TR/webrtc/#dom-rtcsessiondescription)
     * - [RTCIceCandidate](https://www.w3.org/TR/webrtc/#dom-rtcicecandidate)
    */
    wrtc?: {RTCPeerConnection: RTCPeerConnection, RTCSessionDescription: RTCSessionDescription, RTCIceCandidate: RTCIceCandidate};

    /**
     * [fetch-like](https://fetch.spec.whatwg.org/) function implementation
    */
    fetch?: unknown;

    /**
     * [WebSocket-like](https://www.w3.org/TR/websockets/) implementation
    */
    WebSocket?: WebSocket;
  }

  export interface SimplePeerConn {

    /**
     * connection ID
    */
    id: string;

    /**
     * The peer ID of the other party
    */
    peerId: string;

    /**
     * SimplePeer
    */
    peer: SimplePeer;
  }

  export default class SimplePeerjs {
    /**
     * Creates a SimplePeerJs instance which delegates signaling to PeerJs and creates simple-peer WebRTC channels.
     * The following properties can be specified on opts:
    */
    constructor(opts?: string | SimplePeerJsOpts);

    /**
     * Promise that resolves to the peer id
     */
    id: Promise<string>;

    /**
     * Tries to connect to `peerId`. Returns a promise with an object that has a simple-peer instance on the `peer` property.
     *
     * The second parameter, `opts`, is optional. If passed, it will be used as the simple-peer configuration.
     */
    connect(peerId: string, opts: SimplePeerOpts?): Promise<SimplePeer>;

    /**
     * Closes Signaling connection to PeerJS and all active peer connections.
     */
    close(): void;

    /**
     * Emitted when a new connection has been created. 
     * `connection` has a `peer` property which is a simple-peer object.
    */
    on(event: "connect", listener: (conn: SimplePeerConn) => void): this;

    /**
     * Emitted on every error.
     */
    on(event: "error", listener: (err: Error) => void): this;
  }
}