function generateWorld() {
    resources = [];
    // Ресурсов станет в 3 раза больше — около 8000
    for (let i = 0; i < 8000; i++) {
        const x = Math.floor(Math.random() * WORLD_W);
        const y = Math.floor(Math.random() * WORLD_H);
        const biome = getBiome(x, y);
        let type;
        // Разнообразие в зависимости от биома
        if (biome === 'desert') {
            type = Math.random() < 0.6 ? 'cactus' : (Math.random() < 0.5 ? 'stone' : 'bush');
        } else if (biome === 'snow') {
            type = Math.random() < 0.7 ? 'snow_tree' : 'stone';
        } else if (biome === 'forest') {
            type = Math.random() < 0.8 ? 'tree' : 'stone';
        } else { // равнины
            const r = Math.random();
            if (r < 0.5) type = 'tree';
            else if (r < 0.7) type = 'stone';
            else type = 'bush';
        }
        resources.push({ id: nextId++, x, y, type, hp: type === 'stone' ? 50 : 30, maxHp: type === 'stone' ? 50 : 30 });
    }
    
    // Мобов тоже увеличим — 300 штук
    mobs = [];
    for (let i = 0; i < 300; i++) {
        const isBear = Math.random() < 0.2; // 20% медведи
        mobs.push({
            id: nextId++,
            x: Math.floor(Math.random() * WORLD_W),
            y: Math.floor(Math.random() * WORLD_H),
            type: isBear ? 'bear' : 'wolf',
            hp: isBear ? 140 : 75,
            maxHp: isBear ? 140 : 75,
            targetId: null,
            angle: Math.random() * Math.PI * 2,
            attackCd: 0,
            wanderCd: 0
        });
    }
    
    // Добавим немного стартовых построек для интереса
    buildings = [];
    for (let i = 0; i < 50; i++) {
        buildings.push({
            id: nextId++,
            x: Math.floor(20 + Math.random() * (WORLD_W - 40)),
            y: Math.floor(20 + Math.random() * (WORLD_H - 40)),
            type: 'campfire',
            owner: null
        });
    }
}
