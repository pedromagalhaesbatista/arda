# Arda

[Play Arda on GitHub Pages](https://pedromagalhaesbatista.github.io/arda/). Arda is a single-player browser RPG with an in-game map editor. Explore Hobbiton and Bywater in The Shire, or visit Bree from the World menu.

The site can reopen offline after the first successful online visit and cache setup. Character progress saves in the current browser. Use **Export save** and **Import save** to move it between the local game and the website. For a custom world, export and import its map in the editor first.

Click the minimap to walk. In **Classic controls**, right-click to use or attack and Ctrl + right-click for the context menu. Use **F1–F12** for the action bar, or drag an item from your backpack onto a slot to bind it. Open a defeated creature to take its loot.

Click a spell in the **Spellbook**, type its words into the console, or drag its icon onto an action slot. Attack spells need a target from the Battle List or the map. Each cast spends mana and trains magic level. Mana regenerates during play. Equip a sword or shield and use **Training** at the map’s starting point to practise between fights. Skill progress and mana save with your character.

Drag panel headings between the three sidebars. Drag an action bar by its grip to dock it on any edge of the map. Resize panels from the bottom, desktop sidebars from the inner edge, and the console from the divider above it. The browser saves your layout automatically. **Reset layout** restores the default positions and sizes.

To play directly from disk, open `index.html` in Chrome. The game needs no build step. GitHub Pages publishes the root of `main`. Increase the cache version in `sw.js` when releasing changes to the game files.

See the [OpenTibia code and sprite credits](opentibia/README.md).
