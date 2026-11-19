# Colheita livre — JsMacros / Minecraft 1.21.4 — v20

Pare a macro anterior e substitua todo o código no editor JavaScript do JsMacros
pelo conteúdo de `batata-ziguezague.txt`. O `.js` e o `.txt` são idênticos.
Vincule a F6, ao pressionar, sem repetição. A mesma tecla inicia e para.
Confira `Zigue-zague v20` no chat ao iniciar.

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

`HARVEST_WIDTH = 3` procura plantas na frente e nas duas faixas laterais.
A mira lateral permanece por cerca de oito ticks antes da próxima fase;
as mudanças de câmera são graduais, pelo arco mais curto. Prefere plantas
laterais mais adiante para reduzir o ângulo. Durante a mira lateral, pausa o
avanço; depois volta a mirar para a direção de movimento e retoma a corrida.
A largura é uma tentativa de varredura, não quebra simultânea nem aumento de
alcance. O ataque exige uma cultura suportada na mira, no Y e área corretos.

Mantém W + corrida (Ctrl nos controles padrão), sem agachar. Câmera central a
30 graus para baixo. A corrida depende das condições normais do Minecraft.
Menus, parada manual e desconexão soltam as teclas. Não faz login automático.
Se cair acidentalmente um bloco, conserva a tentativa de retorno por salto
quando existe um ponto seguro próximo. Pode precisar de intervenção se não
houver nenhuma direção segura.

`FREE_ROAM = false` restaura o percurso por fileiras; `RANDOM_ROWS` controla a
ordem delas nesse modo. `HARVEST_WIDTH = 1` desliga a varredura lateral.
`AREA.enabled = false` habilita a navegação local antiga para regressão.

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

82 testes com APIs simuladas. Incluem passeio variando os dois eixos, paredes,
limites, rotação gradual, venda de trigo e retomada. Os testes anteriores
conservam validação dos modos antigos. O simulador não reproduz alcance visual,
física, velocidade de corrida, crescimento, latência ou menus reais do servidor.
Não foi executada no Minecraft, não há teste de 24 horas nem comprovação de
correção do lag relatado. O movimento aleatório não garante colheita completa.
