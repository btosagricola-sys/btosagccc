# Captcha Test — Forge 1.8.9

Mod cliente em Java para testar desafios numéricos no seu servidor.

## Estado

Compilação concluída com ForgeGradle e remapeamento de produção (`reobfJar`).
JAR: `build/libs/captcha-test-1.8.9-1.0.1.jar` (Java 8).
O conteúdo ZIP, os metadados e a versão das classes foram verificados.
Ainda não foi executado no cliente Minecraft nem testado com o antimacro real.

Neste ambiente, Java 8 e Gradle 2.14.1 estão em `/workspace/toolchains`.
O init script `forge-legacy.init.gradle` nesse diretório atualiza somente os URLs
legados de download do cliente/servidor para o host oficial `piston-data.mojang.com`
e confere o SHA-1 original dos arquivos. A truststore local incorpora as CAs do
ambiente, mantendo a verificação TLS ativa.

## Compilar

Em uma máquina com **JDK 8** e **Gradle 2.14.1**, execute na raiz:

```sh
gradle setupDecompWorkspace --no-daemon
gradle build --no-daemon
```

O ForgeGradle legado pode exigir ajustes de infraestrutura devido à idade.
Não desative TLS, assinaturas ou checksums para contornar falhas de download.
O resultado esperado é `build/libs/captcha-test-1.8.9-1.0.1.jar`.
Copie esse arquivo para a pasta `mods` do cliente com Forge
`1.8.9-11.15.1.2318-1.8.9`. O mod não deve ser instalado no servidor.

## Usar

1. Entre no seu servidor de teste. O mod inicia desativado.
2. Execute `/captchatest preview`: mostra localmente o comando `/colher <codigo>`, sem enviar.
3. Execute `/captchatest on`: envia `/colher <codigo>` após 20 ticks.
4. Execute `/captchatest off` para parar ou `/captchatest status` para consultar.

O mod volta ao estado desativado ao desconectar ou trocar de conexão.
Ele reconhece somente títulos/subtítulos do Minecraft que contenham de 1 a 16
dígitos ASCII, com possíveis códigos de cor ou espaços nas extremidades.
Não faz OCR e não lê mapas, inventários, boss bars ou desenhos de outros mods.
Uma frase como `Digite 1234` não é reconhecida. Outros títulos numéricos, como
contagens regressivas, também podem ser respondidos quando o envio está ativo.
Um título idêntico, reapresentado sem mudança observável entre ticks, não gera
uma nova resposta.

## Validação no servidor

Com permissão administrativa, use no servidor de teste:

```text
/title SEU_NICK title {"text":"1234"}
```

Em preview, deve aparecer a detecção local sem mensagem no servidor.
Em modo on, deve ser enviado `/colher 1234` após aproximadamente um segundo.
Teste também um título não numérico, o comando off e a reconexão.
Depois repita com o antimacro real para confirmar que usa esse mecanismo.
Esses testes ainda não foram executados no ambiente de criação.

## Como funciona e como melhorar o bloqueio

O cliente já recebe o título como texto. Este mod lê os campos de título da GUI
com os nomes de desenvolvimento e os nomes SRG usados pelo Forge, remove as
cores e envia `/colher` seguido dos dígitos. Não é necessário reconhecer uma imagem.

Enviar o desafio como texto permite que qualquer cliente modificado o leia.
Trocar a posição ou a cor não remove essa limitação. Mesmo um desafio em imagem
não garante resistência a automação. Mantenha a validação no servidor, associe
o desafio à sessão e a uma tentativa, imponha expiração e limites de tentativas,
invalide respostas reutilizadas e combine o desafio com sinais de comportamento.
Não confie em flags ou confirmação do próprio mod cliente.
