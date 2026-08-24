# Changelog

## 3.2.2 — 2026-08-24

### Correção

- relaciona cada odd de mercado de jogador à linha correta da tabela da
  Bet365, exibindo nomes como `Matheus Martins` em vez de repetir
  `Para Marcar`;
- preserva limites como `2+` no título e mantém mercado e evento como
  contexto;
- cobre tanto a grade de jogadores da página inicial quanto as tabelas dentro
  da página completa do evento;
- rejeita a seleção quando o nome obrigatório do jogador não puder ser
  identificado, em vez de adicionar um texto incompleto;
- melhora o contexto de 1X2, totais e mercados renderizados na página do
  evento.

### Validação

- testado no navegador deslogado com 1X2, totais, Para marcar, Gol ou
  assistência, cartão, chutes no gol, chutes, faltas e desarmes;
- mensagens de falha disponíveis em PT-BR e English;
- 27 testes automatizados aprovados.

## 3.2.1 — 2026-08-24

### Correção

- evita que rótulos curtos como `1`, `X` e `2` sejam confundidos com o nome do
  evento;
- recupera o nome visível do mercado e das equipes quando o estado React não
  fornece esse contexto;
- mostra seleção, handicap, mercado e evento com até duas linhas no painel;
- expande o mercado Resultado para nomes como `Arsenal (1)`, `Empate (X)` e
  `Chelsea (2)` quando os dados estiverem disponíveis.

## 3.2.0 — 2026-08-24

### Novidades

- novo nome **Bilhete sem login** (`No-login bet slip` em inglês);
- localização automática pelo idioma do navegador em PT-BR e English;
- seção de compatibilidade dos mercados no popup;
- link para a calculadora de EV do [Stake Mate](https://stakemateapp.com/);
- mensagens de estado, erros e acessibilidade traduzidas.

### Compatibilidade

- mercados normais pré-jogo continuam disponíveis no Bilhete sem login;
- Criar Aposta, boosts e mercados Ao Vivo continuam disponíveis pelo fluxo
  nativo da Bet365 quando o usuário está logado e o Bilhete sem login está
  desligado.

### Correção

- o botão de copiar agora respeita o fluxo selecionado quando há um betslip
  legado disponível e o Bilhete sem login está ligado.
