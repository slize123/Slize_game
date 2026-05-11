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
let barrels = [];
let roads = [];
let nextId = 1;

const WORLD_W = 32;
const WORLD_H = 22;

// Генерация дорог
function generateRoads() {
    const roadList = [];
    for (let i = 6; i < WORLD_W - 6; i += 4) {
        roadList.push({ x: i, y: Math.floor(WORLD_H / 2) });
        roadList.push({ x: i, y: Math.floor(WORLD_H / 2) + 1 });
    }
    for (let j = 4; j < WORLD_H - 4; j += 3) {
        roadList.push({ x: Math.floor(WORLD_W / 2), y: j });
        roadList.push({ x: Math.floor(WORLD_W / 2) + 1, y: j });
    }
    return roadList;
}

// Генерация ресурсов
function generateResources() {
    const arr = [];
    const types = ['wood', 'stone', 'gold', 'crystal', 'cactus', 'fern'];
    for (let i = 0; i < 140; i++) {
        const type = types[Math.floor(Math.random() * types.length)];
        const x = Math.floor(Math.random() * WORLD_W);
        const y = Math.floor(Math.random() * WORLD_H);
        if (!isSolid(x, y, true) && !roads.some(r => r.x === x && r.y === y)) {
            arr.push({ x, y, type });
        }
    }
    return arr;
}

// Генерация бочек
function generateBarrels() {
    const arr = [];
    for (let i = 0; i < 25; i++) {
        const x = Math.floor(Math.random() * WORLD_W);
        const y = Math.floor(Math.random() * WORLD_H);
        if (!isSolid(x, y, true) && !roads.some(r => r.x === x && r.y === y)) {
            arr.push({ x, y });
        }
    }
    return arr;
}

function isSolid(x, y, ignoreRes = false) {
    if (x < 0 || y < 0 || x >= WORLD_W || y >= WORLD_H) return true;
    for (let w of walls) if (w.x === x && w.y === y) return true;
    if (!ignoreRes) {
        for (let r of resources) if (r.x === x && r.y === y) return true;
        for (let b of barrels) if (b.x === x && b.y === y) return true;
    }
    return false;
}

function getFreeSpawn() {
    for (let i = 0; i < 300; i++) {
        const x = Math.floor(5 + Math.random() * (WORLD_W - 10));
        const y = Math.floor(5 + Math.random() * (WORLD_H - 10));
        if (!isSolid(x, y, true) && !roads.some(r => r.x === x && r.y === y)) {
            return { x, y };
        }
    }
    return { x: 15, y: 10 };
}

io.on('connection', (socket) => {
    const spawn = getFreeSpawn();
    const id = String(nextId++);
    
    players[id] = {
        id: id,
        x: spawn.x,
        y: spawn.y,
        health: 100,
        inventory: { wood: 10, stone: 6, gold: 0, crystal: 0, cactus: 0, fern: 0, timerite: 0, meat: 0, feather: 0, dust: 0, web: 0, fur: 0, bone: 0, fuel: 2 },
        name: `Slizer_${Math.floor(Math.random() * 999)}`
    };
    
    socket.emit('init', {
        id: id,
        x: players[id].x,
        y: players[id].y,
        inventory: players[id].inventory,
        health: players[id].health,
        online: Object.keys(players).length
    });
    
    io.emit('updatePlayers', players);
    io.emit('updateResources', resources);
    io.emit('updateWalls', walls);
    io.emit('updateBarrels', barrels);
    io.emit('updateRoads', roads);
    
    socket.on('joinGame', () => {});
    
    socket.on('move', (data) => {
        const p = players[id];
        if (!p) return;
        let newX = p.x + data.dx;
        let newY = p.y + data.dy;
        
        if (!isSolid(newX, newY)) {
            p.x = newX;
            p.y = newY;
            
            // Сбор ресурсов
            const resIndex = resources.findIndex(r => r.x === newX && r.y === newY);
            if (resIndex !== -1) {
                const res = resources[resIndex];
                const gain = res.type === 'gold' ? 2 : 1;
                if (p.inventory[res.type] !== undefined) p.inventory[res.type] += gain;
                resources.splice(resIndex, 1);
                io.emit('updateResources', resources);
            }
            
            // Сбор бочек (топливо)
            const barrelIndex = barrels.findIndex(b => b.x === newX && b.y === newY);
            if (barrelIndex !== -1) {
                p.inventory.fuel = (p.inventory.fuel || 0) + 3;
                barrels.splice(barrelIndex, 1);
                io.emit('updateBarrels', barrels);
            }
            
            io.emit('updatePlayers', players);
            socket.emit('playerUpdate', { id, inventory: p.inventory, health: p.health });
        }
    });
    
    socket.on('attack', (data) => {
        const attacker = players[id];
        if (!attacker) return;
        
        let closest = null;
        let minDist = 1.8;
        
        for (let pid in players) {
            if (pid !== id) {
                const p = players[pid];
                const dist = Math.hypot(attacker.x - p.x, attacker.y - p.y);
                if (dist < minDist) {
                    minDist = dist;
                    closest = p;
                }
            }
        }
        
        if (closest) {
            closest.health -= data.damage;
            if (closest.health <= 0) {
                closest.health = 100;
                const newSpawn = getFreeSpawn();
                closest.x = newSpawn.x;
                closest.y = newSpawn.y;
                io.emit('death', { id: closest.id });
            }
            io.emit('attackEffect', { target: closest.id, newHealth: closest.health });
            io.emit('updatePlayers', players);
        }
    });
    
    socket.on('craft', (data) => {
        const p = players[id];
        if (!p) return;
        
        let canCraft = true;
        for (let [res, val] of Object.entries(data.req)) {
            if ((p.inventory[res] || 0) < val) canCraft = false;
        }
        
        if (canCraft) {
            for (let [res, val] of Object.entries(data.req)) {
                p.inventory[res] -= val;
            }
            socket.emit('playerUpdate', { id, inventory: p.inventory, health: p.health });
            io.emit('updatePlayers', players);
        }
    });
    
    socket.on('disconnect', () => {
        delete players[id];
        io.emit('updatePlayers', players);
    });
});

// Респавн ресурсов и бочек
setInterval(() => {
    if (resources.length < 100) {
        const types = ['wood', 'stone', 'gold', 'cactus'];
        const type = types[Math.floor(Math.random() * types.length)];
        const x = Math.floor(Math.random() * WORLD_W);
        const y = Math.floor(Math.random() * WORLD_H);
        if (!isSolid(x, y, true) && !roads.some(r => r.x === x && r.y === y)) {
            resources.push({ x, y, type });
            io.emit('updateResources', resources);
        }
    }
    
    if (barrels.length < 15) {
        const x = Math.floor(Math.random() * WORLD_W);
        const y = Math.floor(Math.random() * WORLD_H);
        if (!isSolid(x, y, true) && !roads.some(r => r.x === x && r.y === y)) {
            barrels.push({ x, y });
            io.emit('updateBarrels', barrels);
        }
    }
}, 10000);

roads = generateRoads();
resources = generateResources();
barrels = generateBarrels();

server.listen(process.env.PORT || 3000, '0.0.0.0', () => {
    console.log('✅ Slize сервер запущен на порту 3000');
    console.log(`🌍 Мир: ${WORLD_W}x${WORLD_H} | Дорог: ${roads.length} | Ресурсов: ${resources.length} | Бочек: ${barrels.length}`);
});
