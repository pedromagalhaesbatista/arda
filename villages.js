"use strict";

const Villages = (() => {
  const quests = {
    seeds: {
      name: "Seeds for the Party Field", town: "Hobbiton", giver: "gardener", source: "seedBasket",
      offer: "I saved a packet of flower seeds for the Party Field, then left it by the bench under the Party Tree. Would you fetch it before the rain comes?",
      waiting: "Look for the basket beside the bench under the Party Tree, up the lane. The seeds should still be tucked inside.",
      ready: "That's the packet! I'll sow them by the lane so there's a bit of colour for the next party.",
      complete: "Those seeds should do nicely by the lane. Thank you for bringing them back.",
      objective: "Search the seed basket by the Party Tree", returnTo: "Bring the seeds to Sam Gamgee",
      found: "You find Sam's packet of flower seeds in the basket.",
      reward: { coin: 7, herb: 1 },
    },
    pantry: {
      name: "Rats at the Pantry", town: "Bywater", giver: "dragonKeeper", item: "ratTail", count: 2,
      offer: "The bank rats have been getting into my pantry. Bring me two of their tails and I'll pay you for the trouble. Look southeast of the inn, beyond the hunting trail sign.",
      waiting: "The rats gather along the bank southeast of the inn. Save two tails for me when you collect your loot.",
      ready: "Two tails, just as we agreed. The flour sacks might get a quiet night for once.",
      complete: "The pantry's been quieter since you helped. Sit by the hearth if you need a rest.",
      objective: "Collect bank rat tails", returnTo: "Bring the tails to Tansy at the Green Dragon",
      reward: { coin: 10, manaDraught: 1 },
    },
    dispatch: {
      name: "The Market Dispatch", town: "Michel Delving", giver: "marketClerk", source: "pantryKeeper",
      offer: "The Hobbiton pantry keeps a tally of seed and flour orders for the next market. Could you fetch their sealed tally? Poppy keeps shop inside the blue door on Bagshot Row.",
      waiting: "Ask Poppy at the Bagshot Row Pantry for the sealed tally. Take the East Road to Hobbiton, then head up The Hill.",
      ready: "Sealed and on time! Now I know how many tables to set out on market day.",
      complete: "Poppy's tally is filed. There'll be room for every sack at the next market.",
      objective: "Collect the sealed tally from Poppy at Bagshot Row Pantry", returnTo: "Bring the tally to Fosco in Michel Delving",
      found: "Poppy hands you the sealed market tally.",
      reward: { coin: 12, herb: 2 },
    },
  };
  const people = {
    gardener: { sprite: "gardener", greeting: "Bag End is the green door up the lane. The mill sits beside The Water, just east of here." },
    pantryKeeper: {
      sprite: "keeper", greeting: "Mind the low ceiling! I keep herbs and odds and ends for folk walking the East Road.",
      handoff: "Fosco sent you? I've sealed the tally. Take it back to him at the market square in Michel Delving.",
      shop: { name: "Bagshot Row Pantry", buy: { herb: 3, cap: 5, boots: 6 }, sell: { cap: 2, boots: 2, trousers: 3 } },
    },
    dragonKeeper: {
      sprite: "keeper", greeting: "Welcome to the Green Dragon. Take a seat by the hearth, or see what I have behind the bar.",
      shop: { name: "The Green Dragon", buy: { herb: 3, manaDraught: 5 }, sell: {} },
    },
    marketClerk: { sprite: "miller", greeting: "On market day the whole square smells of fresh bread. If you're after supplies, Hilda is inside the hall." },
    marketTrader: {
      sprite: "merchant", greeting: "I've got travelling gear and draughts. I buy spare gear from travellers too.",
      shop: { name: "Michel Delving Market Hall", buy: { manaDraught: 4, tunic: 8, trousers: 8, buckler: 11, broadsword: 28 },
        sell: { cap: 2, tunic: 3, trousers: 3, boots: 2, buckler: 3, sword: 3, broadsword: 8, bow: 3 } },
    },
    pondVillager: { sprite: "gardener", greeting: "You can tell a bank rat by the little ripple it leaves behind. For supplies, try the outfitter's door east of the Dragon." },
  };

  function stage(progress, id) {
    return progress[id] ?? "available";
  }

  function canTurnIn(progress, id, bag) {
    const quest = quests[id];
    const state = stage(progress, id);
    return state === "ready" || (state === "active" && Boolean(quest.item) && (bag[quest.item] ?? 0) >= quest.count);
  }

  function valid(progress) {
    return progress !== null && typeof progress === "object" && !Array.isArray(progress) &&
      Object.entries(progress).every(([id, state]) => Object.hasOwn(quests, id) &&
        (state === "active" || state === "complete" || (state === "ready" && quests[id].source)));
  }

  return { quests, people, stage, canTurnIn, valid };
})();
