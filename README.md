# Iron Frontline — GitHub Pages build

Projeto organizado para hospedagem estática no GitHub Pages.

## Estrutura
- `index.html` — entrada do jogo
- `css/style.css` — interface
- `js/main.js` — UI e inicialização
- `js/game/engine.js` — loop/orquestrador principal
- `js/game/player/` — regras e configuração do player
- `js/game/enemies/` — dados, hitboxes e regras comuns de inimigos
- `js/game/bosses/` — configuração e comportamento-base dos bosses
- `js/game/phases/` — definição das fases e gatilhos de progressão
- `js/game/render/` — utilitários de render/colisão
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
