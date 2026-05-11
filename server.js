const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

app.use(express.static(__dirname + '/'));

let players = {};
let walls = [];
let resources = [];
let animals = [];
let nextId = 1;

const WORLD_W = 35;
const WORLD_H = 25;

// Генерация мира
function generateResources() {
    let arr = [];
    for (let i = 0; i < 120; i++) {
        let r = Math.random();
        let type = r < 0.5 ? 'wood' : (r < 0.75 ? 'stone' : (r < 0.9 ? 'emerald' : 'barrel'));
        let x = Math.floor(Math.random() * WORLD_W);
        let y = Math.floor(Math.random() * WORLD_H);
        if (!isSolid(x, y, true)) arr.push({ x, y, type });
    }
    return arr;
}

function generateAnimals() {
    let arr = [];
    for (let i = 0; i < 25; i++) {
        let type = Math.random() < 0.5 ? 'deer' : (Math.random() < 0.6 ? 'wolf' : 'bear');
        let x = Math.floor(5 + Math.random() * (WORLD_W - 10));
        let y = Math.floor(5 + Math.random() * (WORLD_H - 10));
        arr.push({ x, y, type, hp: type === 'bear' ? 50 : 30 });
    }
    return arr;
}

function isSolid(x, y, ignoreRes = false) {
    if (x < 0 || y < 0 || x >= WORLD_W || y >= WORLD_H) return true;
    for (let w of walls) if (w.x === x && w.y === y) return true;
    if (!ignoreRes) for (let r of resources) if (r.x === x && r.y === y) return true;
    return false;
}

function getFreeSpawn() {
    for (let t = 0; t < 200; t++) {
        let x = Math.floor(5 + Math.random() * (WORLD_W - 10));
        let y = Math.floor(5 + Math.random() * (WORLD_H - 10));
        if (!isSolid(x, y, true)) return { x, y };
    }
    return { x: 10, y: 10 };
}

const craftMap = {
    '🗡️ Деревянный меч': { wood: 10, damage: 14, staminaCost: 12, name: 'Меч' },
    '🪓 Каменный топор': { stone: 8, damage: 18, staminaCost: 14, name: 'Топор' },
    '⛏️ Железная кирка': { iron: 6, damage: 22, staminaCost: 16, name: 'Кирка' },
    '⛽ Бензопила': { wood: 8, iron: 3, fuel: 2, damage: 35, staminaCost: 20, name: 'Бензопила' },
    '🏹 Арбалет': { wood: 12, iron: 5, damage: 28, staminaCost: 18, name: 'Арбалет' }
};

io.on('connection', (socket) => {
    const spawn = getFreeSpawn();
    const id = String(nextId++);
    
    players[id] = {
        id: id,
        x: spawn.x,
        y: spawn.y,
        health: 100,
        inventory: { wood: 12, stone: 6, iron: 2, emerald: 1, fuel: 2 },
        name: `Slizer_${Math.floor(Math.random()*900)}`
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
    io.emit('updateAnimals', animals);
    
    socket.on('joinGame', () => {});
    
    socket.on('move', (data) => {
        if (!players[id]) return;
        let newX = players[id].x + data.dx;
        let newY = players[id].y + data.dy;
        if (!isSolid(newX, newY)) {
            players[id].x = newX;
            players[id].y = newY;
            // Сбор ресурсов
            const resIndex = resources.findIndex(r => r.x === newX && r.y === newY);
            if (resIndex !== -1) {
                const res = resources[resIndex];
                if (res.type === 'wood') players[id].inventory.wood += 2;
                else if (res.type === 'stone') players[id].inventory.stone += 1;
                else if (res.type === 'emerald') players[id].inventory.emerald += 1;
                else if (res.type === 'barrel') players[id].inventory.fuel += 2;
                resources.splice(resIndex, 1);
                io.emit('updateResources', resources);
            }
            // Атака животных
            animals.forEach(a => {
                if (Math.abs(a.x - newX) < 1.2 && Math.abs(a.y - newY) < 1.2) {
                    a.hp -= 25;
                    if (a.hp <= 0) animals = animals.filter(an => an !== a);
                    io.emit('updateAnimals', animals);
                }
            });
            io.emit('updatePlayers', players);
            socket.emit('playerUpdate', { id, inventory: players[id].inventory, health: players[id].health });
        }
    });
    
    socket.on('attack', (data) => {
        if (!players[id]) return;
        let attacker = players[id];
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
            }
            io.emit('attackEffect', { target: closest.id, newHealth: closest.health });
            io.emit('updatePlayers', players);
        }
    });
    
    socket.on('craft', (data) => {
        if (!players[id]) return;
        let inv = players[id].inventory;
        const recipe = data.recipe;
        const req = recipe.req;
        let canCraft = true;
        for (let [r, val] of Object.entries(req)) if ((inv[r] || 0) < val) canCraft = false;
        if (canCraft) {
            for (let [r, val] of Object.entries(req)) inv[r] -= val;
            if (recipe.resultWeapon) {
                players[id].weapon = recipe.resultWeapon;
            }
            socket.emit('playerUpdate', { id, inventory: inv, health: players[id].health });
            io.emit('updatePlayers', players);
        }
    });
    
    socket.on('disconnect', () => {
        delete players[id];
        io.emit('updatePlayers', players);
    });
});

resources = generateResources();
animals = generateAnimals();
setInterval(() => {
    if (resources.length < 80) {
        let type = Math.random() < 0.5 ? 'wood' : (Math.random() < 0.6 ? 'stone' : 'emerald');
        let x = Math.floor(Math.random() * WORLD_W);
        let y = Math.floor(Math.random() * WORLD_H);
        if (!isSolid(x, y, true)) resources.push({ x, y, type });
        io.emit('updateResources', resources);
    }
    if (animals.length < 18) {
        let type = Math.random() < 0.5 ? 'deer' : 'wolf';
        let x = Math.floor(5 + Math.random() * (WORLD_W - 10));
        let y = Math.floor(5 + Math.random() * (WORLD_H - 10));
        animals.push({ x, y, type, hp: 30 });
        io.emit('updateAnimals', animals);
    }
}, 12000);

server.listen(process.env.PORT || 3000, '0.0.0.0', () => {
    console.log('✅ Slize 2D сервер запущен');
});
