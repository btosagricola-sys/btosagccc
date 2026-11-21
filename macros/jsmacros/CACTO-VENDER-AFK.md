# Vender cacto AFK — script separado

Copie `cacto-vender-afk.txt` para um novo arquivo JavaScript no JsMacros.
Execute uma vez para iniciar; execute novamente para parar. Pode vincular
a uma tecla livre, diferente da macro de mineração, sem repetição.

Preset do mesmo menu mostrado nas imagens: a cada dois minutos, envia
`/vender`, espera o menu `Vender` carregar e faz um clique esquerdo no
slot 10 (segunda linha, segunda coluna). Fecha depois de aproximadamente
um segundo. O próximo intervalo começa após fechar o menu. Se o comando
não abrir o menu, tenta novamente depois de 30 segundos.

Não chama APIs de movimento, câmera ou ataque. Menus abertos manualmente
adiam o envio do comando. Desconectar interrompe; não reconecta e não impede
o servidor de expulsar jogadores AFK. Use separadamente da macro de mineração
para não haver dois scripts abrindo o mesmo menu.

O botão da imagem vende os itens aceitos pelo servidor. O script não filtra
somente cacto; se o servidor usa um menu específico de cacto, é necessário
ajustar `COMMAND`, `MENU_TITLE` e `SELL_SLOT`. O clique não confirma a venda:
confira o recibo do servidor. O preset deve ser conferido na instalação 1.8.9.

Validação: `node --check macros/jsmacros/cacto-vender-afk.js` e
`node macros/jsmacros/tests/cacto-vender-afk.test.js` (APIs simuladas).
