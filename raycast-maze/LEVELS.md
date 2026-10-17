# 3D Maze — Level Field Guide

50 themed sectors. Each level file in `levels/levelN.js` is the source of
truth for that sector: name, start position, theme, creature roster, relic type,
anomaly (inversion) and relic positions, the tile map, and the briefing text
shown in the in-game ABOUT [B] dialog.

## How to play

| Key | Action |
| --- | --- |
| WASD / arrows | Move and turn |
| Mouse | Look (click canvas for pointer lock; drag also works) |
| T | Toggle autoplay on/off |
| U | Switch autoplay brain: SMART (collects everything, then exits) or WANDER (explores) |
| B | Open/close the sector briefing |
| H | Toggle all HUD elements |
| L | Open/close the sector picker (arrows choose, Enter loads) |
| I | Toggle creature + pickup interactions |
| V | Toggle sound |
| M | Toggle the minimap |
| F | Toggle fullscreen |
| R | Reload current sector |
| N / P | Next / previous sector |
| Enter | Enter the maze (from the intro) |
| Escape | Close dialogs |

## Pickups and the exit

- **Relics** (3 per sector): each one grants a 3-second speed boost; collecting
  all three triggers a 10-second OVERDRIVE.
- **Anomalies** (2 per sector, cyan): toggle the world roll — the first touch
  inverts the view, the next restores it.
- **Exit** (green): touching it completes the sector and advances. In SMART
  autoplay with interactions on, the pilot will not exit until every relic and
  anomaly is consumed.
- **Interactions (I)**: when off, creatures and pickups do nothing and SMART
  routes straight to the exit.

## Creature effects

| Effect | What it does |
| --- | --- |
| bump | shoves you and nudges your heading (manual play only) |
| slow | slows movement briefly |
| reverse | reverses mouse-look briefly |
| boost | grants a short speed boost |

## Sectors

### 1. Red Brick Run

The original red-brick screensaver maze: plain corridors, CRT dust, and familiar dungeon wildlife.

- Creatures (x6): rat (bump), bat (reverse), spider (slow)
- Rat bumps and turns you; Bat reverses mouse-look briefly; Spider slows your movement.
- Collect three data disks; each relic grants a 3-second boost and the full set triggers a 10-second Overdrive. Cyan anomalies toggle the world roll; the green exit advances to the next sector. Press I to disable or re-enable interactions.
- File: `levels/level1.js`

### 2. Sunken Ruins

A drowned ruin of coral masonry and rippling water where sea creatures patrol flooded passages.

- Creatures (x8): fish (boost), crab (slow), turtle (boost), gull (boost)
- Fish grants a short speed boost; Crab slows your movement; Turtle grants a short speed boost; Gull grants a short speed boost.
- Collect three pearls; each relic grants a 3-second boost and the full set triggers a 10-second Overdrive. Cyan anomalies toggle the world roll; the green exit advances to the next sector. Press I to disable or re-enable interactions.
- File: `levels/level2.js`

### 3. Orbital Drift

A cold orbital service maze of starfields, panel lights, drones, and watchful alien life.

- Creatures (x8): drone (reverse), alien (reverse), robot (bump), eyeball (reverse)
- Drone reverses mouse-look briefly; Alien reverses mouse-look briefly; Robot bumps and turns you; Eyeball reverses mouse-look briefly.
- Collect three star shards; each relic grants a 3-second boost and the full set triggers a 10-second Overdrive. Cyan anomalies toggle the world roll; the green exit advances to the next sector. Press I to disable or re-enable interactions.
- File: `levels/level3.js`

### 4. Pharaoh's Maze

A sandstone pyramid spiral marked with hieroglyphic blocks, drifting dust, and tomb guardians.

- Creatures (x8): scarab (slow), mummy (slow), snake (slow), lion (slow)
- Scarab slows your movement; Mummy slows your movement; Snake slows your movement; Lion slows your movement.
- Collect three ankhs; each relic grants a 3-second boost and the full set triggers a 10-second Overdrive. Cyan anomalies toggle the world roll; the green exit advances to the next sector. Press I to disable or re-enable interactions.
- File: `levels/level4.js`

### 5. Night Chambers

An obsidian night maze lined with old shelves, dark timber, ghosts, and ceiling shadows.

- Creatures (x8): bat (reverse), ghost (reverse), spider (slow), raven (bump)
- Bat reverses mouse-look briefly; Ghost reverses mouse-look briefly; Spider slows your movement; Raven bumps and turns you.
- Collect three lost books; each relic grants a 3-second boost and the full set triggers a 10-second Overdrive. Cyan anomalies toggle the world roll; the green exit advances to the next sector. Press I to disable or re-enable interactions.
- File: `levels/level5.js`

### 6. Croatia: Stone & Sea

A Croatian stone-and-sea labyrinth with red-white checks, Adriatic sky, terracotta, martens, gulls, and crabs.

- Creatures (x8): marten (boost), gull (boost), crab (slow), turtle (boost)
- Marten grants a short speed boost; Gull grants a short speed boost; Crab slows your movement; Turtle grants a short speed boost.
- Collect three Croatian heart tokens; each relic grants a 3-second boost and the full set triggers a 10-second Overdrive. Cyan anomalies toggle the world roll; the green exit advances to the next sector. Press I to disable or re-enable interactions.
- File: `levels/level6.js`

### 7. Frozen Signal

An icebound research maze of fractured blue walls, snow, frost creatures, and buried machinery.

- Creatures (x8): frostling (boost), spider (slow), alien (reverse), wolf (bump)
- Frostling grants a short speed boost; Spider slows your movement; Alien reverses mouse-look briefly; Wolf bumps and turns you.
- Collect three ice crystals; each relic grants a 3-second boost and the full set triggers a 10-second Overdrive. Cyan anomalies toggle the world roll; the green exit advances to the next sector. Press I to disable or re-enable interactions.
- File: `levels/level7.js`

### 8. Neon Foundry

A hot industrial foundry of metal plates, sparks, robots, drones, and clockwork insects.

- Creatures (x8): robot (bump), drone (reverse), gearbug (bump), neonbot (reverse)
- Robot bumps and turns you; Drone reverses mouse-look briefly; Gearbug bumps and turns you; Neonbot reverses mouse-look briefly.
- Collect three power fuses; each relic grants a 3-second boost and the full set triggers a 10-second Overdrive. Cyan anomalies toggle the world roll; the green exit advances to the next sector. Press I to disable or re-enable interactions.
- File: `levels/level8.js`

### 9. Haunted Archive

A haunted archive of endless bookcases where ghosts, bats, spiders, and ravens haunt the aisles.

- Creatures (x8): ghost (reverse), bat (reverse), spider (slow), raven (bump)
- Ghost reverses mouse-look briefly; Bat reverses mouse-look briefly; Spider slows your movement; Raven bumps and turns you.
- Collect three lost books; each relic grants a 3-second boost and the full set triggers a 10-second Overdrive. Cyan anomalies toggle the world roll; the green exit advances to the next sector. Press I to disable or re-enable interactions.
- File: `levels/level9.js`

### 10. Clockwork Core

A brass clockwork core of gears, rivets, mechanical halls, and wandering automata.

- Creatures (x10): gearbug (bump), robot (bump), drone (reverse), neonbot (reverse), windup (bump)
- Gearbug bumps and turns you; Robot bumps and turns you; Drone reverses mouse-look briefly; Neonbot reverses mouse-look briefly; Windup bumps and turns you.
- Collect three clockwork gears; each relic grants a 3-second boost and the full set triggers a 10-second Overdrive. Cyan anomalies toggle the world roll; the green exit advances to the next sector. Press I to disable or re-enable interactions.
- File: `levels/level10.js`

### 11. Midnight Cemetery

A moonlit cemetery maze built from damp gravestones, low mist, bones, ravens, and restless spirits.

- Creatures (x8): skeleton (bump), raven (bump), ghost (reverse), spider (slow)
- Skeleton bumps and turns you; Raven bumps and turns you; Ghost reverses mouse-look briefly; Spider slows your movement.
- Collect three bone charms; each relic grants a 3-second boost and the full set triggers a 10-second Overdrive. Cyan anomalies toggle the world roll; the green exit advances to the next sector. Press I to disable or re-enable interactions.
- File: `levels/level11.js`

### 12. Mushroom Pipeworks

A cheerful pipe-and-brick maze with green machinery, coins, mushrooms, shellbacks, and playful hazards.

- Creatures (x8): shroom (bump), shellback (bump), rat (bump), turtle (boost)
- Shroom bumps and turns you; Shellback bumps and turns you; Rat bumps and turns you; Turtle grants a short speed boost.
- Collect three gold coins; each relic grants a 3-second boost and the full set triggers a 10-second Overdrive. Cyan anomalies toggle the world roll; the green exit advances to the next sector. Press I to disable or re-enable interactions.
- File: `levels/level12.js`

### 13. Crownstone Palace

A royal palace maze of crimson fabric, marble, gold trim, knights, jesters, and courtly animals.

- Creatures (x8): knight (bump), jester (bump), gull (boost), peacock (boost)
- Knight bumps and turns you; Jester bumps and turns you; Gull grants a short speed boost; Peacock grants a short speed boost.
- Collect three crown jewels; each relic grants a 3-second boost and the full set triggers a 10-second Overdrive. Cyan anomalies toggle the world roll; the green exit advances to the next sector. Press I to disable or re-enable interactions.
- File: `levels/level13.js`

### 14. Dead Mall

An abandoned mall and clinic maze with stained tile, bad lights, zombies, crawlers, and vermin.

- Creatures (x10): zombie (slow), crawler (slow), rat (bump), spider (slow), mutant (slow)
- Zombie slows your movement; Crawler slows your movement; Rat bumps and turns you; Spider slows your movement; Mutant slows your movement.
- Collect three medical kits; each relic grants a 3-second boost and the full set triggers a 10-second Overdrive. Cyan anomalies toggle the world roll; the green exit advances to the next sector. Press I to disable or re-enable interactions.
- File: `levels/level14.js`

### 15. Ashfall Wastes

A ruined wasteland of cracked concrete, ash, scavengers, mutants, and storm-dark corridors.

- Creatures (x10): mutant (slow), scavenger (bump), raven (bump), wolf (bump), tumbleweed (bump)
- Mutant slows your movement; Scavenger bumps and turns you; Raven bumps and turns you; Wolf bumps and turns you; Tumbleweed bumps and turns you.
- Collect three charged batteries; each relic grants a 3-second boost and the full set triggers a 10-second Overdrive. Cyan anomalies toggle the world roll; the green exit advances to the next sector. Press I to disable or re-enable interactions.
- File: `levels/level15.js`

### 16. Neon Megacity

A rain-soaked cyber metropolis of neon panels, grid floors, robots, drones, and alien silhouettes.

- Creatures (x10): neonbot (reverse), drone (reverse), alien (reverse), robot (bump), eyeball (reverse)
- Neonbot reverses mouse-look briefly; Drone reverses mouse-look briefly; Alien reverses mouse-look briefly; Robot bumps and turns you; Eyeball reverses mouse-look briefly.
- Collect three data chips; each relic grants a 3-second boost and the full set triggers a 10-second Overdrive. Cyan anomalies toggle the world roll; the green exit advances to the next sector. Press I to disable or re-enable interactions.
- File: `levels/level16.js`

### 17. Candy Catacombs

A striped confectionery catacomb of candy tile, confetti, gummies, cupcakes, and living mushrooms.

- Creatures (x8): gummy (boost), cupcake (boost), shroom (bump), cloudling (boost)
- Gummy grants a short speed boost; Cupcake grants a short speed boost; Shroom bumps and turns you; Cloudling grants a short speed boost.
- Collect three wrapped sweets; each relic grants a 3-second boost and the full set triggers a 10-second Overdrive. Cyan anomalies toggle the world roll; the green exit advances to the next sector. Press I to disable or re-enable interactions.
- File: `levels/level17.js`

### 18. Labyrinth of Olympus

A bright marble labyrinth inspired by Olympus, guarded by minotaurs, owls, scarabs, and stone lions.

- Creatures (x8): minotaur (slow), owl (boost), scarab (slow), guardian Lion (slow)
- Minotaur slows your movement; Owl grants a short speed boost; Scarab slows your movement; Guardian Lion slows your movement.
- Collect three laurel tokens; each relic grants a 3-second boost and the full set triggers a 10-second Overdrive. Cyan anomalies toggle the world roll; the green exit advances to the next sector. Press I to disable or re-enable interactions.
- File: `levels/level18.js`

### 19. Cursed Galleon

A storm-lashed cursed galleon of wet decks, dark planks, parrots, skeletons, crabs, and ghosts.

- Creatures (x8): parrot (boost), skeleton (bump), crab (slow), ghost (reverse)
- Parrot grants a short speed boost; Skeleton bumps and turns you; Crab slows your movement; Ghost reverses mouse-look briefly.
- Collect three compasses; each relic grants a 3-second boost and the full set triggers a 10-second Overdrive. Cyan anomalies toggle the world roll; the green exit advances to the next sector. Press I to disable or re-enable interactions.
- File: `levels/level19.js`

### 20. Dustbowl Mine

A dusty frontier mine of adobe, timber, badges, outlaws, tumbleweeds, snakes, and ravens.

- Creatures (x8): outlaw (bump), tumbleweed (bump), snake (slow), raven (bump)
- Outlaw bumps and turns you; Tumbleweed bumps and turns you; Snake slows your movement; Raven bumps and turns you.
- Collect three sheriff badges; each relic grants a 3-second boost and the full set triggers a 10-second Overdrive. Cyan anomalies toggle the world roll; the green exit advances to the next sector. Press I to disable or re-enable interactions.
- File: `levels/level20.js`

### 21. Emerald Canopy

A dense emerald jungle temple where fireflies reveal snakes, jaguars, monkeys, parrots, and spiders.

- Creatures (x10): snake (slow), jaguar (bump), monkey (boost), parrot (boost), spider (slow)
- Snake slows your movement; Jaguar bumps and turns you; Monkey grants a short speed boost; Parrot grants a short speed boost; Spider slows your movement.
- Collect three jade idols; each relic grants a 3-second boost and the full set triggers a 10-second Overdrive. Cyan anomalies toggle the world roll; the green exit advances to the next sector. Press I to disable or re-enable interactions.
- File: `levels/level21.js`

### 22. Toybox Trouble

A giant toybox maze of painted blocks, play mats, toy soldiers, windups, robots, and gearbugs.

- Creatures (x8): toy Soldier (bump), windup (bump), gearbug (bump), robot (bump)
- Toy Soldier bumps and turns you; Windup bumps and turns you; Gearbug bumps and turns you; Robot bumps and turns you.
- Collect three toy keys; each relic grants a 3-second boost and the full set triggers a 10-second Overdrive. Cyan anomalies toggle the world roll; the green exit advances to the next sector. Press I to disable or re-enable interactions.
- File: `levels/level22.js`

### 23. Rain City Noir

A monochrome rain-city maze of wet brick, hard shadows, ravens, rats, drones, and noir apparitions.

- Creatures (x8): shadow (reverse), raven (bump), rat (bump), drone (reverse)
- Shadow reverses mouse-look briefly; Raven bumps and turns you; Rat bumps and turns you; Drone reverses mouse-look briefly.
- Collect three film reels; each relic grants a 3-second boost and the full set triggers a 10-second Overdrive. Cyan anomalies toggle the world roll; the green exit advances to the next sector. Press I to disable or re-enable interactions.
- File: `levels/level23.js`

### 24. Moonlit Shrine

A moonlit shrine of lacquered beams, tatami, drifting petals, fox spirits, cranes, gulls, and ghosts.

- Creatures (x8): kitsune (bump), spirit (reverse), gull (boost), crane (boost)
- Kitsune bumps and turns you; Spirit reverses mouse-look briefly; Gull grants a short speed boost; Crane grants a short speed boost.
- Collect three shrine charms; each relic grants a 3-second boost and the full set triggers a 10-second Overdrive. Cyan anomalies toggle the world roll; the green exit advances to the next sector. Press I to disable or re-enable interactions.
- File: `levels/level24.js`

### 25. Lucid Dreamscape

A surreal cloud maze of impossible pastel walls, floating eyes, cloudlings, ghosts, and spirits.

- Creatures (x8): eyeball (reverse), cloudling (boost), ghost (reverse), spirit (reverse)
- Eyeball reverses mouse-look briefly; Cloudling grants a short speed boost; Ghost reverses mouse-look briefly; Spirit reverses mouse-look briefly.
- Collect three dream eyes; each relic grants a 3-second boost and the full set triggers a 10-second Overdrive. Cyan anomalies toggle the world roll; the green exit advances to the next sector. Press I to disable or re-enable interactions.
- File: `levels/level25.js`

### 26. Gothic Keep

A medieval Gothic keep of arches, flagstone, fog, knights, wolves, ravens, and watchful owls.

- Creatures (x8): knight (bump), raven (bump), wolf (bump), owl (boost)
- Knight bumps and turns you; Raven bumps and turns you; Wolf bumps and turns you; Owl grants a short speed boost.
- Collect three golden chalices; each relic grants a 3-second boost and the full set triggers a 10-second Overdrive. Cyan anomalies toggle the world roll; the green exit advances to the next sector. Press I to disable or re-enable interactions.
- File: `levels/level26.js`

### 27. Deco Metropolis

An American Art Deco tower maze of gold geometry, rainy windows, neon machinery, and urban shadows.

- Creatures (x8): shadow (reverse), neonbot (reverse), eagle (boost), drone (reverse)
- Shadow reverses mouse-look briefly; Neonbot reverses mouse-look briefly; Eagle grants a short speed boost; Drone reverses mouse-look briefly.
- Collect three deco keys; each relic grants a 3-second boost and the full set triggers a 10-second Overdrive. Cyan anomalies toggle the world roll; the green exit advances to the next sector. Press I to disable or re-enable interactions.
- File: `levels/level27.js`

### 28. Celestial Palace

An imperial Chinese palace maze of red lacquer, painted ceilings, dragons, guardian lions, cranes, and tigers.

- Creatures (x8): dragon (reverse), guardian Lion (slow), crane (boost), tiger (slow)
- Dragon reverses mouse-look briefly; Guardian Lion slows your movement; Crane grants a short speed boost; Tiger slows your movement.
- Collect three jade seals; each relic grants a 3-second boost and the full set triggers a 10-second Overdrive. Cyan anomalies toggle the world roll; the green exit advances to the next sector. Press I to disable or re-enable interactions.
- File: `levels/level28.js`

### 29. Desert Caravanserai

A desert caravanserai of ochre walls, geometric mosaics, camels, falcons, gulls, and circling eagles.

- Creatures (x8): camel (bump), falcon (bump), gull (boost), eagle (boost)
- Camel bumps and turns you; Falcon bumps and turns you; Gull grants a short speed boost; Eagle grants a short speed boost.
- Collect three astrolabes; each relic grants a 3-second boost and the full set triggers a 10-second Overdrive. Cyan anomalies toggle the world roll; the green exit advances to the next sector. Press I to disable or re-enable interactions.
- File: `levels/level29.js`

### 30. Jade Observatory

A Maya-inspired jade observatory of stepped stone, jungle fireflies, jaguars, quetzals, snakes, and monkeys.

- Creatures (x8): jaguar (bump), quetzal (boost), snake (slow), monkey (boost)
- Jaguar bumps and turns you; Quetzal grants a short speed boost; Snake slows your movement; Monkey grants a short speed boost.
- Collect three calendar stones; each relic grants a 3-second boost and the full set triggers a 10-second Overdrive. Cyan anomalies toggle the world roll; the green exit advances to the next sector. Press I to disable or re-enable interactions.
- File: `levels/level30.js`

### 31. Sunstone Citadel

An Inca-inspired Andean citadel of fitted stone, high sun, llamas, condors, jaguars, and eagles.

- Creatures (x8): llama (boost), condor (bump), jaguar (bump), eagle (boost)
- Llama grants a short speed boost; Condor bumps and turns you; Jaguar bumps and turns you; Eagle grants a short speed boost.
- Collect three sun stones; each relic grants a 3-second boost and the full set triggers a 10-second Overdrive. Cyan anomalies toggle the world roll; the green exit advances to the next sector. Press I to disable or re-enable interactions.
- File: `levels/level31.js`

### 32. Imperial Aqueduct

An ancient Roman aqueduct maze of brick, marble, columns, legionaries, wolves, owls, and lions.

- Creatures (x8): legionary (bump), wolf (bump), owl (boost), lion (slow)
- Legionary bumps and turns you; Wolf bumps and turns you; Owl grants a short speed boost; Lion slows your movement.
- Collect three Roman coins; each relic grants a 3-second boost and the full set triggers a 10-second Overdrive. Cyan anomalies toggle the world roll; the green exit advances to the next sector. Press I to disable or re-enable interactions.
- File: `levels/level32.js`

### 33. Monsoon Mandir

An Indian temple-inspired monsoon maze of carved stone, mandala floors, elephants, peacocks, monkeys, and tigers.

- Creatures (x8): elephant (slow), peacock (boost), monkey (boost), tiger (slow)
- Elephant slows your movement; Peacock grants a short speed boost; Monkey grants a short speed boost; Tiger slows your movement.
- Collect three lotus emblems; each relic grants a 3-second boost and the full set triggers a 10-second Overdrive. Cyan anomalies toggle the world roll; the green exit advances to the next sector. Press I to disable or re-enable interactions.
- File: `levels/level33.js`

### 34. Angkor Roots

A Khmer-inspired laterite temple overtaken by roots, fireflies, elephants, monkeys, snakes, tigers, and peacocks.

- Creatures (x10): elephant (slow), monkey (boost), snake (slow), tiger (slow), peacock (boost)
- Elephant slows your movement; Monkey grants a short speed boost; Snake slows your movement; Tiger slows your movement; Peacock grants a short speed boost.
- Collect three lotus carvings; each relic grants a 3-second boost and the full set triggers a 10-second Overdrive. Cyan anomalies toggle the world roll; the green exit advances to the next sector. Press I to disable or re-enable interactions.
- File: `levels/level34.js`

### 35. Golden Sahel

A Malian and Sahelian-inspired earthen maze with geometric plaster, camels, lions, falcons, and eagles.

- Creatures (x8): camel (bump), lion (slow), falcon (bump), eagle (boost)
- Camel bumps and turns you; Lion slows your movement; Falcon bumps and turns you; Eagle grants a short speed boost.
- Collect three gold weights; each relic grants a 3-second boost and the full set triggers a 10-second Overdrive. Cyan anomalies toggle the world roll; the green exit advances to the next sector. Press I to disable or re-enable interactions.
- File: `levels/level35.js`

### 36. Garden of Stars

A Persian-inspired garden palace of turquoise geometry, roses, petals, peacocks, falcons, gulls, and doves.

- Creatures (x8): peacock (boost), falcon (bump), gull (boost), dove (boost)
- Peacock grants a short speed boost; Falcon bumps and turns you; Gull grants a short speed boost; Dove grants a short speed boost.
- Collect three garden roses; each relic grants a 3-second boost and the full set triggers a 10-second Overdrive. Cyan anomalies toggle the world roll; the green exit advances to the next sector. Press I to disable or re-enable interactions.
- File: `levels/level36.js`

### 37. Runestone Fjord

A Norse fjord maze of timber, runes, snow, Vikings, wolves, ravens, and eagles.

- Creatures (x8): viking (bump), raven (bump), wolf (bump), eagle (boost)
- Viking bumps and turns you; Raven bumps and turns you; Wolf bumps and turns you; Eagle grants a short speed boost.
- Collect three runestones; each relic grants a 3-second boost and the full set triggers a 10-second Overdrive. Cyan anomalies toggle the world roll; the green exit advances to the next sector. Press I to disable or re-enable interactions.
- File: `levels/level37.js`

### 38. Wayfinder Isles

A Polynesian and Oceanic-inspired wayfinder maze of woven motifs, coral stone, turtles, geckos, gulls, and fish.

- Creatures (x8): turtle (boost), gecko (bump), gull (boost), fish (boost)
- Turtle grants a short speed boost; Gecko bumps and turns you; Gull grants a short speed boost; Fish grants a short speed boost.
- Collect three wayfinding compasses; each relic grants a 3-second boost and the full set triggers a 10-second Overdrive. Cyan anomalies toggle the world roll; the green exit advances to the next sector. Press I to disable or re-enable interactions.
- File: `levels/level38.js`

### 39. Mosaic Basilica

A Byzantine-inspired basilica maze of golden tesserae, stone guardians, doves, and luminous spirits.

- Creatures (x8): knight (bump), dove (boost), spirit (reverse), guardian Lion (slow)
- Knight bumps and turns you; Dove grants a short speed boost; Spirit reverses mouse-look briefly; Guardian Lion slows your movement.
- Collect three mosaic tiles; each relic grants a 3-second boost and the full set triggers a 10-second Overdrive. Cyan anomalies toggle the world roll; the green exit advances to the next sector. Press I to disable or re-enable interactions.
- File: `levels/level39.js`

### 40. Moon Gate Palace

A Korean palace-inspired maze of dancheong colors, ondol floors, moon gates, tigers, cranes, ravens, and doves.

- Creatures (x8): tiger (slow), crane (boost), raven (bump), dove (boost)
- Tiger slows your movement; Crane grants a short speed boost; Raven bumps and turns you; Dove grants a short speed boost.
- Collect three jade rings; each relic grants a 3-second boost and the full set triggers a 10-second Overdrive. Cyan anomalies toggle the world roll; the green exit advances to the next sector. Press I to disable or re-enable interactions.
- File: `levels/level40.js`

### 41. Aqua Utopia

A glossy Frutiger Aero maze of blue glass, fresh water, bright grass colors, bubbles, and optimistic aquatic machines.

- Creatures (x8): bubbleling (boost), dolphin (boost), aqua Bot (reverse), frog (bump)
- Bubbleling grants a short speed boost; Dolphin grants a short speed boost; Aqua Bot reverses mouse-look briefly; Frog bumps and turns you.
- Collect three aqua orbs; each relic grants a 3-second boost and the full set triggers a 10-second Overdrive. Cyan anomalies toggle the world roll; the green exit advances to the next sector. Press I to disable or re-enable interactions.
- File: `levels/level41.js`

### 42. Vertex Ward

A deliberately unstable early-3D horror ward with affine-looking tiles, heavy fog, polygon beasts, and static spirits.

- Creatures (x8): polygon Hound (slow), static Wraith (reverse), low Poly Rat (bump), crawler (slow)
- Polygon Hound slows your movement; Static Wraith reverses mouse-look briefly; Low Poly Rat bumps and turns you; Crawler slows your movement.
- Collect three polygon keys; each relic grants a 3-second boost and the full set triggers a 10-second Overdrive. Cyan anomalies toggle the world roll; the green exit advances to the next sector. Press I to disable or re-enable interactions.
- File: `levels/level42.js`

### 43. Prism Cathedral

A stained-glass cathedral maze where colored panes, lead lines, prism moths, glass guardians, and doves catch the light.

- Creatures (x8): glass Knight (bump), prism Moth (reverse), glass Golem (slow), dove (boost)
- Glass Knight bumps and turns you; Prism Moth reverses mouse-look briefly; Glass Golem slows your movement; Dove grants a short speed boost.
- Collect three prism shards; each relic grants a 3-second boost and the full set triggers a 10-second Overdrive. Cyan anomalies toggle the world roll; the green exit advances to the next sector. Press I to disable or re-enable interactions.
- File: `levels/level43.js`

### 44. Nouveau Conservatory

An Art Nouveau conservatory of flowing floral lines, green glass, petals, foxes, moths, peacocks, and living vines.

- Creatures (x8): vine Nymph (boost), moth (reverse), peacock (boost), fox (bump)
- Vine Nymph grants a short speed boost; Moth reverses mouse-look briefly; Peacock grants a short speed boost; Fox bumps and turns you.
- Collect three floral brooches; each relic grants a 3-second boost and the full set triggers a 10-second Overdrive. Cyan anomalies toggle the world roll; the green exit advances to the next sector. Press I to disable or re-enable interactions.
- File: `levels/level44.js`

### 45. Sunleaf Habitat

A solarpunk habitat where clean panels, gardens, solar geometry, butterflies, capybaras, geckos, and helper drones coexist.

- Creatures (x8): butterfly (boost), capybara (boost), sun Drone (reverse), gecko (bump)
- Butterfly grants a short speed boost; Capybara grants a short speed boost; Sun Drone reverses mouse-look briefly; Gecko bumps and turns you.
- Collect three solar seeds; each relic grants a 3-second boost and the full set triggers a 10-second Overdrive. Cyan anomalies toggle the world roll; the green exit advances to the next sector. Press I to disable or re-enable interactions.
- File: `levels/level45.js`

### 46. Iron Zeppelin

A dieselpunk airship maze of riveted steel, propellers, smoke, uniformed sentries, soot gremlins, and engine-room rats.

- Creatures (x8): diesel Trooper (bump), propeller Drone (reverse), soot Gremlin (slow), rat (bump)
- Diesel Trooper bumps and turns you; Propeller Drone reverses mouse-look briefly; Soot Gremlin slows your movement; Rat bumps and turns you.
- Collect three airship badges; each relic grants a 3-second boost and the full set triggers a 10-second Overdrive. Cyan anomalies toggle the world roll; the green exit advances to the next sector. Press I to disable or re-enable interactions.
- File: `levels/level46.js`

### 47. Primeval Caverns

A prehistoric cave maze of basalt, bones, amber light, raptors, mammoths, pterodactyls, and armored beetles.

- Creatures (x8): raptor (slow), mammoth (bump), pterodactyl (reverse), cave Beetle (bump)
- Raptor slows your movement; Mammoth bumps and turns you; Pterodactyl reverses mouse-look briefly; Cave Beetle bumps and turns you.
- Collect three amber fossils; each relic grants a 3-second boost and the full set triggers a 10-second Overdrive. Cyan anomalies toggle the world roll; the green exit advances to the next sector. Press I to disable or re-enable interactions.
- File: `levels/level47.js`

### 48. Knotstone Hollow

A Celtic-inspired stone hollow of knotwork, spirals, standing stones, mist, stags, ravens, wolves, and a keening spirit.

- Creatures (x8): stag (boost), banshee (reverse), raven (bump), wolf (bump)
- Stag grants a short speed boost; Banshee reverses mouse-look briefly; Raven bumps and turns you; Wolf bumps and turns you.
- Collect three knotstone tokens; each relic grants a 3-second boost and the full set triggers a 10-second Overdrive. Cyan anomalies toggle the world roll; the green exit advances to the next sector. Press I to disable or re-enable interactions.
- File: `levels/level48.js`

### 49. Concrete Twilight

A post-Soviet concrete maze of panel blocks, wet courtyards, utility lights, stray dogs, pigeons, maintenance bots, and rats.

- Creatures (x8): stray Dog (bump), pigeon (boost), maintenance Bot (reverse), rat (bump)
- Stray Dog bumps and turns you; Pigeon grants a short speed boost; Maintenance Bot reverses mouse-look briefly; Rat bumps and turns you.
- Collect three metro tokens; each relic grants a 3-second boost and the full set triggers a 10-second Overdrive. Cyan anomalies toggle the world roll; the green exit advances to the next sector. Press I to disable or re-enable interactions.
- File: `levels/level49.js`

### 50. Inkbound Library

A vintage storybook and VGA-inspired library maze of ink hatching, aged paper, foxes, paper knights, bookworms, and quill spirits.

- Creatures (x8): ink Fox (boost), paper Knight (bump), bookworm (slow), quill Spirit (reverse)
- Ink Fox grants a short speed boost; Paper Knight bumps and turns you; Bookworm slows your movement; Quill Spirit reverses mouse-look briefly.
- Collect three enchanted quills; each relic grants a 3-second boost and the full set triggers a 10-second Overdrive. Cyan anomalies toggle the world roll; the green exit advances to the next sector. Press I to disable or re-enable interactions.
- File: `levels/level50.js`

## Modifying levels

Edit `levels/levelN.js` directly (keep the `LEVELS.push({...})` shape and a
single exit tile `2`), then run `node tests/validate.js`. Wall themes must
exist in the texture packs under `js/textures/` plus a variant entry in
`js/textures/level-variants.js`; creature types need a sprite entry in a
texture pack, a size profile in `js/entities.js` (PROFILES), and an effect in
`js/interactions.js` (CREATURE_EFFECTS). The content expansion plan in
`.content-expansion-plan.json` was generated by `.content-plan-generator.py`
and is kept as a frozen record of the 41-50 expansion.
