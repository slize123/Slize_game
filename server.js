const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

app.use(express.static(__dirname + '/'));

// Игроки
let players = {};
let nextId = 1;

// Рецепты крафта
const recipes = {
    wooden_sword: { wood: 10, stone: 0, iron: 0, emerald: 0, fuel: 0, damage: 12, name: 'Деревянный меч' },
    stone_axe: { wood: 0, stone: 8, iron: 0, emerald: 0, fuel: 0, damage: 15, name: 'Каменный топор' },
    iron_pickaxe: { wood: 0, stone: 0, iron: 5, emerald: 0, fuel: 0, damage: 20, name: 'Железная кирка' },
    chainsaw: { wood: 10, stone: 0, iron: 5, emerald: 0, fuel: 3, damage: 35, name: 'Бензопила' },
    crossbow: { wood: 15, stone: 0, iron: 8, emerald: 0, fuel: 0, damage: 28, name: 'Арбалет' },
    totem: { wood: 0, stone: 20, iron: 0, emerald: 5, fuel: 0, damage: 0, name: 'Тотем' },
    furnace: { wood: 0, stone: 15, iron: 5, emerald: 0, fuel: 0, damage: 0, name: 'Печка' },
    chest: { wood: 20, stone: 0, iron: 0, emerald: 0, fuel: 0, damage: 0, name: 'Сундук' }
};

function getFreePos() {
    return { x: (Math.random() - 0.5) * 40, z: (Math.random() - 0.5) * 40 };
}

io.on('connection', (socket) => {
    const spawn = getFreePos();
    const id = String(nextId++);
    
    players[id] = {
        id: id,
        x: spawn.x,
        z: spawn.z,
        health: 100,
        maxHealth: 100,
        inventory: {
            wood: 10,
            stone: 5,
            iron: 0,
            emerald: 1,
            fuel: 2
        },
        weapon: 'fist',
        weaponDamage: 5
    };
    
    console.log(`✅ Игрок ${id} подключился`);
    
    socket.emit('init', {
        id: id,
        x: players[id].x,
        z: players[id].z,
        inventory: players[id].inventory,
        health: players[id].health,
        online: Object.keys(players).length
    });
    
    io.emit('updatePlayers', players);
    
    // Движение
    socket.on('move', (move) => {
        if (!players[id]) return;
        let speed = 5.5;
        let newX = players[id].x + move.x * speed * 0.05;
        let newZ = players[id].z + move.z * speed * 0.05;
        newX = Math.min(38, Math.max(-38, newX));
        newZ = Math.min(38, Math.max(-38, newZ));
        players[id].x = newX;
        players[id].z = newZ;
        io.emit('updatePlayers', players);
    });
    
    // Атака
    socket.on('attack', (data) => {
        if (!players[id]) return;
        let attacker = players[id];
        let damage = data.damage;
        
        // Поиск ближайшего игрока для атаки
        let closest = null;
        let minDist = 2.5;
        for (let pid in players) {
            if (pid !== id) {
                const p = players[pid];
                const dist = Math.hypot(attacker.x - p.x, attacker.z - p.z);
                if (dist < minDist) {
                    minDist = dist;
                    closest = p;
                }
            }
        }
        
        if (closest) {
            closest.health -= damage;
            if (closest.health <= 0) {
                closest.health = closest.maxHealth;
                io.emit('death', { id: closest.id });
                // Телепорт после смерти
                const newSpawn = getFreePos();
                closest.x = newSpawn.x;
                closest.z = newSpawn.z;
            }
            io.emit('attackEffect', { target: closest.id, newHealth: closest.health, damage: damage });
            io.emit('updatePlayers', players);
        }
    });
    
    // Крафт
    socket.on('craft', (data) => {
        if (!players[id]) return;
        const recipe = recipes[data.recipe];
        if (!recipe) return;
        
        const inv = players[id].inventory;
        if (inv.wood >= (recipe.wood || 0) &&
            inv.stone >= (recipe.stone || 0) &&
            inv.iron >= (recipe.iron || 0) &&
            inv.emerald >= (recipe.emerald || 0) &&
            inv.fuel >= (recipe.fuel || 0)) {
            
            inv.wood -= recipe.wood || 0;
            inv.stone -= recipe.stone || 0;
            inv.iron -= recipe.iron || 0;
            inv.emerald -= recipe.emerald || 0;
            inv.fuel -= recipe.fuel || 0;
            
            if (recipe.damage > 0) {
                players[id].weapon = recipe.name;
                players[id].weaponDamage = recipe.damage;
            }
            
            io.emit('playerUpdate', { id: id, inventory: inv, health: players[id].health });
            io.emit('updatePlayers', players);
        }
    });
    
    socket.on('disconnect', () => {
        delete players[id];
        io.emit('updatePlayers', players);
        console.log(`❌ Игрок ${id} вышел`);
    });
});

server.listen(process.env.PORT || 3000, '0.0.0.0', () => {
    console.log('⚔️ Slize 3D сервер запущен на порту 3000');
});
