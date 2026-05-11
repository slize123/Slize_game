const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname)));

let players = {};
let resources = [];
let nextId = 1;
let sessionIds = new Set();

const WORLD_W = 80;
const WORLD_H = 60;

// Генерация ресурсов
function generateResources() {
    const types = ['tree', 'stone', 'gold'];
    const arr = [];
    for (let i = 0; i < 400; i++) {
        const type = types[Math.floor(Math.random() * types.length)];
        const x = Math.floor(2 + Math.random() * (WORLD_W - 4));
        const y = Math.floor(2 + Math.random() * (WORLD_H - 4));
        arr.push({ id: Math.random(), x, y, type, hp: type === 'tree' ? 30 : 40 });
    }
    return arr;
}

function isSolid(x, y) {
    if (x < 1 || y < 1 || x >= WORLD_W - 1 || y >= WORLD_H - 1) return true;
    for (let p of Object.values(players)) {
        if (Math.floor(p.x) === x && Math.floor(p.y) === y) return true;
    }
    for (let r of resources) {
        if (r.x === x && r.y === y) return true;
    }
    return false;
}

function getFreeSpawn() {
    for (let i = 0; i < 500; i++) {
        const x = Math.floor(10 + Math.random() * (WORLD_W - 20));
        const y = Math.floor(10 + Math.random() * (WORLD_H - 20));
        if (!isSolid(x, y)) return { x, y };
    }
    return { x: 40, y: 30 };
}

// Сохранение прогресса (в памяти, можно заменить на БД)
const userData = new Map();

io.on('connection', (socket) => {
    console.log('Новое подключение');
    
    let currentPlayerId = null;
    
    socket.on('login', (data) => {
        const { email, nickname, isGuest } = data;
        const finalNick = nickname || `Гость_${Math.floor(Math.random() * 9999)}`;
        
        // Проверка на дубли по email
        let existingUser = null;
        if (email && !isGuest) {
            for (let [uid, p] of Object.entries(players)) {
                if (p.email === email) {
                    existingUser = p;
                    break;
                }
            }
        }
        
        let spawn;
        let savedData = null;
        
        if (existingUser) {
            // Возвращаем существующего игрока
            spawn = { x: existingUser.x, y: existingUser.y };
            savedData = { level: existingUser.level || 1, exp: existingUser.exp || 0 };
            currentPlayerId = existingUser.id;
            players[currentPlayerId] = existingUser;
            players[currentPlayerId].socketId = socket.id;
        } else {
            spawn = getFreeSpawn();
            const userId = String(nextId++);
            
            // Загружаем сохранённые данные
            const userKey = email || finalNick;
            const saved = userData.get(userKey);
            
            players[userId] = {
                id: userId,
                socketId: socket.id,
                x: spawn.x,
                y: spawn.y,
                health: 100,
                name: finalNick,
                email: email || null,
                level: saved?.level || 1,
                exp: saved?.exp || 0,
                inventory: saved?.inventory || Array(12).fill().map(() => ({ name: 'empty', count: 0 }))
            };
            currentPlayerId = userId;
        }
        
        // Инициализация инвентаря если пуст
        if (!players[currentPlayerId].inventory || players[currentPlayerId].inventory.length === 0) {
            players[currentPlayerId].inventory = Array(12).fill().map(() => ({ name: 'empty', count: 0 }));
            players[currentPlayerId].inventory[0] = { name: 'wood', count: 5 };
            players[currentPlayerId].inventory[1] = { name: 'stone', count: 3 };
        }
        
        socket.emit('init', {
            id: currentPlayerId,
            x: players[currentPlayerId].x,
            y: players[currentPlayerId].y,
            health: players[currentPlayerId].health,
            inventory: players[currentPlayerId].inventory,
            level: players[currentPlayerId].level,
            exp: players[currentPlayerId].exp
        });
        
        io.emit('updatePlayers', players);
        io.emit('updateResources', resources);
        io.emit('onlineCount', Object.keys(players).length);
    });
    
    socket.on('move', (data) => {
        if (!currentPlayerId || !players[currentPlayerId]) return;
        const p = players[currentPlayerId];
        let newX = p.x + data.dx;
        let newY = p.y + data.dy;
        
        if (!isSolid(newX, newY)) {
            p.x = newX;
            p.y = newY;
            
            // Сбор ресурсов
            const resIndex = resources.findIndex(r => Math.floor(r.x) === Math.floor(newX) && Math.floor(r.y) === Math.floor(newY));
            if (resIndex !== -1) {
                const res = resources[resIndex];
                let itemName = res.type === 'tree' ? 'wood' : (res.type === 'stone' ? 'stone' : 'gold');
                let amount = res.type === 'gold' ? 2 : 1;
                
                // Добавляем в инвентарь
                for (let i = 0; i < p.inventory.length; i++) {
                    if (p.inventory[i].name === itemName) {
                        p.inventory[i].count += amount;
                        break;
                    } else if (p.inventory[i].name === 'empty') {
                        p.inventory[i] = { name: itemName, count: amount };
                        break;
                    }
                }
                
                // Опыт
                let expGain = 5;
                p.exp += expGain;
                let expNeeded = 100 + (p.level - 1) * 50;
                if (p.exp >= expNeeded) {
                    p.level++;
                    p.exp = 0;
                }
                
                resources.splice(resIndex, 1);
                io.emit('updateResources', resources);
                
                // Сохраняем прогресс
                if (p.email) userData.set(p.email, { level: p.level, exp: p.exp, inventory: p.inventory });
            }
            
            io.emit('updatePlayers', players);
            socket.emit('playerUpdate', {
                id: currentPlayerId,
                x: p.x, y: p.y,
                health: p.health,
                inventory: p.inventory,
                level: p.level,
                exp: p.exp
            });
        }
    });
    
    socket.on('attack', (data) => {
        if (!currentPlayerId || !players[currentPlayerId]) return;
        const attacker = players[currentPlayerId];
        if (attacker.health <= 0) return;
        
        let closest = null;
        let minDist = 1.8;
        
        for (let pid in players) {
            if (pid !== currentPlayerId) {
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
                const spawn = getFreeSpawn();
                closest.x = spawn.x;
                closest.y = spawn.y;
                // Опыт за убийство
                attacker.exp += 20;
                let expNeeded = 100 + (attacker.level - 1) * 50;
                if (attacker.exp >= expNeeded) {
                    attacker.level++;
                    attacker.exp = 0;
                }
                if (attacker.email) userData.set(attacker.email, { level: attacker.level, exp: attacker.exp, inventory: attacker.inventory });
            }
            io.emit('attackEffect', { target: closest.id, newHealth: closest.health });
            io.emit('updatePlayers', players);
        }
    });
    
    socket.on('disconnect', () => {
        if (currentPlayerId && players[currentPlayerId]) {
            delete players[currentPlayerId];
            io.emit('updatePlayers', players);
            io.emit('onlineCount', Object.keys(players).length);
            console.log(`Игрок ${currentPlayerId} отключился`);
        }
    });
});

resources = generateResources();
setInterval(() => {
    if (resources.length < 300) {
        const types = ['tree', 'stone', 'gold'];
        const type = types[Math.floor(Math.random() * types.length)];
        const x = Math.floor(2 + Math.random() * (WORLD_W - 4));
        const y = Math.floor(2 + Math.random() * (WORLD_H - 4));
        if (!isSolid(x, y)) {
            resources.push({ id: Math.random(), x, y, type, hp: 30 });
            io.emit('updateResources', resources);
        }
    }
}, 8000);

server.listen(process.env.PORT || 3000, '0.0.0.0', () => {
    console.log('✅ Slize сервер запущен на порту 3000');
    console.log(`🌍 Карта: ${WORLD_W}x${WORLD_H} | Ресурсов: ${resources.length}`);
});
