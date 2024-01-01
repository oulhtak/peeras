export class RtcConnection {
  constructor(config, servers) {
    // if (!window.RTCPeerConnection) {
    //   throw Error("your browser does not support RTCPeerConnection");
    // }

    // if (!window.showSaveFilePicker) {
    //   throw Error("your browser does not support showSaveFilePicker");
    // }

    this.config = config || {};
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
          config.onConnecting();
          break;
        case "disconnected":
          this.close();
          this.config.onDisconnected();
          break;
        case "failed":
          config.onFailed();
          break;
        case "closed":
          config.onClosed();
          break;
        case "connected":
          console.log("connected hahah");
          // on connected instead of on open
          console.log("remote streams", this.connection.getRemoteStreams());
          this.config.onConnected(this.connection.getRemoteStreams());
          break;
      }
    };
  }

  close() {
    console.log("closing connection");
    this.connection.close();
  }
}
