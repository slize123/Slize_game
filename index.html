<script src="https://cdn.socket.io/4.6.1/socket.io.min.js"></script>

<script>
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let socket = null;
let myId = null;

let state = {
    players: {},
    resources: [],
    buildings: [],
    mobs: []
};

const TILE = 48;

let keys = {};
let camX = 0;
let camY = 0;
let mouseAngle = 0;

function resize() {
    canvas.width = innerWidth;
    canvas.height = innerHeight;
}
resize();
addEventListener('resize', resize);

document.getElementById('playGuestBtn').onclick = () => {

    const nickname =
        document.getElementById('nicknameInput').value.trim()
        || 'Guest';

    document.getElementById('mainMenu').style.display = 'none';

    socket = io();

    // ВОТ ЭТОГО НЕ ХВАТАЛО
    socket.emit('login', {
        nickname
    });

    socket.on('init', data => {

        myId = data.id;

        camX = data.x * TILE;
        camY = data.y * TILE;
    });

    socket.on('gameState', gs => {
        state = gs;
    });
};

addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true;
});

addEventListener('keyup', e => {
    keys[e.key.toLowerCase()] = false;
});

addEventListener('mousemove', e => {

    if (!myId) return;

    const p = state.players[myId];
    if (!p) return;

    const px = p.x * TILE - camX + canvas.width / 2;
    const py = p.y * TILE - camY + canvas.height / 2;

    mouseAngle = Math.atan2(
        e.clientY - py,
        e.clientX - px
    );
});

setInterval(() => {

    if (!socket || !myId) return;

    let dx = 0;
    let dy = 0;

    if (keys['w']) dy = -1;
    if (keys['s']) dy = 1;
    if (keys['a']) dx = -1;
    if (keys['d']) dx = 1;

    socket.emit('move', {
        dx,
        dy,
        angle: mouseAngle
    });

}, 1000 / 30);

function drawGround() {

    const startX = Math.floor(camX / TILE) - 2;
    const startY = Math.floor(camY / TILE) - 2;

    const endX = startX + Math.ceil(canvas.width / TILE) + 4;
    const endY = startY + Math.ceil(canvas.height / TILE) + 4;

    for (let x = startX; x < endX; x++) {
        for (let y = startY; y < endY; y++) {

            const sx = x * TILE - camX + canvas.width / 2;
            const sy = y * TILE - camY + canvas.height / 2;

            const noise = ((x * y) % 2);

            ctx.fillStyle =
                noise
                    ? '#3f7d2c'
                    : '#4f9a38';

            ctx.fillRect(sx, sy, TILE, TILE);

            ctx.strokeStyle = 'rgba(0,0,0,0.05)';
            ctx.strokeRect(sx, sy, TILE, TILE);
        }
    }
}

function drawPlayer(p, isMe) {

    const x = p.x * TILE - camX + canvas.width / 2;
    const y = p.y * TILE - camY + canvas.height / 2;

    ctx.save();

    // ТЕНЬ
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(x, y + 18, 16, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // НОГИ
    ctx.fillStyle = '#5c3d22';
    ctx.fillRect(x - 8, y + 10, 6, 12);
    ctx.fillRect(x + 2, y + 10, 6, 12);

    // ТЕЛО
    const grad = ctx.createRadialGradient(
        x,
        y,
        4,
        x,
        y,
        20
    );

    grad.addColorStop(0, '#ffd7a8');
    grad.addColorStop(1, '#d88b45');

    ctx.fillStyle = grad;

    ctx.beginPath();
    ctx.arc(x, y, 16, 0, Math.PI * 2);
    ctx.fill();

    // ГЛАЗА
    ctx.fillStyle = '#000';

    ctx.beginPath();
    ctx.arc(x - 5, y - 2, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x + 5, y - 2, 2, 0, Math.PI * 2);
    ctx.fill();

    // РУКА
    ctx.translate(x, y);
    ctx.rotate(p.angle);

    ctx.fillStyle = '#ffd7a8';
    ctx.fillRect(10, -3, 12, 6);

    // МЕЧ
    if (p.equip === 'wood_sword') {

        ctx.fillStyle = '#a67c52';
        ctx.fillRect(20, -2, 18, 4);

        ctx.fillStyle = '#5b3a29';
        ctx.fillRect(18, -5, 4, 10);
    }

    ctx.restore();

    // ИМЯ
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px Arial';
    ctx.textAlign = 'center';

    ctx.fillText(p.name, x, y - 32);

    // HP BAR
    ctx.fillStyle = '#000';
    ctx.fillRect(x - 22, y - 24, 44, 6);

    ctx.fillStyle = '#ff3b3b';
    ctx.fillRect(x - 22, y - 24, 44 * (p.hp / p.maxHp), 6);

    // HUNGER
    ctx.fillStyle = '#000';
    ctx.fillRect(x - 22, y - 15, 44, 5);

    ctx.fillStyle = '#ffb347';
    ctx.fillRect(x - 22, y - 15, 44 * (p.hunger / 100), 5);

    // STAMINA
    ctx.fillStyle = '#000';
    ctx.fillRect(x - 22, y - 7, 44, 5);

    ctx.fillStyle = '#47b3ff';
    ctx.fillRect(x - 22, y - 7, 44 * (p.stamina / 100), 5);
}

function gameLoop() {

    requestAnimationFrame(gameLoop);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!myId) return;

    const me = state.players[myId];

    if (!me) return;

    camX += ((me.x * TILE) - camX) * 0.08;
    camY += ((me.y * TILE) - camY) * 0.08;

    drawGround();

    // РЕСЫ
    for (const r of state.resources) {

        const x = r.x * TILE - camX + canvas.width / 2;
        const y = r.y * TILE - camY + canvas.height / 2;

        if (r.type === 'tree') {

            ctx.fillStyle = '#5c3d22';
            ctx.fillRect(x - 4, y, 8, 20);

            ctx.fillStyle = '#2b8a3e';

            ctx.beginPath();
            ctx.arc(x, y - 8, 18, 0, Math.PI * 2);
            ctx.fill();
        }

        if (r.type === 'stone') {

            ctx.fillStyle = '#999';

            ctx.beginPath();
            ctx.arc(x, y, 14, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // ИГРОКИ
    for (const id in state.players) {
        drawPlayer(
            state.players[id],
            id === myId
        );
    }
}

gameLoop();
</script>
