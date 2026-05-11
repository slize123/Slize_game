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

// Генерация ресурсов (дерево, камень, изумруды)
function generateResources() {
    let arr = [];
    for (let i = 0; i < 80; i++) {
        let r = Math.random();
        let type;
        if (r < 0.6) type = 'wood';
        else if (r < 0.85) type = 'stone';
        else type = 'emerald';  // изумруды 15% шанс
        
        let x = Math.floor(Math.random() * WORLD_W);
        let y = Math.floor(Math.random() * WORLD_H);
        arr.push({ x, y, type });
    }
    return arr;
}

// Проверка твёрдого объекта
function isSolid(x, y, ignoreRes = false) {
    if (x < 0 || y < 0 || x >= WORLD_W || y >= WORLD_H) return true;
    for (let w of walls) if (w.x === x && w.y === y) return true;
    if (!ignoreRes) {
        for (let r of resources) if (r.x === x && r.y === y) return true;
    }
    return false;
}

// Спавн без коллизий
function getFreeSpawn() {
    for (let tries = 0; tries < 300; tries++) {
        let x = Math.floor(3 + Math.random() * (WORLD_W - 6));
        let y = Math.floor(3 + Math.random() * (WORLD_H - 6));
        if (!isSolid(x, y, true) && !Object.values(players).some(p => Math.floor(p.x) === x && Math.floor(p.y) === y)) {
            return { x, y };
        }
    }
    return { x: 5, y: 5 };
}

// Бафф силы
function applyPowerBuff(socketId) {
    if (players[socketId]) {
        players[socketId].powerBuff = true;
        setTimeout(() => {
            if (players[socketId]) {
                players[socketId].powerBuff = false;
                io.emit('playerUpdate', {
                    id: socketId,
                    x: players[socketId].x,
                    y: players[socketId].y,
                    wood: players[socketId].wood,
                    stone: players[socketId].stone,
                    emerald: players[socketId].emerald,
                    powerBuff: false
                });
            }
        }, 30000);
    }
}

io.on('connection', (socket) => {
    console.log('👤 игрок зашёл', socket.id);
    let spawn = getFreeSpawn();
    players[socket.id] = {
        id: socket.id,
        x: spawn.x,
        y: spawn.y,
        wood: 8,
        stone: 4,
        emerald: 2,
        name: 'Слизер ' + Math.floor(Math.random() * 900),
        powerBuff: false
    };
    
    socket.emit('init', {
        id: socket.id,
        players: players,
        walls: walls,
        resources: resources,
        myWood: players[socket.id].wood,
        myStone: players[socket.id].stone,
        myEmerald: players[socket.id].emerald
    });
    
    // Движение и сбор ресурсов
    socket.on('move', (data) => {
        let p = players[socket.id];
        if (!p) return;
        let dx = 0, dy = 0;
        if (data.up) dy -= 1;
        if (data.down) dy += 1;
        if (data.left) dx -= 1;
        if (data.right) dx += 1;
        if (dx === 0 && dy === 0) return;
        
        let newX = p.x + dx;
        let newY = p.y + dy;
        
        if (!isSolid(newX, newY)) {
            p.x = newX;
            p.y = newY;
            
            // Сбор ресурса на клетке
            let idx = resources.findIndex(r => r.x === p.x && r.y === p.y);
            if (idx !== -1) {
                let res = resources[idx];
                if (res.type === 'wood') p.wood += 2;
                else if (res.type === 'stone') p.stone += 1;
                else if (res.type === 'emerald') p.emerald += 1;
                resources.splice(idx, 1);
                io.emit('updateResources', resources);
            }
            
            io.emit('playerUpdate', {
                id: socket.id,
                x: p.x,
                y: p.y,
                wood: p.wood,
                stone: p.stone,
                emerald: p.emerald,
                powerBuff: p.powerBuff
            });
            io.emit('updatePlayers', players);
        }
    });
    
    // Постройка стены (обычная или изумрудная)
    socket.on('placeWall', (wallX, wallY, wallType) => {
        let p = players[socket.id];
        if (!p) return;
        
        if (wallType === 'emerald' && p.emerald >= 5 && !isSolid(wallX, wallY, true)) {
            p.emerald -= 5;
            walls.push({ x: wallX, y: wallY, type: 'emerald', hp: 120 });
            applyPowerBuff(socket.id);
            io.emit('updateWalls', walls);
        } else if (wallType === 'normal' && p.wood >= 10 && !isSolid(wallX, wallY, true)) {
            p.wood -= 10;
            walls.push({ x: wallX, y: wallY, type: 'normal', hp: 50 });
            io.emit('updateWalls', walls);
        } else {
            return;
        }
        
        io.emit('playerUpdate', {
            id: socket.id,
            x: p.x,
            y: p.y,
            wood: p.wood,
            stone: p.stone,
            emerald: p.emerald
        });
        io.emit('updatePlayers', players);
    });
    
    // Телепорт (уникальная механика с изумрудами)
    socket.on('teleport', (data) => {
        let p = players[socket.id];
        if (!p) return;
        if (p.emerald >= 3) {
            p.emerald -= 3;
            let angle = Math.random() * Math.PI * 2;
            let radius = 4 + Math.random() * 5;
            let newX = Math.floor(p.x + Math.cos(angle) * radius);
            let newY = Math.floor(p.y + Math.sin(angle) * radius);
            newX = Math.min(WORLD_W - 1, Math.max(0, newX));
            newY = Math.min(WORLD_H - 1, Math.max(0, newY));
            
            if (!isSolid(newX, newY, true)) {
                p.x = newX;
                p.y = newY;
            }
            
            io.emit('playerUpdate', {
                id: socket.id,
                x: p.x,
                y: p.y,
                wood: p.wood,
                stone: p.stone,
                emerald: p.emerald
            });
            io.emit('teleportConfirm', { id: socket.id, newX: p.x, newY: p.y });
            io.emit('updatePlayers', players);
        }
    });
    
    socket.on('disconnect', () => {
        console.log('❌ игрок вышел', socket.id);
        delete players[socket.id];
        io.emit('playerLeft', socket.id);
        io.emit('updatePlayers', players);
    });
});

// Респавн ресурсов
setInterval(() => {
    if (resources.length < 55) {
        let typeRand = Math.random();
        let type;
        if (typeRand < 0.6) type = 'wood';
        else if (typeRand < 0.85) type = 'stone';
        else type = 'emerald';
        
        let x = Math.floor(Math.random() * WORLD_W);
        let y = Math.floor(Math.random() * WORLD_H);
        if (!isSolid(x, y, true)) {
            resources.push({ x, y, type });
            io.emit('updateResources', resources);
        }
    }
}, 7000);

resources = generateResources();
server.listen(process.env.PORT || 3000, '0.0.0.0', () => console.log('✅ Slize сервер запущен'));
