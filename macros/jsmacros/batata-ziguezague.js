// JsMacros 1.21.4. Vincule a uma tecla (ex.: F6), gatilho ao pressionar.
// A mesma tecla inicia/para. Comece na primeira fileira, olhando ao longo dela.
(function () {
    const RUN = "btos.batata.zig.run", STOP = "btos.batata.zig.stop";
    const PITCH = 55;
    const ROW_WIDTH = 1; // Distancia entre fileiras em blocos.
    const SIDE = 1; // 1 = proxima fileira a direita inicial; -1 = a esquerda.
    const SCAN = 6; // Tolera pequenos espacos sem plantas.
    const keys = ["key.forward", "key.sprint", "key.attack"];
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
    function setKeys(walk, sprint) {
        const hit = Player.rayTraceBlock(4.5, false);
        KeyBind.keyBind("key.attack", hit !== null && hit.getId() === "minecraft:potatoes");
        KeyBind.keyBind("key.forward", walk);
        KeyBind.keyBind("key.sprint", sprint);
    }
    try {
        Chat.log("[Batata] Zigue-zague ativo: W + Ctrl. Aperte a mesma tecla para parar.");
        while (GlobalVars.getString(RUN) === id && GlobalVars.getString(STOP) !== id) {
            const p = Player.getPlayer();
            if (!p) { reason = "desconectou"; break; }
            if (Hud.getOpenScreen() !== null) { reason = "menu aberto"; break; }
            const x = p.getX(), z = p.getZ(), y = Math.floor(p.getY());
            const bx = Math.floor(x), bz = Math.floor(z);
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
            else if (++idle >= 60) { reason = "movimento bloqueado por 3 segundos"; break; }
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
