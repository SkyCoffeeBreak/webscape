/**
 * Harvesting skill module for WebscapeRPG
 * Handles harvesting of natural resources like fruit, mushrooms, and crops
 */

// Harvesting skill data
const HARVESTING_SKILL_ID = 'harvesting';

// Harvesting nodes configuration
const HARVESTING_NODES = {
  'apple_tree': {
    name: 'Apple Tree',
    baseIcon: '🌳',
    fruitIcon: '🍎',
    itemId: 'apple',
    levelRequired: 1,
    baseExperience: 25,
    harvestTime: 6000, // 6 seconds (doubled from 3)
    respawnTime: 60000, // 1 minute
    maxResources: 6,
    maxVisibleFruit: 3
  },
  'cherry_tree': {
    name: 'Cherry Tree',
    baseIcon: '🌳',
    fruitIcon: '🍒',
    itemId: 'cherry',
    levelRequired: 15,
    baseExperience: 40,
    harvestTime: 7000, // 7 seconds (doubled from 3.5)
    respawnTime: 75000, // 1.25 minutes
    maxResources: 6,
    maxVisibleFruit: 3
  },
  'peach_tree': {
    name: 'Peach Tree',
    baseIcon: '🌳',
    fruitIcon: '🍑',
    itemId: 'peach',
    levelRequired: 30,
    baseExperience: 60,
    harvestTime: 8000, // 8 seconds (doubled from 4)
    respawnTime: 90000, // 1.5 minutes
    maxResources: 6,
    maxVisibleFruit: 3
  },
  'mushroom_patch': {
    name: 'Mushroom Patch',
    baseIcon: '🍄',
    fruitIcon: '🍄',
    itemId: 'mushroom',
    levelRequired: 10,
    baseExperience: 35,
    harvestTime: 5000, // 5 seconds (doubled from 2.5)
    respawnTime: 45000, // 45 seconds
    maxResources: 4,
    maxVisibleFruit: 4
  },
  'wheat_field': {
    name: 'Wheat Field',
    baseIcon: '🌾',
    fruitIcon: '🌾',
    itemId: 'wheat',
    levelRequired: 5,
    baseExperience: 30,
    harvestTime: 4000, // 4 seconds (doubled from 2)
    respawnTime: 50000, // 50 seconds
    maxResources: 8,
    maxVisibleFruit: 3
  }
};

// Active harvesting sessions
let activeHarvesting = new Map();
let harvestingIntervals = new Map();

// Global state for depleted nodes
if (!window.depletedHarvestingStates) {
  window.depletedHarvestingStates = new Map();
}

// Node resource counts
let harvestingNodeResources = new Map();

// Initialize harvesting skill
function initializeHarvesting() {
  console.log('Initializing Harvesting skill module...');
  
  // Make functions globally available
  window.harvestingModule = {
    startHarvesting,
    cancelHarvesting,
    isHarvesting,
    handleMovementComplete,
    getHarvestingNodes: () => HARVESTING_NODES,
    renderHarvestingNode,
    getNodeResourceCount,
    setNodeResourceCount
  };
  
  // Make global functions available for world integration
  window.startHarvesting = startHarvesting;
  window.cancelHarvesting = cancelHarvesting;
  window.isHarvesting = isHarvesting;
  window.activeHarvesting = activeHarvesting;
  
  console.log('Harvesting skill module initialized');
}

// Start harvesting a node
function startHarvesting(nodeType, nodeX, nodeY, nodeElement) {
  console.log(`Starting harvesting: ${nodeType} at (${nodeX}, ${nodeY})`);
  
  // Check if player has required level
  const nodeConfig = HARVESTING_NODES[nodeType];
  if (!nodeConfig) {
    console.error(`Unknown harvesting node type: ${nodeType}`);
    return;
  }
  
  // Get player level from profile like other skills do
  const profile = window.userModule?.getProfile();
  const playerLevel = profile?.skills?.[HARVESTING_SKILL_ID] || 1;
  
  if (playerLevel < nodeConfig.levelRequired) {
    if (window.uiModule && window.uiModule.showNotification) {
      window.uiModule.showNotification(`You need level ${nodeConfig.levelRequired} Harvesting to harvest ${nodeConfig.name}.`, 'error');
    }
    return;
  }
  
  // Check if node is depleted
  const nodeKey = `${nodeX},${nodeY}`;
  const resourceCount = getNodeResourceCount(nodeKey, nodeType);
  
  if (resourceCount <= 0) {
    if (window.uiModule && window.uiModule.showNotification) {
      window.uiModule.showNotification(`The ${nodeConfig.name} is depleted. Wait for it to regrow.`, 'info');
    }
    return;
  }
  
  // Cancel any existing harvesting
  if (activeHarvesting.has('player')) {
    cancelHarvesting();
  }
  
  // Start new harvesting session
  const harvestingSession = {
    nodeType: nodeType,
    nodeConfig: nodeConfig,
    x: nodeX,
    y: nodeY,
    element: nodeElement,
    startTime: Date.now(),
    duration: nodeConfig.harvestTime
  };
  
  activeHarvesting.set('player', harvestingSession);
  
  // Show skill bubble instead of custom interface
  if (window.showSkillBubble) {
    window.showSkillBubble('harvesting');
  }
  
  // Sync harvesting action with multiplayer server
  if (window.multiplayerModule && window.multiplayerModule.sendResourceActionRequest) {
    window.multiplayerModule.sendResourceActionRequest(nodeType, nodeX, nodeY, 'harvesting');
  }
  
  // Start progress tracking
  const intervalId = setInterval(() => {
    updateHarvestingProgress(harvestingSession);
  }, 100);
  
  harvestingIntervals.set('player', intervalId);
  
  console.log(`Harvesting started: ${nodeType} (${nodeConfig.harvestTime}ms)`);
}

// Cancel harvesting
function cancelHarvesting() {
  if (!activeHarvesting.has('player')) {
    return;
  }
  
  console.log('Cancelling harvesting');
  
  // Clear interval
  const intervalId = harvestingIntervals.get('player');
  if (intervalId) {
    clearInterval(intervalId);
    harvestingIntervals.delete('player');
  }
  
  // Remove session
  activeHarvesting.delete('player');
  
  // Hide skill bubble
  if (window.hideSkillBubble) {
    window.hideSkillBubble();
  }
  
  console.log('Harvesting cancelled');
}

// Check if player is harvesting
function isHarvesting() {
  return activeHarvesting.has('player');
}

// Handle movement completion for harvesting
function handleMovementComplete() {
  if (window.harvestingTarget) {
    console.log('Movement complete, starting harvesting...');
    const target = window.harvestingTarget;
    startHarvesting(target.nodeType, target.x, target.y, target.element);
    window.harvestingTarget = null;
  }
}

// Update harvesting progress (skill bubbles handle their own progress)
function updateHarvestingProgress(session) {
  const elapsed = Date.now() - session.startTime;
  const progress = Math.min(elapsed / session.duration, 1);
  
  // Check if harvest is complete
  if (progress >= 1) {
    completeHarvest(session);
  }
}

// Complete a harvest
function completeHarvest(session) {
  console.log('Harvest complete!');
  
  // Clear interval
  const intervalId = harvestingIntervals.get('player');
  if (intervalId) {
    clearInterval(intervalId);
    harvestingIntervals.delete('player');
  }
  
  // Give reward
  giveHarvestingReward(session);
  
  // Reduce node resources
  const nodeKey = `${session.x},${session.y}`;
  const currentResources = getNodeResourceCount(nodeKey, session.nodeType);
  const newResourceCount = Math.max(0, currentResources - 1);
  setNodeResourceCount(nodeKey, session.nodeType, newResourceCount);
  
  // Update visual representation
  if (session.element) {
    updateNodeVisual(session.element, session.nodeType, newResourceCount);
  }
  
  // Check if node is depleted
  if (newResourceCount <= 0) {
    handleNodeDepletion(session);
  } else {
    // Continue harvesting if resources remain
    console.log(`Resources remaining: ${newResourceCount}, continuing harvest...`);
    
    // Start next harvest cycle
    session.startTime = Date.now();
    
    const intervalId = setInterval(() => {
      updateHarvestingProgress(session);
    }, 100);
    
    harvestingIntervals.set('player', intervalId);
  }
}

// Give harvesting reward
function giveHarvestingReward(session) {
  const config = session.nodeConfig;
  
  // Add item to inventory
  if (window.inventoryModule && window.inventoryModule.addItemToInventory) {
    const success = window.inventoryModule.addItemToInventory(config.itemId, 1);
    if (success) {
      console.log(`Harvested 1x ${config.itemId}`);
      
      // Show notification
      if (window.uiModule && window.uiModule.showNotification) {
        const itemDef = window.inventoryModule.getItemDefinition(config.itemId);
        const itemName = itemDef ? itemDef.name : config.itemId;
        window.uiModule.showNotification(`You harvest ${itemName}.`, 'success');
      }
    } else {
      console.log('Inventory full - harvest failed');
      if (window.uiModule && window.uiModule.showNotification) {
        window.uiModule.showNotification('Your inventory is full!', 'error');
      }
      cancelHarvesting();
      return;
    }
  }
  
  // Add experience
  if (window.addExperience) {
    window.addExperience(HARVESTING_SKILL_ID, config.baseExperience);
    console.log(`Gained ${config.baseExperience} Harvesting experience`);
  }
}

// Handle node depletion
function handleNodeDepletion(session) {
  console.log(`Node depleted: ${session.nodeType} at (${session.x}, ${session.y})`);
  
  // Mark as depleted
  const nodeKey = `${session.x},${session.y}`;
  window.depletedHarvestingStates.set(nodeKey, {
    nodeType: session.nodeType,
    depletedTime: Date.now(),
    respawnTime: session.nodeConfig.respawnTime
  });
  
  // Update element appearance to depleted state
  if (session.element) {
    updateNodeVisual(session.element, session.nodeType, 0);
  }
  
  // Sync depletion with multiplayer server
  if (window.multiplayerModule && window.multiplayerModule.sendResourceDepletionRequest) {
    window.multiplayerModule.sendResourceDepletionRequest(session.nodeType, session.x, session.y, session.nodeType, session.nodeConfig.respawnTime);
  }
  
  // Start gradual regrowth instead of instant full respawn
  startGradualRegrowth(nodeKey, session.nodeType);
  
  // End harvesting session
  activeHarvesting.delete('player');
  
  // Hide skill bubble
  if (window.hideSkillBubble) {
    window.hideSkillBubble();
  }
  
  // Notify player
  if (window.uiModule && window.uiModule.showNotification) {
    window.uiModule.showNotification(`The ${session.nodeConfig.name} is depleted. It will regrow gradually.`, 'info');
  }
}

// Start gradual regrowth for a depleted node
function startGradualRegrowth(nodeKey, nodeType) {
  const nodeConfig = HARVESTING_NODES[nodeType];
  if (!nodeConfig) return;
  
  console.log(`Starting gradual regrowth for ${nodeType} at ${nodeKey}`);
  
  // Calculate time per resource (divide total respawn time by max resources)
  const timePerResource = Math.floor(nodeConfig.respawnTime / nodeConfig.maxResources);
  
  // Schedule gradual regrowth - one resource at a time
  let resourcesRegrown = 0;
  const regrowthInterval = setInterval(() => {
    resourcesRegrown++;
    const currentResources = getNodeResourceCount(nodeKey, nodeType);
    const newResourceCount = currentResources + 1;
    
    setNodeResourceCount(nodeKey, nodeType, newResourceCount);
    
    // Update visual
    const [x, y] = nodeKey.split(',').map(Number);
    const worldElement = document.getElementById('game-world');
    if (worldElement) {
      const nodeElement = worldElement.querySelector(`.world-object[data-type="${nodeType}"][data-x="${x}"][data-y="${y}"]`);
      if (nodeElement) {
        updateNodeVisual(nodeElement, nodeType, newResourceCount);
        console.log(`${nodeType} at (${x}, ${y}) regrew 1 resource (${newResourceCount}/${nodeConfig.maxResources})`);
      }
    }
    
    // Stop when fully regrown
    if (resourcesRegrown >= nodeConfig.maxResources) {
      clearInterval(regrowthInterval);
      window.depletedHarvestingStates.delete(nodeKey);
      
      // Sync respawn with multiplayer server
      const [x, y] = nodeKey.split(',').map(Number);
      if (window.multiplayerModule && window.multiplayerModule.syncResourceRespawned) {
        window.multiplayerModule.syncResourceRespawned(nodeType, x, y, nodeType);
      }
      
      console.log(`${nodeType} at ${nodeKey} fully regrown`);
    }
  }, timePerResource);
}

// Legacy respawn function - now used for instant full respawn if needed
function respawnNode(nodeKey, nodeType) {
  console.log(`Instantly respawning node: ${nodeType} at ${nodeKey}`);
  
  // Remove depleted state
  window.depletedHarvestingStates.delete(nodeKey);
  
  // Reset resource count
  const nodeConfig = HARVESTING_NODES[nodeType];
  if (nodeConfig) {
    setNodeResourceCount(nodeKey, nodeType, nodeConfig.maxResources);
    
    // Find and update the visual element
    const [x, y] = nodeKey.split(',').map(Number);
    const worldElement = document.getElementById('game-world');
    if (worldElement) {
      const nodeElement = worldElement.querySelector(`.world-object[data-type="${nodeType}"][data-x="${x}"][data-y="${y}"]`);
      if (nodeElement) {
        updateNodeVisual(nodeElement, nodeType, nodeConfig.maxResources);
        console.log(`Visual updated for respawned ${nodeType} at (${x}, ${y})`);
      }
    }
  }
}

// Get node resource count
function getNodeResourceCount(nodeKey, nodeType) {
  if (!harvestingNodeResources.has(nodeKey)) {
    // Initialize with max resources
    const nodeConfig = HARVESTING_NODES[nodeType];
    const maxResources = nodeConfig ? nodeConfig.maxResources : 6;
    harvestingNodeResources.set(nodeKey, maxResources);
    return maxResources;
  }
  return harvestingNodeResources.get(nodeKey);
}

// Set node resource count
function setNodeResourceCount(nodeKey, nodeType, count) {
  harvestingNodeResources.set(nodeKey, count);
  console.log(`Node ${nodeKey} resource count set to: ${count}`);
}

// Render a harvesting node with appropriate visual representation
function renderHarvestingNode(nodeType, resourceCount) {
  const nodeConfig = HARVESTING_NODES[nodeType];
  if (!nodeConfig) {
    return nodeConfig?.baseIcon || '❓';
  }
  
  // Special handling for fruit trees
  if (nodeType.endsWith('_tree')) {
    if (resourceCount <= 0) {
      return '🪾'; // Empty branch when depleted
    }
    
    const visibleFruit = Math.min(resourceCount, nodeConfig.maxVisibleFruit);
    const fruitEmojis = nodeConfig.fruitIcon.repeat(visibleFruit);
    return nodeConfig.baseIcon + fruitEmojis;
  }
  
  // For other nodes, show based on resource count
  if (resourceCount <= 0) {
    return '🪫'; // Empty/depleted indicator
  }
  
  const visibleItems = Math.min(resourceCount, nodeConfig.maxVisibleFruit);
  if (visibleItems <= 1) {
    return nodeConfig.baseIcon;
  }
  
  return nodeConfig.baseIcon + nodeConfig.fruitIcon.repeat(Math.max(0, visibleItems - 1));
}

// Update node visual representation
function updateNodeVisual(element, nodeType, resourceCount) {
  // Clear any previous styling that might interfere
  element.style.backgroundColor = '';
  element.style.border = '';
  element.style.borderRadius = '';
  
  // Use the world module's custom overlay rendering
  if (typeof window.renderHarvestingNodeWithOverlay === 'function') {
    window.renderHarvestingNodeWithOverlay(element, nodeType, resourceCount);
  } else {
    // Fallback to simple rendering
    const visual = renderHarvestingNode(nodeType, resourceCount);
    element.innerHTML = visual;
  }
  
  const nodeConfig = HARVESTING_NODES[nodeType];
  if (resourceCount <= 0) {
    element.title = `Depleted ${nodeConfig.name} (regrowing...)`;
    element.dataset.depleted = 'true';
  } else {
    element.title = `${nodeConfig.name} (${resourceCount} resources)`;
    element.dataset.depleted = 'false';
  }
  
  console.log(`Updated visual for ${nodeType}: (${resourceCount} resources)`);
}

// Custom interface functions removed - now using skill bubbles

// Initialize the module when loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeHarvesting);
} else {
  initializeHarvesting();
}

// Sync functions for multiplayer support
function syncHarvestingNodeDepleted(nodeType, x, y) {
  const nodeKey = `${x},${y}`;
  const nodeConfig = HARVESTING_NODES[nodeType];
  if (!nodeConfig) return;
  
  console.log(`Syncing depleted state for ${nodeType} at (${x}, ${y})`);
  
  // Mark as depleted
  window.depletedHarvestingStates.set(nodeKey, {
    nodeType: nodeType,
    depletedTime: Date.now(),
    respawnTime: nodeConfig.respawnTime
  });
  
  // Set resource count to 0
  setNodeResourceCount(nodeKey, nodeType, 0);
  
  // Update visual
  const worldElement = document.getElementById('game-world');
  if (worldElement) {
    const nodeElement = worldElement.querySelector(`.world-object[data-type="${nodeType}"][data-x="${x}"][data-y="${y}"]`);
    if (nodeElement) {
      updateNodeVisual(nodeElement, nodeType, 0);
    }
  }
  
  // Start gradual regrowth
  startGradualRegrowth(nodeKey, nodeType);
}

function syncHarvestingNodeRespawned(nodeType, x, y) {
  const nodeKey = `${x},${y}`;
  const nodeConfig = HARVESTING_NODES[nodeType];
  if (!nodeConfig) return;
  
  console.log(`Syncing respawned state for ${nodeType} at (${x}, ${y})`);
  
  // Remove depleted state
  window.depletedHarvestingStates.delete(nodeKey);
  
  // Reset resource count to maximum
  setNodeResourceCount(nodeKey, nodeType, nodeConfig.maxResources);
  
  // Update visual
  const worldElement = document.getElementById('game-world');
  if (worldElement) {
    const nodeElement = worldElement.querySelector(`.world-object[data-type="${nodeType}"][data-x="${x}"][data-y="${y}"]`);
    if (nodeElement) {
      updateNodeVisual(nodeElement, nodeType, nodeConfig.maxResources);
    }
  }
}

// Export functions for module system
export {
  initializeHarvesting,
  startHarvesting,
  cancelHarvesting,
  isHarvesting,
  handleMovementComplete,
  HARVESTING_NODES,
  renderHarvestingNode,
  syncHarvestingNodeDepleted,
  syncHarvestingNodeRespawned
}; 