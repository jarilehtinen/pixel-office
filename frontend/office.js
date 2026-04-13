// Pixel Office — frontend
// Polls /api/events/recent and draws placeholder characters on canvas.

const API_BASE = (window.PIXEL_OFFICE_API || '/api');
const POLL_INTERVAL = 2000;
let CANVAS_W = 960;
let CANVAS_H = 540;

// Activity colors
const ACTIVITY_COLORS = {
    planning: '#f0ad4e', // yellow
    coding:   '#337ab7', // blue
    review:   '#9b59b6', // purple
    bugfix:   '#d9534f', // red
    testing:  '#5bc0de', // light blue
    done:     '#5cb85c', // green
    waiting:  '#e8a317', // orange
    idle:     '#777777', // grey
};

const canvas = document.getElementById('office');
const ctx = canvas.getContext('2d');

// HiDPI/Retina support + window size
const dpr = window.devicePixelRatio || 1;
let S = 1; // Scale factor

function resizeCanvas() {
    CANVAS_W = window.innerWidth;
    CANVAS_H = window.innerHeight;
    canvas.width = CANVAS_W * dpr;
    canvas.height = CANVAS_H * dpr;
    canvas.style.width = CANVAS_W + 'px';
    canvas.style.height = CANVAS_H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Scale factor relative to original 960x540
    S = Math.min(CANVAS_W / 960, CANVAS_H / 540);

    // Update desk positions to match window size
    const colW = CANVAS_W / 3;
    const topMargin = 200 * S + CANVAS_H * 0.05;
    const bottomMargin = 30 * S;
    const usableH = CANVAS_H - topMargin - bottomMargin;
    const rowH = usableH / 2;
    for (let i = 0; i < DESKS.length; i++) {
        const col = i % 3;
        const row = Math.floor(i / 3);
        DESKS[i].x = colW * col + (colW - 100 * S) / 2;
        DESKS[i].y = topMargin + row * rowH + (row > 0 ? 30 : 0);
    }
}

let animFrame = 0;

// Painting images
const paintingImgs = [1, 3, 5].map(n => {
    const img = new Image();
    img.src = 'paintings/painting' + n + '.png?v=' + Date.now();
    return img;
});

// Clouds drifting past windows (one per window, different offsets)
const clouds = [
    { x: 0, y: 0.3, w: 28, h: 11, speed: 0.12 },
    { x: 0.5, y: 0.25, w: 26, h: 10, speed: 0.1 },
];
let cloudOffset = 0;
let lastPoll = new Date(Date.now() - 60000).toISOString();

// Per-actor state: { actor: { activity, task, project } }
// Key = actor name, value = latest state
const actors = {};
// Actor order for desk assignments (max 6)
const actorOrder = [];

// Default character settings (can be overridden with window.PIXEL_OFFICE_CHARACTERS array)
const DEFAULT_CHARACTERS = [
    { name: 'Markku', hair: '#4a3020', shirt: '#337ab7', gender: 'male' },
    { name: 'Liisa',  hair: '#8a5a30', shirt: '#9b59b6', gender: 'female' },
    { name: 'Ilkka',  hair: '#2a2a2a', shirt: '#5cb85c', gender: 'male' },
    { name: 'Matti',  hair: '#c4a050', shirt: '#e67e22', gender: 'male' },
    { name: 'Päivi',  hair: '#6a2020', shirt: '#e74c8c', gender: 'female' },
    { name: 'Anneli', hair: '#3a3a3a', shirt: '#3498db', gender: 'female' },
];
const characters = window.PIXEL_OFFICE_CHARACTERS || DEFAULT_CHARACTERS;

// Desk positions (6 desks, 3x2 grid)
const DESKS = characters.slice(0, 6).map((c, i) => ({
    x: 0, y: 0, // updated in resizeCanvas()
    name: c.name,
    hair: c.hair || '#4a3020',
    shirt: c.shirt || '#337ab7',
    gender: c.gender || 'male',
}));

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Drawing helper functions — pixel art style
function drawWalls() {
    // Back wall
    ctx.fillStyle = '#4a6a8a';
    ctx.fillRect(0, 0, CANVAS_W, 120*S);

    // Wall baseboard
    ctx.fillStyle = '#3a5a7a';
    ctx.fillRect(0, 115*S, CANVAS_W, 5*S);

    // Window on the left
    drawWindow(CANVAS_W * 0.08, 20*S, 120*S, 70*S);
    // Window on the right
    drawWindow(CANVAS_W * 0.82, 20*S, 120*S, 70*S);

    // Paintings
    drawPainting(CANVAS_W * 0.28, 30*S, 80*S, 55*S, paintingImgs[0]);
    drawPainting(CANVAS_W / 2 - 45*S, 22*S, 90*S, 65*S, paintingImgs[1]);
    drawPainting(CANVAS_W * 0.72 - 80*S, 32*S, 75*S, 50*S, paintingImgs[2]);
}

function drawCloud(cx, cy, cw, ch) {
    // Pixel-style cloud: a cluster of rectangles
    const s = S;
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillRect(cx, cy, cw * s, ch * s);
    ctx.fillRect(cx + 3 * s, cy - 4 * s, (cw - 6) * s, 4 * s);
    ctx.fillRect(cx - 4 * s, cy + 2 * s, 4 * s, (ch - 4) * s);
    ctx.fillRect(cx + cw * s, cy + 2 * s, 4 * s, (ch - 4) * s);
}

function drawCloudsInWindow(x, y, w, h, cloudIndex) {
    const c = clouds[cloudIndex];
    // Clip to entire glass area
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + 4, y + 4, w - 8, h - 8);
    ctx.clip();
    // Cloud wraps across the window width
    const glassW = w - 8;
    const period = glassW + c.w * S;
    const rawX = (c.x * period + cloudOffset * c.speed * S) % period;
    const cx = x + 4 + rawX - c.w * S * 0.5;
    const cy = y + 4 + c.y * (h - 8);
    drawCloud(cx, cy, c.w, c.h);
    ctx.restore();
}

function drawWindow(x, y, w, h) {
    // Frame
    ctx.fillStyle = '#6a4a2a';
    ctx.fillRect(x, y, w, h);
    // Glass (sky)
    ctx.fillStyle = '#a0d8ef';
    ctx.fillRect(x + 4, y + 4, w - 8, h - 8);

    // Draw one cloud per window, clipped to glass area
    drawCloudsInWindow(x, y, w, h, drawWindow._cloudIndex || 0);
    drawWindow._cloudIndex = (drawWindow._cloudIndex || 0) + 1;

    // Cross divider
    ctx.fillStyle = '#6a4a2a';
    ctx.fillRect(x + w / 2 - 2, y + 4, 4, h - 8);
    ctx.fillRect(x + 4, y + h / 2 - 2, w - 8, 4);
}

function drawFloor() {
    ctx.fillStyle = '#4a6a5a';
    ctx.fillRect(0, 120*S, CANVAS_W, CANVAS_H - 120*S);
}

function drawPainting(x, y, w, h, img) {
    // Frame
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(x, y, w, h);
    // Image (contain-fit)
    if (img && img.complete && img.naturalWidth > 0) {
        ctx.imageSmoothingEnabled = false;
        const innerW = w - 6*S, innerH = h - 6*S;
        const imgRatio = img.naturalWidth / img.naturalHeight;
        const frameRatio = innerW / innerH;
        let dw, dh;
        if (imgRatio > frameRatio) {
            dw = innerW;
            dh = innerW / imgRatio;
        } else {
            dh = innerH;
            dw = innerH * imgRatio;
        }
        ctx.drawImage(img, x + 3*S + (innerW - dw) / 2, y + 3*S + (innerH - dh) / 2, dw, dh);
    }
}

function drawDesk(x, y) {
    // Standing desk — same height as before, metal legs
    ctx.fillStyle = '#b08050';
    ctx.fillRect(x, y, 100*S, 8*S);
    ctx.fillStyle = '#8a6030';
    ctx.fillRect(x, y + 8*S, 100*S, 5*S);
    ctx.fillStyle = '#6a4a2a';
    ctx.fillRect(x + 4*S, y + 13*S, 6*S, 30*S);
    ctx.fillRect(x + 90*S, y + 13*S, 6*S, 30*S);
}

function drawComputer(x, y, screenColor, active, activity) {
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(x, y - 42*S, 52*S, 40*S);

    if (activity === 'waiting') {
        const flash = Math.floor(animFrame / 3) % 2 === 0;
        ctx.fillStyle = flash ? '#d9534f' : '#1a0a0a';
        ctx.fillRect(x + 3*S, y - 39*S, 46*S, 34*S);
        return drawComputerBase(x, y);
    }

    ctx.fillStyle = active ? '#0a1a0a' : '#0a0a0a';
    ctx.fillRect(x + 3*S, y - 39*S, 46*S, 34*S);

    if (active) {
        const lineColor = screenColor;
        const numLines = 8;
        const screenX = x + 6*S;
        const maxW = 38*S;
        for (let i = 0; i < numLines; i++) {
            const lineY = y - 36*S + i * 4*S;
            const seed = Math.abs(Math.sin(i * 3.7 + animFrame * 0.8 + i * i)) * maxW;
            const lineW = 8*S + (seed % (maxW - 8*S));
            if (i === numLines - 1) {
                const cursorVisible = Math.floor(animFrame / 3) % 2 === 0;
                ctx.fillStyle = lineColor;
                ctx.fillRect(screenX, lineY, lineW, 2*S);
                if (cursorVisible) {
                    ctx.fillStyle = '#fff';
                    ctx.fillRect(screenX + lineW + 2*S, lineY, 2*S, 2*S);
                }
            } else {
                ctx.fillStyle = lineColor;
                ctx.globalAlpha = 0.4 + (i / numLines) * 0.6;
                ctx.fillRect(screenX, lineY, lineW, 2*S);
                ctx.globalAlpha = 1;
            }
        }
    }

    drawComputerBase(x, y);
}

function drawComputerBase(x, y) {
    // Monitor stand
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(x + 22*S, y - 2*S, 8*S, 4*S);
    ctx.fillRect(x + 18*S, y + 2*S, 16*S, 2*S);
    // Keyboard
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(x - 1*S, y + 2*S, 30*S, 5*S);
    ctx.fillStyle = '#4a4a4a';
    for (let i = 0; i < 5; i++) {
        ctx.fillRect(x + 1*S + i * 6*S, y + 3*S, 4*S, 3*S);
    }
}

function drawCharacter(x, y, shirtColor, working, hairColor, gender) {
    // Head
    ctx.fillStyle = '#ffcc99';
    ctx.fillRect(x + 4*S, y - 20*S, 16*S, 16*S);
    // Hair (top)
    ctx.fillStyle = hairColor || '#4a3020';
    if (gender === 'female') {
        ctx.fillRect(x + 4*S, y - 22*S, 16*S, 7*S);
    } else {
        ctx.fillRect(x + 4*S, y - 20*S, 16*S, 5*S);
        ctx.fillRect(x + 2*S, y - 20*S, 7*S, 9*S);
    }
    // Shirt
    ctx.fillStyle = shirtColor;
    ctx.fillRect(x + 1*S, y - 5*S, 22*S, 25*S);
    // Hands
    ctx.fillStyle = '#ffcc99';
    if (working) {
        const tick = Math.floor(animFrame / 2) % 4;
        const leftOff  = (tick === 0 || tick === 1 ? -1 : 1) * S;
        const rightOff = (tick === 2 || tick === 3 ? -1 : 1) * S;
        ctx.fillRect(x - 4*S, y - 2*S + leftOff, 5*S, 6*S);
        ctx.fillRect(x + 23*S, y - 2*S + rightOff, 5*S, 6*S);
    } else {
        // Arms hanging down at sides
        ctx.fillRect(x - 4*S, y - 2*S, 5*S, 22*S);
        ctx.fillRect(x + 23*S, y - 2*S, 5*S, 22*S);
    }
    // Pants (wider at waist, narrowing down)
    ctx.fillStyle = '#2a3a5a';
    ctx.fillRect(x + 2*S, y + 20*S, 19*S, 7*S);
    ctx.fillRect(x + 2*S, y + 26*S, 8*S, 14*S);
    ctx.fillRect(x + 13*S, y + 26*S, 8*S, 14*S);
    // Shoes
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(x + 2*S, y + 40*S, 8*S, 4*S);
    ctx.fillRect(x + 13*S, y + 40*S, 8*S, 4*S);
    // Long hair — drawn last on top of everything
    if (gender === 'female') {
        ctx.fillStyle = hairColor || '#4a3020';
        ctx.fillRect(x + 1*S, y - 18*S, 9*S, 24*S);
    }
}

function drawSpeechBubble(deskX, deskY, text, activity) {
    const isWaiting = activity === 'waiting';
    const isDone = activity === 'done';
    const displayText = isWaiting ? '???' : text;

    ctx.font = `${11*S}px monospace`;
    const maxLineW = 22; // characters per line
    let line1 = displayText;
    let line2 = '';

    if (displayText.length > maxLineW) {
        // Break at word boundary or force
        const breakAt = displayText.lastIndexOf(' ', maxLineW);
        const splitPos = breakAt > 8 ? breakAt : maxLineW;
        line1 = displayText.slice(0, splitPos);
        line2 = displayText.slice(splitPos).trimStart();
        if (line2.length > maxLineW) {
            line2 = line2.slice(0, maxLineW - 2) + '..';
        }
    }

    const w1 = ctx.measureText(line1).width;
    const w2 = line2 ? ctx.measureText(line2).width : 0;
    const bubbleW = Math.max(w1, w2) + 14*S;
    const bubbleH = line2 ? 32*S : 20*S;
    const bubbleX = deskX + 50*S - bubbleW / 2;
    const bubbleY = deskY - 76*S - (line2 ? 12*S : 0);

    // Flashing bubble in waiting state
    if (isWaiting) {
        const visible = Math.floor(animFrame / 3) % 2 === 0;
        if (!visible) return;
        ctx.fillStyle = '#d9534f';
    } else if (isDone) {
        ctx.fillStyle = ACTIVITY_COLORS.done;
    } else {
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
    }
    ctx.fillRect(bubbleX, bubbleY, bubbleW, bubbleH);

    // Arrow down (triangle)
    ctx.beginPath();
    ctx.moveTo(deskX + 33*S, bubbleY + bubbleH - 1*S);
    ctx.lineTo(deskX + 43*S, bubbleY + bubbleH - 1*S);
    ctx.lineTo(deskX + 38*S, bubbleY + bubbleH + 5*S);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = (isDone || isWaiting) ? '#fff' : '#222';
    ctx.textAlign = 'left';
    ctx.fillText(line1, bubbleX + 7*S, bubbleY + 14*S);
    if (line2) {
        ctx.fillText(line2, bubbleX + 7*S, bubbleY + 26*S);
    }
}

function drawPlant(x, y, scale) {
    const p = scale || 1;
    // Pot
    ctx.fillStyle = '#b06030';
    ctx.fillRect(x, y, 16*p, 14*p);
    ctx.fillStyle = '#904820';
    ctx.fillRect(x - 2*p, y, 20*p, 4*p);
    // Leaves
    ctx.fillStyle = '#3a8a3a';
    ctx.fillRect(x + 2*p, y - 10*p, 12*p, 10*p);
    ctx.fillStyle = '#2a7a2a';
    ctx.fillRect(x - 2*p, y - 14*p, 8*p, 8*p);
    ctx.fillRect(x + 10*p, y - 16*p, 8*p, 8*p);
    ctx.fillStyle = '#4a9a4a';
    ctx.fillRect(x + 4*p, y - 18*p, 8*p, 6*p);
}

function drawLargePlant(x, y) {
    // Large pot — cone-shaped
    ctx.fillStyle = '#904820';
    ctx.fillRect(x - 4, y, 40, 6);        // top edge wider
    ctx.fillStyle = '#b06030';
    ctx.fillRect(x, y + 6, 32, 28);       // body
    ctx.fillStyle = '#a05828';
    ctx.fillRect(x + 2, y + 10, 28, 2);   // decorative band
    ctx.fillStyle = '#904820';
    ctx.fillRect(x + 4, y + 34, 24, 4);   // narrower bottom
    // Soil
    ctx.fillStyle = '#3a2a1a';
    ctx.fillRect(x + 2, y - 2, 28, 4);
    // Stem in the center
    ctx.fillStyle = '#2a6a1a';
    ctx.fillRect(x + 14, y - 30, 4, 30);
    // Leaves — large and layered
    ctx.fillStyle = '#3a8a3a';
    ctx.fillRect(x + 2, y - 24, 28, 12);
    ctx.fillRect(x - 2, y - 32, 12, 10);
    ctx.fillRect(x + 22, y - 34, 12, 10);
    // Darker leaves in the back
    ctx.fillStyle = '#2a7a2a';
    ctx.fillRect(x + 6, y - 38, 8, 8);
    ctx.fillRect(x + 18, y - 40, 8, 8);
    ctx.fillRect(x - 4, y - 20, 8, 6);
    ctx.fillRect(x + 28, y - 22, 8, 6);
    // Lighter leaves in the front
    ctx.fillStyle = '#4aaa4a';
    ctx.fillRect(x + 10, y - 44, 6, 6);
    ctx.fillRect(x + 8, y - 28, 6, 4);
    ctx.fillRect(x + 20, y - 26, 6, 4);
    // Leaf veins / details
    ctx.fillStyle = '#5aba5a';
    ctx.fillRect(x + 4, y - 22, 2, 4);
    ctx.fillRect(x + 26, y - 30, 2, 4);
    ctx.fillRect(x + 12, y - 42, 2, 4);
}

function drawCoffeCup(x, y) {
    // Cup — solid white
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(x, y, 10*S, 8*S);
    // Handle
    ctx.fillStyle = '#e0e0e0';
    ctx.fillRect(x + 10*S, y + 2*S, 4*S, 4*S);
    ctx.fillStyle = '#4a6a5a'; // floor color inside the handle
    ctx.fillRect(x + 11*S, y + 3*S, 2*S, 2*S);
    // Steam — curling wisp
    const phase = animFrame % 12;
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    // Two rising pixels that sway left-right
    const sway1 = (phase < 4) ? 0 : (phase < 8) ? 2 : -2;
    const sway2 = (phase < 3) ? 2 : (phase < 6) ? 0 : (phase < 9) ? -2 : 0;
    ctx.fillRect(x + (4 + sway1)*S, y - 4*S, 2*S, 2*S);
    ctx.fillRect(x + (4 + sway2)*S, y - 7*S, 2*S, 2*S);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(x + (4 - sway1)*S, y - 10*S, 2*S, 2*S);
}

function drawCoffeeMachine(x, y) {
    // Body
    ctx.fillStyle = '#555';
    ctx.fillRect(x, y, 24, 30);
    ctx.fillStyle = '#444';
    ctx.fillRect(x + 2, y + 4, 20, 12);
    // Coffee pot
    ctx.fillStyle = '#333';
    ctx.fillRect(x + 6, y + 18, 12, 10);
    // Red indicator light
    ctx.fillStyle = '#f44';
    ctx.fillRect(x + 18, y + 2, 4, 3);
}

function drawWaterCooler(x, y) {
    // Water bottle
    ctx.fillStyle = '#88bbee';
    ctx.fillRect(x + 8, y - 32, 24, 32);
    ctx.fillStyle = '#6699cc';
    ctx.fillRect(x + 12, y - 36, 16, 8);
    // Body
    ctx.fillStyle = '#ddd';
    ctx.fillRect(x, y, 40, 56);
    ctx.fillStyle = '#bbb';
    ctx.fillRect(x + 4, y + 40, 32, 12);
}

function drawScene() {
    // Floor
    drawFloor();
    // Walls and windows
    drawWindow._cloudIndex = 0;
    drawWalls();

    // Decorations
    drawLargePlant(CANVAS_W - 90, CANVAS_H - 110);
    drawWaterCooler(30, CANVAS_H - 140);

    const now = Date.now();

    // Remove actors that haven't sent an event in 5 minutes
    const EXPIRE_MS = 300000;
    for (let i = actorOrder.length - 1; i >= 0; i--) {
        const state = actors[actorOrder[i]];
        if (state) {
            const elapsed = now - new Date(state.updatedAt).getTime();
            if (elapsed > EXPIRE_MS) {
                delete actors[actorOrder[i]];
                actorOrder.splice(i, 1);
            }
        }
    }

    // Draw desks
    DESKS.forEach((desk, i) => {
        const actorName = actorOrder[i];
        const state = actorName ? actors[actorName] : null;
        const activity = state ? state.activity : 'idle';
        const task = state ? state.task : '';
        const color = ACTIVITY_COLORS[activity] || ACTIVITY_COLORS.idle;
        const isWorking = activity !== 'idle' && activity !== 'done';
        const isPrimary = i === 0;
        const elapsed = state ? now - new Date(state.updatedAt).getTime() : 0;
        const isOnBreak = !isWorking && elapsed > 60000; // 1 min idle → coffee break
        const isGone = !actorName || (!isWorking && elapsed > 300000); // 5 min idle → gone

        drawDesk(desk.x, desk.y);
        drawComputer(desk.x + 40*S, desk.y, color, isWorking, activity);

        if (isGone) {
            // Character gone — empty desk
        } else if (actorName) {
            drawCharacter(desk.x + 28*S, desk.y + 2*S, desk.shirt, isWorking, desk.hair, desk.gender);
            if (isOnBreak) {
                drawCoffeCup(desk.x + 70*S, desk.y - 4*S);
            }
            // Speech bubble with task name
            if (activity === 'waiting' || (task && activity !== 'idle')) {
                const ucTask = task.charAt(0).toUpperCase() + task.slice(1);
                const bubbleText = ucTask.length > 44 ? ucTask.slice(0, 42) + '..' : ucTask;
                drawSpeechBubble(desk.x, desk.y, bubbleText, activity);
            }
            // Character name and project below the desk
            ctx.textAlign = 'center';
            ctx.fillStyle = '#ccc';
            ctx.font = `${11*S}px monospace`;
            ctx.fillText(desk.name, desk.x + 50*S, desk.y + 62*S);
            if (state && state.project) {
                ctx.fillStyle = '#999';
                ctx.font = `${10*S}px monospace`;
                ctx.fillText(state.project, desk.x + 50*S, desk.y + 75*S);
            }
        }
    });

    // Status bar at the bottom
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, CANVAS_H - 30*S, CANVAS_W, 30*S);

    // Show all actors' state in the status bar (right-aligned)
    ctx.font = `${10*S}px monospace`;
    ctx.textAlign = 'right';
    let statusX = CANVAS_W - 12*S;
    for (let i = actorOrder.length - 1; i >= 0; i--) {
        const name = actorOrder[i];
        const state = actors[name];
        if (!state) continue;
        const color = ACTIVITY_COLORS[state.activity] || ACTIVITY_COLORS.idle;
        ctx.fillStyle = color;
        ctx.fillText(`● ${name}`, statusX, CANVAS_H - 12*S);
        statusX -= ctx.measureText(`● ${name}`).width + 16*S;
    }

    // Title
    ctx.fillStyle = '#e0e0e0';
    ctx.font = `bold ${10*S}px monospace`;
    ctx.textAlign = 'left';
    ctx.fillText('PIXEL OFFICE', 12*S, CANVAS_H - 12*S);
}

function updateActor(event) {
    const name = event.actor;
    actors[name] = {
        activity: event.activity,
        task: event.task || '',
        project: event.project,
        updatedAt: event.created_at || new Date().toISOString(),
    };
    // Assign actor to a desk — match to named desk if possible
    if (!actorOrder.includes(name)) {
        const deskIdx = DESKS.findIndex((d, i) => d.name === name && !actorOrder[i]);
        if (deskIdx >= 0) {
            // Fill gaps with undefined so the index lands on the right spot
            while (actorOrder.length < deskIdx) actorOrder.push(undefined);
            actorOrder[deskIdx] = name;
        } else if (actorOrder.length < DESKS.length) {
            // Unknown name — next available spot
            let placed = false;
            for (let i = 0; i < DESKS.length; i++) {
                if (!actorOrder[i]) {
                    actorOrder[i] = name;
                    placed = true;
                    break;
                }
            }
            if (!placed) actorOrder.push(name);
        }
    }
}

async function poll() {
    try {
        const url = `${API_BASE}/events/recent?since=${encodeURIComponent(lastPoll)}`;
        const res = await fetch(url);

        if (!res.ok) {
            console.warn('[pixel-office] poll error:', res.status);
            return;
        }

        const events = await res.json();

        if (events.length > 0) {
            events.forEach(updateActor);
            lastPoll = events[events.length - 1].created_at;
        }

    } catch (err) {
        console.warn('[pixel-office] poll error:', err.message);
    }
}

// Fetch all actors' current state on startup
async function loadStatus() {
    try {
        const res = await fetch(`${API_BASE}/events/status`);
        if (res.ok) {
            const statuses = await res.json();
            statuses.forEach(updateActor);
        }
    } catch (err) {
        console.warn('[pixel-office] status load error:', err.message);
    }
}

// Animation loop — redraws at ~4 fps (sufficient for pixel style)
let lastFrameTime = 0;
let lastPollTime = 0;
const FRAME_INTERVAL = 250; // ms per frame

function gameLoop(timestamp) {
    // Draw at ~4 fps
    if (timestamp - lastFrameTime >= FRAME_INTERVAL) {
        animFrame++;
        cloudOffset += 1;
        drawScene();
        lastFrameTime = timestamp;
    }
    // Poll every 2s
    if (timestamp - lastPollTime >= POLL_INTERVAL) {
        poll();
        lastPollTime = timestamp;
    }
    requestAnimationFrame(gameLoop);
}

// Fullscreen
document.getElementById('fullscreen-btn').addEventListener('click', () => {
    if (document.fullscreenElement) {
        document.exitFullscreen();
    } else {
        document.documentElement.requestFullscreen();
    }
});

// Fullscreen also with F key
document.addEventListener('keydown', (e) => {
    if (e.key === 'f' || e.key === 'F') {
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            document.documentElement.requestFullscreen();
        }
    }
});

drawScene();
loadStatus().then(() => {
    drawScene();
    requestAnimationFrame(gameLoop);
});
