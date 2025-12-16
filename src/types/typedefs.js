/**
 * @typedef {Object} Product
 * @property {string} id - UUID
 * @property {string} user_id - Owner UUID
 * @property {string} name - SKU Name
 * @property {number} bottles_per_case
 * @property {number} bottles_per_truck
 * @property {number} cases_per_pallet
 * @property {string} [created_at]
 */

/**
 * @typedef {Object} PlanningEntry
 * @property {string} id
 * @property {string} product_id
 * @property {string} date - YYYY-MM-DD
 * @property {'demand_plan' | 'inbound_trucks' | 'production_actual'} entry_type
 * @property {number} value
 * @property {Object} [meta_json]
 */

/**
 * @typedef {Object} ProductionSettings
 * @property {string} id
 * @property {string} product_id
 * @property {number} production_rate - Bottles per hour
 * @property {number} downtime_hours
 * @property {boolean} is_auto_replenish
 */

/**
 * @typedef {Object} MRPState
 * @property {Product} product
 * @property {Object.<string, number>} monthlyDemand
 * @property {Object.<string, number>} monthlyInbound
 * @property {Object.<string, number>} monthlyProductionActuals
 * @property {number} productionRate
 * @property {number} downtimeHours
 * @property {boolean} isAutoReplenish
 * @property {{date: string, count: number}|null} inventoryAnchor
 * @property {{date: string|null, count: number}} yardInventory
 */
