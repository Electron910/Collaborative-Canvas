(function() {
    var canvas = null;
    var ws = null;
    var users = [];
    var myUser = null;
    var myUserId = null;
    var drawingStates = {};

    var joinModal, mainContainer, usernameInput, roomInput, joinBtn;
    var toolButtons, colorButtons, customColorInput;
    var strokeWidthInput, strokeWidthValue, strokePreview;
    var undoBtn, redoBtn, clearBtn;
    var usersList, currentRoomSpan, yourColorSpan, yourIdSpan, notificationArea;

    function init() {
        cacheDOM();
        bindEvents();
        updateStrokePreview(5, '#000000');
    }

    function cacheDOM() {
        joinModal = document.getElementById('join-modal');
        mainContainer = document.getElementById('main-container');
        usernameInput = document.getElementById('username-input');
        roomInput = document.getElementById('room-input');
        joinBtn = document.getElementById('join-btn');
        
        toolButtons = document.querySelectorAll('.tool-btn');
        colorButtons = document.querySelectorAll('.color-btn');
        customColorInput = document.getElementById('custom-color-input');
        strokeWidthInput = document.getElementById('stroke-width');
        strokeWidthValue = document.getElementById('stroke-width-value');
        strokePreview = document.getElementById('stroke-preview');
        
        undoBtn = document.getElementById('undo-btn');
        redoBtn = document.getElementById('redo-btn');
        clearBtn = document.getElementById('clear-btn');
        
        usersList = document.getElementById('users-list');
        currentRoomSpan = document.getElementById('current-room');
        yourColorSpan = document.getElementById('your-color');
        yourIdSpan = document.getElementById('your-id');
        notificationArea = document.getElementById('notification-area');
    }

    function bindEvents() {
        joinBtn.addEventListener('click', joinRoom);
        usernameInput.addEventListener('keypress', function(e) { 
            if (e.key === 'Enter') joinRoom(); 
        });
        roomInput.addEventListener('keypress', function(e) { 
            if (e.key === 'Enter') joinRoom(); 
        });
        
        for (var i = 0; i < toolButtons.length; i++) {
            (function(btn) {
                btn.addEventListener('click', function() { selectTool(btn); });
            })(toolButtons[i]);
        }
        
        for (var j = 0; j < colorButtons.length; j++) {
            (function(btn) {
                btn.addEventListener('click', function() { selectColor(btn); });
            })(colorButtons[j]);
        }
        
        customColorInput.addEventListener('input', function(e) { 
            setCustomColor(e.target.value); 
        });
        strokeWidthInput.addEventListener('input', function(e) { 
            setStrokeWidth(parseInt(e.target.value, 10)); 
        });
        
        undoBtn.addEventListener('click', doUndo);
        redoBtn.addEventListener('click', doRedo);
        clearBtn.addEventListener('click', doClear);
        
        document.addEventListener('keydown', handleKeys);
    }

    function joinRoom() {
        var username = usernameInput.value.trim();
        var roomId = roomInput.value.trim();
        
        if (!username) {
            username = 'User_' + Math.random().toString(36).substr(2, 5);
        }
        if (!roomId) {
            roomId = 'default';
        }
        
        ws = new WebSocketManager();
        setupWSHandlers();
        
        ws.connect().then(function() {
            joinModal.classList.add('hidden');
            mainContainer.classList.remove('hidden');
            
            setTimeout(function() {
                canvas = new CanvasManager('drawing-canvas', 'cursor-canvas');
                setupCanvasHandlers();
                ws.joinRoom(roomId, username);
            }, 100);
        }).catch(function(err) {
            console.error('Failed to connect:', err);
            notify('Connection failed', 'warning');
        });
    }

    function setupWSHandlers() {
        ws.on('onConnect', function() {
            console.log('Connected to server');
        });

        ws.on('onDisconnect', function(reason) {
            console.log('Disconnected:', reason);
            notify('Disconnected from server', 'warning');
        });

        ws.on('onRoomJoined', function(data) {
            myUser = data.user;
            myUserId = data.odId;
            users = data.users;
            
            console.log('=== Room Joined ===');
            console.log('My User ID:', myUserId);
            console.log('My Username:', data.user.username);
            console.log('Room:', data.roomId);
            console.log('History length:', data.drawingHistory ? data.drawingHistory.length : 0);
            
            currentRoomSpan.textContent = data.roomId;
            yourColorSpan.style.backgroundColor = data.user.color;
            yourIdSpan.textContent = myUserId;
            
            if (canvas) {
                canvas.setMyInfo(myUserId, data.user.username, data.user.color);
                if (data.drawingHistory && data.drawingHistory.length > 0) {
                    canvas.setFullHistory(data.drawingHistory);
                }
            }
            
            renderUsers();
            notify('Joined room: ' + data.roomId, 'success');
        });

        ws.on('onUserJoined', function(data) {
            users = data.users;
            renderUsers();
            notify(data.user.username + ' joined', 'info');
        });

        ws.on('onUserLeft', function(data) {
            users = data.users;
            delete drawingStates[data.odId];
            renderUsers();
            if (canvas) {
                canvas.removeCursor(data.odId);
            }
            notify(data.username + ' left', 'info');
        });

        ws.on('onDrawingStart', function(data) {
            if (canvas) {
                canvas.onRemoteDrawStart(data);
            }
            drawingStates[data.odId] = true;
            renderUsers();
        });

        ws.on('onDrawingMove', function(data) {
            if (canvas) {
                canvas.onRemoteDrawMove(data);
            }
        });

        ws.on('onDrawingEnd', function(data) {
            if (canvas) {
                canvas.onRemoteDrawEnd(data);
            }
            drawingStates[data.odId] = false;
            renderUsers();
        });

        ws.on('onCursorUpdate', function(data) {
            if (canvas) {
                canvas.updateCursor(data.odId, data);
            }
        });

        ws.on('onUserDrawingState', function(data) {
            drawingStates[data.odId] = data.isDrawing;
            if (canvas && data.isDrawing && data.position) {
                canvas.remoteDrawingStates[data.odId] = {
                    username: data.username,
                    color: data.color,
                    isDrawing: true,
                    position: data.position
                };
            } else if (canvas && !data.isDrawing) {
                if (canvas.remoteDrawingStates[data.odId]) {
                    canvas.remoteDrawingStates[data.odId].isDrawing = false;
                }
            }
            renderUsers();
        });

        ws.on('onHistoryUpdate', function(data) {
            console.log('=== History Update ===');
            console.log('Action:', data.action);
            console.log('By:', data.username);
            console.log('New history length:', data.history.length);
            
            if (canvas) {
                canvas.setFullHistory(data.history);
            }
            
            if (data.action === 'undo') {
                notify(data.username + ' undid a stroke', 'info');
            } else if (data.action === 'redo') {
                notify(data.username + ' redid a stroke', 'info');
            } else if (data.action === 'clear') {
                if (data.odId === myUserId) {
                    notify('Your drawings have been cleared (' + data.removedCount + ' strokes)', 'success');
                } else {
                    notify(data.username + ' cleared their drawings', 'info');
                }
            }
        });

        ws.on('onError', function(err) {
            console.error('WebSocket error:', err);
            notify('Connection error', 'warning');
        });
    }

    function setupCanvasHandlers() {
        canvas.onDrawStart = function(data) {
            ws.sendDrawStart(data);
        };

        canvas.onDrawMove = function(data) {
            ws.sendDrawMove(data);
        };

        canvas.onDrawEnd = function(data) {
            ws.sendDrawEnd(data);
        };

        canvas.onCursorMove = function(position) {
            ws.sendCursorMove(position);
        };
    }

    function selectTool(btn) {
        for (var i = 0; i < toolButtons.length; i++) {
            toolButtons[i].classList.remove('active');
        }
        btn.classList.add('active');
        
        var tool = btn.getAttribute('data-tool');
        if (canvas) {
            canvas.setTool(tool);
        }
    }

    function selectColor(btn) {
        for (var i = 0; i < colorButtons.length; i++) {
            colorButtons[i].classList.remove('active');
        }
        btn.classList.add('active');
        
        var color = btn.getAttribute('data-color');
        if (canvas) {
            canvas.setColor(color);
        }
        customColorInput.value = color;
        updateStrokePreview(parseInt(strokeWidthInput.value, 10), color);
    }

    function setCustomColor(color) {
        for (var i = 0; i < colorButtons.length; i++) {
            colorButtons[i].classList.remove('active');
        }
        if (canvas) {
            canvas.setColor(color);
        }
        updateStrokePreview(parseInt(strokeWidthInput.value, 10), color);
    }

    function setStrokeWidth(width) {
        strokeWidthValue.textContent = width + 'px';
        if (canvas) {
            canvas.setStrokeWidth(width);
        }
        var currentColor = canvas ? canvas.color : '#000000';
        updateStrokePreview(width, currentColor);
    }

    function updateStrokePreview(width, color) {
        strokePreview.style.width = width + 'px';
        strokePreview.style.height = width + 'px';
        strokePreview.style.backgroundColor = color || '#000000';
    }

    function doUndo() {
        if (ws) {
            ws.sendUndo();
        }
    }

    function doRedo() {
        if (ws) {
            ws.sendRedo();
        }
    }

    function doClear() {
        var confirmed = confirm('Clear all your drawings? Other users\' drawings will remain.');
        if (confirmed && ws) {
            console.log('Requesting to clear my drawings...');
            ws.sendClearMyDrawings();
        }
    }

    function handleKeys(e) {
        var isCtrl = e.ctrlKey || e.metaKey;
        
        if (isCtrl && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            if (e.shiftKey) {
                doRedo();
            } else {
                doUndo();
            }
        }
        
        if (isCtrl && e.key.toLowerCase() === 'y') {
            e.preventDefault();
            doRedo();
        }
    }

    function renderUsers() {
        usersList.innerHTML = '';
        
        for (var i = 0; i < users.length; i++) {
            var user = users[i];
            var div = document.createElement('div');
            div.className = 'user-item';
            
            if (myUser && user.id === myUser.id) {
                div.classList.add('you');
            }
            
            if (drawingStates[user.id]) {
                div.classList.add('drawing');
            }
            
            var dot = document.createElement('span');
            dot.className = 'user-color-dot';
            dot.style.backgroundColor = user.color;
            
            var name = document.createElement('span');
            name.className = 'user-name';
            name.textContent = user.username;
            
            if (myUser && user.id === myUser.id) {
                name.textContent += ' (You)';
            }
            
            div.appendChild(dot);
            div.appendChild(name);
            
            if (drawingStates[user.id]) {
                var indicator = document.createElement('span');
                indicator.className = 'drawing-indicator';
                indicator.title = 'Currently drawing';
                div.appendChild(indicator);
            }
            
            usersList.appendChild(div);
        }
    }

    function notify(message, type) {
        var el = document.createElement('div');
        el.className = 'notification ' + (type || 'info');
        el.textContent = message;
        
        notificationArea.appendChild(el);
        
        setTimeout(function() {
            el.style.animation = 'fadeOut 0.3s ease forwards';
            setTimeout(function() {
                if (el.parentNode) {
                    el.parentNode.removeChild(el);
                }
            }, 300);
        }, 3000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();