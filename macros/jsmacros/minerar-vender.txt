// JsMacros: vincule a uma tecla livre (ex.: F7), ao pressionar, sem repeticao.
// Minera parado na mira. A mesma tecla inicia/para. Venda a cada 2 minutos.
(function () {
    var RUN = "btos.minerarVender.run", STOP = RUN + ".stop";
    var INTERVAL_MS = 120000;
    var COMMAND = "/vender";
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
    GlobalVars.putString(RUN, token); GlobalVars.putString(STOP, "");
    try {
        Chat.log("[Minerar] Minerar/Vender v1: mira fixa, /vender a cada 2 minutos. Mesma tecla para parar.");
        while (GlobalVars.getString(RUN) === token && GlobalVars.getString(STOP) !== token) {
            if (!Player.getPlayer()) { reason = "desconectou"; break; }
            var screen = Hud.getOpenScreen();
            // Nunca deixa o ataque pressionado em menus ou durante a venda.
            KeyBind.keyBind("key.attack", stage === "mine" && screen === null && Date.now() < nextSale);
            if (stage === "mine") {
                if (screen !== null) { Client.waitTick(); continue; }
                if (Date.now() >= nextSale) {
                    KeyBind.keyBind("key.attack", false);
                    Chat.say(COMMAND);
                    stage = "open"; ticks = 0;
                    Chat.log("[Minerar] Abrindo /vender.");
                }
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
        KeyBind.keyBind("key.attack", false);
        if (GlobalVars.getString(RUN) === token) {
            GlobalVars.putString(RUN, ""); GlobalVars.putString(STOP, "");
        }
        Chat.log("[Minerar] Parada: " + reason);
    }
})();
