function CanvasManager(canvasId, cursorCanvasId) {
    this.canvas = document.getElementById(canvasId);
    this.cursorCanvas = document.getElementById(cursorCanvasId);
    this.ctx = this.canvas.getContext('2d');
    this.cursorCtx = this.cursorCanvas.getContext('2d');
    
    this.isDrawing = false;
    this.currentStrokeId = null;
    this.currentPoints = [];
    this.lastX = 0;
    this.lastY = 0;
    this.strokeCounter = 0;
    
    this.tool = 'brush';
    this.color = '#000000';
    this.strokeWidth = 5;
    
    this.history = [];
    this.activeStrokes = {};
    this.remoteCursors = {};
    this.remoteDrawingStates = {};
    
    this.myUserId = null;
    this.myUsername = null;
    this.myColor = null;
    
    this.onDrawStart = null;
    this.onDrawMove = null;
    this.onDrawEnd = null;
    this.onCursorMove = null;
    
    this.throttleTime = 0;
    this.throttleDelay = 16;
    
    this.init();
}

CanvasManager.prototype.init = function() {
    this.setupCanvasSize();
    this.bindMouseEvents();
    this.bindTouchEvents();
    this.fillWhite();
    
    var self = this;
    window.addEventListener('resize', function() {
        self.setupCanvasSize();
        self.redrawCanvas();
    });
    
    this.startCursorLoop();
};

CanvasManager.prototype.setMyInfo = function(odId, username, color) {
    this.myUserId = odId;
    this.myUsername = username;
    this.myColor = color;
    console.log('Canvas: My info set - ID:', odId, 'Username:', username);
};

CanvasManager.prototype.setupCanvasSize = function() {
    var container = this.canvas.parentElement;
    var width = container.clientWidth;
    var height = container.clientHeight;
    
    this.canvas.width = width;
    this.canvas.height = height;
    this.cursorCanvas.width = width;
    this.cursorCanvas.height = height;
};

CanvasManager.prototype.fillWhite = function() {
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
};

CanvasManager.prototype.getCoords = function(e) {
    var rect = this.canvas.getBoundingClientRect();
    var clientX, clientY;
    
    if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else {
        clientX = e.clientX;
        clientY = e.clientY;
    }
    
    var scaleX = this.canvas.width / rect.width;
    var scaleY = this.canvas.height / rect.height;
    
    return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
    };
};

CanvasManager.prototype.makeStrokeId = function() {
    this.strokeCounter = this.strokeCounter + 1;
    return 'stroke_' + this.myUserId + '_' + Date.now() + '_' + this.strokeCounter;
};

CanvasManager.prototype.bindMouseEvents = function() {
    var self = this;
    
    this.canvas.addEventListener('mousedown', function(e) {
        e.preventDefault();
        self.beginStroke(e);
    });
    
    this.canvas.addEventListener('mousemove', function(e) {
        e.preventDefault();
        self.continueStroke(e);
    });
    
    this.canvas.addEventListener('mouseup', function(e) {
        e.preventDefault();
        self.finishStroke();
    });
    
    this.canvas.addEventListener('mouseleave', function(e) {
        if (self.isDrawing) {
            self.finishStroke();
        }
    });
};

CanvasManager.prototype.bindTouchEvents = function() {
    var self = this;
    
    this.canvas.addEventListener('touchstart', function(e) {
        e.preventDefault();
        if (e.touches.length === 1) {
            self.beginStroke(e);
        }
    }, { passive: false });
    
    this.canvas.addEventListener('touchmove', function(e) {
        e.preventDefault();
        if (e.touches.length === 1) {
            self.continueStroke(e);
        }
    }, { passive: false });
    
    this.canvas.addEventListener('touchend', function(e) {
        e.preventDefault();
        self.finishStroke();
    }, { passive: false });
};

CanvasManager.prototype.beginStroke = function(e) {
    if (!this.myUserId) {
        console.error('Cannot draw: myUserId not set');
        return;
    }
    
    var coords = this.getCoords(e);
    
    this.isDrawing = true;
    this.currentStrokeId = this.makeStrokeId();
    this.lastX = coords.x;
    this.lastY = coords.y;
    this.currentPoints = [{ x: coords.x, y: coords.y }];
    
    var strokeColor = this.tool === 'eraser' ? '#FFFFFF' : this.color;
    
    this.ctx.beginPath();
    this.ctx.arc(coords.x, coords.y, this.strokeWidth / 2, 0, Math.PI * 2);
    this.ctx.fillStyle = strokeColor;
    this.ctx.fill();
    
    console.log('Stroke started:', this.currentStrokeId, 'by:', this.myUserId);
    
    if (this.onDrawStart) {
        this.onDrawStart({
            strokeId: this.currentStrokeId,
            point: { x: coords.x, y: coords.y },
            style: { color: strokeColor, width: this.strokeWidth },
            tool: this.tool
        });
    }
};

CanvasManager.prototype.continueStroke = function(e) {
    var coords = this.getCoords(e);
    
    var now = Date.now();
    if (now - this.throttleTime > this.throttleDelay) {
        if (this.onCursorMove) {
            this.onCursorMove({ x: coords.x, y: coords.y });
        }
        this.throttleTime = now;
    }
    
    if (!this.isDrawing) return;
    
    var strokeColor = this.tool === 'eraser' ? '#FFFFFF' : this.color;
    
    this.ctx.beginPath();
    this.ctx.moveTo(this.lastX, this.lastY);
    this.ctx.lineTo(coords.x, coords.y);
    this.ctx.strokeStyle = strokeColor;
    this.ctx.lineWidth = this.strokeWidth;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.stroke();
    
    this.currentPoints.push({ x: coords.x, y: coords.y });
    
    if (this.onDrawMove) {
        this.onDrawMove({
            strokeId: this.currentStrokeId,
            point: { x: coords.x, y: coords.y }
        });
    }
    
    this.lastX = coords.x;
    this.lastY = coords.y;
};

CanvasManager.prototype.finishStroke = function() {
    if (!this.isDrawing) return;
    
    this.isDrawing = false;
    
    console.log('Stroke finished:', this.currentStrokeId, 'by:', this.myUserId);
    
    if (this.onDrawEnd) {
        this.onDrawEnd({
            strokeId: this.currentStrokeId
        });
    }
    
    this.currentStrokeId = null;
    this.currentPoints = [];
};

CanvasManager.prototype.renderStroke = function(stroke) {
    if (!stroke || !stroke.points || stroke.points.length === 0) return;
    
    var pts = stroke.points;
    var style = stroke.style;
    
    if (pts.length === 1) {
        this.ctx.beginPath();
        this.ctx.arc(pts[0].x, pts[0].y, style.width / 2, 0, Math.PI * 2);
        this.ctx.fillStyle = style.color;
        this.ctx.fill();
        return;
    }
    
    this.ctx.beginPath();
    this.ctx.moveTo(pts[0].x, pts[0].y);
    
    for (var i = 1; i < pts.length; i++) {
        this.ctx.lineTo(pts[i].x, pts[i].y);
    }
    
    this.ctx.strokeStyle = style.color;
    this.ctx.lineWidth = style.width;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.stroke();
};

CanvasManager.prototype.onRemoteDrawStart = function(data) {
    this.activeStrokes[data.id] = {
        id: data.id,
        odId: data.odId,
        username: data.username,
        userColor: data.userColor,
        points: data.points ? data.points.slice() : [],
        style: { color: data.style.color, width: data.style.width },
        tool: data.tool,
        zIndex: data.zIndex
    };
    
    var stroke = this.activeStrokes[data.id];
    if (stroke.points.length > 0) {
        this.ctx.beginPath();
        this.ctx.arc(stroke.points[0].x, stroke.points[0].y, stroke.style.width / 2, 0, Math.PI * 2);
        this.ctx.fillStyle = stroke.style.color;
        this.ctx.fill();
    }
    
    this.remoteDrawingStates[data.odId] = {
        username: data.username,
        color: data.userColor,
        isDrawing: true,
        position: stroke.points.length > 0 ? stroke.points[0] : null
    };
};

CanvasManager.prototype.onRemoteDrawMove = function(data) {
    var stroke = this.activeStrokes[data.strokeId];
    if (!stroke) return;
    
    var lastPt = stroke.points.length > 0 ? stroke.points[stroke.points.length - 1] : null;
    stroke.points.push(data.point);
    
    if (lastPt) {
        this.ctx.beginPath();
        this.ctx.moveTo(lastPt.x, lastPt.y);
        this.ctx.lineTo(data.point.x, data.point.y);
        this.ctx.strokeStyle = stroke.style.color;
        this.ctx.lineWidth = stroke.style.width;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.stroke();
    }
    
    if (this.remoteDrawingStates[data.odId]) {
        this.remoteDrawingStates[data.odId].position = data.point;
    }
};

CanvasManager.prototype.onRemoteDrawEnd = function(data) {
    var stroke = this.activeStrokes[data.strokeId];
    if (stroke) {
        delete this.activeStrokes[data.strokeId];
    }
    
    if (this.remoteDrawingStates[data.odId]) {
        this.remoteDrawingStates[data.odId].isDrawing = false;
    }
};

CanvasManager.prototype.setFullHistory = function(historyArray) {
    console.log('Setting full history, count:', historyArray ? historyArray.length : 0);
    this.history = historyArray || [];
    this.redrawCanvas();
};

CanvasManager.prototype.redrawCanvas = function() {
    this.fillWhite();
    
    var sorted = this.history.slice().sort(function(a, b) {
        return (a.zIndex || 0) - (b.zIndex || 0);
    });
    
    for (var i = 0; i < sorted.length; i++) {
        this.renderStroke(sorted[i]);
    }
    
    var activeIds = Object.keys(this.activeStrokes);
    for (var j = 0; j < activeIds.length; j++) {
        this.renderStroke(this.activeStrokes[activeIds[j]]);
    }
};

CanvasManager.prototype.updateCursor = function(odId, data) {
    this.remoteCursors[odId] = {
        x: data.position.x,
        y: data.position.y,
        username: data.username,
        color: data.color,
        isDrawing: data.isDrawing || false
    };
};

CanvasManager.prototype.removeCursor = function(odId) {
    delete this.remoteCursors[odId];
    delete this.remoteDrawingStates[odId];
};

CanvasManager.prototype.startCursorLoop = function() {
    var self = this;
    function loop() {
        self.drawCursors();
        requestAnimationFrame(loop);
    }
    loop();
};

CanvasManager.prototype.drawCursors = function() {
    this.cursorCtx.clearRect(0, 0, this.cursorCanvas.width, this.cursorCanvas.height);
    
    var ids = Object.keys(this.remoteCursors);
    for (var i = 0; i < ids.length; i++) {
        var odId = ids[i];
        var cursor = this.remoteCursors[odId];
        var drawState = this.remoteDrawingStates[odId];
        
        var drawing = cursor.isDrawing || (drawState && drawState.isDrawing);
        var pos = cursor;
        
        if (drawState && drawState.isDrawing && drawState.position) {
            pos = {
                x: drawState.position.x,
                y: drawState.position.y,
                username: drawState.username || cursor.username,
                color: drawState.color || cursor.color
            };
        }
        
        this.drawSingleCursor(pos, drawing);
    }
};

CanvasManager.prototype.drawSingleCursor = function(cursor, isDrawing) {
    var ctx = this.cursorCtx;
    var x = cursor.x;
    var y = cursor.y;
    
    ctx.save();
    ctx.translate(x, y);
    
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 18);
    ctx.lineTo(5, 14);
    ctx.lineTo(9, 22);
    ctx.lineTo(12, 21);
    ctx.lineTo(8, 13);
    ctx.lineTo(14, 13);
    ctx.closePath();
    ctx.fillStyle = cursor.color || '#000';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    var label = cursor.username || 'User';
    if (isDrawing) label += ' ✏️';
    
    ctx.font = 'bold 11px Arial';
    var tw = ctx.measureText(label).width;
    var bx = 16, by = 16, bw = tw + 14, bh = 20;
    
    ctx.fillStyle = cursor.color || '#000';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, bw, bh);
    
    ctx.fillStyle = '#fff';
    ctx.fillText(label, bx + 7, by + 14);
    
    ctx.restore();
};

CanvasManager.prototype.setTool = function(t) { this.tool = t; };
CanvasManager.prototype.setColor = function(c) { this.color = c; };
CanvasManager.prototype.setStrokeWidth = function(w) { this.strokeWidth = w; };