// Vender AFK v2 — script separado. Execute novamente para parar.
// /armazem -> procura o item Cacto no menu superior e clica uma vez.
(function () {
    var RUN = "btos.cactoVenderAfk.run", STOP = RUN + ".stop";
    var INTERVAL_MS = 120000;
    var COMMAND = "/armazem";
    var active = GlobalVars.getString(RUN);
    if (active) { GlobalVars.putString(STOP, active); return; }
    if (!Player.getPlayer()) { Chat.log("[Cacto AFK] Entre no mundo antes de iniciar."); return; }

    var token = String(Date.now()) + ":" + String(Math.random());
    var nextSale = Date.now() + INTERVAL_MS;
    var stage = "wait", ticks = 0, reason = "desativada";
    function plain(value) {
        var str = value && typeof value.getString === "function" ? value.getString() : value;
        return String(str || "").replace(/\u00a7[0-9a-fk-orx]/gi, "").toLowerCase().replace(/^\s+|\s+$/g, "");
    }
    function isSaleMenu(inv) {
        return /armaz[eé]m|armazenamento/.test(plain(inv.getContainerTitle()));
    }
    function cactusSlot(inv) {
        var slots = null;
        try { slots = inv.getSlots("container"); } catch (error) {}
        var length = slots ? (typeof slots.length === "number" ? slots.length : slots.size()) : 0;
        // Fallback apenas se a API informa o tamanho total: exclui os 36 slots do jogador.
        if (!length && typeof inv.getTotalSlots === "function") {
            length = inv.getTotalSlots() - 36;
            slots = null;
        }
        if (length <= 0) throw Error("Nao foi possivel listar os slots do armazem nesta versao. Envie o erro e uma imagem do menu.");
        var found = -1;
        for (var i = 0; i < length; i++) {
            var slot = slots ? (typeof slots.length === "number" ? slots[i] : slots.get(i)) : i;
            var item = inv.getSlot(slot);
            if (!item) continue;
            var name = typeof item.getName === "function" ? plain(item.getName()) : "";
            var itemId = typeof item.getItemId === "function" ? String(item.getItemId())
                : typeof item.getId === "function" ? String(item.getId()) : "";
            if (/(^|[^a-z])(cactos?|cactus)([^a-z]|$)/.test(name) || /^(minecraft:)?cactus$/.test(itemId)) {
                if (found !== -1) throw Error("Mais de um botao de cacto no armazem; envie uma imagem para identificar o correto.");
                found = slot;
            }
        }
        return found;
    }
    GlobalVars.putString(RUN, token); GlobalVars.putString(STOP, "");
    try {
        Chat.log("[Cacto AFK] Vender AFK v2 ativo. Venda a cada 2 minutos; execute novamente para parar.");
        while (GlobalVars.getString(RUN) === token && GlobalVars.getString(STOP) !== token) {
            if (!Player.getPlayer()) { reason = "desconectou"; break; }
            var screen = Hud.getOpenScreen();
            if (stage === "wait") {
                // Nao interrompe um menu que o jogador abriu manualmente.
                if (screen === null && Date.now() >= nextSale) {
                    Chat.say(COMMAND);
                    stage = "open"; ticks = 0;
                    Chat.log("[Cacto AFK] Enviando /armazem.");
                }
            } else if (stage === "open") {
                if (screen !== null) {
                    var inv = Player.openInventory();
                    if (!isSaleMenu(inv)) throw Error("Menu inesperado; deixado aberto sem clicar.");
                    if (ticks >= 6) {
                        var slot = cactusSlot(inv);
                        if (slot !== -1) {
                            inv.click(slot, 0);
                            stage = "close"; ticks = 0;
                            Chat.log("[Cacto AFK] Clique esquerdo no cacto do armazem, slot " + slot + ".");
                        }
                    }
                }
                if (stage === "open" && ++ticks >= 100) {
                    if (screen !== null) {
                        var timedOutMenu = Player.openInventory();
                        if (isSaleMenu(timedOutMenu)) timedOutMenu.close();
                    }
                    Chat.log("[Cacto AFK] O menu/cacto nao apareceu; nova tentativa em 30 segundos.");
                    stage = "wait"; nextSale = Date.now() + 30000;
                }
            } else if (stage === "close") {
                if (screen === null) {
                    stage = "wait"; nextSale = Date.now() + INTERVAL_MS;
                    Chat.log("[Cacto AFK] Aguardando a proxima venda. Confira o recibo no chat.");
                } else if (++ticks >= 20) {
                    var current = Player.openInventory();
                    if (!isSaleMenu(current)) throw Error("O menu mudou depois do clique; deixado aberto.");
                    current.close(); stage = "closing"; ticks = 0;
                }
            } else if (stage === "closing") {
                if (screen === null) {
                    stage = "wait"; nextSale = Date.now() + INTERVAL_MS;
                    Chat.log("[Cacto AFK] Aguardando a proxima venda. Confira o recibo no chat.");
                } else if (++ticks >= 40) throw Error("O menu do armazem nao fechou.");
            }
            Client.waitTick();
        }
    } catch (error) {
        reason = String(error);
    } finally {
        if (GlobalVars.getString(RUN) === token) {
            GlobalVars.putString(RUN, ""); GlobalVars.putString(STOP, "");
        }
        Chat.log("[Cacto AFK] Parada: " + reason);
    }
})();
