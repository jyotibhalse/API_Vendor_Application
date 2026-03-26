import { useEffect, useEffectEvent, useRef, useState } from "react"
import api from "../api/axios"

const WS_RECONNECT_DELAY_MS = 3000
const WS_PING_INTERVAL_MS = 20000

export function buildOrderWebSocketUrl(token, path = "/ws/orders") {
  const baseUrl = api.defaults.baseURL || window.location.origin
  const url = new URL(baseUrl)
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
  url.pathname = path
  url.searchParams.set("token", token)
  return url.toString()
}

export function useOrderRealtime({ onEvent, path = "/ws/orders", enabled = true }) {
  const [liveMode, setLiveMode] = useState(enabled ? "connecting" : "idle")

  const socketRef = useRef(null)
  const reconnectTimeoutRef = useRef(null)
  const pingIntervalRef = useRef(null)

  const clearPingInterval = useEffectEvent(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current)
      pingIntervalRef.current = null
    }
  })

  const handleRealtimeMessage = useEffectEvent((message) => {
    if (!message || typeof message !== "object") {
      return
    }

    if (message.type === "connection.ready") {
      setLiveMode("live")
      return
    }

    if (message.type === "pong") {
      return
    }

    onEvent?.(message)
  })

  const scheduleReconnect = useEffectEvent(() => {
    clearPingInterval()

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }

    setLiveMode("fallback")
    reconnectTimeoutRef.current = setTimeout(() => {
      setLiveMode("connecting")
      connectWebSocket()
    }, WS_RECONNECT_DELAY_MS)
  })

  const connectWebSocket = useEffectEvent(() => {
    if (!enabled) {
      return
    }

    const token = sessionStorage.getItem("token")
    if (!token) {
      setLiveMode("fallback")
      return
    }

    if (socketRef.current && socketRef.current.readyState <= WebSocket.OPEN) {
      return
    }

    const socket = new WebSocket(buildOrderWebSocketUrl(token, path))
    socketRef.current = socket

    socket.onopen = () => {
      setLiveMode("live")
      clearPingInterval()
      pingIntervalRef.current = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send("ping")
        }
      }, WS_PING_INTERVAL_MS)
    }

    socket.onmessage = (event) => {
      try {
        handleRealtimeMessage(JSON.parse(event.data))
      } catch {
        console.log("Ignoring invalid realtime payload")
      }
    }

    socket.onerror = () => {
      if (socketRef.current === socket) {
        socket.close()
      }
    }

    socket.onclose = () => {
      if (socketRef.current === socket) {
        socketRef.current = null
      }

      if (enabled) {
        scheduleReconnect()
      }
    }
  })

  useEffect(() => {
    if (!enabled) {
      setLiveMode("idle")
      return undefined
    }

    setLiveMode("connecting")
    connectWebSocket()

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      clearPingInterval()
      if (socketRef.current) {
        socketRef.current.onclose = null
        socketRef.current.onerror = null
        socketRef.current.close()
        socketRef.current = null
      }
    }
  }, [enabled, path])

  return liveMode
}
