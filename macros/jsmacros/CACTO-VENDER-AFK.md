# Cacto AFK v2 — /armazem

Pare a macro AFK anterior e substitua todo o código por `cacto-vender-afk.txt`
em um script separado no JsMacros. Execute uma vez para iniciar e novamente
para parar. Não precisa manter uma tecla pressionada.

A cada dois minutos envia `/armazem`, espera seis ticks, procura um único
item com nome Cacto/Cactos ou ID `minecraft:cactus` no menu superior e faz
clique esquerdo nele. Confere que o título é de armazém/armazenamento. Não usa
mais `/vender` nem o slot fixo 10 do menu de mineração. Fecha o armazém cerca
de um segundo depois do clique e agenda o próximo ciclo.

Não movimenta nem minera. Não escolhe itens do inventário do jogador.
Se faltar o menu ou botão, tenta de novo em 30 segundos. Havendo vários
botões de cacto, título inesperado ou erro de API, informa o motivo e para.
Desconectar interrompe; não reconecta nem impede kick por inatividade.
O clique não confirma a venda: confira o recibo do servidor. Se clicar no
cacto abrir outra tela em vez de vender, envie uma imagem dessa tela para
configurar a confirmação. Use separadamente das outras macros com menus.

A compatibilidade com o fork JsMacros 1.8.9 depende dos métodos de inventário
instalados. Se aparecer `[Cacto AFK] Parada:`, envie a linha completa.

Validação: nove testes com APIs simuladas e checagem de sintaxe. Não foi
executada no servidor real.

```sh
node --check macros/jsmacros/cacto-vender-afk.js
node macros/jsmacros/tests/cacto-vender-afk.test.js
```
