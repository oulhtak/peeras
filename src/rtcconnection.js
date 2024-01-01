export class RtcConnection {
  constructor(listeners, servers) {
    if (!window.RTCPeerConnection) {
      throw Error("your browser does not support WebRTC");
    }

    this.listeners = listeners || {};
    this.connection = new RTCPeerConnection(
      servers || {
        iceServers: [
          {
            urls: ["stun:stun1.l.google.com:19302"],
          },
        ],
        iceCandidatePoolSize: 10,
      }
    );

    this.connection.onconnectionstatechange = (e) => {
      console.log(
        "onconnectionstatechange",
        this.connection.connectionState,
        e
      );
      switch (this.connection.connectionState) {
        case "connecting":
          listeners.onConnecting();
          break;
        case "disconnected":
          this.close();
          this.listeners.onDisconnected();
          break;
        case "failed":
          listeners.onFailed();
          break;
        case "closed":
          listeners.onClosed();
          break;
        case "connected":
          this.listeners.onConnected(this.connection.getRemoteStreams());
          break;
      }
    };
  }

  close() {
    this.connection.close();
  }
}
