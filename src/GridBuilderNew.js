import React, { useState, useRef, useMemo, useCallback } from 'react';
import { 
  Upload, 
  FileText, 
  X, 
  ChevronRight, 
  ChevronLeft,
  Flag,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  Download,
  File,
  HelpCircle,
  AlertCircle,
  Info,
  Settings,
  Eye,
  Plus,
  Minus,
  Merge,
  MoveVertical
} from 'lucide-react';

// Import utility modules
import { 
    parseCSV, 
    consolidateDriverData
} from './utils/dataProcessing.js';
import { 
    initializeWaveConfigs,
    buildGrid,
    extractClasses,
    getCarCountsByClass,
    getCarCountInWave,
    getAssignedClasses,
    detectTies,
    getClassOrder,
    getMergedClassDisplay,
    mergeClassWithPrevious as mergeClassEntries
} from './utils/gridBuilder.js';
import { 
    generatePDF, 
    generateCSV,
    generateWaveDescription
} from './utils/exportUtils.js';

// UI Components
import { Button } from './components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Alert, AlertDescription, AlertTitle } from './components/ui/alert';
import { Badge } from './components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './components/ui/accordion';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './components/ui/dialog';
import { cn } from './lib/utils';

// Import SVG icons
import racingFlag from './assets/racing-flag.svg';
import minus3Icon from './assets/minus_3.svg';
import minus1Icon from './assets/minus_1.svg';
import mergeIcon from './assets/merge.svg';

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
    const [mergedClasses, setMergedClasses] = useState(new Map()); // Maps wave index to merged class groups
    
    const steps = [
        { num: 1, label: 'Upload Files', icon: Upload },
        { num: 2, label: 'Set Waves', icon: Flag },
        { num: 3, label: 'Configure', icon: Settings },
        { num: 4, label: 'Review', icon: Eye },
        { num: 5, label: 'Export', icon: Download }
    ];
    
    const handleFileUpload = async (files) => {
        setParseError('');
        
        const fileArray = Array.from(files);
        const csvFiles = fileArray.filter(f => f.name.endsWith('.csv'));
        
        try {
            // Read file contents first
            const fileContents = await Promise.all(csvFiles.map(file => {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve({ content: e.target.result, fileName: file.name });
                    reader.onerror = (e) => reject(e);
                    reader.readAsText(file);
                });
            }));
            
            // Now parse the content
            const newParsed = fileContents.map(({ content, fileName }) => parseCSV(content, fileName));
            // Extract original files from previously parsed data
            const previousFiles = parsedData.length > 0 && parsedData[0].originalFiles 
                ? parsedData[0].originalFiles 
                : [];
            const allParsedFiles = [...previousFiles, ...newParsed];
            
            // Analyze each new file for missing columns
            const newWarnings = new Map(fileWarnings);
            
            newParsed.forEach(parsed => {
                const headers = Object.keys(parsed.data[0] || {});
                const warnings = [];
                
                // Check for essential columns
                const hasClass = headers.some(h => ['Class', 'class', 'CLASS'].includes(h));
                const hasDriver = headers.some(h => ['Name', 'Driver', 'DriverName', 'Pilot'].includes(h));
                const hasNumber = headers.some(h => ['No.', 'Number', 'CarNumber', 'Car', '#', 'Num'].includes(h));
                
                if (!hasClass) warnings.push('Missing Class column');
                if (!hasDriver) warnings.push('Missing Driver/Name column');
                if (!hasNumber) warnings.push('Missing Number column');
                
                // Check for timing columns
                const hasBestTime = headers.some(h => ['Best Tm', 'BestTime', 'Best Time', 'FastLap', 'Best', 'Time'].includes(h));
                const hasSecondTime = headers.some(h => ['2nd Best', 'SecondBest', 'Second Best', 'Time2', '2nd'].includes(h));
                
                if (!hasBestTime) warnings.push('Missing Best Time column');
                if (!hasSecondTime) warnings.push('Missing 2nd Best Time column');
                
                // Check for points column
                const hasPoints = headers.some(h => ['Points', 'Pts', 'Score'].includes(h));
                if (!hasPoints) warnings.push('Missing Points column');
                
                // Check for position columns
                const hasPosition = headers.some(h => ['Pos', 'Position', 'Finish', 'Place', 'P'].includes(h));
                const hasPIC = headers.some(h => ['PIC', 'Pos in Class', 'Position in Class', 'Class Position', 'ClassPos'].includes(h));
                
                if (!hasPosition) warnings.push('Missing Position column');
                if (!hasPIC) warnings.push('Missing Position in Class (PIC) column');
                
                if (warnings.length > 0) {
                    newWarnings.set(parsed.fileName, warnings);
                }
            });
            
            setFileWarnings(newWarnings);
            
            // Consolidate all driver data
            const consolidatedData = consolidateDriverData(allParsedFiles);
            
            if (consolidatedData && consolidatedData.length > 0) {
                setParsedData(consolidatedData);
                setUploadedFiles([...uploadedFiles, ...csvFiles]);
                setHasValidData(true);
            } else {
                throw new Error('No valid driver data found in uploaded files. Please check your CSV format.');
            }
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
        e.preventDefault();
        e.currentTarget.classList.remove('border-primary');
    };
    
    const removeFile = (index) => {
        const newFiles = uploadedFiles.filter((_, i) => i !== index);
        setUploadedFiles(newFiles);
        
        if (newFiles.length === 0) {
            setParsedData([]);
            setFinalGrid([]);
            setOriginalGrid([]);
            setWaveConfigs([]);
            setParseError('');
            setFileWarnings(new Map());
        }
    };
    
    const removeAllFiles = () => {
        setUploadedFiles([]);
        setParsedData([]);
        setFinalGrid([]);
        setOriginalGrid([]);
        setWaveConfigs([]);
        setParseError('');
        setFileWarnings(new Map());
    };
    
    
    const nextStep = () => {
        if (currentStep === 2) {
            // Initialize wave configs when moving from step 2 to 3
            const configs = initializeWaveConfigs(waveCount, defaultWaveSpacing, hasMultipleFiles, hasPositionData);
            setWaveConfigs(configs);
        }
        if (currentStep === 3) {
            // Build the grid when moving from step 3 to 4
            const grid = buildGrid(waveConfigs, parsedData);
            setFinalGrid(grid);
            setOriginalGrid(JSON.parse(JSON.stringify(grid))); // Deep copy for reset functionality
        }
        setCurrentStep(prev => Math.min(prev + 1, 5));
    };
    
    const prevStep = () => {
        setCurrentStep(prev => Math.max(prev - 1, 1));
    };
    
    const updateWaveConfig = (index, field, value) => {
        const newConfigs = [...waveConfigs];
        newConfigs[index] = { ...newConfigs[index], [field]: value };
        setWaveConfigs(newConfigs);
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
        
        if (draggedItem && (draggedItem.waveIndex !== waveIndex || draggedItem.entryIndex !== entryIndex)) {
            const newGrid = [...finalGrid];
            const draggedEntry = newGrid[draggedItem.waveIndex].entries[draggedItem.entryIndex];
            
            // Remove from original position
            newGrid[draggedItem.waveIndex].entries.splice(draggedItem.entryIndex, 1);
            
            // Insert at new position
            newGrid[waveIndex].entries.splice(entryIndex, 0, draggedEntry);
            
            setFinalGrid(newGrid);
        }
        
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
        setParseError('');
        setHasValidData(true);
        setFileWarnings(new Map());
        setMergedClasses(new Map());
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };
    
    const moveToEndOfWave = (waveIndex, entryIndex) => {
        const newGrid = [...finalGrid];
        const entry = newGrid[waveIndex].entries[entryIndex];
        
        // Remove from current position
        newGrid[waveIndex].entries.splice(entryIndex, 1);
        
        // Add to end of wave
        newGrid[waveIndex].entries.push(entry);
        
        setFinalGrid(newGrid);
    };
    
    const moveToStartOfWave = (waveIndex, entryIndex) => {
        const newGrid = [...finalGrid];
        const entry = newGrid[waveIndex].entries[entryIndex];
        
        // Remove from current position
        newGrid[waveIndex].entries.splice(entryIndex, 1);
        
        // Add to start of wave
        newGrid[waveIndex].entries.unshift(entry);
        
        setFinalGrid(newGrid);
    };

    const moveToEndOfClass = (waveIndex, entryIndex) => {
        const newGrid = [...finalGrid];
        const entry = newGrid[waveIndex].entries[entryIndex];
        const entryClass = entry.Class;
        
        // Find the last entry of the same class
        const lastClassEntryIndex = newGrid[waveIndex].entries
            .map((e, i) => ({ entry: e, index: i }))
            .filter(item => item.entry.Class === entryClass)
            .pop()?.index;
        
        if (lastClassEntryIndex !== undefined && lastClassEntryIndex !== entryIndex) {
            // Remove from current position
            newGrid[waveIndex].entries.splice(entryIndex, 1);
            
            // Adjust target index if we removed an item before it
            const adjustedTargetIndex = entryIndex < lastClassEntryIndex ? lastClassEntryIndex : lastClassEntryIndex + 1;
            
            // Insert at the end of the class
            newGrid[waveIndex].entries.splice(adjustedTargetIndex, 0, entry);
            
            setFinalGrid(newGrid);
        }
    };
    
    const moveClassUp = useCallback((waveIndex, className) => {
        const operationKey = `${waveIndex}-${className}-up`;
        
        if (isMovingRef.current === operationKey || isMovingRef.current) {
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
        
        if (isMovingRef.current === operationKey || isMovingRef.current) {
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
    
    const mergeClassWithPrevious = (waveIndex, entryIndex) => {
        const newGrid = [...finalGrid];
        const currentEntry = newGrid[waveIndex].entries[entryIndex];
        
        if (!currentEntry?.Class) return;
        
        const currentClass = currentEntry.Class;
        
        // Find the previous different class
        let prevClassIndex = -1;
        for (let i = entryIndex - 1; i >= 0; i--) {
            if (newGrid[waveIndex].entries[i].Class !== currentClass) {
                prevClassIndex = i;
                break;
            }
        }
        
        if (prevClassIndex === -1) return; // No previous class found
        
        const prevClass = newGrid[waveIndex].entries[prevClassIndex].Class;
        
        // Update merged classes tracking
        const newMergedClasses = new Map(mergedClasses);
        if (!newMergedClasses.has(waveIndex)) {
            newMergedClasses.set(waveIndex, new Map());
        }
        
        const waveMerged = newMergedClasses.get(waveIndex);
        
        // If current class is already merged, extend that group
        let mergeGroup;
        if (waveMerged.has(currentClass)) {
            mergeGroup = waveMerged.get(currentClass);
        } else {
            mergeGroup = [currentClass];
        }
        
        // Add previous class to the group if not already there
        if (!mergeGroup.includes(prevClass)) {
            mergeGroup.unshift(prevClass);
        }
        
        // Update all classes in the group to reference the same merge group
        mergeGroup.forEach(cls => {
            waveMerged.set(cls, mergeGroup);
        });
        
        setMergedClasses(newMergedClasses);
        
        // Change all entries of current class to previous class
        newGrid[waveIndex].entries.forEach(entry => {
            if (entry.Class === currentClass) {
                entry.Class = prevClass;
            }
        });
        
        setFinalGrid(newGrid);
    };
    
    const resetToOriginalGrid = () => {
        if (originalGrid.length > 0) {
            setFinalGrid(JSON.parse(JSON.stringify(originalGrid)));
            setMergedClasses(new Map());
        }
    };
    
    const assignAllClassesToWave = (waveIndex) => {
        const availableClasses = extractClasses(parsedData);
        const currentlyAssigned = getAssignedClasses(waveConfigs);
        const unassignedClasses = availableClasses.filter(cls => !currentlyAssigned.has(cls));
        
        const newConfigs = [...waveConfigs];
        newConfigs[waveIndex] = {
            ...newConfigs[waveIndex],
            classes: [...newConfigs[waveIndex].classes, ...unassignedClasses]
        };
        setWaveConfigs(newConfigs);
    };
    
    // Helper functions for component logic
    const availableClasses = useMemo(() => extractClasses(parsedData), [parsedData]);
    const carCounts = useMemo(() => getCarCountsByClass(parsedData), [parsedData]);
    
    const hasSecondBestTimes = () => {
        return parsedData.some(driver => 
            driver.secondBestOverallTime && 
            driver.secondBestOverallTime.time && 
            driver.secondBestOverallTime.time !== ''
        );
    };
    
    const hasValidPoints = () => {
        return parsedData.some(driver => 
            driver.totalPoints !== undefined && 
            driver.totalPoints !== null && 
            driver.totalPoints > 0
        );
    };
    
    const hasMultipleFiles = () => {
        return parsedData.some(driver => driver.fileCount > 1);
    };
    
    const hasPositionData = () => {
        return parsedData.some(driver => 
            driver.files && driver.files.length > 0 && 
            driver.files[0].Pos !== undefined && 
            driver.files[0].Pos !== null && 
            driver.files[0].Pos !== ''
        );
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header with Racing Theme */}
            <div className="bg-gradient-to-r from-racing-red to-racing-red-dark text-white shadow-lg">
                <div className="container mx-auto px-4 py-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <img src={racingFlag} alt="Racing Flag" className="h-8 w-8" />
                            <div>
                                <h1 className="text-2xl font-bold">Grid Builder</h1>
                                <p className="text-racing-red-light text-sm">Professional Starting Grid Generator</p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-4">
                            <Button 
                                variant="outline" 
                                size="sm"
                                className="border-white text-white hover:bg-white hover:text-racing-red"
                                onClick={() => setShowHelpModal(true)}
                            >
                                <HelpCircle className="h-4 w-4 mr-2" />
                                Help
                            </Button>
                            {currentStep > 1 && (
                                <Button 
                                    variant="outline" 
                                    size="sm"
                                    className="border-white text-white hover:bg-white hover:text-racing-red"
                                    onClick={startNewGrid}
                                >
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                    New Grid
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Progress Steps */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        {steps.map((step, index) => {
                            const Icon = step.icon;
                            const isActive = currentStep === step.num;
                            const isCompleted = currentStep > step.num;
                            
                            return (
                                <div key={step.num} className="flex items-center">
                                    <div className={cn(
                                        "flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-200",
                                        isActive 
                                            ? "border-racing-red bg-racing-red text-white" 
                                            : isCompleted 
                                                ? "border-grid-green bg-grid-green text-white"
                                                : "border-gray-300 text-gray-400"
                                    )}>
                                        <Icon className="h-5 w-5" />
                                    </div>
                                    <div className="ml-3">
                                        <p className={cn(
                                            "text-sm font-medium transition-colors duration-200",
                                            isActive 
                                                ? "text-racing-red" 
                                                : isCompleted 
                                                    ? "text-grid-green"
                                                    : "text-gray-500"
                                        )}>
                                            {step.label}
                                        </p>
                                    </div>
                                    {index < steps.length - 1 && (
                                        <ChevronRight className="h-5 w-5 text-gray-300 mx-4" />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="container mx-auto px-4 py-8">
                {/* Step 1: Upload Files */}
                {currentStep === 1 && (
                    <div className="space-y-6">
                        <div className="text-center">
                            <h2 className="text-3xl font-bold text-gray-900 mb-2">Upload Race Data</h2>
                            <p className="text-lg text-gray-600">Import your CSV files to get started</p>
                        </div>

                        {/* File Upload Area */}
                        <Card>
                            <CardContent className="p-8">
                                <div 
                                    className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-track-blue transition-colors duration-200 cursor-pointer"
                                    onDrop={handleDrop}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <Upload className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                                    <h3 className="text-xl font-semibold text-gray-700 mb-2">
                                        Drop your CSV files here
                                    </h3>
                                    <p className="text-gray-500 mb-4">
                                        or click to browse and select files
                                    </p>
                                    <p className="text-sm text-gray-400">
                                        Supports Results exports and Lap Times CSV files
                                    </p>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        multiple
                                        accept=".csv"
                                        className="hidden"
                                        onChange={(e) => handleFileUpload(e.target.files)}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* File Warnings */}
                        {fileWarnings.size > 0 && (
                            <Alert>
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>Column Warnings</AlertTitle>
                                <AlertDescription>
                                    <div className="mt-2 space-y-2">
                                        {Array.from(fileWarnings.entries()).map(([fileName, warnings]) => (
                                            <div key={fileName} className="text-sm">
                                                <strong>{fileName}:</strong>
                                                <ul className="list-disc list-inside ml-4 mt-1">
                                                    {warnings.map((warning, idx) => (
                                                        <li key={idx} className="text-gray-600">{warning}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        ))}
                                    </div>
                                    <p className="mt-3 text-sm">
                                        Files with missing columns can still be used, but some features may not be available.
                                    </p>
                                </AlertDescription>
                            </Alert>
                        )}

                        {/* Uploaded Files List */}
                        {uploadedFiles.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <div className="flex justify-between items-center">
                                        <CardTitle className="flex items-center gap-2">
                                            <FileText className="h-5 w-5 text-track-blue" />
                                            Uploaded Files ({uploadedFiles.length})
                                        </CardTitle>
                                        <Button 
                                            variant="outline" 
                                            size="sm"
                                            onClick={removeAllFiles}
                                        >
                                            Clear All
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2">
                                        {uploadedFiles.map((file, index) => (
                                            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                                <div className="flex items-center space-x-3">
                                                    <File className="h-5 w-5 text-track-blue" />
                                                    <span className="font-medium">{file.name}</span>
                                                    <span className="text-sm text-gray-500">
                                                        ({(file.size / 1024).toFixed(1)} KB)
                                                    </span>
                                                </div>
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm"
                                                    onClick={() => removeFile(index)}
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Parse Error */}
                        {parseError && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>Upload Error</AlertTitle>
                                <AlertDescription>{parseError}</AlertDescription>
                            </Alert>
                        )}

                        {/* Data Summary */}
                        {parsedData.length > 0 && (
                            <Card className="bg-gradient-to-r from-grid-green/10 to-grid-green/20 border-grid-green">
                                <CardHeader>
                                    <CardTitle className="text-grid-green">Data Successfully Loaded</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid md:grid-cols-3 gap-4">
                                        <div className="text-center">
                                            <div className="text-2xl font-bold text-grid-green">{parsedData.length}</div>
                                            <div className="text-sm text-gray-600">Total Drivers</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-2xl font-bold text-grid-green">{availableClasses.length}</div>
                                            <div className="text-sm text-gray-600">Classes Found</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-2xl font-bold text-grid-green">{uploadedFiles.length}</div>
                                            <div className="text-sm text-gray-600">Files Processed</div>
                                        </div>
                                    </div>
                                    
                                    {availableClasses.length > 0 && (
                                        <div className="mt-4">
                                            <Label className="text-sm font-medium text-gray-700">Classes:</Label>
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                {availableClasses.map(cls => (
                                                    <Badge 
                                                        key={cls} 
                                                        variant="secondary"
                                                        className="bg-track-blue text-white"
                                                        style={{
                                                            backgroundColor: '#4B7BFF',
                                                            color: 'white'
                                                        }}
                                                    >
                                                        {cls} ({carCounts.get(cls) || 0})
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {/* Navigation */}
                        <div className="flex justify-end">
                            <Button 
                                onClick={nextStep}
                                disabled={!hasValidData || parsedData.length === 0}
                                className="bg-racing-red hover:bg-racing-red-dark text-white"
                            >
                                Next: Set Wave Count
                                <ChevronRight className="ml-2 h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}

                {/* Step 2: Set Wave Count */}
                {currentStep === 2 && (
                    <div className="space-y-6">
                        <div className="text-center">
                            <h2 className="text-3xl font-bold text-gray-900 mb-2">Configure Waves</h2>
                            <p className="text-lg text-gray-600">Set the number of starting waves and spacing</p>
                        </div>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Flag className="h-5 w-5 text-track-blue" />
                                    Wave Configuration
                                </CardTitle>
                                <CardDescription>
                                    Configure how many waves you want and optional spacing between them
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {/* Wave Count */}
                                <div>
                                    <Label htmlFor="wave-count">Number of Waves</Label>
                                    <div className="flex items-center gap-2 mt-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            onClick={() => setWaveCount(Math.max(1, waveCount - 1))}
                                            disabled={waveCount <= 1}
                                            className="h-10 w-10"
                                        >
                                            <Minus className="h-4 w-4" />
                                        </Button>
                                        <Input
                                            id="wave-count"
                                            type="number"
                                            min="1"
                                            max="10"
                                            value={waveCount}
                                            onChange={(e) => {
                                                const value = parseInt(e.target.value);
                                                if (!isNaN(value)) {
                                                    setWaveCount(Math.min(10, Math.max(1, value)));
                                                }
                                            }}
                                            className="w-24 text-center text-lg font-semibold"
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            onClick={() => setWaveCount(Math.min(10, waveCount + 1))}
                                            disabled={waveCount >= 10}
                                            className="h-10 w-10"
                                        >
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                        <span className="text-sm text-gray-500 ml-2">(1-10)</span>
                                    </div>
                                </div>

                                {/* Wave Spacing */}
                                <div>
                                    <Label htmlFor="wave-spacing">Wave Spacing (Optional)</Label>
                                    <p className="text-sm text-gray-500 mb-2">
                                        Add empty grid positions between waves for spacing
                                    </p>
                                    <div className="flex items-center gap-2 mt-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            onClick={() => setDefaultWaveSpacing(Math.max(0, defaultWaveSpacing - 1))}
                                            disabled={defaultWaveSpacing <= 0}
                                            className="h-10 w-10"
                                        >
                                            <Minus className="h-4 w-4" />
                                        </Button>
                                        <Input
                                            id="wave-spacing"
                                            type="number"
                                            min="0"
                                            max="10"
                                            value={defaultWaveSpacing}
                                            onChange={(e) => {
                                                const value = parseInt(e.target.value);
                                                if (!isNaN(value)) {
                                                    setDefaultWaveSpacing(Math.min(10, Math.max(0, value)));
                                                }
                                            }}
                                            className="w-24 text-center text-lg font-semibold"
                                            placeholder="0"
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            onClick={() => setDefaultWaveSpacing(Math.min(10, defaultWaveSpacing + 1))}
                                            disabled={defaultWaveSpacing >= 10}
                                            className="h-10 w-10"
                                        >
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                        <span className="text-sm text-gray-500 ml-2">(0-10 positions)</span>
                                    </div>
                                </div>

                                {/* Preview */}
                                <div className="bg-gray-50 p-4 rounded-lg">
                                    <h4 className="font-medium text-gray-700 mb-2">Preview:</h4>
                                    <div className="text-sm text-gray-600">
                                        {waveCount === 1 ? (
                                            <span>Single wave - all drivers in one group</span>
                                        ) : (
                                            <span>
                                                {waveCount} waves{defaultWaveSpacing > 0 && ` with ${defaultWaveSpacing} empty position${defaultWaveSpacing > 1 ? 's' : ''} between waves`}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Navigation */}
                        <div className="flex justify-between">
                            <Button variant="outline" onClick={prevStep}>
                                <ChevronLeft className="mr-2 h-4 w-4" />
                                Back
                            </Button>
                            <Button 
                                onClick={nextStep}
                                className="bg-racing-red hover:bg-racing-red-dark text-white"
                            >
                                Next: Configure Waves
                                <ChevronRight className="ml-2 h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}

                {/* Step 3: Configure Waves */}
                {currentStep === 3 && (
                    <div className="space-y-6">
                        <div className="text-center">
                            <h2 className="text-3xl font-bold text-gray-900 mb-2">Configure Each Wave</h2>
                            <p className="text-lg text-gray-600">Set start types, assign classes, and choose sorting options</p>
                        </div>

                        <div className="grid gap-6">
                            {waveConfigs.map((config, idx) => {
                                const assignedElsewhere = new Set();
                                waveConfigs.forEach((otherConfig, otherIdx) => {
                                    if (otherIdx !== idx) {
                                        otherConfig.classes.forEach(cls => assignedElsewhere.add(cls));
                                    }
                                });

                                return (
                                    <Card key={idx} className="relative">
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
                                                        const availableClassesForWave = availableClasses.filter(cls => !assignedElsewhere.has(cls));
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
                                                        const isAssignedElsewhere = assignedElsewhere.has(cls);
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

                                            {config.classes.length > 0 && (
                                                <>
                                                    <div>
                                                        <Label htmlFor={`sort-${idx}`}>Sort Criteria</Label>
                                                        <select
                                                            id={`sort-${idx}`}
                                                            value={config.sortBy}
                                                            onChange={(e) => updateWaveConfig(idx, 'sortBy', e.target.value)}
                                                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                                                        >
                                                            {!hasMultipleFiles() && hasPositionData() && (
                                                                <option value="position">Finishing Position</option>
                                                            )}
                                                            <option value="bestTime">Best Overall Time</option>
                                                            {hasSecondBestTimes() && (
                                                                <option value="secondBest">Second Best Overall Time</option>
                                                            )}
                                                            {hasValidPoints() && (
                                                                <>
                                                                    <option value="pointsTotal">Total Points</option>
                                                                    {hasMultipleFiles() && (
                                                                        <option value="pointsAverage">Average Points</option>
                                                                    )}
                                                                </>
                                                            )}
                                                        </select>
                                                    </div>

                                                    {/* Tie Breaking Options (for points sorting) */}
                                                    {(config.sortBy === 'pointsTotal' || config.sortBy === 'pointsAverage') && (
                                                        <div>
                                                            <Label>Tie Breaking (in order of priority)</Label>
                                                            <p className="text-sm text-gray-500 mb-2">
                                                                When drivers have the same points, use these criteria to determine order
                                                            </p>
                                                            <div className="space-y-2">
                                                                {config.tieBreakers.map((tieBreaker, tbIdx) => (
                                                                    <div key={tbIdx} className="flex items-center gap-2">
                                                                        <span className="text-sm font-medium w-8">{tbIdx + 1}.</span>
                                                                        <select
                                                                            value={tieBreaker}
                                                                            onChange={(e) => {
                                                                                const newTieBreakers = [...config.tieBreakers];
                                                                                newTieBreakers[tbIdx] = e.target.value;
                                                                                updateWaveConfig(idx, 'tieBreakers', newTieBreakers);
                                                                            }}
                                                                            className="flex-1 px-3 py-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary text-sm"
                                                                        >
                                                                            <option value="bestTime">Best Overall Time</option>
                                                                            <option value="secondBest">Second Best Time</option>
                                                                            <option value="bestPIC">Best Position in Class</option>
                                                                            <option value="averagePIC">Average Position in Class</option>
                                                                            <option value="bestPosition">Best Overall Position</option>
                                                                            <option value="averagePosition">Average Position</option>
                                                                            <option value="alphabetical">Alphabetical (by name)</option>
                                                                        </select>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div>
                                                        <Label>Grid Order Options</Label>
                                                        <div className="space-y-3 mt-2">
                                                            <div className="flex items-center">
                                                                <input
                                                                    type="checkbox"
                                                                    id={`group-classes-${idx}`}
                                                                    checked={config.groupByClass}
                                                                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                                                    onChange={(e) => updateWaveConfig(idx, 'groupByClass', e.target.checked)}
                                                                />
                                                                <Label htmlFor={`group-classes-${idx}`} className="ml-2 cursor-pointer">
                                                                    Group by Class (keep classes together)
                                                                </Label>
                                                            </div>
                                                            
                                                            {config.groupByClass && (
                                                                <>
                                                                    <div className="ml-6">
                                                                        <Label htmlFor={`class-order-${idx}`} className="text-sm">Class Order</Label>
                                                                        <select
                                                                            id={`class-order-${idx}`}
                                                                            value={config.classOrder}
                                                                            onChange={(e) => updateWaveConfig(idx, 'classOrder', e.target.value)}
                                                                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary text-sm"
                                                                        >
                                                                            <option value="fastest">Fastest Class First</option>
                                                                            <option value="slowest">Slowest Class First</option>
                                                                            <option value="alphabetical">Alphabetical</option>
                                                                        </select>
                                                                    </div>
                                                                    <div className="ml-6 mt-3">
                                                                        <Label htmlFor={`class-spacing-${idx}`} className="text-sm">Empty Positions Between Classes</Label>
                                                                        <Input
                                                                            id={`class-spacing-${idx}`}
                                                                            type="number"
                                                                            min="0"
                                                                            max="5"
                                                                            value={config.emptyPositionsBetweenClasses || 0}
                                                                            onChange={(e) => updateWaveConfig(idx, 'emptyPositionsBetweenClasses', Math.max(0, parseInt(e.target.value) || 0))}
                                                                            className="mt-1 w-20"
                                                                        />
                                                                    </div>
                                                                </>
                                                            )}
                                                            
                                                            <div className="flex items-center">
                                                                <input
                                                                    type="checkbox"
                                                                    id={`invert-${idx}`}
                                                                    checked={config.invertOrder}
                                                                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                                                    onChange={(e) => updateWaveConfig(idx, 'invertOrder', e.target.checked)}
                                                                />
                                                                <Label htmlFor={`invert-${idx}`} className="ml-2 cursor-pointer">
                                                                    Invert Order (slowest/lowest first)
                                                                </Label>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                            
                                            {config.classes.length > 0 && (
                                                <div className="bg-gray-50 p-4 rounded-lg">
                                                    <h4 className="font-medium text-gray-700 mb-2">Wave {config.waveNumber} Summary:</h4>
                                                    <div className="text-sm text-gray-600">
                                                        <div>Start Type: <span className="font-medium">{config.startType}</span></div>
                                                        <div>Classes: <span className="font-medium">{config.classes.join(', ')}</span></div>
                                                        <div>Total Cars: <span className="font-medium">{getCarCountInWave(config, parsedData)}</span></div>
                                                        <div>Sorting: <span className="font-medium">
                                                            {config.sortBy === 'position' ? 'Finishing Position' :
                                                             config.sortBy === 'bestTime' ? 'Best Overall Time' :
                                                             config.sortBy === 'secondBest' ? 'Second Best Overall Time' :
                                                             config.sortBy === 'pointsTotal' ? 'Total Points' :
                                                             config.sortBy === 'pointsAverage' ? 'Average Points' : config.sortBy}
                                                        </span></div>
                                                        {config.groupByClass && (
                                                            <div>Class Order: <span className="font-medium">{config.classOrder}</span></div>
                                                        )}
                                                        {config.invertOrder && (
                                                            <div className="text-pit-orange font-medium">Order will be inverted</div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>

                        {/* Navigation */}
                        <div className="flex justify-between">
                            <Button variant="outline" onClick={prevStep}>
                                <ChevronLeft className="mr-2 h-4 w-4" />
                                Back
                            </Button>
                            <Button 
                                onClick={nextStep}
                                disabled={waveConfigs.some(config => config.classes.length === 0)}
                                className="bg-racing-red hover:bg-racing-red-dark text-white"
                            >
                                Next: Review Grid
                                <ChevronRight className="ml-2 h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}

                {/* Step 4: Review Grid */}
                {currentStep === 4 && finalGrid.length > 0 && (
                    <div className="space-y-6">
                        <div className="text-center">
                            <h2 className="text-3xl font-bold text-gray-900 mb-2">Review Your Grid</h2>
                            <p className="text-lg text-gray-600">Fine-tune positions with drag & drop or class controls</p>
                        </div>

                        {/* Grid Controls */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Settings className="h-5 w-5 text-track-blue" />
                                    Grid Controls
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex flex-wrap gap-3">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={resetToOriginalGrid}
                                        className="flex items-center gap-2"
                                    >
                                        <RefreshCw className="h-4 w-4" />
                                        Reset to Original
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Grid Display */}
                        <div className="space-y-6">
                            {finalGrid.map((wave, waveIndex) => {
                                const tiedPositions = detectTies(wave.entries, wave.config);
                                
                                return (
                                    <Card key={waveIndex}>
                                        <CardHeader className="bg-gradient-to-r from-primary to-primary-dark text-white">
                                            <CardTitle className="flex items-center justify-between">
                                                <span>Wave {wave.config.waveNumber} - {wave.config.startType.toUpperCase()} Start</span>
                                                <Badge variant="secondary" className="bg-white text-primary">
                                                    {wave.entries.length} cars
                                                </Badge>
                                            </CardTitle>
                                            <CardDescription className="text-gray-100">
                                                {generateWaveDescription(wave.config)}
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="p-0">
                                            <div className="overflow-x-auto">
                                                <table className="w-full">
                                                    <thead className="bg-gray-50">
                                                        <tr>
                                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                                Grid Pos
                                                            </th>
                                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                                Car #
                                                            </th>
                                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                                Driver
                                                            </th>
                                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                                Class
                                                            </th>
                                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                                Best Time
                                                            </th>
                                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                                Stats
                                                            </th>
                                                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                                Controls
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="bg-white divide-y divide-gray-200">
                                                        {wave.entries.map((entry, entryIndex) => {
                                                            const isTied = tiedPositions.has(entryIndex);
                                                            const mergedGroup = mergedClasses.get(waveIndex)?.get(entry.Class);
                                                            
                                                            return (
                                                                <tr 
                                                                    key={entryIndex}
                                                                    className={cn(
                                                                        "hover:bg-gray-50 transition-colors duration-150",
                                                                        draggedOver?.waveIndex === waveIndex && draggedOver?.entryIndex === entryIndex && "bg-blue-50"
                                                                    )}
                                                                    draggable
                                                                    onDragStart={(e) => handleGridDragStart(e, waveIndex, entryIndex)}
                                                                    onDragOver={(e) => handleGridDragOver(e, waveIndex, entryIndex)}
                                                                    onDrop={(e) => handleGridDrop(e, waveIndex, entryIndex)}
                                                                >
                                                                    <td className="px-4 py-4 whitespace-nowrap">
                                                                        <div className="flex items-center">
                                                                            <span className="text-sm font-medium text-gray-900">
                                                                                {entryIndex + 1 + (waveIndex * 10)} {/* Simple position calculation */}
                                                                            </span>
                                                                            {isTied && (
                                                                                <div 
                                                                                    className="ml-2 w-2 h-2 rounded-full bg-caution-yellow"
                                                                                    title="Tied position - drivers have same sorting value"
                                                                                />
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-4 py-4 whitespace-nowrap">
                                                                        <span className="text-sm font-medium text-gray-900">
                                                                            {entry.Number || '?'}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-4 py-4 whitespace-nowrap">
                                                                        <span className="text-sm text-gray-900">
                                                                            {entry.Driver || 'TBD'}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-4 py-4 whitespace-nowrap">
                                                                        <div className="flex items-center">
                                                                            <Badge 
                                                                                variant="secondary"
                                                                                className="bg-track-blue text-white"
                                                                                style={{
                                                                                    backgroundColor: '#4B7BFF',
                                                                                    color: 'white'
                                                                                }}
                                                                            >
                                                                                {entry.Class}
                                                                            </Badge>
                                                                            {mergedGroup && mergedGroup.length > 1 && (
                                                                                <Badge 
                                                                                    variant="outline" 
                                                                                    className="ml-2 text-xs"
                                                                                    title={`Merged from: ${mergedGroup.join(', ')}`}
                                                                                >
                                                                                    Merged
                                                                                </Badge>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-4 py-4 whitespace-nowrap">
                                                                        <span className="text-sm text-gray-900 font-mono">
                                                                            {entry.BestTime || '--:--'}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-4 py-4 whitespace-nowrap">
                                                                        <div className="text-xs text-gray-500">
                                                                            {entry.originalDriver && (
                                                                                <div className="space-y-1">
                                                                                    {entry.originalDriver.totalPoints > 0 && (
                                                                                        <div>Points: {entry.originalDriver.totalPoints}</div>
                                                                                    )}
                                                                                    {entry.originalDriver.bestPosition && (
                                                                                        <div>Best Pos: {entry.originalDriver.bestPosition}</div>
                                                                                    )}
                                                                                    {entry.originalDriver.secondBestOverallTime && (
                                                                                        <div>2nd Best: {entry.originalDriver.secondBestOverallTime.time}</div>
                                                                                    )}
                                                                                    {entry.originalDriver.fileCount > 1 && (
                                                                                        <div>Files: {entry.originalDriver.fileCount}</div>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-4 py-4 whitespace-nowrap text-center">
                                                                        <div className="flex items-center justify-center space-x-1">
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                onClick={() => moveClassUp(waveIndex, entry.Class)}
                                                                                title="Move class up"
                                                                                className="h-8 w-8 p-0"
                                                                            >
                                                                                <img src={minus1Icon} alt="Move up" className="h-4 w-4" />
                                                                            </Button>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                onClick={() => moveClassDown(waveIndex, entry.Class)}
                                                                                title="Move class down"
                                                                                className="h-8 w-8 p-0"
                                                                            >
                                                                                <img src={minus3Icon} alt="Move down" className="h-4 w-4" />
                                                                            </Button>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                onClick={() => mergeClassWithPrevious(waveIndex, entryIndex)}
                                                                                title="Merge with previous class"
                                                                                className="h-8 w-8 p-0"
                                                                            >
                                                                                <img src={mergeIcon} alt="Merge" className="h-4 w-4" />
                                                                            </Button>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                onClick={() => moveToStartOfWave(waveIndex, entryIndex)}
                                                                                title="Move to start of wave"
                                                                                className="h-8 w-8 p-0"
                                                                            >
                                                                                <ChevronUp className="h-4 w-4" />
                                                                            </Button>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                onClick={() => moveToEndOfClass(waveIndex, entryIndex)}
                                                                                title="Move to end of class"
                                                                                className="h-8 w-8 p-0"
                                                                            >
                                                                                <MoveVertical className="h-4 w-4" />
                                                                            </Button>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                onClick={() => moveToEndOfWave(waveIndex, entryIndex)}
                                                                                title="Move to end of wave"
                                                                                className="h-8 w-8 p-0"
                                                                            >
                                                                                <ChevronDown className="h-4 w-4" />
                                                                            </Button>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>

                        {/* Navigation */}
                        <div className="flex justify-between">
                            <Button variant="outline" onClick={prevStep}>
                                <ChevronLeft className="mr-2 h-4 w-4" />
                                Back
                            </Button>
                            <Button 
                                onClick={nextStep}
                                className="bg-racing-red hover:bg-racing-red-dark text-white"
                            >
                                Next: Export Grid
                                <ChevronRight className="ml-2 h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}

                {/* Step 5: Export */}
                {currentStep === 5 && (
                    <div className="space-y-6">
                        <div className="text-center">
                            <h2 className="text-3xl font-bold text-gray-900 mb-2">Export Your Grid</h2>
                            <p className="text-lg text-gray-600">Download your starting grid as PDF or CSV</p>
                        </div>

                        {/* Grid Name */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Grid Information</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div>
                                    <Label htmlFor="grid-name">Grid Name</Label>
                                    <Input
                                        id="grid-name"
                                        value={gridName}
                                        onChange={(e) => setGridName(e.target.value)}
                                        placeholder="Enter grid name (e.g., 'Saturday Practice Grid')"
                                        className="mt-1"
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Export Options */}
                        <div className="grid md:grid-cols-2 gap-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <File className="h-5 w-5 text-racing-red" />
                                        PDF Export
                                    </CardTitle>
                                    <CardDescription>
                                        Professional formatted grid for printing or sharing
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Button 
                                        onClick={() => generatePDF(finalGrid, gridName || 'Starting Grid')}
                                        className="w-full bg-racing-red hover:bg-racing-red-dark text-white"
                                    >
                                        <Download className="mr-2 h-4 w-4" />
                                        Download PDF
                                    </Button>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <FileText className="h-5 w-5 text-track-blue" />
                                        CSV Export
                                    </CardTitle>
                                    <CardDescription>
                                        Spreadsheet format for further editing or import
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Button 
                                        onClick={() => generateCSV(finalGrid, gridName || 'Starting Grid')}
                                        variant="outline"
                                        className="w-full border-track-blue text-track-blue hover:bg-track-blue hover:text-white"
                                    >
                                        <Download className="mr-2 h-4 w-4" />
                                        Download CSV
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Export Statistics */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Export Statistics</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid md:grid-cols-4 gap-4 text-center">
                                    <div>
                                        <div className="text-2xl font-bold text-racing-red">{finalGrid.length}</div>
                                        <div className="text-sm text-gray-600">Total Waves</div>
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-track-blue">
                                            {finalGrid.reduce((sum, wave) => sum + wave.entries.length, 0)}
                                        </div>
                                        <div className="text-sm text-gray-600">Total Cars</div>
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-grid-green">
                                            {availableClasses.length}
                                        </div>
                                        <div className="text-sm text-gray-600">Classes</div>
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-pit-orange">
                                            {uploadedFiles.length}
                                        </div>
                                        <div className="text-sm text-gray-600">Source Files</div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Navigation */}
                        <div className="flex justify-between">
                            <Button variant="outline" onClick={prevStep}>
                                <ChevronLeft className="mr-2 h-4 w-4" />
                                Back to Review
                            </Button>
                            <Button 
                                onClick={startNewGrid}
                                className="bg-grid-green hover:bg-grid-green/90 text-white"
                            >
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Start New Grid
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Export Tips Accordion */}
            {currentStep === 5 && (
                <div className="container mx-auto px-4 pb-8">
                    <Accordion type="single" collapsible>
                        <AccordionItem value="export-tips">
                            <AccordionTrigger 
                                className="hover:no-underline"
                                onClick={() => setShowTips(!showTips)}
                            >
                                <div className="flex items-center gap-2">
                                    <Info className="h-4 w-4 text-track-blue" />
                                    <span>Export Tips & Best Practices</span>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent>
                                <Alert>
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertTitle>Export Recommendations</AlertTitle>
                                    <AlertDescription>
                                        <ul className="list-disc pl-5 space-y-1 mt-2">
                                            <li><strong>PDF Format:</strong> Best for printing and official race documentation</li>
                                            <li><strong>CSV Format:</strong> Use for importing into timing systems or spreadsheet applications</li>
                                            <li><strong>Grid Names:</strong> Include event name, session type, and date for easy identification</li>
                                            <li><strong>Review First:</strong> Always double-check the grid order before final export</li>
                                            <li><strong>Backup Copies:</strong> Keep both PDF and CSV versions for different use cases</li>
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
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </div>
            )}

            {/* Help Modal */}
            <Dialog open={showHelpModal} onOpenChange={setShowHelpModal}>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <img src={racingFlag} alt="Racing Flag" className="h-6 w-6" />
                            Grid Builder Help
                        </DialogTitle>
                        <DialogDescription>
                            Learn how to create professional starting grids for your racing events
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>What is Grid Builder?</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-gray-600">
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
                                        <h4 className="font-medium mb-2">PDF Format</h4>
                                        <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600">
                                            <li>Professional layout for printing</li>
                                            <li>Includes wave descriptions</li>
                                            <li>Perfect for race day documentation</li>
                                            <li>Timestamp and metadata included</li>
                                        </ul>
                                    </div>
                                    <div>
                                        <h4 className="font-medium mb-2">CSV Format</h4>
                                        <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600">
                                            <li>Spreadsheet compatible</li>
                                            <li>Import into timing systems</li>
                                            <li>Easy to modify or analyze</li>
                                            <li>Includes all driver data</li>
                                        </ul>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Alert>
                            <Info className="h-4 w-4" />
                            <AlertTitle>Pro Tips</AlertTitle>
                            <AlertDescription>
                                <ul className="list-disc pl-5 space-y-1 mt-2">
                                    <li><strong>Multiple Files:</strong> Upload practice and qualifying results to get comprehensive driver statistics</li>
                                    <li><strong>Tie Breaking:</strong> Points-based sorting supports cascading tie-breakers for fair grid placement</li>
                                    <li><strong>Class Management:</strong> Use class merge and movement tools to create balanced competitive groups</li>
                                    <li><strong>Wave Strategy:</strong> Flying starts work best for experienced drivers, standing starts for mixed skill levels</li>
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
            
            {/* Version display in bottom-right corner */}
            <div className="fixed bottom-4 right-4 text-xs text-gray-400">
                v0.6.6
            </div>
        </div>
    );
};

export default GridBuilder;