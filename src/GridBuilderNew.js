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
  Info
} from 'lucide-react';

// UI Components
import { Button } from './components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './components/ui/card';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Checkbox } from './components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from './components/ui/radio-group';
import { Select } from './components/ui/select';
import { Alert, AlertDescription, AlertTitle } from './components/ui/alert';
import { Badge } from './components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './components/ui/accordion';
import { cn } from './lib/utils';

// Import SVG icons
import racingFlag from './assets/racing-flag.svg';
import minus3Icon from './assets/minus_3.svg';
import minus1Icon from './assets/minus_1.svg';
import plus1Icon from './assets/plus_1.svg';
import plus3Icon from './assets/plus_3.svg';

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
        { num: 1, label: 'Upload Files', icon: Upload },
        { num: 2, label: 'Set Waves', icon: Flag },
        { num: 3, label: 'Configure', icon: FileText },
        { num: 4, label: 'Review', icon: RefreshCw },
        { num: 5, label: 'Export', icon: Download },
        { num: 6, label: 'Help', icon: HelpCircle }
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
    
    const handleFileUpload = async (files) => {
        setParseError('');
        
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
        setParseError('');
        setHasValidData(true);
    };
    
    const removeAllFiles = () => {
        setUploadedFiles([]);
        setParsedData([]);
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
    
    const hasSecondBestTimes = () => {
        const secondTimeVariations = ['2nd Best', 'SecondBest', 'Second Best', 'Time2', '2nd'];
        
        return parsedData.some(file => {
            if (!file.data || file.data.length === 0) return false;
            
            const headers = Object.keys(file.data[0] || {});
            return secondTimeVariations.some(variation => headers.includes(variation));
        });
    };
    
    const hasValidPoints = () => {
        const pointsVariations = ['Points', 'Pts', 'Score'];
        
        return parsedData.some(file => {
            if (!file.data || file.data.length === 0) return false;
            
            return file.data.some(row => {
                const pointsValue = normalizeFieldName(row, pointsVariations);
                const points = parseInt(pointsValue) || 0;
                return points > 0;
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
        if (!parsedData || parsedData.length === 0) {
            setParseError('No valid CSV files have been uploaded. Please upload valid race data files.');
            setCurrentStep(1);
            return;
        }
        
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
            const waveDataMap = new Map();
            
            parsedData.forEach(file => {
                file.data.forEach(row => {
                    const rowClass = normalizeFieldName(row, classVariations);
                    if (config.classes.includes(rowClass)) {
                        const normalizedRow = {
                            Class: rowClass,
                            Number: normalizeFieldName(row, numberVariations),
                            Driver: normalizeFieldName(row, driverVariations),
                            Position: normalizeFieldName(row, positionVariations),
                            BestTime: normalizeFieldName(row, bestTimeVariations),
                            SecondBest: normalizeFieldName(row, secondTimeVariations),
                            Points: normalizeFieldName(row, pointsVariations),
                            source: file.fileName,
                            originalRow: row
                        };
                        
                        const driverKey = normalizedRow.Driver ? normalizedRow.Driver.trim().toLowerCase() : null;
                        
                        if (driverKey) {
                            const existing = waveDataMap.get(driverKey);
                            
                            if (!existing) {
                                waveDataMap.set(driverKey, normalizedRow);
                            } else {
                                let existingTime, newTime;
                                
                                if (config.sortBy === 'secondBest') {
                                    existingTime = parseTime(existing.SecondBest);
                                    newTime = parseTime(normalizedRow.SecondBest);
                                } else {
                                    existingTime = parseTime(existing.BestTime);
                                    newTime = parseTime(normalizedRow.BestTime);
                                }
                                
                                if (newTime < existingTime) {
                                    waveDataMap.set(driverKey, normalizedRow);
                                } else if (newTime === existingTime) {
                                    const existingPos = parseInt(existing.Position) || 999;
                                    const newPos = parseInt(normalizedRow.Position) || 999;
                                    
                                    if (newPos < existingPos) {
                                        waveDataMap.set(driverKey, normalizedRow);
                                    } else if (newPos === existingPos) {
                                        const existingPts = parseInt(existing.Points) || 0;
                                        const newPts = parseInt(normalizedRow.Points) || 0;
                                        
                                        if (newPts > existingPts) {
                                            waveDataMap.set(driverKey, normalizedRow);
                                        }
                                    }
                                }
                            }
                        } else if (normalizedRow.Number) {
                            const carKey = `car_${normalizedRow.Number}`;
                            if (!waveDataMap.has(carKey)) {
                                waveDataMap.set(carKey, normalizedRow);
                            }
                        }
                    }
                });
            });
            
            const waveData = Array.from(waveDataMap.values());
            
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
                        return ptsB - ptsA;
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
                            <AccordionItem value="tips" className="border-track-blue bg-blue-50">
                                <AccordionTrigger 
                                    onClick={() => setShowTips(!showTips)}
                                    isOpen={showTips}
                                    className="text-track-blue hover:bg-blue-100"
                                >
                                    <h4 className="flex items-center gap-2 text-base font-semibold">
                                        <Info className="h-5 w-5" />
                                        MyLaps Orbits Export Tips
                                    </h4>
                                </AccordionTrigger>
                                <AccordionContent isOpen={showTips}>
                                    <div className="space-y-3 text-track-blue">
                                        <p className="font-semibold">Before exporting from MyLaps Orbits:</p>
                                        <ul className="list-disc pl-5 space-y-1">
                                            <li><strong>For time-based sorting:</strong> Include "Best Tm" and "2nd Best" columns in your results view</li>
                                            <li><strong>For points-based sorting:</strong> Include a "Points" column in your results view</li>
                                            <li><strong>Required columns:</strong> Driver, Number, Class are always needed</li>
                                        </ul>
                                        <p className="text-sm italic opacity-80">
                                            These columns must be visible in your results view before exporting to CSV for all sorting options to be available.
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
                                        {uploadedFiles.map((file, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                                <span className="font-medium">{file.name}</span>
                                                <Button 
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => removeFile(idx)}
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
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
                                    Choose how many starting groups you need for your race
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
                                                {waveConfigs.length === 1 && (
                                                    <Button
                                                        size="sm"
                                                        variant="secondary"
                                                        onClick={() => assignAllClassesToWave(idx)}
                                                    >
                                                        Assign All Classes
                                                    </Button>
                                                )}
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
                                                                className="cursor-pointer"
                                                                title={isAssignedElsewhere ? `Already assigned to another wave` : ''}
                                                            >
                                                                {cls}
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
                                            <option value="position">Finishing Position</option>
                                            <option value="bestTime">Best Time</option>
                                            {hasSecondBestTimes() && (
                                                <option value="secondBest">Second Best Time</option>
                                            )}
                                            {hasValidPoints() && (
                                                <option value="points">Points</option>
                                            )}
                                        </Select>
                                    </div>
                                    
                                    <div>
                                        <Label htmlFor={`order-${idx}`}>Grid Order</Label>
                                        <Select 
                                            id={`order-${idx}`}
                                            value={config.gridOrder}
                                            onChange={(e) => updateWaveConfig(idx, 'gridOrder', e.target.value)}
                                        >
                                            <option value="straight">Straight Up</option>
                                            <option value="fastestFirst">Fastest Class First</option>
                                            <option value="slowestFirst">Slowest Class First</option>
                                        </Select>
                                    </div>
                                    
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
                                                                <Merge className="h-4 w-4" />
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
                                                                <RefreshCw className="h-4 w-4" />
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
                                                                            <ChevronUp className="h-4 w-4" />
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
                                                                            <ChevronDown className="h-4 w-4" />
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            );
                                                            
                                                            classEntries.forEach((entry, entryIdx) => {
                                                                const originalEntryIdx = waveEntries.indexOf(entry);
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
                                                                        <div className="w-16 font-bold text-primary">{entry.gridPosition}</div>
                                                                        <div className="flex-1 flex items-center gap-4">
                                                                            <Badge variant="outline" className="bg-carbon-black text-white">
                                                                                {entry.Number || '?'}
                                                                            </Badge>
                                                                            <span className="font-medium">{entry.Driver || 'Unknown Driver'}</span>
                                                                            <Badge variant="secondary">{entry.Class || 'N/A'}</Badge>
                                                                            <span className="text-gray-600 font-mono text-sm">{entry.BestTime || '--:--'}</span>
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
                                                        return waveEntries.map((entry, entryIdx) => (
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
                                                                <div className="w-16 font-bold text-primary">{entry.gridPosition}</div>
                                                                <div className="flex-1 flex items-center gap-4">
                                                                    <Badge variant="outline" className="bg-carbon-black text-white">
                                                                        {entry.Number || '?'}
                                                                    </Badge>
                                                                    <span className="font-medium">{entry.Driver || 'Unknown Driver'}</span>
                                                                    <Badge variant="secondary">{entry.Class || 'N/A'}</Badge>
                                                                    <span className="text-gray-600 font-mono text-sm">{entry.BestTime || '--:--'}</span>
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
                                                        ));
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
                                <File className="h-16 w-16 mx-auto mb-4" />
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
                
            case 6:
                return (
                    <div className="max-w-4xl mx-auto space-y-6">
                        <h2 className="text-3xl font-semibold text-center mb-8">Grid Builder Help</h2>
                        
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
                                    <p className="mb-3">Import your race data from CSV files. Supports multiple file formats with Driver, Car Number, Class, and timing information.</p>
                                    <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600">
                                        <li>Drag & drop or click to upload</li>
                                        <li>Multiple files supported</li>
                                        <li>Automatic format detection</li>
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
                                        <li>Consider track capacity</li>
                                        <li>Balance competition levels</li>
                                    </ul>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <FileText className="h-5 w-5 text-track-blue" />
                                        Step 3: Configure
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="mb-3">Set up each wave's start type, assign classes, choose sorting criteria, and configure grid order options.</p>
                                    <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600">
                                        <li>Flying vs Standing starts</li>
                                        <li>Class assignments</li>
                                        <li>Sort by position, time, or points</li>
                                        <li>Inversion options</li>
                                    </ul>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <RefreshCw className="h-5 w-5 text-track-blue" />
                                        Step 4: Review
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="mb-3">Fine-tune your grid with manual adjustments. Drag & drop drivers, move entire classes, merge waves, or reset changes.</p>
                                    <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600">
                                        <li>Drag & drop reordering</li>
                                        <li>Class movement controls</li>
                                        <li>Wave merge & reset options</li>
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

                        <Alert className="bg-caution-yellow/10 border-caution-yellow">
                            <Info className="h-4 w-4" />
                            <AlertTitle>Pro Tips</AlertTitle>
                            <AlertDescription>
                                <ul className="list-disc pl-5 space-y-1 mt-2">
                                    <li><strong>Plan Your Waves:</strong> Consider track capacity, safety, and competitive balance</li>
                                    <li><strong>Class Ordering:</strong> Use fastest/slowest class first for different race dynamics</li>
                                    <li><strong>Inversion Strategy:</strong> Mix up the field to create closer racing</li>
                                    <li><strong>Data Quality:</strong> Ensure CSV files have consistent formatting and class names</li>
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
                                onClick={() => setCurrentStep(1)}
                            >
                                <Flag className="mr-2 h-5 w-5" />
                                Start Building Your Grid
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
                        onClick={() => setCurrentStep(6)}
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
                
                <div className="fixed bottom-3 right-4 text-xs text-gray-500 font-mono">
                    v0.2.4
                </div>
            </div>
        </div>
    );
};

export default GridBuilder;