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
Durante o contorno usa movimento lento, sem salto, para reduzir colisões. A
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
