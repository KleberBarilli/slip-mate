# Slip Mate V3.2

Extensão Chromium para criar links compartilháveis da Bet365. A V3 preserva o
fluxo clássico para usuários conectados e adiciona um slip próprio para quem
está deslogado.

## Modos de uso

- **Bilhete sem login desligado:** a Bet365 funciona normalmente. Quando existe
  um betslip conectado, o popup lê o `betstring` e preserva o fluxo antigo.
- **Bilhete sem login ligado:** o clique na odd é interceptado e a seleção entra
  no painel próprio, esteja a conta conectada ou deslogada.

O modo é sempre manual. A detecção da conta serve apenas para informar o status
e não bloqueia o seletor.

O estado do slip deslogado fica em `chrome.storage.session`, separado por guia,
e é descartado quando a sessão do navegador termina.

## Idiomas

A V3.2 usa a localização nativa das extensões Chromium:

- **Português do Brasil** é o idioma padrão;
- **English** é selecionado automaticamente quando o navegador usa inglês.

Não há seletor manual no popup. Nome, descrição, popup, painel flutuante, avisos
e erros acompanham o locale do navegador.

## Instalação local

1. Abra `chrome://extensions`.
2. Ative **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação**.
4. Escolha esta pasta do projeto.
5. Recarregue uma guia da Bet365 que já estava aberta.

O manifesto restringe os scripts a:

- `https://www.bet365.bet.br/*`
- `https://www.bet365.com/*`

## Desenvolvimento

Não há dependências de runtime nem backend. Os testes usam o runner nativo do
Node:

```bash
npm test
```

Eles cobrem:

- parser do `betstring` legado;
- extração de `FI + ID + OD` do estado React;
- geração exata de links simples e múltiplos;
- conversão e combinação de odds fracionárias.

## Arquitetura V3

- `bet365-hook.js` — captura a seleção no MAIN world e bloqueia o login.
- `bet365-parser.js` — normaliza seleção e preserva o parser legado.
- `service-worker.js` / `slip-store.js` — estado por guia durante a sessão.
- `slip-ui.js` — painel flutuante do modo deslogado.
- `url-builder.js` — único gerador de URL para os dois fluxos.
- `i18n.js` / `_locales` — localização automática PT-BR e English.
- `content.js` — autenticação, ponte e coordenação da página.

A estratégia de mapeamento e as evidências da investigação estão em
[`docs/v3-mapping-strategy.md`](docs/v3-mapping-strategy.md).

## Escopo e limitações

O Bilhete sem login mira mercados normais pré-jogo. Nele, não são
compatíveis:

- **Criar Aposta** (Bet Builder);
- **Aposta Aumentada** e outras combinações de boost;
- mercados **Ao Vivo**.

Mercados especiais que não fornecem os três IDs obrigatórios também falham de
forma segura: o clique é bloqueado e o painel avisa, sem abrir o login. Essa
mesma lista fica disponível no popup em **Compatibilidade do Bilhete sem login**.

Quando o usuário está logado e deixa o Bilhete sem login desligado, a extensão
não intercepta os cliques: Criar Aposta, boosts e mercados Ao Vivo continuam
funcionando pelo fluxo nativo da Bet365.

O rodapé do popup também oferece acesso ao
[Stake Mate](https://stakemateapp.com/), a calculadora de EV.

A Bet365 usa uma aplicação privada e pode alterar seus componentes internos.
Por isso toda dependência de React/Bet365 está concentrada em um único hook e
deve ser validada a cada release.
