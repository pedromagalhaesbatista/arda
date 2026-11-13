"use strict";

const Vocations = (() => {
  const adventurer = { name: "Adventurer", hp: 5, mana: 5, regen: 3000, training: {} };
  const classes = {
    knight: {
      name: "Knight", specialty: "Sword fighting and shielding", hp: 9, mana: 5, regen: 4000,
      training: { sword: 2, shielding: 2, distance: 0.75, fist: 1, magic: 0.5 },
    },
    paladin: {
      name: "Paladin", specialty: "Distance fighting", hp: 6, mana: 8, regen: 3000,
      training: { sword: 0.75, shielding: 1, distance: 2, fist: 0.75, magic: 1 },
    },
    monk: {
      name: "Monk", specialty: "Fist fighting", hp: 7, mana: 7, regen: 3000,
      training: { sword: 0.75, shielding: 1.25, distance: 0.75, fist: 2, magic: 1 },
    },
    druid: {
      name: "Druid", specialty: "Healing and ice magic", hp: 5, mana: 12, regen: 2200,
      training: { sword: 0.5, shielding: 0.75, distance: 0.5, fist: 0.5, magic: 2 },
    },
    sorcerer: {
      name: "Sorcerer", specialty: "Fire and energy magic", hp: 5, mana: 13, regen: 2000,
      training: { sword: 0.5, shielding: 0.5, distance: 0.5, fist: 0.5, magic: 2 },
    },
  };
  const get = id => Object.hasOwn(classes, id) ? classes[id] : adventurer;
  const rate = (id, skill) => get(id).training[skill] ?? 1;
  const maxMana = (level, id) => 24 + (level - 1) * get(id).mana;
  const starterSkill = () => ({ level: 10, tries: 0, goal: 8 });

  return { classes, get, rate, maxMana, starterSkill };
})();
