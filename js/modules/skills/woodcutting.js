/**
 * Woodcutting module for WebscapeRPG
 * Handles woodcutting mechanics, tree objects, axe requirements, and experience
 */

import { addExperience } from '../skills.js';
import { showSkillBubble, hideSkillBubble } from '../skillBubbles.js';

// Woodcutting constants
const WOODCUTTING_CONSTANTS = {
  BASE_CHOPPING_TIME: 4000, // Base time in milliseconds
  ANIMATION_DURATION: 1000, // Time between axe swings
  RESPAWN_TIME: 30000, // 30 seconds for tree respawn
  EXPERIENCE_PER_LOG: {
    'tree_regular': 25,
    'tree_oak': 37.5,
    'tree_pine': 50,
    'tree_palm': 68.5
  }
};

// Tree definitions with woodcutting requirements
const TREE_DEFINITIONS = {
  'tree_regular': {
    name: 'Tree',
    icon: null, // Using custom image instead
    level: 1,
    experience: 25,
    dropItem: 'wooden_log',
    respawnTime: 5000,
    minimumLogsUntilDepletion: 1, // Can deplete immediately
    depletionChance: 0.2 // 20% chance per log after minimum
  },
  'tree_oak': {
    name: 'Oak Tree',
    icon: '🌳',
    level: 15,
    experience: 37.5,
    dropItem: 'oak_log',
    respawnTime: 8000,
    minimumLogsUntilDepletion: 3, // Must chop 3 logs before depletion can occur
    depletionChance: 0.2 // 20% chance per log after minimum
  },
  'tree_pine': {
    name: 'Pine Tree',
    icon: '🌲',
    level: 30,
    experience: 50,
    dropItem: 'pine_log',
    respawnTime: 10000,
    minimumLogsUntilDepletion: 2, // Must chop 2 logs before depletion can occur
    depletionChance: 0.25 // 25% chance per log after minimum
  },
  'tree_palm': {
    name: 'Palm Tree',
    icon: '🌴',
    level: 45,
    experience: 68.5,
    dropItem: 'palm_log',
    respawnTime: 12000,
    minimumLogsUntilDepletion: 2, // Must chop 2 logs before depletion can occur
    depletionChance: 0.3 // 30% chance per log after minimum
  },
  'tree_bamboo': {
    name: 'Bamboo',
    icon: '🎋',
    level: 25,
    experience: 42,
    dropItem: 'bamboo_log',
    respawnTime: 6000,
    minimumLogsUntilDepletion: 3, // Must chop 3 logs before depletion can occur
    depletionChance: 0.15 // 15% chance per log after minimum
  },
  'tree_magic': {
    name: 'Magic Tree',
    icon: '🎄',
    level: 75,
    experience: 125,
    dropItem: 'magic_log',
    respawnTime: 20000,
    minimumLogsUntilDepletion: 1, // Can deplete immediately
    depletionChance: 0.4 // 40% chance per log after minimum
  }
};

// Axe definitions with woodcutting requirements
const AXE_DEFINITIONS = {
  'bronze_axe': {
    name: 'Bronze Axe',
    level: 1,
    choppingBonus: 0, // No bonus
    icon: '🪓'
  },
  'iron_axe': {
    name: 'Iron Axe',
    level: 5,
    choppingBonus: 0.1, // 10% faster chopping
    icon: '🪓'
  },
  'steel_axe': {
    name: 'Steel Axe',
    level: 10,
    choppingBonus: 0.2,
    icon: '🪓'
  },
  'mithril_axe': {
    name: 'Mithril Axe',
    level: 20,
    choppingBonus: 0.3,
    icon: '🪓'
  },
  'adamantite_axe': {
    name: 'Adamantite Axe',
    level: 30,
    choppingBonus: 0.4,
    icon: '🪓'
  }
};

// Global state tracking
const activeWoodcutting = new Map();
const depletedTreeStates = new Map(); // Track depleted tree states globally
const treeRespawnTimers = new Map(); // Track tree respawn timers
const treeLogCounts = new Map(); // Track logs chopped per tree instance

// Click cooldown tracking
const lastClickTimes = new Map(); // Track last click time per tree location
const resourceCooldowns = new Map(); // Track cooldown per resource regardless of player
const CLICK_COOLDOWN = 500; // 0.5 seconds in milliseconds (increased from 100ms)
const RESOURCE_COOLDOWN = 1000; // 1 second cooldown per resource after woodcutting completion

// Expose depleted tree states globally for world module access
window.depletedTreeStates = depletedTreeStates;

// Initialize woodcutting system
function initializeWoodcutting() {
  console.log('Initializing woodcutting system...');
  
  // Add tree interaction handlers to existing world objects
  addTreeInteractionHandlers();
  
  console.log('Woodcutting system initialized');
}

// Add interaction handlers to tree objects in the world
function addTreeInteractionHandlers() {
  // Find all tree objects in the world and add click handlers
  document.querySelectorAll('.world-object').forEach(element => {
    const objectType = element.dataset.type;
    if (objectType && objectType.startsWith('tree_')) {
      element.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const treeX = parseInt(element.dataset.x);
        const treeY = parseInt(element.dataset.y);
        
        console.log(`Woodcutting: Clicked on ${objectType} at (${treeX}, ${treeY})`);
        handleTreeClick(objectType, treeX, treeY, element);
      });
    }
  });
}

// Handle clicking on a tree object
function handleTreeClick(treeType, x, y, treeElement) {
  console.log(`Woodcutting: Clicked ${treeType} at (${x}, ${y})`);
  
  const playerId = 'player'; // Could be dynamic for multiplayer
  
  // Check for click cooldown
  const treeKey = `${x},${y}`;
  const now = Date.now();
  const lastClickTime = lastClickTimes.get(treeKey) || 0;
  
  if (now - lastClickTime < CLICK_COOLDOWN) {
    console.log(`Woodcutting: Click cooldown active for tree at (${x}, ${y})`);
    return;
  }
  
  // Update last click time
  lastClickTimes.set(treeKey, now);
  
  // Check if tree is depleted
  if (depletedTreeStates.has(treeKey)) {
    showWoodcuttingMessage('This tree is cut down and regrowing...', 'warning');
    return;
  }
  
  // Check for resource cooldown (prevent spam chopping same tree)
  const resourceCooldownTime = resourceCooldowns.get(treeKey) || 0;
  if (now < resourceCooldownTime) {
    const remainingTime = Math.ceil((resourceCooldownTime - now) / 1000);
    showWoodcuttingMessage(`You need to wait ${remainingTime} more second(s) before chopping this tree again.`, 'warning');
    return;
  }
  
  // Check if already woodcutting this tree (prevent multiple sessions on same tree)
  const existingSession = getActiveWoodcuttingSession(playerId);
  if (existingSession && existingSession.x === x && existingSession.y === y) {
    console.log(`Woodcutting: Already cutting this tree at (${x}, ${y})`);
    return;
  }
  
  // Check if woodcutting something else (cancel previous session)
  if (existingSession) {
    console.log(`Woodcutting: Canceling previous woodcutting session at (${existingSession.x}, ${existingSession.y})`);
    cancelWoodcutting(playerId);
  }
  
  // Get player position and check distance
  const playerPos = window.worldModule?.getPlayerPosition();
  if (!playerPos) {
    console.error('Woodcutting: Could not get player position');
    return;
  }
  
  const playerX = Math.floor(playerPos.x);
  const playerY = Math.floor(playerPos.y);
  
  // Use Chebyshev distance (OSRS-style) - allows diagonal interactions
  const dx = Math.abs(playerX - x);
  const dy = Math.abs(playerY - y);
  const distance = Math.max(dx, dy);
  console.log(`Woodcutting: Distance to tree (Chebyshev): ${distance}`);
  
  if (distance > 1) {
    // Too far - use the new enhanced pathfinding that stops at adjacent tiles
    console.log('Woodcutting: Too far from tree, using enhanced pathfinding');
    
    // Set both targets for compatibility with world module's movement completion
    window.woodcuttingTarget = {
      treeType: treeType,
      x: x,
      y: y,
      element: treeElement
    };
    
    window.interactionTarget = {
      type: 'woodcutting',
      treeType: treeType,
      x: x,
      y: y,
      element: treeElement
    };
    
    // Use the new interactive pathfinding that stops at adjacent tiles
    window.worldModule?.movePlayerToInteractiveTarget(x, y);
    return;
  }
  
  // Close enough - attempt to chop
  startWoodcutting(treeType, x, y, treeElement);
}

// Start woodcutting a tree
function startWoodcutting(treeType, x, y, treeElement) {
  console.log(`Woodcutting: Starting to chop ${treeType}`);
  
  // Double-check that the tree is not depleted locally
  if (treeElement.style.display === 'none' || 
      treeElement.dataset.depleted === 'true' || 
      treeElement.textContent === '🌱') {
    showWoodcuttingMessage('This tree is cut down. Wait for it to regrow.', 'info');
    return;
  }
  
  // Store woodcutting target temporarily while waiting for server approval
  // Server will handle cancelling any existing actions automatically
  window.pendingWoodcuttingAction = {
    treeType: treeType,
    x: x,
    y: y,
    treeElement: treeElement
  };
  
  // Request server approval first if online
  if (window.isUserOnline && window.isUserOnline() && window.multiplayerModule) {
    console.log(`Woodcutting: Requesting server approval to chop ${treeType} at (${x}, ${y})`);
    if (window.multiplayerModule.sendResourceActionRequest) {
      window.multiplayerModule.sendResourceActionRequest(treeType, x, y, 'woodcutting');
      return; // Wait for server response
    }
  }
  
  // If offline, still cancel existing actions locally
  if (activeWoodcutting.has('player')) {
    console.log('Woodcutting: Player already woodcutting, cancelling current session to start new one');
    cancelWoodcutting('player');
  }
  
  // Also cancel any mining session when offline
  if (window.miningModule && window.miningModule.isMining && window.miningModule.isMining('player')) {
    console.log('Woodcutting: Player is mining, cancelling to start woodcutting');
    window.miningModule.cancelMining('player');
  }
  
  // If offline, proceed directly
  startWoodcuttingApproved(treeType, x, y);
}

// Handle server approval for woodcutting
function startWoodcuttingApproved(treeType, x, y) {
  console.log(`Woodcutting: Server approved chopping ${treeType} at (${x}, ${y})`);
  
  // Get the pending action
  const pendingAction = window.pendingWoodcuttingAction;
  if (!pendingAction || pendingAction.treeType !== treeType || pendingAction.x !== x || pendingAction.y !== y) {
    console.warn('Woodcutting: No matching pending action found');
    return;
  }
  
  const treeElement = pendingAction.treeElement;
  
  // Clear pending action
  window.pendingWoodcuttingAction = null;
  
  // Now proceed with the actual woodcutting logic
  proceedWithWoodcutting(treeType, x, y, treeElement);
}

// Handle server denial for woodcutting
function startWoodcuttingDenied(treeType, x, y, reason, depletedBy) {
  console.log(`Woodcutting: Server denied chopping ${treeType} at (${x}, ${y}): ${reason}`);
  
  // Clear pending action
  window.pendingWoodcuttingAction = null;
  
  // Message is already shown by multiplayer module
}

// Proceed with actual woodcutting (moved from original startWoodcutting function)
function proceedWithWoodcutting(treeType, x, y, treeElement) {
  console.log(`Woodcutting: Proceeding with chopping ${treeType} at (${x}, ${y})`);
  
  // Get tree definition
  const treeDef = TREE_DEFINITIONS[treeType];
  if (!treeDef) {
    console.error(`Woodcutting: Unknown tree type: ${treeType}`);
    return;
  }
  
  // Get player profile (assuming it's available globally)
  const profile = window.userModule?.getProfile();
  if (!profile) {
    console.error('Woodcutting: Could not get player profile');
    return;
  }
  
  // Check woodcutting level requirement
  const playerWoodcuttingLevel = profile.skills.woodcutting || 1;
  if (playerWoodcuttingLevel < treeDef.level) {
    showWoodcuttingMessage(`You need level ${treeDef.level} Woodcutting to chop ${treeDef.name}.`, 'error');
    return;
  }
  
  // Check for axe in inventory
  const axe = findBestAxe(profile);
  if (!axe) {
    showWoodcuttingMessage('You need an axe to chop trees!', 'error');
    return;
  }
  
  // Check axe level requirement
  const axeDef = AXE_DEFINITIONS[axe.id];
  if (playerWoodcuttingLevel < axeDef.level) {
    showWoodcuttingMessage(`You need level ${axeDef.level} Woodcutting to use a ${axeDef.name}.`, 'error');
    return;
  }

  // Cancel any existing woodcutting session to prevent multiple timers
  const existingSession = activeWoodcutting.get('player');
  if (existingSession) {
    console.log('Woodcutting: Cancelling existing session to prevent multiple timers');
    cancelWoodcutting('player');
  }
  
  // Face player towards the tree
  facePlayerTowardsTree(x, y);
  
  // Calculate chopping time (base time reduced by axe bonus and level)
  const levelBonus = Math.floor(playerWoodcuttingLevel / 10) * 0.05; // 5% reduction per 10 levels
  const totalBonus = axeDef.choppingBonus + levelBonus;
  const choppingTime = Math.max(1000, WOODCUTTING_CONSTANTS.BASE_CHOPPING_TIME * (1 - totalBonus));
  
  console.log(`Woodcutting: Starting woodcutting session - Time: ${choppingTime}ms, Axe: ${axe.id}`);
  
  // Set timer to complete woodcutting and store the timer ID
  const timerId = setTimeout(() => {
    completeWoodcutting('player');
  }, choppingTime);
  
  // Start woodcutting session with timer ID
  const woodcuttingSession = {
    treeType: treeType,
    x: x,
    y: y,
    element: treeElement,
    startTime: Date.now(),
    duration: choppingTime,
    axe: axe,
    treeDef: treeDef,
    timerId: timerId  // Store timer ID for proper cleanup
  };
  
  activeWoodcutting.set('player', woodcuttingSession);
  
  // Show woodcutting animation
  startWoodcuttingAnimation();
  
  showWoodcuttingMessage(`You begin chopping the ${treeDef.name}...`, 'info');
}

// Face player towards the tree being chopped
function facePlayerTowardsTree(treeX, treeY) {
  const playerPos = window.worldModule?.getPlayerPosition();
  if (!playerPos) {
    console.error('Woodcutting: Could not get player position for facing');
    return;
  }
  
  const playerX = Math.floor(playerPos.x);
  const playerY = Math.floor(playerPos.y);
  
  // Calculate direction from player to tree
  const dx = treeX - playerX;
  const dy = treeY - playerY;
  
  console.log(`Woodcutting: Facing player towards tree at (${treeX}, ${treeY}) from (${playerX}, ${playerY}), dx=${dx}, dy=${dy}`);
  
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
    
    console.log(`Woodcutting: Player direction updated to ${direction}`);
  } else {
    console.warn('Woodcutting: Could not update player direction - missing functions or element');
  }
}

// Find the best axe the player can use
function findBestAxe(profile) {
  // Get the actual player inventory from the inventory module
  const inventory = window.inventoryModule?.getPlayerInventory() || [];
  const playerWoodcuttingLevel = profile.skills.woodcutting || 1;
  
  console.log('Woodcutting: Searching for axe in inventory:', inventory);
  console.log('Woodcutting: Player woodcutting level:', playerWoodcuttingLevel);
  
  let bestAxe = null;
  let bestLevel = -1;
  
  for (let i = 0; i < inventory.length; i++) {
    const item = inventory[i];
    if (item && item.id && item.id.endsWith('_axe')) {
      console.log('Woodcutting: Found axe:', item.id);
      
      // Check if the axe is noted - noted tools cannot be used
      const isNoted = window.inventoryModule && window.inventoryModule.isItemNoted 
        ? window.inventoryModule.isItemNoted(item) 
        : item.noted === true;
      
      if (isNoted) {
        console.log('Woodcutting: Axe is noted, skipping:', item.id);
        continue; // Skip noted axes
      }
      
      const axeDef = AXE_DEFINITIONS[item.id];
      console.log('Woodcutting: Axe definition:', axeDef);
      
      if (axeDef && playerWoodcuttingLevel >= axeDef.level && axeDef.level > bestLevel) {
        bestAxe = item;
        bestLevel = axeDef.level;
        console.log('Woodcutting: New best axe:', item.id, 'level requirement:', axeDef.level);
      }
    }
  }
  
  console.log('Woodcutting: Best axe found:', bestAxe);
  return bestAxe;
}

// Start woodcutting animation using standardized skill bubble system
function startWoodcuttingAnimation() {
  showSkillBubble('woodcutting');
}

// Stop woodcutting animation using standardized skill bubble system
function stopWoodcuttingAnimation() {
  hideSkillBubble();
}

// Complete woodcutting and give rewards
function completeWoodcutting(playerId) {
  const woodcuttingSession = activeWoodcutting.get(playerId);
  if (!woodcuttingSession) return;
  
  console.log(`Woodcutting: Completing woodcutting session for ${woodcuttingSession.treeType}`);
  
  // Define tree key for tracking
  const treeKey = `${woodcuttingSession.x},${woodcuttingSession.y}`;
  
  // Clear the timer ID since the session is completing
  if (woodcuttingSession.timerId) {
    woodcuttingSession.timerId = null;
  }
  
  // Add resource cooldown to prevent immediate re-chopping
  resourceCooldowns.set(treeKey, Date.now() + RESOURCE_COOLDOWN);
  
  // Stop animation
  stopWoodcuttingAnimation();
  
  // Give log to player
  const success = addLogToInventory(woodcuttingSession.treeDef.dropItem);
  
  if (success) {
    // Add experience
    const profile = window.userModule?.getProfile();
    if (profile) {
      console.log(`🌲 Woodcutting: Adding ${woodcuttingSession.treeDef.experience} XP to woodcutting skill`);
      console.log(`🌲 Woodcutting: Before - Level: ${profile.skills.woodcutting}, XP: ${profile.skillsExp.woodcutting || 0}`);
      
      const leveledUp = addExperience('woodcutting', woodcuttingSession.treeDef.experience, profile.skills, profile.skillsExp);
      
      console.log(`🌲 Woodcutting: After - Level: ${profile.skills.woodcutting}, XP: ${profile.skillsExp.woodcutting || 0}, Leveled up: ${leveledUp}`);
      
      // Update UI
      if (window.uiModule && window.uiModule.updateSkillDisplay) {
        console.log(`🌲 Woodcutting: Calling updateSkillDisplay for woodcutting`);
        window.uiModule.updateSkillDisplay('woodcutting', profile.skills.woodcutting, leveledUp);
        if (leveledUp) {
          window.uiModule.updateTotalLevel(profile.skills);
        }
      }
      
      // Update experience bar with visual feedback
      if (window.uiModule && window.uiModule.updateSkillExperienceBar) {
        console.log(`🌲 Woodcutting: Calling updateSkillExperienceBar for woodcutting`);
        window.uiModule.updateSkillExperienceBar('woodcutting');
        
        // Add visual feedback for experience gain
        const skillElement = document.querySelector(`[data-skill="woodcutting"]`);
        if (skillElement) {
          const expFill = skillElement.querySelector('.skill-exp-fill');
          if (expFill) {
            console.log(`🌲 Woodcutting: Adding visual feedback animation`);
            expFill.classList.add('exp-gain');
            setTimeout(() => {
              expFill.classList.remove('exp-gain');
            }, 600);
          } else {
            console.warn(`🌲 Woodcutting: No exp-fill element found for visual feedback`);
          }
        } else {
          console.warn(`🌲 Woodcutting: No skill element found for woodcutting`);
        }
      } else {
        console.warn(`🌲 Woodcutting: updateSkillExperienceBar function not available`);
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
        showWoodcuttingMessage(`Level up! Your Woodcutting level is now ${profile.skills.woodcutting}!`, 'success');
      }
    }
    
    showWoodcuttingMessage(`You cut an ${woodcuttingSession.treeDef.dropItem.replace('_', ' ')} from the ${woodcuttingSession.treeDef.name.toLowerCase()}.`, 'success');
    
    // Small chance for bird's nest drop (1% chance)
    if (Math.random() < 0.01) {
      const nestDropped = window.inventoryModule.addItemToInventory('birds_nest', 1);
      if (nestDropped) {
        console.log('Woodcutting: Lucky! Found a bird\'s nest!');
        // Show special message for nest drop
        if (window.chatModule && window.chatModule.addMessage) {
          window.chatModule.addMessage('🥚 A bird\'s nest falls from the tree! 🥚', 'system');
        }
      }
    }
    
    // Track logs chopped for this specific tree instance
    const currentLogCount = (treeLogCounts.get(treeKey) || 0) + 1;
    treeLogCounts.set(treeKey, currentLogCount);
    
    console.log(`Woodcutting: Chopped log ${currentLogCount} from ${woodcuttingSession.treeDef.name} at (${woodcuttingSession.x}, ${woodcuttingSession.y})`);
    
    // Check if minimum logs have been chopped before rolling depletion chance
    const minimumLogs = woodcuttingSession.treeDef.minimumLogsUntilDepletion || 1;
    const depletionChance = woodcuttingSession.treeDef.depletionChance || 0.2;
    
    let shouldDeplete = false;
    if (currentLogCount < minimumLogs) {
      // Haven't reached minimum logs yet, tree continues
      console.log(`Woodcutting: Only ${currentLogCount}/${minimumLogs} minimum logs chopped, tree continues`);
      shouldDeplete = false;
    } else {
      // Minimum logs reached, start rolling depletion chance
      if (Math.random() < depletionChance) {
        shouldDeplete = true;
        console.log(`Woodcutting: Depletion roll succeeded after ${currentLogCount} logs (minimum: ${minimumLogs})`);
      } else {
        console.log(`Woodcutting: Depletion roll failed, tree continues (${currentLogCount} logs chopped, minimum: ${minimumLogs})`);
      }
    }
    
    if (shouldDeplete) {
      // Tree depletes - clear the log count for this tree
      treeLogCounts.delete(treeKey);
      requestTreeDepletion(woodcuttingSession.treeType, woodcuttingSession.x, woodcuttingSession.y, woodcuttingSession.element);
      showWoodcuttingMessage('The tree has been depleted.', 'info');
      
      // Clean up woodcutting session
      activeWoodcutting.delete(playerId);
    } else {
      // Tree remains, continue chopping automatically
      console.log('Woodcutting: Tree remains alive, continuing to chop');
      
      // Calculate chopping time for next chop (reuse session data)
      const axeDef = AXE_DEFINITIONS[woodcuttingSession.axe.id];
      const playerWoodcuttingLevel = profile?.skills?.woodcutting || 1;
      const levelBonus = Math.floor(playerWoodcuttingLevel / 10) * 0.05;
      const totalBonus = axeDef.choppingBonus + levelBonus;
      const choppingTime = Math.max(1000, WOODCUTTING_CONSTANTS.BASE_CHOPPING_TIME * (1 - totalBonus));
      
      // Update session for next chop
      woodcuttingSession.startTime = Date.now();
      woodcuttingSession.duration = choppingTime;
      
      // Keep the session active (don't delete it)
      // Start animation again
      startWoodcuttingAnimation();
      
      // Set timer for next completion
      setTimeout(() => {
        completeWoodcutting(playerId);
      }, choppingTime);
      
      console.log(`Woodcutting: Continuing to chop, next completion in ${choppingTime}ms`);
    }
  } else {
    showWoodcuttingMessage('Your inventory is full!', 'error');
    // Clean up woodcutting session when inventory is full
    activeWoodcutting.delete(playerId);
  }
}

// Add log to player inventory
function addLogToInventory(logItemId) {
  if (window.inventoryModule && window.inventoryModule.addItemToInventory) {
    return window.inventoryModule.addItemToInventory(logItemId, 1);
  }
  return false;
}

// Request tree depletion from server (server-authoritative)
function requestTreeDepletion(treeType, x, y, treeElement) {
  console.log(`Woodcutting: Requesting depletion of ${treeType} at (${x}, ${y}) from server`);
  
  // Send depletion request to server if online
  if (window.isUserOnline && window.isUserOnline()) {
    const treeDef = TREE_DEFINITIONS[treeType];
    // Use new message type for depletion requests
    if (window.multiplayerModule && window.multiplayerModule.sendResourceDepletionRequest) {
      window.multiplayerModule.sendResourceDepletionRequest(treeType, x, y, treeType, treeDef.respawnTime);
    } else {
      console.warn('Woodcutting: Server-authoritative resource system not available');
    }
  } else {
    // If offline, deplete locally immediately (single-player mode)
    depleteTreeConfirmed(treeType, x, y, treeElement);
  }
}

// Handle confirmed tree depletion from server
function depleteTreeConfirmed(treeType, x, y, treeElement) {
  console.log(`Woodcutting: Server confirmed depletion of ${treeType} at (${x}, ${y})`);
  
  const treeKey = `${x},${y}`;
  
  // Clear log count for this tree (already done in requestTreeDepletion for online mode)
  treeLogCounts.delete(treeKey);
  
  // Store original tree appearance in global state
  const originalText = treeElement.textContent;
  const originalTitle = treeElement.title;
  
  // Add to global depleted state
  depletedTreeStates.set(treeKey, {
    treeType: treeType,
    originalText: originalText,
    originalTitle: originalTitle,
    depletedAt: Date.now()
  });
  
  // Update current element to show depleted appearance
  treeElement.textContent = '🌱';
  treeElement.title = 'Tree stump (regrowing...)';
  treeElement.dataset.depleted = 'true';
  
  // Force world re-render to immediately show the change
  if (window.worldModule && window.worldModule.forceWorldRerender) {
    window.worldModule.forceWorldRerender();
  }
  
  console.log(`Woodcutting: Tree ${treeType} at (${x}, ${y}) depleted locally`);
}

// Handle denied tree depletion from server
function depleteTreeDenied(treeType, x, y, reason, depletedBy) {
  console.log(`Woodcutting: Server denied depletion of ${treeType} at (${x}, ${y}): ${reason}`);
  if (depletedBy) {
    showWoodcuttingMessage(`This tree was already chopped by ${depletedBy}!`, 'error');
  } else {
    showWoodcuttingMessage(`Cannot chop this tree: ${reason}`, 'error');
  }
}

// Handle tree respawn from server (server-authoritative)
function respawnTreeFromServer(treeType, x, y) {
  console.log(`Woodcutting: Server-initiated respawn of ${treeType} at (${x}, ${y})`);
  
  const treeKey = `${x},${y}`;
  
  // Remove from global depleted state
  depletedTreeStates.delete(treeKey);
  
  // Clear log count for this tree (reset minimum logs counter)
  treeLogCounts.delete(treeKey);
  console.log(`Woodcutting: Reset log count for respawned tree at (${x}, ${y})`);
  
  // Clean up any local timer (shouldn't exist in server-authoritative mode)
  if (treeRespawnTimers.has(treeKey)) {
    clearTimeout(treeRespawnTimers.get(treeKey));
    treeRespawnTimers.delete(treeKey);
  }
  
  // Update any existing DOM element if it's currently rendered
  const existingElement = document.querySelector(`.world-object[data-type="${treeType}"][data-x="${x}"][data-y="${y}"]`);
  if (existingElement) {
    const treeDef = TREE_DEFINITIONS[treeType];
    if (treeDef.icon) {
      // For emoji trees, restore the icon
      existingElement.textContent = treeDef.icon;
    } else {
      // For regular trees with custom image, restore the background image
      existingElement.style.backgroundImage = `url('images/world/tree.png')`;
      existingElement.innerHTML = '';
      existingElement.style.fontSize = '';
      existingElement.style.display = '';
      existingElement.style.alignItems = '';
      existingElement.style.justifyContent = '';
      existingElement.style.textShadow = '';
      existingElement.style.filter = 'drop-shadow(1px 1px 1px #000000)';
    }
    existingElement.title = treeDef.name;
    existingElement.dataset.depleted = 'false';
    console.log(`Woodcutting: Updated existing DOM element for respawned tree at (${x}, ${y})`);
    
    // Force visual update by triggering a re-render
    existingElement.style.opacity = '0.99';
    setTimeout(() => {
      existingElement.style.opacity = '';
    }, 10);
    
    // Also force world re-render to ensure immediate visual update
    if (window.worldModule && window.worldModule.forceWorldRerender) {
      setTimeout(() => {
        window.worldModule.forceWorldRerender();
      }, 50);
    }
  } else {
    console.log(`Woodcutting: No DOM element found for respawned tree at (${x}, ${y}) - will be handled by next render`);
  }
}

// Cancel woodcutting (when player moves away)
function cancelWoodcutting(playerId = 'player') {
  const woodcuttingSession = activeWoodcutting.get(playerId);
  if (woodcuttingSession) {
    console.log('Woodcutting: Cancelling woodcutting session');
    
    // Clear the completion timer to prevent it from firing
    if (woodcuttingSession.timerId) {
      clearTimeout(woodcuttingSession.timerId);
      console.log('Woodcutting: Cleared completion timer');
    }
    
    stopWoodcuttingAnimation();
    activeWoodcutting.delete(playerId);
    showWoodcuttingMessage('Woodcutting interrupted.', 'info');
  }
}

// Check if player is currently woodcutting
function isWoodcutting(playerId = 'player') {
  return activeWoodcutting.has(playerId);
}

// Show woodcutting-related messages
function showWoodcuttingMessage(message, type = 'info') {
  if (window.uiModule && window.uiModule.showNotification) {
    window.uiModule.showNotification(message, type);
  } else {
    console.log(`Woodcutting ${type}: ${message}`);
  }
}

// Handle movement completion - check for interaction targets
function handleMovementComplete() {
  // Check for direct woodcutting target first
  if (window.woodcuttingTarget) {
    console.log('Woodcutting: Movement complete, starting woodcutting (direct target)');
    const target = window.woodcuttingTarget;
    startWoodcutting(target.treeType, target.x, target.y, target.element);
    window.woodcuttingTarget = null; // Clear the target
    return;
  }
  
  // Check for world module interaction target
  if (window.interactionTarget && window.interactionTarget.type === 'woodcutting') {
    console.log('Woodcutting: Movement complete, starting woodcutting (interaction target)');
    const target = window.interactionTarget;
    startWoodcutting(target.treeType, target.x, target.y, target.element);
    // Note: interactionTarget will be cleared by world.js movement handler
    return;
  }
}

// Get the current active woodcutting session for external modules
function getActiveWoodcuttingSession(playerId = 'player') {
  return activeWoodcutting.get(playerId);
}

// Get tree log count for debugging
function getTreeLogCount(x, y) {
  const treeKey = `${x},${y}`;
  return treeLogCounts.get(treeKey) || 0;
}

// Expose woodcutting state globally for other modules
window.activeWoodcutting = activeWoodcutting;
window.isWoodcutting = isWoodcutting;
window.cancelWoodcutting = cancelWoodcutting;
window.getTreeLogCount = getTreeLogCount; // For debugging

// Export woodcutting functions
export {
  initializeWoodcutting,
  startWoodcutting,
  startWoodcuttingApproved,
  startWoodcuttingDenied,
  cancelWoodcutting,
  isWoodcutting,
  handleMovementComplete,
  addTreeInteractionHandlers,
  getActiveWoodcuttingSession,
  depleteTreeConfirmed,
  depleteTreeDenied,
  respawnTreeFromServer,
  getTreeLogCount,
  TREE_DEFINITIONS,
  AXE_DEFINITIONS
}; 