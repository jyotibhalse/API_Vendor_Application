import { useEffect, useEffectEvent, useRef } from "react"
import { useAuth } from "../context/AuthContext"

function canPlayOrderAlerts(user, enabled) {
  if (!enabled || user?.role !== "vendor") {
    return false
  }

  return user?.notification_settings?.order_alerts !== false
}

export function useUrgentOrderAlerts({ enabled = true } = {}) {
  const { user } = useAuth()

  const seenOrderIdsRef = useRef(new Set())
  const audioContextRef = useRef(null)

  const alertsEnabled = canPlayOrderAlerts(user, enabled)
  const soundEnabled = alertsEnabled && user?.notification_settings?.sound_enabled !== false
  const vibrationEnabled = alertsEnabled && user?.notification_settings?.vibration_enabled !== false

  const triggerUrgentAlert = useEffectEvent((count = 1) => {
    if (vibrationEnabled && typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate([220, 120, 220])
    }

    if (!soundEnabled || typeof window === "undefined") {
      return
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) {
      return
    }

    try {
      const context = audioContextRef.current ?? new AudioContextClass()
      audioContextRef.current = context

      if (context.state === "suspended") {
        context.resume().catch(() => {})
      }

      const bursts = Math.min(Math.max(count, 1), 2)
      for (let index = 0; index < bursts; index += 1) {
        const oscillator = context.createOscillator()
        const gainNode = context.createGain()
        const startAt = context.currentTime + (index * 0.24)

        oscillator.type = "triangle"
        oscillator.frequency.setValueAtTime(880, startAt)
        gainNode.gain.setValueAtTime(0.0001, startAt)
        gainNode.gain.exponentialRampToValueAtTime(0.08, startAt + 0.02)
        gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.18)

        oscillator.connect(gainNode)
        gainNode.connect(context.destination)
        oscillator.start(startAt)
        oscillator.stop(startAt + 0.2)
      }
    } catch {
      // Ignore browser autoplay restrictions and keep the UI responsive.
    }
  })

  const markOrdersSeen = useEffectEvent((orders = []) => {
    orders.forEach((order) => {
      if (order?.id) {
        seenOrderIdsRef.current.add(order.id)
      }
    })
  })

  const notifyForOrders = useEffectEvent((orders = []) => {
    const newUrgentOrders = orders.filter(
      (order) => order?.id && order.is_urgent && !seenOrderIdsRef.current.has(order.id)
    )

    markOrdersSeen(orders)

    if (newUrgentOrders.length > 0) {
      triggerUrgentAlert(newUrgentOrders.length)
    }

    return newUrgentOrders.length
  })

  const notifyForEvent = useEffectEvent((message) => {
    const order = message?.order
    if (!order?.id) {
      return false
    }

    const shouldAlert =
      message.type === "order.created" &&
      order.status === "pending" &&
      order.is_urgent &&
      !seenOrderIdsRef.current.has(order.id)

    seenOrderIdsRef.current.add(order.id)

    if (shouldAlert) {
      triggerUrgentAlert()
    }

    return shouldAlert
  })

  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {})
        audioContextRef.current = null
      }
    }
  }, [])

  return {
    markOrdersSeen,
    notifyForEvent,
    notifyForOrders,
  }
}
