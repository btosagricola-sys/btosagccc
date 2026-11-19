// JsMacros 1.21.4. Vincule a uma tecla (ex.: F6), gatilho ao pressionar.
// A mesma tecla inicia/para. Comece na primeira fileira, olhando ao longo dela.
(function () {
    const RUN = "btos.batata.zig.run", STOP = "btos.batata.zig.stop";
    const SALE_REQUEST = RUN + ".sale", SALE_ACK = RUN + ".sold", SALE_STATE = RUN + ".saleState";
    const PRODUCTS = {
        batata: { button: "Vender Batatas", singular: "batata" },
        trigo: { button: "Vender Trigo", singular: "trigo", aliases: ["vender trigo", "vender trigos"] },
        cenoura: { button: "Vender Cenouras", singular: "cenoura" },
        fungo: { button: "Vender Fungos", singular: "fungo", aliases: [
            "vender fungo", "vender fungos", "vender fungo do nether", "vender fungos do nether"
        ] }
    };
    const SALE_PRODUCT = RUN + ".saleProduct";
    const AREA = { enabled: true, minX: 5919, maxX: 5951, minZ: 5861, maxZ: 6039, cropY: 121 };
    const FREE_ROAM = true; // Caminha em direcoes variadas dentro da area segura.
    const roam = { targets: [], goal: null, age: 0, visits: new Map(), last: "", stuck: 0, x: 0, z: 0 };
    const HARVEST_WIDTH = 2; // Faixa central e uma vizinha, sem pausa para colher.
    const RANDOM_ROWS = true; // Embaralha as fileiras sem repetir antes de completar o ciclo.
    let rowDeck = [];
    const PITCH = 30; // Camera mais levantada: mira adiante na mesma fileira.
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
    function insideArea(x, z) {
        return x >= AREA.minX && x <= AREA.maxX && z >= AREA.minZ && z <= AREA.maxZ;
    }
    if (AREA.enabled && (!insideArea(Math.floor(first.getX()), Math.floor(first.getZ()))
            || Math.abs(first.getY() - (AREA.cropY - 0.0625)) > 0.35)) {
        Chat.log("[Colheita] Entre na faixa X " + AREA.minX + " a " + AREA.maxX
            + ", Z " + AREA.minZ + " a " + AREA.maxZ + ", no nivel das plantas Y " + AREA.cropY + ".");
        return;
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
    let farmY = first.getY(), farmLevel = AREA.enabled ? AREA.cropY : Math.ceil(farmY - 0.01);
    let lastSafe = null, climb = null;
    const recoveryVisits = new Map();
    const boundaryMisses = new Map();
    const escapeVisits = new Map();
    const cornerFailures = [], avoidedCorners = [];
    let cornerExitActive = false;
    let sale = null, saleCooldown = 0, hudReader = null;
    let lastHudNotice = "";
    const listeners = [];
    const blockCache = new Map(), chunkCache = new Map();
    let cycle = 0;
    let waitingTicks = 0, lastPauseNote = "", disconnected = false;
    const areaRun = {
        column: Math.floor(first.getX()), step: first.getX() < (AREA.minX + AREA.maxX + 1) / 2 ? 1 : -1,
        direction: Math.cos(first.getYaw() * Math.PI / 180) >= 0 ? 1 : -1,
        stage: "seek", anchor: Math.floor(first.getZ()), candidates: null, scan: 0,
        search: null, points: [], point: 0, tries: 0, idle: 0, lastX: first.getX(), lastZ: first.getZ(), note: ""
    };
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
        return ["minecraft:potatoes", "minecraft:carrots", "minecraft:wheat", "minecraft:nether_wart",
            "minecraft:crimson_fungus", "minecraft:warped_fungus"].indexOf(id) >= 0;
    }
    function farmProduct(inv) {
        const match = /^fazenda de (batatas?|cenouras?|trigos?|fungos?(?: do nether)?)$/.exec(plain(inv.getContainerTitle()));
        if (match === null) return null;
        return match[1].startsWith("batata") ? PRODUCTS.batata
            : match[1].startsWith("cenoura") ? PRODUCTS.cenoura
            : match[1].startsWith("trigo") ? PRODUCTS.trigo : PRODUCTS.fungo;
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
            if (!item.isEmpty()) {
                const name = plain(item.getName().getString());
                if (name === plain(product.button) || (product.aliases && product.aliases.indexOf(name) >= 0)) matches.push(slot);
            }
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
            if (/armazem vazio|nenhuma? (?:batata|cenoura|trigo|fungo)|sem (?:batatas|cenouras|trigos?|fungos)/.test(line)) return 0;
            const match = /quantidade\s*:\s*([0-9][0-9.,]*)\s+(?:batatas?|cenouras?|trigos?|fungos?)\b/.exec(line);
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
        Chat.log("[Colheita] Leitor HUD v21 ativo: " + probes.map(p => p.name).join(", ") + ".");
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
        const soil = ["minecraft:farmland", "minecraft:dirt", "minecraft:grass_block", "minecraft:dirt_path",
            "minecraft:soul_sand", "minecraft:crimson_nylium", "minecraft:warped_nylium"];
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
        if (AREA.enabled && !insideArea(cx, cz)) return false;
        if (!chunkLoaded(Math.floor(cx / 16), Math.floor(cz / 16))) return false;
        const foot = blockAt(cx, cy, cz), head = blockAt(cx, cy + 1, cz);
        if (foot === null || head === null) return false;
        function clear(b) {
            return b.getId() === "minecraft:air" || b.getId() === "minecraft:cave_air" || supportedCrop(b.getId());
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
    function avoidedCorner(cx, cz) {
        return avoidedCorners.some(c => cycle < c.until
            && Math.abs(cx + 0.5 - c.x) <= 1.25 && Math.abs(cz + 0.5 - c.z) <= 1.25);
    }
    function noteCornerFailure(p) {
        const x = Math.floor(p.getX()) + 0.5, z = Math.floor(p.getZ()) + 0.5;
        let item = cornerFailures.find(c => Math.hypot(c.x - x, c.z - z) <= 2.5 && cycle - c.last < 1200);
        if (!item) {
            item = { x: x, z: z, count: 0, last: -1 };
            cornerFailures.push(item);
            if (cornerFailures.length > 32) cornerFailures.shift();
        }
        if (item.last === cycle) return;
        item.last = cycle; item.count++;
        if (item.count >= 3 && !avoidedCorner(Math.floor(item.x), Math.floor(item.z))) {
            avoidedCorners.push({ x: item.x, z: item.z, until: cycle + 1200 });
            if (avoidedCorners.length > 16) avoidedCorners.shift();
            Chat.log("[Colheita] Ciclo no canto detectado; evitando essa regiao por 60 segundos.");
        }
    }
    function pathTo(sx, sz, gx, gz, cy) {
        if (!walkable(gx, cy, gz) || avoidedCorner(gx, gz)) return null;
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
                        || seen.has(key) || !walkable(nx, cy, nz)
                        || (avoidedCorner(nx, nz) && !avoidedCorner(here.x, here.z))) continue;
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
                    if (!walkable(gx, cy, gz) || avoidedCorner(gx, gz)) break;
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
            for (let back = 0; back <= 6; back++) {
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
        if (/bloquead|sem retorno|sem passagem/.test(note)) noteCornerFailure(p);
        releaseKeys();
        phase = "waiting"; waitingTicks = 0;
        route = []; retreat = null; climb = null; sale = null; cornerExitActive = false;
        saleCooldown = 100; GlobalVars.putString(SALE_STATE, "cooldown");
        if (note !== lastPauseNote) {
            lastPauseNote = note;
            Chat.log("[Colheita] Aguardando recuperacao automatica: " + note);
            Chat.log("[Colheita] Local da espera: " + describeBlock(Math.floor(p.getX()), Math.floor(p.getZ())));
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
        if (AREA.enabled) return;
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
    function sweepBoundaryKey(p) {
        const lx = -fieldAxis.z, lz = fieldAxis.x;
        const lane = Math.floor(p.getX()) * lx + Math.floor(p.getZ()) * lz;
        return lane + ":" + (side.x * lx + side.z * lz);
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
        const key = sweepBoundaryKey(p);
        if (findRoute(p, true)) {
            boundaryMisses.delete(key);
            return true;
        }
        const progress = p.getX() * fieldAxis.x + p.getZ() * fieldAxis.z;
        const previous = boundaryMisses.get(key);
        if (previous === undefined) {
            if (boundaryMisses.size > 256) boundaryMisses.clear();
            boundaryMisses.set(key, { progress: progress, attempts: 1 });
            return reverseSameRow(p, "Canto sem acesso; verificando a outra ponta sem trocar o lado");
        }
        if (Math.abs(progress - previous.progress) < 0.75) {
            previous.attempts++;
            if (previous.attempts > 2) return false;
            return reverseSameRow(p, "Rechecando acesso pelo mesmo lado do percurso");
        }
        boundaryMisses.delete(key);
        // Somente falhas em pontas distintas confirmam o limite das fileiras.
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
    function escapeCorner(p) {
        if (Math.abs(p.getY() - farmY) > 0.2) return false;
        const bx = Math.floor(p.getX()), bz = Math.floor(p.getZ());
        noteCornerFailure(p);
        const candidates = [];
        const range = avoidedCorner(bx, bz) ? DETOUR_RADIUS : 4;
        for (let r = 2; r <= range; r++) {
            for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
                if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
                const gx = bx + dx, gz = bz + dz, key = gx + "," + gz;
                if (cycle - (escapeVisits.get(key) || -1000) < 200 || !walkable(gx, farmLevel, gz) || avoidedCorner(gx, gz)) continue;
                const reverse = walkable(gx - forward.x, farmLevel, gz - forward.z);
                if (!reverse && !walkable(gx + forward.x, farmLevel, gz + forward.z)) continue;
                let clearance = 0, plants = crop(gx, farmLevel, gz) ? 1 : 0;
                for (const d of [{x:1,z:0},{x:-1,z:0},{x:0,z:1},{x:0,z:-1}]) {
                    if (walkable(gx + d.x, farmLevel, gz + d.z)) clearance++;
                    if (crop(gx + d.x, farmLevel, gz + d.z)) plants++;
                }
                if (clearance < 2 || plants === 0) continue;
                const away = -(dx * forward.x + dz * forward.z);
                candidates.push({ x: gx, z: gz, key: key, reverse: reverse,
                    score: clearance * 5 + plants + away * 2 - r });
            }
        }
        candidates.sort((a, b) => b.score - a.score);
        for (const goal of candidates.slice(0, 8)) {
            const path = pathTo(bx, bz, goal.x, goal.z, farmLevel);
            if (path === null || path.length === 0) continue;
            escapeVisits.set(goal.key, cycle);
            if (escapeVisits.size > 128) escapeVisits.delete(escapeVisits.keys().next().value);
            releaseKeys(); route = path; routeIndex = 0;
            routeOrigin = { x: p.getX(), z: p.getZ() };
            reverseAfterRoute = goal.reverse; cornerExitActive = true;
            phase = "route"; retreat = null; idle = 0; resetBlocked();
            checkpoint = { x: p.getX(), z: p.getZ() };
            Chat.log("[Colheita] Saindo do canto por passagem livre no mesmo nivel.");
            return true;
        }
        return false;
    }
    function reverseSameRow(p, note) {
        const bx = Math.floor(p.getX()), bz = Math.floor(p.getZ());
        if (!walkable(bx - forward.x, farmLevel, bz - forward.z)
                || (avoidedCorner(bx - forward.x, bz - forward.z) && !avoidedCorner(bx, bz))) return escapeCorner(p);
        releaseKeys();
        yaw += 180; forward = direction(yaw);
        phase = "turnback"; missing = 0; end = null;
        route = []; retreat = null; resetBlocked();
        idle = 0; checkpoint = { x: p.getX(), z: p.getZ() };
        Chat.log("[Colheita] " + note + ": voltando pela mesma fileira.");
        return true;
    }
    function nextAreaRow(p, note) {
        releaseKeys();
        let next = areaRun.column + areaRun.step;
        if (next < AREA.minX || next > AREA.maxX) {
            areaRun.step = -areaRun.step;
            next = areaRun.column; // Repassa a ultima fileira para inverter o percurso inteiro.
            Chat.log("[Colheita] Faixa: fim das fileiras; percurso invertido.");
        }
        if (RANDOM_ROWS) {
            if (!rowDeck.length) {
                for (let column = AREA.minX; column <= AREA.maxX; column++) rowDeck.push(column);
                for (let i = rowDeck.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [rowDeck[i], rowDeck[j]] = [rowDeck[j], rowDeck[i]];
                }
                if (rowDeck.length > 1 && rowDeck[rowDeck.length - 1] === areaRun.column) {
                    [rowDeck[0], rowDeck[rowDeck.length - 1]] = [rowDeck[rowDeck.length - 1], rowDeck[0]];
                }
            }
            next = rowDeck.pop();
        }
        areaRun.column = next; areaRun.direction = -areaRun.direction;
        areaRun.anchor = Math.max(AREA.minZ, Math.min(AREA.maxZ, Math.floor(p.getZ())));
        areaRun.stage = "seek"; areaRun.candidates = null; areaRun.scan = 0;
        areaRun.search = null; areaRun.points = []; areaRun.tries = 0; areaRun.idle = 0;
        areaRun.lastX = p.getX(); areaRun.lastZ = p.getZ();
        Chat.log("[Colheita] Faixa: fileira " + (next - AREA.minX + 1) + "/"
            + (AREA.maxX - AREA.minX + 1) + " (X " + next + "): " + note);
    }
    function areaSearch(startX, startZ, goalX, goalZ) {
        const queue = [{ x: startX, z: startZ, parent: -1 }];
        return { queue: queue, seen: new Set([startX + "," + startZ]), head: 0, x: goalX, z: goalZ };
    }
    function areaTick(p) {
        const x = p.getX(), z = p.getZ(), bx = Math.floor(x), bz = Math.floor(z);
        if (!insideArea(bx, bz) || Math.abs(p.getY() - farmY) > 0.35) {
            releaseKeys();
            if (areaRun.note !== "outside") {
                areaRun.note = "outside";
                Chat.log("[Colheita] Fora da faixa ou do patamar; aguardando retorno ao nivel configurado.");
            }
            return;
        }
        areaRun.note = "";
        if (areaRun.stage === "seek") {
            phase = "areaTravel"; releaseKeys();
            if (areaRun.candidates === null) {
                const list = [];
                for (let d = 0; d <= AREA.maxZ - AREA.minZ; d++) {
                    const near = areaRun.anchor + areaRun.direction * d;
                    const other = areaRun.anchor - areaRun.direction * d;
                    if (near >= AREA.minZ && near <= AREA.maxZ) list.push(near);
                    if (d > 0 && other >= AREA.minZ && other <= AREA.maxZ) list.push(other);
                }
                areaRun.candidates = list;
            }
            for (let n = 0; n < 4 && areaRun.scan < areaRun.candidates.length; n++) {
                const targetZ = areaRun.candidates[areaRun.scan++];
                if (!walkable(areaRun.column, farmLevel, targetZ)) continue;
                areaRun.search = areaSearch(bx, bz, areaRun.column, targetZ);
                areaRun.stage = "plan";
                return;
            }
            if (areaRun.scan >= areaRun.candidates.length) nextAreaRow(p, "sem entrada segura/carregada; seguindo a sequencia");
            return;
        }
        if (areaRun.stage === "plan") {
            phase = "areaTravel"; releaseKeys();
            const search = areaRun.search;
            // Trabalho fracionado: nao calcula o caminho de toda a faixa em um frame.
            for (let budget = 0; budget < 16 && search.head < search.queue.length; budget++) {
                const at = search.head++, node = search.queue[at];
                if (node.x === search.x && node.z === search.z) {
                    const points = [];
                    for (let pos = at; search.queue[pos].parent >= 0; pos = search.queue[pos].parent) {
                        points.unshift({ x: search.queue[pos].x + 0.5, z: search.queue[pos].z + 0.5 });
                    }
                    areaRun.points = points; areaRun.point = 0; areaRun.origin = { x: x, z: z };
                    areaRun.stage = points.length ? "travel" : "farm";
                    areaRun.idle = 0; areaRun.lastX = x; areaRun.lastZ = z;
                    return;
                }
                for (const d of [{x:1,z:0},{x:-1,z:0},{x:0,z:1},{x:0,z:-1}]) {
                    const nx = node.x + d.x, nz = node.z + d.z, key = nx + "," + nz;
                    if (search.seen.has(key) || !walkable(nx, farmLevel, nz)) continue;
                    search.seen.add(key); search.queue.push({ x: nx, z: nz, parent: at });
                }
            }
            if (search.head >= search.queue.length) {
                areaRun.tries++;
                if (areaRun.tries >= 3) nextAreaRow(p, "entrada inacessivel; tentativa registrada");
                else areaRun.stage = "seek";
            }
            return;
        }
        if (areaRun.stage === "travel") {
            phase = "areaTravel";
            const point = areaRun.points[areaRun.point];
            const origin = areaRun.point === 0 ? areaRun.origin : areaRun.points[areaRun.point - 1];
            const dx = point.x - origin.x, dz = point.z - origin.z, length = Math.hypot(dx, dz);
            const along = length > 0 ? ((point.x - x) * dx + (point.z - z) * dz) / length : 0;
            const across = length > 0 ? Math.abs((x - origin.x) * dz - (z - origin.z) * dx) / length : Infinity;
            const passed = length > 0 && along <= 0.13 && along >= -0.4 && across <= 0.18;
            if (Math.hypot(point.x - x, point.z - z) <= 0.13 || passed) {
                releaseKeys(); areaRun.point++;
                if (areaRun.point >= areaRun.points.length) areaRun.stage = "farm";
            } else if (!walkable(Math.floor(point.x), farmLevel, Math.floor(point.z))) {
                releaseKeys(); areaRun.stage = "seek"; areaRun.tries++;
                if (areaRun.tries >= 3) nextAreaRow(p, "passagem mudou; seguindo para outra fileira");
            } else {
                const aligned = smoothLook(p, Math.atan2(-(point.x - x), point.z - z) * 180 / Math.PI, PITCH);
                setKeys(aligned, false);
            }
        } else {
            phase = "row";
            const targetZ = areaRun.direction > 0 ? AREA.maxZ + 0.5 : AREA.minZ + 0.5;
            if ((targetZ - z) * areaRun.direction <= 0.15) {
                nextAreaRow(p, "limite da faixa alcancado"); return;
            }
            const nextZ = bz + areaRun.direction;
            if (!walkable(areaRun.column, farmLevel, nextZ)) {
                nextAreaRow(p, "parede/degrau: proxima fileira no mesmo nivel"); return;
            }
            const lane = [-1, 0, 1, 0][cycle % 4];
            let target = null;
            if (HARVEST_WIDTH === 3 && lane !== 0) {
                const tx = areaRun.column + lane;
                for (let ahead = 1; ahead <= 3; ahead++) {
                    const tz = bz + areaRun.direction * ahead;
                    if (insideArea(tx, tz) && crop(tx, farmLevel, tz)) {
                        target = { x: tx + 0.5, z: tz + 0.5 }; break;
                    }
                }
            }
            if (target !== null) {
                // Mira lateral sem andar para o lado: evita que a varredura leve a uma queda.
                const dx = target.x - x, dz = target.z - z;
                const pitch = Math.atan2(p.getY() + 1.62 - (farmLevel + 0.3), Math.hypot(dx, dz)) * 180 / Math.PI;
                p.lookAt(Math.atan2(-dx, dz) * 180 / Math.PI, pitch);
                setKeys(false, false, true);
            } else {
                const heading = areaRun.direction > 0 ? 0 : 180;
                if (HARVEST_WIDTH === 3) {
                    p.lookAt(heading, PITCH);
                    setKeys(true, true);
                } else setKeys(smoothLook(p, heading, PITCH), true);
            }
        }
        if (Math.hypot(x - areaRun.lastX, z - areaRun.lastZ) >= 0.08) {
            areaRun.lastX = x; areaRun.lastZ = z; areaRun.idle = 0;
        } else if (++areaRun.idle >= 60) {
            nextAreaRow(p, "movimento bloqueado; fileira adiada para a proxima passagem");
        }
    }
    function roamGoal() {
        if (!roam.targets.length) {
            // Divide a faixa inteira em setores para distribuir os destinos.
            for (let x = 0; x < 4; x++) for (let z = 0; z < 4; z++) {
                roam.targets.push({
                    x: AREA.minX + (x + 0.2 + Math.random() * 0.6) * (AREA.maxX - AREA.minX + 1) / 4,
                    z: AREA.minZ + (z + 0.2 + Math.random() * 0.6) * (AREA.maxZ - AREA.minZ + 1) / 4
                });
            }
            for (let i = roam.targets.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [roam.targets[i], roam.targets[j]] = [roam.targets[j], roam.targets[i]];
            }
        }
        roam.goal = roam.targets.pop(); roam.age = 0;
    }
    function safeRoamHeading(p, angle) {
        const r = angle * Math.PI / 180, dx = -Math.sin(r), dz = Math.cos(r);
        // Confere o volume do jogador, incluindo cantos, ate alem do proximo passo.
        for (const distance of [0, 0.4, 0.9, 1.4]) {
            for (const ox of [-0.31, 0.31]) for (const oz of [-0.31, 0.31]) {
                if (!walkable(Math.floor(p.getX() + dx * distance + ox), farmLevel,
                        Math.floor(p.getZ() + dz * distance + oz))) return false;
            }
        }
        return true;
    }
    function roamTick(p) {
        if (!insideArea(Math.floor(p.getX()), Math.floor(p.getZ())) || Math.abs(p.getY() - farmY) > 0.35) {
            releaseKeys(); return;
        }
        const x = p.getX(), z = p.getZ(), cell = Math.floor(x) + "," + Math.floor(z);
        if (cell !== roam.last) {
            roam.last = cell; roam.visits.set(cell, (roam.visits.get(cell) || 0) + 1);
        }
        if (Math.hypot(x - roam.x, z - roam.z) > 0.06) roam.stuck = 0;
        else roam.stuck++;
        roam.x = x; roam.z = z;
        if (!roam.goal || Math.hypot(roam.goal.x - x, roam.goal.z - z) < 2 || ++roam.age > 400 || roam.stuck > 60) {
            roamGoal(); roam.stuck = 0;
        }
        const desired = Math.atan2(-(roam.goal.x - x), roam.goal.z - z) * 180 / Math.PI;
        let heading = null, best = -Infinity;
        for (const offset of [0, 30, -30, 60, -60, 90, -90, 135, -135, 180]) {
            const angle = desired + offset;
            if (!safeRoamHeading(p, angle)) continue;
            const r = angle * Math.PI / 180;
            const key = Math.floor(x - Math.sin(r) * 1.4) + "," + Math.floor(z + Math.cos(r) * 1.4);
            const score = Math.cos(offset * Math.PI / 180) * 4 - (roam.visits.get(key) || 0) * 0.2;
            if (score > best) { best = score; heading = angle; }
        }
        if (heading === null) {
            releaseKeys(); roam.goal = null; return;
        }
        phase = "row";
        const lane = HARVEST_WIDTH === 2 ? [0, 1][Math.floor(cycle / 16) % 2]
            : HARVEST_WIDTH === 3 ? [-1, 0, 1, 0][Math.floor(cycle / 8) % 4] : 0;
        let target = null;
        if (lane !== 0) {
            const r = heading * Math.PI / 180;
            for (let ahead = 3; ahead >= 1; ahead--) {
                const tx = Math.floor(x - Math.sin(r) * ahead + Math.cos(r) * lane);
                const tz = Math.floor(z + Math.cos(r) * ahead + Math.sin(r) * lane);
                if (insideArea(tx, tz) && crop(tx, farmLevel, tz)) {
                    target = { x: tx + 0.5, z: tz + 0.5 }; break;
                }
            }
        }
        if (HARVEST_WIDTH === 2) {
            let aim = heading, pitch = PITCH;
            if (target) {
                const dx = target.x - x, dz = target.z - z;
                const targetYaw = Math.atan2(-dx, dz) * 180 / Math.PI;
                const delta = ((targetYaw - heading + 180) % 360 + 360) % 360 - 180;
                aim = heading + Math.max(-12, Math.min(12, delta));
                pitch = Math.atan2(p.getY() + 1.62 - farmLevel - 0.3, Math.hypot(dx, dz)) * 180 / Math.PI;
            }
            // Continua correndo durante a mira, desde que a direcao real seja segura.
            smoothLook(p, aim, pitch, 3);
            setKeys(safeRoamHeading(p, p.getYaw()), true);
        } else if (target) {
            const dx = target.x - x, dz = target.z - z;
            const aligned = smoothLook(p, Math.atan2(-dx, dz) * 180 / Math.PI,
                Math.atan2(p.getY() + 1.62 - farmLevel - 0.3, Math.hypot(dx, dz)) * 180 / Math.PI);
            setKeys(false, false, aligned);
        } else {
            const aligned = smoothLook(p, heading, PITCH);
            setKeys(aligned, true);
        }
    }
    function smoothLook(p, targetYaw, targetPitch, turnStep = TURN_STEP) {
        const currentYaw = p.getYaw(), currentPitch = p.getPitch();
        let delta = ((targetYaw - currentYaw + 180) % 360 + 360) % 360 - 180;
        if (delta === -180) delta = 180;
        const dp = targetPitch - currentPitch;
        const aligned = Math.abs(delta) <= turnStep && Math.abs(dp) <= 5;
        p.lookAt(currentYaw + Math.max(-turnStep, Math.min(turnStep, delta)),
            currentPitch + Math.max(-5, Math.min(5, dp)));
        if (!aligned) { idle = 0; checkpoint = { x: p.getX(), z: p.getZ() }; }
        return aligned;
    }
    function setKeys(walk, sprint, stationaryAttack = false) {
        const attacking = walk || stationaryAttack;
        const hit = phase === "row" && attacking ? Player.rayTraceBlock(4.5, false) : null;
        KeyBind.keyBind("key.attack", phase === "row" && attacking && hit !== null && supportedCrop(hit.getId()) && hit.getY() === farmLevel
            && (!AREA.enabled || insideArea(hit.getX(), hit.getZ())));
        KeyBind.keyBind("key.forward", walk);
        KeyBind.keyBind("key.back", false);
        KeyBind.keyBind("key.sprint", walk && sprint);
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
        Chat.log("[Colheita] Zigue-zague v21: area X 5919-5951, Z 5861-6039; percurso livre, mira em 2 de largura. W + Ctrl. Aperte a mesma tecla para parar.");
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
            if (!AREA.enabled && phase === "waiting") {
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
                        if ((/bloquead|sem retorno|sem passagem/.test(lastPauseNote) && escapeCorner(p))
                                || (REVERSE_FIELD_SWEEP && (fieldMin !== null ? reverseFieldBoundary(p, false) : findNearbyWork(p)))
                                || (!REVERSE_FIELD_SWEEP && RETURN_SAME_ROW && resumeSameRow(p))
                                || (!REVERSE_FIELD_SWEEP && !RETURN_SAME_ROW && (findRoute(p, true) || findNearbyWork(p)))) {
                            idle = 0; checkpoint = { x: x, z: z };
                            lastPauseNote = "";
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
            if (AREA.enabled) {
                if (FREE_ROAM) roamTick(p);
                else areaTick(p);
                Client.waitTick(); continue;
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
                if (avoidedCorner(ax, az) && !avoidedCorner(bx, bz)) {
                    if (!reverseSameRow(p, "Evitando retorno ao canto repetido")) {
                        reason = "regiao repetida sem saida livre";
                        if (!pauseWork(reason, p)) break;
                    }
                    Client.waitTick(); continue;
                }
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
                        if (cornerExitActive) {
                            cornerExitActive = false;
                            Chat.log("[Colheita] Saiu do canto; retomando a colheita.");
                        }
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
