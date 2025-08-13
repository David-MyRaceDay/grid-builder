/**
 * Export Utilities for Grid Builder
 * Handles PDF generation and CSV export functionality
 */

import jsPDF from 'jspdf';

/**
 * Generates a wave description string for display (UI only)
 * @param {Object} config - Wave configuration object
 * @returns {string} Formatted description string
 */
export const generateWaveDescription = (config) => {
    const descriptions = [];
    
    const sortLabels = {
        'position': 'Finishing Position',
        'bestTime': 'Best Overall Time',
        'secondBest': 'Second Best Overall Time',
        'pointsTotal': 'Total Points',
        'pointsAverage': 'Average Points',
        'bestSecondBest': 'Best Second-Best Time'
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

/**
 * Generates a simple wave description for PDF export (no sorting details)
 * @param {Object} config - Wave configuration object
 * @returns {string} Simple description string for PDF
 */
export const generatePDFWaveDescription = (config) => {
    const descriptions = [];
    
    if (config.classes && config.classes.length > 0) {
        descriptions.push(`Classes: ${config.classes.join(', ')}`);
    }
    
    return descriptions.join(' • ');
};

/**
 * Generates a PDF file of the starting grid
 * @param {Array} finalGrid - Array of wave objects with entries
 * @param {string} gridName - Name of the grid for the title
 * @returns {void} Downloads PDF file
 */
export const generatePDF = (finalGrid, gridName) => {
    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(20);
    doc.text(gridName || 'Starting Grid', 20, 30);
    
    let yPosition = 50;
    let currentPosition = 1;
    
    finalGrid.forEach((wave, waveIndex) => {
        // Wave header
        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        const waveTitle = `Wave ${waveIndex + 1} - ${wave.config.startType.toUpperCase()} Start`;
        doc.text(waveTitle, 20, yPosition);
        yPosition += 10;
        
        // Wave description (simplified for PDF)
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        const description = generatePDFWaveDescription(wave.config);
        if (description) {
            doc.text(description, 20, yPosition);
            yPosition += 15;
        } else {
            yPosition += 5; // Less space when no description
        }
        
        // Table headers with improved spacing
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text('Pos', 20, yPosition);
        doc.text('No.', 50, yPosition);
        doc.text('Driver', 80, yPosition);
        doc.text('Class', 140, yPosition);
        doc.text('Best Time', 170, yPosition);
        yPosition += 5;
        
        // Draw header line
        doc.line(20, yPosition, 200, yPosition);
        yPosition += 5;
        
        // Entries
        doc.setFont(undefined, 'normal');
        wave.entries.forEach((entry) => {
            // Check if we need a new page
            if (yPosition > 270) {
                doc.addPage();
                yPosition = 30;
            }
            
            if (entry.isEmpty) {
                doc.setFont(undefined, 'italic');
                doc.text('--', 20, yPosition);
                doc.text('Empty Position', 80, yPosition);
                doc.setFont(undefined, 'normal');
            } else {
                doc.text(currentPosition.toString(), 20, yPosition);
                doc.text(entry.Number || '', 50, yPosition);
                doc.text(entry.Driver || '', 80, yPosition);
                doc.text(entry.Class || '', 140, yPosition);
                doc.text(entry.BestTime || '', 170, yPosition);
            }
            
            yPosition += 8;
            currentPosition++;
        });
        
        // Empty positions after wave
        for (let i = 0; i < (wave.emptyPositions || 0); i++) {
            if (yPosition > 270) {
                doc.addPage();
                yPosition = 30;
            }
            
            doc.setFont(undefined, 'italic');
            doc.text('--', 20, yPosition);
            doc.text('Empty Position', 80, yPosition);
            doc.setFont(undefined, 'normal');
            yPosition += 8;
            currentPosition++;
        }
        
        yPosition += 10; // Space between waves
    });
    
    // Footer with generation info
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont(undefined, 'normal');
        doc.text(`Generated by My Race Day Grid Builder - Page ${i} of ${pageCount}`, 20, 285);
        doc.text(`Generated on ${new Date().toLocaleString()}`, 120, 285);
    }
    
    // Download the PDF
    const fileName = `${gridName || 'starting-grid'}.pdf`;
    doc.save(fileName);
};

/**
 * Generates a CSV file of the starting grid
 * @param {Array} finalGrid - Array of wave objects with entries
 * @param {string} gridName - Name of the grid for the filename
 * @returns {void} Downloads CSV file
 */
export const generateCSV = (finalGrid, gridName) => {
    const csvData = [];
    let currentPosition = 1;
    
    // Headers
    csvData.push(['Position', 'Wave', 'Number', 'Driver', 'Class', 'Best Time', 'Start Type', 'Wave Description']);
    
    finalGrid.forEach((wave, waveIndex) => {
        const waveDescription = generatePDFWaveDescription(wave.config);
        
        // Add entries
        wave.entries.forEach((entry) => {
            if (entry.isEmpty) {
                csvData.push([
                    currentPosition,
                    waveIndex + 1,
                    '',
                    'EMPTY POSITION',
                    '',
                    '',
                    wave.config.startType.toUpperCase(),
                    waveDescription
                ]);
            } else {
                csvData.push([
                    currentPosition,
                    waveIndex + 1,
                    entry.Number || '',
                    entry.Driver || '',
                    entry.Class || '',
                    entry.BestTime || '',
                    wave.config.startType.toUpperCase(),
                    waveDescription
                ]);
            }
            currentPosition++;
        });
        
        // Add empty positions after wave
        for (let i = 0; i < (wave.emptyPositions || 0); i++) {
            csvData.push([
                currentPosition,
                waveIndex + 1,
                '',
                'EMPTY POSITION',
                '',
                '',
                wave.config.startType.toUpperCase(),
                waveDescription
            ]);
            currentPosition++;
        }
    });
    
    // Convert to CSV string
    const csvContent = csvData.map(row => 
        row.map(field => {
            // Escape quotes and wrap in quotes if needed
            const fieldStr = String(field || '');
            if (fieldStr.includes(',') || fieldStr.includes('"') || fieldStr.includes('\n')) {
                return `"${fieldStr.replace(/"/g, '""')}"`;
            }
            return fieldStr;
        }).join(',')
    ).join('\n');
    
    // Download the CSV
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${gridName || 'starting-grid'}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

/**
 * Validates grid data before export
 * @param {Array} finalGrid - Array of wave objects with entries
 * @param {string} gridName - Name of the grid
 * @returns {Object} Validation result with isValid flag and errors
 */
export const validateGridForExport = (finalGrid, gridName) => {
    const errors = [];
    
    // Check if grid exists and has content
    if (!finalGrid || finalGrid.length === 0) {
        errors.push('No grid data to export');
        return { isValid: false, errors };
    }
    
    // Check if grid name is provided
    if (!gridName || gridName.trim() === '') {
        errors.push('Grid name is required for export');
    }
    
    // Check if any wave has entries
    const hasEntries = finalGrid.some(wave => 
        wave.entries && wave.entries.length > 0
    );
    
    if (!hasEntries) {
        errors.push('Grid contains no entries to export');
    }
    
    // Check for waves with no assigned classes
    const emptyWaves = finalGrid.filter((wave, index) => 
        !wave.entries || wave.entries.length === 0
    );
    
    if (emptyWaves.length > 0) {
        errors.push(`${emptyWaves.length} wave(s) have no assigned drivers`);
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors
    };
};

/**
 * Generates export statistics for display
 * @param {Array} finalGrid - Array of wave objects with entries
 * @returns {Object} Statistics object with counts and summaries
 */
export const generateExportStats = (finalGrid) => {
    let totalDrivers = 0;
    let totalEmptyPositions = 0;
    let totalWaves = finalGrid.length;
    const classCounts = new Map();
    const startTypes = new Map();
    
    finalGrid.forEach(wave => {
        // Count start types
        const startType = wave.config.startType;
        startTypes.set(startType, (startTypes.get(startType) || 0) + 1);
        
        // Count drivers and empty positions
        wave.entries.forEach(entry => {
            if (entry.isEmpty) {
                totalEmptyPositions++;
            } else {
                totalDrivers++;
                // Count classes
                if (entry.Class) {
                    classCounts.set(entry.Class, (classCounts.get(entry.Class) || 0) + 1);
                }
            }
        });
        
        // Add empty positions after wave
        totalEmptyPositions += wave.emptyPositions || 0;
    });
    
    return {
        totalDrivers,
        totalEmptyPositions,
        totalWaves,
        totalPositions: totalDrivers + totalEmptyPositions,
        classCounts: Object.fromEntries(classCounts),
        startTypes: Object.fromEntries(startTypes),
        uniqueClasses: classCounts.size
    };
};