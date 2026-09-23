# Iron Frontline — GitHub Pages build

Projeto organizado para hospedagem estática no GitHub Pages.

## Estrutura
- `index.html` — entrada do jogo
- `css/style.css` — interface
- `js/main.js` — UI e inicialização
- `js/game/engine.js` — loop e orquestração principal
- `js/game/core/constants.js` — constantes globais do jogo
- `js/game/core/camera-system.js` — câmera
- `js/game/player/player-system.js` — configuração, estados e hitboxes do player
- `js/game/player/player-controller.js` — movimentação, armas, melee e interação do player
- `js/game/enemies/enemy-system.js` — atributos e hitboxes dos inimigos
- `js/game/enemies/enemy-ai.js` — IA e atualização dos inimigos/veículos
- `js/game/bosses/boss-system.js` — configuração-base dos bosses
- `js/game/bosses/boss-combat.js` — IA, ataques e dano dos bosses
- `js/game/systems/combat-system.js` — projéteis, dano, explosões, partículas e efeitos de armas
- `js/game/phases/phases.js` — fases, eventos e gatilhos de progressão
- `js/game/render/render-utils.js` — colisão/utilitários matemáticos
- `js/game/render/renderer.js` — renderização de cenário, player, inimigos e bosses
- `js/game/assets.js` — carregamento de assets
- `js/game/audio.js` — áudio
- `js/game/input.js` — teclado, touch e gamepad
- `js/game/save.js` — localStorage
- `assets/player/` — sprites do player
- `assets/enemies/` — sprites dos inimigos
- `assets/vehicles/` — veículos
- `assets/bosses/` — bosses
- `assets/fx/` — efeitos visuais

## GitHub Pages
Em **Settings > Pages**, use:
- **Deploy from a branch**
- branch `main`
- pasta `/(root)`

Os caminhos são relativos, então o jogo funciona em URLs de projeto como `usuario.github.io/nome-do-repositorio/`.

Não é necessário Node, npm, Vite, React ou servidor para executar a versão publicada.
