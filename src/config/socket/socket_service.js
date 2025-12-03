let io;

function setSocketIO(socketInstance) {
    io = socketInstance;
}

function getSocketIO() {
    if (!io) throw new Error("Socket.io not initialized");
    return io;
}

module.exports = { setSocketIO, getSocketIO };
