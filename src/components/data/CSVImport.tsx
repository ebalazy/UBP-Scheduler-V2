import React, { useState, useCallback } from 'react';
import { parseYMS, isYMSFormat } from '../../utils/parsers/ymsParser';
import { parseMES, isMESFormat } from '../../utils/parsers/mesParser';
import { importInboundReceipts, importProductionActuals } from '../../services/supabase/imports';
import Papa from 'papaparse';

type ImportType = 'yms' | 'mes' | 'unknown';

interface PreviewData {
    type: ImportType;
    rows: any[];
    errors: string[];
    totalRows: number;
    importedCount?: number;
    skippedCount?: number;
}

export default function CSVImport() {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<PreviewData | null>(null);
    const [importing, setImporting] = useState(false);
    const [imported, setImported] = useState(false);
    const [dragActive, setDragActive] = useState(false);

    // Handle drag events
    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    }, []);

    // Handle drop
    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    }, []);

    // Handle file selection
    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0]);
        }
    };

    // Process uploaded file
    const handleFile = async (file: File) => {
        if (!file.name.endsWith('.csv')) {
            alert('Please upload a CSV file');
            return;
        }

        setFile(file);
        setImported(false);

        // Read file content
        const text = await file.text();

        // Parse headers to detect type
        Papa.parse(text, {
            header: true,
            preview: 1,
            complete: (results) => {
                const headers = results.meta.fields || [];

                // Detect file type
                if (isYMSFormat(headers)) {
                    const parsed = parseYMS(text);
                    setPreview({
                        type: 'yms',
                        rows: parsed.data.slice(0, 5), // Preview first 5
                        errors: parsed.errors,
                        totalRows: parsed.totalRows,
                        skippedCount: parsed.skipped,
                    });
                } else if (isMESFormat(headers)) {
                    const parsed = parseMES(text);
                    setPreview({
                        type: 'mes',
                        rows: parsed.data.slice(0, 5), // Preview first 5
                        errors: parsed.errors,
                        totalRows: parsed.totalRows,
                    });
                } else {
                    setPreview({
                        type: 'unknown',
                        rows: [],
                        errors: ['File format not recognized. Expected YMS or MES export.'],
                        totalRows: 0,
                    });
                }
            },
        });
    };

    // Import data to Supabase
    const handleImport = async () => {
        if (!file || !preview) return;

        setImporting(true);

        try {
            const text = await file.text();

            if (preview.type === 'yms') {
                const parsed = parseYMS(text);
                if (!parsed.success) {
                    alert('Failed to parse YMS file: ' + parsed.errors.join(', '));
                    return;
                }

                const result = await importInboundReceipts(parsed.data);

                setPreview(prev => prev ? {
                    ...prev,
                    importedCount: result.imported,
                    skippedCount: result.skipped,
                } : null);

                setImported(true);

                if (result.errors.length > 0) {
                    alert(`Import completed with errors:\n${result.errors.join('\n')}`);
                }
            } else if (preview.type === 'mes') {
                const parsed = parseMES(text);
                if (!parsed.success) {
                    alert('Failed to parse MES file: ' + parsed.errors.join(', '));
                    return;
                }

                const result = await importProductionActuals(parsed.data);

                setPreview(prev => prev ? {
                    ...prev,
                    importedCount: result.imported,
                    skippedCount: result.skipped,
                } : null);

                setImported(true);

                if (result.errors.length > 0) {
                    alert(`Import completed with errors:\n${result.errors.join('\n')}`);
                }
            }
        } catch (error) {
            alert(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setImporting(false);
        }
    };

    // Reset
    const handleReset = () => {
        setFile(null);
        setPreview(null);
        setImported(false);
    };

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <div className="bg-white rounded-lg shadow-lg p-6">
                <h2 className="text-2xl font-bold mb-4">📥 Import YMS / MES Data</h2>

                {!file && (
                    <div
                        className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
                            }`}
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                    >
                        <div className="text-6xl mb-4">📄</div>
                        <p className="text-lg mb-4">Drag & drop CSV file here or click to browse</p>
                        <input
                            type="file"
                            accept=".csv"
                            onChange={handleFileInput}
                            className="hidden"
                            id="file-upload"
                        />
                        <label
                            htmlFor="file-upload"
                            className="bg-blue-600 text-white px-6 py-2 rounded cursor-pointer hover:bg-blue-700"
                        >
                            Browse Files
                        </label>
                        <p className="text-sm text-gray-500 mt-4">
                            Supported: YMS Hub exports, MES production exports
                        </p>
                    </div>
                )}

                {preview && (
                    <div className="mt-6">
                        {/* Detection status */}
                        <div className={`p-4 rounded mb-4 ${preview.type === 'unknown' ? 'bg-red-100' : 'bg-green-100'
                            }`}>
                            {preview.type === 'yms' && `✓ Detected: YMS Export (${preview.totalRows} rows)`}
                            {preview.type === 'mes' && `✓ Detected: MES Export (${preview.totalRows} rows)`}
                            {preview.type === 'unknown' && '✗ Format not recognized'}
                        </div>

                        {/* Errors */}
                        {preview.errors.length > 0 && (
                            <div className="bg-yellow-50 border border-yellow-200 rounded p-4 mb-4">
                                <h3 className="font-bold text-yellow-900 mb-2">⚠️ Warnings:</h3>
                                <ul className="list-disc list-inside text-sm text-yellow-800">
                                    {preview.errors.slice(0, 10).map((error, i) => (
                                        <li key={i}>{error}</li>
                                    ))}
                                    {preview.errors.length > 10 && (
                                        <li>... and {preview.errors.length - 10} more</li>
                                    )}
                                </ul>
                            </div>
                        )}

                        {/* Preview table */}
                        {preview.rows.length > 0 && (
                            <div className="mb-4">
                                <h3 className="font-bold mb-2">Preview (first 5 rows):</h3>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                {Object.keys(preview.rows[0]).map((key) => (
                                                    <th key={key} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                                        {key}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {preview.rows.map((row, i) => (
                                                <tr key={i}>
                                                    {Object.values(row).map((value: any, j) => (
                                                        <td key={j} className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                                                            {String(value)}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Summary */}
                        {!imported && preview.type !== 'unknown' && (
                            <div className="bg-blue-50 rounded p-4 mb-4">
                                <h3 className="font-bold mb-2">Summary:</h3>
                                <ul className="text-sm">
                                    <li>• Total rows: {preview.totalRows}</li>
                                    {preview.skippedCount !== undefined && (
                                        <li>• Rows to skip: {preview.skippedCount} (not checked in)</li>
                                    )}
                                    <li>• Rows to import: {preview.totalRows - (preview.skippedCount || 0)}</li>
                                </ul>
                            </div>
                        )}

                        {/* Import result */}
                        {imported && (
                            <div className="bg-green-50 rounded p-4 mb-4">
                                <h3 className="font-bold text-green-900 mb-2">✓ Import Complete!</h3>
                                <ul className="text-sm text-green-800">
                                    <li>• Imported: {preview.importedCount}</li>
                                    <li>• Skipped (duplicates): {preview.skippedCount}</li>
                                </ul>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-4">
                            <button
                                onClick={handleReset}
                                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                            >
                                {imported ? 'Import Another File' : 'Cancel'}
                            </button>
                            {!imported && preview.type !== 'unknown' && (
                                <button
                                    onClick={handleImport}
                                    disabled={importing}
                                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
                                >
                                    {importing ? 'Importing...' : `Import ${preview.totalRows - (preview.skippedCount || 0)} Rows`}
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
