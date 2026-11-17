// JsMacros 1.21.4. Vincule a uma tecla (ex.: F6), gatilho ao pressionar.
// A mesma tecla inicia/para. Comece na primeira fileira, olhando ao longo dela.
(function () {
    const RUN = "btos.batata.zig.run", STOP = "btos.batata.zig.stop";
    const PITCH = 55;
    const ROW_WIDTH = 1; // Distancia entre fileiras em blocos.
    const SIDE = 1; // 1 = proxima fileira a direita inicial; -1 = a esquerda.
    const DETOUR_RADIUS = 8; // Limite do desvio local, em blocos.
    const SCAN = 6; // Tolera pequenos espacos sem plantas.
    const keys = ["key.forward", "key.sprint", "key.attack", "key.sneak"];
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
    // Mantem sempre o mesmo lado global, mesmo depois de inverter o percurso.
    const side = { x: -forward.z * SIDE, z: forward.x * SIDE };
    const sideYaw = Math.atan2(-side.x, side.z) * 180 / Math.PI;
    let phase = "row", destination = null, end = null;
    let route = [], routeIndex = 0, reverseAfterRoute = false;
    let missing = 0, idle = 0, checkpoint = { x: first.getX(), z: first.getZ() };
    let reason = "desativada";
    GlobalVars.putString(RUN, id); GlobalVars.putString(STOP, "");

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
    function recover(p) {
        const bx = Math.floor(p.getX()), bz = Math.floor(p.getZ()), cy = Math.ceil(p.getY() - 0.01);
        // Primeiro tenta retornar a mesma fileira depois do obstaculo.
        for (let d = 2; d <= DETOUR_RADIUS; d++) {
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
    function setKeys(walk, sprint, careful) {
        const hit = Player.rayTraceBlock(4.5, false);
        KeyBind.keyBind("key.attack", hit !== null && hit.getId() === "minecraft:potatoes");
        KeyBind.keyBind("key.forward", walk);
        KeyBind.keyBind("key.sprint", sprint);
        KeyBind.keyBind("key.sneak", !!careful);
    }
    try {
        Chat.log("[Batata] Zigue-zague ativo: W + Ctrl. Aperte a mesma tecla para parar.");
        while (GlobalVars.getString(RUN) === id && GlobalVars.getString(STOP) !== id) {
            const p = Player.getPlayer();
            if (!p) { reason = "desconectou"; break; }
            if (Hud.getOpenScreen() !== null) { reason = "menu aberto"; break; }
            const x = p.getX(), z = p.getZ(), y = Math.floor(p.getY());
            const bx = Math.floor(x), bz = Math.floor(z);
            if (phase === "row" && !walkable(bx + forward.x, Math.ceil(p.getY() - 0.01), bz + forward.z)) {
                setKeys(false, false);
                if (!recover(p)) { reason = "sem passagem local para desviar ou voltar"; break; }
                idle = 0; checkpoint = { x: x, z: z };
            }
            if (phase === "row") {
                p.lookAt(yaw, PITCH);
                let found = false;
                for (let d = 0; d <= SCAN; d++) {
                    const cx = bx + forward.x * d, cz = bz + forward.z * d;
                    if (crop(cx, y, cz)) {
                        found = true;
                        const progress = (cx + 0.5) * forward.x + (cz + 0.5) * forward.z;
                        end = end === null ? progress : Math.max(end, progress);
                    }
                }
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
                } else setKeys(true, true);
            } else if (phase === "route") {
                const point = route[routeIndex];
                if (Math.hypot(point.x - x, point.z - z) <= 0.12) {
                    routeIndex++;
                    setKeys(false, false);
                    if (routeIndex >= route.length) {
                        if (reverseAfterRoute) { yaw += 180; forward = direction(yaw); }
                        phase = "row"; end = null; missing = 0;
                    }
                } else if (!walkable(Math.floor(point.x), Math.ceil(p.getY() - 0.01), Math.floor(point.z))) {
                    reason = "passagem do desvio foi bloqueada"; break;
                } else {
                    p.lookAt(Math.atan2(-(point.x - x), point.z - z) * 180 / Math.PI, PITCH);
                    setKeys(true, false, true);
                }
            } else {
                const remaining = (destination.x - x) * side.x + (destination.z - z) * side.z;
                if (remaining <= 0.12) {
                    yaw += 180; forward = direction(yaw);
                    phase = "row"; end = null; missing = 0;
                    setKeys(false, false);
                } else {
                    p.lookAt(sideYaw, PITCH);
                    setKeys(true, false);
                }
            }
            const moved = Math.hypot(x - checkpoint.x, z - checkpoint.z);
            if (moved >= 0.08) { checkpoint = { x: x, z: z }; idle = 0; }
            else if (++idle >= 20 && phase !== "route") {
                setKeys(false, false);
                if (!recover(p)) { reason = "sem passagem local para desviar ou voltar"; break; }
                idle = 0; checkpoint = { x: x, z: z };
            } else if (idle >= 60) { reason = "desvio bloqueado por 3 segundos"; break; }
            Client.waitTick();
        }
    } finally {
        for (const key of keys) {
            try { KeyBind.keyBind(key, false); } catch (ignored) {}
        }
        GlobalVars.putString(RUN, ""); GlobalVars.putString(STOP, "");
        Chat.log("[Batata] Parada: " + reason + ".");
    }
})();
