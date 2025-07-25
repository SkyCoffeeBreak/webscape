/**
 * Inventory module for WebscapeRPG
 * Handles item spawning, inventory management, and item interactions
 */

// Inventory configuration
const INVENTORY_SIZE = 40; // 5 columns x 8 rows
const ITEM_SPAWN_INTERVAL = 5000; // 5 seconds (reduced for testing)
const MAX_FLOOR_ITEMS = 20;
const ITEM_DESPAWN_TIME = 300000; // 5 minutes

// Player inventory
let playerInventory = new Array(INVENTORY_SIZE).fill(null);

// Bank storage - larger capacity with all items stackable
const BANK_SIZE = 500; // Large bank capacity like OSRS
let bankStorage = new Array(BANK_SIZE).fill(null);

// Bank interface state
const bankInterface = {
  open: false,
  selectedSlot: -1,
  selectedItem: null,
  currentTab: 0, // 0 = All tab
  searchTerm: ''
};

// Expose bank interface globally for other modules
window.bankInterface = bankInterface;

// OSRS-style bank tabs - each tab can contain items
const BANK_TABS = 10; // Number of available tabs (0-9)
let bankTabs = [];

// Initialize bank tabs
for (let i = 0; i < BANK_TABS; i++) {
  bankTabs.push({
    id: i,
    name: i === 0 ? 'All' : `Tab ${i + 1}`,
    icon: i === 0 ? '📦' : '🎒', // Default icons
    items: new Array(BANK_SIZE).fill(null) // Each tab has its own storage
  });
}

// Available tab icons for customization
const TAB_ICONS = [
  // Basic/General icons (more medieval/fantasy style)
  '📦', '⚡', '💼', '🎒', '📚', '🗃️', 
  
  // Combat Skills
  '⚔️', '🛡️', '🏹', '🪄', '🔮', '💀', '🙏', '⚰️',
  
  // Gathering Skills  
  '⛏️', '🎣', '🪓', '🌾',
  
  // Artisan Skills
  '🔨', '🍖', '🏹', '🧪', '✂️', '🦴', '🎨', '🍺',
  '🪬', '🍬', '🧱', '🧵',
  
  // Support Skills
  '💰', '⚗️', '🔧', '📦', '🐄', '📜', '🕯️', '🏺',
  
  // Additional fantasy/medieval icons
  '💎', '🔥', '❄️', '🌊', '🌟', '☀️', '🌙', '👑', 
  '🗝️', '🏰', '⚰️', '💀', '🦴', '🌿', '🍄', '🌸',
  '⭐', '💫', '✨', '🔆', '🌈', '🎯', '🎪', '🎭'
];

/**
 * Format large numbers for compact display
 * @param {number} num - The number to format
 * @returns {string} - Formatted string (e.g., "150k", "1000k", "10m", "1.5b")
 */
function formatCompactNumber(num) {
  console.log('[INVENTORY.JS] formatCompactNumber called with:', num);
  if (num < 1000) {
    return num.toString();
  } else if (num < 10000000) {  // Changed from 1000000 to 10000000 (10m threshold)
    // Thousands (k) - now goes up to 9999k
    const thousands = num / 1000;
    if (thousands === Math.floor(thousands)) {
      return thousands + 'k';
    } else if (thousands < 10) {
      return (Math.round(thousands * 10) / 10) + 'k'; // 1 decimal place for < 10k
    } else {
      return Math.floor(thousands) + 'k';
    }
  } else if (num < 10000000000) {
    // Millions (m) - now starts at 10m
    const millions = num / 1000000;
    if (millions === Math.floor(millions)) {
      return millions + 'm';
    } else if (millions < 100) {  // More precision for smaller millions
      return (Math.round(millions * 10) / 10) + 'm'; // 1 decimal place for < 100m
    } else {
      return Math.floor(millions) + 'm';
    }
  } else {
    // Billions (b)
    const billions = num / 1000000000;
    if (billions === Math.floor(billions)) {
      return billions + 'b';
    } else if (billions < 10) {
      return (Math.round(billions * 10) / 10) + 'b'; // 1 decimal place for < 10b
    } else {
      return Math.floor(billions) + 'b';
    }
  }
}

/**
 * Get the appropriate text color for quantity based on value thresholds
 * @param {number} quantity - The quantity to check
 * @returns {string} - CSS color value
 */
function getQuantityColor(quantity) {
  console.log('[INVENTORY.JS] getQuantityColor called with:', quantity);
  if (quantity >= 1000000000) {  // 1b+
    return '#ff54c9';  // Bright pink
  } else if (quantity >= 10000000) {  // 10m+
    return '#00ff00';  // Bright green
  } else if (quantity >= 100000) {  // 100k+
    return '#ffffff';  // White
  } else {
    return '#f1c40f';  // Default yellow/gold
  }
}

/**
 * Format numbers with commas for detailed display (tooltips, etc.)
 * @param {number} num - The number to format
 * @returns {string} - Formatted string with commas (e.g., "1,234,567")
 */
function formatNumberWithCommas(num) {
  console.log('[INVENTORY.JS] formatNumberWithCommas called with:', num);
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Floor items array
let floorItems = [];

// Item spawning timer
let itemSpawnTimer = null;

// Use mode state - for OSRS-style item usage
let useMode = {
  active: false,
  selectedSlot: -1,
  selectedItem: null
};

// Drag and drop state
let dragState = {
  active: false,
  draggedSlot: -1,
  draggedItem: null,
  dragElement: null,
  startX: 0,
  startY: 0
};

// Item definitions have been moved to shared/itemDefinitions.js
// This ensures consistency between client and server and eliminates duplication
// The getItemDefinition() function below will use the shared definitions as the primary source
  

// Item combination recipes (OSRS style crafting/combinations)
const itemCombinations = {
  // Format: "item1_id+item2_id": { result, requiresBoth, consumeSource, consumeTarget, message }
  "chisel+uncut_gem": {
    result: { id: "gem", quantity: 1 },
    requiresBoth: true,
    consumeSource: false,
    consumeTarget: true,
    message: "You carefully cut the uncut ruby with the chisel, creating a beautiful gem!"
  },
  "chisel+uncut_sapphire": {
    result: { id: "sapphire", quantity: 1 },
    requiresBoth: true,
    consumeSource: false,
    consumeTarget: true,
    message: "You skillfully cut the uncut sapphire with the chisel, revealing its brilliant blue color!"
  },
  "chisel+uncut_emerald": {
    result: { id: "emerald", quantity: 1 },
    requiresBoth: true,
    consumeSource: false,
    consumeTarget: true,
    message: "You expertly cut the uncut emerald with the chisel, bringing out its vibrant green shine!"
  },
  "chisel+uncut_diamond": {
    result: { id: "diamond", quantity: 1 },
    requiresBoth: true,
    consumeSource: false,
    consumeTarget: true,
    message: "You meticulously cut the uncut diamond with the chisel, creating a flawless crystal!"
  },
  "gem+key": {
    result: null,
    requiresBoth: false,
    consumeSource: false,
    consumeTarget: false,
    message: "The ruby glows faintly when held near the key, but nothing happens."
  },
  "sapphire+key": {
    result: null,
    requiresBoth: false,
    consumeSource: false,
    consumeTarget: false,
    message: "The sapphire pulses with a cool blue light near the key, but nothing occurs."
  },
  "emerald+key": {
    result: null,
    requiresBoth: false,
    consumeSource: false,
    consumeTarget: false,
    message: "The emerald shimmers with green energy near the key, but remains inert."
  },
  "diamond+key": {
    result: null,
    requiresBoth: false,
    consumeSource: false,
    consumeTarget: false,
    message: "The diamond refracts the light beautifully near the key, but nothing magical happens."
  },
  "apple+mushroom": {
    result: { id: "potion", quantity: 1 },
    requiresBoth: true,
    consumeSource: true,
    consumeTarget: true,
    message: "You combine the apple and mushroom to create a makeshift potion."
  },
  "coins+book": {
    result: null,
    requiresBoth: false,
    consumeSource: false,
    consumeTarget: false,
    message: "You can't buy knowledge with coins... or can you?"
  },
  "sword+potion": {
    result: null,
    requiresBoth: false,
    consumeSource: false,
    consumeTarget: false,
    message: "You dip the sword in the potion, but nothing happens."
  },
  "key+book": {
    result: null,
    requiresBoth: false,
    consumeSource: false,
    consumeTarget: false,
    message: "The key doesn't fit in the book's lock... wait, this book doesn't have a lock!"
  }
};

// Shop system definitions
const shopDefinitions = {
  general_store: {
    id: 'general_store',
    name: "Lumbridge General Store",
    keeper: "Shop Assistant", 
    description: "We've got what you need!",
    icon: '🏪',
    type: 'general', // general, specialty, or zero_stock
    sellMultiplier: 0.6, // Increased from 0.4 to 0.6 (60% of value)
    buyMultiplier: 1.0, // Buys items at 100% of value
    priceChangeRate: 0.03, // 3% price change per stock level
    restockInterval: 30000, // 30 seconds
    destockInterval: 60000, // 60 seconds for removing excess items
    maxPurchaseQuantity: 50, // Max items that can be bought at once
    acceptsAllItems: true, // General stores accept ALL items
    defaultStock: {
      // Format: itemId: { quantity, maxQuantity, restockRate }
      'coins': { quantity: 0, maxQuantity: 0, restockRate: 0 }, // Always accepts coins
      'apple': { quantity: 5, maxQuantity: 10, restockRate: 1 },
      'potion': { quantity: 3, maxQuantity: 5, restockRate: 1 },
      'book': { quantity: 2, maxQuantity: 3, restockRate: 1 },
      'meat': { quantity: 0, maxQuantity: 50, restockRate: 0 }, // Accept cooked meat
      'bread': { quantity: 0, maxQuantity: 20, restockRate: 0 }, // Accept bread
      'rope': { quantity: 0, maxQuantity: 10, restockRate: 0 }, // Accept rope
      'tinderbox': { quantity: 0, maxQuantity: 5, restockRate: 0 } // Accept tinderbox
    }
  },
  
  weapon_shop: {
    id: 'weapon_shop',
    name: "Bob's Brilliant Axes",
    keeper: "Bob",
    description: "Finest weapons in the land!",
    icon: '⚔️',
    type: 'specialty',
    sellMultiplier: 0.75, // Increased from 0.6 to 0.75 (75% of value) - specialty shops pay more
    buyMultiplier: 1.0,
    priceChangeRate: 0.02, // 2% price change per stock level
    restockInterval: 45000, // 45 seconds
    destockInterval: 90000,
    maxPurchaseQuantity: 10,
    defaultStock: {
      'coins': { quantity: 0, maxQuantity: 0, restockRate: 0 },
      'sword': { quantity: 3, maxQuantity: 5, restockRate: 1 },
      'bronze_axe': { quantity: 5, maxQuantity: 8, restockRate: 2 },
      'iron_axe': { quantity: 3, maxQuantity: 5, restockRate: 1 },
      'steel_axe': { quantity: 1, maxQuantity: 3, restockRate: 1 },
      // Digging shovels
      'bronze_shovel': { quantity: 5, maxQuantity: 8, restockRate: 2 },
      'iron_shovel': { quantity: 3, maxQuantity: 5, restockRate: 1 },
      'steel_shovel': { quantity: 1, maxQuantity: 3, restockRate: 1 },
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
      'oak_log': { quantity: 0, maxQuantity: 30, restockRate: 0 },
      // Digging materials (small starting quantities)
      'dirt': { quantity: 0, maxQuantity: 25, restockRate: 0 },
      'sand': { quantity: 0, maxQuantity: 20, restockRate: 0 }
    }
  },
  
  gem_trader: {
    id: 'gem_trader',
    name: "Grum's Gold Exchange",
    keeper: "Grum",
    description: "I deal in precious stones and metals.",
    icon: '💎',
    type: 'zero_stock', // Only has items when players sell to them
    sellMultiplier: 0.9, // Increased from 0.8 to 0.9 (90% of value) - gem trader pays very well
    buyMultiplier: 1.2, // Expensive to buy back
    priceChangeRate: 0.05, // 5% price change
    restockInterval: 0, // No restocking
    destockInterval: 120000, // 2 minutes to remove excess
    maxPurchaseQuantity: 10,
    defaultStock: {
      'coins': { quantity: 0, maxQuantity: 0, restockRate: 0 },
      'gem': { quantity: 0, maxQuantity: 0, restockRate: 0 },
      'sapphire': { quantity: 0, maxQuantity: 0, restockRate: 0 },
      'emerald': { quantity: 0, maxQuantity: 0, restockRate: 0 },
      'diamond': { quantity: 0, maxQuantity: 0, restockRate: 0 },
      'uncut_gem': { quantity: 0, maxQuantity: 0, restockRate: 0 },
      'uncut_sapphire': { quantity: 0, maxQuantity: 0, restockRate: 0 },
      'uncut_emerald': { quantity: 0, maxQuantity: 0, restockRate: 0 },
      'uncut_diamond': { quantity: 0, maxQuantity: 0, restockRate: 0 }
    }
  },
  
  unlimited_food: {
    id: 'unlimited_food',
    name: "The Green Grocer",
    keeper: "Greengrocer",
    description: "Fresh food, unlimited supply!",
    icon: '🍎',
    type: 'unlimited',
    sellMultiplier: 0.4, // Increased from 0.3 to 0.4 (40% of value)
    buyMultiplier: 1.0,
    priceChangeRate: 0, // No price changes for unlimited shops
    restockInterval: 0, // Infinite stock
    destockInterval: 0,
    maxPurchaseQuantity: 10, // Limited purchase quantity
    acceptsOnlyDefaultStock: true, // NEW: Unlimited shops only buy items in their default stock
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
    sellMultiplier: 0.8, // Magic shops pay well for magical items (80% of value)
    buyMultiplier: 1.3, // Magic items are expensive to buy back
    priceChangeRate: 0.04, // 4% price change per stock level
    restockInterval: 60000, // 60 seconds
    destockInterval: 120000, // 2 minutes
    maxPurchaseQuantity: 5, // Limited quantities for magical items
    acceptsOnlyDefaultStock: true, // Only accepts magical items
    defaultStock: {
      'coins': { quantity: 0, maxQuantity: 0, restockRate: 0 },
      'potion': { quantity: 8, maxQuantity: 15, restockRate: 2 }, // Magic/health potions
      'book': { quantity: 5, maxQuantity: 8, restockRate: 1 }, // Spell books
      'gem': { quantity: 2, maxQuantity: 4, restockRate: 1 }, // Magical gems
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
    sellMultiplier: 0.7, // Mining shops pay decent for mining-related items (70% of value)
    buyMultiplier: 1.2, // Mining tools and materials cost more to buy back
    priceChangeRate: 0.03, // 3% price change per stock level
    restockInterval: 45000, // 45 seconds
    destockInterval: 90000, // 90 seconds
    maxPurchaseQuantity: 20, // Can buy larger quantities of ores
    acceptsOnlyDefaultStock: true, // Only accepts mining-related items
    defaultStock: {
      'coins': { quantity: 0, maxQuantity: 0, restockRate: 0 },
      'chisel': { quantity: 3, maxQuantity: 5, restockRate: 1 }, // Mining tools
      // Ores
      'coal': { quantity: 15, maxQuantity: 25, restockRate: 3 },
      'iron_ore': { quantity: 10, maxQuantity: 20, restockRate: 2 },
      'copper_ore': { quantity: 12, maxQuantity: 25, restockRate: 3 },
      'tin_ore': { quantity: 12, maxQuantity: 25, restockRate: 3 },
      'silver_ore': { quantity: 5, maxQuantity: 10, restockRate: 1 },
      'gold_ore': { quantity: 3, maxQuantity: 8, restockRate: 1 },
      'mithril_ore': { quantity: 2, maxQuantity: 5, restockRate: 1 },
      'adamantite_ore': { quantity: 1, maxQuantity: 3, restockRate: 1 },
      // Bars
      'bronze_bar': { quantity: 8, maxQuantity: 15, restockRate: 2 },
      'iron_bar': { quantity: 5, maxQuantity: 12, restockRate: 1 },
      'steel_bar': { quantity: 3, maxQuantity: 8, restockRate: 1 },
      'mithril_bar': { quantity: 1, maxQuantity: 3, restockRate: 1 }
    }
  },

  fletching_shop: {
    id: 'fletching_shop',
    name: 'The Bow String',
    keeper: 'Fletcher Frank',
    description: 'Quality bows and arrows',
    icon: '🏹',
    type: 'specialty',
    sellMultiplier: 0.75,
    buyMultiplier: 1.1,
    priceChangeRate: 0.05,
    restockInterval: 45000,
    destockInterval: 90000,
    maxPurchaseQuantity: 25,
    acceptedCategories: ['ranged', 'tools', 'logs'],
    defaultStock: {
      'bronze_knife': { quantity: 10, maxQuantity: 15, restockRate: 3 },
      'iron_knife': { quantity: 8, maxQuantity: 12, restockRate: 2 },
      'steel_knife': { quantity: 5, maxQuantity: 8, restockRate: 1 },
      'shortbow': { quantity: 6, maxQuantity: 10, restockRate: 2 },
      'longbow': { quantity: 4, maxQuantity: 8, restockRate: 1 },
      'oak_shortbow': { quantity: 3, maxQuantity: 6, restockRate: 1 },
      'oak_longbow': { quantity: 2, maxQuantity: 4, restockRate: 1 },
      'willow_shortbow': { quantity: 1, maxQuantity: 3, restockRate: 1 },
      'willow_longbow': { quantity: 1, maxQuantity: 2, restockRate: 1 }
    }
  },
  
  fishing_shop: {
    id: 'fishing_shop',
    name: 'The Fishing Spot',
    keeper: 'Fisherman Pete',
    description: 'All your fishing needs in one place',
    icon: '🎣',
    type: 'specialty',
    sellMultiplier: 0.75,
    buyMultiplier: 1.1,
    priceChangeRate: 0.05,
    restockInterval: 45000,
    destockInterval: 90000,
    maxPurchaseQuantity: 25,
    acceptedCategories: ['fishing', 'fish', 'tools'],
    defaultStock: {
      'small_net': { quantity: 15, maxQuantity: 20, restockRate: 3 },
      'fishing_rod': { quantity: 12, maxQuantity: 18, restockRate: 2 },
      'big_net': { quantity: 8, maxQuantity: 12, restockRate: 2 },
      'harpoon': { quantity: 5, maxQuantity: 8, restockRate: 1 },
      'lobster_pot': { quantity: 4, maxQuantity: 6, restockRate: 1 },
      'raw_shrimps': { quantity: 20, maxQuantity: 30, restockRate: 5 },
      'raw_sardine': { quantity: 15, maxQuantity: 25, restockRate: 3 },
      'raw_herring': { quantity: 12, maxQuantity: 20, restockRate: 3 }
    }
  }
};

// Active shops - stores current state of all shops
let activeShops = {};

// Initialize shops
function initializeShops() {
  console.log('Initializing shop system...');
  
  // Create instances of all shops
  for (const shopId in shopDefinitions) {
    const shopDef = shopDefinitions[shopId];
    activeShops[shopId] = {
      ...shopDef,
      currentStock: { ...shopDef.defaultStock },
      lastRestockTime: Date.now(),
      lastDestockTime: Date.now()
    };
    
    // Deep clone the stock to avoid reference issues
    for (const itemId in shopDef.defaultStock) {
      activeShops[shopId].currentStock[itemId] = { ...shopDef.defaultStock[itemId] };
    }
  }
  
  // Start shop update cycles
  startShopUpdateCycle();
  
  console.log('Shop system initialized with', Object.keys(activeShops).length, 'shops');
}

// Initialize inventory system
function initializeInventory() {
  console.log('Initializing inventory system...');
  
  // Create inventory UI
  createInventoryUI();
  
  // Initialize shops
  initializeShops();
  
  // Start item spawning - DISABLED to prevent random item clutter
  // startItemSpawning();
  
  // Add click handlers for floor items
  setupFloorItemHandlers();
  
  // Initialize equipment display
  setTimeout(() => updateEquipmentDisplay(), 100);
  
  return true;
}

// Create the inventory UI
function createInventoryUI() {
  const inventoryTab = document.getElementById('inventory-tab');
  if (!inventoryTab) return;
  
  inventoryTab.innerHTML = `
    <h2>Inventory</h2>
    <div class="inventory-container">
      <div class="inventory-grid" id="inventory-grid">
        ${Array(INVENTORY_SIZE).fill().map((_, i) => 
          `<div class="inventory-slot" data-slot="${i}"></div>`
        ).join('')}
      </div>
      <div class="inventory-info">
        <div class="inventory-count">
          Items: <span id="inventory-count">0</span>/${INVENTORY_SIZE}
        </div>
      </div>
    </div>
    
    <!-- Context menu for inventory items -->
    <div class="context-menu" id="inventory-context-menu" style="display: none;">
      <div class="context-menu-item" data-action="consume" id="consume-option" style="display: none;">Eat/Drink</div>
      <div class="context-menu-item" data-action="use">Use</div>
      <div class="context-menu-item" data-action="drop">Drop</div>
    </div>
  `;
  
  // Add CSS styles for inventory
  addInventoryStyles();
  
  // Setup inventory event handlers
  setupInventoryHandlers();
  
  // Debug/test buttons removed
  
  // Add shop test buttons
  addShopTestButtons();
}

// Add CSS styles for the inventory system
function addInventoryStyles() {
  if (document.getElementById('inventory-styles')) return;
  
  const styleSheet = document.createElement('style');
  styleSheet.id = 'inventory-styles';
  styleSheet.textContent = `
    .inventory-container {
      display: flex;
      flex-direction: column;
      gap: 15px;
      padding: 10px;
    }
    
    .inventory-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      grid-template-rows: repeat(8, 1fr);
      gap: 1px;
      background-color: #2a2a2a;
      padding: 3px;
      border-radius: 5px;
      width: fit-content;
      margin: 0 auto;
    }
    
    .inventory-slot {
      width: 63px;
      height: 63px;
      background-color: #3a3a3a;
      border: 1px solid #555;
      border-radius: 3px;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      cursor: pointer;
      transition: background-color 0.2s;
    }
    
    .inventory-slot:hover {
      background-color: #4a4a4a;
    }
    
    .inventory-slot.occupied {
      background-color: #2d4a3d;
      border-color: #4a7c59;
    }
    
    .inventory-slot.use-mode {
      background-color: #4a3d2d !important;
      border-color: #7c5a49 !important;
      box-shadow: 0 0 8px rgba(255, 165, 0, 0.6);
    }
    
    .inventory-slot.use-target {
      cursor: crosshair !important;
    }
    
    .inventory-slot.drag-source {
      opacity: 0.5;
      background-color: #4a4a2d !important;
      border-color: #7c7c59 !important;
    }
    
    .inventory-slot.drag-target {
      background-color: #2d4a4a !important;
      border-color: #4a7c7c !important;
      box-shadow: 0 0 8px rgba(74, 124, 124, 0.6);
    }
    
    .drag-preview {
      position: fixed;
      width: 63px;
      height: 63px;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      z-index: 10000;
      opacity: 0.5;
      background-color: #3a3a3a;
      border: 1px solid #555;
      border-radius: 3px;
      transition: none;
      transform: translate(-50%, -50%);
    }
    
    .inventory-item {
      font-size: 28px;
      user-select: none;
      position: relative;
    }
    
    .inventory-item-count {
      position: absolute;
      bottom: -9px;
      right: -6px;
      font-size: 12px;
      font-weight: bold;
      text-shadow: 
        -1px -1px 0 #000,
        1px -1px 0 #000,
        -1px 1px 0 #000,
        1px 1px 0 #000,
        0 -1px 0 #000,
        0 1px 0 #000,
        -1px 0 0 #000,
        1px 0 0 #000;
    }
    
    .inventory-info {
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: #ccc;
      font-size: 14px;
    }
    
    .floor-item {
      position: absolute;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      cursor: pointer;
      z-index: 3;
      background-color: rgba(0, 0, 0, 0.3);
      border-radius: 4px;
      transition: transform 0.2s;
    }
    
    .floor-item:hover {
      transform: scale(1.1);
      background-color: rgba(255, 255, 255, 0.2);
    }
    
    .context-menu {
      position: fixed;
      background-color: #2a2a2a;
      border: 1px solid #555;
      border-radius: 5px;
      padding: 5px 0;
      z-index: 1000;
      min-width: 120px;
    }
    
    .context-menu-item {
      padding: 8px 15px;
      cursor: pointer;
      color: #ccc;
      transition: background-color 0.2s;
    }
    
    .context-menu-item:hover {
      background-color: #3a3a3a;
    }
    
    .item-tooltip {
      position: fixed;
      background-color: #1a1a1a;
      color: #fff;
      padding: 8px 12px;
      border-radius: 5px;
      border: 1px solid #555;
      z-index: 1001;
      max-width: 200px;
      font-size: 12px;
      pointer-events: none;
    }
    
    .item-tooltip .item-name {
      font-weight: bold;
      margin-bottom: 4px;
    }
    
    .item-tooltip .item-description {
      color: #ccc;
    }
    
    .item-tooltip .item-author {
      color: #daa520;
      font-style: italic;
      margin-top: 4px;
      font-size: 11px;
    }
    
    /* Color tints for gemstones */
    .inventory-item.tinted {
      filter: brightness(1.3) saturate(1.8) contrast(1.2);
      text-shadow: 0 0 4px currentColor;
    }
    
    .floor-item.tinted {
      filter: brightness(1.3) saturate(1.8) contrast(1.2);
      text-shadow: 0 0 4px currentColor;
    }
    
    /* Bank interface styles */
    .bank-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.7);
      z-index: 2000;
      display: none;
    }
    
    .bank-interface {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background-color: #2a2a2a;
      border: 2px solid #555;
      border-radius: 8px;
      padding: 20px;
      width: 1000px; /* widened further so inventory fits without inner scroll */
      max-width: 95vw;
      max-height: 92vh;
      overflow-x: hidden;
      overflow-y: auto;
    }
    
    .bank-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      color: #fff;
    }
    
    .bank-title {
      font-size: 24px;
      font-weight: bold;
    }
    
    .bank-close {
      background: #e74c3c;
      color: white;
      border: none;
      border-radius: 5px;
      padding: 8px 16px;
      cursor: pointer;
      font-size: 16px;
    }
    
    .bank-content {
      display: grid;
      grid-template-columns: 3fr 2fr;
      gap: 20px;
    }
    
    .bank-section {
      background-color: #3a3a3a;
      border-radius: 5px;
      padding: 15px;
    }
    
    .bank-section-title {
      color: #fff;
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 15px;
      text-align: center;
    }
    
    .bank-grid {
      display: grid;
      grid-template-columns: repeat(8, 1fr);
      gap: 2px;
      background-color: #2a2a2a;
      padding: 5px;
      border-radius: 5px;
      max-height: 400px;
      overflow-y: auto;
      overflow-x: hidden;
      width: 100%;
    }
    
    .bank-slot {
      aspect-ratio: 1;
      min-width: 0;
      background-color: #4a4a4a;
      border: 1px solid #666;
      border-radius: 3px;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      cursor: pointer;
      transition: background-color 0.2s;
    }
    
    .bank-slot:hover {
      background-color: #5a5a5a;
    }
    
    .bank-slot.occupied {
      background-color: #2d4a3d;
      border-color: #4a7c59;
    }
    
    .bank-item {
      font-size: 24px;
      user-select: none;
      position: relative;
    }
    
    .bank-item-count {
      position: absolute;
      bottom: -3px;
      right: 0px;
      color: white;
      font-size: 10px;
      font-weight: bold;
      text-shadow: 
        -1px -1px 0 #000,
        1px -1px 0 #000,
        -1px 1px 0 #000,
        1px 1px 0 #000,
        0 -1px 0 #000,
        0 1px 0 #000,
        -1px 0 0 #000,
        1px 0 0 #000;
    }
    
    .bank-inventory-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 2px;
      background-color: #2a2a2a;
      padding: 5px;
      border-radius: 5px;
      width: 100%;
    }
    
    .bank-inventory-slot {
      aspect-ratio: 1;
      min-width: 0;
      background-color: #4a4a4a;
      border: 1px solid #666;
      border-radius: 3px;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      cursor: pointer;
      transition: background-color 0.2s;
    }
    
    .bank-inventory-slot:hover {
      background-color: #5a5a5a;
    }
    
    .bank-inventory-slot.occupied {
      background-color: #2d4a3d;
      border-color: #4a7c59;
    }
    
    .bank-actions {
      display: flex;
      gap: 10px;
      margin-top: 15px;
      justify-content: center;
    }
    
    .bank-button {
      background: #4a7c59;
      color: white;
      border: none;
      border-radius: 5px;
      padding: 10px 20px;
      cursor: pointer;
      font-size: 14px;
      transition: background-color 0.2s;
    }
    
    .bank-button:hover {
      background: #5a8c69;
    }
    
    .bank-button:disabled {
      background-color: #444;
      color: #888;
      cursor: not-allowed;
    }

    .bank-search-container {
      display: flex;
      align-items: center;
      margin-bottom: 10px;
      gap: 5px;
    }

    .bank-search {
      flex: 1;
      padding: 8px 12px;
      background-color: #333;
      border: 1px solid #555;
      border-radius: 4px;
      color: #fff;
      font-size: 14px;
    }

    .bank-search:focus {
      outline: none;
      border-color: #4CAF50;
      box-shadow: 0 0 5px rgba(76, 175, 80, 0.3);
    }

    .bank-search-clear {
      padding: 8px 12px;
      background-color: #666;
      border: 1px solid #777;
      border-radius: 4px;
      color: #fff;
      cursor: pointer;
      font-size: 12px;
      min-width: 35px;
    }

    .bank-search-clear:hover {
      background-color: #777;
    }

    .bank-slot.hidden {
      display: none;
    }

    .bank-tabs {
      display: flex;
      gap: 2px;
      margin-bottom: 10px;
      border-bottom: 1px solid #555;
      overflow-x: auto;
      overflow-y: hidden;
    }

    .bank-tab {
      padding: 8px 12px;
      background-color: #444;
      border: none;
      border-top: 2px solid transparent;
      color: #ccc;
      cursor: pointer;
      font-size: 12px;
      transition: all 0.2s;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      min-width: 60px;
      white-space: nowrap;
    }

    .bank-tab:hover {
      background-color: #555;
      color: #fff;
    }

    .bank-tab.active {
      background-color: #2a2a2a;
      border-top-color: #4CAF50;
      color: #fff;
    }
    
    .tab-icon {
      font-size: 16px;
    }
    
    .tab-name {
      font-size: 10px;
      max-width: 50px;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    /* Tab customization modal */
    .tab-icon-modal {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background-color: #2a2a2a;
      border: 2px solid #555;
      border-radius: 8px;
      padding: 20px;
      z-index: 3000;
      width: 450px;
      max-height: 600px;
      overflow-y: auto;
    }
    
    .tab-icon-grid {
      display: grid;
      grid-template-columns: repeat(8, 1fr);
      gap: 8px;
      margin: 15px 0;
      max-height: 400px;
      overflow-y: auto;
      border: 1px solid #444;
      padding: 10px;
      border-radius: 5px;
    }
    
    .icon-option {
      width: 40px;
      height: 40px;
      background-color: #444;
      border: 2px solid #666;
      border-radius: 5px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 20px;
      transition: all 0.2s;
    }
    
    .icon-option:hover {
      background-color: #555;
      border-color: #4CAF50;
    }
    
    .icon-option.selected {
      background-color: #4CAF50;
      border-color: #5CBF60;
    }
    
    /* Shop interface styles */
    .shop-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.7);
      z-index: 2000;
      display: none;
    }
    
    .shop-interface {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background-color: #2a2a2a;
      border: 2px solid #555;
      border-radius: 8px;
      padding: 20px;
      width: 900px;
      max-width: 95vw;
      max-height: 92vh;
      overflow-x: hidden;
      overflow-y: auto;
    }
    
    .shop-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
      color: #fff;
    }
    
    .shop-info {
      flex: 1;
    }
    
    .shop-title {
      font-size: 24px;
      font-weight: bold;
      margin-bottom: 5px;
    }
    
    .shop-keeper {
      font-size: 16px;
      color: #ccc;
      margin-bottom: 5px;
    }
    
    .shop-description {
      font-size: 14px;
      color: #aaa;
      font-style: italic;
    }
    
    .shop-close {
      background: #e74c3c;
      color: white;
      border: none;
      border-radius: 5px;
      padding: 8px 16px;
      cursor: pointer;
      font-size: 16px;
    }
    
    .shop-content {
      display: grid;
      grid-template-columns: 3fr 2fr;
      gap: 20px;
      margin-bottom: 20px;
    }
    
    .shop-section {
      background-color: #3a3a3a;
      border-radius: 5px;
      padding: 15px;
    }
    
    .shop-section-title {
      color: #fff;
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 15px;
      text-align: center;
    }
    
    .shop-inventory-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 8px; /* spacing */
      background-color: #2a2a2a;
      padding: 8px;
      border-radius: 5px;
      max-height: 560px; /* allow full 8-row view */
      overflow: visible; /* no scrollbars */
      width: 95%;
    }
    
    .shop-slot {
      aspect-ratio: 1;
      min-width: 0;
      background-color: #4a4a4a;
      border: 1px solid #666;
      border-radius: 3px;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      cursor: pointer;
      transition: background-color 0.2s;
    }
    
    .shop-slot:hover {
      background-color: #5a5a5a;
    }
    
    .shop-slot.occupied {
      background-color: #2d4a3d;
      border-color: #4a7c59;
    }
    
    .shop-item {
      font-size: 24px;
      user-select: none;
      position: relative;
    }
    
    .shop-item-count {
      position: absolute;
      bottom: -3px;
      right: 0px;
      color: white;
      font-size: 10px;
      font-weight: bold;
      text-shadow: 
        -1px -1px 0 #000,
        1px -1px 0 #000,
        -1px 1px 0 #000,
        1px 1px 0 #000,
        0 -1px 0 #000,
        0 1px 0 #000,
        -1px 0 0 #000,
        1px 0 0 #000;
    }
    
    .shop-item-price {
      position: absolute;
      top: -8px;
      left: 50%;
      transform: translateX(-50%);
      background-color: rgba(0, 0, 0, 0.8);
      color: #ffd700;
      font-size: 9px;
      font-weight: bold;
      padding: 1px 3px;
      border-radius: 2px;
      white-space: nowrap;
    }
    
    .shop-sell-price {
      position: absolute;
      bottom: -8px;
      left: 50%;
      transform: translateX(-50%);
      background-color: rgba(0, 128, 0, 0.8);
      color: #90EE90;
      font-size: 9px;
      font-weight: bold;
      padding: 1px 3px;
      border-radius: 2px;
      white-space: nowrap;
    }
    
    .shop-footer {
      background-color: #3a3a3a;
      border-radius: 5px;
      padding: 15px;
    }
    
    .shop-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 20px;
    }
    
    .quantity-selector {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .quantity-selector label {
      color: #fff;
      font-weight: bold;
    }
    
    .qty-btn {
      background: #4a7c59;
      color: white;
      border: none;
      border-radius: 3px;
      padding: 5px 10px;
      cursor: pointer;
      font-size: 14px;
      transition: background-color 0.2s;
      min-width: 35px;
    }
    
    .qty-btn:hover {
      background: #5a8c69;
    }
    
    .qty-btn.active {
      background: #4CAF50;
      border: 2px solid #45a049;
    }
    
    .transaction-info {
      color: #ccc;
      font-size: 14px;
      text-align: right;
      flex: 1;
      max-width: 300px;
    }
    
    /* Bank amount controls styles */
    .bank-action-row {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;
    }
    
    .bank-amount-controls {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 5px;
    }
    
    .bank-amount-controls label {
      color: #ccc;
      font-size: 12px;
      font-weight: bold;
    }
    
    .amount-buttons {
      display: flex;
      gap: 3px;
    }
    
    .amount-btn {
      background: #4a4a4a;
      color: #ccc;
      border: 1px solid #666;
      border-radius: 3px;
      padding: 5px 8px;
      cursor: pointer;
      font-size: 11px;
      transition: all 0.2s;
      min-width: 25px;
      text-align: center;
    }
    
    .amount-btn:hover {
      background: #5a5a5a;
      color: #fff;
      border-color: #777;
    }
    
    .amount-btn.active {
      background: #4CAF50;
      color: #fff;
      border-color: #45a049;
      box-shadow: 0 0 3px rgba(76, 175, 80, 0.5);
    }
    
    .bank-withdraw-mode-toggle {
      background: #666;
      color: white;
      border: none;
      border-radius: 5px;
      padding: 8px 12px;
      cursor: pointer;
      font-size: 12px;
      transition: background-color 0.2s;
      display: flex;
      align-items: center;
      gap: 5px;
    }
    
    .bank-withdraw-mode-toggle:hover {
      background: #777;
    }
    
    .bank-withdraw-mode-toggle.active {
      background: #4CAF50;
      border: 1px solid #45a049;
    }
  `;
  document.head.appendChild(styleSheet);
}

// Setup inventory event handlers
function setupInventoryHandlers() {
  const inventoryGrid = document.getElementById('inventory-grid');
  const contextMenu = document.getElementById('inventory-context-menu');
  
  if (!inventoryGrid || !contextMenu) return;
  
  // Left click performs top priority action (eat/drink directly, or use mode for other items)
  inventoryGrid.addEventListener('click', (e) => {
    const slot = e.target.closest('.inventory-slot');
    if (!slot) return;
    
    const slotIndex = parseInt(slot.dataset.slot);
    const item = playerInventory[slotIndex];
    
    if (!item) return;
    
    // Shift+click to drop item (OSRS style quick drop)
    if (e.shiftKey) {
      dropItem(slotIndex);
      return;
    }
    
    // Check if item is noted - noted items can't be used directly (OSRS accuracy)
    if (isItemNoted(item)) {
      const itemDef = getItemDefinition(item.id);
      const itemName = itemDef ? itemDef.name : 'item';
      showNotification(`You cannot use a noted ${itemName}. Exchange it at a bank first.`, 'error');
      return;
    }
    
    // If we're already in use mode
    if (useMode.active) {
      if (useMode.selectedSlot === slotIndex) {
        // Clicking the same item cancels use mode
        cancelUseMode();
      } else {
        // Using item on another item
        useItemOnItem(useMode.selectedSlot, slotIndex);
      }
    } else {
      // Left click performs the default action (OSRS style)
      const itemDef = getItemDefinition(item.id);
      if (itemDef && (itemDef.useAction === 'eat' || itemDef.useAction === 'drink' || itemDef.useAction === 'dig')) {
        // For consumable items and tools with direct actions, use directly
        useItem(slotIndex);
      } else if (itemDef && (itemDef.useAction === 'wield' || itemDef.useAction === 'wear' || itemDef.equipment)) {
        // For equipment items, equip directly
        equipItem(slotIndex);
      } else {
        // For other items, enter use mode
        enterUseMode(slotIndex);
      }
    }
  });
  
  // Right click for context menu
  inventoryGrid.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    
    const slot = e.target.closest('.inventory-slot');
    if (!slot) return;
    
    const slotIndex = parseInt(slot.dataset.slot);
    const item = playerInventory[slotIndex];
    
    if (item) {
      showContextMenu(e, slotIndex);
    }
  });
  
  // Context menu actions
  contextMenu.addEventListener('click', (e) => {
    const action = e.target.dataset.action;
    const slotIndex = parseInt(contextMenu.dataset.slot);
    
    if (action && slotIndex >= 0) {
      handleContextAction(action, slotIndex);
    }
    
    hideContextMenu();
  });
  
  // Hide context menu when clicking elsewhere
  document.addEventListener('click', () => {
    hideContextMenu();
  });
  
  // Cancel use mode when clicking outside inventory
  document.addEventListener('click', (e) => {
    if (useMode.active && !e.target.closest('#inventory-grid') && !e.target.closest('.context-menu')) {
      cancelUseMode();
    }
  });
  
  // Tooltip handling
  inventoryGrid.addEventListener('mouseover', (e) => {
    const slot = e.target.closest('.inventory-slot');
    if (!slot) return;
    
    const slotIndex = parseInt(slot.dataset.slot);
    const item = playerInventory[slotIndex];
    
    if (item) {
      showTooltip(e, item);
    }
  });
  
  inventoryGrid.addEventListener('mouseout', () => {
    hideTooltip();
  });
  
  // Drag and drop handling
  inventoryGrid.addEventListener('mousedown', (e) => {
    // Only handle left mouse button
    if (e.button !== 0) return;
    
    const slot = e.target.closest('.inventory-slot');
    if (!slot) return;
    
    const slotIndex = parseInt(slot.dataset.slot);
    const item = playerInventory[slotIndex];
    
    // Only start drag if there's an item in the slot
    if (!item) return;
    
    // Don't start drag if we're in use mode or if shift is held (for quick drop)
    if (useMode.active || e.shiftKey) return;
    
    // Prevent default to avoid text selection
    e.preventDefault();
    
    // Initialize drag state
    dragState.active = true;
    dragState.draggedSlot = slotIndex;
    dragState.draggedItem = item;
    dragState.startX = e.clientX;
    dragState.startY = e.clientY;
    
    // Create drag preview element
    createDragPreview(item, e.clientX, e.clientY);
    
    // Add visual feedback to source slot
    slot.classList.add('drag-source');
    
    console.log(`Started dragging item from slot ${slotIndex}:`, item);
  });
  
  // Global mouse move handler for drag preview
  document.addEventListener('mousemove', (e) => {
    if (!dragState.active || !dragState.dragElement) return;
    
    // Update drag preview position
    dragState.dragElement.style.left = `${e.clientX}px`;
    dragState.dragElement.style.top = `${e.clientY}px`;
    
    // Check what we're hovering over
    const elementUnder = document.elementFromPoint(e.clientX, e.clientY);
    const targetSlot = elementUnder ? elementUnder.closest('.inventory-slot') : null;
    
    // Remove previous drag target highlighting
    document.querySelectorAll('.inventory-slot.drag-target').forEach(slot => {
      slot.classList.remove('drag-target');
    });
    
    // Add drag target highlighting if over a valid slot
    if (targetSlot && targetSlot.dataset.slot !== undefined) {
      const targetSlotIndex = parseInt(targetSlot.dataset.slot);
      if (targetSlotIndex !== dragState.draggedSlot) {
        targetSlot.classList.add('drag-target');
      }
    }
  });
  
  // Global mouse up handler for drop
  document.addEventListener('mouseup', (e) => {
    if (!dragState.active) return;
    
    // Find what we're dropping on
    const elementUnder = document.elementFromPoint(e.clientX, e.clientY);
    const targetSlot = elementUnder ? elementUnder.closest('.inventory-slot') : null;
    
    let dropSuccessful = false;
    
    if (targetSlot && targetSlot.dataset.slot !== undefined) {
      const targetSlotIndex = parseInt(targetSlot.dataset.slot);
      
      // Only swap if dropping on a different slot
      if (targetSlotIndex !== dragState.draggedSlot) {
        swapInventorySlots(dragState.draggedSlot, targetSlotIndex);
        dropSuccessful = true;
        console.log(`Swapped items between slots ${dragState.draggedSlot} and ${targetSlotIndex}`);
      }
    }
    
    if (!dropSuccessful) {
      console.log('Drag cancelled - dropped outside valid area or on same slot');
    }
    
    // Clean up drag state
    cleanupDragState();
  });
}

// Show context menu
function showContextMenu(event, slotIndex) {
  const item = playerInventory[slotIndex];
  if (!item) return;

  const itemDef = getItemDefinition(item.id);
  if (!itemDef) return;

  // Remove any existing context menu
  hideContextMenu();

  const contextMenu = document.createElement('div');
  contextMenu.id = 'context-menu';
  contextMenu.className = 'context-menu';

  // For noted items, show restricted options
  if (isItemNoted(item)) {
    // Noted item options - only these three
    contextMenu.innerHTML = `
      <div class="context-menu-item" data-action="unnote">Unnote</div>
      <div class="context-menu-item" data-action="examine">Examine</div>
      <div class="context-menu-item" data-action="drop">Drop</div>
    `;
  } else {
    // Regular item options - build menu based on item type
    let menuItems = [];
    
    // Add consumable action first if available
    if (itemDef.useAction === 'eat') {
      menuItems.push('<div class="context-menu-item" data-action="consume">Eat</div>');
    } else if (itemDef.useAction === 'drink') {
      menuItems.push('<div class="context-menu-item" data-action="consume">Drink</div>');
    }
    
    // Add equip action for equipment items
    if (itemDef.useAction === 'wield' || itemDef.useAction === 'wear' || itemDef.equipment) {
      const actionText = itemDef.useAction === 'wear' ? 'Wear' : 'Wield';
      
      // For rings, add specific slot options
      if (itemDef.equipment && itemDef.equipment.slot === 'ring') {
        menuItems.push(`<div class="context-menu-item" data-action="equip-ring1">${actionText} (Ring Slot 1)</div>`);
        menuItems.push(`<div class="context-menu-item" data-action="equip-ring2">${actionText} (Ring Slot 2)</div>`);
      } else {
        menuItems.push(`<div class="context-menu-item" data-action="equip">${actionText}</div>`);
      }
    }
    
    // Add specific tool actions
    if (item.id && item.id.includes('shovel')) {
      menuItems.push('<div class="context-menu-item" data-action="dig">Dig</div>');
    }
    
    // Always add "Use" for item combinations (OSRS style)
    menuItems.push('<div class="context-menu-item" data-action="use">Use</div>');
    
    // Add examine and drop
    menuItems.push('<div class="context-menu-item" data-action="examine">Examine</div>');
    menuItems.push('<div class="context-menu-item" data-action="drop">Drop</div>');
    
    contextMenu.innerHTML = menuItems.join('');
  }

  // Position the menu near the mouse
  contextMenu.style.left = `${event.pageX}px`;
  contextMenu.style.top = `${event.pageY}px`;

  document.body.appendChild(contextMenu);

  // Add event listeners
  contextMenu.addEventListener('click', (e) => {
    const action = e.target.dataset.action;
    if (action) {
      handleContextAction(action, slotIndex);
      hideContextMenu();
    }
  });

  // Remove menu when clicking elsewhere
  setTimeout(() => {
    document.addEventListener('click', hideContextMenu, { once: true });
  }, 0);
}

// Get properly capitalized use action text
function getUseActionText(itemDef) {
  switch (itemDef.useAction) {
    case 'eat': return 'Eat';
    case 'drink': return 'Drink';
    case 'read': return 'Read';
    case 'count': return 'Count';
    case 'wield': return 'Wield';
    case 'examine': return 'Examine';
    case 'use': return 'Use';
    default: return 'Use';
  }
}

// Hide context menu
function hideContextMenu() {
  const contextMenu = document.getElementById('context-menu');
  if (contextMenu) {
    contextMenu.remove();
  }
}

// Handle context menu actions
function handleContextAction(action, slotIndex) {
  const item = playerInventory[slotIndex];
  if (!item) return;
  
  switch (action) {
    case 'use':
      // "Use" always enters use-on mode for item combinations (OSRS style)
      enterUseMode(slotIndex);
      break;
    case 'consume':
      // Direct consumption (Eat/Drink)
      useItem(slotIndex);
      break;
    case 'drop':
      dropItem(slotIndex);
      break;
    case 'unnote':
      unnoteItem(slotIndex);
      break;
    case 'examine':
      examineItem(slotIndex);
      break;
    case 'dig':
      handleDigAction(slotIndex);
      break;
    case 'equip':
      equipItem(slotIndex);
      break;
    case 'equip-ring1':
      equipItem(slotIndex, 'ring');
      break;
    case 'equip-ring2':
      equipItem(slotIndex, 'ring2');
      break;
  }
}

// Handle dig action for shovels
function handleDigAction(slotIndex) {
  const item = playerInventory[slotIndex];
  if (!item) return;
  
  // Call the digging module's shovel interaction handler
  if (window.diggingModule?.handleShovelInteraction) {
    window.diggingModule.handleShovelInteraction(item.id);
  } else {
    showNotification('Digging system not available.', 'warning');
  }
}

// Use an item (direct consumption - eating, drinking, etc.)
function useItem(slotIndex) {
  const item = playerInventory[slotIndex];
  if (!item) return;
  
  const itemDef = getItemDefinition(item.id);
  if (!itemDef) return;
  
  let message = `You use the ${itemDef.name}.`;
  let consumed = false;
  
  switch (itemDef.useAction) {
    case 'eat':
      message = `You eat the ${itemDef.name}. It tastes good!`;
      consumed = true;
      break;
    case 'drink':
      message = `You drink the ${itemDef.name}. You feel refreshed!`;
      consumed = true;
      break;
    case 'read':
      message = `You read the ${itemDef.name}. The text is in an ancient language.`;
      break;
    case 'count':
      message = `You have ${item.quantity || 1} ${itemDef.name}${(item.quantity || 1) > 1 ? 's' : ''}.`;
      break;
    case 'wield':
      message = `You wield the ${itemDef.name}. You feel more powerful!`;
      break;
    case 'examine':
      message = `${itemDef.name}: ${itemDef.description}`;
      break;
    case 'dig':
      handleDigAction(slotIndex);
      return;
    default:
      // For items without a specific use action, enter use mode instead
      enterUseMode(slotIndex);
      return;
  }
  
  showNotification(message);
  
  if (consumed) {
    removeItemFromInventory(slotIndex);
  }
  
  // Healing logic
  if (consumed && itemDef.heals) {
    const healAmt = itemDef.heals;
    if (window.isUserOnline && window.isUserOnline() && window.getWebSocket) {
      const websocket = window.getWebSocket();
      if (websocket && websocket.readyState === WebSocket.OPEN) {
        websocket.send(JSON.stringify({
          type: 'item-consumed',
          itemId: item.id,
          heal: healAmt,
          timestamp: Date.now()
        }));
        
        // Also update locally for immediate feedback
        if (window.combatModule?.updateLocalHPBar && window.combatModule?.getCurrentHP) {
          const profile = window.userModule?.getProfile?.();
          const maxHP = profile?.skills?.hitpoints || 10;
          const currentHP = window.combatModule.getCurrentHP() || maxHP;
          const newCur = Math.min(maxHP, currentHP + healAmt);
          
          console.log(`🍴 HEALING (ONLINE): ${itemDef.name} heals ${healAmt} HP. ${currentHP} → ${newCur} (max: ${maxHP})`);
          window.combatModule.updateLocalHPBar(newCur, maxHP);
          
          // Sync new HP with server
          if (window.syncHitpointsWithServer) {
            window.syncHitpointsWithServer(newCur, maxHP);
          }
          
          // Show healing notification
          showNotification(`You heal ${Math.min(healAmt, maxHP - currentHP)} HP from eating ${itemDef.name}.`, 'success');
        }
      }
    } else {
      // Offline heal locally
      if (window.combatModule?.updateLocalHPBar && window.combatModule?.getCurrentHP) {
        // assumption: combat module maintains maxHP; we fetch via profile
        const profile = window.userModule?.getProfile?.();
        const maxHP = profile?.skills?.hitpoints || 10;
        const currentHP = window.combatModule.getCurrentHP() || maxHP;
        const newCur = Math.min(maxHP, currentHP + healAmt);
        
        console.log(`🍴 HEALING (OFFLINE): ${itemDef.name} heals ${healAmt} HP. ${currentHP} → ${newCur} (max: ${maxHP})`);
        window.combatModule.updateLocalHPBar(newCur, maxHP);
        
        // Show healing notification
        showNotification(`You heal ${Math.min(healAmt, maxHP - currentHP)} HP from eating ${itemDef.name}.`, 'success');
      } else {
        console.warn('🍴 HEALING: Combat module not available for healing');
      }
    }
  }
}

// Drop an item
function dropItem(slotIndex) {
  const item = playerInventory[slotIndex];
  if (!item) return;
  
  // Get player position from world module
  const playerPos = getPlayerPosition();
  if (!playerPos) return;
  
  // Round player position to nearest tile coordinates for item placement
  const dropX = Math.round(playerPos.x);
  const dropY = Math.round(playerPos.y);
  
  // If online, send drop request to server
  if (window.isUserOnline && window.isUserOnline() && window.getWebSocket) {
    const websocket = window.getWebSocket();
    if (websocket && websocket.readyState === WebSocket.OPEN) {
      console.log(`📤 Sending drop request to server for ${item.id} x${item.quantity || 1} at (${dropX}, ${dropY})`);
      
      websocket.send(JSON.stringify({
        type: 'floor-item-drop-request',
        item: { ...item }, // Send copy of item
        x: dropX,
        y: dropY,
        slotIndex: slotIndex
      }));
      
      // Don't remove from inventory yet - wait for server confirmation
      showNotification('Dropping item...', 'info');
      return;
    } else {
      console.warn('⚠️ WebSocket not available for drop request');
    }
  }
  
  // Offline mode - handle locally using server-compatible strict stacking rules
  const existingItems = getFloorItemsAt(dropX, dropY);
  const itemDef = getItemDefinition(item.id);
  
  // Use strict stacking rules that match the server (only noted items are truly stackable)
  const canStack = isItemNoted(item);
  
  if (canStack) {
    // For noted items, look for exact matches (same ID + noted status)
    const existingStackableItem = existingItems.find(floorItem => {
      return isItemNoted(floorItem.item) && 
             floorItem.item.id === item.id &&
             getBaseItemId(floorItem.item) === getBaseItemId(item);
    });
    
    if (existingStackableItem) {
      // Combine with existing stack
      existingStackableItem.item.quantity = (existingStackableItem.item.quantity || 1) + (item.quantity || 1);
      
      // Remove the entire stack from inventory
      playerInventory[slotIndex] = null;
      updateInventoryDisplay();
      
      // Force world re-render to show the updated quantity immediately
      if (window.worldModule && window.worldModule.forceWorldRerender) {
        window.worldModule.forceWorldRerender();
      }
      
      const notedText = isItemNoted(item) ? ' note' : '';
      const quantityText = item.quantity > 1 ? ` (${item.quantity})` : '';
      const totalQuantity = existingStackableItem.item.quantity;
      showNotification(`You drop the ${itemDef.name}${notedText}${quantityText}. Total on ground: ${totalQuantity}.`);
      return;
    }
  }
  
  // No existing stackable item found, create new floor item
  // Keep the item exactly as it is (noted items stay noted, regular items stay regular)
  createFloorItem(item, dropX, dropY);
  
  // Remove the entire stack from inventory (not just 1 count)
  playerInventory[slotIndex] = null;
  updateInventoryDisplay();
  
  const notedText = isItemNoted(item) ? ' note' : '';
  const quantityText = item.quantity > 1 ? ` (${item.quantity})` : '';
  showNotification(`You drop the ${itemDef ? itemDef.name : 'item'}${notedText}${quantityText}.`);
}

// Examine an item
function examineItem(slotIndex) {
  const item = playerInventory[slotIndex];
  if (!item) return;
  
  const itemDef = getItemDefinition(item.id);
  if (!itemDef) return;
  
  showNotification(`${itemDef.name}: ${itemDef.description}`);
}

// Show tooltip
function showTooltip(event, item) {
  hideTooltip(); // Remove any existing tooltip
  
  const itemDef = getItemDefinition(item.id);
  if (!itemDef) return;
  
  console.log('🏷️ Tooltip - Item:', item);
  console.log('🏷️ Tooltip - Item has author?', !!item.author);
  console.log('🏷️ Tooltip - Author value:', item.author);
  
  // Use custom description if available, otherwise use item definition description
  let description = item.description || itemDef.description;
  // Use custom name if available, otherwise use item definition name  
  const name = item.name || itemDef.name;
  
  if (itemDef.heals) {
     description += `\nHeals: ${itemDef.heals} HP`;
  }
  
  const tooltip = document.createElement('div');
  tooltip.className = 'item-tooltip';
  tooltip.innerHTML = `
    <div class="item-name">${name}</div>
    <div class="item-description">${description}</div>
    ${item.quantity && item.quantity > 1 ? `<div>Quantity: ${formatNumberWithCommas(item.quantity)}</div>` : ''}
    ${item.author ? `<div class="item-author">Written by: ${item.author}</div>` : ''}
  `;
  
  tooltip.style.left = `${event.pageX + 10}px`;
  tooltip.style.top = `${event.pageY - 10}px`;
  
  document.body.appendChild(tooltip);
}

// Hide tooltip
function hideTooltip() {
  const existingTooltip = document.querySelector('.item-tooltip');
  if (existingTooltip) {
    existingTooltip.remove();
  }
}

// Add item to inventory
function addItemToInventory(itemId, quantity = 1, noted = false) {
  console.log('[INVENTORY.JS] addItemToInventory called', { itemId, quantity, noted });
  const itemDef = getItemDefinition(itemId);
  if (!itemDef) return false;
  
  // If non-stackable and quantity > 1, add individually to empty slots
  if (!itemDef.stackable && quantity > 1 && !noted) {
    let success = true;
    for (let i = 0; i < quantity; i++) {
      success = addItemToInventory(itemId, 1, false) && success;
    }
    return success;
  }
  
  // Handle noted items (treated as stackable stacks regardless of base item)
  if (noted) {
    // Try to find existing noted stack
    const existingNoted = playerInventory.findIndex(it => it && it.id === itemId && isItemNoted(it));
    if (existingNoted !== -1) {
      playerInventory[existingNoted].quantity = (playerInventory[existingNoted].quantity || 1) + quantity;
      updateInventoryDisplay();
      if (window.syncInventoryWithServer && window.isUserOnline && window.isUserOnline()) {
        window.syncInventoryWithServer(playerInventory);
      }
      return true;
    }
    return addCustomItemToInventory(itemId, quantity, { noted: true, baseItemId: itemId });
  }
  
  // Check if item is stackable and already exists
  if (itemDef.stackable) {
    const existingSlot = playerInventory.findIndex(item => item && item.id === itemId && !isItemNoted(item));
    if (existingSlot !== -1) {
      playerInventory[existingSlot].quantity = (playerInventory[existingSlot].quantity || 1) + quantity;
      updateInventoryDisplay();
      
      // Sync with server if online
      if (window.syncInventoryWithServer && window.isUserOnline && window.isUserOnline()) {
        window.syncInventoryWithServer(playerInventory);
      }
      
      return true;
    }
  }
  
  // Find empty slot
  const emptySlot = playerInventory.findIndex(item => !item);
  if (emptySlot === -1) {
    showNotification('Your inventory is full!', 'error');
    return false;
  }
  
  // Add item to inventory
  playerInventory[emptySlot] = {
    id: itemId,
    quantity: itemDef.stackable ? quantity : 1
  };
  
  updateInventoryDisplay();
  
  // Sync with server if online
  if (window.syncInventoryWithServer && window.isUserOnline && window.isUserOnline()) {
    window.syncInventoryWithServer(playerInventory);
  }
  
  return true;
}

// Add custom item to inventory with additional properties
function addCustomItemToInventory(itemId, quantity = 1, customProperties = {}) {
  const itemDef = getItemDefinition(itemId);
  if (!itemDef) return false;
  
  // Custom items with special properties should not stack with regular items
  // Find empty slot
  const emptySlot = playerInventory.findIndex(item => !item);
  if (emptySlot === -1) {
    showNotification('Your inventory is full!', 'error');
    return false;
  }
  
  // Create custom item with additional properties
  const customItem = {
    id: itemId,
    quantity: (itemDef.stackable || customProperties.noted) ? quantity : 1,
    ...customProperties  // Add custom properties like description, name, author, etc.
  };
  
  console.log('📦 addCustomItemToInventory - Created item:', customItem);
  console.log('📦 addCustomItemToInventory - Custom properties received:', customProperties);
  
  // Add item to inventory
  playerInventory[emptySlot] = customItem;
  
  console.log('📦 addCustomItemToInventory - Item added to slot', emptySlot, ':', playerInventory[emptySlot]);
  
  updateInventoryDisplay();
  
  // Sync with server if online - but only for regular items
  // Custom items with author info should not be immediately synced to preserve custom properties
  if (window.syncInventoryWithServer && window.isUserOnline && window.isUserOnline()) {
    if (!customProperties.author && !customProperties.authorName && Object.keys(customProperties).length === 0) {
      // Regular item - sync normally
      window.syncInventoryWithServer(playerInventory);
    } else {
      // Custom item with special properties - the server will sync when appropriate
      console.log('📦 Skipping immediate sync for custom item with special properties');
    }
  }
  
  return true;
}

// Remove item from inventory
function removeItemFromInventory(slotIndex) {
  if (slotIndex < 0 || slotIndex >= playerInventory.length) return;
  
  const item = playerInventory[slotIndex];
  if (!item) return;
  
  const itemDef = getItemDefinition(item.id);
  
  if (itemDef && itemDef.stackable && item.quantity > 1) {
    item.quantity--;
  } else {
    playerInventory[slotIndex] = null;
  }
  
  updateInventoryDisplay();
  
  // Sync with server if online
  if (window.syncInventoryWithServer && window.isUserOnline && window.isUserOnline()) {
    window.syncInventoryWithServer(playerInventory);
  }
}

// Update inventory display
function updateInventoryDisplay() {
  // Auto-fix: ensure non-stackable items are not shown as stacks before rendering
  if (typeof ensureInventoryIntegrity === 'function') {
    ensureInventoryIntegrity();
  }
  
  const inventoryGrid = document.getElementById('inventory-grid');
  const inventoryCount = document.getElementById('inventory-count');
  
  if (!inventoryGrid) return;
  
  // Update slots
  const slots = inventoryGrid.querySelectorAll('.inventory-slot');
  slots.forEach((slot, index) => {
    const item = playerInventory[index];
    
    if (item) {
      const itemDef = getItemDefinition(item.id);
      if (itemDef) {
        slot.classList.add('occupied');
        const tintStyle = itemDef.colorTint ? `color: ${itemDef.colorTint};` : '';
        const tintClass = itemDef.colorTint ? 'tinted' : '';
        
        // Check if this is a noted item
        if (isItemNoted(item)) {
          // Display noted item with special icon
          const baseIcon = itemDef.getIcon ? itemDef.getIcon(1) : itemDef.icon;
          const htmlContent = `
            <div class="inventory-item ${tintClass}" style="${tintStyle}">
              <div class="noted-item-container">
                <span class="note-background">📜</span>
                <span class="noted-icon">${baseIcon}</span>
              </div>
              ${item.quantity > 1 ? `<div class="inventory-item-count" style="color: ${getQuantityColor(item.quantity)};">${formatCompactNumber(item.quantity)}</div>` : ''}
            </div>
          `;
          slot.innerHTML = htmlContent;
          
          // Debug logging
          console.log(`Noted item in slot ${index}:`, item);
          console.log(`Generated HTML:`, htmlContent);
          console.log(`Should show quantity:`, item.quantity > 1);
          console.log(`Quantity value:`, item.quantity);
          
          slot.title = `${itemDef.name} (noted) (${formatNumberWithCommas(item.quantity || 1)}) - Right-click for options`;
        } else {
          // Regular item display
          // Use dynamic icon if available (for coins), otherwise use default icon
          const icon = itemDef.getIcon ? itemDef.getIcon(item.quantity || 1) : itemDef.icon;
          
          slot.innerHTML = `
            <div class="inventory-item ${tintClass}" style="${tintStyle}">
              ${icon}
              ${(itemDef.stackable || item.quantity > 1) && item.quantity > 1 ? 
                `<div class="inventory-item-count" style="color: ${getQuantityColor(item.quantity)};">${formatCompactNumber(item.quantity)}</div>` : ''
              }
            </div>
          `;
          slot.title = `${itemDef.name}${item.quantity > 1 ? ` (${formatNumberWithCommas(item.quantity)})` : ''} - Right-click for options`;
        }
      }
    } else {
      slot.classList.remove('occupied');
      slot.innerHTML = '';
      slot.title = '';
    }
  });
  
  // Update count
  const itemCount = playerInventory.filter(item => item).length;
  if (inventoryCount) {
    inventoryCount.textContent = itemCount;
  }
  
  // Restore use mode highlighting if active
  if (useMode.active) {
    updateInventoryUseMode();
  }
}

// Start spawning items on the floor
function startItemSpawning() {
  if (itemSpawnTimer) {
    clearInterval(itemSpawnTimer);
  }
  
  itemSpawnTimer = setInterval(() => {
    spawnRandomItem();
  }, ITEM_SPAWN_INTERVAL);
  
  // Spawn initial items
  for (let i = 0; i < 3; i++) {
    setTimeout(() => spawnRandomItem(), i * 2000);
  }
}

// Spawn a random item on the floor
function spawnRandomItem() {
  console.log(`Attempting to spawn item. Current floor items: ${floorItems.length}/${MAX_FLOOR_ITEMS}`);
  
  if (floorItems.length >= MAX_FLOOR_ITEMS) {
    console.log('Max floor items reached, skipping spawn');
    return;
  }
  
  // Get random item based on rarity
  const itemId = getRandomItemId();
  if (!itemId) {
    console.log('Failed to get random item ID');
    return;
  }
  
  console.log(`Selected item to spawn: ${itemId}`);
  
  // Get random position in world
  const worldBounds = getWorldBounds();
  if (!worldBounds) {
    console.log('Failed to get world bounds');
    return;
  }
  
  console.log(`World bounds: ${worldBounds.width}x${worldBounds.height}`);
  
  const x = Math.floor(Math.random() * worldBounds.width);
  const y = Math.floor(Math.random() * worldBounds.height);
  
  console.log(`Trying to spawn at position: (${x}, ${y})`);
  
  // Check if position is walkable
  if (!isPositionWalkable(x, y)) {
    console.log(`Position (${x}, ${y}) is not walkable, skipping spawn`);
    return;
  }
  
  // Determine quantity for stackable items
  let quantity = 1;
  const itemDef = getItemDefinition(itemId);
  if (itemDef && itemDef.stackable && itemId === 'coins') {
    quantity = Math.floor(Math.random() * 50) + 1; // 1-50 coins
  }
  
  console.log(`Spawning ${quantity} ${itemDef.name}(s) at (${x}, ${y})`);
  createFloorItem({ id: itemId, quantity }, x, y);
}

// Get random item ID based on rarity
function getRandomItemId() {
  // Use shared item definitions if available
  const itemDefs = window.sharedItemDefinitions || {};
  const items = Object.keys(itemDefs);
  
  if (items.length === 0) {
    console.warn('No item definitions available for random selection');
    return 'coins'; // Safe fallback
  }
  
  const totalWeight = items.reduce((sum, id) => {
    const def = getItemDefinition(id);
    return sum + (def && def.rarity ? def.rarity : 0.1);
  }, 0);
  
  let random = Math.random() * totalWeight;
  
  for (const itemId of items) {
    const def = getItemDefinition(itemId);
    const rarity = def && def.rarity ? def.rarity : 0.1;
    random -= rarity;
    if (random <= 0) {
      return itemId;
    }
  }
  
  return items[0]; // Fallback
}

// Create floor item
function createFloorItem(item, x, y) {
  const itemDef = getItemDefinition(item.id);
  if (!itemDef) return null;
  
  // Check if there are existing items at this location
  const existingItems = getFloorItemsAt(x, y);
  
  // Use strict stacking rules that match the server (only noted items are truly stackable)
  const canStack = isItemNoted(item);
  
  if (canStack) {
    // For noted items, look for exact matches (same ID + noted status)
    const existingStackableItem = existingItems.find(floorItem => {
      return isItemNoted(floorItem.item) && 
             floorItem.item.id === item.id &&
             getBaseItemId(floorItem.item) === getBaseItemId(item);
    });
    
    if (existingStackableItem) {
      // Combine with existing stack
      existingStackableItem.item.quantity = (existingStackableItem.item.quantity || 1) + (item.quantity || 1);
      const notedText = isItemNoted(item) ? ' (noted)' : '';
      console.log(`Combined ${item.quantity || 1} ${itemDef.name}${notedText} with existing stack at (${x}, ${y}). New total: ${existingStackableItem.item.quantity}`);
      return existingStackableItem.id; // Return existing item ID for tracking
    }
  }
  
  // No existing stackable item found or item is not stackable, create new floor item
  // Keep the item exactly as it is (noted items stay noted, regular items stay regular)
  const floorItem = {
    id: generateItemId(),
    item: { ...item }, // Create a copy to avoid reference issues
    x: x,
    y: y,
    spawnTime: Date.now()
  };
  
  // Add to floor items array
  floorItems.push(floorItem);
  
  // Schedule despawn
  setTimeout(() => {
    despawnFloorItem(floorItem.id);
  }, ITEM_DESPAWN_TIME);
  
  const notedText = isItemNoted(item) ? ' (noted)' : '';
  console.log(`Spawned ${itemDef.name}${notedText} at (${x}, ${y}) with ID: ${floorItem.id}`);
  
  // Force world re-render to show the spawned item immediately
  if (window.worldModule && window.worldModule.forceWorldRerender) {
    window.worldModule.forceWorldRerender();
  }
  
  return floorItem.id; // Return new item ID for tracking
}

// Get floor items at a specific world position
function getFloorItemsAt(x, y) {
  return floorItems.filter(item => item.x === x && item.y === y);
}

// Get item definition by ID
function getItemDefinition(itemId) {
  // Use shared item definitions as primary source
  if (window.sharedItemDefinitions && window.sharedItemDefinitions[itemId]) {
    return window.sharedItemDefinitions[itemId];
  }
  
  // Fallback for items not yet in shared definitions
  console.warn(`Item definition not found in shared definitions: ${itemId}`);
  return null;
}

// Update floor item position based on camera (no longer needed - handled by world rendering)
function updateFloorItemPosition(floorItem) {
  // This function is no longer used - items are rendered by the world module
}

// Update all floor item positions (no longer needed - handled by world rendering)
function updateAllFloorItemPositions() {
  // This function is no longer used - items are rendered by the world module
}

// Setup floor item click handlers (now handled by world rendering)
function setupFloorItemHandlers() {
  // Floor item clicks are now handled in the world's renderViewport function
  // Each item element gets click handlers when created
}

// Pick up floor item
function pickupFloorItem(floorItemId) {
  console.log('PICKUP ATTEMPT: pickupFloorItem called with ID:', floorItemId);
  
  // If online, send pickup request to server
  if (window.isUserOnline && window.isUserOnline() && window.getWebSocket) {
    const websocket = window.getWebSocket();
    if (websocket && websocket.readyState === WebSocket.OPEN) {
      console.log(`📤 Sending pickup request to server for floor item: ${floorItemId}`);
      
      websocket.send(JSON.stringify({
        type: 'floor-item-pickup-request',
        floorItemId: floorItemId
      }));
      
      showNotification('Picking up item...', 'info');
      return;
    } else {
      console.warn('⚠️ WebSocket not available for pickup request');
    }
  }
  
  // Offline mode - handle locally (original logic)
  console.log('Current floor items:', floorItems);
  
  const floorItem = floorItems.find(item => item.id === floorItemId);
  if (!floorItem) {
    console.error('PICKUP ERROR: No floor item found with ID:', floorItemId);
    return;
  }
  
  console.log('PICKUP: Found floor item:', floorItem);
  
  const itemDef = getItemDefinition(floorItem.item.id);
  if (!itemDef) {
    console.error('PICKUP ERROR: No item definition found for:', floorItem.item.id);
    return;
  }
  
  console.log('PICKUP: Found item definition:', itemDef);
  
  // Check if player is close enough
  const playerPos = getPlayerPosition();
  if (!playerPos) {
    console.error('PICKUP ERROR: Could not get player position');
    return;
  }
  
  console.log('PICKUP: Player position:', playerPos);
  
  // Convert to integer coordinates for distance calculation
  const playerX = Math.floor(playerPos.x);
  const playerY = Math.floor(playerPos.y);
  const itemX = Math.floor(floorItem.x);
  const itemY = Math.floor(floorItem.y);
  
  const distance = Math.abs(playerX - itemX) + Math.abs(playerY - itemY);
  console.log(`PICKUP: Distance check - Player(${playerX}, ${playerY}) -> Item(${itemX}, ${itemY}), Distance: ${distance}`);
  
  if (distance > 2) {
    console.log('PICKUP: Too far away, showing error message');
    showNotification('You need to be closer to pick that up!', 'error');
    return;
  }
  
  console.log('PICKUP: Distance OK, attempting to add to inventory');
  
  // Try to add to inventory - need to preserve noted status
  let addResult = false;
  
  if (isItemNoted(floorItem.item)) {
    // For noted items, try to find existing noted stack in inventory
    const existingNotedSlot = playerInventory.findIndex(invItem => 
      invItem && 
      invItem.id === floorItem.item.id && 
      isItemNoted(invItem) &&
      getBaseItemId(invItem) === getBaseItemId(floorItem.item)
    );
    
    if (existingNotedSlot !== -1) {
      // Add to existing noted stack
      playerInventory[existingNotedSlot].quantity = (playerInventory[existingNotedSlot].quantity || 1) + (floorItem.item.quantity || 1);
      addResult = true;
      updateInventoryDisplay();
    } else {
      // Find empty slot for new noted stack
      const emptySlot = playerInventory.findIndex(item => !item);
      if (emptySlot !== -1) {
        // Create new noted stack
        playerInventory[emptySlot] = { ...floorItem.item }; // Copy the entire item including noted status
        addResult = true;
        updateInventoryDisplay();
      }
    }
  } else {
    // For regular items, check if it has custom properties (like unfinished books, authored books)
    if (floorItem.item.type === 'unfinished_book' || floorItem.item.author || floorItem.item.authorName || Object.keys(floorItem.item).length > 2) {
      // Item has custom properties - preserve them by placing directly in inventory
      const emptySlot = playerInventory.findIndex(item => !item);
      if (emptySlot !== -1) {
        // Create new item with all properties preserved
        playerInventory[emptySlot] = { ...floorItem.item }; // Copy the entire item including all custom properties
        addResult = true;
        updateInventoryDisplay();
      }
    } else {
      // Regular item without custom properties - use the existing function
      addResult = addItemToInventory(floorItem.item.id, floorItem.item.quantity);
    }
  }
  
  console.log('PICKUP: Add to inventory result:', addResult);
  
  if (addResult) {
    console.log('PICKUP: Successfully added to inventory, removing from floor');
    // Remove from floor only if successfully added to inventory
    removeFloorItem(floorItemId);
    
    const notedText = isItemNoted(floorItem.item) ? ' note' : '';
    const pluralText = floorItem.item.quantity > 1 ? 's' : '';
    showNotification(`You pick up ${floorItem.item.quantity > 1 ? 
      `${floorItem.item.quantity} ` : ''}${itemDef.name}${notedText}${pluralText}.`);
    console.log('PICKUP: Pickup complete!');
  } else {
    console.log('PICKUP: Failed to add to inventory (probably full) - item remains on floor');
    showNotification('Your inventory is too full to pick that up!', 'error');
  }
}

// Remove floor item
function removeFloorItem(floorItemId) {
  const index = floorItems.findIndex(item => item.id === floorItemId);
  if (index === -1) return;
  
  floorItems.splice(index, 1);
  
  // Force world re-render to hide the removed item immediately
  if (window.worldModule && window.worldModule.forceWorldRerender) {
    window.worldModule.forceWorldRerender();
  }
}

// Despawn floor item
function despawnFloorItem(floorItemId) {
  removeFloorItem(floorItemId);
}

// Generate unique item ID
function generateItemId() {
  return 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Helper functions to interface with other modules
function getPlayerPosition() {
  // This should interface with the world module
  if (window.worldModule && window.worldModule.getPlayerPosition) {
    return window.worldModule.getPlayerPosition();
  }
  return { x: 50, y: 50 }; // Default fallback
}

function getCameraPosition() {
  // This should interface with the world module
  if (window.worldModule && window.worldModule.getCameraPosition) {
    return window.worldModule.getCameraPosition();
  }
  return { x: 38, y: 42 }; // Default fallback
}

function getWorldBounds() {
  // This should interface with the world module
  if (window.worldModule && window.worldModule.getWorldBounds) {
    return window.worldModule.getWorldBounds();
  }
  return { width: 100, height: 100 }; // Default fallback
}

function getGridSize() {
  // This should interface with the world module
  if (window.worldModule && window.worldModule.getGridSize) {
    return window.worldModule.getGridSize();
  }
  return 32; // Default fallback
}

function isPositionWalkable(x, y) {
  // This should interface with the world module
  if (window.worldModule && window.worldModule.isPositionWalkable) {
    return window.worldModule.isPositionWalkable(x, y);
  }
  return true; // Default fallback
}

function showNotification(message, type = 'info') {
  // This should interface with the UI module
  if (window.uiModule && window.uiModule.showNotification) {
    window.uiModule.showNotification(message, type);
  } else {
    console.log(`Notification: ${message}`);
  }
}

// Reset inventory
function resetInventory() {
  playerInventory = new Array(INVENTORY_SIZE).fill(null);
  floorItems = [];
  updateInventoryDisplay();
}

// Spawn an item near the player for testing
function spawnItemNearPlayer() {
  console.log('Spawning item near player for testing');
  
  const playerPos = getPlayerPosition();
  if (!playerPos) {
    console.log('Failed to get player position');
    return;
  }
  
  // Get random item
  const itemId = getRandomItemId();
  if (!itemId) {
    console.log('Failed to get random item ID');
    return;
  }
  
  // Try to find a walkable position near the player (within 3 tiles)
  const maxAttempts = 10;
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    // Random offset within 3 tiles
    const offsetX = Math.floor(Math.random() * 7) - 3; // -3 to +3
    const offsetY = Math.floor(Math.random() * 7) - 3; // -3 to +3
    
    const spawnX = Math.floor(playerPos.x) + offsetX;
    const spawnY = Math.floor(playerPos.y) + offsetY;
    
    // Check if position is within world bounds and walkable
    const worldBounds = getWorldBounds();
    if (spawnX >= 0 && spawnX < worldBounds.width && 
        spawnY >= 0 && spawnY < worldBounds.height &&
        isPositionWalkable(spawnX, spawnY)) {
      
      // Determine quantity for stackable items
      let quantity = 1;
      const itemDef = getItemDefinition(itemId);
      if (itemDef && itemDef.stackable && itemId === 'coins') {
        quantity = Math.floor(Math.random() * 20) + 5; // 5-25 coins for testing
      }
      
      console.log(`Spawning ${quantity} ${itemDef.name}(s) near player at (${spawnX}, ${spawnY})`);
      createFloorItem({ id: itemId, quantity }, spawnX, spawnY);
      return;
    }
    
    attempts++;
  }
  
  console.log('Failed to find walkable position near player after', maxAttempts, 'attempts');
}

// Add a random item directly to inventory for testing
function addRandomItemToInventory() {
  console.log('Adding random item directly to inventory for testing');
  console.log('Current playerInventory state:', playerInventory);
  console.log('PlayerInventory length:', playerInventory.length);
  console.log('Empty slots:', playerInventory.filter(item => !item).length);
  
  // Get random item
  const itemId = getRandomItemId();
  if (!itemId) {
    console.log('Failed to get random item ID');
    return;
  }
  
  // Determine quantity for stackable items
  let quantity = 1;
  const itemDef = getItemDefinition(itemId);
  if (itemDef && itemDef.stackable && itemId === 'coins') {
    quantity = Math.floor(Math.random() * 50) + 10; // 10-60 coins for testing
  }
  
  console.log(`Adding ${quantity} ${itemDef.name}(s) directly to inventory`);
  
  const addResult = addItemToInventory(itemId, quantity);
  console.log('Add result:', addResult);
  if (addResult) {
    showNotification(`Added ${quantity > 1 ? `${quantity} ` : ''}${itemDef.name}${quantity > 1 ? 's' : ''} to inventory!`, 'success');
  } else {
    showNotification('Inventory is full!', 'error');
  }
}

// Add a noted item to inventory for testing
function addNotedItemToInventory() {
  console.log('Adding noted item to inventory for testing');
  
  // Find an empty slot
  const emptySlot = playerInventory.findIndex(item => !item);
  if (emptySlot === -1) {
    showNotification('Inventory is full!', 'error');
    return;
  }
  
  // Create a noted apple with quantity 5 for testing
  playerInventory[emptySlot] = {
    id: 'apple',
    baseItemId: 'apple',
    noted: true,
    quantity: 5
  };
  
  updateInventoryDisplay();
  showNotification('Added 5 noted apples to inventory for testing!', 'success');
  console.log('Added noted item to slot', emptySlot, ':', playerInventory[emptySlot]);
}

// Enter use mode (OSRS style)
function enterUseMode(slotIndex) {
  const item = playerInventory[slotIndex];
  if (!item) return;
  
  // Check if item is noted - noted items can't be used (OSRS accuracy)
  if (isItemNoted(item)) {
    const itemDef = getItemDefinition(item.id);
    const itemName = itemDef ? itemDef.name : 'item';
    showNotification(`You cannot use a noted ${itemName}. Exchange it at a bank first.`, 'error');
    return;
  }
  
  const itemDef = getItemDefinition(item.id);
  if (!itemDef) return;
  
  // Cancel any existing use mode
  cancelUseMode();
  
  // Set use mode
  useMode.active = true;
  useMode.selectedSlot = slotIndex;
  useMode.selectedItem = item;
  
  // Update visual state
  updateInventoryUseMode();
  
  // Show use message
  showNotification(`Use ${itemDef.name} with...`);
  
  // Change cursor and add visual feedback
  document.body.style.cursor = 'crosshair';
}

// Cancel use mode
function cancelUseMode() {
  useMode.active = false;
  useMode.selectedSlot = -1;
  useMode.selectedItem = null;
  
  // Reset visual state
  updateInventoryUseMode();
  
  // Reset cursor
  document.body.style.cursor = 'default';
}

// Use item on another item
function useItemOnItem(sourceSlot, targetSlot) {
  const sourceItem = playerInventory[sourceSlot];
  const targetItem = playerInventory[targetSlot];
  
  if (!sourceItem || !targetItem) {
    cancelUseMode();
    return;
  }
  
  // Check if either item is noted - noted items can't be used (OSRS accuracy)
  if (isItemNoted(sourceItem)) {
    const itemDef = getItemDefinition(sourceItem.id);
    const itemName = itemDef ? itemDef.name : 'item';
    showNotification(`You cannot use a noted ${itemName}. Exchange it at a bank first.`, 'error');
    cancelUseMode();
    return;
  }
  
  if (isItemNoted(targetItem)) {
    const itemDef = getItemDefinition(targetItem.id);
    const itemName = itemDef ? itemDef.name : 'item';
    showNotification(`You cannot use items with a noted ${itemName}. Exchange it at a bank first.`, 'error');
    cancelUseMode();
    return;
  }
  
  const sourceDef = getItemDefinition(sourceItem.id);
  const targetDef = getItemDefinition(targetItem.id);
  
  if (!sourceDef || !targetDef) {
    cancelUseMode();
    return;
  }
  
  console.log(`Inventory: Using ${sourceDef.name} on ${targetDef.name}`);
  
  // Dispatch custom event for other modules to handle
  const itemUsedEvent = new CustomEvent('itemUsedOnItem', {
    detail: {
      sourceItem: sourceItem,
      targetItem: targetItem,
      sourceSlot: sourceSlot,
      targetSlot: targetSlot
    }
  });
  document.dispatchEvent(itemUsedEvent);
  
  // Check for item combinations
  const combination = checkItemCombination(sourceItem.id, targetItem.id);
  
  if (combination) {
    // Perform the combination
    performItemCombination(combination, sourceSlot, targetSlot);
  } else {
    // No combination exists
    showNotification('Nothing interesting happens.');
  }
  
  // Cancel use mode
  cancelUseMode();
}

// Update inventory visual state for use mode
function updateInventoryUseMode() {
  const slots = document.querySelectorAll('.inventory-slot');
  
  slots.forEach((slot, index) => {
    slot.classList.remove('use-mode', 'use-target');
    
    if (useMode.active) {
      if (index === useMode.selectedSlot) {
        slot.classList.add('use-mode');
      } else if (playerInventory[index]) {
        slot.classList.add('use-target');
      }
    }
  });
}

// Check if two items can be combined
function checkItemCombination(item1Id, item2Id) {
  // Try both orders and return both the combination and whether it was reversed
  const combo1 = `${item1Id}+${item2Id}`;
  const combo2 = `${item2Id}+${item1Id}`;
  
  if (itemCombinations[combo1]) {
    return { combination: itemCombinations[combo1], reversed: false };
  }
  
  if (itemCombinations[combo2]) {
    return { combination: itemCombinations[combo2], reversed: true };
  }
  
  return null;
}

// Perform item combination
function performItemCombination(combinationData, sourceSlot, targetSlot) {
  const sourceItem = playerInventory[sourceSlot];
  const targetItem = playerInventory[targetSlot];
  
  if (!combinationData) return;
  
  const { combination, reversed } = combinationData;
  
  // Check for custom handler first (for skills like fletching)
  if (combination.customHandler) {
    console.log('Inventory: Found custom handler, calling it...');
    try {
      const result = combination.customHandler(sourceSlot, targetSlot);
      if (result === true) {
        console.log('Inventory: Custom handler handled the combination successfully');
        return; // Custom handler handled everything
      }
    } catch (error) {
      console.error('Inventory: Error in custom handler:', error);
    }
  }
  
  // Show the combination message
  showNotification(combination.message);
  
  // Determine which items to consume based on whether the combination was reversed
  let consumeSourceSlot = false;
  let consumeTargetSlot = false;
  
  if (reversed) {
    // If the combination was found in reverse order, swap the consumption logic
    consumeSourceSlot = combination.consumeTarget;
    consumeTargetSlot = combination.consumeSource;
  } else {
    // Use the combination as defined
    consumeSourceSlot = combination.consumeSource;
    consumeTargetSlot = combination.consumeTarget;
  }
  
  // Handle item consumption carefully to avoid slot shifting issues
  // First, create a list of slots to remove (in descending order to avoid index shifting)
  const slotsToRemove = [];
  
  if (consumeSourceSlot) {
    slotsToRemove.push(sourceSlot);
  }
  
  if (consumeTargetSlot) {
    slotsToRemove.push(targetSlot);
  }
  
  // Sort slots in descending order so higher indices are removed first
  // This prevents index shifting from affecting lower indices
  slotsToRemove.sort((a, b) => b - a);
  
  // Remove items from inventory (starting with highest index)
  for (const slotIndex of slotsToRemove) {
    removeItemFromInventory(slotIndex);
  }
  
  // If there's a result item, try to add it (after consuming source items)
  if (combination.result) {
    const addSuccess = addItemToInventory(combination.result.id, combination.result.quantity);
    
    if (!addSuccess) {
      showNotification("Your inventory is too full to create the result!");
      // TODO: Could restore consumed items here if needed
      return;
    }
  }
}

// Create drag preview element
function createDragPreview(item, x, y) {
  const itemDef = getItemDefinition(item.id);
  if (!itemDef) return;
  
  // Remove any existing drag preview
  removeDragPreview();
  
  const dragPreview = document.createElement('div');
  dragPreview.className = 'drag-preview';
  dragPreview.id = 'drag-preview';
  
  // Apply color tinting if the item has a colorTint property
  const tintClass = itemDef.colorTint ? 'tinted' : '';
  const tintStyle = itemDef.colorTint ? `color: ${itemDef.colorTint};` : '';
  
  // Check if this is a noted item and display accordingly
  if (isItemNoted(item)) {
    // Display noted item with special icon
    const baseIcon = itemDef.getIcon ? itemDef.getIcon(1) : itemDef.icon;
    dragPreview.innerHTML = `
      <div class="inventory-item ${tintClass}" style="${tintStyle}">
        <div class="noted-item-container">
          <span class="note-background">📜</span>
          <span class="noted-icon">${baseIcon}</span>
        </div>
        ${item.quantity > 1 ? `<div class="inventory-item-count">${item.quantity}</div>` : ''}
      </div>
    `;
  } else {
    // Regular item display
    // Use dynamic icon if available (for coins), otherwise use default icon
    const icon = itemDef.getIcon ? itemDef.getIcon(item.quantity || 1) : itemDef.icon;
    
    dragPreview.innerHTML = `
      <div class="inventory-item ${tintClass}" style="${tintStyle}">
        ${icon}
        ${(itemDef.stackable || item.quantity > 1) && item.quantity > 1 ? 
          `<div class="inventory-item-count">${item.quantity}</div>` : ''
        }
      </div>
    `;
  }
  
  // Position at mouse coordinates
  dragPreview.style.left = `${x}px`;
  dragPreview.style.top = `${y}px`;
  
  document.body.appendChild(dragPreview);
  dragState.dragElement = dragPreview;
}

// Remove drag preview element
function removeDragPreview() {
  const existingPreview = document.getElementById('drag-preview');
  if (existingPreview) {
    existingPreview.remove();
  }
}

// Swap items between two inventory slots
function swapInventorySlots(fromSlot, toSlot) {
  if (fromSlot === toSlot) return;
  
  const fromItem = playerInventory[fromSlot];
  const toItem = playerInventory[toSlot];
  
  // Perform the swap
  playerInventory[fromSlot] = toItem;
  playerInventory[toSlot] = fromItem;
  
  // Update inventory display
  updateInventoryDisplay();
  
  console.log(`Swapped inventory slots ${fromSlot} and ${toSlot}`);
}

// Clean up drag state and visual feedback
function cleanupDragState() {
  // Remove drag preview
  removeDragPreview();
  
  // Remove all drag-related CSS classes
  document.querySelectorAll('.inventory-slot.drag-source').forEach(slot => {
    slot.classList.remove('drag-source');
  });
  
  document.querySelectorAll('.inventory-slot.drag-target').forEach(slot => {
    slot.classList.remove('drag-target');
  });
  
  // Reset drag state
  dragState.active = false;
  dragState.draggedSlot = -1;
  dragState.draggedItem = null;
  dragState.dragElement = null;
  dragState.startX = 0;
  dragState.startY = 0;
}

// Open bank interface (deprecated - now forwards to bank module)
function openBank() {
  if (window.bankModule && typeof window.bankModule.openBank === 'function') {
    console.debug('[INVENTORY.JS] openBank forwarding to bankModule.openBank');
    window.bankModule.openBank();
    return;
  }
  // Fallback to legacy implementation if the new module is unavailable
  console.warn('[INVENTORY.JS] openBank legacy fallback invoked – consider migrating completely to bankModule');
  console.log('[INVENTORY.JS] openBank called - THIS IS THE OLD DEPRECATED FUNCTION!');
  console.log('BANK: Opening bank interface');
  
  // Always remove existing bank overlay to ensure fresh interface with new features
  const existingBankOverlay = document.getElementById('bank-overlay');
  if (existingBankOverlay) {
    existingBankOverlay.remove();
    console.log('BANK: Removed existing bank overlay for fresh interface');
  }
  
  // Create new bank interface with updated features
  const bankOverlay = createBankInterface();
  
  // Show the bank interface
  bankInterface.open = true;
  bankOverlay.style.display = 'block';
  
  // Update both bank and inventory displays
  updateBankDisplay();
  updateBankInventoryDisplay();
}

// Create bank interface
function createBankInterface() {
  const bankOverlay = document.createElement('div');
  bankOverlay.id = 'bank-overlay';
  bankOverlay.className = 'bank-overlay';
  
  bankOverlay.innerHTML = `
    <div class="bank-interface">
      <div class="bank-header">
        <div class="bank-title">🏦 Bank of WebscapeRPG</div>
        <button class="bank-close" id="bank-close-btn">✕ Close</button>
      </div>
      
      <div class="bank-content">
        <div class="bank-section">
          <div class="bank-section-title">Bank Storage</div>
          <div class="bank-search-container">
            <input type="text" id="bank-search" class="bank-search" placeholder="Search items..." />
            <button class="bank-search-clear" id="bank-search-clear">✕</button>
          </div>
          <div class="bank-tabs" id="bank-tabs">
            ${bankTabs.map((tab, index) => 
              `<button class="bank-tab ${index === 0 ? 'active' : ''}" data-tab="${index}" data-tab-id="${tab.id}">
                <span class="tab-icon">${tab.icon}</span>
                <span class="tab-name">${tab.name}</span>
              </button>`
            ).join('')}
          </div>
          <div class="bank-grid" id="bank-grid">
            ${Array(Math.min(BANK_SIZE, 200)).fill().map((_, i) => 
              `<div class="bank-slot" data-slot="${i}"></div>`
            ).join('')}
          </div>
          <div class="bank-actions">
            <button class="bank-button" id="deposit-all-btn">Deposit All</button>
            <button class="bank-withdraw-mode-toggle" id="withdraw-noted-btn" title="Toggle withdraw noted items">
              <span class="withdraw-mode-icon">🚫📜</span>
            </button>
          </div>
        </div>
        
        <div class="bank-section">
          <div class="bank-section-title">Your Inventory</div>
          <div class="bank-inventory-grid" id="bank-inventory-grid">
            ${Array(INVENTORY_SIZE).fill().map((_, i) => 
              `<div class="bank-inventory-slot" data-slot="${i}"></div>`
            ).join('')}
          </div>
          <div class="bank-actions">
            <button class="bank-button" id="deposit-inventory-btn">Deposit Inventory</button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(bankOverlay);
  
  // Setup event handlers
  setupBankHandlers();
  
  return bankOverlay;
}

// Setup bank event handlers
function setupBankHandlers() {
  const bankOverlay = document.getElementById('bank-overlay');
  const closeBtn = document.getElementById('bank-close-btn');
  const depositAllBtn = document.getElementById('deposit-all-btn');
  const depositInventoryBtn = document.getElementById('deposit-inventory-btn');
  const withdrawAllBtn = document.getElementById('withdraw-all-btn');
  const withdrawNotedBtn = document.getElementById('withdraw-noted-btn');
  const bankGrid = document.getElementById('bank-grid');
  const bankInventoryGrid = document.getElementById('bank-inventory-grid');
  const bankSearch = document.getElementById('bank-search');
  const bankSearchClear = document.getElementById('bank-search-clear');
  const bankTabs = document.querySelectorAll('.bank-tab');
  
  // Enable withdraw noted button and set up toggle functionality
  if (withdrawNotedBtn) {
    withdrawNotedBtn.disabled = false;
    withdrawNotedBtn.addEventListener('click', () => {
      bankNotedMode = !bankNotedMode;
      
      // Update the icon based on the mode
      const iconElement = withdrawNotedBtn.querySelector('.withdraw-mode-icon');
      if (iconElement) {
        iconElement.textContent = bankNotedMode ? '✅📜' : '🚫📜';
      }
      
      // Update tooltip
      withdrawNotedBtn.title = bankNotedMode ? 'Withdraw items as notes (Click to toggle)' : 'Withdraw items normally (Click to toggle)';
      
      // Update button styling to show active state
      if (bankNotedMode) {
        withdrawNotedBtn.classList.add('active');
      } else {
        withdrawNotedBtn.classList.remove('active');
      }
      
      showNotification(bankNotedMode ? 'Withdraw mode: Noted items' : 'Withdraw mode: Regular items');
    });
  }
  
  // Tab functionality
  const bankTabElements = document.querySelectorAll('.bank-tab');
  bankTabElements.forEach(tab => {
    tab.addEventListener('click', () => {
      // Remove active class from all tabs
      bankTabElements.forEach(t => t.classList.remove('active'));
      // Add active class to clicked tab
      tab.classList.add('active');
      // Switch to selected tab
      const tabIndex = parseInt(tab.dataset.tab);
      switchBankTab(tabIndex);
    });
    
    // Right-click for tab customization
    tab.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const tabIndex = parseInt(tab.dataset.tab);
      if (tabIndex > 0) { // Don't allow customization of "All" tab
        showTabCustomizationModal(tabIndex);
      }
    });
  });
  
  // Search functionality
  if (bankSearch) {
    bankSearch.addEventListener('input', (e) => {
      filterBankItems(e.target.value.toLowerCase());
    });
  }
  
  if (bankSearchClear) {
    bankSearchClear.addEventListener('click', () => {
      if (bankSearch) {
        bankSearch.value = '';
        filterBankItems('');
      }
    });
  }
  
  // Close bank
  closeBtn.addEventListener('click', closeBank);
  bankOverlay.addEventListener('click', (e) => {
    if (e.target === bankOverlay) {
      closeBank();
    }
  });
  
  // Deposit all items from inventory
  depositAllBtn.addEventListener('click', () => {
    for (let i = 0; i < INVENTORY_SIZE; i++) {
      if (playerInventory[i]) {
        const item = playerInventory[i];
        depositItemToBank(i, item.quantity || 1);
      }
    }
    updateBankDisplay();
    updateBankInventoryDisplay();
    updateInventoryDisplay();
  });
  
  // Deposit entire inventory (same as deposit all for now)
  depositInventoryBtn.addEventListener('click', () => {
    for (let i = 0; i < INVENTORY_SIZE; i++) {
      if (playerInventory[i]) {
        const item = playerInventory[i];
        depositItemToBank(i, item.quantity || 1);
      }
    }
    updateBankDisplay();
    updateBankInventoryDisplay();
    updateInventoryDisplay();
  });
  
  // Bank grid clicks (withdraw items)
  bankGrid.addEventListener('click', (e) => {
    const slot = e.target.closest('.bank-slot');
    if (!slot) return;
    
    const slotIndex = parseInt(slot.dataset.slot);
    
    // Get item from current tab's storage instead of hardcoded bankStorage
    const currentStorage = getCurrentTabStorage();
    const item = currentStorage[slotIndex];
    
    if (item) {
      withdrawItemFromBank(slotIndex, 1);
      updateBankDisplay();
      updateBankInventoryDisplay();
      updateInventoryDisplay();
    }
  });
  
  // Bank grid right-clicks (withdraw options)
  bankGrid.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const slot = e.target.closest('.bank-slot');
    if (!slot) return;
    
    const slotIndex = parseInt(slot.dataset.slot);
    
    // Get item from current tab's storage instead of hardcoded bankStorage
    const currentStorage = getCurrentTabStorage();
    const item = currentStorage[slotIndex];
    
    if (item) {
      showBankWithdrawMenu(e, slotIndex);
    }
  });
  
  // Bank inventory grid clicks (deposit items)
  bankInventoryGrid.addEventListener('click', (e) => {
    const slot = e.target.closest('.bank-inventory-slot');
    if (!slot) return;
    
    const slotIndex = parseInt(slot.dataset.slot);
    const item = playerInventory[slotIndex];
    
    if (item) {
      depositItemToBank(slotIndex, 1); // Always deposit 1 item on left-click (OSRS style)
      updateBankDisplay();
      updateBankInventoryDisplay();
      updateInventoryDisplay();
    }
  });
  
  // Bank inventory grid right-clicks (deposit options)
  bankInventoryGrid.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const slot = e.target.closest('.bank-inventory-slot');
    if (!slot) return;
    
    const slotIndex = parseInt(slot.dataset.slot);
    const item = playerInventory[slotIndex];
    
    if (item) {
      showBankDepositMenu(e, slotIndex);
    }
  });
  
  // Bank drag and drop functionality
  bankGrid.addEventListener('mousedown', (e) => {
    // Only handle left mouse button
    if (e.button !== 0) return;
    
    const slot = e.target.closest('.bank-slot');
    if (!slot) return;
    
    const slotIndex = parseInt(slot.dataset.slot);
    
    // Get item from current tab's storage instead of hardcoded bankStorage
    const currentStorage = getCurrentTabStorage();
    const item = currentStorage[slotIndex];
    
    // Only start drag if there's an item in the slot
    if (!item) return;
    
    // Prevent default to avoid text selection
    e.preventDefault();
    
    // Initialize bank drag state
    window.bankDragState = {
      active: true,
      draggedSlot: slotIndex,
      draggedItem: item,
      startX: e.clientX,
      startY: e.clientY,
      dragElement: null
    };
    
    // Create drag preview element for bank
    createBankDragPreview(item, e.clientX, e.clientY);
    
    // Add visual feedback to source slot
    slot.classList.add('drag-source');
    
    console.log(`Started dragging bank item from slot ${slotIndex} in tab ${bankInterface.currentTab}:`, item);
  });
  
  // Global mouse move handler for bank drag preview
  document.addEventListener('mousemove', (e) => {
    if (!window.bankDragState || !window.bankDragState.active || !window.bankDragState.dragElement) return;
    
    // Update drag preview position
    window.bankDragState.dragElement.style.left = `${e.clientX}px`;
    window.bankDragState.dragElement.style.top = `${e.clientY}px`;
    
    // Check what we're hovering over
    const elementUnder = document.elementFromPoint(e.clientX, e.clientY);
    const targetSlot = elementUnder ? elementUnder.closest('.bank-slot') : null;
    
    // Remove previous drag target highlighting
    document.querySelectorAll('.bank-slot.drag-target').forEach(slot => {
      slot.classList.remove('drag-target');
    });
    
    // Add drag target highlighting if over a valid slot
    if (targetSlot && targetSlot.dataset.slot !== undefined) {
      const targetSlotIndex = parseInt(targetSlot.dataset.slot);
      if (targetSlotIndex !== window.bankDragState.draggedSlot) {
        targetSlot.classList.add('drag-target');
      }
    }
  });
  
  // Global mouse up handler for bank drop
  document.addEventListener('mouseup', (e) => {
    if (!window.bankDragState || !window.bankDragState.active) return;
    
    // Find what we're dropping on
    const elementUnder = document.elementFromPoint(e.clientX, e.clientY);
    
    // Check if we're dropping on a tab first
    const targetTab = elementUnder ? elementUnder.closest('.bank-tab') : null;
    if (targetTab && targetTab.dataset.tab !== undefined) {
      // Tab will handle this drop, don't continue with normal slot handling
      return;
    }
    
    // Check for bank slot drops
    const targetSlot = elementUnder ? elementUnder.closest('.bank-slot') : null;
    
    let dropSuccessful = false;
    
    if (targetSlot && targetSlot.dataset.slot !== undefined) {
      const targetSlotIndex = parseInt(targetSlot.dataset.slot);
      
      // Only swap if dropping on a different slot
      if (targetSlotIndex !== window.bankDragState.draggedSlot) {
        swapBankSlots(window.bankDragState.draggedSlot, targetSlotIndex);
        dropSuccessful = true;
        console.log(`Swapped bank items between slots ${window.bankDragState.draggedSlot} and ${targetSlotIndex}`);
      }
    }
    
    if (!dropSuccessful) {
      console.log('Bank drag cancelled - dropped outside valid area or on same slot');
    }
    
    // Clean up bank drag state
    cleanupBankDragState();
  });
  
  // Add drag-to-tab functionality
  addBankTabDragFunctionality();
}

// Close bank interface (deprecated - now forwards to bank module)
function closeBank() {
  if (window.bankModule && typeof window.bankModule.closeBank === 'function') {
    console.debug('[INVENTORY.JS] closeBank forwarding to bankModule.closeBank');
    window.bankModule.closeBank();
    return;
  }
  console.warn('[INVENTORY.JS] closeBank legacy fallback invoked – consider migrating completely to bankModule');
  console.log('BANK: Closing bank interface');
  
  const bankOverlay = document.getElementById('bank-overlay');
  if (bankOverlay) {
    bankOverlay.style.display = 'none';
  }
  
  bankInterface.open = false;
  bankInterface.selectedSlot = -1;
  bankInterface.selectedItem = null;
}

// Deposit item to bank (deprecated - now forwards to bank module)
function depositItemToBank(inventorySlot, quantity = 1) {
  // Forward to new bank system if present
  if (window.bankModuleFunctions && typeof window.bankModuleFunctions.depositItem === 'function') {
    console.debug('[INVENTORY.JS] depositItemToBank forwarding to bankModuleFunctions.depositItem', { inventorySlot, quantity });
    return window.bankModuleFunctions.depositItem(inventorySlot, quantity);
  }
  console.warn('[INVENTORY.JS] depositItemToBank fallback called – bankModuleFunctions not available');
  return false;
}

// Withdraw item from bank (deprecated - now forwards to bank module)
function withdrawItemFromBank(bankSlot, quantity = 1) {
  // Forward to new bank system if present
  if (window.bankModuleFunctions && typeof window.bankModuleFunctions.withdrawItem === 'function') {
    console.debug('[INVENTORY.JS] withdrawItemFromBank forwarding to bankModuleFunctions.withdrawItem', { bankSlot, quantity });
    return window.bankModuleFunctions.withdrawItem(bankSlot, quantity);
  }
  console.warn('[INVENTORY.JS] withdrawItemFromBank fallback called – bankModuleFunctions not available');
  return false;
}

// Show bank withdraw context menu
function showBankWithdrawMenu(event, bankSlot) {
  // Get the source storage based on current tab
  let sourceStorage;
  if (bankInterface.currentTab === 0) {
    sourceStorage = bankStorage;
  } else {
    sourceStorage = bankTabs[bankInterface.currentTab].items;
  }
  
  const item = sourceStorage[bankSlot];
  if (!item) return;
  
  const itemDef = getItemDefinition(item.id);
  if (!itemDef) return;
  
  // Remove any existing context menu
  hideBankContextMenu();
  
  const contextMenu = document.createElement('div');
  contextMenu.id = 'bank-context-menu';
  contextMenu.className = 'bank-context-menu';
  contextMenu.style.position = 'fixed';
  contextMenu.style.backgroundColor = '#2a2a2a';
  contextMenu.style.border = '1px solid #555';
  contextMenu.style.borderRadius = '5px';
  contextMenu.style.padding = '5px 0';
  contextMenu.style.zIndex = '2001';
  contextMenu.style.minWidth = '150px';
  contextMenu.style.boxShadow = '0 2px 10px rgba(0,0,0,0.5)';
  
  // Check if this item can be noted
  const canBeNoted = canItemBeNoted(item.id);
  const currentModeText = bankNotedMode ? 'noted' : 'regular';
  
  // Withdraw 1
  const withdraw1Text = bankNotedMode && canBeNoted ? 'Withdraw 1 (noted)' : 'Withdraw 1';
  const withdraw1 = createBankContextMenuItem(withdraw1Text, () => {
    withdrawItemFromBank(bankSlot, 1);
    updateBankDisplay();
    updateBankInventoryDisplay();
    updateInventoryDisplay();
    hideBankContextMenu();
  });
  contextMenu.appendChild(withdraw1);
  
  // Withdraw 5 (if more than 5 available)
  if (item.quantity >= 5) {
    const withdraw5Text = bankNotedMode && canBeNoted ? 'Withdraw 5 (noted)' : 'Withdraw 5';
    const withdraw5 = createBankContextMenuItem(withdraw5Text, () => {
      withdrawItemFromBank(bankSlot, Math.min(5, item.quantity));
      updateBankDisplay();
      updateBankInventoryDisplay();
      updateInventoryDisplay();
      hideBankContextMenu();
    });
    contextMenu.appendChild(withdraw5);
  }
  
  // Withdraw 10 (if more than 10 available)
  if (item.quantity >= 10) {
    const withdraw10Text = bankNotedMode && canBeNoted ? 'Withdraw 10 (noted)' : 'Withdraw 10';
    const withdraw10 = createBankContextMenuItem(withdraw10Text, () => {
      withdrawItemFromBank(bankSlot, Math.min(10, item.quantity));
      updateBankDisplay();
      updateBankInventoryDisplay();
      updateInventoryDisplay();
      hideBankContextMenu();
    });
    contextMenu.appendChild(withdraw10);
  }
  
  // Withdraw X (custom amount) - always show for multiple items
  if (item.quantity > 1) {
    const withdrawXText = bankNotedMode && canBeNoted ? 'Withdraw X (noted)' : 'Withdraw X';
    const withdrawX = createBankContextMenuItem(withdrawXText, () => {
      const amount = prompt(`How many ${itemDef.name}s would you like to withdraw? (Available: ${item.quantity})`, '1');
      if (amount && !isNaN(amount)) {
        const quantity = Math.min(parseInt(amount), item.quantity);
        if (quantity > 0) {
          withdrawItemFromBank(bankSlot, quantity);
          updateBankDisplay();
          updateBankInventoryDisplay();
          updateInventoryDisplay();
        }
      }
      hideBankContextMenu();
    });
    contextMenu.appendChild(withdrawX);
  }
  
  // Withdraw all - always show for multiple items
  if (item.quantity > 1) {
    const withdrawAllText = bankNotedMode && canBeNoted ? 
      `Withdraw All (${item.quantity}) (noted)` : 
      `Withdraw All (${item.quantity})`;
    const withdrawAll = createBankContextMenuItem(withdrawAllText, () => {
      withdrawItemFromBank(bankSlot, item.quantity);
      updateBankDisplay();
      updateBankInventoryDisplay();
      updateInventoryDisplay();
      hideBankContextMenu();
    });
    contextMenu.appendChild(withdrawAll);
  }
  
  // Add separator if we have alternative withdraw modes
  if (canBeNoted) {
    const separator = document.createElement('div');
    separator.style.borderTop = '1px solid #444';
    separator.style.margin = '5px 0';
    contextMenu.appendChild(separator);
    
    // Alternative mode option
    const altModeText = bankNotedMode ? 'Withdraw 1 (items)' : 'Withdraw 1 (noted)';
    const altMode = createBankContextMenuItem(altModeText, () => {
      // Temporarily toggle mode for this withdrawal
      const originalMode = bankNotedMode;
      bankNotedMode = !bankNotedMode;
      withdrawItemFromBank(bankSlot, 1);
      bankNotedMode = originalMode; // Restore original mode
      updateBankDisplay();
      updateBankInventoryDisplay();
      updateInventoryDisplay();
      hideBankContextMenu();
    });
    contextMenu.appendChild(altMode);
  }
  
  // Position the menu
  contextMenu.style.left = `${event.pageX}px`;
  contextMenu.style.top = `${event.pageY}px`;
  
  document.body.appendChild(contextMenu);
}

// Show bank deposit context menu
function showBankDepositMenu(event, inventorySlot) {
  const item = playerInventory[inventorySlot];
  if (!item) return;
  
  const itemDef = getItemDefinition(item.id);
  if (!itemDef) return;
  
  // Remove any existing context menu
  hideBankContextMenu();
  
  const contextMenu = document.createElement('div');
  contextMenu.id = 'bank-context-menu';
  contextMenu.className = 'bank-context-menu';
  contextMenu.style.position = 'fixed';
  contextMenu.style.backgroundColor = '#2a2a2a';
  contextMenu.style.border = '1px solid #555';
  contextMenu.style.borderRadius = '5px';
  contextMenu.style.padding = '5px 0';
  contextMenu.style.zIndex = '2001';
  contextMenu.style.minWidth = '150px';
  contextMenu.style.boxShadow = '0 2px 10px rgba(0,0,0,0.5)';
  
  const itemQuantity = item.quantity || 1;
  
  // Check if this item should be treated as stackable (noted items are always stackable)
  const isStackable = isItemNoted(item) || itemDef.stackable;
  
  // For non-stackable items, count how many we have of this type across all inventory slots
  // For noted and stackable items, use the quantity from the current stack
  let totalItemCount = itemQuantity;
  if (!isStackable) {
    totalItemCount = playerInventory.filter(invItem => invItem && invItem.id === item.id && !isItemNoted(invItem)).length;
  }
  
  // Deposit 1
  const deposit1 = createBankContextMenuItem('Deposit 1', () => {
    depositItemToBank(inventorySlot, 1);
    updateBankDisplay();
    updateBankInventoryDisplay();
    updateInventoryDisplay();
    hideBankContextMenu();
  });
  contextMenu.appendChild(deposit1);
  
  // Deposit 5 (if more than 5 available or for non-stackable items with multiple instances)
  if (totalItemCount >= 5 || (!isStackable && totalItemCount > 1)) {
    const deposit5 = createBankContextMenuItem('Deposit 5', () => {
      if (isStackable) {
        depositItemToBank(inventorySlot, Math.min(5, itemQuantity));
      } else {
        // For non-stackable items, deposit from multiple slots
        depositMultipleNonStackableItems(item.id, 5);
      }
      updateBankDisplay();
      updateBankInventoryDisplay();
      updateInventoryDisplay();
      hideBankContextMenu();
    });
    contextMenu.appendChild(deposit5);
  }
  
  // Deposit 10 (if more than 10 available or for non-stackable items with multiple instances)
  if (totalItemCount >= 10 || (!isStackable && totalItemCount > 1)) {
    const deposit10 = createBankContextMenuItem('Deposit 10', () => {
      if (isStackable) {
        depositItemToBank(inventorySlot, Math.min(10, itemQuantity));
      } else {
        // For non-stackable items, deposit from multiple slots
        depositMultipleNonStackableItems(item.id, 10);
      }
      updateBankDisplay();
      updateBankInventoryDisplay();
      updateInventoryDisplay();
      hideBankContextMenu();
    });
    contextMenu.appendChild(deposit10);
  }
  
  // Deposit X (custom amount) - always show for multiple items
  if (totalItemCount > 1) {
    const depositX = createBankContextMenuItem('Deposit X', () => {
      const itemName = isItemNoted(item) ? `${itemDef.name} (noted)` : itemDef.name;
      const amount = prompt(`How many ${itemName}s would you like to deposit? (Available: ${totalItemCount})`, '1');
      if (amount && !isNaN(amount)) {
        const quantity = Math.min(parseInt(amount), totalItemCount);
        if (quantity > 0) {
          if (isStackable) {
            depositItemToBank(inventorySlot, quantity);
          } else {
            // For non-stackable items, deposit from multiple slots
            depositMultipleNonStackableItems(item.id, quantity);
          }
          updateBankDisplay();
          updateBankInventoryDisplay();
          updateInventoryDisplay();
        }
      }
      hideBankContextMenu();
    });
    contextMenu.appendChild(depositX);
  }
  
  // Deposit all - always show for multiple items
  if (totalItemCount > 1) {
    const depositAll = createBankContextMenuItem(`Deposit All (${totalItemCount})`, () => {
      if (isStackable) {
        depositItemToBank(inventorySlot, itemQuantity);
      } else {
        // For non-stackable items, deposit from multiple slots
        depositMultipleNonStackableItems(item.id, totalItemCount);
      }
      updateBankDisplay();
      updateBankInventoryDisplay();
      updateInventoryDisplay();
      hideBankContextMenu();
    });
    contextMenu.appendChild(depositAll);
  }
  
  // Position the menu
  contextMenu.style.left = `${event.pageX}px`;
  contextMenu.style.top = `${event.pageY}px`;
  
  document.body.appendChild(contextMenu);
}

// Create bank context menu item
function createBankContextMenuItem(text, onClick) {
  const item = document.createElement('div');
  item.className = 'bank-context-menu-item';
  item.textContent = text;
  item.style.padding = '8px 15px';
  item.style.cursor = 'pointer';
  item.style.color = '#ccc';
  item.style.transition = 'background-color 0.2s';
  item.style.fontSize = '13px';
  
  item.addEventListener('mouseenter', () => {
    item.style.backgroundColor = '#3a3a3a';
  });
  
  item.addEventListener('mouseleave', () => {
    item.style.backgroundColor = 'transparent';
  });
  
  item.addEventListener('click', onClick);
  
  return item;
}

// Hide bank context menu
function hideBankContextMenu() {
  const existingMenu = document.getElementById('bank-context-menu');
  if (existingMenu) {
    existingMenu.remove();
  }
}

// Hide context menu when clicking elsewhere
document.addEventListener('click', (e) => {
  if (!e.target.closest('#bank-context-menu')) {
    hideBankContextMenu();
  }
  if (!e.target.closest('#shop-sell-menu')) {
    hideShopSellMenu();
  }
  if (!e.target.closest('#shop-buy-menu')) {
    hideShopBuyMenu();
  }
});

// Update bank display
function updateBankDisplay() {
  const bankGrid = document.getElementById('bank-grid');
  if (!bankGrid) return;
  
  const slots = bankGrid.querySelectorAll('.bank-slot');
  const currentStorage = getCurrentTabStorage();
  
  slots.forEach((slot, index) => {
    let item = null;
    
    if (bankInterface.currentTab === 0) {
      // "All" tab: show items from main storage
      item = bankStorage[index];
    } else {
      // Specific tab: show items from that tab's storage
      item = bankTabs[bankInterface.currentTab].items[index];
    }
    
    if (item) {
      const itemDef = getItemDefinition(item.id);
      if (itemDef) {
        slot.classList.add('occupied');
        const tintStyle = itemDef.colorTint ? `color: ${itemDef.colorTint};` : '';
        const tintClass = itemDef.colorTint ? 'tinted' : '';
        
        // Use dynamic icon if available (for coins), otherwise use default icon
        const icon = itemDef.getIcon ? itemDef.getIcon(item.quantity || 1) : itemDef.icon;
        
        slot.innerHTML = `
          <div class="bank-item ${tintClass}" style="${tintStyle}">
            ${icon}
            ${item.quantity > 1 ? 
              `<div class="bank-item-count">${item.quantity}</div>` : ''
            }
          </div>
        `;
        slot.title = `${itemDef.name}${item.quantity > 1 ? ` (${item.quantity})` : ''} - Click to withdraw`;
      }
    } else {
      slot.classList.remove('occupied');
      slot.innerHTML = '';
      slot.title = '';
    }
  });
}

// Update bank inventory display
function updateBankInventoryDisplay() {
  const bankInventoryGrid = document.getElementById('bank-inventory-grid');
  if (!bankInventoryGrid) return;

  const slots = bankInventoryGrid.querySelectorAll('.bank-inventory-slot');
  slots.forEach((slot, index) => {
    const item = playerInventory[index];
    
    if (item) {
      const itemDef = getItemDefinition(item.id);
      if (itemDef) {
        slot.classList.add('occupied');
        const tintStyle = itemDef.colorTint ? `color: ${itemDef.colorTint};` : '';
        const tintClass = itemDef.colorTint ? 'tinted' : '';
        
        // Check if this is a noted item
        if (isItemNoted(item)) {
          // Display noted item with special icon
          const baseIcon = itemDef.getIcon ? itemDef.getIcon(1) : itemDef.icon;
          slot.innerHTML = `
            <div class="bank-item ${tintClass}" style="${tintStyle}">
              <div class="noted-item-container">
                <span class="note-background">📜</span>
                <span class="noted-icon">${baseIcon}</span>
              </div>
              ${item.quantity > 1 ? 
                `<div class="bank-item-count">${item.quantity}</div>` : ''
              }
            </div>
          `;
          slot.title = `${itemDef.name} (noted)${item.quantity > 1 ? ` (${item.quantity})` : ''} - Click to deposit`;
        } else {
          // Regular item display
          // Use dynamic icon if available (for coins), otherwise use default icon
          const icon = itemDef.getIcon ? itemDef.getIcon(item.quantity || 1) : itemDef.icon;
          
          slot.innerHTML = `
            <div class="bank-item ${tintClass}" style="${tintStyle}">
              ${icon}
              ${(itemDef.stackable || item.quantity > 1) && item.quantity > 1 ? 
                `<div class="bank-item-count">${item.quantity}</div>` : ''
              }
            </div>
          `;
          slot.title = `${itemDef.name}${item.quantity > 1 ? ` (${item.quantity})` : ''} - Click to deposit`;
        }
      }
    } else {
      slot.classList.remove('occupied');
      slot.innerHTML = '';
      slot.title = '';
    }
  });
}

// Export functions
export {
  initializeInventory,
  addItemToInventory,
  removeItemFromInventory,
  updateInventoryDisplay,
  updateAllFloorItemPositions,
  resetInventory,
  getFloorItemsAt,
  getItemDefinition,
  pickupFloorItem,
  spawnItemNearPlayer,
  addRandomItemToInventory,
  openBank,
  closeBank,
  openShop,
  closeShop,
  createFloorItem,
  dropItem,
  playerInventory,
  floorItems,
  activeShops
};

/**
 * Sync shops from server (for multiplayer)
 */
function syncShopsFromServer(serverShops) {
  console.log('🏪 Syncing shops from server:', Object.keys(serverShops).length, 'shops');
  
  // Replace local shop state with server state
  for (const shopId in serverShops) {
    activeShops[shopId] = { ...serverShops[shopId] };
  }
  
  // If a shop is currently open, refresh its display
  if (shopInterface.open && shopInterface.currentShop) {
    const shopId = shopInterface.currentShop.id;
    if (activeShops[shopId]) {
      shopInterface.currentShop = activeShops[shopId];
      updateShopDisplay();
      console.log(`🏪 Refreshed display for open shop: ${shopId}`);
    }
  }
  
  console.log('🏪 Shop sync complete');
}

// Filter bank items based on search query
function filterBankItems(searchTerm) {
  const bankGrid = document.getElementById('bank-grid');
  if (!bankGrid) return;
  
  const slots = bankGrid.querySelectorAll('.bank-slot');
  
  slots.forEach((slot, index) => {
    let item = null;
    
    if (bankInterface.currentTab === 0) {
      item = bankStorage[index];
    } else {
      item = bankTabs[bankInterface.currentTab].items[index];
    }
    
    if (!item) {
      // Empty slots are always hidden during search (unless search is empty)
      if (searchTerm === '') {
        slot.classList.remove('hidden');
      } else {
        slot.classList.add('hidden');
      }
      return;
    }
    
    const itemDef = getItemDefinition(item.id);
    if (!itemDef) {
      slot.classList.add('hidden');
      return;
    }
    
    if (searchTerm === '') {
      // Show all items when search is empty
      slot.classList.remove('hidden');
    } else {
      // Check if item name contains search term
      const itemName = itemDef.name.toLowerCase();
      if (itemName.includes(searchTerm)) {
        slot.classList.remove('hidden');
      } else {
        slot.classList.add('hidden');
      }
    }
  });
}

// Add drag-to-tab functionality for bank items
function addBankTabDragFunctionality() {
  const bankTabElements = document.querySelectorAll('.bank-tab');
  
  bankTabElements.forEach(tab => {
    // Use mouse events to detect when dragging over tabs
    tab.addEventListener('mouseenter', (e) => {
      if (window.bankDragState && window.bankDragState.active) {
        // Highlight the tab when dragging over it
        tab.style.backgroundColor = '#4CAF50';
        tab.style.color = '#fff';
      }
    });
    
    tab.addEventListener('mouseleave', (e) => {
      if (window.bankDragState && window.bankDragState.active) {
        // Remove highlight when leaving tab
        tab.style.backgroundColor = '';
        tab.style.color = '';
      }
    });
    
    // Handle drop on tab
    tab.addEventListener('mouseup', (e) => {
      if (window.bankDragState && window.bankDragState.active) {
        e.preventDefault();
        e.stopPropagation();
        
        // Reset tab styling
        tab.style.backgroundColor = '';
        tab.style.color = '';
        
        const targetTabIndex = parseInt(tab.dataset.tab);
        const sourceSlot = window.bankDragState.draggedSlot;
        
        // Only move if we're dropping on a different tab than the current one
        if (targetTabIndex !== bankInterface.currentTab) {
          console.log(`Attempting to move item from slot ${sourceSlot} to tab ${targetTabIndex}`);
          const success = moveItemToTab(sourceSlot, targetTabIndex);
          if (success) {
            // Clean up drag state after successful move
            cleanupBankDragState();
            return; // Exit early to prevent normal drag cleanup
          }
        }
      }
    });
  });
}

// Deposit multiple non-stackable items of the same type from different inventory slots
function depositMultipleNonStackableItems(itemId, maxQuantity) {
  console.log('[INVENTORY.JS] depositMultipleNonStackableItems called - OLD DEPRECATED FUNCTION!', { itemId, maxQuantity });
  let deposited = 0;
  
  // Find all inventory slots containing this item, but iterate in reverse
  // to avoid issues with slots shifting when items are removed
  for (let i = INVENTORY_SIZE - 1; i >= 0 && deposited < maxQuantity; i--) {
    const item = playerInventory[i];
    if (item && item.id === itemId) {
      const quantityToDeposit = Math.min(item.quantity || 1, maxQuantity - deposited);
      if (depositItemToBank(i, quantityToDeposit)) {
        deposited += quantityToDeposit;
      }
    }
  }
  
  if (deposited > 0) {
    const itemDef = getItemDefinition(itemId);
    const itemName = itemDef ? itemDef.name : 'Unknown Item';
    showNotification(`Deposited ${deposited} ${itemName}${deposited > 1 ? 's' : ''}.`);
  }
  
  return deposited;
}

// Create bank drag preview element
function createBankDragPreview(item, x, y) {
  const itemDef = getItemDefinition(item.id);
  if (!itemDef) return;
  
  // Remove any existing bank drag preview
  removeBankDragPreview();
  
  const dragPreview = document.createElement('div');
  dragPreview.className = 'drag-preview';
  dragPreview.id = 'bank-drag-preview';
  
  // Apply color tinting if the item has a colorTint property
  const tintClass = itemDef.colorTint ? 'tinted' : '';
  const tintStyle = itemDef.colorTint ? `color: ${itemDef.colorTint};` : '';
  
  // Use dynamic icon if available (for coins), otherwise use default icon
  const icon = itemDef.getIcon ? itemDef.getIcon(item.quantity || 1) : itemDef.icon;
  
  dragPreview.innerHTML = `
    <div class="bank-item ${tintClass}" style="${tintStyle}">
      ${icon}
      ${item.quantity > 1 ? 
        `<div class="bank-item-count">${item.quantity}</div>` : ''
      }
    </div>
  `;
  
  // Position at mouse coordinates
  dragPreview.style.left = `${x}px`;
  dragPreview.style.top = `${y}px`;
  
  document.body.appendChild(dragPreview);
  window.bankDragState.dragElement = dragPreview;
}

// Remove bank drag preview element
function removeBankDragPreview() {
  const existingPreview = document.getElementById('bank-drag-preview');
  if (existingPreview) {
    existingPreview.remove();
  }
}

// Swap items between two bank slots
function swapBankSlots(fromSlot, toSlot) {
  if (fromSlot === toSlot) return;
  
  // Get the current tab's storage instead of always using main storage
  const currentStorage = getCurrentTabStorage();
  
  const fromItem = currentStorage[fromSlot];
  const toItem = currentStorage[toSlot];
  
  // Perform the swap
  currentStorage[fromSlot] = toItem;
  currentStorage[toSlot] = fromItem;
  
  // Update bank display
  updateBankDisplay();
  
  console.log(`Swapped bank slots ${fromSlot} and ${toSlot} in current tab`);
}

// Clean up bank drag state and visual feedback
function cleanupBankDragState() {
  if (!window.bankDragState) return;
  
  // Remove bank drag preview
  removeBankDragPreview();
  
  // Remove all bank drag-related CSS classes
  document.querySelectorAll('.bank-slot.drag-source').forEach(slot => {
    slot.classList.remove('drag-source');
  });
  
  document.querySelectorAll('.bank-slot.drag-target').forEach(slot => {
    slot.classList.remove('drag-target');
  });
  
  // Reset bank drag state
  window.bankDragState = {
    active: false,
    draggedSlot: -1,
    draggedItem: null,
    dragElement: null,
    startX: 0,
    startY: 0
  };
}

// Switch bank tab display
function switchBankTab(tabIndex) {
  bankInterface.currentTab = tabIndex;
  updateBankDisplay();
}

// Get current tab storage
function getCurrentTabStorage() {
  if (bankInterface.currentTab === 0) {
    // "All" tab shows all items across all tabs
    return bankStorage;
  } else {
    // Specific tab shows only items in that tab
    return bankTabs[bankInterface.currentTab].items;
  }
}

// Move item to specific tab
function moveItemToTab(fromSlot, toTabIndex) {
  // Get the source storage (where we're dragging from)
  let sourceStorage;
  if (bankInterface.currentTab === 0) {
    sourceStorage = bankStorage;
  } else {
    sourceStorage = bankTabs[bankInterface.currentTab].items;
  }
  
  const item = sourceStorage[fromSlot];
  if (!item) return false;
  
  const itemDef = getItemDefinition(item.id);
  if (!itemDef) return false;
  
  // Determine target storage
  let targetStorage;
  if (toTabIndex === 0) {
    targetStorage = bankStorage;
  } else {
    targetStorage = bankTabs[toTabIndex].items;
  }
  
  // Check if item can stack with existing items in target storage
  // In bank, ALL items are stackable (OSRS style)
  const existingStackSlot = targetStorage.findIndex(targetItem => 
    targetItem && targetItem.id === item.id
  );
  
  if (existingStackSlot !== -1) {
    // Stack with existing item
    targetStorage[existingStackSlot].quantity = (targetStorage[existingStackSlot].quantity || 1) + (item.quantity || 1);
    
    // Remove from source
    sourceStorage[fromSlot] = null;
    
    updateBankDisplay();
    
    const itemName = itemDef.name;
    const targetName = toTabIndex === 0 ? 'main storage' : bankTabs[toTabIndex].name;
    const totalQuantity = targetStorage[existingStackSlot].quantity;
    showNotification(`Stacked ${itemName} in ${targetName}. Total: ${totalQuantity}`);
    return true;
  } else {
    // No existing stack, find empty slot
    const emptySlot = targetStorage.findIndex(slot => !slot);
    
    if (emptySlot === -1) {
      // No space in target storage
      const targetName = toTabIndex === 0 ? 'main storage' : bankTabs[toTabIndex].name;
      showNotification(`No space in ${targetName}!`, 'error');
      return false;
    }
    
    // Move item to empty slot
    targetStorage[emptySlot] = { ...item }; // Create a copy to avoid reference issues
    
    // Remove from source
    sourceStorage[fromSlot] = null;
    
    updateBankDisplay();
    
    const itemName = itemDef.name;
    const targetName = toTabIndex === 0 ? 'main storage' : bankTabs[toTabIndex].name;
    showNotification(`Moved ${itemName} to ${targetName}.`);
    return true;
  }
}

// Show tab customization modal
function showTabCustomizationModal(tabIndex) {
  const tab = bankTabs[tabIndex];
  if (!tab) return;
  
  // Remove any existing modal
  const existingModal = document.getElementById('tab-icon-modal');
  if (existingModal) {
    existingModal.remove();
  }
  
  const modal = document.createElement('div');
  modal.id = 'tab-icon-modal';
  modal.className = 'tab-icon-modal';
  
  modal.innerHTML = `
    <h3 style="color: #fff; margin-top: 0;">Customize ${tab.name}</h3>
    <div>
      <label style="color: #ccc; display: block; margin-bottom: 5px;">Tab Name:</label>
      <input type="text" id="tab-name-input" value="${tab.name}" 
             style="width: 100%; padding: 8px; background: #333; border: 1px solid #555; color: #fff; border-radius: 3px;" 
             maxlength="10" />
    </div>
    <div>
      <label style="color: #ccc; display: block; margin: 15px 0 5px 0;">Select Icon:</label>
      <div class="tab-icon-grid">
        ${TAB_ICONS.map(icon => 
          `<div class="icon-option ${icon === tab.icon ? 'selected' : ''}" data-icon="${icon}">${icon}</div>`
        ).join('')}
      </div>
    </div>
    <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">
      <button id="tab-cancel-btn" style="padding: 8px 16px; background: #666; color: #fff; border: none; border-radius: 3px; cursor: pointer;">Cancel</button>
      <button id="tab-save-btn" style="padding: 8px 16px; background: #4CAF50; color: #fff; border: none; border-radius: 3px; cursor: pointer;">Save</button>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Handle icon selection
  const iconOptions = modal.querySelectorAll('.icon-option');
  let selectedIcon = tab.icon;
  
  iconOptions.forEach(option => {
    option.addEventListener('click', () => {
      iconOptions.forEach(opt => opt.classList.remove('selected'));
      option.classList.add('selected');
      selectedIcon = option.dataset.icon;
    });
  });
  
  // Handle save
  document.getElementById('tab-save-btn').addEventListener('click', () => {
    const newName = document.getElementById('tab-name-input').value.trim();
    if (newName) {
      updateTabCustomization(tabIndex, newName, selectedIcon);
    }
    modal.remove();
  });
  
  // Handle cancel
  document.getElementById('tab-cancel-btn').addEventListener('click', () => {
    modal.remove();
  });
  
  // Close on background click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

// Update tab customization
function updateTabCustomization(tabIndex, newName, newIcon) {
  const tab = bankTabs[tabIndex];
  if (!tab) return;
  
  tab.name = newName;
  tab.icon = newIcon;
  
  // Update the tab display
  const tabElement = document.querySelector(`[data-tab="${tabIndex}"]`);
  if (tabElement) {
    const iconElement = tabElement.querySelector('.tab-icon');
    const nameElement = tabElement.querySelector('.tab-name');
    
    if (iconElement) iconElement.textContent = newIcon;
    if (nameElement) nameElement.textContent = newName;
  }
  
  showNotification(`Updated ${newName} tab.`);
}

// Bank note functionality - track if we're in noted mode
let bankNotedMode = false;

// Helper function to check if an item can be noted
function canItemBeNoted(itemId) {
  const itemDef = getItemDefinition(itemId);
  if (!itemDef) return false;
  
  // Only non-stackable items can be noted (like OSRS)
  return !itemDef.stackable;
}

// Helper function to get the display icon for noted items
function getNotedItemIcon(itemId) {
  const itemDef = getItemDefinition(itemId);
  if (!itemDef) return '📜';
  
  // Create a smaller version of the original icon with a note background
  const originalIcon = itemDef.getIcon ? itemDef.getIcon(1) : itemDef.icon;
  return `📜${originalIcon}`;
}

// Helper function to check if an item is noted
function isItemNoted(item) {
  return item && item.noted === true;
}

// Helper function to get the base item ID from a noted item
function getBaseItemId(item) {
  return item.baseItemId || item.id;
}

// Unnote an item (convert noted items back to regular items)
function unnoteItem(slotIndex) {
  const item = playerInventory[slotIndex];
  if (!item || !isItemNoted(item)) return;
  
  const baseItemId = getBaseItemId(item);
  const itemDef = getItemDefinition(baseItemId);
  if (!itemDef) return;
  
  // In OSRS, unnoting must be done at a bank
  showNotification(`You cannot unnote items in your inventory. Visit a bank to exchange noted items.`, 'info');
  
  /* COMMENTED OUT - Unnoting functionality disabled for OSRS accuracy
  // For stackable base items, just remove the noted flag
  if (itemDef.stackable) {
    item.noted = false;
    delete item.baseItemId;
    showNotification(`You unnote ${item.quantity || 1} ${itemDef.name}${(item.quantity || 1) > 1 ? 's' : ''}.`);
  } else {
    // For non-stackable items, we need to check if we have enough inventory space
    const quantity = item.quantity || 1;
    const emptySlots = playerInventory.filter(slot => !slot).length;
    
    // We need slots for all items except the current one (which will be converted)
    const slotsNeeded = quantity - 1;
    
    if (slotsNeeded > emptySlots) {
      showNotification(`Not enough inventory space! You need ${slotsNeeded} more empty slot${slotsNeeded > 1 ? 's' : ''}.`, 'error');
      return;
    }
    
    // Convert the first item in the current slot
    item.noted = false;
    item.quantity = 1;
    delete item.baseItemId;
    
    // Place additional items in empty slots
    let placed = 1; // Already placed one in current slot
    for (let i = 0; i < playerInventory.length && placed < quantity; i++) {
      if (!playerInventory[i]) {
        playerInventory[i] = {
          id: baseItemId,
          quantity: 1
        };
        placed++;
      }
    }
    
    showNotification(`You unnote ${quantity} ${itemDef.name}${quantity > 1 ? 's' : ''}.`);
  }
  
  updateInventoryDisplay();
  */
}

// Handle escape key to close bank interface
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (bankInterface.open) {
      closeBank();
      e.preventDefault();
    } else if (shopInterface.open) {
      closeShop();
      e.preventDefault();
    }
  }
});

// Shop interface state
let shopInterface = {
  open: false,
  currentShop: null,
  selectedSlot: -1,
  selectedItem: null
};

// Shop update timer
let shopUpdateTimer = null;

// Start shop update cycle for restocking and destocking
function startShopUpdateCycle() {
  // Stop any existing cycle
  if (shopUpdateTimer) {
    clearInterval(shopUpdateTimer);
  }
  
  // Start new cycle - run every 60 seconds for responsive cleanup
  shopUpdateTimer = setInterval(() => {
    updateAllShops();
  }, 60000); // 60 seconds
  
  console.log('SHOP: Shop update cycle started (60-second intervals)');
}

// Update all shops (restock and destock)
function updateAllShops() {
  console.log('SHOP: Running scheduled shop updates...');
  
  for (const shopId in activeShops) {
    const shop = activeShops[shopId];
    if (shop.currentStock && shop.defaultStock) {
      console.log(`SHOP: Updating ${shop.name}...`);
      
      // Restock items
      restockShop(shop);
      
      // Remove excess items
      destockShop(shop);
      
      // Clean up expired player-sold items
      cleanupExpiredPlayerItems(shop);
      
      console.log(`SHOP: Completed update for ${shop.name}`);
    }
  }
  
  console.log('SHOP: Scheduled shop updates complete');
}

// Restock shop items
function restockShop(shop) {
  for (const itemId in shop.currentStock) {
    const stockInfo = shop.currentStock[itemId];
    const defaultInfo = shop.defaultStock[itemId];
    
    // Skip coins and items that don't restock
    if (itemId === 'coins' || defaultInfo.restockRate === 0) continue;
    
    // Add items back to default stock levels
    if (stockInfo.quantity < defaultInfo.maxQuantity) {
      const restockAmount = Math.min(defaultInfo.restockRate, defaultInfo.maxQuantity - stockInfo.quantity);
      stockInfo.quantity += restockAmount;
      
      if (restockAmount > 0) {
        console.log(`Shop ${shop.name} restocked ${restockAmount} ${itemId}(s)`);
      }
    }
  }
}

// Remove excess items from shop
function destockShop(shop) {
  for (const itemId in shop.currentStock) {
    const stockInfo = shop.currentStock[itemId];
    const defaultInfo = shop.defaultStock[itemId];
    
    // Skip coins
    if (itemId === 'coins') continue;
    
    // Remove excess items above max capacity
    if (stockInfo.quantity > defaultInfo.maxQuantity) {
      const destockAmount = Math.min(1, stockInfo.quantity - defaultInfo.maxQuantity);
      stockInfo.quantity -= destockAmount;
      
      if (destockAmount > 0) {
        console.log(`Shop ${shop.name} destocked ${destockAmount} ${itemId}(s)`);
      }
    }
  }
}

// Clean up expired player-sold items (non-native items after 3 minutes)
// Uses tiered cleanup intervals based on quantity for faster clearing of high-stock items
function cleanupExpiredPlayerItems(shop) {
  const EXPIRY_TIME = 3 * 60 * 1000; // 3 minutes in milliseconds
  const currentTime = Date.now();
  
  for (const itemId in shop.currentStock) {
    const stockInfo = shop.currentStock[itemId];
    
    // Skip coins and native shop items
    if (itemId === 'coins' || !stockInfo.isPlayerSold) continue;
    
    // Check if this item has expired (been in shop for 3+ minutes)
    if (stockInfo.lastSoldTime && (currentTime - stockInfo.lastSoldTime) > EXPIRY_TIME) {
      
      // Determine cleanup interval based on current quantity (tiered system)
      let cleanupInterval;
      if (stockInfo.quantity >= 101) {
        cleanupInterval = 5000; // 5 seconds for 101+ items (fastest)
      } else if (stockInfo.quantity >= 51) {
        cleanupInterval = 15000; // 15 seconds for 51-100 items
      } else if (stockInfo.quantity >= 11) {
        cleanupInterval = 30000; // 30 seconds for 11-50 items
      } else {
        cleanupInterval = 60000; // 60 seconds for 1-10 items (slowest)
      }
      
      // Check if enough time has passed since last cleanup for this specific item
      const timeSinceLastCleanup = currentTime - (stockInfo.lastCleanupTime || stockInfo.lastSoldTime);
      
      if (timeSinceLastCleanup >= cleanupInterval) {
        console.log(`SHOP: Processing expired player-sold item ${itemId} from ${shop.name} (${stockInfo.quantity} items, cleanup interval: ${cleanupInterval/1000}s)`);
        
        if (stockInfo.quantity > 1) {
          // Gradually remove items one by one
          stockInfo.quantity -= 1;
          stockInfo.lastCleanupTime = currentTime; // Update cleanup time
          console.log(`SHOP: Removed 1 ${itemId} from ${shop.name}, ${stockInfo.quantity} remaining`);
        } else {
          // Remove the last item and clean up the stock entry entirely
          console.log(`SHOP: Completely removed ${itemId} from ${shop.name} (last item)`);
          delete shop.currentStock[itemId];
          
          // Also remove from defaultStock if it was added there
          if (shop.defaultStock[itemId] && shop.defaultStock[itemId].restockRate === 0) {
            delete shop.defaultStock[itemId];
            console.log(`SHOP: Removed ${itemId} from ${shop.name} default stock`);
          }
        }
      }
    }
  }
}

// Calculate item value for shop transactions using shared definitions
function getItemBaseValue(itemId) {
  const itemDef = getItemDefinition(itemId);
  return itemDef?.value || 10; // Default value if not defined
}

// Calculate buy price from shop
function calculateBuyPrice(shop, itemId, quantity = 1) {
  // Retrieve stock for the item (could be custom stock)
  let stockInfo = shop.currentStock?.[itemId];

  // If not found directly, look for custom items that reference this base id
  if (!stockInfo) {
    for (const stock of Object.values(shop.currentStock || {})) {
      if (stock?.baseItemId === itemId) {
        stockInfo = stock;
        break;
      }
    }
  }

  if (!stockInfo) return 0;

  // ---- Numeric fall-backs to avoid NaN ----
  const baseValue        = Number(getItemBaseValue(itemId)) || 1;
  const buyMultiplier    = (typeof shop.buyMultiplier === 'number' && isFinite(shop.buyMultiplier)) ? shop.buyMultiplier : 1;
  const priceChangeRate  = (typeof shop.priceChangeRate === 'number' && isFinite(shop.priceChangeRate)) ? shop.priceChangeRate : 0;
  const currentStock     = Number(stockInfo.quantity) || 0;
  const defaultStock     = (
    shop.defaultStock?.[itemId]?.maxQuantity ??
    stockInfo.maxQuantity ??
    currentStock
  );

  // Unlimited shops have a simple linear price
  if (shop.type === 'unlimited') {
    return Math.max(1, Math.floor(baseValue * buyMultiplier * quantity));
  }

  let totalPrice = 0;
  for (let i = 0; i < quantity; i++) {
    const stockAfterPurchase = currentStock - i;
    const stockDifference    = Math.max(0, defaultStock - stockAfterPurchase);
    const priceMultiplier    = buyMultiplier + (stockDifference * priceChangeRate);
    totalPrice += Math.floor(baseValue * priceMultiplier);
  }

  return Math.max(1, totalPrice); // At least 1 coin
}

// Calculate sell price to shop
function calculateSellPrice(shop, itemId, quantity = 1) {
  // ---- Numeric fall-backs to avoid NaN ----
  const baseValue       = Number(getItemBaseValue(itemId)) || 1;
  const sellMultiplier  = (typeof shop.sellMultiplier === 'number' && isFinite(shop.sellMultiplier)) ? shop.sellMultiplier : 0.6;
  const priceChangeRate = (typeof shop.priceChangeRate === 'number' && isFinite(shop.priceChangeRate)) ? shop.priceChangeRate : 0;

  const currentStock = Number(shop.currentStock?.[itemId]?.quantity) || 0;
  const defaultStock = Number(shop.defaultStock?.[itemId]?.maxQuantity) || 0;

  if (shop.type === 'unlimited') {
    return Math.max(1, Math.floor(baseValue * sellMultiplier * quantity));
  }

  let totalPrice = 0;
  for (let i = 0; i < quantity; i++) {
    const stockAfterSale = currentStock + i;
    let priceMultiplier;

    if (shop.type === 'specialty' && shop.defaultStock?.[itemId]) {
      const stockDifference = stockAfterSale - defaultStock;
      priceMultiplier = sellMultiplier - (stockDifference * priceChangeRate);
    } else {
      const stockDifference = stockAfterSale;
      priceMultiplier = sellMultiplier - (stockDifference * priceChangeRate);
    }

    priceMultiplier = Math.max(0.1, priceMultiplier); // Min 10% of value
    totalPrice += Math.floor(baseValue * priceMultiplier);
  }

  return Math.max(1, totalPrice);
}

// Clear cached shop interface state when reopening
function clearShopInterfaceCache() {
  console.log('SHOP: Clearing shop interface cache');
  
  // Force clear the shop inventory grid to prevent cached displays
  const shopInventoryGrid = document.getElementById('shop-inventory-grid');
  if (shopInventoryGrid) {
    console.log('SHOP: Rebuilding shop inventory grid from scratch');
    shopInventoryGrid.innerHTML = Array(INVENTORY_SIZE).fill().map((_, i) => 
      `<div class="shop-inventory-slot" data-slot="${i}"></div>`
    ).join('');
  }
  
  // Also clear the shop stock grid
  const shopGrid = document.getElementById('shop-grid');
  if (shopGrid) {
    console.log('SHOP: Rebuilding shop stock grid from scratch');
    shopGrid.innerHTML = Array(40).fill().map((_, i) => 
      `<div class="shop-slot" data-slot="${i}"></div>`
    ).join('');
  }
  
  // Re-setup event handlers since we cleared the DOM elements
  console.log('SHOP: Re-setting up event handlers after cache clear');
  setupShopHandlers();
}

// Open shop interface
function openShop(shopId) {
  const shop = activeShops[shopId];
  if (!shop) {
    console.error('Shop not found:', shopId);
    return;
  }
  
  console.log('SHOP: Opening shop interface for', shop.name);
  
  // Create shop overlay if it doesn't exist
  let shopOverlay = document.getElementById('shop-overlay');
  let isReopening = false;
  if (!shopOverlay) {
    console.log('SHOP: Creating new shop interface');
    shopOverlay = createShopInterface();
  } else {
    console.log('SHOP: Reusing existing shop interface - this is a reopening');
    isReopening = true;
    
    // Clear any cached state when reopening
    // clearShopInterfaceCache(); // Temporarily disabled - was preventing inventory from rendering
  }
  
  // Set current shop and show the interface
  shopInterface.open = true;
  shopInterface.currentShop = shop;
  shopOverlay.style.display = 'block';
  
  // Always ensure fresh inventory display when opening shop
  console.log('SHOP: Refreshing inventory displays on shop open' + (isReopening ? ' (REOPENING)' : ' (NEW)'));
  updateInventoryDisplay(); // Update the main inventory first
  
  // Update shop displays
  updateShopDisplay();
  updateShopInventoryDisplay();
  
  // Force a complete refresh after a brief delay to ensure DOM is ready
  setTimeout(() => {
    console.log('SHOP: Secondary refresh on shop open' + (isReopening ? ' (REOPENING)' : ' (NEW)'));
    updateShopInventoryDisplay();
    updateInventoryDisplay();
  }, 10);
  
  // Additional aggressive refresh after interface is fully loaded (similar to selling functions)
  setTimeout(() => {
    console.log('SHOP: Final aggressive refresh on shop open - ensuring current inventory state');
    // Use the same refresh pattern as successful selling functions
    updateInventoryDisplay();
    updateShopInventoryDisplay();
    updateShopDisplay();
    
    // Force complete interface refresh as backup
    refreshShopInterface();
  }, 50);
}

// Create shop interface
function createShopInterface() {
  const shopOverlay = document.createElement('div');
  shopOverlay.id = 'shop-overlay';
  shopOverlay.className = 'shop-overlay';
  
  shopOverlay.innerHTML = `
    <div class="shop-interface">
      <div class="shop-header">
        <div class="shop-info">
          <div class="shop-title" id="shop-title">Shop</div>
          <div class="shop-keeper" id="shop-keeper">Keeper</div>
          <div class="shop-description" id="shop-description">Description</div>
        </div>
        <button class="shop-close" id="shop-close-btn">✕ Close</button>
      </div>
      
      <div class="shop-content">
        <div class="shop-section">
          <div class="shop-section-title">Shop Stock</div>
          <div class="shop-grid" id="shop-grid">
            ${Array(56).fill().map((_, i) => 
              `<div class="shop-slot" data-slot="${i}"></div>`
            ).join('')}
          </div>
        </div>
        
        <div class="shop-section">
          <div class="shop-section-title">Your Inventory</div>
          <div class="shop-inventory-grid" id="shop-inventory-grid">
            ${Array(INVENTORY_SIZE).fill().map((_, i) => 
              `<div class="shop-inventory-slot" data-slot="${i}"></div>`
            ).join('')}
          </div>
        </div>
      </div>
      
      <div class="shop-footer">
        <div class="shop-actions">
          <div class="quantity-selector">
            <label>Quantity:</label>
            <button class="qty-btn active" data-qty="1">1</button>
            <button class="qty-btn" data-qty="5">5</button>
            <button class="qty-btn" data-qty="10">10</button>
            <button class="qty-btn" data-qty="50">50</button>
            <button class="qty-btn" data-qty="100">100</button>
          </div>
          <div class="transaction-info" id="transaction-info">
            Select an item to see pricing information
          </div>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(shopOverlay);
  
  // Setup event handlers
  setupShopHandlers();
  
  return shopOverlay;
}

// Update shop display
function updateShopDisplay() {
  if (!shopInterface.currentShop) return;
  
  const shop = shopInterface.currentShop;
  
  console.log('SHOP: Updating shop display for', shop.name);
  console.log('SHOP: Current stock:', shop.currentStock);
  
  // Update shop info
  document.getElementById('shop-title').textContent = `${shop.icon} ${shop.name}`;
  document.getElementById('shop-keeper').textContent = shop.keeper;
  document.getElementById('shop-description').textContent = shop.description;
  
  // Update shop grid
  const shopGrid = document.getElementById('shop-grid');
  if (!shopGrid) return;
  
  const slots = shopGrid.querySelectorAll('.shop-slot');
  let slotIndex = 0;
  
  // Get all items from stock and sort them (put original shop items first, then sold items)
  const stockItems = [];
  for (const itemId in shop.currentStock) {
    if (itemId === 'coins') continue; // Don't display coins
    
    const stockInfo = shop.currentStock[itemId];
    // For custom items, use baseItemId to get the definition, otherwise use itemId
    const baseItemId = stockInfo?.baseItemId || itemId;
    const itemDef = getItemDefinition(baseItemId);
    
    console.log(`SHOP: Checking item ${itemId} (base: ${baseItemId}) - quantity: ${stockInfo ? stockInfo.quantity : 'NO STOCK INFO'}, definition exists: ${!!itemDef}`);
    
    if (stockInfo && itemDef) {
      // Only display items that have quantity > 0
      if (stockInfo.quantity > 0) {
        console.log(`SHOP: Item ${itemId} will be displayed - quantity: ${stockInfo.quantity}, restockRate: ${stockInfo.restockRate}, custom: ${!!stockInfo.customProperties}`);
        stockItems.push({
          itemId,
          baseItemId,
          stockInfo,
          itemDef,
          // Prioritize items that were originally in the shop (have restockRate > 0)
          priority: stockInfo.restockRate > 0 ? 0 : 1
        });
      } else {
        console.log(`SHOP: Item ${itemId} will NOT be displayed - quantity is ${stockInfo.quantity}`);
      }
    } else {
      console.log(`SHOP: Item ${itemId} missing stockInfo or itemDef - stockInfo: ${!!stockInfo}, itemDef: ${!!itemDef}`);
    }
  }
  
  // Sort items: original shop items first, then alphabetically
  stockItems.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.itemDef.name.localeCompare(b.itemDef.name);
  });
  
  console.log('SHOP: Items to display:', stockItems.length, 'items:', stockItems.map(item => `${item.itemId}(${item.stockInfo.quantity})`));
  
  // Display sorted items
  for (const stockItem of stockItems) {
    if (slotIndex >= slots.length) {
      console.log('SHOP: Ran out of display slots! Had', stockItems.length, 'items but only', slots.length, 'slots');
      break;
    }
    
    const { itemId, baseItemId, stockInfo, itemDef } = stockItem;
    const slot = slots[slotIndex];
    
    slot.classList.add('occupied');
    
    const tintStyle = itemDef.colorTint ? `color: ${itemDef.colorTint};` : '';
    const tintClass = itemDef.colorTint ? 'tinted' : '';
    
    // Use dynamic icon if available
    const icon = itemDef.getIcon ? itemDef.getIcon(stockInfo.quantity) : itemDef.icon;
    
    const displayQuantity = shop.type === 'unlimited' ? '∞' : stockInfo.quantity;
    
    // Use custom name if available, otherwise use default name
    const displayName = stockInfo.customProperties?.name || itemDef.name;
    const buyPrice = calculateBuyPrice(shop, baseItemId, 1); // Use baseItemId for price calculation
    
    slot.innerHTML = `
      <div class="shop-item ${tintClass}" style="${tintStyle}" data-item-id="${itemId}">
        ${icon}
        <div class="shop-item-count">${displayQuantity}</div>
        <div class="shop-item-price">${buyPrice}gp</div>
      </div>
    `;
    
    // Create tooltip with custom properties if available
    let tooltip = `${displayName} - ${buyPrice} coins each`;
    if (stockInfo.customProperties) {
      if (stockInfo.customProperties.author) {
        tooltip += `\nWritten by: ${stockInfo.customProperties.author}`;
      }
      if (stockInfo.customProperties.description && stockInfo.customProperties.description !== itemDef.description) {
        tooltip += `\n${stockInfo.customProperties.description}`;
      }
      if (stockInfo.customProperties.writtenDate) {
        const date = new Date(stockInfo.customProperties.writtenDate);
        tooltip += `\nWritten: ${date.toLocaleDateString()}`;
      }
    }
    
    slot.title = tooltip;
    slot.dataset.itemId = itemId;
    
    console.log(`SHOP: Displayed ${displayName} in slot ${slotIndex}, quantity: ${stockInfo.quantity}, custom: ${!!stockInfo.customProperties}`);
    slotIndex++;
  }
  
  // Clear remaining slots
  for (let i = slotIndex; i < slots.length; i++) {
    const slot = slots[i];
    slot.classList.remove('occupied');
    slot.innerHTML = '';
    slot.title = '';
    slot.dataset.itemId = '';
  }
  
  console.log('SHOP: Display complete. Used', slotIndex, 'of', slots.length, 'slots');
}

// Update shop inventory display
function updateShopInventoryDisplay() {
  const shopInventoryGrid = document.getElementById('shop-inventory-grid');
  if (!shopInventoryGrid) {
    console.log('SHOP: Shop inventory grid not found');
    return;
  }

  console.log('SHOP: Updating shop inventory display');
  console.log('SHOP: Current playerInventory state:', playerInventory.map((item, i) => item ? `${i}: ${item.id}(${item.quantity || 1})` : `${i}: empty`));

  const slots = shopInventoryGrid.querySelectorAll('.shop-inventory-slot');
  
  // First, clear all slots completely to prevent any caching issues
  slots.forEach((slot, index) => {
    slot.classList.remove('occupied');
    slot.innerHTML = '';
    slot.title = '';
    slot.dataset.itemId = '';
    slot.dataset.slot = index; // Ensure slot index is correct
  });
  
  // Now rebuild each slot based on current inventory
  slots.forEach((slot, index) => {
    const item = playerInventory[index];
    
    if (item) {
      const itemDef = getItemDefinition(item.id);
      if (itemDef) {
        slot.classList.add('occupied');
        const tintStyle = itemDef.colorTint ? `color: ${itemDef.colorTint};` : '';
        const tintClass = itemDef.colorTint ? 'tinted' : '';
        
        // Check if this is a noted item
        if (isItemNoted(item)) {
          const baseIcon = itemDef.getIcon ? itemDef.getIcon(1) : itemDef.icon;
          slot.innerHTML = `
            <div class="shop-item ${tintClass}" style="${tintStyle}" data-item-id="${item.id}">
              <div class="noted-item-container">
                <span class="note-background">📜</span>
                <span class="noted-icon">${baseIcon}</span>
              </div>
              ${item.quantity > 1 ? `<div class="shop-item-count">${item.quantity}</div>` : ''}
            </div>
          `;
        } else {
          const icon = itemDef.getIcon ? itemDef.getIcon(item.quantity || 1) : itemDef.icon;
          slot.innerHTML = `
            <div class="shop-item ${tintClass}" style="${tintStyle}" data-item-id="${item.id}">
              ${icon}
              ${(itemDef.stackable || item.quantity > 1) && item.quantity > 1 ? 
                `<div class="shop-item-count">${item.quantity}</div>` : ''
              }
            </div>
          `;
        }
        
        // Add sell price if shop accepts this item
        const shop = shopInterface.currentShop;
        if (shop) {
          const sellPrice = calculateSellPrice(shop, item.id, 1);
          if (sellPrice > 0 && item.id !== 'coins') { // Don't show sell price for coins
            const priceDiv = document.createElement('div');
            priceDiv.className = 'shop-sell-price';
            priceDiv.textContent = `${sellPrice}gp`;
            slot.querySelector('.shop-item').appendChild(priceDiv);
          }
        }
        
        slot.title = `${itemDef.name}${item.quantity > 1 ? ` (${item.quantity})` : ''} - ${item.id === 'coins' ? 'Cannot sell coins' : 'Right-click to sell'}`;
        slot.dataset.itemId = item.id;
        
        console.log(`SHOP: Updated slot ${index} with ${itemDef.name} (${item.quantity || 1})`);
      } else {
        console.log(`SHOP: No item definition found for slot ${index}, item:`, item);
      }
    } else {
      console.log(`SHOP: Slot ${index} is empty`);
    }
  });
  
  console.log('SHOP: Shop inventory display update complete');
}

// Setup shop event handlers
function setupShopHandlers() {
  const shopOverlay = document.getElementById('shop-overlay');
  const closeBtn = document.getElementById('shop-close-btn');
  const shopGrid = document.getElementById('shop-grid');
  const shopInventoryGrid = document.getElementById('shop-inventory-grid');
  
  // Close shop
  closeBtn.addEventListener('click', closeShop);
  shopOverlay.addEventListener('click', (e) => {
    if (e.target === shopOverlay) {
      closeShop();
    }
  });
  
  // Quantity selector buttons
  const qtyButtons = document.querySelectorAll('.qty-btn');
  qtyButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      qtyButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateTransactionInfo();
    });
  });
  
  // Shop grid clicks (buy items)
  shopGrid.addEventListener('click', (e) => {
    const slot = e.target.closest('.shop-slot');
    if (!slot || !slot.dataset.itemId) return;
    
    const itemId = slot.dataset.itemId;
    const quantity = getSelectedQuantity();
    buyItemFromShop(itemId, quantity);
  });
  
  // Shop grid right-clicks (buy options for multiple items)
  shopGrid.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const slot = e.target.closest('.shop-slot');
    if (!slot || !slot.dataset.itemId) return;
    
    const itemId = slot.dataset.itemId;
    showShopBuyMenu(e, itemId);
  });
  
  // Shop inventory grid clicks (sell items)
  shopInventoryGrid.addEventListener('click', (e) => {
    const slot = e.target.closest('.shop-inventory-slot');
    if (!slot) return;
    
    const slotIndex = parseInt(slot.dataset.slot);
    const item = playerInventory[slotIndex];
    
    if (item && item.id !== 'coins') { // Don't allow selling coins
      const quantity = getSelectedQuantity();
      sellItemToShop(slotIndex, quantity);
    }
  });
  
  // Shop inventory grid right-clicks (sell options for stackable/noted items)
  shopInventoryGrid.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const slot = e.target.closest('.shop-inventory-slot');
    if (!slot) return;
    
    const slotIndex = parseInt(slot.dataset.slot);
    const item = playerInventory[slotIndex];
    
    if (item && item.id !== 'coins') { // Don't show context menu for coins
      showShopSellMenu(e, slotIndex);
    }
  });
}

// Close shop interface
function closeShop() {
  console.log('SHOP: Closing shop interface');
  
  const shopOverlay = document.getElementById('shop-overlay');
  if (shopOverlay) {
    shopOverlay.style.display = 'none';
  }
  
  shopInterface.open = false;
  shopInterface.currentShop = null;
  shopInterface.selectedSlot = -1;
  shopInterface.selectedItem = null;
}

// Get selected quantity from UI
function getSelectedQuantity() {
  const activeBtn = document.querySelector('.qty-btn.active');
  return activeBtn ? parseInt(activeBtn.dataset.qty) : 1;
}

// Update transaction info display
function updateTransactionInfo() {
  const infoDiv = document.getElementById('transaction-info');
  if (!infoDiv) return;
  
  // This would be called when hovering over items to show pricing info
  infoDiv.textContent = 'Select an item to see pricing information';
}

// Buy item from shop
function buyItemFromShop(itemId, quantity) {
  const shop = shopInterface.currentShop;
  if (!shop || !shop.currentStock[itemId]) return;

  // If online, send request to server
  if (window.isUserOnline && window.isUserOnline() && window.sendShopBuyRequest) {
    console.log(`🏪 Sending buy request to server: ${quantity} ${itemId} from ${shop.id}`);
    window.sendShopBuyRequest(shop.id, itemId, quantity);
    return; // Server will handle the transaction and send updates
  }

  // Offline mode - handle locally (existing logic)
  const stockInfo = shop.currentStock[itemId];
  const itemDef = getItemDefinition(itemId);
  
  if (!itemDef) return;
  
  // Check if shop has enough stock
  const availableQuantity = shop.type === 'unlimited' ? quantity : Math.min(quantity, stockInfo.quantity);
  if (availableQuantity <= 0) {
    showNotification('The shop is out of stock!', 'error');
    return;
  }
  
  // Calculate total cost
  const totalCost = calculateBuyPrice(shop, itemId, availableQuantity);
  
  // Check if player has enough coins
  const playerCoins = getPlayerCoins();
  if (playerCoins < totalCost) {
    showNotification(`You need ${totalCost} coins, but only have ${playerCoins}!`, 'error');
    return;
  }
  
  // Check if player has inventory space
  if (!hasInventorySpace(itemId, availableQuantity)) {
    showNotification('Not enough inventory space!', 'error');
    return;
  }
  
  // Perform the transaction
  // Remove coins from player
  removePlayerCoins(totalCost);
  
  // Add coins to shop
  if (!shop.currentStock.coins) {
    shop.currentStock.coins = { quantity: 0, maxQuantity: 0, restockRate: 0 };
  }
  shop.currentStock.coins.quantity += totalCost;
  
  // Remove items from shop stock
  if (shop.type !== 'unlimited') {
    stockInfo.quantity -= availableQuantity;
  }
  
  // Add items to player inventory
  if (itemDef.stackable) {
    // For stackable items, add all at once
    addItemToInventory(itemId, availableQuantity);
  } else {
    // For non-stackable items, add them one by one to separate slots
    for (let i = 0; i < availableQuantity; i++) {
      addItemToInventory(itemId, 1);
    }
  }
  
  // Immediate display updates
  console.log('SHOP: Performing immediate display updates after buy');
  updateInventoryDisplay();
  updateShopInventoryDisplay();
  updateShopDisplay();
  
  // Update transaction info
  updateTransactionInfo();
  
  showNotification(`Bought ${availableQuantity} ${itemDef.name} for ${totalCost} coins`, 'success');
  
  // Safety: ensure non-stackable items were not accidentally stacked (can happen in some bulk-buy scenarios)
  if (!itemDef.stackable) {
    splitNonStackableStacks(itemId);
    // Force a shop UI refresh so slot indices and context menus match new item positions
    if (typeof refreshShopInterface === 'function') {
      refreshShopInterface();
    }
  }
}

/**
 * Ensures that any non-stackable items with quantity > 1 are split into separate slots.
 * This prevents accidental stacking when bulk-buying or receiving items from other sources.
 */
function splitNonStackableStacks(itemId) {
  const itemDef = getItemDefinition(itemId);
  if (!itemDef || itemDef.stackable) return; // Only handle genuine non-stackables

  // Iterate over inventory slots, splitting stacks when found
  for (let i = 0; i < playerInventory.length; i++) {
    const item = playerInventory[i];
    if (item && item.id === itemId && !isItemNoted(item) && (item.quantity || 1) > 1) {
      let qty = item.quantity || 1;
      // Keep one in the current slot
      item.quantity = 1;
      qty--; // Remaining to distribute

      while (qty > 0) {
        const emptySlot = playerInventory.findIndex(slot => !slot);
        if (emptySlot === -1) {
          // No free slot – aggregate the rest back into this stack to avoid data loss
          item.quantity += qty;
          break;
        }
        playerInventory[emptySlot] = { id: itemId, quantity: 1 };
        qty--;
      }
    }
  }

  // Refresh UI after potential changes
  updateInventoryDisplay();
}

// Sell item to shop
function sellItemToShop(inventorySlot, quantity) {
  const item = playerInventory[inventorySlot];
  const shop = shopInterface.currentShop;
  
  if (!item || !shop) return;

  // If online, send request to server
  if (window.isUserOnline && window.isUserOnline() && window.sendShopSellRequest) {
    console.log(`🏪 Sending sell request to server: slot ${inventorySlot}, quantity ${quantity} to ${shop.id}`);
    window.sendShopSellRequest(shop.id, inventorySlot, quantity);
    return; // Server will handle the transaction and send updates
  }

  // Offline mode - handle locally (existing logic)
  const itemDef = getItemDefinition(item.id);
  if (!itemDef) return;
  
  // Check if item is noted
  if (isItemNoted(item)) {
    showNotification('You cannot sell noted items! Unnote them first.', 'error');
    return;
  }
  
  // Check if shop accepts this item type
  if (!shop.acceptsAllItems && !shop.defaultStock[item.id]) {
    if (shop.acceptsOnlyDefaultStock) {
      showNotification('This shop doesn\'t buy that type of item.', 'error');
      return;
    }
  }
  
  // Calculate how many we can actually sell
  const availableQuantity = Math.min(quantity, item.quantity || 1);
  if (availableQuantity <= 0) return;
  
  // Calculate sell price
  const totalValue = calculateSellPrice(shop, item.id, availableQuantity);
  
  // Add item to shop stock
  if (!shop.currentStock[item.id]) {
    console.log(`SHOP: Adding new item ${item.id} to shop stock`);
    // For new items not in defaultStock, give them reasonable limits
    // Use reasonable maxQuantity for player-sold items to prevent extreme price fluctuations
    const baseMaxQuantity = shop.type === 'general' ? 5 : 3; // Much smaller than before
    const defaultMaxQuantity = Math.max(baseMaxQuantity, quantity + 2);
    shop.currentStock[item.id] = { 
      quantity: 0, 
      maxQuantity: defaultMaxQuantity, 
      restockRate: 0, // Player-sold items don't restock
      isPlayerSold: true, // Mark as player-sold for cleanup
      lastSoldTime: Date.now(), // Track when items were sold for cleanup
      lastCleanupTime: Date.now() // Track when items were last cleaned up
    };
    
    // Also add to defaultStock for future reference if it's a general store
    if (shop.type === 'general' && shop.acceptsAllItems) {
      shop.defaultStock[item.id] = {
        quantity: 0,
        maxQuantity: defaultMaxQuantity,
        restockRate: 0
      };
    }
  }
  
  // Update the last sold time when adding more items
  if (shop.currentStock[item.id].isPlayerSold) {
    shop.currentStock[item.id].lastSoldTime = Date.now();
    shop.currentStock[item.id].lastCleanupTime = shop.currentStock[item.id].lastCleanupTime || Date.now();
  }
  
  console.log(`SHOP: Before sell - ${item.id} quantity in shop:`, shop.currentStock[item.id].quantity);
  shop.currentStock[item.id].quantity += availableQuantity;
  console.log(`SHOP: After sell - ${item.id} quantity in shop:`, shop.currentStock[item.id].quantity);
  console.log('SHOP: Full shop stock after sell:', Object.keys(shop.currentStock).map(id => `${id}: ${shop.currentStock[id].quantity}`));
  
  // Remove coins from shop (if it has them)
  if (shop.currentStock.coins && shop.currentStock.coins.quantity >= totalValue) {
    shop.currentStock.coins.quantity -= totalValue;
  }
  
  // Add coins to player
  addItemToInventory('coins', totalValue);
  
  // Remove item from player inventory
  if ((item.quantity || 1) <= availableQuantity) {
    // Remove entire stack
    playerInventory[inventorySlot] = null;
  } else {
    // Reduce quantity
    item.quantity -= availableQuantity;
  }
  
  // Immediate display updates
  console.log('SHOP: Performing immediate display updates after sell');
  updateInventoryDisplay();
  updateShopInventoryDisplay();
  updateShopDisplay();
  
  // Update transaction info
  updateTransactionInfo();
  
  showNotification(`Sold ${availableQuantity} ${itemDef.name} for ${totalValue} coins`, 'success');
}

// Helper function to get player's total coins
function getPlayerCoins() {
  const coinSlot = playerInventory.find(item => item && item.id === 'coins');
  return coinSlot ? coinSlot.quantity || 0 : 0;
}

// Helper function to remove coins from player
function removePlayerCoins(amount) {
  const coinSlot = playerInventory.find(item => item && item.id === 'coins');
  if (coinSlot) {
    coinSlot.quantity = Math.max(0, (coinSlot.quantity || 0) - amount);
    if (coinSlot.quantity === 0) {
      const index = playerInventory.indexOf(coinSlot);
      playerInventory[index] = null;
    }
  }
}

// Helper function to check inventory space
function hasInventorySpace(itemId, quantity) {
  const itemDef = getItemDefinition(itemId);
  if (!itemDef) return false;
  
  if (itemDef.stackable) {
    // Stackable items can go in existing stacks or need 1 empty slot
    const existingSlot = playerInventory.find(item => item && item.id === itemId);
    if (existingSlot) return true;
    
    // Need one empty slot for new stack
    return playerInventory.some(slot => !slot);
  } else {
    // Non-stackable items need individual slots
    const emptySlots = playerInventory.filter(slot => !slot).length;
    return emptySlots >= quantity;
  }
}

// Add test buttons for shops
function addShopTestButtons() {
  const inventoryTab = document.getElementById('inventory-tab');
  if (!inventoryTab) return;
  
  const testButtonsDiv = inventoryTab.querySelector('.test-buttons');
  if (!testButtonsDiv) return;
  
  // Add shop test buttons
  const shopButtons = document.createElement('div');
  shopButtons.style.marginTop = '10px';
  shopButtons.innerHTML = `
    <button id="open-general-shop" style="padding: 5px 10px; background: #4a597c; color: white; border: none; border-radius: 3px; cursor: pointer; margin-right: 5px;">General Store</button>
    <button id="open-weapon-shop" style="padding: 5px 10px; background: #7c4a4a; color: white; border: none; border-radius: 3px; cursor: pointer; margin-right: 5px;">Weapon Shop</button>
    <button id="open-gem-shop" style="padding: 5px 10px; background: #4a7c4a; color: white; border: none; border-radius: 3px; cursor: pointer; margin-right: 5px;">Gem Trader</button>
    <button id="open-food-shop" style="padding: 5px 10px; background: #7c7c4a; color: white; border: none; border-radius: 3px; cursor: pointer;">Food Shop</button>
  `;
  
  testButtonsDiv.appendChild(shopButtons);
  
  // Add event listeners
  document.getElementById('open-general-shop').addEventListener('click', () => openShop('general_store'));
  document.getElementById('open-weapon-shop').addEventListener('click', () => openShop('weapon_shop'));
  document.getElementById('open-gem-shop').addEventListener('click', () => openShop('gem_trader'));
  document.getElementById('open-food-shop').addEventListener('click', () => openShop('unlimited_food'));
}

// Show shop sell context menu
function showShopSellMenu(event, inventorySlot) {
  const item = playerInventory[inventorySlot];
  const shop = shopInterface.currentShop;
  
  if (!item || !shop || item.id === 'coins') return;
  
  const itemDef = getItemDefinition(item.id);
  if (!itemDef) return;
  
  // Remove any existing context menu
  hideShopSellMenu();
  
  const contextMenu = document.createElement('div');
  contextMenu.id = 'shop-sell-menu';
  contextMenu.className = 'shop-sell-menu';
  contextMenu.style.position = 'fixed';
  contextMenu.style.backgroundColor = '#2a2a2a';
  contextMenu.style.border = '1px solid #555';
  contextMenu.style.borderRadius = '5px';
  contextMenu.style.padding = '5px 0';
  contextMenu.style.zIndex = '2001';
  contextMenu.style.minWidth = '150px';
  contextMenu.style.boxShadow = '0 2px 10px rgba(0,0,0,0.5)';
  
  const itemQuantity = item.quantity || 1;
  const itemName = isItemNoted(item) ? `${itemDef.name} (noted)` : itemDef.name;
  
  // Check if this item should be treated as stackable (noted items are always stackable)
  const isStackable = isItemNoted(item) || itemDef.stackable;
  
  // For non-stackable items, count how many we have of this type across all inventory slots
  let totalItemCount = itemQuantity;
  if (!isStackable) {
    totalItemCount = playerInventory.filter(invItem => 
      invItem && invItem.id === item.id && !isItemNoted(invItem)
    ).length;
  }
  
  // Sell 1
  const sell1 = createShopSellMenuItem(`Sell 1 (${calculateSellPrice(shop, item.id, 1)}gp)`, () => {
    sellItemToShop(inventorySlot, 1);
    hideShopSellMenu();
  });
  contextMenu.appendChild(sell1);
  
  // Sell 5 (if more than 5 available)
  if (totalItemCount >= 5) {
    const sell5Price = calculateSellPrice(shop, item.id, Math.min(5, totalItemCount));
    const sell5 = createShopSellMenuItem(`Sell 5 (${sell5Price}gp)`, () => {
      if (isStackable) {
        sellItemToShop(inventorySlot, Math.min(5, itemQuantity));
      } else {
        sellMultipleNonStackableItems(item.id, 5);
      }
      hideShopSellMenu();
    });
    contextMenu.appendChild(sell5);
  }
  
  // Sell 10 (if more than 10 available)
  if (totalItemCount >= 10) {
    const sell10Price = calculateSellPrice(shop, item.id, Math.min(10, totalItemCount));
    const sell10 = createShopSellMenuItem(`Sell 10 (${sell10Price}gp)`, () => {
      if (isStackable) {
        sellItemToShop(inventorySlot, Math.min(10, itemQuantity));
      } else {
        sellMultipleNonStackableItems(item.id, 10);
      }
      hideShopSellMenu();
    });
    contextMenu.appendChild(sell10);
  }
  
  // Sell X (custom amount) - always show for multiple items
  if (totalItemCount > 1) {
    const sellX = createShopSellMenuItem('Sell X', () => {
      const amount = prompt(`How many ${itemName}s would you like to sell? (Available: ${totalItemCount})`, '1');
      if (amount && !isNaN(amount)) {
        const quantity = Math.min(parseInt(amount), totalItemCount);
        if (quantity > 0) {
          if (isStackable) {
            sellItemToShop(inventorySlot, quantity);
          } else {
            sellMultipleNonStackableItems(item.id, quantity);
          }
        }
      }
      hideShopSellMenu();
    });
    contextMenu.appendChild(sellX);
  }
  
  // Sell all - always show for multiple items
  if (totalItemCount > 1) {
    const sellAllPrice = calculateSellPrice(shop, item.id, totalItemCount);
    const sellAll = createShopSellMenuItem(`Sell All (${totalItemCount}) (${sellAllPrice}gp)`, () => {
      if (isStackable) {
        sellItemToShop(inventorySlot, itemQuantity);
      } else {
        sellMultipleNonStackableItems(item.id, totalItemCount);
      }
      hideShopSellMenu();
    });
    contextMenu.appendChild(sellAll);
  }
  
  // Position the menu
  contextMenu.style.left = `${event.pageX}px`;
  contextMenu.style.top = `${event.pageY}px`;
  
  document.body.appendChild(contextMenu);
}

// Create shop sell menu item
function createShopSellMenuItem(text, onClick) {
  const item = document.createElement('div');
  item.className = 'shop-sell-menu-item';
  item.textContent = text;
  item.style.padding = '8px 15px';
  item.style.cursor = 'pointer';
  item.style.color = '#ccc';
  item.style.transition = 'background-color 0.2s';
  item.style.fontSize = '13px';
  
  item.addEventListener('mouseenter', () => {
    item.style.backgroundColor = '#3a3a3a';
  });
  
  item.addEventListener('mouseleave', () => {
    item.style.backgroundColor = 'transparent';
  });
  
  item.addEventListener('click', onClick);
  
  return item;
}

// Hide shop sell menu
function hideShopSellMenu() {
  const existingMenu = document.getElementById('shop-sell-menu');
  if (existingMenu) {
    existingMenu.remove();
  }
}

// Sell multiple non-stackable items of the same type from different inventory slots
function sellMultipleNonStackableItems(itemId, maxQuantity) {
  const shop = shopInterface.currentShop;
  if (!shop) return 0;

  // If online, we need to handle this differently - sell items one by one through the server
  if (window.isUserOnline && window.isUserOnline() && window.sendShopSellRequest) {
    console.log(`🏪 Online mode: selling multiple ${itemId} items through server`);
    
    let processed = 0;
    let itemsSent = 0;
    
    // Find all inventory slots containing this item (non-noted only) starting from the END so slot indices remain stable
    for (let i = INVENTORY_SIZE - 1; i >= 0 && processed < maxQuantity; i--) {
      const item = playerInventory[i];
      if (item && item.id === itemId && !isItemNoted(item)) {
        const quantityToSell = Math.min(item.quantity || 1, maxQuantity - processed);
        
        // Send individual sell request for this slot
        console.log(`🏪 Sending sell request for slot ${i}, quantity ${quantityToSell}`);
        window.sendShopSellRequest(shop.id, i, quantityToSell);
        
        processed += quantityToSell;
        itemsSent++;
      }
    }
    
    if (itemsSent > 0) {
      console.log(`🏪 Sent ${itemsSent} individual sell requests for ${processed} total items`);
      showNotification(`Selling ${processed} ${itemId}s... (processing ${itemsSent} transactions)`, 'info');
    }
    
    return processed;
  }

  // Offline mode - handle locally (existing logic)
  let sold = 0;
  let totalValue = 0;
  
  // Find all inventory slots containing this item (non-noted only), iterate in reverse
  // to avoid issues with slots shifting when items are removed
  for (let i = INVENTORY_SIZE - 1; i >= 0 && sold < maxQuantity; i--) {
    const item = playerInventory[i];
    if (item && item.id === itemId && !isItemNoted(item)) {
      const quantityToSell = Math.min(item.quantity || 1, maxQuantity - sold);
      const sellValue = calculateSellPrice(shop, item.id, quantityToSell);
      
      // Add item to shop stock
      if (!shop.currentStock[item.id]) {
        console.log(`SHOP: Adding new item ${item.id} to shop stock (multiple sell)`);
        // For new items not in defaultStock, give them reasonable limits
        // Use reasonable maxQuantity for player-sold items to prevent extreme price fluctuations
        const baseMaxQuantity = shop.type === 'general' ? 5 : 3; // Much smaller than before
        const defaultMaxQuantity = Math.max(baseMaxQuantity, quantityToSell + 2);
        shop.currentStock[item.id] = { 
          quantity: 0, 
          maxQuantity: defaultMaxQuantity, 
          restockRate: 0, // Player-sold items don't restock
          isPlayerSold: true, // Mark as player-sold for cleanup
          lastSoldTime: Date.now() // Track when items were sold for cleanup
        };
        
        // Also add to defaultStock for future reference if it's a general store
        if (shop.type === 'general' && shop.acceptsAllItems) {
          shop.defaultStock[item.id] = {
            quantity: 0,
            maxQuantity: defaultMaxQuantity,
            restockRate: 0
          };
        }
      }
      shop.currentStock[item.id].quantity += quantityToSell;
      
      // Remove item from inventory
      if ((item.quantity || 1) <= quantityToSell) {
        playerInventory[i] = null;
      } else {
        item.quantity -= quantityToSell;
      }
      
      sold += quantityToSell;
      totalValue += sellValue;
    }
  }
  
  if (sold > 0) {
    // Add coins to player
    addItemToInventory('coins', totalValue);
    
    // Immediate display updates
    console.log('SHOP: Performing immediate display updates after multiple sell');
    updateInventoryDisplay();
    updateShopInventoryDisplay();
    updateShopDisplay();
    
    // Force complete refresh as backup
    setTimeout(() => {
      console.log('SHOP: Calling refreshShopInterface after multiple sell');
      refreshShopInterface();
    }, 0);
    
    const itemDef = getItemDefinition(itemId);
    const itemName = itemDef ? itemDef.name : 'Unknown Item';
    showNotification(`Sold ${sold} ${itemName}${sold > 1 ? 's' : ''} for ${totalValue} coins.`);
  }
  
  return sold;
}

// Show shop buy context menu
function showShopBuyMenu(event, itemId) {
  const shop = shopInterface.currentShop;
  if (!shop || !shop.currentStock[itemId]) return;
  
  const stockInfo = shop.currentStock[itemId];
  const itemDef = getItemDefinition(itemId);
  
  if (!itemDef) return;
  
  // Remove any existing context menu
  hideShopBuyMenu();
  
  const contextMenu = document.createElement('div');
  contextMenu.id = 'shop-buy-menu';
  contextMenu.className = 'shop-buy-menu';
  contextMenu.style.position = 'fixed';
  contextMenu.style.backgroundColor = '#2a2a2a';
  contextMenu.style.border = '1px solid #555';
  contextMenu.style.borderRadius = '5px';
  contextMenu.style.padding = '5px 0';
  contextMenu.style.zIndex = '2001';
  contextMenu.style.minWidth = '150px';
  contextMenu.style.boxShadow = '0 2px 10px rgba(0,0,0,0.5)';
  
  const maxAvailable = shop.type === 'unlimited' ? shop.maxPurchaseQuantity : stockInfo.quantity;
  const playerCoins = getPlayerCoins();
  
  // Buy 1
  const buy1Price = calculateBuyPrice(shop, itemId, 1);
  const canAfford1 = playerCoins >= buy1Price;
  const buy1 = createShopBuyMenuItem(
    `Buy 1 (${buy1Price}gp)${!canAfford1 ? ' - Can\'t afford' : ''}`, 
    () => {
      if (canAfford1) {
        buyItemFromShop(itemId, 1);
      }
      hideShopBuyMenu();
    },
    canAfford1
  );
  contextMenu.appendChild(buy1);
  
  // Buy 5 (if available)
  if (maxAvailable >= 5) {
    const buy5Price = calculateBuyPrice(shop, itemId, 5);
    const canAfford5 = playerCoins >= buy5Price;
    const buy5 = createShopBuyMenuItem(
      `Buy 5 (${buy5Price}gp)${!canAfford5 ? ' - Can\'t afford' : ''}`,
      () => {
        if (canAfford5) {
          buyItemFromShop(itemId, 5);
        }
        hideShopBuyMenu();
      },
      canAfford5
    );
    contextMenu.appendChild(buy5);
  }
  
  // Buy 10 (if available)
  if (maxAvailable >= 10) {
    const buy10Price = calculateBuyPrice(shop, itemId, 10);
    const canAfford10 = playerCoins >= buy10Price;
    const buy10 = createShopBuyMenuItem(
      `Buy 10 (${buy10Price}gp)${!canAfford10 ? ' - Can\'t afford' : ''}`,
      () => {
        if (canAfford10) {
          buyItemFromShop(itemId, 10);
        }
        hideShopBuyMenu();
      },
      canAfford10
    );
    contextMenu.appendChild(buy10);
  }
  
  // Buy X (custom amount) - if more than 1 available
  if (maxAvailable > 1) {
    const buyX = createShopBuyMenuItem('Buy X', () => {
      const amount = prompt(`How many ${itemDef.name}s would you like to buy? (Available: ${maxAvailable})`, '1');
      if (amount && !isNaN(amount)) {
        const quantity = Math.min(parseInt(amount), maxAvailable);
        if (quantity > 0) {
          const totalPrice = calculateBuyPrice(shop, itemId, quantity);
          if (playerCoins >= totalPrice) {
            buyItemFromShop(itemId, quantity);
          } else {
            showNotification(`You need ${totalPrice} coins but only have ${playerCoins}!`, 'error');
          }
        }
      }
      hideShopBuyMenu();
    }, true);
    contextMenu.appendChild(buyX);
  }
  
  // Buy Max (if more than 1 available)
  if (maxAvailable > 1) {
    // Calculate max we can afford
    let maxCanAfford = 0;
    let totalCost = 0;
    for (let i = 1; i <= maxAvailable; i++) {
      const itemCost = calculateBuyPrice(shop, itemId, 1); // Cost for one more item
      if (totalCost + itemCost <= playerCoins) {
        totalCost += itemCost;
        maxCanAfford = i;
      } else {
        break;
      }
    }
    
    if (maxCanAfford > 1) {
      const maxPrice = calculateBuyPrice(shop, itemId, maxCanAfford);
      const buyMax = createShopBuyMenuItem(
        `Buy Max (${maxCanAfford}) (${maxPrice}gp)`,
        () => {
          buyItemFromShop(itemId, maxCanAfford);
          hideShopBuyMenu();
        },
        true
      );
      contextMenu.appendChild(buyMax);
    }
  }
  
  // Position the menu
  contextMenu.style.left = `${event.pageX}px`;
  contextMenu.style.top = `${event.pageY}px`;
  
  document.body.appendChild(contextMenu);
}

// Create shop buy menu item
function createShopBuyMenuItem(text, onClick, enabled = true) {
  const item = document.createElement('div');
  item.className = 'shop-buy-menu-item';
  item.textContent = text;
  item.style.padding = '8px 15px';
  item.style.cursor = enabled ? 'pointer' : 'not-allowed';
  item.style.color = enabled ? '#ccc' : '#666';
  item.style.transition = 'background-color 0.2s';
  item.style.fontSize = '13px';
  
  if (enabled) {
    item.addEventListener('mouseenter', () => {
      item.style.backgroundColor = '#3a3a3a';
    });
    
    item.addEventListener('mouseleave', () => {
      item.style.backgroundColor = 'transparent';
    });
    
    item.addEventListener('click', onClick);
  }
  
  return item;
}

// Hide shop buy menu
function hideShopBuyMenu() {
  const existingMenu = document.getElementById('shop-buy-menu');
  if (existingMenu) {
    existingMenu.remove();
  }
}

// Force complete refresh of shop interface
function refreshShopInterface() {
  if (!shopInterface.open || !shopInterface.currentShop) {
    console.log('SHOP: Cannot refresh - shop not open or no current shop');
    return;
  }
  
  console.log('SHOP: Force refreshing entire shop interface');
  
  // Immediate updates - prioritize inventory first
  console.log('SHOP: Refreshing main inventory display');
  updateInventoryDisplay();
  
  console.log('SHOP: Refreshing shop displays');
  updateShopDisplay();
  updateShopInventoryDisplay();
  
  // Force DOM refresh by triggering a reflow
  const shopOverlay = document.getElementById('shop-overlay');
  if (shopOverlay) {
    shopOverlay.style.display = 'none';
    shopOverlay.offsetHeight; // Force reflow
    shopOverlay.style.display = 'block';
  }
  
  // Multiple update passes to ensure everything refreshes
  setTimeout(() => {
    console.log('SHOP: Secondary refresh pass');
    updateInventoryDisplay();
    updateShopDisplay();
    updateShopInventoryDisplay();
  }, 10);
  
  setTimeout(() => {
    console.log('SHOP: Final refresh pass');
    updateShopDisplay();
    updateShopInventoryDisplay();
  }, 50);
}

// Setup shop inventory event handlers
function setupShopInventoryHandlers() {
  const shopInventoryGrid = document.getElementById('shop-inventory-grid');
  if (!shopInventoryGrid) return;
  
  console.log('SHOP: Setting up shop inventory handlers');
  
  // Shop inventory grid clicks (sell items)
  shopInventoryGrid.addEventListener('click', (e) => {
    const slot = e.target.closest('.shop-inventory-slot');
    if (!slot) return;
    
    const slotIndex = parseInt(slot.dataset.slot);
    const item = playerInventory[slotIndex];
    
    if (item && item.id !== 'coins') { // Don't allow selling coins
      const quantity = getSelectedQuantity();
      sellItemToShop(slotIndex, quantity);
    }
  });
  
  // Shop inventory grid right-clicks (sell options for stackable/noted items)
  shopInventoryGrid.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const slot = e.target.closest('.shop-inventory-slot');
    if (!slot) return;
    
    const slotIndex = parseInt(slot.dataset.slot);
    const item = playerInventory[slotIndex];
    
    if (item && item.id !== 'coins') { // Don't show context menu for coins
      showShopSellMenu(e, slotIndex);
    }
  });
}

// Update regular inventory as well

/**
 * Sync floor items from server (replace local floor items with server state)
 */
function syncFloorItemsFromServer(serverFloorItems) {
  console.log(`🌍 Syncing ${serverFloorItems.length} floor items from server`);
  
  // Replace local floor items with server state
  floorItems.length = 0; // Clear existing items
  
  serverFloorItems.forEach(serverItem => {
    floorItems.push({
      id: serverItem.id,
      item: { ...serverItem.item },
      x: serverItem.x,
      y: serverItem.y,
      spawnTime: serverItem.spawnTime,
      droppedBy: serverItem.droppedBy
    });
  });
  
  console.log(`✅ Floor items synced: ${floorItems.length} items loaded`);
  
  // Force world re-render to show synced items
  if (window.worldModule && window.worldModule.forceWorldRerender) {
    window.worldModule.forceWorldRerender();
  }
}

/**
 * Remove item from specific inventory slot (for server confirmations)
 */
function removeItemFromInventorySlot(slotIndex) {
  if (slotIndex < 0 || slotIndex >= playerInventory.length) {
    console.warn(`Invalid slot index for removal: ${slotIndex}`);
    return;
  }
  
  const item = playerInventory[slotIndex];
  if (!item) {
    console.warn(`No item found in slot ${slotIndex} to remove`);
    return;
  }
  
  console.log(`🗑️ Removing item from inventory slot ${slotIndex}:`, item);
  
  // Remove the entire item from the slot
  playerInventory[slotIndex] = null;
  updateInventoryDisplay();
  
  // Sync with server if online
  if (window.syncInventoryWithServer && window.isUserOnline && window.isUserOnline()) {
    window.syncInventoryWithServer(playerInventory);
  }
}

/**
 * Add item to inventory from server (handles noted items properly)
 */
function addItemToInventoryFromServer(item) {
  console.log(`📦 Adding item to inventory from server:`, item);
  
  // Handle noted items specially
  if (isItemNoted(item)) {
    // For noted items, try to find existing noted stack in inventory
    const existingNotedSlot = playerInventory.findIndex(invItem => 
      invItem && 
      invItem.id === item.id && 
      isItemNoted(invItem) &&
      getBaseItemId(invItem) === getBaseItemId(item)
    );
    
    if (existingNotedSlot !== -1) {
      // Add to existing noted stack
      playerInventory[existingNotedSlot].quantity = (playerInventory[existingNotedSlot].quantity || 1) + (item.quantity || 1);
      updateInventoryDisplay();
      return true;
    } else {
      // Find empty slot for new noted stack
      const emptySlot = playerInventory.findIndex(invItem => !invItem);
      if (emptySlot !== -1) {
        // Create new noted stack
        playerInventory[emptySlot] = { ...item }; // Copy the entire item including noted status
        updateInventoryDisplay();
        return true;
      }
    }
  } else {
    // For regular items, check if it has custom properties (like unfinished books, authored books)
    if (item.type === 'unfinished_book' || item.author || item.authorName || Object.keys(item).length > 2) {
      // Item has custom properties - preserve them by placing directly in inventory
      const emptySlot = playerInventory.findIndex(invItem => !invItem);
      if (emptySlot !== -1) {
        // Create new item with all properties preserved
        playerInventory[emptySlot] = { ...item }; // Copy the entire item including all custom properties
        updateInventoryDisplay();
        return true;
      }
    } else {
      // Regular item without custom properties - use the existing function
      return addItemToInventory(item.id, item.quantity);
    }
  }
  
  console.warn('Could not add item to inventory - probably full');
  return false;
}

/**
 * Add floor item to display (from other players or server)
 */
function addFloorItemToDisplay(floorItem) {
  console.log(`🎒 Adding floor item to display:`, floorItem);
  console.log(`📊 Current floor items before add:`, floorItems.length);
  
  // Check if item already exists (avoid duplicates)
  const existingIndex = floorItems.findIndex(item => item.id === floorItem.id);
  if (existingIndex !== -1) {
    console.log(`Floor item ${floorItem.id} already exists, updating instead`);
    floorItems[existingIndex] = { ...floorItem };
  } else {
    // Add new floor item
    floorItems.push({
      id: floorItem.id,
      item: { ...floorItem.item },
      x: floorItem.x,
      y: floorItem.y,
      spawnTime: floorItem.spawnTime,
      droppedBy: floorItem.droppedBy
    });
    console.log(`✅ Added floor item ${floorItem.id} to local array`);
  }
  
  console.log(`📊 Current floor items after add:`, floorItems.length);
  console.log(`📦 All floor items:`, floorItems.map(item => `${item.item.id} at (${item.x}, ${item.y})`));
  
  // Force world re-render to show the new item
  if (window.worldModule && window.worldModule.forceWorldRerender) {
    console.log(`🔄 Forcing world re-render to show floor item`);
    window.worldModule.forceWorldRerender();
  } else {
    console.warn(`⚠️ worldModule.forceWorldRerender not available!`);
  }
}

/**
 * Update floor item in display (for stacking updates)
 */
function updateFloorItemInDisplay(floorItem) {
  console.log(`📦 Updating floor item in display:`, floorItem);
  
  const existingIndex = floorItems.findIndex(item => item.id === floorItem.id);
  if (existingIndex !== -1) {
    // Update existing floor item
    floorItems[existingIndex] = {
      id: floorItem.id,
      item: { ...floorItem.item },
      x: floorItem.x,
      y: floorItem.y,
      spawnTime: floorItem.spawnTime,
      droppedBy: floorItem.droppedBy
    };
    
    // Force world re-render to show the updated quantity
    if (window.worldModule && window.worldModule.forceWorldRerender) {
      window.worldModule.forceWorldRerender();
    }
  } else {
    console.warn(`Floor item ${floorItem.id} not found for update, adding instead`);
    addFloorItemToDisplay(floorItem);
  }
}

/**
 * Remove floor item from display (when picked up or despawned)
 */
function removeFloorItemFromDisplay(floorItemId) {
  console.log(`🗑️ Removing floor item from display: ${floorItemId}`);
  
  const existingIndex = floorItems.findIndex(item => item.id === floorItemId);
  if (existingIndex !== -1) {
    floorItems.splice(existingIndex, 1);
    
    // Force world re-render to hide the removed item
    if (window.worldModule && window.worldModule.forceWorldRerender) {
      window.worldModule.forceWorldRerender();
    }
  } else {
    console.warn(`Floor item ${floorItemId} not found for removal`);
  }
}

// Update the window.inventoryModule assignments to use the actual functions
if (typeof window !== 'undefined') {
  // Expose itemCombinations globally for other modules (like fletching)
  window.itemCombinations = itemCombinations;
  
  // Expose the actual floor item functions through a separate object
  window.inventoryModuleFunctions = {
    syncFloorItemsFromServer: syncFloorItemsFromServer,
    removeItemFromInventorySlot: removeItemFromInventorySlot,
    addItemToInventoryFromServer: addItemToInventoryFromServer,
    addCustomItemToInventory: addCustomItemToInventory,
    getItemDefinition: getItemDefinition,
    addFloorItemToDisplay: addFloorItemToDisplay,
    updateFloorItemInDisplay: updateFloorItemInDisplay,
    removeFloorItemFromDisplay: removeFloorItemFromDisplay,
    isItemNoted: isItemNoted,
    syncShopsFromServer: syncShopsFromServer,
    refreshShopInterface: refreshShopInterface,
    ensureInventoryIntegrity: ensureInventoryIntegrity,
    splitNonStackableStacks: splitNonStackableStacks
  };
  
  console.log('✅ Floor item functions exposed through window.inventoryModuleFunctions');
  console.log('Functions available:', Object.keys(window.inventoryModuleFunctions));
  console.log('🔍 Test call addFloorItemToDisplay function type:', typeof window.inventoryModuleFunctions.addFloorItemToDisplay);
  
  // Also update the existing inventoryModule if it exists
  if (window.inventoryModule) {
    console.log('🔧 Updating existing inventoryModule functions...');
    window.inventoryModule.syncFloorItemsFromServer = syncFloorItemsFromServer;
    window.inventoryModule.removeItemFromInventorySlot = removeItemFromInventorySlot;
    window.inventoryModule.addItemToInventoryFromServer = addItemToInventoryFromServer;
    window.inventoryModule.addCustomItemToInventory = addCustomItemToInventory;
    window.inventoryModule.getItemDefinition = getItemDefinition;
    
    // Debug: Verify the assignment worked
    console.log('🔍 addCustomItemToInventory function before assignment:', typeof addCustomItemToInventory);
    console.log('🔍 addCustomItemToInventory function object before assignment:', addCustomItemToInventory);
    console.log('🔍 addCustomItemToInventory assigned successfully:', typeof window.inventoryModule.addCustomItemToInventory);
    console.log('🔍 addCustomItemToInventory function after assignment:', window.inventoryModule.addCustomItemToInventory);
    window.inventoryModule.addFloorItemToDisplay = addFloorItemToDisplay;
    window.inventoryModule.updateFloorItemInDisplay = updateFloorItemInDisplay;
    window.inventoryModule.removeFloorItemFromDisplay = removeFloorItemFromDisplay;
    
    // Expose shop interface state and functions for multiplayer module
    window.inventoryModule.shopInterface = shopInterface;
    window.inventoryModule.updateShopInventoryDisplay = updateShopInventoryDisplay;
    window.inventoryModule.updateShopDisplay = updateShopDisplay;
    window.inventoryModule.refreshShopInterface = refreshShopInterface;
    window.inventoryModule.ensureInventoryIntegrity = ensureInventoryIntegrity;
    window.inventoryModule.splitNonStackableStacks = splitNonStackableStacks;
    
    console.log('✅ Floor item functions in inventoryModule updated');
    console.log('✅ Shop interface state and functions exposed to inventoryModule');
    console.log('🔍 Test inventoryModule.addFloorItemToDisplay type:', typeof window.inventoryModule.addFloorItemToDisplay);
    console.log('🏪 Shop interface exposed:', !!window.inventoryModule.shopInterface);
  } else {
    console.log('ℹ️ window.inventoryModule not yet available, functions exposed through inventoryModuleFunctions');
  }
  
  // Set up automatic shop inventory refresh system
  let shopInventoryRefreshInterval = null;
  
  function startShopInventoryAutoRefresh() {
    if (shopInventoryRefreshInterval) {
      clearInterval(shopInventoryRefreshInterval);
    }
    
    shopInventoryRefreshInterval = setInterval(() => {
      // Only refresh if shop is open
      if (shopInterface && shopInterface.open && shopInterface.currentShop) {
        console.log('🔄 Auto-refreshing shop inventory display...');
        updateShopInventoryDisplay();
        
        // Also update the shop stock display to keep everything in sync
        updateShopDisplay();
      }
    }, 500); // Refresh every 500ms as suggested by user
    
    console.log('✅ Shop inventory auto-refresh started (500ms intervals)');
  }
  
  function stopShopInventoryAutoRefresh() {
    if (shopInventoryRefreshInterval) {
      clearInterval(shopInventoryRefreshInterval);
      shopInventoryRefreshInterval = null;
      console.log('🛑 Shop inventory auto-refresh stopped');
    }
  }
  
  // Expose the auto-refresh functions
  window.inventoryModule = window.inventoryModule || {};
  window.inventoryModule.startShopInventoryAutoRefresh = startShopInventoryAutoRefresh;
  window.inventoryModule.stopShopInventoryAutoRefresh = stopShopInventoryAutoRefresh;
  
  // Monitor shop state to automatically start/stop refresh
  function checkShopState() {
    if (shopInterface && shopInterface.open && !shopInventoryRefreshInterval) {
      console.log('🏪 Shop opened - starting auto-refresh');
      startShopInventoryAutoRefresh();
    } else if ((!shopInterface || !shopInterface.open) && shopInventoryRefreshInterval) {
      console.log('🏪 Shop closed - stopping auto-refresh');
      stopShopInventoryAutoRefresh();
    }
  }
  
  // Check shop state every second to automatically manage refresh
  setInterval(checkShopState, 1000);
  
  console.log('✅ Shop inventory auto-refresh system initialized');
}

// Equip an item from inventory
function equipItem(slotIndex, specificSlot = null) {
  const item = playerInventory[slotIndex];
  if (!item) return;

  const itemDef = getItemDefinition(item.id);
  if (!itemDef || !itemDef.equipment) {
    showNotification(`${itemDef?.name || 'This item'} cannot be equipped.`, 'error');
    return;
  }

  // Check requirements
  const profile = window.userModule?.getProfile();
  if (!profile) {
    showNotification('Unable to access player profile.', 'error');
    return;
  }

  if (itemDef.equipment.requirements) {
    for (const [skill, level] of Object.entries(itemDef.equipment.requirements)) {
      const playerLevel = profile.skills?.[skill] || 1;
      if (playerLevel < level) {
        showNotification(`You need level ${level} ${skill} to equip this item.`, 'error');
        return;
      }
    }
  }

  const slot = itemDef.equipment.slot;
  if (!slot) {
    showNotification(`${itemDef.name} has no equipment slot defined.`, 'error');
    return;
  }

  // Initialize equipment object if it doesn't exist
  if (!profile.equipment) {
    profile.equipment = {
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
    };
  }

  // Handle ring slot selection
  let targetSlot = slot;
  if (slot === 'ring') {
    if (specificSlot === 'ring' || specificSlot === 'ring2') {
      targetSlot = specificSlot;
    } else {
      // Default behavior: use first empty slot, or first slot if both occupied
      if (!profile.equipment.ring) {
        targetSlot = 'ring';
      } else if (!profile.equipment.ring2) {
        targetSlot = 'ring2';
      } else {
        // Both ring slots occupied, replace first ring
        targetSlot = 'ring';
      }
    }
  }

  // Handle arrow stacking specially
  if (targetSlot === 'arrows') {
    // Check if same arrow type is already equipped
    if (profile.equipment[targetSlot] && profile.equipment[targetSlot].id === item.id) {
      // Stack the arrows
      const currentQuantity = profile.equipment[targetSlot].quantity || 1;
      const newQuantity = item.quantity || 1;
      profile.equipment[targetSlot].quantity = currentQuantity + newQuantity;

      // Remove FULL stack from inventory, not just one
      playerInventory[slotIndex] = null;
      updateInventoryDisplay();

      // Sync with server if online
      if (window.syncInventoryWithServer && window.isUserOnline && window.isUserOnline()) {
        window.syncInventoryWithServer(playerInventory);
      }

      showNotification(`You add ${newQuantity} arrows to your equipped stack (${profile.equipment[targetSlot].quantity} total).`, 'success');
    } else {
      // Different arrow type or empty slot - unequip existing first
      if (profile.equipment[targetSlot]) {
        const unequippedItem = profile.equipment[targetSlot];
        // Add unequipped arrows back to inventory
        if (!addItemToInventory(unequippedItem.id, unequippedItem.quantity || 1)) {
          // Inventory full
          showNotification('Your inventory is full!', 'error');
          return;
        }
      }

      // Equip the new arrows with full quantity
      profile.equipment[targetSlot] = {
        id: item.id,
        quantity: item.quantity || 1
      };

      // Remove FULL stack from inventory
      playerInventory[slotIndex] = null;
      updateInventoryDisplay();

      if (window.syncInventoryWithServer && window.isUserOnline && window.isUserOnline()) {
        window.syncInventoryWithServer(playerInventory);
      }

      const actionText = itemDef.useAction === 'wear' ? 'wear' : 'wield';
      showNotification(`You ${actionText} the ${itemDef.name} (${item.quantity || 1}).`, 'success');
    }
  } else {
    // Regular equipment handling
    // Unequip existing item in the slot if any
    if (profile.equipment[targetSlot]) {
      const unequippedItem = profile.equipment[targetSlot];
      
      // Add unequipped item back to inventory
      if (!addItemToInventory(unequippedItem.id, unequippedItem.quantity || 1)) {
        // Inventory full
        showNotification('Your inventory is full!', 'error');
        return;
      }
    }

    // Equip the new item
    profile.equipment[targetSlot] = { ...item };
    removeItemFromInventory(slotIndex);
    
    const actionText = itemDef.useAction === 'wear' ? 'wear' : 'wield';
    showNotification(`You ${actionText} the ${itemDef.name}.`, 'success');
  }
  
  // Update equipment display
  updateEquipmentDisplay();
  
  // Update combat stats if combat module is available
  if (window.combatModule?.updateCombatStats) {
    window.combatModule.updateCombatStats();
  }
  
  // Save profile
  if (window.userModule?.saveProfile) {
    window.userModule.saveProfile();
  }
}

// Update equipment display
function updateEquipmentDisplay() {
  const profile = window.userModule?.getProfile();
  if (!profile) return;

  // Initialize equipment object if it doesn't exist
  if (!profile.equipment) {
    profile.equipment = {
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
    };
  }

  // Update each equipment slot
  Object.entries(profile.equipment).forEach(([slotName, equippedItem]) => {
    const slotElement = document.querySelector(`.equipment-slot[data-slot="${slotName}"]`);
    if (!slotElement) return;

    // Remove existing event listeners
    slotElement.replaceWith(slotElement.cloneNode(true));
    const newSlotElement = document.querySelector(`.equipment-slot[data-slot="${slotName}"]`);

    if (equippedItem) {
      const itemDef = getItemDefinition(equippedItem.id);
      if (itemDef) {
        newSlotElement.classList.remove('empty');
        newSlotElement.classList.add('equipped');
        // Show quantity for stackable items like arrows
        const quantity = equippedItem.quantity || 1;
        let quantityText = '';
        // Always show count for arrows, or for any stackable item with more than 1
        const isArrow = equippedItem.id && equippedItem.id.includes('_arrow');
        if (isArrow || quantity > 1) {
          quantityText = ` (${quantity})`;
        }
        
        newSlotElement.innerHTML = `
          <span class="slot-icon">${itemDef.icon}</span>
          <span class="slot-name">${itemDef.name}${quantityText}</span>
        `;
        newSlotElement.title = `${itemDef.name}${quantityText}: ${itemDef.description}`;
        
        // Add click handler to unequip
        newSlotElement.addEventListener('click', () => unequipItem(slotName));
      }
    } else {
      newSlotElement.classList.remove('equipped');
      newSlotElement.classList.add('empty');
      // Restore default slot content
      const slotIcons = {
        helmet: '⛑️',
        amulet: '📿',
        arrows: '🏹',
        weapon: '⚔️',
        body: '🛡️',
        shield: '🛡️',
        legs: '👖',
        gloves: '🧤',
        boots: '👢',
        cape: '🧥',
        ring: '💍',
        ring2: '💍'
      };
      const slotNames = {
        helmet: 'Helmet',
        amulet: 'Amulet',
        arrows: 'Arrows',
        weapon: 'Weapon',
        body: 'Body',
        shield: 'Shield',
        legs: 'Legs',
        gloves: 'Gloves',
        boots: 'Boots',
        cape: 'Cape',
        ring: 'Ring',
        ring2: 'Ring'
      };
      newSlotElement.innerHTML = `
        <span class="slot-icon">${slotIcons[slotName] || '📦'}</span>
        <span class="slot-name">${slotNames[slotName] || slotName}</span>
      `;
      newSlotElement.title = slotNames[slotName] || slotName;
    }
  });
}

// Unequip an item from equipment slot
function unequipItem(slotName) {
  const profile = window.userModule?.getProfile();
  if (!profile?.equipment?.[slotName]) return;

  const equippedItem = profile.equipment[slotName];
  
  // Add item back to inventory
  if (!addItemToInventory(equippedItem.id, equippedItem.quantity || 1)) {
    showNotification('Your inventory is full!', 'error');
    return;
  }

  // Remove from equipment
  profile.equipment[slotName] = null;
  
  const itemDef = getItemDefinition(equippedItem.id);
  showNotification(`You unequip the ${itemDef?.name || 'item'}.`, 'info');
  
  // Update displays
  updateEquipmentDisplay();
  
  // Update combat stats if combat module is available
  if (window.combatModule?.updateCombatStats) {
    window.combatModule.updateCombatStats();
  }
  
  // Save profile
  if (window.userModule?.saveProfile) {
    window.userModule.saveProfile();
  }
}

/**
 * Scan the entire inventory and make sure no non-stackable item has quantity > 1.
 * If such a stack exists (e.g. after a bulk purchase), it will be fanned out into
 * separate slots using splitNonStackableStacks.
 */
function ensureInventoryIntegrity() {
  let changed = false;
  for (const slot of playerInventory) {
    if (!slot) continue;
    if (isItemNoted(slot)) continue; // noted items allowed to stack
    const def = getItemDefinition(slot.id);
    if (!def || def.stackable) continue;
    if ((slot.quantity || 1) > 1) {
      splitNonStackableStacks(slot.id);
      changed = true;
    }
  }
  // If inventory was altered and we're online, send sync to server
  if (changed && window.isUserOnline && window.isUserOnline() && window.syncInventoryWithServer) {
    window.syncInventoryWithServer(playerInventory);
  }
}
