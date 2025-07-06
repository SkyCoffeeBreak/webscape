/**
 * NPC Module - Client-side NPC management
 * Handles NPC rendering, movement, and synchronization
 */

// Toggle detailed NPC debug logs
const DEBUG_NPCS = true; // TEMP: enable for respawn debugging; set back to false once fixed

// NPC tracking
const npcs = new Map(); // npcId -> npc data
const npcElements = new Map(); // npcId -> DOM element

// NPC state
let npcContainer = null;

/**
 * Initialize the NPC system
 */
export function initializeNPCs(worldContainer) {
  console.log('🎭 Initializing NPC system...');
  
  // Create NPC container
  npcContainer = document.createElement('div');
  npcContainer.className = 'npc-container';
  npcContainer.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 15;
  `;
  
  worldContainer.appendChild(npcContainer);
  
  // Add CSS styles for NPC animations
  if (!document.getElementById('npc-sprite-styles')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'npc-sprite-styles';
    styleSheet.textContent = `
      @keyframes npc-idle {
        0%, 100% { transform: translateY(0px); }
        50% { transform: translateY(-2px); }
      }
      .npc:hover {
        filter: brightness(1.2) !important;
      }
    `;
    document.head.appendChild(styleSheet);
  }
  
  console.log('✅ NPC system initialized');
}

/**
 * Handle NPC data from server
 */
export function handleNPCData(npcData) {
  console.log(`🎭 Received NPC data: ${npcData.length} NPCs`);
  
  // Clear existing NPCs
  npcs.clear();
  npcElements.forEach(element => element.remove());
  npcElements.clear();
  
  // Add new NPCs
  npcData.forEach(npcInfo => {
    addNPC(npcInfo);
  });
}

/**
 * Add an NPC to the world
 */
export function addNPC(npcInfo) {
  const { id, type, name, emoji, position, health, maxHealth, combatLevel, isStopped } = npcInfo;
  
  console.log(`🎭 Adding NPC: ${name} at (${position.x}, ${position.y})`);
  
  // Check if container exists - if not, create it or find the world container
  if (!npcContainer) {
    console.warn('🎭 NPC container not initialized, attempting to find world container...');
    const worldContainer = document.getElementById('game-world');
    if (worldContainer) {
      console.log('🎭 Found world container, initializing NPCs...');
      initializeNPCs(worldContainer);
    } else {
      console.error('🎭 Could not find world container, cannot add NPCs');
      return;
    }
  }
  
  // Store NPC data with map level (default to surface for existing NPCs)
  npcs.set(id, {
    ...npcInfo,
    x: position.x,
    y: position.y,
    mapLevel: npcInfo.mapLevel || 'surface' // Default existing NPCs to surface
  });
  
  // Create NPC element
  const npcElement = document.createElement('div');
  npcElement.className = 'npc';
  npcElement.setAttribute('data-npc-id', id);
  npcElement.setAttribute('data-npc-type', type);
  npcElement.title = `${name} (Level ${combatLevel})`;
  
  // Initialize facing direction (default to left)
  npcElement.dataset.facing = 'left';
  
  npcElement.style.cssText = `
    position: absolute;
    width: 32px;
    height: 32px;
    font-size: 24px;
    display: flex;
    visibility: visible;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    pointer-events: auto;
    transition: transform 0.3s ease;
    z-index: 10;
    user-select: none;
    text-shadow: 0 0 3px rgba(0,0,0,0.8);
  `;
  
  if (DEBUG_NPCS) console.log('✅ NPC element created & styled:', npcElement);
  
  // Safety: ensure camera/context ready before positioning
  if (!window.worldModule) {
    if (DEBUG_NPCS) console.warn('worldModule not ready when adding NPC');
  }
  
  // Add emoji
  npcElement.textContent = emoji;
  
  // Add health bar if damaged
  if (health < maxHealth) {
    const healthBar = createHealthBar(health, maxHealth);
    npcElement.appendChild(healthBar);
  }
  
  // Position the NPC
  updateNPCPosition(npcElement, position.x, position.y);
  
  // Add to container
  npcContainer.appendChild(npcElement);
  npcElements.set(id, npcElement);
  
  // Add hover effects
  function applyNPCTransform(elem, hoverScale = 1) {
    const flip = elem.dataset.facing === 'right' ? -1 : 1;
    elem.style.transform = `scaleX(${flip}) scale(${hoverScale})`;
  }

  npcElement.addEventListener('mouseenter', () => {
    applyNPCTransform(npcElement, 1.1);
    npcElement.style.filter = 'brightness(1.2)';
  });

  npcElement.addEventListener('mouseleave', () => {
    applyNPCTransform(npcElement, 1);
    npcElement.style.filter = 'none';
  });
  
  // Add click handler for combat
  npcElement.addEventListener('click', (e) => {
    e.stopPropagation();
    handleNPCClick(id);
  });

  // Add right-click context menu for NPCs
  npcElement.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    showNPCContextMenu(e, id);
  });
}

/**
 * Handle NPC movement from server
 */
export function handleNPCMove(data) {
  const { npcId, position, direction } = data;
  //if (DEBUG_NPCS) console.log(`🎭 handleNPCMove called for NPC ${npcId}:`, data);
  
  const npc = npcs.get(npcId);
  const npcElement = npcElements.get(npcId);
  
  //if (DEBUG_NPCS) console.log(`🎭 NPC lookup: npc=${!!npc}, npcElement=${!!npcElement}`);
  
  if (!npc || !npcElement) {
    if (DEBUG_NPCS) {
      console.warn(`🎭 NPC not found for movement: ${npcId} (npc: ${!!npc}, element: ${!!npcElement})`);
      console.log(`🎭 Available NPCs:`, Array.from(npcs.keys()));
      console.log(`🎭 Available NPC elements:`, Array.from(npcElements.keys()));
    }
    // Failsafe: request fresh NPC data from server once
    if (!window.__requestedNPCResync) {
      window.__requestedNPCResync = true;
      setTimeout(() => { window.__requestedNPCResync = false; }, 3000);
      if (DEBUG_NPCS) console.log('📡 Requesting fresh NPC data from server (resync)');
      requestNPCData();
    }
    return;
  }
  
  // Determine current world position; if an animation is already in progress,
  // compute the interpolated position so the new move starts from where the NPC
  // visually is RIGHT NOW – this eliminates visible jitter caused by back-to-
  // back movement packets.

  let fromX = npc.x;
  let fromY = npc.y;

  if (npcElement.dataset.isMoving === 'true') {
    const startTime = Number(npcElement.dataset.moveStartTime);
    const duration  = Number(npcElement.dataset.moveDuration) || 500;
    const sX = Number(npcElement.dataset.startX);
    const sY = Number(npcElement.dataset.startY);
    const eX = Number(npcElement.dataset.endX);
    const eY = Number(npcElement.dataset.endY);

    const progress = Math.min(1, (Date.now() - startTime) / duration);
    if (!isNaN(progress)) {
      fromX = sX + (eX - sX) * progress;
      fromY = sY + (eY - sY) * progress;
    }
  }
  
  // Store direction for reference
  if (direction && npcElement) {
    npcElement.dataset.direction = direction;
  }
  
  // Animate movement with direction for sprite flipping (pass current position)
  animateNPCMovement(npcElement, fromX, fromY, position.x, position.y, direction);
  
  // Update NPC data AFTER starting animation
  npc.x = position.x;
  npc.y = position.y;
  npc.direction = direction;
}

/**
 * Handle NPC stop from server
 */
export function handleNPCStop(data) {
  const { npcId } = data;
  const npc = npcs.get(npcId);
  const npcElement = npcElements.get(npcId);
  
  if (!npc || !npcElement) return;
  
  npc.isStopped = true;
  
  // Visual indicator that NPC stopped (subtle animation)
  npcElement.style.animation = 'npc-idle 2s ease-in-out infinite';
}

/**
 * Handle NPC resume from server
 */
export function handleNPCResume(data) {
  const { npcId } = data;
  const npc = npcs.get(npcId);
  const npcElement = npcElements.get(npcId);
  
  if (!npc || !npcElement) return;
  
  npc.isStopped = false;
  
  // Remove idle animation
  npcElement.style.animation = '';
}

/**
 * Handle NPC death from server
 */
export function handleNPCDeath(data) {
  const { npcId } = data;
  console.log(`💀 NPC ${npcId} is dying - starting death animation`);
  
  const npc = npcs.get(npcId);
  const npcElement = npcElements.get(npcId);
  
  if (!npc || !npcElement) {
    console.warn(`💀 NPC not found for death animation: ${npcId}`);
    return;
  }
  
  // Mark as dying to prevent interactions
  npc.isDying = true;
  
  // Stop any movement animations
  npcElement.style.transition = 'opacity 1.5s ease-out, transform 1.5s ease-out';
  
  // Start death animation - fade out and slightly shrink
  npcElement.style.opacity = '0';
  npcElement.style.transform = 'scale(0.8)';
  npcElement.style.pointerEvents = 'none'; // Disable clicks during death
  
  console.log(`💀 Death animation started for NPC ${npcId}`);
}

/**
 * Handle NPC removal from server
 */
export function handleNPCRemove(data) {
  const { npcId } = data;
  const npcElement = npcElements.get(npcId);
  
  if (npcElement) {
    npcElement.remove();
    npcElements.delete(npcId);
  }
  
  npcs.delete(npcId);
  console.log(`🗑️ Removed NPC: ${npcId}`);
}

/**
 * Update NPC position on screen
 */
function updateNPCPosition(npcElement, x, y) {
  if (!window.worldModule) return;
  
  const gridSize = window.worldModule.getGridSize();
  const camerPos = window.worldModule.getCameraPosition();
  
  const screenX = (x - camerPos.x) * gridSize;
  const screenY = (y - camerPos.y) * gridSize;
  
  npcElement.style.left = `${screenX}px`;
  npcElement.style.top = `${screenY}px`;
}

/**
 * Animate NPC movement with smooth diagonal support and sprite flipping
 */
function animateNPCMovement(npcElement, fromX, fromY, toX, toY, direction) {
  //if (DEBUG_NPCS) console.log(`🎬 Starting NPC animation from (${fromX}, ${fromY}) to (${toX}, ${toY}), direction: ${direction}`);
  
  if (!window.worldModule) {
    if (DEBUG_NPCS) console.error('🎬 Animation failed: worldModule not available');
    return;
  }
  
  const gridSize = window.worldModule.getGridSize();
  const camerPos = window.worldModule.getCameraPosition();
  
  // Calculate screen positions
  const fromScreenX = (fromX - camerPos.x) * gridSize;
  const fromScreenY = (fromY - camerPos.y) * gridSize;
  const toScreenX = (toX - camerPos.x) * gridSize;
  const toScreenY = (toY - camerPos.y) * gridSize;
  
  // Calculate movement delta for smooth animation
  const deltaX = toScreenX - fromScreenX;
  const deltaY = toScreenY - fromScreenY;
  
  // Debug: Log animation details
 // if (DEBUG_NPCS) console.log(`🎬 Animating NPC: delta(${deltaX}, ${deltaY}), direction: ${direction}`);
  
  // Handle sprite flipping based on direction. If direction lacks explicit left/right
  // (e.g. 'up' or 'down'), derive facing from horizontal delta so NPC faces the
  // player while moving.
  let facingDirection = direction;
  if (!facingDirection || (facingDirection === 'up' || facingDirection === 'down')) {
    if (deltaX > 0) facingDirection = 'right';
    else if (deltaX < 0) facingDirection = 'left';
  }
  updateNPCSprite(npcElement, facingDirection);
  
  // Duration of the move animation in ms
  const duration = 500;

  // Store movement state for camera-aware interpolation
  npcElement.dataset.isMoving = 'true';
  npcElement.dataset.moveStartTime = Date.now();
  npcElement.dataset.moveDuration = duration;
  npcElement.dataset.startX = fromX;
  npcElement.dataset.startY = fromY;
  npcElement.dataset.endX = toX;
  npcElement.dataset.endY = toY;

  // Immediately position the NPC at its current world coords relative to the camera
  npcElement.style.transition = 'none';
  npcElement.style.left = `${fromScreenX}px`;
  npcElement.style.top = `${fromScreenY}px`;

  // Maintain sprite orientation every frame
  const facing = npcElement.dataset.facing;
  const flip = facing === 'right' ? -1 : 1;
  npcElement.style.transform = `scaleX(${flip}) scale(1)`;
}

/**
 * Update NPC sprite orientation based on movement direction
 */
function updateNPCSprite(npcElement, direction) {
  if (!direction) return;
  
  // Normalise direction string to lower-case for easier checks
  const dir = direction.toLowerCase();
  
  // Determine facing – treat any *east* as right and *west* as left for consistency
  if (dir.includes('right') || dir.includes('east')) {
    npcElement.dataset.facing = 'right';
  } else if (dir.includes('left') || dir.includes('west')) {
    npcElement.dataset.facing = 'left';
  } else {
    // For purely vertical movement keep current facing (do nothing)
  }
  
  // Apply transform immediately so facing changes even before next camera update
  const facing = npcElement.dataset.facing;
  const flip = facing === 'right' ? -1 : 1;
  npcElement.style.transform = `scaleX(${flip}) scale(1)`;
}

/**
 * Update all NPC positions (called when camera moves)
 */
export function updateAllNPCPositions() {
  if (!window.worldModule) return;
  
  const gridSize = window.worldModule.getGridSize();
  const camerPos = window.worldModule.getCameraPosition();
  
  npcElements.forEach((npcElement, npcId) => {
    const npc = npcs.get(npcId);
    if (!npc) return;
    
    // Check if NPC is on current map level
    const currentMapLevel = window.worldModule.getCurrentMapLevel ? window.worldModule.getCurrentMapLevel() : 'surface';
    const npcMapLevel = npc.mapLevel || 'surface';
    
    if (npcMapLevel !== currentMapLevel) {
      // Hide NPC if not on current map level
      npcElement.style.display = 'none';
      return;
    } else {
      // Show NPC if on current map level
      npcElement.style.display = 'flex';
    }
    
    // Always use the NPC's current world position for camera updates
    // This ensures NPCs are positioned correctly relative to the world, not the camera
    const worldX = npc.x;
    const worldY = npc.y;
    
    // Calculate screen position based on world coordinates and camera position
    const screenX = (worldX - camerPos.x) * gridSize;
    const screenY = (worldY - camerPos.y) * gridSize;
    
    const isMoving = npcElement.dataset.isMoving === 'true';

    if (isMoving) {
      const startTime = Number(npcElement.dataset.moveStartTime);
      const duration = Number(npcElement.dataset.moveDuration) || 500;
      const startX = Number(npcElement.dataset.startX);
      const startY = Number(npcElement.dataset.startY);
      const endX = Number(npcElement.dataset.endX);
      const endY = Number(npcElement.dataset.endY);

      // Abort animation if any metadata is missing / invalid
      if ([startTime, startX, startY, endX, endY].some(v => isNaN(v))) {
        npcElement.dataset.isMoving = 'false';
      } else {
        // Interpolate world position based on time progress for smooth camera-aware animation
        const progress = Math.min(1, (Date.now() - startTime) / duration);

        const currentWorldX = startX + (endX - startX) * progress;
        const currentWorldY = startY + (endY - startY) * progress;

        const screenXMoving = (currentWorldX - camerPos.x) * gridSize;
        const screenYMoving = (currentWorldY - camerPos.y) * gridSize;

        npcElement.style.left = `${screenXMoving}px`;
        npcElement.style.top = `${screenYMoving}px`;

        // When animation is complete, mark not moving and cleanup
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
    } else {
      // Regular static positioning when not animating
      npcElement.style.left = `${screenX}px`;
      npcElement.style.top = `${screenY}px`;
    }

    // Maintain sprite orientation every frame
    const facing = npcElement.dataset.facing;
    const flip = facing === 'right' ? -1 : 1;
    npcElement.style.transform = `scaleX(${flip}) scale(1)`;
  });
}

/**
 * Create health bar for damaged NPCs
 */
function createHealthBar(health, maxHealth) {
  const healthBar = document.createElement('div');
  healthBar.className = 'npc-health-bar';
  
  const healthPercent = (health / maxHealth) * 100;
  const healthColor = healthPercent > 60 ? '#4CAF50' : healthPercent > 25 ? '#FF9800' : '#F44336';
  
  healthBar.style.cssText = `
    position: absolute;
    top: -8px;
    left: 50%;
    transform: translateX(-50%) scaleX(-1); /* negate parent flip */
    width: 30px;
    height: 4px;
    background-color: rgba(0,0,0,0.3);
    border-radius: 2px;
    overflow: hidden;
  `;
  
  const healthFill = document.createElement('div');
  healthFill.style.cssText = `
    width: ${healthPercent}%;
    height: 100%;
    background-color: ${healthColor};
    transition: width 0.3s ease;
  `;
  
  healthBar.appendChild(healthFill);
  return healthBar;
}

/**
 * Handle NPC click (for future combat system)
 */
function handleNPCClick(npcId) {
  const npc = npcs.get(npcId);
  if (!npc) return;
  
  if (DEBUG_NPCS) console.log(`🎭 Clicked on NPC: ${npc.name}`);
  
  // Start combat using the combat module if available
  if (window.combatModule && window.combatModule.startCombat) {
    window.combatModule.startCombat(npc);
  } else {
    // Fallback: notify player combat not ready
    if (window.chatModule && window.chatModule.showNotification) {
      window.chatModule.showNotification(`Combat system not ready.`, 'error');
    }
  }
}

/**
 * Request NPC data from server
 */
export function requestNPCData() {
  if (window.multiplayerModule && window.multiplayerModule.getWebSocket) {
    const ws = window.multiplayerModule.getWebSocket();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'request-npc-data',
        timestamp: Date.now()
      }));
    }
  }
}

/**
 * Get NPC by ID
 */
export function getNPC(npcId) {
  return npcs.get(npcId);
}

/**
 * Get all NPCs
 */
export function getAllNPCs() {
  return Array.from(npcs.values());
}

/**
 * Get NPCs at position
 */
export function getNPCsAt(x, y) {
  return Array.from(npcs.values()).filter(npc => 
    Math.floor(npc.x) === Math.floor(x) && Math.floor(npc.y) === Math.floor(y)
  );
}

// Add CSS for NPC animations
const style = document.createElement('style');
style.textContent = `
  @keyframes npc-idle {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.05); }
  }
  
  .npc:hover {
    filter: brightness(1.2) drop-shadow(0 0 5px rgba(255,255,255,0.5));
  }
  
  .npc-health-bar {
    box-shadow: 0 0 2px rgba(0,0,0,0.5);
  }
`;
document.head.appendChild(style);

/**
 * Show a context menu for an NPC with an Attack option.
 */
function showNPCContextMenu(event, npcId) {
  const existing = document.getElementById('npc-context-menu');
  if (existing) existing.remove();

  const npc = npcs.get(npcId);
  if (!npc) return;

  const menu = document.createElement('div');
  menu.id = 'npc-context-menu';
  menu.style.position = 'fixed';
  menu.style.zIndex = '2000';
  menu.style.background = '#2a2a2a';
  menu.style.border = '1px solid #555';
  menu.style.borderRadius = '5px';
  menu.style.padding = '5px 0';
  menu.style.minWidth = '120px';
  menu.style.boxShadow = '0 2px 10px rgba(0,0,0,0.5)';

  const attackOption = document.createElement('div');
  attackOption.textContent = `Attack ${npc.name}`;
  attackOption.style.color = '#f44336';
  attackOption.style.padding = '4px 12px';
  attackOption.style.cursor = 'pointer';
  attackOption.addEventListener('click', () => {
    handleNPCClick(npcId);
    menu.remove();
  });

  menu.appendChild(attackOption);

  // Walk here option – always first like OSRS context menus
  const walkOption = document.createElement('div');
  walkOption.textContent = 'Walk here';
  walkOption.style.padding = '4px 12px';
  walkOption.style.cursor = 'pointer';
  walkOption.addEventListener('click', () => {
    if (window.worldModule && window.worldModule.movePlayerToTarget) {
      window.worldModule.movePlayerToTarget(npc.x, npc.y);
    }
    menu.remove();
  });

  // Insert walk option at top
  menu.insertBefore(walkOption, attackOption);

  // Optional Examine option
  const examineOption = document.createElement('div');
  examineOption.textContent = 'Examine';
  examineOption.style.padding = '4px 12px';
  examineOption.style.cursor = 'pointer';
  examineOption.addEventListener('click', () => {
    const examineText = npc.examine ? npc.examine : `It\'s ${npc.name}.`;
    window.showNotification(examineText, 'info');
    menu.remove();
  });
  menu.appendChild(examineOption);

  menu.style.left = `${event.pageX}px`;
  menu.style.top = `${event.pageY}px`;

  document.body.appendChild(menu);

  const hide = () => menu.remove();
  setTimeout(() => {
    document.addEventListener('click', hide, { once: true });
  }, 0);
}

/**
 * Update (or create) the floating health-bar for an NPC after a hit.
 */
export function updateNPCHealth(npcId, healthRemaining) {
  const npc = npcs.get(npcId);
  if (!npc) return;
  npc.health = healthRemaining;

  const npcElement = npcElements.get(npcId);
  if (!npcElement) return;

  let bar = npcElement.querySelector('.npc-health-bar');
  if (!bar) {
    bar = createHealthBar(healthRemaining, npc.maxHealth);
    npcElement.appendChild(bar);
  }

  const fill = bar.firstElementChild;
  if (fill) {
    const maxHp = npc.maxHealth || healthRemaining;
    const percent = Math.max(0, Math.min(100, (healthRemaining / maxHp) * 100));
    fill.style.width = `${percent}%`;
    const color = percent > 60 ? '#4CAF50' : percent > 25 ? '#FF9800' : '#F44336';
    fill.style.backgroundColor = color;
  }
}

console.log('🎭 NPC module loaded'); 