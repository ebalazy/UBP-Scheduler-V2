import { useState, useCallback } from 'react';
import Papa from 'papaparse';
import { ArrowDownTrayIcon, DocumentTextIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useSettings } from '../../context/SettingsContext';

export default function CsvDropZone({ onUpdateInventory, currentSku }) {
    const { csvMapping } = useSettings();
    const [isDragging, setIsDragging] = useState(false);
    const [uploadStatus, setUploadStatus] = useState('idle'); // idle, processing, success, error
    const [message, setMessage] = useState('');

    const handleDragEnter = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const processFile = useCallback((file) => {
        setUploadStatus('processing');
        setMessage('Parsing CSV...');

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                try {
                    const data = results.data;
                    const { statusColumn, fullValue, skuColumn } = csvMapping;

                    if (!data || data.length === 0) {
                        throw new Error("CSV file is empty or could not be parsed.");
                    }

                    // Flexible search: Case insensitive, trim whitespace
                    const normalize = (str) => String(str || '').toLowerCase().trim();
                    const targetStatus = normalize(fullValue);
                    const targetSku = normalize(currentSku); // e.g., '20oz'

                    // Debug finding columns if not exact match (optional enhancement? keeping simple for now based on settings)

                    let count = 0;
                    let foundRows = 0;

                    const validRows = data.filter(row => {
                        // Check if column exists
                        if (!row.hasOwnProperty(statusColumn)) return false;

                        const rowStatus = normalize(row[statusColumn]);
                        // Just counting "Full" status first, then applying SKU filter if column exists
                        const isFull = rowStatus === targetStatus || rowStatus.includes(targetStatus); // loose match? Plan said "Full"

                        if (isFull) {
                            if (skuColumn && row[skuColumn]) {
                                const rowSku = normalize(row[skuColumn]);
                                // Simple substring match for SKU (e.g. "20oz Coke" matches "20oz")
                                return rowSku.includes(targetSku);
                            }
                            // If no SKU column mapped or data missing, count it? 
                            // Better to be safe: if user mapped SKU column, use it. if not, count all full.
                            return true;
                        }
                        return false;
                    });

                    count = validRows.length;

                    onUpdateInventory({
                        count: count,
                        timestamp: new Date().toISOString(),
                        fileName: file.name
                    });

                    setUploadStatus('success');
                    setMessage(`Found ${count} Full Trailers matching "${currentSku}"`);

                    // Reset status after 3 seconds
                    setTimeout(() => {
                        setUploadStatus('idle');
                        setMessage('');
                    }, 5000);

                } catch (err) {
                    console.error("CSV Processing Error", err);
                    setUploadStatus('error');
                    setMessage(err.message || "Failed to process CSV.");
                }
            },
            error: (err) => {
                setUploadStatus('error');
                setMessage("Failed to read file: " + err.message);
            }
        });
    }, [csvMapping, currentSku, onUpdateInventory]);

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            const file = files[0];
            if (file.type === "text/csv" || file.name.endsWith('.csv')) {
                processFile(file);
            } else {
                setUploadStatus('error');
                setMessage("Please upload a Valid CSV file.");
            }
        }
    };

    // Click to upload support
    const handleFileSelect = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            processFile(e.target.files[0]);
        }
    };

    return (
        <div
            className={`
                relative border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200 cursor-pointer
                ${isDragging ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-gray-50 dark:hover:bg-gray-700'}
                ${uploadStatus === 'error' ? 'border-red-300 dark:border-red-500/50 bg-red-50 dark:bg-red-900/20' : ''}
                ${uploadStatus === 'success' ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : ''}
            `}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => document.getElementById('csv-upload-input').click()}
        >
            <input
                id="csv-upload-input"
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileSelect}
            />

            <div className="flex flex-col items-center justify-center space-y-2">
                {uploadStatus === 'idle' && (
                    <>
                        <ArrowDownTrayIcon className="h-10 w-10 text-gray-400" />
                        <p className="text-sm text-gray-600 font-medium">Drop YMS Hub Report Here</p>
                        <p className="text-xs text-gray-500">or click to upload CSV</p>
                    </>
                )}

                {uploadStatus === 'processing' && (
                    <>
                        <DocumentTextIcon className="h-10 w-10 text-blue-500 animate-pulse" />
                        <p className="text-sm text-blue-600 font-medium">Processing Report...</p>
                    </>
                )}

                {uploadStatus === 'success' && (
                    <>
                        <CheckCircleIcon className="h-10 w-10 text-green-500" />
                        <p className="text-sm text-green-700 font-bold">Success!</p>
                        <p className="text-xs text-green-600">{message}</p>
                    </>
                )}

                {uploadStatus === 'error' && (
                    <>
                        <ExclamationTriangleIcon className="h-10 w-10 text-red-500" />
                        <p className="text-sm text-red-600 font-medium">Error</p>
                        <p className="text-xs text-red-500">{message}</p>
                    </>
                )}
            </div>
        </div>
    );
}
