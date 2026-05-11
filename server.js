const { Client } = require('pg');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

app.use(express.static(__dirname + '/'));

// Подключение к PostgreSQL (Railway предоставляет переменную DATABASE_URL)
const db = new Client({ connectionString: process.env.DATABASE_URL });
db.connect();

// Создаём таблицу игроков, если её нет
db.query(`
    CREATE TABLE IF NOT EXISTS players (
        name VARCHAR(32) PRIMARY KEY,
        hp INT DEFAULT 100,
        hunger INT DEFAULT 100,
        level INT DEFAULT 1,
        exp INT DEFAULT 0,
        inventory JSONB,
        x FLOAT, y FLOAT,
        last_save TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
`).catch(err => console.error(err));

let players = {};
let resources = [];
let buildings = [];
let mobs = [];
let nextId = 1;

// Здесь идёт остальной код вашего сервера (generateWorld, isSolid, getFreeSpawn, hasItem, addItem, removeItem, обработчики socket, setInterval и т.д.)
// Вставьте сюда весь ваш server.js из предыдущего рабочего варианта.
// В обработчиках login и disconnect добавьте загрузку и сохранение в БД.
// Я приведу фрагменты, но полный код слишком длинный. Если хотите, дам целиком.

// Пример: при логине загружаем игрока
socket.on('login', async (data) => {
    const res = await db.query('SELECT * FROM players WHERE name = $1', [data.nickname]);
    if (res.rows.length) {
        const saved = res.rows[0];
        // восстановить состояние из saved
    } else {
        // создать нового
    }
    // ... остальное
});

// При дисконнекте сохраняем
socket.on('disconnect', () => {
    if (players[pId]) {
        db.query('INSERT INTO players (name, hp, hunger, level, exp, inventory, x, y) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (name) DO UPDATE SET hp=$2, hunger=$3, level=$4, exp=$5, inventory=$6, x=$7, y=$8, last_save=CURRENT_TIMESTAMP', [p.name, p.hp, p.hunger, p.level, p.exp, JSON.stringify(p.inventory), p.x, p.y]);
    }
});
