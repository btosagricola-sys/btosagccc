const fs = require('fs'), vm = require('vm'), assert = require('assert');
const source = fs.readFileSync(require('path').join(__dirname, '../batata-ziguezague.js'), 'utf8');
function setup() {
    const vars = new Map(), keys = new Map(), crops = new Set(), logs = [], turns = [], solids = new Set();
    const s = { x: 0.5, z: 0.5, y: 63.9375, allowClimb: true, jumpLast: false, jumps: 0, yaw: 0, ticks: 0, menu: null, connected: true, loaded: true, move: true, onTick: null };
    for (let x = -2; x <= 0; x++) for (let z = 0; z <= 7; z++) crops.add(`${x},${z}`);
    function ground(x, z) { return x >= -3 && x <= 1 && z >= -1 && z <= 9; }
    function block(x, y, z) {
        const solid = (y === 64 || y === 65) && solids.has(`${x},${z}`);
        const id = solid ? 'minecraft:hay_block' : y === 63 && ground(x, z) ? 'minecraft:farmland'
            : y === 64 && crops.has(`${x},${z}`) ? 'minecraft:potatoes' : 'minecraft:air';
        return { getId: () => id, getBlockStateHelper: () => ({ isSolid: () => solid, isLiquid: () => false }) };
    }
    function ray() {
        const r = s.yaw * Math.PI / 180, dx = Math.round(-Math.sin(r)), dz = Math.round(Math.cos(r));
        for (let i = 0; i <= 1; i++) {
            const x = Math.floor(s.x) + dx * i, z = Math.floor(s.z) + dz * i;
            if (solids.has(`${x},${z}`)) return { getId: () => 'minecraft:hay_block' };
            if (crops.has(`${x},${z}`)) return { getId: () => 'minecraft:potatoes', pos: `${x},${z}` };
        }
        return null;
    }
    const p = { getX: () => s.x, getY: () => s.y, getZ: () => s.z, getYaw: () => s.yaw,
        lookAt: yaw => { if (s.yaw !== yaw) turns.push(yaw); s.yaw = yaw; } };
    let run;
    const ctx = vm.createContext({
        Chat: { log: text => logs.push(text) },
        GlobalVars: { getString: k => vars.get(k) ?? null, putString: (k, v) => vars.set(k, v) },
        Hud: { getOpenScreen: () => s.menu },
        Player: { getPlayer: () => s.connected ? p : null, rayTraceBlock: ray },
        World: { isChunkLoaded: () => s.loaded, getBlock: block },
        KeyBind: { keyBind: (k, v) => keys.set(k, v) },
        Client: { waitTick: () => {
            if (++s.ticks > 4000) throw Error('loop exceeded test bound');
            const jumping = keys.get('key.jump') === true;
            if (jumping && !s.jumpLast) s.jumps++;
            s.jumpLast = jumping;
            if (jumping && s.allowClimb && s.y < 63.9375) s.y = 63.9375;
            if (keys.get('key.attack')) { const hit = ray(); if (hit) { assert.strictEqual(hit.getId(), 'minecraft:potatoes'); crops.delete(hit.pos); } }
            if (keys.get('key.forward') && s.move) {
                const r = s.yaw * Math.PI / 180;
                const speed = keys.get('key.sneak') ? 0.07 : 0.1;
                const nx = s.x - Math.sin(r) * speed, nz = s.z + Math.cos(r) * speed;
                let collision = false;
                for (const dx of [-0.3, 0.3]) for (const dz of [-0.3, 0.3]) {
                    if (solids.has(`${Math.floor(nx + dx)},${Math.floor(nz + dz)}`)) collision = true;
                }
                if (!collision) { s.x = nx; s.z = nz; }
            }
            if (s.onTick) s.onTick();
        } }
    });
    run = () => vm.runInContext(source, ctx);
    return { s, keys, crops, logs, turns, solids, run };
}
function released(f) {
    for (const k of ['key.forward', 'key.sprint', 'key.attack', 'key.sneak', 'key.jump']) assert.strictEqual(f.keys.get(k), false);
}
let count = 0;
function test(name, fn) { fn(); count++; console.log('OK: ' + name); }
test('harvests three adjacent rows, reverses twice and stops at last row', () => {
    const f = setup(); f.run(); released(f);
    assert(f.turns.includes(180) && f.turns.includes(360));
    assert.strictEqual(f.crops.size, 0);
    assert(f.logs.some(t => t.includes('nao ha batatas')));
});
test('same key stops and releases movement', () => {
    const f = setup(); f.s.onTick = () => f.run(); f.run(); released(f);
    assert.strictEqual(f.s.ticks, 1);
});
test('menu stops the macro', () => {
    const f = setup(); f.s.onTick = () => { f.s.menu = {}; }; f.run(); released(f);
    assert.strictEqual(f.s.ticks, 1);
});
test('disconnect releases controls', () => {
    const f = setup(); f.s.onTick = () => { f.s.connected = false; }; f.run(); released(f);
});
test('blocked movement stops instead of looping forever', () => {
    const f = setup(); f.s.move = false; f.run(); released(f);
    assert(f.logs.some(t => t.includes('bloqueado')));
});
test('unloaded chunk aborts and releases controls', () => {
    const f = setup(); f.s.loaded = false;
    assert.throws(f.run, /Chunk nao carregado/); released(f);
});
test('does not attack non-potato blocks or walk away from an empty field', () => {
    const f = setup(); f.crops.clear(); f.run(); released(f);
    assert(f.s.ticks <= 4);
});
test('detours around a two-block hay obstacle and resumes harvesting', () => {
    const f = setup();
    for (const x of [0, -1]) for (const z of [3, 4]) {
        f.solids.add(`${x},${z}`); f.crops.delete(`${x},${z}`);
    }
    f.run(); released(f);
    assert(f.logs.some(t => t.includes('Contornando')));
    assert.strictEqual(f.solids.size, 4);
    assert.strictEqual(f.crops.size, 0);
});
test('wall at row end triggers lane change and return harvest', () => {
    const f = setup();
    for (let x = -3; x <= 1; x++) f.solids.add(`${x},8`);
    f.run(); released(f);
    assert(f.logs.some(t => t.includes('Parede/fim')));
    assert.strictEqual(f.crops.size, 0);
});
test('one-block drop jumps back up and resumes harvesting', () => {
    const f = setup();
    f.s.onTick = () => { if (f.s.ticks === 1) f.s.y -= 1; };
    f.run(); released(f);
    assert(f.s.jumps >= 1);
    assert(f.logs.some(t => t.includes('Voltou para cima')));
    assert.strictEqual(f.crops.size, 0);
});
test('unsuccessful climb stops after four jump attempts', () => {
    const f = setup(); f.s.allowClimb = false;
    f.s.onTick = () => { if (f.s.ticks === 1) f.s.y -= 1; };
    f.run(); released(f);
    assert.strictEqual(f.s.jumps, 4);
    assert(f.logs.some(t => t.includes('quatro tentativas')));
});
test('menu during climb releases jump and all other controls', () => {
    const f = setup();
    f.s.onTick = () => {
        if (f.s.ticks === 1) f.s.y -= 1;
        if (f.s.ticks === 2) f.s.menu = {};
    };
    f.run(); released(f);
    assert(f.s.jumps >= 1);
});
test('deep falls stop rather than repeatedly jumping', () => {
    const f = setup();
    f.s.onTick = () => { if (f.s.ticks === 1) f.s.y -= 2; };
    f.run(); released(f);
    assert.strictEqual(f.s.jumps, 0);
    assert(f.logs.some(t => t.includes('queda sem retorno')));
});
console.log(count + ' tests passed (mocked JsMacros APIs).');
