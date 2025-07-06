/**
 * Multiplayer Module - Handles online play functionality
 * Manages authentication, WebSocket connections, and player synchronization
 */

// Configuration – detect host/port at runtime so the same bundle works
// locally (localhost:8081) and on hosted environments (Render, etc.)
// where the Node server and the static files share the same origin.

const { protocol, hostname, port } = window.location;

// Determine API base (REST) and WebSocket URLs dynamically.
// – For HTTPS we must use wss:// otherwise ws://.
// – If the current page already contains a non-default port we re-use it.

const API_BASE = `${protocol}//${hostname}${port ? `:${port}` : ''}/api`;

const WS_SCHEME = protocol === 'https:' ? 'wss:' : 'ws:';
const WS_URL = `${WS_SCHEME}//${hostname}${port ? `:${port}` : ''}`;

// State
let isOnline = false;
let socket = null;
let sessionId = null;
let currentUser = null;
let onlinePlayers = new Map(); // username -> player data
let loginModal = null;

// Callbacks for integration with existing game systems
let onPlayerMove = null;
let onChatMessage = null;
let onUserProfileUpdate = null;

// Toggle detailed multiplayer logs
const DEBUG_MULTIPLAYER = false;

/**
 * Initialize the multiplayer system
 */
export function initializeMultiplayer() {
  console.log('Initializing multiplayer system...');
  
  // Set up UI elements first
  setupMultiplayerUI();
  
  // Try to auto-login with saved session
  const savedSessionId = localStorage.getItem('webscape_session');
  if (savedSessionId) {
    console.log('Found saved session, validating...');
    validateSession(savedSessionId);
  } else {
    console.log('No saved session found, showing login modal...');
    showLoginModal();
  }
}

/**
 * Set callback functions for game integration
 */
export function setMultiplayerCallbacks(callbacks) {
  if (callbacks.onPlayerMove) onPlayerMove = callbacks.onPlayerMove;
  if (callbacks.onChatMessage) onChatMessage = callbacks.onChatMessage;
  if (callbacks.onUserProfileUpdate) onUserProfileUpdate = callbacks.onUserProfileUpdate;
}

/**
 * Get current online status
 */
export function getOnlineStatus() {
  return {
    isOnline,
    username: currentUser?.username,
    playerCount: onlinePlayers.size
  };
}

/**
 * Get list of online players
 */
export function getOnlinePlayers() {
  return Array.from(onlinePlayers.values());
}

/**
 * Validate existing session
 */
async function validateSession(sessionId) {
  try {
    const response = await fetch(`${API_BASE}/validate-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sessionId })
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('Session validated, logging in...');
      loginWithSession(sessionId, result.profile);
    } else {
      console.log('Session invalid, showing login');
      localStorage.removeItem('webscape_session');
      showLoginModal();
    }
  } catch (error) {
    console.error('Session validation failed:', error);
    showLoginModal();
  }
}

/**
 * Login with validated session
 */
function loginWithSession(sessionIdParam, profile) {
  sessionId = sessionIdParam;
  currentUser = profile;
  
  // Update user profile in game
  if (onUserProfileUpdate) {
    onUserProfileUpdate(profile);
  }
  
  // Connect to WebSocket
  connectWebSocket();
  
  // Start shop sync updates
  startShopSyncUpdates();
  
  console.log(`Logged in as: ${profile.username}`);
}

/**
 * Setup multiplayer UI elements
 */
function setupMultiplayerUI() {
  // Add login/logout button to character profile
  const characterProfile = document.getElementById('character-profile');
  if (characterProfile) {
    const multiplayerStatus = document.createElement('div');
    multiplayerStatus.className = 'multiplayer-status';
    multiplayerStatus.id = 'multiplayer-status';
    
    const statusText = document.createElement('span');
    statusText.id = 'status-text';
    statusText.textContent = 'Offline';
    
    const actionButton = document.createElement('button');
    actionButton.id = 'multiplayer-action-btn';
    actionButton.className = 'btn-small';
    actionButton.textContent = 'Login';
    actionButton.onclick = () => {
      if (isOnline) {
        logout();
      } else {
        showLoginModal();
      }
    };
    
    multiplayerStatus.appendChild(statusText);
    multiplayerStatus.appendChild(actionButton);
    characterProfile.appendChild(multiplayerStatus);
  }
  
  // Add online players count to chat
  const chatContainer = document.querySelector('.chat-container');
  if (chatContainer) {
    const onlineCount = document.createElement('div');
    onlineCount.className = 'online-count';
    onlineCount.id = 'online-count';
    onlineCount.textContent = 'Players online: 0';
    chatContainer.insertBefore(onlineCount, chatContainer.firstChild);
  }
}

/**
 * Show login modal - redirects to splash screen
 */
function showLoginModal() {
  // Redirect to splash screen for unified login experience
  window.location.href = 'splash.html';
}



/**
 * Hide login modal
 */
function hideLoginModal() {
  if (loginModal) {
    loginModal.remove();
    loginModal = null;
  }
}

/**
 * Login to server
 */
async function login(username, password) {
  try {
    const response = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    });
    
    const result = await response.json();
    
    if (result.success) {
      sessionId = result.sessionId;
      currentUser = result.profile;
      
      // Save session
      localStorage.setItem('webscape_session', sessionId);
      
      // Update game profile
      if (onUserProfileUpdate) {
        onUserProfileUpdate(result.profile);
      }
      
      // Connect to WebSocket
      connectWebSocket();
      
      // Start shop sync updates
      startShopSyncUpdates();
      
      console.log(`Logged in as: ${username}`);
    }
    
    return result;
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: 'Connection failed' };
  }
}

/**
 * Register new account
 */
async function register(username, password) {
  try {
    const response = await fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    });
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Registration error:', error);
    return { success: false, error: 'Connection failed' };
  }
}

/**
 * Logout from server
 */
function logout() {
  if (socket) {
    socket.close();
  }
  
  // Stop shop sync updates
  stopShopSyncUpdates();
  
  sessionId = null;
  currentUser = null;
  onlinePlayers.clear();
  
  localStorage.removeItem('webscape_session');
  updateMultiplayerStatus(false, null);
  
  console.log('Logged out');
}

/**
 * Connect to WebSocket server
 */
function connectWebSocket() {
  if (!sessionId) return;
  
  console.log('Connecting to WebSocket server...');
  
  socket = new WebSocket(WS_URL);
  
  socket.onopen = () => {
    console.log('WebSocket connected');
    
    // Authenticate with server
    socket.send(JSON.stringify({
      type: 'authenticate',
      sessionId: sessionId
    }));
  };
  
  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      handleWebSocketMessage(data);
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  };
  
  socket.onclose = (event) => {
    console.log('WebSocket disconnected:', event.code, event.reason);
    
    // Clear online players when disconnected
    if (onlinePlayers.size > 0) {
      console.log('Clearing online players due to disconnection');
      // Remove all online players from visualization
      onlinePlayers.forEach((player, username) => {
        if (onPlayerMove) {
          onPlayerMove(username, null, null, null); // Remove player
        }
      });
      onlinePlayers.clear();
      updateOnlineCount();
    }
    
    // Attempt to reconnect if we were previously authenticated
    if (isOnline && sessionId) {
      console.log('Attempting to reconnect in 3 seconds...');
      setTimeout(() => {
        if (sessionId && !socket || socket.readyState === WebSocket.CLOSED) {
          console.log('Reconnecting to WebSocket...');
          connectWebSocket();
        }
      }, 3000);
    }
  };
  
  socket.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
}

/**
 * Handle WebSocket messages
 */
function handleWebSocketMessage(data) {
  if (DEBUG_MULTIPLAYER) console.log('📨 Received WebSocket message:', data.type, data);
  
  switch (data.type) {
    case 'auth-success':
      updateMultiplayerStatus(true, data.username);
      
      // Handle spawn position if provided - teleport directly, don't pathfind
      if (data.spawnPosition && window.worldModule) {
        console.log(`🚀 Teleporting to position: ${data.spawnPosition.x}, ${data.spawnPosition.y}`);
        
        // Use direct position setting instead of movePlayerToTarget to avoid pathfinding
        if (window.worldModule.setPlayerPosition) {
          window.worldModule.setPlayerPosition(data.spawnPosition.x, data.spawnPosition.y);
        } else {
          // Fallback: force immediate movement
          window.worldModule.movePlayerToTarget(data.spawnPosition.x, data.spawnPosition.y);
        }
      }
      
      // Load saved player data from server
      if (data.savedSkills || data.savedInventory || data.savedPosition) {
        loadPlayerDataFromServer(data);
      }
      
      // Request sync for various multiplayer systems
      setTimeout(() => {
        requestDiggingHolesSync();
      }, 100); // Small delay to ensure modules are ready
      
      console.log('Authenticated with server');
      
      // Store initial HP values for combat module initialisation
      if (typeof data.currentHP === 'number' && typeof data.maxHP === 'number') {
        window.initialCurrentHP = data.currentHP;
        window.initialMaxHP = data.maxHP;
        if (window.combatModule?.updateLocalHPBar) {
          window.combatModule.updateLocalHPBar(data.currentHP, data.maxHP);
        } else if (window.uiModule?.updateHUDHPDisplay) {
          window.uiModule.updateHUDHPDisplay(data.currentHP, data.maxHP);
        }
      }
      break;
      
    case 'auth-failed':
      console.error('Authentication failed:', data.message);
      
      // Show specific error message
      if (data.message && data.message.includes('another location')) {
        if (window.addMessage) {
          window.addMessage('⚠️ Account logged in from another location', 'warning');
        }
      } else {
        if (window.addMessage) {
          window.addMessage('🔒 Authentication failed - Please log in again', 'error');
        }
      }
      
      logout();
      showLoginModal();
      break;
      
    case 'players-online':
      updateOnlinePlayers(data.players);
      break;
      
    case 'player-connect':
      addOnlinePlayer(data.username, data.position, data.profile);
      break;
      
    case 'player-disconnect':
      removeOnlinePlayer(data.username);
      break;
      
    case 'player-move':
      // Pass enhanced movement data if available
      updatePlayerPosition(data.username, data.position, data.target, data.movementType);
      break;
      
    case 'player-position-sync':
      // Handle periodic position sync updates for better consistency
      updatePlayerPosition(data.username, data.position, null, 'sync');
      break;
      
    case 'player-color-update':
      updatePlayerColor(data.username, data.color, data.profile);
      break;
      
    case 'player-profile-update':
      console.log('👤 Received player profile update:', data);
      handlePlayerProfileUpdate(data);
      break;
      
    case 'player-data-saved':
      console.log('✅ Player data saved to server at', new Date(data.timestamp).toLocaleTimeString());
      break;
      
    case 'chat-message':
      handleMultiplayerChat(data);
      break;
      
    case 'sync-inventory':
      handleInventorySync(data);
      break;
    case 'inventory-sync':
      handleInventorySync(data);
      break;
    case 'player-action-bubble-show':
      console.log('🎭 Received action bubble show message:', data);
      handlePlayerActionBubbleShow(data);
      break;
    case 'player-action-bubble-hide':
      console.log('🎭 Received action bubble hide message:', data);
      handlePlayerActionBubbleHide(data);
      break;
    case 'player-resource-depleted':
      console.log('🪨 Received resource depletion message:', data);
      handlePlayerResourceDepleted(data);
      break;
    case 'player-resource-respawned':
      console.log('🌱 Received resource respawn message:', data);
      handlePlayerResourceRespawned(data);
      break;
    case 'resource-depletion-confirmed':
      console.log('✅ Resource depletion confirmed by server:', data);
      handleResourceDepletionConfirmed(data);
      break;
    case 'resource-depletion-denied':
      console.log('❌ Resource depletion denied by server:', data);
      handleResourceDepletionDenied(data);
      break;
    case 'world-state-sync':
      console.log('🌍 Received world state sync:', data);
      handleWorldStateSync(data);
      break;
    case 'resource-action-approved':
      console.log('✅ Resource action approved by server:', data);
      handleResourceActionApproved(data);
      break;
    case 'resource-action-denied':
      console.log('❌ Resource action denied by server:', data);
      handleResourceActionDenied(data);
      break;
    case 'resource-action-cancelled':
      console.log('🔄 Previous resource action cancelled by server:', data);
      handleResourceActionCancelled(data);
      break;
    
    case 'floor-items-sync':
      console.log('🎒 Received floor items sync:', data);
      handleFloorItemsSync(data);
      break;
    case 'floor-item-drop-confirmed':
      console.log('✅ Floor item drop confirmed by server:', data);
      handleFloorItemDropConfirmed(data);
      break;
    case 'floor-item-drop-denied':
      console.log('❌ Floor item drop denied by server:', data);
      handleFloorItemDropDenied(data);
      break;
    case 'floor-item-pickup-confirmed':
      console.log('✅ Floor item pickup confirmed by server:', data);
      handleFloorItemPickupConfirmed(data);
      break;
    case 'floor-item-pickup-denied':
      console.log('❌ Floor item pickup denied by server:', data);
      handleFloorItemPickupDenied(data);
      break;
    case 'floor-item-created':
      console.log(`🎒 Player ${data.droppedBy} dropped item at (${data.floorItem.x}, ${data.floorItem.y})`);
      handleFloorItemCreated(data);
      break;
    case 'floor-item-updated':
      console.log(`📦 Player ${data.updatedBy} stacked item at (${data.floorItem.x}, ${data.floorItem.y})`);
      handleFloorItemUpdated(data);
      break;
    case 'floor-item-picked-up':
      handleFloorItemPickedUp(data);
      break;
    case 'shop-sync':
      handleShopSync(data);
      break;
    case 'shop-buy-confirmed':
      handleShopBuyConfirmed(data);
      break;
    case 'shop-buy-denied':
      handleShopBuyDenied(data);
      break;
    case 'shop-sell-confirmed':
      handleShopSellConfirmed(data);
      break;
    case 'shop-sell-denied':
      handleShopSellDenied(data);
      break;
    case 'bank-open-confirmed':
    case 'bank-open-denied':
    case 'bank-deposit-confirmed':
    case 'bank-deposit-denied':
    case 'bank-withdraw-confirmed':
    case 'bank-withdraw-denied':
      // Handle bank messages through the bank module
      if (window.bankModule && window.bankModule.handleBankMessage) {
        window.bankModule.handleBankMessage(data);
      } else {
        console.warn('🏦 Bank module not available for message:', data.type);
      }
      break;
    case 'error':
      // Handle server errors
      console.error('❌ Server error:', data.message);
      if (window.chatModule && window.chatModule.addMessage) {
        window.chatModule.addMessage(`❌ Server error: ${data.message}`, 'error');
      }
      break;
    case 'shop-updated':
      handleShopUpdated(data);
      break;
    case 'npc-data':
      console.log('🎭 Received NPC data:', data);
      if (window.npcModule && window.npcModule.handleNPCData) {
        window.npcModule.handleNPCData(data.npcs);
      }
      break;
    case 'npc-move':
      //if (DEBUG_MULTIPLAYER) console.log('🎭 NPC movement:', data);
      if (window.npcModule && window.npcModule.handleNPCMove) {
        window.npcModule.handleNPCMove(data);
      }
      break;
    case 'npc-stop':
      //console.log('🎭 NPC stopped:', data);
      if (window.npcModule && window.npcModule.handleNPCStop) {
        window.npcModule.handleNPCStop(data);
      }
      break;
    case 'npc-resume':
      //console.log('🎭 NPC resumed:', data);
      if (window.npcModule && window.npcModule.handleNPCResume) {
        window.npcModule.handleNPCResume(data);
      }
      break;
    case 'npc-retreating':
      console.log('🏃 NPC retreating:', data);
      if (window.combatModule && window.combatModule.handleNPCRetreating) {
        window.combatModule.handleNPCRetreating(data);
      }
      break;
    case 'npc-death':
      console.log('💀 NPC death:', data);
      if (window.npcModule && window.npcModule.handleNPCDeath) {
        window.npcModule.handleNPCDeath(data);
      }
      break;
    case 'npc-remove':
      console.log('🎭 NPC removed:', data);
      if (window.npcModule && window.npcModule.handleNPCRemove) {
        window.npcModule.handleNPCRemove(data);
      }
      break;
    case 'combat-hit':
      if (window.combatModule && window.combatModule.handleCombatHit) {
        window.combatModule.handleCombatHit(data);
      }
      break;
    case 'npc-create':
      console.log('🎉 NPC respawn/create message received:', data);
      if (window.npcModule && window.npcModule.addNPC) {
        window.npcModule.addNPC(data.npc);
        // Force a position refresh so the new NPC appears even if the camera hasn't moved
        if (window.npcModule.updateAllNPCPositions) {
          window.npcModule.updateAllNPCPositions();
        }
      }
      break;
    case 'floor-item-despawned':
      console.log('🗑️ Floor item despawned due to', data.reason, data.floorItemId);
      if (window.inventoryModuleFunctions?.removeFloorItemFromDisplay) {
        window.inventoryModuleFunctions.removeFloorItemFromDisplay(data.floorItemId);
      }
      break;
    case 'player-health-update':
      console.log('💉 Player health update packet:', data);
      if (data.username) {
        if (data.username === getCurrentUser()?.username) {
          // local
          if (window.combatModule?.updateLocalHPBar) {
            window.combatModule.updateLocalHPBar(data.currentHP, data.maxHP);
          } else if (window.uiModule?.updateHUDHPDisplay) {
            window.uiModule.updateHUDHPDisplay(data.currentHP, data.maxHP);
          }
        } else {
          // other player
          if (window.updateOnlinePlayerHP) {
            window.updateOnlinePlayerHP(data.username, data.currentHP, data.maxHP);
          }
        }
      }
      break;
    case 'player-respawn':
       if (data.username) {
         if (window.onPlayerRespawn) {
           window.onPlayerRespawn(data.username, data.position);
         }
       }
       break;
       
    case 'digging-hole-created':
      console.log('🕳️ Received digging hole created message:', data);
      handleDiggingHoleCreated(data);
      break;
      
    case 'digging-hole-removed':
      console.log('🕳️ Received digging hole removed message:', data);
      handleDiggingHoleRemoved(data);
      break;
      
    case 'digging-holes-sync':
      console.log('🕳️ Received digging holes sync:', data);
      handleDiggingHolesSync(data);
      break;
      
    case 'item-given':
      if (window.inventoryModule) {
        const { id, quantity, noted } = data.item;
        if (noted) {
          if (window.inventoryModule.addItemToInventory) {
            window.inventoryModule.addItemToInventory(id, quantity, true);
          }
        } else {
          if (window.inventoryModule.addItemToInventory) {
            window.inventoryModule.addItemToInventory(id, quantity);
          }
        }
        if (window.showNotification) {
          window.showNotification(`🎁 You received ${quantity}x ${noted?'noted ':''}${id}!`, 'success');
        }
      }
      break;
      
    case 'hitpoints-sync-ack':
      if (DEBUG_MULTIPLAYER) console.log('🔄 HP sync acknowledged:', data);
      break;
      
    case 'skills-sync':
      console.log('📊 Received skills sync from server:', data);
      // Update combat stats when skills are synced
      if (window.combatModule?.updateCombatStats) {
        window.combatModule.updateCombatStats();
      }
      break;
      
    default:
      console.log('Unknown message type:', data.type);
      break;
  }
}

/**
 * Update multiplayer status UI
 */
function updateMultiplayerStatus(online, username) {
  isOnline = online;
  
  const statusText = document.getElementById('status-text');
  const actionButton = document.getElementById('multiplayer-action-btn');
  
  if (statusText && actionButton) {
    if (online && username) {
      statusText.textContent = `Online: ${username}`;
      // Hide the action button to remove header logout option
      actionButton.style.display = 'none';
    } else {
      statusText.textContent = 'Offline';
      actionButton.style.display = '';
      actionButton.textContent = 'Login';
    }
  }
  
  updateOnlineCount();
}

/**
 * Update online players list
 */
function updateOnlinePlayers(players) {
  onlinePlayers.clear();
  players.forEach(player => {
    onlinePlayers.set(player.username, player);
  });
  
  updateOnlineCount();
  
  // Notify game about online players
  if (onPlayerMove) {
    players.forEach(player => {
      if (player.username !== currentUser?.username) {
        onPlayerMove(player.username, player.position, player.profile, null); // No movement data for initial spawn
      }
    });
  }
}

/**
 * Add online player
 */
function addOnlinePlayer(username, position, profile) {
  onlinePlayers.set(username, { username, position, profile });
  updateOnlineCount();
  
  if (onPlayerMove && username !== currentUser?.username) {
    onPlayerMove(username, position, profile, null); // No movement data for initial spawn
  }
}

/**
 * Remove online player
 */
function removeOnlinePlayer(username) {
  onlinePlayers.delete(username);
  updateOnlineCount();
  
  // Notify game to remove player visualization
  if (onPlayerMove) {
    onPlayerMove(username, null, null, null); // null position means remove
  }
}

/**
 * Update player position
 */
function updatePlayerPosition(username, position, target, movementType) {
  const player = onlinePlayers.get(username);
  if (player) {
    player.position = position;
    player.target = target;
    player.movementType = movementType;
    
    if (onPlayerMove && username !== currentUser?.username) {
      // Pass enhanced movement data to game handler
      const movementData = target || movementType ? {
        target: target,
        movementType: movementType
      } : null;
      
      onPlayerMove(username, position, player.profile, movementData);
    }
  }
}

/**
 * Handle multiplayer chat message
 */
function handleMultiplayerChat(data) {
  if (onChatMessage) {
    onChatMessage(data.username, data.message, data.timestamp, data.isModerator ? 'mod' : 'multiplayer');
  }
}

/**
 * Update online count display
 */
function updateOnlineCount() {
  const onlineCountEl = document.getElementById('online-count');
  if (onlineCountEl) {
    const count = isOnline ? onlinePlayers.size : 0;
    onlineCountEl.textContent = `Players online: ${count}`;
  }
}

/**
 * Send player color update to server
 */
export function sendPlayerColorUpdate(color) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      type: 'player-color-update',
      color: color
    }));
  }
}

/**
 * Send player movement to server
 */
export function sendPlayerMove(position) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    // Get current map level from world module
    const mapLevel = window.worldModule?.getCurrentMapLevel ? window.worldModule.getCurrentMapLevel() : 'surface';
    
    // Send position with map level
    socket.send(JSON.stringify({
      type: 'player-move',
      position: {
        x: position.x,
        y: position.y,
        mapLevel: mapLevel
      }
    }));
  }
}

/**
 * Send chat message to server
 */
export function sendChatMessage(message) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      type: 'chat-message',
      message: message
    }));
    // Note: Local display is now handled by the main chat function
  }
}

/**
 * Get current user info
 */
export function getCurrentUser() {
  return currentUser;
}

/**
 * Check if user is online
 */
export function isUserOnline() {
  return isOnline;
}

/**
 * Load world data from server
 */
export async function loadWorldFromServer() {
  try {
    console.log('Loading world data from server...');
    const response = await fetch(`${API_BASE}/world`);
    
    if (!response.ok) {
      console.error('Failed to load world data:', response.status, response.statusText);
      return null;
    }
    
    const worldData = await response.json();
    
    // Check if it's an error response
    if (worldData.error) {
      console.error('Server error loading world data:', worldData.error);
      return null;
    }
    
    console.log('World data loaded from server successfully');
    console.log('World contains layers:', Object.keys(worldData.layers || {}));
    console.log('Player spawns:', worldData.playerSpawns?.length || 0, 'players');
    
    return worldData;
  } catch (error) {
    console.error('Error loading world data from server:', error);
    return null;
  }
}

/**
 * Update player color in real-time
 */
function updatePlayerColor(username, color, profile) {
  const player = onlinePlayers.get(username);
  if (player) {
    // Update the stored profile color
    player.profile = { ...player.profile, settings: { ...player.profile?.settings, playerColor: color } };
    
    // Notify game about the color update with updated profile
    if (onPlayerMove && username !== currentUser?.username) {
      onPlayerMove(username, player.position, player.profile, null);
    }
  }
}

/**
 * Load saved player data from server and apply to local game state
 */
function loadPlayerDataFromServer(serverData) {
  console.log('🔄 Loading saved player data from server...');
  
  // Load saved skills
  if (serverData.savedSkills && window.userModule && window.userModule.getProfile) {
    console.log('🎯 Loading saved skills from server');
    const profile = window.userModule.getProfile();
    if (profile) {
      // Server now sends skills in numeric format, use directly
      profile.skills = { ...serverData.savedSkills };
      
      // Load experience data if available
      if (serverData.savedSkillsExp) {
        profile.skillsExp = { ...serverData.savedSkillsExp };
      } else {
        // Initialize experience if not provided
        if (!profile.skillsExp) {
          profile.skillsExp = {};
        }
        // Ensure all skills have experience values
        Object.keys(profile.skills).forEach(skillName => {
          if (profile.skillsExp[skillName] === undefined) {
            profile.skillsExp[skillName] = skillName === 'hitpoints' ? 1154 : 0;
          }
        });
      }
      
      // Recalculate total level and combat level
      if (window.calculateTotalLevel) {
        profile.totalLevel = window.calculateTotalLevel(profile.skills);
      }
      if (window.calculateCombatLevel) {
        profile.combatLevel = window.calculateCombatLevel(profile.skills);
      }
      
      // Update the UI
      if (window.initializeSkillsUI) {
        window.initializeSkillsUI(profile, { onSkillChange: window.updateProfileInfo });
      }
      if (window.updateProfileInfo) {
        window.updateProfileInfo();
      }
      
      // Update experience bars to reflect current XP progress
      if (window.uiModule && window.uiModule.updateAllExperienceBars) {
        window.uiModule.updateAllExperienceBars();
      }
      
      console.log(`✅ Skills loaded from server (Total Level: ${profile.totalLevel})`);
    }
  }
  
  // Load saved inventory
  if (serverData.savedInventory && window.inventoryModule) {
    console.log('🎒 Loading saved inventory from server');
    
    // Clear current inventory
    if (window.inventoryModule.playerInventory) {
      window.inventoryModule.playerInventory.fill(null);
      
      // Load items from server
      serverData.savedInventory.forEach((item, index) => {
        if (item && index < window.inventoryModule.playerInventory.length) {
          window.inventoryModule.playerInventory[index] = item;
        }
      });
      
      // Update inventory display
      if (window.inventoryModule.updateInventoryDisplay) {
        window.inventoryModule.updateInventoryDisplay();
      }
      
      const itemCount = serverData.savedInventory.filter(item => item).length;
      console.log(`✅ Inventory loaded from server (${itemCount} items)`);
    }
  }
  
  // Load completed books
  if (serverData.savedCompletedBooks && window.userModule && window.userModule.getProfile) {
    console.log('📚 Loading saved completed books from server');
    const profile = window.userModule.getProfile();
    if (profile) {
      profile.completedBooks = [...serverData.savedCompletedBooks];
      console.log(`✅ Completed books loaded from server (${profile.completedBooks.length} books)`);
    }
  }

  // Position is handled separately in the spawn logic
  if (serverData.savedPosition) {
    console.log(`📍 Loaded saved position: (${serverData.savedPosition.x}, ${serverData.savedPosition.y})`);
  }
}

/**
 * Update another player's profile when they change skills/stats
 */
function updatePlayerProfile(username, profile) {
  const player = onlinePlayers.get(username);
  if (player) {
    player.profile = profile;
    console.log(`🔄 Updated profile for player ${username} (Total Level: ${profile.totalLevel})`);
  }
}

/**
 * Send complete player data to server for saving
 */
export function savePlayerDataToServer(data) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      type: 'save-player-data',
      ...data
    }));
    console.log('💾 Sending player data to server for saving');
  }
}

/**
 * Send skills data to server for synchronization
 */
export function syncSkillsWithServer(skills, totalLevel, combatLevel, skillsExp = null) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    const syncData = {
      type: 'sync-skills',
      skills: skills,
      totalLevel: totalLevel,
      combatLevel: combatLevel
    };
    
    // Include skills experience if available
    if (skillsExp || (window.userModule && window.userModule.getProfile)) {
      const profile = window.userModule ? window.userModule.getProfile() : null;
      syncData.skillsExp = skillsExp || (profile ? profile.skillsExp : null);
    }
    
    socket.send(JSON.stringify(syncData));
    console.log('🎯 Syncing skills with server');
  }
}

/**
 * Send inventory data to server for synchronization
 */
export function syncInventoryWithServer(inventory) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      type: 'sync-inventory',
      inventory: inventory
    }));
    console.log('🎒 Syncing inventory with server');
  }
}

/**
 * Sync hitpoints with server
 */
export function syncHitpointsWithServer(currentHP, maxHP) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      type: 'sync-hitpoints',
      currentHP: currentHP,
      maxHP: maxHP,
      timestamp: Date.now()
    }));
    console.log(`🩺 Syncing HP with server: ${currentHP}/${maxHP}`);
  }
}

/**
 * Get current multiplayer sync status
 */
export function getMultiplayerSyncStatus() {
  return {
    isOnline: isOnline,
    canSync: socket && socket.readyState === WebSocket.OPEN,
    username: currentUser?.username
  };
}

/**
 * Handle inventory sync
 */
function handleInventorySync(data) {
  // This handles inventory sync messages from the server
  console.log('📦 Inventory sync message received from server:', data);
  
  if (data.inventory && window.inventoryModule) {
    // Update the client inventory with server data
    if (window.inventoryModule.getPlayerInventory) {
      const clientInventory = window.inventoryModule.getPlayerInventory();
      
      // Ensure client inventory is large enough to hold server data
      const maxLength = Math.max(clientInventory.length, data.inventory.length);
      
      // Extend client inventory if needed
      while (clientInventory.length < maxLength) {
        clientInventory.push(null);
      }
      
      // Replace client inventory with server inventory
      for (let i = 0; i < maxLength; i++) {
        clientInventory[i] = i < data.inventory.length ? data.inventory[i] : null;
      }
      
      console.log('✅ Inventory synced from server');
      
      // After syncing, ensure no invalid non-stackable stacks remain
      if (window.inventoryModule.ensureInventoryIntegrity) {
        window.inventoryModule.ensureInventoryIntegrity();
      }
      
      // Update the main inventory display
      if (window.inventoryModule.updateInventoryDisplay) {
        window.inventoryModule.updateInventoryDisplay();
      }
      
      // Check if shop interface is open and update it immediately
      let shopIsOpen = false;
      
      // Try multiple ways to detect if shop is open
      if (window.inventoryModule.shopInterface && window.inventoryModule.shopInterface.open) {
        shopIsOpen = true;
        console.log('🏪 Shop detected as open via inventoryModule.shopInterface');
      } else {
        // Fallback: check if shop overlay is visible
        const shopOverlay = document.getElementById('shop-overlay');
        if (shopOverlay && shopOverlay.style.display !== 'none') {
          shopIsOpen = true;
          console.log('🏪 Shop detected as open via DOM overlay visibility');
        }
      }
      
      if (shopIsOpen) {
        console.log('🔄 Shop is open - updating shop inventory display immediately');
        
        // Update shop inventory display with a slight delay to ensure inventory is fully synced
        setTimeout(() => {
          if (window.inventoryModule.updateShopInventoryDisplay) {
            console.log('🏪 Calling updateShopInventoryDisplay...');
            window.inventoryModule.updateShopInventoryDisplay();
          } else if (window.inventoryModuleFunctions && window.inventoryModuleFunctions.refreshShopInterface) {
            console.log('🏪 Fallback: Calling refreshShopInterface...');
            window.inventoryModuleFunctions.refreshShopInterface();
          } else {
            console.warn('⚠️ No shop update function available');
          }
          
          // Also update shop stock display to keep everything in sync
          if (window.inventoryModule.updateShopDisplay) {
            console.log('🏪 Also updating shop stock display...');
            window.inventoryModule.updateShopDisplay();
          }
          
          // Force a refresh of the entire shop interface if available
          if (window.inventoryModule.refreshShopInterface) {
            console.log('🏪 Forcing complete shop interface refresh...');
            window.inventoryModule.refreshShopInterface();
          }
        }, 50); // Small delay to ensure all data is processed
        
        // Also do an immediate update
        if (window.inventoryModule.updateShopInventoryDisplay) {
          console.log('🏪 Immediate shop inventory display update');
          window.inventoryModule.updateShopInventoryDisplay();
        }
      } else {
        console.log('🏠 Shop is not open, skipping shop display update');
      }
    } else {
      console.warn('⚠️ getPlayerInventory function not available');
    }
  } else {
    console.warn('⚠️ No inventory data or inventoryModule not available');
  }
}

/**
 * Handle player resource depletion
 */
function handlePlayerResourceDepleted(data) {
  const { username, resourceType, x, y, resourceId, respawnTime } = data;
  
  if (!username || !resourceType || typeof x !== 'number' || typeof y !== 'number') {
    console.warn('❌ Invalid resource depletion data:', data);
    return;
  }
  
  console.log(`🪨 Player ${username} depleted ${resourceType} at (${x}, ${y})`);
  
  // Find the resource element and update its appearance
  const resourceElement = document.querySelector(`.world-object[data-type="${resourceType}"][data-x="${x}"][data-y="${y}"]`);
  if (resourceElement) {
    // Update depleted state based on resource type
    if (resourceType.startsWith('ore_')) {
      if (resourceType === 'ore_gold') {
        // Gold ore uses 3D model, let the world module handle it
        if (window.worldModule && window.worldModule.forceWorldRerender) {
          window.worldModule.forceWorldRerender();
        }
      } else {
        resourceElement.textContent = '🪨';
        resourceElement.title = 'Depleted ore (respawning...)';
        resourceElement.dataset.depleted = 'true';
      }
      
      // Update global depleted ore states if available
      if (window.depletedOreStates) {
        const oreKey = `${x},${y}`;
        window.depletedOreStates.set(oreKey, {
          oreType: resourceType,
          originalText: resourceElement.textContent,
          originalTitle: resourceElement.title,
          depletedAt: Date.now()
        });
      }
    } else if (resourceType.startsWith('tree_')) {
      // For custom image trees, hide the background image and show sapling
      if (resourceElement.style.backgroundImage && resourceElement.style.backgroundImage !== 'none') {
        resourceElement.style.backgroundImage = 'none';
        resourceElement.innerHTML = '🌱';
        resourceElement.style.fontSize = '24px';
        resourceElement.style.display = 'flex';
        resourceElement.style.alignItems = 'center';
        resourceElement.style.justifyContent = 'center';
        resourceElement.style.textShadow = '1px 1px 1px #000000, -1px -1px 1px #000000, 1px -1px 1px #000000, -1px 1px 1px #000000';
        resourceElement.style.filter = 'none';
      } else {
        // For emoji trees, just change the text content
        resourceElement.textContent = '🌱';
      }
      
      resourceElement.title = 'Tree stump (regrowing...)';
      resourceElement.dataset.depleted = 'true';
      
      // Update global depleted tree states if available
      if (window.depletedTreeStates) {
        const treeKey = `${x},${y}`;
        window.depletedTreeStates.set(treeKey, {
          treeType: resourceType,
          originalText: resourceElement.textContent,
          originalTitle: resourceElement.title,
          depletedAt: Date.now()
        });
      }
    }
    
    console.log(`✅ Updated depleted resource appearance for ${resourceType} at (${x}, ${y})`);
  } else {
    console.warn(`❌ Could not find resource element for ${resourceType} at (${x}, ${y})`);
  }
}

/**
 * Handle player resource respawn
 */
function handlePlayerResourceRespawned(data) {
  const { resourceType, x, y, resourceId } = data;
  
  if (!resourceType || typeof x !== 'number' || typeof y !== 'number') {
    console.warn('❌ Invalid resource respawn data:', data);
    return;
  }
  
  console.log(`🌱 Server respawned ${resourceType} at (${x}, ${y})`);
  
  // Call the appropriate skill module respawn function
  if (resourceType.startsWith('ore_')) {
    // Call mining module respawn function
    if (window.miningModule && window.miningModule.respawnOreFromServer) {
      window.miningModule.respawnOreFromServer(resourceType, x, y);
    }
  } else if (resourceType.startsWith('tree_')) {
    // Call woodcutting module respawn function
    if (window.woodcuttingModule && window.woodcuttingModule.respawnTreeFromServer) {
      window.woodcuttingModule.respawnTreeFromServer(resourceType, x, y);
    }
  }
}

/**
 * Handle player action bubble show
 */
function handlePlayerActionBubbleShow(data) {
  const { username, skillName, customText, customIcon } = data;
  
  if (!username) return;
  
  console.log(`🎭 Showing action bubble for ${username}: ${skillName}`);
  
  // Find the player's element using the correct attribute
  const playerElement = document.querySelector(`[data-username="${username}"]`);
  if (!playerElement) {
    console.warn(`❌ Player element not found for: ${username}. Will retry up to 10 times.`);
    // Retry a few times in case the DOM has not yet created the player element
    let attempts = 0;
    const maxAttempts = 10;
    const retryInterval = setInterval(() => {
      const el = document.querySelector(`[data-username="${username}"]`);
      if (el) {
        clearInterval(retryInterval);
        showPlayerActionBubble(el, skillName, customText, customIcon, username);
      } else if (++attempts >= maxAttempts) {
        clearInterval(retryInterval);
        console.warn(`❌ Could not find player element for ${username} after ${maxAttempts} retries. Giving up.`);
      }
    }, 150);
    return;
  }
  
  console.log(`✅ Found player element for ${username}:`, playerElement);
  
  // Remove any existing action bubble for this player
  hidePlayerActionBubble(username);
  
  // Create action bubble for the player
  showPlayerActionBubble(playerElement, skillName, customText, customIcon, username);
}

/**
 * Handle player action bubble hide
 */
function handlePlayerActionBubbleHide(data) {
  const { username } = data;
  
  if (!username) return;
  
  console.log(`🎭 Hiding action bubble for ${username}`);
  
  // Hide the action bubble for this player
  hidePlayerActionBubble(username);
}

/**
 * Show action bubble on another player
 */
function showPlayerActionBubble(playerElement, skillName, customText, customIcon, username) {
  console.log(`🎨 Creating action bubble for ${username} - ${skillName}`);
  
  // Get the game world container
  const gameWorld = document.querySelector('.game-world') || document.getElementById('game-world');
  if (!gameWorld) {
    console.error('❌ Game world container not found for action bubble');
    return;
  }
  
  // Get the player's color for tinting the bubble
  let playerColor = '#3498db'; // Default blue fallback
  
  // Try to get color from the player element's style
  if (playerElement && playerElement.style.backgroundColor) {
    playerColor = playerElement.style.backgroundColor;
  } else {
    // Try to get from online players data
    const player = onlinePlayers.get(username);
    if (player && player.profile && player.profile.settings && player.profile.settings.playerColor) {
      playerColor = player.profile.settings.playerColor;
    }
  }
  
  // Convert player color to an almost black tinted background
  let tintedBackground = 'rgba(20, 20, 20, 0.95)'; // Default almost black
  try {
    // Extract RGB values from the player color and create a very dark tinted version
    const colorMatch = playerColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (colorMatch) {
      const r = parseInt(colorMatch[1]);
      const g = parseInt(colorMatch[2]);
      const b = parseInt(colorMatch[3]);
      
      // Create almost black with slight tint (mix 10% player color with black)
      const tintedR = Math.floor(r * 0.4);
      const tintedG = Math.floor(g * 0.4);
      const tintedB = Math.floor(b * 0.4);
      
      tintedBackground = `rgba(${tintedR}, ${tintedG}, ${tintedB}, 0.95)`;
    } else if (playerColor.startsWith('#')) {
      // Handle hex colors
      const hex = playerColor.replace('#', '');
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      
      // Create almost black with slight tint (mix 10% player color with black)
      const tintedR = Math.floor(r * 0.1);
      const tintedG = Math.floor(g * 0.1);
      const tintedB = Math.floor(b * 0.1);
      
      tintedBackground = `rgba(${tintedR}, ${tintedG}, ${tintedB}, 0.95)`;
    }
  } catch (error) {
    console.warn('Could not parse player color for tinting:', playerColor, error);
  }
  
  console.log(`🎨 Using tinted background for ${username}: ${tintedBackground} (from player color: ${playerColor})`);
  
  // Import skill bubble config (similar to skillBubbles.js)
  const SKILL_BUBBLE_CONFIG = {
    // Combat Skills
    attack: { icon: '⚔️', text: 'Attack', iconClass: 'attack' },
    magic: { icon: '🪄', text: 'Magic', iconClass: 'magic' },
    ranged: { icon: '🏹', text: 'Ranged', iconClass: 'ranged' },
    blasting: { icon: '💣', text: 'Blasting', iconClass: 'blasting' },
    defence: { icon: '🛡️', text: 'Defence', iconClass: 'defence' },
    hitpoints: { icon: '❤️', text: 'Hitpoints', iconClass: 'hitpoints' },
    prayer: { icon: '✨', text: 'Prayer', iconClass: 'prayer' },
    slayer: { icon: '☠️', text: 'Slayer', iconClass: 'slayer' },
  
    // Utility Skills
    taming: { icon: '🐾', text: 'Taming', iconClass: 'taming' },
    thieving: { icon: '🎭️', text: 'Thieving', iconClass: 'thieving' },
    alchemy: { icon: '⚖️', text: 'Alchemy', iconClass: 'alchemy' },
    creation: { icon: '🐣', text: 'Creation', iconClass: 'creation' },
    delivery: { icon: '✉️', text: 'Delivery', iconClass: 'delivery' },
    knowledge: { icon: '📚', text: 'Knowledge', iconClass: 'knowledge' },
    digging: { icon: '🪏', text: 'Digging', iconClass: 'digging' },
    diplomacy: { icon: '🕊️', text: 'Diplomacy', iconClass: 'diplomacy' },
  
    // Gathering Skills
    mining: { icon: '⛏️', text: 'Mining', iconClass: 'mining' },
    woodcutting: { icon: '🪓', text: 'Woodcutting', iconClass: 'woodcutting' },
    fishing: { icon: '🎣', text: 'Fishing', iconClass: 'fishing' },
    harvesting: { icon: '🍄', text: 'Harvesting', iconClass: 'harvesting' },
    ranching: { icon: '🐄', text: 'Ranching', iconClass: 'ranching' },
    apiary: { icon: '🐝', text: 'Apiary', iconClass: 'apiary' },
  
    // Artisan Skills
    smithing: { icon: '🔨', text: 'Smithing', iconClass: 'smithing' },
    fletching: { icon: '🪶', text: 'Fletching', iconClass: 'fletching' },
    cooking: { icon: '🍖', text: 'Cooking', iconClass: 'cooking' },
    apothecary: { icon: '🌿', text: 'apothecary', iconClass: 'apothecary' },
    crafting: { icon: '💍', text: 'Crafting', iconClass: 'crafting' },
    scribing: { icon: '📜', text: 'Scribing', iconClass: 'scribing' },
    confectionery: { icon: '🍰', text: 'Confectionery', iconClass: 'confectionery' },
    brewing: { icon: '🍺', text: 'Brewing', iconClass: 'brewing' },
    tailoring: { icon: '🪡', text: 'Tailoring', iconClass: 'tailoring' },
    bonecarving: { icon: '🦴', text: 'Bonecarving', iconClass: 'bonecarving' },
    painting: { icon: '🎨', text: 'Painting', iconClass: 'painting' },
    masonry: { icon: '🧱', text: 'Masonry', iconClass: 'masonry' },
    candlemaking: { icon: '🕯️', text: 'Candlemaking', iconClass: 'candlemaking' },
    pottery: { icon: '🏺', text: 'Pottery', iconClass: 'pottery' },
  
    // Engineering/Magical Skills
    engineering: { icon: '🗿', text: 'Golemancy', iconClass: 'engineering' },
    dracology: { icon: '🐉', text: 'Dracology', iconClass: 'dracology' }
  };
  
  
  const config = SKILL_BUBBLE_CONFIG[skillName];
  
  // Create bubble container with same approach as speech bubbles
  const bubbleContainer = document.createElement('div');
  bubbleContainer.className = 'skill-bubble-container online-player-bubble';
  bubbleContainer.id = `action-bubble-${username}`;
  
  // Apply positioning styles similar to speech bubbles
  bubbleContainer.style.position = 'absolute';
  bubbleContainer.style.zIndex = '16'; // Higher than speech bubbles (15)
  bubbleContainer.style.pointerEvents = 'none';
  bubbleContainer.style.transition = 'left 0.08s linear, top 0.08s linear, transform 0.08s linear';
  
  // Create bubble
  const bubble = document.createElement('div');
  bubble.className = 'skill-bubble';
  
  // Apply inline styles for better control (using tinted background)
  bubble.style.background = tintedBackground; // Almost black with player color tint
  bubble.style.color = 'white';
  bubble.style.padding = '8px 12px';
  bubble.style.borderRadius = '20px';
  bubble.style.fontSize = '14px';
  bubble.style.fontWeight = 'bold';
  bubble.style.whiteSpace = 'nowrap';
  bubble.style.position = 'relative';
  bubble.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.3)';
  bubble.style.display = 'flex';
  bubble.style.alignItems = 'center';
  bubble.style.gap = '6px';
  bubble.style.width = 'max-content';
  bubble.style.margin = '0';
  bubble.style.border = '1px solid rgba(255, 255, 255, 0.2)'; // Subtle white border
  
  // Create icon
  const iconElement = document.createElement('span');
  iconElement.className = 'skill-bubble-icon';
  if (config) {
    iconElement.classList.add(config.iconClass);
  }
  iconElement.textContent = customIcon || (config ? config.icon : '⚡');
  iconElement.style.fontSize = '16px';
  iconElement.style.flexShrink = '0';
  
  // Create text
  const textElement = document.createElement('span');
  textElement.textContent = customText || (config ? config.text : skillName);
  
  // Create tail (similar to speech bubble tail)
  const tail = document.createElement('div');
  tail.className = 'skill-bubble-tail';
  tail.style.position = 'absolute';
  tail.style.top = '100%';
  tail.style.left = '50%';
  tail.style.transform = 'translateX(-50%)';
  tail.style.width = '0';
  tail.style.height = '0';
  tail.style.borderLeft = '8px solid transparent';
  tail.style.borderRight = '8px solid transparent';
  tail.style.borderTop = `8px solid ${tintedBackground}`; // Match the bubble background
  
  // Assemble bubble
  bubble.appendChild(iconElement);
  bubble.appendChild(textElement);
  bubble.appendChild(tail);
  bubbleContainer.appendChild(bubble);
  
  // Add to game world with transition disabled for first frame
  bubbleContainer.style.transition = 'none';
  gameWorld.appendChild(bubbleContainer);
  
  // Function to update bubble position relative to player (same logic as speech bubbles)
  function updateBubblePosition() {
    if (!bubbleContainer.parentNode || !playerElement.parentNode) {
      return; // Bubble or player was removed
    }
    
    /*
     * Use stable calculated positions instead of getBoundingClientRect when available
     * This prevents jitter during smooth movement animations where bounding rects
     * may not accurately reflect the visual position
     */
    
    let bubbleX, bubbleY;
    
    // Try to use pre-calculated stable position first (set by updateOnlinePlayerPosition)
    if (playerElement.dataset.calculatedX && playerElement.dataset.calculatedY) {
      const playerLeft = parseInt(playerElement.dataset.calculatedX);
      const playerTop = parseInt(playerElement.dataset.calculatedY);
      const playerWidth = playerElement.offsetWidth || (window.worldModule?.getGridSize() || 32);
      
      // Get bubble dimensions to position it properly
      const bubbleHeight = bubbleContainer.offsetHeight || 40; // Default height if not measured yet
      
      // Position bubble above player center
      bubbleX = playerLeft + (playerWidth / 2);
      bubbleY = playerTop - bubbleHeight - 15; // 15px gap above player
    } else {
      // Fallback to bounding rect method
      const playerRect = playerElement.getBoundingClientRect();
      const gameWorldRect = document.querySelector('.game-world').getBoundingClientRect();
      
      // Position relative to game world
      bubbleX = playerRect.left + playerRect.width / 2 - gameWorldRect.left;
      bubbleY = playerRect.top - 15 - gameWorldRect.top; // 15px gap above
    }
    
    // Only update if position changed significantly to reduce jitter
    const currentLeft = parseInt(bubbleContainer.style.left) || 0;
    const currentTop = parseInt(bubbleContainer.style.top) || 0;
    const threshold = 2; // Pixel threshold for updates
    
    if (Math.abs(currentLeft - bubbleX) > threshold || Math.abs(currentTop - bubbleY) > threshold) {
      bubbleContainer.style.left = `${bubbleX}px`;
      bubbleContainer.style.top = `${bubbleY}px`;
    }
  }

  // Update position initially
  updateBubblePosition();

  // Update position periodically, but less frequently to reduce jitter
  let updateInterval = setInterval(() => {
    updateBubblePosition();
  }, 50); // Reduced from every frame to every 50ms for stability
  
  // Store the update interval so we can clean it up when hiding the bubble
  bubbleContainer._updateInterval = updateInterval;
  
  console.log(`✅ Action bubble created and positioned for ${username}: ${skillName}`);
}

/**
 * Hide action bubble from another player
 */
function hidePlayerActionBubble(username) {
  // Look for the bubble in the game world (not on the player element)
  const existingBubble = document.getElementById(`action-bubble-${username}`);
  if (existingBubble) {
    // Clean up the update interval if it exists
    if (existingBubble._updateInterval) {
      clearInterval(existingBubble._updateInterval);
    }
    
    existingBubble.remove();
    console.log(`🗑️ Action bubble removed for ${username}`);
  } else {
    console.log(`⚠️ No action bubble found to remove for ${username}`);
  }
}

/**
 * Send action bubble show to server
 */
export function syncActionBubbleShow(skillName, customText = null, customIcon = null) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      type: 'action-bubble-show',
      skillName: skillName,
      customText: customText,
      customIcon: customIcon
    }));
    console.log(`Sent action bubble show: ${skillName}`);
  }
}

/**
 * Send action bubble hide to server
 */
export function syncActionBubbleHide() {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      type: 'action-bubble-hide'
    }));
    console.log('Sent action bubble hide');
  }
}

/**
 * Send resource depletion to server
 */
export function syncResourceDepleted(resourceType, x, y, resourceId, respawnTime) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      type: 'resource-depleted',
      resourceType: resourceType,
      x: x,
      y: y,
      resourceId: resourceId,
      respawnTime: respawnTime
    }));
    console.log(`Sent resource depletion: ${resourceType} at (${x}, ${y})`);
  }
}

/**
 * Send resource depletion request to server (new server-authoritative method)
 */
export function sendResourceDepletionRequest(resourceType, x, y, resourceId, respawnTime) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      type: 'resource-depletion-request',
      resourceType: resourceType,
      x: x,
      y: y,
      resourceId: resourceId,
      respawnTime: respawnTime
    }));
    console.log(`Sent resource depletion request: ${resourceType} at (${x}, ${y})`);
  }
}

/**
 * Send resource respawn to server
 */
export function syncResourceRespawned(resourceType, x, y, resourceId) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      type: 'resource-respawned',
      resourceType: resourceType,
      x: x,
      y: y,
      resourceId: resourceId
    }));
    console.log(`Sent resource respawn: ${resourceType} at (${x}, ${y})`);
  }
}

/**
 * Update another player's profile when they change skills/stats
 */
function handlePlayerProfileUpdate(data) {
  const player = onlinePlayers.get(data.username);
  if (player) {
    player.profile = data.profile;
    console.log(`🔄 Updated profile for player ${data.username} (Total Level: ${data.profile.totalLevel})`);
  }
}

/**
 * Handle resource depletion confirmation from server
 */
function handleResourceDepletionConfirmed(data) {
  const { resourceType, x, y, resourceId } = data;
  
  if (!resourceType || typeof x !== 'number' || typeof y !== 'number') {
    console.warn('❌ Invalid resource depletion confirmation data:', data);
    return;
  }
  
  console.log(`✅ Server confirmed depletion of ${resourceType} at (${x}, ${y})`);
  
  // Find the resource element to pass to the confirmation handler
  const resourceElement = document.querySelector(`.world-object[data-type="${resourceType}"][data-x="${x}"][data-y="${y}"]`);
  
  // Call the appropriate skill module confirmation function
  if (resourceType.startsWith('ore_')) {
    // Call mining module confirmation function
    if (window.miningModule && window.miningModule.depleteOreConfirmed) {
      window.miningModule.depleteOreConfirmed(resourceType, x, y, resourceElement);
    }
  } else if (resourceType.startsWith('tree_')) {
    // Call woodcutting module confirmation function
    if (window.woodcuttingModule && window.woodcuttingModule.depleteTreeConfirmed) {
      window.woodcuttingModule.depleteTreeConfirmed(resourceType, x, y, resourceElement);
    }
  }
}

/**
 * Handle resource depletion denial from server
 */
function handleResourceDepletionDenied(data) {
  const { resourceType, x, y, reason, depletedBy } = data;
  
  if (!resourceType || typeof x !== 'number' || typeof y !== 'number') {
    console.warn('❌ Invalid resource depletion denial data:', data);
    return;
  }
  
  console.log(`❌ Server denied depletion of ${resourceType} at (${x}, ${y}): ${reason}`);
  
  // Call the appropriate skill module denial function
  if (resourceType.startsWith('ore_')) {
    // Call mining module denial function
    if (window.miningModule && window.miningModule.depleteOreDenied) {
      window.miningModule.depleteOreDenied(resourceType, x, y, reason, depletedBy);
    }
  } else if (resourceType.startsWith('tree_')) {
    // Call woodcutting module denial function
    if (window.woodcuttingModule && window.woodcuttingModule.depleteTreeDenied) {
      window.woodcuttingModule.depleteTreeDenied(resourceType, x, y, reason, depletedBy);
    }
  }
}

/**
 * Handle world state sync
 */
function handleWorldStateSync(data) {
  const { depletedResources } = data;
  
  if (!depletedResources || !Array.isArray(depletedResources)) {
    console.warn('❌ Invalid world state sync data:', data);
    return;
  }
  
  console.log(`🌍 Syncing ${depletedResources.length} depleted resources from server`);
  
  // Apply depleted states immediately if world objects exist
  const applyDepletedStates = () => {
    let appliedCount = 0;
    
    // Apply each depleted resource state
    depletedResources.forEach(resource => {
      const { resourceType, x, y, depletedBy, depletedAt } = resource;
      
      // Call the appropriate skill module depletion function
      if (resourceType.startsWith('ore_')) {
        // Call mining module depletion function
        if (window.miningModule && window.miningModule.depleteOreConfirmed) {
          // Find the ore element
          const oreElement = document.querySelector(`.world-object[data-type="${resourceType}"][data-x="${x}"][data-y="${y}"]`);
          if (oreElement) {
            window.miningModule.depleteOreConfirmed(resourceType, x, y, oreElement);
            appliedCount++;
            console.log(`⛏️ Synced depleted ore ${resourceType} at (${x}, ${y}) - depleted by ${depletedBy}`);
          } else {
            console.warn(`⛏️ Could not find ore element for ${resourceType} at (${x}, ${y}) during world state sync`);
          }
        }
      } else if (resourceType.startsWith('tree_')) {
        // Call woodcutting module depletion function
        if (window.woodcuttingModule && window.woodcuttingModule.depleteTreeConfirmed) {
          // Find the tree element
          const treeElement = document.querySelector(`.world-object[data-type="${resourceType}"][data-x="${x}"][data-y="${y}"]`);
          if (treeElement) {
            window.woodcuttingModule.depleteTreeConfirmed(resourceType, x, y, treeElement);
            appliedCount++;
            console.log(`🪓 Synced depleted tree ${resourceType} at (${x}, ${y}) - depleted by ${depletedBy}`);
          } else {
            console.warn(`🪓 Could not find tree element for ${resourceType} at (${x}, ${y}) during world state sync`);
          }
        }
      }
    });
    
    console.log(`🌍 Successfully applied ${appliedCount} of ${depletedResources.length} depleted resource states`);
    return appliedCount;
  };
  
  // Try to apply immediately first
  const immediatelyApplied = applyDepletedStates();
  
  // If we didn't apply all resources, set up a retry system
  if (immediatelyApplied < depletedResources.length) {
    console.log(`🌍 Only applied ${immediatelyApplied}/${depletedResources.length} resources immediately, setting up retry system`);
    
    let attempts = 0;
    const maxAttempts = 50; // Wait up to 25 seconds (50 * 500ms)
    
    const retryApply = () => {
      attempts++;
      const applied = applyDepletedStates();
      
      if (applied >= depletedResources.length) {
        console.log(`🌍 ✅ Successfully applied all ${applied} depleted resource states after ${attempts} attempts`);
      } else if (attempts < maxAttempts) {
        // Continue retrying
        setTimeout(retryApply, 500); // Check every 500ms
      } else {
        console.warn(`🌍 ⚠️ Timeout after ${attempts} attempts - applied ${applied}/${depletedResources.length} depleted states`);
      }
    };
    
    // Start retrying after a short delay
    setTimeout(retryApply, 100);
  } else {
    console.log(`🌍 ✅ Successfully applied all ${immediatelyApplied} depleted resource states immediately`);
  }
}

/**
 * Send resource action request to server (validate before starting action)
 */
export function sendResourceActionRequest(resourceType, x, y, action) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      type: 'resource-action-request',
      resourceType: resourceType,
      x: x,
      y: y,
      action: action
    }));
    console.log(`Sent resource action request: ${action} ${resourceType} at (${x}, ${y})`);
  }
}

/**
 * Handle resource action approved
 */
function handleResourceActionApproved(data) {
  const { resourceType, x, y, action } = data;
  console.log(`✅ Server approved ${action} for ${resourceType} at (${x}, ${y})`);
  
  // Notify the appropriate skill module that the action was approved
  if (action === 'mining' && window.miningModule && window.miningModule.startMiningApproved) {
    window.miningModule.startMiningApproved(resourceType, x, y);
  } else if (action === 'woodcutting' && window.woodcuttingModule && window.woodcuttingModule.startWoodcuttingApproved) {
    window.woodcuttingModule.startWoodcuttingApproved(resourceType, x, y);
  }
}

/**
 * Handle resource action denied
 */
function handleResourceActionDenied(data) {
  const { resourceType, x, y, action, reason, depletedBy } = data;
  console.log(`❌ Server denied ${action} for ${resourceType} at (${x}, ${y}): ${reason}`);
  
  // Show appropriate message to the user
  let message = `Cannot ${action} this resource: ${reason}`;
  if (depletedBy) {
    message = `This resource was already depleted by ${depletedBy}!`;
  }
  
  // Show notification
  if (window.uiModule && window.uiModule.showNotification) {
    window.uiModule.showNotification(message, 'error');
  } else {
    console.log(`Error: ${message}`);
  }
  
  // Notify the appropriate skill module that the action was denied
  if (action === 'mining' && window.miningModule && window.miningModule.startMiningDenied) {
    window.miningModule.startMiningDenied(resourceType, x, y, reason, depletedBy);
  } else if (action === 'woodcutting' && window.woodcuttingModule && window.woodcuttingModule.startWoodcuttingDenied) {
    window.woodcuttingModule.startWoodcuttingDenied(resourceType, x, y, reason, depletedBy);
  }
}

/**
 * Handle resource action cancelled
 */
function handleResourceActionCancelled(data) {
  const { previousAction, reason } = data;
  
  if (!previousAction) {
    console.warn('❌ Invalid resource action cancelled data:', data);
    return;
  }
  
  const { action, resourceType, x, y } = previousAction;
  console.log(`🔄 Previous ${action} action cancelled for ${resourceType} at (${x}, ${y}): ${reason}`);
  
  // Notify the appropriate skill module that the action was cancelled
  if (action === 'mining' && window.miningModule && window.miningModule.cancelMining) {
    window.miningModule.cancelMining('player');
  } else if (action === 'woodcutting' && window.woodcuttingModule && window.woodcuttingModule.cancelWoodcutting) {
    window.woodcuttingModule.cancelWoodcutting('player');
  }
}

/**
 * Handle floor items sync
 */
function handleFloorItemsSync(data) {
  if (!window.inventoryModuleFunctions) {
    console.warn('Floor items sync: inventoryModuleFunctions not available');
    return;
  }
  
  console.log(`🎒 Syncing ${data.floorItems.length} floor items from server`);
  
  // Clear existing floor items and sync with server state
  if (window.inventoryModuleFunctions.syncFloorItemsFromServer) {
    window.inventoryModuleFunctions.syncFloorItemsFromServer(data.floorItems);
  }
}

/**
 * Handle floor item drop confirmed
 */
function handleFloorItemDropConfirmed(data) {
  if (!window.inventoryModuleFunctions) {
    console.warn('Floor item drop confirmed: inventoryModuleFunctions not available');
    return;
  }
  
  console.log(`✅ Drop confirmed - removing from inventory slot ${data.slotIndex}`);
  
  // Remove item from inventory since drop was successful
  if (window.inventoryModuleFunctions.removeItemFromInventorySlot) {
    window.inventoryModuleFunctions.removeItemFromInventorySlot(data.slotIndex);
  }
  
  if (window.inventoryModule && window.inventoryModule.showNotification) {
    window.inventoryModule.showNotification(`Item dropped successfully${data.stacked ? ' (stacked with existing item)' : ''}.`, 'success');
  }
}

/**
 * Handle floor item drop denied
 */
function handleFloorItemDropDenied(data) {
  console.log(`❌ Drop denied: ${data.reason}`);
  
  if (window.inventoryModule && window.inventoryModule.showNotification) {
    window.inventoryModule.showNotification(`Cannot drop item: ${data.reason}`, 'error');
  }
}

/**
 * Handle floor item pickup confirmed
 */
function handleFloorItemPickupConfirmed(data) {
  if (!window.inventoryModuleFunctions) {
    console.warn('Floor item pickup confirmed: inventoryModuleFunctions not available');
    return;
  }
  
  console.log(`✅ Pickup confirmed for floor item ${data.floorItemId}`);
  
  // Try to add item to inventory first
  let addResult = false;
  if (window.inventoryModuleFunctions.addItemToInventoryFromServer) {
    console.log('🔄 Using addItemToInventoryFromServer function');
    addResult = window.inventoryModuleFunctions.addItemToInventoryFromServer(data.item);
    console.log('📦 addItemToInventoryFromServer result:', addResult);
  } else if (window.inventoryModule && window.inventoryModule.addItemToInventory) {
    console.log('🔄 Using fallback addItemToInventory function');
    addResult = window.inventoryModule.addItemToInventory(data.item.id, data.item.quantity);
    console.log('📦 addItemToInventory result:', addResult);
  } else {
    console.warn('❌ No add inventory function available!');
  }
  
  console.log('🎯 Final addResult:', addResult, '(type:', typeof addResult, ')');
  
  // Only remove floor item if successfully added to inventory
  if (addResult === true) {
    console.log('✅ Successfully added to inventory, removing from floor');
    if (window.inventoryModuleFunctions.removeFloorItemFromDisplay) {
      window.inventoryModuleFunctions.removeFloorItemFromDisplay(data.floorItemId);
      console.log('🗑️ Called removeFloorItemFromDisplay for', data.floorItemId);
    } else {
      console.warn('❌ removeFloorItemFromDisplay function not available!');
    }
    
    const itemDef = window.inventoryModule && window.inventoryModule.getItemDefinition ? 
      window.inventoryModule.getItemDefinition(data.item.id) : null;
    const itemName = itemDef ? itemDef.name : data.item.id;
    const quantityText = data.item.quantity > 1 ? ` x${data.item.quantity}` : '';
    
    if (window.inventoryModule && window.inventoryModule.showNotification) {
      window.inventoryModule.showNotification(`Picked up ${itemName}${quantityText}.`, 'success');
    }
  } else {
    console.log('❌ Failed to add to inventory - item remains on floor');
    if (window.inventoryModule && window.inventoryModule.showNotification) {
      window.inventoryModule.showNotification('Your inventory is too full to pick that up!', 'error');
    }
  }
}

/**
 * Handle floor item pickup denied
 */
function handleFloorItemPickupDenied(data) {
  console.log(`❌ Pickup denied: ${data.reason}`);
  
  if (window.inventoryModule && window.inventoryModule.showNotification) {
    window.inventoryModule.showNotification(`Cannot pick up item: ${data.reason}`, 'error');
  }
}

/**
 * Handle floor item created
 */
function handleFloorItemCreated(data) {
  if (!window.inventoryModuleFunctions) {
    console.warn('Floor item created: inventoryModuleFunctions not available');
    return;
  }
  
  console.log(`🎒 Player ${data.droppedBy} dropped item at (${data.floorItem.x}, ${data.floorItem.y})`);
  
  // Add floor item to client display
  if (window.inventoryModuleFunctions.addFloorItemToDisplay) {
    window.inventoryModuleFunctions.addFloorItemToDisplay(data.floorItem);
  }
}

/**
 * Handle floor item updated
 */
function handleFloorItemUpdated(data) {
  if (!window.inventoryModuleFunctions) {
    console.warn('Floor item updated: inventoryModuleFunctions not available');
    return;
  }
  
  console.log(`📦 Player ${data.updatedBy} stacked item at (${data.floorItem.x}, ${data.floorItem.y})`);
  
  // Update floor item in client display
  if (window.inventoryModuleFunctions.updateFloorItemInDisplay) {
    window.inventoryModuleFunctions.updateFloorItemInDisplay(data.floorItem);
  }
}

/**
 * Handle floor item picked up by another player
 */
function handleFloorItemPickedUp(data) {
  console.log(`🗑️ Player ${data.pickedUpBy} picked up floor item ${data.floorItemId}`);
  
  if (window.inventoryModuleFunctions && window.inventoryModuleFunctions.removeFloorItemFromDisplay) {
    window.inventoryModuleFunctions.removeFloorItemFromDisplay(data.floorItemId);
  }
}

/**
 * Handle shop synchronization from server
 */
function handleShopSync(data) {
  console.log('🏪 Syncing shop data from server:', Object.keys(data.shops).length, 'shops');
  
  if (window.inventoryModule && window.inventoryModule.syncShopsFromServer) {
    window.inventoryModule.syncShopsFromServer(data.shops);
    
    // If a shop is currently open, update the display immediately
    if (window.inventoryModule.shopInterface && window.inventoryModule.shopInterface.open) {
      console.log('🏪 Shop is open - updating display immediately');
      setTimeout(() => {
        if (window.inventoryModule.updateShopDisplay) {
          window.inventoryModule.updateShopDisplay();
        }
        if (window.inventoryModule.refreshShopInterface) {
          window.inventoryModule.refreshShopInterface();
        }
      }, 100); // Small delay to ensure data is fully synced
    }
  } else {
    console.warn('🏪 Shop sync: inventoryModule.syncShopsFromServer not available');
  }
}

/**
 * Handle shop buy confirmation
 */
function handleShopBuyConfirmed(data) {
  console.log(`🏪 ✅ Buy confirmed: ${data.quantity} ${data.itemId} for ${data.totalCost} coins`);
  
  // Don't update displays immediately - wait for inventory-sync message to ensure proper data synchronization
  // The server sends inventory-sync automatically after shop transactions
  
  // Get item definition for user-friendly name
  const itemDef = window.inventoryModule && window.inventoryModule.getItemDefinition ? 
    window.inventoryModule.getItemDefinition(data.itemId) : null;
  const itemName = itemDef ? itemDef.name : data.itemId;
  
  if (window.showNotification) {
    window.showNotification(`Bought ${data.quantity} ${itemName} for ${data.totalCost} coins`, 'success');
  }
  
  // Request updated shop data from server to keep all players in sync
  requestShopSync();
}

/**
 * Handle shop buy denial
 */
function handleShopBuyDenied(data) {
  console.log(`🏪 ❌ Buy denied: ${data.reason}`);
  
  if (window.showNotification) {
    window.showNotification(`Purchase failed: ${data.reason}`, 'error');
  }
}

/**
 * Handle shop sell confirmation
 */
function handleShopSellConfirmed(data) {
  console.log(`🏪 ✅ Sell confirmed: ${data.quantity} ${data.itemId} for ${data.totalValue} coins`);
  
  // Don't update displays immediately - wait for inventory-sync message to ensure proper data synchronization
  // The server sends inventory-sync automatically after shop transactions
  
  // Get item definition for user-friendly name
  const itemDef = window.inventoryModule && window.inventoryModule.getItemDefinition ? 
    window.inventoryModule.getItemDefinition(data.itemId) : null;
  const itemName = itemDef ? itemDef.name : data.itemId;
  
  if (window.showNotification) {
    window.showNotification(`Sold ${data.quantity} ${itemName} for ${data.totalValue} coins`, 'success');
  }
  
  // Request updated shop data from server to keep all players in sync
  requestShopSync();
}

/**
 * Handle shop sell denial
 */
function handleShopSellDenied(data) {
  console.log(`🏪 ❌ Sell denied: ${data.reason}`);
  
  if (window.showNotification) {
    window.showNotification(`Sale failed: ${data.reason}`, 'error');
  }
}

/**
 * Handle shop update from another player's transaction
 */
function handleShopUpdated(data) {
  console.log(`🏪 📡 Shop updated by ${data.username}: ${data.action} in ${data.shopId}`);
  
  // Sync the updated shop data
  if (window.inventoryModule && window.inventoryModule.syncShopsFromServer && data.updatedShops) {
    window.inventoryModule.syncShopsFromServer(data.updatedShops);
    
    // If the affected shop is currently open, update the display immediately
    if (window.inventoryModule.shopInterface && 
        window.inventoryModule.shopInterface.open && 
        window.inventoryModule.shopInterface.currentShop === data.shopId) {
      
      console.log(`🏪 Currently viewing ${data.shopId} - updating display due to ${data.username}'s ${data.action}`);
      
      setTimeout(() => {
        if (window.inventoryModule.updateShopDisplay) {
          window.inventoryModule.updateShopDisplay();
        }
        if (window.inventoryModule.refreshShopInterface) {
          window.inventoryModule.refreshShopInterface();
        }
      }, 100);
      
      // Show notification about the other player's action
      if (window.showNotification && data.username !== getCurrentUser()?.username) {
        const itemDef = window.inventoryModule.getItemDefinition ? 
          window.inventoryModule.getItemDefinition(data.itemId) : null;
        const itemName = itemDef ? itemDef.name : data.itemId;
        
        if (data.action === 'buy') {
          window.showNotification(`${data.username} bought ${data.quantity} ${itemName}`, 'info');
        } else if (data.action === 'sell') {
          window.showNotification(`${data.username} sold ${data.quantity} ${itemName}`, 'info');
        }
      }
    }
  }
}

/**
 * Request shop sync from server
 */
function requestShopSync() {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      type: 'request-shop-sync'
    }));
    console.log('🏪 📤 Requested shop sync from server');
  }
}

/**
 * Request shop sync when opening a shop
 */
export function requestShopSyncOnOpen(shopId) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      type: 'request-shop-sync',
      shopId: shopId
    }));
    console.log(`🏪 📤 Requested shop sync for ${shopId} on open`);
  }
}

/**
 * Start periodic shop sync for active shops
 */
export function startShopSyncUpdates() {
  // Clear any existing interval
  if (window.shopSyncInterval) {
    clearInterval(window.shopSyncInterval);
  }
  
  // Set up periodic sync every 10 seconds for shops that are open
  window.shopSyncInterval = setInterval(() => {
    if (isOnline && window.inventoryModule && window.inventoryModule.shopInterface && window.inventoryModule.shopInterface.open) {
      console.log('🏪 ⏰ Periodic shop sync for open shop');
      requestShopSync();
    }
  }, 10000); // Sync every 10 seconds
  
  console.log('✅ Started periodic shop sync updates');
}

/**
 * Stop periodic shop sync
 */
export function stopShopSyncUpdates() {
  if (window.shopSyncInterval) {
    clearInterval(window.shopSyncInterval);
    window.shopSyncInterval = null;
    console.log('🛑 Stopped periodic shop sync updates');
  }
}

/**
 * Send shop buy request to server
 */
export function sendShopBuyRequest(shopId, itemId, quantity) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      type: 'shop-buy-request',
      shopId: shopId,
      itemId: itemId,
      quantity: quantity
    }));
    console.log(`🏪 📤 Sent buy request: ${quantity} ${itemId} from ${shopId}`);
  } else {
    console.warn('🏪 Cannot send buy request - WebSocket not connected');
  }
}

/**
 * Send shop sell request to server
 */
export function sendShopSellRequest(shopId, slotIndex, quantity) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      type: 'shop-sell-request',
      shopId: shopId,
      slotIndex: slotIndex,
      quantity: quantity
    }));
    console.log(`🏪 📤 Sent sell request: slot ${slotIndex}, quantity ${quantity} to ${shopId}`);
  } else {
    console.warn('🏪 Cannot send sell request - WebSocket not connected');
  }
}

/**
 * Handle digging hole created message from other players
 */
function handleDiggingHoleCreated(data) {
  console.log('🕳️ Processing digging hole created:', data);
  
  // Forward to digging module if available
  if (window.diggingModule && window.diggingModule.handleDiggingHoleMessage) {
    window.diggingModule.handleDiggingHoleMessage({
      type: 'digging-hole-created',
      x: data.x,
      y: data.y,
      duration: data.duration,
      timestamp: data.timestamp
    });
  } else {
    console.warn('🕳️ Digging module not available for hole created message');
  }
}

/**
 * Handle digging hole removed message from other players
 */
function handleDiggingHoleRemoved(data) {
  console.log('🕳️ Processing digging hole removed:', data);
  
  // Forward to digging module if available
  if (window.diggingModule && window.diggingModule.handleDiggingHoleMessage) {
    window.diggingModule.handleDiggingHoleMessage({
      type: 'digging-hole-removed',
      x: data.x,
      y: data.y,
      timestamp: data.timestamp
    });
  } else {
    console.warn('🕳️ Digging module not available for hole removed message');
  }
}

/**
 * Handle digging holes sync from server (on login)
 */
function handleDiggingHolesSync(data) {
  if (!window.diggingModule) {
    console.warn('🕳️ Digging holes sync: diggingModule not available');
    return;
  }
  
  console.log(`🕳️ Syncing ${data.diggingHoles.length} digging holes from server`);
  
  // Sync with digging module
  if (window.diggingModule.syncDiggingHolesFromServer) {
    window.diggingModule.syncDiggingHolesFromServer(data.diggingHoles);
  } else {
    console.warn('🕳️ syncDiggingHolesFromServer function not available');
  }
}

/**
 * Request digging holes sync from server
 */
function requestDiggingHolesSync() {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      type: 'request-digging-holes-sync'
    }));
    console.log('🕳️ 📤 Requested digging holes sync from server');
  }
}

/**
 * Get the current WebSocket connection
 */
export function getWebSocket() {
  return socket;
} 