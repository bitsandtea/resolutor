import React from "react";

interface DeploymentLogsProps {
  logs: string[];
}

const DeploymentLogs: React.FC<DeploymentLogsProps> = ({ logs }) => {
  return (
    <div className="bg-black text-green-400 p-4 rounded-lg">
      <h3 className="text-lg font-semibold mb-2">Deployment Logs</h3>
      <div className="max-h-48 overflow-y-auto text-sm font-mono space-y-1">
        {logs.length === 0 ? (
          <p className="text-gray-500">No logs yet...</p>
        ) : (
          logs.map((log, index) => <div key={index}>{log}</div>)
        )}
      </div>
    </div>
  );
};

export default DeploymentLogs;
