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
    { name: 'Стена', result: 'wall', req: [{ item: 'wood', count: 8 }], type: 'building' },
    { name: 'Костёр', result: 'campfire', req: [{ item: 'wood', count: 10 }, { item: 'stone', count: 5 }], type: 'building' },
    { name: 'Аптечка', result: 'medkit', req: [{ item: 'berry', count: 8 }, { item: 'meat', count: 2 }], type: 'consumable' },
    { name: 'Ягоды', result: 'berry', req: [{ item: 'berry', count: 2 }], type: 'consumable' }
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
    for (let i = 0; i < 2800; i++) {
        const x = Math.floor(Math.random() * WORLD_W);
        const y = Math.floor(Math.random() * WORLD_H);
        const biome = getBiome(x, y);
        let type = 'tree';
        if (biome === 'desert') type = Math.random() > 0.7 ? 'stone' : 'cactus';
        else if (biome === 'snow') type = Math.random() > 0.6 ? 'stone' : 'snow_tree';
        else if (biome === 'forest') type = Math.random() > 0.8 ? 'stone' : 'tree';
        else type = ['tree', 'stone', 'bush'][Math.floor(Math.random() * 3)];
        
        resources.push({ id: nextId++, x, y, type, hp: (type === 'stone' ? 50 : 30), maxHp: (type === 'stone' ? 50 : 30) });
    }
    // Мобы (волки и медведи)
    for (let i = 0; i < 100; i++) {
        mobs.push({
            id: nextId++,
            x: Math.floor(Math.random() * WORLD_W),
            y: Math.floor(Math.random() * WORLD_H),
            type: Math.random() > 0.7 ? 'bear' : 'wolf',
            hp: Math.random() > 0.7 ? 120 : 70,
            maxHp: Math.random() > 0.7 ? 120 : 70,
            targetId: null,
            angle: Math.random() * Math.PI * 2,
            attackCd: 0,
            wanderCd: 0
        });
    }
}

function isSolid(x, y, radius = 0.35) {
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
        const x = WORLD_W/2 - 30 + Math.random() * 60;
        const y = WORLD_H/2 - 30 + Math.random() * 60;
        if (!isSolid(x, y)) return { x, y };
    }
    return { x: WORLD_W/2, y: WORLD_H/2 };
}

// Инвентарь хелперы
function hasItem(inv, item, count) {
    let c = 0;
    for (let i of inv) if (i && i.id === item) c += i.count;
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
        if (inv[i] && inv[i].id === item) {
            inv[i].count += count;
            return inv;
        }
    }
    for (let i = 0; i < inv.length; i++) {
        if (!inv[i]) {
            inv[i] = { id: item, count: count };
            return inv;
        }
    }
    return inv;
}

// Сохранение прогресса (в памяти по нику)
const userSave = new Map();

io.on('connection', (socket) => {
    let pId = null;
    let nick = null;

    socket.on('login', (data) => {
        nick = data.nickname;
        const saved = userSave.get(nick);
        const spawn = getFreeSpawn();
        pId = String(nextId++);
        
        players[pId] = {
            id: pId, socketId: socket.id,
            x: spawn.x, y: spawn.y,
            name: nick,
            hp: saved ? saved.hp : 100,
            maxHp: 100,
            stamina: 100,
            hunger: saved ? saved.hunger : 100,
            level: saved ? saved.level : 1,
            exp: saved ? saved.exp : 0,
            inventory: saved ? JSON.parse(JSON.stringify(saved.inventory)) : Array(20).fill(null),
            equip: 'hand',
            angle: 0, isAttacking: false, attackTimer: 0,
            moveAnim: 0
        };
        if (!saved) {
            players[pId].inventory = addItem(players[pId].inventory, 'wood', 10);
            players[pId].inventory = addItem(players[pId].inventory, 'stone', 5);
            players[pId].inventory = addItem(players[pId].inventory, 'berry', 6);
        }
        
        socket.emit('init', { id: pId, worldW: WORLD_W, worldH: WORLD_H, recipes, x: players[pId].x, y: players[pId].y });
        io.emit('onlineCount', Object.keys(players).length);
    });

    socket.on('move', (data) => {
        if (!pId || !players[pId]) return;
        const p = players[pId];
        p.angle = data.angle;
        const speed = 0.16;
        let newX = p.x + data.dx * speed;
        let newY = p.y + data.dy * speed;
        if (!isSolid(newX, p.y)) p.x = newX;
        if (!isSolid(p.x, newY)) p.y = newY;
        if (data.dx !== 0 || data.dy !== 0) p.moveAnim += 0.3;
    });

    socket.on('attack', () => {
        if (!pId || !players[pId] || players[pId].attackTimer > 0) return;
        const p = players[pId];
        if (p.stamina < 12) return;
        p.stamina -= 12;
        p.isAttacking = true;
        p.attackTimer = 12;
        
        const damage = p.equip === 'wood_sword' ? 28 : (p.equip === 'pickaxe' ? 18 : 12);
        
        // Атака по ресурсам
        for (let i = 0; i < resources.length; i++) {
            const r = resources[i];
            if (Math.hypot(p.x - (r.x+0.5), p.y - (r.y+0.5)) < 1.5) {
                r.hp -= damage;
                socket.emit('addParticle', { x: (r.x+0.5)*TILE, y: (r.y+0.5)*TILE, color: '#ffaa66' });
                if (r.hp <= 0) {
                    let drop = 'wood', count = 2;
                    if (r.type === 'stone') { drop = 'stone'; count = 2; }
                    else if (r.type === 'bush' || r.type === 'cactus') { drop = 'berry'; count = 3; }
                    else if (r.type === 'snow_tree') { drop = 'wood'; count = 3; }
                    p.inventory = addItem(p.inventory, drop, count);
                    resources.splice(i,1);
                }
                break;
            }
        }
        // Атака по мобам
        for (let m of mobs) {
            if (Math.hypot(p.x - m.x, p.y - m.y) < 1.5) {
                m.hp -= damage;
                socket.emit('addParticle', { x: m.x*TILE + TILE/2, y: m.y*TILE + TILE/2, color: '#ff4444' });
                if (m.hp <= 0) {
                    p.inventory = addItem(p.inventory, 'meat', 2);
                    p.exp += 30;
                    const newSpawn = getFreeSpawn();
                    m.x = newSpawn.x; m.y = newSpawn.y;
                    m.hp = m.maxHp;
                }
                break;
            }
        }
    });

    socket.on('craft', (idx) => {
        if (!pId || !players[pId]) return;
        const rec = recipes[idx];
        if (!rec) return;
        let can = true;
        for (let r of rec.req) {
            if (!hasItem(players[pId].inventory, r.item, r.count)) can = false;
        }
        if (can) {
            for (let r of rec.req) players[pId].inventory = removeItem(players[pId].inventory, r.item, r.count);
            if (rec.type === 'building' || rec.type === 'consumable') {
                players[pId].inventory = addItem(players[pId].inventory, rec.result, 1);
            } else {
                players[pId].equip = rec.result;
            }
        }
    });

    socket.on('placeBuilding', (data) => {
        if (!pId || !players[pId]) return;
        const p = players[pId];
        const item = p.inventory[data.slotIndex];
        if (!item || (item.id !== 'wall' && item.id !== 'campfire')) return;
        const bx = Math.floor(p.x + Math.cos(p.angle) * 1.4);
        const by = Math.floor(p.y + Math.sin(p.angle) * 1.4);
        if (!isSolid(bx + 0.5, by + 0.5, 0.5)) {
            buildings.push({ id: nextId++, x: bx, y: by, type: item.id, owner: pId });
            p.inventory = removeItem(p.inventory, item.id, 1);
        }
    });

    socket.on('eat', (data) => {
        if (!pId || !players[pId]) return;
        const p = players[pId];
        if (!hasItem(p.inventory, data.itemId, 1)) return;
        if (data.itemId === 'berry') {
            p.inventory = removeItem(p.inventory, 'berry', 1);
            p.hunger = Math.min(100, p.hunger + 12);
            p.hp = Math.min(100, p.hp + 8);
        } else if (data.itemId === 'meat') {
            p.inventory = removeItem(p.inventory, 'meat', 1);
            p.hunger = Math.min(100, p.hunger + 30);
            p.hp = Math.min(100, p.hp + 20);
        } else if (data.itemId === 'medkit') {
            p.inventory = removeItem(p.inventory, 'medkit', 1);
            p.hp = Math.min(100, p.hp + 50);
        }
    });

    socket.on('disconnect', () => {
        if (pId && players[pId]) {
            // Сохраняем прогресс
            const p = players[pId];
            userSave.set(p.name, {
                hp: p.hp, hunger: p.hunger, level: p.level, exp: p.exp,
                inventory: p.inventory
            });
            delete players[pId];
            io.emit('onlineCount', Object.keys(players).length);
        }
    });
});

// ИГРОВОЙ ЦИКЛ (30 fps)
setInterval(() => {
    // Регенерация стамины, голод, уровни
    for (let p of Object.values(players)) {
        p.stamina = Math.min(100, p.stamina + 1.2);
        p.hunger = Math.max(0, p.hunger - 0.012);
        if (p.hunger <= 0) p.hp = Math.max(0, p.hp - 0.15);
        if (p.hp <= 0) {
            p.hp = 100;
            p.hunger = 70;
            const s = getFreeSpawn();
            p.x = s.x; p.y = s.y;
        }
        if (p.attackTimer > 0) p.attackTimer--;
        if (p.attackTimer === 0) p.isAttacking = false;
        
        // Опыт -> уровень
        let expNeeded = 100 + (p.level-1) * 50;
        if (p.exp >= expNeeded) {
            p.level++;
            p.exp -= expNeeded;
            p.hp = Math.min(p.maxHp, p.hp + 20);
        }
    }
    
    // Логика мобов
    for (let m of mobs) {
        if (m.attackCd > 0) m.attackCd--;
        let target = null;
        let minDist = 10;
        for (let p of Object.values(players)) {
            const d = Math.hypot(p.x - m.x, p.y - m.y);
            if (d < minDist) { minDist = d; target = p; }
        }
        if (target) {
            const angle = Math.atan2(target.y - m.y, target.x - m.x);
            let newX = m.x + Math.cos(angle) * 0.08;
            let newY = m.y + Math.sin(angle) * 0.08;
            if (!isSolid(newX, newY, 0.4)) { m.x = newX; m.y = newY; }
            m.angle = angle;
            if (minDist < 1.3 && m.attackCd === 0) {
                target.hp = Math.max(0, target.hp - (m.type === 'bear' ? 15 : 10));
                m.attackCd = 30;
            }
        } else {
            m.wanderCd--;
            if (m.wanderCd <= 0) {
                m.angle += (Math.random() - 0.5) * 2;
                m.wanderCd = 40 + Math.random() * 80;
            }
            let newX = m.x + Math.cos(m.angle) * 0.035;
            let newY = m.y + Math.sin(m.angle) * 0.035;
            if (!isSolid(newX, newY, 0.4)) { m.x = newX; m.y = newY; }
            else m.angle += Math.PI;
        }
    }
    
    // Респавн ресурсов
    if (resources.length < 2400) {
        for (let i=0; i<5; i++) {
            const x = Math.floor(Math.random() * WORLD_W);
            const y = Math.floor(Math.random() * WORLD_H);
            const biome = getBiome(x,y);
            let type = 'tree';
            if (biome === 'desert') type = Math.random()>0.7 ? 'stone' : 'cactus';
            else if (biome === 'snow') type = Math.random()>0.6 ? 'stone' : 'snow_tree';
            else if (biome === 'forest') type = Math.random()>0.8 ? 'stone' : 'tree';
            else type = ['tree','stone','bush'][Math.floor(Math.random()*3)];
            resources.push({ id: nextId++, x, y, type, hp: type==='stone'?50:30, maxHp: type==='stone'?50:30 });
        }
    }
    
    io.emit('gameState', { players, resources, buildings, mobs });
}, 1000/30);

generateWorld();
server.listen(process.env.PORT || 3000, '0.0.0.0', () => {
    console.log(`✅ Slize сервер запущен. Карта: ${WORLD_W}x${WORLD_H}`);
    console.log(`Ресурсов: ${resources.length}, мобов: ${mobs.length}, построек: ${buildings.length}`);
});
