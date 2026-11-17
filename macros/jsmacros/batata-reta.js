// JsMacros / Minecraft 1.21.4 — configure este arquivo em uma tecla, ex.: F6.
// Primeira vez: inicia. Segunda vez: solicita parada e solta os comandos.
(function () {
    const RUN = "btos.batata.reta.run";
    const STOP = "btos.batata.reta.stop";
    const PITCH = 35; // Positivo olha para baixo. Ajuste conforme alcance/altura.
    const ALIGN_TO_ROW = true; // Alinha o yaw ao eixo cardinal mais proximo.
    const keys = ["key.forward", "key.sprint", "key.attack"];

    const running = GlobalVars.getString(RUN);
    if (running) {
        GlobalVars.putString(STOP, running);
        Chat.log("[Batata] Parando...");
        return;
    }
    const initial = Player.getPlayer();
    if (!initial || Hud.getOpenScreen() !== null) {
        Chat.log("[Batata] Entre no mundo e feche os menus antes de iniciar.");
        return;
    }

    const id = String(Date.now()) + ":" + String(Math.random());
    const yaw = ALIGN_TO_ROW ? Math.round(initial.getYaw() / 90) * 90 : initial.getYaw();
    GlobalVars.putString(RUN, id);
    GlobalVars.putString(STOP, "");
    let reason = "desativada";
    try {
        Chat.log("[Batata] Ativa: avancar + correr (Ctrl) + colher. Aperte a mesma tecla para parar.");
        while (GlobalVars.getString(RUN) === id && GlobalVars.getString(STOP) !== id) {
            const player = Player.getPlayer();
            if (!player) { reason = "desconectou"; break; }
            if (Hud.getOpenScreen() !== null) { reason = "menu aberto"; break; }
            player.lookAt(yaw, PITCH);
            for (const key of keys) KeyBind.keyBind(key, true);
            Client.waitTick();
        }
    } finally {
        // Libera todas as teclas mesmo se uma API falhar durante a execucao.
        for (const key of keys) {
            try { KeyBind.keyBind(key, false); } catch (ignored) {}
        }
        GlobalVars.putString(RUN, "");
        GlobalVars.putString(STOP, "");
        Chat.log("[Batata] Parada: " + reason + ".");
    }
})();
