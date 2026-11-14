# UNITEC Game Center

Plataforma integrada com dois jogos: Bomba da Digitação (`/bomba`) e Show de Milhões (`/milhao`). A página inicial `/` permite escolher o jogo.

## Publicar no Render
- Build Command: `npm install`
- Start Command: `npm start`
- Node.js 18 ou superior.

O projeto usa um único servidor HTTP e dois namespaces Socket.IO isolados (`/bomba` e `/milhao`) para impedir conflito entre eventos dos jogos.

## Rotas
- `/` central de jogos
- `/bomba` Bomba da Digitação (multiplayer e treinamento individual)
- `/milhao` Show de Milhões
- `/health` verificação de funcionamento


## Cyber Snake — melhorias
- Nick do jogador acompanha a cabeça da cobra durante toda a partida.
- Quatro túneis nas extremidades dos cantos permitem atravessar a parede e reaparecer do outro lado.
- As aberturas dos túneis ficam destacadas visualmente na arena.
