const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(__dirname));

const WORLD_W = 200;
const WORLD_H = 200;
let players = {};
let resources = [];
let nextId = 1;

function generateWorld() {
    resources = [];
    for (let i = 0; i < 2500; i++) {
        const x = Math.floor(Math.random() * WORLD_W);
        const y = Math.floor(Math.random() * WORLD_H);
        const type = Math.random() > 0.6 ? 'tree' : 'stone';
        resources.push({id: nextId++, x, y, type, hp: type==='stone'?60:35});
    }
}

io.on('connection', (socket) => {
    let pId = null;

    socket.on('login', (data) => {
        pId = String(nextId++);
        const spawnX = 80 + Math.random()*40;
        const spawnY = 80 + Math.random()*40;

        players[pId] = {
            id: pId,
            x: spawnX,
            y: spawnY,
            name: data.nickname || 'Player',
            hp: 100,
            hunger: 100,
            stamina: 100,
            angle: 0
        };

        socket.emit('init', { id: pId });
        console.log(`Игрок ${players[pId].name} подключился`);
    });

    socket.on('move', (data) => {
        if (!players[pId]) return;
        const p = players[pId];
        const speed = 0.17;

        p.x += data.dx * speed;
        p.y += data.dy * speed;
        p.angle = data.angle || p.angle;

        // Ограничение мира
        p.x = Math.max(1, Math.min(WORLD_W-1, p.x));
        p.y = Math.max(1, Math.min(WORLD_H-1, p.y));
    });

    socket.on('attack', () => {
        // Простая атака по ресурсам
        if (!players[pId]) return;
        const p = players[pId];
        for (let i = resources.length-1; i >= 0; i--) {
            const r = resources[i];
            if (Math.hypot(p.x - r.x, p.y - r.y) < 2) {
                r.hp -= 25;
                if (r.hp <= 0) resources.splice(i,1);
                break;
            }
        }
    });

    socket.on('disconnect', () => {
        if (pId) delete players[pId];
    });
});

// Игровой цикл
setInterval(() => {
    io.emit('gameState', { players, resources });
}, 1000/30);

generateWorld();
server.listen(3000, '0.0.0.0', () => {
    console.log('🚀 Slize сервер запущен на http://localhost:3000');
});
