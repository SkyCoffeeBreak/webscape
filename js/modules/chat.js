/**
 * Chat System for WebscapeRPG
 * Handles game messages, player chat, and system notifications
 */

// Chat configuration
const MAX_MESSAGES = 100;
const MESSAGE_TYPES = {
  SYSTEM: 'system',
  GAME: 'game', 
  INFO: 'info',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error',
  PLAYER: 'player',
  MULTIPLAYER: 'multiplayer'
};

// Chat state
let chatMessages = [];
let chatContainer = null;
let chatInput = null;
let chatSendBtn = null;

// Initialize the chat system
function initializeChat() {
  console.log('Initializing chat system...');
  
  // Get chat elements
  chatContainer = document.getElementById('chat-messages');
  chatInput = document.getElementById('chat-input');
  chatSendBtn = document.getElementById('chat-send');
  
  if (!chatContainer || !chatInput || !chatSendBtn) {
    console.error('Chat elements not found in DOM');
    return false;
  }
  
  // Setup event listeners
  setupChatEventListeners();
  
  // Setup global keyboard listeners for Enter key
  setupGlobalKeyboardListeners();
  
  // Add welcome message
  addMessage('Welcome to WebscapeRPG! Type messages below to chat.', MESSAGE_TYPES.SYSTEM);
  
  console.log('Chat system initialized successfully');
  return true;
}

// Setup event listeners for chat functionality
function setupChatEventListeners() {
  // Send button click
  chatSendBtn.addEventListener('click', () => {
    sendMessage();
  });
  
  // Enter key to send message
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  });
  
  // Escape key to return to game
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      returnFocusToGame();
    }
  });
  
  // Prevent chat input from interfering with game controls
  chatInput.addEventListener('focus', () => {
    // Stop any game keyboard listeners while typing
    document.body.classList.add('chat-active');
  });
  
  chatInput.addEventListener('blur', () => {
    // Re-enable game keyboard listeners
    document.body.classList.remove('chat-active');
  });
}

// Enhanced sendMessage function with command processing
function sendMessage() {
  const input = document.getElementById('chat-input');
  const message = input.value.trim();
  
  if (message) {
    console.log('Sending message:', message);
    
    // Check if this is a command
    if (message.startsWith('/')) {
      const result = processChatCommand(message);
      
      if (result) {
        // Command was processed
        const messageType = result.success ? MESSAGE_TYPES.SUCCESS : MESSAGE_TYPES.ERROR;
        addMessage(result.message, messageType);
      } else {
        // Unknown command
        addMessage(`Unknown command: ${message}. Type /help for available commands.`, MESSAGE_TYPES.ERROR);
      }
      
      input.value = '';
      return;
    }
    
    // Testing commands
    if (message === '/test cooking' || message === '/testcooking') {
      const inventoryModule = window.inventoryModule;
      if (inventoryModule) {
        // Give the player a variety of raw fish to test cooking
        const rawFishItems = [
          { id: 'raw_shrimps', quantity: 10 },
          { id: 'raw_sardine', quantity: 8 },
          { id: 'raw_herring', quantity: 6 },
          { id: 'raw_anchovies', quantity: 5 },
          { id: 'raw_tuna', quantity: 4 },
          { id: 'raw_lobster', quantity: 3 },
          { id: 'raw_swordfish', quantity: 2 },
          { id: 'raw_shark', quantity: 1 }
        ];
        
        rawFishItems.forEach(item => {
          for (let i = 0; i < item.quantity; i++) {
            inventoryModule.addItemToInventory(item.id, 1);
          }
        });
        
        addMessage('🍳 Added raw fish to inventory for cooking testing!', MESSAGE_TYPES.SYSTEM);
        return true;
      } else {
        addMessage('❌ Inventory module not available.', MESSAGE_TYPES.ERROR);
        return true;
      }
    }
    
    // Regular chat message
    if (window.isUserOnline && window.isUserOnline()) {
      // Online - send to server (will echo back to all players)
      if (window.sendChatMessage) {
        window.sendChatMessage(message);
      }
    } else {
      // Offline - show locally
      if (window.showLocalChatMessage) {
        window.showLocalChatMessage(message);
      } else {
        addMessage(message, MESSAGE_TYPES.PLAYER);
      }
    }
    
    input.value = '';
  }
}

/**
 * Process chat commands
 */
function processChatCommand(message) {
  const parts = message.toLowerCase().split(' ');
  const command = parts[0];
  
  switch (command) {
    case '/exp':
      return processExpCommand(parts.slice(1));
    case '/give':
      return processGiveCommand(parts.slice(1));
    case '/help':
      return processHelpCommand();
    case '/bank':
      if (parts[1] === 'open') {
        console.log('🏦 DEBUG: Opening bank via chat command');
        if (window.bankModule && window.bankModule.openBank) {
          window.bankModule.openBank();
          addMessage('🏦 Opening bank interface...', MESSAGE_TYPES.SYSTEM);
        } else {
          addMessage('❌ Bank module not available', MESSAGE_TYPES.ERROR);
        }
      } else {
        addMessage('💬 Usage: /bank open', MESSAGE_TYPES.SYSTEM);
      }
      break;
    case '/time':
      return processTimeCommand(parts.slice(1));
    default:
      return null; // Not a command
  }
}

/**
 * Process experience commands: /exp add/remove [player] [amount] [skill]
 */
function processExpCommand(args) {
  if (args.length < 4) {
    return {
      success: false,
      message: 'Usage: /exp add/remove [player] [amount] [skill]'
    };
  }
  
  const action = args[0]; // add or remove
  const playerName = args[1];
  const amount = parseInt(args[2]);
  const skillName = args[3];
  
  // Validate action
  if (action !== 'add' && action !== 'remove') {
    return {
      success: false,
      message: 'Action must be "add" or "remove"'
    };
  }
  
  // Validate amount
  if (isNaN(amount) || amount <= 0) {
    return {
      success: false,
      message: 'Amount must be a positive number'
    };
  }
  
  // Get valid skill names (using the actual skills from this game)
  const validSkills = [
    // Combat Skills
    'attack', 'magic', 'ranged', 'blasting', 'defence', 'hitpoints', 'prayer', 'slayer',
    // Gathering Skills  
    'mining', 'fishing', 'woodcutting', 'harvesting',
    // Artisan Skills
    'smithing', 'cooking', 'fletching', 'apothecary', 'crafting', 'bonecarving', 
    'painting', 'brewing', 'scribing', 'confectionery', 'masonry', 'tailoring',
    // Support Skills
    'thieving', 'alchemy', 'creation', 'delivery', 'ranching', 'knowledge', 
    'candlemaking', 'pottery', 'digging', 'diplomacy', 'apiary', 'taming', 'dracology', 'engineering'
  ];
  
  // Validate skill name
  if (!validSkills.includes(skillName)) {
    return {
      success: false,
      message: `Invalid skill. Valid skills: ${validSkills.join(', ')}`
    };
  }
  
  // Check if player exists (for now, only support current player or 'me')
  if (playerName !== 'me' && playerName !== getCurrentPlayerName()) {
    return {
      success: false,
      message: 'Can only modify experience for yourself. Use "me" as player name.'
    };
  }
  
  // Get user profile
  const profile = window.userModule ? window.userModule.getProfile() : null;
  if (!profile) {
    return {
      success: false,
      message: 'Could not access player profile'
    };
  }
  
  // Ensure skillsExp exists
  if (!profile.skillsExp) {
    profile.skillsExp = {};
  }
  
  // Initialize skill experience if not present
  if (profile.skillsExp[skillName] === undefined) {
    profile.skillsExp[skillName] = skillName === 'hitpoints' ? 1154 : 0;
  }
  
  // Calculate current level before change
  const oldLevel = profile.skills[skillName] || (skillName === 'hitpoints' ? 10 : 1);
  const oldExp = profile.skillsExp[skillName] || 0;
  
  // Apply experience change
  let newExp;
  if (action === 'add') {
    newExp = oldExp + amount;
  } else {
    newExp = Math.max(0, oldExp - amount);
    // Don't let hitpoints go below level 10 experience
    if (skillName === 'hitpoints') {
      newExp = Math.max(1154, newExp);
    }
  }
  
  // Update experience
  profile.skillsExp[skillName] = newExp;
  
  // Calculate new level from experience
  const newLevel = getLevelFromExperience(newExp);
  
  // Cap at 99
  const finalLevel = Math.min(99, Math.max(skillName === 'hitpoints' ? 10 : 1, newLevel));
  
  // Update skill level
  profile.skills[skillName] = finalLevel;
  
  // Update UI
  if (window.uiModule && window.uiModule.updateSkillDisplay) {
    const levelChanged = oldLevel !== finalLevel;
    window.uiModule.updateSkillDisplay(skillName, finalLevel, levelChanged);
  }
  
  if (window.uiModule && window.uiModule.updateTotalLevel) {
    window.uiModule.updateTotalLevel(profile.skills);
  }
  
  // Save profile
  if (window.userModule && window.userModule.saveProfile) {
    window.userModule.saveProfile();
  }
  
  // Sync with server if online
  if (window.syncSkillsWithServer && window.isUserOnline && window.isUserOnline()) {
    const totalLevel = window.calculateTotalLevel ? window.calculateTotalLevel(profile.skills) : 0;
    const combatLevel = window.calculateCombatLevel ? window.calculateCombatLevel(profile.skills) : 0;
    window.syncSkillsWithServer(profile.skills, totalLevel, combatLevel, profile.skillsExp);
  }
  
  // Format response
  const expChange = action === 'add' ? `+${amount}` : `-${amount}`;
  const levelChange = finalLevel !== oldLevel ? ` (Level: ${oldLevel} → ${finalLevel})` : '';
  
  return {
    success: true,
    message: `${skillName.charAt(0).toUpperCase() + skillName.slice(1)}: ${expChange} XP${levelChange}`
  };
}

/**
 * Get level from experience (copy of skills.js function)
 */
function getLevelFromExperience(experience) {
  // Experience table - same as in skills.js
  const expTable = [];
  let points = 0;
  for (let level = 1; level <= 99; level++) {
    points += Math.floor(level + 300 * Math.pow(2, level / 7));
    expTable[level] = Math.floor(points / 4);
  }
  
  for (let level = 99; level >= 1; level--) {
    if (experience >= expTable[level]) {
      return level;
    }
  }
  return 1;
}

/**
 * Process time command
 */
function processTimeCommand(args) {
  if (!window.dayNightModule) {
    return {
      success: false,
      message: 'Day-night system not available'
    };
  }
  
  if (args.length === 0) {
    // Show current time info
    const timeInfo = window.dayNightModule.getCurrentTimeInfo();
    return {
      success: true,
      message: `Current time: ${timeInfo.gameTime} (${timeInfo.periodName}) - ${timeInfo.isActive ? 'Active' : 'Paused'}`
    };
  }
  
  const subCommand = args[0];
  
  switch (subCommand) {
    case 'toggle':
      window.dayNightModule.toggleDayNightCycle();
      const newTimeInfo = window.dayNightModule.getCurrentTimeInfo();
      return {
        success: true,
        message: `Day-night cycle ${newTimeInfo.isActive ? 'resumed' : 'paused'}`
      };
      
    case 'set':
      if (args.length < 2) {
        return {
          success: false,
          message: 'Usage: /time set [period] - Valid periods: night, dawn, morning, day, afternoon, dusk, evening'
        };
      }
      
      const periodMap = {
        'night': 'NIGHT',
        'dawn': 'DAWN', 
        'morning': 'MORNING',
        'day': 'DAY',
        'afternoon': 'AFTERNOON',
        'dusk': 'DUSK',
        'evening': 'EVENING'
      };
      
      const requestedPeriod = args[1].toLowerCase();
      const periodKey = periodMap[requestedPeriod];
      
      if (!periodKey) {
        return {
          success: false,
          message: 'Invalid period. Valid periods: night, dawn, morning, day, afternoon, dusk, evening'
        };
      }
      
      if (window.dayNightModule.setTimePeriod(periodKey)) {
        return {
          success: true,
          message: `Time set to ${requestedPeriod}`
        };
      } else {
        return {
          success: false,
          message: 'Failed to set time period'
        };
      }
      
    default:
      return {
        success: false,
        message: 'Usage: /time [toggle|set] - Use /time to see current time'
      };
  }
}

/**
 * Process help command
 */
function processHelpCommand() {
  const helpText = [
    'Available Commands:',
    '/exp add me [amount] [skill] - Add experience to a skill',
    '/exp remove me [amount] [skill] - Remove experience from a skill',
    '/give me [item_name] [quantity] - Give items to yourself',
    '/help - Show this help message',
    '/bank open - Open bank interface',
    '/time - Show current game time',
    '/time toggle - Pause/resume day-night cycle',
    '/time set [period] - Set time to specific period',
    '',
    'Examples:',
    '/exp add me 1000 fishing',
    '/give me axe 1',
    '/give me coins 100',
    '/time set dawn',
    '/time toggle'
  ];
  
  return {
    success: true,
    message: helpText.join('\n')
  };
}

/**
 * Get current player name
 */
function getCurrentPlayerName() {
  try {
    const characterNameElement = document.getElementById('character-name');
    if (characterNameElement && characterNameElement.textContent.trim()) {
      return characterNameElement.textContent.trim().toLowerCase();
    }
    
    // Fallback to profile
    const profile = window.userModule ? window.userModule.getProfile() : null;
    if (profile && profile.character && profile.character.name) {
      return profile.character.name.toLowerCase();
    }
    
    return 'unknown';
  } catch (error) {
    console.warn('Error getting player name:', error);
    return 'unknown';
  }
}

// Add a message to the chat
function addMessage(text, type = MESSAGE_TYPES.GAME, includeTimestamp = true) {
  if (!chatContainer) {
    console.warn('Chat not initialized, cannot add message:', text);
    return;
  }
  
  // Create timestamp
  const timestamp = new Date();
  const timeString = timestamp.toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });
  
  // Create message object
  const messageObj = {
    id: generateMessageId(),
    text: text,
    type: type,
    timestamp: timestamp,
    timeString: timeString
  };
  
  // Add to messages array
  chatMessages.push(messageObj);
  
  // Remove old messages if we exceed the limit
  if (chatMessages.length > MAX_MESSAGES) {
    chatMessages.shift(); // Remove oldest message
    
    // Remove oldest message from DOM
    const firstMessage = chatContainer.firstChild;
    if (firstMessage) {
      chatContainer.removeChild(firstMessage);
    }
  }
  
  // Create message element
  const messageElement = createMessageElement(messageObj, includeTimestamp);
  
  // Add to DOM
  chatContainer.appendChild(messageElement);
  
  // Auto-scroll to bottom
  scrollToBottom();
  
  console.log(`Chat message added [${type}]: ${text}`);
}

// Create a message DOM element
function createMessageElement(messageObj, includeTimestamp) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `chat-message ${messageObj.type}`;
  messageDiv.dataset.messageId = messageObj.id;
  
  let content = '';
  
  // Add timestamp if requested
  if (includeTimestamp) {
    content += `<span class="timestamp">[${messageObj.timeString}]</span>`;
  }
  
  // Add message text
  content += messageObj.text;
  
  messageDiv.innerHTML = content;
  return messageDiv;
}

// Generate unique message ID
function generateMessageId() {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Scroll chat to bottom
function scrollToBottom() {
  if (chatContainer) {
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }
}

// Clear all chat messages
function clearChat() {
  if (chatContainer) {
    chatContainer.innerHTML = '';
    chatMessages = [];
    addMessage('Chat cleared.', MESSAGE_TYPES.SYSTEM);
  }
}

// Get all messages (for debugging or export)
function getAllMessages() {
  return [...chatMessages];
}

// Add notification (replaces the old notification system)
function showNotification(message, type = 'info') {
  const chatType = mapNotificationTypeToChat(type);
  addMessage(message, chatType);
}

// Map old notification types to chat message types
function mapNotificationTypeToChat(notificationType) {
  switch (notificationType.toLowerCase()) {
    case 'success':
      return MESSAGE_TYPES.SUCCESS;
    case 'error':
      return MESSAGE_TYPES.ERROR;
    case 'warning':
      return MESSAGE_TYPES.WARNING;
    case 'info':
      return MESSAGE_TYPES.INFO;
    case 'system':
      return MESSAGE_TYPES.SYSTEM;
    default:
      return MESSAGE_TYPES.GAME;
  }
}

// Focus chat input (useful for keyboard shortcuts)
function focusChatInput() {
  if (chatInput) {
    chatInput.focus();
    
    // Add visual indication that chat is active
    document.body.classList.add('chat-active');
  }
}

// Check if chat input is focused
function isChatFocused() {
  return chatInput && document.activeElement === chatInput;
}

// Show speech bubble over player character
function showSpeechBubble(message) {
  const playerCharacter = document.getElementById('player-character');
  const gameWorld = document.getElementById('game-world');
  
  if (!playerCharacter || !gameWorld) {
    console.warn('Could not find player character or game world for speech bubble');
    return;
  }
  
  // Remove any existing speech bubble
  const existingBubble = gameWorld.querySelector('.speech-bubble:not(.online-player-bubble)');
  if (existingBubble) {
    existingBubble.remove();
  }
  
  // Create speech bubble element
  const speechBubble = document.createElement('div');
  speechBubble.className = 'speech-bubble';
  speechBubble.textContent = message;
  
  // Apply inline styles to ensure they work regardless of CSS loading
  speechBubble.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
  speechBubble.style.color = '#000000';
  speechBubble.style.border = '2px solid #333333';
  speechBubble.style.borderRadius = '12px';
  speechBubble.style.padding = '8px 12px';
  speechBubble.style.fontFamily = "'Courier New', monospace";
  speechBubble.style.fontSize = '13px';
  speechBubble.style.fontWeight = 'bold';
  speechBubble.style.maxWidth = '200px';
  speechBubble.style.wordWrap = 'break-word';
  speechBubble.style.textAlign = 'center';
  speechBubble.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.3)';
  speechBubble.style.position = 'absolute';
  speechBubble.style.zIndex = '15';
  speechBubble.style.pointerEvents = 'none';
  
  // Check if the message is just an emoji (for emotes)
  const isEmote = /^[\p{Emoji_Presentation}\p{Emoji}\uFE0F\u200D]+$/u.test(message.trim());
  
  if (isEmote) {
    // Make emotes larger
    speechBubble.style.fontSize = '24px';
    speechBubble.style.padding = '12px 16px';
    speechBubble.style.textShadow = '2px 2px 4px rgba(0, 0, 0, 0.8), -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff';
  }
  
  // Add to game world
  gameWorld.appendChild(speechBubble);
  
  // Create and add tail elements manually
  const tailOuter = document.createElement('div');
  tailOuter.style.position = 'absolute';
  tailOuter.style.top = '100%';
  tailOuter.style.left = '50%';
  tailOuter.style.transform = 'translateX(-50%)';
  tailOuter.style.width = '0';
  tailOuter.style.height = '0';
  tailOuter.style.borderLeft = '8px solid transparent';
  tailOuter.style.borderRight = '8px solid transparent';
  tailOuter.style.borderTop = '8px solid #333333';
  speechBubble.appendChild(tailOuter);
  
  const tailInner = document.createElement('div');
  tailInner.style.position = 'absolute';
  tailInner.style.top = '100%';
  tailInner.style.left = '50%';
  tailInner.style.transform = 'translateX(-50%)';
  tailInner.style.width = '0';
  tailInner.style.height = '0';
  tailInner.style.borderLeft = '6px solid transparent';
  tailInner.style.borderRight = '6px solid transparent';
  tailInner.style.borderTop = '6px solid rgba(255, 255, 255, 0.95)';
  tailInner.style.marginTop = '-8px';
  speechBubble.appendChild(tailInner);
  
  // Function to update bubble position relative to player
  function updateBubblePosition() {
    if (!speechBubble.parentNode || !playerCharacter.parentNode) {
      return; // Bubble or player was removed
    }
    
    // Calculate position relative to player element
    const playerLeft = parseInt(playerCharacter.style.left) || 0;
    const playerTop = parseInt(playerCharacter.style.top) || 0;
    const playerWidth = playerCharacter.offsetWidth;
    
    // Get bubble dimensions to position it properly
    const bubbleHeight = speechBubble.offsetHeight || 40; // Default height if not measured yet
    
    // Position bubble above player, accounting for bubble height so it grows upward
    const bubbleX = playerLeft + (playerWidth / 2);
    const bubbleY = playerTop - bubbleHeight - 10; // 10px gap above player, grows upward from here
    
    speechBubble.style.left = `${bubbleX}px`;
    speechBubble.style.top = `${bubbleY}px`;
    speechBubble.style.transform = 'translateX(-50%)'; // Center horizontally on player
  }
  
  // Initial position
  updateBubblePosition();
  
  // Also update position after a small delay to account for bubble rendering
  setTimeout(() => {
    updateBubblePosition();
  }, 50);
  
  // Update position continuously while bubble exists
  const updateInterval = setInterval(() => {
    if (!speechBubble.parentNode) {
      clearInterval(updateInterval);
      return;
    }
    updateBubblePosition();
  }, 16); // Update every 16ms (60 FPS) for ultra-smooth following
  
  // Remove after 5 seconds
  setTimeout(() => {
    if (speechBubble.parentNode) {
      speechBubble.remove();
    }
    clearInterval(updateInterval);
  }, 5000);
  
  console.log('Speech bubble created and positioned for message:', message);
}

// Return focus to the game world
function returnFocusToGame() {
  if (chatInput) {
    chatInput.blur();
  }
  
  // Focus on the game world element or body
  const gameWorld = document.getElementById('game-world');
  if (gameWorld) {
    gameWorld.focus();
  } else {
    document.body.focus();
  }
  
  // Remove chat-active class to re-enable game controls
  document.body.classList.remove('chat-active');
}

// Setup global keyboard listeners for Enter key
function setupGlobalKeyboardListeners() {
  document.addEventListener('keydown', (e) => {
    // Only handle Enter key
    if (e.key !== 'Enter') return;
    
    // Don't interfere if chat is already focused
    if (isChatFocused()) return;
    
    // Don't interfere if another input element is focused
    if (document.activeElement && 
        (document.activeElement.tagName === 'INPUT' || 
         document.activeElement.tagName === 'TEXTAREA' ||
         document.activeElement.contentEditable === 'true')) {
      return;
    }
    
    // Don't interfere if any modal or overlay is open
    if (document.querySelector('.modal:not([style*="display: none"])') ||
        (window.bankInterface && window.bankInterface.open)) {
      return;
    }
    
    // Focus the chat input
    e.preventDefault();
    focusChatInput();
  });
}

// Send an emote message
function sendEmoteMessage(emote) {
  console.log('sendEmoteMessage called with:', emote);
  
  // Show speech bubble immediately for instant feedback
  console.log('Showing speech bubble with emote:', emote);
  showSpeechBubble(emote);
  
  // Check if online and send to server
  if (window.isUserOnline && window.isUserOnline() && window.sendChatMessage) {
    console.log('User is online, sending emote to server (server will echo back to chat)');
    // Send to server - server will echo back and add to chat
    window.sendChatMessage(emote);
  } else {
    console.log('User is offline, adding emote to chat locally');
    // Only add to chat locally if offline
    
    // Get the player's name and color for offline display
    let playerName = 'Player';
    let playerColor = '#3498db'; // Default blue
    
    try {
      const characterNameElement = document.getElementById('character-name');
      if (characterNameElement && characterNameElement.textContent.trim()) {
        playerName = characterNameElement.textContent.trim();
      }
      
      const playerCharacter = document.getElementById('player-character');
      if (playerCharacter && playerCharacter.style.backgroundColor) {
        playerColor = playerCharacter.style.backgroundColor;
      }
      
      // Also check profile settings
      if (window.userProfile && window.userProfile.settings && window.userProfile.settings.playerColor) {
        playerColor = window.userProfile.settings.playerColor;
      }
    } catch (error) {
      console.warn('Could not get player name/color, using defaults:', error);
    }
    
    console.log('Using player name:', playerName, 'color:', playerColor);
    
    // Create colored name message with emote
    const coloredMessage = `<span style="color: ${playerColor}; font-weight: bold;">${playerName}:</span> ${emote}`;
    
    console.log('Adding emote message to chat:', coloredMessage);
    
    // Add emote message to chat locally (offline only)
    addMessage(coloredMessage, MESSAGE_TYPES.PLAYER);
  }
  
  console.log(`Emote sent: ${emote}`);
}

/**
 * Process give commands: /give [player] [item_name] [quantity]
 */
function processGiveCommand(args) {
  if (args.length < 2) {
    return {
      success: false,
      message: 'Usage: /give [player] [item_name] [quantity]'
    };
  }
  
  const playerName = args[0];
  const itemName = args[1];
  const quantity = args.length > 2 ? parseInt(args[2]) : 1;
  
  // Validate quantity
  if (isNaN(quantity) || quantity <= 0) {
    return {
      success: false,
      message: 'Quantity must be a positive number'
    };
  }
  
  // Check if player exists (for now, only support current player or 'me')
  if (playerName !== 'me' && playerName !== getCurrentPlayerName()) {
    return {
      success: false,
      message: 'Can only give items to yourself. Use "me" as player name.'
    };
  }
  
  // Map command item names to actual inventory item IDs
  const itemIdMap = {
    // Tools (using correct IDs from itemDefinitions)
    'axe': 'bronze_axe',
    'iron_axe': 'iron_axe',
    'steel_axe': 'steel_axe',
    'pickaxe': 'bronze_pickaxe', 
    'iron_pickaxe': 'iron_pickaxe',
    'tinderbox': 'tinderbox',
    'chisel': 'chisel',
    'rope': 'rope',
    
    // Weapons and armor (using correct IDs)
    'sword': 'bronze_sword',
    'iron_sword': 'iron_sword',
    'steel_sword': 'steel_sword',
    'shield': 'bronze_shield',
    'iron_shield': 'iron_shield',
    'armor': 'leather_armor',
    'staff': 'magic_staff',
    
    // Resources and ores (using correct IDs)
    'coal': 'coal',
    'iron_ore': 'iron_ore',
    'copper_ore': 'copper_ore',
    'tin_ore': 'tin_ore',
    'silver_ore': 'silver_ore',
    'gold_ore': 'gold_ore',
    'mithril_ore': 'mithril_ore',
    'adamantite_ore': 'adamantite_ore',
    
    // Bars
    'bronze_bar': 'bronze_bar',
    'iron_bar': 'iron_bar',
    'steel_bar': 'steel_bar',
    'mithril_bar': 'mithril_bar',
    
    // Logs
    'log': 'wooden_log',
    'oak_log': 'oak_log',
    'pine_log': 'pine_log',
    'palm_log': 'palm_log',
    
    // Food
    'bread': 'bread',
    'meat': 'meat',
    'apple': 'apple',
    'mushroom': 'mushroom',
    
    // Potions
    'potion': 'health_potion',
    'health_potion': 'health_potion',
    'mana_potion': 'mana_potion',
    
    // Gems
    'gem': 'gem',
    'sapphire': 'sapphire',
    'emerald': 'emerald',
    'diamond': 'diamond',
    'uncut_gem': 'uncut_gem',
    'uncut_sapphire': 'uncut_sapphire',
    'uncut_emerald': 'uncut_emerald',
    'uncut_diamond': 'uncut_diamond',
    
    // Magic items
    'rune': 'rune_fire',
    'fire_rune': 'rune_fire',
    'water_rune': 'rune_water',
    'teleport_scroll': 'scroll_teleport',
    
    // Misc
    'coins': 'coins',
    'key': 'key',
    'book': 'book',
    'paper': 'paper'
  };
  
  // Validate item name
  if (!itemIdMap[itemName]) {
    const itemList = Object.keys(itemIdMap).join(', ');
    return {
      success: false,
      message: `Invalid item. Available items: ${itemList}`
    };
  }
  
  const itemId = itemIdMap[itemName];
  
  // Add item to inventory using the correct itemId
  try {
    if (window.inventoryModule && window.inventoryModule.addItemToInventory) {
      // Pass itemId (string) and quantity to addItemToInventory
      const success = window.inventoryModule.addItemToInventory(itemId, quantity);
      
      if (success) {
        // Get item definition to show proper name
        const itemDef = window.inventoryModule.getItemDefinition(itemId);
        const itemDisplayName = itemDef ? itemDef.name : itemName;
        
        return {
          success: true,
          message: `Added ${quantity}x ${itemDisplayName} to inventory`
        };
      } else {
        return {
          success: false,
          message: 'Failed to add item to inventory (inventory might be full)'
        };
      }
    } else {
      return {
        success: false,
        message: 'Inventory system not available'
      };
    }
  } catch (error) {
    console.error('Error adding item to inventory:', error);
    return {
      success: false,
      message: `Error adding item to inventory: ${error.message}`
    };
  }
}

// Export functions
export {
  initializeChat,
  addMessage,
  showNotification,
  clearChat,
  focusChatInput,
  isChatFocused,
  getAllMessages,
  returnFocusToGame,
  showSpeechBubble,
  sendEmoteMessage,
  MESSAGE_TYPES
}; 