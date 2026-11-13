# Arda

[Play Arda on GitHub Pages](https://pedromagalhaesbatista.github.io/arda/). Arda is a single-player browser RPG with an in-game map editor.

Choose **The Shire and Its Neighbours** from the World menu. Use **Open regional map** below the minimap to see the full area and choose a destination. The East Road runs through the Shire to Bree-town. The northern roads reach Evendim, and the western road leads to the settlements along the Lune. Cross the Brandywine by bridge or use the Bucklebury Ferry landing near Stock. The regional geography follows Norlackale of Laurelin’s *The Shire and Its Neighbours, T.A. 3018*, supplied as a map reference.

Follow the broad East Road between villages and take the smaller lanes to farms and woodland. At Hobbiton, the path up The Hill leads past the Party Field to Bag End, and the bridge below the mill leads to Bywater. Visit the Green Dragon beside the pool, the market square at Michel Delving, or the Prancing Pony and its yard in Bree.

The site can reopen offline after the first successful online visit and cache setup. When online, the game checks for updates automatically and reloads after saving your progress when you are idle in Play mode. Character progress saves in the current browser. Use **Export save** and **Import save** to move it between the local game and the website. For a custom world, export and import its map in the editor first.

Open **Characters** to switch between saved characters in the current world or create one with a name and vocation. Your existing save appears as the first character. Each character has its own equipment, skills, quests, position, loot, and hotkeys. **Import save** replaces the active character’s slot after confirmation.

Use **Shire landmarks → Bywater Hunting Trail** on the minimap to find bank rats and marsh wolves. They respawn after at least 20 seconds once you move more than eight tiles from their spawn. Take your loot to the **Bywater Outfitter**, through the shop door east of the Green Dragon. Click the outfitter or press **E** nearby to sell drops and buy healing herbs, mana draughts, or your vocation’s gear upgrade. The Bestiary tracks lifetime trail kills for each character.

Talk to a named villager by clicking them in Context controls, right-clicking in Classic controls, or pressing **E** nearby. Sam in Hobbiton needs seeds from the Party Field, Tansy in the Green Dragon pays for bank rat tails, and Fosco in Michel Delving needs a market tally from Poppy at the Bagshot Row Pantry. The **Quest Tracker** shows what to do next. Each character keeps their own quest progress offline. Enter the pantry, the Green Dragon, or the Market Hall and talk to the keeper to see their stock.

For the next hunting tier, speak to **Ned Cotton** by Bywater Pool. **Beyond the Hedge** sends you east to Stock, across the **Bucklebury Ferry**, and onward to **Rollo at the Warden’s Camp**. Bring supplies and aim for level 4 or higher. You can resupply at camp, then hunt forest wolves on the northern loop or cross the Withywindle to the thornlings and the willow guardian. Complete **The Willow’s Toll** for a Buckland warden’s coat and access to better gear for your vocation. Forest loot, bestiary counts, gear, and quests save with each character.

Click the minimap to walk. In **Classic controls**, right-click to use or attack and Ctrl + right-click for the context menu. Use **F1–F12** for the action bar, or drag an item from your backpack onto a slot to bind it. Open a defeated creature to take its loot.

Click a spell in the **Spellbook**, type its words into the console, or drag its icon onto an action slot. Attack spells need a target from the Battle List or the map. Each cast spends mana and trains magic level. Mana regenerates during play. Equip a sword or shield and use **Training** at the map’s starting point to practise between fights. Skill progress and mana save with your character.

Open **Choose a vocation** in **Skills** to become a Knight, Paladin, Monk, Druid, or Sorcerer. Each vocation changes spell access, health and mana growth, and how quickly skills improve. Paladins receive a shortbow for distance fighting. Monks can fight and train unarmed. You can choose once per character. Existing characters keep their level, equipment, skills, and quests when they choose.

Drag panel headings between the three sidebars. Drag an action bar by its grip to dock it on any edge of the map. Resize panels from the bottom, desktop sidebars from the inner edge, and the console from the divider above it. The browser saves your layout automatically. **Reset layout** restores the default positions and sizes.

To play directly from disk, open `index.html` in Chrome. The game needs no build step. GitHub Pages publishes the root of `main`. Increase the cache version in `sw.js` when releasing changes to the game files.

See the [OpenTibia code and sprite credits](opentibia/README.md).
