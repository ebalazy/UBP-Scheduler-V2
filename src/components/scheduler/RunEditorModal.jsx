import React, { useState, useEffect } from 'react';
import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { PRODUCTION_LINES } from '../../utils/schedulerLogic';
import { useProducts } from '../../context/ProductsContext';

export default function RunEditorModal({ isOpen, onClose, onSave, initialRun = null, selectedDate }) {
    const { productMap } = useProducts();

    // Get list of SKUs from ProductsContext
    const skuList = Object.keys(productMap);
    const defaultSku = skuList[0] || '20oz';

    const [formData, setFormData] = useState({
        sku: defaultSku,
        lineId: 'L1',
        startTime: '08:00',
        durationHours: 8,
        targetCases: 10000
    });

    useEffect(() => {
        if (isOpen) {
            if (initialRun) {
                const date = new Date(initialRun.startTime);
                const timeStr = date.toTimeString().slice(0, 5);
                setFormData({
                    sku: initialRun.sku,
                    lineId: initialRun.lineId,
                    startTime: timeStr,
                    durationHours: initialRun.durationHours,
                    targetCases: initialRun.targetCases
                });
            } else {
                // Reset for new run
                setFormData({
                    sku: defaultSku,
                    lineId: 'L1',
                    startTime: '08:00',
                    durationHours: 8,
                    targetCases: 10000
                });
            }
        }
    }, [isOpen, initialRun, defaultSku]);

    const handleSubmit = (e) => {
        e.preventDefault();

        // Construct ISO String for Start Time
        const [h, m] = formData.startTime.split(':').map(Number);
        const startDateTime = new Date(selectedDate);
        startDateTime.setHours(h, m, 0, 0);

        const newRun = {
            id: initialRun ? initialRun.id : `run-${Date.now()}`,
            ...formData,
            startTime: startDateTime.toISOString(),
            // Color is now applied at render time via ProductsContext (not stored on run)
            status: 'planned'
        };

        onSave(newRun);
        onClose();
    };

    return (
        <Transition.Root show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
                </Transition.Child>

                <div className="fixed inset-0 z-10 overflow-y-auto">
                    <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                            enterTo="opacity-100 translate-y-0 sm:scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                            leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                        >
                            <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 px-4 pt-5 pb-4 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">

                                <div className="absolute top-0 right-0 hidden pt-4 pr-4 sm:block">
                                    <button
                                        type="button"
                                        className="rounded-md bg-white dark:bg-gray-800 text-gray-400 hover:text-gray-500 focus:outline-none"
                                        onClick={onClose}
                                    >
                                        <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                                    </button>
                                </div>

                                <div className="sm:flex sm:items-start">
                                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                                        <Dialog.Title as="h3" className="text-xl font-bold leading-6 text-gray-900 dark:text-white mb-6">
                                            {initialRun ? 'Edit Production Run' : 'Schedule New Run'}
                                        </Dialog.Title>

                                        <form onSubmit={handleSubmit} className="space-y-4">

                                            {/* Line Selection */}
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Production Line</label>
                                                <select
                                                    value={formData.lineId}
                                                    onChange={e => setFormData({ ...formData, lineId: e.target.value })}
                                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-900 dark:border-gray-600 dark:text-white sm:text-sm"
                                                >
                                                    {PRODUCTION_LINES.map(line => (
                                                        <option key={line.id} value={line.id}>{line.name}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            {/* SKU Selection */}
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Product (SKU)</label>
                                                <div className="grid grid-cols-2 gap-2 mt-1">
                                                    {skuList.map(sku => (
                                                        <div
                                                            key={sku}
                                                            onClick={() => setFormData({ ...formData, sku: sku })}
                                                            className={`cursor-pointer p-2 rounded-md border text-center text-sm font-bold transition-all ${formData.sku === sku
                                                                ? 'ring-2 ring-indigo-500 border-transparent bg-indigo-50 text-indigo-700'
                                                                : 'border-gray-200 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 dark:text-gray-200'
                                                                }`}
                                                        >
                                                            {sku}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Time & Duration */}
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Start Time</label>
                                                    <input
                                                        type="time"
                                                        value={formData.startTime}
                                                        onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-900 dark:border-gray-600 dark:text-white sm:text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Duration (Hrs)</label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max="24"
                                                        value={formData.durationHours}
                                                        onChange={e => setFormData({ ...formData, durationHours: Number(e.target.value) })}
                                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-900 dark:border-gray-600 dark:text-white sm:text-sm"
                                                    />
                                                </div>
                                            </div>

                                            {/* Quantity */}
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Target Quantity (Cases)</label>
                                                <input
                                                    type="number"
                                                    value={formData.targetCases}
                                                    onChange={e => setFormData({ ...formData, targetCases: Number(e.target.value) })}
                                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-900 dark:border-gray-600 dark:text-white sm:text-sm"
                                                />
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                                                <button
                                                    type="submit"
                                                    className="inline-flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:col-start-2 sm:text-sm"
                                                >
                                                    {initialRun ? 'Update Run' : 'Schedule Run'}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-base font-medium text-gray-700 dark:text-gray-200 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:col-start-1 sm:mt-0 sm:text-sm"
                                                    onClick={onClose}
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </form>
                                    </div>
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition.Root>
    );
}
