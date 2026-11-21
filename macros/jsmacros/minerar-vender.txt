// JsMacros: vincule a uma tecla livre (ex.: F7), ao pressionar, sem repeticao.
// Seleciona blocos, minera e se aproxima conforme o alcance. A mesma tecla inicia/para. Venda a cada 2 minutos.
(function () {
    var RUN = "btos.minerarVender.run", STOP = RUN + ".stop";
    var INTERVAL_MS = 120000;
    var COMMAND = "/vender";
    var AUTOWALK = true;
    var RADIUS = 0; // 0 = sem limite artificial de deslocamento.
    var origin = null, target = null, workCycle = 0, miningHeading = 0;
    var blockCache = {}, lastNotice = "";
    var lastPosition = null, avoided = {}, targetAge = 0, trackedTarget = "", blockedAim = 0;
    var active = GlobalVars.getString(RUN);
    if (active) { GlobalVars.putString(STOP, active); return; }
    if (!Player.getPlayer() || Hud.getOpenScreen() !== null) {
        Chat.log("[Minerar] Entre no mundo e feche os menus antes de iniciar."); return;
    }
    var token = String(Date.now()) + ":" + String(Math.random());
    var nextSale = Date.now() + INTERVAL_MS;
    var stage = "mine", ticks = 0, reason = "desativada";
    var fullInventory = false, fullListener = null, fullCooldown = 0;
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
        // Alguns forks 1.8.9 retornam null para ar. O apoio e validado separadamente.
        return block === null || block === undefined
            || /^(minecraft:)?(air|cave_air|void_air)$/.test(String(block.getId()));
    }
    function minable(block) {
        return block && /^(minecraft:)?(sponge|wet_sponge|stone|cobblestone|coal_ore|iron_ore|gold_ore|lapis_ore|redstone_ore|lit_redstone_ore|diamond_ore|emerald_ore|quartz_ore|lapis_block|diamond_block|emerald_block|gold_block|iron_block|coal_block|redstone_block)$/.test(String(block.getId()));
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
    function safePosition(x, z, level) {
        if (RADIUS > 0 && (Math.abs(x - origin.x) > RADIUS || Math.abs(z - origin.z) > RADIUS)) return false;
        for (var ox = -1; ox <= 1; ox += 2) for (var oz = -1; oz <= 1; oz += 2) {
            var bx = Math.floor(x + ox * 0.3), bz = Math.floor(z + oz * 0.3);
            if (typeof World.isChunkLoaded === "function"
                    && !World.isChunkLoaded(Math.floor(bx / 16), Math.floor(bz / 16))) return false;
            // Cada canto pode ter apoio no nivel atual ou um bloco abaixo.
            var same = groundSolid(getBlock(bx, level - 1, bz));
            var down = !same && air(getBlock(bx, level - 1, bz)) && groundSolid(getBlock(bx, level - 2, bz));
            if ((!same && !down) || !air(getBlock(bx, level, bz)) || !air(getBlock(bx, level + 1, bz))) return false;
        }
        return true;
    }
    function safeAhead(p, angle) {
        var r = angle * Math.PI / 180, level = Math.ceil(p.getY() - 0.01);
        for (var d = 0; d <= 0.61; d += 0.1) {
            if (!safePosition(p.getX() - Math.sin(r) * d, p.getZ() + Math.cos(r) * d, level)) return false;
        }
        return true;
    }
    function underPlayer(p, x, y, z) {
        var level = Math.ceil(p.getY() - 0.01);
        return y < level && x + 1 > p.getX() - 0.3 && x < p.getX() + 0.3
            && z + 1 > p.getZ() - 0.3 && z < p.getZ() + 0.3;
    }
    function selectTarget(p, heading) {
        var best = null, score = -Infinity, r = heading * Math.PI / 180;
        var level = Math.ceil(p.getY() - 0.01);
        for (var dx = -4; dx <= 4; dx++) for (var dz = -4; dz <= 4; dz++) {
            var x = Math.floor(p.getX()) + dx, z = Math.floor(p.getZ()) + dz;
            var rx = x + 0.5 - p.getX(), rz = z + 0.5 - p.getZ(), dist = Math.sqrt(rx * rx + rz * rz);
            if (RADIUS > 0 && (Math.abs(x + 0.5 - origin.x) > RADIUS || Math.abs(z + 0.5 - origin.z) > RADIUS)) continue;
            for (var y = level - 1; y <= level + 1; y++) {
                var key = x + "," + y + "," + z;
                if (avoided[key] && avoided[key] > workCycle) continue;
                if (avoided[key]) delete avoided[key];
                var vertical = y + 0.5 - p.getY() - 1.62;
                if ((y < level && dist < 1.5) || dist * dist + vertical * vertical > 4.3 * 4.3 || underPlayer(p, x, y, z)
                        || !minable(getBlock(x, y, z))) continue;
                var ahead = dist > 0 ? (-Math.sin(r) * rx + Math.cos(r) * rz) / dist : 0;
                var value = ahead * 3 - dist - Math.abs(vertical) * 0.25;
                if (value > score) { score = value; best = { x: x, y: y, z: z }; }
            }
        }
        return best;
    }
    function mineStep(p) {
        blockCache = {}; workCycle++;
        var relocated = lastPosition && (p.getY() - lastPosition.y > 0.75
            || lastPosition.y - p.getY() > 1.5
            || Math.pow(p.getX() - lastPosition.x, 2) + Math.pow(p.getZ() - lastPosition.z, 2) > 16);
        lastPosition = { x: p.getX(), y: p.getY(), z: p.getZ() };
        if (relocated) {
            target = null; avoided = {}; targetAge = 0; trackedTarget = ""; blockedAim = 0;
            miningHeading = p.getYaw();
            release(); notice("Reposicionado/reset detectado: procurando os blocos novos.");
            return;
        }
        if (!origin) {
            origin = { x: p.getX(), y: Math.ceil(p.getY() - 0.01), z: p.getZ() };
            miningHeading = p.getYaw();
        }
        if (target && (!minable(getBlock(target.x, target.y, target.z))
                || underPlayer(p, target.x, target.y, target.z)
                || Math.pow(target.x + 0.5 - p.getX(), 2) + Math.pow(target.z + 0.5 - p.getZ(), 2)
                    + Math.pow(target.y + 0.5 - p.getY() - 1.62, 2) > 4.3 * 4.3)) target = null;
        if (!safeAhead(p, miningHeading) && (!target || target.y < Math.ceil(p.getY() - 0.01))) {
            var turns = [45, -45, 90, -90, 135, -135, 180];
            for (var t = 0; t < turns.length; t++) if (safeAhead(p, miningHeading + turns[t])) {
                miningHeading += turns[t]; target = null; break;
            }
        }
        if (!target) target = selectTarget(p, miningHeading);
        var targetKey = target ? target.x + "," + target.y + "," + target.z : "";
        if (targetKey === trackedTarget) targetAge++;
        else { trackedTarget = targetKey; targetAge = 0; blockedAim = 0; }
        // Um alvo antigo que nunca quebra nao impede a tentativa dos outros.
        if (target && targetAge >= 80) {
            avoided[targetKey] = workCycle + 100;
            target = null; trackedTarget = ""; targetAge = 0; blockedAim = 0;
            release(); return;
        }
        var aim = miningHeading, pitch = 35, horizontal = Infinity;
        if (target) {
            notice("Selecionando e minerando blocos.");
            var dx = target.x + 0.5 - p.getX(), dz = target.z + 0.5 - p.getZ();
            horizontal = Math.sqrt(dx * dx + dz * dz);
            aim = Math.atan2(-dx, dz) * 180 / Math.PI;
            pitch = Math.atan2(p.getY() + 1.62 - target.y - 0.5, horizontal) * 180 / Math.PI;
        } else {
            notice("Nenhum bloco reconhecido ao alcance; procurando passagem.");
            var offsets = [0, 45, -45, 90, -90, 135, -135, 180];
            for (var i = 0; i < offsets.length; i++) if (safeAhead(p, miningHeading + offsets[i])) {
                aim = miningHeading + offsets[i]; miningHeading = aim; break;
            }
        }
        var delta = ((aim - p.getYaw() + 180) % 360 + 360) % 360 - 180;
        p.lookAt(p.getYaw() + Math.max(-12, Math.min(12, delta)), pitch);
        var hit = target ? Player.rayTraceBlock(4.5, false) : null;
        // Ataca o primeiro minerio visivel; nao fica esperando um alvo oculto atras dele.
        var attack = hit && minable(hit) && !underPlayer(p, hit.getX(), hit.getY(), hit.getZ());
        KeyBind.keyBind("key.attack", !!attack);
        if (target && !attack && Math.abs(delta) <= 12) blockedAim++;
        else blockedAim = 0;
        if (target && ((hit && !minable(hit)) || blockedAim >= 12)) {
            avoided[targetKey] = workCycle + 100;
            target = null; blockedAim = 0;
        }
        // Minera perto parado; aproxima somente quando o alvo esta mais distante.
        var approach = !target || horizontal > 1.4;
        KeyBind.keyBind("key.forward", approach && Math.abs(delta) < 30 && safeAhead(p, p.getYaw()));
        KeyBind.keyBind("key.sprint", false);
    }
    GlobalVars.putString(RUN, token); GlobalVars.putString(STOP, "");
    try {
        if (typeof JsMacros !== "undefined" && typeof JavaWrapper !== "undefined") {
            try {
                fullListener = JsMacros.on("RecvMessage", JavaWrapper.methodToJava(function (event) {
                    var message = plain(event.text);
                    if (stage === "mine" && Date.now() >= fullCooldown
                            && /invent[aá]rio.*cheio|inventory.*full/.test(message)) fullInventory = true;
                }));
            } catch (listenError) {
                Chat.log("[Minerar] Aviso de inventario indisponivel; mantida venda por tempo: " + listenError);
            }
        }
        Chat.log("[Minerar] Minerar/Vender v7: movimento e mira automaticos, aproxima e minera em niveis diferentes, /vender a cada 2 minutos. Mesma tecla para parar.");
        while (GlobalVars.getString(RUN) === token && GlobalVars.getString(STOP) !== token) {
            if (!Player.getPlayer()) { reason = "desconectou"; break; }
            var screen = Hud.getOpenScreen();
            // Nunca deixa o ataque pressionado em menus ou durante a venda.
            if (stage !== "mine" || screen !== null || Date.now() >= nextSale || fullInventory) release();
            else if (!AUTOWALK) KeyBind.keyBind("key.attack", true);
            if (stage === "mine") {
                if (screen !== null) { Client.waitTick(); continue; }
                if (Date.now() >= nextSale || fullInventory) {
                    release();
                    Chat.log("[Minerar] Enviando /vender: " + (fullInventory ? "inventario cheio" : "2 minutos decorridos") + ".");
                    fullInventory = false;
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
                    stage = "mine"; nextSale = Date.now() + INTERVAL_MS; fullCooldown = Date.now() + 5000;
                    Chat.log("[Minerar] Retomando a mineracao; confira o recibo da venda no chat.");
                } else if (++ticks >= 20) {
                    var current = Player.openInventory();
                    if (!saleMenu(current)) throw Error("O menu mudou apos o clique; deixado aberto sem fechar.");
                    current.close(); stage = "closing"; ticks = 0;
                }
            } else if (stage === "closing") {
                if (screen === null) {
                    stage = "mine"; nextSale = Date.now() + INTERVAL_MS; fullCooldown = Date.now() + 5000;
                    Chat.log("[Minerar] Retomando a mineracao; confira o recibo da venda no chat.");
                } else if (++ticks >= 40) throw Error("O menu de venda nao fechou.");
            }
            Client.waitTick();
        }
    } catch (error) {
        reason = String(error);
    } finally {
        if (fullListener !== null) {
            try { JsMacros.off(fullListener); } catch (ignored) {}
        }
        release();
        if (GlobalVars.getString(RUN) === token) {
            GlobalVars.putString(RUN, ""); GlobalVars.putString(STOP, "");
        }
        Chat.log("[Minerar] Parada: " + reason);
    }
})();
