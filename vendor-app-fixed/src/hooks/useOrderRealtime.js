import { useCallback, useEffect, useRef, useState } from "react"
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

  const socketRef    = useRef(null)
  const reconnectRef = useRef(null)
  const pingRef      = useRef(null)
  const onEventRef   = useRef(onEvent)
  const enabledRef   = useRef(enabled)
  const connectRef   = useRef(null)

  useEffect(() => { onEventRef.current = onEvent }, [onEvent])
  useEffect(() => { enabledRef.current = enabled }, [enabled])

  const clearPing = useCallback(() => {
    if (pingRef.current) { clearInterval(pingRef.current); pingRef.current = null }
  }, [])

  const scheduleReconnect = useCallback(() => {
    clearPing()
    if (reconnectRef.current) clearTimeout(reconnectRef.current)
    setLiveMode("fallback")
    reconnectRef.current = setTimeout(() => {
      setLiveMode("connecting")
      connectRef.current?.()
    }, WS_RECONNECT_DELAY_MS)
  }, [clearPing])

  const connect = useCallback(() => {
    if (!enabledRef.current) return
    const token = sessionStorage.getItem("token")
    if (!token) { setLiveMode("fallback"); return }
    if (socketRef.current && socketRef.current.readyState <= WebSocket.OPEN) return

    const socket = new WebSocket(buildOrderWebSocketUrl(token, path))
    socketRef.current = socket

    socket.onopen = () => {
      setLiveMode("live")
      clearPing()
      pingRef.current = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) socket.send("ping")
      }, WS_PING_INTERVAL_MS)
    }

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        if (!msg || typeof msg !== "object") return
        if (msg.type === "connection.ready") { setLiveMode("live"); return }
        if (msg.type === "pong") return
        onEventRef.current?.(msg)
      } catch { /* ignore malformed frames */ }
    }

    socket.onerror = () => { if (socketRef.current === socket) socket.close() }

    socket.onclose = () => {
      if (socketRef.current === socket) socketRef.current = null
      if (enabledRef.current) scheduleReconnect()
    }
  }, [path, clearPing, scheduleReconnect])

  useEffect(() => { connectRef.current = connect }, [connect])

  useEffect(() => {
    if (!enabled) { setLiveMode("idle"); return }
    setLiveMode("connecting")
    connect()
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
      clearPing()
      if (socketRef.current) {
        socketRef.current.onclose = null
        socketRef.current.onerror = null
        socketRef.current.close()
        socketRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, path])

  return liveMode
}