# Macro de batata — JsMacros / Minecraft 1.21.4

## Instalar a v8

Pare a macro anterior e substitua **todo** o código por `batata-ziguezague.js`.
`batata-ziguezague.txt` é a mesma versão como documento de texto, para copiar e
colar no editor do JsMacros. Vincule a uma tecla livre (ex.: F6), gatilho ao
pressionar, sem repetição. A mesma tecla inicia e para. Confirme `Zigue-zague v8`
no chat. O nome antigo do arquivo foi mantido para facilitar a atualização.

## Padrão: ida e volta na mesma fileira

`RETURN_SAME_ROW = true` faz a macro virar 180 graus na beirada, no degrau para
baixo ou no limite observado da plantação e retornar pela **mesma fileira**.
Ao chegar ao outro limite, inverte de novo. Ela não muda de linha nem desce
nesses pontos. Mantém W + Ctrl durante a colheita e solta movimento/ataque para
se alinhar durante a virada, pelo caminho angular mais curto.

Comece olhando ao longo da fileira, com a ferramenta selecionada. A direção é
alinhada ao eixo cardinal mais próximo. A colheita só ataca batatas na mira e
no nível inicial da plantação. Não replanta nem verifica maturidade. O circuito
pode esperar plantas novas ou percorrer a fileira já colhida enquanto elas
crescem, conforme o que o servidor mantiver nos blocos.

Se houver um obstáculo dentro da fileira com batatas do mesmo nível além dele,
o desvio lateral anterior continua disponível. O retorno na própria fileira
é usado para os limites e degraus. Se o retorno não tiver chão seguro, aguarda
em vez de forçar a passagem. Uma queda acidental ainda pode tentar até quatro
pulos para voltar à última posição válida. Nunca planeja uma descida.

`RETURN_SAME_ROW = false` mantém o modo anterior de troca de fileiras. `SIDE` e
`ROW_WIDTH` se aplicam aos desvios e a esse modo anterior.

## Operação contínua

`CONTINUOUS = true` mantém o script ativo quando falta passagem ou planta.
Solta as teclas, aguarda `RETRY_TICKS` (60 ticks, aproximadamente 3 s) e tenta
novamente. Em menus alheios fica aguardando o fechamento. Se a conexão sumir,
espera voltar e reavalia a plantação; não faz login ou reconexão por conta própria.

O script calibra a altura inicial se detectar `chao=minecraft:potatoes` com
apoio válido abaixo. A calibração inicial não permite que ele desça durante
o percurso. Fora do patamar original ou sem retorno seguro, não força movimento.
Erros do cliente/API ou um menu de venda incompatível podem exigir intervenção.
Não há garantia de execução ininterrupta por 24 h sem teste prolongado no jogo.

## Venda: somente armazém cheio

Não há venda por tempo. O aviso `Armazém cheio` é lido por evento de chat/título
ou diretamente nos textos de título/actionbar. Cores RGB legadas, acentos e
caracteres invisíveis são normalizados. O chat registra os canais disponíveis,
o reconhecimento do aviso, o envio de `/farms` e eventuais erros.

A macro pausa, envia `/farms`, procura `Vender Batatas` nos slots superiores do
menu `Fazenda de Batata`/`Fazenda de Batatas` e clica uma vez. Não pesquisa o
inventário do jogador e cancela se houver item no cursor ou botão ambíguo.
Após confirmação, ou até um segundo depois do clique, fecha o menu e retoma.
Sem recibo/atualização de saldo, o chat deixa claro que o clique foi enviado,
mas a venda não pôde ser confirmada. A falha em achar menu/botão tem diagnóstico.

## Redução de processamento

- Leituras de blocos/chunks são reutilizadas dentro do mesmo ciclo e descartadas
  antes do seguinte, para não acumular dados antigos nem crescer sem limite.
- O HUD é consultado a cada 4 ticks durante a colheita, mantendo eventos e uma
  frequência maior enquanto a venda está em andamento.
- Não faz ray trace quando não está colhendo. Os logs de HUD ignoram contadores
  comuns de ganho de batata, focando armazém/venda e erros.
- Retornar na mesma fileira evita as buscas de rota nas beiradas comuns.

Isso reduz chamadas no teste simulado. Não mede nem garante melhora de FPS,
ping ou desempenho do servidor real.

## Validação

```sh
node --check macros/jsmacros/batata-ziguezague.js
node macros/jsmacros/tests/batata-ziguezague.test.js
```

A sintaxe e **52 testes com APIs simuladas passaram**. Cobrem ida e volta
repetida na mesma linha, limites, degraus, venda, parada manual, crescimento,
menus, recuperação, rotação e redução de chamadas com cache sem alterar o
resultado. O modo anterior é usado em parte dos testes de regressão; os testes
novos também exercitam as opções padrão da v8.

Ainda falta validar o script na instalação/servidor real e fazer um ensaio longo.
