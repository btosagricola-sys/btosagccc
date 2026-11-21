const fs = require('fs'), vm = require('vm'), assert = require('assert');
const source = fs.readFileSync(require('path').join(__dirname, '../cacto-vender-afk.js'), 'utf8');
function fixture() {
    const vars = new Map(), commands = [], clicks = [];
    const s = { tick: 0, limit: 4900, menu: null, title: 'Vender', closed: 0, connected: true, onTick: null, openOnSay: true };
    const inv = { getContainerTitle: () => s.title,
        click: (slot, button) => { assert.strictEqual(button, 0); clicks.push(slot); },
        close: () => { s.closed++; s.menu = null; } };
    let run;
    const ctx = vm.createContext({ Date: { now: () => s.tick * 50 }, Math,
        GlobalVars: { getString: key => vars.get(key) || '', putString: (key, val) => vars.set(key, val) },
        Player: { getPlayer: () => s.connected ? {} : null, openInventory: () => inv },
        Hud: { getOpenScreen: () => s.menu },
        KeyBind: { keyBind: () => { throw Error('AFK seller must not press movement or attack keys'); } },
        Chat: { log() {}, say: cmd => { commands.push([cmd, s.tick]); if (s.openOnSay) s.menu = {}; } },
        Client: { waitTick: () => {
            s.tick++; assert(s.tick < 6000);
            if (s.onTick) s.onTick();
            if (s.tick >= s.limit) run();
        } }
    });
    run = () => vm.runInContext(source, ctx);
    return { s, commands, clicks, run };
}
let count = 0;
function test(name, fn) { fn(); count++; console.log('OK: ' + name); }
test('sells twice at two-minute intervals without movement or attack and closes each menu', () => {
    const f = fixture(); f.run();
    assert.deepStrictEqual(f.commands[0], ['/vender', 2400]);
    assert.strictEqual(f.commands.length, 2); assert.deepStrictEqual(f.clicks, [10, 10]);
    assert.strictEqual(f.s.closed, 2); assert(f.commands[1][1] - f.commands[0][1] >= 2420);
});
test('manual menus postpone selling until closed', () => {
    const f = fixture(); f.s.limit = 2600; f.s.menu = {};
    f.s.onTick = () => { if (f.s.tick === 2500) f.s.menu = null; };
    f.run(); assert.deepStrictEqual(f.commands, [['/vender', 2500]]); assert.deepStrictEqual(f.clicks, [10]);
});
test('unexpected menu never receives a click', () => {
    const f = fixture(); f.s.title = 'Outro'; f.run(); assert.strictEqual(f.clicks.length, 0);
});
test('missing menu retries after thirty seconds without clicking', () => {
    const f = fixture(); f.s.openOnSay = false; f.s.limit = 3200; f.run();
    assert.strictEqual(f.commands.length, 2); assert(f.commands[1][1] - f.commands[0][1] >= 700);
    assert.strictEqual(f.clicks.length, 0);
});
test('disconnect stops before sending a command', () => {
    const f = fixture(); f.s.onTick = () => { if (f.s.tick === 10) f.s.connected = false; };
    f.run(); assert.strictEqual(f.commands.length, 0);
});
console.log(count + ' tests passed (mocked JsMacros APIs).');
