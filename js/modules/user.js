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
    head: null,
    body: null,
    legs: null,
    feet: null,
    hands: null,
    weapon: null,
    shield: null,
    neck: null,
    ring: null
  },
  
  // Bank storage
  bank: [],
  
  // World position and state
  position: {
    x: 50,
    y: 50,
    mapLevel: 'surface' // Track which map level player is on
  },
  
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
  getSavedPlayerPosition
}; 