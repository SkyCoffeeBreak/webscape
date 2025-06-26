/**
 * Mining module for WebscapeRPG
 * Handles mining mechanics, ore objects, pickaxe requirements, and experience
 */

import { addExperience } from '../skills.js';
import { showSkillBubble, hideSkillBubble } from '../skillBubbles.js';

// Mining constants
const MINING_CONSTANTS = {
  BASE_MINING_TIME: 4000, // Base time in milliseconds
  ANIMATION_DURATION: 1000, // Time between pickaxe swings
  RESPAWN_TIME: 30000, // 30 seconds for ore respawn
  EXPERIENCE_PER_ORE: {
    'ore_copper': 17.5,
    'ore_tin': 17.5,
    'ore_iron': 35,
    'ore_silver': 40,
    'ore_gold': 65,
    'ore_mithril': 80,
    'ore_adamantite': 95
  }
};

// Ore definitions with mining requirements
const ORE_DEFINITIONS = {
  'ore_copper': {
    name: 'Copper Ore',
    icon: '🟤',
    level: 1,
    experience: 17.5,
    dropItem: 'copper_ore',
    respawnTime: 5000
  },
  'ore_tin': {
    name: 'Tin Ore', 
    icon: '🔘',
    level: 1,
    experience: 17.5,
    dropItem: 'tin_ore',
    respawnTime: 5000
  },
  'ore_iron': {
    name: 'Iron Ore',
    icon: '⚫',
    level: 10,
    experience: 35,
    dropItem: 'iron_ore',
    respawnTime: 5000
  },
  'ore_silver': {
    name: 'Silver Ore',
    icon: '⚪',
    level: 20,
    experience: 40,
    dropItem: 'silver_ore',
    respawnTime: 9000
  },
  'ore_gold': {
    name: 'Gold Ore',
    icon: '🟡',
    level: 30,
    experience: 65,
    dropItem: 'gold_ore',
    respawnTime: 12000
  },
  'ore_mithril': {
    name: 'Mithril Ore',
    icon: '🔵',
    level: 35,
    experience: 80,
    dropItem: 'mithril_ore',
    respawnTime: 12000
  },
  'ore_adamantite': {
    name: 'Adamantite Ore',
    icon: '🟢',
    level: 45,
    experience: 95,
    dropItem: 'adamantite_ore',
    respawnTime: 15000
  }
};

// Pickaxe definitions with mining requirements
const PICKAXE_DEFINITIONS = {
  'bronze_pickaxe': {
    name: 'Bronze Pickaxe',
    level: 1,
    miningBonus: 0, // No bonus
    icon: '⛏️'
  },
  'iron_pickaxe': {
    name: 'Iron Pickaxe',
    level: 5, // Changed from 10 to 5 as requested
    miningBonus: 0.1, // 10% faster mining
    icon: '⛏️'
  },
  'steel_pickaxe': {
    name: 'Steel Pickaxe',
    level: 10,
    miningBonus: 0.2,
    icon: '⛏️'
  },
  'mithril_pickaxe': {
    name: 'Mithril Pickaxe',
    level: 20,
    miningBonus: 0.3,
    icon: '⛏️'
  },
  'adamantite_pickaxe': {
    name: 'Adamantite Pickaxe',
    level: 30,
    miningBonus: 0.4,
    icon: '⛏️'
  }
};

// Global state tracking
const activeMining = new Map(); // Track active mining sessions
const depletedOreStates = new Map(); // Track depleted ore states globally
const oreRespawnTimers = new Map(); // Track ore respawn timers

// Click cooldown tracking
const lastClickTimes = new Map(); // Track last click time per ore location
const resourceCooldowns = new Map(); // Track cooldown per resource regardless of player
const CLICK_COOLDOWN = 500; // 0.5 seconds in milliseconds (increased from 100ms)
const RESOURCE_COOLDOWN = 1000; // 1 second cooldown per resource after mining completion

// Expose depleted ore states globally for world module access
window.depletedOreStates = depletedOreStates;

// Initialize mining system
function initializeMining() {
  console.log('Initializing mining system...');
  
  // Add ore interaction handlers to existing world objects
  addOreInteractionHandlers();
  
  console.log('Mining system initialized');
}

// Add interaction handlers to ore objects in the world
function addOreInteractionHandlers() {
  // Find all ore objects in the world and add click handlers
  document.querySelectorAll('.world-object').forEach(element => {
    const objectType = element.dataset.type;
    if (objectType && objectType.startsWith('ore_')) {
      element.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const oreX = parseInt(element.dataset.x);
        const oreY = parseInt(element.dataset.y);
        
        console.log(`Mining: Clicked on ${objectType} at (${oreX}, ${oreY})`);
        handleOreClick(objectType, oreX, oreY, element);
      });
    }
  });
}

// Handle clicking on an ore object
function handleOreClick(oreType, x, y, oreElement) {
  console.log(`Mining: Clicked ${oreType} at (${x}, ${y})`);
  
  const playerId = 'player'; // Could be dynamic for multiplayer
  
  // Check for click cooldown
  const oreKey = `${x},${y}`;
  const now = Date.now();
  const lastClickTime = lastClickTimes.get(oreKey) || 0;
  
  if (now - lastClickTime < CLICK_COOLDOWN) {
    console.log(`Mining: Click cooldown active for ore at (${x}, ${y})`);
    return;
  }
  
  // Update last click time
  lastClickTimes.set(oreKey, now);
  
  // Check if ore is depleted
  if (depletedOreStates.has(oreKey)) {
    showMiningMessage('This ore is depleted and regenerating...', 'warning');
    return;
  }
  
  // Check for resource cooldown (prevent spam mining same ore)
  const resourceCooldownTime = resourceCooldowns.get(oreKey) || 0;
  if (now < resourceCooldownTime) {
    const remainingTime = Math.ceil((resourceCooldownTime - now) / 1000);
    showMiningMessage(`You need to wait ${remainingTime} more second(s) before mining this ore again.`, 'warning');
    return;
  }
  
  // Check if already mining this ore (prevent multiple sessions on same ore)
  const existingSession = getActiveMiningSession(playerId);
  if (existingSession && existingSession.x === x && existingSession.y === y) {
    console.log(`Mining: Already mining this ore at (${x}, ${y})`);
    return;
  }
  
  // Check if mining something else (cancel previous session)
  if (existingSession) {
    console.log(`Mining: Canceling previous mining session at (${existingSession.x}, ${existingSession.y})`);
    cancelMining(playerId);
  }
  
  // Get player position and check distance
  const playerPos = window.worldModule?.getPlayerPosition();
  if (!playerPos) {
    console.error('Mining: Could not get player position');
    return;
  }
  
  const playerX = Math.floor(playerPos.x);
  const playerY = Math.floor(playerPos.y);
  
  // Use Chebyshev distance (OSRS-style) - allows diagonal interactions
  const dx = Math.abs(playerX - x);
  const dy = Math.abs(playerY - y);
  const distance = Math.max(dx, dy);
  console.log(`Mining: Distance to ore (Chebyshev): ${distance}`);
  
  if (distance > 1) {
    // Too far - use the new enhanced pathfinding that stops at adjacent tiles
    console.log('Mining: Too far from ore, using enhanced pathfinding');
    
    // Set mining target for when movement completes
    window.miningTarget = {
      oreType: oreType,
      x: x,
      y: y,
      element: oreElement
    };
    
    // Use the new interactive pathfinding that stops at adjacent tiles
    window.worldModule?.movePlayerToInteractiveTarget(x, y);
    return;
  }
  
  // Close enough - attempt to mine
  startMining(oreType, x, y, oreElement);
}

// Start mining an ore
function startMining(oreType, x, y, oreElement) {
  console.log(`Mining: Starting to mine ${oreType}`);
  
  // Double-check that the ore is not depleted locally
  if (oreElement.style.display === 'none' || 
      oreElement.dataset.depleted === 'true' || 
      oreElement.textContent === '🪨') {
    showMiningMessage('This ore vein is depleted. Wait for it to respawn.', 'info');
    return;
  }
  
  // Store mining target temporarily while waiting for server approval
  // Server will handle cancelling any existing actions automatically
  window.pendingMiningAction = {
    oreType: oreType,
    x: x,
    y: y,
    oreElement: oreElement
  };
  
  // Request server approval first if online
  if (window.isUserOnline && window.isUserOnline() && window.multiplayerModule) {
    console.log(`Mining: Requesting server approval to mine ${oreType} at (${x}, ${y})`);
    if (window.multiplayerModule.sendResourceActionRequest) {
      window.multiplayerModule.sendResourceActionRequest(oreType, x, y, 'mining');
      return; // Wait for server response
    }
  }
  
  // If offline, still cancel existing actions locally
  if (activeMining.has('player')) {
    console.log('Mining: Player already mining, cancelling current session to start new one');
    cancelMining('player');
  }
  
  // Also cancel any woodcutting session when offline
  if (window.woodcuttingModule && window.woodcuttingModule.isWoodcutting && window.woodcuttingModule.isWoodcutting('player')) {
    console.log('Mining: Player is woodcutting, cancelling to start mining');
    window.woodcuttingModule.cancelWoodcutting('player');
  }
  
  // If offline, proceed directly
  startMiningApproved(oreType, x, y);
}

// Handle server approval for mining
function startMiningApproved(oreType, x, y) {
  console.log(`Mining: Server approved mining ${oreType} at (${x}, ${y})`);
  
  // Get the pending action
  const pendingAction = window.pendingMiningAction;
  if (!pendingAction || pendingAction.oreType !== oreType || pendingAction.x !== x || pendingAction.y !== y) {
    console.warn('Mining: No matching pending action found');
    return;
  }
  
  const oreElement = pendingAction.oreElement;
  
  // Clear pending action
  window.pendingMiningAction = null;
  
  // Now proceed with the actual mining logic
  proceedWithMining(oreType, x, y, oreElement);
}

// Handle server denial for mining
function startMiningDenied(oreType, x, y, reason, depletedBy) {
  console.log(`Mining: Server denied mining ${oreType} at (${x}, ${y}): ${reason}`);
  
  // Clear pending action
  window.pendingMiningAction = null;
  
  // Message is already shown by multiplayer module
}

// Proceed with actual mining (moved from original startMining function)
function proceedWithMining(oreType, x, y, oreElement) {
  console.log(`Mining: Proceeding with mining ${oreType} at (${x}, ${y})`);
  
  // Get ore definition
  const oreDef = ORE_DEFINITIONS[oreType];
  if (!oreDef) {
    console.error(`Mining: Unknown ore type: ${oreType}`);
    return;
  }
  
  // Get player profile (assuming it's available globally)
  const profile = window.userModule?.getProfile();
  if (!profile) {
    console.error('Mining: Could not get player profile');
    return;
  }
  
  // Check mining level requirement
  const playerMiningLevel = profile.skills.mining || 1;
  if (playerMiningLevel < oreDef.level) {
    showMiningMessage(`You need level ${oreDef.level} Mining to mine ${oreDef.name}.`, 'error');
    return;
  }
  
  // Check for pickaxe in inventory
  const pickaxe = findBestPickaxe(profile);
  if (!pickaxe) {
    showMiningMessage('You need a pickaxe to mine ores!', 'error');
    return;
  }
  
  // Check pickaxe level requirement
  const pickaxeDef = PICKAXE_DEFINITIONS[pickaxe.id];
  if (playerMiningLevel < pickaxeDef.level) {
    showMiningMessage(`You need level ${pickaxeDef.level} Mining to use a ${pickaxeDef.name}.`, 'error');
    return;
  }

  // Cancel any existing mining session to prevent multiple timers
  const existingSession = activeMining.get('player');
  if (existingSession) {
    console.log('Mining: Cancelling existing session to prevent multiple timers');
    cancelMining('player');
  }
  
  // Face player towards the ore
  facePlayerTowardsOre(x, y);
  
  // Calculate mining time (base time reduced by pickaxe bonus and level)
  const levelBonus = Math.floor(playerMiningLevel / 10) * 0.05; // 5% reduction per 10 levels
  const totalBonus = pickaxeDef.miningBonus + levelBonus;
  const miningTime = Math.max(1000, MINING_CONSTANTS.BASE_MINING_TIME * (1 - totalBonus));
  
  console.log(`Mining: Starting mining session - Time: ${miningTime}ms, Pickaxe: ${pickaxe.id}`);
  
  // Set timer to complete mining and store the timer ID
  const timerId = setTimeout(() => {
    completeMining('player');
  }, miningTime);
  
  // Start mining session with timer ID
  const miningSession = {
    oreType: oreType,
    x: x,
    y: y,
    element: oreElement,
    startTime: Date.now(),
    duration: miningTime,
    pickaxe: pickaxe,
    oreDef: oreDef,
    timerId: timerId  // Store timer ID for proper cleanup
  };
  
  activeMining.set('player', miningSession);
  
  // Show mining animation
  startMiningAnimation();
  
  showMiningMessage(`You begin mining the ${oreDef.name}...`, 'info');
}

// Face player towards the ore being mined
function facePlayerTowardsOre(oreX, oreY) {
  const playerPos = window.worldModule?.getPlayerPosition();
  if (!playerPos) {
    console.error('Mining: Could not get player position for facing');
    return;
  }
  
  const playerX = Math.floor(playerPos.x);
  const playerY = Math.floor(playerPos.y);
  
  // Calculate direction from player to ore
  const dx = oreX - playerX;
  const dy = oreY - playerY;
  
  console.log(`Mining: Facing player towards ore at (${oreX}, ${oreY}) from (${playerX}, ${playerY}), dx=${dx}, dy=${dy}`);
  
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
    
    console.log(`Mining: Player direction updated to ${direction}`);
  } else {
    console.warn('Mining: Could not update player direction - missing functions or element');
  }
}

// Find the best pickaxe the player can use
function findBestPickaxe(profile) {
  // Get the actual player inventory from the inventory module
  const inventory = window.inventoryModule?.getPlayerInventory() || [];
  const playerMiningLevel = profile.skills.mining || 1;
  
  console.log('Mining: Searching for pickaxe in inventory:', inventory);
  console.log('Mining: Player mining level:', playerMiningLevel);
  
  let bestPickaxe = null;
  let bestLevel = -1;
  
  for (let i = 0; i < inventory.length; i++) {
    const item = inventory[i];
    if (item && item.id && item.id.endsWith('_pickaxe')) {
      console.log('Mining: Found pickaxe:', item.id);
      
      // Check if the pickaxe is noted - noted tools cannot be used
      const isNoted = window.inventoryModule && window.inventoryModule.isItemNoted 
        ? window.inventoryModule.isItemNoted(item) 
        : item.noted === true;
      
      if (isNoted) {
        console.log('Mining: Pickaxe is noted, skipping:', item.id);
        continue; // Skip noted pickaxes
      }
      
      const pickaxeDef = PICKAXE_DEFINITIONS[item.id];
      console.log('Mining: Pickaxe definition:', pickaxeDef);
      
      if (pickaxeDef && playerMiningLevel >= pickaxeDef.level && pickaxeDef.level > bestLevel) {
        bestPickaxe = item;
        bestLevel = pickaxeDef.level;
        console.log('Mining: New best pickaxe:', item.id, 'level requirement:', pickaxeDef.level);
      }
    }
  }
  
  console.log('Mining: Best pickaxe found:', bestPickaxe);
  return bestPickaxe;
}

// Start mining animation using standardized skill bubble system
function startMiningAnimation() {
  showSkillBubble('mining');
}

// Stop mining animation using standardized skill bubble system
function stopMiningAnimation() {
  hideSkillBubble();
}

// Complete mining and give rewards
function completeMining(playerId) {
  const miningSession = activeMining.get(playerId);
  if (!miningSession) return;
  
  console.log(`Mining: Completing mining session for ${miningSession.oreType}`);
  
  // Clear the timer ID since the session is completing
  if (miningSession.timerId) {
    miningSession.timerId = null;
  }
  
  // Add resource cooldown to prevent immediate re-mining
  const oreKey = `${miningSession.x},${miningSession.y}`;
  resourceCooldowns.set(oreKey, Date.now() + RESOURCE_COOLDOWN);
  
  // Stop animation
  stopMiningAnimation();
  
  // Give ore to player
  const success = addOreToInventory(miningSession.oreDef.dropItem);
  
  if (success) {
    // Add experience
    const profile = window.userModule?.getProfile();
    if (profile) {
      console.log(`⛏️ Mining: Adding ${miningSession.oreDef.experience} XP to mining skill`);
      console.log(`⛏️ Mining: Before - Level: ${profile.skills.mining}, XP: ${profile.skillsExp.mining || 0}`);
      
      const leveledUp = addExperience('mining', miningSession.oreDef.experience, profile.skills, profile.skillsExp);
      
      console.log(`⛏️ Mining: After - Level: ${profile.skills.mining}, XP: ${profile.skillsExp.mining || 0}, Leveled up: ${leveledUp}`);
      
      // Update UI
      if (window.uiModule && window.uiModule.updateSkillDisplay) {
        console.log(`⛏️ Mining: Calling updateSkillDisplay for mining`);
        window.uiModule.updateSkillDisplay('mining', profile.skills.mining, leveledUp);
        if (leveledUp) {
          window.uiModule.updateTotalLevel(profile.skills);
        }
      }
      
      // Update experience bar with visual feedback
      if (window.uiModule && window.uiModule.updateSkillExperienceBar) {
        console.log(`⛏️ Mining: Calling updateSkillExperienceBar for mining`);
        window.uiModule.updateSkillExperienceBar('mining');
        
        // Add visual feedback for experience gain
        const skillElement = document.querySelector(`[data-skill="mining"]`);
        if (skillElement) {
          const expFill = skillElement.querySelector('.skill-exp-fill');
          if (expFill) {
            console.log(`⛏️ Mining: Adding visual feedback animation`);
            expFill.classList.add('exp-gain');
            setTimeout(() => {
              expFill.classList.remove('exp-gain');
            }, 600);
          } else {
            console.warn(`⛏️ Mining: No exp-fill element found for visual feedback`);
          }
        } else {
          console.warn(`⛏️ Mining: No skill element found for mining`);
        }
      } else {
        console.warn(`⛏️ Mining: updateSkillExperienceBar function not available`);
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
        showMiningMessage(`Level up! Your Mining level is now ${profile.skills.mining}!`, 'success');
      }
    }
    
    showMiningMessage(`You mine some ${miningSession.oreDef.name.toLowerCase()}.`, 'success');
    
    // Small chance for gem drop (2% chance)
    if (Math.random() < 0.02) {
      const gemDropped = window.inventoryModule.addItemToInventory('uncut_gem', 1);
      if (gemDropped) {
        console.log('Mining: Lucky! Found an uncut gem!');
        // Show special message for gem drop
        if (window.chatModule && window.chatModule.addMessage) {
          window.chatModule.addMessage('✨ You found an uncut gem! ✨', 'system');
        }
      }
    }
    
    // Request ore depletion from server
    requestOreDepletion(miningSession.oreType, miningSession.x, miningSession.y, miningSession.element);
  } else {
    showMiningMessage('Your inventory is full!', 'error');
  }
  
  // Clean up mining session
  activeMining.delete(playerId);
}

// Add ore to player inventory
function addOreToInventory(oreItemId) {
  if (window.inventoryModule && window.inventoryModule.addItemToInventory) {
    return window.inventoryModule.addItemToInventory(oreItemId, 1);
  }
  return false;
}

// Request ore depletion from server (server-authoritative)
function requestOreDepletion(oreType, x, y, oreElement) {
  console.log(`Mining: Requesting depletion of ${oreType} at (${x}, ${y}) from server`);
  
  // Send depletion request to server if online
  if (window.isUserOnline && window.isUserOnline()) {
    const oreDef = ORE_DEFINITIONS[oreType];
    // Use new message type for depletion requests
    if (window.multiplayerModule && window.multiplayerModule.sendResourceDepletionRequest) {
      window.multiplayerModule.sendResourceDepletionRequest(oreType, x, y, oreType, oreDef.respawnTime);
    } else {
      console.warn('Mining: Server-authoritative resource system not available');
    }
  } else {
    // If offline, deplete locally immediately (single-player mode)
    depleteOreConfirmed(oreType, x, y, oreElement);
  }
}

// Handle confirmed ore depletion from server
function depleteOreConfirmed(oreType, x, y, oreElement) {
  console.log(`Mining: Server confirmed depletion of ${oreType} at (${x}, ${y})`);
  
  const oreKey = `${x},${y}`;
  
  // Store original ore appearance in global state
  const originalText = oreElement.textContent;
  const originalTitle = oreElement.title;
  
  // Add to global depleted state
  depletedOreStates.set(oreKey, {
    oreType: oreType,
    originalText: originalText,
    originalTitle: originalTitle,
    depletedAt: Date.now()
  });
  
  // Update current element to show depleted appearance
  oreElement.textContent = '🪨';
  oreElement.title = 'Depleted ore (respawning...)';
  oreElement.dataset.depleted = 'true';
  
  // Force world re-render to immediately show the change
  if (window.worldModule && window.worldModule.forceWorldRerender) {
    window.worldModule.forceWorldRerender();
  }
  
  console.log(`Mining: Ore ${oreType} at (${x}, ${y}) depleted locally`);
}

// Handle denied ore depletion from server
function depleteOreDenied(oreType, x, y, reason, depletedBy) {
  console.log(`Mining: Server denied depletion of ${oreType} at (${x}, ${y}): ${reason}`);
  if (depletedBy) {
    showMiningMessage(`This ore was already mined by ${depletedBy}!`, 'error');
  } else {
    showMiningMessage(`Cannot mine this ore: ${reason}`, 'error');
  }
}

// Handle ore respawn from server (server-authoritative)
function respawnOreFromServer(oreType, x, y) {
  console.log(`Mining: Server-initiated respawn of ${oreType} at (${x}, ${y})`);
  
  const oreKey = `${x},${y}`;
  
  // Remove from global depleted state
  depletedOreStates.delete(oreKey);
  
  // Clean up any local timer (shouldn't exist in server-authoritative mode)
  if (oreRespawnTimers.has(oreKey)) {
    clearTimeout(oreRespawnTimers.get(oreKey));
    oreRespawnTimers.delete(oreKey);
  }
  
  // Update any existing DOM element if it's currently rendered
  const existingElement = document.querySelector(`.world-object[data-type="${oreType}"][data-x="${x}"][data-y="${y}"]`);
  if (existingElement) {
    const oreDef = ORE_DEFINITIONS[oreType];
    existingElement.textContent = oreDef.icon;
    existingElement.title = oreDef.name;
    existingElement.dataset.depleted = 'false';
    console.log(`Mining: Updated existing DOM element for respawned ore at (${x}, ${y})`);
  } else {
    console.log(`Mining: No DOM element found for respawned ore at (${x}, ${y}) - will be handled by next render`);
  }
}

// Cancel mining (when player moves away)
function cancelMining(playerId = 'player') {
  const miningSession = activeMining.get(playerId);
  if (miningSession) {
    console.log('Mining: Cancelling mining session');
    
    // Clear the completion timer to prevent it from firing
    if (miningSession.timerId) {
      clearTimeout(miningSession.timerId);
      console.log('Mining: Cleared completion timer');
    }
    
    stopMiningAnimation();
    activeMining.delete(playerId);
    showMiningMessage('Mining interrupted.', 'info');
  }
}

// Check if player is currently mining
function isMining(playerId = 'player') {
  return activeMining.has(playerId);
}

// Show mining-related messages
function showMiningMessage(message, type = 'info') {
  if (window.uiModule && window.uiModule.showNotification) {
    window.uiModule.showNotification(message, type);
  } else {
    console.log(`Mining ${type}: ${message}`);
  }
}

// Handle movement completion - check for interaction targets
function handleMovementComplete() {
  if (window.interactionTarget && window.interactionTarget.type === 'mining') {
    console.log('Mining: Movement complete, starting mining');
    const target = window.interactionTarget;
    startMining(target.oreType, target.x, target.y, target.element);
    // Note: interactionTarget will be cleared by world.js movement handler
  }
}

// Get the current active mining session for external modules
function getActiveMiningSession(playerId = 'player') {
  return activeMining.get(playerId);
}

// Expose mining state globally for other modules
window.activeMining = activeMining;

// Export mining functions
export {
  initializeMining,
  handleOreClick,
  startMining,
  startMiningApproved,
  startMiningDenied,
  cancelMining,
  isMining,
  addOreInteractionHandlers,
  handleMovementComplete,
  getActiveMiningSession,
  depleteOreConfirmed,
  depleteOreDenied,
  respawnOreFromServer,
  ORE_DEFINITIONS,
  PICKAXE_DEFINITIONS
}; 