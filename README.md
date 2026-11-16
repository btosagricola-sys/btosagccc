# Captcha Test — Forge 1.8.9

## Versão 1.1.0: menu com vidro verde

O código desta versão substitui a resposta por `/colher <codigo>` por um clique
no verde do menu mostrado pelo usuário. **O JAR 1.1.0 ainda não foi gerado:** o
ambiente bloqueia `maven.minecraftforge.net` com HTTP 403 ao resolver ForgeGradle.
Os arquivos em `downloads` das versões 1.0.x continuam sendo do modo antigo.

O cliente reconhece o título `VERIFICAÇÃO ANTI-MACRO`, ignorando cores, acentos
e maiúsculas/minúsculas. O menu deve ter exatamente 27 slots, com 26 vidros
vermelhos (metadata 14) e um verde-limão (5) ou verde (13). São aceitos blocos
e painéis de vidro colorido. A seleção usa somente o inventário superior do
menu; os itens do jogador não participam.

O alvo deve permanecer estável por 10 ticks. O mod faz um clique esquerdo
normal no slot atual, no máximo uma vez por abertura. Uma nova janela rearma a
seleção, mesmo que o verde apareça em outra posição. Se houver item no cursor,
o clique não é enviado. O mod não tenta novamente na mesma abertura nem clica
em padrões ambíguos. Uma interface que troca o desafio sem reabrir a janela
precisa de uma adaptação adicional.

## Uso após compilar

1. Feche o jogo, retire o JAR antigo e coloque somente o novo na pasta `mods`.
2. Inicie com Forge `1.8.9-11.15.1.2318-1.8.9`.
3. Antes de abrir o desafio, use `/captchatest preview` para simular: a posição
   encontrada será registrada no chat, sem clique.
4. Use `/captchatest on` e abra novamente o desafio para ativar o clique.
5. `/captchatest off` desativa. `/captchatest status` mostra estado e última ação.

O mod inicia desativado e volta a esse estado ao desconectar. Fechar o menu
normalmente é necessário para abrir o chat e executar os comandos do cliente.
Não é necessário instalar este mod no servidor.

## Compilar

Use JDK 8 e Gradle 2.14.1 na raiz do repositório:

```sh
gradle build --no-daemon
```

Resultado esperado: `build/libs/captcha-test-1.8.9-1.1.0.jar`.
O ForgeGradle 2.1 é legado. Neste ambiente, as ferramentas verificadas estão em
`/workspace/toolchains`; o init script `forge-legacy.init.gradle` nesse diretório
usa o host oficial `piston-data.mojang.com` para os downloads antigos do Minecraft
e verifica o SHA-1 publicado. A truststore local inclui as CAs do ambiente,
sem desativar a verificação TLS.

Para destravar o download do Forge nesta máquina, aplique nas configurações do
ambiente os domínios já registrados no rascunho, salve e publique o ambiente.
Salvar o rascunho por si só não altera a rede da máquina em execução.

## Validação

Os 8 testes JUnit de `GreenChallengeTest` foram executados com Java 8 e passaram.
Eles cobrem todas as 27 posições nas duas cores verdes, títulos formatados,
menus diferentes, ausência e ambiguidade do verde, slots inválidos, espera,
movimento durante a espera, cancelamento e um clique por abertura.

A compilação completa do mod e o clique dentro do Minecraft ainda não foram
validados para a versão 1.1.0 devido ao bloqueio do Forge. No servidor de teste,
verifique o modo preview, o modo ativo, a reabertura com outra posição, o comando
off e a desconexão. Confirme que menus comuns e o inventário do jogador não
recebem cliques.
