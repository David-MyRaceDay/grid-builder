/**
 * Data Processing Utilities for Grid Builder
 * Handles CSV parsing, data consolidation, and normalization
 */

import Papa from 'papaparse';

/**
 * Converts various time formats to seconds for comparison
 * @param {string} timeStr - Time string in format "MM:SS.mmm" or "SS.mmm"
 * @returns {number} Time in seconds, or Infinity for invalid times
 */
export const parseTimeToSeconds = (timeStr) => {
    if (!timeStr || timeStr === '') return Infinity;
    
    // Handle different time formats
    const parts = timeStr.split(':');
    if (parts.length === 2) {
        // Format: MM:SS.mmm
        const [minutes, seconds] = parts;
        return parseFloat(minutes) * 60 + parseFloat(seconds);
    } else if (parts.length === 1) {
        // Format: SS.mmm
        return parseFloat(parts[0]);
    }
    
    return Infinity;
};

/**
 * Normalizes field names to handle variations in CSV headers
 * @param {string} fieldName - Original field name from CSV
 * @returns {string} Normalized field name
 */
export const normalizeFieldName = (fieldName) => {
    if (!fieldName) return '';
    
    const normalized = fieldName.toLowerCase().trim();
    
    // Map common variations to standard field names
    const fieldMappings = {
        // Driver name variations
        'driver': 'driver',
        'name': 'driver',
        'driver name': 'driver',
        'drivername': 'driver',
        'competitor': 'driver',
        
        // Number variations
        'number': 'number',
        'no': 'number',
        'no.': 'number',
        'num': 'number',
        'car number': 'number',
        'carnumber': 'number',
        '#': 'number',
        
        // Class variations
        'class': 'class',
        'cls': 'class',
        'category': 'class',
        'division': 'class',
        
        // Time variations
        'best time': 'besttime',
        'besttime': 'besttime',
        'best tm': 'besttime',
        'besttm': 'besttime',
        'fastest time': 'besttime',
        'fastest': 'besttime',
        'time': 'besttime',
        'lap time': 'besttime',
        'laptime': 'besttime',
        
        // Position variations
        'position': 'position',
        'pos': 'position',
        'place': 'position',
        'rank': 'position',
        'finishing position': 'position',
        'final position': 'position',
        
        // Points variations
        'points': 'points',
        'pts': 'points',
        'score': 'points',
        'championship points': 'points',
        
        // Position in Class variations
        'position in class': 'positioninclass',
        'pos in class': 'positioninclass',
        'class position': 'positioninclass',
        'pic': 'positioninclass',
        'class pos': 'positioninclass'
    };
    
    return fieldMappings[normalized] || normalized;
};

/**
 * Analyzes CSV file columns and provides warnings for missing standard fields
 * @param {Array} headers - Array of column headers from CSV
 * @returns {Array} Array of warning messages
 */
export const analyzeFileColumns = (headers) => {
    const warnings = [];
    const normalizedHeaders = headers.map(h => normalizeFieldName(h));
    
    // Check for required fields
    const requiredFields = ['driver', 'number', 'class'];
    const missingRequired = requiredFields.filter(field => !normalizedHeaders.includes(field));
    
    if (missingRequired.length > 0) {
        warnings.push(`Missing required columns: ${missingRequired.join(', ')}`);
    }
    
    // Check for optional but recommended fields
    const recommendedFields = ['besttime', 'position', 'points'];
    const missingRecommended = recommendedFields.filter(field => !normalizedHeaders.includes(field));
    
    if (missingRecommended.length > 0) {
        warnings.push(`Missing recommended columns for advanced features: ${missingRecommended.join(', ')}`);
    }
    
    return warnings;
};

/**
 * Parses Orbits laptimes CSV files with specific format handling
 * @param {string} content - Raw CSV content
 * @param {string} fileName - Name of the file being parsed
 * @returns {Array|null} Parsed driver data or null if not a laptimes file
 */
export const parseLaptimesCSV = (content, fileName) => {
    const lines = content.split('\n').map(line => line.trim()).filter(line => line);
    
    // Check if this is a laptimes file by looking for the specific header
    if (!lines[0] || !lines[0].includes('Time of Day') || !lines[0].includes('Lap Tm')) {
        return null; // Not a laptimes file
    }
    
    const results = [];
    let currentDriver = null;
    let bestLapTime = null;
    let bestSpeed = null;
    let secondBestLapTime = null;
    let secondBestSpeed = null;
    
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        
        // Check if this line is a driver info line (contains " - " pattern)
        if (line.includes(' - ') && !line.startsWith('"')) {
            // Save previous driver if exists
            if (currentDriver && bestLapTime) {
                results.push({
                    'No.': currentDriver.number,
                    'Driver': currentDriver.name,
                    'Class': currentDriver.class,
                    'Best Tm': bestLapTime,
                    'Speed': bestSpeed,
                    'SecondBest': secondBestLapTime,
                    'SecondSpeed': secondBestSpeed,
                    'FileName': fileName
                });
            }
            
            // Parse driver info: "123 - John Smith - GT3"
            const parts = line.split(' - ');
            if (parts.length >= 3) {
                currentDriver = {
                    number: parts[0].trim(),
                    name: parts[1].trim(),
                    class: parts[2].trim()
                };
                bestLapTime = null;
                bestSpeed = null;
                secondBestLapTime = null;
                secondBestSpeed = null;
            }
        } else if (line.startsWith('"') && currentDriver) {
            // This is a lap time line
            try {
                const parsed = Papa.parse(line, { header: false });
                if (parsed.data && parsed.data[0] && parsed.data[0].length >= 4) {
                    const lapData = parsed.data[0];
                    const lapTime = lapData[2]; // Lap Tm column
                    const speed = lapData[3]; // Speed column
                    
                    if (lapTime && lapTime !== '' && lapTime !== 'Lap Tm') {
                        const lapTimeSeconds = parseTimeToSeconds(lapTime);
                        if (lapTimeSeconds < Infinity) {
                            if (!bestLapTime || lapTimeSeconds < parseTimeToSeconds(bestLapTime)) {
                                // New best time found
                                secondBestLapTime = bestLapTime;
                                secondBestSpeed = bestSpeed;
                                bestLapTime = lapTime;
                                bestSpeed = speed;
                            } else if (!secondBestLapTime || lapTimeSeconds < parseTimeToSeconds(secondBestLapTime)) {
                                // New second best time found
                                secondBestLapTime = lapTime;
                                secondBestSpeed = speed;
                            }
                        }
                    }
                }
            } catch (e) {
                // Skip invalid lines
                console.warn('Error parsing lap line:', line, e);
            }
        }
    }
    
    // Don't forget the last driver
    if (currentDriver && bestLapTime) {
        results.push({
            'No.': currentDriver.number,
            'Driver': currentDriver.name,
            'Class': currentDriver.class,
            'Best Tm': bestLapTime,
            'Speed': bestSpeed,
            'SecondBest': secondBestLapTime,
            'SecondSpeed': secondBestSpeed,
            'FileName': fileName
        });
    }
    
    return results;
};

/**
 * Standard CSV parsing with enhanced field normalization
 * @param {string} content - Raw CSV content
 * @param {string} fileName - Name of the file being parsed
 * @returns {Object} Parsed results with data and warnings
 */
export const parseCSV = (content, fileName) => {
    try {
        // First try to parse as laptimes CSV
        const laptimesData = parseLaptimesCSV(content, fileName);
        if (laptimesData) {
            return {
                data: laptimesData,
                warnings: [],
                fileName: fileName
            };
        }
        
        // Standard CSV parsing
        const parsed = Papa.parse(content, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (header) => {
                const normalized = normalizeFieldName(header);
                // Map to standard field names
                const fieldMap = {
                    'driver': 'Driver',
                    'number': 'Number', 
                    'class': 'Class',
                    'besttime': 'Best Tm',
                    'position': 'Position',
                    'points': 'Points',
                    'positioninclass': 'PIC'
                };
                return fieldMap[normalized] || header;
            }
        });
        
        if (parsed.errors.length > 0) {
            console.warn('CSV parsing errors:', parsed.errors);
        }
        
        // Add filename to each entry
        const dataWithFileName = parsed.data.map(entry => ({
            ...entry,
            FileName: fileName
        }));
        
        // Analyze columns and generate warnings
        const originalHeaders = content.split('\n')[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const warnings = analyzeFileColumns(originalHeaders);
        
        return {
            data: dataWithFileName,
            warnings: warnings,
            fileName: fileName
        };
    } catch (error) {
        console.error('Error parsing CSV:', error);
        throw new Error(`Failed to parse CSV file: ${error.message}`);
    }
};

/**
 * Consolidates driver data from multiple files into a unified structure
 * @param {Array} allParsedData - Array of parsed CSV data from multiple files
 * @returns {Array} Consolidated driver data with statistics
 */
export const consolidateDriverData = (allParsedData) => {
    const driverMap = new Map();
    
    // Process each file's data
    allParsedData.forEach((fileData, fileIndex) => {
        fileData.data.forEach(entry => {
            if (!entry.Driver || !entry.Number) return;
            
            const driverKey = `${entry.Driver}-${entry.Number}`;
            
            if (!driverMap.has(driverKey)) {
                driverMap.set(driverKey, {
                    name: entry.Driver,
                    number: entry.Number,
                    class: entry.Class,
                    files: [],
                    bestOverallTime: null,
                    secondBestOverallTime: null,
                    totalPoints: 0,
                    pointsCount: 0,
                    averagePoints: 0,
                    positions: [],
                    positionsInClass: [],
                    bestPosition: null,
                    bestPositionInClass: null,
                    averagePositionInClass: null
                });
            }
            
            const driver = driverMap.get(driverKey);
            
            // Add file data
            const fileEntry = {
                fileName: fileData.fileName,
                bestTime: entry['Best Tm'] || entry.BestTime || '',
                secondBest: entry.SecondBest || '',
                position: entry.Position ? parseInt(entry.Position) : null,
                points: entry.Points ? parseFloat(entry.Points) : 0,
                positionInClass: entry.PIC ? parseInt(entry.PIC) : null,
                class: entry.Class
            };
            
            driver.files.push(fileEntry);
            
            // Update best overall time
            if (fileEntry.bestTime) {
                const timeSeconds = parseTimeToSeconds(fileEntry.bestTime);
                if (timeSeconds < Infinity) {
                    if (!driver.bestOverallTime || timeSeconds < parseTimeToSeconds(driver.bestOverallTime.time)) {
                        driver.secondBestOverallTime = driver.bestOverallTime;
                        driver.bestOverallTime = {
                            time: fileEntry.bestTime,
                            fileName: fileData.fileName
                        };
                    } else if (!driver.secondBestOverallTime || timeSeconds < parseTimeToSeconds(driver.secondBestOverallTime.time)) {
                        driver.secondBestOverallTime = {
                            time: fileEntry.bestTime,
                            fileName: fileData.fileName
                        };
                    }
                }
            }
            
            // Update points
            if (fileEntry.points > 0) {
                driver.totalPoints += fileEntry.points;
                driver.pointsCount++;
            }
            
            // Update positions
            if (fileEntry.position) {
                driver.positions.push(fileEntry.position);
                if (!driver.bestPosition || fileEntry.position < driver.bestPosition) {
                    driver.bestPosition = fileEntry.position;
                }
            }
            
            // Update positions in class
            if (fileEntry.positionInClass) {
                driver.positionsInClass.push(fileEntry.positionInClass);
                if (!driver.bestPositionInClass || fileEntry.positionInClass < driver.bestPositionInClass) {
                    driver.bestPositionInClass = fileEntry.positionInClass;
                }
            }
        });
    });
    
    // Calculate averages and finalize data
    const consolidatedDrivers = Array.from(driverMap.values()).map(driver => {
        // Calculate average points
        if (driver.pointsCount > 0) {
            driver.averagePoints = driver.totalPoints / driver.pointsCount;
        }
        
        // Calculate average position in class
        if (driver.positionsInClass.length > 0) {
            const sum = driver.positionsInClass.reduce((a, b) => a + b, 0);
            driver.averagePositionInClass = sum / driver.positionsInClass.length;
        }
        
        // Add fileCount property for compatibility
        driver.fileCount = driver.files.length;
        
        return driver;
    });
    
    return consolidatedDrivers;
};

/**
 * Validates that consolidated driver data has the minimum required fields
 * @param {Array} drivers - Array of consolidated driver objects
 * @returns {Object} Validation result with isValid flag and errors
 */
export const validateDriverData = (drivers) => {
    const errors = [];
    
    if (!drivers || drivers.length === 0) {
        errors.push('No driver data found');
        return { isValid: false, errors };
    }
    
    // Check for required fields
    const driversWithIssues = drivers.filter(driver => 
        !driver.name || !driver.number || !driver.class
    );
    
    if (driversWithIssues.length > 0) {
        errors.push(`${driversWithIssues.length} drivers missing required fields (name, number, or class)`);
    }
    
    // Check for duplicate driver/number combinations
    const driverKeys = new Set();
    const duplicates = [];
    
    drivers.forEach(driver => {
        const key = `${driver.name}-${driver.number}`;
        if (driverKeys.has(key)) {
            duplicates.push(key);
        }
        driverKeys.add(key);
    });
    
    if (duplicates.length > 0) {
        errors.push(`Duplicate driver/number combinations found: ${duplicates.join(', ')}`);
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors
    };
};