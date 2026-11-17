# Macros de batata — JsMacros / Minecraft 1.21.4

## Instalação

`batata-ziguezague.js` é o script atual (v4). `batata-ziguezague.txt` contém o
mesmo código, para copiar e colar no editor do JsMacros. Pare a cópia anterior
e substitua todo o conteúdo. Vincule a uma tecla livre, como F6, no evento de
pressionar a tecla. Ela inicia e para. Confirme `Zigue-zague v4` no chat.
São scripts JavaScript para JsMacros, não mods JAR. Ainda precisam ser validados
na instalação 1.21.4 do usuário.

`batata-reta.js` é a alternativa simples de linha reta, sem zigue-zague ou venda.
Não execute as duas macros ao mesmo tempo.

## Percurso atual

Comece na primeira fileira, olhando ao longo dela, com as próximas fileiras à
direita. `SIDE = -1` troca para a esquerda; `ROW_WIDTH` define o espaçamento.
A macro mantém avanço e corrida (W + Ctrl nas teclas padrão). Só ataca quando
a mira aponta para `minecraft:potatoes`; não replanta nem verifica maturidade.

As viradas usam o arco angular mais curto, limitadas por `TURN_STEP` (10 graus
por tick). O movimento espera o alinhamento. A rota não volta para o centro da
posição inicial antes de seguir. Pontos ligeiramente ultrapassados são aceitos
sem inverter a câmera para andar alguns centímetros para trás.

No meio da plantação, um obstáculo leva a um deslocamento lateral curto para
uma fileira com passagem e batatas à frente, mantendo o sentido da colheita.
Não tenta contornar para retornar à fileira original. Isso pode deixar plantas
na parte bloqueada da fileira anterior. No fim/parede, busca uma fileira lateral
e inverte o sentido. Sem passagem, tenta recuar até 2 blocos com apoio atrás,
com limites de tentativas e de repetição por região. Não usa Shift/agachar.

Desce um bloco quando há apoio e batatas no nível inferior, atualizando a
altura da navegação. Quedas acidentais de um bloco continuam usando até quatro
tentativas de salto para voltar à última posição válida. Não tenta saltar
buracos profundos. Sem chão, passagem ou recuperação possível, para e informa
o motivo. Menus alheios, desconexão e a tecla de parada soltam todos os comandos.

## Venda: somente com armazém cheio

**Não há venda periódica.** A única abertura automática de `/farms` vem da
detecção de `Armazém cheio`, por chat, título ou actionbar. Outros avisos, como
inventário cheio sem referência ao armazém, não acionam a venda.

Ao detectar o aviso, pausa os comandos, envia `/farms` e espera pelo menu
`Fazenda de Batata`/`Fazenda de Batatas`. Procura exatamente um item `Vender Batatas`
nos slots superiores, nunca nos itens do jogador. Cancela se houver item no cursor.
Envia um único clique normal e fecha o menu quando há confirmação ou, no máximo,
um segundo após o clique. Então retoma a mesma fase e posição do percurso.

Quando o servidor confirma por mensagem, quantidade menor/zero ou botão
`Armazém vazio`, o chat registra venda confirmada. Se o menu não atualizar nem
enviar recibo, ele também fecha e a colheita retorna, mas o chat diz explicitamente
que o saldo não foi confirmado; **clicar e fechar não prova que a venda ocorreu**.
O aviso cheio pode acionar nova tentativa após o intervalo de proteção de 5 s.
Se o menu ou botão não aparecer em 5 s, a macro para com diagnóstico e fecha o
menu reconhecido. Não clica em outro menu nem em botões ambíguos.

A leitura direta do HUD usa os nomes Yarn/intermediary conferidos para 1.21.4.
Se ela falhar, o chat mostra o erro e os eventos continuam ativos; não há venda
por tempo como substituição. Envie a mensagem completa se o aviso não for lido.

## Validação

```sh
node --check macros/jsmacros/batata-ziguezague.js
node macros/jsmacros/tests/batata-ziguezague.test.js
```

A sintaxe e 35 testes com APIs simuladas passaram. Eles incluem colheita,
desvio lateral, ausência de Shift, recuo, degrau, salto, parada e desconexão,
HUD/chat, venda, fechamento com menu desatualizado, nenhuma venda por tempo,
e medição do arco de virada em ambos os sentidos.

Esses testes não executam Minecraft nem validam a comunicação com o servidor
real. As APIs usadas foram conferidas no código oficial do JsMacros. A confirmação
final das mensagens, da venda e do movimento depende do teste no jogo.
