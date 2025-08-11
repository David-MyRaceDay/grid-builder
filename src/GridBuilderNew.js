import React, { useState, useRef, useCallback } from 'react';
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import { 
  Upload, 
  FileText, 
  X, 
  ChevronRight, 
  ChevronLeft,
  Flag,
  RefreshCw,
  Merge,
  ChevronUp,
  ChevronDown,
  MoveVertical,
  Download,
  File,
  HelpCircle,
  AlertCircle,
  Info,
  Settings,
  Eye
} from 'lucide-react';

// UI Components
import { Button } from './components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Select } from './components/ui/select';
import { Alert, AlertDescription, AlertTitle } from './components/ui/alert';
import { Badge } from './components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './components/ui/accordion';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './components/ui/dialog';
import { cn } from './lib/utils';

// Import SVG icons
import racingFlag from './assets/racing-flag.svg';
import minus3Icon from './assets/minus_3.svg';
import minus1Icon from './assets/minus_1.svg';

const GridBuilder = () => {
    const [currentStep, setCurrentStep] = useState(1);
    const [uploadedFiles, setUploadedFiles] = useState([]);
    const [parsedData, setParsedData] = useState([]);
    const [waveCount, setWaveCount] = useState(1);
    const [defaultWaveSpacing, setDefaultWaveSpacing] = useState(0);
    const [waveConfigs, setWaveConfigs] = useState([]);
    const [finalGrid, setFinalGrid] = useState([]);
    const [originalGrid, setOriginalGrid] = useState([]);
    const [gridName, setGridName] = useState('');
    const fileInputRef = useRef(null);
    const [draggedItem, setDraggedItem] = useState(null);
    const [draggedOver, setDraggedOver] = useState(null);
    const [parseError, setParseError] = useState('');
    const [hasValidData, setHasValidData] = useState(true);
    const isMovingRef = useRef(false);
    const [showTips, setShowTips] = useState(false);
    const [showHelpModal, setShowHelpModal] = useState(false);
    const [fileWarnings, setFileWarnings] = useState(new Map());
    
    const steps = [
        { num: 1, label: 'Upload Files', icon: Upload },
        { num: 2, label: 'Set Waves', icon: Flag },
        { num: 3, label: 'Configure', icon: Settings },
        { num: 4, label: 'Review', icon: Eye },
        { num: 5, label: 'Export', icon: Download }
    ];
    
    const parseLaptimesCSV = (content, fileName) => {
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
                        'Name': currentDriver.name,
                        'Class': currentDriver.class,
                        'Best Tm': bestLapTime,
                        'Best Speed': bestSpeed || '',
                        '2nd Best': secondBestLapTime || '',
                        '2nd Spd': secondBestSpeed || '',
                        'Driver': currentDriver.name,
                        'Number': currentDriver.number
                    });
                }
                
                // Parse new driver info: "181 - Ryan Sotak - TT4"
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
            } else if (currentDriver && line.startsWith('"')) {
                // This is lap data, parse it
                try {
                    const lapData = Papa.parse(line, { header: false }).data[0];
                    if (lapData && lapData.length >= 4) {
                        const lapTime = lapData[2]; // "Lap Tm" column
                        const speed = lapData[3]; // "Speed" column
                        
                        if (lapTime && lapTime !== 'Lap Tm') {
                            // Convert lap time to seconds for comparison
                            const timeInSeconds = parseTimeToSeconds(lapTime);
                            const currentBestInSeconds = bestLapTime ? parseTimeToSeconds(bestLapTime) : Infinity;
                            const current2ndBestInSeconds = secondBestLapTime ? parseTimeToSeconds(secondBestLapTime) : Infinity;
                            
                            if (timeInSeconds < currentBestInSeconds) {
                                // This is a new best time, move current best to 2nd best
                                secondBestLapTime = bestLapTime;
                                secondBestSpeed = bestSpeed;
                                bestLapTime = lapTime;
                                bestSpeed = speed;
                            } else if (timeInSeconds < current2ndBestInSeconds && timeInSeconds > currentBestInSeconds) {
                                // This is a new 2nd best time
                                secondBestLapTime = lapTime;
                                secondBestSpeed = speed;
                            }
                        }
                    }
                } catch (e) {
                    // Skip invalid lap data lines
                    continue;
                }
            }
        }
        
        // Don't forget the last driver
        if (currentDriver && bestLapTime) {
            results.push({
                'No.': currentDriver.number,
                'Name': currentDriver.name,
                'Class': currentDriver.class,
                'Best Tm': bestLapTime,
                'Best Speed': bestSpeed || '',
                '2nd Best': secondBestLapTime || '',
                '2nd Spd': secondBestSpeed || '',
                'Driver': currentDriver.name,
                'Number': currentDriver.number
            });
        }
        
        return results;
    };

    const parseCSV = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target.result;
                
                // Parse as regular CSV (removed laptimes format check for now)
                Papa.parse(content, {
                    header: true,
                    dynamicTyping: true,
                    skipEmptyLines: true,
                    complete: (results) => {
                        if (results.errors && results.errors.length > 0) {
                            reject(new Error(`Error parsing ${file.name}: ${results.errors[0].message}`));
                            return;
                        }
                        
                        if (!results.data || results.data.length === 0) {
                            reject(new Error(`No valid data found in ${file.name}. Please check the file format.`));
                            return;
                        }
                        
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
    
    // Helper function to parse time string to seconds
    const parseTimeToSeconds = (timeStr) => {
        if (!timeStr || timeStr === '--:--' || timeStr === '') {
            return Infinity; // Return Infinity for invalid times so they sort last
        }
        
        // Handle different time formats: "MM:SS.mmm", "SS.mmm", "M:SS.mmm"
        const parts = timeStr.toString().split(':');
        if (parts.length === 2) {
            // MM:SS.mmm or M:SS.mmm format
            const minutes = parseInt(parts[0]) || 0;
            const seconds = parseFloat(parts[1]) || 0;
            return minutes * 60 + seconds;
        } else if (parts.length === 1) {
            // SS.mmm format
            return parseFloat(parts[0]) || Infinity;
        }
        
        return Infinity; // Default for unparseable times
    };
    
    const consolidateDriverData = (allParsedFiles) => {
        const driverMap = new Map();
        
        allParsedFiles.forEach((parsedFile, fileIndex) => {
            // Add safety check for parsedFile and parsedFile.data
            if (!parsedFile || !parsedFile.data) {
                console.error('Invalid parsed file structure:', parsedFile);
                return;
            }
            
            parsedFile.data.forEach(entry => {
                // Get driver identifier (prefer number, fallback to name)
                const driverKey = entry['No.'] || entry.Number || entry['Car'] || entry.Name || entry.Driver || `unknown_${fileIndex}_${Math.random()}`;
                const driverName = entry.Name || entry.Driver || entry.DriverName || entry.Pilot || '';
                const driverNumber = entry['No.'] || entry.Number || entry['Car'] || entry['#'] || entry.Num || '';
                const driverClass = entry.Class || entry.class || entry.CLASS || '';
                
                if (!driverMap.has(driverKey)) {
                    driverMap.set(driverKey, {
                        driverKey,
                        name: driverName,
                        number: driverNumber,
                        class: driverClass,
                        files: [],
                        allTimes: [],
                        bestOverallTime: null,
                        secondBestOverallTime: null,
                        totalPoints: 0,
                        averagePoints: 0,
                        fileCount: 0,
                        allPositions: [],
                        bestPosition: null,
                        averagePosition: null,
                        allPositionsInClass: [],
                        bestPositionInClass: null,
                        averagePositionInClass: null
                    });
                }
                
                const driver = driverMap.get(driverKey);
                
                // Extract times, points, and positions from this file entry
                const fileData = {
                    fileName: parsedFile.fileName,
                    fileIndex,
                    bestTime: entry['Best Tm'] || entry.BestTime || entry.Time || null,
                    secondBestTime: entry['2nd Best'] || entry.SecondBest || null,
                    bestSpeed: entry['Best Speed'] || entry.BestSpeed || entry.Speed || null,
                    secondBestSpeed: entry['2nd Spd'] || entry.SecondSpeed || null,
                    points: parseFloat(entry.Points || entry.points || entry.POINTS || 0) || 0,
                    position: entry.Pos || entry.Position || entry.Finish || null,
                    positionInClass: entry.PIC || entry.PositionInClass || entry.ClassPosition || null
                };
                
                driver.files.push(fileData);
                driver.fileCount++;
                
                // Add times to the all times array
                if (fileData.bestTime) {
                    driver.allTimes.push({
                        time: fileData.bestTime,
                        speed: fileData.bestSpeed,
                        fileName: parsedFile.fileName,
                        type: 'best'
                    });
                }
                
                if (fileData.secondBestTime) {
                    driver.allTimes.push({
                        time: fileData.secondBestTime,
                        speed: fileData.secondBestSpeed,
                        fileName: parsedFile.fileName,
                        type: 'second'
                    });
                }
                
                // Update points totals
                driver.totalPoints += fileData.points;
                
                // Collect position data
                if (fileData.position && !isNaN(parseInt(fileData.position))) {
                    driver.allPositions.push({
                        position: parseInt(fileData.position),
                        fileName: parsedFile.fileName
                    });
                }
                
                if (fileData.positionInClass && !isNaN(parseInt(fileData.positionInClass))) {
                    driver.allPositionsInClass.push({
                        position: parseInt(fileData.positionInClass),
                        fileName: parsedFile.fileName
                    });
                }
            });
        });
        
        // Calculate overall best and second best times and positions for each driver
        driverMap.forEach(driver => {
            if (driver.fileCount > 0) {
                driver.averagePoints = driver.totalPoints / driver.fileCount;
            }
            
            if (driver.allTimes.length > 0) {
                // Sort all times by speed (convert to seconds)
                driver.allTimes.sort((a, b) => parseTimeToSeconds(a.time) - parseTimeToSeconds(b.time));
                
                driver.bestOverallTime = driver.allTimes[0];
                driver.secondBestOverallTime = driver.allTimes.length > 1 ? driver.allTimes[1] : null;
            }
            
            // Calculate position statistics
            if (driver.allPositions.length > 0) {
                driver.allPositions.sort((a, b) => a.position - b.position);
                driver.bestPosition = driver.allPositions[0].position;
                const avgPos = driver.allPositions.reduce((sum, p) => sum + p.position, 0) / driver.allPositions.length;
                driver.averagePosition = Math.round(avgPos * 100) / 100; // Round to 2 decimals
            }
            
            if (driver.allPositionsInClass.length > 0) {
                driver.allPositionsInClass.sort((a, b) => a.position - b.position);
                driver.bestPositionInClass = driver.allPositionsInClass[0].position;
                const avgPIC = driver.allPositionsInClass.reduce((sum, p) => sum + p.position, 0) / driver.allPositionsInClass.length;
                driver.averagePositionInClass = Math.round(avgPIC * 100) / 100; // Round to 2 decimals
            }
        });
        
        return Array.from(driverMap.values());
    };

    const handleFileUpload = async (files) => {
        setParseError('');
        
        const fileArray = Array.from(files);
        const csvFiles = fileArray.filter(f => f.name.endsWith('.csv'));
        
        try {
            const newParsed = await Promise.all(csvFiles.map(parseCSV));
            // Extract original files from previously parsed data
            const previousFiles = parsedData.length > 0 && parsedData[0].originalFiles 
                ? parsedData[0].originalFiles 
                : [];
            const allParsedFiles = [...previousFiles, ...newParsed];
            
            // Analyze each new file for missing columns
            const newWarnings = new Map(fileWarnings);
            newParsed.forEach(file => {
                const warnings = analyzeFileColumns(file);
                if (warnings.length > 0) {
                    newWarnings.set(file.fileName, warnings);
                }
            });
            setFileWarnings(newWarnings);
            
            // Consolidate driver data across all files
            const consolidatedData = consolidateDriverData(allParsedFiles);
            
            // Store both consolidated data and original files for reference
            const dataWithOriginals = consolidatedData.map(driver => ({
                ...driver,
                originalFiles: allParsedFiles
            }));
            
            setParsedData(dataWithOriginals);
            setUploadedFiles(prev => [...prev, ...csvFiles]);
            setHasValidData(true);
        } catch (error) {
            setParseError(error.message);
            setHasValidData(false);
        }
    };
    
    const handleDrop = (e) => {
        e.preventDefault();
        e.currentTarget.classList.remove('border-primary');
        handleFileUpload(e.dataTransfer.files);
    };
    
    const handleDragOver = (e) => {
        e.preventDefault();
        e.currentTarget.classList.add('border-primary');
    };
    
    const handleDragLeave = (e) => {
        e.currentTarget.classList.remove('border-primary');
    };
    
    const removeFile = (index) => {
        setUploadedFiles(prev => prev.filter((_, i) => i !== index));
        setParsedData(prev => prev.filter((_, i) => i !== index));
        setFileWarnings(prev => {
            const newWarnings = new Map(prev);
            newWarnings.delete(uploadedFiles[index]?.name);
            return newWarnings;
        });
        setParseError('');
        setHasValidData(true);
    };
    
    const removeAllFiles = () => {
        setUploadedFiles([]);
        setParsedData([]);
        setFileWarnings(new Map());
        setParseError('');
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
        
        // With the new consolidated data structure, parsedData is now an array of drivers
        parsedData.forEach(driver => {
            if (driver.class && driver.class.trim() !== '') {
                classSet.add(driver.class);
            }
        });
        
        return Array.from(classSet).filter(c => c && c.trim() !== '');
    };
    
    const getCarCountsByClass = () => {
        const classCounts = new Map();
        
        // Count cars per class from parsed data
        parsedData.forEach(driver => {
            if (driver.class && driver.class.trim() !== '') {
                const className = driver.class;
                classCounts.set(className, (classCounts.get(className) || 0) + 1);
            }
        });
        
        return classCounts;
    };
    
    const hasSecondBestTimes = () => {
        return parsedData.some(driver => 
            driver.secondBestOverallTime || 
            driver.files.some(file => file.secondBestTime)
        );
    };
    
    const hasValidPoints = () => {
        return parsedData.some(driver => 
            driver.totalPoints > 0 || 
            driver.files.some(file => file.points > 0)
        );
    };
    
    const hasMultipleFiles = () => {
        return uploadedFiles.length > 1;
    };
    
    const hasPositionData = () => {
        return parsedData.some(driver => 
            driver.files.some(file => file.position)
        );
    };
    
    const initializeWaveConfigs = () => {
        const configs = [];
        let canHaveFlying = true;
        
        for (let i = 0; i < waveCount; i++) {
            configs.push({
                waveNumber: i + 1,
                startType: canHaveFlying ? 'flying' : 'standing',
                classes: [],
                sortBy: 'bestTime',
                gridOrder: 'straight',
                inverted: false,
                invertAll: false,
                invertCount: 2,
                emptyPositions: i < waveCount - 1 ? defaultWaveSpacing : 0,
                tieBreaker1: 'bestTime',
                tieBreaker2: 'bestPositionInClass',
                tieBreaker3: 'alphabetical'
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
    
    // Helper function to evaluate tie-breaking criteria
    const evaluateTieBreaker = (driver, criterion) => {
        switch (criterion) {
            case 'bestTime':
                return driver.bestOverallTime ? parseTimeToSeconds(driver.bestOverallTime.time) : 999999;
            case 'secondBest':
                return driver.secondBestOverallTime ? parseTimeToSeconds(driver.secondBestOverallTime.time) : 999999;
            case 'bestPositionInClass':
                return driver.bestPositionInClass || 999;
            case 'bestPosition':
                return driver.bestPosition || 999;
            case 'alphabetical':
                return driver.name ? driver.name.toLowerCase() : 'zzz';
            case 'manual':
                return 0; // Manual tie-breaking will be handled on review screen
            default:
                return 0;
        }
    };
    
    // Helper function to apply cascading tie-breakers
    const applyCascadingTieBreakers = (driverA, driverB, tieBreakers) => {
        for (const tieBreaker of tieBreakers) {
            const valueA = evaluateTieBreaker(driverA, tieBreaker);
            const valueB = evaluateTieBreaker(driverB, tieBreaker);
            
            if (tieBreaker === 'alphabetical') {
                // For alphabetical, use string comparison
                if (valueA < valueB) return -1;
                if (valueA > valueB) return 1;
            } else {
                // For numeric values (times, positions), lower is better
                if (valueA < valueB) return -1;
                if (valueA > valueB) return 1;
            }
            // If values are equal, continue to next tie-breaker
        }
        return 0; // All tie-breakers are equal
    };
    
    // Helper function to detect ties in sorting criteria
    const detectTies = (entries, config) => {
        const tiedGroups = new Map();
        
        entries.forEach((entry, index) => {
            if (!entry.originalDriver) return;
            
            let primaryValue;
            switch (config.sortBy) {
                case 'pointsTotal':
                    primaryValue = entry.originalDriver.totalPoints;
                    break;
                case 'pointsAverage':
                    primaryValue = entry.originalDriver.averagePoints;
                    break;
                case 'bestTime':
                    primaryValue = entry.originalDriver.bestOverallTime ? parseTimeToSeconds(entry.originalDriver.bestOverallTime.time) : 999999;
                    break;
                case 'secondBest':
                    primaryValue = entry.originalDriver.secondBestOverallTime ? parseTimeToSeconds(entry.originalDriver.secondBestOverallTime.time) : 999999;
                    break;
                case 'position':
                    primaryValue = entry.originalDriver.files[0]?.position ? parseInt(entry.originalDriver.files[0].position) : 999;
                    break;
                default:
                    return;
            }
            
            const valueKey = primaryValue.toString();
            if (!tiedGroups.has(valueKey)) {
                tiedGroups.set(valueKey, []);
            }
            tiedGroups.get(valueKey).push(index);
        });
        
        // Filter out groups with only one entry (no ties)
        const tiedIndices = new Set();
        tiedGroups.forEach(group => {
            if (group.length > 1) {
                group.forEach(index => tiedIndices.add(index));
            }
        });
        
        return tiedIndices;
    };

    const buildGrid = () => {
        if (!parsedData || parsedData.length === 0) {
            setParseError('No valid CSV files have been uploaded. Please upload valid race data files.');
            setCurrentStep(1);
            return;
        }
        
        // Check for valid entries with classes in the new consolidated data structure
        const validDrivers = parsedData.filter(driver => driver.class && driver.class.trim() !== '');
        
        if (validDrivers.length === 0) {
            setParseError('No valid race entries found in the uploaded files. Please ensure your CSV files contain proper race data with Class, Driver, and Number columns.');
            setCurrentStep(1);
            return;
        }
        
        const grid = [];
        
        const numberVariations = ['No.', 'Number', 'CarNumber', 'Car', '#', 'Num'];
        const driverVariations = ['Name', 'Driver', 'DriverName', 'Pilot'];
        const positionVariations = ['Pos', 'Position', 'Finish', 'Place', 'P'];
        const bestTimeVariations = ['Best Tm', 'BestTime', 'Best Time', 'FastLap', 'Best', 'Time'];
        const secondTimeVariations = ['2nd Best', 'SecondBest', 'Second Best', 'Time2', '2nd'];
        const pointsVariations = ['Points', 'Pts', 'Score'];
        
        const parseTime = (timeStr) => {
            if (!timeStr || timeStr === '' || timeStr === 'DNF' || timeStr === 'DNS') return 999999;
            
            const cleanTime = timeStr.toString().trim();
            
            if (!isNaN(cleanTime)) return parseFloat(cleanTime);
            
            const parts = cleanTime.split(/[:.]/).filter(p => p);
            if (parts.length === 3) {
                const minutes = parseInt(parts[0]) || 0;
                const seconds = parseInt(parts[1]) || 0;
                const milliseconds = parseInt(parts[2].padEnd(3, '0').substring(0, 3)) || 0;
                return minutes * 60 + seconds + milliseconds / 1000;
            } else if (parts.length === 2) {
                const seconds = parseInt(parts[0]) || 0;
                const milliseconds = parseInt(parts[1].padEnd(3, '0').substring(0, 3)) || 0;
                return seconds + milliseconds / 1000;
            }
            
            return 999999;
        };
        
        waveConfigs.forEach(config => {
            // Get drivers for this wave based on assigned classes
            const waveDrivers = validDrivers.filter(driver => 
                config.classes.includes(driver.class)
            );
            
            // Convert to grid entry format
            const waveData = waveDrivers.map(driver => ({
                Class: driver.class,
                Number: driver.number || '',
                Driver: driver.name || '',
                BestTime: driver.bestOverallTime ? driver.bestOverallTime.time : '',
                SecondBest: driver.secondBestOverallTime ? driver.secondBestOverallTime.time : '',
                Points: driver.totalPoints || 0,
                source: driver.files.map(f => f.fileName).join(', '),
                originalDriver: driver
            }));
            
            // Sort drivers based on the sortBy configuration
            waveData.sort((a, b) => {
                const driverA = a.originalDriver;
                const driverB = b.originalDriver;
                
                switch (config.sortBy) {
                    case 'position':
                        // Only available for single file uploads
                        const posA = driverA.files[0]?.position ? parseInt(driverA.files[0].position) : 999;
                        const posB = driverB.files[0]?.position ? parseInt(driverB.files[0].position) : 999;
                        return posA - posB;
                        
                    case 'bestTime':
                        const timeA = driverA.bestOverallTime ? parseTimeToSeconds(driverA.bestOverallTime.time) : 999999;
                        const timeB = driverB.bestOverallTime ? parseTimeToSeconds(driverB.bestOverallTime.time) : 999999;
                        return timeA - timeB;
                        
                    case 'secondBest':
                        const secondA = driverA.secondBestOverallTime ? parseTimeToSeconds(driverA.secondBestOverallTime.time) : 999999;
                        const secondB = driverB.secondBestOverallTime ? parseTimeToSeconds(driverB.secondBestOverallTime.time) : 999999;
                        return secondA - secondB;
                        
                    case 'pointsTotal':
                        const totalPointsDiff = driverB.totalPoints - driverA.totalPoints; // Higher points first
                        if (totalPointsDiff !== 0) return totalPointsDiff;
                        // Apply tie-breakers if points are equal
                        return applyCascadingTieBreakers(driverA, driverB, [config.tieBreaker1, config.tieBreaker2, config.tieBreaker3]);
                        
                    case 'pointsAverage':
                        const avgPointsDiff = driverB.averagePoints - driverA.averagePoints; // Higher average first
                        if (avgPointsDiff !== 0) return avgPointsDiff;
                        // Apply tie-breakers if averages are equal
                        return applyCascadingTieBreakers(driverA, driverB, [config.tieBreaker1, config.tieBreaker2, config.tieBreaker3]);
                        
                    case 'bestSecondBest':
                        // Find the best second-best time across all files for each driver
                        const bestSecondA = driverA.allTimes.filter(t => t.type === 'second')
                            .sort((t1, t2) => parseTimeToSeconds(t1.time) - parseTimeToSeconds(t2.time))[0];
                        const bestSecondB = driverB.allTimes.filter(t => t.type === 'second')
                            .sort((t1, t2) => parseTimeToSeconds(t1.time) - parseTimeToSeconds(t2.time))[0];
                        
                        const bestSecondTimeA = bestSecondA ? parseTimeToSeconds(bestSecondA.time) : 999999;
                        const bestSecondTimeB = bestSecondB ? parseTimeToSeconds(bestSecondB.time) : 999999;
                        return bestSecondTimeA - bestSecondTimeB;
                        
                    default:
                        return 0;
                }
            });
            
            if (config.gridOrder === 'fastestFirst' || config.gridOrder === 'slowestFirst') {
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
            
            if (config.inverted) {
                if (config.invertAll) {
                    waveData.reverse();
                } else if (config.invertCount > 0) {
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
        setOriginalGrid(JSON.parse(JSON.stringify(grid)));
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
            
            newGrid[draggedItem.waveIndex].entries.splice(draggedItem.entryIndex, 1);
            newGrid[waveIndex].entries.splice(entryIndex, 0, draggedEntry);
            
            return newGrid;
        });
        
        setDraggedItem(null);
        setDraggedOver(null);
    };
    
    const startNewGrid = () => {
        setCurrentStep(1);
        setUploadedFiles([]);
        setParsedData([]);
        setWaveCount(1);
        setDefaultWaveSpacing(0);
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
            
            newGrid[waveIndex].entries.splice(entryIndex, 1);
            newGrid[waveIndex].entries.push(entry);
            
            return newGrid;
        });
    };
    
    const moveToEndOfClass = (waveIndex, entryIndex) => {
        setFinalGrid(prev => {
            const newGrid = [...prev];
            const entry = newGrid[waveIndex].entries[entryIndex];
            const entryClass = entry.Class;
            
            newGrid[waveIndex].entries.splice(entryIndex, 1);
            
            let insertIndex = newGrid[waveIndex].entries.length;
            for (let i = newGrid[waveIndex].entries.length - 1; i >= 0; i--) {
                if (newGrid[waveIndex].entries[i].Class === entryClass) {
                    insertIndex = i + 1;
                    break;
                }
            }
            
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
                newGrid[waveIndex] = JSON.parse(JSON.stringify(originalGrid[waveIndex]));
                return newGrid;
            });
        }
    };
    
    const combineWithPreviousWave = (waveIndex) => {
        if (waveIndex === 0) return;
        
        setFinalGrid(prev => {
            const newGrid = [...prev];
            const previousWave = newGrid[waveIndex - 1];
            const currentWave = newGrid[waveIndex];
            
            previousWave.entries.push(...currentWave.entries);
            newGrid.splice(waveIndex, 1);
            
            return newGrid;
        });
        
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
        const operationKey = `${waveIndex}-${className}-up`;
        
        if (isMovingRef.current === operationKey) {
            return;
        }
        
        if (isMovingRef.current) {
            return;
        }
        
        isMovingRef.current = operationKey;
        
        setFinalGrid(prev => {
            const newGrid = [...prev];
            const wave = { ...newGrid[waveIndex] };
            
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
            
            if (currentClassIndex <= 0) {
                isMovingRef.current = false;
                return newGrid;
            }
            
            const newClassOrder = [...classOrder];
            const temp = newClassOrder[currentClassIndex];
            newClassOrder[currentClassIndex] = newClassOrder[currentClassIndex - 1];
            newClassOrder[currentClassIndex - 1] = temp;
            
            const newEntries = [];
            newClassOrder.forEach(cls => {
                if (classMap.has(cls)) {
                    newEntries.push(...classMap.get(cls));
                }
            });
            
            wave.entries = newEntries;
            newGrid[waveIndex] = wave;
            
            setTimeout(() => {
                if (isMovingRef.current === operationKey) {
                    isMovingRef.current = false;
                }
            }, 200);
            
            return newGrid;
        });
    }, []);
    
    const moveClassDown = useCallback((waveIndex, className) => {
        const operationKey = `${waveIndex}-${className}-down`;
        
        if (isMovingRef.current === operationKey) {
            return;
        }
        
        if (isMovingRef.current) {
            return;
        }
        
        isMovingRef.current = operationKey;
        
        setFinalGrid(prev => {
            const newGrid = [...prev];
            const wave = { ...newGrid[waveIndex] };
            
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
            
            if (currentClassIndex >= classOrder.length - 1 || currentClassIndex === -1) {
                isMovingRef.current = false;
                return newGrid;
            }
            
            const newClassOrder = [...classOrder];
            const temp = newClassOrder[currentClassIndex];
            newClassOrder[currentClassIndex] = newClassOrder[currentClassIndex + 1];
            newClassOrder[currentClassIndex + 1] = temp;
            
            const newEntries = [];
            newClassOrder.forEach(cls => {
                if (classMap.has(cls)) {
                    newEntries.push(...classMap.get(cls));
                }
            });
            
            wave.entries = newEntries;
            newGrid[waveIndex] = wave;
            
            setTimeout(() => {
                if (isMovingRef.current === operationKey) {
                    isMovingRef.current = false;
                }
            }, 200);
            
            return newGrid;
        });
    }, []);
    
    const getClassOrder = (wave) => {
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
    
    const generatePDF = () => {
        const doc = new jsPDF();
        
        const generateWaveDescription = (config) => {
            const descriptions = [];
            
            const sortLabels = {
                'position': 'Finishing Position',
                'bestTime': 'Best Overall Time',
                'secondBest': 'Second Best Overall Time',
                'pointsTotal': 'Total Points',
                'pointsAverage': 'Average Points',
                'bestSecondBest': 'Best Second-Best Time',
                'points': 'Points' // Fallback for old format
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
            if (yPos > 245) {
                doc.addPage();
                yPos = 20;
            }
            
            doc.setFontSize(14);
            doc.setFont(undefined, 'bold');
            doc.text(`Wave ${wave.config.waveNumber} - ${wave.config.startType.toUpperCase()} Start`, 20, yPos);
            yPos += 6;
            
            doc.setFontSize(11);
            doc.setFont(undefined, 'bold');
            const colPositions = [20, 45, 70, 150];
            
            doc.text('Grid Pos', colPositions[0], yPos);
            doc.text('Car No', colPositions[1], yPos);
            doc.text('Driver', colPositions[2], yPos);
            doc.text('Time', colPositions[3], yPos);
            yPos += 8;
            
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            
            wave.entries.forEach((entry, idx) => {
                if (yPos > 270) {
                    doc.addPage();
                    yPos = 20;
                    
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
                
                doc.text(pos.toString(), colPositions[0], yPos);
                doc.text(num.toString(), colPositions[1], yPos);
                doc.text(driver, colPositions[2], yPos);
                doc.text(time, colPositions[3], yPos);
                yPos += 6;
            });
            
            if (wave.emptyPositions > 0 && waveIdx < finalGrid.length - 1) {
                doc.setFontSize(9);
                doc.setFont(undefined, 'italic');
                doc.text(`[${wave.emptyPositions} empty position${wave.emptyPositions > 1 ? 's' : ''}]`, 20, yPos);
                doc.setFont(undefined, 'normal');
                doc.setFontSize(10);
                yPos += 8;
            }
            
            currentPosition += wave.entries.length + (wave.emptyPositions || 0);
            yPos += 10;
        });
        
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
        
        const generateWaveDescription = (config) => {
            const descriptions = [];
            
            const sortLabels = {
                'position': 'Finishing Position',
                'bestTime': 'Best Overall Time',
                'secondBest': 'Second Best Overall Time',
                'pointsTotal': 'Total Points',
                'pointsAverage': 'Average Points',
                'bestSecondBest': 'Best Second-Best Time',
                'points': 'Points' // Fallback for old format
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
        
        if (gridName.trim()) {
            csvData.push([gridName.trim()]);
            csvData.push([]);
        }
        
        csvData.push(['Grid Position', 'Wave', 'Car Number', 'Driver', 'Class', 'Best Time']);
        
        finalGrid.forEach((wave, waveIdx) => {
            csvData.push([]);
            csvData.push([`WAVE ${wave.config.waveNumber} - ${wave.config.startType.toUpperCase()} START`]);
            if (wave.emptyPositions > 0 && waveIdx < finalGrid.length - 1) {
                csvData.push([`${wave.emptyPositions} empty position${wave.emptyPositions > 1 ? 's' : ''} after this wave`]);
            }
            csvData.push([]);
            
            wave.entries.forEach((entry, idx) => {
                const pos = currentPosition + idx;
                const waveNum = wave.config.waveNumber;
                const carNumber = entry.Number || '';
                const driver = entry.Driver || 'TBD';
                const driverClass = entry.Class || '';
                const time = entry.BestTime || '';
                
                csvData.push([pos, waveNum, carNumber, driver, driverClass, time]);
            });
            
            if (wave.emptyPositions > 0 && waveIdx < finalGrid.length - 1) {
                for (let i = 0; i < wave.emptyPositions; i++) {
                    const pos = currentPosition + wave.entries.length + i;
                    csvData.push([pos, wave.config.waveNumber, 'EMPTY', 'EMPTY POSITION', '', '']);
                }
            }
            
            currentPosition += wave.entries.length + (wave.emptyPositions || 0);
        });
        
        csvData.push([]);
        csvData.push([`Generated: ${new Date().toLocaleString()}`]);
        
        const csvContent = csvData.map(row => 
            row.map(field => `"${field}"`).join(',')
        ).join('\n');
        
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

    const getAssignedClasses = (excludeWaveIndex) => {
        const assigned = new Set();
        waveConfigs.forEach((wave, index) => {
            if (index !== excludeWaveIndex) {
                wave.classes.forEach(cls => assigned.add(cls));
            }
        });
        return assigned;
    };
    
    const assignAllClassesToWave = (waveIndex) => {
        const availableClasses = extractClasses().sort();
        const assignedToOtherWaves = getAssignedClasses(waveIndex);
        const unassignedClasses = availableClasses.filter(cls => !assignedToOtherWaves.has(cls));
        
        updateWaveConfig(waveIndex, 'classes', unassignedClasses);
    };
    
    // Analyze file for missing columns needed for sorting/grouping
    const analyzeFileColumns = (file) => {
        if (!file || !file.data || file.data.length === 0) return [];
        
        const warnings = [];
        const headers = Object.keys(file.data[0] || {});
        
        // Check for class column (required for grouping)
        const classVariations = ['Class', 'class', 'CLASS'];
        if (!classVariations.some(col => headers.includes(col))) {
            warnings.push('Class column missing - cannot group by class');
        }
        
        // Check for driver/name column (required)
        const driverVariations = ['Name', 'Driver', 'DriverName', 'Pilot'];
        if (!driverVariations.some(col => headers.includes(col))) {
            warnings.push('Driver/Name column missing');
        }
        
        // Check for number column (required)
        const numberVariations = ['No.', 'Number', 'CarNumber', 'Car', '#', 'Num'];
        if (!numberVariations.some(col => headers.includes(col))) {
            warnings.push('Car number column missing');
        }
        
        // Check for time columns (optional but affects sorting options)
        const bestTimeVariations = ['Best Tm', 'BestTime', 'Best Time', 'FastLap', 'Best', 'Time'];
        const hasTime = bestTimeVariations.some(col => headers.includes(col));
        
        const secondTimeVariations = ['2nd Best', 'SecondBest', 'Second Best', 'Time2', '2nd'];
        const hasSecondTime = secondTimeVariations.some(col => headers.includes(col));
        
        if (!hasTime && !file.fileName.toLowerCase().includes('laptimes')) {
            warnings.push('Best time column missing - time-based sorting unavailable');
        }
        
        // Check for position column (optional, single file only)
        const positionVariations = ['Pos', 'Position', 'Finish', 'Place', 'P'];
        const hasPosition = positionVariations.some(col => headers.includes(col));
        
        // Check for points column (optional)
        const pointsVariations = ['Points', 'Pts', 'Score'];
        const hasPoints = pointsVariations.some(col => headers.includes(col));
        const hasValidPoints = hasPoints && file.data.some(row => {
            const points = normalizeFieldName(row, pointsVariations);
            return parseFloat(points) > 0;
        });
        
        if (!hasValidPoints && headers.some(h => pointsVariations.includes(h))) {
            warnings.push('Points column exists but contains no valid data');
        }
        
        // Check for PIC column (optional but useful for tie-breaking)
        const picVariations = ['PIC', 'PositionInClass', 'ClassPosition'];
        const hasPIC = picVariations.some(col => headers.includes(col));
        
        return warnings;
    };
    
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
                    <div className="space-y-6">
                        <Accordion type="single" collapsible>
                            <AccordionItem 
                                value="tips" 
                                className="border-track-blue bg-blue-50 cursor-pointer"
                                onClick={() => setShowTips(!showTips)}
                            >
                                <AccordionTrigger 
                                    isOpen={showTips}
                                    className="text-track-blue hover:bg-blue-100 cursor-pointer"
                                >
                                    <h4 className="flex items-center gap-2 text-base font-semibold">
                                        <Info className="h-5 w-5" />
                                        MyLaps Orbits Export Tips
                                    </h4>
                                </AccordionTrigger>
                                <AccordionContent isOpen={showTips}>
                                    <div className="space-y-3 text-track-blue">
                                        <p className="font-semibold">Supported File Types:</p>
                                        <ul className="list-disc pl-5 space-y-1 mb-3">
                                            <li><strong>Results Files:</strong> Standard race results with finishing positions and times</li>
                                            <li><strong>Lap Times Files:</strong> Individual lap data exports (automatically extracts best times)</li>
                                        </ul>
                                        
                                        <p className="font-semibold">Recommended Columns for Results Files:</p>
                                        <ul className="list-disc pl-5 space-y-1">
                                            <li><strong>Essential:</strong> Driver/Name, Number, Class</li>
                                            <li><strong>For time sorting:</strong> Best Tm, 2nd Best</li>
                                            <li><strong>For points sorting:</strong> Points</li>
                                            <li><strong>For position sorting:</strong> Pos (finishing position)</li>
                                            <li><strong>For advanced tie-breaking:</strong> PIC (Position in Class)</li>
                                        </ul>
                                        <p className="text-sm italic opacity-80 mt-2">
                                            Configure your results view to include these columns before exporting to CSV for full functionality.
                                        </p>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                        
                        <div 
                            className="border-2 border-dashed border-gray-300 rounded-lg p-16 text-center cursor-pointer transition-colors hover:border-primary"
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onClick={() => fileInputRef.current.click()}
                        >
                            <Upload className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                            <h2 className="text-2xl font-semibold mb-2">Drop CSV files here or click to browse</h2>
                            <p className="text-gray-600">Upload your race results files (CSV format)</p>
                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                accept=".csv"
                                className="hidden"
                                onChange={(e) => handleFileUpload(e.target.files)}
                            />
                        </div>
                        
                        {parseError && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>Error</AlertTitle>
                                <AlertDescription>
                                    {parseError}
                                    <p className="mt-2 text-sm">
                                        Please remove the problematic file and upload a valid CSV file with race data.
                                    </p>
                                </AlertDescription>
                            </Alert>
                        )}
                        
                        {uploadedFiles.length > 0 && (
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between">
                                    <CardTitle>Uploaded Files</CardTitle>
                                    <Button 
                                        variant="destructive"
                                        size="sm"
                                        onClick={removeAllFiles}
                                    >
                                        Remove All
                                    </Button>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2">
                                        {uploadedFiles.map((file, idx) => {
                                            const warnings = fileWarnings.get(file.name) || [];
                                            return (
                                                <div key={idx} className="space-y-2">
                                                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                                        <div className="flex-1">
                                                            <span className="font-medium">{file.name}</span>
                                                            {warnings.length > 0 && (
                                                                <div className="mt-2 space-y-1">
                                                                    {warnings.map((warning, wIdx) => (
                                                                        <div key={wIdx} className="flex items-start gap-2 text-sm text-yellow-600">
                                                                            <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                                                            <span>{warning}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <Button 
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => removeFile(idx)}
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                        
                        <div className="flex justify-center">
                            <Button 
                                size="lg"
                                onClick={() => setCurrentStep(2)}
                                disabled={uploadedFiles.length === 0 || parseError || !hasValidData}
                            >
                                Next Step
                                <ChevronRight className="ml-2 h-5 w-5" />
                            </Button>
                        </div>
                    </div>
                );
                
            case 2:
                return (
                    <div className="max-w-md mx-auto space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Configure Wave Structure</CardTitle>
                                <CardDescription>
                                    Choose how many starting groups you need and configure spacing between waves
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div>
                                        <Label htmlFor="wave-count">Number of Waves</Label>
                                        <Input
                                            id="wave-count"
                                            type="number"
                                            min="1"
                                            max="10"
                                            value={waveCount}
                                            onChange={(e) => setWaveCount(parseInt(e.target.value) || 1)}
                                            className="w-32"
                                        />
                                    </div>
                                    {waveCount > 1 && (
                                        <div>
                                            <Label htmlFor="wave-spacing">Default Spaces Between Waves</Label>
                                            <Input
                                                id="wave-spacing"
                                                type="number"
                                                min="0"
                                                max="10"
                                                value={defaultWaveSpacing}
                                                onChange={(e) => setDefaultWaveSpacing(parseInt(e.target.value) || 0)}
                                                className="w-32"
                                            />
                                            <p className="text-sm text-gray-600 mt-1">
                                                Empty grid positions to leave between waves (can be customized per wave later)
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                        
                        <div className="flex justify-center gap-4">
                            <Button 
                                variant="outline"
                                size="lg"
                                onClick={() => setCurrentStep(1)}
                            >
                                <ChevronLeft className="mr-2 h-5 w-5" />
                                Back
                            </Button>
                            <Button 
                                size="lg"
                                onClick={() => {
                                    initializeWaveConfigs();
                                    setCurrentStep(3);
                                }}
                            >
                                Configure Waves
                                <ChevronRight className="ml-2 h-5 w-5" />
                            </Button>
                        </div>
                    </div>
                );
                
            case 3:
                const availableClasses = extractClasses().sort();
                const carCounts = getCarCountsByClass();
                
                return (
                    <div className="space-y-6">
                        <h2 className="text-2xl font-semibold text-center mb-6">Configure Each Wave</h2>
                        {waveConfigs.map((config, idx) => {
                            const assignedToOtherWaves = getAssignedClasses(idx);
                            
                            return (
                                <Card key={idx}>
                                    <CardHeader className="bg-gradient-to-r from-primary to-primary-dark text-white rounded-t-lg">
                                        <CardTitle>Wave {config.waveNumber}</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-6 pt-6">
                                        <div>
                                            <Label>Start Type</Label>
                                            <div className="flex gap-6 mt-2">
                                                <div className="flex items-center">
                                                    <input
                                                        type="radio"
                                                        name={`start-type-${idx}`}
                                                        value="flying"
                                                        id={`flying-${idx}`}
                                                        checked={config.startType === 'flying'}
                                                        disabled={idx > 0 && waveConfigs[idx-1].startType === 'standing'}
                                                        className="h-4 w-4 text-primary focus:ring-primary border-gray-300"
                                                        onChange={(e) => updateWaveConfig(idx, 'startType', e.target.value)}
                                                    />
                                                    <Label htmlFor={`flying-${idx}`} className="ml-2 cursor-pointer">
                                                        Flying Start
                                                    </Label>
                                                </div>
                                                <div className="flex items-center">
                                                    <input
                                                        type="radio"
                                                        name={`start-type-${idx}`}
                                                        value="standing"
                                                        id={`standing-${idx}`}
                                                        checked={config.startType === 'standing'}
                                                        className="h-4 w-4 text-primary focus:ring-primary border-gray-300"
                                                        onChange={(e) => updateWaveConfig(idx, 'startType', e.target.value)}
                                                    />
                                                    <Label htmlFor={`standing-${idx}`} className="ml-2 cursor-pointer">
                                                        Standing Start
                                                    </Label>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <Label>Assign Classes</Label>
                                                {(() => {
                                                    const availableClassesForWave = availableClasses.filter(cls => !assignedToOtherWaves.has(cls));
                                                    return availableClassesForWave.length > config.classes.length && (
                                                        <Button
                                                            size="sm"
                                                            variant="secondary"
                                                            onClick={() => assignAllClassesToWave(idx)}
                                                        >
                                                            Assign All Classes
                                                        </Button>
                                                    );
                                                })()}
                                            </div>
                                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                                {availableClasses.map(cls => {
                                                    const isAssignedElsewhere = assignedToOtherWaves.has(cls);
                                                    return (
                                                        <div 
                                                            key={cls} 
                                                            className={cn(
                                                                "flex items-center space-x-2",
                                                                isAssignedElsewhere && "opacity-50"
                                                            )}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                id={`class-${idx}-${cls}`}
                                                                checked={config.classes.includes(cls)}
                                                                disabled={isAssignedElsewhere}
                                                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                                                onChange={(e) => {
                                                                    if (e.target.checked) {
                                                                        updateWaveConfig(idx, 'classes', [...config.classes, cls]);
                                                                    } else {
                                                                        updateWaveConfig(idx, 'classes', config.classes.filter(c => c !== cls));
                                                                    }
                                                                }}
                                                            />
                                                            <Label 
                                                                htmlFor={`class-${idx}-${cls}`}
                                                                className="cursor-pointer flex items-center gap-2"
                                                                title={isAssignedElsewhere ? `Already assigned to another wave` : ''}
                                                            >
                                                                <span>{cls}</span>
                                                                <Badge 
                                                                    variant="secondary"
                                                                    className="bg-track-blue text-white text-xs px-2 py-0.5"
                                                                    style={{
                                                                        backgroundColor: '#4B7BFF',
                                                                        color: 'white'
                                                                    }}
                                                                >
                                                                    {carCounts.get(cls) || 0}
                                                                </Badge>
                                                            </Label>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    
                                    <div>
                                        <Label htmlFor={`sort-${idx}`}>Sort By</Label>
                                        <Select 
                                            id={`sort-${idx}`}
                                            value={config.sortBy}
                                            onChange={(e) => updateWaveConfig(idx, 'sortBy', e.target.value)}
                                        >
                                            {/* Position Sorting (Single File Only) */}
                                            {(!hasMultipleFiles() && hasPositionData()) && (
                                                <option value="position">Finishing Position</option>
                                            )}
                                            
                                            {/* Time-Based Sorting */}
                                            <option value="bestTime">Best Overall Time</option>
                                            {hasSecondBestTimes() && (
                                                <option value="secondBest">Second Best Overall Time</option>
                                            )}
                                            {hasSecondBestTimes() && (
                                                <option value="bestSecondBest">Best Second-Best Time</option>
                                            )}
                                            
                                            {/* Points-Based Sorting */}
                                            {hasValidPoints() && (
                                                <option value="pointsTotal">Total Points</option>
                                            )}
                                            {hasValidPoints() && hasMultipleFiles() && (
                                                <option value="pointsAverage">Average Points</option>
                                            )}
                                        </Select>
                                    </div>
                                    
                                    <div>
                                        <Label htmlFor={`order-${idx}`}>Group By</Label>
                                        <Select 
                                            id={`order-${idx}`}
                                            value={config.gridOrder}
                                            onChange={(e) => updateWaveConfig(idx, 'gridOrder', e.target.value)}
                                        >
                                            <option value="straight">None - Straight Up</option>
                                            <option value="fastestFirst">Class - Fastest First</option>
                                            <option value="slowestFirst">Class - Slowest First</option>
                                        </Select>
                                    </div>
                                    
                                    {/* Tie-Breaking Options - Only show for points-based sorting */}
                                    {(config.sortBy === 'pointsTotal' || config.sortBy === 'pointsAverage') && (
                                        <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
                                            <Label className="text-sm font-semibold text-gray-700">Tie-Breaking Options</Label>
                                            
                                            <div>
                                                <Label htmlFor={`tie1-${idx}`} className="text-sm">1st Tie-Breaker</Label>
                                                <Select 
                                                    id={`tie1-${idx}`}
                                                    value={config.tieBreaker1}
                                                    onChange={(e) => updateWaveConfig(idx, 'tieBreaker1', e.target.value)}
                                                >
                                                    <option value="bestTime">Best Overall Time</option>
                                                    {hasSecondBestTimes() && (
                                                        <option value="secondBest">Second Best Overall Time</option>
                                                    )}
                                                    <option value="bestPositionInClass">Best Position in Class</option>
                                                    <option value="bestPosition">Best Overall Position</option>
                                                    <option value="alphabetical">Alphabetical by Name</option>
                                                    <option value="manual">Manual</option>
                                                </Select>
                                            </div>
                                            
                                            <div>
                                                <Label htmlFor={`tie2-${idx}`} className="text-sm">2nd Tie-Breaker</Label>
                                                <Select 
                                                    id={`tie2-${idx}`}
                                                    value={config.tieBreaker2}
                                                    onChange={(e) => updateWaveConfig(idx, 'tieBreaker2', e.target.value)}
                                                >
                                                    <option value="bestTime">Best Overall Time</option>
                                                    {hasSecondBestTimes() && (
                                                        <option value="secondBest">Second Best Overall Time</option>
                                                    )}
                                                    <option value="bestPositionInClass">Best Position in Class</option>
                                                    <option value="bestPosition">Best Overall Position</option>
                                                    <option value="alphabetical">Alphabetical by Name</option>
                                                    <option value="manual">Manual</option>
                                                </Select>
                                            </div>
                                            
                                            <div>
                                                <Label htmlFor={`tie3-${idx}`} className="text-sm">3rd Tie-Breaker</Label>
                                                <Select 
                                                    id={`tie3-${idx}`}
                                                    value={config.tieBreaker3}
                                                    onChange={(e) => updateWaveConfig(idx, 'tieBreaker3', e.target.value)}
                                                >
                                                    <option value="bestTime">Best Overall Time</option>
                                                    {hasSecondBestTimes() && (
                                                        <option value="secondBest">Second Best Overall Time</option>
                                                    )}
                                                    <option value="bestPositionInClass">Best Position in Class</option>
                                                    <option value="bestPosition">Best Overall Position</option>
                                                    <option value="alphabetical">Alphabetical by Name</option>
                                                    <option value="manual">Manual</option>
                                                </Select>
                                            </div>
                                        </div>
                                    )}
                                    
                                    <div className="space-y-4">
                                        <div className="flex items-center space-x-2">
                                            <input
                                                type="checkbox"
                                                id={`invert-${idx}`}
                                                checked={config.inverted}
                                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                                onChange={(e) => updateWaveConfig(idx, 'inverted', e.target.checked)}
                                            />
                                            <Label htmlFor={`invert-${idx}`} className="cursor-pointer">
                                                Invert Grid
                                            </Label>
                                        </div>
                                        {config.inverted && (
                                            <div className="ml-6 space-y-3">
                                                <div className="space-y-2">
                                                    <div className="flex items-center space-x-2">
                                                        <input
                                                            type="radio"
                                                            name={`invert-type-${idx}`}
                                                            value="all"
                                                            id={`invert-all-${idx}`}
                                                            checked={config.invertAll}
                                                            className="h-4 w-4 text-primary focus:ring-primary border-gray-300"
                                                            onChange={() => updateWaveConfig(idx, 'invertAll', true)}
                                                        />
                                                        <Label htmlFor={`invert-all-${idx}`} className="cursor-pointer">
                                                            Invert All
                                                        </Label>
                                                    </div>
                                                    <div className="flex items-center space-x-2">
                                                        <input
                                                            type="radio"
                                                            name={`invert-type-${idx}`}
                                                            value="specific"
                                                            id={`invert-specific-${idx}`}
                                                            checked={!config.invertAll}
                                                            className="h-4 w-4 text-primary focus:ring-primary border-gray-300"
                                                            onChange={() => updateWaveConfig(idx, 'invertAll', false)}
                                                        />
                                                        <Label htmlFor={`invert-specific-${idx}`} className="cursor-pointer">
                                                            Invert Specific Count
                                                        </Label>
                                                    </div>
                                                </div>
                                                {!config.invertAll && (
                                                    <div>
                                                        <Label htmlFor={`invert-count-${idx}`}>
                                                            Number of positions to invert
                                                        </Label>
                                                        <Input
                                                            id={`invert-count-${idx}`}
                                                            type="number"
                                                            min="2"
                                                            max={Math.max(2, getCarCountInWave(config))}
                                                            value={config.invertCount}
                                                            onChange={(e) => updateWaveConfig(idx, 'invertCount', parseInt(e.target.value) || 2)}
                                                            className="w-32"
                                                        />
                                                        <p className="text-sm text-gray-600 mt-1">
                                                            Max: {getCarCountInWave(config)} cars in this wave
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    
                                    {idx < waveConfigs.length - 1 && (
                                        <div>
                                            <Label htmlFor={`empty-${idx}`}>
                                                Empty positions after this wave
                                            </Label>
                                            <Input
                                                id={`empty-${idx}`}
                                                type="number"
                                                min="0"
                                                max="10"
                                                value={config.emptyPositions}
                                                onChange={(e) => updateWaveConfig(idx, 'emptyPositions', parseInt(e.target.value) || 0)}
                                                className="w-32"
                                            />
                                        </div>
                                    )}
                                    </CardContent>
                                </Card>
                            );
                        })}
                        
                        <div className="flex justify-center gap-4">
                            <Button 
                                variant="outline"
                                size="lg"
                                onClick={() => setCurrentStep(2)}
                            >
                                <ChevronLeft className="mr-2 h-5 w-5" />
                                Back
                            </Button>
                            <Button 
                                size="lg"
                                onClick={() => {
                                    buildGrid();
                                    setCurrentStep(4);
                                }}
                            >
                                Preview Grid
                                <ChevronRight className="ml-2 h-5 w-5" />
                            </Button>
                        </div>
                    </div>
                );
                
            case 4:
                return (
                    <div className="space-y-6">
                        <div className="text-center">
                            <h2 className="text-2xl font-semibold mb-2">Review and Adjust Starting Grid</h2>
                            <p className="text-gray-600">Drag and drop entries to manually adjust positions</p>
                        </div>
                        
                        <div className="space-y-6">
                            {(() => {
                                let currentPosition = 1;
                                
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
                                
                                return finalGrid.map((wave, waveIdx) => {
                                    const waveEntries = wave.entries.map((entry, entryIdx) => ({
                                        ...entry,
                                        gridPosition: currentPosition + entryIdx
                                    }));
                                    currentPosition += wave.entries.length + (wave.emptyPositions || 0);
                                    
                                    return (
                                        <Card key={waveIdx} className="overflow-hidden">
                                            <CardHeader className="bg-gradient-to-r from-primary to-primary-dark text-white">
                                                <div className="flex justify-between items-center">
                                                    <span className="font-semibold">
                                                        Wave {waveIdx + 1} - {wave.config.startType.toUpperCase()} Start
                                                        {wave.emptyPositions > 0 && ` (${wave.emptyPositions} empty position${wave.emptyPositions > 1 ? 's' : ''} after)`}
                                                    </span>
                                                    <div className="flex gap-2">
                                                        {waveIdx > 0 && (
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="text-white hover:bg-white/20"
                                                                onClick={() => combineWithPreviousWave(waveIdx)}
                                                                title="Combine with previous wave"
                                                            >
                                                                <Merge className="h-4 w-4" style={{color: '#1A1A1A'}} />
                                                            </Button>
                                                        )}
                                                        {isWaveModified(waveIdx) && (
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="text-white hover:bg-white/20"
                                                                onClick={() => resetWave(waveIdx)}
                                                                title="Reset wave to original order"
                                                            >
                                                                <RefreshCw className="h-4 w-4" style={{color: '#1A1A1A'}} />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            </CardHeader>
                                            <div className="bg-gray-50 px-6 py-3 text-sm text-gray-600 italic border-b">
                                                {generateWaveDescription(wave.config)}
                                            </div>
                                            <CardContent className="p-0">
                                                {(() => {
                                                    if (wave.config.gridOrder === 'fastestFirst' || wave.config.gridOrder === 'slowestFirst') {
                                                        const classOrder = getClassOrder(wave);
                                                        const result = [];
                                                        
                                                        classOrder.forEach((className, classIdx) => {
                                                            const classEntries = waveEntries.filter(entry => entry.Class === className);
                                                            
                                                            result.push(
                                                                <div key={`class-header-${className}`} className="bg-blue-50 px-4 py-2 border-b flex items-center gap-3">
                                                                    {classIdx > 0 && (
                                                                        <Button
                                                                            size="icon"
                                                                            variant="ghost"
                                                                            className="h-6 w-6"
                                                                            onClick={(e) => {
                                                                                e.preventDefault();
                                                                                e.stopPropagation();
                                                                                moveClassUp(waveIdx, className);
                                                                            }}
                                                                            title="Move class up"
                                                                        >
                                                                            <ChevronUp className="h-4 w-4 text-track-blue" />
                                                                        </Button>
                                                                    )}
                                                                    <span className="font-semibold text-track-blue">{className}</span>
                                                                    {classIdx < classOrder.length - 1 && (
                                                                        <Button
                                                                            size="icon"
                                                                            variant="ghost"
                                                                            className="h-6 w-6"
                                                                            onClick={(e) => {
                                                                                e.preventDefault();
                                                                                e.stopPropagation();
                                                                                moveClassDown(waveIdx, className);
                                                                            }}
                                                                            title="Move class down"
                                                                        >
                                                                            <ChevronDown className="h-4 w-4 text-track-blue" />
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            );
                                                            
                                                            // Detect ties within this class
                                                            const classTies = detectTies(classEntries, wave.config);
                                                            
                                                            classEntries.forEach((entry, entryIdx) => {
                                                                const originalEntryIdx = waveEntries.indexOf(entry);
                                                                const isTied = classTies.has(entryIdx);
                                                                
                                                                result.push(
                                                                    <div 
                                                                        key={`entry-${originalEntryIdx}`}
                                                                        className={cn(
                                                                            "flex items-center px-4 py-3 border-b hover:bg-gray-50 cursor-move",
                                                                            draggedOver?.waveIndex === waveIdx && draggedOver?.entryIndex === originalEntryIdx && "bg-blue-100"
                                                                        )}
                                                                        draggable
                                                                        onDragStart={(e) => handleGridDragStart(e, waveIdx, originalEntryIdx)}
                                                                        onDragOver={(e) => handleGridDragOver(e, waveIdx, originalEntryIdx)}
                                                                        onDrop={(e) => handleGridDrop(e, waveIdx, originalEntryIdx)}
                                                                    >
                                                                        <MoveVertical className="h-4 w-4 text-gray-400 mr-3" />
                                                                        <div className="w-16 font-bold text-primary flex items-center gap-2">
                                                                            {entry.gridPosition}
                                                                            {isTied && (
                                                                                <span 
                                                                                    className="w-2 h-2 rounded-full bg-yellow-500" 
                                                                                    title="Tied on primary sorting criteria"
                                                                                />
                                                                            )}
                                                                        </div>
                                                                        <div className="flex-1">
                                                                            {/* Main driver info row */}
                                                                            <div className="flex items-center gap-4 mb-1">
                                                                                <Badge variant="outline" className="bg-carbon-black text-white">
                                                                                    {entry.Number || '?'}
                                                                                </Badge>
                                                                                <span className="font-medium">{entry.Driver || 'Unknown Driver'}</span>
                                                                                <Badge variant="secondary">{entry.Class || 'N/A'}</Badge>
                                                                                <span className="text-gray-600 font-mono text-sm">{entry.BestTime || '--:--'}</span>
                                                                            </div>
                                                                            
                                                                            {/* Detailed statistics row */}
                                                                            {entry.originalDriver && (
                                                                                <div className="flex items-center gap-6 text-xs text-gray-500 ml-16">
                                                                                    {entry.originalDriver.secondBestOverallTime && (
                                                                                        <span className="font-mono">
                                                                                            2nd Best: {entry.originalDriver.secondBestOverallTime.time}
                                                                                        </span>
                                                                                    )}
                                                                                    {entry.originalDriver.totalPoints > 0 && (
                                                                                        <span>
                                                                                            Total Pts: {entry.originalDriver.totalPoints}
                                                                                        </span>
                                                                                    )}
                                                                                    {entry.originalDriver.averagePoints > 0 && (
                                                                                        <span>
                                                                                            Avg Pts: {entry.originalDriver.averagePoints.toFixed(1)}
                                                                                        </span>
                                                                                    )}
                                                                                    {entry.originalDriver.bestPositionInClass && (
                                                                                        <span>
                                                                                            Best PIC: {entry.originalDriver.bestPositionInClass}
                                                                                        </span>
                                                                                    )}
                                                                                    {entry.originalDriver.averagePositionInClass && (
                                                                                        <span>
                                                                                            Avg PIC: {entry.originalDriver.averagePositionInClass}
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        <div className="flex gap-2">
                                                                            <Button
                                                                                size="icon"
                                                                                variant="ghost"
                                                                                className="h-8 w-8"
                                                                                onClick={() => moveToEndOfClass(waveIdx, originalEntryIdx)}
                                                                                title="Move to end of class"
                                                                            >
                                                                                <img src={minus1Icon} alt="End of class" className="h-4 w-4" />
                                                                            </Button>
                                                                            <Button
                                                                                size="icon"
                                                                                variant="ghost"
                                                                                className="h-8 w-8"
                                                                                onClick={() => moveToEndOfWave(waveIdx, originalEntryIdx)}
                                                                                title="Move to end of wave"
                                                                            >
                                                                                <img src={minus3Icon} alt="End of wave" className="h-4 w-4" />
                                                                            </Button>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            });
                                                        });
                                                        
                                                        return result;
                                                    } else {
                                                        // Detect ties for straight-up ordering
                                                        const straightTies = detectTies(waveEntries, wave.config);
                                                        
                                                        return waveEntries.map((entry, entryIdx) => {
                                                            const isTied = straightTies.has(entryIdx);
                                                            return (
                                                            <div 
                                                                key={entryIdx} 
                                                                className={cn(
                                                                    "flex items-center px-4 py-3 border-b hover:bg-gray-50 cursor-move",
                                                                    draggedOver?.waveIndex === waveIdx && draggedOver?.entryIndex === entryIdx && "bg-blue-100"
                                                                )}
                                                                draggable
                                                                onDragStart={(e) => handleGridDragStart(e, waveIdx, entryIdx)}
                                                                onDragOver={(e) => handleGridDragOver(e, waveIdx, entryIdx)}
                                                                onDrop={(e) => handleGridDrop(e, waveIdx, entryIdx)}
                                                            >
                                                                <MoveVertical className="h-4 w-4 text-gray-400 mr-3" />
                                                                <div className="w-16 font-bold text-primary flex items-center gap-2">
                                                                    {entry.gridPosition}
                                                                    {isTied && (
                                                                        <span 
                                                                            className="w-2 h-2 rounded-full bg-yellow-500" 
                                                                            title="Tied on primary sorting criteria"
                                                                        />
                                                                    )}
                                                                </div>
                                                                <div className="flex-1">
                                                                    {/* Main driver info row */}
                                                                    <div className="flex items-center gap-4 mb-1">
                                                                        <Badge variant="outline" className="bg-carbon-black text-white">
                                                                            {entry.Number || '?'}
                                                                        </Badge>
                                                                        <span className="font-medium">{entry.Driver || 'Unknown Driver'}</span>
                                                                        <Badge variant="secondary">{entry.Class || 'N/A'}</Badge>
                                                                        <span className="text-gray-600 font-mono text-sm">{entry.BestTime || '--:--'}</span>
                                                                    </div>
                                                                    
                                                                    {/* Detailed statistics row */}
                                                                    {entry.originalDriver && (
                                                                        <div className="flex items-center gap-6 text-xs text-gray-500 ml-16">
                                                                            {entry.originalDriver.secondBestOverallTime && (
                                                                                <span className="font-mono">
                                                                                    2nd Best: {entry.originalDriver.secondBestOverallTime.time}
                                                                                </span>
                                                                            )}
                                                                            {entry.originalDriver.totalPoints > 0 && (
                                                                                <span>
                                                                                    Total Pts: {entry.originalDriver.totalPoints}
                                                                                </span>
                                                                            )}
                                                                            {entry.originalDriver.averagePoints > 0 && (
                                                                                <span>
                                                                                    Avg Pts: {entry.originalDriver.averagePoints.toFixed(1)}
                                                                                </span>
                                                                            )}
                                                                            {entry.originalDriver.bestPositionInClass && (
                                                                                <span>
                                                                                    Best PIC: {entry.originalDriver.bestPositionInClass}
                                                                                </span>
                                                                            )}
                                                                            {entry.originalDriver.averagePositionInClass && (
                                                                                <span>
                                                                                    Avg PIC: {entry.originalDriver.averagePositionInClass}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <Button
                                                                    size="icon"
                                                                    variant="ghost"
                                                                    className="h-8 w-8"
                                                                    onClick={() => moveToEndOfWave(waveIdx, entryIdx)}
                                                                    title="Move to end of wave"
                                                                >
                                                                    <img src={minus3Icon} alt="End of wave" className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                            );
                                                        });
                                                    }
                                                })()}
                                                {wave.emptyPositions > 0 && waveIdx < finalGrid.length - 1 && (
                                                    <div className="text-center py-3 text-gray-500 italic bg-gray-50">
                                                        {wave.emptyPositions} empty position{wave.emptyPositions > 1 ? 's' : ''}
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    );
                                });
                            })()}
                        </div>
                        
                        <div className="flex justify-center gap-4">
                            <Button 
                                variant="outline"
                                size="lg"
                                onClick={() => setCurrentStep(3)}
                            >
                                <ChevronLeft className="mr-2 h-5 w-5" />
                                Back
                            </Button>
                            <Button 
                                size="lg"
                                onClick={() => setCurrentStep(5)}
                            >
                                Finalize Grid
                                <ChevronRight className="ml-2 h-5 w-5" />
                            </Button>
                        </div>
                    </div>
                );
                
            case 5:
                return (
                    <div className="max-w-lg mx-auto space-y-6 text-center">
                        <h2 className="text-2xl font-semibold">Export Grid</h2>
                        <p className="text-lg text-gray-600">Your starting grid is ready for export!</p>
                        
                        <Card className="bg-gradient-to-br from-racing-red to-racing-red-dark text-white">
                            <CardContent className="pt-10 pb-10">
                                <File className="h-16 w-16 mx-auto mb-4 text-white" />
                                <h3 className="text-xl font-semibold mb-2">Grid Summary</h3>
                                <p>Total Waves: {finalGrid.length}</p>
                                <p>Total Entries: {finalGrid.reduce((sum, wave) => sum + wave.entries.length, 0)}</p>
                            </CardContent>
                        </Card>
                        
                        <div>
                            <Label htmlFor="grid-name">Grid Name</Label>
                            <Input
                                id="grid-name"
                                type="text"
                                placeholder="Enter grid name (e.g., 'Spring Championship Race 1')"
                                value={gridName}
                                onChange={(e) => setGridName(e.target.value)}
                                className="text-center"
                            />
                        </div>
                        
                        <div className="flex flex-col gap-3">
                            <Button 
                                size="lg"
                                className="bg-grid-green hover:bg-grid-green/90"
                                onClick={generatePDF}
                            >
                                <Download className="mr-2 h-5 w-5" />
                                Download PDF
                            </Button>
                            <Button 
                                size="lg"
                                variant="secondary"
                                onClick={generateCSV}
                            >
                                <FileText className="mr-2 h-5 w-5" />
                                Download CSV
                            </Button>
                            <Button 
                                size="lg"
                                variant="outline"
                                onClick={startNewGrid}
                            >
                                <RefreshCw className="mr-2 h-5 w-5" />
                                New Grid
                            </Button>
                            <Button 
                                variant="ghost"
                                onClick={() => setCurrentStep(4)}
                            >
                                <ChevronLeft className="mr-2 h-5 w-5" />
                                Back to Review
                            </Button>
                        </div>
                    </div>
                );
                
                
            default:
                return null;
        }
    };
    
    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-600 via-purple-700 to-purple-800 p-4 md:p-8">
            <div className="max-w-7xl mx-auto bg-white/95 backdrop-blur rounded-3xl shadow-2xl overflow-hidden">
                <header className="bg-gradient-to-r from-purple-600 to-purple-800 text-white p-8 text-center relative">
                    <div className="flex items-center justify-center mb-4">
                        <img src={racingFlag} alt="Racing flag" className="h-10 w-10 mr-3 filter brightness-0 invert" />
                        <h1 className="text-4xl font-bold">Grid Builder</h1>
                    </div>
                    <p className="text-lg opacity-90">Create professional starting grids for your racing events</p>
                    <p className="text-sm mt-3 opacity-75">
                        Provided by My Race Day - Building your comprehensive solution for professional motorsport event operations
                    </p>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="absolute top-4 right-4 text-white hover:bg-white/20"
                        onClick={() => setShowHelpModal(true)}
                    >
                        <HelpCircle className="h-5 w-5 mr-2" />
                        Help
                    </Button>
                </header>
                
                <nav className="flex items-center justify-between p-4 bg-gray-50 border-b overflow-x-auto">
                    {steps.map((step) => {
                        const Icon = step.icon;
                        return (
                            <button
                                key={step.num}
                                className={cn(
                                    "flex flex-col items-center min-w-[100px] p-3 rounded-lg transition-all",
                                    currentStep === step.num && "bg-primary text-white",
                                    currentStep > step.num && "bg-grid-green text-white",
                                    currentStep < step.num && "text-gray-400",
                                    step.num <= currentStep && "cursor-pointer hover:opacity-80"
                                )}
                                onClick={() => {
                                    if (step.num <= currentStep) {
                                        setCurrentStep(step.num);
                                    }
                                }}
                                disabled={step.num > currentStep}
                                title={step.num <= currentStep ? `Go to ${step.label}` : `Complete previous steps first`}
                            >
                                <Icon className="h-6 w-6 mb-1" />
                                <span className="text-xs font-medium">{step.label}</span>
                            </button>
                        );
                    })}
                </nav>
                
                <main className="p-8">
                    {renderStep()}
                </main>

                {/* Help Modal */}
                <Dialog open={showHelpModal} onOpenChange={setShowHelpModal}>
                    <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-semibold text-center">Grid Builder Help</DialogTitle>
                            <DialogDescription className="text-center">
                                Learn how to create professional starting grids for your racing events
                            </DialogDescription>
                        </DialogHeader>
                        
                        <div className="space-y-6">
                            <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-track-blue">
                                <CardHeader>
                                    <CardTitle className="text-track-blue">Overview</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-lg leading-relaxed">
                                        Grid Builder helps race organizers create professional starting grids for racing events. 
                                        Upload CSV race data, configure multiple waves with different start types, and export grids as PDF or CSV files.
                                    </p>
                                </CardContent>
                            </Card>

                            <div className="grid md:grid-cols-2 gap-4">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Upload className="h-5 w-5 text-track-blue" />
                                            Step 1: Upload Files
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="mb-3">Import race data from CSV exports of Lap Times or Results files. The system automatically detects file types and consolidates data across multiple runs.</p>
                                        <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600">
                                            <li>Drag & drop or click to upload CSV files</li>
                                            <li>Supports both Results and Lap Times exports</li>
                                            <li>Multiple files automatically consolidated</li>
                                            <li>Column warnings help identify missing data</li>
                                        </ul>
                                        <p className="mt-3 text-sm font-medium">For best results, include these columns:</p>
                                        <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600">
                                            <li>Driver/Name, Number, Class (required)</li>
                                            <li>Best Tm, 2nd Best (for time sorting)</li>
                                            <li>Points (for points-based sorting)</li>
                                            <li>Pos, PIC (for position sorting & tie-breaking)</li>
                                        </ul>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Flag className="h-5 w-5 text-track-blue" />
                                            Step 2: Set Waves
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="mb-3">Choose how many starting groups you need (1-10 waves). More waves create smaller, more competitive groups.</p>
                                        <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600">
                                            <li>Slider or input selection</li>
                                            <li>Optional wave spacing (empty positions)</li>
                                            <li>Consider track capacity</li>
                                            <li>Balance competition levels</li>
                                        </ul>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Settings className="h-5 w-5 text-track-blue" />
                                            Step 3: Configure
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="mb-3">Set up each wave's start type, assign classes, choose sorting criteria, and configure grid order options.</p>
                                        <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600">
                                            <li>Flying vs Standing starts</li>
                                            <li>Class assignments with "Assign All" option</li>
                                            <li>Dynamic sorting: position, time, points</li>
                                            <li>Advanced tie-breaking for points sorting</li>
                                            <li>Group by class options</li>
                                            <li>Inversion options</li>
                                        </ul>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Eye className="h-5 w-5 text-track-blue" />
                                            Step 4: Review
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="mb-3">Fine-tune your grid with manual adjustments. View enhanced driver statistics and identify tied positions.</p>
                                        <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600">
                                            <li>Drag & drop reordering</li>
                                            <li>Enhanced driver stats display</li>
                                            <li>Tie indicators (yellow dots)</li>
                                            <li>Class movement controls</li>
                                            <li>Wave merge & reset options</li>
                                            <li>Quick position buttons</li>
                                        </ul>
                                    </CardContent>
                                </Card>
                            </div>

                            <Card className="bg-gradient-to-r from-pit-orange/10 to-pit-orange/20 border-pit-orange">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Download className="h-5 w-5" />
                                        Step 5: Export Options
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid md:grid-cols-2 gap-4">
                                        <div>
                                            <h4 className="font-semibold mb-2">PDF Export</h4>
                                            <p className="text-sm">Professional formatted grid sheets perfect for printing and posting at events.</p>
                                        </div>
                                        <div>
                                            <h4 className="font-semibold mb-2">CSV Export</h4>
                                            <p className="text-sm">Spreadsheet-friendly format for further editing or importing into other systems.</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="bg-gradient-to-r from-track-blue/10 to-track-blue/20 border-track-blue">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Settings className="h-5 w-5" />
                                        Advanced Features
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-3">
                                        <div>
                                            <h4 className="font-semibold text-sm mb-1">Multi-File Data Consolidation</h4>
                                            <p className="text-sm text-gray-600">Upload multiple race sessions to combine driver statistics across runs.</p>
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-sm mb-1">Lap Times Support</h4>
                                            <p className="text-sm text-gray-600">Automatic detection and processing of Orbits lap times exports.</p>
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-sm mb-1">Advanced Tie-Breaking</h4>
                                            <p className="text-sm text-gray-600">3-level cascading tie-breakers for points-based sorting with multiple criteria.</p>
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-sm mb-1">Enhanced Grid Display</h4>
                                            <p className="text-sm text-gray-600">Comprehensive driver stats, PIC tracking, and visual tie indicators.</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Alert className="bg-caution-yellow/10 border-caution-yellow">
                                <Info className="h-4 w-4" />
                                <AlertTitle>Pro Tips</AlertTitle>
                                <AlertDescription>
                                    <ul className="list-disc pl-5 space-y-1 mt-2">
                                        <li><strong>Data Preparation:</strong> Include Best Tm, Points, PIC columns for full functionality</li>
                                        <li><strong>Multi-File Support:</strong> Upload multiple sessions to consolidate driver statistics</li>
                                        <li><strong>Tie-Breaking:</strong> Configure cascading tie-breakers for points-based sorting</li>
                                        <li><strong>Column Warnings:</strong> Check file warnings to ensure all features are available</li>
                                        <li><strong>Class Ordering:</strong> Use fastest/slowest class first for different race dynamics</li>
                                    </ul>
                                </AlertDescription>
                            </Alert>

                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>Troubleshooting</AlertTitle>
                                <AlertDescription>
                                    <div className="space-y-2 mt-2">
                                        <p><strong>Upload Issues:</strong> Check file is valid CSV with Driver, Number, Class columns</p>
                                        <p><strong>Missing Classes:</strong> Verify CSV files contain Class column with data</p>
                                        <p><strong>Sort Options Missing:</strong> Timing or Points data may not be available in uploaded files</p>
                                        <p><strong>Export Problems:</strong> Ensure grid has been built and grid name is filled in</p>
                                    </div>
                                </AlertDescription>
                            </Alert>

                            <div className="text-center">
                                <Button 
                                    size="lg"
                                    className="bg-grid-green hover:bg-grid-green/90"
                                    onClick={() => {
                                        setShowHelpModal(false);
                                        setCurrentStep(1);
                                    }}
                                >
                                    <Flag className="mr-2 h-5 w-5" />
                                    Start Building Your Grid
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
            
            {/* Version display in bottom-right corner */}
            <div className="fixed bottom-4 right-4 text-xs text-gray-400">
                v0.4.0
            </div>
        </div>
    );
};

export default GridBuilder;