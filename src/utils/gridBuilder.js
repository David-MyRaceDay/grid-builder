/**
 * Grid Building Utilities for Grid Builder
 * Handles wave configuration, sorting, tie-breaking, and grid construction
 */

import { parseTimeToSeconds } from './dataProcessing.js';

/**
 * Initializes wave configurations with default values
 * @param {number} waveCount - Number of waves to create
 * @param {number} defaultWaveSpacing - Default spacing between waves
 * @param {Function} hasMultipleFiles - Function to check if multiple files uploaded
 * @param {Function} hasPositionData - Function to check if position data available
 * @returns {Array} Array of wave configuration objects
 */
export const initializeWaveConfigs = (waveCount, defaultWaveSpacing, hasMultipleFiles, hasPositionData) => {
    const configs = [];
    let canHaveFlying = true;
    
    // Determine default sortBy based on available data
    const defaultSortBy = (!hasMultipleFiles() && hasPositionData()) ? 'position' : 'bestTime';
    
    for (let i = 0; i < waveCount; i++) {
        configs.push({
            waveNumber: i + 1,
            startType: canHaveFlying ? 'flying' : 'standing',
            classes: [],
            sortBy: defaultSortBy,
            gridOrder: 'straight',
            inverted: false,
            invertAll: false,
            invertCount: 2,
            emptyPositions: i < waveCount - 1 ? defaultWaveSpacing : 0,
            emptyPositionsBetweenClasses: 0,
            tieBreaker1: 'bestTime',
            tieBreaker2: 'bestPositionInClass',
            tieBreaker3: 'alphabetical'
        });
        
        if (configs[i].startType === 'standing') {
            canHaveFlying = false;
        }
    }
    
    return configs;
};

/**
 * Evaluates a single tie-breaking criterion
 * @param {Object} a - First driver entry
 * @param {Object} b - Second driver entry  
 * @param {string} criterion - Tie-breaking criterion
 * @returns {number} Comparison result (-1, 0, 1)
 */
export const evaluateTieBreaker = (a, b, criterion) => {
    switch (criterion) {
        case 'bestTime':
            const timeA = parseTimeToSeconds(a.BestTime || '');
            const timeB = parseTimeToSeconds(b.BestTime || '');
            return timeA - timeB;
            
        case 'secondBest':
            const secondA = parseTimeToSeconds(a.SecondBest || '');
            const secondB = parseTimeToSeconds(b.SecondBest || '');
            return secondA - secondB;
            
        case 'bestPositionInClass':
            const picA = a.originalDriver?.bestPositionInClass || 999;
            const picB = b.originalDriver?.bestPositionInClass || 999;
            return picA - picB;
            
        case 'bestPosition':
            const posA = a.originalDriver?.bestPosition || 999;
            const posB = b.originalDriver?.bestPosition || 999;
            return posA - posB;
            
        case 'alphabetical':
            const nameA = (a.Driver || '').toLowerCase();
            const nameB = (b.Driver || '').toLowerCase();
            return nameA.localeCompare(nameB);
            
        case 'manual':
            return 0; // Manual tie-breaking handled in UI
            
        default:
            return 0;
    }
};

/**
 * Applies cascading tie-breaking logic
 * @param {Object} a - First driver entry
 * @param {Object} b - Second driver entry
 * @param {Object} config - Wave configuration with tie-breaking settings
 * @returns {number} Comparison result (-1, 0, 1)
 */
export const applyCascadingTieBreakers = (a, b, config) => {
    // First tie-breaker
    if (config.tieBreaker1) {
        const result1 = evaluateTieBreaker(a, b, config.tieBreaker1);
        if (result1 !== 0) return result1;
    }
    
    // Second tie-breaker
    if (config.tieBreaker2) {
        const result2 = evaluateTieBreaker(a, b, config.tieBreaker2);
        if (result2 !== 0) return result2;
    }
    
    // Third tie-breaker
    if (config.tieBreaker3) {
        const result3 = evaluateTieBreaker(a, b, config.tieBreaker3);
        if (result3 !== 0) return result3;
    }
    
    return 0; // Still tied after all criteria
};

/**
 * Detects ties within a group of entries based on primary sorting criteria
 * @param {Array} entries - Array of driver entries
 * @param {Object} config - Wave configuration
 * @returns {Set} Set of indices that are tied
 */
export const detectTies = (entries, config) => {
    const tiedIndices = new Set();
    
    if (entries.length < 2) return tiedIndices;
    
    for (let i = 0; i < entries.length - 1; i++) {
        const current = entries[i];
        const next = entries[i + 1];
        let areTied = false;
        
        switch (config.sortBy) {
            case 'pointsTotal':
            case 'pointsAverage':
                areTied = (current.Points || 0) === (next.Points || 0);
                break;
                
            case 'bestTime':
            case 'secondBest':
                const currentTime = parseTimeToSeconds(current.BestTime || '');
                const nextTime = parseTimeToSeconds(next.BestTime || '');
                areTied = Math.abs(currentTime - nextTime) < 0.001; // Account for floating point
                break;
                
            case 'position':
                areTied = (current.Position || 999) === (next.Position || 999);
                break;
                
            default:
                areTied = false;
        }
        
        if (areTied) {
            tiedIndices.add(i);
            tiedIndices.add(i + 1);
        }
    }
    
    return tiedIndices;
};

/**
 * Extracts unique classes from driver data
 * @param {Array} drivers - Array of consolidated driver objects
 * @returns {Array} Sorted array of unique class names
 */
export const extractClasses = (drivers) => {
    if (!drivers || drivers.length === 0) return [];
    
    const classes = new Set();
    drivers.forEach(driver => {
        if (driver.class) {
            classes.add(driver.class);
        }
    });
    
    return Array.from(classes).sort();
};

/**
 * Gets car counts by class for display purposes
 * @param {Array} drivers - Array of consolidated driver objects
 * @returns {Map} Map of class names to car counts
 */
export const getCarCountsByClass = (drivers) => {
    const counts = new Map();
    
    if (!drivers || drivers.length === 0) return counts;
    
    drivers.forEach(driver => {
        if (driver.class) {
            counts.set(driver.class, (counts.get(driver.class) || 0) + 1);
        }
    });
    
    return counts;
};

/**
 * Gets the count of cars assigned to a specific wave
 * @param {Object} config - Wave configuration
 * @param {Array} drivers - Array of consolidated driver objects
 * @returns {number} Number of cars in the wave
 */
export const getCarCountInWave = (config, drivers) => {
    if (!config.classes || config.classes.length === 0 || !drivers) return 0;
    
    return drivers.filter(driver => 
        config.classes.includes(driver.class)
    ).length;
};

/**
 * Gets assigned classes for waves other than the specified index
 * @param {Array} waveConfigs - Array of all wave configurations
 * @param {number} excludeIndex - Index of wave to exclude from check
 * @returns {Set} Set of class names assigned to other waves
 */
export const getAssignedClasses = (waveConfigs, excludeIndex) => {
    const assigned = new Set();
    
    waveConfigs.forEach((config, idx) => {
        if (idx !== excludeIndex && config.classes) {
            config.classes.forEach(cls => assigned.add(cls));
        }
    });
    
    return assigned;
};

/**
 * Gets the order of classes for a wave based on entries
 * @param {Object} wave - Wave object with entries
 * @returns {Array} Array of class names in order
 */
export const getClassOrder = (wave) => {
    const classOrder = [];
    const seen = new Set();
    
    wave.entries.forEach(entry => {
        if (!seen.has(entry.Class)) {
            classOrder.push(entry.Class);
            seen.add(entry.Class);
        }
    });
    
    return classOrder;
};

/**
 * Gets merged class display name with slash delimiter
 * @param {Map} mergedClasses - Map of wave merged classes
 * @param {number} waveIndex - Index of the wave
 * @param {string} className - Name of the class
 * @returns {string} Display name for merged classes
 */
export const getMergedClassDisplay = (mergedClasses, waveIndex, className) => {
    const waveMerged = mergedClasses.get(waveIndex);
    if (!waveMerged) return className;
    
    const mergedGroup = waveMerged.get(className);
    if (!mergedGroup || mergedGroup.length <= 1) return className;
    
    // Return all classes in the merged group joined by "/"
    return mergedGroup.join(' / ');
};

/**
 * Main grid building function that processes wave configurations into a final grid
 * @param {Array} waveConfigs - Array of wave configurations
 * @param {Array} validDrivers - Array of consolidated and validated driver data
 * @returns {Array} Array of wave objects with sorted entries
 */
export const buildGrid = (waveConfigs, validDrivers) => {
    const grid = [];
    
    // Helper function for parsing time strings
    const parseTime = (timeStr) => {
        return parseTimeToSeconds(timeStr);
    };
    
    waveConfigs.forEach(config => {
        // Filter drivers for this wave based on assigned classes
        const waveDrivers = validDrivers.filter(driver => 
            config.classes.includes(driver.class)
        );
        
        // Transform driver data into grid entry format
        const waveData = waveDrivers.map(driver => ({
            Class: driver.class,
            Number: driver.number || '',
            Driver: driver.name || '',
            BestTime: driver.bestOverallTime ? driver.bestOverallTime.time : '',
            SecondBest: driver.secondBestOverallTime ? driver.secondBestOverallTime.time : '',
            Points: driver.totalPoints || 0,
            Position: driver.bestPosition || null,
            source: driver.files.map(f => f.fileName).join(', '),
            originalDriver: driver
        }));
        
        // Primary sorting based on wave configuration
        waveData.sort((a, b) => {
            switch (config.sortBy) {
                case 'position':
                    return (a.Position || 999) - (b.Position || 999);
                    
                case 'bestTime':
                    return parseTime(a.BestTime) - parseTime(b.BestTime);
                    
                case 'secondBest':
                    return parseTime(a.SecondBest) - parseTime(b.SecondBest);
                    
                case 'bestSecondBest':
                    // Find best second-best time across all files for each driver
                    const getSecondBestTime = (driver) => {
                        const times = driver.originalDriver.files
                            .map(f => f.secondBest)
                            .filter(t => t && t !== '')
                            .map(t => parseTime(t))
                            .filter(t => t < Infinity);
                        return times.length > 0 ? Math.min(...times) : Infinity;
                    };
                    return getSecondBestTime(a) - getSecondBestTime(b);
                    
                case 'pointsTotal':
                    // Sort by points descending, then apply cascading tie-breakers
                    const pointsDiff = (b.Points || 0) - (a.Points || 0);
                    if (pointsDiff !== 0) return pointsDiff;
                    return applyCascadingTieBreakers(a, b, config);
                    
                case 'pointsAverage':
                    const avgA = a.originalDriver?.averagePoints || 0;
                    const avgB = b.originalDriver?.averagePoints || 0;
                    const avgDiff = avgB - avgA;
                    if (avgDiff !== 0) return avgDiff;
                    return applyCascadingTieBreakers(a, b, config);
                    
                default:
                    return 0;
            }
        });
        
        // Handle class-based ordering (fastest/slowest first)
        if (config.gridOrder === 'fastestFirst' || config.gridOrder === 'slowestFirst') {
            // Calculate fastest time per class
            const classTimes = {};
            config.classes.forEach(cls => {
                const classData = waveData.filter(d => d.Class === cls);
                if (classData.length > 0) {
                    const times = classData.map(d => parseTime(d.BestTime)).filter(t => t < 999999);
                    const fastestTime = times.length > 0 
                        ? Math.min(...times)
                        : 999999;
                    classTimes[cls] = fastestTime;
                }
            });
            
            // Sort classes by their fastest times
            const sortedClasses = Object.keys(classTimes).sort((a, b) => {
                if (config.gridOrder === 'fastestFirst') {
                    return classTimes[a] - classTimes[b];
                } else {
                    return classTimes[b] - classTimes[a];
                }
            });
            
            // Rebuild wave data in new class order with empty positions between classes
            const sortedWaveData = [];
            sortedClasses.forEach((cls, clsIdx) => {
                sortedWaveData.push(...waveData.filter(d => d.Class === cls));
                
                // Add empty positions between classes (but not after the last class)
                if (clsIdx < sortedClasses.length - 1 && config.emptyPositionsBetweenClasses > 0) {
                    for (let i = 0; i < config.emptyPositionsBetweenClasses; i++) {
                        sortedWaveData.push({
                            Class: '',
                            Number: '',
                            Driver: 'EMPTY',
                            BestTime: '',
                            isEmpty: true
                        });
                    }
                }
            });
            waveData.length = 0;
            waveData.push(...sortedWaveData);
        }
        
        // Handle grid inversion
        if (config.inverted) {
            if (config.invertAll) {
                waveData.reverse();
            } else if (config.invertCount > 0) {
                const toInvert = waveData.slice(0, Math.min(config.invertCount, waveData.length));
                toInvert.reverse();
                waveData.splice(0, toInvert.length, ...toInvert);
            }
        }
        
        // Add to grid
        grid.push({
            config: config,
            entries: waveData,
            emptyPositions: config.emptyPositions || 0
        });
    });
    
    return grid;
};

/**
 * Merges a class with the previous class in the wave
 * @param {Object} wave - Wave object with entries
 * @param {Object} waveConfig - Wave configuration
 * @param {string} className - Name of class to merge
 * @returns {Array} New entries array with merged classes sorted together
 */
export const mergeClassWithPrevious = (wave, waveConfig, className) => {
    const classOrder = getClassOrder(wave);
    const currentClassIndex = classOrder.indexOf(className);
    
    if (currentClassIndex <= 0) {
        return wave.entries; // Can't merge first class or class not found
    }
    
    const previousClassName = classOrder[currentClassIndex - 1];
    
    // Get entries for both classes
    const previousClassEntries = wave.entries.filter(e => e.Class === previousClassName);
    const currentClassEntries = wave.entries.filter(e => e.Class === className);
    
    // Combine the entries from both classes
    const mergedEntries = [...previousClassEntries, ...currentClassEntries];
    
    // Sort the merged entries based on wave configuration
    mergedEntries.sort((a, b) => {
        switch (waveConfig.sortBy) {
            case 'bestTime':
                return parseTimeToSeconds(a.BestTime) - parseTimeToSeconds(b.BestTime);
            case 'secondBest':
                return parseTimeToSeconds(a.SecondBest) - parseTimeToSeconds(b.SecondBest);
            case 'pointsTotal':
            case 'pointsAverage':
                // Sort by points descending (higher is better)
                const pointsA = a.Points || 0;
                const pointsB = b.Points || 0;
                if (pointsB !== pointsA) return pointsB - pointsA;
                // Apply tie-breakers if configured
                if (waveConfig.tieBreaker1) {
                    // Simplified tie-breaking - use best time as fallback
                    return parseTimeToSeconds(a.BestTime) - parseTimeToSeconds(b.BestTime);
                }
                return 0;
            case 'position':
                return (a.Position || 999) - (b.Position || 999);
            default:
                return 0;
        }
    });
    
    // Handle grid order inversion if needed
    if (waveConfig.gridOrder === 'slowestFirst') {
        mergedEntries.reverse();
    }
    
    // Reconstruct the wave entries with merged classes in their sorted position
    const newEntries = [];
    let mergedInserted = false;
    
    // Add entries in the original order, but insert merged entries where the first class was
    wave.entries.forEach(entry => {
        if (entry.Class === previousClassName && !mergedInserted) {
            newEntries.push(...mergedEntries);
            mergedInserted = true;
        } else if (entry.Class !== previousClassName && entry.Class !== className) {
            newEntries.push(entry);
        }
    });
    
    return newEntries;
};