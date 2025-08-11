# Grid Builder Help Guide

## Overview
Grid Builder is a web application designed to help race organizers create professional starting grids for racing events. It takes CSV race data and allows you to configure multiple waves with different start types, sort criteria, and export options.

## How It Works - Step by Step

### Step 1: Upload Files
**Purpose**: Import your race data from CSV files.

**What to do**:
- Click "Choose Files" or drag and drop CSV files into the upload area
- You can upload multiple CSV files at once
- Files must contain race data with Driver, Car Number, Class, and timing information

**Supported CSV Formats**:
- Headers can be in various formats (Driver/driver, Number/Car Number, Class/class, etc.)
- Time formats: MM:SS.SSS, MM:SS, or decimal seconds
- Common columns: Driver, Number, Class, BestTime, 2nd Best, Points

**Error Handling**:
- Invalid files will show error messages
- You'll be redirected back to upload valid files if there are parsing issues
- Use "Remove All" button to clear all uploaded files and start over

### Step 2: Set Number of Waves
**Purpose**: Determine how many separate starting groups you need.

**What to do**:
- Use the slider or input field to select 1-10 waves
- More waves = smaller, more competitive groups
- Fewer waves = larger groups with more variety

**When to use multiple waves**:
- Large fields that need to be split up
- Different skill levels or car classes
- Track safety requirements (maximum cars per start)

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
- Use "Assign All Classes" button for single-wave configurations

**Sort Criteria**:
- **Finishing Position**: Sort by race finishing order
- **Best Time**: Sort by fastest lap times
- **Second Best Time**: Sort by second-fastest times (if available in data)
- **Points**: Sort by championship points (if available in data)

**Grid Order**:
- **Straight Up**: Maintain sort order as-is
- **Fastest Class First**: Classes ordered by their fastest representative
- **Slowest Class First**: Classes ordered by their slowest representative

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
- Wave headers show start type and configuration
- Class headers (for class-ordered grids) with move controls

**Manual Adjustments**:
- **Drag and Drop**: Drag any driver to a new position within their wave
- **Move Entire Classes**: Use ⬆️ and ⬇️ icons to move whole classes up/down in the running order
- **Merge Waves**: Use merge icon to combine a wave with the previous wave
- **Reset Wave**: Use refresh icon to restore a wave to its original configuration

**Navigation**:
- Click on any progress step to jump between sections
- Make changes and return to review as needed

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

### Data Quality
- Ensure CSV files have consistent formatting
- Check that class names match across files
- Verify timing data is accurate before processing

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

### Multi-File Support
- Upload different race sessions or qualifying data
- Combine results from multiple events
- Different files can have different column formats

### Dynamic Sorting Options
- App automatically detects available data columns
- Only shows sorting options for data that exists
- Hides options when data is empty or unavailable

### Intelligent Class Grouping
- Automatically detects unique classes from uploaded data
- Handles variations in class naming
- Groups entries by class for organized display

### Real-Time Grid Updates
- Changes reflect immediately in preview
- No need to rebuild grid after manual adjustments
- Live position numbering updates

## Support
If you encounter issues or need help:
1. Check this help guide first
2. Verify your CSV file format
3. Try refreshing the page and starting over
4. Ensure you're using a modern web browser

## Version Information
This help guide corresponds to Grid Builder v0.2.1
For the latest updates and features, check the version number in the bottom-right corner of the application.