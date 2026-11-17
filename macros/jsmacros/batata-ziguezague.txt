// JsMacros 1.21.4. Vincule a uma tecla (ex.: F6), gatilho ao pressionar.
// A mesma tecla inicia/para. Comece na primeira fileira, olhando ao longo dela.
(function () {
    const RUN = "btos.batata.zig.run", STOP = "btos.batata.zig.stop";
    const SALE_REQUEST = RUN + ".sale", SALE_ACK = RUN + ".sold", SALE_STATE = RUN + ".saleState";
    const PRODUCTS = {
        batata: { button: "Vender Batatas", singular: "batata" },
        cenoura: { button: "Vender Cenouras", singular: "cenoura" }
    };
    const SALE_PRODUCT = RUN + ".saleProduct";
    const PITCH = 55;
    const REVERSE_FIELD_SWEEP = true; // Zigue-zague de ida e de volta pelo conjunto de fileiras.
    const RETURN_SAME_ROW = false; // Opcao antiga: repetir somente uma linha.
    const CACHE_BLOCKS = true;
    const CONTINUOUS = true; // Espera e tenta recuperar, em vez de encerrar por falta de passagem.
    const RETRY_TICKS = 60; // 3 segundos entre novas tentativas.
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
        Chat.log("[Colheita] Entre no mundo e feche os menus."); return;
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
    let edgeExitCompleted = false;
    // Mantem sempre o mesmo lado global, mesmo depois de inverter o percurso.
    const side = { x: -forward.z * SIDE, z: forward.x * SIDE };
    let sideYaw = Math.atan2(-side.x, side.z) * 180 / Math.PI;
    let phase = "row", destination = null, end = null;
    let route = [], routeIndex = 0, routeOrigin = null, reverseAfterRoute = false;
    let blockedTicks = 0, blockedKey = "";
    let retreat = null, retreatCount = 0, lastRetreat = null;
    let missing = 0, idle = 0, checkpoint = { x: first.getX(), z: first.getZ() };
    let farmY = first.getY(), farmLevel = Math.ceil(farmY - 0.01);
    let lastSafe = null, climb = null;
    const recoveryVisits = new Map();
    let sale = null, saleCooldown = 0, hudReader = null;
    let lastHudNotice = "";
    const listeners = [];
    const blockCache = new Map(), chunkCache = new Map();
    let cycle = 0;
    let waitingTicks = 0, lastPauseNote = "", disconnected = false;
    let reason = "desativada";
    GlobalVars.putString(RUN, id); GlobalVars.putString(STOP, "");

    function plain(text) {
        return String(text).replace(/§[0-9a-fk-orx]/gi, "").normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "").replace(/[\u200B-\u200D\uFEFF]/g, "").toLowerCase().trim();
    }
    function releaseKeys() {
        for (const key of keys) KeyBind.keyBind(key, false);
    }
    function textString(text) {
        if (text === null || text === undefined) return "";
        if (typeof text === "string") return text;
        if (typeof text.getString === "function") return String(text.getString());
        throw new Error("Objeto de texto sem getString: " + String(text));
    }
    function supportedCrop(id) {
        return id === "minecraft:potatoes" || id === "minecraft:carrots";
    }
    function farmProduct(inv) {
        const match = /^fazenda de (batatas?|cenouras?)$/.exec(plain(inv.getContainerTitle()));
        return match === null ? null : match[1].startsWith("batata") ? PRODUCTS.batata : PRODUCTS.cenoura;
    }
    function receive(text) {
        if (text === null || text === undefined || GlobalVars.getString(RUN) !== id) return;
        const message = plain(textString(text));
        const state = GlobalVars.getString(SALE_STATE);
        const compact = message.replace(/[^a-z]/g, "");
        if (state === "idle" && /armazem(?:esta)?cheio/.test(compact)) {
            GlobalVars.putString(SALE_REQUEST, id);
            if (message !== lastHudNotice) {
                lastHudNotice = message;
                Chat.log("[Colheita] Aviso reconhecido: " + message.slice(0, 160));
            }
        }
        if (state === "confirm" && message.indexOf(GlobalVars.getString(SALE_PRODUCT) || "batata") >= 0
                && /vendid|vendeu|venda (?:realizada|efetuada|concluida)/.test(message)
                && !/nao |erro|falh|insuficiente/.test(message)) GlobalVars.putString(SALE_ACK, id);
    }
    function farmMenu() {
        if (Hud.getOpenScreen() === null) return null;
        const inv = Player.openInventory();
        return farmProduct(inv) !== null ? inv : null;
    }
    function sellButton(inv) {
        const matches = [];
        const product = farmProduct(inv);
        if (product === null) return -1;
        // Somente o menu superior: nunca pesquisa itens do inventario do jogador.
        for (const slot of inv.getSlots("container")) {
            const item = inv.getSlot(slot);
            if (!item.isEmpty() && plain(item.getName().getString()) === plain(product.button)) matches.push(slot);
        }
        return matches.length === 1 ? matches[0] : -1;
    }
    function warehouseQuantity(inv, preferredSlot) {
        const slot = sellButton(inv);
        const target = slot >= 0 ? slot : preferredSlot;
        if (target === null || target === undefined || target < 0) return null;
        const item = inv.getSlot(target);
        if (item.isEmpty()) return null;
        const lines = [plain(item.getName().getString())];
        for (const line of item.getLore()) lines.push(plain(line.getString()));
        for (const line of lines) {
            if (/armazem vazio|nenhuma (?:batata|cenoura)|sem (?:batatas|cenouras)/.test(line)) return 0;
            const match = /quantidade\s*:\s*([0-9][0-9.,]*)\s+(?:batatas?|cenouras?)\b/.exec(line);
            if (match) return Number(match[1].replace(/[.,]/g, ""));
        }
        return null;
    }

    function prepareHudReader() {
        const mc = Client.getMinecraft();
        function field(object, names, optional) {
            for (const name of names) {
                try {
                    const f = Reflection.getDeclaredField(object.getClass(), name);
                    f.setAccessible(true); return f;
                } catch (ignored) {}
            }
            if (optional) return null;
            throw new Error("Campo nao encontrado: " + names.join(" / "));
        }
        const hudField = field(mc, ["field_1705", "inGameHud"], false);
        const hud = hudField.get(mc);
        const probes = [];
        for (const spec of [
            ["titulo", ["field_2016", "title"], ["field_2023", "titleRemainTicks"]],
            ["actionbar", ["field_2018", "overlayMessage"], ["field_2041", "overlayRemaining"]],
            ["subtitulo", ["field_2039", "subtitle"], ["field_2023", "titleRemainTicks"]]
        ]) {
            const value = field(hud, spec[1], true), timer = field(hud, spec[2], true);
            if (value !== null && timer !== null) probes.push({ name: spec[0], value: value, timer: timer });
        }
        if (probes.length === 0) throw new Error("Nenhum campo de titulo/actionbar disponivel");
        Chat.log("[Colheita] Leitor HUD v11 ativo: " + probes.map(p => p.name).join(", ") + ".");
        let lastSample = "", lastError = "";
        return function () {
            const currentHud = hudField.get(mc);
            const samples = [];
            for (const probe of probes) {
                try {
                    if (probe.timer.getInt(currentHud) <= 0) continue;
                    const value = probe.value.get(currentHud);
                    if (value === null) continue;
                    const sample = textString(value);
                    samples.push(probe.name + ": " + sample);
                    receive(sample);
                } catch (error) {
                    const diagnostic = probe.name + ": " + String(error);
                    if (diagnostic !== lastError) {
                        lastError = diagnostic;
                        Chat.log("[Colheita] Erro ao ler HUD: " + diagnostic);
                    }
                }
            }
            const sample = samples.join(" | ");
            if (sample && sample !== lastSample && plain(sample).indexOf("armaz") >= 0) {
                lastSample = sample;
                if (/armazem|vender/.test(plain(sample))) Chat.log("[Colheita] Texto HUD lido: " + sample.slice(0, 220));
            }
        };
    }

    function blockAt(x, y, z) {
        if (!CACHE_BLOCKS) return World.getBlock(x, y, z);
        const key = x + "," + y + "," + z;
        if (!blockCache.has(key)) blockCache.set(key, World.getBlock(x, y, z));
        return blockCache.get(key);
    }
    function chunkLoaded(x, z) {
        const key = x + "," + z;
        if (!chunkCache.has(key)) chunkCache.set(key, World.isChunkLoaded(x, z));
        return chunkCache.get(key);
    }
    function groundSupported(cx, cy, cz) {
        const ground = blockAt(cx, cy - 1, cz);
        if (ground === null) return false;
        const soil = ["minecraft:farmland", "minecraft:dirt", "minecraft:grass_block", "minecraft:dirt_path"];
        return soil.indexOf(ground.getId()) >= 0
            || (!ground.getBlockStateHelper().isLiquid() && ground.getBlockStateHelper().isSolid());
    }
    function potato(x, y, z) {
        const chunkX = Math.floor(x / 16), chunkZ = Math.floor(z / 16);
        if (!chunkLoaded(chunkX, chunkZ)) {
            if (CONTINUOUS) return false;
            throw Error("Chunk nao carregado; macro interrompida.");
        }
        const b = blockAt(x, y, z);
        return b !== null && supportedCrop(b.getId());
    }
    function crop(x, y, z) {
        // Sobre farmland o Y dos pes pode terminar em .9375.
        return potato(x, y, z) || potato(x, y + 1, z);
    }
    function walkable(cx, cy, cz) {
        if (!chunkLoaded(Math.floor(cx / 16), Math.floor(cz / 16))) return false;
        const foot = blockAt(cx, cy, cz), head = blockAt(cx, cy + 1, cz);
        if (foot === null || head === null) return false;
        function clear(b) {
            return ["minecraft:air", "minecraft:cave_air", "minecraft:potatoes", "minecraft:carrots"].indexOf(b.getId()) >= 0;
        }
        return clear(foot) && clear(head) && groundSupported(cx, cy, cz);
    }
    function blockedFor(cx, cz) {
        const key = cx + "," + cz;
        if (key !== blockedKey) { blockedKey = key; blockedTicks = 0; }
        return ++blockedTicks;
    }
    function resetBlocked() { blockedTicks = 0; blockedKey = ""; }
    function describeBlock(cx, cz) {
        function id(y) {
            const b = blockAt(cx, y, cz);
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
                for (let at = i; queue[at].previous >= 0; at = queue[at].previous) {
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
        // Obstaculo no meio: somente desloca para uma lateral livre e segue em frente.
        if (!preferNextRow) {
            for (const sign of [1, -1]) {
                const path = [];
                for (let offset = 1; offset <= 3; offset++) {
                    const gx = bx + side.x * sign * offset, gz = bz + side.z * sign * offset;
                    if (!walkable(gx, cy, gz)) break;
                    path.push({ x: gx + 0.5, z: gz + 0.5 });
                    let ahead = false;
                    for (let d = 1; d <= SCAN; d++) {
                        if (crop(gx + forward.x * d, cy, gz + forward.z * d)) ahead = true;
                    }
                    if (!ahead || !walkable(gx + forward.x, cy, gz + forward.z)) continue;
                    route = path; routeIndex = 0; routeOrigin = { x: p.getX(), z: p.getZ() };
                    reverseAfterRoute = false; phase = "route";
                    Chat.log("[Colheita] Obstaculo: desviando para a lateral e seguindo em frente.");
                    return true;
                }
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
                if (!potatoes || !walkable(gx - forward.x, cy, gz - forward.z)) continue;
                const path = pathTo(bx, bz, gx, gz, cy);
                if (path !== null) {
                    route = path; routeIndex = 0; routeOrigin = { x: p.getX(), z: p.getZ() }; reverseAfterRoute = true; phase = "route";
                    Chat.log("[Colheita] Parede/fim: passando para outra fileira e voltando.");
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
        Chat.log("[Colheita] Sem passagem: recuando " + steps + " bloco(s) para tentar novamente.");
        return true;
    }
    function recover(p, nextRowOnly) {
        const key = Math.floor(p.getX() / 3) + "," + Math.floor(p.getZ() / 3) + ":" + forward.x + "," + forward.z;
        const visits = (recoveryVisits.get(key) || 0) + 1;
        recoveryVisits.set(key, visits);
        if (visits > 3) return false;
        return findRoute(p, !!nextRowOnly) || startRetreat(p);
    }
    function pauseWork(note, p) {
        if (!CONTINUOUS) return false;
        releaseKeys();
        phase = "waiting"; waitingTicks = 0;
        route = []; retreat = null; climb = null; sale = null;
        saleCooldown = 100; GlobalVars.putString(SALE_STATE, "cooldown");
        if (note !== lastPauseNote) {
            lastPauseNote = note;
            Chat.log("[Colheita] Aguardando recuperacao automatica: " + note);
        }
        return true;
    }
    function findNearbyWork(p) {
        const bx = Math.floor(p.getX()), bz = Math.floor(p.getZ());
        for (let r = 1; r <= DETOUR_RADIUS; r++) {
            for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
                if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
                if (!crop(bx + dx, farmLevel, bz + dz) || !walkable(bx + dx, farmLevel, bz + dz)) continue;
                const path = pathTo(bx, bz, bx + dx, bz + dz, farmLevel);
                if (path === null || path.length === 0) continue;
                route = path; routeIndex = 0; routeOrigin = { x: p.getX(), z: p.getZ() };
                reverseAfterRoute = false; phase = "route";
                return true;
            }
        }
        return false;
    }
    function calibrateStartingHeight(p) {
        const bx = Math.floor(p.getX()), bz = Math.floor(p.getZ());
        const under = blockAt(bx, farmLevel - 1, bz);
        // Diagnostico observado: pes=air e chao=potatoes. Isso e altura inicial errada.
        if (under !== null && supportedCrop(under.getId()) && walkable(bx, farmLevel - 1, bz)) {
            farmLevel--;
            farmY = Math.min(p.getY(), farmLevel - 0.0625);
            Chat.log("[Colheita] Altura inicial corrigida: a planta nao e o chao.");
        }
    }
    function upperSideScore(p, sign) {
        const bx = Math.floor(p.getX()), bz = Math.floor(p.getZ());
        let score = 0;
        // Compara apenas fileiras ligadas ao patamar atual; nao pontua ilhas
        // do outro lado de um degrau/gap como se fossem continuacao acessivel.
        for (let lane = 1; lane <= 3; lane++) {
            const gx = bx + side.x * sign * ROW_WIDTH * lane;
            const gz = bz + side.z * sign * ROW_WIDTH * lane;
            if (!walkable(gx, farmLevel, gz)) break;
            for (let d = 0; d <= SCAN; d++) {
                const cx = gx + forward.x * d, cz = gz + forward.z * d;
                if (walkable(cx, farmLevel, cz) && crop(cx, farmLevel, cz)) score++;
            }
        }
        return score;
    }
    function chooseUpperContinuation(p) {
        const keep = upperSideScore(p, 1), other = upperSideScore(p, -1);
        if (other > keep) {
            side.x = -side.x; side.z = -side.z;
            sideYaw = Math.atan2(-side.x, side.z) * 180 / Math.PI;
            Chat.log("[Colheita] Lado do percurso corrigido para as fileiras do patamar superior.");
        }
    }
    function reverseFieldBoundary(p, isDrop) {
        // No degrau, usa a fileira atual para sair uma vez. No outro limite,
        // deve tentar a proxima fileira antes de inverter de novo.
        if (isDrop && !edgeExitCompleted) {
            if (!reverseSameRow(p, "Degrau; retorno de saida")) return false;
            edgeExitCompleted = true;
            chooseUpperContinuation(p);
            return true;
        }
        if (findRoute(p, true)) {
            return true;
        }
        // Acabaram as fileiras desse lado: inverte o sentido lateral do percurso.
        // Retorna pela ultima fileira e passa a revisitar as anteriores.
        if (!reverseSameRow(p, "Limite das fileiras; invertendo o percurso")) return false;
        side.x = -side.x; side.z = -side.z;
        sideYaw = Math.atan2(-side.x, side.z) * 180 / Math.PI;
        Chat.log("[Colheita] Percurso invertido: continuara pelas fileiras do outro lado.");
        return true;
    }
    function resumeSameRow(p) {
        if (fieldMin !== null) return reverseSameRow(p, "Retomada");
        const bx = Math.floor(p.getX()), bz = Math.floor(p.getZ());
        for (let d = -SCAN; d <= SCAN; d++) {
            if (crop(bx + fieldAxis.x * d, farmLevel, bz + fieldAxis.z * d)) {
                phase = "row"; missing = 0; end = null;
                return true;
            }
        }
        return false;
    }
    function reverseSameRow(p, note) {
        const bx = Math.floor(p.getX()), bz = Math.floor(p.getZ());
        if (!walkable(bx - forward.x, farmLevel, bz - forward.z)) return false;
        releaseKeys();
        yaw += 180; forward = direction(yaw);
        phase = "turnback"; missing = 0; end = null;
        route = []; retreat = null; resetBlocked();
        idle = 0; checkpoint = { x: p.getX(), z: p.getZ() };
        Chat.log("[Colheita] " + note + ": voltando pela mesma fileira.");
        return true;
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
    function setKeys(walk, sprint) {
        const hit = phase === "row" && walk ? Player.rayTraceBlock(4.5, false) : null;
        KeyBind.keyBind("key.attack", phase === "row" && walk && hit !== null && supportedCrop(hit.getId()) && hit.getY() === farmLevel);
        KeyBind.keyBind("key.forward", walk);
        KeyBind.keyBind("key.back", false);
        KeyBind.keyBind("key.sprint", sprint);
        KeyBind.keyBind("key.sneak", false);
        KeyBind.keyBind("key.jump", false);
    }
    try {
        GlobalVars.putString(SALE_REQUEST, ""); GlobalVars.putString(SALE_ACK, "");
        GlobalVars.putString(SALE_STATE, "idle");
        GlobalVars.putString(SALE_PRODUCT, "");
        listeners.push(JsMacros.on("Title", JavaWrapper.methodToJava(e => receive(e.message))));
        listeners.push(JsMacros.on("RecvMessage", JavaWrapper.methodToJava(e => receive(e.text))));
        try { hudReader = prepareHudReader(); }
        catch (error) { Chat.log("[Colheita] Leitura direta do HUD indisponivel: " + String(error) + "; monitorando eventos de texto."); }
        calibrateStartingHeight(first);
        Chat.log("[Colheita] Zigue-zague v11: batata e cenoura, retorno de saida e zigue-zague no patamar superior. W + Ctrl. Aperte a mesma tecla para parar.");
        while (GlobalVars.getString(RUN) === id && GlobalVars.getString(STOP) !== id) {
            blockCache.clear(); chunkCache.clear(); cycle++;
            const p = Player.getPlayer();
            if (!p) {
                if (!CONTINUOUS) { reason = "desconectou"; break; }
                releaseKeys(); disconnected = true;
                Client.waitTick(); continue;
            }
            if (disconnected) {
                disconnected = false;
                pauseWork("Conexao voltou; verificando a plantacao antes de retomar", p);
            }
            if (hudReader !== null && (cycle % 4 === 1 || sale !== null)) {
                try { hudReader(); }
                catch (error) { hudReader = null; Chat.log("[Colheita] Leitura direta do HUD falhou: " + String(error) + "; eventos continuam ativos."); }
            }
            if (saleCooldown > 0 && --saleCooldown === 0) GlobalVars.putString(SALE_STATE, "idle");
            if (sale === null && GlobalVars.getString(SALE_REQUEST) === id) {
                releaseKeys();
                sale = { stage: "menu", ticks: 0, x: p.getX(), y: p.getY(), z: p.getZ() };
                GlobalVars.putString(SALE_REQUEST, ""); GlobalVars.putString(SALE_STATE, "menu");
                Chat.log("[Colheita] Armazem cheio: abrindo /farms para vender.");
                Chat.say("/farms", true);
                Chat.log("[Colheita] /farms enviado ao servidor.");
            }
            if (sale !== null) {
                releaseKeys();
                sale.ticks++;
                const inv = farmMenu();
                if (Hud.getOpenScreen() !== null && inv === null) {
                    reason = "menu inesperado durante a venda; nenhum clique enviado"; if (!pauseWork(reason, p)) break; Client.waitTick(); continue;
                }
                if (sale.stage === "menu") {
                    if (inv !== null && sale.ticks >= 6) {
                        const slot = sellButton(inv);
                        if (slot >= 0) {
                            if (!inv.getHeld().isEmpty()) { reason = "item no cursor; venda cancelada sem clique"; if (!pauseWork(reason, p)) break; Client.waitTick(); continue; }
                            const product = farmProduct(inv);
                            sale.button = product.button;
                            GlobalVars.putString(SALE_PRODUCT, product.singular);
                            sale.slot = slot; sale.before = warehouseQuantity(inv, slot);
                            sale.confirmed = false; sale.stage = "confirm"; sale.ticks = 0;
                            GlobalVars.putString(SALE_STATE, "confirm");
                            inv.click(slot);
                            Chat.log("[Colheita] Clique em " + sale.button + " enviado; aguardando confirmacao.");
                        }
                    }
                    if (sale.ticks >= 100) {
                        if (inv !== null) inv.close();
                        reason = "botao " + (inv !== null ? farmProduct(inv).button : "Vender Batatas") + " nao encontrado; menu fechado"; if (!pauseWork(reason, p)) break; Client.waitTick(); continue;
                    }
                } else if (sale.stage === "confirm") {
                    const after = inv === null ? null : warehouseQuantity(inv, sale.slot);
                    sale.confirmed = GlobalVars.getString(SALE_ACK) === id || after === 0
                        || (sale.before !== null && after !== null && after < sale.before);
                    // Alguns servidores nao atualizam a descricao nem enviam recibo.
                    // Fecha apos o clique, sem chamar a venda de confirmada nesses casos.
                    if (sale.confirmed || sale.ticks >= 20) {
                        if (inv !== null) inv.close();
                        sale.stage = "close"; sale.ticks = 0;
                    }
                } else if (Hud.getOpenScreen() === null) {
                    if (Math.hypot(p.getX() - sale.x, p.getZ() - sale.z) > 1.5 || Math.abs(p.getY() - sale.y) > 0.3) {
                        reason = "posicao mudou durante a venda; reinicie na fileira"; if (!pauseWork(reason, p)) break; Client.waitTick(); continue;
                    }
                    const confirmed = sale.confirmed, soldButton = sale.button;
                    sale = null; saleCooldown = 100;
                    GlobalVars.putString(SALE_ACK, ""); GlobalVars.putString(SALE_STATE, "cooldown");
                    idle = 0; checkpoint = { x: p.getX(), z: p.getZ() };
                    Chat.log(confirmed ? "[Colheita] Venda confirmada; menu fechado e colheita retomada."
                        : "[Colheita] Menu fechado apos clicar em " + soldButton + "; retomando sem confirmacao do saldo.");
                } else if (sale.ticks >= 40) { reason = "menu de venda nao fechou"; if (!pauseWork(reason, p)) break; Client.waitTick(); continue; }
                Client.waitTick();
                continue;
            }
            if (Hud.getOpenScreen() !== null) {
                if (!CONTINUOUS) { reason = "menu aberto"; break; }
                releaseKeys(); Client.waitTick(); continue;
            }
            const x = p.getX(), z = p.getZ(), y = Math.floor(p.getY());
            const bx = Math.floor(x), bz = Math.floor(z);
            const py = p.getY();
            if (phase === "waiting") {
                releaseKeys();
                if (++waitingTicks >= RETRY_TICKS) {
                    waitingTicks = 0;
                    // Nao caminha para fora do patamar ou em outro local apos reconectar.
                    if (Math.abs(py - farmY) <= 0.2 && walkable(bx, farmLevel, bz)) {
                        recoveryVisits.clear(); retreatCount = 0; lastRetreat = null; resetBlocked();
                        if (!REVERSE_FIELD_SWEEP) {
                            side.x = -side.x; side.z = -side.z;
                            sideYaw = Math.atan2(-side.x, side.z) * 180 / Math.PI;
                        }
                        if ((REVERSE_FIELD_SWEEP && (fieldMin !== null ? reverseFieldBoundary(p, false) : findNearbyWork(p)))
                                || (!REVERSE_FIELD_SWEEP && RETURN_SAME_ROW && resumeSameRow(p))
                                || (!REVERSE_FIELD_SWEEP && !RETURN_SAME_ROW && (findRoute(p, true) || findNearbyWork(p)))) {
                            idle = 0; checkpoint = { x: x, z: z };
                            Chat.log("[Colheita] Passagem/batatas encontradas; retomando automaticamente.");
                        }
                    }
                }
                Client.waitTick(); continue;
            }
            if (phase !== "climb" && Math.abs(py - farmY) <= 0.15 && walkable(bx, farmLevel, bz)) {
                lastSafe = { x: bx + 0.5, z: bz + 0.5 };
            }
            if (phase !== "climb" && py < farmY - 0.6) {
                if (py < farmY - 1.3 || lastSafe === null
                        || Math.hypot(lastSafe.x - x, lastSafe.z - z) > 3) {
                    reason = "queda sem retorno de um bloco ao alcance"; if (!pauseWork(reason, p)) break; Client.waitTick(); continue;
                }
                climb = { target: lastSafe, resume: phase, ticks: 0, turnTicks: 0, stable: 0, previousY: py };
                phase = "climb";
                Chat.log("[Colheita] Caiu um degrau: tentando pular de volta para a plantacao.");
            }
            if (phase === "turnback") {
                releaseKeys();
                if (smoothLook(p, yaw, PITCH)) phase = "row";
                Client.waitTick(); continue;
            }
            if (phase === "climb") {
                if (py < farmY - 1.3 || !walkable(Math.floor(climb.target.x), farmLevel, Math.floor(climb.target.z))) {
                    reason = "queda profunda ou ponto de retorno bloqueado"; if (!pauseWork(reason, p)) break; Client.waitTick(); continue;
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
                    Chat.log("[Colheita] Voltou para cima; continuando a colheita.");
                } else if (climb.ticks >= 80) {
                    reason = "nao conseguiu subir apos quatro tentativas de pulo"; if (!pauseWork(reason, p)) break; Client.waitTick(); continue;
                } else {
                    const aligned = smoothLook(p, Math.atan2(-(climb.target.x - x), climb.target.z - z) * 180 / Math.PI, PITCH);
                    setKeys(aligned && distance > 0.18, false);
                    // Pulsos de pulo, liberando entre tentativas. Nao segura Shift.
                    KeyBind.keyBind("key.jump", aligned && climb.ticks % 20 < 6);
                    if (aligned) climb.ticks++;
                    else if (++climb.turnTicks > 40) { reason = "nao conseguiu alinhar para subir"; if (!pauseWork(reason, p)) break; Client.waitTick(); continue; }
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
                        reason = "sem passagem apos tres recuos"; if (!pauseWork(reason, p)) break; Client.waitTick(); continue;
                    }
                    idle = 0; checkpoint = { x: x, z: z };
                } else if (++retreat.ticks > 60) {
                    reason = "recuo bloqueado; caminho atras indisponivel"; if (!pauseWork(reason, p)) break; Client.waitTick(); continue;
                } else {
                    const behindX = Math.floor(x - forward.x * 0.5);
                    const behindZ = Math.floor(z - forward.z * 0.5);
                    if (!walkable(behindX, farmLevel, behindZ)) {
                        reason = "recuo interrompido por bloco ou falta de chao atras"; if (!pauseWork(reason, p)) break; Client.waitTick(); continue;
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
                    if (blockedFor(ax, az) < 3) { Client.waitTick(); continue; }
                    let cropsBeyond = false;
                    for (let d = 1; d <= SCAN; d++) {
                        if (crop(ax + forward.x * d, farmLevel, az + forward.z * d)) cropsBeyond = true;
                    }
                    if (REVERSE_FIELD_SWEEP && (!groundSupported(ax, farmLevel, az) || !cropsBeyond)) {
                        if (!reverseFieldBoundary(p, !groundSupported(ax, farmLevel, az))) {
                            reason = "sem retorno seguro para inverter o percurso";
                            if (!pauseWork(reason, p)) break;
                        }
                        Client.waitTick(); continue;
                    }
                    if (RETURN_SAME_ROW && (!groundSupported(ax, farmLevel, az) || !cropsBeyond)) {
                        if (!reverseSameRow(p, "Beirada/limite")) {
                            reason = "sem espaco para retornar na mesma fileira";
                            if (!pauseWork(reason, p)) break;
                        }
                        Client.waitTick(); continue;
                    }
                    // Sem batatas no mesmo nivel depois do bloqueio: parede ou beirada.
                    // Prioriza a proxima fileira em vez de limpar os cantos.
                    if (!recover(p, !cropsBeyond)) { reason = "sem passagem no nivel superior: " + describeBlock(ax, az); if (!pauseWork(reason, p)) break; Client.waitTick(); continue; }
                    resetBlocked(); idle = 0; checkpoint = { x: x, z: z };
                } else resetBlocked();
            }
            if (phase === "row") {
                const facingRow = smoothLook(p, yaw, PITCH);
                let found = false;
                for (let d = 0; d <= SCAN; d++) {
                    const cx = bx + forward.x * d, cz = bz + forward.z * d;
                    if (crop(cx, farmLevel, cz)) {
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
                    setKeys(false, false);
                    if (REVERSE_FIELD_SWEEP && end !== null) {
                        if (!reverseFieldBoundary(p, false)) {
                            reason = "sem retorno seguro no final do percurso";
                            if (!pauseWork(reason, p)) break;
                        }
                        Client.waitTick(); continue;
                    }
                    if (RETURN_SAME_ROW && end !== null) {
                        if (!reverseSameRow(p, "Fim do percurso")) {
                            reason = "sem espaco para retornar no limite";
                            if (!pauseWork(reason, p)) break;
                        }
                        Client.waitTick(); continue;
                    }
                    if (!findRoute(p, true)) { reason = "nao ha batatas na proxima fileira no mesmo nivel"; if (!pauseWork(reason, p)) break; Client.waitTick(); continue; }
                    idle = 0; checkpoint = { x: x, z: z };
                } else setKeys(facingRow, facingRow);
            } else if (phase === "route") {
                const point = route[routeIndex];
                const origin = routeIndex === 0 ? routeOrigin : route[routeIndex - 1];
                const dx = point.x - origin.x, dz = point.z - origin.z;
                const length = Math.hypot(dx, dz);
                const along = length > 0 ? ((point.x - x) * dx + (point.z - z) * dz) / length : 0;
                const across = length > 0 ? Math.abs((x - origin.x) * dz - (z - origin.z) * dx) / length : Infinity;
                const passed = length > 0 && along <= 0.12 && along >= -0.4 && across <= 0.2;
                if (Math.hypot(point.x - x, point.z - z) <= 0.12 || passed) {
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
                    if (!recover(p)) { reason = "passagem bloqueada: " + describeBlock(px, pz); if (!pauseWork(reason, p)) break; Client.waitTick(); continue; }
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
                if (!recover(p)) { reason = "sem passagem local para desviar ou voltar"; if (!pauseWork(reason, p)) break; Client.waitTick(); continue; }
                idle = 0; checkpoint = { x: x, z: z };
            } else if (idle >= 60) { reason = "desvio bloqueado por 3 segundos"; if (!pauseWork(reason, p)) break; Client.waitTick(); continue; }
            Client.waitTick();
        }
    } finally {
        for (const listener of listeners) {
            try { JsMacros.off(listener); } catch (ignored) {}
        }
        GlobalVars.putString(SALE_REQUEST, ""); GlobalVars.putString(SALE_ACK, "");
        GlobalVars.putString(SALE_STATE, "off");
        GlobalVars.putString(SALE_PRODUCT, "");
        for (const key of keys) {
            try { KeyBind.keyBind(key, false); } catch (ignored) {}
        }
        GlobalVars.putString(RUN, ""); GlobalVars.putString(STOP, "");
        Chat.log("[Colheita] Parada: " + reason + ".");
    }
})();
