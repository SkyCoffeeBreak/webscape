/**
 * Storage module for WebscapeRPG
 * Handles saving and loading user data to/from local storage
 */

import { createNewProfile } from './user.js';

// Storage keys
const STORAGE_KEYS = {
  CURRENT_USER: 'webscape_current_user',
  USER_PREFIX: 'webscape_user_',
  SETTINGS: 'webscape_settings'
};

// Save user profile to local storage
function saveUserProfile(profile) {
  if (!profile || !profile.username) {
    console.error('Invalid profile data');
    return false;
  }
  
  try {
    // Save the profile data
    const key = `${STORAGE_KEYS.USER_PREFIX}${profile.username.toLowerCase()}`;
    localStorage.setItem(key, JSON.stringify(profile));
    
    // Update current user
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, profile.username.toLowerCase());
    
    return true;
  } catch (error) {
    console.error('Error saving user profile:', error);
    return false;
  }
}

// Load user profile from local storage
function loadUserProfile(username) {
  try {
    // If no username specified, try to load the current user
    if (!username) {
      const currentUser = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      if (!currentUser) return null;
      username = currentUser;
    }
    
    const key = `${STORAGE_KEYS.USER_PREFIX}${username.toLowerCase()}`;
    const profileData = localStorage.getItem(key);
    
    if (!profileData) return null;
    
    return JSON.parse(profileData);
  } catch (error) {
    console.error('Error loading user profile:', error);
    return null;
  }
}

// Get all saved user profiles
function getAllProfiles() {
  try {
    const profiles = [];
    const prefix = STORAGE_KEYS.USER_PREFIX;
    
    // Loop through localStorage keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      
      if (key && key.startsWith(prefix)) {
        const profileData = localStorage.getItem(key);
        if (profileData) {
          profiles.push(JSON.parse(profileData));
        }
      }
    }
    
    return profiles;
  } catch (error) {
    console.error('Error getting all profiles:', error);
    return [];
  }
}

// Delete a user profile
function deleteUserProfile(username) {
  if (!username) return false;
  
  try {
    const key = `${STORAGE_KEYS.USER_PREFIX}${username.toLowerCase()}`;
    localStorage.removeItem(key);
    
    // If this was the current user, clear that too
    const currentUser = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (currentUser && currentUser.toLowerCase() === username.toLowerCase()) {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    }
    
    return true;
  } catch (error) {
    console.error('Error deleting user profile:', error);
    return false;
  }
}

// Save game settings
function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    return true;
  } catch (error) {
    console.error('Error saving settings:', error);
    return false;
  }
}

// Load game settings
function loadSettings() {
  try {
    const settingsData = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    return settingsData ? JSON.parse(settingsData) : null;
  } catch (error) {
    console.error('Error loading settings:', error);
    return null;
  }
}

// Initialize storage and load or create user profile
function initializeStorage() {
  // Try to load existing profile
  let profile = loadUserProfile();
  
  // If no profile exists, create a new one
  if (!profile) {
    profile = createNewProfile();
    saveUserProfile(profile);
  }
  
  return profile;
}

// Export all functions
export {
  saveUserProfile,
  loadUserProfile,
  getAllProfiles,
  deleteUserProfile,
  saveSettings,
  loadSettings,
  initializeStorage
}; 