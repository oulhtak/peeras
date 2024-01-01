### 1 Usage

### 1.1 Creating Base Event Listeners

```js
const eventListener = {
  // Important event that needs to be specified
  onConnected: () => console.log("Successfully connected"),
  // Optional events for connection status listening
  onConnecting: () => console.log("Connecting"),
  onFailed: () => console.log("Connecting peers failed"),
  onDisconnected: () => console.log("Disconnected"),
  onClosed: () => console.log("The other peer closed the connection manually"),
};
```

### 1.2 Basic connecting Two Peers

To exchange the `offer` and the `answer` between peers, you will need to use something like websockets.

```js
//peer_1 on browser_1
const peer = new Peeras(eventListener);
const offer = await peer.initialize();
```

```js
//peer_2 on a diffrent browser
const peer = new Peeras(eventListeners);
const answer = await peer.answer({ offer });
```

```js
//peer_1 on browser_1
peer.verify(answer);
```

to close the connection

```js
peer.close();
```

#### 1.3 Exchanging Messages

To send a message

```js
peer.sendMessage("hello world");
```

You need to add a new listener `onMessage` to your `eventListeners` to handle incoming messages

```js
onMessage: (message) => console.log(message);
```

#### 1.4 Exchanging files

To send a file to the other peer

```js
const file = document.getElementById("fileInput").files[0];
peer.sendFile(file);
```

To cancel the file transmission while it's in progress.

```js
peer.abortFile();
```

And you can add these extra **optional** listeners to handle files exchangings

```js
  onUploadProgress: (percentage) => console.log(percentage), //for the sender
  onDownloadProgress: (percentage) => console.log(percentage), //for the reciever
  onInitializingFileTranferFailed: (error) => {
    const { code, message, name } = error
    ...
  }
  onFileAbort: () => console.log("User aborted the file"),
```

### 2 Browser compatibility

Chrome ,Opera and Edge

### 3 Demo Example

- [Files Stream Example](/examples/filesStreaming/)
