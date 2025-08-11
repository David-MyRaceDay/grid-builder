# Grid Builder Help Guide

## Overview
Grid Builder is a web application designed to help race organizers create professional starting grids for racing events. It processes CSV exports of Lap Times or Results files, allowing you to configure multiple waves with different start types, advanced sorting criteria, tie-breaking options, and professional export formats.

## How It Works - Step by Step

### Step 1: Upload Files
**Purpose**: Import race data from CSV exports of Lap Times or Results files.

**What to do**:
- Click "Choose Files" or drag and drop CSV files into the upload area
- You can upload multiple CSV files at once
- The system automatically detects file types and consolidates data

**Supported File Types**:
- **Results Files**: Standard race results with finishing positions and times
- **Lap Times Files**: Individual lap data exports (automatically extracts best times)
- **Multiple Events**: Upload multiple files to consolidate driver data across sessions

**Recommended Columns for Results Files**:
- **Essential**: Driver/Name, Number, Class (required for basic functionality)
- **For time sorting**: Best Tm, 2nd Best
- **For points sorting**: Points
- **For position sorting**: Pos (finishing position)
- **For advanced tie-breaking**: PIC (Position in Class)

**Column Detection**:
- Headers can be in various formats (Driver/driver, Number/Car Number, Class/class, etc.)
- Time formats: MM:SS.SSS, MM:SS, or decimal seconds
- The system shows warnings for missing columns that affect sorting options
- Files with warnings are still processed but some features may be unavailable

**Error Handling**:
- Invalid files show error messages
- Column warnings appear under each file name
- Use "Remove All" button to clear all uploaded files and start over
- Files can be individually removed with the X button

### Step 2: Set Number of Waves
**Purpose**: Determine how many separate starting groups you need.

**What to do**:
- Use the slider or input field to select 1-10 waves
- Optionally set default spacing between waves (empty grid positions)
- More waves = smaller, more competitive groups
- Fewer waves = larger groups with more variety

**When to use multiple waves**:
- Large fields that need to be split up
- Different skill levels or car classes
- Track safety requirements (maximum cars per start)
- Staggered starts for time trials or track days

### Step 3: Configure Waves
**Purpose**: Set up each wave's characteristics and assign classes.

**For each wave, configure**:

**Start Type**:
- **Flying Start**: Cars are already moving when they cross start line (typical for time trials)
- **Standing Start**: Cars start from a complete stop (typical for races)
- *Note: Once you set a wave to Standing Start, all following waves must also be Standing Start*

**Class Assignment**:
- Select which racing classes participate in each wave
- Classes can only be assigned to one wave
- "Assign All Classes" button appears when unassigned classes are available

**Sort By Options** (dynamically shown based on available data):
- **Finishing Position**: Sort by race finishing order (single file only)
- **Best Overall Time**: Sort by fastest lap times across all files
- **Second Best Overall Time**: Sort by second-fastest times
- **Best Second-Best Time**: Best of the second-best times across files
- **Total Points**: Sum of points across all events
- **Average Points**: Average points per event (multiple files only)

**Group By Options**:
- **None - Straight Up**: Maintain sort order as-is
- **Class - Fastest First**: Classes ordered by their fastest representative
- **Class - Slowest First**: Classes ordered by their slowest representative

**Tie-Breaking Options** (for points-based sorting):
When sorting by points, configure up to 3 cascading tie-breakers:
- **Best Overall Time**: Use fastest time to break ties
- **Second Best Overall Time**: Use second-best time
- **Best Position in Class**: Use best PIC result
- **Best Overall Position**: Use best finishing position
- **Alphabetical by Name**: Sort by driver name
- **Manual**: Resolve ties manually on Review screen

**Inversion Options** (mix up the field):
- **No Inversion**: Keep sorted order
- **Invert All**: Completely reverse the entire wave order
- **Invert Specific Count**: Only reverse the top X positions (e.g., top 6)

**Empty Positions**:
- Add gaps between waves for safety or logistics
- Useful when waves need time spacing on track

### Step 4: Review Grid
**Purpose**: Fine-tune your grid and make manual adjustments.

**What you can do**:

**View Grid Layout**:
- See complete starting grid with position numbers
- Wave headers show start type and configuration details
- Class headers (for class-ordered grids) with move controls
- **Enhanced Driver Information**:
  - Primary info: Grid position, car number, driver name, class, best time
  - Additional stats: 2nd best time, total points, average points, best/avg PIC
  - **Tie Indicators**: Yellow dots show when drivers are tied on primary sort criteria

**Manual Adjustments**:
- **Drag and Drop**: Drag any driver to a new position within their wave
- **Move Entire Classes**: Use ⬆️ and ⬇️ icons to move whole classes up/down in the running order
- **Quick Position Buttons**: Jump to end of wave with single click
- **Merge Waves**: Use merge icon to combine a wave with the previous wave
- **Reset Wave**: Use refresh icon to restore a wave to its original configuration

**Navigation**:
- Click on any progress step to jump between sections
- Make changes and return to review as needed
- Changes are preserved when navigating between steps

### Step 5: Export Grid
**Purpose**: Generate final outputs for use at your event.

**Export Options**:

**PDF Export**:
- Professional formatted grid sheets
- Includes wave information and grid positions
- Perfect for printing and posting at events
- Contains timestamp and grid name

**CSV Export**:
- Spreadsheet-friendly format for further editing
- Includes all grid data with wave information
- Useful for importing into other systems
- Contains grid positions, wave numbers, and driver details

**Grid Naming**:
- Add a custom name (e.g., "Spring Championship Race 1")
- Used in filename and document headers
- Optional but recommended for organization

## Tips and Best Practices

### Planning Your Waves
- **Safety First**: Don't exceed track capacity per wave
- **Competitive Balance**: Mix skill levels appropriately
- **Logistics**: Consider pit space and timing requirements

### Using Class-Based Ordering
- Great for multi-class events
- Keeps similar cars together
- Use class movement controls to adjust running order
- Fastest/slowest class first creates different race dynamics

### Inversion Strategy
- Use to create closer racing
- Invert top finishers to reward mid-field drivers
- Consider championship implications

### Data Preparation Tips

### Preparing Your CSV Files
- **Results Files**: Include Best Tm, 2nd Best, Points, Pos, PIC columns for full functionality
- **Lap Times Files**: Ensure driver names/numbers are consistent with results
- **Multiple Files**: Use consistent driver names and numbers across all files
- **Class Names**: Keep class naming consistent across events

### MyLaps Orbits Export Tips
- Configure your results view to show all desired columns before exporting
- Include timing columns (Best Tm, 2nd Best) for time-based sorting
- Add Points column if using championship points sorting
- Include PIC column for advanced tie-breaking options

## Troubleshooting

### Upload Issues
- **File won't upload**: Check file is valid CSV format
- **Parsing errors**: Ensure headers match expected format (Driver, Number, Class)
- **Missing data**: Verify all required columns are present

### Configuration Problems
- **Classes not showing**: Check CSV files have Class column with data
- **Sort options missing**: Timing or Points data may not be available
- **Can't assign classes**: Each class can only be in one wave

### Grid Issues
- **Wrong running order**: Check sort criteria and inversion settings
- **Classes in wrong position**: Use class move controls or drag-and-drop
- **Missing drivers**: Verify they're assigned to correct wave

### Export Problems
- **Empty export**: Ensure grid has been built (Step 4 completed)
- **Missing information**: Check that grid name is filled in
- **Download issues**: Try different browser or check download settings

## Keyboard Shortcuts
- **Click progress steps**: Jump between sections
- **Drag and drop**: Reorder drivers in grid
- **Class controls**: Use arrow icons for class movement

## Advanced Features

### Multi-File Data Consolidation
- Upload multiple race sessions or events
- Automatic driver matching across files
- Consolidated statistics:
  - Track all lap times from all events
  - Calculate total and average points
  - Find best positions across events
  - Identify best and second-best times overall

### Lap Times File Support
- Automatic detection of lap times format
- Intelligent extraction of best lap times
- Support for Orbits lap times exports
- Processes individual lap data to find fastest times

### Advanced Tie-Breaking System
- 3-level cascading tie-breakers for points sorting
- Multiple tie-breaking criteria available
- Visual tie indicators on grid
- Manual tie resolution on Review screen

### Dynamic Sorting Options
- App automatically detects available data columns
- Only shows sorting options for data that exists
- Conditional display based on:
  - Single vs. multiple file uploads
  - Available timing data
  - Valid points data
  - Position information

### Column Validation and Warnings
- Real-time column analysis during upload
- Clear warnings for missing data columns
- Non-blocking validation (files still processed)
- Helps identify which features will be available

### Intelligent Class Grouping
- Automatically detects unique classes from uploaded data
- Handles variations in class naming
- Groups entries by class for organized display
- Class-based wave assignment with visual feedback

### Enhanced Grid Display
- Comprehensive driver statistics at a glance
- Position in Class (PIC) tracking
- Multi-file data aggregation display
- Tie indicators for transparent grid building

### Real-Time Grid Updates
- Changes reflect immediately in preview
- No need to rebuild grid after manual adjustments
- Live position numbering updates
- Preserved state across navigation

## Support
If you encounter issues or need help:
1. Check this help guide first
2. Verify your CSV file format
3. Try refreshing the page and starting over
4. Ensure you're using a modern web browser

## What's New in Version 0.3.0

### Major Features Added:
- **Multi-file timing data consolidation**: Upload multiple events and combine driver statistics
- **Orbits lap times CSV support**: Automatic detection and processing of lap times files
- **Advanced tie-breaking system**: 3-level cascading tie-breakers for points-based sorting
- **Position in Class (PIC) data**: Extract and utilize PIC data for sorting and tie-breaking
- **Enhanced Review screen**: Detailed driver statistics display with all timing and points data
- **Visual tie indicators**: Yellow dots identify tied positions on the grid
- **Column validation**: Real-time warnings for missing data columns during upload
- **Improved UI**: Modern interface with shadcn/ui components and better accessibility

## Version Information
This help guide corresponds to Grid Builder v0.3.0
For the latest updates and features, check the version number in the bottom-right corner of the application.