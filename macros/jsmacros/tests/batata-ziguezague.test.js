const fs = require('fs'), vm = require('vm'), assert = require('assert');
const source = fs.readFileSync(require('path').join(__dirname, '../batata-ziguezague.js'), 'utf8');
function setup() {
    const vars = new Map(), keys = new Map(), crops = new Set(), logs = [], turns = [];
    const s = { x: 0.5, z: 0.5, yaw: 0, ticks: 0, menu: null, connected: true, loaded: true, move: true, onTick: null };
    for (let x = -2; x <= 0; x++) for (let z = 0; z <= 7; z++) crops.add(`${x},${z}`);
    function block(x, y, z) { return { getId: () => y === 64 && crops.has(`${x},${z}`) ? 'minecraft:potatoes' : 'minecraft:air' }; }
    function ray() {
        const r = s.yaw * Math.PI / 180, dx = Math.round(-Math.sin(r)), dz = Math.round(Math.cos(r));
        for (let i = 0; i <= 1; i++) {
            const x = Math.floor(s.x) + dx * i, z = Math.floor(s.z) + dz * i;
            if (crops.has(`${x},${z}`)) return { getId: () => 'minecraft:potatoes', pos: `${x},${z}` };
        }
        return null;
    }
    const p = { getX: () => s.x, getY: () => 63.9375, getZ: () => s.z, getYaw: () => s.yaw,
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
            if (++s.ticks > 1000) throw Error('loop exceeded test bound');
            if (keys.get('key.attack')) { const hit = ray(); if (hit) crops.delete(hit.pos); }
            if (keys.get('key.forward') && s.move) {
                const r = s.yaw * Math.PI / 180;
                s.x += Math.round(-Math.sin(r)) * 0.1;
                s.z += Math.round(Math.cos(r)) * 0.1;
            }
            if (s.onTick) s.onTick();
        } }
    });
    run = () => vm.runInContext(source, ctx);
    return { s, keys, crops, logs, turns, run };
}
function released(f) {
    for (const k of ['key.forward', 'key.sprint', 'key.attack']) assert.strictEqual(f.keys.get(k), false);
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
console.log(count + ' tests passed (mocked JsMacros APIs).');
