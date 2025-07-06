/**
 * Shop module for WebscapeRPG
 * Handles all shop-related functionality including buying, selling, and shop management
 */

// Shop configuration
const SHOP_UPDATE_INTERVAL = 60000; // Update shop stocks every minute
const MAX_SHOP_STOCK = 50; // Maximum stock per item
const PRICE_FLUCTUATION = 0.1; // 10% price fluctuation

// Shop state
let currentShop = null;
let shopInterface = {
  open: false,
  selectedSlot: -1,
  selectedItem: null,
  mode: 'buy' // 'buy' or 'sell'
};

// Stock replenishment timer
let stockTimer = null;

// Shop definitions - OSRS-inspired shops
const shopDefinitions = {
  general_store: {
    id: 'general_store',
    name: 'Webscape General Store',
    shopkeeper: 'Bob',
    description: 'Buy and sell general goods',
    icon: '🏪',
    buyMultiplier: 1.0, // Standard prices when buying from shop
    sellMultiplier: 0.6, // 60% of base value when selling to shop
    stock: {
      coins: { quantity: 10000, basePrice: 1, restockAmount: 0 }, // Unlimited coins
      apple: { quantity: 30, basePrice: 5, restockAmount: 5 },
      bread: { quantity: 20, basePrice: 8, restockAmount: 3 },
      meat: { quantity: 15, basePrice: 12, restockAmount: 2 },
      rope: { quantity: 10, basePrice: 25, restockAmount: 2 },
      tinderbox: { quantity: 5, basePrice: 50, restockAmount: 1 }
    },
    buysItems: true, // This shop will buy items from players
    location: { x: 50, y: 50 } // World coordinates
  },
  
  weapon_shop: {
    id: 'weapon_shop',
    name: 'The Fighting Cock',
    shopkeeper: 'Weaponmaster Will',
    description: 'Weapons and armor for the brave',
    icon: '⚔️',
    buyMultiplier: 1.2,
    sellMultiplier: 0.7,
    stock: {
      bronze_sword: { quantity: 10, basePrice: 100, restockAmount: 2 },
      iron_sword: { quantity: 8, basePrice: 250, restockAmount: 1 },
      steel_sword: { quantity: 5, basePrice: 500, restockAmount: 1 },
      bronze_shield: { quantity: 8, basePrice: 80, restockAmount: 2 },
      iron_shield: { quantity: 6, basePrice: 200, restockAmount: 1 },
      leather_armor: { quantity: 12, basePrice: 150, restockAmount: 2 },
      shortbow: { quantity: 6, basePrice: 200, restockAmount: 1 },
      longbow: { quantity: 4, basePrice: 400, restockAmount: 1 },
      bronze_arrow: { quantity: 500, basePrice: 2, restockAmount: 100 },
      iron_arrow: { quantity: 300, basePrice: 4, restockAmount: 50 },
      steel_arrow: { quantity: 200, basePrice: 8, restockAmount: 25 },
      leather_cape: { quantity: 10, basePrice: 50, restockAmount: 2 },
      red_cape: { quantity: 5, basePrice: 100, restockAmount: 1 },
      bronze_ring: { quantity: 15, basePrice: 25, restockAmount: 3 },
      iron_ring: { quantity: 10, basePrice: 50, restockAmount: 2 },
      gold_ring: { quantity: 5, basePrice: 200, restockAmount: 1 }
    },
    buysItems: true,
    acceptedCategories: ['weapons', 'armor', 'ammunition'], // Added ammunition
    location: { x: 75, y: 30 }
  },
  
  magic_shop: {
    id: 'magic_shop',
    name: 'Mystical Emporium',
    shopkeeper: 'Wizard Zara',
    description: 'Magical items and potions',
    icon: '🔮',
    buyMultiplier: 1.5,
    sellMultiplier: 0.8,
    stock: {
      mana_potion: { quantity: 20, basePrice: 75, restockAmount: 3 },
      health_potion: { quantity: 25, basePrice: 50, restockAmount: 4 },
      magic_staff: { quantity: 3, basePrice: 800, restockAmount: 1 },
      rune_fire: { quantity: 100, basePrice: 15, restockAmount: 20 },
      rune_water: { quantity: 100, basePrice: 15, restockAmount: 20 },
      scroll_teleport: { quantity: 10, basePrice: 200, restockAmount: 2 },
      blue_cape: { quantity: 3, basePrice: 150, restockAmount: 1 }
    },
    buysItems: true,
    acceptedCategories: ['magic', 'potions', 'runes'],
    location: { x: 25, y: 75 }
  },
  
  mining_shop: {
    id: 'mining_shop',
    name: 'Pickaxe Pete\'s Mining Supplies',
    shopkeeper: 'Pickaxe Pete',
    description: 'Tools and resources for miners',
    icon: '⛏️',
    buyMultiplier: 1.1,
    sellMultiplier: 0.65,
    stock: {
      bronze_pickaxe: { quantity: 8, basePrice: 120, restockAmount: 2 },
      iron_pickaxe: { quantity: 5, basePrice: 300, restockAmount: 1 },
      bronze_shovel: { quantity: 8, basePrice: 120, restockAmount: 2 },
      iron_shovel: { quantity: 8, basePrice: 300, restockAmount: 2 },
      coal: { quantity: 50, basePrice: 20, restockAmount: 10 },
      iron_ore: { quantity: 30, basePrice: 35, restockAmount: 6 },
      copper_ore: { quantity: 40, basePrice: 15, restockAmount: 8 },
      tin_ore: { quantity: 40, basePrice: 15, restockAmount: 8 }
    },
    buysItems: true,
    acceptedCategories: ['tools', 'ores', 'bars'],
    location: { x: 80, y: 80 }
  },
  
  fletching_shop: {
    id: 'fletching_shop',
    name: 'The Bow String',
    shopkeeper: 'Fletcher Frank',
    description: 'Finest bows and arrows in the land',
    icon: '🏹',
    buyMultiplier: 1.1,
    sellMultiplier: 0.75,
    stock: {
      bronze_knife: { quantity: 10, basePrice: 60, restockAmount: 3 },
      iron_knife: { quantity: 8, basePrice: 140, restockAmount: 2 },
      steel_knife: { quantity: 5, basePrice: 280, restockAmount: 1 },
      shortbow: { quantity: 6, basePrice: 150, restockAmount: 2 },
      longbow: { quantity: 4, basePrice: 300, restockAmount: 1 },
      oak_shortbow: { quantity: 3, basePrice: 400, restockAmount: 1 },
      oak_longbow: { quantity: 2, basePrice: 600, restockAmount: 1 },
      willow_shortbow: { quantity: 1, basePrice: 800, restockAmount: 1 },
      willow_longbow: { quantity: 1, basePrice: 1200, restockAmount: 1 }
    },
    buysItems: true,
    acceptedCategories: ['ranged', 'tools', 'logs'],
    location: { x: 65, y: 50 }
  },
  
  fishing_shop: {
    id: 'fishing_shop',
    name: 'The Fishing Spot',
    shopkeeper: 'Fisherman Pete',
    description: 'All your fishing needs in one place',
    icon: '🎣',
    buyMultiplier: 1.1,
    sellMultiplier: 0.75,
    stock: {
      small_net: { quantity: 15, basePrice: 30, restockAmount: 3 },
      fishing_rod: { quantity: 12, basePrice: 60, restockAmount: 2 },
      big_net: { quantity: 8, basePrice: 80, restockAmount: 2 },
      harpoon: { quantity: 5, basePrice: 100, restockAmount: 1 },
      lobster_pot: { quantity: 4, basePrice: 100, restockAmount: 1 },
      raw_shrimps: { quantity: 5, basePrice: 20, restockAmount: 5 },
      raw_sardine: { quantity: 5, basePrice: 35, restockAmount: 3 },
      raw_herring: { quantity: 5, basePrice: 50, restockAmount: 3 }
    },
    buysItems: true,
    acceptedCategories: ['fishing', 'fish', 'tools'],
    location: { x: 40, y: 85 }
  }
};

// Extended item definitions for shop items (supplements the main inventory items)
const shopItemDefinitions = {
  /*bread: {
    id: 'bread',
    name: 'Bread',
    icon: '🍞',
    stackable: true,
    description: 'Fresh baked bread. Restores hunger.',
    useAction: 'eat',
    category: 'food'
  },
  meat: {
    id: 'meat',
    name: 'Cooked Meat',
    icon: '🥩',
    stackable: true,
    description: 'Well-cooked meat. Very filling.',
    useAction: 'eat',
    category: 'food'
  }*/
};

// Initialize shop system
function initializeShop() {
  console.log('Initializing shop system...');
  
  // Start stock replenishment timer
  if (stockTimer) {
    clearInterval(stockTimer);
  }
  stockTimer = setInterval(replenishStock, SHOP_UPDATE_INTERVAL);
  
  // Create shop interface elements
  createShopInterface();
  
  console.log('Shop system initialized');
}

// Create the shop interface UI
function createShopInterface() {
  // Check if shop interface already exists
  if (document.getElementById('shop-interface')) {
    return;
  }
  
  const shopHTML = `
    <div id="shop-interface" class="shop-interface" style="display: none;">
      <div class="shop-window">
        <div class="shop-header">
          <h3 id="shop-title">Shop</h3>
          <button id="shop-close" class="close-btn">×</button>
        </div>
        
        <div class="shop-content">
          <div class="shop-info">
            <div id="shop-keeper">Shopkeeper</div>
            <div id="shop-description">Shop description</div>
          </div>
          
          <div class="shop-controls">
            <button id="shop-buy-tab" class="shop-tab active">Buy</button>
            <button id="shop-sell-tab" class="shop-tab">Sell</button>
            <div class="shop-coins">
              <span>💰 <span id="player-coins">0</span> coins</span>
            </div>
          </div>
          
          <div class="shop-main">
            <div class="shop-inventory">
              <div class="shop-items" id="shop-items">
                <!-- Shop items will be populated here -->
              </div>
            </div>
            
            <div class="shop-actions">
              <div class="quantity-controls">
                <button id="buy-1">Buy 1</button>
                <button id="buy-5">Buy 5</button>
                <button id="buy-10">Buy 10</button>
                <button id="buy-all">Buy All</button>
              </div>
              <div class="selected-item-info" id="selected-item-info">
                Select an item to see details
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', shopHTML);
  
  // Add event listeners
  setupShopEventListeners();
}

// Setup event listeners for shop interface
function setupShopEventListeners() {
  // Close button
  document.getElementById('shop-close').addEventListener('click', closeShop);
  
  // Tab buttons
  document.getElementById('shop-buy-tab').addEventListener('click', () => setShopMode('buy'));
  document.getElementById('shop-sell-tab').addEventListener('click', () => setShopMode('sell'));
  
  // Quantity buttons
  document.getElementById('buy-1').addEventListener('click', () => {
    if (shopInterface.mode === 'buy') {
      buyItem(1);
    } else {
      sellItem(1);
    }
  });
  document.getElementById('buy-5').addEventListener('click', () => {
    if (shopInterface.mode === 'buy') {
      buyItem(5);
    } else {
      sellItem(5);
    }
  });
  document.getElementById('buy-10').addEventListener('click', () => {
    if (shopInterface.mode === 'buy') {
      buyItem(10);
    } else {
      sellItem(10);
    }
  });
  document.getElementById('buy-all').addEventListener('click', () => {
    if (shopInterface.mode === 'buy') {
      buyItem(-1);
    } else {
      sellItem(-1);
    }
  });
  
  // Close on escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && shopInterface.open) {
      closeShop();
    }
  });
}

// Open a specific shop
function openShop(shopId) {
  if (!shopDefinitions[shopId]) {
    console.error(`Shop ${shopId} not found`);
    return false;
  }
  
  currentShop = shopDefinitions[shopId];
  shopInterface.open = true;
  shopInterface.mode = 'buy';
  shopInterface.selectedSlot = -1;
  shopInterface.selectedItem = null;
  
  // Update UI
  updateShopInterface();
  
  // Show the interface
  const shopElement = document.getElementById('shop-interface');
  if (shopElement) {
    shopElement.style.display = 'block';
  }
  
  // Notify that shop is opened
  if (window.uiModule?.showNotification) {
    window.uiModule.showNotification(`Welcome to ${currentShop.name}!`, 'info');
  }
  
  return true;
}

// Close the shop
function closeShop() {
  shopInterface.open = false;
  currentShop = null;
  
  const shopElement = document.getElementById('shop-interface');
  if (shopElement) {
    shopElement.style.display = 'none';
  }
}

// Set shop mode (buy/sell)
function setShopMode(mode) {
  shopInterface.mode = mode;
  shopInterface.selectedSlot = -1;
  shopInterface.selectedItem = null;
  
  // Update tab appearance
  document.getElementById('shop-buy-tab').classList.toggle('active', mode === 'buy');
  document.getElementById('shop-sell-tab').classList.toggle('active', mode === 'sell');
  
  // Update quantity button text
  const buyButtons = ['buy-1', 'buy-5', 'buy-10', 'buy-all'];
  buyButtons.forEach((id, index) => {
    const button = document.getElementById(id);
    if (button) {
      if (mode === 'buy') {
        const quantities = ['Buy 1', 'Buy 5', 'Buy 10', 'Buy All'];
        button.textContent = quantities[index];
      } else {
        const quantities = ['Sell 1', 'Sell 5', 'Sell 10', 'Sell All'];
        button.textContent = quantities[index];
      }
    }
  });
  
  updateShopInterface();
}

// Update the shop interface
function updateShopInterface() {
  if (!currentShop || !shopInterface.open) return;
  
  // Update shop title and info
  document.getElementById('shop-title').textContent = currentShop.name;
  document.getElementById('shop-keeper').textContent = `Shopkeeper: ${currentShop.shopkeeper}`;
  document.getElementById('shop-description').textContent = currentShop.description;
  
  // Update player coins
  const playerCoins = getPlayerCoins();
  document.getElementById('player-coins').textContent = playerCoins.toLocaleString();
  
  // Update shop items based on mode
  if (shopInterface.mode === 'buy') {
    updateShopBuyInterface();
  } else {
    updateShopSellInterface();
  }
}

// Update buy interface
function updateShopBuyInterface() {
  const shopItemsContainer = document.getElementById('shop-items');
  if (!shopItemsContainer) return;
  
  shopItemsContainer.innerHTML = '';
  
  Object.entries(currentShop.stock).forEach(([itemId, stockInfo], index) => {
    const itemDef = getShopItemDefinition(itemId);
    if (!itemDef) return;
    
    const price = calculateBuyPrice(itemId);
    const canAfford = getPlayerCoins() >= price;
    const inStock = stockInfo.quantity > 0;
    
    const itemElement = document.createElement('div');
    itemElement.className = `shop-item ${!canAfford || !inStock ? 'unavailable' : ''}`;
    itemElement.dataset.itemId = itemId;
    itemElement.dataset.slotIndex = index;
    
    itemElement.innerHTML = `
      <div class="item-icon">${itemDef.icon}</div>
      <div class="item-name">${itemDef.name}</div>
      <div class="item-stock">Stock: ${stockInfo.quantity}</div>
      <div class="item-price">💰 ${price.toLocaleString()}</div>
    `;
    
    itemElement.addEventListener('click', () => selectShopItem(itemId, index));
    
    shopItemsContainer.appendChild(itemElement);
  });
}

// Update sell interface
function updateShopSellInterface() {
  const shopItemsContainer = document.getElementById('shop-items');
  if (!shopItemsContainer) return;
  
  shopItemsContainer.innerHTML = '';
  
  // Get player inventory
  const playerInventory = getPlayerInventory();
  if (!playerInventory) return;
  
  playerInventory.forEach((item, index) => {
    if (!item) return;
    
    // Check if shop accepts this item
    if (!canShopBuyItem(item.id)) return;
    
    const price = calculateSellPrice(item.id);
    
    const itemElement = document.createElement('div');
    itemElement.className = 'shop-item';
    itemElement.dataset.itemId = item.id;
    itemElement.dataset.slotIndex = index;
    
    itemElement.innerHTML = `
      <div class="item-icon">${item.icon}</div>
      <div class="item-name">${item.name}</div>
      <div class="item-quantity">Qty: ${item.quantity || 1}</div>
      <div class="item-price">💰 ${price.toLocaleString()}</div>
    `;
    
    itemElement.addEventListener('click', () => selectShopItem(item.id, index));
    
    shopItemsContainer.appendChild(itemElement);
  });
}

// Select an item in the shop
function selectShopItem(itemId, slotIndex) {
  shopInterface.selectedSlot = slotIndex;
  shopInterface.selectedItem = itemId;
  
  // Update visual selection
  document.querySelectorAll('.shop-item').forEach(el => {
    el.classList.remove('selected');
  });
  
  document.querySelector(`[data-slot-index="${slotIndex}"]`)?.classList.add('selected');
  
  // Update item info
  updateSelectedItemInfo(itemId);
}

// Update selected item information
function updateSelectedItemInfo(itemId) {
  const infoElement = document.getElementById('selected-item-info');
  if (!infoElement) return;
  
  const itemDef = getShopItemDefinition(itemId);
  if (!itemDef) return;
  
  const buyPrice = calculateBuyPrice(itemId);
  const sellPrice = calculateSellPrice(itemId);
  
  if (shopInterface.mode === 'buy') {
    const stockInfo = currentShop.stock[itemId];
    infoElement.innerHTML = `
      <div class="item-details">
        <div class="item-icon-large">${itemDef.icon}</div>
        <div class="item-info-text">
          <div class="item-name">${itemDef.name}</div>
          <div class="item-description">${itemDef.description}</div>
          <div class="item-price">Price: 💰 ${buyPrice.toLocaleString()}</div>
          <div class="item-stock">In stock: ${stockInfo?.quantity || 0}</div>
        </div>
      </div>
    `;
  } else {
    infoElement.innerHTML = `
      <div class="item-details">
        <div class="item-icon-large">${itemDef.icon}</div>
        <div class="item-info-text">
          <div class="item-name">${itemDef.name}</div>
          <div class="item-description">${itemDef.description}</div>
          <div class="item-price">Shop offers: 💰 ${sellPrice.toLocaleString()}</div>
        </div>
      </div>
    `;
  }
}

// Buy an item from the shop
function buyItem(quantity) {
  if (!currentShop || !shopInterface.selectedItem) {
    showShopMessage('Please select an item to buy', 'error');
    return;
  }
  
  const itemId = shopInterface.selectedItem;
  const stockInfo = currentShop.stock[itemId];
  const itemDef = getShopItemDefinition(itemId);
  
  if (!stockInfo || !itemDef) {
    showShopMessage('Item not available', 'error');
    return;
  }
  
  // Calculate actual quantity to buy
  let actualQuantity = quantity;
  if (quantity === -1) { // Buy all
    actualQuantity = stockInfo.quantity;
  } else {
    actualQuantity = Math.min(quantity, stockInfo.quantity);
  }
  
  if (actualQuantity <= 0) {
    showShopMessage('Item is out of stock', 'error');
    return;
  }
  
  const pricePerItem = calculateBuyPrice(itemId);
  const totalCost = pricePerItem * actualQuantity;
  const playerCoins = getPlayerCoins();
  
  // Check if player can afford it
  if (playerCoins < totalCost) {
    const canAfford = Math.floor(playerCoins / pricePerItem);
    if (canAfford > 0) {
      showShopMessage(`You can only afford ${canAfford} of these items`, 'warning');
      return;
    } else {
      showShopMessage('You cannot afford this item', 'error');
      return;
    }
  }
  
  // Check inventory space
  const freeSlots = getFreeInventorySlots();
  if (!itemDef.stackable && freeSlots < actualQuantity) {
    showShopMessage(`You need ${actualQuantity} free inventory slots`, 'error');
    return;
  }
  
  // Process the purchase
  if (removePlayerCoins(totalCost) && addItemToPlayer(itemId, actualQuantity)) {
    // Remove from shop stock
    stockInfo.quantity -= actualQuantity;
    
    // Show success message
    const itemName = actualQuantity === 1 ? itemDef.name : `${actualQuantity}x ${itemDef.name}`;
    showShopMessage(`Purchased ${itemName} for ${totalCost.toLocaleString()} coins`, 'success');
    
    // Update interface
    updateShopInterface();
  } else {
    showShopMessage('Purchase failed', 'error');
  }
}

// Sell an item to the shop
function sellItem(quantity) {
  if (!currentShop || !shopInterface.selectedItem || shopInterface.mode !== 'sell') {
    showShopMessage('Please select an item to sell', 'error');
    return;
  }
  
  const itemId = shopInterface.selectedItem;
  const slotIndex = shopInterface.selectedSlot;
  
  if (!canShopBuyItem(itemId)) {
    showShopMessage('This shop does not buy this type of item', 'error');
    return;
  }
  
  const playerItem = getPlayerInventoryItem(slotIndex);
  if (!playerItem || playerItem.id !== itemId) {
    showShopMessage('Item not found in inventory', 'error');
    return;
  }
  
  // Calculate actual quantity to sell
  let actualQuantity = quantity;
  const availableQuantity = playerItem.quantity || 1;
  
  if (quantity === -1) { // Sell all
    actualQuantity = availableQuantity;
  } else {
    actualQuantity = Math.min(quantity, availableQuantity);
  }
  
  if (actualQuantity <= 0) {
    showShopMessage('Nothing to sell', 'error');
    return;
  }
  
  const pricePerItem = calculateSellPrice(itemId);
  const totalValue = pricePerItem * actualQuantity;
  
  // Process the sale
  if (removeItemFromPlayer(slotIndex, actualQuantity) && addPlayerCoins(totalValue)) {
    // Show success message
    const itemName = actualQuantity === 1 ? playerItem.name : `${actualQuantity}x ${playerItem.name}`;
    showShopMessage(`Sold ${itemName} for ${totalValue.toLocaleString()} coins`, 'success');
    
    // Update interface
    updateShopInterface();
  } else {
    showShopMessage('Sale failed', 'error');
  }
}

// Calculate buy price for an item
function calculateBuyPrice(itemId) {
  const stockInfo = currentShop?.stock?.[itemId] || {};
  const basePrice = (typeof stockInfo.basePrice === 'number' && !isNaN(stockInfo.basePrice))
                    ? stockInfo.basePrice
                    : getBaseItemPrice(itemId);
  const multiplier = currentShop.buyMultiplier || 1;
  
  // Add some price fluctuation based on stock levels
  const stockRatio = (stockInfo.quantity ?? MAX_SHOP_STOCK) / MAX_SHOP_STOCK;
  const fluctuation = 1 + (PRICE_FLUCTUATION * (1 - stockRatio));
  
  const price = basePrice * multiplier * fluctuation;
  return Math.max(1, Math.floor(isFinite(price) ? price : getBaseItemPrice(itemId)));
}

// Calculate sell price for an item
function calculateSellPrice(itemId) {
  const stockInfo = currentShop?.stock?.[itemId] || {};
  const basePrice = (typeof stockInfo.basePrice === 'number' && !isNaN(stockInfo.basePrice))
                    ? stockInfo.basePrice
                    : getBaseItemPrice(itemId);
  
  if (!basePrice) return 1; // Minimum 1 coin
  
  const multiplier = currentShop.sellMultiplier || 0.5;
  const price = basePrice * multiplier;
  return Math.max(1, Math.floor(isFinite(price) ? price : 1));
}

// Check if the shop will buy a specific item
function canShopBuyItem(itemId) {
  if (!currentShop.buysItems) return false;
  
  // If shop has accepted categories, check if item matches
  if (currentShop.acceptedCategories) {
    const itemDef = getShopItemDefinition(itemId);
    return itemDef && currentShop.acceptedCategories.includes(itemDef.category);
  }
  
  // Otherwise, shop buys all items
  return true;
}

// Replenish shop stock
function replenishStock() {
  Object.values(shopDefinitions).forEach(shop => {
    Object.entries(shop.stock).forEach(([itemId, stockInfo]) => {
      if (stockInfo.restockAmount > 0 && stockInfo.quantity < MAX_SHOP_STOCK) {
        stockInfo.quantity = Math.min(
          stockInfo.quantity + stockInfo.restockAmount,
          MAX_SHOP_STOCK
        );
      }
    });
  });
  
  // Update interface if shop is open
  if (shopInterface.open) {
    updateShopInterface();
  }
}

// Get shop item definition (checks both shop items and main inventory items)
function getShopItemDefinition(itemId) {
  return shopItemDefinitions[itemId] || 
         (window.inventoryModule?.getItemDefinition && window.inventoryModule.getItemDefinition(itemId));
}

// Get base price for an item (fallback for items not in shop stock)
function getBaseItemPrice(itemId) {
  const itemDef = getShopItemDefinition(itemId);
  if (!itemDef) return 10; // Default price
  
  // Simple price calculation based on item category
  const categoryPrices = {
    food: 5,
    tools: 50,
    weapons: 100,
    armor: 80,
    potions: 30,
    runes: 10,
    magic: 100,
    ores: 20,
    bars: 40,
    misc: 10
  };
  
  return categoryPrices[itemDef.category] || 10;
}

// Helper functions that interface with other modules
function getPlayerCoins() {
  // Try to get coins from player inventory
  const inventory = getPlayerInventory();
  if (!inventory) return 0;
  
  const coinsItem = inventory.find(item => item && item.id === 'coins');
  return coinsItem ? coinsItem.quantity || 0 : 0;
}

function addPlayerCoins(amount) {
  // Use the inventory system to add coins
  return window.inventoryModule?.addItemToPlayer?.('coins', amount) || false;
}

function removePlayerCoins(amount) {
  // Find coins in inventory and remove the required amount
  const inventory = getPlayerInventory();
  if (!inventory) return false;
  
  // Find the coins slot
  for (let i = 0; i < inventory.length; i++) {
    const item = inventory[i];
    if (item && item.id === 'coins') {
      if (item.quantity >= amount) {
        // Remove the coins using the inventory system
        return window.inventoryModule?.removeItemFromPlayer?.(i, amount) || false;
      }
      break; // Coins found but not enough quantity
    }
  }
  return false;
}

function getPlayerInventory() {
  // This should get the player's inventory from the inventory module
  return window.inventoryModule?.getPlayerInventory?.() || [];
}

function getPlayerInventoryItem(slotIndex) {
  const inventory = getPlayerInventory();
  return inventory[slotIndex] || null;
}

function addItemToPlayer(itemId, quantity) {
  // This should interface with the inventory module
  return window.inventoryModule?.addItemToPlayer?.(itemId, quantity) || false;
}

function removeItemFromPlayer(slotIndex, quantity) {
  // This should interface with the inventory module
  return window.inventoryModule?.removeItemFromPlayer?.(slotIndex, quantity) || false;
}

function getFreeInventorySlots() {
  const inventory = getPlayerInventory();
  return inventory.filter(slot => !slot).length;
}

function showShopMessage(message, type = 'info') {
  if (window.uiModule?.showNotification) {
    window.uiModule.showNotification(message, type);
  } else {
    console.log(`[Shop] ${message}`);
  }
}

// Get all available shops
function getShops() {
  return Object.values(shopDefinitions);
}

// Get shop by ID
function getShop(shopId) {
  return shopDefinitions[shopId];
}

// Check if any shop is currently open
function isShopOpen() {
  return shopInterface.open;
}

// Get current shop
function getCurrentShop() {
  return currentShop;
}

// Export all functions and data
export {
  initializeShop,
  openShop,
  closeShop,
  buyItem,
  sellItem,
  getShops,
  getShop,
  isShopOpen,
  getCurrentShop,
  shopDefinitions,
  shopItemDefinitions
}; 