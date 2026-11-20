// JsMacros: vincule a uma tecla livre (ex.: F7), ao pressionar, sem repeticao.
// Anda e seleciona blocos da superficie da mina. A mesma tecla inicia/para. Venda a cada 2 minutos.
(function () {
    var RUN = "btos.minerarVender.run", STOP = RUN + ".stop";
    var INTERVAL_MS = 120000;
    var COMMAND = "/vender";
    var AUTOWALK = true;
    var RADIUS = 16; // Limite de deslocamento a partir do ponto onde ligou.
    var origin = null, target = null, workCycle = 0, miningHeading = 0;
    var blockCache = {}, lastNotice = "";
    var active = GlobalVars.getString(RUN);
    if (active) { GlobalVars.putString(STOP, active); return; }
    if (!Player.getPlayer() || Hud.getOpenScreen() !== null) {
        Chat.log("[Minerar] Entre no mundo e feche os menus antes de iniciar."); return;
    }
    var token = String(Date.now()) + ":" + String(Math.random());
    var nextSale = Date.now() + INTERVAL_MS;
    var stage = "mine", ticks = 0, reason = "desativada";
    function text(value) {
        return value && typeof value.getString === "function" ? String(value.getString()) : String(value || "");
    }
    function plain(value) {
        return text(value).replace(/\u00a7[0-9a-fk-orx]/gi, "").toLowerCase().replace(/^\s+|\s+$/g, "");
    }
    function title(inv) { return plain(inv.getContainerTitle()); }
    function saleMenu(inv) { return title(inv) === "vender"; }
    function button(inv) {
        if (!inv.getHeld().isEmpty()) throw Error("Esvazie o item preso ao cursor antes da venda.");
        var slots = inv.getSlots("container"), found = -1;
        for (var i = 0; i < slots.length; i++) {
            var item = inv.getSlot(slots[i]);
            if (!item.isEmpty() && plain(item.getName()) === "vender") {
                if (found !== -1) throw Error("Mais de um botao Vender encontrado; nenhum foi clicado.");
                found = slots[i];
            }
        }
        return found;
    }
    function release() {
        KeyBind.keyBind("key.attack", false);
        if (AUTOWALK) {
            KeyBind.keyBind("key.forward", false);
            KeyBind.keyBind("key.sprint", false);
        }
    }
    function getBlock(x, y, z) {
        var key = x + "," + y + "," + z;
        if (!Object.prototype.hasOwnProperty.call(blockCache, key)) blockCache[key] = World.getBlock(x, y, z);
        return blockCache[key];
    }
    function air(block) {
        return block && /^(minecraft:)?(air|cave_air|void_air)$/.test(String(block.getId()));
    }
    function minable(block) {
        return block && /^(minecraft:)?(stone|cobblestone|coal_ore|iron_ore|gold_ore|lapis_ore|redstone_ore|lit_redstone_ore|diamond_ore|emerald_ore|quartz_ore|lapis_block|diamond_block|emerald_block|gold_block|iron_block|coal_block|redstone_block)$/.test(String(block.getId()));
    }
    function notice(message) {
        if (message !== lastNotice) {
            lastNotice = message; Chat.log("[Minerar] " + message);
        }
    }
    function groundSolid(block) {
        // Pedra/minerios conhecidos dispensam metodos de estado que variam entre forks.
        if (minable(block)) return true;
        if (!block || typeof block.getBlockStateHelper !== "function") return false;
        var state = block.getBlockStateHelper();
        return state.isSolid() && !state.isLiquid();
    }
    function safePosition(x, z) {
        if (Math.abs(x - origin.x) > RADIUS || Math.abs(z - origin.z) > RADIUS) return false;
        for (var ox = -1; ox <= 1; ox += 2) for (var oz = -1; oz <= 1; oz += 2) {
            var bx = Math.floor(x + ox * 0.3), bz = Math.floor(z + oz * 0.3);
            var ground = getBlock(bx, origin.y - 1, bz);
            if (!groundSolid(ground)
                    || !air(getBlock(bx, origin.y, bz)) || !air(getBlock(bx, origin.y + 1, bz))) return false;
        }
        return true;
    }
    function safeAhead(p, angle) {
        var r = angle * Math.PI / 180;
        for (var d = 0; d <= 1.21; d += 0.2) {
            if (!safePosition(p.getX() - Math.sin(r) * d, p.getZ() + Math.cos(r) * d)) return false;
        }
        return true;
    }
    function selectTarget(p, heading) {
        var best = null, score = -Infinity, r = heading * Math.PI / 180;
        for (var dx = -4; dx <= 4; dx++) for (var dz = -4; dz <= 4; dz++) {
            var x = Math.floor(p.getX()) + dx, z = Math.floor(p.getZ()) + dz;
            var rx = x + 0.5 - p.getX(), rz = z + 0.5 - p.getZ(), dist = Math.sqrt(rx * rx + rz * rz);
            if (dist < 1.5 || dist > 3.3 || Math.abs(x + 0.5 - origin.x) > RADIUS
                    || Math.abs(z + 0.5 - origin.z) > RADIUS || !minable(getBlock(x, origin.y - 1, z))) continue;
            var ahead = (-Math.sin(r) * rx + Math.cos(r) * rz) / dist;
            var value = ahead * 4 - dist;
            if (value > score) { score = value; best = { x: x, z: z }; }
        }
        return best;
    }
    function mineStep(p) {
        blockCache = {}; workCycle++;
        if (!origin) {
            origin = { x: p.getX(), y: Math.ceil(p.getY() - 0.01), z: p.getZ() };
            miningHeading = p.getYaw();
        }
        if (Math.abs(p.getY() - origin.y) > 0.35) {
            release(); notice("Nivel diferente do inicial: pes Y " + p.getY() + ", esperado " + origin.y + ". Volte ao piso inicial."); return;
        }
        // Escolhe uma direcao com apoio antes de mirar outro bloco.
        if (!safeAhead(p, miningHeading)) {
            var found = false, offsets = [45, -45, 90, -90, 135, -135, 180];
            for (var i = 0; i < offsets.length; i++) if (safeAhead(p, miningHeading + offsets[i])) {
                miningHeading += offsets[i]; found = true; break;
            }
            if (!found) {
                release();
                var bx = Math.floor(p.getX()), bz = Math.floor(p.getZ());
                var floor = getBlock(bx, origin.y - 1, bz), feet = getBlock(bx, origin.y, bz);
                notice("Sem passagem com apoio. Chao=" + (floor ? floor.getId() : "nao carregado")
                    + ", pes=" + (feet ? feet.getId() : "nao carregado") + ", Y=" + p.getY() + ".");
                return;
            }
            target = null;
        }
        if (target) {
            var distance = Math.sqrt(Math.pow(target.x + 0.5 - p.getX(), 2) + Math.pow(target.z + 0.5 - p.getZ(), 2));
            if (distance < 1.5 || distance > 3.5 || !minable(getBlock(target.x, origin.y - 1, target.z))) target = null;
        }
        if (!target) target = selectTarget(p, miningHeading);
        if (!target) notice("Nenhum bloco reconhecido ao alcance. Aproxime-se de pedra ou minerio; limite de 16 blocos do inicio.");
        else if (lastNotice !== "Selecionando e minerando blocos.") notice("Selecionando e minerando blocos.");
        var aim = miningHeading, pitch = 35;
        if (target) {
            var dx = target.x + 0.5 - p.getX(), dz = target.z + 0.5 - p.getZ();
            aim = Math.atan2(-dx, dz) * 180 / Math.PI;
            pitch = Math.atan2(p.getY() + 1.62 - origin.y + 0.05, Math.sqrt(dx * dx + dz * dz)) * 180 / Math.PI;
        }
        var delta = ((aim - p.getYaw() + 180) % 360 + 360) % 360 - 180;
        p.lookAt(p.getYaw() + Math.max(-12, Math.min(12, delta)), pitch);
        var hit = target ? Player.rayTraceBlock(4.5, false) : null;
        var attack = hit && minable(hit) && hit.getX() === target.x && hit.getZ() === target.z && hit.getY() === origin.y - 1;
        KeyBind.keyBind("key.attack", !!attack);
        // Nunca quebra o apoio atual; a passagem e reavaliada depois de cada quebra.
        KeyBind.keyBind("key.forward", safeAhead(p, p.getYaw()));
        KeyBind.keyBind("key.sprint", false);
    }
    GlobalVars.putString(RUN, token); GlobalVars.putString(STOP, "");
    try {
        Chat.log("[Minerar] Minerar/Vender v3: movimento e mira automaticos, raio 16 blocos, /vender a cada 2 minutos. Mesma tecla para parar.");
        while (GlobalVars.getString(RUN) === token && GlobalVars.getString(STOP) !== token) {
            if (!Player.getPlayer()) { reason = "desconectou"; break; }
            var screen = Hud.getOpenScreen();
            // Nunca deixa o ataque pressionado em menus ou durante a venda.
            if (stage !== "mine" || screen !== null || Date.now() >= nextSale) release();
            else if (!AUTOWALK) KeyBind.keyBind("key.attack", true);
            if (stage === "mine") {
                if (screen !== null) { Client.waitTick(); continue; }
                if (Date.now() >= nextSale) {
                    KeyBind.keyBind("key.attack", false);
                    Chat.say(COMMAND);
                    stage = "open"; ticks = 0;
                    Chat.log("[Minerar] Abrindo /vender.");
                } else if (AUTOWALK) mineStep(Player.getPlayer());
            } else if (stage === "open") {
                if (screen !== null) {
                    var inv = Player.openInventory();
                    if (!saleMenu(inv)) throw Error("Menu inesperado; deixado aberto sem clicar.");
                    var slot = button(inv);
                    if (slot !== -1) {
                        inv.click(slot);
                        stage = "close"; ticks = 0;
                        Chat.log("[Minerar] Clicou em Vender; aguardando o servidor e fechando o menu.");
                    }
                }
                if (stage === "open" && ++ticks >= 100) throw Error("Menu/botao Vender nao apareceu em 5 segundos.");
            } else if (stage === "close") {
                if (screen === null) {
                    stage = "mine"; nextSale = Date.now() + INTERVAL_MS;
                    Chat.log("[Minerar] Retomando a mineracao; confira o recibo da venda no chat.");
                } else if (++ticks >= 20) {
                    var current = Player.openInventory();
                    if (!saleMenu(current)) throw Error("O menu mudou apos o clique; deixado aberto sem fechar.");
                    current.close(); stage = "closing"; ticks = 0;
                }
            } else if (stage === "closing") {
                if (screen === null) {
                    stage = "mine"; nextSale = Date.now() + INTERVAL_MS;
                    Chat.log("[Minerar] Retomando a mineracao; confira o recibo da venda no chat.");
                } else if (++ticks >= 40) throw Error("O menu de venda nao fechou.");
            }
            Client.waitTick();
        }
    } catch (error) {
        reason = String(error);
    } finally {
        release();
        if (GlobalVars.getString(RUN) === token) {
            GlobalVars.putString(RUN, ""); GlobalVars.putString(STOP, "");
        }
        Chat.log("[Minerar] Parada: " + reason);
    }
})();
