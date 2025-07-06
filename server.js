/**
 * WebscapeRPG Server with HTTP and WebSocket support
 */

const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const crypto = require('crypto');
// Import shared item definitions
const { itemDefinitions } = require('./shared/itemDefinitions.js');

// NPC System
const npcs = new Map(); // npcId -> npc data
const npcMovementTimers = new Map(); // npcId -> timer reference
const npcStopTimers = new Map(); // npcId -> stop timer reference
const npcRespawnTimers = new Map(); // npcId -> timeout
const NPC_RESPAWN_TIME_MS = 30000; // 30-second respawn

// Import NPC definitions from external file
const { NPC_DEFINITIONS, getNPCDefinition, calculateDrops } = require('./js/data/NPCDefinitions.js');

// Convert new NPC definitions to server format
const npcDefinitions = {};
for (const [npcId, npcDef] of Object.entries(NPC_DEFINITIONS)) {
  npcDefinitions[npcId] = {
    name: `${npcDef.emoji} ${npcDef.name}`,
    emoji: npcDef.emoji,
    health: npcDef.health,
    maxHealth: npcDef.maxHealth,
    combatLevel: npcDef.combatLevel,
    examine: npcDef.examine,
    attackSpeed: npcDef.attackSpeed,
    maxHit: npcDef.maxHit,
    wanderRadius: npcDef.wanderRadius,
    moveInterval: { min: npcDef.moveIntervalMin, max: npcDef.moveIntervalMax },
    stopInterval: { min: 1000, max: 3000 }, // Default stop interval
    stopChance: npcDef.stopChance,
    dropTable: npcDef.dropTable,
    experienceRewards: npcDef.experienceRewards
  };
}

// World collision data - load from world.json
let worldCollisionData = null;

// Load world collision data
function loadWorldCollisionData() {
  try {
    const worldData = JSON.parse(fs.readFileSync('world.json', 'utf8'));
    if (worldData.layers) {
      worldCollisionData = worldData.layers;
      console.log('🗺️ Loaded world layers data for NPC pathfinding');
    }
  } catch (error) {
    console.error('❌ Error loading world collision data:', error);
  }
}

// Check if a position is walkable for NPCs (matches client-side logic)
function isPositionWalkableForNPC(x, y) {
  // Basic bounds check
  if (x < 0 || y < 0 || x >= 100 || y >= 100) {
    return false;
  }
  
  // If we have collision data, use the layers system like the client
  if (worldCollisionData && worldCollisionData.length >= 3) {
    // Check terrain layer (layer 0) for obstacles
    const terrainLayer = worldCollisionData[0];
    if (terrainLayer && terrainLayer[y] && terrainLayer[y][x] !== undefined) {
      const tileValue = terrainLayer[y][x];
      // Non-walkable terrains (matching client-side logic)
      const nonWalkableTerrains = [1, 3, 5, 9, 10, 11, 12, 13, 14, 15, 16, 20, 25, 26, 27, 28, 29, 30, 31, 32];
      if (nonWalkableTerrains.includes(tileValue)) {
        return false; // Terrain itself is not walkable
      }
    }
    
    // Check interactive objects layer (layer 2) for obstacles
    const interactiveLayer = worldCollisionData[2];
    if (interactiveLayer && interactiveLayer[y] && interactiveLayer[y][x] !== undefined && interactiveLayer[y][x] !== null) {
      const objectValue = interactiveLayer[y][x];
      // Item spawns are walkable (invisible in game world)
      if (objectValue === 'item_spawn') {
        return true; // Allow walking through item spawns
      }
      // All other interactive objects (banks, trees, ores) are impassable obstacles
      return false;
    }
    
    // Check ground objects layer (layer 1) for obstacles
    const groundLayer = worldCollisionData[1];
    if (groundLayer && groundLayer[y] && groundLayer[y][x] !== undefined && groundLayer[y][x] !== null) {
      // Ground objects are obstacles too
      return false;
    }
  }
  
  // Default to walkable if no collision data or position is clear
  return true;
}

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Cookie parser - simple implementation since we don't need full cookie-parser
app.use((req, res, next) => {
  req.cookies = {};
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    cookieHeader.split(';').forEach(cookie => {
      const [name, value] = cookie.trim().split('=');
      if (name && value) {
        req.cookies[name] = decodeURIComponent(value);
      }
    });
  }
  next();
});

const PORT = process.env.PORT || 8081;

// Persistent storage paths
const USERS_DIR = path.join(__dirname, 'data', 'users'); // one file per player
const SESSIONS_FILE = path.join(__dirname, 'data', 'sessions.json');

// Ensure data directories exist
if (!fs.existsSync(USERS_DIR)) {
  fs.mkdirSync(USERS_DIR, { recursive: true });
}

// (sessions.json still lives in /data; make sure that folder exists too)
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// ----------  Per-player file persistence ----------

/**
 * Load all users from the users directory at startup.
 * Scans data/users/*.json and builds the in-memory Map.
 */
function loadUsers() {
  const map = new Map();
  try {
    const files = fs.readdirSync(USERS_DIR).filter(f => f.endsWith('.json'));
    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(USERS_DIR, file), 'utf8');
        const data = JSON.parse(raw);
        const username = path.basename(file, '.json');
        // Ensure role exists
        if (!data.profile) data.profile = { username };
        if (!data.profile.role) {
          data.profile.role = username.toLowerCase() === 'sky' ? 'mod' : 'player';
        }
        map.set(username, data);
      } catch (innerErr) {
        console.error(`⚠️  Failed to load user file ${file}:`, innerErr);
      }
    }
    console.log(`📂 Loaded ${map.size} player profiles from disk`);
  } catch (error) {
    console.error('Error scanning user directory:', error);
  }
  return map;
}

/**
 * Persist a single user to its individual JSON file.
 */
function saveUser(username, userData) {
  try {
    const filePath = path.join(USERS_DIR, `${username}.json`);
    fs.writeFileSync(filePath, JSON.stringify(userData, null, 2));
  } catch (error) {
    console.error(`Error saving user ${username}:`, error);
  }
}

/**
 * Persist **all** users. Existing calls to saveUsers() now delegate here so
 * we keep compatibility while switching storage model.
 */
function saveUsers() {
  for (const [username, data] of users.entries()) {
    saveUser(username, data);
  }
}

// Load sessions from file
function loadSessions() {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      const data = fs.readFileSync(SESSIONS_FILE, 'utf8');
      const sessionsObj = JSON.parse(data);
      const sessions = new Map(Object.entries(sessionsObj));
      
      // Clean up expired sessions
      const now = Date.now();
      for (const [sessionId, session] of sessions) {
        if (now > session.expiresAt) {
          sessions.delete(sessionId);
        }
      }
      
      return sessions;
    }
  } catch (error) {
    console.error('Error loading sessions:', error);
  }
  return new Map();
}

// Save sessions to file
function saveSessions() {
  try {
    const sessionsObj = Object.fromEntries(sessions);
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessionsObj, null, 2));
  } catch (error) {
    console.error('Error saving sessions:', error);
  }
}

// In-memory storage (now backed by persistent files)
const users = loadUsers(); // username -> { password, profile, createdAt }
const sessions = loadSessions(); // sessionId -> { username, expiresAt }
const connectedPlayers = new Map(); // username -> { ws, position, profile }

// Global state tracking (server-authoritative)
const worldResources = new Map(); // Track all world resources by position key
const resourceRespawnTimers = new Map(); // Track active respawn timers
const activePlayerActions = new Map(); // Track active actions per player (username -> action info)
const worldFloorItems = new Map(); // Track all floor items by ID (server-authoritative)
const floorItemsByPosition = new Map(); // Track floor items by position key for quick lookup
const worldDiggingHoles = new Map(); // Track all digging holes by position key
const diggingHoleTimers = new Map(); // Track digging hole expiration timers

// Floor item management
const FLOOR_ITEM_DESPAWN_TIME = 300000; // 5 minutes in milliseconds
const MAX_PICKUP_DISTANCE = 2; // Maximum distance in tiles for pickup

// Item spawn management for server
let serverItemSpawns = {}; // Configuration for each spawn point
let activeServerSpawnedItems = {}; // Track which items are currently spawned

// Load item spawns from world.json when server starts
function loadServerItemSpawns() {
  try {
    const fs = require('fs');
    const worldData = JSON.parse(fs.readFileSync('world.json', 'utf8'));
    
    if (worldData.itemSpawnConfigs) {
      serverItemSpawns = JSON.parse(JSON.stringify(worldData.itemSpawnConfigs));
      activeServerSpawnedItems = {};
      
      console.log(`🌍 Loaded ${Object.keys(serverItemSpawns).length} item spawn points from world.json`);
      
      // Initialize spawned items for all spawn points
      Object.keys(serverItemSpawns).forEach(spawnKey => {
        const [x, y] = spawnKey.split(',').map(Number);
        console.log(`🌱 Processing server spawn at (${x}, ${y})`, serverItemSpawns[spawnKey]);
        spawnServerItemAtLocation(x, y, spawnKey);
      });
      
      console.log(`✅ Initialized ${Object.keys(serverItemSpawns).length} server item spawns`);
      
      // Start checking item spawns every 5 seconds
      setInterval(checkServerItemSpawns, 5000);
      console.log('🔄 Started server item spawn checker');
    } else {
      console.log('📦 No item spawns found in world.json');
    }
  } catch (error) {
    console.error('❌ Error loading item spawns from world.json:', error);
  }
}

function spawnServerItemAtLocation(x, y, spawnKey) {
  console.log(`🌱 spawnServerItemAtLocation: Called for (${x}, ${y}), key: ${spawnKey}`);
  
  if (!serverItemSpawns[spawnKey]) {
    console.log(`⚠️ spawnServerItemAtLocation: No spawn config found for key ${spawnKey}`);
    return;
  }
  
  const spawnConfig = serverItemSpawns[spawnKey];
  console.log(`🔧 spawnServerItemAtLocation: Spawn config:`, spawnConfig);
  
  // Don't spawn if item already exists at this location
  if (activeServerSpawnedItems[spawnKey]) {
    console.log(`✋ spawnServerItemAtLocation: Item already exists at ${spawnKey}:`, activeServerSpawnedItems[spawnKey]);
    return;
  }
  
  // Check if enough time has passed since last pickup
  if (spawnConfig.lastPickupTime && Date.now() - spawnConfig.lastPickupTime < spawnConfig.respawnTime) {
    const timeLeft = spawnConfig.respawnTime - (Date.now() - spawnConfig.lastPickupTime);
    console.log(`⏰ spawnServerItemAtLocation: Respawn cooldown active for ${spawnKey}, ${Math.ceil(timeLeft/1000)}s remaining`);
    return;
  }
  
  // Create server floor item
  const item = {
    id: spawnConfig.itemId,
    quantity: spawnConfig.quantity
  };
  
  console.log(`🎯 spawnServerItemAtLocation: Creating server floor item:`, item, `at (${x}, ${y})`);
  const floorItem = createServerFloorItem(item, x, y, 'SYSTEM_SPAWN');
  
  if (floorItem) {
    activeServerSpawnedItems[spawnKey] = {
      floorItemId: floorItem.id,
      spawnTime: Date.now()
    };
    
    console.log(`✅ Spawned ${spawnConfig.itemId} x${spawnConfig.quantity} at (${x}, ${y}) with server ID: ${floorItem.id}`);
    
    // Broadcast new floor item to all players
    broadcastToAll({
      type: 'floor-item-created',
      floorItem: {
        id: floorItem.id,
        item: floorItem.item,
        x: floorItem.x,
        y: floorItem.y,
        spawnTime: floorItem.spawnTime,
        droppedBy: floorItem.droppedBy
      },
      droppedBy: 'SYSTEM_SPAWN',
      timestamp: Date.now()
    });
  } else {
    console.error(`❌ spawnServerItemAtLocation: Failed to create server floor item at (${x}, ${y})`);
  }
}

function checkServerItemSpawns() {
  const spawnKeys = Object.keys(serverItemSpawns);
  if (spawnKeys.length === 0) {
    return;
  }
  
  console.log(`🔍 checkServerItemSpawns: Processing ${spawnKeys.length} spawn points`);
  
  spawnKeys.forEach(spawnKey => {
    const [x, y] = spawnKey.split(',').map(Number);
    const spawnConfig = serverItemSpawns[spawnKey];
    
    // Check if item needs to be spawned
    if (!activeServerSpawnedItems[spawnKey]) {
      // No item currently at this spawn point
      if (!spawnConfig.lastPickupTime || Date.now() - spawnConfig.lastPickupTime >= spawnConfig.respawnTime) {
        console.log(`🌱 checkServerItemSpawns: Spawn ${spawnKey} ready to spawn`);
        spawnServerItemAtLocation(x, y, spawnKey);
      } else {
        const timeLeft = spawnConfig.respawnTime - (Date.now() - spawnConfig.lastPickupTime);
        console.log(`⏰ checkServerItemSpawns: Spawn ${spawnKey} on cooldown, ${Math.ceil(timeLeft/1000)}s remaining`);
      }
    } else {
      // Check if spawned item still exists
      const activeItem = activeServerSpawnedItems[spawnKey];
      const itemExists = worldFloorItems.has(activeItem.floorItemId);
      
      if (!itemExists) {
        // Item was picked up or removed
        console.log(`📦 Item at spawn ${spawnKey} was picked up`);
        serverItemSpawns[spawnKey].lastPickupTime = Date.now();
        delete activeServerSpawnedItems[spawnKey];
      }
    }
  });
}

// NPC Management Functions
function generateNPCId() {
  return 'npc_' + crypto.randomBytes(8).toString('hex');
}

function createNPC(npcType, spawnX, spawnY) {
  const definition = npcDefinitions[npcType];
  if (!definition) {
    console.error(`❌ Unknown NPC type: ${npcType}`);
    return null;
  }

  const npcId = generateNPCId();
  const npc = {
    id: npcId,
    type: npcType,
    name: definition.name,
    emoji: definition.emoji,
    health: definition.health,
    maxHealth: definition.maxHealth,
    combatLevel: definition.combatLevel,
    examine: definition.examine,
    attackSpeed: definition.attackSpeed,
    maxHit: definition.maxHit,
    spawnX: spawnX,
    spawnY: spawnY,
    x: spawnX,
    y: spawnY,
    wanderRadius: definition.wanderRadius,
    moveInterval: definition.moveInterval,
    stopInterval: definition.stopInterval,
    stopChance: definition.stopChance,
    lastMoveTime: Date.now(),
    isStopped: false,
    movementDirection: null
  };

  npcs.set(npcId, npc);
  console.log(`✅ Created ${definition.name} at (${spawnX}, ${spawnY}) with ID: ${npcId}`);
  
  // Notify all connected clients of the spawn (used for respawns)
  console.log('📢 Broadcasting npc-create for', npcId);
  broadcastToAll({
    type: 'npc-create',
    npc: {
      id: npc.id,
      type: npc.type,
      name: npc.name,
      emoji: npc.emoji,
      health: npc.health,
      maxHealth: npc.maxHealth,
      combatLevel: npc.combatLevel,
      examine: npc.examine,
      position: { x: npc.x, y: npc.y },
      isStopped: npc.isStopped
    },
    timestamp: Date.now()
  });
  
  // Start AI movement
  startNPCMovement(npcId);
  
  return npc;
}

function startNPCMovement(npcId) {
  const npc = npcs.get(npcId);
  if (!npc) return;
  if (npc.isAggressive) return; // Do not start wander for combat NPCs

  const moveNextTick = () => {
    if (!npcs.has(npcId)) return; // NPC was removed
    
    const currentNpc = npcs.get(npcId);
    if (currentNpc.isStopped) return; // NPC is currently stopped
    
    // Attempt to move NPC
    moveNPCRandomly(npcId);
    
    // Schedule next movement
    const delay = getRandomInterval(currentNpc.moveInterval);
    npcMovementTimers.set(npcId, setTimeout(moveNextTick, delay));
  };

  // Initial movement
  const initialDelay = getRandomInterval(npc.moveInterval);
  npcMovementTimers.set(npcId, setTimeout(moveNextTick, initialDelay));
}

function moveNPCRandomly(npcId) {
  const npc = npcs.get(npcId);
  if (!npc) return;
  if (npc.isAggressive) return; // Skip random movement for combat NPCs

  // First – if the NPC has wandered outside its radius, always step back toward spawn.
  const distFromSpawn = Math.abs(npc.x - npc.spawnX) + Math.abs(npc.y - npc.spawnY);
  if (distFromSpawn > npc.wanderRadius) {
    const stepX = npc.spawnX > npc.x ? 1 : (npc.spawnX < npc.x ? -1 : 0);
    const stepY = npc.spawnY > npc.y ? 1 : (npc.spawnY < npc.y ? -1 : 0);

    const targetX = npc.x + stepX;
    const targetY = npc.y + stepY;

    // Prevent diagonal wall clipping just like OSRS
    let pathClear = true;
    if (stepX !== 0 && stepY !== 0) {
      const horizontalClear = isPositionWalkableForNPC(npc.x + stepX, npc.y);
      const verticalClear   = isPositionWalkableForNPC(npc.x, npc.y + stepY);
      if (!horizontalClear || !verticalClear) pathClear = false;
    }

    if (pathClear && isPositionWalkableForNPC(targetX, targetY)) {
      npc.x = targetX;
      npc.y = targetY;
      npc.movementDirection = stepX === 0 ? (stepY > 0 ? 'down' : 'up') : (stepX > 0 ? (stepY > 0 ? 'down-right' : (stepY < 0 ? 'up-right' : 'right')) : (stepY > 0 ? 'down-left' : (stepY < 0 ? 'up-left' : 'left')));

      broadcastToAll({
        type: 'npc-move',
        npcId,
        position: { x: npc.x, y: npc.y },
        direction: npc.movementDirection,
        timestamp: Date.now()
      });
    }

    // While returning to spawn, do NOT stop randomly – we want continuous movement.
    return;
  }

  // Normal wandering behaviour inside radius
  const possibleMoves = getPossibleNPCMoves(npc);

  if (possibleMoves.length === 0) {
    // No valid moves, will retry later
    return;
  }

  // Choose random direction among valid moves
  const move = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
  const newX = npc.x + move.dx;
  const newY = npc.y + move.dy;

  // Update NPC position
  npc.x = newX;
  npc.y = newY;
  npc.lastMoveTime = Date.now();
  npc.movementDirection = move.direction;

  //console.log(`🎭 NPC ${npc.name} moved to (${newX}, ${newY})`);

  // Broadcast NPC movement to all players
  broadcastToAll({
    type: 'npc-move',
    npcId: npcId,
    position: { x: newX, y: newY },
    direction: move.direction,
    timestamp: Date.now()
  });

  // Check if NPC should stop
  if (Math.random() < npc.stopChance) {
    stopNPC(npcId);
  }
}

function getPossibleNPCMoves(npc) {
  const moves = [];

  // Directions an NPC can attempt to walk (8-way)
  const directions = [
    // Cardinal
    { dx: 0, dy: -1, direction: 'up' },
    { dx: 0, dy: 1, direction: 'down' },
    { dx: -1, dy: 0, direction: 'left' },
    { dx: 1, dy: 0, direction: 'right' },
    // Diagonals
    { dx: -1, dy: -1, direction: 'up-left' },
    { dx: 1, dy: -1, direction: 'up-right' },
    { dx: -1, dy: 1, direction: 'down-left' },
    { dx: 1, dy: 1, direction: 'down-right' }
  ];

  // Current distance from spawn – Manhattan metric (same as OSRS pathing radius checks)
  const currentDistance = Math.abs(npc.x - npc.spawnX) + Math.abs(npc.y - npc.spawnY);
  const outsideWanderRadius = currentDistance > npc.wanderRadius;

  for (const dir of directions) {
    const newX = npc.x + dir.dx;
    const newY = npc.y + dir.dy;

    const newDistance = Math.abs(newX - npc.spawnX) + Math.abs(newY - npc.spawnY);

    // Enforce wander radius differently depending on whether NPC is already outside it.
    if (!outsideWanderRadius) {
      // Normal case: stay within radius
      if (newDistance > npc.wanderRadius) continue;
    } else {
      // NPC is lured outside – only allow moves that move it CLOSER to spawn
      if (newDistance >= currentDistance) continue;
    }

    // Check if position is walkable using collision detection
    const isWalkable = isPositionWalkableForNPC(newX, newY);
    if (isWalkable) {
      // For diagonal movement, check that the path is clear (no wall clipping)
      let pathClear = true;
      if (dir.dx !== 0 && dir.dy !== 0) {
        // Diagonal movement - check both adjacent tiles are walkable
        const horizontalTile = isPositionWalkableForNPC(npc.x + dir.dx, npc.y);
        const verticalTile = isPositionWalkableForNPC(npc.x, npc.y + dir.dy);
        
        // Both adjacent tiles must be walkable to prevent wall clipping
        if (!horizontalTile || !verticalTile) {
          pathClear = false;
          // Debug: Log blocked diagonal movements occasionally
          if (Math.random() < 0.01) { // 1% chance to log
            //console.log(`🚫 NPC ${npc.name} blocked diagonal movement to (${newX}, ${newY}) - wall clipping prevented`);
          }
        }
      }
      
      if (pathClear) {
        // Check if another NPC is already at this position
        let positionOccupied = false;
        for (const [otherId, otherNpc] of npcs) {
          if (otherId !== npc.id && otherNpc.x === newX && otherNpc.y === newY) {
            positionOccupied = true;
            break;
          }
        }
        
        if (!positionOccupied) {
          moves.push(dir);
        }
      }
    } else {
      // Debug: Log blocked positions occasionally
      if (Math.random() < 0.01) { // 1% chance to log
        //console.log(`🚫 NPC ${npc.name} blocked from moving to (${newX}, ${newY}) - collision detected`);
      }
    }
  }

  return moves;
}

function stopNPC(npcId) {
  const npc = npcs.get(npcId);
  if (!npc) return;
  if (npc.isAggressive) return; // Don't auto-stop aggressive combat NPCs

  npc.isStopped = true;
  
  // Clear movement timer
  if (npcMovementTimers.has(npcId)) {
    clearTimeout(npcMovementTimers.get(npcId));
    npcMovementTimers.delete(npcId);
  }

  console.log(`⏸️ NPC ${npc.name} stopped at (${npc.x}, ${npc.y})`);

  // Broadcast stop to all players
  broadcastToAll({
    type: 'npc-stop',
    npcId: npcId,
    timestamp: Date.now()
  });

  // Schedule resume
  const stopDuration = getRandomInterval(npc.stopInterval);
  npcStopTimers.set(npcId, setTimeout(() => {
    resumeNPC(npcId);
  }, stopDuration));
}

function resumeNPC(npcId) {
  const npc = npcs.get(npcId);
  if (!npc) return;
  if (npc.isAggressive) return; // Stay stopped while in combat

  npc.isStopped = false;
  
  // Clear stop timer
  if (npcStopTimers.has(npcId)) {
    clearTimeout(npcStopTimers.get(npcId));
    npcStopTimers.delete(npcId);
  }

  console.log(`▶️ NPC ${npc.name} resumed movement`);

  // Broadcast resume to all players
  broadcastToAll({
    type: 'npc-resume',
    npcId: npcId,
    timestamp: Date.now()
  });

  // Restart movement
  startNPCMovement(npcId);
}

function getRandomInterval(interval) {
  return Math.floor(Math.random() * (interval.max - interval.min + 1)) + interval.min;
}

function removeNPC(npcId) {
  const npc = npcs.get(npcId);
  if (!npc) return;

  // Clear timers
  if (npcMovementTimers.has(npcId)) {
    clearTimeout(npcMovementTimers.get(npcId));
    npcMovementTimers.delete(npcId);
  }
  if (npcStopTimers.has(npcId)) {
    clearTimeout(npcStopTimers.get(npcId));
    npcStopTimers.delete(npcId);
  }

  npcs.delete(npcId);
  console.log(`🗑️ Removed NPC ${npc.name} (${npcId})`);

  // Broadcast removal to all players
  broadcastToAll({
    type: 'npc-remove',
    npcId: npcId,
    timestamp: Date.now()
  });

  // Default respawn time in ms (e.g., 30 seconds)
  const NPC_RESPAWN_TIME_MS = 30000;

  // ... later in removeNPC (function starting line 561 maybe) after deleting npc, schedule respawn
}

function sendNPCDataToPlayer(ws) {
  const npcData = Array.from(npcs.values()).map(npc => ({
    id: npc.id,
    type: npc.type,
    name: npc.name,
    emoji: npc.emoji,
    health: npc.health,
    maxHealth: npc.maxHealth,
    combatLevel: npc.combatLevel,
    examine: npc.examine,
    position: { x: npc.x, y: npc.y },
    spawnPosition: { x: npc.spawnX, y: npc.spawnY },
    isStopped: npc.isStopped
  }));

  ws.send(JSON.stringify({
    type: 'npc-data',
    npcs: npcData,
    timestamp: Date.now()
  }));
}

// Clear all existing NPCs
function clearAllNPCs() {
  console.log(`🧹 Clearing ${npcs.size} existing NPCs...`);
  
  // Clear movement timers for all NPCs
  for (const [npcId, npc] of npcs) {
    if (npcMovementTimers.has(npcId)) {
      clearTimeout(npcMovementTimers.get(npcId));
      npcMovementTimers.delete(npcId);
    }
    if (npcStopTimers.has(npcId)) {
      clearTimeout(npcStopTimers.get(npcId));
      npcStopTimers.delete(npcId);
    }
  }
  
  // Clear the NPCs map
  npcs.clear();
  
  console.log('✅ All NPCs cleared');
}

// Reload NPCs from world data (useful when world data changes)
function reloadNPCs() {
  console.log('🔄 Reloading NPCs...');
  clearAllNPCs();
  loadNPCSpawns();
  
  // Send updated NPC data to all connected players
  for (const [username, playerData] of connectedPlayers) {
    sendNPCDataToPlayer(playerData.ws);
  }
  console.log('✅ NPCs reloaded and sent to all players');
}

// Load NPC spawns from world.json and custom maps
function loadNPCSpawns() {
  try {
    const worldPath = path.join(__dirname, 'world.json');
    const worldData = JSON.parse(fs.readFileSync(worldPath, 'utf8'));
    
    // Check if there's NPC spawn data
    if (worldData.npcSpawnConfigs && Object.keys(worldData.npcSpawnConfigs).length > 0) {
      console.log(`🎭 Loading ${Object.keys(worldData.npcSpawnConfigs).length} NPC spawns from world.json`);
      
      Object.entries(worldData.npcSpawnConfigs).forEach(([spawnKey, config]) => {
        const [x, y] = spawnKey.split(',').map(Number);
        console.log(`🎭 Creating ${config.npcType} at (${x}, ${y})`);
        createNPC(config.npcType, x, y);
      });
      
      console.log(`✅ Loaded ${npcs.size} NPCs from world.json`);
    } else {
      console.log('🎭 No NPC spawns found in world.json');
    }
  } catch (error) {
    console.error('❌ Error loading NPC spawns from world.json:', error);
  }
}

// Resource definitions (match client-side definitions)
const RESOURCE_DEFINITIONS = {
  // Ore definitions
  'ore_copper': { name: 'Copper Ore', icon: '🟤', respawnTime: 5000, type: 'ore' },
  'ore_tin': { name: 'Tin Ore', icon: '🔘', respawnTime: 5000, type: 'ore' },
  'ore_iron': { name: 'Iron Ore', icon: '⚫', respawnTime: 5000, type: 'ore' },
  'ore_silver': { name: 'Silver Ore', icon: '⚪', respawnTime: 9000, type: 'ore' },
  'ore_gold': { name: 'Gold Ore', icon: '🟡', respawnTime: 12000, type: 'ore' },
  'ore_mithril': { name: 'Mithril Ore', icon: '🔵', respawnTime: 12000, type: 'ore' },
  'ore_adamantite': { name: 'Adamantite Ore', icon: '🟢', respawnTime: 15000, type: 'ore' },
  
  // Tree definitions
  'tree_regular': { name: 'Tree', icon: null, respawnTime: 5000, type: 'tree' },
  'tree_oak': { name: 'Oak Tree', icon: '🌳', respawnTime: 8000, type: 'tree' },
  'tree_pine': { name: 'Pine Tree', icon: '🌲', respawnTime: 10000, type: 'tree' },
  'tree_palm': { name: 'Palm Tree', icon: '🌴', respawnTime: 12000, type: 'tree' },
  'tree_bamboo': { name: 'Bamboo', icon: '🎋', respawnTime: 6000, type: 'tree' },
  'tree_magic': { name: 'Magic Tree', icon: '🎄', respawnTime: 20000, type: 'tree' },
  
  // Harvesting node definitions
  'apple_tree': { name: 'Apple Tree', icon: '🌳', respawnTime: 60000, type: 'harvesting' },
  'cherry_tree': { name: 'Cherry Tree', icon: '🌳', respawnTime: 75000, type: 'harvesting' },
  'peach_tree': { name: 'Peach Tree', icon: '🌳', respawnTime: 90000, type: 'harvesting' },
  'mushroom_patch': { name: 'Mushroom Patch', icon: '🍄', respawnTime: 45000, type: 'harvesting' },
  'wheat_field': { name: 'Wheat Field', icon: '🌾', respawnTime: 50000, type: 'harvesting' }
};

// Global shop state (server-side)
const serverShops = {};

// Initialize server shops
function initializeServerShops() {
  console.log('🏪 Initializing server-side shop system...');
  
  const shopDefinitions = {
    general_store: {
      id: 'general_store',
      name: "Lumbridge General Store",
      keeper: "Shop Assistant", 
      description: "We've got what you need!",
      icon: '🏪',
      type: 'general',
      sellMultiplier: 0.6,
      buyMultiplier: 1.0,
      priceChangeRate: 0.03,
      restockInterval: 30000,
      destockInterval: 60000,
      maxPurchaseQuantity: 50,
      acceptsAllItems: true,
      defaultStock: {
        'coins': { quantity: 0, maxQuantity: 0, restockRate: 0 },
        'apple': { quantity: 5, maxQuantity: 10, restockRate: 1 },
        'potion': { quantity: 3, maxQuantity: 5, restockRate: 1 },
        'book': { quantity: 2, maxQuantity: 3, restockRate: 1 },
        'meat': { quantity: 0, maxQuantity: 50, restockRate: 0 },
        'bread': { quantity: 0, maxQuantity: 20, restockRate: 0 },
        'rope': { quantity: 0, maxQuantity: 10, restockRate: 0 },
        'tinderbox': { quantity: 0, maxQuantity: 5, restockRate: 0 }
      }
    },
    
    weapon_shop: {
      id: 'weapon_shop',
      name: "Bob's Brilliant Axes",
      keeper: "Bob",
      description: "Finest weapons in the land!",
      icon: '⚔️',
      type: 'specialty',
      sellMultiplier: 0.75,
      buyMultiplier: 1.0,
      priceChangeRate: 0.02,
      restockInterval: 45000,
      destockInterval: 90000,
      maxPurchaseQuantity: 10,
      defaultStock: {
        'coins': { quantity: 0, maxQuantity: 0, restockRate: 0 },
        'sword': { quantity: 3, maxQuantity: 5, restockRate: 1 },
        'bronze_axe': { quantity: 5, maxQuantity: 8, restockRate: 2 },
        'iron_axe': { quantity: 3, maxQuantity: 5, restockRate: 1 },
        'steel_axe': { quantity: 1, maxQuantity: 3, restockRate: 1 },
        // Fletching knives - full progression
        'wooden_knife': { quantity: 15, maxQuantity: 20, restockRate: 3 },
        'stone_knife': { quantity: 12, maxQuantity: 15, restockRate: 2 },
        'copper_knife': { quantity: 10, maxQuantity: 12, restockRate: 2 },
        'bronze_knife': { quantity: 8, maxQuantity: 12, restockRate: 2 },
        'iron_knife': { quantity: 5, maxQuantity: 8, restockRate: 1 },
        'steel_knife': { quantity: 2, maxQuantity: 5, restockRate: 1 },
        'darksteel_knife': { quantity: 1, maxQuantity: 3, restockRate: 1 },
        'silver_knife': { quantity: 1, maxQuantity: 2, restockRate: 1 },
        'gold_knife': { quantity: 0, maxQuantity: 1, restockRate: 1 }, // Rare restock
        'cobalt_knife': { quantity: 0, maxQuantity: 1, restockRate: 1 }, // Very rare
        'titanium_knife': { quantity: 0, maxQuantity: 1, restockRate: 1 }, // Very rare
        // Note: dragonbone, meteor, and lunar knives are not buyable (special drops/crafts only)
        'wooden_log': { quantity: 0, maxQuantity: 50, restockRate: 0 },
        'oak_log': { quantity: 0, maxQuantity: 30, restockRate: 0 }
      }
    },
    
    unlimited_food: {
      id: 'unlimited_food',
      name: "The Green Grocer",
      keeper: "Greengrocer",
      description: "Fresh food, unlimited supply!",
      icon: '🍎',
      type: 'unlimited',
      sellMultiplier: 0.4,
      buyMultiplier: 1.0,
      priceChangeRate: 0,
      restockInterval: 0,
      destockInterval: 0,
      maxPurchaseQuantity: 10,
      acceptsOnlyDefaultStock: true,
      defaultStock: {
        'coins': { quantity: 0, maxQuantity: 0, restockRate: 0 },
        'apple': { quantity: 999999, maxQuantity: 999999, restockRate: 0 },
        'mushroom': { quantity: 999999, maxQuantity: 999999, restockRate: 0 }
      }
    },
    
    magic_shop: {
      id: 'magic_shop',
      name: "Mystical Emporium",
      keeper: "Wizard Zara",
      description: "Magical items and potions for the mystically inclined.",
      icon: '🔮',
      type: 'specialty',
      sellMultiplier: 0.8,
      buyMultiplier: 1.3,
      priceChangeRate: 0.04,
      restockInterval: 60000,
      destockInterval: 120000,
      maxPurchaseQuantity: 5,
      acceptsOnlyDefaultStock: true,
      defaultStock: {
        'coins': { quantity: 0, maxQuantity: 0, restockRate: 0 },
        'potion': { quantity: 8, maxQuantity: 15, restockRate: 2 },
        'book': { quantity: 5, maxQuantity: 8, restockRate: 1 },
        'gem': { quantity: 2, maxQuantity: 4, restockRate: 1 },
        'sapphire': { quantity: 1, maxQuantity: 2, restockRate: 1 },
        'emerald': { quantity: 1, maxQuantity: 2, restockRate: 1 },
        'diamond': { quantity: 0, maxQuantity: 1, restockRate: 1 }
      }
    },
    
    mining_shop: {
      id: 'mining_shop',
      name: "Pickaxe Pete's Mining Supplies",
      keeper: "Pickaxe Pete",
      description: "Everything a miner needs - tools, ores, and bars!",
      icon: '⛏️',
      type: 'specialty',
      sellMultiplier: 0.7,
      buyMultiplier: 1.2,
      priceChangeRate: 0.03,
      restockInterval: 45000,
      destockInterval: 90000,
      maxPurchaseQuantity: 20,
      acceptsOnlyDefaultStock: true,
      defaultStock: {
        'coins': { quantity: 0, maxQuantity: 0, restockRate: 0 },
        'chisel': { quantity: 3, maxQuantity: 5, restockRate: 1 },
        'coal': { quantity: 15, maxQuantity: 25, restockRate: 3 },
        'bronze_pickaxe': { quantity: 8, basePrice: 120, restockAmount: 2 },
        'iron_pickaxe': { quantity: 8, basePrice: 300, restockAmount: 2 },
        'bronze_shovel': { quantity: 8, basePrice: 120, restockAmount: 2 },
        'iron_shovel': { quantity: 8, basePrice: 300, restockAmount: 2 },
        'iron_ore': { quantity: 10, maxQuantity: 20, restockRate: 2 },
        'copper_ore': { quantity: 12, maxQuantity: 25, restockRate: 3 },
        'tin_ore': { quantity: 12, maxQuantity: 25, restockRate: 3 },
        'silver_ore': { quantity: 5, maxQuantity: 10, restockRate: 1 },
        'gold_ore': { quantity: 3, maxQuantity: 8, restockRate: 1 },
        'mithril_ore': { quantity: 2, maxQuantity: 5, restockRate: 1 },
        'adamantite_ore': { quantity: 1, maxQuantity: 3, restockRate: 1 },
        'bronze_bar': { quantity: 8, maxQuantity: 15, restockRate: 2 },
        'iron_bar': { quantity: 5, maxQuantity: 12, restockRate: 1 },
        'steel_bar': { quantity: 3, maxQuantity: 8, restockRate: 1 },
        'mithril_bar': { quantity: 1, maxQuantity: 3, restockRate: 1 }
      }
    },
    
    fletching_shop: {
      id: 'fletching_shop',
      name: "The Bow String",
      keeper: "Fletcher Frank",
      description: "Finest bows and arrows in the land!",
      icon: '🏹',
      type: 'specialty',
      sellMultiplier: 0.75,
      buyMultiplier: 1.1,
      priceChangeRate: 0.03,
      restockInterval: 45000,
      destockInterval: 90000,
      maxPurchaseQuantity: 15,
      acceptsOnlyDefaultStock: true,
      defaultStock: {
        'coins': { quantity: 0, maxQuantity: 0, restockRate: 0 },
        // Knives for fletching - full progression
        'wooden_knife': { quantity: 12, maxQuantity: 15, restockRate: 2 },
        'stone_knife': { quantity: 10, maxQuantity: 12, restockRate: 2 },
        'copper_knife': { quantity: 8, maxQuantity: 10, restockRate: 1 },
        'bronze_knife': { quantity: 10, maxQuantity: 15, restockRate: 3 },
        'iron_knife': { quantity: 8, maxQuantity: 12, restockRate: 2 },
        'steel_knife': { quantity: 5, maxQuantity: 8, restockRate: 1 },
        'darksteel_knife': { quantity: 2, maxQuantity: 4, restockRate: 1 },
        'silver_knife': { quantity: 1, maxQuantity: 3, restockRate: 1 },
        'gold_knife': { quantity: 1, maxQuantity: 2, restockRate: 1 },
        'cobalt_knife': { quantity: 0, maxQuantity: 1, restockRate: 1 }, // Very rare
        'titanium_knife': { quantity: 0, maxQuantity: 1, restockRate: 1 }, // Very rare
        'mithril_knife': { quantity: 2, maxQuantity: 4, restockRate: 1 },
        'adamantite_knife': { quantity: 1, maxQuantity: 2, restockRate: 1 },
        // Bows
        'shortbow': { quantity: 6, maxQuantity: 10, restockRate: 2 },
        'longbow': { quantity: 4, maxQuantity: 8, restockRate: 1 },
        'oak_shortbow': { quantity: 3, maxQuantity: 6, restockRate: 1 },
        'oak_longbow': { quantity: 2, maxQuantity: 4, restockRate: 1 },
        'willow_shortbow': { quantity: 1, maxQuantity: 3, restockRate: 1 },
        'willow_longbow': { quantity: 1, maxQuantity: 2, restockRate: 1 },
        // Raw materials
        'wooden_log': { quantity: 0, maxQuantity: 50, restockRate: 0 },
        'oak_log': { quantity: 0, maxQuantity: 30, restockRate: 0 },
        'pine_log': { quantity: 0, maxQuantity: 20, restockRate: 0 }
      }
    },
    
    fishing_shop: {
      id: 'fishing_shop',
      name: "The Fishing Spot",
      keeper: "Fisherman Pete",
      description: "All your fishing needs in one place!",
      icon: '🎣',
      type: 'specialty',
      sellMultiplier: 0.75,
      buyMultiplier: 1.1,
      priceChangeRate: 0.03,
      restockInterval: 45000,
      destockInterval: 90000,
      maxPurchaseQuantity: 15,
      acceptsOnlyDefaultStock: true,
      defaultStock: {
        'coins': { quantity: 0, maxQuantity: 0, restockRate: 0 },
        // Fishing tools - progression from low to high level
        'small_net': { quantity: 15, maxQuantity: 20, restockRate: 3 },
        'fishing_rod': { quantity: 12, maxQuantity: 18, restockRate: 2 },
        'big_net': { quantity: 8, maxQuantity: 12, restockRate: 2 },
        'harpoon': { quantity: 5, maxQuantity: 8, restockRate: 1 },
        'lobster_pot': { quantity: 4, maxQuantity: 6, restockRate: 1 },
        // Some basic fish for starting players
        'raw_shrimps': { quantity: 20, maxQuantity: 30, restockRate: 5 },
        'raw_sardine': { quantity: 15, maxQuantity: 25, restockRate: 3 },
        'raw_herring': { quantity: 12, maxQuantity: 20, restockRate: 3 },
        // Accepts fish from players
        'raw_anchovies': { quantity: 0, maxQuantity: 30, restockRate: 0 },
        'raw_tuna': { quantity: 0, maxQuantity: 20, restockRate: 0 },
        'raw_lobster': { quantity: 0, maxQuantity: 15, restockRate: 0 },
        'raw_swordfish': { quantity: 0, maxQuantity: 10, restockRate: 0 },
        'raw_shark': { quantity: 0, maxQuantity: 5, restockRate: 0 }
      }
    }
  };
  
  // Initialize server shops with deep cloned stock
  for (const shopId in shopDefinitions) {
    const shopDef = shopDefinitions[shopId];
    serverShops[shopId] = {
      ...shopDef,
      currentStock: {},
      lastRestockTime: Date.now(),
      lastDestockTime: Date.now()
    };
    
    // Deep clone the stock to avoid reference issues
    for (const itemId in shopDef.defaultStock) {
      serverShops[shopId].currentStock[itemId] = { ...shopDef.defaultStock[itemId] };
    }
  }
  
  // Start shop update cycles
  setInterval(updateServerShops, 60000); // Update every 60 seconds
  
  console.log(`🏪 Initialized ${Object.keys(serverShops).length} server-side shops`);
}

// Update server shops (restock and destock)
function updateServerShops() {
  console.log('🏪 Running server shop updates...');
  
  for (const shopId in serverShops) {
    const shop = serverShops[shopId];
    if (shop.currentStock && shop.defaultStock) {
      // Restock items
      restockServerShop(shop);
      
      // Remove excess items
      destockServerShop(shop);
      
      // Clean up expired player-sold items
      cleanupExpiredPlayerItemsServer(shop);
    }
  }
  
  // Broadcast updated shop data to all connected players
  broadcastShopUpdates();
  
  console.log('🏪 Server shop updates complete');
}

// Restock server shop
function restockServerShop(shop) {
  if (shop.restockInterval === 0) return; // No restocking for unlimited shops
  
  const currentTime = Date.now();
  if (currentTime - shop.lastRestockTime < shop.restockInterval) return;
  
  for (const itemId in shop.defaultStock) {
    const defaultStock = shop.defaultStock[itemId];
    const currentStock = shop.currentStock[itemId];
    
    if (defaultStock.restockRate > 0 && currentStock && currentStock.quantity < defaultStock.maxQuantity) {
      const restockAmount = Math.min(defaultStock.restockRate, defaultStock.maxQuantity - currentStock.quantity);
      currentStock.quantity += restockAmount;
      console.log(`🏪 Restocked ${restockAmount} ${itemId} in ${shop.name}`);
    }
  }
  
  shop.lastRestockTime = currentTime;
}

// Destock server shop  
function destockServerShop(shop) {
  if (shop.destockInterval === 0) return;
  
  const currentTime = Date.now();
  if (currentTime - shop.lastDestockTime < shop.destockInterval) return;
  
  for (const itemId in shop.currentStock) {
    const currentStock = shop.currentStock[itemId];
    const defaultStock = shop.defaultStock[itemId];
    
    if (currentStock && defaultStock && currentStock.quantity > defaultStock.maxQuantity) {
      const excessAmount = currentStock.quantity - defaultStock.maxQuantity;
      const destockAmount = Math.min(excessAmount, 1); // Remove 1 at a time
      currentStock.quantity -= destockAmount;
      console.log(`🏪 Destocked ${destockAmount} ${itemId} from ${shop.name}`);
    }
  }
  
  shop.lastDestockTime = currentTime;
}

// Clean up expired player-sold items from server shop
function cleanupExpiredPlayerItemsServer(shop) {
  const EXPIRY_TIME = 3 * 60 * 1000; // 3 minutes
  const currentTime = Date.now();
  
  for (const itemId in shop.currentStock) {
    const stockInfo = shop.currentStock[itemId];
    
    if (stockInfo && stockInfo.isPlayerSold && stockInfo.lastSoldTime) {
      const cleanupInterval = Math.max(EXPIRY_TIME, 30000); // At least 30 seconds
      const timeSinceLastCleanup = currentTime - (stockInfo.lastCleanupTime || stockInfo.lastSoldTime);
      
      if (timeSinceLastCleanup >= cleanupInterval) {
        if (stockInfo.quantity > 1) {
          stockInfo.quantity -= 1;
          stockInfo.lastCleanupTime = currentTime;
          console.log(`🏪 Server: Removed 1 ${itemId} from ${shop.name}, ${stockInfo.quantity} remaining`);
        } else {
          console.log(`🏪 Server: Completely removed ${itemId} from ${shop.name} (last item)`);
          delete shop.currentStock[itemId];
          
          if (shop.defaultStock[itemId] && shop.defaultStock[itemId].restockRate === 0) {
            delete shop.defaultStock[itemId];
          }
        }
      }
    }
  }
}

// Broadcast shop updates to all players
function broadcastShopUpdates() {
  broadcastToAll({
    type: 'shop-sync',
    shops: serverShops,
    timestamp: Date.now()
  });
}

// Send shop data to a specific player
function sendShopDataToPlayer(ws) {
  if (!ws.username || ws.readyState !== WebSocket.OPEN) return;
  
  ws.send(JSON.stringify({
    type: 'shop-sync',
    shops: serverShops,
    timestamp: Date.now()
  }));
  
  console.log(`🏪 Sent shop data to ${ws.username}`);
}

// Calculate buy price for an item on server
function calculateBuyPriceServer(shop, itemId, quantity = 1, stockKey = null) {
  // Use stockKey for stock lookup if provided, otherwise use itemId
  const lookupKey = stockKey || itemId;
  const stockInfo = shop.currentStock[lookupKey];
  if (!stockInfo) {
    console.log(`🏪 [PRICE DEBUG] No stockInfo found for lookupKey: ${lookupKey} (itemId: ${itemId})`);
    return 0;
  }
  
  // Use shared item definitions for consistent pricing
  const itemDef = getItemDefinition(itemId);
  const baseValue = itemDef?.value || 10; // Default price if not defined
  console.log(`🏪 [PRICE DEBUG] For itemId ${itemId}: baseValue = ${baseValue}, stockInfo.quantity = ${stockInfo.quantity}`);
  const currentStock = stockInfo.quantity;
  const defaultStock = stockInfo.maxQuantity || 50;
  
  if (shop.type === 'unlimited') {
    // Unlimited shops have fixed prices (match client logic)
    return baseValue * shop.buyMultiplier * quantity;
  }
  
  // Use same iterative logic as client for stock-based pricing
  let totalPrice = 0;
  for (let i = 0; i < quantity; i++) {
    const stockAfterPurchase = currentStock - i;
    const stockDifference = Math.max(0, defaultStock - stockAfterPurchase);
    const priceMultiplier = shop.buyMultiplier + (stockDifference * shop.priceChangeRate);
    totalPrice += Math.floor(baseValue * priceMultiplier);
  }
  
  return Math.max(1, totalPrice); // Minimum 1 coin
}

// Calculate sell price for an item on server
function calculateSellPriceServer(shop, itemId, quantity = 1) {
  // Use shared item definitions for consistent pricing
  const itemDef = getItemDefinition(itemId);
  const baseValue = itemDef?.value || 5; // Default sell price
  const currentStock = shop.currentStock[itemId] ? shop.currentStock[itemId].quantity : 0;
  const defaultStock = shop.currentStock[itemId] ? shop.currentStock[itemId].maxQuantity : 0;
  
  if (shop.type === 'unlimited') {
    // Unlimited shops have fixed sell prices (match client logic)
    return Math.floor(baseValue * shop.sellMultiplier * quantity);
  }
  
  // Use same iterative logic as client for stock-based pricing
  let totalPrice = 0;
  for (let i = 0; i < quantity; i++) {
    const stockAfterSale = currentStock + i;
    let priceMultiplier;
    
    if (shop.type === 'specialty' && defaultStock > 0) {
      // Specialty shops use their max stock as reference
      const stockDifference = stockAfterSale - defaultStock;
      priceMultiplier = shop.sellMultiplier - (stockDifference * shop.priceChangeRate);
    } else {
      // General stores
      const stockDifference = stockAfterSale;
      priceMultiplier = shop.sellMultiplier - (stockDifference * shop.priceChangeRate);
    }
    
    // Minimum 10% of item value (OSRS rule)
    priceMultiplier = Math.max(0.1, priceMultiplier);
    totalPrice += Math.floor(baseValue * priceMultiplier);
  }
  
  return Math.max(1, totalPrice); // Minimum 1 coin
}

// Handle shop buy request
function handleShopBuyRequest(ws, data) {
  if (!ws.username) return;
  
  const { shopId, itemId, quantity } = data;
  
  if (!shopId || !itemId || !quantity || quantity <= 0) {
    console.warn(`⚠️ Invalid shop buy request from ${ws.username}:`, data);
    ws.send(JSON.stringify({
      type: 'shop-buy-denied',
      reason: 'Invalid request parameters'
    }));
    return;
  }
  
  const shop = serverShops[shopId];
  if (!shop) {
    console.warn(`⚠️ ${ws.username} tried to buy from non-existent shop: ${shopId}`);
    ws.send(JSON.stringify({
      type: 'shop-buy-denied',
      reason: 'Shop does not exist'
    }));
    return;
  }
  
  const stockInfo = shop.currentStock[itemId];
  if (!stockInfo) {
    console.warn(`⚠️ ${ws.username} tried to buy non-existent item ${itemId} from ${shopId}`);
    ws.send(JSON.stringify({
      type: 'shop-buy-denied',
      reason: 'Item not available'
    }));
    return;
  }
  
  // Check stock availability
  const availableQuantity = shop.type === 'unlimited' ? quantity : Math.min(quantity, stockInfo.quantity);
  if (availableQuantity <= 0) {
    console.log(`🏪 ${ws.username} tried to buy ${itemId} but shop is out of stock`);
    ws.send(JSON.stringify({
      type: 'shop-buy-denied',
      reason: 'Out of stock'
    }));
    return;
  }
  
  // Calculate cost using baseItemId for custom items
  const priceItemId = stockInfo.baseItemId || itemId;
  console.log(`🏪 [BUY DEBUG] Calculating price for itemId: ${itemId}, priceItemId: ${priceItemId}, quantity: ${availableQuantity}`);
  const totalCost = calculateBuyPriceServer(shop, priceItemId, availableQuantity, itemId);
  console.log(`🏪 [BUY DEBUG] Calculated total cost: ${totalCost}`);
  
  // Get user data to check coins
  const user = users.get(ws.username);
  if (!user || !user.savedInventory) {
    ws.send(JSON.stringify({
      type: 'shop-buy-denied',
      reason: 'Player data not found'
    }));
    return;
  }
  
  // Check if player has enough coins
  const playerCoins = user.savedInventory.reduce((total, item) => {
    return total + (item && item.id === 'coins' ? (item.quantity || 1) : 0);
  }, 0);
  
  if (playerCoins < totalCost) {
    console.log(`🏪 ${ws.username} needs ${totalCost} coins but only has ${playerCoins}`);
    ws.send(JSON.stringify({
      type: 'shop-buy-denied',
      reason: `Need ${totalCost} coins, but only have ${playerCoins}`
    }));
    return;
  }
  
  // Process the transaction
  // Remove coins from player inventory
  let coinsToRemove = totalCost;
  for (let i = 0; i < user.savedInventory.length && coinsToRemove > 0; i++) {
    const item = user.savedInventory[i];
    if (item && item.id === 'coins') {
      const removeAmount = Math.min(coinsToRemove, item.quantity || 1);
      if ((item.quantity || 1) <= removeAmount) {
        user.savedInventory[i] = null;
      } else {
        item.quantity -= removeAmount;
      }
      coinsToRemove -= removeAmount;
    }
  }
  
  // Add coins to shop
  if (!shop.currentStock.coins) {
    shop.currentStock.coins = { quantity: 0, maxQuantity: 0, restockRate: 0 };
  }
  shop.currentStock.coins.quantity += totalCost;
  
  // Remove items from shop stock
  if (shop.type !== 'unlimited') {
    stockInfo.quantity -= availableQuantity;
  }
  
  // Add items to player inventory - handle stacking properly
  let itemsToAdd = availableQuantity;
  const inventoryItemId = stockInfo.baseItemId || itemId; // Get the base item ID for custom items
  
  // Create the item template that we're trying to add
  const itemToAdd = {
    id: inventoryItemId,
    quantity: 1
  };
  
  // Add custom properties if this is a custom item
  if (stockInfo.customProperties) {
    Object.assign(itemToAdd, stockInfo.customProperties);
  }
  
  // First pass: try to stack with existing items
  for (let i = 0; i < user.savedInventory.length && itemsToAdd > 0; i++) {
    const existingItem = user.savedInventory[i];
    if (existingItem && canItemsStack(itemToAdd, existingItem)) {
      const stackAmount = Math.min(itemsToAdd, 999 - (existingItem.quantity || 1)); // Assume max stack of 1000
      existingItem.quantity = (existingItem.quantity || 1) + stackAmount;
      itemsToAdd -= stackAmount;
      console.log(`🏪 Stacked ${stackAmount} ${inventoryItemId} with existing stack. New total: ${existingItem.quantity}`);
    }
  }
  
  // Second pass: add remaining items to empty slots
  for (let i = 0; i < user.savedInventory.length && itemsToAdd > 0; i++) {
    if (!user.savedInventory[i]) {
      // Create item with custom properties if they exist
      const newItem = {
        id: inventoryItemId,
        quantity: Math.min(itemsToAdd, 1000) // Add up to 1000 to a new stack
      };
      
      // Add custom properties if this is a custom item
      if (stockInfo.customProperties) {
        Object.assign(newItem, stockInfo.customProperties);
        console.log(`🏪 Added custom item to ${ws.username}'s inventory:`, newItem);
      }
      
      user.savedInventory[i] = newItem;
      itemsToAdd -= newItem.quantity;
    }
  }
  
  // Save user data
  saveUsers();
  
  console.log(`🏪 ${ws.username} bought ${availableQuantity} ${itemId} from ${shopId} for ${totalCost} coins`);
  
  // Send confirmation to buyer with updated inventory
  ws.send(JSON.stringify({
    type: 'shop-buy-confirmed',
    shopId: shopId,
    itemId: itemId,
    quantity: availableQuantity,
    totalCost: totalCost,
    updatedInventory: user.savedInventory // Include updated inventory
  }));
  
  // Also send inventory sync to keep client in sync
  ws.send(JSON.stringify({
    type: 'inventory-sync',
    inventory: user.savedInventory,
    timestamp: Date.now()
  }));
  
  // Broadcast shop update to all players
  broadcastShopUpdates();
}

// Handle shop sell request
function handleShopSellRequest(ws, data) {
  if (!ws.username) return;
  
  const { shopId, slotIndex, quantity } = data;
  
  if (!shopId || slotIndex === undefined || !quantity || quantity <= 0) {
    console.warn(`⚠️ Invalid shop sell request from ${ws.username}:`, data);
    ws.send(JSON.stringify({
      type: 'shop-sell-denied',
      reason: 'Invalid request parameters'
    }));
    return;
  }
  
  const shop = serverShops[shopId];
  if (!shop) {
    console.warn(`⚠️ ${ws.username} tried to sell to non-existent shop: ${shopId}`);
    ws.send(JSON.stringify({
      type: 'shop-sell-denied',
      reason: 'Shop does not exist'
    }));
    return;
  }
  
  const user = users.get(ws.username);
  if (!user || !user.savedInventory || !user.savedInventory[slotIndex]) {
    ws.send(JSON.stringify({
      type: 'shop-sell-denied',
      reason: 'Item not found in inventory'
    }));
    return;
  }
  
  const item = user.savedInventory[slotIndex];
  const availableQuantity = Math.min(quantity, item.quantity || 1);
  
  // Check if shop accepts this item type
  if (!shop.acceptsAllItems && !shop.defaultStock[item.id]) {
    if (shop.acceptsOnlyDefaultStock) {
      ws.send(JSON.stringify({
        type: 'shop-sell-denied',
        reason: 'This shop doesn\'t buy that type of item'
      }));
      return;
    }
  }
  
  // Calculate sell value
  const totalValue = calculateSellPriceServer(shop, item.id, availableQuantity);
  
    // Add item to shop stock - preserve custom properties for items with author info
  const itemDef = getItemDefinition(item.id);
  const hasCustomProperties = item.author || item.authorName || (item.name && item.name !== itemDef?.name);
  const stockKey = hasCustomProperties ? `${item.id}_custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` : item.id;
  
  console.log(`🏪 [SELL DEBUG] Item:`, item);
  console.log(`🏪 [SELL DEBUG] Item definition:`, itemDef);
  console.log(`🏪 [SELL DEBUG] Has custom properties:`, hasCustomProperties);
  console.log(`🏪 [SELL DEBUG] Stock key:`, stockKey);
  
  if (!shop.currentStock[stockKey]) {
    // Use reasonable maxQuantity for player-sold items to prevent extreme price fluctuations
    // For single items, use the selling quantity + small buffer instead of large default
    const baseMaxQuantity = shop.type === 'general' ? 5 : 3; // Much smaller than before
    const reasonableMaxQuantity = Math.max(baseMaxQuantity, availableQuantity + 2);
    shop.currentStock[stockKey] = { 
      quantity: 0, 
      maxQuantity: reasonableMaxQuantity, 
      restockRate: 0,
      isPlayerSold: true,
      lastSoldTime: Date.now(),
      lastCleanupTime: Date.now(),
      baseItemId: item.id, // Store the base item ID for lookups
      customProperties: hasCustomProperties ? {
        author: item.author,
        authorName: item.authorName,
        name: item.name,
        description: item.description,
        writtenDate: item.writtenDate
      } : null
    };
    
    if (shop.type === 'general' && shop.acceptsAllItems) {
      shop.defaultStock[stockKey] = {
        quantity: 0,
        maxQuantity: reasonableMaxQuantity,
        restockRate: 0,
        baseItemId: item.id
      };
    }
  }

  shop.currentStock[stockKey].quantity += availableQuantity;
  if (shop.currentStock[stockKey].isPlayerSold) {
    shop.currentStock[stockKey].lastSoldTime = Date.now();
  }
  
  console.log(`🏪 Added ${availableQuantity} ${item.id}${hasCustomProperties ? ' (with custom properties)' : ''} to shop stock as ${stockKey}`);
  
  // Remove item from player inventory
  if ((item.quantity || 1) <= availableQuantity) {
    user.savedInventory[slotIndex] = null;
  } else {
    item.quantity -= availableQuantity;
  }
  
  // Add coins to player inventory (find empty slot or stack with existing coins)
  let coinsAdded = false;
  for (let i = 0; i < user.savedInventory.length; i++) {
    const slot = user.savedInventory[i];
    if (slot && slot.id === 'coins') {
      slot.quantity = (slot.quantity || 1) + totalValue;
      coinsAdded = true;
      break;
    }
  }
  
  if (!coinsAdded) {
    // Find empty slot for coins
    for (let i = 0; i < user.savedInventory.length; i++) {
      if (!user.savedInventory[i]) {
        user.savedInventory[i] = { id: 'coins', quantity: totalValue };
        coinsAdded = true;
        break;
      }
    }
  }
  
  // Save user data
  saveUsers();
  
  console.log(`🏪 ${ws.username} sold ${availableQuantity} ${item.id} to ${shopId} for ${totalValue} coins`);
  
  // Send confirmation to seller with updated inventory
  ws.send(JSON.stringify({
    type: 'shop-sell-confirmed',
    shopId: shopId,
    itemId: item.id,
    quantity: availableQuantity,
    totalValue: totalValue,
    updatedInventory: user.savedInventory // Include updated inventory
  }));
  
  // Also send inventory sync to keep client in sync
  ws.send(JSON.stringify({
    type: 'inventory-sync',
    inventory: user.savedInventory,
    timestamp: Date.now()
  }));
  
  // Broadcast shop update to all players
  broadcastShopUpdates();
}

/**
 * Initialize a resource in the world (called when world loads)
 */
function initializeResource(resourceType, x, y) {
  const resourceKey = `${x},${y}`;
  const resourceDef = RESOURCE_DEFINITIONS[resourceType];
  
  if (resourceDef) {
    worldResources.set(resourceKey, {
      type: resourceType,
      resourceType: resourceType, // Keep both for compatibility
      x: x,
      y: y,
      available: true,
      depletedAt: null,
      depletedBy: null
    });
    console.log(`🌍 Initialized resource ${resourceType} at (${x}, ${y})`);
  }
}

/**
 * Handle resource depletion request (server-authoritative)
 */
function handleResourceDepleted(ws, data) {
  if (!ws.username) return;
  
  const { resourceType, x, y, resourceId, respawnTime } = data;
  
  if (!resourceType || typeof x !== 'number' || typeof y !== 'number') {
    console.warn(`⚠️ Invalid resource depletion request from ${ws.username}:`, data);
    return;
  }
  
  // Clear the active action for this player
  activePlayerActions.delete(ws.username);
  
  const resourceKey = `${x},${y}`;
  const resource = worldResources.get(resourceKey);
  const resourceDef = RESOURCE_DEFINITIONS[resourceType];
  
  if (!resourceDef) {
    console.warn(`⚠️ Unknown resource type: ${resourceType}`);
    ws.send(JSON.stringify({
      type: 'resource-depletion-denied',
      resourceType: resourceType,
      x: x,
      y: y,
      reason: 'Unknown resource type'
    }));
    return;
  }
  
  // If resource doesn't exist in our tracking, initialize it as available
  if (!resource) {
    initializeResource(resourceType, x, y);
    const newResource = worldResources.get(resourceKey);
    if (!newResource) {
      console.warn(`⚠️ Failed to initialize resource ${resourceType} at (${x}, ${y})`);
      return;
    }
  }
  
  const currentResource = worldResources.get(resourceKey);
  
  // Check if resource is available for depletion
  if (!currentResource.available) {
    console.warn(`⚠️ Resource ${resourceType} at (${x}, ${y}) already depleted by ${currentResource.depletedBy}`);
    ws.send(JSON.stringify({
      type: 'resource-depletion-denied',
      resourceType: resourceType,
      x: x,
      y: y,
      reason: 'Resource already depleted',
      depletedBy: currentResource.depletedBy,
      depletedAt: currentResource.depletedAt
    }));
    return;
  }
  
  // Resource is available - process depletion
  currentResource.available = false;
  currentResource.depletedAt = Date.now();
  currentResource.depletedBy = ws.username;
  
  console.log(`🪨 ${ws.username} depleted ${resourceType} at (${x}, ${y})`);
  
  // Send confirmation to the player who depleted it
  ws.send(JSON.stringify({
    type: 'resource-depletion-confirmed',
    resourceType: resourceType,
    x: x,
    y: y,
    resourceId: resourceId,
    respawnTime: resourceDef.respawnTime
  }));
  
  // Broadcast to all other players that this resource is depleted
  broadcastToAll({
    type: 'player-resource-depleted',
    username: ws.username,
    resourceType: resourceType,
    x: x,
    y: y,
    resourceId: resourceId,
    respawnTime: resourceDef.respawnTime,
    timestamp: Date.now()
  }, ws);
  
  // Start server-side respawn timer
  const timerId = setTimeout(() => {
    respawnResourceOnServer(resourceType, x, y);
  }, resourceDef.respawnTime);
  
  resourceRespawnTimers.set(resourceKey, timerId);
  
  console.log(`⏰ Resource ${resourceType} at (${x}, ${y}) will respawn in ${resourceDef.respawnTime / 1000} seconds`);
}

/**
 * Handle resource respawn on server
 */
function respawnResourceOnServer(resourceType, x, y) {
  const resourceKey = `${x},${y}`;
  const resource = worldResources.get(resourceKey);
  
  if (!resource) {
    console.warn(`⚠️ Attempted to respawn non-existent resource ${resourceType} at (${x}, ${y})`);
    return;
  }
  
  // Mark resource as available again
  resource.available = true;
  resource.depletedAt = null;
  resource.depletedBy = null;
  
  // Clean up timer
  resourceRespawnTimers.delete(resourceKey);
  
  console.log(`🌱 ${resourceType} respawned at (${x}, ${y})`);
  
  // Broadcast to all players that this resource has respawned
  broadcastToAll({
    type: 'player-resource-respawned',
    resourceType: resourceType,
    x: x,
    y: y,
    timestamp: Date.now()
  });
}

/**
 * Handle resource respawn synchronization (legacy - now server handles respawning)
 */
function handleResourceRespawned(ws, data) {
  // This function is now deprecated since respawning is handled server-side
  // Keep for backward compatibility but log a warning
  console.warn(`⚠️ Received client-side respawn message from ${ws.username} - respawning is now server-side only`);
}

/**
 * Get current resource state (for debugging or world sync)
 */
function getResourceState(x, y) {
  const resourceKey = `${x},${y}`;
  return worldResources.get(resourceKey);
}

/**
 * Send current world state to a player (including depleted resources)
 */
function sendWorldStateToPlayer(ws) {
  // Send world state extremely quickly for near-instant sync
  setTimeout(() => {
    if (!ws.username || ws.readyState !== WebSocket.OPEN) {
      console.log('🌍 Cannot send world state - player disconnected');
      return;
    }
    
    const depletedResources = [];
    
    console.log(`🌍 Checking ${worldResources.size} resources for depletion state...`);
    
    // Collect all currently depleted resources
    for (const [key, resource] of worldResources) {
      if (!resource.available) {
        const [x, y] = key.split(',').map(Number);
        depletedResources.push({
          resourceType: resource.type,
          x: x,
          y: y,
          depletedBy: resource.depletedBy,
          depletedAt: resource.depletedAt
        });
        console.log(`🌍 Found depleted resource: ${resource.type} at (${x}, ${y}) depleted by ${resource.depletedBy}`);
      }
    }
    
    // Always send world state message, even if no depleted resources
    ws.send(JSON.stringify({
      type: 'world-state-sync',
      depletedResources: depletedResources,
      timestamp: Date.now()
    }));
    
    if (depletedResources.length > 0) {
      console.log(`🌍 Sent world state to ${ws.username}: ${depletedResources.length} depleted resources`);
    } else {
      console.log(`🌍 Sent world state to ${ws.username}: no depleted resources`);
    }
  }, 100); // Ultra-fast 100ms for near-instant sync
}

/**
 * Cleanup function to clear all resource timers (called on server shutdown)
 */
function cleanupResourceTimers() {
  for (const [key, timerId] of resourceRespawnTimers) {
    clearTimeout(timerId);
  }
  resourceRespawnTimers.clear();
  console.log('🧹 Cleaned up all resource respawn timers');
}

// Middleware
app.use(express.json());
app.use(express.static('.'));

// Auto-save data every 30 seconds
setInterval(() => {
  saveUsers();
  saveSessions();
}, 30000);

// Save data on process exit
process.on('SIGINT', () => {
  console.log('\nSaving data before exit...');
  saveUsers();
  saveSessions();
  cleanupResourceTimers();
  process.exit(0);
});

// Create test account if no users exist
if (users.size === 0) {
  const testPassword = 'admin123';
  const hashedPassword = crypto.createHash('sha256').update(testPassword).digest('hex');
  
  users.set('admin', {
    password: hashedPassword,
    profile: {
      username: 'admin',
      character: { name: 'Admin' },
      skills: {
        // Combat Skills
        attack: 1,
        magic: 1,
        ranged: 1,
        blasting: 1,
        defence: 1,
        hitpoints: 10,
        prayer: 1,
        slayer: 1,
        
        // Gathering Skills
        mining: 1,
        fishing: 1,
        woodcutting: 1,
        harvesting: 1,
        
        // Artisan Skills
        smithing: 1,
        cooking: 1,
        fletching: 1,
        apothecary: 1,
        crafting: 1,
        bonecarving: 1,
        painting: 1,
        brewing: 1,
        scribing: 1,
        confectionery: 1,
        masonry: 1,
        tailoring: 1,
        
        // Support Skills
        thieving: 1,
        alchemy: 1,
        creation: 1,
        delivery: 1,
        ranching: 1,
        knowledge: 1,
        candlemaking: 1,
        pottery: 1,
        digging: 1,
        diplomacy: 1,
        apiary: 1,
        taming: 1,
        dracology: 1,
        engineering: 1
      },
      skillsExp: {
        // Combat Skills
        attack: 0,
        magic: 0,
        ranged: 0,
        blasting: 0,
        defence: 0,
        hitpoints: 1154,
        prayer: 0,
        slayer: 0,
        
        // Gathering Skills
        mining: 0,
        fishing: 0,
        woodcutting: 0,
        harvesting: 0,
        
        // Artisan Skills
        smithing: 0,
        cooking: 0,
        fletching: 0,
        apothecary: 0,
        crafting: 0,
        bonecarving: 0,
        painting: 0,
        brewing: 0,
        scribing: 0,
        confectionery: 0,
        masonry: 0,
        tailoring: 0,
        
        // Support Skills
        thieving: 0,
        alchemy: 0,
        creation: 0,
        delivery: 0,
        ranching: 0,
        knowledge: 0,
        candlemaking: 0,
        pottery: 0,
        digging: 0,
        diplomacy: 0,
        apiary: 0,
        taming: 0,
        dracology: 0,
        engineering: 0
      },
      settings: {
        musicVolume: 0.5,
        soundVolume: 0.5,
        difficulty: 'normal',
        playerColor: '#3498db',
        bubbleOpacity: 0.5
      },
      totalLevel: 31,
      combatLevel: 3
    },
    createdAt: Date.now(),
    spawnPosition: { x: 10, y: 10 }
  });
  
  saveUsers(); // Save the test account immediately
  console.log('Test account created - Username: admin, Password: admin123');
}

// Utility functions
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function generateSessionId() {
  return crypto.randomBytes(32).toString('hex');
}

function validateSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return null;
  
  if (Date.now() > session.expiresAt) {
    sessions.delete(sessionId);
    return null;
  }
  
  return session;
}

// API Routes
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Username and password required' });
  }
  
  if (users.has(username)) {
    return res.status(409).json({ success: false, error: 'Username already exists' });
  }
  
  const hashedPassword = hashPassword(password);
  users.set(username, {
    password: hashedPassword,
    profile: {
      username,
      character: { name: username },
      skills: {
        // Combat Skills
        attack: 1,
        magic: 1,
        ranged: 1,
        blasting: 1,
        defence: 1,
        hitpoints: 10,
        prayer: 1,
        slayer: 1,
        
        // Gathering Skills
        mining: 1,
        fishing: 1,
        woodcutting: 1,
        harvesting: 1,
        
        // Artisan Skills
        smithing: 1,
        cooking: 1,
        fletching: 1,
        apothecary: 1,
        crafting: 1,
        bonecarving: 1,
        painting: 1,
        brewing: 1,
        scribing: 1,
        confectionery: 1,
        masonry: 1,
        tailoring: 1,
        
        // Support Skills
        thieving: 1,
        alchemy: 1,
        creation: 1,
        delivery: 1,
        ranching: 1,
        knowledge: 1,
        candlemaking: 1,
        pottery: 1,
        digging: 1,
        diplomacy: 1,
        apiary: 1,
        taming: 1,
        dracology: 1,
        engineering: 1
      },
      skillsExp: {
        // Combat Skills
        attack: 0,
        magic: 0,
        ranged: 0,
        blasting: 0,
        defence: 0,
        hitpoints: 1154,
        prayer: 0,
        slayer: 0,
        
        // Gathering Skills
        mining: 0,
        fishing: 0,
        woodcutting: 0,
        harvesting: 0,
        
        // Artisan Skills
        smithing: 0,
        cooking: 0,
        fletching: 0,
        apothecary: 0,
        crafting: 0,
        bonecarving: 0,
        painting: 0,
        brewing: 0,
        scribing: 0,
        confectionery: 0,
        masonry: 0,
        tailoring: 0,
        
        // Support Skills
        thieving: 0,
        alchemy: 0,
        creation: 0,
        delivery: 0,
        ranching: 0,
        knowledge: 0,
        candlemaking: 0,
        pottery: 0,
        digging: 0,
        diplomacy: 0,
        apiary: 0,
        taming: 0,
        dracology: 0,
        engineering: 0
      },
      settings: {
        musicVolume: 0.5,
        soundVolume: 0.5,
        difficulty: 'normal',
        playerColor: '#3498db',
        bubbleOpacity: 0.5
      },
      totalLevel: 31,
      combatLevel: 3
    },
    createdAt: Date.now(),
    spawnPosition: { x: 10, y: 10, mapLevel: 'surface' }, // Always spawn new accounts on surface
    savedPosition: null // Explicitly set no saved position for new accounts
  });
  
  saveUsers(); // Save immediately after registration
  console.log(`New user registered: ${username}`);
  
  res.json({ success: true, message: 'User registered successfully' });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  const user = users.get(username);
  if (!user || user.password !== hashPassword(password)) {
    return res.status(401).json({ success: false, error: 'Invalid credentials' });
  }
  
  // Check if user is already logged in (prevent duplicate logins)
  if (connectedPlayers.has(username)) {
    return res.status(409).json({ 
      success: false, 
      error: 'Account is already logged in from another location' 
    });
  }
  
  const sessionId = generateSessionId();
  const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
  
  sessions.set(sessionId, {
    username,
    expiresAt
  });
  
  // Store sessionId in user data for auth checking
  user.sessionId = sessionId;
  
  saveSessions(); // Save sessions after login
  console.log(`User logged in: ${username}`);
  
  // Set session cookie
  res.cookie('sessionId', sessionId, {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    secure: false, // Set to true in production with HTTPS
    sameSite: 'lax'
  });
  
  res.json({
    success: true,
    sessionId,
    profile: user.profile
  });
});

app.post('/api/validate-session', (req, res) => {
  const { sessionId } = req.body;
  const session = validateSession(sessionId);
  
  if (!session) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
  
  const user = users.get(session.username);
  res.json({
    success: true,
    profile: user.profile
  });
});

app.get('/api/world', (req, res) => {
  try {
    const worldPath = path.join(__dirname, 'world.json');
    
    if (fs.existsSync(worldPath)) {
      const worldData = JSON.parse(fs.readFileSync(worldPath, 'utf8'));
      
      // Add player spawn positions to world data
      worldData.playerSpawns = Array.from(users.values()).map(user => ({
        username: user.profile.username,
        position: user.spawnPosition || { x: 10, y: 10 },
        profile: user.profile
      }));
      
      res.json(worldData);
      console.log('World data served to client with player spawns');
    } else {
      res.status(404).json({ error: 'World data not found' });
    }
  } catch (error) {
    console.error('Error serving world data:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/highscores', (req, res) => {
  try {
    const highscores = {};
    
    // All skills from the game (complete list)
    const allSkills = [
      // Combat Skills
      'attack', 'strength', 'stamina', 'magic', 'darkmagic', 'lightmagic', 'ranged', 'gunner', 'blasting', 
      'cardmaster', 'poisoning', 'rogue', 'defence', 'hitpoints', 'prayer', 'sealing', 'slayer', 'dungeoneering',
      // Creature/Spirit Skills
      'taming', 'summoning', 'tidecalling', 'necromancy', 'falconry', 'pacting', 'dracology', 'golemancy', 'puppeteering',
      // Gathering Skills
      'mining', 'fishing', 'harvesting', 'woodcutting', 'hunting', 'mycology', 'diving', 'digging', 'archaeology', 'bugCatching', 'ghostHunting',
      // Artisan Skills
      'smithing', 'crafting', 'engineering', 'cooking', 'confectionery', 'fletching', 'scribing',
      'apothecary', 'brewing', 'painting', 'pottery', 'masonry', 'bonecarving', 'tailoring',
      'candlemaking', 'glassworking', 'toymaking', 'carpentry', 'butchery', 'leatherworking', 'maskMaking', 'shellcraft', 'invention',
      // Magic/Mystical Skills
      'creation', 'enchanting', 'runecrafting', 'alchemy', 'warding', 'astrology', 'dreaming',
      'geomancy', 'windweaving', 'spiritbinding', 'shifting', 'druidism',
      // Support Skills
      'thieving', 'delivery', 'knowledge', 'diplomacy', 'sailing', 'ruling', 'ranching', 'beekeeping', 'aquaculture', 'gardening', 'merchanting', 'barista', 'firemaking', 'bestiary', 'prospecting', 'crystallization', 'agility',
      // Entertainment/Art Skills
      'entertainment', 'barding', 'gravekeeping',
      // Specialized Skills
      'gambling', 'occultism', 'riding', 'exploration', 'mythology', 'artisan', 'snowcraft', 'scrapping'
    ];
    
    // Calculate highscores for each skill (top 25 players)
    allSkills.forEach(skill => {
      const players = [];
      
      for (const [username, userData] of users.entries()) {
        if (userData.profile && userData.profile.skills) {
          const level = userData.profile.skills[skill] || 1;
          players.push({
            username: username,
            level: level
          });
        }
      }
      
      // Sort by level descending and take top 25
      players.sort((a, b) => b.level - a.level);
      highscores[skill] = {
        players: players.slice(0, 25)
      };
    });
    
    // Calculate overall leaderboard (total levels)
    const overallPlayers = [];
    for (const [username, userData] of users.entries()) {
      if (userData.profile && userData.profile.skills) {
        let totalLevel = 0;
        allSkills.forEach(skill => {
          totalLevel += userData.profile.skills[skill] || 1;
        });
        overallPlayers.push({
          username: username,
          level: totalLevel
        });
      }
    }
    
    overallPlayers.sort((a, b) => b.level - a.level);
    highscores.overall = {
      players: overallPlayers.slice(0, 25)
    };
    
    res.json(highscores);
    console.log('Comprehensive highscores data served to client');
  } catch (error) {
    console.error('Error serving highscores data:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/check-auth', (req, res) => {
  try {
    // Check if session cookie exists and is valid
    const sessionId = req.cookies?.sessionId;
    
    if (!sessionId) {
      return res.json({ isAuthenticated: false });
    }
    
    // Check if session exists and is still valid
    const session = sessions.get(sessionId);
    if (!session || Date.now() > session.expiresAt) {
      return res.json({ isAuthenticated: false });
    }
    
    // Find user by session username
    const user = users.get(session.username);
    if (user) {
      res.json({ 
        isAuthenticated: true, 
        username: user.profile.username 
      });
    } else {
      res.json({ isAuthenticated: false });
    }
  } catch (error) {
    console.error('Error checking authentication:', error);
    res.json({ isAuthenticated: false });
  }
});

// Logout endpoint
app.post('/api/logout', (req, res) => {
  try {
    const sessionId = req.cookies?.sessionId;
    
    if (sessionId) {
      // Find session to get username for disconnection
      const session = sessions.get(sessionId);
      if (session) {
        const username = session.username;
        
        // Disconnect WebSocket if connected
        if (connectedPlayers.has(username)) {
          const playerData = connectedPlayers.get(username);
          if (playerData.ws && playerData.ws.readyState === WebSocket.OPEN) {
            playerData.ws.send(JSON.stringify({ 
              type: 'logout', 
              message: 'Logged out successfully' 
            }));
            playerData.ws.close();
          }
          connectedPlayers.delete(username);
          console.log(`🚪 Player ${username} disconnected due to logout`);
        }
        
        // Remove session
        sessions.delete(sessionId);
        saveSessions();
        console.log(`🚪 Session ended for user: ${username}`);
      }
      
      // Clear the session cookie
      res.clearCookie('sessionId', {
        httpOnly: true,
        secure: false,
        sameSite: 'lax'
      });
    }
    
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Error during logout:', error);
    res.status(500).json({ success: false, message: 'Logout failed' });
  }
});

// Create WebSocket server
wss.on('connection', (ws) => {
  console.log('New WebSocket connection');
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      handleWebSocketMessage(ws, data);
    } catch (error) {
      const raw = message.toString();
      if (raw && raw.startsWith('/')) {
        // Treat raw slash-prefixed text as a chat-message command for backward compatibility
        console.warn('⚠️ Received raw command string over WS, coercing to chat-message:', raw);
        handleWebSocketMessage(ws, { type: 'chat-message', message: raw });
      } else if (raw && raw.trim().length > 0) {
        // Treat any other raw text as a regular chat-message
        handleWebSocketMessage(ws, { type: 'chat-message', message: raw });
      } else {
        console.error('Invalid WebSocket message:', error, '\nRaw data:', raw);
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
    }
  });
  
  ws.on('close', () => {
    // Remove player from connected players
    for (const [username, playerData] of connectedPlayers.entries()) {
      if (playerData.ws === ws) {
        connectedPlayers.delete(username);
        
        // Clear any active actions for this player
        activePlayerActions.delete(username);
        
        // Broadcast player disconnect
        broadcastToAll({
          type: 'player-disconnect',
          username
        }, ws);
        console.log(`Player disconnected: ${username}`);
        break;
      }
    }
  });
});

function handleWebSocketMessage(ws, data) {
  switch (data.type) {
    case 'authenticate':
      handleWebSocketAuth(ws, data);
      break;
    case 'player-move':
      handlePlayerMove(ws, data);
      break;
    case 'player-color-update':
      handlePlayerColorUpdate(ws, data);
      break;
    case 'chat-message':
      handleChatMessage(ws, data);
      break;
    case 'save-player-data':
      handleSavePlayerData(ws, data);
      break;
    case 'sync-skills':
      handleSkillsSync(ws, data);
      break;
    case 'sync-inventory':
      handleInventorySync(ws, data);
      break;
    case 'action-bubble-show':
      handleActionBubbleShow(ws, data);
      break;
    case 'action-bubble-hide':
      handleActionBubbleHide(ws, data);
      break;
    case 'resource-depletion-request':
      handleResourceDepleted(ws, data);
      break;
    case 'resource-action-request':
      handleResourceActionRequest(ws, data);
      break;
    case 'resource-respawned':
      handleResourceRespawned(ws, data);
      break;
    case 'floor-item-drop-request':
      handleFloorItemDropRequest(ws, data);
      break;
    case 'floor-item-pickup-request':
      handleFloorItemPickupRequest(ws, data);
      break;
    case 'shop-buy-request':
      handleShopBuyRequest(ws, data);
      break;
    case 'shop-sell-request':
      handleShopSellRequest(ws, data);
      break;
    case 'bank-open-request':
      handleBankOpenRequest(ws, data);
      break;
    case 'bank-deposit-request':
      handleBankDepositRequest(ws, data);
      break;
    case 'bank-withdraw-request':
      handleBankWithdrawRequest(ws, data);
      break;
    case 'bank-sync':
      handleBankSync(ws, data);
      break;
    case 'bank-reorganize-request':
      handleBankReorganizeRequest(ws, data);
      break;
    case 'bank-tab-icon-update':
      handleBankTabIconUpdate(ws, data);
      break;
    case 'request-npc-data':
      sendNPCDataToPlayer(ws);
      break;
    case 'reload-npcs':
      // Only allow reloading NPCs if user is authenticated
      if (ws.username) {
        console.log(`🔄 NPC reload requested by ${ws.username}`);
        reloadNPCs();
      }
      break;
    case 'player-attack-npc':
      if (ws.username) {
        startCombat(ws.username, data.npcId, data.combatStyle);
      }
      break;
    case 'item-consumed':
      handleItemConsumed(ws, data);
      break;
    case 'request-digging-holes-sync':
      handleRequestDiggingHolesSync(ws, data);
      break;
    case 'digging-hole-created':
      handleDiggingHoleCreated(ws, data);
      break;
    case 'digging-hole-removed':
      handleDiggingHoleRemoved(ws, data);
      break;
    case 'sync-hitpoints':
      handleHitpointsSync(ws, data);
      break;
    case 'activity-ping':
      // Lightweight keep-alive / inactivity reset sent by the client every user interaction
      if (ws.username) {
        const playerData = connectedPlayers.get(ws.username);
        if (playerData) {
          playerData.lastActivity = Date.now();
        }
      }
      // No further action required; do not echo anything back to avoid console noise
      break;
    default:
      ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
  }
}

function handleWebSocketAuth(ws, data) {
  const session = validateSession(data.sessionId);
  if (!session) {
    ws.send(JSON.stringify({ type: 'auth-failed', message: 'Invalid session' }));
    return;
  }
  
  const user = users.get(session.username);
  if (!user) {
    ws.send(JSON.stringify({ type: 'auth-failed', message: 'User not found' }));
    return;
  }
  
  // Check if user is already connected (prevent duplicate connections)
  if (connectedPlayers.has(session.username)) {
    const existingPlayerData = connectedPlayers.get(session.username);
    // Disconnect the existing connection
    if (existingPlayerData.ws && existingPlayerData.ws.readyState === WebSocket.OPEN) {
      existingPlayerData.ws.send(JSON.stringify({ 
        type: 'auth-failed', 
        message: 'Account logged in from another location' 
      }));
      existingPlayerData.ws.close();
    }
    // Remove from connected players
    connectedPlayers.delete(session.username);
    console.log(`🔄 Disconnected existing session for ${session.username} - new login detected`);
  }
  
  // Set username on WebSocket connection
  ws.username = session.username;
  
  // Use saved position if available, otherwise use spawn position
  const playerPosition = user.savedPosition || user.spawnPosition || { x: 10, y: 10, mapLevel: 'surface' };
  
  // Ensure map level is set
  if (!playerPosition.mapLevel) {
    playerPosition.mapLevel = 'surface';
  }
  
  console.log(`Player ${session.username} authentication:`, {
    hasSavedPosition: !!user.savedPosition,
    savedPosition: user.savedPosition,
    spawnPosition: user.spawnPosition,
    finalPosition: playerPosition
  });
  
  // Store player data
  connectedPlayers.set(session.username, {
    ws,
    position: playerPosition,
    profile: user.profile,
    maxHP: (user.profile.maxHP ?? user.profile?.skills?.hitpoints ?? 10),
    currentHP: (user.profile.currentHP ?? user.profile?.skills?.hitpoints ?? 10)
  });
  
  // Send successful authentication with complete player data
  ws.send(JSON.stringify({
    type: 'auth-success',
    username: session.username,
    profile: user.profile,
    spawnPosition: playerPosition, // This is where they will actually spawn
    savedPosition: user.savedPosition,
    savedSkills: user.savedSkills || user.profile.skills,
    savedSkillsExp: user.savedSkillsExp || user.profile.skillsExp,
    savedInventory: user.savedInventory || [],
    savedCompletedBooks: user.savedCompletedBooks || [],
    currentHP: (user.profile.currentHP ?? user.profile?.skills?.hitpoints ?? 10),
    maxHP: (user.profile.maxHP ?? user.profile?.skills?.hitpoints ?? 10)
  }));
  
  console.log(`📚 Sent completed books to ${session.username} (${(user.savedCompletedBooks || []).length} books)`);
  
  console.log(`Player authenticated: ${session.username} at position (${playerPosition.x.toFixed(2)}, ${playerPosition.y.toFixed(2)})`);
  
  // Broadcast to all other players that this player connected
  broadcastToAll({
    type: 'player-connect',
    username: session.username,
    position: playerPosition,
    profile: user.profile
  }, ws);
  
  // Send current online players to the new player
  const onlinePlayers = [];
  for (const [username, playerData] of connectedPlayers) {
    if (username !== session.username) {
      onlinePlayers.push({
        username,
        position: playerData.position,
        profile: playerData.profile
      });
    }
  }
  
  if (onlinePlayers.length > 0) {
    ws.send(JSON.stringify({
      type: 'players-online',
      players: onlinePlayers
    }));
  }
  
  // Send current world state (depleted resources) to the new player
  sendWorldStateToPlayer(ws);
  
  // Send current floor items to the new player
  sendFloorItemsToPlayer(ws);
  
  // Send current shop data to the new player
  sendShopDataToPlayer(ws);
  
  // Send current NPC data to the new player
  sendNPCDataToPlayer(ws);
  
  // Broadcast current HP for the newly connected player so others can render health bars immediately
  const currentPlayerData = connectedPlayers.get(session.username);
  broadcastToAll({
    type: 'player-health-update',
    username: session.username,
    currentHP: currentPlayerData.currentHP,
    maxHP: currentPlayerData.maxHP,
    timestamp: Date.now()
  });
  // Also send directly to the newly connected player so their UI shows correct HP immediately
  ws.send(JSON.stringify({
    type: 'player-health-update',
    username: session.username,
    currentHP: currentPlayerData.currentHP,
    maxHP: currentPlayerData.maxHP,
    timestamp: Date.now()
  }));
}

function handlePlayerMove(ws, data) {
  if (!ws.username) return;
  
  const playerData = connectedPlayers.get(ws.username);
  if (playerData) {
    // Check if position actually changed significantly to avoid spamming
    const oldPos = playerData.position;
    const newPos = data.position || data; // Handle both formats
    
    // Validate position data
    if (!newPos || typeof newPos.x !== 'number' || typeof newPos.y !== 'number') {
      console.warn(`⚠️ Invalid position data from ${ws.username}:`, newPos);
      return;
    }
    
    // Check for reasonable position bounds (prevent teleporting to crazy coordinates)
    if (Math.abs(newPos.x) > 10000 || Math.abs(newPos.y) > 10000) {
      console.warn(`⚠️ Rejecting out-of-bounds position from ${ws.username}:`, newPos);
      return;
    }
    
    // Check if position or map level changed significantly
    const mapLevelChanged = oldPos?.mapLevel !== newPos.mapLevel;
    
    // More lenient threshold to ensure better synchronization (reduced from 0.05 to 0.01)
    if (!oldPos || 
        Math.abs(oldPos.x - newPos.x) > 0.01 || 
        Math.abs(oldPos.y - newPos.y) > 0.01 ||
        mapLevelChanged) {
      
      // Update position with timestamp and map level for better synchronization
      playerData.position = {
        x: newPos.x,
        y: newPos.y,
        mapLevel: newPos.mapLevel || 'surface',
        timestamp: Date.now()
      };
      
      // Also save position to user data for persistence
      const user = users.get(ws.username);
      if (user) {
        user.savedPosition = { 
          x: newPos.x, 
          y: newPos.y,
          mapLevel: newPos.mapLevel || 'surface'
        };
        
        // Update profile position as well
        if (!user.profile.position) {
          user.profile.position = {};
        }
        user.profile.position.x = newPos.x;
        user.profile.position.y = newPos.y;
        user.profile.position.mapLevel = newPos.mapLevel || 'surface';
        
        // Auto-save position data periodically (every 10th position update)
        if (Math.random() < 0.1) {
          saveUsers();
        }
      }
      
      // Log map level changes
      if (mapLevelChanged) {
        console.log(`🗺️ Player ${ws.username} changed map level: ${oldPos?.mapLevel || 'surface'} -> ${newPos.mapLevel || 'surface'}`);
      }
      
      // Prepare movement data to broadcast
      const movementData = {
        type: 'player-move',
        username: ws.username,
        position: {
          x: newPos.x,
          y: newPos.y,
          mapLevel: newPos.mapLevel || 'surface'
        },
        profile: playerData.profile, // Include profile so clients can check map level
        timestamp: Date.now()
      };
      
      // If this is a smooth movement with target, include target data
      if (data.target && data.movementType === 'smooth') {
        movementData.target = data.target;
        movementData.movementType = 'smooth';
        console.log(`🎯 Player ${ws.username} moving smoothly from (${newPos.x.toFixed(2)}, ${newPos.y.toFixed(2)}) to (${data.target.x}, ${data.target.y})`);
      } else {
        console.log(`📍 Player ${ws.username} position update: (${newPos.x.toFixed(2)}, ${newPos.y.toFixed(2)})`);
      }
      
      // Broadcast movement to other players - ensure all connected players receive the update
      broadcastToAll(movementData, ws);
      
      // Additional failsafe: also send a periodic position update for consistency
      // This helps prevent desync issues
      if (Math.random() < 0.1) { // 10% chance to send a full sync update
        broadcastToAll({
          type: 'player-position-sync',
          username: ws.username,
          position: newPos,
          timestamp: Date.now()
        }, ws);
      }
    } else {
      // Even for very small movements, occasionally send an update to prevent drift
      if (Math.random() < 0.05) { // 5% chance for micro-movements
        console.log(`🔄 Micro-movement sync for ${ws.username}: (${newPos.x.toFixed(3)}, ${newPos.y.toFixed(3)})`);
        broadcastToAll({
          type: 'player-move',
          username: ws.username,
          position: newPos,
          timestamp: Date.now()
        }, ws);
      }
    }
  }
}

function handlePlayerColorUpdate(ws, data) {
  if (!ws.username) return;
  
  const playerData = connectedPlayers.get(ws.username);
  if (playerData) {
    // Update player's color in their profile
    if (!playerData.profile.settings) {
      playerData.profile.settings = {};
    }
    playerData.profile.settings.playerColor = data.color;

    // Persist to disk so color survives reconnects
    const user = users.get(ws.username);
    if (user) {
      if (!user.profile.settings) user.profile.settings = {};
      user.profile.settings.playerColor = data.color;
      saveUser(ws.username, user);
    }
    
    // Broadcast color update to other players
    broadcastToAll({
      type: 'player-color-update',
      username: ws.username,
      color: data.color,
      profile: playerData.profile
    }, ws);
    
    console.log(`Player ${ws.username} updated color to ${data.color}`);
  }
}

function handleChatMessage(ws, data) {
  if (!ws.username) return;
  
  const user = users.get(ws.username);
  if (!user) return;

  const text = data.message.trim();

  // Commands start with '/'
  if (text.startsWith('/')) {
    const parts = text.slice(1).split(/\s+/);
    const cmd = parts[0].toLowerCase();

    const isMod = user.profile?.role === 'mod';

    const sendSystem = (msg) => {
      ws.send(JSON.stringify({
        type: 'chat-message',
        username: 'SYSTEM',
        message: msg,
        timestamp: new Date().toISOString()
      }));
    };

    if (cmd === 'mod') {
      if (!isMod) return sendSystem('❌ You are not a moderator.');
      const target = parts[1];
      if (!target || !users.has(target)) return sendSystem('Usage: /mod <username>');
      const targetUser = users.get(target);
      if (targetUser.profile.role !== 'mod') {
        targetUser.profile.role = 'mod';
        saveUser(target, targetUser);
        sendSystem(`✅ ${target} is now a moderator.`);
      } else {
        sendSystem(`${target} is already a moderator.`);
      }
      return;
    }

    if (cmd === 'ban') {
      if (!isMod) return sendSystem('❌ You are not a moderator.');
      const [_, rawTarget, amountStr, unit] = parts;
      const targetKey = findUserKey(rawTarget);
      if (!targetKey || !amountStr || !unit) return sendSystem('Usage: /ban <username> <amount> <minutes|hours|days>');
      const amt = parseInt(amountStr);
      if (isNaN(amt) || amt <= 0) return sendSystem('Invalid duration.');
      const mult = unit.startsWith('minute') ? 60000 : unit.startsWith('hour') ? 3600000 : 86400000; // days
      const until = Date.now() + amt * mult;
      const tUser = users.get(targetKey);
      tUser.bannedUntil = until;
      saveUser(targetKey, tUser);
      // Invalidate all sessions for that user
      for (const [sid, sess] of sessions.entries()) {
        if (sess.username === targetKey) sessions.delete(sid);
      }
      saveSessions();
      // Kick if online
      if (connectedPlayers.has(targetKey)) {
        const tWs = connectedPlayers.get(targetKey).ws;
        tWs.send(JSON.stringify({ type: 'logout', message: 'You have been banned.' }));
        tWs.close();
        connectedPlayers.delete(targetKey);
      }
      broadcastToAll({ type:'chat-message', username:'SYSTEM', message:`🔨 ${targetKey} banned by ${ws.username} for ${amt} ${unit}.`, timestamp:new Date().toISOString() });
      return;
    }

    if (cmd === 'give') {
      if (!isMod) return sendSystem('❌ You are not a moderator.');
      // Parse arguments flexibly: /give <username> <itemId> [quantity] [noted]
      const tokens = parts.slice(1); // remove /give
      if (tokens.length < 2) return sendSystem('Usage: /give player item_id [quantity] [noted]');

      const rawTarget = tokens.shift();
      const targetKey = findUserKey(rawTarget);
      if (!targetKey) return sendSystem(`Player '${rawTarget}' not found.`);

      const itemId = tokens.shift();
      if (!itemId) return sendSystem('Missing itemId.');

      let qty = 1;
      let notedFlag = false;

      tokens.forEach(tok => {
        if (tok.toLowerCase() === 'noted') {
          notedFlag = true;
        } else {
          const n = parseInt(tok);
          if (!isNaN(n)) qty = n;
        }
      });

      if (qty <= 0) qty = 1;

      const itemObj = {
        id: itemId,
        quantity: qty,
        ...(notedFlag ? { noted: true, baseItemId: itemId } : {})
      };

      // Persist to target's saved inventory
      const tUser = users.get(targetKey);
      if (!tUser.savedInventory) tUser.savedInventory = [];
      tUser.savedInventory.push(itemObj);

      // Send live update if target online
      if (connectedPlayers.has(targetKey)) {
        const tWs = connectedPlayers.get(targetKey).ws;
        tWs.send(JSON.stringify({ type: 'item-given', item: itemObj }));
      }

      saveUser(targetKey, tUser);
      sendSystem(`✅ Gave ${qty}${notedFlag?' noted':''} ${itemId}${qty!==1?'s':''} to ${targetKey}.`);
      return;
    }

    if (cmd === 'mute') {
      if (!isMod) return sendSystem('❌ You are not a moderator.');
      const [_, rawTarget, amountStr] = parts;
      const targetKey = findUserKey(rawTarget);
      if (!targetKey || !amountStr) return sendSystem('Usage: /mute <username> <minutes>');
      const mins = parseInt(amountStr);
      if (isNaN(mins) || mins <= 0) return sendSystem('Invalid duration.');
      const until = Date.now() + mins * 60000;
      const tUser = users.get(targetKey);
      tUser.mutedUntil = until;
      saveUser(targetKey, tUser);
      sendSystem(`🔇 ${targetKey} muted for ${mins} minute${mins!==1?'s':''}.`);
      if (connectedPlayers.has(targetKey)) {
        const tWs = connectedPlayers.get(targetKey).ws;
        tWs.send(JSON.stringify({ type:'chat-message', username:'SYSTEM', message:`🔇 You have been muted for ${mins} minute${mins!==1?'s':''}.`, timestamp:new Date().toISOString() }));
      }
      return;
    }

    if (cmd === 'unmod') {
      if (!isMod) return sendSystem('❌ You are not a moderator.');
      const targetKey = findUserKey(parts[1]);
      if (!targetKey) return sendSystem('Usage: /unmod <username>');
      const tUser = users.get(targetKey);
      if (tUser.profile.role === 'mod') {
        tUser.profile.role = 'player';
        saveUser(targetKey, tUser);
        sendSystem(`🔓 ${targetKey} is no longer a moderator.`);
      } else {
        sendSystem(`${targetKey} is not a moderator.`);
      }
      return;
    }

    if (cmd === 'unban') {
      if (!isMod) return sendSystem('❌ You are not a moderator.');
      const targetKey = findUserKey(parts[1]);
      if (!targetKey) return sendSystem('Usage: /unban <username>');
      const tUser = users.get(targetKey);
      if (tUser.bannedUntil && Date.now() < tUser.bannedUntil) {
        delete tUser.bannedUntil;
        saveUser(targetKey, tUser);
        sendSystem(`🔓 ${targetKey} ban lifted.`);
      } else {
        sendSystem(`${targetKey} is not currently banned.`);
      }
      return;
    }

    if (cmd === 'unmute') {
      if (!isMod) return sendSystem('❌ You are not a moderator.');
      const targetKey = findUserKey(parts[1]);
      if (!targetKey) return sendSystem('Usage: /unmute <username>');
      const tUser = users.get(targetKey);
      if (tUser.mutedUntil && Date.now() < tUser.mutedUntil) {
        delete tUser.mutedUntil;
        saveUser(targetKey, tUser);
        sendSystem(`🔓 ${targetKey} unmuted.`);
      } else {
        sendSystem(`${targetKey} is not currently muted.`);
      }
      return;
    }

    if (cmd === 'help' || cmd === 'commands') {
      const commonCmds = ['/help','/commands'];
      const modCmds = ['/mod','/unmod','/ban','/unban','/mute','/unmute','/give'];
      let list = [...commonCmds];
      if (isMod) list = list.concat(modCmds);
      sendSystem(`Available commands: ${list.join(', ')}`);
      return;
    }

    // Unknown command
    return sendSystem('Unknown command.');
  }

  // If muted, reject message
  if (user.mutedUntil && Date.now() < user.mutedUntil) {
    const remainingMs = user.mutedUntil - Date.now();
    const mins = Math.floor(remainingMs/60000);
    const secs = Math.floor((remainingMs%60000)/1000);
    ws.send(JSON.stringify({ type:'chat-message', username:'SYSTEM', message:`❌ You are muted (time left: ${mins}m ${secs}s).`, timestamp:new Date().toISOString() }));
    return;
  }

  // Regular chat - broadcast including mod flag
  broadcastToAll({
    type: 'chat-message',
    username: ws.username,
    isModerator: user.profile?.role === 'mod',
    message: text,
    timestamp: new Date().toISOString()
  });
}

function broadcastToAll(message, excludeWs = null) {
  const messageStr = JSON.stringify(message);
  for (const [username, playerData] of connectedPlayers.entries()) {
    if (playerData.ws !== excludeWs && playerData.ws.readyState === WebSocket.OPEN) {
      playerData.ws.send(messageStr);
    }
  }
}

/**
 * Handle saving complete player data (position, skills, inventory)
 */
function handleSavePlayerData(ws, data) {
  if (!ws.username) return;
  
  const user = users.get(ws.username);
  if (!user) return;
  
  console.log(`💾 Saving player data for ${ws.username}`);
  
  // Save position if provided
  if (data.position) {
    user.savedPosition = { x: data.position.x, y: data.position.y };
    console.log(`📍 Saved position: (${data.position.x.toFixed(2)}, ${data.position.y.toFixed(2)})`);
  }
  
  // Save skills if provided
  if (data.skills) {
    // Convert skills to numeric format to ensure compatibility
    const numericSkills = {};
    for (const skillName in data.skills) {
      const skillValue = data.skills[skillName];
      if (typeof skillValue === 'number') {
        numericSkills[skillName] = skillValue;
      } else if (skillValue && typeof skillValue === 'object' && typeof skillValue.level === 'number') {
        numericSkills[skillName] = skillValue.level;
      } else {
        numericSkills[skillName] = skillName === 'hitpoints' ? 10 : 1; // Default values
      }
    }
    
    // Store skills in the format the client expects (numbers for levels)
    user.savedSkills = { ...numericSkills };
    user.profile.skills = { ...numericSkills };
    
    // Also save experience if provided
    if (data.skillsExp) {
      user.savedSkillsExp = { ...data.skillsExp };
      user.profile.skillsExp = { ...data.skillsExp };
    }
    
    // Calculate and store totals using the numeric format
    const calculatedTotal = calculateTotalLevel(numericSkills);
    const calculatedCombat = calculateCombatLevel(numericSkills);
    user.profile.totalLevel = data.totalLevel || calculatedTotal;
    user.profile.combatLevel = data.combatLevel || calculatedCombat;
    console.log(`🎯 Saved skills (Total Level: ${user.profile.totalLevel}, Combat Level: ${user.profile.combatLevel})`);
    
    // Log experience data if it was saved
    if (data.skillsExp) {
      console.log(`📊 Saved skill experience data for ${ws.username}`);
    }
  }
  
  // Save inventory if provided
  if (data.inventory) {
    user.savedInventory = data.inventory;
    const itemCount = data.inventory.filter(item => item).length;
    console.log(`🎒 Saved inventory (${itemCount} items)`);
  }
  
  // Save completed books if provided
  if (data.completedBooks) {
    user.savedCompletedBooks = data.completedBooks;
    user.profile.completedBooks = data.completedBooks;
    console.log(`📚 Saved completed books (${data.completedBooks.length} books)`);
  }
  
  // Save settings if provided (e.g. autoLogoutMinutes, audio levels, etc.)
  if (data.settings && typeof data.settings === 'object') {
    if (!user.profile.settings) {
      user.profile.settings = {};
    }
    user.profile.settings = { ...user.profile.settings, ...data.settings };
    console.log('⚙️  Saved settings update:', data.settings);
  }
  
  // Save to disk
  saveUsers();
  
  // Send confirmation back to client
  ws.send(JSON.stringify({
    type: 'player-data-saved',
    timestamp: Date.now()
  }));
}

/**
 * Handle skills synchronization
 */
function handleSkillsSync(ws, data) {
  if (!ws.username) return;
  
  const user = users.get(ws.username);
  if (!user) return;
  
  if (data.skills) {
    console.log(`🎯 Syncing skills for ${ws.username}`);
    
    // Convert skills to numeric format to ensure compatibility
    const numericSkills = {};
    for (const skillName in data.skills) {
      const skillValue = data.skills[skillName];
      if (typeof skillValue === 'number') {
        numericSkills[skillName] = skillValue;
      } else if (skillValue && typeof skillValue === 'object' && typeof skillValue.level === 'number') {
        numericSkills[skillName] = skillValue.level;
      } else {
        numericSkills[skillName] = skillName === 'hitpoints' ? 10 : 1; // Default values
      }
    }
    
    // Store skills in the client's expected format (numbers)
    user.savedSkills = { ...numericSkills };
    user.profile.skills = { ...numericSkills };
    
    // Also save experience if provided
    if (data.skillsExp) {
      user.savedSkillsExp = { ...data.skillsExp };
      user.profile.skillsExp = { ...data.skillsExp };
    }
    
    // Calculate totals using the numeric skills format
    const calculatedTotal = calculateTotalLevel(numericSkills);
    const calculatedCombat = calculateCombatLevel(numericSkills);
    
    user.profile.totalLevel = data.totalLevel || calculatedTotal;
    user.profile.combatLevel = data.combatLevel || calculatedCombat;
    
    // Save to disk
    saveUsers();
    
    // Broadcast updated profile to other players
    broadcastToAll({
      type: 'player-profile-update',
      username: ws.username,
      profile: user.profile
    }, ws);
    
    console.log(`✅ Skills synced for ${ws.username} (Total: ${user.profile.totalLevel}, Combat: ${user.profile.combatLevel})`);
  }
}

/**
 * Handle inventory synchronization
 */
function handleInventorySync(ws, data) {
  if (!ws.username) return;
  
  const user = users.get(ws.username);
  if (!user) return;
  
  if (data.inventory) {
    console.log(`🎒 Syncing inventory for ${ws.username}`);
    
    // Debug: Check for items with custom properties
    const customItems = data.inventory.filter(item => item && (item.author || item.authorName || item.name !== getItemDefinition(item.id)?.name));
    if (customItems.length > 0) {
      console.log(`🎒 [SYNC DEBUG] Found ${customItems.length} items with custom properties:`, customItems.map(item => ({
        id: item.id,
        name: item.name,
        author: item.author,
        authorName: item.authorName
      })));
    }
    
    user.savedInventory = data.inventory;
    
    // Save to disk
    saveUsers();
    
    const itemCount = data.inventory.filter(item => item).length;
    console.log(`✅ Inventory synced for ${ws.username} (${itemCount} items)`);
  }
}

/**
 * Handle action bubble show synchronization
 */
function handleActionBubbleShow(ws, data) {
  if (!ws.username) return;
  
  const { skillName, customText, customIcon } = data;
  
  console.log(`🎭 ${ws.username} is showing action bubble: ${skillName} ${customText || ''}`);
  
  // Broadcast to all other players that this player is showing an action bubble
  broadcastToAll({
    type: 'player-action-bubble-show',
    username: ws.username,
    skillName: skillName,
    customText: customText,
    customIcon: customIcon,
    timestamp: Date.now()
  }, ws);
}

/**
 * Handle action bubble hide synchronization
 */
function handleActionBubbleHide(ws, data) {
  if (!ws.username) return;
  
  console.log(`🎭 ${ws.username} is hiding action bubble`);
  
  // Broadcast to all other players that this player is hiding their action bubble
  broadcastToAll({
    type: 'player-action-bubble-hide',
    username: ws.username,
    timestamp: Date.now()
  }, ws);
}

/**
 * Calculate total level from skills
 */
function calculateTotalLevel(skills) {
  if (!skills || typeof skills !== 'object') return 0;
  
  let total = 0;
  for (const skillName in skills) {
    if (!skills.hasOwnProperty(skillName)) continue;
    
    const skillValue = skills[skillName];
    let level = 0;
    
    // Handle numeric skills format (what the client expects and sends)
    if (typeof skillValue === 'number' && !isNaN(skillValue) && skillValue > 0) {
      level = skillValue;
    }
    // Handle object format for backward compatibility
    else if (skillValue && typeof skillValue === 'object' && typeof skillValue.level === 'number') {
      level = skillValue.level;
    }
    
    if (level > 0) {
      total += level;
    }
  }
  
  return total;
}

/**
 * Calculate combat level from skills
 */
function calculateCombatLevel(skills) {
  if (!skills || typeof skills !== 'object') return 3;
  
  // Helper function to safely get skill level
  function getSkillLevel(skill) {
    if (typeof skill === 'number') return skill;
    if (skill && typeof skill === 'object' && typeof skill.level === 'number') return skill.level;
    return 1;
  }
  
  const attack = getSkillLevel(skills.attack) || 1;
  const strength = getSkillLevel(skills.strength) || 1;
  const defence = getSkillLevel(skills.defence) || 1;
  const hitpoints = getSkillLevel(skills.hitpoints) || 10;
  const ranged = getSkillLevel(skills.ranged) || 1;
  const prayer = getSkillLevel(skills.prayer) || 1;
  const magic = getSkillLevel(skills.magic) || 1;
  
  // OSRS combat level formula
  const baseCombat = 0.25 * (defence + hitpoints + Math.floor(prayer / 2));
  const meleeCombat = 0.325 * (attack + strength);
  const rangedCombat = 0.325 * (ranged + Math.floor(ranged / 2));
  const magicCombat = 0.325 * (magic + Math.floor(magic / 2));
  
  const combatLevel = baseCombat + Math.max(meleeCombat, rangedCombat, magicCombat);
  
  return Math.max(3, Math.floor(combatLevel));
}

/**
 * Handle resource action request (validate if player can start mining/woodcutting)
 */
function handleResourceActionRequest(ws, data) {
  if (!ws.username) return;
  
  const { resourceType, x, y, action } = data;
  
  if (!resourceType || typeof x !== 'number' || typeof y !== 'number' || !action) {
    console.warn(`⚠️ Invalid resource action request from ${ws.username}:`, data);
    return;
  }
  
  // Check if player already has an active action
  const existingAction = activePlayerActions.get(ws.username);
  const now = Date.now();
  
  // If player has an active action for the same resource within the last 2 seconds, ignore the request
  if (existingAction && 
      existingAction.resourceType === resourceType && 
      existingAction.x === x && 
      existingAction.y === y &&
      (now - existingAction.startTime) < 2000) {
    console.log(`🚫 ${ws.username} already has active ${action} for ${resourceType} at (${x}, ${y}) - ignoring duplicate request`);
    return; // Silently ignore duplicate requests
  }
  
  // If player has a different action or it's been more than 2 seconds, allow overwriting
  if (existingAction) {
    console.log(`🔄 ${ws.username} switching from ${existingAction.action} to ${action} - overwriting previous action`);
    // Send cancellation message for the previous action only if it's different
    if (existingAction.resourceType !== resourceType || existingAction.x !== x || existingAction.y !== y) {
      ws.send(JSON.stringify({
        type: 'resource-action-cancelled',
        previousAction: existingAction,
        reason: 'Starting new action'
      }));
    }
  }
  
  const resourceKey = `${x},${y}`;
  const resource = worldResources.get(resourceKey);
  const resourceDef = RESOURCE_DEFINITIONS[resourceType];
  
  if (!resourceDef) {
    console.warn(`⚠️ Unknown resource type: ${resourceType}`);
    ws.send(JSON.stringify({
      type: 'resource-action-denied',
      resourceType: resourceType,
      x: x,
      y: y,
      action: action,
      reason: 'Unknown resource type'
    }));
    return;
  }
  
  // If resource doesn't exist in our tracking, initialize it as available
  if (!resource) {
    initializeResource(resourceType, x, y);
  }
  
  const currentResource = worldResources.get(resourceKey);
  
  // Check if resource is available for the action
  if (!currentResource.available) {
    console.log(`⚠️ ${ws.username} tried to ${action} depleted ${resourceType} at (${x}, ${y}) - denied`);
    ws.send(JSON.stringify({
      type: 'resource-action-denied',
      resourceType: resourceType,
      x: x,
      y: y,
      action: action,
      reason: 'Resource is currently depleted',
      depletedBy: currentResource.depletedBy,
      depletedAt: currentResource.depletedAt
    }));
    return;
  }
  
  // Track this action as active for the player (overwriting any previous action)
  activePlayerActions.set(ws.username, {
    action: action,
    resourceType: resourceType,
    x: x,
    y: y,
    startTime: now
  });
  
  // Resource is available - allow the action
  console.log(`✅ ${ws.username} can ${action} ${resourceType} at (${x}, ${y})`);
  ws.send(JSON.stringify({
    type: 'resource-action-approved',
    resourceType: resourceType,
    x: x,
    y: y,
    action: action
  }));
}

/**
 * Generate a unique floor item ID
 */
function generateFloorItemId() {
  return `floor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a floor item on the server
 */
function createServerFloorItem(item, x, y, droppedBy) {
  const floorItemId = generateFloorItemId();
  const positionKey = `${x},${y}`;
  
  const floorItem = {
    id: floorItemId,
    item: { ...item }, // Copy the item to avoid reference issues
    x: x,
    y: y,
    spawnTime: Date.now(),
    droppedBy: droppedBy
  };
  
  // Store in main floor items map
  worldFloorItems.set(floorItemId, floorItem);
  
  // Store in position-based map for quick lookup
  if (!floorItemsByPosition.has(positionKey)) {
    floorItemsByPosition.set(positionKey, []);
  }
  floorItemsByPosition.get(positionKey).push(floorItem);
  
  // Only schedule despawn for player-dropped items, not system spawns
  if (droppedBy !== 'SYSTEM_SPAWN') {
    setTimeout(() => {
      despawnServerFloorItem(floorItemId, 'timeout');
    }, FLOOR_ITEM_DESPAWN_TIME);
  }
  
  console.log(`🎒 Created floor item ${item.id} x${item.quantity || 1} at (${x}, ${y}) by ${droppedBy} with ID: ${floorItemId}`);
  
  return floorItem;
}

/**
 * Remove a floor item from the server
 */
function removeServerFloorItem(floorItemId) {
  const floorItem = worldFloorItems.get(floorItemId);
  if (!floorItem) return false;
  
  // Remove from main map
  worldFloorItems.delete(floorItemId);
  
  // Remove from position map
  const positionKey = `${floorItem.x},${floorItem.y}`;
  const itemsAtPosition = floorItemsByPosition.get(positionKey);
  if (itemsAtPosition) {
    const index = itemsAtPosition.findIndex(item => item.id === floorItemId);
    if (index !== -1) {
      itemsAtPosition.splice(index, 1);
      
      // Clean up empty position arrays
      if (itemsAtPosition.length === 0) {
        floorItemsByPosition.delete(positionKey);
      }
    }
  }
  
  console.log(`🗑️ Removed floor item ${floorItemId} from server`);
  return true;
}

/**
 * Despawn a floor item and notify players
 */
function despawnServerFloorItem(floorItemId, reason = 'unknown') {
  const floorItem = worldFloorItems.get(floorItemId);
  if (!floorItem) return;
  
  console.log(`⏰ Despawning floor item ${floorItemId} (reason: ${reason})`);
  
  // Remove from server state
  removeServerFloorItem(floorItemId);
  
  // Broadcast despawn to all players
  broadcastToAll({
    type: 'floor-item-despawned',
    floorItemId: floorItemId,
    reason: reason,
    timestamp: Date.now()
  });
}

/**
 * Get floor items at a specific position
 */
function getServerFloorItemsAt(x, y) {
  const positionKey = `${x},${y}`;
  return floorItemsByPosition.get(positionKey) || [];
}

/**
 * Validate player distance to floor item
 */
function validatePlayerDistance(username, x, y) {
  const playerData = connectedPlayers.get(username);
  if (!playerData) return false;
  
  const playerPos = playerData.position;
  const playerX = Math.floor(playerPos.x);
  const playerY = Math.floor(playerPos.y);
  const itemX = Math.floor(x);
  const itemY = Math.floor(y);
  
  const distance = Math.abs(playerX - itemX) + Math.abs(playerY - itemY);
  return distance <= MAX_PICKUP_DISTANCE;
}

/**
 * Check if items can stack together
 */
function canItemsStack(item1, item2) {
  console.log(`🔍 Stacking check: item1=${item1.id} (noted: ${item1.noted}), item2=${item2.id} (noted: ${item2.noted})`);
  
  // Basic stackability check - items must have same ID
  if (item1.id !== item2.id) {
    console.log(`❌ Different IDs: ${item1.id} !== ${item2.id}`);
    return false;
  }
  
  // For noted items, both must be noted with same base ID
  if (item1.noted !== item2.noted) {
    console.log(`❌ Different noted status: ${item1.noted} !== ${item2.noted}`);
    return false;
  }
  
  // Check for custom properties - items with different custom properties shouldn't stack
  const hasCustomProps1 = item1.author || item1.authorName || (item1.name && item1.name !== getItemDefinition(item1.id)?.name);
  const hasCustomProps2 = item2.author || item2.authorName || (item2.name && item2.name !== getItemDefinition(item2.id)?.name);
  
  if (hasCustomProps1 || hasCustomProps2) {
    // Only stack if both have identical custom properties
    if (hasCustomProps1 && hasCustomProps2 && 
        item1.author === item2.author && 
        item1.authorName === item2.authorName && 
        item1.name === item2.name) {
      console.log(`✅ Items have identical custom properties - allowing stack`);
    } else {
      console.log(`❌ Items have different or mismatched custom properties`);
      return false;
    }
  }
  
  // Noted items are always stackable (even if the base item isn't)
  if (item1.noted && item2.noted) {
    console.log(`✅ Both items are noted - allowing stack`);
    return true;
  }
  
  // Use shared item definitions to check stackability
  const itemDef = getItemDefinition(item1.id);
  const isStackable = itemDef?.stackable === true;
  
  console.log(`📝 Stack decision for ${item1.id}: stackable=${isStackable} (from shared definitions)`);
  
  return isStackable;
}

/**
 * Try to stack item with existing floor items at position
 */
function tryStackWithExistingItems(item, x, y) {
  const existingItems = getServerFloorItemsAt(x, y);
  
  for (const floorItem of existingItems) {
    if (canItemsStack(item, floorItem.item)) {
      // Stack with existing item
      floorItem.item.quantity = (floorItem.item.quantity || 1) + (item.quantity || 1);
      console.log(`📦 Stacked ${item.quantity || 1} ${item.id} with existing stack at (${x}, ${y}). New total: ${floorItem.item.quantity}`);
      return floorItem;
    }
  }
  
  return null;
}

/**
 * Send current floor items to a newly connected player
 */
function sendFloorItemsToPlayer(ws) {
  if (!ws.username || ws.readyState !== WebSocket.OPEN) return;
  
  const allFloorItems = Array.from(worldFloorItems.values()).map(floorItem => ({
    id: floorItem.id,
    item: floorItem.item,
    x: floorItem.x,
    y: floorItem.y,
    spawnTime: floorItem.spawnTime,
    droppedBy: floorItem.droppedBy
  }));
  
  ws.send(JSON.stringify({
    type: 'floor-items-sync',
    floorItems: allFloorItems,
    timestamp: Date.now()
  }));
  
  console.log(`🌍 Sent ${allFloorItems.length} floor items to ${ws.username}`);
}

/**
 * Handle floor item drop request
 */
function handleFloorItemDropRequest(ws, data) {
  if (!ws.username) return;
  
  const { item, x, y, slotIndex } = data;
  
  if (!item || typeof x !== 'number' || typeof y !== 'number' || typeof slotIndex !== 'number') {
    console.warn(`⚠️ Invalid floor item drop request from ${ws.username}:`, data);
    ws.send(JSON.stringify({
      type: 'floor-item-drop-denied',
      reason: 'Invalid request parameters'
    }));
    return;
  }
  
  // Validate player distance to drop location
  if (!validatePlayerDistance(ws.username, x, y)) {
    console.log(`🚫 ${ws.username} tried to drop item too far away at (${x}, ${y})`);
    ws.send(JSON.stringify({
      type: 'floor-item-drop-denied',
      reason: 'Drop location too far away'
    }));
    return;
  }
  
  // Try to stack with existing items first
  const stackedItem = tryStackWithExistingItems(item, x, y);
  
  if (stackedItem) {
    // Item was stacked with existing item
    console.log(`✅ ${ws.username} stacked ${item.quantity || 1} ${item.id} at (${x}, ${y})`);
    
    // Send confirmation to the dropping player
    ws.send(JSON.stringify({
      type: 'floor-item-drop-confirmed',
      floorItemId: stackedItem.id,
      stacked: true,
      slotIndex: slotIndex
    }));
    
    // Broadcast updated floor item to all players including the dropper
    broadcastToAll({
      type: 'floor-item-updated',
      floorItem: {
        id: stackedItem.id,
        item: stackedItem.item,
        x: stackedItem.x,
        y: stackedItem.y,
        spawnTime: stackedItem.spawnTime,
        droppedBy: stackedItem.droppedBy
      },
      updatedBy: ws.username,
      timestamp: Date.now()
    }); // Removed ws exclusion so dropping player sees the update
  } else {
    // Create new floor item
    const floorItem = createServerFloorItem(item, x, y, ws.username);
    
    console.log(`✅ ${ws.username} dropped ${item.quantity || 1} ${item.id} at (${x}, ${y})`);
    
    // Send confirmation to the dropping player
    ws.send(JSON.stringify({
      type: 'floor-item-drop-confirmed',
      floorItemId: floorItem.id,
      stacked: false,
      slotIndex: slotIndex
    }));
    
    // Broadcast new floor item to all players including the dropper
    broadcastToAll({
      type: 'floor-item-created',
      floorItem: {
        id: floorItem.id,
        item: floorItem.item,
        x: floorItem.x,
        y: floorItem.y,
        spawnTime: floorItem.spawnTime,
        droppedBy: floorItem.droppedBy
      },
      droppedBy: ws.username,
      timestamp: Date.now()
    }); // Removed ws exclusion so dropping player sees their own drop
  }
}

/**
 * Handle floor item pickup request
 */
function handleFloorItemPickupRequest(ws, data) {
  if (!ws.username) return;
  
  const { floorItemId } = data;
  
  if (!floorItemId) {
    console.warn(`⚠️ Invalid floor item pickup request from ${ws.username}:`, data);
    ws.send(JSON.stringify({
      type: 'floor-item-pickup-denied',
      reason: 'Invalid floor item ID'
    }));
    return;
  }
  
  // Check if floor item exists
  const floorItem = worldFloorItems.get(floorItemId);
  if (!floorItem) {
    console.warn(`⚠️ ${ws.username} tried to pickup non-existent floor item: ${floorItemId}`);
    ws.send(JSON.stringify({
      type: 'floor-item-pickup-denied',
      reason: 'Floor item does not exist'
    }));
    return;
  }
  
  // Validate player distance to item
  if (!validatePlayerDistance(ws.username, floorItem.x, floorItem.y)) {
    console.log(`🚫 ${ws.username} tried to pickup item ${floorItemId} from too far away`);
    ws.send(JSON.stringify({
      type: 'floor-item-pickup-denied',
      reason: 'Too far away from item'
    }));
    return;
  }
  
  // Item exists and player is close enough - process pickup
  console.log(`✅ ${ws.username} picked up ${floorItem.item.quantity || 1} ${floorItem.item.id} from (${floorItem.x}, ${floorItem.y})`);
  
  // Remove from server state
  removeServerFloorItem(floorItemId);
  
  // Send confirmation to the picking player
  ws.send(JSON.stringify({
    type: 'floor-item-pickup-confirmed',
    floorItemId: floorItemId,
    item: floorItem.item
  }));
  
  // Broadcast pickup to all other players
  broadcastToAll({
    type: 'floor-item-picked-up',
    floorItemId: floorItemId,
    pickedUpBy: ws.username,
    timestamp: Date.now()
  }, ws);
}

// Bank System Configuration
const MAX_TABS = 9;
const SLOTS_PER_TAB = 126; // Updated to match client
const TOTAL_BANK_SIZE = SLOTS_PER_TAB * MAX_TABS;

/**
 * Get item definition (basic implementation for server-side validation)
 */
  function getItemDefinition(itemId) {
  // Use the shared item definitions that match the client exactly
  const itemDef = itemDefinitions[itemId];
  
  if (itemDef) {
    // Return the full definition from shared file
    return itemDef;
  }
  
  // Default for unknown items
  return { 
    id: itemId,
    name: itemId,
    stackable: false,
    value: 0,
    buyable: false
  };
}

/**
 * Handle bank open request
 */
function handleBankOpenRequest(ws, data) {
  if (!ws.username) return;
  
  console.log(`🏦 ${ws.username} is opening bank`);
  
  const user = users.get(ws.username);
  if (!user) {
    ws.send(JSON.stringify({
      type: 'bank-open-denied',
      reason: 'User data not found'
    }));
    return;
  }
  
  // Initialize bank if it doesn't exist
  if (!user.savedBank) {
    user.savedBank = new Array(TOTAL_BANK_SIZE).fill(null);
    console.log(`🏦 Initialized new bank for ${ws.username} with ${TOTAL_BANK_SIZE} slots`);
  }
  
  // Ensure bank has enough slots for tab system
  while (user.savedBank.length < TOTAL_BANK_SIZE) {
    user.savedBank.push(null);
  }
  
  // Initialize bank tabs if they don't exist
  if (!user.savedBankTabs) {
    user.savedBankTabs = Array.from({ length: MAX_TABS }, (_, i) => ({
      id: i,
      name: i === 0 ? 'Main' : `Tab ${i + 1}`,
      icon: i === 0 ? '📦' : '📁',
      customIcon: null
    }));
    console.log(`🏦 Initialized ${MAX_TABS} bank tabs for ${ws.username}`);
  }
  
  // Send bank data to client
  ws.send(JSON.stringify({
    type: 'bank-open-confirmed',
    bankData: user.savedBank,
    tabData: user.savedBankTabs,
    timestamp: Date.now()
  }));
  
  console.log(`🏦 Sent bank data to ${ws.username}: ${user.savedBank.filter(item => item).length} items, ${MAX_TABS} tabs`);
}

/**
 * Handle bank deposit request
 */
function handleBankDepositRequest(ws, data) {
  if (!ws.username) return;
  
  const user = users.get(ws.username);
  if (!user) {
    ws.send(JSON.stringify({
      type: 'bank-deposit-denied',
      reason: 'User data not found'
    }));
    return;
  }
  
  const { inventorySlot, item, quantity = 1, currentTab = 0 } = data;
  
  console.log(`🏦 ${ws.username} depositing ${item.id} x${quantity} from inventory slot ${inventorySlot} to tab ${currentTab}`);
  
  // Validate inventory slot
  if (inventorySlot < 0 || inventorySlot >= user.savedInventory.length || !user.savedInventory[inventorySlot]) {
    ws.send(JSON.stringify({
      type: 'bank-deposit-denied',
      reason: 'Invalid inventory slot or no item to deposit'
    }));
    return;
  }
  
  const depositItem = user.savedInventory[inventorySlot];
  if (depositItem.id !== item.id) {
    ws.send(JSON.stringify({
      type: 'bank-deposit-denied',
      reason: 'Item mismatch'
    }));
    return;
  }
  
  // Use updated constants to match client
  const SLOTS_PER_TAB = 126;
  
  // FIRST: Search for existing stacks across ALL tabs (not just current tab)
  let existingBankSlot = -1;
  for (let i = 0; i < user.savedBank.length; i++) {
    const bankItem = user.savedBank[i];
    if (bankItem && bankItem.id === depositItem.id && !bankItem.noted) {
      existingBankSlot = i;
      break;
    }
  }
  
  if (existingBankSlot !== -1) {
    // Add to existing stack (anywhere in bank)
    // For special items (unfinished books, authored items), we should not stack them since each has unique properties
    if (depositItem.type === 'unfinished_book' || depositItem.author || depositItem.authorName || Object.keys(depositItem).length > 3) {
      console.log(`🏦 Special item found in bank but not stacking due to unique custom properties`);
      existingBankSlot = -1; // Force creation of new slot
    } else {
      user.savedBank[existingBankSlot].quantity = (user.savedBank[existingBankSlot].quantity || 1) + quantity;
      console.log(`🏦 Added to existing bank stack: ${user.savedBank[existingBankSlot].quantity} (slot ${existingBankSlot}, tab ${Math.floor(existingBankSlot / SLOTS_PER_TAB)})`);
    }
  }
  
  if (existingBankSlot === -1) {
    // No existing stack found - prioritize current tab for new items
    const startSlot = currentTab * SLOTS_PER_TAB;
    const endSlot = startSlot + SLOTS_PER_TAB;
    let emptyBankSlot = -1;
    
    // First, check current tab for empty slots
    for (let i = startSlot; i < endSlot; i++) {
      if (!user.savedBank[i]) {
        emptyBankSlot = i;
        break;
      }
    }
    
    // If no space in current tab, find any empty slot in other tabs
    if (emptyBankSlot === -1) {
      emptyBankSlot = user.savedBank.findIndex(slot => !slot);
    }
    
    if (emptyBankSlot !== -1) {
      // Create new item - preserve all properties for unfinished books, basic properties for others
      if (depositItem.type === 'unfinished_book' || depositItem.author || depositItem.authorName || Object.keys(depositItem).length > 3) {
        // Preserve all custom properties for special items (unfinished books, authored books, etc.)
        user.savedBank[emptyBankSlot] = {
          ...depositItem,  // Keep all custom properties like pagesCompleted, author, etc.
          quantity: quantity,
          noted: false  // Always deposit as regular items, not noted
        };
        console.log(`🏦 Depositing special item with preserved custom properties`);
      } else {
        // Regular items - only preserve basic properties
        user.savedBank[emptyBankSlot] = {
          id: depositItem.id,
          quantity: quantity,
          noted: false  // Always deposit as regular items, not noted
        };
        console.log(`🏦 Depositing as regular item (noted attribute removed if present)`);
      }
      console.log(`🏦 Deposited to new bank slot ${emptyBankSlot} (tab ${Math.floor(emptyBankSlot / SLOTS_PER_TAB)})`);
    } else {
      ws.send(JSON.stringify({
        type: 'bank-deposit-denied',
        reason: 'Bank is full'
      }));
      return;
    }
  }
  
  // Remove from inventory
  if ((depositItem.quantity || 1) <= quantity) {
    user.savedInventory[inventorySlot] = null;
  } else {
    user.savedInventory[inventorySlot].quantity -= quantity;
  }
  
  console.log(`✅ ${ws.username} deposit completed`);
  
  // Send confirmation with updated data
  ws.send(JSON.stringify({
    type: 'bank-deposit-confirmed',
    item: depositItem,
    quantity: quantity,
    updatedBank: user.savedBank,
    updatedInventory: user.savedInventory
  }));
}

/**
 * Consolidate identical items in user's bank by merging them into single stacks
 * This prevents fragmented stacks and keeps the bank organized
 */
function consolidateUserBank(user) {
  console.log(`🏦 Starting bank consolidation for ${user.username || 'unknown user'}...`);
  
  if (!user.savedBank) return;
  
  const itemStacks = new Map(); // Map of stackKey -> {totalQuantity, slots: [slot indices]}
  
  // First pass: catalog all items and their locations
  for (let i = 0; i < user.savedBank.length; i++) {
    const item = user.savedBank[i];
    if (item) {
      // Create a unique key for stacking (includes noted status)
      const stackKey = `${item.id}_${!!item.noted}`;
      
      if (!itemStacks.has(stackKey)) {
        itemStacks.set(stackKey, {
          item: { ...item },
          totalQuantity: 0,
          slots: []
        });
      }
      
      const stack = itemStacks.get(stackKey);
      stack.totalQuantity += (item.quantity || 1);
      stack.slots.push(i);
    }
  }
  
  let consolidationsMade = 0;
  
  // Second pass: consolidate stacks that have multiple slots
  for (const [stackKey, stackData] of itemStacks) {
    if (stackData.slots.length > 1) {
      console.log(`🏦 Consolidating ${stackData.slots.length} stacks of ${stackData.item.id} (total: ${stackData.totalQuantity}) for ${user.username}`);
      
      // Keep the first slot, clear the others
      const keepSlot = stackData.slots[0];
      
      // Update the kept slot with the total quantity
      user.savedBank[keepSlot] = {
        ...stackData.item,
        quantity: stackData.totalQuantity
      };
      
      // Clear all other slots
      for (let i = 1; i < stackData.slots.length; i++) {
        user.savedBank[stackData.slots[i]] = null;
      }
      
      consolidationsMade++;
    }
  }
  
  if (consolidationsMade > 0) {
    console.log(`🏦 Bank consolidation complete for ${user.username}: merged ${consolidationsMade} item types`);
  }
  
  return consolidationsMade > 0;
}

/**
 * Handle bank withdraw request
 */
function handleBankWithdrawRequest(ws, data) {
  if (!ws.username) return;
  
  const user = users.get(ws.username);
  if (!user) {
    ws.send(JSON.stringify({
      type: 'bank-withdraw-denied',
      reason: 'User data not found'
    }));
    return;
  }
  
  const { bankSlot, item, quantity = 1, noteMode = false } = data;
  
  console.log(`🏦 ${ws.username} withdrawing ${item.id} x${quantity} from bank slot ${bankSlot}${noteMode ? ' (note mode)' : ''}`);
  
  // Validate bank slot
  if (bankSlot < 0 || bankSlot >= user.savedBank.length || !user.savedBank[bankSlot]) {
    ws.send(JSON.stringify({
      type: 'bank-withdraw-denied',
      reason: 'Invalid bank slot or no item in slot'
    }));
    return;
  }
  
  const bankItem = user.savedBank[bankSlot];
  
  // Validate item matches and has enough quantity
  if (bankItem.id !== item.id || (bankItem.quantity || 1) < quantity) {
    ws.send(JSON.stringify({
      type: 'bank-withdraw-denied',
      reason: 'Item mismatch or insufficient quantity'
    }));
    return;
  }
  
  // Get item definition to check if it's stackable
  const itemDef = getItemDefinition(item.id);
  const isStackable = itemDef && itemDef.stackable;
  
  console.log(`🏦 [SERVER-DETAILED] Item analysis:`, {
    itemId: item.id,
    itemDef: itemDef,
    isStackable: isStackable,
    quantity: quantity,
    noteMode: noteMode
  });
  
  // Create the item to withdraw
  const withdrawnItem = {
    id: item.id,
    quantity: quantity
  };
  
  // Apply note mode if enabled and item can be noted (non-stackable, non-book items only)
  
  // Check if item is a book: either has category 'books' OR is an unfinished book from scribing
  const isDefinedBook = itemDef && itemDef.category === 'books';
  const isUnfinishedBook = item.id.startsWith('unfinished_') || item.id.includes('unfinished');
  const isBook = isDefinedBook || isUnfinishedBook;
  
  // Can only be noted if it has a valid definition AND is not stackable AND is not a book
  const canBeNoted = itemDef && !isStackable && !isBook;
  
  if (noteMode && canBeNoted) {
    withdrawnItem.noted = true;
    console.log(`🏦 Item will be noted: ${item.id}`);
  } else if (noteMode && !canBeNoted) {
    // Note mode requested but item can't be noted
    if (isStackable) {
      console.log(`🏦 Cannot note stackable item: ${item.id}`);
    } else if (isBook) {
      console.log(`🏦 Cannot note book item: ${item.id}`);
    }
  }
  
  // Check if there's enough inventory space
  let targetInventorySlot = -1;
  let canWithdraw = false;
  
  if (isStackable || withdrawnItem.noted) {
    // Stackable or noted items (noted items are ALWAYS stackable)
    console.log(`🏦 [SERVER-DETAILED] Looking for existing stacks of ${withdrawnItem.id} (noted: ${!!withdrawnItem.noted})`);
    
    // Log current inventory state
    const existingItems = user.savedInventory.filter(invItem => invItem && invItem.id === withdrawnItem.id);
    console.log(`🏦 [SERVER-DETAILED] Current inventory stacks of ${withdrawnItem.id}:`, existingItems);
    
    const existingSlot = user.savedInventory.findIndex(invItem => 
      invItem && 
      invItem.id === withdrawnItem.id && 
      (!!invItem.noted) === (!!withdrawnItem.noted)
    );
    
    if (existingSlot !== -1) {
      targetInventorySlot = existingSlot;
      canWithdraw = true;
      console.log(`🏦 [SERVER-DETAILED] Found existing stack in inventory slot ${existingSlot}:`, user.savedInventory[existingSlot]);
    } else {
      // Need empty slot for new stack
      const emptySlot = user.savedInventory.findIndex(slot => !slot);
      if (emptySlot !== -1) {
        targetInventorySlot = emptySlot;
        canWithdraw = true;
        console.log(`🏦 [SERVER-DETAILED] Found empty slot ${emptySlot} for new stack`);
      } else {
        console.log(`🏦 [SERVER-DETAILED] No empty slots available for new stack`);
      }
    }
  } else {
    // For non-stackable items, need empty slots for each item
    const emptySlots = [];
    for (let i = 0; i < user.savedInventory.length && emptySlots.length < quantity; i++) {
      if (!user.savedInventory[i]) {
        emptySlots.push(i);
      }
    }
    
    if (emptySlots.length >= quantity) {
      targetInventorySlot = emptySlots[0]; // We'll use the first one and distribute as needed
      canWithdraw = true;
      console.log(`🏦 Found ${emptySlots.length} empty slots for ${quantity} non-stackable items`);
    } else {
      // Can partially withdraw if some space available
      if (emptySlots.length > 0) {
        targetInventorySlot = emptySlots[0];
        canWithdraw = true;
        // Reduce quantity to what we can actually withdraw
        withdrawnItem.quantity = emptySlots.length;
        quantity = emptySlots.length;
        console.log(`🏦 Can only withdraw ${quantity} items due to limited space`);
      }
    }
  }
  
  if (!canWithdraw) {
    ws.send(JSON.stringify({
      type: 'bank-withdraw-denied',
      reason: 'Not enough inventory space'
    }));
    return;
  }
  
  // Remove from bank
  if ((bankItem.quantity || 1) <= quantity) {
    user.savedBank[bankSlot] = null;
  } else {
    user.savedBank[bankSlot].quantity -= quantity;
  }
  
  // Add to inventory
  if (isStackable || withdrawnItem.noted) {
    // Stackable or noted items (noted items are ALWAYS stackable)
    console.log(`🏦 [SERVER-DETAILED] Adding stackable item to inventory slot ${targetInventorySlot}`);
    
    if (user.savedInventory[targetInventorySlot]) {
      // Add to existing stack
      const oldQuantity = user.savedInventory[targetInventorySlot].quantity || 1;
      user.savedInventory[targetInventorySlot].quantity = oldQuantity + quantity;
      console.log(`🏦 [SERVER-DETAILED] Added ${quantity} to existing stack, old: ${oldQuantity}, new: ${user.savedInventory[targetInventorySlot].quantity}`);
    } else {
      // Create new stack - preserve all properties for special items (unfinished books, authored books, etc.)
      if (bankItem.type === 'unfinished_book' || bankItem.author || bankItem.authorName || Object.keys(bankItem).length > 3) {
        user.savedInventory[targetInventorySlot] = {
          ...bankItem,  // Preserve all custom properties for special items
          quantity: quantity,
          ...(withdrawnItem.noted ? { noted: true } : {})
        };
        console.log(`🏦 [SERVER-DETAILED] Created new special item stack with preserved properties:`, user.savedInventory[targetInventorySlot]);
      } else {
        user.savedInventory[targetInventorySlot] = {
          id: withdrawnItem.id,
          quantity: quantity,
          ...(withdrawnItem.noted ? { noted: true } : {})
        };
        console.log(`🏦 [SERVER-DETAILED] Created new stack of ${quantity} items:`, user.savedInventory[targetInventorySlot]);
      }
    }
  } else {
    // Non-stackable items - distribute to empty slots
    let remainingQuantity = quantity;
    for (let i = 0; i < user.savedInventory.length && remainingQuantity > 0; i++) {
      if (!user.savedInventory[i]) {
        // Preserve all properties for special items (unfinished books, authored books, etc.)
        if (bankItem.type === 'unfinished_book' || bankItem.author || bankItem.authorName || Object.keys(bankItem).length > 3) {
          user.savedInventory[i] = {
            ...bankItem,  // Preserve all custom properties for special items
            quantity: 1
          };
          console.log(`🏦 Placed 1 special item with preserved properties in slot ${i}, ${remainingQuantity - 1} remaining`);
        } else {
          user.savedInventory[i] = {
            id: withdrawnItem.id,
            quantity: 1
          };
          console.log(`🏦 Placed 1 item in slot ${i}, ${remainingQuantity - 1} remaining`);
        }
        remainingQuantity--;
      }
    }
  }
  
  // Consolidate bank after withdrawal to clean up any fragmentation
  const consolidationsHappened = consolidateUserBank(user);
  
  console.log(`✅ ${ws.username} withdraw completed`);
  
  // Send confirmation with updated data
  ws.send(JSON.stringify({
    type: 'bank-withdraw-confirmed',
    item: withdrawnItem,
    quantity: quantity,
    updatedBank: user.savedBank,
    updatedInventory: user.savedInventory,
    bankConsolidated: consolidationsHappened
  }));
}

/**
 * Handle bank sync (when player closes bank)
 */
function handleBankSync(ws, data) {
  if (!ws.username) return;
  
  const { bankData } = data;
  
  if (!Array.isArray(bankData)) {
    console.warn(`⚠️ Invalid bank sync data from ${ws.username}:`, data);
    return;
  }
  
  const user = users.get(ws.username);
  if (!user) return;
  
  console.log(`🏦 Syncing bank data for ${ws.username}: ${bankData.filter(item => item).length} items`);
  
  // Update saved bank data
  user.savedBank = [...bankData];
  
  // Save to disk
  saveUsers();
  
  console.log(`✅ Bank data synced for ${ws.username}`);
}

/**
 * Handle bank tab icon update
 */
function handleBankTabIconUpdate(ws, data) {
  if (!ws.username) return;
  
  const { tabIndex, icon } = data;
  
  if (typeof tabIndex !== 'number' || tabIndex < 0 || tabIndex >= MAX_TABS || !icon) {
    console.warn(`⚠️ Invalid tab icon update from ${ws.username}:`, data);
    return;
  }
  
  const user = users.get(ws.username);
  if (!user) return;
  
  // Initialize bank tabs if they don't exist
  if (!user.savedBankTabs) {
    user.savedBankTabs = Array.from({ length: MAX_TABS }, (_, i) => ({
      id: i,
      name: i === 0 ? 'Main' : `Tab ${i + 1}`,
      icon: i === 0 ? '📦' : '📁',
      customIcon: null
    }));
  }
  
  // Update tab icon
  if (user.savedBankTabs[tabIndex]) {
    user.savedBankTabs[tabIndex].customIcon = icon;
    console.log(`🏦 Updated tab ${tabIndex} icon to ${icon} for ${ws.username}`);
    
    // Save to disk
    saveUsers();
    
    // Send confirmation
    ws.send(JSON.stringify({
      type: 'bank-tab-icon-updated',
      tabIndex: tabIndex,
      icon: icon,
      timestamp: Date.now()
    }));
  }
}

/**
 * Handle bank reorganization request
 */
function handleBankReorganizeRequest(ws, data) {
  if (!ws.username) return;
  
  const user = users.get(ws.username);
  if (!user) {
    ws.send(JSON.stringify({
      type: 'bank-reorganize-denied',
      reason: 'User data not found'
    }));
    return;
  }
  
  const { fromSlot, toSlot } = data;
  
  console.log(`🏦 ${ws.username} reorganizing bank: slot ${fromSlot} -> slot ${toSlot}`);
  
  // Validate slot indices
  if (fromSlot < 0 || fromSlot >= user.savedBank.length || 
      toSlot < 0 || toSlot >= user.savedBank.length) {
    ws.send(JSON.stringify({
      type: 'bank-reorganize-denied',
      reason: 'Invalid slot indices'
    }));
    return;
  }
  
  // Don't process if trying to move to same slot
  if (fromSlot === toSlot) {
    return;
  }
  
  // Validate that source slot has an item
  if (!user.savedBank[fromSlot]) {
    ws.send(JSON.stringify({
      type: 'bank-reorganize-denied',
      reason: 'No item in source slot'
    }));
    return;
  }
  
  // Perform the reorganization (swap items or move to empty slot)
  const sourceItem = user.savedBank[fromSlot];
  const destItem = user.savedBank[toSlot];
  
  // Swap the items
  user.savedBank[fromSlot] = destItem;
  user.savedBank[toSlot] = sourceItem;
  
  console.log(`✅ ${ws.username} bank reorganization successful`);
  
  // Send confirmation to client with updated bank data
  ws.send(JSON.stringify({
    type: 'bank-reorganize-confirmed',
    fromSlot: fromSlot,
    toSlot: toSlot,
    bankData: user.savedBank,
    timestamp: Date.now()
  }));
  
  // Save user data
  saveUsers();
}

// ===== Enhanced OSRS-style Combat System =====
const activeCombats = new Map(); // npcId -> combat state
const TICK_MS = 500; // 0.5 second tick

// Attack speeds for different weapon/NPC types (in ticks)
const ATTACK_SPEEDS = {
  player: 4, // Default player attack speed
  npc: {
    default: 4,
    fast: 3,
    slow: 5,
    verySlow: 6
  }
};

// NPC aggressiveness tracking
const npcAggressionTimers = new Map(); // npcId -> { startTime, toleranceRegion }
const AGGRESSION_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes like OSRS

// Combat calculations inspired by OSRS
function calculateHitChance(attackerLevel, attackerBonus, defenderLevel, defenderBonus) {
  const attackRoll = attackerLevel + attackerBonus;
  const defenseRoll = defenderLevel + defenderBonus;

  let hitChance = 0.80; // Higher base accuracy
  const levelDiff = attackRoll - defenseRoll;

  hitChance += levelDiff * 0.04; // Steeper scaling

  return Math.max(0.40, Math.min(0.99, hitChance));
}

function calculateMaxHit(level, bonus) {
  // Reworked OSRS-style max hit formula to keep values in-line across client & server.
  const effectiveStrength = level + 8; // OSRS effective strength (ignoring prayers for now)
  const base = Math.floor((effectiveStrength * (bonus + 64)) / 640);
  const boosted = Math.floor(base * 1.6); // ~60% more generous than base
  return Math.max(1, boosted + 1);
}

// XP table for converting experience to levels (OSRS-style)
const XP_TABLE = [
  0, 83, 174, 276, 388, 512, 650, 801, 969, 1154, 1358, 1584, 1833, 2107, 2411, 2746, 3115, 3523, 3973, 4470, 5018, 5624, 6291, 7028, 7842, 8740, 9730, 10824, 12031, 13363, 14833, 16456, 18247, 20224, 22406, 24815, 27473, 30408, 33648, 37224, 41171, 45529, 50339, 55649, 61512, 67983, 75127, 83014, 91721, 101333, 111945, 123660, 136594, 150872, 166636, 184040, 203254, 224466, 247886, 273742, 302288, 333804, 368599, 407015, 449428, 496254, 547953, 605032, 668051, 737627, 814445, 899257, 992895, 1096278, 1210421, 1336443, 1475581, 1629200, 1798808, 1986068, 2192818, 2421087, 2673114, 2951373, 3258594, 3597792, 3972294, 4385776, 4842295, 5346332, 5902831, 6517253, 7195629, 7944614, 8771558, 9684577, 10692629, 11805606, 13034431, 14391160, 15889109, 17542976, 19368992, 21385073, 23611006, 26068632, 28782069, 31777943, 35085654, 38737661, 42769801, 47221641, 52136869, 57563718, 63555443, 70170840, 77474828, 85539082, 94442737, 104273167
];

function getLevelFromXP(xp, skillName) {
  // Special handling for hitpoints - minimum level 10
  if (skillName === 'hitpoints') {
    if (xp < XP_TABLE[10]) return 10; // Minimum hitpoints level
  }
  
  // Find the highest level where required XP <= current XP
  for (let level = XP_TABLE.length - 1; level >= 1; level--) {
    if (xp >= XP_TABLE[level]) {
      return Math.max(level, skillName === 'hitpoints' ? 10 : 1);
    }
  }
  
  return skillName === 'hitpoints' ? 10 : 1; // Minimum level
}

function isNPCAggressive(npcId, playerUsername) {
  const npc = npcs.get(npcId);
  if (!npc) return false;
  
  const npcDef = npcDefinitions[npc.type] || {};
  
  // Some NPCs are never aggressive
  if (!npcDef.aggressive) return false;
  
  // TODO: Temporarily commented out random retreating to reduce frustration
  // Check if NPC has become tolerant due to time
  // const aggressionData = npcAggressionTimers.get(npcId);
  // if (aggressionData && Date.now() - aggressionData.startTime > AGGRESSION_TIMEOUT_MS) {
  //   return false;
  // }
  
  // TODO: Temporarily commented out combat level based aggression
  // Combat level based aggression (aggressive to players <= 2 * NPC level)
  // const playerData = connectedPlayers.get(playerUsername);
  // if (playerData && playerData.combatLevel) {
  //   const npcLevel = npcDef.combatLevel || 1;
  //   if (playerData.combatLevel > npcLevel * 2) {
  //     return false;
  //   }
  // }
  
  return true;
}

function startAggressionTimer(npcId, playerUsername) {
  if (!npcAggressionTimers.has(npcId)) {
    npcAggressionTimers.set(npcId, {
      startTime: Date.now(),
      toleranceRegion: null // Could implement region-based tolerance later
    });
  }
}

function startCombat(playerUsername, npcId, combatStyle = null) {
  const npc = npcs.get(npcId);
  if (!npc) return;
  if (!connectedPlayers.has(playerUsername)) return;

  // If this NPC is already in combat, ignore for now
  if (activeCombats.has(npcId)) return;

  console.log(`⚔️ Combat started: ${playerUsername} vs ${npc.name} (${combatStyle?.type || 'melee'})`);

  activeCombats.set(npcId, {
    npcId,
    player: playerUsername,
    lastPlayerAttack: 0,
    lastNPCAttack: 0,
    combatStyle: combatStyle || { type: 'melee', style: 'accurate' }
  });

  // If NPC is beyond the edge of its wander radius, it will REFUSE combat and start retreating instead.
  const distFromSpawnForStart = Math.abs(npc.x - npc.spawnX) + Math.abs(npc.y - npc.spawnY);
  if (false && distFromSpawnForStart > npc.wanderRadius) {
    // Flag NPC to retreat; clear any combat intentions
    npc.retreating = true;
    npc.isAggressive = false;
    npc.targetPlayer = null;
    npc.isStopped = false;

    // Kick-start movement if it was idle
    startNPCMovement(npcId);

    // Inform the requesting player so their client can clear attack timer
    const attackerWs = connectedPlayers.get(playerUsername)?.ws;
    if (attackerWs && attackerWs.readyState === WebSocket.OPEN) {
      attackerWs.send(JSON.stringify({ type: 'npc-retreating', npcId, reason: 'edge-of-radius' }));
    }
    return; // Cancel combat start
  }

  // Mark NPC aggressive and lock its wander AI
  npc.isAggressive = true;
  npc.retreating = false;
  npc.targetPlayer = playerUsername;
  npc.isStopped = true; // Prevent wander logic

  // Start aggression timer for tolerance mechanics
  startAggressionTimer(npcId, playerUsername);

  // Cancel any scheduled random-movement timer so it doesn't keep firing
  if (npcMovementTimers.has(npcId)) {
    clearTimeout(npcMovementTimers.get(npcId));
    npcMovementTimers.delete(npcId);
  }

  // Let clients know the NPC stopped (so their interpolate loops stop)
  broadcastToAll({
    type: 'npc-stop',
    npcId,
    timestamp: Date.now()
  });

  // Cancel any pending stop timers so resumeNPC won't restart wandering
  if (npcStopTimers.has(npcId)) {
    clearTimeout(npcStopTimers.get(npcId));
    npcStopTimers.delete(npcId);
  }
}

function processCombatTick() {
  const now = Date.now();

  for (const [npcId, combat] of activeCombats) {
    const npc = npcs.get(npcId);
    const playerData = connectedPlayers.get(combat.player);

    if (!npc || !playerData) {
      activeCombats.delete(npcId);
      continue;
    }

    const npcDef = npcDefinitions[npc.type] || {};

    // Pre-compute Chebyshev distance between combatants (player ↔︎ NPC)
    const distance = Math.max(
      Math.abs(Math.floor(npc.x) - Math.floor(playerData.position.x)),
      Math.abs(Math.floor(npc.y) - Math.floor(playerData.position.y))
    );

    // Disengage combat if NPC has moved too far from its spawn location ( >10 tiles )
    const distanceFromSpawn = Math.max(Math.abs(Math.floor(npc.x) - npc.spawnX), Math.abs(Math.floor(npc.y) - npc.spawnY));
    if (distanceFromSpawn > 10) {
      console.log(`🛑 ${npc.name} (${npcId}) lost aggression due to distance from spawn`);
      npc.isAggressive = false;
      npc.targetPlayer = null;
      npc.isStopped = false;
      activeCombats.delete(npcId);
      startNPCMovement(npcId);
      broadcastToAll({ type: 'npc-resume', npcId, timestamp: now });
      continue;
    }

    // === NPC path-finding toward player (simplified to avoid oscillation) ===
    if (distance > 1 && distance <= 8) {
      // Direct straight-line pursuit (OSRS-style safespot friendly)
      const deltaX = playerData.position.x - npc.x;
      const deltaY = playerData.position.y - npc.y;

      // Attempt diagonal move first
      let stepX = Math.sign(deltaX);
      let stepY = Math.sign(deltaY);
      let targetX = npc.x + stepX;
      let targetY = npc.y + stepY;

      // If the direct tile toward the player is blocked, do nothing this tick.
      if (!isPositionWalkableForNPC(targetX, targetY)) {
        stepX = 0;
        stepY = 0;
      }

      if (stepX !== 0 || stepY !== 0) {
        npc.x = targetX;
        npc.y = targetY;

        npc.movementDirection = stepX === 0 ? (stepY > 0 ? 'down' : 'up')
          : (stepX > 0 ? (stepY > 0 ? 'down-right' : (stepY < 0 ? 'up-right' : 'right'))
                       : (stepY > 0 ? 'down-left' : (stepY < 0 ? 'up-left' : 'left')));

        broadcastToAll({
          type: 'npc-move',
          npcId,
          position: { x: npc.x, y: npc.y },
          direction: npc.movementDirection,
          timestamp: now
        });

        // Wait until next tick to attack (can't attack mid-move)
        continue;
      }
    }

    // --- Player attacks NPC (melee: distance 1, ranged: distance <= 8) ---
    const playerAttackSpeed = ATTACK_SPEEDS.player; // Could be modified by weapon type
    const maxAttackDistance = combat.combatStyle?.type === 'ranged' ? 8 : 1;
    
    if (distance <= maxAttackDistance && now - combat.lastPlayerAttack >= playerAttackSpeed * TICK_MS) {
      combat.lastPlayerAttack = now;
      
      // Get player stats for hit calculation based on combat style
      const user = users.get(combat.player);
      const playerSkills = user?.profile?.skills || {}; // Use profile.skills which stores actual levels
      
      let attackLevel;
      let skillXpType = 'attack';
      
      if (combat.combatStyle?.type === 'ranged') {
        attackLevel = playerSkills.ranged || 1;
        skillXpType = 'ranged';
      } else {
        attackLevel = playerSkills.attack || 1;
        skillXpType = 'attack';
      }
      
      console.log(`⚔️ Combat calculation: ${skillXpType} level ${attackLevel} vs NPC defence ${npcDef.defenceLevel || 1}`);
      
      const defenceLevel = npcDef.defenceLevel || 1;
      
      // Calculate equipment bonuses from player's equipped gear
      let attackBonus = 0;
      let strengthBonus = 0;
      
      const playerEquipment = user?.profile?.equipment || {};
      if (combat.combatStyle?.type === 'ranged') {
        // For ranged: weapon provides ranged attack, arrows provide ranged strength
        const weapon = playerEquipment.weapon;
        const arrows = playerEquipment.arrows;
        
        if (weapon) {
          const weaponDef = getItemDefinition(weapon.id);
          attackBonus += weaponDef?.equipment?.combatStats?.rangedAttack || 0;
        }
        
        if (arrows) {
          const arrowDef = getItemDefinition(arrows.id);
          strengthBonus += arrowDef?.equipment?.combatStats?.rangedStrength || 0;
        }
      } else {
        // For melee: weapon provides both attack and strength
        const weapon = playerEquipment.weapon;
        if (weapon) {
          const weaponDef = getItemDefinition(weapon.id);
          attackBonus += weaponDef?.equipment?.combatStats?.meleeAttack || 0;
          strengthBonus += weaponDef?.equipment?.combatStats?.meleeStrength || 0;
        }
      }
      
      console.log(`⚔️ Equipment bonuses: attack +${attackBonus}, strength +${strengthBonus}`);
      
      // Calculate hit chance and damage with equipment bonuses
      const hitChance = calculateHitChance(attackLevel, attackBonus, defenceLevel, 0);
      const hits = Math.random() < hitChance;
      
      let damage = 0;
      if (hits) {
        const maxHit = calculateMaxHit(attackLevel, strengthBonus);
        damage = Math.floor(Math.random() * (maxHit + 1));
        console.log(`⚔️ Hit! Max hit: ${maxHit}, rolled: ${damage}`);
      } else {
        console.log(`⚔️ Miss! Hit chance was ${(hitChance * 100).toFixed(1)}%`);
      }
      
      npc.health = Math.max(0, npc.health - damage);

      broadcastToAll({
        type: 'combat-hit',
        attacker: combat.player,
        targetType: 'npc',
        targetId: npcId,
        damage,
        remainingHealth: npc.health,
        timestamp: now
      });

      // Award XP to player based on combat style
      const xpGained = damage * 4; // Base XP
      const hitpointsXP = Math.floor(damage * 1.33); // Hitpoints XP
      
      if (user && user.savedSkills) {
        // Award XP to the appropriate skill (savedSkills stores XP values)
        user.savedSkills[skillXpType] = (user.savedSkills[skillXpType] || 1) + xpGained;
        user.savedSkills.hitpoints = (user.savedSkills.hitpoints || 10) + hitpointsXP;
        
        // Convert XP to levels for profile.skills (which stores actual levels)
        if (user.profile && user.profile.skills) {
          user.profile.skills[skillXpType] = getLevelFromXP(user.savedSkills[skillXpType], skillXpType);
          user.profile.skills.hitpoints = getLevelFromXP(user.savedSkills.hitpoints, 'hitpoints');
          
          console.log(`📊 XP Update: ${skillXpType} XP ${user.savedSkills[skillXpType]} → Level ${user.profile.skills[skillXpType]}`);
        }
        
        // Save to disk
        saveUsers();
        
        // Broadcast the actual skill levels, not XP values
        broadcastToAll({
          type: 'skills-sync',
          username: combat.player,
          skills: user.profile.skills, // Send levels, not XP
          timestamp: now
        });
      }

      // (player HP unchanged during outgoing attack)

      if (npc.health <= 0) {
        // NPC dies - but don't remove immediately, set dying state
        if (!npc.isDying) {
          npc.isDying = true;
          npc.deathTime = now;
          npc.isStopped = true; // Stop all AI movement
          
          // Broadcast death state to clients for fade animation
          broadcastToAll({
            type: 'npc-death',
            npcId: npcId,
            timestamp: now
          });
          
          // Generate drops
          const drops = calculateDrops(npc.type);
          for (const drop of drops) {
            if (!itemDefinitions[drop.itemId]) continue; // skip unknown items
            const itemObj = { id: drop.itemId, quantity: drop.quantity };
            // Try stacking first
            const stacked = tryStackWithExistingItems(itemObj, npc.x, npc.y);
            if (!stacked) {
              const floorItem = createServerFloorItem(itemObj, npc.x, npc.y, npcId);
              broadcastToAll({
                type: 'floor-item-created',
                floorItem: {
                  id: floorItem.id,
                  item: floorItem.item,
                  x: floorItem.x,
                  y: floorItem.y,
                  spawnTime: floorItem.spawnTime,
                  droppedBy: floorItem.droppedBy
                },
                droppedBy: npcId,
                timestamp: now
              });
            }
          }
          
          // Schedule actual removal after death animation (1.5 seconds)
          setTimeout(() => {
            removeNPC(npcId);
            // Schedule respawn
            if (!npcRespawnTimers.has(npcId)) {
              console.log(`⏳ Scheduling respawn for ${npc.name} (${npcId}) in ${NPC_RESPAWN_TIME_MS} ms`);
              npcRespawnTimers.set(npcId, setTimeout(() => {
                console.log(`🔄 Respawning NPC ${npc.type} at (${npc.spawnX}, ${npc.spawnY}) after death of ${npcId}`);
                createNPC(npc.type, npc.spawnX, npc.spawnY);
                npcRespawnTimers.delete(npcId);
              }, NPC_RESPAWN_TIME_MS));
            }
          }, 1500); // 1.5 second death animation
          
          activeCombats.delete(npcId);
          npcAggressionTimers.delete(npcId); // Clear aggression timer
        }
        continue; // Skip further combat processing for dying NPC
      }
    }

    // --- NPC tries to attack player (also require exact adjacency) ---
    const npcAttackSpeed = npcDef.attackSpeed || ATTACK_SPEEDS.npc.default;
    if (distance === 1 && now - combat.lastNPCAttack >= npcAttackSpeed * TICK_MS) {
      combat.lastNPCAttack = now;
      
      // Get NPC stats for hit calculation  
      const npcAttackLevel = npcDef.attackLevel || 1;
      const playerDefenceLevel = playerData.skills?.defence || 1;
      
      // Calculate hit chance and damage
      const hitChance = calculateHitChance(npcAttackLevel, 0, playerDefenceLevel, 0);
      const hits = Math.random() < hitChance;
      
      let damage = 0;
      if (hits) {
        const maxHit = npcDef.maxHit || 1;
        damage = Math.floor(Math.random() * (maxHit + 1));
      }

      // Apply damage to player's HP
      if (playerData.currentHP === undefined) {
        playerData.currentHP = playerData.maxHP || 10;
      }
      playerData.currentHP = Math.max(0, playerData.currentHP - damage);

      // Broadcast hitsplat and hp update
      broadcastToAll({
        type: 'combat-hit',
        attacker: npcId,
        targetType: 'player',
        target: combat.player,
        damage,
        timestamp: now
      });

      broadcastToAll({
        type: 'player-health-update',
        username: combat.player,
        currentHP: playerData.currentHP,
        maxHP: playerData.maxHP,
        timestamp: now
      });

      if (playerData.currentHP <= 0) {
        handlePlayerDeath(combat.player);
        continue; // Combat ends after death
      }
    }

    // Disengage combat if too far apart (>8 tiles)
    if (distance > 8) {
      console.log(`🛑 ${npc.name} (${npcId}) lost target due to distance`);
      npc.isAggressive = false;
      npc.targetPlayer = null;
      npc.isStopped = false;
      activeCombats.delete(npcId);
      startNPCMovement(npcId);
      broadcastToAll({ type: 'npc-resume', npcId, timestamp: now });
      continue;
    }

    // Simple NPC chasing logic (move one step towards player each tick until adjacent)
    if (distance !== 1) {
      let dx = playerData.position.x > npc.x ? 1 : (playerData.position.x < npc.x ? -1 : 0);
      let dy = playerData.position.y > npc.y ? 1 : (playerData.position.y < npc.y ? -1 : 0);
      // If standing on the same tile (distance 0), choose a random adjacent step to vacate
      if (dx === 0 && dy === 0) {
        const adjOptions = [
          {dx:1,dy:0}, {dx:-1,dy:0}, {dx:0,dy:1}, {dx:0,dy:-1},
          {dx:1,dy:1}, {dx:-1,dy:1}, {dx:1,dy:-1}, {dx:-1,dy:-1}
        ].filter(opt => isPositionWalkableForNPC(npc.x + opt.dx, npc.y + opt.dy));
        if (adjOptions.length) {
          const pick = adjOptions[Math.floor(Math.random()*adjOptions.length)];
          dx = pick.dx; dy = pick.dy;
        }
      }
      const newX = npc.x + dx;
      const newY = npc.y + dy;
      let moved = false;
      let tx = newX, ty = newY;
      if (isPositionWalkableForNPC(tx, ty)) {
        moved = true;
      } else {
        // Try horizontal only then vertical only as simple detour
        const alt1X = npc.x + dx;
        const alt1Y = npc.y;
        const alt2X = npc.x;
        const alt2Y = npc.y + dy;
        if (dx !== 0 && isPositionWalkableForNPC(alt1X, alt1Y)) {
          tx = alt1X; ty = alt1Y; moved = true;
        } else if (dy !== 0 && isPositionWalkableForNPC(alt2X, alt2Y)) {
          tx = alt2X; ty = alt2Y; moved = true;
        } else {
          // Last resort: try any adjacent walkable tile randomly
          const directions = [
            {dx:1,dy:0}, {dx:-1,dy:0}, {dx:0,dy:1}, {dx:0,dy:-1},
            {dx:1,dy:1}, {dx:-1,dy:1}, {dx:1,dy:-1}, {dx:-1,dy:-1}
          ];
          for (const d of directions) {
            const ax = npc.x + d.dx;
            const ay = npc.y + d.dy;
            if (isPositionWalkableForNPC(ax, ay)) { tx = ax; ty = ay; moved = true; break; }
          }
        }
      }

      if (moved) {
        const oldX = npc.x;
        const oldY = npc.y;
        npc.x = tx;
        npc.y = ty;
        // Determine direction label from actual step taken
        const ndx = npc.x - oldX;
        const ndy = npc.y - oldY;
        let dir = null;
        if (ndx === 1 && ndy === 0) dir = 'right';
        else if (ndx === -1 && ndy === 0) dir = 'left';
        else if (ndx === 0 && ndy === 1) dir = 'down';
        else if (ndx === 0 && ndy === -1) dir = 'up';
        else if (ndx === 1 && ndy === 1) dir = 'down-right';
        else if (ndx === -1 && ndy === 1) dir = 'down-left';
        else if (ndx === 1 && ndy === -1) dir = 'up-right';
        else if (ndx === -1 && ndy === -1) dir = 'up-left';

        broadcastToAll({
          type: 'npc-move',
          npcId: npcId,
          position: { x: tx, y: ty },
          direction: dir,
          timestamp: now
        });
      }
    }
  }
}

setInterval(processCombatTick, TICK_MS);

// ===== End Combat System =====

// ===== Player death handling =====
function handlePlayerDeath(username) {
  const playerData = connectedPlayers.get(username);
  if (!playerData) return;
  console.log(`💀 ${username} has died. Dropping items and respawning.`);

  const user = users.get(username);
  if (!user) return;

  const inventory = user.savedInventory || [];
  const itemsWithValue = inventory.map((item, idx) => ({ item, idx, value: item ? (itemDefinitions[item.id]?.value || 0) * (item.quantity || 1) : 0 }));
  itemsWithValue.sort((a,b)=>b.value-a.value);

  const keepSet = new Set();
  let kept = 0;
  for (const iwv of itemsWithValue) {
    if (!iwv.item) continue;
    keepSet.add(iwv.idx);
    kept += 1;
    if (kept === 3) break;
  }

  const pos = playerData.position;
  inventory.forEach((item, idx) => {
    if (!item) return;
    if (keepSet.has(idx)) return;
    const floorItem = createServerFloorItem(item, Math.floor(pos.x), Math.floor(pos.y), username);
    broadcastToAll({
      type: 'floor-item-created',
      floorItem: {
        id: floorItem.id,
        item: floorItem.item,
        x: floorItem.x,
        y: floorItem.y,
        spawnTime: floorItem.spawnTime,
        droppedBy: username
      },
      droppedBy: username,
      timestamp: Date.now()
    });
    inventory[idx] = null;
  });

  broadcastToAll({
    type: 'inventory-sync',
    username,
    inventory,
    timestamp: Date.now()
  });

  playerData.currentHP = playerData.maxHP;

  const spawnPos = user.spawnPosition || { x: 10, y: 10 };
  playerData.position = { x: spawnPos.x, y: spawnPos.y, timestamp: Date.now() };

  broadcastToAll({
    type: 'player-respawn',
    username,
    position: spawnPos,
    timestamp: Date.now()
  });

  // End any combats involving this player
  for (const [npcId, combat] of activeCombats) {
    if (combat.player === username) {
      const npc = npcs.get(npcId);
      activeCombats.delete(npcId);
      if (npc) {
        npc.isAggressive = false;
        npc.targetPlayer = null;
        npc.isStopped = false;
        startNPCMovement(npcId);
        broadcastToAll({ type: 'npc-resume', npcId, timestamp: Date.now() });
      }
    }
  }

  // Sync full HP after respawn so other clients update health bars
  broadcastToAll({
    type: 'player-health-update',
    username,
    currentHP: playerData.currentHP,
    maxHP: playerData.maxHP,
    timestamp: Date.now()
  });
}

// Start the server
server.listen(PORT, () => {
  console.log(`✅ Server started on port ${PORT}`);
  console.log(`🌐 Visit http://localhost:${PORT} to play`);
  
  // Initialize server systems
  loadWorldCollisionData(); // Load world collision data for NPC pathfinding
  initializeServerShops();
  loadServerItemSpawns(); // Initialize server-side item spawns
  loadNPCSpawns(); // Initialize NPC spawns
  
  // Send world state to all connected players every 30 seconds
  setInterval(() => {
    // Broadcast world state to all connected players
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN && client.username) {
        sendWorldStateToPlayer(client);
      }
    });
  }, 30000);
}); 

function handleItemConsumed(ws, data) {
  if (!ws.username) return;
  const { itemId, heal } = data;
  const playerData = connectedPlayers.get(ws.username);
  if (!playerData) return;
  const itemDef = itemDefinitions[itemId];
  if (!itemDef || !itemDef.heals) return;
  const healAmount = Math.min(itemDef.heals, heal || itemDef.heals);
  playerData.currentHP = Math.min(playerData.maxHP, playerData.currentHP + healAmount);
  broadcastToAll({
    type: 'player-health-update',
    username: ws.username,
    currentHP: playerData.currentHP,
    maxHP: playerData.maxHP,
    timestamp: Date.now()
  });
}

// Digging holes management
function handleRequestDiggingHolesSync(ws, data) {
  if (!ws.username) return;
  
  // Send all active digging holes to the requesting player
  const diggingHoles = Array.from(worldDiggingHoles.values());
  
  ws.send(JSON.stringify({
    type: 'digging-holes-sync',
    diggingHoles: diggingHoles
  }));
  
  console.log(`🕳️ Sent ${diggingHoles.length} digging holes to ${ws.username}`);
}

function handleDiggingHoleCreated(ws, data) {
  if (!ws.username) return;
  
  const { x, y, duration, timestamp } = data;
  const holeKey = `${x},${y}`;
  
  // Check if hole already exists at this position
  if (worldDiggingHoles.has(holeKey)) {
    console.log(`🕳️ Hole already exists at (${x}, ${y}), ignoring create request`);
    return;
  }
  
  const holeData = {
    x,
    y,
    createdAt: timestamp,
    expiresAt: timestamp + duration,
    createdBy: ws.username
  };
  
  // Store hole on server
  worldDiggingHoles.set(holeKey, holeData);
  
  // Set timer to remove hole when it expires
  const timeRemaining = duration - (Date.now() - timestamp);
  if (timeRemaining > 0) {
    const timer = setTimeout(() => {
      removeDiggingHoleFromServer(x, y);
    }, timeRemaining);
    
    diggingHoleTimers.set(holeKey, timer);
  }
  
  // Broadcast to all other players
  broadcastToAll({
    type: 'digging-hole-created',
    x,
    y,
    duration,
    timestamp,
    createdBy: ws.username
  }, ws);
  
  console.log(`🕳️ Player ${ws.username} created digging hole at (${x}, ${y}), expires in ${Math.round(timeRemaining/1000)}s`);
}

function handleDiggingHoleRemoved(ws, data) {
  if (!ws.username) return;
  
  const { x, y } = data;
  removeDiggingHoleFromServer(x, y, ws.username);
}

function removeDiggingHoleFromServer(x, y, removedBy = 'server') {
  const holeKey = `${x},${y}`;
  
  if (worldDiggingHoles.has(holeKey)) {
    // Clear timer if it exists
    if (diggingHoleTimers.has(holeKey)) {
      clearTimeout(diggingHoleTimers.get(holeKey));
      diggingHoleTimers.delete(holeKey);
    }
    
    // Remove hole from server state
    worldDiggingHoles.delete(holeKey);
    
    // Broadcast removal to all players
    broadcastToAll({
      type: 'digging-hole-removed',
      x,
      y,
      timestamp: Date.now(),
      removedBy
    });
    
    console.log(`🕳️ Digging hole at (${x}, ${y}) removed by ${removedBy}`);
  }
} 

// Helper: find a user key (exact or case-insensitive) from a supplied name.
function findUserKey(name) {
  if (!name) return null;
  // First try exact match
  if (users.has(name)) return name;
  // Fallback: case-insensitive lookup
  const lower = name.toLowerCase();
  for (const key of users.keys()) {
    if (key.toLowerCase() === lower) {
      return key;
    }
  }
  return null;
} 

/**
 * Handle hitpoints synchronization
 */
function handleHitpointsSync(ws, data) {
  if (!ws.username) return;

  const user = users.get(ws.username);
  if (!user) return;

  // Coerce numbers and clamp to sensible range (>=0)
  let currentHP = Number(data.currentHP);
  let maxHP = Number(data.maxHP);
  if (isNaN(currentHP) || currentHP < 0) currentHP = 0;
  if (isNaN(maxHP) || maxHP <= 0) maxHP = 1;
  if (currentHP > maxHP) currentHP = maxHP;

  console.log(`🩺 Syncing HP for ${ws.username}: ${currentHP}/${maxHP}`);

  // Persist to user profile so it survives reconnect / reload
  user.profile.currentHP = currentHP;
  user.profile.maxHP = maxHP;
  user.savedCurrentHP = currentHP;
  user.savedMaxHP = maxHP;

  // Save to disk
  saveUsers();

  // Update connected player cache
  const playerData = connectedPlayers.get(ws.username);
  if (playerData) {
    playerData.currentHP = currentHP;
    playerData.maxHP = maxHP;
  }

  // Broadcast to other players (excluding sender) so their UIs update
  broadcastToAll({
    type: 'player-health-update',
    username: ws.username,
    currentHP: currentHP,
    maxHP: maxHP
  }, ws);

  // Optionally acknowledge sync to sender (could be used for latency tests)
  ws.send(JSON.stringify({
    type: 'hitpoints-sync-ack',
    currentHP: currentHP,
    maxHP: maxHP,
    timestamp: Date.now()
  }));
}

app.post('/api/update-settings', (req, res) => {
  try {
    // Validate active session using cookie (same mechanism as other auth-protected routes)
    const sessionId = req.cookies?.sessionId;
    const session = validateSession(sessionId);
    if (!session) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    // Expect a { settings: { ... } } payload
    const { settings } = req.body || {};
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ success: false, error: 'Invalid settings payload' });
    }

    const user = users.get(session.username);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Merge new settings into existing profile settings
    if (!user.profile.settings) {
      user.profile.settings = {};
    }
    user.profile.settings = { ...user.profile.settings, ...settings };

    // Persist immediately so changes survive crashes
    saveUser(session.username, user);

    return res.json({ success: true, settings: user.profile.settings });
  } catch (error) {
    console.error('Error updating settings:', error);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});