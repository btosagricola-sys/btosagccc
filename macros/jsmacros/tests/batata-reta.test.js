const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const source = fs.readFileSync(require('path').join(__dirname, '../batata-reta.js'), 'utf8');

function setup() {
    const vars = new Map(), pressed = new Map(), looks = [];
    const state = { ticks: 0, menu: null, player: true, failLook: false, onTick: null };
    const player = {
        getYaw: () => 87,
        lookAt: (yaw, pitch) => {
            if (state.failLook) throw Error('lookAt failed');
            looks.push([yaw, pitch]);
        }
    };
    const context = vm.createContext({
        GlobalVars: { getString: k => vars.get(k) ?? null, putString: (k, v) => vars.set(k, v) },
        Chat: { log: () => {} },
        Player: { getPlayer: () => state.player ? player : null },
        Hud: { getOpenScreen: () => state.menu },
        KeyBind: { keyBind: (key, value) => pressed.set(key, value) },
        Client: { waitTick: () => {
            state.ticks++;
            if (state.ticks > 10) throw Error('unexpected infinite loop');
            state.onTick();
        } }
    });
    return { state, vars, pressed, looks, run: () => vm.runInContext(source, context) };
}
function released(f) {
    for (const key of ['key.forward', 'key.sprint', 'key.attack']) assert.strictEqual(f.pressed.get(key), false);
    assert.strictEqual(f.vars.get('btos.batata.reta.run'), '');
}
let count = 0;
function test(name, fn) { fn(); count++; console.log('OK: ' + name); }

test('same key toggles off and all three keys are held then released', () => {
    const f = setup();
    f.state.onTick = () => {
        for (const key of ['key.forward', 'key.sprint', 'key.attack']) assert.strictEqual(f.pressed.get(key), true);
        f.run();
    };
    f.run(); released(f);
    assert.strictEqual(f.state.ticks, 1);
    assert.deepStrictEqual(f.looks[0], [90, 35]);
});
test('opening a menu stops without another movement tick', () => {
    const f = setup(); f.state.onTick = () => { f.state.menu = {}; };
    f.run(); released(f); assert.strictEqual(f.state.ticks, 1);
});
test('disconnect releases keys', () => {
    const f = setup(); f.state.onTick = () => { f.state.player = false; };
    f.run(); released(f);
});
test('exception still releases keys and clears running state', () => {
    const f = setup(); f.state.failLook = true;
    assert.throws(f.run, /lookAt failed/); released(f);
});
test('cannot start while a menu is open', () => {
    const f = setup(); f.state.menu = {}; f.run();
    assert.strictEqual(f.pressed.size, 0); assert.strictEqual(f.state.ticks, 0);
});
test('cannot start without a player', () => {
    const f = setup(); f.state.player = false; f.run();
    assert.strictEqual(f.pressed.size, 0); assert.strictEqual(f.state.ticks, 0);
});
console.log(count + ' tests passed (mocked JsMacros APIs).');
