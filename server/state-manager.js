function StateManager() {
    this.roomStates = {};
    this.maxHistorySize = 500;
}

StateManager.prototype.initializeRoom = function(roomId) {
    if (!this.roomStates[roomId]) {
        this.roomStates[roomId] = {
            history: [],
            redoStacks: {},
            activeStrokes: {},
            zIndexCounter: 0
        };
    }
    return this.roomStates[roomId];
};

StateManager.prototype.getState = function(roomId) {
    if (!this.roomStates[roomId]) {
        return this.initializeRoom(roomId);
    }
    return this.roomStates[roomId];
};

StateManager.prototype.getNextZIndex = function(roomId) {
    var state = this.getState(roomId);
    state.zIndexCounter = state.zIndexCounter + 1;
    return state.zIndexCounter;
};

StateManager.prototype.startStroke = function(roomId, strokeData) {
    var state = this.getState(roomId);
    state.activeStrokes[strokeData.id] = JSON.parse(JSON.stringify(strokeData));
    
    if (state.redoStacks[strokeData.odId]) {
        state.redoStacks[strokeData.odId] = [];
    }
};

StateManager.prototype.addPointToStroke = function(roomId, strokeId, point) {
    var state = this.getState(roomId);
    if (state.activeStrokes[strokeId]) {
        state.activeStrokes[strokeId].points.push(point);
    }
};

StateManager.prototype.finishStroke = function(roomId, strokeId) {
    var state = this.getState(roomId);
    var stroke = state.activeStrokes[strokeId];
    
    if (stroke) {
        stroke.completed = true;
        state.history.push(JSON.parse(JSON.stringify(stroke)));
        delete state.activeStrokes[strokeId];
        
        console.log('Stroke finished and added to history. odId:', stroke.odId);
        console.log('Total history length:', state.history.length);
        
        if (state.history.length > this.maxHistorySize) {
            state.history.shift();
        }
        
        return stroke;
    }
    return null;
};

StateManager.prototype.getHistory = function(roomId) {
    var state = this.getState(roomId);
    var historyCopy = [];
    for (var i = 0; i < state.history.length; i++) {
        historyCopy.push(state.history[i]);
    }
    historyCopy.sort(function(a, b) {
        return (a.zIndex || 0) - (b.zIndex || 0);
    });
    return historyCopy;
};

StateManager.prototype.undoForUser = function(roomId, odId) {
    var state = this.getState(roomId);
    
    console.log('Looking for strokes to undo for user:', odId);
    console.log('Current history length:', state.history.length);
    
    var userStrokeIndex = -1;
    for (var i = state.history.length - 1; i >= 0; i--) {
        console.log('Checking stroke', i, 'odId:', state.history[i].odId);
        if (state.history[i].odId === odId) {
            userStrokeIndex = i;
            break;
        }
    }
    
    if (userStrokeIndex === -1) {
        console.log('No strokes found for user');
        return null;
    }
    
    var stroke = state.history.splice(userStrokeIndex, 1)[0];
    console.log('Removed stroke at index:', userStrokeIndex);
    
    if (!state.redoStacks[odId]) {
        state.redoStacks[odId] = [];
    }
    state.redoStacks[odId].push(stroke);
    
    return stroke;
};

StateManager.prototype.redoForUser = function(roomId, odId) {
    var state = this.getState(roomId);
    
    if (!state.redoStacks[odId] || state.redoStacks[odId].length === 0) {
        return null;
    }
    
    var stroke = state.redoStacks[odId].pop();
    stroke.zIndex = this.getNextZIndex(roomId);
    state.history.push(stroke);
    
    return stroke;
};

StateManager.prototype.clearUserDrawings = function(roomId, odId) {
    var state = this.getState(roomId);
    
    console.log('=== Clearing drawings for user:', odId, '===');
    console.log('History before clear:', state.history.length);
    
    var newHistory = [];
    var removedCount = 0;
    
    for (var i = 0; i < state.history.length; i++) {
        var stroke = state.history[i];
        console.log('Stroke', i, '- id:', stroke.id, 'odId:', stroke.odId, 'match:', stroke.odId === odId);
        
        if (stroke.odId === odId) {
            removedCount++;
            console.log('  -> REMOVING this stroke');
        } else {
            newHistory.push(stroke);
            console.log('  -> KEEPING this stroke');
        }
    }
    
    state.history = newHistory;
    
    if (state.redoStacks[odId]) {
        state.redoStacks[odId] = [];
    }
    
    console.log('History after clear:', state.history.length);
    console.log('Removed count:', removedCount);
    
    return {
        history: this.getHistory(roomId),
        removedCount: removedCount
    };
};

module.exports = StateManager;