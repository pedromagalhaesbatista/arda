"use strict";

const Saves = (() => {
  const mapKey = "arda.world.v1";
  const selectionKey = "arda.world.selected";
  const progressPrefix = "arda.character.v1.";
  const integer = (value, min, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && value >= min && value <= max;
  const record = value => value && typeof value === "object" && !Array.isArray(value);

  function revision(map) {
    const text = JSON.stringify(map, (_, value) => {
      if (!record(value)) return value;
      return Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]]));
    });
    let hash = 0xcbf29ce484222325n;
    for (let i = 0; i < text.length; i++) {
      hash = BigInt.asUintN(64, (hash ^ BigInt(text.charCodeAt(i))) * 0x100000001b3n);
    }
    return hash.toString(16);
  }

  const progressKey = (world, revision) => `${progressPrefix}${world}.${revision}`;
  const actorKey = actor => `${actor.z}:${actor.origin.x},${actor.origin.y}:${actor.type}`;

  function position(map, point) {
    if (!record(point) || !integer(point.x, 0, map.width - 1) || !integer(point.y, 0, map.height - 1)) return false;
    const floor = World.floorAt(map, point.z);
    return !!floor && World.passable(map, floor, point.x, point.y);
  }

  function kitValid(kit) {
    return record(kit) && record(kit.worn) && record(kit.bag) && kit.worn.pack === "pack" &&
      Object.entries(kit.worn).every(([slot, id]) => Object.hasOwn(Equipment.slots, slot) && Object.hasOwn(Equipment.items, id) && Equipment.items[id].slot === slot) &&
      Object.entries(kit.bag).every(([id, count]) => id !== "pack" && Object.hasOwn(Equipment.items, id) && integer(count, 1));
  }

  function skillValid(skill, minimum = 10) {
    return record(skill) && integer(skill.level, minimum) && integer(skill.goal, 1) &&
      Number.isFinite(skill.tries) && Number.isInteger(skill.tries * 4) && skill.tries >= 0 && skill.tries < skill.goal;
  }

  function magicValid(player) {
    const { mana, magic, spellState, vocation } = player;
    if (!vocation && !["mana", "magic", "spellState"].some(field => Object.hasOwn(player, field))) return true;
    if (!integer(mana, 0, Vocations.maxMana(player.level, vocation)) || !skillValid(magic, 0) || !record(spellState) ||
        !integer(spellState.light, 0, Magic.lightDuration) || !integer(spellState.regen, 0, Vocations.get(vocation).regen - 1) ||
        !record(spellState.cooldowns)) return false;
    return Object.entries(spellState.cooldowns).every(([id, time]) => {
      const limit = Object.hasOwn(Magic.spells, id) ? Magic.spells[id].cooldown :
        Object.hasOwn(Magic.groups, id) ? Magic.groups[id] : 0;
      return integer(time, 1, limit);
    });
  }

  function valid(value, map, entities) {
    if (!record(value) || value.version !== 1 || !record(value.player)) return false;
    const { player, quest, ratsDefeated, hasLedger, creatures, loot } = value;
    if (player.vocation != null && (typeof player.vocation !== "string" || !Object.hasOwn(Vocations.classes, player.vocation) ||
        !skillValid(player.fist) || !skillValid(player.distance))) return false;
    if (["fist", "distance"].some(skill => Object.hasOwn(player, skill) && !skillValid(player[skill]))) return false;
    if (!position(map, player) || !integer(player.level, 1) || !integer(player.maxHp, 30) ||
        !integer(player.hp, 1, player.maxHp) || !integer(player.xp, 0, player.level * 18 - 1) ||
        !integer(player.face, 0, 3) || !["offensive", "balanced", "defensive"].includes(player.stance) ||
        !["stand", "chase"].includes(player.pursuit) || !kitValid(player.kit) ||
        !skillValid(player.sword) || !skillValid(player.shielding) || !magicValid(player)) return false;
    if (!["available", "active", "complete"].includes(quest) || !integer(ratsDefeated, 0) || typeof hasLedger !== "boolean") return false;
    if (!record(creatures) || Object.keys(creatures).length !== entities.length) return false;
    for (const entity of entities) {
      const saved = creatures[actorKey(entity)];
      if (!position(map, saved) || saved.z !== entity.z || !integer(saved.hp, 0, entity.maxHp) || !integer(saved.face, 0, 3)) return false;
    }
    return Array.isArray(loot) && loot.every(pile => position(map, pile) && integer(pile.coins, 0) &&
      (pile.kind === undefined || ["rat", "wolf"].includes(pile.kind)) &&
      Array.isArray(pile.items) && (pile.coins > 0 || pile.items.length > 0) &&
      pile.items.every(id => id !== "pack" && id !== "coin" && Object.hasOwn(Equipment.items, id)));
  }

  function relocate(value, map, entities) {
    if (!record(value) || !record(value.creatures) || !Array.isArray(value.loot)) {
      throw new Error("Saved character data is unreadable.");
    }
    const occupied = new Set();
    const pointKey = (x, y, z) => `${z}:${World.key(x, y)}`;
    for (const entity of entities) {
      if (!Object.hasOwn(value.creatures, actorKey(entity))) occupied.add(pointKey(entity.x, entity.y, entity.z));
    }

    function nearest(point, avoidActors) {
      if (!record(point) || !integer(point.x, 0, map.width - 1) || !integer(point.y, 0, map.height - 1)) {
        throw new Error("Saved position is unreadable.");
      }
      const floor = World.floorAt(map, point.z);
      if (!floor) throw new Error("The saved floor is missing.");
      const open = (x, y) => World.passable(map, floor, x, y) &&
        (!avoidActors || !occupied.has(pointKey(x, y, point.z)));
      if (open(point.x, point.y)) return point;
      let best = null;
      let distance = Infinity;
      for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
          const steps = Math.abs(point.x - x) + Math.abs(point.y - y);
          if (steps >= distance || !open(x, y) || floor.markers[World.key(x, y)]?.type === "link") continue;
          best = { ...point, x, y };
          distance = steps;
        }
      }
      if (!best) throw new Error("The saved floor has no walkable tile.");
      return best;
    }

    const creatures = Object.create(null);
    for (const [id, point] of Object.entries(value.creatures)) {
      const moved = nearest(point, point?.hp > 0);
      creatures[id] = moved;
      if (moved.hp > 0) occupied.add(pointKey(moved.x, moved.y, moved.z));
    }
    return { ...value, creatures, player: nearest(value.player, true), loot: value.loot.map(point => nearest(point, false)) };
  }

  function read(key, map, entities, adapt = value => value) {
    const raw = localStorage.getItem(key);
    if (raw === null) return { raw, value: null };
    const value = adapt(JSON.parse(raw));
    if (!valid(value, map, entities)) throw new Error("Saved character data is unreadable.");
    return { raw, value };
  }

  function write(key, value, expected) {
    if (localStorage.getItem(key) !== expected) throw new Error("This save changed in another tab. Reload to continue from it.");
    const raw = JSON.stringify(value);
    if (raw !== expected) localStorage.setItem(key, raw);
    return raw;
  }

  return { mapKey, selectionKey, revision, progressKey, actorKey, valid, relocate, read, write };
})();
