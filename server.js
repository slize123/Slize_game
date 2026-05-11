// ... (весь твой код до players = {})

io.on('connection', (socket) => {
    let pId = null;

    socket.on('login', (data) => {
        const spawn = getFreeSpawn();
        pId = String(nextId++);
        
        players[pId] = {
            id: pId,
            socketId: socket.id,
            x: spawn.x,
            y: spawn.y,
            name: data.nickname || `Slayer${Math.floor(Math.random()*999)}`,
            hp: 100,
            maxHp: 100,
            hunger: 100,
            stamina: 100,        // ← НОВАЯ СТАМИНА
            inventory: Array(20).fill(null),
            equip: 'hand',
            angle: 0,
            isAttacking: false,
            attackTimer: 0,
            moveAnim: 0
        };

        players[pId].inventory = addItem(players[pId].inventory, 'wood', 8);
        socket.emit('init', { id: pId, worldW: WORLD_W, worldH: WORLD_H, recipes, x: spawn.x, y: spawn.y });
        io.emit('onlineCount', Object.keys(players).length);
    });

    // ... остальной код без изменений

    socket.on('move', (data) => {
        if (!pId || !players[pId]) return;
        const p = players[pId];
        p.dx = data.dx; p.dy = data.dy;
        p.angle = data.angle;

        const speed = 0.16;
        let newX = p.x + data.dx * speed;
        let newY = p.y + data.dy * speed;

        if (!isSolid(newX, p.y)) p.x = newX;
        if (!isSolid(p.x, newY)) p.y = newY;

        if (data.dx !== 0 || data.dy !== 0) {
            p.moveAnim += 0.35;
            p.stamina = Math.max(10, p.stamina - 0.12); // трата стамины при беге
        } else {
            p.stamina = Math.min(100, p.stamina + 0.25); // восстановление
        }
    });

    // В игровом цикле (setInterval 30fps)
    // Добавь в цикл игроков:
    for (let p of Object.values(players)) {
        p.hunger = Math.max(0, p.hunger - 0.008);
        p.stamina = Math.min(100, p.stamina + 0.18); // постоянное восстановление
        if (p.hunger <= 0) p.hp = Math.max(0, p.hp - 0.08);
        // ... остальное
    }
