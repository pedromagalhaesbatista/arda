"use strict";

const Hunting = (() => {
  const respawnDelay = 20000;
  const leaveDistance = 8;
  const creatures = {
    rat: { hp: 8, damage: 7, xp: 9, coins: 1 },
    wolf: { hp: 16, damage: 13, xp: 14, coins: 3, drops: ["ring", "pendant"] },
    bankRat: { hp: 9, damage: 6, xp: 8, coins: 3, drops: ["ratTail"], respawns: true },
    marshWolf: { hp: 17, damage: 11, xp: 15, coins: 5, drops: ["wolfPelt"], respawns: true },
  };
  const buy = { herb: 3, manaDraught: 4, oakShield: 28, yewBow: 28, handwraps: 28, riverPendant: 28, emberRing: 28 };
  const sell = { ratTail: 3, wolfPelt: 6, ring: 4, pendant: 4, buckler: 2, sword: 3, broadsword: 8, bow: 3 };

  return { respawnDelay, leaveDistance, creatures, buy, sell };
})();
