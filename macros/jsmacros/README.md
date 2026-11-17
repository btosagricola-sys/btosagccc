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
