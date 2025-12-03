const {Server} = require('socket.io');
const { createOffer, acceptOffer, rejectOffer, clearPreviousChatWebSocket } = require('../../utils/helperFunctions');
const {setSocketIO} = require('./socket_service');
const { closeWS, clearRealTimeSessions, clearChatHistory, setupAudioAckListener, prewarmSession } = require('../../modules/v1/AI/controller');

let io;

const initializeSocketServer=(server)=>{

    io = new Server(server,  {
        cors: {
            origin: "*", // 🔥 Allow all origins
            methods: ["GET", "POST"],
        },
    });

    setSocketIO(io);

    // ✅ Handle socket connections
    io.on("connection", (socket) => {
        console.log("🟢 Socket connected:", socket.id);

        //To Join a room
        socket.on("createRoom", (data) => {
            console.log("Socket joined room:", data);
            socket.join(data.roomId);

            closeWS(data.roomId);
            clearRealTimeSessions(data.roomId);
            clearChatHistory(data.roomId);
            
            setupAudioAckListener(socket, data.roomId);
            
            prewarmSession(data.roomId);
        });
        //To Leave a room
        socket.on("closeChat", (data) => {
            console.log("📩 Socket leaved room:", data);
            socket.leave(data.roomId);
        });


        //To Send a message
        socket.on("sendMessage", (data) => {
            console.log("📩 Socket sending message:", data);
            socket.to(data.roomId).emit('getMessage', data);
        });


        //To Send Offer
        socket.on("sendOffer", async(data) => {
            console.log("📩 Socket send offer:", data);
            const offerId = await createOffer(data);
            socket.to(data.roomId).emit('getOffer', {...data, offerId});
        });
        //To Accept offer
        socket.on("acceptOffer", (data) => {
            console.log("📩 Socket accept offer:", data);
            acceptOffer(data);
            socket.to(data.roomId).emit('offerAccepted', data);
        })
        //To Decline offer
        socket.on("declineOffer", (data) => {
            console.log("📩 Socket declined offer:", data);
            rejectOffer(data);
            socket.to(data.roomId).emit('offerDeclined', data);
        });


        // Disconnect
        socket.on("disconnect", () => {
            console.log("🔴 Socket disconnected:", socket.id);
        });
    });
}

module.exports = {initializeSocketServer}