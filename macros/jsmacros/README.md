# Batata em linha reta — JsMacros / Minecraft 1.21.4

Arquivo: `batata-reta.js`. É um script para JsMacros, não um mod JAR.

## Instalar

1. Instale JsMacros compatível com o seu Minecraft 1.21.4 e o mecanismo JavaScript
   suportado por essa instalação.
2. Abra a pasta de scripts pelo menu do JsMacros e salve `batata-reta.js` nela.
3. No menu de teclas do JsMacros, vincule esse arquivo a uma tecla livre, como F6.
   Configure o gatilho para pressionar a tecla, sem repetição e sem disparar ao soltar.
4. Entre na plantação, selecione a ferramenta e alinhe o personagem no centro da
   fileira. Aperte F6 para começar e novamente para parar.

## Comportamento

- Mantém avanço, corrida (W + Ctrl nas teclas padrão) e ataque para colher.
- Usa as ações configuradas no jogo, inclusive se as teclas foram remapeadas.
- Alinha a direção ao eixo cardinal mais próximo e mantém a câmera fixa.
- Inclinação padrão: 35 graus para baixo. Ajuste `PITCH` no começo do arquivo
  se a mira não alcançar as plantas.
- Para ao abrir qualquer menu ou desconectar, soltando os comandos. Não retoma
  automaticamente depois de um menu.

A corrida depende das regras normais do jogo, como fome e colisões. A macro não
vira no fim da linha, não verifica a maturidade da batata e não replanta. Pare
antes do limite da plantação. Nenhuma função do antigo mod Forge foi adicionada
a este script.

## Validação

Sintaxe JavaScript conferida com Node. Seis testes com APIs simuladas cobrem
alternância pela mesma tecla, avanço/corrida/ataque, direção, abertura de menu,
desconexão, erro e recusa de início fora do mundo ou com menu aberto:

```sh
node macros/jsmacros/tests/batata-reta.test.js
```

As assinaturas utilizadas foram conferidas no código oficial do JsMacros.
Ainda é necessário validar na sua instalação 1.21.4; os testes simulados não
substituem o teste no Minecraft.

## Zigue-zague com troca de fileira

Use `batata-ziguezague.js` no lugar do arquivo reto. A cópia
`batata-ziguezague.txt` contém exatamente o mesmo código, como documento de texto
para copiar e colar no editor JavaScript do JsMacros. Desvincule a macro antiga
para evitar que ambas controlem as mesmas teclas.

Comece na primeira fileira, olhando ao longo dela, com as próximas fileiras à
sua direita. O script alinha a direção ao eixo cardinal mais próximo e usa
`ROW_WIDTH = 1` (fileiras adjacentes, separadas por um bloco). Para ir para o
outro lado, altere `SIDE` de `1` para `-1`. Para fileiras com espaçamento diferente,
altere `ROW_WIDTH` para a distância entre os centros das fileiras.

A macro mantém avanço/corrida na fileira e só mantém ataque quando a mira
identifica `minecraft:potatoes`. Ao terminar a fileira, ela passa para o lado
sem corrida, vira 180 graus e segue na próxima fileira. Ela guarda a última
posição observada das plantas para não virar cedo só porque o ataque já
removeu os blocos próximos. A busca alcança seis blocos à frente; intervalos
maiores sem batata podem ser interpretados como fim da plantação.

Para quando não encontra batatas na próxima fileira, abre um menu, desconecta,
encontra chunk não carregado ou fica sem se mover por 60 ticks. A mesma tecla
inicia/para. Não replanta nem espera crescer de novo; não há colheita infinita
quando acabam as plantas. Pode colher plantas imaturas.

Sete testes com APIs simuladas passaram, incluindo uma plantação de três
fileiras completamente colhida na simulação, inversões, limites e parada.
A movimentação real no servidor ainda precisa ser testada:

```sh
node macros/jsmacros/tests/batata-ziguezague.test.js
```

## Zigue-zague com desvio

Use `batata-ziguezague.js`, ou copie o conteúdo de `batata-ziguezague.txt` para o
editor do JsMacros. Os dois arquivos têm o mesmo código. Substitua a versão
anterior; não execute as duas ao mesmo tempo.

Comece na primeira fileira, com as próximas fileiras à direita. `SIDE = -1`
inverte esse lado; `ROW_WIDTH` define o espaçamento, em blocos. A mesma tecla
inicia e para. O script corre durante a colheita e só ataca quando a mira aponta
para `minecraft:potatoes`.

Ao encontrar um bloco à frente, procura um caminho curto, com espaço para os pés
e a cabeça e chão de apoio, para retornar à fileira após o obstáculo. Na parede
ou no fim, tenta alcançar outra fileira no lado escolhido e inverter a direção.
Durante o contorno anda sem correr e sem agachar. A
busca local é limitada a 8 blocos; procura até 6 fileiras laterais. Não é um
navegador para terrenos arbitrários, escadas ou grandes labirintos.

Sem passagem, ou se o próprio desvio ficar travado, para e informa o motivo.
Menus, desconexão e a tecla de parada continuam liberando todos os comandos.
Não replanta nem reinicia automaticamente depois que acabam as batatas.

Nove testes simulados do zigue-zague passaram, incluindo um obstáculo de feno
de dois blocos de largura, colisão com a largura do jogador e parede no fim da
fileira com retorno colhendo. Ainda falta validar os desvios no Minecraft real.

```sh
node macros/jsmacros/tests/batata-ziguezague.test.js
```

### Recuperação ao cair um degrau

A macro registra o nível inicial da plantação e a última posição com apoio
nesse nível. Se cair aproximadamente um bloco, tenta voltar a essa posição,
soltando Shift e dando pulsos de pulo. Após detectar a volta ao chão, retoma a
fase anterior (colheita, troca de fileira ou desvio). O ataque continua limitado
às batatas na mira.

O retorno deve estar a até 3 blocos de distância horizontal e continuar livre.
Há no máximo quatro tentativas, em 80 ticks. Quedas de mais de aproximadamente
1,3 bloco, retorno bloqueado ou falha ao subir fazem o script parar e liberar
as teclas. O pulo pode alterar a farmland conforme as regras do servidor.

Treze testes com APIs e movimento simulados passaram: os nove cenários
anteriores, recuperação de um bloco com retomada da colheita, limite de quatro
tentativas, liberação do pulo ao abrir menu e parada em queda profunda. A física
real do salto e as regras deste servidor ainda precisam de teste no jogo.

## Armazém cheio: venda automática

O script monitora `Title` (incluindo actionbar, acima da hotbar) e `RecvMessage`
para detectar `Armazém cheio`, sem depender de acentos ou cores. Ao receber o
aviso, solta os comandos de movimento/ataque/pulo e envia `/farms` uma vez.

Espera até 5 segundos pelo menu `Fazenda de Batata` ou `Fazenda de Batatas`.
Procura exatamente um item chamado `Vender Batatas` nos slots superiores do menu,
ignorando o inventário do jogador. Envia um único clique normal. Se houver um
item no cursor, cancela sem clicar.

Após clicar, espera confirmação: mensagem do servidor indicando venda de
batatas (como `Você vendeu ... batatas`) ou a descrição do botão mostrando
`Quantidade: 0 batatas`. Só então fecha o menu e retoma a mesma fase do percurso,
desde que o jogador não tenha sido deslocado significativamente. Um intervalo
de 5 segundos evita reabrir o menu por repetições do aviso anterior.

Se o comando abrir outro menu, o botão não existir, houver botões ambíguos ou a
venda não for confirmada em 5 segundos, a macro para e registra o motivo. Não
presume venda concluída apenas porque o menu fechou. Se o servidor usar outra
mensagem de confirmação ou outro caminho de menus, envie esse texto para ajustar.
A tecla de parada e a desconexão continuam funcionando durante a venda. Os
listeners são removidos ao encerrar o script.

A sintaxe e 21 testes com APIs simuladas passaram, incluindo a venda, retomada,
timeout, menu inesperado, itens do jogador, item no cursor e avisos repetidos.
Ainda é necessário testar as mensagens e menus no servidor real.

## Correção de falso obstáculo por altura

A navegação e o replanejamento usam o nível da plantação registrado ao iniciar,
em vez de recalcular `ceil(Y)` a cada tick. Pequenas oscilações nos pés sobre
farmland não fazem mais a leitura passar um bloco acima e interpretar plantas
como ausência de chão. A recuperação por salto continua tratando quedas.

A macro confirma uma passagem obstruída por 3 leituras antes de desviar. Se um
ponto do desvio parecer bloqueado, para o movimento, espera até 10 leituras e
replaneja, em vez de encerrar imediatamente. Quando não existe caminho, registra
coordenadas e os IDs dos blocos nos pés, cabeça e chão para diagnóstico.

A sintaxe e 23 testes simulados passaram, incluindo as novas regressões de
oscilação de altura com e sem obstáculo real. Essa correção trata uma condição
reproduzida nos testes; a causa exata da parada no servidor ainda precisa ser
confirmada no jogo. Se acontecer novamente, envie a mensagem completa com IDs.


## Zigue-zague v2: recuo, sem agachar e leitura direta do aviso

Ao iniciar, a mensagem contém `Zigue-zague v2: sem agachar, com recuo e venda automatica`.
Use essa mensagem para confirmar que substituiu o código antigo inteiro.

O script nunca pressiona Shift/agachar. Se não encontra passagem, verifica o
chão atrás e recua até 2 blocos usando a ação de andar para trás. Depois tenta
outra fileira e, se necessário, tenta novamente contornar pela mesma fileira.
Há no máximo três recuos consecutivos antes de parar; após voltar a andar pela
fileira e se afastar do local, o limite é rearmado. A parada, menus e a venda
também liberam a tecla de recuo. Ele não recua para uma posição sem apoio.

A leitura de `Armazém cheio` agora inclui o texto atual do título e da actionbar,
mesmo se o evento correspondente não chegar. Os nomes de campos Yarn/intermediary
foram conferidos nas mappings oficiais do Minecraft 1.21.4. Se essa leitura não
estiver disponível na instalação, o chat avisa e os listeners continuam ativos.
O envio continua sendo `/farms`, conforme solicitado. A mensagem local
`Armazem cheio: abrindo /farms para vender` indica que a detecção ocorreu.

A navegação mantém os limites longitudinais já observados da plantação, para
não encurtar o retorno só porque o desvio já colheu plantas da próxima fileira.

A sintaxe e 28 testes com APIs simuladas passaram. As novas verificações cobrem
ausência de Shift, recuo com retomada, parada durante recuo e detecção direta de
título/actionbar sem eventos. Ainda falta validar no jogo a leitura do HUD e o
comando/menu do servidor. Esse resultado não confirma que o problema observado
no servidor foi resolvido até executar a versão nova nele.
