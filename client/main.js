(function() {
    
    var currentTool = 'brush';
    var currentColor = '#000000';
    var currentWidth = 5;
    var isDrawing = false;
    var currentStrokeId = null;
    var strokeCounter = 0;
    var lastX = 0;
    var lastY = 0;
    
    var users = [];
    var myUser = null;
    
    var joinModal, mainContainer, usernameInput, roomInput, joinBtn;
    var toolButtons, colorButtons, customColorInput;
    var strokeWidthInput, strokeWidthValue, strokePreview;
    var undoBtn, redoBtn, clearBtn;
    var usersList, currentRoomSpan, yourColorSpan, notifications;
    
    function init() {
        cacheDOM();
        bindUI();
        updateStrokePreview();
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
        notifications = document.getElementById('notifications');
    }
    
    function bindUI() {
        joinBtn.addEventListener('click', joinRoom);
        usernameInput.addEventListener('keypress', function(e) { if (e.key === 'Enter') joinRoom(); });
        roomInput.addEventListener('keypress', function(e) { if (e.key === 'Enter') joinRoom(); });
        
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
            currentColor = e.target.value;
            clearActiveColorBtn();
            updateStrokePreview();
        });
        
        strokeWidthInput.addEventListener('input', function(e) {
            currentWidth = parseInt(e.target.value, 10);
            strokeWidthValue.textContent = currentWidth + 'px';
            updateStrokePreview();
        });
        
        undoBtn.addEventListener('click', function() { Network.sendUndo(); });
        redoBtn.addEventListener('click', function() { Network.sendRedo(); });
        clearBtn.addEventListener('click', function() {
            if (confirm('Clear all your drawings?')) {
                Network.sendClearMine();
            }
        });
        
        document.addEventListener('keydown', function(e) {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                if (e.shiftKey) {
                    Network.sendRedo();
                } else {
                    Network.sendUndo();
                }
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
                e.preventDefault();
                Network.sendRedo();
            }
        });
    }
    
    function joinRoom() {
        var username = usernameInput.value.trim() || 'User_' + Math.random().toString(36).substr(2, 5);
        var roomId = roomInput.value.trim() || 'default';
        
        setupNetwork();
        
        Network.connect().then(function() {
            joinModal.classList.add('hidden');
            mainContainer.classList.remove('hidden');
            
            setTimeout(function() {
                Renderer.init('main-canvas', 'cursor-canvas');
                Renderer.startCursorLoop();
                
                DrawingState.onChange(function() {
                    Renderer.render();
                });
                
                bindCanvas();
                Network.joinRoom(roomId, username);
            }, 50);
        }).catch(function(err) {
            notify('Connection failed', 'warning');
        });
    }
    
    function setupNetwork() {
        Network.on('onRoomJoined', function(data) {
            myUser = data.user;
            users = data.users;
            
            currentRoomSpan.textContent = data.roomId;
            yourColorSpan.style.backgroundColor = data.user.color;
            
            renderUsers();
            notify('Joined room: ' + data.roomId, 'success');
        });
        
        Network.on('onSyncHistory', function(data) {
            DrawingState.setHistory(data.history);
            
            if (data.action === 'undo') {
                notify(data.byUser + ' undid a stroke', 'info');
            } else if (data.action === 'redo') {
                notify(data.byUser + ' redid a stroke', 'info');
            } else if (data.action === 'clear') {
                notify(data.byUser + ' cleared their drawings', 'info');
            }
        });
        
        Network.on('onUserJoined', function(data) {
            users = data.users;
            renderUsers();
            notify(data.user.username + ' joined', 'info');
        });
        
        Network.on('onUserLeft', function(data) {
            users = data.users;
            DrawingState.removeCursor(data.odId);
            renderUsers();
            notify(data.username + ' left', 'info');
        });
        
        Network.on('onDrawStart', function(data) {
            DrawingState.startStroke({
                id: data.strokeId,
                odId: data.odId,
                username: data.username,
                color: data.color,
                width: data.width,
                tool: data.tool,
                x: data.x,
                y: data.y,
                order: data.order
            });
        });
        
        Network.on('onDrawMove', function(data) {
            DrawingState.addPoint(data.strokeId, data.x, data.y);
        });
        
        Network.on('onDrawEnd', function(data) {
            DrawingState.endStroke(data.strokeId);
        });
        
        Network.on('onCursorUpdate', function(data) {
            DrawingState.updateCursor(data.odId, data);
        });
    }
    
    function bindCanvas() {
        var canvas = Renderer.getCanvas();
        
        canvas.addEventListener('mousedown', onPointerDown);
        canvas.addEventListener('mousemove', onPointerMove);
        canvas.addEventListener('mouseup', onPointerUp);
        canvas.addEventListener('mouseleave', onPointerUp);
        
        canvas.addEventListener('touchstart', function(e) {
            e.preventDefault();
            if (e.touches.length === 1) onPointerDown(e);
        }, { passive: false });
        
        canvas.addEventListener('touchmove', function(e) {
            e.preventDefault();
            if (e.touches.length === 1) onPointerMove(e);
        }, { passive: false });
        
        canvas.addEventListener('touchend', function(e) {
            e.preventDefault();
            onPointerUp(e);
        }, { passive: false });
    }
    
    function generateStrokeId() {
        strokeCounter++;
        return 'stroke_' + Network.getMyUserId() + '_' + Date.now() + '_' + strokeCounter;
    }
    
    function onPointerDown(e) {
        var coords = Renderer.getCoords(e);
        
        isDrawing = true;
        currentStrokeId = generateStrokeId();
        lastX = coords.x;
        lastY = coords.y;
        
        var drawColor = currentTool === 'eraser' ? '#FFFFFF' : currentColor;
        
        Network.sendDrawStart(currentStrokeId, coords.x, coords.y, drawColor, currentWidth, currentTool);
        
        DrawingState.startStroke({
            id: currentStrokeId,
            odId: Network.getMyUserId(),
            username: myUser ? myUser.username : '',
            color: drawColor,
            width: currentWidth,
            tool: currentTool,
            x: coords.x,
            y: coords.y,
            order: Date.now()
        });
    }
    
    function onPointerMove(e) {
        var coords = Renderer.getCoords(e);
        
        Network.sendCursorMove(coords.x, coords.y);
        
        if (!isDrawing) return;
        
        Network.sendDrawMove(currentStrokeId, coords.x, coords.y);
        DrawingState.addPoint(currentStrokeId, coords.x, coords.y);
        
        lastX = coords.x;
        lastY = coords.y;
    }
    
    function onPointerUp(e) {
        if (!isDrawing) return;
        
        isDrawing = false;
        
        Network.sendDrawEnd(currentStrokeId);
        DrawingState.endStroke(currentStrokeId);
        
        currentStrokeId = null;
    }
    
    function selectTool(btn) {
        for (var i = 0; i < toolButtons.length; i++) {
            toolButtons[i].classList.remove('active');
        }
        btn.classList.add('active');
        currentTool = btn.getAttribute('data-tool');
    }
    
    function selectColor(btn) {
        clearActiveColorBtn();
        btn.classList.add('active');
        currentColor = btn.getAttribute('data-color');
        customColorInput.value = currentColor;
        updateStrokePreview();
    }
    
    function clearActiveColorBtn() {
        for (var i = 0; i < colorButtons.length; i++) {
            colorButtons[i].classList.remove('active');
        }
    }
    
    function updateStrokePreview() {
        strokePreview.style.width = currentWidth + 'px';
        strokePreview.style.height = currentWidth + 'px';
        strokePreview.style.backgroundColor = currentColor;
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
            usersList.appendChild(div);
        }
    }
    
    function notify(message, type) {
        var el = document.createElement('div');
        el.className = 'notification ' + (type || 'info');
        el.textContent = message;
        notifications.appendChild(el);
        
        setTimeout(function() {
            el.style.opacity = '0';
            setTimeout(function() {
                if (el.parentNode) el.parentNode.removeChild(el);
            }, 300);
        }, 3000);
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();