var Renderer = (function() {
    
    var mainCanvas = null;
    var mainCtx = null;
    var cursorCanvas = null;
    var cursorCtx = null;
    var width = 0;
    var height = 0;
    
    function init(mainCanvasId, cursorCanvasId) {
        mainCanvas = document.getElementById(mainCanvasId);
        cursorCanvas = document.getElementById(cursorCanvasId);
        mainCtx = mainCanvas.getContext('2d');
        cursorCtx = cursorCanvas.getContext('2d');
        
        resize();
        window.addEventListener('resize', resize);
    }
    
    function resize() {
        var container = mainCanvas.parentElement;
        width = container.clientWidth;
        height = container.clientHeight;
        
        mainCanvas.width = width;
        mainCanvas.height = height;
        cursorCanvas.width = width;
        cursorCanvas.height = height;
        
        render();
    }
    
    function clear() {
        mainCtx.fillStyle = '#FFFFFF';
        mainCtx.fillRect(0, 0, width, height);
    }
    
    function drawStroke(stroke) {
        if (!stroke || !stroke.points || stroke.points.length === 0) return;
        
        var pts = stroke.points;
        var color = stroke.tool === 'eraser' ? '#FFFFFF' : stroke.color;
        var lineWidth = stroke.width;
        
        mainCtx.strokeStyle = color;
        mainCtx.lineWidth = lineWidth;
        mainCtx.lineCap = 'round';
        mainCtx.lineJoin = 'round';
        
        if (pts.length === 1) {
            mainCtx.beginPath();
            mainCtx.arc(pts[0].x, pts[0].y, lineWidth / 2, 0, Math.PI * 2);
            mainCtx.fillStyle = color;
            mainCtx.fill();
            return;
        }
        
        mainCtx.beginPath();
        mainCtx.moveTo(pts[0].x, pts[0].y);
        
        for (var i = 1; i < pts.length; i++) {
            mainCtx.lineTo(pts[i].x, pts[i].y);
        }
        
        mainCtx.stroke();
    }
    
    function render() {
        clear();
        
        var history = DrawingState.getHistory();
        for (var i = 0; i < history.length; i++) {
            drawStroke(history[i]);
        }
        
        var active = DrawingState.getActiveStrokes();
        for (var j = 0; j < active.length; j++) {
            drawStroke(active[j]);
        }
    }
    
    function renderCursors() {
        cursorCtx.clearRect(0, 0, width, height);
        
        var cursors = DrawingState.getCursors();
        for (var i = 0; i < cursors.length; i++) {
            drawCursor(cursors[i]);
        }
    }
    
    function drawCursor(cursor) {
        var x = cursor.x;
        var y = cursor.y;
        
        cursorCtx.save();
        cursorCtx.translate(x, y);
        
        cursorCtx.beginPath();
        cursorCtx.moveTo(0, 0);
        cursorCtx.lineTo(0, 18);
        cursorCtx.lineTo(5, 14);
        cursorCtx.lineTo(9, 22);
        cursorCtx.lineTo(12, 21);
        cursorCtx.lineTo(8, 13);
        cursorCtx.lineTo(14, 13);
        cursorCtx.closePath();
        
        cursorCtx.fillStyle = cursor.color || '#000';
        cursorCtx.fill();
        cursorCtx.strokeStyle = '#fff';
        cursorCtx.lineWidth = 1.5;
        cursorCtx.stroke();
        
        var label = cursor.username || 'User';
        cursorCtx.font = 'bold 11px Arial';
        var tw = cursorCtx.measureText(label).width;
        
        cursorCtx.fillStyle = cursor.color || '#000';
        cursorCtx.fillRect(16, 16, tw + 12, 20);
        
        cursorCtx.fillStyle = '#fff';
        cursorCtx.fillText(label, 22, 30);
        
        cursorCtx.restore();
    }
    
    function getCoords(e) {
        var rect = mainCanvas.getBoundingClientRect();
        var clientX, clientY;
        
        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }
        
        var scaleX = mainCanvas.width / rect.width;
        var scaleY = mainCanvas.height / rect.height;
        
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    }
    
    function getCanvas() {
        return mainCanvas;
    }
    
    function startCursorLoop() {
        function loop() {
            renderCursors();
            requestAnimationFrame(loop);
        }
        loop();
    }
    
    return {
        init: init,
        render: render,
        getCoords: getCoords,
        getCanvas: getCanvas,
        startCursorLoop: startCursorLoop
    };
})();