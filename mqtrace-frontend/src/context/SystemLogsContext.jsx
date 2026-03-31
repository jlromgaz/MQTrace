// src/context/SystemLogsContext.jsx
//
// Provides a SINGLE shared ActionCable subscription for system log events.
// SystemConsole consumes from this context instead of mounting its own hook,
// so switching tabs never clears the accumulated log history.

import { createContext, useContext, useState, useEffect } from "react";
import { createConsumer } from "@rails/actioncable";

const CABLE_URL = "ws://localhost:3000/cable";
const MAX_LOGS = 500;

const SystemLogsContext = createContext({ logs: [], connected: false });

export function SystemLogsProvider({ children }) {
  const [logs, setLogs] = useState([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const cable = createConsumer(CABLE_URL);

    const subscription = cable.subscriptions.create(
      { channel: "SystemLogsChannel" },
      {
        connected()    { setConnected(true); },
        disconnected() { setConnected(false); },
        received(data) {
          setLogs((prev) => [...prev, data].slice(-MAX_LOGS));
        },
      }
    );

    return () => {
      subscription.unsubscribe();
      cable.disconnect();
    };
  }, []);

  return (
    <SystemLogsContext.Provider value={{ logs, connected }}>
      {children}
    </SystemLogsContext.Provider>
  );
}

export function useSystemLogs() {
  return useContext(SystemLogsContext);
}
