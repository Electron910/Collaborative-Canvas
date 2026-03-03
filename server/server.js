var express = require('express');
var http = require('http');
var socketIo = require('socket.io');
var path = require('path');
var RoomManager = require('./rooms');
var StateManager = require('./state-manager');

var app = express();
var server = http.createServer(app);
var io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

var PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, '../client')));

var roomManager = new RoomManager();
var stateManager = new StateManager();

var userColors = [
    '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
    '#1abc9c', '#e91e63', '#00bcd4', '#ff5722', '#607d8b'
];

function assignUserColor(roomId) {
    var usersInRoom = roomManager.getUsersInRoom(roomId);
    var usedColors = [];
    for (var i = 0; i < usersInRoom.length; i++) {
        usedColors.push(usersInRoom[i].color);
    }
    for (var j = 0; j < userColors.length; j++) {
        if (usedColors.indexOf(userColors[j]) === -1) {
            return userColors[j];
        }
    }
    return userColors[Math.floor(Math.random() * userColors.length)];
}

io.on('connection', function(socket) {
    console.log('User connected:', socket.id);
    
    var currentRoom = null;
    var userData = null;

    socket.on('join_room', function(data) {
        var roomId = data.roomId || 'default';
        var username = data.username || 'User_' + socket.id.slice(0, 4);
        
        currentRoom = roomId;
        
        var color = assignUserColor(currentRoom);
        userData = {
            id: socket.id,
            username: username,
            color: color,
            cursor: { x: 0, y: 0 },
            isDrawing: false
        };

        socket.join(currentRoom);
        roomManager.addUserToRoom(currentRoom, userData);
        stateManager.initializeRoom(currentRoom);

        var historyData = stateManager.getHistory(currentRoom);
        
        console.log('User joined:', username, 'ID:', socket.id, 'Room:', roomId);
        console.log('Current history length:', historyData.length);
        
        socket.emit('room_joined', {
            roomId: currentRoom,
            odId: socket.id,
            user: userData,
            users: roomManager.getUsersInRoom(currentRoom),
            drawingHistory: historyData
        });

        socket.to(currentRoom).emit('user_joined', {
            user: userData,
            users: roomManager.getUsersInRoom(currentRoom)
        });
    });

    socket.on('drawing_start', function(data) {
        if (!currentRoom || !userData) return;
        
        userData.isDrawing = true;
        roomManager.updateUserDrawingState(currentRoom, socket.id, true);
        
        var zIndex = stateManager.getNextZIndex(currentRoom);
        
        var strokeData = {
            id: data.strokeId,
            odId: socket.id,
            username: userData.username,
            userColor: userData.color,
            points: [data.point],
            style: data.style,
            tool: data.tool,
            timestamp: Date.now(),
            zIndex: zIndex
        };

        console.log('Stroke started:', data.strokeId, 'by user:', socket.id);
        
        stateManager.startStroke(currentRoom, strokeData);
        
        socket.to(currentRoom).emit('drawing_start', strokeData);
        
        socket.to(currentRoom).emit('user_drawing_state', {
            odId: socket.id,
            username: userData.username,
            color: userData.color,
            isDrawing: true,
            position: data.point
        });
    });

    socket.on('drawing_move', function(data) {
        if (!currentRoom || !userData) return;
        
        stateManager.addPointToStroke(currentRoom, data.strokeId, data.point);
        
        socket.to(currentRoom).emit('drawing_move', {
            strokeId: data.strokeId,
            point: data.point,
            odId: socket.id
        });
    });

    socket.on('drawing_end', function(data) {
        if (!currentRoom || !userData) return;
        
        userData.isDrawing = false;
        roomManager.updateUserDrawingState(currentRoom, socket.id, false);
        
        var finishedStroke = stateManager.finishStroke(currentRoom, data.strokeId);
        
        console.log('Stroke ended:', data.strokeId, 'by user:', socket.id);
        if (finishedStroke) {
            console.log('Stroke saved with odId:', finishedStroke.odId);
        }
        
        socket.to(currentRoom).emit('drawing_end', {
            strokeId: data.strokeId,
            odId: socket.id
        });
        
        socket.to(currentRoom).emit('user_drawing_state', {
            odId: socket.id,
            username: userData.username,
            color: userData.color,
            isDrawing: false,
            position: null
        });
    });

    socket.on('cursor_move', function(data) {
        if (!currentRoom || !userData) return;
        
        userData.cursor = data.position;
        roomManager.updateUserCursor(currentRoom, socket.id, data.position);
        
        socket.to(currentRoom).emit('cursor_update', {
            odId: socket.id,
            username: userData.username,
            color: userData.color,
            position: data.position,
            isDrawing: userData.isDrawing
        });
    });

    socket.on('undo_request', function() {
        if (!currentRoom || !userData) return;
        
        console.log('Undo requested by:', socket.id, userData.username);
        
        var undoneStroke = stateManager.undoForUser(currentRoom, socket.id);
        
        if (undoneStroke) {
            console.log('Undone stroke:', undoneStroke.id);
            var newHistory = stateManager.getHistory(currentRoom);
            
            io.to(currentRoom).emit('history_update', {
                history: newHistory,
                action: 'undo',
                odId: socket.id,
                username: userData.username
            });
        } else {
            console.log('No strokes to undo for user:', socket.id);
        }
    });

    socket.on('redo_request', function() {
        if (!currentRoom || !userData) return;
        
        console.log('Redo requested by:', socket.id, userData.username);
        
        var redoneStroke = stateManager.redoForUser(currentRoom, socket.id);
        
        if (redoneStroke) {
            console.log('Redone stroke:', redoneStroke.id);
            var newHistory = stateManager.getHistory(currentRoom);
            
            io.to(currentRoom).emit('history_update', {
                history: newHistory,
                action: 'redo',
                odId: socket.id,
                username: userData.username
            });
        } else {
            console.log('No strokes to redo for user:', socket.id);
        }
    });

    socket.on('clear_my_drawings', function() {
        if (!currentRoom || !userData) return;
        
        console.log('');
        console.log('========================================');
        console.log('CLEAR MY DRAWINGS REQUEST');
        console.log('User ID:', socket.id);
        console.log('Username:', userData.username);
        console.log('========================================');
        
        var result = stateManager.clearUserDrawings(currentRoom, socket.id);
        
        console.log('Removed count:', result.removedCount);
        console.log('Remaining history:', result.history.length);
        console.log('========================================');
        console.log('');
        
        io.to(currentRoom).emit('history_update', {
            history: result.history,
            action: 'clear',
            odId: socket.id,
            username: userData.username,
            removedCount: result.removedCount
        });
    });

    socket.on('disconnect', function() {
        console.log('User disconnected:', socket.id);
        
        if (currentRoom && userData) {
            roomManager.removeUserFromRoom(currentRoom, socket.id);
            
            socket.to(currentRoom).emit('user_left', {
                odId: socket.id,
                username: userData.username,
                users: roomManager.getUsersInRoom(currentRoom)
            });
        }
    });
});

server.listen(PORT, function() {
    console.log('');
    console.log('========================================');
    console.log('Server running on http://localhost:' + PORT);
    console.log('========================================');
    console.log('');
});