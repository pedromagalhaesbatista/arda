"use strict";

(() => {
  const $ = id => document.getElementById(id);
  const canvas = $("world");
  const c = canvas.getContext("2d");
  const minimap = $("minimap");
  const mini = minimap.getContext("2d");
  const tile = Art.size;

  const creatureNames = Object.fromEntries(Object.keys(Hunting.creatures).map(id => [id, World.markers[id]]));
  const skills = {
    sword: { label: "sword fighting", value: "skill", meter: "sword-progress", requirement: "Equip a sword" },
    shielding: { label: "shielding", value: "shield-skill", meter: "shield-progress", requirement: "Equip a shield" },
    distance: { label: "distance fighting", value: "distance-skill", meter: "distance-progress", requirement: "Equip a bow" },
    fist: { label: "fist fighting", value: "fist-skill", meter: "fist-progress", requirement: "Stow your weapon" },
    magic: { label: "magic", value: "magic-level", meter: "magic-progress" },
  };
  const markerActions = { keeper: "Talk", miller: "Talk", gardener: "Talk", merchant: "Trade", ledger: "Take", notice: "Read" };
  const movement = {
    w: [0, -1], a: [-1, 0], s: [0, 1], d: [1, 0],
    arrowup: [0, -1], arrowleft: [-1, 0], arrowdown: [0, 1], arrowright: [1, 0]
  };

  const numpad = {
    Numpad1: [-1, 1], Numpad2: [0, 1], Numpad3: [1, 1], Numpad4: [-1, 0],
    Numpad6: [1, 0], Numpad7: [-1, -1], Numpad8: [0, -1], Numpad9: [1, -1]
  };

  const worlds = { shire: Shire.create(), bree: World.seed() };
  const worldRevisions = Object.fromEntries(Object.entries(worlds).map(([id, world]) => [id, Saves.revision(world)]));
  let selectedWorld = "shire";
  let loadMessage = "";
  try {
    const saved = localStorage.getItem(Saves.mapKey);
    if (saved) {
      worlds.custom = World.validate(JSON.parse(saved));
      worldRevisions.custom = Saves.revision(worlds.custom);
      selectedWorld = "custom";
    }
    const previous = localStorage.getItem(Saves.selectionKey);
    if (Object.hasOwn(worlds, previous)) selectedWorld = previous;
  } catch {
    loadMessage = "The saved editor map could not be loaded.";
  }
  let map = structuredClone(worlds[selectedWorld]);
  let playWorld = null;
  let playRevision = null;
  let activeCharacter = Saves.originalCharacter;
  let characterName = Saves.defaultName;
  let saveKey = null;
  let saveRaw = null;
  let saveBlocked = false;
  let savePending = false;
  let saveAfter = 0;
  let landmarkFloor = null;
  const minimapFloors = new WeakMap();

  let player;
  let entities = [];
  let loot = [];
  let openLoot = null;
  let merchant = null;
  let shopMode = "buy";
  let huntKills = {};
  let nextHeal = 0;
  let nextMana = 0;
  let consoleChannel = "all";
  let minimapZoom = 1;
  let gameZoom = 1;
  let previewFloor = null;
  let hunt;
  let huntSecond = -1;
  let mouseMode = "context";
  const defaultActions = ["attack", "herb", "use", "stop", null, null, null, null, null, null, null, null];
  let legacyActions = defaultActions;
  let actions = [...defaultActions];
  try {
    if (localStorage.getItem("arda.mouse.v1") === "classic") mouseMode = "classic";
    const savedActions = JSON.parse(localStorage.getItem("arda.actions.v1"));
    if (Saves.actionsValid(savedActions)) legacyActions = savedActions;
  } catch {
    // Browser settings are optional.
  }
  let combatText = [];
  let spellEffects = [];
  const spellRows = new Map();
  let magicClock = null;
  let practice = null;
  let nextPractice = 0;
  let trainingPoint;
  let inventoryDirty = true;
  let draggedItem = null;
  let nextChase = 0;
  let target = null;
  let quest = "available";
  let ratsDefeated = 0;
  let hasLedger = false;
  let path = [];
  let nextMove = 0;
  let nextAttack = 0;
  let pendingInteraction = null;
  let edit = false;
  let editFloor = World.findStart(map).z;
  let editorCenter = World.findStart(map);
  let layer = "ground";
  const brushes = { ground: "path", objects: "tree", markers: "start" };
  let hover = null;
  let gesture = null;
  let undo = [];
  let redo = [];
  let needsRefresh = true;
  const held = new Map();
  const view = { x: 0, y: 0 };
  let lastTick = 0;

  const currentFloor = () => World.floorAt(map, edit ? editFloor : player.z);
  const distance = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  const here = (x, y, z = player.z) => entities.find(entity => entity.hp > 0 && entity.z === z && entity.x === x && entity.y === y);

  function journal(message, channel = "all") {
    const list = $("journal");
    const entry = document.createElement("li");
    entry.textContent = message;
    entry.dataset.channel = channel;
    entry.hidden = consoleChannel !== "all" && channel !== consoleChannel;
    list.append(entry);
    if (list.childElementCount > 60) list.firstElementChild.remove();
    list.scrollTop = list.scrollHeight;
  }

  function startingPlayer(vocation = null) {
    const character = {
      ...World.findStart(map), hp: 30, maxHp: 30, xp: 0, level: 1, face: OpenTibia.Direction.South,
      kit: Equipment.starterKit(), stance: "balanced", pursuit: "stand",
      vocation: null, sword: Vocations.starterSkill(), shielding: Vocations.starterSkill(),
      distance: Vocations.starterSkill(), fist: Vocations.starterSkill(),
      ...Magic.starter(),
    };
    applyVocation(character, vocation);
    return character;
  }

  function resetPlay() {
    player = startingPlayer();
    trainingPoint = { x: player.x, y: player.y, z: player.z };
    practice = null;
    nextPractice = 0;
    magicClock = null;
    inventoryDirty = true;
    hunt = { start: performance.now(), xp: 0, coins: 0, dealt: 0, received: 0, healing: 0 };
    huntSecond = -1;
    previewFloor = null;
    draggedItem = null;
    $("spell-words").value = "";
    $("vocation-chooser").open = false;
    $("vocation-select").value = "";
    updateVocationPreview();
    combatText = [];
    spellEffects = [];
    $("backpack-panel").hidden = false;
    entities = [];
    for (const floor of map.floors) {
      for (const [key, marker] of Object.entries(floor.markers)) {
        const creature = Hunting.creatures[marker.type];
        if (!creature && !["keeper", "gardener", "miller", "merchant"].includes(marker.type)) continue;
        const [x, y] = key.split(",").map(Number);
        const hp = creature?.hp ?? 8;
        entities.push({ x, y, z: floor.z, origin: { x, y }, type: marker.type, hp, maxHp: hp, face: OpenTibia.Direction.South, nextMove: 0, nextHit: 0 });
      }
    }
    loot = [];
    huntKills = {};
    closeLoot();
    closeMerchant();
    nextHeal = nextMana = 0;
    lastTick = 0;
    target = null;
    path = [];
    pendingInteraction = null;
    quest = "available";
    ratsDefeated = 0;
    hasLedger = false;
    nextAttack = nextMove = nextChase = 0;
    needsRefresh = true;
  }

  function saveStatus(message) {
    const element = $("game-save-status");
    if (element.textContent !== message) element.textContent = message;
  }

  function creatureSnapshot(atSpawn = false) {
    return Object.fromEntries(entities.filter(entity => creatureNames[entity.type]).map(entity => {
      const { x, y } = atSpawn ? entity.origin : entity;
      const { z } = entity;
      const hp = atSpawn ? entity.maxHp : entity.hp;
      const face = atSpawn ? OpenTibia.Direction.South : entity.face;
      const state = { x, y, z, hp, face };
      if (!atSpawn && entity.respawnAt) state.respawnAt = entity.respawnAt;
      return [Saves.actorKey(entity), state];
    }));
  }

  function characterSnapshot() {
    const floor = currentFloor();
    const steppingIntoLink = player.motion && floor.markers[World.key(player.x, player.y)]?.type === "link";
    const position = steppingIntoLink ? player.motion.from : player;
    const { z, hp, maxHp, xp, level, face, kit, stance, pursuit, vocation, sword, shielding, distance, fist, mana, magic, spellState } = player;
    return {
      version: 1, name: characterName, actions,
      player: {
        x: position.x, y: position.y, z, hp, maxHp, xp, level, face, kit, stance, pursuit,
        vocation, sword, shielding, distance, fist, mana, magic, spellState,
      },
      quest, ratsDefeated, hasLedger, creatures: creatureSnapshot(), loot, huntKills,
    };
  }

  function saveProgress(force = false) {
    if (edit || !saveKey || (!force && !savePending && !needsRefresh)) return true;
    if (saveBlocked) return false;
    try {
      saveRaw = Saves.write(saveKey, characterSnapshot(), saveRaw);
      savePending = false;
      saveAfter = performance.now() + 180;
      saveStatus("Saved on this device");
      return true;
    } catch (error) {
      saveBlocked = true;
      $("save-game").disabled = true;
      saveStatus(error.name === "QuotaExceededError" ? "Browser storage is full." : error.message);
      return false;
    }
  }

  function canLeaveCharacter() {
    if (saveProgress(true)) return true;
    return confirm("The current session could not be saved. Switch and leave those changes behind?");
  }

  function compatibleRevisions() {
    return selectedWorld === "shire" ? Shire.previousRevisions : [];
  }

  function resumePlay(id) {
    const revision = Saves.revision(map);
    const savedMap = revision === worldRevisions[selectedWorld];
    if (!id && savedMap) {
      try { id = Saves.selectedCharacter(selectedWorld, revision, compatibleRevisions()); } catch {
        // The original slot is available when browser settings cannot be read.
      }
    }
    id ??= Saves.originalCharacter;
    const key = savedMap ? Saves.progressKey(selectedWorld, revision, id) : null;
    if (playWorld === selectedWorld && playRevision === revision && saveKey === key) return "continued";
    const keepPlaytest = playRevision === revision && !saveKey && key && id === Saves.originalCharacter;
    if (!keepPlaytest) resetPlay();
    playWorld = selectedWorld;
    playRevision = revision;
    activeCharacter = id;
    characterName = Saves.defaultName;
    actions = [...defaultActions];
    if (id === Saves.originalCharacter) actions.splice(0, legacyActions.length, ...legacyActions);
    $("character-select").disabled = !key;
    saveKey = key;
    saveRaw = null;
    saveBlocked = false;
    savePending = !!key;
    saveAfter = 0;
    $("save-game").disabled = !key;
    $("export-save").disabled = !key;
    $("import-save").disabled = !key;
    if (!key) {
      saveStatus("Playtest · save the map to keep progress");
      return "new";
    }

    try {
      const hostiles = entities.filter(entity => creatureNames[entity.type]);
      const result = Saves.read(key, map, hostiles);
      saveRaw = result.raw;
      let data = result.value;
      for (const prior of compatibleRevisions()) {
        if (data) break;
        const priorKey = Saves.progressKey(selectedWorld, prior, id);
        data = Saves.read(priorKey, map, hostiles, value => Saves.relocate(Shire.moveOldSave(value), map, entities)).value;
      }
      saveStatus(result.value ? "Saved on this device" : "Autosave on");
      if (!data) return keepPlaytest ? "continued" : "new";
      characterName = data.name ?? Saves.defaultName;
      if (data.actions) actions.splice(0, data.actions.length, ...data.actions);
      for (const field of Object.keys(player)) {
        if (Object.hasOwn(data.player, field)) player[field] = data.player[field];
      }
      if (!Object.hasOwn(data.player, "mana")) Object.assign(player, Magic.starter(player.level));
      const readyAt = performance.now() + Combat.swingInterval;
      for (const entity of entities) {
        if (!creatureNames[entity.type]) continue;
        const { x, y, hp, face, respawnAt } = data.creatures[Saves.actorKey(entity)];
        Object.assign(entity, { x, y, hp, face, respawnAt, nextHit: readyAt });
      }
      ({ quest, ratsDefeated, hasLedger, loot } = data);
      huntKills = data.huntKills ?? {};
      return "restored";
    } catch {
      saveBlocked = true;
      $("save-game").disabled = true;
      saveStatus("Save unavailable · progress is temporary");
      return "new";
    }
  }

  function downloadJson(value, filename) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(value)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportCharacter() {
    if (edit || !saveKey) return;
    const filename = characterName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "character";
    downloadJson({ format: "arda-save", version: 1, revision: playRevision, mapName: map.name,
      progress: characterSnapshot() }, `arda-${selectedWorld}-${filename}-save.json`);
    journal("Character save exported.");
  }

  async function importCharacter(event) {
    const file = event.target.files[0];
    event.target.value = "";
    if (!file || edit || !saveKey) return;
    const key = saveKey;
    try {
      if (file.size > 8_000_000) throw new Error("Character saves must be smaller than 8 MB.");
      const data = JSON.parse(await file.text());
      if (edit || saveKey !== key) return;
      if (data?.format !== "arda-save" || data.version !== 1) throw new Error("Choose an Arda character save.");
      const previousShire = compatibleRevisions().includes(data.revision);
      if (data.revision !== playRevision && !previousShire) throw new Error("Open the matching map before importing this save.");
      const progress = previousShire ? Saves.relocate(Shire.moveOldSave(data.progress), map, entities) : data.progress;
      if (!Saves.valid(progress, map, entities.filter(entity => creatureNames[entity.type]))) {
        throw new Error("The character save is unreadable.");
      }
      const current = localStorage.getItem(key);
      if (!saveBlocked && current !== saveRaw) throw new Error("This save changed in another tab. Reload before importing.");
      if (current !== null && !confirm(`Replace ${characterName} in the active slot with the imported character?`)) return;
      Saves.write(key, { ...progress, name: characterName, actions: progress.actions ?? actions }, current);
      playRevision = null;
      announcePlay(resumePlay(activeCharacter));
      journal("Character save imported.");
    } catch (error) {
      journal(`Import failed. ${error.message}`);
    }
  }

  function syncWorldSelect() {
    const select = $("world-select");
    select.replaceChildren();
    for (const [id, world] of Object.entries(worlds)) {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = id === "custom" ? `${world.name} (custom)` : world.name;
      select.append(option);
    }
    select.value = selectedWorld;
  }

  function rememberWorld() {
    try { localStorage.setItem(Saves.selectionKey, selectedWorld); } catch {
      // The game can still use the selection for the current session.
    }
  }

  function announcePlay(state) {
    if (state === "restored") {
      journal(`You resume in ${currentFloor().name}.`);
    } else if (map.adventure === "shire") {
      journal("You arrive in Hobbiton. Bag End is up the lane, past Sam Gamgee’s garden.");
      journal("Follow the lane east to the mill if you’re looking for work.");
    } else if (map.name === "Bree") {
      journal("You arrive in Bree, outside the Prancing Pony.");
      journal("Speak to the innkeeper in the courtyard to find work.");
    } else {
      journal(`You arrive in ${map.name}.`);
    }
  }

  function switchCharacter(id) {
    if (id !== activeCharacter) {
      Saves.selectCharacter(selectedWorld, playRevision, id);
      $("journal").replaceChildren();
      announcePlay(resumePlay(id));
    }
    $("character-screen").close();
    canvas.focus({ preventScroll: true });
  }

  function showCharacterScreen() {
    if (edit || !saveKey) return;
    const screen = $("character-screen");
    const list = $("character-list");
    list.replaceChildren();
    $("character-error").textContent = "";
    $("character-world").textContent = map.name;
    $("new-character-form").reset();
    $("new-character-details").textContent = "";
    try {
      const roster = Saves.listCharacters(selectedWorld, playRevision, compatibleRevisions());
      for (const entry of roster) {
        const current = entry.id === activeCharacter;
        const row = document.createElement("li");
        const button = document.createElement("button");
        button.type = "button";
        const name = document.createElement("strong");
        name.textContent = current ? characterName : entry.name;
        const details = document.createElement("span");
        const level = current ? player.level : entry.level;
        const vocation = current ? Vocations.get(player.vocation).name : entry.vocation;
        details.textContent = [level ? `Level ${level}` : "Original slot", vocation, current ? "Active" : ""].filter(Boolean).join(" · ");
        if (current) button.setAttribute("aria-current", "true");
        button.append(name, details);
        button.addEventListener("click", () => {
          if (current || canLeaveCharacter()) {
            try { switchCharacter(entry.id); } catch (error) { characterError(error); }
          }
        });
        row.append(button);
        list.append(row);
      }
    } catch (error) {
      characterError(error);
    }
    held.clear();
    closeTileMenu();
    saveProgress(true);
    magicClock = null;
    screen.showModal();
  }

  function characterError(error) {
    $("character-error").textContent = error.name === "QuotaExceededError" ? "Browser storage is full." : error.message;
  }

  function createCharacter() {
    if (edit || !saveKey) return;
    const name = $("new-character-name").value.trim();
    const vocation = $("new-character-vocation").value;
    if (!Saves.nameValid(name) || !Object.hasOwn(Vocations.classes, vocation)) {
      return characterError(new Error("Enter a character name and choose a vocation."));
    }
    try {
      if (Saves.listCharacters(selectedWorld, playRevision, compatibleRevisions()).some(entry => entry.name.toLowerCase() === name.toLowerCase())) {
        return characterError(new Error("A character with that name already exists in this world."));
      }
      if (!canLeaveCharacter()) return;
      const id = Saves.newCharacterId();
      const key = Saves.progressKey(selectedWorld, playRevision, id);
      const progress = {
        version: 1, name, actions: [...defaultActions], player: startingPlayer(vocation),
        quest: "available", ratsDefeated: 0, hasLedger: false, creatures: creatureSnapshot(true), loot: [],
      };
      Saves.write(key, progress, null);
      switchCharacter(id);
    } catch (error) {
      characterError(error);
    }
  }

  function switchWorld(id) {
    if (!Object.hasOwn(worlds, id) || id === selectedWorld) return;
    finishPaint();
    if (Saves.revision(map) !== worldRevisions[selectedWorld] &&
        !confirm("Switch worlds and discard the unsaved map edits?")) {
      $("world-select").value = selectedWorld;
      return;
    }
    if (!canLeaveCharacter()) {
      $("world-select").value = selectedWorld;
      return;
    }
    closeTileMenu();
    held.clear();
    selectedWorld = id;
    map = structuredClone(worlds[id]);
    rememberWorld();
    undo = [];
    redo = [];
    hover = null;
    $("journal").replaceChildren();
    if (edit) {
      const start = World.findStart(map);
      editFloor = start.z;
      placeEditor(start.x, start.y);
      syncEditor();
      setStatus("");
    } else {
      announcePlay(resumePlay());
    }
    canvas.focus({ preventScroll: true });
    needsRefresh = true;
  }

  function labelUpdate() {
    const floor = currentFloor();
    $("region").textContent = map.name;
    $("active-character").textContent = edit ? "" : characterName;
    document.title = `Arda · ${map.name}`;
    $("floor-name").textContent = floor.name;
    $("floor-code").textContent = `Z ${floor.z}`;
    const pos = edit ? (hover ?? editorCenter) : player;
    $("coords").textContent = `${Math.round(pos.x)}, ${Math.round(pos.y)}`;
  }

  function drawMinimap() {
    const floor = World.floorAt(map, previewFloor) ?? currentFloor();
    const pos = edit ? editorCenter : player;
    const fit = Math.max(1, Math.min(Math.floor(minimap.width / map.width), Math.floor(minimap.height / map.height)));
    const scale = fit * minimapZoom;
    const origin = (size, tiles, tile) => Math.floor(size >= tiles * scale ? (size - tiles * scale) / 2 :
      Math.min(0, Math.max(size - tiles * scale, size / 2 - (tile + .5) * scale)));
    const ox = origin(minimap.width, map.width, pos.x);
    const oy = origin(minimap.height, map.height, pos.y);
    const isCurrent = floor === currentFloor();
    $("floor-code").textContent = `Z ${floor.z}${isCurrent ? "" : " · Preview"}`;
    $("map-up").disabled = !map.floors.some(entry => entry.z > floor.z);
    $("map-down").disabled = !map.floors.some(entry => entry.z < floor.z);
    $("map-zoom-in").disabled = minimapZoom === 4;
    $("map-zoom-out").disabled = minimapZoom === 1;
    mini.fillStyle = "#151915";
    mini.fillRect(0, 0, minimap.width, minimap.height);
    const terrain = minimapTerrain(floor);
    mini.imageSmoothingEnabled = false;
    mini.drawImage(terrain, ox, oy, map.width * scale, map.height * scale);
    for (const [key, marker] of Object.entries(floor.markers)) {
      if (marker.type !== "link" && !(map.adventure === "shire" && floor.z === 0 && marker.type === "notice")) continue;
      const [x, y] = key.split(",").map(Number);
      mini.fillStyle = marker.type === "link" ? "#e6ca80" : "#d0ad72";
      mini.fillRect(ox + x * scale, oy + y * scale, scale, scale);
    }
    if (isCurrent) {
      const x = ox + Math.round(pos.x) * scale;
      const y = oy + Math.round(pos.y) * scale;
      mini.fillStyle = "#1b1c17";
      mini.fillRect(x - 1, y - 1, scale + 2, scale + 2);
      mini.fillStyle = "#fff2c1";
      mini.fillRect(x, y, scale, scale);
    }
    return { scale, ox, oy };
  }

  function minimapTerrain(floor) {
    const cached = !edit && minimapFloors.get(floor);
    if (cached) return cached;
    const terrain = document.createElement("canvas");
    terrain.width = map.width;
    terrain.height = map.height;
    const context = terrain.getContext("2d");
    for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
      const ground = floor.ground[World.index(map, x, y)];
      const object = floor.objects[World.key(x, y)];
      context.fillStyle = Art.mapColors[object] ?? Art.mapColors[ground];
      context.fillRect(x, y, 1, 1);
    }
    if (!edit) minimapFloors.set(floor, terrain);
    return terrain;
  }
  function updateLandmarks() {
    const floor = currentFloor();
    const panel = $("landmarks");
    panel.hidden = edit || map.adventure !== "shire" || floor.z !== 0;
    if (panel.hidden) {
      landmarkFloor = null;
      return;
    }
    if (landmarkFloor === floor) return;
    landmarkFloor = floor;
    const list = $("landmark-list");
    list.replaceChildren();
    const groups = new Map();
    for (const [key, marker] of Object.entries(floor.markers)) {
      if (marker.type !== "notice") continue;
      const [x, y] = key.split(",").map(Number);
      const name = marker.text.split(" · ", 1)[0];
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = name;
      button.title = `Walk to ${name}`;
      button.addEventListener("click", () => {
        target = null;
        walkTo({ x, y });
        if (path.length || (player.x === x && player.y === y)) journal(marker.text);
        else journal(`There is no clear path to ${name}.`);
        needsRefresh = true;
        canvas.focus({ preventScroll: true });
      });
      const group = Shire.landmarkRegion(x, y);
      if (!groups.has(group)) {
        const section = document.createElement("details");
        const heading = document.createElement("summary");
        heading.textContent = group;
        section.open = group === Shire.landmarkRegion(player.x, player.y);
        section.append(heading);
        groups.set(group, section);
        list.append(section);
      }
      groups.get(group).append(button);
    }
  }

  function thumbnail(paint, resolution = 32) {
    const image = document.createElement("canvas");
    image.width = image.height = resolution;
    image.setAttribute("aria-hidden", "true");
    const context = image.getContext("2d");
    if (resolution !== 32) context.scale(resolution / 32, resolution / 32);
    paint(context);
    return image;
  }

  function updateHunt(now) {
    const elapsed = Math.max(0, Math.floor((now - hunt.start) / 1000));
    if (elapsed !== huntSecond) {
      huntSecond = elapsed;
      $("hunt-time").textContent = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;
    }
    for (const [key, value] of Object.entries({
      xp: hunt.xp, gold: hunt.coins, damage: hunt.dealt, received: hunt.received, healing: hunt.healing,
    })) {
      const output = $(`hunt-${key}`);
      if (output.textContent !== String(value)) output.textContent = value;
    }
  }

  function updateBestiary() {
    const tracker = $("bestiary");
    const entries = Object.entries(creatureNames).map(([type, name]) => {
      const population = entities.filter(entity => entity.type === type);
      const repeatable = Hunting.creatures[type].respawns;
      const count = repeatable ? huntKills[type] ?? 0 : population.filter(entity => entity.hp === 0).length;
      return { type, name, count, total: population.length, repeatable };
    }).filter(entry => entry.total > 0);
    const signature = JSON.stringify(entries);
    if (tracker.dataset.counts === signature) return;
    tracker.dataset.counts = signature;
    tracker.replaceChildren();
    for (const { type, name, count, total, repeatable } of entries) {
      const row = document.createElement("li");
      const label = document.createElement("span");
      const progress = document.createElement("span");
      label.textContent = name;
      progress.textContent = repeatable ? `${count} kills` : `${count}/${total}`;
      progress.title = repeatable ? "Lifetime kills for this character" : "Defeated in this world";
      row.append(thumbnail(context => Art.preview(context, type, "markers"), 20), label, progress);
      tracker.append(row);
    }
    if (!entries.length) {
      const row = document.createElement("li");
      row.textContent = "No creatures in this world";
      tracker.append(row);
    }
  }

  function updatePlayPanel() {
    const goal = player.level * 18;
    const maxMana = Vocations.maxMana(player.level, player.vocation);
    $("level").textContent = `Level ${player.level}`;
    $("health-value").textContent = `${player.hp} / ${player.maxHp}`;
    $("health-fill").style.width = `${player.hp / player.maxHp * 100}%`;
    $("mana-value").textContent = `${player.mana} / ${maxMana}`;
    $("mana-fill").style.width = `${player.mana / maxMana * 100}%`;
    $("xp-value").textContent = `${player.xp} / ${goal}`;
    $("xp-fill").style.width = `${player.xp / goal * 100}%`;
    for (const [id, value, max] of [
      ["rail-health", player.hp, player.maxHp], ["rail-mana", player.mana, maxMana], ["rail-xp", player.xp, goal],
    ]) {
      const meter = $(id);
      meter.style.setProperty("--fill", `${value / max * 100}%`);
      meter.setAttribute("aria-valuemax", max);
      meter.setAttribute("aria-valuenow", value);
      meter.lastElementChild.textContent = `${value}/${max}`;
    }
    updateBestiary();
    for (const [id, { value, meter: meterId }] of Object.entries(skills)) {
      const skill = player[id];
      $(value).textContent = skill.level;
      const meter = $(meterId);
      meter.max = skill.goal;
      meter.value = skill.tries;
      const rate = Vocations.rate(player.vocation, id);
      meter.title = `${skill.tries} / ${skill.goal} · ${Math.floor(skill.tries / skill.goal * 100)}% · ${rate}× training`;
    }
    $("vocation-name").textContent = Vocations.get(player.vocation).name;
    $("vocation-chooser").hidden = !!player.vocation;
    const weaponSkill = Combat.weaponSkill(player.kit);
    for (const [skill, vocation] of [["distance", "paladin"], ["fist", "monk"]]) {
      const relevant = player.vocation === vocation || weaponSkill === skill || player[skill].level > 10 || player[skill].tries > 0;
      $(`${skill}-skill-row`).hidden = !relevant;
      $(`train-${skill}`).hidden = !relevant;
    }
    updateSpellStatus();
    updateTrainingPanel();
    for (const [id, key] of [["stances", "stance"], ["pursuit", "pursuit"]]) {
      for (const button of $(id).children) {
        button.setAttribute("aria-pressed", String(button.dataset[key] === player[key]));
      }
    }
    if (inventoryDirty) updateInventory();

    const list = $("battle-list");
    const focused = document.activeElement.dataset.actor;
    list.replaceChildren();
    const nearby = battleTargets();
    $("battle-count").textContent = nearby.length ? nearby.length : "";
    for (const entity of nearby) {
      const button = document.createElement("button");
      button.dataset.actor = Saves.actorKey(entity);
      button.setAttribute("aria-pressed", String(entity === target));
      const name = document.createElement("span");
      const hp = document.createElement("span");
      name.textContent = creatureNames[entity.type];
      hp.textContent = `${entity.hp}/${entity.maxHp}`;
      const health = document.createElement("progress");
      health.className = "battle-health";
      health.max = entity.maxHp;
      health.value = entity.hp;
      health.setAttribute("aria-hidden", "true");
      button.append(thumbnail(context => Art.preview(context, entity.type, "markers"), 27), name, hp, health);
      button.addEventListener("click", () => selectTarget(entity));
      list.append(button);
      if (button.dataset.actor === focused) button.focus({ preventScroll: true });
    }
    if (!nearby.length) {
      const message = document.createElement("p");
      message.textContent = "No creatures nearby";
      list.append(message);
    }
  }

  function updateVocationPreview() {
    const id = $("vocation-select").value;
    const vocation = Vocations.classes[id];
    $("vocation-form").querySelector("button").disabled = !vocation;
    if (!vocation) {
      $("vocation-details").textContent = "Choose once for this character.";
      return;
    }
    const spells = Object.values(Magic.spells).filter(spell => spell.classes?.includes(id));
    $("vocation-details").textContent =
      `${vocation.specialty}. +${vocation.hp} health and +${vocation.mana} mana per level. ${spells.map(spell => spell.name).join(", ")}.`;
  }

  function applyVocation(character, id) {
    if (!id) return;
    const vocation = Vocations.get(id);
    const previous = Vocations.get(character.vocation);
    character.mana += (character.level - 1) * (vocation.mana - previous.mana);
    character.spellState.regen = Math.floor(character.spellState.regen * vocation.regen / previous.regen);
    character.vocation = id;
    if (id === "paladin") {
      if (character.kit.worn.weapon !== "bow") {
        if (!character.kit.bag.bow) Equipment.add(character.kit, "bow");
        Equipment.equip(character.kit, "bow");
      }
    }
    if (id === "monk") Equipment.stow(character.kit, "weapon");
  }

  function chooseVocation(id) {
    if (edit || player.vocation || !Object.hasOwn(Vocations.classes, id)) return;
    const vocation = Vocations.get(id);
    if (!confirm(`Become a ${vocation.name}? This is a permanent choice for this character.`)) return;
    advanceMagic(performance.now(), true);
    applyVocation(player, id);
    stopActions();
    inventoryChanged();
    journal(`You became a ${vocation.name}.`);
    $("vocation-chooser").open = false;
    canvas.focus({ preventScroll: true });
    saveProgress(true);
  }

  function inventoryChanged() {
    inventoryDirty = needsRefresh = true;
  }

  function equipItem(id) {
    const required = Equipment.items[id].vocation;
    if (required && player.vocation !== required) return journal(`${Equipment.items[id].name} requires the ${Vocations.get(required).name} vocation.`);
    if (!Equipment.equip(player.kit, id)) return;
    journal(`You equip ${Equipment.items[id].name}.`);
    inventoryChanged();
  }

  function stowItem(slot) {
    const id = player.kit.worn[slot];
    if (!Equipment.stow(player.kit, slot)) return;
    journal(`You put ${Equipment.items[id].name} in your backpack.`);
    inventoryChanged();
  }

  function toggleBackpack() {
    const panel = $("backpack-panel");
    panel.hidden = !panel.hidden;
    $("equipment-slots").querySelector('[data-slot="pack"]').setAttribute("aria-expanded", String(!panel.hidden));
  }

  function makeItemButton(id, origin, slot, count = 1) {
    const button = document.createElement("button");
    button.className = "slot";
    button.type = "button";
    button.dataset.item = id;
    const description = Equipment.description(id);
    button.title = description;
    button.setAttribute("aria-label", description);
    button.append(thumbnail(context => Art.icon(context, id)));
    if (count > 1) {
      const badge = document.createElement("small");
      badge.textContent = count;
      button.append(badge);
    }
    let use = () => journal(description);
    let label = description;
    if (id === "pack") {
      label = "Toggle backpack";
      button.setAttribute("aria-controls", "backpack-panel");
      button.setAttribute("aria-expanded", String(!$("backpack-panel").hidden));
      use = toggleBackpack;
    } else if (origin === "loot") {
      label = `Take ${Equipment.items[id].name}`;
      use = () => takeLoot(id);
    } else if (id === "herb" || id === "manaDraught") {
      label = id === "herb" ? "Use healing herb" : "Use mana draught";
      use = id === "herb" ? heal : drinkMana;
    } else if (Equipment.items[id].slot) {
      label = `${origin === "bag" ? "Equip" : "Unequip"} ${Equipment.items[id].name}`;
      use = () => origin === "bag" ? equipItem(id) : stowItem(slot);
    }
    button.setAttribute("aria-label", label);
    button.addEventListener("click", event => event.shiftKey ? journal(description) : use());
    button.addEventListener("contextmenu", event => {
      event.preventDefault();
      if (mouseMode === "classic" && !event.ctrlKey && !event.metaKey && !event.shiftKey) use();
      else showMenu(event, [["Look", () => journal(description)], ...(label === description ? [] : [[label, use]])]);
    });

    if (id !== "pack" && (origin === "loot" || Equipment.items[id].slot || id === "herb" || id === "manaDraught")) {
      button.draggable = true;
      button.addEventListener("dragstart", event => {
        draggedItem = { id, origin, slot, pile: origin === "loot" ? openLoot : null };
        event.dataTransfer.setData("text/plain", id);
        event.dataTransfer.effectAllowed = origin === "loot" ? "move" : "copyMove";
      });
      button.addEventListener("dragend", clearInventoryDrag);
    }
    return button;
  }

  function clearInventoryDrag() {
    draggedItem = null;
    for (const element of document.querySelectorAll(".drop-ready")) element.classList.remove("drop-ready");
  }

  function inventoryDrop(event, target) {
    if (!draggedItem) return;
    const { id, origin, slot, pile } = draggedItem;
    const destination = target.dataset.slot;
    if (destination ? origin !== "bag" || Equipment.items[id].slot !== destination : !["worn", "loot"].includes(origin)) return;
    event.preventDefault();
    if (event.type === "dragover") {
      event.dataTransfer.dropEffect = "move";
      target.classList.add("drop-ready");
      return;
    }
    clearInventoryDrag();
    if (destination) equipItem(id);
    else if (origin === "worn") stowItem(slot);
    else if (pile === openLoot) takeLoot(id);
  }

  function updateInventory() {
    const { bag, worn } = player.kit;
    const equipped = $("equipment-slots");
    const backpack = $("slots");
    const focused = document.activeElement.dataset.item;
    const gear = Equipment.stats(player.kit);
    $("gear-attack").textContent = Combat.attackRating(player, gear);
    $("gear-defense").textContent = gear.defense;
    $("gear-armor").textContent = gear.armor;
    const coins = bag.coin ?? 0;
    $("coins").textContent = `${coins} ${coins === 1 ? "coin" : "coins"}`;
    if (merchant) updateMerchant();

    equipped.replaceChildren();
    for (const [slot, label] of Object.entries(Equipment.slots)) {
      const id = worn[slot];
      const element = id ? makeItemButton(id, "worn", slot) : document.createElement("div");
      element.classList.add("slot", "equipment-slot");
      element.dataset.slot = slot;
      if (!id) {
        element.classList.add("empty");
        element.setAttribute("aria-label", `${label} slot, empty`);
        element.title = `${label} slot`;
      }
      const caption = document.createElement("span");
      caption.textContent = label;
      caption.setAttribute("aria-hidden", "true");
      element.append(caption);
      equipped.append(element);
    }

    backpack.replaceChildren();
    for (const [id, count] of Object.entries(bag)) backpack.append(makeItemButton(id, "bag", null, count));
    while (backpack.childElementCount < 4) {
      const empty = document.createElement("div");
      empty.className = "slot empty";
      empty.setAttribute("aria-hidden", "true");
      backpack.append(empty);
    }
    if (focused) document.querySelector(`#equipment-slots [data-item="${focused}"], #slots [data-item="${focused}"]`)?.focus({ preventScroll: true });
    updateActions();
    inventoryDirty = false;
  }

  function updateSidebar() {
    labelUpdate();
    drawMinimap();
    updateLandmarks();
    if (!edit) {
      updatePlayPanel();
      updateQuest();
    }
    needsRefresh = false;
  }

  function resize() {
    const box = canvas.getBoundingClientRect();
    const scale = (box.width < 540 ? 1 : 1.25) * gameZoom;
    canvas.width = Math.max(1, Math.round(box.width / scale));
    canvas.height = Math.max(1, Math.round(box.height / scale));
    c.imageSmoothingEnabled = false;
  }

  function displayPosition(actor, now) {
    if (!actor.motion || now >= actor.motion.end) return { ...actor, step: 0 };
    const { from, begin, end, phase } = actor.motion;
    const t = (now - begin) / (end - begin);
    return { ...actor, x: from.x + (actor.x - from.x) * t, y: from.y + (actor.y - from.y) * t, step: phase };
  }

  function moveActor(actor, x, y, now, duration) {
    const phase = actor.walkPhase === 1 ? 2 : 1;
    actor.walkPhase = phase;
    actor.motion = { from: { x: actor.x, y: actor.y }, begin: now, end: now + duration, phase };
    actor.face = OpenTibia.directionFromStepDelta(x - actor.x, y - actor.y, actor.face);
    actor.x = x;
    actor.y = y;
  }

  function render(now) {
    Art.animate(now);
    const floor = currentFloor();
    const center = edit ? editorCenter : displayPosition(player, now);
    view.x = Math.round((center.x + .5) * tile - canvas.width / 2);
    view.y = Math.round((center.y + .5) * tile - canvas.height / 2);
    c.fillStyle = "#101411";
    c.fillRect(0, 0, canvas.width, canvas.height);

    const left = Math.max(0, Math.floor(view.x / tile) - 1);
    const top = Math.max(0, Math.floor(view.y / tile) - 1);
    const right = Math.min(map.width - 1, Math.ceil((view.x + canvas.width) / tile) + 1);
    const bottom = Math.min(map.height - 1, Math.ceil((view.y + canvas.height) / tile) + 2);
    const draws = [];
    const px = x => Math.round(x * tile - view.x);
    const py = y => Math.round(y * tile - view.y);

    for (let y = top; y <= bottom; y++) {
      for (let x = left; x <= right; x++) {
        const type = floor.ground[World.index(map, x, y)];
        Art.tile(c, type, px(x), py(y), x, y);
        if (["path", "water", "river"].includes(type)) {
          const neighbors = [[x, y - 1], [x + 1, y], [x, y + 1], [x - 1, y]];
          neighbors.forEach(([nx, ny], side) => {
            if (World.inside(map, nx, ny) && ["grass", "meadow"].includes(floor.ground[World.index(map, nx, ny)])) {
              Art.edge(c, px(x), py(y), side);
            }
          });
        }
        const key = World.key(x, y);
        const object = floor.objects[key];
        const marker = floor.markers[key];
        if (object === "rug") Art.object(c, object, px(x), py(y), x, y);
        else if (object) draws.push({ y, depth: 0, draw: () => Art.object(c, object, px(x), py(y), x, y) });
        if (marker?.type === "link" && (edit || !["smial", "door"].includes(object))) Art.icon(c, "link", px(x), py(y));
        if (marker?.type === "notice") draws.push({ y, depth: 0, draw: () => Art.signpost(c, px(x), py(y)) });
        if (marker?.type === "ledger" && (edit || !hasLedger)) Art.icon(c, "ledger", px(x), py(y));
        if (edit && marker) {
          if (marker.type === "start") Art.icon(c, "start", px(x), py(y));
          else if (!["link", "notice", "ledger"].includes(marker.type)) {
            draws.push({ y, depth: 1, draw: () => Art.actor(c, marker.type, px(x), py(y)) });
          }
        }
      }
    }

    if (!edit) {
      for (const pile of loot) {
        if (pile.z === player.z) {
          if (pile.kind) Art.corpse(c, pile.kind, px(pile.x), py(pile.y));
          else Art.icon(c, "coin", px(pile.x), py(pile.y));
        }
      }
      const active = [...entities.filter(entity => entity.z === player.z && entity.hp > 0), player];
      for (const entity of active) {
        const pos = displayPosition(entity, now);
        if (pos.x < left || pos.x > right || pos.y < top || pos.y > bottom) continue;
        draws.push({
          y: pos.y, depth: 1, draw: () => {
            const x = px(pos.x);
            const y = py(pos.y);
            if (entity === target) {
              c.lineWidth = 1;
              c.strokeStyle = "#db7958";
              c.strokeRect(x + 1.5, y + 1.5, 29, 29);
            }
            Art.actor(c, entity.type ?? "player", x, y, entity.face, pos.step);
            const friendly = entity !== player && !creatureNames[entity.type];
            if (["miller", "gardener", "merchant"].includes(entity.type)) {
              c.font = "bold 10px system-ui";
              c.textAlign = "center";
              c.lineWidth = 2;
              c.strokeStyle = "#151710";
              c.fillStyle = "#e8ddae";
              c.strokeText(World.markers[entity.type], x + 14, y - 10);
              c.fillText(World.markers[entity.type], x + 14, y - 10);
            }
            if (entity === player || friendly || entity === target || entity.hp < entity.maxHp) {
              c.fillStyle = "#24231c";
              c.fillRect(x + 6, y - 6, 20, 3);
              c.fillStyle = entity === player || friendly ? "#a5bd73" : "#bd644d";
              c.fillRect(x + 7, y - 5, Math.ceil(entity.hp / entity.maxHp * 18), 1);
            }
          }
        });
      }
    }
    draws.sort((a, b) => a.y - b.y || a.depth - b.depth);
    for (const entry of draws) entry.draw();
    if (floor.z < 0 && !edit) {
      const lit = player.spellState.light > 0;
      const light = c.createRadialGradient(canvas.width / 2, canvas.height / 2, tile * (lit ? 5 : 2),
        canvas.width / 2, canvas.height / 2, tile * (lit ? 15 : 10));
      light.addColorStop(0, "rgba(25,22,18,0)");
      light.addColorStop(1, lit ? "rgba(15,15,17,.55)" : "rgba(15,15,17,.78)");
      c.fillStyle = light;
      c.fillRect(0, 0, canvas.width, canvas.height);
    }
    if (combatText.length) combatText = combatText.filter(label => now - label.start < 880);
    if (!edit) {
      spellEffects = spellEffects.filter(effect => now - effect.start < 380);
      for (const effect of spellEffects) {
        if (effect.z !== floor.z) continue;
        const progress = (now - effect.start) / 380;
        c.globalAlpha = 1 - progress;
        c.strokeStyle = effect.color;
        c.lineWidth = 2;
        c.beginPath();
        c.arc(px(effect.x) + tile / 2, py(effect.y) + tile / 2, 5 + progress * tile / 2, 0, Math.PI * 2);
        c.stroke();
      }
      c.globalAlpha = 1;
      c.font = "bold 12px system-ui";
      c.textAlign = "center";
      c.lineWidth = 2;
      for (const label of combatText) {
        if (label.z !== floor.z) continue;
        const x = px(label.x) + tile / 2;
        const y = py(label.y) - 10 - Math.floor((now - label.start) / 45);
        c.strokeStyle = "#171714";
        c.fillStyle = label.color;
        c.strokeText(label.text, x, y);
        c.fillText(label.text, x, y);
      }
    }
    if (edit) {
      c.strokeStyle = "rgba(25,26,18,.38)";
      c.beginPath();
      for (let x = left; x <= right + 1; x++) {
        c.moveTo(px(x) + .5, py(top));
        c.lineTo(px(x) + .5, py(bottom + 1));
      }
      for (let y = top; y <= bottom + 1; y++) {
        c.moveTo(px(left), py(y) + .5);
        c.lineTo(px(right + 1), py(y) + .5);
      }
      c.stroke();
    }
    if (hover && World.inside(map, hover.x, hover.y)) {
      c.strokeStyle = edit ? "#f6d188" : "rgba(234,222,177,.5)";
      c.strokeRect(px(hover.x) + .5, py(hover.y) + .5, 31, 31);
    }
  }

  function adjacentRoute(goal, floor, occupied, forCombat = false) {
    let best = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const x = goal.x + dx;
      const y = goal.y + dy;
      if (floor.markers[World.key(x, y)]?.type === "link" ||
          (forCombat && !World.canStep(map, floor, x, y, goal.x, goal.y, () => false))) continue;
      const route = World.route(map, floor, player, { x, y }, occupied);
      if (route.length && (!best.length || route.length < best.length)) best = route;
    }
    return best;
  }

  function walkTo(goal, nearby = false, interaction = null) {
    const floor = currentFloor();
    const occupied = (x, y) => Boolean(here(x, y));
    pendingInteraction = null;
    if (nearby && distance(player, goal) <= 1) {
      path = [];
      interaction?.();
      return;
    }
    path = nearby ? adjacentRoute(goal, floor, occupied) : World.route(map, floor, player, goal, occupied);
    if (path.length) pendingInteraction = interaction;
  }

  function stepPlayer(dx, dy, now) {
    const x = player.x + dx;
    const y = player.y + dy;
    if (!World.canStep(map, currentFloor(), player.x, player.y, x, y, (nx, ny) => Boolean(here(nx, ny)))) return false;
    stopPractice();
    const interval = OpenTibia.WALK_DURATION_MS * (dx && dy ? 1.5 : 1);
    moveActor(player, x, y, now, interval - 15);
    if (openLoot && distance(player, openLoot) > 1) closeLoot();
    if (merchant && distance(player, merchant) > 1) closeMerchant();
    nextMove = now + interval;
    needsRefresh = true;
    return true;
  }

  function updateQuest() {
    const status = $("quest-status");
    status.hidden = quest === "available";
    $("quest-empty").hidden = quest !== "available";
    if (quest === "available") return;
    const shire = map.adventure === "shire";
    const name = shire ? "The Mill Ledger" : "Rats in the Cellar";
    let objective = "Complete";
    if (quest === "active") {
      if (ratsDefeated < 2) objective = `Clear the rats (${ratsDefeated}/2)`;
      else if (shire && !hasLedger) objective = "Recover the ledger at the back of the storehouse";
      else objective = shire ? "Return to the miller" : "Return to the innkeeper";
    }
    status.textContent = `${name} · ${objective}`;
  }

  function talk() {
    if (quest === "complete") {
      journal("Innkeeper: You've earned your rest, traveller.");
    } else if (ratsDefeated >= 2) {
      quest = "complete";
      Equipment.add(player.kit, "coin", 12);
      Equipment.add(player.kit, "herb", 2);
      Equipment.add(player.kit, "broadsword");
      journal("Innkeeper: The cellar's quiet again. Here are 12 coins, two healing herbs and a Bree broadsword.");
      inventoryChanged();
    } else {
      quest = "active";
      journal(`Innkeeper: Clear the rats beneath the inn, then come back to me. (${ratsDefeated}/2)`);
      journal("The cellar stairs are beside the front door.");
      needsRefresh = true;
    }
  }

  function talkToMiller() {
    if (quest === "complete") {
      journal("Miller: The mill’s running again. Thank you for fetching the ledger.");
      return;
    }
    if (hasLedger) {
      quest = "complete";
      Equipment.add(player.kit, "coin", 12);
      Equipment.add(player.kit, "herb", 2);
      Equipment.add(player.kit, "shireRing");
      journal("Miller: My ledger! Take 12 coins, two healing herbs, and this brass ring.");
      inventoryChanged();
      return;
    }
    quest = "active";
    needsRefresh = true;
    if (ratsDefeated >= 2) {
      journal("Miller: The ledger’s beside the chest at the back of the storehouse.");
    } else {
      journal(`Miller: Rats got into the flour. Clear them out and bring back my ledger. (${ratsDefeated}/2)`);
      journal("The mill door leads down to the storehouse.");
    }
  }

  function takeLedger() {
    if (hasLedger) return false;
    if (quest !== "active") {
      journal("It’s the mill’s ledger. Ask the miller about it.");
    } else if (ratsDefeated < 2) {
      journal("Clear the rats before you search the storehouse.");
    } else {
      hasLedger = true;
      needsRefresh = true;
      journal("You recover the mill ledger. Take it back to the miller.");
    }
    return true;
  }

  function useAt(x, y) {
    const floor = currentFloor();
    const key = World.key(x, y);
    const marker = floor.markers[key];
    if (marker?.type === "link") {
      const destination = World.floorAt(map, marker.z);
      if (!destination || !World.passable(map, destination, marker.x, marker.y) || here(marker.x, marker.y, marker.z)) {
        journal("The passage is blocked.");
        return true;
      }
      closeLoot();
      closeMerchant();
      previewFloor = null;
      Object.assign(player, { x: marker.x, y: marker.y, z: marker.z, motion: null });
      path = [];
      target = null;
      const ferry = map.adventure === "shire" && marker.z === 0 && floor.z === 0 &&
        ((x === 110 && y === 81) || (x === 116 && y === 81));
      journal(ferry ? "You cross the Brandywine by ferry." : `Entered ${destination.name}.`);
      needsRefresh = true;
      return true;
    }
    const pile = lootAt(x, y);
    if (pile) {
      openContainer(pile);
      return true;
    }
    if (marker?.type === "keeper") {
      talk();
      return true;
    }
    if (marker?.type === "miller") {
      talkToMiller();
      return true;
    }
    if (marker?.type === "merchant") {
      openMerchant(here(x, y));
      return true;
    }
    if (marker?.type === "gardener") {
      journal("Sam Gamgee: Bag End’s the green door up the lane. You’ll find the mill beside The Water, east of here.");
      return true;
    }
    if (marker?.type === "ledger") return takeLedger();
    if (marker?.type === "notice") {
      journal(marker.text);
      return true;
    }
    if (floor.objects[key] === "sign") {
      journal(map.name === "Bree" ? "The Prancing Pony · Rooms and supper." : map.name);
      return true;
    }
    return false;
  }

  function interact() {
    path = [];
    pendingInteraction = null;
    const trader = entities.find(entity => entity.type === "merchant" && entity.z === player.z && distance(player, entity) <= 1);
    if (trader) return openMerchant(trader);
    if (useAt(player.x, player.y)) return;
    const offsets = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]];
    for (const [dx, dy] of offsets) if (useAt(player.x + dx, player.y + dy)) return;
    journal("Move beside a person, passage, or item to interact.");
  }

  function lootAt(x, y) {
    return loot.find(pile => pile.z === player.z && pile.x === x && pile.y === y);
  }

  function openMerchant(trader) {
    if (!trader || trader.z !== player.z || distance(player, trader) > 1) return;
    stopActions();
    closeLoot();
    merchant = trader;
    shopMode = "buy";
    $("merchant-panel").hidden = false;
    updateMerchant();
  }

  function closeMerchant() {
    merchant = null;
    $("merchant-panel").hidden = true;
  }

  function updateMerchant() {
    const { bag } = player.kit;
    $("shop-coins").textContent = `${bag.coin ?? 0} coins`;
    for (const button of $("merchant-panel").querySelectorAll("[data-shop]")) {
      button.setAttribute("aria-pressed", String(button.dataset.shop === shopMode));
    }
    const list = $("shop-stock");
    const focused = document.activeElement.dataset.tradeItem;
    list.replaceChildren();
    const buying = shopMode === "buy";
    const stock = buying ? Hunting.buy : Hunting.sell;
    for (const [id, price] of Object.entries(stock)) {
      const item = Equipment.items[id];
      if (!buying && !bag[id]) continue;
      const row = document.createElement("li");
      const label = document.createElement("span");
      label.textContent = buying ? item.name : `${item.name} ×${bag[id]}`;
      label.title = Equipment.description(id);
      if (item.vocation) {
        const requirement = document.createElement("small");
        requirement.textContent = Vocations.get(item.vocation).name;
        label.append(requirement);
      }
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.tradeItem = id;
      button.textContent = `${price}c`;
      button.setAttribute("aria-label", `${buying ? "Buy" : "Sell"} ${item.name} for ${price} coins`);
      button.disabled = buying && ((bag.coin ?? 0) < price || Boolean(item.vocation && item.vocation !== player.vocation));
      button.addEventListener("click", () => tradeItem(id));
      row.append(thumbnail(context => Art.icon(context, id), 20), label, button);
      list.append(row);
      if (id === focused && !button.disabled) button.focus({ preventScroll: true });
    }
    if (!list.childElementCount) {
      const empty = document.createElement("li");
      empty.className = "panel-note";
      empty.textContent = "No goods in your backpack to sell.";
      list.append(empty);
    }
  }

  function tradeItem(id) {
    if (!merchant || edit || merchant.z !== player.z || distance(player, merchant) > 1) return;
    const buying = shopMode === "buy";
    const stock = buying ? Hunting.buy : Hunting.sell;
    if (!Object.hasOwn(stock, id)) return;
    const price = stock[id];
    const { bag } = player.kit;
    const { name, vocation } = Equipment.items[id];
    if (buying ? (bag.coin ?? 0) < price || (vocation && vocation !== player.vocation) : !bag[id]) return;
    const quantity = buying ? 1 : -1;
    Equipment.add(player.kit, id, quantity);
    Equipment.add(player.kit, "coin", -quantity * price);
    if (!saveProgress(true)) {
      Equipment.add(player.kit, id, -quantity);
      Equipment.add(player.kit, "coin", quantity * price);
      return journal("The trade could not be saved.", "loot");
    }
    journal(`You ${buying ? "buy" : "sell"} ${name.toLowerCase()} for ${price} coins.`, "loot");
    inventoryChanged();
  }

  function closeLoot() {
    openLoot = null;
    $("loot-panel").hidden = true;
  }

  function openContainer(pile) {
    openLoot = pile;
    const name = creatureNames[pile.kind];
    $("loot-title").textContent = name ? `${name} corpse` : "Loot";
    const slots = $("loot-slots");
    slots.replaceChildren();
    if (pile.coins) slots.append(makeItemButton("coin", "loot", null, pile.coins));
    const counts = new Map();
    for (const item of pile.items) counts.set(item, (counts.get(item) ?? 0) + 1);
    for (const [item, count] of counts) slots.append(makeItemButton(item, "loot", null, count));
    $("loot-panel").hidden = false;
  }

  function takeLoot(id = null) {
    const pile = openLoot;
    if (!pile || pile.z !== player.z || distance(player, pile) > 1) return;
    if (id === "coin" || id === null) {
      if (pile.coins) {
        Equipment.add(player.kit, "coin", pile.coins);
        hunt.coins += pile.coins;
      }
      pile.coins = 0;
    }
    if (id === null) {
      for (const item of pile.items) Equipment.add(player.kit, item);
      pile.items = [];
    } else if (id !== "coin") {
      const index = pile.items.indexOf(id);
      if (index === -1) return;
      Equipment.add(player.kit, id);
      pile.items.splice(index, 1);
    }
    journal(id ? `You take ${Equipment.items[id].name.toLowerCase()}.` : "You take the remaining loot.", "loot");
    if (!pile.coins && !pile.items.length) {
      loot = loot.filter(item => item !== pile);
      closeLoot();
    } else openContainer(pile);
    inventoryChanged();
  }

  function tileInfo(pos) {
    const floor = currentFloor();
    const key = World.key(pos.x, pos.y);
    const entity = here(pos.x, pos.y);
    const marker = floor.markers[key];
    const object = floor.objects[key];
    const pile = lootAt(pos.x, pos.y);
    const markerName = marker?.type === "ledger" && hasLedger ? null : World.markers[marker?.type];
    const name = (entity && (creatureNames[entity.type] || World.markers[entity.type])) ||
      (pile && (creatureNames[pile.kind] ? `${creatureNames[pile.kind]} corpse` : "Loot")) ||
      (marker?.type === "link" && object ? World.objects[object] : markerName) ||
      World.objects[object] || World.ground[floor.ground[World.index(map, pos.x, pos.y)]];
    const action = marker?.type === "link" || object === "sign" ? "Use" : pile ? "Open" :
      markerName ? markerActions[marker?.type] : null;
    return { floor, entity, marker, name, action };
  }

  function useTile(pos, info) {
    if (info.entity && creatureNames[info.entity.type]) {
      selectTarget(info.entity);
    } else if (info.marker?.type === "link") {
      if (distance(player, pos) === 0) useAt(pos.x, pos.y);
      else walkTo(pos);
    } else if (info.action) {
      walkTo(pos, true, () => useAt(pos.x, pos.y));
    }
  }

  function clickWorld(event) {
    const pos = pointerPos(event);
    if (!World.inside(map, pos.x, pos.y)) return;
    const info = tileInfo(pos);
    if (event.shiftKey) return journal(`You see: ${info.name}.`);
    if (mouseMode === "context" || event.ctrlKey || event.metaKey) {
      if (info.action || (info.entity && creatureNames[info.entity.type])) return useTile(pos, info);
    } else if (info.marker?.type === "link" && distance(player, pos) === 0) {
      return useTile(pos, info);
    }
    walkTo(pos);
  }

  const tileMenu = $("tile-menu");

  function closeTileMenu() {
    tileMenu.hidden = true;
  }

  function showMenu(event, choices) {
    tileMenu.replaceChildren();
    for (const [label, action] of choices) {
      const item = document.createElement("button");
      item.textContent = label;
      item.addEventListener("click", () => {
        closeTileMenu();
        action();
        canvas.focus({ preventScroll: true });
      });
      tileMenu.append(item);
    }
    tileMenu.hidden = false;
    tileMenu.style.left = `${Math.max(0, Math.min(event.clientX, innerWidth - tileMenu.offsetWidth))}px`;
    tileMenu.style.top = `${Math.max(0, Math.min(event.clientY, innerHeight - tileMenu.offsetHeight))}px`;
    tileMenu.firstElementChild.focus({ preventScroll: true });
  }

  function showTileMenu(event) {
    event.preventDefault();
    if (edit) return;
    const pos = pointerPos(event);
    if (!World.inside(map, pos.x, pos.y)) return;
    const info = tileInfo(pos);
    const look = () => journal(`You see: ${info.name}.`);
    if (event.shiftKey) return look();
    if (mouseMode === "classic" && !event.ctrlKey && !event.metaKey) return useTile(pos, info);
    const choices = [["Look", look]];
    if (World.passable(map, info.floor, pos.x, pos.y) && !info.entity) choices.push(["Walk here", () => walkTo(pos)]);
    if (info.entity && creatureNames[info.entity.type]) {
      choices.push([target === info.entity ? "Stop attack" : "Attack", () => selectTarget(info.entity)]);
    } else if (info.action) choices.push([info.action, () => useTile(pos, info)]);
    showMenu(event, choices);
  }

  function battleTargets() {
    return entities.filter(entity => creatureNames[entity.type] && entity.hp > 0 && entity.z === player.z && distance(entity, player) <= 7)
      .sort((a, b) => distance(player, a) - distance(player, b));
  }

  function selectTarget(entity) {
    stopPractice();
    target = entity === target ? null : entity;
    path = [];
    pendingInteraction = null;
    nextChase = 0;
    needsRefresh = true;
  }

  function attackKey() {
    const enemy = battleTargets()[0];
    if (!target && enemy) selectTarget(enemy);
    else if (!target) journal("There is nothing nearby to attack.");
  }

  function stopActions() {
    closeTileMenu();
    stopPractice();
    target = null;
    path = [];
    pendingInteraction = null;
    held.clear();
    needsRefresh = true;
  }

  function canPractice() {
    return player.z === trainingPoint.z && distance(player, trainingPoint) <= 1 &&
      !entities.some(entity => creatureNames[entity.type] && entity.hp > 0 && entity.z === player.z && distance(player, entity) <= 4);
  }

  function canTrain(skill) {
    return skill === "shielding" ? !!player.kit.worn.shield : Combat.weaponSkill(player.kit) === skill;
  }

  function updateTrainingPanel() {
    const available = canPractice();
    $("training-status").textContent = practice ? "Practising every 2s · Esc to stop" :
      available ? "Practise at the starting point." : "Return to the starting point away from enemies.";
    for (const button of $("training-controls").children) {
      const skill = button.dataset.practice;
      const equipped = canTrain(skill);
      button.disabled = !available || !equipped;
      button.title = equipped ? "" : skills[skill].requirement;
      button.setAttribute("aria-pressed", String(practice === skill));
    }
  }

  function stopPractice() {
    if (!practice) return;
    practice = null;
    needsRefresh = true;
  }

  function trainSkill(skill) {
    if (Combat.train(player[skill], Vocations.rate(player.vocation, skill))) {
      journal(`You advanced to ${skills[skill].label} level ${player[skill].level}.`);
    }
  }

  function practise(now) {
    if (!practice) return;
    const blocking = practice === "shielding";
    if (!canPractice() || !canTrain(practice)) return stopPractice();
    if (now < nextPractice) return;
    nextPractice = now + Combat.swingInterval;
    const successful = blocking ? Combat.mitigate(player, Combat.roll(2, 4), false).blocked : Combat.attack(player) > 0;
    if (successful) trainSkill(practice);
    showCombatText(player, successful ? (blocking ? "Practice block" : "Practice hit") : "Try again", "#e3d0a1", now);
    needsRefresh = true;
  }

  function spellIcon(spell) {
    const icon = document.createElement("span");
    icon.className = "spell-icon";
    icon.textContent = spell.icon;
    icon.setAttribute("aria-hidden", "true");
    return icon;
  }

  function buildSpellbook() {
    for (const [id, spell] of Object.entries(Magic.spells)) {
      const entry = document.createElement("li");
      entry.className = "spell-entry";
      entry.dataset.spellGroup = spell.group;
      const button = document.createElement("button");
      button.type = "button";
      button.draggable = true;
      button.setAttribute("aria-label", `Cast ${spell.name}`);
      button.title = "Click to cast or drag to an action slot";
      button.append(spellIcon(spell));
      button.addEventListener("click", () => castSpell(id));
      button.addEventListener("dragstart", event => {
        draggedItem = { id, origin: "spellbook" };
        event.dataTransfer.setData("text/plain", id);
        event.dataTransfer.effectAllowed = "copy";
      });
      button.addEventListener("dragend", clearInventoryDrag);
      const info = document.createElement("span");
      info.className = "spell-info";
      const name = document.createElement("strong");
      name.textContent = spell.name;
      const words = document.createElement("code");
      words.textContent = spell.words;
      const status = document.createElement("small");
      info.append(name, words, status);
      entry.append(button, info);
      $("spell-list").append(entry);
      spellRows.set(id, { entry, status });
    }
  }

  function updateSpellStatus() {
    for (const [id, { entry, status }] of spellRows) {
      const spell = Magic.spells[id];
      const hidden = !Magic.canLearn(spell, player.vocation);
      if (entry.hidden !== hidden) entry.hidden = hidden;
      if (hidden) continue;
      const seconds = Math.ceil(Magic.remaining(player, id) / 1000);
      let label = spell.range ? `Range ${spell.range}` : spell.group === "support" ? "45s light" : "Self heal";
      if (spell.skill) label += ` · ${skills[spell.skill].label}`;
      if (player.level < spell.level) label = `Level ${spell.level}`;
      else if (seconds) label = `${seconds}s cooldown`;
      else if (id === "light" && player.spellState.light) label = `${Math.ceil(player.spellState.light / 1000)}s active`;
      const value = `${spell.mana} mana · ${label}`;
      if (status.textContent !== value) status.textContent = value;
    }
    for (const button of document.querySelectorAll("[data-spell-action]")) {
      const id = button.dataset.spellAction;
      const spell = Magic.spells[id];
      const unavailable = !Magic.canLearn(spell, player.vocation) || player.level < spell.level;
      button.toggleAttribute("data-unavailable", unavailable);
      const seconds = unavailable ? 0 : Math.ceil(Magic.remaining(player, id) / 1000);
      const text = seconds ? `${seconds}s` : "";
      if (text && button.dataset.cooldown !== text) button.dataset.cooldown = text;
      if (!text && button.hasAttribute("data-cooldown")) button.removeAttribute("data-cooldown");
    }
  }

  function advanceMagic(now, flush = false) {
    if (document.hidden) return;
    const time = Math.floor(now);
    magicClock ??= time;
    const elapsed = time - magicClock;
    if (elapsed < (flush ? 1 : 100)) return;
    magicClock = time;
    // The frame loop stops while hidden. A long stall also pauses play timers.
    if (Magic.tick(player, Math.min(elapsed, 250))) needsRefresh = true;
    updateSpellStatus();
  }

  function castSpell(id) {
    if (edit) return;
    const spell = Magic.spells[id];
    if (!Magic.canLearn(spell, player.vocation)) return journal(`${spell.name} is unavailable to your vocation.`, "combat");
    const now = performance.now();
    advanceMagic(now, true);
    if (player.level < spell.level) return journal(`${spell.name} requires level ${spell.level}.`, "combat");
    if (Magic.remaining(player, id)) return journal("You are exhausted.", "combat");
    if (player.mana < spell.mana) return journal("You do not have enough mana.", "combat");
    if (spell.skill && Combat.weaponSkill(player.kit) !== spell.skill) {
      return journal(`${skills[spell.skill].requirement} to cast ${spell.name}.`, "combat");
    }
    if (spell.range) {
      if (!target || target.z !== player.z || target.hp <= 0 || distance(player, target) > spell.range) {
        return journal(`Select a target within ${spell.range} tiles.`, "combat");
      }
      if (!World.clearSight(currentFloor(), player, target)) return journal("Your target is out of sight.", "combat");
    } else if (spell.group === "healing" && player.hp === player.maxHp) {
      return journal("You are already at full health.", "combat");
    }

    stopPractice();
    const power = Math.floor(player.level / 2) + (spell.skill ? Math.floor(player[spell.skill].level / 4) : player.magic.level) +
      Equipment.spellBonus(player.kit, spell.group);
    const advanced = Magic.spend(player, id);
    journal(`You say: ${spell.words}`, "combat");
    showSpellEffect(player, "#a5caff", now);
    if (spell.group === "healing") {
      const restored = Math.min(player.maxHp - player.hp, Combat.roll(...spell.power) + power);
      player.hp += restored;
      hunt.healing += restored;
      showCombatText(player, `+${restored}`, "#a9e2b0", now);
      journal(`You recover ${restored} health.`, "combat");
    } else if (spell.group === "attack") {
      const damage = Combat.roll(...spell.power) + power;
      showSpellEffect(target, spell.color ?? "#82a9ff", now);
      hitTarget(damage, now, spell.name);
    } else {
      player.spellState.light = Magic.lightDuration;
      showCombatText(player, spell.name, "#f8d990", now);
      journal("A light surrounds you for 45 seconds.", "combat");
    }
    if (advanced) journal(`You advanced to magic level ${player.magic.level}.`);
    updateSpellStatus();
    needsRefresh = true;
  }

  function setAction(index, id) {
    if (!Saves.validAction(id)) return;
    actions[index] = id;
    savePending = true;
    updateActions();
  }

  function runAction(id) {
    if (id === "attack") attackKey();
    else if (id === "use") interact();
    else if (id === "stop") stopActions();
    else if (id === "herb") heal();
    else if (id === "manaDraught") drinkMana();
    else if (Object.hasOwn(Magic.spells, id)) castSpell(id);
    else if (id) {
      const slot = Equipment.items[id].slot;
      if (player.kit.worn[slot] === id) stowItem(slot);
      else if (player.kit.bag[id]) equipItem(id);
      else journal(`You don’t have ${Equipment.items[id].name.toLowerCase()}.`);
    }
  }

  function updateActions() {
    const left = $("action-bar");
    const right = $("action-bar-right");
    const focused = document.activeElement.dataset.actionIndex;
    left.replaceChildren();
    right.replaceChildren();
    actions.forEach((id, index) => {
      const button = document.createElement("button");
      button.type = "button";
      const hotkey = `F${index + 1}`;
      const spell = Magic.spells[id];
      const label = spell?.name ?? ({ attack: "Attack", use: "Use nearby", stop: "Stop", herb: "Use healing herb", manaDraught: "Use mana draught" })[id] ??
        (id ? Equipment.items[id].name : "Empty");
      button.dataset.actionIndex = index;
      button.title = id ? `${label} (${hotkey})` : `${hotkey} · Drag an item or spell here`;
      button.setAttribute("aria-label", `${hotkey} ${label}`);
      const key = document.createElement("kbd");
      key.textContent = hotkey;
      button.append(key);
      if (spell) {
        button.dataset.spellAction = id;
        button.dataset.spellGroup = spell.group;
        button.append(spellIcon(spell));
      } else if (id && !["use", "stop"].includes(id)) {
        button.append(thumbnail(context => Art.icon(context, id === "attack" ? "sword" : id)));
      } else {
        const icon = document.createElement("span");
        icon.className = id === "stop" ? "stop-icon" : "empty-action";
        icon.textContent = id === "stop" ? "■" : id === "use" ? "↵" : "·";
        icon.setAttribute("aria-hidden", "true");
        button.append(icon);
      }
      if (id === "herb" || id === "manaDraught") {
        const count = document.createElement("small");
        count.textContent = player.kit.bag[id] ?? 0;
        button.append(count);
      }
      button.addEventListener("click", () => {
        runAction(id);
        canvas.focus({ preventScroll: true });
      });
      button.addEventListener("contextmenu", event => {
        event.preventDefault();
        const presets = [
          ["Attack", "attack"], ["Use healing herb", "herb"], ["Use nearby", "use"], ["Stop", "stop"],
          ...Object.entries(Magic.spells).filter(([, spell]) => Magic.canLearn(spell, player.vocation))
            .map(([key, spell]) => [spell.name, key]), ["Clear slot", null],
        ];
        showMenu(event, presets.map(([name, action]) => [name, () => setAction(index, action)]));
      });
      (index < 6 ? left : right).append(button);
      if (String(index) === focused) button.focus({ preventScroll: true });
    });
    updateSpellStatus();
  }

  function showCombatText(actor, text, color, now) {
    combatText.push({ x: actor.x, y: actor.y, z: actor.z, text, color, start: now });
  }

  function showSpellEffect(actor, color, now) {
    spellEffects.push({ x: actor.x, y: actor.y, z: actor.z, color, start: now });
  }

  function canStrike(actor, defender) {
    return distance(actor, defender) <= 1 &&
      World.canStep(map, currentFloor(), actor.x, actor.y, defender.x, defender.y, () => false);
  }

  function canAttack(defender) {
    const range = Equipment.items[player.kit.worn.weapon]?.range;
    return range ? distance(player, defender) <= range && World.clearSight(currentFloor(), player, defender) :
      canStrike(player, defender);
  }

  function hit(now) {
    if (!target || now < nextAttack || !canAttack(target)) return;
    nextAttack = now + Combat.swingInterval;
    player.face = OpenTibia.directionFromStepDelta(target.x - player.x, target.y - player.y, player.face);
    const damage = Combat.attack(player);
    if (damage > 0) {
      const skill = Combat.weaponSkill(player.kit);
      if (skill === "distance") showSpellEffect(target, "#d7cda9", now);
      trainSkill(skill);
    }
    hitTarget(damage, now);
  }

  function hitTarget(power, now, spellName) {
    const damage = Math.min(target.hp, power);
    const name = creatureNames[target.type];
    target.hp -= damage;
    hunt.dealt += damage;
    showCombatText(target, damage || "Miss", spellName ? "#aac6ff" : damage ? "#ff8e70" : "#f3d9a7", now);
    const verb = spellName ? `${spellName} hits` : "You hit";
    journal(damage ? `${verb} the ${name.toLowerCase()} for ${damage}.` : `You miss the ${name.toLowerCase()}.`, "combat");
    if (target.hp === 0) {
      if (target.type === "rat") ratsDefeated++;
      const { xp, coins, drops, respawns } = Hunting.creatures[target.type];
      const item = drops?.[Combat.roll(0, drops.length - 1)];
      if (respawns) {
        target.respawnAt = Date.now() + Hunting.respawnDelay;
        huntKills[target.type] = (huntKills[target.type] ?? 0) + 1;
      }
      const pile = loot.find(entry => entry.x === target.x && entry.y === target.y && entry.z === target.z);
      if (pile) {
        pile.coins += coins;
        if (item) pile.items.push(item);
        if (pile === openLoot) openContainer(pile);
      } else {
        loot.push({ x: target.x, y: target.y, z: target.z, kind: target.type, coins, items: item ? [item] : [] });
      }
      journal(`${name} defeated. You gain ${xp} experience.`, "combat");
      player.xp += xp;
      hunt.xp += xp;
      if (player.xp >= player.level * 18) {
        player.xp -= player.level * 18;
        const vocation = Vocations.get(player.vocation);
        player.level++;
        player.maxHp += vocation.hp;
        player.hp = player.maxHp;
        player.mana += vocation.mana;
        journal(`You reached level ${player.level}.`);
        if (player.vocation) {
          for (const spell of Object.values(Magic.spells)) {
            if (spell.level === player.level && Magic.canLearn(spell, player.vocation)) journal(`You learned ${spell.name}.`);
          }
        }
      }
      target = null;
    }
    needsRefresh = true;
  }

  function heal() {
    const now = performance.now();
    if (now < nextHeal) return;
    if (player.hp === player.maxHp) return journal("You are already at full health.");
    if (!player.kit.bag.herb) return journal("Your backpack is out of healing herbs.");
    const restored = Math.min(Equipment.items.herb.healing, player.maxHp - player.hp);
    player.hp += restored;
    hunt.healing += restored;
    nextHeal = now + 1000;
    Equipment.add(player.kit, "herb", -1);
    showCombatText(player, `+${restored}`, "#a9da83", now);
    journal(`You use a healing herb and recover ${restored} health.`, "combat");
    inventoryChanged();
  }

  function drinkMana() {
    const now = performance.now();
    if (now < nextMana) return;
    const capacity = Vocations.maxMana(player.level, player.vocation);
    if (player.mana === capacity) return journal("You are already at full mana.");
    if (!player.kit.bag.manaDraught) return journal("Your backpack is out of mana draughts.");
    const restored = Math.min(Equipment.items.manaDraught.mana, capacity - player.mana);
    player.mana += restored;
    nextMana = now + 1000;
    Equipment.add(player.kit, "manaDraught", -1);
    showCombatText(player, `+${restored} mana`, "#aac6ff", now);
    journal(`You drink a mana draught and recover ${restored} mana.`, "combat");
    inventoryChanged();
  }

  function respawnCreatures(now) {
    const time = Date.now();
    for (const entity of entities) {
      if (!entity.respawnAt || time < entity.respawnAt) continue;
      const { x, y } = entity.origin;
      if (player.z === entity.z && distance(player, entity.origin) <= Hunting.leaveDistance) continue;
      if (here(x, y, entity.z)) continue;
      Object.assign(entity, { x, y, hp: entity.maxHp, face: OpenTibia.Direction.South, respawnAt: null,
        motion: null, nextHit: now + Combat.swingInterval, nextMove: now });
      needsRefresh = true;
    }
  }

  function enemies(now) {
    respawnCreatures(now);
    const floor = currentFloor();
    for (const entity of entities) {
      if (!creatureNames[entity.type] || entity.z !== player.z || entity.hp <= 0) continue;
      const range = distance(player, entity);
      const inReach = canStrike(entity, player);
      if (inReach && now >= entity.nextHit) {
        stopPractice();
        entity.nextHit = now + Combat.swingInterval;
        const incoming = Combat.roll(1, Hunting.creatures[entity.type].damage);
        const result = Combat.mitigate(player, incoming, now < nextAttack);
        const damage = Math.min(player.hp, result.damage);
        player.hp -= damage;
        hunt.received += damage;
        const name = creatureNames[entity.type].toLowerCase();
        if (result.blocked && player.kit.worn.shield) trainSkill("shielding");
        showCombatText(player, damage || "Block", damage ? "#ff887b" : "#e3d0a1", now);
        if (damage) journal(`The ${name} hits you for ${damage}.`, "combat");
        else if (result.blocked) journal(`You block the ${name}'s attack.`, "combat");
        else journal(`Your armor absorbs the ${name}'s attack.`, "combat");
        needsRefresh = true;
        if (player.hp === 0) {
          const start = World.findStart(map);
          closeLoot();
          closeMerchant();
          previewFloor = null;
          Object.assign(player, { ...start, hp: player.maxHp, motion: null });
          path = [];
          pendingInteraction = null;
          target = null;
          journal("You recover at the starting point.");
          break;
        }
      }
      if (inReach || now < entity.nextMove) continue;
      const pursuing = range <= 4 && distance(player, entity.origin) <= 7;
      const goal = pursuing ? player : entity.origin;
      const occupied = (x, y) => Boolean(here(x, y));
      const next = World.route(map, floor, entity, goal, occupied)[0];
      entity.nextMove = now + 475;
      if (next && (next.x !== player.x || next.y !== player.y)) {
        moveActor(entity, next.x, next.y, now, 150);
        needsRefresh = true;
      }
    }
  }

  function updateGame(now) {
    advanceMagic(now);
    if (player.motion && now >= player.motion.end) {
      player.motion = null;
      savePending = true;
      const marker = currentFloor().markers[World.key(player.x, player.y)];
      if (marker?.type === "link") {
        pendingInteraction = null;
        if (useAt(player.x, player.y)) return;
      }
    }
    if (target && distance(player, target) > 8) {
      target = null;
      needsRefresh = true;
    }
    if (now >= nextMove) {
      const directions = [...held.values()];
      const dx = Math.sign(directions.reduce((sum, value) => sum + value[0], 0));
      const dy = Math.sign(directions.reduce((sum, value) => sum + value[1], 0));
      if (dx || dy) {
        path = [];
        pendingInteraction = null;
        stepPlayer(dx, dy, now);
      } else if (path.length) {
        const next = path.shift();
        if (!stepPlayer(next.x - player.x, next.y - player.y, now)) {
          path = [];
          pendingInteraction = null;
        }
      } else if (pendingInteraction) {
        const run = pendingInteraction;
        pendingInteraction = null;
        run();
      } else if (target && player.pursuit === "chase" && now >= nextChase && !canAttack(target)) {
        nextChase = now + 260;
        const next = adjacentRoute(target, currentFloor(), (x, y) => Boolean(here(x, y)), true)[0];
        if (next) stepPlayer(next.x - player.x, next.y - player.y, now);
      }
    }
    hit(now);
    practise(now);
    if (now - lastTick >= 105) {
      enemies(now);
      lastTick = now;
    }
  }

  function setStatus(message) {
    $("save-status").textContent = message;
  }

  function updateHistory() {
    $("undo").disabled = !undo.length;
    $("redo").disabled = !redo.length;
  }

  function syncEditor() {
    const floors = $("floors");
    floors.replaceChildren();
    for (const floor of [...map.floors].sort((a, b) => b.z - a.z)) {
      const option = document.createElement("option");
      option.value = floor.z;
      option.textContent = `${floor.z} · ${floor.name}`;
      floors.append(option);
    }
    if (!World.floorAt(map, editFloor)) editFloor = map.floors[0].z;
    placeEditor(editorCenter.x, editorCenter.y);
    floors.value = editFloor;
    updateHistory();
    needsRefresh = true;
  }

  function showPalette() {
    const palette = $("palette");
    palette.replaceChildren();
    const catalog = { ground: World.ground, objects: World.objects, markers: World.markers };
    const choices = Object.entries(catalog[layer]);
    if (layer !== "ground") choices.unshift(["erase", "Erase"]);
    for (const [type, label] of choices) {
      const button = document.createElement("button");
      button.setAttribute("aria-pressed", String(type === brushes[layer]));
      const image = thumbnail(context => Art.preview(context, type, layer), 30);
      button.append(image, document.createTextNode(label));
      button.addEventListener("click", () => {
        brushes[layer] = type;
        for (const choice of palette.children) choice.setAttribute("aria-pressed", String(choice === button));
      });
      palette.append(button);
    }
    for (const tab of $("layers").children) tab.setAttribute("aria-pressed", String(tab.dataset.layer === layer));
    $("editor-tip").textContent = "Paint on the map. Use WASD or click the minimap to pan.";
  }

  function snapshot() {
    return { map: structuredClone(map), floor: editFloor };
  }

  function record(before) {
    undo.push(before);
    if (undo.length > 40) undo.shift();
    redo = [];
    updateHistory();
    setStatus("Unsaved world edits");
    needsRefresh = true;
  }

  function restore(from, to) {
    if (!from.length) return;
    to.push(snapshot());
    const previous = from.pop();
    map = previous.map;
    editFloor = previous.floor;
    syncEditor();
    setStatus("Unsaved world edits");
  }

  function paint(pos) {
    if (!World.inside(map, pos.x, pos.y)) return;
    const floor = currentFloor();
    const brush = brushes[layer];
    const key = World.key(pos.x, pos.y);
    if (layer === "ground") {
      const index = World.index(map, pos.x, pos.y);
      if (floor.ground[index] === brush) return;
      floor.ground[index] = brush;
    } else if (layer === "objects") {
      const object = brush === "erase" ? undefined : brush;
      if (floor.objects[key] === object) return;
      if (object) floor.objects[key] = object;
      else delete floor.objects[key];
    } else {
      if (brush === "erase") {
        if (!floor.markers[key]) return;
        delete floor.markers[key];
      } else if (brush === "link") {
        const answer = prompt("Destination floor, x, y. Place a return link on that floor if needed.", `${floor.z - 1}, ${pos.x}, ${pos.y}`);
        if (answer === null) return;
        const values = answer.split(",").map(value => value.trim());
        const [z, x, y] = values.map(Number);
        const destination = World.floorAt(map, z);
        if (values.length !== 3 || values.some(value => !/^-?\d+$/.test(value)) || !destination || !World.passable(map, destination, x, y) || !World.passable(map, floor, pos.x, pos.y)) {
          setStatus("Choose walkable source and destination tiles on existing floors.");
          return;
        }
        floor.markers[key] = { type: "link", z, x, y };
      } else {
        if (floor.markers[key]?.type === brush && brush !== "notice") return;
        if (!World.passable(map, floor, pos.x, pos.y)) {
          setStatus("Place markers on walkable tiles.");
          return;
        }
        if (brush === "start") {
          for (const entry of map.floors) {
            for (const [position, marker] of Object.entries(entry.markers)) {
              if (marker.type === "start") delete entry.markers[position];
            }
          }
        }
        if (brush === "notice") {
          const previous = floor.markers[key]?.text ?? "";
          const text = prompt("Signpost text", previous)?.trim().slice(0, 160);
          if (!text || text === previous) return;
          floor.markers[key] = { type: brush, text };
        } else {
          floor.markers[key] = { type: brush };
        }
      }
    }
    gesture.changed = true;
    needsRefresh = true;
  }

  function paintLine(from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const steps = Math.max(Math.abs(dx), Math.abs(dy));
    for (let step = 1; step <= steps; step++) paint({ x: Math.round(from.x + dx * step / steps), y: Math.round(from.y + dy * step / steps) });
  }

  function finishPaint() {
    if (!gesture) return;
    const { before, changed } = gesture;
    gesture = null;
    if (changed) record(before);
  }

  function pointerPos(event) {
    const box = canvas.getBoundingClientRect();
    return {
      x: Math.floor((view.x + (event.clientX - box.left) * canvas.width / box.width) / tile),
      y: Math.floor((view.y + (event.clientY - box.top) * canvas.height / box.height) / tile)
    };
  }

  function switchMode(enable) {
    if (edit === enable) return;
    finishPaint();
    closeTileMenu();
    closeLoot();
    held.clear();
    if (enable) {
      stopPractice();
      saveProgress(true);
      closeMerchant();
      editFloor = player.z;
      editorCenter = { x: player.x, y: player.y };
      syncEditor();
      showPalette();
    } else {
      try {
        World.validate(map);
      } catch (error) {
        setStatus(error.message);
        return;
      }
    }
    edit = enable;
    magicClock = null;
    if (!edit) {
      for (const floor of map.floors) minimapFloors.delete(floor);
      const state = resumePlay();
      if (state !== "continued") announcePlay(state);
    }
    $("game-saving").hidden = edit;
    if (edit) $("quest-status").hidden = true;
    hover = null;
    $("play").setAttribute("aria-pressed", String(!edit));
    $("edit").setAttribute("aria-pressed", String(edit));
    ClientLayout.setEditor(edit);
    $("edit-panel").hidden = !edit;
    $("controls").hidden = edit;
    previewFloor = null;
    $("mouse-mode").disabled = edit;
    $("character-select").disabled = edit || !saveKey;
    canvas.setAttribute("aria-label", edit ? "World editor. Click to paint. Use WASD or arrow keys to pan." : "World map. Use arrow keys or WASD to move.");
    canvas.focus({ preventScroll: true });
    needsRefresh = true;
  }

  function placeEditor(x, y) {
    editorCenter.x = Math.max(0, Math.min(map.width - 1, x));
    editorCenter.y = Math.max(0, Math.min(map.height - 1, y));
    hover = null;
    needsRefresh = true;
  }

  function addFloor() {
    if (map.floors.length >= 16) return setStatus("This world already has 16 floors.");
    const suggestion = Math.min(...map.floors.map(floor => floor.z)) - 1;
    const answer = prompt("Floor number (negative for underground)", String(suggestion));
    if (answer === null) return;
    const z = Number(answer);
    if (!/^-?\d+$/.test(answer.trim()) || Math.abs(z) > 99 || World.floorAt(map, z)) return setStatus("Choose an unused floor number from −99 to 99.");
    const name = prompt("Floor name", z < 0 ? "Underground" : "Upper floor")?.trim();
    if (!name) return;
    const before = snapshot();
    map.floors.push(World.makeFloor(map, z, name.slice(0, 60), "void"));
    editFloor = z;
    record(before);
    syncEditor();
  }

  function newWorld() {
    const name = prompt("Name for the new world", "Untitled world")?.trim();
    if (!name) return;
    const size = prompt("World dimensions in tiles, width × height", "50 x 36");
    if (size === null) return;
    const match = size.match(/^\s*(\d+)\s*[x×,]\s*(\d+)\s*$/i);
    const [width, height] = match ? match.slice(1).map(Number) : [];
    if (![width, height].every(value => Number.isInteger(value) && value >= 8 && value <= 128)) return setStatus("Enter a width and height between 8 and 128 tiles.");
    const before = snapshot();
    map = { version: 1, width, height, name: name.slice(0, 60), floors: [] };
    const floor = World.makeFloor(map, 0, "Surface", "grass");
    map.floors.push(floor);
    const x = Math.floor(width / 2);
    const y = Math.floor(height / 2);
    floor.markers[World.key(x, y)] = { type: "start" };
    editFloor = 0;
    placeEditor(x, y);
    record(before);
    syncEditor();
  }

  $("world-select").addEventListener("change", event => switchWorld(event.target.value));
  $("character-select").addEventListener("click", showCharacterScreen);
  $("close-characters").addEventListener("click", () => $("character-screen").close());
  $("new-character-vocation").addEventListener("change", event => {
    const vocation = Vocations.classes[event.target.value];
    $("new-character-details").textContent = vocation?.specialty ?? "";
  });
  $("new-character-form").addEventListener("submit", event => {
    event.preventDefault();
    createCharacter();
  });
  $("save-game").addEventListener("click", () => saveProgress(true));
  $("export-save").addEventListener("click", exportCharacter);
  $("import-save").addEventListener("click", () => $("character-file").click());
  $("character-file").addEventListener("change", importCharacter);
  window.addEventListener("pagehide", () => saveProgress(true));
  document.addEventListener("visibilitychange", () => {
    magicClock = null;
    if (document.hidden) saveProgress(true);
  });

  $("training-controls").addEventListener("click", event => {
    const skill = event.target.dataset.practice;
    if (edit || !skill || event.target.disabled) return;
    if (practice === skill) stopPractice();
    else {
      stopActions();
      practice = skill;
      nextPractice = performance.now() + Combat.swingInterval;
    }
    canvas.focus({ preventScroll: true });
  });
  $("vocation-select").addEventListener("change", updateVocationPreview);
  $("vocation-form").addEventListener("submit", event => {
    event.preventDefault();
    chooseVocation($("vocation-select").value);
  });
  $("spell-console").addEventListener("submit", event => {
    event.preventDefault();
    if (edit) return;
    const input = $("spell-words");
    const words = input.value.trim().toLowerCase().replace(/\s+/g, " ");
    if (!words) return;
    const id = Object.keys(Magic.spells).find(id => Magic.spells[id].words === words);
    if (id) castSpell(id);
    else journal("Those words are not in your spellbook.", "combat");
    input.value = "";
    canvas.focus({ preventScroll: true });
  });
  $("play").addEventListener("click", () => switchMode(false));
  $("edit").addEventListener("click", () => switchMode(true));
  $("floors").addEventListener("change", event => { editFloor = Number(event.target.value); needsRefresh = true; });
  $("new-floor").addEventListener("click", addFloor);
  $("new-world").addEventListener("click", newWorld);
  $("rename").addEventListener("click", () => {
    const floor = currentFloor();
    const name = prompt("Floor name", floor.name)?.trim();
    if (!name || name === floor.name) return;
    const before = snapshot();
    floor.name = name.slice(0, 60);
    record(before);
    syncEditor();
  });
  $("layers").addEventListener("click", event => {
    if (!event.target.dataset.layer) return;
    layer = event.target.dataset.layer;
    showPalette();
  });
  $("undo").addEventListener("click", () => restore(undo, redo));
  $("redo").addEventListener("click", () => restore(redo, undo));
  $("save").addEventListener("click", () => {
    try {
      const saved = World.validate(map);
      localStorage.setItem(Saves.mapKey, JSON.stringify(saved));
      worlds.custom = saved;
      worldRevisions.custom = Saves.revision(saved);
      selectedWorld = "custom";
      rememberWorld();
      syncWorldSelect();
      setStatus("World saved in this browser as a custom map.");
    } catch (error) {
      setStatus(`Save failed. ${error.message}`);
    }
  });
  $("export").addEventListener("click", () => {
    try {
      const filename = map.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "arda-world";
      downloadJson(World.validate(map), `${filename}.json`);
      setStatus("World exported.");
    } catch (error) {
      setStatus(error.message);
    }
  });
  $("import").addEventListener("click", () => $("file").click());
  $("file").addEventListener("change", async event => {
    const file = event.target.files[0];
    event.target.value = "";
    if (!file) return;
    try {
      if (file.size > 8_000_000) throw new Error("World files must be smaller than 8 MB.");
      const imported = World.validate(JSON.parse(await file.text()));
      if (!edit) return;
      const before = snapshot();
      map = imported;
      const start = World.findStart(map);
      editFloor = start.z;
      placeEditor(start.x, start.y);
      record(before);
      syncEditor();
      setStatus("World imported. Save it to keep it in this browser.");
    } catch (error) {
      setStatus(`Import failed. ${error.message}`);
    }
  });

  canvas.addEventListener("contextmenu", showTileMenu);
  document.addEventListener("pointerdown", event => {
    if (!tileMenu.contains(event.target)) closeTileMenu();
  });
  canvas.addEventListener("pointerdown", event => {
    if (event.button !== 0 || gesture) return;
    canvas.focus({ preventScroll: true });
    if (!edit) {
      clickWorld(event);
      return;
    }
    const pos = pointerPos(event);
    canvas.setPointerCapture(event.pointerId);
    gesture = { pointerId: event.pointerId, before: snapshot(), changed: false, last: pos };
    paint(pos);
    if (layer === "markers") finishPaint();
  });
  canvas.addEventListener("pointermove", event => {
    hover = pointerPos(event);
    if (edit && gesture?.pointerId === event.pointerId) {
      paintLine(gesture.last, hover);
      gesture.last = hover;
    }
    if (edit) labelUpdate();
  });
  canvas.addEventListener("pointerleave", () => { hover = null; if (edit) labelUpdate(); });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
    canvas.addEventListener(type, event => { if (gesture?.pointerId === event.pointerId) finishPaint(); });
  }

  minimap.addEventListener("click", event => {
    if (!edit && previewFloor !== null && previewFloor !== player.z) return;
    const { scale, ox, oy } = drawMinimap();
    const box = minimap.getBoundingClientRect();
    const left = box.left + minimap.clientLeft;
    const top = box.top + minimap.clientTop;
    const x = Math.floor(((event.clientX - left) * minimap.width / minimap.clientWidth - ox) / scale);
    const y = Math.floor(((event.clientY - top) * minimap.height / minimap.clientHeight - oy) / scale);
    if (!World.inside(map, x, y)) return;
    if (edit) placeEditor(x, y);
    else {
      stopActions();
      walkTo({ x, y });
      if (!path.length && (player.x !== x || player.y !== y)) journal("There is no clear path to that spot.");
    }
    canvas.focus({ preventScroll: true });
  });

  for (const [id, direction] of [["map-up", 1], ["map-down", -1]]) {
    $(id).addEventListener("click", () => {
      const z = previewFloor ?? currentFloor().z;
      const floors = map.floors.filter(floor => (floor.z - z) * direction > 0)
        .sort((a, b) => (a.z - b.z) * direction);
      if (!floors.length) return;
      if (edit) {
        editFloor = floors[0].z;
        $("floors").value = editFloor;
        needsRefresh = true;
      } else previewFloor = floors[0].z;
      drawMinimap();
    });
  }
  for (const [id, factor] of [["map-zoom-in", 2], ["map-zoom-out", .5]]) {
    $(id).addEventListener("click", () => {
      minimapZoom = Math.max(1, Math.min(4, minimapZoom * factor));
      drawMinimap();
    });
  }
  $("map-center").addEventListener("click", () => {
    previewFloor = null;
    minimapZoom = 1;
    drawMinimap();
  });

  function changeGameZoom(direction) {
    gameZoom = Math.min(2.5, Math.max(.75, gameZoom + direction * .25));
    $("view-zoom-in").disabled = gameZoom === 2.5;
    $("view-zoom-out").disabled = gameZoom === .75;
    resize();
    canvas.focus({ preventScroll: true });
  }

  $("view-zoom-in").addEventListener("click", () => changeGameZoom(1));
  $("view-zoom-out").addEventListener("click", () => changeGameZoom(-1));
  $("stop-button").addEventListener("click", stopActions);

  for (const [id, key] of [["stances", "stance"], ["pursuit", "pursuit"]]) {
    $(id).addEventListener("click", event => {
      const choice = event.target.dataset[key];
      if (!choice) return;
      player[key] = choice;
      nextChase = 0;
      needsRefresh = true;
    });
  }

  for (const id of ["equipment-slots", "slots"]) {
    const container = $(id);
    for (const type of ["dragover", "drop"]) {
      container.addEventListener(type, event => {
        const target = id === "slots" ? container : event.target.closest("[data-slot]");
        if (target) inventoryDrop(event, target);
      });
    }
    container.addEventListener("dragleave", event => {
      const target = id === "slots" ? container : event.target.closest("[data-slot]");
      if (target && !target.contains(event.relatedTarget)) target.classList.remove("drop-ready");
    });
  }

  for (const actionBar of [$("action-bar"), $("action-bar-right")]) {
    for (const type of ["dragover", "drop"]) {
      actionBar.addEventListener(type, event => {
        const button = event.target.closest("[data-action-index]");
        if (!button || !draggedItem || draggedItem.origin === "loot" || !Saves.validAction(draggedItem.id)) return;
        event.preventDefault();
        if (type === "dragover") {
          event.dataTransfer.dropEffect = "copy";
          button.classList.add("drop-ready");
        } else {
          const id = draggedItem.id;
          clearInventoryDrag();
          setAction(Number(button.dataset.actionIndex), id);
        }
      });
    }
    actionBar.addEventListener("dragleave", event => {
      const button = event.target.closest("[data-action-index]");
      if (button && !button.contains(event.relatedTarget)) button.classList.remove("drop-ready");
    });
  }
  $("close-loot").addEventListener("click", closeLoot);
  $("close-merchant").addEventListener("click", closeMerchant);
  for (const button of $("merchant-panel").querySelectorAll("[data-shop]")) {
    button.addEventListener("click", () => {
      shopMode = button.dataset.shop;
      updateMerchant();
    });
  }
  $("take-all").addEventListener("click", () => takeLoot());

  function updateMouseHint() {
    $("mouse-mode").value = mouseMode;
    $("mouse-hint").textContent = mouseMode === "classic"
      ? "Right-click to use or attack · Ctrl + right-click for menu · Shift-click to look"
      : "Click to walk or interact · Right-click for menu · Shift-click to look";
  }

  $("mouse-mode").addEventListener("change", event => {
    mouseMode = event.target.value;
    try { localStorage.setItem("arda.mouse.v1", mouseMode); } catch {
      // Controls can still be changed for this tab.
    }
    updateMouseHint();
    canvas.focus({ preventScroll: true });
  });

  $("console-tabs").addEventListener("click", event => {
    const channel = event.target.dataset.channel;
    if (!channel) return;
    consoleChannel = channel;
    for (const button of $("console-tabs").children) {
      button.setAttribute("aria-pressed", String(button.dataset.channel === channel));
    }
    const list = $("journal");
    for (const entry of list.children) entry.hidden = channel !== "all" && entry.dataset.channel !== channel;
    list.scrollTop = list.scrollHeight;
  });

  window.addEventListener("keydown", event => {
    if ($("character-screen").open || event.target.matches("input, select, textarea") || event.altKey) return;
    const key = event.key.toLowerCase();
    if (edit && (event.metaKey || event.ctrlKey) && key === "z") {
      event.preventDefault();
      if (event.shiftKey) restore(redo, undo);
      else restore(undo, redo);
      return;
    }
    if (event.metaKey || event.ctrlKey) {
      if (!edit && key === "b") {
        event.preventDefault();
        $("battle-panel").hidden = !$("battle-panel").hidden;
      } else if (!edit && ["=", "+", "-"].includes(key)) {
        event.preventDefault();
        changeGameZoom(key === "-" ? -1 : 1);
      }
      return;
    }
    const direction = numpad[event.code] ?? movement[key];
    if (direction) {
      event.preventDefault();
      if (edit) placeEditor(editorCenter.x + direction[0], editorCenter.y + direction[1]);
      else held.set(event.code, direction);
      return;
    }
    if (edit) return;
    const hotkey = /^f([1-9]|1[0-2])$/.exec(key);
    if (hotkey) {
      event.preventDefault();
      if (!event.repeat) runAction(actions[Number(hotkey[1]) - 1]);
      return;
    }
    if (event.repeat) return;
    if (key === "enter" && event.target === canvas) {
      event.preventDefault();
      $("spell-words").focus();
      return;
    }
    if (key === "e") interact();
    if (key === "1") attackKey();
    if (key === "2") heal();
    if (key === "escape") stopActions();
  });
  window.addEventListener("keyup", event => held.delete(event.code));
  window.addEventListener("blur", () => held.clear());
  document.addEventListener("visibilitychange", () => held.clear());
  new ResizeObserver(resize).observe(canvas);

  function frame(now) {
    if (!edit && !document.hidden && !$("character-screen").open) {
      updateGame(now);
      if (needsRefresh || Math.floor((now - hunt.start) / 1000) !== huntSecond) updateHunt(now);
      if (needsRefresh) savePending = true;
      if (savePending && now >= saveAfter) saveProgress();
    }
    if (needsRefresh) updateSidebar();
    render(now);
    requestAnimationFrame(frame);
  }

  syncWorldSelect();
  updateMouseHint();
  $("vocation-select").append(new Option("Select vocation…", "", true, true));
  for (const [id, vocation] of Object.entries(Vocations.classes)) {
    $("vocation-select").append(new Option(vocation.name, id));
    $("new-character-vocation").append(new Option(vocation.name, id));
  }
  updateVocationPreview();
  buildSpellbook();
  const initial = resumePlay();
  resize();
  if (loadMessage) journal(loadMessage);
  announcePlay(initial);
  Art.ready.then(() => requestAnimationFrame(frame)).catch(() => {
    journal("The OpenTibia sprite pack could not be loaded.");
  });
  if (location.protocol !== "file:" && "serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(error => console.warn("Offline cache unavailable", error));
  }
})();
