"use strict";

const Magic = (() => {
  const groups = { healing: 1000, attack: 2000, support: 2000 };
  const lightDuration = 45000;
  const spells = {
    patch: { name: "Magic Patch", words: "exura infir", group: "healing", level: 1, mana: 6, cooldown: 2000, power: [7, 10], icon: "✚" },
    buzz: { name: "Buzz", words: "exori infir vis", group: "attack", level: 1, mana: 6, cooldown: 2500, range: 3, power: [3, 5], classes: [null, "druid", "sorcerer"], icon: "ϟ" },
    light: { name: "Light", words: "utevo lux", group: "support", level: 1, mana: 4, cooldown: 2000, icon: "☀" },
    strike: { name: "Energy Strike", words: "exori vis", group: "attack", level: 2, mana: 10, cooldown: 4000, range: 4, power: [7, 10], classes: [null, "sorcerer"], icon: "✦" },
    brutal: { name: "Brutal Strike", words: "exori ico", group: "attack", level: 1, mana: 6, cooldown: 3000, range: 1, skill: "sword", power: [6, 9], classes: ["knight"], icon: "✥" },
    cleanse: { name: "Wound Cleansing", words: "exura ico", group: "healing", level: 2, mana: 8, cooldown: 3500, power: [12, 16], classes: ["knight"], icon: "✚" },
    spear: { name: "Lesser Ethereal Spear", words: "exori infir con", group: "attack", level: 1, mana: 6, cooldown: 3000, range: 4, skill: "distance", power: [5, 8], classes: ["paladin"], icon: "↗" },
    divine: { name: "Divine Missile", words: "exori san", group: "attack", level: 2, mana: 10, cooldown: 4000, range: 5, power: [8, 11], classes: ["paladin"], icon: "✧", color: "#ffdc8a" },
    jab: { name: "Swift Jab", words: "exori infir pug", group: "attack", level: 1, mana: 3, cooldown: 2500, range: 1, skill: "fist", power: [4, 7], classes: ["monk"], icon: "✹" },
    mend: { name: "Spirit Mend", words: "exura gran tio", group: "healing", level: 2, mana: 9, cooldown: 4000, power: [13, 17], classes: ["monk"], icon: "✚" },
    ice: { name: "Ice Strike", words: "exori frigo", group: "attack", level: 1, mana: 7, cooldown: 3000, range: 4, power: [6, 9], classes: ["druid"], icon: "❄", color: "#a5e8fa" },
    intense: { name: "Intense Healing", words: "exura gran", group: "healing", level: 2, mana: 10, cooldown: 4000, power: [16, 20], classes: ["druid"], icon: "✚" },
    flame: { name: "Flame Strike", words: "exori flam", group: "attack", level: 1, mana: 7, cooldown: 3000, range: 4, power: [7, 10], classes: ["sorcerer"], icon: "♨", color: "#ffa16b" },
  };

  const canLearn = (spell, vocation) => !spell.classes || spell.classes.includes(vocation);

  function starter(level = 1) {
    return {
      mana: Vocations.maxMana(level),
      magic: { level: 0, tries: 0, goal: 24 },
      spellState: { cooldowns: {}, light: 0, regen: 0 },
    };
  }

  function remaining(player, id) {
    const { cooldowns } = player.spellState;
    return Math.max(cooldowns[id] ?? 0, cooldowns[spells[id].group] ?? 0);
  }

  function spend(player, id) {
    const spell = spells[id];
    player.mana -= spell.mana;
    player.spellState.cooldowns[id] = spell.cooldown;
    player.spellState.cooldowns[spell.group] = groups[spell.group];
    return Combat.train(player.magic, spell.mana * Vocations.rate(player.vocation, "magic"));
  }

  function tick(player, elapsed) {
    const state = player.spellState;
    const manaInterval = Vocations.get(player.vocation).regen;
    const capacity = Vocations.maxMana(player.level, player.vocation);
    for (const [id, time] of Object.entries(state.cooldowns)) {
      if (time <= elapsed) delete state.cooldowns[id];
      else state.cooldowns[id] = time - elapsed;
    }
    state.light = Math.max(0, state.light - elapsed);
    if (player.mana >= capacity) {
      state.regen = 0;
      return false;
    }
    state.regen += elapsed;
    if (state.regen < manaInterval) return false;
    state.regen -= manaInterval;
    player.mana++;
    if (player.mana === capacity) state.regen = 0;
    return true;
  }

  return { groups, lightDuration, spells, canLearn, starter, remaining, spend, tick };
})();
