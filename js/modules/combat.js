// Enhanced OSRS-style combat module

import { addExperience, calculateTotalLevel } from './skills.js';

// Configuration constants
const TICK_LENGTH_MS = 500; // 0.5s per game tick

// Attack speeds (in ticks) for different weapon types
const ATTACK_SPEEDS = {
  unarmed: 4,
  dagger: 4,
  sword: 4,
  axe: 5,
  mace: 5,
  scimitar: 4,
  longsword: 5,
  battleaxe: 6,
  warhammer: 6,
  halberd: 7,
  whip: 4,
  // Ranged weapons
  shortbow: 5,
  longbow: 6,
  crossbow: 5,
  thrown: 3,
  // Magic
  spell: 5,
  staff: 4
};

// Combat styles and their effects
const COMBAT_STYLES = {
  melee: {
    accurate: { attack: 3, strength: 0, defence: 0, xpMode: 'attack' },
    aggressive: { attack: 0, strength: 3, defence: 0, xpMode: 'strength' },
    defensive: { attack: 0, strength: 0, defence: 3, xpMode: 'defence' },
    controlled: { attack: 1, strength: 1, defence: 1, xpMode: 'shared' }
  },
  ranged: {
    accurate: { ranged: 3, defence: 0, xpMode: 'ranged' },
    rapid: { ranged: 0, defence: 0, xpMode: 'ranged', speedBonus: -1 },
    longrange: { ranged: 0, defence: 3, xpMode: 'shared', rangeBonus: 2 }
  },
  magic: {
    accurate: { magic: 3, defence: 0, xpMode: 'magic' },
    defensive: { magic: 0, defence: 3, xpMode: 'shared' }
  }
};

// Runtime state
let currentTarget = null; // { npcId, x, y }
let awaitingServer = false; // Prevent spamming attack requests
let autoRetaliate = true; // Auto retaliate setting
let currentCombatStyle = { type: 'melee', style: 'accurate' };
let lastAttackTick = 0;
let currentWeaponSpeed = ATTACK_SPEEDS.unarmed;

// --- Player HP tracking ---
let playerMaxHP = null;
let playerCurrentHP = null;
let hpHideTimer = null;

function ensurePlayerHPInitialised() {
  if (playerMaxHP !== null) return; // already done
  
  // If we are online but haven't yet received initial HP from the server, wait.
  if (window.isUserOnline && window.isUserOnline()) {
    if (typeof window.initialCurrentHP !== 'number' || typeof window.initialMaxHP !== 'number') {
      // Try again shortly
      return setTimeout(ensurePlayerHPInitialised, 200);
    }
  }

  const profile = window.userModule?.getProfile?.();
  
  // Prefer server-provided initial values if available
  let startingMaxHP = typeof window.initialMaxHP === 'number' ? window.initialMaxHP : (profile?.maxHP ?? profile?.skills?.hitpoints ?? 10);
  let startingCurHP = typeof window.initialCurrentHP === 'number' ? window.initialCurrentHP : (profile?.currentHP ?? startingMaxHP);
  
  // Cleanup temporary globals
  delete window.initialMaxHP;
  delete window.initialCurrentHP;
  
  playerMaxHP = startingMaxHP;
  playerCurrentHP = Math.min(startingCurHP, playerMaxHP);
  
  if (window.uiModule?.updateHUDHPDisplay) {
    window.uiModule.updateHUDHPDisplay(playerCurrentHP, playerMaxHP);
  }
  
  // Sync initial HP with server (only if online)
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
  // Update header HP as well
  if (window.uiModule?.updateHUDHPDisplay) {
    window.uiModule.updateHUDHPDisplay(playerCurrentHP, playerMaxHP);
  }
  showAndAutoHideHPBar();
}

function showAndAutoHideHPBar() {
  const bar = document.querySelector('#player-character .player-health-bar');
  if (!bar) return;
  bar.style.opacity = '1';
  if (hpHideTimer) clearTimeout(hpHideTimer);
  hpHideTimer = setTimeout(()=>{ if(bar) bar.style.opacity='0'; },6000);
}

// Combat calculations inspired by OSRS - NERFED VERSION
function calculateHitChance(attackerLevel, attackerBonus, defenderLevel, defenderBonus) {
  // Attack level affects accuracy significantly since it combines Attack + Strength
  const attackRoll = attackerLevel + attackerBonus;
  const defenseRoll = defenderLevel + defenderBonus;
  
  let hitChance = 0.80; // Higher base to reduce streaks of misses
  const levelDiff = attackRoll - defenseRoll;
  
  // Slightly steeper scaling: ±4% per effective-level difference
  hitChance += (levelDiff * 0.04);
  
  // Clamp to sensible limits
  return Math.max(0.40, Math.min(0.99, hitChance));
}

function calculateMaxHit(level, bonus) {
  // Reworked OSRS-style formula (applies to both melee & ranged)
  // Effective strength level adds a constant 8, mirroring how OSRS derives
  // effective levels (level + style/prayer + 8). We ignore prayers for now
  // because they are not yet implemented client-side.
  const effectiveStrength = level + 8;
  const base = Math.floor((effectiveStrength * (bonus + 64)) / 640);
  // Make ~60% more generous
  const boosted = Math.floor(base * 1.6);
  return Math.max(1, boosted + 1);
}

function getCombatStyleBonus(type, style) {
  return COMBAT_STYLES[type]?.[style] || COMBAT_STYLES.melee.accurate;
}

function getCurrentCombatType() {
  const profile = window.userModule?.getProfile?.();
  const weapon = profile?.equipment?.weapon;
  const arrows = profile?.equipment?.arrows;
  
  if (weapon) {
    const weaponDef = window.inventoryModule?.getItemDefinition?.(weapon.id);
    
    // Check for ranged weapons
    if (weaponDef?.id?.includes('bow') || weaponDef?.type === 'ranged') {
      // Ranged combat requires arrows
      if (!arrows) {
        return 'melee'; // No arrows, fall back to melee
      }
      return 'ranged';
    }
    
    // Check for magic weapons
    if (weaponDef?.id?.includes('staff') || weaponDef?.type === 'magic') {
      return 'magic';
    }
  }
  
  return 'melee'; // Default to melee
}

function updateCombatType() {
  const newType = getCurrentCombatType();
  if (currentCombatStyle.type !== newType) {
    currentCombatStyle.type = newType;
    currentCombatStyle.style = newType === 'ranged' ? 'accurate' : 
                               newType === 'magic' ? 'accurate' : 'accurate';
    console.log(`🎯 Combat type changed to: ${newType}`);
  }
}

function getAttackRange() {
  // Check if player has a ranged weapon equipped
  const profile = window.userModule?.getProfile?.();
  const weapon = profile?.equipment?.weapon;
  
  if (weapon) {
    const weaponDef = window.inventoryModule?.getItemDefinition?.(weapon.id);
    if (weaponDef?.id?.includes('bow') || weaponDef?.type === 'ranged') {
      return 8; // Ranged weapons have 8 tile range
    }
  }
  
  // Default melee range is 1, but can be extended for halberds, magic
  const style = getCombatStyleBonus(currentCombatStyle.type, currentCombatStyle.style);
  return 1 + (style.rangeBonus || 0);
}

function canAttack() {
  const currentTick = Math.floor(Date.now() / TICK_LENGTH_MS);
  const ticksSinceLastAttack = currentTick - lastAttackTick;
  const requiredTicks = currentWeaponSpeed + (getCombatStyleBonus(currentCombatStyle.type, currentCombatStyle.style).speedBonus || 0);
  return ticksSinceLastAttack >= requiredTicks;
}

// call once after load
setTimeout(ensurePlayerHPInitialised, 1000);

export function initializeCombat() {
  console.log('⚔️ Enhanced OSRS-style combat system initialized');
  
  // Initialize gear interface
  initializeGearInterface();
  
  // Expose globally so other modules (NPC, multiplayer) can access
  window.combatModule = {
    startCombat,
    handleMovementComplete,
    handleCombatHit,
    handleNPCRetreating,
    isInCombat: () => !!currentTarget,
    updateLocalHPBar,
    getCurrentHP: ()=>playerCurrentHP,
    setAutoRetaliate,
    setCombatStyle,
    getAttackRange,
    canAttack,
    updateCombatStats,
    clearCombatTarget,
    getCurrentCombatType,
    updateCombatType,
    consumeArrow,
    createArrowProjectile
  };
  
  // Update combat stats after a delay to ensure user profile is loaded
  setTimeout(() => {
    updateCombatStats();
  }, 1000);
}

// Combat options will be integrated into the main UI under 'Your Gear' tab

function setAutoRetaliate(enabled) {
  autoRetaliate = enabled;
  console.log(`⚔️ Auto retaliate ${enabled ? 'enabled' : 'disabled'}`);
}

function setCombatStyle(type, style) {
  currentCombatStyle = { type, style };
  console.log(`⚔️ Combat style set to ${type} - ${style}`);
}

/**
 * Called by NPC module when the player clicks an NPC.
 */
function startCombat(npc) {
  if (!npc) return;
  
  // Check if we can attack (attack speed cooldown)
  if (!canAttack()) {
    console.log('⚔️ Attack on cooldown');
    return;
  }

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
    const attackRange = getAttackRange();

    if (distance === 0) {
      // Standing on the same tile – move to an adjacent tile first
      if (window.worldModule?.movePlayerToInteractiveTarget) {
        window.worldModule.movePlayerToInteractiveTarget(npc.x, npc.y);
      }
      // Wait for movement complete before attempting attack
      return;
    }

    if (distance > attackRange) {
      // Walk toward a point that ends within attack range instead of the NPC tile
      const playerPos = window.worldModule.getPlayerPosition();
      let targetX = npc.x;
      let targetY = npc.y;

      const dxFull = npc.x - playerPos.x;
      const dyFull = npc.y - playerPos.y;

      // Bring the destination back along each axis so the Chebyshev distance
      // from the NPC will equal (attackRange - 1). This mimics OSRS where you
      // stop once in range and begin firing automatically.
      const limit = attackRange - 1;

      if (Math.abs(dxFull) > limit) {
        targetX = npc.x - Math.sign(dxFull) * limit;
      }
      if (Math.abs(dyFull) > limit) {
        targetY = npc.y - Math.sign(dyFull) * limit;
      }

      window.worldModule.movePlayerToInteractiveTarget(targetX, targetY);
      // Attack will be attempted once movement completes
      return;
    }
    // distance <= attackRange → already in range: fall through to immediate attack.
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
  const attackRange = getAttackRange();

  if (distance <= attackRange && !awaitingServer && canAttack()) {
    // Check if ranged combat and consume arrow
    if (currentCombatStyle.type === 'ranged') {
      console.log('🏹 [Combat] Attempting ranged attack - checking arrow consumption');
      if (!consumeArrow()) {
        console.log('🏹 [Combat] No arrows available - aborting ranged attack');
        showNotification('You have no arrows equipped!', 'error');
        return;
      }
      console.log('🏹 [Combat] Arrow consumed successfully - proceeding with ranged attack');
    }
    
    const ws = window.multiplayerModule?.getWebSocket?.();
    if (ws && ws.readyState === WebSocket.OPEN) {
      // For ranged combat, create arrow projectile
      if (currentCombatStyle.type === 'ranged') {
        const playerPos = window.worldModule?.getPlayerPosition();
        const npcElement = document.querySelector(`[data-npc-id="${currentTarget.npcId}"]`);
        
        if (playerPos && npcElement) {
          const playerElement = document.querySelector('.player-character');
          const playerRect = playerElement?.getBoundingClientRect();
          const npcRect = npcElement.getBoundingClientRect();
          
          if (playerRect && npcRect) {
            const startX = playerRect.left + playerRect.width / 2;
            const startY = playerRect.top + playerRect.height / 2;
            const endX = npcRect.left + npcRect.width / 2;
            const endY = npcRect.top + npcRect.height / 2;
            
            // Create arrow projectile, then send attack after delay
            createArrowProjectile(startX, startY, endX, endY, () => {
              // Send attack request when arrow hits
              if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                  type: 'player-attack-npc',
                  npcId: currentTarget.npcId,
                  combatStyle: currentCombatStyle,
                  timestamp: Date.now()
                }));
              }
            });
          }
        }
      } else {
        // Melee combat - immediate attack
        ws.send(JSON.stringify({
          type: 'player-attack-npc',
          npcId: currentTarget.npcId,
          combatStyle: currentCombatStyle,
          timestamp: Date.now()
        }));
      }
      
      // Set attack cooldown
      awaitingServer = true; // Wait for server to reply with hits before next request
      lastAttackTick = Math.floor(Date.now() / TICK_LENGTH_MS);

      // Failsafe: reset awaitingServer if no server response within 2.5 seconds
      if (window.__combatAwaitTimer) clearTimeout(window.__combatAwaitTimer);
      window.__combatAwaitTimer = setTimeout(() => { awaitingServer = false; }, 2500);
    } else {
      // Offline fallback: simple local hit with OSRS-style calculation
      const profile = window.userModule?.getProfile?.();
      
      let attackLevel, maxHit;
      if (currentCombatStyle.type === 'ranged') {
        attackLevel = profile?.skills?.ranged || 1;
        maxHit = calculateMaxHit(attackLevel, 0); // No equipment bonus for now
      } else {
        attackLevel = profile?.skills?.attack || 1;
        maxHit = calculateMaxHit(attackLevel, 0);
      }
      
      const damage = Math.floor(Math.random() * (maxHit + 1));
      
      // For ranged combat in offline mode, still show projectile
      if (currentCombatStyle.type === 'ranged') {
        const playerPos = window.worldModule?.getPlayerPosition();
        const npcElement = document.querySelector(`[data-npc-id="${currentTarget.npcId}"]`);
        
        if (playerPos && npcElement) {
          const playerElement = document.querySelector('.player-character');
          const playerRect = playerElement?.getBoundingClientRect();
          const npcRect = npcElement.getBoundingClientRect();
          
          if (playerRect && npcRect) {
            const startX = playerRect.left + playerRect.width / 2;
            const startY = playerRect.top + playerRect.height / 2;
            const endX = npcRect.left + npcRect.width / 2;
            const endY = npcRect.top + npcRect.height / 2;
            
            createArrowProjectile(startX, startY, endX, endY, () => {
              handleCombatHit({
                attacker: 'player',
                targetType: 'npc',
                targetId: currentTarget.npcId,
                damage,
                remainingHealth: -1
              });
            });
          }
        }
      } else {
        // Immediate hit for melee
        handleCombatHit({
          attacker: 'player',
          targetType: 'npc',
          targetId: currentTarget.npcId,
          damage,
          remainingHealth: -1
        });
      }
      
      awaitingServer = false;
      lastAttackTick = Math.floor(Date.now() / TICK_LENGTH_MS);
      
      if (window.__combatAwaitTimer) { 
        clearTimeout(window.__combatAwaitTimer); 
        window.__combatAwaitTimer = null; 
      }
    }
  }
}

/**
 * Handle a combat hit broadcast from the server and display hit-splats.
 */
function handleCombatHit(data) {
  const { targetType, targetId, damage, attacker } = data;
  console.log(`💥 Combat hit: ${attacker} → ${targetType} ${targetId} for ${damage} damage`);

  let targetElement = null;
  if (targetType === 'npc') {
    if (window.npcModule && window.npcModule.getNPC) {
      const npc = window.npcModule.getNPC(targetId);
      if (npc) {
        const el = document.querySelector(`.npc[data-npc-id="${targetId}"]`);
        if (el) {
          targetElement = el;
          console.log(`💥 Found NPC element for hitsplat:`, el);
        } else {
          console.warn(`💥 NPC element not found for ID: ${targetId}`);
        }
      } else {
        console.warn(`💥 NPC data not found for ID: ${targetId}`);
      }
    }
  } else if (targetType === 'player') {
    const currentUser = window.multiplayerModule?.getCurrentUser?.();
    if (data.target === currentUser?.username) {
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
      
      // Auto retaliate if enabled and we're not already in combat
      if (autoRetaliate && !currentTarget && typeof attacker === 'string' && attacker !== currentUser?.username) {
        // Find the attacking NPC and start combat
        if (window.npcModule?.getNPC) {
          const attackingNPC = window.npcModule.getNPC(attacker);
          if (attackingNPC) {
            console.log(`⚔️ Auto-retaliating against ${attackingNPC.name}`);
            setTimeout(() => startCombat(attackingNPC), 100); // Small delay for retaliation
          }
        }
      } else if (!autoRetaliate) {
        console.log(`⚔️ Auto-retaliate disabled, not retaliating against ${attacker}`);
      }
      
      if (playerCurrentHP <= 0) {
        if (window.showNotification) {
          window.showNotification('You have died!', 'error');
        }
        // Clear combat target on death
        currentTarget = null;
        awaitingServer = false;
        
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
      // Robustly find the DOM element for the target player
      targetElement = null;
      if (window.getOnlinePlayerElement) {
        targetElement = window.getOnlinePlayerElement(data.target);
      }
      if (!targetElement) {
        // Fallback to query selector (case-sensitive)
        targetElement = document.querySelector(`.online-player[data-username="${CSS.escape(data.target)}"]`);
      }
      // If we located the target element and have updated HP info, update their health bar too
      if (targetElement && window.updateOnlinePlayerHP) {
        // Prefer explicit fields from the payload, fallback to remainingHealth if provided
        const newCurHP = typeof data.currentHP === 'number' ? data.currentHP : (typeof data.remainingHealth === 'number' ? data.remainingHealth : null);
        const newMaxHP = typeof data.maxHP === 'number' ? data.maxHP : null;

        if (newCurHP !== null && newMaxHP !== null) {
          window.updateOnlinePlayerHP(data.target, newCurHP, newMaxHP);
        }
      }
    }
  }

  if (targetElement) {
    // Always show hitsplat, even for 0 damage
    console.log(`💥 Showing hitsplat: ${damage} damage on`, targetElement);
    showHitSplat(targetElement, damage);
    if (targetType === 'npc' && window.npcModule?.updateNPCHealth) {
      window.npcModule.updateNPCHealth(targetId, data.remainingHealth);
    }

    // Award XP if the current user is the attacker and target is an NPC
    const currentUser = window.multiplayerModule?.getCurrentUser?.();
    if (currentUser && data.attacker === currentUser.username && targetType === 'npc' && damage > 0) {
      const profile = window.userModule?.getProfile?.();
      if (profile && profile.skills && profile.skillsExp) {
        const styleBonus = getCombatStyleBonus(currentCombatStyle.type, currentCombatStyle.style);
        const xp = damage * 4; // OSRS-style: 4 XP per point of damage
        
        // Award XP based on combat style (note: strength is combined with attack in this system)
        let leveledUp = false;
        if (styleBonus.xpMode === 'shared') {
          // Shared XP between attack and defence (no separate strength skill)
          const sharedXP = Math.floor(xp / 2);
          leveledUp = addExperience('attack', sharedXP, profile.skills, profile.skillsExp) || leveledUp;
          leveledUp = addExperience('defence', sharedXP, profile.skills, profile.skillsExp) || leveledUp;
        } else if (styleBonus.xpMode === 'strength') {
          // Strength XP goes to attack since they're combined
          leveledUp = addExperience('attack', xp, profile.skills, profile.skillsExp);
        } else {
          // Single skill XP (attack, defence, or ranged)
          const xpSkill = currentCombatStyle.type === 'ranged' ? 'ranged' : styleBonus.xpMode;
          leveledUp = addExperience(xpSkill, xp, profile.skills, profile.skillsExp);
        }
        
        // Always award hitpoints XP and capture level-up state for HP specifically
        const hpLeveledUp = addExperience('hitpoints', Math.floor(xp / 3), profile.skills, profile.skillsExp);
        
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

        // Update combat stats display
        updateCombatStats();

        // Refresh profile panel / skill list
        if (window.updateProfileInfo) {
          window.updateProfileInfo();
        }

        if (leveledUp && window.chatModule?.addMessage) {
          window.chatModule.addMessage(`🎉 You advanced a level!`, 'success');
        }

        if (window.uiModule?.updateSkillDisplay) {
          window.uiModule.updateSkillDisplay(styleBonus.xpMode, profile.skills[styleBonus.xpMode], leveledUp);
          // Ensure hitpoints level is refreshed as well
          window.uiModule.updateSkillDisplay('hitpoints', profile.skills.hitpoints, hpLeveledUp);
        }
        if (window.uiModule?.updateTotalLevel) {
          window.uiModule.updateTotalLevel(profile.skills);
        }

        // If HP leveled up, update max HP tracking & HUD
        if (hpLeveledUp) {
          if (typeof playerMaxHP === 'number') {
            playerMaxHP = profile.skills.hitpoints;
            if (playerCurrentHP > playerMaxHP) playerCurrentHP = playerMaxHP;
            if (window.uiModule?.updateHUDHPDisplay) {
              window.uiModule.updateHUDHPDisplay(playerCurrentHP, playerMaxHP);
            }
            // Sync with server
            if (window.syncHitpointsWithServer && window.isUserOnline && window.isUserOnline()) {
              window.syncHitpointsWithServer(playerCurrentHP, playerMaxHP);
            }
          }
        }
      }
    }
  } else {
    // Fallback: show floating damage text even if target element not found
    console.warn(`💥 Target element not found, showing floating damage text for ${damage} damage`);
    showFloatingDamageText(targetType, targetId, damage);
  }

  // If this hit finishes the NPC, clear local target so new clicks needed
  if (targetType === 'npc' && data.remainingHealth !== undefined && data.remainingHealth <= 0) {
    if (currentTarget && currentTarget.npcId === targetId) {
      currentTarget = null;
      awaitingServer = false;
      if (window.__combatAwaitTimer) { clearTimeout(window.__combatAwaitTimer); window.__combatAwaitTimer = null; }
    }
  }

  // Allow sending the next attack after server processed
  if (targetType === 'npc' && data.attacker === window.multiplayerModule?.getCurrentUser()?.username) {
    awaitingServer = false;
    if (window.__combatAwaitTimer) { clearTimeout(window.__combatAwaitTimer); window.__combatAwaitTimer = null; }
    
    // For auto-attack continuation, check if still in combat and target is alive
    if (currentTarget && currentTarget.npcId === targetId && data.remainingHealth > 0) {
      console.log('⚔️ Continuing auto-attack for', currentCombatStyle.type, 'combat');
      // Delay before next attack based on weapon speed
      const attackSpeed = currentWeaponSpeed * TICK_LENGTH_MS;
      setTimeout(() => {
        if (currentTarget && currentTarget.npcId === targetId && canAttack()) {
          // Check if still in range before attacking
          const pos = window.worldModule?.getPlayerPosition();
          if (pos) {
            const dx = Math.abs(Math.floor(pos.x) - Math.floor(currentTarget.x));
            const dy = Math.abs(Math.floor(pos.y) - Math.floor(currentTarget.y));
            const distance = Math.max(dx, dy);
            const attackRange = getAttackRange();
            
            if (distance <= attackRange) {
              handleMovementComplete(); // Trigger next attack
            } else {
              console.log('⚔️ Target out of range for auto-attack, stopping');
              checkCombatDisengagement();
            }
          }
        }
      }, Math.max(100, attackSpeed - 200)); // Slightly faster than weapon speed for responsiveness
    }
  }
}

/**
 * Handle NPC retreating message from server
 */
function handleNPCRetreating(data) {
  // Clear current target if it's the retreating NPC
  if (currentTarget && currentTarget.npcId === data.npcId) {
    currentTarget = null;
    awaitingServer = false;
    if (window.__combatAwaitTimer) { 
      clearTimeout(window.__combatAwaitTimer); 
      window.__combatAwaitTimer = null; 
    }
    
    // Show different message based on combat style
    const message = currentCombatStyle.type === 'ranged' ? 
      'The NPC moved out of range!' : 
      'The NPC retreated!';
    
    if (window.showNotification) {
      window.showNotification(message, 'info');
    }
  }
}

/**
 * Utility to show an OSRS style hit splat above a DOM element.
 */
function showHitSplat(targetElement, damage) {
  const splat = document.createElement('div');
  splat.className = 'hit-splat';
  splat.textContent = damage;
  
  // Determine if this is a player or NPC based on element
  const isPlayer = targetElement.id === 'player-character' || targetElement.classList.contains('online-player');
  
  // OSRS-style hit splat colors and styling
  const isHit = damage > 0;
  let splatColor, backgroundColor, textColor;
  
  if (isPlayer) {
    // Player hit splats: black text on white background for damage, white text on blue for 0
    if (isHit) {
      splatColor = '#cccccc';
      backgroundColor = '#ffffff';
      textColor = 'black';
    } else {
      splatColor = '#0066ff';
      backgroundColor = '#003399';
      textColor = 'white';
    }
  } else {
    // NPC hit splats: white text on red background for damage, white text on blue for 0
    splatColor = isHit ? '#ff3333' : '#0066ff';
    backgroundColor = isHit ? '#8B0000' : '#003399';
    textColor = 'white';
  }
  
  splat.style.cssText = `
    position: absolute;
    top: -25px;
    left: 50%;
    transform: translateX(-50%);
    font-weight: bold;
    color: ${textColor};
    background: ${backgroundColor};
    border: 2px solid ${splatColor};
    border-radius: 50%;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    text-shadow: 1px 1px 1px #000;
    pointer-events: none;
    z-index: 30;
    animation: hit-splat-rise 1.2s forwards;
  `;

  // Ensure target element is positioned relatively
  const prevPos = getComputedStyle(targetElement).position;
  if (prevPos === 'static') {
    targetElement.style.position = 'relative';
  }

  targetElement.appendChild(splat);

  setTimeout(() => {
    splat.remove();
  }, 1200);
}

// Add CSS animation if not present
if (!document.getElementById('combat-styles')) {
  const style = document.createElement('style');
  style.id = 'combat-styles';
  style.textContent = `
    @keyframes hit-splat-rise {
      0% { 
        opacity: 0; 
        transform: translate(-50%, 0) scale(0.5); 
      }
      15% { 
        opacity: 1; 
        transform: translate(-50%, -8px) scale(1.2); 
      }
      30% { 
        transform: translate(-50%, -12px) scale(1); 
      }
      100% { 
        opacity: 0; 
        transform: translate(-50%, -30px) scale(0.8); 
      }
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

/**
 * Initialize the gear interface with event listeners and stat updates
 */
function initializeGearInterface() {
  // Auto-retaliate checkbox
  const autoRetaliateCheckbox = document.getElementById('auto-retaliate');
  if (autoRetaliateCheckbox) {
    autoRetaliateCheckbox.checked = autoRetaliate;
    autoRetaliateCheckbox.addEventListener('change', (e) => {
      setAutoRetaliate(e.target.checked);
    });
  }

  // Combat style selector
  const combatStyleSelect = document.getElementById('combat-style-select');
  if (combatStyleSelect) {
    combatStyleSelect.addEventListener('change', (e) => {
      const value = e.target.value;
      const [type, style] = value.split('-');
      setCombatStyle(type, style);
      updateCombatStats(); // Update displayed stats when style changes
    });
  }

  // Initialize combat stats display
  updateCombatStats();
}

/**
 * Update the combat stats display based on current equipment and skills
 */
function updateCombatStats() {
  const profile = window.userModule?.getProfile?.();
  if (!profile) return;

  // Update combat type based on equipped gear
  updateCombatType();

  const attackLevel = profile.skills?.attack || 1;
  const defenceLevel = profile.skills?.defence || 1;
  const rangedLevel = profile.skills?.ranged || 1;
  const magicLevel = profile.skills?.magic || 1;
  
  // Calculate equipment bonuses from equipped gear
  const equipment = profile.equipment || {};
  let meleeAttack = 0, rangedAttack = 0, magicAttack = 0;
  let meleeDefence = 0, rangedDefence = 0, magicDefence = 0;
  let meleeStrength = 0, rangedStrength = 0;
  let attackSpeed = 4; // Default speed
  
  // Sum bonuses from all equipped items
  Object.values(equipment).forEach(item => {
    if (!item) return;
    const itemDef = window.inventoryModule?.getItemDefinition?.(item.id);
    if (!itemDef?.equipment?.combatStats) return;
    
    const stats = itemDef.equipment.combatStats;
    meleeAttack += stats.meleeAttack || 0;
    rangedAttack += stats.rangedAttack || 0;
    magicAttack += stats.magicAttack || 0;
    meleeDefence += stats.meleeDefence || 0;
    rangedDefence += stats.rangedDefence || 0;
    magicDefence += stats.magicDefence || 0;
    meleeStrength += stats.meleeStrength || 0;
    rangedStrength += stats.rangedStrength || 0;
    
    // Use weapon attack speed if available
    if (itemDef.equipment.slot === 'weapon' && stats.attackSpeed) {
      attackSpeed = stats.attackSpeed;
    }
  });
  
  // Calculate max hit based on current combat style
  const styleBonus = getCombatStyleBonus(currentCombatStyle.type, currentCombatStyle.style);
  let maxHit = 1;
  
  if (currentCombatStyle.type === 'melee') {
    const effectiveLevel = attackLevel + (styleBonus.strength || 0);
    maxHit = calculateMaxHit(effectiveLevel, meleeStrength);
    console.log(`⚔️ [UI] Melee max hit: level ${effectiveLevel} + strength ${meleeStrength} = ${maxHit}`);
  } else if (currentCombatStyle.type === 'ranged') {
    const effectiveLevel = rangedLevel + (styleBonus.ranged || 0);
    maxHit = calculateMaxHit(effectiveLevel, rangedStrength);
    console.log(`🏹 [UI] Ranged max hit calculation:`);
    console.log(`  - Ranged level: ${rangedLevel}`);
    console.log(`  - Style bonus: ${styleBonus.ranged || 0}`);
    console.log(`  - Effective level: ${effectiveLevel}`);
    console.log(`  - Ranged strength: ${rangedStrength}`);
    console.log(`  - Formula: floor(${effectiveLevel}/2.5) + 1 + floor((${effectiveLevel} * ${rangedStrength})/12)`);
    console.log(`  - Result: ${maxHit}`);
  } else if (currentCombatStyle.type === 'magic') {
    const effectiveLevel = magicLevel + (styleBonus.magic || 0);
    maxHit = calculateMaxHit(effectiveLevel, 0); // Magic uses spell damage
    console.log(`🔮 [UI] Magic max hit: level ${effectiveLevel} + spell damage 0 = ${maxHit}`);
  }
  
  // Apply combat style speed bonus
  const finalAttackSpeed = attackSpeed + (styleBonus.speedBonus || 0);
  
  // Update all stat displays
  updateStatDisplay('melee-attack-bonus', meleeAttack);
  updateStatDisplay('ranged-attack-bonus', rangedAttack);
  updateStatDisplay('magic-attack-bonus', magicAttack);
  updateStatDisplay('melee-defence-bonus', meleeDefence);
  updateStatDisplay('ranged-defence-bonus', rangedDefence);
  updateStatDisplay('magic-defence-bonus', magicDefence);
  updateStatDisplay('melee-strength-bonus', meleeStrength);
  updateStatDisplay('ranged-strength-bonus', rangedStrength);
  
  const maxHitEl = document.getElementById('max-hit-display');
  if (maxHitEl) {
    console.log(`🎯 [UI] Setting max hit display to: ${maxHit}`);
    maxHitEl.textContent = maxHit.toString();
    maxHitEl.className = 'stat-value';
  } else {
    console.warn('🎯 [UI] max-hit-display element not found!');
  }
  
  const attackSpeedEl = document.getElementById('attack-speed-display');
  if (attackSpeedEl) {
    attackSpeedEl.textContent = `${finalAttackSpeed} ticks`;
    attackSpeedEl.className = 'stat-value';
  }
}

// Helper function to update stat displays with proper styling
function updateStatDisplay(elementId, value) {
  const element = document.getElementById(elementId);
  if (!element) return;
  
  element.textContent = value >= 0 ? `+${value}` : `${value}`;
  element.className = `stat-value ${value > 0 ? 'positive' : value < 0 ? 'negative' : ''}`;
}

// Clear combat target when player moves away
function clearCombatTarget() {
  if (currentTarget) {
    console.log('⚔️ Clearing combat target due to movement');
    currentTarget = null;
    awaitingServer = false;
    if (window.__combatAwaitTimer) {
      clearTimeout(window.__combatAwaitTimer);
      window.__combatAwaitTimer = null;
    }
  }
}

// Simple notification function if not available elsewhere
function showNotification(message, type = 'info') {
  if (window.inventoryModule?.showNotification) {
    window.inventoryModule.showNotification(message, type);
  } else if (window.showNotification) {
    window.showNotification(message, type);
  } else {
    console.log(`[${type.toUpperCase()}] ${message}`);
  }
}

function consumeArrow() {
  const profile = window.userModule?.getProfile?.();
  if (!profile?.equipment?.arrows) {
    console.log('🏹 [Combat] consumeArrow: No arrows equipped');
    return false;
  }
  
  const arrows = profile.equipment.arrows;
  console.log('🏹 [Combat] consumeArrow: Current arrow count:', arrows.quantity || 1);
  
  if (arrows.quantity > 1) {
    arrows.quantity--;
    console.log('🏹 [Combat] consumeArrow: Reduced arrow quantity to:', arrows.quantity);
  } else {
    // Last arrow - remove completely
    profile.equipment.arrows = null;
    console.log('🏹 [Combat] consumeArrow: Removed last arrow from equipment');
  }
  
  // Update equipment display
  if (window.inventoryModule?.updateEquipmentDisplay) {
    window.inventoryModule.updateEquipmentDisplay();
  }
  
  // Persist equipment change so it survives reloads / syncs
  if (window.userModule?.saveProfile) {
    window.userModule.saveProfile();
  }
  
  // If online, proactively sync inventory/equipment state so other clients stay in sync
  if (window.isUserOnline && window.isUserOnline() && window.syncInventoryWithServer) {
    // Arrow stacks live in equipment, but sending inventory still triggers a server-side profile save
    window.syncInventoryWithServer(window.inventoryModule?.playerInventory || []);
  }
  
  return true;
}

function createArrowProjectile(startX, startY, endX, endY, callback) {
  // Try multiple selectors to find the world container
  let worldContainer = document.querySelector('.world-container');
  if (!worldContainer) {
    worldContainer = document.querySelector('#world-canvas');
  }
  if (!worldContainer) {
    worldContainer = document.querySelector('#game-tab');
  }
  if (!worldContainer) {
    worldContainer = document.querySelector('.game-area');
  }
  
  // If no container found, run callback immediately so combat can continue
  if (!worldContainer) {
    console.warn('[Combat] No suitable container found for projectile animation – skipping visual effect');
    if (callback) callback();
    return;
  }
  
  console.log(`🏹 Creating arrow projectile in container:`, worldContainer.className || worldContainer.id);
  
  // Create arrow element
  const arrow = document.createElement('div');
  arrow.className = 'arrow-projectile';
  arrow.style.cssText = `
    position: absolute;
    width: 20px;
    height: 4px;
    background: linear-gradient(90deg, #8B4513 0%, #D2691E 50%, #8B4513 100%);
    border-radius: 2px;
    z-index: 1000;
    pointer-events: none;
    transform-origin: center;
  `;
  
  // Calculate position and rotation
  const deltaX = endX - startX;
  const deltaY = endY - startY;
  const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  const angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
  
  // Position arrow at start
  arrow.style.left = `${startX}px`;
  arrow.style.top = `${startY}px`;
  arrow.style.transform = `rotate(${angle}deg)`;
  
  worldContainer.appendChild(arrow);
  
  // Animate arrow to target
  const duration = Math.min(800, Math.max(200, distance * 2)); // Scale with distance
  
  arrow.animate([
    { left: `${startX}px`, top: `${startY}px` },
    { left: `${endX}px`, top: `${endY}px` }
  ], {
    duration: duration,
    easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
  }).addEventListener('finish', () => {
    // Remove arrow and trigger callback
    arrow.remove();
    if (callback) callback();
  });
  
  console.log(`🏹 Arrow projectile created: (${startX},${startY}) → (${endX},${endY}) in ${duration}ms`);
}

// Export gear interface functions for external use
export { initializeGearInterface, updateCombatStats, clearCombatTarget };

// Check if player has moved too far from target and should disengage
function checkCombatDisengagement() {
  if (!currentTarget) return;
  
  const pos = window.worldModule?.getPlayerPosition();
  if (!pos) return;
  
  const dx = Math.abs(Math.floor(pos.x) - Math.floor(currentTarget.x));
  const dy = Math.abs(Math.floor(pos.y) - Math.floor(currentTarget.y));
  const distance = Math.max(dx, dy);
  const maxCombatDistance = currentCombatStyle.type === 'ranged' ? 10 : 3; // Ranged: 10 tiles, Melee: 3 tiles
  
  if (distance > maxCombatDistance) {
    console.log(`⚔️ Player moved too far from target (${distance} > ${maxCombatDistance}) - disengaging combat`);
    currentTarget = null;
    awaitingServer = false;
    if (window.__combatAwaitTimer) {
      clearTimeout(window.__combatAwaitTimer);
      window.__combatAwaitTimer = null;
    }
    
    if (window.showNotification) {
      const message = currentCombatStyle.type === 'ranged' ? 
        'You moved too far from your target!' : 
        'You moved away from combat!';
      window.showNotification(message, 'info');
    }
  }
}

// Export the disengagement check so world module can call it on movement
window.checkCombatDisengagement = checkCombatDisengagement;

function showFloatingDamageText(targetType, targetId, damage) {
  // Create floating damage text in the center of the screen as fallback
  const floatingText = document.createElement('div');
  floatingText.className = 'floating-damage-text';
  floatingText.textContent = `${damage}`;
  
  const isHit = damage > 0;
  const color = isHit ? '#ff3333' : '#0066ff';
  const bgColor = isHit ? '#8B0000' : '#003399';
  
  floatingText.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-weight: bold;
    color: white;
    background: ${bgColor};
    border: 2px solid ${color};
    border-radius: 50%;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    text-shadow: 1px 1px 1px #000;
    pointer-events: none;
    z-index: 1000;
    animation: floating-damage-rise 1.5s forwards;
  `;
  
  document.body.appendChild(floatingText);
  
  setTimeout(() => {
    floatingText.remove();
  }, 1500);
}

// Add floating damage animation
if (!document.getElementById('floating-damage-styles')) {
  const style = document.createElement('style');
  style.id = 'floating-damage-styles';
  style.textContent = `
    @keyframes floating-damage-rise {
      0% { 
        opacity: 0; 
        transform: translate(-50%, -50%) scale(0.5); 
      }
      15% { 
        opacity: 1; 
        transform: translate(-50%, -60%) scale(1.2); 
      }
      30% { 
        transform: translate(-50%, -70%) scale(1); 
      }
      100% { 
        opacity: 0; 
        transform: translate(-50%, -100%) scale(0.8); 
      }
    }
  `;
  document.head.appendChild(style);
}