# Minerar e vender — JsMacros

Copie todo o conteúdo de `minerar-vender.txt` para um novo script JavaScript
do JsMacros. Vincule a F7, ao pressionar, sem repetição. A mesma tecla inicia
e para. Equipe a picareta, aponte para os blocos e ative com os menus fechados.

Segura o ataque, parado, sem movimentar o personagem nem a câmera. Após dois
minutos envia `/vender`, procura no menu `Vender` um único botão de mesmo nome,
clica uma vez, fecha o menu após aproximadamente um segundo e volta a minerar.
Se o servidor fechar o menu ao clicar, retoma automaticamente. Conta os dois
minutos seguintes a partir da retomada, usando o relógio real.

Não clica no inventário do jogador. Em menu inesperado, botão ausente ou
duplicado, cursor ocupado ou erro de API, interrompe e informa o motivo. Um
menu aberto manualmente pausa o ataque; fecha-o para continuar. Desconectar
interrompe o script. Não resolve verificações anti-macro nem reconecta.

O clique não confirma que a venda ocorreu: confira o recibo do servidor.
O script não reconhece a região de mineração nem evita mirar outros blocos;
o jogador escolhe o ponto da mira.

Usa as APIs `GlobalVars`, `KeyBind.keyBind`, `Client.waitTick`, `Chat.say`,
`Player.openInventory` e os métodos de inventário do JsMacros. Foi solicitado
para uma instalação no Minecraft 1.8.9; a compatibilidade depende do fork e
da versão do JsMacros instalado. Não foi executado nessa instalação. Se ocorrer
erro de método ausente, envie a mensagem e a versão exata do mod para adaptar.

Validação: `node --check macros/jsmacros/minerar-vender.js` e
`node macros/jsmacros/tests/minerar-vender.test.js`. Testes com APIs simuladas;
não validam o menu, a mineração ou a venda no servidor real.
