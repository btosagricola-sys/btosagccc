// JsMacros 1.21.4. Vincule a uma tecla (ex.: F6), gatilho ao pressionar.
// A mesma tecla inicia/para. Comece na primeira fileira, olhando ao longo dela.
(function () {
    const RUN = "btos.batata.zig.run", STOP = "btos.batata.zig.stop";
    const SALE_REQUEST = RUN + ".sale", SALE_ACK = RUN + ".sold", SALE_STATE = RUN + ".saleState";
    const PITCH = 55;
    const SELL_INTERVAL = 1200; // Venda de reserva a cada 60 s, mesmo sem ler o aviso.
    const TURN_STEP = 10; // Graus por tick: viradas graduais.
    const ROW_WIDTH = 1; // Distancia entre fileiras em blocos.
    const SIDE = 1; // 1 = proxima fileira a direita inicial; -1 = a esquerda.
    const DETOUR_RADIUS = 8; // Limite do desvio local, em blocos.
    const SCAN = 6; // Tolera pequenos espacos sem plantas.
    const keys = ["key.forward", "key.back", "key.sprint", "key.attack", "key.sneak", "key.jump"];
    const current = GlobalVars.getString(RUN);
    if (current) { GlobalVars.putString(STOP, current); return; }
    const first = Player.getPlayer();
    if (!first || Hud.getOpenScreen() !== null) {
        Chat.log("[Batata] Entre no mundo e feche os menus."); return;
    }
    const id = String(Date.now()) + ":" + String(Math.random());
    let yaw = Math.round(first.getYaw() / 90) * 90;
    function direction(angle) {
        const r = angle * Math.PI / 180;
        return { x: Math.round(-Math.sin(r)), z: Math.round(Math.cos(r)) };
    }
    let forward = direction(yaw);
    const fieldAxis = { x: forward.x, z: forward.z };
    let fieldMin = null, fieldMax = null;
    // Mantem sempre o mesmo lado global, mesmo depois de inverter o percurso.
    const side = { x: -forward.z * SIDE, z: forward.x * SIDE };
    const sideYaw = Math.atan2(-side.x, side.z) * 180 / Math.PI;
    let phase = "row", destination = null, end = null;
    let route = [], routeIndex = 0, reverseAfterRoute = false;
    let blockedTicks = 0, blockedKey = "";
    let retreat = null, retreatCount = 0, lastRetreat = null;
    let missing = 0, idle = 0, checkpoint = { x: first.getX(), z: first.getZ() };
    let farmY = first.getY(), farmLevel = Math.ceil(farmY - 0.01);
    let lastSafe = null, climb = null, descent = null;
    const recoveryVisits = new Map();
    let sale = null, saleCooldown = 0, hudReader = null, sinceSale = 0;
    const listeners = [];
    let reason = "desativada";
    GlobalVars.putString(RUN, id); GlobalVars.putString(STOP, "");

    function plain(text) {
        return String(text).replace(/§[0-9a-fk-or]/gi, "").normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "").replace(/[\u200B-\u200D\uFEFF]/g, "").toLowerCase().trim();
    }
    function releaseKeys() {
        for (const key of keys) KeyBind.keyBind(key, false);
    }
    function receive(text) {
        if (text === null || text === undefined || GlobalVars.getString(RUN) !== id) return;
        const message = plain(text.getString());
        const state = GlobalVars.getString(SALE_STATE);
        if (state === "idle" && /(?:armazem|inventario|deposito)\s+(?:esta\s+)?cheio/.test(message)) GlobalVars.putString(SALE_REQUEST, id);
        if (state === "confirm" && /batatas?/.test(message)
                && /vendid|vendeu|venda (?:realizada|efetuada|concluida)/.test(message)
                && !/nao |erro|falh|insuficiente/.test(message)) GlobalVars.putString(SALE_ACK, id);
    }
    function farmMenu() {
        if (Hud.getOpenScreen() === null) return null;
        const inv = Player.openInventory();
        return /^fazenda de batatas?$/.test(plain(inv.getContainerTitle())) ? inv : null;
    }
    function sellButton(inv) {
        const matches = [];
        // Somente o menu superior: nunca pesquisa itens do inventario do jogador.
        for (const slot of inv.getSlots("container")) {
            const item = inv.getSlot(slot);
            if (!item.isEmpty() && plain(item.getName().getString()) === "vender batatas") matches.push(slot);
        }
        return matches.length === 1 ? matches[0] : -1;
    }
    function emptyWarehouse(inv) {
        const slot = sellButton(inv);
        if (slot < 0) return false;
        for (const line of inv.getSlot(slot).getLore()) {
            if (/quantidade\s*:\s*0(?:[.,]0+)?\s+batatas?\b/.test(plain(line.getString()))) return true;
        }
        return false;
    }

    function prepareHudReader() {
        const mc = Client.getMinecraft();
        function field(object, intermediary, named) {
            const f = Reflection.getDeclaredField(object.getClass(), intermediary, named);
            f.setAccessible(true); return f;
        }
        const hudField = field(mc, "field_1705", "inGameHud");
        const hud = hudField.get(mc);
        const title = field(hud, "field_2016", "title"), titleTime = field(hud, "field_2023", "titleRemainTicks");
        const overlay = field(hud, "field_2018", "overlayMessage"), overlayTime = field(hud, "field_2041", "overlayRemaining");
        const textHelper = Java.type("xyz.wagyourtail.jsmacros.client.api.helpers.TextHelper");
        return function () {
            const currentHud = hudField.get(mc);
            for (const pair of [[title, titleTime], [overlay, overlayTime]]) {
                if (pair[1].getInt(currentHud) > 0) {
                    const value = pair[0].get(currentHud);
                    if (value !== null) receive(textHelper.wrap(value));
                }
            }
        };
    }

    function potato(x, y, z) {
        const chunkX = Math.floor(x / 16), chunkZ = Math.floor(z / 16);
        if (!World.isChunkLoaded(chunkX, chunkZ)) throw Error("Chunk nao carregado; macro interrompida.");
        const b = World.getBlock(x, y, z);
        return b !== null && b.getId() === "minecraft:potatoes";
    }
    function crop(x, y, z) {
        // Sobre farmland o Y dos pes pode terminar em .9375.
        return potato(x, y, z) || potato(x, y + 1, z);
    }
    function walkable(cx, cy, cz) {
        if (!World.isChunkLoaded(Math.floor(cx / 16), Math.floor(cz / 16))) return false;
        const foot = World.getBlock(cx, cy, cz), head = World.getBlock(cx, cy + 1, cz);
        const ground = World.getBlock(cx, cy - 1, cz);
        if (foot === null || head === null || ground === null) return false;
        function clear(b) {
            return ["minecraft:air", "minecraft:cave_air", "minecraft:potatoes"].indexOf(b.getId()) >= 0;
        }
        const soil = ["minecraft:farmland", "minecraft:dirt", "minecraft:grass_block", "minecraft:dirt_path"];
        return clear(foot) && clear(head) && (soil.indexOf(ground.getId()) >= 0
                || (!ground.getBlockStateHelper().isLiquid() && ground.getBlockStateHelper().isSolid()));
    }
    function blockedFor(cx, cz) {
        const key = cx + "," + cz;
        if (key !== blockedKey) { blockedKey = key; blockedTicks = 0; }
        return ++blockedTicks;
    }
    function resetBlocked() { blockedTicks = 0; blockedKey = ""; }
    function describeBlock(cx, cz) {
        function id(y) {
            const b = World.getBlock(cx, y, cz);
            return b === null ? "indisponivel" : b.getId();
        }
        return "[" + cx + "," + farmLevel + "," + cz + "] pes=" + id(farmLevel)
            + " cabeca=" + id(farmLevel + 1) + " chao=" + id(farmLevel - 1);
    }
    function pathTo(sx, sz, gx, gz, cy) {
        if (!walkable(gx, cy, gz)) return null;
        const queue = [{ x: sx, z: sz, previous: -1 }], seen = new Set([sx + "," + sz]);
        const directions = [side, { x: -side.x, z: -side.z }, forward, { x: -forward.x, z: -forward.z }];
        for (let i = 0; i < queue.length; i++) {
            const here = queue[i];
            if (here.x === gx && here.z === gz) {
                const result = [];
                for (let at = i; at >= 0; at = queue[at].previous) {
                    result.unshift({ x: queue[at].x + 0.5, z: queue[at].z + 0.5 });
                }
                return result;
            }
            for (const d of directions) {
                const nx = here.x + d.x, nz = here.z + d.z, key = nx + "," + nz;
                if (Math.abs(nx - sx) > DETOUR_RADIUS || Math.abs(nz - sz) > DETOUR_RADIUS
                        || seen.has(key) || !walkable(nx, cy, nz)) continue;
                seen.add(key); queue.push({ x: nx, z: nz, previous: i });
            }
        }
        return null;
    }
    function findRoute(p, preferNextRow) {
        const bx = Math.floor(p.getX()), bz = Math.floor(p.getZ()), cy = farmLevel;
        // Primeiro tenta retornar a mesma fileira depois do obstaculo.
        for (let d = preferNextRow ? DETOUR_RADIUS + 1 : 2; d <= DETOUR_RADIUS; d++) {
            const gx = bx + forward.x * d, gz = bz + forward.z * d;
            if (!crop(gx, cy, gz)) continue;
            const path = pathTo(bx, bz, gx, gz, cy);
            if (path !== null) {
                route = path; routeIndex = 0; reverseAfterRoute = false; phase = "route";
                Chat.log("[Batata] Contornando obstaculo para retomar a fileira.");
                return true;
            }
        }
        // Parede/fim: procura outra fileira, ainda do lado escolhido, e inverte.
        for (let lane = 1; lane <= 6; lane++) {
            for (let back = 0; back <= 2; back++) {
                const gx = bx + side.x * ROW_WIDTH * lane - forward.x * back;
                const gz = bz + side.z * ROW_WIDTH * lane - forward.z * back;
                let potatoes = false;
                for (let d = 0; d <= SCAN; d++) {
                    if (crop(gx - forward.x * d, cy, gz - forward.z * d)) potatoes = true;
                }
                if (!potatoes) continue;
                const path = pathTo(bx, bz, gx, gz, cy);
                if (path !== null) {
                    route = path; routeIndex = 0; reverseAfterRoute = true; phase = "route";
                    Chat.log("[Batata] Parede/fim: passando para outra fileira e voltando.");
                    return true;
                }
            }
        }
        return false;
    }
    function startRetreat(p) {
        if (retreatCount >= 3) return false;
        const bx = Math.floor(p.getX()), bz = Math.floor(p.getZ());
        let steps = 0;
        for (let d = 1; d <= 2; d++) {
            if (!walkable(bx - forward.x * d, farmLevel, bz - forward.z * d)) break;
            steps = d;
        }
        if (steps === 0) return false;
        const tx = bx + 0.5 - forward.x * steps, tz = bz + 0.5 - forward.z * steps;
        retreat = { x: tx, z: tz, ticks: 0 };
        lastRetreat = { x: p.getX(), z: p.getZ() };
        retreatCount++;
        phase = "retreat";
        resetBlocked(); idle = 0;
        checkpoint = { x: p.getX(), z: p.getZ() };
        Chat.log("[Batata] Sem passagem: recuando " + steps + " bloco(s) para tentar novamente.");
        return true;
    }
    function recover(p) {
        const key = Math.floor(p.getX() / 3) + "," + Math.floor(p.getZ() / 3) + ":" + forward.x + "," + forward.z;
        const visits = (recoveryVisits.get(key) || 0) + 1;
        recoveryVisits.set(key, visits);
        if (visits > 3) return false;
        return findRoute(p, false) || startRetreat(p);
    }
    function smoothLook(p, targetYaw, targetPitch) {
        const currentYaw = p.getYaw(), currentPitch = p.getPitch();
        let delta = ((targetYaw - currentYaw + 180) % 360 + 360) % 360 - 180;
        if (delta === -180) delta = 180;
        const dp = targetPitch - currentPitch;
        const aligned = Math.abs(delta) <= TURN_STEP && Math.abs(dp) <= 5;
        p.lookAt(currentYaw + Math.max(-TURN_STEP, Math.min(TURN_STEP, delta)),
            currentPitch + Math.max(-5, Math.min(5, dp)));
        if (!aligned) { idle = 0; checkpoint = { x: p.getX(), z: p.getZ() }; }
        return aligned;
    }
    function canDescend(cx, cz) {
        if (!walkable(cx, farmLevel - 1, cz)) return false;
        for (let d = 0; d <= SCAN; d++) {
            if (crop(cx + forward.x * d, farmLevel - 1, cz + forward.z * d)) return true;
        }
        return false;
    }
    function setKeys(walk, sprint) {
        const hit = Player.rayTraceBlock(4.5, false);
        KeyBind.keyBind("key.attack", hit !== null && hit.getId() === "minecraft:potatoes");
        KeyBind.keyBind("key.forward", walk);
        KeyBind.keyBind("key.back", false);
        KeyBind.keyBind("key.sprint", sprint);
        KeyBind.keyBind("key.sneak", false);
        KeyBind.keyBind("key.jump", false);
    }
    try {
        GlobalVars.putString(SALE_REQUEST, ""); GlobalVars.putString(SALE_ACK, "");
        GlobalVars.putString(SALE_STATE, "idle");
        listeners.push(JsMacros.on("Title", JavaWrapper.methodToJava(e => receive(e.message))));
        listeners.push(JsMacros.on("RecvMessage", JavaWrapper.methodToJava(e => receive(e.text))));
        try { hudReader = prepareHudReader(); }
        catch (error) { Chat.log("[Batata] Leitura direta do HUD indisponivel: " + String(error) + "; venda periodica ativa."); }
        Chat.log("[Batata] Zigue-zague v3: venda a cada 60s, descida de degrau e viradas suaves. W + Ctrl. Aperte a mesma tecla para parar.");
        while (GlobalVars.getString(RUN) === id && GlobalVars.getString(STOP) !== id) {
            const p = Player.getPlayer();
            if (!p) { reason = "desconectou"; break; }
            if (hudReader !== null) {
                try { hudReader(); }
                catch (error) { hudReader = null; Chat.log("[Batata] Leitura direta do HUD falhou; eventos continuam ativos."); }
            }
            if (saleCooldown > 0 && --saleCooldown === 0) GlobalVars.putString(SALE_STATE, "idle");
            if (sale === null && ++sinceSale >= SELL_INTERVAL && saleCooldown === 0) {
                GlobalVars.putString(SALE_REQUEST, id);
                Chat.log("[Batata] Venda periodica de reserva: enviando /farms.");
            }
            if (sale === null && GlobalVars.getString(SALE_REQUEST) === id) {
                releaseKeys();
                sale = { stage: "menu", ticks: 0, x: p.getX(), y: p.getY(), z: p.getZ() };
                GlobalVars.putString(SALE_REQUEST, ""); GlobalVars.putString(SALE_STATE, "menu");
                Chat.log("[Batata] Armazem cheio: abrindo /farms para vender.");
                Chat.say("/farms", true);
                Chat.log("[Batata] /farms enviado ao servidor.");
            }
            if (sale !== null) {
                releaseKeys();
                sale.ticks++;
                const inv = farmMenu();
                if (Hud.getOpenScreen() !== null && inv === null) {
                    reason = "menu inesperado durante a venda; nenhum clique enviado"; break;
                }
                if (sale.stage === "menu") {
                    if (inv !== null && sale.ticks >= 6) {
                        const slot = sellButton(inv);
                        if (slot >= 0) {
                            if (!inv.getHeld().isEmpty()) { reason = "item no cursor; venda cancelada sem clique"; break; }
                            sale.stage = "confirm"; sale.ticks = 0;
                            GlobalVars.putString(SALE_STATE, "confirm");
                            inv.click(slot);
                            Chat.log("[Batata] Clique em Vender Batatas enviado; aguardando confirmacao.");
                        }
                    }
                    if (sale.ticks >= 100) { reason = "menu ou botao Vender Batatas nao encontrado"; break; }
                } else if (sale.stage === "confirm") {
                    if (GlobalVars.getString(SALE_ACK) === id || (inv !== null && emptyWarehouse(inv))) {
                        if (inv !== null) inv.close();
                        sale.stage = "close"; sale.ticks = 0;
                    } else if (sale.ticks >= 100) {
                        reason = "venda sem confirmacao; colheita pausada"; break;
                    }
                } else if (Hud.getOpenScreen() === null) {
                    if (Math.hypot(p.getX() - sale.x, p.getZ() - sale.z) > 1.5 || Math.abs(p.getY() - sale.y) > 0.3) {
                        reason = "posicao mudou durante a venda; reinicie na fileira"; break;
                    }
                    sale = null; saleCooldown = 100; sinceSale = 0;
                    GlobalVars.putString(SALE_ACK, ""); GlobalVars.putString(SALE_STATE, "cooldown");
                    idle = 0; checkpoint = { x: p.getX(), z: p.getZ() };
                    Chat.log("[Batata] Venda confirmada; continuando a colheita.");
                } else if (sale.ticks >= 40) { reason = "menu de venda nao fechou"; break; }
                Client.waitTick();
                continue;
            }
            if (Hud.getOpenScreen() !== null) { reason = "menu aberto"; break; }
            const x = p.getX(), z = p.getZ(), y = Math.floor(p.getY());
            const bx = Math.floor(x), bz = Math.floor(z);
            const py = p.getY();
            if (phase !== "climb" && Math.abs(py - farmY) <= 0.15 && walkable(bx, farmLevel, bz)) {
                lastSafe = { x: bx + 0.5, z: bz + 0.5 };
            }
            if (phase !== "climb" && phase !== "descend" && py < farmY - 0.6) {
                if (py < farmY - 1.3 || lastSafe === null
                        || Math.hypot(lastSafe.x - x, lastSafe.z - z) > 3) {
                    reason = "queda sem retorno de um bloco ao alcance"; break;
                }
                climb = { target: lastSafe, resume: phase, ticks: 0, turnTicks: 0, stable: 0, previousY: py };
                phase = "climb";
                Chat.log("[Batata] Caiu um degrau: tentando pular de volta para a plantacao.");
            }
            if (phase === "descend") {
                const landed = Math.abs(py - (descent.oldY - 1)) <= 0.15
                    && Math.abs(py - descent.previousY) < 0.02 && walkable(bx, descent.level, bz);
                descent.stable = landed ? descent.stable + 1 : 0;
                descent.previousY = py;
                if (descent.stable >= 2) {
                    farmY = py; farmLevel = descent.level;
                    descent = null; phase = "row"; end = null; missing = 0;
                    lastSafe = { x: bx + 0.5, z: bz + 0.5 };
                    resetBlocked(); idle = 0; checkpoint = { x: x, z: z };
                    setKeys(false, false);
                    Chat.log("[Batata] Desceu um bloco; continuando a colheita embaixo.");
                } else if (++descent.ticks > 80 || py < descent.oldY - 1.3) {
                    reason = "nao conseguiu descer o degrau de um bloco"; break;
                } else {
                    const aligned = smoothLook(p, yaw, PITCH);
                    const distance = Math.hypot(descent.x - x, descent.z - z);
                    setKeys(aligned && distance > 0.15, false);
                }
                Client.waitTick();
                continue;
            }
            if (phase === "climb") {
                if (py < farmY - 1.3 || !walkable(Math.floor(climb.target.x), farmLevel, Math.floor(climb.target.z))) {
                    reason = "queda profunda ou ponto de retorno bloqueado"; break;
                }
                const distance = Math.hypot(climb.target.x - x, climb.target.z - z);
                const landed = Math.abs(py - farmY) <= 0.15 && Math.abs(py - climb.previousY) < 0.02
                        && distance <= 0.4 && walkable(bx, farmLevel, bz);
                climb.stable = landed ? climb.stable + 1 : 0;
                climb.previousY = py;
                if (climb.stable >= 2) {
                    phase = climb.resume; climb = null;
                    idle = 0; checkpoint = { x: x, z: z };
                    setKeys(false, false);
                    Chat.log("[Batata] Voltou para cima; continuando a colheita.");
                } else if (climb.ticks >= 80) {
                    reason = "nao conseguiu subir apos quatro tentativas de pulo"; break;
                } else {
                    const aligned = smoothLook(p, Math.atan2(-(climb.target.x - x), climb.target.z - z) * 180 / Math.PI, PITCH);
                    setKeys(aligned && distance > 0.18, false);
                    // Pulsos de pulo, liberando entre tentativas. Nao segura Shift.
                    KeyBind.keyBind("key.jump", aligned && climb.ticks % 20 < 6);
                    if (aligned) climb.ticks++;
                    else if (++climb.turnTicks > 40) { reason = "nao conseguiu alinhar para subir"; break; }
                }
                Client.waitTick();
                continue;
            }
            if (phase === "retreat") {
                setKeys(false, false);
                const remaining = (x - retreat.x) * forward.x + (z - retreat.z) * forward.z;
                if (remaining <= 0.12) {
                    retreat = null;
                    // Depois de afastar da parede, prioriza a fileira ao lado.
                    if (!findRoute(p, true) && !findRoute(p, false) && !startRetreat(p)) {
                        reason = "sem passagem apos tres recuos"; break;
                    }
                    idle = 0; checkpoint = { x: x, z: z };
                } else if (++retreat.ticks > 60) {
                    reason = "recuo bloqueado; caminho atras indisponivel"; break;
                } else {
                    const behindX = Math.floor(x - forward.x * 0.5);
                    const behindZ = Math.floor(z - forward.z * 0.5);
                    if (!walkable(behindX, farmLevel, behindZ)) {
                        reason = "recuo interrompido por bloco ou falta de chao atras"; break;
                    }
                    const aligned = smoothLook(p, yaw, PITCH);
                    KeyBind.keyBind("key.attack", false);
                    KeyBind.keyBind("key.back", aligned);
                }
                Client.waitTick();
                continue;
            }
            if (phase === "row" && lastRetreat !== null && Math.hypot(x - lastRetreat.x, z - lastRetreat.z) >= 4) {
                retreatCount = 0; lastRetreat = null;
            }
            if (phase === "row" && fieldMin === null) {
                // Registra o inicio da fileira antes de um eventual recuo/desvio.
                for (let d = -SCAN; d <= SCAN; d++) {
                    const cx = bx + fieldAxis.x * d, cz = bz + fieldAxis.z * d;
                    if (crop(cx, farmLevel, cz)) {
                        const absolute = (cx + 0.5) * fieldAxis.x + (cz + 0.5) * fieldAxis.z;
                        fieldMin = fieldMin === null ? absolute : Math.min(fieldMin, absolute);
                        fieldMax = fieldMax === null ? absolute : Math.max(fieldMax, absolute);
                    }
                }
            }
            // Usa o nivel da plantacao, nao o Y arredondado a cada oscilacao dos pes.
            if (phase === "row") {
                const ax = bx + forward.x, az = bz + forward.z;
                if (!walkable(ax, farmLevel, az)) {
                    setKeys(false, false);
                    if (canDescend(ax, az)) {
                        descent = { x: ax + 0.5, z: az + 0.5, oldY: farmY, level: farmLevel - 1, ticks: 0, stable: 0, previousY: py };
                        phase = "descend";
                        Chat.log("[Batata] Degrau com batatas abaixo: descendo sem recuar.");
                        Client.waitTick(); continue;
                    }
                    if (blockedFor(ax, az) < 3) { Client.waitTick(); continue; }
                    if (!recover(p)) { reason = "sem passagem local: " + describeBlock(ax, az); break; }
                    resetBlocked(); idle = 0; checkpoint = { x: x, z: z };
                } else resetBlocked();
            }
            if (phase === "row") {
                const facingRow = smoothLook(p, yaw, PITCH);
                let found = false;
                for (let d = 0; d <= SCAN; d++) {
                    const cx = bx + forward.x * d, cz = bz + forward.z * d;
                    if (crop(cx, y, cz)) {
                        found = true;
                        const absolute = (cx + 0.5) * fieldAxis.x + (cz + 0.5) * fieldAxis.z;
                        fieldMin = fieldMin === null ? absolute : Math.min(fieldMin, absolute);
                        fieldMax = fieldMax === null ? absolute : Math.max(fieldMax, absolute);
                    }
                }
                if (fieldMin !== null) end = forward.x * fieldAxis.x + forward.z * fieldAxis.z > 0 ? fieldMax : -fieldMin;
                missing = found ? 0 : missing + 1;
                const progress = x * forward.x + z * forward.z;
                // Nao vira cedo apenas porque o ataque ja quebrou as plantas na mira.
                if (missing >= 4 && (end === null || progress >= end - 0.15)) {
                    const tx = bx + side.x * ROW_WIDTH, tz = bz + side.z * ROW_WIDTH;
                    let nextRow = false;
                    for (let d = 0; d <= SCAN; d++) {
                        if (crop(tx - forward.x * d, y, tz - forward.z * d)) nextRow = true;
                    }
                    if (!nextRow) { reason = "nao ha batatas na proxima fileira"; break; }
                    destination = { x: tx + 0.5, z: tz + 0.5 };
                    phase = "shift";
                    idle = 0; checkpoint = { x: x, z: z };
                    setKeys(false, false);
                } else setKeys(facingRow, facingRow);
            } else if (phase === "route") {
                const point = route[routeIndex];
                if (Math.hypot(point.x - x, point.z - z) <= 0.12) {
                    routeIndex++;
                    setKeys(false, false);
                    if (routeIndex >= route.length) {
                        if (reverseAfterRoute) { yaw += 180; forward = direction(yaw); }
                        phase = "row"; end = null; missing = 0;
                    }
                } else if (!walkable(Math.floor(point.x), farmLevel, Math.floor(point.z))) {
                    setKeys(false, false);
                    const px = Math.floor(point.x), pz = Math.floor(point.z);
                    if (blockedFor(px, pz) < 10) { Client.waitTick(); continue; }
                    if (!recover(p)) { reason = "passagem bloqueada: " + describeBlock(px, pz); break; }
                    resetBlocked(); idle = 0; checkpoint = { x: x, z: z };
                } else {
                    resetBlocked();
                    const aligned = smoothLook(p, Math.atan2(-(point.x - x), point.z - z) * 180 / Math.PI, PITCH);
                    setKeys(aligned, false);
                }
            } else if (phase === "shift") {
                const remaining = (destination.x - x) * side.x + (destination.z - z) * side.z;
                if (remaining <= 0.12) {
                    yaw += 180; forward = direction(yaw);
                    phase = "row"; end = null; missing = 0;
                    setKeys(false, false);
                } else {
                    const aligned = smoothLook(p, sideYaw, PITCH);
                    setKeys(aligned, false);
                }
            }
            const moved = Math.hypot(x - checkpoint.x, z - checkpoint.z);
            if (moved >= 0.08) { checkpoint = { x: x, z: z }; idle = 0; }
            else if (++idle >= 20 && phase !== "route" && phase !== "retreat") {
                setKeys(false, false);
                if (!recover(p)) { reason = "sem passagem local para desviar ou voltar"; break; }
                idle = 0; checkpoint = { x: x, z: z };
            } else if (idle >= 60) { reason = "desvio bloqueado por 3 segundos"; break; }
            Client.waitTick();
        }
    } finally {
        for (const listener of listeners) {
            try { JsMacros.off(listener); } catch (ignored) {}
        }
        GlobalVars.putString(SALE_REQUEST, ""); GlobalVars.putString(SALE_ACK, "");
        GlobalVars.putString(SALE_STATE, "off");
        for (const key of keys) {
            try { KeyBind.keyBind(key, false); } catch (ignored) {}
        }
        GlobalVars.putString(RUN, ""); GlobalVars.putString(STOP, "");
        Chat.log("[Batata] Parada: " + reason + ".");
    }
})();
