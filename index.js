const express = require("express");
const socket = require('socket.io');
const http = require('http');
const app = express();
const server = http.createServer(app)


//return , return whole function of just block
const io = socket(server);
//get ip from socket and cookies and display it on alert
io.on('connection',async (socket)=>{  
  
  let joinedRoom = null
    
   socket.on('join', async (roomId) => { 
    const clients = io.sockets.adapter.rooms.get(roomId);  
    if(clients && clients.size>=2)
    {
      socket.emit('alert','this room aleady contains two peole')
      socket.to(roomId).emit('alert',socket.id+' tried to join this room')
    }  
     else
     {
      socket.join(roomId)
      joinedRoom = roomId
      socket.to(roomId).emit('userJoin',socket.id)
     }
  }) 

    //crteate a room, join it, then send the id
      
  socket.on('call', async ({socketId,callId}) => { 
    io.to(socketId).emit('call',{ callerSocketId : socket.id , callId }) //question about this
   })     

 socket.on('answer', async ({callerSocketId,answerId}) => { 
    io.to(callerSocketId).emit('answer',answerId)
    
 })   
    
   socket.on('disconnect', async()=>{ 
    if(joinedRoom)
    io.to(joinedRoom).emit('left')
   })

})

//never put socket.on inside a socket.on becuase the second one may fire twice


app.get('/',(req,res)=>res.sendFile(__dirname+'/client/index.html'))

app.get('/FileTransfer',(req,res)=>res.redirect('/'))

app.get('/FileTransfer/:roomId', express.static('client') ,function(req,res){
    const {roomId} = req.params
    const validation = validateRoomID(roomId)
    if(validation.error) 
    res.send(validation.error)
    res.sendFile(__dirname+'/client/FileTransfer.html')
}) 

app.get('/Calls',(req,res)=>res.redirect('/'))

app.get('/Calls/:roomId', express.static('client') ,function(req,res){
    const {roomId} = req.params
    const validation = validateRoomID(roomId)
    if(validation.error) 
    res.send(validation.error)
    res.sendFile(__dirname+'/client/Calls.html')
}) 


app.get('*', express.static('client') ,function(req,res){
    res.send('page not foung')
}) 


const port = process.env.PORT || 3000
server.listen(port);


function validateRoomID(ID){
  try {
    const roomId = ID.trim()
    if(!roomId || roomId.length < 5 || roomId.length > 10)
    return {error : 'REALLY NIGGA...'}
    const clients = io.sockets.adapter.rooms.get(roomId);  
    if(clients && clients.size>1)
    return {error : 'This Room is Already Full, pick a diffrent Id'}
    return {error : false}
  } catch (error) {
    return {error : error.toString()}
  }
}

module.exports = app;