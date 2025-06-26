/**
 * Fishing module for WebscapeRPG
 * Handles fishing mechanics, fishing spots, fishing rod requirements, and experience
 */

import { addExperience } from '../skills.js';
import { showSkillBubble, hideSkillBubble } from '../skillBubbles.js';

// Fishing constants
const FISHING_CONSTANTS = {
  BASE_FISHING_TIME: 4000, // Base time in milliseconds
  ANIMATION_DURATION: 1000, // Time between fishing motions
  RESPAWN_TIME: 30000, // 30 seconds for fish respawn
  EXPERIENCE_PER_CATCH: {
    'fishing_spot_shrimp': 10,
    'fishing_spot_sardine': 20,
    'fishing_spot_herring': 30,
    'fishing_spot_anchovies': 40,
    'fishing_spot_tuna': 80,
    'fishing_spot_lobster': 90,
    'fishing_spot_swordfish': 100,
    'fishing_spot_shark': 110
  }
};

// Fishing spot definitions with fishing requirements
const FISHING_SPOT_DEFINITIONS = {
  'fishing_spot_shrimp': {
    name: 'Shrimp Fishing Spot',
    icon: '🌀',
    level: 1,
    experience: 10,
    dropItem: 'raw_shrimps',
    respawnTime: 3000,
    toolRequired: 'small_net',
    toolName: 'Small Net'
  },
  'fishing_spot_sardine': {
    name: 'Sardine Fishing Spot',
    icon: '🌀',
    level: 5,
    experience: 20,
    dropItem: 'raw_sardine',
    respawnTime: 4000,
    toolRequired: 'fishing_rod',
    toolName: 'Fishing Rod'
  },
  'fishing_spot_herring': {
    name: 'Herring Fishing Spot',
    icon: '🌀',
    level: 10,
    experience: 30,
    dropItem: 'raw_herring',
    respawnTime: 4000,
    toolRequired: 'fishing_rod',
    toolName: 'Fishing Rod'
  },
  'fishing_spot_anchovies': {
    name: 'Anchovies Fishing Spot',
    icon: '🌀',
    level: 15,
    experience: 40,
    dropItem: 'raw_anchovies',
    respawnTime: 5000,
    toolRequired: 'big_net',
    toolName: 'Big Net'
  },
  'fishing_spot_tuna': {
    name: 'Tuna Fishing Spot',
    icon: '🌀',
    level: 35,
    experience: 80,
    dropItem: 'raw_tuna',
    respawnTime: 8000,
    toolRequired: 'harpoon',
    toolName: 'Harpoon'
  },
  'fishing_spot_lobster': {
    name: 'Lobster Fishing Spot',
    icon: '🌀',
    level: 40,
    experience: 90,
    dropItem: 'raw_lobster',
    respawnTime: 10000,
    toolRequired: 'lobster_pot',
    toolName: 'Lobster Pot'
  },
  'fishing_spot_swordfish': {
    name: 'Swordfish Fishing Spot',
    icon: '🌀',
    level: 50,
    experience: 100,
    dropItem: 'raw_swordfish',
    respawnTime: 12000,
    toolRequired: 'harpoon',
    toolName: 'Harpoon'
  },
  'fishing_spot_shark': {
    name: 'Shark Fishing Spot',
    icon: '🌀',
    level: 76,
    experience: 110,
    dropItem: 'raw_shark',
    respawnTime: 15000,
    toolRequired: 'harpoon',
    toolName: 'Harpoon'
  }
};

// Fishing tool definitions with fishing requirements
const FISHING_TOOL_DEFINITIONS = {
  'small_net': {
    name: 'Small Net',
    level: 1,
    fishingBonus: 0, // No bonus
    icon: '🕸️'
  },
  'fishing_rod': {
    name: 'Fishing Rod',
    level: 5,
    fishingBonus: 0.1, // 10% faster fishing
    icon: '🎣'
  },
  'big_net': {
    name: 'Big Net',
    level: 15,
    fishingBonus: 0.15,
    icon: '🕷️'
  },
  'harpoon': {
    name: 'Harpoon',
    level: 35,
    fishingBonus: 0.2,
    icon: '🔱'
  },
  'lobster_pot': {
    name: 'Lobster Pot',
    level: 40,
    fishingBonus: 0.25,
    icon: '🪣'
  }
};

// Global state tracking
const activeFishing = new Map(); // Track active fishing sessions
const depletedFishingSpotStates = new Map(); // Track depleted fishing spot states globally
const fishingSpotRespawnTimers = new Map(); // Track fishing spot respawn timers



// Click cooldown tracking
const lastClickTimes = new Map(); // Track last click time per fishing spot location
const resourceCooldowns = new Map(); // Track cooldown per resource regardless of player
const CLICK_COOLDOWN = 500; // 0.5 seconds in milliseconds (increased from 100ms)
const RESOURCE_COOLDOWN = 1000; // 1 second cooldown per resource after fishing completion

// Expose depleted fishing spot states globally for world module access
window.depletedFishingSpotStates = depletedFishingSpotStates;

// Initialize fishing system
function initializeFishing() {
  console.log('Initializing fishing system...');
  
  // Add fishing spot interaction handlers to existing world objects
  addFishingSpotInteractionHandlers();
  
  // Initialize fishing spot animations
  initializeFishingSpotAnimations();
  
  console.log('Fishing system initialized');
}

// Add interaction handlers to fishing spot objects in the world
function addFishingSpotInteractionHandlers() {
  // Find all fishing spot objects in the world and add click handlers
  document.querySelectorAll('.world-object').forEach(element => {
    const objectType = element.dataset.type;
    if (objectType && objectType.startsWith('fishing_spot_')) {
      element.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const fishingSpotX = parseInt(element.dataset.x);
        const fishingSpotY = parseInt(element.dataset.y);
        
        console.log(`Fishing: Clicked on ${objectType} at (${fishingSpotX}, ${fishingSpotY})`);
        handleFishingSpotClick(objectType, fishingSpotX, fishingSpotY, element);
      });
    }
  });
}

// Handle clicking on a fishing spot object
function handleFishingSpotClick(fishingSpotType, x, y, fishingSpotElement) {
  console.log(`Fishing: Clicked ${fishingSpotType} at (${x}, ${y})`);
  
  const playerId = 'player'; // Could be dynamic for multiplayer
  
  // Check for click cooldown
  const fishingSpotKey = `${x},${y}`;
  const now = Date.now();
  const lastClickTime = lastClickTimes.get(fishingSpotKey) || 0;
  
  if (now - lastClickTime < CLICK_COOLDOWN) {
    console.log(`Fishing: Click cooldown active for fishing spot at (${x}, ${y})`);
    return;
  }
  
  // Update last click time
  lastClickTimes.set(fishingSpotKey, now);
  
  // Note: Fishing spots no longer deplete
  
  // Check for resource cooldown (prevent spam fishing same spot)
  const resourceCooldownTime = resourceCooldowns.get(fishingSpotKey) || 0;
  if (now < resourceCooldownTime) {
    const remainingTime = Math.ceil((resourceCooldownTime - now) / 1000);
    showFishingMessage(`You need to wait ${remainingTime} more second(s) before fishing this spot again.`, 'warning');
    return;
  }
  
  // Check if already fishing this spot (prevent multiple sessions on same spot)
  const existingSession = getActiveFishingSession(playerId);
  if (existingSession && existingSession.x === x && existingSession.y === y) {
    console.log(`Fishing: Already fishing this spot at (${x}, ${y})`);
    return;
  }
  
  // Cancel any existing fishing session at a different spot
  if (existingSession) {
    console.log(`Fishing: Cancelling existing fishing session to start new one`);
    cancelFishing(playerId);
  }
  
  // Get player position and check distance
  const playerPos = window.worldModule?.getPlayerPosition();
  if (!playerPos) {
    console.error('Fishing: Could not get player position');
    return;
  }
  
  const playerX = Math.floor(playerPos.x);
  const playerY = Math.floor(playerPos.y);
  
  // Use Chebyshev distance (OSRS-style) - allows diagonal interactions
  const dx = Math.abs(playerX - x);
  const dy = Math.abs(playerY - y);
  const distance = Math.max(dx, dy);
  console.log(`Fishing: Distance to fishing spot (Chebyshev): ${distance}`);
  
  if (distance > 1) {
    // Too far - use enhanced pathfinding that stops at adjacent tiles
    console.log('Fishing: Too far from fishing spot, using enhanced pathfinding');
    
    // Set both targets for compatibility with world module's movement completion
    window.fishingTarget = {
      fishingSpotType: fishingSpotType,
      x: x,
      y: y,
      element: fishingSpotElement
    };
    
    window.interactionTarget = {
      type: 'fishing',
      fishingSpotType: fishingSpotType,
      x: x,
      y: y,
      element: fishingSpotElement
    };
    
    // Use the interactive pathfinding that stops at adjacent tiles
    window.worldModule?.movePlayerToInteractiveTarget(x, y);
    return;
  }
  
  // Close enough - attempt to fish
  startFishing(fishingSpotType, x, y, fishingSpotElement);
}

// Start fishing process
function startFishing(fishingSpotType, x, y, fishingSpotElement) {
  const playerId = 'player';
  const profile = window.userModule?.getProfile();
  
  if (!profile) {
    console.error('Fishing: No player profile available');
    return;
  }
  
  const fishingSpotDef = FISHING_SPOT_DEFINITIONS[fishingSpotType];
  if (!fishingSpotDef) {
    console.error(`Fishing: Unknown fishing spot type: ${fishingSpotType}`);
    return;
  }
  
  // Check fishing level requirement
  const playerFishingLevel = profile.skills.fishing || 1;
  if (playerFishingLevel < fishingSpotDef.level) {
    showFishingMessage(`You need level ${fishingSpotDef.level} Fishing to fish here.`, 'error');
    return;
  }
  
  // Check for required fishing tool
  const requiredTool = fishingSpotDef.toolRequired;
  const toolDef = FISHING_TOOL_DEFINITIONS[requiredTool];
  
  if (!toolDef) {
    console.error(`Fishing: Unknown tool definition: ${requiredTool}`);
    return;
  }
  
  // Check if player has required tool level
  if (playerFishingLevel < toolDef.level) {
    showFishingMessage(`You need level ${toolDef.level} Fishing to use a ${toolDef.name}.`, 'error');
    return;
  }
  
  // Find best fishing tool in inventory
  const bestTool = findBestFishingTool(profile, fishingSpotDef);
  if (!bestTool) {
    showFishingMessage(`You need a ${fishingSpotDef.toolName} to fish here.`, 'error');
    return;
  }
  
  // Note: Inventory space will be checked when actually adding the fish
  
  // If multiplayer, request permission from server
  if (window.multiplayer && window.multiplayer.isOnline()) {
    // Server will validate and respond
    window.multiplayer.sendMessage('fishing_request', {
      fishingSpotType: fishingSpotType,
      x: x,
      y: y,
      playerId: playerId
    });
    return;
  }
  
  // Proceed with fishing in single player
  proceedWithFishing(fishingSpotType, x, y, fishingSpotElement);
}

// Start fishing approved by server
function startFishingApproved(fishingSpotType, x, y) {
  console.log(`Fishing: Server approved fishing ${fishingSpotType} at (${x}, ${y})`);
  
  const fishingSpotElement = document.querySelector(`.world-object[data-type="${fishingSpotType}"][data-x="${x}"][data-y="${y}"]`);
  if (!fishingSpotElement) {
    console.error(`Fishing: Could not find fishing spot element for ${fishingSpotType} at (${x}, ${y})`);
    return;
  }
  
  proceedWithFishing(fishingSpotType, x, y, fishingSpotElement);
}

// Start fishing denied by server
function startFishingDenied(fishingSpotType, x, y, reason, depletedBy) {
  console.log(`Fishing: Server denied fishing ${fishingSpotType} at (${x}, ${y}) - Reason: ${reason}`);
  
  // Note: Depletion logic removed - spots no longer deplete
  showFishingMessage(reason || 'Cannot fish here right now.', 'error');
}

// Proceed with actual fishing mechanics
function proceedWithFishing(fishingSpotType, x, y, fishingSpotElement) {
  const playerId = 'player';
  const profile = window.userModule?.getProfile();
  const fishingSpotDef = FISHING_SPOT_DEFINITIONS[fishingSpotType];
  
  // Get player position and face towards fishing spot
  facePlayerTowardsFishingSpot(x, y);
  
  // Cancel any existing fishing session
  cancelFishing(playerId);
  
  // Find best fishing tool
  const bestTool = findBestFishingTool(profile, fishingSpotDef);
  
  // Calculate fishing time based on tool bonus
  const baseFishingTime = FISHING_CONSTANTS.BASE_FISHING_TIME;
  const toolBonus = bestTool ? (FISHING_TOOL_DEFINITIONS[bestTool.id]?.fishingBonus || 0) : 0;
  const fishingTime = Math.max(1000, baseFishingTime * (1 - toolBonus));
  
  console.log(`Fishing: Starting to fish ${fishingSpotType} with ${bestTool?.name || 'no tool'} (${toolBonus * 100}% bonus) - Time: ${fishingTime}ms`);
  
  // Create fishing session
  const fishingSession = {
    playerId: playerId,
    fishingSpotType: fishingSpotType,
    x: x,
    y: y,
    element: fishingSpotElement,
    tool: bestTool,
    fishingTime: fishingTime,
    experience: fishingSpotDef.experience,
    startTime: Date.now(),
    timer: null
  };
  
  // Store active fishing session
  activeFishing.set(playerId, fishingSession);
  
  // Show fishing message
  showFishingMessage(`You begin fishing for ${fishingSpotDef.name.replace(' Fishing Spot', '')}...`, 'info');
  
  // Start fishing animation
  startFishingAnimation();
  
  // Show skill bubble
  showSkillBubble('fishing');
  
  // Set timer for fishing completion
  fishingSession.timer = setTimeout(() => {
    completeFishing(playerId);
  }, fishingTime);
  
  console.log(`Fishing: Started fishing session for ${playerId} at (${x}, ${y})`);
}

// Face player towards fishing spot
function facePlayerTowardsFishingSpot(fishingSpotX, fishingSpotY) {
  const playerPos = window.worldModule?.getPlayerPosition();
  if (!playerPos) {
    console.error('Fishing: Could not get player position for facing');
    return;
  }
  
  const playerX = Math.floor(playerPos.x);
  const playerY = Math.floor(playerPos.y);
  
  // Calculate direction from player to fishing spot
  const dx = fishingSpotX - playerX;
  const dy = fishingSpotY - playerY;
  
  console.log(`Fishing: Facing player towards fishing spot at (${fishingSpotX}, ${fishingSpotY}) from (${playerX}, ${playerY}), dx=${dx}, dy=${dy}`);
  
  // Update player direction and appearance
  const playerElement = document.getElementById('player-character');
  if (playerElement && window.worldModule?.updatePlayerDirection && window.worldModule?.updatePlayerAppearance) {
    // First update the direction (this sets the global playerDirection variable)
    window.worldModule.updatePlayerDirection(dx, dy);
    
    // Then get the current direction and update appearance
    // Calculate the direction string based on dx, dy (matching world module logic)
    let direction = 'south'; // Default direction
    if (dx > 0 && dy < 0) {
      direction = 'northeast';
    } else if (dx > 0 && dy > 0) {
      direction = 'southeast';
    } else if (dx < 0 && dy > 0) {
      direction = 'southwest';
    } else if (dx < 0 && dy < 0) {
      direction = 'northwest';
    } else if (dx > 0) {
      direction = 'east';
    } else if (dx < 0) {
      direction = 'west';
    } else if (dy > 0) {
      direction = 'south';
    } else if (dy < 0) {
      direction = 'north';
    }
    
    // Update the visual appearance
    window.worldModule.updatePlayerAppearance(playerElement, direction);
    
    console.log(`Fishing: Player direction updated to ${direction}`);
  } else {
    console.warn('Fishing: Could not update player direction - missing functions or element');
  }
}

// Find best fishing tool in player's inventory
function findBestFishingTool(profile, fishingSpotDef) {
  // Get the actual player inventory from the inventory module
  const inventory = window.inventoryModule?.getPlayerInventory() || [];
  const playerFishingLevel = profile.skills.fishing || 1;
  const requiredTool = fishingSpotDef.toolRequired;
  
  console.log('Fishing: Searching for fishing tool in inventory:', inventory);
  console.log('Fishing: Required tool:', requiredTool);
  console.log('Fishing: Player fishing level:', playerFishingLevel);
  
  // Look for the specific required tool
  for (let i = 0; i < inventory.length; i++) {
    const item = inventory[i];
    if (item && item.id === requiredTool) {
      console.log('Fishing: Found required tool:', item.id);
      
      // Check if the tool is noted - noted tools cannot be used
      const isNoted = window.inventoryModule && window.inventoryModule.isItemNoted 
        ? window.inventoryModule.isItemNoted(item) 
        : item.noted === true;
      
      if (isNoted) {
        console.log('Fishing: Tool is noted, skipping:', item.id);
        continue; // Skip noted tools
      }
      
      const toolDef = FISHING_TOOL_DEFINITIONS[requiredTool];
      console.log('Fishing: Tool definition:', toolDef);
      
      if (toolDef && playerFishingLevel >= toolDef.level) {
        console.log('Fishing: Tool level requirement met, using:', item.id);
        return {
          id: item.id,
          name: toolDef.name,
          bonus: toolDef.fishingBonus
        };
      } else {
        console.log('Fishing: Tool level requirement not met. Required:', toolDef?.level, 'Player level:', playerFishingLevel);
      }
    }
  }
  
  console.log('Fishing: No suitable fishing tool found');
  return null;
}

// Start fishing animation
function startFishingAnimation() {
  const playerElement = document.querySelector('.player');
  if (playerElement) {
    playerElement.classList.add('fishing');
  }
}

// Stop fishing animation
function stopFishingAnimation() {
  const playerElement = document.querySelector('.player');
  if (playerElement) {
    playerElement.classList.remove('fishing');
  }
}

// Complete fishing and get the fish
function completeFishing(playerId) {
  const fishingSession = activeFishing.get(playerId);
  if (!fishingSession) {
    console.log(`Fishing: No active fishing session for ${playerId}`);
    return;
  }
  
  const { fishingSpotType, x, y, element, experience } = fishingSession;
  const fishingSpotDef = FISHING_SPOT_DEFINITIONS[fishingSpotType];
  
  if (!fishingSpotDef) {
    console.error(`Fishing: Unknown fishing spot type: ${fishingSpotType}`);
    cancelFishing(playerId);
    return;
  }
  
  console.log(`Fishing: Completing fishing for ${playerId} at (${x}, ${y})`);
  
  // Clear the timer ID since the session is completing
  if (fishingSession.timer) {
    fishingSession.timer = null;
  }
  
  // Stop fishing animation
  stopFishingAnimation();
  
  // Hide skill bubble
  hideSkillBubble();
  
  // Add fish to inventory
  const fishItemId = fishingSpotDef.dropItem;
  const fishAdded = addFishToInventory(fishItemId);
  
  if (!fishAdded) {
    // Inventory module already shows the "inventory is full" message
    // Clean up fishing session when inventory is full
    activeFishing.delete(playerId);
    return;
  }
  
  // Add experience
  const profile = window.userModule?.getProfile();
  if (profile) {
    console.log(`🎣 Fishing: Adding ${experience} XP to fishing skill`);
    console.log(`🎣 Fishing: Before - Level: ${profile.skills.fishing}, XP: ${profile.skillsExp.fishing || 0}`);
    
    const leveledUp = addExperience('fishing', experience, profile.skills, profile.skillsExp);
    
    console.log(`🎣 Fishing: After - Level: ${profile.skills.fishing}, XP: ${profile.skillsExp.fishing || 0}, Leveled up: ${leveledUp}`);
    
    // Update UI
    if (window.uiModule && window.uiModule.updateSkillDisplay) {
      console.log(`🎣 Fishing: Calling updateSkillDisplay for fishing`);
      window.uiModule.updateSkillDisplay('fishing', profile.skills.fishing, leveledUp);
      if (leveledUp) {
        window.uiModule.updateTotalLevel(profile.skills);
      }
    }
    
    // Update experience bar with visual feedback
    if (window.uiModule && window.uiModule.updateSkillExperienceBar) {
      console.log(`🎣 Fishing: Calling updateSkillExperienceBar for fishing`);
      window.uiModule.updateSkillExperienceBar('fishing');
      
      // Add visual feedback for experience gain
      const skillElement = document.querySelector(`[data-skill="fishing"]`);
      if (skillElement) {
        const expFill = skillElement.querySelector('.skill-exp-fill');
        if (expFill) {
          console.log(`🎣 Fishing: Adding visual feedback animation`);
          expFill.classList.add('exp-gain');
          setTimeout(() => {
            expFill.classList.remove('exp-gain');
          }, 600);
        } else {
          console.warn(`🎣 Fishing: No exp-fill element found for visual feedback`);
        }
      } else {
        console.warn(`🎣 Fishing: No skill element found for fishing`);
      }
    } else {
      console.warn(`🎣 Fishing: updateSkillExperienceBar function not available`);
    }
    
    // Save profile
    if (window.userModule?.saveProfile) {
      window.userModule.saveProfile();
    }
    
    // Sync skills with server if online
    if (window.syncSkillsWithServer && window.isUserOnline && window.isUserOnline()) {
      const totalLevel = window.calculateTotalLevel ? window.calculateTotalLevel(profile.skills) : 0;
      const combatLevel = window.calculateCombatLevel ? window.calculateCombatLevel(profile.skills) : 0;
      window.syncSkillsWithServer(profile.skills, totalLevel, combatLevel, profile.skillsExp);
    }
    
    if (leveledUp) {
      showFishingMessage(`Level up! Your Fishing level is now ${profile.skills.fishing}!`, 'success');
    }
  }
  
  // Show success message
  const fishItem = window.itemDefinitions?.[fishItemId];
  const fishName = fishItem ? fishItem.name : fishItemId.replace('_', ' ');
  showFishingMessage(`You catch a ${fishName}!`, 'success');
  
  // Set resource cooldown
  const fishingSpotKey = `${x},${y}`;
  resourceCooldowns.set(fishingSpotKey, Date.now() + RESOURCE_COOLDOWN);
  
  // Note: Fishing spots no longer deplete, removed depletion logic
  
  console.log(`Fishing: Successfully caught ${fishName} from ${fishingSpotType} at (${x}, ${y})`);
  
  // Always continue fishing automatically since spots no longer deplete
  console.log('Fishing: Continuing to fish automatically');
  
  // Calculate fishing time for next catch (reuse session data)
  const currentProfile = window.userModule?.getProfile();
  const toolDef = FISHING_TOOL_DEFINITIONS[fishingSession.tool.id];
  const playerFishingLevel = currentProfile?.skills?.fishing || 1;
  const levelBonus = Math.floor(playerFishingLevel / 10) * 0.05;
  const totalBonus = toolDef.fishingBonus + levelBonus;
  const fishingTime = Math.max(1000, FISHING_CONSTANTS.BASE_FISHING_TIME * (1 - totalBonus));
  
  // Update session for next catch
  fishingSession.startTime = Date.now();
  fishingSession.duration = fishingTime;
  
  // Keep the session active (don't delete it)
  // Start animation again
  startFishingAnimation();
  
  // Show skill bubble again
  showSkillBubble('fishing');
  
  // Set timer for next completion
  fishingSession.timer = setTimeout(() => {
    completeFishing(playerId);
  }, fishingTime);
  
  console.log(`Fishing: Continuing to fish, next completion in ${fishingTime}ms`);
}

// Add fish to inventory
function addFishToInventory(fishItemId) {
  if (!window.inventoryModule || !window.inventoryModule.addItemToInventory) {
    console.error('Fishing: Inventory module or addItemToInventory not available');
    return false;
  }
  
  return window.inventoryModule.addItemToInventory(fishItemId, 1);
}

// Request fishing spot depletion (DISABLED - fishing spots no longer deplete)
function requestFishingSpotDepletion(fishingSpotType, x, y, fishingSpotElement) {
  // Fishing spots no longer deplete - function kept for compatibility
  console.log(`Fishing: Depletion disabled for ${fishingSpotType} at (${x}, ${y})`);
}

// Handle fishing spot depletion confirmed by server (DISABLED)
function depleteFishingSpotConfirmed(fishingSpotType, x, y, fishingSpotElement) {
  // Fishing spots no longer deplete - function kept for server compatibility
  console.log(`Fishing: Depletion ignored for ${fishingSpotType} at (${x}, ${y}) - spots no longer deplete`);
}

// Handle fishing spot depletion denied by server (DISABLED)
function depleteFishingSpotDenied(fishingSpotType, x, y, reason, depletedBy) {
  // Fishing spots no longer deplete - function kept for server compatibility
  console.log(`Fishing: Depletion system disabled for ${fishingSpotType} at (${x}, ${y})`);
}

// Handle fishing spot respawn from server
function respawnFishingSpotFromServer(fishingSpotType, x, y) {
  const fishingSpotKey = `${x},${y}`;
  
  console.log(`Fishing: Respawning fishing spot ${fishingSpotType} at (${x}, ${y})`);
  
  // Clear depleted state
  depletedFishingSpotStates.delete(fishingSpotKey);
  
  // Clear respawn timer
  const timer = fishingSpotRespawnTimers.get(fishingSpotKey);
  if (timer) {
    clearTimeout(timer);
    fishingSpotRespawnTimers.delete(fishingSpotKey);
  }
  
  // Restore fishing spot visually
  const fishingSpotElement = document.querySelector(`.world-object[data-type="${fishingSpotType}"][data-x="${x}"][data-y="${y}"]`);
  if (fishingSpotElement) {
    fishingSpotElement.style.filter = 'none';
    // Remove any inline opacity style so CSS can take over
    fishingSpotElement.style.opacity = '';
    // Make sure the swirl animation is reapplied
    if (!fishingSpotElement.classList.contains('fishing-spot-swirl')) {
      addFishingSpotAnimation(fishingSpotElement);
    }
  }
  
  console.log(`Fishing: Fishing spot ${fishingSpotType} respawned at (${x}, ${y})`);
}

// Cancel fishing (when player moves away)
function cancelFishing(playerId = 'player') {
  const fishingSession = activeFishing.get(playerId);
  if (fishingSession) {
    console.log('Fishing: Cancelling fishing session');
    
    // Clear the completion timer to prevent it from firing
    if (fishingSession.timer) {
      clearTimeout(fishingSession.timer);
      console.log('Fishing: Cleared completion timer');
    }
    
    stopFishingAnimation();
    hideSkillBubble(); // Hide skill bubble when cancelling
    activeFishing.delete(playerId);
    showFishingMessage('Fishing interrupted.', 'info');
  }
}

// Check if player is fishing
function isFishing(playerId = 'player') {
  return activeFishing.has(playerId);
}

// Show fishing message
function showFishingMessage(message, type = 'info') {
  if (window.showNotification) {
    window.showNotification(message, type);
  } else {
    console.log(`Fishing: ${message}`);
  }
}

// Handle movement completion (used by world module)
function handleMovementComplete() {
  // Check for direct fishing target first
  if (window.fishingTarget) {
    console.log('Fishing: Movement complete, starting fishing (direct target)');
    const target = window.fishingTarget;
    startFishing(target.fishingSpotType, target.x, target.y, target.element);
    window.fishingTarget = null; // Clear the target
    return;
  }
  
  // Check for world module interaction target
  if (window.interactionTarget && window.interactionTarget.type === 'fishing') {
    console.log('Fishing: Movement complete, starting fishing (interaction target)');
    const target = window.interactionTarget;
    startFishing(target.fishingSpotType, target.x, target.y, target.element);
    // Note: interactionTarget will be cleared by world.js movement handler
    return;
  }
}

// Get active fishing session
function getActiveFishingSession(playerId = 'player') {
  return activeFishing.get(playerId);
}

// Initialize fishing spot animations
function initializeFishingSpotAnimations() {
  console.log('Initializing fishing spot animations...');
  
  // Add swirl animations to existing fishing spots
  document.querySelectorAll('.world-object').forEach(element => {
    const objectType = element.dataset.type;
    if (objectType && objectType.startsWith('fishing_spot_')) {
      addFishingSpotAnimation(element);
    }
  });
  
  console.log('Fishing spot animations initialized');
}

// Add swirl animation to a fishing spot
function addFishingSpotAnimation(element) {
  if (!element) return;
  
  // Add swirl animation class (CSS handles the opacity)
  element.classList.add('fishing-spot-swirl');
  
  console.log('Fishing: Added swirl animation to fishing spot');
}

// Expose fishing state globally for other modules
window.activeFishing = activeFishing;
window.isFishing = isFishing;
window.cancelFishing = cancelFishing;

// Expose fishing module functions globally
window.fishingModule = {
  addFishingSpotAnimation,
  handleMovementComplete,
  getActiveFishingSession,
  FISHING_SPOT_DEFINITIONS,
  FISHING_TOOL_DEFINITIONS
};

// Export functions for global access
export {
  initializeFishing,
  handleFishingSpotClick,
  startFishing,
  startFishingApproved,
  startFishingDenied,
  depleteFishingSpotConfirmed,
  depleteFishingSpotDenied,
  respawnFishingSpotFromServer,
  cancelFishing,
  isFishing,
  handleMovementComplete,
  getActiveFishingSession,
  addFishingSpotAnimation,
  FISHING_SPOT_DEFINITIONS,
  FISHING_TOOL_DEFINITIONS
};

// Initialize fishing system when module loads
initializeFishing();