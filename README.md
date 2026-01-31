# Real-Time Collaborative Drawing Canvas

A multi-user drawing application where multiple people can draw simultaneously on a shared canvas with real-time synchronization.

![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)
![Socket.IO](https://img.shields.io/badge/Socket.IO-4.7-blue.svg)
![License](https://img.shields.io/badge/License-MIT-yellow.svg)

## Overview

This project implements a real-time collaborative drawing canvas that allows multiple users to:
- Draw simultaneously on a shared canvas
- See other users' cursors and drawings in real-time
- Undo/redo their own drawing actions
- Clear only their own drawings without affecting others

## Architecture

### Core Principles


### Key Design Decisions

| Component | Role | Holds State? |
|-----------|------|--------------|
| **Server** | Single source of truth, operation ordering | ✅ Yes (authoritative) |
| **State (client)** | Ordered list of drawing operations | ✅ Yes (derived from server) |
| **Canvas** | Pure rendering surface | ❌ No (renders from State) |
| **Renderer** | Draws operations to canvas | ❌ No |

### Drawing Operations (Atomic Units)

Every drawing action is broken into atomic operations, not pixels:

```javascript
{
    id: "stroke_abc123_1699999999_1",    // Unique identifier
    odId: "socket_id_xyz",               // Owner ID (who drew this)
    username: "Alice",                    // Display name
    color: "#e74c3c",                    // Stroke color
    width: 5,                            // Stroke width
    tool: "brush",                       // Tool type (brush/eraser)
    points: [{x, y}, {x, y}, ...],       // Array of points
    order: 42,                           // Server-assigned order
    undone: false,                       // Undo status
    timestamp: 1699999999999             // Creation time
}
```
## Data Flow Example
User A draws a line:

1. mousedown → Client A sends draw_start
2. Server creates operation with order=N
3. Server broadcasts draw_start to Client B
4. mousemove → Client A sends draw_move (multiple times)
5. Server appends points, broadcasts to Client B
6. mouseup → Client A sends draw_end
7. Server moves stroke to history
8. Server broadcasts draw_end to Client B

User A clicks Undo:

1. Client A sends undo
2. Server finds last stroke where odId === User A's ID
3. Server marks stroke.undone = true
4. Server broadcasts sync_history to ALL clients
5. All clients replace local state and re-render

### Features
## Drawing Tools
Brush - Freehand drawing with customizable color and width
Eraser - Erase by drawing with white color
## Color Options
12 preset colors in palette
Custom color picker for any color
## Stroke Width
Adjustable from 1px to 50px
Live preview of current settings
## Collaboration Features
Real-time multi-user drawing
Live cursor tracking with usernames
User presence indicators
Unique color assigned to each user
## History Management
↶ Undo - Removes user's last stroke only
↷ Redo - Restores user's last undone stroke
## Clear Mine - Removes all of user's strokes
Conflict Resolution
Server assigns operation order
Newer strokes render on top of older ones
Each user can only undo/clear their own strokes

### Project Structure
collaborative-canvas/
├── client/
│   ├── index.html      # Main HTML structure
│   ├── style.css       # Styling
│   └── main.js         # Application entry point, UI logic
├── server/
│   └── server.js       # Express + Socket.IO server
├── package.json
├── Procfile            # For Heroku/Railway deployment
├── README.md
└── ARCHITECTURE.md

### Setup

# Clone the repository
git clone https://github.com/YOUR_USERNAME/collaborative-canvas.git
cd collaborative-canvas

# Install dependencies
npm install

# Start the server
npm start

The application will be available at http://localhost:3000
