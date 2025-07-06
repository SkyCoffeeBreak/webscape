/**
 * Archaeology module for WebscapeRPG
 * Handles archaeology mechanics, dig sites, tool requirements, and artifact discovery
 */

import { addExperience } from '../skills.js';
import { showSkillBubble, hideSkillBubble } from '../skillBubbles.js';

// Archaeology constants
const ARCHAEOLOGY_CONSTANTS = {
  BASE_DIGGING_TIME: 5000, // Base time in milliseconds
  ANIMATION_DURATION: 1200, // Time between excavation motions
  SITE_RESPAWN_TIME: 45000, // 45 seconds for site respawn
};

// Dig site definitions with archaeology requirements
const DIG_SITE_DEFINITIONS = {
  'dig_site_ruins': {
    name: 'Ancient Ruins',
    icon: '🏛️',
    level: 1,
    experience: 25,
    artifacts: ['ancient_pottery', 'bronze_coin'],
    respawnTime: 8000,
    minimumDigsUntilDepletion: 2,
    depletionChance: 0.3
  },
  'dig_site_burial': {
    name: 'Burial Mound',
    icon: '⛰️',
    level: 15,
    experience: 25,
    artifacts: ['bronze_coin', 'stone_tablet'],
    respawnTime: 12000,
    minimumDigsUntilDepletion: 3,
    depletionChance: 0.25
  },
  'dig_site_temple': {
    name: 'Lost Temple',
    icon: '🏯',
    level: 30,
    experience: 40,
    artifacts: ['stone_tablet', 'ancient_scroll'],
    respawnTime: 15000,
    minimumDigsUntilDepletion: 2,
    depletionChance: 0.35
  },
  'dig_site_palace': {
    name: 'Royal Palace',
    icon: '🏰',
    level: 50,
    experience: 60,
    artifacts: ['ancient_scroll', 'golden_amulet'],
    respawnTime: 20000,
    minimumDigsUntilDepletion: 2,
    depletionChance: 0.4
  },
  'dig_site_dragon': {
    name: 'Dragon Lair',
    icon: '🐉',
    level: 75,
    experience: 85,
    artifacts: ['golden_amulet', 'dragon_relic'],
    respawnTime: 30000,
    minimumDigsUntilDepletion: 1,
    depletionChance: 0.5
  }
};

// Tool definitions with archaeology requirements
const TOOL_DEFINITIONS = {
  'wooden_brush': {
    name: 'Wooden Brush',
    level: 1,
    diggingBonus: 0,
    icon: '🖌️'
  },
  'bronze_trowel': {
    name: 'Bronze Trowel',
    level: 5,
    diggingBonus: 0.1,
    icon: '🔧'
  },
  'iron_pickaxe': {
    name: 'Iron Pickaxe',
    level: 10,
    diggingBonus: 0.2,
    icon: '⛏️'
  },
  'steel_excavator': {
    name: 'Steel Excavator',
    level: 20,
    diggingBonus: 0.3,
    icon: '🔨'
  },
  'enchanted_brush': {
    name: 'Enchanted Brush',
    level: 40,
    diggingBonus: 0.5,
    icon: '✨'
  }
};

// Artifact definitions
const ARTIFACT_DEFINITIONS = {
  'ancient_pottery': {
    name: 'Ancient Pottery',
    icon: '🏺',
    experience: 5,
    rarity: 'common'
  },
  'bronze_coin': {
    name: 'Bronze Coin',
    icon: '🪙',
    experience: 8,
    rarity: 'common'
  },
  'stone_tablet': {
    name: 'Stone Tablet',
    icon: '📿',
    experience: 12,
    rarity: 'uncommon'
  },
  'ancient_scroll': {
    name: 'Ancient Scroll',
    icon: '📜',
    experience: 18,
    rarity: 'rare'
  },
  'golden_amulet': {
    name: 'Golden Amulet',
    icon: '🏅',
    experience: 25,
    rarity: 'rare'
  },
  'dragon_relic': {
    name: 'Dragon Relic',
    icon: '🔮',
    experience: 40,
    rarity: 'legendary'
  }
};

// Global state tracking
const activeArchaeology = new Map();
const depletedSiteStates = new Map();
const siteRespawnTimers = new Map();
const siteDigCounts = new Map();

// Click cooldown tracking
const lastClickTimes = new Map();
const resourceCooldowns = new Map();
const CLICK_COOLDOWN = 600; // 0.6 seconds
const RESOURCE_COOLDOWN = 1200; // 1.2 seconds cooldown per resource

// Expose depleted site states globally for world module access
window.depletedSiteStates = depletedSiteStates;

// Initialize archaeology system
function initializeArchaeology() {
  console.log('Initializing archaeology system...');
  
  // Add dig site interaction handlers
  addDigSiteInteractionHandlers();
  
  console.log('Archaeology system initialized');
}

// Add interaction handlers to dig site objects in the world
function addDigSiteInteractionHandlers() {
  document.querySelectorAll('.world-object').forEach(element => {
    const objectType = element.dataset.type;
    if (objectType && objectType.startsWith('dig_site_')) {
      element.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const siteX = parseInt(element.dataset.x);
        const siteY = parseInt(element.dataset.y);
        
        console.log(`Archaeology: Clicked on ${objectType} at (${siteX}, ${siteY})`);
        handleDigSiteClick(objectType, siteX, siteY, element);
      });
    }
  });
}

// Handle clicking on a dig site object
function handleDigSiteClick(siteType, x, y, siteElement) {
  console.log(`Archaeology: Clicked ${siteType} at (${x}, ${y})`);
  
  const playerId = 'player';
  
  // Check for click cooldown
  const siteKey = `${x},${y}`;
  const now = Date.now();
  const lastClickTime = lastClickTimes.get(siteKey) || 0;
  
  if (now - lastClickTime < CLICK_COOLDOWN) {
    console.log(`Archaeology: Click cooldown active for site at (${x}, ${y})`);
    return;
  }
  
  lastClickTimes.set(siteKey, now);
  
  // Check if site is depleted
  if (depletedSiteStates.has(siteKey)) {
    showArchaeologyMessage('This site has been thoroughly excavated and needs time to settle...', 'warning');
    return;
  }
  
  // Check for resource cooldown
  const resourceCooldownTime = resourceCooldowns.get(siteKey) || 0;
  if (now < resourceCooldownTime) {
    const remainingTime = Math.ceil((resourceCooldownTime - now) / 1000);
    showArchaeologyMessage(`You need to wait ${remainingTime} more second(s) before excavating this site again.`, 'warning');
    return;
  }
  
  // Check if already excavating this site
  const existingSession = getActiveArchaeologySession(playerId);
  if (existingSession && existingSession.x === x && existingSession.y === y) {
    console.log(`Archaeology: Already excavating site at (${x}, ${y})`);
    return;
  }
  
  // Cancel any existing archaeology session
  if (existingSession) {
    cancelArchaeology(playerId);
  }
  
  // Start archaeology
  startArchaeology(siteType, x, y, siteElement);
}

// Start archaeology session
function startArchaeology(siteType, x, y, siteElement) {
  const playerId = 'player';
  const profile = getUserProfile();
  
  if (!profile) {
    showArchaeologyMessage('Unable to access user profile', 'error');
    return;
  }
  
  // Check archaeology level requirement
  const siteDefinition = DIG_SITE_DEFINITIONS[siteType];
  if (!siteDefinition) {
    showArchaeologyMessage('Unknown dig site type', 'error');
    return;
  }
  
  const currentLevel = profile.skills.archaeology || 1;
  if (currentLevel < siteDefinition.level) {
    showArchaeologyMessage(`You need level ${siteDefinition.level} Archaeology to excavate this site.`, 'warning');
    return;
  }
  
  // Find best tool
  const bestTool = findBestTool(profile);
  if (!bestTool) {
    showArchaeologyMessage('You need an archaeology tool to excavate sites. Try using a brush or pickaxe!', 'warning');
    return;
  }
  
  console.log(`Archaeology: Starting excavation with ${bestTool.name}`);
  
  // Calculate excavation time with tool bonus
  const baseTime = ARCHAEOLOGY_CONSTANTS.BASE_DIGGING_TIME;
  const toolBonus = bestTool.diggingBonus || 0;
  const excavationTime = Math.max(1000, baseTime * (1 - toolBonus));
  
  // Store archaeology session
  const session = {
    playerId,
    siteType,
    x,
    y,
    siteElement,
    tool: bestTool,
    startTime: Date.now(),
    excavationTime,
    completed: false
  };
  
  activeArchaeology.set(playerId, session);
  
  // Start excavation animation and process
  startArchaeologyAnimation();
  
  // Set timeout for completion
  session.timeoutId = setTimeout(() => {
    completeArchaeology(playerId);
  }, excavationTime);
  
  showArchaeologyMessage(`Excavating ${siteDefinition.name} with ${bestTool.name}...`, 'info');
  showSkillBubble('archaeology');
}

// Find best available archaeology tool
function findBestTool(profile) {
  const inventory = profile.inventory || [];
  const currentLevel = profile.skills.archaeology || 1;
  
  let bestTool = null;
  let highestBonus = -1;
  
  for (const slot of inventory) {
    if (slot && slot.id) {
      const toolDef = TOOL_DEFINITIONS[slot.id];
      if (toolDef && currentLevel >= toolDef.level && toolDef.diggingBonus > highestBonus) {
        bestTool = {
          ...toolDef,
          slot: inventory.indexOf(slot)
        };
        highestBonus = toolDef.diggingBonus;
      }
    }
  }
  
  return bestTool;
}

// Start archaeology animation
function startArchaeologyAnimation() {
  const player = document.querySelector('.player');
  if (player) {
    player.classList.add('excavating');
  }
}

// Stop archaeology animation
function stopArchaeologyAnimation() {
  const player = document.querySelector('.player');
  if (player) {
    player.classList.remove('excavating');
  }
}

// Complete archaeology session
function completeArchaeology(playerId) {
  const session = activeArchaeology.get(playerId);
  if (!session || session.completed) return;
  
  session.completed = true;
  
  const { siteType, x, y, siteElement } = session;
  const siteDefinition = DIG_SITE_DEFINITIONS[siteType];
  
  if (!siteDefinition) {
    console.error('Archaeology: Unknown site type:', siteType);
    return;
  }
  
  // Stop animation
  stopArchaeologyAnimation();
  hideSkillBubble();
  
  // Award experience
  const experience = siteDefinition.experience;
  addExperience('archaeology', experience);
  
  // Determine artifact found
  const artifactFound = determineArtifact(siteDefinition.artifacts);
  
  if (artifactFound) {
    // Add artifact to inventory
    addArtifactToInventory(artifactFound);
    
    const artifactDef = ARTIFACT_DEFINITIONS[artifactFound];
    showArchaeologyMessage(`You discovered a ${artifactDef.name}! (+${experience} Archaeology XP)`, 'success');
    
    // Award bonus experience for the artifact
    const bonusExp = artifactDef.experience;
    if (bonusExp > 0) {
      addExperience('archaeology', bonusExp);
    }
  } else {
    showArchaeologyMessage(`You carefully excavated the site but found nothing this time. (+${experience} Archaeology XP)`, 'info');
  }
  
  // Track digs for depletion
  const siteKey = `${x},${y}`;
  const currentDigs = siteDigCounts.get(siteKey) || 0;
  siteDigCounts.set(siteKey, currentDigs + 1);
  
  // Check for site depletion
  if (currentDigs >= siteDefinition.minimumDigsUntilDepletion) {
    const depletionRoll = Math.random();
    if (depletionRoll < siteDefinition.depletionChance) {
      requestSiteDepletion(siteType, x, y, siteElement);
    }
  }
  
  // Set resource cooldown
  const cooldownTime = Date.now() + RESOURCE_COOLDOWN;
  resourceCooldowns.set(siteKey, cooldownTime);
  
  // Clean up session
  activeArchaeology.delete(playerId);
}

// Determine which artifact is found
function determineArtifact(possibleArtifacts) {
  // 70% chance to find an artifact
  if (Math.random() < 0.7) {
    const randomIndex = Math.floor(Math.random() * possibleArtifacts.length);
    return possibleArtifacts[randomIndex];
  }
  return null;
}

// Add artifact to inventory
function addArtifactToInventory(artifactId) {
  try {
    if (window.inventoryModule && window.inventoryModule.addItemToInventory) {
      window.inventoryModule.addItemToInventory(artifactId, 1);
      console.log(`Archaeology: Added ${artifactId} to inventory`);
    } else {
      console.error('Archaeology: Inventory module not available');
    }
  } catch (error) {
    console.error('Archaeology: Error adding artifact to inventory:', error);
  }
}

// Request site depletion
function requestSiteDepletion(siteType, x, y, siteElement) {
  console.log(`Archaeology: Requesting depletion for site at (${x}, ${y})`);
  depleteSiteConfirmed(siteType, x, y, siteElement);
}

// Confirm site depletion
function depleteSiteConfirmed(siteType, x, y, siteElement) {
  const siteKey = `${x},${y}`;
  const siteDefinition = DIG_SITE_DEFINITIONS[siteType];
  
  if (!siteDefinition) return;
  
  // Mark site as depleted
  depletedSiteStates.set(siteKey, {
    siteType,
    depletedAt: Date.now(),
    depletedBy: 'player'
  });
  
  // Reset dig count
  siteDigCounts.delete(siteKey);
  
  // Hide the site element
  if (siteElement) {
    siteElement.style.opacity = '0.3';
    siteElement.style.pointerEvents = 'none';
  }
  
  // Schedule respawn
  const respawnTime = siteDefinition.respawnTime;
  const respawnTimer = setTimeout(() => {
    respawnSiteFromServer(siteType, x, y);
  }, respawnTime);
  
  siteRespawnTimers.set(siteKey, respawnTimer);
  
  console.log(`Archaeology: Site at (${x}, ${y}) depleted, respawning in ${respawnTime}ms`);
}

// Respawn site
function respawnSiteFromServer(siteType, x, y) {
  const siteKey = `${x},${y}`;
  
  // Remove depletion state
  depletedSiteStates.delete(siteKey);
  siteRespawnTimers.delete(siteKey);
  
  // Find and restore site element
  const siteElement = document.querySelector(`.world-object[data-type="${siteType}"][data-x="${x}"][data-y="${y}"]`);
  if (siteElement) {
    siteElement.style.opacity = '1';
    siteElement.style.pointerEvents = 'auto';
  }
  
  console.log(`Archaeology: Site ${siteType} respawned at (${x}, ${y})`);
}

// Cancel archaeology session
function cancelArchaeology(playerId = 'player') {
  const session = activeArchaeology.get(playerId);
  if (!session) return false;
  
  // Clear timeout
  if (session.timeoutId) {
    clearTimeout(session.timeoutId);
  }
  
  // Stop animation
  stopArchaeologyAnimation();
  hideSkillBubble();
  
  // Remove session
  activeArchaeology.delete(playerId);
  
  showArchaeologyMessage('Excavation cancelled.', 'info');
  return true;
}

// Check if player is currently excavating
function isExcavating(playerId = 'player') {
  return activeArchaeology.has(playerId);
}

// Show archaeology message
function showArchaeologyMessage(message, type = 'info') {
  if (window.showNotification) {
    window.showNotification(message, type);
  } else {
    console.log(`Archaeology ${type}: ${message}`);
  }
}

// Get active archaeology session
function getActiveArchaeologySession(playerId = 'player') {
  return activeArchaeology.get(playerId) || null;
}

// Get user profile
function getUserProfile() {
  try {
    if (window.userModule && window.userModule.getProfile) {
      return window.userModule.getProfile();
    } else if (window.profile) {
      return window.profile;
    } else {
      console.error('Archaeology: No user profile access method found');
      return null;
    }
  } catch (error) {
    console.error('Archaeology: Error getting user profile:', error);
    return null;
  }
}

// Export functions for use by other modules
export {
  initializeArchaeology,
  handleDigSiteClick,
  startArchaeology,
  cancelArchaeology,
  isExcavating,
  getActiveArchaeologySession,
  DIG_SITE_DEFINITIONS,
  TOOL_DEFINITIONS,
  ARTIFACT_DEFINITIONS
};

// Initialize when module loads
console.log('Archaeology module loaded');

// Auto-initialize if DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeArchaeology);
} else {
  initializeArchaeology();
}

// Expose globally for easy access
window.archaeologyModule = {
  initializeArchaeology,
  handleDigSiteClick,
  startArchaeology,
  cancelArchaeology,
  isExcavating,
  getActiveArchaeologySession,
  DIG_SITE_DEFINITIONS,
  TOOL_DEFINITIONS,
  ARTIFACT_DEFINITIONS
}; 