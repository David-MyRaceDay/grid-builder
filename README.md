# Grid Builder

![Version](https://img.shields.io/badge/version-0.2.4-blue.svg)
![React](https://img.shields.io/badge/react-19.1.1-blue.svg)
![License](https://img.shields.io/badge/license-Private-red.svg)

A professional racing grid builder application designed for motorsport event organizers. Create starting grids from CSV race data with advanced multi-wave configuration, intuitive drag-and-drop editing, and professional PDF/CSV export capabilities.

## ✨ Features

### 🏁 **Core Functionality**
- **CSV Data Import**: Upload race results from MyLaps Orbits or other timing systems
- **Multi-Wave Configuration**: Create up to 10 different starting waves
- **Flexible Sorting**: Sort by position, best time, second best time, or points
- **Grid Ordering**: Straight up, fastest class first, or slowest class first options
- **Inversion Control**: Invert entire grid or specific number of positions

### 🎯 **Advanced Features**
- **Drag & Drop Editing**: Manually adjust driver positions with intuitive interface
- **Class Management**: Move entire classes up/down in multi-class events
- **Wave Merging**: Combine waves for optimal field management
- **Flying/Standing Starts**: Configure different start types per wave
- **Empty Position Handling**: Add gaps between waves for safety

### 📊 **Export Options**
- **Professional PDF**: Print-ready grid sheets with timing and driver information
- **CSV Export**: Spreadsheet-compatible format for further processing
- **Custom Grid Names**: Brand your starting grids with event information

### 🎨 **Modern UI**
- **shadcn/ui Components**: Modern, accessible React component library
- **Tailwind CSS**: Utility-first styling for responsive design
- **My Race Day Branding**: Official color scheme and professional appearance
- **Responsive Design**: Works on desktop, tablet, and mobile devices

## 🚀 Quick Start

### Prerequisites
- Node.js 16.x or higher
- npm or yarn package manager

### Installation

```bash
# Clone the repository
git clone https://github.com/David-MyRaceDay/grid-builder.git
cd grid-builder

# Install dependencies
npm install

# Start development server
npm start
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### Building for Production

```bash
# Create optimized production build
npm run build

# The build folder contains the production-ready files
```

## 📁 Project Structure

```
src/
├── GridBuilderNew.js      # Main application component (shadcn/ui version)
├── GridBuilder.js         # Legacy component (maintained for reference)
├── components/ui/         # shadcn/ui component library
│   ├── button.jsx
│   ├── card.jsx
│   ├── input.jsx
│   └── ...
├── lib/utils.js          # Utility functions for styling
├── assets/               # SVG icons and brand assets
│   ├── racing-flag.svg
│   ├── myraceday-color-palette.html
│   └── ...
├── index.css            # Global styles with Tailwind directives
└── App.js              # Root component
```

## 🛠️ Technology Stack

- **Frontend Framework**: React 19.1.1
- **UI Components**: shadcn/ui
- **Styling**: Tailwind CSS 3.4.17
- **CSV Processing**: Papa Parse 5.5.3
- **PDF Generation**: jsPDF 3.0.1
- **Icons**: Lucide React
- **Build Tool**: Create React App
- **Hosting**: Firebase Hosting

## 🎨 Design System

The application uses the **My Race Day** official color palette:

- **Racing Red**: `#FF4B4B` - Primary actions and brand identity
- **Track Blue**: `#4B7BFF` - Secondary actions and information
- **Grid Green**: `#00D46A` - Success states and confirmations
- **Pit Orange**: `#FF8A00` - Warnings and highlights
- **Carbon Black**: `#1A1A1A` - Dark mode and text

## 📖 Usage Guide

### 1. Upload CSV Files
- Drag and drop or browse for CSV files exported from timing systems
- Supports MyLaps Orbits format and standard racing data formats
- Required columns: Driver, Number, Class
- Optional columns: Best Time, 2nd Best Time, Points, Position

### 2. Configure Waves
- Set the number of starting waves (1-10)
- Assign classes to each wave
- Choose sorting criteria (position, time, points)
- Configure grid order and inversion options
- Set start types (flying or standing starts)

### 3. Review and Edit
- Preview the generated starting grid
- Drag and drop drivers to adjust positions manually
- Move entire classes up/down for multi-class events
- Merge waves or reset to original configuration

### 4. Export
- Generate professional PDF grid sheets
- Export CSV data for timing systems
- Add custom grid names and event branding

## 🔧 Development

### Available Scripts

```bash
npm start          # Start development server
npm run build      # Build for production
npm test           # Run test suite
npm run eject      # Eject from Create React App (not recommended)
```

### Version Management

This project follows semantic versioning:
- **PATCH**: Bug fixes and code updates (increment after changes)
- **MINOR**: New features (increment before deployment)  
- **MAJOR**: Breaking changes or major overhauls

## 🏆 Built for My Race Day

This application is part of the My Race Day ecosystem, providing professional motorsport event management solutions. The Grid Builder integrates seamlessly with other My Race Day tools and services.

**My Race Day** - Building your comprehensive solution for professional motorsport event operations.

---

*For support or feature requests, please contact the My Race Day development team.*
