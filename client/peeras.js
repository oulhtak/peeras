//YOU CAN ADD A WORKER
class PEERAS {

	constructor(servers) {
		//test & throwing errors
		if (!window.RTCPeerConnection)
		throw Error('your browser does not support this feauture')
		this.servers = servers || {
			iceServers: [ //stun server
			  {
				urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
			  },
			],
			iceCandidatePoolSize: 10,
		  }
	}

	checkCallOrAnswerType(callid) {
		const sdpObject = callid
		const video = sdpObject.includes('m=video')
		const audio = sdpObject.includes('m=audio')
		return {
			video,
			audio
		}
	}


	sleep(ms){
		return new Promise(resolve=>{
			setTimeout(()=>{
				resolve(1)
			},ms)
		})
	}


	managePeer(Peer, config) {

        Peer.output = {}
    
		Peer.output.close = () => Peer.close();

		Peer.onconnectionstatechange = function() {
			if (Peer.connectionState == 'connecting') 
			return config.onConnecting()
			if(Peer.connectionState == 'failed')
			return config.onFailed()
			if(Peer.connectionState == 'disconnected')
			console.log('disconected--')
		}

	}

	managaPeerChanel(Peer, config, channel) {

		channel.onopen = e=>config.onOpen(Peer.getRemoteStreams())
		channel.onclose = config.onClose

        //reciver
        let RecivedFileStream = null
		let RecivedFileTotalSize = null
		let RecivedFileSize = 0
		
        //sender
		let Busy = false
		const ChunksAllowedSize = 65536  //bytes
        let FileStream = null
		let FileTotalSize = null
		let FileTransferredSize = 0

		
		channel.onmessage = async e => { 
			if(typeof e.data == 'object') 
			{         
					await RecivedFileStream.write(e.data); 
                    RecivedFileSize+= e.data.byteLength
				    config.onDownloadProgress && config.onDownloadProgress((RecivedFileSize/RecivedFileTotalSize)*100)
					return 0
			}

			const json = JSON.parse(e.data)
			if(json.FileDone)
			{
				await RecivedFileStream.close(); 
				RecivedFileStream = null
				RecivedFileSize = 0	
			}
			else if(json.FileAbort){
				if(RecivedFileStream) //Abort before saving file
				await RecivedFileStream.close(); 
				RecivedFileStream = null
				RecivedFileSize = 0	
				config.onFileAbort && config.onFileAbort()
			}
			else if(json.FileRequest)
			{
					
					try {
						RecivedFileTotalSize = json.size
					
						await this.sleep(1000)
						const newHandle = await window.showSaveFilePicker({
						  suggestedName: Date.now(), 
						  types: [{
							description: json.FileType ,
							accept: {[json.FileType]: [json.FileExtention]},
						  }]
						});
						//tegggst.mp4.crswap
						RecivedFileStream = await newHandle.createWritable();
					
					channel.send(JSON.stringify({ReadyToRecieveFile : true }))
					} catch (error) {
						const err = error.toString() 
						const isAbort = err.includes('AbortError') 
						const errorCode = isAbort ? 1 : 2
						console.log('---',err,'---')
						return channel.send(JSON.stringify({FileError : true ,  errorCode  }))
					}
				
			}
			else if(json.ReadyToRecieveFile)
            while(1){ //has a value and not aborted
			
			while(channel.bufferedAmount>65536)
			await this.sleep(10)

		   if(!FileStream) // suddenly aborted
		   return

           const shunk = await FileStream.read() 

           if(shunk.done)
		   {
			Busy = false   
			FileStream = null
			FileTransferredSize = 0
			return channel.send(JSON.stringify({ FileDone : true }))
		   }
          
		    if(shunk.value.length<=ChunksAllowedSize) 
			{
			channel.send(shunk.value)
			FileTransferredSize+=shunk.value.length
			config.onUploadProgress && config.onUploadProgress((FileTransferredSize/FileTotalSize)*100)
			}
			else
		    { 
				const length = shunk.value.length
				let i = 0

				while(i<length){

					let end = i+ChunksAllowedSize

					if(end>length)
					end = length
	
					channel.send(shunk.value.slice(i,end)) 
					
					let sentsize = end-i
					FileTransferredSize+=sentsize
					config.onUploadProgress && config.onUploadProgress((FileTransferredSize/FileTotalSize)*100)

					i+=ChunksAllowedSize
				}
			 
			}
          
         }
		
		else if(json.FileError){
			Busy = false
			config.onFileError && config.onFileError(json.errorCode)
		}
		else if (json.streamStateChanged)
		config.onRemoteStreamChanges && config.onRemoteStreamChanges(json)
		else
	    config.onMessage && config.onMessage(json)
			   
		}

		
		//create another one wish send 250 000bytes per time and when ever the other per gets it inform me to send next package
		//read on that website about dc buffer
       
		Peer.output.sendFile = async File => {
			 if(Busy)
			 return console.log('you are already sending a file')
			 Busy = true
			 FileTotalSize = File.size
			 const FileType = File.type
			//inform other peer that we gonna send a huge file
			FileStream = (File.stream()).getReader()	
			const FileExtention = '.'+File.name.split('.').pop()
			channel.send(JSON.stringify({ FileRequest : true, FileType,  FileExtention , size: FileTotalSize }))
			console.log(File)
		}

		Peer.output.abortFile = async File => {
			if(!Busy) //no file to abroad
			return
			Busy = false   
			FileStream = null
			FileTransferredSize = 0
			return channel.send(JSON.stringify({ FileAbort : true }))
	     }


	       //this one is for files under 20mb sor the broswer memory will not be full
			//the data chanel can send as max of 257 039 in the base 64, lets make chankes of 250000 then

			//why is he able to send huge data, check hisguthub stun server
			//https://freesoft.dev/program/60125647

			Peer.output.sendMessage = content => {
				const message = content.toString()
				const filtred = message.trim()
				if (filtred.length == 0)
					return {
						error: 'empty message'
					}
				channel.send(JSON.stringify(filtred)) //return undifined
				return {
					lenght: filtred.length,
					size: new Blob([filtred]).size + ' Bytes'
				}
				
			}


	}


	managePeerStream(Peer,streams) {
		Peer.output.myMediaStreams = []
		let index = 0
		for (const stream of streams)
			if (stream.getTracks().length) {
				const i = index
				Peer.output.myMediaStreams[i] = {}
				for (const track of stream.getTracks()) {
					const type = track.kind //audio or video
					Peer.output.myMediaStreams[i][type] = {}
					Peer.output.myMediaStreams[i][type].sender = Peer.addTrack(track, stream);
				}
		     index++		
			} 
	}

//need to be called after data chanel is conneected
managePeerStreamChanges(Peer,channel) {
		for(let i= 0 ; i < Peer.output.myMediaStreams.length ; i++)
		for(let element in Peer.output.myMediaStreams[i]) //element is the audio or video
        {
			const ref = Peer.output.myMediaStreams[i][element]
			ref.resume = function() {
				ref.sender.track.enabled = true // rtpSender.track will point on our actual track
							channel.send(JSON.stringify({
								streamStateChanged: true,
								streamIndex: i,
								type : element ,
								state: true
							})) //remoteMediaStreamVideoStateChanged
						}
						ref.stop = function() {
							ref.sender.track.enabled = false
							channel.send(JSON.stringify({
								streamStateChanged: true,
								streamIndex: i,
								type : element,
								state: false
							}))
						}

						ref.replaceTrack = function(newTrack) {
							if (newTrack.constructor.name)
							ref.sender.replaceTrack(newTrack);
						   }
		}
	}


	createCall(config = {}, streams) {

		return new Promise(async (resolve, reject) => {

			const Peer = new RTCPeerConnection(this.servers);

			this.managePeer(Peer,config)

			const channel = await Peer.createDataChannel("channel", {
				ordered: true,
				maxPacketLifeTime: 10000
			  });

			this.managaPeerChanel(Peer, config , channel)

			if (streams && Array.isArray(streams) && streams.length)
			{
				this.managePeerStream(Peer, streams)
			    this.managePeerStreamChanges(Peer,channel) //need to be processed after getting chanel 
			}

			Peer.output.verifyAnswer = async sdp => {
				try {
					const answer = new RTCSessionDescription({
						type: 'answer',
						sdp: sdp
					})
					await Peer.setRemoteDescription(answer)
					return {
						error: false
					}
				} catch (error) {
					return {
						error: error.toString()
					}
				}
			}

			const offer = await Peer.createOffer()
			await Peer.setLocalDescription(offer)

			Peer.onicecandidate = e => {
				if (!e.candidate) {
					Peer.output.sdp = Peer.localDescription.sdp.toString() //id is encoded SDP
					Peer.output.channel = channel
					resolve(Peer.output)
				}
			}

		})
	}


	answerCall(sdp, config = {}, streams) {

		return new Promise(async (resolve, reject) => {

			const Peer = new RTCPeerConnection(this.servers);

			this.managePeer(Peer, config)

			Peer.ondatachannel = e => {
				const channel = e.channel
				this.managaPeerChanel(Peer, config, channel)
				if(streams && Array.isArray(streams) && streams.length)
				this.managePeerStreamChanges(Peer,channel) ////need to be processed after chanel connexion
			}

			if (streams && Array.isArray(streams) && streams.length)
			this.managePeerStream(Peer,streams)

			const offer = new RTCSessionDescription({
				type: 'offer',
				sdp: sdp
			})

			await Peer.setRemoteDescription(offer)

			const answer = await Peer.createAnswer()
			await Peer.setLocalDescription(answer)

			Peer.onicecandidate = e => {
				if (!e.candidate) {
					Peer.output.sdp = Peer.localDescription.sdp.toString()
					resolve(Peer.output)
				}
			}

		})
	}
}


