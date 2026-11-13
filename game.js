"use strict";

(() => {
  const $ = id => document.getElementById(id);
  const canvas = $("world");
  const c = canvas.getContext("2d");
  const minimap = $("minimap");
  const mini = minimap.getContext("2d");
  const tile = Art.size;

  const creatureNames = { rat: "Cellar rat", wolf: "Wolf" };
  const markerActions = { keeper: "Talk", miller: "Talk", gardener: "Talk", ledger: "Take", notice: "Read" };
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
  let playRevision = null;
  let saveKey = null;
  let saveRaw = null;
  let saveBlocked = false;
  let savePending = false;
  let saveAfter = 0;
  let landmarkFloor = null;

  let player;
  let entities = [];
  let loot = [];
  let openLoot = null;
  let nextHeal = 0;
  let consoleChannel = "all";
  let minimapZoom = 1;
  let gameZoom = 1;
  let previewFloor = null;
  let hunt;
  let huntSecond = -1;
  let mouseMode = "context";
  let actions = ["attack", "herb", "use", "stop", null, null, null, null, null, null, null, null];
  try {
    if (localStorage.getItem("arda.mouse.v1") === "classic") mouseMode = "classic";
    const savedActions = JSON.parse(localStorage.getItem("arda.actions.v1"));
    if (Array.isArray(savedActions) && [8, 12].includes(savedActions.length) && savedActions.every(validAction)) {
      actions.splice(0, savedActions.length, ...savedActions);
    }
  } catch {
    // Browser settings are optional.
  }
  let combatText = [];
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

  function resetPlay() {
    const start = World.findStart(map);
    player = {
      ...start, hp: 30, maxHp: 30, xp: 0, level: 1, face: OpenTibia.Direction.South,
      kit: Equipment.starterKit(), stance: "balanced", pursuit: "stand",
      sword: { level: 10, tries: 0, goal: 8 }, shielding: { level: 10, tries: 0, goal: 8 },
    };
    inventoryDirty = true;
    hunt = { start: performance.now(), xp: 0, coins: 0, dealt: 0, received: 0, healing: 0 };
    huntSecond = -1;
    previewFloor = null;
    draggedItem = null;
    combatText = [];
    $("backpack-panel").hidden = false;
    entities = [];
    for (const floor of map.floors) {
      for (const [key, marker] of Object.entries(floor.markers)) {
        if (!["keeper", "gardener", "miller", "wolf", "rat"].includes(marker.type)) continue;
        const [x, y] = key.split(",").map(Number);
        const hp = marker.type === "wolf" ? 16 : 8;
        entities.push({ x, y, z: floor.z, origin: { x, y }, type: marker.type, hp, maxHp: hp, face: OpenTibia.Direction.South, nextMove: 0, nextHit: 0 });
      }
    }
    loot = [];
    closeLoot();
    nextHeal = 0;
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

  function characterSnapshot() {
    const floor = currentFloor();
    const steppingIntoLink = player.motion && floor.markers[World.key(player.x, player.y)]?.type === "link";
    const position = steppingIntoLink ? player.motion.from : player;
    const { z, hp, maxHp, xp, level, face, kit, stance, pursuit, sword, shielding } = player;
    const creatures = Object.fromEntries(entities.filter(entity => creatureNames[entity.type]).map(entity => {
      const { x, y, z, hp, face } = entity;
      return [Saves.actorKey(entity), { x, y, z, hp, face }];
    }));
    return {
      version: 1, player: { x: position.x, y: position.y, z, hp, maxHp, xp, level, face, kit, stance, pursuit, sword, shielding },
      quest, ratsDefeated, hasLedger, creatures, loot,
    };
  }

  function saveProgress(force = false) {
    if (edit || !saveKey || saveBlocked || (!force && !savePending && !needsRefresh)) return;
    try {
      saveRaw = Saves.write(saveKey, characterSnapshot(), saveRaw);
      savePending = false;
      saveAfter = performance.now() + 180;
      saveStatus("Saved on this device");
    } catch (error) {
      saveBlocked = true;
      $("save-game").disabled = true;
      saveStatus(error.name === "QuotaExceededError" ? "Browser storage is full." : error.message);
    }
  }

  function resumePlay() {
    const revision = Saves.revision(map);
    const key = revision === worldRevisions[selectedWorld] ? Saves.progressKey(selectedWorld, revision) : null;
    if (playRevision === revision && saveKey === key) return "continued";
    const keepPlaytest = playRevision === revision && !saveKey && key;
    if (!keepPlaytest) resetPlay();
    playRevision = revision;
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
      if (!data && selectedWorld === "shire") {
        const priorKey = Saves.progressKey("shire", Shire.previousRevision);
        data = Saves.read(priorKey, map, hostiles, value => Saves.relocate(value, map, entities)).value;
      }
      saveStatus(result.value ? "Saved on this device" : "Autosave on");
      if (!data) return keepPlaytest ? "continued" : "new";
      for (const field of Object.keys(player)) {
        if (Object.hasOwn(data.player, field)) player[field] = data.player[field];
      }
      const readyAt = performance.now() + Combat.swingInterval;
      for (const entity of entities) {
        if (!creatureNames[entity.type]) continue;
        const { x, y, hp, face } = data.creatures[Saves.actorKey(entity)];
        Object.assign(entity, { x, y, hp, face, nextHit: readyAt });
      }
      ({ quest, ratsDefeated, hasLedger, loot } = data);
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
    downloadJson({ format: "arda-save", version: 1, revision: playRevision, mapName: map.name,
      progress: characterSnapshot() }, `arda-${selectedWorld}-save.json`);
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
      const previousShire = selectedWorld === "shire" && data.revision === Shire.previousRevision;
      if (data.revision !== playRevision && !previousShire) throw new Error("Open the matching map before importing this save.");
      const progress = previousShire ? Saves.relocate(data.progress, map, entities) : data.progress;
      if (!Saves.valid(progress, map, entities.filter(entity => creatureNames[entity.type]))) {
        throw new Error("The character save is unreadable.");
      }
      const current = localStorage.getItem(key);
      if (current !== null && !confirm("Replace the character and quest progress for this map with the imported save?")) return;
      Saves.write(key, progress, current);
      playRevision = null;
      announcePlay(resumePlay());
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

  function switchWorld(id) {
    if (!Object.hasOwn(worlds, id) || id === selectedWorld) return;
    finishPaint();
    if (Saves.revision(map) !== worldRevisions[selectedWorld] &&
        !confirm("Switch worlds and discard the unsaved map edits?")) {
      $("world-select").value = selectedWorld;
      return;
    }
    saveProgress();
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
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const ground = floor.ground[World.index(map, x, y)];
        const object = floor.objects[World.key(x, y)];
        mini.fillStyle = Art.mapColors[object] ?? Art.mapColors[ground];
        mini.fillRect(ox + x * scale, oy + y * scale, scale, scale);
      }
    }
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
      list.append(button);
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
      return { type, name, count: population.filter(entity => entity.hp === 0).length, total: population.length };
    }).filter(entry => entry.total > 0);
    const signature = JSON.stringify(entries);
    if (tracker.dataset.counts === signature) return;
    tracker.dataset.counts = signature;
    tracker.replaceChildren();
    for (const { type, name, count, total } of entries) {
      const row = document.createElement("li");
      const label = document.createElement("span");
      const progress = document.createElement("span");
      label.textContent = name;
      progress.textContent = `${count}/${total}`;
      progress.title = "Defeated in this world";
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
    $("level").textContent = `Level ${player.level}`;
    $("health-value").textContent = `${player.hp} / ${player.maxHp}`;
    $("health-fill").style.width = `${player.hp / player.maxHp * 100}%`;
    $("xp-value").textContent = `${player.xp} / ${goal}`;
    $("xp-fill").style.width = `${player.xp / goal * 100}%`;
    for (const [id, value, max] of [["rail-health", player.hp, player.maxHp], ["rail-xp", player.xp, goal]]) {
      const meter = $(id);
      meter.style.setProperty("--fill", `${value / max * 100}%`);
      meter.setAttribute("aria-valuemax", max);
      meter.setAttribute("aria-valuenow", value);
      meter.lastElementChild.textContent = `${value}/${max}`;
    }
    updateBestiary();
    $("skill").textContent = player.sword.level;
    $("shield-skill").textContent = player.shielding.level;
    for (const [id, skill] of [["sword-progress", player.sword], ["shield-progress", player.shielding]]) {
      $(id).max = skill.goal;
      $(id).value = skill.tries;
    }
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

  function inventoryChanged() {
    inventoryDirty = needsRefresh = true;
  }

  function equipItem(id) {
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
    } else if (id === "herb") {
      label = "Use healing herb";
      use = heal;
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

    if (id !== "pack" && (origin === "loot" || Equipment.items[id].slot || id === "herb")) {
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
    $("gear-attack").textContent = gear.attack;
    $("gear-defense").textContent = gear.defense;
    $("gear-armor").textContent = gear.armor;
    const coins = bag.coin ?? 0;
    $("coins").textContent = `${coins} ${coins === 1 ? "coin" : "coins"}`;

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
            if (entity.type === "miller" || entity.type === "gardener") {
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
      const light = c.createRadialGradient(canvas.width / 2, canvas.height / 2, tile * 2, canvas.width / 2, canvas.height / 2, tile * 10);
      light.addColorStop(0, "rgba(25,22,18,0)");
      light.addColorStop(1, "rgba(15,15,17,.78)");
      c.fillStyle = light;
      c.fillRect(0, 0, canvas.width, canvas.height);
    }
    if (combatText.length) combatText = combatText.filter(label => now - label.start < 880);
    if (!edit) {
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
    const interval = OpenTibia.WALK_DURATION_MS * (dx && dy ? 1.5 : 1);
    moveActor(player, x, y, now, interval - 15);
    if (openLoot && distance(player, openLoot) > 1) closeLoot();
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
      previewFloor = null;
      Object.assign(player, { x: marker.x, y: marker.y, z: marker.z, motion: null });
      path = [];
      target = null;
      journal(`Entered ${destination.name}.`);
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
    if (useAt(player.x, player.y)) return;
    const offsets = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]];
    for (const [dx, dy] of offsets) if (useAt(player.x + dx, player.y + dy)) return;
    journal("Move beside a person, passage, or item to interact.");
  }

  function lootAt(x, y) {
    return loot.find(pile => pile.z === player.z && pile.x === x && pile.y === y);
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
    target = null;
    path = [];
    pendingInteraction = null;
    held.clear();
    needsRefresh = true;
  }

  function validAction(id) {
    return id === null || ["attack", "use", "stop"].includes(id) ||
      (Object.hasOwn(Equipment.items, id) && id !== "pack" && id !== "coin");
  }

  function setAction(index, id) {
    if (!validAction(id)) return;
    actions[index] = id;
    try { localStorage.setItem("arda.actions.v1", JSON.stringify(actions)); } catch {
      // Hotkeys can still be used in this tab.
    }
    updateActions();
  }

  function runAction(id) {
    if (id === "attack") attackKey();
    else if (id === "use") interact();
    else if (id === "stop") stopActions();
    else if (id === "herb") heal();
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
      const label = ({ attack: "Attack", use: "Use nearby", stop: "Stop", herb: "Use healing herb" })[id] ??
        (id ? Equipment.items[id].name : "Empty");
      button.dataset.actionIndex = index;
      button.title = id ? `${label} (${hotkey})` : `${hotkey} · Drag an item here`;
      button.setAttribute("aria-label", `${hotkey} ${label}`);
      const key = document.createElement("kbd");
      key.textContent = hotkey;
      button.append(key);
      if (id && !["use", "stop"].includes(id)) {
        button.append(thumbnail(context => Art.icon(context, id === "attack" ? "sword" : id)));
      } else {
        const icon = document.createElement("span");
        icon.className = id === "stop" ? "stop-icon" : "empty-action";
        icon.textContent = id === "stop" ? "■" : id === "use" ? "↵" : "·";
        icon.setAttribute("aria-hidden", "true");
        button.append(icon);
      }
      if (id === "herb") {
        const count = document.createElement("small");
        count.textContent = player.kit.bag.herb ?? 0;
        button.append(count);
      }
      button.addEventListener("click", () => {
        runAction(id);
        canvas.focus({ preventScroll: true });
      });
      button.addEventListener("contextmenu", event => {
        event.preventDefault();
        const presets = [["Attack", "attack"], ["Use healing herb", "herb"], ["Use nearby", "use"], ["Stop", "stop"], ["Clear slot", null]];
        showMenu(event, presets.map(([name, action]) => [name, () => setAction(index, action)]));
      });
      (index < 6 ? left : right).append(button);
      if (String(index) === focused) button.focus({ preventScroll: true });
    });
  }

  function showCombatText(actor, text, color, now) {
    combatText.push({ x: actor.x, y: actor.y, z: actor.z, text, color, start: now });
  }

  function canStrike(actor, defender) {
    return distance(actor, defender) <= 1 &&
      World.canStep(map, currentFloor(), actor.x, actor.y, defender.x, defender.y, () => false);
  }

  function hit(now) {
    if (!target || now < nextAttack || !canStrike(player, target)) return;
    nextAttack = now + Combat.swingInterval;
    player.face = OpenTibia.directionFromStepDelta(target.x - player.x, target.y - player.y, player.face);
    const damage = Math.min(target.hp, Combat.attack(player));
    if (player.kit.worn.weapon && damage > 0 && Combat.train(player.sword)) {
      journal(`You advanced to sword fighting level ${player.sword.level}.`);
    }
    const name = creatureNames[target.type];
    target.hp -= damage;
    hunt.dealt += damage;
    showCombatText(target, damage || "Miss", damage ? "#ff8e70" : "#f3d9a7", now);
    journal(damage ? `You hit the ${name.toLowerCase()} for ${damage}.` : `You miss the ${name.toLowerCase()}.`, "combat");
    if (target.hp === 0) {
      if (target.type === "rat") ratsDefeated++;
      const xp = target.type === "rat" ? 9 : 14;
      const item = target.type === "wolf" ? (Combat.roll(0, 1) ? "pendant" : "ring") : null;
      const pile = loot.find(entry => entry.x === target.x && entry.y === target.y && entry.z === target.z);
      if (pile) {
        pile.coins += target.type === "rat" ? 1 : 3;
        if (item) pile.items.push(item);
        if (pile === openLoot) openContainer(pile);
      } else {
        loot.push({ x: target.x, y: target.y, z: target.z, kind: target.type, coins: target.type === "rat" ? 1 : 3, items: item ? [item] : [] });
      }
      journal(`${name} defeated. You gain ${xp} experience.`, "combat");
      player.xp += xp;
      hunt.xp += xp;
      if (player.xp >= player.level * 18) {
        player.xp -= player.level * 18;
        player.level++;
        player.maxHp += 5;
        player.hp = player.maxHp;
        journal(`You reached level ${player.level}.`);
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

  function enemies(now) {
    const floor = currentFloor();
    for (const entity of entities) {
      if (!creatureNames[entity.type] || entity.z !== player.z || entity.hp <= 0) continue;
      const range = distance(player, entity);
      const inReach = canStrike(entity, player);
      if (inReach && now >= entity.nextHit) {
        entity.nextHit = now + Combat.swingInterval;
        const incoming = Combat.roll(1, entity.type === "rat" ? 7 : 13);
        const result = Combat.mitigate(player, incoming, now < nextAttack);
        const damage = Math.min(player.hp, result.damage);
        player.hp -= damage;
        hunt.received += damage;
        const name = creatureNames[entity.type].toLowerCase();
        if (result.blocked && player.kit.worn.shield && Combat.train(player.shielding)) {
          journal(`You advanced to shielding level ${player.shielding.level}.`);
        }
        showCombatText(player, damage || "Block", damage ? "#ff887b" : "#e3d0a1", now);
        if (damage) journal(`The ${name} hits you for ${damage}.`, "combat");
        else if (result.blocked) journal(`You block the ${name}'s attack.`, "combat");
        else journal(`Your armor absorbs the ${name}'s attack.`, "combat");
        needsRefresh = true;
        if (player.hp === 0) {
          const start = World.findStart(map);
          closeLoot();
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
      } else if (target && player.pursuit === "chase" && now >= nextChase && !canStrike(player, target)) {
        nextChase = now + 260;
        const next = adjacentRoute(target, currentFloor(), (x, y) => Boolean(here(x, y)), true)[0];
        if (next) stepPlayer(next.x - player.x, next.y - player.y, now);
      }
    }
    hit(now);
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
      saveProgress();
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
    if (!edit) {
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
  $("save-game").addEventListener("click", () => saveProgress(true));
  $("export-save").addEventListener("click", exportCharacter);
  $("import-save").addEventListener("click", () => $("character-file").click());
  $("character-file").addEventListener("change", importCharacter);
  window.addEventListener("pagehide", () => saveProgress());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") saveProgress();
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
        if (!button || !draggedItem || draggedItem.origin === "loot" || !validAction(draggedItem.id)) return;
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
    if (event.target.matches("input, select, textarea") || event.altKey) return;
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
    if (!edit) {
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
