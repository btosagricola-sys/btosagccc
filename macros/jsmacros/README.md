# Macro de batata — JsMacros / Minecraft 1.21.4

## Instalar a v10

Pare a macro anterior e substitua **todo** o código por `batata-ziguezague.js`.
`batata-ziguezague.txt` é a mesma versão como documento de texto, para copiar e
colar no editor do JsMacros. Vincule a uma tecla livre (ex.: F6), gatilho ao
pressionar, sem repetição. A mesma tecla inicia e para. Confirme `Zigue-zague v10`
no chat. O nome antigo do arquivo foi mantido para facilitar a atualização.

## Padrão: zigue-zague de ida e volta pelo percurso inteiro

`REVERSE_FIELD_SWEEP = true` é o padrão da v9. A macro colhe várias fileiras
em zigue-zague. No degrau, retorna uma vez pela fileira atual para sair da
beirada; no outro limite, tenta a próxima fileira antes de inverter novamente.
Ao acabar as fileiras de um lado, inverte o sentido lateral do percurso,
retorna pela última fileira e revisita as anteriores em ordem inversa. Quando
chega ao limite oposto, inverte o percurso de novo.

O retorno pela mesma fileira é uma manobra de saída, não um circuito permanente
em uma única linha. A decisão na segunda beirada tenta trocar de fileira
primeiro, evitando que degraus nas duas pontas prendam a macro nessa linha.
Os testes verificam uma sequência de fileiras `0, -1, -2, -1, 0, -1, -2`.

Comece na primeira fileira, olhando ao longo dela, com as próximas fileiras à
direita. `SIDE = -1` troca para a esquerda; `ROW_WIDTH` define o espaçamento.
Mantém W + Ctrl durante a colheita. Movimento/ataque são soltos para alinhar a
virada pelo arco mais curto. Não desce degraus. Os caminhos exigem apoio no nível
inicial e espaço para pés e cabeça. Obstáculos no meio da plantação podem
provocar um desvio lateral, conforme as versões anteriores.

Não replanta nem verifica maturidade. A continuidade da produção depende do
crescimento/replantio do servidor. Sem passagem segura ou sem plantas, o modo
contínuo aguarda e tenta retomar. Calibra a altura inicial se uma planta foi
interpretada como piso. Uma queda acidental ainda pode tentar quatro pulos
para voltar ao patamar.

Os modos antigos ficam disponíveis para regressão/configuração:
`REVERSE_FIELD_SWEEP = false` e `RETURN_SAME_ROW = true` reproduzem a v8 de
linha única. A v9 usa `RETURN_SAME_ROW = false` para não repetir aquele problema.

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

A sintaxe e **57 testes com APIs simuladas passaram**. Cobrem ida e volta
repetida na mesma linha, limites, degraus, venda, parada manual, crescimento,
menus, recuperação, rotação e redução de chamadas com cache sem alterar o
resultado. O modo anterior é usado em parte dos testes de regressão; os testes
novos também exercitam as opções padrão da v10.

Ainda falta validar o script na instalação/servidor real e fazer um ensaio longo.


## Validação específica da v9

Três testes novos exercitam as opções padrão: percurso por várias fileiras em
ambos os sentidos, retorno de saída no degrau sem ficar numa única linha e
parada manual durante a inversão, respeitando o limite angular. Total atual:
55 testes simulados passaram. A venda e as otimizações de leitura permanecem.
Não houve ensaio real de 24 horas nem medição de FPS no cliente do usuário.


## v10: retorno de saída único e continuação pelo lado superior

A primeira manobra de saída do degrau é registrada. Depois dela, novas beiradas
não disparam esse retorno pela mesma fileira novamente: a macro tenta primeiro
a próxima fileira e continua o zigue-zague. O retorno de inversão do percurso
inteiro permanece quando realmente acabam as fileiras do lado atual.

Após a primeira manobra, compara ambos os lados usando até três fileiras
conectadas e seis blocos ao longo do sentido de retorno. Só pontua plantas com
apoio e espaço no nível inicial. Se o lado oposto tem mais continuação segura,
corrige o sentido lateral para esse lado. Isso é uma avaliação local, não um
mapa completo da plantação. Uma nova fileira também precisa ter passagem para
o primeiro bloco à frente, evitando escolher um destino logo contra a beirada.

Os 57 testes simulados passaram. As duas regressões novas verificam que o
retorno de saída ocorre uma única vez e que um lado com mais fileiras superiores
é escolhido em vez de avançar para a borda rebaixada. Ainda falta confirmar o
percurso no jogo real.
