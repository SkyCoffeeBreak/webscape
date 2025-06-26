/**
 * Cooking module for WebscapeRPG
 * Handles cooking mechanics, ranges, fish cooking, and experience
 */

import { addExperience } from '../skills.js';

// Cooking constants
const COOKING_CONSTANTS = {
  BASE_COOKING_TIME: 1800, // Base time in milliseconds for cooking (3x slower)
  ANIMATION_DURATION: 500, // Time between cooking animations
  BURN_CHANCE_BASE: 0.1, // Base chance to burn food (10%)
  BURN_REDUCTION_PER_LEVEL: 0.001 // Burn chance reduction per level
};

// Cooking range definitions
const COOKING_RANGE_DEFINITIONS = {
  'cooking_range': {
    name: 'Cooking Range',
    icon: '🔥',
    level: 1,
    description: 'Used to cook raw food'
  },
  'cooking_fire': {
    name: 'Cooking Fire',
    icon: '🔥',
    level: 1,
    description: 'Used to cook raw food'
  }
};

// Cooking recipes - what raw foods can be cooked
const COOKING_RECIPES = {
  'raw_shrimps': {
    name: 'Shrimp',
    resultItem: 'shrimps',
    resultQuantity: 1,
    experience: 30,
    level: 1,
    processingTime: 1800,
    burnLevel: 34 // Level where you stop burning
  },
  'raw_sardine': {
    name: 'Sardine',
    resultItem: 'sardine',
    resultQuantity: 1,
    experience: 40,
    level: 1,
    processingTime: 1800,
    burnLevel: 38
  },
  'raw_herring': {
    name: 'Herring',
    resultItem: 'herring',
    resultQuantity: 1,
    experience: 50,
    level: 5,
    processingTime: 1800,
    burnLevel: 41
  },
  'raw_anchovies': {
    name: 'Anchovies',
    resultItem: 'anchovies',
    resultQuantity: 1,
    experience: 30,
    level: 1,
    processingTime: 1800,
    burnLevel: 34
  },
  'raw_tuna': {
    name: 'Tuna',
    resultItem: 'tuna',
    resultQuantity: 1,
    experience: 100,
    level: 30,
    processingTime: 2100,
    burnLevel: 63
  },
  'raw_lobster': {
    name: 'Lobster',
    resultItem: 'lobster',
    resultQuantity: 1,
    experience: 120,
    level: 40,
    processingTime: 2100,
    burnLevel: 74
  },
  'raw_swordfish': {
    name: 'Swordfish',
    resultItem: 'swordfish',
    resultQuantity: 1,
    experience: 140,
    level: 45,
    processingTime: 2400,
    burnLevel: 86
  },
  'raw_shark': {
    name: 'Shark',
    resultItem: 'shark',
    resultQuantity: 1,
    experience: 210,
    level: 80,
    processingTime: 2700,
    burnLevel: 99
  }
};

// Global cooking state
let cookingQueue = {};
let activeCookingSessions = {};
let cookingAnimationInterval = null;

// Initialize cooking module
function initializeCooking() {
  console.log('Initializing cooking module...');
  // Note: Event handlers are now managed by world.js applyObjectStyling function
}

// Handle cooking range click
function handleCookingRangeClick(rangeType, x, y, rangeElement) {
  console.log(`COOKING RANGE CLICK: ${rangeType} at (${x}, ${y})`);
  
  // Get player position and check distance
  const playerPos = window.worldModule?.getPlayerPosition();
  if (!playerPos) {
    console.error('COOKING RANGE CLICK: Could not get player position');
    return;
  }
  
  const playerX = Math.floor(playerPos.x);
  const playerY = Math.floor(playerPos.y);
  
  // Use Chebyshev distance (OSRS-style) - allows diagonal interactions
  const dx = Math.abs(playerX - x);
  const dy = Math.abs(playerY - y);
  const distance = Math.max(dx, dy);
  console.log(`COOKING RANGE CLICK: Distance to range (Chebyshev): ${distance}`);
  
  if (distance > 1) {
    // Too far - move closer
    console.log('COOKING RANGE CLICK: Too far from range, moving closer');
    
    // Store range target for interaction after movement
    window.cookingTarget = {
      rangeType: rangeType,
      x: x,
      y: y,
      element: rangeElement
    };
    
    // Set a general interaction target for the world movement handler
    window.interactionTarget = {
      type: 'cooking',
      rangeType: rangeType,
      x: x,
      y: y,
      element: rangeElement
    };
    
    // Use pathfinding to get adjacent to the range
    if (window.worldModule?.movePlayerToInteractiveTarget) {
      window.worldModule.movePlayerToInteractiveTarget(x, y);
    } else {
      console.error('COOKING RANGE CLICK: movePlayerToInteractiveTarget not available');
    }
    return;
  }
  
  // Close enough - open cooking interface directly
  showCookingInterface(rangeType, x, y, rangeElement);
}

// Handle cooking range click from world module (legacy support)
function handleCookingRangeClickFromWorld(rangeType, x, y, rangeElement) {
  showCookingInterface(rangeType, x, y, rangeElement);
}

// Show cooking interface
function showCookingInterface(rangeType, x, y, rangeElement) {
  console.log(`Showing cooking interface for ${rangeType}`);
  
  // Cancel any existing cooking
  if (window.isCooking && window.isCooking()) {
    cancelCooking();
  }
  
  // Close any existing interfaces
  closeCookingInterface();
  
  console.log('COOKING DEBUG: About to create cooking interface element');
  
  // Create cooking interface
  const interfaceDiv = document.createElement('div');
  interfaceDiv.id = 'cooking-interface';
  interfaceDiv.className = 'cooking-interface';
  interfaceDiv.innerHTML = `
    <div class="cooking-header">
      <h3>${COOKING_RANGE_DEFINITIONS[rangeType].name}</h3>
      <button class="close-btn" onclick="window.cookingModule.closeCookingInterface()">&times;</button>
    </div>
    <div class="cooking-content">
      <div class="cooking-recipes" id="cooking-recipes">
        <!-- Recipes will be populated here -->
      </div>
    </div>
    <div class="cooking-status" id="cooking-status" style="display: none;">
      <div class="cooking-progress">
        <div class="progress-bar" id="cooking-progress-bar"></div>
      </div>
      <div class="cooking-info">
        <span id="cooking-current-item"></span>
        <span id="cooking-remaining"></span>
      </div>
      <button class="cancel-cooking-btn" onclick="window.cookingModule.cancelCooking()">Cancel</button>
    </div>
  `;
  
  document.body.appendChild(interfaceDiv);
  console.log('COOKING DEBUG: Interface added to DOM, checking if visible');
  
  // Populate recipes
  const userModule = window.userModule;
  const inventoryModule = window.inventoryModule;
  if (userModule && inventoryModule) {
    console.log('COOKING DEBUG: User and inventory modules found, populating recipes');
    const inventory = inventoryModule.playerInventory || [];
    const profile = userModule.getProfile();
    const playerLevel = profile && profile.skills ? profile.skills.cooking : 1;
    console.log('COOKING DEBUG: Player level:', playerLevel, 'Inventory items:', inventory.length);
    populateCookingRecipes(inventory, playerLevel, x, y, rangeElement);
  } else {
    console.error('COOKING DEBUG: Required modules not found!', { userModule: !!userModule, inventoryModule: !!inventoryModule });
  }
  
  // Handle escape key
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      closeCookingInterface();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  
  document.addEventListener('keydown', handleEscape);
}

// Populate cooking recipes based on inventory
function populateCookingRecipes(inventory, playerLevel, x, y, rangeElement) {
  const recipesContainer = document.getElementById('cooking-recipes');
  if (!recipesContainer) return;
  
  recipesContainer.innerHTML = '';
  
  let hasValidRecipes = false;
  
  Object.entries(COOKING_RECIPES).forEach(([rawItem, recipe]) => {
    // Check if player has required level
    if (playerLevel < recipe.level) return;
    
    // Check if player has the raw item
    const availableQuantity = calculateAvailableItems(rawItem);
    if (availableQuantity === 0) return;
    
    hasValidRecipes = true;
    
    // Get item definition for icon
    const itemDef = window.inventoryModule ? window.inventoryModule.getItemDefinition(rawItem) : null;
    const rawIcon = itemDef ? (itemDef.getIcon ? itemDef.getIcon(1) : itemDef.icon) : '🍖';
    
    // Get cooked item definition for icon
    const cookedItemDef = window.inventoryModule ? window.inventoryModule.getItemDefinition(recipe.resultItem) : null;
    const cookedIcon = cookedItemDef ? (cookedItemDef.getIcon ? cookedItemDef.getIcon(1) : cookedItemDef.icon) : '🍗';
    
    const recipeDiv = document.createElement('div');
    recipeDiv.className = 'cooking-recipe';
    recipeDiv.innerHTML = `
      <div class="recipe-info">
        <div class="recipe-icons">
          <span class="raw-icon" title="${itemDef ? itemDef.name : rawItem}">${rawIcon}</span>
          <span class="arrow">→</span>
          <span class="cooked-icon" title="${cookedItemDef ? cookedItemDef.name : recipe.name}">${cookedIcon}</span>
        </div>
        <span class="recipe-name">${recipe.name}</span>
        <span class="recipe-level">Level ${recipe.level}</span>
        <span class="recipe-xp">+${recipe.experience} XP</span>
        <span class="recipe-quantity">Available: ${availableQuantity}</span>
      </div>
      <div class="recipe-actions">
        <button onclick="window.cookingModule.startCooking('${rawItem}', ${x}, ${y}, 1)">Cook 1</button>
        <button onclick="window.cookingModule.startCooking('${rawItem}', ${x}, ${y}, 5)">Cook 5</button>
        <button onclick="window.cookingModule.startCooking('${rawItem}', ${x}, ${y}, ${availableQuantity})">Cook All</button>
      </div>
    `;
    
    recipesContainer.appendChild(recipeDiv);
  });
  
  if (!hasValidRecipes) {
    recipesContainer.innerHTML = '<div class="no-recipes">No raw food available to cook.</div>';
  }
}

// Calculate available items in inventory
function calculateAvailableItems(itemId) {
  const inventoryModule = window.inventoryModule;
  if (!inventoryModule || !inventoryModule.playerInventory) return 0;
  
  const inventory = inventoryModule.playerInventory;
  let count = 0;
  
  inventory.forEach(slot => {
    if (slot && slot.id === itemId) {
      count += slot.quantity || 1;
    }
  });
  
  return count;
}

// Find item in inventory
function findItemInInventory(itemId) {
  const inventoryModule = window.inventoryModule;
  if (!inventoryModule || !inventoryModule.playerInventory) return null;
  
  const inventory = inventoryModule.playerInventory;
  for (let i = 0; i < inventory.length; i++) {
    if (inventory[i] && inventory[i].id === itemId) {
      return { slot: i, item: inventory[i] };
    }
  }
  return null;
}

// Start cooking
function startCooking(rawItemType, x, y, quantity = 1) {
  console.log(`Starting cooking: ${rawItemType} x${quantity}`);
  
  const recipe = COOKING_RECIPES[rawItemType];
  if (!recipe) {
    console.error('Invalid cooking recipe:', rawItemType);
    return;
  }
  
  const userModule = window.userModule;
  if (!userModule) return;
  
  const profile = userModule.getProfile();
  const playerLevel = profile && profile.skills ? profile.skills.cooking : 1;
  if (playerLevel < recipe.level) {
    showCookingMessage('You need level ' + recipe.level + ' Cooking to cook this.', 'error');
    return;
  }
  
  // Check available quantity
  const availableQuantity = calculateAvailableItems(rawItemType);
  const actualQuantity = Math.min(quantity, availableQuantity);
  
  if (actualQuantity === 0) {
    showCookingMessage('You don\'t have any raw ' + recipe.name.toLowerCase() + ' to cook.', 'error');
    return;
  }
  
  // Start cooking queue
  startCookingQueue(rawItemType, recipe, x, y, actualQuantity);
}

// Start cooking queue
function startCookingQueue(rawItemType, recipe, x, y, quantity) {
  const playerId = 'player';
  
  cookingQueue[playerId] = {
    rawItemType: rawItemType,
    recipe: recipe,
    x: x,
    y: y,
    totalQuantity: quantity,
    remainingQuantity: quantity,
    startTime: Date.now(),
    currentItemStartTime: Date.now()
  };
  
  activeCookingSessions[playerId] = true;
  
  // Show skill bubble for cooking
  if (window.showSkillBubble) {
    window.showSkillBubble('cooking');
  }
  
  // Sync cooking action with multiplayer server for skill bubble display
  if (window.multiplayerModule && window.multiplayerModule.syncActionBubbleShow) {
    window.multiplayerModule.syncActionBubbleShow('cooking');
  }
  
  // Show cooking status
  const statusDiv = document.getElementById('cooking-status');
  const recipesDiv = document.getElementById('cooking-recipes');
  if (statusDiv && recipesDiv) {
    recipesDiv.style.display = 'none';
    statusDiv.style.display = 'block';
    
    updateCookingStatus(playerId);
  }
  
  // Start processing
  processCookingQueue(playerId);
  startCookingAnimation();
  
  showCookingMessage(`Started cooking ${quantity} ${recipe.name.toLowerCase()}...`, 'info');
}

// Process cooking queue
function processCookingQueue(playerId) {
  const session = cookingQueue[playerId];
  if (!session) return;
  
  const currentTime = Date.now();
  const timeElapsed = currentTime - session.currentItemStartTime;
  
  if (timeElapsed >= session.recipe.processingTime) {
    // Complete current item
    completeCooking(playerId);
  } else {
    // Update progress
    updateCookingStatus(playerId);
    // Schedule next check
    setTimeout(() => processCookingQueue(playerId), 100);
  }
}

// Complete cooking
function completeCooking(playerId) {
  const session = cookingQueue[playerId];
  if (!session) return;
  
  const userModule = window.userModule;
  if (!userModule) return;
  
  // Find raw item in inventory
  const itemSlot = findItemInInventory(session.rawItemType);
  if (!itemSlot) {
    // No more raw items, finish cooking
    finishCooking(playerId);
    return;
  }
  
  // Remove raw item (decrease quantity by 1)
  const inventoryModule = window.inventoryModule;
  if (inventoryModule && inventoryModule.removeItemFromInventory) {
    inventoryModule.removeItemFromInventory(itemSlot.slot);
  }
  
  // Calculate if food burns - OSRS-style burn rate
  const profile = userModule.getProfile();
  const playerLevel = profile && profile.skills ? profile.skills.cooking : 1;
  
  // More reasonable burn rate formula based on OSRS
  // At required level: ~15% burn rate, decreasing by ~1% per level
  // At burn level: 0% burn rate
  let burnChance = 0;
  if (playerLevel < session.recipe.burnLevel) {
    const levelDiff = session.recipe.burnLevel - playerLevel;
    const requiredLevelDiff = session.recipe.burnLevel - session.recipe.level;
    
    // Base burn rate at required level (15%), scaling up for lower levels
    if (playerLevel >= session.recipe.level) {
      // Player can cook this item - reasonable burn rate
      burnChance = Math.max(0, 0.15 * (levelDiff / requiredLevelDiff));
    } else {
      // Player is below required level - higher burn rate
      const belowRequiredBy = session.recipe.level - playerLevel;
      burnChance = Math.min(0.8, 0.15 + (belowRequiredBy * 0.1)); // Cap at 80%
    }
  }
  
  const burns = Math.random() < burnChance;
  
  // Debug burn rate calculation
  console.log(`COOKING: ${session.recipe.name} - Level: ${playerLevel}, Required: ${session.recipe.level}, Burn Level: ${session.recipe.burnLevel}, Burn Chance: ${(burnChance * 100).toFixed(1)}%, Burns: ${burns}`);
  
  let resultItem = session.recipe.resultItem;
  let message = '';
  
  if (burns && playerLevel < session.recipe.burnLevel) {
    // Food burned
    resultItem = 'burnt_food'; // You might want to add this item to definitions
    message = `You burned the ${session.recipe.name.toLowerCase()}!`;
  } else {
    // Successfully cooked
    message = `You cook the ${session.recipe.name.toLowerCase()}.`;
    
    // Add experience - use the same pattern as mining/woodcutting
    const profile = userModule.getProfile();
    if (profile) {
      console.log(`🍳 Cooking: Adding ${session.recipe.experience} XP to cooking skill`);
      console.log(`🍳 Cooking: Before - Level: ${profile.skills.cooking}, XP: ${profile.skillsExp.cooking || 0}`);
      
      const leveledUp = addExperience('cooking', session.recipe.experience, profile.skills, profile.skillsExp);
      
      console.log(`🍳 Cooking: After - Level: ${profile.skills.cooking}, XP: ${profile.skillsExp.cooking || 0}, Leveled up: ${leveledUp}`);
      
      // Update UI
      if (window.uiModule && window.uiModule.updateSkillDisplay) {
        console.log(`🍳 Cooking: Calling updateSkillDisplay for cooking`);
        window.uiModule.updateSkillDisplay('cooking', profile.skills.cooking, leveledUp);
        if (leveledUp) {
          window.uiModule.updateTotalLevel(profile.skills);
        }
      }
      
      // Update experience bar with visual feedback
      if (window.uiModule && window.uiModule.updateSkillExperienceBar) {
        console.log(`🍳 Cooking: Calling updateSkillExperienceBar for cooking`);
        window.uiModule.updateSkillExperienceBar('cooking');
        
        // Add visual feedback for experience gain
        const skillElement = document.querySelector(`[data-skill="cooking"]`);
        if (skillElement) {
          const expFill = skillElement.querySelector('.skill-exp-fill');
          if (expFill) {
            console.log(`🍳 Cooking: Adding visual feedback animation`);
            expFill.classList.add('exp-gain');
            setTimeout(() => {
              expFill.classList.remove('exp-gain');
            }, 600);
          } else {
            console.warn(`🍳 Cooking: No exp-fill element found for visual feedback`);
          }
        } else {
          console.warn(`🍳 Cooking: No skill element found for cooking`);
        }
      } else {
        console.warn(`🍳 Cooking: updateSkillExperienceBar function not available`);
      }
      
      // Save profile
      if (userModule.saveProfile) {
        userModule.saveProfile();
      }
      
      // Sync skills with server if online
      if (window.syncSkillsWithServer && window.isUserOnline && window.isUserOnline()) {
        const totalLevel = window.calculateTotalLevel ? window.calculateTotalLevel(profile.skills) : 0;
        const combatLevel = window.calculateCombatLevel ? window.calculateCombatLevel(profile.skills) : 0;
        window.syncSkillsWithServer(profile.skills, totalLevel, combatLevel, profile.skillsExp);
      }
      
      if (leveledUp) {
        showCookingMessage(`Level up! Your Cooking level is now ${profile.skills.cooking}!`, 'success');
      }
    }
  }
  
  // Add result item to inventory
  if (inventoryModule) {
    inventoryModule.addItemToInventory(resultItem, session.recipe.resultQuantity);
  }
  
  showCookingMessage(message, burns ? 'error' : 'success');
  
  // Decrease remaining quantity
  session.remainingQuantity--;
  session.currentItemStartTime = Date.now();
  
  if (session.remainingQuantity > 0) {
    // Continue cooking
    updateCookingStatus(playerId);
    processCookingQueue(playerId);
  } else {
    // Finished all items
    finishCooking(playerId);
  }
}

// Finish cooking session
function finishCooking(playerId) {
  delete cookingQueue[playerId];
  delete activeCookingSessions[playerId];
  
  stopCookingAnimation();
  
  // Hide skill bubble
  if (window.hideSkillBubble) {
    window.hideSkillBubble();
  }
  
  // Sync skill bubble hide with multiplayer server
  if (window.multiplayerModule && window.multiplayerModule.syncActionBubbleHide) {
    window.multiplayerModule.syncActionBubbleHide();
  }
  
  // Hide status, show recipes again
  const statusDiv = document.getElementById('cooking-status');
  const recipesDiv = document.getElementById('cooking-recipes');
  if (statusDiv && recipesDiv) {
    statusDiv.style.display = 'none';
    recipesDiv.style.display = 'block';
    
    // Refresh recipes
    const userModule = window.userModule;
    const inventoryModule = window.inventoryModule;
    if (userModule && inventoryModule) {
      const inventory = inventoryModule.playerInventory || [];
      const profile = userModule.getProfile();
      const playerLevel = profile && profile.skills ? profile.skills.cooking : 1;
      // You'll need to get the range info from the session
      populateCookingRecipes(inventory, playerLevel, 0, 0, null);
    }
  }
  
  showCookingMessage('Finished cooking.', 'info');
}

// Update cooking status display
function updateCookingStatus(playerId) {
  const session = cookingQueue[playerId];
  if (!session) return;
  
  const currentTime = Date.now();
  const timeElapsed = currentTime - session.currentItemStartTime;
  const progress = Math.min(100, (timeElapsed / session.recipe.processingTime) * 100);
  
  const progressBar = document.getElementById('cooking-progress-bar');
  const currentItem = document.getElementById('cooking-current-item');
  const remaining = document.getElementById('cooking-remaining');
  
  if (progressBar) {
    progressBar.style.width = progress + '%';
  }
  
  if (currentItem) {
    // Get item icons for status display
    const rawItemDef = window.inventoryModule ? window.inventoryModule.getItemDefinition(session.rawItemType) : null;
    const rawIcon = rawItemDef ? (rawItemDef.getIcon ? rawItemDef.getIcon(1) : rawItemDef.icon) : '🍖';
    
    const cookedItemDef = window.inventoryModule ? window.inventoryModule.getItemDefinition(session.recipe.resultItem) : null;
    const cookedIcon = cookedItemDef ? (cookedItemDef.getIcon ? cookedItemDef.getIcon(1) : cookedItemDef.icon) : '🍗';
    
    currentItem.innerHTML = `<span class="cooking-status-icons">${rawIcon} → ${cookedIcon}</span> Cooking ${session.recipe.name}`;
  }
  
  if (remaining) {
    remaining.textContent = `${session.remainingQuantity} remaining`;
  }
}

// Close cooking interface
function closeCookingInterface() {
  const cookingInterface = document.getElementById('cooking-interface');
  if (cookingInterface) {
    cookingInterface.remove();
  }
  
  // Clear interaction target
  window.interactionTarget = null;
}

// Start cooking animation
function startCookingAnimation() {
  if (cookingAnimationInterval) return;
  
  cookingAnimationInterval = setInterval(() => {
    // Add cooking animation effects here if desired
  }, COOKING_CONSTANTS.ANIMATION_DURATION);
}

// Stop cooking animation
function stopCookingAnimation() {
  if (cookingAnimationInterval) {
    clearInterval(cookingAnimationInterval);
    cookingAnimationInterval = null;
  }
}

// Cancel cooking
function cancelCooking(playerId = 'player') {
  console.log('Cancelling cooking for player:', playerId);
  
  if (cookingQueue[playerId]) {
    delete cookingQueue[playerId];
  }
  
  if (activeCookingSessions[playerId]) {
    delete activeCookingSessions[playerId];
  }
  
  stopCookingAnimation();
  
  // Hide skill bubble
  if (window.hideSkillBubble) {
    window.hideSkillBubble();
  }
  
  // Sync skill bubble hide with multiplayer server
  if (window.multiplayerModule && window.multiplayerModule.syncActionBubbleHide) {
    window.multiplayerModule.syncActionBubbleHide();
  }
  
  // Hide status, show recipes again
  const statusDiv = document.getElementById('cooking-status');
  const recipesDiv = document.getElementById('cooking-recipes');
  if (statusDiv && recipesDiv) {
    statusDiv.style.display = 'none';
    recipesDiv.style.display = 'block';
  }
  
  showCookingMessage('Cooking cancelled.', 'info');
  
  return true;
}

// Check if player is cooking
function isCooking(playerId = 'player') {
  return activeCookingSessions[playerId] === true;
}

// Show cooking message
function showCookingMessage(message, type = 'info') {
  console.log(`COOKING ${type.toUpperCase()}: ${message}`);
  
  // You can integrate with your existing message system here
  if (window.chatModule && window.chatModule.addMessage) {
    window.chatModule.addMessage(`[Cooking] ${message}`, 'game');
  }
}

// Handle movement completion
function handleMovementComplete() {
  if (window.interactionTarget && window.interactionTarget.type === 'cooking') {
    const target = window.interactionTarget;
    handleCookingRangeClickFromWorld(target.rangeType, target.x, target.y, target.element);
    window.interactionTarget = null;
  }
}

// Get active cooking session
function getActiveCookingSession(playerId = 'player') {
  return cookingQueue[playerId] || null;
}

// Export functions
window.cookingModule = {
  initializeCooking,
  handleMovementComplete,
  startCooking,
  cancelCooking,
  isCooking,
  closeCookingInterface,
  getActiveCookingSession,
  handleCookingRangeClick,
  showCookingInterface,
  COOKING_RECIPES,
  COOKING_RANGE_DEFINITIONS,
  
  // Summary function to show what's available
  getCookingSummary: () => {
    const recipes = Object.keys(COOKING_RECIPES);
    const ranges = Object.keys(COOKING_RANGE_DEFINITIONS);
    
    return {
      totalRecipes: recipes.length,
      recipes: recipes,
      totalRanges: ranges.length,
      ranges: ranges,
      features: [
        'Cooking interface with beautiful styling',
        'Real-time progress tracking',
        'Experience gain and skill bubbles',
        'Burning mechanics based on level',
        'Support for both cooking ranges and fires',
        'Automatic cooking queue system',
        'Distance-based interaction with pathfinding',
        'Mobile-responsive design'
      ]
    };
  }
};

// Initialize when module loads
document.addEventListener('DOMContentLoaded', () => {
  initializeCooking();
});

export {
  initializeCooking,
  handleMovementComplete,
  startCooking,
  cancelCooking,
  isCooking,
  closeCookingInterface,
  getActiveCookingSession,
  showCookingInterface,
  COOKING_RECIPES,
  COOKING_RANGE_DEFINITIONS
}; 