// New combat module for OSRS-style melee combat

import { addExperience, calculateTotalLevel } from './skills.js';

// Configuration constants
const TICK_LENGTH_MS = 500; // 0.5s per game tick
const PLAYER_ATTACK_SPEED_TICKS = 4; // 2s per attack for now

// Runtime state
let currentTarget = null; // { npcId, x, y }
let awaitingServer = false; // Prevent spamming attack requests

// --- Player HP tracking ---
let playerMaxHP = null;
let playerCurrentHP = null;
let hpHideTimer = null;

function ensurePlayerHPInitialised() {
  if (playerMaxHP !== null) return;
  const profile = window.userModule?.getProfile?.();
  const lvl = profile?.skills?.hitpoints || 10;
  playerMaxHP = lvl; // 1 level == 1 HP for now (server will match)
  playerCurrentHP = playerMaxHP;
  if (window.uiModule?.updateHUDHPDisplay) {
    window.uiModule.updateHUDHPDisplay(playerCurrentHP, playerMaxHP);
  }
  
  // Sync initial HP with server
  if (window.syncHitpointsWithServer && window.isUserOnline && window.isUserOnline()) {
    window.syncHitpointsWithServer(playerCurrentHP, playerMaxHP);
  }
  
  renderPlayerHealthBar();
}

function renderPlayerHealthBar() {
  const playerEl = document.getElementById('player-character');
  if (!playerEl) return;
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
      z-index: 20;
    `;
    const fill = document.createElement('div');
    fill.style.height = '100%';
    bar.appendChild(fill);
    playerEl.appendChild(bar);
  }
  updatePlayerHealthBar();
}

function updatePlayerHealthBar() {
  const playerEl = document.getElementById('player-character');
  if (!playerEl) return;
  const bar = playerEl.querySelector('.player-health-bar');
  if (!bar) return;
  const fill = bar.firstElementChild;
  const pct = Math.max(0, Math.min(100, (playerCurrentHP / playerMaxHP) * 100));
  fill.style.width = `${pct}%`;
  fill.style.backgroundColor = pct > 60 ? '#4CAF50' : pct > 25 ? '#FF9800' : '#F44336';
  showAndAutoHideHPBar();
}

function showAndAutoHideHPBar() {
  const bar = document.querySelector('#player-character .player-health-bar');
  if (!bar) return;
  bar.style.opacity = '1';
  if (hpHideTimer) clearTimeout(hpHideTimer);
  hpHideTimer = setTimeout(()=>{ if(bar) bar.style.opacity='0'; },6000);
}

// call once after load
setTimeout(ensurePlayerHPInitialised, 1000);

export function initializeCombat() {
  console.log('⚔️ Combat system initialized');
  // Expose globally so other modules (NPC, multiplayer) can access
  window.combatModule = {
    startCombat,
    handleMovementComplete,
    handleCombatHit,
    isInCombat: () => !!currentTarget,
    updateLocalHPBar,
    getCurrentHP: ()=>playerCurrentHP
  };
}

/**
 * Called by NPC module when the player clicks an NPC.
 */
function startCombat(npc) {
  if (!npc) return;

  // Save the target to check distance after movement
  currentTarget = { npcId: npc.id, x: npc.x, y: npc.y };

  // Let world module know we have an interaction target so movement completion fires.
  window.interactionTarget = {
    type: 'combat',
    npcId: npc.id,
    x: npc.x,
    y: npc.y
  };

  console.log(`⚔️ Engaging NPC ${npc.name} (${npc.id}) at (${npc.x}, ${npc.y})`);

  // Determine current distance to decide if movement needed
  if (window.worldModule?.getPlayerPosition) {
    const pos = window.worldModule.getPlayerPosition();
    const dx = Math.abs(Math.floor(pos.x) - Math.floor(npc.x));
    const dy = Math.abs(Math.floor(pos.y) - Math.floor(npc.y));
    const distance = Math.max(dx, dy);

    if (distance === 0) {
      // Standing on the same tile – move to an adjacent tile first
      if (window.worldModule?.movePlayerToInteractiveTarget) {
        window.worldModule.movePlayerToInteractiveTarget(npc.x, npc.y);
      }
      // Wait for movement complete before attempting attack
      return;
    }

    if (distance > 1) {
      // Too far – path-find closer (stops adjacent to target)
      if (window.worldModule?.movePlayerToInteractiveTarget) {
        window.worldModule.movePlayerToInteractiveTarget(npc.x, npc.y);
      }
      // Attack will be attempted once movement completes
      return;
    }
    // distance === 1 → already adjacent: fall through to immediate attack.
  }

  // Attempt immediate attack if already in range
  handleMovementComplete();
}

/**
 * Called from the global window.handleMovementComplete chain once the player
 * finishes moving. When the player is in range, we send an attack request to
 * the server.
 */
function handleMovementComplete() {
  if (!currentTarget) return;
  if (!window.worldModule || !window.worldModule.getPlayerPosition) return;

  const pos = window.worldModule.getPlayerPosition();
  if (!pos) return;

  const dx = Math.abs(Math.floor(pos.x) - Math.floor(currentTarget.x));
  const dy = Math.abs(Math.floor(pos.y) - Math.floor(currentTarget.y));
  const distance = Math.max(dx, dy);

  if (distance <= 1 && !awaitingServer) {
    const ws = window.multiplayerModule?.getWebSocket?.();
    if (ws && ws.readyState === WebSocket.OPEN) {
      // Close enough – send attack request
      awaitingServer = true; // Wait for server to reply with hits before next request
      ws.send(JSON.stringify({
        type: 'player-attack-npc',
        npcId: currentTarget.npcId,
        timestamp: Date.now()
      }));
    } else {
      // Offline fallback: simple local hit
      const damage = Math.floor(Math.random()*3);
      awaitingServer = false;
      handleCombatHit({
        attacker: 'player',
        targetType: 'npc',
        targetId: currentTarget.npcId,
        damage,
        remainingHealth: -1
      });
    }
  }
}

/**
 * Handle a combat hit broadcast from the server and display hit-splats.
 */
function handleCombatHit(data) {
  const { targetType, targetId, damage } = data;

  let targetElement = null;
  if (targetType === 'npc') {
    if (window.npcModule && window.npcModule.getNPC) {
      const npc = window.npcModule.getNPC(targetId);
      if (npc) {
        const el = document.querySelector(`.npc[data-npc-id="${targetId}"]`);
        if (el) targetElement = el;
      }
    }
  } else if (targetType === 'player') {
    if (data.target === window.multiplayerModule?.getCurrentUser()?.username) {
      targetElement = document.getElementById('player-character');
      // Deduct HP and update bar
      ensurePlayerHPInitialised();
      playerCurrentHP = Math.max(0, playerCurrentHP - damage);
      updatePlayerHealthBar();
      
      // Sync HP with server
      if (window.syncHitpointsWithServer && window.isUserOnline && window.isUserOnline()) {
        window.syncHitpointsWithServer(playerCurrentHP, playerMaxHP);
      }
      
      if (window.uiModule?.updateHUDHPDisplay) {
        window.uiModule.updateHUDHPDisplay(playerCurrentHP, playerMaxHP);
      }
      
      if (playerCurrentHP <= 0) {
        if (window.showNotification) {
          window.showNotification('You have died!', 'error');
        }
        // For now immediately reset local HP; actual death handling will be from server side later
        setTimeout(() => {
          playerCurrentHP = playerMaxHP;
          updatePlayerHealthBar();
          
          // Sync full HP restore with server
          if (window.syncHitpointsWithServer && window.isUserOnline && window.isUserOnline()) {
            window.syncHitpointsWithServer(playerCurrentHP, playerMaxHP);
          }
          
          if (window.uiModule?.updateHUDHPDisplay) {
            window.uiModule.updateHUDHPDisplay(playerCurrentHP, playerMaxHP);
          }
        }, 2000);
      }
    } else {
      targetElement = document.querySelector(`.online-player[data-username="${data.target}"]`);
    }
  }

  if (targetElement) {
    showHitSplat(targetElement, damage);
    if (targetType === 'npc' && window.npcModule?.updateNPCHealth) {
      window.npcModule.updateNPCHealth(targetId, data.remainingHealth);
    }

    // Award Attack XP if the current user is the attacker and target is an NPC
    const currentUser = window.multiplayerModule?.getCurrentUser?.();
    if (currentUser && data.attacker === currentUser.username && targetType === 'npc' && damage > 0) {
      const profile = window.userModule?.getProfile?.();
      if (profile && profile.skills && profile.skillsExp) {
        const xp = damage * 4; // OSRS-style: 4 XP per point of damage
        const leveledUp = addExperience('attack', xp, profile.skills, profile.skillsExp);
        // Recalculate totals
        profile.totalLevel = calculateTotalLevel(profile.skills);
        if (window.calculateCombatLevel) {
          profile.combatLevel = window.calculateCombatLevel(profile.skills);
        }

        // Sync with server
        window.multiplayerModule?.syncSkillsWithServer?.(
          profile.skills,
          profile.totalLevel ?? 0,
          profile.combatLevel ?? 0,
          profile.skillsExp
        );

        // Update UI if module available
        if (window.uiModule?.updateAllExperienceBars) {
          window.uiModule.updateAllExperienceBars();
        }

        // Refresh profile panel / skill list
        if (window.updateProfileInfo) {
          window.updateProfileInfo();
        }

        if (leveledUp && window.chatModule?.addMessage) {
          window.chatModule.addMessage(`🎉 You advanced an Attack level!`, 'success');
        }

        if (window.uiModule?.updateSkillDisplay) {
          window.uiModule.updateSkillDisplay('attack', profile.skills.attack, leveledUp);
        }
        if (window.uiModule?.updateTotalLevel) {
          window.uiModule.updateTotalLevel(profile.skills);
        }
      }
    }
  }

  // If this hit finishes the NPC, clear local target so new clicks needed
  if (targetType === 'npc' && data.remainingHealth !== undefined && data.remainingHealth <= 0) {
    if (currentTarget && currentTarget.npcId === targetId) {
      currentTarget = null;
      awaitingServer = false;
    }
  }

  // Allow sending the next attack after server processed
  if (targetType === 'npc' && data.attacker === window.multiplayerModule?.getCurrentUser()?.username) {
    awaitingServer = false;
  }
}

/**
 * Utility to show an OSRS style hit splat above a DOM element.
 */
function showHitSplat(targetElement, damage) {
  const splat = document.createElement('div');
  splat.className = 'hit-splat';
  splat.textContent = damage;
  splat.style.cssText = `
    position: absolute;
    top: -20px;
    left: 50%;
    transform: translateX(-50%);
    font-weight: bold;
    color: ${damage === 0 ? '#AAA' : '#ff3333'};
    text-shadow: 0 0 2px #000;
    pointer-events: none;
    animation: hit-splat-rise 0.6s forwards;
  `;

  // Ensure target element is positioned relatively
  const prevPos = getComputedStyle(targetElement).position;
  if (prevPos === 'static') {
    targetElement.style.position = 'relative';
  }

  targetElement.appendChild(splat);

  setTimeout(() => {
    splat.remove();
  }, 600);
}

// Add CSS animation if not present
if (!document.getElementById('combat-styles')) {
  const style = document.createElement('style');
  style.id = 'combat-styles';
  style.textContent = `
    @keyframes hit-splat-rise {
      0% { opacity: 0; transform: translate(-50%, 0) scale(0.5); }
      20% { opacity: 1; transform: translate(-50%, -6px) scale(1); }
      100% { opacity: 0; transform: translate(-50%, -26px) scale(1); }
    }
  `;
  document.head.appendChild(style);
}

// expose for multiplayer handler
export function updateLocalHPBar(cur,max) {
  ensurePlayerHPInitialised();
  playerMaxHP = max;
  playerCurrentHP = cur;
  updatePlayerHealthBar();
  if (window.uiModule?.updateHUDHPDisplay) {
    window.uiModule.updateHUDHPDisplay(cur, max);
  }
  
  // Sync HP with server if online
  if (window.syncHitpointsWithServer && window.isUserOnline && window.isUserOnline()) {
    window.syncHitpointsWithServer(cur, max);
  }
} 