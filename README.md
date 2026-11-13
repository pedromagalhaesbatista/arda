# Arda

[Play Arda on GitHub Pages](https://pedromagalhaesbatista.github.io/arda/). Arda is a single-player browser RPG with an in-game map editor. Explore Hobbiton and Bywater in The Shire, or visit Bree from the World menu.

The site can reopen offline after the first successful online visit and cache setup. Character progress saves in the current browser. Use **Export save** and **Import save** to move it between the local game and the website. For a custom world, export and import its map in the editor first.

Click the minimap to walk. In **Classic controls**, right-click to use or attack and Ctrl + right-click for the context menu. Use **F1–F12** for the action bar, or drag an item from your backpack onto a slot to bind it. Open a defeated creature to take its loot.

To play directly from disk, open `index.html` in Chrome. The game needs no build step. GitHub Pages publishes the root of `main`. Increase the cache version in `sw.js` when releasing changes to the game files.

See the [OpenTibia code and sprite credits](opentibia/README.md).
