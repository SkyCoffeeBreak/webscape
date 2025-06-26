/**
 * Digging module for WebscapeRPG
 * Handles digging mechanics, terrain types, shovel requirements, and experience
 */

// Note: Functions like addExperience, showSkillBubble, hideSkillBubble are available globally via window

import { showSkillBubble, hideSkillBubble } from '../skillBubbles.js';

// Note: addExperience is available globally via window

// Digging constants
const DIGGING_CONSTANTS = {
  BASE_DIGGING_TIME: 3000, // Base time in milliseconds
  ANIMATION_DURATION: 800, // Time between shovel digs
  MAX_CONTINUOUS_DIGS: 6, // Maximum number of continuous digs
  CONTINUOUS_DIG_DELAY: 500, // Delay between continuous digs in milliseconds
  HOLE_CHANCE: 0.15, // 15% chance to create a hole
  HOLE_DURATION: 60000, // 1 minute in milliseconds
  EXPERIENCE_PER_DIG: {
    'sand': 15,
    'grass': 20,
    'dirt': 25,
    'gravel': 30,
    'snow': 35,
    'mud': 40,
    'swamp': 50,
    'tundra': 60,
    'desert_stone': 70,
    'mossy_stone': 80,
    'lava_rock': 100,
    'ancient_tiles': 120,
    'clay_deposit': 25,
    'fire_clay': 45,
    'cambrian_clay': 65,
    'white_clay': 85,
    'black_clay': 110,
    'sacred_clay': 140,
    'bone_shards': 30,
    'burial_mound': 45,
    'mammoth_pit': 70,
    'behemoth_remains': 100,
    'fossil_shelf': 120,
    'draconic_remains': 220,
    'ancient_graveyard': 270
  },
  DROP_CHANCE: {
    'sand': 0.7,  // 70% chance to get sand
    'grass': 0.6, // 60% chance to get dirt
    'dirt': 0.65, // 65% chance to get dirt
    'gravel': 0.8, // 80% chance to get gravel
    'snow': 0.5,  // 50% chance to get snow (harder terrain)
    'mud': 0.75,  // 75% chance to get mud
    'swamp': 0.45, // 45% chance to get swamp soil (challenging terrain)
    'tundra': 0.4, // 40% chance to get frozen soil (very hard)
    'desert_stone': 0.35, // 35% chance to get sandstone (rocky)
    'mossy_stone': 0.3, // 30% chance to get moss covered rock (hardest stone)
    'lava_rock': 0.25, // 25% chance to get volcanic ash (dangerous terrain)
    'ancient_tiles': 0.2, // 20% chance to get ancient stone (rarest materials)
    'clay_deposit': 0.85, // 85% chance to get clay (clay is valuable for crafting)
    'fire_clay': 0.75, // 75% chance to get fire clay
    'cambrian_clay': 0.65, // 65% chance to get cambrian clay
    'white_clay': 0.55, // 55% chance to get white clay
    'black_clay': 0.45, // 45% chance to get black clay (rare)
    'sacred_clay': 0.35, // 35% chance to get sacred clay (very rare)
    'bone_shards': 0.7, // 70% chance to get small bones
    'burial_mound': 0.65, // 65% chance to get bones
    'mammoth_pit': 0.6, // 60% chance to get big bones
    'behemoth_remains': 0.5, // 50% chance to get giant bones
    'fossil_shelf': 0.4, // 40% chance to get fossil fragments
    'draconic_remains': 0.3, // 30% chance to get dragon bones (very rare)
    'ancient_graveyard': 0.25 // 25% chance to get ancient bones (extremely rare)
  }
};

// Terrain types that can be dug
const DIGGABLE_TERRAIN = {
  'sand': {
    name: 'Sand',
    dropItem: 'sand',
    experience: 15,
    level: 1,
    tileId: 2
  },
  'grass': {
    name: 'Grass',
    dropItem: 'dirt',
    experience: 20,
    level: 5,
    tileId: 0
  },
  'dirt': {
    name: 'Dirt',
    dropItem: 'dirt',
    experience: 25,
    level: 8,
    tileId: 6
  },
  'gravel': {
    name: 'Gravel',
    dropItem: 'gravel',
    experience: 30,
    level: 10,
    tileId: 17
  },
  'snow': {
    name: 'Snow',
    dropItem: 'snow',
    experience: 35,
    level: 15,
    tileId: 18
  },
  'mud': {
    name: 'Mud',
    dropItem: 'mud',
    experience: 40,
    level: 20,
    tileId: 19
  },
  'swamp': {
    name: 'Swamp',
    dropItem: 'swamp_soil',
    experience: 50,
    level: 25,
    tileId: 21
  },
  'tundra': {
    name: 'Tundra',
    dropItem: 'frozen_soil',
    experience: 60,
    level: 30,
    tileId: 22
  },
  'desert_stone': {
    name: 'Desert Stone',
    dropItem: 'sandstone',
    experience: 70,
    level: 35,
    tileId: 23
  },
  'mossy_stone': {
    name: 'Mossy Stone',
    dropItem: 'moss_covered_rock',
    experience: 80,
    level: 40,
    tileId: 24
  },
  'lava_rock': {
    name: 'Lava Rock',
    dropItem: 'volcanic_ash',
    experience: 100,
    level: 50,
    tileId: 37
  },
  'ancient_tiles': {
    name: 'Ancient Tiles',
    dropItem: 'ancient_stone',
    experience: 220,
    level: 80,
    tileId: 40
  },
  'clay_deposit': {
    name: 'Clay Deposit',
    dropItem: 'clay',
    experience: 25,
    level: 1,
    tileId: 41
  },
  'fire_clay': {
    name: 'Fire Clay',
    dropItem: 'fire_clay',
    experience: 45,
    level: 25,
    tileId: 42
  },
  'cambrian_clay': {
    name: 'Cambrian Clay',
    dropItem: 'cambrian_clay',
    experience: 65,
    level: 35,
    tileId: 43
  },
  'white_clay': {
    name: 'White Clay',
    dropItem: 'white_clay',
    experience: 85,
    level: 50,
    tileId: 44
  },
  'black_clay': {
    name: 'Black Clay',
    dropItem: 'black_clay',
    experience: 110,
    level: 60,
    tileId: 45
  },
  'sacred_clay': {
    name: 'Sacred Clay',
    dropItem: 'sacred_clay',
    experience: 140,
    level: 75,
    tileId: 46
  },
  'bone_shards': {
    name: 'Bone Shards',
    dropItem: 'small_bones',
    experience: 30,
    level: 6,
    tileId: 50
  },
  'burial_mound': {
    name: 'Burial Mound',
    dropItem: 'bones',
    experience: 45,
    level: 12,
    tileId: 51
  },
  'mammoth_pit': {
    name: 'Mammoth Pit',
    dropItem: 'big_bones',
    experience: 70,
    level: 20,
    tileId: 52
  },
  'behemoth_remains': {
    name: 'Behemoth Remains',
    dropItem: 'giant_bones',
    experience: 100,
    level: 30,
    tileId: 53
  },
  'fossil_shelf': {
    name: 'Fossil Shelf',
    dropItem: 'fossil_fragments',
    experience: 120,
    level: 40,
    tileId: 54
  },
  'draconic_remains': {
    name: 'Draconic Remains',
    dropItem: 'dragon_bones',
    experience: 220,
    level: 60,
    tileId: 55
  },
  'ancient_graveyard': {
    name: 'Ancient Graveyard',
    dropItem: 'ancient_bones',
    experience: 270,
    level: 75,
    tileId: 56
  }
};

// Shovel definitions with digging requirements
const SHOVEL_DEFINITIONS = {
  'bronze_shovel': {
    name: 'Bronze Shovel',
    level: 1,
    diggingBonus: 0, // No bonus
    icon: '🪏'
  },
  'iron_shovel': {
    name: 'Iron Shovel',
    level: 5,
    diggingBonus: 0.1, // 10% faster digging
    icon: '🪏'
  },
  'steel_shovel': {
    name: 'Steel Shovel',
    level: 10,
    diggingBonus: 0.2,
    icon: '🪏'
  },
  'mithril_shovel': {
    name: 'Mithril Shovel',
    level: 20,
    diggingBonus: 0.3,
    icon: '🪏'
  },
  'adamantite_shovel': {
    name: 'Adamantite Shovel',
    level: 30,
    diggingBonus: 0.4,
    icon: '🪏'
  },
  'runite_shovel': {
    name: 'Runite Shovel',
    level: 40,
    diggingBonus: 0.5,
    icon: '🪏'
  }
};

// Global state tracking
const activeDigging = new Map();
const continuousDigging = new Map(); // Track continuous digging sessions
const diggingHoles = new Map(); // Track holes created from digging

// Click cooldown tracking
const lastClickTimes = new Map(); // Track last click time per location
const CLICK_COOLDOWN = 500; // 0.5 seconds in milliseconds

// Initialize digging system
function initializeDigging() {
  console.log('Initializing digging system...');
  
  // Add click handler for left-clicking on diggable terrain
  addDiggingClickHandlers();
  
  console.log('Digging system initialized');
}

// Add click handlers for digging on terrain
function addDiggingClickHandlers() {
  // Add event listener to the world container for clicking on terrain
  const worldContainer = document.querySelector('.world-container');
  if (worldContainer) {
    worldContainer.addEventListener('click', handleWorldClick);
  }
}

// Handle clicking on the world to dig
function handleWorldClick(e) {
  // Only process if no other interaction is happening
  if (e.target.closest('.world-object') || e.target.closest('.player')) {
    return; // Don't dig if clicking on objects or players
  }
  
  // Get world position from click
  const worldPos = getWorldPositionFromClick(e);
  if (!worldPos) return;
  
  const { x, y } = worldPos;
  
  // Check if player is on a diggable tile
  if (!isPlayerOnDiggableTerrain()) {
    showDiggingMessage('You can only dig on grass or sand terrain.', 'warning');
    return;
  }
  
  // Start digging at player position
  const playerPos = window.worldModule?.getPlayerPosition();
  if (playerPos) {
    handleDigAtPosition(playerPos.x, playerPos.y);
  }
}

// Handle digging at a specific position
function handleDigAtPosition(x, y) {
  const playerId = 'player';
  
  // Check for click cooldown
  const locationKey = `${x},${y}`;
  const now = Date.now();
  const lastClickTime = lastClickTimes.get(locationKey) || 0;
  
  if (now - lastClickTime < CLICK_COOLDOWN) {
    return;
  }
  
  // Update last click time
  lastClickTimes.set(locationKey, now);
  
  // Check if already digging
  if (activeDigging.has(playerId)) {
    showDiggingMessage('You are already digging!', 'warning');
    return;
  }
  
  // Check if player has a shovel
  const bestShovel = findBestShovel();
  if (!bestShovel) {
    showDiggingMessage('You need a shovel to dig!', 'warning');
    return;
  }
  
  // Check if there's a hole at this position
  const holeKey = `${x},${y}`;
  if (diggingHoles.has(holeKey)) {
    showDiggingMessage("This area's already been dug out!", 'warning');
    return;
  }
  
  // Get terrain type at position
  const terrainType = getTerrainTypeAtPosition(x, y);
  
  if (!terrainType || !DIGGABLE_TERRAIN[terrainType]) {
    showDiggingMessage("You can't dig here.", 'warning');
    return;
  }
  
  // Check level requirement
  const terrain = DIGGABLE_TERRAIN[terrainType];
  const profile = window.userModule?.getProfile();
  const playerLevel = profile?.skills?.digging || 1;
  
  if (playerLevel < terrain.level) {
    showDiggingMessage(`You need level ${terrain.level} Digging to dig ${terrain.name}.`, 'warning');
    return;
  }
  
  // Start digging
  startDigging(terrainType, x, y, bestShovel);
}

// Start digging process
function startDigging(terrainType, x, y, shovel) {
  const playerId = 'player';
  const terrain = DIGGABLE_TERRAIN[terrainType];
  
  // Start continuous digging session if not already active
  if (!continuousDigging.has(playerId)) {
    continuousDigging.set(playerId, {
      terrainType,
      x,
      y,
      shovel,
      digsRemaining: DIGGING_CONSTANTS.MAX_CONTINUOUS_DIGS - 1, // -1 because this is the first dig
      totalDigs: 1
    });
  }
  
  // Calculate digging time with level-based speed bonus
  const baseTime = DIGGING_CONSTANTS.BASE_DIGGING_TIME;
  const profile = window.userModule?.getProfile();
  const diggingLevel = profile?.skills?.digging || 1;
  
  // Level-based speed bonus: 0.5% faster per level, capped at 40% faster at level 80+
  const levelSpeedBonus = Math.min(diggingLevel * 0.005, 0.4);
  
  // Combine shovel bonus and level bonus
  const totalSpeedBonus = shovel.diggingBonus + levelSpeedBonus;
  const diggingTime = Math.round(baseTime * (1 - totalSpeedBonus));
  
  // Store digging session
  const diggingSession = {
    playerId,
    terrainType,
    x,
    y,
    shovel,
    startTime: Date.now(),
    duration: diggingTime
  };
  
  activeDigging.set(playerId, diggingSession);
  
  // Show skill bubble above player
  const continuousSession = continuousDigging.get(playerId);
  const digNumber = continuousSession ? continuousSession.totalDigs : 1;
  showSkillBubble('digging', `Digging ${terrain.name}... (${digNumber}/${DIGGING_CONSTANTS.MAX_CONTINUOUS_DIGS})`);
  
  // Set up completion timer
  setTimeout(() => {
    if (activeDigging.has(playerId)) {
      completeDigging(playerId);
    }
  }, diggingTime);
  
  if (digNumber === 1) {
    showDiggingMessage(`You start digging the ${terrain.name}...`, 'info');
  } else {
    showDiggingMessage(`You continue digging... (${digNumber}/${DIGGING_CONSTANTS.MAX_CONTINUOUS_DIGS})`, 'info');
  }
}

// Complete digging and give rewards
function completeDigging(playerId) {
  const session = activeDigging.get(playerId);
  if (!session) return;
  
  const { terrainType, x, y, shovel } = session;
  const terrain = DIGGABLE_TERRAIN[terrainType];
  
  // Remove active session
  activeDigging.delete(playerId);
  
  // Add experience
  const experience = terrain.experience;
  if (window.addExperience) {
    window.addExperience('digging', experience);
  }
  
  // Check for item drop
  const dropChance = DIGGING_CONSTANTS.DROP_CHANCE[terrainType];
  const randomRoll = Math.random();
  
  if (randomRoll < dropChance) {
    // Add item to inventory
    if (window.inventoryModule?.addItemToInventory) {
      const success = window.inventoryModule.addItemToInventory(terrain.dropItem, 1);
      if (success) {
        showDiggingMessage(`You found some ${terrain.dropItem}! (+${experience} XP)`, 'success');
      } else {
        showDiggingMessage(`Your inventory is full! (+${experience} XP)`, 'warning');
      }
    } else {
      showDiggingMessage(`You found some ${terrain.dropItem} but couldn't pick it up! (+${experience} XP)`, 'warning');
    }
  } else {
    showDiggingMessage(`You dig but find nothing... (+${experience} XP)`, 'info');
  }
  
  // Check for hole creation
  const holeRoll = Math.random();
  if (holeRoll < DIGGING_CONSTANTS.HOLE_CHANCE) {
    createDiggingHole(x, y);
    showDiggingMessage("You've created a hole from your digging.", 'info');
    
    // End continuous digging if a hole is created
    endContinuousDigging(playerId);
    return;
  }
  
  // Check for continuous digging
  const continuousSession = continuousDigging.get(playerId);
  if (continuousSession && continuousSession.digsRemaining > 0) {
    // Continue digging after a short delay
    setTimeout(() => {
      if (continuousDigging.has(playerId)) {
        continueContinuousDigging(playerId);
      }
    }, DIGGING_CONSTANTS.CONTINUOUS_DIG_DELAY);
  } else {
    // End continuous digging session
    endContinuousDigging(playerId);
  }
}

// Find the best shovel in inventory
function findBestShovel() {
  const profile = window.userModule?.getProfile();
  
  if (!profile || !profile.skills) {
    return null;
  }
  
  const diggingLevel = profile.skills.digging || 1;
  const inventory = window.inventoryModule?.playerInventory || [];
  
  let bestShovel = null;
  
  // Check inventory for shovels
  for (let i = 0; i < inventory.length; i++) {
    const item = inventory[i];
    if (item && item.id) {
      if (SHOVEL_DEFINITIONS[item.id]) {
        const shovelDef = SHOVEL_DEFINITIONS[item.id];
        if (diggingLevel >= shovelDef.level) {
          if (!bestShovel || shovelDef.diggingBonus > bestShovel.diggingBonus) {
            bestShovel = { ...shovelDef, id: item.id };
          }
        }
      }
    }
  }
  
  return bestShovel;
}

// Check if player is on diggable terrain
function isPlayerOnDiggableTerrain() {
  const playerPos = window.worldModule?.getPlayerPosition();
  if (!playerPos) return false;
  
  const terrainType = getTerrainTypeAtPosition(playerPos.x, playerPos.y);
  return terrainType && DIGGABLE_TERRAIN[terrainType];
}

// Get terrain type at position using actual world data
function getTerrainTypeAtPosition(x, y) {
  // Get the actual terrain tile from the world layer system
  if (!window.worldModule?.getTileOnLayer) {
    console.warn('World module getTileOnLayer not available, defaulting to grass');
    return 'grass';
  }
  
  // Get terrain tile from layer 0 (terrain layer) - this will automatically handle current map level
  const tileId = window.worldModule.getTileOnLayer(0, x, y);
  
  // Find which terrain type matches this tile ID
  for (const [terrainName, terrainData] of Object.entries(DIGGABLE_TERRAIN)) {
    if (terrainData.tileId === tileId) {
      return terrainName;
    }
  }
  
  // If no match found, return null (not diggable)
  return null;
}

// Get world position from click event
function getWorldPositionFromClick(e) {
  // This should convert screen coordinates to world coordinates
  // Implementation depends on your world/camera system
  const playerPos = window.worldModule?.getPlayerPosition();
  return playerPos; // For now, just return player position
}

// Get user profile (now using proper fresh profile access)
function getUserProfile() {
  return window.userModule?.getProfile() || {};
}

// Continue continuous digging
function continueContinuousDigging(playerId) {
  const continuousSession = continuousDigging.get(playerId);
  if (!continuousSession) return;
  
  // Update session
  continuousSession.digsRemaining--;
  continuousSession.totalDigs++;
  
  // Check if there's a hole at this position
  const holeKey = `${continuousSession.x},${continuousSession.y}`;
  if (diggingHoles.has(holeKey)) {
    endContinuousDigging(playerId);
    showDiggingMessage("You can't dig here.", 'warning');
    return;
  }
  
  // Check if we can still dig here
  const terrainType = getTerrainTypeAtPosition(continuousSession.x, continuousSession.y);
  if (!terrainType || !DIGGABLE_TERRAIN[terrainType] || terrainType !== continuousSession.terrainType) {
    endContinuousDigging(playerId);
    showDiggingMessage('You can no longer dig here.', 'warning');
    return;
  }
  
  // Check level requirement
  const terrain = DIGGABLE_TERRAIN[terrainType];
  const profile = window.userModule?.getProfile();
  const playerLevel = profile?.skills?.digging || 1;
  
  if (playerLevel < terrain.level) {
    endContinuousDigging(playerId);
    showDiggingMessage(`You need level ${terrain.level} Digging to dig ${terrain.name}.`, 'warning');
    return;
  }
  
  // Continue digging
  startDigging(continuousSession.terrainType, continuousSession.x, continuousSession.y, continuousSession.shovel);
}

// End continuous digging session
function endContinuousDigging(playerId) {
  continuousDigging.delete(playerId);
  if (window.hideSkillBubble) {
    window.hideSkillBubble();
  }
}

// Cancel digging
function cancelDigging(playerId = 'player') {
  if (activeDigging.has(playerId)) {
    activeDigging.delete(playerId);
  }
  endContinuousDigging(playerId);
  showDiggingMessage('Digging cancelled.', 'info');
}

// Check if currently digging
function isDigging(playerId = 'player') {
  return activeDigging.has(playerId);
}

// Show digging message
function showDiggingMessage(message, type = 'info') {
  if (window.addMessage) {
    window.addMessage(message, type);
  } else {
    console.log(`Digging ${type}: ${message}`);
  }
}

// Handle movement complete (cancel digging if moving)
function handleMovementComplete() {
  // Cancel digging if player moves
  const playerId = 'player';
  if (activeDigging.has(playerId) || continuousDigging.has(playerId)) {
    cancelDigging(playerId);
  }
}

// Get active digging session
function getActiveDiggingSession(playerId = 'player') {
  return activeDigging.get(playerId) || null;
}

// Handle inventory interaction (right-click > dig)
function handleShovelInteraction(shovelId) {
  const playerPos = window.worldModule?.getPlayerPosition();
  if (!playerPos) {
    showDiggingMessage('Unable to determine your position.', 'warning');
    return;
  }
  
  // Check if player is on diggable terrain
  if (!isPlayerOnDiggableTerrain()) {
    showDiggingMessage("You can't dig here.", 'warning');
    return;
  }
  
  // Start digging at player position
  handleDigAtPosition(playerPos.x, playerPos.y);
}

// Create a digging hole
function createDiggingHole(x, y) {
  const holeKey = `${x},${y}`;
  const holeData = {
    x,
    y,
    createdAt: Date.now(),
    expiresAt: Date.now() + DIGGING_CONSTANTS.HOLE_DURATION
  };
  
  diggingHoles.set(holeKey, holeData);
  
  // Create visual hole element
  createVisualHole(x, y);
  
  // Set timeout to remove hole
  setTimeout(() => {
    removeDiggingHole(x, y);
  }, DIGGING_CONSTANTS.HOLE_DURATION);
  
  // Sync with server if online
  if (window.isUserOnline && window.isUserOnline() && window.getWebSocket) {
    const websocket = window.getWebSocket();
    if (websocket && websocket.readyState === WebSocket.OPEN) {
      websocket.send(JSON.stringify({
        type: 'digging-hole-created',
        x,
        y,
        duration: DIGGING_CONSTANTS.HOLE_DURATION,
        timestamp: Date.now()
      }));
    }
  }
  
  console.log(`Created digging hole at (${x}, ${y})`);
}

// Remove a digging hole
function removeDiggingHole(x, y) {
  const holeKey = `${x},${y}`;
  if (diggingHoles.has(holeKey)) {
    diggingHoles.delete(holeKey);
    
    // Remove visual hole element
    removeVisualHole(x, y);
    
    // Sync with server if online
    if (window.isUserOnline && window.isUserOnline() && window.getWebSocket) {
      const websocket = window.getWebSocket();
      if (websocket && websocket.readyState === WebSocket.OPEN) {
        websocket.send(JSON.stringify({
          type: 'digging-hole-removed',
          x,
          y,
          timestamp: Date.now()
        }));
      }
    }
    
    console.log(`Removed digging hole at (${x}, ${y})`);
  }
}

// Sync digging holes from server
function syncDiggingHolesFromServer(serverHoles) {
  console.log('Syncing digging holes from server:', serverHoles);
  
  // Clear existing holes and their visuals
  diggingHoles.forEach((hole, key) => {
    removeVisualHole(hole.x, hole.y);
  });
  diggingHoles.clear();
  
  // Add server holes
  for (const hole of serverHoles) {
    const holeKey = `${hole.x},${hole.y}`;
    const timeRemaining = hole.expiresAt - Date.now();
    
    if (timeRemaining > 0) {
      diggingHoles.set(holeKey, hole);
      
      // Create visual hole
      createVisualHole(hole.x, hole.y);
      
      // Set timeout for remaining time
      setTimeout(() => {
        removeDiggingHole(hole.x, hole.y);
      }, timeRemaining);
    }
  }
}

// Handle server messages about digging holes
function handleDiggingHoleMessage(data) {
  switch (data.type) {
    case 'digging-hole-created':
      if (!diggingHoles.has(`${data.x},${data.y}`)) {
        const timeRemaining = data.duration - (Date.now() - data.timestamp);
        if (timeRemaining > 0) {
          const holeData = {
            x: data.x,
            y: data.y,
            createdAt: data.timestamp,
            expiresAt: data.timestamp + data.duration
          };
          diggingHoles.set(`${data.x},${data.y}`, holeData);
          
          // Create visual hole
          createVisualHole(data.x, data.y);
          
          setTimeout(() => {
            removeDiggingHole(data.x, data.y);
          }, timeRemaining);
        }
      }
      break;
    case 'digging-hole-removed':
      removeDiggingHole(data.x, data.y);
      break;
  }
}

// Check if position has a digging hole
function hasDiggingHole(x, y) {
  return diggingHoles.has(`${x},${y}`);
}

// Get all active digging holes
function getActiveDiggingHoles() {
  return Array.from(diggingHoles.values());
}

// Create visual hole element in the world
function createVisualHole(x, y) {
  const worldElement = document.getElementById('game-world');
  if (!worldElement) {
    console.warn('Game world element not found, cannot create visual hole');
    return;
  }
  
  // Create hole element
  const holeElement = document.createElement('div');
  holeElement.className = 'digging-hole';
  holeElement.id = `digging-hole-${x}-${y}`;
  holeElement.style.cssText = `
    position: absolute;
    width: 32px;
    height: 32px;
    font-size: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    z-index: 6;
    text-shadow: 1px 1px 1px #000000, -1px -1px 1px #000000, 1px -1px 1px #000000, -1px 1px 1px #000000;
  `;
  
  holeElement.textContent = '🕳️';
  holeElement.title = 'Dug hole (temporary)';
  
  // Store world coordinates for camera updates
  holeElement.dataset.worldX = x;
  holeElement.dataset.worldY = y;
  
  // Position will be updated by the world rendering system
  // For now, position it based on current camera position
  if (window.worldModule?.getCameraPosition) {
    const camera = window.worldModule.getCameraPosition();
    const gridSize = window.worldModule?.getGridSize() || 32;
    
    const screenX = (x - camera.x) * gridSize;
    const screenY = (y - camera.y) * gridSize;
    
    holeElement.style.left = `${screenX}px`;
    holeElement.style.top = `${screenY}px`;
  }
  
  worldElement.appendChild(holeElement);
  console.log(`Created visual hole at (${x}, ${y})`);
}

// Remove visual hole element from the world
function removeVisualHole(x, y) {
  const holeElement = document.getElementById(`digging-hole-${x}-${y}`);
  if (holeElement && holeElement.parentNode) {
    holeElement.parentNode.removeChild(holeElement);
    console.log(`Removed visual hole at (${x}, ${y})`);
  }
}

// Export functions
export {
  initializeDigging,
  startDigging,
  cancelDigging,
  isDigging,
  handleMovementComplete,
  getActiveDiggingSession,
  handleShovelInteraction,
  syncDiggingHolesFromServer,
  handleDiggingHoleMessage,
  hasDiggingHole,
  getActiveDiggingHoles,
  SHOVEL_DEFINITIONS
}; 