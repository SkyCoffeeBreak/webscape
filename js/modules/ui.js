/**
 * UI module for WebscapeRPG
 * Handles user interface components and interactions
 */

import { getTierClass, calculateTotalLevel, getSkillExperienceInfo, addExperience, validateSkillsExperience, formatExperienceFull } from './skills.js';

// Live bindings for HP display helpers (defined later in initializeSkillsUI)
let ensureHPDisplayElement;
let updateCurrentHPDisplay;

// Initialize the skills UI
function initializeSkillsUI(profile, callbacks = {}) {
  // Validate and fix any missing/invalid skill experience data
  const validatedData = validateSkillsExperience(profile.skills, profile.skillsExp);
  profile.skills = validatedData.skills;
  profile.skillsExp = validatedData.skillsExp;
  
  updateAllSkillDisplays(profile.skills);
  updateTotalLevel(profile.skills);
  updateAllExperienceBars();
  
  // Add event listeners
  document.querySelectorAll('.skill-level').forEach(element => {
    const skillName = element.closest('.skill').dataset.skill;
    
    // Left click to increment
    element.addEventListener('click', (e) => {
      e.preventDefault();
      incrementSkill(skillName, profile);
      
      // Call onSkillChange callback if provided
      if (callbacks.onSkillChange) {
        callbacks.onSkillChange();
      }
    });
    
    // Right click to decrement
    element.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      decrementSkill(skillName, profile);
      
      // Call onSkillChange callback if provided
      if (callbacks.onSkillChange) {
        callbacks.onSkillChange();
      }
    });
  });
  
  // Add hover event listeners for experience tooltips
  document.querySelectorAll('.skill').forEach(skillElement => {
    const skillName = skillElement.dataset.skill;
    let tooltipRefreshInterval = null;
    
    skillElement.addEventListener('mouseenter', (e) => {
      // Always get fresh profile data for tooltips
      const freshProfile = window.userModule ? window.userModule.getProfile() : profile;
      showSkillTooltip(e, skillName, freshProfile);
      
      // Set up auto-refresh for tooltip while hovering
      tooltipRefreshInterval = setInterval(() => {
        const currentProfile = window.userModule ? window.userModule.getProfile() : profile;
        refreshSkillTooltip(skillName, currentProfile);
      }, 200); // Refresh every 200ms
    });
    
    skillElement.addEventListener('mouseleave', (e) => {
      hideSkillTooltip();
      // Clear the refresh interval
      if (tooltipRefreshInterval) {
        clearInterval(tooltipRefreshInterval);
        tooltipRefreshInterval = null;
      }
    });
    
    skillElement.addEventListener('mousemove', (e) => {
      updateSkillTooltipPosition(e);
    });
  });
  
  // Add control button listeners
  document.querySelector('.control-btn[data-action="randomize"]')?.addEventListener('click', () => {
    randomizeSkills(profile);
    
    // Call onSkillChange callback if provided
    if (callbacks.onSkillChange) {
      callbacks.onSkillChange();
    }
  });
  
  document.querySelector('.control-btn[data-action="reset"]')?.addEventListener('click', () => {
    resetSkills(profile);
    
    // Call onSkillChange callback if provided
    if (callbacks.onSkillChange) {
      callbacks.onSkillChange();
    }
  });

  // ===== Player HP Display =====
  ensureHPDisplayElement = function() {
    let hpEl = document.getElementById('current-hp-display');
    if (!hpEl) {
      // Insert after controls area inside the skills tab
      const skillsTab = document.querySelector('#skills-tab .skill-ui');
      if (!skillsTab) return null;
      hpEl = document.createElement('div');
      hpEl.id = 'current-hp-display';
      hpEl.style.cssText = `
        margin: 6px 0 8px 0;
        padding: 4px 8px;
        background: rgba(0,0,0,0.6);
        color: #fff;
        font-weight: bold;
        border-radius: 4px;
        text-align: center;
      `;
      skillsTab.insertBefore(hpEl, skillsTab.querySelector('.skill')); // place above first skill grid
    }
    return hpEl;
  }

  updateCurrentHPDisplay = function(curHP, maxHP) {
    const hpEl = ensureHPDisplayElement();
    if (!hpEl) return;
    hpEl.textContent = `Hitpoints: ${curHP} / ${maxHP}`;
  }

  // (HUD HP handled elsewhere; no skills-tab HP)

  // Expose to other modules immediately (main.js later augments window.uiModule)
  if (!window.uiModule) window.uiModule = {};
  window.uiModule.updateCurrentHPDisplay = updateCurrentHPDisplay;
}

// Update all skill displays with proper tier styling
function updateAllSkillDisplays(skills) {
  Object.keys(skills).forEach(skillName => {
    updateSkillDisplay(skillName, skills[skillName]);
  });
  updateAllExperienceBars();
}

// Update a single skill display
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
    
    // Add level-up animation if requested
    if (animate) {
      iconElement.classList.add('level-up');
      setTimeout(() => {
        iconElement.classList.remove('level-up');
      }, 300);
    }
  }
  
  // Update experience bar if it exists
  updateSkillExperienceBar(skillName);
}

// New function to update experience bars for skills
function updateSkillExperienceBar(skillName) {
  console.log(`📊 Updating experience bar for ${skillName}`);
  
  const skillElement = document.querySelector(`[data-skill="${skillName}"]`);
  if (!skillElement) {
    console.warn(`❌ No skill element found for ${skillName}`);
    return;
  }
  
  // Get user profile to access experience data
  const profile = window.userModule ? window.userModule.getProfile() : null;
  if (!profile || !profile.skills || !profile.skillsExp) {
    console.warn(`❌ No profile or experience data found for ${skillName}`);
    return;
  }
  
  console.log(`📊 Profile data for ${skillName}: Level ${profile.skills[skillName]}, XP ${profile.skillsExp[skillName] || 0}`);
  
  // Find or create experience bar
  let expBar = skillElement.querySelector('.skill-exp-bar');
  if (!expBar) {
    console.log(`📊 Creating experience bar for ${skillName}`);
    // Create experience bar element
    expBar = document.createElement('div');
    expBar.className = 'skill-exp-bar';
    
    const expFill = document.createElement('div');
    expFill.className = 'skill-exp-fill';
    expBar.appendChild(expFill);
    
    // Insert after skill level
    const levelElement = skillElement.querySelector('.skill-level');
    if (levelElement) {
      levelElement.parentNode.insertBefore(expBar, levelElement.nextSibling);
    } else {
      skillElement.appendChild(expBar);
    }
  }
  
  // Get experience information
  const expInfo = getSkillExperienceInfo(skillName, profile.skills, profile.skillsExp);
  const expFill = expBar.querySelector('.skill-exp-fill');
  
  console.log(`📊 Experience info for ${skillName}:`, {
    currentLevel: expInfo.currentLevel,
    currentExp: expInfo.currentExp,
    progressPercent: expInfo.progressPercent,
    isMaxLevel: expInfo.isMaxLevel
  });
  
  if (expFill) {
    // Update the experience bar width
    expFill.style.width = `${expInfo.progressPercent}%`;
    
    // Add experience amount as tooltip
    expBar.title = `${expInfo.expProgress.toLocaleString()} / ${(expInfo.expForNextLevel - expInfo.expForThisLevel).toLocaleString()} XP to level ${expInfo.nextLevel}`;
    
    // Special handling for level 99
    if (expInfo.isMaxLevel) {
      expFill.style.width = '100%';
      expBar.title = `Level 99 (Max) - ${expInfo.currentExp.toLocaleString()} total XP`;
    }
    
    console.log(`✅ Updated experience bar for ${skillName}: ${expInfo.progressPercent}% width`);
  } else {
    console.warn(`❌ No experience fill element found for ${skillName}`);
  }
}

// New function to update all experience bars
function updateAllExperienceBars() {
  const profile = window.userModule ? window.userModule.getProfile() : null;
  if (!profile || !profile.skills) return;
  
  Object.keys(profile.skills).forEach(skillName => {
    updateSkillExperienceBar(skillName);
  });
  
  // Add a subtle visual indicator that experience bars have been updated
  // This helps players see that their XP progress is being tracked
  const skillElements = document.querySelectorAll('.skill-exp-fill');
  skillElements.forEach(expFill => {
    if (expFill) {
      expFill.style.transition = 'width 0.8s ease-in-out';
    }
  });
}

// Update the total level display
function updateTotalLevel(skills) {
  const totalLevel = calculateTotalLevel(skills);
  
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

// Increment a skill level (for UI testing)
function incrementSkill(skillName, profile) {
  const minLevel = skillName === 'hitpoints' ? 10 : 1;
  
  if (profile.skills[skillName] < 99) {
    const oldTier = getTierClass(profile.skills[skillName]);
    profile.skills[skillName]++;
    const newTier = getTierClass(profile.skills[skillName]);
    
    // Animate if tier changed
    const tierChanged = oldTier !== newTier;
    updateSkillDisplay(skillName, profile.skills[skillName], tierChanged);
    updateTotalLevel(profile.skills);
    
    // Sync with server if online
    if (window.syncSkillsWithServer && window.isUserOnline && window.isUserOnline()) {
      const totalLevel = window.calculateTotalLevel ? window.calculateTotalLevel(profile.skills) : 0;
      const combatLevel = window.calculateCombatLevel ? window.calculateCombatLevel(profile.skills) : 0;
      window.syncSkillsWithServer(profile.skills, totalLevel, combatLevel, profile.skillsExp);
    }
  }
}

// Decrement a skill level (for UI testing)
function decrementSkill(skillName, profile) {
  const minLevel = skillName === 'hitpoints' ? 10 : 1;
  
  if (profile.skills[skillName] > minLevel) {
    profile.skills[skillName]--;
    updateSkillDisplay(skillName, profile.skills[skillName]);
    updateTotalLevel(profile.skills);
    
    // Sync with server if online
    if (window.syncSkillsWithServer && window.isUserOnline && window.isUserOnline()) {
      const totalLevel = window.calculateTotalLevel ? window.calculateTotalLevel(profile.skills) : 0;
      const combatLevel = window.calculateCombatLevel ? window.calculateCombatLevel(profile.skills) : 0;
      window.syncSkillsWithServer(profile.skills, totalLevel, combatLevel, profile.skillsExp);
    }
  }
}

// Randomize all skills (for UI testing)
function randomizeSkills(profile) {
  Object.keys(profile.skills).forEach(skillName => {
    const minLevel = skillName === 'hitpoints' ? 10 : 1;
    const oldLevel = profile.skills[skillName];
    profile.skills[skillName] = Math.floor(Math.random() * 99) + minLevel;
    
    const animate = getTierClass(oldLevel) !== getTierClass(profile.skills[skillName]);
    updateSkillDisplay(skillName, profile.skills[skillName], animate);
  });
  
  updateTotalLevel(profile.skills);
  
  // Sync with server if online
  if (window.syncSkillsWithServer && window.isUserOnline && window.isUserOnline()) {
    const totalLevel = window.calculateTotalLevel ? window.calculateTotalLevel(profile.skills) : 0;
    const combatLevel = window.calculateCombatLevel ? window.calculateCombatLevel(profile.skills) : 0;
    window.syncSkillsWithServer(profile.skills, totalLevel, combatLevel, profile.skillsExp);
  }
}

// Reset all skills to level 1 (hitpoints to 10)
function resetSkills(profile) {
  Object.keys(profile.skills).forEach(skillName => {
    if (skillName === 'hitpoints') {
      profile.skills[skillName] = 10;
      profile.skillsExp[skillName] = 1154; // Level 10 hitpoints = 1154 XP
    } else {
      profile.skills[skillName] = 1;
      profile.skillsExp[skillName] = 0; // Level 1 = 0 XP
    }
    updateSkillDisplay(skillName, profile.skills[skillName]);
  });
  
  updateTotalLevel(profile.skills);
  
  // Save the profile after reset
  if (window.userModule?.saveProfile) {
    window.userModule.saveProfile();
  }
  
  // Sync with server if online
  if (window.syncSkillsWithServer && window.isUserOnline && window.isUserOnline()) {
    const totalLevel = window.calculateTotalLevel ? window.calculateTotalLevel(profile.skills) : 0;
    const combatLevel = window.calculateCombatLevel ? window.calculateCombatLevel(profile.skills) : 0;
    window.syncSkillsWithServer(profile.skills, totalLevel, combatLevel, profile.skillsExp);
  }
  
  // Show notification
  if (window.uiModule?.showNotification) {
    window.uiModule.showNotification('All skills have been reset! Hitpoints set to 10, all others to 1.', 'success');
  }
}

// Display a notification message
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

// Show skill experience tooltip
function showSkillTooltip(event, skillName, profile) {
  // Get fresh profile data to ensure we have the latest experience values
  const freshProfile = window.userModule ? window.userModule.getProfile() : profile;
  
  const expInfo = getSkillExperienceInfo(skillName, freshProfile.skills, freshProfile.skillsExp);
  
  // Create tooltip if it doesn't exist
  let tooltip = document.getElementById('skill-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.id = 'skill-tooltip';
    tooltip.className = 'skill-tooltip';
    document.body.appendChild(tooltip);
  }
  
  // Format skill name for display
  const displayName = skillName.charAt(0).toUpperCase() + skillName.slice(1);
  
  // Create tooltip content with full precision numbers
  let content = `
    <div class="tooltip-header">
      <strong>${displayName}</strong>
    </div>
    <div class="tooltip-level">Level: ${expInfo.currentLevel}</div>
    <div class="tooltip-exp">XP: ${expInfo.currentExpFormattedFull}</div>
  `;
  
  if (expInfo.isMaxLevel) {
    content += `
      <div class="tooltip-progress">
        <div class="tooltip-max">Maximum level reached!</div>
        <div class="tooltip-overflow">Overflow XP: ${expInfo.expProgressFormattedFull}</div>
      </div>
    `;
  } else {
    content += `
      <div class="tooltip-next">Exp to next level: ${expInfo.expNeededFormattedFull}</div>
      <div class="tooltip-progress">
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${expInfo.progressPercent}%"></div>
        </div>
        <div class="progress-text">${expInfo.progressPercent.toFixed(1)}% to level ${expInfo.nextLevel}</div>
      </div>
    `;
  }
  
  tooltip.innerHTML = content;
  tooltip.style.display = 'block';
  
  // Position tooltip
  updateSkillTooltipPosition(event);
}

// Hide skill experience tooltip
function hideSkillTooltip() {
  const tooltip = document.getElementById('skill-tooltip');
  if (tooltip) {
    tooltip.style.display = 'none';
  }
}

// Refresh skill tooltip content (for auto-updating while hovering)
function refreshSkillTooltip(skillName, profile) {
  const tooltip = document.getElementById('skill-tooltip');
  if (!tooltip || tooltip.style.display === 'none') return;
  
  // Get fresh profile data to ensure we have the latest experience values
  const freshProfile = window.userModule ? window.userModule.getProfile() : profile;
  const expInfo = getSkillExperienceInfo(skillName, freshProfile.skills, freshProfile.skillsExp);
  
  // Format skill name for display
  const displayName = skillName.charAt(0).toUpperCase() + skillName.slice(1);
  
  // Update tooltip content with fresh data
  let content = `
    <div class="tooltip-header">
      <strong>${displayName}</strong>
    </div>
    <div class="tooltip-level">Level: ${expInfo.currentLevel}</div>
    <div class="tooltip-exp">XP: ${expInfo.currentExpFormattedFull}</div>
  `;
  
  if (expInfo.isMaxLevel) {
    content += `
      <div class="tooltip-progress">
        <div class="tooltip-max">Maximum level reached!</div>
        <div class="tooltip-overflow">Overflow XP: ${expInfo.expProgressFormattedFull}</div>
      </div>
    `;
  } else {
    content += `
      <div class="tooltip-next">Exp to next level: ${expInfo.expNeededFormattedFull}</div>
      <div class="tooltip-progress">
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${expInfo.progressPercent}%"></div>
        </div>
        <div class="progress-text">${expInfo.progressPercent.toFixed(1)}% to level ${expInfo.nextLevel}</div>
      </div>
    `;
  }
  
  tooltip.innerHTML = content;
}

// Update tooltip position
function updateSkillTooltipPosition(event) {
  const tooltip = document.getElementById('skill-tooltip');
  if (!tooltip || tooltip.style.display === 'none') return;
  
  const offset = 10;
  let x = event.pageX + offset;
  let y = event.pageY + offset;
  
  // Prevent tooltip from going off-screen
  const tooltipRect = tooltip.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  if (x + tooltipRect.width > viewportWidth) {
    x = event.pageX - tooltipRect.width - offset;
  }
  
  if (y + tooltipRect.height > viewportHeight) {
    y = event.pageY - tooltipRect.height - offset;
  }
  
  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;
}

// Test function to add experience to skills (for testing the tooltip system)
function addExperienceToSkill(skillName, amount, profile) {
  if (!profile.skillsExp) {
    profile.skillsExp = {};
  }
  
  const leveledUp = addExperience(skillName, amount, profile.skills, profile.skillsExp);
  
  if (leveledUp) {
    updateSkillDisplay(skillName, profile.skills[skillName], true);
    updateTotalLevel(profile.skills);
    showNotification(`Level up! Your ${skillName} level is now ${profile.skills[skillName]}!`, 'success');
  } else {
    updateSkillDisplay(skillName, profile.skills[skillName], false);
  }
  
  // Add visual feedback for experience gain
  const skillElement = document.querySelector(`[data-skill="${skillName}"]`);
  if (skillElement) {
    const expFill = skillElement.querySelector('.skill-exp-fill');
    if (expFill) {
      expFill.classList.add('exp-gain');
      setTimeout(() => {
        expFill.classList.remove('exp-gain');
      }, 600);
    }
  }
  
  // Sync with server if online (for experience gains)
  if (window.syncSkillsWithServer && window.isUserOnline && window.isUserOnline()) {
    const totalLevel = window.calculateTotalLevel ? window.calculateTotalLevel(profile.skills) : 0;
    const combatLevel = window.calculateCombatLevel ? window.calculateCombatLevel(profile.skills) : 0;
    window.syncSkillsWithServer(profile.skills, totalLevel, combatLevel, profile.skillsExp);
  }
  
  return leveledUp;
}

// Export all functions
export {
  initializeSkillsUI,
  updateAllSkillDisplays,
  updateSkillDisplay,
  updateTotalLevel,
  incrementSkill,
  decrementSkill,
  randomizeSkills,
  resetSkills,
  showNotification,
  addExperienceToSkill,
  updateSkillExperienceBar,
  updateAllExperienceBars,
  updateCurrentHPDisplay
}; 