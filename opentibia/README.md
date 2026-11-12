# OpenTibia in Arda

Open [Arda](../index.html) in a browser. The checked-in scripts and sprite atlas run directly from disk. They need no account, connection, server process, or installed Tibia client.

Use the World selector to choose The Shire, Bree, or a saved custom map. Arda saves character and quest progress in the browser profile for each saved map. Keep opening the same file in the same browser profile to resume. The Shire's playable area draws on Tolkien's [map of the Shire](https://www.tolkienestate.com/painting/maps/) and his [painting of Hobbiton and Bag End](https://www.tolkienestate.com/painting/the-hobbit/).

Arda uses [OTClient Web](https://github.com/davideluque/otclient-web/tree/435f5a391543bce2632de92fadf315faa915ad8a) code under the [MIT license](LICENSE-OTCLIENT-WEB). The bundled browser code supplies A* click-to-walk routing, direction and timing, and the sprite frame layout. The asset build uses its DAT and SPR readers and outfit tinting code. The readers were extended for the sprite pack's 10.41 format, and the pathfinder reads Arda's map and collision data. Combat, quests, and the editor run locally in Arda's JavaScript.

Melee damage, fighting stance modifiers, and the order of defense and armor rolls follow [The Forgotten Server's player rules](https://github.com/otland/forgottenserver/blob/master/src/player.cpp), [weapon formula](https://github.com/otland/forgottenserver/blob/master/src/weapons.cpp), and [damage mitigation](https://github.com/otland/forgottenserver/blob/master/src/creature.cpp). Equipment values, monster damage, and skill advancement are tuned for the Bree playtest.

The artwork comes from the [OpenTibia Sprite Pack](https://github.com/peonso/opentibia_sprite_pack/tree/ae88e1828671b349e729dd21177dde15ea41e123) by the [OpenTibia community artists](SPRITE-AUTHORS.md), under [CC BY 4.0](LICENSE-SPRITES). Arda selects and repacks the sprites into one atlas and colors the traveller outfit and Shire river tiles. No assets from the CipSoft client are bundled.

To regenerate the bundled files, run from the Arda folder with Node 24 or newer. Use a checkout of the sprite pack at the revision linked above.

```sh
npx --yes esbuild@0.28.1 opentibia/source/runtime.ts --bundle --format=iife --global-name=OpenTibia --target=es2022 --outfile=opentibia/runtime.js
npx --yes tsx@4.23.15 opentibia/build-assets.mts "/path/to/opentibia_sprite_pack"
```
