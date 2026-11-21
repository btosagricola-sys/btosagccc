// Vender AFK v1 — script separado. Execute novamente para parar.
// Preset: /vender -> menu Vender -> slot 10 (segunda linha/segunda coluna).
// Esse botao vende os itens aceitos pelo servidor, nao filtra cacto no cliente.
(function () {
    var RUN = "btos.cactoVenderAfk.run", STOP = RUN + ".stop";
    var INTERVAL_MS = 120000;
    var COMMAND = "/vender", MENU_TITLE = "vender", SELL_SLOT = 10;
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
    function isSaleMenu(inv) { return plain(inv.getContainerTitle()) === MENU_TITLE; }
    GlobalVars.putString(RUN, token); GlobalVars.putString(STOP, "");
    try {
        Chat.log("[Cacto AFK] Vender AFK v1 ativo. Venda a cada 2 minutos; execute novamente para parar.");
        while (GlobalVars.getString(RUN) === token && GlobalVars.getString(STOP) !== token) {
            if (!Player.getPlayer()) { reason = "desconectou"; break; }
            var screen = Hud.getOpenScreen();
            if (stage === "wait") {
                // Nao interrompe um menu que o jogador abriu manualmente.
                if (screen === null && Date.now() >= nextSale) {
                    Chat.say(COMMAND);
                    stage = "open"; ticks = 0;
                    Chat.log("[Cacto AFK] Enviando /vender.");
                }
            } else if (stage === "open") {
                if (screen !== null) {
                    var inv = Player.openInventory();
                    if (!isSaleMenu(inv)) throw Error("Menu inesperado; deixado aberto sem clicar.");
                    if (ticks >= 6) {
                        inv.click(SELL_SLOT, 0);
                        stage = "close"; ticks = 0;
                        Chat.log("[Cacto AFK] Clique esquerdo no botao Vender, slot 10.");
                    }
                }
                if (stage === "open" && ++ticks >= 100) {
                    Chat.log("[Cacto AFK] O menu nao abriu; nova tentativa em 30 segundos.");
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
                } else if (++ticks >= 40) throw Error("O menu Vender nao fechou.");
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
