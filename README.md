# WebscapeRPG

A skill-based RPG web game with a modular JavaScript architecture.

## Features

- 32 different skills with visual tier progression
- User profile management and persistence
- Local storage for saving game progress
- Tabbed interface for different game sections
- Settings management
- Responsive design

## How to Run

There are two ways to run the application:

### 1. Direct File Access (Fallback Mode)

Simply open the `index.html` file in your browser. This will use the fallback script which doesn't rely on ES modules.

**Note**: Some browsers may not allow local storage when running from a file URL, so your progress might not be saved.

### 2. Using the Local Server (Recommended)

For the best experience with all features working correctly:

1. Make sure you have Node.js installed
2. Open a command prompt/terminal in the project directory
3. Run the server:

```
node server.js
```

4. Open your browser and go to http://localhost:8080

## Game Instructions

- **Skills**: Click on a skill level to increase it, right-click to decrease it
- **Tabs**: Click on the tabs at the top to navigate between different sections
- **Settings**: Adjust game settings and character name in the Settings tab
- **Reset**: You can reset all progress in the Settings tab

## Project Structure

- `index.html` - Main HTML file
- `js/` - JavaScript files
  - `main.js` - Main application file
  - `fallback.js` - Fallback script for browsers without ES module support
  - `modules/` - Modular components
    - `skills.js` - Skills data and functions
    - `user.js` - User profile management
    - `storage.js` - Local storage handling
    - `ui.js` - UI components and functions
    - `tabs.js` - Tab navigation
- `css/` - CSS styles
  - `styles.css` - Main stylesheet
- `server.js` - Simple HTTP server for local development

## Browser Compatibility

This application works in:
- Chrome
- Firefox
- Edge
- Safari

For older browsers, the application will automatically fall back to a non-module version.

## License

MIT 