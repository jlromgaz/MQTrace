import React, { useEffect, useRef } from "react";
import { useSystemLogs } from "../context/SystemLogsContext";
import "./SystemConsole.css";

function SystemConsole() {
  const { logs, connected } = useSystemLogs();
  const consoleEndRef = useRef(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <div className="system-console">
      <div className="console-header">
        <h2><span className="terminal-icon">&gt;_</span> System Console</h2>
        <span className={`status-badge ${connected ? "online" : "offline"}`}>
          {connected ? "LIVE CHNL" : "OFFLINE"}
        </span>
      </div>
      <div className="console-window">
        {logs.length === 0 ? (
          <div className="log-row info">Waiting for system logs...</div>
        ) : (
          logs.map((log, idx) => (
            <div key={idx} className={`log-row ${log.level || "info"}`}>
              <span className="log-time">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
              <span className="log-level">[{log.level && log.level.toUpperCase()}]</span>
              <span className="log-message">{log.message}</span>
            </div>
          ))
        )}
        <div ref={consoleEndRef} />
      </div>
    </div>
  );
}

export default SystemConsole;
