const MAX_ALLOWED_SHUNK_SIZE = 65536; //bytes
const ALLOWED_SHUNK_SIZE = 30000;

export async function startRead(self, file) {
  const reader = file.stream().getReader();
  self.localFile = {
    name: file.name,
    size: file.size,
    type: file.type,
    reader,
    tmpShunk: null,
  };
}

export async function read(self, incoming) {
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

export async function endRead(self) {
  self.localFile.reader.releaseLock();
  self.localFile = null;
}

export async function startWrite(self, remoteFile) {
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

export async function write(self, data) {
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

export function endWrite(self) {
  self.development && console.log("file completed");
  self.remoteFile.stream.close();
  self.remoteFile = null;
}

//utils
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
