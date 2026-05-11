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
const TILE = 48;

let players = {};
let resources = [];
let buildings = [];
let mobs = [];
let nextId = 1;

// РЕЦЕПТЫ КРАФТА
const recipes = [
    { name: 'Деревянный меч', result: 'wood_sword', req: [{ item: 'wood', count: 10 }], type: 'weapon' },
    { name: 'Кирка', result: 'pickaxe', req: [{ item: 'wood', count: 5 }, { item: 'stone', count: 5 }], type: 'weapon' },
    { name: 'Стена', result: 'wall', req: [{ item: 'wood', count: 5 }], type: 'building' },
    { name: 'Костёр', result: 'campfire', req: [{ item: 'wood', count: 8 }, { item: 'stone', count: 3 }], type: 'building' }
];

// Определение биома
function getBiome(x, y) {
    if (x < 50 && y < 50) return 'desert';
    if (x > 150 && y > 150) return 'snow';
    if (x > 70 && x < 130 && y > 70 && y < 130) return 'forest';
    return 'plains';
}

function generateWorld() {
    resources = [];
    // Генерация ресурсов в зависимости от биома
    for (let i = 0; i < 3000; i++) {
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
    for (let i = 0; i < 80; i++) {
        mobs.push({
            id: nextId++,
            x: Math.floor(Math.random() * WORLD_W),
            y: Math.floor(Math.random() * WORLD_H),
            type: 'wolf',
            hp: 60,
            maxHp: 60,
            targetId: null,
            angle: Math.random() * Math.PI * 2,
            attackCd: 0,
            wanderCd: 0
        });
    }
}

// Проверка коллизий (учитываем радиус игрока)
function isSolid(x, y, radius = 0.3) {
    const points = [
        { px: x - radius, py: y - radius },
        { px: x + radius, py: y - radius },
        { px: x - radius, py: y + radius },
        { px: x + radius, py: y + radius }
    ];
    for (let p of points) {
        if (p.px < 0 || p.py < 0 || p.px >= WORLD_W || p.py >= WORLD_H) return true;
        for (let b of buildings) {
            if (Math.floor(p.px) === b.x && Math.floor(p.py) === b.y) return true;
        }
    }
    return false;
}

function getFreeSpawn() {
    for (let i = 0; i < 500; i++) {
        const x = WORLD_W/2 - 20 + Math.random() * 40;
        const y = WORLD_H/2 - 20 + Math.random() * 40;
        if (!isSolid(x, y)) return { x, y };
    }
    return { x: WORLD_W/2, y: WORLD_H/2 };
}

// Инвентарь хелперы
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
    return inv; // Инвентарь полон
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
            angle: 0, isAttacking: false, attackTimer: 0,
            moveAnim: 0, dx: 0, dy: 0
        };
        players[pId].inventory = addItem(players[pId].inventory, 'wood', 5);

        socket.emit('init', { id: pId, worldW: WORLD_W, worldH: WORLD_H, recipes, x: spawn.x, y: spawn.y });
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

        // Раздельная проверка по осям, чтобы не застревать в стенах
        if (!isSolid(newX, p.y)) p.x = newX;
        if (!isSolid(p.x, newY)) p.y = newY;

        if (data.dx !== 0 || data.dy !== 0) p.moveAnim += 0.3;
    });

    socket.on('attack', () => {
        if (!pId || !players[pId] || players[pId].attackTimer > 0) return;
        const p = players[pId];
        p.isAttacking = true;
        p.attackTimer = 15; // Кулдаун 0.5 сек

        const damage = p.equip === 'wood_sword' ? 25 : (p.equip === 'pickaxe' ? 15 : 8);
        
        // Удар по ресурсам
        for (let i = resources.length - 1; i >= 0; i--) {
            const r = resources[i];
            if (Math.hypot(p.x - (r.x+0.5), p.y - (r.y+0.5)) < 1.8) {
                r.hp -= damage;
                if (r.hp <= 0) {
                    let drop = 'wood'; let count = 2;
                    if (r.type === 'stone') { drop = 'stone'; count = 2; }
                    else if (r.type === 'bush' || r.type === 'cactus') { drop = 'berry'; count = 3; }
                    else if (r.type === 'snow_tree') { drop = 'wood'; count = 3; }
                    
                    p.inventory = addItem(p.inventory, drop, count);
                    resources.splice(i, 1);
                }
                break;
            }
        }

        // Удар по мобам
        for (let m of mobs) {
            if (Math.hypot(p.x - m.x, p.y - m.y) < 1.8) {
                m.hp -= damage;
                if (m.hp <= 0) {
                    p.inventory = addItem(p.inventory, 'meat', 2);
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
            if (recipe.type === 'building') {
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
        
        // Ставим перед игроком
        const bx = Math.floor(p.x + Math.cos(p.angle) * 1.5);
        const by = Math.floor(p.y + Math.sin(p.angle) * 1.5);
        
        if (!isSolid(bx + 0.5, by + 0.5, 0.5)) {
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
                players[pId].hp = Math.min(players[pId].maxHp, players[pId].hp + (item === 'meat' ? 15 : 5));
            }
        }
    });

    socket.on('disconnect', () => {
        if (pId) { delete players[pId]; io.emit('onlineCount', Object.keys(players).length); }
    });
});

// ИГРОВОЙ ЦИКЛ СЕРВЕРА (Математика мобов, голод, таймеры)
setInterval(() => {
    for (let p of Object.values(players)) {
        p.hunger = Math.max(0, p.hunger - 0.01);
        if (p.hunger <= 0) p.hp = Math.max(0, p.hp - 0.1);
        if (p.hp <= 0) { p.hp = 100; p.hunger = 50; const s = getFreeSpawn(); p.x = s.x; p.y = s.y; }
        if (p.attackTimer > 0) p.attackTimer--;
        if (p.attackTimer === 0) p.isAttacking = false;
    }

    for (let m of mobs) {
        if (m.attackCd > 0) m.attackCd--;
        let target = null;
        let minDist = 8; // Дистанция агрессии волков

        for (let p of Object.values(players)) {
            const d = Math.hypot(p.x - m.x, p.y - m.y);
            if (d < minDist) { minDist = d; target = p; }
        }

        if (target) {
            const angle = Math.atan2(target.y - m.y, target.x - m.x);
            const newX = m.x + Math.cos(angle) * 0.08;
            const newY = m.y + Math.sin(angle) * 0.08;
            if (!isSolid(newX, newY, 0.3)) { m.x = newX; m.y = newY; }
            m.angle = angle;

            if (minDist < 1.2 && m.attackCd === 0) {
                target.hp = Math.max(0, target.hp - 10);
                m.attackCd = 30;
            }
        } else {
            m.wanderCd--;
            if (m.wanderCd <= 0) {
                m.angle += (Math.random() - 0.5) * 2;
                m.wanderCd = 30 + Math.random() * 60;
            }
            const newX = m.x + Math.cos(m.angle) * 0.03;
            const newY = m.y + Math.sin(m.angle) * 0.03;
            if (!isSolid(newX, newY, 0.3)) { m.x = newX; m.y = newY; }
            else m.angle += Math.PI;
        }
    }

    io.emit('gameState', { players, resources, buildings, mobs });
}, 1000 / 30); // 30 тиков в секунду

generateWorld();
server.listen(process.env.PORT || 3000, '0.0.0.0', () => {
    console.log(`✅ Slize сервер запущен. Огромная карта: ${WORLD_W}x${WORLD_H}`);
});
