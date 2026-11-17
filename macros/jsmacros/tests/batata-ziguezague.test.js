const fs = require('fs'), vm = require('vm'), assert = require('assert');
const source = fs.readFileSync(require('path').join(__dirname, '../batata-ziguezague.js'), 'utf8');
function setup(script = source) {
    const vars = new Map(), keys = new Map(), crops = new Set(), logs = [], turns = [], solids = new Set(), listeners = new Set(), commands = [], clicks = [], keyHistory = [], lookSteps = [], commandWait = [];
    const s = { x: 0.5, z: 0.5, y: 63.9375, allowClimb: true, jumpLast: false, jumps: 0, yaw: 0, pitch: 55, lowerFromZ: null, maxZ: 9, mirror: false, closed: 0, emptyButton: false, ticks: 0, menu: null, connected: true, loaded: true, move: true, onTick: null, onSay: null, onClick: null, menuTitle: "Fazenda de Batata", button: 20, quantity: "2.160", duplicate: false, holding: false, hideSides: false, hudTitle: null, hudOverlay: null, noTitleProbe: false, noJavaType: false, titleTicks: 20 };
    for (let x = -2; x <= 0; x++) for (let z = 0; z <= 7; z++) crops.add(`${x},${z}`);
    function ground(x, z) { return (s.mirror ? x >= -1 && x <= 3 : x >= -3 && x <= 1) && z >= -1 && z <= s.maxZ; }
    function block(x, y, z) {
        const solid = (y === 64 || y === 65) && (solids.has(`${x},${z}`) || (s.hideSides && x !== 0));
        const cropY = s.lowerFromZ !== null && z >= s.lowerFromZ ? 63 : 64;
        const id = solid ? 'minecraft:hay_block' : y === cropY - 1 && ground(x, z) ? 'minecraft:farmland'
            : y === cropY && crops.has(`${x},${z}`) ? 'minecraft:potatoes' : 'minecraft:air';
        return { getId: () => id, getBlockStateHelper: () => ({ isSolid: () => solid, isLiquid: () => false }) };
    }
    function ray() {
        const r = s.yaw * Math.PI / 180, dx = Math.round(-Math.sin(r)), dz = Math.round(Math.cos(r));
        for (let i = 0; i <= 1; i++) {
            const x = Math.floor(s.x) + dx * i, z = Math.floor(s.z) + dz * i;
            if (solids.has(`${x},${z}`)) return { getId: () => 'minecraft:hay_block' };
            if (crops.has(`${x},${z}`)) return { getId: () => 'minecraft:potatoes', getY: () => s.lowerFromZ !== null && z >= s.lowerFromZ ? 63 : 64, pos: `${x},${z}` };
        }
        return null;
    }
    const p = { getX: () => s.x, getY: () => s.y, getZ: () => s.z, getYaw: () => s.yaw, getPitch: () => s.pitch,
        lookAt: (yaw, pitch) => { lookSteps.push(((yaw - s.yaw + 180) % 360 + 360) % 360 - 180); if (s.yaw !== yaw) turns.push(yaw); s.yaw = yaw; s.pitch = pitch; } };
    const text = value => ({ getString: () => value });
    function emit(event, value) {
        for (const listener of listeners) if (listener.event === event) listener.fn(event === 'Title'
            ? { type: 'ACTIONBAR', message: text(value) } : { text: text(value) });
    }
    const inv = {
        getHeld: () => ({ isEmpty: () => !s.holding }),
        getContainerTitle: () => s.menuTitle,
        getSlots: section => { assert.strictEqual(section, 'container'); return Array.from({length: 54}, (_, i) => i); },
        getSlot: slot => ({
            isEmpty: () => false,
            getName: () => text(slot === s.button && s.emptyButton ? 'Armazem vazio' : slot === s.button || slot === 99 || (s.duplicate && slot === 21) ? '§aVender Batatas' : 'Outro item'),
            getLore: () => [text('Quantidade: ' + s.quantity + ' batatas')]
        }),
        click: slot => { clicks.push(slot); if (s.onClick) s.onClick(); },
        close: () => { s.closed++; s.menu = null; }
    };
    const hud = { getClass: () => 'hud' };
    Object.defineProperties(hud, {
        field_2016: { get: () => s.hudTitle === null ? null : text(s.hudTitle) },
        field_2023: { get: () => s.hudTitle === null ? 0 : s.titleTicks },
        field_2018: { get: () => s.hudOverlay === null ? null : text(s.hudOverlay) },
        field_2041: { get: () => s.hudOverlay === null ? 0 : 20 }
    });
    const mc = { getClass: () => 'client', field_1705: hud };
    let run;
    const ctx = vm.createContext({
        Java: { type: () => { if (s.noJavaType) throw Error('class loading unavailable'); return {wrap: value => value}; } },
        Reflection: { getDeclaredField: (type, name) => {
            const target = type === 'client' ? mc : hud;
            if (!(name in target) || (s.noTitleProbe && ['field_2016', 'field_2023', 'title', 'titleRemainTicks'].includes(name))) {
                throw Error('field unavailable: ' + name);
            }
            return { setAccessible: () => {}, get: obj => obj[name], getInt: obj => obj[name] };
        } },
        Chat: { log: text => logs.push(text), say: (command, awaitSend) => { commandWait.push(awaitSend); commands.push(command); if (s.onSay) s.onSay(); } },
        JsMacros: { on: (event, fn) => { const listener = {event, fn}; listeners.add(listener); return listener; },
            off: listener => listeners.delete(listener) },
        JavaWrapper: { methodToJava: fn => fn },
        GlobalVars: { getString: k => vars.get(k) ?? null, putString: (k, v) => vars.set(k, v) },
        Hud: { getOpenScreen: () => s.menu },
        Player: { getPlayer: () => s.connected ? p : null, rayTraceBlock: ray, openInventory: () => inv },
        World: { isChunkLoaded: () => s.loaded, getBlock: block },
        KeyBind: { keyBind: (k, v) => { keys.set(k, v); keyHistory.push([k, v]); } },
        Client: { getMinecraft: () => mc, waitTick: () => {
            if (++s.ticks > 4000) throw Error('loop exceeded test bound');
            const jumping = keys.get('key.jump') === true;
            if (jumping && !s.jumpLast) s.jumps++;
            s.jumpLast = jumping;
            if (jumping && s.allowClimb && s.y < 63.9375) s.y = 63.9375;
            if (keys.get('key.attack')) { const hit = ray(); if (hit) { assert.strictEqual(hit.getId(), 'minecraft:potatoes'); crops.delete(hit.pos); } }
            if ((keys.get('key.forward') || keys.get('key.back')) && s.move) {
                const r = s.yaw * Math.PI / 180;
                const speed = (keys.get('key.back') ? -1 : 1) * (keys.get('key.sneak') ? 0.07 : 0.1);
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
    run = () => vm.runInContext(script, ctx);
    return { s, keys, crops, logs, turns, solids, run, listeners, commands, clicks, emit, keyHistory, lookSteps, commandWait };
}
function released(f) {
    assert.strictEqual(f.listeners.size, 0);
    for (const k of ['key.forward', 'key.back', 'key.sprint', 'key.attack', 'key.sneak', 'key.jump']) assert.strictEqual(f.keys.get(k), false);
}
let count = 0;
function test(name, fn) { fn(); count++; console.log('OK: ' + name); }
test('harvests three adjacent rows, reverses twice and stops at last row', () => {
    const f = setup(); f.run(); released(f);
    assert(f.turns.some(y => Math.abs(((y % 360) + 360) % 360 - 180) < 0.001));
    assert(f.turns.some(y => Math.abs(((y % 360) + 360) % 360) < 0.001));
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
test('sidesteps a two-block hay obstacle and continues ahead without rejoining', () => {
    const f = setup();
    for (const x of [0, -1]) for (const z of [3, 4]) {
        f.solids.add(`${x},${z}`); f.crops.delete(`${x},${z}`);
    }
    f.run(); released(f);
    assert(f.logs.some(t => t.includes('desviando para a lateral')));
    assert.strictEqual(f.solids.size, 4);
    for (let z = 5; z <= 7; z++) assert(!f.crops.has(`-2,${z}`));
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
    assert(f.logs.some(t => t.includes('Caiu um degrau')));
});
test('deep falls stop rather than repeatedly jumping', () => {
    const f = setup();
    f.s.onTick = () => { if (f.s.ticks === 1) f.s.y -= 2; };
    f.run(); released(f);
    assert.strictEqual(f.s.jumps, 0);
    assert(f.logs.some(t => t.includes('queda sem retorno')));
});
function salesFixture(event = 'Title') {
    const f = setup();
    f.s.onTick = () => {
        if (f.s.ticks === 1) f.emit(event, '§cArmazém cheio! §fVenda com /farm');
        if (f.s.menu !== null) for (const key of ['key.forward', 'key.back', 'key.sprint', 'key.attack', 'key.jump']) {
            assert.strictEqual(f.keys.get(key), false);
        }
    };
    f.s.onSay = () => { f.s.menu = {}; };
    return f;
}
test('actionbar full notice sells by button name and resumes after zero quantity', () => {
    const f = salesFixture();
    f.s.onClick = () => { f.s.quantity = '0'; };
    f.run(); released(f);
    assert.deepStrictEqual(f.commands, ['/farms']);
    assert.deepStrictEqual(f.clicks, [20]);
    assert(f.logs.some(t => t.includes('Venda confirmada')));
    assert.strictEqual(f.crops.size, 0);
});
test('chat fallback confirms server sale even when menu closes on click', () => {
    const f = salesFixture('RecvMessage');
    f.s.onClick = () => { f.emit('RecvMessage', 'Você vendeu 2.160 batatas!'); f.s.menu = null; };
    f.run(); released(f);
    assert(f.logs.some(t => t.includes('Venda confirmada')));
    assert.strictEqual(f.crops.size, 0);
});
test('unconfirmed sale closes its menu after one second and resumes without claiming success', () => {
    const f = salesFixture();
    f.s.onClick = () => { f.s.menu = null; };
    f.run(); released(f);
    assert.deepStrictEqual(f.clicks, [20]);
    assert(f.logs.some(t => t.includes('sem confirmacao do saldo')));
    assert.strictEqual(f.s.menu, null);
    assert.strictEqual(f.crops.size, 0);
});
test('unexpected menu is left untouched', () => {
    const f = salesFixture(); f.s.menuTitle = 'Loja';
    f.run(); released(f);
    assert.strictEqual(f.clicks.length, 0);
    assert(f.logs.some(t => t.includes('menu inesperado')));
});
test('player inventory button and ambiguous container buttons are never clicked', () => {
    for (const ambiguous of [false, true]) {
        const f = salesFixture(); f.s.button = ambiguous ? 20 : 99; f.s.duplicate = ambiguous;
        f.run(); released(f);
        assert.strictEqual(f.clicks.length, 0);
        assert(f.logs.some(t => t.includes('botao Vender Batatas nao encontrado')));
    }
});
test('manual stop cancels while waiting for the menu', () => {
    const f = salesFixture(); f.s.onSay = () => {};
    f.s.onTick = () => {
        if (f.s.ticks === 1) f.emit('Title', 'Armazem cheio');
        if (f.s.ticks === 3) f.run();
    };
    f.run(); released(f);
    assert.deepStrictEqual(f.commands, ['/farms']);
    assert.strictEqual(f.clicks.length, 0);
    assert.strictEqual(f.s.ticks, 3);
});
test('held cursor item prevents sale click', () => {
    const f = salesFixture(); f.s.holding = true;
    f.run(); released(f);
    assert.strictEqual(f.clicks.length, 0);
    assert(f.logs.some(t => t.includes('item no cursor')));
});
test('repeated full messages during sale and cooldown do not resend commands', () => {
    const f = salesFixture(); f.s.onClick = () => { f.s.quantity = '0'; };
    f.s.onTick = () => { if (f.s.ticks <= 40) f.emit('Title', 'Armazem cheio'); };
    f.run(); released(f);
    assert.deepStrictEqual(f.commands, ['/farms']);
    assert.deepStrictEqual(f.clicks, [20]);
});
test('small height oscillations over farmland do not invent an obstacle', () => {
    const f = setup();
    f.s.onTick = () => { f.s.y = f.s.ticks % 2 ? 64.03 : 63.9375; };
    f.run(); released(f);
    assert.strictEqual(f.crops.size, 0);
    assert(!f.logs.some(t => t.includes('desviando para a lateral')));
    assert(!f.logs.some(t => t.includes('passagem bloqueada')));
});
test('height oscillations do not invalidate a real obstacle detour', () => {
    const f = setup();
    for (const x of [0, -1]) for (const z of [3, 4]) {
        f.solids.add(`${x},${z}`); f.crops.delete(`${x},${z}`);
    }
    f.s.onTick = () => { f.s.y = f.s.ticks % 2 ? 64.03 : 63.9375; };
    f.run(); released(f);
    assert(f.logs.some(t => t.includes('desviando para a lateral')));
    for (let z = 5; z <= 7; z++) assert(!f.crops.has(`-2,${z}`));
    assert(!f.logs.some(t => t.includes('passagem bloqueada')));
});
test('all navigation including real detours keeps sneak released', () => {
    const f = setup();
    for (const x of [0, -1]) for (const z of [3, 4]) {
        f.solids.add(`${x},${z}`); f.crops.delete(`${x},${z}`);
    }
    f.run(); released(f);
    assert(!f.keyHistory.some(([key, down]) => key === 'key.sneak' && down));
    assert(f.logs.some(t => t.includes('desviando para a lateral')));
});
test('no local passage triggers a short backward movement then retries harvest', () => {
    const f = setup(); f.s.hideSides = true;
    f.solids.add('0,1'); f.crops.delete('0,1');
    f.s.onTick = () => { if (f.s.z < 0.1) f.s.hideSides = false; };
    f.run(); released(f);
    assert(f.logs.some(t => t.includes('recuando')));
    assert(f.keyHistory.some(([key, down]) => key === 'key.back' && down));
    assert(f.logs.some(t => t.includes('desviando para a lateral') || t.includes('Parede/fim')));
    assert(!f.crops.has('-1,7'));
    assert(!f.crops.has('-2,0'));
});
test('manual stop during retreat releases the backward key', () => {
    const f = setup(); f.s.hideSides = true;
    f.solids.add('0,1'); f.crops.delete('0,1');
    f.s.onTick = () => { if (f.keys.get('key.back')) f.run(); };
    f.run(); released(f);
    assert(f.keyHistory.some(([key, down]) => key === 'key.back' && down));
});
test('direct title polling detects full warehouse even without a Title event', () => {
    const f = setup();
    f.s.onTick = () => { if (f.s.ticks === 1) f.s.hudTitle = '§cArmazém cheio!'; };
    f.s.onSay = () => { f.s.menu = {}; };
    f.s.onClick = () => { f.s.quantity = '0'; f.s.hudTitle = null; };
    f.run(); released(f);
    assert.deepStrictEqual(f.commands, ['/farms']);
    assert.deepStrictEqual(f.clicks, [20]);
    assert.strictEqual(f.crops.size, 0);
});
test('direct actionbar polling detects full warehouse without chat events', () => {
    const f = setup();
    f.s.onTick = () => { if (f.s.ticks === 1) f.s.hudOverlay = 'Armazém cheio! Venda com /farm'; };
    f.s.onSay = () => { f.s.menu = {}; };
    f.s.onClick = () => { f.s.quantity = '0'; f.s.hudOverlay = null; };
    f.run(); released(f);
    assert.deepStrictEqual(f.commands, ['/farms']);
    assert(f.logs.some(t => t.includes('Venda confirmada')));
});
test('does not sell merely because sixty seconds elapsed without a full notice', () => {
    const f = setup(); f.s.maxZ = 162; f.crops.clear();
    for (let z = 0; z <= 160; z++) f.crops.add(`0,${z}`);
    f.run(); released(f);
    assert(f.s.ticks > 1200);
    assert.deepStrictEqual(f.commands, []);
    assert.strictEqual(f.crops.size, 0);
});
test('turns have a maximum ten-degree yaw step', () => {
    const f = setup(); f.run(); released(f);
    assert(f.lookSteps.some(d => Math.abs(d) > 0));
    assert(f.lookSteps.every(d => Math.abs(d) <= 10.0001));
    assert.strictEqual(f.crops.size, 0);
});
test('avoids a one-block drop and returns harvesting on the next upper row', () => {
    const f = setup(); f.s.lowerFromZ = 4;
    let largestZ = f.s.z;
    f.s.onTick = () => {
        largestZ = Math.max(largestZ, f.s.z);
        assert(f.s.z + 0.3 < 4, 'player footprint crosses the drop');
    };
    f.run(); released(f);
    assert(f.logs.some(t => t.includes('Parede/fim')));
    assert(!f.logs.some(t => t.includes('descendo') || t.includes('Caiu um degrau')));
    assert.strictEqual(f.s.y, 63.9375);
    assert(largestZ < 4);
    for (let x = -2; x <= 0; x++) for (let z = 0; z < 4; z++) assert(!f.crops.has(`${x},${z}`));
    for (let x = -2; x <= 0; x++) for (let z = 4; z <= 7; z++) assert(f.crops.has(`${x},${z}`));
});
test('only warehouse full triggers selling, not unrelated inventory full', () => {
    const f = setup();
    f.s.onTick = () => { if (f.s.ticks === 1) f.emit('Title', 'Inventário cheio!'); };
    f.s.onSay = () => { f.s.menu = {}; };
    f.s.onClick = () => { f.s.quantity = '0'; };
    f.run(); released(f);
    assert.deepStrictEqual(f.commands, []);
});
test('ordinary row turns use exactly the necessary arc in either field direction', () => {
    for (const mirrored of [false, true]) {
        const script = mirrored ? source.replace('const SIDE = 1;', 'const SIDE = -1;') : source;
        const f = setup(script); f.s.mirror = mirrored;
        if (mirrored) {
            f.crops.clear();
            for (let x = 0; x <= 2; x++) for (let z = 0; z <= 7; z++) f.crops.add(`${x},${z}`);
        }
        f.run(); released(f);
        const total = f.lookSteps.reduce((sum, d) => sum + Math.abs(d), 0);
        assert(total >= 359.9 && total <= 360.1, 'extra rotation: ' + total);
        assert.strictEqual(f.crops.size, 0);
    }
});
test('unchanged sale menu still closes after click and harvesting resumes', () => {
    const f = salesFixture();
    // Simulate a server that keeps stale quantity text and sends no receipt.
    f.run(); released(f);
    assert.deepStrictEqual(f.clicks, [20]);
    assert.strictEqual(f.s.closed, 1);
    assert.strictEqual(f.s.menu, null);
    assert.strictEqual(f.crops.size, 0);
    assert(f.logs.some(t => t.includes('sem confirmacao do saldo')));
});
test('sold button changing to warehouse empty is recognized before closing', () => {
    const f = salesFixture();
    f.s.onClick = () => { f.s.emptyButton = true; };
    f.run(); released(f);
    assert.strictEqual(f.s.closed, 1);
    assert(f.logs.some(t => t.includes('Venda confirmada')));
    assert.strictEqual(f.crops.size, 0);
});
test('per-character legacy RGB colors do not hide warehouse full notice', () => {
    const f = salesFixture();
    const colored = [...'Armazém cheio!'].map(c => '§x§f§f§0§0§0§0' + c).join('');
    f.s.onTick = () => { if (f.s.ticks === 1) f.emit('Title', colored); };
    f.s.onClick = () => { f.s.quantity = '0'; };
    f.run(); released(f);
    assert.deepStrictEqual(f.commands, ['/farms']);
    assert(f.logs.some(t => t.includes('Aviso reconhecido')));
});
test('missing title fields do not disable available actionbar polling', () => {
    const f = setup(); f.s.noTitleProbe = true;
    f.s.onTick = () => { if (f.s.ticks === 1) f.s.hudOverlay = 'Armazém cheio!'; };
    f.s.onSay = () => { f.s.menu = {}; };
    f.s.onClick = () => { f.s.quantity = '0'; f.s.hudOverlay = null; };
    f.run(); released(f);
    assert.deepStrictEqual(f.commands, ['/farms']);
    assert(f.logs.some(t => t.includes('Leitor HUD v6 ativo: actionbar')));
});
test('visible title at startup works without Java.type or a new event', () => {
    const f = setup(); f.s.noJavaType = true; f.s.hudTitle = 'Armazém cheio!';
    f.s.onSay = () => { f.s.menu = {}; };
    f.s.onClick = () => { f.s.quantity = '0'; f.s.hudTitle = null; };
    f.run(); released(f);
    assert.deepStrictEqual(f.commands, ['/farms']);
    assert(f.logs.some(t => t.includes('Texto HUD lido: titulo: Armazém cheio!')));
});
test('expired title does not trigger selling', () => {
    const f = setup(); f.s.hudTitle = 'Armazém cheio!'; f.s.titleTicks = 0;
    f.run(); released(f);
    assert.deepStrictEqual(f.commands, []);
});
test('wall transition releases attack while moving sideways to next row', () => {
    const f = setup();
    for (let x = -3; x <= 1; x++) f.solids.add(`${x},8`);
    let lateralTicks = 0;
    f.s.onTick = () => {
        if (f.keys.get('key.forward') && Math.abs(Math.cos(f.s.yaw * Math.PI / 180)) < 0.1) {
            lateralTicks++;
            assert.strictEqual(f.keys.get('key.attack'), false);
        }
    };
    f.run(); released(f);
    assert(lateralTicks > 0);
    assert.strictEqual(f.crops.size, 0);
});
console.log(count + ' tests passed (mocked JsMacros APIs).');
