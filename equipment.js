"use strict";

const Equipment = (() => {
  const slots = {
    amulet: "Amulet", head: "Head", pack: "Backpack",
    weapon: "Weapon", body: "Armor", shield: "Shield",
    ring: "Ring", legs: "Legs", feet: "Feet",
  };

  const items = {
    pack: { name: "Leather backpack", slot: "pack" },
    cap: { name: "Leather cap", slot: "head", armor: 1 },
    tunic: { name: "Traveller’s tunic", slot: "body", armor: 2 },
    trousers: { name: "Leather trousers", slot: "legs", armor: 2 },
    boots: { name: "Leather boots", slot: "feet", armor: 1 },
    sword: { name: "Iron sword", slot: "weapon", attack: 10, defense: 4 },
    broadsword: { name: "Bree broadsword", slot: "weapon", attack: 17, defense: 6 },
    buckler: { name: "Wooden buckler", slot: "shield", defense: 9 },
    pendant: { name: "Ranger’s pendant", slot: "amulet", armor: 1 },
    ring: { name: "Iron ring", slot: "ring", armor: 1 },
    shireRing: { name: "Bywater brass ring", slot: "ring", armor: 2 },
    herb: { name: "Healing herb", healing: 12 },
    coin: { name: "Coin" },
  };

  function starterKit() {
    return {
      worn: { pack: "pack", head: "cap", body: "tunic", weapon: "sword", feet: "boots" },
      bag: { buckler: 1, trousers: 1, herb: 3 },
    };
  }

  function add(kit, id, count = 1) {
    const total = (kit.bag[id] ?? 0) + count;
    if (total > 0) kit.bag[id] = total;
    else delete kit.bag[id];
  }

  function equip(kit, id) {
    const slot = items[id]?.slot;
    if (!slot || slot === "pack" || !kit.bag[id] || kit.worn[slot] === id) return false;
    if (kit.worn[slot]) add(kit, kit.worn[slot]);
    kit.worn[slot] = id;
    add(kit, id, -1);
    return true;
  }

  function stow(kit, slot) {
    const id = kit.worn[slot];
    if (!id || slot === "pack") return false;
    add(kit, id);
    delete kit.worn[slot];
    return true;
  }

  function description(id) {
    const item = items[id];
    const parts = [item.name];
    if (item.slot && item.slot !== "pack") parts.push(slots[item.slot]);
    if (item.attack) parts.push(`Attack ${item.attack}`);
    if (item.defense) parts.push(`Defense ${item.defense}`);
    if (item.armor) parts.push(`Armor ${item.armor}`);
    if (item.healing) parts.push(`Restores up to ${item.healing} health`);
    return parts.join(" · ");
  }

  function stats(kit) {
    const weapon = items[kit.worn.weapon];
    const shield = items[kit.worn.shield];
    return {
      attack: weapon?.attack ?? 7,
      defense: shield?.defense ?? weapon?.defense ?? 2,
      armor: Object.values(kit.worn).reduce((total, id) => total + (items[id].armor ?? 0), 0),
    };
  }

  return { slots, items, starterKit, add, equip, stow, description, stats };
})();

const Combat = (() => {
  // Stance ratios and the order of physical mitigation follow The Forgotten
  // Server's Player::getAttackFactor and Creature::blockHit.
  const stances = {
    offensive: { attack: 1, defense: 0.5 },
    balanced: { attack: 1.2, defense: 0.75 },
    defensive: { attack: 2, defense: 1 },
  };
  const swingInterval = 2000;

  function roll(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  function attack(player) {
    const gear = Equipment.stats(player.kit);
    const skill = player.kit.worn.weapon ? player.sword.level : 10;
    const stance = stances[player.stance];
    const max = Math.round(Math.floor(player.level / 5) + (skill / 4 + 1) * (gear.attack / 3) * 1.03 / stance.attack);
    return roll(0, max);
  }

  function mitigate(player, damage, swinging) {
    const gear = Equipment.stats(player.kit);
    const skill = player.kit.worn.shield ? player.shielding.level : player.kit.worn.weapon ? player.sword.level : 10;
    const factor = swinging ? stances[player.stance].defense : 1;
    const defense = Math.floor((skill / 4 + 2.23) * gear.defense * 0.15 * factor);
    const remainder = damage - roll(Math.floor(defense / 2), defense);
    if (remainder <= 0) return { damage: 0, blocked: true };
    const armor = gear.armor > 3 ? roll(Math.floor(gear.armor / 2), gear.armor - (gear.armor % 2 + 1)) : Number(gear.armor > 0);
    return { damage: Math.max(0, remainder - armor), blocked: false };
  }

  function train(skill, amount = 1) {
    const level = skill.level;
    skill.tries += amount;
    while (skill.tries >= skill.goal) {
      skill.tries -= skill.goal;
      skill.level++;
      skill.goal = Math.ceil(skill.goal * 1.35);
    }
    return skill.level !== level;
  }

  return { swingInterval, attack, mitigate, train, roll };
})();
