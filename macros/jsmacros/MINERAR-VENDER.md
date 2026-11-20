# Minerar e vender v2 — JsMacros

Copie todo o conteúdo de `minerar-vender.txt` para um novo script JavaScript
do JsMacros. Vincule a F7, ao pressionar, sem repetição. A mesma tecla inicia
e para. Equipe a picareta, aponte para os blocos e ative com os menus fechados.

Com `AUTOWALK = true`, procura blocos de pedra e minérios na superfície até
3,3 blocos de distância, mira neles e anda automaticamente. Inclui minérios
1.8.9 e blocos de recursos como lápis e diamante. Não minera blocos sob o apoio
imediato do jogador. A direção de caminhada é reavaliada contra paredes,
buracos e o limite `RADIUS = 16` a partir da posição inicial, em X e Z.
Não desce níveis nem calcula um caminho por toda a mina. Pode aguardar caso
não exista direção com chão seguro. Não promete minerar a área inteira.

O teste de chão usa bloco sólido, espaço livre nos pés e na cabeça e amostras
do volume do jogador adiante. Não é uma simulação completa da física do jogo;
latência e alterações do servidor ainda podem exigir intervenção.
`AUTOWALK = false` restaura a mineração parada na mira.

Após dois minutos pausa ataque e movimento, envia `/vender`, procura no menu
`Vender` um único botão de mesmo nome, clica uma vez, fecha o menu após
aproximadamente um segundo e volta a minerar.
Se o servidor fechar o menu ao clicar, retoma automaticamente. Conta os dois
minutos seguintes a partir da retomada, usando o relógio real.

Não clica no inventário do jogador. Em menu inesperado, botão ausente ou
duplicado, cursor ocupado ou erro de API, interrompe e informa o motivo. Um
menu aberto manualmente pausa o ataque; fecha-o para continuar. Desconectar
interrompe o script. Não resolve verificações anti-macro nem reconecta.

O clique não confirma que a venda ocorreu: confira o recibo do servidor.
O script não reconhece as regras ou fronteiras da região protegida do servidor.
Inicie dentro da mina. O raio de 16 blocos não substitui limites reais da região.

Usa as APIs `GlobalVars`, `KeyBind.keyBind`, `Client.waitTick`, `Chat.say`,
`Player.openInventory` e os métodos de inventário do JsMacros. Foi solicitado
para uma instalação no Minecraft 1.8.9; a compatibilidade depende do fork e
da versão do JsMacros instalado. Não foi executado nessa instalação. Se ocorrer
erro de método ausente, envie a mensagem e a versão exata do mod para adaptar.

Validação: `node --check macros/jsmacros/minerar-vender.js` e
`node macros/jsmacros/tests/minerar-vender.test.js`. Sete testes com APIs simuladas, incluindo movimento, mira e buracos;
não validam o menu, a mineração ou a venda no servidor real.
