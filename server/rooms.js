function RoomManager() {
    this.rooms = {};
}

RoomManager.prototype.createRoom = function(roomId) {
    if (!this.rooms[roomId]) {
        this.rooms[roomId] = {
            users: {},
            createdAt: Date.now()
        };
    }
    return this.rooms[roomId];
};

RoomManager.prototype.addUserToRoom = function(roomId, userData) {
    this.createRoom(roomId);
    this.rooms[roomId].users[userData.id] = userData;
    return this.rooms[roomId];
};

RoomManager.prototype.removeUserFromRoom = function(roomId, odId) {
    if (this.rooms[roomId] && this.rooms[roomId].users[odId]) {
        delete this.rooms[roomId].users[odId];
        
        if (Object.keys(this.rooms[roomId].users).length === 0) {
            delete this.rooms[roomId];
        }
    }
};

RoomManager.prototype.getUsersInRoom = function(roomId) {
    if (!this.rooms[roomId]) {
        return [];
    }
    var users = [];
    var userIds = Object.keys(this.rooms[roomId].users);
    for (var i = 0; i < userIds.length; i++) {
        users.push(this.rooms[roomId].users[userIds[i]]);
    }
    return users;
};

RoomManager.prototype.updateUserCursor = function(roomId, odId, position) {
    if (this.rooms[roomId] && this.rooms[roomId].users[odId]) {
        this.rooms[roomId].users[odId].cursor = position;
    }
};

RoomManager.prototype.updateUserDrawingState = function(roomId, odId, isDrawing) {
    if (this.rooms[roomId] && this.rooms[roomId].users[odId]) {
        this.rooms[roomId].users[odId].isDrawing = isDrawing;
    }
};

module.exports = RoomManager;