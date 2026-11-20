# Colheita livre — JsMacros / Minecraft 1.21.4 — v25

Pare a macro anterior e substitua todo o código no editor JavaScript do JsMacros
pelo conteúdo de `batata-ziguezague.txt`. O `.js` e o `.txt` são idênticos.
Vincule a F6, ao pressionar, sem repetição. A mesma tecla inicia e para.
Confira `Zigue-zague v25` no chat ao iniciar.

## Área e movimento

```js
const AREA = { enabled: true, minX: 5919, maxX: 5951, minZ: 5861, maxZ: 6039, cropY: 121 };
```

Limites atualizados pelas imagens dos dois pontos: blocos X 5951/Z 6039 e
X 5919/Z 5861. Inicie dentro da área, com os pés aproximadamente Y 120,94.
A faixa tem 33 por 179 blocos; obstáculos internos continuam sendo verificados.

`FREE_ROAM = true` escolhe destinos em 16 setores embaralhados da área e anda
em direções variadas até eles. Não segue colunas fixas. Verifica apoio, pés,
cabeça e cantos do jogador até 1,4 bloco adiante antes de avançar. Ao encontrar
parede ou degrau, procura outra direção no mesmo nível. Contabiliza visitas
para reduzir a preferência por locais repetidos. Troca de destino após chegar,
bloqueio ou tempo limite. Isso não garante cobertura completa da plantação:
setores isolados ou não carregados podem permanecer inacessíveis.

`HARVEST_WIDTH = 2` tenta colher a faixa central e uma vizinha, sem parar
para esperar quebrar. Mantém avanço e corrida enquanto a direção real da
câmera tem passagem segura. A mira alterna entre centro e um lado a cada
4 ticks (cerca de 0,2 segundo), com mira calculada no centro da planta lateral e rotação de até 12 graus
por tick. Foi removido o limite de 12 graus que impedia alcançar a fileira vizinha. Não garante duas plantas por passagem: o movimento contínuo e os obstáculos podem deixar plantas laterais para outra volta.

Mira no centro das plantas das duas faixas. Mantém o botão de ataque pressionado
entre plantas quando a mira passa pelo ar e o movimento é seguro. Solta o ataque
quando a mira encontra um bloco que não é uma cultura suportada dentro da área
e no Y correto. Não aumenta alcance nem velocidade de quebra.
Paredes, degraus e menus ainda podem interromper o avanço para evitar quedas.
`HARVEST_WIDTH = 3` conserva a varredura antiga com pausas laterais.

Mantém W + corrida (Ctrl nos controles padrão), sem agachar. Câmera central a
30 graus para baixo. A corrida depende das condições normais do Minecraft.
Menus, parada manual e desconexão soltam as teclas. Não faz login automático.
Se cair acidentalmente um bloco, conserva a tentativa de retorno por salto
quando existe um ponto seguro próximo. Pode precisar de intervenção se não
houver nenhuma direção segura.

`FREE_ROAM = false` restaura o percurso por fileiras; `RANDOM_ROWS` controla a
ordem delas nesse modo. `HARVEST_WIDTH = 1` desliga a varredura lateral.
`AREA.enabled = false` habilita a navegação local antiga para regressão.

Ao detectar obstrução na direção atual, prioriza a virada de saída por até
16 ticks (0,8 segundo), suspendendo a mira lateral nesse intervalo. Revalida
a direção em cada ciclo. O detector de falta de movimento troca de destino
após 12 ticks, em vez de 60. Não remove pausas de menu ou falta de chão seguro.
Um teste com feno à frente exige retomada em até 20 ticks no simulador.
Postes de cerca usam verificação do espaço ocupado pelo jogador contra o
poste estreito e suas conexões, em vez de bloquear a célula inteira. Conexões
a vizinhos são consideradas conservadoramente; não reproduz toda a física do
Minecraft. Um teste confirma saída ao lado do poste sem atravessá-lo.

## Culturas e venda automática

Reconhece trigo, batata, cenoura, fungo do Nether (`nether_wart`), fungo carmesim
e distorcido. Não replanta nem verifica maturidade: depende do servidor.

Abre `/farms` somente ao detectar “Armazém cheio” no chat, título ou actionbar.
Procura `Vender Trigo`, `Vender Batatas`, `Vender Cenouras` ou `Vender Fungos`
conforme o menu `Fazenda de Trigo`, `Fazenda de Batata(s)`,
`Fazenda de Cenoura(s)` ou `Fazenda de Fungo(s)`/`do Nether`.

Clica uma vez no botão correspondente do menu superior. Não escolhe botões
ambíguos nem itens do inventário do jogador. Fecha após confirmação ou um
segundo depois do clique e retoma o percurso; sem recibo ou alteração da
quantidade, informa que o saldo não foi confirmado. Há intervalo para evitar
vendas repetidas devido a aviso antigo. Outros nomes de menu exigem ajuste.

## Validação

```sh
node --check macros/jsmacros/batata-ziguezague.js
node macros/jsmacros/tests/batata-ziguezague.test.js
```

85 testes com APIs simuladas, incluindo um raycast geométrico em 3D para trigo lateral. Incluem passeio variando os dois eixos, paredes,
limites, rotação limitada a 12 graus por tick, ataque com avanço e corrida, venda de trigo e retomada. Os testes anteriores
conservam validação dos modos antigos. O simulador não reproduz alcance visual,
física, velocidade de corrida, crescimento, latência ou menus reais do servidor.
Não foi executada no Minecraft, não há teste de 24 horas nem comprovação de
correção do lag relatado. O movimento aleatório não garante colheita completa.
