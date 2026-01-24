/**
 * EOSE Timeout Manager
 *
 * Manages progressive EOSE (End of Stored Events) timeout handling to improve
 * perceived performance by rendering content based on fastest relays rather
 * than waiting for N/2 threshold.
 */

export type TEosePreset =
  | 'DISCOVERY'
  | 'CHAT_JOIN'
  | 'PROFILE'
  | 'ZAP_RECEIPTS'
  | 'EXHAUSTIVE'
  | 'DEFAULT'

export type TEoseTimeoutConfig = {
  /** Timeout in ms after first EOSE before emitting initial batch */
  eoseTimeoutMs: number
  /** Maximum wait time in ms before forcing initial batch emission */
  maxWaitMs: number
  /** Minimum number of relays that must report EOSE before starting timeout */
  minRelaysBeforeTimeout: number
}

/**
 * Preset configurations for different use cases
 */
export const EOSE_PRESETS: Record<TEosePreset, TEoseTimeoutConfig> = {
  /** Fast discovery feeds - show content ASAP */
  DISCOVERY: {
    eoseTimeoutMs: 500,
    maxWaitMs: 3000,
    minRelaysBeforeTimeout: 1
  },
  /** Chat/room joins - need quick initial load */
  CHAT_JOIN: {
    eoseTimeoutMs: 300,
    maxWaitMs: 2000,
    minRelaysBeforeTimeout: 1
  },
  /** Profile loading - moderate timeout */
  PROFILE: {
    eoseTimeoutMs: 400,
    maxWaitMs: 2500,
    minRelaysBeforeTimeout: 1
  },
  /** Zap receipts - slightly longer for accuracy */
  ZAP_RECEIPTS: {
    eoseTimeoutMs: 600,
    maxWaitMs: 4000,
    minRelaysBeforeTimeout: 2
  },
  /** Exhaustive search - wait longer for completeness */
  EXHAUSTIVE: {
    eoseTimeoutMs: 1500,
    maxWaitMs: 10000,
    minRelaysBeforeTimeout: 3
  },
  /** Default balanced preset */
  DEFAULT: {
    eoseTimeoutMs: 800,
    maxWaitMs: 5000,
    minRelaysBeforeTimeout: 1
  }
}

export type TQueryState = {
  /** Subscription key for tracking */
  key: string
  /** Total number of sub-requests */
  totalRequests: number
  /** Number of relays that have reported EOSE */
  eosedCount: number
  /** Whether initial batch has been emitted */
  initialBatchEmitted: boolean
  /** Whether all relays have completed */
  allComplete: boolean
  /** Timestamp when first EOSE was received */
  firstEoseTime: number | null
  /** Timestamp when subscription started */
  startTime: number
  /** Timer handle for EOSE timeout */
  eoseTimeoutHandle: ReturnType<typeof setTimeout> | null
  /** Timer handle for max wait timeout */
  maxWaitTimeoutHandle: ReturnType<typeof setTimeout> | null
}

export type TQueryMetrics = {
  key: string
  startTime: number
  firstEoseTime: number | null
  initialBatchTime: number | null
  allCompleteTime: number | null
  totalRequests: number
  eosedCount: number
  preset: TEosePreset
}

class EoseTimeoutManager {
  private static instance: EoseTimeoutManager
  private queries: Map<string, TQueryState> = new Map()
  private metrics: TQueryMetrics[] = []
  private maxMetricsHistory = 100

  private constructor() {}

  public static getInstance(): EoseTimeoutManager {
    if (!EoseTimeoutManager.instance) {
      EoseTimeoutManager.instance = new EoseTimeoutManager()
    }
    return EoseTimeoutManager.instance
  }

  /**
   * Get configuration for a preset
   */
  getPresetConfig(preset: TEosePreset): TEoseTimeoutConfig {
    return EOSE_PRESETS[preset]
  }

  /**
   * Initialize tracking for a new query
   */
  initQuery(key: string, totalRequests: number): TQueryState {
    const state: TQueryState = {
      key,
      totalRequests,
      eosedCount: 0,
      initialBatchEmitted: false,
      allComplete: false,
      firstEoseTime: null,
      startTime: Date.now(),
      eoseTimeoutHandle: null,
      maxWaitTimeoutHandle: null
    }
    this.queries.set(key, state)
    return state
  }

  /**
   * Get current state for a query
   */
  getQueryState(key: string): TQueryState | undefined {
    return this.queries.get(key)
  }

  /**
   * Record an EOSE event from a relay
   */
  recordEose(key: string): TQueryState | undefined {
    const state = this.queries.get(key)
    if (!state) return undefined

    state.eosedCount++

    if (state.firstEoseTime === null) {
      state.firstEoseTime = Date.now()
    }

    if (state.eosedCount >= state.totalRequests) {
      state.allComplete = true
      this.clearTimeouts(key)
    }

    return state
  }

  /**
   * Mark initial batch as emitted
   */
  markInitialBatchEmitted(key: string): void {
    const state = this.queries.get(key)
    if (state) {
      state.initialBatchEmitted = true
      this.clearTimeouts(key)
    }
  }

  /**
   * Set EOSE timeout callback
   */
  setEoseTimeout(
    key: string,
    config: TEoseTimeoutConfig,
    callback: () => void
  ): void {
    const state = this.queries.get(key)
    if (!state) return

    // Clear existing timeout
    if (state.eoseTimeoutHandle) {
      clearTimeout(state.eoseTimeoutHandle)
    }

    state.eoseTimeoutHandle = setTimeout(() => {
      if (!state.initialBatchEmitted) {
        callback()
      }
    }, config.eoseTimeoutMs)
  }

  /**
   * Set max wait timeout callback
   */
  setMaxWaitTimeout(
    key: string,
    config: TEoseTimeoutConfig,
    callback: () => void
  ): void {
    const state = this.queries.get(key)
    if (!state) return

    // Clear existing timeout
    if (state.maxWaitTimeoutHandle) {
      clearTimeout(state.maxWaitTimeoutHandle)
    }

    state.maxWaitTimeoutHandle = setTimeout(() => {
      if (!state.initialBatchEmitted) {
        callback()
      }
    }, config.maxWaitMs)
  }

  /**
   * Check if we should emit initial batch based on EOSE count and config
   */
  shouldEmitInitialBatch(key: string, config: TEoseTimeoutConfig): boolean {
    const state = this.queries.get(key)
    if (!state) return false

    // Already emitted
    if (state.initialBatchEmitted) return false

    // All complete
    if (state.allComplete) return true

    // Minimum relays have reported EOSE
    return state.eosedCount >= config.minRelaysBeforeTimeout
  }

  /**
   * Clear all timeouts for a query
   */
  clearTimeouts(key: string): void {
    const state = this.queries.get(key)
    if (!state) return

    if (state.eoseTimeoutHandle) {
      clearTimeout(state.eoseTimeoutHandle)
      state.eoseTimeoutHandle = null
    }

    if (state.maxWaitTimeoutHandle) {
      clearTimeout(state.maxWaitTimeoutHandle)
      state.maxWaitTimeoutHandle = null
    }
  }

  /**
   * Clean up query state
   */
  cleanupQuery(key: string, preset: TEosePreset = 'DEFAULT'): void {
    const state = this.queries.get(key)
    if (state) {
      // Record metrics before cleanup
      this.recordMetrics(state, preset)
      this.clearTimeouts(key)
    }
    this.queries.delete(key)
  }

  /**
   * Record metrics for a query
   */
  private recordMetrics(state: TQueryState, preset: TEosePreset): void {
    const metrics: TQueryMetrics = {
      key: state.key,
      startTime: state.startTime,
      firstEoseTime: state.firstEoseTime,
      initialBatchTime: state.initialBatchEmitted ? Date.now() : null,
      allCompleteTime: state.allComplete ? Date.now() : null,
      totalRequests: state.totalRequests,
      eosedCount: state.eosedCount,
      preset
    }

    this.metrics.push(metrics)

    // Limit history size
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics.shift()
    }
  }

  /**
   * Get metrics summary for debugging/analysis
   */
  getMetricsSummary(): {
    avgTimeToFirstEose: number
    avgTimeToInitialBatch: number
    avgTimeToComplete: number
    queryCount: number
    byPreset: Record<TEosePreset, { count: number; avgInitialBatchTime: number }>
  } {
    const completed = this.metrics.filter((m) => m.initialBatchTime !== null)
    const byPreset: Record<TEosePreset, { count: number; totalTime: number }> = {
      DISCOVERY: { count: 0, totalTime: 0 },
      CHAT_JOIN: { count: 0, totalTime: 0 },
      PROFILE: { count: 0, totalTime: 0 },
      ZAP_RECEIPTS: { count: 0, totalTime: 0 },
      EXHAUSTIVE: { count: 0, totalTime: 0 },
      DEFAULT: { count: 0, totalTime: 0 }
    }

    let totalFirstEose = 0
    let totalInitialBatch = 0
    let totalComplete = 0
    let firstEoseCount = 0
    let initialBatchCount = 0
    let completeCount = 0

    for (const m of this.metrics) {
      if (m.firstEoseTime) {
        totalFirstEose += m.firstEoseTime - m.startTime
        firstEoseCount++
      }
      if (m.initialBatchTime) {
        totalInitialBatch += m.initialBatchTime - m.startTime
        initialBatchCount++
        byPreset[m.preset].count++
        byPreset[m.preset].totalTime += m.initialBatchTime - m.startTime
      }
      if (m.allCompleteTime) {
        totalComplete += m.allCompleteTime - m.startTime
        completeCount++
      }
    }

    const presetSummary = Object.fromEntries(
      Object.entries(byPreset).map(([preset, data]) => [
        preset,
        {
          count: data.count,
          avgInitialBatchTime: data.count > 0 ? data.totalTime / data.count : 0
        }
      ])
    ) as Record<TEosePreset, { count: number; avgInitialBatchTime: number }>

    return {
      avgTimeToFirstEose: firstEoseCount > 0 ? totalFirstEose / firstEoseCount : 0,
      avgTimeToInitialBatch:
        initialBatchCount > 0 ? totalInitialBatch / initialBatchCount : 0,
      avgTimeToComplete: completeCount > 0 ? totalComplete / completeCount : 0,
      queryCount: this.metrics.length,
      byPreset: presetSummary
    }
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics = []
  }
}

const eoseTimeoutManager = EoseTimeoutManager.getInstance()
export default eoseTimeoutManager
