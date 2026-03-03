var express = require('express');
var http = require('http');
var socketIo = require('socket.io');
var path = require('path');

var app = express();
var server = http.createServer(app);
var io = socketIo(server, {
    cors: {
        origin: [
            "https://collaborative-canvas-ruddy.vercel.app/",
            "http://localhost:3000"
        ],
        methods: ["GET", "POST"]
    }
});

var PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, '../client')));

var rooms = {};

var userColors = [
    '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
    '#1abc9c', '#e91e63', '#00bcd4', '#ff5722', '#607d8b'
];

function getRoom(roomId) {
    if (!rooms[roomId]) {
        rooms[roomId] = {
            users: {},
            history: [],
            activeStrokes: {},
            orderCounter: 0
        };
    }
    return rooms[roomId];
}

function assignColor(roomId) {
    var room = getRoom(roomId);
    var usedColors = [];
    var userIds = Object.keys(room.users);
    for (var i = 0; i < userIds.length; i++) {
        usedColors.push(room.users[userIds[i]].color);
    }
    for (var j = 0; j < userColors.length; j++) {
        if (usedColors.indexOf(userColors[j]) === -1) {
            return userColors[j];
        }
    }
    return userColors[Math.floor(Math.random() * userColors.length)];
}

function getUserList(roomId) {
    var room = getRoom(roomId);
    var list = [];
    var ids = Object.keys(room.users);
    for (var i = 0; i < ids.length; i++) {
        list.push(room.users[ids[i]]);
    }
    return list;
}

function getVisibleHistory(roomId) {
    var room = getRoom(roomId);
    var visible = [];
    for (var i = 0; i < room.history.length; i++) {
        if (!room.history[i].undone) {
            visible.push(room.history[i]);
        }
    }
    visible.sort(function(a, b) {
        return a.order - b.order;
    });
    return visible;
}

io.on('connection', function(socket) {
    console.log('Connected:', socket.id);
    
    var currentRoom = null;
    var userData = null;

    socket.on('join_room', function(data) {
        var roomId = data.roomId || 'default';
        var username = data.username || 'User_' + socket.id.slice(0, 4);
        
        currentRoom = roomId;
        var room = getRoom(roomId);
        
        var color = assignColor(roomId);
        userData = {
            id: socket.id,
            username: username,
            color: color
        };
        
        room.users[socket.id] = userData;
        socket.join(roomId);
        
        console.log(username, 'joined room', roomId);
        
        socket.emit('room_joined', {
            roomId: roomId,
            userId: socket.id,
            user: userData,
            users: getUserList(roomId)
        });
        
        socket.emit('sync_history', {
            history: getVisibleHistory(roomId)
        });
        
        socket.to(roomId).emit('user_joined', {
            user: userData,
            users: getUserList(roomId)
        });
    });

    socket.on('draw_start', function(data) {
        if (!currentRoom || !userData) return;
        
        var room = getRoom(currentRoom);
        room.orderCounter++;
        
        var stroke = {
            id: data.strokeId,
            odId: socket.id,
            username: userData.username,
            color: data.color,
            width: data.width,
            tool: data.tool || 'brush',
            points: [{ x: data.x, y: data.y }],
            order: room.orderCounter,
            undone: false,
            timestamp: Date.now()
        };
        
        room.activeStrokes[data.strokeId] = stroke;
        
        console.log('draw_start:', data.strokeId, 'by', userData.username);
        
        socket.to(currentRoom).emit('draw_start', {
            strokeId: stroke.id,
            odId: stroke.odId,
            username: stroke.username,
            x: data.x,
            y: data.y,
            color: stroke.color,
            width: stroke.width,
            tool: stroke.tool,
            order: stroke.order
        });
    });

    socket.on('draw_move', function(data) {
        if (!currentRoom || !userData) return;
        
        var room = getRoom(currentRoom);
        var stroke = room.activeStrokes[data.strokeId];
        
        if (stroke) {
            stroke.points.push({ x: data.x, y: data.y });
            
            socket.to(currentRoom).emit('draw_move', {
                strokeId: data.strokeId,
                x: data.x,
                y: data.y,
                odId: socket.id
            });
        }
    });

    socket.on('draw_end', function(data) {
        if (!currentRoom || !userData) return;
        
        var room = getRoom(currentRoom);
        var stroke = room.activeStrokes[data.strokeId];
        
        if (stroke) {
            delete room.activeStrokes[data.strokeId];
            room.history.push(stroke);
            
            console.log('draw_end:', data.strokeId, '- History size:', room.history.length);
            
            socket.to(currentRoom).emit('draw_end', {
                strokeId: data.strokeId,
                odId: socket.id
            });
        }
    });

    socket.on('undo', function() {
        if (!currentRoom || !userData) return;
        
        var room = getRoom(currentRoom);
        
        var lastStrokeIndex = -1;
        for (var i = room.history.length - 1; i >= 0; i--) {
            if (room.history[i].odId === socket.id && !room.history[i].undone) {
                lastStrokeIndex = i;
                break;
            }
        }
        
        if (lastStrokeIndex >= 0) {
            room.history[lastStrokeIndex].undone = true;
            console.log('Undo by', userData.username, '- stroke:', room.history[lastStrokeIndex].id);
            
            io.to(currentRoom).emit('sync_history', {
                history: getVisibleHistory(currentRoom),
                action: 'undo',
                byUser: userData.username
            });
        }
    });

    socket.on('redo', function() {
        if (!currentRoom || !userData) return;
        
        var room = getRoom(currentRoom);
        
        var firstUndoneIndex = -1;
        for (var i = 0; i < room.history.length; i++) {
            if (room.history[i].odId === socket.id && room.history[i].undone) {
                firstUndoneIndex = i;
                break;
            }
        }
        
        if (firstUndoneIndex >= 0) {
            room.history[firstUndoneIndex].undone = false;
            console.log('Redo by', userData.username);
            
            io.to(currentRoom).emit('sync_history', {
                history: getVisibleHistory(currentRoom),
                action: 'redo',
                byUser: userData.username
            });
        }
    });

    socket.on('clear_mine', function() {
        if (!currentRoom || !userData) return;
        
        var room = getRoom(currentRoom);
        var count = 0;
        
        for (var i = 0; i < room.history.length; i++) {
            if (room.history[i].odId === socket.id && !room.history[i].undone) {
                room.history[i].undone = true;
                count++;
            }
        }
        
        console.log('Clear by', userData.username, '-', count, 'strokes');
        
        io.to(currentRoom).emit('sync_history', {
            history: getVisibleHistory(currentRoom),
            action: 'clear',
            byUser: userData.username,
            count: count
        });
    });

    socket.on('cursor_move', function(data) {
        if (!currentRoom || !userData) return;
        
        socket.to(currentRoom).emit('cursor_update', {
            odId: socket.id,
            username: userData.username,
            color: userData.color,
            x: data.x,
            y: data.y
        });
    });

    socket.on('disconnect', function() {
        console.log('Disconnected:', socket.id);
        
        if (currentRoom && userData) {
            var room = getRoom(currentRoom);
            delete room.users[socket.id];
            delete room.activeStrokes[socket.id];
            
            socket.to(currentRoom).emit('user_left', {
                odId: socket.id,
                username: userData.username,
                users: getUserList(currentRoom)
            });
            
            if (Object.keys(room.users).length === 0) {
                delete rooms[currentRoom];
                console.log('Room deleted:', currentRoom);
            }
        }
    });
});

server.listen(PORT, function() {
    console.log('Server: http://localhost:' + PORT);
});