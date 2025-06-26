/**
 * Scribing module for WebscapeRPG
 * Handles scribing mechanics, pulp basins, paper creation, and experience
 */

import { addExperience, skillsData } from '../skills.js';
import { showSkillBubble, hideSkillBubble } from '../skillBubbles.js';

// Skill icon mapping
const SKILL_ICONS = {
    'attack': '⚔️',
    'magic': '🪄',
    'ranged': '🏹',
    'blasting': '💣',
    'defence': '🛡️',
    'hitpoints': '❤️',
    'prayer': '✨',
    'slayer': '☠️',
    'mining': '⛏️',
    'fishing': '🎣',
    'woodcutting': '🌲',
    'harvesting': '🍄',
    'smithing': '🔨',
    'cooking': '🍖',
    'fletching': '🪶',
    'apothecary': '🌿',
    'crafting': '💍',
    'bonecarving': '🦴',
    'painting': '🎨',
    'brewing': '🍺',
    'scribing': '📜',
    'confectionery': '🍰',
    'masonry': '🧱',
    'tailoring': '🪡',
    'thieving': '🎭️',
    'alchemy': '⚖️',
    'creation': '🐣',
    'delivery': '✉️',
    'ranching': '🐄',
    'knowledge': '📚',
    'candlemaking': '🕯️',
    'pottery': '🏺',
    'digging': '🪏',
    'diplomacy': '🕊️'
};

// Scribing constants
const SCRIBING_CONSTANTS = {
  BASE_PULPING_TIME: 600, // Base time in milliseconds for creating pulp (was 3000, now 5x faster)
  BASE_PAPER_TIME: 400, // Base time in milliseconds for creating paper (was 2000, now 5x faster)
  ANIMATION_DURATION: 500, // Time between scribing animations
  EXPERIENCE_PER_PULP: 5, // XP for creating paper pulp
  EXPERIENCE_PER_PAPER: 15 // XP for creating paper
};

// Pulp basin definitions
const PULP_BASIN_DEFINITIONS = {
  'pulp_basin': {
    name: 'Pulp Basin',
    icon: '🪣',
    level: 1,
    description: 'Used to create paper pulp from logs'
  }
};

// Scribing table definitions
const SCRIBING_TABLE_DEFINITIONS = {
  'scribing_table': {
    name: 'Scribing Table',
    icon: '📝',
    level: 1,
    description: 'Used to write books and scrolls'
  }
};

// Paper pulp recipes - what logs can be used to make pulp
const PULP_RECIPES = {
  'wooden_log': {
    name: 'Paper Pulp',
    resultItem: 'paper_pulp',
    resultQuantity: 1,
    experience: 5,
    level: 1,
    processingTime: 600 // was 3000, now 5x faster
  },
  'oak_log': {
    name: 'Paper Pulp (x2)', 
    resultItem: 'paper_pulp',
    resultQuantity: 2,
    experience: 12,
    level: 10,
    processingTime: 700 // was 3500, now 5x faster
  },
  'pine_log': {
    name: 'Paper Pulp (x3)',
    resultItem: 'paper_pulp',
    resultQuantity: 3,
    experience: 16,
    level: 20,
    processingTime: 800 // was 4000, now 5x faster
  },
  'bamboo_log': {
    name: 'Fine Paper Pulp',
    resultItem: 'fine_paper_pulp',
    resultQuantity: 1,
    experience: 20,
    level: 25,
    processingTime: 640 // was 3200, now 5x faster
  },
  'palm_log': {
    name: 'Premium Paper Pulp',
    resultItem: 'premium_paper_pulp',
    resultQuantity: 1,
    experience: 35,
    level: 45,
    processingTime: 900 // was 4500, now 5x faster
  },
  'magic_log': {
    name: 'Mystic Paper Pulp',
    resultItem: 'mystic_paper_pulp',
    resultQuantity: 1,
    experience: 50,
    level: 75,
    processingTime: 1200 // was 6000, now 5x faster
  }
};

// Paper recipes - what pulps can be used to make paper
const PAPER_RECIPES = {
  'paper_pulp': {
    name: 'Paper',
    resultItem: 'paper',
    experience: 5,
    level: 1,
    processingTime: 400 // was 2000, now 5x faster
  },
  'fine_paper_pulp': {
    name: 'Fine Paper',
    resultItem: 'fine_paper',
    experience: 15,
    level: 15,
    processingTime: 500 // was 2500, now 5x faster
  },
  'premium_paper_pulp': {
    name: 'Premium Paper',
    resultItem: 'premium_paper',
    experience: 30,
    level: 45,
    processingTime: 700 // was 3500, now 5x faster
  },
  'mystic_paper_pulp': {
    name: 'Mystic Paper',
    resultItem: 'mystic_paper',
    experience: 60,
    level: 75,
    processingTime: 1000 // was 5000, now 5x faster
  }
};

// Book recipes - Incremental writing system with much higher page counts
const BOOK_RECIPES = {
  'beginner_cookbook': {
    name: 'Beginner\'s Cookbook',
    description: 'A simple cookbook with basic recipes',
    resultItem: 'beginner_cookbook',
    unfinishedItem: 'unfinished_cookbook',
    requiredPages: 20,
    requiredLevel: 3,
    associatedSkill: { skill: 'cooking', level: 5 }, // Cooking skill requirement
    experience: 400, // increased from 300
    baseTime: 4000, // 4 seconds per page
    materials: [
      { item: 'paper', quantity: 20 }
    ]
  },
  'basic_herbalism': {
    name: 'Basic Herbalism Guide',
    description: 'Learn the fundamentals of herb identification',
    resultItem: 'basic_herbalism',
    unfinishedItem: 'unfinished_herbalism',
    requiredPages: 25,
    requiredLevel: 5,
    associatedSkill: { skill: 'apothecary', level: 5 }, // apothecary skill requirement
    experience: 500, // increased from 375
    baseTime: 4000,
    materials: [
      { item: 'paper', quantity: 25 }
    ]
  },
  'woodcutting_guide': {
    name: 'Woodcutting Handbook',
    description: 'Comprehensive guide to tree felling and woodcraft',
    resultItem: 'woodcutting_guide',
    unfinishedItem: 'unfinished_woodcutting',
    requiredPages: 30,
    requiredLevel: 10,
    associatedSkill: { skill: 'woodcutting', level: 10 },
    experience: 600, // increased from 450
    baseTime: 4000,
    materials: [
      { item: 'paper', quantity: 30 }
    ]
  },
  'fishing_handbook': {
    name: 'Complete Fishing Handbook',
    description: 'Everything you need to know about fishing',
    resultItem: 'fishing_handbook',
    unfinishedItem: 'unfinished_fishing',
    requiredPages: 35,
    requiredLevel: 15,
    associatedSkill: { skill: 'fishing', level: 15 },
    experience: 1050, // increased from 600 (fine paper bonus)
    baseTime: 4200,
    materials: [
      { item: 'fine_paper', quantity: 35 }
    ]
  },
  'advanced_mining': {
    name: 'Advanced Mining Techniques',
    description: 'Master the art of efficient ore extraction',
    resultItem: 'advanced_mining',
    unfinishedItem: 'unfinished_mining',
    requiredPages: 45,
    requiredLevel: 25,
    associatedSkill: { skill: 'mining', level: 25 },
    experience: 900,
    baseTime: 4500,
    materials: [
      { item: 'fine_paper', quantity: 45 }
    ]
  },
  'combat_tactics': {
    name: 'Combat Tactics & Strategy',
    description: 'Military strategies and combat techniques',
    resultItem: 'combat_tactics',
    unfinishedItem: 'unfinished_combat',
    requiredPages: 50,
    requiredLevel: 30,
    associatedSkill: { skill: 'attack', level: 20 }, // Combat-related requirement
    experience: 1100,
    baseTime: 4500,
    materials: [
      { item: 'fine_paper', quantity: 50 }
    ]
  },
  'magical_theory': {
    name: 'Principles of Magical Theory',
    description: 'Foundation of magical arts and spellcasting',
    resultItem: 'magical_theory',
    unfinishedItem: 'unfinished_magic',
    requiredPages: 60,
    requiredLevel: 35,
    associatedSkill: null, // Future magic skill
    experience: 1350,
    baseTime: 5000,
    materials: [
      { item: 'fine_paper', quantity: 60 }
    ]
  },
  'alchemy_guide': {
    name: 'Master Alchemist\'s Guide',
    description: 'Advanced alchemical formulas and techniques',
    resultItem: 'alchemy_guide',
    unfinishedItem: 'unfinished_alchemy',
    requiredPages: 80,
    requiredLevel: 40,
    associatedSkill: { skill: 'alchemy', level: 40 }, // Alchemy skill requirement
    experience: 1800,
    baseTime: 5200,
    materials: [
      { item: 'premium_paper', quantity: 80 }
    ]
  },
  'beast_compendium': {
    name: 'Bestiary & Monster Guide',
    description: 'Comprehensive guide to creatures and monsters',
    resultItem: 'beast_compendium',
    unfinishedItem: 'unfinished_bestiary',
    requiredPages: 95,
    requiredLevel: 45,
    associatedSkill: { skill: 'defence', level: 30 }, // Combat knowledge
    experience: 2100,
    baseTime: 5400,
    materials: [
      { item: 'premium_paper', quantity: 95 }
    ]
  },
  'master_smithing': {
    name: 'Master Smithing Compendium',
    description: 'The definitive guide to metalworking mastery',
    resultItem: 'master_smithing',
    unfinishedItem: 'unfinished_smithing',
    requiredPages: 100,
    requiredLevel: 50,
    associatedSkill: { skill: 'smithing', level: 40 },
    experience: 2500,
    baseTime: 5500,
    materials: [
      { item: 'premium_paper', quantity: 100 }
    ]
  },
  'ancient_lore': {
    name: 'Ancient Lore & Mysteries',
    description: 'Secrets of bygone civilizations and lost knowledge',
    resultItem: 'ancient_lore',
    unfinishedItem: 'unfinished_lore',
    requiredPages: 120,
    requiredLevel: 65,
    associatedSkill: null, // Pure scholarly work
    experience: 3600,
    baseTime: 6000,
    materials: [
      { item: 'mystic_paper', quantity: 120 }
    ]
  },
  'legendary_tales': {
    name: 'Legendary Tales & Myths',
    description: 'Epic stories and legends from across the realm',
    resultItem: 'legendary_tales',
    unfinishedItem: 'unfinished_tales',
    requiredPages: 150,
    requiredLevel: 70,
    associatedSkill: null, // Pure storytelling
    experience: 4500,
    baseTime: 6500,
    materials: [
      { item: 'mystic_paper', quantity: 150 }
    ]
  },
  'comprehensive_encyclopedia': {
    name: 'Comprehensive Encyclopedia',
    description: 'The complete collection of worldly knowledge',
    resultItem: 'comprehensive_encyclopedia',
    unfinishedItem: 'unfinished_encyclopedia',
    requiredPages: 200,
    requiredLevel: 75,
    associatedSkill: null, // Universal knowledge
    experience: 6000,
    baseTime: 7000,
    materials: [
      { item: 'mystic_paper', quantity: 200 }
    ]
  },
  'master_artificer_guide': {
    name: 'Master Artificer\'s Guide',
    description: 'Ultimate guide to magical item creation',
    resultItem: 'master_artificer_guide',
    unfinishedItem: 'unfinished_artificer',
    requiredPages: 180,
    requiredLevel: 80,
    associatedSkill: { skill: 'smithing', level: 60 }, // Advanced crafting
    experience: 7200,
    baseTime: 7500,
    materials: [
      { item: 'mystic_paper', quantity: 180 }
    ]
  },
  'tome_of_infinite_wisdom': {
    name: 'Tome of Infinite Wisdom',
    description: 'The ultimate repository of all knowledge',
    resultItem: 'tome_of_infinite_wisdom',
    unfinishedItem: 'unfinished_wisdom',
    requiredPages: 500,
    requiredLevel: 99,
    experience: 25000,
    baseTime: 10000,
    materials: [
      { item: 'mystic_paper', quantity: 500 }
    ]
  },
  
  // === NEW BOOKS (20 additions) ===
  
  // Beginner to Intermediate Books
  'farmers_almanac': {
    name: 'Farmer\'s Almanac',
    description: 'Essential knowledge for cultivating crops and understanding seasons',
    resultItem: 'farmers_almanac',
    unfinishedItem: 'unfinished_almanac',
    requiredPages: 28,
    requiredLevel: 8,
    associatedSkill: { skill: 'harvesting', level: 12 },
    experience: 560,
    baseTime: 4000,
    materials: [
      { item: 'paper', quantity: 28 }
    ]
  },
  'apprentice_crafter_guide': {
    name: 'Apprentice Crafter\'s Guide',
    description: 'Basic techniques for working with various materials',
    resultItem: 'apprentice_crafter_guide',
    unfinishedItem: 'unfinished_crafting',
    requiredPages: 32,
    requiredLevel: 12,
    associatedSkill: { skill: 'crafting', level: 18 },
    experience: 640,
    baseTime: 4100,
    materials: [
      { item: 'paper', quantity: 32 }
    ]
  },
  'sailor_navigation_manual': {
    name: 'Sailor\'s Navigation Manual',
    description: 'Chart the waters and master the art of seamanship',
    resultItem: 'sailor_navigation_manual',
    unfinishedItem: 'unfinished_sailing',
    requiredPages: 40,
    requiredLevel: 18,
    associatedSkill: { skill: 'fishing', level: 25 },
    experience: 1200,
    baseTime: 4300,
    materials: [
      { item: 'fine_paper', quantity: 40 }
    ]
  },
  'blacksmith_basics': {
    name: 'Blacksmith\'s Foundation',
    description: 'Learn the fundamentals of working iron and steel',
    resultItem: 'blacksmith_basics',
    unfinishedItem: 'unfinished_blacksmithing',
    requiredPages: 38,
    requiredLevel: 20,
    associatedSkill: { skill: 'smithing', level: 22 },
    experience: 1140,
    baseTime: 4200,
    materials: [
      { item: 'fine_paper', quantity: 38 }
    ]
  },
  'ranger_wilderness_guide': {
    name: 'Ranger\'s Wilderness Guide',
    description: 'Survive and thrive in the untamed wilderness',
    resultItem: 'ranger_wilderness_guide',
    unfinishedItem: 'unfinished_ranger',
    requiredPages: 42,
    requiredLevel: 22,
    associatedSkill: { skill: 'ranged', level: 20 },
    experience: 1260,
    baseTime: 4400,
    materials: [
      { item: 'fine_paper', quantity: 42 }
    ]
  },
  
  // Intermediate Books
  'chef_culinary_secrets': {
    name: 'Chef\'s Culinary Secrets',
    description: 'Advanced cooking techniques and exotic recipes',
    resultItem: 'chef_culinary_secrets',
    unfinishedItem: 'unfinished_culinary',
    requiredPages: 55,
    requiredLevel: 28,
    associatedSkill: { skill: 'cooking', level: 35 },
    experience: 1650,
    baseTime: 4600,
    materials: [
      { item: 'fine_paper', quantity: 55 }
    ]
  },
  'thief_rogues_handbook': {
    name: 'Rogue\'s Handbook',
    description: 'Master the arts of stealth, lockpicking, and cunning',
    resultItem: 'thief_rogues_handbook',
    unfinishedItem: 'unfinished_thievery',
    requiredPages: 48,
    requiredLevel: 26,
    associatedSkill: { skill: 'thieving', level: 30 },
    experience: 1440,
    baseTime: 4500,
    materials: [
      { item: 'fine_paper', quantity: 48 }
    ]
  },
  'magical_defense_primer': {
    name: 'Magical Defense Primer',
    description: 'Protection against magical attacks and supernatural threats',
    resultItem: 'magical_defense_primer',
    unfinishedItem: 'unfinished_magical_defense',
    requiredPages: 52,
    requiredLevel: 32,
    associatedSkill: { skill: 'magic', level: 25 },
    experience: 1560,
    baseTime: 4700,
    materials: [
      { item: 'fine_paper', quantity: 52 }
    ]
  },
  'artisan_jewelry_making': {
    name: 'Artisan Jewelry Making',
    description: 'Craft beautiful and valuable jewelry from precious materials',
    resultItem: 'artisan_jewelry_making',
    unfinishedItem: 'unfinished_jewelry',
    requiredPages: 65,
    requiredLevel: 35,
    associatedSkill: { skill: 'crafting', level: 40 },
    experience: 1950,
    baseTime: 4800,
    materials: [
      { item: 'fine_paper', quantity: 65 }
    ]
  },
  'monster_hunter_compendium': {
    name: 'Monster Hunter\'s Compendium',
    description: 'Detailed knowledge of dangerous creatures and hunting strategies',
    resultItem: 'monster_hunter_compendium',
    unfinishedItem: 'unfinished_hunting',
    requiredPages: 70,
    requiredLevel: 38,
    associatedSkill: { skill: 'slayer', level: 35 },
    experience: 2100,
    baseTime: 4900,
    materials: [
      { item: 'fine_paper', quantity: 70 }
    ]
  },
  
  // Advanced Books
  'master_fletcher_techniques': {
    name: 'Master Fletcher\'s Techniques',
    description: 'Advanced archery equipment crafting and magical arrows',
    resultItem: 'master_fletcher_techniques',
    unfinishedItem: 'unfinished_fletching',
    requiredPages: 75,
    requiredLevel: 42,
    associatedSkill: { skill: 'fletching', level: 50 },
    experience: 2250,
    baseTime: 5000,
    materials: [
      { item: 'premium_paper', quantity: 75 }
    ]
  },
  'spiritual_meditation_guide': {
    name: 'Spiritual Meditation Guide',
    description: 'Achieve inner peace and unlock spiritual powers',
    resultItem: 'spiritual_meditation_guide',
    unfinishedItem: 'unfinished_meditation',
    requiredPages: 88,
    requiredLevel: 46,
    associatedSkill: { skill: 'prayer', level: 45 },
    experience: 2640,
    baseTime: 5200,
    materials: [
      { item: 'premium_paper', quantity: 88 }
    ]
  },
  'architect_building_mastery': {
    name: 'Architect\'s Building Mastery',
    description: 'Design and construct magnificent structures and fortifications',
    resultItem: 'architect_building_mastery',
    unfinishedItem: 'unfinished_architecture',
    requiredPages: 92,
    requiredLevel: 48,
    associatedSkill: { skill: 'masonry', level: 55 },
    experience: 2760,
    baseTime: 5300,
    materials: [
      { item: 'premium_paper', quantity: 92 }
    ]
  },
  'alchemical_transmutation': {
    name: 'Alchemical Transmutation Manual',
    description: 'Transform base materials into precious substances',
    resultItem: 'alchemical_transmutation',
    unfinishedItem: 'unfinished_transmutation',
    requiredPages: 85,
    requiredLevel: 52,
    associatedSkill: { skill: 'alchemy', level: 60 },
    experience: 2550,
    baseTime: 5400,
    materials: [
      { item: 'premium_paper', quantity: 85 }
    ]
  },
  'war_strategy_tactics': {
    name: 'Grand War Strategy & Tactics',
    description: 'Command armies and win battles through superior strategy',
    resultItem: 'war_strategy_tactics',
    unfinishedItem: 'unfinished_warfare',
    requiredPages: 110,
    requiredLevel: 55,
    associatedSkill: { skill: 'attack', level: 60 },
    experience: 3300,
    baseTime: 5600,
    materials: [
      { item: 'premium_paper', quantity: 110 }
    ]
  },
  
  // Expert Books
  'enchantment_mastery': {
    name: 'Enchantment Mastery Codex',
    description: 'Imbue items with powerful magical properties',
    resultItem: 'enchantment_mastery',
    unfinishedItem: 'unfinished_enchantment',
    requiredPages: 125,
    requiredLevel: 58,
    associatedSkill: { skill: 'magic', level: 65 },
    experience: 3750,
    baseTime: 5800,
    materials: [
      { item: 'premium_paper', quantity: 125 }
    ]
  },
  'draconic_lore_studies': {
    name: 'Draconic Lore & Dragon Studies',
    description: 'Comprehensive knowledge of dragons and their ancient wisdom',
    resultItem: 'draconic_lore_studies',
    unfinishedItem: 'unfinished_dragons',
    requiredPages: 140,
    requiredLevel: 62,
    associatedSkill: { skill: 'knowledge', level: 70 },
    experience: 4200,
    baseTime: 6000,
    materials: [
      { item: 'mystic_paper', quantity: 140 }
    ]
  },
  'planar_travel_guide': {
    name: 'Planar Travel & Dimensional Magic',
    description: 'Navigate between worlds and dimensions safely',
    resultItem: 'planar_travel_guide',
    unfinishedItem: 'unfinished_planar',
    requiredPages: 160,
    requiredLevel: 68,
    associatedSkill: { skill: 'magic', level: 75 },
    experience: 4800,
    baseTime: 6200,
    materials: [
      { item: 'mystic_paper', quantity: 160 }
    ]
  },
  'divine_artifact_creation': {
    name: 'Divine Artifact Creation',
    description: 'Forge legendary items blessed by the gods themselves',
    resultItem: 'divine_artifact_creation',
    unfinishedItem: 'unfinished_divine',
    requiredPages: 175,
    requiredLevel: 72,
    associatedSkill: { skill: 'smithing', level: 80 },
    experience: 5250,
    baseTime: 6500,
    materials: [
      { item: 'mystic_paper', quantity: 175 }
    ]
  },
  'time_manipulation_theory': {
    name: 'Time Manipulation Theory',
    description: 'Bend time itself to your will with ancient temporal magic',
    resultItem: 'time_manipulation_theory',
    unfinishedItem: 'unfinished_temporal',
    requiredPages: 200,
    requiredLevel: 85,
    associatedSkill: { skill: 'magic', level: 90 },
    experience: 6000,
    baseTime: 7000,
    materials: [
      { item: 'mystic_paper', quantity: 200 }
    ]
  },
  
  // === Skill coverage additions ===
  'explosive_handbook': {
    name: 'Demolition & Blasting Manual',
    description: 'Safe handling and effective use of explosives for mining and warfare',
    resultItem: 'explosive_handbook',
    unfinishedItem: 'unfinished_explosive',
    requiredPages: 35,
    requiredLevel: 18,
    associatedSkill: { skill: 'blasting', level: 20 },
    experience: 1050,
    baseTime: 4300,
    materials: [
      { item: 'fine_paper', quantity: 35 }
    ]
  },
  'anatomy_vitality_treatise': {
    name: 'Anatomy & Vitality Treatise',
    description: 'Detailed study of the body to improve endurance and vitality',
    resultItem: 'anatomy_vitality_treatise',
    unfinishedItem: 'unfinished_vitality',
    requiredPages: 40,
    requiredLevel: 20,
    associatedSkill: { skill: 'hitpoints', level: 30 },
    experience: 1200,
    baseTime: 4400,
    materials: [
      { item: 'fine_paper', quantity: 40 }
    ]
  },
  'advanced_herbal_remedies': {
    name: 'Advanced Herbal Remedies',
    description: 'Formulate potent concoctions from rare herbs',
    resultItem: 'advanced_herbal_remedies',
    unfinishedItem: 'unfinished_remedies',
    requiredPages: 60,
    requiredLevel: 30,
    associatedSkill: { skill: 'apothecary', level: 35 },
    experience: 1800,
    baseTime: 5000,
    materials: [
      { item: 'fine_paper', quantity: 60 }
    ]
  },
  'bonecraft_chronicles': {
    name: 'Bonecraft Chronicles',
    description: 'Techniques for crafting tools and art from bone',
    resultItem: 'bonecraft_chronicles',
    unfinishedItem: 'unfinished_bonecraft',
    requiredPages: 50,
    requiredLevel: 28,
    associatedSkill: { skill: 'bonecarving', level: 40 },
    experience: 1500,
    baseTime: 4700,
    materials: [
      { item: 'fine_paper', quantity: 50 }
    ]
  },
  'master_painters_portfolio': {
    name: 'Master Painter\'s Portfolio',
    description: 'Color theory and advanced brush techniques',
    resultItem: 'master_painters_portfolio',
    unfinishedItem: 'unfinished_painting',
    requiredPages: 45,
    requiredLevel: 24,
    associatedSkill: { skill: 'painting', level: 30 },
    experience: 1350,
    baseTime: 4600,
    materials: [
      { item: 'fine_paper', quantity: 45 }
    ]
  },
  'brewers_bible': {
    name: 'Brewer\'s Bible',
    description: 'Recipes and fermentation secrets for exceptional brews',
    resultItem: 'brewers_bible',
    unfinishedItem: 'unfinished_brewing',
    requiredPages: 55,
    requiredLevel: 32,
    associatedSkill: { skill: 'brewing', level: 45 },
    experience: 1650,
    baseTime: 5000,
    materials: [
      { item: 'fine_paper', quantity: 55 }
    ]
  },
  'scribes_lexicon': {
    name: 'Scribe\'s Lexicon',
    description: 'Advanced scripts, calligraphy, and manuscript preservation',
    resultItem: 'scribes_lexicon',
    unfinishedItem: 'unfinished_lexicon',
    requiredPages: 70,
    requiredLevel: 40,
    associatedSkill: { skill: 'scribing', level: 45 },
    experience: 2100,
    baseTime: 5400,
    materials: [
      { item: 'premium_paper', quantity: 70 }
    ]
  },
  'confectioners_compendium': {
    name: 'Confectioner\'s Compendium',
    description: 'Craft decadent sweets and magical desserts',
    resultItem: 'confectioners_compendium',
    unfinishedItem: 'unfinished_confectionery',
    requiredPages: 60,
    requiredLevel: 34,
    associatedSkill: { skill: 'confectionery', level: 40 },
    experience: 1800,
    baseTime: 4800,
    materials: [
      { item: 'fine_paper', quantity: 60 }
    ]
  },
  'tailors_thread_and_needle': {
    name: 'Tailor\'s Thread & Needle',
    description: 'Patterns and stitches for fine garments',
    resultItem: 'tailors_thread_and_needle',
    unfinishedItem: 'unfinished_tailoring',
    requiredPages: 65,
    requiredLevel: 38,
    associatedSkill: { skill: 'tailoring', level: 50 },
    experience: 1950,
    baseTime: 5200,
    materials: [
      { item: 'fine_paper', quantity: 65 }
    ]
  },
  'genesis_codex': {
    name: 'Genesis Codex',
    description: 'Secrets of creation magic and life weaving',
    resultItem: 'genesis_codex',
    unfinishedItem: 'unfinished_genesis',
    requiredPages: 120,
    requiredLevel: 60,
    associatedSkill: { skill: 'creation', level: 70 },
    experience: 3600,
    baseTime: 6000,
    materials: [
      { item: 'premium_paper', quantity: 120 }
    ]
  },
  'couriers_handbook': {
    name: 'Courier\'s Handbook',
    description: 'Swift routes, parcel safety, and message security',
    resultItem: 'couriers_handbook',
    unfinishedItem: 'unfinished_courier',
    requiredPages: 30,
    requiredLevel: 12,
    associatedSkill: { skill: 'delivery', level: 15 },
    experience: 600,
    baseTime: 4200,
    materials: [
      { item: 'paper', quantity: 30 }
    ]
  },
  'ranchers_almanac': {
    name: 'Rancher\'s Almanac',
    description: 'Animal husbandry, feeding schedules, and livestock care',
    resultItem: 'ranchers_almanac',
    unfinishedItem: 'unfinished_ranching',
    requiredPages: 40,
    requiredLevel: 16,
    associatedSkill: { skill: 'ranching', level: 20 },
    experience: 800,
    baseTime: 4300,
    materials: [
      { item: 'paper', quantity: 40 }
    ]
  },
  'candlecraft_manual': {
    name: 'Luminary Candlecraft Manual',
    description: 'Create illuminating and aromatic candles',
    resultItem: 'candlecraft_manual',
    unfinishedItem: 'unfinished_candlemaking',
    requiredPages: 35,
    requiredLevel: 14,
    associatedSkill: { skill: 'candlemaking', level: 18 },
    experience: 700,
    baseTime: 4200,
    materials: [
      { item: 'paper', quantity: 35 }
    ]
  },
  'potters_wheel_manual': {
    name: 'Potter\'s Wheel Manual',
    description: 'Wheel throwing techniques and kiln secrets',
    resultItem: 'potters_wheel_manual',
    unfinishedItem: 'unfinished_pottery',
    requiredPages: 50,
    requiredLevel: 28,
    associatedSkill: { skill: 'pottery', level: 35 },
    experience: 1500,
    baseTime: 4700,
    materials: [
      { item: 'fine_paper', quantity: 50 }
    ]
  },
  
  // === Null-only progression books ===
  'storybook_collection': {
    name: 'Storybook Collection',
    description: 'A charming set of short tales for young adventurers.',
    resultItem: 'storybook_collection',
    unfinishedItem: 'unfinished_storybook',
    requiredPages: 15,
    requiredLevel: 1,
    associatedSkill: null,
    experience: 300,
    baseTime: 3500,
    materials: [
      { item: 'paper', quantity: 15 }
    ]
  },
  'folk_tales': {
    name: 'Folk Tales of the Realm',
    description: 'Popular legends and fireside stories gathered from villages far and wide.',
    resultItem: 'folk_tales',
    unfinishedItem: 'unfinished_folktales',
    requiredPages: 22,
    requiredLevel: 7,
    associatedSkill: null,
    experience: 440,
    baseTime: 3800,
    materials: [
      { item: 'paper', quantity: 22 }
    ]
  },
  'travellers_journal': {
    name: "Traveller's Journal",
    description: 'Notes and sketches from a wanderer\'s voyages across the continent.',
    resultItem: 'travellers_journal',
    unfinishedItem: 'unfinished_journal',
    requiredPages: 28,
    requiredLevel: 12,
    associatedSkill: null,
    experience: 560,
    baseTime: 4000,
    materials: [
      { item: 'paper', quantity: 28 }
    ]
  },
  'merchant_ledgers': {
    name: "Merchant's Ledgers", 
    description: 'Detailed accounts that teach efficient record-keeping and handwriting.',
    resultItem: 'merchant_ledgers',
    unfinishedItem: 'unfinished_ledgers',
    requiredPages: 34,
    requiredLevel: 18,
    associatedSkill: null,
    experience: 680,
    baseTime: 4200,
    materials: [
      { item: 'paper', quantity: 34 }
    ]
  },
  'architectural_sketches': {
    name: 'Architectural Sketches',
    description: 'Elegant drawings showcasing building styles of the realm.',
    resultItem: 'architectural_sketches',
    unfinishedItem: 'unfinished_sketches',
    requiredPages: 40,
    requiredLevel: 24,
    associatedSkill: null,
    experience: 1000,
    baseTime: 4400,
    materials: [
      { item: 'fine_paper', quantity: 40 }
    ]
  },
  'cartographers_notes': {
    name: "Cartographer's Notes", 
    description: 'Hand-drawn maps and annotations of uncharted territories.',
    resultItem: 'cartographers_notes',
    unfinishedItem: 'unfinished_cartography',
    requiredPages: 46,
    requiredLevel: 30,
    associatedSkill: null,
    experience: 1150,
    baseTime: 4600,
    materials: [
      { item: 'fine_paper', quantity: 46 }
    ]
  },
  'philosophical_essays': {
    name: 'Philosophical Essays',
    description: 'Thought-provoking reflections on life, ethics, and purpose.',
    resultItem: 'philosophical_essays',
    unfinishedItem: 'unfinished_essays',
    requiredPages: 52,
    requiredLevel: 36,
    associatedSkill: null,
    experience: 1300,
    baseTime: 4800,
    materials: [
      { item: 'fine_paper', quantity: 52 }
    ]
  },
  'historical_chronicle': {
    name: 'Historical Chronicle',
    description: 'A comprehensive recount of pivotal events in the kingdom\'s past.',
    resultItem: 'historical_chronicle',
    unfinishedItem: 'unfinished_chronicle',
    requiredPages: 60,
    requiredLevel: 45,
    associatedSkill: null,
    experience: 1800,
    baseTime: 5000,
    materials: [
      { item: 'premium_paper', quantity: 60 }
    ]
  },
  'poetry_anthology': {
    name: 'Poetry Anthology',
    description: 'An inspiring collection of poems spanning love, loss, and heroism.',
    resultItem: 'poetry_anthology',
    unfinishedItem: 'unfinished_poetry',
    requiredPages: 75,
    requiredLevel: 55,
    associatedSkill: null,
    experience: 2400,
    baseTime: 5500,
    materials: [
      { item: 'premium_paper', quantity: 75 }
    ]
  },
  'cosmic_reflections': {
    name: 'Cosmic Reflections',
    description: 'Philosophical musings on the stars and one\'s place among them.',
    resultItem: 'cosmic_reflections',
    unfinishedItem: 'unfinished_cosmic',
    requiredPages: 100,
    requiredLevel: 70,
    associatedSkill: null,
    experience: 4000,
    baseTime: 6000,
    materials: [
      { item: 'mystic_paper', quantity: 100 }
    ]
  },
  'bonecarving_compendium': {
    name: 'Bonecarving Compendium',
    description: 'Intermediate techniques for carving and reinforcing bone tools',
    resultItem: 'bonecarving_compendium',
    unfinishedItem: 'unfinished_bone_compendium',
    requiredPages: 45,
    requiredLevel: 30,
    associatedSkill: { skill: 'bonecarving', level: 45 },
    experience: 1500,
    baseTime: 4800,
    materials: [
      { item: 'fine_paper', quantity: 45 }
    ]
  },
  'illuminary_candles': {
    name: 'Illuminary Candles',
    description: 'Advanced fragrances, colors and magical wicks for candles',
    resultItem: 'illuminary_candles',
    unfinishedItem: 'unfinished_candlealchemy',
    requiredPages: 40,
    requiredLevel: 26,
    associatedSkill: { skill: 'candlemaking', level: 35 },
    experience: 1200,
    baseTime: 4600,
    materials: [
      { item: 'fine_paper', quantity: 40 }
    ]
  },
  'kiln_mastery': {
    name: 'Kiln Mastery',
    description: 'Temperature control and glazing secrets for perfect pottery',
    resultItem: 'kiln_mastery',
    unfinishedItem: 'unfinished_kiln',
    requiredPages: 55,
    requiredLevel: 38,
    associatedSkill: { skill: 'pottery', level: 50 },
    experience: 1800,
    baseTime: 5000,
    materials: [
      { item: 'fine_paper', quantity: 55 }
    ]
  },
  'scholars_appendix': {
    name: "Scholar's Appendix",
    description: 'Supplementary notes expanding the Comprehensive Encyclopedia',
    resultItem: 'scholars_appendix',
    unfinishedItem: 'unfinished_appendix',
    requiredPages: 90,
    requiredLevel: 68,
    associatedSkill: { skill: 'knowledge', level: 75 },
    experience: 2700,
    baseTime: 6200,
    materials: [
      { item: 'mystic_paper', quantity: 90 }
    ]
  },
  'deep_sea_angling': {
    name: 'Deep-Sea Angling',
    description: 'Techniques for catching the rarest fish in treacherous waters',
    resultItem: 'deep_sea_angling',
    unfinishedItem: 'unfinished_angling',
    requiredPages: 48,
    requiredLevel: 32,
    associatedSkill: { skill: 'fishing', level: 45 },
    experience: 1440,
    baseTime: 4700,
    materials: [
      { item: 'fine_paper', quantity: 48 }
    ]
  },
  'woodcutting_secrets': {
    name: 'Secrets of the Great Axemen',
    description: 'Advanced tree selection and axe techniques to maximize log yield',
    resultItem: 'woodcutting_secrets',
    unfinishedItem: 'unfinished_wcut_secrets',
    requiredPages: 55,
    requiredLevel: 34,
    associatedSkill: { skill: 'woodcutting', level: 45 },
    experience: 1650,
    baseTime: 5000,
    materials: [ { item: 'fine_paper', quantity: 55 } ]
  },
  'lumberjack_legend': {
    name: 'Lumberjack Legend',
    description: 'Tales and lessons from the realm\'s most famous woodcutters',
    resultItem: 'lumberjack_legend',
    unfinishedItem: 'unfinished_lumberjack',
    requiredPages: 75,
    requiredLevel: 48,
    associatedSkill: { skill: 'woodcutting', level: 60 },
    experience: 2250,
    baseTime: 5400,
    materials: [ { item: 'premium_paper', quantity: 75 } ]
  },
  'miners_handbook': {
    name: 'Miner\'s Handbook',
    description: 'Efficient pick-swinging forms and ore-vein recognition',
    resultItem: 'miners_handbook',
    unfinishedItem: 'unfinished_miners',
    requiredPages: 40,
    requiredLevel: 22,
    associatedSkill: { skill: 'mining', level: 30 },
    experience: 1200,
    baseTime: 4400,
    materials: [ { item: 'fine_paper', quantity: 40 } ]
  },
  'gems_and_geodes': {
    name: 'Gems & Geodes',
    description: 'Identify valuable stones hidden within common rock',
    resultItem: 'gems_and_geodes',
    unfinishedItem: 'unfinished_geology',
    requiredPages: 60,
    requiredLevel: 40,
    associatedSkill: { skill: 'mining', level: 55 },
    experience: 1800,
    baseTime: 5000,
    materials: [ { item: 'fine_paper', quantity: 60 } ]
  },
  'herbal_field_guide': {
    name: 'Herbal Field Guide',
    description: 'Illustrated compendium of wild plants and fungi',
    resultItem: 'herbal_field_guide',
    unfinishedItem: 'unfinished_fieldguide',
    requiredPages: 30,
    requiredLevel: 16,
    associatedSkill: { skill: 'harvesting', level: 25 },
    experience: 800,
    baseTime: 4300,
    materials: [ { item: 'paper', quantity: 30 } ]
  },
  'master_forager': {
    name: 'Master Forager',
    description: 'Routes and seasons for gathering the rarest natural resources',
    resultItem: 'master_forager',
    unfinishedItem: 'unfinished_forager',
    requiredPages: 65,
    requiredLevel: 50,
    associatedSkill: { skill: 'harvesting', level: 65 },
    experience: 1950,
    baseTime: 5400,
    materials: [ { item: 'premium_paper', quantity: 65 } ]
  },
};

// Scroll recipes - what scrolls can be written
const SCROLL_RECIPES = {
  'basic_scroll': {
    name: 'Basic Scroll',
    resultItem: 'basic_scroll',
    requiredPaper: 'paper',
    paperQuantity: 1,
    experience: 10,
    level: 1,
    writingTime: 3000,
    description: 'A simple scroll for basic messages'
  },
  'fine_scroll': {
    name: 'Fine Scroll',
    resultItem: 'fine_scroll',
    requiredPaper: 'fine_paper',
    paperQuantity: 1,
    experience: 20,
    level: 15,
    writingTime: 4000,
    description: 'An elegant scroll made from fine paper'
  },
  'premium_decree': {
    name: 'Premium Decree',
    resultItem: 'premium_decree',
    requiredPaper: 'premium_paper',
    paperQuantity: 2,
    experience: 50,
    level: 40,
    writingTime: 6000,
    description: 'An official decree written on premium paper'
  },
  'mystic_charter': {
    name: 'Mystic Charter',
    resultItem: 'mystic_charter',
    requiredPaper: 'mystic_paper',
    paperQuantity: 3,
    experience: 120,
    level: 70,
    writingTime: 9000,
    description: 'A magical charter inscribed on mystic paper'
  }
};

// Global state tracking
const activeScribing = new Map(); // Track active scribing sessions
const pulpBasinStates = new Map(); // Track pulp basin usage states
const scribingQueue = new Map(); // Track scribing automation queues
const scrollQueue = new Map(); // Track scroll automation queues
const scribingTableStates = new Map(); // Track scribing table usage states

// Click cooldown tracking
const lastClickTimes = new Map(); // Track last click time per basin location
const CLICK_COOLDOWN = 500; // 0.5 seconds in milliseconds

// Initialize scribing system
function initializeScribing() {
  console.log('Initializing scribing system...');
  
  // Add pulp basin interaction handlers to existing world objects
  addPulpBasinInteractionHandlers();
  
  // Add scribing table interaction handlers to existing world objects
  addScribingTableInteractionHandlers();
  
  console.log('Scribing system initialized');
}

// Add interaction handlers to pulp basin objects in the world
function addPulpBasinInteractionHandlers() {
  // Find all pulp basin objects in the world and add click handlers
  document.querySelectorAll('.world-object').forEach(element => {
    const objectType = element.dataset.type;
    if (objectType && objectType === 'pulp_basin') {
      element.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const basinX = parseInt(element.dataset.x);
        const basinY = parseInt(element.dataset.y);
        
        console.log(`Scribing: Clicked on ${objectType} at (${basinX}, ${basinY})`);
        handlePulpBasinClick(objectType, basinX, basinY, element);
      });
    }
  });
}

// Handle clicking on a pulp basin object
function handlePulpBasinClick(basinType, x, y, basinElement) {
  console.log(`Scribing: Clicked ${basinType} at (${x}, ${y})`);
  
  // Check for click cooldown
  const basinKey = `${x},${y}`;
  const now = Date.now();
  const lastClickTime = lastClickTimes.get(basinKey) || 0;
  
  if (now - lastClickTime < CLICK_COOLDOWN) {
    console.log(`Scribing: Click cooldown active for basin at (${x}, ${y})`);
    return;
  }
  
  // Update last click time
  lastClickTimes.set(basinKey, now);
  
  // Check if basin is currently in use
  if (pulpBasinStates.has(basinKey)) {
    showScribingMessage('This pulp basin is currently in use.', 'warning');
    return;
  }
  
  // Get player position and check distance
  const playerPos = window.worldModule?.getPlayerPosition();
  if (!playerPos) {
    console.error('Scribing: Could not get player position');
    return;
  }
  
  const playerX = Math.floor(playerPos.x);
  const playerY = Math.floor(playerPos.y);
  
  // Use Chebyshev distance (OSRS-style) - allows diagonal interactions
  const dx = Math.abs(playerX - x);
  const dy = Math.abs(playerY - y);
  const distance = Math.max(dx, dy);
  console.log(`Scribing: Distance to basin (Chebyshev): ${distance}`);
  
  if (distance > 1) {
    // Too far - move closer
    console.log('Scribing: Too far from basin, moving closer');
    
    window.scribingTarget = {
      basinType: basinType,
      x: x,
      y: y,
      element: basinElement
    };
    
    window.interactionTarget = {
      type: 'scribing',
      basinType: basinType,
      x: x,
      y: y,
      element: basinElement
    };
    
    // Use pathfinding to get adjacent to the basin
    window.worldModule?.movePlayerToInteractiveTarget(x, y);
    return;
  }
  
  // Close enough - show scribing interface
  showScribingInterface(basinType, x, y, basinElement);
}

// Handle direct pulp basin click (called from world module)
function handlePulpBasinClickFromWorld(basinType, x, y, basinElement) {
  // This is called when the player is already adjacent, so skip distance check
  showScribingInterface(basinType, x, y, basinElement);
}

// Show the scribing interface for the pulp basin
function showScribingInterface(basinType, x, y, basinElement) {
  console.log(`Scribing: Showing interface for ${basinType} at (${x}, ${y})`);
  
  // Get player inventory to show available logs and pulps
  const inventory = window.inventoryModule?.getPlayerInventory() || [];
  const profile = window.userModule?.getProfile();
  
  if (!profile) {
    console.error('Scribing: Could not get player profile');
    return;
  }
  
  const playerScribingLevel = profile.skills.scribing || 1;
  
  // Create scribing interface modal
  const modal = document.createElement('div');
  modal.id = 'scribing-interface';
  modal.className = 'modal-overlay';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
  `;
  
  const modalContent = document.createElement('div');
  modalContent.className = 'modal-content scribing-modal';
  modalContent.style.cssText = `
    background: linear-gradient(135deg, #2d1810, #3d2415);
    border: 2px solid #8b6914;
    border-radius: 10px;
    padding: 20px;
    color: #f4e4bc;
    max-width: 600px;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
  `;
  
  modalContent.innerHTML = `
    <div class="scribing-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #8b6914; padding-bottom: 10px;">
      <h2 style="margin: 0; color: #f4e4bc;">🪣 Pulp Basin - Scribing</h2>
      <button id="close-scribing" class="close-button" style="background: #8b4513; border: 1px solid #654321; color: white; width: 30px; height: 30px; border-radius: 4px; cursor: pointer; font-size: 18px; display: flex; align-items: center; justify-content: center; transition: background-color 0.2s;">×</button>
    </div>
    <div class="scribing-content">
      <div class="scribing-section" style="margin-bottom: 25px;">
        <h3 style="color: #f4e4bc; margin-bottom: 15px; border-bottom: 1px solid #654321; padding-bottom: 5px;">Create Paper Pulp (Level ${playerScribingLevel})</h3>
        <div id="pulp-recipes-container"></div>
      </div>
      <div class="scribing-section">
        <h3 style="color: #f4e4bc; margin-bottom: 15px; border-bottom: 1px solid #654321; padding-bottom: 5px;">Create Paper</h3>
        <div id="paper-recipes-container"></div>
      </div>
    </div>
  `;
  
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
  
  // Populate pulp recipes
  populatePulpRecipes(inventory, playerScribingLevel, x, y, basinElement);
  
  // Populate paper recipes
  populatePaperRecipes(inventory, playerScribingLevel, x, y, basinElement);
  
  // Add close button handler
  document.getElementById('close-scribing').addEventListener('click', () => {
    closeScribingInterface();
  });
  
  // Add close button hover effect
  const closeButton = document.getElementById('close-scribing');
  closeButton.addEventListener('mouseenter', () => {
    closeButton.style.backgroundColor = '#a0522d';
  });
  closeButton.addEventListener('mouseleave', () => {
    closeButton.style.backgroundColor = '#8b4513';
  });
  
  // Close on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeScribingInterface();
    }
  });
  
  // Close on escape key
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      closeScribingInterface();
    }
  };
  document.addEventListener('keydown', handleEscape);
  
  // Store the escape handler for cleanup
  modal._handleEscape = handleEscape;
}

// Populate available pulp recipes
function populatePulpRecipes(inventory, playerLevel, x, y, basinElement) {
  const container = document.getElementById('pulp-recipes-container');
  
  for (const [logType, recipe] of Object.entries(PULP_RECIPES)) {
    // Check if player has the required level
    const canMake = playerLevel >= recipe.level;
    const hasLog = inventory.some(item => item && item.id === logType && item.quantity > 0);
    
    // Calculate available logs for this type
    const availableLogs = calculateAvailableItems(logType);
    
    const recipeDiv = document.createElement('div');
    recipeDiv.className = `recipe-item ${canMake ? (hasLog ? 'available' : 'no-materials') : 'level-locked'}`;
    recipeDiv.style.cssText = `
      display: flex;
      flex-direction: column;
      padding: 12px;
      margin: 5px 0;
      border: 1px solid ${canMake ? (hasLog ? '#4a7c59' : '#7c4a4a') : '#666'};
      border-radius: 5px;
      background: ${canMake ? (hasLog ? 'rgba(74, 124, 89, 0.2)' : 'rgba(124, 74, 74, 0.2)') : 'rgba(100, 100, 100, 0.2)'};
      cursor: ${canMake && hasLog ? 'pointer' : 'not-allowed'};
      opacity: ${canMake ? 1 : 0.6};
      transition: all 0.2s;
      gap: 8px;
    `;
    
    const logItem = window.inventoryModule?.getItemDefinition ? window.inventoryModule.getItemDefinition(logType) : null;
    const logIcon = logItem?.getIcon ? logItem.getIcon() : '🪵';
    
    const recipeHeader = document.createElement('div');
    recipeHeader.style.cssText = `
      display: flex;
      align-items: center;
      gap: 12px;
    `;
    
    recipeHeader.innerHTML = `
      <div class="recipe-input" style="font-size: 1.5em; flex-shrink: 0;">${logIcon}</div>
      <div class="recipe-arrow" style="color: #8b6914; font-weight: bold;">→</div>
      <div class="recipe-output" style="font-size: 1.2em; flex-shrink: 0;">🧻</div>
      <div class="recipe-details" style="flex: 1; padding-left: 10px;">
        <div style="font-weight: bold; color: #f4e4bc;">${recipe.name}</div>
        <div style="font-size: 0.9em; color: #90EE90;">Level ${recipe.level} • ${recipe.experience} XP</div>
        ${hasLog ? `<div style="font-size: 0.8em; color: #ddd;">${availableLogs} available</div>` : ''}
      </div>
    `;
    
    recipeDiv.appendChild(recipeHeader);
    
    // Add quantity controls for available recipes
    if (canMake && hasLog) {
      const quantityControls = document.createElement('div');
      quantityControls.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
        padding-top: 8px;
        border-top: 1px solid rgba(139, 105, 20, 0.3);
        flex-wrap: wrap;
        justify-content: center;
      `;
      
      const quantityButtons = [
        { text: '1', value: 1 },
        { text: '5', value: 5 },
        { text: '10', value: 10 },
        { text: 'All', value: availableLogs }
      ].filter(btn => btn.value <= availableLogs);
      
      quantityButtons.forEach(btn => {
        const button = document.createElement('button');
        button.textContent = btn.text;
        button.style.cssText = `
          padding: 6px 12px;
          background: #8b4513;
          border: 1px solid #654321;
          border-radius: 4px;
          color: white;
          cursor: pointer;
          font-size: 0.9em;
          transition: background-color 0.2s;
        `;
        
        button.addEventListener('mouseenter', () => {
          button.style.backgroundColor = '#a0522d';
        });
        
        button.addEventListener('mouseleave', () => {
          button.style.backgroundColor = '#8b4513';
        });
        
        button.addEventListener('click', (e) => {
          e.stopPropagation();
          startPulpCreation(logType, recipe, x, y, basinElement, btn.value);
        });
        
        quantityControls.appendChild(button);
      });
      
      recipeDiv.appendChild(quantityControls);
      
      // Add hover effect for recipe header
      recipeHeader.addEventListener('mouseenter', () => {
        recipeDiv.style.borderColor = '#8b6914';
        recipeDiv.style.boxShadow = '0 0 8px rgba(139, 105, 20, 0.3)';
      });
      
      recipeHeader.addEventListener('mouseleave', () => {
        recipeDiv.style.borderColor = '#4a7c59';
        recipeDiv.style.boxShadow = 'none';
      });
      
      // Single click on recipe header makes 1
      recipeHeader.addEventListener('click', () => {
        startPulpCreation(logType, recipe, x, y, basinElement, 1);
      });
    }
    
    container.appendChild(recipeDiv);
  }
}

// Populate available paper recipes  
function populatePaperRecipes(inventory, playerLevel, x, y, basinElement) {
  const container = document.getElementById('paper-recipes-container');
  
  for (const [pulpType, recipe] of Object.entries(PAPER_RECIPES)) {
    // Check if player has the required level
    const canMake = playerLevel >= recipe.level;
    const hasPulp = inventory.some(item => item && item.id === pulpType && item.quantity > 0);
    
    // Calculate available pulps for this type
    const availablePulps = calculateAvailableItems(pulpType);
    
    const recipeDiv = document.createElement('div');
    recipeDiv.className = `recipe-item ${canMake ? (hasPulp ? 'available' : 'no-materials') : 'level-locked'}`;
    recipeDiv.style.cssText = `
      display: flex;
      flex-direction: column;
      padding: 12px;
      margin: 5px 0;
      border: 1px solid ${canMake ? (hasPulp ? '#4a7c59' : '#7c4a4a') : '#666'};
      border-radius: 5px;
      background: ${canMake ? (hasPulp ? 'rgba(74, 124, 89, 0.2)' : 'rgba(124, 74, 74, 0.2)') : 'rgba(100, 100, 100, 0.2)'};
      cursor: ${canMake && hasPulp ? 'pointer' : 'not-allowed'};
      opacity: ${canMake ? 1 : 0.6};
      transition: all 0.2s;
      gap: 8px;
    `;
    
    const recipeHeader = document.createElement('div');
    recipeHeader.style.cssText = `
      display: flex;
      align-items: center;
      gap: 12px;
    `;
    
    recipeHeader.innerHTML = `
      <div class="recipe-input" style="font-size: 1.5em; flex-shrink: 0;">🧻</div>
      <div class="recipe-arrow" style="color: #8b6914; font-weight: bold;">→</div>
      <div class="recipe-output" style="font-size: 1.2em; flex-shrink: 0;">📄</div>
      <div class="recipe-details" style="flex: 1; padding-left: 10px;">
        <div style="font-weight: bold; color: #f4e4bc;">${recipe.name}</div>
        <div style="font-size: 0.9em; color: #90EE90;">Level ${recipe.level} • ${recipe.experience} XP</div>
        ${hasPulp ? `<div style="font-size: 0.8em; color: #ddd;">${availablePulps} available</div>` : ''}
      </div>
    `;
    
    recipeDiv.appendChild(recipeHeader);
    
    // Add quantity controls for available recipes
    if (canMake && hasPulp) {
      const quantityControls = document.createElement('div');
      quantityControls.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
        padding-top: 8px;
        border-top: 1px solid rgba(139, 105, 20, 0.3);
        flex-wrap: wrap;
        justify-content: center;
      `;
      
      const quantityButtons = [
        { text: '1', value: 1 },
        { text: '5', value: 5 },
        { text: '10', value: 10 },
        { text: 'All', value: availablePulps }
      ].filter(btn => btn.value <= availablePulps);
      
      quantityButtons.forEach(btn => {
        const button = document.createElement('button');
        button.textContent = btn.text;
        button.style.cssText = `
          padding: 6px 12px;
          background: #8b4513;
          border: 1px solid #654321;
          border-radius: 4px;
          color: white;
          cursor: pointer;
          font-size: 0.9em;
          transition: background-color 0.2s;
        `;
        
        button.addEventListener('mouseenter', () => {
          button.style.backgroundColor = '#a0522d';
        });
        
        button.addEventListener('mouseleave', () => {
          button.style.backgroundColor = '#8b4513';
        });
        
        button.addEventListener('click', (e) => {
          e.stopPropagation();
          startPaperCreation(pulpType, recipe, x, y, basinElement, btn.value);
        });
        
        quantityControls.appendChild(button);
      });
      
      recipeDiv.appendChild(quantityControls);
      
      // Add hover effect for recipe header
      recipeHeader.addEventListener('mouseenter', () => {
        recipeDiv.style.borderColor = '#8b6914';
        recipeDiv.style.boxShadow = '0 0 8px rgba(139, 105, 20, 0.3)';
      });
      
      recipeHeader.addEventListener('mouseleave', () => {
        recipeDiv.style.borderColor = '#4a7c59';
        recipeDiv.style.boxShadow = 'none';
      });
      
      // Single click on recipe header makes 1
      recipeHeader.addEventListener('click', () => {
        startPaperCreation(pulpType, recipe, x, y, basinElement, 1);
      });
    }
    
    container.appendChild(recipeDiv);
  }
}

// Calculate available items of a specific type in inventory
function calculateAvailableItems(itemId) {
  const inventory = window.inventoryModule?.getPlayerInventory() || [];
  let totalCount = 0;
  
  for (const item of inventory) {
    if (item && item.id === itemId) {
      totalCount += item.quantity || 1;
    }
  }
  
  return totalCount;
}

// Find item slot in inventory
function findItemInInventory(itemId) {
  const inventory = window.inventoryModule?.getPlayerInventory() || [];
  for (let i = 0; i < inventory.length; i++) {
    if (inventory[i] && inventory[i].id === itemId) {
      return i;
    }
  }
  return -1;
}

// Start creating paper pulp from logs
function startPulpCreation(logType, recipe, x, y, basinElement, quantity = 1) {
  console.log(`Scribing: Starting pulp creation: ${logType} -> ${recipe.resultItem} (quantity: ${quantity})`);
  
  if (quantity > 1) {
    // Start queue processing for multiple items
    startScribingQueue('pulp', logType, recipe, x, y, basinElement, quantity);
    return;
  }
  
  // Single item processing
  const inventory = window.inventoryModule?.getPlayerInventory() || [];
  const logSlot = inventory.findIndex(item => item && item.id === logType && item.quantity > 0);
  
  if (logSlot === -1) {
    showScribingMessage(`You need ${logType.replace('_', ' ')} to make ${recipe.name}.`, 'error');
    return;
  }
  
  // Remove ONE log from inventory (fix for stack consumption)
  try {
    const currentItem = inventory[logSlot];
    if (currentItem.quantity > 1) {
      // Decrease quantity by 1
      currentItem.quantity -= 1;
      window.inventoryModule?.updateInventoryDisplay();
    } else {
      // Remove the entire item if quantity is 1
      window.inventoryModule?.removeItemFromInventorySlot(logSlot);
    }
    console.log(`Scribing: Successfully removed 1 ${logType} from slot ${logSlot}`);
  } catch (error) {
    console.error('Scribing: Error removing log from inventory:', error);
    showScribingMessage('Failed to remove log from inventory.', 'error');
    return;
  }
  
  // Close the interface
  closeScribingInterface();
  
  // Mark basin as in use
  const basinKey = `${x},${y}`;
  pulpBasinStates.set(basinKey, {
    type: 'pulp',
    recipe: recipe,
    startTime: Date.now()
  });
  
  // Start scribing session
  const scribingSession = {
    type: 'pulp',
    recipe: recipe,
    x: x,
    y: y,
    element: basinElement,
    startTime: Date.now(),
    duration: recipe.processingTime
  };
  
  activeScribing.set('player', scribingSession);
  
  // Start animation
  startScribingAnimation();
  
  showScribingMessage(`You begin creating ${recipe.name}...`, 'info');
  
  // Set timer to complete the process
  setTimeout(() => {
    completePulpCreation('player');
  }, recipe.processingTime);
}

// Start creating paper from pulp
function startPaperCreation(pulpType, recipe, x, y, basinElement, quantity = 1) {
  console.log(`Scribing: Starting paper creation: ${pulpType} -> ${recipe.resultItem} (quantity: ${quantity})`);
  
  if (quantity > 1) {
    // Start queue processing for multiple items
    startScribingQueue('paper', pulpType, recipe, x, y, basinElement, quantity);
    return;
  }
  
  // Single item processing
  const inventory = window.inventoryModule?.getPlayerInventory() || [];
  const pulpSlot = inventory.findIndex(item => item && item.id === pulpType && item.quantity > 0);
  
  if (pulpSlot === -1) {
    showScribingMessage(`You need ${pulpType.replace('_', ' ')} to make ${recipe.name}.`, 'error');
    return;
  }
  
  // Remove ONE pulp from inventory (fix for stack consumption)
  try {
    const currentItem = inventory[pulpSlot];
    if (currentItem.quantity > 1) {
      // Decrease quantity by 1
      currentItem.quantity -= 1;
      window.inventoryModule?.updateInventoryDisplay();
    } else {
      // Remove the entire item if quantity is 1
      window.inventoryModule?.removeItemFromInventorySlot(pulpSlot);
    }
    console.log(`Scribing: Successfully removed 1 ${pulpType} from slot ${pulpSlot}`);
  } catch (error) {
    console.error('Scribing: Error removing pulp from inventory:', error);
    showScribingMessage('Failed to remove pulp from inventory.', 'error');
    return;
  }
  
  // Close the interface
  closeScribingInterface();
  
  // Mark basin as in use
  const basinKey = `${x},${y}`;
  pulpBasinStates.set(basinKey, {
    type: 'paper',
    recipe: recipe,
    startTime: Date.now()
  });
  
  // Start scribing session
  const scribingSession = {
    type: 'paper',
    recipe: recipe,
    x: x,
    y: y,
    element: basinElement,
    startTime: Date.now(),
    duration: recipe.processingTime
  };
  
  activeScribing.set('player', scribingSession);
  
  // Start animation
  startScribingAnimation();
  
  showScribingMessage(`You begin creating ${recipe.name}...`, 'info');
  
  // Set timer to complete the process
  setTimeout(() => {
    completePaperCreation('player');
  }, recipe.processingTime);
}

// Start scribing queue for automation
function startScribingQueue(type, materialType, recipe, x, y, basinElement, quantity) {
  console.log(`Scribing: Starting ${type} queue for ${quantity} items`);
  
  const playerId = 'player';
  
  // Close the interface
  closeScribingInterface();
  
  // Create queue entry
  const queue = {
    type: type, // 'pulp' or 'paper'
    materialType: materialType,
    recipe: recipe,
    x: x,
    y: y,
    element: basinElement,
    total: quantity,
    remaining: quantity,
    materialSlot: null // Will be updated each iteration
  };
  
  scribingQueue.set(playerId, queue);
  
  // Start processing the queue
  processScribingQueue(playerId);
}

// Process scribing queue
function processScribingQueue(playerId) {
  const queue = scribingQueue.get(playerId);
  if (!queue) {
    console.log('Scribing: No queue found for processing');
    return;
  }
  
  if (queue.remaining <= 0) {
    console.log('Scribing: Queue completed');
    scribingQueue.delete(playerId);
    showScribingMessage(`Completed ${queue.type} creation! Made ${queue.total} items.`, 'success');
    return;
  }
  
  // Find current material slot
  const inventory = window.inventoryModule?.getPlayerInventory() || [];
  const currentMaterialSlot = inventory.findIndex(item => item && item.id === queue.materialType && item.quantity > 0);
  
  if (currentMaterialSlot === -1) {
    console.log(`Scribing: No more ${queue.materialType} available, stopping queue`);
    scribingQueue.delete(playerId);
    const completed = queue.total - queue.remaining;
    showScribingMessage(`Ran out of materials! Completed ${completed}/${queue.total} items.`, 'info');
    return;
  }
  
  // Update queue with current material slot
  queue.materialSlot = currentMaterialSlot;
  
  // Show queue progress
  showScribingMessage(`Creating ${queue.type} (${queue.total - queue.remaining + 1}/${queue.total})...`, 'info');
  
  // Start the actual scribing (single item)
  if (queue.type === 'pulp') {
    startPulpCreation(queue.materialType, queue.recipe, queue.x, queue.y, queue.element, 1);
  } else {
    startPaperCreation(queue.materialType, queue.recipe, queue.x, queue.y, queue.element, 1);
  }
}

// Complete pulp creation
function completePulpCreation(playerId) {
  const scribingSession = activeScribing.get(playerId);
  if (!scribingSession || scribingSession.type !== 'pulp') return;
  
  console.log(`Scribing: Completing pulp creation for ${scribingSession.recipe.name}`);
  
  // Stop animation
  stopScribingAnimation();
  
  // Clear basin state
  const basinKey = `${scribingSession.x},${scribingSession.y}`;
  pulpBasinStates.delete(basinKey);
  
  // Add the pulp to player inventory
  const resultQuantity = scribingSession.recipe.resultQuantity || 1;
  const success = window.inventoryModule?.addItemToInventory(scribingSession.recipe.resultItem, resultQuantity);
  
  if (success) {
    // Add experience
    const profile = window.userModule?.getProfile();
    if (profile) {
      console.log(`📜 Scribing: Adding ${scribingSession.recipe.experience} XP to scribing skill`);
      
      const leveledUp = addExperience('scribing', scribingSession.recipe.experience, profile.skills, profile.skillsExp);
      
      // Update UI
      if (window.uiModule && window.uiModule.updateSkillDisplay) {
        window.uiModule.updateSkillDisplay('scribing', profile.skills.scribing, leveledUp);
        if (leveledUp) {
          window.uiModule.updateTotalLevel(profile.skills);
        }
      }
      
      // Update experience bar
      if (window.uiModule && window.uiModule.updateSkillExperienceBar) {
        window.uiModule.updateSkillExperienceBar('scribing');
      }
      
      // Save profile
      if (window.userModule?.saveProfile) {
        window.userModule.saveProfile();
      }
      
      // Sync with server if online
      if (window.syncSkillsWithServer && window.isUserOnline && window.isUserOnline()) {
        const totalLevel = window.calculateTotalLevel ? window.calculateTotalLevel(profile.skills) : 0;
        const combatLevel = window.calculateCombatLevel ? window.calculateCombatLevel(profile.skills) : 0;
        window.syncSkillsWithServer(profile.skills, totalLevel, combatLevel, profile.skillsExp);
      }
      
      if (leveledUp) {
        showScribingMessage(`Level up! Your Scribing level is now ${profile.skills.scribing}!`, 'success');
      }
    }
    
    // Check if this was part of a queue
    const queue = scribingQueue.get(playerId);
    if (queue && queue.type === 'pulp') {
      queue.remaining -= 1;
      console.log(`Scribing: Queue progress - ${queue.remaining} items remaining`);
      
      // Clean up scribing session first
      activeScribing.delete(playerId);
      
      // Continue queue processing after a short delay
      setTimeout(() => {
        processScribingQueue(playerId);
      }, 500); // Small delay between items
    } else {
      // Single item completion
      showScribingMessage(`You successfully create ${scribingSession.recipe.name}.`, 'success');
      activeScribing.delete(playerId);
    }
  } else {
    showScribingMessage('Your inventory is full!', 'error');
    
    // Stop queue if inventory is full
    if (scribingQueue.has(playerId)) {
      const queue = scribingQueue.get(playerId);
      const completed = queue.total - queue.remaining;
      scribingQueue.delete(playerId);
      showScribingMessage(`Inventory full! Completed ${completed}/${queue.total} items.`, 'info');
    }
    
    activeScribing.delete(playerId);
  }
}

// Complete paper creation
function completePaperCreation(playerId) {
  const scribingSession = activeScribing.get(playerId);
  if (!scribingSession || scribingSession.type !== 'paper') return;
  
  console.log(`Scribing: Completing paper creation for ${scribingSession.recipe.name}`);
  
  // Stop animation
  stopScribingAnimation();
  
  // Clear basin state
  const basinKey = `${scribingSession.x},${scribingSession.y}`;
  pulpBasinStates.delete(basinKey);
  
  // Add the paper to player inventory
  const resultQuantity = scribingSession.recipe.resultQuantity || 1;
  const success = window.inventoryModule?.addItemToInventory(scribingSession.recipe.resultItem, resultQuantity);
  
  if (success) {
    // Add experience
    const profile = window.userModule?.getProfile();
    if (profile) {
      console.log(`📜 Scribing: Adding ${scribingSession.recipe.experience} XP to scribing skill`);
      
      const leveledUp = addExperience('scribing', scribingSession.recipe.experience, profile.skills, profile.skillsExp);
      
      // Update UI
      if (window.uiModule && window.uiModule.updateSkillDisplay) {
        window.uiModule.updateSkillDisplay('scribing', profile.skills.scribing, leveledUp);
        if (leveledUp) {
          window.uiModule.updateTotalLevel(profile.skills);
        }
      }
      
      // Update experience bar
      if (window.uiModule && window.uiModule.updateSkillExperienceBar) {
        window.uiModule.updateSkillExperienceBar('scribing');
      }
      
      // Save profile
      if (window.userModule?.saveProfile) {
        window.userModule.saveProfile();
      }
      
      // Sync with server if online
      if (window.syncSkillsWithServer && window.isUserOnline && window.isUserOnline()) {
        const totalLevel = window.calculateTotalLevel ? window.calculateTotalLevel(profile.skills) : 0;
        const combatLevel = window.calculateCombatLevel ? window.calculateCombatLevel(profile.skills) : 0;
        window.syncSkillsWithServer(profile.skills, totalLevel, combatLevel, profile.skillsExp);
      }
      
      if (leveledUp) {
        showScribingMessage(`Level up! Your Scribing level is now ${profile.skills.scribing}!`, 'success');
      }
    }
    
    // Check if this was part of a queue
    const queue = scribingQueue.get(playerId);
    if (queue && queue.type === 'paper') {
      queue.remaining -= 1;
      console.log(`Scribing: Queue progress - ${queue.remaining} items remaining`);
      
      // Clean up scribing session first
      activeScribing.delete(playerId);
      
      // Continue queue processing after a short delay
      setTimeout(() => {
        processScribingQueue(playerId);
      }, 500); // Small delay between items
    } else {
      // Single item completion
      showScribingMessage(`You successfully create ${scribingSession.recipe.name}.`, 'success');
      activeScribing.delete(playerId);
    }
  } else {
    showScribingMessage('Your inventory is full!', 'error');
    
    // Stop queue if inventory is full
    if (scribingQueue.has(playerId)) {
      const queue = scribingQueue.get(playerId);
      const completed = queue.total - queue.remaining;
      scribingQueue.delete(playerId);
      showScribingMessage(`Inventory full! Completed ${completed}/${queue.total} items.`, 'info');
    }
    
    activeScribing.delete(playerId);
  }
}

// Close the scribing interface
function closeScribingInterface() {
  const modal = document.getElementById('scribing-interface');
  if (modal) {
    // Remove escape key handler if it exists
    const handleEscape = modal._handleEscape;
    if (handleEscape) {
      document.removeEventListener('keydown', handleEscape);
    }
    
    modal.remove();
  }
}

// Start scribing animation using standardized skill bubble system
function startScribingAnimation() {
  showSkillBubble('scribing');
}

// Stop scribing animation using standardized skill bubble system
function stopScribingAnimation() {
  hideSkillBubble();
}

// Cancel scribing (when player moves away)
function cancelScribing(playerId = 'player') {
  const scribingSession = activeScribing.get(playerId);
  const queue = scribingQueue.get(playerId);
  
  if (scribingSession || queue) {
    console.log('Scribing: Cancelling scribing session and/or queue');
    
    stopScribingAnimation();
    
    // Clear basin state if there was an active session
    if (scribingSession) {
      const basinKey = `${scribingSession.x},${scribingSession.y}`;
      pulpBasinStates.delete(basinKey);
    }
    
    // Clean up session and queue
    activeScribing.delete(playerId);
    
    if (queue) {
      const completed = queue.total - queue.remaining;
      scribingQueue.delete(playerId);
      
      if (completed > 0) {
        showScribingMessage(`Scribing interrupted. Completed ${completed}/${queue.total} items.`, 'info');
      } else {
        showScribingMessage('Scribing interrupted.', 'info');
      }
    } else {
      showScribingMessage('Scribing interrupted.', 'info');
    }
  }
}

// Check if player is currently scribing
function isScribing(playerId = 'player') {
  return activeScribing.has(playerId);
}

// Show scribing-related messages
function showScribingMessage(message, type = 'info') {
  if (window.uiModule && window.uiModule.showNotification) {
    window.uiModule.showNotification(message, type);
  } else {
    console.log(`Scribing ${type}: ${message}`);
  }
}

// Handle movement completion - check for interaction targets
function handleMovementComplete() {
  // Check for direct scribing target first
  if (window.scribingTarget) {
    console.log('Scribing: Movement complete, showing scribing interface (direct target)');
    const target = window.scribingTarget;
    showScribingInterface(target.basinType, target.x, target.y, target.element);
    window.scribingTarget = null; // Clear the target
    return;
  }
  
  // Check for world module interaction target
  if (window.interactionTarget && window.interactionTarget.type === 'scribing') {
    console.log('Scribing: Movement complete, showing scribing interface (interaction target)');
    const target = window.interactionTarget;
    showScribingInterface(target.basinType, target.x, target.y, target.element);
    // Note: interactionTarget will be cleared by world.js movement handler
    return;
  }
}

// Get the current active scribing session for external modules
function getActiveScribingSession(playerId = 'player') {
  return activeScribing.get(playerId);
}

// ============= SCRIBING TABLE FUNCTIONALITY =============

let activeScribingTableInterface = null;

// Add interaction handlers to scribing table objects in the world
function addScribingTableInteractionHandlers() {
  document.querySelectorAll('.world-object').forEach(element => {
    const objectType = element.dataset.type;
    if (objectType && objectType === 'scribing_table') {
      element.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const tableX = parseInt(element.dataset.x);
        const tableY = parseInt(element.dataset.y);
        
        console.log(`Scribing: Clicked on ${objectType} at (${tableX}, ${tableY})`);
        handleScribingTableClick(objectType, tableX, tableY, element);
      });
    }
  });
}

// Handle clicking on a scribing table object
function handleScribingTableClick(tableType, x, y, tableElement) {
  console.log(`Scribing: Clicked ${tableType} at (${x}, ${y})`);
  
  // Check for click cooldown
  const tableKey = `${x},${y}`;
  const now = Date.now();
  const lastClickTime = lastClickTimes.get(tableKey) || 0;
  
  if (now - lastClickTime < CLICK_COOLDOWN) {
    console.log(`Scribing: Click cooldown active for table at (${x}, ${y})`);
    return;
  }
  
  // Update last click time
  lastClickTimes.set(tableKey, now);
  
  // Check if table is currently in use
  if (scribingTableStates.has(tableKey)) {
    showScribingMessage('This scribing table is currently in use.', 'warning');
    return;
  }
  
  // Get player position and check distance
  const playerPos = window.worldModule?.getPlayerPosition();
  if (!playerPos) {
    console.error('Scribing: Could not get player position');
    return;
  }
  
  const playerX = Math.floor(playerPos.x);
  const playerY = Math.floor(playerPos.y);
  
  // Use Chebyshev distance (OSRS-style) - allows diagonal interactions
  const dx = Math.abs(playerX - x);
  const dy = Math.abs(playerY - y);
  const distance = Math.max(dx, dy);
  console.log(`Scribing: Distance to table (Chebyshev): ${distance}`);
  
  if (distance > 1) {
    // Too far - move closer
    console.log('Scribing: Too far from table, moving closer');
    
    window.scribingTableTarget = {
      tableType: tableType,
      x: x,
      y: y,
      element: tableElement
    };
    
    window.interactionTarget = {
      type: 'scribing_table',
      tableType: tableType,
      x: x,
      y: y,
      element: tableElement
    };
    
    // Move to adjacent tile
    const moveTargetX = x + (playerX < x ? -1 : playerX > x ? 1 : 0);
    const moveTargetY = y + (playerY < y ? -1 : playerY > y ? 1 : 0);
    
    if (window.worldModule && window.worldModule.movePlayer) {
      window.worldModule.movePlayer(moveTargetX, moveTargetY);
    }
    return;
  }
  
  // Close enough - open scribing table interface directly
  showScribingTableInterface(tableType, x, y, tableElement);
}

// Show the scribing table interface
function showScribingTableInterface(tableType, x, y, tableElement) {
  console.log(`Scribing: Opening ${tableType} interface at (${x}, ${y})`);
  
  // Close any existing interface
  if (activeScribingTableInterface) {
    closeScribingTableInterface();
  }
  
  // Get player data
  const inventory = window.inventoryModule?.getPlayerInventory() || [];
  const profile = window.userModule?.getProfile();
  const playerLevel = profile?.skills.scribing || 1;
  
  // Create scribing table interface modal (using same pattern as pulp basin)
  const modal = document.createElement('div');
  modal.id = 'scribing-table-interface';
  modal.className = 'modal-overlay';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
  `;
  
  // Create interface container
  const container = document.createElement('div');
  container.className = 'scribing-table-container';
  container.style.cssText = `
    background: linear-gradient(135deg, #2c1810 0%, #4a2c1a 100%);
    border: 3px solid #8b4513;
    border-radius: 15px;
    width: 90%;
    max-width: 900px;
    max-height: 80%;
    overflow-y: auto;
    box-shadow: 0 0 30px rgba(139, 69, 19, 0.6);
    position: relative;
  `;
  
  // Add skill emojis mapping
  const skillEmojis = {
    // Combat Skills
    attack: '⚔️',
    magic: '🪄', 
    ranged: '🏹',
    blasting: '💣',
    defence: '🛡️',
    hitpoints: '❤️',
    prayer: '✨',
    slayer: '☠️',
    
    // Gathering Skills
    mining: '⛏️',
    fishing: '🎣',
    woodcutting: '🌲',
    harvesting: '🍄',
    
    // Artisan Skills
    smithing: '🔨',
    cooking: '🍖',
    fletching: '🪶',
    apothecary: '🌿',
    crafting: '💍',
    bonecarving: '🦴',
    painting: '🎨',
    brewing: '🍺',
    scribing: '📜',
    confectionery: '🍰',
    masonry: '🧱',
    tailoring: '🪡',
    
    // Support Skills
    thieving: '🎭️',
    alchemy: '⚖️',
    creation: '🐣',
    delivery: '✉️',
    ranching: '🐄',
    knowledge: '📚',
    candlemaking: '🕯️',
    pottery: '🏺',
    apiary: '🐝',
    taming: '🐕',
    dracology: '🐉',
    engineering: '⚙️',
    digging: '🪏',
    diplomacy: '🕊️'
  };
  
  container.innerHTML = `
    <div style="padding: 20px;">
      <div style="text-align: center; margin-bottom: 20px; position: relative;">
        <h2 style="color: #d4af37; font-size: 2em; margin: 0; text-shadow: 2px 2px 4px rgba(0,0,0,0.8);">📜 Scribing Table</h2>
        <button id="close-scribing-table" style="
          position: absolute;
          top: 0;
          right: 0;
          background: #8b4513;
          color: #f4e4bc;
          border: 2px solid #654321;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          cursor: pointer;
          font-weight: bold;
          font-size: 1.2em;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          transition: all 0.3s ease;
        " title="Close">✕</button>
      </div>
      
      <!-- Main Tab Navigation -->
      <div style="display: flex; gap: 5px; margin-bottom: 15px; border-bottom: 2px solid #8b4513; padding-bottom: 10px;">
        <button class="scribing-tab active" data-tab="new-books" style="
          background: #8b6914;
          color: #f4e4bc;
          border: 2px solid #654321;
          padding: 12px 20px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: bold;
          font-size: 1em;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          transition: all 0.3s ease;
        ">📖 New Books</button>
        <button class="scribing-tab" data-tab="unfinished-books" style="
          background: #654321;
          color: #cccccc;
          border: 2px solid #654321;
          padding: 12px 20px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: bold;
          font-size: 1em;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          transition: all 0.3s ease;
        ">📚 Continue Books</button>
        <button class="scribing-tab" data-tab="scrolls" style="
          background: #654321;
          color: #cccccc;
          border: 2px solid #654321;
          padding: 12px 20px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: bold;
          font-size: 1em;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          transition: all 0.3s ease;
        ">📜 Scrolls</button>
      </div>
      
      <!-- New Books Tab -->
      <div id="new-books-tab-content" class="scribing-tab-content" style="display: block;">
        <!-- Skill Filter Navigation -->
        <div style="display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #654321;">
          <button class="skill-tab active" data-skill="all" style="
            background: linear-gradient(135deg, #d4af37 0%, #f4e87c 50%, #d4af37 100%);
            color: #2c1810;
            border: 2px solid #b8860b;
            padding: 6px 12px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: bold;
            font-size: 0.85em;
            white-space: nowrap;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            transition: all 0.3s ease;
          ">🔖 All</button>
          <button class="skill-tab" data-skill="null" style="
            background: linear-gradient(135deg, #4a4a4a 0%, #6a6a6a 50%, #4a4a4a 100%);
            color: #ffffff;
            border: 2px solid #333333;
            padding: 6px 12px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: bold;
            font-size: 0.85em;
            white-space: nowrap;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            transition: all 0.3s ease;
          ">📖 General</button>
          ${Object.keys(skillsData).map(skill => `
            <button class="skill-tab" data-skill="${skill}" style="
              background: linear-gradient(135deg, #4a4a4a 0%, #6a6a6a 50%, #4a4a4a 100%);
              color: #ffffff;
              border: 2px solid #333333;
              padding: 6px 12px;
              border-radius: 6px;
              cursor: pointer;
              font-weight: bold;
              font-size: 0.85em;
              white-space: nowrap;
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
              transition: all 0.3s ease;
            ">${skillEmojis[skill] || '📋'} ${skill.charAt(0).toUpperCase() + skill.slice(1)}</button>
          `).join('')}
        </div>
        
        <!-- Filtered Books Container -->
        <div id="filtered-books" style="
          max-height: 400px;
          overflow-y: auto;
          background: rgba(0, 0, 0, 0.3);
          border: 2px solid #8b4513;
          border-radius: 10px;
          padding: 15px;
        ">
          <!-- Books will be populated here -->
        </div>
      </div>
      
      <!-- Unfinished Books Tab -->
      <div id="unfinished-books-tab-content" class="scribing-tab-content" style="display: none;">
        <div id="unfinished-books" style="
          max-height: 400px;
          overflow-y: auto;
          background: rgba(0, 0, 0, 0.3);
          border: 2px solid #8b4513;
          border-radius: 10px;
          padding: 15px;
        ">
          <!-- Unfinished books will be populated here -->
        </div>
      </div>
      
      <!-- Scrolls Tab -->
      <div id="scrolls-tab-content" class="scribing-tab-content" style="display: none;">
        <div id="scroll-recipes" style="
          max-height: 400px;
          overflow-y: auto;
          background: rgba(0, 0, 0, 0.3);
          border: 2px solid #8b4513;
          border-radius: 10px;
          padding: 15px;
        ">
          <!-- Scroll recipes will be populated here -->
        </div>
      </div>
      

    </div>
  `;
  
  modal.appendChild(container);
  document.body.appendChild(modal);
  
  // Store reference
  activeScribingTableInterface = {
    element: modal,
    x: x,
    y: y,
    tableElement: tableElement
  };
  
  // Add main tab click handlers
  container.querySelectorAll('.scribing-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      switchScribingTab(tabName);
      
      // Load appropriate content based on tab
      if (tabName === 'new-books') {
        filterBooksBySkill('all', inventory, playerLevel);
      } else if (tabName === 'unfinished-books') {
        populateUnfinishedBooks(inventory, playerLevel, x, y, tableElement);
      } else if (tabName === 'scrolls') {
        populateScrollRecipes(inventory, playerLevel, x, y, tableElement);
      }
    });
  });
  
  // Add skill filter tab click handlers  
  container.querySelectorAll('.skill-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      // Remove active class from all skill tabs
      container.querySelectorAll('.skill-tab').forEach(t => {
        t.classList.remove('active');
        t.style.background = 'linear-gradient(135deg, #4a4a4a 0%, #6a6a6a 50%, #4a4a4a 100%)';
        t.style.color = '#ffffff';
        t.style.border = '2px solid #333333';
      });
      
      // Add active class to clicked tab
      tab.classList.add('active');
      tab.style.background = 'linear-gradient(135deg, #d4af37 0%, #f4e87c 50%, #d4af37 100%)';
      tab.style.color = '#2c1810';
      tab.style.border = '2px solid #b8860b';
      
      // Filter books by skill
      const skill = tab.dataset.skill;
      filterBooksBySkill(skill, inventory, playerLevel);
    });
  });
  
  // Initially load new books tab and show all books
  populateUnfinishedBooks(inventory, playerLevel, x, y, tableElement);
  populateScrollRecipes(inventory, playerLevel, x, y, tableElement);
  filterBooksBySkill('all', inventory, playerLevel);
  
  // Add close button event handler (X button)
  const closeButton = container.querySelector('#close-scribing-table');
  if (closeButton) {
    closeButton.addEventListener('click', () => {
      closeScribingTableInterface();
    });

    // Add hover effect to close button
    closeButton.addEventListener('mouseenter', () => {
      closeButton.style.background = '#a0522d';
      closeButton.style.transform = 'scale(1.1)';
    });
    
    closeButton.addEventListener('mouseleave', () => {
      closeButton.style.background = '#8b4513';
      closeButton.style.transform = 'scale(1)';
    });
  }

  // Add escape key handler
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      closeScribingTableInterface();
    }
  };
  
  document.addEventListener('keydown', handleEscape);
  
  // Store escape handler for cleanup
  activeScribingTableInterface.escapeHandler = handleEscape;

  // Close on background click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeScribingTableInterface();
    }
  });
}

// New function to filter books by skill
function filterBooksBySkill(skillFilter, inventory, playerLevel) {
  const container = document.getElementById('filtered-books');
  if (!container) return;
  
  container.innerHTML = '';
  
  // Get player's completed books for gold background
  const profile = window.userModule?.getProfile();
  const completedBooks = profile?.completedBooks || [];

  
  // Filter books based on the selected skill
  const filteredBooks = Object.entries(BOOK_RECIPES)
    .filter(([bookId, recipe]) => {
      if (skillFilter === 'all') return true;
      if (skillFilter === 'null') return !recipe.associatedSkill;
      return recipe.associatedSkill && recipe.associatedSkill.skill === skillFilter;
    })
    .sort((a,b)=>a[1].requiredLevel-b[1].requiredLevel);
  
  if (filteredBooks.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px; color: #cccccc; font-style: italic;">
        <p>No books available for this skill yet.</p>
        <p style="font-size: 0.9em; margin-top: 10px;">Check back later as more books are added to the game!</p>
      </div>
    `;
    return;
  }
  
  filteredBooks.forEach(([bookId, recipe]) => {
    // Check requirements
    const paperType = recipe.materials[0].item;
    const paperSlot = inventory.findIndex(item => item && item.id === paperType);
    const hasLevelRequirement = playerLevel >= recipe.requiredLevel;
    
// Check associated skill requirement if it exists
let hasAssociatedSkillRequirement = true;
let associatedSkillText = '';
if (recipe.associatedSkill) {
  const associatedLevel = profile?.skills[recipe.associatedSkill.skill] || 1;
  hasAssociatedSkillRequirement = associatedLevel >= recipe.associatedSkill.level;
  associatedSkillText = `<div style="font-size: 1.1em; margin-top: 5px; display: flex; justify-content: center; gap: 8px; text-align: center;">
    <span style="color: ${hasLevelRequirement ? '#90EE90' : '#FFB6C1'};">${SKILL_ICONS['scribing']} Scribing ${recipe.requiredLevel} ${hasLevelRequirement ? '✓' : '✗'}</span>
    <span style="color: ${hasAssociatedSkillRequirement ? '#90EE90' : '#FFB6C1'};">${SKILL_ICONS[recipe.associatedSkill.skill] || '❓'} ${recipe.associatedSkill.skill.charAt(0).toUpperCase() + recipe.associatedSkill.skill.slice(1)} ${recipe.associatedSkill.level} ${hasAssociatedSkillRequirement ? '✓' : '✗'}</span>
  </div>`;
} else {
  associatedSkillText = `<div style="font-size: 1.1em; color: ${hasLevelRequirement ? '#90EE90' : '#FFB6C1'}; margin-top: 5px; text-align: center;">
    ${SKILL_ICONS['scribing']} Scribing ${recipe.requiredLevel} ${hasLevelRequirement ? '✓' : '✗'}
  </div>`;
}

    
    const canCraft = paperSlot !== -1 && hasLevelRequirement && hasAssociatedSkillRequirement;
    
    // Check if this book has been completed before
    const isCompleted = completedBooks.includes(recipe.resultItem);
    
    const bookElement = document.createElement('div');
    bookElement.className = 'recipe-item';
    
    // Use gold background and styling for completed books
    const backgroundColor = isCompleted ? 'rgba(255, 215, 0, 0.2)' : 'rgba(139, 69, 19, 0.3)';
    const borderColor = isCompleted ? '#DAA520' : '#8b4513';
    const boxShadow = isCompleted ? '0 0 15px rgba(218, 165, 32, 0.4)' : '0 2px 4px rgba(0,0,0,0.3)';
    
    bookElement.style.cssText = `
      background: ${backgroundColor};
      border: 2px solid ${borderColor};
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 12px;
      cursor: ${canCraft ? 'pointer' : 'not-allowed'};
      opacity: ${canCraft ? '1' : '0.6'};
      transition: all 0.3s ease;
      box-shadow: ${boxShadow};
    `;
    
    // Special styling for completed books - no completion indicator needed
    const completedIndicator = '';
    
    const titlePrefix = isCompleted ? '⭐ ' : '';
    const titleSuffix = isCompleted ? ' (Completed)' : '';
    
    bookElement.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div style="flex: 1;">
          <h4 style="margin: 0 0 8px 0; color: ${isCompleted ? '#FFD700' : '#d4af37'}; font-size: 1.1em;">
            ${titlePrefix}${recipe.name}${titleSuffix}
            ${completedIndicator}
          </h4>
          <p style="margin: 5px 0; color: #cccccc; font-size: 0.9em; line-height: 1.4;">${recipe.description}</p>
          <div style="margin-top: 8px; font-size: 0.85em; color: #b8b8b8;">
            <div>✒️ ${recipe.requiredPages} pages • ⌛️ ${(recipe.baseTime / 1000).toFixed(1)}s per page</div>
            <div style="margin-top: 3px;">📖 ${Math.floor(recipe.experience / recipe.requiredPages) * 2} XP per page • ✅ ${recipe.experience} total XP</div>
            <div style="margin-top: 3px;">📄 Requires: ${paperType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</div>
            ${associatedSkillText}
          </div>
        </div>
        <div style="text-align: right; margin-left: 15px;">
          <div style="background: ${canCraft ? 'linear-gradient(135deg, #228B22, #32CD32)' : '#8b4513'}; color: white; padding: 8px 16px; border-radius: 6px; font-weight: bold; font-size: 0.9em; white-space: nowrap;">
            ${canCraft ? 'Start Writing' : 'Requirements Not Met'}
          </div>
        </div>
      </div>
    `;
    
    if (canCraft) {
      bookElement.addEventListener('click', () => {
        startBookWriting(bookId, activeScribingTableInterface.x, activeScribingTableInterface.y, activeScribingTableInterface.tableElement);
      });
      
      bookElement.addEventListener('mouseenter', () => {
        bookElement.style.transform = 'translateY(-2px)';
        bookElement.style.boxShadow = isCompleted ? '0 4px 20px rgba(218, 165, 32, 0.6)' : '0 4px 8px rgba(139, 69, 19, 0.4)';
      });
      
      bookElement.addEventListener('mouseleave', () => {
        bookElement.style.transform = 'translateY(0)';
        bookElement.style.boxShadow = isCompleted ? '0 0 15px rgba(218, 165, 32, 0.4)' : '0 2px 4px rgba(0,0,0,0.3)';
      });
    }
    
    container.appendChild(bookElement);
  });
}

// Switch between tabs
function switchScribingTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.scribing-tab').forEach(tab => {
    tab.classList.remove('active');
    if (tab.dataset.tab === tabName) {
      tab.style.background = '#8b6914';
      tab.style.color = '#f4e4bc';
      tab.classList.add('active');
    } else {
      tab.style.background = '#654321';
      tab.style.color = '#cccccc';
    }
  });
  
  // Update tab content
  document.querySelectorAll('.scribing-tab-content').forEach(content => {
    content.style.display = 'none';
    content.classList.remove('active');
  });
  
  const activeContent = document.getElementById(`${tabName}-tab-content`);
  if (activeContent) {
    activeContent.style.display = 'block';
    activeContent.classList.add('active');
  }
}

// Populate book recipes - for starting new books
function populateBookRecipes(inventory, playerLevel, x, y, tableElement) {
  console.log('📚 populateBookRecipes called with:', { playerLevel, bookCount: Object.keys(BOOK_RECIPES).length });
  console.log('🔧 [DEBUG] Using UPDATED scribing code - no completion bonus message, enhanced XP scaling');
  
  const container = document.getElementById('book-recipes');
  if (!container) {
    console.error('❌ book-recipes container not found!');
    return;
  }
  
  container.innerHTML = '';
  
  // Get player's completed books for gold background
  const profile = window.userModule?.getProfile();
  const completedBooks = profile?.completedBooks || [];

  
  try {
    Object.entries(BOOK_RECIPES)
      .sort((a, b) => a[1].requiredLevel - b[1].requiredLevel)
      .forEach(([bookId, recipe]) => {
      console.log('📖 Processing book:', bookId, recipe);
      
      const canMake = playerLevel >= recipe.requiredLevel;
      
      // Check associated skill requirement
      let hasSkillRequirement = true;
      let skillText = '';
      if (recipe.associatedSkill) {
        const playerSkillLevel = profile?.skills?.[recipe.associatedSkill.skill] || 1;
        hasSkillRequirement = playerSkillLevel >= recipe.associatedSkill.level;
        const skillName = recipe.associatedSkill.skill.charAt(0).toUpperCase() + recipe.associatedSkill.skill.slice(1);
        skillText = ` + ${skillName} ${recipe.associatedSkill.level}`;
      }
      
      // Only need 1 paper to start any book (for the first page)
      const paperType = recipe.materials[0].item;
      const paperCount = calculateAvailableItems(paperType);
      const hasEnoughPaper = paperCount >= 1;
    
      const canStart = canMake && hasSkillRequirement && hasEnoughPaper;
      
      // Check if this book has been completed before (for gold background)
      const isCompleted = completedBooks.includes(recipe.resultItem);
    
      const recipeElement = document.createElement('div');
      recipeElement.style.cssText = `
        background: ${isCompleted ? 'rgba(255, 215, 0, 0.2)' : (canStart ? 'rgba(76, 124, 89, 0.3)' : 'rgba(100, 67, 33, 0.3)')};
        border: 1px solid ${isCompleted ? '#DAA520' : (canStart ? '#4a7c59' : '#654321')};
        border-radius: 8px;
        padding: 15px;
        margin-bottom: 10px;
        transition: all 0.2s ease;
        cursor: ${canStart ? 'pointer' : 'default'};
        ${isCompleted ? 'box-shadow: 0 0 5px rgba(255, 215, 0, 0.3);' : ''}
      `;
    
      // Calculate enhanced experience per page for higher level books
      const baseExpPerPage = Math.floor(recipe.experience / recipe.requiredPages);
      let enhancedExpPerPage = baseExpPerPage;
      
      // Scale experience more generously for higher level books
      if (recipe.requiredLevel >= 50) {
        enhancedExpPerPage = Math.floor(baseExpPerPage * 3.5); // 3.5x for level 50+ books
      } else if (recipe.requiredLevel >= 35) {
        enhancedExpPerPage = Math.floor(baseExpPerPage * 3.0); // 3x for level 35+ books
      } else if (recipe.requiredLevel >= 25) {
        enhancedExpPerPage = Math.floor(baseExpPerPage * 2.5); // 2.5x for level 25+ books
      } else if (recipe.requiredLevel >= 15) {
        enhancedExpPerPage = Math.floor(baseExpPerPage * 2.2); // 2.2x for level 15+ books
      } else {
        enhancedExpPerPage = Math.floor(baseExpPerPage * 2.0); // 2x for basic books
      }
      
      // Format paper type name for display
      const paperDisplayName = paperType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
      
      console.log(`🔧 [DEBUG] Book: ${recipe.name}, Level: ${recipe.requiredLevel}, Base XP: ${baseExpPerPage}, Enhanced XP: ${enhancedExpPerPage}, Paper: ${paperDisplayName}`);
      
      recipeElement.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="flex: 1;">
            <h4 style="margin: 0 0 8px 0; color: #f4e4bc; font-size: 1.1em;">
              ${isCompleted ? '⭐ ' : ''}${recipe.name}${isCompleted ? ' (Completed)' : ''}
            </h4>
            <p style="margin: 0 0 10px 0; color: #cccccc; font-size: 0.9em;">${recipe.description}</p>
            <div style="display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 8px;">
              <span style="padding: 2px 8px; border-radius: 4px; font-size: 0.8em; background: ${canMake ? '#2d5a3d' : '#5a2d2d'}; color: ${canMake ? '#90ee90' : '#ffcccb'};">
                ${SKILL_ICONS['scribing']} Scribing ${recipe.requiredLevel} ${canMake ? '✓' : '✗'}
              </span>
              ${recipe.associatedSkill ? `
                <span style="padding: 2px 8px; border-radius: 4px; font-size: 0.8em; background: ${hasSkillRequirement ? '#2d5a3d' : '#5a2d2d'}; color: ${hasSkillRequirement ? '#90ee90' : '#ffcccb'};">
                  ${SKILL_ICONS[recipe.associatedSkill.skill] || '❓'} ${recipe.associatedSkill.skill.charAt(0).toUpperCase() + recipe.associatedSkill.skill.slice(1)} ${recipe.associatedSkill.level} ${hasSkillRequirement ? '✓' : '✗'}
                </span>
              ` : ''}
              <span style="padding: 2px 8px; border-radius: 4px; font-size: 0.8em; background: ${hasEnoughPaper ? '#2d5a3d' : '#5a2d2d'}; color: ${hasEnoughPaper ? '#90ee90' : '#ffcccb'};">
                1x ${paperDisplayName} to start (${paperCount} available)
              </span>
              <span style="padding: 2px 8px; border-radius: 4px; font-size: 0.8em; background: #8b6914; color: #f4e4bc;">
                +${enhancedExpPerPage} XP per page (${recipe.requiredPages} pages)
              </span>
              <span style="padding: 2px 8px; border-radius: 4px; font-size: 0.8em; background: #654321; color: #cccccc;">
                ${(recipe.baseTime / 1000).toFixed(1)}s per page
              </span>
            </div>
          </div>
          <div style="margin-left: 15px;">
                    ${canStart ? 
            `<button style="padding: 8px 16px; background: #8b4513; border: 1px solid #654321; border-radius: 4px; color: white; cursor: pointer; font-size: 0.9em; transition: background-color 0.2s;" onmouseenter="this.style.backgroundColor='#a0522d'" onmouseleave="this.style.backgroundColor='#8b4513'" onclick="window.scribingModule.startBookWriting('${bookId}', ${x}, ${y})">Start Book</button>` : 
            `<button style="padding: 8px 16px; background: #444; border: 1px solid #666; border-radius: 4px; color: #999; cursor: not-allowed; font-size: 0.9em;" disabled>Cannot Start</button>`
          }
          </div>
        </div>
      `;
    
      container.appendChild(recipeElement);
    });
    
    console.log('✅ Successfully populated', Object.keys(BOOK_RECIPES).length, 'book recipes');
  } catch (error) {
    console.error('❌ Error in populateBookRecipes:', error);
  }
}

// Populate scroll recipes
function populateScrollRecipes(inventory, playerLevel, x, y, tableElement) {
  const container = document.getElementById('scroll-recipes');
  if (!container) return;
  
  container.innerHTML = '';
  
  Object.entries(SCROLL_RECIPES).forEach(([scrollId, recipe]) => {
    const canMake = playerLevel >= recipe.level;
    const paperCount = calculateAvailableItems(recipe.requiredPaper);
    const hasEnoughPaper = paperCount >= recipe.paperQuantity;
    const maxPossible = Math.floor(paperCount / recipe.paperQuantity);
    
    const recipeElement = document.createElement('div');
    recipeElement.style.cssText = `
      background: ${canMake && hasEnoughPaper ? 'rgba(76, 124, 89, 0.3)' : 'rgba(100, 67, 33, 0.3)'};
      border: 1px solid ${canMake && hasEnoughPaper ? '#4a7c59' : '#654321'};
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 10px;
      transition: all 0.2s ease;
    `;
    
    recipeElement.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div style="flex: 1;">
          <h4 style="margin: 0 0 8px 0; color: #f4e4bc; font-size: 1.1em;">${recipe.name}</h4>
          <p style="margin: 0 0 10px 0; color: #cccccc; font-size: 0.9em;">${recipe.description}</p>
          <div style="display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 8px;">
            <span style="padding: 2px 8px; border-radius: 4px; font-size: 0.8em; background: ${canMake ? '#2d5a3d' : '#5a2d2d'}; color: ${canMake ? '#90ee90' : '#ffcccb'};">
              Level ${recipe.level} ${canMake ? '✓' : '✗'}
            </span>
            <span style="padding: 2px 8px; border-radius: 4px; font-size: 0.8em; background: ${hasEnoughPaper ? '#2d5a3d' : '#5a2d2d'}; color: ${hasEnoughPaper ? '#90ee90' : '#ffcccb'};">
              ${recipe.paperQuantity}x ${recipe.requiredPaper.replace('_', ' ')} (${paperCount} available)
            </span>
            <span style="padding: 2px 8px; border-radius: 4px; font-size: 0.8em; background: #8b6914; color: #f4e4bc;">
              +${recipe.experience} XP each
            </span>
            <span style="padding: 2px 8px; border-radius: 4px; font-size: 0.8em; background: #654321; color: #cccccc;">
              ${(recipe.writingTime / 1000).toFixed(1)}s each
            </span>
          </div>
          ${canMake && hasEnoughPaper ? `
            <div style="color: #90ee90; font-size: 0.8em; margin-bottom: 8px;">
              Can make ${maxPossible} scroll${maxPossible !== 1 ? 's' : ''}
            </div>
          ` : ''}
        </div>
        <div style="margin-left: 15px; display: flex; flex-direction: column; align-items: flex-end; gap: 8px;">
          ${canMake && hasEnoughPaper ? `
            <div style="display: flex; gap: 5px; margin-bottom: 8px;">
              <button style="padding: 4px 8px; background: #654321; border: 1px solid #8b4513; border-radius: 3px; color: white; cursor: pointer; font-size: 0.75em;" 
                onclick="window.scribingModule.startScrollWritingWithQuantity('${scrollId}', ${x}, ${y}, 1)">1</button>
              ${maxPossible >= 5 ? `<button style="padding: 4px 8px; background: #654321; border: 1px solid #8b4513; border-radius: 3px; color: white; cursor: pointer; font-size: 0.75em;" 
                onclick="window.scribingModule.startScrollWritingWithQuantity('${scrollId}', ${x}, ${y}, 5)">5</button>` : ''}
              ${maxPossible >= 10 ? `<button style="padding: 4px 8px; background: #654321; border: 1px solid #8b4513; border-radius: 3px; color: white; cursor: pointer; font-size: 0.75em;" 
                onclick="window.scribingModule.startScrollWritingWithQuantity('${scrollId}', ${x}, ${y}, 10)">10</button>` : ''}
              ${maxPossible >= 2 ? `<button style="padding: 4px 8px; background: #654321; border: 1px solid #8b4513; border-radius: 3px; color: white; cursor: pointer; font-size: 0.75em;" 
                onclick="window.scribingModule.startScrollWritingWithQuantity('${scrollId}', ${x}, ${y}, ${maxPossible})">All (${maxPossible})</button>` : ''}
            </div>
            <button style="padding: 8px 16px; background: #8b4513; border: 1px solid #654321; border-radius: 4px; color: white; cursor: pointer; font-size: 0.9em; transition: background-color 0.2s;" 
              onmouseenter="this.style.backgroundColor='#a0522d'" onmouseleave="this.style.backgroundColor='#8b4513'" 
              onclick="window.scribingModule.startScrollWriting('${scrollId}', ${x}, ${y})">Write 1 Scroll</button>
          ` : `
            <button style="padding: 8px 16px; background: #444; border: 1px solid #666; border-radius: 4px; color: #999; cursor: not-allowed; font-size: 0.9em;" disabled>Cannot Write</button>
          `}
        </div>
      </div>
    `;
    
    container.appendChild(recipeElement);
  });
}

// Populate unfinished books - for continuing existing books
function populateUnfinishedBooks(inventory, playerLevel, x, y, tableElement) {
  const container = document.getElementById('unfinished-books');
  if (!container) return;
  
  container.innerHTML = '';
  
  // Find unfinished books in inventory
  const unfinishedBooks = inventory.filter(item => 
    item && item.type === 'unfinished_book'
  );
  
  if (unfinishedBooks.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 20px; color: #cccccc; font-style: italic;">
        <p>You don't have any unfinished books to continue writing.</p>
        <p>Start a new book from the "New Books" tab to create one.</p>
      </div>
    `;
    return;
  }
  
  unfinishedBooks.forEach((book) => {
    const slotIndex = inventory.indexOf(book);
    const progressPercent = Math.round((book.pagesCompleted || 0) / book.totalPages * 100);
    
    const bookElement = document.createElement('div');
    bookElement.style.cssText = `
      background: rgba(76, 124, 89, 0.3);
      border: 1px solid #4a7c59;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 10px;
      transition: all 0.2s ease;
      cursor: pointer;
    `;
    
    bookElement.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div style="flex: 1;">
          <h4 style="margin: 0 0 8px 0; color: #f4e4bc; font-size: 1.1em;">${book.name}</h4>
          <div style="margin-bottom: 10px;">
            <span style="color: #cccccc;">Progress: ${book.pagesCompleted || 0}/${book.totalPages} pages (${progressPercent}%)</span>
          </div>
          <div style="background: #444; border-radius: 10px; height: 12px; overflow: hidden; margin-bottom: 8px;">
            <div style="background: linear-gradient(90deg, #4a7c59, #5a8c69); height: 100%; width: ${progressPercent}%; transition: width 0.3s ease;"></div>
          </div>
          <div style="display: flex; gap: 10px; align-items: center;">
            <span style="padding: 2px 8px; border-radius: 4px; font-size: 0.8em; background: #8b6914; color: #f4e4bc;">
              ${book.baseTime ? (book.baseTime / 1000).toFixed(1) : '4.0'}s per page
            </span>
            <span style="padding: 2px 8px; border-radius: 4px; font-size: 0.8em; background: #654321; color: #cccccc;">
              ${book.totalPages - (book.pagesCompleted || 0)} pages remaining
            </span>
          </div>
        </div>
        <div style="margin-left: 15px;">
          <button style="padding: 8px 16px; background: #8b4513; border: 1px solid #654321; border-radius: 4px; color: white; cursor: pointer; font-size: 0.9em; transition: background-color 0.2s;" onmouseenter="this.style.backgroundColor='#a0522d'" onmouseleave="this.style.backgroundColor='#8b4513'" onclick="window.scribingModule.continueBookWriting(${slotIndex}, ${x}, ${y})">
            Continue Writing
          </button>
        </div>
      </div>
    `;
    
    container.appendChild(bookElement);
  });
}

// Start writing a book - creates an unfinished book and begins the first page
function startBookWriting(bookId, x, y) {
  const recipe = BOOK_RECIPES[bookId];
  if (!recipe) {
    showScribingMessage('Invalid book recipe.', 'error');
    return;
  }
  
  console.log(`Scribing: Starting book writing: ${bookId}`);
  
  // Check level requirement
  const profile = window.userModule?.getProfile();
  const playerLevel = profile?.skills.scribing || 1;
  if (playerLevel < recipe.requiredLevel) {
    showScribingMessage(`You need level ${recipe.requiredLevel} Scribing to write this book.`, 'error');
    return;
  }
  
  // Check associated skill requirement
  if (recipe.associatedSkill) {
    const requiredSkillLevel = profile?.skills?.[recipe.associatedSkill.skill] || 1;
    if (requiredSkillLevel < recipe.associatedSkill.level) {
      const skillName = recipe.associatedSkill.skill.charAt(0).toUpperCase() + recipe.associatedSkill.skill.slice(1);
      showScribingMessage(`You need level ${recipe.associatedSkill.level} ${skillName} to write this book.`, 'error');
      return;
    }
  }
  
  // Check if we have enough paper for the first page
  const paperType = recipe.materials[0].item;
  const paperCount = calculateAvailableItems(paperType);
  if (paperCount < 1) {
    showScribingMessage(`You need 1x ${paperType.replace('_', ' ')} to start writing this book.`, 'error');
    return;
  }
  
  // Remove 1 paper from inventory for first page
  const paperSlot = findItemInInventory(paperType);
  if (paperSlot === -1) {
    showScribingMessage(`Not enough ${paperType.replace('_', ' ')} to start this book.`, 'error');
    return;
  }
  
  const inventory = window.inventoryModule?.getPlayerInventory() || [];
  const currentItem = inventory[paperSlot];
  if (currentItem.quantity > 1) {
    currentItem.quantity -= 1;
    window.inventoryModule.updateInventoryDisplay();
  } else {
    window.inventoryModule.removeItemFromInventorySlot(paperSlot);
  }
  
  // Create unfinished book with progress tracking
  const unfinishedBook = {
    id: recipe.unfinishedItem,
    name: `${recipe.name} (0/${recipe.requiredPages} pages)`,
    type: 'unfinished_book',
    icon: '📝',
    quantity: 1,
    pagesCompleted: 0,
    totalPages: recipe.requiredPages,
    targetBook: recipe.resultItem,
    bookRecipeId: bookId,
    baseTime: recipe.baseTime,
    experience: recipe.experience,
    paperType: paperType
  };
  
  // Find an empty inventory slot manually for the unfinished book (special item)
  const currentInventory = window.inventoryModule?.getPlayerInventory() || [];
  const emptySlotIndex = currentInventory.findIndex(item => !item);
  
  if (emptySlotIndex === -1) {
    showScribingMessage('Not enough inventory space for the unfinished book.', 'error');
    // Restore the paper we removed earlier since we couldn't add the book
    if (currentItem.quantity > 0) {
      currentItem.quantity += 1;
    } else {
      window.inventoryModule.addItemToInventory(paperType, 1);
    }
    window.inventoryModule.updateInventoryDisplay();
    return;
  }
  
  // Directly place the unfinished book in the empty slot
  currentInventory[emptySlotIndex] = unfinishedBook;
  window.inventoryModule.updateInventoryDisplay();
  
  // Close interface and start writing the first page
  closeScribingTableInterface();
  
  // Set up writing session for the first page
  const sessionId = 'player';
  const tableKey = `${x},${y}`;
  
  // Find the book we just created
  const updatedInventory = window.inventoryModule?.getPlayerInventory() || [];
  const bookSlot = updatedInventory.findIndex(item => 
    item && item.type === 'unfinished_book' && item.bookRecipeId === bookId
  );
  
  if (bookSlot === -1) {
    showScribingMessage('Could not find the created book.', 'error');
    return;
  }
  
  activeScribing.set(sessionId, {
    type: 'book_page',
    recipe: recipe,
    bookId: bookId,
    bookSlot: bookSlot,
    x: x,
    y: y,
    startTime: Date.now(),
    endTime: Date.now() + recipe.baseTime
  });
  
  scribingTableStates.set(tableKey, sessionId);
  
  // Show progress
  showSkillBubble('scribing', `Writing page 1 of ${recipe.name}...`);
  showScribingMessage(`Started writing "${recipe.name}". Writing page 1/${recipe.requiredPages}...`, 'info');
  
  // Set completion timer
  setTimeout(() => {
    completeBookPage(sessionId);
  }, recipe.baseTime);
}

// Continue writing an unfinished book
function continueBookWriting(slotIndex, x, y) {
  console.log(`Scribing: Continuing book writing from slot ${slotIndex}`);
  
  const inventory = window.inventoryModule?.getPlayerInventory() || [];
  const book = inventory[slotIndex];
  
  if (!book || book.type !== 'unfinished_book') {
    showScribingMessage('No unfinished book found in that slot.', 'error');
    return;
  }
  
  // Check if book is already complete
  if (book.pagesCompleted >= book.totalPages) {
    showScribingMessage('This book is already complete!', 'error');
    return;
  }
  
  // Check if we have paper
  const paperType = book.paperType || 'paper';
  const paperCount = calculateAvailableItems(paperType);
  if (paperCount < 1) {
    showScribingMessage(`You need 1x ${paperType.replace('_', ' ')} to continue writing this book.`, 'error');
    return;
  }
  
  // Remove 1 paper from inventory
  const paperSlot = findItemInInventory(paperType);
  if (paperSlot === -1) {
    showScribingMessage(`Not enough ${paperType.replace('_', ' ')} to continue this book.`, 'error');
    return;
  }
  
  const currentItem = inventory[paperSlot];
  if (currentItem.quantity > 1) {
    currentItem.quantity -= 1;
    window.inventoryModule.updateInventoryDisplay();
  } else {
    window.inventoryModule.removeItemFromInventorySlot(paperSlot);
  }
  
  // Close interface and start writing
  closeScribingTableInterface();
  
  // Set up writing session
  const sessionId = 'player';
  const tableKey = `${x},${y}`;
  
  activeScribing.set(sessionId, {
    type: 'book_page',
    book: book,
    bookSlot: slotIndex,
    x: x,
    y: y,
    startTime: Date.now(),
    endTime: Date.now() + book.baseTime
  });
  
  scribingTableStates.set(tableKey, sessionId);
  
  const currentPage = (book.pagesCompleted || 0) + 1;
  
  // Show progress
  showSkillBubble('scribing', `Writing page ${currentPage} of ${book.totalPages}...`);
  showScribingMessage(`Continuing "${book.name.split(' (')[0]}". Writing page ${currentPage}/${book.totalPages}...`, 'info');
  
  // Set completion timer
  setTimeout(() => {
    completeBookPage(sessionId);
  }, book.baseTime);
}

// Complete a single page of book writing
function completeBookPage(playerId) {
  console.log('📚 completeBookPage called for player:', playerId);
  
  const session = activeScribing.get(playerId);
  if (!session) {
    console.log('📚 No active scribing session found');
    return;
  }
  
  console.log('📚 Active session:', session);
  
  const inventory = window.inventoryModule?.getPlayerInventory() || [];
  const book = inventory[session.bookSlot];
  
  console.log('📚 Book from inventory slot', session.bookSlot, ':', book);
  
  if (!book || book.type !== 'unfinished_book') {
    console.error('📚 Book not found for page completion - book:', book);
    activeScribing.delete(playerId);
    return;
  }
  
  // Update book progress
  book.pagesCompleted = (book.pagesCompleted || 0) + 1;
  
  // Calculate enhanced experience per page with generous scaling for higher level books
  const baseExpPerPage = Math.floor(book.experience / book.totalPages);
  let enhancedExpPerPage = baseExpPerPage;
  
  // Get the book recipe to determine required level for scaling
  const bookRecipe = Object.values(BOOK_RECIPES).find(recipe => recipe.resultItem === book.targetBook);
  const requiredLevel = bookRecipe?.requiredLevel || 1;
  
  // Scale experience more generously for higher level books
  if (requiredLevel >= 50) {
    enhancedExpPerPage = Math.floor(baseExpPerPage * 3.5); // 3.5x for level 50+ books
  } else if (requiredLevel >= 35) {
    enhancedExpPerPage = Math.floor(baseExpPerPage * 3.0); // 3x for level 35+ books
  } else if (requiredLevel >= 25) {
    enhancedExpPerPage = Math.floor(baseExpPerPage * 2.5); // 2.5x for level 25+ books
  } else if (requiredLevel >= 15) {
    enhancedExpPerPage = Math.floor(baseExpPerPage * 2.2); // 2.2x for level 15+ books
  } else {
    enhancedExpPerPage = Math.floor(baseExpPerPage * 2.0); // 2x for basic books
  }
  
  const expPerPage = enhancedExpPerPage;
  
  // Add experience
  const profile = window.userModule?.getProfile();
  if (profile) {
    const leveledUp = addExperience('scribing', expPerPage, profile.skills, profile.skillsExp);
    
    // Update UI
    if (window.uiModule && window.uiModule.updateSkillDisplay) {
      window.uiModule.updateSkillDisplay('scribing', profile.skills.scribing, leveledUp);
      if (leveledUp) {
        window.uiModule.updateTotalLevel(profile.skills);
      }
    }
    
    if (leveledUp) {
      showScribingMessage(`Level up! Your Scribing level is now ${profile.skills.scribing}!`, 'success');
    }
  }
  
  // Update book name to show progress
  const baseName = book.name.split(' (')[0];
  book.name = `${baseName} (${book.pagesCompleted}/${book.totalPages} pages)`;
  
  // Check if book is complete
  console.log('📚 Checking if book is complete:', book.pagesCompleted, '>=', book.totalPages);
  
  if (book.pagesCompleted >= book.totalPages) {
    console.log('📚 BOOK IS COMPLETE! Starting completion process...');
    
    // Get the player's name for the author signature
    const playerProfile = window.userModule?.getProfile();
    const playerName = playerProfile?.username || window.USERNAME || 'Unknown Author';
    
    console.log('📚 Book completion - Player info:', { playerProfile, playerName, USERNAME: window.USERNAME });
    
    // Get the base book definition
    const baseBookDef = window.inventoryModule?.getItemDefinition?.(book.targetBook) || 
                        (window.itemDefinitions && window.itemDefinitions[book.targetBook]) || {};
    
    console.log('📚 Book completion - Base definition:', baseBookDef);
    
    // Create custom book with author information
    const customBookProperties = {
      author: playerName,  // Use 'author' for consistency with tooltip system
      authorName: playerName,  // Keep both for compatibility
      name: `${baseBookDef.name || 'Book'} (by ${playerName})`,
      description: `${baseBookDef.description || 'A completed book.'} Written and signed by ${playerName}.`,
      writtenDate: new Date().toISOString()
    };
    
    console.log('📚 Book completion - Custom properties:', customBookProperties);
    
    // Add finished book with custom properties using the same approach as unfinished books
    console.log('📚 Adding finished book with custom properties directly to inventory');
    
    // Find an empty inventory slot for the finished book
    const currentInventory = window.inventoryModule?.getPlayerInventory() || [];
    const emptySlotIndex = currentInventory.findIndex(item => !item);
    
    let bookAddSuccess = false;
    if (emptySlotIndex !== -1) {
      // Create the finished book with all custom properties
      const finishedBook = {
        id: book.targetBook,
        quantity: 1,
        ...customBookProperties  // Include author, authorName, custom name, description, etc.
      };
      
      console.log('📚 Created finished book object:', finishedBook);
      
      // Directly place the finished book in the empty slot (same as unfinished books)
      currentInventory[emptySlotIndex] = finishedBook;
      window.inventoryModule.updateInventoryDisplay();
      
      bookAddSuccess = true;
      console.log('📚 Successfully added finished book to inventory slot', emptySlotIndex);
    } else {
      console.log('📚 No empty inventory slot available for finished book');
      bookAddSuccess = false;
    }
    
    if (bookAddSuccess) {
      // Successfully added finished book, now remove unfinished book and award bonus XP
      window.inventoryModule.removeItemFromInventorySlot(session.bookSlot);
      
      showScribingMessage(`🎉 You have completed writing "${baseName}"!`, 'success');
      showSkillBubble('scribing', `Completed ${baseName}!`);
      
      // Check if this is the first time completing this book type
      const profile = window.userModule?.getProfile();
      if (!profile.completedBooks) {
        profile.completedBooks = [];
      }
      
      const isFirstTime = !profile.completedBooks.includes(book.targetBook);
      if (isFirstTime) {
        profile.completedBooks.push(book.targetBook);
        
        // Auto-save the profile to persist the completed book
        if (window.userModule?.saveProfile) {
          window.userModule.saveProfile();
        }
        
        // Immediately sync completed books with server if online
        if (window.isUserOnline && window.isUserOnline() && window.savePlayerDataToServer) {
          const currentPosition = window.getPlayerPosition ? window.getPlayerPosition() : null;
          const playerData = {
            position: currentPosition,
            skills: profile.skills,
            inventory: window.inventoryModule?.playerInventory || [],
            totalLevel: profile.totalLevel,
            combatLevel: profile.combatLevel,
            completedBooks: profile.completedBooks || []
          };
          window.savePlayerDataToServer(playerData);
          console.log('📚 Immediately synced completed books with server');
        }
      }
      
      // Bonus XP for completion with first-time multiplier
      let bonusMultiplier = 0.25; // 25% base bonus
      if (isFirstTime) {
        bonusMultiplier = 2.5; // 2.5x bonus for first completion
      }
      
      const bonusXP = Math.floor(book.experience * bonusMultiplier);
      
      if (profile) {
        const leveledUp = addExperience('scribing', bonusXP, profile.skills, profile.skillsExp);
        
        // Update UI
        if (window.uiModule && window.uiModule.updateSkillDisplay) {
          window.uiModule.updateSkillDisplay('scribing', profile.skills.scribing, leveledUp);
          if (leveledUp) {
            window.uiModule.updateTotalLevel(profile.skills);
          }
        }
        
        // Show appropriate completion message
        if (isFirstTime) {
          showScribingMessage(`🌟 First time completing this book! +${bonusXP} bonus XP (2.5x multiplier)!`, 'success');
        } else {
          showScribingMessage(`Book completion bonus: +${bonusXP} XP`, 'info');
        }
        
        if (leveledUp) {
          showScribingMessage(`Level up! Your Scribing level is now ${profile.skills.scribing}!`, 'success');
        }
      }
      
      // Clear session since book is complete
      hideSkillBubble();
      activeScribing.delete(playerId);
      const tableKey = `${session.x},${session.y}`;
      scribingTableStates.delete(tableKey);
    } else {
      // Could not add finished book to inventory - revert the page completion
      book.pagesCompleted -= 1;
      book.name = `${baseName} (${book.pagesCompleted}/${book.totalPages} pages)`;
      window.inventoryModule.updateInventoryDisplay();
      
      showScribingMessage('Not enough inventory space for the finished book!', 'error');
      // Clear session since we can't complete
      hideSkillBubble();
      activeScribing.delete(playerId);
      const tableKey = `${session.x},${session.y}`;
      scribingTableStates.delete(tableKey);
      return;
    }
  } else {
    // Book is not complete, check if we can continue automatically
    const paperType = book.paperType || 'paper';
    const paperCount = calculateAvailableItems(paperType);
    
    if (paperCount >= 1) {
      // We have paper, continue automatically
      showScribingMessage(`Page ${book.pagesCompleted} completed. Continuing with page ${book.pagesCompleted + 1}...`, 'info');
      
      // Remove 1 paper from inventory for next page
      const paperSlot = findItemInInventory(paperType);
      if (paperSlot !== -1) {
        const paperItem = inventory[paperSlot];
        if (paperItem.quantity > 1) {
          paperItem.quantity -= 1;
          window.inventoryModule.updateInventoryDisplay();
        } else {
          window.inventoryModule.removeItemFromInventorySlot(paperSlot);
        }
        
        // Update session for next page
        session.startTime = Date.now();
        session.endTime = Date.now() + book.baseTime;
        
        const nextPage = book.pagesCompleted + 1;
        
        // Show progress for next page
        showSkillBubble('scribing', `Writing page ${nextPage} of ${book.totalPages}...`);
        
        // Set completion timer for next page
        setTimeout(() => {
          completeBookPage(playerId);
        }, book.baseTime);
        
        console.log(`Scribing: Auto-continuing to page ${nextPage}/${book.totalPages}`);
        return; // Don't clear session, keep going
      }
    }
    
    // Can't continue (no paper), stop here
    showScribingMessage(`Page ${book.pagesCompleted} completed. ${book.totalPages - book.pagesCompleted} pages remaining. Get more ${paperType.replace('_', ' ')} to continue.`, 'info');
    
    // Update inventory display since we made progress
    window.inventoryModule.updateInventoryDisplay();
    
    // Clear session
    hideSkillBubble();
    activeScribing.delete(playerId);
    const tableKey = `${session.x},${session.y}`;
    scribingTableStates.delete(tableKey);
  }
}

// Start writing scrolls with quantity support
function startScrollWritingWithQuantity(scrollId, x, y, quantity) {
  const recipe = SCROLL_RECIPES[scrollId];
  if (!recipe) return;
  
  console.log(`Scribing: Starting scroll writing with quantity: ${scrollId} x${quantity}`);
  
  const totalPaperNeeded = recipe.paperQuantity * quantity;
  const paperCount = calculateAvailableItems(recipe.requiredPaper);
  
  if (paperCount < totalPaperNeeded) {
    showScribingMessage(`Not enough ${recipe.requiredPaper.replace('_', ' ')} to write ${quantity} scroll${quantity > 1 ? 's' : ''}. Need ${totalPaperNeeded}, have ${paperCount}.`, 'error');
    return;
  }
  
  // Check level requirement
  const profile = window.userModule?.getProfile();
  const playerLevel = profile?.skills.scribing || 1;
  if (playerLevel < recipe.level) {
    showScribingMessage(`You need level ${recipe.level} Scribing to write this scroll.`, 'error');
    return;
  }
  
  if (quantity === 1) {
    // Single scroll, use regular function
    startScrollWriting(scrollId, x, y);
    return;
  }
  
  // Multiple scrolls, start queue
  const playerId = 'player';
  const tableKey = `${x},${y}`;
  
  // Close interface
  closeScribingTableInterface();
  
  // Create scroll queue
  scrollQueue.set(playerId, {
    scrollId: scrollId,
    recipe: recipe,
    x: x,
    y: y,
    total: quantity,
    remaining: quantity
  });
  
  scribingTableStates.set(tableKey, playerId);
  
  // Start processing the queue
  processScrollQueue(playerId);
}

// Process scroll queue
function processScrollQueue(playerId) {
  const queue = scrollQueue.get(playerId);
  if (!queue) {
    console.log('Scribing: No scroll queue found for processing');
    return;
  }
  
  if (queue.remaining <= 0) {
    console.log('Scribing: Scroll queue completed');
    scrollQueue.delete(playerId);
    const tableKey = `${queue.x},${queue.y}`;
    scribingTableStates.delete(tableKey);
    showScribingMessage(`Completed scroll writing! Made ${queue.total} scroll${queue.total > 1 ? 's' : ''}.`, 'success');
    return;
  }
  
  // Check if we still have enough materials
  const paperCount = calculateAvailableItems(queue.recipe.requiredPaper);
  if (paperCount < queue.recipe.paperQuantity) {
    console.log(`Scribing: No more ${queue.recipe.requiredPaper} available, stopping scroll queue`);
    scrollQueue.delete(playerId);
    const tableKey = `${queue.x},${queue.y}`;
    scribingTableStates.delete(tableKey);
    const completed = queue.total - queue.remaining;
    showScribingMessage(`Ran out of materials! Completed ${completed}/${queue.total} scroll${queue.total > 1 ? 's' : ''}.`, 'info');
    return;
  }
  
  // Show queue progress
  const currentNumber = queue.total - queue.remaining + 1;
  showScribingMessage(`Writing scroll ${currentNumber}/${queue.total}...`, 'info');
  
  // Start the actual scroll writing (single scroll)
  startScrollWriting(queue.scrollId, queue.x, queue.y, true); // true = fromQueue
}

// Start writing a scroll
function startScrollWriting(scrollId, x, y, fromQueue = false) {
  const recipe = SCROLL_RECIPES[scrollId];
  if (!recipe) return;
  
  console.log(`Scribing: Starting scroll writing: ${scrollId}${fromQueue ? ' (from queue)' : ''}`);
  
  // Check if we have enough materials
  const paperCount = calculateAvailableItems(recipe.requiredPaper);
  if (paperCount < recipe.paperQuantity) {
    showScribingMessage(`Not enough ${recipe.requiredPaper.replace('_', ' ')} to write this scroll.`, 'error');
    return;
  }
  
  // Check level requirement (skip if from queue, already checked)
  if (!fromQueue) {
    const profile = window.userModule?.getProfile();
    const playerLevel = profile?.skills.scribing || 1;
    if (playerLevel < recipe.level) {
      showScribingMessage(`You need level ${recipe.level} Scribing to write this scroll.`, 'error');
      return;
    }
  }
  
  // Remove required paper from inventory
  for (let i = 0; i < recipe.paperQuantity; i++) {
    const paperSlot = findItemInInventory(recipe.requiredPaper);
    if (paperSlot === -1) {
      showScribingMessage(`Not enough ${recipe.requiredPaper.replace('_', ' ')} to write this scroll.`, 'error');
      return;
    }
    
    const inventory = window.inventoryModule?.getPlayerInventory() || [];
    const currentItem = inventory[paperSlot];
    if (currentItem.quantity > 1) {
      currentItem.quantity -= 1;
      window.inventoryModule?.updateInventoryDisplay();
    } else {
      window.inventoryModule?.removeItemFromInventorySlot(paperSlot);
    }
  }
  
  // Set up writing session
  const sessionId = 'player';
  const tableKey = `${x},${y}`;
  
  activeScribing.set(sessionId, {
    type: 'scroll',
    recipe: recipe,
    scrollId: scrollId,
    x: x,
    y: y,
    startTime: Date.now(),
    endTime: Date.now() + recipe.writingTime,
    fromQueue: fromQueue
  });
  
  if (!fromQueue) {
    scribingTableStates.set(tableKey, sessionId);
    // Close interface
    closeScribingTableInterface();
  }
  
  // Show progress
  showSkillBubble('scribing', `Writing ${recipe.name}...`);
  if (!fromQueue) {
    showScribingMessage(`Started writing ${recipe.name}. This will take ${(recipe.writingTime / 1000).toFixed(1)} seconds.`, 'info');
  }
  
  // Set completion timer
  setTimeout(() => {
    completeScrollWriting(sessionId);
  }, recipe.writingTime);
}

// Complete book writing
function completeBookWriting(playerId) {
  const session = activeScribing.get(playerId);
  if (!session || session.type !== 'book') return;
  
  const recipe = session.recipe;
  const tableKey = `${session.x},${session.y}`;
  
  console.log(`Scribing: Completing book writing: ${session.bookId}`);
  
  // Get the player's name for the author signature
  const profile = window.userModule?.getProfile();
  const playerName = profile?.username || window.USERNAME || 'Unknown Author';
  
  // Get the base book definition
  const baseBookDef = window.inventoryModule?.getItemDefinition?.(recipe.resultItem) || 
                     (window.itemDefinitions && window.itemDefinitions[recipe.resultItem]) || {};
  
  // Create custom book with author information
  const customBookProperties = {
    author: playerName,  // Use 'author' for consistency with tooltip system
    authorName: playerName,  // Keep both for compatibility
    name: `${baseBookDef.name || 'Book'} (by ${playerName})`,
    description: `${baseBookDef.description || 'A completed book.'} Written and signed by ${playerName}.`,
    writtenDate: new Date().toISOString()
  };
  
  // Add the book to inventory with custom properties
  const success = window.inventoryModule?.addCustomItemToInventory?.(recipe.resultItem, 1, customBookProperties) || 
                 window.inventoryModule?.addItemToInventory?.(recipe.resultItem, 1);
  if (!success) {
    showScribingMessage('Your inventory is full! The book was lost.', 'error');
  } else {
    showScribingMessage(`Successfully wrote ${recipe.name}!`, 'success');
  }
  
  // Add experience
  if (profile) {
    console.log(`📜 Scribing: Adding ${recipe.experience} XP to scribing skill`);
    
    const leveledUp = addExperience('scribing', recipe.experience, profile.skills, profile.skillsExp);
    
    // Update UI
    if (window.uiModule && window.uiModule.updateSkillDisplay) {
      window.uiModule.updateSkillDisplay('scribing', profile.skills.scribing, leveledUp);
      if (leveledUp) {
        window.uiModule.updateTotalLevel(profile.skills);
      }
    }
    
    if (leveledUp) {
      showScribingMessage(`Level up! Your Scribing level is now ${profile.skills.scribing}!`, 'success');
    }
  }
  
  // Clean up
  activeScribing.delete(playerId);
  scribingTableStates.delete(tableKey);
  hideSkillBubble();
}

// Complete scroll writing
function completeScrollWriting(playerId) {
  const session = activeScribing.get(playerId);
  if (!session || session.type !== 'scroll') return;
  
  const recipe = session.recipe;
  const tableKey = `${session.x},${session.y}`;
  
  console.log(`Scribing: Completing scroll writing: ${session.scrollId}`);
  
  // Get the player's name for the author signature
  const scrollProfile = window.userModule?.getProfile();
  const scrollPlayerName = scrollProfile?.username || window.USERNAME || 'Unknown Author';
  
  // Get the base scroll definition
  const baseScrollDef = window.inventoryModule?.getItemDefinition?.(recipe.resultItem) || 
                       (window.itemDefinitions && window.itemDefinitions[recipe.resultItem]) || {};
  
  // Create custom scroll with author information
  const customScrollProperties = {
    author: scrollPlayerName,  // Use 'author' for consistency with tooltip system
    authorName: scrollPlayerName,  // Keep both for compatibility
    name: `${baseScrollDef.name || 'Scroll'} (by ${scrollPlayerName})`,
    description: `${baseScrollDef.description || 'A completed scroll.'} Written and signed by ${scrollPlayerName}.`,
    writtenDate: new Date().toISOString()
  };
  
  // Add the scroll to inventory
  const success = window.inventoryModule?.addCustomItemToInventory?.(recipe.resultItem, 1, customScrollProperties) || 
                 window.inventoryModule?.addItemToInventory?.(recipe.resultItem, 1);
  if (!success) {
    showScribingMessage('Your inventory is full! The scroll was lost.', 'error');
    
    // Stop queue if inventory is full
    if (scrollQueue.has(playerId)) {
      const queue = scrollQueue.get(playerId);
      const completed = queue.total - queue.remaining;
      scrollQueue.delete(playerId);
      showScribingMessage(`Inventory full! Completed ${completed}/${queue.total} scroll${queue.total > 1 ? 's' : ''}.`, 'info');
    }
    
    // Clean up
    activeScribing.delete(playerId);
    if (!session.fromQueue) {
      scribingTableStates.delete(tableKey);
    }
    hideSkillBubble();
    return;
  }
  
  // Add experience
  const profile = window.userModule?.getProfile();
  if (profile) {
    console.log(`📜 Scribing: Adding ${recipe.experience} XP to scribing skill`);
    
    const leveledUp = addExperience('scribing', recipe.experience, profile.skills, profile.skillsExp);
    
    // Update UI
    if (window.uiModule && window.uiModule.updateSkillDisplay) {
      window.uiModule.updateSkillDisplay('scribing', profile.skills.scribing, leveledUp);
      if (leveledUp) {
        window.uiModule.updateTotalLevel(profile.skills);
      }
    }
    
    if (leveledUp) {
      showScribingMessage(`Level up! Your Scribing level is now ${profile.skills.scribing}!`, 'success');
    }
  }
  
  // Check if this was part of a scroll queue
  const queue = scrollQueue.get(playerId);
  if (queue && session.fromQueue) {
    queue.remaining -= 1;
    console.log(`Scribing: Scroll queue progress - ${queue.remaining} scrolls remaining`);
    
    // Clean up current session
    activeScribing.delete(playerId);
    hideSkillBubble();
    
    // Continue queue processing after a short delay
    setTimeout(() => {
      processScrollQueue(playerId);
    }, 500); // Small delay between scrolls
  } else {
    // Single scroll completion or queue finished
    if (!session.fromQueue) {
      showScribingMessage(`Successfully wrote ${recipe.name}!`, 'success');
    }
    
    // Clean up
    activeScribing.delete(playerId);
    if (!session.fromQueue) {
      scribingTableStates.delete(tableKey);
    }
    hideSkillBubble();
  }
}

// Close scribing table interface
function closeScribingTableInterface() {
  if (activeScribingTableInterface && activeScribingTableInterface.element) {
    // Remove escape key handler if it exists
    if (activeScribingTableInterface.escapeHandler) {
      document.removeEventListener('keydown', activeScribingTableInterface.escapeHandler);
    }
    
    activeScribingTableInterface.element.remove();
    activeScribingTableInterface = null;
    console.log('Scribing table interface closed');
  } else {
    // Fallback: find and remove the interface by ID
    const existingInterface = document.getElementById('scribing-table-interface');
    if (existingInterface) {
      existingInterface.remove();
      console.log('Scribing table interface closed (fallback)');
    }
    activeScribingTableInterface = null;
  }
}

// Handle movement completion for scribing table
function handleScribingTableMovementComplete() {
  if (window.scribingTableTarget) {
    const target = window.scribingTableTarget;
    console.log('Scribing: Movement complete, opening table interface');
    showScribingTableInterface(target.tableType, target.x, target.y, target.element);
    window.scribingTableTarget = null;
  }
}

// Expose scribing state globally for other modules
window.activeScribing = activeScribing;
window.isScribing = isScribing;
window.cancelScribing = cancelScribing;
window.scribingModule = {
  startBookWriting,
  continueBookWriting,
  startScrollWriting,
  startScrollWritingWithQuantity,
  filterBooksBySkill
};

// Export scribing functions
export {
  initializeScribing,
  cancelScribing,
  isScribing,
  handleMovementComplete,
  addPulpBasinInteractionHandlers,
  addScribingTableInteractionHandlers,
  getActiveScribingSession,
  handlePulpBasinClick,
  handlePulpBasinClickFromWorld,
  handleScribingTableClick,
  handleScribingTableMovementComplete,
  closeScribingTableInterface,
  switchScribingTab,
  startBookWriting,
  continueBookWriting,
  startScrollWriting,
  startScrollWritingWithQuantity,
  filterBooksBySkill,
  PULP_BASIN_DEFINITIONS,
  SCRIBING_TABLE_DEFINITIONS,
  PULP_RECIPES,
  PAPER_RECIPES,
  BOOK_RECIPES,
  SCROLL_RECIPES
}; 