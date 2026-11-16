# Captcha Test — Forge 1.8.9

## Versão 1.1.1: menu com vidro verde

O código desta versão substitui a resposta por `/colher <codigo>` por um clique
no verde do menu mostrado pelo usuário. **JAR 1.1.1 compilado:** `downloads/captcha-test-1.8.9-1.1.1.jar`.
O build completo, os 8 testes e a verificação do JAR passaram.
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
3. Ao entrar no servidor, o clique é ativado automaticamente; não é necessário
   digitar comandos.
4. Opcionalmente, `/captchatest preview` simula sem clicar e `/captchatest on`
   reativa o clique.
5. `/captchatest off` desativa durante a sessão. `/captchatest status` mostra
   estado e última ação.

Cada nova conexão ativa o mod no modo de clique. Desativar ou simular vale
somente para a sessão atual; ao reconectar ele volta a clicar automaticamente. Fechar o menu
normalmente é necessário para abrir o chat e executar os comandos do cliente.
Não é necessário instalar este mod no servidor.

## Compilar

Use JDK 8 e Gradle 2.14.1 na raiz do repositório:

```sh
gradle build --no-daemon
```

Resultado esperado: `build/libs/captcha-test-1.8.9-1.1.1.jar`.
O ForgeGradle 2.1 é legado. Neste ambiente, as ferramentas verificadas estão em
`/workspace/toolchains`; o init script `forge-legacy.init.gradle` nesse diretório
usa o host oficial `piston-data.mojang.com` para os downloads antigos do Minecraft
e verifica o SHA-1 publicado. A truststore local inclui as CAs do ambiente,
sem desativar a verificação TLS.

O acesso ao Forge foi confirmado nesta máquina após a atualização da rede.
As dependências foram baixadas com TLS e verificação de checksums.

## Validação

Os 8 testes JUnit de `GreenChallengeTest` foram executados com Java 8 e passaram.
Eles cobrem todas as 27 posições nas duas cores verdes, títulos formatados,
menus diferentes, ausência e ambiguidade do verde, slots inválidos, espera,
movimento durante a espera, cancelamento e um clique por abertura.

A compilação completa do mod e os 8 testes passaram para a versão 1.1.1.
O clique dentro do Minecraft ainda precisa ser validado. No servidor de teste,
verifique o modo preview, o modo ativo, a reabertura com outra posição, o comando
off e a desconexão. Confirme que menus comuns e o inventário do jogador não
recebem cliques.
