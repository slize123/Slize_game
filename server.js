const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

app.use(express.static(__dirname + '/'));

let players = {};
let resources = [];
let walls = [];
let nextId = 1;

const WORLD_W = 35, WORLD_H = 25;

// Генерация ресурсов по мотивам вики
function generateResources() {
    let arr = [];
    const types = ['wood','stone','gold','crystal','cactus','fern','timerite'];
    for(let i=0;i<180;i++) {
        let type = types[Math.floor(Math.random()*types.length)];
        let x = Math.floor(Math.random()*WORLD_W);
        let y = Math.floor(Math.random()*WORLD_H);
        if(!isSolid(x,y,true)) arr.push({ x, y, type });
    }
    return arr;
}

function isSolid(x,y, ignoreRes=false) {
    if(x<0 || y<0 || x>=WORLD_W || y>=WORLD_H) return true;
    for(let w of walls) if(w.x===x && w.y===y) return true;
    if(!ignoreRes) for(let r of resources) if(r.x===x && r.y===y) return true;
    return false;
}

function getFreeSpawn() {
    for(let i=0;i<300;i++) {
        let x = Math.floor(5+Math.random()*(WORLD_W-10));
        let y = Math.floor(5+Math.random()*(WORLD_H-10));
        if(!isSolid(x,y,true)) return {x,y};
    }
    return {x:10,y:10};
}

io.on('connection', (socket) => {
    const spawn = getFreeSpawn();
    const id = String(nextId++);
    players[id] = {
        id, x: spawn.x, y: spawn.y, health: 100,
        inventory: { wood: 10, stone: 5, gold: 0, crystal: 0, cactus: 0, fern: 0, timerite: 0, meat: 0, feather: 0, dust: 0, web: 0, fur: 0, bone: 0 },
        name: `Slizer_${Math.floor(Math.random()*999)}`
    };
    
    socket.emit('init', { id, x: players[id].x, y: players[id].y, inventory: players[id].inventory, health: players[id].health, online: Object.keys(players).length });
    io.emit('updatePlayers', players);
    io.emit('updateResources', resources);
    io.emit('updateWalls', walls);
    
    socket.on('move', (data) => {
        let p = players[id];
        if(!p) return;
        let newX = p.x + data.dx, newY = p.y + data.dy;
        if(!isSolid(newX, newY)) {
            p.x = newX; p.y = newY;
            const resIdx = resources.findIndex(r => r.x === newX && r.y === newY);
            if(resIdx !== -1) {
                let res = resources[resIdx];
                if(p.inventory[res.type] !== undefined) p.inventory[res.type] += (res.type==='gold'?2:1);
                resources.splice(resIdx,1);
                io.emit('updateResources', resources);
            }
            io.emit('updatePlayers', players);
            socket.emit('playerUpdate', { id, inventory: p.inventory, health: p.health });
        }
    });
    
    socket.on('attack', (data) => {
        let attacker = players[id];
        let closest = null, minDist = 1.8;
        for(let pid in players) {
            if(pid !== id) {
                let p = players[pid];
                let dist = Math.hypot(attacker.x - p.x, attacker.y - p.y);
                if(dist < minDist) { minDist = dist; closest = p; }
            }
        }
        if(closest) {
            closest.health -= data.damage;
            if(closest.health <= 0) { closest.health = 100; let ns = getFreeSpawn(); closest.x = ns.x; closest.y = ns.y; }
            io.emit('attackEffect', { target: closest.id, newHealth: closest.health });
            io.emit('updatePlayers', players);
        }
    });
    
    socket.on('craft', (data) => {
        let p = players[id];
        let can = true;
        for(let [res,val] of Object.entries(data.req)) if((p.inventory[res]||0) < val) can = false;
        if(can) {
            for(let [res,val] of Object.entries(data.req)) p.inventory[res] -= val;
            socket.emit('playerUpdate', { id, inventory: p.inventory, health: p.health });
            io.emit('updatePlayers', players);
        }
    });
    
    socket.on('disconnect', () => { delete players[id]; io.emit('updatePlayers', players); });
    socket.on('joinGame', () => {});
});

resources = generateResources();
setInterval(() => {
    if(resources.length < 120) {
        let types = ['wood','stone','gold','cactus'];
        let type = types[Math.floor(Math.random()*types.length)];
        let x = Math.floor(Math.random()*WORLD_W), y = Math.floor(Math.random()*WORLD_H);
        if(!isSolid(x,y,true)) resources.push({ x, y, type });
        io.emit('updateResources', resources);
    }
}, 10000);

server.listen(process.env.PORT || 3000, '0.0.0.0', () => console.log('✅ Slize сервер запущен'));
