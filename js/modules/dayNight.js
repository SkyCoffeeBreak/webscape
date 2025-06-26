/**
 * Day-Night Cycle Module for WebscapeRPG
 * Manages a 15-minute day-night cycle with smooth color transitions
 */

// Day-night cycle constants
// Suggested improvements to your day-night system
// Changes include:
// - Refined filter values to produce more realistic transitions
// - Smoother period durations for visual coherence
// - Tighter color tuning for overlays

const DAY_NIGHT_CONSTANTS = {
  CYCLE_DURATION: 15 * 60 * 1000,
  UPDATE_INTERVAL: 100,
  TIME_PERIODS: {
    NIGHT: { start: 0.0, end: 0.18, name: 'Night' },
    DAWN: { start: 0.18, end: 0.26, name: 'Dawn' },
    MORNING: { start: 0.26, end: 0.34, name: 'Morning' },
    DAY: { start: 0.34, end: 0.66, name: 'Day' },
    AFTERNOON: { start: 0.66, end: 0.74, name: 'Afternoon' },
    DUSK: { start: 0.74, end: 0.82, name: 'Dusk' },
    EVENING: { start: 0.82, end: 0.90, name: 'Evening' },
    NIGHT_LATE: { start: 0.90, end: 1.0, name: 'Late Night' }
  },
  FILTER_EFFECTS: {
    NIGHT: {
      brightness: 0.5,
      contrast: 0.8,
      saturate: 0.7,
      hueRotate: 220,
      overlay: { r: 10, g: 20, b: 60, alpha: 0.45 }
    },
    DAWN: {
      brightness: 0.8,
      contrast: 1.0,
      saturate: 1.2,
      hueRotate: 25,
      overlay: { r: 255, g: 180, b: 130, alpha: 0.15 }
    },
    MORNING: {
      brightness: 0.95,
      contrast: 1.0,
      saturate: 1.05,
      hueRotate: 10,
      overlay: { r: 255, g: 220, b: 200, alpha: 0.08 }
    },
    DAY: {
      brightness: 1.0,
      contrast: 1.0,
      saturate: 1.0,
      hueRotate: 0,
      overlay: { r: 255, g: 255, b: 255, alpha: 0.0 }
    },
    AFTERNOON: {
      brightness: 0.96,
      contrast: 1.0,
      saturate: 1.05,
      hueRotate: 5,
      overlay: { r: 255, g: 235, b: 200, alpha: 0.04 }
    },
    DUSK: {
      brightness: 0.75,
      contrast: 1.05,
      saturate: 1.1,
      hueRotate: 30,
      overlay: { r: 255, g: 160, b: 110, alpha: 0.20 }
    },
    EVENING: {
      brightness: 0.6,
      contrast: 0.9,
      saturate: 0.8,
      hueRotate: 200,
      overlay: { r: 50, g: 40, b: 100, alpha: 0.3 }
    },
    NIGHT_LATE: {
      brightness: 0.45,
      contrast: 0.75,
      saturate: 0.6,
      hueRotate: 240,
      overlay: { r: 15, g: 25, b: 70, alpha: 0.5 }
    }
  }
};

// Day-night system state
let dayNightState = {
  isActive: true,
  startTime: Date.now(),
  currentPeriod: 'DAY',
  currentProgress: 0,
  updateInterval: null,
  overlay: null,
  timeDisplay: null,
  gameArea: null
};

/**
 * Initialize the day-night cycle system
 */
function initializeDayNight() {
  console.log('🌅 Initializing day-night cycle system...');
  
  // Load saved start time or set new one
  loadDayNightState();
  
  // Create overlay element
  createDayNightOverlay();
  
  // Create time display
  createTimeDisplay();
  
  // Start the cycle
  startDayNightCycle();
  
  console.log('🌅 Day-night cycle system initialized');
}

/**
 * Create the visual overlay for day-night effects (targets game area only)
 */
function createDayNightOverlay() {
  // Find the game area - try multiple selectors
  const gameArea = document.querySelector('#game-tab') || 
                   document.querySelector('.game-area') ||
                   document.querySelector('.world-container') ||
                   document.querySelector('.main-content');
  
  if (!gameArea) {
    console.warn('🌅 Could not find game area for day-night effects');
    return;
  }
  
  dayNightState.gameArea = gameArea;
  console.log('🌅 Day-night effects will target:', gameArea.className || gameArea.id);
  
  // Remove existing overlay if present
  const existingOverlay = document.getElementById('day-night-overlay');
  if (existingOverlay) {
    existingOverlay.remove();
  }
  
  // Create new overlay that covers only the game area
  const overlay = document.createElement('div');
  overlay.id = 'day-night-overlay';
  overlay.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 100;
    transition: background-color 3s ease-in-out;
    background-color: rgba(255, 255, 255, 0);
  `;
  
  // Ensure game area has relative positioning for overlay
  const gameAreaStyle = window.getComputedStyle(gameArea);
  if (gameAreaStyle.position === 'static') {
    gameArea.style.position = 'relative';
  }
  
  // Add overlay to game area
  gameArea.appendChild(overlay);
  dayNightState.overlay = overlay;
}

/**
 * Create time display element
 */
function createTimeDisplay() {
  // Remove existing display if present
  const existingDisplay = document.getElementById('time-display');
  if (existingDisplay) {
    existingDisplay.remove();
  }
  
  // Create time display
  const timeDisplay = document.createElement('div');
  timeDisplay.id = 'time-display';
  timeDisplay.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: rgba(0, 0, 0, 0.7);
    color: white;
    padding: 8px 12px;
    border-radius: 8px;
    font-family: 'Courier New', monospace;
    font-size: 12px;
    z-index: 1001;
    border: 1px solid rgba(255, 255, 255, 0.2);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    cursor: pointer;
    user-select: none;
  `;
  
  // Add click handler to toggle day-night cycle
  timeDisplay.addEventListener('click', toggleDayNightCycle);
  timeDisplay.title = 'Click to toggle day-night cycle';
  
  document.body.appendChild(timeDisplay);
  dayNightState.timeDisplay = timeDisplay;
}

/**
 * Start the day-night cycle updates
 */
function startDayNightCycle() {
  if (dayNightState.updateInterval) {
    clearInterval(dayNightState.updateInterval);
  }
  
  dayNightState.updateInterval = setInterval(() => {
    if (dayNightState.isActive) {
      updateDayNightCycle();
    }
  }, DAY_NIGHT_CONSTANTS.UPDATE_INTERVAL);
  
  // Initial update
  updateDayNightCycle();
}

/**
 * Update the day-night cycle
 */
function updateDayNightCycle() {
  const now = Date.now();
  const elapsed = now - dayNightState.startTime;
  const cycleProgress = (elapsed % DAY_NIGHT_CONSTANTS.CYCLE_DURATION) / DAY_NIGHT_CONSTANTS.CYCLE_DURATION;
  
  dayNightState.currentProgress = cycleProgress;
  
  // Determine current time period
  const currentPeriod = getCurrentTimePeriod(cycleProgress);
  dayNightState.currentPeriod = currentPeriod;
  
  // Apply comprehensive lighting effects (filters + overlay)
  const overlayColor = applyLightingEffects(cycleProgress, currentPeriod);
  
  // Apply overlay color
  if (dayNightState.overlay && overlayColor) {
    dayNightState.overlay.style.backgroundColor = overlayColor;
  }
  
  // Update time display
  updateTimeDisplay(currentPeriod, cycleProgress);
  
  // Save state periodically
  if (elapsed % 10000 < DAY_NIGHT_CONSTANTS.UPDATE_INTERVAL) { // Every 10 seconds
    saveDayNightState();
  }
}

/**
 * Determine current time period based on cycle progress
 */
function getCurrentTimePeriod(progress) {
  const periods = DAY_NIGHT_CONSTANTS.TIME_PERIODS;
  
  for (const [key, period] of Object.entries(periods)) {
    if (progress >= period.start && progress < period.end) {
      return key;
    }
  }
  
  // Default to night if somehow out of range
  return 'NIGHT';
}

/**
 * Apply comprehensive lighting effects using CSS filters and overlays
 */
function applyLightingEffects(progress, currentPeriodKey) {
  if (!dayNightState.gameArea || !dayNightState.overlay) return;
  
  const periods = DAY_NIGHT_CONSTANTS.TIME_PERIODS;
  const effects = DAY_NIGHT_CONSTANTS.FILTER_EFFECTS;
  const currentPeriod = periods[currentPeriodKey];
  const currentEffects = effects[currentPeriodKey];
  
  // Calculate how far through the current period we are
  const periodProgress = (progress - currentPeriod.start) / (currentPeriod.end - currentPeriod.start);
  
  // Determine next period for smooth transitions
  const nextPeriodKey = getNextPeriod(currentPeriodKey);
  const nextEffects = effects[nextPeriodKey];
  
  // Smooth transition in the last 20% of each period
  const transitionThreshold = 0.8;
  let finalEffects = currentEffects;
  
  if (periodProgress >= transitionThreshold) {
    const transitionProgress = (periodProgress - transitionThreshold) / (1 - transitionThreshold);
    
    // Interpolate between current and next effects
    finalEffects = {
      brightness: currentEffects.brightness + (nextEffects.brightness - currentEffects.brightness) * transitionProgress,
      contrast: currentEffects.contrast + (nextEffects.contrast - currentEffects.contrast) * transitionProgress,
      saturate: currentEffects.saturate + (nextEffects.saturate - currentEffects.saturate) * transitionProgress,
      hueRotate: currentEffects.hueRotate + (nextEffects.hueRotate - currentEffects.hueRotate) * transitionProgress,
      overlay: {
        r: Math.round(currentEffects.overlay.r + (nextEffects.overlay.r - currentEffects.overlay.r) * transitionProgress),
        g: Math.round(currentEffects.overlay.g + (nextEffects.overlay.g - currentEffects.overlay.g) * transitionProgress),
        b: Math.round(currentEffects.overlay.b + (nextEffects.overlay.b - currentEffects.overlay.b) * transitionProgress),
        alpha: currentEffects.overlay.alpha + (nextEffects.overlay.alpha - currentEffects.overlay.alpha) * transitionProgress
      }
    };
  }
  
  // Apply CSS filters to the game area for immersive lighting
  const filterString = `
    brightness(${finalEffects.brightness})
    contrast(${finalEffects.contrast})
    saturate(${finalEffects.saturate})
    hue-rotate(${finalEffects.hueRotate}deg)
  `.trim();
  
  dayNightState.gameArea.style.filter = filterString;
  dayNightState.gameArea.style.transition = 'filter 3s ease-in-out';
  
  // Apply subtle color overlay for additional atmosphere
  const overlay = finalEffects.overlay;
  return `rgba(${overlay.r}, ${overlay.g}, ${overlay.b}, ${overlay.alpha})`;
}

/**
 * Get the next time period in the cycle
 */
function getNextPeriod(currentPeriodKey) {
  const periodKeys = Object.keys(DAY_NIGHT_CONSTANTS.TIME_PERIODS);
  const currentIndex = periodKeys.indexOf(currentPeriodKey);
  const nextIndex = (currentIndex + 1) % periodKeys.length;
  return periodKeys[nextIndex];
}

/**
 * Update the time display
 */
function updateTimeDisplay(currentPeriod, progress) {
  if (!dayNightState.timeDisplay) return;
  
  const periodName = DAY_NIGHT_CONSTANTS.TIME_PERIODS[currentPeriod].name;
  const timeString = formatGameTime(progress);
  const cyclePercentage = Math.round(progress * 100);
  
  const statusIndicator = dayNightState.isActive ? '🌍' : '⏸️';
  
  dayNightState.timeDisplay.innerHTML = `
    ${statusIndicator} ${timeString}<br>
    <span style="font-size: 10px; opacity: 0.8;">${periodName} (${cyclePercentage}%)</span>
  `;
}

/**
 * Format game time as a 24-hour clock
 */
function formatGameTime(progress) {
  // Map progress (0-1) to 24-hour time
  const totalMinutes = Math.round(progress * 24 * 60);
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * Toggle day-night cycle on/off
 */
function toggleDayNightCycle() {
  dayNightState.isActive = !dayNightState.isActive;
  
  if (dayNightState.isActive) {
    console.log('🌅 Day-night cycle resumed');
    // Reset start time to account for pause
    const now = Date.now();
    const pausedProgress = dayNightState.currentProgress;
    dayNightState.startTime = now - (pausedProgress * DAY_NIGHT_CONSTANTS.CYCLE_DURATION);
  } else {
    console.log('⏸️ Day-night cycle paused');
  }
  
  saveDayNightState();
  updateTimeDisplay(dayNightState.currentPeriod, dayNightState.currentProgress);
}

/**
 * Save day-night state to localStorage
 */
function saveDayNightState() {
  try {
    const state = {
      startTime: dayNightState.startTime,
      isActive: dayNightState.isActive
    };
    localStorage.setItem('dayNightState', JSON.stringify(state));
  } catch (error) {
    console.warn('Failed to save day-night state:', error);
  }
}

/**
 * Load day-night state from localStorage
 */
function loadDayNightState() {
  try {
    const saved = localStorage.getItem('dayNightState');
    if (saved) {
      const state = JSON.parse(saved);
      dayNightState.startTime = state.startTime || Date.now();
      dayNightState.isActive = state.isActive !== undefined ? state.isActive : true;
      
      console.log('🌅 Loaded day-night state from storage');
    } else {
      dayNightState.startTime = Date.now();
      console.log('🌅 Starting new day-night cycle');
    }
  } catch (error) {
    console.warn('Failed to load day-night state:', error);
    dayNightState.startTime = Date.now();
  }
}

/**
 * Get current time information
 */
function getCurrentTimeInfo() {
  return {
    period: dayNightState.currentPeriod,
    periodName: DAY_NIGHT_CONSTANTS.TIME_PERIODS[dayNightState.currentPeriod]?.name || 'Unknown',
    progress: dayNightState.currentProgress,
    gameTime: formatGameTime(dayNightState.currentProgress),
    isActive: dayNightState.isActive
  };
}

/**
 * Set time to specific period (for testing/admin)
 */
function setTimePeriod(periodKey) {
  if (!DAY_NIGHT_CONSTANTS.TIME_PERIODS[periodKey]) {
    console.warn('Invalid time period:', periodKey);
    return false;
  }
  
  const period = DAY_NIGHT_CONSTANTS.TIME_PERIODS[periodKey];
  const targetProgress = (period.start + period.end) / 2; // Middle of the period
  
  const now = Date.now();
  dayNightState.startTime = now - (targetProgress * DAY_NIGHT_CONSTANTS.CYCLE_DURATION);
  
  saveDayNightState();
  console.log(`🌅 Time set to ${period.name}`);
  return true;
}

/**
 * Cleanup day-night system
 */
function cleanup() {
  if (dayNightState.updateInterval) {
    clearInterval(dayNightState.updateInterval);
    dayNightState.updateInterval = null;
  }
  
  // Reset CSS filters on game area
  if (dayNightState.gameArea) {
    dayNightState.gameArea.style.filter = '';
    dayNightState.gameArea.style.transition = '';
    dayNightState.gameArea = null;
  }
  
  if (dayNightState.overlay) {
    dayNightState.overlay.remove();
    dayNightState.overlay = null;
  }
  
  if (dayNightState.timeDisplay) {
    dayNightState.timeDisplay.remove();
    dayNightState.timeDisplay = null;
  }
  
  console.log('🌅 Day-night system cleaned up');
}

// Export functions
export {
  initializeDayNight,
  toggleDayNightCycle,
  getCurrentTimeInfo,
  setTimePeriod,
  cleanup,
  DAY_NIGHT_CONSTANTS
}; 