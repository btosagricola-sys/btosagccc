# Colheita delimitada — JsMacros / Minecraft 1.21.4 — v17

## Instalar

Pare a macro anterior. Copie **todo** o conteúdo de `batata-ziguezague.txt` para
o editor JavaScript do JsMacros, substituindo o código antigo. A versão `.js`
é idêntica ao documento de texto. Vincule a uma tecla livre, como F6, no gatilho
de pressionar, sem repetição. A mesma tecla inicia/para.

Entre na faixa antes de ativar, no patamar da plantação, olhando ao longo das
fileiras (norte ou sul). Confirme `Zigue-zague v17` no chat. Fora dos limites ou
em outro nível, a macro recusa iniciar e mostra as coordenadas.

## Área autorizada pelo usuário

```js
const AREA = { enabled: true, minX: 5926, maxX: 5951, minZ: 5860, maxZ: 6038, cropY: 121 };
```

São 26 colunas/fileiras em X e até 179 blocos em Z, com plantas no Y 121
(pés aproximadamente Y 120,94). Essa faixa é somente a parte que o usuário
confirmou; não tenta colher a plantação inteira nem o canto fora dela.

O percurso usa uma coluna X por vez e anda ao longo de Z. Mantém uma sequência
numerada de fileiras, em vez de escolher sempre a planta mais próxima. Ao
alcançar o limite lateral, repassa a última coluna no sentido contrário e
percorre as anteriores, repetindo o ciclo. Se iniciar no meio da faixa, tenta
primeiro as colunas de um lado e depois as do outro.

## Paredes e degraus dentro da faixa

A delimitação é um retângulo de alcance, não uma afirmação de que todo bloco
interno é uma planta ou tem passagem. O script verifica apoio, pés e cabeça no
nível configurado. Não planeja caminhos fora desses limites nem descidas.
O ataque também exige uma cultura suportada dentro da faixa e no Y correto.

Procura uma entrada próxima da posição atual para cada coluna. A busca do
caminho é dividida em até 16 expansões por ciclo para não calcular toda a área
em um único frame. Só usa blocos/chunks que o cliente conseguiu carregar.
Durante o planejamento, as teclas ficam soltas, então pode haver uma pausa
antes de se mover.

Uma parede ou degrau interrompe o trecho reto e passa a tentativa para a
fileira seguinte. Após três entradas inacessíveis, ou bloqueio de movimento,
a coluna é registrada/adiada para outra passagem. Isso evita ficar escolhendo
as mesmas três fileiras próximas, mas **não garante colher trechos isolados
por paredes, áreas sem chão ou segmentos inacessíveis**. Partes de uma coluna
além de um bloqueio podem ficar para uma passagem posterior. O chat informa
`Faixa: fileira N/26` e os motivos dos adiamentos.

## Culturas, venda e controles

Reconhece trigo (`minecraft:wheat`), batata, cenoura, fungo do Nether (`nether_wart`), fungo carmesim e fungo
distorcido. Não replanta nem verifica maturidade; depende das regras de
crescimento/replantio do servidor.

Mantém avanço/corrida durante a colheita (W + Ctrl nas teclas padrão). As viradas
são graduais pelo arco mais curto e o movimento aguarda o alinhamento. Não usa
Shift/agachar. A parada e a desconexão liberam os comandos. Quedas acidentais
mantêm a recuperação por salto quando há retorno válido.

Só abre `/farms` ao detectar `Armazém cheio`, por chat/título/actionbar, sem
venda por tempo. Seleciona `Vender Trigo`, `Vender Batatas`, `Vender Cenouras` ou os aliases de
`Vender Fungos`, conforme o título da fazenda. Não clica em itens do inventário
do jogador ou em botões ambíguos. Fecha o menu após confirmação ou até um
segundo depois do clique; sem recibo/atualização de quantidade, informa que o
saldo não foi confirmado. Depois retoma a sequência numerada da faixa.

Os nomes esperados dos menus continuam sendo `Fazenda de Batata(s)`,
`Fazenda de Trigo(s)`, `Fazenda de Cenoura(s)` e `Fazenda de Fungo(s)`/`do Nether`. Outros menus podem
exigir ajuste após observar o servidor.

`AREA.enabled = false` habilita a navegação local anterior para regressão ou
uso fora desta faixa. Não é a configuração padrão da v17.

## Validação e limites

```sh
node --check macros/jsmacros/batata-ziguezague.js
node macros/jsmacros/tests/batata-ziguezague.test.js
```

A sintaxe e **79 testes simulados passaram**. As cinco verificações novas
cobrem oito fileiras com proteção dos limites, canto recuado, venda e retomada,
recusa de início fora da faixa e visita às 26 colunas numa área de teste mais
curta. Os testes antigos desabilitam o modo delimitado para verificar as
funções anteriores isoladamente.

Não houve teste no cliente real, medição de FPS nem ensaio de 24 horas. Chunks
não carregados, entidades, regras do servidor, desconexões e setores isolados
podem exigir intervenção. Leituras de blocos/chunks usam cache por ciclo; isso
não comprova correção do lag relatado anteriormente.
