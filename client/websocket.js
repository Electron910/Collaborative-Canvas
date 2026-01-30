function WebSocketManager() {
    this.socket = null;
    this.connected = false;
    this.myUserId = null;
    this.myUsername = null;
    this.currentRoom = null;
    
    this.handlers = {
        onConnect: null,
        onDisconnect: null,
        onRoomJoined: null,
        onUserJoined: null,
        onUserLeft: null,
        onDrawingStart: null,
        onDrawingMove: null,
        onDrawingEnd: null,
        onCursorUpdate: null,
        onUserDrawingState: null,
        onHistoryUpdate: null,
        onError: null
    };
}

WebSocketManager.prototype.connect = function() {
    var self = this;
    
    return new Promise(function(resolve, reject) {
        self.socket = io({
            transports: ['websocket', 'polling'],
            reconnection: true
        });

        self.socket.on('connect', function() {
            console.log('WebSocket connected, socket.id:', self.socket.id);
            self.connected = true;
            self.myUserId = self.socket.id;
            if (self.handlers.onConnect) {
                self.handlers.onConnect();
            }
            resolve();
        });

        self.socket.on('disconnect', function(reason) {
            console.log('WebSocket disconnected:', reason);
            self.connected = false;
            if (self.handlers.onDisconnect) {
                self.handlers.onDisconnect(reason);
            }
        });

        self.socket.on('connect_error', function(err) {
            console.error('Connection error:', err);
            if (self.handlers.onError) {
                self.handlers.onError(err);
            }
            reject(err);
        });

        self.setupListeners();
    });
};

WebSocketManager.prototype.setupListeners = function() {
    var self = this;
    
    this.socket.on('room_joined', function(data) {
        console.log('Room joined:', data.roomId, 'My ID:', data.odId);
        self.myUserId = data.odId;
        self.myUsername = data.user.username;
        self.currentRoom = data.roomId;
        if (self.handlers.onRoomJoined) {
            self.handlers.onRoomJoined(data);
        }
    });

    this.socket.on('user_joined', function(data) {
        if (self.handlers.onUserJoined) {
            self.handlers.onUserJoined(data);
        }
    });

    this.socket.on('user_left', function(data) {
        if (self.handlers.onUserLeft) {
            self.handlers.onUserLeft(data);
        }
    });

    this.socket.on('drawing_start', function(data) {
        if (self.handlers.onDrawingStart) {
            self.handlers.onDrawingStart(data);
        }
    });

    this.socket.on('drawing_move', function(data) {
        if (self.handlers.onDrawingMove) {
            self.handlers.onDrawingMove(data);
        }
    });

    this.socket.on('drawing_end', function(data) {
        if (self.handlers.onDrawingEnd) {
            self.handlers.onDrawingEnd(data);
        }
    });

    this.socket.on('cursor_update', function(data) {
        if (self.handlers.onCursorUpdate) {
            self.handlers.onCursorUpdate(data);
        }
    });

    this.socket.on('user_drawing_state', function(data) {
        if (self.handlers.onUserDrawingState) {
            self.handlers.onUserDrawingState(data);
        }
    });

    this.socket.on('history_update', function(data) {
        console.log('History update received:', data.action, 'by:', data.username);
        console.log('New history length:', data.history.length);
        if (self.handlers.onHistoryUpdate) {
            self.handlers.onHistoryUpdate(data);
        }
    });
};

WebSocketManager.prototype.joinRoom = function(roomId, username) {
    if (!this.connected) return;
    console.log('Joining room:', roomId, 'as:', username);
    this.socket.emit('join_room', { roomId: roomId, username: username });
};

WebSocketManager.prototype.sendDrawStart = function(data) {
    if (this.connected) {
        this.socket.emit('drawing_start', data);
    }
};

WebSocketManager.prototype.sendDrawMove = function(data) {
    if (this.connected) {
        this.socket.emit('drawing_move', data);
    }
};

WebSocketManager.prototype.sendDrawEnd = function(data) {
    if (this.connected) {
        this.socket.emit('drawing_end', data);
    }
};

WebSocketManager.prototype.sendCursorMove = function(position) {
    if (this.connected) {
        this.socket.emit('cursor_move', { position: position });
    }
};

WebSocketManager.prototype.sendUndo = function() {
    if (this.connected) {
        console.log('Sending undo request');
        this.socket.emit('undo_request');
    }
};

WebSocketManager.prototype.sendRedo = function() {
    if (this.connected) {
        console.log('Sending redo request');
        this.socket.emit('redo_request');
    }
};

WebSocketManager.prototype.sendClearMyDrawings = function() {
    if (this.connected) {
        console.log('Sending clear my drawings request');
        this.socket.emit('clear_my_drawings');
    }
};

WebSocketManager.prototype.on = function(event, handler) {
    if (this.handlers.hasOwnProperty(event)) {
        this.handlers[event] = handler;
    }
};

WebSocketManager.prototype.getMyUserId = function() {
    return this.myUserId;
};