# Minerar e vender v5 — JsMacros

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

Após dois minutos pausa movimento e ataque, envia `/vender`, procura um único
botão `Vender` no menu `Vender`, clica uma vez e fecha após aproximadamente um
segundo. Se o servidor fechar ao clicar, retoma automaticamente. O próximo
intervalo de dois minutos começa após a retomada. Confira o recibo da venda:
o clique não comprova que a transação foi concluída.

Não clica no inventário do jogador. Em menu inesperado, botão ausente ou
duplicado, cursor ocupado ou erro de API, para e mostra o motivo. Menus manuais
pausam as ações; desconectar interrompe. Não reconecta nem resolve anti-macro.

## Compatibilidade e validação

Solicitada para o fork de JsMacros usado no Minecraft 1.8.9. A compatibilidade
com métodos de bloco, raycast e inventário depende da versão instalada.
Envie o aviso `[Minerar]` se continuar parada. Não foi testada nessa instalação.

```sh
node --check macros/jsmacros/minerar-vender.js
node macros/jsmacros/tests/minerar-vender.test.js
```

11 testes com APIs simuladas: venda, pausa, desconexão, mira, aproximação,
ar null, altura fracionária e continuidade dentro de buraco de um bloco.
Não reproduzem integralmente a física, tempo de quebra ou latência reais.
