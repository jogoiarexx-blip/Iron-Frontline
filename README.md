# Iron Frontline — GitHub Pages build

Esta pasta já está pronta para hospedagem estática.

## Estrutura
- `index.html` — entrada do jogo
- `css/style.css` — interface
- `js/main.js` — UI e inicialização
- `js/game/` — núcleo do jogo compilado para ES modules
- `assets/sprites/` — sprites
- `.nojekyll` — evita processamento do GitHub Pages

## Publicar no GitHub Pages
1. Envie o conteúdo desta pasta para a raiz do repositório.
2. No GitHub, abra **Settings > Pages**.
3. Em **Build and deployment**, escolha **Deploy from a branch**.
4. Escolha a branch `main` e a pasta `/(root)`.
5. Salve.

O jogo usa caminhos relativos (`./css/...`, `./js/...` e `./assets/...`), portanto funciona também em URLs de projeto como `usuario.github.io/nome-do-repositorio/`.

Não é necessário Node, npm, Vite, React ou servidor para executar a versão publicada.
