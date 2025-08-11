import React, { useState, useRef, useCallback } from 'react';
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import './GridBuilder.css';
import racingFlag from './assets/racing-flag.svg';
import minus3Icon from './assets/minus_3.svg';
import minus1Icon from './assets/minus_1.svg';
import plus1Icon from './assets/plus_1.svg';
import plus3Icon from './assets/plus_3.svg';
import mergeIcon from './assets/merge.svg';
import refreshIcon from './assets/refresh.svg';

const GridBuilder = () => {
    const [currentStep, setCurrentStep] = useState(1);
    const [uploadedFiles, setUploadedFiles] = useState([]);
    const [parsedData, setParsedData] = useState([]);
    const [waveCount, setWaveCount] = useState(1);
    const [waveConfigs, setWaveConfigs] = useState([]);
    const [finalGrid, setFinalGrid] = useState([]);
    const [originalGrid, setOriginalGrid] = useState([]);
    const [gridName, setGridName] = useState('');
    const fileInputRef = useRef(null);
    const [draggedItem, setDraggedItem] = useState(null);
    const [draggedOver, setDraggedOver] = useState(null);
    const [parseError, setParseError] = useState('');
    const [hasValidData, setHasValidData] = useState(true);
    const moveTimeoutRef = useRef(null);
    const isMovingRef = useRef(false);
    const lastMoveRef = useRef('');
    const [showTips, setShowTips] = useState(false);
    
    const steps = [
        { num: 1, label: 'Upload Files' },
        { num: 2, label: 'Set number of waves' },
        { num: 3, label: 'Configure Waves' },
        { num: 4, label: 'Review Grid' },
        { num: 5, label: 'Export Grid' },
        { num: 6, label: 'Help' }
    ];
    
    const parseCSV = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                Papa.parse(e.target.result, {
                    header: true,
                    dynamicTyping: true,
                    skipEmptyLines: true,
                    complete: (results) => {
                        // Check for parsing errors
                        if (results.errors && results.errors.length > 0) {
                            reject(new Error(`Error parsing ${file.name}: ${results.errors[0].message}`));
                            return;
                        }
                        
                        // Check if we have valid data
                        if (!results.data || results.data.length === 0) {
                            reject(new Error(`No valid data found in ${file.name}. Please check the file format.`));
                            return;
                        }
                        
                        // Check if the data has expected fields (at least one of these should exist)
                        const expectedFields = ['Class', 'class', 'CLASS', 'Name', 'Driver', 'DriverName', 'Pilot', 'No.', 'Number', 'CarNumber', 'Car', '#', 'Num'];
                        const headers = Object.keys(results.data[0] || {});
                        const hasValidHeaders = expectedFields.some(field => headers.includes(field));
                        
                        if (!hasValidHeaders) {
                            reject(new Error(`${file.name} does not contain expected racing data columns (Class, Driver, Number, etc.). Please verify the file format.`));
                            return;
                        }
                        
                        resolve({
                            fileName: file.name,
                            data: results.data
                        });
                    }
                });
            };
            reader.onerror = () => {
                reject(new Error(`Failed to read ${file.name}. Please ensure it's a valid file.`));
            };
            reader.readAsText(file);
        });
    };
    
    const handleFileUpload = async (files) => {
        setParseError(''); // Clear any previous errors
        
        const fileArray = Array.from(files);
        const csvFiles = fileArray.filter(f => f.name.endsWith('.csv'));
        
        try {
            const parsed = await Promise.all(csvFiles.map(parseCSV));
            setParsedData(prev => [...prev, ...parsed]);
            setUploadedFiles(prev => [...prev, ...csvFiles]);
            setHasValidData(true);
        } catch (error) {
            setParseError(error.message);
            setHasValidData(false);
        }
    };
    
    const handleDrop = (e) => {
        e.preventDefault();
        e.currentTarget.classList.remove('dragging');
        handleFileUpload(e.dataTransfer.files);
    };
    
    const handleDragOver = (e) => {
        e.preventDefault();
        e.currentTarget.classList.add('dragging');
    };
    
    const handleDragLeave = (e) => {
        e.currentTarget.classList.remove('dragging');
    };
    
    const removeFile = (index) => {
        setUploadedFiles(prev => prev.filter((_, i) => i !== index));
        setParsedData(prev => prev.filter((_, i) => i !== index));
        setParseError(''); // Clear error when removing files
        setHasValidData(true);
    };
    
    const removeAllFiles = () => {
        setUploadedFiles([]);
        setParsedData([]);
        setParseError(''); // Clear any errors
        setHasValidData(true);
    };
    
    const normalizeFieldName = (row, fieldVariations) => {
        for (let variation of fieldVariations) {
            if (row[variation] !== undefined && row[variation] !== null && row[variation] !== '') {
                return row[variation];
            }
        }
        return null;
    };
    
    const extractClasses = () => {
        const classSet = new Set();
        const classVariations = ['Class', 'class', 'CLASS', 'Класс'];
        
        parsedData.forEach(file => {
            file.data.forEach(row => {
                const classValue = normalizeFieldName(row, classVariations);
                if (classValue) {
                    classSet.add(classValue);
                }
            });
        });
        return Array.from(classSet).filter(c => c && c.trim() !== '');
    };
    
    // Check if any uploaded files contain 2nd Best time columns
    const hasSecondBestTimes = () => {
        const secondTimeVariations = ['2nd Best', 'SecondBest', 'Second Best', 'Time2', '2nd'];
        
        return parsedData.some(file => {
            if (!file.data || file.data.length === 0) return false;
            
            const headers = Object.keys(file.data[0] || {});
            return secondTimeVariations.some(variation => headers.includes(variation));
        });
    };
    
    // Check if any uploaded files contain Points columns with non-zero values
    const hasValidPoints = () => {
        const pointsVariations = ['Points', 'Pts', 'Score'];
        
        return parsedData.some(file => {
            if (!file.data || file.data.length === 0) return false;
            
            return file.data.some(row => {
                const pointsValue = normalizeFieldName(row, pointsVariations);
                const points = parseInt(pointsValue) || 0;
                return points > 0; // Only return true if there are actual non-zero points
            });
        });
    };
    
    const initializeWaveConfigs = () => {
        const configs = [];
        let canHaveFlying = true;
        
        for (let i = 0; i < waveCount; i++) {
            configs.push({
                waveNumber: i + 1,
                startType: canHaveFlying ? 'flying' : 'standing',
                classes: [],
                sortBy: 'position',
                gridOrder: 'straight',
                inverted: false,
                invertAll: false,
                invertCount: 2,
                emptyPositions: 0
            });
            
            if (configs[i].startType === 'standing') {
                canHaveFlying = false;
            }
        }
        setWaveConfigs(configs);
    };
    
    const updateWaveConfig = (index, field, value) => {
        setWaveConfigs(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            
            if (field === 'startType' && value === 'standing') {
                for (let i = index + 1; i < updated.length; i++) {
                    updated[i].startType = 'standing';
                }
            }
            
            return updated;
        });
    };
    
    const buildGrid = () => {
        // Validate that we have parsed data with valid content
        if (!parsedData || parsedData.length === 0) {
            setParseError('No valid CSV files have been uploaded. Please upload valid race data files.');
            setCurrentStep(1);
            return;
        }
        
        // Check if any of the uploaded files have usable data
        let totalEntries = 0;
        const classVariations = ['Class', 'class', 'CLASS', 'Класс'];
        
        parsedData.forEach(file => {
            file.data.forEach(row => {
                const classValue = normalizeFieldName(row, classVariations);
                if (classValue && classValue.trim() !== '') {
                    totalEntries++;
                }
            });
        });
        
        if (totalEntries === 0) {
            setParseError('No valid race entries found in the uploaded files. Please ensure your CSV files contain proper race data with Class, Driver, and Number columns.');
            setCurrentStep(1);
            return;
        }
        
        const grid = [];
        
        // Field name variations for different export formats
        // (reusing classVariations from validation above)
        const numberVariations = ['No.', 'Number', 'CarNumber', 'Car', '#', 'Num'];
        const driverVariations = ['Name', 'Driver', 'DriverName', 'Pilot'];
        const positionVariations = ['Pos', 'Position', 'Finish', 'Place', 'P'];
        const bestTimeVariations = ['Best Tm', 'BestTime', 'Best Time', 'FastLap', 'Best', 'Time'];
        const secondTimeVariations = ['2nd Best', 'SecondBest', 'Second Best', 'Time2', '2nd'];
        const pointsVariations = ['Points', 'Pts', 'Score'];
        
        // Parse time strings to seconds for sorting
        const parseTime = (timeStr) => {
            if (!timeStr || timeStr === '' || timeStr === 'DNF' || timeStr === 'DNS') return 999999;
            
            // Handle various time formats (1:23.456, 1:23:456, 83.456, etc.)
            const cleanTime = timeStr.toString().trim();
            
            // If it's already a number (seconds)
            if (!isNaN(cleanTime)) return parseFloat(cleanTime);
            
            // Handle MM:SS.mmm or MM:SS:mmm format
            const parts = cleanTime.split(/[:.]/).filter(p => p);
            if (parts.length === 3) {
                // MM:SS.mmm or MM:SS:mmm
                const minutes = parseInt(parts[0]) || 0;
                const seconds = parseInt(parts[1]) || 0;
                const milliseconds = parseInt(parts[2].padEnd(3, '0').substring(0, 3)) || 0;
                return minutes * 60 + seconds + milliseconds / 1000;
            } else if (parts.length === 2) {
                // SS.mmm
                const seconds = parseInt(parts[0]) || 0;
                const milliseconds = parseInt(parts[1].padEnd(3, '0').substring(0, 3)) || 0;
                return seconds + milliseconds / 1000;
            }
            
            return 999999; // Default for unparseable times
        };
        
        waveConfigs.forEach(config => {
            const waveDataMap = new Map(); // Use Map to deduplicate by driver
            
            parsedData.forEach(file => {
                file.data.forEach(row => {
                    const rowClass = normalizeFieldName(row, classVariations);
                    if (config.classes.includes(rowClass)) {
                        // Normalize all the fields
                        const normalizedRow = {
                            Class: rowClass,
                            Number: normalizeFieldName(row, numberVariations),
                            Driver: normalizeFieldName(row, driverVariations),
                            Position: normalizeFieldName(row, positionVariations),
                            BestTime: normalizeFieldName(row, bestTimeVariations),
                            SecondBest: normalizeFieldName(row, secondTimeVariations),
                            Points: normalizeFieldName(row, pointsVariations),
                            source: file.fileName,
                            originalRow: row // Keep original data for reference
                        };
                        
                        // Use driver name as key for deduplication
                        const driverKey = normalizedRow.Driver ? normalizedRow.Driver.trim().toLowerCase() : null;
                        
                        if (driverKey) {
                            const existing = waveDataMap.get(driverKey);
                            
                            if (!existing) {
                                // First occurrence of this driver
                                waveDataMap.set(driverKey, normalizedRow);
                            } else {
                                // Driver already exists - compare and keep the better result
                                // Use the appropriate time field based on sorting criteria
                                let existingTime, newTime;
                                
                                if (config.sortBy === 'secondBest') {
                                    // When sorting by second best, compare second best times
                                    existingTime = parseTime(existing.SecondBest);
                                    newTime = parseTime(normalizedRow.SecondBest);
                                } else {
                                    // Default to best time for other sorting methods
                                    existingTime = parseTime(existing.BestTime);
                                    newTime = parseTime(normalizedRow.BestTime);
                                }
                                
                                // Keep the entry with the better (lower) time
                                if (newTime < existingTime) {
                                    waveDataMap.set(driverKey, normalizedRow);
                                } else if (newTime === existingTime) {
                                    // If times are equal, check other criteria
                                    const existingPos = parseInt(existing.Position) || 999;
                                    const newPos = parseInt(normalizedRow.Position) || 999;
                                    
                                    // Keep better position
                                    if (newPos < existingPos) {
                                        waveDataMap.set(driverKey, normalizedRow);
                                    } else if (newPos === existingPos) {
                                        // If positions are also equal, keep the one with more points
                                        const existingPts = parseInt(existing.Points) || 0;
                                        const newPts = parseInt(normalizedRow.Points) || 0;
                                        
                                        if (newPts > existingPts) {
                                            waveDataMap.set(driverKey, normalizedRow);
                                        }
                                    }
                                }
                            }
                        } else if (normalizedRow.Number) {
                            // If no driver name but has car number, use car number as key
                            const carKey = `car_${normalizedRow.Number}`;
                            if (!waveDataMap.has(carKey)) {
                                waveDataMap.set(carKey, normalizedRow);
                            }
                        }
                    }
                });
            });
            
            // Convert Map back to array
            const waveData = Array.from(waveDataMap.values());
            
            // Sort the wave data
            waveData.sort((a, b) => {
                switch (config.sortBy) {
                    case 'position':
                        const posA = parseInt(a.Position) || 999;
                        const posB = parseInt(b.Position) || 999;
                        return posA - posB;
                    case 'bestTime':
                        return parseTime(a.BestTime) - parseTime(b.BestTime);
                    case 'secondBest':
                        return parseTime(a.SecondBest) - parseTime(b.SecondBest);
                    case 'points':
                        const ptsA = parseInt(a.Points) || 0;
                        const ptsB = parseInt(b.Points) || 0;
                        return ptsB - ptsA; // Higher points first
                    default:
                        return 0;
                }
            });
            
            // Apply grid order
            if (config.gridOrder === 'fastestFirst' || config.gridOrder === 'slowestFirst') {
                // Group by class and find fastest time in each class
                const classTimes = {};
                config.classes.forEach(cls => {
                    const classData = waveData.filter(d => d.Class === cls);
                    if (classData.length > 0) {
                        const times = classData.map(d => parseTime(d.BestTime)).filter(t => t < 999999);
                        // Get the fastest (minimum) time in the class
                        const fastestTime = times.length > 0 
                            ? Math.min(...times)
                            : 999999;
                        classTimes[cls] = fastestTime;
                    }
                });
                
                const sortedClasses = Object.keys(classTimes).sort((a, b) => {
                    if (config.gridOrder === 'fastestFirst') {
                        return classTimes[a] - classTimes[b];
                    } else {
                        return classTimes[b] - classTimes[a];
                    }
                });
                
                const sortedWaveData = [];
                sortedClasses.forEach(cls => {
                    sortedWaveData.push(...waveData.filter(d => d.Class === cls));
                });
                waveData.length = 0;
                waveData.push(...sortedWaveData);
            }
            
            // Apply inversion
            if (config.inverted) {
                if (config.invertAll) {
                    // Invert the entire wave
                    waveData.reverse();
                } else if (config.invertCount > 0) {
                    // Invert specific number of positions
                    const toInvert = waveData.slice(0, Math.min(config.invertCount, waveData.length));
                    toInvert.reverse();
                    waveData.splice(0, toInvert.length, ...toInvert);
                }
            }
            
            grid.push({
                config: config,
                entries: waveData,
                emptyPositions: config.emptyPositions || 0
            });
        });
        
        setFinalGrid(grid);
        setOriginalGrid(JSON.parse(JSON.stringify(grid))); // Deep copy
    };
    
    const handleGridDragStart = (e, waveIndex, entryIndex) => {
        setDraggedItem({ waveIndex, entryIndex });
    };
    
    const handleGridDragOver = (e, waveIndex, entryIndex) => {
        e.preventDefault();
        setDraggedOver({ waveIndex, entryIndex });
    };
    
    const handleGridDrop = (e, waveIndex, entryIndex) => {
        e.preventDefault();
        if (!draggedItem) return;
        
        setFinalGrid(prev => {
            const newGrid = [...prev];
            const draggedEntry = newGrid[draggedItem.waveIndex].entries[draggedItem.entryIndex];
            
            // Remove from original position
            newGrid[draggedItem.waveIndex].entries.splice(draggedItem.entryIndex, 1);
            
            // Add to new position
            newGrid[waveIndex].entries.splice(entryIndex, 0, draggedEntry);
            
            return newGrid;
        });
        
        setDraggedItem(null);
        setDraggedOver(null);
    };
    
    const startNewGrid = () => {
        // Reset all state variables
        setCurrentStep(1);
        setUploadedFiles([]);
        setParsedData([]);
        setWaveCount(1);
        setWaveConfigs([]);
        setFinalGrid([]);
        setOriginalGrid([]);
        setGridName('');
        setDraggedItem(null);
        setDraggedOver(null);
        setParseError('');
        setHasValidData(true);
    };
    
    const moveToEndOfWave = (waveIndex, entryIndex) => {
        setFinalGrid(prev => {
            const newGrid = [...prev];
            const entry = newGrid[waveIndex].entries[entryIndex];
            
            // Remove from current position
            newGrid[waveIndex].entries.splice(entryIndex, 1);
            
            // Add to end of wave
            newGrid[waveIndex].entries.push(entry);
            
            return newGrid;
        });
    };
    
    const moveToEndOfClass = (waveIndex, entryIndex) => {
        setFinalGrid(prev => {
            const newGrid = [...prev];
            const entry = newGrid[waveIndex].entries[entryIndex];
            const entryClass = entry.Class;
            
            // Remove from current position
            newGrid[waveIndex].entries.splice(entryIndex, 1);
            
            // Find the last position of the same class in the wave
            let insertIndex = newGrid[waveIndex].entries.length;
            for (let i = newGrid[waveIndex].entries.length - 1; i >= 0; i--) {
                if (newGrid[waveIndex].entries[i].Class === entryClass) {
                    insertIndex = i + 1;
                    break;
                }
            }
            
            // Insert at the end of the class group
            newGrid[waveIndex].entries.splice(insertIndex, 0, entry);
            
            return newGrid;
        });
    };
    
    const isWaveModified = (waveIndex) => {
        if (!originalGrid[waveIndex] || !finalGrid[waveIndex]) return false;
        
        const original = originalGrid[waveIndex].entries;
        const current = finalGrid[waveIndex].entries;
        
        if (original.length !== current.length) return true;
        
        for (let i = 0; i < original.length; i++) {
            if (original[i].Number !== current[i].Number || 
                original[i].Driver !== current[i].Driver) {
                return true;
            }
        }
        return false;
    };
    
    const resetWave = (waveIndex) => {
        if (originalGrid[waveIndex]) {
            setFinalGrid(prev => {
                const newGrid = [...prev];
                newGrid[waveIndex] = JSON.parse(JSON.stringify(originalGrid[waveIndex])); // Deep copy
                return newGrid;
            });
        }
    };
    
    const combineWithPreviousWave = (waveIndex) => {
        if (waveIndex === 0) return; // Can't combine first wave
        
        setFinalGrid(prev => {
            const newGrid = [...prev];
            const previousWave = newGrid[waveIndex - 1];
            const currentWave = newGrid[waveIndex];
            
            // Add all entries from current wave to previous wave
            previousWave.entries.push(...currentWave.entries);
            
            // Remove the current wave
            newGrid.splice(waveIndex, 1);
            
            return newGrid;
        });
        
        // Also update original grid to reflect the wave removal
        setOriginalGrid(prev => {
            const newOriginal = [...prev];
            if (waveIndex > 0 && newOriginal[waveIndex - 1] && newOriginal[waveIndex]) {
                newOriginal[waveIndex - 1].entries.push(...newOriginal[waveIndex].entries);
            }
            newOriginal.splice(waveIndex, 1);
            return newOriginal;
        });
    };
    
    const moveClassUp = useCallback((waveIndex, className) => {
        // Create a unique key for this specific operation
        const operationKey = `${waveIndex}-${className}-up`;
        
        if (isMovingRef.current === operationKey) {
            console.log('Exact same move already in progress, ignoring');
            return;
        }
        
        if (isMovingRef.current) {
            console.log('Different move already in progress, ignoring');
            return;
        }
        
        isMovingRef.current = operationKey; // Set flag immediately with specific key
        console.log('Executing moveClassUp for:', className);
        
        setFinalGrid(prev => {
            const newGrid = [...prev];
            const wave = { ...newGrid[waveIndex] }; // Create new wave object
            
            // Build class order and class entries map
            const classOrder = [];
            const classMap = new Map();
            
            wave.entries.forEach(entry => {
                if (!classMap.has(entry.Class)) {
                    classOrder.push(entry.Class);
                    classMap.set(entry.Class, []);
                }
                classMap.get(entry.Class).push(entry);
            });
            
            const currentClassIndex = classOrder.indexOf(className);
            console.log('Current class index:', currentClassIndex, 'Total classes:', classOrder.length);
            
            if (currentClassIndex <= 0) {
                console.log('Cannot move up - already first or not found');
                isMovingRef.current = false;
                return newGrid; // Return the current grid state, don't undo changes
            }
            
            // Create new class order by swapping current class with the previous one
            const newClassOrder = [...classOrder];
            const temp = newClassOrder[currentClassIndex];
            newClassOrder[currentClassIndex] = newClassOrder[currentClassIndex - 1];
            newClassOrder[currentClassIndex - 1] = temp;
            
            console.log('Move Up - Original order:', classOrder);
            console.log('Move Up - New order:', newClassOrder);
            console.log('Move Up - Moving class:', className, 'from index', currentClassIndex, 'to', currentClassIndex - 1);
            
            // Rebuild entries in new class order
            const newEntries = [];
            newClassOrder.forEach(cls => {
                if (classMap.has(cls)) {
                    newEntries.push(...classMap.get(cls));
                }
            });
            
            console.log('Move Up - Final entries order:', newEntries.map(e => e.Class));
            
            wave.entries = newEntries; // Assign to the new wave object
            newGrid[waveIndex] = wave; // Replace the wave in the grid
            
            // Reset the flag after a short delay
            setTimeout(() => {
                if (isMovingRef.current === operationKey) {
                    isMovingRef.current = false;
                }
            }, 200);
            
            return newGrid;
        });
    }, []);
    
    const moveClassDown = useCallback((waveIndex, className) => {
        // Create a unique key for this specific operation
        const operationKey = `${waveIndex}-${className}-down`;
        
        if (isMovingRef.current === operationKey) {
            console.log('Exact same move already in progress, ignoring');
            return;
        }
        
        if (isMovingRef.current) {
            console.log('Different move already in progress, ignoring');
            return;
        }
        
        isMovingRef.current = operationKey; // Set flag immediately with specific key
        console.log('Executing moveClassDown for:', className);
        
        setFinalGrid(prev => {
            const newGrid = [...prev];
            const wave = { ...newGrid[waveIndex] }; // Create new wave object
            
            // Build class order and class entries map
            const classOrder = [];
            const classMap = new Map();
            
            wave.entries.forEach(entry => {
                if (!classMap.has(entry.Class)) {
                    classOrder.push(entry.Class);
                    classMap.set(entry.Class, []);
                }
                classMap.get(entry.Class).push(entry);
            });
            
            const currentClassIndex = classOrder.indexOf(className);
            console.log('Current class index:', currentClassIndex, 'Total classes:', classOrder.length);
            
            if (currentClassIndex >= classOrder.length - 1 || currentClassIndex === -1) {
                console.log('Cannot move down - already last or not found');
                isMovingRef.current = false;
                return newGrid; // Return the current grid state, don't undo changes
            }
            
            // Create new class order by swapping current class with the next one
            const newClassOrder = [...classOrder];
            const temp = newClassOrder[currentClassIndex];
            newClassOrder[currentClassIndex] = newClassOrder[currentClassIndex + 1];
            newClassOrder[currentClassIndex + 1] = temp;
            
            console.log('Move Down - Original order:', classOrder);
            console.log('Move Down - New order:', newClassOrder);
            console.log('Move Down - Moving class:', className, 'from index', currentClassIndex, 'to', currentClassIndex + 1);
            
            // Rebuild entries in new class order
            const newEntries = [];
            newClassOrder.forEach(cls => {
                if (classMap.has(cls)) {
                    newEntries.push(...classMap.get(cls));
                }
            });
            
            console.log('Move Down - Final entries order:', newEntries.map(e => e.Class));
            
            wave.entries = newEntries; // Assign to the new wave object
            newGrid[waveIndex] = wave; // Replace the wave in the grid
            
            // Reset the flag after a short delay
            setTimeout(() => {
                if (isMovingRef.current === operationKey) {
                    isMovingRef.current = false;
                }
            }, 200);
            
            return newGrid;
        });
    }, []);
    
    // Get the order of classes in a wave (for class-ordered waves)
    const getClassOrder = (wave) => {
        const classOrder = [];
        const seen = new Set();
        
        wave.entries.forEach(entry => {
            if (!seen.has(entry.Class)) {
                classOrder.push(entry.Class);
                seen.add(entry.Class);
            }
        });
        
        console.log('getClassOrder called, result:', classOrder);
        return classOrder;
    };
    
    const generatePDF = () => {
        const doc = new jsPDF();
        
        // Helper function to generate wave description (same as in UI)
        const generateWaveDescription = (config) => {
            const descriptions = [];
            
            const sortLabels = {
                'position': 'Finishing Position',
                'bestTime': 'Best Time',
                'secondBest': 'Second Best Time',
                'points': 'Points'
            };
            descriptions.push(`Sorted by ${sortLabels[config.sortBy] || 'Unknown'}`);
            
            const orderLabels = {
                'straight': 'straight up',
                'fastestFirst': 'fastest class first',
                'slowestFirst': 'slowest class first'
            };
            descriptions.push(`${orderLabels[config.gridOrder] || 'unknown order'}`);
            
            if (config.inverted) {
                if (config.invertAll) {
                    descriptions.push('entire grid inverted');
                } else {
                    descriptions.push(`top ${config.invertCount} positions inverted`);
                }
            }
            
            if (config.classes && config.classes.length > 0) {
                descriptions.push(`Classes: ${config.classes.join(', ')}`);
            }
            
            return descriptions.join(' • ');
        };
        
        doc.setFontSize(20);
        const title = gridName.trim() || 'Starting Grid';
        doc.text(title, 105, 20, { align: 'center' });
        
        let yPos = 35;
        let currentPosition = 1;
        
        finalGrid.forEach((wave, waveIdx) => {
            // Check if we need a new page for the wave header
            if (yPos > 245) {
                doc.addPage();
                yPos = 20;
            }
            
            // Wave title
            doc.setFontSize(14);
            doc.setFont(undefined, 'bold');
            doc.text(`Wave ${wave.config.waveNumber} - ${wave.config.startType.toUpperCase()} Start`, 20, yPos);
            yPos += 6;
            
            
            // Table headers
            doc.setFontSize(11);
            doc.setFont(undefined, 'bold');
            const colPositions = [20, 45, 70, 150];
            
            doc.text('Grid Pos', colPositions[0], yPos);
            doc.text('Car No', colPositions[1], yPos);
            doc.text('Driver', colPositions[2], yPos);
            doc.text('Time', colPositions[3], yPos);
            yPos += 8;
            
            // Table content
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            
            wave.entries.forEach((entry, idx) => {
                // Check if we need a new page
                if (yPos > 270) {
                    doc.addPage();
                    yPos = 20;
                    
                    // Repeat headers on new page
                    doc.setFontSize(11);
                    doc.setFont(undefined, 'bold');
                    doc.text('Grid Pos', colPositions[0], yPos);
                    doc.text('Car No', colPositions[1], yPos);
                    doc.text('Driver', colPositions[2], yPos);
                    doc.text('Time', colPositions[3], yPos);
                    yPos += 8;
                    doc.setFontSize(10);
                    doc.setFont(undefined, 'normal');
                }
                
                const pos = currentPosition + idx;
                const num = entry.Number || '?';
                const driver = entry.Driver || 'TBD';
                const time = entry.BestTime || '--:--';
                
                // Table row data
                doc.text(pos.toString(), colPositions[0], yPos);
                doc.text(num.toString(), colPositions[1], yPos);
                doc.text(driver, colPositions[2], yPos);
                doc.text(time, colPositions[3], yPos);
                yPos += 6;
            });
            
            // Empty positions note
            if (wave.emptyPositions > 0 && waveIdx < finalGrid.length - 1) {
                doc.setFontSize(9);
                doc.setFont(undefined, 'italic');
                doc.text(`[${wave.emptyPositions} empty position${wave.emptyPositions > 1 ? 's' : ''}]`, 20, yPos);
                doc.setFont(undefined, 'normal');
                doc.setFontSize(10);
                yPos += 8;
            }
            
            currentPosition += wave.entries.length + (wave.emptyPositions || 0);
            yPos += 10; // Reduced space between waves
        });
        
        // Add timestamp at bottom of last page
        const now = new Date();
        const pageHeight = doc.internal.pageSize.height;
        doc.setFontSize(8);
        doc.setFont(undefined, 'normal');
        doc.text(`Generated: ${now.toLocaleString()}`, 105, pageHeight - 10, { align: 'center' });
        
        doc.save('starting-grid.pdf');
    };
    
    const generateCSV = () => {
        const csvData = [];
        let currentPosition = 1;
        
        // Helper function to generate wave description (same as in PDF)
        const generateWaveDescription = (config) => {
            const descriptions = [];
            
            const sortLabels = {
                'position': 'Finishing Position',
                'bestTime': 'Best Time',
                'secondBest': 'Second Best Time',
                'points': 'Points'
            };
            descriptions.push(`Sorted by ${sortLabels[config.sortBy] || 'Unknown'}`);
            
            const orderLabels = {
                'straight': 'straight up',
                'fastestFirst': 'fastest class first',
                'slowestFirst': 'slowest class first'
            };
            descriptions.push(`${orderLabels[config.gridOrder] || 'unknown order'}`);
            
            if (config.inverted) {
                if (config.invertAll) {
                    descriptions.push('entire grid inverted');
                } else {
                    descriptions.push(`top ${config.invertCount} positions inverted`);
                }
            }
            
            if (config.classes && config.classes.length > 0) {
                descriptions.push(`Classes: ${config.classes.join(', ')}`);
            }
            
            return descriptions.join(' • ');
        };
        
        // Add title row
        if (gridName.trim()) {
            csvData.push([gridName.trim()]);
            csvData.push([]); // Empty row for spacing
        }
        
        // Add header row
        csvData.push(['Grid Position', 'Wave', 'Car Number', 'Driver', 'Class', 'Best Time']);
        
        // Add data for each wave
        finalGrid.forEach((wave, waveIdx) => {
            // Add wave header information
            csvData.push([]); // Empty row for spacing
            csvData.push([`WAVE ${wave.config.waveNumber} - ${wave.config.startType.toUpperCase()} START`]);
            if (wave.emptyPositions > 0 && waveIdx < finalGrid.length - 1) {
                csvData.push([`${wave.emptyPositions} empty position${wave.emptyPositions > 1 ? 's' : ''} after this wave`]);
            }
            csvData.push([]); // Empty row for spacing
            
            // Add wave entries
            wave.entries.forEach((entry, idx) => {
                const pos = currentPosition + idx;
                const waveNum = wave.config.waveNumber;
                const carNumber = entry.Number || '';
                const driver = entry.Driver || 'TBD';
                const driverClass = entry.Class || '';
                const time = entry.BestTime || '';
                
                csvData.push([pos, waveNum, carNumber, driver, driverClass, time]);
            });
            
            // Add empty positions as placeholder rows if needed
            if (wave.emptyPositions > 0 && waveIdx < finalGrid.length - 1) {
                for (let i = 0; i < wave.emptyPositions; i++) {
                    const pos = currentPosition + wave.entries.length + i;
                    csvData.push([pos, wave.config.waveNumber, 'EMPTY', 'EMPTY POSITION', '', '']);
                }
            }
            
            currentPosition += wave.entries.length + (wave.emptyPositions || 0);
        });
        
        // Add timestamp
        csvData.push([]); // Empty row for spacing
        csvData.push([`Generated: ${new Date().toLocaleString()}`]);
        
        // Convert to CSV format
        const csvContent = csvData.map(row => 
            row.map(field => `"${field}"`).join(',')
        ).join('\n');
        
        // Create and download the file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        const filename = gridName.trim() ? `${gridName.trim()}.csv` : 'starting-grid.csv';
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Get all classes already assigned to other waves
    const getAssignedClasses = (excludeWaveIndex) => {
        const assigned = new Set();
        waveConfigs.forEach((wave, index) => {
            if (index !== excludeWaveIndex) {
                wave.classes.forEach(cls => assigned.add(cls));
            }
        });
        return assigned;
    };
    
    // Assign all available classes to a wave (for single wave configuration)
    const assignAllClassesToWave = (waveIndex) => {
        const availableClasses = extractClasses().sort();
        const assignedToOtherWaves = getAssignedClasses(waveIndex);
        const unassignedClasses = availableClasses.filter(cls => !assignedToOtherWaves.has(cls));
        
        updateWaveConfig(waveIndex, 'classes', unassignedClasses);
    };
    
    // Count cars in a wave configuration
    const getCarCountInWave = (waveConfig) => {
        let carCount = 0;
        const classVariations = ['Class', 'class', 'CLASS'];
        const driverVariations = ['Name', 'Driver', 'DriverName', 'Pilot'];
        const waveDataMap = new Map();
        
        parsedData.forEach(file => {
            file.data.forEach(row => {
                const rowClass = normalizeFieldName(row, classVariations);
                if (waveConfig.classes.includes(rowClass)) {
                    const driverKey = normalizeFieldName(row, driverVariations);
                    if (driverKey) {
                        const key = driverKey.trim().toLowerCase();
                        if (!waveDataMap.has(key)) {
                            waveDataMap.set(key, true);
                            carCount++;
                        }
                    }
                }
            });
        });
        
        return carCount;
    };
    
    const renderStep = () => {
        switch(currentStep) {
            case 1:
                return (
                    <div>
                        <div style={{
                            background: '#e8f4fd',
                            border: '1px solid #4B7BFF',
                            borderRadius: '8px',
                            margin: '20px 0',
                            fontSize: '0.9rem',
                            overflow: 'hidden'
                        }}>
                            <div 
                                style={{ 
                                    padding: '15px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    userSelect: 'none'
                                }}
                                onClick={() => setShowTips(!showTips)}
                            >
                                <h4 style={{ color: '#4B7BFF', margin: 0, fontSize: '1rem' }}>
                                    💡 MyLaps Orbits Export Tips
                                </h4>
                                <img 
                                    src={showTips ? plus1Icon : minus1Icon} 
                                    alt={showTips ? "Collapse" : "Expand"} 
                                    style={{ 
                                        width: '27px', 
                                        height: '27px', 
                                        filter: 'brightness(0) saturate(100%) invert(33%) sepia(86%) saturate(6895%) hue-rotate(227deg) brightness(102%) contrast(103%)'
                                    }} 
                                />
                            </div>
                            <div style={{
                                maxHeight: showTips ? '500px' : '0',
                                transition: 'max-height 0.3s ease-in-out',
                                overflow: 'hidden'
                            }}>
                                <div style={{ padding: '0 15px 15px 15px' }}>
                                    <p style={{ color: '#4B7BFF', marginBottom: '10px' }}>
                                        <strong>Before exporting from MyLaps Orbits:</strong>
                                    </p>
                                    <ul style={{ color: '#4B7BFF', paddingLeft: '20px', margin: '0' }}>
                                        <li><strong>For time-based sorting:</strong> Include "Best Tm" and "2nd Best" columns in your results view</li>
                                        <li><strong>For points-based sorting:</strong> Include a "Points" column in your results view</li>
                                        <li><strong>Required columns:</strong> Driver, Number, Class are always needed</li>
                                    </ul>
                                    <p style={{ color: '#4B7BFF', marginTop: '10px', fontSize: '0.85rem', fontStyle: 'italic' }}>
                                        These columns must be visible in your results view before exporting to CSV for all sorting options to be available.
                                    </p>
                                </div>
                            </div>
                        </div>
                        
                        <div 
                            className="upload-area"
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onClick={() => fileInputRef.current.click()}
                        >
                            <div className="upload-icon">📁</div>
                            <h2>Drop CSV files here or click to browse</h2>
                            <p>Upload your race results files (CSV format)</p>
                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                accept=".csv"
                                style={{ display: 'none' }}
                                onChange={(e) => handleFileUpload(e.target.files)}
                            />
                        </div>
                        
                        {parseError && (
                            <div className="error-message" style={{
                                backgroundColor: '#fee',
                                color: '#c33',
                                padding: '15px',
                                borderRadius: '5px',
                                margin: '20px 0',
                                border: '1px solid #fcc'
                            }}>
                                <strong>Error:</strong> {parseError}
                                <p style={{ margin: '10px 0 0 0', fontSize: '0.9rem' }}>
                                    Please remove the problematic file and upload a valid CSV file with race data.
                                </p>
                            </div>
                        )}
                        
                        {uploadedFiles.length > 0 && (
                            <div className="file-list">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                    <h3 style={{ margin: 0 }}>Uploaded Files:</h3>
                                    <button 
                                        className="btn btn-secondary"
                                        onClick={removeAllFiles}
                                        style={{
                                            fontSize: '0.8rem',
                                            padding: '5px 10px',
                                            background: '#FF4B4B',
                                            color: 'white',
                                            border: 'none'
                                        }}
                                        title="Remove all uploaded files"
                                    >
                                        Remove All
                                    </button>
                                </div>
                                {uploadedFiles.map((file, idx) => (
                                    <div key={idx} className="file-item">
                                        <span className="file-name">{file.name}</span>
                                        <button className="remove-file" onClick={() => removeFile(idx)}>
                                            Remove
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        <div className="btn-group">
                            <button 
                                className="btn btn-primary"
                                onClick={() => setCurrentStep(2)}
                                disabled={uploadedFiles.length === 0 || parseError || !hasValidData}
                            >
                                Next Step
                            </button>
                        </div>
                    </div>
                );
                
            case 2:
                return (
                    <div>
                        <h2>Configure Wave Structure</h2>
                        <div className="form-group">
                            <label>Number of Waves:</label>
                            <input
                                type="number"
                                className="form-control number-input"
                                min="1"
                                max="10"
                                value={waveCount}
                                onChange={(e) => setWaveCount(parseInt(e.target.value) || 1)}
                            />
                        </div>
                        
                        <div className="btn-group">
                            <button 
                                className="btn btn-secondary"
                                onClick={() => setCurrentStep(1)}
                            >
                                Back
                            </button>
                            <button 
                                className="btn btn-primary"
                                onClick={() => {
                                    initializeWaveConfigs();
                                    setCurrentStep(3);
                                }}
                            >
                                Configure Waves
                            </button>
                        </div>
                    </div>
                );
                
            case 3:
                const availableClasses = extractClasses().sort();
                
                return (
                    <div>
                        <h2>Configure Each Wave</h2>
                        {waveConfigs.map((config, idx) => {
                            const assignedToOtherWaves = getAssignedClasses(idx);
                            
                            return (
                                <div key={idx} className="wave-config">
                                    <div className="wave-header">
                                        <div className="wave-title">Wave {config.waveNumber}</div>
                                    </div>
                                    
                                    <div className="form-group">
                                        <label>Start Type:</label>
                                        <div className="radio-group">
                                            <label className="radio-label">
                                                <input
                                                    type="radio"
                                                    value="flying"
                                                    checked={config.startType === 'flying'}
                                                    onChange={(e) => updateWaveConfig(idx, 'startType', e.target.value)}
                                                    disabled={idx > 0 && waveConfigs[idx-1].startType === 'standing'}
                                                />
                                                Flying Start
                                            </label>
                                            <label className="radio-label">
                                                <input
                                                    type="radio"
                                                    value="standing"
                                                    checked={config.startType === 'standing'}
                                                    onChange={(e) => updateWaveConfig(idx, 'startType', e.target.value)}
                                                />
                                                Standing Start
                                            </label>
                                        </div>
                                    </div>
                                    
                                    <div className="form-group">
                                        <label>Assign Classes:</label>
                                        {waveConfigs.length === 1 && (
                                            <button
                                                type="button"
                                                className="btn btn-secondary"
                                                style={{ 
                                                    fontSize: '0.8rem', 
                                                    padding: '5px 10px',
                                                    background: '#4B7BFF',
                                                    color: 'white',
                                                    border: 'none',
                                                    marginTop: '5px',
                                                    marginBottom: '10px',
                                                    display: 'block'
                                                }}
                                                onClick={() => assignAllClassesToWave(idx)}
                                                title="Assign all available classes to this wave"
                                            >
                                                Assign All Classes
                                            </button>
                                        )}
                                        <div className="checkbox-group">
                                            {availableClasses.map(cls => {
                                                const isAssignedElsewhere = assignedToOtherWaves.has(cls);
                                                return (
                                                    <label 
                                                        key={cls} 
                                                        className="checkbox-label"
                                                        style={{ 
                                                            opacity: isAssignedElsewhere ? 0.5 : 1,
                                                            cursor: isAssignedElsewhere ? 'not-allowed' : 'pointer'
                                                        }}
                                                        title={isAssignedElsewhere ? `Already assigned to another wave` : ''}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={config.classes.includes(cls)}
                                                            disabled={isAssignedElsewhere}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    updateWaveConfig(idx, 'classes', [...config.classes, cls]);
                                                                } else {
                                                                    updateWaveConfig(idx, 'classes', config.classes.filter(c => c !== cls));
                                                                }
                                                            }}
                                                        />
                                                        {cls}
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                
                                <div className="form-group">
                                    <label>Sort By:</label>
                                    <select 
                                        className="form-control"
                                        value={config.sortBy}
                                        onChange={(e) => updateWaveConfig(idx, 'sortBy', e.target.value)}
                                    >
                                        <option value="position">Finishing Position</option>
                                        <option value="bestTime">Best Time</option>
                                        {hasSecondBestTimes() && (
                                            <option value="secondBest">Second Best Time</option>
                                        )}
                                        {hasValidPoints() && (
                                            <option value="points">Points</option>
                                        )}
                                    </select>
                                </div>
                                
                                <div className="form-group">
                                    <label>Grid Order:</label>
                                    <select 
                                        className="form-control"
                                        value={config.gridOrder}
                                        onChange={(e) => updateWaveConfig(idx, 'gridOrder', e.target.value)}
                                    >
                                        <option value="straight">Straight Up</option>
                                        <option value="fastestFirst">Fastest Class First</option>
                                        <option value="slowestFirst">Slowest Class First</option>
                                    </select>
                                </div>
                                
                                <div className="form-group">
                                    <label className="checkbox-label">
                                        <input
                                            type="checkbox"
                                            checked={config.inverted}
                                            onChange={(e) => updateWaveConfig(idx, 'inverted', e.target.checked)}
                                        />
                                        Invert Grid
                                    </label>
                                    {config.inverted && (
                                        <div style={{ marginTop: '10px' }}>
                                            <div className="radio-group" style={{ marginBottom: '10px' }}>
                                                <label className="radio-label">
                                                    <input
                                                        type="radio"
                                                        checked={config.invertAll}
                                                        onChange={() => updateWaveConfig(idx, 'invertAll', true)}
                                                    />
                                                    Invert All
                                                </label>
                                                <label className="radio-label">
                                                    <input
                                                        type="radio"
                                                        checked={!config.invertAll}
                                                        onChange={() => updateWaveConfig(idx, 'invertAll', false)}
                                                    />
                                                    Invert Specific Count
                                                </label>
                                            </div>
                                            {!config.invertAll && (
                                                <div>
                                                    <label>Number of positions to invert:</label>
                                                    <input
                                                        type="number"
                                                        className="form-control number-input"
                                                        min="2"
                                                        max={Math.max(2, getCarCountInWave(config))}
                                                        value={config.invertCount}
                                                        onChange={(e) => updateWaveConfig(idx, 'invertCount', parseInt(e.target.value) || 2)}
                                                    />
                                                    <small style={{ color: '#666', fontSize: '0.8rem' }}>
                                                        Max: {getCarCountInWave(config)} cars in this wave
                                                    </small>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                
                                {idx < waveConfigs.length - 1 && (
                                    <div className="form-group">
                                        <label>Empty positions after this wave:</label>
                                        <input
                                            type="number"
                                            className="form-control number-input"
                                            min="0"
                                            max="10"
                                            value={config.emptyPositions}
                                            onChange={(e) => updateWaveConfig(idx, 'emptyPositions', parseInt(e.target.value) || 0)}
                                        />
                                    </div>
                                )}
                            </div>
                            );
                        })}
                        
                        <div className="btn-group">
                            <button 
                                className="btn btn-secondary"
                                onClick={() => setCurrentStep(2)}
                            >
                                Back
                            </button>
                            <button 
                                className="btn btn-primary"
                                onClick={() => {
                                    buildGrid();
                                    setCurrentStep(4);
                                }}
                            >
                                Preview Grid
                            </button>
                        </div>
                    </div>
                );
                
            case 4:
                return (
                    <div>
                        <h2>Review and Adjust Starting Grid</h2>
                        <p style={{ marginBottom: '20px', color: '#666' }}>
                            Drag and drop entries to manually adjust positions
                        </p>
                        
                        <div className="grid-preview">
                            {(() => {
                                let currentPosition = 1;
                                
                                // Function to generate wave description
                                const generateWaveDescription = (config) => {
                                    const descriptions = [];
                                    
                                    // Sort criteria
                                    const sortLabels = {
                                        'position': 'Finishing Position',
                                        'bestTime': 'Best Time',
                                        'secondBest': 'Second Best Time',
                                        'points': 'Points'
                                    };
                                    descriptions.push(`Sorted by ${sortLabels[config.sortBy] || 'Unknown'}`);
                                    
                                    // Grid order
                                    const orderLabels = {
                                        'straight': 'straight up',
                                        'fastestFirst': 'fastest class first',
                                        'slowestFirst': 'slowest class first'
                                    };
                                    descriptions.push(`${orderLabels[config.gridOrder] || 'unknown order'}`);
                                    
                                    // Inversion
                                    if (config.inverted) {
                                        if (config.invertAll) {
                                            descriptions.push('entire grid inverted');
                                        } else {
                                            descriptions.push(`top ${config.invertCount} positions inverted`);
                                        }
                                    }
                                    
                                    // Classes
                                    if (config.classes && config.classes.length > 0) {
                                        descriptions.push(`Classes: ${config.classes.join(', ')}`);
                                    }
                                    
                                    return descriptions.join(' • ');
                                };
                                
                                return finalGrid.map((wave, waveIdx) => {
                                    const waveEntries = wave.entries.map((entry, entryIdx) => ({
                                        ...entry,
                                        gridPosition: currentPosition + entryIdx
                                    }));
                                    currentPosition += wave.entries.length + (wave.emptyPositions || 0);
                                    
                                    return (
                                        <div key={waveIdx} className="grid-wave">
                                            <div className="grid-wave-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span>
                                                    Wave {waveIdx + 1} - {wave.config.startType.toUpperCase()} Start
                                                    {wave.emptyPositions > 0 && ` (${wave.emptyPositions} empty position${wave.emptyPositions > 1 ? 's' : ''} after)`}
                                                </span>
                                                <div style={{ display: 'flex', gap: '5px' }}>
                                                    {waveIdx > 0 && (
                                                        <span 
                                                            title="Combine with previous wave"
                                                            style={{ 
                                                                cursor: 'pointer',
                                                                padding: '5px 10px',
                                                                borderRadius: '4px',
                                                                transition: 'all 0.2s ease',
                                                                display: 'inline-flex',
                                                                alignItems: 'center'
                                                            }}
                                                            onClick={() => combineWithPreviousWave(waveIdx)}
                                                            onMouseEnter={(e) => {
                                                                e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                                                            }}
                                                            onMouseLeave={(e) => {
                                                                e.target.style.backgroundColor = 'transparent';
                                                            }}
                                                        >
                                                            <img src={mergeIcon} alt="Merge with previous wave" style={{ width: '20px', height: '20px', filter: 'brightness(0) invert(1)' }} />
                                                        </span>
                                                    )}
                                                    {isWaveModified(waveIdx) && (
                                                        <span 
                                                            title="Reset wave to original order"
                                                            style={{ 
                                                                cursor: 'pointer',
                                                                padding: '5px 10px',
                                                                borderRadius: '4px',
                                                                transition: 'all 0.2s ease',
                                                                display: 'inline-flex',
                                                                alignItems: 'center'
                                                            }}
                                                            onClick={() => resetWave(waveIdx)}
                                                            onMouseEnter={(e) => {
                                                                e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                                                            }}
                                                            onMouseLeave={(e) => {
                                                                e.target.style.backgroundColor = 'transparent';
                                                            }}
                                                        >
                                                            <img src={refreshIcon} alt="Reset wave to original order" style={{ width: '16px', height: '16px', filter: 'brightness(0) invert(1)' }} />
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div style={{
                                                padding: '10px 20px',
                                                background: '#f8f9fa',
                                                fontSize: '0.9rem',
                                                color: '#666',
                                                borderBottom: '1px solid #e0e0e0',
                                                fontStyle: 'italic'
                                            }}>
                                                {generateWaveDescription(wave.config)}
                                            </div>
                                            {(() => {
                                                // For class-ordered waves, group entries by class and show class headers
                                                if (wave.config.gridOrder === 'fastestFirst' || wave.config.gridOrder === 'slowestFirst') {
                                                    const classOrder = getClassOrder(wave);
                                                    const result = [];
                                                    
                                                    classOrder.forEach((className, classIdx) => {
                                                        const classEntries = waveEntries.filter(entry => entry.Class === className);
                                                        
                                                        // Add class header with move controls
                                                        result.push(
                                                            <div key={`class-header-${className}`} style={{
                                                                background: '#e8f4fd',
                                                                padding: '8px 15px',
                                                                borderBottom: '1px solid #d0e7f7',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '10px',
                                                                fontSize: '0.9rem',
                                                                fontWeight: 'bold',
                                                                color: '#2c5282'
                                                            }}>
                                                                {classIdx > 0 && (
                                                                    <span
                                                                        title="Move Class Up"
                                                                        style={{
                                                                            cursor: 'pointer',
                                                                            padding: '2px',
                                                                            display: 'inline-flex',
                                                                            alignItems: 'center'
                                                                        }}
                                                                        onClick={(e) => {
                                                                            e.preventDefault();
                                                                            e.stopPropagation();
                                                                            moveClassUp(waveIdx, className);
                                                                        }}
                                                                    >
                                                                        <img src={plus1Icon} alt="Move class up" style={{ width: '18px', height: '18px', filter: 'brightness(0)' }} />
                                                                    </span>
                                                                )}
                                                                <span>{className}</span>
                                                                {classIdx < classOrder.length - 1 && (
                                                                    <span
                                                                        title="Move Class Down"
                                                                        style={{
                                                                            cursor: 'pointer',
                                                                            padding: '2px',
                                                                            display: 'inline-flex',
                                                                            alignItems: 'center'
                                                                        }}
                                                                        onClick={(e) => {
                                                                            e.preventDefault();
                                                                            e.stopPropagation();
                                                                            moveClassDown(waveIdx, className);
                                                                        }}
                                                                    >
                                                                        <img src={minus1Icon} alt="Move class down" style={{ width: '18px', height: '18px', filter: 'brightness(0)' }} />
                                                                    </span>
                                                                )}
                                                            </div>
                                                        );
                                                        
                                                        // Add entries for this class
                                                        classEntries.forEach((entry, entryIdx) => {
                                                            const originalEntryIdx = waveEntries.indexOf(entry);
                                                            result.push(
                                                                <div 
                                                                    key={`entry-${originalEntryIdx}`}
                                                                    className={`grid-entry ${draggedOver?.waveIndex === waveIdx && draggedOver?.entryIndex === originalEntryIdx ? 'drag-over' : ''}`}
                                                                    draggable
                                                                    onDragStart={(e) => handleGridDragStart(e, waveIdx, originalEntryIdx)}
                                                                    onDragOver={(e) => handleGridDragOver(e, waveIdx, originalEntryIdx)}
                                                                    onDrop={(e) => handleGridDrop(e, waveIdx, originalEntryIdx)}
                                                                >
                                                                    <span className="drag-handle">☰</span>
                                                                    <div className="grid-position">{entry.gridPosition}</div>
                                                                    <div className="grid-car">
                                                                        <div className="grid-car-number">
                                                                            {entry.Number || '?'}
                                                                        </div>
                                                                        <div className="grid-driver">
                                                                            {entry.Driver || 'Unknown Driver'}
                                                                        </div>
                                                                        <div className="grid-class">
                                                                            {entry.Class || 'N/A'}
                                                                        </div>
                                                                        <div className="grid-time">
                                                                            {entry.BestTime || '--:--'}
                                                                        </div>
                                                                    </div>
                                                                    <div style={{ display: 'flex', gap: '5px', marginLeft: '10px' }}>
                                                                        <span 
                                                                            title="Reposition to end of class"
                                                                            style={{ 
                                                                                cursor: 'pointer', 
                                                                                padding: '5px',
                                                                                display: 'inline-flex',
                                                                                alignItems: 'center'
                                                                            }}
                                                                            onClick={() => moveToEndOfClass(waveIdx, originalEntryIdx)}
                                                                        >
                                                                            <img src={minus1Icon} alt="Move to end of class" style={{ width: '16px', height: '16px', filter: 'brightness(0)' }} />
                                                                        </span>
                                                                        <span 
                                                                            title="Reposition to end of wave"
                                                                            style={{ 
                                                                                cursor: 'pointer', 
                                                                                padding: '5px',
                                                                                display: 'inline-flex',
                                                                                alignItems: 'center'
                                                                            }}
                                                                            onClick={() => moveToEndOfWave(waveIdx, originalEntryIdx)}
                                                                        >
                                                                            <img src={minus3Icon} alt="Move to end of wave" style={{ width: '16px', height: '16px', filter: 'brightness(0)' }} />
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        });
                                                    });
                                                    
                                                    return result;
                                                } else {
                                                    // For non-class-ordered waves, show entries normally
                                                    return waveEntries.map((entry, entryIdx) => (
                                                        <div 
                                                            key={entryIdx} 
                                                            className={`grid-entry ${draggedOver?.waveIndex === waveIdx && draggedOver?.entryIndex === entryIdx ? 'drag-over' : ''}`}
                                                            draggable
                                                            onDragStart={(e) => handleGridDragStart(e, waveIdx, entryIdx)}
                                                            onDragOver={(e) => handleGridDragOver(e, waveIdx, entryIdx)}
                                                            onDrop={(e) => handleGridDrop(e, waveIdx, entryIdx)}
                                                        >
                                                            <span className="drag-handle">☰</span>
                                                            <div className="grid-position">{entry.gridPosition}</div>
                                                            <div className="grid-car">
                                                                <div className="grid-car-number">
                                                                    {entry.Number || '?'}
                                                                </div>
                                                                <div className="grid-driver">
                                                                    {entry.Driver || 'Unknown Driver'}
                                                                </div>
                                                                <div className="grid-class">
                                                                    {entry.Class || 'N/A'}
                                                                </div>
                                                                <div className="grid-time">
                                                                    {entry.BestTime || '--:--'}
                                                                </div>
                                                            </div>
                                                            <div style={{ display: 'flex', gap: '5px', marginLeft: '10px' }}>
                                                                <span 
                                                                    title="Reposition to end of wave"
                                                                    style={{ 
                                                                        cursor: 'pointer', 
                                                                        padding: '5px',
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center'
                                                                    }}
                                                                    onClick={() => moveToEndOfWave(waveIdx, entryIdx)}
                                                                >
                                                                    <img src={minus3Icon} alt="Move to end of wave" style={{ width: '16px', height: '16px', filter: 'brightness(0)' }} />
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ));
                                                }
                                            })()}
                                            {wave.emptyPositions > 0 && waveIdx < finalGrid.length - 1 && (
                                                <div style={{ 
                                                    padding: '10px 20px', 
                                                    textAlign: 'center', 
                                                    color: '#999',
                                                    fontStyle: 'italic',
                                                    borderBottom: '1px solid #e0e0e0'
                                                }}>
                                                    {wave.emptyPositions} empty position{wave.emptyPositions > 1 ? 's' : ''}
                                                </div>
                                            )}
                                        </div>
                                    );
                                });
                            })()}
                        </div>
                        
                        <div className="btn-group">
                            <button 
                                className="btn btn-secondary"
                                onClick={() => setCurrentStep(3)}
                            >
                                Back
                            </button>
                            <button 
                                className="btn btn-primary"
                                onClick={() => setCurrentStep(5)}
                            >
                                Finalize Grid
                            </button>
                        </div>
                    </div>
                );
                
            case 5:
                return (
                    <div style={{ textAlign: 'center' }}>
                        <h2>Export Grid</h2>
                        <p style={{ fontSize: '1.2rem', marginBottom: '30px', color: '#666' }}>
                            Your starting grid is ready for export!
                        </p>
                        
                        <div style={{ 
                            background: 'linear-gradient(135deg, #FF4B4B 0%, #E53E3E 100%)',
                            color: 'white',
                            padding: '40px',
                            borderRadius: '15px',
                            maxWidth: '400px',
                            margin: '0 auto 30px'
                        }}>
                            <div style={{ fontSize: '3rem', marginBottom: '20px' }}>📄</div>
                            <h3>Grid Summary</h3>
                            <p>Total Waves: {finalGrid.length}</p>
                            <p>Total Entries: {finalGrid.reduce((sum, wave) => sum + wave.entries.length, 0)}</p>
                        </div>
                        
                        <div style={{ maxWidth: '400px', margin: '0 auto 30px' }}>
                            <div className="form-group" style={{ textAlign: 'left' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#555' }}>
                                    Grid Name:
                                </label>
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="Enter grid name (e.g., 'Spring Championship Race 1')"
                                    value={gridName}
                                    onChange={(e) => setGridName(e.target.value)}
                                    style={{ textAlign: 'center' }}
                                />
                            </div>
                        </div>
                        
                        <div className="btn-group">
                            <button 
                                className="btn btn-secondary"
                                onClick={() => setCurrentStep(4)}
                            >
                                Back to Review
                            </button>
                            <button 
                                className="btn btn-primary"
                                onClick={generatePDF}
                                style={{ 
                                    background: 'linear-gradient(135deg, #00D46A 0%, #00B359 100%)',
                                    fontSize: '1.1rem',
                                    padding: '15px 40px'
                                }}
                            >
                                📥 Download PDF
                            </button>
                            <button 
                                className="btn btn-primary"
                                onClick={generateCSV}
                                style={{ 
                                    background: 'linear-gradient(135deg, #4B7BFF 0%, #3B5BFF 100%)',
                                    fontSize: '1.1rem',
                                    padding: '15px 40px'
                                }}
                            >
                                📊 Download CSV
                            </button>
                            <button 
                                className="btn btn-secondary"
                                onClick={startNewGrid}
                                style={{ 
                                    background: 'linear-gradient(135deg, #6C757D 0%, #495057 100%)',
                                    color: 'white',
                                    fontSize: '1.1rem',
                                    padding: '15px 40px'
                                }}
                            >
                                🆕 New Grid
                            </button>
                        </div>
                    </div>
                );
                
            case 6:
                return (
                    <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'left' }}>
                        <h2 style={{ textAlign: 'center', marginBottom: '30px' }}>Grid Builder Help</h2>
                        
                        <div style={{
                            background: '#f8f9fa',
                            padding: '20px',
                            borderRadius: '8px',
                            marginBottom: '30px',
                            textAlign: 'center'
                        }}>
                            <h3 style={{ color: '#4B7BFF', marginBottom: '15px' }}>Overview</h3>
                            <p style={{ fontSize: '1.1rem', color: '#666', lineHeight: '1.6' }}>
                                Grid Builder helps race organizers create professional starting grids for racing events. 
                                Upload CSV race data, configure multiple waves with different start types, and export grids as PDF or CSV files.
                            </p>
                        </div>

                        <div style={{ display: 'grid', gap: '20px', gridTemplateColumns: '1fr 1fr', marginBottom: '30px' }}>
                            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
                                <h4 style={{ color: '#4B7BFF', marginBottom: '15px' }}>📁 Step 1: Upload Files</h4>
                                <p style={{ fontSize: '0.9rem', lineHeight: '1.5', color: '#666' }}>
                                    Import your race data from CSV files. Supports multiple file formats with Driver, Car Number, Class, and timing information.
                                </p>
                                <ul style={{ fontSize: '0.85rem', color: '#888', marginTop: '10px' }}>
                                    <li>Drag & drop or click to upload</li>
                                    <li>Multiple files supported</li>
                                    <li>Automatic format detection</li>
                                </ul>
                            </div>

                            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
                                <h4 style={{ color: '#4B7BFF', marginBottom: '15px' }}>🌊 Step 2: Set Waves</h4>
                                <p style={{ fontSize: '0.9rem', lineHeight: '1.5', color: '#666' }}>
                                    Choose how many starting groups you need (1-10 waves). More waves create smaller, more competitive groups.
                                </p>
                                <ul style={{ fontSize: '0.85rem', color: '#888', marginTop: '10px' }}>
                                    <li>Slider or input selection</li>
                                    <li>Consider track capacity</li>
                                    <li>Balance competition levels</li>
                                </ul>
                            </div>

                            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
                                <h4 style={{ color: '#4B7BFF', marginBottom: '15px' }}>⚙️ Step 3: Configure</h4>
                                <p style={{ fontSize: '0.9rem', lineHeight: '1.5', color: '#666' }}>
                                    Set up each wave's start type, assign classes, choose sorting criteria, and configure grid order options.
                                </p>
                                <ul style={{ fontSize: '0.85rem', color: '#888', marginTop: '10px' }}>
                                    <li>Flying vs Standing starts</li>
                                    <li>Class assignments</li>
                                    <li>Sort by position, time, or points</li>
                                    <li>Inversion options</li>
                                </ul>
                            </div>

                            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
                                <h4 style={{ color: '#4B7BFF', marginBottom: '15px' }}>👁️ Step 4: Review</h4>
                                <p style={{ fontSize: '0.9rem', lineHeight: '1.5', color: '#666' }}>
                                    Fine-tune your grid with manual adjustments. Drag & drop drivers, move entire classes, merge waves, or reset changes.
                                </p>
                                <ul style={{ fontSize: '0.85rem', color: '#888', marginTop: '10px' }}>
                                    <li>Drag & drop reordering</li>
                                    <li>Class movement controls</li>
                                    <li>Wave merge & reset options</li>
                                </ul>
                            </div>
                        </div>

                        <div style={{
                            background: 'linear-gradient(135deg, #FF8A00 0%, #E57300 100%)',
                            color: 'white',
                            padding: '20px',
                            borderRadius: '8px',
                            marginBottom: '30px'
                        }}>
                            <h4 style={{ marginBottom: '15px' }}>📤 Step 5: Export Options</h4>
                            <div style={{ display: 'grid', gap: '15px', gridTemplateColumns: '1fr 1fr' }}>
                                <div>
                                    <strong>PDF Export</strong>
                                    <p style={{ fontSize: '0.9rem', marginTop: '5px', opacity: '0.9' }}>
                                        Professional formatted grid sheets perfect for printing and posting at events.
                                    </p>
                                </div>
                                <div>
                                    <strong>CSV Export</strong>
                                    <p style={{ fontSize: '0.9rem', marginTop: '5px', opacity: '0.9' }}>
                                        Spreadsheet-friendly format for further editing or importing into other systems.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div style={{ background: '#fff3cd', padding: '20px', borderRadius: '8px', marginBottom: '30px', border: '1px solid #ffeaa7' }}>
                            <h4 style={{ color: '#856404', marginBottom: '15px' }}>💡 Pro Tips</h4>
                            <ul style={{ color: '#856404', lineHeight: '1.6' }}>
                                <li><strong>Plan Your Waves:</strong> Consider track capacity, safety, and competitive balance</li>
                                <li><strong>Class Ordering:</strong> Use fastest/slowest class first for different race dynamics</li>
                                <li><strong>Inversion Strategy:</strong> Mix up the field to create closer racing</li>
                                <li><strong>Data Quality:</strong> Ensure CSV files have consistent formatting and class names</li>
                            </ul>
                        </div>

                        <div style={{ background: '#f8d7da', padding: '20px', borderRadius: '8px', marginBottom: '30px', border: '1px solid #f5c6cb' }}>
                            <h4 style={{ color: '#721c24', marginBottom: '15px' }}>🔧 Troubleshooting</h4>
                            <div style={{ color: '#721c24' }}>
                                <p><strong>Upload Issues:</strong> Check file is valid CSV with Driver, Number, Class columns</p>
                                <p><strong>Missing Classes:</strong> Verify CSV files contain Class column with data</p>
                                <p><strong>Sort Options Missing:</strong> Timing or Points data may not be available in uploaded files</p>
                                <p><strong>Export Problems:</strong> Ensure grid has been built and grid name is filled in</p>
                            </div>
                        </div>

                        <div style={{ textAlign: 'center' }}>
                            <button 
                                className="btn btn-primary"
                                onClick={() => setCurrentStep(1)}
                                style={{ 
                                    background: 'linear-gradient(135deg, #00D46A 0%, #00B359 100%)',
                                    fontSize: '1.1rem',
                                    padding: '15px 40px'
                                }}
                            >
                                🚀 Start Building Your Grid
                            </button>
                        </div>
                    </div>
                );
                
            default:
                return null;
        }
    };
    
    return (
        <div className="container">
            <div className="header">
                <div style={{ position: 'relative' }}>
                    <h1>
                        <img src={racingFlag} alt="Racing flag" style={{ height: '2.5rem', marginRight: '10px', verticalAlign: 'middle', filter: 'brightness(0) invert(1)' }} />
                        Grid Builder
                    </h1>
                    <button
                        onClick={() => setCurrentStep(6)}
                        style={{
                            position: 'absolute',
                            top: '10px',
                            right: '20px',
                            background: 'rgba(75, 123, 255, 0.2)',
                            border: '1px solid #4B7BFF',
                            color: 'white',
                            borderRadius: '20px',
                            padding: '8px 16px',
                            fontSize: '0.9rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                            e.target.style.background = 'rgba(75, 123, 255, 0.4)';
                        }}
                        onMouseLeave={(e) => {
                            e.target.style.background = 'rgba(75, 123, 255, 0.2)';
                        }}
                    >
                        ❓ Help
                    </button>
                </div>
                <p>Create professional starting grids for your racing events</p>
                <p style={{ fontSize: '0.9rem', marginTop: '15px', opacity: '0.85' }}>
                    Provided by My Race Day - Building your comprehensive solution for professional motorsport event operations
                </p>
            </div>
            
            <div className="progress-bar">
                {steps.map(step => (
                    <div 
                        key={step.num}
                        className={`progress-step ${currentStep === step.num ? 'active' : ''} ${currentStep > step.num ? 'completed' : ''} ${currentStep >= step.num ? 'clickable' : ''}`}
                        data-step={step.num}
                        onClick={() => {
                            // Allow navigation to current step or any previous completed step
                            if (step.num <= currentStep) {
                                setCurrentStep(step.num);
                            }
                        }}
                        style={{ 
                            cursor: step.num <= currentStep ? 'pointer' : 'default',
                            opacity: step.num > currentStep ? 0.5 : 1
                        }}
                        title={step.num <= currentStep ? `Go to ${step.label}` : `Complete previous steps first`}
                    >
                        <span>{step.label}</span>
                    </div>
                ))}
            </div>
            
            <div className="content">
                {renderStep()}
            </div>
            
            <div style={{
                position: 'fixed',
                bottom: '10px',
                right: '15px',
                fontSize: '0.7rem',
                color: '#999',
                opacity: '0.7',
                fontFamily: 'monospace'
            }}>
                v0.2.3
            </div>
        </div>
    );
};

export default GridBuilder;