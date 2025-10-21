/**
 * Network Status Hook
 *
 * Detects and tracks network connectivity status.
 *
 * Features:
 * - Online/offline detection
 * - Connection quality indicator (via Network Information API)
 * - Slow network detection
 * - Connection type detection (wifi, cellular, etc.)
 * - Effective bandwidth estimation
 */

import { useState, useEffect, useCallback } from 'react'
import { addBreadcrumb } from '@/lib/errorLogger'

/**
 * Connection quality levels
 */
export type ConnectionQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'offline'

/**
 * Connection type from Network Information API
 */
export type ConnectionType =
  | 'slow-2g'
  | '2g'
  | '3g'
  | '4g'
  | '5g'
  | 'wifi'
  | 'ethernet'
  | 'bluetooth'
  | 'wimax'
  | 'cellular'
  | 'unknown'

/**
 * Network status information
 */
export interface NetworkStatus {
  /** Is the device online */
  isOnline: boolean
  /** Connection quality indicator */
  quality: ConnectionQuality
  /** Connection type (if available) */
  connectionType?: ConnectionType
  /** Effective bandwidth in Mbps (if available) */
  effectiveBandwidth?: number
  /** Round-trip time in ms (if available) */
  rtt?: number
  /** Is data saver mode enabled (if available) */
  saveData?: boolean
  /** Timestamp of last status change */
  lastChanged: number
}

/**
 * Network Information API interface
 * https://developer.mozilla.org/en-US/docs/Web/API/Network_Information_API
 */
interface NetworkInformation extends EventTarget {
  readonly downlink: number // Effective bandwidth in Mbps
  readonly downlinkMax?: number // Maximum downlink speed in Mbps
  readonly effectiveType: 'slow-2g' | '2g' | '3g' | '4g'
  readonly rtt: number // Round-trip time in ms
  readonly saveData: boolean // Data saver mode
  readonly type?: ConnectionType
  onchange: ((this: NetworkInformation, ev: Event) => unknown) | null
}

declare global {
  interface Navigator {
    connection?: NetworkInformation
    mozConnection?: NetworkInformation
    webkitConnection?: NetworkInformation
  }
}

/**
 * Get Network Information API object (browser-specific)
 */
function getNetworkConnection(): NetworkInformation | undefined {
  if (typeof navigator === 'undefined') return undefined
  return navigator.connection || navigator.mozConnection || navigator.webkitConnection
}

/**
 * Determine connection quality based on Network Information API data
 */
function getConnectionQuality(connection?: NetworkInformation, isOnline?: boolean): ConnectionQuality {
  if (!isOnline) return 'offline'
  if (!connection) return 'good' // Assume good if we can't detect

  const { effectiveType, rtt, downlink } = connection

  // Based on effective connection type
  if (effectiveType === 'slow-2g' || effectiveType === '2g') {
    return 'poor'
  }

  if (effectiveType === '3g') {
    // Check RTT and downlink for 3G
    if (rtt > 500 || downlink < 0.5) return 'poor'
    if (rtt > 300 || downlink < 1) return 'fair'
    return 'good'
  }

  // 4G connection
  if (rtt > 200 || downlink < 2) return 'fair'
  if (rtt > 100 || downlink < 5) return 'good'

  return 'excellent'
}

/**
 * Network Status Hook
 *
 * @returns Network status information and utilities
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isOnline, quality, connectionType } = useNetworkStatus()
 *
 *   if (!isOnline) {
 *     return <div>You are offline</div>
 *   }
 *
 *   if (quality === 'poor') {
 *     return <div>Slow connection detected</div>
 *   }
 *
 *   return <div>Online - {quality} connection</div>
 * }
 * ```
 */
export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof navigator === 'undefined') return true
    return navigator.onLine
  })

  const [networkInfo, setNetworkInfo] = useState<Partial<NetworkStatus>>({})

  // Update network information from Network Information API
  const updateNetworkInfo = useCallback(() => {
    const connection = getNetworkConnection()

    if (!connection) {
      setNetworkInfo({})
      return
    }

    const quality = getConnectionQuality(connection, isOnline)

    setNetworkInfo({
      quality,
      connectionType: connection.type || connection.effectiveType,
      effectiveBandwidth: connection.downlink,
      rtt: connection.rtt,
      saveData: connection.saveData,
    })
  }, [isOnline])

  // Handle online event
  const handleOnline = useCallback(() => {
    console.log('🟢 Network: Back online')
    setIsOnline(true)

    // Add breadcrumb
    addBreadcrumb({
      category: 'custom',
      message: 'Network: Back online',
      level: 'info',
      data: {
        wasOffline: !isOnline,
      },
    })

    updateNetworkInfo()
  }, [isOnline, updateNetworkInfo])

  // Handle offline event
  const handleOffline = useCallback(() => {
    console.log('🔴 Network: Gone offline')
    setIsOnline(false)

    // Add breadcrumb
    addBreadcrumb({
      category: 'custom',
      message: 'Network: Gone offline',
      level: 'warning',
    })

    setNetworkInfo({ quality: 'offline' })
  }, [])

  // Set up event listeners
  useEffect(() => {
    // Initial network info
    updateNetworkInfo()

    // Listen for online/offline events
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Listen for Network Information API changes
    const connection = getNetworkConnection()
    if (connection) {
      const handleConnectionChange = () => {
        console.log('📡 Network: Connection changed')
        updateNetworkInfo()

        // Add breadcrumb
        addBreadcrumb({
          category: 'custom',
          message: 'Network: Connection changed',
          level: 'info',
          data: {
            effectiveType: connection.effectiveType,
            downlink: connection.downlink,
            rtt: connection.rtt,
          },
        })
      }

      connection.addEventListener('change', handleConnectionChange)

      // Cleanup
      return () => {
        window.removeEventListener('online', handleOnline)
        window.removeEventListener('offline', handleOffline)
        connection.removeEventListener('change', handleConnectionChange)
      }
    }

    // Cleanup without connection API
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [handleOnline, handleOffline, updateNetworkInfo])

  // Calculate quality if not available from Network Info API
  const quality = networkInfo.quality || getConnectionQuality(undefined, isOnline)

  return {
    isOnline,
    quality,
    connectionType: networkInfo.connectionType,
    effectiveBandwidth: networkInfo.effectiveBandwidth,
    rtt: networkInfo.rtt,
    saveData: networkInfo.saveData,
    lastChanged: Date.now(),
  }
}

/**
 * Hook to detect if connection is slow
 * @param threshold - RTT threshold in ms (default: 500)
 */
export function useSlowConnection(threshold: number = 500): boolean {
  const { quality, rtt } = useNetworkStatus()

  // Check quality first
  if (quality === 'poor' || quality === 'offline') return true

  // Check RTT if available
  if (rtt !== undefined && rtt > threshold) return true

  return false
}

/**
 * Hook to get quality color for UI
 */
export function useConnectionQualityColor(): {
  color: string
  bgColor: string
  textColor: string
} {
  const { quality } = useNetworkStatus()

  switch (quality) {
    case 'excellent':
      return {
        color: 'green',
        bgColor: 'bg-green-50',
        textColor: 'text-green-700',
      }
    case 'good':
      return {
        color: 'blue',
        bgColor: 'bg-blue-50',
        textColor: 'text-blue-700',
      }
    case 'fair':
      return {
        color: 'yellow',
        bgColor: 'bg-yellow-50',
        textColor: 'text-yellow-700',
      }
    case 'poor':
      return {
        color: 'orange',
        bgColor: 'bg-orange-50',
        textColor: 'text-orange-700',
      }
    case 'offline':
      return {
        color: 'red',
        bgColor: 'bg-red-50',
        textColor: 'text-red-700',
      }
    default:
      return {
        color: 'gray',
        bgColor: 'bg-gray-50',
        textColor: 'text-gray-700',
      }
  }
}

/**
 * Hook to detect if user is offline
 * (Simpler version of useNetworkStatus for basic offline detection)
 */
export function useIsOnline(): boolean {
  const { isOnline } = useNetworkStatus()
  return isOnline
}

/**
 * Get user-friendly connection quality text in Persian
 */
export function getQualityText(quality: ConnectionQuality): string {
  switch (quality) {
    case 'excellent':
      return 'عالی'
    case 'good':
      return 'خوب'
    case 'fair':
      return 'متوسط'
    case 'poor':
      return 'ضعیف'
    case 'offline':
      return 'آفلاین'
    default:
      return 'نامشخص'
  }
}

/**
 * Get connection type text in Persian
 */
export function getConnectionTypeText(type?: ConnectionType): string {
  if (!type) return 'نامشخص'

  switch (type) {
    case 'wifi':
      return 'وای‌فای'
    case 'ethernet':
      return 'اترنت'
    case 'cellular':
    case '2g':
    case '3g':
    case '4g':
    case '5g':
      return 'موبایل'
    case 'slow-2g':
      return 'موبایل (کند)'
    case 'bluetooth':
      return 'بلوتوث'
    case 'wimax':
      return 'وایمکس'
    default:
      return 'نامشخص'
  }
}
