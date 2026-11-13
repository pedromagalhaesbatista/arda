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
      name: "Rats at the Pantry", town: "Bywater", giver: "dragonKeeper", items: { ratTail: 2 },
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
    beyondHedge: {
      name: "Beyond the Hedge", town: "Bywater", giver: "pondVillager", turnIn: "forestWarden",
      turnInPrompt: "Ned sent you? Tell me what he said.",
      offer: "Buckland's warden sent word that the Old Forest trail has grown dangerous. Follow the East Road east to Stock, take the Bucklebury Ferry, then follow the lane east to the Warden's Camp. Will you carry word that help is coming?",
      waiting: "Find Rollo at the Warden's Camp. Take the ferry east from Stock, then follow the lane from Bucklebury into the Old Forest. Bring supplies; I'd go at level 4 or higher.",
      ready: "So Ned got the message. Good. The lanterns mark the safe camp. Beyond them, keep your eyes on the trail and try to draw the wolves one at a time.",
      complete: "Rollo got the message? Good. If you're going back, top up your supplies first.",
      objective: "Cross at Bucklebury Ferry and report to Rollo at the Warden's Camp",
      returnTo: "Report to Rollo at the Warden's Camp",
      reward: { coin: 12, herb: 2, manaDraught: 1 },
    },
    willowToll: {
      name: "The Willow's Toll", town: "Old Forest", giver: "forestWarden", requires: "beyondHedge",
      items: { forestFang: 3, willowHeart: 1 },
      offer: "The wolves have taken the upper trail, and an old willow guardian has claimed the glade across the Withywindle. Bring me three wolf fangs and a piece of the guardian's heartwood. I'll give you a warden's coat and open the gear chest.",
      waiting: "Hunt the wolves along the upper trail, then cross the Withywindle to the Willow Glade. Search the fallen guardian for heartwood. Thornlings guard the southern bank.",
      ready: "That's the guardian's heartwood, all right. Take this coat. I've opened the gear chest if you're after something sturdier.",
      complete: "The path is safer for now, but the forest always grows back. I still buy trophies if you hunt here again.",
      objective: "Hunt wolves and the willow guardian", returnTo: "Bring the fangs and heartwood to Rollo",
      reward: { coin: 30, wardenCoat: 1 },
    },
  };
  const stories = Object.entries(quests);
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
    forestWarden: {
      sprite: "miller", greeting: "Rest by the fire. The north loop is wolf country. Follow the stream crossing south for thornlings and the Willow Glade.",
      shop: {
        name: "Warden's Camp",
        buy: { herb: 3, manaDraught: 4, thornShield: 44, longYewBow: 44, briarWraps: 44, willowPendant: 44, amberRing: 44 },
        sell: { forestFang: 5, thornBark: 7, willowHeart: 15 },
        requires: { thornShield: "willowToll", longYewBow: "willowToll", briarWraps: "willowToll", willowPendant: "willowToll", amberRing: "willowToll" },
      },
    },
    pondVillager: { sprite: "gardener", greeting: "You can tell a bank rat by the little ripple it leaves behind. For supplies, try the outfitter's door east of the Dragon." },
  };

  function stage(progress, id) {
    return progress[id] ?? "available";
  }

  function canStart(progress, id) {
    const required = quests[id].requires;
    return stage(progress, id) === "available" && (!required || stage(progress, required) === "complete");
  }

  function canTurnIn(progress, id, bag) {
    const { items, turnIn } = quests[id];
    const state = stage(progress, id);
    if (state === "ready") return true;
    if (state !== "active") return false;
    return Boolean(turnIn || items && Object.entries(items).every(([item, count]) => (bag[item] ?? 0) >= count));
  }

  function questSymbol(progress, id, person) {
    const { giver, turnIn = giver } = quests[id];
    const state = stage(progress, id);
    if (person === turnIn && (state === "active" || state === "ready")) return "?";
    return person === giver && canStart(progress, id) ? "!" : null;
  }

  function storyFor(progress, person) {
    return stories.find(([id]) => questSymbol(progress, id, person) === "?") ??
      stories.find(([id]) => questSymbol(progress, id, person) === "!") ??
      stories.find(([, task]) => task.giver === person);
  }

  function valid(progress) {
    return progress !== null && typeof progress === "object" && !Array.isArray(progress) &&
      Object.entries(progress).every(([id, state]) => Object.hasOwn(quests, id) &&
        (state === "active" || state === "complete" || (state === "ready" && quests[id].source)));
  }

  return { quests, people, stage, canStart, canTurnIn, questSymbol, storyFor, valid };
})();
