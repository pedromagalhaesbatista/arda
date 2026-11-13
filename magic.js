"use strict";

const Magic = (() => {
  const groups = { healing: 1000, attack: 2000, support: 2000 };
  const manaInterval = 3000;
  const lightDuration = 45000;
  const spells = {
    patch: { name: "Magic Patch", words: "exura infir", group: "healing", level: 1, mana: 6, cooldown: 2000, icon: "✚" },
    buzz: { name: "Buzz", words: "exori infir vis", group: "attack", level: 1, mana: 6, cooldown: 2500, range: 3, icon: "ϟ" },
    light: { name: "Light", words: "utevo lux", group: "support", level: 1, mana: 4, cooldown: 2000, icon: "☀" },
    strike: { name: "Energy Strike", words: "exori vis", group: "attack", level: 2, mana: 10, cooldown: 4000, range: 4, icon: "✦" },
  };

  const maxMana = level => 24 + (level - 1) * 5;

  function starter(level = 1) {
    return {
      mana: maxMana(level),
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
    return Combat.train(player.magic, spell.mana);
  }

  function tick(player, elapsed) {
    const state = player.spellState;
    for (const [id, time] of Object.entries(state.cooldowns)) {
      if (time <= elapsed) delete state.cooldowns[id];
      else state.cooldowns[id] = time - elapsed;
    }
    state.light = Math.max(0, state.light - elapsed);
    if (player.mana >= maxMana(player.level)) {
      state.regen = 0;
      return false;
    }
    state.regen += elapsed;
    if (state.regen < manaInterval) return false;
    state.regen -= manaInterval;
    player.mana++;
    if (player.mana === maxMana(player.level)) state.regen = 0;
    return true;
  }

  return { groups, manaInterval, lightDuration, spells, maxMana, starter, remaining, spend, tick };
})();
