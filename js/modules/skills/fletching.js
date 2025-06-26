/**
 * Fletching module for WebscapeRPG
 * Handles fletching mechanics, knife requirements, bow creation, and experience
 */

import { addExperience } from '../skills.js';
import { showSkillBubble, hideSkillBubble } from '../skillBubbles.js';

// Fletching constants
const FLETCHING_CONSTANTS = {
  BASE_FLETCHING_TIME: 3000, // Base time in milliseconds
  ANIMATION_DURATION: 1000, // Time between knife motions
};

// Bow definitions with fletching requirements
const BOW_DEFINITIONS = {
  'shortbow': {
    name: 'Shortbow',
    icon: '🏹',
    level: 1,
    experience: 25, // Increased from 5 for better progression
    logRequired: 'wooden_log',
    resultItem: 'shortbow'
  },
  'longbow': {
    name: 'Longbow', 
    icon: '🏹',
    level: 10,
    experience: 50, // Increased from 10 for better progression
    logRequired: 'wooden_log',
    resultItem: 'longbow'
  },
  'oak_shortbow': {
    name: 'Oak Shortbow',
    icon: '🏹',
    level: 20,
    experience: 82.5, // Increased from 16.5 (5x multiplier for better progression)
    logRequired: 'oak_log',
    resultItem: 'oak_shortbow'
  },
  'oak_longbow': {
    name: 'Oak Longbow',
    icon: '🏹',
    level: 25,
    experience: 125, // Increased from 25 (5x multiplier)
    logRequired: 'oak_log',
    resultItem: 'oak_longbow'
  },
  'willow_shortbow': {
    name: 'Willow Shortbow',
    icon: '🏹',
    level: 35,
    experience: 166.5, // Increased from 33.3 (5x multiplier)
    logRequired: 'pine_log', // Using pine as willow substitute
    resultItem: 'willow_shortbow'
  },
  'willow_longbow': {
    name: 'Willow Longbow',
    icon: '🏹',
    level: 40,
    experience: 207.5, // Increased from 41.5 (5x multiplier)
    logRequired: 'pine_log', // Using pine as willow substitute
    resultItem: 'willow_longbow'
  }
};

// Knife definitions with fletching requirements
const KNIFE_DEFINITIONS = {
  'wooden_knife': {
    name: 'Wooden Knife',
    level: 0,
    fletchingBonus: 0.00,
    color: '#A67C52',
    icon: '🪵'
  },
  'stone_knife': {
    name: 'Stone Knife',
    level: 0,
    fletchingBonus: 0.05,
    color: '#C0C0C0',
    icon: '🪨'
  },
  'copper_knife': {
    name: 'Copper Knife',
    level: 5,
    fletchingBonus: 0.12,
    color: '#D2691E',
    icon: '🥉'
  },
  'bronze_knife': {
    name: 'Bronze Knife',
    level: 10,
    fletchingBonus: 0.19,
    color: '#8B4513',
    icon: '🔪'
  },
  'iron_knife': {
    name: 'Iron Knife',
    level: 15,
    fletchingBonus: 0.26,
    color: '#808080',
    icon: '⚙️'
  },
  'steel_knife': {
    name: 'Steel Knife',
    level: 25,
    fletchingBonus: 0.33,
    color: '#B0B0B0',
    icon: '🛠️'
  },
  'darksteel_knife': {
    name: 'Darksteel Knife',
    level: 30,
    fletchingBonus: 0.40,
    color: '#505050',
    icon: '🌑'
  },
  'silver_knife': {
    name: 'Silver Knife',
    level: 35,
    fletchingBonus: 0.47,
    color: '#C0D6E4',
    icon: '🥈'
  },
  'gold_knife': {
    name: 'Gold Knife',
    level: 40,
    fletchingBonus: 0.54,
    color: '#FFD700',
    icon: '🥇'
  },
  'cobalt_knife': {
    name: 'Cobalt Knife',
    level: 50,
    fletchingBonus: 0.61,
    color: '#0047AB',
    icon: '🔵'
  },
  'titanium_knife': {
    name: 'Titanium Knife',
    level: 60,
    fletchingBonus: 0.68,
    color: '#001F3F',
    icon: '🔩'
  },
  'dragonbone_knife': {
    name: 'Dragonbone Knife',
    level: 65,
    fletchingBonus: 0.75,
    color: '#F5F5DC',
    icon: '🐉'
  },
  'meteor_knife': {
    name: 'Meteor Knife',
    level: 70,
    fletchingBonus: 0.82,
    color: '#6A0DAD',
    icon: '☄️'
  },
  'lunar_knife': {
    name: 'Lunar Knife',
    level: 80,
    fletchingBonus: 1.00,
    color: '#88E1F2',
    icon: '🌙'
  }
};

// Global state tracking
const activeFletchingSessions = new Map(); // Track active fletching sessions
const fletchingQueue = new Map(); // Track queued fletching actions per player

// Initialize fletching system
function initializeFletching() {
  console.log('Initializing fletching system...');
  
  // Add item combination handlers for knife + log interactions
  addFletchingInteractionHandlers();
  
  // Hook into the global item interaction system
  if (window.addEventListener) {
    window.addEventListener('itemInteraction', handleGlobalItemInteraction);
  }
  
  // Expose fletching functions globally for easier access
  window.fletchingModule = {
    initializeFletching,
    handleFletchingInteraction,
    startFletching,
    cancelFletching,
    isFletching,
    getActiveFletchingSession,
    BOW_DEFINITIONS,
    KNIFE_DEFINITIONS,
    // Expose the reusable crafting UI for other artisan skills
    showCraftingSelectionMenu
  };
  
  // Also expose the crafting UI globally for easy access by other skills
  window.showCraftingSelectionMenu = showCraftingSelectionMenu;
  
  console.log('Fletching system initialized');
}

// Handle global item interactions to catch knife + log combinations
function handleGlobalItemInteraction(event) {
  if (event.detail) {
    const { sourceItem, targetItem, sourceSlot, targetSlot } = event.detail;
    if (sourceItem && targetItem) {
      const handled = handlePotentialFletchingCombination(sourceItem, targetItem, sourceSlot, targetSlot);
      if (handled) {
        // Prevent the default "nothing interesting happens" message
        event.preventDefault();
        event.stopPropagation();
      }
    }
  }
}

// Add fletching interaction handlers to inventory system
function addFletchingInteractionHandlers() {
  // Register fletching combinations with the inventory system
  console.log('Fletching: Registering knife + log combinations');
  
  // Try to access and modify the inventory system's itemCombinations directly
  setTimeout(() => {
    // Wait a bit for inventory system to be initialized
    if (window.itemCombinations) {
      console.log('Fletching: Successfully accessed itemCombinations, registering combinations...');
      
      // Instead of registering every possible combination, register one combination per knife+log type
      // and let the fletching system handle showing the selection menu
      const registeredCombos = new Set(); // Track what we've already registered
      
      Object.keys(KNIFE_DEFINITIONS).forEach(knifeId => {
        // Get unique log types
        const uniqueLogTypes = [...new Set(Object.values(BOW_DEFINITIONS).map(bow => bow.logRequired))];
        
        uniqueLogTypes.forEach(logId => {
          const comboKey = `${knifeId}+${logId}`;
          const reverseComboKey = `${logId}+${knifeId}`;
          
          if (!registeredCombos.has(comboKey)) {
            // Register knife + log combination (only once per log type)
            window.itemCombinations[comboKey] = {
              result: null,
              requiresBoth: true,
              consumeSource: false,
              consumeTarget: false,
              message: `You examine the ${logId.replace('_', ' ')} with your ${knifeId.replace('_', ' ')}...`,
              customHandler: (sourceSlot, targetSlot) => {
                console.log(`Fletching: Custom handler called for ${knifeId} + ${logId}`);
                handleFletchingInteraction(knifeId, logId, sourceSlot, targetSlot);
                return true; // Indicate we handled this interaction
              }
            };
            
            // Register reverse combination
            window.itemCombinations[reverseComboKey] = {
              result: null,
              requiresBoth: true,
              consumeSource: false,
              consumeTarget: false,
              message: `You examine the ${logId.replace('_', ' ')} with your ${knifeId.replace('_', ' ')}...`,
              customHandler: (sourceSlot, targetSlot) => {
                console.log(`Fletching: Custom handler called for ${logId} + ${knifeId}`);
                handleFletchingInteraction(knifeId, logId, targetSlot, sourceSlot);
                return true; // Indicate we handled this interaction
              }
            };
            
            registeredCombos.add(comboKey);
            registeredCombos.add(reverseComboKey);
            console.log(`Fletching: Registered combinations for ${knifeId} + ${logId}`);
          }
        });
      });
      
      console.log('Fletching: Successfully registered all combinations with inventory system!');
    } else {
      console.warn('Fletching: Could not access itemCombinations, falling back to event listeners');
    }
  }, 500); // Wait 500ms for inventory to initialize
  
  // Fallback event listeners (in case direct access doesn't work)
  // Listen for item use events with high priority (capture phase)
  document.addEventListener('itemUsedOnItem', (event) => {
    const { sourceItem, targetItem, sourceSlot, targetSlot } = event.detail;
    const handled = handlePotentialFletchingCombination(sourceItem, targetItem, sourceSlot, targetSlot);
    if (handled) {
      console.log('Fletching: Successfully handled knife + log combination, preventing default');
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }
  }, true); // Use capture phase to handle before other listeners
  
  // Also listen in bubble phase as fallback
  document.addEventListener('itemUsedOnItem', (event) => {
    const { sourceItem, targetItem, sourceSlot, targetSlot } = event.detail;
    const handled = handlePotentialFletchingCombination(sourceItem, targetItem, sourceSlot, targetSlot);
    if (handled) {
      console.log('Fletching: Successfully handled knife + log combination (bubble phase), preventing default');
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }
  }, false);
}

// Handle potential fletching combinations
function handlePotentialFletchingCombination(sourceItem, targetItem, sourceSlot, targetSlot) {
  const knifeId = isKnife(sourceItem.id) ? sourceItem.id : (isKnife(targetItem.id) ? targetItem.id : null);
  const logId = isLog(sourceItem.id) ? sourceItem.id : (isLog(targetItem.id) ? targetItem.id : null);
  
  if (knifeId && logId) {
    const knifeSlot = isKnife(sourceItem.id) ? sourceSlot : targetSlot;
    const logSlot = isLog(sourceItem.id) ? sourceSlot : targetSlot;
    handleFletchingInteraction(knifeId, logId, knifeSlot, logSlot);
    return true; // Indicate that we handled this interaction
  }
  
  return false; // Indicate that we didn't handle this interaction
}

// Check if an item is a knife
function isKnife(itemId) {
  const isKnifeResult = KNIFE_DEFINITIONS.hasOwnProperty(itemId);
  console.log(`Fletching: Checking if ${itemId} is a knife: ${isKnifeResult}`);
  return isKnifeResult;
}

// Check if an item is a log
function isLog(itemId) {
  const isLogResult = Object.values(BOW_DEFINITIONS).some(bowDef => bowDef.logRequired === itemId);
  console.log(`Fletching: Checking if ${itemId} is a log: ${isLogResult}`);
  return isLogResult;
}

// Handle knife + log interaction
function handleFletchingInteraction(knifeId, logId, knifeSlot, logSlot) {
  console.log(`Fletching: Attempting to use ${knifeId} on ${logId}`);
  
  // Find possible bows for this log type
  const possibleBows = Object.entries(BOW_DEFINITIONS).filter(([bowType, bowDef]) => 
    bowDef.logRequired === logId
  );
  
  if (possibleBows.length === 0) {
    showFletchingMessage(`You cannot make anything from this log with that knife.`, 'error');
    return;
  }
  
  // Check player profile and skills
  const profile = window.userModule ? window.userModule.getProfile() : null;
  if (!profile) {
    showFletchingMessage('Could not access player profile.', 'error');
    return;
  }
  
  // Check knife requirements
  const knifeDef = KNIFE_DEFINITIONS[knifeId];
  if (profile.skills.fletching < knifeDef.level) {
    showFletchingMessage(`You need level ${knifeDef.level} Fletching to use this knife.`, 'error');
    return;
  }
  
  // Filter bows by level requirements and add availability info
  const bowOptions = possibleBows.map(([bowType, bowDef]) => ({
    bowType,
    bowDef,
    available: profile.skills.fletching >= bowDef.level
  }));
  
  if (bowOptions.every(option => !option.available)) {
    showFletchingMessage(`Your Fletching level is too low to make any bows from this log.`, 'error');
    return;
  }
  
  // Always show selection menu (even for single options) with quantity selection
  showBowSelectionMenu(bowOptions, knifeId, logId, knifeSlot, logSlot);
}

// Enhanced crafting selection menu with quantity selection
/**
 * Enhanced crafting selection UI with quantity selection for artisan skills
 * 
 * @param {Array} options - Array of crafting options with additional queue support
 * @param {string} title - Title to display in the selection menu
 * @param {function} onSelect - Callback when option is selected: (selectedOption, quantity) => {}
 * @param {function} onCancel - Callback when selection is cancelled: () => {}
 */
function showCraftingSelectionMenu(options, title, onSelect, onCancel) {
  // Remove any existing crafting menu
  const existingMenu = document.querySelector('.crafting-selection-modal');
  if (existingMenu) {
    existingMenu.remove();
  }
  
  const modal = document.createElement('div');
  modal.className = 'crafting-selection-modal';
  modal.innerHTML = `
    <div class="crafting-selection-content">
      <h3>${title}</h3>
      <div class="crafting-options">
        ${options.map((option, index) => `
          <div class="crafting-option-container" data-option-index="${index}">
            <button class="crafting-option ${!option.enabled ? 'disabled' : ''}" ${!option.enabled ? 'disabled' : ''}>
              <span class="option-icon">${option.icon}</span>
              <div class="option-details">
                <span class="option-name">${option.name}</span>
                <span class="option-requirements">Level ${option.level} • ${option.experience} XP</span>
                ${option.description ? `<span class="option-description">${option.description}</span>` : ''}
              </div>
            </button>
          </div>
        `).join('')}
      </div>
      
      <div class="quantity-controls">
        <label>Quantity:</label>
        <div class="quantity-buttons">
          <button class="quantity-btn selected" data-quantity="1">1</button>
          <button class="quantity-btn" data-quantity="5">5</button>
          <button class="quantity-btn" data-quantity="10">10</button>
          <button class="quantity-btn" data-quantity="all">All</button>
          <input type="number" class="quantity-input" min="1" max="999" value="1" placeholder="1">
        </div>
      </div>
      
      <div class="action-buttons">
        <button class="start-crafting" disabled>Start Fletching</button>
        <button class="cancel-crafting">Cancel</button>
      </div>
    </div>
  `;
  
  // Enhanced styles for the crafting selection UI with quantity controls
  const style = document.createElement('style');
  style.id = 'crafting-selection-styles';
  if (!document.getElementById('crafting-selection-styles')) {
    style.textContent = `
      .crafting-selection-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
      }
      .crafting-selection-content {
        background: #8B4513;
        border: 2px solid #654321;
        border-radius: 8px;
        padding: 20px;
        min-width: 400px;
        max-width: 600px;
        max-height: 80vh;
        overflow-y: auto;
        text-align: center;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
      }
      .crafting-selection-content h3 {
        color: #FFD700;
        margin-bottom: 15px;
        font-size: 1.2em;
        text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
      }
      .crafting-options {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-bottom: 20px;
      }
      .crafting-option-container {
        border: 1px solid #654321;
        border-radius: 6px;
        background: #A0522D;
        overflow: hidden;
        cursor: pointer;
        transition: all 0.2s;
      }
      .crafting-option-container:hover:not(.disabled) {
        border-color: #FFD700;
        box-shadow: 0 0 8px rgba(255, 215, 0, 0.3);
      }
      .crafting-option-container.selected {
        border-color: #FFD700;
        background: #CD853F;
        box-shadow: 0 0 8px rgba(255, 215, 0, 0.5);
      }
      .crafting-option-container.disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .crafting-option {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        background: transparent;
        border: none;
        cursor: pointer;
        color: white;
        text-align: left;
        width: 100%;
        transition: none;
      }
      .crafting-option.disabled {
        cursor: not-allowed;
      }
      .option-icon {
        font-size: 1.5em;
        flex-shrink: 0;
      }
      .option-details {
        display: flex;
        flex-direction: column;
        flex-grow: 1;
      }
      .option-name {
        font-weight: bold;
        font-size: 1.1em;
      }
      .option-requirements {
        color: #90EE90;
        font-size: 0.9em;
        margin-top: 2px;
      }
      .option-description {
        color: #DDD;
        font-size: 0.85em;
        margin-top: 2px;
        font-style: italic;
      }
      .quantity-controls {
        margin-bottom: 20px;
        padding: 15px;
        border: 1px solid #654321;
        border-radius: 6px;
        background: #654321;
      }
      .quantity-controls label {
        color: #FFD700;
        font-weight: bold;
        margin-bottom: 10px;
        display: block;
      }
      .quantity-buttons {
        display: flex;
        gap: 8px;
        align-items: center;
        justify-content: center;
        flex-wrap: wrap;
      }
      .quantity-btn {
        padding: 8px 16px;
        background: #A0522D;
        border: 1px solid #8B4513;
        border-radius: 4px;
        color: white;
        cursor: pointer;
        transition: background-color 0.2s;
        font-size: 0.9em;
        min-width: 40px;
      }
      .quantity-btn:hover {
        background: #CD853F;
      }
      .quantity-btn.selected {
        background: #FFD700;
        color: #8B4513;
        font-weight: bold;
        border-color: #FFD700;
      }
      .quantity-input {
        padding: 8px 10px;
        border: 1px solid #8B4513;
        border-radius: 4px;
        background: #DDD;
        color: #333;
        width: 70px;
        text-align: center;
        font-size: 0.9em;
      }
      .action-buttons {
        display: flex;
        gap: 10px;
        justify-content: center;
      }
      .start-crafting {
        padding: 10px 20px;
        background: #228B22;
        border: 1px solid #006400;
        border-radius: 4px;
        color: white;
        cursor: pointer;
        transition: background-color 0.2s;
        font-weight: bold;
      }
      .start-crafting:hover:not(:disabled) {
        background: #32CD32;
      }
      .start-crafting:disabled {
        background: #666;
        cursor: not-allowed;
        opacity: 0.6;
      }
      .cancel-crafting {
        padding: 10px 20px;
        background: #666;
        border: 1px solid #444;
        border-radius: 4px;
        color: white;
        cursor: pointer;
        transition: background-color 0.2s;
      }
      .cancel-crafting:hover {
        background: #777;
      }
    `;
    document.head.appendChild(style);
  }
  
  // State tracking for selection
  let selectedOption = null;
  let selectedQuantity = 1;
  
  // Add event listeners for option selection
  modal.querySelectorAll('.crafting-option-container').forEach((container, index) => {
    const option = options[index];
    
    if (option.enabled) {
      container.addEventListener('click', () => {
        // Remove selection from all containers
        modal.querySelectorAll('.crafting-option-container').forEach(c => 
          c.classList.remove('selected')
        );
        
        // Select this container
        container.classList.add('selected');
        selectedOption = option;
        
        // Enable start button
        modal.querySelector('.start-crafting').disabled = false;
      });
    }
  });
  
  // Add event listeners for quantity controls
  const quantityButtons = modal.querySelectorAll('.quantity-btn');
  const quantityInput = modal.querySelector('.quantity-input');
  
  // Handle quantity button selection
  quantityButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      quantityButtons.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      
      const quantity = btn.dataset.quantity;
      if (quantity === 'all') {
        selectedQuantity = 'all';
        quantityInput.value = '';
      } else {
        selectedQuantity = parseInt(quantity);
        quantityInput.value = selectedQuantity;
      }
    });
  });
  
  // Handle manual quantity input
  quantityInput.addEventListener('input', () => {
    quantityButtons.forEach(b => b.classList.remove('selected'));
    const value = parseInt(quantityInput.value) || 1;
    selectedQuantity = Math.max(1, Math.min(999, value));
    quantityInput.value = selectedQuantity;
  });
  
  // Handle start crafting button
  modal.querySelector('.start-crafting').addEventListener('click', () => {
    if (selectedOption) {
      document.body.removeChild(modal);
      if (onSelect) {
        onSelect(selectedOption, selectedQuantity);
      }
    }
  });
  
  // Handle cancel button
  modal.querySelector('.cancel-crafting').addEventListener('click', () => {
    document.body.removeChild(modal);
    if (onCancel) {
      onCancel();
    }
  });
  
  // Close on escape key
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      document.body.removeChild(modal);
      document.removeEventListener('keydown', handleEscape);
      if (onCancel) {
        onCancel();
      }
    }
  };
  document.addEventListener('keydown', handleEscape);
  
  document.body.appendChild(modal);
}

// Show bow selection menu with quantity selection
function showBowSelectionMenu(bowOptions, knifeId, logId, knifeSlot, logSlot) {
  const profile = window.userModule?.getProfile();
  const currentLevel = profile?.skills?.fletching || 1;
  
  // Convert bow definitions to crafting options format
  const options = bowOptions.map(({ bowType, bowDef, available }) => ({
    id: bowType,
    name: bowDef.name,
    icon: bowDef.icon,
    level: bowDef.level,
    experience: bowDef.experience,
    description: `Made from ${logId.replace('_', ' ')}`,
    enabled: available,
    data: { bowType, bowDef, knifeId, logId, knifeSlot, logSlot }
  }));
  
  showCraftingSelectionMenu(
    options,
    'What would you like to fletch?',
    (selectedOption, quantity) => {
      const { bowType, knifeId, logId, knifeSlot, logSlot } = selectedOption.data;
      startFletchingQueue(knifeId, logId, bowType, knifeSlot, logSlot, quantity);
    },
    () => {
      console.log('Fletching selection cancelled');
    }
  );
}

// Start fletching with queue support
function startFletchingQueue(knifeId, logId, bowType, knifeSlot, logSlot, quantity) {
  console.log(`Fletching: Starting queue for ${quantity} ${bowType}(s) using ${knifeId} on ${logId}`);
  
  const playerId = 'player';
  
  // Calculate actual quantity if "all" was selected
  let actualQuantity = quantity;
  if (quantity === 'all') {
    actualQuantity = calculateMaxPossibleCrafts(logId);
    if (actualQuantity === 0) {
      showFletchingMessage('You don\'t have any logs to fletch!', 'error');
      return;
    }
  }
  
  // Set up the fletching queue
  fletchingQueue.set(playerId, {
    knifeId,
    logId,
    bowType,
    knifeSlot,
    logSlot,
    remaining: actualQuantity,
    total: actualQuantity
  });
  
  // Start the first fletching action
  processFletchingQueue(playerId);
}

// Process the fletching queue
function processFletchingQueue(playerId) {
  const queue = fletchingQueue.get(playerId);
  if (!queue || queue.remaining <= 0) {
    // Queue completed
    fletchingQueue.delete(playerId);
    showFletchingMessage(`Fletching queue completed!`, 'success');
    return;
  }
  
  // Check if we still have materials
  const hasLog = checkInventoryForItem(queue.logId);
  if (!hasLog) {
    fletchingQueue.delete(playerId);
    showFletchingMessage(`Out of ${queue.logId.replace('_', ' ')}s! Fletching stopped.`, 'info');
    return;
  }
  
  // Find current log slot (it might have moved)
  const currentLogSlot = findItemInInventory(queue.logId);
  if (currentLogSlot === -1) {
    fletchingQueue.delete(playerId);
    showFletchingMessage(`Could not find ${queue.logId.replace('_', ' ')} in inventory!`, 'error');
    return;
  }
  
  // Update queue with current log slot
  queue.logSlot = currentLogSlot;
  
  // Show queue progress
  showFletchingMessage(`Fletching ${queue.bowType} (${queue.total - queue.remaining + 1}/${queue.total})...`, 'info');
  
  // Start the actual fletching
  startFletching(queue.knifeId, queue.logId, queue.bowType, queue.knifeSlot, queue.logSlot, true);
}

// Calculate maximum possible crafts based on available logs
function calculateMaxPossibleCrafts(logId) {
  const inventory = window.inventoryModule?.playerInventory || [];
  let logCount = 0;
  
  for (const item of inventory) {
    if (item && item.id === logId) {
      logCount += item.quantity || 1;
    }
  }
  
  return logCount;
}

// Check if player has a specific item in inventory
function checkInventoryForItem(itemId) {
  const inventory = window.inventoryModule?.playerInventory || [];
  return inventory.some(item => item && item.id === itemId);
}

// Find item slot in inventory
function findItemInInventory(itemId) {
  const inventory = window.inventoryModule?.playerInventory || [];
  for (let i = 0; i < inventory.length; i++) {
    if (inventory[i] && inventory[i].id === itemId) {
      return i;
    }
  }
  return -1;
}

// Enhanced start fletching function with queue support
function startFletching(knifeId, logId, bowType, knifeSlot, logSlot, fromQueue = false) {
  console.log(`Fletching: Starting to make ${bowType} using ${knifeId} on ${logId}`);
  
  const playerId = 'player';
  const bowDef = BOW_DEFINITIONS[bowType];
  const knifeDef = KNIFE_DEFINITIONS[knifeId];
  
  // Clean up any existing fletching session first (prevent race conditions)
  if (activeFletchingSessions.has(playerId)) {
    console.log('Fletching: Cleaning up existing session before starting new one');
    const existingSession = activeFletchingSessions.get(playerId);
    if (existingSession.timerId) {
      clearTimeout(existingSession.timerId);
    }
    stopFletchingAnimation();
    hideSkillBubble();
    activeFletchingSessions.delete(playerId);
  }
  
  // Calculate fletching time with knife bonus
  const baseTime = FLETCHING_CONSTANTS.BASE_FLETCHING_TIME;
  const timeReduction = knifeDef.fletchingBonus;
  const fletchingTime = Math.max(1000, baseTime * (1 - timeReduction));
  
  // Start fletching session
  const fletchingSession = {
    playerId: playerId,
    knifeId: knifeId,
    logId: logId,
    bowType: bowType,
    bowDef: bowDef,
    knifeDef: knifeDef,
    knifeSlot: knifeSlot,
    logSlot: logSlot,
    startTime: Date.now(),
    duration: fletchingTime,
    timerId: null,
    fromQueue: fromQueue
  };
  
  activeFletchingSessions.set(playerId, fletchingSession);
  
  // Start animation and skill bubble
  startFletchingAnimation();
  showSkillBubble('fletching');
  
  if (!fromQueue) {
    showFletchingMessage(`You begin shaping the ${bowDef.name.toLowerCase()}...`, 'info');
  }
  
  // Set completion timer
  fletchingSession.timerId = setTimeout(() => {
    completeFletching(playerId);
  }, fletchingTime);
  
  console.log(`Fletching: Started ${bowType} creation, will complete in ${fletchingTime}ms`);
}

// Start fletching animation
function startFletchingAnimation() {
  // Add fletching animation class to player
  const playerElement = document.querySelector('.player');
  if (playerElement) {
    playerElement.classList.add('fletching');
  }
}

// Stop fletching animation
function stopFletchingAnimation() {
  const playerElement = document.querySelector('.player');
  if (playerElement) {
    playerElement.classList.remove('fletching');
  }
}

// Enhanced complete fletching with queue support
function completeFletching(playerId) {
  const fletchingSession = activeFletchingSessions.get(playerId);
  if (!fletchingSession) {
    console.warn('Fletching: No active session found for completion');
    return;
  }
  
  console.log(`Fletching: Completing ${fletchingSession.bowType} creation`);
  
  // Stop animation and hide skill bubble
  stopFletchingAnimation();
  hideSkillBubble();
  
  // For fletching, we do a 1:1 replacement (log -> bow), so we don't need to check inventory space
  // Just remove the log first, then add the bow
  let logRemoved = false;
  if (window.inventoryModule && window.inventoryModule.removeItemFromInventorySlot) {
    console.log(`🏹 Fletching: Attempting to remove log from slot ${fletchingSession.logSlot}`);
    
    // Check that the item in the slot is actually a log
    const inventoryItem = window.inventoryModule.playerInventory?.[fletchingSession.logSlot];
    if (!inventoryItem) {
      console.error(`🏹 Fletching: No item found in slot ${fletchingSession.logSlot}`);
      activeFletchingSessions.delete(playerId);
      fletchingQueue.delete(playerId);
      showFletchingMessage('The log disappeared from your inventory!', 'error');
      return;
    }
    
    if (inventoryItem.id !== fletchingSession.logId) {
      console.error(`🏹 Fletching: Item in slot ${fletchingSession.logSlot} is ${inventoryItem.id}, expected ${fletchingSession.logId}`);
      activeFletchingSessions.delete(playerId);
      fletchingQueue.delete(playerId);
      showFletchingMessage('The log moved or changed in your inventory!', 'error');
      return;
    }
    
    // Now remove the log
    window.inventoryModule.removeItemFromInventorySlot(fletchingSession.logSlot);
    
    // Verify it was removed by checking the slot again
    const checkItem = window.inventoryModule.playerInventory?.[fletchingSession.logSlot];
    logRemoved = !checkItem || checkItem.id !== fletchingSession.logId;
    
    console.log(`🏹 Fletching: Log removal ${logRemoved ? 'successful' : 'failed'}`);
    
    if (!logRemoved) {
      console.error(`🏹 Fletching: Failed to remove log from slot ${fletchingSession.logSlot}`);
      activeFletchingSessions.delete(playerId);
      fletchingQueue.delete(playerId);
      showFletchingMessage('Could not remove log from inventory!', 'error');
      return;
    }
  } else {
    console.warn('Fletching: Remove inventory slot function not available');
    activeFletchingSessions.delete(playerId);
    fletchingQueue.delete(playerId);
    showFletchingMessage('Could not access inventory system.', 'error');
    return;
  }
  
  // Now add the bow (this should always succeed since we just freed up a slot)
  let inventorySuccess = false;
  if (window.inventoryModule && window.inventoryModule.addItemToInventory) {
    inventorySuccess = window.inventoryModule.addItemToInventory(fletchingSession.bowDef.resultItem, 1);
  }
  
  if (!inventorySuccess) {
    // This should rarely happen since we just removed an item, but handle it gracefully
    console.error('Fletching: Could not add bow to inventory after removing log');
    showFletchingMessage('Something went wrong creating the bow!', 'error');
    activeFletchingSessions.delete(playerId);
    fletchingQueue.delete(playerId);
    return;
  }
  
  // Award experience - exactly matching woodcutting's implementation
  const profile = window.userModule?.getProfile();
  if (profile && profile.skills && profile.skillsExp) {
    const experienceAmount = fletchingSession.bowDef.experience;
    const oldLevel = profile.skills.fletching || 1;
    
    console.log(`🏹 Fletching: Adding ${experienceAmount} XP to fletching skill`);
    console.log(`🏹 Fletching: Before - Level: ${profile.skills.fletching}, XP: ${profile.skillsExp.fletching || 0}`);
    
    // Use the same addExperience call as woodcutting
    const leveledUp = addExperience('fletching', experienceAmount, profile.skills, profile.skillsExp);
    
    console.log(`🏹 Fletching: After - Level: ${profile.skills.fletching}, XP: ${profile.skillsExp.fletching || 0}, Leveled up: ${leveledUp}`);
    
    // Update UI exactly like woodcutting does
    if (window.uiModule && window.uiModule.updateSkillDisplay) {
      console.log(`🏹 Fletching: Calling updateSkillDisplay for fletching`);
      window.uiModule.updateSkillDisplay('fletching', profile.skills.fletching, leveledUp);
      if (leveledUp) {
        window.uiModule.updateTotalLevel(profile.skills);
      }
    }
    
    // Update experience bar with visual feedback - exactly like woodcutting
    if (window.uiModule && window.uiModule.updateSkillExperienceBar) {
      console.log(`🏹 Fletching: Calling updateSkillExperienceBar for fletching`);
      window.uiModule.updateSkillExperienceBar('fletching');
      
      // Add visual feedback for experience gain exactly like woodcutting
      setTimeout(() => {
        const skillElement = document.querySelector(`[data-skill="fletching"]`);
        if (skillElement) {
          const expFill = skillElement.querySelector('.skill-exp-fill');
          if (expFill) {
            console.log(`🏹 Fletching: Adding visual feedback animation`);
            expFill.classList.add('exp-gain');
            setTimeout(() => {
              expFill.classList.remove('exp-gain');
            }, 600);
          } else {
            console.warn(`🏹 Fletching: No exp-fill element found for visual feedback`);
          }
        } else {
          console.warn(`🏹 Fletching: No skill element found for fletching`);
        }
      }, 50); // Small delay to ensure DOM is updated
    } else {
      console.warn(`🏹 Fletching: updateSkillExperienceBar function not available`);
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
      showFletchingMessage(`Level up! Your Fletching level is now ${profile.skills.fletching}!`, 'success');
    }
    
    if (!fletchingSession.fromQueue) {
      showFletchingMessage(`You successfully create a ${fletchingSession.bowDef.name.toLowerCase()}. (+${experienceAmount} Fletching XP)`, 'success');
    }
  } else {
    console.error('Fletching: Could not access player profile or skills/experience data');
    if (!fletchingSession.fromQueue) {
      showFletchingMessage(`You successfully create a ${fletchingSession.bowDef.name.toLowerCase()}.`, 'success');
    }
  }
  
  // Clean up fletching session
  activeFletchingSessions.delete(playerId);
  
  // Process queue if this was part of a queue
  if (fletchingSession.fromQueue && fletchingQueue.has(playerId)) {
    const queue = fletchingQueue.get(playerId);
    queue.remaining--;
    
    if (queue.remaining > 0) {
      // Continue with next item in queue after a short delay
      setTimeout(() => {
        processFletchingQueue(playerId);
      }, 100);
    } else {
      // Queue completed
      const completedTotal = queue.total;
      fletchingQueue.delete(playerId);
      showFletchingMessage(`Completed fletching ${completedTotal} ${fletchingSession.bowDef.name.toLowerCase()}${completedTotal > 1 ? 's' : ''}!`, 'success');
    }
  }
}

// Cancel fletching and clear queue
function cancelFletching(playerId = 'player') {
  const fletchingSession = activeFletchingSessions.get(playerId);
  if (fletchingSession) {
    console.log('Fletching: Cancelling fletching session');
    
    // Clear the completion timer
    if (fletchingSession.timerId) {
      clearTimeout(fletchingSession.timerId);
    }
    
    stopFletchingAnimation();
    hideSkillBubble();
    activeFletchingSessions.delete(playerId);
    showFletchingMessage('Fletching interrupted.', 'info');
  }
  
  // Also clear any active queue
  if (fletchingQueue.has(playerId)) {
    fletchingQueue.delete(playerId);
    showFletchingMessage('Fletching queue cancelled.', 'info');
  }
}

// Check if player is currently fletching
function isFletching(playerId = 'player') {
  return activeFletchingSessions.has(playerId);
}

// Show fletching-related messages
function showFletchingMessage(message, type = 'info') {
  if (window.uiModule && window.uiModule.showNotification) {
    window.uiModule.showNotification(message, type);
  } else {
    console.log(`Fletching ${type}: ${message}`);
  }
}

// Get the current active fletching session for external modules
function getActiveFletchingSession(playerId = 'player') {
  return activeFletchingSessions.get(playerId);
}

// Auto-initialize fletching when module loads
document.addEventListener('DOMContentLoaded', () => {
  console.log('Fletching: DOM loaded, initializing...');
  initializeFletching();
});

// Also initialize if DOM is already loaded
if (document.readyState === 'loading') {
  // DOM is still loading, wait for DOMContentLoaded
} else {
  // DOM has already loaded
  console.log('Fletching: DOM already loaded, initializing immediately...');
  setTimeout(initializeFletching, 100); // Small delay to ensure other modules are ready
}

// Export fletching functions for module imports
export {
  initializeFletching,
  handleFletchingInteraction,
  startFletching,
  cancelFletching,
  isFletching,
  getActiveFletchingSession,
  BOW_DEFINITIONS,
  KNIFE_DEFINITIONS
};