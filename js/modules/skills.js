/**
 * Skills module for WebscapeRPG
 * Manages all skill-related data and operations
 */

// Initial skills data with default levels
const skillsData = {
  // Combat Skills
  attack: 1, 
  magic: 1, 
  ranged: 1, 
  blasting: 1,
  defence: 1, 
  hitpoints: 10, 
  prayer: 1, 
  slayer: 1,
  
  // Gathering Skills
  mining: 1, 
  fishing: 1, 
  woodcutting: 1, 
  harvesting: 1,
  
  // Artisan Skills
  smithing: 1, 
  cooking: 1, 
  fletching: 1, 
  apothecary: 1,
  crafting: 1, 
  bonecarving: 1, 
  painting: 1, 
  brewing: 1,
  scribing: 1, 
  confectionery: 1, 
  masonry: 1, 
  tailoring: 1,
  
  // Support Skills
  thieving: 1, 
  alchemy: 1, 
  creation: 1, 
  delivery: 1,
  ranching: 1, 
  knowledge: 1, 
  candlemaking: 1, 
  pottery: 1,
  digging: 1,
  diplomacy: 1,
  apiary: 1,
  taming: 1,
  dracology: 1,
  engineering: 1
};

// Skill categories for organization
const skillCategories = {
  combat: ['attack', 'magic', 'ranged', 'blasting', 'defence', 'hitpoints', 'prayer', 'slayer'],
  gathering: ['mining', 'fishing', 'woodcutting', 'harvesting'],
  artisan: ['smithing', 'cooking', 'fletching', 'apothecary', 'crafting', 'bonecarving', 'painting', 
            'brewing', 'scribing', 'confectionery', 'masonry', 'tailoring'],
  support: ['thieving', 'alchemy', 'creation', 'delivery', 'ranching', 'knowledge', 'candlemaking', 'pottery', 'digging', 'diplomacy', 'apiary', 'taming', 'dracology', 'engineering']
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
      if (skillName === 'hitpoints' && currentLevel === 10) {
        skillsExp[skillName] = 1154; // Level 10 hitpoints = 1154 XP
      } else if (currentLevel > 1) {
        skillsExp[skillName] = expTable[currentLevel] || 0;
      } else {
        skillsExp[skillName] = 0;
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