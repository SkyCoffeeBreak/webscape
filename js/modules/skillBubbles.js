/**
 * Skill Bubbles module for WebscapeRPG
 * Provides standardized skill action bubbles for any skill
 */

// Skill bubble configurations
const SKILL_BUBBLE_CONFIG = {
  mining: {
    icon: '⛏️',
    text: 'Mining',
    iconClass: 'mining'
  },
  woodcutting: {
    icon: '🪓',
    text: 'Woodcutting', 
    iconClass: 'woodcutting'
  },
  fletching: {
    icon: '🪶',
    text: 'Fletching',
    iconClass: 'fletching'
  },
  scribing: {
    icon: '📜',
    text: 'Scribing',
    iconClass: 'scribing'
  },
      fishing: {
      icon: '🎣',
      text: 'Fishing',
      iconClass: 'fishing'
    },
  cooking: {
    icon: '🍖',
    text: 'Cooking',
    iconClass: 'cooking'
  },
  smithing: {
    icon: '🔨',
    text: 'Smithing',
    iconClass: 'smithing'
  },
  crafting: {
    icon: '💍',
    text: 'Crafting',
    iconClass: 'crafting'
  },
  harvesting: {
    icon: '🍄',
    text: 'Harvesting',
    iconClass: 'harvesting'
  },
  digging: {
    icon: '🪏',
    text: 'Digging',
    iconClass: 'digging'
  },
  // Add more skills as needed
};

// Track active skill bubbles
const activeSkillBubbles = new Map();

// Define skill-specific icons
const SKILL_ICONS = {
  mining: '⛏️',
  woodcutting: '🪓',
  fishing: '🎣',
  smithing: '🔨',
  crafting: '🛠️',
  cooking: '🍳',
  farming: '🌱',
  scribing: '📜',
  harvesting: '🌾'
};

/**
 * Show a skill action bubble on the player
 * @param {string} skillName - The name of the skill (e.g., 'mining', 'woodcutting')
 * @param {string} customText - Optional custom text to override default
 * @param {string} customIcon - Optional custom icon to override default
 */
function showSkillBubble(skillName, customText = null, customIcon = null) {
  // Hide any existing bubble first
  hideSkillBubble();
  
  const config = SKILL_BUBBLE_CONFIG[skillName];
  if (!config && !customIcon) {
    console.warn(`Skill bubble config not found for: ${skillName}`);
    return;
  }
  
  const playerElement = document.getElementById('player-character');
  if (!playerElement) {
    console.error('Player character element not found');
    return;
  }
  
  // Create bubble container
  const bubbleContainer = document.createElement('div');
  bubbleContainer.className = 'skill-bubble-container';
  bubbleContainer.id = 'active-skill-bubble';
  
  // Create bubble
  const bubble = document.createElement('div');
  bubble.className = 'skill-bubble';
  
  // Create icon
  const iconElement = document.createElement('span');
  iconElement.className = 'skill-bubble-icon';
  if (config) {
    iconElement.classList.add(config.iconClass);
  }
  iconElement.textContent = customIcon || (config ? config.icon : '⚡');
  
  // Create text
  const textElement = document.createElement('span');
  textElement.textContent = customText || (config ? config.text : skillName);
  
  // Create tail
  const tail = document.createElement('div');
  tail.className = 'skill-bubble-tail';
  
  // Assemble bubble
  bubble.appendChild(iconElement);
  bubble.appendChild(textElement);
  bubble.appendChild(tail);
  bubbleContainer.appendChild(bubble);
  
  // Add to player
  playerElement.appendChild(bubbleContainer);
  
  // Track the active bubble
  activeSkillBubbles.set('player', {
    skillName: skillName,
    element: bubbleContainer
  });
  
  // Sync with multiplayer server if online
  if (window.isUserOnline && window.isUserOnline() && window.syncActionBubbleShow) {
    window.syncActionBubbleShow(skillName, customText, customIcon);
  }
  
  console.log(`Skill bubble shown: ${skillName}`);
}

/**
 * Hide the current skill action bubble
 */
function hideSkillBubble() {
  const existingBubble = document.getElementById('active-skill-bubble');
  if (existingBubble) {
    existingBubble.remove();
    activeSkillBubbles.delete('player');
    
    // Sync with multiplayer server if online
    if (window.isUserOnline && window.isUserOnline() && window.syncActionBubbleHide) {
      window.syncActionBubbleHide();
    }
    
    console.log('Skill bubble hidden');
  }
}

/**
 * Update the text of the current skill bubble
 * @param {string} newText - New text to display
 */
function updateSkillBubbleText(newText) {
  const existingBubble = document.getElementById('active-skill-bubble');
  if (existingBubble) {
    const textElement = existingBubble.querySelector('.skill-bubble span:not(.skill-bubble-icon)');
    if (textElement) {
      textElement.textContent = newText;
    }
  }
}

/**
 * Check if a skill bubble is currently active
 * @returns {boolean}
 */
function isSkillBubbleActive() {
  return activeSkillBubbles.has('player');
}

/**
 * Get the currently active skill name
 * @returns {string|null}
 */
function getActiveSkillName() {
  const activeSkill = activeSkillBubbles.get('player');
  return activeSkill ? activeSkill.skillName : null;
}

/**
 * Add a new skill configuration
 * @param {string} skillName - The skill name
 * @param {object} config - Configuration object with icon, text, iconClass
 */
function addSkillConfig(skillName, config) {
  SKILL_BUBBLE_CONFIG[skillName] = config;
}

/**
 * Show a temporary skill bubble for a specific duration
 * @param {string} skillName - The skill name
 * @param {number} duration - Duration in milliseconds
 * @param {string} customText - Optional custom text
 * @param {string} customIcon - Optional custom icon
 */
function showTemporarySkillBubble(skillName, duration = 2000, customText = null, customIcon = null) {
  showSkillBubble(skillName, customText, customIcon);
  
  setTimeout(() => {
    hideSkillBubble();
  }, duration);
}

// Export functions for use by other modules
export {
  showSkillBubble,
  hideSkillBubble,
  updateSkillBubbleText,
  isSkillBubbleActive,
  getActiveSkillName,
  addSkillConfig,
  showTemporarySkillBubble,
  SKILL_BUBBLE_CONFIG
}; 