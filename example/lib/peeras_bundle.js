class RtcConnection {
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

const ALLOWED_SHUNK_SIZE = 30000;

async function startRead(self, file) {
  const reader = file.stream().getReader();
  self.localFile = {
    name: file.name,
    size: file.size,
    type: file.type,
    reader,
    tmpShunk: null,
  };
}

async function read(self, incoming) {
  self.config.onUploadProgress(incoming?.receviedPercentage || 0);

  if (!self.localFile.tmpShunk) {
    self.localFile.tmpShunk = await self.localFile.reader.read();
    if (self.localFile.tmpShunk.done) {
      self.channel.send(
        JSON.stringify({
          type: "fileStreamCompleted",
        })
      );
      self.localFile = null;
      return;
    }
  }

  // process the shunk
  if (self.localFile.tmpShunk.value.length > ALLOWED_SHUNK_SIZE) {
    self.channel.send(
      new Uint8Array(self.localFile.tmpShunk.value.slice(0, 65536))
    );
    self.localFile.tmpShunk.value = self.localFile.tmpShunk.value.slice(65536);
  } else {
    self.channel.send(self.localFile.tmpShunk.value);
    self.localFile.tmpShunk = null;
  }
}

async function endRead(self) {
  self.localFile.reader.releaseLock();
  self.localFile = null;
}

async function startWrite(self, remoteFile) {
  try {
    if (self.development) {
      await sleep(2000);
    }
    const picker = await window.showSaveFilePicker({
      suggestedName: remoteFile.name,
    });

    const stream = await picker.createWritable();

    self.remoteFile = {
      stream,
      totalByteSize: remoteFile.size,
      recivedByteLength: 0,
    };

    self.channel.send(JSON.stringify({ type: "readyToRecieve" }));
  } catch (err) {
    const error = {
      code: err.code,
      name: err.name,
      message: err.message,
    };

    if (err.code === 18) {
      error.message = "User is not focused on the browser tab";
    }

    self.development && console.log("startWrite error", error);

    self.channel.send(
      JSON.stringify({
        type: "initializingFailed",
        data: error,
      })
    );
  }
}

async function write(self, data) {
  await self.remoteFile.stream.write(data);
  self.remoteFile.recivedByteLength += data.byteLength;
  self.remoteFile.size = self.remoteFile.stream.size;
  const donwloadPercentage =
    (self.remoteFile.recivedByteLength / self.remoteFile.totalByteSize) * 100;
  self.config.onDownloadProgress(donwloadPercentage);
  self.channel.send(
    JSON.stringify({
      type: "readyToRecieve",
      data: {
        receviedPercentage: donwloadPercentage,
      },
    })
  );
}

function endWrite(self) {
  self.development && console.log("file completed");
  self.remoteFile.stream.close();
  self.remoteFile = null;
}

//utils
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function manageMainChannel(self, chaneel) {
  self.channel = chaneel || null;
  if (!chaneel) {
    self.channel = self.connection.createDataChannel("channel", {
      ordered: true,
      maxPacketLifeTime: 100000,
    });
  }

  self.channel.onopen = (e) =>
    self.development && console.log("channel opened", e);

  self.channel.onmessage = async (event) => {
    self.development && console.log("channel message", event);

    if (event.data instanceof ArrayBuffer) {
      return write(self, event.data);
    }

    await handler(self, event);
  };
}

async function handler(self, event) {
  const incoming = JSON.parse(event.data);
  switch (incoming.type) {
    case "message":
      self.config.onMessage(incoming.data);
      break;
    case "initializing":
      startWrite(self, incoming.data);
      break;
    case "readyToRecieve":
      read(self, incoming.data);
      break;
    case "initializingFailed":
      endRead(self);
      self.config.onInitializingFileTranferFailed(incoming.data);
      break;
    case "fileStreamAborted":
      endWrite(self);
      self.config.onFileAbort();
      break;
    case "fileStreamCompleted":
      endWrite(self);
      break;
    case "mediaStreamStoped":
      self.config.onRemoteMediaStreamStoped(incoming.data);
      break;
    case "mediaStreamResumed":
      self.config.onRemoteMediaStreamResumed(incoming.data);
      break;
  }
}

function manageStreams(self, streams) {
  if (!streams) {
    return;
  }
  self.localStreams = streams.map((stream, index) => {
    return stream.getTracks().reduce((acc, track) => {
      const type = track.kind; // audio or video
      const sender = self.connection.addTrack(track, stream);
      acc[type] = {
        sender,
        stop: function () {
          this.sender.track.enabled = false; // rtpSender.track will point on our actual track
          self.channel.send(
            JSON.stringify({
              type: "mediaStreamStoped",
              data: {
                type: type,
                streamId: stream.id,
                streamIndex: index,
              },
            })
          );
        },
        resume: function () {
          this.sender.track.enabled = true;
          self.channel.send(
            JSON.stringify({
              type: "mediaStreamResumed",
              data: {
                type: type,
                streamId: stream.id,
                streamIndex: index,
              },
            })
          );
        },
        // replaceTrack(newTrack) {
        //   // not implemented yet
        //   // if (newTrack.constructor.name) ref.sender.replaceTrack(newTrack);
        // },
      };
      return acc;
    }, {});
  });
}

class Peeras extends RtcConnection {
  constructor(config, servers) {
    super(config, servers);
    this.development = true;
    this.localFile = null;
    this.remoteFile = null;
    this.localMediaStreams = null;
    this.channel = null;
  }

  initialize({ localStreams } = {}) {
    return new Promise(async (resolve) => {
      //guard to prevent calling initialize twice
      if (this.connection?.localDescription?.sdp) {
        throw Error("initialize can only be called once");
      }

      // You must add at least a datachannel before you create an offer
      // https://stackoverflow.com/questions/15324500/creating-webrtc-data-channels-after-peerconnection-established
      manageMainChannel(this);
      manageStreams(this, localStreams);

      const offer = await this.connection.createOffer();
      await this.connection.setLocalDescription(offer);

      this.connection.onicecandidate = (e) => {
        if (e.candidate) {
          const sdp = this.connection.localDescription.sdp.toString();
          resolve(sdp);
        }
      };
    });
  }

  async verify(sdp) {
    const answer = new RTCSessionDescription({
      type: "answer",
      sdp: sdp,
    });
    await this.connection.setRemoteDescription(answer);
  }

  answer({ offer, localStreams }) {
    return new Promise(async (resolve) => {
      this.connection.ondatachannel = (e) => {
        manageMainChannel(this, e.channel);
      };

      manageStreams(this, localStreams);

      const remoteOffer = new RTCSessionDescription({
        type: "offer",
        sdp: offer,
      });

      await this.connection.setRemoteDescription(remoteOffer);

      const answer = await this.connection.createAnswer();
      await this.connection.setLocalDescription(answer);

      this.connection.onicecandidate = (e) => {
        if (e.candidate) {
          const sdp = this.connection.localDescription.sdp.toString();
          resolve(sdp);
        }
      };
    });
  }

  checkCallOrAnswerType(callid) {
    const sdpObject = callid;
    const video = sdpObject.includes("m=video");
    const audio = sdpObject.includes("m=audio");
    return {
      video,
      audio,
    };
  }

  sendMessage(content) {
    if (!this.channel || this.channel.readyState !== "open") {
      throw Error("channel not ready");
    }
    this.channel.send(
      JSON.stringify({
        type: "message",
        data: content,
      })
    );
  }

  sendFile = async (file) => {
    if (!this.channel || this.channel.readyState !== "open") {
      throw Error("channel not ready");
    }

    if (this.localFile) {
      throw Error("another file is sending");
    }

    startRead(this, file);

    this.channel.send(
      JSON.stringify({
        type: "initializing",
        data: {
          name: file.name,
          size: file.size,
          type: file.type,
        },
      })
    );
  };

  abortFile = () => {
    if (this.localFile) {
      endRead(this);
      this.channel.send(
        JSON.stringify({
          type: "fileStreamAborted",
        })
      );
    }
  };
}

export { Peeras as default };
