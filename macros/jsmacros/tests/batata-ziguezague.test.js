const fs = require('fs'), vm = require('vm'), assert = require('assert');
const source = fs.readFileSync(require('path').join(__dirname, '../batata-ziguezague.js'), 'utf8');
function setup(script = source, continuous = false, sameRow = false, fieldSweep = false) {
    if (!fieldSweep) script = script.replace("const REVERSE_FIELD_SWEEP = true;", "const REVERSE_FIELD_SWEEP = false;");
    script = script.replace(/const RETURN_SAME_ROW = (true|false);/, "const RETURN_SAME_ROW = " + sameRow + ";");
    if (!continuous) script = script.replace("const CONTINUOUS = true;", "const CONTINUOUS = false;");
    const vars = new Map(), keys = new Map(), crops = new Set(), logs = [], turns = [], solids = new Set(), listeners = new Set(), commands = [], clicks = [], keyHistory = [], lookSteps = [], commandWait = [];
    const s = { x: 0.5, z: 0.5, y: 63.9375, allowClimb: true, jumpLast: false, jumps: 0, yaw: 0, pitch: 55, lowerFromZ: null, lowerFromX: null, maxZ: 9, mirror: false, closed: 0, emptyButton: false, ticks: 0, menu: null, connected: true, loaded: true, move: true, onTick: null, onSay: null, onClick: null, menuTitle: "Fazenda de Batata", button: 20, quantity: "2.160", duplicate: false, holding: false, hideSides: false, hudTitle: null, hudOverlay: null, noTitleProbe: false, noJavaType: false, titleTicks: 20, harvests: 0, blockReads: 0, rayReads: 0, cropId: "minecraft:potatoes", soilId: "minecraft:farmland", sellName: "Vender Batatas", cropWord: "batatas", decoyName: "Outro item" };
    for (let x = -2; x <= 0; x++) for (let z = 0; z <= 7; z++) crops.add(`${x},${z}`);
    function ground(x, z) { return (s.mirror ? x >= -1 && x <= 3 : x >= -3 && x <= 1) && z >= -1 && z <= s.maxZ; }
    function block(x, y, z) {
        s.blockReads++;
        const solid = (y === 64 || y === 65) && (solids.has(`${x},${z}`) || (s.hideSides && x !== 0));
        const cropY = (s.lowerFromZ !== null && z >= s.lowerFromZ) || (s.lowerFromX !== null && x <= s.lowerFromX) ? 63 : 64;
        const id = solid ? 'minecraft:hay_block' : y === cropY - 1 && ground(x, z) ? s.soilId
            : y === cropY && crops.has(`${x},${z}`) ? s.cropId : 'minecraft:air';
        return { getId: () => id, getBlockStateHelper: () => ({ isSolid: () => solid, isLiquid: () => false }) };
    }
    function ray() {
        s.rayReads++;
        const r = s.yaw * Math.PI / 180, dx = Math.round(-Math.sin(r)), dz = Math.round(Math.cos(r));
        for (let i = 0; i <= 1; i++) {
            const x = Math.floor(s.x) + dx * i, z = Math.floor(s.z) + dz * i;
            if (solids.has(`${x},${z}`)) return { getId: () => 'minecraft:hay_block' };
            if (crops.has(`${x},${z}`)) return { getId: () => s.cropId, getY: () => (s.lowerFromZ !== null && z >= s.lowerFromZ) || (s.lowerFromX !== null && x <= s.lowerFromX) ? 63 : 64, pos: `${x},${z}` };
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
            getName: () => text(slot === s.button && s.emptyButton ? 'Armazem vazio' : slot === s.button || slot === 99 || (s.duplicate && slot === 21) ? '§a' + s.sellName : slot === 22 ? s.decoyName : 'Outro item'),
            getLore: () => [text('Quantidade: ' + s.quantity + ' ' + s.cropWord)]
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
            if (keys.get('key.attack')) { const hit = ray(); if (hit) { assert.strictEqual(hit.getId(), s.cropId); crops.delete(hit.pos); s.harvests++; } }
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
    assert(f.logs.some(t => t.includes('Leitor HUD v14 ativo: actionbar')));
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
test('starting above farmland calibrates a potato block mistakenly treated as floor', () => {
    const f = setup(); f.s.y = 64.02;
    f.s.onTick = () => { f.s.y = 63.9375; };
    f.run(); released(f);
    assert(f.logs.some(t => t.includes('Altura inicial corrigida')));
    assert.strictEqual(f.crops.size, 0);
});
test('continuous mode survives multiple harvest and regrowth cycles until manually stopped', () => {
    const f = setup(source, true);
    let cycles = 0;
    f.s.onTick = () => {
        if (f.crops.size === 0) {
            cycles++;
            for (let x = -2; x <= 0; x++) for (let z = 0; z <= 7; z++) f.crops.add(`${x},${z}`);
        }
        if (f.s.ticks >= 2500) f.run();
    };
    f.run(); released(f);
    assert.strictEqual(f.s.ticks, 2500);
    assert(cycles >= 2);
    assert(f.s.harvests > 48);
    assert(f.logs.some(t => t.includes('retomando automaticamente')));
});
test('empty field waits for potatoes to reappear then resumes without another activation', () => {
    const f = setup(source, true); f.crops.clear();
    f.s.onTick = () => {
        if (f.s.ticks === 180) for (let x = -2; x <= 0; x++) for (let z = 0; z <= 7; z++) f.crops.add(`${x},${z}`);
        if (f.s.ticks >= 500) f.run();
    };
    f.run(); released(f);
    assert(f.s.harvests > 0);
    assert(f.logs.some(t => t.includes('Aguardando recuperacao automatica')));
    assert(f.logs.some(t => t.includes('retomando automaticamente')));
});
test('continuous mode waits through a menu and resumes after it closes', () => {
    const f = setup(source, true);
    f.s.onTick = () => {
        if (f.s.ticks === 1) f.s.menu = {};
        if (f.s.ticks === 20) f.s.menu = null;
        if (f.s.ticks >= 100) f.run();
    };
    f.run(); released(f);
    assert.strictEqual(f.s.ticks, 100);
    assert(f.s.harvests > 2);
    assert.strictEqual(f.clicks.length, 0);
});
test('continuous mode stays active while disconnected and rechecks the field on return', () => {
    const f = setup(source, true);
    f.s.onTick = () => {
        if (f.s.ticks === 1) f.s.connected = false;
        if (f.s.ticks === 20) f.s.connected = true;
        if (f.s.ticks >= 160) f.run();
    };
    f.run(); released(f);
    assert.strictEqual(f.s.ticks, 160);
    assert(f.logs.some(t => t.includes('Conexao voltou')));
    assert(f.logs.some(t => t.includes('retomando automaticamente')));
});
test('blocked continuous harvesting retries instead of terminating itself', () => {
    const f = setup(source, true); f.s.move = false;
    f.s.onTick = () => { if (f.s.ticks >= 700) f.run(); };
    f.run(); released(f);
    assert.strictEqual(f.s.ticks, 700);
    assert(f.logs.some(t => t.includes('Aguardando recuperacao automatica')));
    assert.strictEqual(f.logs.filter(t => t.startsWith('[Colheita] Parada:')).length, 1);
});
test('same-row mode repeatedly reverses without changing lanes or crossing a drop', () => {
    const f = setup(source, true, true); f.s.lowerFromZ = 8;
    f.s.onTick = () => {
        assert(Math.abs(f.s.x - 0.5) < 0.0001);
        assert(f.s.z + 0.3 < 8);
        assert.strictEqual(f.s.y, 63.9375);
        if (![...f.crops].some(pos => pos.startsWith('0,'))) {
            for (let z = 0; z <= 7; z++) f.crops.add(`0,${z}`);
        }
        if (f.s.ticks >= 1600) f.run();
    };
    f.run(); released(f);
    assert.strictEqual(f.s.ticks, 1600);
    assert(f.logs.filter(t => t.includes('voltando pela mesma fileira')).length >= 4);
    assert(f.s.harvests > 16);
});
test('same-row mode at a lower ledge returns in place instead of taking another row', () => {
    const f = setup(source, true, true); f.s.lowerFromZ = 4;
    f.s.onTick = () => {
        assert(Math.abs(f.s.x - 0.5) < 0.0001);
        assert(f.s.z + 0.3 < 4);
        if (f.s.ticks >= 700) f.run();
    };
    f.run(); released(f);
    assert(f.logs.filter(t => t.includes('voltando pela mesma fileira')).length >= 2);
    assert(!f.logs.some(t => t.includes('passando para outra fileira')));
});
test('same-row turns release movement and attack until aligned', () => {
    const f = setup(source, true, true);
    let turningTicks = 0;
    f.s.onTick = () => {
        const offAxis = Math.abs(Math.sin(f.s.yaw * Math.PI / 180)) > 0.001;
        if (offAxis) {
            turningTicks++;
            assert.strictEqual(f.keys.get('key.forward'), false);
            assert.strictEqual(f.keys.get('key.attack'), false);
        }
        if (f.s.ticks >= 400) f.run();
    };
    f.run(); released(f);
    assert(turningTicks > 0);
});
test('same-row mode still sells only on the full notice and resumes', () => {
    const f = setup(source, true, true);
    f.s.onSay = () => { f.s.menu = {}; };
    f.s.onClick = () => { f.s.quantity = '0'; };
    f.s.onTick = () => {
        if (f.s.ticks === 50) f.emit('Title', 'Armazém cheio!');
        if (f.s.ticks >= 350) f.run();
    };
    f.run(); released(f);
    assert.deepStrictEqual(f.commands, ['/farms']);
    assert.strictEqual(f.s.closed, 1);
    assert(f.logs.some(t => t.includes('Venda confirmada')));
    assert(f.s.harvests > 4);
});
test('per-cycle block cache reduces world reads without changing the harvest result', () => {
    function run(script) {
        const f = setup(script);
        for (const x of [0, -1]) for (const z of [3, 4]) {
            f.solids.add(`${x},${z}`); f.crops.delete(`${x},${z}`);
        }
        f.run(); released(f); return f;
    }
    const cached = run(source), uncached = run(source.replace('const CACHE_BLOCKS = true;', 'const CACHE_BLOCKS = false;'));
    assert(cached.s.blockReads < uncached.s.blockReads);
    assert.strictEqual(cached.s.harvests, uncached.s.harvests);
    assert.strictEqual(cached.s.ticks, uncached.s.ticks);
});
test('same-row mode can start empty and resume when potatoes grow on that row', () => {
    const f = setup(source, true, true); f.crops.clear();
    f.s.onTick = () => {
        if (f.s.ticks === 150) for (let z = 0; z <= 7; z++) f.crops.add(`0,${z}`);
        if (f.s.ticks >= 450) f.run();
    };
    f.run(); released(f);
    assert(f.s.harvests > 0);
    assert(Math.abs(f.s.x - 0.5) < 0.0001);
});
function recordWorkingLane(f, lanes) {
    const lane = Math.round(f.s.x - 0.5) || 0;
    const aligned = Math.abs(Math.sin(f.s.yaw * Math.PI / 180)) < 0.001;
    if (f.keys.get('key.forward') && aligned && Math.abs(f.s.x - (lane + 0.5)) < 0.15
            && lanes[lanes.length - 1] !== lane) lanes.push(lane);
}
test('field sweep visits multiple rows then traverses them in reverse and repeats', () => {
    const f = setup(source, true, false, true), lanes = [];
    f.s.onTick = () => {
        recordWorkingLane(f, lanes);
        if (f.crops.size === 0) for (let x = -2; x <= 0; x++) for (let z = 0; z <= 7; z++) f.crops.add(`${x},${z}`);
        if (lanes.length >= 7) f.run();
    };
    f.run(); released(f);
    assert.deepStrictEqual(lanes.slice(0, 7), [0, -1, -2, -1, 0, -1, -2]);
    assert(f.logs.filter(t => t.includes('Percurso invertido')).length >= 2);
    assert(f.s.harvests > 24);
});
test('drop return is temporary and then advances to other upper rows in both sweep directions', () => {
    const f = setup(source, true, false, true), lanes = [];
    f.s.lowerFromZ = 4;
    f.s.onTick = () => {
        assert(f.s.z + 0.3 < 4);
        assert.strictEqual(f.s.y, 63.9375);
        recordWorkingLane(f, lanes);
        let anyUpper = false;
        for (let x = -2; x <= 0; x++) for (let z = 0; z < 4; z++) if (f.crops.has(`${x},${z}`)) anyUpper = true;
        if (!anyUpper) for (let x = -2; x <= 0; x++) for (let z = 0; z < 4; z++) f.crops.add(`${x},${z}`);
        if (lanes.length >= 7) f.run();
    };
    f.run(); released(f);
    assert.deepStrictEqual(lanes.slice(0, 7), [0, -1, -2, -1, 0, -1, -2]);
    assert(f.logs.some(t => t.includes('Degrau; retorno de saida')));
    for (let x = -2; x <= 0; x++) for (let z = 4; z <= 7; z++) assert(f.crops.has(`${x},${z}`));
});
test('sweep reversal keeps the shortest smooth turns and manual stop responsive', () => {
    const f = setup(source, true, false, true);
    f.s.onTick = () => {
        if (f.crops.size === 0) for (let x = -2; x <= 0; x++) for (let z = 0; z <= 7; z++) f.crops.add(`${x},${z}`);
        if (f.logs.some(t => t.includes('Percurso invertido'))) f.run();
    };
    f.run(); released(f);
    assert(f.logs.some(t => t.includes('Percurso invertido')));
    assert(f.lookSteps.every(d => Math.abs(d) <= 10.0001));
});
test('drop exit happens once, then each subsequent boundary changes to another row', () => {
    const f = setup(source, true, false, true); f.s.lowerFromZ = 4;
    const lanes = [];
    f.s.onTick = () => {
        recordWorkingLane(f, lanes);
        let any = false;
        for (let x = -2; x <= 0; x++) for (let z = 0; z < 4; z++) if (f.crops.has(`${x},${z}`)) any = true;
        if (!any) for (let x = -2; x <= 0; x++) for (let z = 0; z < 4; z++) f.crops.add(`${x},${z}`);
        if (lanes.length >= 5) f.run();
    };
    f.run(); released(f);
    assert.deepStrictEqual(lanes.slice(0, 5), [0, -1, -2, -1, 0]);
    assert.strictEqual(f.logs.filter(t => t.includes('Degrau; retorno de saida')).length, 1);
});
test('after exiting a drop chooses the upper side rather than progressing toward the lower border', () => {
    const f = setup(source, true, false, true);
    f.s.lowerFromZ = 4; f.s.lowerFromX = -2; f.s.mirror = true; f.crops.clear();
    for (let x = -2; x <= 2; x++) for (let z = 0; z < 4; z++) f.crops.add(`${x},${z}`);
    const lanes = [];
    f.s.onTick = () => {
        recordWorkingLane(f, lanes);
        assert(f.s.x - 0.3 > -2);
        assert(f.s.z + 0.3 < 4);
        if (lanes.length >= 3) f.run();
    };
    f.run(); released(f);
    assert.deepStrictEqual(lanes.slice(0, 3), [0, 1, 2]);
    assert(f.logs.some(t => t.includes('Lado do percurso corrigido')));
    assert.strictEqual(f.logs.filter(t => t.includes('Degrau; retorno de saida')).length, 1);
});
test('carrots are harvested and navigated with the default full sweep mode', () => {
    const f = setup(source, true, false, true); f.s.cropId = 'minecraft:carrots';
    f.s.onTick = () => { if (f.crops.size === 0) f.run(); };
    f.run(); released(f);
    assert.strictEqual(f.crops.size, 0);
    assert(f.s.harvests >= 24);
});
function carrotSaleFixture() {
    const f = salesFixture(); f.s.cropId = 'minecraft:carrots';
    f.s.menuTitle = 'Fazenda de Cenoura'; f.s.sellName = 'Vender Cenouras'; f.s.cropWord = 'cenouras';
    f.s.decoyName = 'Vender Batatas';
    return f;
}
test('carrot menu clicks only sell carrots and resumes after zero quantity', () => {
    const f = carrotSaleFixture(); f.s.onClick = () => { f.s.quantity = '0'; };
    f.run(); released(f);
    assert.deepStrictEqual(f.commands, ['/farms']);
    assert.deepStrictEqual(f.clicks, [20]);
    assert.strictEqual(f.s.closed, 1);
    assert(f.logs.some(t => t.includes('Clique em Vender Cenouras')));
    assert(f.logs.some(t => t.includes('Venda confirmada')));
    assert.strictEqual(f.crops.size, 0);
});
test('carrot sale confirmation is accepted from its server receipt', () => {
    const f = carrotSaleFixture();
    f.s.onClick = () => { f.emit('RecvMessage', 'Você vendeu 2.160 cenouras!'); f.s.menu = null; };
    f.run(); released(f);
    assert(f.logs.some(t => t.includes('Venda confirmada')));
});
test('potato receipt does not falsely confirm a carrot sale', () => {
    const f = carrotSaleFixture();
    f.s.onClick = () => { f.emit('RecvMessage', 'Você vendeu 2.160 batatas!'); };
    f.run(); released(f);
    assert(!f.logs.some(t => t.includes('Venda confirmada')));
    assert(f.logs.some(t => t.includes('sem confirmacao do saldo')));
});
test('carrot farm never clicks sell potatoes when sell carrots is absent', () => {
    const f = carrotSaleFixture(); f.s.sellName = 'Vender Batatas'; f.s.decoyName = 'Outro item';
    f.run(); released(f);
    assert.strictEqual(f.clicks.length, 0);
    assert(f.logs.some(t => t.includes('Vender Cenouras nao encontrado')));
});
test('starting height is calibrated above carrots as well as potatoes', () => {
    const f = setup(); f.s.cropId = 'minecraft:carrots'; f.s.y = 64.02;
    f.s.onTick = () => { f.s.y = 63.9375; };
    f.run(); released(f);
    assert(f.logs.some(t => t.includes('Altura inicial corrigida')));
    assert.strictEqual(f.crops.size, 0);
});
test('inset wall corner does not trap the sweep between the same two rows', () => {
    const f = setup(source, true, false, true), lanes = [];
    // Adjacent rows end four blocks before the starting row. The old two-block
    // search incorrectly considered this local corner the lateral field edge.
    for (const x of [-1, -2]) for (let z = 4; z <= 9; z++) {
        f.solids.add(`${x},${z}`); f.crops.delete(`${x},${z}`);
    }
    f.s.onTick = () => {
        recordWorkingLane(f, lanes);
        if (f.crops.size === 0) {
            for (let z = 0; z <= 7; z++) f.crops.add(`0,${z}`);
            for (const x of [-1, -2]) for (let z = 0; z <= 3; z++) f.crops.add(`${x},${z}`);
        }
        if (lanes.length >= 5) f.run();
    };
    f.run(); released(f);
    assert.deepStrictEqual(lanes.slice(0, 5), [0, -1, -2, -1, 0]);
});
test('corner sweep works with carrots too and keeps all obstacle blocks intact', () => {
    const f = setup(source, true, false, true); f.s.cropId = 'minecraft:carrots';
    const lanes = [];
    for (const x of [-1, -2]) for (let z = 4; z <= 9; z++) {
        f.solids.add(`${x},${z}`); f.crops.delete(`${x},${z}`);
    }
    f.s.onTick = () => {
        recordWorkingLane(f, lanes);
        if (lanes.length >= 3) f.run();
    };
    f.run(); released(f);
    assert.deepStrictEqual(lanes.slice(0, 3), [0, -1, -2]);
    assert.strictEqual(f.solids.size, 12);
    assert(!f.keyHistory.some(([key, down]) => key === 'key.sneak' && down));
});
test('harvests nether wart on soul sand in the default sweep mode', () => {
    const f = setup(source, true, false, true);
    f.s.cropId = 'minecraft:nether_wart'; f.s.soilId = 'minecraft:soul_sand'; f.s.y = 63.875;
    f.s.onTick = () => { if (f.crops.size === 0) f.run(); };
    f.run(); released(f);
    assert.strictEqual(f.crops.size, 0);
    assert(f.s.harvests >= 24);
});
test('harvests both crimson and warped fungi on their nylium', () => {
    for (const type of ['crimson', 'warped']) {
        const f = setup(source, true, false, true);
        f.s.cropId = 'minecraft:' + type + '_fungus'; f.s.soilId = 'minecraft:' + type + '_nylium';
        f.s.onTick = () => { if (f.crops.size === 0) f.run(); };
        f.run(); released(f); assert.strictEqual(f.crops.size, 0);
    }
});
function fungusSaleFixture(title = 'Fazenda de Fungo', button = 'Vender Fungos') {
    const f = salesFixture(); f.s.cropId = 'minecraft:nether_wart'; f.s.soilId = 'minecraft:soul_sand';
    f.s.menuTitle = title; f.s.sellName = button; f.s.cropWord = 'fungos'; f.s.decoyName = 'Vender Batatas';
    return f;
}
test('fungus farm selects sell fungi and confirms zero quantity', () => {
    const f = fungusSaleFixture(); f.s.onClick = () => { f.s.quantity = '0'; };
    f.run(); released(f);
    assert.deepStrictEqual(f.clicks, [20]);
    assert.strictEqual(f.s.closed, 1);
    assert(f.logs.some(t => t.includes('Venda confirmada')));
    assert.strictEqual(f.crops.size, 0);
});
test('accepts nether fungus menu and button aliases', () => {
    const f = fungusSaleFixture('Fazenda de Fungos do Nether', 'Vender Fungos do Nether');
    f.s.onClick = () => { f.emit('RecvMessage', 'Você vendeu 2.160 fungos do Nether!'); f.s.menu = null; };
    f.run(); released(f);
    assert.deepStrictEqual(f.clicks, [20]);
    assert(f.logs.some(t => t.includes('Venda confirmada')));
});
test('fungus farm refuses a potato button instead of sell fungi', () => {
    const f = fungusSaleFixture(); f.s.sellName = 'Vender Batatas';
    f.run(); released(f);
    assert.strictEqual(f.clicks.length, 0);
});
test('nether wart crop is not mistaken for the starting support block', () => {
    const f = setup(); f.s.cropId = 'minecraft:nether_wart'; f.s.soilId = 'minecraft:soul_sand'; f.s.y = 64.02;
    f.s.onTick = () => { f.s.y = 63.9375; };
    f.run(); released(f);
    assert(f.logs.some(t => t.includes('Altura inicial corrigida')));
    assert.strictEqual(f.crops.size, 0);
});
function closedCornerFixture() {
    const f = setup(source, true, false, true);
    f.s.cropId = 'minecraft:nether_wart'; f.s.soilId = 'minecraft:soul_sand'; f.s.y = 63.875;
    f.crops.clear();
    for (const x of [0, -1, -2]) f.crops.add(`${x},0`);
    f.solids.add('0,1');
    for (const x of [0, -1, -2]) f.solids.add(`${x},-1`);
    return f;
}
test('when direct reverse is blocked, escapes the closed wart corner on the same level', () => {
    const f = closedCornerFixture();
    f.s.onTick = () => {
        assert.strictEqual(f.s.y, 63.875);
        if (f.logs.some(t => t.includes('Saiu do canto'))) f.run();
    };
    f.run(); released(f);
    assert(f.logs.some(t => t.includes('Saindo do canto')));
    assert(f.logs.some(t => t.includes('Saiu do canto')));
    assert(f.s.x < -1);
    const gx = Math.floor(f.s.x), gz = Math.floor(f.s.z);
    assert(!f.solids.has(`${gx},${gz}`));
    assert(!f.solids.has(`${gx},${gz + 1}`) || !f.solids.has(`${gx},${gz - 1}`));
    assert.strictEqual(f.solids.size, 4);
});
test('manual stop remains responsive during a corner escape', () => {
    const f = closedCornerFixture();
    f.s.onTick = () => { if (f.logs.some(t => t.includes('Saindo do canto'))) f.run(); };
    f.run(); released(f);
    assert(f.logs.some(t => t.includes('Saindo do canto')));
});
console.log(count + ' tests passed (mocked JsMacros APIs).');
