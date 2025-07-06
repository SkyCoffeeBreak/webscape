/**
 * User module for WebscapeRPG
 * Manages user profile, character data, and player statistics
 */

import { skillsData, calculateTotalLevel } from './skills.js';

// Default user profile template
const defaultUserProfile = {
  // Basic user info
  username: 'Adventurer',
  createdAt: null,
  lastLogin: null,
  
  // Character info
  character: {
    name: 'Adventurer',
    gender: 'neutral',
    combatLevel: 3,
    questPoints: 0
  },
  
  // Skills info (current level and experience)
  skills: { ...skillsData }, // Copies the default skills
  skillsExp: Object.keys(skillsData).reduce((obj, skill) => {
    obj[skill] = skill === 'hitpoints' ? 1154 : 0; // Level 10 hitpoints = 1154 XP
    return obj;
  }, {}),
  
  // Stats tracking
  stats: {
    monstersKilled: 0,
    totalDamageDealt: 0,
    totalDamageTaken: 0,
    itemsCrafted: 0,
    resourcesGathered: 0,
    questsCompleted: 0,
    distanceTraveled: 0,
    playtime: 0 // in seconds
  },
  
  // Game progress
  progress: {
    tutorialCompleted: false,
    unlockedAreas: ['Lumbridge'], // Starting area
    activeQuests: [],
    completedQuests: []
  },
  
  // Inventory and equipment
  inventory: [],
  equipment: {
    helmet: null,
    amulet: null,
    arrows: null,
    weapon: null,
    body: null,
    shield: null,
    legs: null,
    gloves: null,
    boots: null,
    cape: null,
    ring: null,
    ring2: null
  },
  
  // Bank storage
  bank: [],
  
  // World position and state
  position: {
    x: 50,
    y: 50,
    mapLevel: 'surface' // Track which map level player is on
  },
  
  // Player form (for Shifting skill)
  playerForm: 'human',
  
  // Game settings
  settings: {
    musicVolume: 0.5,
    soundVolume: 0.7,
    difficulty: 'normal',
    showTips: true
  }
};

// Create a new user profile
function createNewProfile(username = 'Adventurer', characterName = 'Adventurer') {
  const newProfile = JSON.parse(JSON.stringify(defaultUserProfile)); // Deep clone
  
  // Set user-specific data
  newProfile.username = username;
  newProfile.character.name = characterName;
  newProfile.createdAt = new Date().toISOString();
  newProfile.lastLogin = new Date().toISOString();
  
  return newProfile;
}

// Calculate combat level based on combat skills
function calculateCombatLevel(skills) {
  // Make sure all skills are defined
  const defence = skills.defence || 1;
  const hitpoints = skills.hitpoints || 10;
  const prayer = skills.prayer || 1;
  const attack = skills.attack || 1;
  // Use attack as strength since we don't have a separate strength skill
  const strength = skills.attack || 1;
  const ranged = skills.ranged || 1;
  const magic = skills.magic || 1;
  const blasting = skills.blasting || 1;
  
  const base = 0.25 * (defence + hitpoints + Math.floor(prayer / 2));
  const melee = 0.325 * (attack + strength);
  const rangedCombat = 0.325 * (Math.floor(3 * ranged / 2));
  const magicCombat = 0.325 * (Math.floor(3 * magic / 2));
  const blastingCombat = 0.325 * (Math.floor(3 * blasting / 2));
  
  const combat = Math.floor(base + Math.max(melee, rangedCombat, magicCombat, blastingCombat));
  
  return Math.max(3, combat); // Minimum combat level is 3
}

// Update the user's profile with playtime
function updatePlaytime(profile, secondsPlayed) {
  // Ensure stats object exists
  if (!profile.stats) {
    profile.stats = {
      monstersKilled: 0,
      totalDamageDealt: 0,
      totalDamageTaken: 0,
      itemsCrafted: 0,
      resourcesGathered: 0,
      questsCompleted: 0,
      distanceTraveled: 0,
      playtime: 0
    };
  }
  
  // Ensure playtime exists
  if (typeof profile.stats.playtime !== 'number') {
    profile.stats.playtime = 0;
  }
  
  profile.stats.playtime += secondsPlayed;
  return profile;
}

// Update login timestamp
function updateLoginTimestamp(profile) {
  profile.lastLogin = new Date().toISOString();
  return profile;
}

// Save player's map level to profile
function saveMapLevel(profile, mapLevel) {
  // Ensure position object exists
  if (!profile.position) {
    profile.position = {
      x: 50,
      y: 50,
      mapLevel: 'surface'
    };
  }
  
  profile.position.mapLevel = mapLevel;
  return profile;
}

// Get player's saved map level from profile
function getSavedMapLevel(profile) {
  if (profile.position && profile.position.mapLevel) {
    return profile.position.mapLevel;
  }
  return 'surface'; // Default to surface
}

// Save player's position to profile
function savePlayerPosition(profile, x, y, mapLevel = null) {
  // Ensure position object exists
  if (!profile.position) {
    profile.position = {
      x: 50,
      y: 50,
      mapLevel: 'surface'
    };
  }
  
  profile.position.x = x;
  profile.position.y = y;
  
  if (mapLevel !== null) {
    profile.position.mapLevel = mapLevel;
  }
  
  return profile;
}

// Get player's saved position from profile
function getSavedPlayerPosition(profile) {
  if (profile.position) {
    return {
      x: profile.position.x || 50,
      y: profile.position.y || 50,
      mapLevel: profile.position.mapLevel || 'surface'
    };
  }
  return { x: 50, y: 50, mapLevel: 'surface' };
}

// Player form management - linked to Shifting skill
let playerForm = 'human'; // Default form (changed from slime)

// Form definitions - each form can have different sprites and properties
const playerForms = {
  human: {
    name: 'Human',
    idle: 'images/player/human_idle.gif',
    walk: 'images/player/human_walk.gif',
    icon: '🧑',
    description: 'The default human form',
    unlocked: true // Always available
  },
  slime: {
    name: 'Slime',
    sprite: 'images/player/slime.png',
    icon: '🟢',
    description: 'A simple but friendly slime form',
    unlocked: true // Always available
  }
  // More forms can be added based on Shifting skill level
};

// Get current player form
function getPlayerForm() {
  return playerForm;
}

// Set player form (unlocks based on Shifting skill)
function setPlayerForm(form) {
  if (playerForms[form] && playerForms[form].unlocked) {
    playerForm = form;
    
    // Update player sprite in the world
    updatePlayerSprite();
    
    // Save form to user profile if available
    if (typeof window !== 'undefined') {
      // Update in current profile if it exists
      if (window.currentUserProfile) {
        savePlayerForm(window.currentUserProfile, form);
      }
      
      // Trigger save game if available
      if (window.saveGame) {
        window.saveGame();
      }
    }
    
    console.log(`Player form changed to: ${form}`);
    return true;
  }
  return false;
}

// Update player sprite appearance
function updatePlayerSprite(isMoving = false) {
  console.log('🎭 updatePlayerSprite called, isMoving:', isMoving);
  const player = document.getElementById('player-character');
  if (!player) {
    console.log('🎭 No player element found');
    return;
  }
  
  const form = playerForms[playerForm];
  if (!form) {
    console.log('🎭 No form data found for:', playerForm);
    return;
  }
  
  // Cache current sprite to prevent unnecessary changes that cause flickering
  const currentSprite = player.style.backgroundImage;
  
  // Determine which sprite to use
  let spriteUrl;
  if (form.idle && form.walk) {
    // Form has animation support
    spriteUrl = isMoving ? form.walk : form.idle;
    console.log('🎭 Using animated sprite:', spriteUrl, 'for form:', playerForm);
  } else {
    // Form uses single sprite
    spriteUrl = form.sprite;
    console.log('🎭 Using static sprite:', spriteUrl, 'for form:', playerForm);
  }
  
  // Only update sprite if it actually changed (prevents flickering)
  const newSpriteStyle = `url('${spriteUrl}')`;
  if (currentSprite !== newSpriteStyle) {
    // Defer sprite update to next frame to prevent racing with movement state changes
    requestAnimationFrame(() => {
      // Double-check player element still exists
      if (!document.getElementById('player-character')) return;
      
      // Get current grid size for pixel-perfect scaling
      const gridSize = window.worldModule?.getGridSize ? window.worldModule.getGridSize() : 32;
      const pixelRatio = calculatePixelPerfectRatio(gridSize, 32); // 32 is base sprite size
      
      // Set background image instead of color - optimized for pixel-perfect rendering
      player.style.backgroundColor = 'transparent';
      player.style.backgroundImage = newSpriteStyle;
      
      // Use pixel-perfect scaling instead of percentage
      const scaledSize = `${32 * pixelRatio}px`;
      player.style.backgroundSize = `${scaledSize} ${scaledSize}`;
      player.style.backgroundRepeat = 'no-repeat';
      player.style.backgroundPosition = 'center';
      
      // Remove circular border for sprites
      player.style.borderRadius = '0';
      
      console.log('🎭 Player sprite updated with pixel-perfect scaling:', {
        gridSize,
        pixelRatio,
        scaledSize,
        backgroundImage: newSpriteStyle
      });
    });
  }
  
  // Store current facing direction for sprite flipping
  if (!player.dataset.facing) {
    player.dataset.facing = 'right'; // Default facing right
  }
  
  // Apply initial facing direction (only if not currently set to prevent conflicts)
  if (!player.dataset.facingApplied || player.dataset.facingApplied !== player.dataset.facing) {
    applyPlayerFacing(player.dataset.facing);
  }
}

// Calculate pixel-perfect scaling ratio for sprites
function calculatePixelPerfectRatio(targetSize, spriteSize) {
  // Calculate the closest integer ratio that doesn't exceed target size
  const exactRatio = targetSize / spriteSize;
  const pixelRatio = Math.max(1, Math.floor(exactRatio));
  
  console.log(`🎯 Pixel ratio calculation: target=${targetSize}px, sprite=${spriteSize}px, exact=${exactRatio.toFixed(2)}, pixel-perfect=${pixelRatio}x`);
  
  return pixelRatio;
}

// Apply facing direction to player sprite
function applyPlayerFacing(direction) {
  const player = document.getElementById('player-character');
  if (!player) return;
  
  // Store facing direction
  player.dataset.facing = direction;
  player.dataset.facingApplied = direction;
  
  // Determine if sprite should be flipped based on direction
  let scaleX = 1; // Default (facing right)
  
  if (direction === 'west' || direction === 'northwest' || direction === 'southwest') {
    scaleX = -1; // Flip for left-facing
  }
  
  // Apply transform with direction offset and flip
  let transform = `scaleX(${scaleX})`;
  
  // Add slight movement offset for direction indication (like original system)
  // Reduced offset to minimize flicker
  switch (direction) {
    case 'north':
      transform += ' translateY(-1px)';
      break;
    case 'northeast':
      transform += ' translate(1px, -1px)';
      break;
    case 'east':
      transform += ' translateX(1px)';
      break;
    case 'southeast':
      transform += ' translate(1px, 1px)';
      break;
    case 'south':
      transform += ' translateY(1px)';
      break;
    case 'southwest':
      transform += ' translate(-1px, 1px)';
      break;
    case 'west':
      transform += ' translateX(-1px)';
      break;
    case 'northwest':
      transform += ' translate(-1px, -1px)';
      break;
  }
  
  // Only apply transform if it's different from current to prevent flicker
  if (player.style.transform !== transform) {
    player.style.transform = transform;
  }
}

// Set player movement state (triggers animation change)
function setPlayerMoving(isMoving) {
  const player = document.getElementById('player-character');
  if (!player) return;
  
  // Only update if movement state actually changed to prevent unnecessary sprite updates
  const currentMovingState = player.dataset.isMoving === 'true';
  if (currentMovingState === isMoving) {
    return; // No change needed
  }
  
  // Store movement state
  player.dataset.isMoving = isMoving.toString();
  
  // Delay sprite update slightly to prevent racing with movement initiation
  setTimeout(() => {
    // Update sprite based on movement state
    updatePlayerSprite(isMoving);
    console.log(`🎭 Player movement state: ${isMoving ? 'moving' : 'idle'}`);
  }, 10); // Small delay to prevent racing with movement state changes
}

// Get available forms based on Shifting skill level
function getAvailableForms() {
  return Object.keys(playerForms).filter(form => playerForms[form].unlocked);
}

// Unlock new forms based on Shifting skill progression
function checkFormUnlocks() {
  // Get shifting level from skills module if available
  let shiftingLevel = 1;
  if (typeof window !== 'undefined' && window.skillsModule && window.skillsModule.getSkillLevel) {
    shiftingLevel = window.skillsModule.getSkillLevel('shifting');
  }
  
  // Add more forms as shifting level increases
  // Example: if (shiftingLevel >= 10) playerForms.wolf.unlocked = true;
}

// Save player form to profile
function savePlayerForm(profile, form) {
  profile.playerForm = form;
  return profile;
}

// Load player form from profile
function loadPlayerForm(profile) {
  if (profile.playerForm && playerForms[profile.playerForm]) {
    playerForm = profile.playerForm;
    // Update sprite if player element exists
    setTimeout(() => {
      updatePlayerSprite();
    }, 100);
  }
  return playerForm;
}

// Also add to window for compatibility with existing modules
if (typeof window !== 'undefined') {
  window.userModule = {
    defaultUserProfile,
    createNewProfile,
    calculateCombatLevel,
    updatePlaytime,
    updateLoginTimestamp,
    saveMapLevel,
    getSavedMapLevel,
    savePlayerPosition,
    getSavedPlayerPosition,
    getPlayerForm,
    setPlayerForm,
    updatePlayerSprite,
    applyPlayerFacing,
    setPlayerMoving,
    getAvailableForms,
    checkFormUnlocks,
    playerForms,
    savePlayerForm,
    loadPlayerForm,
    calculatePixelPerfectRatio
  };
}

// Export all functions and data
export {
  defaultUserProfile,
  createNewProfile,
  calculateCombatLevel,
  updatePlaytime,
  updateLoginTimestamp,
  saveMapLevel,
  getSavedMapLevel,
  savePlayerPosition,
  getSavedPlayerPosition,
  getPlayerForm,
  setPlayerForm,
  updatePlayerSprite,
  applyPlayerFacing,
  setPlayerMoving,
  getAvailableForms,
  checkFormUnlocks,
  playerForms,
  savePlayerForm,
  loadPlayerForm,
  calculatePixelPerfectRatio
}; 