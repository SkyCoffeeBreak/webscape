/**
 * Main JavaScript file for WebscapeRPG
 * Initializes the game and coordinates between modules
 */

import { initializeStorage, saveUserProfile, saveSettings } from './modules/storage.js';
import { updateLoginTimestamp, updatePlaytime, calculateCombatLevel, saveMapLevel, getSavedMapLevel, savePlayerPosition, getSavedPlayerPosition } from './modules/user.js';
import { initializeSkillsUI, incrementSkill, decrementSkill, addExperienceToSkill, updateSkillDisplay, updateTotalLevel, resetSkills, updateSkillExperienceBar, updateAllExperienceBars } from './modules/ui.js';
import { calculateTotalLevel } from './modules/skills.js';
import { initializeTabs } from './modules/tabs.js';
import { initializeWorld, resetWorld, getPlayerPosition, getCameraPosition, getWorldBounds, getGridSize, isPositionWalkable, movePlayerToTarget, movePlayerToInteractiveTarget, findPath, updatePlayerDirection, updatePlayerAppearance, forceWorldRerender } from './modules/world.js';
import { initializeInventory, updateAllFloorItemPositions, resetInventory, getFloorItemsAt, getItemDefinition, pickupFloorItem, spawnItemNearPlayer, addRandomItemToInventory, openBank, createFloorItem, addItemToInventory, removeItemFromInventory, playerInventory, updateInventoryDisplay, openShop, closeShop, dropItem } from './modules/inventory.js';
import { openBank as openNewBank, closeBank, depositItem, withdrawItem, displayBankInterface, handleBankMessage, syncBankFromServer, getBankData, isBankOpen } from './modules/bank.js';
import { initializeMapEditor, hasCustomMap, getCustomMap } from './modules/mapeditor.js';
import { initializeChat, showNotification, addMessage, sendEmoteMessage, showSpeechBubble, MESSAGE_TYPES } from './modules/chat.js';
import { initializeMining, cancelMining, isMining, handleMovementComplete, startMining, startMiningApproved, startMiningDenied, depleteOreConfirmed, depleteOreDenied, respawnOreFromServer } from './modules/skills/mining.js';
import { initializeWoodcutting, startWoodcutting, startWoodcuttingApproved, startWoodcuttingDenied, cancelWoodcutting, isWoodcutting, handleMovementComplete as woodcuttingHandleMovementComplete, addTreeInteractionHandlers, depleteTreeConfirmed, depleteTreeDenied, respawnTreeFromServer } from './modules/skills/woodcutting.js';
import { initializeFletching, handleFletchingInteraction, startFletching, cancelFletching, isFletching, getActiveFletchingSession } from './modules/skills/fletching.js';
import { initializeFishing, handleFishingSpotClick, startFishing, startFishingApproved, startFishingDenied, depleteFishingSpotConfirmed, depleteFishingSpotDenied, respawnFishingSpotFromServer, cancelFishing, isFishing, handleMovementComplete as fishingHandleMovementComplete, getActiveFishingSession } from './modules/skills/fishing.js';
import { initializeScribing, cancelScribing, isScribing, handleMovementComplete as scribingHandleMovementComplete, addPulpBasinInteractionHandlers, getActiveScribingSession, handlePulpBasinClickFromWorld, handleScribingTableClick, handleScribingTableMovementComplete, closeScribingTableInterface, switchScribingTab, startBookWriting, continueBookWriting, startScrollWriting, startScrollWritingWithQuantity } from './modules/skills/scribing.js';
import { initializeCooking, startCooking, cancelCooking, isCooking, handleMovementComplete as cookingHandleMovementComplete, getActiveCookingSession } from './modules/skills/cooking.js';
import { initializeHarvesting, startHarvesting, cancelHarvesting, isHarvesting, handleMovementComplete as harvestingHandleMovementComplete, syncHarvestingNodeDepleted, syncHarvestingNodeRespawned, HARVESTING_NODES } from './modules/skills/harvesting.js';
import { showSkillBubble, hideSkillBubble, showTemporarySkillBubble, isSkillBubbleActive, getActiveSkillName } from './modules/skillBubbles.js';
import { initializeMultiplayer, setMultiplayerCallbacks, sendPlayerMove, sendChatMessage, getCurrentUser, isUserOnline, getOnlineStatus, loadWorldFromServer, sendPlayerColorUpdate, getOnlinePlayers, savePlayerDataToServer, syncSkillsWithServer, syncInventoryWithServer, syncHitpointsWithServer, getMultiplayerSyncStatus, syncActionBubbleShow, syncActionBubbleHide, syncResourceDepleted, syncResourceRespawned, sendResourceDepletionRequest, sendResourceActionRequest, getWebSocket } from './modules/multiplayer.js';
import { sendShopBuyRequest, sendShopSellRequest } from './modules/multiplayer.js';
import { initializeNPCs, handleNPCData, handleNPCMove, handleNPCStop, handleNPCResume, handleNPCRemove, updateAllNPCPositions, requestNPCData, updateNPCHealth, getNPC } from './modules/npcs.js';
import { initializeCombat } from './modules/combat.js';
import { initializeDayNight, toggleDayNightCycle, getCurrentTimeInfo, setTimePeriod, cleanup as cleanupDayNight } from './modules/dayNight.js';
import { initializeDigging, startDigging, cancelDigging, isDigging, handleMovementComplete as diggingHandleMovementComplete, getActiveDiggingSession, handleShovelInteraction, syncDiggingHolesFromServer, handleDiggingHoleMessage, hasDiggingHole, getActiveDiggingHoles, SHOVEL_DEFINITIONS } from './modules/skills/digging.js';

// Global variables
let userProfile = null;
let startTime = null;
let playtimeInterval = null;
let gameWorld = null;
let onlinePlayers = new Map(); // Store online player elements
// Store health updates that arrive before player DOM element is ready
const pendingOnlineHP = new Map(); // username -> {cur,max}

// HUD Hitpoints element for local player
let hudHPElement = null;

function ensureHUDHPElement() {
  if (hudHPElement) return hudHPElement;
  const gameArea = document.querySelector('.game-area') || document.body;
  hudHPElement = document.createElement('div');
  hudHPElement.id = 'hud-hp-display';
  hudHPElement.style.cssText = `
    position: absolute;
    bottom: 20px;
    left: 20px;
    padding: 6px 10px;
    background: rgba(0,0,0,0.6);
    color: #fff;
    font-weight: bold;
    font-size: 15px;
    border-radius: 6px;
    z-index: 30;
    pointer-events: none;
  `;
  gameArea.appendChild(hudHPElement);
  return hudHPElement;
}

function updateHUDHPDisplay(cur,max){
  const el = ensureHUDHPElement();
  el.textContent = `❤️  ${cur} / ${max}`;
}

// expose early (uiModule may not yet exist)
if(!window.uiModule) window.uiModule = {};
window.uiModule.updateHUDHPDisplay = updateHUDHPDisplay;

// Initialize the game
async function initGame() {
  console.log('Initializing WebscapeRPG...');
  
  // Mark as initialized for the fallback detection
  window.webscapeInitialized = true;
  
  // Load or create user profile
  userProfile = initializeStorage();
  
  // Update login timestamp
  userProfile = updateLoginTimestamp(userProfile);
  
  // Initialize UI with custom callbacks that include server sync
  const uiCallbacks = {
    onSkillChange: (updatedProfile) => {
      updateProfileInfo();
      // Sync skills with server if online
      if (isUserOnline()) {
        const totalLevel = calculateTotalLevel(updatedProfile.skills);
        const combatLevel = calculateCombatLevel(updatedProfile.skills);
        if (multiplayerSync.canSync) {
          syncSkillsWithServer(updatedProfile.skills, totalLevel, combatLevel, updatedProfile.skillsExp);
        }
      }
    }
  };
  
  initializeSkillsUI(userProfile, uiCallbacks);
  
  // Initialize tabs
  initializeTabs();
  
  // Expose modules to window for cross-module communication BEFORE initializing world
  window.inventoryModule = { 
    addItemToInventory,
    removeItemFromInventory,
    updateInventoryDisplay,
    pickupFloorItem,
    dropItem,
    openBank: openNewBank, // Use new bank system
    openShop,
    closeShop,
    createFloorItem,
    getItemDefinition,
    getFloorItemsAt,
    playerInventory,
    // Placeholder for addCustomItemToInventory - will be replaced by actual function from inventory.js
    addCustomItemToInventory: null,
    // Shop interface state and functions
    shopInterface: null, // Will be set after inventory module loads
    updateShopInventoryDisplay: null, // Will be set after inventory module loads  
    updateShopDisplay: null, // Will be set after inventory module loads
    // Shop synchronization functions
    syncShopsFromServer: (serverShops) => {
      // Use the actual function from inventory module if available
      if (window.inventoryModuleFunctions && window.inventoryModuleFunctions.syncShopsFromServer) {
        return window.inventoryModuleFunctions.syncShopsFromServer(serverShops);
      }
      console.error('🏪 Syncing shops from server (PLACEHOLDER - should use actual function)');
      return {};
    },
    // Inventory sync functions
    getPlayerInventory: () => playerInventory,
    syncInventoryFromServer: (serverInventory) => {
      console.log('📦 [DETAILED] Syncing inventory from server:', serverInventory.filter(item => item).length, 'items');
      
      // Log the full server inventory for debugging
      const serverItems = serverInventory.filter(item => item);
      console.log('📦 [DETAILED] Server inventory items:', serverItems);
      
      // Log current inventory before sync
      const currentItems = playerInventory.filter(item => item);
      console.log('📦 [DETAILED] Current inventory before sync:', currentItems);
      
      for (let i = 0; i < Math.min(serverInventory.length, playerInventory.length); i++) {
        playerInventory[i] = serverInventory[i] ? { ...serverInventory[i] } : null;
      }
      
      // Log inventory after sync
      const newItems = playerInventory.filter(item => item);
      console.log('📦 [DETAILED] Inventory after sync:', newItems);
      
      updateInventoryDisplay();
    },
    addItemToInventorySlot: (slotIndex, item) => {
      if (slotIndex >= 0 && slotIndex < playerInventory.length) {
        playerInventory[slotIndex] = item;
        updateInventoryDisplay();
      }
    },
    removeItemFromInventorySlot: (slotIndex) => {
      if (slotIndex >= 0 && slotIndex < playerInventory.length) {
        playerInventory[slotIndex] = null;
        updateInventoryDisplay();
      }
    },
    showNotification: (message, type = 'info') => {
      console.log(`📢 ${type.toUpperCase()}: ${message}`);
      // You can implement actual notification UI here
    }
  };
  
  // Set up the new bank module - make this available immediately
  window.bankModule = {
    openBank: openNewBank,
    closeBank,
    depositItem,
    withdrawItem,
    syncBankFromServer,
    getBankData,
    isBankOpen,
    displayBankInterface,
    handleBankMessage
  };
  
  console.log('🏦 Bank module initialized:', window.bankModule);
  
  window.worldModule = { 
    getPlayerPosition,
    getCameraPosition,
    getWorldBounds,
    getGridSize,
    isPositionWalkable,
    movePlayerToTarget,
    movePlayerToInteractiveTarget,
    findPath,
    updatePlayerDirection,
    updatePlayerAppearance,
    forceWorldRerender,
    // Map level functions will be added after world initialization
    getCurrentMapLevel: null,
    setCurrentMapLevel: null,
    setPlayerPosition: null,
    getTileOnLayer: null
  };
  window.uiModule = {
    updateSkillDisplay: updateSkillDisplay,
    updateTotalLevel: updateTotalLevel,
    showNotification: showNotification,
    updateSkillExperienceBar: updateSkillExperienceBar,
    updateAllExperienceBars: updateAllExperienceBars,
    updateCurrentHPDisplay: window.uiModule?.updateCurrentHPDisplay || (()=>{})
  };
  window.userModule = {
    getProfile: () => userProfile,
    saveProfile: () => saveGame(),
    saveMapLevel: (profile, mapLevel) => {
      saveMapLevel(profile, mapLevel);
      saveGame(); // Save after updating map level
    },
    getSavedMapLevel: (profile) => {
      return getSavedMapLevel(profile);
    },
    savePlayerPosition: (profile, x, y, mapLevel = null) => {
      savePlayerPosition(profile, x, y, mapLevel);
      saveGame(); // Save after updating position
    },
    getSavedPlayerPosition: (profile) => {
      return getSavedPlayerPosition(profile);
    }
  };
  window.miningModule = {
    startMining: startMining,
    startMiningApproved: startMiningApproved,
    startMiningDenied: startMiningDenied,
    cancelMining: cancelMining,
    isMining: isMining,
    handleMovementComplete: handleMovementComplete,
    depleteOreConfirmed: depleteOreConfirmed,
    depleteOreDenied: depleteOreDenied,
    respawnOreFromServer: respawnOreFromServer
  };
  
  // Expose woodcutting functions globally for world module  
  window.woodcuttingModule = {
    startWoodcutting: startWoodcutting,
    startWoodcuttingApproved: startWoodcuttingApproved,
    startWoodcuttingDenied: startWoodcuttingDenied,
    cancelWoodcutting: cancelWoodcutting,
    isWoodcutting: isWoodcutting,
    handleMovementComplete: woodcuttingHandleMovementComplete,
    addTreeInteractionHandlers: addTreeInteractionHandlers,
    depleteTreeConfirmed: depleteTreeConfirmed,
    depleteTreeDenied: depleteTreeDenied,
    respawnTreeFromServer: respawnTreeFromServer
  };
  
  // Expose fletching functions globally for world module
  window.fletchingModule = {
    handleFletchingInteraction: handleFletchingInteraction,
    startFletching: startFletching,
    cancelFletching: cancelFletching,
    isFletching: isFletching,
    getActiveFletchingSession: getActiveFletchingSession
  };
  
  // Expose scribing functions globally for world module
  window.scribingModule = {
    cancelScribing: cancelScribing,
    isScribing: isScribing,
    handleMovementComplete: scribingHandleMovementComplete,
    addPulpBasinInteractionHandlers: addPulpBasinInteractionHandlers,
    getActiveScribingSession: getActiveScribingSession,
    handlePulpBasinClick: handlePulpBasinClickFromWorld,
    // Scribing table functions
    handleScribingTableClick: handleScribingTableClick,
    handleScribingTableMovementComplete: handleScribingTableMovementComplete,
    closeScribingTableInterface: closeScribingTableInterface,
    switchScribingTab: switchScribingTab,
    startBookWriting: startBookWriting,
    continueBookWriting: continueBookWriting,
    startScrollWriting: startScrollWriting,
    startScrollWritingWithQuantity: startScrollWritingWithQuantity
  };
  
  // Expose harvesting functions globally for world module
  window.harvestingModule = {
    handleMovementComplete: harvestingHandleMovementComplete,
    getHarvestingNodes: () => HARVESTING_NODES,
    syncHarvestingNodeDepleted: syncHarvestingNodeDepleted,
    syncHarvestingNodeRespawned: syncHarvestingNodeRespawned
  };
  
  // Expose NPC functions globally
  window.npcModule = {
    handleNPCData: handleNPCData,
    handleNPCMove: handleNPCMove,
    handleNPCStop: handleNPCStop,
    handleNPCResume: handleNPCResume,
    handleNPCRemove: handleNPCRemove,
    updateAllNPCPositions: updateAllNPCPositions,
    updateNPCHealth: updateNPCHealth,
    getNPC: getNPC,
    requestNPCData: requestNPCData
  };
  
  // Expose individual woodcutting functions
  window.startWoodcutting = startWoodcutting;
  window.cancelWoodcutting = cancelWoodcutting;
  window.isWoodcutting = isWoodcutting;
  
  // Expose individual fletching functions
  window.startFletching = startFletching;
  window.cancelFletching = cancelFletching;
  window.isFletching = isFletching;
  
  // Expose individual fishing functions
      window.startFishing = startFishing;
    window.cancelFishing = cancelFishing;
    window.isFishing = isFishing;
    
    window.startHarvesting = startHarvesting;
    window.cancelHarvesting = cancelHarvesting;
    window.isHarvesting = isHarvesting;
  
  // Debug logging to verify exposure
  console.log('Exposed inventoryModule to window:', window.inventoryModule);
  console.log('pickupFloorItem function available:', typeof window.inventoryModule.pickupFloorItem);
  
  // Initialize game world
  await initializeWorldFromServer();
  
  // Add a small delay to ensure world module functions are fully exposed
  setTimeout(() => {
    // Restore saved map level and position after world initialization
    const savedPosition = getSavedPlayerPosition(userProfile);
    console.log('🗺️ Restoring saved player state:', savedPosition);
    
    // Restore map level
    if (window.worldModule && window.worldModule.setCurrentMapLevel) {
      window.worldModule.setCurrentMapLevel(savedPosition.mapLevel);
      console.log(`🌍 Map level restored to: ${savedPosition.mapLevel}`);
    }
    
    // Restore player position  
    if (window.worldModule && window.worldModule.setPlayerPosition) {
      window.worldModule.setPlayerPosition(savedPosition.x, savedPosition.y);
      console.log(`📍 Player position restored to: (${savedPosition.x}, ${savedPosition.y})`);
    }
  }, 100); // Small delay to ensure world module is fully initialized
  
  // Initialize NPC system
  const worldContainer = document.querySelector('.world-container');
  if (worldContainer) {
    initializeNPCs(worldContainer);
  }
  
  // Initialize inventory system
  initializeInventory();
  
  // Initialize mining system
  initializeMining();
  initializeWoodcutting();
  initializeFletching();
  initializeFishing();
  initializeScribing();
  initializeCooking();
  initializeHarvesting();
  initializeDigging();
  
  // Expose digging module functions globally immediately after initialization
  window.diggingModule = {
    startDigging,
    cancelDigging,
    isDigging,
    getActiveDiggingSession,
    handleShovelInteraction,
    syncDiggingHolesFromServer,
    handleDiggingHoleMessage,
    hasDiggingHole,
    getActiveDiggingHoles
  };
  
  // Initialize chat system
  initializeChat();
  
  // Initialize day-night cycle system (DISABLED)
  // initializeDayNight();
  
  // Enhanced chat integration for multiplayer
  enhanceChatForMultiplayer();
  
  // Initialize multiplayer system
  initializeMultiplayer();
  
  // Set up multiplayer callbacks
  setMultiplayerCallbacks({
    onPlayerMove: handleOnlinePlayerMove,
    onChatMessage: handleMultiplayerChatMessage,
    onUserProfileUpdate: handleUserProfileUpdate
  });
  
  // Enhanced integration for multiplayer
  enhanceMovementForMultiplayer();
  
  // Expose multiplayer functions globally
  window.sendPlayerColorUpdate = sendPlayerColorUpdate;
  window.updateOnlinePlayerPosition = updateOnlinePlayerPosition;
  window.updateAllOnlinePlayersPositions = updateAllOnlinePlayersPositions;
  window.refreshOnlinePlayerVisibility = refreshOnlinePlayerVisibility;
  window.isUserOnline = isUserOnline;
  window.sendChatMessage = sendChatMessage;
  window.showLocalChatMessage = showLocalChatMessage;
  window.addMessage = addMessage;
  window.showSpeechBubble = showSpeechBubble;
  window.sendEmoteMessage = sendEmoteMessage;
  window.sendPlayerMove = sendPlayerMove;
  window.getPlayerPosition = getPlayerPosition;
  
  // Expose day-night system functions globally (DISABLED)
  // window.dayNightModule = {
  //   toggleDayNightCycle: toggleDayNightCycle,
  //   getCurrentTimeInfo: getCurrentTimeInfo,
  //   setTimePeriod: setTimePeriod
  // };
  // window.getCurrentTimeInfo = getCurrentTimeInfo;
  // window.setTimePeriod = setTimePeriod;
  
  // Expose WebSocket for other modules to send messages
  window.getWebSocket = () => {
    return getWebSocket();
  };
  window.websocket = getWebSocket(); // For backward compatibility
  
  // Test functions for debugging
  window.testSpeechBubble = () => {
    console.log('Testing speech bubble...');
    showSpeechBubble('Test message');
  };
  
  window.testEmote = () => {
    console.log('Testing emote...');
    sendEmoteMessage('😀');
  };
  
  window.testChatMessage = () => {
    console.log('Testing chat message...');
    if (isUserOnline()) {
      sendChatMessage('Test chat message');
    } else {
      showLocalChatMessage('Test local message');
    }
  };
  
  // Debug functions for movement
  window.testMovement = () => {
    console.log('🧪 Testing movement system...');
    const currentPos = getPlayerPosition();
    console.log('📍 Current position:', currentPos);
    console.log('🌐 Is online:', isUserOnline());
    
    if (currentPos) {
      console.log('📡 Manually sending position update...');
      sendPlayerMove(currentPos);
    }
  };
  
  window.debugMovement = () => {
    console.log('🔍 Movement debugging info:');
    console.log('📍 Current position:', getPlayerPosition());
    console.log('🌐 Online status:', isUserOnline());
    console.log('🎮 World module:', !!window.worldModule);
    console.log('📡 Send player move function:', !!window.sendPlayerMove);
    console.log('👥 Online players count:', onlinePlayers.size);
    onlinePlayers.forEach((element, username) => {
      console.log(`  - ${username}: (${element.dataset.worldX}, ${element.dataset.worldY})`);
    });
  };
  
  window.forceMovementUpdate = () => {
    console.log('⚡ Forcing movement update for all online players...');
    onlinePlayers.forEach((element, username) => {
      console.log(`🔄 Updating ${username} position`);
      updateOnlinePlayerPosition(element, true);
    });
  };
  
  // Give player starting coins for testing
  addItemToInventory('coins', 1000);
  
  // Give player starting bronze pickaxe for mining testing
  addItemToInventory('bronze_pickaxe', 1);
  
  // Give player starting bronze axe for woodcutting testing
  addItemToInventory('bronze_axe', 1);
  
  // Give player starting bronze shovel for digging testing
  addItemToInventory('bronze_shovel', 1);
  
  // Give player starting fishing equipment for fishing testing
  addItemToInventory('small_net', 1);
  addItemToInventory('fishing_rod', 1);
  
  // Give player some raw fish for cooking testing
  addItemToInventory('raw_shrimps', 10);
  addItemToInventory('raw_sardine', 5);
  addItemToInventory('raw_tuna', 3);
  
  // Update inventory display to show the starting coins
  if (window.inventoryModule?.updateInventoryDisplay) {
    setTimeout(() => window.inventoryModule.updateInventoryDisplay(), 100);
  }
  
  // Initialize emotes
  initializeEmotes();
  
  // Apply saved player color if it exists
  if (userProfile.settings.playerColor) {
    updatePlayerColor(userProfile.settings.playerColor);
  }
  
  // Apply saved bubble opacity if it exists
  if (userProfile.settings.bubbleOpacity !== undefined) {
    updateBubbleOpacity(userProfile.settings.bubbleOpacity);
  } else {
    // Set default opacity if not set
    userProfile.settings.bubbleOpacity = 0.5;
    updateBubbleOpacity(0.5);
  }
  
  // Update character profile information
  updateProfileInfo();
  
  // Initialize settings
  initializeSettings();
  
  // Start playtime tracking
  startTime = Date.now();
  playtimeInterval = setInterval(updateUserPlaytime, 1000);
  
  // Set up window events
  window.addEventListener('beforeunload', saveGame);
  
  // Set up event delegation for skill controls
  document.addEventListener('click', function(event) {
    // Handle increment buttons
    if (event.target.matches('.skill-control.increment')) {
      const skillElement = event.target.closest('.skill');
      if (skillElement) {
        const skillName = skillElement.dataset.skill;
        const levelElement = skillElement.querySelector('.skill-level');
        if (levelElement) {
          const currentLevel = parseInt(levelElement.textContent);
          incrementSkill(skillName, currentLevel);
        }
      }
    }
    
    // Handle decrement buttons
    if (event.target.matches('.skill-control.decrement')) {
      const skillElement = event.target.closest('.skill');
      if (skillElement) {
        const skillName = skillElement.dataset.skill;
        const levelElement = skillElement.querySelector('.skill-level');
        if (levelElement) {
          const currentLevel = parseInt(levelElement.textContent);
          decrementSkill(skillName, currentLevel);
        }
      }
    }
  });
  
  console.log('WebscapeRPG initialized successfully!');
  
  // Expose functions to global scope for testing
  window.incrementSkill = (skillName) => incrementSkill(skillName, userProfile);
  window.decrementSkill = (skillName) => decrementSkill(skillName, userProfile);
  window.addExperience = (skillName, amount) => addExperienceToSkill(skillName, amount, userProfile);
  
  // Expose resetSkills function for the HTML button
  window.resetSkills = () => {
    resetSkills(userProfile);
    updateProfileInfo(); // Update the character profile info after reset
  };
  
  // Expose skill bubble functions for testing and other modules
  window.showSkillBubble = showSkillBubble;
  
  // Expose user profile globally for skill modules
  window.userProfile = userProfile;
  
  // Digging module functions already exposed earlier after initialization
  window.hideSkillBubble = hideSkillBubble;
  window.showTemporarySkillBubble = showTemporarySkillBubble;
  window.isSkillBubbleActive = isSkillBubbleActive;
  window.getActiveSkillName = getActiveSkillName;
  
  // Enhanced movement completion handler that supports multiple skill systems
  window.handleMovementComplete = function() {
    // Check mining targets
    if (window.miningModule && window.miningModule.handleMovementComplete) {
      window.miningModule.handleMovementComplete();
    }
    
    // Check woodcutting targets
    if (window.woodcuttingModule && window.woodcuttingModule.handleMovementComplete) {
      window.woodcuttingModule.handleMovementComplete();
    }
    
    // Check cooking targets
    if (window.cookingModule && window.cookingModule.handleMovementComplete) {
      window.cookingModule.handleMovementComplete();
    }
    
    // Try to resume harvesting after movement
    if (window.harvestingModule && window.harvestingModule.handleMovementComplete) {
      window.harvestingModule.handleMovementComplete();
    }
    
    if (window.combatModule && window.combatModule.handleMovementComplete) {
      window.combatModule.handleMovementComplete();
    }
  };
  
  // Expose multiplayer sync functions globally
  window.savePlayerDataToServer = savePlayerDataToServer;
  window.syncSkillsWithServer = syncSkillsWithServer;
  window.syncInventoryWithServer = syncInventoryWithServer;
  window.syncHitpointsWithServer = syncHitpointsWithServer;
  window.syncActionBubbleShow = syncActionBubbleShow;
  window.syncActionBubbleHide = syncActionBubbleHide;
  window.syncResourceDepleted = syncResourceDepleted;
  window.syncResourceRespawned = syncResourceRespawned;
  window.getMultiplayerSyncStatus = getMultiplayerSyncStatus;
  
  // Expose the new multiplayer module with server-authoritative functions
  window.multiplayerModule = {
    sendResourceDepletionRequest: sendResourceDepletionRequest,
    sendResourceActionRequest: sendResourceActionRequest,
    syncResourceDepleted: syncResourceDepleted,
    syncResourceRespawned: syncResourceRespawned
  };
  // Extend multiplayerModule with common getters so downstream modules (combat, npc, etc.) work reliably
  window.multiplayerModule.getWebSocket = getWebSocket;
  window.multiplayerModule.getCurrentUser = getCurrentUser;
  window.multiplayerModule.isUserOnline = isUserOnline;
  window.multiplayerModule.getOnlineStatus = getOnlineStatus;
  
  // Add skill calculation functions to window for server sync
  window.calculateTotalLevel = calculateTotalLevel;
  window.calculateCombatLevel = calculateCombatLevel;
  
  // Set up periodic data synchronization
  setupPeriodicDataSync();
  
  // Expose core game functions to window for cross-module communication
  window.showNotification = showNotification;
  window.getCurrentUser = getCurrentUser;
  window.isUserOnline = isUserOnline;
  window.getOnlineStatus = getOnlineStatus;
  window.getWebSocket = getWebSocket;
  window.sendShopBuyRequest = sendShopBuyRequest;
  window.sendShopSellRequest = sendShopSellRequest;
  
  initializeCombat();
  
  // near end of initGame after world init and before return
  if (window.uiModule?.updateHUDHPDisplay) {
    const hp = userProfile?.skills?.hitpoints || 10;
    window.uiModule.updateHUDHPDisplay(hp, hp);
  }
}

/**
 * Set up periodic synchronization of player data with server
 */
function setupPeriodicDataSync() {
  console.log('🔄 Setting up periodic data synchronization...');
  
  // Auto-save complete player data every 30 seconds
  setInterval(() => {
    if (isUserOnline() && userProfile) {
      const currentPosition = getPlayerPosition();
      if (currentPosition) {
        const playerData = {
          position: currentPosition,
          skills: userProfile.skills,
          skillsExp: userProfile.skillsExp || {}, // Include skill experience in periodic sync
          inventory: window.inventoryModule?.playerInventory || [],
          totalLevel: userProfile.totalLevel,
          combatLevel: userProfile.combatLevel,
          completedBooks: userProfile.completedBooks || []
        };
        
        console.log('🔄 Auto-saving player data to server...');
        savePlayerDataToServer(playerData);
      }
    }
  }, 30000); // Every 30 seconds
  
  // More frequent inventory sync (every 10 seconds) for recent changes
  let lastInventorySync = 0;
  setInterval(() => {
    if (isUserOnline() && window.inventoryModule?.playerInventory) {
      const now = Date.now();
      // Only sync if it's been at least 8 seconds since last sync to avoid spam
      if (now - lastInventorySync > 8000) {
        syncInventoryWithServer(window.inventoryModule.playerInventory);
        lastInventorySync = now;
      }
    }
  }, 10000); // Every 10 seconds
  
  console.log('✅ Periodic data synchronization set up');
}

/**
 * Enhanced save game function that syncs with server
 */
function saveGame() {
  if (!userProfile) return;
  
  // Update playtime before saving
  updateUserPlaytime();
  
  // Save profile locally
  const saved = saveUserProfile(userProfile);
  
  // Also save to server if online
  if (isUserOnline()) {
    const currentPosition = getPlayerPosition();
    const playerData = {
      position: currentPosition,
      skills: userProfile.skills,
      skillsExp: userProfile.skillsExp || {}, // Include skill experience in server sync
      inventory: window.inventoryModule?.playerInventory || [],
      totalLevel: userProfile.totalLevel,
      combatLevel: userProfile.combatLevel,
      completedBooks: userProfile.completedBooks || [] // Include completed books in server sync
    };
    
    savePlayerDataToServer(playerData);
    console.log(`Game saved locally and synced to server at ${new Date().toLocaleTimeString()}`);
  } else {
    console.log(`Game saved locally at ${new Date().toLocaleTimeString()}`);
  }
}

/**
 * Enhanced inventory sync function
 */
function syncInventoryIfOnline() {
  if (isUserOnline() && window.inventoryModule?.playerInventory) {
    syncInventoryWithServer(window.inventoryModule.playerInventory);
  }
}

/**
 * Enhanced skills sync function
 */
function syncSkillsIfOnline() {
  if (isUserOnline() && userProfile) {
    const totalLevel = calculateTotalLevel(userProfile.skills);
    const combatLevel = calculateCombatLevel(userProfile.skills);
    if (multiplayerSync.canSync) {
      syncSkillsWithServer(userProfile.skills, totalLevel, combatLevel, userProfile.skillsExp);
    }
  }
}

// Multiplayer Integration Functions

/**
 * Handle online player movement and visualization
 */
function handleOnlinePlayerMove(username, position, profile, movementData) {
  console.log(`🎮 handleOnlinePlayerMove called for ${username}:`, position, movementData);
  
  const gameWorld = document.querySelector('.game-world');
  if (!gameWorld) {
    console.warn('⚠️ Game world not found');
    return;
  }
  
  if (position === null) {
    // Remove player
    console.log(`❌ Removing player: ${username}`);
    removeOnlinePlayer(username);
    return;
  }
  
  // Check if player is on the same map level as current player
  const currentMapLevel = window.worldModule?.getCurrentMapLevel ? window.worldModule.getCurrentMapLevel() : 'surface';
  const playerMapLevel = position?.mapLevel || profile?.position?.mapLevel || 'surface';
  
  if (playerMapLevel !== currentMapLevel) {
    // Hide player if not on same map level
    console.log(`🗺️ Hiding player ${username} - they are on ${playerMapLevel}, we are on ${currentMapLevel}`);
    const existingPlayer = onlinePlayers.get(username);
    if (existingPlayer) {
      existingPlayer.style.display = 'none';
    }
    return;
  } else {
    // Show player if on same map level
    const existingPlayer = onlinePlayers.get(username);
    if (existingPlayer && existingPlayer.style.display === 'none') {
      console.log(`🗺️ Showing player ${username} - they are on same map level (${playerMapLevel})`);
      existingPlayer.style.display = 'block';
    }
  }
  
  let playerElement = onlinePlayers.get(username);
  
  if (!playerElement) {
    console.log(`➕ Creating new player element for: ${username}`);
    // Create new online player element using exact same styling as main player character
    playerElement = document.createElement('div');
    playerElement.className = 'online-player player-character'; 
    playerElement.dataset.username = username;
    playerElement.style.position = 'absolute';
    
    // Use exact same sizing as main player character (67% of GRID_SIZE)
    const GRID_SIZE = 32;
    playerElement.style.width = `${Math.round(GRID_SIZE * 0.67)}px`; // Match main player size exactly
    playerElement.style.height = `${Math.round(GRID_SIZE * 0.67)}px`; // Match main player size exactly
    playerElement.style.borderRadius = '50%'; // Circle like main player
    playerElement.style.border = '2px solid #ffffff'; // White border like main player
    playerElement.style.boxShadow = '0 0 5px rgba(0, 0, 0, 0.3)'; // Same shadow as main player - no glow
    playerElement.style.cursor = 'pointer';
    playerElement.style.zIndex = '11'; // Slightly higher than main player (10) but below objects like banks (z-index 8)
    
    // Add the same centering margins as main player character for proper alignment
    playerElement.style.marginLeft = `${Math.round(GRID_SIZE * 0.165)}px`;
    playerElement.style.marginTop = `${Math.round(GRID_SIZE * 0.165)}px`; // Same margin for proper centering
    
    // Apply player color from profile (same as main player character style)
    if (profile && profile.settings && profile.settings.playerColor) {
      playerElement.style.backgroundColor = profile.settings.playerColor;
    } else {
      playerElement.style.backgroundColor = '#e74c3c'; // Default red for other players
    }
    
    // Remove any text content (no emoji or text that could create extra visual elements)
    playerElement.textContent = '';
    playerElement.innerHTML = ''; // Ensure completely clean
    
    // Store world position for camera-relative positioning (like objects)
    playerElement.dataset.worldX = position.x;
    playerElement.dataset.worldY = position.y;
    
    // Store previous position for direction calculation and animation
    playerElement.dataset.prevWorldX = position.x;
    playerElement.dataset.prevWorldY = position.y;
    
    // Initialize movement tracking for stability and animations
    playerElement.dataset.lastSignificantMove = Date.now();
    playerElement.dataset.isStationary = 'false'; // Default to moving state for better visibility
    playerElement.dataset.isAnimating = 'false';
    
    // Initialize facing direction
    playerElement.dataset.direction = 'south'; // Default facing south
    
    // Initialize last position update timestamp
    playerElement.dataset.lastPositionUpdate = Date.now();
    
    // Create username label
    const usernameLabel = document.createElement('div');
    usernameLabel.className = 'online-player-username';
    usernameLabel.textContent = username;
    usernameLabel.style.position = 'absolute';
    usernameLabel.style.bottom = '100%';
    usernameLabel.style.left = '50%';
    usernameLabel.style.transform = 'translateX(-50%)';
    usernameLabel.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
    usernameLabel.style.color = 'white';
    usernameLabel.style.padding = '3px 8px';
    usernameLabel.style.borderRadius = '4px';
    usernameLabel.style.fontSize = '11px';
    usernameLabel.style.fontWeight = 'bold';
    usernameLabel.style.whiteSpace = 'nowrap';
    usernameLabel.style.marginBottom = '6px';
    usernameLabel.style.zIndex = '15';
    usernameLabel.style.pointerEvents = 'none';
    usernameLabel.style.border = '1px solid rgba(255, 255, 255, 0.2)';
    
    playerElement.appendChild(usernameLabel);
    
    // Create direction indicator (same as main player)
    const directionIndicator = document.createElement('div');
    directionIndicator.className = 'direction-indicator';
    directionIndicator.style.position = 'absolute';
    directionIndicator.style.width = '6px';
    directionIndicator.style.height = '6px';
    directionIndicator.style.backgroundColor = '#ffffff';
    directionIndicator.style.borderRadius = '50%';
    directionIndicator.style.top = '80%'; // Default south position
    directionIndicator.style.left = '50%';
    directionIndicator.style.transform = 'translate(-50%, -50%)';
    directionIndicator.style.opacity = '0.8';
    directionIndicator.style.pointerEvents = 'none';
    directionIndicator.style.fontSize = '8px';
    directionIndicator.style.color = '#ffffff';
    directionIndicator.style.textAlign = 'center';
    directionIndicator.style.lineHeight = '6px';
    
    playerElement.appendChild(directionIndicator);
    
    gameWorld.appendChild(playerElement);
    onlinePlayers.set(username, playerElement);
    
    console.log(`✅ Added online player: ${username} at (${position.x}, ${position.y})`);
    
    // Apply any pending HP values that arrived before element creation
    if (pendingOnlineHP.has(username)) {
      const hp = pendingOnlineHP.get(username);
      pendingOnlineHP.delete(username);
      window.updateOnlinePlayerHP(username, hp.curHP, hp.maxHP);
    }
  }
  
  console.log(`🔄 Updating existing player: ${username} from (${playerElement.dataset.worldX}, ${playerElement.dataset.worldY}) to (${position.x}, ${position.y})`);
  
  // Store previous position for calculations
  const prevX = parseFloat(playerElement.dataset.worldX) || 0;
  const prevY = parseFloat(playerElement.dataset.worldY) || 0;
  
  // Update position data immediately
  playerElement.dataset.worldX = position.x;
  playerElement.dataset.worldY = position.y;
  playerElement.dataset.lastPositionUpdate = Date.now();
  
  // Calculate movement distance
  const movementDistance = Math.sqrt(Math.pow(position.x - prevX, 2) + Math.pow(position.y - prevY, 2));
  
  // More lenient movement threshold - accept more position updates for better visibility
  const isSignificantMovement = movementDistance > 0.02; // Reduced from 0.1 to catch smaller movements
  
  // Accept teleportation-style jumps as significant movement to handle player spawning/teleporting
  const isTeleportation = movementDistance > 5; 
  
  if (isSignificantMovement || isTeleportation) {
    console.log(`✅ ${isTeleportation ? 'Teleportation' : 'Movement'} detected for ${username}: ${movementDistance.toFixed(3)} units`);
    
    // Update movement tracking
    const now = Date.now();
    playerElement.dataset.lastSignificantMove = now.toString();
    
    // Update existing player's color if it changed
    if (profile && profile.settings && profile.settings.playerColor) {
      playerElement.style.backgroundColor = profile.settings.playerColor;
    }
    
    // Calculate direction player is facing based on movement (only for actual movement, not teleportation)
    if (!isTeleportation && isSignificantMovement) {
      const deltaX = position.x - prevX;
      const deltaY = position.y - prevY;
      
      let direction = 'south'; // Default
      
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        direction = deltaX > 0 ? 'east' : 'west';
      } else {
        direction = deltaY > 0 ? 'south' : 'north';
      }
      
      // Handle diagonal directions for smoother visuals
      if (Math.abs(deltaX) > 0.1 && Math.abs(deltaY) > 0.1) {
        if (deltaX > 0 && deltaY > 0) direction = 'southeast';
        else if (deltaX > 0 && deltaY < 0) direction = 'northeast';
        else if (deltaX < 0 && deltaY > 0) direction = 'southwest';
        else if (deltaX < 0 && deltaY < 0) direction = 'northwest';
      }
      
      playerElement.dataset.direction = direction;
      
      // Update direction indicator
      const directionIndicator = playerElement.querySelector('.direction-indicator');
      if (directionIndicator) {
        switch (direction) {
          case 'north':
            directionIndicator.style.top = '20%';
            directionIndicator.style.left = '50%';
            break;
          case 'northeast':
            directionIndicator.style.top = '20%';
            directionIndicator.style.left = '80%';
            break;
          case 'east':
            directionIndicator.style.top = '50%';
            directionIndicator.style.left = '80%';
            break;
          case 'southeast':
            directionIndicator.style.top = '80%';
            directionIndicator.style.left = '80%';
            break;
          case 'south':
            directionIndicator.style.top = '80%';
            directionIndicator.style.left = '50%';
            break;
          case 'southwest':
            directionIndicator.style.top = '80%';
            directionIndicator.style.left = '20%';
            break;
          case 'west':
            directionIndicator.style.top = '50%';
            directionIndicator.style.left = '20%';
            break;
          case 'northwest':
            directionIndicator.style.top = '20%';
            directionIndicator.style.left = '20%';
            break;
        }
      }
    }
    
    // Determine if this is tile-to-tile movement for smooth animation
    const isTileMovement = movementDistance > 0.8 && movementDistance < 2.0 && !isTeleportation;
    
    // Reset stationary status when player moves
    const wasStationary = playerElement.dataset.isStationary === 'true';
    playerElement.dataset.isStationary = 'false'; // Default to moving for better visibility
    
    if (isTileMovement) {
      // Start smooth tile-to-tile animation
      console.log(`🎬 Starting tile animation for ${username}: ${movementDistance.toFixed(2)} units`);
      animatePlayerTileMovement(playerElement, prevX, prevY, position.x, position.y);
    } else {
      // For teleportation or small movements, update position immediately
      updateOnlinePlayerPosition(playerElement, !isTeleportation);
    }
  } else {
    // Even for small movements, ensure player is still visible and positioned correctly
    console.log(`🔄 Small movement for ${username}: ${movementDistance.toFixed(3)} units - ensuring visibility`);
    updateOnlinePlayerPosition(playerElement, true);
  }
  
  // Always ensure player has proper visibility state - failsafe for consistent rendering
  if (!playerElement.dataset.isAnimating || playerElement.dataset.isAnimating === 'false') {
    playerElement.style.transition = 'left 0.15s cubic-bezier(0.25, 0.46, 0.45, 0.94), top 0.15s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    
    // Force visibility check to prevent invisible players
    updateOnlinePlayerPosition(playerElement, true);
  }
}

/**
 * Animate smooth movement between tiles for online players
 */
function animatePlayerTileMovement(playerElement, fromX, fromY, toX, toY) {
  if (!playerElement || !window.worldModule) return;
  
  // Mark as animating to prevent position conflicts
  playerElement.dataset.isAnimating = 'true';
  playerElement.style.transition = 'none'; // Remove CSS transitions during animation
  
  const startTime = performance.now();
  const duration = 300; // Reduced to 300ms for snappier feel
  const GRID_SIZE = 32;
  
  // We no longer cache the camera position once at the start. Instead, we
  // compute screen-space coordinates on EVERY frame so the sprite tracks camera
  // panning perfectly, even while the local player is walking.
  
  function animate(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Cubic ease-out for a snappy but smooth feel
    const easeOut = 1 - Math.pow(1 - progress, 3);
    
    // Current camera position (may change while we animate)
    const cameraPos = window.worldModule.getCameraPosition();
    const cameraOffsetX = cameraPos.x - Math.floor(cameraPos.x);
    const cameraOffsetY = cameraPos.y - Math.floor(cameraPos.y);
    
    // World-to-view coordinates (relative to top-left tile in viewport)
    const fromViewX = fromX - Math.floor(cameraPos.x);
    const fromViewY = fromY - Math.floor(cameraPos.y);
    const toViewX   = toX   - Math.floor(cameraPos.x);
    const toViewY   = toY   - Math.floor(cameraPos.y);
    
    // Convert to pixel positions in the DOM
    const fromScreenX = (fromViewX - cameraOffsetX) * GRID_SIZE;
    const fromScreenY = (fromViewY - cameraOffsetY) * GRID_SIZE;
    const toScreenX   = (toViewX   - cameraOffsetX) * GRID_SIZE;
    const toScreenY   = (toViewY   - cameraOffsetY) * GRID_SIZE;
    
    // Interpolate
    const currentX = fromScreenX + (toScreenX - fromScreenX) * easeOut;
    const currentY = fromScreenY + (toScreenY - fromScreenY) * easeOut;
    
    playerElement.style.left = currentX.toFixed(2) + 'px';
    playerElement.style.top  = currentY.toFixed(2) + 'px';
    
    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      // Animation finished – clean up
      playerElement.dataset.isAnimating = 'false';
      
      // If the remote player is now idle, disable CSS transitions to avoid
      // jitter; otherwise leave a small transition for minor follow-up moves.
      const isStationary = playerElement.dataset.isStationary === 'true';
      playerElement.style.transition = isStationary ? 'none'
        : 'left 0.15s cubic-bezier(0.25, 0.46, 0.45, 0.94), top 0.15s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
      
      // Final snap to exact world-derived position to avoid drift.
      updateOnlinePlayerPosition(playerElement, false);
    }
  }
  
  // Start the animation
  requestAnimationFrame(animate);
}

/**
 * Update online player position using the same system as world objects
 */
function updateOnlinePlayerPosition(playerElement, smoothMovement = false) {
  if (!playerElement || !window.worldModule) return;
  
  const worldX = parseFloat(playerElement.dataset.worldX);
  const worldY = parseFloat(playerElement.dataset.worldY);
  const username = playerElement.dataset.username;
  
  if (!isNaN(worldX) && !isNaN(worldY)) {
    // Use consistent positioning system for all players
    if (window.worldModule.getCameraPosition) {
      const cameraPos = window.worldModule.getCameraPosition();
      const cameraOffsetX = cameraPos.x - Math.floor(cameraPos.x);
      const cameraOffsetY = cameraPos.y - Math.floor(cameraPos.y);
      
      // Calculate new screen position
      const GRID_SIZE = 32;
      const viewX = worldX - Math.floor(cameraPos.x);
      const viewY = worldY - Math.floor(cameraPos.y);
      
      const newScreenX = (viewX - cameraOffsetX) * GRID_SIZE;
      const newScreenY = (viewY - cameraOffsetY) * GRID_SIZE;
      
      // Get current position to check if update is needed
      const currentLeft = parseInt(playerElement.style.left) || 0;
      const currentTop = parseInt(playerElement.style.top) || 0;
      
      // More lenient position threshold to prevent flickering
      const positionThreshold = smoothMovement ? 1 : 3;
      
      // Only update if position actually changed significantly OR if player is potentially invisible
      const needsPositionUpdate = Math.abs(currentLeft - newScreenX) > positionThreshold || 
                                   Math.abs(currentTop - newScreenY) > positionThreshold ||
                                   playerElement.style.display === 'none'; // Force update if currently hidden
      
      if (needsPositionUpdate) {
        //console.log(`📍 Moving player ${username} from (${currentLeft}, ${currentTop}) to (${newScreenX.toFixed(0)}, ${newScreenY.toFixed(0)}) - smooth: ${smoothMovement}`);
        
        // Use consistent direct positioning for all players
        playerElement.style.left = newScreenX + 'px';
        playerElement.style.top = newScreenY + 'px';
      }
      
      // More generous visibility check to prevent players from disappearing too early
      const VIEWPORT_COLS = 30;
      const VIEWPORT_ROWS = 21;
      const viewX_check = worldX - Math.floor(cameraPos.x);
      const viewY_check = worldY - Math.floor(cameraPos.y);
      
      // Increased visibility bounds for better player visibility (was 2, now 5)
      const hideBounds = 5; // More generous bounds to prevent premature hiding
      
      // Also check if player might be on screen edge - be more forgiving
      const isNearViewportEdge = viewX_check > -2 && viewX_check < VIEWPORT_COLS + 2 && 
                                 viewY_check > -2 && viewY_check < VIEWPORT_ROWS + 2;
      
      if (viewX_check < -hideBounds || viewX_check > VIEWPORT_COLS + hideBounds || 
          viewY_check < -hideBounds || viewY_check > VIEWPORT_ROWS + hideBounds) {
        // Only hide if really far outside viewport
        if (!isNearViewportEdge) {
          playerElement.style.display = 'none';
          //console.log(`👻 Hiding player ${username} - far outside viewport (${viewX_check.toFixed(1)}, ${viewY_check.toFixed(1)})`);
        } else {
          // Keep visible if near edge
          playerElement.style.display = 'block';
          //console.log(`🔍 Keeping player ${username} visible near viewport edge (${viewX_check.toFixed(1)}, ${viewY_check.toFixed(1)})`);
        }
      } else {
        // Always show players within reasonable bounds
        playerElement.style.display = 'block';
        playerElement.style.visibility = 'visible'; // Additional failsafe
        playerElement.style.opacity = '1'; // Additional failsafe
        
        // Uncomment for debugging visibility issues
        // console.log(`👁️ Player ${username} visible at viewport (${viewX_check.toFixed(1)}, ${viewY_check.toFixed(1)})`);
      }
      
      // Additional failsafe: ensure player is not accidentally hidden by other CSS
      if (viewX_check >= -hideBounds && viewX_check <= VIEWPORT_COLS + hideBounds &&
          viewY_check >= -hideBounds && viewY_check <= VIEWPORT_ROWS + hideBounds) {
        // Force visibility for players that should definitely be visible
        if (playerElement.style.display === 'none' || playerElement.style.visibility === 'hidden' || playerElement.style.opacity === '0') {
          console.warn(`⚠️ FAILSAFE: Forcing visibility for player ${username} at (${viewX_check.toFixed(1)}, ${viewY_check.toFixed(1)})`);
          playerElement.style.display = 'block';
          playerElement.style.visibility = 'visible';
          playerElement.style.opacity = '1';
        }
      }
    }
  } else {
    console.warn(`⚠️ Invalid position data for player ${username}:`, { worldX, worldY });
    
    // Failsafe for invalid position data - don't hide the player, just log the issue
    if (playerElement.style.display === 'none') {
      console.warn(`⚠️ FAILSAFE: Player ${username} has invalid position but was hidden - making visible`);
      playerElement.style.display = 'block';
    }
  }
}

/**
 * Remove online player visualization
 */
function removeOnlinePlayer(username) {
  const playerElement = onlinePlayers.get(username);
  if (playerElement) {
    playerElement.remove();
    onlinePlayers.delete(username);
  }
}

/**
 * Show speech bubble over a specific online player
 */
function showSpeechBubbleForPlayer(username, message, isEmote) {
  const playerElement = onlinePlayers.get(username);
  if (!playerElement) return;
  
  const gameWorld = document.querySelector('.game-world');
  if (!gameWorld) return;
  
  // Remove any existing speech bubble for this player
  const existingBubble = gameWorld.querySelector(`[data-player-bubble="${username}"]`);
  if (existingBubble) {
    existingBubble.remove();
  }
  
  // Create speech bubble element with same styling as main player
  const speechBubble = document.createElement('div');
  speechBubble.className = 'speech-bubble'; // Use same class as main player
  speechBubble.dataset.playerBubble = username;
  speechBubble.textContent = message;
  
  // Apply identical inline styles to main player speech bubble
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
  speechBubble.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.3)'; // Same shadow as main player
  speechBubble.style.position = 'absolute';
  speechBubble.style.zIndex = '16'; // Slightly higher than main player to avoid overlap
  speechBubble.style.pointerEvents = 'none';
  
  if (isEmote) {
    // Make emotes larger - same as main player
    speechBubble.style.fontSize = '24px';
    speechBubble.style.padding = '12px 16px';
    speechBubble.style.textShadow = '2px 2px 4px rgba(0, 0, 0, 0.8), -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff';
  }
  
  // Add to game world
  gameWorld.appendChild(speechBubble);
  
  // Create tail elements manually - identical to main player
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
    if (!speechBubble.parentNode || !playerElement.parentNode) {
      return; // Bubble or player was removed
    }
    
    // Calculate position relative to player element
    const playerLeft = parseInt(playerElement.style.left) || 0;
    const playerTop = parseInt(playerElement.style.top) || 0;
    const playerWidth = playerElement.offsetWidth;
    
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
  
  console.log('Speech bubble created for online player:', username, 'with message:', message);
}

/**
 * Handle multiplayer chat messages
 */
function handleMultiplayerChatMessage(username, message, timestamp, type) {
  // Get player color - handle both own messages and other players' messages
  let playerColor = '#e74c3c'; // Default red for other players
  
  // Check if this is the current user's own message echoing back from server
  const currentUserData = getCurrentUser();
  if (currentUserData && username === currentUserData.username) {
    // This is our own message echoing back - use our saved color
    if (userProfile?.settings?.playerColor) {
      playerColor = userProfile.settings.playerColor;
    } else {
      // Fallback to getting color from player character element
      const playerCharacter = document.getElementById('player-character');
      if (playerCharacter && playerCharacter.style.backgroundColor) {
        playerColor = playerCharacter.style.backgroundColor;
      } else {
        playerColor = '#3498db'; // Default blue for own messages
      }
    }
  } else {
    // This is another player's message - try to get their color
    const playerData = onlinePlayers.get(username);
    if (playerData && playerData.style && playerData.style.backgroundColor) {
      playerColor = playerData.style.backgroundColor;
    }
    
    // If we don't have the player element, try to get from multiplayer module
    if (playerColor === '#e74c3c') {
      const multiplayerPlayers = getOnlinePlayers();
      const playerInfo = multiplayerPlayers.find(p => p.username === username);
      if (playerInfo && playerInfo.profile && playerInfo.profile.settings && playerInfo.profile.settings.playerColor) {
        playerColor = playerInfo.profile.settings.playerColor;
      }
    }
  }
  
  // Check if message is just an emote (emoji)
  const isEmote = /^[\p{Emoji_Presentation}\p{Emoji}\uFE0F\u200D]+$/u.test(message.trim());
  
  // Create colored message for chat
  const coloredMessage = `<span style="color: ${playerColor}; font-weight: bold;">${username}:</span> ${message}`;
  
  // Add message to chat with multiplayer styling
  addMessage(coloredMessage, 'multiplayer');
  
  // Show speech bubble over the appropriate character
  if (currentUserData && username === currentUserData.username) {
    // Show speech bubble over our own character
    showSpeechBubble(message);
  } else {
    // Show speech bubble over the other player's character
    showSpeechBubbleForPlayer(username, message, isEmote);
  }
}

/**
 * Handle user profile updates from server
 */
function handleUserProfileUpdate(profile) {
  // Update local user profile with server data
  if (profile) {
    // If this is a different user (account switch), completely replace the profile
    // to avoid data from previous accounts persisting
    if (userProfile && userProfile.username !== profile.username) {
      console.log(`Account switch detected: ${userProfile.username} -> ${profile.username}`);
      userProfile = profile; // Complete replacement for account switches
    } else {
      // Same user, merge server profile with local profile
      userProfile = { ...userProfile, ...profile };
    }
    
    // Update UI elements
    updateProfileInfo();
    
    // Update player appearance if color changed
    if (profile.settings && profile.settings.playerColor) {
      updatePlayerColor(profile.settings.playerColor);
    }
    
    console.log('Profile updated from server:', profile.username);
  }
}

// Enhanced chat integration for multiplayer
function enhanceChatForMultiplayer() {
  console.log('Enhancing chat for multiplayer...');
  
  const chatInput = document.getElementById('chat-input');
  const chatSend = document.getElementById('chat-send');
  
  if (!chatInput || !chatSend) {
    console.warn('Chat elements not found, retrying in 100ms...');
    setTimeout(enhanceChatForMultiplayer, 100);
    return;
  }
  
  // Check if already enhanced to avoid duplicate listeners
  if (chatSend.dataset.multiplayerEnhanced) {
    console.log('Chat already enhanced for multiplayer');
    return;
  }
  
  // Mark as enhanced
  chatSend.dataset.multiplayerEnhanced = 'true';
  
  // Store original onclick handler if it exists
  const originalOnClick = chatSend.onclick;
  
  // Override chat send functionality for multiplayer
  chatSend.onclick = () => {
    const message = chatInput.value.trim();
    if (message) {
      console.log('Sending chat message:', message);
      
      // Check if online first
      if (isUserOnline()) {
        console.log('User is online, sending to server (server will echo back)');
        // Only send to server - server will echo back to all players including sender
        sendChatMessage(message);
      } else {
        console.log('User is offline, showing message locally only');
        // Show message locally for offline play
        showLocalChatMessage(message);
      }
      
      chatInput.value = '';
    }
  };
  
  // Also override Enter key handling
  const enterHandler = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      chatSend.onclick();
    }
  };
  
  // Remove any existing enter handler to avoid duplicates
  chatInput.removeEventListener('keypress', enterHandler);
  chatInput.addEventListener('keypress', enterHandler);
  
  console.log('Chat enhanced for multiplayer successfully');
}

// Enhanced movement for multiplayer synchronization
function enhanceMovementForMultiplayer() {
  console.log('🚀 Enhancing movement for multiplayer...');
  
  // Hook into the world module's movement system
  if (window.worldModule && window.worldModule.movePlayerToTarget) {
    console.log('✅ Found worldModule.movePlayerToTarget, hooking into it');
    const originalMovePlayer = window.worldModule.movePlayerToTarget;
    
    window.worldModule.movePlayerToTarget = function(targetX, targetY) {
      console.log(`🎯 Player moving to target: (${targetX}, ${targetY})`);
      
      // Cancel digging when player starts moving (both active and continuous digging)
      if (window.diggingModule && window.diggingModule.cancelDigging) {
        if (window.diggingModule.isDigging && window.diggingModule.isDigging()) {
          console.log('🚶 Movement: Cancelling active digging session');
          window.diggingModule.cancelDigging();
        }
      }
      
      // Call original movement function
      const result = originalMovePlayer(targetX, targetY);
      
      // If online, send movement update to server
      if (isUserOnline()) {
        console.log('🌐 User is online, sending movement to server');
        
        // Send immediate target update
        const targetPos = { x: targetX, y: targetY };
        console.log(`📡 Sending target position: (${targetX}, ${targetY})`);
        sendPlayerMove(targetPos);
        
        // Also send current position after a short delay
        setTimeout(() => {
          const currentPosition = getPlayerPosition();
          if (currentPosition) {
            console.log(`📡 Sending current position: (${currentPosition.x.toFixed(2)}, ${currentPosition.y.toFixed(2)})`);
            sendPlayerMove(currentPosition);
          }
        }, 100);
        
      } else {
        console.log('🏠 User is offline, movement not sent to server');
      }
      
      return result;
    };
    console.log('✅ Movement hooking complete');
  } else {
    console.warn('⚠️ worldModule.movePlayerToTarget not found, retrying in 500ms...');
    setTimeout(enhanceMovementForMultiplayer, 500);
    return;
  }
  
  // Improved position sync - more stable and less frequent to prevent floating
  let lastSentPosition = null;
  let positionSyncInterval = null;
  
  function startPositionSync() {
    console.log('🔄 Starting position sync...');
    if (positionSyncInterval) {
      clearInterval(positionSyncInterval);
    }
    
    // Send position updates every 250ms while online (increased frequency for ultra-responsive movement)
    positionSyncInterval = setInterval(() => {
      if (isUserOnline()) {
        const currentPosition = getPlayerPosition();
        if (currentPosition && 
            (!lastSentPosition || 
             Math.abs(lastSentPosition.x - currentPosition.x) > 0.2 || 
             Math.abs(lastSentPosition.y - currentPosition.y) > 0.2)) {
          
          console.log(`📡 Position sync: sending (${currentPosition.x.toFixed(2)}, ${currentPosition.y.toFixed(2)})`);
          // Send position sync (more frequent for better responsiveness)
          sendPlayerMove(currentPosition);
          lastSentPosition = { ...currentPosition };
        }
      } else {
        console.log('🏠 User went offline, stopping position sync');
        // Clear interval if user goes offline
        if (positionSyncInterval) {
          clearInterval(positionSyncInterval);
          positionSyncInterval = null;
        }
      }
    }, 250); // Every 250ms - increased frequency for ultra-responsive movement
    
    console.log('✅ Position sync interval started');
  }
  
  function stopPositionSync() {
    console.log('🛑 Stopping position sync...');
    if (positionSyncInterval) {
      clearInterval(positionSyncInterval);
      positionSyncInterval = null;
    }
  }
  
  // Monitor online status changes to start/stop position sync
  let wasOnline = isUserOnline();
  const statusCheckInterval = setInterval(() => {
    const nowOnline = isUserOnline();
    if (nowOnline !== wasOnline) {
      if (nowOnline) {
        console.log('🌐 User went online, starting position sync');
        startPositionSync();
      } else {
        console.log('🏠 User went offline, stopping position sync');
        stopPositionSync();
      }
      wasOnline = nowOnline;
    }
  }, 1000);
  
  // Start position sync if already online
  if (isUserOnline()) {
    console.log('🌐 User is already online, starting position sync');
    startPositionSync();
  }
  
  // Improved continuous movement tracking with better thresholds for ultra-responsiveness
  let lastKnownPosition = null;
  const continuousTrackingInterval = setInterval(() => {
    if (isUserOnline()) {
      const currentPos = getPlayerPosition();
      if (currentPos && (!lastKnownPosition || 
          Math.abs(lastKnownPosition.x - currentPos.x) > 0.25 || 
          Math.abs(lastKnownPosition.y - currentPos.y) > 0.25)) {
        
        // Send immediate position update during active movement
        sendPlayerMove(currentPos);
        lastKnownPosition = { ...currentPos };
        console.log(`🏃 Continuous tracking: (${currentPos.x.toFixed(2)}, ${currentPos.y.toFixed(2)})`);
      }
    }
  }, 100); // Every 100ms for ultra-responsive movement detection
  
  // Store intervals for cleanup if needed
  window.multiplayerIntervals = {
    positionSync: positionSyncInterval,
    statusCheck: statusCheckInterval,
    continuousTracking: continuousTrackingInterval
  };
}

/**
 * Send enhanced movement data to server
 */
function sendPlayerMovement(movementData) {
  if (window.sendPlayerMove) {
    // For now, send as regular position update, but include extra data
    if (movementData.type === 'move-to-target') {
      window.sendPlayerMove({
        ...movementData.currentPosition,
        target: movementData.targetPosition,
        movementType: 'smooth'
      });
    } else {
      window.sendPlayerMove(movementData.currentPosition);
    }
  }
}

// Initialize world with server-side map loading
async function initializeWorldFromServer() {
  console.log(' Attempting to load world from server...');
  
  try {
    // Try to load world data from server
    const serverWorldData = await loadWorldFromServer();
    
    if (serverWorldData) {
      console.log('✅ World data loaded from server successfully');
      console.log('📊 World dimensions:', serverWorldData.worldCols + 'x' + serverWorldData.worldRows);
      console.log('🎮 Player spawns found:', serverWorldData.playerSpawns?.length || 0);
      console.log('🗺️ World layers:', serverWorldData.layers?.length || 0, 'layers');
      
      // IMPORTANT: Clear any local storage world data to prevent conflicts
      localStorage.removeItem('webscape_custom_map');
      console.log('🧹 Cleared local world storage to prevent conflicts');
      
      // Convert server world data to legacy format that the game expects
      const legacyWorldData = convertServerWorldToLegacyFormat(serverWorldData);
      console.log('🔄 Converted server world to legacy format');
      
      // Load the converted world data into the world module
      if (window.worldModule && window.worldModule.loadCustomMap) {
        console.log('🔄 Loading server world into game...');
        window.worldModule.loadCustomMap(legacyWorldData);
        console.log('🎯 Server world loaded into game successfully');
      } else {
        console.log('⚠️ World module not ready, initializing first...');
        // If world module isn't ready yet, initialize it first
        gameWorld = initializeWorld();
        // Then try to load the server data
        if (window.worldModule && window.worldModule.loadCustomMap) {
          console.log('🔄 Loading server world into game (retry)...');
          window.worldModule.loadCustomMap(legacyWorldData);
          console.log('🎯 Server world loaded into game successfully (retry)');
        }
      }
      
      // Set a flag to indicate server world is active
      window.serverWorldActive = true;
      console.log('🌐 Server world synchronization complete');
      
    } else {
      console.log('❌ Failed to load world from server, using local initialization');
      console.log('🏠 Generating local world...');
      window.serverWorldActive = false;
      gameWorld = initializeWorld();
    }
  } catch (error) {
    console.error('💥 Error loading world from server:', error);
    console.log('🏠 Falling back to local world initialization');
    window.serverWorldActive = false;
    gameWorld = initializeWorld();
  }
}

/**
 * Convert server world data (layered format) to legacy format that the game expects
 */
function convertServerWorldToLegacyFormat(serverWorldData) {
  console.log('Converting server world data to legacy format...');
  
  // Extract terrain layer (layer 0) as the main grid
  const grid = serverWorldData.layers && serverWorldData.layers[0] ? 
    serverWorldData.layers[0].map(row => [...row]) : 
    Array(100).fill().map(() => Array(100).fill(0));
  
  // Extract objects from all non-terrain layers
  const objects = [];
  
  if (serverWorldData.layers) {
    for (let layerIndex = 1; layerIndex < serverWorldData.layers.length; layerIndex++) {
      const layer = serverWorldData.layers[layerIndex];
      if (!layer) continue;
      
      for (let y = 0; y < layer.length; y++) {
        for (let x = 0; x < layer[y].length; x++) {
          const objectType = layer[y][x];
          if (objectType && objectType !== null && objectType !== 0) {
            objects.push({
              type: objectType,
              x: x,
              y: y,
              name: objectType
            });
          }
        }
      }
    }
  }
  
  console.log(`Converted: ${grid.length}x${grid[0]?.length || 0} terrain, ${objects.length} objects`);
  
  return {
    grid: grid,
    objects: objects,
    worldCols: serverWorldData.worldCols || 100,
    worldRows: serverWorldData.worldRows || 100,
    playerSpawn: { x: 10, y: 10 }, // Default spawn
    createdAt: new Date().toISOString(),
    source: 'server'
  };
}

// Update character profile information in the UI
function updateProfileInfo() {
  // Update character name
  const characterNameElement = document.getElementById('character-name');
  if (characterNameElement) {
    characterNameElement.textContent = userProfile.character.name;
  }
  
  // Update combat level
  const combatLevel = calculateCombatLevel(userProfile.skills);
  const combatLevelElement = document.getElementById('combat-level');
  if (combatLevelElement) {
    combatLevelElement.textContent = combatLevel;
  }
  
  // Update total level in header
  const totalLevel = calculateTotalLevel(userProfile.skills);
  const totalLevelElement = document.getElementById('total-level-header');
  if (totalLevelElement) {
    totalLevelElement.textContent = totalLevel;
  }
}

// Initialize settings panel
function initializeSettings() {
  // Music volume slider
  const musicVolumeSlider = document.getElementById('music-volume');
  if (musicVolumeSlider) {
    musicVolumeSlider.value = userProfile.settings.musicVolume * 100;
    musicVolumeSlider.addEventListener('change', () => {
      userProfile.settings.musicVolume = musicVolumeSlider.value / 100;
      saveSettings(userProfile.settings);
    });
  }
  
  // Sound effects volume slider
  const soundVolumeSlider = document.getElementById('sound-volume');
  if (soundVolumeSlider) {
    soundVolumeSlider.value = userProfile.settings.soundVolume * 100;
    soundVolumeSlider.addEventListener('change', () => {
      userProfile.settings.soundVolume = soundVolumeSlider.value / 100;
      saveSettings(userProfile.settings);
    });
  }
  
  // Speech bubble opacity slider
  const bubbleOpacitySlider = document.getElementById('bubble-opacity');
  const bubbleOpacityValue = document.getElementById('bubble-opacity-value');
  if (bubbleOpacitySlider && bubbleOpacityValue) {
    // Initialize with saved value or default to 50%
    if (!userProfile.settings.bubbleOpacity) {
      userProfile.settings.bubbleOpacity = 0.5;
    }
    
    bubbleOpacitySlider.value = userProfile.settings.bubbleOpacity * 100;
    bubbleOpacityValue.textContent = Math.round(userProfile.settings.bubbleOpacity * 100) + '%';
    
    // Update CSS custom property for speech bubble opacity
    updateBubbleOpacity(userProfile.settings.bubbleOpacity);
    
    bubbleOpacitySlider.addEventListener('input', () => {
      const opacity = bubbleOpacitySlider.value / 100;
      userProfile.settings.bubbleOpacity = opacity;
      bubbleOpacityValue.textContent = Math.round(opacity * 100) + '%';
      updateBubbleOpacity(opacity);
      saveSettings(userProfile.settings);
    });
  }
  
  // Difficulty selector
  const difficultySelector = document.getElementById('difficulty');
  if (difficultySelector) {
    difficultySelector.value = userProfile.settings.difficulty;
    difficultySelector.addEventListener('change', () => {
      userProfile.settings.difficulty = difficultySelector.value;
      saveSettings(userProfile.settings);
      showNotification(`Difficulty set to ${difficultySelector.value}`, 'info');
    });
  }
  
  // Character name change
  const changeNameBtn = document.getElementById('change-name-btn');
  const characterNameInput = document.getElementById('character-name-input');
  
  if (changeNameBtn && characterNameInput) {
    characterNameInput.value = userProfile.character.name;
    
    changeNameBtn.addEventListener('click', () => {
      const newName = characterNameInput.value.trim();
      if (newName && newName !== userProfile.character.name) {
        userProfile.character.name = newName;
        updateProfileInfo();
        saveGame();
        showNotification(`Character name changed to ${newName}`, 'success');
      }
    });
  }
  
  // Reset progress button
  const resetProgressBtn = document.getElementById('reset-progress-btn');
  if (resetProgressBtn) {
    resetProgressBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to reset all progress? This cannot be undone!')) {
        // Create a new user profile with the same name
        const characterName = userProfile.character.name;
        userProfile = initializeStorage();
        userProfile.character.name = characterName;
        
        // Update UI
        initializeSkillsUI(userProfile, { onSkillChange: updateProfileInfo });
        updateProfileInfo();
        
        // Reset the game world
        resetWorld();
        gameWorld = initializeWorld();
        
        // Save the reset profile
        saveGame();
        
        showNotification('All progress has been reset!', 'info');
      }
    });
  }
  
  // Logout button
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to logout?')) {
        // Call logout API
        fetch('/api/logout', {
          method: 'POST',
          credentials: 'include'
        })
        .then(response => {
          if (response.ok) {
            // Clear any local session data
            sessionStorage.clear();
            
            // Redirect to splash screen
            window.location.href = 'splash.html';
          } else {
            console.error('Logout failed');
            showNotification('Logout failed. Please try again.', 'error');
          }
        })
        .catch(error => {
          console.error('Logout error:', error);
          // Even if logout fails, redirect to splash screen
          sessionStorage.clear();
          window.location.href = 'splash.html';
        });
      }
    });
  }
  
  // Player color picker
  let colorOptions = [];
  const colorPicker = document.getElementById('player-color-picker');
  
  if (colorPicker) {
    // Initialize user's saved color (default to blue if not set)
    if (!userProfile.settings.playerColor) {
      userProfile.settings.playerColor = '#3498db';
    }
    
    // Set the active color option based on saved preference
    colorOptions = colorPicker.querySelectorAll('.color-option');
    // Avoid duplicate assignment errors when colorOptions is not defined (e.g., if the picker is missing)
    if (typeof colorOptions !== 'undefined' && colorOptions.length) {
      // (Legacy duplicate – kept for safety but now guarded)
      colorOptions.forEach(option => {
        option.addEventListener('click', () => {
          colorOptions.forEach(opt => opt.classList.remove('active'));
          option.classList.add('active');
          const selectedColor = option.dataset.color;
          userProfile.settings.playerColor = selectedColor;
          updatePlayerColor(selectedColor);
          saveSettings(userProfile.settings);
          showNotification(`Player color changed to ${option.title}`, 'success');
        });
      });
    }
    
    // Apply the saved color to the player character
    updatePlayerColor(userProfile.settings.playerColor);
    
    // Add click handlers for color options
    colorOptions.forEach(option => {
      option.addEventListener('click', () => {
        // Remove active class from all options
        colorOptions.forEach(opt => opt.classList.remove('active'));
        
        // Add active class to clicked option
        option.classList.add('active');
        
        // Get the selected color
        const selectedColor = option.dataset.color;
        
        // Update user profile
        userProfile.settings.playerColor = selectedColor;
        
        // Apply the color to the player character
        updatePlayerColor(selectedColor);
        
        // Save settings
        saveSettings(userProfile.settings);
        
        // Show notification
        showNotification(`Player color changed to ${option.title}`, 'success');
      });
    });
  }

  // Add click handlers for color options
  colorOptions.forEach(option => {
    option.addEventListener('click', () => {
      // Remove active class from all options
      colorOptions.forEach(opt => opt.classList.remove('active'));
      
      // Add active class to clicked option
      option.classList.add('active');
      
      // Get the selected color
      const selectedColor = option.dataset.color;
      
      // Update user profile
      userProfile.settings.playerColor = selectedColor;
      
      // Apply the color to the player character
      updatePlayerColor(selectedColor);
      
      // Save settings
      saveSettings(userProfile.settings);
      
      // Show notification
      showNotification(`Player color changed to ${option.title}`, 'success');
    });
  });

  // Handle custom color input
  const customColorInput = document.getElementById('custom-color-input');
  if (customColorInput) {
    const applyCustomColor = () => {
      const selectedColor = customColorInput.value;

      // Remove active highlight from preset options
      colorOptions.forEach(opt => opt.classList.remove('active'));

      // Update user profile and apply the colour straight away
      userProfile.settings.playerColor = selectedColor;
      updatePlayerColor(selectedColor);
      saveSettings(userProfile.settings);
      showNotification('Player colour changed (custom)', 'success');

      // Broadcast to other players (if online)
      if (isUserOnline()) {
        sendPlayerColorUpdate(selectedColor);
      }
    };

    // Some browsers only fire change while others fire input; use both
    customColorInput.addEventListener('input', applyCustomColor);
    customColorInput.addEventListener('change', applyCustomColor);
  }
}

// Update player character color
function updatePlayerColor(color) {
  const playerCharacter = document.getElementById('player-character');
  if (playerCharacter) {
    playerCharacter.style.backgroundColor = color;
    console.log(`Player color updated to: ${color}`);
    
    // Send color update to multiplayer server if online
    if (isUserOnline() && window.sendPlayerColorUpdate) {
      window.sendPlayerColorUpdate(color);
    }
  }
}

// Update speech bubble opacity
function updateBubbleOpacity(opacity) {
  // Set CSS custom property for speech bubble opacity
  document.documentElement.style.setProperty('--speech-bubble-opacity', opacity);
  console.log(`Speech bubble opacity updated to: ${Math.round(opacity * 100)}%`);
}

// Update user playtime
function updateUserPlaytime() {
  if (!userProfile || !startTime) return;
  
  try {
    const now = Date.now();
    const elapsedSeconds = Math.floor((now - startTime) / 1000);
    
    userProfile = updatePlaytime(userProfile, elapsedSeconds);
    startTime = now; // Reset start time
  } catch (error) {
    console.error('Error updating playtime:', error);
    // Reset startTime to prevent repeated errors
    startTime = Date.now();
  }
}

// Initialize emotes functionality
function initializeEmotes() {
  console.log('Initializing emotes...');
  
  const emoteButtons = document.querySelectorAll('.emote-button');
  
  emoteButtons.forEach(button => {
    button.addEventListener('click', () => {
      const emote = button.dataset.emote;
      if (emote) {
        // Call sendEmoteMessage from the global scope or directly from the imported function
        if (window.sendEmoteMessage) {
          window.sendEmoteMessage(emote);
        } else {
          sendEmoteMessage(emote);
        }
        console.log(`Emote clicked: ${emote}`);
      }
    });
  });
  
  console.log(`Initialized ${emoteButtons.length} emote buttons`);
}

/**
 * Show local chat message (for current player's own messages)
 */
function showLocalChatMessage(message) {
  console.log('showLocalChatMessage called with:', message);
  
  // Get the player's name and color
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
    
    // Also check if we have a profile setting
    if (window.userProfile && window.userProfile.settings && window.userProfile.settings.playerColor) {
      playerColor = window.userProfile.settings.playerColor;
    }
  } catch (error) {
    console.warn('Could not get player name/color, using defaults:', error);
  }
  
  console.log('Using player name:', playerName, 'color:', playerColor);
  
  // Check if message is an emote
  const isEmote = /^[\p{Emoji_Presentation}\p{Emoji}\uFE0F\u200D]+$/u.test(message.trim());
  
  // Create colored name message
  const coloredMessage = `<span style="color: ${playerColor}; font-weight: bold;">${playerName}:</span> ${message}`;
  
  console.log('Adding message to chat:', coloredMessage);
  
  // Add message to chat
  if (window.addMessage) {
    window.addMessage(coloredMessage, 'player');
    console.log('Message added via window.addMessage');
  } else {
    console.error('window.addMessage not available!');
  }
  
  // Show speech bubble over character
  if (window.showSpeechBubble) {
    window.showSpeechBubble(message);
    console.log('Speech bubble shown');
  } else {
    console.warn('window.showSpeechBubble not available');
  }
}

/**
 * Update all online players' positions (called when camera moves)
 */
function updateAllOnlinePlayersPositions() {
  if (onlinePlayers && onlinePlayers.size > 0) {
    onlinePlayers.forEach((playerElement, username) => {
      if (playerElement && playerElement.dataset) {
        const isAnimating = playerElement.dataset.isAnimating === 'true';
        
        // Don't update position during animations - let the animation handle it
        if (isAnimating) {
          console.log(`🎬 Skipping camera update for ${username} - animation in progress`);
          return;
        }
        
        // Update all players using consistent positioning system
        // console.log(`🔄 Updating player ${username} position with camera`); // Removed verbose logging
        updateOnlinePlayerPosition(playerElement, false);
      }
    });
  }
}

/**
 * Refresh visibility of all online players based on current map level
 */
function refreshOnlinePlayerVisibility() {
  const currentMapLevel = window.worldModule?.getCurrentMapLevel ? window.worldModule.getCurrentMapLevel() : 'surface';
  console.log(`🗺️ Refreshing online player visibility for map level: ${currentMapLevel}`);
  
  onlinePlayers.forEach((playerElement, username) => {
    // We need to get the player's profile to check their map level
    // For now, we'll show all players if we can't determine their map level
    // This could be improved by storing map level data separately
    const shouldShow = true; // Default behavior until we can properly track other players' map levels
    
    if (shouldShow) {
      playerElement.style.display = 'block';
    } else {
      playerElement.style.display = 'none';
    }
  });
}

/**
 * Periodic failsafe to ensure no players are stuck invisible
 * This runs every 5 seconds to catch any edge cases where players become invisible
 */
function performPlayerVisibilityFailsafeCheck() {
  if (!onlinePlayers || onlinePlayers.size === 0) return;
  
  console.log(`🔍 Performing periodic player visibility check (${onlinePlayers.size} players)`);
  
  onlinePlayers.forEach((playerElement, username) => {
    if (!playerElement || !playerElement.parentNode) {
      console.warn(`⚠️ FAILSAFE: Player ${username} element missing or not in DOM`);
      return;
    }
    
    const worldX = parseFloat(playerElement.dataset.worldX);
    const worldY = parseFloat(playerElement.dataset.worldY);
    
    if (isNaN(worldX) || isNaN(worldY)) {
      console.warn(`⚠️ FAILSAFE: Player ${username} has invalid world coordinates`);
      return;
    }
    
    // Check if player should be visible based on camera position
    if (window.worldModule && window.worldModule.getCameraPosition) {
      const cameraPos = window.worldModule.getCameraPosition();
      const viewX = worldX - Math.floor(cameraPos.x);
      const viewY = worldY - Math.floor(cameraPos.y);
      
      const VIEWPORT_COLS = 30;
      const VIEWPORT_ROWS = 21;
      const hideBounds = 5;
      
      const shouldBeVisible = viewX >= -hideBounds && viewX <= VIEWPORT_COLS + hideBounds &&
                              viewY >= -hideBounds && viewY <= VIEWPORT_ROWS + hideBounds;
      
      const isCurrentlyVisible = playerElement.style.display !== 'none' && 
                                playerElement.style.visibility !== 'hidden' && 
                                playerElement.style.opacity !== '0';
      
      if (shouldBeVisible && !isCurrentlyVisible) {
        console.warn(`⚠️ FAILSAFE: Player ${username} should be visible but isn't - fixing`);
        playerElement.style.display = 'block';
        playerElement.style.visibility = 'visible';
        playerElement.style.opacity = '1';
        
        // Force position update to ensure proper placement
        updateOnlinePlayerPosition(playerElement, false);
      } else if (!shouldBeVisible && isCurrentlyVisible) {
        // This is normal - player is outside viewport and correctly hidden
        // console.log(`✅ Player ${username} correctly hidden outside viewport`);
      }
      
      // Check for last position update - if it's been too long, force a refresh
      const lastUpdate = parseInt(playerElement.dataset.lastPositionUpdate) || 0;
      const timeSinceUpdate = Date.now() - lastUpdate;
      
      if (timeSinceUpdate > 30000) { // 30 seconds without update
        console.warn(`⚠️ FAILSAFE: Player ${username} hasn't been updated in ${(timeSinceUpdate / 1000).toFixed(0)}s - forcing position refresh`);
        updateOnlinePlayerPosition(playerElement, false);
        playerElement.dataset.lastPositionUpdate = Date.now();
      }
    }
  });
}

// Set up periodic failsafe check
setInterval(performPlayerVisibilityFailsafeCheck, 5000); // Check every 5 seconds

// Export main functions
export { initGame, saveGame, userProfile };

// === Multiplayer HP / Respawn helpers ===
const onlineHPHideTimers = new Map(); // username -> timer

window.updateOnlinePlayerHP = function(username, curHP, maxHP) {
  const playerEl = onlinePlayers.get(username);
  if (!playerEl) {
    // Player element not yet created; save for later
    pendingOnlineHP.set(username,{curHP,maxHP});
    return;
  }
  let bar = playerEl.querySelector('.player-health-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.className = 'player-health-bar';
    bar.style.cssText = `
      position: absolute;
      top: -8px;
      left: 50%;
      transform: translateX(-50%);
      width: 30px;
      height: 4px;
      background-color: rgba(0,0,0,0.3);
      border-radius: 2px;
      overflow: hidden;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s;
      z-index: 20;
    `;
    const fill = document.createElement('div');
    fill.style.height = '100%';
    bar.appendChild(fill);
    playerEl.appendChild(bar);
  }
  const pct = Math.max(0, Math.min(100, (curHP / maxHP) * 100));
  const fill = bar.firstElementChild;
  fill.style.width = `${pct}%`;
  fill.style.backgroundColor = pct > 60 ? '#4CAF50' : pct > 25 ? '#FF9800' : '#F44336';
  bar.style.opacity = '1'; // keep visible for other players
  // Keep visible indefinitely for other players – skip hide timer
  return;
};

// Handle respawn packets
window.onPlayerRespawn = function(username, position) {
  if (username === (window.multiplayerModule?.getCurrentUser()?.username)) {
    // Local player respawn
    if (window.worldModule?.setPlayerPosition) {
      window.worldModule.setPlayerPosition(position.x, position.y);
    }
    // reset camera maybe
  } else {
    // Other player
    const playerEl = onlinePlayers.get(username);
    if (playerEl) {
      playerEl.dataset.worldX = position.x;
      playerEl.dataset.worldY = position.y;
      // Instantly move visual
      if (window.worldModule?.getCameraPosition) {
        const cam = window.worldModule.getCameraPosition();
        const grid = window.worldModule.getGridSize();
        playerEl.style.left = `${(position.x - cam.x) * grid}px`;
        playerEl.style.top = `${(position.y - cam.y) * grid}px`;
      }
    }
  }
};