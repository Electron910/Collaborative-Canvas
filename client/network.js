var Network = (function() {
    
    var socket = null;
    var myUserId = null;
    var handlers = {};
    var SERVER_URL = 'https://your-backend-url.railway.app';
    
    function connect() {
        return new Promise(function(resolve, reject) {
            socket = io(SERVER_URL, {
                transports: ['websocket', 'polling']
            });
            
            socket.on('connect', function() {
                console.log('Connected:', socket.id);
                resolve();
            });
            
            socket.on('connect_error', function(err) {
                reject(err);
            });
            
            socket.on('room_joined', function(data) {
                myUserId = data.userId;
                if (handlers.onRoomJoined) handlers.onRoomJoined(data);
            });
            
            socket.on('sync_history', function(data) {
                if (handlers.onSyncHistory) handlers.onSyncHistory(data);
            });
            
            socket.on('user_joined', function(data) {
                if (handlers.onUserJoined) handlers.onUserJoined(data);
            });
            
            socket.on('user_left', function(data) {
                if (handlers.onUserLeft) handlers.onUserLeft(data);
            });
            
            socket.on('draw_start', function(data) {
                if (handlers.onDrawStart) handlers.onDrawStart(data);
            });
            
            socket.on('draw_move', function(data) {
                if (handlers.onDrawMove) handlers.onDrawMove(data);
            });
            
            socket.on('draw_end', function(data) {
                if (handlers.onDrawEnd) handlers.onDrawEnd(data);
            });
            
            socket.on('cursor_update', function(data) {
                if (handlers.onCursorUpdate) handlers.onCursorUpdate(data);
            });
        });
    }
    
    function joinRoom(roomId, username) {
        socket.emit('join_room', { roomId: roomId, username: username });
    }
    
    function sendDrawStart(strokeId, x, y, color, width, tool) {
        socket.emit('draw_start', {
            strokeId: strokeId,
            x: x,
            y: y,
            color: color,
            width: width,
            tool: tool
        });
    }
    
    function sendDrawMove(strokeId, x, y) {
        socket.emit('draw_move', {
            strokeId: strokeId,
            x: x,
            y: y
        });
    }
    
    function sendDrawEnd(strokeId) {
        socket.emit('draw_end', { strokeId: strokeId });
    }
    
    function sendUndo() {
        socket.emit('undo');
    }
    
    function sendRedo() {
        socket.emit('redo');
    }
    
    function sendClearMine() {
        socket.emit('clear_mine');
    }
    
    function sendCursorMove(x, y) {
        socket.emit('cursor_move', { x: x, y: y });
    }
    
    function on(event, handler) {
        handlers[event] = handler;
    }
    
    function getMyUserId() {
        return myUserId;
    }
    
    return {
        connect: connect,
        joinRoom: joinRoom,
        sendDrawStart: sendDrawStart,
        sendDrawMove: sendDrawMove,
        sendDrawEnd: sendDrawEnd,
        sendUndo: sendUndo,
        sendRedo: sendRedo,
        sendClearMine: sendClearMine,
        sendCursorMove: sendCursorMove,
        on: on,
        getMyUserId: getMyUserId
    };
})();