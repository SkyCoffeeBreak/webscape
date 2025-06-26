/**
 * Server-Synced Bank System
 * Handles all banking operations with full server synchronization
 */

// Bank configuration
const SLOTS_PER_TAB = 126;
const MAX_TABS = 9;
const TOTAL_BANK_SIZE = SLOTS_PER_TAB * MAX_TABS;

/**
 * Format large numbers for compact display
 * @param {number} num - The number to format
 * @returns {string} - Formatted string (e.g., "150k", "1000k", "10m", "1.5b")
 */
function formatCompactNumber(num) {
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
 * Get display icon for an item
 */
function getItemDisplayIcon(item) {
  if (!item) return '📦';
  
  // Try to get item definition
  const itemDef = window.inventoryModule && window.inventoryModule.getItemDefinition
    ? window.inventoryModule.getItemDefinition(item.id)
    : null;
  
  if (itemDef && itemDef.icon) {
    return itemDef.icon;
  }
  
  // Fallback icons based on item ID
  const iconMap = {
    'coins': '🪙',
    'gp': '🪙',
    'copper_ore': '🟤',
    'tin_ore': '⚪',
    'iron_ore': '🔶',
    'coal': '⚫',
    'gold_ore': '🟡',
    'mithril_ore': '🔵',
    'adamantite_ore': '🟢',
    'runite_ore': '🔴',
    'bronze_bar': '🟫',
    'iron_bar': '🔸',
    'steel_bar': '⚫',
    'gold_bar': '🟨',
    'mithril_bar': '🔷',
    'adamantite_bar': '🟩',
    'runite_bar': '🟥',
    'apple': '🍎',
    'potion': '🧪',
    'logs': '🪵',
    'oak_logs': '🪵',
    'willow_logs': '🪵',
    'axe': '🪓',
    'pickaxe': '⛏️',
    'sword': '⚔️'
  };
  
  return iconMap[item.id] || '📦';
}

// Bank state
let playerBank = new Array(TOTAL_BANK_SIZE).fill(null); // All tabs combined
let playerBankTabs = Array.from({ length: MAX_TABS }, (_, i) => ({
  id: i,
  name: i === 0 ? 'Main' : `Tab ${i + 1}`,
  icon: i === 0 ? '📦' : '📁',
  customIcon: null // Player can set custom icon
}));

let bankInterface = {
  open: false,
  noteMode: false,
  selectedSlot: -1,
  selectedItem: null,
  currentTab: 0, // Currently active tab
  leftClickWithdrawAmount: 1,  // Default left-click withdraw amount
  leftClickDepositAmount: 1    // Default left-click deposit amount
};

let bankOverlay = null;

/**
 * Open the bank interface
 */
function openBank() {
  if (bankInterface.open) return;
  
  console.log('🏦 Opening bank interface...');
  
  // Request bank data from server if online
  if (window.isUserOnline && window.isUserOnline() && window.getWebSocket) {
    const websocket = window.getWebSocket();
    if (websocket && websocket.readyState === WebSocket.OPEN) {
      console.log('📤 Requesting bank data from server');
      websocket.send(JSON.stringify({
        type: 'bank-open-request',
        timestamp: Date.now()
      }));
      return; // Wait for server response
    }
  }
  
  // Offline mode - open immediately
  displayBankInterface();
}

/**
 * Display the bank interface
 */
function displayBankInterface() {
  if (bankOverlay) {
    bankOverlay.remove();
  }
  
  bankOverlay = createBankInterface();
  document.body.appendChild(bankOverlay);
  bankInterface.open = true;
  
  console.log('🏦 Bank interface displayed');
}

/**
 * Close the bank interface
 */
function closeBank() {
  if (!bankInterface.open) return;
  
  console.log('🏦 Closing bank interface');
  
  // Hide any lingering tooltips
  hideBankTooltip();
  hideInventoryTooltip();
  
  // Hide any context menus
  hideBankContextMenus();
  
  // Remove the bank interface (use both the global variable and ID for redundancy)
  if (bankOverlay) {
    // Remove event listener if it exists
    if (bankOverlay._handleEscape) {
      document.removeEventListener('keydown', bankOverlay._handleEscape);
    }
    bankOverlay.remove();
    bankOverlay = null; // Clear the global reference
    console.log('🏦 Bank overlay removed via global reference');
  } else {
    // Fallback: look for it by ID
    const bankOverlayById = document.getElementById('bank-overlay');
    if (bankOverlayById) {
      if (bankOverlayById._handleEscape) {
        document.removeEventListener('keydown', bankOverlayById._handleEscape);
      }
      bankOverlayById.remove();
      console.log('🏦 Bank overlay removed via ID lookup');
    } else {
      console.warn('⚠️ Bank overlay not found when trying to close');
    }
  }
  
  // Update bank state
  bankInterface.open = false;
  bankInterface.container = null;
  
  // Send bank sync to server with current data if online
  if (window.isUserOnline && window.isUserOnline() && window.getWebSocket) {
    const websocket = window.getWebSocket();
    if (websocket && websocket.readyState === WebSocket.OPEN) {
      console.log('📤 Syncing bank data on close');
      websocket.send(JSON.stringify({
        type: 'bank-sync',
        bankData: playerBank
      }));
    }
  }
  
  console.log('✅ Bank interface closed');
}

/**
 * Create the bank interface HTML
 */
function createBankInterface() {
  console.log('🏦 Creating bank interface with tabs');
  
  const overlay = document.createElement('div');
  overlay.id = 'bank-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
    font-family: Arial, sans-serif;
  `;
  
  const bankWindow = document.createElement('div');
  bankWindow.id = 'bank-window';
  bankWindow.style.cssText = `
    background: #2c3e50;
    border: 2px solid #34495e;
    border-radius: 8px;
    width: 95%;
    max-width: 1020px;
    height: 85%;
    max-height: 730px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  `;
  
  // Bank header with tabs and controls
  const bankHeader = document.createElement('div');
  bankHeader.id = 'bank-header';
  bankHeader.style.cssText = `
    background: #34495e;
    padding: 10px 15px;
    border-bottom: 1px solid #2c3e50;
    display: flex;
    justify-content: space-between;
    align-items: center;
    min-height: 50px;
  `;
  
  // Tab container
  const tabContainer = document.createElement('div');
  tabContainer.id = 'bank-tabs';
  tabContainer.style.cssText = `
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  `;
  
  // Create tabs
  playerBankTabs.forEach((tab, index) => {
    const tabElement = document.createElement('div');
    tabElement.className = `bank-tab ${index === bankInterface.currentTab ? 'active' : ''}`;
    tabElement.dataset.tabIndex = index;
    tabElement.style.cssText = `
      background: ${index === bankInterface.currentTab ? '#3498db' : '#2c3e50'};
      border: 1px solid #34495e;
      border-radius: 4px;
      padding: 8px 12px;
      cursor: pointer;
      color: white;
      font-size: 14px;
      font-weight: bold;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 60px;
      justify-content: center;
      position: relative;
    `;
    
    // Tab icon (right-clickable to change)
    const tabIcon = document.createElement('span');
    tabIcon.className = 'tab-icon';
    tabIcon.textContent = tab.customIcon || tab.icon;
    tabIcon.style.cssText = `
      font-size: 16px;
      cursor: pointer;
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
      filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
    `;
    
    // Tab name (for tab 0, don't show text, just icon)
    if (index > 0) {
      const tabText = document.createElement('span');
      tabText.textContent = index.toString();
      tabText.style.fontSize = '12px';
      tabElement.appendChild(tabText);
    }
    
    tabElement.appendChild(tabIcon);
    
    // Tab click handler
    tabElement.addEventListener('click', (e) => {
      e.stopPropagation();
      switchToTab(index);
    });
    
    // Tab icon right-click handler for customization
    tabIcon.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showTabIconSelector(index);
    });
    
    // Tab drag and drop functionality for cross-tab item movement
    tabElement.addEventListener('dragover', (e) => {
      e.preventDefault();
      // Highlight tab when item is dragged over it
      if (e.dataTransfer.types.includes('text/plain')) {
        tabElement.style.background = '#e74c3c';
        tabElement.style.transform = 'scale(1.05)';
      }
    });
    
    tabElement.addEventListener('dragleave', (e) => {
      // Reset tab appearance when drag leaves
      if (index === bankInterface.currentTab) {
        tabElement.style.background = '#3498db';
      } else {
        tabElement.style.background = '#2c3e50';
      }
      tabElement.style.transform = 'scale(1)';
    });
    
    tabElement.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Reset tab appearance
      if (index === bankInterface.currentTab) {
        tabElement.style.background = '#3498db';
      } else {
        tabElement.style.background = '#2c3e50';
      }
      tabElement.style.transform = 'scale(1)';
      
      try {
        const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
        console.log(`🔄 Item dropped on tab ${index}:`, dragData);
        
        if (dragData.type === 'bank-item') {
          // Move item to this tab (find first available slot)
          moveItemToTab(dragData.fromSlot, index);
        } else if (dragData.type === 'inventory-item') {
          // Switch to this tab first, then deposit
          switchToTab(index);
          setTimeout(() => {
            depositItem(dragData.fromSlot);
          }, 100);
        }
      } catch (error) {
        console.error('Error handling tab drop:', error);
      }
    });
    
    // Tab hover effects
    tabElement.addEventListener('mouseenter', () => {
      if (index !== bankInterface.currentTab) {
        tabElement.style.background = '#34495e';
      }
    });
    
    tabElement.addEventListener('mouseleave', () => {
      if (index !== bankInterface.currentTab) {
        tabElement.style.background = '#2c3e50';
      }
    });
    
    tabContainer.appendChild(tabElement);
  });
  
  // Controls container (note mode toggle and close button)
  const controlsContainer = document.createElement('div');
  controlsContainer.style.cssText = `
    display: flex;
    align-items: center;
    gap: 10px;
  `;
  
  // Note mode toggle
  const noteToggle = document.createElement('button');
  noteToggle.id = 'note-mode-toggle';
  noteToggle.textContent = bankInterface.noteMode ? '📝 Note Mode' : '📦 Item Mode';
  noteToggle.style.cssText = `
    background: ${bankInterface.noteMode ? '#e74c3c' : '#2c3e50'};
    color: white;
    border: 1px solid #34495e;
    border-radius: 4px;
    padding: 8px 12px;
    cursor: pointer;
    font-size: 12px;
    font-weight: bold;
    transition: all 0.2s;
  `;
  
  noteToggle.addEventListener('click', () => {
    bankInterface.noteMode = !bankInterface.noteMode;
    noteToggle.textContent = bankInterface.noteMode ? '📝 Note Mode' : '📦 Item Mode';
    noteToggle.style.background = bankInterface.noteMode ? '#e74c3c' : '#2c3e50';
    console.log(`🏦 Note mode ${bankInterface.noteMode ? 'enabled' : 'disabled'}`);
  });
  
  // Close button
  const closeButton = document.createElement('button');
  closeButton.textContent = '✕';
  closeButton.style.cssText = `
    background: #e74c3c;
    color: white;
    border: none;
    border-radius: 4px;
    width: 30px;
    height: 30px;
    cursor: pointer;
    font-size: 16px;
    font-weight: bold;
  `;
  
  closeButton.addEventListener('click', closeBank);
  
  controlsContainer.appendChild(noteToggle);
  controlsContainer.appendChild(closeButton);
  
  bankHeader.appendChild(tabContainer);
  bankHeader.appendChild(controlsContainer);
  
  // Bank content area
  const bankContent = document.createElement('div');
  bankContent.id = 'bank-content';
  bankContent.style.cssText = `
    flex: 1;
    display: flex;
    flex-direction: row;
    overflow: hidden;
    gap: 15px;
    padding: 10px;
  `;
  
  // Create bank sections
  const bankSection = createBankSection();
  const inventorySection = createInventorySection();
  
  bankContent.appendChild(bankSection);
  bankContent.appendChild(inventorySection);
  
  // Append all sections to bank window
  bankWindow.appendChild(bankHeader);
  bankWindow.appendChild(bankContent);
  overlay.appendChild(bankWindow);
  
  // Add escape key handler
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      closeBank();
    }
  };
  
  document.addEventListener('keydown', handleEscape);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeBank();
    }
  });
  
  // Store reference to remove event listener later
  overlay._handleEscape = handleEscape;
  
  return overlay;
}

/**
 * Create the inventory section
 */
function createInventorySection() {
  const section = document.createElement('div');
  section.className = 'inventory-section';
  section.style.cssText = `
    flex: 0;
    padding: 6px;
    background: linear-gradient(135deg, #34495e 0%, #2c3e50 100%);
    border-radius: 8px;
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
    min-height: 530px;
    max-height: 530px;
    overflow-y: hidden;
    overflow-x: hidden;
    min-width: 200px;
  `;
  
  const header = document.createElement('h3');
  header.textContent = '🎒 Inventory';
  header.style.cssText = `
    margin: 0 0 10px 0;
    color: #ecf0f1;
    font-size: 16px;
    text-align: center;
  `;
  
  // Add Deposit All button
  const depositAllBtn = document.createElement('button');
  depositAllBtn.textContent = 'Deposit All';
  depositAllBtn.className = 'deposit-all-btn';
  depositAllBtn.style.cssText = `
    width: 100%;
    padding: 8px 12px;
    background: linear-gradient(135deg,rgb(189, 83, 72) 0%,rgb(129, 60, 52) 100%);
    color: white;
    border: none;
    border-radius: 5px;
    font-size: 13px;
    font-weight: bold;
    cursor: pointer;
    margin-bottom: 8px;
    transition: all 0.2s ease;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  `;
  
  depositAllBtn.addEventListener('click', () => {
    console.log('🏦 Deposit All button clicked');
    depositAllItems();
  });
  
  depositAllBtn.addEventListener('mouseenter', () => {
    depositAllBtn.style.background = 'linear-gradient(135deg, #c0392b 0%, #a93226 100%)';
    depositAllBtn.style.transform = 'translateY(-1px)';
    depositAllBtn.style.boxShadow = '0 3px 6px rgba(0, 0, 0, 0.3)';
  });
  
  depositAllBtn.addEventListener('mouseleave', () => {
    depositAllBtn.style.background = 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)';
    depositAllBtn.style.transform = 'translateY(0)';
    depositAllBtn.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.2)';
  });
  
  // Add Organize Bank button
  const organizeBankBtn = document.createElement('button');
  organizeBankBtn.textContent = 'Organize Bank';
  organizeBankBtn.className = 'organize-bank-btn';
  organizeBankBtn.style.cssText = `
    width: 100%;
    padding: 8px 12px;
    background: linear-gradient(135deg, #8e44ad 0%, #7d3c98 100%);
    color: white;
    border: none;
    border-radius: 5px;
    font-size: 13px;
    font-weight: bold;
    cursor: pointer;
    margin-bottom: 8px;
    transition: all 0.2s ease;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  `;
  
  organizeBankBtn.addEventListener('click', () => {
    console.log('🏦 Organize Bank button clicked');
    
    // Debug: Check if we're in the right context
    console.log('🏦 Button context check:', {
      playerBankExists: !!playerBank,
      playerBankLength: playerBank ? playerBank.length : 'N/A',
      bankInterfaceOpen: bankInterface.open,
      functionExists: typeof consolidateBankStacks
    });
    
    try {
      consolidateBankStacks();
    } catch (error) {
      console.error('🏦 Error during consolidation:', error);
      if (window.inventoryModule && window.inventoryModule.showNotification) {
        window.inventoryModule.showNotification('Error organizing bank: ' + error.message, 'error');
      }
    }
  });
  
  organizeBankBtn.addEventListener('mouseenter', () => {
    organizeBankBtn.style.background = 'linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%)';
    organizeBankBtn.style.transform = 'translateY(-1px)';
    organizeBankBtn.style.boxShadow = '0 3px 6px rgba(0, 0, 0, 0.3)';
  });
  
  organizeBankBtn.addEventListener('mouseleave', () => {
    organizeBankBtn.style.background = 'linear-gradient(135deg, #8e44ad 0%, #7d3c98 100%)';
    organizeBankBtn.style.transform = 'translateY(0)';
    organizeBankBtn.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.2)';
  });
  
  // Add deposit amount controls
  const depositAmountContainer = document.createElement('div');
  depositAmountContainer.style.cssText = `
    margin-bottom: 8px;
    text-align: center;
  `;
  
  const depositLabel = document.createElement('div');
  depositLabel.textContent = 'Deposit Amount:';
  depositLabel.style.cssText = `
    color: #ecf0f1;
    font-size: 12px;
    font-weight: bold;
    margin-bottom: 5px;
  `;
  
  const depositButtonContainer = document.createElement('div');
  depositButtonContainer.style.cssText = `
    display: flex;
    gap: 3px;
    justify-content: center;
  `;
  
  // Amount buttons for deposit
  const depositAmounts = [1, 5, 10, 14, 'X', 'All'];
  depositAmounts.forEach(amount => {
    const btn = document.createElement('button');
    btn.textContent = amount.toString();
    btn.dataset.amount = amount;
    btn.className = `deposit-amount-btn ${amount === bankInterface.leftClickDepositAmount ? 'active' : ''}`;
    btn.style.cssText = `
      background: ${amount === bankInterface.leftClickDepositAmount ? '#27ae60' : '#4a4a4a'};
      color: ${amount === bankInterface.leftClickDepositAmount ? '#fff' : '#ccc'};
      border: 1px solid ${amount === bankInterface.leftClickDepositAmount ? '#2ecc71' : '#666'};
      border-radius: 3px;
      padding: 4px 8px;
      cursor: pointer;
      font-size: 11px;
      transition: all 0.2s;
      min-width: 25px;
      text-align: center;
      ${amount === bankInterface.leftClickDepositAmount ? 'box-shadow: 0 0 3px rgba(39, 174, 96, 0.5);' : ''}
    `;
    
    btn.addEventListener('click', () => {
      // Remove active class from all deposit buttons
      depositButtonContainer.querySelectorAll('.deposit-amount-btn').forEach(b => {
        b.classList.remove('active');
        b.style.background = '#4a4a4a';
        b.style.color = '#ccc';
        b.style.borderColor = '#666';
        b.style.boxShadow = 'none';
      });
      
      // Add active class to clicked button
      btn.classList.add('active');
      btn.style.background = '#27ae60';
      btn.style.color = '#fff';
      btn.style.borderColor = '#2ecc71';
      btn.style.boxShadow = '0 0 3px rgba(39, 174, 96, 0.5)';
      
      if (amount === 'X') {
        const customAmount = prompt('Enter deposit amount (e.g., 100, 5k, 1.5m, 2b):');
        if (customAmount !== null) {
          const parsedAmount = parseNumberWithSuffix(customAmount);
          if (parsedAmount !== null && parsedAmount > 0) {
            bankInterface.leftClickDepositAmount = parsedAmount;
            if (window.inventoryModule && window.inventoryModule.showNotification) {
              window.inventoryModule.showNotification(`Left-click deposit amount set to ${formatCompactNumber(bankInterface.leftClickDepositAmount)}`);
            }
          } else {
            // Reset to previous selection if invalid
            updateActiveDepositButton();
            if (window.inventoryModule && window.inventoryModule.showNotification) {
              window.inventoryModule.showNotification('Invalid amount! Use numbers or k/m/b suffixes (e.g., 100k, 5m)', 'error');
            }
          }
        } else {
          // Reset to previous selection if cancelled
          updateActiveDepositButton();
        }
      } else if (amount === 'All') {
        bankInterface.leftClickDepositAmount = 'All';
        if (window.inventoryModule && window.inventoryModule.showNotification) {
          window.inventoryModule.showNotification('Left-click deposit amount set to All');
        }
      } else {
        bankInterface.leftClickDepositAmount = amount;
        if (window.inventoryModule && window.inventoryModule.showNotification) {
          window.inventoryModule.showNotification(`Left-click deposit amount set to ${bankInterface.leftClickDepositAmount}`);
        }
      }
    });
    
    btn.addEventListener('mouseenter', () => {
      if (!btn.classList.contains('active')) {
        btn.style.background = '#5a5a5a';
        btn.style.color = '#fff';
        btn.style.borderColor = '#777';
      }
    });
    
    btn.addEventListener('mouseleave', () => {
      if (!btn.classList.contains('active')) {
        btn.style.background = '#4a4a4a';
        btn.style.color = '#ccc';
        btn.style.borderColor = '#666';
      }
    });
    
    depositButtonContainer.appendChild(btn);
  });
  
  function updateActiveDepositButton() {
    depositButtonContainer.querySelectorAll('.deposit-amount-btn').forEach(btn => {
      const isActive = (bankInterface.leftClickDepositAmount === 'All' && btn.dataset.amount === 'All') ||
                       (typeof bankInterface.leftClickDepositAmount === 'number' && parseInt(btn.dataset.amount) === bankInterface.leftClickDepositAmount);
      
      btn.classList.toggle('active', isActive);
      btn.style.background = isActive ? '#27ae60' : '#4a4a4a';
      btn.style.color = isActive ? '#fff' : '#ccc';
      btn.style.borderColor = isActive ? '#2ecc71' : '#666';
      btn.style.boxShadow = isActive ? '0 0 3px rgba(39, 174, 96, 0.5)' : 'none';
    });
  }
  
  depositAmountContainer.appendChild(depositLabel);
  depositAmountContainer.appendChild(depositButtonContainer);
  
  const grid = document.createElement('div');
  grid.className = 'bank-inventory-grid';
  grid.style.cssText = `
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 3px;
    max-height: 450px;
    overflow-y: auto;
  `;
  
  const playerInventory = window.inventoryModule ? window.inventoryModule.getPlayerInventory() : [];
  
  for (let i = 0; i < playerInventory.length; i++) {
    const slot = document.createElement('div');
    slot.className = 'bank-inventory-slot';
    slot.dataset.slot = i;
    slot.style.cssText = `
      width: 42px;
      height: 42px;
      border: 1px solid #7f8c8d;
      background: #ecf0f1;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      position: relative;
      font-size: 16px;
      border-radius: 3px;
      transition: all 0.2s ease;
    `;
    
    const item = playerInventory[i];
    if (item && window.inventoryModule) {
      const itemDef = window.inventoryModule.getItemDefinition(item.id);
      
      if (itemDef) {
        slot.classList.add('occupied');
        const tintStyle = itemDef.colorTint ? `color: ${itemDef.colorTint};` : '';
        const tintClass = itemDef.colorTint ? 'tinted' : '';
        
        // Check if this is a noted item - use EXACT same logic as inventory
        if (window.inventoryModuleFunctions && window.inventoryModuleFunctions.isItemNoted && window.inventoryModuleFunctions.isItemNoted(item)) {
          // Display noted item with special icon - EXACT same as inventory
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
          slot.title = `${itemDef.name} (noted) (${item.quantity || 1}) - Click to deposit`;
        } else {
          // Regular item display - EXACT same as inventory
          const icon = getItemDisplayIcon(item);
          slot.textContent = icon;
          
          // Add quantity if > 1
          if (item.quantity && item.quantity > 1) {
            const quantityElement = document.createElement('span');
            quantityElement.className = 'item-quantity';
            quantityElement.textContent = formatCompactNumber(item.quantity);
            quantityElement.style.cssText = `
              position: absolute;
              bottom: 2px;
              right: 2px;
              background: rgba(0, 0, 0, 0.7);
              color: ${getQuantityColor(item.quantity)};
              font-size: 10px;
              border-radius: 2px;
              padding: 1px 3px;
              font-weight: bold;
            `;
            slot.appendChild(quantityElement);
          }
        }
      } else {
        // Fallback for unknown items
        slot.classList.add('occupied');
        slot.innerHTML = `
          <div class="inventory-item">
            📦
            ${item.quantity > 1 ? `<div class="inventory-item-count" style="color: ${getQuantityColor(item.quantity)};">${formatCompactNumber(item.quantity)}</div>` : ''}
          </div>
        `;
        slot.title = `Unknown Item${item.quantity > 1 ? ` x${item.quantity}` : ''} - Click to deposit`;
      }
      
      // Add deposit functionality
      slot.addEventListener('click', () => {
        const depositAmount = getDepositAmount(item);
        
        // If depositing more than 1 of the same item, use the multi-item deposit function
        // This handles non-stackable items across multiple slots, just like the context menu
        if (depositAmount > 1) {
          depositItemsByType(item.id, depositAmount, !!item.noted);
        } else {
          // Single item deposit uses the simple function
          depositItem(i, depositAmount);
        }
      });
      
      // Add right-click context menu for deposit options
      slot.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showBankDepositMenu(e, i);
      });
      
      // Add drag functionality for inventory items
      addInventorySlotDragFunctionality(slot, i);
      
      // Add tooltip functionality for inventory items
      addInventoryItemTooltip(slot, item);
      
      slot.addEventListener('mouseenter', () => {
        slot.style.background = '#3498db';
        slot.style.borderColor = '#2980b9';
      });
      
      slot.addEventListener('mouseleave', () => {
        slot.style.background = '#ecf0f1';
        slot.style.borderColor = '#7f8c8d';
      });
    } else {
      slot.classList.remove('occupied');
      slot.style.opacity = '0.3';
    }
    
    grid.appendChild(slot);
  }
  
  // Add styling for inventory items in bank interface
  const style = document.createElement('style');
  style.textContent = `
    .inventory-item {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }
    
    .inventory-item-count {
      position: absolute;
      bottom: 2px;
      right: 2px;
      background: rgba(0, 0, 0, 0.8);
      font-size: 10px;
      padding: 1px 3px;
      border-radius: 2px;
      font-weight: bold;
      line-height: 1;
      min-width: 12px;
      text-align: center;
      pointer-events: none;
    }
    
    .noted-item-container {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
    }
    
    .note-background {
      position: absolute;
      font-size: 1.2em;
      z-index: 1;
      filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.8));
    }
    
    .noted-icon {
      position: relative;
      z-index: 2;
      font-size: 0.7em;
      transform: translate(3px, -2px);
      filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.6));
    }
    
    .bank-inventory-slot.dragging,
    .bank-slot.dragging {
      opacity: 0.5;
      transform: scale(0.9);
      transition: all 0.2s ease;
    }
    
    .bank-slot.drag-over {
      background: #f39c12 !important;
      border-color: #e67e22 !important;
      transform: scale(1.05);
      box-shadow: 0 0 10px rgba(243, 156, 18, 0.5);
    }
    
    .bank-inventory-slot.drag-over {
      background: #f39c12 !important;
      border-color: #e67e22 !important;
      transform: scale(1.05);
      box-shadow: 0 0 10px rgba(243, 156, 18, 0.5);
    }
  `;
  document.head.appendChild(style);
  
  section.appendChild(header);
  section.appendChild(depositAllBtn);
  section.appendChild(organizeBankBtn);
  section.appendChild(depositAmountContainer);
  section.appendChild(grid);
  
  return section;
}

/**
 * Add drag functionality to inventory slots in the bank interface
 */
function addInventorySlotDragFunctionality(slot, slotIndex) {
  const playerInventory = window.inventoryModule ? window.inventoryModule.getPlayerInventory() : [];
  const item = playerInventory[slotIndex];
  
  if (item) {
  slot.draggable = true;
  
  slot.addEventListener('dragstart', (e) => {
    console.log(`🔄 Starting drag from inventory slot ${slotIndex}`);
      // Hide any existing tooltips when starting drag
      hideBankTooltip();
      
    e.dataTransfer.setData('text/plain', JSON.stringify({
      type: 'inventory-item',
      fromSlot: slotIndex,
        item: item
    }));
    slot.classList.add('dragging');
  });
  
  slot.addEventListener('dragend', (e) => {
    console.log(`🔄 Ending drag from inventory slot ${slotIndex}`);
    slot.classList.remove('dragging');
      // Hide tooltip after drag ends to ensure clean state
      hideBankTooltip();
  });
  } else {
    slot.draggable = false;
    slot.removeAttribute('draggable');
  }
}

/**
 * Create the bank section
 */
function createBankSection() {
  const bankSection = document.createElement('div');
  bankSection.id = 'bank-section';
  bankSection.style.cssText = `
    flex: 3;
    background: #34495e;
    border: 1px solid #2c3e50;
    border-radius: 6px;
    padding: 15px;
    overflow-y: auto;
    min-height: 530px;
    max-height: 530px;
  `;
  
  const sectionTitle = document.createElement('h3');
  sectionTitle.textContent = '🏦 Bank';
  sectionTitle.style.cssText = `
    margin: 0 0 15px 0;
    color: #ecf0f1;
    font-size: 16px;
    text-align: center;
  `;
  
  // Combined controls row (withdraw amounts + search)
  const controlsRow = document.createElement('div');
  controlsRow.style.cssText = `
    display: flex;
    align-items: center;
    gap: 15px;
    margin-bottom: 15px;
  `;
  
  // Add withdraw amount controls
  const withdrawAmountContainer = document.createElement('div');
  withdrawAmountContainer.style.cssText = `
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    flex-shrink: 0;
  `;
  
  const withdrawLabel = document.createElement('div');
  withdrawLabel.textContent = 'Withdraw Amount:';
  withdrawLabel.style.cssText = `
    color: #ecf0f1;
    font-size: 12px;
    font-weight: bold;
  `;
  
  const withdrawButtonContainer = document.createElement('div');
  withdrawButtonContainer.style.cssText = `
    display: flex;
    gap: 3px;
  `;
  
  // Amount buttons for withdraw
  const withdrawAmounts = [1, 5, 10, 14, 'X', 'All'];
  withdrawAmounts.forEach(amount => {
    const btn = document.createElement('button');
    btn.textContent = amount.toString();
    btn.dataset.amount = amount;
    btn.className = `withdraw-amount-btn ${amount === bankInterface.leftClickWithdrawAmount ? 'active' : ''}`;
    btn.style.cssText = `
      background: ${amount === bankInterface.leftClickWithdrawAmount ? '#3498db' : '#4a4a4a'};
      color: ${amount === bankInterface.leftClickWithdrawAmount ? '#fff' : '#ccc'};
      border: 1px solid ${amount === bankInterface.leftClickWithdrawAmount ? '#2980b9' : '#666'};
      border-radius: 3px;
      padding: 4px 8px;
      cursor: pointer;
      font-size: 11px;
      transition: all 0.2s;
      min-width: 25px;
      text-align: center;
      ${amount === bankInterface.leftClickWithdrawAmount ? 'box-shadow: 0 0 3px rgba(52, 152, 219, 0.5);' : ''}
    `;
    
    btn.addEventListener('click', () => {
      // Remove active class from all withdraw buttons
      withdrawButtonContainer.querySelectorAll('.withdraw-amount-btn').forEach(b => {
        b.classList.remove('active');
        b.style.background = '#4a4a4a';
        b.style.color = '#ccc';
        b.style.borderColor = '#666';
        b.style.boxShadow = 'none';
      });
      
      // Add active class to clicked button
      btn.classList.add('active');
      btn.style.background = '#3498db';
      btn.style.color = '#fff';
      btn.style.borderColor = '#2980b9';
      btn.style.boxShadow = '0 0 3px rgba(52, 152, 219, 0.5)';
      
      if (amount === 'X') {
        const customAmount = prompt('Enter withdraw amount (e.g., 100, 5k, 1.5m, 2b):');
        if (customAmount !== null) {
          const parsedAmount = parseNumberWithSuffix(customAmount);
          if (parsedAmount !== null && parsedAmount > 0) {
            bankInterface.leftClickWithdrawAmount = parsedAmount;
            if (window.inventoryModule && window.inventoryModule.showNotification) {
              window.inventoryModule.showNotification(`Left-click withdraw amount set to ${formatCompactNumber(bankInterface.leftClickWithdrawAmount)}`);
            }
          } else {
            // Reset to previous selection if invalid
            updateActiveWithdrawButton();
            if (window.inventoryModule && window.inventoryModule.showNotification) {
              window.inventoryModule.showNotification('Invalid amount! Use numbers or k/m/b suffixes (e.g., 100k, 5m)', 'error');
            }
          }
        } else {
          // Reset to previous selection if cancelled
          updateActiveWithdrawButton();
        }
      } else if (amount === 'All') {
        bankInterface.leftClickWithdrawAmount = 'All';
        if (window.inventoryModule && window.inventoryModule.showNotification) {
          window.inventoryModule.showNotification('Left-click withdraw amount set to All');
        }
      } else {
        bankInterface.leftClickWithdrawAmount = amount;
        if (window.inventoryModule && window.inventoryModule.showNotification) {
          window.inventoryModule.showNotification(`Left-click withdraw amount set to ${bankInterface.leftClickWithdrawAmount}`);
        }
      }
    });
    
    btn.addEventListener('mouseenter', () => {
      if (!btn.classList.contains('active')) {
        btn.style.background = '#5a5a5a';
        btn.style.color = '#fff';
        btn.style.borderColor = '#777';
      }
    });
    
    btn.addEventListener('mouseleave', () => {
      if (!btn.classList.contains('active')) {
        btn.style.background = '#4a4a4a';
        btn.style.color = '#ccc';
        btn.style.borderColor = '#666';
      }
    });
    
    withdrawButtonContainer.appendChild(btn);
  });
  
  function updateActiveWithdrawButton() {
    withdrawButtonContainer.querySelectorAll('.withdraw-amount-btn').forEach(btn => {
      const isActive = (bankInterface.leftClickWithdrawAmount === 'All' && btn.dataset.amount === 'All') ||
                       (typeof bankInterface.leftClickWithdrawAmount === 'number' && parseInt(btn.dataset.amount) === bankInterface.leftClickWithdrawAmount);
      
      btn.classList.toggle('active', isActive);
      btn.style.background = isActive ? '#3498db' : '#4a4a4a';
      btn.style.color = isActive ? '#fff' : '#ccc';
      btn.style.borderColor = isActive ? '#2980b9' : '#666';
      btn.style.boxShadow = isActive ? '0 0 3px rgba(52, 152, 219, 0.5)' : 'none';
    });
  }
  
  withdrawAmountContainer.appendChild(withdrawLabel);
  withdrawAmountContainer.appendChild(withdrawButtonContainer);
  
  // Add search bar (compact version)
  const searchContainer = document.createElement('div');
  searchContainer.style.cssText = `
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    flex: 1;
    max-width: 300px;
  `;
  
  const searchLabel = document.createElement('div');
  searchLabel.textContent = 'Search All Tabs:';
  searchLabel.style.cssText = `
    color: #ecf0f1;
    font-size: 12px;
    font-weight: bold;
  `;
  
  const searchInputContainer = document.createElement('div');
  searchInputContainer.style.cssText = `
    display: flex;
    align-items: center;
    gap: 3px;
    width: 100%;
  `;
  
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'Search items...';
  searchInput.id = 'bank-search-input';
  searchInput.style.cssText = `
    flex: 1;
    padding: 4px 8px;
    background: #2c3e50;
    border: 1px solid #34495e;
    border-radius: 3px;
    color: #ecf0f1;
    font-size: 11px;
    outline: none;
    min-width: 180px;
  `;
  
  const clearButton = document.createElement('button');
  clearButton.textContent = '✕';
  clearButton.style.cssText = `
    background: #e74c3c;
    color: white;
    border: none;
    border-radius: 3px;
    width: 20px;
    height: 20px;
    cursor: pointer;
    font-size: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  `;
  
  // Search functionality
  let searchTimeout;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      filterBankItems(e.target.value.toLowerCase());
    }, 300); // Debounce search
  });
  
  clearButton.addEventListener('click', () => {
    searchInput.value = '';
    filterBankItems('');
    searchInput.focus();
  });
  
  // Focus styles
  searchInput.addEventListener('focus', () => {
    searchInput.style.borderColor = '#3498db';
    searchInput.style.boxShadow = '0 0 3px rgba(52, 152, 219, 0.5)';
  });
  
  searchInput.addEventListener('blur', () => {
    searchInput.style.borderColor = '#34495e';
    searchInput.style.boxShadow = 'none';
  });
  
  searchInputContainer.appendChild(searchInput);
  searchInputContainer.appendChild(clearButton);
  searchContainer.appendChild(searchLabel);
  searchContainer.appendChild(searchInputContainer);
  
  // Add both containers to the controls row (search first, then withdraw)
  controlsRow.appendChild(searchContainer);
  controlsRow.appendChild(withdrawAmountContainer);
  
  bankSection.appendChild(sectionTitle);
  bankSection.appendChild(controlsRow);
  
  const bankGrid = document.createElement('div');
  bankGrid.id = 'bank-grid';
  bankGrid.style.cssText = `
    display: grid;
    grid-template-columns: repeat(14, 1fr);
    gap: 3px;
    max-height: 420px;
    overflow-y: auto;
    padding: 5px;
    background: #2c3e50;
    border-radius: 4px;
  `;
  
  // Create slots for current tab only (140 slots)
  for (let tabSlot = 0; tabSlot < SLOTS_PER_TAB; tabSlot++) {
    const globalSlot = tabSlotToGlobalSlot(tabSlot);
    const slot = document.createElement('div');
    slot.className = 'bank-slot';
    slot.dataset.tabSlot = tabSlot;
    slot.dataset.globalSlot = globalSlot;
    slot.style.cssText = `
      width: 40px;
      height: 40px;
      border: 2px solid #34495e;
      border-radius: 4px;
      background: #2c3e50;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      position: relative;
      transition: all 0.2s;
    `;
    
    const item = playerBank[globalSlot];
    if (item) {
      slot.classList.add('occupied');
      
      // Item icon
      const itemIcon = document.createElement('div');
      itemIcon.className = 'inventory-item-icon';
      itemIcon.textContent = getItemDisplayIcon(item);
      itemIcon.style.cssText = `
        font-size: 18px;
        position: relative;
        z-index: 1;
      `;
      
      // Add noted indicator if item is noted
      if (item.noted && window.inventoryModuleFunctions) {
        if (window.inventoryModuleFunctions.isItemNoted(item)) {
          const notedIndicator = document.createElement('div');
          notedIndicator.className = 'noted-indicator';
          notedIndicator.textContent = '📝';
          notedIndicator.style.cssText = `
            position: absolute;
            top: -2px;
            right: -2px;
            font-size: 10px;
            z-index: 3;
            color: #f39c12;
          `;
          slot.appendChild(notedIndicator);
        }
      }
      
      // Quantity
      if (item.quantity && item.quantity > 1) {
        const quantityLabel = document.createElement('div');
        quantityLabel.className = 'inventory-item-quantity';
        quantityLabel.textContent = formatCompactNumber(item.quantity);
        quantityLabel.style.cssText = `
          position: absolute;
          bottom: 1px;
          right: 2px;
          background: rgba(0, 0, 0, 0.7);
          color: ${getQuantityColor(item.quantity)};
          font-size: 10px;
          font-weight: bold;
          padding: 1px 3px;
          border-radius: 2px;
          line-height: 1;
          z-index: 2;
        `;
        slot.appendChild(quantityLabel);
      }
      
      slot.appendChild(itemIcon);
      slot.style.borderColor = '#3498db';
      slot.style.background = '#34495e';
      
      // Add withdraw functionality
      slot.addEventListener('click', () => {
        const withdrawAmount = getWithdrawAmount(item);
        
        // If withdrawing more than 1 of the same item, use the multi-item withdraw function
        // This handles non-stackable items across multiple slots, just like the context menu
        if (withdrawAmount > 1) {
          withdrawItemsByType(item.id, withdrawAmount, !!item.noted);
        } else {
          // Single item withdraw uses the simple function
          withdrawItem(globalSlot, withdrawAmount);
        }
      });
      
      // Add right-click context menu for withdraw options
      slot.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showBankWithdrawMenu(e, globalSlot);
      });
      
      // Add drag and drop functionality
      addBankSlotDragAndDrop(slot, globalSlot);
      
      // Add tooltip functionality for bank items
      addBankItemTooltip(slot, item);
      
      slot.addEventListener('mouseenter', () => {
        slot.style.background = '#e74c3c';
        slot.style.borderColor = '#c0392b';
      });
      
      slot.addEventListener('mouseleave', () => {
        slot.style.background = '#34495e';
        slot.style.borderColor = '#3498db';
      });
    } else {
      slot.classList.remove('occupied');
      slot.style.background = '#2c3e50';
      slot.style.borderColor = '#34495e';
      
      // Add drag and drop functionality to empty slots too
      addBankSlotDragAndDrop(slot, globalSlot);
    }
    
    bankGrid.appendChild(slot);
  }
  
  bankSection.appendChild(bankGrid);
  
  return bankSection;
}

/**
 * Add drag and drop functionality to bank slots
 */
function addBankSlotDragAndDrop(slot, slotIndex) {
  // Make items draggable
  if (playerBank[slotIndex]) {
    slot.draggable = true;
    slot.setAttribute('draggable', 'true');
    
    slot.addEventListener('dragstart', (e) => {
      console.log(`🔄 Starting drag from bank slot ${slotIndex}`);
      // Hide any existing tooltips when starting drag
      hideBankTooltip();
      
      const tabIndex = Math.floor(slotIndex / SLOTS_PER_TAB);
      const dragData = {
        type: 'bank-item',
        fromSlot: slotIndex,
        fromTab: tabIndex,
        item: playerBank[slotIndex]
      };
      
      e.dataTransfer.setData('text/plain', JSON.stringify(dragData));
      e.dataTransfer.effectAllowed = 'move';
      slot.classList.add('dragging');
      
      // Add visual feedback for dragging
      slot.style.opacity = '0.5';
      slot.style.transform = 'scale(0.9)';
      
      // Set custom drag image if supported
      if (e.dataTransfer.setDragImage) {
        const dragImage = slot.cloneNode(true);
        dragImage.style.opacity = '0.8';
        document.body.appendChild(dragImage);
        e.dataTransfer.setDragImage(dragImage, 20, 20);
        setTimeout(() => document.body.removeChild(dragImage), 0);
      }
    });
    
    slot.addEventListener('dragend', (e) => {
      console.log(`🔄 Ending drag from bank slot ${slotIndex}`);
      slot.classList.remove('dragging');
      // Reset visual feedback
      slot.style.opacity = '';
      slot.style.transform = '';
      // Hide tooltip after drag ends to ensure clean state
      hideBankTooltip();
    });
  } else {
    // Remove draggable attribute for empty slots
    slot.draggable = false;
    slot.removeAttribute('draggable');
  }
  
  // Allow items to be dropped on any slot (both empty and occupied)
  slot.addEventListener('dragover', (e) => {
    e.preventDefault(); // Allow drop
    e.dataTransfer.dropEffect = 'move';
    slot.classList.add('drag-over');
  });
  
  slot.addEventListener('dragenter', (e) => {
    e.preventDefault();
    slot.classList.add('drag-over');
  });
  
  slot.addEventListener('dragleave', (e) => {
    // Only remove highlight if we're actually leaving the slot (not entering child elements)
    if (!slot.contains(e.relatedTarget)) {
    slot.classList.remove('drag-over');
    }
  });
  
  slot.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    slot.classList.remove('drag-over');
    
    try {
      const dragDataString = e.dataTransfer.getData('text/plain');
      if (!dragDataString) {
        console.warn('❌ No drag data received');
        return;
      }
      
      const dragData = JSON.parse(dragDataString);
      console.log(`🔄 Drop event in bank slot ${slotIndex}:`, dragData);
      
      if (dragData.type === 'bank-item' && dragData.fromSlot !== slotIndex) {
        // Bank item reorganization - use proper reorganization function that handles online/offline modes
        console.log(`🔄 Bank reorganization: moving from slot ${dragData.fromSlot} to slot ${slotIndex}`);
        
        // Add immediate visual feedback
        const sourceSlot = document.querySelector(`[data-global-slot="${dragData.fromSlot}"]`);
        const targetSlot = document.querySelector(`[data-global-slot="${slotIndex}"]`);
        
        // Show immediate visual confirmation
        if (sourceSlot) {
          sourceSlot.style.background = '#27ae60';
          sourceSlot.style.borderColor = '#2ecc71';
        }
        if (targetSlot) {
          targetSlot.style.background = '#27ae60';
          targetSlot.style.borderColor = '#2ecc71';
        }
        
        // Call the reorganization function (which now handles immediate updates)
        moveItemWithinBank(dragData.fromSlot, slotIndex);
        
        // Reset visual feedback after confirming the move
        setTimeout(() => {
          if (sourceSlot) {
            sourceSlot.style.background = '';
            sourceSlot.style.borderColor = '';
          }
          if (targetSlot) {
            targetSlot.style.background = '';
            targetSlot.style.borderColor = '';
          }
        }, 800);
        
      } else if (dragData.type === 'inventory-item') {
        // Deposit item from inventory
        console.log(`🏦 Depositing item from inventory slot ${dragData.fromSlot} to bank slot ${slotIndex}`);
        depositItem(dragData.fromSlot);
      } else if (dragData.fromSlot === slotIndex) {
        console.log('🔄 Item dropped on same slot, no action needed');
      }
    } catch (error) {
      console.error('❌ Error handling bank drop:', error);
    }
  });
}

/**
 * Move an item from one bank slot to a specific slot (cross-tab support)
 */
function moveItemToSpecificSlot(fromSlot, toSlot) {
  console.log(`🔄 Moving item from slot ${fromSlot} to slot ${toSlot}`);
  
  const item = playerBank[fromSlot];
  if (!item) {
    console.warn('⚠️ No item to move from slot', fromSlot);
    return;
  }
  
  // If target slot is occupied, swap items
  if (playerBank[toSlot]) {
    swapBankItems(fromSlot, toSlot);
  } else {
    // Target slot is empty, just move the item
    playerBank[toSlot] = item;
    playerBank[fromSlot] = null;
    
    console.log(`✅ Moved ${item.id} from slot ${fromSlot} to slot ${toSlot}`);
    
    // Refresh display
    refreshBankDisplay();
    
    // Sync with server if online
    if (window.isUserOnline && window.isUserOnline() && window.getWebSocket) {
      const websocket = window.getWebSocket();
      if (websocket && websocket.readyState === WebSocket.OPEN) {
        console.log('📤 Sending bank move to server');
        websocket.send(JSON.stringify({
          type: 'bank-sync',
          bankData: playerBank
        }));
      }
    }
  }
}

/**
 * Move an item to the first available slot in a specific tab
 */
function moveItemToTab(fromSlot, targetTabIndex) {
  console.log(`🔄 Moving item from slot ${fromSlot} to tab ${targetTabIndex}`);
  
  const item = playerBank[fromSlot];
  if (!item) {
    console.warn('⚠️ No item to move from slot', fromSlot);
    return;
  }
  
  // Find first available slot in target tab
  const startSlot = targetTabIndex * SLOTS_PER_TAB;
  const endSlot = startSlot + SLOTS_PER_TAB;
  
  let targetSlot = -1;
  for (let i = startSlot; i < endSlot; i++) {
    if (!playerBank[i]) {
      targetSlot = i;
      break;
    }
  }
  
  if (targetSlot === -1) {
    console.warn(`⚠️ No available slots in tab ${targetTabIndex}`);
    // Show notification if possible
    if (window.inventoryModule && window.inventoryModule.showNotification) {
      window.inventoryModule.showNotification(`Tab ${targetTabIndex + 1} is full!`, 'warning');
    }
    return;
  }
  
  // Move the item
  playerBank[targetSlot] = item;
  playerBank[fromSlot] = null;
  
  console.log(`✅ Moved ${item.id} from slot ${fromSlot} to tab ${targetTabIndex} (slot ${targetSlot})`);
  
  // Refresh display (but keep current tab selection)
  refreshBankDisplay();
  
  // Sync with server if online
  if (window.isUserOnline && window.isUserOnline() && window.getWebSocket) {
    const websocket = window.getWebSocket();
    if (websocket && websocket.readyState === WebSocket.OPEN) {
      console.log('📤 Sending bank move to server');
      websocket.send(JSON.stringify({
        type: 'bank-sync',
        bankData: playerBank
      }));
    }
  }
}

/**
 * Swap two bank items for customization
 */
function swapBankItems(fromSlot, toSlot) {
  console.log(`🔄 Swapping bank items: slot ${fromSlot} <-> slot ${toSlot}`);
  
  // Perform local swap
  const tempItem = playerBank[fromSlot];
  playerBank[fromSlot] = playerBank[toSlot];
  playerBank[toSlot] = tempItem;
  
  // Refresh display
  refreshBankDisplay();
  
  // If online, sync with server
  if (window.isUserOnline && window.isUserOnline() && window.getWebSocket) {
    const websocket = window.getWebSocket();
    if (websocket && websocket.readyState === WebSocket.OPEN) {
      console.log('📤 Sending bank swap to server');
      websocket.send(JSON.stringify({
        type: 'bank-sync',
        bankData: playerBank
      }));
    }
  }
  
  console.log(`✅ Bank items swapped successfully`);
}

/**
 * Deposit an item from inventory to bank
 */
function depositItem(inventorySlot, quantity = 1) {
  if (!window.inventoryModule) {
    console.error('❌ Inventory module not available for deposit');
    return;
  }
  
  const playerInventory = window.inventoryModule.getPlayerInventory();
  const item = playerInventory[inventorySlot];
  
  if (!item) {
    console.log('⚠️ No item to deposit in slot', inventorySlot);
    return;
  }
  
  // Create item for deposit - remove noted attribute if present (OSRS behavior)
  const depositItem = { ...item };
  depositItem.quantity = Math.min(quantity, item.quantity || 1);
  
  // Remove noted attribute when depositing (noted items become regular items in bank)
  if (window.inventoryModuleFunctions && window.inventoryModuleFunctions.isItemNoted && window.inventoryModuleFunctions.isItemNoted(depositItem)) {
    delete depositItem.noted;
    console.log(`🏦 Removing noted attribute from deposited item (OSRS behavior)`);
  }
  
  console.log(`🏦 Depositing ${depositItem.id} x${depositItem.quantity || 1} from inventory slot ${inventorySlot}`);
  
  // If online, send deposit request to server
  if (window.isUserOnline && window.isUserOnline() && window.getWebSocket) {
    const websocket = window.getWebSocket();
    if (websocket && websocket.readyState === WebSocket.OPEN) {
      console.log('📤 Sending deposit request to server');
      websocket.send(JSON.stringify({
        type: 'bank-deposit-request',
        inventorySlot: inventorySlot,
        item: { ...depositItem },
        quantity: depositItem.quantity,
        currentTab: bankInterface.currentTab // Include current tab info
      }));
      return;
    } else {
      console.warn('⚠️ WebSocket not available for deposit request');
    }
  }
  
  // Offline mode - handle locally
  processDepositLocally(inventorySlot, depositItem);
}

/**
 * Withdraw an item from bank to inventory
 */
function withdrawItem(bankSlot, quantity = 1) {
  const item = playerBank[bankSlot];
  
  if (!item) {
    console.log('⚠️ No item to withdraw in bank slot', bankSlot);
    return;
  }
  
  // Create the item to withdraw with note mode consideration
  const withdrawnItem = { ...item };
  withdrawnItem.quantity = Math.min(quantity, item.quantity || 1);
  
  // Determine if item can be noted (needed for both client logic and server communication)
  let canBeNoted = false;
  
  if (window.inventoryModule) {
    const itemDef = window.inventoryModule.getItemDefinition(item.id);
    
    // Items can be noted if they are NOT stackable and NOT books (OSRS logic + custom rule)
    const isStackable = itemDef && itemDef.stackable;
    
    // Check if item is a book: either has category 'books' OR is an unfinished book from scribing
    const isDefinedBook = itemDef && itemDef.category === 'books';
    const isUnfinishedBook = item.id.startsWith('unfinished_') || item.id.includes('unfinished');
    const isBook = isDefinedBook || isUnfinishedBook;
    
    // Can only be noted if it has a valid definition AND is not stackable AND is not a book
    canBeNoted = itemDef && !isStackable && !isBook;
    
    console.log(`🔍 Book check for ${item.id}: isDefinedBook=${isDefinedBook}, isUnfinishedBook=${isUnfinishedBook}, canBeNoted=${canBeNoted}`);
  }

  // Apply note mode if enabled and item can be noted
  if (bankInterface.noteMode && canBeNoted) {
    // If withdrawing in note mode, make sure the item is noted
    if (!window.inventoryModuleFunctions || !window.inventoryModuleFunctions.isItemNoted || !window.inventoryModuleFunctions.isItemNoted(withdrawnItem)) {
      // Convert to noted version
      withdrawnItem.noted = true;
      console.log(`🏦 Converting item to noted version due to note mode`);
    }
  } else if (bankInterface.noteMode && !canBeNoted) {
    // Note mode is on but item cannot be noted - show warning
    if (window.inventoryModule) {
      const itemDef = window.inventoryModule.getItemDefinition(item.id);
      const isStackable = itemDef && itemDef.stackable;
      const isDefinedBook = itemDef && itemDef.category === 'books';
      const isUnfinishedBook = item.id.startsWith('unfinished_') || item.id.includes('unfinished');
      const isBook = isDefinedBook || isUnfinishedBook;
      
      if (isStackable) {
        console.log(`🏦 Item ${item.id} is stackable and cannot be noted`);
        // Show notification that stackable items can't be noted
        if (window.inventoryModule.showNotification) {
          window.inventoryModule.showNotification('Stackable items cannot be withdrawn as notes', 'warning');
        }
      } else if (isBook) {
        console.log(`🏦 Item ${item.id} is a book and cannot be noted`);
        // Show notification that books can't be noted
        if (window.inventoryModule.showNotification) {
          window.inventoryModule.showNotification('Books cannot be withdrawn as notes', 'warning');
        }
      }
    }
  } else {
    // Regular withdrawal mode - if item is noted in bank but note mode is off, unnote it
    if (window.inventoryModuleFunctions && window.inventoryModuleFunctions.isItemNoted && window.inventoryModuleFunctions.isItemNoted(withdrawnItem)) {
      delete withdrawnItem.noted;
      console.log(`🏦 Converting noted item to regular version due to regular mode`);
    }
  }
  
  console.log(`🏦 Withdrawing ${withdrawnItem.id} x${withdrawnItem.quantity || 1} from bank slot ${bankSlot}${bankInterface.noteMode ? ' (note mode)' : ''}`);
  
  // If online, send withdraw request to server
  if (window.isUserOnline && window.isUserOnline() && window.getWebSocket) {
    const websocket = window.getWebSocket();
    if (websocket && websocket.readyState === WebSocket.OPEN) {
      console.log('📤 Sending withdraw request to server');
      
      // Override note mode if item cannot be noted (for server-side consistency)
      const effectiveNoteMode = bankInterface.noteMode && canBeNoted;
      console.log(`🏦 Effective note mode for server: ${effectiveNoteMode} (requested: ${bankInterface.noteMode}, canBeNoted: ${canBeNoted})`);
      
      websocket.send(JSON.stringify({
        type: 'bank-withdraw-request',
        bankSlot: bankSlot,
        item: { ...withdrawnItem },
        quantity: withdrawnItem.quantity,
        noteMode: effectiveNoteMode
      }));
      return;
    } else {
      console.warn('⚠️ WebSocket not available for withdraw request');
    }
  }
  
  // Offline mode - handle locally
  processWithdrawLocally(bankSlot, withdrawnItem);
}

/**
 * Process deposit locally (offline mode)
 */
function processDepositLocally(inventorySlot, item) {
  if (!window.inventoryModule) return;
  
  const quantity = item.quantity || 1;
  
  // FIRST: Search for existing stacks across ALL tabs (not just current tab)
  let existingBankSlot = -1;
  for (let i = 0; i < playerBank.length; i++) {
    const bankItem = playerBank[i];
    // Only match items by ID, ignore noted attribute for stacking in bank
    if (bankItem && bankItem.id === item.id) {
      existingBankSlot = i;
      break;
    }
  }
  
  if (existingBankSlot !== -1) {
    // Add to existing stack (anywhere in bank)
    playerBank[existingBankSlot].quantity = (playerBank[existingBankSlot].quantity || 1) + quantity;
    console.log(`🏦 Added to existing bank stack: ${playerBank[existingBankSlot].quantity} (slot ${existingBankSlot}, tab ${Math.floor(existingBankSlot / SLOTS_PER_TAB)})`);
  } else {
    // No existing stack found - prioritize current tab for new items
    const { startSlot, endSlot } = getCurrentTabSlotRange();
    let emptyBankSlot = -1;
    
    // First, check current tab for empty slots
    for (let i = startSlot; i < endSlot; i++) {
      if (!playerBank[i]) {
        emptyBankSlot = i;
        break;
      }
    }
    
    // If no space in current tab, find any empty slot in other tabs
    if (emptyBankSlot === -1) {
      emptyBankSlot = playerBank.findIndex(slot => !slot);
    }
    
    if (emptyBankSlot !== -1) {
      // Create new item - only include necessary attributes
      const bankItem = { 
        id: item.id, 
        quantity: quantity
      };
      
      // Only add noted attribute if the item is actually noted
      if (item.noted === true) {
        bankItem.noted = true;
      }
      // Don't store noted: false - just omit the attribute entirely
      
      playerBank[emptyBankSlot] = bankItem;
      console.log(`🏦 Deposited to new bank slot ${emptyBankSlot} (tab ${Math.floor(emptyBankSlot / SLOTS_PER_TAB)})`);
    } else {
      console.warn('⚠️ Bank is full!');
      if (window.inventoryModule.showNotification) {
        window.inventoryModule.showNotification('Bank is full!', 'error');
      }
      return;
    }
  }
  
  // Remove from inventory (handle partial quantities)
  const playerInventory = window.inventoryModule.getPlayerInventory();
  const inventoryItem = playerInventory[inventorySlot];
  
  if ((inventoryItem.quantity || 1) <= quantity) {
    window.inventoryModule.removeItemFromInventorySlot(inventorySlot);
  } else {
    inventoryItem.quantity -= quantity;
    window.inventoryModule.updateInventoryDisplay();
  }
  
  // Refresh displays
  refreshBankDisplay();
  refreshInventorySection();
  
  // Show success message
  const itemDef = window.inventoryModule.getItemDefinition(item.id);
  const itemName = itemDef ? itemDef.name : item.id;
  if (window.inventoryModule.showNotification) {
    window.inventoryModule.showNotification(`Deposited ${itemName} x${formatCompactNumber(quantity)}`, 'success');
  }
}

/**
 * Process withdraw locally (offline mode)
 */
function processWithdrawLocally(bankSlot, item) {
  if (!window.inventoryModule) return;
  
  const quantity = item.quantity || 1;
  const itemDef = window.inventoryModule.getItemDefinition(item.id);
  
  // Try to add item to inventory using the inventory module's function
  let success = false;
  
  // Use addItemToInventoryFromServer for ALL items to ensure consistent stacking
  // This function has better logic for handling both noted and regular items
  if (item.noted) {
    // For noted items, preserve noted status
    success = window.inventoryModuleFunctions?.addItemToInventoryFromServer({
      id: item.id,
      quantity: quantity,
      noted: true
    });
  } else {
    // For regular items, create a proper item object
    success = window.inventoryModuleFunctions?.addItemToInventoryFromServer({
      id: item.id,
      quantity: quantity
    });
  }
  
  console.log(`🏦 [DETAILED] processWithdrawLocally called:`, {
    bankSlot,
    itemId: item.id,
    quantity,
    noted: !!item.noted,
    isStackable: itemDef?.stackable,
    itemDef: itemDef
  });
  
  // Log current inventory state before withdrawal
  const playerInventory = window.inventoryModule.getPlayerInventory();
  const existingStacks = playerInventory.filter(invItem => invItem && invItem.id === item.id);
  console.log(`🏦 [DETAILED] Existing stacks of ${item.id} in inventory:`, existingStacks);
  
  console.log(`🏦 [DETAILED] Withdrawal result:`, {
    success,
    itemId: item.id,
    quantity,
    noted: !!item.noted,
    functionUsed: item.noted ? 'addItemToInventoryFromServer (noted)' : 'addItemToInventoryFromServer (regular)'
  });
  
  // Log inventory state after withdrawal attempt
  const postInventory = window.inventoryModule.getPlayerInventory();
  const postStacks = postInventory.filter(invItem => invItem && invItem.id === item.id);
  console.log(`🏦 [DETAILED] Inventory stacks after withdrawal:`, postStacks);
  
  if (!success) {
    if (window.inventoryModule.showNotification) {
      window.inventoryModule.showNotification('Your inventory is full!', 'error');
    }
    return;
  }
  
  // Remove from bank
  const bankItem = playerBank[bankSlot];
  if (!bankItem) return; // Safety check
  
  if (bankItem.quantity <= quantity) {
    // Remove entire stack if withdrawing all or more
    playerBank[bankSlot] = null;
  } else {
    // Reduce quantity if withdrawing less than total
    bankItem.quantity -= quantity;
  }
  
  // Consolidate bank stacks after withdrawal to clean up any fragmentation
  setTimeout(() => {
    consolidateBankStacks();
  }, 100); // Small delay to allow other concurrent operations to complete
  
  // Refresh displays
  refreshBankDisplay();
  refreshInventorySection();
  
  // Show success message
  const itemName = itemDef ? itemDef.name : item.id;
  if (window.inventoryModule.showNotification) {
    window.inventoryModule.showNotification(`Withdrawn ${itemName} x${quantity}`, 'success');
  }
}

/**
 * Refresh bank display to show current data
 */
function refreshBankDisplay() {
  if (!bankInterface.open) return;
  
  console.log(`🏦 Refreshing bank display for tab ${bankInterface.currentTab}`);
  
  const bankGrid = document.getElementById('bank-grid');
  if (!bankGrid) return;
  
  // Clear and recreate bank grid for current tab
  bankGrid.innerHTML = '';
  
  const { startSlot, endSlot } = getCurrentTabSlotRange();
  
  for (let tabSlot = 0; tabSlot < SLOTS_PER_TAB; tabSlot++) {
    const globalSlot = tabSlotToGlobalSlot(tabSlot);
    const slot = document.createElement('div');
    slot.className = 'bank-slot';
    slot.dataset.tabSlot = tabSlot;
    slot.dataset.globalSlot = globalSlot;
    slot.style.cssText = `
      width: 40px;
      height: 40px;
      border: 2px solid #34495e;
      border-radius: 4px;
      background: #2c3e50;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      position: relative;
      transition: all 0.2s;
    `;
    
    const item = playerBank[globalSlot];
    if (item) {
      slot.classList.add('occupied');
      
      // Item icon
      const itemIcon = document.createElement('div');
      itemIcon.className = 'inventory-item-icon';
      itemIcon.textContent = getItemDisplayIcon(item);
      itemIcon.style.cssText = `
        font-size: 18px;
        position: relative;
        z-index: 1;
      `;
      
      // Add noted indicator if item is noted
      if (item.noted && window.inventoryModuleFunctions) {
        if (window.inventoryModuleFunctions.isItemNoted(item)) {
          const notedIndicator = document.createElement('div');
          notedIndicator.className = 'noted-indicator';
          notedIndicator.textContent = '📝';
          notedIndicator.style.cssText = `
            position: absolute;
            top: -2px;
            right: -2px;
            font-size: 10px;
            z-index: 3;
            color: #f39c12;
          `;
          slot.appendChild(notedIndicator);
        }
      }
      
      // Quantity
      if (item.quantity && item.quantity > 1) {
        const quantityLabel = document.createElement('div');
        quantityLabel.className = 'inventory-item-quantity';
        quantityLabel.textContent = formatCompactNumber(item.quantity);
        quantityLabel.style.cssText = `
          position: absolute;
          bottom: 1px;
          right: 2px;
          background: rgba(0, 0, 0, 0.7);
          color: ${getQuantityColor(item.quantity)};
          font-size: 10px;
          font-weight: bold;
          padding: 1px 3px;
          border-radius: 2px;
          line-height: 1;
          z-index: 2;
        `;
        slot.appendChild(quantityLabel);
      }
      
      slot.appendChild(itemIcon);
      slot.style.borderColor = '#3498db';
      slot.style.background = '#34495e';
      
      // Add withdraw functionality
      slot.addEventListener('click', () => {
        const withdrawAmount = getWithdrawAmount(item);
        
        const itemDef = window.inventoryModule ? window.inventoryModule.getItemDefinition(item.id) : null;
        const isStackable = itemDef && itemDef.stackable;
        
        // For stackable items, always use withdrawItemsByType to ensure proper stacking
        // For non-stackable items, use withdrawItemsByType if withdrawing more than 1
        if (isStackable || item.noted || withdrawAmount > 1) {
          withdrawItemsByType(item.id, withdrawAmount, !!item.noted);
        } else {
          // Single non-stackable item withdraw uses the simple function
          withdrawItem(globalSlot, withdrawAmount);
        }
      });
      
      // Add right-click context menu for withdraw options
      slot.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showBankWithdrawMenu(e, globalSlot);
      });
      
      // Add drag and drop functionality
      addBankSlotDragAndDrop(slot, globalSlot);
      
      // Add tooltip functionality for bank items
      addBankItemTooltip(slot, item);
      
      slot.addEventListener('mouseenter', () => {
        slot.style.background = '#e74c3c';
        slot.style.borderColor = '#c0392b';
      });
      
      slot.addEventListener('mouseleave', () => {
        slot.style.background = '#34495e';
        slot.style.borderColor = '#3498db';
      });
    } else {
      slot.classList.remove('occupied');
      slot.style.background = '#2c3e50';
      slot.style.borderColor = '#34495e';
      
      // Add drag and drop functionality to empty slots too
      addBankSlotDragAndDrop(slot, globalSlot);
    }
    
    bankGrid.appendChild(slot);
  }
  
  console.log(`🏦 Bank display refreshed - showing ${SLOTS_PER_TAB} slots for tab ${bankInterface.currentTab}`);
}

/**
 * Sync bank data from server
 */
function syncBankFromServer(serverBankData, serverTabData = null) {
  if (!Array.isArray(serverBankData)) {
    console.warn('⚠️ Invalid server bank data received');
    return;
  }
  
  console.log(`🏦 Syncing bank data from server: ${serverBankData.filter(item => item).length} items`);
  
  // Update bank data
  playerBank = [...serverBankData];
  
  // Ensure bank has enough slots
  while (playerBank.length < TOTAL_BANK_SIZE) {
    playerBank.push(null);
  }
  
  // Update tab data if provided
  if (serverTabData && Array.isArray(serverTabData)) {
    console.log('🏦 Syncing tab data from server');
    serverTabData.forEach((tabData, index) => {
      if (index < MAX_TABS && playerBankTabs[index]) {
        if (tabData.customIcon) {
          playerBankTabs[index].customIcon = tabData.customIcon;
        }
        if (tabData.name) {
          playerBankTabs[index].name = tabData.name;
        }
      }
    });
  }
  
  // Refresh display if bank is open
  if (bankInterface.open) {
    refreshBankDisplay();
    
    // Update tab icons in UI
    playerBankTabs.forEach((tab, index) => {
      const tabElement = document.querySelector(`[data-tab-index="${index}"]`);
      if (tabElement) {
        const iconElement = tabElement.querySelector('.tab-icon');
        if (iconElement) {
          iconElement.textContent = tab.customIcon || tab.icon;
        }
      }
    });
  }
  
  console.log('✅ Bank sync completed');
}

/**
 * Get current bank data
 */
function getBankData() {
  return playerBank;
}

/**
 * Check if bank is open
 */
function isBankOpen() {
  return bankInterface.open;
}

/**
 * Handle server responses for bank operations
 */
function handleBankMessage(data) {
  switch (data.type) {
    case 'bank-open-confirmed':
      handleBankOpenConfirmed(data);
      break;
    case 'bank-open-denied':
      handleBankOpenDenied(data);
      break;
    case 'bank-deposit-confirmed':
      handleBankDepositConfirmed(data);
      break;
    case 'bank-deposit-denied':
      handleBankDepositDenied(data);
      break;
    case 'bank-withdraw-confirmed':
      handleBankWithdrawConfirmed(data);
      break;
    case 'bank-withdraw-denied':
      handleBankWithdrawDenied(data);
      break;
    case 'bank-tab-icon-updated':
      console.log('✅ Bank tab icon updated successfully');
      break;
    case 'bank-reorganize-confirmed':
      handleBankReorganizeConfirmed(data);
      break;
    case 'bank-reorganize-denied':
      handleBankReorganizeDenied(data);
      break;
    default:
      console.warn('🏦 Unknown bank message type:', data.type);
  }
}

/**
 * Handle bank open confirmation from server
 */
function handleBankOpenConfirmed(data) {
  console.log('🏦 Bank open confirmed by server');
  
  if (data.bankData) {
    syncBankFromServer(data.bankData, data.tabData);
  }
  
  displayBankInterface();
  
  console.log(`✅ Bank opened with ${data.bankData ? data.bankData.filter(item => item).length : 0} items`);
}

/**
 * Handle bank open denied from server
 */
function handleBankOpenDenied(data) {
  console.warn('⚠️ Bank open denied by server:', data.reason);
  
  if (window.inventoryModule && window.inventoryModule.showNotification) {
    window.inventoryModule.showNotification(`Cannot open bank: ${data.reason}`, 'error');
  }
}

/**
 * Handle deposit confirmed from server
 */
function handleBankDepositConfirmed(data) {
  console.log('✅ Deposit confirmed by server');
  
  // Update local bank data
  syncBankFromServer(data.updatedBank);
  
  // Update inventory module if available
  if (window.inventoryModule && window.inventoryModule.syncInventoryFromServer) {
    window.inventoryModule.syncInventoryFromServer(data.updatedInventory);
  }
  
  // Refresh displays
  if (bankInterface.open) {
    refreshBankDisplay();
    refreshInventorySection();
  }
  
  // Show success notification
  const itemDef = window.inventoryModule ? window.inventoryModule.getItemDefinition(data.item.id) : null;
  const itemName = itemDef ? itemDef.name : data.item.id;
  if (window.inventoryModule && window.inventoryModule.showNotification) {
    window.inventoryModule.showNotification(`Deposited ${itemName} x${formatCompactNumber(data.item.quantity)}`, 'success');
  }
}

/**
 * Handle deposit denied from server
 */
function handleBankDepositDenied(data) {
  console.warn('⚠️ Deposit denied by server:', data.reason);
  
  if (window.inventoryModule && window.inventoryModule.showNotification) {
    window.inventoryModule.showNotification(`Cannot deposit: ${data.reason}`, 'error');
  }
}

/**
 * Handle withdraw confirmed from server
 */
function handleBankWithdrawConfirmed(data) {
  console.log('✅ Withdraw confirmed by server');
  
  // Update local bank data
  syncBankFromServer(data.updatedBank);
  
  // Update inventory module if available
  if (window.inventoryModule && window.inventoryModule.syncInventoryFromServer) {
    window.inventoryModule.syncInventoryFromServer(data.updatedInventory);
  }
  
  // Refresh displays
  if (bankInterface.open) {
    refreshBankDisplay();
    refreshInventorySection();
  }
  
  // Show success notification
  const itemDef = window.inventoryModule ? window.inventoryModule.getItemDefinition(data.item.id) : null;
  const itemName = itemDef ? itemDef.name : data.item.id;
  if (window.inventoryModule && window.inventoryModule.showNotification) {
    window.inventoryModule.showNotification(`Withdrew ${itemName} x${formatCompactNumber(data.item.quantity)}`, 'success');
  }
}

/**
 * Handle withdraw denied from server
 */
function handleBankWithdrawDenied(data) {
  console.warn('⚠️ Withdraw denied by server:', data.reason);
  
  if (window.inventoryModule && window.inventoryModule.showNotification) {
    window.inventoryModule.showNotification(`Cannot withdraw: ${data.reason}`, 'error');
  }
}

/**
 * Show bank withdraw context menu
 */
function showBankWithdrawMenu(event, bankSlot) {
  const item = playerBank[bankSlot];
  if (!item) return;
  
  // Hide any existing context menus
  hideBankContextMenus();
  
  const itemDef = window.inventoryModule ? window.inventoryModule.getItemDefinition(item.id) : null;
  const itemName = itemDef ? itemDef.name : item.id;
  const singleSlotQuantity = item.quantity || 1;
  
  // Count total items of the same type across all bank slots
  let totalAvailable = 0;
  const sameTypeSlots = [];
  
  for (let i = 0; i < playerBank.length; i++) {
    const bankItem = playerBank[i];
    if (bankItem && bankItem.id === item.id) {
      // For noted items, also check noted status matches
      const sameNotedStatus = (!!bankItem.noted) === (!!item.noted);
      if (sameNotedStatus) {
        const itemQty = bankItem.quantity || 1;
        totalAvailable += itemQty;
        sameTypeSlots.push({ slot: i, quantity: itemQty });
      }
    }
  }
  
  console.log(`🏦 Found ${totalAvailable} total ${itemName} available for withdraw (across ${sameTypeSlots.length} slots)`);
  
  const menu = document.createElement('div');
  menu.className = 'bank-context-menu';
  menu.style.cssText = `
    position: fixed;
    background: #2c3e50;
    border: 1px solid #34495e;
    border-radius: 4px;
    padding: 4px 0;
    z-index: 2000;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    font-family: Arial, sans-serif;
    font-size: 12px;
    min-width: 140px;
  `;
  
  // Create enhanced options based on total available
  const options = [
    { text: 'Withdraw 1', action: () => withdrawItemsByType(item.id, 1, !!item.noted) },
    ...(totalAvailable >= 5 ? [{ text: 'Withdraw 5', action: () => withdrawItemsByType(item.id, 5, !!item.noted) }] : []),
    ...(totalAvailable >= 10 ? [{ text: 'Withdraw 10', action: () => withdrawItemsByType(item.id, 10, !!item.noted) }] : []),
    ...(totalAvailable >= 50 ? [{ text: 'Withdraw 50', action: () => withdrawItemsByType(item.id, 50, !!item.noted) }] : []),
    ...(totalAvailable > 1 ? [{ text: `Withdraw All (${formatCompactNumber(totalAvailable)})`, action: () => withdrawItemsByType(item.id, totalAvailable, !!item.noted) }] : []),
    { text: 'Withdraw X', action: () => promptWithdrawAmountByType(item.id, totalAvailable, !!item.noted) },
    ...(totalAvailable > 1 ? [{ text: `Withdraw All but 1 (${formatCompactNumber(totalAvailable - 1)})`, action: () => withdrawItemsByType(item.id, totalAvailable - 1, !!item.noted) }] : []),
    // Only include "Withdraw This Stack" if it's different from total available and > 1
    ...(singleSlotQuantity > 1 && singleSlotQuantity !== totalAvailable ? [{ text: `Withdraw This Stack (${formatCompactNumber(singleSlotQuantity)})`, action: () => withdrawItem(bankSlot, singleSlotQuantity) }] : [])
  ];
  
  options.forEach((option, index) => {
    const menuItem = document.createElement('div');
    menuItem.className = 'bank-context-menu-item';
    menuItem.textContent = option.text;
    menuItem.style.cssText = `
      padding: 6px 12px;
      cursor: pointer;
      color: #ecf0f1;
      transition: background-color 0.2s;
    `;
    
    menuItem.addEventListener('mouseenter', () => {
      menuItem.style.backgroundColor = '#3498db';
    });
    
    menuItem.addEventListener('mouseleave', () => {
      menuItem.style.backgroundColor = 'transparent';
    });
    
    menuItem.addEventListener('click', () => {
      hideBankContextMenus();
      option.action();
    });
    
    menu.appendChild(menuItem);
  });
  
  // Position menu near mouse
  const x = Math.min(event.clientX, window.innerWidth - 180);
  const y = Math.min(event.clientY, window.innerHeight - (options.length * 30));
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  
  document.body.appendChild(menu);
  
  // Store reference for cleanup
  menu.id = 'bank-withdraw-menu';
  
  // Hide menu when clicking elsewhere
  setTimeout(() => {
    document.addEventListener('click', hideBankContextMenus, { once: true });
  }, 10);
}

/**
 * Show bank deposit context menu
 */
function showBankDepositMenu(event, inventorySlot) {
  if (!window.inventoryModule) return;
  
  const playerInventory = window.inventoryModule.getPlayerInventory();
  const item = playerInventory[inventorySlot];
  if (!item) return;
  
  // Hide any existing context menus
  hideBankContextMenus();
  
  const itemDef = window.inventoryModule.getItemDefinition(item.id);
  const itemName = itemDef ? itemDef.name : item.id;
  const singleSlotQuantity = item.quantity || 1;
  
  // Count total items of the same type across all inventory slots
  let totalAvailable = 0;
  const sameTypeSlots = [];
  
  for (let i = 0; i < playerInventory.length; i++) {
    const invItem = playerInventory[i];
    if (invItem && invItem.id === item.id) {
      // For noted items, also check noted status matches
      const sameNotedStatus = (!!invItem.noted) === (!!item.noted);
      if (sameNotedStatus) {
        const itemQty = invItem.quantity || 1;
        totalAvailable += itemQty;
        sameTypeSlots.push({ slot: i, quantity: itemQty });
      }
    }
  }
  
  console.log(`🏦 Found ${totalAvailable} total ${itemName} available for deposit (across ${sameTypeSlots.length} slots)`);
  
  const menu = document.createElement('div');
  menu.className = 'bank-context-menu';
  menu.style.cssText = `
    position: fixed;
    background: #2c3e50;
    border: 1px solid #34495e;
    border-radius: 4px;
    padding: 4px 0;
    z-index: 2000;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    font-family: Arial, sans-serif;
    font-size: 12px;
    min-width: 140px;
  `;
  
  // Create enhanced options based on total available
  const options = [
    { text: 'Deposit 1', action: () => depositItemsByType(item.id, 1, !!item.noted) },
    ...(totalAvailable >= 5 ? [{ text: 'Deposit 5', action: () => depositItemsByType(item.id, 5, !!item.noted) }] : []),
    ...(totalAvailable >= 10 ? [{ text: 'Deposit 10', action: () => depositItemsByType(item.id, 10, !!item.noted) }] : []),
    ...(totalAvailable >= 50 ? [{ text: 'Deposit 50', action: () => depositItemsByType(item.id, 50, !!item.noted) }] : []),
    ...(totalAvailable > 1 ? [{ text: `Deposit All (${formatCompactNumber(totalAvailable)})`, action: () => depositItemsByType(item.id, totalAvailable, !!item.noted) }] : []),
    { text: 'Deposit X', action: () => promptDepositAmountByType(item.id, totalAvailable, !!item.noted) },
    // Only include "Deposit This Stack" if it's different from total available and > 1
    ...(singleSlotQuantity > 1 && singleSlotQuantity !== totalAvailable ? [{ text: `Deposit This Stack (${formatCompactNumber(singleSlotQuantity)})`, action: () => depositItemsByType(item.id, singleSlotQuantity, !!item.noted) }] : [])
  ];
  
  options.forEach((option, index) => {
    const menuItem = document.createElement('div');
    menuItem.className = 'bank-context-menu-item';
    menuItem.textContent = option.text;
    menuItem.style.cssText = `
      padding: 6px 12px;
      cursor: pointer;
      color: #ecf0f1;
      transition: background-color 0.2s;
    `;
    
    menuItem.addEventListener('mouseenter', () => {
      menuItem.style.backgroundColor = '#3498db';
    });
    
    menuItem.addEventListener('mouseleave', () => {
      menuItem.style.backgroundColor = 'transparent';
    });
    
    menuItem.addEventListener('click', () => {
      hideBankContextMenus();
      option.action();
    });
    
    menu.appendChild(menuItem);
  });
  
  // Position menu near mouse
  const x = Math.min(event.clientX, window.innerWidth - 180);
  const y = Math.min(event.clientY, window.innerHeight - (options.length * 30));
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  
  document.body.appendChild(menu);
  
  // Store reference for cleanup
  menu.id = 'bank-deposit-menu';
  
  // Hide menu when clicking elsewhere
  setTimeout(() => {
    document.addEventListener('click', hideBankContextMenus, { once: true });
  }, 10);
}

/**
 * Prompt for custom withdraw amount
 */
function promptWithdrawAmount(bankSlot, maxAmount) {
  const amount = prompt(`How many would you like to withdraw? (Max: ${formatCompactNumber(maxAmount)})`);
  if (amount !== null) {
    const quantity = parseInt(amount);
    if (!isNaN(quantity) && quantity > 0 && quantity <= maxAmount) {
      withdrawItem(bankSlot, quantity);
    } else {
      if (window.inventoryModule && window.inventoryModule.showNotification) {
        window.inventoryModule.showNotification('Invalid amount entered', 'error');
      }
    }
  }
}

/**
 * Prompt for custom deposit amount
 */
function promptDepositAmount(inventorySlot, maxAmount) {
  const amount = prompt(`How many would you like to deposit? (Max: ${formatCompactNumber(maxAmount)})`);
  if (amount !== null) {
    const quantity = parseInt(amount);
    if (!isNaN(quantity) && quantity > 0 && quantity <= maxAmount) {
      // Get the item to deposit to use the atomic depositItemsByType function
      const playerInventory = window.inventoryModule ? window.inventoryModule.getPlayerInventory() : null;
      const item = playerInventory ? playerInventory[inventorySlot] : null;
      
      if (item) {
        depositItemsByType(item.id, quantity, !!item.noted);
      } else {
        // Fallback to old method if we can't get item info
        depositItem(inventorySlot, quantity);
      }
    } else {
      if (window.inventoryModule && window.inventoryModule.showNotification) {
        window.inventoryModule.showNotification('Invalid amount entered', 'error');
      }
    }
  }
}

/**
 * Hide all bank context menus
 */
function hideBankContextMenus() {
  const withdrawMenu = document.getElementById('bank-withdraw-menu');
  const depositMenu = document.getElementById('bank-deposit-menu');
  
  if (withdrawMenu) withdrawMenu.remove();
  if (depositMenu) depositMenu.remove();
}

/**
 * Switch to a specific bank tab
 */
function switchToTab(tabIndex) {
  if (tabIndex < 0 || tabIndex >= MAX_TABS || tabIndex === bankInterface.currentTab) return;
  
  console.log(`🏦 Switching to tab ${tabIndex}`);
  bankInterface.currentTab = tabIndex;
  
  // Update tab visual states
  const tabs = document.querySelectorAll('.bank-tab');
  tabs.forEach((tab, index) => {
    if (index === tabIndex) {
      tab.classList.add('active');
      tab.style.background = '#3498db';
    } else {
      tab.classList.remove('active');
      tab.style.background = '#2c3e50';
    }
  });
  
  // Refresh bank display to show current tab
  refreshBankDisplay();
}

/**
 * Show icon selector for customizing tab icons
 */
function showTabIconSelector(tabIndex) {
  console.log(`🏦 Opening icon selector for tab ${tabIndex}`);
  
  // Available icons for tabs
  const availableIcons = [
    // ⚔️ Combat & Magic
    '⚔️', '🪄', '🏹', '💣', '🛡️', '❤️', '✨', '🔮', '☠️', '⚖️',
  
    // 🪓 Gathering
    '⛏️', '🪨', '🌲', '🪓', '🎣', '🐟', '🐄', '🍄', '🌺',
  
    // 🔨 Production / Artisan
    '🔨', '🪵', '🪶', '🦴', '🪡', '💍', '🧱', '🍖', '🍰', '🍬', '🍺', '🏺', '📜', '🧵','📚',
  
    // 🧪 Crafting / Alchemy
    '🧪', '🌿', '🕯️', '🐣', '🎨', '🖼️', '💎', '🍎',
  
    // 🪙 Economy / Utility
    '💰', '🪙', '✉️', '🗝️', '👑', '🎯', '⭐', '📦', '🎭️', '🎲', '🎁',
  
    // 🏰 World / Lore
    '🏰', '🏺', '🗡️', '🔥', '💧', '🌪️', '⚡',

    //Hearts
    '🗿', '🩷', '🧡', '💛', '💚', '💙', '🩵', '💜', '🤎', '🖤', '🩶', '🤍'
  ];
  
  // Create icon selector overlay
  const selectorOverlay = document.createElement('div');
  selectorOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.9);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 2000;
  `;
  
  const selectorWindow = document.createElement('div');
  selectorWindow.style.cssText = `
    background: #2c3e50;
    border: 2px solid #34495e;
    border-radius: 8px;
    padding: 20px;
    max-width: 400px;
    color: white;
    text-align: center;
  `;
  
  const title = document.createElement('h3');
  title.textContent = `Choose Icon for Tab ${tabIndex + 1}`;
  title.style.cssText = `
    margin: 0 0 15px 0;
    color: #ecf0f1;
  `;
  
  const iconGrid = document.createElement('div');
  iconGrid.style.cssText = `
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: 8px;
    margin-bottom: 15px;
  `;
  
  availableIcons.forEach(icon => {
    const iconButton = document.createElement('button');
    iconButton.textContent = icon;
    iconButton.style.cssText = `
      background: #34495e;
      border: 1px solid #2c3e50;
      border-radius: 4px;
      width: 40px;
      height: 40px;
      cursor: pointer;
      font-size: 20px;
      transition: all 0.2s;
    `;
    
    iconButton.addEventListener('mouseenter', () => {
      iconButton.style.background = '#3498db';
    });
    
    iconButton.addEventListener('mouseleave', () => {
      iconButton.style.background = '#34495e';
    });
    
    iconButton.addEventListener('click', () => {
      setTabIcon(tabIndex, icon);
      selectorOverlay.remove();
    });
    
    iconGrid.appendChild(iconButton);
  });
  
  const cancelButton = document.createElement('button');
  cancelButton.textContent = 'Cancel';
  cancelButton.style.cssText = `
    background: #e74c3c;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 8px 16px;
    cursor: pointer;
    font-size: 14px;
  `;
  
  cancelButton.addEventListener('click', () => {
    selectorOverlay.remove();
  });
  
  selectorWindow.appendChild(title);
  selectorWindow.appendChild(iconGrid);
  selectorWindow.appendChild(cancelButton);
  selectorOverlay.appendChild(selectorWindow);
  
  // Close on overlay click
  selectorOverlay.addEventListener('click', (e) => {
    if (e.target === selectorOverlay) {
      selectorOverlay.remove();
    }
  });
  
  document.body.appendChild(selectorOverlay);
}

/**
 * Set custom icon for a tab
 */
function setTabIcon(tabIndex, icon) {
  if (tabIndex < 0 || tabIndex >= MAX_TABS) return;
  
  console.log(`🏦 Setting tab ${tabIndex} icon to ${icon}`);
  playerBankTabs[tabIndex].customIcon = icon;
  
  // Update the visual tab icon
  const tabElement = document.querySelector(`[data-tab-index="${tabIndex}"]`);
  if (tabElement) {
    const iconElement = tabElement.querySelector('.tab-icon');
    if (iconElement) {
      iconElement.textContent = icon;
    }
  }
  
  // Sync with server if online
  if (window.isUserOnline && window.isUserOnline() && window.getWebSocket) {
    const websocket = window.getWebSocket();
    if (websocket && websocket.readyState === WebSocket.OPEN) {
      websocket.send(JSON.stringify({
        type: 'bank-tab-icon-update',
        tabIndex: tabIndex,
        icon: icon,
        timestamp: Date.now()
      }));
    }
  }
}

/**
 * Get current tab's slot range
 */
function getCurrentTabSlotRange() {
  const startSlot = bankInterface.currentTab * SLOTS_PER_TAB;
  const endSlot = startSlot + SLOTS_PER_TAB;
  return { startSlot, endSlot };
}

/**
 * Convert global bank slot to tab-relative slot
 */
function globalSlotToTabSlot(globalSlot) {
  return globalSlot % SLOTS_PER_TAB;
}

/**
 * Convert tab-relative slot to global bank slot
 */
function tabSlotToGlobalSlot(tabSlot, tabIndex = bankInterface.currentTab) {
  return (tabIndex * SLOTS_PER_TAB) + tabSlot;
}

/**
 * Refresh the inventory section in the bank interface
 */
function refreshInventorySection() {
  if (!bankInterface.open) return;
  
  console.log('🎒 Refreshing inventory section in bank');
  
  const inventoryGrid = document.querySelector('.bank-inventory-grid');
  if (!inventoryGrid) return;
  
  // Recreate the inventory section
  const inventorySection = document.querySelector('.inventory-section');
  if (inventorySection) {
    const newInventorySection = createInventorySection();
    inventorySection.replaceWith(newInventorySection);
  }
}

/**
 * Deposit all items from inventory into the bank
 */
function depositAllItems() {
  console.log('🏦 Deposit All button triggered');
  
  if (!window.inventoryModule) {
    console.warn('⚠️ Inventory module not available');
    return;
  }
  
  console.log('🏦 Starting Deposit All operation');
  
  const playerInventory = window.inventoryModule.getPlayerInventory();
  console.log('🏦 Player inventory retrieved:', playerInventory);
  
  if (!playerInventory || playerInventory.length === 0) {
    console.log('📭 No items in inventory to deposit');
    if (window.inventoryModule.showNotification) {
      window.inventoryModule.showNotification('Inventory is empty!', 'info');
    }
    return;
  }
  
  let deposited = 0;
  let totalItems = 0;
  
  // Count total items first
  for (let i = 0; i < playerInventory.length; i++) {
    if (playerInventory[i]) {
      totalItems += playerInventory[i].quantity || 1;
    }
  }
  
  console.log(`🏦 Found ${totalItems} total items to deposit`);
  
  if (totalItems === 0) {
    if (window.inventoryModule.showNotification) {
      window.inventoryModule.showNotification('Inventory is empty!', 'info');
    }
    return;
  }
  
  if (window.isUserOnline && window.isUserOnline() && window.getWebSocket) {
    // Online mode - deposit all items with server requests
    const websocket = window.getWebSocket();
    if (websocket && websocket.readyState === WebSocket.OPEN) {
      console.log('📤 Sending deposit all request to server');
      
      // Send all items in a single batch to avoid timing issues
      const itemsToDeposit = [];
      for (let i = 0; i < playerInventory.length; i++) {
        const item = playerInventory[i];
        if (item) {
          itemsToDeposit.push({
            inventorySlot: i,
            item: item,
            quantity: item.quantity || 1
          });
        }
      }
      
      console.log(`🏦 Prepared ${itemsToDeposit.length} items for server deposit`);
      
      // Process each item with a small delay to avoid overwhelming the server
      itemsToDeposit.forEach((depositData, index) => {
        setTimeout(() => {
          console.log(`📤 Sending deposit request ${index + 1}/${itemsToDeposit.length}: slot ${depositData.inventorySlot}`);
          websocket.send(JSON.stringify({
            type: 'bank-deposit-request',
            inventorySlot: depositData.inventorySlot,
            item: depositData.item,
            quantity: depositData.quantity,
            currentTab: bankInterface.currentTab
          }));
        }, index * 5); // 5ms delay between requests
      });
      
      if (window.inventoryModule.showNotification) {
        window.inventoryModule.showNotification(`Depositing ${itemsToDeposit.length} item stacks...`, 'info');
      }
    } else {
      console.warn('⚠️ WebSocket not available for deposit all');
      if (window.inventoryModule.showNotification) {
        window.inventoryModule.showNotification('Connection error - cannot deposit items', 'error');
      }
    }
  } else {
    console.log('🏦 Operating in offline mode - processing locally');
    // Offline mode - process each inventory slot locally
    for (let i = playerInventory.length - 1; i >= 0; i--) {
      const item = playerInventory[i];
      if (item) {
        const itemQuantity = item.quantity || 1;
        console.log(`🏦 Depositing ${item.id} x${itemQuantity} from slot ${i} (offline)`);
        try {
        processDepositLocally(i, item);
        deposited += itemQuantity;
        } catch (error) {
          console.error(`❌ Error depositing item from slot ${i}:`, error);
        }
      }
    }
    
    console.log(`✅ Deposit All completed (offline): ${deposited} items deposited`);
    
    if (window.inventoryModule.showNotification) {
      window.inventoryModule.showNotification(`Deposited ${deposited} items`, 'success');
    }
  }
}

// Export functions for access from other modules
if (typeof window !== 'undefined') {
  window.bankModule = {
    openBank,
    closeBank,
    isBankOpen,
    getBankData,
    switchToTab,
    setTabIcon,
    getCurrentTabSlotRange,
    globalSlotToTabSlot,
    tabSlotToGlobalSlot,
    depositAllItems,
    moveItemWithinBank,
    processReorganizeLocally,
    addBankItemTooltip,
    showBankTooltip,
    hideBankTooltip,
    depositItemsByType,
    withdrawItemsByType,
    formatCompactNumber,
    getQuantityColor,
    formatNumberWithCommas,
    filterBankItems,
    parseNumberWithSuffix
  };
  
  // Also export individual functions
  window.bankModuleFunctions = {
    depositItem,
    withdrawItem,
    depositAllItems,
    refreshBankDisplay,
    syncBankFromServer,
    handleBankMessage,
    displayBankInterface,
    switchToTab,
    setTabIcon,
    showTabIconSelector,
    getCurrentTabSlotRange,
    globalSlotToTabSlot,
    tabSlotToGlobalSlot,
    moveItemWithinBank,
    processReorganizeLocally,
    handleBankReorganizeConfirmed,
    handleBankReorganizeDenied,
    addBankItemTooltip,
    showBankTooltip,
    hideBankTooltip,
    depositItemsByType,
    withdrawItemsByType,
    promptDepositAmountByType,
    promptWithdrawAmountByType,
    consolidateBankStacks
  };
}

// ES6 module exports for main.js
export {
  openBank,
  closeBank,
  isBankOpen,
  getBankData,
  depositItem,
  withdrawItem,
  depositAllItems,
  refreshBankDisplay,
  syncBankFromServer,
  handleBankMessage,
  displayBankInterface,
  switchToTab,
  setTabIcon,
  showTabIconSelector,
  getCurrentTabSlotRange,
  globalSlotToTabSlot,
  tabSlotToGlobalSlot,
  moveItemWithinBank,
  processReorganizeLocally,
  handleBankReorganizeConfirmed,
  handleBankReorganizeDenied,
  addBankItemTooltip,
  showBankTooltip,
  hideBankTooltip,
  depositItemsByType,
  withdrawItemsByType,
  formatCompactNumber,
  getQuantityColor,
  formatNumberWithCommas,
  filterBankItems,
  parseNumberWithSuffix
};

/**
 * Move item within bank for reorganization
 */
function moveItemWithinBank(fromSlot, toSlot) {
  if (fromSlot === toSlot) return;
  
  console.log(`🏦 Moving item from bank slot ${fromSlot} to slot ${toSlot}`);
  
  // Get the item from source slot
  const sourceItem = playerBank[fromSlot];
  if (!sourceItem) {
    console.warn('⚠️ No item in source slot to move');
    return;
  }
  
  // Get the item from destination slot (might be null)
  const destItem = playerBank[toSlot];
  
  // Perform immediate local update for responsive UI
  console.log('🏦 Applying immediate local reorganization for responsive UI');
  const tempBank = [...playerBank]; // Backup current state
  tempBank[fromSlot] = destItem;
  tempBank[toSlot] = sourceItem;
  playerBank = tempBank;
  
  // Refresh display immediately
  refreshBankDisplay();
  
  // If online, send request to server
  if (window.isUserOnline && window.isUserOnline() && window.getWebSocket) {
    const websocket = window.getWebSocket();
    if (websocket && websocket.readyState === WebSocket.OPEN) {
      console.log('📤 Sending bank reorganize request to server');
      websocket.send(JSON.stringify({
        type: 'bank-reorganize-request',
        fromSlot: fromSlot,
        toSlot: toSlot,
        timestamp: Date.now()
      }));
      return;
    } else {
      console.warn('⚠️ WebSocket not available for bank reorganization');
    }
  }
  
  // Offline mode - show success notification
  if (window.inventoryModule && window.inventoryModule.showNotification) {
    window.inventoryModule.showNotification('Item moved', 'success');
  }
}

/**
 * Process bank reorganization locally
 */
function processReorganizeLocally(fromSlot, toSlot) {
  const sourceItem = playerBank[fromSlot];
  const destItem = playerBank[toSlot];
  
  console.log(`🏦 Processing local reorganization: ${sourceItem?.id || 'empty'} (slot ${fromSlot}) <-> ${destItem?.id || 'empty'} (slot ${toSlot})`);
  
  // Swap the items (or move to empty slot)
  playerBank[fromSlot] = destItem;
  playerBank[toSlot] = sourceItem;
  
  console.log(`🏦 Reorganized bank: moved item from slot ${fromSlot} to slot ${toSlot}`);
  
  // Refresh the bank display immediately for visual feedback
  refreshBankDisplay();
  
  // Show notification if available
  if (window.inventoryModule && window.inventoryModule.showNotification) {
    window.inventoryModule.showNotification('Item moved', 'success');
  }
}

/**
 * Handle bank reorganization confirmed from server
 */
function handleBankReorganizeConfirmed(data) {
  console.log('✅ Bank reorganization confirmed by server');
  
  // Update local bank data with server data to ensure perfect sync
  if (data.bankData) {
    console.log('🏦 Syncing reorganized bank data from server to ensure consistency');
    
    // Check if our local data matches server data
    const serverItems = data.bankData.filter(item => item).length;
    const localItems = playerBank.filter(item => item).length;
    
    if (serverItems !== localItems) {
      console.log('🔄 Server data differs from local, syncing...');
      syncBankFromServer(data.bankData);
    } else {
      console.log('✅ Local data matches server, no sync needed');
    }
  } else {
    // Fallback: if no bank data provided, just refresh the display
    console.log('🏦 No server bank data, refreshing display');
    refreshBankDisplay();
  }
  
  // Show success notification
  if (window.inventoryModule && window.inventoryModule.showNotification) {
    window.inventoryModule.showNotification('Item moved successfully', 'success');
  }
}

/**
 * Handle bank reorganization denied from server
 */
function handleBankReorganizeDenied(data) {
  console.warn('❌ Bank reorganization denied:', data.reason);
  
  // Server rejected the move, so we need to revert our local changes
  console.log('🔄 Reverting local changes due to server rejection');
  
  // Force refresh from server or reload the bank
  if (window.isUserOnline && window.isUserOnline() && window.getWebSocket) {
    const websocket = window.getWebSocket();
    if (websocket && websocket.readyState === WebSocket.OPEN) {
      console.log('📤 Requesting fresh bank data from server');
      websocket.send(JSON.stringify({
        type: 'bank-open-request',
        timestamp: Date.now()
      }));
    }
  }
  
  // Show error notification
  if (window.inventoryModule && window.inventoryModule.showNotification) {
    window.inventoryModule.showNotification(
      `Failed to move item: ${data.reason}`, 
      'error'
    );
  }
  
  // Refresh display to revert any local changes and ensure consistency
  console.log('🏦 Reverting any local changes and refreshing display');
  refreshBankDisplay();
}

/**
 * Add item tooltip functionality to bank slots
 */
function addBankItemTooltip(slot, item) {
  if (!item) return;
  
  // Add mouseover event for tooltip
  slot.addEventListener('mouseover', (e) => {
    showBankTooltip(e, item);
  });
  
  // Add mouseout event to hide tooltip
  slot.addEventListener('mouseout', () => {
    hideBankTooltip();
  });
  
  // Hide tooltip on any click or drag interaction
  slot.addEventListener('mousedown', () => {
    hideBankTooltip();
  });
  
  slot.addEventListener('dragstart', () => {
    hideBankTooltip();
  });
}

/**
 * Show bank item tooltip
 */
function showBankTooltip(event, item) {
  hideBankTooltip(); // Remove any existing tooltip
  
  // Try multiple ways to get item definitions
  let itemDef = null;
  if (window.inventoryModule && window.inventoryModule.getItemDefinition) {
    itemDef = window.inventoryModule.getItemDefinition(item.id);
  } else if (window.itemDefinitions && window.itemDefinitions[item.id]) {
    itemDef = window.itemDefinitions[item.id];
  }
  
  if (!itemDef) {
    console.warn('❌ No item definition found for item:', item.id);
    return;
  }
  
  // Use custom description if available, otherwise use item definition description
  const description = item.description || itemDef.description;
  // Use custom name if available, otherwise use item definition name  
  const name = item.name || itemDef.name;
  
  const tooltip = document.createElement('div');
  tooltip.className = 'bank-item-tooltip';
  tooltip.innerHTML = `
    <div class="tooltip-item-name">${name}</div>
    <div class="tooltip-item-description">${description}</div>
    ${item.quantity && item.quantity > 1 ? `<div class="tooltip-item-quantity">Quantity: ${formatNumberWithCommas(item.quantity)}</div>` : ''}
    ${item.author ? `<div class="tooltip-item-author">Written by: ${item.author}</div>` : ''}
  `;
  
  // Position tooltip
  tooltip.style.cssText = `
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
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    left: ${event.pageX + 10}px;
    top: ${event.pageY - 10}px;
  `;
  
  // Style the tooltip content
  const nameDiv = tooltip.querySelector('.tooltip-item-name');
  if (nameDiv) {
    nameDiv.style.cssText = `
      font-weight: bold;
      margin-bottom: 4px;
      color: #f0f0f0;
    `;
  }
  
  const descDiv = tooltip.querySelector('.tooltip-item-description');
  if (descDiv) {
    descDiv.style.cssText = `
      color: #ccc;
      margin-bottom: 4px;
    `;
  }
  
  const quantityDiv = tooltip.querySelector('.tooltip-item-quantity');
  if (quantityDiv) {
    quantityDiv.style.cssText = `
      color: #f1c40f;
      font-weight: bold;
    `;
  }
  
  const authorDiv = tooltip.querySelector('.tooltip-item-author');
  if (authorDiv) {
    authorDiv.style.cssText = `
      color: #daa520;
      font-style: italic;
      margin-top: 4px;
      font-size: 11px;
    `;
  }
  
  document.body.appendChild(tooltip);
}

/**
 * Hide bank item tooltip
 */
function hideBankTooltip() {
  const existingTooltips = document.querySelectorAll('.bank-item-tooltip');
  existingTooltips.forEach(tooltip => {
    tooltip.remove();
  });
}

/**
 * Add item tooltip functionality to inventory slots in bank interface
 */
function addInventoryItemTooltip(slot, item) {
  if (!item) return;
  
  // Add mouseover event for tooltip
  slot.addEventListener('mouseover', (e) => {
    showInventoryTooltip(e, item);
  });
  
  // Add mouseout event to hide tooltip
  slot.addEventListener('mouseout', () => {
    hideInventoryTooltip();
  });
  
  // Hide tooltip on any click or drag interaction
  slot.addEventListener('mousedown', () => {
    hideInventoryTooltip();
  });
  
  slot.addEventListener('dragstart', () => {
    hideInventoryTooltip();
  });
}

/**
 * Show inventory item tooltip in bank interface
 */
function showInventoryTooltip(event, item) {
  hideInventoryTooltip(); // Remove any existing tooltip
  
  // Try multiple ways to get item definitions
  let itemDef = null;
  if (window.inventoryModule && window.inventoryModule.getItemDefinition) {
    itemDef = window.inventoryModule.getItemDefinition(item.id);
  } else if (window.itemDefinitions && window.itemDefinitions[item.id]) {
    itemDef = window.itemDefinitions[item.id];
  }
  
  if (!itemDef) {
    console.warn('❌ No item definition found for inventory item:', item.id);
    return;
  }
  
  // Use custom description if available, otherwise use item definition description
  const description = item.description || itemDef.description;
  // Use custom name if available, otherwise use item definition name  
  const name = item.name || itemDef.name;
  
  const tooltip = document.createElement('div');
  tooltip.className = 'bank-inventory-tooltip';
  tooltip.innerHTML = `
    <div class="tooltip-item-name">${name}</div>
    <div class="tooltip-item-description">${description}</div>
    ${item.quantity && item.quantity > 1 ? `<div class="tooltip-item-quantity">Quantity: ${formatNumberWithCommas(item.quantity)}</div>` : ''}
    ${item.author ? `<div class="tooltip-item-author">Written by: ${item.author}</div>` : ''}
  `;
  
  // Position tooltip
  tooltip.style.cssText = `
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
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    left: ${event.pageX + 10}px;
    top: ${event.pageY - 10}px;
  `;
  
  // Style the tooltip content
  const nameDiv = tooltip.querySelector('.tooltip-item-name');
  if (nameDiv) {
    nameDiv.style.cssText = `
      font-weight: bold;
      margin-bottom: 4px;
      color: #f0f0f0;
    `;
  }
  
  const descDiv = tooltip.querySelector('.tooltip-item-description');
  if (descDiv) {
    descDiv.style.cssText = `
      color: #ccc;
      margin-bottom: 4px;
    `;
  }
  
  const quantityDiv = tooltip.querySelector('.tooltip-item-quantity');
  if (quantityDiv) {
    quantityDiv.style.cssText = `
      color: #f1c40f;
      font-weight: bold;
    `;
  }
  
  const authorDiv = tooltip.querySelector('.tooltip-item-author');
  if (authorDiv) {
    authorDiv.style.cssText = `
      color: #daa520;
      font-style: italic;
      margin-top: 4px;
      font-size: 11px;
    `;
  }
  
  document.body.appendChild(tooltip);
}

/**
 * Hide inventory item tooltip
 */
function hideInventoryTooltip() {
  const existingTooltips = document.querySelectorAll('.bank-inventory-tooltip');
  existingTooltips.forEach(tooltip => {
    tooltip.remove();
  });
}

/**
 * Prompt for custom deposit amount by item type
 */
function promptDepositAmountByType(itemId, maxAmount, isNoted) {
  const amount = prompt(`How many ${itemId} would you like to deposit? (Max: ${formatCompactNumber(maxAmount)})\nUse k/m/b suffixes: e.g., 100k, 5m, 1.5b`);
  if (amount !== null) {
    const parsedAmount = parseNumberWithSuffix(amount);
    if (parsedAmount !== null && parsedAmount > 0 && parsedAmount <= maxAmount) {
      depositItemsByType(itemId, parsedAmount, isNoted);
    } else if (parsedAmount !== null && parsedAmount > maxAmount) {
      if (window.inventoryModule && window.inventoryModule.showNotification) {
        window.inventoryModule.showNotification(`Amount too large! Maximum available: ${formatCompactNumber(maxAmount)}`, 'error');
      }
    } else {
      if (window.inventoryModule && window.inventoryModule.showNotification) {
        window.inventoryModule.showNotification('Invalid amount! Use numbers or k/m/b suffixes (e.g., 100k, 5m)', 'error');
      }
    }
  }
}

/**
 * Prompt for custom withdraw amount by item type
 */
function promptWithdrawAmountByType(itemId, maxAmount, isNoted) {
  const amount = prompt(`How many ${itemId} would you like to withdraw? (Max: ${formatCompactNumber(maxAmount)})\nUse k/m/b suffixes: e.g., 100k, 5m, 1.5b`);
  if (amount !== null) {
    const parsedAmount = parseNumberWithSuffix(amount);
    if (parsedAmount !== null && parsedAmount > 0 && parsedAmount <= maxAmount) {
      withdrawItemsByType(itemId, parsedAmount, isNoted);
    } else if (parsedAmount !== null && parsedAmount > maxAmount) {
      if (window.inventoryModule && window.inventoryModule.showNotification) {
        window.inventoryModule.showNotification(`Amount too large! Maximum available: ${formatCompactNumber(maxAmount)}`, 'error');
      }
    } else {
      if (window.inventoryModule && window.inventoryModule.showNotification) {
        window.inventoryModule.showNotification('Invalid amount! Use numbers or k/m/b suffixes (e.g., 100k, 5m)', 'error');
      }
    }
  }
}

/**
 * Deposit multiple items of the same type from inventory
 */
function depositItemsByType(itemId, targetQuantity, isNoted) {
  if (!window.inventoryModule) {
    console.warn('⚠️ Inventory module not available for deposit by type');
    return;
  }
  
  console.log(`🏦 Depositing ${targetQuantity} ${itemId} (noted: ${isNoted}) by type`);
  console.log(`🔍 DEBUG: Starting deposit - targetQuantity=${targetQuantity}, itemId=${itemId}, isNoted=${isNoted}`);
  
  const playerInventory = window.inventoryModule.getPlayerInventory();
  let remainingToDeposit = targetQuantity;
  const slotsToProcess = [];
  
  // Find all matching items in inventory
  for (let i = 0; i < playerInventory.length && remainingToDeposit > 0; i++) {
    const item = playerInventory[i];
    if (item && item.id === itemId && (!!item.noted) === isNoted) {
      const itemQty = item.quantity || 1;
      const takeFromSlot = Math.min(itemQty, remainingToDeposit);
      
      slotsToProcess.push({
        slot: i,
        quantity: takeFromSlot,
        item: item
      });
      
      remainingToDeposit -= takeFromSlot;
    }
  }
  
  if (slotsToProcess.length === 0) {
    console.warn(`⚠️ No ${itemId} found in inventory for deposit`);
    return;
  }
  
  const actualDeposit = targetQuantity - remainingToDeposit;
  console.log(`🏦 Processing ${slotsToProcess.length} slots to deposit ${actualDeposit} items`);
  
  if (slotsToProcess.length === 0) return;
  
  // For single slot deposits, just use the original function to avoid any complications
  if (slotsToProcess.length === 1) {
    const slotData = slotsToProcess[0];
    console.log(`🏦 Single slot deposit: ${slotData.quantity} from slot ${slotData.slot}`);
    depositItem(slotData.slot, slotData.quantity);
    return;
  }
  
  // For multiple slots, process each slot individually
  // Process in reverse order to avoid slot shifting issues when items are removed
  console.log(`🏦 Multi-slot deposit: ${actualDeposit} items across ${slotsToProcess.length} slots`);
  
  // Sort slots by index in descending order to process from highest to lowest
  slotsToProcess.sort((a, b) => b.slot - a.slot);
  
  for (const slotData of slotsToProcess) {
    console.log(`🏦 Depositing ${slotData.quantity} from slot ${slotData.slot}`);
    depositItem(slotData.slot, slotData.quantity);
  }
}

/**
 * Withdraw multiple items of the same type from bank
 */
function withdrawItemsByType(itemId, targetQuantity, isNoted) {
  console.log(`🏦 [BANK.JS] withdrawItemsByType called:`, { itemId, targetQuantity, isNoted });
  
  // Check available inventory space first
  if (!window.inventoryModule) {
    console.warn('⚠️ Inventory module not available for withdrawal by type');
    return;
  }
  
  const playerInventory = window.inventoryModule.getPlayerInventory();
  const itemDef = window.inventoryModule.getItemDefinition(itemId);
  const isStackable = itemDef && itemDef.stackable;
  
  // Check if items will be noted when withdrawn (note mode or already noted items)
  // But exclude stackable items and books from being noted even in note mode
  
  // Check if item is a book: either has category 'books' OR is an unfinished book from scribing
  const isDefinedBook = itemDef && itemDef.category === 'books';
  const isUnfinishedBook = itemId.startsWith('unfinished_') || itemId.includes('unfinished');
  const isBook = isDefinedBook || isUnfinishedBook;
  
  // Can only be noted if it has a valid definition AND is not stackable AND is not a book
  const canBeNoted = itemDef && !isStackable && !isBook;
  const willBeNoted = (bankInterface.noteMode && canBeNoted) || isNoted;
  
  console.log(`🔍 withdrawItemsByType ${itemId}: isDefinedBook=${isDefinedBook}, isUnfinishedBook=${isUnfinishedBook}, canBeNoted=${canBeNoted}`);
  const willBeStackable = isStackable || willBeNoted; // Noted items are always stackable
  
  // Calculate how many items we can actually withdraw based on inventory space
  let maxCanWithdraw = targetQuantity;
  
  if (willBeStackable) {
    // Stackable or noted items can stack together
    const existingSlot = playerInventory.findIndex(invItem => 
      invItem && 
      invItem.id === itemId && 
      (!!invItem.noted) === willBeNoted // Match the noted status that items will have
    );
    
    if (existingSlot === -1) {
      // Need an empty slot for new stack
      const emptySlots = playerInventory.filter(slot => !slot).length;
      if (emptySlots === 0) {
        console.warn('⚠️ No inventory space for stackable item');
        if (window.inventoryModule.showNotification) {
          window.inventoryModule.showNotification('No inventory space!', 'error');
        }
        return;
      }
      // Can withdraw all since they'll stack in one slot
    }
    // If existing slot found, can withdraw all since they'll stack
    console.log(`🏦 Items will be ${willBeNoted ? 'noted' : 'regular'} and stackable - can withdraw all ${targetQuantity}`);
  } else {
    // Non-stackable, non-noted items need individual slots
    const emptySlots = playerInventory.filter(slot => !slot).length;
    if (emptySlots === 0) {
      console.warn('⚠️ No inventory space for non-stackable items');
      if (window.inventoryModule.showNotification) {
        window.inventoryModule.showNotification('No inventory space!', 'error');
      }
      return;
    }
    
    // Limit withdrawal to available empty slots
    maxCanWithdraw = Math.min(targetQuantity, emptySlots);
    
    if (maxCanWithdraw < targetQuantity) {
      console.log(`🏦 Adjusting withdrawal from ${targetQuantity} to ${maxCanWithdraw} due to inventory space`);
      if (window.inventoryModule.showNotification) {
        window.inventoryModule.showNotification(`Adjusting to ${maxCanWithdraw} items (limited by inventory space)`, 'warning');
      }
    }
  }
  
  let remainingToWithdraw = maxCanWithdraw;
  const slotsToProcess = [];
  
  // Find all matching items in bank
  for (let i = 0; i < playerBank.length && remainingToWithdraw > 0; i++) {
    const item = playerBank[i];
    if (item && item.id === itemId && (!!item.noted) === isNoted) {
      const itemQty = item.quantity || 1;
      const takeFromSlot = Math.min(itemQty, remainingToWithdraw);
      
      slotsToProcess.push({
        slot: i,
        quantity: takeFromSlot,
        item: item
      });
      
      remainingToWithdraw -= takeFromSlot;
    }
  }
  
  if (slotsToProcess.length === 0) {
    console.warn(`⚠️ No ${itemId} found in bank for withdrawal`);
    return;
  }
  
  const actualWithdraw = maxCanWithdraw - remainingToWithdraw;
  console.log(`🏦 Processing ${slotsToProcess.length} slots to withdraw ${actualWithdraw} items (note mode: ${bankInterface.noteMode})`);
  
  // For stackable items we delegate each withdrawal to the standard withdrawItem so that
  // the server (when online) remains the single source of truth. This avoids local-only
  // state changes that previously caused desyncs and duplicate stacks.
  if (willBeStackable && slotsToProcess.length > 0) {
    console.log(`🏦 Delegating ${slotsToProcess.length} stackable withdrawals to withdrawItem for proper server sync`);
    
    // Sort by slot to maintain predictable order
    slotsToProcess.sort((a, b) => a.slot - b.slot);
    
    slotsToProcess.forEach((slotData, idx) => {
      setTimeout(() => {
        withdrawItem(slotData.slot, slotData.quantity);
      }, idx * 10); // small stagger to avoid websocket flooding
    });
  } else {
    // For non-stackable items, process individually
    slotsToProcess.forEach((slotData, index) => {
      setTimeout(() => {
        console.log(`🏦 Withdrawing ${slotData.quantity} from bank slot ${slotData.slot} (${index + 1}/${slotsToProcess.length})`);
        withdrawItem(slotData.slot, slotData.quantity);
      }, index * 10); // Small delay to avoid overwhelming the system
    });
  }
  
  // Show summary notification
  if (window.inventoryModule && window.inventoryModule.showNotification) {
    const noteText = willBeNoted ? ' (noted)' : '';
    
    // Show special notification if note mode was requested but item can't be noted
    if (bankInterface.noteMode && !canBeNoted && !isNoted) {
      if (isStackable) {
        window.inventoryModule.showNotification(`Withdrawing ${formatCompactNumber(actualWithdraw)} ${itemId} (stackable items cannot be noted)`, 'warning');
      } else if (isBook) {
        window.inventoryModule.showNotification(`Withdrawing ${formatCompactNumber(actualWithdraw)} ${itemId} (books cannot be noted)`, 'warning');
      }
    } else {
      if (actualWithdraw === targetQuantity) {
        window.inventoryModule.showNotification(`Withdrawing ${formatCompactNumber(actualWithdraw)} ${itemId}${noteText}...`, 'info');
      } else {
        window.inventoryModule.showNotification(`Withdrawing ${formatCompactNumber(actualWithdraw)}/${formatCompactNumber(targetQuantity)} ${itemId}${noteText} (inventory limit)`, 'warning');
      }
    }
  }
}

/**
 * Get the appropriate text color for quantity based on value thresholds
 * @param {number} quantity - The quantity to check
 * @returns {string} - CSS color value
 */
function getQuantityColor(quantity) {
  if (quantity >= 1000000000) {  // 1b+
    return '#ff54c9';  // Bright green
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
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Get the actual deposit amount based on user selection
 */
function getDepositAmount(item) {
  if (bankInterface.leftClickDepositAmount === 'All') {
    return item.quantity || 1;
  }
  
  // For all items, limit by the actual slot quantity to avoid accumulation issues
  // depositItemsByType will handle finding multiple slots for non-stackable items
  const itemDef = window.inventoryModule ? window.inventoryModule.getItemDefinition(item.id) : null;
  const isStackable = itemDef && itemDef.stackable;
  const isNoted = window.inventoryModuleFunctions && window.inventoryModuleFunctions.isItemNoted && window.inventoryModuleFunctions.isItemNoted(item);
  
  // Always limit by slot quantity to prevent accumulation bugs
  return Math.min(bankInterface.leftClickDepositAmount, item.quantity || 1);
}

/**
 * Get the actual withdraw amount based on user selection
 */
function getWithdrawAmount(item) {
  if (bankInterface.leftClickWithdrawAmount === 'All') {
    return item.quantity || 1;
  }
  
  // For all items, limit by the actual slot quantity to avoid accumulation issues
  // withdrawItemsByType will handle finding multiple slots for non-stackable items
  const itemDef = window.inventoryModule ? window.inventoryModule.getItemDefinition(item.id) : null;
  const isStackable = itemDef && itemDef.stackable;
  const isNoted = window.inventoryModuleFunctions && window.inventoryModuleFunctions.isItemNoted && window.inventoryModuleFunctions.isItemNoted(item);
  
  // Always limit by slot quantity to prevent accumulation bugs
  return Math.min(bankInterface.leftClickWithdrawAmount, item.quantity || 1);
}

/**
 * Parse number input with k/m/b suffix support
 * @param {string} input - The input string (e.g., "100k", "5m", "1.5b")
 * @returns {number|null} - Parsed number or null if invalid
 */
function parseNumberWithSuffix(input) {
  if (!input || typeof input !== 'string') return null;
  
  // Remove whitespace and convert to lowercase
  const cleanInput = input.trim().toLowerCase();
  
  // Check for suffix
  const lastChar = cleanInput.slice(-1);
  let multiplier = 1;
  let numberPart = cleanInput;
  
  if (lastChar === 'k') {
    multiplier = 1000;
    numberPart = cleanInput.slice(0, -1);
  } else if (lastChar === 'm') {
    multiplier = 1000000;
    numberPart = cleanInput.slice(0, -1);
  } else if (lastChar === 'b') {
    multiplier = 1000000000;
    numberPart = cleanInput.slice(0, -1);
  }
  
  // Parse the number part
  const num = parseFloat(numberPart);
  
  if (isNaN(num) || num < 0) {
    return null;
  }
  
  return Math.floor(num * multiplier);
}

/**
 * Filter bank items based on search term
 */
function filterBankItems(searchTerm) {
  const bankGrid = document.getElementById('bank-grid');
  if (!bankGrid) return;
  
  const slots = bankGrid.querySelectorAll('.bank-slot');
  
  if (searchTerm === '') {
    // No search term - show current tab normally
    slots.forEach((slot, index) => {
      const globalSlot = tabSlotToGlobalSlot(index);
      const item = playerBank[globalSlot];
      slot.style.display = 'flex';
    });
    
    // Update the display to show current tab items normally
    refreshBankDisplay();
    console.log(`🔍 Bank search cleared - showing current tab ${bankInterface.currentTab}`);
    return;
  }
  
  // Search across ALL tabs for matching items
  const matchingItems = [];
  for (let i = 0; i < playerBank.length; i++) {
    const item = playerBank[i];
    if (!item) continue;
    
    let itemName = item.id;
    
    // Try to get proper item name from definitions
    if (window.inventoryModule && window.inventoryModule.getItemDefinition) {
      const itemDef = window.inventoryModule.getItemDefinition(item.id);
      if (itemDef && itemDef.name) {
        itemName = itemDef.name;
      }
    }
    
    // Check if search term matches item name or ID
    const matches = itemName.toLowerCase().includes(searchTerm) || 
                   item.id.toLowerCase().includes(searchTerm);
    
    if (matches) {
      matchingItems.push({
        item: item,
        originalSlot: i,
        tab: Math.floor(i / SLOTS_PER_TAB)
      });
    }
  }
  
  console.log(`🔍 Bank search for "${searchTerm}": found ${matchingItems.length} items across all tabs`);
  
  // Clear all slots first
  slots.forEach(slot => {
    slot.innerHTML = '';
    slot.classList.remove('occupied');
    slot.style.background = '#2c3e50';
    slot.style.borderColor = '#34495e';
    slot.style.display = 'flex';
    
    // Remove all event listeners by cloning the node
    const newSlot = slot.cloneNode(true);
    slot.parentNode.replaceChild(newSlot, slot);
  });
  
  // Get fresh slot references after cloning
  const newSlots = bankGrid.querySelectorAll('.bank-slot');
  
  // Populate slots with search results (up to the number of slots we have)
  matchingItems.slice(0, newSlots.length).forEach((matchData, index) => {
    const slot = newSlots[index];
    const item = matchData.item;
    
    slot.classList.add('occupied');
    slot.dataset.originalSlot = matchData.originalSlot; // Store original location
    slot.dataset.searchResult = 'true'; // Mark as search result
    
    // Item icon
    const itemIcon = document.createElement('div');
    itemIcon.className = 'inventory-item-icon';
    itemIcon.textContent = getItemDisplayIcon(item);
    itemIcon.style.cssText = `
      font-size: 18px;
      position: relative;
      z-index: 1;
    `;
    
    // Add noted indicator if item is noted
    if (item.noted && window.inventoryModuleFunctions) {
      if (window.inventoryModuleFunctions.isItemNoted(item)) {
        const notedIndicator = document.createElement('div');
        notedIndicator.className = 'noted-indicator';
        notedIndicator.textContent = '📝';
        notedIndicator.style.cssText = `
          position: absolute;
          top: -2px;
          right: -2px;
          font-size: 10px;
          z-index: 3;
          color: #f39c12;
        `;
        slot.appendChild(notedIndicator);
      }
    }
    
    // Quantity
    if (item.quantity && item.quantity > 1) {
      const quantityLabel = document.createElement('div');
      quantityLabel.className = 'inventory-item-quantity';
      quantityLabel.textContent = formatCompactNumber(item.quantity);
      quantityLabel.style.cssText = `
        position: absolute;
        bottom: 1px;
        right: 2px;
        background: rgba(0, 0, 0, 0.7);
        color: ${getQuantityColor(item.quantity)};
        font-size: 10px;
        font-weight: bold;
        padding: 1px 3px;
        border-radius: 2px;
        line-height: 1;
        z-index: 2;
      `;
      slot.appendChild(quantityLabel);
    }
    
    // Tab indicator (show which tab this item is from)
    const tabIndicator = document.createElement('div');
    tabIndicator.textContent = `T${matchData.tab + 1}`;
    tabIndicator.style.cssText = `
      position: absolute;
      top: -2px;
      left: -2px;
      background: #3498db;
      color: white;
      font-size: 8px;
      font-weight: bold;
      padding: 1px 3px;
      border-radius: 2px;
      line-height: 1;
      z-index: 3;
    `;
    slot.appendChild(tabIndicator);
    
    slot.appendChild(itemIcon);
    slot.style.borderColor = '#3498db';
    slot.style.background = '#34495e';
    
    // Add withdraw functionality using original slot
    slot.addEventListener('click', () => {
      const withdrawAmount = getWithdrawAmount(item);
      
      // Use the original slot position for withdrawal
      if (withdrawAmount > 1) {
        withdrawItemsByType(item.id, withdrawAmount, !!item.noted);
      } else {
        withdrawItem(matchData.originalSlot, withdrawAmount);
      }
    });
    
    // Add right-click context menu using original slot
    slot.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showBankWithdrawMenu(e, matchData.originalSlot);
    });
    
    // Add tooltip functionality
    addBankItemTooltip(slot, item);
    
    slot.addEventListener('mouseenter', () => {
      slot.style.background = '#e74c3c';
      slot.style.borderColor = '#c0392b';
    });
    
    slot.addEventListener('mouseleave', () => {
      slot.style.background = '#34495e';
      slot.style.borderColor = '#3498db';
    });
  });
  
  // Hide remaining empty slots when showing search results
  for (let i = matchingItems.length; i < newSlots.length; i++) {
    newSlots[i].style.display = 'none';
  }
}

/**
 * Consolidate identical items in the bank by merging them into single stacks
 * This prevents fragmented stacks and keeps the bank organized
 */
function consolidateBankStacks() {
  console.log('🏦 Starting bank consolidation...');
  
  // Debug: Check if playerBank exists and has items
  if (!playerBank) {
    console.warn('⚠️ playerBank is not defined or null');
    if (window.inventoryModule && window.inventoryModule.showNotification) {
      window.inventoryModule.showNotification('Bank not loaded yet', 'error');
    }
    return;
  }
  
  console.log(`🏦 Bank has ${playerBank.length} slots total`);
  const existingItems = playerBank.filter(item => item);
  console.log(`🏦 Bank has ${existingItems.length} items currently`);
  
  if (existingItems.length === 0) {
    console.log('🏦 No items in bank to consolidate');
    if (window.inventoryModule && window.inventoryModule.showNotification) {
      window.inventoryModule.showNotification('No items to organize', 'info');
    }
    return;
  }
  
  const itemStacks = new Map(); // Map of itemId -> {totalQuantity, slots: [slot indices]}
  
  // First pass: catalog all items and their locations
  for (let i = 0; i < playerBank.length; i++) {
    const item = playerBank[i];
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
      console.log(`🏦 Consolidating ${stackData.slots.length} stacks of ${stackData.item.id} (total: ${stackData.totalQuantity})`);
      
      // Keep the first slot, clear the others
      const keepSlot = stackData.slots[0];
      
      // Update the kept slot with the total quantity
      playerBank[keepSlot] = {
        ...stackData.item,
        quantity: stackData.totalQuantity
      };
      
      // Clear all other slots
      for (let i = 1; i < stackData.slots.length; i++) {
        playerBank[stackData.slots[i]] = null;
      }
      
      consolidationsMade++;
    }
  }
  
  if (consolidationsMade > 0) {
    console.log(`🏦 Bank consolidation complete: merged ${consolidationsMade} item types`);
    
    // Refresh display to show consolidated stacks
    refreshBankDisplay();
    
    // Show notification to user
    if (window.inventoryModule && window.inventoryModule.showNotification) {
      window.inventoryModule.showNotification(`Bank organized: consolidated ${consolidationsMade} item types`, 'success');
    }
  } else {
    console.log('🏦 No consolidations needed - all items are already properly stacked');
    if (window.inventoryModule && window.inventoryModule.showNotification) {
      window.inventoryModule.showNotification('Bank is already organized', 'info');
    }
  }
}
