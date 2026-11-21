# Minerar e vender v10 — JsMacros

Substitua todo o código de seu script pelo conteúdo de `minerar-vender.txt`.
Selecione esse arquivo (não a pasta Macros) e execute pelo JsMacros. Também
pode vincular a uma tecla, como F7, ao pressionar, sem repetição. Executar o
mesmo script novamente solicita a parada. Equipe uma picareta dentro da mina.

## Mineração e movimento

Seleciona pedra e minérios à frente e ao redor, no chão, nos pés e na altura
da cabeça. Mira gradualmente e mantém ataque no primeiro minério visível ao
alcance, sem esperar por um alvo oculto atrás dele. Minera blocos próximos
parado; avança quando precisa se aproximar. Reescolhe o alvo após a quebra.

Usa o nível atual do jogador: permite descida de um bloco com apoio sólido e
espaço livre, continuando a mineração no novo nível. Não salta para subir nem
entra voluntariamente em queda maior. Evita quebrar os blocos sob os pés.
Verifica o volume do jogador até 0,6 bloco à frente antes de avançar.

`RADIUS = 0` remove o limite artificial de 16 blocos. O alcance normal da
picareta continua valendo. Um valor positivo restaura limite em X e Z a partir
da posição inicial. Não reconhece os limites da região do servidor e não
calcula uma rota global pela mina. Pode precisar de intervenção se ficar sem
passagem ou sem minério acessível; não há garantia de funcionamento contínuo.
`AUTOWALK = false` restaura mineração parada na mira.

Reconhece pedra, pedregulho, minérios da 1.8.9 e blocos de recursos (lápis,
diamante, esmeralda, ouro, ferro, carvão e redstone). Não minera blocos fora
dessa lista. Ar retornado como null é aceito somente junto à confirmação de
apoio; chunks descarregados são rejeitados quando há API de consulta.

## Venda

Após dois minutos ou ao receber “inventário cheio” no chat, pausa movimento e ataque, envia `/vender`, aguarda seis ticks e clica
com botão esquerdo no slot 10 do menu `Vender`, uma vez, e fecha após aproximadamente um
segundo. Se o servidor fechar ao clicar, retoma automaticamente. O próximo
intervalo de dois minutos começa após a retomada. Confira o recibo da venda:
o clique não comprova que a transação foi concluída.

Usa a posição fixa autorizada na imagem: segunda linha, segunda coluna do menu
de três linhas. Não pesquisa nomes de itens, mapeamento de slots nem cursor.
Deixe o cursor vazio antes de iniciar. Se o layout do servidor mudar, ajuste
`SELL_SLOT` antes de usar. Em menu com outro título ou erro de API, para e mostra
o motivo. Outros menus manuais pausam as ações; desconectar interrompe.

## Compatibilidade e validação

Solicitada para o fork de JsMacros usado no Minecraft 1.8.9. A compatibilidade
com métodos de bloco, raycast e inventário depende da versão instalada.
Envie o aviso `[Minerar]` se continuar parada. Não foi testada nessa instalação.

```sh
node --check macros/jsmacros/minerar-vender.js
node macros/jsmacros/tests/minerar-vender.test.js
```

19 testes com APIs simuladas: venda, pausa, desconexão, mira, aproximação,
ar null, altura fracionária e continuidade dentro de buraco de um bloco.
Não reproduzem integralmente a física, tempo de quebra ou latência reais.

## Reset da mina e retomada

Ao subir mais de 0,75 bloco de uma vez ou mudar de posição bruscamente,
limpa o alvo anterior e bloqueios temporários, solta as ações por um ciclo
e procura blocos na posição atual. Não reinicia o intervalo de venda.
Se um alvo fica bloqueado ou não muda em quatro segundos, tenta outro.
Não depende do texto específico de reset enviado pelo servidor.

Inclui esponja normal/molhada. Bedrock não é alvo de ataque; alvos encobertos
por ela são adiados. A venda usa o slot fixo autorizado na imagem,
sem procurar cor ou nome do item. O aviso de inventário usa `RecvMessage` e depende
dessa API no fork instalado; a venda a cada dois minutos continua independente.
Depois de vender, aguarda cinco segundos para aceitar outro aviso de cheio.
O chat mostra o motivo ao enviar `/vender`. Se constar “Parada: desativada”,
o script recebeu uma solicitação de parada: execute uma vez para iniciar
e deixe a execução ativa.

## Clique no menu da versão 1.8.9

A v10 clica diretamente no slot 10 com `inv.click(10, 0)`, conforme solicitado
pelo usuário com base na imagem. Confere somente o título `Vender` antes do
clique e espera seis ticks para carregar. Não chama `getHeld`, `getSlots`,
`getSlot` ou `getName` durante a venda. Se abrir esse menu manualmente durante
a execução, a macro também o reconhece e realiza a venda.
Caso continue parando, envie a linha completa após `[Minerar] Parada:` para
identificar se há outro método incompatível. Não foi executado no servidor real.

## Câmera e escolha dos alvos

A v10 seleciona alvos dentro de um cone frontal de 120 graus na direção do
percurso, também limitados à frente da câmera. Descarta um alvo que ficou
atrás depois do movimento. A rotação é limitada a seis graus por ciclo.
Mudanças de percurso são concluídas antes de escolher novos alvos: não mistura
a virada de saída com a mira de mineração. Pode virar para os lados ou para
trás quando não houver mais alvos à frente, ou para sair de uma parede.
Não elimina mudanças de direção necessárias para continuar a mineração.
