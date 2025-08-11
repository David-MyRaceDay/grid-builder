# Grid Builder - Claude Development Guide

## Project Overview
Grid Builder is a React application for creating professional starting grids for racing events. It allows users to upload CSV race data, configure multiple waves with different start types, and export grids as PDF or CSV files.

## Version Management
This project follows semantic versioning with specific rules:

### Version Format: `MAJOR.MINOR.PATCH`
- **MAJOR**: Breaking changes or major feature overhauls
- **MINOR**: New features, significant updates (increment before deployment)
- **PATCH**: Bug fixes, small improvements, code updates (increment after any code changes)

### Version Update Rules
1. **After ANY code changes**: Increment PATCH version using `npm version patch`
2. **Before deployment**: Increment MINOR version using `npm version minor`
3. **Major releases**: Increment MAJOR version using `npm version major`

**Current Version**: 0.2.4

## Key Technologies
- **React 19.1.1** - Main framework
- **Papa Parse 5.5.3** - CSV parsing
- **jsPDF 3.0.1** - PDF generation
- **Firebase Hosting** - Deployment platform
- **Tailwind CSS 3.4.17** - Utility-first CSS framework
- **shadcn/ui** - Modern React component library
- **Lucide React** - Icon library

## Project Structure
- `src/GridBuilderNew.js` - Main application component (shadcn/ui refactored version)
- `src/GridBuilder.js` - Legacy application component
- `src/components/ui/` - shadcn/ui component library
- `src/lib/utils.js` - Utility functions for component styling
- `src/assets/` - SVG icons and images
- `tailwind.config.js` - Tailwind CSS configuration
- `postcss.config.js` - PostCSS configuration
- `firebase.json` - Firebase hosting configuration
- `package.json` - Dependencies and version

## Key Features
1. **Multi-step workflow**: Upload → Configure → Review → Export
2. **CSV upload and parsing** with error handling
3. **Multi-wave configuration** with flying/standing starts
4. **Class-based sorting** with move up/down controls
5. **Drag-and-drop reordering** in review screen
6. **PDF and CSV export** capabilities
7. **Real-time grid preview** with wave descriptions

## Development Guidelines

### Before Starting Work
- Always read this file to understand current project state
- Check current version in package.json
- Understand the feature being worked on

### During Development
- Make incremental, focused changes
- Test functionality before moving to next task
- Follow existing code patterns and conventions

### After Code Changes
```bash
# Manually increment patch version in package.json after any code changes
# Also update the version display in GridBuilder.js bottom-right corner
# Example: 0.2.0 → 0.2.1
```

### Before Deployment
```bash
# Manually increment minor version in package.json and GridBuilder.js before deploying
# Example: 0.2.1 → 0.3.0
# Then build and deploy
npm run build
firebase deploy
```

### Code Conventions
- Use functional components with React hooks
- Follow existing naming patterns for functions and variables
- Import SVG icons from `./assets/` directory
- Use inline styles for component-specific styling
- Handle errors gracefully with user feedback
- **ALWAYS use My Race Day official color palette** (see Color Guidelines below)

### My Race Day Color Guidelines
**IMPORTANT**: Always reference `src/assets/myraceday-color-palette.html` for official colors.

#### Primary Brand Colors:
- **Racing Red**: `#FF4B4B` (Primary actions, CTAs, brand identity)
- **Racing Red Light**: `#FF6B6B` (Hover states, highlights)  
- **Racing Red Dark**: `#E53E3E` (Active states, emphasis)
- **Track Blue**: `#4B7BFF` (Secondary actions, links, info)
- **Pit Orange**: `#FF8A00` (Warnings, highlights, promotions)
- **Carbon Black**: `#1A1A1A` (Dark mode primary, text)

#### Semantic Colors:
- **Grid Green**: `#00D46A` (Success messages, confirmations)
- **Caution Yellow**: `#FFD700` (Warnings, alerts)
- **Red Flag**: `#FF4B4B` (Errors, critical alerts) 
- **Info Blue**: `#4B7BFF` (Information, notifications, tips)

#### Neutral Palette:
- **White**: `#FFFFFF`
- **Light Grays**: `#F8F9FA`, `#E9ECEF`, `#DEE2E6`, `#CED4DA`, `#ADB5BD`
- **Dark Grays**: `#6C757D`, `#495057`, `#343A40`, `#212529`
- **Carbon Black**: `#1A1A1A`

#### Usage Examples:
```javascript
// Buttons
background: 'linear-gradient(135deg, #FF4B4B 0%, #E53E3E 100%)'  // Primary
background: 'linear-gradient(135deg, #4B7BFF 0%, #3B5BFF 100%)'  // Secondary
background: 'linear-gradient(135deg, #00D46A 0%, #00B359 100%)'  // Success
background: 'linear-gradient(135deg, #6C757D 0%, #495057 100%)'  // Neutral

// Text colors
color: '#4B7BFF'    // Info/links
color: '#FF4B4B'    // Errors/primary
color: '#00D46A'    // Success
color: '#FFD700'    // Warnings

// Backgrounds
background: '#4B7BFF'  // Info sections
background: '#FF8A00'  // Highlights
```

#### Color Usage Rules:
1. **Never use arbitrary colors** - always reference the official palette
2. **Racing Red (#FF4B4B)** for primary CTAs and brand elements
3. **Track Blue (#4B7BFF)** for secondary actions and information
4. **Grid Green (#00D46A)** for success states and positive feedback
5. **Pit Orange (#FF8A00)** for warnings and time-sensitive information
6. **Use gradients** for buttons and prominent elements
7. **Maintain accessibility** - ensure proper contrast ratios

## Important Functions
- `parseCSV()` - Handles file upload and CSV parsing
- `buildGrid()` - Creates final grid from wave configurations
- `generatePDF()` - Exports grid as PDF
- `generateCSV()` - Exports grid as CSV
- `moveClassUp()/moveClassDown()` - Class reordering in waves

## Common Issues & Solutions
- **Class movement double-execution**: Use unique operation keys and proper React state updates
- **CSV parsing errors**: Validate headers and data structure before processing
- **React state updates**: Always create new object references for proper re-rendering

## Deployment Info
- **Firebase Project**: grid-builder-33c3b
- **Live URL**: https://grid-builder-33c3b.web.app
- **Firebase Console**: https://console.firebase.google.com/project/grid-builder-33c3b/overview

## Testing Commands
```bash
# Start development server
npm start

# Build for production
npm run build

# Deploy to Firebase
firebase deploy
```

## Version History Notes
- v0.1.0: Initial Create React App setup
- v0.2.0: Full grid builder functionality with class movement, CSV/PDF export, and Firebase deployment
- v0.2.4: Complete UI refactor to shadcn/ui and Tailwind CSS - modernized components, improved accessibility, maintained My Race Day branding

## Remember
- Always increment patch version after code changes
- Always increment minor version before deployment  
- Test thoroughly before deploying
- Update this file when adding major new features