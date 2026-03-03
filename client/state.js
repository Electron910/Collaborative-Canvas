var DrawingState = (function() {
    
    var history = [];
    var activeStrokes = {};
    var cursors = {};
    var onChangeCallback = null;
    
    function sortByOrder(a, b) {
        return a.order - b.order;
    }
    
    function setHistory(newHistory) {
        history = [];
        for (var i = 0; i < newHistory.length; i++) {
            history.push(newHistory[i]);
        }
        history.sort(sortByOrder);
        notifyChange();
    }
    
    function getHistory() {
        return history.slice();
    }
    
    function startStroke(strokeData) {
        activeStrokes[strokeData.id] = {
            id: strokeData.id,
            odId: strokeData.odId,
            username: strokeData.username,
            color: strokeData.color,
            width: strokeData.width,
            tool: strokeData.tool,
            points: [{ x: strokeData.x, y: strokeData.y }],
            order: strokeData.order
        };
        notifyChange();
    }
    
    function addPoint(strokeId, x, y) {
        if (activeStrokes[strokeId]) {
            activeStrokes[strokeId].points.push({ x: x, y: y });
            notifyChange();
        }
    }
    
    function endStroke(strokeId) {
        if (activeStrokes[strokeId]) {
            var stroke = activeStrokes[strokeId];
            history.push(stroke);
            history.sort(sortByOrder);
            delete activeStrokes[strokeId];
            notifyChange();
        }
    }
    
    function getActiveStrokes() {
        var list = [];
        var ids = Object.keys(activeStrokes);
        for (var i = 0; i < ids.length; i++) {
            list.push(activeStrokes[ids[i]]);
        }
        return list;
    }
    
    function updateCursor(odId, data) {
        cursors[odId] = {
            odId: odId,
            username: data.username,
            color: data.color,
            x: data.x,
            y: data.y
        };
    }
    
    function removeCursor(odId) {
        delete cursors[odId];
    }
    
    function getCursors() {
        var list = [];
        var ids = Object.keys(cursors);
        for (var i = 0; i < ids.length; i++) {
            list.push(cursors[ids[i]]);
        }
        return list;
    }
    
    function clearActiveStroke(strokeId) {
        delete activeStrokes[strokeId];
    }
    
    function onChange(callback) {
        onChangeCallback = callback;
    }
    
    function notifyChange() {
        if (onChangeCallback) {
            onChangeCallback();
        }
    }
    
    return {
        setHistory: setHistory,
        getHistory: getHistory,
        startStroke: startStroke,
        addPoint: addPoint,
        endStroke: endStroke,
        getActiveStrokes: getActiveStrokes,
        updateCursor: updateCursor,
        removeCursor: removeCursor,
        getCursors: getCursors,
        clearActiveStroke: clearActiveStroke,
        onChange: onChange
    };
})();