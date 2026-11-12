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

  function skillValid(skill) {
    return record(skill) && integer(skill.level, 10) && integer(skill.goal, 1) && integer(skill.tries, 0, skill.goal - 1);
  }

  function valid(value, map, entities) {
    if (!record(value) || value.version !== 1 || !record(value.player)) return false;
    const { player, quest, ratsDefeated, hasLedger, creatures, loot } = value;
    if (!position(map, player) || !integer(player.level, 1) || !integer(player.maxHp, 30) ||
        !integer(player.hp, 1, player.maxHp) || !integer(player.xp, 0, player.level * 18 - 1) ||
        !integer(player.face, 0, 3) || !["offensive", "balanced", "defensive"].includes(player.stance) ||
        !["stand", "chase"].includes(player.pursuit) || !kitValid(player.kit) ||
        !skillValid(player.sword) || !skillValid(player.shielding)) return false;
    if (!["available", "active", "complete"].includes(quest) || !integer(ratsDefeated, 0) || typeof hasLedger !== "boolean") return false;
    if (!record(creatures) || Object.keys(creatures).length !== entities.length) return false;
    for (const entity of entities) {
      const saved = creatures[actorKey(entity)];
      if (!position(map, saved) || saved.z !== entity.z || !integer(saved.hp, 0, entity.maxHp) || !integer(saved.face, 0, 3)) return false;
    }
    return Array.isArray(loot) && loot.every(pile => position(map, pile) && integer(pile.coins, 1) &&
      Array.isArray(pile.items) && pile.items.every(id => id !== "pack" && Object.hasOwn(Equipment.items, id)));
  }

  function read(key, map, entities) {
    const raw = localStorage.getItem(key);
    if (raw === null) return { raw, value: null };
    const value = JSON.parse(raw);
    if (!valid(value, map, entities)) throw new Error("Saved character data is unreadable.");
    return { raw, value };
  }

  function write(key, value, expected) {
    if (localStorage.getItem(key) !== expected) throw new Error("This save changed in another tab. Reload to continue from it.");
    const raw = JSON.stringify(value);
    if (raw !== expected) localStorage.setItem(key, raw);
    return raw;
  }

  return { mapKey, selectionKey, revision, progressKey, actorKey, valid, read, write };
})();
