/**
 * Standalone Map Editor for WebscapeRPG
 * Uses the layered map editor system
 */

import { initializeMapEditor } from './modules/mapeditor.js';

// Initialize the standalone map editor
function initializeStandaloneMapEditor() {
  console.log('Initializing standalone map editor with layered system...');
  
  try {
    // Initialize the layered map editor
    initializeMapEditor();
    
    // Set up back to game button
    const backButton = document.getElementById('back-to-game');
    if (backButton) {
      backButton.addEventListener('click', () => {
        window.location.href = 'index.html';
      });
    }
    
    console.log('Standalone map editor initialized successfully');
  } catch (error) {
    console.error('Error initializing standalone map editor:', error);
  }
}

// Export the initialization function
export { initializeStandaloneMapEditor }; 