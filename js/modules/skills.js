/**
 * Skills module for WebscapeRPG
 * Manages all skill-related data and operations
 */

// Initial skills data with default levels
const skillsData = {
  // Combat Skills
  attack: 1,
  strength: 1,
  stamina: 1,
  magic: 1,
  darkmagic: 1,
  lightmagic: 1,
  ranged: 1,
  gunner: 1,
  blasting: 1,
  cardmaster: 1,
  poisoning: 1,
  rogue: 1,
  defence: 1,
  hitpoints: 10,
  prayer: 1,
  sealing: 1,
  slayer: 1,
  
  // Creature/Spirit Skills
  taming: 1,
  summoning: 1,
  tidecalling: 1,
  necromancy: 1,
  falconry: 1,
  pacting: 1,
  dracology: 1,
  
  // Gathering Skills
  mining: 1,
  fishing: 1,
  harvesting: 1,
  woodcutting: 1,
  hunting: 1,
  mycology: 1,
  diving: 1,
  
  // Artisan Skills
  smithing: 1,
  crafting: 1,
  engineering: 1,
  cooking: 1,
  confectionery: 1,
  fletching: 1,
  scribing: 1,
  apothecary: 1,
  brewing: 1,
  painting: 1,
  pottery: 1,
  masonry: 1,
  bonecarving: 1,
  tailoring: 1,
  candlemaking: 1,
  glassworking: 1,
  toymaking: 1,
  carpentry: 1,
  butchery: 1,
  leatherworking: 1,
  
  // Magic/Mystical Skills
  creation: 1,
  enchanting: 1,
  runecrafting: 1,
  alchemy: 1,
  warding: 1,
  astrology: 1,
  dreaming: 1,
  geomancy: 1,
  windweaving: 1,
  firemaking: 1,
  
  // Support Skills
  thieving: 1,
  delivery: 1,
  knowledge: 1,
  digging: 1,
  diplomacy: 1,
  sailing: 1,
  archaeology: 1,
  ruling: 1,
  prospecting: 1,
  crystallization: 1,
  agility: 1,
  
  // Production/Trade Skills
  ranching: 1,
  beekeeping: 1,
  aquaculture: 1,
  gardening: 1,
  merchanting: 1,
  barista: 1,
  
  // Entertainment/Art Skills
  entertainment: 1,
  barding: 1,
  gravekeeping: 1,
  scrapping: 1,
  
  // Specialized Skills
  gambling: 1,
  occultism: 1,
  riding: 1,
  bestiary: 1,
  maskMaking: 1,
  bugCatching: 1,
  exploration: 1,
  shifting: 1,
  druidism: 1,
  mythology: 1,
  artisan: 1,
  shellcraft: 1,
  ghostHunting: 1,
  spiritbinding: 1,
  invention: 1,
  snowcraft: 1,
  golemancy: 1,
  puppeteering: 1,
  dungeoneering: 1
};

// Skill categories for organization
const skillCategories = {
  combat: ['attack', 'strength', 'stamina', 'magic', 'darkmagic', 'lightmagic', 'ranged', 'gunner', 'blasting', 'cardmaster', 'poisoning', 'rogue', 'defence', 'hitpoints', 'prayer', 'sealing', 'slayer', 'dungeoneering'],
  gathering: ['mining', 'fishing', 'harvesting', 'woodcutting', 'hunting', 'mycology', 'diving', 'digging', 'archaeology', 'bugCatching', 'ghostHunting'],
  artisan: ['smithing', 'crafting', 'engineering', 'cooking', 'confectionery', 'fletching', 'scribing', 'apothecary', 'brewing', 'painting', 'pottery', 'masonry', 'bonecarving', 'tailoring', 'candlemaking', 'glassworking', 'toymaking', 'carpentry', 'butchery', 'leatherworking', 'maskMaking', 'shellcraft', 'invention'],
  magic: ['creation', 'enchanting', 'runecrafting', 'alchemy', 'warding', 'astrology', 'dreaming', 'geomancy', 'windweaving', 'spiritbinding', 'shifting', 'druidism'],
  support: ['thieving', 'delivery', 'knowledge', 'diplomacy', 'sailing', 'ruling', 'ranching', 'beekeeping', 'aquaculture', 'gardening', 'merchanting', 'barista', 'firemaking', 'bestiary', 'gravekeeping', 'prospecting', 'crystallization', 'agility'],
  companion: ['taming', 'summoning', 'tidecalling', 'necromancy', 'falconry', 'pacting', 'dracology', 'golemancy', 'puppeteering'],
  misc: ['entertainment', 'barding', 'gambling', 'occultism', 'riding', 'exploration', 'mythology', 'artisan', 'snowcraft', 'scrapping']
};

// Experience table - amount needed for each level
const expTable = [];
let points = 0;
for (let level = 1; level <= 99; level++) {
  points += Math.floor(level + 300 * Math.pow(2, level / 7));
  expTable[level] = Math.floor(points / 4);
}

// Get tier class based on skill level
function getTierClass(level) {
  if (level >= 99) return 'tier-diamond';
  if (level >= 85) return 'tier-ruby';
  if (level >= 75) return 'tier-emerald';
  if (level >= 65) return 'tier-sapphire';
  if (level >= 50) return 'tier-gold';
  if (level >= 35) return 'tier-silver';
  if (level >= 20) return 'tier-steel';
  return 'tier-iron';
}

// Calculate total level from all skills
function calculateTotalLevel(skills) {
  return Object.values(skills).reduce((sum, level) => sum + level, 0);
}

// Calculate total experience from all skills
function calculateTotalExperience(skillsExp) {
  return Object.values(skillsExp).reduce((sum, exp) => sum + exp, 0);
}

// Calculate level from experience points
function getLevelFromExperience(experience) {
  // Special case for hitpoints - minimum level 10
  if (experience >= 1154) { // Level 10 hitpoints XP
    for (let level = 99; level >= 10; level--) {
      if (experience >= expTable[level]) {
        return level;
      }
    }
    return 10; // Minimum hitpoints level
  }
  
  // For other skills, normal calculation starting from level 1
  for (let level = 99; level >= 1; level--) {
    if (experience >= expTable[level]) {
      return level;
    }
  }
  return 1;
}

// Format experience numbers for display (e.g., 1234567 -> "1.23M")
function formatExperience(exp) {
  if (exp >= 1000000) {
    return (exp / 1000000).toFixed(2).replace(/\.?0+$/, '') + 'M';
  } else if (exp >= 1000) {
    return (exp / 1000).toFixed(1).replace(/\.?0+$/, '') + 'K';
  } else {
    return exp.toString();
  }
}

// Format experience numbers with full precision for tooltips (e.g., 1234567 -> "1,234,567")
function formatExperienceFull(exp) {
  return exp.toLocaleString();
}

// Get detailed experience information for a skill (for tooltips)
function getSkillExperienceInfo(skillName, skills, skillsExp) {
  const currentLevel = skills[skillName];
  const currentExp = skillsExp[skillName] || 0;
  
  if (currentLevel >= 99) {
    return {
      currentLevel: 99,
      currentExp: currentExp,
      currentExpFormatted: formatExperience(currentExp),
      currentExpFormattedFull: formatExperienceFull(currentExp),
      nextLevel: 99,
      expForThisLevel: expTable[99],
      expForNextLevel: expTable[99],
      expNeeded: 0,
      expProgress: currentExp - expTable[99],
      expProgressFormatted: formatExperience(currentExp - expTable[99]),
      expProgressFormattedFull: formatExperienceFull(currentExp - expTable[99]),
      progressPercent: 100,
      isMaxLevel: true
    };
  }
  
  const nextLevel = currentLevel + 1;
  const expForThisLevel = expTable[currentLevel];
  const expForNextLevel = expTable[nextLevel];
  const expNeeded = expForNextLevel - currentExp;
  const expProgress = currentExp - expForThisLevel;
  const progressPercent = Math.min(100, Math.max(0, (expProgress / (expForNextLevel - expForThisLevel)) * 100));
  
  return {
    currentLevel: currentLevel,
    currentExp: currentExp,
    currentExpFormatted: formatExperience(currentExp),
    currentExpFormattedFull: formatExperienceFull(currentExp),
    nextLevel: nextLevel,
    expForThisLevel: expForThisLevel,
    expForNextLevel: expForNextLevel,
    expNeeded: expNeeded,
    expNeededFormatted: formatExperience(expNeeded),
    expNeededFormattedFull: formatExperienceFull(expNeeded),
    expProgress: expProgress,
    expProgressFormatted: formatExperience(expProgress),
    progressPercent: progressPercent,
    isMaxLevel: false
  };
}

// Level up a skill (returns true if leveled up, false if not)
function levelUpSkill(skillName, skills, skillsExp, expGained) {
  if (!skills[skillName] || skills[skillName] >= 99) return false;
  
  skillsExp[skillName] += expGained;
  const currentLevel = skills[skillName];
  const nextLevel = currentLevel + 1;
  
  // Check if we have enough XP to level up
  if (nextLevel <= 99 && skillsExp[skillName] >= expTable[nextLevel]) {
    skills[skillName] = nextLevel;
    return true;
  }
  
  return false;
}

// Get experience needed for next level
function getExpForNextLevel(skillName, skills, skillsExp) {
  const currentLevel = skills[skillName];
  if (currentLevel >= 99) return 0;
  
  const currentExp = skillsExp[skillName];
  const neededExp = expTable[currentLevel + 1];
  
  return {
    current: currentExp,
    needed: neededExp,
    remaining: neededExp - currentExp
  };
}

// Add experience to a skill and handle level ups
function addExperience(skillName, expAmount, skills, skillsExp) {
  if (!skills[skillName] || !skillsExp) return false;
  
  const oldLevel = skills[skillName];
  const oldExp = skillsExp[skillName] || 0;
  
  // Add the experience
  skillsExp[skillName] = oldExp + expAmount;
  
  // Calculate new level based on total experience
  const newLevel = getLevelFromExperience(skillsExp[skillName]);
  
  // Cap at 99
  const finalLevel = Math.min(99, newLevel);
  
  // Update the skill level
  skills[skillName] = finalLevel;
  
  // Return whether a level up occurred
  return finalLevel > oldLevel;
}

// Ensure all skills have proper experience values (fixes missing/NaN experience)
function validateSkillsExperience(skills, skillsExp) {
  // Ensure skillsExp object exists
  if (!skillsExp) {
    skillsExp = {};
  }
  
  // Check each skill and fix missing/invalid experience values
  Object.keys(skillsData).forEach(skillName => {
    // Ensure skill level exists
    if (!skills[skillName] || isNaN(skills[skillName])) {
      skills[skillName] = skillName === 'hitpoints' ? 10 : 1;
    }
    
    // Ensure experience value exists and is valid
    if (!skillsExp[skillName] || isNaN(skillsExp[skillName])) {
      // Calculate proper experience for current level
      const currentLevel = skills[skillName];
      if (skillName === 'hitpoints') {
        // Hitpoints minimum level 10, ensure XP is at least 1154
        skillsExp[skillName] = Math.max(1154, expTable[currentLevel] || 1154);
      } else if (currentLevel > 1) {
        skillsExp[skillName] = expTable[currentLevel] || 0;
      } else {
        skillsExp[skillName] = 0;
      }
    }
    
    // Special validation for hitpoints - ensure level matches XP
    if (skillName === 'hitpoints') {
      const correctLevel = getLevelFromExperience(skillsExp[skillName]);
      if (skills[skillName] !== correctLevel) {
        console.log(`🔧 Fixing hitpoints level mismatch: was ${skills[skillName]}, should be ${correctLevel} for ${skillsExp[skillName]} XP`);
        skills[skillName] = correctLevel;
      }
    }
  });
  
  return { skills, skillsExp };
}

// Export all functions and data
export {
  skillsData,
  skillCategories,
  expTable,
  getTierClass,
  calculateTotalLevel,
  calculateTotalExperience,
  levelUpSkill,
  getExpForNextLevel,
  getLevelFromExperience,
  formatExperience,
  formatExperienceFull,
  getSkillExperienceInfo,
  addExperience,
  validateSkillsExperience
}; 