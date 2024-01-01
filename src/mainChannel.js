import { startWrite, endWrite, read, write, endRead } from "./fileStream.js";

export function manageMainChannel(self, chaneel) {
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
