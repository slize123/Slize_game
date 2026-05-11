const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname)));

// НАСТРОЙКИ МИРА
const WORLD_W = 200;
const WORLD_H = 200;
const TICK_RATE = 60;
const TILE = 48;

let players = {};
let resources = [];
let buildings = [];
let mobs = [];
let nextId = 1;

// РЕЦЕПТЫ КРАФТА
const recipes = [
    { name: 'Деревянный меч', result: 'wood_sword', req: [{ item: 'wood', count: 10 }] },
    { name: 'Кирка', result: 'pickaxe', req: [{ item: 'wood', count: 5 }, { item: 'stone', count: 5 }] },
    { name: 'Стена', result: 'wall', req: [{ item: 'wood', count: 5 }] },
    { name: 'Костёр', result: 'campfire', req: [{ item: 'wood', count: 8 }, { item: 'stone', count: 3 }] }
];

// ГЕНЕРАЦИЯ БИОМОВ
function getBiome(x, y) {
    if (x < 40 && y < 40) return 'desert';
    if (x > 160 && y > 160) return 'snow';
    if (x > 80 && x < 120 && y > 80 && y < 120) return 'forest';
    return 'plains';
}

function generateWorld() {
    resources = [];
    for (let i = 0; i < 2000; i++) {
        const x = Math.floor(Math.random() * WORLD_W);
        const y = Math.floor(Math.random() * WORLD_H);
        const biome = getBiome(x, y);
        let type = 'tree';
        if (biome === 'desert') type = Math.random() > 0.8 ? 'stone' : 'cactus';
        else if (biome === 'snow') type = Math.random() > 0.7 ? 'stone' : 'snow_tree';
        else if (biome === 'forest') type = Math.random() > 0.8 ? 'stone' : 'tree';
        else type = ['tree', 'stone', 'bush'][Math.floor(Math.random() * 3)];

        resources.push({ id: nextId++, x, y, type, hp: type === 'stone' ? 50 : 30, maxHp: type === 'stone' ? 50 : 30 });
    }

    // Мобы (Волки)
    for (let i = 0; i < 50; i++) {
        mobs.push({
            id: nextId++,
            x: Math.floor(Math.random() * WORLD_W),
            y: Math.floor(Math.random() * WORLD_H),
            type: 'wolf',
            hp: 50,
            maxHp: 50,
            targetId: null,
            angle: Math.random() * Math.PI * 2,
            attackCd: 0
        });
    }
}

function isSolid(x, y) {
    if (x < 0 || y < 0 || x >= WORLD_W || y >= WORLD_H) return true;
    for (let b of buildings) { if (b.x === x && b.y === y) return true; }
    return false;
}

function getFreeSpawn() {
    for (let i = 0; i < 500; i++) {
        const x = Math.floor(WORLD_W/2 - 20 + Math.random() * 40);
        const y = Math.floor(WORLD_H/2 - 20 + Math.random() * 40);
        if (!isSolid(x, y)) return { x, y };
    }
    return { x: WORLD_W/2, y: WORLD_H/2 };
}

function hasItem(inv, item, count) {
    let c = 0;
    inv.forEach(i => { if (i && i.id === item) c += i.count; });
    return c >= count;
}

function removeItem(inv, item, count) {
    let left = count;
    for (let i = 0; i < inv.length; i++) {
        if (inv[i] && inv[i].id === item) {
            const take = Math.min(inv[i].count, left);
            inv[i].count -= take;
            left -= take;
            if (inv[i].count <= 0) inv[i] = null;
            if (left <= 0) break;
        }
    }
    return inv;
}

function addItem(inv, item, count) {
    for (let i = 0; i < inv.length; i++) {
        if (inv[i] && inv[i].id === item) { inv[i].count += count; return inv; }
    }
    for (let i = 0; i < inv.length; i++) {
        if (!inv[i]) { inv[i] = { id: item, count }; return inv; }
    }
    return inv;
}

io.on('connection', (socket) => {
    let pId = null;

    socket.on('login', (data) => {
        const spawn = getFreeSpawn();
        pId = String(nextId++);
        players[pId] = {
            id: pId, socketId: socket.id,
            x: spawn.x, y: spawn.y,
            name: data.nickname || `Гость_${Math.floor(Math.random()*999)}`,
            hp: 100, maxHp: 100, hunger: 100,
            inventory: Array(20).fill(null),
            equip: 'hand',
            angle: 0, isAttacking: false, moveAnim: 0,
            dx: 0, dy: 0
        };
        // Стартовые предметы
        players[pId].inventory = addItem(players[pId].inventory, 'wood', 5);

        socket.emit('init', { id: pId, worldW: WORLD_W, worldH: WORLD_H, recipes });
        io.emit('updatePlayers', players);
        io.emit('onlineCount', Object.keys(players).length);
    });

    socket.on('move', (data) => {
        if (!pId || !players[pId]) return;
        const p = players[pId];
        p.dx = data.dx; p.dy = data.dy;
        p.angle = data.angle;
        
        const speed = 0.15;
        let newX = p.x + data.dx * speed;
        let newY = p.y + data.dy * speed;

        if (!isSolid(Math.floor(newX), Math.floor(newY))) {
            p.x = newX; p.y = newY;
        }
        if (data.dx !== 0 || data.dy !== 0) p.moveAnim += 0.2;
    });

    socket.on('attack', () => {
        if (!pId || !players[pId]) return;
        const p = players[pId];
        p.isAttacking = true;
        setTimeout(() => p.isAttacking = false, 150);

        const damage = p.equip === 'wood_sword' ? 20 : (p.equip === 'pickaxe' ? 10 : 5);
        
        // Удар по ресурсам
        for (let i = resources.length - 1; i >= 0; i--) {
            const r = resources[i];
            if (Math.hypot(p.x - r.x, p.y - r.y) < 1.5) {
                r.hp -= damage;
                if (r.hp <= 0) {
                    let drop = 'wood';
                    let count = 2;
                    if (r.type === 'stone') { drop = 'stone'; count = 2; }
                    else if (r.type === 'bush') { drop = 'berry'; count = 3; }
                    else if (r.type === 'cactus') { drop = 'berry'; count = 1; }
                    p.inventory = addItem(p.inventory, drop, count);
                    p.inventory = addItem(p.inventory, 'exp', 5);
                    resources.splice(i, 1);
                }
                break;
            }
        }

        // Удар по мобам
        for (let m of mobs) {
            if (Math.hypot(p.x - m.x, p.y - m.y) < 1.5) {
                m.hp -= damage;
                if (m.hp <= 0) {
                    p.inventory = addItem(p.inventory, 'meat', 2);
                    p.inventory = addItem(p.inventory, 'exp', 15);
                    m.hp = m.maxHp;
                    const s = getFreeSpawn();
                    m.x = s.x; m.y = s.y;
                }
                break;
            }
        }
    });

    socket.on('craft', (itemIndex) => {
        if (!pId || !players[pId]) return;
        const recipe = recipes[itemIndex];
        if (!recipe) return;
        let canCraft = true;
        recipe.req.forEach(r => { if (!hasItem(players[pId].inventory, r.item, r.count)) canCraft = false; });
        
        if (canCraft) {
            recipe.req.forEach(r => { players[pId].inventory = removeItem(players[pId].inventory, r.item, r.count); });
            if (recipe.result === 'wall' || recipe.result === 'campfire') {
                players[pId].inventory = addItem(players[pId].inventory, recipe.result, 1);
            } else {
                players[pId].equip = recipe.result;
            }
        }
    });

    socket.on('placeBuilding', (data) => {
        if (!pId || !players[pId]) return;
        const p = players[pId];
        const item = p.inventory[data.slotIndex];
        if (!item || (item.id !== 'wall' && item.id !== 'campfire')) return;
        
        const bx = Math.floor(p.x + Math.cos(p.angle));
        const by = Math.floor(p.y + Math.sin(p.angle));
        
        if (!isSolid(bx, by)) {
            buildings.push({ id: nextId++, x: bx, y: by, type: item.id, owner: pId });
            p.inventory = removeItem(p.inventory, item.id, 1);
        }
    });

    socket.on('eat', (item) => {
        if (!pId || !players[pId]) return;
        if (item === 'berry' || item === 'meat') {
            if (hasItem(players[pId].inventory, item, 1)) {
                players[pId].inventory = removeItem(players[pId].inventory, item, 1);
                players[pId].hunger = Math.min(100, players[pId].hunger + (item === 'meat' ? 30 : 15));
                players[pId].hp = Math.min(players[pId].maxHp, players[pId].hp + 10);
            }
        }
    });

    socket.on('disconnect', () => {
        if (pId) { delete players[pId]; io.emit('updatePlayers', players); io.emit('onlineCount', Object.keys(players).length); }
    });
});

// ИГРОВОЙ ЦИКЛ СЕРВЕРА (Мобы и Голода)
setInterval(() => {
    // Голод
    for (let p of Object.values(players)) {
        p.hunger -= 0.02;
        if (p.hunger <= 0) { p.hunger = 0; p.hp -= 0.1; }
        if (p.hp <= 0) { p.hp = 100; p.hunger = 50; const s = getFreeSpawn(); p.x = s.x; p.y = s.y; }
    }

    // ИИ Мобов
    for (let m of mobs) {
        if (m.attackCd > 0) m.attackCd--;
        let target = null;
        let minDist = 8; // Дистанция агрессии

        for (let p of Object.values(players)) {
            const d = Math.hypot(p.x - m.x, p.y - m.y);
            if (d < minDist) { minDist = d; target = p; }
        }

        if (target) {
            const angle = Math.atan2(target.y - m.y, target.x - m.x);
            m.x += Math.cos(angle) * 0.1;
            m.y += Math.sin(angle) * 0.1;
            m.angle = angle;

            if (minDist < 1.2 && m.attackCd === 0) {
                target.hp -= 10;
                m.attackCd = 30; // 0.5 сек кд
            }
        } else {
            // Бродить
            if (Math.random() < 0.02) m.angle += (Math.random() - 0.5) * 2;
            m.x += Math.cos(m.angle) * 0.03;
            m.y += Math.sin(m.angle) * 0.03;
            if (isSolid(Math.floor(m.x), Math.floor(m.y))) m.angle += Math.PI;
        }
    }

    io.emit('gameState', { players, resources, buildings, mobs });
}, 1000 / TICK_RATE);

generateWorld();
server.listen(process.env.PORT || 3000, '0.0.0.0', () => {
    console.log(`✅ Slize сервер запущен. Карта: ${WORLD_W}x${WORLD_H}`);
});
