const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

app.use(express.static(__dirname + '/'));

const WORLD_W = 25;
const WORLD_H = 15;

let players = {};
let walls = [];
let resources = [];

function generateResources() {
    let arr = [];
    for(let i=0; i<70; i++) {
        let type = Math.random() < 0.7 ? 'wood' : 'stone';
        let x = Math.floor(Math.random() * WORLD_W);
        let y = Math.floor(Math.random() * WORLD_H);
        arr.push({ x, y, type });
    }
    return arr;
}

function isSolid(x, y, ignoreRes=false) {
    if(x<0 || y<0 || x>=WORLD_W || y>=WORLD_H) return true;
    for(let w of walls) if(w.x === x && w.y === y) return true;
    if(!ignoreRes) {
        for(let r of resources) if(r.x === x && r.y === y) return true;
    }
    return false;
}

function getFreeSpawn() {
    for(let tries=0; tries<200; tries++) {
        let x = Math.floor(3 + Math.random() * (WORLD_W-6));
        let y = Math.floor(3 + Math.random() * (WORLD_H-6));
        if(!isSolid(x, y, true) && !Object.values(players).some(p=>Math.floor(p.x)===x && Math.floor(p.y)===y)) {
            return {x,y};
        }
    }
    return {x:5, y:5};
}

io.on('connection', (socket) => {
    console.log('user connected', socket.id);
    let spawn = getFreeSpawn();
    players[socket.id] = {
        id: socket.id,
        x: spawn.x,
        y: spawn.y,
        wood: 5,
        stone: 3,
        name: 'hero_'+Math.floor(Math.random()*1000)
    };
    
    socket.emit('init', {
        id: socket.id,
        players: players,
        walls: walls,
        resources: resources,
        myWood: players[socket.id].wood,
        myStone: players[socket.id].stone
    });
    
    socket.on('move', (data) => {
        let p = players[socket.id];
        if(!p) return;
        let dx=0, dy=0;
        if(data.up) dy-=1;
        if(data.down) dy+=1;
        if(data.left) dx-=1;
        if(data.right) dx+=1;
        if(dx===0 && dy===0) return;
        let newX = p.x + dx;
        let newY = p.y + dy;
        if(!isSolid(newX, newY)) {
            p.x = newX;
            p.y = newY;
            let idx = resources.findIndex(r => r.x === p.x && r.y === p.y);
            if(idx !== -1) {
                let res = resources[idx];
                if(res.type === 'wood') p.wood += 3;
                else p.stone += 2;
                resources.splice(idx,1);
                io.emit('updateResources', resources);
                io.emit('playerUpdate', { id: socket.id, x: p.x, y: p.y, wood: p.wood, stone: p.stone });
            } else {
                io.emit('playerUpdate', { id: socket.id, x: p.x, y: p.y, wood: p.wood, stone: p.stone });
            }
            io.emit('updatePlayers', players);
        }
    });
    
    socket.on('placeWall', (wallX, wallY) => {
        let p = players[socket.id];
        if(!p) return;
        if(p.wood >= 10 && !isSolid(wallX, wallY, true)) {
            p.wood -= 10;
            walls.push({ x: wallX, y: wallY, hp: 50 });
            io.emit('updateWalls', walls);
            io.emit('playerUpdate', { id: socket.id, x: p.x, y: p.y, wood: p.wood, stone: p.stone });
            io.emit('updatePlayers', players);
        }
    });
    
    socket.on('disconnect', () => {
        delete players[socket.id];
        io.emit('playerLeft', socket.id);
        io.emit('updatePlayers', players);
    });
});

setInterval(() => {
    if(resources.length < 50) {
        let type = Math.random()<0.6?'wood':'stone';
        let x = Math.floor(Math.random()*WORLD_W);
        let y = Math.floor(Math.random()*WORLD_H);
        if(!isSolid(x,y, true)) resources.push({x,y,type});
        io.emit('updateResources', resources);
    }
}, 9000);

resources = generateResources();
server.listen(process.env.PORT || 3000, () => console.log('✅ dynast.io-like running on http://localhost:3000'));