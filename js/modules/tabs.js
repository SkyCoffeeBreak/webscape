/**
 * Tabs module for WebscapeRPG
 * Handles tab navigation and content switching
 */

// Track initialized tabs
let initializedTabs = new Set();

// Initialize tabs
function initializeTabs() {
  console.log('Initializing tabs...');
  const tabs = document.querySelectorAll('.tab');
  
  tabs.forEach(tab => {
    console.log(`Adding listener to tab: ${tab.dataset.tab}`);
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      const tabName = tab.dataset.tab;
      console.log(`Tab clicked: ${tabName}`);
      switchTab(tabName);
    });
  });

  // Force initial tab state (in case DOM loaded incorrectly)
  const activeTab = document.querySelector('.tab.active');
  if (activeTab) {
    switchTab(activeTab.dataset.tab);
  } else if (tabs.length > 0) {
    switchTab(tabs[0].dataset.tab);
  }
}

// Switch active tab
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
  
  // Initialize specific tabs on first access
  if (!initializedTabs.has(tabName)) {
    initializeSpecificTab(tabName);
    initializedTabs.add(tabName);
  }
}

// Initialize specific tab content when first accessed
function initializeSpecificTab(tabName) {
  console.log(`Initializing ${tabName} tab for first time...`);
  
  // Add any tab-specific initializations here as needed
  switch (tabName) {
    default:
      // No special initialization needed
      break;
  }
}

// Export functions
export { 
  initializeTabs,
  switchTab
}; 