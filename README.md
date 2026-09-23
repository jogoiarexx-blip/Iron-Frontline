# Iron Frontline — GitHub Pages build

Projeto organizado para hospedagem estática no GitHub Pages.

## Estrutura
- `index.html` — entrada do jogo
- `css/style.css` — interface
- `js/main.js` — UI e inicialização
- `js/game/` — núcleo do jogo em ES modules
- `assets/player/` — sprites do player
- `assets/enemies/` — sprites dos inimigos
- `assets/vehicles/` — veículos
- `assets/bosses/` — bosses
- `assets/fx/` — efeitos visuais
- `.nojekyll` — evita processamento do GitHub Pages

## GitHub Pages
Em **Settings > Pages**, use:
- **Deploy from a branch**
- branch `main`
- pasta `/(root)`

Os caminhos são relativos, então o jogo funciona em URLs de projeto como `usuario.github.io/nome-do-repositorio/`.

Não é necessário Node, npm, Vite, React ou servidor para executar a versão publicada.
