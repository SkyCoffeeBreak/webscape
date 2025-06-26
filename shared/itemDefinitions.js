// Shared item definitions for both client and server
// This ensures consistency and avoids duplication

const itemDefinitions = {
  // Currency
  coins: {
    id: 'coins',
    name: 'Coins',
    icon: '🪙',
    type: 'currency',
    description: 'The standard currency of the realm.',
    stackable: true,
    value: 1,
    buyable: false
  },
  gp: {
    id: 'gp',
    name: 'Gold Pieces',
    icon: '🪙',
    type: 'currency',
    description: 'Alternative name for coins.',
    stackable: true,
    value: 1,
    buyable: false
  },

  // Mining ores
  copper_ore: {
    id: 'copper_ore',
    name: 'Copper Ore',
    icon: '🟤',
    type: 'ore',
    description: 'Raw copper ore.',
    stackable: true,
    value: 5,
    buyable: false
  },
  tin_ore: {
    id: 'tin_ore',
    name: 'Tin Ore',
    icon: '⚪',
    type: 'ore',
    description: 'Raw tin ore.',
    stackable: true,
    value: 5,
    buyable: false
  },
  iron_ore: {
    id: 'iron_ore',
    name: 'Iron Ore',
    icon: '🔘',
    type: 'ore',
    description: 'Raw iron ore.',
    stackable: true,
    value: 10,
    buyable: false
  },
  coal: {
    id: 'coal',
    name: 'Coal',
    icon: '⚫',
    type: 'ore',
    description: 'Coal for smelting.',
    stackable: true,
    value: 15,
    buyable: false
  },
  silver_ore: {
    id: 'silver_ore',
    name: 'Silver Ore',
    icon: '⚪',
    type: 'ore',
    description: 'Raw silver ore.',
    stackable: true,
    value: 20,
    buyable: false
  },
  gold_ore: {
    id: 'gold_ore',
    name: 'Gold Ore',
    icon: '🟡',
    type: 'ore',
    description: 'Raw gold ore.',
    stackable: true,
    value: 25,
    buyable: false
  },
  mithril_ore: {
    id: 'mithril_ore',
    name: 'Mithril Ore',
    icon: '🔵',
    type: 'ore',
    description: 'Raw mithril ore.',
    stackable: true,
    value: 50,
    buyable: false
  },
  adamantite_ore: {
    id: 'adamantite_ore',
    name: 'Adamantite Ore',
    icon: '🟢',
    type: 'ore',
    description: 'Raw adamantite ore.',
    stackable: true,
    value: 100,
    buyable: false
  },
  runite_ore: {
    id: 'runite_ore',
    name: 'Runite Ore',
    icon: '🔴',
    type: 'ore',
    description: 'Raw runite ore.',
    stackable: true,
    value: 200,
    buyable: false
  },

  // Smelted bars
  bronze_bar: {
    id: 'bronze_bar',
    name: 'Bronze Bar',
    icon: '🟫',
    type: 'bar',
    description: 'A bronze bar.',
    stackable: true,
    value: 15,
    buyable: false
  },
  iron_bar: {
    id: 'iron_bar',
    name: 'Iron Bar',
    icon: '⬜',
    type: 'bar',
    description: 'An iron bar.',
    stackable: true,
    value: 25,
    buyable: false
  },
  steel_bar: {
    id: 'steel_bar',
    name: 'Steel Bar',
    icon: '⬛',
    type: 'bar',
    description: 'A steel bar.',
    stackable: true,
    value: 50,
    buyable: false
  },
  gold_bar: {
    id: 'gold_bar',
    name: 'Gold Bar',
    icon: '🟨',
    type: 'bar',
    description: 'A gold bar.',
    stackable: true,
    value: 75,
    buyable: false
  },
  mithril_bar: {
    id: 'mithril_bar',
    name: 'Mithril Bar',
    icon: '🟦',
    type: 'bar',
    description: 'A mithril bar.',
    stackable: true,
    value: 150,
    buyable: false
  },
  adamantite_bar: {
    id: 'adamantite_bar',
    name: 'Adamantite Bar',
    icon: '🟩',
    type: 'bar',
    description: 'An adamantite bar.',
    stackable: true,
    value: 300,
    buyable: false
  },
  runite_bar: {
    id: 'runite_bar',
    name: 'Runite Bar',
    icon: '🟥',
    type: 'bar',
    description: 'A runite bar.',
    stackable: true,
    value: 600,
    buyable: false
  },

  // Magic runes - All stackable
  fire_rune: {
    id: 'fire_rune',
    name: 'Fire Rune',
    icon: '🔥',
    type: 'rune',
    description: 'A rune imbued with fire magic.',
    stackable: true,
    value: 5,
    buyable: true
  },
  water_rune: {
    id: 'water_rune',
    name: 'Water Rune',
    icon: '💧',
    type: 'rune',
    description: 'A rune imbued with water magic.',
    stackable: true,
    value: 5,
    buyable: true
  },
  air_rune: {
    id: 'air_rune',
    name: 'Air Rune',
    icon: '💨',
    type: 'rune',
    description: 'A rune imbued with air magic.',
    stackable: true,
    value: 5,
    buyable: true
  },
  earth_rune: {
    id: 'earth_rune',
    name: 'Earth Rune',
    icon: '🌍',
    type: 'rune',
    description: 'A rune imbued with earth magic.',
    stackable: true,
    value: 5,
    buyable: true
  },
  mind_rune: {
    id: 'mind_rune',
    name: 'Mind Rune',
    icon: '🧠',
    type: 'rune',
    description: 'A rune imbued with mind magic.',
    stackable: true,
    value: 10,
    buyable: true
  },
  body_rune: {
    id: 'body_rune',
    name: 'Body Rune',
    icon: '👤',
    type: 'rune',
    description: 'A rune imbued with body magic.',
    stackable: true,
    value: 10,
    buyable: true
  },
  cosmic_rune: {
    id: 'cosmic_rune',
    name: 'Cosmic Rune',
    icon: '🌌',
    type: 'rune',
    description: 'A rune imbued with cosmic magic.',
    stackable: true,
    value: 25,
    buyable: true
  },
  chaos_rune: {
    id: 'chaos_rune',
    name: 'Chaos Rune',
    icon: '⚡',
    type: 'rune',
    description: 'A rune imbued with chaos magic.',
    stackable: true,
    value: 25,
    buyable: true
  },
  nature_rune: {
    id: 'nature_rune',
    name: 'Nature Rune',
    icon: '🌿',
    type: 'rune',
    description: 'A rune imbued with nature magic.',
    stackable: true,
    value: 50,
    buyable: true
  },
  law_rune: {
    id: 'law_rune',
    name: 'Law Rune',
    icon: '⚖️',
    type: 'rune',
    description: 'A rune imbued with law magic.',
    stackable: true,
    value: 75,
    buyable: true
  },
  death_rune: {
    id: 'death_rune',
    name: 'Death Rune',
    icon: '💀',
    type: 'rune',
    description: 'A rune imbued with death magic.',
    stackable: true,
    value: 100,
    buyable: true
  },
  blood_rune: {
    id: 'blood_rune',
    name: 'Blood Rune',
    icon: '🩸',
    type: 'rune',
    description: 'A rune imbued with blood magic.',
    stackable: true,
    value: 150,
    buyable: true
  },
  soul_rune: {
    id: 'soul_rune',
    name: 'Soul Rune',
    icon: '👻',
    type: 'rune',
    description: 'A rune imbued with soul magic.',
    stackable: true,
    value: 200,
    buyable: true
  },
  wrath_rune: {
    id: 'wrath_rune',
    name: 'Wrath Rune',
    icon: '😡',
    type: 'rune',
    description: 'A rune imbued with wrath magic.',
    stackable: true,
    value: 250,
    buyable: true
  },

  // Scribing materials - Paper pulp
  paper_pulp: {
    id: 'paper_pulp',
    name: 'Paper Pulp',
    icon: '🟤',
    type: 'material',
    description: 'Basic pulp made from wood fibers.',
    stackable: true,
    value: 10,
    buyable: false
  },
  fine_paper_pulp: {
    id: 'fine_paper_pulp',
    name: 'Fine Paper Pulp',
    icon: '🟤',
    type: 'material',
    description: 'High-quality pulp made from fine wood fibers.',
    stackable: true,
    value: 25,
    buyable: false
  },
  premium_paper_pulp: {
    id: 'premium_paper_pulp',
    name: 'Premium Paper Pulp',
    icon: '🟤',
    type: 'material',
    description: 'High-quality pulp made from exotic palm fibers.',
    stackable: true,
    value: 75,
    buyable: false
  },
  mystic_paper_pulp: {
    id: 'mystic_paper_pulp',
    name: 'Mystic Paper Pulp',
    icon: '✨',
    type: 'material',
    description: 'Magically infused pulp that shimmers with arcane energy.',
    stackable: true,
    value: 150,
    buyable: false
  },

  // Scribing products - Paper
  paper: {
    id: 'paper',
    name: 'Paper',
    icon: '📄',
    type: 'material',
    description: 'Basic paper made from wooden pulp.',
    stackable: true,
    value: 20,
    buyable: true
  },
  fine_paper: {
    id: 'fine_paper',
    name: 'Fine Paper',
    icon: '📄',
    type: 'material',
    description: 'High-quality paper made from fine pulp.',
    stackable: true,
    value: 75,
    buyable: true
  },
  premium_paper: {
    id: 'premium_paper',
    name: 'Premium Paper',
    icon: '📄',
    type: 'material',
    description: 'Premium-grade paper with exceptional quality.',
    stackable: true,
    value: 150,
    buyable: true
  },
  mystic_paper: {
    id: 'mystic_paper',
    name: 'Mystic Paper',
    icon: '✨',
    type: 'material',
    description: 'Magical paper that glows with arcane energy.',
    stackable: true,
    value: 250,
    buyable: false
  },

  // Logs - Non-stackable (woodcutting system compatible IDs)
  wooden_log: {
    id: 'wooden_log',
    name: 'Wooden Log',
    icon: '🪵',
    type: 'log',
    description: 'A log from a regular tree.',
    stackable: false,
    value: 5,
    buyable: false
  },
  oak_log: {
    id: 'oak_log',
    name: 'Oak Log',
    icon: '🟫',
    type: 'log',
    description: 'A sturdy log from an oak tree.',
    stackable: false,
    value: 10,
    buyable: false
  },
  pine_log: {
    id: 'pine_log',
    name: 'Pine Log',
    icon: '🪵',
    type: 'log',
    description: 'A log from a pine tree.',
    stackable: false,
    value: 15,
    buyable: false
  },
  palm_log: {
    id: 'palm_log',
    name: 'Palm Log',
    icon: '🥥',
    type: 'log',
    description: 'A log from a palm tree.',
    stackable: false,
    value: 20,
    buyable: false
  },
  bamboo_log: {
    id: 'bamboo_log',
    name: 'Bamboo Log',
    icon: '🎋',
    type: 'log',
    description: 'A flexible bamboo log, perfect for paper making.',
    stackable: false,
    value: 12,
    buyable: false
  },
  magic_log: {
    id: 'magic_log',
    name: 'Magic Log',
    icon: '🪵',
    type: 'log',
    description: 'A log infused with magical energy, highly prized for special papers.',
    stackable: false,
    value: 100,
    buyable: false
  },
  
  // Legacy log IDs (keeping for compatibility)
  logs: {
    id: 'logs',
    name: 'Logs',
    icon: '🪵',
    type: 'log',
    description: 'Regular logs from trees.',
    stackable: false,
    value: 5,
    buyable: false
  },
  oak_logs: {
    id: 'oak_logs',
    name: 'Oak Logs',
    icon: '🪵',
    type: 'log',
    description: 'Sturdy oak logs.',
    stackable: false,
    value: 10,
    buyable: false
  },
  willow_logs: {
    id: 'willow_logs',
    name: 'Willow Logs',
    icon: '🪵',
    type: 'log',
    description: 'Flexible willow logs.',
    stackable: false,
    value: 15,
    buyable: false
  },
  maple_logs: {
    id: 'maple_logs',
    name: 'Maple Logs',
    icon: '🪵',
    type: 'log',
    description: 'Hard maple logs.',
    stackable: false,
    value: 25,
    buyable: false
  },
  yew_logs: {
    id: 'yew_logs',
    name: 'Yew Logs',
    icon: '🪵',
    type: 'log',
    description: 'Valuable yew logs.',
    stackable: false,
    value: 50,
    buyable: false
  },
  magic_logs: {
    id: 'magic_logs',
    name: 'Magic Logs',
    icon: '🪵',
    type: 'log',
    description: 'Magical logs with mystical properties.',
    stackable: false,
    value: 100,
    buyable: false
  },

  // Digging materials - Stackable
  dirt: {
    id: 'dirt',
    name: 'Dirt',
    icon: '🟫',
    type: 'material',
    description: 'Dry dirt.',
    stackable: false,
    value: 2,
    buyable: false
  },
  sand: {
    id: 'sand',
    name: 'Sand',
    icon: '🟡',
    type: 'material',
    description: 'Fine sand. Used in glassmaking.',
    stackable: false,
    value: 3,
    buyable: false
  },
  gravel: {
    id: 'gravel',
    name: 'Gravel',
    icon: '◦',
    type: 'material',
    description: 'Small stones and pebbles. Used in construction.',
    stackable: false,
    value: 5,
    buyable: false
  },
  snow: {
    id: 'snow',
    name: 'Snow',
    icon: '❄️',
    type: 'material',
    description: 'Cold, fluffy snow. Melts when warmed.',
    stackable: false,
    value: 2,
    buyable: false
  },
  mud: {
    id: 'mud',
    name: 'Mud',
    icon: '🟤',
    type: 'material',
    description: 'Wet, sticky mud. Useful for building.',
    stackable: false,
    value: 6,
    buyable: false
  },
  swamp_soil: {
    id: 'swamp_soil',
    name: 'Swamp Soil',
    icon: '🫧',
    type: 'material',
    description: 'Rich, dark soil from swamplands. Excellent for gardening.',
    stackable: false,
    value: 12,
    buyable: false
  },
  frozen_soil: {
    id: 'frozen_soil',
    name: 'Frozen Soil',
    icon: '🧊',
    type: 'material',
    description: 'Permanently frozen ground from the tundra.',
    stackable: false,
    value: 15,
    buyable: false
  },
  sandstone: {
    id: 'sandstone',
    name: 'Sandstone',
    icon: '🧱',
    type: 'material',
    description: 'Sedimentary rock formed from sand. Used in construction.',
    stackable: false,
    value: 18,
    buyable: false
  },
  moss_covered_rock: {
    id: 'moss_covered_rock',
    name: 'Moss Covered Rock',
    icon: '🪨',
    type: 'material',
    description: 'Ancient stone covered in moss. Has mysterious properties.',
    stackable: false,
    value: 25,
    buyable: false
  },
  volcanic_ash: {
    id: 'volcanic_ash',
    name: 'Volcanic Ash',
    icon: '🌋',
    type: 'material',
    description: 'Fine ash from volcanic activity. Contains minerals.',
    stackable: false,
    value: 35,
    buyable: false
  },
  ancient_stone: {
    id: 'ancient_stone',
    name: 'Ancient Stone',
    icon: '🗿',
    type: 'material',
    description: 'Mysterious stone from ancient civilizations. Very valuable.',
    stackable: false,
    value: 50,
    buyable: false
  },

  // Clay materials - Essential for Pottery and Masonry
  clay: {
    id: 'clay',
    name: 'Clay',
    icon: '🟤',
    type: 'clay',
    description: 'Soft, malleable clay. Perfect for pottery and basic construction.',
    stackable: false,
    value: 8,
    buyable: false
  },
  fire_clay: {
    id: 'fire_clay',
    name: 'Fire Clay',
    icon: '🔥',
    type: 'clay',
    description: 'Heat-resistant clay that withstands extreme temperatures. Perfect for kilns and furnaces.',
    stackable: false,
    value: 18,
    buyable: false
  },
  cambrian_clay: {
    id: 'cambrian_clay',
    name: 'Cambrian Clay',
    icon: '🌊',
    type: 'clay',
    description: 'Ancient clay from primordial seas. Contains unique fossilized minerals.',
    stackable: false,
    value: 28,
    buyable: false
  },
  white_clay: {
    id: 'white_clay',
    name: 'White Clay',
    icon: '⚪',
    type: 'clay',
    description: 'Pure white clay of exceptional quality. Creates beautiful ceramics.',
    stackable: false,
    value: 38,
    buyable: false
  },
  black_clay: {
    id: 'black_clay',
    name: 'Black Clay',
    icon: '⚫',
    type: 'clay',
    description: 'Dense black clay with mysterious properties. Used in advanced masonry.',
    stackable: false,
    value: 55,
    buyable: false
  },
  sacred_clay: {
    id: 'sacred_clay',
    name: 'Sacred Clay',
    icon: '✨',
    type: 'clay',
    description: 'Legendary clay blessed by ancient spirits. The finest crafting material.',
    stackable: false,
    value: 80,
    buyable: false
  },

  // Fish - Stackable
  raw_shrimps: {
    id: 'raw_shrimps',
    name: 'Raw Shrimp',
    icon: '🦐',
    type: 'fish',
    description: 'Raw shrimp.',
    stackable: false,
    value: 15,
    buyable: false
  },
  raw_sardine: {
    id: 'raw_sardine',
    name: 'Raw Sardine',
    icon: '🐟',
    type: 'fish',
    description: 'Raw sardine.',
    stackable: false,
    value: 25,
    buyable: false
  },
  raw_herring: {
    id: 'raw_herring',
    name: 'Raw Herring',
    icon: '🐟',
    type: 'fish',
    description: 'Raw herring.',
    stackable: false,
    value: 35,
    buyable: false
  },
  raw_anchovies: {
    id: 'raw_anchovies',
    name: 'Raw Anchovies',
    icon: '🐟',
    type: 'fish',
    description: 'Raw anchovies.',
    stackable: false,
    value: 35,
    buyable: false
  },
  raw_tuna: {
    id: 'raw_tuna',
    name: 'Raw Tuna',
    icon: '🐟',
    type: 'fish',
    description: 'Raw tuna.',
    stackable: false,
    value: 55,
    buyable: false
  },
  raw_lobster: {
    id: 'raw_lobster',
    name: 'Raw Lobster',
    icon: '🦞',
    type: 'fish',
    description: 'Raw lobster.',
    stackable: false,
    value: 125,
    buyable: false
  },
  raw_swordfish: {
    id: 'raw_swordfish',
    name: 'Raw Swordfish',
    icon: '🐟',
    type: 'fish',
    description: 'Raw swordfish.',
    stackable: false,
    value: 140,
    buyable: false
  },
  raw_shark: {
    id: 'raw_shark',
    name: 'Raw Shark',
    icon: '🦈',
    type: 'fish',
    description: 'Raw shark.',
    stackable: false,
    value: 275,
    buyable: false
  },

  // Cooked fish - Stackable
  shrimps: {
    id: 'shrimps',
    name: 'Shrimp',
    icon: '🍤',
    type: 'food',
    description: 'Cooked shrimp. Restores a small amount of health.',
    stackable: false,
    value: 5,
    buyable: false,
    useAction: 'eat',
    heals: 3
  },
  sardine: {
    id: 'sardine',
    name: 'Sardine',
    icon: '🐟',
    type: 'food',
    description: 'Cooked sardine. Restores a small amount of health.',
    stackable: false,
    value: 8,
    buyable: false,
    useAction: 'eat',
    heals: 4
  },
  herring: {
    id: 'herring',
    name: 'Herring',
    icon: '🐟',
    type: 'food',
    description: 'Cooked herring. Restores health.',
    stackable: false,
    value: 12,
    buyable: false,
    useAction: 'eat',
    heals: 5
  },
  anchovies: {
    id: 'anchovies',
    name: 'Anchovies',
    icon: '🐟',
    type: 'food',
    description: 'Cooked anchovies. Restores a small amount of health.',
    stackable: false,
    value: 18,
    buyable: false,
    useAction: 'eat',
    heals: 3
  },
  tuna: {
    id: 'tuna',
    name: 'Tuna',
    icon: '🐟',
    type: 'food',
    description: 'Cooked tuna. Restores a decent amount of health.',
    stackable: false,
    value: 35,
    buyable: false,
    useAction: 'eat',
    heals: 10
  },
  lobster: {
    id: 'lobster',
    name: 'Lobster',
    icon: '🦞',
    type: 'food',
    description: 'Cooked lobster. Restores a good amount of health.',
    stackable: false,
    value: 60,
    buyable: false,
    useAction: 'eat',
    heals: 12
  },
  swordfish: {
    id: 'swordfish',
    name: 'Swordfish',
    icon: '🐟',
    type: 'food',
    description: 'Cooked swordfish. Restores a lot of health.',
    stackable: false,
    value: 95,
    buyable: false,
    useAction: 'eat',
    heals: 14
  },
  shark: {
    id: 'shark',
    name: 'Shark',
    icon: '🦈',
    type: 'food',
    description: 'Cooked shark. Restores a great amount of health.',
    stackable: false,
    value: 180,
    buyable: false,
    useAction: 'eat',
    heals: 20
  },
  burnt_food: {
    id: 'burnt_food',
    name: 'Burnt Food',
    icon: '🔥',
    type: 'junk',
    description: 'Badly burnt food. Completely inedible.',
    stackable: false,
    value: 1,
    buyable: false
  },

  // Harvesting items
  apple: {
    id: 'apple',
    name: 'Apple',
    icon: '🍎',
    type: 'food',
    description: 'A fresh, crisp apple harvested from an apple tree.',
    stackable: false,
    value: 15,
    buyable: true,
    useAction: 'eat',
    heals: 5
  },
  cherry: {
    id: 'cherry',
    name: 'Cherry',
    icon: '🍒',
    type: 'food',
    description: 'Sweet cherries picked from a cherry tree.',
    stackable: false,
    value: 25,
    buyable: true,
    useAction: 'eat',
    heals: 3
  },
  peach: {
    id: 'peach',
    name: 'Peach',
    icon: '🍑',
    type: 'food',
    description: 'A juicy peach with soft, fuzzy skin.',
    stackable: false,
    value: 35,
    buyable: true,
    useAction: 'eat',
    heals: 8
  },
  mushroom: {
    id: 'mushroom',
    name: 'Mushroom',
    icon: '🍄',
    type: 'food',
    description: 'A common mushroom found growing in patches.',
    stackable: false,
    value: 20,
    buyable: true,
    useAction: 'eat',
    heals: 4
  },
  wheat: {
    id: 'wheat',
    name: 'Wheat',
    icon: '🌾',
    type: 'material',
    description: 'Golden wheat stalks ready for processing into flour.',
    stackable: true,
    value: 10,
    buyable: true
  },

  // Tools - Non-stackable
  bronze_pickaxe: {
    id: 'bronze_pickaxe',
    name: 'Bronze Pickaxe',
    icon: '⛏️',
    type: 'tool',
    description: 'A basic pickaxe for mining.',
    stackable: false,
    value: 100,
    buyable: true
  },
  iron_pickaxe: {
    id: 'iron_pickaxe',
    name: 'Iron Pickaxe',
    icon: '⛏️',
    type: 'tool',
    description: 'A sturdy iron pickaxe.',
    stackable: false,
    value: 250,
    buyable: true
  },
  steel_pickaxe: {
    id: 'steel_pickaxe',
    name: 'Steel Pickaxe',
    icon: '⛏️',
    type: 'tool',
    description: 'A sharp steel pickaxe.',
    stackable: false,
    value: 500,
    buyable: true
  },
  mithril_pickaxe: {
    id: 'mithril_pickaxe',
    name: 'Mithril Pickaxe',
    icon: '⛏️',
    type: 'tool',
    description: 'A lightweight mithril pickaxe.',
    stackable: false,
    value: 1000,
    buyable: true
  },
  adamantite_pickaxe: {
    id: 'adamantite_pickaxe',
    name: 'Adamantite Pickaxe',
    icon: '⛏️',
    type: 'tool',
    description: 'A durable adamantite pickaxe.',
    stackable: false,
    value: 2000,
    buyable: true
  },
  runite_pickaxe: {
    id: 'runite_pickaxe',
    name: 'Runite Pickaxe',
    icon: '⛏️',
    type: 'tool',
    description: 'The finest runite pickaxe.',
    stackable: false,
    value: 4000,
    buyable: true
  },

  bronze_axe: {
    id: 'bronze_axe',
    name: 'Bronze Axe',
    icon: '🪓',
    type: 'tool',
    description: 'A basic axe for chopping trees.',
    stackable: false,
    value: 100,
    buyable: true
  },
  iron_axe: {
    id: 'iron_axe',
    name: 'Iron Axe',
    icon: '🪓',
    type: 'tool',
    description: 'A sturdy iron axe.',
    stackable: false,
    value: 250,
    buyable: true
  },
  steel_axe: {
    id: 'steel_axe',
    name: 'Steel Axe',
    icon: '🪓',
    type: 'tool',
    description: 'A sharp steel axe.',
    stackable: false,
    value: 500,
    buyable: true
  },
  mithril_axe: {
    id: 'mithril_axe',
    name: 'Mithril Axe',
    icon: '🪓',
    type: 'tool',
    description: 'A lightweight mithril axe.',
    stackable: false,
    value: 1000,
    buyable: true
  },
  adamantite_axe: {
    id: 'adamantite_axe',
    name: 'Adamantite Axe',
    icon: '🪓',
    type: 'tool',
    description: 'A durable adamantite axe.',
    stackable: false,
    value: 2000,
    buyable: true
  },
  runite_axe: {
    id: 'runite_axe',
    name: 'Runite Axe',
    icon: '🪓',
    type: 'tool',
    description: 'The finest runite axe.',
    stackable: false,
    value: 4000,
    buyable: true
  },

  // Digging shovels - Non-stackable
  bronze_shovel: {
    id: 'bronze_shovel',
    name: 'Bronze Shovel',
    icon: '🪏',
    type: 'tool',
    description: 'A basic shovel for digging.',
    stackable: false,
    value: 75,
    buyable: true,
    useAction: 'dig'
  },
  iron_shovel: {
    id: 'iron_shovel',
    name: 'Iron Shovel',
    icon: '🪏',
    type: 'tool',
    description: 'A sturdy iron shovel.',
    stackable: false,
    value: 200,
    buyable: true,
    useAction: 'dig'
  },
  steel_shovel: {
    id: 'steel_shovel',
    name: 'Steel Shovel',
    icon: '🪏',
    type: 'tool',
    description: 'A sharp steel shovel.',
    stackable: false,
    value: 400,
    buyable: true,
    useAction: 'dig'
  },
  mithril_shovel: {
    id: 'mithril_shovel',
    name: 'Mithril Shovel',
    icon: '🪏',
    type: 'tool',
    description: 'A lightweight mithril shovel.',
    stackable: false,
    value: 800,
    buyable: true,
    useAction: 'dig'
  },
  adamantite_shovel: {
    id: 'adamantite_shovel',
    name: 'Adamantite Shovel',
    icon: '🪏',
    type: 'tool',
    description: 'A durable adamantite shovel.',
    stackable: false,
    value: 1600,
    buyable: true,
    useAction: 'dig'
  },
  runite_shovel: {
    id: 'runite_shovel',
    name: 'Runite Shovel',
    icon: '🪏',
    type: 'tool',
    description: 'The finest runite shovel.',
    stackable: false,
    value: 3200,
    buyable: true,
    useAction: 'dig'
  },

  // Fletching knives - Non-stackable
  bronze_knife: {
    id: 'bronze_knife',
    name: 'Bronze Knife',
    icon: '🔪',
    type: 'tool',
    description: 'A basic knife for fletching.',
    stackable: false,
    value: 50,
    buyable: true
  },
  iron_knife: {
    id: 'iron_knife',
    name: 'Iron Knife',
    icon: '🔪',
    type: 'tool',
    description: 'A sturdy iron knife.',
    stackable: false,
    value: 125,
    buyable: true
  },
  steel_knife: {
    id: 'steel_knife',
    name: 'Steel Knife',
    icon: '🔪',
    type: 'tool',
    description: 'A sharp steel knife.',
    stackable: false,
    value: 250,
    buyable: true
  },
  mithril_knife: {
    id: 'mithril_knife',
    name: 'Mithril Knife',
    icon: '🔪',
    type: 'tool',
    description: 'A lightweight mithril knife.',
    stackable: false,
    value: 500,
    buyable: true
  },
  adamantite_knife: {
    id: 'adamantite_knife',
    name: 'Adamantite Knife',
    icon: '🔪',
    type: 'tool',
    description: 'A durable adamantite knife.',
    stackable: false,
    value: 1000,
    buyable: true
  },

  // Fishing equipment - Non-stackable
  small_net: {
    id: 'small_net',
    name: 'Small Net',
    icon: '🕸️',
    type: 'tool',
    description: 'A small net for catching shrimp and other small fish.',
    stackable: false,
    value: 50,
    buyable: true
  },
  fishing_rod: {
    id: 'fishing_rod',
    name: 'Fishing Rod',
    icon: '🎣',
    type: 'tool',
    description: 'A basic fishing rod for catching fish.',
    stackable: false,
    value: 150,
    buyable: true
  },
  big_net: {
    id: 'big_net',
    name: 'Big Net',
    icon: '🕷️',
    type: 'tool',
    description: 'A large net for catching anchovies and similar fish.',
    stackable: false,
    value: 400,
    buyable: true
  },
  harpoon: {
    id: 'harpoon',
    name: 'Harpoon',
    icon: '🔱',
    type: 'tool',
    description: 'A sharp harpoon for catching large fish like tuna and swordfish.',
    stackable: false,
    value: 800,
    buyable: true
  },
  lobster_pot: {
    id: 'lobster_pot',
    name: 'Lobster Pot',
    icon: '🪣',
    type: 'tool',
    description: 'A specialized pot for catching lobsters.',
    stackable: false,
    value: 1000,
    buyable: true
  },

  // Fletching bows - Non-stackable
  shortbow: {
    id: 'shortbow',
    name: 'Shortbow',
    icon: '🏹',
    type: 'weapon',
    description: 'A basic shortbow.',
    stackable: false,
    value: 25,
    buyable: false
  },
  longbow: {
    id: 'longbow',
    name: 'Longbow',
    icon: '🏹',
    type: 'weapon',
    description: 'A basic longbow.',
    stackable: false,
    value: 50,
    buyable: false
  },
  oak_shortbow: {
    id: 'oak_shortbow',
    name: 'Oak Shortbow',
    icon: '🏹',
    type: 'weapon',
    description: 'A sturdy oak shortbow.',
    stackable: false,
    value: 75,
    buyable: false
  },
  oak_longbow: {
    id: 'oak_longbow',
    name: 'Oak Longbow',
    icon: '🏹',
    type: 'weapon',
    description: 'A sturdy oak longbow.',
    stackable: false,
    value: 150,
    buyable: false
  },
  willow_shortbow: {
    id: 'willow_shortbow',
    name: 'Willow Shortbow',
    icon: '🏹',
    type: 'weapon',
    description: 'A flexible willow shortbow.',
    stackable: false,
    value: 200,
    buyable: false
  },
  willow_longbow: {
    id: 'willow_longbow',
    name: 'Willow Longbow',
    icon: '🏹',
    type: 'weapon',
    description: 'A flexible willow longbow.',
    stackable: false,
    value: 400,
    buyable: false
  },

  // Additional items from inventory.js that were missing
  'wooden_knife': {
    id: 'wooden_knife',
    name: 'Wooden Knife',
    icon: '🔪',
    type: 'tool',
    description: 'A basic wooden knife for fletching. Crude but functional.',
    stackable: false,
    value: 10,
    buyable: true
  },
  'stone_knife': {
    id: 'stone_knife',
    name: 'Stone Knife',
    icon: '🔪',
    type: 'tool',
    description: 'A primitive stone knife. Better than wood.',
    stackable: false,
    value: 25,
    buyable: true
  },
  'copper_knife': {
    id: 'copper_knife',
    name: 'Copper Knife',
    icon: '🔪',
    type: 'tool',
    description: 'A knife made from copper, showing decent craftsmanship.',
    stackable: false,
    value: 35,
    buyable: true
  },
  'darksteel_knife': {
    id: 'darksteel_knife',
    name: 'Darksteel Knife',
    icon: '🔪',
    type: 'tool',
    description: 'A knife forged from darkened steel, with enhanced precision.',
    stackable: false,
    value: 400,
    buyable: true
  },
  'silver_knife': {
    id: 'silver_knife',
    name: 'Silver Knife',
    icon: '🔪',
    type: 'tool',
    description: 'A gleaming silver knife with magical properties.',
    stackable: false,
    value: 600,
    buyable: true,
    colorTint: '#C0D6E4'
  },
  'gold_knife': {
    id: 'gold_knife',
    name: 'Gold Knife',
    icon: '🔪',
    type: 'tool',
    description: 'A luxurious golden knife that enhances fletching precision.',
    stackable: false,
    value: 900,
    buyable: true,
    colorTint: '#FFD700'
  },
  'cobalt_knife': {
    id: 'cobalt_knife',
    name: 'Cobalt Knife',
    icon: '🔪',
    type: 'tool',
    description: 'A knife forged from rare cobalt, radiating blue energy.',
    stackable: false,
    value: 1400,
    buyable: true,
    colorTint: '#0047AB'
  },
  'titanium_knife': {
    id: 'titanium_knife',
    name: 'Titanium Knife',
    icon: '🔪',
    type: 'tool',
    description: 'An incredibly durable titanium knife for master fletchers.',
    stackable: false,
    value: 2100,
    buyable: true,
    colorTint: '#001F3F'
  },
  'dragonbone_knife': {
    id: 'dragonbone_knife',
    name: 'Dragonbone Knife',
    icon: '🔪',
    type: 'tool',
    description: 'A knife carved from ancient dragonbone, imbued with draconic power.',
    stackable: false,
    value: 3000,
    buyable: false,
    colorTint: '#F5F5DC'
  },
  'meteor_knife': {
    id: 'meteor_knife',
    name: 'Meteor Knife',
    icon: '🔪',
    type: 'tool',
    description: 'Forged from meteoric metal, this knife channels cosmic energy.',
    stackable: false,
    value: 4500,
    buyable: false,
    colorTint: '#6A0DAD'
  },
  'lunar_knife': {
    id: 'lunar_knife',
    name: 'Lunar Knife',
    icon: '🔪',
    type: 'tool',
    description: 'The ultimate fletching knife, blessed by lunar magic.',
    stackable: false,
    value: 7500,
    buyable: false,
    colorTint: '#88E1F2'
  },

  // Books and scrolls from inventory.js
  'beginner_cookbook': {
    id: 'beginner_cookbook',
    name: 'Beginner Cookbook',
    icon: '📚',
    stackable: false,
    description: 'A collection of simple cooking recipes.',
    useAction: 'read',
    value: 50,
    category: 'books'
  },
  'basic_herbalism': {
    id: 'basic_herbalism',
    name: 'Basic Herbalism',
    icon: '📚',
    stackable: false,
    description: 'A guide to identifying and using common herbs.',
    useAction: 'read',
    value: 75,
    category: 'books'
  },
  'woodcutting_guide': {
    id: 'woodcutting_guide',
    name: 'Woodcutting Guide',
    icon: '📚',
    stackable: false,
    description: 'Essential techniques for felling trees efficiently.',
    useAction: 'read',
    value: 100,
    category: 'books'
  },
  'fishing_handbook': {
    id: 'fishing_handbook',
    name: 'Fishing Handbook',
    icon: '📚',
    stackable: false,
    description: 'A comprehensive guide to fishing techniques.',
    useAction: 'read',
    value: 125,
    category: 'books'
  },
  'advanced_mining': {
    id: 'advanced_mining',
    name: 'Advanced Mining',
    icon: '📚',
    stackable: false,
    description: 'Advanced techniques for mining rare ores.',
    useAction: 'read',
    value: 200,
    category: 'books'
  },
  'combat_tactics': {
    id: 'combat_tactics',
    name: 'Combat Tactics',
    icon: '📚',
    stackable: false,
    description: 'Strategic approaches to combat and warfare.',
    useAction: 'read',
    value: 250,
    category: 'books'
  },
  'magical_theory': {
    id: 'magical_theory',
    name: 'Magical Theory',
    icon: '📚',
    stackable: false,
    description: 'Fundamental principles of magical practice.',
    useAction: 'read',
    value: 300,
    category: 'books'
  },
  'alchemy_guide': {
    id: 'alchemy_guide',
    name: 'Alchemy Guide',
    icon: '📚',
    stackable: false,
    description: 'The art of transmutation and potion brewing.',
    useAction: 'read',
    value: 400,
    category: 'books'
  },
  'beast_compendium': {
    id: 'beast_compendium',
    name: 'Beast Compendium',
    icon: '📚',
    stackable: false,
    description: 'A detailed study of creatures and their behaviors.',
    useAction: 'read',
    value: 500,
    category: 'books'
  },
  'master_smithing': {
    id: 'master_smithing',
    name: 'Master Smithing',
    icon: '📚',
    stackable: false,
    description: 'Advanced metalworking and weapon crafting.',
    useAction: 'read',
    value: 750,
    category: 'books'
  },
  'ancient_lore': {
    id: 'ancient_lore',
    name: 'Ancient Lore',
    icon: '📚',
    stackable: false,
    description: 'Lost knowledge from forgotten civilizations.',
    useAction: 'read',
    value: 1000,
    category: 'books'
  },
  'legendary_tales': {
    id: 'legendary_tales',
    name: 'Legendary Tales',
    icon: '📚',
    stackable: false,
    description: 'Epic stories of heroes and legends.',
    useAction: 'read',
    value: 1500,
    category: 'books'
  },
  'comprehensive_encyclopedia': {
    id: 'comprehensive_encyclopedia',
    name: 'Comprehensive Encyclopedia',
    icon: '📚',
    stackable: false,
    description: 'A vast collection of knowledge on all subjects.',
    useAction: 'read',
    value: 2000,
    category: 'books'
  },
  'master_artificer_guide': {
    id: 'master_artificer_guide',
    name: 'Master Artificer Guide',
    icon: '📚',
    stackable: false,
    description: 'The ultimate guide to creating magical artifacts.',
    useAction: 'read',
    value: 3000,
    category: 'books'
  },
  'tome_of_infinite_wisdom': {
    id: 'tome_of_infinite_wisdom',
    name: 'Tome of Infinite Wisdom',
    icon: '📚',
    stackable: false,
    description: 'Contains the deepest mysteries of the universe.',
    useAction: 'read',
    value: 5000,
    category: 'books'
  },

  // === NEW BOOKS (20 additions) ===
  
  // Beginner to Intermediate Books
  'farmers_almanac': {
    id: 'farmers_almanac',
    name: 'Farmer\'s Almanac',
    icon: '📚',
    stackable: false,
    description: 'Essential knowledge for cultivating crops and understanding seasons.',
    useAction: 'read',
    value: 85,
    category: 'books'
  },
  'apprentice_crafter_guide': {
    id: 'apprentice_crafter_guide',
    name: 'Apprentice Crafter\'s Guide',
    icon: '📚',
    stackable: false,
    description: 'Basic techniques for working with various materials.',
    useAction: 'read',
    value: 95,
    category: 'books'
  },
  'sailor_navigation_manual': {
    id: 'sailor_navigation_manual',
    name: 'Sailor\'s Navigation Manual',
    icon: '📚',
    stackable: false,
    description: 'Chart the waters and master the art of seamanship.',
    useAction: 'read',
    value: 120,
    category: 'books'
  },
  'blacksmith_basics': {
    id: 'blacksmith_basics',
    name: 'Blacksmith\'s Foundation',
    icon: '📚',
    stackable: false,
    description: 'Learn the fundamentals of working iron and steel.',
    useAction: 'read',
    value: 115,
    category: 'books'
  },
  'ranger_wilderness_guide': {
    id: 'ranger_wilderness_guide',
    name: 'Ranger\'s Wilderness Guide',
    icon: '📚',
    stackable: false,
    description: 'Survive and thrive in the untamed wilderness.',
    useAction: 'read',
    value: 130,
    category: 'books'
  },
  
  // Intermediate Books
  'chef_culinary_secrets': {
    id: 'chef_culinary_secrets',
    name: 'Chef\'s Culinary Secrets',
    icon: '📚',
    stackable: false,
    description: 'Advanced cooking techniques and exotic recipes.',
    useAction: 'read',
    value: 180,
    category: 'books'
  },
  'thief_rogues_handbook': {
    id: 'thief_rogues_handbook',
    name: 'Rogue\'s Handbook',
    icon: '📚',
    stackable: false,
    description: 'Master the arts of stealth, lockpicking, and cunning.',
    useAction: 'read',
    value: 160,
    category: 'books'
  },
  'magical_defense_primer': {
    id: 'magical_defense_primer',
    name: 'Magical Defense Primer',
    icon: '📚',
    stackable: false,
    description: 'Protection against magical attacks and supernatural threats.',
    useAction: 'read',
    value: 170,
    category: 'books'
  },
  'artisan_jewelry_making': {
    id: 'artisan_jewelry_making',
    name: 'Artisan Jewelry Making',
    icon: '📚',
    stackable: false,
    description: 'Craft beautiful and valuable jewelry from precious materials.',
    useAction: 'read',
    value: 220,
    category: 'books'
  },
  'monster_hunter_compendium': {
    id: 'monster_hunter_compendium',
    name: 'Monster Hunter\'s Compendium',
    icon: '📚',
    stackable: false,
    description: 'Detailed knowledge of dangerous creatures and hunting strategies.',
    useAction: 'read',
    value: 240,
    category: 'books'
  },
  
  // Advanced Books
  'master_fletcher_techniques': {
    id: 'master_fletcher_techniques',
    name: 'Master Fletcher\'s Techniques',
    icon: '📚',
    stackable: false,
    description: 'Advanced archery equipment crafting and magical arrows.',
    useAction: 'read',
    value: 280,
    category: 'books'
  },
  'spiritual_meditation_guide': {
    id: 'spiritual_meditation_guide',
    name: 'Spiritual Meditation Guide',
    icon: '📚',
    stackable: false,
    description: 'Achieve inner peace and unlock spiritual powers.',
    useAction: 'read',
    value: 320,
    category: 'books'
  },
  'architect_building_mastery': {
    id: 'architect_building_mastery',
    name: 'Architect\'s Building Mastery',
    icon: '📚',
    stackable: false,
    description: 'Design and construct magnificent structures and fortifications.',
    useAction: 'read',
    value: 340,
    category: 'books'
  },
  'alchemical_transmutation': {
    id: 'alchemical_transmutation',
    name: 'Alchemical Transmutation Manual',
    icon: '📚',
    stackable: false,
    description: 'Transform base materials into precious substances.',
    useAction: 'read',
    value: 380,
    category: 'books'
  },
  'war_strategy_tactics': {
    id: 'war_strategy_tactics',
    name: 'Grand War Strategy & Tactics',
    icon: '📚',
    stackable: false,
    description: 'Command armies and win battles through superior strategy.',
    useAction: 'read',
    value: 450,
    category: 'books'
  },
  
  // Expert Books
  'enchantment_mastery': {
    id: 'enchantment_mastery',
    name: 'Enchantment Mastery Codex',
    icon: '📚',
    stackable: false,
    description: 'Imbue items with powerful magical properties.',
    useAction: 'read',
    value: 520,
    category: 'books'
  },
  'draconic_lore_studies': {
    id: 'draconic_lore_studies',
    name: 'Draconic Lore & Dragon Studies',
    icon: '📚',
    stackable: false,
    description: 'Comprehensive knowledge of dragons and their ancient wisdom.',
    useAction: 'read',
    value: 680,
    category: 'books'
  },
  'planar_travel_guide': {
    id: 'planar_travel_guide',
    name: 'Planar Travel & Dimensional Magic',
    icon: '📚',
    stackable: false,
    description: 'Navigate between worlds and dimensions safely.',
    useAction: 'read',
    value: 820,
    category: 'books'
  },
  'divine_artifact_creation': {
    id: 'divine_artifact_creation',
    name: 'Divine Artifact Creation',
    icon: '📚',
    stackable: false,
    description: 'Forge legendary items blessed by the gods themselves.',
    useAction: 'read',
    value: 980,
    category: 'books'
  },
  'time_manipulation_theory': {
    id: 'time_manipulation_theory',
    name: 'Time Manipulation Theory',
    icon: '📚',
    stackable: false,
    description: 'Bend time itself to your will with ancient temporal magic.',
    useAction: 'read',
    value: 1200,
    category: 'books'
  },

  // Unfinished books (scribing system)
  unfinished_cookbook: {
    id: 'unfinished_cookbook',
    name: 'Unfinished Cookbook',
    icon: '📝',
    type: 'unfinished_book',
    description: 'A cookbook in progress.',
    stackable: false,
    value: 0,
    buyable: false
  },
  unfinished_herbalism: {
    id: 'unfinished_herbalism',
    name: 'Unfinished Herbalism Guide',
    icon: '📝',
    type: 'unfinished_book',
    description: 'A herbalism guide in progress.',
    stackable: false,
    value: 0,
    buyable: false
  },
  unfinished_woodcutting: {
    id: 'unfinished_woodcutting',
    name: 'Unfinished Woodcutting Guide',
    icon: '📝',
    type: 'unfinished_book',
    description: 'A woodcutting guide in progress.',
    stackable: false,
    value: 0,
    buyable: false
  },
  unfinished_fishing: {
    id: 'unfinished_fishing',
    name: 'Unfinished Fishing Handbook',
    icon: '📝',
    type: 'unfinished_book',
    description: 'A fishing handbook in progress.',
    stackable: false,
    value: 0,
    buyable: false
  },
  unfinished_mining: {
    id: 'unfinished_mining',
    name: 'Unfinished Mining Guide',
    icon: '📝',
    type: 'unfinished_book',
    description: 'A mining guide in progress.',
    stackable: false,
    value: 0,
    buyable: false
  },
  unfinished_combat: {
    id: 'unfinished_combat',
    name: 'Unfinished Combat Guide',
    icon: '📝',
    type: 'unfinished_book',
    description: 'A combat guide in progress.',
    stackable: false,
    value: 0,
    buyable: false
  },
  unfinished_magic: {
    id: 'unfinished_magic',
    name: 'Unfinished Magic Theory',
    icon: '📝',
    type: 'unfinished_book',
    description: 'A magic theory book in progress.',
    stackable: false,
    value: 0,
    buyable: false
  },
  unfinished_alchemy: {
    id: 'unfinished_alchemy',
    name: 'Unfinished Alchemy Guide',
    icon: '📝',
    type: 'unfinished_book',
    description: 'An alchemy guide in progress.',
    stackable: false,
    value: 0,
    buyable: false
  },
  unfinished_bestiary: {
    id: 'unfinished_bestiary',
    name: 'Unfinished Beast Compendium',
    icon: '📝',
    type: 'unfinished_book',
    description: 'A beast compendium in progress.',
    stackable: false,
    value: 0,
    buyable: false
  },
  unfinished_smithing: {
    id: 'unfinished_smithing',
    name: 'Unfinished Smithing Guide',
    icon: '📝',
    type: 'unfinished_book',
    description: 'A smithing guide in progress.',
    stackable: false,
    value: 0,
    buyable: false
  },
  unfinished_lore: {
    id: 'unfinished_lore',
    name: 'Unfinished Ancient Lore',
    icon: '📝',
    type: 'unfinished_book',
    description: 'An ancient lore book in progress.',
    stackable: false,
    value: 0,
    buyable: false
  },
  unfinished_tales: {
    id: 'unfinished_tales',
    name: 'Unfinished Legendary Tales',
    icon: '📝',
    type: 'unfinished_book',
    description: 'A legendary tales book in progress.',
    stackable: false,
    value: 0,
    buyable: false
  },
  unfinished_encyclopedia: {
    id: 'unfinished_encyclopedia',
    name: 'Unfinished Encyclopedia',
    icon: '📝',
    type: 'unfinished_book',
    description: 'An encyclopedia in progress.',
    stackable: false,
    value: 0,
    buyable: false
  },
  unfinished_artificer: {
    id: 'unfinished_artificer',
    name: 'Unfinished Artificer Guide',
    icon: '📝',
    type: 'unfinished_book',
    description: 'An artificer guide in progress.',
    stackable: false,
    value: 0,
    buyable: false
  },
  unfinished_wisdom: {
    id: 'unfinished_wisdom',
    name: 'Unfinished Tome of Wisdom',
    icon: '📝',
    type: 'unfinished_book',
    description: 'A tome of wisdom in progress.',
    stackable: false,
    value: 0,
    buyable: false
  },

  // === NEW UNFINISHED BOOKS (20 additions) ===
  
  // Unfinished Beginner to Intermediate Books
  unfinished_almanac: {
    id: 'unfinished_almanac',
    name: 'Unfinished Farmer\'s Almanac',
    icon: '📝',
    type: 'unfinished_book',
    description: 'A farmer\'s almanac in progress.',
    stackable: false,
    value: 0,
    buyable: false
  },
  unfinished_crafting: {
    id: 'unfinished_crafting',
    name: 'Unfinished Crafter\'s Guide',
    icon: '📝',
    type: 'unfinished_book',
    description: 'A crafter\'s guide in progress.',
    stackable: false,
    value: 0,
    buyable: false
  },
  unfinished_sailing: {
    id: 'unfinished_sailing',
    name: 'Unfinished Navigation Manual',
    icon: '📝',
    type: 'unfinished_book',
    description: 'A navigation manual in progress.',
    stackable: false,
    value: 0,
    buyable: false
  },
  unfinished_blacksmithing: {
    id: 'unfinished_blacksmithing',
    name: 'Unfinished Blacksmith\'s Foundation',
    icon: '📝',
    type: 'unfinished_book',
    description: 'A blacksmithing guide in progress.',
    stackable: false,
    value: 0,
    buyable: false
  },
  unfinished_ranger: {
    id: 'unfinished_ranger',
    name: 'Unfinished Wilderness Guide',
    icon: '📝',
    type: 'unfinished_book',
    description: 'A wilderness guide in progress.',
    stackable: false,
    value: 0,
    buyable: false
  },
  
  // Unfinished Intermediate Books
  unfinished_culinary: {
    id: 'unfinished_culinary',
    name: 'Unfinished Culinary Secrets',
    icon: '📝',
    type: 'unfinished_book',
    description: 'A culinary secrets book in progress.',
    stackable: false,
    value: 0,
    buyable: false
  },
  unfinished_thievery: {
    id: 'unfinished_thievery',
    name: 'Unfinished Rogue\'s Handbook',
    icon: '📝',
    type: 'unfinished_book',
    description: 'A rogue\'s handbook in progress.',
    stackable: false,
    value: 0,
    buyable: false
  },
  unfinished_magical_defense: {
    id: 'unfinished_magical_defense',
    name: 'Unfinished Magical Defense Primer',
    icon: '📝',
    type: 'unfinished_book',
    description: 'A magical defense primer in progress.',
    stackable: false,
    value: 0,
    buyable: false
  },
  unfinished_jewelry: {
    id: 'unfinished_jewelry',
    name: 'Unfinished Jewelry Making Guide',
    icon: '📝',
    type: 'unfinished_book',
    description: 'A jewelry making guide in progress.',
    stackable: false,
    value: 0,
    buyable: false
  },
  unfinished_hunting: {
    id: 'unfinished_hunting',
    name: 'Unfinished Monster Hunter\'s Compendium',
    icon: '📝',
    type: 'unfinished_book',
    description: 'A monster hunter\'s compendium in progress.',
    stackable: false,
    value: 0,
    buyable: false
  },
  
  // Unfinished Advanced Books
  unfinished_fletching: {
    id: 'unfinished_fletching',
    name: 'Unfinished Fletcher\'s Techniques',
    icon: '📝',
    type: 'unfinished_book',
    description: 'A fletcher\'s techniques book in progress.',
    stackable: false,
    value: 0,
    buyable: false
  },
  unfinished_meditation: {
    id: 'unfinished_meditation',
    name: 'Unfinished Meditation Guide',
    icon: '📝',
    type: 'unfinished_book',
    description: 'A meditation guide in progress.',
    stackable: false,
    value: 0,
    buyable: false
  },
  unfinished_architecture: {
    id: 'unfinished_architecture',
    name: 'Unfinished Building Mastery',
    icon: '📝',
    type: 'unfinished_book',
    description: 'An architecture book in progress.',
    stackable: false,
    value: 0,
    buyable: false
  },
  unfinished_transmutation: {
    id: 'unfinished_transmutation',
    name: 'Unfinished Transmutation Manual',
    icon: '📝',
    type: 'unfinished_book',
    description: 'An alchemical transmutation manual in progress.',
    stackable: false,
    value: 0,
    buyable: false
  },
  unfinished_warfare: {
    id: 'unfinished_warfare',
    name: 'Unfinished War Strategy',
    icon: '📝',
    type: 'unfinished_book',
    description: 'A war strategy book in progress.',
    stackable: false,
    value: 0,
    buyable: false
  },
  
  // Unfinished Expert Books
  unfinished_enchantment: {
    id: 'unfinished_enchantment',
    name: 'Unfinished Enchantment Codex',
    icon: '📝',
    type: 'unfinished_book',
    description: 'An enchantment mastery codex in progress.',
    stackable: false,
    value: 0,
    buyable: false
  },
  unfinished_dragons: {
    id: 'unfinished_dragons',
    name: 'Unfinished Draconic Lore',
    icon: '📝',
    type: 'unfinished_book',
    description: 'A draconic lore book in progress.',
    stackable: false,
    value: 0,
    buyable: false
  },
  unfinished_planar: {
    id: 'unfinished_planar',
    name: 'Unfinished Planar Travel Guide',
    icon: '📝',
    type: 'unfinished_book',
    description: 'A planar travel guide in progress.',
    stackable: false,
    value: 0,
    buyable: false
  },
  unfinished_divine: {
    id: 'unfinished_divine',
    name: 'Unfinished Divine Artifact Creation',
    icon: '📝',
    type: 'unfinished_book',
    description: 'A divine artifact creation book in progress.',
    stackable: false,
    value: 0,
    buyable: false
  },
  unfinished_temporal: {
    id: 'unfinished_temporal',
    name: 'Unfinished Time Manipulation Theory',
    icon: '📝',
    type: 'unfinished_book',
    description: 'A time manipulation theory book in progress.',
    stackable: false,
    value: 0,
    buyable: false
  },

  // === Skill coverage additions ===
  'explosive_handbook': {
    id: 'explosive_handbook',
    name: 'Demolition & Blasting Manual',
    icon: '📚',
    stackable: false,
    description: 'Safe handling and effective use of explosives for mining and warfare.',
    useAction: 'read',
    value: 150,
    category: 'books'
  },
  'anatomy_vitality_treatise': {
    id: 'anatomy_vitality_treatise',
    name: 'Anatomy & Vitality Treatise',
    icon: '📚',
    stackable: false,
    description: 'Detailed study of the body to improve endurance and vitality.',
    useAction: 'read',
    value: 160,
    category: 'books'
  },
  'advanced_herbal_remedies': {
    id: 'advanced_herbal_remedies',
    name: 'Advanced Herbal Remedies',
    icon: '📚',
    stackable: false,
    description: 'Formulate potent concoctions from rare herbs.',
    useAction: 'read',
    value: 220,
    category: 'books'
  },
  'bonecraft_chronicles': {
    id: 'bonecraft_chronicles',
    name: 'Bonecraft Chronicles',
    icon: '📚',
    stackable: false,
    description: 'Techniques for crafting tools and art from bone.',
    useAction: 'read',
    value: 200,
    category: 'books'
  },
  'master_painters_portfolio': {
    id: 'master_painters_portfolio',
    name: 'Master Painter\'s Portfolio',
    icon: '📚',
    stackable: false,
    description: 'Color theory and advanced brush techniques.',
    useAction: 'read',
    value: 190,
    category: 'books'
  },
  'brewers_bible': {
    id: 'brewers_bible',
    name: 'Brewer\'s Bible',
    icon: '📚',
    stackable: false,
    description: 'Recipes and fermentation secrets for exceptional brews.',
    useAction: 'read',
    value: 210,
    category: 'books'
  },
  'scribes_lexicon': {
    id: 'scribes_lexicon',
    name: 'Scribe\'s Lexicon',
    icon: '📚',
    stackable: false,
    description: 'Advanced scripts, calligraphy, and manuscript preservation.',
    useAction: 'read',
    value: 240,
    category: 'books'
  },
  'confectioners_compendium': {
    id: 'confectioners_compendium',
    name: 'Confectioner\'s Compendium',
    icon: '📚',
    stackable: false,
    description: 'Craft decadent sweets and magical desserts.',
    useAction: 'read',
    value: 200,
    category: 'books'
  },
  'tailors_thread_and_needle': {
    id: 'tailors_thread_and_needle',
    name: 'Tailor\'s Thread & Needle',
    icon: '📚',
    stackable: false,
    description: 'Patterns and stitches for fine garments.',
    useAction: 'read',
    value: 210,
    category: 'books'
  },
  'genesis_codex': {
    id: 'genesis_codex',
    name: 'Genesis Codex',
    icon: '📚',
    stackable: false,
    description: 'Secrets of creation magic and life weaving.',
    useAction: 'read',
    value: 400,
    category: 'books'
  },
  'couriers_handbook': {
    id: 'couriers_handbook',
    name: 'Courier\'s Handbook',
    icon: '📚',
    stackable: false,
    description: 'Swift routes, parcel safety, and message security.',
    useAction: 'read',
    value: 90,
    category: 'books'
  },
  'ranchers_almanac': {
    id: 'ranchers_almanac',
    name: 'Rancher\'s Almanac',
    icon: '📚',
    stackable: false,
    description: 'Animal husbandry, feeding schedules, and livestock care.',
    useAction: 'read',
    value: 100,
    category: 'books'
  },
  'candlecraft_manual': {
    id: 'candlecraft_manual',
    name: 'Luminary Candlecraft Manual',
    icon: '📚',
    stackable: false,
    description: 'Create illuminating and aromatic candles.',
    useAction: 'read',
    value: 110,
    category: 'books'
  },
  'potters_wheel_manual': {
    id: 'potters_wheel_manual',
    name: 'Potter\'s Wheel Manual',
    icon: '📚',
    stackable: false,
    description: 'Wheel throwing techniques and kiln secrets.',
    useAction: 'read',
    value: 180,
    category: 'books'
  },

  // === Additional unfinished books ===
  unfinished_explosive: {
    id: 'unfinished_explosive',
    name: 'Unfinished Demolition Manual',
    icon: '📝',
    type: 'unfinished_book',
    description: 'A blasting manual in progress.',
    stackable: false,
    value: 0,
    buyable: false
  },
  unfinished_vitality: {
    id: 'unfinished_vitality',
    name: 'Unfinished Vitality Treatise',
    icon: '📝',
    type: 'unfinished_book',
    description: 'A vitality treatise in progress.',
    stackable: false,
    value: 0,
    buyable: false
  },
  unfinished_remedies: {
    id: 'unfinished_remedies',
    name: 'Unfinished Herbal Remedies',
    icon: '📝',
    type: 'unfinished_book',
    description: 'An herbal remedies book in progress.',
    stackable: false,
    value: 0,
    buyable: false
  },
  unfinished_bonecraft: {
    id: 'unfinished_bonecraft',
    name: 'Unfinished Bonecraft Chronicles',
    icon: '📝',
    type: 'unfinished_book',
    description: 'A bonecraft chronicle in progress.',
    stackable: false,
    value: 0,
    buyable: false
  },
  unfinished_painting: {
    id: 'unfinished_painting',
    name: 'Unfinished Painter\'s Portfolio',
    icon: '📝',
    type: 'unfinished_book',
    description: 'A painter\'s portfolio in progress.',
    stackable: false,
    value: 0,
    buyable: false
  },
  unfinished_brewing: {
    id: 'unfinished_brewing',
    name: 'Unfinished Brewer\'s Bible',
    icon: '📝',
    type: 'unfinished_book',
    description: 'A brewing manual in progress.',
    stackable: false,
    value: 0,
    buyable: false
  },
  unfinished_lexicon: {
    id: 'unfinished_lexicon',
    name: 'Unfinished Scribe\'s Lexicon',
    icon: '📝',
    type: 'unfinished_book',
    description: 'A scribe\'s lexicon in progress.',
    stackable: false,
    value: 0,
    buyable: false
  },
  unfinished_confectionery: {
    id: 'unfinished_confectionery',
    name: 'Unfinished Confectioner\'s Compendium',
    icon: '📝',
    type: 'unfinished_book',
    description: 'A confectionery book in progress.',
    stackable: false,
    value: 0,
    buyable: false
  },
  unfinished_tailoring: {
    id: 'unfinished_tailoring',
    name: 'Unfinished Tailoring Manual',
    icon: '📝',
    type: 'unfinished_book',
    description: 'A tailoring manual in progress.',
    stackable: false,
    value: 0,
    buyable: false
  },
  unfinished_genesis: {
    id: 'unfinished_genesis',
    name: 'Unfinished Genesis Codex',
    icon: '📝',
    type: 'unfinished_book',
    description: 'A genesis codex in progress.',
    stackable: false,
    value: 0,
    buyable: false
  },
  unfinished_courier: {
    id: 'unfinished_courier',
    name: 'Unfinished Courier\'s Handbook',
    icon: '📝',
    type: 'unfinished_book',
    description: 'A courier handbook in progress.',
    stackable: false,
    value: 0,
    buyable: false
  },
  unfinished_ranching: {
    id: 'unfinished_ranching',
    name: 'Unfinished Rancher\'s Almanac',
    icon: '📝',
    type: 'unfinished_book',
    description: 'A ranching almanac in progress.',
    stackable: false,
    value: 0,
    buyable: false
  },
  unfinished_candlemaking: {
    id: 'unfinished_candlemaking',
    name: 'Unfinished Candlecraft Manual',
    icon: '📝',
    type: 'unfinished_book',
    description: 'A candlecraft manual in progress.',
    stackable: false,
    value: 0,
    buyable: false
  },
  unfinished_pottery: {
    id: 'unfinished_pottery',
    name: 'Unfinished Pottery Manual',
    icon: '📝',
    type: 'unfinished_book',
    description: 'A pottery manual in progress.',
    stackable: false,
    value: 0,
    buyable: false
  },

  // Basic items from inventory.js
  'apple': {
    id: 'apple',
    name: 'Apple',
    icon: '🍎',
    stackable: false,
    description: 'A crisp red apple. Looks delicious!',
    useAction: 'eat',
    rarity: 0.2,
    category: 'food',
    value: 5,
    buyable: true,
    heals: 4
  },
  'potion': {
    id: 'potion',
    name: 'Health Potion',
    icon: '🧪',
    stackable: false,
    description: 'A red potion that restores health.',
    useAction: 'drink',
    rarity: 0.15,
    category: 'food',
    value: 25,
    buyable: true,
    heals: 15
  },
  'gem': {
    id: 'gem',
    name: 'Ruby',
    icon: '🔴',
    stackable: false,
    description: 'A precious red gem that sparkles in the light.',
    useAction: 'examine',
    rarity: 0.05,
    colorTint: '#dc2626',
    category: 'resources',
    value: 500,
    buyable: false
  },
  'sapphire': {
    id: 'sapphire',
    name: 'Sapphire',
    icon: '🔵',
    stackable: false,
    description: 'A brilliant blue gem with a deep azure glow.',
    useAction: 'examine',
    rarity: 0.05,
    colorTint: '#2563eb',
    category: 'resources',
    value: 450,
    buyable: false
  },
  'emerald': {
    id: 'emerald',
    name: 'Emerald',
    icon: '🟢',
    stackable: false,
    description: 'A vibrant green gem with an enchanting shine.',
    useAction: 'examine',
    rarity: 0.05,
    colorTint: '#16a34a',
    category: 'resources',
    value: 400,
    buyable: false
  },
  'diamond': {
    id: 'diamond',
    name: 'Diamond',
    icon: '💎',
    stackable: false,
    description: 'A flawless crystal that refracts light beautifully.',
    useAction: 'examine',
    rarity: 0.03,
    colorTint: '#f8fafc',
    category: 'resources',
    value: 1000,
    buyable: false
  },
  'key': {
    id: 'key',
    name: 'Brass Key',
    icon: '🗝️',
    stackable: false,
    description: 'An old brass key. I wonder what it unlocks?',
    useAction: 'use',
    rarity: 0.08,
    category: 'misc',
    value: 15,
    buyable: false
  },
  'book': {
    id: 'book',
    name: 'Ancient Book',
    icon: '📖',
    stackable: false,
    description: 'A dusty old book with mysterious writing.',
    useAction: 'read',
    rarity: 0.07,
    category: 'misc',
    value: 100,
    buyable: false
  },
  'mushroom': {
    id: 'mushroom',
    name: 'Red Mushroom',
    icon: '🍄',
    stackable: false,
    description: 'A red mushroom. Might be useful for alchemy.',
    useAction: 'eat',
    rarity: 0.12,
    category: 'food',
    value: 8,
    buyable: true,
    heals: 3
  },
  'chisel': {
    id: 'chisel',
    name: 'Chisel',
    icon: '🔨',
    stackable: false,
    description: 'A sharp chisel for cutting gems.',
    useAction: 'use',
    rarity: 0.06,
    category: 'misc',
    value: 30,
    buyable: true
  },
  'uncut_gem': {
    id: 'uncut_gem',
    name: 'Uncut Ruby',
    icon: '🟥',
    stackable: false,
    description: 'A rough, uncut ruby. Needs to be cut.',
    useAction: 'use',
    rarity: 0.04,
    category: 'resources',
    value: 250,
    buyable: false
  },
  'uncut_sapphire': {
    id: 'uncut_sapphire',
    name: 'Uncut Sapphire',
    icon: '🟦',
    stackable: false,
    description: 'A rough, uncut sapphire. Needs to be cut.',
    useAction: 'use',
    rarity: 0.04,
    category: 'resources',
    value: 225,
    buyable: false
  },
  'uncut_emerald': {
    id: 'uncut_emerald',
    name: 'Uncut Emerald',
    icon: '🟩',
    stackable: false,
    description: 'A rough, uncut emerald. Needs to be cut.',
    useAction: 'use',
    rarity: 0.04,
    value: 200,
    buyable: false
  },
  'uncut_diamond': {
    id: 'uncut_diamond',
    name: 'Uncut Diamond',
    icon: '⬜',
    stackable: false,
    description: 'A rough, uncut diamond. Needs to be cut.',
    useAction: 'use',
    rarity: 0.03,
    value: 500,
    buyable: false
  },
  'bread': {
    id: 'bread',
    name: 'Bread',
    icon: '🍞',
    stackable: false,
    description: 'Fresh baked bread. Restores hunger.',
    useAction: 'eat',
    rarity: 0.25,
    category: 'food',
    value: 12,
    buyable: true
  },
  'meat': {
    id: 'meat',
    name: 'Cooked Meat',
    icon: '🥩',
    stackable: false,
    description: 'Well-cooked meat. Very filling.',
    useAction: 'eat',
    rarity: 0.25,
    category: 'food',
    value: 20,
    buyable: true
  },
  'rope': {
    id: 'rope',
    name: 'Rope',
    icon: '🪢',
    stackable: false,
    description: 'Strong rope. Useful for climbing.',
    useAction: 'use',
    rarity: 0.2,
    category: 'tools',
    value: 18,
    buyable: true
  },
  'tinderbox': {
    id: 'tinderbox',
    name: 'Tinderbox',
    icon: '🔥',
    stackable: false,
    description: 'Used to light fires.',
    useAction: 'use',
    rarity: 0.15,
    category: 'tools',
    value: 10,
    buyable: true
  },
  'bronze_sword': {
    id: 'bronze_sword',
    name: 'Bronze Sword',
    icon: '🗡️',
    stackable: false,
    description: 'A basic bronze sword. Better than bare hands.',
    useAction: 'wield',
    rarity: 0.18,
    category: 'weapons',
    requirements: { attack: 1 },
    value: 150,
    buyable: true
  },
  'iron_sword': {
    id: 'iron_sword',
    name: 'Iron Sword',
    icon: '⚔️',
    stackable: false,
    description: 'A sturdy iron sword.',
    useAction: 'wield',
    rarity: 0.12,
    category: 'weapons',
    requirements: { attack: 10 },
    value: 400,
    buyable: true
  },
  'steel_sword': {
    id: 'steel_sword',
    name: 'Steel Sword',
    icon: '🗡️',
    stackable: false,
    description: 'A sharp steel sword.',
    useAction: 'wield',
    rarity: 0.1,
    category: 'weapons',
    requirements: { attack: 20 },
    value: 800,
    buyable: true
  },
  'bronze_shield': {
    id: 'bronze_shield',
    name: 'Bronze Shield',
    icon: '🛡️',
    stackable: false,
    description: 'A basic bronze shield.',
    useAction: 'wield',
    rarity: 0.2,
    category: 'armor',
    requirements: { defence: 1 },
    value: 120,
    buyable: true
  },
  'iron_shield': {
    id: 'iron_shield',
    name: 'Iron Shield',
    icon: '🛡️',
    stackable: false,
    description: 'A sturdy iron shield.',
    useAction: 'wield',
    rarity: 0.13,
    category: 'armor',
    requirements: { defence: 10 },
    value: 300,
    buyable: true
  },
  'leather_armor': {
    id: 'leather_armor',
    name: 'Leather Armor',
    icon: '🥼',
    stackable: false,
    description: 'Basic leather armor.',
    useAction: 'wear',
    rarity: 0.15,
    category: 'armor',
    requirements: { defence: 1 },
    value: 200,
    buyable: true
  },
  'mana_potion': {
    id: 'mana_potion',
    name: 'Mana Potion',
    icon: '💙',
    stackable: false,
    description: 'Restores magical energy.',
    useAction: 'drink',
    rarity: 0.18,
    category: 'potions',
    value: 35,
    buyable: true
  },
  'health_potion': {
    id: 'health_potion',
    name: 'Health Potion',
    icon: '❤️',
    stackable: false,
    description: 'Restores health points.',
    useAction: 'drink',
    rarity: 0.18,
    category: 'potions',
    value: 30,
    buyable: true
  },
  'magic_staff': {
    id: 'magic_staff',
    name: 'Magic Staff',
    icon: '🪄',
    stackable: false,
    description: 'A staff imbued with magical power.',
    useAction: 'wield',
    rarity: 0.1,
    category: 'weapons',
    requirements: { magic: 15 },
    value: 1200,
    buyable: true
  },
  'rune_fire': {
    id: 'rune_fire',
    name: 'Fire Rune',
    icon: '🔥',
    stackable: true,
    description: 'Contains the power of fire.',
    useAction: 'cast',
    rarity: 0.3,
    category: 'runes',
    value: 5,
    buyable: true
  },
  'rune_water': {
    id: 'rune_water',
    name: 'Water Rune',
    icon: '💧',
    stackable: true,
    description: 'Contains the power of water.',
    useAction: 'cast',
    rarity: 0.3,
    category: 'runes',
    value: 5,
    buyable: true
  },
  'scroll_teleport': {
    id: 'scroll_teleport',
    name: 'Teleport Scroll',
    icon: '📜',
    stackable: true,
    description: 'Teleports you to a safe location.',
    useAction: 'read',
    rarity: 0.12,
    category: 'magic',
    value: 50,
    buyable: true
  },

  // Scribing materials
  'basic_journal': {
    id: 'basic_journal',
    name: 'Basic Journal',
    icon: '📔',
    type: 'book',
    description: 'A simple journal for recording adventures.',
    stackable: true,
    value: 50,
    buyable: true
  },
  'fine_notebook': {
    id: 'fine_notebook',
    name: 'Fine Notebook',
    icon: '📗',
    type: 'book',
    description: 'A quality notebook made from fine paper.',
    stackable: true,
    value: 125,
    buyable: true
  },
  'premium_tome': {
    id: 'premium_tome',
    name: 'Premium Tome',
    icon: '📘',
    type: 'book',
    description: 'An elegant tome crafted from premium paper.',
    stackable: true,
    value: 300,
    buyable: true
  },
  'mystic_grimoire': {
    id: 'mystic_grimoire',
    name: 'Mystic Grimoire',
    icon: '📙',
    type: 'book',
    description: 'A powerful grimoire written on mystical paper.',
    stackable: true,
    value: 800,
    buyable: true
  },

  // Scrolls
  'basic_scroll': {
    id: 'basic_scroll',
    name: 'Basic Scroll',
    icon: '📜',
    type: 'scroll',
    description: 'A simple scroll for basic messages.',
    stackable: true,
    value: 20,
    buyable: true
  },
  'fine_scroll': {
    id: 'fine_scroll',
    name: 'Fine Scroll',
    icon: '📜',
    type: 'scroll',
    description: 'An elegant scroll made from fine paper.',
    stackable: true,
    value: 40,
    buyable: true
  },
  'premium_decree': {
    id: 'premium_decree',
    name: 'Premium Decree',
    icon: '📜',
    type: 'scroll',
    description: 'An official decree written on premium paper.',
    stackable: true,
    value: 100,
    buyable: true
  },
  'mystic_charter': {
    id: 'mystic_charter',
    name: 'Mystic Charter',
    icon: '📜',
    type: 'scroll',
    description: 'A magical charter inscribed on mystic paper.',
    stackable: true,
    value: 300,
    buyable: true
  },

  // === Null-only progression books ===
  'storybook_collection': {
    id: 'storybook_collection',
    name: 'Storybook Collection',
    icon: '📚',
    stackable: false,
    description: 'A charming set of short tales for young adventurers.',
    useAction: 'read',
    value: 40,
    category: 'books'
  },
  'folk_tales': {
    id: 'folk_tales',
    name: 'Folk Tales of the Realm',
    icon: '📚',
    stackable: false,
    description: 'Popular legends and fireside stories gathered from villages far and wide.',
    useAction: 'read',
    value: 60,
    category: 'books'
  },
  'travellers_journal': {
    id: 'travellers_journal',
    name: "Traveller's Journal",
    icon: '📚',
    stackable: false,
    description: 'Notes and sketches from a wanderer\'s voyages across the continent.',
    useAction: 'read',
    value: 80,
    category: 'books'
  },
  'merchant_ledgers': {
    id: 'merchant_ledgers',
    name: "Merchant's Ledgers",
    icon: '📚',
    stackable: false,
    description: 'Detailed accounts that teach efficient record-keeping and handwriting.',
    useAction: 'read',
    value: 100,
    category: 'books'
  },
  'architectural_sketches': {
    id: 'architectural_sketches',
    name: 'Architectural Sketches',
    icon: '📚',
    stackable: false,
    description: 'Elegant drawings showcasing building styles of the realm.',
    useAction: 'read',
    value: 150,
    category: 'books'
  },
  'cartographers_notes': {
    id: 'cartographers_notes',
    name: "Cartographer's Notes",
    icon: '📚',
    stackable: false,
    description: 'Hand-drawn maps and annotations of uncharted territories.',
    useAction: 'read',
    value: 180,
    category: 'books'
  },
  'philosophical_essays': {
    id: 'philosophical_essays',
    name: 'Philosophical Essays',
    icon: '📚',
    stackable: false,
    description: 'Thought-provoking reflections on life, ethics, and purpose.',
    useAction: 'read',
    value: 210,
    category: 'books'
  },
  'historical_chronicle': {
    id: 'historical_chronicle',
    name: 'Historical Chronicle',
    icon: '📚',
    stackable: false,
    description: 'A comprehensive recount of pivotal events in the kingdom\'s past.',
    useAction: 'read',
    value: 260,
    category: 'books'
  },
  'poetry_anthology': {
    id: 'poetry_anthology',
    name: 'Poetry Anthology',
    icon: '📚',
    stackable: false,
    description: 'An inspiring collection of poems spanning love, loss, and heroism.',
    useAction: 'read',
    value: 320,
    category: 'books'
  },
  'cosmic_reflections': {
    id: 'cosmic_reflections',
    name: 'Cosmic Reflections',
    icon: '📚',
    stackable: false,
    description: 'Philosophical musings on the stars and one\'s place among them.',
    useAction: 'read',
    value: 450,
    category: 'books'
  },

  // === Additional unfinished null books ===
  unfinished_storybook: {
    id: 'unfinished_storybook',
    name: 'Unfinished Storybook Collection',
    icon: '📝',
    type: 'unfinished_book',
    description: 'A storybook still being written.',
    stackable: false,
    value: 0,
    buyable: false
  },
  unfinished_folktales: {
    id: 'unfinished_folktales',
    name: 'Unfinished Folk Tales',
    icon: '📝',
    type: 'unfinished_book',
    description: 'A folk tales manuscript in progress.',
    stackable: false,
    value: 0,
    buyable: false
  },
  unfinished_journal: {
    id: 'unfinished_journal',
    name: 'Unfinished Traveller\'s Journal',
    icon: '📝',
    type: 'unfinished_book',
    description: 'A journal still being filled.',
    stackable: false,
    value: 0,
    buyable: false
  },
  unfinished_ledgers: {
    id: 'unfinished_ledgers',
    name: 'Unfinished Merchant Ledgers',
    icon: '📝',
    type: 'unfinished_book',
    description: 'Ledgers awaiting more entries.',
    stackable: false,
    value: 0,
    buyable: false
  },
  unfinished_sketches: {
    id: 'unfinished_sketches',
    name: 'Unfinished Architectural Sketches',
    icon: '📝',
    type: 'unfinished_book',
    description: 'Architectural sketches in progress.',
    stackable: false,
    value: 0,
    buyable: false
  },
  unfinished_cartography: {
    id: 'unfinished_cartography',
    name: 'Unfinished Cartographer\'s Notes',
    icon: '📝',
    type: 'unfinished_book',
    description: 'Cartography notes in progress.',
    stackable: false,
    value: 0,
    buyable: false
  },
  unfinished_essays: {
    id: 'unfinished_essays',
    name: 'Unfinished Philosophical Essays',
    icon: '📝',
    type: 'unfinished_book',
    description: 'Philosophical essays still being contemplated.',
    stackable: false,
    value: 0,
    buyable: false
  },
  unfinished_chronicle: {
    id: 'unfinished_chronicle',
    name: 'Unfinished Historical Chronicle',
    icon: '📝',
    type: 'unfinished_book',
    description: 'A historical chronicle in progress.',
    stackable: false,
    value: 0,
    buyable: false
  },
  unfinished_poetry: {
    id: 'unfinished_poetry',
    name: 'Unfinished Poetry Anthology',
    icon: '📝',
    type: 'unfinished_book',
    description: 'Poems still awaiting refinement.',
    stackable: false,
    value: 0,
    buyable: false
  },
  unfinished_cosmic: {
    id: 'unfinished_cosmic',
    name: 'Unfinished Cosmic Reflections',
    icon: '📝',
    type: 'unfinished_book',
    description: 'Cosmic musings still being penned.',
    stackable: false,
    value: 0,
    buyable: false
  },

  // Additional skill-specific books
  'bonecarving_compendium': {
    id: 'bonecarving_compendium',
    name: 'Bonecarving Compendium',
    icon: '📚',
    stackable: false,
    description: 'Intermediate techniques for working bone into useful items.',
    useAction: 'read',
    value: 220,
    category: 'books'
  },
  'illuminary_candles': {
    id: 'illuminary_candles',
    name: 'Illuminary Candles',
    icon: '📚',
    stackable: false,
    description: 'Advanced candle fragrances and magical wicks.',
    useAction: 'read',
    value: 200,
    category: 'books'
  },
  'kiln_mastery': {
    id: 'kiln_mastery',
    name: 'Kiln Mastery',
    icon: '📚',
    stackable: false,
    description: 'Secrets for glazing and firing pottery to perfection.',
    useAction: 'read',
    value: 250,
    category: 'books'
  },
  'scholars_appendix': {
    id: 'scholars_appendix',
    name: "Scholar's Appendix",
    icon: '📚',
    stackable: false,
    description: 'Supplementary entries expanding worldly knowledge.',
    useAction: 'read',
    value: 380,
    category: 'books'
  },
  'deep_sea_angling': {
    id: 'deep_sea_angling',
    name: 'Deep-Sea Angling',
    icon: '📚',
    stackable: false,
    description: 'Teachings for catching elusive ocean fish.',
    useAction: 'read',
    value: 230,
    category: 'books'
  },

  // New unfinished counterparts
  unfinished_bone_compendium: {
    id: 'unfinished_bone_compendium',
    name: 'Unfinished Bonecarving Compendium',
    icon: '📝',
    type: 'unfinished_book',
    description: 'A bonecarving book in progress.',
    stackable: false,
    value: 0,
    buyable: false
  },
  unfinished_candlealchemy: {
    id: 'unfinished_candlealchemy',
    name: 'Unfinished Illuminary Candles',
    icon: '📝',
    type: 'unfinished_book',
    description: 'A candle alchemy manuscript in progress.',
    stackable: false,
    value: 0,
    buyable: false
  },
  unfinished_kiln: {
    id: 'unfinished_kiln',
    name: 'Unfinished Kiln Mastery',
    icon: '📝',
    type: 'unfinished_book',
    description: 'A pottery guide still being fired.',
    stackable: false,
    value: 0,
    buyable: false
  },
  unfinished_appendix: {
    id: 'unfinished_appendix',
    name: 'Unfinished Scholar\'s Appendix',
    icon: '📝',
    type: 'unfinished_book',
    description: 'An appendix awaiting completion.',
    stackable: false,
    value: 0,
    buyable: false
  },
  unfinished_angling: {
    id: 'unfinished_angling',
    name: 'Unfinished Angling Manual',
    icon: '📝',
    type: 'unfinished_book',
    description: 'An angling guide still being penned.',
    stackable: false,
    value: 0,
    buyable: false
  },

  // === Bone items ===
  small_bones: {
    id: 'small_bones',
    name: 'Small Bones',
    icon: '🦴',
    type: 'bone',
    description: 'Small bones dropped by tiny creatures.',
    stackable: false,
    value: 1,
    buyable: false
  },
  bones: {
    id: 'bones',
    name: 'Bones',
    icon: '🦴',
    type: 'bone',
    description: 'Standard bones that can be buried for Prayer experience.',
    stackable: false,
    value: 2,
    buyable: false
  },
  big_bones: {
    id: 'big_bones',
    name: 'Big Bones',
    icon: '🦴',
    type: 'bone',
    description: 'Large bones that grant extra Prayer experience.',
    stackable: false,
    value: 3,
    buyable: false
  },
  giant_bones: {
    id: 'giant_bones',
    name: 'Giant Bones',
    icon: '🦴',
    type: 'bone',
    description: 'Massive bones from giant creatures.',
    stackable: false,
    value: 4,
    buyable: false
  },
  fossil_fragments: {
    id: 'fossil_fragments',
    name: 'Fossil Fragments',
    icon: '🦕',
    type: 'bone',
    description: 'Ancient fossil fragments from prehistoric creatures.',
    stackable: false,
    value: 8,
    buyable: false
  },
  dragon_bones: {
    id: 'dragon_bones',
    name: 'Dragon Bones',
    icon: '🐲',
    type: 'bone',
    description: 'Powerful dragon bones imbued with ancient magic.',
    stackable: false,
    value: 15,
    buyable: false
  },
  ancient_bones: {
    id: 'ancient_bones',
    name: 'Ancient Bones',
    icon: '☠️',
    type: 'bone',
    description: 'Mysterious bones from an ancient civilization.',
    stackable: false,
    value: 25,
    buyable: false
  }
};

// Export for both Node.js (server) and browser (client)
if (typeof module !== 'undefined' && module.exports) {
  // Node.js environment (server)
  module.exports = { itemDefinitions };
} else {
  // Browser environment (client)
  window.sharedItemDefinitions = itemDefinitions;
} 