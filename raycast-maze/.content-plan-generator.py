import json, random, collections, re
from pathlib import Path

root = Path('.')
rosters = {
1:['rat','bat','spider'], 2:['fish','crab','turtle','gull'], 3:['drone','alien','robot','eyeball'], 4:['scarab','mummy','snake','lion'],
5:['bat','ghost','spider','raven'], 6:['marten','gull','crab','turtle'], 7:['frostling','spider','alien','wolf'], 8:['robot','drone','gearbug','neonbot'],
9:['ghost','bat','spider','raven'], 10:['gearbug','robot','drone','neonbot','windup'], 11:['skeleton','raven','ghost','spider'], 12:['shroom','shellback','rat','turtle'],
13:['knight','jester','gull','peacock'], 14:['zombie','crawler','rat','spider','mutant'], 15:['mutant','scavenger','raven','wolf','tumbleweed'],
16:['neonbot','drone','alien','robot','eyeball'], 17:['gummy','cupcake','shroom','cloudling'], 18:['minotaur','owl','scarab','guardianLion'],
19:['parrot','skeleton','crab','ghost'], 20:['outlaw','tumbleweed','snake','raven'], 21:['snake','jaguar','monkey','parrot','spider'],
22:['toySoldier','windup','gearbug','robot'], 23:['shadow','raven','rat','drone'], 24:['kitsune','spirit','gull','crane'],
25:['eyeball','cloudling','ghost','spirit'], 26:['knight','raven','wolf','owl'], 27:['shadow','neonbot','eagle','drone'],
28:['dragon','guardianLion','crane','tiger'], 29:['camel','falcon','gull','eagle'], 30:['jaguar','quetzal','snake','monkey'],
31:['llama','condor','jaguar','eagle'], 32:['legionary','wolf','owl','lion'], 33:['elephant','peacock','monkey','tiger'],
34:['elephant','monkey','snake','tiger','peacock'], 35:['camel','lion','falcon','eagle'], 36:['peacock','falcon','gull','dove'],
37:['viking','raven','wolf','eagle'], 38:['turtle','gecko','gull','fish'], 39:['knight','dove','spirit','guardianLion'], 40:['tiger','crane','raven','dove'],
}

descriptions = {
1:'The original red-brick screensaver maze: plain corridors, CRT dust, and familiar dungeon wildlife.',
2:'A drowned ruin of coral masonry and rippling water where sea creatures patrol flooded passages.',
3:'A cold orbital service maze of starfields, panel lights, drones, and watchful alien life.',
4:'A sandstone pyramid spiral marked with hieroglyphic blocks, drifting dust, and tomb guardians.',
5:'An obsidian night maze lined with old shelves, dark timber, ghosts, and ceiling shadows.',
6:'A Croatian stone-and-sea labyrinth with red-white checks, Adriatic sky, terracotta, martens, gulls, and crabs.',
7:'An icebound research maze of fractured blue walls, snow, frost creatures, and buried machinery.',
8:'A hot industrial foundry of metal plates, sparks, robots, drones, and clockwork insects.',
9:'A haunted archive of endless bookcases where ghosts, bats, spiders, and ravens haunt the aisles.',
10:'A brass clockwork core of gears, rivets, mechanical halls, and wandering automata.',
11:'A moonlit cemetery maze built from damp gravestones, low mist, bones, ravens, and restless spirits.',
12:'A cheerful pipe-and-brick maze with green machinery, coins, mushrooms, shellbacks, and playful hazards.',
13:'A royal palace maze of crimson fabric, marble, gold trim, knights, jesters, and courtly animals.',
14:'An abandoned mall and clinic maze with stained tile, bad lights, zombies, crawlers, and vermin.',
15:'A ruined wasteland of cracked concrete, ash, scavengers, mutants, and storm-dark corridors.',
16:'A rain-soaked cyber metropolis of neon panels, grid floors, robots, drones, and alien silhouettes.',
17:'A striped confectionery catacomb of candy tile, confetti, gummies, cupcakes, and living mushrooms.',
18:'A bright marble labyrinth inspired by Olympus, guarded by minotaurs, owls, scarabs, and stone lions.',
19:'A storm-lashed cursed galleon of wet decks, dark planks, parrots, skeletons, crabs, and ghosts.',
20:'A dusty frontier mine of adobe, timber, badges, outlaws, tumbleweeds, snakes, and ravens.',
21:'A dense emerald jungle temple where fireflies reveal snakes, jaguars, monkeys, parrots, and spiders.',
22:'A giant toybox maze of painted blocks, play mats, toy soldiers, windups, robots, and gearbugs.',
23:'A monochrome rain-city maze of wet brick, hard shadows, ravens, rats, drones, and noir apparitions.',
24:'A moonlit shrine of lacquered beams, tatami, drifting petals, fox spirits, cranes, gulls, and ghosts.',
25:'A surreal cloud maze of impossible pastel walls, floating eyes, cloudlings, ghosts, and spirits.',
26:'A medieval Gothic keep of arches, flagstone, fog, knights, wolves, ravens, and watchful owls.',
27:'An American Art Deco tower maze of gold geometry, rainy windows, neon machinery, and urban shadows.',
28:'An imperial Chinese palace maze of red lacquer, painted ceilings, dragons, guardian lions, cranes, and tigers.',
29:'A desert caravanserai of ochre walls, geometric mosaics, camels, falcons, gulls, and circling eagles.',
30:'A Maya-inspired jade observatory of stepped stone, jungle fireflies, jaguars, quetzals, snakes, and monkeys.',
31:'An Inca-inspired Andean citadel of fitted stone, high sun, llamas, condors, jaguars, and eagles.',
32:'An ancient Roman aqueduct maze of brick, marble, columns, legionaries, wolves, owls, and lions.',
33:'An Indian temple-inspired monsoon maze of carved stone, mandala floors, elephants, peacocks, monkeys, and tigers.',
34:'A Khmer-inspired laterite temple overtaken by roots, fireflies, elephants, monkeys, snakes, tigers, and peacocks.',
35:'A Malian and Sahelian-inspired earthen maze with geometric plaster, camels, lions, falcons, and eagles.',
36:'A Persian-inspired garden palace of turquoise geometry, roses, petals, peacocks, falcons, gulls, and doves.',
37:'A Norse fjord maze of timber, runes, snow, Vikings, wolves, ravens, and eagles.',
38:'A Polynesian and Oceanic-inspired wayfinder maze of woven motifs, coral stone, turtles, geckos, gulls, and fish.',
39:'A Byzantine-inspired basilica maze of golden tesserae, stone guardians, doves, and luminous spirits.',
40:'A Korean palace-inspired maze of dancheong colors, ondol floors, moon gates, tigers, cranes, ravens, and doves.',
}

existing_effects = {
'rat':'bump','fish':'boost','crab':'slow','drone':'reverse','alien':'reverse','scarab':'slow','mummy':'slow','bat':'reverse','ghost':'reverse','marten':'boost','gull':'boost','frostling':'boost','robot':'bump','spider':'slow','gearbug':'bump','skeleton':'bump','raven':'bump','shroom':'bump','shellback':'bump','knight':'bump','jester':'bump','zombie':'slow','crawler':'slow','mutant':'slow','scavenger':'bump','neonbot':'reverse','gummy':'boost','cupcake':'boost','minotaur':'slow','owl':'boost','parrot':'boost','outlaw':'bump','tumbleweed':'bump','snake':'slow','jaguar':'bump','monkey':'boost','toySoldier':'bump','windup':'bump','shadow':'reverse','kitsune':'bump','spirit':'reverse','eyeball':'reverse','cloudling':'boost','eagle':'boost','dragon':'reverse','guardianLion':'slow','crane':'boost','camel':'bump','falcon':'bump','quetzal':'boost','llama':'boost','condor':'bump','legionary':'bump','wolf':'bump','elephant':'slow','peacock':'boost','lion':'slow','viking':'bump','turtle':'boost','gecko':'bump','dove':'boost','tiger':'slow'
}
new_effects = {
'bubbleling':'boost','dolphin':'boost','aquaBot':'reverse','frog':'bump','polygonHound':'slow','staticWraith':'reverse','lowPolyRat':'bump','glassKnight':'bump','prismMoth':'reverse','glassGolem':'slow','vineNymph':'boost','moth':'reverse','fox':'bump','butterfly':'boost','capybara':'boost','sunDrone':'reverse','dieselTrooper':'bump','propellerDrone':'reverse','sootGremlin':'slow','raptor':'slow','mammoth':'bump','pterodactyl':'reverse','caveBeetle':'bump','stag':'boost','banshee':'reverse','strayDog':'bump','pigeon':'boost','maintenanceBot':'reverse','inkFox':'boost','paperKnight':'bump','bookworm':'slow','quillSpirit':'reverse'
}
all_effects = {**existing_effects, **new_effects}
effect_text = {'bump':'bumps and turns you','slow':'slows your movement','reverse':'reverses mouse-look briefly','boost':'grants a short speed boost'}

def maze(w, h, seed, braid, rooms):
    rng = random.Random(seed)
    grid = [[1] * w for _ in range(h)]
    grid[1][1] = 0
    stack = [(1, 1)]
    while stack:
        x, y = stack[-1]
        options = []
        for dx, dy in ((2,0),(-2,0),(0,2),(0,-2)):
            nx, ny = x + dx, y + dy
            if 0 < nx < w - 1 and 0 < ny < h - 1 and grid[ny][nx] == 1:
                options.append((nx, ny, dx, dy))
        if options:
            nx, ny, dx, dy = rng.choice(options)
            grid[y + dy // 2][x + dx // 2] = 0
            grid[ny][nx] = 0
            stack.append((nx, ny))
        else:
            stack.pop()
    separators = []
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            horizontal = grid[y][x - 1] == 0 and grid[y][x + 1] == 0
            vertical = grid[y - 1][x] == 0 and grid[y + 1][x] == 0
            if grid[y][x] == 1 and (horizontal or vertical):
                separators.append((x, y))
    rng.shuffle(separators)
    for x, y in separators[:int(len(separators) * braid)]:
        grid[y][x] = 0
    for x0, y0, x1, y1 in rooms:
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                grid[y][x] = 0
    for x in range(w):
        grid[0][x] = grid[-1][x] = 1
    for y in range(h):
        grid[y][0] = grid[y][-1] = 1
    return grid

def analyse(grid):
    queue = collections.deque([(1,1)])
    dist = {(1,1):0}
    while queue:
        x, y = queue.popleft()
        for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
            point = (x + dx, y + dy)
            if grid[point[1]][point[0]] != 1 and point not in dist:
                dist[point] = dist[(x,y)] + 1
                queue.append(point)
    exit_point = max(dist, key=dist.get)
    grid[exit_point[1]][exit_point[0]] = 2
    candidates = sorted(
        ((d,x,y) for (x,y),d in dist.items() if d > 8 and (x,y) != exit_point),
        reverse=True,
    )
    points = []
    for _, x, y in candidates:
        if all(abs(x-a) + abs(y-b) > 6 for a,b in points):
            points.append((x,y))
        if len(points) == 5:
            break
    assert len(points) == 5
    return exit_point, points, dist

def point(pair):
    return {'x':pair[0]+.5, 'y':pair[1]+.5}

def theme(wall, floor, ceiling, fog, distance, particles, scale=1):
    return {
        'wall':wall,
        'floor':floor,
        'ceiling':ceiling,
        'fogColor':fog,
        'fogDistance':distance,
        'particles':particles,
        'moveScale':scale,
    }

new_specs = [
    (41,'Aqua Utopia',25,19,4141,.24,[(7,6,13,10)],
     theme('frutiger','aqua','blueSky',[50,125,150],22,'bubbles',1.06),
     ['bubbleling','dolphin','aquaBot','frog'],'aquaOrb',
     'A glossy Frutiger Aero maze of blue glass, fresh water, bright grass colors, bubbles, and optimistic aquatic machines.'),
    (42,'Vertex Ward',25,19,4242,.16,[(8,6,16,11)],
     theme('psx','psx','static',[18,12,20],9,'mist',.94),
     ['polygonHound','staticWraith','lowPolyRat','crawler'],'polygonKey',
     'A deliberately unstable early-3D horror ward with affine-looking tiles, heavy fog, polygon beasts, and static spirits.'),
    (43,'Prism Cathedral',27,19,4343,.18,[(7,5,13,10),(17,9,23,13)],
     theme('stainedglass','prism','stainedglass',[55,48,65],17,'motes',1),
     ['glassKnight','prismMoth','glassGolem','dove'],'prismShard',
     'A stained-glass cathedral maze where colored panes, lead lines, prism moths, glass guardians, and doves catch the light.'),
    (44,'Nouveau Conservatory',25,21,4444,.22,[(7,7,17,13)],
     theme('nouveau','floralMosaic','nouveau',[46,65,49],16,'petals',1.02),
     ['vineNymph','moth','peacock','fox'],'nouveauBrooch',
     'An Art Nouveau conservatory of flowing floral lines, green glass, petals, foxes, moths, peacocks, and living vines.'),
    (45,'Sunleaf Habitat',27,21,4545,.25,[(6,6,12,11),(18,9,24,14)],
     theme('solarpunk','solar','canopySky',[39,100,70],20,'fireflies',1.08),
     ['butterfly','capybara','sunDrone','gecko'],'solarSeed',
     'A solarpunk habitat where clean panels, gardens, solar geometry, butterflies, capybaras, geckos, and helper drones coexist.'),
    (46,'Iron Zeppelin',27,19,4646,.18,[(8,5,14,10),(18,10,24,14)],
     theme('diesel','steel','diesel',[44,36,27],12,'smoke',.97),
     ['dieselTrooper','propellerDrone','sootGremlin','rat'],'dieselBadge',
     'A dieselpunk airship maze of riveted steel, propellers, smoke, uniformed sentries, soot gremlins, and engine-room rats.'),
    (47,'Primeval Caverns',25,21,4747,.2,[(7,7,17,13)],
     theme('prehistoric','cave','cave',[48,31,19],10,'embers',.9),
     ['raptor','mammoth','pterodactyl','caveBeetle'],'amberFossil',
     'A prehistoric cave maze of basalt, bones, amber light, raptors, mammoths, pterodactyls, and armored beetles.'),
    (48,'Knotstone Hollow',25,19,4848,.17,[(8,6,16,11)],
     theme('celtic','celtic','celtic',[25,46,34],14,'mist',.96),
     ['stag','banshee','raven','wolf'],'celticKnot',
     'A Celtic-inspired stone hollow of knotwork, spirals, standing stones, mist, stags, ravens, wolves, and a keening spirit.'),
    (49,'Concrete Twilight',27,19,4949,.23,[(7,5,13,9),(18,10,24,14)],
     theme('brutalist','concrete','concrete',[43,46,49],10,'rain',1),
     ['strayDog','pigeon','maintenanceBot','rat'],'metroToken',
     'A post-Soviet concrete maze of panel blocks, wet courtyards, utility lights, stray dogs, pigeons, maintenance bots, and rats.'),
    (50,'Inkbound Library',27,21,5050,.2,[(7,7,13,12),(18,8,24,14)],
     theme('storybook','paper','storybook',[57,45,32],18,'motes',1.03),
     ['inkFox','paperKnight','bookworm','quillSpirit'],'inkQuill',
     'A vintage storybook and VGA-inspired library maze of ink hatching, aged paper, foxes, paper knights, bookworms, and quill spirits.'),
]

new_levels = []
for idx,name,w,h,seed,braid,rooms,visual,types,relic,desc in new_specs:
    grid = maze(w,h,seed,braid,rooms)
    exit_point, points, dist = analyse(grid)
    level = {
        'index':idx,
        'name':name,
        'start':{'x':1.5,'y':1.5,'angle':0},
        'theme':visual,
        'creatureTypes':types,
        'creatureCount':len(types)*2,
        'relicType':relic,
        'inversions':[point(x) for x in points[:2]],
        'relics':[point(x) for x in points[2:]],
        'description':desc,
        'map':grid,
    }
    assert len(dist) == sum(v != 1 for row in grid for v in row)
    new_levels.append(level)
    rosters[idx] = types
    descriptions[idx] = desc
    print(idx, name, f'{len(dist)} reachable', exit_point, points)

relic_labels = {
    'disk':'data disks','pearl':'pearls','star':'star shards','ankh':'ankhs',
    'book':'lost books','heart':'Croatian heart tokens','crystal':'ice crystals',
    'fuse':'power fuses','gear':'clockwork gears','bone':'bone charms',
    'coin':'gold coins','crown':'crown jewels','medkit':'medical kits',
    'battery':'charged batteries','chip':'data chips','candy':'wrapped sweets',
    'laurel':'laurel tokens','compass':'compasses','badge':'sheriff badges',
    'idol':'jade idols','toykey':'toy keys','film':'film reels',
    'charm':'shrine charms','eye':'dream eyes','chalice':'golden chalices',
    'decoKey':'deco keys','jadeSeal':'jade seals','astrolabe':'astrolabes',
    'calendar':'calendar stones','sunstone':'sun stones','romanCoin':'Roman coins',
    'lotus':'lotus emblems','khmerLotus':'lotus carvings','goldweight':'gold weights',
    'rose':'garden roses','rune':'runestones','wayfinder':'wayfinding compasses',
    'mosaic':'mosaic tiles','jade':'jade rings','aquaOrb':'aqua orbs',
    'polygonKey':'polygon keys','prismShard':'prism shards',
    'nouveauBrooch':'floral brooches','solarSeed':'solar seeds',
    'dieselBadge':'airship badges','amberFossil':'amber fossils',
    'celticKnot':'knotstone tokens','metroToken':'metro tokens',
    'inkQuill':'enchanted quills',
}

def human(type_name):
    return re.sub(r'([a-z])([A-Z])', r'\1 \2', type_name).title()

updates = []
for idx in range(1, 41):
    text = (root / 'levels' / f'level{idx}.js').read_text(encoding='utf8')
    relic = re.search(r'relicType:\s*"([^"]+)"', text).group(1)
    types = rosters[idx]
    updates.append({
        'index':idx,
        'creatureTypes':types,
        'creatureCount':len(types)*2,
        'description':descriptions[idx],
        'creatureDescription':'; '.join(
            f'{human(t)} {effect_text[all_effects[t]]}' for t in types
        ) + '.',
        'powerupDescription':
            f'Collect three {relic_labels[relic]} for Overdrive. '
            'Cyan inversion anomalies flip the world; the green exit advances '
            'to the next sector.',
    })

for level in new_levels:
    types = level['creatureTypes']
    relic = level['relicType']
    level['creatureDescription'] = '; '.join(
        f'{human(t)} {effect_text[all_effects[t]]}' for t in types
    ) + '.'
    level['powerupDescription'] = (
        f'Collect three {relic_labels[relic]} for Overdrive. '
        'Cyan inversion anomalies flip the world; the green exit advances '
        'to the next sector.'
    )

Path('.content-expansion-plan.json').write_text(
    json.dumps(
        {'updates':updates,'newLevels':new_levels,'newEffects':new_effects},
        indent=2,
    ) + '\n',
    encoding='utf8',
)
print('wrote .content-expansion-plan.json')
