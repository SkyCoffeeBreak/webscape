/**
 * Fallback script for WebscapeRPG
 * Used when ES modules don't work (e.g., when opening directly from file system)
 */

document.addEventListener('DOMContentLoaded', () => {
  console.log('Using fallback script...');
  
  // Initialize tabs
  initializeTabs();
  
  // Initialize skills
  initializeSkills();
  
  // Initialize game world
  initializeWorld();
  
  // Initialize inventory system
  initializeInventory();
  
  // Expose modules to window for cross-module communication
  window.inventoryModule = { updateAllFloorItemPositions };
  
  // Add reset world button listener
  document.getElementById('reset-world-btn')?.addEventListener('click', () => {
    resetWorld();
    resetInventory();
    initializeWorld();
    initializeInventory();
    showNotification('World has been reset!', 'success');
  });
  
  // Show notification
  showNotification('Welcome to WebscapeRPG!', 'success');
});

// ---- Tab Functions ----

function initializeTabs() {
  console.log('Initializing tabs (fallback)...');
  const tabs = document.querySelectorAll('.tab');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      const tabName = tab.dataset.tab;
      console.log(`Tab clicked: ${tabName}`);
      switchTab(tabName);
    });
  });

  // Force initial tab state
  const activeTab = document.querySelector('.tab.active');
  if (activeTab) {
    switchTab(activeTab.dataset.tab);
  } else if (tabs.length > 0) {
    switchTab(tabs[0].dataset.tab);
  }
}

function switchTab(tabName) {
  console.log(`Switching to tab: ${tabName}`);
  
  // Update tab buttons
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => {
    if (tab.dataset.tab === tabName) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });
  
  // Update tab content
  const tabPanes = document.querySelectorAll('.tab-pane');
  tabPanes.forEach(pane => {
    if (pane.id === `${tabName}-tab`) {
      pane.classList.add('active');
    } else {
      pane.classList.remove('active');
    }
  });
}

// ---- Skills Functions ----

// Basic skill data
const skills = {
  attack: 1, magic: 1, ranged: 1, blasting: 1,
  defence: 1, hitpoints: 10, prayer: 1, slayer: 1,
  mining: 1, fishing: 1, woodcutting: 1, harvesting: 1,
  smithing: 1, cooking: 1, fletching: 1, apothecary: 1,
  crafting: 1, bonecarving: 1, painting: 1, brewing: 1,
  scribing: 1, confectionery: 1, masonry: 1, tailoring: 1,
  thieving: 1, alchemy: 1, creation: 1, delivery: 1,
  ranching: 1, knowledge: 1, candlemaking: 1, pottery: 1,
  digging: 1, diplomacy: 1, apiary: 1, taming: 1, dracology: 1, engineering: 1
};

function initializeSkills() {
  // Add some CSS for consistent skill box sizes
  const styleElement = document.createElement('style');
  styleElement.textContent = `
    .skill-ui {
      grid-template-columns: repeat(4, 90px);
      gap: 10px;
      justify-content: center;
    }
    .skill {
      width: 80px;
      height: 80px;
      padding: 8px 5px;
      box-sizing: border-box;
      justify-content: space-between;
      margin: 0 auto;
      background-color: #333333;
    }
    .skill:hover {
      background-color: #3a3a3a;
    }
    .skill-name {
      height: 26px;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      line-height: 1.2;
      padding: 0 2px;
      text-shadow: 1px 1px 1px #000, -1px -1px 1px #000, 1px -1px 1px #000, -1px 1px 1px #000;
    }
    .skill-icon {
      text-shadow: 1px 1px 1px #000, -1px -1px 1px #000, 1px -1px 1px #000, -1px 1px 1px #000;
    }
    .skill-level {
      text-shadow: 1px 1px 1px #000, -1px -1px 1px #000, 1px -1px 1px #000, -1px 1px 1px #000;
    }
    
    /* Skill thematic backgrounds */
    /* Combat skills */
    .skill[data-skill="attack"] { background: linear-gradient(to bottom, rgba(170, 0, 0, 0.4), rgba(170, 0, 0, 0.4) 50%, #333333); }
    .skill[data-skill="magic"] { background: linear-gradient(to bottom, rgba(0, 100, 255, 0.4), rgba(0, 100, 255, 0.4) 50%, #333333); }
    .skill[data-skill="ranged"] { background: linear-gradient(to bottom, rgba(0, 120, 0, 0.4), rgba(0, 120, 0, 0.4) 50%, #333333); }
    .skill[data-skill="blasting"] { background: linear-gradient(to bottom, rgba(140, 0, 255, 0.4), rgba(140, 0, 255, 0.4) 50%, #333333); }
    .skill[data-skill="defence"] { background: linear-gradient(to bottom, rgba(27, 38, 201, 0.4), rgba(27, 38, 201, 0.4) 50%, #333333); }
    .skill[data-skill="hitpoints"] { background: linear-gradient(to bottom, rgba(255, 57, 57, 0.4), rgba(255, 57, 57, 0.4) 50%, #333333); }
    .skill[data-skill="prayer"] { background: linear-gradient(to bottom, rgba(254, 255, 193, 0.45), rgba(254, 255, 193, 0.45) 50%, #333333); }
    .skill[data-skill="slayer"] { background: linear-gradient(to bottom, rgba(50, 0, 0, 0.4), rgba(50, 0, 0, 0.4) 50%, #333333); }
    
    /* Gathering skills */
    .skill[data-skill="mining"] { background: linear-gradient(to bottom, rgba(100, 100, 100, 0.4), rgba(100, 100, 100, 0.4) 50%, #333333); }
    .skill[data-skill="fishing"] { background: linear-gradient(to bottom, rgba(0, 150, 200, 0.4), rgba(0, 150, 200, 0.4) 50%, #333333); }
    .skill[data-skill="harvesting"] { background: linear-gradient(to bottom, rgba(80, 120, 40, 0.45), rgba(80, 120, 40, 0.45) 50%, #333333); }
    .skill[data-skill="woodcutting"] { background: linear-gradient(to bottom, rgba(153, 114, 30, 0.45), rgba(153, 114, 30, 0.45) 50%, #333333); }
    
    /* Artisan skills */
    .skill[data-skill="smithing"] { background: linear-gradient(to bottom, rgba(26, 21, 32, 0.45), rgba(26, 21, 32, 0.45) 50%, #333333); }
    .skill[data-skill="cooking"] { background: linear-gradient(to bottom, rgba(200, 80, 80, 0.4), rgba(200, 80, 80, 0.4) 50%, #333333); }
    .skill[data-skill="fletching"] { background: linear-gradient(to bottom, rgba(159, 228, 102, 0.4), rgba(159, 228, 102, 0.4) 50%, #333333); }
    .skill[data-skill="apothecary"] { background: linear-gradient(to bottom, rgba(0, 160, 0, 0.4), rgba(0, 160, 0, 0.4) 50%, #333333); }
    .skill[data-skill="crafting"] { background: linear-gradient(to bottom, rgba(155, 172, 204, 0.45), rgba(155, 172, 204, 0.45) 50%, #333333); }
    .skill[data-skill="bonecarving"] { background: linear-gradient(to bottom, rgba(255, 230, 150, 0.4), rgba(255, 230, 150, 0.4) 50%, #333333); }
    .skill[data-skill="painting"] { background: linear-gradient(to bottom, rgba(255, 70, 184, 0.4), rgba(255, 70, 184, 0.4) 50%, #333333); }
    .skill[data-skill="brewing"] { background: linear-gradient(to bottom, rgba(160, 120, 0, 0.45), rgba(160, 120, 0, 0.45) 50%, #333333); }
    .skill[data-skill="runecrafting"] { background: linear-gradient(to bottom, rgba(140, 0, 200, 0.4), rgba(140, 0, 200, 0.4) 50%, #333333); }
    .skill[data-skill="confectionery"] { background: linear-gradient(to bottom, rgba(243, 127, 152, 0.4), rgba(243, 127, 152, 0.4) 50%, #333333); }
    .skill[data-skill="masonry"] { background: linear-gradient(to bottom, rgba(139, 111, 103, 0.4), rgba(139, 111, 103, 0.4) 50%, #333333); }
    .skill[data-skill="tailoring"] { background: linear-gradient(to bottom, rgba(100, 100, 200, 0.4), rgba(100, 100, 200, 0.4) 50%, #333333); }
    
    /* Support skills */
    .skill[data-skill="thieving"] { background: linear-gradient(to bottom, rgba(0, 0, 0, 0.45), rgba(0, 0, 0, 0.45) 50%, #333333); }
    .skill[data-skill="alchemy"] { background: linear-gradient(to bottom, rgba(61, 229, 235, 0.4), rgba(61, 229, 235, 0.4) 50%, #333333); }
    .skill[data-skill="creation"] { background: linear-gradient(to bottom, rgba(255, 255, 70, 0.4), rgba(255, 255, 70, 0.4) 50%, #333333); }
    .skill[data-skill="delivery"] { background: linear-gradient(to bottom, rgba(0, 150, 150, 0.4), rgba(0, 150, 150, 0.4) 50%, #333333); }
    .skill[data-skill="ranching"] { background: linear-gradient(to bottom, rgba(247, 176, 106, 0.4), rgba(247, 176, 106, 0.4) 50%, #333333); }
    .skill[data-skill="knowledge"] { background: linear-gradient(to bottom, rgba(50, 50, 200, 0.4), rgba(50, 50, 200, 0.4) 50%, #333333); }
    .skill[data-skill="candlemaking"] { background: linear-gradient(to bottom, rgba(247, 159, 29, 0.45), rgba(247, 159, 29, 0.45) 50%, #333333); }
    .skill[data-skill="pottery"] { background: linear-gradient(to bottom, rgba(206, 43, 43, 0.4), rgba(206, 43, 43, 0.4) 50%, #333333); }
    .skill[data-skill="digging"] { background: linear-gradient(to bottom, rgba(139, 69, 19, 0.45), rgba(139, 69, 19, 0.45) 50%, #333333); }
    .skill[data-skill="diplomacy"] { background: linear-gradient(to bottom, rgba(70, 130, 180, 0.45), rgba(70, 130, 180, 0.45) 50%, #333333); }

    .skill[data-skill="apiary"] {background: linear-gradient(to bottom, rgba(255, 229, 113, 0.4), rgba(255, 229, 113, 0.4) 50%, #333333); }
    .skill[data-skill="engineering"] {background: linear-gradient(to bottom, rgba(61, 86, 97, 0.6), rgba(61, 86, 97, 0.6) 50%, #333333); }  
    .skill[data-skill="taming"] {background: linear-gradient(to bottom, rgba(52, 240, 124, 0.4), rgba(52, 240, 124, 0.4) 50%, #333333); }
    .skill[data-skill="dracology"] {background: linear-gradient(to bottom, rgba(255, 94, 121, 0.4), rgba(255, 94, 121, 0.4) 50%, #333333); }
}
  `;
  document.head.appendChild(styleElement);

  // Add click handlers to all skill level elements
  document.querySelectorAll('.skill-level').forEach(element => {
    const skillName = element.closest('.skill').dataset.skill;
    
    // Left click to increment
    element.addEventListener('click', (e) => {
      e.preventDefault();
      incrementSkill(skillName);
    });
    
    // Right click to decrement
    element.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      decrementSkill(skillName);
    });
  });
  
  // Add control button listeners
  document.querySelector('.control-btn[data-action="randomize"]')?.addEventListener('click', () => {
    randomizeSkills();
  });
  
  document.querySelector('.control-btn[data-action="reset"]')?.addEventListener('click', () => {
    resetSkills();
  });
  
  // Initialize skill displays
  updateAllSkillDisplays();
  updateTotalLevel();
}

function getTierClass(level) {
  if (level >= 99) return 'tier-diamond';
  if (level >= 85) return 'tier-ruby';
  if (level >= 75) return 'tier-emerald';
  if (level >= 65) return 'tier-sapphire';
  if (level >= 50) return 'tier-gold';
  if (level >= 35) return 'tier-silver';
  if (level >= 20) return 'tier-steel';
  return 'tier-iron';
}

function updateAllSkillDisplays() {
  Object.keys(skills).forEach(skillName => {
    updateSkillDisplay(skillName, skills[skillName]);
  });
}

function updateSkillDisplay(skillName, level, animate = false) {
  const skillElement = document.querySelector(`[data-skill="${skillName}"]`);
  if (!skillElement) return;
  
  const levelElement = skillElement.querySelector('.skill-level');
  const iconElement = skillElement.querySelector('.skill-icon');
  
  if (levelElement) {
    levelElement.textContent = level;
    
    // Add visual feedback
    if (animate) {
      levelElement.style.transform = 'scale(1.2)';
      setTimeout(() => {
        levelElement.style.transform = 'scale(1)';
      }, 150);
    }
  }
  
  if (iconElement) {
    // Remove all tier classes from icon
    iconElement.classList.remove(
      'tier-iron', 'tier-steel', 'tier-silver', 'tier-gold', 
      'tier-sapphire', 'tier-emerald', 'tier-ruby', 'tier-diamond'
    );
    
    // Add appropriate tier class to icon
    iconElement.classList.add(getTierClass(level));
    
    // Add text shadow for black outline
    iconElement.style.textShadow = '1px 1px 1px #000, -1px -1px 1px #000, 1px -1px 1px #000, -1px 1px 1px #000';
    
    // Add level-up animation if requested
    if (animate) {
      iconElement.classList.add('level-up');
      setTimeout(() => {
        iconElement.classList.remove('level-up');
      }, 300);
    }
  }
}

function calculateTotalLevel() {
  return Object.values(skills).reduce((sum, level) => sum + level, 0);
}

function updateTotalLevel() {
  const totalLevel = calculateTotalLevel();
  
  // Update total level in skills tab
  const totalElement = document.getElementById('totalLevel');
  if (totalElement) {
    totalElement.textContent = `Total Level: ${totalLevel}`;
  }
  
  // Also update header total level
  const totalLevelHeader = document.getElementById('total-level-header');
  if (totalLevelHeader) {
    totalLevelHeader.textContent = totalLevel;
  }
}

function incrementSkill(skillName) {
  const minLevel = skillName === 'hitpoints' ? 10 : 1;
  
  if (skills[skillName] < 99) {
    const oldTier = getTierClass(skills[skillName]);
    skills[skillName]++;
    const newTier = getTierClass(skills[skillName]);
    
    // Animate if tier changed
    const tierChanged = oldTier !== newTier;
    updateSkillDisplay(skillName, skills[skillName], tierChanged);
    updateTotalLevel();
  }
}

function decrementSkill(skillName) {
  const minLevel = skillName === 'hitpoints' ? 10 : 1;
  
  if (skills[skillName] > minLevel) {
    skills[skillName]--;
    updateSkillDisplay(skillName, skills[skillName]);
    updateTotalLevel();
  }
}

function randomizeSkills() {
  Object.keys(skills).forEach(skillName => {
    const minLevel = skillName === 'hitpoints' ? 10 : 1;
    const oldLevel = skills[skillName];
    skills[skillName] = Math.floor(Math.random() * 99) + minLevel;
    
    const animate = getTierClass(oldLevel) !== getTierClass(skills[skillName]);
    updateSkillDisplay(skillName, skills[skillName], animate);
  });
  
  updateTotalLevel();
}

function resetSkills() {
  Object.keys(skills).forEach(skillName => {
    skills[skillName] = skillName === 'hitpoints' ? 10 : 1;
    updateSkillDisplay(skillName, skills[skillName]);
  });
  
  updateTotalLevel();
}

// ---- Notification Functions ----

function showNotification(message, type = 'info', duration = 3000) {
  // Create notification element if it doesn't exist
  let notificationContainer = document.getElementById('notification-container');
  if (!notificationContainer) {
    notificationContainer = document.createElement('div');
    notificationContainer.id = 'notification-container';
    notificationContainer.style.position = 'fixed';
    notificationContainer.style.top = '20px';
    notificationContainer.style.right = '20px';
    notificationContainer.style.zIndex = '1000';
    document.body.appendChild(notificationContainer);
  }
  
  // Create notification
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  
  // Style the notification
  notification.style.backgroundColor = type === 'error' ? '#ff4444' : 
                                       type === 'success' ? '#44aa44' : '#4444aa';
  notification.style.color = 'white';
  notification.style.padding = '10px 15px';
  notification.style.borderRadius = '5px';
  notification.style.marginBottom = '10px';
  notification.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
  notification.style.transition = 'all 0.3s ease';
  notification.style.opacity = '0';
  
  // Add to container
  notificationContainer.appendChild(notification);
  
  // Fade in
  setTimeout(() => {
    notification.style.opacity = '1';
  }, 10);
  
  // Remove after duration
  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => {
      notificationContainer.removeChild(notification);
    }, 300);
  }, duration);
}

// ---- Additional Combat Functions ----

// Calculate combat level
function calculateCombatLevel() {
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

// ---- Game World Functions ----

// Game world configuration
const GRID_SIZE = 32; // Size of each grid cell in pixels
let WORLD_COLS = 100; // Default world size, will be updated from map data
let WORLD_ROWS = 100; // Default world size, will be updated from map data
const VIEWPORT_COLS = 30; // Visible area width in tiles (increased from 24, +25%)
const VIEWPORT_ROWS = 21; // Visible area height in tiles (increased from 16, +30%)

// Player state
let playerPosition = { x: 50, y: 50 }; // Start in the middle of the expanded world
let playerTarget = null; // Target position for movement
let isMoving = false;
let playerDirection = 'south'; // 'north', 'east', 'south', 'west', 'northeast', 'northwest', 'southeast', 'southwest'
let movementSpeed = 4; // Grid cells per second

// Camera state
let cameraPosition = { x: 50 - VIEWPORT_COLS / 2, y: 50 - VIEWPORT_ROWS / 2 }; // Use floating point for smooth movement
let lastCameraTilePosition = { x: -1, y: -1 }; // Track when camera moves to new tile for rendering optimization

// Movement queue for smooth pathfinding
let movementQueue = [];

// World grid elements - 0 is walkable, 1 is blocked, 2 is bank
let worldGrid = [];

// World objects
let worldObjects = [];
const OBJECT_TYPES = {
  BANK: 'bank'
};

// Game loop variables
let lastFrameTime = 0;
let animationFrameId = null;

// Initialize the game world
function initializeWorld() {
  console.log('Initializing world (fallback)...');
  
  // Get or create the world container
  let worldElement = document.getElementById('game-world');
  if (!worldElement) {
    worldElement = document.createElement('div');
    worldElement.id = 'game-world';
    worldElement.className = 'game-world';
    document.querySelector('#game-tab')?.appendChild(worldElement);
  } else {
    // Clear existing world
    worldElement.innerHTML = '';
  }
  
  // Set up the world container (viewport size, not world size)
  worldElement.style.width = `${GRID_SIZE * VIEWPORT_COLS}px`;
  worldElement.style.height = `${GRID_SIZE * VIEWPORT_ROWS}px`;
  worldElement.style.position = 'relative';
  worldElement.style.backgroundColor = '#5a8c3e'; // Grass color
  worldElement.style.overflow = 'hidden';
  worldElement.style.boxShadow = 'inset 0 0 10px rgba(0,0,0,0.3)';
  
  // Initialize the full world grid and world objects
  worldObjects = [];
  for (let y = 0; y < WORLD_ROWS; y++) {
    worldGrid[y] = [];
    for (let x = 0; x < WORLD_COLS; x++) {
      worldGrid[y][x] = 0; // Walkable
      
      // Add some random obstacles (but not at player start)
      if (Math.random() < 0.08 && !(x === playerPosition.x && y === playerPosition.y)) {
        worldGrid[y][x] = 1; // Blocked
      }
    }
  }
  
  // Add a bank near the player spawn
  const bankX = 52;
  const bankY = 48;
  worldGrid[bankY][bankX] = 2; // Bank tile
  worldObjects.push({
    type: OBJECT_TYPES.BANK,
    x: bankX,
    y: bankY,
    name: 'Bank chest',
    icon: '🏦'
  });
  
  // Create the player character
  const player = document.createElement('div');
  player.id = 'player-character';
  player.className = 'player-character';
  player.style.position = 'absolute';
  player.style.width = `${Math.round(GRID_SIZE * 0.67)}px`; // Reduced by 33%
  player.style.height = `${Math.round(GRID_SIZE * 0.67)}px`; // Reduced by 33%
  player.style.backgroundColor = '#3498db'; // Blue player
  player.style.borderRadius = '50%';
  player.style.transition = 'transform 0.2s ease';
  player.style.zIndex = '10';
  // Center the smaller player within the grid cell
  player.style.marginLeft = `${Math.round(GRID_SIZE * 0.165)}px`;
  player.style.marginTop = `${Math.round(GRID_SIZE * 0.165)}px`;
  worldElement.appendChild(player);
  
  // Update camera position and render initial view
  updateCamera();
  renderViewport(worldElement);
  
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
      
      if (objectType === OBJECT_TYPES.BANK) {
        handleBankClick(objectX, objectY);
      }
      return;
    }
    
    console.log('WORLD CLICK: Processing world movement click');
    
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
  
  // Add right-click context menu handler for empty ground
  worldElement.addEventListener('contextmenu', (e) => {
    // Check if this right-click was on a floor item (should be handled by floor item handler)
    if (e.target.classList.contains('floor-item') || e.target.closest('.floor-item')) {
      console.log('WORLD RIGHT-CLICK: Right-click on floor item detected, ignoring');
      return;
    }
    
    console.log('WORLD RIGHT-CLICK: Processing empty ground right-click');
    e.preventDefault();
    e.stopPropagation();
    
    const rect = worldElement.getBoundingClientRect();
    const viewportClickX = (e.clientX - rect.left) / GRID_SIZE;
    const viewportClickY = (e.clientY - rect.top) / GRID_SIZE;
    
    // Convert viewport coordinates to world coordinates using exact camera position
    const worldClickX = Math.floor(cameraPosition.x + viewportClickX);
    const worldClickY = Math.floor(cameraPosition.y + viewportClickY);
    
    // Only show context menu within world bounds
    if (worldClickX >= 0 && worldClickX < WORLD_COLS && worldClickY >= 0 && worldClickY < WORLD_ROWS) {
      console.log(`WORLD RIGHT-CLICK: Showing context menu for empty ground at: (${worldClickX}, ${worldClickY})`);
      showGroundContextMenu(e, worldClickX, worldClickY);
    }
  });
  
  // Start game loop
  startGameLoop();
  
  return worldElement;
}

// Update camera position to follow player
function updateCamera() {
  // Center camera on player with smooth floating-point positioning
  const targetCameraX = playerPosition.x - VIEWPORT_COLS / 2;
  const targetCameraY = playerPosition.y - VIEWPORT_ROWS / 2;
  
  // Clamp camera to world bounds (still using floating point)
  cameraPosition.x = Math.max(0, Math.min(WORLD_COLS - VIEWPORT_COLS, targetCameraX));
  cameraPosition.y = Math.max(0, Math.min(WORLD_ROWS - VIEWPORT_ROWS, targetCameraY));
  
  // Always render viewport for smooth scrolling (since obstacles use floating-point positioning)
  renderViewport(document.getElementById('game-world'));
  
  // Update floor item positions
  updateAllFloorItemPositions();
  
  // Update tracking position for optimization purposes
  lastCameraTilePosition = { x: Math.floor(cameraPosition.x), y: Math.floor(cameraPosition.y) };
}

// Render the visible portion of the world
function renderViewport(worldElement) {
  // Clear existing obstacles, world objects, and floor items
  const existingObstacles = worldElement.querySelectorAll('.obstacle');
  existingObstacles.forEach(obstacle => obstacle.remove());
  
  const existingWorldObjects = worldElement.querySelectorAll('.world-object');
  existingWorldObjects.forEach(obj => obj.remove());
  
  const existingFloorItems = worldElement.querySelectorAll('.floor-item');
  existingFloorItems.forEach(item => item.remove());
  
  // Update positions of any active click effects
  const activeClickEffects = worldElement.querySelectorAll('.click-effect');
  activeClickEffects.forEach(clickEffect => {
    updateClickEffectPosition(clickEffect);
  });
  
  // Use camera's exact floating-point position for smooth scrolling
  const cameraOffsetX = cameraPosition.x - Math.floor(cameraPosition.x);
  const cameraOffsetY = cameraPosition.y - Math.floor(cameraPosition.y);
  
  // Start from the tile that contains the camera position
  const startTileX = Math.floor(cameraPosition.x);
  const startTileY = Math.floor(cameraPosition.y);
  
  // Render one extra tile in each direction to handle partial visibility
  for (let viewY = -1; viewY <= VIEWPORT_ROWS; viewY++) {
    for (let viewX = -1; viewX <= VIEWPORT_COLS; viewX++) {
      const worldX = startTileX + viewX;
      const worldY = startTileY + viewY;
      
      // Check if this world position is within bounds
      if (worldX >= 0 && worldX < WORLD_COLS && worldY >= 0 && worldY < WORLD_ROWS) {
        
        // Render obstacles
        if (worldGrid[worldY][worldX] === 1) {
          // Create obstacle element
          const obstacle = document.createElement('div');
          obstacle.className = 'obstacle';
          obstacle.style.position = 'absolute';
          
          // Position relative to camera's exact position for smooth scrolling
          const screenX = (viewX - cameraOffsetX) * GRID_SIZE;
          const screenY = (viewY - cameraOffsetY) * GRID_SIZE;
          
          obstacle.style.left = `${screenX}px`;
          obstacle.style.top = `${screenY}px`;
          obstacle.style.width = `${GRID_SIZE}px`;
          obstacle.style.height = `${GRID_SIZE}px`;
          obstacle.style.backgroundColor = '#654321'; // Brown for obstacles
          worldElement.appendChild(obstacle);
        }
        
        // Render world objects (banks, etc.)
        const objectAtPosition = worldObjects.find(obj => obj.x === worldX && obj.y === worldY);
        if (objectAtPosition) {
          const objectElement = document.createElement('div');
          objectElement.className = 'world-object';
          objectElement.dataset.type = objectAtPosition.type;
          objectElement.dataset.x = worldX;
          objectElement.dataset.y = worldY;
          objectElement.style.position = 'absolute';
          
          // Position relative to camera's exact position for smooth scrolling
          const screenX = (viewX - cameraOffsetX) * GRID_SIZE;
          const screenY = (viewY - cameraOffsetY) * GRID_SIZE;
          
          objectElement.style.left = `${screenX}px`;
          objectElement.style.top = `${screenY}px`;
          objectElement.style.width = `${GRID_SIZE}px`;
          objectElement.style.height = `${GRID_SIZE}px`;
          objectElement.style.display = 'flex';
          objectElement.style.alignItems = 'center';
          objectElement.style.justifyContent = 'center';
          objectElement.style.fontSize = '24px';
          objectElement.style.cursor = 'pointer';
          objectElement.style.zIndex = '5';
          objectElement.style.transition = 'transform 0.2s';
          objectElement.innerHTML = objectAtPosition.icon;
          objectElement.title = objectAtPosition.name;
          
          // Add hover effect
          objectElement.addEventListener('mouseenter', () => {
            objectElement.style.transform = 'scale(1.1)';
          });
          
          objectElement.addEventListener('mouseleave', () => {
            objectElement.style.transform = 'scale(1)';
          });
          
          worldElement.appendChild(objectElement);
        }
        
        // Render floor items at this position
        const itemsAtPosition = getFloorItemsAt(worldX, worldY);
        itemsAtPosition.forEach(floorItem => {
          const itemDef = itemDefinitions[floorItem.item.id];
          if (itemDef) {
            // Create floor item element
            const itemElement = document.createElement('div');
            itemElement.className = 'floor-item';
            
            // Apply color tinting if the item has a colorTint property
            if (itemDef.colorTint) {
              itemElement.classList.add('tinted');
              itemElement.style.color = itemDef.colorTint;
            }
            
            itemElement.innerHTML = itemDef.icon;
            itemElement.dataset.floorItemId = floorItem.id;
            itemElement.style.position = 'absolute';
            itemElement.style.width = `${GRID_SIZE}px`;
            itemElement.style.height = `${GRID_SIZE}px`;
            itemElement.style.display = 'flex';
            itemElement.style.alignItems = 'center';
            itemElement.style.justifyContent = 'center';
            itemElement.style.fontSize = '20px';
            itemElement.style.cursor = 'pointer';
            itemElement.style.zIndex = '10'; // Higher z-index to ensure it's on top
            itemElement.style.backgroundColor = 'transparent'; // Explicitly transparent
            itemElement.style.borderRadius = '4px';
            itemElement.style.transition = 'transform 0.2s';
            itemElement.style.pointerEvents = 'auto'; // Ensure pointer events work
            
            // Add item name as tooltip for debugging
            itemElement.title = `${itemDef.name} (Click to pick up, Right-click for options)`;
            
            // Position relative to camera's exact position for smooth scrolling
            const screenX = (viewX - cameraOffsetX) * GRID_SIZE;
            const screenY = (viewY - cameraOffsetY) * GRID_SIZE;
            
            itemElement.style.left = `${screenX}px`;
            itemElement.style.top = `${screenY}px`;
            
            // Add hover effect
            itemElement.addEventListener('mouseenter', () => {
              itemElement.style.transform = 'scale(1.2)';
              console.log('HOVER: Floor item hovered -', itemDef.name, floorItem.id);
            });
            
            itemElement.addEventListener('mouseleave', () => {
              itemElement.style.transform = 'scale(1)';
            });
            
            // Add both mouse and touch handlers for consistent behavior
            let lastInteraction = 0;
            const handlePickup = (e) => {
              // IMPORTANT: Only respond to left-clicks, not right-clicks
              if (e.type === 'mousedown' && e.button !== 0) {
                // Not a left-click mousedown, ignore
                console.log('PICKUP: Non-left-click mousedown ignored, button:', e.button);
                return;
              }
              
              if (e.type === 'click' && e.button !== 0) {
                // Not a left-click, ignore
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
              
              // Use OSRS-style walk-to-pickup for left-click (but original behavior for right-click context menu)
              console.log('PICKUP: Using OSRS-style walk-to-pickup logic');
              
              // Check if player is close enough for direct pickup
              const playerX = Math.floor(playerPosition.x);
              const playerY = Math.floor(playerPosition.y);
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
                pickupFloorItem(floorItem.id);
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
              showFloorItemContextMenu(e, worldX, worldY);
              
              return false;
            });
            
            worldElement.appendChild(itemElement);
          }
        });
      }
    }
  }
}

// Find path from player to target
function findPath(startX, startY, endX, endY) {
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
  
  // If the target is blocked, we can't path to it
  if (worldGrid[endTileY][endTileX] === 1) {
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
  
  // BFS algorithm
  while (queue.length > 0 && !targetFound) {
    const current = queue.shift();
    const currentKey = `${current.x},${current.y}`;
    
    // Check if we reached the target
    if (current.x === endTileX && current.y === endTileY) {
      targetFound = true;
      break;
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
      if (worldGrid[newY][newX] === 1) {
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
  
  // Reconstruct path
  const path = [];
  let currentKey = endKey;
  
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
  const horizontalBlocked = horizontalInBounds && worldGrid[horizontalTileY][horizontalTileX] === 1;
  const verticalBlocked = verticalInBounds && worldGrid[verticalTileY][verticalTileX] === 1;
  
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
        worldGrid[newTargetY][newTargetX] === 0) {
      
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
  if (!lastFrameTime) lastFrameTime = timestamp;
  const deltaTime = (timestamp - lastFrameTime) / 1000; // Convert to seconds
  lastFrameTime = timestamp;
  
  updatePlayerMovement(deltaTime);
  
  // Update camera every frame for smooth following
  updateCamera();
  
  // Update player visual position every frame
  updatePlayerVisualPosition();
  
  // Continue the game loop
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
    
    // If queue is empty, stop moving
    if (movementQueue.length === 0) {
      isMoving = false;
      
      // Check if we have a pickup target at this location
      if (window.pickupTarget && 
          Math.abs(playerPosition.x - window.pickupTarget.x) < 1.5 && 
          Math.abs(playerPosition.y - window.pickupTarget.y) < 1.5) {
        
        console.log('MOVEMENT COMPLETE: Attempting auto-pickup for', window.pickupTarget.itemId);
        
        // Try to pickup the item
        pickupFloorItem(window.pickupTarget.itemId);
        
        // Clear the pickup target
        window.pickupTarget = null;
      }
    }
    return;
  }
  
  // Calculate movement direction
  let dx = 0;
  let dy = 0;
  
  if (playerPosition.x < nextTarget.x) {
    dx = Math.min(movementSpeed * deltaTime, nextTarget.x - playerPosition.x);
  } else if (playerPosition.x > nextTarget.x) {
    dx = Math.max(-movementSpeed * deltaTime, nextTarget.x - playerPosition.x);
  }
  
  if (playerPosition.y < nextTarget.y) {
    dy = Math.min(movementSpeed * deltaTime, nextTarget.y - playerPosition.y);
  } else if (playerPosition.y > nextTarget.y) {
    dy = Math.max(-movementSpeed * deltaTime, nextTarget.y - playerPosition.y);
  }
  
  // Update player position
  playerPosition.x += dx;
  playerPosition.y += dy;
  
  // Update player direction based on movement
  updatePlayerDirection(dx, dy);
  
  // Update player appearance based on direction
  const player = document.getElementById('player-character');
  if (player) {
    updatePlayerAppearance(player, playerDirection);
  }
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
  } else if (dy > 0) {
    playerDirection = 'south';
  } else if (dy < 0) {
    playerDirection = 'north';
  }
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
  
  // Visual indication of direction
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

// Reset or cleanup the world
function resetWorld() {
  stopGameLoop();
  movementQueue = [];
  isMoving = false;
  playerPosition = { x: 50, y: 50 }; // Reset to starting position
  cameraPosition = { x: 50 - VIEWPORT_COLS / 2, y: 50 - VIEWPORT_ROWS / 2 }; // Reset camera
  lastCameraTilePosition = { x: -1, y: -1 }; // Reset camera tracking
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

// ---- Inventory System Functions ----

// Inventory configuration
const INVENTORY_SIZE = 28;
const ITEM_SPAWN_INTERVAL = 5000; // 5 seconds (reduced for testing)
const MAX_FLOOR_ITEMS = 20;
const ITEM_DESPAWN_TIME = 300000; // 5 minutes

// Player inventory
let playerInventory = new Array(INVENTORY_SIZE).fill(null);

// Bank storage - larger capacity with all items stackable
const BANK_SIZE = 500; // Large bank capacity like OSRS
let bankStorage = new Array(BANK_SIZE).fill(null);
let bankInterface = {
  open: false,
  selectedSlot: -1,
  selectedItem: null
};

// Floor items array
let floorItems = [];

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

// Item spawning timer
let itemSpawnTimer = null;

// Item definitions
const itemDefinitions = {
  coins: {
    id: 'coins',
    name: 'Coins',
    icon: '🪙',
    stackable: true,
    description: 'Shiny gold coins used as currency.',
    useAction: 'count',
    rarity: 0.3,
    // Dynamic icon based on stack size
    getIcon: function(quantity) {
      if (quantity >= 100) return '💰'; // Money bag for 100+
      return '🪙'; // Regular coin for less than 100
    }
  },
  apple: {
    id: 'apple',
    name: 'Apple',
    icon: '🍎',
    stackable: false,
    description: 'A crisp red apple. Looks delicious!',
    useAction: 'eat',
    rarity: 0.2
  },
  sword: {
    id: 'sword',
    name: 'Iron Sword',
    icon: '⚔️',
    stackable: false,
    description: 'A sturdy iron sword. Good for combat.',
    useAction: 'wield',
    rarity: 0.1
  },
  potion: {
    id: 'potion',
    name: 'Health Potion',
    icon: '🧪',
    stackable: false,
    description: 'A red potion that restores health.',
    useAction: 'drink',
    rarity: 0.15
  },
  gem: {
    id: 'gem',
    name: 'Ruby',
    icon: '🔴',
    stackable: false,
    description: 'A precious red gem that sparkles in the light.',
    useAction: 'examine',
    rarity: 0.05,
    colorTint: '#dc2626' // Red tint for ruby
  },
  sapphire: {
    id: 'sapphire',
    name: 'Sapphire',
    icon: '🔵',
    stackable: false,
    description: 'A brilliant blue gem with a deep azure glow.',
    useAction: 'examine',
    rarity: 0.05,
    colorTint: '#2563eb' // Blue tint for sapphire
  },
  emerald: {
    id: 'emerald',
    name: 'Emerald',
    icon: '🟢',
    stackable: false,
    description: 'A vibrant green gem with an enchanting shine.',
    useAction: 'examine',
    rarity: 0.05,
    colorTint: '#16a34a' // Green tint for emerald
  },
  diamond: {
    id: 'diamond',
    name: 'Diamond',
    icon: '💎',
    stackable: false,
    description: 'A flawless crystal that refracts light beautifully.',
    useAction: 'examine',
    rarity: 0.03,
    colorTint: '#f8fafc' // Light white/silver tint for diamond
  },
  key: {
    id: 'key',
    name: 'Brass Key',
    icon: '🗝️',
    stackable: false,
    description: 'An old brass key. I wonder what it unlocks?',
    useAction: 'use',
    rarity: 0.08
  },
  book: {
    id: 'book',
    name: 'Ancient Book',
    icon: '📖',
    stackable: false,
    description: 'A dusty old book with mysterious writing.',
    useAction: 'read',
    rarity: 0.07
  },
  mushroom: {
    id: 'mushroom',
    name: 'Red Mushroom',
    icon: '🍄',
    stackable: false,
    description: 'A red mushroom. Might be useful for alchemy.',
    useAction: 'eat',
    rarity: 0.12
  },
  chisel: {
    id: 'chisel',
    name: 'Chisel',
    icon: '🔨',
    stackable: false,
    description: 'A sharp chisel for cutting gems.',
    useAction: 'use',
    rarity: 0.06
  },
  uncut_gem: {
    id: 'uncut_gem',
    name: 'Uncut Ruby',
    icon: '🟥',
    stackable: false,
    description: 'A rough, uncut ruby. Needs to be cut.',
    useAction: 'use',
    rarity: 0.04
  },
  uncut_sapphire: {
    id: 'uncut_sapphire',
    name: 'Uncut Sapphire',
    icon: '🟦',
    stackable: false,
    description: 'A rough, uncut sapphire. Needs to be cut.',
    useAction: 'use',
    rarity: 0.04
  },
  uncut_emerald: {
    id: 'uncut_emerald',
    name: 'Uncut Emerald',
    icon: '🟩',
    stackable: false,
    description: 'A rough, uncut emerald. Needs to be cut.',
    useAction: 'use',
    rarity: 0.04
  },
  uncut_diamond: {
    id: 'uncut_diamond',
    name: 'Uncut Diamond',
    icon: '⬜',
    stackable: false,
    description: 'A rough, uncut diamond. Needs to be cut.',
    useAction: 'use',
    rarity: 0.03
  }
};

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

// Initialize inventory system
function initializeInventory() {
  console.log('Initializing inventory system (fallback)...');
  
  // Create inventory UI
  createInventoryUI();
  
  // Start item spawning - DISABLED to prevent random item clutter
  // startItemSpawning();
  
  // Add click handlers for floor items
  setupFloorItemHandlers();
  
  // Add manual spawn button for testing
  const spawnBtn = document.getElementById('spawn-item-btn');
  if (spawnBtn) {
    spawnBtn.addEventListener('click', () => {
      console.log('Manual spawn button clicked');
      spawnItemNearPlayer();
    });
  }
  
  // Add manual inventory add button for testing
  const addBtn = document.getElementById('add-item-btn');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      console.log('Manual add to inventory button clicked');
      addRandomItemToInventory();
    });
  }
  
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
        <div class="test-buttons">
          <button id="spawn-item-btn" style="padding: 5px 10px; background: #4a7c59; color: white; border: none; border-radius: 3px; cursor: pointer; margin-right: 5px;">Spawn Item</button>
          <button id="add-item-btn" style="padding: 5px 10px; background: #7c4a59; color: white; border: none; border-radius: 3px; cursor: pointer;">Add to Inventory</button>
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
      grid-template-columns: repeat(4, 1fr);
      grid-template-rows: repeat(7, 1fr);
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
      bottom: -5px;
      right: 2px;
      color: white;
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
      background-color: transparent;
      border-radius: 4px;
      transition: transform 0.2s;
      outline: 1px solid rgba(255, 255, 255, 0);
    }
    
    .floor-item:hover {
      transform: scale(1.1);
      outline: 2px solid rgba(255, 255, 255, 1);
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
    
    /* Color tints for gemstones */
    .inventory-item.tinted {
      filter: brightness(1.3) saturate(1.8) contrast(1.2);
      text-shadow: 0 0 4px currentColor;
    }
    
    .floor-item.tinted {
      filter: brightness(1.3) saturate(1.8) contrast(1.2);
      text-shadow: 0 0 4px currentColor;
    }
  `;
  document.head.appendChild(styleSheet);
}

// Setup inventory event handlers
function setupInventoryHandlers() {
  const inventoryGrid = document.getElementById('inventory-grid');
  const contextMenu = document.getElementById('inventory-context-menu');
  
  if (!inventoryGrid || !contextMenu) return;
  
  // Left click performs top priority action for each item
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
    
    // Regular click performs the top priority action
    useItem(slotIndex);
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
    
    // Don't start drag if shift is held (for quick drop)
    if (e.shiftKey) return;
    
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
  const contextMenu = document.getElementById('inventory-context-menu');
  const consumeOption = document.getElementById('consume-option');
  if (!contextMenu) return;
  
  const item = playerInventory[slotIndex];
  const itemDef = item ? itemDefinitions[item.id] : null;
  
  // Show/hide consume option based on item type
  if (consumeOption && itemDef) {
    if (itemDef.useAction === 'eat' || itemDef.useAction === 'drink') {
      consumeOption.style.display = 'block';
      consumeOption.textContent = itemDef.useAction === 'eat' ? 'Eat' : 'Drink';
    } else {
      consumeOption.style.display = 'none';
    }
  }
  
  contextMenu.style.display = 'block';
  contextMenu.style.left = `${event.pageX}px`;
  contextMenu.style.top = `${event.pageY}px`;
  contextMenu.dataset.slot = slotIndex;
}

// Hide context menu
function hideContextMenu() {
  const contextMenu = document.getElementById('inventory-context-menu');
  if (contextMenu) {
    contextMenu.style.display = 'none';
    delete contextMenu.dataset.slot;
  }
}

// Handle context menu actions
function handleContextAction(action, slotIndex) {
  const item = playerInventory[slotIndex];
  if (!item) return;
  
  switch (action) {
    case 'consume':
      useItem(slotIndex);
      break;
    case 'use':
      useItem(slotIndex);
      break;
    case 'drop':
      dropItem(slotIndex);
      break;
  }
}

// Use an item
function useItem(slotIndex) {
  const item = playerInventory[slotIndex];
  if (!item) return;
  
  const itemDef = itemDefinitions[item.id];
  if (!itemDef) return;
  
  let message = `You use the ${itemDef.name}.`;
  
  switch (itemDef.useAction) {
    case 'eat':
      message = `You eat the ${itemDef.name}. It tastes good!`;
      removeItemFromInventory(slotIndex);
      break;
    case 'drink':
      message = `You drink the ${itemDef.name}. You feel refreshed!`;
      removeItemFromInventory(slotIndex);
      break;
    case 'read':
      message = `You read the ${itemDef.name}. The text is in an ancient language.`;
      break;
    case 'count':
      message = `You have ${item.quantity || 1} ${itemDef.name}.`;
      break;
    case 'wield':
      message = `You wield the ${itemDef.name}. You feel more powerful!`;
      break;
    default:
      message = `You examine the ${itemDef.name}.`;
  }
  
  showNotification(message);
}

// Drop an item
function dropItem(slotIndex) {
  const item = playerInventory[slotIndex];
  if (!item) return;
  
  // Round player position to nearest tile coordinates for item placement
  const dropX = Math.round(playerPosition.x);
  const dropY = Math.round(playerPosition.y);
  
  // Check if there are existing items at this location
  const existingItems = getFloorItemsAt(dropX, dropY);
  const itemDef = itemDefinitions[item.id];
  
  // If the item is stackable, check for existing stackable items of the same type
  if (itemDef && itemDef.stackable) {
    const existingStackableItem = existingItems.find(floorItem => 
      floorItem.item.id === item.id && itemDefinitions[floorItem.item.id].stackable
    );
    
    if (existingStackableItem) {
      // Combine with existing stack
      existingStackableItem.item.quantity = (existingStackableItem.item.quantity || 1) + (item.quantity || 1);
      
      // Remove the entire stack from inventory
      playerInventory[slotIndex] = null;
      updateInventoryDisplay();
      
      // Refresh floor items display immediately (stacking doesn't call createFloorItem)
      updateAllFloorItemPositions();
      
      const quantityText = item.quantity > 1 ? ` (${item.quantity})` : '';
      const totalQuantity = existingStackableItem.item.quantity;
      showNotification(`You drop the ${itemDef.name}${quantityText}. Total on ground: ${totalQuantity}.`);
      return;
    }
  }
  
  // No existing stackable item found, create new floor item (refreshes automatically)
  createFloorItem(item, dropX, dropY);
  
  // Remove the entire stack from inventory (not just 1 count)
  playerInventory[slotIndex] = null;
  updateInventoryDisplay();
  
  const quantityText = item.quantity > 1 ? ` (${item.quantity})` : '';
  showNotification(`You drop the ${itemDef ? itemDef.name : 'item'}${quantityText}.`);
}

// Examine an item
function examineItem(slotIndex) {
  const item = playerInventory[slotIndex];
  if (!item) return;
  
  const itemDef = itemDefinitions[item.id];
  if (!itemDef) return;
  
  showNotification(`${itemDef.name}: ${itemDef.description}`);
}

// Show tooltip
function showTooltip(event, item) {
  hideTooltip(); // Remove any existing tooltip
  
  const itemDef = itemDefinitions[item.id];
  if (!itemDef) return;
  
  const tooltip = document.createElement('div');
  tooltip.className = 'item-tooltip';
  tooltip.innerHTML = `
    <div class="item-name">${itemDef.name}</div>
    <div class="item-description">${itemDef.description}</div>
    ${item.quantity && item.quantity > 1 ? `<div>Quantity: ${item.quantity}</div>` : ''}
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
function addItemToInventory(itemId, quantity = 1) {
  const itemDef = itemDefinitions[itemId];
  if (!itemDef) return false;
  
  // Check if item is stackable and already exists
  if (itemDef.stackable) {
    const existingSlot = playerInventory.findIndex(item => item && item.id === itemId);
    if (existingSlot !== -1) {
      playerInventory[existingSlot].quantity = (playerInventory[existingSlot].quantity || 1) + quantity;
      updateInventoryDisplay();
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
  return true;
}

// Remove item from inventory
function removeItemFromInventory(slotIndex) {
  if (slotIndex < 0 || slotIndex >= playerInventory.length) return;
  
  const item = playerInventory[slotIndex];
  if (!item) return;
  
  const itemDef = itemDefinitions[item.id];
  
  if (itemDef && itemDef.stackable && item.quantity > 1) {
    item.quantity--;
  } else {
    playerInventory[slotIndex] = null;
  }
  
  updateInventoryDisplay();
}

// Update inventory display
function updateInventoryDisplay() {
  const inventoryGrid = document.getElementById('inventory-grid');
  const inventoryCount = document.getElementById('inventory-count');
  
  if (!inventoryGrid) return;
  
  // Update slots
  const slots = inventoryGrid.querySelectorAll('.inventory-slot');
  slots.forEach((slot, index) => {
    const item = playerInventory[index];
    
    if (item) {
      const itemDef = itemDefinitions[item.id];
      if (itemDef) {
        slot.classList.add('occupied');
        const tintStyle = itemDef.colorTint ? `color: ${itemDef.colorTint};` : '';
        const tintClass = itemDef.colorTint ? 'tinted' : '';
        
        // Use dynamic icon if available (for coins), otherwise use default icon
        const icon = itemDef.getIcon ? itemDef.getIcon(item.quantity || 1) : itemDef.icon;
        
        slot.innerHTML = `
          <div class="inventory-item ${tintClass}" style="${tintStyle}">
            ${icon}
            ${itemDef.stackable && item.quantity > 1 ? 
              `<div class="inventory-item-count">${item.quantity}</div>` : ''
            }
          </div>
        `;
      }
    } else {
      slot.classList.remove('occupied');
      slot.innerHTML = '';
    }
  });
  
  // Update count
  const itemCount = playerInventory.filter(item => item).length;
  if (inventoryCount) {
    inventoryCount.textContent = itemCount;
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
  const x = Math.floor(Math.random() * WORLD_COLS);
  const y = Math.floor(Math.random() * WORLD_ROWS);
  
  console.log(`Trying to spawn at position: (${x}, ${y})`);
  
  // Check if position is walkable
  if (worldGrid[y][x] !== 0) {
    console.log(`Position (${x}, ${y}) is not walkable, skipping spawn`);
    return;
  }
  
  // Determine quantity for stackable items
  let quantity = 1;
  const itemDef = itemDefinitions[itemId];
  if (itemDef && itemDef.stackable && itemId === 'coins') {
    quantity = Math.floor(Math.random() * 50) + 1; // 1-50 coins
  }
  
  console.log(`Spawning ${quantity} ${itemDef.name}(s) at (${x}, ${y})`);
  createFloorItem({ id: itemId, quantity }, x, y);
}

// Get random item ID based on rarity
function getRandomItemId() {
  const items = Object.keys(itemDefinitions);
  const totalWeight = items.reduce((sum, id) => sum + itemDefinitions[id].rarity, 0);
  
  let random = Math.random() * totalWeight;
  
  for (const itemId of items) {
    random -= itemDefinitions[itemId].rarity;
    if (random <= 0) {
      return itemId;
    }
  }
  
  return items[0]; // Fallback
}

// Create floor item
function createFloorItem(item, x, y) {
  const itemDef = itemDefinitions[item.id];
  if (!itemDef) return;
  
  // Check if there are existing items at this location
  const existingItems = getFloorItemsAt(x, y);
  
  // If the item is stackable, check for existing stackable items of the same type
  if (itemDef.stackable) {
    const existingStackableItem = existingItems.find(floorItem => 
      floorItem.item.id === item.id && itemDefinitions[floorItem.item.id].stackable
    );
    
    if (existingStackableItem) {
      // Combine with existing stack
      existingStackableItem.item.quantity = (existingStackableItem.item.quantity || 1) + (item.quantity || 1);
      console.log(`Combined ${item.quantity || 1} ${itemDef.name}(s) with existing stack at (${x}, ${y}). New total: ${existingStackableItem.item.quantity}`);
      
      // Refresh floor items display immediately after stacking
      updateAllFloorItemPositions();
      return; // Don't create a new floor item, just combined with existing
    }
  }
  
  // No existing stackable item found or item is not stackable, create new floor item
  const floorItem = {
    id: generateItemId(),
    item: item,
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
  
  console.log(`Spawned ${itemDef.name} at (${x}, ${y})`);
  
  // Refresh floor items display immediately after creating new item
  updateAllFloorItemPositions();
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
  console.log('Current floor items:', floorItems);
  
  const floorItem = floorItems.find(item => item.id === floorItemId);
  if (!floorItem) {
    console.error('PICKUP ERROR: No floor item found with ID:', floorItemId);
    return;
  }
  
  console.log('PICKUP: Found floor item:', floorItem);
  
  const itemDef = itemDefinitions[floorItem.item.id];
  if (!itemDef) {
    console.error('PICKUP ERROR: No item definition found for:', floorItem.item.id);
    return;
  }
  
  console.log('PICKUP: Found item definition:', itemDef);
  
  // Check if player is close enough
  // Convert to integer coordinates for distance calculation
  const playerX = Math.floor(playerPosition.x);
  const playerY = Math.floor(playerPosition.y);
  const itemX = Math.floor(floorItem.x);
  const itemY = Math.floor(floorItem.y);
  
  const distance = Math.abs(playerX - itemX) + Math.abs(playerY - itemY);
  console.log(`PICKUP: Distance check - Player(${playerX}, ${playerY}) -> Item(${itemX}, ${itemY}), Distance: ${distance}`);
  
  if (distance > 1) {
    console.log('PICKUP: Too far away, showing error message');
    showNotification('You need to be closer to pick that up!', 'error');
    return;
  }
  
  console.log('PICKUP: Distance OK, attempting to add to inventory');
  
  // Try to add to inventory
  const addResult = addItemToInventory(floorItem.item.id, floorItem.item.quantity);
  console.log('PICKUP: Add to inventory result:', addResult);
  
  if (addResult) {
    console.log('PICKUP: Successfully added to inventory, removing from floor');
    // Remove from floor
    removeFloorItem(floorItemId);
    
    showNotification(`You pick up ${floorItem.item.quantity > 1 ? 
      `${floorItem.item.quantity} ` : ''}${itemDef.name}${floorItem.item.quantity > 1 ? 's' : ''}.`);
    console.log('PICKUP: Pickup complete!');
  } else {
    console.log('PICKUP: Failed to add to inventory (probably full)');
  }
}

// Remove floor item
function removeFloorItem(floorItemId) {
  const index = floorItems.findIndex(item => item.id === floorItemId);
  if (index === -1) return;
  
  floorItems.splice(index, 1);
}

// Despawn floor item
function despawnFloorItem(floorItemId) {
  removeFloorItem(floorItemId);
}

// Generate unique item ID
function generateItemId() {
  return 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
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
  
  // Try to find a walkable position near the player (within 3 tiles)
  const maxAttempts = 10;
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    // Random offset within 3 tiles
    const offsetX = Math.floor(Math.random() * 7) - 3; // -3 to +3
    const offsetY = Math.floor(Math.random() * 7) - 3; // -3 to +3
    
    const spawnX = Math.floor(playerPosition.x) + offsetX;
    const spawnY = Math.floor(playerPosition.y) + offsetY;
    
    // Check if position is within world bounds and walkable
    if (spawnX >= 0 && spawnX < WORLD_COLS && 
        spawnY >= 0 && spawnY < WORLD_ROWS &&
        worldGrid[spawnY][spawnX] === 0) {
      
      // Get random item
      const itemId = getRandomItemId();
      if (!itemId) {
        console.log('Failed to get random item ID');
        return;
      }
      
      // Determine quantity for stackable items
      let quantity = 1;
      const itemDef = itemDefinitions[itemId];
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
  const itemDef = itemDefinitions[itemId];
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

// Get floor items at a specific world position
function getFloorItemsAt(x, y) {
  return floorItems.filter(item => item.x === x && item.y === y);
}

// Show floor item context menu
function showFloorItemContextMenu(event, worldX, worldY) {
  // Remove any existing context menu
  hideFloorItemContextMenu();
  
  // Get all items at this position
  const itemsAtPosition = getFloorItemsAt(worldX, worldY);
  
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
    const itemDef = itemDefinitions[floorItem.item.id];
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
      const playerX = Math.floor(playerPosition.x);
      const playerY = Math.floor(playerPosition.y);
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
        pickupFloorItem(floorItem.id);
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
        showNotification(`${itemDef.name}: ${itemDef.description}`);
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
}

// Hide context menu when clicking elsewhere
document.addEventListener('click', (e) => {
  if (!e.target.closest('#floor-item-context-menu')) {
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

// Create drag preview element
function createDragPreview(item, x, y) {
  const itemDef = itemDefinitions[item.id];
  if (!itemDef) return;
  
  // Remove any existing drag preview
  removeDragPreview();
  
  const dragPreview = document.createElement('div');
  dragPreview.className = 'drag-preview';
  dragPreview.id = 'drag-preview';
  
  // Apply color tinting if the item has a colorTint property
  const tintClass = itemDef.colorTint ? 'tinted' : '';
  const tintStyle = itemDef.colorTint ? `color: ${itemDef.colorTint};` : '';
  
  // Use dynamic icon if available (for coins), otherwise use default icon
  const icon = itemDef.getIcon ? itemDef.getIcon(item.quantity || 1) : itemDef.icon;
  
  dragPreview.innerHTML = `
    <div class="inventory-item ${tintClass}" style="${tintStyle}">
      ${icon}
      ${itemDef.stackable && item.quantity > 1 ? 
        `<div class="inventory-item-count">${item.quantity}</div>` : ''
      }
    </div>
  `;
  
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

// Handle bank click
function handleBankClick(bankX, bankY) {
  console.log(`BANK: Bank clicked at (${bankX}, ${bankY})`);
  
  // Check if player is close enough to use the bank
  const playerX = Math.floor(playerPosition.x);
  const playerY = Math.floor(playerPosition.y);
  const distance = Math.abs(playerX - bankX) + Math.abs(playerY - bankY);
  
  console.log(`BANK: Distance check - Player(${playerX}, ${playerY}) -> Bank(${bankX}, ${bankY}), Distance: ${distance}`);
  
  if (distance > 2) {
    // Too far - walk to bank first
    console.log('BANK: Too far away, walking to bank first');
    window.bankTarget = { x: bankX, y: bankY };
    // Find a walkable position next to the bank
    const positions = [
      { x: bankX - 1, y: bankY },
      { x: bankX + 1, y: bankY },
      { x: bankX, y: bankY - 1 },
      { x: bankX, y: bankY + 1 }
    ];
    
    for (const pos of positions) {
      if (pos.x >= 0 && pos.x < WORLD_COLS && pos.y >= 0 && pos.y < WORLD_ROWS && worldGrid[pos.y][pos.x] === 0) {
        movePlayerToTarget(pos.x, pos.y);
        break;
      }
    }
  } else {
    // Close enough - open bank interface
    console.log('BANK: Close enough, opening bank interface');
    openBank();
  }
}

// Open bank interface
function openBank() {
  console.log('BANK: Opening bank interface');
  
  // Create bank overlay if it doesn't exist
  let bankOverlay = document.getElementById('bank-overlay');
  if (!bankOverlay) {
    bankOverlay = createBankInterface();
  }
  
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
          <div class="bank-grid" id="bank-grid">
            ${Array(Math.min(BANK_SIZE, 200)).fill().map((_, i) => 
              `<div class="bank-slot" data-slot="${i}"></div>`
            ).join('')}
          </div>
          <div class="bank-actions">
            <button class="bank-button" id="deposit-all-btn">Deposit All</button>
            <button class="bank-button" id="deposit-inventory-btn">Deposit Inventory</button>
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
            <button class="bank-button" id="withdraw-all-btn">Withdraw All</button>
            <button class="bank-button" id="withdraw-noted-btn" disabled>Withdraw Noted</button>
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
  const bankGrid = document.getElementById('bank-grid');
  const bankInventoryGrid = document.getElementById('bank-inventory-grid');
  
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
        depositItemToBank(i);
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
        depositItemToBank(i);
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
    const item = bankStorage[slotIndex];
    
    if (item) {
      withdrawItemFromBank(slotIndex);
      updateBankDisplay();
      updateBankInventoryDisplay();
      updateInventoryDisplay();
    }
  });
  
  // Bank inventory grid clicks (deposit items)
  bankInventoryGrid.addEventListener('click', (e) => {
    const slot = e.target.closest('.bank-inventory-slot');
    if (!slot) return;
    
    const slotIndex = parseInt(slot.dataset.slot);
    const item = playerInventory[slotIndex];
    
    if (item) {
      depositItemToBank(slotIndex);
      updateBankDisplay();
      updateBankInventoryDisplay();
      updateInventoryDisplay();
    }
  });
}

// Close bank interface
function closeBank() {
  console.log('BANK: Closing bank interface');
  
  const bankOverlay = document.getElementById('bank-overlay');
  if (bankOverlay) {
    bankOverlay.style.display = 'none';
  }
  
  bankInterface.open = false;
  bankInterface.selectedSlot = -1;
  bankInterface.selectedItem = null;
}

// Deposit item to bank
function depositItemToBank(inventorySlot) {
  const item = playerInventory[inventorySlot];
  if (!item) return false;
  
  const itemDef = itemDefinitions[item.id];
  if (!itemDef) return false;
  
  console.log(`BANK: Depositing ${item.quantity || 1} ${itemDef.name}(s) to bank`);
  
  // In the bank, ALL items become stackable (OSRS style)
  const existingBankSlot = bankStorage.findIndex(bankItem => bankItem && bankItem.id === item.id);
  
  if (existingBankSlot !== -1) {
    // Add to existing stack in bank
    bankStorage[existingBankSlot].quantity = (bankStorage[existingBankSlot].quantity || 1) + (item.quantity || 1);
    console.log(`BANK: Added to existing stack, new quantity: ${bankStorage[existingBankSlot].quantity}`);
  } else {
    // Find empty bank slot
    const emptyBankSlot = bankStorage.findIndex(slot => !slot);
    if (emptyBankSlot === -1) {
      showNotification('Your bank is full!', 'error');
      return false;
    }
    
    // Create new stack in bank (always stackable in bank)
    bankStorage[emptyBankSlot] = {
      id: item.id,
      quantity: item.quantity || 1
    };
    console.log(`BANK: Created new stack in slot ${emptyBankSlot}`);
  }
  
  // Remove from inventory
  playerInventory[inventorySlot] = null;
  
  showNotification(`Deposited ${item.quantity || 1} ${itemDef.name}${(item.quantity || 1) > 1 ? 's' : ''}.`);
  return true;
}

// Withdraw item from bank
function withdrawItemFromBank(bankSlot) {
  const item = bankStorage[bankSlot];
  if (!item) return false;
  
  const itemDef = itemDefinitions[item.id];
  if (!itemDef) return false;
  
  console.log(`BANK: Withdrawing 1 ${itemDef.name} from bank`);
  
  // Find empty inventory slot
  const emptyInventorySlot = playerInventory.findIndex(slot => !slot);
  if (emptyInventorySlot === -1) {
    showNotification('Your inventory is full!', 'error');
    return false;
  }
  
  // For stackable items in original definition, check if we can stack in inventory
  if (itemDef.stackable) {
    const existingInventorySlot = playerInventory.findIndex(invItem => invItem && invItem.id === item.id);
    if (existingInventorySlot !== -1) {
      // Add to existing stack in inventory
      playerInventory[existingInventorySlot].quantity = (playerInventory[existingInventorySlot].quantity || 1) + 1;
      console.log(`BANK: Added to existing inventory stack, new quantity: ${playerInventory[existingInventorySlot].quantity}`);
    } else {
      // Create new stack in inventory
      playerInventory[emptyInventorySlot] = {
        id: item.id,
        quantity: 1
      };
      console.log(`BANK: Created new inventory stack in slot ${emptyInventorySlot}`);
    }
  } else {
    // Non-stackable item - create single item in inventory
    playerInventory[emptyInventorySlot] = {
      id: item.id,
      quantity: 1
    };
    console.log(`BANK: Added non-stackable item to inventory slot ${emptyInventorySlot}`);
  }
  
  // Remove from bank
  if (item.quantity > 1) {
    item.quantity--;
    console.log(`BANK: Reduced bank stack to ${item.quantity}`);
  } else {
    bankStorage[bankSlot] = null;
    console.log(`BANK: Removed last item from bank slot ${bankSlot}`);
  }
  
  showNotification(`Withdrawn 1 ${itemDef.name}.`);
  return true;
}

// Update bank display
function updateBankDisplay() {
  const bankGrid = document.getElementById('bank-grid');
  if (!bankGrid) return;
  
  const slots = bankGrid.querySelectorAll('.bank-slot');
  slots.forEach((slot, index) => {
    const item = bankStorage[index];
    
    if (item) {
      const itemDef = itemDefinitions[item.id];
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
      const itemDef = itemDefinitions[item.id];
      if (itemDef) {
        slot.classList.add('occupied');
        const tintStyle = itemDef.colorTint ? `color: ${itemDef.colorTint};` : '';
        const tintClass = itemDef.colorTint ? 'tinted' : '';
        
        // Use dynamic icon if available (for coins), otherwise use default icon
        const icon = itemDef.getIcon ? itemDef.getIcon(item.quantity || 1) : itemDef.icon;
        
        slot.innerHTML = `
          <div class="bank-item ${tintClass}" style="${tintStyle}">
            ${icon}
            ${itemDef.stackable && item.quantity > 1 ? 
              `<div class="bank-item-count">${item.quantity}</div>` : ''
            }
          </div>
        `;
        slot.title = `${itemDef.name}${item.quantity > 1 ? ` (${item.quantity})` : ''} - Click to deposit`;
      }
    } else {
      slot.classList.remove('occupied');
      slot.innerHTML = '';
      slot.title = '';
    }
  });
}