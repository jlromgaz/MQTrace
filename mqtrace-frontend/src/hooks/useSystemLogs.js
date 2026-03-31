import { useState, useEffect } from "react";
import { createConsumer } from "@rails/actioncable";

const CABLE_URL = "ws://localhost:3000/cable";
const MAX_LOGS = 200;

function useSystemLogs() {
  const [logs, setLogs] = useState([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const cable = createConsumer(CABLE_URL);

    const subscription = cable.subscriptions.create(
      { channel: "SystemLogsChannel" },
      {
        connected() {
          setConnected(true);
        },
        disconnected() {
          setConnected(false);
        },
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

  return { logs, connected };
}

export default useSystemLogs;
