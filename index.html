const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();

const server = http.createServer(app);

const io = socketIo(server, {
    cors: {
        origin: '*'
    }
});

app.use(express.static(path.join(__dirname)));

const PORT = process.env.PORT || 3000;

const WORLD_W = 300;
const WORLD_H = 300;

let nextId = 1;

let players = {};
let resources = [];
let mobs = [];
let buildings = [];

function rand(min, max) {
    return Math.random() * (max - min) + min;
}

function dist(x1, y1, x2, y2) {
    return Math.hypot(x2 - x1, y2 - y1);
}

function getSpawn() {
    return {
        x: rand(100, 200),
        y: rand(100, 200)
    };
}

function addItem(inv, id, count) {

    for (let i = 0; i < inv.length; i++) {

        if (inv[i] && inv[i].id === id) {
            inv[i].count += count;
            return;
        }
    }

    for (let i = 0; i < inv.length; i++) {

        if (!inv[i]) {
            inv[i] = {
                id,
                count
            };
            return;
        }
    }
}

function removeItem(inv, id, count) {

    for (let i = 0; i < inv.length; i++) {

        if (inv[i] && inv[i].id === id) {

            inv[i].count -= count;

            if (inv[i].count <= 0) {
                inv[i] = null;
            }

            return true;
        }
    }

    return false;
}

function hasItem(inv, id, count) {

    let total = 0;

    for (const item of inv) {

        if (item && item.id === id) {
            total += item.count;
        }
    }

    return total >= count;
}

function generateWorld() {

    // TREES
    for (let i = 0; i < 1500; i++) {

        resources.push({
            id: nextId++,
            type: 'tree',
            x: rand(0, WORLD_W),
            y: rand(0, WORLD_H),
            hp: 30,
            maxHp: 30
        });
    }

    // STONES
    for (let i = 0; i < 800; i++) {

        resources.push({
            id: nextId++,
            type: 'stone',
            x: rand(0, WORLD_W),
            y: rand(0, WORLD_H),
            hp: 50,
            maxHp: 50
        });
    }

    // WOLVES
    for (let i = 0; i < 80; i++) {

        mobs.push({
            id: nextId++,
            type: 'wolf',
            x: rand(0, WORLD_W),
            y: rand(0, WORLD_H),
            hp: 60,
            maxHp: 60,
            angle: 0,
            attackCd: 0
        });
    }
}

generateWorld();

io.on('connection', socket => {

    let playerId = null;

    console.log('PLAYER CONNECT');

    socket.on('login', data => {

        const spawn = getSpawn();

        playerId = String(nextId++);

        players[playerId] = {

            id: playerId,

            socketId: socket.id,

            name: data.nickname || 'Guest',

            x: spawn.x,
            y: spawn.y,

            hp: 100,
            maxHp: 100,

            hunger: 100,

            stamina: 100,
            maxStamina: 100,

            angle: 0,

            inventory: Array(20).fill(null),

            equip: 'hand',

            dx: 0,
            dy: 0,

            attackCd: 0,

            moveAnim: 0
        };

        addItem(players[playerId].inventory, 'wood', 15);

        socket.emit('init', {
            id: playerId,
            x: spawn.x,
            y: spawn.y
        });

        console.log('LOGIN:', players[playerId].name);
    });

    socket.on('move', data => {

        if (!playerId) return;

        const p = players[playerId];

        if (!p) return;

        p.dx = data.dx;
        p.dy = data.dy;

        p.angle = data.angle;

        let speed = 0.12;

        if (data.sprint && p.stamina > 5) {

            speed = 0.22;

            p.stamina -= 0.5;
        }

        const len = Math.hypot(data.dx, data.dy);

        if (len > 0) {

            p.x += (data.dx / len) * speed;
            p.y += (data.dy / len) * speed;

            p.moveAnim += 0.25;
        }

        p.x = Math.max(0, Math.min(WORLD_W, p.x));
        p.y = Math.max(0, Math.min(WORLD_H, p.y));
    });

    socket.on('attack', () => {

        if (!playerId) return;

        const p = players[playerId];

        if (!p) return;

        if (p.attackCd > 0) return;

        p.attackCd = 20;

        let damage = 10;

        if (p.equip === 'wood_sword') {
            damage = 25;
        }

        // RESOURCES
        for (let i = resources.length - 1; i >= 0; i--) {

            const r = resources[i];

            const d = dist(
                p.x,
                p.y,
                r.x,
                r.y
            );

            if (d < 2) {

                r.hp -= damage;

                if (r.hp <= 0) {

                    if (r.type === 'tree') {
                        addItem(p.inventory, 'wood', 5);
                    }

                    if (r.type === 'stone') {
                        addItem(p.inventory, 'stone', 4);
                    }

                    resources.splice(i, 1);
                }

                break;
            }
        }

        // PLAYERS
        for (const id in players) {

            if (id === playerId) continue;

            const enemy = players[id];

            const d = dist(
                p.x,
                p.y,
                enemy.x,
                enemy.y
            );

            if (d < 1.8) {

                enemy.hp -= damage;

                if (enemy.hp <= 0) {

                    enemy.hp = 100;
                    enemy.hunger = 100;

                    const spawn = getSpawn();

                    enemy.x = spawn.x;
                    enemy.y = spawn.y;
                }
            }
        }

        // MOBS
        for (const mob of mobs) {

            const d = dist(
                p.x,
                p.y,
                mob.x,
                mob.y
            );

            if (d < 1.8) {

                mob.hp -= damage;

                if (mob.hp <= 0) {

                    addItem(p.inventory, 'meat', 3);

                    mob.hp = mob.maxHp;

                    mob.x = rand(0, WORLD_W);
                    mob.y = rand(0, WORLD_H);
                }
            }
        }
    });

    socket.on('craftSword', () => {

        if (!playerId) return;

        const p = players[playerId];

        if (!p) return;

        if (hasItem(p.inventory, 'wood', 10)) {

            removeItem(p.inventory, 'wood', 10);

            p.equip = 'wood_sword';
        }
    });

    socket.on('disconnect', () => {

        if (playerId) {

            delete players[playerId];

            console.log('PLAYER LEFT');
        }
    });
});

setInterval(() => {

    // PLAYERS
    for (const id in players) {

        const p = players[id];

        p.hunger -= 0.01;

        if (p.hunger < 0) {
            p.hunger = 0;
        }

        if (p.hunger <= 0) {
            p.hp -= 0.05;
        }

        if (p.hp > p.maxHp) {
            p.hp = p.maxHp;
        }

        if (p.attackCd > 0) {
            p.attackCd--;
        }

        // STAMINA
        if (p.dx === 0 && p.dy === 0) {
            p.stamina += 0.25;
        }

        p.stamina = Math.max(
            0,
            Math.min(100, p.stamina)
        );
    }

    // WOLVES AI
    for (const mob of mobs) {

        if (mob.attackCd > 0) {
            mob.attackCd--;
        }

        let target = null;
        let best = 999;

        for (const id in players) {

            const p = players[id];

            const d = dist(
                mob.x,
                mob.y,
                p.x,
                p.y
            );

            if (d < best) {
                best = d;
                target = p;
            }
        }

        if (target && best < 8) {

            const angle = Math.atan2(
                target.y - mob.y,
                target.x - mob.x
            );

            mob.angle = angle;

            mob.x += Math.cos(angle) * 0.05;
            mob.y += Math.sin(angle) * 0.05;

            if (best < 1.5 && mob.attackCd <= 0) {

                target.hp -= 8;

                mob.attackCd = 25;
            }

        } else {

            mob.angle += rand(-0.2, 0.2);

            mob.x += Math.cos(mob.angle) * 0.02;
            mob.y += Math.sin(mob.angle) * 0.02;
        }
    }

    io.emit('gameState', {
        players,
        resources,
        mobs,
        buildings
    });

}, 1000 / 30);

server.listen(PORT, '0.0.0.0', () => {

    console.log('==============================');
    console.log('SLIZE SERVER STARTED');
    console.log('PORT:', PORT);
    console.log('WORLD:', WORLD_W, 'x', WORLD_H);
    console.log('==============================');
});
