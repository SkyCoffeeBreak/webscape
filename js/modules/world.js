/**
 * World module for WebscapeRPG
 * Handles the game world, grid-based movement, and environment
 */

// Game world configuration
// === Dynamic zoom configuration ===
// This can be modified at runtime to zoom in/out. 1 = 100 %.
let zoomLevel = 1.5;            // default 150 % (50 % zoom-in)
const MIN_ZOOM = 1;           // 50 % (zoomed far out)
const MAX_ZOOM = 3;             // 300 %

// Base tile size before zoom is applied (do NOT change at runtime)
const BASE_GRID_SIZE = 32;

// Mutable, derived values – recomputed whenever zoomLevel changes
let GRID_SIZE        = BASE_GRID_SIZE * zoomLevel; // pixel size of one tile

// World dimensions (tile counts – unchanged by zoom)
let WORLD_COLS = 100; // Default world size, will be updated from map data
let WORLD_ROWS = 100; // Default world size, will be updated from map data

// Base viewport (tile counts at 100 %)
const BASE_VIEWPORT_COLS = 30;
const BASE_VIEWPORT_ROWS = 21;

// Mutable viewport tile counts at current zoom
let VIEWPORT_COLS = Math.round(BASE_VIEWPORT_COLS / zoomLevel);
let VIEWPORT_ROWS = Math.round(BASE_VIEWPORT_ROWS / zoomLevel);

// Layer system constants
const LAYERS = {
  TERRAIN: 0,
  GROUND_OBJECTS: 1,
  INTERACTIVE_OBJECTS: 2,
  DECORATIVE_OVERLAYS: 3
};

const LAYER_NAMES = {
  0: 'Terrain',
  1: 'Ground Objects',
  2: 'Interactive Objects', 
  3: 'Decorative Overlays'
};

// Map levels system with coordinate offset approach
const MAP_LEVELS = {
  SURFACE: 'surface',
  UNDERGROUND: 'underground'
};

const MAP_LEVEL_NAMES = {
  [MAP_LEVELS.SURFACE]: 'Surface',
  [MAP_LEVELS.UNDERGROUND]: 'Underground'
};

// Underground offset - places underground area far away on same plane
const UNDERGROUND_OFFSET = {
  X: 500000,
  Y: 500000
};

// Default terrain for each map level
const DEFAULT_TERRAIN = {
  [MAP_LEVELS.SURFACE]: 3, // Water as base for surface
  [MAP_LEVELS.UNDERGROUND]: 57 // Black void as base for underground
};

// Player state
let playerPosition = { x: 50, y: 50 }; // Start in the middle of the expanded world
let playerTarget = null; // Target position for movement
let isMoving = false;
let playerDirection = 'south'; // 'north', 'east', 'south', 'west', 'northeast', 'northwest', 'southeast', 'southwest'
let movementSpeed = 3; // Reduced by ~30 % for slower base walk
let currentMapLevel = MAP_LEVELS.SURFACE; // Current map level player is on

// Camera state (initial position will be re-centred if zoom changes later)
let cameraPosition = { x: 50 - VIEWPORT_COLS / 2, y: 50 - VIEWPORT_ROWS / 2 }; // Use floating point for smooth movement
let lastCameraTilePosition = { x: -1, y: -1 }; // Track when camera moves to new tile for rendering optimization

// Movement queue for smooth pathfinding
let movementQueue = [];

// World grid - single layer system with coordinate offset for underground
let worldLayers = []; // Single layer system, underground uses offset coordinates

// Item spawn system
let itemSpawns = {}; // Configuration for each spawn point
let activeSpawnedItems = {}; // Track which items are currently spawned
let pendingSpawns = []; // Queue for spawns that couldn't happen due to module availability

// World objects (legacy - will be migrated to layers)
let worldObjects = [];
const OBJECT_TYPES = {
  BANK: 'bank',
  WATER: 'water',
  TREE: 'tree',
  ORE: 'ore',
  LADDER_DOWN: 'ladder_down',
  LADDER_UP: 'ladder_up'
};

// Specific object subtypes
const TREE_TYPES = [
  { name: 'Oak Tree', icon: '🌳', rarity: 0.6 },
  { name: 'Pine Tree', icon: '🌲', rarity: 0.3 },
  { name: 'Palm Tree', icon: '🌴', rarity: 0.1 }
];

const ORE_TYPES = [
  { name: 'Copper Ore', icon: '🟤', rarity: 0.4, level: 1 },
  { name: 'Tin Ore', icon: '🔘', rarity: 0.3, level: 15 },
  { name: 'Silver Ore', icon: '⚪', rarity: 0.15, level: 20 },
  { name: 'Gold Ore', icon: '🟡', rarity: 0.1, level: 40 },
  { name: 'Mithril Ore', icon: '🔵', rarity: 0.04, level: 55 },
  { name: 'Adamantite Ore', icon: '🟢', rarity: 0.01, level: 70 }
];

// Game loop variables
let lastFrameTime = 0;
let animationFrameId = null;

// Game loop and world updates
let gameLoopId = null;
let lastUpdateTime = 0;
let periodicUpdateInterval = null;

// === Running system ===
let isRunning      = false;   // Whether local player has run toggled on
let runEnergy      = 100;     // 0–100 %
const RUN_MULT     = 2;       // Movement speed multiplier when running
const RUN_DRAIN_PER_TILE = 0.5; // Further reduced drain (25% of previous)
const RUN_REGEN_RATE      = 1; // % energy restored per second when NOT running

// UI elements (created during world init)
let runBtn   = null;
let energyEl = null;

// Initialize the world
function initializeWorld() {
  console.log('Initializing world...');
  
  // Initialize layer system
  initializeLayers();
  
  // Try to load custom map first, otherwise use default blank map
  if (!loadCustomMap()) {
    console.log('No custom map found, using default blank world');
    generateDefaultWorld();
  }
  
  // Create the world container
  const worldElement = createWorldCanvas();
  
  // Create Run UI
  createRunUI();
  
  // Render the initial world
  renderWorld(worldElement);
  
  // Initialize item spawn system
  initializeItemSpawns();
  
  // Start the game loop
  startGameLoop();
  
  // Expose world functions to window for cross-module communication
  if (window.worldModule) {
    window.worldModule.getPlayerPosition = getPlayerPosition;
    window.worldModule.setPlayerPosition = setPlayerPosition; // Add the new function
    window.worldModule.getCameraPosition = getCameraPosition;
    window.worldModule.getWorldBounds = getWorldBounds;
    window.worldModule.getGridSize = getGridSize;
    window.worldModule.isPositionWalkable = isPositionWalkable;
    window.worldModule.movePlayerToTarget = movePlayerToTarget;
    window.worldModule.movePlayerToInteractiveTarget = movePlayerToInteractiveTarget;
    window.worldModule.updatePlayerDirection = updatePlayerDirection;
    window.worldModule.updatePlayerAppearance = updatePlayerAppearance;
    window.worldModule.loadCustomMap = loadCustomMap;
    window.worldModule.getLayers = getLayers;
    window.worldModule.setTileOnLayer = setTileOnLayer;
    window.worldModule.getTileOnLayer = getTileOnLayer;
    window.worldModule.clearLayer = clearLayer;
    window.worldModule.forceWorldRerender = forceWorldRerender;
    window.worldModule.regenerateDefaultWorld = regenerateDefaultWorld; // For testing
    window.worldModule.updateElementPosition = updateElementPosition; // For online players to use same positioning as objects
    window.worldModule.getWorldDimensions = () => ({ cols: WORLD_COLS, rows: WORLD_ROWS }); // For accessing current dimensions
    window.worldModule.getCurrentMapLevel = getCurrentMapLevel;
    window.worldModule.setCurrentMapLevel = setCurrentMapLevel;
    window.worldModule.transitionToMapLevel = transitionToMapLevel;
    // Zoom controls
    window.worldModule.setZoomLevel = setZoomLevel;
    window.worldModule.getZoomLevel = () => zoomLevel;
  }
  
  // Also expose globally for easy console access
  window.regenerateDefaultWorld = regenerateDefaultWorld;
  window.debugShopObjects = debugShopObjects;
  window.reloadCustomMapWithShops = reloadCustomMapWithShops;
  
  // Set up event listeners
  addWorldEventListeners(worldElement);
  
  // Start the periodic world update system
  startPeriodicWorldUpdate();
  
  console.log('World initialized successfully');
  return worldElement;
}

// Initialize layers - sparse storage system for memory efficiency
function initializeLayers() {
  worldLayers = [];
  
  // Initialize all 4 layers with sparse storage (Map objects)
  for (let layer = 0; layer < 4; layer++) {
    worldLayers[layer] = new Map(); // Use Map for sparse storage
  }
  
  // Pre-populate surface area with default terrain
  for (let y = 0; y < WORLD_ROWS; y++) {
    for (let x = 0; x < WORLD_COLS; x++) {
      const key = `${x},${y}`;
      worldLayers[LAYERS.TERRAIN].set(key, DEFAULT_TERRAIN[MAP_LEVELS.SURFACE]);
    }
  }
  
  // Pre-populate underground area with default terrain
  for (let y = 0; y < WORLD_ROWS; y++) {
    for (let x = 0; x < WORLD_COLS; x++) {
      const actualX = x + UNDERGROUND_OFFSET.X;
      const actualY = y + UNDERGROUND_OFFSET.Y;
      const key = `${actualX},${actualY}`;
      worldLayers[LAYERS.TERRAIN].set(key, DEFAULT_TERRAIN[MAP_LEVELS.UNDERGROUND]);
    }
  }
  
  console.log(`World layers initialized with sparse storage: ${WORLD_COLS}x${WORLD_ROWS} surface + ${WORLD_COLS}x${WORLD_ROWS} underground`);
}

// Coordinate translation functions
function getActualCoordinates(x, y, mapLevel = null) {
  if (mapLevel === null) mapLevel = currentMapLevel;
  
  if (mapLevel === MAP_LEVELS.UNDERGROUND) {
    return {
      x: x + UNDERGROUND_OFFSET.X,
      y: y + UNDERGROUND_OFFSET.Y
    };
  }
  return { x, y };
}

function getLogicalCoordinates(actualX, actualY) {
  // Determine if coordinates are in underground area
  if (actualX >= UNDERGROUND_OFFSET.X && actualX < UNDERGROUND_OFFSET.X + WORLD_COLS &&
      actualY >= UNDERGROUND_OFFSET.Y && actualY < UNDERGROUND_OFFSET.Y + WORLD_ROWS) {
    return {
      x: actualX - UNDERGROUND_OFFSET.X,
      y: actualY - UNDERGROUND_OFFSET.Y,
      mapLevel: MAP_LEVELS.UNDERGROUND
    };
  }
  
  // Surface coordinates
  return {
    x: actualX,
    y: actualY,
    mapLevel: MAP_LEVELS.SURFACE
  };
}

// Get layer data (for map editor) - convert sparse storage to arrays
function getLayers() {
  // Convert sparse storage back to array format for compatibility
  const arrayLayers = [];
  
  for (let layer = 0; layer < 4; layer++) {
    arrayLayers[layer] = [];
    
    // Initialize array with proper dimensions for current map level
    for (let y = 0; y < WORLD_ROWS; y++) {
      arrayLayers[layer][y] = [];
      for (let x = 0; x < WORLD_COLS; x++) {
        const actual = getActualCoordinates(x, y, currentMapLevel);
        const key = `${actual.x},${actual.y}`;
        
        if (worldLayers[layer].has(key)) {
          arrayLayers[layer][y][x] = worldLayers[layer].get(key);
        } else {
          // Provide default values
          if (layer === LAYERS.TERRAIN) {
            arrayLayers[layer][y][x] = DEFAULT_TERRAIN[currentMapLevel];
          } else {
            arrayLayers[layer][y][x] = null;
          }
        }
      }
    }
  }
  
  return {
    layers: arrayLayers,
    constants: LAYERS,
    names: LAYER_NAMES
  };
}

// Set tile on specific layer with sparse storage
function setTileOnLayer(layer, x, y, value, mapLevel = null) {
  if (mapLevel === null) mapLevel = currentMapLevel;
  
  if (layer < 0 || layer >= Object.values(LAYERS).length) {
    console.error('Invalid layer:', layer);
    return false;
  }
  
  if (x < 0 || x >= WORLD_COLS || y < 0 || y >= WORLD_ROWS) {
    console.error('Invalid coordinates:', x, y);
    return false;
  }
  
  // Translate to actual coordinates
  const actual = getActualCoordinates(x, y, mapLevel);
  const key = `${actual.x},${actual.y}`;
  
  if (!worldLayers[layer]) {
    console.error('Layer not initialized:', layer);
    return false;
  }
  
  if (value === null || value === undefined) {
    worldLayers[layer].delete(key); // Remove from sparse storage
  } else {
    worldLayers[layer].set(key, value); // Store in sparse storage
  }
  
  return true;
}

// Get tile from specific layer with sparse storage
function getTileOnLayer(layer, x, y, mapLevel = null) {
  if (mapLevel === null) mapLevel = currentMapLevel;
  
  if (layer < 0 || layer >= Object.values(LAYERS).length) {
    console.error('Invalid layer:', layer);
    return null;
  }
  
  if (x < 0 || x >= WORLD_COLS || y < 0 || y >= WORLD_ROWS) {
    console.error('Invalid coordinates:', x, y);
    return null;
  }
  
  // Translate to actual coordinates
  const actual = getActualCoordinates(x, y, mapLevel);
  const key = `${actual.x},${actual.y}`;
  
  if (!worldLayers[layer]) {
    console.error('Layer not initialized:', layer);
    return null;
  }
  
  // Return value from sparse storage, or default based on layer and map level
  if (worldLayers[layer].has(key)) {
    return worldLayers[layer].get(key);
  }
  
  // Return appropriate default for missing tiles
  if (layer === LAYERS.TERRAIN) {
    return DEFAULT_TERRAIN[mapLevel];
  }
  
  return null; // Non-terrain layers default to null
}

// Clear entire layer at current map level
function clearLayer(layer, mapLevel = null) {
  if (mapLevel === null) mapLevel = currentMapLevel;
  
  if (layer < 0 || layer >= Object.values(LAYERS).length) {
    console.error('Invalid layer:', layer);
    return false;
  }
  
  if (!worldLayers[layer]) {
    console.error('Layer not initialized:', layer);
    return false;
  }
  
  // Clear the appropriate area based on map level using sparse storage
  for (let y = 0; y < WORLD_ROWS; y++) {
    for (let x = 0; x < WORLD_COLS; x++) {
      const actual = getActualCoordinates(x, y, mapLevel);
      const key = `${actual.x},${actual.y}`;
      
      if (layer === LAYERS.TERRAIN) {
        worldLayers[layer].set(key, DEFAULT_TERRAIN[mapLevel]);
      } else {
        worldLayers[layer].delete(key); // Remove from sparse storage
      }
    }
  }
  
  console.log(`Layer ${layer} (${LAYER_NAMES[layer]}) cleared on ${MAP_LEVEL_NAMES[mapLevel]} level`);
  return true;
}

// Item spawn management functions
function initializeItemSpawns() {
  // Wait for inventory module to be available before starting spawn system
  const checkInventoryModule = () => {
    if (window.inventoryModule && window.inventoryModule.createFloorItem) {
      console.log('Item spawn system: Inventory module available, starting spawn checks');
      
      // Process any pending spawns
      if (pendingSpawns.length > 0) {
        console.log(`Item spawn system: Processing ${pendingSpawns.length} pending spawns`);
        pendingSpawns.forEach(pendingSpawn => {
          spawnItemAtLocation(pendingSpawn.x, pendingSpawn.y, pendingSpawn.spawnKey);
        });
        pendingSpawns = []; // Clear the queue
      }
      
      // Start item spawn checking
      setInterval(checkItemSpawns, 1000); // Check every second
      console.log('Item spawn system initialized');
    } else {
      console.log('Item spawn system: Waiting for inventory module...');
      setTimeout(checkInventoryModule, 100); // Check again in 100ms
    }
  };
  
  checkInventoryModule();
}

function loadItemSpawns(spawnData) {
  if (!spawnData) {
    console.log('loadItemSpawns: No spawn data provided');
    return;
  }
  
  console.log('loadItemSpawns: Loading spawn data:', spawnData);
  itemSpawns = JSON.parse(JSON.stringify(spawnData)); // Deep copy
  activeSpawnedItems = {}; // Reset active items
  
  console.log('loadItemSpawns: Copied spawn data, total spawns:', Object.keys(itemSpawns).length);
  
  // Spawn initial items for all spawn points
  Object.keys(itemSpawns).forEach(spawnKey => {
    const [x, y] = spawnKey.split(',').map(Number);
    console.log(`loadItemSpawns: Processing spawn at (${x}, ${y})`, itemSpawns[spawnKey]);
    spawnItemAtLocation(x, y, spawnKey);
  });
  
  console.log(`Loaded ${Object.keys(itemSpawns).length} item spawn points`);
}

function spawnItemAtLocation(x, y, spawnKey) {
  console.log(`spawnItemAtLocation: Called for (${x}, ${y}), key: ${spawnKey}`);
  
  // If we're online, the server handles spawning - don't spawn client-side
  if (window.isUserOnline && window.isUserOnline()) {
    console.log(`spawnItemAtLocation: Online mode - server handles spawning for ${spawnKey}`);
    return;
  }
  
  if (!itemSpawns[spawnKey]) {
    console.log(`spawnItemAtLocation: No spawn config found for key ${spawnKey}`);
    return;
  }
  
  const spawnConfig = itemSpawns[spawnKey];
  console.log(`spawnItemAtLocation: Spawn config:`, spawnConfig);
  
  // Don't spawn if item already exists at this location
  if (activeSpawnedItems[spawnKey]) {
    console.log(`spawnItemAtLocation: Item already exists at ${spawnKey}:`, activeSpawnedItems[spawnKey]);
    return;
  }
  
  // Check if enough time has passed since last pickup
  if (spawnConfig.lastPickupTime && Date.now() - spawnConfig.lastPickupTime < spawnConfig.respawnTime) {
    const timeLeft = spawnConfig.respawnTime - (Date.now() - spawnConfig.lastPickupTime);
    console.log(`spawnItemAtLocation: Respawn cooldown active for ${spawnKey}, ${Math.ceil(timeLeft/1000)}s remaining`);
    return;
  }
  
  // Create floor item using inventory module (offline mode only)
  console.log('spawnItemAtLocation: Checking inventory module availability');
  if (window.inventoryModule && window.inventoryModule.createFloorItem) {
    const item = {
      id: spawnConfig.itemId,
      quantity: spawnConfig.quantity
    };
    
    console.log(`spawnItemAtLocation: Creating floor item:`, item, `at (${x}, ${y})`);
    const floorItemId = window.inventoryModule.createFloorItem(item, x, y);
    
    if (floorItemId) {
      activeSpawnedItems[spawnKey] = {
        floorItemId: floorItemId,
        spawnTime: Date.now()
      };
      
      console.log(`Spawned ${spawnConfig.itemId} x${spawnConfig.quantity} at (${x}, ${y}) with ID: ${floorItemId}`);
      
      // Force world re-render to show the spawned item immediately
      forceWorldRerender();
    } else {
      console.error(`spawnItemAtLocation: Failed to create floor item at (${x}, ${y})`);
    }
  } else {
    console.log('spawnItemAtLocation: inventoryModule.createFloorItem not available, queuing spawn');
    // Queue this spawn for when the module becomes available
    pendingSpawns.push({ x, y, spawnKey });
    console.log(`spawnItemAtLocation: Queued spawn for (${x}, ${y}), total pending: ${pendingSpawns.length}`);
  }
}

function checkItemSpawns() {
  // If we're online, the server handles spawn checking - don't do it client-side
  if (window.isUserOnline && window.isUserOnline()) {
    return;
  }
  
  const spawnKeys = Object.keys(itemSpawns);
  if (spawnKeys.length === 0) {
    // Only log this occasionally to avoid spam
    if (Math.random() < 0.01) { // 1% chance to log
      console.log('checkItemSpawns: No spawns configured');
    }
    return;
  }
  
  console.log(`checkItemSpawns: Processing ${spawnKeys.length} spawn points:`, spawnKeys);
  
  spawnKeys.forEach(spawnKey => {
    const [x, y] = spawnKey.split(',').map(Number);
    const spawnConfig = itemSpawns[spawnKey];
    
    console.log(`checkItemSpawns: Checking spawn ${spawnKey} - config:`, spawnConfig);
    
    // Check if item needs to be spawned
    if (!activeSpawnedItems[spawnKey]) {
      // No item currently at this spawn point
      if (!spawnConfig.lastPickupTime || Date.now() - spawnConfig.lastPickupTime >= spawnConfig.respawnTime) {
        console.log(`checkItemSpawns: Spawn ${spawnKey} ready to spawn`);
        spawnItemAtLocation(x, y, spawnKey);
      } else {
        const timeLeft = spawnConfig.respawnTime - (Date.now() - spawnConfig.lastPickupTime);
        console.log(`checkItemSpawns: Spawn ${spawnKey} on cooldown, ${Math.ceil(timeLeft/1000)}s remaining`);
      }
    } else {
      // Check if spawned item still exists
      const activeItem = activeSpawnedItems[spawnKey];
      console.log(`checkItemSpawns: Spawn ${spawnKey} has active item:`, activeItem);
      
      if (window.inventoryModule && window.inventoryModule.getFloorItemsAt) {
        const itemsAtLocation = window.inventoryModule.getFloorItemsAt(x, y);
        const itemExists = itemsAtLocation.some(item => item.id === activeItem.floorItemId);
        
        console.log(`checkItemSpawns: Items at (${x}, ${y}):`, itemsAtLocation.length, 'items, active item exists:', itemExists);
        
        if (!itemExists) {
          // Item was picked up or removed
          console.log(`Item at spawn ${spawnKey} was picked up`);
          itemSpawns[spawnKey].lastPickupTime = Date.now();
          delete activeSpawnedItems[spawnKey];
        }
      }
    }
  });
}

// Create the world canvas and container
function createWorldCanvas() {
  console.log('Creating world canvas...');
  
  // Find or create the world container
  let worldElement = document.getElementById('game-world');
  if (!worldElement) {
    console.log('Game world element not found, creating new one...');
    worldElement = document.createElement('div');
    worldElement.id = 'game-world';
    worldElement.className = 'game-world';
    // Append to the game tab (left side) instead of skills tab (right side)
    const gameTab = document.querySelector('#game-tab');
    if (gameTab) {
      console.log('Found game tab, appending world element');
      gameTab.appendChild(worldElement);
    } else {
      console.error('Game tab not found! Falling back to body.');
      document.body.appendChild(worldElement);
    }
  } else {
    console.log('Found existing game world element');
  }
  
  // Set up the world container (viewport size, not world size)
  worldElement.style.width = `${GRID_SIZE * VIEWPORT_COLS}px`;
  worldElement.style.height = `${GRID_SIZE * VIEWPORT_ROWS}px`;
  worldElement.style.position = 'relative';
  worldElement.style.backgroundColor = '#5a8c3e'; // Grass color
  worldElement.style.overflow = 'hidden';
  worldElement.style.boxShadow = 'inset 0 0 10px rgba(0,0,0,0.3)';
  worldElement.tabIndex = 0; // Make it focusable
  worldElement.style.outline = 'none'; // Remove focus outline
  
  // Attach zoom handler
  worldElement.addEventListener('wheel', handleZoomWheel, { passive: false });
  
  console.log(`World element styled: ${worldElement.style.width} x ${worldElement.style.height}`);
  
  // Clear any existing content
  worldElement.innerHTML = '';
  
  // Create the player character
  const player = document.createElement('div');
  player.id = 'player-character';
  player.className = 'player-character';
  player.style.position = 'absolute';
  player.style.width = `${Math.round(GRID_SIZE * 1.0)}px`; // Increased from 0.67 to 1.0
  player.style.height = `${Math.round(GRID_SIZE * 1.0)}px`; // Increased from 0.67 to 1.0
  player.style.borderRadius = '0'; // Remove circular border for sprites
  // player.style.transition = 'transform 0.2s ease'; // Paper Mario-like flip effect commented out
  player.style.zIndex = '10';
  // Center the player within the grid cell
  player.style.marginLeft = '0px'; // Centered positioning
  player.style.marginTop = '0px'; // Centered positioning
  
  // Initialize player sprite instead of background color
  if (window.userModule && window.userModule.updatePlayerSprite) {
    window.userModule.updatePlayerSprite();
    console.log('🎭 Player sprite applied during world creation');
  } else {
    // Fallback to blue color if user module not loaded yet
    player.style.backgroundColor = '#3498db';
    console.log('🎭 Using fallback blue color - user module not ready');
    
    // Try to update sprite after a short delay
    setTimeout(() => {
      if (window.userModule && window.userModule.updatePlayerSprite) {
        window.userModule.updatePlayerSprite();
        console.log('🎭 Player sprite applied after delay');
      }
    }, 500);
  }
  
  worldElement.appendChild(player);
  
  console.log('Player character created and added to world');
  // Attach mouse-wheel zoom handler (added once here)
  worldElement.addEventListener('wheel', handleZoomWheel, { passive: false });
  
  // Add click handlers for movement and interaction
  addWorldEventListeners(worldElement);
  
  // Focus the world element so Enter key handling works immediately
  setTimeout(() => {
    worldElement.focus();
  }, 100);
  
  console.log('World canvas created successfully');
  return worldElement;
}

// Add event listeners to the world element
function addWorldEventListeners(worldElement) {
  // Add click handler for movement
  worldElement.addEventListener('click', (e) => {
    // Check if this click was on a floor item (should be prevented)
    if (e.target.classList.contains('floor-item') || e.target.closest('.floor-item')) {
      console.log('WORLD CLICK: Click on floor item detected, ignoring');
      return;
    }
    
    // Check if this click was on a world object (bank, etc.)
    if (e.target.classList.contains('world-object') || e.target.closest('.world-object')) {
      const objectElement = e.target.classList.contains('world-object') ? e.target : e.target.closest('.world-object');
      const objectX = parseInt(objectElement.dataset.x);
      const objectY = parseInt(objectElement.dataset.y);
      const objectType = objectElement.dataset.type;
      
      console.log(`WORLD CLICK: Clicked on ${objectType} at (${objectX}, ${objectY})`);
      
      if (objectType === 'bank') {
        console.log('WORLD CLICK: Processing bank click...');
        handleBankClick(objectX, objectY);
      } else if (objectType?.startsWith('shop_')) {
        console.log('WORLD CLICK: Processing shop click...');
        handleShopClick(objectType, objectX, objectY);
      } else if (objectType.startsWith('ore_')) {
        console.log('WORLD CLICK: Processing ore click...');
        handleOreClick(objectType, objectX, objectY);
      } else if (objectType.startsWith('tree_')) {
        console.log('WORLD CLICK: Processing tree click...');
        handleTreeClick(objectType, objectX, objectY);
      }
      return;
    }
    
    console.log('WORLD CLICK: Processing world movement click');
    
    // Cancel any ongoing mining when clicking elsewhere
    if (window.miningModule && window.miningModule.cancelMining && window.miningModule.isMining) {
      if (window.miningModule.isMining()) {
        console.log('WORLD CLICK: Cancelling ongoing mining');
        window.miningModule.cancelMining();
      }
    }
    
    // Cancel any ongoing woodcutting when clicking elsewhere
    if (window.isWoodcutting && window.cancelWoodcutting) {
      if (window.isWoodcutting()) {
        console.log('WORLD CLICK: Cancelling ongoing woodcutting');
        window.cancelWoodcutting();
      }
    }
    
    // Cancel any ongoing fletching when clicking elsewhere
    if (window.isFletching && window.cancelFletching) {
      if (window.isFletching()) {
        console.log('WORLD CLICK: Cancelling ongoing fletching');
        window.cancelFletching();
      }
    }
    
    // Cancel any ongoing scribing when clicking elsewhere
    if (window.isScribing && window.cancelScribing) {
      if (window.isScribing()) {
        console.log('WORLD CLICK: Cancelling ongoing scribing');
        window.cancelScribing();
      }
    }
    
    // Cancel any ongoing fishing when clicking elsewhere
    if (window.isFishing && window.cancelFishing) {
      if (window.isFishing()) {
        console.log('WORLD CLICK: Cancelling ongoing fishing');
        window.cancelFishing();
      }
    }
    
    // Cancel any ongoing harvesting when clicking elsewhere
    if (window.isHarvesting && window.cancelHarvesting) {
      if (window.isHarvesting()) {
        console.log('WORLD CLICK: Cancelling ongoing harvesting');
        window.cancelHarvesting();
      }
    }
    
    // Clear any pending interaction targets to prevent interference
    window.interactionTarget = null;
    
    const rect = worldElement.getBoundingClientRect();
    const viewportClickX = (e.clientX - rect.left) / GRID_SIZE;
    const viewportClickY = (e.clientY - rect.top) / GRID_SIZE;
    
    // Convert viewport coordinates to world coordinates using exact camera position
    const worldClickX = Math.floor(cameraPosition.x + viewportClickX);
    const worldClickY = Math.floor(cameraPosition.y + viewportClickY);
    
    // Only allow clicking within world bounds
    if (worldClickX >= 0 && worldClickX < WORLD_COLS && worldClickY >= 0 && worldClickY < WORLD_ROWS) {
      console.log(`WORLD CLICK: Clicking to move to: (${worldClickX}, ${worldClickY})`);
      
      // Show click animation at world coordinates
      showClickAnimation(worldElement, worldClickX, worldClickY);
      
      movePlayerToTarget(worldClickX, worldClickY);
    }
  });
  
  // Add right-click context menu handler
  worldElement.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const rect = worldElement.getBoundingClientRect();
    const viewportClickX = (e.clientX - rect.left) / GRID_SIZE;
    const viewportClickY = (e.clientY - rect.top) / GRID_SIZE;
    
    // Convert viewport coordinates to world coordinates
    const worldClickX = Math.floor(cameraPosition.x + viewportClickX);
    const worldClickY = Math.floor(cameraPosition.y + viewportClickY);
    
    // Only show context menu within world bounds
    if (worldClickX >= 0 && worldClickX < WORLD_COLS && worldClickY >= 0 && worldClickY < WORLD_ROWS) {
      console.log(`WORLD RIGHT-CLICK: Showing context menu at: (${worldClickX}, ${worldClickY})`);
      showGroundContextMenu(e, worldClickX, worldClickY);
    }
  });
}

// Render the world (initial render and updates)
// Track if we've done the initial cleanup
let initialCleanupDone = false;

function renderWorld(worldElement) {
  if (!worldElement) {
    worldElement = document.getElementById('game-world');
  }
  
  if (worldElement) {
    // Clear all existing elements on initial render only to prevent lingering elements
    if (!initialCleanupDone) {
      clearAllWorldElements(worldElement);
      initialCleanupDone = true;
    }
    updateCamera();
    renderViewport(worldElement);
  }
}

// Clear all world elements (for startup cleanup)
function clearAllWorldElements(worldElement) {
  // Clear all terrain elements
  const existingTerrain = worldElement.querySelectorAll('.obstacle, .water, .terrain-sand, .terrain-stone, .terrain-brick-wall, .terrain-dirt, .terrain-cobblestone, .terrain-wooden-floor, .terrain-stone-wall, .terrain-wood-wall, .terrain-metal-wall, .terrain-crystal-wall, .terrain-marble-wall, .terrain-obsidian-wall, .terrain-ice-wall, .terrain-thorned-wall, .terrain-gravel, .terrain-snow, .terrain-mud, .terrain-lava, .terrain-swamp, .terrain-tundra, .terrain-desert-stone, .terrain-mossy-stone, .terrain-sandstone-wall, .terrain-coral-wall, .terrain-bone-wall, .terrain-magic-barrier, .terrain-volcanic-rock, .terrain-bamboo-wall, .terrain-iron-bars, .terrain-energy-field, .terrain-marble-floor, .terrain-carpet, .terrain-metal-grating, .terrain-crystal-floor, .terrain-lava-rock, .terrain-ice-floor, .terrain-grass-path, .terrain-ancient-tiles');
  existingTerrain.forEach(terrain => terrain.remove());
  
  // Clear all world objects (legacy)
  const existingWorldObjects = worldElement.querySelectorAll('.world-object');
  existingWorldObjects.forEach(obj => obj.remove());
  
  // Clear all layer elements (managed by new system)
  const existingLayerElements = worldElement.querySelectorAll('.layer-element');
  existingLayerElements.forEach(element => element.remove());
  
  // Clear all floor items (these regenerate from inventory data)
  const existingFloorItems = worldElement.querySelectorAll('.floor-item');
  existingFloorItems.forEach(item => item.remove());
  
  // Clear any legacy object classes
  const legacyObjects = worldElement.querySelectorAll('.ores, .trees, .rocks, .banks, .shops');
  legacyObjects.forEach(obj => obj.remove());
  
  // Clear the render cache
  renderedElements.clear();
  
  console.log('Cleared all existing world elements for fresh rendering');
}

// Update camera position to follow player
function updateCamera() {
  // Center camera on player with smooth floating-point positioning
  const targetCameraX = playerPosition.x - VIEWPORT_COLS / 2;
  const targetCameraY = playerPosition.y - VIEWPORT_ROWS / 2;
  
  // Clamp camera to world bounds (still using floating point)
  cameraPosition.x = Math.max(0, Math.min(WORLD_COLS - VIEWPORT_COLS, targetCameraX));
  cameraPosition.y = Math.max(0, Math.min(WORLD_ROWS - VIEWPORT_ROWS, targetCameraY));
  
  // Check if camera moved to a new tile position for rendering optimization
  const newCameraTileX = Math.floor(cameraPosition.x);
  const newCameraTileY = Math.floor(cameraPosition.y);
  const cameraTileMoved = newCameraTileX !== lastCameraTilePosition.x || newCameraTileY !== lastCameraTilePosition.y;
  
  if (cameraTileMoved) {
    // Re-render terrain and objects when camera moves to a new tile
  renderViewport(document.getElementById('game-world'));
    lastCameraTilePosition = { x: newCameraTileX, y: newCameraTileY };
  } else {
    // Update existing element positions for smooth movement without re-rendering terrain
    updateExistingElementPositions(document.getElementById('game-world'));
  }
  
  // Update floor item positions using inventory module (backup for items outside viewport)
  if (window.inventoryModule && window.inventoryModule.updateAllFloorItemPositions) {
    window.inventoryModule.updateAllFloorItemPositions();
  }
  }
  
// Update positions of existing elements for smooth camera movement without re-rendering
function updateExistingElementPositions(worldElement) {
  if (!worldElement) return;
  
  // Use camera's exact floating-point position for smooth scrolling
  const cameraOffsetX = cameraPosition.x - Math.floor(cameraPosition.x);
  const cameraOffsetY = cameraPosition.y - Math.floor(cameraPosition.y);
  
  // Update terrain elements
  const terrainElements = worldElement.querySelectorAll('.obstacle, .water, .terrain-sand, .terrain-stone, .terrain-brick-wall, .terrain-dirt, .terrain-cobblestone, .terrain-wooden-floor, .terrain-stone-wall, .terrain-wood-wall, .terrain-metal-wall, .terrain-crystal-wall, .terrain-marble-wall, .terrain-obsidian-wall, .terrain-ice-wall, .terrain-glass-wall, .terrain-lava');
  terrainElements.forEach(element => {
    updateElementPosition(element, cameraOffsetX, cameraOffsetY);
  });
  
  // Update object elements (including floor items for smooth movement)
  const objectElements = worldElement.querySelectorAll('.ores, .trees, .rocks, .banks, .shops, .layer-element, .floor-item');
  objectElements.forEach(element => {
    updateElementPosition(element, cameraOffsetX, cameraOffsetY);
  });
  
  // Update click effects
  const clickEffects = worldElement.querySelectorAll('.click-effect');
  clickEffects.forEach(clickEffect => {
    updateClickEffectPosition(clickEffect);
  });
  
  // Update online players' positions using the optimized function
  if (window.updateAllOnlinePlayersPositions) {
    window.updateAllOnlinePlayersPositions();
  } else {
    // Fallback to the old method if the function isn't available
    const onlinePlayers = worldElement.querySelectorAll('.online-player');
    onlinePlayers.forEach(playerElement => {
      if (window.updateOnlinePlayerPosition) {
        window.updateOnlinePlayerPosition(playerElement);
      }
    });
  }
  
  // Update NPC positions
  if (window.npcModule && window.npcModule.updateAllNPCPositions) {
    window.npcModule.updateAllNPCPositions();
  }
  
  // Update digging hole positions
  updateDiggingHolePositions(cameraOffsetX, cameraOffsetY);
}

// Render fruit tree with overlaid fruits in triangular formation
function renderFruitTreeWithOverlay(element, nodeType, resourceCount) {
  // Clear previous content but maintain element styling for camera system compatibility
  element.innerHTML = '';
  
  // If depleted, show dead tree emoji only
  if (resourceCount <= 0) {
    element.innerHTML = '🪾'; // Dead tree emoji
    element.style.fontSize = '32px';
    element.style.textShadow = '1px 1px 1px #000000, -1px -1px 1px #000000, 1px -1px 1px #000000, -1px 1px 1px #000000';
    element.style.backgroundColor = '';
    element.style.border = '';
    element.style.borderRadius = '';
    return;
  }
  
  // Create container for the tree and fruits
  const container = document.createElement('div');
  container.style.position = 'relative';
  container.style.display = 'inline-block';
  container.style.width = '100%';
  container.style.height = '100%';
  
  // Base tree emoji
  const treeBase = document.createElement('span');
  treeBase.textContent = '🌳';
  treeBase.style.fontSize = '32px';
  treeBase.style.position = 'relative';
  treeBase.style.display = 'block';
  treeBase.style.textAlign = 'center';
  treeBase.style.lineHeight = '1';
  treeBase.style.textShadow = '1px 1px 1px #000000, -1px -1px 1px #000000, 1px -1px 1px #000000, -1px 1px 1px #000000';
  
  // Get fruit emoji based on tree type
  let fruitEmoji = '🍎'; // default
  switch (nodeType) {
    case 'apple_tree':
      fruitEmoji = '🍎';
      break;
    case 'cherry_tree':
      fruitEmoji = '🍒';
      break;
    case 'peach_tree':
      fruitEmoji = '🍑';
      break;
  }
  
  // Determine how many fruits to show (max 3 visible)
  const visibleFruits = Math.min(resourceCount, 3);
  
  // Create fruit overlays in triangular formation (even smaller and shifted left)
  const fruitPositions = [
    { top: '2px', left: '15px' },    // Top fruit (centered, moved left)
    { top: '12px', left: '6px' },    // Bottom left fruit  
    { top: '12px', left: '24px' }    // Bottom right fruit (moved left)
  ];
  
  for (let i = 0; i < visibleFruits; i++) {
    const fruit = document.createElement('span');
    fruit.textContent = fruitEmoji;
    fruit.style.position = 'absolute';
    fruit.style.fontSize = '10px';  // Even smaller size
    fruit.style.top = fruitPositions[i].top;
    fruit.style.left = fruitPositions[i].left;
    fruit.style.zIndex = '2';
    fruit.style.pointerEvents = 'none';
    fruit.style.textShadow = '0.5px 0.5px 0.5px #000000, -0.5px -0.5px 0.5px #000000, 0.5px -0.5px 0.5px #000000, -0.5px 0.5px 0.5px #000000';
    
    container.appendChild(fruit);
  }
  
  container.appendChild(treeBase);
  element.appendChild(container);
}

// Render harvesting nodes with overlay system for mushrooms and wheat
function renderHarvestingNodeWithOverlay(element, nodeType, resourceCount) {
  // Clear previous content
  element.innerHTML = '';
  
  if (nodeType.endsWith('_tree')) {
    renderFruitTreeWithOverlay(element, nodeType, resourceCount);
    return;
  }
  
  // For mushrooms and wheat, use overlay system without tree base
  // Get node config from harvesting module or use defaults
  let nodeConfig = null;
  if (window.harvestingModule && window.harvestingModule.getHarvestingNodes) {
    nodeConfig = window.harvestingModule.getHarvestingNodes()[nodeType];
  }
  
  if (!nodeConfig) {
    // Fallback configuration
    const fallbackConfigs = {
      'mushroom_patch': { maxVisibleFruit: 4 },
      'wheat_field': { maxVisibleFruit: 3 }
    };
    nodeConfig = fallbackConfigs[nodeType] || { maxVisibleFruit: 3 };
  }
  
  // If depleted, create darkened ground effect instead of indicator
  if (resourceCount <= 0) {
    element.innerHTML = '';
    element.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
    element.style.border = '1px solid rgba(0, 0, 0, 0.5)';
    element.style.borderRadius = '3px';
    return;
  }
  
  // Create container for overlays
  const container = document.createElement('div');
  container.style.position = 'relative';
  container.style.display = 'inline-block';
  container.style.width = '100%';
  container.style.height = '100%';
  
  // Determine how many to show
  const visibleItems = Math.min(resourceCount, nodeConfig.maxVisibleFruit || 3);
  
  if (nodeType === 'mushroom_patch') {
    // For mushrooms, show multiple mushrooms
    const mushroomPositions = [
      { top: '8px', left: '10px' },   // Center (moved left)
      { top: '16px', left: '4px' },   // Left (moved left)
      { top: '16px', left: '16px' },  // Right (moved left)
      { top: '4px', left: '18px' }    // Top right (moved left)
    ];
    
    for (let i = 0; i < visibleItems; i++) {
      const mushroom = document.createElement('span');
      mushroom.textContent = '🍄';
      mushroom.style.position = 'absolute';
      mushroom.style.fontSize = '12px';  // Smaller mushrooms
      mushroom.style.top = mushroomPositions[i]?.top || '8px';
      mushroom.style.left = mushroomPositions[i]?.left || '12px';
      mushroom.style.textShadow = '1px 1px 1px #000000, -1px -1px 1px #000000, 1px -1px 1px #000000, -1px 1px 1px #000000';
      
      container.appendChild(mushroom);
    }
  } else if (nodeType === 'wheat_field') {
    // For wheat, render stalks – Firefox struggles with the heavy shadows, so
    // drastically reduce DOM work there.

    const isFirefox = navigator.userAgent.toLowerCase().includes('firefox');

    const wheatPositions = [
      { top: '4px', left: '10px' },
      { top: '4px', left: '18px' },
      { top: '4px', left: '26px' }
    ];

    const maxStalks = isFirefox ? 1 : visibleItems; // only one span per tile on FF

    for (let i = 0; i < maxStalks; i++) {
      const wheat = document.createElement('span');
      wheat.textContent = '🌾';
      wheat.style.position = 'absolute';
      wheat.style.fontSize = '14px';
      wheat.style.top = wheatPositions[i]?.top || '4px';
      wheat.style.left = wheatPositions[i]?.left || '16px';

      // Skip expensive shadows on Firefox
      if (!isFirefox) {
        wheat.style.textShadow = '1px 1px 1px #000000, -1px -1px 1px #000000, 1px -1px 1px #000000, -1px 1px 1px #000000';
      }

      container.appendChild(wheat);
    }
  }
  
  element.appendChild(container);
}

// Expose the functions globally for the harvesting module to use
window.renderFruitTreeWithOverlay = renderFruitTreeWithOverlay;
window.renderHarvestingNodeWithOverlay = renderHarvestingNodeWithOverlay;

// Cache for rendered elements to avoid re-creating unchanged objects
const renderedElements = new Map(); // key: "x,y,layer", value: element

// Render the visible portion of the world
function renderViewport(worldElement) {
  // Use camera's exact floating-point position for smooth scrolling
  const cameraOffsetX = cameraPosition.x - Math.floor(cameraPosition.x);
  const cameraOffsetY = cameraPosition.y - Math.floor(cameraPosition.y);
  
  // Start from the tile that contains the camera position
  const startTileX = Math.floor(cameraPosition.x);
  const startTileY = Math.floor(cameraPosition.y);
  
  // Track which elements should be visible this frame
  const visibleElementKeys = new Set();
  
  // Helper function to determine if a tile is on the outermost edge (should be force-updated)
  const isOutermostEdge = (viewX, viewY) => {
    return (viewX === -1 || viewX === VIEWPORT_COLS || 
            viewY === -1 || viewY === VIEWPORT_ROWS);
  };
  
  // Check if we're running in Firefox (needs more aggressive re-rendering)
  const isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
  
  // Update positions of any active click effects
  const activeClickEffects = worldElement.querySelectorAll('.click-effect');
  activeClickEffects.forEach(clickEffect => {
    updateClickEffectPosition(clickEffect);
  });

  // Process tiles in back-to-front order for proper z-index layering
  // This ensures walls further back are rendered first, so their shadows appear under walls in front
  for (let viewY = -1; viewY <= VIEWPORT_ROWS; viewY++) {
    for (let viewX = -1; viewX <= VIEWPORT_COLS; viewX++) {
      const worldX = startTileX + viewX;
      const worldY = startTileY + viewY;
      
      // Check if this world position is within bounds
      if (worldX >= 0 && worldX < WORLD_COLS && worldY >= 0 && worldY < WORLD_ROWS) {
        
        // Position relative to camera's exact position for smooth scrolling
        const screenX = (viewX - cameraOffsetX) * GRID_SIZE;
        const screenY = (viewY - cameraOffsetY) * GRID_SIZE;
        
        // Render all layers in order (0 = bottom, 3 = top) for current map level
        for (let layer = 0; layer < Object.values(LAYERS).length; layer++) {
          const tileValue = getTileOnLayer(layer, worldX, worldY, currentMapLevel);
          
          // Skip empty/null tiles on non-terrain layers
          if (layer !== LAYERS.TERRAIN && (tileValue === null || tileValue === undefined)) {
            continue;
          }
          
          // Skip grass on terrain layer (default background)
          if (layer === LAYERS.TERRAIN && tileValue === 0) {
            continue;
          }
          
          const elementKey = `${worldX},${worldY},${layer}`;
          visibleElementKeys.add(elementKey);
          
          let element = renderedElements.get(elementKey);
          
          // Check if this is a wall element (needs z-index fix)
          const isWall = layer === LAYERS.TERRAIN && (
            tileValue === 5 || // Brick wall
            (tileValue >= 9 && tileValue <= 16) || // Stone Wall through Thorned Wall
            (tileValue >= 25 && tileValue <= 32) // Sandstone Wall through Energy Field
          );
          
          // Force recreation for edge tiles and wall shadow fixes
          // Firefox: Re-render all elements to avoid rendering inconsistencies
          // Walls: Re-render ALL walls to ensure proper shadow DOM order in all directions
          const shouldForceRecreate = isOutermostEdge(viewX, viewY) || 
                                      (isFirefox) || 
                                      (isWall);
          
          // Only create new element if it doesn't exist, tile value changed, or should force recreate
          if (!element || element.dataset.tileValue !== String(tileValue) || shouldForceRecreate) {
            // Remove old element if it exists
            if (element && element.parentNode) {
              element.parentNode.removeChild(element);
            }
            
            // Create new element
            element = document.createElement('div');
            element.className = 'layer-element';
            element.dataset.layer = layer;
            element.dataset.tileValue = tileValue;
            element.style.position = 'absolute';
            element.style.width = `${GRID_SIZE}px`;
            element.style.height = `${GRID_SIZE}px`;
            
            // Set z-index based on layer, with special handling for walls
            if (isWall) {
              // Walls need special z-index handling for shadows
              // Base z-index of 3, but add small increment based on position for proper layering
              const positionIncrement = (worldY * WORLD_COLS + worldX) * 0.001;
              element.style.zIndex = (3 + positionIncrement).toFixed(3);
            } else {
              const zIndexMap = {
                [LAYERS.TERRAIN]: '1',
                [LAYERS.GROUND_OBJECTS]: '2',
                [LAYERS.INTERACTIVE_OBJECTS]: '8',
                [LAYERS.DECORATIVE_OVERLAYS]: '9'
              };
              element.style.zIndex = zIndexMap[layer] || '1';
            }
            
            // Store position data for smooth movement updates
            element.dataset.worldX = worldX;
            element.dataset.worldY = worldY;
            
            // Apply styling based on layer and tile value
            if (layer === LAYERS.TERRAIN) {
              // Terrain layer styling
              applyTerrainStyling(element, tileValue);
            } else {
              // Object layer styling
              applyObjectStyling(element, layer, tileValue, worldX, worldY);
              
              // Check for depleted ore state using global state map
              const oreKey = `${worldX},${worldY}`;
              if (tileValue && tileValue.startsWith('ore_') && window.depletedOreStates && window.depletedOreStates.has(oreKey)) {
                const depletedState = window.depletedOreStates.get(oreKey);
                console.log(`Restoring depleted ore state for ${tileValue} at (${worldX}, ${worldY}) from global state`);
                
                // Restore depleted appearance
                if (tileValue.startsWith('ore_')) {
                  // Use the proper depleted sprite instead of emoji
                  const oreName = tileValue.replace('ore_', '');
                  element.style.backgroundImage = `url('images/objects/ore/${oreName}_ore_depleted.png')`;
                  element.style.backgroundSize = 'contain';
                  element.style.backgroundRepeat = 'no-repeat';
                  element.style.backgroundPosition = 'center';
                  element.innerHTML = '';
                  element.style.filter = 'none'; // keep crisp
                  // Ensure crisp pixel-art scaling
                  element.style.imageRendering = 'pixelated';
                } else {
                  element.textContent = '🪨';
                }
                element.title = 'Depleted ore (respawning...)';
                element.dataset.depleted = 'true';
              }
            }
            
            renderedElements.set(elementKey, element);
            worldElement.appendChild(element);
          }
          
          // Always update position (for smooth camera movement)
          element.style.left = `${screenX}px`;
          element.style.top = `${screenY}px`;
          element.dataset.viewX = viewX;
          element.dataset.viewY = viewY;
        }
        
        // Handle floor items at this position - check if items have changed
        if (window.inventoryModule && window.inventoryModule.getFloorItemsAt) {
          const itemsAtPosition = window.inventoryModule.getFloorItemsAt(worldX, worldY);
          const currentFloorItems = worldElement.querySelectorAll(`.floor-item[data-world-x="${worldX}"][data-world-y="${worldY}"]`);
          
          // Create a set of current item IDs for comparison
          const currentItemIds = new Set(Array.from(currentFloorItems).map(elem => elem.dataset.floorItemId));
          const newItemIds = new Set(itemsAtPosition.map(item => item.id));
          
          // Remove items that no longer exist
          currentFloorItems.forEach(itemElement => {
            if (!newItemIds.has(itemElement.dataset.floorItemId)) {
              itemElement.remove();
            }
          });
          
          // Add new items that don't exist yet
          itemsAtPosition.forEach(floorItem => {
            if (!currentItemIds.has(floorItem.id)) {
              const itemDef = window.inventoryModule.getItemDefinition(floorItem.item.id);
              if (itemDef) {
                // Create floor item element
                const itemElement = document.createElement('div');
                itemElement.className = 'floor-item';
                
                // Apply color tinting if the item has a colorTint property
                if (itemDef.colorTint) {
                  itemElement.classList.add('tinted');
                  itemElement.style.color = itemDef.colorTint;
                }
                
                // Check if item is noted and render accordingly
                if (floorItem.item.noted === true) {
                  // Render noted item with note background and scaled icon
                  const baseIcon = itemDef.getIcon ? itemDef.getIcon(1) : itemDef.icon;
                  itemElement.innerHTML = `
                    <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">
                      <span style="position: absolute; font-size: 1.2em; z-index: 1; filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.8));">📜</span>
                      <span style="position: relative; z-index: 2; font-size: 0.7em; transform: translate(3px, -2px); filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.6));">${baseIcon}</span>
                      ${floorItem.item.quantity > 1 ? 
                        `<span style="position: absolute; bottom: -5px; right: 2px; color: white; font-size: 10px; font-weight: bold; text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 -1px 0 #000, 0 1px 0 #000, -1px 0 0 #000, 1px 0 0 #000; z-index: 3;">${floorItem.item.quantity}</span>` : ''
                      }
                    </div>
                  `;
                  itemElement.title = `${itemDef.name} (noted)${floorItem.item.quantity > 1 ? ` (${floorItem.item.quantity})` : ''} (Click to pick up, Right-click for options)`;
                } else {
                  // Regular item display
                  const icon = itemDef.getIcon ? itemDef.getIcon(floorItem.item.quantity || 1) : itemDef.icon;
                  itemElement.innerHTML = `
                    ${icon}
                    ${floorItem.item.quantity > 1 ? 
                      `<span style="position: absolute; bottom: -5px; right: 2px; color: white; font-size: 10px; font-weight: bold; text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 -1px 0 #000, 0 1px 0 #000, -1px 0 0 #000, 1px 0 0 #000;">${floorItem.item.quantity}</span>` : ''
                    }
                  `;
                  itemElement.title = `${itemDef.name}${floorItem.item.quantity > 1 ? ` (${floorItem.item.quantity})` : ''} (Click to pick up, Right-click for options)`;
                }
                itemElement.dataset.floorItemId = floorItem.id;
                itemElement.style.position = 'absolute';
                itemElement.style.width = `${GRID_SIZE}px`;
                itemElement.style.height = `${GRID_SIZE}px`;
                itemElement.style.display = 'flex';
                itemElement.style.alignItems = 'center';
                itemElement.style.justifyContent = 'center';
                itemElement.style.fontSize = '20px';
                itemElement.style.cursor = 'pointer';
                itemElement.style.zIndex = '5'; // Lower z-index so floor items render below player and objects
                itemElement.style.backgroundColor = 'transparent'; // Explicitly transparent
                itemElement.style.borderRadius = '4px';
                itemElement.style.transition = 'transform 0.2s';
                itemElement.style.pointerEvents = 'auto'; // Ensure pointer events work
                
                itemElement.style.left = `${screenX}px`;
                itemElement.style.top = `${screenY}px`;
                
                // Store position data for smooth movement updates
                itemElement.dataset.worldX = worldX;
                itemElement.dataset.worldY = worldY;
                // Floor items use world coordinates, not view coordinates
                
                // Add event handlers
                addFloorItemEventHandlers(itemElement, floorItem);
                
                worldElement.appendChild(itemElement);
              }
            }
          });
        }
      }
    }
  }
  
  // Remove elements that are no longer visible
  const elementsToRemove = [];
  for (const [key, element] of renderedElements) {
    if (!visibleElementKeys.has(key) && !key.startsWith('floor_')) {
      elementsToRemove.push(key);
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
    }
  }
  
  // Clean up removed elements from cache
  elementsToRemove.forEach(key => renderedElements.delete(key));
}

// Apply terrain styling to element
function applyTerrainStyling(element, tileValue) {
  switch (tileValue) {
    case 1: // Rock obstacles
      element.className += ' obstacle';
      element.style.backgroundColor = '#654321';
      break;
    case 2: // Sand terrain
      element.className += ' terrain-sand';
      element.style.backgroundColor = '#F4A460';
      element.style.backgroundImage = 'radial-gradient(circle at 30% 40%, rgba(139, 69, 19, 0.2) 1px, transparent 2px)';
      break;
    case 3: // Water tiles
      element.className += ' water';
      element.style.backgroundColor = '#2196F3';
      element.style.backgroundImage = 'linear-gradient(45deg, rgba(255, 255, 255, 0.1) 25%, transparent 25%, transparent 75%, rgba(255, 255, 255, 0.1) 75%)';
      element.style.backgroundSize = '8px 8px';
      break;
    case 4: // Stone floor
      element.className += ' terrain-stone';
      element.style.backgroundColor = '#808080';
      element.style.backgroundImage = 'linear-gradient(45deg, rgba(105, 105, 105, 0.4) 25%, transparent 25%, transparent 75%, rgba(128, 128, 128, 0.4) 75%), linear-gradient(-45deg, rgba(96, 96, 96, 0.3) 25%, transparent 25%, transparent 75%, rgba(112, 112, 112, 0.3) 75%), radial-gradient(circle at 30% 70%, rgba(64, 64, 64, 0.2) 2px, transparent 3px), radial-gradient(circle at 80% 20%, rgba(144, 144, 144, 0.3) 1px, transparent 2px)';
      element.style.backgroundSize = '8px 8px, 6px 6px, 12px 12px, 16px 16px';
      break;
    case 5: // Brick wall
      element.className += ' terrain-brick-wall';
      element.style.backgroundColor = '#8B4513';
      element.style.backgroundImage = 'linear-gradient(90deg, #A0522D 1px, transparent 1px), linear-gradient(180deg, #A0522D 1px, transparent 1px), linear-gradient(0deg, rgba(160, 82, 45, 0.5) 50%, transparent 50%)';
      element.style.backgroundSize = '16px 8px, 16px 8px, 32px 16px';
      break;
    case 6: // Dirt
      element.className += ' terrain-dirt';
      element.style.backgroundColor = '#8B4513';
      element.style.backgroundImage = 'radial-gradient(circle at 25% 25%, rgba(139, 69, 19, 0.3) 1px, transparent 2px)';
      break;
    case 7: // Cobblestone
      element.className += ' terrain-cobblestone';
      element.style.backgroundColor = '#708090';
      element.style.backgroundImage = 'linear-gradient(45deg, rgba(112, 128, 144, 0.2) 25%, transparent 25%, transparent 75%, rgba(105, 105, 105, 0.3) 75%)';
      element.style.backgroundSize = '12px 12px';
      break;
    case 8: // Wooden floor
      element.className += ' terrain-wooden-floor';
      element.style.backgroundColor = '#D2691E';
      element.style.backgroundImage = 'linear-gradient(90deg, rgba(160, 82, 45, 0.2) 2px, transparent 2px)';
      element.style.backgroundSize = '20px 4px';
      break;
    
    // New Wall Types (9-16) - obstacles
    case 9: // Stone Wall
      element.className += ' terrain-stone-wall';
      element.style.backgroundColor = '#696969';
      element.style.backgroundImage = 'linear-gradient(45deg, rgba(105, 105, 105, 0.4) 25%, transparent 25%, transparent 75%, rgba(128, 128, 128, 0.4) 75%), linear-gradient(-45deg, rgba(169, 169, 169, 0.3) 25%, transparent 25%, transparent 75%, rgba(105, 105, 105, 0.3) 75%)';
      element.style.backgroundSize = '10px 10px, 12px 12px';
      break;
    case 10: // Wood Wall
      element.className += ' terrain-wood-wall';
      element.style.backgroundColor = '#8B4513';
      element.style.backgroundImage = 'linear-gradient(90deg, rgba(139, 69, 19, 0.5) 4px, transparent 4px), linear-gradient(0deg, rgba(160, 82, 45, 0.3) 2px, transparent 2px)';
      element.style.backgroundSize = '16px 8px, 8px 16px';
      break;
    case 11: // Metal Wall
      element.className += ' terrain-metal-wall';
      element.style.backgroundColor = '#C0C0C0';
      element.style.backgroundImage = 'linear-gradient(45deg, rgba(192, 192, 192, 0.8) 25%, transparent 25%, transparent 75%, rgba(169, 169, 169, 0.8) 75%), radial-gradient(circle at 50% 50%, rgba(211, 211, 211, 0.6) 2px, transparent 3px)';
      element.style.backgroundSize = '8px 8px, 16px 16px';
      break;
    case 12: // Crystal Wall
      element.className += ' terrain-crystal-wall';
      element.style.backgroundColor = '#E6E6FA';
      element.style.backgroundImage = 'linear-gradient(60deg, rgba(138, 43, 226, 0.3) 25%, transparent 25%, transparent 75%, rgba(148, 0, 211, 0.3) 75%), linear-gradient(-60deg, rgba(75, 0, 130, 0.2) 25%, transparent 25%, transparent 75%, rgba(123, 104, 238, 0.2) 75%)';
      element.style.backgroundSize = '12px 12px, 10px 10px';
      break;
    case 13: // Marble Wall
      element.className += ' terrain-marble-wall';
      element.style.backgroundColor = '#F8F8FF';
      element.style.backgroundImage = 'linear-gradient(45deg, rgba(220, 220, 220, 0.4) 25%, transparent 25%, transparent 75%, rgba(211, 211, 211, 0.4) 75%), radial-gradient(circle at 30% 70%, rgba(192, 192, 192, 0.3) 3px, transparent 4px)';
      element.style.backgroundSize = '14px 14px, 20px 20px';
      break;
    case 14: // Obsidian Wall
      element.className += ' terrain-obsidian-wall';
      element.style.backgroundColor = '#000000';
      element.style.backgroundImage = 'linear-gradient(45deg, rgba(64, 64, 64, 0.6) 25%, transparent 25%, transparent 75%, rgba(32, 32, 32, 0.6) 75%), radial-gradient(circle at 60% 40%, rgba(128, 128, 128, 0.2) 1px, transparent 2px)';
      element.style.backgroundSize = '10px 10px, 18px 18px';
      break;
    case 15: // Ice Wall
      element.className += ' terrain-ice-wall';
      element.style.backgroundColor = '#B0E0E6';
      element.style.backgroundImage = 'linear-gradient(30deg, rgba(135, 206, 235, 0.5) 25%, transparent 25%, transparent 75%, rgba(173, 216, 230, 0.5) 75%), linear-gradient(-30deg, rgba(175, 238, 238, 0.4) 25%, transparent 25%, transparent 75%, rgba(176, 224, 230, 0.4) 75%)';
      element.style.backgroundSize = '12px 12px, 8px 8px';
      break;
    case 16: // Thorned Wall
      element.className += ' terrain-thorned-wall';
      element.style.backgroundColor = '#2F4F2F';
      element.style.backgroundImage = 'radial-gradient(circle at 25% 25%, rgba(34, 139, 34, 0.6) 2px, transparent 3px), radial-gradient(circle at 75% 75%, rgba(46, 125, 50, 0.5) 1px, transparent 2px), linear-gradient(45deg, rgba(85, 107, 47, 0.3) 25%, transparent 25%)';
      element.style.backgroundSize = '8px 8px, 12px 12px, 16px 16px';
      break;
    
    // New Terrain Types (17-24) - walkable surfaces
    case 17: // Gravel
      element.className += ' terrain-gravel';
      element.style.backgroundColor = '#808080';
      element.style.backgroundImage = 'radial-gradient(circle at 20% 30%, rgba(105, 105, 105, 0.8) 1px, transparent 2px), radial-gradient(circle at 60% 70%, rgba(128, 128, 128, 0.6) 1px, transparent 2px), radial-gradient(circle at 80% 20%, rgba(169, 169, 169, 0.7) 1px, transparent 2px)';
      element.style.backgroundSize = '6px 6px, 8px 8px, 10px 10px';
      break;
    case 18: // Snow
      element.className += ' terrain-snow';
      element.style.backgroundColor = '#FFFAFA';
      element.style.backgroundImage = 'radial-gradient(circle at 25% 25%, rgba(240, 248, 255, 0.8) 2px, transparent 3px), radial-gradient(circle at 75% 75%, rgba(248, 248, 255, 0.6) 1px, transparent 2px)';
      element.style.backgroundSize = '12px 12px, 8px 8px';
      break;
    case 19: // Mud
      element.className += ' terrain-mud';
      element.style.backgroundColor = '#654321';
      element.style.backgroundImage = 'radial-gradient(circle at 30% 40%, rgba(101, 67, 33, 0.8) 3px, transparent 4px), linear-gradient(45deg, rgba(139, 69, 19, 0.4) 25%, transparent 25%, transparent 75%, rgba(160, 82, 45, 0.4) 75%)';
      element.style.backgroundSize = '16px 16px, 10px 10px';
      break;
    case 20: // Lava
      element.className += ' terrain-lava';
      element.style.backgroundColor = '#FF4500';
      element.style.backgroundImage = 'radial-gradient(circle at 40% 60%, rgba(255, 0, 0, 0.7) 4px, transparent 5px), linear-gradient(45deg, rgba(255, 69, 0, 0.6) 25%, transparent 25%, transparent 75%, rgba(255, 140, 0, 0.6) 75%)';
      element.style.backgroundSize = '20px 20px, 12px 12px';
      element.style.animation = 'lava-glow 2s ease-in-out infinite alternate';
      break;
    case 21: // Swamp
      element.className += ' terrain-swamp';
      element.style.backgroundColor = '#556B2F';
      element.style.backgroundImage = 'radial-gradient(circle at 30% 70%, rgba(85, 107, 47, 0.8) 3px, transparent 4px), radial-gradient(circle at 70% 30%, rgba(107, 142, 35, 0.6) 2px, transparent 3px), linear-gradient(30deg, rgba(34, 139, 34, 0.3) 25%, transparent 25%)';
      element.style.backgroundSize = '14px 14px, 10px 10px, 18px 18px';
      break;
    case 22: // Tundra
      element.className += ' terrain-tundra';
      element.style.backgroundColor = '#B0C4DE';
      element.style.backgroundImage = 'linear-gradient(45deg, rgba(176, 196, 222, 0.6) 25%, transparent 25%, transparent 75%, rgba(230, 230, 250, 0.6) 75%), radial-gradient(circle at 50% 50%, rgba(169, 169, 169, 0.4) 2px, transparent 3px)';
      element.style.backgroundSize = '16px 16px, 12px 12px';
      break;
    case 23: // Desert Stone
      element.className += ' terrain-desert-stone';
      element.style.backgroundColor = '#DEB887';
      element.style.backgroundImage = 'linear-gradient(45deg, rgba(210, 180, 140, 0.6) 25%, transparent 25%, transparent 75%, rgba(244, 164, 96, 0.6) 75%), radial-gradient(circle at 40% 60%, rgba(205, 133, 63, 0.5) 2px, transparent 3px)';
      element.style.backgroundSize = '14px 14px, 18px 18px';
      break;
    case 24: // Mossy Stone
      element.className += ' terrain-mossy-stone';
      element.style.backgroundColor = '#708090';
      element.style.backgroundImage = 'linear-gradient(45deg, rgba(112, 128, 144, 0.4) 25%, transparent 25%, transparent 75%, rgba(105, 105, 105, 0.4) 75%), radial-gradient(circle at 30% 30%, rgba(34, 139, 34, 0.6) 2px, transparent 3px), radial-gradient(circle at 70% 70%, rgba(46, 125, 50, 0.4) 1px, transparent 2px)';
      element.style.backgroundSize = '12px 12px, 16px 16px, 8px 8px';
      break;
    
    // Additional Wall Types (25-32) - obstacles
    case 25: // Sandstone Wall
      element.className += ' terrain-sandstone-wall';
      element.style.backgroundColor = '#F4A460';
      element.style.backgroundImage = 'linear-gradient(90deg, rgba(244, 164, 96, 0.8) 2px, transparent 2px), linear-gradient(0deg, rgba(210, 180, 140, 0.6) 1px, transparent 1px)';
      element.style.backgroundSize = '16px 8px, 8px 16px';
      break;
    case 26: // Coral Wall
      element.className += ' terrain-coral-wall';
      element.style.backgroundColor = '#FF7F7F';
      element.style.backgroundImage = 'radial-gradient(circle at 25% 30%, rgba(255, 105, 180, 0.6) 3px, transparent 4px), radial-gradient(circle at 75% 70%, rgba(255, 140, 105, 0.5) 2px, transparent 3px)';
      element.style.backgroundSize = '14px 14px, 10px 10px';
      break;
    case 27: // Bone Wall
      element.className += ' terrain-bone-wall';
      element.style.backgroundColor = '#F5F5DC';
      element.style.backgroundImage = 'linear-gradient(45deg, rgba(245, 245, 220, 0.8) 25%, transparent 25%, transparent 75%, rgba(220, 220, 190, 0.8) 75%)';
      element.style.backgroundSize = '12px 12px';
      break;
    case 28: // Magic Barrier
      element.className += ' terrain-magic-barrier';
      element.style.backgroundColor = '#DA70D6';
      element.style.backgroundImage = 'radial-gradient(circle at 50% 50%, rgba(138, 43, 226, 0.7) 4px, transparent 5px), linear-gradient(45deg, rgba(255, 20, 147, 0.4) 25%, transparent 25%)';
      element.style.backgroundSize = '16px 16px, 8px 8px';
      element.style.animation = 'magic-glow 3s ease-in-out infinite alternate';
      break;
    case 29: // Volcanic Rock
      element.className += ' terrain-volcanic-rock';
      element.style.backgroundColor = '#8B0000';
      element.style.backgroundImage = 'radial-gradient(circle at 30% 40%, rgba(255, 69, 0, 0.8) 4px, transparent 5px), linear-gradient(45deg, rgba(139, 0, 0, 0.6) 25%, transparent 25%)';
      element.style.backgroundSize = '18px 18px, 10px 10px';
      break;
    case 30: // Bamboo Wall
      element.className += ' terrain-bamboo-wall';
      element.style.backgroundColor = '#228B22';
      element.style.backgroundImage = 'linear-gradient(90deg, rgba(34, 139, 34, 0.8) 4px, transparent 4px), linear-gradient(0deg, rgba(46, 125, 50, 0.6) 2px, transparent 2px)';
      element.style.backgroundSize = '12px 20px, 6px 12px';
      break;
    case 31: // Iron Bars
      element.className += ' terrain-iron-bars';
      element.style.backgroundColor = '#2F4F4F';
      element.style.backgroundImage = 'linear-gradient(90deg, rgba(47, 79, 79, 0.9) 3px, transparent 3px), linear-gradient(0deg, rgba(112, 128, 144, 0.7) 1px, transparent 1px)';
      element.style.backgroundSize = '8px 100%, 100% 20px';
      break;
    case 32: // Energy Field
      element.className += ' terrain-energy-field';
      element.style.backgroundColor = '#00FFFF';
      element.style.backgroundImage = 'radial-gradient(circle at 50% 50%, rgba(0, 255, 255, 0.8) 2px, transparent 3px), linear-gradient(45deg, rgba(64, 224, 208, 0.5) 25%, transparent 25%)';
      element.style.backgroundSize = '12px 12px, 8px 8px';
      element.style.animation = 'energy-pulse 2s ease-in-out infinite alternate';
      break;
    
    // Additional Floor Types (33-40) - walkable surfaces
    case 33: // Marble Floor
      element.className += ' terrain-marble-floor';
      element.style.backgroundColor = '#F8F8FF';
      element.style.backgroundImage = 'linear-gradient(45deg, rgba(220, 220, 220, 0.4) 25%, transparent 25%, transparent 75%, rgba(211, 211, 211, 0.4) 75%), radial-gradient(circle at 30% 70%, rgba(192, 192, 192, 0.3) 3px, transparent 4px)';
      element.style.backgroundSize = '14px 14px, 20px 20px';
      break;
    case 34: // Carpet
      element.className += ' terrain-carpet';
      element.style.backgroundColor = '#8B0000';
      element.style.backgroundImage = 'linear-gradient(45deg, rgba(139, 0, 0, 0.6) 25%, transparent 25%, transparent 75%, rgba(165, 42, 42, 0.6) 75%), linear-gradient(-45deg, rgba(178, 34, 34, 0.4) 25%, transparent 25%)';
      element.style.backgroundSize = '16px 16px, 12px 12px';
      break;
    case 35: // Metal Grating
      element.className += ' terrain-metal-grating';
      element.style.backgroundColor = '#696969';
      element.style.backgroundImage = 'linear-gradient(90deg, rgba(105, 105, 105, 0.8) 2px, transparent 2px), linear-gradient(0deg, rgba(128, 128, 128, 0.8) 2px, transparent 2px)';
      element.style.backgroundSize = '8px 8px, 8px 8px';
      break;
    case 36: // Crystal Floor
      element.className += ' terrain-crystal-floor';
      element.style.backgroundColor = '#E6E6FA';
      element.style.backgroundImage = 'linear-gradient(60deg, rgba(138, 43, 226, 0.3) 25%, transparent 25%, transparent 75%, rgba(148, 0, 211, 0.3) 75%), linear-gradient(-60deg, rgba(75, 0, 130, 0.2) 25%, transparent 25%, transparent 75%, rgba(123, 104, 238, 0.2) 75%)';
      element.style.backgroundSize = '12px 12px, 10px 10px';
      break;
    case 37: // Lava Rock
      element.className += ' terrain-lava-rock';
      element.style.backgroundColor = '#B22222';
      element.style.backgroundImage = 'radial-gradient(circle at 40% 60%, rgba(255, 69, 0, 0.7) 3px, transparent 4px), linear-gradient(45deg, rgba(178, 34, 34, 0.6) 25%, transparent 25%)';
      element.style.backgroundSize = '16px 16px, 10px 10px';
      break;
    case 38: // Ice Floor
      element.className += ' terrain-ice-floor';
      element.style.backgroundColor = '#B0E0E6';
      element.style.backgroundImage = 'linear-gradient(30deg, rgba(135, 206, 235, 0.5) 25%, transparent 25%, transparent 75%, rgba(173, 216, 230, 0.5) 75%), linear-gradient(-30deg, rgba(175, 238, 238, 0.4) 25%, transparent 25%, transparent 75%, rgba(176, 224, 230, 0.4) 75%)';
      element.style.backgroundSize = '12px 12px, 8px 8px';
      break;
    case 39: // Grass Path
      element.className += ' terrain-grass-path';
      element.style.backgroundColor = '#6B8E23';
      element.style.backgroundImage = 'radial-gradient(circle at 25% 75%, rgba(107, 142, 35, 0.8) 2px, transparent 3px), radial-gradient(circle at 75% 25%, rgba(85, 107, 47, 0.6) 1px, transparent 2px)';
      element.style.backgroundSize = '10px 10px, 14px 14px';
      break;
    case 40: // Ancient Tiles
      element.className += ' terrain-ancient-tiles';
      element.style.backgroundColor = '#2F4F4F';
      element.style.backgroundImage = 'linear-gradient(45deg, rgba(47, 79, 79, 0.6) 25%, transparent 25%, transparent 75%, rgba(105, 105, 105, 0.6) 75%), radial-gradient(circle at 50% 50%, rgba(160, 82, 45, 0.4) 2px, transparent 3px)';
      element.style.backgroundSize = '16px 16px, 12px 12px';
      break;
    
    // Clay Terrain Types (41-46) - diggable clay deposits
    case 41: // Clay Deposit
    element.className += ' terrain-clay-deposit';
    element.style.backgroundColor = '#8A5A35';
    
    element.style.backgroundImage = `
      radial-gradient(ellipse at 40% 50%, rgba(139, 69, 19, 0.4) 30%, transparent 80%),
      linear-gradient(90deg, rgba(101, 67, 33, 0.15), rgba(139, 90, 43, 0.2)),
      conic-gradient(from 0deg at 50% 50%, rgba(160, 82, 45, 0.1), transparent 120deg, rgba(101, 67, 33, 0.15) 240deg, transparent)
    `;
    
    element.style.backgroundSize = '180px 120px, 100% 100%, 120px 120px';
    
      break;
    case 42: // Fire Clay
    element.className += ' terrain-fire-clay';
    element.style.backgroundColor = '#C43724';
    
    element.style.backgroundImage = `
      radial-gradient(circle at 50% 40%, rgba(255, 69, 0, 0.4) 30%, transparent 80%),
      linear-gradient(45deg, rgba(178, 34, 34, 0.25), rgba(255, 99, 71, 0.2)),
      conic-gradient(from 180deg at 50% 50%, rgba(220, 20, 60, 0.1), rgba(165, 42, 42, 0.15), transparent)
    `;
    
    element.style.backgroundSize = '140px 140px, 100% 100%, 120px 120px';
    
      break;
    case 43: // Cambrian Clay
    element.className += ' terrain-cambrian-clay';
    element.style.backgroundColor = '#2F5FA4'; // Vibrant Cambrian base blue
    
    element.style.backgroundImage = `
      radial-gradient(ellipse at 30% 40%, rgba(63, 139, 197, 0.35) 20%, transparent 70%),
      radial-gradient(circle at 70% 60%, rgba(79, 129, 189, 0.3) 15%, transparent 50%),
      linear-gradient(120deg, rgba(78, 108, 178, 0.15), rgba(106, 140, 205, 0.2)),
      conic-gradient(from 90deg at 50% 50%, rgba(90, 135, 230, 0.1) 0deg, rgba(60, 90, 190, 0.15) 180deg, transparent 360deg)
    `;
    
    element.style.backgroundSize = '160px 140px, 180px 160px, 100% 100%, 100% 100%';
    
      break;
    case 44: // White Clay
    element.className += ' terrain-white-clay';
    element.style.backgroundColor = '#F0F0F5';
    
    element.style.backgroundImage = `
      radial-gradient(ellipse at 60% 60%, rgba(169, 169, 169, 0.25) 40%, transparent 90%),
      linear-gradient(120deg, rgba(211, 211, 211, 0.2), rgba(245, 245, 245, 0.1)),
      conic-gradient(from 0deg at 50% 50%, rgba(192, 192, 192, 0.15), transparent 180deg, rgba(211, 211, 211, 0.2) 270deg)
    `;
    
    element.style.backgroundSize = '160px 160px, 100% 100%, 140px 140px';
    
      break;
    case 45: // Black Clay
    element.className += ' terrain-black-clay';
    element.style.backgroundColor = '#1F1F1F';
    
    element.style.backgroundImage = `
      radial-gradient(circle at 60% 40%, rgba(47, 47, 47, 0.3) 40%, transparent 70%),
      linear-gradient(135deg, rgba(32, 32, 32, 0.3), rgba(64, 64, 64, 0.2)),
      conic-gradient(from 45deg at 50% 50%, rgba(64, 64, 64, 0.15), transparent 180deg, rgba(32, 32, 32, 0.1))
    `;
    
    element.style.backgroundSize = '140px 140px, 100% 100%, 100px 100px';
    
      break;
    case 46: // Sacred Clay
    element.className += ' terrain-sacred-clay';
    element.style.backgroundColor = '#FFD700';
    
    element.style.backgroundImage = `
      radial-gradient(circle at 50% 50%, rgba(255, 248, 220, 0.4) 50%, transparent 90%),
      conic-gradient(from 0deg at 50% 50%, rgba(255, 215, 0, 0.2), rgba(240, 230, 140, 0.15), rgba(218, 165, 32, 0.3)),
      linear-gradient(60deg, rgba(255, 255, 224, 0.2), transparent)
    `;
    
    element.style.backgroundSize = '180px 180px, 100% 100%, 100% 100%';
    element.style.animation = 'sacred-glow 4s ease-in-out infinite alternate';
    
      break;
      
    // Bone Excavation Terrain Types (50-56) - diggable bone sites
    case 50: // Bone Shards
  element.className += ' terrain-bone-shards';
  element.style.backgroundColor = '#9b7c5a'; // earthy, clay-like base

  element.style.backgroundImage = `
    /* Sparse small bone shards */
    repeating-linear-gradient(45deg, rgba(250, 250, 240, 0.35) 0 1px, transparent 1px 10px),
    repeating-linear-gradient(120deg, rgba(255, 255, 255, 0.25) 0 1px, transparent 1px 12px),
    
    /* A couple larger accent shards */
    radial-gradient(ellipse at 30% 40%, rgba(255, 255, 255, 0.4) 8%, transparent 15%),
    radial-gradient(ellipse at 70% 60%, rgba(245, 245, 220, 0.35) 10%, transparent 20%),
    
    /* Surface tone variation */
    linear-gradient(30deg, rgba(90, 65, 45, 0.12), rgba(70, 50, 35, 0.1)),
    conic-gradient(from 0deg at 50% 50%, rgba(140, 110, 85, 0.1), transparent 180deg, rgba(110, 85, 65, 0.1) 270deg, transparent)
  `;

  element.style.backgroundSize = `
    60px 60px,
    60px 60px,
    
    100% 100%,
    100% 100%,
    
    100% 100%,
    120px 120px
  `;
  
  element.style.backgroundRepeat = 'repeat';

  break;

    case 51: // Burial Mound
    element.className += ' terrain-burial-mound';
    element.style.backgroundColor = '#6B3E23';
    
    element.style.backgroundImage = `
      radial-gradient(ellipse at 50% 30%, rgba(200, 200, 200, 0.3) 15%, transparent 50%),
      radial-gradient(circle at 25% 60%, rgba(180, 180, 180, 0.2) 10%, transparent 40%),
      radial-gradient(circle at 75% 70%, rgba(150, 150, 150, 0.2) 12%, transparent 40%),
      linear-gradient(30deg, rgba(120, 70, 40, 0.15), rgba(100, 60, 30, 0.2))
    `;
    
    element.style.backgroundSize = '80px 80px, 60px 60px, 50px 50px, 100% 100%';
    
      break;
    case 52: // Mammoth Pit
    element.className += ' terrain-mammoth-pit';
    element.style.backgroundColor = '#4A3728'; // deep excavated earth
    
    element.style.backgroundImage = `
      /* Large scattered bone pieces */
      repeating-linear-gradient(30deg, rgba(240, 240, 230, 0.4) 0 2px, transparent 2px 25px),
      repeating-linear-gradient(150deg, rgba(220, 220, 210, 0.3) 0 1px, transparent 1px 20px),
      
      /* Major bone deposits */
      radial-gradient(ellipse at 25% 35%, rgba(255, 255, 245, 0.5) 12%, transparent 30%),
      radial-gradient(ellipse at 75% 65%, rgba(245, 245, 235, 0.45) 15%, transparent 35%),
      radial-gradient(circle at 50% 20%, rgba(230, 230, 220, 0.35) 8%, transparent 20%),
      
      /* Excavated soil texture */
      linear-gradient(135deg, rgba(60, 40, 25, 0.2), rgba(45, 30, 20, 0.15)),
      conic-gradient(from 45deg at 50% 50%, rgba(80, 55, 35, 0.15), transparent 120deg, rgba(65, 45, 30, 0.2) 240deg, transparent)
    `;
    
    element.style.backgroundSize = `
      80px 80px,
      70px 70px,
      
      120% 120%,
      110% 110%,
      80px 80px,
      
      100% 100%,
      180px 180px
    `;
    
    element.style.backgroundRepeat = 'repeat';
    
      break;
    case 53: // Behemoth Remains
    element.className += ' terrain-behemoth-remains';
    element.style.backgroundColor = '#2A2A2A'; // dark ancient stone
    
    element.style.backgroundImage = `
      /* Massive bone structures */
      repeating-linear-gradient(60deg, rgba(200, 200, 190, 0.45) 0 3px, transparent 3px 35px),
      repeating-linear-gradient(0deg, rgba(180, 180, 170, 0.35) 0 2px, transparent 2px 30px),
      
      /* Ancient bone formations */
      radial-gradient(ellipse at 30% 30%, rgba(220, 220, 210, 0.6) 18%, transparent 45%),
      radial-gradient(ellipse at 70% 70%, rgba(200, 200, 190, 0.5) 20%, transparent 50%),
      radial-gradient(circle at 50% 50%, rgba(180, 180, 170, 0.4) 12%, transparent 30%),
      
      /* Stone and bone mixture */
      linear-gradient(75deg, rgba(50, 50, 50, 0.3), rgba(35, 35, 35, 0.2)),
      conic-gradient(from 90deg at 50% 50%, rgba(70, 70, 70, 0.2), transparent 90deg, rgba(55, 55, 55, 0.25) 180deg, transparent 270deg)
    `;
    
    element.style.backgroundSize = `
      100px 100px,
      90px 90px,
      
      140% 140%,
      130% 130%,
      100px 100px,
      
      100% 100%,
      200px 200px
    `;
    
    element.style.backgroundRepeat = 'repeat';
    
      break;
    case 54: // Fossil Shelf
    element.className += ' terrain-fossil-shelf';
    element.style.backgroundColor = '#8B6914'; // sedimentary rock base
    
    element.style.backgroundImage = `
      /* Fossil fragment layers */
      repeating-linear-gradient(15deg, rgba(210, 180, 140, 0.4) 0 1px, transparent 1px 18px),
      repeating-linear-gradient(105deg, rgba(190, 160, 120, 0.35) 0 2px, transparent 2px 22px),
      repeating-linear-gradient(75deg, rgba(230, 200, 160, 0.3) 0 1px, transparent 1px 15px),
      
      /* Embedded fossils */
      radial-gradient(ellipse at 20% 40%, rgba(240, 210, 170, 0.55) 10%, transparent 25%),
      radial-gradient(ellipse at 80% 60%, rgba(220, 190, 150, 0.5) 12%, transparent 30%),
      radial-gradient(circle at 50% 80%, rgba(200, 170, 130, 0.4) 8%, transparent 20%),
      
      /* Sedimentary layers */
      linear-gradient(10deg, rgba(120, 90, 50, 0.2), rgba(100, 75, 40, 0.15)),
      conic-gradient(from 30deg at 50% 50%, rgba(150, 115, 70, 0.15), rgba(130, 100, 60, 0.1), transparent 180deg, rgba(140, 105, 65, 0.2) 270deg, transparent)
    `;
    
    element.style.backgroundSize = `
      65px 65px,
      75px 75px,
      55px 55px,
      
      110% 110%,
      120% 120%,
      90px 90px,
      
      100% 100%,
      220px 220px
    `;
    
    element.style.backgroundRepeat = 'repeat';
    
      break;
    case 55: // Draconic Remains
    element.className += ' terrain-draconic-remains';
    element.style.backgroundColor = '#3D1A1A'; // deep crimson base
    
    element.style.backgroundImage = `
      /* Dragon bone fragments */
      repeating-linear-gradient(45deg, rgba(220, 180, 160, 0.5) 0 2px, transparent 2px 28px),
      repeating-linear-gradient(135deg, rgba(200, 160, 140, 0.4) 0 3px, transparent 3px 32px),
      
      /* Massive dragon bones */
      radial-gradient(ellipse at 35% 25%, rgba(240, 200, 180, 0.65) 20%, transparent 50%),
      radial-gradient(ellipse at 65% 75%, rgba(220, 180, 160, 0.6) 25%, transparent 55%),
      radial-gradient(circle at 20% 60%, rgba(200, 160, 140, 0.45) 15%, transparent 35%),
      
      /* Fiery undertones */
      radial-gradient(circle at 80% 30%, rgba(180, 60, 40, 0.3) 12%, transparent 30%),
      linear-gradient(120deg, rgba(80, 30, 20, 0.25), rgba(60, 20, 15, 0.2)),
      conic-gradient(from 180deg at 50% 50%, rgba(120, 40, 30, 0.2), rgba(100, 35, 25, 0.15), transparent 120deg, rgba(140, 45, 35, 0.25) 240deg, transparent)
    `;
    
    element.style.backgroundSize = `
      95px 95px,
      105px 105px,
      
      150% 150%,
      160% 160%,
      120px 120px,
      
      100px 100px,
      100% 100%,
      240px 240px
    `;
    
    element.style.backgroundRepeat = 'repeat';
    
      break;
    case 56: // Ancient Graveyard
    element.className += ' terrain-ancient-graveyard';
    element.style.backgroundColor = '#1A1A2E'; // mystical dark base
    
    element.style.backgroundImage = `
      /* Ancient bone patterns */
      repeating-linear-gradient(30deg, rgba(180, 160, 200, 0.4) 0 2px, transparent 2px 40px),
      repeating-linear-gradient(150deg, rgba(160, 140, 180, 0.35) 0 1px, transparent 1px 35px),
      repeating-linear-gradient(90deg, rgba(200, 180, 220, 0.3) 0 1px, transparent 1px 25px),
      
      /* Mystical bone formations */
      radial-gradient(ellipse at 40% 30%, rgba(220, 200, 240, 0.6) 22%, transparent 55%),
      radial-gradient(ellipse at 60% 70%, rgba(200, 180, 220, 0.55) 25%, transparent 60%),
      radial-gradient(circle at 80% 20%, rgba(180, 160, 200, 0.45) 18%, transparent 40%),
      
      /* Ancient mystical energy */
      radial-gradient(circle at 20% 80%, rgba(120, 80, 160, 0.35) 15%, transparent 35%),
      linear-gradient(45deg, rgba(40, 30, 60, 0.3), rgba(25, 20, 45, 0.25)),
      conic-gradient(from 270deg at 50% 50%, rgba(80, 60, 120, 0.25), rgba(60, 45, 100, 0.2), transparent 90deg, rgba(100, 75, 140, 0.3) 180deg, transparent 270deg)
    `;
    
    element.style.backgroundSize = `
      110px 110px,
      95px 95px,
      70px 70px,
      
      170% 170%,
      180% 180%,
      140px 140px,
      
      120px 120px,
      100% 100%,
      260px 260px
    `;
    
    element.style.backgroundRepeat = 'repeat';
    element.style.animation = 'ancient-glow 6s ease-in-out infinite alternate';
    
      break;
    
    case 57: // Black Void (Underground base terrain)
      element.className += ' terrain-black-void';
      element.style.backgroundColor = '#0A0A0A';
      element.style.backgroundImage = 'radial-gradient(circle at 30% 40%, rgba(25, 25, 25, 0.6) 2px, transparent 3px), radial-gradient(circle at 70% 60%, rgba(15, 15, 15, 0.4) 1px, transparent 2px)';
      element.style.backgroundSize = '32px 32px, 16px 16px';
      break;
  }
}

// Apply object styling to element
function applyObjectStyling(element, layer, tileValue, worldX, worldY) {
  console.log('Original applyObjectStyling called:', { tileValue, worldX, worldY });
  element.className += ' world-object';
  element.dataset.type = tileValue;
  element.dataset.x = worldX;
  element.dataset.y = worldY;
  element.style.display = 'flex';
  element.style.alignItems = 'center';
  element.style.justifyContent = 'center';
  element.style.fontSize = '24px';
  element.style.cursor = 'pointer';
  element.style.transition = 'transform 0.2s';
  
  // Define object properties
  const objectDefinitions = {
    'bank': { name: 'Bank chest', icon: '🏦', interactive: true },
    'shop_general': { name: 'General Store', icon: '🏪', interactive: true },
    'shop_weapon': { name: 'Weapon Shop', icon: '⚔️', interactive: true },
    'shop_magic': { name: 'Magic Shop', icon: '🔮', interactive: true },
    'shop_mining': { name: 'Mining Shop', icon: '⛏️', interactive: true },
    'shop_fletching': { name: 'Fletching Shop', icon: '🏹', interactive: true },
    'shop_fishing': { name: 'Fishing Shop', icon: '🎣', interactive: true },
    'tree_oak': { name: 'Oak Tree', icon: '🌳', interactive: true },
    'tree_pine': { name: 'Pine Tree', icon: '🌲', interactive: true },
    'tree_palm': { name: 'Palm Tree', icon: '🌴', interactive: true },
    'tree_bamboo': { name: 'Bamboo', icon: '🎋', interactive: true },
    'tree_magic': { name: 'Magic Tree', icon: '🎄', interactive: true },
    'scribing_table': { name: 'Scribing Table', icon: '📝', interactive: true },
    'ore_copper': { name: 'Copper Ore', icon: '🟤', interactive: true, customImage: 'images/objects/ore/copper_ore.png' },
    'ore_tin': { name: 'Tin Ore', icon: '🔘', interactive: true, customImage: 'images/objects/ore/tin_ore.png' },
    'ore_iron': { name: 'Iron Ore', icon: '⚫', interactive: true, customImage: 'images/objects/ore/iron_ore.png' },
    'ore_silver': { name: 'Silver Ore', icon: '⚪', interactive: true },
    'ore_gold': { name: 'Gold Ore', icon: '🟡', interactive: true, customImage: 'images/objects/ore/gold_ore.glb', depletedImage: 'images/objects/ore/gold_ore_depleted.glb' },
    'ore_mithril': { name: 'Mithril Ore', icon: '🔵', interactive: true },
    'ore_adamantite': { name: 'Adamantite Ore', icon: '🟢', interactive: true },
      'fishing_spot_shrimp': { name: 'Shrimp Fishing Spot', icon: '🌀', interactive: true },
  'fishing_spot_sardine': { name: 'Sardine Fishing Spot', icon: '🌀', interactive: true },
  'fishing_spot_herring': { name: 'Herring Fishing Spot', icon: '🌀', interactive: true },
  'fishing_spot_anchovies': { name: 'Anchovies Fishing Spot', icon: '🌀', interactive: true },
  'fishing_spot_tuna': { name: 'Tuna Fishing Spot', icon: '🌀', interactive: true },
  'fishing_spot_lobster': { name: 'Lobster Fishing Spot', icon: '🌀', interactive: true },
  'fishing_spot_swordfish': { name: 'Swordfish Fishing Spot', icon: '🌀', interactive: true },
  'fishing_spot_shark': { name: 'Shark Fishing Spot', icon: '🌀', interactive: true },
    'item_spawn': { name: 'Item Spawn', icon: '📦', interactive: false }, // Item spawns are invisible in game
    'tree_regular': { name: 'Tree', icon: null, interactive: true, customImage: 'images/woodcutting/normal_tree.png' },
    'pulp_basin': { name: 'Pulp Basin', icon: '🪣', interactive: true },
    'cooking_range': { name: 'Cooking Range', icon: '🔥', interactive: true },
    'cooking_fire': { name: 'Cooking Fire', icon: '🔥', interactive: true },
    'apple_tree': { name: 'Apple Tree', icon: '🌳🍎🍎🍎', interactive: true },
    'cherry_tree': { name: 'Cherry Tree', icon: '🌳🍒🍒🍒', interactive: true },
    'ladder_down': { name: 'Ladder Down', icon: '🪜', interactive: true },
    'ladder_up': { name: 'Ladder Up', icon: '🪜', interactive: true },
    'peach_tree': { name: 'Peach Tree', icon: '🌳🍑🍑🍑', interactive: true },
    'mushroom_patch': { name: 'Mushroom Patch', icon: '🍄', interactive: true },
    'wheat_field': { name: 'Wheat Field', icon: '🌾', interactive: true },
    'dig_site_ruins': { name: 'Ancient Ruins', icon: '🏛️', interactive: true },
    'dig_site_burial': { name: 'Burial Mound', icon: '⛰️', interactive: true },
    'dig_site_temple': { name: 'Lost Temple', icon: '🏯', interactive: true },
    'dig_site_palace': { name: 'Royal Palace', icon: '🏰', interactive: true },
    'dig_site_dragon': { name: 'Dragon Lair', icon: '🐉', interactive: true }
  };
  
  const objectDef = objectDefinitions[tileValue];
  if (objectDef) {
    // Special handling: item spawns are invisible in the game world
    if (tileValue === 'item_spawn') {
      element.style.display = 'none'; // Make item spawn markers invisible
      return;
    }
    
    // Check if this is a harvesting node that needs custom rendering
    if (tileValue.endsWith('_tree') || tileValue === 'mushroom_patch' || tileValue === 'wheat_field') {
      const nodeKey = `${worldX},${worldY}`;
      let resourceCount = 0;
      
      // Get resource count from harvesting module if available
      if (window.harvestingModule && window.harvestingModule.getNodeResourceCount) {
        resourceCount = window.harvestingModule.getNodeResourceCount(nodeKey, tileValue);
      } else {
        // Default to full resources if module not loaded yet
        const harvestingNodes = {
          'apple_tree': 6, 'cherry_tree': 6, 'peach_tree': 6,
          'mushroom_patch': 4, 'wheat_field': 8
        };
        resourceCount = harvestingNodes[tileValue] || 6;
      }
      
      // Use custom overlay rendering for all harvesting nodes
      renderHarvestingNodeWithOverlay(element, tileValue, resourceCount);
    }
    // Check if object has custom image
    else if (objectDef.customImage) {
      // Apply sprite image
      element.style.backgroundImage = `url('${objectDef.customImage}')`;
      element.style.backgroundSize = 'contain';
      element.style.backgroundRepeat = 'no-repeat';
      element.style.backgroundPosition = 'center';
      element.innerHTML = '';

      // If this is an ore, keep the pixel art crisp (no outline) and support depleted variant
      if (tileValue.startsWith('ore_')) {
        element.style.filter = 'none';

        // Determine if depleted (either dataset flag or global state)
        const oreKey = `${worldX},${worldY}`;
        const isDepleted = element.dataset.depleted === 'true' || (window.depletedOreStates && window.depletedOreStates.has && window.depletedOreStates.has(oreKey));
        if (isDepleted) {
          const oreName = tileValue.replace('ore_', '');
          element.style.backgroundImage = `url('images/objects/ore/${oreName}_ore_depleted.png')`;
        }
      } else {
        // Non-ore custom images retain subtle outline for visibility
        element.style.filter = 'drop-shadow(1px 1px 0px #000000) drop-shadow(-1px -1px 0px #000000) drop-shadow(1px -1px 0px #000000) drop-shadow(-1px 1px 0px #000000)';
      }
      element.style.transition = 'transform 0.2s';
    } else {
      element.innerHTML = objectDef.icon;
    }
    
    element.title = objectDef.name;
    
    // Add hover effect for interactive objects
    if (objectDef.interactive) {
      element.addEventListener('mouseenter', () => {
        element.style.transform = 'scale(1.1)';
        // Comment out border outline effect for custom images
        // if (objectDef.customImage) {
        //   element.style.borderColor = '#ffffff';
        // }
      });
      
      element.addEventListener('mouseleave', () => {
        element.style.transform = 'scale(1)';
        // Comment out border outline effect for custom images  
        // if (objectDef.customImage) {
        //   element.style.borderColor = 'transparent';
        // }
      });
      
      // Add interaction handlers based on object type
      if (tileValue === 'bank') {
        addBankEventHandlers(element, worldX, worldY);
      } else if (tileValue.startsWith('shop_')) {
        addShopEventHandlers(element, tileValue, worldX, worldY);
      } else if (tileValue.startsWith('ore_')) {
        addOreEventHandlers(element, tileValue, worldX, worldY);
      } else if (tileValue.startsWith('tree_')) {
        addTreeEventHandlers(element, tileValue, worldX, worldY);
      }
      return;
    }
    
    // Check for depleted tree state using global state map
    const treeKey = `${worldX},${worldY}`;
    if (tileValue && tileValue.startsWith('tree_') && window.depletedTreeStates && window.depletedTreeStates.has(treeKey)) {
      const depletedState = window.depletedTreeStates.get(treeKey);
      console.log(`Restoring depleted tree state for ${tileValue} at (${worldX}, ${worldY}) from global state`);
      
      // For custom image trees, hide the background image and show sapling
      if (objectDef.customImage) {
        element.style.backgroundImage = 'none';
        element.innerHTML = '🌱';
        element.style.fontSize = '24px';
        element.style.display = 'flex';
        element.style.alignItems = 'center';
        element.style.justifyContent = 'center';
        // Apply text-shadow to sapling emoji to match other emoji objects
        element.style.textShadow = '1px 1px 1px #000000, -1px -1px 1px #000000, 1px -1px 1px #000000, -1px 1px 1px #000000';
        element.style.filter = 'none'; // Remove drop-shadow since we're using text-shadow now
      } else {
        // For emoji trees, just change the text content
        element.textContent = '🌱';
      }
      
      element.title = 'Young sapling (growing...)';
      element.dataset.depleted = 'true';
    }
  }
}

// Find path using RuneScape-style breadth-first search
function findPath(startX, startY, endX, endY, allowAdjacentTarget = false) {
  // Convert to integer coordinates
  const startTileX = Math.floor(startX);
  const startTileY = Math.floor(startY);
  const endTileX = endX;
  const endTileY = endY;
  
  // Check if target is within valid range (101x101 area around start)
  const maxDistance = 50; // Half of 101x101
  if (Math.abs(endTileX - startTileX) > maxDistance || Math.abs(endTileY - startTileY) > maxDistance) {
    return [];
  }
  
  // If we allow adjacent targets and start position is already adjacent, don't move
  if (allowAdjacentTarget) {
    const dx = Math.abs(startTileX - endTileX);
    const dy = Math.abs(startTileY - endTileY);
    const distance = Math.max(dx, dy); // Chebyshev distance
    if (distance <= 1 && distance > 0) {
      console.log('Already adjacent to target - no movement needed');
      return [];
    }
  }
  
  // If the target is blocked and we don't allow adjacent targets, we can't path to it
  if (!allowAdjacentTarget && !isPositionWalkable(endTileX, endTileY)) {
    return [];
  }
  
  // Breadth-first search implementation
  const queue = [];
  const visited = new Set();
  const distances = {};
  const previous = {};
  
  // Starting position
  const startKey = `${startTileX},${startTileY}`;
  const endKey = `${endTileX},${endTileY}`;
  
  queue.push({ x: startTileX, y: startTileY, distance: 0 });
  visited.add(startKey);
  distances[startKey] = 0;
  
  // Neighbor checking order as per RuneScape: West, East, South, North, SW, SE, NW, NE
  const directions = [
    { dx: -1, dy: 0 },  // West
    { dx: 1, dy: 0 },   // East
    { dx: 0, dy: 1 },   // South
    { dx: 0, dy: -1 },  // North
    { dx: -1, dy: 1 },  // South-west
    { dx: 1, dy: 1 },   // South-east
    { dx: -1, dy: -1 }, // North-west
    { dx: 1, dy: -1 }   // North-east
  ];
  
  let targetFound = false;
  let finalTarget = { x: endTileX, y: endTileY };
  
  // BFS algorithm
  while (queue.length > 0 && !targetFound) {
    const current = queue.shift();
    const currentKey = `${current.x},${current.y}`;
    
    // Check if we reached the exact target
    if (current.x === endTileX && current.y === endTileY) {
      targetFound = true;
      finalTarget = { x: current.x, y: current.y };
      break;
    }
    
    // If we allow adjacent targets, check if we're adjacent to the target
    if (allowAdjacentTarget) {
      const dx = Math.abs(current.x - endTileX);
      const dy = Math.abs(current.y - endTileY);
      const distance = Math.max(dx, dy); // Chebyshev distance
      
      if (distance === 1) {
        targetFound = true;
        finalTarget = { x: current.x, y: current.y };
        console.log(`Found adjacent target at (${current.x}, ${current.y}) for target (${endTileX}, ${endTileY})`);
        break;
      }
    }
    
    // Explore neighbors in the specified order
    for (const dir of directions) {
      const newX = current.x + dir.dx;
      const newY = current.y + dir.dy;
      const newKey = `${newX},${newY}`;
      
      // Skip if out of world bounds
      if (newX < 0 || newX >= WORLD_COLS || newY < 0 || newY >= WORLD_ROWS) {
        continue;
      }
      
      // Skip if already visited
      if (visited.has(newKey)) {
        continue;
      }
      
      // Skip if blocked
      if (!isPositionWalkable(newX, newY)) {
        continue;
      }
      
      // Check movement validity based on direction
      if (!canMoveBetweenTiles(current.x, current.y, newX, newY)) {
        continue;
      }
      
      // Add to queue and mark as visited
      visited.add(newKey);
      distances[newKey] = current.distance + 1;
      previous[newKey] = currentKey;
      queue.push({ x: newX, y: newY, distance: current.distance + 1 });
    }
  }
  
  // If target wasn't found, return empty path
  if (!targetFound) {
    return [];
  }
  
  // Reconstruct path to the final target (either exact or adjacent)
  const path = [];
  let currentKey = `${finalTarget.x},${finalTarget.y}`;
  
  while (previous[currentKey]) {
    const [x, y] = currentKey.split(',').map(Number);
    path.unshift({ x, y });
    currentKey = previous[currentKey];
  }
  
  // Extract checkpoint tiles (corners of the path)
  const checkpoints = extractCheckpoints(path);
  
  // Limit to first 25 checkpoints as per RuneScape
  return checkpoints.slice(0, 25);
}

// Check if movement between two tiles is valid
function canMoveBetweenTiles(fromX, fromY, toX, toY) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  
  // Cardinal movement - check for walls blocking the path
  if (dx === 0 || dy === 0) {
    return true; // For now, assume no walls block cardinal movement
  }
  
  // Diagonal movement - check both adjacent cardinal directions
  const horizontalTileX = fromX + dx;
  const horizontalTileY = fromY;
  const verticalTileX = fromX;
  const verticalTileY = fromY + dy;
  
  // Check bounds
  const horizontalInBounds = horizontalTileX >= 0 && horizontalTileX < WORLD_COLS && 
                             horizontalTileY >= 0 && horizontalTileY < WORLD_ROWS;
  const verticalInBounds = verticalTileX >= 0 && verticalTileX < WORLD_COLS && 
                           verticalTileY >= 0 && verticalTileY < WORLD_ROWS;
  
  // Both intermediate tiles must be walkable for diagonal movement
  const horizontalBlocked = horizontalInBounds && !isPositionWalkable(horizontalTileX, horizontalTileY);
  const verticalBlocked = verticalInBounds && !isPositionWalkable(verticalTileX, verticalTileY);
  
  return !horizontalBlocked && !verticalBlocked;
}

// Extract checkpoint tiles (path corners) from the full path
function extractCheckpoints(fullPath) {
  if (fullPath.length <= 1) {
    return fullPath;
  }
  
  const checkpoints = [];
  let currentDirection = null;
  
  // Always include the first tile
  checkpoints.push(fullPath[0]);
  
  for (let i = 1; i < fullPath.length; i++) {
    const prev = fullPath[i - 1];
    const current = fullPath[i];
    
    const dx = current.x - prev.x;
    const dy = current.y - prev.y;
    const direction = `${dx},${dy}`;
    
    // If direction changed, this is a checkpoint
    if (currentDirection !== null && currentDirection !== direction) {
      checkpoints.push(prev);
    }
    
    currentDirection = direction;
  }
  
  // Always include the last tile
  checkpoints.push(fullPath[fullPath.length - 1]);
  
  return checkpoints;
}

// Move player to target position
function movePlayerToTarget(targetX, targetY) {
  console.log(`movePlayerToTarget called: target=(${targetX}, ${targetY}), player=(${playerPosition.x.toFixed(2)}, ${playerPosition.y.toFixed(2)}), isMoving=${isMoving}`);
  
  // Find path from player's current exact position to target
  const path = findPath(playerPosition.x, playerPosition.y, targetX, targetY);
  
  console.log(`Path found with ${path.length} checkpoints:`, path);
  
  if (path.length > 0) {
    // Clear any existing movement and start new path immediately
    movementQueue = path;
    isMoving = true;
    console.log('Movement started with new path');
  } else {
    // If no path found, try to move to the closest walkable tile
    // This handles cases where the player clicks on an obstacle
    const fallbackPath = findNearestWalkablePath(playerPosition.x, playerPosition.y, targetX, targetY);
    console.log(`Fallback path found with ${fallbackPath.length} checkpoints:`, fallbackPath);
    
    if (fallbackPath.length > 0) {
      movementQueue = fallbackPath;
      isMoving = true;
      console.log('Movement started with fallback path');
    } else {
      console.log('No path found to target');
    }
  }
}

// Find path to nearest walkable tile if direct path fails
function findNearestWalkablePath(startX, startY, targetX, targetY) {
  // If target is blocked, try adjacent tiles
  const adjacentOffsets = [
    { dx: 0, dy: -1 }, // North
    { dx: 1, dy: 0 },  // East  
    { dx: 0, dy: 1 },  // South
    { dx: -1, dy: 0 }, // West
    { dx: 1, dy: -1 }, // Northeast
    { dx: 1, dy: 1 },  // Southeast
    { dx: -1, dy: 1 }, // Southwest
    { dx: -1, dy: -1 } // Northwest
  ];
  
  for (const offset of adjacentOffsets) {
    const newTargetX = targetX + offset.dx;
    const newTargetY = targetY + offset.dy;
    
    // Check if this alternative target is valid and walkable
    if (newTargetX >= 0 && newTargetX < WORLD_COLS && 
        newTargetY >= 0 && newTargetY < WORLD_ROWS &&
        isPositionWalkable(newTargetX, newTargetY)) {
      
      const path = findPath(startX, startY, newTargetX, newTargetY);
      if (path.length > 0) {
        return path;
      }
    }
  }
  
  return [];
}

// Game loop for animations and movement
function gameLoop(timestamp) {
  try {
    if (!lastFrameTime) lastFrameTime = timestamp;
    const deltaTime = (timestamp - lastFrameTime) / 1000; // Convert to seconds
    lastFrameTime = timestamp;

    // Core per-frame updates wrapped in a failsafe so the loop never dies
    updatePlayerMovement(deltaTime);
    updateCamera();
    updatePlayerVisualPosition();
  } catch (err) {
    // Log the error but keep the loop alive – this prevents the entire
    // game from freezing if a single frame throws.
    console.error('🛑 Uncaught error inside gameLoop – continuing next frame:', err);
  }

  // Always schedule the next frame, even if an error occurred.
  animationFrameId = requestAnimationFrame(gameLoop);
}

// Start the game loop
function startGameLoop() {
  if (!animationFrameId) {
    animationFrameId = requestAnimationFrame(gameLoop);
  }
}

// Stop the game loop
function stopGameLoop() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

// Update player movement based on the movement queue
function updatePlayerMovement(deltaTime) {
  if (!isMoving || movementQueue.length === 0) return;
  
  // Get the next target from the queue
  const nextTarget = movementQueue[0];
  
  // Check if we've reached the target
  if (Math.abs(playerPosition.x - nextTarget.x) < 0.1 && Math.abs(playerPosition.y - nextTarget.y) < 0.1) {
    // Snap to exact position
    playerPosition.x = nextTarget.x;
    playerPosition.y = nextTarget.y;
    
    // Remove this target from the queue
    movementQueue.shift();
    
    // If queue is empty, stop moving and check for pickup targets
    if (movementQueue.length === 0) {
      isMoving = false;
      
      // Set player to idle state for sprite animation
      if (window.userModule && window.userModule.setPlayerMoving) {
        window.userModule.setPlayerMoving(false); // Player is now idle
      }
      
      // Check if we have a pickup target at this location
      if (window.pickupTarget && 
          Math.abs(playerPosition.x - window.pickupTarget.x) < 1.5 && 
          Math.abs(playerPosition.y - window.pickupTarget.y) < 1.5) {
        
        console.log('MOVEMENT COMPLETE: Attempting auto-pickup for', window.pickupTarget.itemId);
        
        // Try to pickup the item
        if (window.inventoryModule && window.inventoryModule.pickupFloorItem) {
          window.inventoryModule.pickupFloorItem(window.pickupTarget.itemId);
        }
        
        // Clear the pickup target
        window.pickupTarget = null;
      }
      
      // Check if we have a bank target and are close enough to use it
      if (window.bankTarget &&
          Math.abs(playerPosition.x - window.bankTarget.x) < 2.5 &&
          Math.abs(playerPosition.y - window.bankTarget.y) < 2.5) {
        
        console.log('MOVEMENT COMPLETE: Attempting auto-bank for', window.bankTarget);
        
        // Try to open the bank using new bank system
        if (window.bankModule && window.bankModule.openBank) {
          window.bankModule.openBank();
        } else {
          console.error('MOVEMENT COMPLETE: New bank module not available');
        }
        
        // Clear the bank target
        window.bankTarget = null;
      }
      
      // Check if we have a shop target and are close enough to use it
      if (window.shopTarget && 
          Math.abs(playerPosition.x - window.shopTarget.x) < 2.5 && 
          Math.abs(playerPosition.y - window.shopTarget.y) < 2.5) {
        
        console.log('MOVEMENT COMPLETE: Attempting auto-shop for', window.shopTarget);
        
        // Try to open the shop
        openShopByType(window.shopTarget.type);
        
        // Clear the shop target
        window.shopTarget = null;
      }
      
      // Check if we have an interaction target and are close enough to interact with it
      if (window.interactionTarget && 
          Math.abs(playerPosition.x - window.interactionTarget.x) < 1.5 && 
          Math.abs(playerPosition.y - window.interactionTarget.y) < 1.5) {
        
        console.log('MOVEMENT COMPLETE: Attempting auto-interaction for', window.interactionTarget);
        
        // If combat interaction, notify combat module
        if (window.interactionTarget.type === 'combat') {
          if (window.combatModule && window.combatModule.handleMovementComplete) {
            window.combatModule.handleMovementComplete();
          }
        }
        
        // Handle different interaction types
        if (window.interactionTarget.type === 'mining') {
          // Try to start mining
          if (window.miningModule && window.miningModule.handleMovementComplete) {
            window.miningModule.handleMovementComplete();
          }
        } else if (window.interactionTarget.type === 'woodcutting') {
          // Try to start woodcutting
          if (window.woodcuttingModule && window.woodcuttingModule.handleMovementComplete) {
            window.woodcuttingModule.handleMovementComplete();
          }
        } else if (window.interactionTarget.type === 'scribing') {
        // Try to open scribing interface
        if (window.scribingModule && window.scribingModule.handleMovementComplete) {
          window.scribingModule.handleMovementComplete();
        }
      } else if (window.interactionTarget.type === 'scribing_table') {
        // Try to open scribing table interface
        if (window.scribingModule && window.scribingModule.handleScribingTableMovementComplete) {
          window.scribingModule.handleScribingTableMovementComplete();
        }
        } else if (window.interactionTarget.type === 'fishing') {
          // Try to start fishing
          if (window.fishingModule && window.fishingModule.handleMovementComplete) {
            window.fishingModule.handleMovementComplete();
          }
        } else if (window.interactionTarget.type === 'harvesting') {
          // Try to start harvesting
          console.log('Movement complete for harvesting, calling handler...');
          if (window.harvestingModule && window.harvestingModule.handleMovementComplete) {
            window.harvestingModule.handleMovementComplete();
          } else if (window.startHarvesting && window.harvestingTarget) {
            // Fallback: call startHarvesting directly
            const target = window.harvestingTarget;
            window.startHarvesting(target.nodeType, target.x, target.y, target.element);
            window.harvestingTarget = null;
          }
        }
        
        // Clear the interaction target after handling
        window.interactionTarget = null;
      }
      
      // Check if any shops are open and auto-close them if player is too far away
      checkShopAutoClose();
    }
    return;
  }
  
  // Calculate movement direction
  let dx = 0;
  let dy = 0;
  
  const speed = movementSpeed * (isRunning ? RUN_MULT : 1);
  
  if (playerPosition.x < nextTarget.x) {
    dx = Math.min(speed * deltaTime, nextTarget.x - playerPosition.x);
  } else if (playerPosition.x > nextTarget.x) {
    dx = Math.max(-speed * deltaTime, nextTarget.x - playerPosition.x);
  }
  
  if (playerPosition.y < nextTarget.y) {
    dy = Math.min(speed * deltaTime, nextTarget.y - playerPosition.y);
  } else if (playerPosition.y > nextTarget.y) {
    dy = Math.max(-speed * deltaTime, nextTarget.y - playerPosition.y);
  }
  
  // Drain run energy proportional to distance moved when running
  if (isRunning && (dx !== 0 || dy !== 0)) {
    const dist = Math.hypot(dx, dy); // tiles moved this frame
    runEnergy = Math.max(0, runEnergy - dist * RUN_DRAIN_PER_TILE);
    if (runEnergy === 0) {
      isRunning = false; // auto-toggle off
    }
    updateRunUIButton();
  }
  
  // Update player position
  playerPosition.x += dx;
  playerPosition.y += dy;
  
  // Check if player is mining and has moved too far from the ore
  checkMiningDistance();
  
  // Check if player is woodcutting and has moved too far from the tree
  checkWoodcuttingDistance();
  
  // Check if player is scribing and has moved too far from the basin
  checkScribingDistance();
  
  // Check if player is fishing and has moved too far from the fishing spot
  checkFishingDistance();
  
  // Check if player is harvesting and has moved too far from the node
  checkHarvestingDistance();
  
  // Check if player is digging and has moved too far from the dig spot
  checkDiggingDistance();
  
  // Check if player has moved too far from combat target and should disengage
  if (window.checkCombatDisengagement) {
    window.checkCombatDisengagement();
  }
  
  // Update player direction based on movement
  updatePlayerDirection(dx, dy);
  
  // Update player appearance based on direction
  const player = document.getElementById('player-character');
  if (player) {
    updatePlayerAppearance(player, playerDirection);
    
    // Update movement state for sprite animation
    if (window.userModule && window.userModule.setPlayerMoving) {
      window.userModule.setPlayerMoving(true); // Player is moving
    }
  }
  
  // Check shop auto-close during movement
  // checkShopAutoClose(); // Commented out - causing movement freeze
}

// Update player direction based on movement vector
function updatePlayerDirection(dx, dy) {
  if (dx > 0 && dy < 0) {
    playerDirection = 'northeast';
  } else if (dx > 0 && dy > 0) {
    playerDirection = 'southeast';
  } else if (dx < 0 && dy > 0) {
    playerDirection = 'southwest';
  } else if (dx < 0 && dy < 0) {
    playerDirection = 'northwest';
  } else if (dx > 0) {
    playerDirection = 'east';
  } else if (dx < 0) {
    playerDirection = 'west';
  }
  // Removed dy > 0 and dy < 0 cases to keep current direction when moving purely up/down
}

// Update player appearance based on direction
function updatePlayerAppearance(playerElement, direction) {
  // Remove any previous direction classes
  playerElement.classList.remove(
    'facing-north', 'facing-east', 'facing-south', 'facing-west',
    'facing-northeast', 'facing-southeast', 'facing-southwest', 'facing-northwest'
  );
  
  // Add appropriate direction class
  playerElement.classList.add(`facing-${direction}`);
  
  // Use the new player form system if available
  if (window.userModule && window.userModule.applyPlayerFacing) {
    window.userModule.applyPlayerFacing(direction);
  } else {
    // Fallback to original transform system
    switch (direction) {
      case 'north':
        playerElement.style.transform = 'translateY(-2px)';
        break;
      case 'northeast':
        playerElement.style.transform = 'translate(2px, -2px)';
        break;
      case 'east':
        playerElement.style.transform = 'translateX(2px)';
        break;
      case 'southeast':
        playerElement.style.transform = 'translate(2px, 2px)';
        break;
      case 'south':
        playerElement.style.transform = 'translateY(2px)';
        break;
      case 'southwest':
        playerElement.style.transform = 'translate(-2px, 2px)';
        break;
      case 'west':
        playerElement.style.transform = 'translateX(-2px)';
        break;
      case 'northwest':
        playerElement.style.transform = 'translate(-2px, -2px)';
        break;
    }
  }
}

// Reset or cleanup the world
function resetWorld() {
  stopGameLoop();
  movementQueue = [];
  isMoving = false;
  playerPosition = { x: 50, y: 50 }; // Reset to starting position
  cameraPosition = { x: 50 - VIEWPORT_COLS / 2, y: 50 - VIEWPORT_ROWS / 2 }; // Reset camera
  lastCameraTilePosition = { x: -1, y: -1 }; // Reset camera tracking
}

// Update player visual position relative to the viewport
function updatePlayerVisualPosition() {
  const player = document.getElementById('player-character');
  if (!player) return;
  
  // Calculate player position relative to camera
  const viewportPlayerX = playerPosition.x - cameraPosition.x;
  const viewportPlayerY = playerPosition.y - cameraPosition.y;
  
  player.style.left = `${viewportPlayerX * GRID_SIZE}px`;
  player.style.top = `${viewportPlayerY * GRID_SIZE}px`;
}

// Show click animation at the specified world coordinates
function showClickAnimation(worldElement, worldX, worldY) {
  // Create animation element
  const clickEffect = document.createElement('div');
  clickEffect.className = 'click-effect';
  clickEffect.style.position = 'absolute';
  clickEffect.style.width = `${GRID_SIZE}px`;
  clickEffect.style.height = `${GRID_SIZE}px`;
  clickEffect.style.backgroundColor = 'rgba(255, 255, 255, 0.6)';
  clickEffect.style.border = '2px solid #ffffff';
  clickEffect.style.borderRadius = '4px';
  clickEffect.style.pointerEvents = 'none';
  clickEffect.style.zIndex = '5'; // Under the player (player is z-index 10)
  clickEffect.style.boxSizing = 'border-box';
  
  // Store world coordinates for position updates
  clickEffect.worldX = worldX;
  clickEffect.worldY = worldY;
  
  // Add pulsing animation
  clickEffect.style.animation = 'clickPulse 0.6s ease-out forwards';
  
  // Add animation keyframes if they don't exist
  if (!document.querySelector('#click-animation-styles')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'click-animation-styles';
    styleSheet.textContent = `
      @keyframes clickPulse {
        0% {
          transform: scale(0.8);
          opacity: 1;
        }
        50% {
          transform: scale(1.1);
          opacity: 0.8;
        }
        100% {
          transform: scale(1);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(styleSheet);
  }
  
  // Position based on current camera position
  updateClickEffectPosition(clickEffect);
  
  // Add to world
  worldElement.appendChild(clickEffect);
  
  // Remove after animation completes
  setTimeout(() => {
    if (clickEffect.parentNode) {
      clickEffect.parentNode.removeChild(clickEffect);
    }
  }, 600);
}

// Update click effect position based on camera
function updateClickEffectPosition(clickEffect) {
  // Calculate screen position based on world coordinates and camera position
  const screenX = (clickEffect.worldX - cameraPosition.x) * GRID_SIZE;
  const screenY = (clickEffect.worldY - cameraPosition.y) * GRID_SIZE;
  
  clickEffect.style.left = `${screenX}px`;
  clickEffect.style.top = `${screenY}px`;
}

// Show floor item context menu
function showFloorItemContextMenu(event, worldX, worldY) {
  // Remove any existing context menu
  hideFloorItemContextMenu();
  
  // Get all items at this position
  const itemsAtPosition = window.inventoryModule ? window.inventoryModule.getFloorItemsAt(worldX, worldY) : [];
  
  if (itemsAtPosition.length === 0) {
    console.log('No items found at position for context menu');
    return;
  }
  
  console.log(`CONTEXT MENU: Showing menu for ${itemsAtPosition.length} items at (${worldX}, ${worldY})`);
  
  const contextMenu = document.createElement('div');
  contextMenu.id = 'floor-item-context-menu';
  contextMenu.className = 'floor-item-context-menu';
  contextMenu.style.position = 'fixed';
  contextMenu.style.backgroundColor = '#2a2a2a';
  contextMenu.style.border = '1px solid #555';
  contextMenu.style.borderRadius = '5px';
  contextMenu.style.padding = '5px 0';
  contextMenu.style.zIndex = '2000';
  contextMenu.style.minWidth = '150px';
  contextMenu.style.maxWidth = '250px';
  contextMenu.style.boxShadow = '0 2px 10px rgba(0,0,0,0.5)';
  
  // Add header if multiple items
  if (itemsAtPosition.length > 1) {
    const header = document.createElement('div');
    header.style.padding = '5px 15px';
    header.style.fontSize = '12px';
    header.style.color = '#999';
    header.style.borderBottom = '1px solid #444';
    header.style.marginBottom = '5px';
    header.textContent = `${itemsAtPosition.length} items here:`;
    contextMenu.appendChild(header);
  }
  
  // Add "Walk here" option (only once per context menu)
  const walkHereOption = document.createElement('div');
  walkHereOption.className = 'context-menu-item';
  walkHereOption.innerHTML = `<span style="color: #FF9800;">⚬</span> Walk here`;
  walkHereOption.style.padding = '6px 15px';
  walkHereOption.style.cursor = 'pointer';
  walkHereOption.style.color = '#ccc';
  walkHereOption.style.transition = 'background-color 0.2s';
  walkHereOption.style.fontSize = '13px';
  
  walkHereOption.addEventListener('mouseenter', () => {
    walkHereOption.style.backgroundColor = '#3a3a3a';
  });
  
  walkHereOption.addEventListener('mouseleave', () => {
    walkHereOption.style.backgroundColor = 'transparent';
  });
  
  walkHereOption.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log(`CONTEXT MENU: Walk here clicked for position (${worldX}, ${worldY})`);
    
    // Show click animation at the target location
    const worldElement = document.getElementById('game-world');
    if (worldElement) {
      showClickAnimation(worldElement, worldX, worldY);
    }
    
    // Move player to this location without picking up anything
    movePlayerToTarget(worldX, worldY);
    
    hideFloorItemContextMenu();
  });
  
  contextMenu.appendChild(walkHereOption);
  
  // Add separator after walk here option
  const walkSeparator = document.createElement('div');
  walkSeparator.style.height = '1px';
  walkSeparator.style.backgroundColor = '#444';
  walkSeparator.style.margin = '5px 0';
  contextMenu.appendChild(walkSeparator);
  
  // Create menu items for each floor item
  itemsAtPosition.forEach((floorItem, index) => {
    const itemDef = window.inventoryModule ? window.inventoryModule.getItemDefinition(floorItem.item.id) : null;
    const itemName = itemDef ? itemDef.name : 'Unknown Item';
    const quantity = floorItem.item.quantity > 1 ? ` (${floorItem.item.quantity})` : '';
    
    // Pick up option
    const pickupOption = document.createElement('div');
    pickupOption.className = 'context-menu-item';
    pickupOption.innerHTML = `<span style="color: #4CAF50;">↑</span> Pick up ${itemName}${quantity}`;
    pickupOption.style.padding = '6px 15px';
    pickupOption.style.cursor = 'pointer';
    pickupOption.style.color = '#ccc';
    pickupOption.style.transition = 'background-color 0.2s';
    pickupOption.style.fontSize = '13px';
    
    pickupOption.addEventListener('mouseenter', () => {
      pickupOption.style.backgroundColor = '#3a3a3a';
    });
    
    pickupOption.addEventListener('mouseleave', () => {
      pickupOption.style.backgroundColor = 'transparent';
    });
    
    pickupOption.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('CONTEXT MENU: Pick up clicked for', floorItem.id);
      
      // Use same OSRS-style walk-to-pickup logic as left-click
      const playerPos = window.worldModule.getPlayerPosition();
      if (playerPos) {
        const playerX = Math.floor(playerPos.x);
        const playerY = Math.floor(playerPos.y);
        const itemX = Math.floor(floorItem.x);
        const itemY = Math.floor(floorItem.y);
        const distance = Math.abs(playerX - itemX) + Math.abs(playerY - itemY);
        
        console.log(`CONTEXT MENU: Distance check - Player(${playerX}, ${playerY}) -> Item(${itemX}, ${itemY}), Distance: ${distance}`);
        
        if (distance > 1) {
          // Too far - walk to item first
          console.log('CONTEXT MENU: Too far away, walking to item first');
          window.pickupTarget = {
            itemId: floorItem.id,
            x: floorItem.x,
            y: floorItem.y
          };
          movePlayerToTarget(floorItem.x, floorItem.y);
        } else {
          // Close enough - pick up directly
          console.log('CONTEXT MENU: Close enough, picking up directly');
          if (window.inventoryModule && window.inventoryModule.pickupFloorItem) {
            window.inventoryModule.pickupFloorItem(floorItem.id);
          } else {
            console.error('CONTEXT MENU ERROR: inventoryModule.pickupFloorItem not available');
          }
        }
      } else {
        // Fallback to direct pickup if position check fails
        console.log('CONTEXT MENU: Position check failed, trying direct pickup');
        if (window.inventoryModule && window.inventoryModule.pickupFloorItem) {
          window.inventoryModule.pickupFloorItem(floorItem.id);
        } else {
          console.error('CONTEXT MENU ERROR: inventoryModule.pickupFloorItem not available');
        }
      }
      
      hideFloorItemContextMenu();
    });
    
    // Examine option
    const examineOption = document.createElement('div');
    examineOption.className = 'context-menu-item';
    examineOption.innerHTML = `<span style="color: #2196F3;">?</span> Examine ${itemName}`;
    examineOption.style.padding = '6px 15px';
    examineOption.style.cursor = 'pointer';
    examineOption.style.color = '#ccc';
    examineOption.style.transition = 'background-color 0.2s';
    examineOption.style.fontSize = '13px';
    
    examineOption.addEventListener('mouseenter', () => {
      examineOption.style.backgroundColor = '#3a3a3a';
    });
    
    examineOption.addEventListener('mouseleave', () => {
      examineOption.style.backgroundColor = 'transparent';
    });
    
    examineOption.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('CONTEXT MENU: Examine clicked for', floorItem.id);
      
      if (itemDef) {
        if (window.uiModule && window.uiModule.showNotification) {
          window.uiModule.showNotification(`${itemDef.name}: ${itemDef.description}`);
        } else {
          alert(`${itemDef.name}: ${itemDef.description}`);
        }
      }
      
      hideFloorItemContextMenu();
    });
    
    contextMenu.appendChild(pickupOption);
    contextMenu.appendChild(examineOption);
    
    // Add separator between items (except after the last item)
    if (index < itemsAtPosition.length - 1) {
      const separator = document.createElement('div');
      separator.style.height = '1px';
      separator.style.backgroundColor = '#444';
      separator.style.margin = '5px 0';
      contextMenu.appendChild(separator);
    }
  });
  
  // Position the menu
  contextMenu.style.left = `${event.pageX}px`;
  contextMenu.style.top = `${event.pageY}px`;
  
  document.body.appendChild(contextMenu);
  
  // Store position reference for cleanup
  contextMenu.worldX = worldX;
  contextMenu.worldY = worldY;
}

// Hide floor item context menu
function hideFloorItemContextMenu() {
  const existingMenu = document.getElementById('floor-item-context-menu');
  if (existingMenu) {
    existingMenu.remove();
  }
  
  const existingBankMenu = document.getElementById('bank-context-menu');
  if (existingBankMenu) {
    existingBankMenu.remove();
  }
}

// Hide context menu when clicking elsewhere
document.addEventListener('click', (e) => {
  if (!e.target.closest('#floor-item-context-menu') && !e.target.closest('#bank-context-menu')) {
    hideFloorItemContextMenu();
  }
});

// Show ground context menu for empty tiles
function showGroundContextMenu(event, worldX, worldY) {
  // Remove any existing context menu
  hideFloorItemContextMenu();
  
  console.log(`GROUND CONTEXT MENU: Showing menu for empty ground at (${worldX}, ${worldY})`);
  
  const contextMenu = document.createElement('div');
  contextMenu.id = 'floor-item-context-menu'; // Reuse same ID for consistent styling and cleanup
  contextMenu.className = 'floor-item-context-menu';
  contextMenu.style.position = 'fixed';
  contextMenu.style.backgroundColor = '#2a2a2a';
  contextMenu.style.border = '1px solid #555';
  contextMenu.style.borderRadius = '5px';
  contextMenu.style.padding = '5px 0';
  contextMenu.style.zIndex = '2000';
  contextMenu.style.minWidth = '120px';
  contextMenu.style.boxShadow = '0 2px 10px rgba(0,0,0,0.5)';
  
  // Add "Walk here" option
  const walkHereOption = document.createElement('div');
  walkHereOption.className = 'context-menu-item';
  walkHereOption.innerHTML = `<span style="color: #FF9800;">⚬</span> Walk here`;
  walkHereOption.style.padding = '8px 15px';
  walkHereOption.style.cursor = 'pointer';
  walkHereOption.style.color = '#ccc';
  walkHereOption.style.transition = 'background-color 0.2s';
  walkHereOption.style.fontSize = '13px';
  
  walkHereOption.addEventListener('mouseenter', () => {
    walkHereOption.style.backgroundColor = '#3a3a3a';
  });
  
  walkHereOption.addEventListener('mouseleave', () => {
    walkHereOption.style.backgroundColor = 'transparent';
  });
  
  walkHereOption.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log(`GROUND CONTEXT MENU: Walk here clicked for position (${worldX}, ${worldY})`);
    
    // Show click animation at the target location
    const worldElement = document.getElementById('game-world');
    if (worldElement) {
      showClickAnimation(worldElement, worldX, worldY);
    }
    
    // Move player to this location
    movePlayerToTarget(worldX, worldY);
    
    hideFloorItemContextMenu();
  });
  
  contextMenu.appendChild(walkHereOption);
  
  // Position the menu
  contextMenu.style.left = `${event.pageX}px`;
  contextMenu.style.top = `${event.pageY}px`;
  
  document.body.appendChild(contextMenu);
  
  // Store position reference for cleanup
  contextMenu.worldX = worldX;
  contextMenu.worldY = worldY;
}

// Export functions
export {
  initializeWorld,
  movePlayerToTarget,
  movePlayerToInteractiveTarget,
  resetWorld,
  GRID_SIZE,
  WORLD_COLS,
  WORLD_ROWS,
  // New exports for inventory integration
  getPlayerPosition,
  getCameraPosition,
  getWorldBounds,
  getGridSize,
  isPositionWalkable,
  forceWorldRerender,
  findPath,
  updatePlayerDirection,
  updatePlayerAppearance,
  // Periodic update system
  startPeriodicWorldUpdate,
  stopPeriodicWorldUpdate
};

// New functions for inventory integration
function getPlayerPosition() {
  return { x: playerPosition.x, y: playerPosition.y };
}

/**
 * Set player position directly (for multiplayer spawning)
 */
function setPlayerPosition(x, y) {
  console.log(`🚀 Setting player position directly to (${x}, ${y})`);
  
  // Validate coordinates
  if (x < 0 || x >= WORLD_COLS || y < 0 || y >= WORLD_ROWS) {
    console.error('Invalid position:', x, y);
    return false;
  }
  
  // Set position immediately
  playerPosition.x = x;
  playerPosition.y = y;
  
  // Clear any existing movement
  playerTarget = null;
  isMoving = false;
  movementQueue = [];
  
  // Update camera to center on new position
  cameraPosition.x = x - VIEWPORT_COLS / 2;
  cameraPosition.y = y - VIEWPORT_ROWS / 2;
  
  // Clamp camera to world bounds
  cameraPosition.x = Math.max(0, Math.min(WORLD_COLS - VIEWPORT_COLS, cameraPosition.x));
  cameraPosition.y = Math.max(0, Math.min(WORLD_ROWS - VIEWPORT_ROWS, cameraPosition.y));
  
  // Update visual position immediately
  updatePlayerVisualPosition();
  
  // Force world rerender to update everything
  forceWorldRerender();
  
  console.log(`✅ Player teleported to (${x}, ${y}), camera at (${cameraPosition.x}, ${cameraPosition.y})`);
  return true;
}

function getCameraPosition() {
  return { x: cameraPosition.x, y: cameraPosition.y };
}

function getWorldBounds() {
  return { width: WORLD_COLS, height: WORLD_ROWS };
}

function getGridSize() {
  return GRID_SIZE;
}

function isPositionWalkable(x, y) {
  if (x < 0 || x >= WORLD_COLS || y < 0 || y >= WORLD_ROWS) {
    return false; // Out of bounds
  }
  
  // Check terrain layer for obstacles at current map level using sparse storage
  const tileValue = getTileOnLayer(LAYERS.TERRAIN, x, y, currentMapLevel);
  // Walkable terrain: grass (0), sand (2), stone floor (4), dirt (6), cobblestone (7), wooden floor (8),
  // gravel (17), snow (18), mud (19), swamp (21), tundra (22), desert stone (23), mossy stone (24),
  // marble floor (33), carpet (34), metal grating (35), crystal floor (36), lava rock (37), ice floor (38), grass path (39), ancient tiles (40),
  // black void (57) for underground
  // Not walkable terrain: rock obstacles (1), water (3), brick walls (5), all wall types (9-16, 25-32), lava (20)
  const nonWalkableTerrains = [1, 3, 5, 9, 10, 11, 12, 13, 14, 15, 16, 20, 25, 26, 27, 28, 29, 30, 31, 32];
  const terrainWalkable = !nonWalkableTerrains.includes(tileValue);
  
  if (!terrainWalkable) {
    return false; // Terrain itself is not walkable
  }
  
  // Check interactive objects layer for obstacles at current map level using sparse storage
  const objectValue = getTileOnLayer(LAYERS.INTERACTIVE_OBJECTS, x, y, currentMapLevel);
  if (objectValue !== null && objectValue !== undefined) {
    // Item spawns are walkable (invisible in game world)
    if (objectValue === 'item_spawn') {
      return true; // Allow walking through item spawns
    }
    // All other interactive objects (banks, trees, ores) are impassable obstacles
    return false;
  }
  
  // Check ground objects layer for obstacles at current map level using sparse storage
  const groundObjectValue = getTileOnLayer(LAYERS.GROUND_OBJECTS, x, y, currentMapLevel);
  if (groundObjectValue !== null && groundObjectValue !== undefined) {
    // Future ground objects might be obstacles too
    return false;
  }
  
  return true; // Position is walkable
}

// Handle bank click
function handleBankClick(bankX, bankY) {
  console.log(`BANK: Bank clicked at (${bankX}, ${bankY})`);
  
  // Check if player is close enough to use the bank
  const playerPosition = getPlayerPosition();
  if (!playerPosition) {
    console.error('BANK: Could not get player position');
    return;
  }
  
  const playerX = Math.floor(playerPosition.x);
  const playerY = Math.floor(playerPosition.y);
  const distance = Math.max(Math.abs(playerX - bankX), Math.abs(playerY - bankY)); // Use Chebyshev distance
  
  console.log(`BANK: Distance check - Player(${playerX}, ${playerY}) -> Bank(${bankX}, ${bankY}), Distance: ${distance}`);
  
  if (distance > 1.5) {
    // Too far - move to bank first
    console.log('BANK: Too far away, using enhanced pathfinding');
    window.bankTarget = { x: bankX, y: bankY };
    movePlayerToInteractiveTarget(bankX, bankY);
  } else {
    // Close enough - open bank interface using new bank system
    console.log('BANK: Close enough, opening new server-synced bank interface');
    if (window.bankModule && window.bankModule.openBank) {
      window.bankModule.openBank();
    } else {
      console.error('BANK: New bank module not available');
    }
  }
}

// Handle shop click
function handleShopClick(shopType, shopX, shopY) {
  console.log(`SHOP: ${shopType} clicked at (${shopX}, ${shopY})`);
  
  // Check if player is close enough to use the shop
  const playerPos = getPlayerPosition();
  if (!playerPos) {
    console.error('SHOP: Could not get player position');
    return;
  }
  
  const playerX = Math.floor(playerPos.x);
  const playerY = Math.floor(playerPos.y);
  const distance = Math.max(Math.abs(playerX - shopX), Math.abs(playerY - shopY)); // Use Chebyshev distance
  
  console.log(`SHOP: Distance check - Player(${playerX}, ${playerY}) -> Shop(${shopX}, ${shopY}), Distance: ${distance}`);
  
  if (distance > 1) {
    // Too far - use enhanced pathfinding that stops at adjacent tiles
    console.log('SHOP: Too far away, using enhanced pathfinding');
    window.shopTarget = { x: shopX, y: shopY, type: shopType };
    movePlayerToInteractiveTarget(shopX, shopY);
  } else {
    // Close enough - open shop interface
    console.log('SHOP: Close enough, opening shop interface');
    openShopByType(shopType);
  }
}

// Open shop based on shop type
function openShopByType(shopType) {
  if (!window.inventoryModule) {
    console.error('SHOP: inventoryModule not available');
    return;
  }
  
  const shopMapping = {
        'shop_general': 'general_store',
    'shop_weapon': 'weapon_shop',
    'shop_magic': 'magic_shop',
    'shop_mining': 'mining_shop',
    'shop_fletching': 'fletching_shop',
    'shop_fishing': 'fishing_shop'
  };
  
  const shopId = shopMapping[shopType];
  if (shopId) {
    console.log(`SHOP: Opening ${shopId}`);
    window.inventoryModule.openShop(shopId);
  } else {
    console.error(`SHOP: Unknown shop type: ${shopType}`);
  }
}

// Show bank context menu
function showBankContextMenu(event, bankX, bankY) {
  // Remove any existing context menu
  hideFloorItemContextMenu();
  
  console.log(`BANK CONTEXT MENU: Showing menu for bank at (${bankX}, ${bankY})`);
  
  const contextMenu = document.createElement('div');
  contextMenu.id = 'bank-context-menu';
  contextMenu.className = 'bank-context-menu';
  contextMenu.style.position = 'fixed';
  contextMenu.style.backgroundColor = '#2a2a2a';
  contextMenu.style.border = '1px solid #555';
  contextMenu.style.borderRadius = '5px';
  contextMenu.style.padding = '5px 0';
  contextMenu.style.zIndex = '2000';
  contextMenu.style.minWidth = '120px';
  contextMenu.style.boxShadow = '0 2px 10px rgba(0,0,0,0.5)';
  
  // Add "Walk here" option
  const walkHereOption = document.createElement('div');
  walkHereOption.className = 'context-menu-item';
  walkHereOption.innerHTML = `<span style="color: #FF9800;">⚬</span> Walk here`;
  walkHereOption.style.padding = '8px 15px';
  walkHereOption.style.cursor = 'pointer';
  walkHereOption.style.color = '#ccc';
  walkHereOption.style.transition = 'background-color 0.2s';
  walkHereOption.style.fontSize = '13px';
  
  walkHereOption.addEventListener('mouseenter', () => {
    walkHereOption.style.backgroundColor = '#3a3a3a';
  });
  
  walkHereOption.addEventListener('mouseleave', () => {
    walkHereOption.style.backgroundColor = 'transparent';
  });
  
  walkHereOption.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log(`BANK CONTEXT MENU: Walk here clicked for position (${bankX}, ${bankY})`);
    
    // Show click animation at the target location
    const worldElement = document.getElementById('game-world');
    if (worldElement) {
      showClickAnimation(worldElement, bankX, bankY);
    }
    
    // Move player to this location
    movePlayerToTarget(bankX, bankY);
    
    hideFloorItemContextMenu();
  });
  
  // Add "Bank" option for banks
  const bankOption = document.createElement('div');
  bankOption.className = 'context-menu-item';
  bankOption.innerHTML = `<span style="color: #4CAF50;">🏦</span> Bank`;
  bankOption.style.padding = '8px 15px';
  bankOption.style.cursor = 'pointer';
  bankOption.style.color = '#ccc';
  bankOption.style.transition = 'background-color 0.2s';
  bankOption.style.fontSize = '13px';
  
  bankOption.addEventListener('mouseenter', () => {
    bankOption.style.backgroundColor = '#3a3a3a';
  });
  
  bankOption.addEventListener('mouseleave', () => {
    bankOption.style.backgroundColor = 'transparent';
  });
  
  bankOption.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log(`BANK CONTEXT MENU: Bank clicked for position (${bankX}, ${bankY})`);
    
    // Use the existing handleBankClick function
    handleBankClick(bankX, bankY);
    
    hideFloorItemContextMenu();
  });
  
  contextMenu.appendChild(walkHereOption);
  contextMenu.appendChild(bankOption);
  
  // Position the menu
  contextMenu.style.left = `${event.pageX}px`;
  contextMenu.style.top = `${event.pageY}px`;
  
  document.body.appendChild(contextMenu);
  
  // Store position reference for cleanup
  contextMenu.worldX = bankX;
  contextMenu.worldY = bankY;
}

// Function to get a random object type based on rarity
function getRandomObjectType(types) {
  const random = Math.random();
  let cumulativeRarity = 0;
  
  for (const type of types) {
    cumulativeRarity += type.rarity;
    if (random <= cumulativeRarity) {
      return type;
    }
  }
  
  // Fallback to the first type
  return types[0];
}

// Generate a default blank world with no objects using sparse storage
function generateDefaultWorld() {
  console.log('Generating default blank world for both surface and underground...');
  
  // Generate terrain for both map levels using sparse storage
  for (const mapLevel of Object.values(MAP_LEVELS)) {
    const defaultTerrain = DEFAULT_TERRAIN[mapLevel];
    
    for (let y = 0; y < WORLD_ROWS; y++) {
      for (let x = 0; x < WORLD_COLS; x++) {
        setTileOnLayer(LAYERS.TERRAIN, x, y, defaultTerrain, mapLevel);
      }
    }
    
    console.log(`Generated ${MAP_LEVEL_NAMES[mapLevel]} terrain with ${defaultTerrain === 3 ? 'water' : 'black void'} base`);
  }
  
  // Clear objects - no automatic bank
  worldObjects = [];
  
  // Add some default shops for testing (spread them out around spawn) on surface only
  addDefaultShops();
  
  // Add default ladders for level transitions
  addDefaultLadders();
  
  console.log('Default blank world generated with default shops and ladders');
}

// Add default ladders for testing map level transitions
function addDefaultLadders() {
  const ladderX = 52; // Near spawn
  const ladderY = 52;
  
  // Add ladder down on surface level
  setTileOnLayer(LAYERS.INTERACTIVE_OBJECTS, ladderX, ladderY, 'ladder_down', MAP_LEVELS.SURFACE);
  
  // Add ladder up on underground level at the same position
  setTileOnLayer(LAYERS.INTERACTIVE_OBJECTS, ladderX, ladderY, 'ladder_up', MAP_LEVELS.UNDERGROUND);
  
  // Ensure terrain under ladders is walkable
  setTileOnLayer(LAYERS.TERRAIN, ladderX, ladderY, 0, MAP_LEVELS.SURFACE); // Grass
  setTileOnLayer(LAYERS.TERRAIN, ladderX, ladderY, 57, MAP_LEVELS.UNDERGROUND); // Black void
  
  console.log(`Added ladders at (${ladderX}, ${ladderY}) for map level transitions`);
}

// Add default shops to the world for testing
function addDefaultShops() {
  console.log('Adding default shops for testing...');
  
  // Define shop positions around the spawn point (50, 50)
  const defaultShops = [
    { type: 'shop_general', x: 45, y: 45, name: 'General Store' },
    { type: 'shop_weapon', x: 55, y: 45, name: 'Weapon Shop' },
    { type: 'shop_magic', x: 45, y: 55, name: 'Magic Shop' },
    { type: 'shop_mining', x: 55, y: 55, name: 'Mining Shop' },
    { type: 'shop_fletching', x: 65, y: 50, name: 'Fletching Shop' },
    { type: 'shop_fishing', x: 35, y: 50, name: 'Fishing Shop' },
    { type: 'bank', x: 50, y: 40, name: 'Bank' }, // Also add a bank for comparison
    { type: 'pulp_basin', x: 42, y: 50, name: 'Pulp Basin' }, // For scribing testing
    { type: 'scribing_table', x: 45, y: 50, name: 'Scribing Table' } // For scribing testing
  ];
  
  // Place shops on the INTERACTIVE_OBJECTS layer on surface level
  defaultShops.forEach(shop => {
    if (shop.x >= 0 && shop.x < WORLD_COLS && shop.y >= 0 && shop.y < WORLD_ROWS) {
      setTileOnLayer(LAYERS.INTERACTIVE_OBJECTS, shop.x, shop.y, shop.type, MAP_LEVELS.SURFACE);
      // Ensure terrain under shops is walkable on surface
      setTileOnLayer(LAYERS.TERRAIN, shop.x, shop.y, 0, MAP_LEVELS.SURFACE); // Grass
      console.log(`Placed ${shop.name} at (${shop.x}, ${shop.y}) on surface`);
    }
  });
  
  // Add cooking area near the other shops
  const cookingArea = [
    { type: 'cooking_range', x: 47, y: 43, name: 'Cooking Range 1' },
    { type: 'cooking_range', x: 49, y: 43, name: 'Cooking Range 2' },
    { type: 'cooking_fire', x: 51, y: 43, name: 'Cooking Fire 1' },
    { type: 'cooking_fire', x: 53, y: 43, name: 'Cooking Fire 2' }
  ];
  
  cookingArea.forEach(cookingStation => {
    if (cookingStation.x >= 0 && cookingStation.x < WORLD_COLS && cookingStation.y >= 0 && cookingStation.y < WORLD_ROWS) {
      // Only place cooking station if nothing else is there on surface
      const existing = getTileOnLayer(LAYERS.INTERACTIVE_OBJECTS, cookingStation.x, cookingStation.y, MAP_LEVELS.SURFACE);
      if (existing === null) {
        setTileOnLayer(LAYERS.INTERACTIVE_OBJECTS, cookingStation.x, cookingStation.y, cookingStation.type, MAP_LEVELS.SURFACE);
        // Ensure terrain under cooking stations is walkable on surface
        setTileOnLayer(LAYERS.TERRAIN, cookingStation.x, cookingStation.y, 0, MAP_LEVELS.SURFACE); // Grass
        console.log(`Placed ${cookingStation.name} at (${cookingStation.x}, ${cookingStation.y}) on surface`);
      }
    }
  });
  
  // Add some copper ore nodes near spawn for mining testing
  const copperOreNodes = [
    { x: 48, y: 42 },
    { x: 52, y: 42 },
    { x: 46, y: 48 },
    { x: 54, y: 48 },
    { x: 48, y: 57 },
    { x: 52, y: 57 }
  ];
  
  copperOreNodes.forEach(ore => {
    if (ore.x >= 0 && ore.x < WORLD_COLS && ore.y >= 0 && ore.y < WORLD_ROWS) {
      // Only place ore if nothing else is there on surface
      const existing = getTileOnLayer(LAYERS.INTERACTIVE_OBJECTS, ore.x, ore.y, MAP_LEVELS.SURFACE);
      if (existing === null) {
        setTileOnLayer(LAYERS.INTERACTIVE_OBJECTS, ore.x, ore.y, 'ore_copper', MAP_LEVELS.SURFACE);
        // Ensure terrain under ore is walkable on surface
        setTileOnLayer(LAYERS.TERRAIN, ore.x, ore.y, 0, MAP_LEVELS.SURFACE); // Grass
        console.log(`Placed Copper Ore at (${ore.x}, ${ore.y}) on surface`);
      }
    }
  });
  
  // Add harvesting nodes for testing
  const harvestingNodes = [
    { type: 'apple_tree', x: 35, y: 45 },
    { type: 'cherry_tree', x: 37, y: 45 },
    { type: 'peach_tree', x: 39, y: 45 },
    { type: 'mushroom_patch', x: 35, y: 47 },
    { type: 'wheat_field', x: 37, y: 47 },
    { type: 'apple_tree', x: 60, y: 45 },
    { type: 'mushroom_patch', x: 62, y: 45 }
  ];
  
  harvestingNodes.forEach(node => {
    if (node.x >= 0 && node.x < WORLD_COLS && node.y >= 0 && node.y < WORLD_ROWS) {
      // Only place node if nothing else is there on surface
      const existing = getTileOnLayer(LAYERS.INTERACTIVE_OBJECTS, node.x, node.y, MAP_LEVELS.SURFACE);
      if (existing === null) {
        setTileOnLayer(LAYERS.INTERACTIVE_OBJECTS, node.x, node.y, node.type, MAP_LEVELS.SURFACE);
        // Ensure terrain under nodes is walkable on surface
        setTileOnLayer(LAYERS.TERRAIN, node.x, node.y, 0, MAP_LEVELS.SURFACE); // Grass
        console.log(`Placed ${node.type} at (${node.x}, ${node.y}) on surface`);
      }
    }
  });
  
  console.log(`Added ${defaultShops.length} default shops, ${cookingArea.length} cooking stations, ${copperOreNodes.length} copper ore nodes, and ${harvestingNodes.length} harvesting nodes to world`);
}

// Get custom map data from localStorage
function getCustomMapData() {
  try {
    const mapData = localStorage.getItem('webscape_custom_map');
    return mapData ? JSON.parse(mapData) : null;
  } catch (error) {
    console.error('Error loading custom map from localStorage:', error);
    return null;
  }
}

// Load custom map data into the world with offset system
function loadCustomMapData(mapData) {
  if (!mapData) {
    console.error('Invalid custom map data');
    generateDefaultWorld();
    return;
  }
  
  console.log('Loading custom map data with offset system:', mapData);
  
  // Update world dimensions from map data if available
  if (mapData.worldCols && mapData.worldRows) {
    WORLD_COLS = mapData.worldCols;
    WORLD_ROWS = mapData.worldRows;
    console.log(`Updated world dimensions to ${WORLD_COLS}x${WORLD_ROWS} from map data`);
  } else if (mapData.layers && mapData.layers[0]) {
    // Infer dimensions from layer data
    WORLD_ROWS = mapData.layers[0].length;
    WORLD_COLS = mapData.layers[0][0] ? mapData.layers[0][0].length : 100;
    console.log(`Inferred world dimensions as ${WORLD_COLS}x${WORLD_ROWS} from layer data`);
  } else if (mapData.grid) {
    // Infer dimensions from legacy grid data
    WORLD_ROWS = mapData.grid.length;
    WORLD_COLS = mapData.grid[0] ? mapData.grid[0].length : 100;
    console.log(`Inferred world dimensions as ${WORLD_COLS}x${WORLD_ROWS} from grid data`);
  }
  
  // Initialize layers first
  initializeLayers();
  
  // Handle different map formats
  if (mapData.layers) {
    // New layered format
    console.log('Loading layered map format');
    
    // Check if this is the new multi-level format with mapLevels
    if (mapData.mapLevels) {
      console.log('Loading multi-level map format with offset system');
      
      // Load surface level data
      if (mapData.mapLevels[MAP_LEVELS.SURFACE]) {
        for (let layer = 0; layer < Object.values(LAYERS).length; layer++) {
          if (mapData.mapLevels[MAP_LEVELS.SURFACE][layer]) {
            // Copy surface data directly to sparse storage
            for (let y = 0; y < WORLD_ROWS && y < mapData.mapLevels[MAP_LEVELS.SURFACE][layer].length; y++) {
              for (let x = 0; x < WORLD_COLS && x < mapData.mapLevels[MAP_LEVELS.SURFACE][layer][y].length; x++) {
                const value = mapData.mapLevels[MAP_LEVELS.SURFACE][layer][y][x];
                if (value !== null && value !== undefined) {
                  const key = `${x},${y}`;
                  worldLayers[layer].set(key, value);
                }
              }
            }
          }
        }
      }
      
      // Load underground level data to offset coordinates
      if (mapData.mapLevels[MAP_LEVELS.UNDERGROUND]) {
        for (let layer = 0; layer < Object.values(LAYERS).length; layer++) {
          if (mapData.mapLevels[MAP_LEVELS.UNDERGROUND][layer]) {
            // Copy underground data to offset area in sparse storage
            for (let y = 0; y < WORLD_ROWS && y < mapData.mapLevels[MAP_LEVELS.UNDERGROUND][layer].length; y++) {
              for (let x = 0; x < WORLD_COLS && x < mapData.mapLevels[MAP_LEVELS.UNDERGROUND][layer][y].length; x++) {
                const value = mapData.mapLevels[MAP_LEVELS.UNDERGROUND][layer][y][x];
                if (value !== null && value !== undefined) {
                  const actualX = x + UNDERGROUND_OFFSET.X;
                  const actualY = y + UNDERGROUND_OFFSET.Y;
                  const key = `${actualX},${actualY}`;
                  worldLayers[layer].set(key, value);
                }
              }
            }
          }
        }
      }
    } else {
      // Legacy single-level layered format - load as surface only
      console.log('Loading legacy single-level layered format');
      
      // Load layer data for surface level
      for (let layer = 0; layer < Math.min(mapData.layers.length, Object.values(LAYERS).length); layer++) {
        for (let y = 0; y < WORLD_ROWS && y < mapData.layers[layer].length; y++) {
          for (let x = 0; x < WORLD_COLS && x < mapData.layers[layer][y].length; x++) {
            const value = mapData.layers[layer][y][x];
            if (value !== null && value !== undefined) {
              const key = `${x},${y}`;
              worldLayers[layer].set(key, value);
            }
          }
        }
      }
    }
    
  } else if (mapData.grid) {
    // Legacy format with grid data
    console.log('Loading legacy map format with grid data');
    
    // Load terrain layer data for surface level
    for (let y = 0; y < WORLD_ROWS && y < mapData.grid.length; y++) {
      for (let x = 0; x < WORLD_COLS && x < mapData.grid[y].length; x++) {
        const value = mapData.grid[y][x];
        if (value !== null && value !== undefined) {
          const key = `${x},${y}`;
          worldLayers[LAYERS.TERRAIN].set(key, value);
        }
      }
    }
    
    // Convert legacy objects to layer system
    if (mapData.objects && Array.isArray(mapData.objects)) {
      worldObjects = []; // Clear legacy objects
      
      mapData.objects.forEach(customObj => {
        // Skip NPC objects - they are handled by the NPC system, not as static world objects
        if (customObj.type.startsWith('npc_')) {
          console.log(`Skipping NPC object ${customObj.type} at (${customObj.x}, ${customObj.y}) - handled by NPC system`);
          return;
        }
        
        const layer = getObjectLayer(customObj.type);
        if (layer !== null && customObj.x < WORLD_COLS && customObj.y < WORLD_ROWS) {
          // Place object on appropriate layer on surface level
          const key = `${customObj.x},${customObj.y}`;
          worldLayers[layer].set(key, customObj.type);
          console.log(`Placed ${customObj.type} on layer ${layer} at (${customObj.x}, ${customObj.y}) on surface`);
        } else {
          console.warn('Unknown object type or invalid coordinates:', customObj);
        }
      });
    }
  }
  
  // Set player spawn location if provided (only for initial spawn)
  if (mapData.playerSpawn && (!localStorage.getItem('webscape_player_position'))) {
    playerPosition = { 
      x: mapData.playerSpawn.x, 
      y: mapData.playerSpawn.y 
    };
    console.log(`Player spawned at custom location: (${playerPosition.x}, ${playerPosition.y})`);
  }
  
  console.log(`Custom map loaded with offset system`);
  
  // Load item spawns if present
  if (mapData.itemSpawns) {
    console.log('Loading item spawns:', mapData.itemSpawns);
    loadItemSpawns(mapData.itemSpawns);
  } else {
    console.log('No item spawns found in map data');
  }
  
  // Force re-render the world to show new content
  const worldElement = document.getElementById('world-canvas');
  if (worldElement) {
    console.log('Re-rendering world after loading custom map data');
    renderWorld(worldElement);
  }
}

// Determine which layer an object type should be placed on
function getObjectLayer(objectType) {
  const layerMap = {
    // Interactive objects (banks, trees, ores) go on layer 2
    'bank': LAYERS.INTERACTIVE_OBJECTS,
    'shop_general': LAYERS.INTERACTIVE_OBJECTS,
    'shop_weapon': LAYERS.INTERACTIVE_OBJECTS,
    'shop_magic': LAYERS.INTERACTIVE_OBJECTS,
    'shop_mining': LAYERS.INTERACTIVE_OBJECTS,
    'shop_fletching': LAYERS.INTERACTIVE_OBJECTS,
    'shop_fishing': LAYERS.INTERACTIVE_OBJECTS,
    'tree_oak': LAYERS.INTERACTIVE_OBJECTS,
    'tree_regular': LAYERS.INTERACTIVE_OBJECTS,
    'tree_pine': LAYERS.INTERACTIVE_OBJECTS,
    'tree_palm': LAYERS.INTERACTIVE_OBJECTS,
    'tree_bamboo': LAYERS.INTERACTIVE_OBJECTS,
    'tree_magic': LAYERS.INTERACTIVE_OBJECTS,
    'scribing_table': LAYERS.INTERACTIVE_OBJECTS,
    'ore_copper': LAYERS.INTERACTIVE_OBJECTS,
    'ore_tin': LAYERS.INTERACTIVE_OBJECTS,
    'ore_iron': LAYERS.INTERACTIVE_OBJECTS,
    'ore_silver': LAYERS.INTERACTIVE_OBJECTS,
    'ore_gold': LAYERS.INTERACTIVE_OBJECTS,
    'ore_mithril': LAYERS.INTERACTIVE_OBJECTS,
    'ore_adamantite': LAYERS.INTERACTIVE_OBJECTS,
    'cooking_range': LAYERS.INTERACTIVE_OBJECTS,
    'cooking_fire': LAYERS.INTERACTIVE_OBJECTS,
    'apple_tree': LAYERS.INTERACTIVE_OBJECTS,
    'cherry_tree': LAYERS.INTERACTIVE_OBJECTS,
    'peach_tree': LAYERS.INTERACTIVE_OBJECTS,
    'mushroom_patch': LAYERS.INTERACTIVE_OBJECTS,
    'wheat_field': LAYERS.INTERACTIVE_OBJECTS,
    'fishing_spot_shrimp': LAYERS.INTERACTIVE_OBJECTS,
    'fishing_spot_sardine': LAYERS.INTERACTIVE_OBJECTS,
    'fishing_spot_herring': LAYERS.INTERACTIVE_OBJECTS,
    'fishing_spot_anchovies': LAYERS.INTERACTIVE_OBJECTS,
    'fishing_spot_tuna': LAYERS.INTERACTIVE_OBJECTS,
    'fishing_spot_lobster': LAYERS.INTERACTIVE_OBJECTS,
    'fishing_spot_swordfish': LAYERS.INTERACTIVE_OBJECTS,
    'fishing_spot_shark': LAYERS.INTERACTIVE_OBJECTS,
    'item_spawn': LAYERS.INTERACTIVE_OBJECTS,
    'pulp_basin': LAYERS.INTERACTIVE_OBJECTS,
    'ladder_down': LAYERS.INTERACTIVE_OBJECTS,
    'ladder_up': LAYERS.INTERACTIVE_OBJECTS,
    
    // Ground objects would go on layer 1 (none defined yet)
    
    // Decorative overlays would go on layer 3 (none defined yet)
  };
  
  return layerMap[objectType] || null;
}

// Load custom map from localStorage or provided data
function loadCustomMap(mapData) {
  // If mapData is provided directly (from map editor), use it
  if (mapData) {
    try {
      loadCustomMapData(mapData);
      console.log('Custom map loaded from provided data');
      return true;
    } catch (error) {
      console.error('Error loading provided map data:', error);
      return false;
    }
  }
  
  // Otherwise, load from localStorage
  const customMapData = localStorage.getItem('webscape_custom_map');
  if (customMapData) {
    try {
      const storageMapData = JSON.parse(customMapData);
      loadCustomMapData(storageMapData);
      console.log('Custom map loaded from localStorage');
      return true;
    } catch (error) {
      console.error('Error loading custom map from storage:', error);
      return false;
    }
  }
  return false; 
}

// Add event handlers to floor items
function addFloorItemEventHandlers(itemElement, floorItem) {
  // Add hover effect
  itemElement.addEventListener('mouseenter', () => {
    itemElement.style.transform = 'scale(1.2)';
    console.log('HOVER: Floor item hovered -', floorItem.item.id, floorItem.id);
  });
  
  itemElement.addEventListener('mouseleave', () => {
    itemElement.style.transform = 'scale(1)';
  });
  
  // Add both mouse and touch handlers for consistent behavior
  let lastInteraction = 0;
  const handlePickup = (e) => {
    // IMPORTANT: Only respond to left-clicks, not right-clicks
    if (e.type === 'mousedown' && e.button !== 0) {
      console.log('PICKUP: Non-left-click mousedown ignored, button:', e.button);
      return;
    }
    
    if (e.type === 'click' && e.button !== 0) {
      console.log('PICKUP: Non-left-click ignored, button:', e.button);
      return;
    }
    
    // Throttle rapid events (prevent multiple triggers within 100ms)
    const now = Date.now();
    if (now - lastInteraction < 100) {
      console.log('PICKUP: Throttled duplicate event', e.type);
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      return false;
    }
    lastInteraction = now;
    
    console.log('PICKUP: Floor item interaction triggered!', floorItem.id, 'Event type:', e.type, 'Button:', e.button);
    
    // STRONGEST possible event prevention - do this FIRST
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    
    // Also prevent default on the native event
    if (e.nativeEvent) {
      e.nativeEvent.preventDefault();
      e.nativeEvent.stopPropagation();
      e.nativeEvent.stopImmediatePropagation();
    }
    
    console.log('PICKUP: Event prevention applied');
    
    // Use OSRS-style walk-to-pickup for left-click
    console.log('PICKUP: Using OSRS-style walk-to-pickup logic');
    
    // Check if player is close enough for direct pickup
    const playerPos = window.worldModule.getPlayerPosition();
    if (playerPos) {
      const playerX = Math.floor(playerPos.x);
      const playerY = Math.floor(playerPos.y);
      const itemX = Math.floor(floorItem.x);
      const itemY = Math.floor(floorItem.y);
      const distance = Math.abs(playerX - itemX) + Math.abs(playerY - itemY);
      
      console.log(`PICKUP: Distance check - Player(${playerX}, ${playerY}) -> Item(${itemX}, ${itemY}), Distance: ${distance}`);
      
      if (distance > 1) {
        // Too far - walk to item first
        console.log('PICKUP: Too far away, walking to item first');
        window.pickupTarget = {
          itemId: floorItem.id,
          x: floorItem.x,
          y: floorItem.y
        };
        movePlayerToTarget(floorItem.x, floorItem.y);
      } else {
        // Close enough - pick up directly
        console.log('PICKUP: Close enough, picking up directly');
        if (window.inventoryModule && window.inventoryModule.pickupFloorItem) {
          window.inventoryModule.pickupFloorItem(floorItem.id);
        } else {
          console.error('PICKUP ERROR: inventoryModule.pickupFloorItem not available');
        }
      }
    } else {
      // Fallback to direct pickup if position check fails
      console.log('PICKUP: Position check failed, trying direct pickup');
      if (window.inventoryModule && window.inventoryModule.pickupFloorItem) {
        window.inventoryModule.pickupFloorItem(floorItem.id);
      } else {
        console.error('PICKUP ERROR: inventoryModule.pickupFloorItem not available');
      }
    }
    
    console.log('PICKUP: Handler completed');
    return false; // Extra prevention
  };
  
  // Add multiple event listeners for cross-platform compatibility
  itemElement.addEventListener('click', handlePickup, true);
  itemElement.addEventListener('mousedown', handlePickup, true);
  itemElement.addEventListener('touchstart', handlePickup, true);
  itemElement.addEventListener('touchend', handlePickup, true);
  
  // Add right-click context menu for floor items
  itemElement.addEventListener('contextmenu', (e) => {
    console.log('RIGHT-CLICK: Floor item right-clicked!', floorItem.id);
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    
    // ONLY show context menu - no other actions
    console.log('RIGHT-CLICK: Showing context menu for all items at position');
    // Pass the position coordinates so we can show all items at this location
    const worldX = parseInt(itemElement.dataset.worldX);
    const worldY = parseInt(itemElement.dataset.worldY);
    showFloorItemContextMenu(e, worldX, worldY);
    
    return false;
  });
}

// Add event handlers to bank objects
function addBankEventHandlers(element, worldX, worldY) {
  let lastBankInteraction = 0;
  
  const handleBankInteraction = (e) => {
    // Only respond to left-clicks
    if (e.type === 'mousedown' && e.button !== 0) {
      console.log('BANK: Non-left-click mousedown ignored, button:', e.button);
      return;
    }
    
    if (e.type === 'click' && e.button !== 0) {
      console.log('BANK: Non-left-click ignored, button:', e.button);
      return;
    }
    
    // Throttle rapid events (prevent multiple triggers within 100ms)
    const now = Date.now();
    if (now - lastBankInteraction < 100) {
      console.log('BANK: Throttled duplicate event', e.type);
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      return false;
    }
    lastBankInteraction = now;
    
    console.log('BANK: Direct click handler triggered, event type:', e.type);
    
    // Strongest possible event prevention
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    
    // Also prevent default on the native event
    if (e.nativeEvent) {
      e.nativeEvent.preventDefault();
      e.nativeEvent.stopPropagation();
      e.nativeEvent.stopImmediatePropagation();
    }
    
    handleBankClick(worldX, worldY);
    return false;
  };
  
  // Add multiple event listeners for cross-platform compatibility
  element.addEventListener('click', handleBankInteraction, true);
  element.addEventListener('mousedown', handleBankInteraction, true);
  element.addEventListener('touchstart', handleBankInteraction, true);
  element.addEventListener('touchend', handleBankInteraction, true);
}

// Add event handlers to shop objects
function addShopEventHandlers(element, shopType, x, y) {
  element.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log(`Shop clicked: ${shopType} at (${x}, ${y})`);
    handleShopClick(shopType, x, y);
  });
}

// Add event handlers to ore objects
function addOreEventHandlers(element, oreType, x, y) {
  element.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log(`ORE ELEMENT: ${oreType} clicked at (${x}, ${y})`);
    handleOreClick(oreType, x, y, element);
  });
}

// Add event handlers for tree objects
function addTreeEventHandlers(element, treeType, x, y) {
  element.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log(`TREE ELEMENT: ${treeType} clicked at (${x}, ${y})`);
    handleTreeClick(treeType, x, y, element);
  });
}

// Add event handlers for pulp basin objects
function addPulpBasinEventHandlers(element, basinType, x, y) {
  element.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log(`PULP BASIN ELEMENT: ${basinType} clicked at (${x}, ${y})`);
    handlePulpBasinClick(basinType, x, y, element);
  });
}

// Add event handlers for fishing spot objects
function addFishingSpotEventHandlers(element, fishingSpotType, x, y) {
  element.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log(`FISHING SPOT ELEMENT: ${fishingSpotType} clicked at (${x}, ${y})`);
    handleFishingSpotClick(fishingSpotType, x, y, element);
  });
  
  // Add swirl animation to fishing spots
  if (window.fishingModule && window.fishingModule.addFishingSpotAnimation) {
    window.fishingModule.addFishingSpotAnimation(element);
  } else {
    // Fallback animation if fishing module not loaded yet
    element.classList.add('fishing-spot-swirl');
  }
}

// Force re-render of the world viewport (for when items change without camera movement)
function forceWorldRerender() {
  const worldElement = document.getElementById('game-world');
  if (worldElement) {
    console.log('Forcing world re-render due to item changes');
    // Clear the render cache to force recreation of all elements
    renderedElements.clear();
    // Also clear all existing elements to prevent duplicates
    clearAllWorldElements(worldElement);
    renderViewport(worldElement);
  }
}

// Show shop context menu
function showShopContextMenu(event, shopType, shopX, shopY) {
  // Remove any existing context menu
  hideFloorItemContextMenu();
  
  console.log(`SHOP CONTEXT MENU: Showing menu for ${shopType} at (${shopX}, ${shopY})`);
  
  // Get shop display name and icon
  const shopInfo = {
    'shop_general': { name: 'General Store', icon: '🏪' },
    'shop_weapon': { name: 'Weapon Shop', icon: '⚔️' },
    'shop_magic': { name: 'Magic Shop', icon: '🔮' },
    'shop_mining': { name: 'Mining Shop', icon: '⛏️' },
    'shop_fletching': { name: 'Fletching Shop', icon: '🏹' },
    'shop_fishing': { name: 'Fishing Shop', icon: '🎣' }
  };
  
  const shop = shopInfo[shopType] || { name: 'Shop', icon: '🏪' };
  
  const contextMenu = document.createElement('div');
  contextMenu.id = 'shop-context-menu';
  contextMenu.className = 'shop-context-menu';
  contextMenu.style.position = 'fixed';
  contextMenu.style.backgroundColor = '#2a2a2a';
  contextMenu.style.border = '1px solid #555';
  contextMenu.style.borderRadius = '5px';
  contextMenu.style.padding = '5px 0';
  contextMenu.style.zIndex = '2000';
  contextMenu.style.minWidth = '120px';
  contextMenu.style.boxShadow = '0 2px 10px rgba(0,0,0,0.5)';
  
  // Add "Walk here" option
  const walkHereOption = document.createElement('div');
  walkHereOption.className = 'context-menu-item';
  walkHereOption.innerHTML = `<span style="color: #FF9800;">⚬</span> Walk here`;
  walkHereOption.style.padding = '8px 15px';
  walkHereOption.style.cursor = 'pointer';
  walkHereOption.style.color = '#ccc';
  walkHereOption.style.transition = 'background-color 0.2s';
  walkHereOption.style.fontSize = '13px';
  
  walkHereOption.addEventListener('mouseenter', () => {
    walkHereOption.style.backgroundColor = '#3a3a3a';
  });
  
  walkHereOption.addEventListener('mouseleave', () => {
    walkHereOption.style.backgroundColor = 'transparent';
  });
  
  walkHereOption.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log(`SHOP CONTEXT MENU: Walk here clicked for position (${shopX}, ${shopY})`);
    
    // Show click animation at the target location
    const worldElement = document.getElementById('game-world');
    if (worldElement) {
      showClickAnimation(worldElement, shopX, shopY);
    }
    
    // Move player to this location
    movePlayerToTarget(shopX, shopY);
    
    hideFloorItemContextMenu();
  });
  
  // Add shop option
  const shopOption = document.createElement('div');
  shopOption.className = 'context-menu-item';
  shopOption.innerHTML = `<span style="color: #4CAF50;">${shop.icon}</span> ${shop.name}`;
  shopOption.style.padding = '8px 15px';
  shopOption.style.cursor = 'pointer';
  shopOption.style.color = '#ccc';
  shopOption.style.transition = 'background-color 0.2s';
  shopOption.style.fontSize = '13px';
  
  shopOption.addEventListener('mouseenter', () => {
    shopOption.style.backgroundColor = '#3a3a3a';
  });
  
  shopOption.addEventListener('mouseleave', () => {
    shopOption.style.backgroundColor = 'transparent';
  });
  
  shopOption.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log(`SHOP CONTEXT MENU: ${shop.name} clicked for position (${shopX}, ${shopY})`);
    
    // Use the existing handleShopClick function
    handleShopClick(shopType, shopX, shopY);
    
    hideFloorItemContextMenu();
  });
  
  contextMenu.appendChild(walkHereOption);
  contextMenu.appendChild(shopOption);
  
  // Position the menu
  contextMenu.style.left = `${event.pageX}px`;
  contextMenu.style.top = `${event.pageY}px`;
  
  document.body.appendChild(contextMenu);
  
  // Store position reference for cleanup
  contextMenu.worldX = shopX;
  contextMenu.worldY = shopY;
}

// Force regenerate default world (for testing)
function regenerateDefaultWorld() {
  console.log('Regenerating default world with shops...');
  
  // Clear any existing custom map
  localStorage.removeItem('webscape_custom_map');
  
  // Reset cleanup flag for fresh world
  initialCleanupDone = false;
  
  // Initialize fresh layers
  initializeLayers();
  
  // Generate default world with shops
  generateDefaultWorld();
  
  // Force re-render the world
  forceWorldRerender();
  
  console.log('Default world regenerated! Check around spawn for shops.');
  return 'Default world regenerated with shops! Look for 🏪⚔️🔮⛏️🏛️ around spawn.';
}

// Reload custom map with fixed shop object layer mapping (for fixing existing maps)
function reloadCustomMapWithShops() {
  console.log('Reloading custom map with fixed shop object layer mapping...');
  
  const customMap = localStorage.getItem('webscape_custom_map');
  if (!customMap) {
    console.log('No custom map found to reload');
    return 'No custom map found to reload';
  }
  
  try {
    const mapData = JSON.parse(customMap);
    console.log('Reloading custom map data:', mapData);
    
    // Reset cleanup flag for fresh world
    initialCleanupDone = false;
    
    // Initialize fresh layers
    initializeLayers();
    
    // Load the custom map data with the fixed layer mapping
    loadCustomMapData(mapData);
    
    // Force re-render the world
    forceWorldRerender();
    
    console.log('Custom map reloaded with fixed shop objects!');
    return 'Custom map reloaded! Shop objects should now be visible.';
  } catch (error) {
    console.error('Error reloading custom map:', error);
    return 'Error reloading custom map: ' + error.message;
  }
}

// Debug function to help troubleshoot shop objects
function debugShopObjects() {
  console.log('=== SHOP OBJECTS DEBUG ===');
  
  // Check what's in localStorage
  const customMap = localStorage.getItem('webscape_custom_map');
  if (customMap) {
    const mapData = JSON.parse(customMap);
    console.log('Custom map found in localStorage:');
    console.log('- Objects:', mapData.objects?.length || 0);
    console.log('- Shop objects:', mapData.objects?.filter(obj => obj.type?.startsWith('shop_')));
    console.log('- All objects:', mapData.objects);
  } else {
    console.log('No custom map in localStorage');
  }
  
  // Check what's currently in world layers
  console.log('Current world layers:');
  console.log('- Interactive objects layer has data:', !!worldLayers[LAYERS.INTERACTIVE_OBJECTS]);
  
  if (worldLayers[LAYERS.INTERACTIVE_OBJECTS]) {
    let shopCount = 0;
    let objectCount = 0;
    for (let y = 0; y < WORLD_ROWS; y++) {
      for (let x = 0; x < WORLD_COLS; x++) {
        const obj = getTileOnLayer(LAYERS.INTERACTIVE_OBJECTS, x, y, currentMapLevel);
        if (obj !== null && obj !== undefined) {
          objectCount++;
          if (obj.startsWith && obj.startsWith('shop_')) {
            shopCount++;
            console.log(`Shop found: ${obj} at (${x}, ${y})`);
          }
        }
      }
    }
    console.log(`Total objects in interactive layer: ${objectCount}`);
    console.log(`Total shops in interactive layer: ${shopCount}`);
  }
  
  // Check if world module functions work
  console.log('World module availability:');
  console.log('- loadCustomMap function:', !!window.worldModule?.loadCustomMap);
  console.log('- forceWorldRerender function:', !!window.worldModule?.forceWorldRerender);
  
  return 'Debug complete - check console for details';
}

// Check if any shops are open and auto-close them if player is too far away
let lastShopAutoCloseCheck = 0;
function checkShopAutoClose() {
  // Throttle the check to once per second for performance
  const now = Date.now();
  if (now - lastShopAutoCloseCheck < 1000) {
    return;
  }
  lastShopAutoCloseCheck = now;
  
  // Check if inventory module is available and has an open shop
  if (!window.inventoryModule || !window.inventoryModule.activeShops) {
    return; // No shop system available
  }
  
  // Check if any shop is currently open by looking for shop overlay
  const shopOverlay = document.getElementById('shop-overlay');
  if (!shopOverlay || shopOverlay.style.display === 'none') {
    return; // No shop is open
  }
  
  console.log('SHOP AUTO-CLOSE: Shop is open, checking distance...');
  
  // Since we don't have direct access to which specific shop is open,
  // we'll check distance to all shop objects and close if far from any shop
  let closestShopDistance = Infinity;
  
  for (let y = 0; y < WORLD_ROWS; y++) {
    for (let x = 0; x < WORLD_COLS; x++) {
      const objectType = getTileOnLayer(LAYERS.INTERACTIVE_OBJECTS, x, y, currentMapLevel);
      if (objectType && objectType.startsWith('shop_')) {
        const distance = Math.abs(playerPosition.x - x) + Math.abs(playerPosition.y - y);
        if (distance < closestShopDistance) {
          closestShopDistance = distance;
        }
      }
    }
  }
  
  console.log(`SHOP AUTO-CLOSE: Closest shop distance:`, closestShopDistance);
  
  // If player is too far from any shop, close the shop
  const AUTO_CLOSE_DISTANCE = 5; // tiles
  if (closestShopDistance > AUTO_CLOSE_DISTANCE) {
    console.log('SHOP AUTO-CLOSE: Player too far from shop, auto-closing');
    window.inventoryModule.closeShop();
    
    // Show a notification to the player
    if (window.uiModule && window.uiModule.showNotification) {
      window.uiModule.showNotification('You have moved too far from the shop.', 'info');
    }
  }
}

// Handle ore click for mining
function handleOreClick(oreType, oreX, oreY, oreElement) {
  console.log(`ORE: ${oreType} clicked at (${oreX}, ${oreY})`);
  
  // Check if player is close enough to mine the ore
  const playerPos = getPlayerPosition();
  if (!playerPos) {
    console.error('ORE: Could not get player position');
    return;
  }
  
  const playerX = Math.floor(playerPos.x);
  const playerY = Math.floor(playerPos.y);
  const distance = Math.max(Math.abs(playerX - oreX), Math.abs(playerY - oreY)); // Use Chebyshev distance
  
  console.log(`ORE: Distance check - Player(${playerX}, ${playerY}) -> Ore(${oreX}, ${oreY}), Distance: ${distance}`);
  
  if (distance > 1) {
    // Too far - use enhanced pathfinding that stops at adjacent tiles
    console.log('ORE: Too far away, using enhanced pathfinding');
    window.interactionTarget = { 
      type: 'mining',
      oreType: oreType,
      x: oreX, 
      y: oreY,
      element: oreElement
    };
    movePlayerToInteractiveTarget(oreX, oreY);
  } else {
    // Close enough - start mining
    console.log('ORE: Close enough, starting mining');
    if (window.miningModule && window.miningModule.startMining) {
      window.miningModule.startMining(oreType, oreX, oreY, oreElement);
    } else {
      console.error('ORE: miningModule.startMining not available');
    }
  }
}

// Move player to an interactive target (ore, bank, shop, etc.) - stops at adjacent tiles
function movePlayerToInteractiveTarget(targetX, targetY) {
  console.log(`movePlayerToInteractiveTarget called: target=(${targetX}, ${targetY}), player=(${playerPosition.x.toFixed(2)}, ${playerPosition.y.toFixed(2)}), isMoving=${isMoving}`);
  
  // Find path using enhanced pathfinding that allows adjacent targets
  const path = findPath(playerPosition.x, playerPosition.y, targetX, targetY, true);
  
  console.log(`Interactive path found with ${path.length} checkpoints:`, path);
  
  if (path.length > 0) {
    // Clear any existing movement and start new path immediately
    movementQueue = path;
    isMoving = true;
    console.log('Interactive movement started with new path');
  } else {
    // If no path found, try fallback (though this should be rare with adjacent targeting)
    const fallbackPath = findNearestWalkablePath(playerPosition.x, playerPosition.y, targetX, targetY);
    console.log(`Fallback path found with ${fallbackPath.length} checkpoints:`, fallbackPath);
    
    if (fallbackPath.length > 0) {
      movementQueue = fallbackPath;
      isMoving = true;
      console.log('Interactive movement started with fallback path');
    } else {
      console.log('No path found to interactive target');
    }
  }
}

// Check if player has moved too far from ore while mining
function checkMiningDistance() {
  // Check if mining module is available and player is mining
  if (!window.miningModule || !window.miningModule.isMining || !window.miningModule.cancelMining) {
    return;
  }
  
  // Check if player is currently mining
  if (!window.miningModule.isMining()) {
    return;
  }
  
  // Get current active mining session to check ore location
  if (!window.activeMining || !window.activeMining.get) {
    return;
  }
  
  const miningSession = window.activeMining.get('player');
  if (!miningSession) {
    return;
  }
  
  // Calculate distance from player to ore
  const playerX = Math.floor(playerPosition.x);
  const playerY = Math.floor(playerPosition.y);
  const oreX = miningSession.x;
  const oreY = miningSession.y;
  
  // Use Chebyshev distance (OSRS-style)
  const dx = Math.abs(playerX - oreX);
  const dy = Math.abs(playerY - oreY);
  const distance = Math.max(dx, dy);
  
  // Cancel mining if player has moved more than 1 tile away
  if (distance > 1) {
    console.log(`Mining: Player moved too far (distance: ${distance}), cancelling mining`);
    window.miningModule.cancelMining();
  }
}

// Check if player has moved too far from tree while woodcutting
function checkWoodcuttingDistance() {
  // Check if player is currently woodcutting
  if (!window.activeWoodcutting || !window.activeWoodcutting.get) {
    return;
  }
  
  const woodcuttingSession = window.activeWoodcutting.get('player');
  if (!woodcuttingSession) {
    return;
  }
  
  // Calculate distance from player to tree
  const playerX = Math.floor(playerPosition.x);
  const playerY = Math.floor(playerPosition.y);
  const treeX = woodcuttingSession.x;
  const treeY = woodcuttingSession.y;
  
  // Use Chebyshev distance (OSRS-style)
  const dx = Math.abs(playerX - treeX);
  const dy = Math.abs(playerY - treeY);
  const distance = Math.max(dx, dy);
  
  // Cancel woodcutting if player has moved more than 1 tile away
  if (distance > 1) {
    console.log(`Woodcutting: Player moved too far (distance: ${distance}), cancelling woodcutting`);
    if (window.woodcuttingModule && window.woodcuttingModule.cancelWoodcutting) {
      window.woodcuttingModule.cancelWoodcutting();
    }
  }
}

// Check if player is scribing and has moved too far from the basin
function checkScribingDistance() {
  // Check if player is currently scribing
  if (!window.activeScribing || !window.activeScribing.get) {
    return;
  }
  
  const scribingSession = window.activeScribing.get('player');
  if (!scribingSession) {
    return;
  }
  
  // Calculate distance from player to basin
  const playerX = Math.floor(playerPosition.x);
  const playerY = Math.floor(playerPosition.y);
  const basinX = scribingSession.x;
  const basinY = scribingSession.y;
  
  // Use Chebyshev distance (OSRS-style)
  const dx = Math.abs(playerX - basinX);
  const dy = Math.abs(playerY - basinY);
  const distance = Math.max(dx, dy);
  
  // Cancel scribing if player has moved more than 1 tile away
  if (distance > 1) {
    console.log(`Scribing: Player moved too far (distance: ${distance}), cancelling scribing`);
    if (window.scribingModule && window.scribingModule.cancelScribing) {
      window.scribingModule.cancelScribing();
    }
  }
}

// Check fishing distance and cancel if too far
function checkFishingDistance() {
  // Check if player is currently fishing
  if (!window.activeFishing || !window.activeFishing.get) {
    return;
  }
  
  const fishingSession = window.activeFishing.get('player');
  if (!fishingSession) {
    return;
  }
  
  // Calculate distance from player to fishing spot
  const playerX = Math.floor(playerPosition.x);
  const playerY = Math.floor(playerPosition.y);
  const fishingSpotX = fishingSession.x;
  const fishingSpotY = fishingSession.y;
  
  // Use Chebyshev distance (OSRS-style)
  const dx = Math.abs(playerX - fishingSpotX);
  const dy = Math.abs(playerY - fishingSpotY);
  const distance = Math.max(dx, dy);
  
  // Cancel fishing if player has moved more than 1 tile away
  if (distance > 1) {
    console.log(`Fishing: Player moved too far (distance: ${distance}), cancelling fishing`);
    if (window.cancelFishing) {
      window.cancelFishing();
    }
  }
}

// Check harvesting distance and cancel if too far
function checkHarvestingDistance() {
  // Check if player is currently harvesting
  if (!window.activeHarvesting || !window.activeHarvesting.get) {
    return;
  }
  
  const harvestingSession = window.activeHarvesting.get('player');
  if (!harvestingSession) {
    return;
  }
  
  // Calculate distance from player to harvesting node
  const playerX = Math.floor(playerPosition.x);
  const playerY = Math.floor(playerPosition.y);
  const nodeX = harvestingSession.x;
  const nodeY = harvestingSession.y;
  
  // Use Chebyshev distance (OSRS-style)
  const dx = Math.abs(playerX - nodeX);
  const dy = Math.abs(playerY - nodeY);
  const distance = Math.max(dx, dy);
  
  // Cancel harvesting if player has moved more than 1 tile away
  if (distance > 1) {
    console.log(`Harvesting: Player moved too far (distance: ${distance}), cancelling harvesting`);
    if (window.cancelHarvesting) {
      window.cancelHarvesting();
    }
  }
}

// Check digging distance and cancel if too far
function checkDiggingDistance() {
  // Check if player is currently digging
  if (!window.diggingModule || !window.diggingModule.isDigging) {
    return;
  }
  
  // Check if player is actually digging
  if (!window.diggingModule.isDigging()) {
    return;
  }
  
  // Get current active digging session to check dig location
  const diggingSession = window.diggingModule.getActiveDiggingSession && window.diggingModule.getActiveDiggingSession('player');
  if (!diggingSession) {
    return;
  }
  
  // Calculate distance from player to dig spot
  const playerX = Math.floor(playerPosition.x);
  const playerY = Math.floor(playerPosition.y);
  const digX = diggingSession.x;
  const digY = diggingSession.y;
  
  // Use Chebyshev distance (OSRS-style)
  const dx = Math.abs(playerX - digX);
  const dy = Math.abs(playerY - digY);
  const distance = Math.max(dx, dy);
  
  // Cancel digging if player has moved more than 1 tile away
  if (distance > 1) {
    console.log(`Digging: Player moved too far (distance: ${distance}), cancelling digging`);
    if (window.diggingModule.cancelDigging) {
      window.diggingModule.cancelDigging();
    }
  }
}

// Handle tree click for woodcutting
function handleTreeClick(treeType, treeX, treeY, treeElement) {
  console.log(`TREE: ${treeType} clicked at (${treeX}, ${treeY})`);
  
  // Find the tree element from the DOM if not provided
  if (!treeElement) {
    treeElement = document.querySelector(`.world-object[data-type="${treeType}"][data-x="${treeX}"][data-y="${treeY}"]`);
  }
  
  // Check if player is close enough to chop the tree
  const playerPos = getPlayerPosition();
  if (!playerPos) {
    console.error('TREE: Could not get player position');
    return;
  }
  
  const playerX = Math.floor(playerPos.x);
  const playerY = Math.floor(playerPos.y);
  const distance = Math.max(Math.abs(playerX - treeX), Math.abs(playerY - treeY)); // Use Chebyshev distance
  
  console.log(`TREE: Distance check - Player(${playerX}, ${playerY}) -> Tree(${treeX}, ${treeY}), Distance: ${distance}`);
  
  if (distance > 1) {
    // Too far - use enhanced pathfinding that stops at adjacent tiles
    console.log('TREE: Too far away, using enhanced pathfinding');
    window.interactionTarget = { 
      type: 'woodcutting',
      treeType: treeType,
      x: treeX, 
      y: treeY,
      element: treeElement
    };
    movePlayerToInteractiveTarget(treeX, treeY);
  } else {
    // Close enough - start woodcutting
    console.log('TREE: Close enough, starting woodcutting');
    if (window.woodcuttingModule && window.woodcuttingModule.startWoodcutting) {
      window.woodcuttingModule.startWoodcutting(treeType, treeX, treeY, treeElement);
    } else {
      console.error('TREE: woodcuttingModule.startWoodcutting not available');
    }
  }
}

// Start the periodic world update (once per second)
function startPeriodicWorldUpdate() {
  if (periodicUpdateInterval) {
    clearInterval(periodicUpdateInterval);
  }
  
  periodicUpdateInterval = setInterval(() => {
    // Gentle world refresh to fix any desync issues
    const worldElement = document.querySelector('.world-content');
    if (worldElement) {
      // Only update if the world has been rendered before
      if (worldElement.children.length > 0) {
        console.log('World: Periodic update - refreshing world state');
        renderViewport(worldElement);
      }
    }
  }, 1000); // Every second
  
  console.log('World: Started periodic world updates (1s interval)');
}

// Stop the periodic world update
function stopPeriodicWorldUpdate() {
  if (periodicUpdateInterval) {
    clearInterval(periodicUpdateInterval);
    periodicUpdateInterval = null;
    console.log('World: Stopped periodic world updates');
  }
}

// Helper function to update element position based on camera offset
function updateElementPosition(element, cameraOffsetX, cameraOffsetY) {
  // For floor items, use world coordinates instead of view coordinates
  if (element.classList.contains('floor-item')) {
    const worldX = parseInt(element.dataset.worldX);
    const worldY = parseInt(element.dataset.worldY);
    
    if (!isNaN(worldX) && !isNaN(worldY)) {
      // Calculate position relative to camera using smooth floating-point position
      const viewX = worldX - cameraPosition.x;
      const viewY = worldY - cameraPosition.y;
      
      const screenX = viewX * GRID_SIZE;
      const screenY = viewY * GRID_SIZE;
      element.style.left = `${screenX}px`;
      element.style.top = `${screenY}px`;
    }
  } else {
    // For other elements, use the existing viewX/viewY system
    const viewX = parseInt(element.dataset.viewX);
    const viewY = parseInt(element.dataset.viewY);
    
    if (!isNaN(viewX) && !isNaN(viewY)) {
      const screenX = (viewX - cameraOffsetX) * GRID_SIZE;
      const screenY = (viewY - cameraOffsetY) * GRID_SIZE;
      element.style.left = `${screenX}px`;
      element.style.top = `${screenY}px`;
    }
  }
}

// Make updateElementPosition available globally for online players
window.updateElementPosition = updateElementPosition;

// Handle tree click - delegate to woodcutting module
function handlePulpBasinClick(basinType, basinX, basinY, basinElement) {
  console.log(`PULP BASIN CLICK: ${basinType} at (${basinX}, ${basinY})`);
  
  // Get player position and check distance
  const playerPos = getPlayerPosition();
  if (!playerPos) {
    console.error('PULP BASIN CLICK: Could not get player position');
    return;
  }
  
  const playerX = Math.floor(playerPos.x);
  const playerY = Math.floor(playerPos.y);
  
  // Use Chebyshev distance (OSRS-style) - allows diagonal interactions
  const dx = Math.abs(playerX - basinX);
  const dy = Math.abs(playerY - basinY);
  const distance = Math.max(dx, dy);
  console.log(`PULP BASIN CLICK: Distance to basin (Chebyshev): ${distance}`);
  
  if (distance > 1) {
    // Too far - move closer
    console.log('PULP BASIN CLICK: Too far from basin, moving closer');
    
    // Store basin target for interaction after movement
    window.scribingTarget = {
      basinType: basinType,
      x: basinX,
      y: basinY,
      element: basinElement
    };
    
    // Set a general interaction target for the world movement handler
    window.interactionTarget = {
      type: 'scribing',
      basinType: basinType,
      x: basinX,
      y: basinY,
      element: basinElement
    };
    
    // Use pathfinding to get adjacent to the basin
    movePlayerToInteractiveTarget(basinX, basinY);
    return;
  }
  
  // Close enough - open scribing interface directly
  if (window.scribingModule && window.scribingModule.handlePulpBasinClick) {
    window.scribingModule.handlePulpBasinClick(basinType, basinX, basinY, basinElement);
  } else {
    console.error('PULP BASIN CLICK: Scribing module not available');
  }
}



// Handle scribing table click - delegate to scribing module
function handleScribingTableClick(tableType, tableX, tableY, tableElement) {
  console.log(`SCRIBING TABLE CLICK: ${tableType} at (${tableX}, ${tableY})`);
  
  // Get player position and check distance
  const playerPos = getPlayerPosition();
  if (!playerPos) {
    console.error('SCRIBING TABLE CLICK: Could not get player position');
    return;
  }
  
  const playerX = Math.floor(playerPos.x);
  const playerY = Math.floor(playerPos.y);
  
  // Use Chebyshev distance (OSRS-style) - allows diagonal interactions
  const dx = Math.abs(playerX - tableX);
  const dy = Math.abs(playerY - tableY);
  const distance = Math.max(dx, dy);
  console.log(`SCRIBING TABLE CLICK: Distance to table (Chebyshev): ${distance}`);
  
  if (distance > 1) {
    // Too far - move closer
    console.log('SCRIBING TABLE CLICK: Too far from table, moving closer');
    
    // Store table target for interaction after movement
    window.scribingTableTarget = {
      tableType: tableType,
      x: tableX,
      y: tableY,
      element: tableElement
    };
    
    // Set a general interaction target for the world movement handler
    window.interactionTarget = {
      type: 'scribing_table',
      tableType: tableType,
      x: tableX,
      y: tableY,
      element: tableElement
    };
    
    // Use pathfinding to get adjacent to the table
    movePlayerToInteractiveTarget(tableX, tableY);
    return;
  }
  
  // Close enough - open scribing table interface directly
  if (window.scribingModule && window.scribingModule.handleScribingTableClick) {
    window.scribingModule.handleScribingTableClick(tableType, tableX, tableY, tableElement);
  } else {
    console.error('SCRIBING TABLE CLICK: Scribing module not available');
  }
}

// Handle fishing spot click - delegate to fishing module
function handleFishingSpotClick(fishingSpotType, fishingSpotX, fishingSpotY, fishingSpotElement) {
  console.log(`FISHING SPOT CLICK: ${fishingSpotType} at (${fishingSpotX}, ${fishingSpotY})`);
  
  // Get player position and check distance
  const playerPos = getPlayerPosition();
  if (!playerPos) {
    console.error('FISHING SPOT CLICK: Could not get player position');
    return;
  }
  
  const playerX = Math.floor(playerPos.x);
  const playerY = Math.floor(playerPos.y);
  
  // Use Chebyshev distance (OSRS-style) - allows diagonal interactions
  const dx = Math.abs(playerX - fishingSpotX);
  const dy = Math.abs(playerY - fishingSpotY);
  const distance = Math.max(dx, dy);
  console.log(`FISHING SPOT CLICK: Distance to fishing spot (Chebyshev): ${distance}`);
  
  if (distance > 1) {
    // Too far - move closer
    console.log('FISHING SPOT CLICK: Too far from fishing spot, moving closer');
    
    // Store fishing spot target for interaction after movement
    window.fishingTarget = {
      fishingSpotType: fishingSpotType,
      x: fishingSpotX,
      y: fishingSpotY,
      element: fishingSpotElement
    };
    
    // Set a general interaction target for the world movement handler
    window.interactionTarget = {
      type: 'fishing',
      fishingSpotType: fishingSpotType,
      x: fishingSpotX,
      y: fishingSpotY,
      element: fishingSpotElement
    };
    
    // Use pathfinding to get adjacent to the fishing spot
    movePlayerToInteractiveTarget(fishingSpotX, fishingSpotY);
    return;
  }
  
  // Close enough - start fishing directly
  if (window.startFishing) {
    window.startFishing(fishingSpotType, fishingSpotX, fishingSpotY, fishingSpotElement);
  } else {
    console.error('FISHING SPOT CLICK: Fishing module not available');
  }
}

// Handle cooking range click - delegate to cooking module
function handleCookingRangeClick(rangeType, rangeX, rangeY, rangeElement) {
  console.log(`COOKING RANGE CLICK: ${rangeType} at (${rangeX}, ${rangeY})`);
  
  // Get player position and check distance
  const playerPos = getPlayerPosition();
  if (!playerPos) {
    console.error('COOKING RANGE CLICK: Could not get player position');
    return;
  }
  
  const playerX = Math.floor(playerPos.x);
  const playerY = Math.floor(playerPos.y);
  
  // Use Chebyshev distance (OSRS-style) - allows diagonal interactions
  const dx = Math.abs(playerX - rangeX);
  const dy = Math.abs(playerY - rangeY);
  const distance = Math.max(dx, dy);
  console.log(`COOKING RANGE CLICK: Distance to range (Chebyshev): ${distance}`);
  
  if (distance > 1) {
    // Too far - move closer
    console.log('COOKING RANGE CLICK: Too far from range, moving closer');
    
    // Store range target for interaction after movement
    window.cookingTarget = {
      rangeType: rangeType,
      x: rangeX,
      y: rangeY,
      element: rangeElement
    };
    
    // Set a general interaction target for the world movement handler
    window.interactionTarget = {
      type: 'cooking',
      rangeType: rangeType,
      x: rangeX,
      y: rangeY,
      element: rangeElement
    };
    
    // Use pathfinding to get adjacent to the range
    movePlayerToInteractiveTarget(rangeX, rangeY);
    return;
  }
  
  // Close enough - open cooking interface directly
  if (window.cookingModule && window.cookingModule.showCookingInterface) {
    window.cookingModule.showCookingInterface(rangeType, rangeX, rangeY, rangeElement);
  } else {
    console.error('COOKING RANGE CLICK: Cooking module or showCookingInterface not available');
  }
}

// Handle harvesting node click - delegate to harvesting module
function handleHarvestingNodeClick(nodeType, nodeX, nodeY, nodeElement) {
  console.log(`HARVESTING NODE CLICK: ${nodeType} at (${nodeX}, ${nodeY})`);
  
  // Get player position and check distance
  const playerPos = getPlayerPosition();
  if (!playerPos) {
    console.error('HARVESTING NODE CLICK: Could not get player position');
    return;
  }
  
  const playerX = Math.floor(playerPos.x);
  const playerY = Math.floor(playerPos.y);
  
  // Use Chebyshev distance (OSRS-style) - allows diagonal interactions
  const dx = Math.abs(playerX - nodeX);
  const dy = Math.abs(playerY - nodeY);
  const distance = Math.max(dx, dy);
  console.log(`HARVESTING NODE CLICK: Distance to node (Chebyshev): ${distance}`);
  
  if (distance > 1) {
    // Too far - move closer
    console.log('HARVESTING NODE CLICK: Too far from node, moving closer');
    
    // Store node target for interaction after movement
    window.harvestingTarget = {
      nodeType: nodeType,
      x: nodeX,
      y: nodeY,
      element: nodeElement
    };
    
    // Set a general interaction target for the world movement handler
    window.interactionTarget = {
      type: 'harvesting',
      nodeType: nodeType,
      x: nodeX,
      y: nodeY,
      element: nodeElement
    };
    
    // Use pathfinding to get adjacent to the node
    movePlayerToInteractiveTarget(nodeX, nodeY);
    return;
  }
  
  // Close enough - start harvesting directly
  if (window.startHarvesting) {
    window.startHarvesting(nodeType, nodeX, nodeY, nodeElement);
  } else {
    console.error('HARVESTING NODE CLICK: Harvesting module not available');
  }
}

// Add event handlers to scribing table objects
function addScribingTableEventHandlers(element, tableType, x, y) {
  element.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log(`Scribing table clicked: ${tableType} at (${x}, ${y})`);
    handleScribingTableClick(tableType, x, y, element);
  });
}

// Add event handlers to cooking range objects
function addCookingRangeEventHandlers(element, rangeType, x, y) {
  element.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log(`Cooking range clicked: ${rangeType} at (${x}, ${y})`);
    handleCookingRangeClick(rangeType, x, y, element);
  });
}

// Add event handlers to harvesting node objects
function addHarvestingNodeEventHandlers(element, nodeType, x, y) {
  element.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log(`Harvesting node clicked: ${nodeType} at (${x}, ${y})`);
    handleHarvestingNodeClick(nodeType, x, y, element);
  });
}

// Add ladder event handlers
function addLadderEventHandlers(element, ladderType, x, y) {
  element.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log(`Ladder clicked: ${ladderType} at (${x}, ${y})`);
    handleLadderClick(ladderType, x, y, element);
  });
}

// Add dig site event handlers
function addDigSiteEventHandlers(element, siteType, x, y) {
  element.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleDigSiteClick(siteType, x, y, element);
  });
}

// Handle dig site clicks
function handleDigSiteClick(siteType, x, y, element) {
  console.log(`Clicked on ${siteType} at (${x}, ${y})`);
  
  // Check if archaeology module is available
  if (window.archaeologyModule && window.archaeologyModule.handleDigSiteClick) {
    window.archaeologyModule.handleDigSiteClick(siteType, x, y, element);
  } else {
    console.error('Archaeology module not available');
    if (window.showNotification) {
      window.showNotification('Archaeology system not loaded', 'error');
    }
  }
}

// Handle ladder interaction and map level transitions
function handleLadderClick(ladderType, ladderX, ladderY, ladderElement) {
  console.log(`Ladder clicked: ${ladderType} at (${ladderX}, ${ladderY})`);
  
  // Check if player is close enough
  const playerPos = getPlayerPosition();
  const distance = Math.max(Math.abs(playerPos.x - ladderX), Math.abs(playerPos.y - ladderY));
  
  if (distance > 1) {
    // Move player to the ladder first
    movePlayerToInteractiveTarget(ladderX, ladderY);
    return;
  }
  
  // Player is close enough, proceed with transition
  let targetMapLevel;
  let message;
  
  if (ladderType === 'ladder_down') {
    if (currentMapLevel === MAP_LEVELS.SURFACE) {
      targetMapLevel = MAP_LEVELS.UNDERGROUND;
      message = 'You climb down the ladder into the underground...';
    } else {
      if (window.addMessage) {
        window.addMessage("This ladder doesn't lead anywhere deeper.", 'warning');
      }
      return;
    }
  } else if (ladderType === 'ladder_up') {
    if (currentMapLevel === MAP_LEVELS.UNDERGROUND) {
      targetMapLevel = MAP_LEVELS.SURFACE;
      message = 'You climb up the ladder to the surface...';
    } else {
      if (window.addMessage) {
        window.addMessage("This ladder doesn't lead anywhere higher.", 'warning');
      }
      return;
    }
  }
  
  // Perform the map level transition
  transitionToMapLevel(targetMapLevel, ladderX, ladderY, message);
}

// Transition player to a different map level
function transitionToMapLevel(newMapLevel, x, y, message) {
  console.log(`Transitioning from ${MAP_LEVEL_NAMES[currentMapLevel]} to ${MAP_LEVEL_NAMES[newMapLevel]}`);
  
  // Show transition message
  if (window.addMessage && message) {
    window.addMessage(message, 'info');
  }
  
  // Update current map level
  const oldMapLevel = currentMapLevel;
  currentMapLevel = newMapLevel;
  
  // Save map level to user profile
  if (window.userModule && window.userModule.saveMapLevel) {
    const profile = window.userModule.getProfile();
    if (profile) {
      window.userModule.saveMapLevel(profile, newMapLevel);
      // Also save position with map level
      window.userModule.savePlayerPosition(profile, playerPosition.x, playerPosition.y, newMapLevel);
    }
  }
  
  // With the offset system, player position stays the same logically
  // but the rendering system will automatically handle the offset
  // No need to change playerPosition.x and playerPosition.y
  
  // Force a complete world re-render to show the new map level
  forceWorldRerender();
  
  // Update camera to ensure proper positioning
  updateCamera();
  
  // Refresh online player visibility for new map level
  if (window.refreshOnlinePlayerVisibility) {
    window.refreshOnlinePlayerVisibility();
  }
  
  // Notify other systems about map level change
  if (window.addMessage) {
    window.addMessage(`Now on: ${MAP_LEVEL_NAMES[newMapLevel]}`, 'success');
  }
  
  // Update multiplayer state if online
  if (window.isUserOnline && window.isUserOnline() && window.getWebSocket) {
    const websocket = window.getWebSocket();
    if (websocket && websocket.readyState === WebSocket.OPEN) {
      websocket.send(JSON.stringify({
        type: 'map-level-change',
        mapLevel: newMapLevel,
        position: { x: playerPosition.x, y: playerPosition.y },
        timestamp: Date.now()
      }));
    }
  }
  
  console.log(`Map level transition complete: ${MAP_LEVEL_NAMES[oldMapLevel]} -> ${MAP_LEVEL_NAMES[newMapLevel]}`);
}

// Get current map level
function getCurrentMapLevel() {
  return currentMapLevel;
}

// Set current map level (for loading saved games)
function setCurrentMapLevel(mapLevel) {
  if (mapLevel in MAP_LEVEL_NAMES) {
    currentMapLevel = mapLevel;
    console.log(`Map level set to: ${MAP_LEVEL_NAMES[mapLevel]}`);
    
    // Force re-render to show new map level
    forceWorldRerender();
    
    return true;
  }
  console.error('Invalid map level:', mapLevel);
  return false;
}

// ... existing code ...
function updateAllNPCPositions() {
  if (!window.worldModule) return;

  const gridSize = window.worldModule.getGridSize();
  const camerPos = window.worldModule.getCameraPosition();

  npcElements.forEach((npcElement, npcId) => {
    const npc = npcs.get(npcId);
    if (!npc) return;

    const worldX = npc.x;
    const worldY = npc.y;

    const isMoving = npcElement.dataset.isMoving === 'true';

    if (isMoving) {
      // Parse movement metadata – add safety for corrupted/undefined data
      const startTime = Number(npcElement.dataset.moveStartTime);
      const duration = Number(npcElement.dataset.moveDuration) || 500;
      const startX = Number(npcElement.dataset.startX);
      const startY = Number(npcElement.dataset.startY);
      const endX = Number(npcElement.dataset.endX);
      const endY = Number(npcElement.dataset.endY);

      // If any of the critical values are NaN, abort the animation and snap
      if ([startTime, startX, startY, endX, endY].some(v => isNaN(v))) {
        npcElement.dataset.isMoving = 'false';
      } else {
        const progressRaw = (Date.now() - startTime) / duration;
        const progress = Math.min(1, Math.max(0, progressRaw)); // Clamp 0-1

        const currentWorldX = startX + (endX - startX) * progress;
        const currentWorldY = startY + (endY - startY) * progress;

        const screenXMoving = (currentWorldX - camerPos.x) * gridSize;
        const screenYMoving = (currentWorldY - camerPos.y) * gridSize;

        npcElement.style.left = `${screenXMoving}px`;
        npcElement.style.top = `${screenYMoving}px`;

        // When animation is complete, clear movement state
        if (progress >= 1) {
          npcElement.dataset.isMoving = 'false';
          delete npcElement.dataset.startX;
          delete npcElement.dataset.startY;
          delete npcElement.dataset.endX;
          delete npcElement.dataset.endY;
          delete npcElement.dataset.moveDuration;
          delete npcElement.dataset.moveStartTime;
        }
      }
    }

    if (npcElement.dataset.isMoving !== 'true') {
      // Static positioning when not animating
      const screenX = (worldX - camerPos.x) * gridSize;
      const screenY = (worldY - camerPos.y) * gridSize;
      npcElement.style.left = `${screenX}px`;
      npcElement.style.top = `${screenY}px`;
    }

    // Maintain sprite orientation every frame
    const facing = npcElement.dataset.facing;
    if (facing) {
      const scaleX = facing === 'right' ? -1 : 1;
      npcElement.style.transform = `scaleX(${scaleX})`;
    }
  });
}

// Update digging hole positions for smooth camera movement
function updateDiggingHolePositions(cameraOffsetX, cameraOffsetY) {
  const gameWorld = document.getElementById('game-world');
  if (!gameWorld) return;
  
  const holes = gameWorld.querySelectorAll('.digging-hole');
  holes.forEach(holeElement => {
    const worldX = parseInt(holeElement.dataset.worldX);
    const worldY = parseInt(holeElement.dataset.worldY);
    
    if (!isNaN(worldX) && !isNaN(worldY)) {
      // Calculate current screen position based on camera and offset
      const startTileX = Math.floor(cameraPosition.x);
      const startTileY = Math.floor(cameraPosition.y);
      
      const viewX = worldX - startTileX;
      const viewY = worldY - startTileY;
      
      const screenX = (viewX - cameraOffsetX) * GRID_SIZE;
      const screenY = (viewY - cameraOffsetY) * GRID_SIZE;
      
      holeElement.style.left = `${screenX}px`;
      holeElement.style.top = `${screenY}px`;
    }
  });
}
// ... existing code ...
// ... existing code ...

/**
 * ============================
 *  Runtime Zoom helpers
 * ============================
 */

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// Recalculate all derived sizing vars after zoom change
function recalcGridAndViewport() {
  GRID_SIZE = BASE_GRID_SIZE * zoomLevel;
  VIEWPORT_COLS = Math.round(BASE_VIEWPORT_COLS / zoomLevel);
  VIEWPORT_ROWS = Math.round(BASE_VIEWPORT_ROWS / zoomLevel);
}

// Calculate pixel-perfect scaling ratio for sprites
function calculatePixelPerfectRatio(targetSize, spriteSize) {
  // Calculate the closest integer ratio that doesn't exceed target size
  const exactRatio = targetSize / spriteSize;
  
  // Use better thresholds for pixel-perfect scaling
  // At zoom 1.0 (32px): 1x scaling (32px sprite)
  // At zoom 1.5 (48px): 1x scaling (still crisp)
  // At zoom 2.0 (64px): 2x scaling (64px sprite)
  // At zoom 2.5 (80px): 2x scaling (still good)
  // At zoom 3.0 (96px): 3x scaling (96px sprite)
  
  let pixelRatio;
  if (exactRatio >= 3.0) {
    pixelRatio = 3;
  } else if (exactRatio >= 2.0) {
    pixelRatio = 2;
  } else {
    pixelRatio = 1;
  }
  
  console.log(`🎯 World module pixel ratio: target=${targetSize}px, sprite=${spriteSize}px, exact=${exactRatio.toFixed(2)}, pixel-perfect=${pixelRatio}x`);
  
  return pixelRatio;
}

// Resize DOM sprites (player + online players) to match current GRID_SIZE
function resizePlayerSprites() {
  const playerScale = 1.0; // Full grid size
  const marginScale = 0.0; // Centered positioning
  
  const mainPlayer = document.getElementById('player-character');
  if (mainPlayer) {
    const pixelRatio = calculatePixelPerfectRatio(GRID_SIZE, 32);
    const scaledSpriteSize = 32 * pixelRatio;
    
    // Size the player element to match grid size for proper tile alignment
    mainPlayer.style.width = `${GRID_SIZE}px`;
    mainPlayer.style.height = `${GRID_SIZE}px`;
    
    // Center the sprite within the grid cell
    const centerOffset = (GRID_SIZE - scaledSpriteSize) / 2;
    mainPlayer.style.backgroundSize = `${scaledSpriteSize}px ${scaledSpriteSize}px`;
    mainPlayer.style.backgroundPosition = 'center';
    
    // Apply proper margins to center the sprite
    mainPlayer.style.marginLeft = '0px';
    mainPlayer.style.marginTop = '0px';
    
    console.log(`🎯 Main player resized: grid=${GRID_SIZE}px, sprite=${scaledSpriteSize}px (${pixelRatio}x), centered`);
  }
  
  // Update online players with same system
  const onlinePlayers = document.querySelectorAll('.online-player');
  onlinePlayers.forEach(playerElement => {
    const pixelRatio = calculatePixelPerfectRatio(GRID_SIZE, 32);
    const scaledSpriteSize = 32 * pixelRatio;
    
    // Size the player element to match grid size for proper tile alignment
    playerElement.style.width = `${GRID_SIZE}px`;
    playerElement.style.height = `${GRID_SIZE}px`;
    
    // Center the sprite within the grid cell
    playerElement.style.backgroundSize = `${scaledSpriteSize}px ${scaledSpriteSize}px`;
    playerElement.style.backgroundPosition = 'center';
    
    // Apply proper margins to center the sprite
    playerElement.style.marginLeft = '0px';
    playerElement.style.marginTop = '0px';
    
    console.log(`🎯 Online player resized: grid=${GRID_SIZE}px, sprite=${scaledSpriteSize}px (${pixelRatio}x), centered`);
  });
}

function setZoomLevel(newZoom) {
  // Snap to nearest 0.25 increment to guarantee integer GRID_SIZE (32 * 0.25 = 8)
  const increment = 0.25;
  const snapped   = Math.round(newZoom / increment) * increment;
  const clamped = clamp(snapped, MIN_ZOOM, MAX_ZOOM);
  if (Math.abs(clamped - zoomLevel) < 0.001) return; // no-op
  zoomLevel = clamped;
  recalcGridAndViewport();

  // Update viewport dimensions & world container size
  const worldElement = document.getElementById('game-world');
  if (worldElement) {
    worldElement.style.width  = `${GRID_SIZE * VIEWPORT_COLS}px`;
    worldElement.style.height = `${GRID_SIZE * VIEWPORT_ROWS}px`;
  }

  // Re-centre camera on player to avoid drift
  cameraPosition.x = playerPosition.x - VIEWPORT_COLS / 2;
  cameraPosition.y = playerPosition.y - VIEWPORT_ROWS / 2;

  // Resize sprites & re-render all world tiles
  resizePlayerSprites();
  updateCamera(); // ensure camera offsets recalc before rerendering
  forceWorldRerender();

  // Notify other modules
  if (window.worldModule) {
    window.worldModule.getZoomLevel = () => zoomLevel;
  }
}

function handleZoomWheel(e) {
  e.preventDefault();
  const delta = e.deltaY;
  const step = 0.25; // matches snapping increment
  const direction = delta > 0 ? -1 : 1; // scrolling up -> delta negative -> zoom in (+1)
  const newZoom = zoomLevel + direction * step;
  setZoomLevel(newZoom);
}

// === Run UI ===
function createRunUI() {
  const gameWorld = document.querySelector('.game-world');
  if (!gameWorld) return;

  // Container overlay inside the game view (camera-synced)
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.right = '8px';
  container.style.bottom = '8px';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.alignItems = 'center';
  container.style.zIndex = '999';

  runBtn = document.createElement('button');
  runBtn.innerHTML = 'Run:<br>OFF'; // newline via <br> for consistent size
  runBtn.className = 'game-btn';
  runBtn.style.width = '80px';
  runBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent world click
    e.preventDefault();
    if (runEnergy <= 0) return;
    isRunning = !isRunning;
    updateRunUIButton();
  });

  energyEl = document.createElement('div');
  energyEl.textContent = 'Energy: 100%';
  energyEl.style.fontSize = '12px';
  energyEl.style.color = '#fff';

  container.appendChild(runBtn);
  container.appendChild(energyEl);
  gameWorld.appendChild(container);

  // Keyboard toggle (Left Control) to run ON/OFF
  window.addEventListener('keydown', (e) => {
    if (e.code === 'ControlLeft' && !e.repeat) {
      if (runEnergy > 0 || isRunning) {
        isRunning = !isRunning;
        updateRunUIButton();
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'ControlLeft') {
      // Only disable run if it wasn't toggled on via the button
      if (!runBtn || runBtn.textContent.includes('OFF')) {
        isRunning = false;
        updateRunUIButton();
      }
    }
  });

  // Load persisted energy
  const stored = Number(localStorage.getItem('run_energy'));
  if (!isNaN(stored)) runEnergy = Math.max(0, Math.min(100, stored));
  updateRunUIButton();

  // Regen loop – restores energy even while running (OSRS style)
  setInterval(() => {
    if (runEnergy < 100) {
      runEnergy = Math.min(100, runEnergy + RUN_REGEN_RATE);
      updateRunUIButton();
    }
  }, 1000);
}

function updateRunUIButton() {
  if (!runBtn || !energyEl) return;
  runBtn.innerHTML = `Run:<br>${isRunning ? 'ON' : 'OFF'}`;
  energyEl.textContent = `Energy: ${Math.round(runEnergy)}%`;
  runBtn.disabled = runEnergy <= 0;

  // Persist
  localStorage.setItem('run_energy', runEnergy.toFixed(2));
}

// ──────────────────────────────────────────────────────────────────────────
//  THREE-JS  GOLD  ORE  RENDERER
// ──────────────────────────────────────────────────────────────────────────

async function loadThreeCore() {
  console.log('loadThreeCore called');
  if (window.__threePromise) {
    console.log('Using cached Three.js promise');
    return window.__threePromise;
  }
  
  console.log('Starting Three.js import');
  window.__threePromise = Promise.all([
    import('three').catch(e => {
      console.error('Failed to import three:', e);
      throw e;
    }),
    import('three/addons/loaders/GLTFLoader.js').catch(e => {
      console.error('Failed to import GLTFLoader:', e);
      throw e;
    })
  ]).then(([THREE, { GLTFLoader }]) => {
    console.log('Three.js and GLTFLoader imported successfully');
    return { THREE: THREE, GLTFLoader: GLTFLoader };
  }).catch(error => {
    console.error('Failed to load Three.js dependencies:', error);
    throw error;
  });
  
  return window.__threePromise;
}

// Cache for rendered ore images at different sizes
const oreImageCache = {
  normal: {},
  depleted: {}
};

function renderGoldOreModel(element, worldX, worldY) {
  console.log('Starting gold ore model render for position:', worldX, worldY);
  
  // Clean placeholder styling
  element.innerHTML = '';
  element.style.background = 'transparent';
  element.style.filter = 'none';
  element.style.imageRendering = 'pixelated';

  const size = (typeof getGridSize === 'function') ? getGridSize() : 32;
  const oreKey = `${worldX},${worldY}`;
  const isDepleted = element.dataset.depleted === 'true' ||
    (window.depletedOreStates && window.depletedOreStates.has && window.depletedOreStates.has(oreKey));
  
  // Check cache first
  const cache = isDepleted ? oreImageCache.depleted : oreImageCache.normal;
  if (cache[size]) {
    console.log('Using cached ore image for size:', size);
    element.style.backgroundImage = `url(${cache[size]})`;
    element.style.backgroundSize = 'contain';
    return;
  }

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  element.appendChild(canvas);
  console.log('Canvas created with size:', size);

  loadThreeCore().then(({ THREE, GLTFLoader }) => {
    console.log('Three.js and GLTFLoader loaded successfully');
    const loader = new GLTFLoader();
    const oreKey = `${worldX},${worldY}`;
    const isDepleted = element.dataset.depleted === 'true' ||
      (window.depletedOreStates && window.depletedOreStates.has && window.depletedOreStates.has(oreKey));

    const modelPath = isDepleted ? 'images/objects/ore/gold_ore_depleted.glb'
                                 : 'images/objects/ore/gold_ore.glb';
    console.log('Loading model from path:', modelPath);

    // Create a fetch request to check if the model file exists
    fetch(modelPath)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Model file not found: ${modelPath} (${response.status})`);
        }
        console.log('Model file exists and is accessible');
        
        // Now load the model with GLTFLoader
        loader.load(modelPath, (gltf) => {
          console.log('Model loaded successfully:', gltf);
          const scene = new THREE.Scene();
          const model = gltf.scene;
          const scale = size / 2; // Keep 1 ThreeJS unit ≈ 2px so 32px tile => 16 scale
          model.scale.set(scale, scale, scale);
          
          // Rotate 45 degrees around Y axis and tilt down
          model.rotation.y = Math.PI / 4;
          model.rotation.x = Math.PI / 3; // Tilt down by 60 degrees
          scene.add(model);

          // Adjust camera to better frame the tilted model
          const camera = new THREE.OrthographicCamera(-scale, scale, scale, -scale, 0.1, 1000);
          camera.position.z = 50;
          camera.position.y = 20; // Move camera up slightly to look down
          camera.lookAt(0, 0, 0); // Point camera at center
          console.log('Camera set up at position:', camera.position);

          const light = new THREE.DirectionalLight(0xffffff, 1);
          light.position.set(5, 10, 10);
          scene.add(light);
          console.log('Lighting added to scene');

          const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
          renderer.setSize(size, size, false);
          console.log('Renderer created and sized');
          
          try {
            renderer.render(scene, camera);
            console.log('Scene rendered successfully');
            
            // Convert the rendered canvas to an image and cache it
            const dataUrl = canvas.toDataURL('image/png');
            const cache = isDepleted ? oreImageCache.depleted : oreImageCache.normal;
            cache[size] = dataUrl;
            
            element.removeChild(canvas); // Remove the WebGL canvas
            element.style.backgroundImage = `url(${dataUrl})`;
            element.style.backgroundSize = 'contain';
            
            // Clean up Three.js resources
            renderer.dispose();
            scene.dispose();
            
          } catch (renderError) {
            console.error('Error during scene render:', renderError);
            element.innerHTML = '🟡';
          }
        }, 
        // Progress callback
        (progress) => {
          const percent = (progress.loaded / progress.total * 100).toFixed(2);
          console.log(`Loading progress for ${modelPath}: ${percent}%`);
        },
        // Error callback
        (error) => {
          console.error('Error loading gold ore model:', error);
          element.innerHTML = '🟡';
        });
      })
      .catch(error => {
        console.error('Error checking model file:', error);
        element.innerHTML = '🟡';
      });
  }).catch(err => {
    console.error('Failed to load three.js / GLTF:', err);
    element.innerHTML = '🟡';
  });
}

// Original function reference for gold ore override
let originalApplyObjectStyling = null;

// Function to set up gold ore rendering override
function setupGoldOreOverride() {
  console.log('Setting up gold ore renderer override...');
  if (typeof window === 'undefined') {
    console.log('Not in browser environment, skipping');
    return;
  }
  
  // Store original function if not already stored
  if (!originalApplyObjectStyling) {
    originalApplyObjectStyling = applyObjectStyling;
    console.log('Stored original applyObjectStyling');
  }
  
  // Create the override function
  const overrideFunction = function(element, layer, tileValue, worldX, worldY) {
    console.log('applyObjectStyling called with:', { tileValue, worldX, worldY });
    if (tileValue === 'ore_gold') {
      console.log('Applying gold ore styling for:', worldX, worldY);
      // Draw GLB once per element
      renderGoldOreModel(element, worldX, worldY);
      if (typeof addOreEventHandlers === 'function') {
        addOreEventHandlers(element, tileValue, worldX, worldY);
      }
      element.title = 'Gold Ore';
      return; // Skip original styling to avoid emoji fallback
    }
    // Fallback to default behaviour for all other objects
    return originalApplyObjectStyling.call(this, element, layer, tileValue, worldX, worldY);
  };
  
  // Apply the override
  applyObjectStyling = overrideFunction;
  window.applyObjectStyling = overrideFunction;
  console.log('Gold ore override installed');
}

// Call setup during world initialization
document.addEventListener('DOMContentLoaded', setupGoldOreOverride);
window.addEventListener('load', setupGoldOreOverride);