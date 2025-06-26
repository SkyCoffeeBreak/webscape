// NPC Definitions - Central configuration for all NPCs
// Similar to ItemDefinitions.js but for NPCs

export const NPC_DEFINITIONS = {
  rat: {
    id: 'rat',
    name: 'Rat',
    emoji: '🐀',
    combatLevel: 1,
    health: 5,
    maxHealth: 5,
    
    // Combat stats
    attackLevel: 1,
    defenceLevel: 1,
    attackSpeed: 4, // ticks between attacks
    maxHit: 1,
    examine: 'A filthy rat sniffing around.',
    
    // Movement behavior
    wanderRadius: 3,
    moveIntervalMin: 1500, // 1.5 seconds
    moveIntervalMax: 6000, // 6 seconds
    stopChance: 0.2, // 20% chance to stop
    
    // Aggression
    aggressive: false,
    aggroRadius: 0,
    
    // Drop table (item_id: {chance, minQuantity, maxQuantity})
    dropTable: {
      small_bones: { chance: 1.0, minQuantity: 1, maxQuantity: 1 }, // Always drops bones
      coins: { chance: 0.1, minQuantity: 1, maxQuantity: 3 }, // 10% chance for 1-3 coins
      cheese: { chance: 0.05, minQuantity: 1, maxQuantity: 1 } // 5% chance for cheese
    },
    
    // Experience rewards
    experienceRewards: {
      attack: 2,
      defence: 2,
      hitpoints: 2
    },
    
    // Spawn settings
    spawnWeight: 1.0, // Relative spawn frequency
    spawnEnvironments: ['grassland', 'dungeon', 'sewer'], // Where they can spawn
    
    // Special properties
    poisonous: false,
    undead: false,
    slayerLevel: 1,
    slayerCategory: 'vermin'
  },
  
  cow: {
    id: 'cow',
    name: 'Cow',
    emoji: '🐄',
    combatLevel: 2,
    health: 15,
    maxHealth: 15,
    
    // Combat stats
    attackLevel: 1,
    defenceLevel: 1,
    attackSpeed: 5, // slower than rats
    maxHit: 2,
    examine: 'A peaceful cow. Moo!',
    
    // Movement behavior
    wanderRadius: 4,
    moveIntervalMin: 2000, // 2 seconds
    moveIntervalMax: 6000, // 6 seconds
    stopChance: 0.25, // 25% chance to stop
    
    // Aggression
    aggressive: false,
    aggroRadius: 0,
    
    // Drop table
    dropTable: {
      bones: { chance: 1.0, minQuantity: 1, maxQuantity: 1 },
      'raw_beef': { chance: 1.0, minQuantity: 1, maxQuantity: 1 }, // Always drops raw beef
      'cow_hide': { chance: 1.0, minQuantity: 1, maxQuantity: 1 }, // Always drops hide
      coins: { chance: 0.15, minQuantity: 2, maxQuantity: 8 } // 15% chance for 2-8 coins
    },
    
    // Experience rewards
    experienceRewards: {
      attack: 5,
      defence: 5,
      hitpoints: 5
    },
    
    // Spawn settings
    spawnWeight: 0.8, // Slightly less common than rats
    spawnEnvironments: ['grassland', 'farm'],
    
    // Special properties
    poisonous: false,
    undead: false,
    slayerLevel: 1,
    slayerCategory: 'beast'
  },
  
  // Template for future NPCs
  goblin: {
    id: 'goblin',
    name: 'Goblin',
    emoji: '👹',
    combatLevel: 5,
    health: 25,
    maxHealth: 25,
    
    attackLevel: 5,
    defenceLevel: 1,
    attackSpeed: 4,
    maxHit: 4,
    examine: 'A nasty little goblin looking for trouble.',
    
    wanderRadius: 5,
    moveIntervalMin: 2000,
    moveIntervalMax: 4000,
    stopChance: 0.2,
    
    aggressive: true,
    aggroRadius: 3,
    
    dropTable: {
      bones: { chance: 1.0, minQuantity: 1, maxQuantity: 1 },
      coins: { chance: 0.8, minQuantity: 5, maxQuantity: 25 },
      'bronze_sword': { chance: 0.1, minQuantity: 1, maxQuantity: 1 },
      'bronze_dagger': { chance: 0.15, minQuantity: 1, maxQuantity: 1 }
    },
    
    experienceRewards: {
      attack: 12,
      defence: 12,
      hitpoints: 12
    },
    
    spawnWeight: 0.6,
    spawnEnvironments: ['wilderness', 'dungeon'],
    
    poisonous: false,
    undead: false,
    slayerLevel: 1,
    slayerCategory: 'humanoid'
  }
};

// Helper functions for working with NPC definitions
export function getNPCDefinition(npcId) {
  return NPC_DEFINITIONS[npcId] || null;
}

export function getAllNPCDefinitions() {
  return NPC_DEFINITIONS;
}

export function getNPCsByEnvironment(environment) {
  return Object.values(NPC_DEFINITIONS).filter(npc => 
    npc.spawnEnvironments.includes(environment)
  );
}

export function getNPCsBySlayerCategory(category) {
  return Object.values(NPC_DEFINITIONS).filter(npc => 
    npc.slayerCategory === category
  );
}

export function calculateDrops(npcId) {
  const npcDef = getNPCDefinition(npcId);
  if (!npcDef) return [];
  
  const drops = [];
  
  for (const [itemId, dropInfo] of Object.entries(npcDef.dropTable)) {
    if (Math.random() < dropInfo.chance) {
      const quantity = Math.floor(Math.random() * (dropInfo.maxQuantity - dropInfo.minQuantity + 1)) + dropInfo.minQuantity;
      drops.push({ itemId, quantity });
    }
  }
  
  return drops;
}

export function getNPCExperienceReward(npcId, skill) {
  const npcDef = getNPCDefinition(npcId);
  if (!npcDef || !npcDef.experienceRewards) return 0;
  
  return npcDef.experienceRewards[skill] || 0;
}

// CommonJS exports for server compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    NPC_DEFINITIONS,
    getNPCDefinition,
    getAllNPCDefinitions,
    getNPCsByEnvironment,
    getNPCsBySlayerCategory,
    calculateDrops,
    getNPCExperienceReward
  };
} 