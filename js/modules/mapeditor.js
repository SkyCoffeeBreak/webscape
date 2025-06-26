/**
 * Map Editor module for WebscapeRPG
 * Allows creating, editing, saving, and loading custom maps with layered system
 */

// Map editor configuration
const EDITOR_GRID_SIZE = 32; // Increased from 16 to 32 for better visibility
let EDITOR_WORLD_COLS = 100; // Made dynamic for resizing
let EDITOR_WORLD_ROWS = 100; // Made dynamic for resizing

// Viewport configuration
const EDITOR_VIEWPORT_COLS = 36; // Increased from 24 (50% bigger)
const EDITOR_VIEWPORT_ROWS = 24; // Increased from 16 (50% bigger)

// Camera state
let editorCameraPosition = { x: 38, y: 42 }; // Start near center (50-12, 50-8)
let lastEditorCameraTilePosition = { x: -1, y: -1 }; // Track camera movement for rendering optimization

// Navigation state
let canvasScrollSpeed = 5; // Tiles to move per WASD press

// Layer system constants (back to original simple system)
const EDITOR_LAYERS = {
  TERRAIN: 0,       // Grass, sand, dirt, stone floor, cobblestone, wooden floor, water, rock, brick wall
  GROUND_OBJECTS: 1, // Floor decorations and items  
  INTERACTIVE_OBJECTS: 2, // Banks, trees, ores - all clickable objects
  DECORATIVE_OVERLAYS: 3 // Visual effects and overlays
};

// Map level constants for editor
const EDITOR_MAP_LEVELS = {
  SURFACE: 'surface',
  UNDERGROUND: 'underground'
};

// Default terrain for each map level
const EDITOR_DEFAULT_TERRAIN = {
  [EDITOR_MAP_LEVELS.SURFACE]: 3, // Water base for surface
  [EDITOR_MAP_LEVELS.UNDERGROUND]: 57 // Black void base for underground
};

const EDITOR_LAYER_NAMES = {
  '0': 'Terrain',
  '1': 'Ground Objects',
  '2': 'Interactive Objects', 
  '3': 'Decorative Overlays'
};

// Editor state
let editorLayers = [];
let selectedTile = '0'; // Default to grass
let currentLayer = EDITOR_LAYERS.TERRAIN; // Current editing layer - start with "Terrain"
let currentMapLevel = EDITOR_MAP_LEVELS.SURFACE; // Current map level being edited
let isEditing = false;
let isDragging = false;

// Multi-level editor storage
let editorMapLevels = {
  [EDITOR_MAP_LEVELS.SURFACE]: [],
  [EDITOR_MAP_LEVELS.UNDERGROUND]: []
};

// Item spawn configurations - stores custom properties for each item spawn
let itemSpawnConfigs = {}; // Key: "x,y", Value: { itemId, quantity, respawnTime, lastPickupTime }

// NPC spawn configurations - stores custom properties for each NPC spawn
let npcSpawnConfigs = {}; // Key: "x,y", Value: { npcType }

// Tile and object definitions
const TILE_DEFINITIONS = {
  // Special tools
  'erase': { name: 'Eraser', icon: '🧽', type: 'tool', layer: null },
  
  // Terrain tiles (Layer 0) - walkable surfaces and obstacles
  '0': { name: 'Grass', icon: '🌱', type: 'terrain', layer: EDITOR_LAYERS.TERRAIN },
  '1': { name: 'Rock', icon: '🗿', type: 'terrain', layer: EDITOR_LAYERS.TERRAIN },
  '2': { name: 'Sand', icon: '🏜️', type: 'terrain', layer: EDITOR_LAYERS.TERRAIN },
  '3': { name: 'Water', icon: '💧', type: 'terrain', layer: EDITOR_LAYERS.TERRAIN },
  '4': { name: 'Stone Floor', icon: '⬜', type: 'terrain', layer: EDITOR_LAYERS.TERRAIN },
  '5': { name: 'Brick Wall', icon: '🧱', type: 'terrain', layer: EDITOR_LAYERS.TERRAIN },
  '6': { name: 'Dirt', icon: '🟫', type: 'terrain', layer: EDITOR_LAYERS.TERRAIN },
  '7': { name: 'Cobblestone', icon: '🔳', type: 'terrain', layer: EDITOR_LAYERS.TERRAIN },
  '8': { name: 'Wooden Floor', icon: '🟤', type: 'terrain', layer: EDITOR_LAYERS.TERRAIN },
  
  // New Wall Types (IDs 9-16) - obstacles
  '9': { name: 'Stone Wall', icon: '🗿', type: 'terrain', layer: EDITOR_LAYERS.TERRAIN },
  '10': { name: 'Wood Wall', icon: '🪵', type: 'terrain', layer: EDITOR_LAYERS.TERRAIN },
  '11': { name: 'Metal Wall', icon: '⚫', type: 'terrain', layer: EDITOR_LAYERS.TERRAIN },
  '12': { name: 'Crystal Wall', icon: '💎', type: 'terrain', layer: EDITOR_LAYERS.TERRAIN },
  '13': { name: 'Marble Wall', icon: '⚪', type: 'terrain', layer: EDITOR_LAYERS.TERRAIN },
  '14': { name: 'Obsidian Wall', icon: '⬛', type: 'terrain', layer: EDITOR_LAYERS.TERRAIN },
  '15': { name: 'Ice Wall', icon: '🧊', type: 'terrain', layer: EDITOR_LAYERS.TERRAIN },
  '16': { name: 'Thorned Wall', icon: '🌿', type: 'terrain', layer: EDITOR_LAYERS.TERRAIN },
  
  // New Terrain Types (IDs 17-24) - walkable surfaces
  '17': { name: 'Gravel', icon: '◦', type: 'terrain', layer: EDITOR_LAYERS.TERRAIN },
  '18': { name: 'Snow', icon: '❄️', type: 'terrain', layer: EDITOR_LAYERS.TERRAIN },
  '19': { name: 'Mud', icon: '🟤', type: 'terrain', layer: EDITOR_LAYERS.TERRAIN },
  '20': { name: 'Lava', icon: '🌋', type: 'terrain', layer: EDITOR_LAYERS.TERRAIN },
  '21': { name: 'Swamp', icon: '🐸', type: 'terrain', layer: EDITOR_LAYERS.TERRAIN },
  '22': { name: 'Tundra', icon: '🏔️', type: 'terrain', layer: EDITOR_LAYERS.TERRAIN },
  '23': { name: 'Desert Stone', icon: '🏺', type: 'terrain', layer: EDITOR_LAYERS.TERRAIN },
  '24': { name: 'Mossy Stone', icon: '🍃', type: 'terrain', layer: EDITOR_LAYERS.TERRAIN },
  
  // Additional Wall Types (IDs 25-32) - obstacles
  '25': { name: 'Sandstone Wall', icon: '🧱', type: 'terrain', layer: EDITOR_LAYERS.TERRAIN },
  '26': { name: 'Coral Wall', icon: '🪸', type: 'terrain', layer: EDITOR_LAYERS.TERRAIN },
  '27': { name: 'Bone Wall', icon: '🦴', type: 'terrain', layer: EDITOR_LAYERS.TERRAIN },
  '28': { name: 'Magic Barrier', icon: '✨', type: 'terrain', layer: EDITOR_LAYERS.TERRAIN },
  '29': { name: 'Volcanic Rock', icon: '🌋', type: 'terrain', layer: EDITOR_LAYERS.TERRAIN },
  '30': { name: 'Bamboo Wall', icon: '🎋', type: 'terrain', layer: EDITOR_LAYERS.TERRAIN },
  '31': { name: 'Iron Bars', icon: '🔒', type: 'terrain', layer: EDITOR_LAYERS.TERRAIN },
  '32': { name: 'Energy Field', icon: '⚡', type: 'terrain', layer: EDITOR_LAYERS.TERRAIN },
  
  // Additional Floor Types (IDs 33-40) - walkable surfaces
  '33': { name: 'Marble Floor', icon: '⬜', type: 'terrain', layer: EDITOR_LAYERS.TERRAIN },
  '34': { name: 'Carpet', icon: '🟥', type: 'terrain', layer: EDITOR_LAYERS.TERRAIN },
  '35': { name: 'Metal Grating', icon: '⬜', type: 'terrain', layer: EDITOR_LAYERS.TERRAIN },
  '36': { name: 'Crystal Floor', icon: '💎', type: 'terrain', layer: EDITOR_LAYERS.TERRAIN },
  '37': { name: 'Lava Rock', icon: '🪨', type: 'terrain', layer: EDITOR_LAYERS.TERRAIN },
  '38': { name: 'Ice Floor', icon: '🧊', type: 'terrain', layer: EDITOR_LAYERS.TERRAIN },
  '39': { name: 'Grass Path', icon: '🌿', type: 'terrain', layer: EDITOR_LAYERS.TERRAIN },
  '40': { name: 'Ancient Tiles', icon: '🔳', type: 'terrain', layer: EDITOR_LAYERS.TERRAIN },
  
  // Clay Terrain Types (IDs 41-46) - diggable clay deposits
  '41': { name: 'Clay Deposit', icon: '🟤', type: 'terrain', layer: EDITOR_LAYERS.TERRAIN },
  '42': { name: 'Fire Clay', icon: '🔥', type: 'terrain', layer: EDITOR_LAYERS.TERRAIN },
  '43': { name: 'Cambrian Clay', icon: '🌊', type: 'terrain', layer: EDITOR_LAYERS.TERRAIN },
  '44': { name: 'White Clay', icon: '⬜', type: 'terrain', layer: EDITOR_LAYERS.TERRAIN },
  '45': { name: 'Black Clay', icon: '⬛', type: 'terrain', layer: EDITOR_LAYERS.TERRAIN },
  '46': { name: 'Sacred Clay', icon: '✨', type: 'terrain', layer: EDITOR_LAYERS.TERRAIN },
  
  // Bone Excavation Terrain Types (IDs 50-56) - diggable bone sites
  '50': { name: 'Bone Shards', icon: '🦴', type: 'terrain', layer: EDITOR_LAYERS.TERRAIN },
  '51': { name: 'Burial Mound', icon: '⚱️', type: 'terrain', layer: EDITOR_LAYERS.TERRAIN },
  '52': { name: 'Mammoth Pit', icon: '🦣', type: 'terrain', layer: EDITOR_LAYERS.TERRAIN },
  '53': { name: 'Behemoth Remains', icon: '💀', type: 'terrain', layer: EDITOR_LAYERS.TERRAIN },
  '54': { name: 'Fossil Shelf', icon: '🦕', type: 'terrain', layer: EDITOR_LAYERS.TERRAIN },
  '55': { name: 'Draconic Remains', icon: '🐲', type: 'terrain', layer: EDITOR_LAYERS.TERRAIN },
  '56': { name: 'Ancient Graveyard', icon: '💀', type: 'terrain', layer: EDITOR_LAYERS.TERRAIN },
  
  // Underground terrain
  '57': { name: 'Black Void', icon: '⚫', type: 'terrain', layer: EDITOR_LAYERS.TERRAIN },
  
  // Interactive objects (Layer 2)
  'bank': { name: 'Bank', icon: '🏦', type: 'object', layer: EDITOR_LAYERS.INTERACTIVE_OBJECTS },
      'shop_general': { name: 'General Store', icon: '🏪', type: 'object', layer: EDITOR_LAYERS.INTERACTIVE_OBJECTS },
    'shop_weapon': { name: 'Weapon Shop', icon: '⚔️', type: 'object', layer: EDITOR_LAYERS.INTERACTIVE_OBJECTS },
    'shop_magic': { name: 'Magic Shop', icon: '🔮', type: 'object', layer: EDITOR_LAYERS.INTERACTIVE_OBJECTS },
    'shop_mining': { name: 'Mining Shop', icon: '⛏️', type: 'object', layer: EDITOR_LAYERS.INTERACTIVE_OBJECTS },
    'shop_fletching': { name: 'Fletching Shop', icon: '🏹', type: 'object', layer: EDITOR_LAYERS.INTERACTIVE_OBJECTS },
    'shop_fishing': { name: 'Fishing Shop', icon: '🎣', type: 'object', layer: EDITOR_LAYERS.INTERACTIVE_OBJECTS },
  'tree_regular': { name: 'Regular Tree', icon: '🌳', type: 'object', layer: EDITOR_LAYERS.INTERACTIVE_OBJECTS },
  'tree_oak': { name: 'Oak Tree', icon: '🌳', type: 'object', layer: EDITOR_LAYERS.INTERACTIVE_OBJECTS },
  'tree_pine': { name: 'Pine Tree', icon: '🌲', type: 'object', layer: EDITOR_LAYERS.INTERACTIVE_OBJECTS },
  'tree_palm': { name: 'Palm Tree', icon: '🌴', type: 'object', layer: EDITOR_LAYERS.INTERACTIVE_OBJECTS },
  'tree_bamboo': { name: 'Bamboo', icon: '🎋', type: 'object', layer: EDITOR_LAYERS.INTERACTIVE_OBJECTS },
  'tree_magic': { name: 'Magic Tree', icon: '🎄', type: 'object', layer: EDITOR_LAYERS.INTERACTIVE_OBJECTS },
  'ore_copper': { name: 'Copper Ore', icon: '🟤', type: 'object', layer: EDITOR_LAYERS.INTERACTIVE_OBJECTS },
  'ore_tin': { name: 'Tin Ore', icon: '🔘', type: 'object', layer: EDITOR_LAYERS.INTERACTIVE_OBJECTS },
  'ore_iron': { name: 'Iron Ore', icon: '⚫', type: 'object', layer: EDITOR_LAYERS.INTERACTIVE_OBJECTS },
  'ore_silver': { name: 'Silver Ore', icon: '⚪', type: 'object', layer: EDITOR_LAYERS.INTERACTIVE_OBJECTS },
  'ore_gold': { name: 'Gold Ore', icon: '🟡', type: 'object', layer: EDITOR_LAYERS.INTERACTIVE_OBJECTS },
  'ore_mithril': { name: 'Mithril Ore', icon: '🔵', type: 'object', layer: EDITOR_LAYERS.INTERACTIVE_OBJECTS },
  'ore_adamantite': { name: 'Adamantite Ore', icon: '🟢', type: 'object', layer: EDITOR_LAYERS.INTERACTIVE_OBJECTS },
  'fishing_spot_shrimp': { name: 'Shrimp Fishing Spot', icon: '🌀', type: 'object', layer: EDITOR_LAYERS.INTERACTIVE_OBJECTS },
  'fishing_spot_sardine': { name: 'Sardine Fishing Spot', icon: '🌀', type: 'object', layer: EDITOR_LAYERS.INTERACTIVE_OBJECTS },
  'fishing_spot_herring': { name: 'Herring Fishing Spot', icon: '🌀', type: 'object', layer: EDITOR_LAYERS.INTERACTIVE_OBJECTS },
  'fishing_spot_anchovies': { name: 'Anchovies Fishing Spot', icon: '🌀', type: 'object', layer: EDITOR_LAYERS.INTERACTIVE_OBJECTS },
  'fishing_spot_tuna': { name: 'Tuna Fishing Spot', icon: '🌀', type: 'object', layer: EDITOR_LAYERS.INTERACTIVE_OBJECTS },
  'fishing_spot_lobster': { name: 'Lobster Fishing Spot', icon: '🌀', type: 'object', layer: EDITOR_LAYERS.INTERACTIVE_OBJECTS },
  'fishing_spot_swordfish': { name: 'Swordfish Fishing Spot', icon: '🌀', type: 'object', layer: EDITOR_LAYERS.INTERACTIVE_OBJECTS },
  'fishing_spot_shark': { name: 'Shark Fishing Spot', icon: '🌀', type: 'object', layer: EDITOR_LAYERS.INTERACTIVE_OBJECTS },
  'item_spawn': { name: 'Item Spawn', icon: '📦', type: 'item_spawn', layer: EDITOR_LAYERS.INTERACTIVE_OBJECTS },
  'pulp_basin': { name: 'Pulp Basin', icon: '🪣', type: 'object', layer: EDITOR_LAYERS.INTERACTIVE_OBJECTS },
  'scribing_table': { name: 'Scribing Table', icon: '📝', type: 'object', layer: EDITOR_LAYERS.INTERACTIVE_OBJECTS },
  'cooking_range': { name: 'Cooking Range', icon: '🔥', type: 'object', layer: EDITOR_LAYERS.INTERACTIVE_OBJECTS },
  'cooking_fire': { name: 'Cooking Fire', icon: '🔥', type: 'object', layer: EDITOR_LAYERS.INTERACTIVE_OBJECTS },
  'apple_tree': { name: 'Apple Tree', icon: '🍎', type: 'object', layer: EDITOR_LAYERS.INTERACTIVE_OBJECTS },
  'cherry_tree': { name: 'Cherry Tree', icon: '🍒', type: 'object', layer: EDITOR_LAYERS.INTERACTIVE_OBJECTS },
  'peach_tree': { name: 'Peach Tree', icon: '🍑', type: 'object', layer: EDITOR_LAYERS.INTERACTIVE_OBJECTS },
  'mushroom_patch': { name: 'Mushroom Patch', icon: '🍄', type: 'object', layer: EDITOR_LAYERS.INTERACTIVE_OBJECTS },
  'wheat_field': { name: 'Wheat Field', icon: '🌾', type: 'object', layer: EDITOR_LAYERS.INTERACTIVE_OBJECTS },
  'ladder_down': { name: 'Ladder Down', icon: '🪜⬇️', type: 'object', layer: EDITOR_LAYERS.INTERACTIVE_OBJECTS },
  'ladder_up': { name: 'Ladder Up', icon: '🪜⬆️', type: 'object', layer: EDITOR_LAYERS.INTERACTIVE_OBJECTS },
  
  // NPCs (Layer 2)
  'npc_rat': { name: 'Rat (NPC)', icon: '🐀', type: 'npc', layer: EDITOR_LAYERS.INTERACTIVE_OBJECTS },
  'npc_cow': { name: 'Cow (NPC)', icon: '🐄', type: 'npc', layer: EDITOR_LAYERS.INTERACTIVE_OBJECTS },
  'npc_goblin': { name: 'Goblin (NPC)', icon: '👹', type: 'npc', layer: EDITOR_LAYERS.INTERACTIVE_OBJECTS },
  
  // Decorative overlays (Layer 3)
  'decorative_overlay_1': { name: 'Decorative Overlay 1', icon: '🎨', type: 'decorative', layer: EDITOR_LAYERS.DECORATIVE_OVERLAYS },
  'decorative_overlay_2': { name: 'Decorative Overlay 2', icon: '🎨', type: 'decorative', layer: EDITOR_LAYERS.DECORATIVE_OVERLAYS },
  'decorative_overlay_3': { name: 'Decorative Overlay 3', icon: '🎨', type: 'decorative', layer: EDITOR_LAYERS.DECORATIVE_OVERLAYS },
  'decorative_overlay_4': { name: 'Decorative Overlay 4', icon: '🎨', type: 'decorative', layer: EDITOR_LAYERS.DECORATIVE_OVERLAYS },
  'decorative_overlay_5': { name: 'Decorative Overlay 5', icon: '🎨', type: 'decorative', layer: EDITOR_LAYERS.DECORATIVE_OVERLAYS },
  'decorative_overlay_6': { name: 'Decorative Overlay 6', icon: '🎨', type: 'decorative', layer: EDITOR_LAYERS.DECORATIVE_OVERLAYS },
  'decorative_overlay_7': { name: 'Decorative Overlay 7', icon: '🎨', type: 'decorative', layer: EDITOR_LAYERS.DECORATIVE_OVERLAYS },
  'decorative_overlay_8': { name: 'Decorative Overlay 8', icon: '🎨', type: 'decorative', layer: EDITOR_LAYERS.DECORATIVE_OVERLAYS },
  'decorative_overlay_9': { name: 'Decorative Overlay 9', icon: '🎨', type: 'decorative', layer: EDITOR_LAYERS.DECORATIVE_OVERLAYS },
  'decorative_overlay_10': { name: 'Decorative Overlay 10', icon: '🎨', type: 'decorative', layer: EDITOR_LAYERS.DECORATIVE_OVERLAYS }
};

// Initialize the map editor
function initializeMapEditor() {
  console.log('Initializing map editor...');
  
  // Initialize layers system
  initializeEditorLayers();
  
  // Try to load existing map data
  loadExistingMap();
  
  // Update the display to match current dimensions
  updateMapDimensionsDisplay();
  
  // Set up event listeners with a small delay to ensure DOM is ready
  setTimeout(() => {
    setupEditorEventListeners();
    // Render the editor canvas
    renderEditorCanvas();
    console.log('Map editor initialized');
  }, 100);
}

// Initialize the editor layers system
function initializeEditorLayers() {
  // Initialize both map levels
  for (const mapLevel of Object.values(EDITOR_MAP_LEVELS)) {
    editorMapLevels[mapLevel] = [];
    
    // Initialize all 4 layers (0-3) for each map level
    for (let layer = 0; layer < 4; layer++) {
      editorMapLevels[mapLevel][layer] = [];
      for (let y = 0; y < EDITOR_WORLD_ROWS; y++) {
        editorMapLevels[mapLevel][layer][y] = [];
        for (let x = 0; x < EDITOR_WORLD_COLS; x++) {
          if (layer === EDITOR_LAYERS.TERRAIN) {
            editorMapLevels[mapLevel][layer][y][x] = EDITOR_DEFAULT_TERRAIN[mapLevel];
          } else {
            editorMapLevels[mapLevel][layer][y][x] = null; // Other layers start empty
          }
        }
      }
    }
  }
  
  // Set editorLayers to point to current map level
  editorLayers = editorMapLevels[currentMapLevel];
  
  console.log('Editor layers initialized for both map levels');
}

// Set up event listeners for the editor
function setupEditorEventListeners() {
  console.log('Setting up editor event listeners...');
  
  // Map level selector buttons
  const mapLevelButtons = document.querySelectorAll('.map-level-button');
  console.log(`Found ${mapLevelButtons.length} map level buttons`);
  
  mapLevelButtons.forEach((button, index) => {
    const mapLevel = button.dataset.mapLevel;
    console.log(`Setting up map level button ${index}: ${mapLevel}`);
    
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      console.log('Map level button clicked:', mapLevel);
      
      // Remove active class from all map level buttons
      mapLevelButtons.forEach(b => b.classList.remove('active'));
      // Add active class to clicked button
      button.classList.add('active');
      
      // Switch to new map level
      switchMapLevel(mapLevel);
    });
  });
  
  // Layer selector buttons
  const layerButtons = document.querySelectorAll('.layer-button');
  console.log(`Found ${layerButtons.length} layer buttons`);
  
  layerButtons.forEach((button, index) => {
    const layer = parseInt(button.dataset.layer);
    console.log(`Setting up layer button ${index}: layer ${layer}`);
    
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      console.log('Layer button clicked:', layer);
      
      // Remove active class from all layer buttons
      layerButtons.forEach(b => b.classList.remove('active'));
      // Add active class to clicked button
      button.classList.add('active');
      // Set current layer
      currentLayer = layer;
      
      // Update tile palette to show appropriate tiles for this layer
      updateTilePaletteForLayer(layer);
      
      console.log('Current layer changed to:', currentLayer, EDITOR_LAYER_NAMES[currentLayer]);
    });
  });
  
  // Tile palette selection
  const tileButtons = document.querySelectorAll('.tile-button');
  console.log(`Found ${tileButtons.length} tile buttons`);
  
  if (tileButtons.length === 0) {
    console.error('No tile buttons found! Check if DOM elements exist.');
    return;
  }
  
  tileButtons.forEach((button, index) => {
    console.log(`Setting up button ${index}: ${button.dataset.tile}`);
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      console.log('Tile button clicked:', button.dataset.tile);
      
      // Remove active class from all tile buttons
      tileButtons.forEach(b => b.classList.remove('active'));
      
      // Remove active class from all action buttons (to deactivate eraser)
      const allActionButtons = document.querySelectorAll('.action-btn');
      allActionButtons.forEach(b => b.classList.remove('active'));
      
      // Add active class to clicked button
      button.classList.add('active');
      // Set selected tile
      selectedTile = button.dataset.tile;
      console.log('Selected tile:', selectedTile, TILE_DEFINITIONS[selectedTile]?.name);
    });
  });
  
  // Editor controls
  const clearMapBtn = document.getElementById('editor-clear-map');
  if (clearMapBtn) {
    clearMapBtn.addEventListener('click', clearMap);
    console.log('Clear map button listener added');
  } else {
    console.error('Clear map button not found');
  }
  
  const generateRandomBtn = document.getElementById('editor-generate-random');
  if (generateRandomBtn) {
    generateRandomBtn.addEventListener('click', generateRandomMap);
    console.log('Generate random button listener added');
  } else {
    console.error('Generate random button not found');
  }
  
  const saveMapBtn = document.getElementById('editor-save-map');
  if (saveMapBtn) {
    saveMapBtn.addEventListener('click', saveMap);
    console.log('Save map button listener added');
  } else {
    console.error('Save map button not found');
  }
  
  const loadMapBtn = document.getElementById('editor-load-map');
  if (loadMapBtn) {
    loadMapBtn.addEventListener('click', () => {
      document.getElementById('editor-file-input').click();
    });
    console.log('Load map button listener added');
  } else {
    console.error('Load map button not found');
  }
  
  const fileInput = document.getElementById('editor-file-input');
  if (fileInput) {
    fileInput.addEventListener('change', loadMapFromFile);
    console.log('File input listener added');
  } else {
    console.error('File input not found');
  }
  
  // Eraser tool button
  const eraserBtn = document.getElementById('editor-eraser-tool');
  if (eraserBtn) {
    eraserBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      console.log('Eraser tool clicked');
      
      // Remove active class from all tile buttons
      const allTileButtons = document.querySelectorAll('.tile-button');
      allTileButtons.forEach(b => b.classList.remove('active'));
      
      // Remove active class from all action buttons
      const allActionButtons = document.querySelectorAll('.action-btn');
      allActionButtons.forEach(b => b.classList.remove('active'));
      
      // Add active class to eraser button
      eraserBtn.classList.add('active');
      
      // Set selected tile to erase
      selectedTile = 'erase';
      
      console.log('Eraser tool activated');
    });
    console.log('Eraser tool button listener added');
  } else {
    console.error('Eraser tool button not found');
  }
  
  const applyToGameBtn = document.getElementById('editor-apply-to-game');
  if (applyToGameBtn) {
    applyToGameBtn.addEventListener('click', applyMapToGame);
    console.log('Apply to game button listener added');
  } else {
    console.error('Apply to game button not found');
  }
  
  // Navigation controls
  setupNavigationControls();
  
  // Map resize controls
  setupMapResizeControls();
  
  // Keyboard navigation (WASD)
  setupKeyboardNavigation();
  
  console.log('Editor event listeners setup complete');
}

// Switch to a different map level
function switchMapLevel(mapLevel) {
  console.log(`Switching to map level: ${mapLevel}`);
  
  // Update current map level
  currentMapLevel = mapLevel;
  
  // Point editorLayers to the new map level
  editorLayers = editorMapLevels[currentMapLevel];
  
  // Re-render the entire canvas with the new map level data
  renderEditorCanvas();
  
  console.log(`Switched to ${mapLevel} level`);
}

// Update tile palette based on current layer
function updateTilePaletteForLayer(layer) {
  const tileButtons = document.querySelectorAll('.tile-button');
  
  tileButtons.forEach(button => {
    const tileId = button.dataset.tile;
    const tileDef = TILE_DEFINITIONS[tileId];
    
    if (tileDef && tileDef.layer === layer) {
      // Show tiles that belong to the selected layer
      button.style.display = 'block';
      button.classList.remove('hidden');
    } else {
      // Hide tiles that don't belong to the selected layer
      button.style.display = 'none';
      button.classList.add('hidden');
    }
  });
  
  // Auto-select first visible tile for this layer
  const firstVisibleButton = Array.from(tileButtons).find(button => 
    button.style.display !== 'none' && TILE_DEFINITIONS[button.dataset.tile]?.layer === layer
  );
  
  if (firstVisibleButton) {
    // Clear previous selections
    tileButtons.forEach(b => b.classList.remove('active'));
    // Select first visible tile
    firstVisibleButton.classList.add('active');
    selectedTile = firstVisibleButton.dataset.tile;
    console.log('Auto-selected tile for layer:', selectedTile);
  } else if (layer === EDITOR_LAYERS.TERRAIN) {
    // Fallback to grass for terrain layer
    selectedTile = '0';
  } else {
    // For other layers, use eraser/null mode
    selectedTile = 'erase';
  }
}

// Render the editor canvas
function renderEditorCanvas() {
  const canvas = document.getElementById('map-editor-canvas');
  if (!canvas) {
    console.error('Map editor canvas not found');
    return;
  }
  
  // Set canvas size to viewport size (not full world size)
  const canvasWidth = EDITOR_VIEWPORT_COLS * EDITOR_GRID_SIZE;
  const canvasHeight = EDITOR_VIEWPORT_ROWS * EDITOR_GRID_SIZE;
  canvas.style.width = `${canvasWidth}px`;
  canvas.style.height = `${canvasHeight}px`;
  canvas.style.minWidth = `${canvasWidth}px`;
  canvas.style.minHeight = `${canvasHeight}px`;
  
  console.log(`Canvas sized to: ${canvasWidth}px x ${canvasHeight}px for ${EDITOR_VIEWPORT_COLS}x${EDITOR_VIEWPORT_ROWS} tiles`);
  
  // Clear existing tiles
  canvas.innerHTML = '';
  
  // Clamp camera to world bounds
  editorCameraPosition.x = Math.max(0, Math.min(EDITOR_WORLD_COLS - EDITOR_VIEWPORT_COLS, editorCameraPosition.x));
  editorCameraPosition.y = Math.max(0, Math.min(EDITOR_WORLD_ROWS - EDITOR_VIEWPORT_ROWS, editorCameraPosition.y));
  
  // Create tile elements with layered rendering
  for (let viewY = 0; viewY < EDITOR_VIEWPORT_ROWS; viewY++) {
    for (let viewX = 0; viewX < EDITOR_VIEWPORT_COLS; viewX++) {
      const worldX = Math.floor(editorCameraPosition.x) + viewX;
      const worldY = Math.floor(editorCameraPosition.y) + viewY;
      
      // Check if this world position is within bounds
      if (worldX >= 0 && worldX < EDITOR_WORLD_COLS && worldY >= 0 && worldY < EDITOR_WORLD_ROWS) {
        // Create base tile container
        const tileContainer = document.createElement('div');
        tileContainer.className = 'editor-tile-container';
        tileContainer.style.position = 'absolute';
        tileContainer.style.left = `${viewX * EDITOR_GRID_SIZE}px`;
        tileContainer.style.top = `${viewY * EDITOR_GRID_SIZE}px`;
        tileContainer.style.width = `${EDITOR_GRID_SIZE}px`;
        tileContainer.style.height = `${EDITOR_GRID_SIZE}px`;
        tileContainer.style.cursor = 'crosshair';
        tileContainer.dataset.x = worldX;
        tileContainer.dataset.y = worldY;
        tileContainer.dataset.viewX = viewX;
        tileContainer.dataset.viewY = viewY;
        
        // Render all layers in order (0 = bottom, 3 = top)
        renderEditorTileLayers(tileContainer, worldX, worldY);
        
        // Add event listeners for tile editing
        tileContainer.addEventListener('mousedown', startTileEdit);
        tileContainer.addEventListener('mouseenter', continueTileEdit);
        tileContainer.addEventListener('mouseup', endTileEdit);
        
        // Add right-click context menu listener
        tileContainer.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          const x = parseInt(tileContainer.dataset.x);
          const y = parseInt(tileContainer.dataset.y);
          
          // Check if there are any objects to delete (skip terrain layer)
          let hasObjects = false;
          for (let layer = 1; layer < editorLayers.length; layer++) { // Start from layer 1 (skip terrain)
            const value = editorLayers[layer][y][x];
            if (value !== null && value !== undefined) {
              hasObjects = true;
              break;
            }
          }
          
          if (hasObjects) {
            showEditorContextMenu(e, x, y);
          }
        });
        
        canvas.appendChild(tileContainer);
      }
    }
  }
  
  // Add canvas-level event listeners
  canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    e.preventDefault();
  });
  
  canvas.addEventListener('mouseup', () => {
    isDragging = false;
  });
  
  canvas.addEventListener('mouseleave', () => {
    isDragging = false;
  });
  
  // Update camera position display
  updateCameraPositionDisplay();
  
  console.log(`Rendered viewport at camera (${editorCameraPosition.x}, ${editorCameraPosition.y})`);
}

// Render all layers for a single tile
function renderEditorTileLayers(tileContainer, worldX, worldY) {
  // Render all layers in order (0 = bottom, 3 = top)
  for (let layer = 0; layer < editorLayers.length; layer++) {
    const tileValue = editorLayers[layer][worldY][worldX];
    
    // Skip empty/null tiles on non-terrain layers
    if (layer !== EDITOR_LAYERS.TERRAIN && (tileValue === null || tileValue === undefined)) {
      continue;
    }
    
    // Skip grass on terrain layer ONLY if there are no objects above it
    if (layer === EDITOR_LAYERS.TERRAIN && tileValue === 0) {
      const hasObjectsAbove = editorLayers[EDITOR_LAYERS.GROUND_OBJECTS][worldY][worldX] !== null ||
                              editorLayers[EDITOR_LAYERS.INTERACTIVE_OBJECTS][worldY][worldX] !== null ||
                              editorLayers[EDITOR_LAYERS.DECORATIVE_OVERLAYS][worldY][worldX] !== null;
      
      if (!hasObjectsAbove) {
        continue; // Skip grass only if no objects above
      }
    }
    
    const layerElement = document.createElement('div');
    layerElement.className = 'editor-layer-element';
    layerElement.dataset.layer = layer;
    layerElement.dataset.tileValue = tileValue;
    layerElement.style.position = 'absolute';
    layerElement.style.left = '0px';
    layerElement.style.top = '0px';
    layerElement.style.width = `${EDITOR_GRID_SIZE}px`;
    layerElement.style.height = `${EDITOR_GRID_SIZE}px`;
    layerElement.style.pointerEvents = 'none'; // Let clicks pass through to container
    
    // Set z-index based on layer
    const zIndexMap = {
      [EDITOR_LAYERS.TERRAIN]: '1',
      [EDITOR_LAYERS.GROUND_OBJECTS]: '2',
      [EDITOR_LAYERS.INTERACTIVE_OBJECTS]: '3',
      [EDITOR_LAYERS.DECORATIVE_OVERLAYS]: '4'
    };
    layerElement.style.zIndex = zIndexMap[layer] || '1';
    
    // Apply styling based on layer and tile value
    if (layer === EDITOR_LAYERS.TERRAIN) {
      // Terrain layer styling
      applyEditorTerrainStyling(layerElement, tileValue);
    } else {
      // Object layer styling
      applyEditorObjectStyling(layerElement, layer, tileValue, worldX, worldY);
    }
    
    tileContainer.appendChild(layerElement);
  }
  
  // Add current layer highlight if editing non-terrain layer and has object on current layer
  if (currentLayer !== EDITOR_LAYERS.TERRAIN) {
    const hasObjectOnCurrentLayer = editorLayers[currentLayer][worldY][worldX] !== null;
    if (hasObjectOnCurrentLayer) {
      tileContainer.classList.add('current-layer-highlight');
    }
  }
}

// Apply terrain styling to editor element
function applyEditorTerrainStyling(element, tileValue) {
  // Ensure terrain elements are always visible as background layers
  element.style.position = 'absolute';
  element.style.left = '0px';
  element.style.top = '0px';
  element.style.width = '100%';
  element.style.height = '100%';
  // DON'T override z-index here - it's set in renderSingleTile
  
  switch (tileValue) {
    case 0: // Grass - show subtle background for objects
      element.className += ' terrain-grass';
      element.style.backgroundColor = '#5a8c3e';
      element.style.backgroundImage = 'radial-gradient(circle at 20% 80%, rgba(90, 140, 62, 0.8) 1px, transparent 2px), radial-gradient(circle at 80% 20%, rgba(90, 140, 62, 0.8) 1px, transparent 2px)';
      element.style.backgroundSize = '8px 8px';
      break;
    case 1: // Rock obstacles
      element.className += ' obstacle';
      element.style.backgroundColor = '#654321';
      element.style.border = '1px solid #543721';
      element.style.backgroundImage = 'radial-gradient(circle at 30% 30%, rgba(101, 67, 33, 0.8) 2px, transparent 3px)';
      break;
    case 2: // Sand terrain
      element.className += ' terrain-sand';
      element.style.backgroundColor = '#F4A460';
      element.style.backgroundImage = 'radial-gradient(circle at 30% 40%, rgba(139, 69, 19, 0.3) 1px, transparent 2px), radial-gradient(circle at 70% 70%, rgba(205, 133, 63, 0.2) 1px, transparent 2px)';
      element.style.backgroundSize = '6px 6px, 10px 10px';
      break;
    case 3: // Water tiles
      element.className += ' water';
      element.style.backgroundColor = '#2196F3';
      element.style.backgroundImage = 'linear-gradient(45deg, rgba(255, 255, 255, 0.1) 25%, transparent 25%, transparent 75%, rgba(255, 255, 255, 0.1) 75%)';
      element.style.backgroundSize = '8px 8px';
      break;
    case 4: // Stone floor
      element.className += ' terrain-stone';
      element.style.backgroundColor = '#A9A9A9';
      element.style.backgroundImage = 'linear-gradient(45deg, rgba(128, 128, 128, 0.3) 25%, transparent 25%, transparent 75%, rgba(169, 169, 169, 0.3) 75%), linear-gradient(-45deg, rgba(105, 105, 105, 0.2) 25%, transparent 25%, transparent 75%, rgba(105, 105, 105, 0.2) 75%)';
      element.style.backgroundSize = '8px 8px, 6px 6px';
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
      element.style.backgroundImage = 'radial-gradient(circle at 25% 25%, rgba(139, 69, 19, 0.4) 1px, transparent 2px), radial-gradient(circle at 75% 75%, rgba(160, 82, 45, 0.3) 1px, transparent 2px)';
      element.style.backgroundSize = '8px 8px, 12px 12px';
      break;
    case 7: // Cobblestone
      element.className += ' terrain-cobblestone';
      element.style.backgroundColor = '#708090';
      element.style.backgroundImage = 'linear-gradient(45deg, rgba(112, 128, 144, 0.3) 25%, transparent 25%, transparent 75%, rgba(105, 105, 105, 0.4) 75%), radial-gradient(circle at 50% 50%, rgba(119, 136, 153, 0.2) 2px, transparent 3px)';
      element.style.backgroundSize = '12px 12px, 8px 8px';
      break;
    case 8: // Wooden floor
      element.className += ' terrain-wooden-floor';
      element.style.backgroundColor = '#D2691E';
      element.style.backgroundImage = 'linear-gradient(90deg, rgba(160, 82, 45, 0.3) 2px, transparent 2px), linear-gradient(0deg, rgba(210, 105, 30, 0.2) 1px, transparent 1px)';
      element.style.backgroundSize = '20px 4px, 4px 20px';
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
    case 57: // Black Void
      element.className += ' terrain-black-void';
      element.style.backgroundColor = '#000000';
      element.style.backgroundImage = 'radial-gradient(circle at 50% 50%, rgba(0, 0, 0, 0.8) 10%, transparent 10%)';
      element.style.backgroundSize = '20px 20px';
      break;
  }
  element.style.boxSizing = 'border-box';
}

// Apply object styling to editor element
function applyEditorObjectStyling(element, layer, tileValue, worldX, worldY) {
  element.className += ' editor-object';
  element.style.display = 'flex';
  element.style.alignItems = 'center';
  element.style.justifyContent = 'center';
  element.style.fontSize = '20px'; // Slightly smaller for editor
  element.style.cursor = 'pointer';
  
  // IMPORTANT: Keep background transparent so terrain shows through
  element.style.backgroundColor = 'transparent';
  
  // Add subtle layer-specific background only on hover for identification
  let layerClass = '';
  let hoverColor = '';
  
  if (layer === EDITOR_LAYERS.GROUND_OBJECTS) {
    layerClass = 'ground-object';
    hoverColor = 'rgba(139, 69, 19, 0.1)'; // Slight brown tint on hover
  } else if (layer === EDITOR_LAYERS.INTERACTIVE_OBJECTS) {
    layerClass = 'interactive-object';
    hoverColor = 'rgba(76, 175, 80, 0.1)'; // Slight green tint on hover
  } else if (layer === EDITOR_LAYERS.DECORATIVE_OVERLAYS) {
    layerClass = 'decorative-overlay';
    hoverColor = 'rgba(156, 39, 176, 0.1)'; // Slight purple tint on hover
  }
  
  if (layerClass) {
    element.classList.add(layerClass);
  }
  
  // Get object definition and display icon
  const tileDef = TILE_DEFINITIONS[tileValue];
  if (tileDef) {
    element.innerHTML = tileDef.icon;
    element.title = `${tileDef.name} (Layer ${layer}: ${EDITOR_LAYER_NAMES[layer]})`;
    
    // Special handling for item spawns
    if (tileValue === 'item_spawn') {
      const spawnKey = `${worldX},${worldY}`;
      const config = itemSpawnConfigs[spawnKey];
      
      if (config) {
        // Show configured item icon and add visual indicator
        const availableItems = getAvailableItemsForSpawn();
        const configuredItem = availableItems.find(item => item.id === config.itemId);
        
        if (configuredItem) {
          element.innerHTML = `
            <div style="position: relative; font-size: 18px;">
              ${configuredItem.icon}
              <div style="position: absolute; top: -2px; right: -2px; background-color: #4CAF50; color: white; border-radius: 50%; width: 8px; height: 8px; font-size: 6px; display: flex; align-items: center; justify-content: center;">●</div>
            </div>
          `;
          element.title = `${tileDef.name}: ${configuredItem.name} x${config.quantity} (${config.respawnTime/1000}s respawn)`;
        }
      } else {
        // Unconfigured item spawn - show with warning indicator
        element.innerHTML = `
          <div style="position: relative; font-size: 18px;">
            📦
            <div style="position: absolute; top: -2px; right: -2px; background-color: #ff9800; color: white; border-radius: 50%; width: 8px; height: 8px; font-size: 6px; display: flex; align-items: center; justify-content: center;">!</div>
          </div>
        `;
        element.title = `${tileDef.name} (Double-click to configure)`;
      }
      
      // Add double-click handler for configuration
      element.addEventListener('dblclick', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log(`Double-clicked item spawn at (${worldX}, ${worldY})`);
        showItemSpawnConfigModal(worldX, worldY);
      });
    }
    
    // Add hover effect with layer-specific background
    element.addEventListener('mouseenter', () => {
      element.style.transform = 'scale(1.1)';
      if (hoverColor) {
        element.style.backgroundColor = hoverColor;
        element.style.borderRadius = '2px';
      }
    });
    
    element.addEventListener('mouseleave', () => {
      element.style.transform = 'scale(1)';
      element.style.backgroundColor = 'transparent';
      element.style.borderRadius = '0';
    });
  }
}

// Start editing a tile
function startTileEdit(e) {
  e.preventDefault();
  isDragging = true;
  editTile(e.target);
}

// Continue editing while dragging
function continueTileEdit(e) {
  if (isDragging) {
    editTile(e.target);
  }
}

// End tile editing
function endTileEdit(e) {
  isDragging = false;
}

// Edit a specific tile
function editTile(tileElement) {
  // Get the tile container (might be the container itself or a child element)
  const tileContainer = tileElement.classList.contains('editor-tile-container') 
    ? tileElement 
    : tileElement.closest('.editor-tile-container');
    
  if (!tileContainer) {
    console.error('Could not find tile container');
    return;
  }
  
  const x = parseInt(tileContainer.dataset.x);
  const y = parseInt(tileContainer.dataset.y);
  
  if (isNaN(x) || isNaN(y)) return;
  
  const tileDef = TILE_DEFINITIONS[selectedTile];
  
  if (selectedTile === 'erase') {
    // Erase mode - clear only object layers, leave terrain unchanged
    for (let layer = 1; layer < editorLayers.length; layer++) { // Start from layer 1 (skip terrain)
      // Check if we're removing an NPC
      const currentTile = editorLayers[layer][y][x];
      if (currentTile && TILE_DEFINITIONS[currentTile] && TILE_DEFINITIONS[currentTile].type === 'npc') {
        const positionKey = `${x},${y}`;
        delete npcSpawnConfigs[positionKey];
        console.log(`Removed NPC from (${x}, ${y})`);
      }
      
      editorLayers[layer][y][x] = null; // Clear object layers only
    }
    
    // Also clear item spawn configs for this position
    const positionKey = `${x},${y}`;
    if (itemSpawnConfigs[positionKey]) {
      delete itemSpawnConfigs[positionKey];
      console.log(`Removed item spawn from (${x}, ${y})`);
    }
  } else if (tileDef) {
    // Place tile on appropriate layer
    const targetLayer = tileDef.layer;
    
    if (targetLayer === EDITOR_LAYERS.TERRAIN) {
      // Terrain placement
      editorLayers[EDITOR_LAYERS.TERRAIN][y][x] = parseInt(selectedTile);
    } else {
      // Object placement - ensure terrain is walkable first
      const currentTerrain = editorLayers[EDITOR_LAYERS.TERRAIN][y][x];
      if (currentTerrain === 1 || currentTerrain === 3 || currentTerrain === 5 || 
          (currentTerrain >= 9 && currentTerrain <= 16) || currentTerrain === 20 ||
          (currentTerrain >= 25 && currentTerrain <= 32)) { // Rock, water, walls, lava, and new walls are non-walkable
        editorLayers[EDITOR_LAYERS.TERRAIN][y][x] = 0; // Set to grass for walkability
      }
      
      // Place object on the target layer
      editorLayers[targetLayer][y][x] = selectedTile;
      
      // Handle special NPC placement
      if (tileDef.type === 'npc') {
        const positionKey = `${x},${y}`;
        let npcType;
        
        if (selectedTile === 'npc_rat') {
          npcType = 'rat';
        } else if (selectedTile === 'npc_cow') {
          npcType = 'cow';
        } else if (selectedTile === 'npc_goblin') {
          npcType = 'goblin';
        }
        
        if (npcType) {
          npcSpawnConfigs[positionKey] = {
            npcType: npcType
          };
          console.log(`Placed NPC ${npcType} at (${x}, ${y})`);
        }
      }
    }
  }
  
  // Always re-render this specific tile to show immediate layer effects
  renderSingleTile(tileContainer, x, y);
  
  console.log(`Edited tile at (${x}, ${y}) - Layer ${currentLayer}: ${selectedTile}`);
  console.log('Current state:', {
    terrain: editorLayers[EDITOR_LAYERS.TERRAIN][y][x],
    ground: editorLayers[EDITOR_LAYERS.GROUND_OBJECTS][y][x],
    interactive: editorLayers[EDITOR_LAYERS.INTERACTIVE_OBJECTS][y][x],
    decorative: editorLayers[EDITOR_LAYERS.DECORATIVE_OVERLAYS][y][x]
  });
}

// Render a single tile with all its layers (used for live editing)
function renderSingleTile(tileContainer, x, y) {
  // Clear existing layer elements
  const existingLayers = tileContainer.querySelectorAll('.editor-layer-element');
  existingLayers.forEach(layer => layer.remove());
  
  // Remove highlight classes
  tileContainer.classList.remove('current-layer-highlight');
  
  console.log(`Rendering single tile (${x}, ${y}) with layers:`, {
    terrain: editorLayers[EDITOR_LAYERS.TERRAIN][y][x],
    ground: editorLayers[EDITOR_LAYERS.GROUND_OBJECTS][y][x],
    interactive: editorLayers[EDITOR_LAYERS.INTERACTIVE_OBJECTS][y][x],
    decorative: editorLayers[EDITOR_LAYERS.DECORATIVE_OVERLAYS][y][x]
  });
  
  // Use the same rendering logic as the main viewport
  renderEditorTileLayers(tileContainer, x, y);
  
  console.log(`Finished rendering single tile (${x}, ${y})`);
}

// Clear the entire map
function clearMap() {
  if (confirm('Are you sure you want to clear the current map level?')) {
    // Reset all layers for current map level
    for (let layer = 0; layer < editorLayers.length; layer++) {
      for (let y = 0; y < EDITOR_WORLD_ROWS; y++) {
        for (let x = 0; x < EDITOR_WORLD_COLS; x++) {
          if (layer === EDITOR_LAYERS.TERRAIN) {
            editorLayers[layer][y][x] = EDITOR_DEFAULT_TERRAIN[currentMapLevel]; // Reset terrain to default for level
          } else {
            editorLayers[layer][y][x] = null; // Clear other layers
          }
        }
      }
    }
    
    // Clear item spawn configurations
    itemSpawnConfigs = {};
    
    // Clear NPC spawn configurations
    npcSpawnConfigs = {};
    
    // Re-render canvas
    renderEditorCanvas();
    
    console.log(`${currentMapLevel} level, item spawns, and NPC spawns cleared`);
  }
}

// Generate a random map
function generateRandomMap() {
  if (confirm(`Generate a new random map for ${currentMapLevel} level? This will replace the current ${currentMapLevel} map.`)) {
    // Clear all layers first
    for (let layer = 0; layer < editorLayers.length; layer++) {
      for (let y = 0; y < EDITOR_WORLD_ROWS; y++) {
        for (let x = 0; x < EDITOR_WORLD_COLS; x++) {
          if (layer === EDITOR_LAYERS.TERRAIN) {
            const rand = Math.random();
            if (currentMapLevel === EDITOR_MAP_LEVELS.SURFACE) {
              // Surface terrain generation
              if (rand < 0.05) {
                editorLayers[layer][y][x] = 1; // Obstacle
              } else if (rand < 0.08) {
                editorLayers[layer][y][x] = 3; // Water
              } else {
                editorLayers[layer][y][x] = 0; // Grass
              }
            } else {
              // Underground terrain generation
              if (rand < 0.02) {
                editorLayers[layer][y][x] = 1; // Obstacle
              } else {
                editorLayers[layer][y][x] = EDITOR_DEFAULT_TERRAIN[EDITOR_MAP_LEVELS.UNDERGROUND]; // Black void
              }
            }
          } else {
            editorLayers[layer][y][x] = null; // Clear other layers
          }
        }
      }
    }
    
    if (currentMapLevel === EDITOR_MAP_LEVELS.SURFACE) {
      // Add a bank near center for surface
      const bankX = 52;
      const bankY = 48;
      editorLayers[EDITOR_LAYERS.TERRAIN][bankY][bankX] = 0; // Ensure walkable
      editorLayers[EDITOR_LAYERS.INTERACTIVE_OBJECTS][bankY][bankX] = 'bank';
      
      // Generate random trees for surface
      for (let i = 0; i < 80; i++) {
        const x = Math.floor(Math.random() * EDITOR_WORLD_COLS);
        const y = Math.floor(Math.random() * EDITOR_WORLD_ROWS);
        
        if (editorLayers[EDITOR_LAYERS.TERRAIN][y][x] === 0 && 
            editorLayers[EDITOR_LAYERS.INTERACTIVE_OBJECTS][y][x] === null) {
          const treeTypes = ['tree_oak', 'tree_pine', 'tree_palm'];
          const randomTree = treeTypes[Math.floor(Math.random() * treeTypes.length)];
          editorLayers[EDITOR_LAYERS.INTERACTIVE_OBJECTS][y][x] = randomTree;
        }
      }
      
      // Generate random surface ores
      for (let i = 0; i < 40; i++) {
        const x = Math.floor(Math.random() * EDITOR_WORLD_COLS);
        const y = Math.floor(Math.random() * EDITOR_WORLD_ROWS);
        
        if (editorLayers[EDITOR_LAYERS.TERRAIN][y][x] === 0 && 
            editorLayers[EDITOR_LAYERS.INTERACTIVE_OBJECTS][y][x] === null) {
          const oreTypes = ['ore_copper', 'ore_tin', 'ore_iron', 'ore_silver'];
          const randomOre = oreTypes[Math.floor(Math.random() * oreTypes.length)];
          editorLayers[EDITOR_LAYERS.INTERACTIVE_OBJECTS][y][x] = randomOre;
        }
      }
      
      // Add ladders to access underground
      const ladderX = 50;
      const ladderY = 50;
      editorLayers[EDITOR_LAYERS.TERRAIN][ladderY][ladderX] = 0; // Ensure walkable
      editorLayers[EDITOR_LAYERS.INTERACTIVE_OBJECTS][ladderY][ladderX] = 'ladder_down';
      
    } else {
      // Underground level generation
      
      // Generate underground ores (more valuable)
      for (let i = 0; i < 60; i++) {
        const x = Math.floor(Math.random() * EDITOR_WORLD_COLS);
        const y = Math.floor(Math.random() * EDITOR_WORLD_ROWS);
        
        if (editorLayers[EDITOR_LAYERS.TERRAIN][y][x] === EDITOR_DEFAULT_TERRAIN[EDITOR_MAP_LEVELS.UNDERGROUND] && 
            editorLayers[EDITOR_LAYERS.INTERACTIVE_OBJECTS][y][x] === null) {
          const oreTypes = ['ore_gold', 'ore_mithril', 'ore_adamantite', 'ore_runite'];
          const randomOre = oreTypes[Math.floor(Math.random() * oreTypes.length)];
          editorLayers[EDITOR_LAYERS.INTERACTIVE_OBJECTS][y][x] = randomOre;
        }
      }
      
      // Add ladder to return to surface
      const ladderX = 50;
      const ladderY = 50;
      editorLayers[EDITOR_LAYERS.TERRAIN][ladderY][ladderX] = EDITOR_DEFAULT_TERRAIN[EDITOR_MAP_LEVELS.UNDERGROUND]; // Ensure walkable
      editorLayers[EDITOR_LAYERS.INTERACTIVE_OBJECTS][ladderY][ladderX] = 'ladder_up';
    }
    
    // Re-render canvas
    renderEditorCanvas();
    
    console.log(`Random ${currentMapLevel} map generated`);
  }
}

// Save map to file
function saveMap() {
  const mapData = {
    version: '3.0', // Updated version for multi-level underground system
    worldCols: EDITOR_WORLD_COLS,
    worldRows: EDITOR_WORLD_ROWS,
    layers: editorMapLevels[EDITOR_MAP_LEVELS.SURFACE].map(layer => layer.map(row => [...row])), // Deep copy surface layers (legacy compatibility)
    mapLevels: {
      [EDITOR_MAP_LEVELS.SURFACE]: editorMapLevels[EDITOR_MAP_LEVELS.SURFACE].map(layer => layer.map(row => [...row])), // Deep copy surface
      [EDITOR_MAP_LEVELS.UNDERGROUND]: editorMapLevels[EDITOR_MAP_LEVELS.UNDERGROUND].map(layer => layer.map(row => [...row])) // Deep copy underground
    },
    itemSpawnConfigs: JSON.parse(JSON.stringify(itemSpawnConfigs)), // Deep copy item spawn configs
    npcSpawnConfigs: JSON.parse(JSON.stringify(npcSpawnConfigs)), // Deep copy NPC spawn configs
    createdAt: new Date().toISOString()
  };
  
  const dataStr = JSON.stringify(mapData, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  
  const link = document.createElement('a');
  link.href = URL.createObjectURL(dataBlob);
  link.download = `webscape-map-layered-${Date.now()}.json`;
  link.click();
  
  console.log('Multi-level map with item spawns and NPCs saved to file');
}

// Generate default underground level for new maps
function generateDefaultUndergroundLevel() {
  const undergroundLayers = [];
  
  // Initialize all 4 layers for underground
  for (let layer = 0; layer < 4; layer++) {
    undergroundLayers[layer] = [];
    for (let y = 0; y < EDITOR_WORLD_ROWS; y++) {
      undergroundLayers[layer][y] = [];
      for (let x = 0; x < EDITOR_WORLD_COLS; x++) {
        if (layer === EDITOR_LAYERS.TERRAIN) {
          undergroundLayers[layer][y][x] = EDITOR_DEFAULT_TERRAIN[EDITOR_MAP_LEVELS.UNDERGROUND]; // Black void
        } else {
          undergroundLayers[layer][y][x] = null; // Other layers start empty
        }
      }
    }
  }
  
  return undergroundLayers;
}

// Load map from file
function loadMapFromFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const mapData = JSON.parse(e.target.result);
      loadMapData(mapData);
    } catch (error) {
      alert('Error loading map file: Invalid JSON format');
      console.error('Map loading error:', error);
    }
  };
  reader.readAsText(file);
}

// Load map data into editor
function loadMapData(mapData) {
  // Update editor dimensions from map data if available
  if (mapData.worldCols && mapData.worldRows) {
    EDITOR_WORLD_COLS = mapData.worldCols;
    EDITOR_WORLD_ROWS = mapData.worldRows;
    console.log(`Updated editor dimensions to ${EDITOR_WORLD_COLS}x${EDITOR_WORLD_ROWS} from map data`);
    
    // Update the UI to reflect new dimensions
    const widthInput = document.getElementById('map-width');
    const heightInput = document.getElementById('map-height');
    if (widthInput) widthInput.value = EDITOR_WORLD_COLS;
    if (heightInput) heightInput.value = EDITOR_WORLD_ROWS;
    updateMapDimensionsDisplay();
  }
  
  if (mapData.version === '3.0' && mapData.mapLevels) {
    // New multi-level format
    console.log('Loading multi-level map format v3.0');
    
    // Load data for each map level
    for (const mapLevel of Object.values(EDITOR_MAP_LEVELS)) {
      if (mapData.mapLevels[mapLevel]) {
        editorMapLevels[mapLevel] = mapData.mapLevels[mapLevel].map(layer => layer.map(row => [...row])); // Deep copy
      } else {
        // Generate default for missing map level
        console.log(`Generating default ${mapLevel} level`);
        editorMapLevels[mapLevel] = generateDefaultUndergroundLevel();
      }
      
      // Ensure all layers exist and have correct dimensions
      while (editorMapLevels[mapLevel].length < 4) {
        editorMapLevels[mapLevel].push([]);
      }
      
      for (let layer = 0; layer < 4; layer++) {
        while (editorMapLevels[mapLevel][layer].length < EDITOR_WORLD_ROWS) {
          editorMapLevels[mapLevel][layer].push(new Array(EDITOR_WORLD_COLS).fill(layer === EDITOR_LAYERS.TERRAIN ? EDITOR_DEFAULT_TERRAIN[mapLevel] : null));
        }
        for (let y = 0; y < EDITOR_WORLD_ROWS; y++) {
          if (!editorMapLevels[mapLevel][layer][y]) editorMapLevels[mapLevel][layer][y] = [];
          while (editorMapLevels[mapLevel][layer][y].length < EDITOR_WORLD_COLS) {
            editorMapLevels[mapLevel][layer][y].push(layer === EDITOR_LAYERS.TERRAIN ? EDITOR_DEFAULT_TERRAIN[mapLevel] : null);
          }
        }
      }
    }
    
    // Load item spawn configurations
    itemSpawnConfigs = mapData.itemSpawnConfigs ? JSON.parse(JSON.stringify(mapData.itemSpawnConfigs)) : {};
    
    // Load NPC spawn configurations
    npcSpawnConfigs = mapData.npcSpawnConfigs ? JSON.parse(JSON.stringify(mapData.npcSpawnConfigs)) : {};
    
    // Point editorLayers to current map level
    editorLayers = editorMapLevels[currentMapLevel];
    
  } else if (mapData.version === '2.2' && mapData.layers) {
    // Legacy single-level layered format with item spawns and NPCs - load as surface only
    console.log('Loading legacy layered map format v2.2 with item spawns and NPCs');
    
    // Load surface level data
    editorMapLevels[EDITOR_MAP_LEVELS.SURFACE] = mapData.layers.map(layer => layer.map(row => [...row])); // Deep copy
    
    // Generate default underground level
    editorMapLevels[EDITOR_MAP_LEVELS.UNDERGROUND] = generateDefaultUndergroundLevel();
    
    // Load item spawn configurations
    itemSpawnConfigs = mapData.itemSpawnConfigs ? JSON.parse(JSON.stringify(mapData.itemSpawnConfigs)) : {};
    
    // Load NPC spawn configurations
    npcSpawnConfigs = mapData.npcSpawnConfigs ? JSON.parse(JSON.stringify(mapData.npcSpawnConfigs)) : {};
    
    // Ensure all layers exist and have correct dimensions for both map levels
    for (const mapLevel of Object.values(EDITOR_MAP_LEVELS)) {
      while (editorMapLevels[mapLevel].length < 4) {
        editorMapLevels[mapLevel].push([]);
      }
      
      for (let layer = 0; layer < 4; layer++) {
        while (editorMapLevels[mapLevel][layer].length < EDITOR_WORLD_ROWS) {
          editorMapLevels[mapLevel][layer].push(new Array(EDITOR_WORLD_COLS).fill(layer === EDITOR_LAYERS.TERRAIN ? EDITOR_DEFAULT_TERRAIN[mapLevel] : null));
        }
        for (let y = 0; y < EDITOR_WORLD_ROWS; y++) {
          if (!editorMapLevels[mapLevel][layer][y]) editorMapLevels[mapLevel][layer][y] = [];
          while (editorMapLevels[mapLevel][layer][y].length < EDITOR_WORLD_COLS) {
            editorMapLevels[mapLevel][layer][y].push(layer === EDITOR_LAYERS.TERRAIN ? EDITOR_DEFAULT_TERRAIN[mapLevel] : null);
          }
        }
      }
    }
    
    // Point editorLayers to current map level
    editorLayers = editorMapLevels[currentMapLevel];
    
  } else if (mapData.version === '2.1' && mapData.layers) {
    // Legacy layered format with item spawns only - load as surface only
    console.log('Loading legacy layered map format v2.1 with item spawns');
    
    // Load surface level data
    editorMapLevels[EDITOR_MAP_LEVELS.SURFACE] = mapData.layers.map(layer => layer.map(row => [...row])); // Deep copy
    
    // Generate default underground level
    editorMapLevels[EDITOR_MAP_LEVELS.UNDERGROUND] = generateDefaultUndergroundLevel();
    
    // Load item spawn configurations
    itemSpawnConfigs = mapData.itemSpawnConfigs ? JSON.parse(JSON.stringify(mapData.itemSpawnConfigs)) : {};
    
    // Initialize empty NPC spawn configs for legacy maps
    npcSpawnConfigs = {};
    
    // Ensure all layers exist and have correct dimensions for both map levels
    for (const mapLevel of Object.values(EDITOR_MAP_LEVELS)) {
      while (editorMapLevels[mapLevel].length < 4) {
        editorMapLevels[mapLevel].push([]);
      }
      
      for (let layer = 0; layer < 4; layer++) {
        while (editorMapLevels[mapLevel][layer].length < EDITOR_WORLD_ROWS) {
          editorMapLevels[mapLevel][layer].push(new Array(EDITOR_WORLD_COLS).fill(layer === EDITOR_LAYERS.TERRAIN ? EDITOR_DEFAULT_TERRAIN[mapLevel] : null));
        }
        for (let y = 0; y < EDITOR_WORLD_ROWS; y++) {
          if (!editorMapLevels[mapLevel][layer][y]) editorMapLevels[mapLevel][layer][y] = [];
          while (editorMapLevels[mapLevel][layer][y].length < EDITOR_WORLD_COLS) {
            editorMapLevels[mapLevel][layer][y].push(layer === EDITOR_LAYERS.TERRAIN ? EDITOR_DEFAULT_TERRAIN[mapLevel] : null);
          }
        }
      }
    }
    
    // Point editorLayers to current map level
    editorLayers = editorMapLevels[currentMapLevel];
    
  } else if (mapData.version === '2.0' && mapData.layers) {
    // Legacy layered format without item spawns - load as surface only
    console.log('Loading legacy layered map format v2.0');
    
    // Load surface level data
    editorMapLevels[EDITOR_MAP_LEVELS.SURFACE] = mapData.layers.map(layer => layer.map(row => [...row])); // Deep copy
    
    // Generate default underground level
    editorMapLevels[EDITOR_MAP_LEVELS.UNDERGROUND] = generateDefaultUndergroundLevel();
    
    // Initialize empty item spawn configs for legacy maps
    itemSpawnConfigs = {};
    
    // Initialize empty NPC spawn configs for legacy maps
    npcSpawnConfigs = {};
    
    // Ensure all layers exist and have correct dimensions for both map levels
    for (const mapLevel of Object.values(EDITOR_MAP_LEVELS)) {
      while (editorMapLevels[mapLevel].length < 4) {
        editorMapLevels[mapLevel].push([]);
      }
      
      for (let layer = 0; layer < 4; layer++) {
        while (editorMapLevels[mapLevel][layer].length < EDITOR_WORLD_ROWS) {
          editorMapLevels[mapLevel][layer].push(new Array(EDITOR_WORLD_COLS).fill(layer === EDITOR_LAYERS.TERRAIN ? EDITOR_DEFAULT_TERRAIN[mapLevel] : null));
        }
        for (let y = 0; y < EDITOR_WORLD_ROWS; y++) {
          if (!editorMapLevels[mapLevel][layer][y]) editorMapLevels[mapLevel][layer][y] = [];
          while (editorMapLevels[mapLevel][layer][y].length < EDITOR_WORLD_COLS) {
            editorMapLevels[mapLevel][layer][y].push(layer === EDITOR_LAYERS.TERRAIN ? EDITOR_DEFAULT_TERRAIN[mapLevel] : null);
          }
        }
      }
    }
    
    // Point editorLayers to current map level
    editorLayers = editorMapLevels[currentMapLevel];
    
  } else if (mapData.grid && mapData.objects) {
    // Legacy format - convert to layered format and load as surface only
    console.log('Loading legacy map format, converting to layers');
    
    // Initialize fresh layers for both map levels
    initializeEditorLayers();
    
    // Load terrain from legacy grid to surface level
    for (let y = 0; y < Math.min(mapData.grid.length, EDITOR_WORLD_ROWS); y++) {
      for (let x = 0; x < Math.min(mapData.grid[y].length, EDITOR_WORLD_COLS); x++) {
        editorMapLevels[EDITOR_MAP_LEVELS.SURFACE][EDITOR_LAYERS.TERRAIN][y][x] = mapData.grid[y][x];
      }
    }
    
    // Convert legacy objects to layers on surface level
    if (mapData.objects && Array.isArray(mapData.objects)) {
      mapData.objects.forEach(obj => {
        if (obj.x >= 0 && obj.x < EDITOR_WORLD_COLS && obj.y >= 0 && obj.y < EDITOR_WORLD_ROWS) {
          // Determine target layer for this object type
          const targetLayer = getEditorObjectLayer(obj.type);
          if (targetLayer !== null) {
            editorMapLevels[EDITOR_MAP_LEVELS.SURFACE][targetLayer][obj.y][obj.x] = obj.type;
          }
        }
      });
    }
    
    // Initialize empty item and NPC spawn configs for legacy maps
    itemSpawnConfigs = {};
    npcSpawnConfigs = {};
    
    // Point editorLayers to current map level
    editorLayers = editorMapLevels[currentMapLevel];
    
  } else {
    alert('Error: Invalid map file format');
    return;
  }
  
  // Re-render canvas
  renderEditorCanvas();
  
  console.log('Map loaded successfully');
  alert('Map loaded successfully!');
}

// Determine which layer an object type should be placed on (editor version)
function getEditorObjectLayer(objectType) {
  const layerMap = {
    // Interactive objects (banks, trees, ores) go on layer 2
    'bank': EDITOR_LAYERS.INTERACTIVE_OBJECTS,
    'shop_general': EDITOR_LAYERS.INTERACTIVE_OBJECTS,
    'shop_weapon': EDITOR_LAYERS.INTERACTIVE_OBJECTS,
    'shop_magic': EDITOR_LAYERS.INTERACTIVE_OBJECTS,
    'shop_mining': EDITOR_LAYERS.INTERACTIVE_OBJECTS,
    'shop_fletching': EDITOR_LAYERS.INTERACTIVE_OBJECTS,
    'shop_fishing': EDITOR_LAYERS.INTERACTIVE_OBJECTS,
    'tree_regular': EDITOR_LAYERS.INTERACTIVE_OBJECTS,
    'tree_oak': EDITOR_LAYERS.INTERACTIVE_OBJECTS,
    'tree_pine': EDITOR_LAYERS.INTERACTIVE_OBJECTS,
    'tree_palm': EDITOR_LAYERS.INTERACTIVE_OBJECTS,
    'ore_copper': EDITOR_LAYERS.INTERACTIVE_OBJECTS,
    'ore_tin': EDITOR_LAYERS.INTERACTIVE_OBJECTS,
    'ore_iron': EDITOR_LAYERS.INTERACTIVE_OBJECTS,
    'ore_silver': EDITOR_LAYERS.INTERACTIVE_OBJECTS,
    'ore_gold': EDITOR_LAYERS.INTERACTIVE_OBJECTS,
    'ore_mithril': EDITOR_LAYERS.INTERACTIVE_OBJECTS,
    'ore_adamantite': EDITOR_LAYERS.INTERACTIVE_OBJECTS,
    'fishing_spot_shrimp': EDITOR_LAYERS.INTERACTIVE_OBJECTS,
    'fishing_spot_sardine': EDITOR_LAYERS.INTERACTIVE_OBJECTS,
    'fishing_spot_herring': EDITOR_LAYERS.INTERACTIVE_OBJECTS,
    'fishing_spot_anchovies': EDITOR_LAYERS.INTERACTIVE_OBJECTS,
    'fishing_spot_tuna': EDITOR_LAYERS.INTERACTIVE_OBJECTS,
    'fishing_spot_lobster': EDITOR_LAYERS.INTERACTIVE_OBJECTS,
    'fishing_spot_swordfish': EDITOR_LAYERS.INTERACTIVE_OBJECTS,
    'fishing_spot_shark': EDITOR_LAYERS.INTERACTIVE_OBJECTS,
    'item_spawn': EDITOR_LAYERS.INTERACTIVE_OBJECTS,
    'pulp_basin': EDITOR_LAYERS.INTERACTIVE_OBJECTS,
    'scribing_table': EDITOR_LAYERS.INTERACTIVE_OBJECTS,
    'cooking_range': EDITOR_LAYERS.INTERACTIVE_OBJECTS,
    
    // NPCs
    'npc_rat': EDITOR_LAYERS.INTERACTIVE_OBJECTS,
    'npc_cow': EDITOR_LAYERS.INTERACTIVE_OBJECTS,
    'npc_goblin': EDITOR_LAYERS.INTERACTIVE_OBJECTS,
    
    // Ground objects would go on layer 1 (none defined yet)
    // Decorative overlays would go on layer 3 (none defined yet)
  };
  
  return layerMap[objectType] || null;
}

// Apply map to the game world
function applyMapToGame() {
  if (confirm('Apply this map to the game world? This will download a new world.json file that you need to replace the existing one with.')) {
    // Generate map data in the same format as world.json
    const worldData = {
      version: '3.0', // Updated version for multi-level underground system
      worldCols: EDITOR_WORLD_COLS,
      worldRows: EDITOR_WORLD_ROWS,
      layers: editorMapLevels[EDITOR_MAP_LEVELS.SURFACE].map(layer => layer.map(row => [...row])), // Deep copy surface layers (legacy compatibility)
      mapLevels: {
        [EDITOR_MAP_LEVELS.SURFACE]: editorMapLevels[EDITOR_MAP_LEVELS.SURFACE].map(layer => layer.map(row => [...row])), // Deep copy surface
        [EDITOR_MAP_LEVELS.UNDERGROUND]: editorMapLevels[EDITOR_MAP_LEVELS.UNDERGROUND].map(layer => layer.map(row => [...row])) // Deep copy underground
      },
      itemSpawnConfigs: JSON.parse(JSON.stringify(itemSpawnConfigs)), // Deep copy item spawn configs
      npcSpawnConfigs: JSON.parse(JSON.stringify(npcSpawnConfigs)), // Deep copy NPC spawn configs
      createdAt: new Date().toISOString()
    };
    
    // Create and download the world.json file
    const dataStr = JSON.stringify(worldData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = 'world.json';
    link.click();
    
    // Also store in localStorage for backward compatibility
    const legacyGameWorldData = {
      grid: editorMapLevels[EDITOR_MAP_LEVELS.SURFACE][EDITOR_LAYERS.TERRAIN].map(row => [...row]), // Deep copy surface terrain layer
      objects: [], // Convert objects back to legacy format
      itemSpawns: JSON.parse(JSON.stringify(itemSpawnConfigs)), // Include item spawn configurations
      npcSpawnConfigs: JSON.parse(JSON.stringify(npcSpawnConfigs)), // Include NPC spawn configurations
      createdAt: new Date().toISOString()
    };
    
    // Extract objects from surface layers and convert to legacy object format for localStorage
    for (let y = 0; y < EDITOR_WORLD_ROWS; y++) {
      for (let x = 0; x < EDITOR_WORLD_COLS; x++) {
        // Check all object layers on surface level
        for (let layer = 1; layer < editorMapLevels[EDITOR_MAP_LEVELS.SURFACE].length; layer++) {
          const objectType = editorMapLevels[EDITOR_MAP_LEVELS.SURFACE][layer][y][x];
          if (objectType && objectType !== null) {
            const tileDef = TILE_DEFINITIONS[objectType];
            if (tileDef) {
              legacyGameWorldData.objects.push({
                type: objectType,
                x: x,
                y: y,
                name: tileDef.name
              });
            }
          }
        }
      }
    }
    
    localStorage.setItem('webscape_custom_map', JSON.stringify(legacyGameWorldData));
    
    // Apply to current game if world module is available
    if (window.worldModule && window.worldModule.loadCustomMap) {
      window.worldModule.loadCustomMap(legacyGameWorldData);
      
      // Send message to server to reload NPCs with new configurations
      if (window.multiplayer && window.multiplayer.sendMessage) {
        window.multiplayer.sendMessage({
          type: 'reload-npcs'
        });
        console.log('🔄 Sent NPC reload request to server');
      }
      
      // Switch to game tab to show the result
      const gameTab = document.querySelector('.tab[data-tab="skills"]');
      if (gameTab) {
        gameTab.click();
      }
      
      alert('New world.json file downloaded! Replace the existing world.json file with the downloaded one and restart the server to apply changes.');
    } else {
      alert('New world.json file downloaded! Replace the existing world.json file with the downloaded one and restart the server to apply changes.');
    }
    
    console.log('World data generated for download:', worldData.layers[0].length * worldData.layers[0][0].length, 'tiles,', Object.keys(itemSpawnConfigs).length, 'item spawns,', Object.keys(npcSpawnConfigs).length, 'NPC spawns');
  }
}

// Check if custom map exists
function hasCustomMap() {
  return localStorage.getItem('webscape_custom_map') !== null;
}

// Get custom map data
function getCustomMap() {
  const mapData = localStorage.getItem('webscape_custom_map');
  return mapData ? JSON.parse(mapData) : null;
}

  // Load existing map data from game or localStorage
function loadExistingMap() {
  // Initialize item spawn configs first
  itemSpawnConfigs = {};
  // Initialize NPC spawn configs first
  npcSpawnConfigs = {};
  console.log('loadExistingMap: Initialized empty item spawn and NPC configs');
  
  // First try to load custom map from localStorage
  const customMapData = localStorage.getItem('webscape_custom_map');
  if (customMapData) {
    try {
      const mapData = JSON.parse(customMapData);
      console.log('Loading custom map from localStorage');
      
      // Update editor dimensions from map data if available
      if (mapData.worldCols && mapData.worldRows) {
        EDITOR_WORLD_COLS = mapData.worldCols;
        EDITOR_WORLD_ROWS = mapData.worldRows;
        console.log(`Updated editor dimensions to ${EDITOR_WORLD_COLS}x${EDITOR_WORLD_ROWS} from map data`);
        updateMapDimensionsDisplay();
      }
      
      // Load item spawn configurations if present
      if (mapData.itemSpawns) {
        itemSpawnConfigs = JSON.parse(JSON.stringify(mapData.itemSpawns)); // Deep copy
        console.log('Loaded item spawn configurations:', Object.keys(itemSpawnConfigs).length, 'spawns');
        console.log('Item spawn configs detail:', itemSpawnConfigs);
      } else {
        console.log('No item spawn configurations found in map data');
      }
      
      // Load NPC spawn configurations if present
      if (mapData.npcSpawnConfigs) {
        npcSpawnConfigs = JSON.parse(JSON.stringify(mapData.npcSpawnConfigs)); // Deep copy
        console.log('Loaded NPC spawn configurations:', Object.keys(npcSpawnConfigs).length, 'spawns');
        console.log('NPC spawn configs detail:', npcSpawnConfigs);
      } else {
        console.log('No NPC spawn configurations found in map data');
      }
      
      // Load custom map data directly without dimension check
      if (mapData.grid && mapData.objects) {
        // Legacy format - load directly
        console.log('Loading legacy custom map format');
        
        // Load terrain from legacy grid
        for (let y = 0; y < Math.min(mapData.grid.length, EDITOR_WORLD_ROWS); y++) {
          for (let x = 0; x < Math.min(mapData.grid[y].length, EDITOR_WORLD_COLS); x++) {
            editorLayers[EDITOR_LAYERS.TERRAIN][y][x] = mapData.grid[y][x];
          }
        }
        
        // Load objects
        if (mapData.objects && Array.isArray(mapData.objects)) {
          mapData.objects.forEach(obj => {
            if (obj.x >= 0 && obj.x < EDITOR_WORLD_COLS && obj.y >= 0 && obj.y < EDITOR_WORLD_ROWS) {
              const targetLayer = getEditorObjectLayer(obj.type);
              if (targetLayer !== null) {
                editorLayers[targetLayer][obj.y][obj.x] = obj.type;
              }
            }
          });
        }
        console.log('Loaded custom map successfully');
        return;
      } else if (mapData.layers) {
        // New layered format - load directly
        console.log('Loading layered custom map format');
        for (let layer = 0; layer < Math.min(mapData.layers.length, editorLayers.length); layer++) {
          for (let y = 0; y < EDITOR_WORLD_ROWS; y++) {
            for (let x = 0; x < EDITOR_WORLD_COLS; x++) {
              if (mapData.layers[layer] && mapData.layers[layer][y] && mapData.layers[layer][y][x] !== undefined) {
                editorLayers[layer][y][x] = mapData.layers[layer][y][x];
              }
            }
          }
        }
        console.log('Loaded layered custom map successfully');
        return;
      }
    } catch (error) {
      console.error('Error loading custom map:', error);
    }
  }
  
  // If no custom map, try to get current game world data
  if (window.worldModule && window.worldModule.worldLayers) {
    console.log('Loading current game world data');
    // Copy the current game world layers
    for (let layer = 0; layer < Math.min(window.worldModule.worldLayers.length, editorLayers.length); layer++) {
      for (let y = 0; y < EDITOR_WORLD_ROWS; y++) {
        for (let x = 0; x < EDITOR_WORLD_COLS; x++) {
          if (window.worldModule.worldLayers[layer] && 
              window.worldModule.worldLayers[layer][y] && 
              window.worldModule.worldLayers[layer][y][x] !== undefined) {
            editorLayers[layer][y][x] = window.worldModule.worldLayers[layer][y][x];
          }
        }
      }
    }
    console.log('Loaded current game world into editor');
  } else if (window.worldModule && window.worldModule.worldGrid) {
    console.log('Loading legacy game world data');
    // Handle legacy single-layer world grid
    for (let y = 0; y < EDITOR_WORLD_ROWS; y++) {
      for (let x = 0; x < EDITOR_WORLD_COLS; x++) {
        if (window.worldModule.worldGrid[y] && window.worldModule.worldGrid[y][x] !== undefined) {
          editorLayers[EDITOR_LAYERS.TERRAIN][y][x] = window.worldModule.worldGrid[y][x];
        }
      }
    }
    
    // Load objects if available
    if (window.worldModule.worldObjects && Array.isArray(window.worldModule.worldObjects)) {
      window.worldModule.worldObjects.forEach(obj => {
        if (obj.x >= 0 && obj.x < EDITOR_WORLD_COLS && obj.y >= 0 && obj.y < EDITOR_WORLD_ROWS) {
          const targetLayer = getEditorObjectLayer(obj.type);
          if (targetLayer !== null) {
            editorLayers[targetLayer][obj.y][obj.x] = obj.type;
          }
        }
      });
    }
    console.log('Loaded legacy game world into editor');
  } else {
    console.log('No existing map data found, starting with default map');
    // Add a bank in the center for basic functionality
    const centerX = Math.floor(EDITOR_WORLD_COLS / 2);
    const centerY = Math.floor(EDITOR_WORLD_ROWS / 2);
    editorLayers[EDITOR_LAYERS.INTERACTIVE_OBJECTS][centerY][centerX] = 'bank';
  }
}

// Show context menu for deleting objects
function showEditorContextMenu(event, x, y) {
  // Remove any existing context menu
  hideEditorContextMenu();
  
  console.log(`Showing editor context menu at (${x}, ${y})`);
  
  const contextMenu = document.createElement('div');
  contextMenu.id = 'editor-context-menu';
  contextMenu.className = 'editor-context-menu';
  
  // Check if this position has an item spawn
  const hasItemSpawn = editorLayers[EDITOR_LAYERS.INTERACTIVE_OBJECTS][y][x] === 'item_spawn';
  
  if (hasItemSpawn) {
    // Add configure option for item spawns
    const configureOption = document.createElement('div');
    configureOption.className = 'editor-context-menu-item';
    configureOption.innerHTML = `<span class="icon" style="color: #4CAF50;">⚙️</span> Configure Item Spawn`;
    
    configureOption.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      console.log(`Configuring item spawn at (${x}, ${y})`);
      showItemSpawnConfigModal(x, y);
      hideEditorContextMenu();
    });
    
    contextMenu.appendChild(configureOption);
  }
  
  // Create delete option
  const deleteOption = document.createElement('div');
  deleteOption.className = 'editor-context-menu-item';
  deleteOption.innerHTML = `<span class="icon" style="color: #dc3545;">🗑️</span> Delete`;
  
  deleteOption.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log(`Deleting content at (${x}, ${y})`);
    
    // If deleting an item spawn, also remove its configuration
    if (hasItemSpawn) {
      const spawnKey = `${x},${y}`;
      delete itemSpawnConfigs[spawnKey];
      console.log(`Removed item spawn configuration for (${x}, ${y})`);
    }
    
    // Clear only object layers at this position, leave terrain unchanged
    for (let layer = 1; layer < editorLayers.length; layer++) { // Start from layer 1 (skip terrain)
      editorLayers[layer][y][x] = null; // Clear object layers only
    }
    
    // Find the tile container and re-render it
    const tileContainer = document.querySelector(`[data-x="${x}"][data-y="${y}"]`);
    if (tileContainer) {
      renderSingleTile(tileContainer, x, y);
    }
    
    console.log(`Deleted objects at (${x}, ${y})`);
    hideEditorContextMenu();
  });
  
  contextMenu.appendChild(deleteOption);
  
  // Position the menu
  contextMenu.style.left = `${event.pageX}px`;
  contextMenu.style.top = `${event.pageY}px`;
  
  document.body.appendChild(contextMenu);
}

// Hide editor context menu
function hideEditorContextMenu() {
  const existingMenu = document.getElementById('editor-context-menu');
  if (existingMenu) {
    existingMenu.remove();
  }
}

// Hide context menu when clicking elsewhere
document.addEventListener('click', (e) => {
  if (!e.target.closest('#editor-context-menu')) {
    hideEditorContextMenu();
  }
});

// Setup navigation controls
function setupNavigationControls() {
  // Navigation button event listeners
  document.getElementById('nav-up')?.addEventListener('click', () => {
    editorCameraPosition.y = Math.max(0, editorCameraPosition.y - canvasScrollSpeed);
    console.log(`Nav Up: Camera moved to (${editorCameraPosition.x}, ${editorCameraPosition.y})`);
    renderEditorCanvas();
  });
  
  document.getElementById('nav-down')?.addEventListener('click', () => {
    editorCameraPosition.y = Math.min(EDITOR_WORLD_ROWS - EDITOR_VIEWPORT_ROWS, editorCameraPosition.y + canvasScrollSpeed);
    console.log(`Nav Down: Camera moved to (${editorCameraPosition.x}, ${editorCameraPosition.y})`);
    renderEditorCanvas();
  });
  
  document.getElementById('nav-left')?.addEventListener('click', () => {
    editorCameraPosition.x = Math.max(0, editorCameraPosition.x - canvasScrollSpeed);
    console.log(`Nav Left: Camera moved to (${editorCameraPosition.x}, ${editorCameraPosition.y})`);
    renderEditorCanvas();
  });
  
  document.getElementById('nav-right')?.addEventListener('click', () => {
    editorCameraPosition.x = Math.min(EDITOR_WORLD_COLS - EDITOR_VIEWPORT_COLS, editorCameraPosition.x + canvasScrollSpeed);
    console.log(`Nav Right: Camera moved to (${editorCameraPosition.x}, ${editorCameraPosition.y})`);
    renderEditorCanvas();
  });
  
  console.log('Navigation controls setup complete');
}

// Setup keyboard navigation (WASD)
function setupKeyboardNavigation() {
  document.addEventListener('keydown', (e) => {
    // Only handle WASD when not typing in input fields
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      return;
    }
    
    switch (e.key.toLowerCase()) {
      case 'w':
        e.preventDefault();
        editorCameraPosition.y = Math.max(0, editorCameraPosition.y - canvasScrollSpeed);
        console.log(`WASD W: Camera moved to (${editorCameraPosition.x}, ${editorCameraPosition.y})`);
        renderEditorCanvas();
        break;
      case 's':
        e.preventDefault();
        editorCameraPosition.y = Math.min(EDITOR_WORLD_ROWS - EDITOR_VIEWPORT_ROWS, editorCameraPosition.y + canvasScrollSpeed);
        console.log(`WASD S: Camera moved to (${editorCameraPosition.x}, ${editorCameraPosition.y})`);
        renderEditorCanvas();
        break;
      case 'a':
        e.preventDefault();
        editorCameraPosition.x = Math.max(0, editorCameraPosition.x - canvasScrollSpeed);
        console.log(`WASD A: Camera moved to (${editorCameraPosition.x}, ${editorCameraPosition.y})`);
        renderEditorCanvas();
        break;
      case 'd':
        e.preventDefault();
        editorCameraPosition.x = Math.min(EDITOR_WORLD_COLS - EDITOR_VIEWPORT_COLS, editorCameraPosition.x + canvasScrollSpeed);
        console.log(`WASD D: Camera moved to (${editorCameraPosition.x}, ${editorCameraPosition.y})`);
        renderEditorCanvas();
        break;
    }
  });
  
  console.log('Keyboard navigation (WASD) setup complete');
}

// Setup map resize controls
function setupMapResizeControls() {
  const resizeBtn = document.getElementById('resize-map');
  const widthInput = document.getElementById('map-width');
  const heightInput = document.getElementById('map-height');
  
  if (!resizeBtn || !widthInput || !heightInput) {
    console.error('Map resize controls not found');
    return;
  }
  
  // Update input values to match current map size
  widthInput.value = EDITOR_WORLD_COLS;
  heightInput.value = EDITOR_WORLD_ROWS;
  
  resizeBtn.addEventListener('click', () => {
    const newWidth = parseInt(widthInput.value);
    const newHeight = parseInt(heightInput.value);
    
    // Validate dimensions
    if (isNaN(newWidth) || isNaN(newHeight) || newWidth < 10 || newHeight < 10 || newWidth > 200 || newHeight > 200) {
      alert('Invalid dimensions. Width and height must be between 10 and 200.');
      return;
    }
    
    if (newWidth === EDITOR_WORLD_COLS && newHeight === EDITOR_WORLD_ROWS) {
      alert('Map size is already set to these dimensions.');
      return;
    }
    
    // Confirm resize operation
    if (!confirm(`Resize map from ${EDITOR_WORLD_COLS}x${EDITOR_WORLD_ROWS} to ${newWidth}x${newHeight}? This may truncate or add new areas.`)) {
      return;
    }
    
    resizeMap(newWidth, newHeight);
  });
  
  console.log('Map resize controls setup complete');
}

// Resize the map to new dimensions
function resizeMap(newWidth, newHeight) {
  console.log(`Resizing map from ${EDITOR_WORLD_COLS}x${EDITOR_WORLD_ROWS} to ${newWidth}x${newHeight}`);
  
  // Create new layer arrays
  const newLayers = [];
  
  for (let layer = 0; layer < editorLayers.length; layer++) {
    newLayers[layer] = [];
    
    for (let y = 0; y < newHeight; y++) {
      newLayers[layer][y] = [];
      
      for (let x = 0; x < newWidth; x++) {
        if (y < EDITOR_WORLD_ROWS && x < EDITOR_WORLD_COLS && editorLayers[layer][y] && editorLayers[layer][y][x] !== undefined) {
          // Copy existing data
          newLayers[layer][y][x] = editorLayers[layer][y][x];
        } else {
          // Fill new areas with default values
          if (layer === EDITOR_LAYERS.TERRAIN) {
            newLayers[layer][y][x] = 0; // Grass
          } else {
            newLayers[layer][y][x] = null; // Empty
          }
        }
      }
    }
  }
  
  // Update dimensions and layers
  EDITOR_WORLD_COLS = newWidth;
  EDITOR_WORLD_ROWS = newHeight;
  editorLayers = newLayers;
  
  // Update the display
  updateMapDimensionsDisplay();
  
  // Re-render the canvas
  renderEditorCanvas();
  
  console.log(`Map resized to ${EDITOR_WORLD_COLS}x${EDITOR_WORLD_ROWS}`);
  alert(`Map resized successfully to ${EDITOR_WORLD_COLS}x${EDITOR_WORLD_ROWS}!`);
}

// Update map dimensions display
function updateMapDimensionsDisplay() {
  const dimensionsSpan = document.getElementById('map-dimensions');
  if (dimensionsSpan) {
    dimensionsSpan.textContent = `${EDITOR_WORLD_COLS}x${EDITOR_WORLD_ROWS}`;
  }
  
  // Update input values
  const widthInput = document.getElementById('map-width');
  const heightInput = document.getElementById('map-height');
  if (widthInput) widthInput.value = EDITOR_WORLD_COLS;
  if (heightInput) heightInput.value = EDITOR_WORLD_ROWS;
}

// Update camera position display
function updateCameraPositionDisplay() {
  const cameraInfo = document.querySelector('.canvas-info');
  if (cameraInfo) {
    cameraInfo.textContent = `Camera: (${editorCameraPosition.x}, ${editorCameraPosition.y}) | World: ${EDITOR_WORLD_COLS}x${EDITOR_WORLD_ROWS}`;
  }
}

// Show item spawn configuration modal
function showItemSpawnConfigModal(x, y) {
  // Remove any existing modal
  hideItemSpawnConfigModal();
  
  console.log(`Showing item spawn config for (${x}, ${y})`);
  
  // Get existing config or create default
  const key = `${x},${y}`;
  const existingConfig = itemSpawnConfigs[key] || {
    itemId: 'coins',
    quantity: 10,
    respawnTime: 30000 // 30 seconds in milliseconds
  };
  
  // Create modal backdrop
  const backdrop = document.createElement('div');
  backdrop.id = 'item-spawn-modal-backdrop';
  backdrop.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background-color: rgba(0, 0, 0, 0.7);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  
  // Create modal content
  const modal = document.createElement('div');
  modal.id = 'item-spawn-modal';
  modal.style.cssText = `
    background-color: #2a2a2a;
    border: 2px solid #8b6f47;
    border-radius: 8px;
    padding: 20px;
    min-width: 400px;
    max-width: 500px;
    color: #ffffff;
    font-family: 'Verdana', sans-serif;
  `;
  
  // Get available items from inventory module
  const availableItems = getAvailableItemsForSpawn();
  
  modal.innerHTML = `
    <h3 style="color: #ffd700; margin-bottom: 20px; text-align: center;">
      Configure Item Spawn (${x}, ${y})
    </h3>
    
    <div style="margin-bottom: 15px;">
      <label style="display: block; margin-bottom: 5px; color: #cccccc;">Item Type:</label>
      <select id="spawn-item-select" style="width: 100%; padding: 8px; background-color: #444; color: white; border: 1px solid #666; border-radius: 4px;">
        ${availableItems.map(item => 
          `<option value="${item.id}" ${item.id === existingConfig.itemId ? 'selected' : ''}>
            ${item.icon} ${item.name}
          </option>`
        ).join('')}
      </select>
    </div>
    
    <div style="margin-bottom: 15px;">
      <label style="display: block; margin-bottom: 5px; color: #cccccc;">Quantity:</label>
      <input type="number" id="spawn-quantity-input" min="1" max="10000" value="${existingConfig.quantity}" 
             style="width: 100%; padding: 8px; background-color: #444; color: white; border: 1px solid #666; border-radius: 4px;">
    </div>
    
    <div style="margin-bottom: 20px;">
      <label style="display: block; margin-bottom: 5px; color: #cccccc;">Respawn Time (seconds):</label>
      <input type="number" id="spawn-respawn-input" min="1" max="3600" value="${existingConfig.respawnTime / 1000}" 
             style="width: 100%; padding: 8px; background-color: #444; color: white; border: 1px solid #666; border-radius: 4px;">
      <small style="color: #999;">Time before item respawns after being picked up</small>
    </div>
    
    <div style="display: flex; gap: 10px; justify-content: center;">
      <button id="spawn-config-save" style="padding: 10px 20px; background-color: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">
        Save
      </button>
      <button id="spawn-config-cancel" style="padding: 10px 20px; background-color: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">
        Cancel
      </button>
      <button id="spawn-config-remove" style="padding: 10px 20px; background-color: #ff9800; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">
        Remove Spawn
      </button>
    </div>
  `;
  
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);
  
  // Add event listeners
  document.getElementById('spawn-config-save').addEventListener('click', () => {
    const itemId = document.getElementById('spawn-item-select').value;
    const quantity = parseInt(document.getElementById('spawn-quantity-input').value);
    const respawnTime = parseInt(document.getElementById('spawn-respawn-input').value) * 1000; // Convert to milliseconds
    
    if (quantity > 0 && respawnTime > 0) {
      itemSpawnConfigs[key] = {
        itemId: itemId,
        quantity: quantity,
        respawnTime: respawnTime,
        lastPickupTime: null // No pickup yet
      };
      
      console.log(`Saved item spawn config for (${x}, ${y}):`, itemSpawnConfigs[key]);
      hideItemSpawnConfigModal();
    } else {
      alert('Please enter valid values for quantity and respawn time.');
    }
  });
  
  document.getElementById('spawn-config-cancel').addEventListener('click', () => {
    hideItemSpawnConfigModal();
  });
  
  document.getElementById('spawn-config-remove').addEventListener('click', () => {
    if (confirm('Remove this item spawn configuration?')) {
      delete itemSpawnConfigs[key];
      
      // Also remove the item spawn tile from the layer
      editorLayers[EDITOR_LAYERS.INTERACTIVE_OBJECTS][y][x] = null;
      
      // Re-render the affected tile
      const tileContainer = document.querySelector(`[data-x="${x}"][data-y="${y}"]`);
      if (tileContainer) {
        renderSingleTile(tileContainer, x, y);
      }
      
      console.log(`Removed item spawn at (${x}, ${y})`);
      hideItemSpawnConfigModal();
    }
  });
  
  // Close modal when clicking backdrop
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) {
      hideItemSpawnConfigModal();
    }
  });
}

// Hide item spawn configuration modal
function hideItemSpawnConfigModal() {
  const backdrop = document.getElementById('item-spawn-modal-backdrop');
  if (backdrop) {
    backdrop.remove();
  }
}

// Get available items for spawn configuration
function getAvailableItemsForSpawn() {
  // Basic set of spawnable items - can be expanded
  return [
    { id: 'coins', name: 'Coins', icon: '🪙' },
    { id: 'apple', name: 'Apple', icon: '🍎' },
    { id: 'bread', name: 'Bread', icon: '🍞' },
    { id: 'fish', name: 'Fish', icon: '🐟' },
    { id: 'meat', name: 'Meat', icon: '🥩' },
    { id: 'mushroom', name: 'Mushroom', icon: '🍄' },
    { id: 'potion', name: 'Potion', icon: '🧪' },
    { id: 'sword', name: 'Sword', icon: '⚔️' },
    { id: 'shield', name: 'Shield', icon: '🛡️' },
    { id: 'bow', name: 'Bow', icon: '🏹' },
    { id: 'staff', name: 'Staff', icon: '🪄' },
    { id: 'book', name: 'Book', icon: '📖' },
    { id: 'key', name: 'Key', icon: '🗝️' },
    { id: 'gem', name: 'Gem', icon: '💎' },
    { id: 'ruby', name: 'Ruby', icon: '🔴' },
    { id: 'sapphire', name: 'Sapphire', icon: '🔵' },
    { id: 'emerald', name: 'Emerald', icon: '🟢' },
    { id: 'diamond', name: 'Diamond', icon: '💎' },
    { id: 'ring', name: 'Ring', icon: '💍' },
    { id: 'scroll', name: 'Scroll', icon: '📜' }
  ];
}

// Export functions
export {
  initializeMapEditor,
  hasCustomMap,
  getCustomMap
}; 