const fs = require('fs'), vm = require('vm'), assert = require('assert');
const source = fs.readFileSync(require('path').join(__dirname, '../minerar-vender.js'), 'utf8');
function fixture() {
    const vars = new Map(), commands = [], clicks = [], logs = [];
    const s = { tick: 0, menu: null, title: 'Vender', held: false, duplicate: false,
        connected: true, attack: false, closed: 0, limit: 2500, onTick: null, onSay: null, onClick: null };
    const txt = str => ({ getString: () => str });
    const inv = {
        getContainerTitle: () => s.title, getHeld: () => ({ isEmpty: () => !s.held }),
        getSlots: section => { assert.strictEqual(section, 'container'); return [0, 1, 2]; },
        getSlot: slot => ({ isEmpty: () => false, getName: () => txt(slot === 1 || (s.duplicate && slot === 2) ? '§aVender' : 'Outro') }),
        click: slot => { assert(!s.attack); clicks.push(slot); if (s.onClick) s.onClick(); },
        close: () => { assert(!s.attack); s.closed++; s.menu = null; }
    };
    let run;
    const ctx = vm.createContext({
        Date: { now: () => s.tick * 50 }, Math,
        GlobalVars: { getString: key => vars.get(key) || '', putString: (key, value) => vars.set(key, value) },
        Player: { getPlayer: () => s.connected ? {} : null, openInventory: () => inv },
        Hud: { getOpenScreen: () => s.menu },
        KeyBind: { keyBind: (key, value) => { assert.strictEqual(key, 'key.attack'); s.attack = value; } },
        Chat: { log: value => logs.push(value), say: cmd => {
            assert(!s.attack); commands.push([cmd, s.tick]);
            if (s.onSay) s.onSay(); else s.menu = {};
        } },
        Client: { waitTick: () => {
            s.tick++; assert(s.tick < 7000, 'loop timeout');
            if (s.onTick) s.onTick();
            if (s.tick >= s.limit) run();
        } }
    });
    run = () => vm.runInContext(source, ctx);
    return { s, commands, clicks, logs, run };
}
let count = 0;
function test(name, fn) { fn(); count++; console.log('OK: ' + name); }
test('mines until two minutes, clicks sale once, closes and resumes for another two minutes', () => {
    const f = fixture(); f.s.limit = 4900;
    f.s.onTick = () => { if (f.s.tick === 100 || f.s.tick === 2450) assert(f.s.attack); };
    f.run();
    assert.strictEqual(f.commands.length, 2);
    assert.deepStrictEqual(f.commands[0], ['/vender', 2400]);
    assert(f.commands[1][1] - f.commands[0][1] >= 2420);
    assert.deepStrictEqual(f.clicks, [1, 1]); assert.strictEqual(f.s.closed, 2); assert(!f.s.attack);
});
test('handles server closing the sale menu on click', () => {
    const f = fixture(); f.s.onClick = () => { f.s.menu = null; }; f.run();
    assert.strictEqual(f.clicks.length, 1); assert.strictEqual(f.s.closed, 0);
    assert(f.logs.some(t => t.includes('Retomando'))); assert(!f.s.attack);
});
test('does not click or close an unexpected menu', () => {
    const f = fixture(); f.s.title = 'Outro menu'; f.run();
    assert.strictEqual(f.clicks.length, 0); assert.strictEqual(f.s.closed, 0); assert(!f.s.attack);
    assert(f.logs.some(t => t.includes('Menu inesperado')));
});
test('does not click ambiguous buttons or a held cursor stack', () => {
    for (const key of ['duplicate', 'held']) {
        const f = fixture(); f.s[key] = true; f.run();
        assert.strictEqual(f.clicks.length, 0); assert(!f.s.attack);
    }
});
test('missing menu times out without sending repeated commands', () => {
    const f = fixture(); f.s.limit = 2700; f.s.onSay = () => {}; f.run();
    assert.strictEqual(f.commands.length, 1); assert.strictEqual(f.clicks.length, 0);
    assert(f.logs.some(t => t.includes('5 segundos'))); assert(!f.s.attack);
});
test('manual menus pause mining and disconnect stops the script', () => {
    const f = fixture();
    f.s.onTick = () => {
        if (f.s.tick === 10) f.s.menu = {};
        if (f.s.tick === 12) assert(!f.s.attack);
        if (f.s.tick === 15) f.s.menu = null;
        if (f.s.tick === 17) assert(f.s.attack);
        if (f.s.tick === 20) f.s.connected = false;
    };
    f.run(); assert(!f.s.attack); assert.strictEqual(f.commands.length, 0);
});
console.log(count + ' tests passed (mocked JsMacros APIs).');
