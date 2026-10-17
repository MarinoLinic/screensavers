// Creature contact effects. One entry per CREATURE_PROFILES key.
(() => {
  const Maze3D = window.Maze3D = window.Maze3D || {};

  // Every gameplay radius, duration and multiplier in one frozen table so
  // entities/game/tests all read the same numbers.
  Maze3D.INTERACTION_RULES = Object.freeze({
    pickupRadius: 0.45,
    relicRadius: 0.42,
    exitRadius: 0.45,
    contactRadius: 0.52,
    contactCooldown: 3,
    slowDuration: 2.4,
    reverseDuration: 3,
    creatureBoostDuration: 5,
    relicBoostDuration: 3,
    overdriveDuration: 10,
    boostScale: 1.2,
    slowScale: 0.55,
    knockbackDistance: 0.18,
    bumpTurn: 0.18,
  });

  Maze3D.CREATURE_EFFECTS = Object.freeze({
    rat: 'bump', fish: 'boost', crab: 'slow', drone: 'reverse', alien: 'reverse',
    scarab: 'slow', mummy: 'slow', bat: 'reverse', ghost: 'reverse',
    marten: 'boost', gull: 'boost', frostling: 'boost', robot: 'bump',
    spider: 'slow', gearbug: 'bump',
    skeleton: 'bump', raven: 'bump', shroom: 'bump', shellback: 'bump',
    knight: 'bump', jester: 'bump', zombie: 'slow', crawler: 'slow',
    mutant: 'slow', scavenger: 'bump', neonbot: 'reverse', gummy: 'boost',
    cupcake: 'boost', minotaur: 'slow', owl: 'boost', parrot: 'boost',
    outlaw: 'bump', tumbleweed: 'bump', snake: 'slow', jaguar: 'bump',
    monkey: 'boost', toySoldier: 'bump', windup: 'bump', shadow: 'reverse',
    kitsune: 'bump', spirit: 'reverse', eyeball: 'reverse', cloudling: 'boost',
    eagle: 'boost', dragon: 'reverse', guardianLion: 'slow', crane: 'boost',
    camel: 'bump', falcon: 'bump', quetzal: 'boost', llama: 'boost',
    condor: 'bump', legionary: 'bump', wolf: 'bump', elephant: 'slow',
    peacock: 'boost', lion: 'slow', viking: 'bump', turtle: 'boost',
    gecko: 'bump', dove: 'boost', tiger: 'slow',
    bubbleling: 'boost', dolphin: 'boost', aquaBot: 'reverse', frog: 'bump',
    polygonHound: 'slow', staticWraith: 'reverse', lowPolyRat: 'bump',
    glassKnight: 'bump', prismMoth: 'reverse', glassGolem: 'slow',
    vineNymph: 'boost', moth: 'reverse', fox: 'bump', butterfly: 'boost',
    capybara: 'boost', sunDrone: 'reverse', dieselTrooper: 'bump',
    propellerDrone: 'reverse', sootGremlin: 'slow', raptor: 'slow',
    mammoth: 'bump', pterodactyl: 'reverse', caveBeetle: 'bump',
    stag: 'boost', banshee: 'reverse', strayDog: 'bump', pigeon: 'boost',
    maintenanceBot: 'reverse', inkFox: 'boost', paperKnight: 'bump',
    bookworm: 'slow', quillSpirit: 'reverse',
  });
})();
