import { useState } from "react";
import { Link } from "react-router";
import { ChevronDown, ChevronUp, Play, Pause, Square, ExternalLink, Settings, Copy, Trash2, Sparkles } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import { ScrollArea } from "./ui/scroll-area";

type RunStatus = "idle" | "running" | "paused" | "waiting-input" | "completed" | "error";
type AuthStatus = "not-signed-in" | "signed-in";

export function PopupView() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>("not-signed-in");
  const [runStatus, setRunStatus] = useState<RunStatus>("idle");
  const [logsExpanded, setLogsExpanded] = useState(false);
  const [appliedCount, setAppliedCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);

  // Mock data
  const logs = [
    { time: "14:32:45", type: "success", message: "Applied to Software Engineer at TechCorp" },
    { time: "14:32:38", type: "skipped", message: "Skipped - Already applied" },
    { time: "14:32:30", type: "info", message: "Processing job listing 3/50" },
    { time: "14:32:22", type: "success", message: "Applied to Frontend Developer at StartupXYZ" },
    { time: "14:32:15", type: "error", message: "Failed - Missing required field: Years of experience" },
  ];

  const handleSignIn = () => {
    setAuthStatus("signed-in");
  };

  const handleStart = () => {
    setRunStatus("running");
  };

  const handlePause = () => {
    setRunStatus("paused");
  };

  const handleStop = () => {
    setRunStatus("idle");
    setAppliedCount(0);
    setSkippedCount(0);
    setFailedCount(0);
  };

  const getStatusBadgeVariant = () => {
    switch (runStatus) {
      case "running": return "default";
      case "paused": return "secondary";
      case "waiting-input": return "outline";
      case "completed": return "default";
      case "error": return "destructive";
      default: return "secondary";
    }
  };

  const getStatusText = () => {
    switch (runStatus) {
      case "running": return "Running";
      case "paused": return "Paused";
      case "waiting-input": return "Waiting for Input";
      case "completed": return "Completed";
      case "error": return "Error";
      default: return "Idle";
    }
  };

  return (
    <div className="w-[380px] h-[600px] relative overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 via-blue-500/20 to-cyan-500/20 animate-gradient-shift"></div>
      <div className="absolute inset-0 bg-gradient-to-tr from-pink-500/10 via-transparent to-indigo-500/10 animate-pulse-slow"></div>
      
      {/* Glass container */}
      <div className="relative w-full h-full backdrop-blur-2xl bg-white/10 border border-white/20 shadow-2xl flex flex-col">
        {/* Header with glass effect */}
        <div className="relative backdrop-blur-xl bg-white/10 border-b border-white/20 p-4">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-blue-500/5"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 backdrop-blur-lg bg-white/20 border border-white/30 px-4 py-2 rounded-xl shadow-lg">
                <Sparkles className="w-4 h-4 text-purple-300 animate-pulse" />
                <span className="text-sm font-semibold bg-gradient-to-r from-purple-200 to-blue-200 bg-clip-text text-transparent">
                  LinkedIn Auto-Apply
                </span>
              </div>
              <Link to="/documentation">
                <Button variant="ghost" size="sm" className="backdrop-blur-lg bg-white/10 border border-white/30 hover:bg-white/20 text-white shadow-lg">
                  Docs
                </Button>
              </Link>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/60">Status:</span>
              <Badge variant={getStatusBadgeVariant()} className="backdrop-blur-lg bg-white/20 border border-white/30 text-white shadow-lg">
                {getStatusText()}
              </Badge>
            </div>
          </div>
        </div>

        {/* Account State Section */}
        <div className="relative backdrop-blur-xl bg-white/5 border-b border-white/20 p-4">
          <div className="backdrop-blur-lg bg-white/10 border border-white/20 rounded-2xl p-4 shadow-xl">
            <div className="text-xs font-semibold mb-3 text-white/40 uppercase tracking-wider">Account State</div>
            {authStatus === "not-signed-in" ? (
              <>
                <div className="mb-3 p-3 backdrop-blur-lg bg-amber-500/20 border border-amber-300/30 rounded-xl">
                  <span className="text-sm text-amber-100 flex items-center gap-2">
                    <span className="text-lg">⚠</span> Sign in required
                  </span>
                </div>
                <Button 
                  onClick={handleSignIn} 
                  className="w-full backdrop-blur-lg bg-gradient-to-r from-blue-500/80 to-purple-500/80 hover:from-blue-500/90 hover:to-purple-500/90 border border-white/30 text-white shadow-xl"
                >
                  Sign In with LinkedIn
                </Button>
              </>
            ) : (
              <div className="flex items-center gap-3 p-3 backdrop-blur-lg bg-white/10 border border-white/30 rounded-xl shadow-lg">
                <div className="w-10 h-10 backdrop-blur-lg bg-gradient-to-br from-purple-400/40 to-blue-400/40 border border-white/30 rounded-full flex items-center justify-center shadow-lg">
                  <span className="text-lg">👤</span>
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-white flex items-center gap-1">
                    <span className="text-green-300">✓</span> Connected
                  </div>
                  <div className="text-xs text-white/60">john.doe@example.com</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main Run Section (visible only when signed in) */}
        {authStatus === "signed-in" && (
          <>
            <div className="flex-1 overflow-auto">
              <div className="p-4 space-y-4">
                {/* Current Run Summary */}
                <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-4 shadow-xl">
                  <div className="text-xs font-semibold mb-3 text-white/40 uppercase tracking-wider">Current Run</div>
                  <div className="text-sm text-white/90 mb-4">
                    {runStatus === "idle" && "No active run"}
                    {runStatus === "running" && (
                      <span className="flex items-center gap-2">
                        <span className="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                        Applying to Software Engineer positions...
                      </span>
                    )}
                    {runStatus === "paused" && "Run paused - Resume when ready"}
                    {runStatus === "waiting-input" && "Waiting for user response"}
                    {runStatus === "completed" && "Run completed successfully"}
                    {runStatus === "error" && "Run stopped due to error"}
                  </div>

                  {/* Key Counters */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="backdrop-blur-lg bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-white/30 rounded-xl p-3 text-center shadow-lg">
                      <div className="text-2xl font-bold text-white">{appliedCount}</div>
                      <div className="text-xs text-white/60">Applied</div>
                    </div>
                    <div className="backdrop-blur-lg bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-white/30 rounded-xl p-3 text-center shadow-lg">
                      <div className="text-2xl font-bold text-white">{skippedCount}</div>
                      <div className="text-xs text-white/60">Skipped</div>
                    </div>
                    <div className="backdrop-blur-lg bg-gradient-to-br from-red-500/20 to-pink-500/20 border border-white/30 rounded-xl p-3 text-center shadow-lg">
                      <div className="text-2xl font-bold text-white">{failedCount}</div>
                      <div className="text-xs text-white/60">Failed</div>
                    </div>
                  </div>
                </div>

                {/* Primary Controls */}
                <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-4 shadow-xl">
                  <div className="text-xs font-semibold mb-3 text-white/40 uppercase tracking-wider">Controls</div>
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <Button 
                      onClick={handleStart} 
                      disabled={runStatus === "running"}
                      className="backdrop-blur-lg bg-gradient-to-br from-green-500/60 to-emerald-500/60 hover:from-green-500/80 hover:to-emerald-500/80 border border-white/30 text-white h-14 flex flex-col items-center justify-center gap-1 shadow-xl disabled:opacity-40"
                    >
                      <Play className="w-4 h-4" />
                      <span className="text-xs">Start</span>
                    </Button>
                    <Button 
                      onClick={handlePause} 
                      disabled={runStatus !== "running"}
                      className="backdrop-blur-lg bg-gradient-to-br from-yellow-500/60 to-orange-500/60 hover:from-yellow-500/80 hover:to-orange-500/80 border border-white/30 text-white h-14 flex flex-col items-center justify-center gap-1 shadow-xl disabled:opacity-40"
                    >
                      <Pause className="w-4 h-4" />
                      <span className="text-xs">Pause</span>
                    </Button>
                    <Button 
                      onClick={handleStop} 
                      disabled={runStatus === "idle"}
                      className="backdrop-blur-lg bg-gradient-to-br from-red-500/60 to-pink-500/60 hover:from-red-500/80 hover:to-pink-500/80 border border-white/30 text-white h-14 flex flex-col items-center justify-center gap-1 shadow-xl disabled:opacity-40"
                    >
                      <Square className="w-4 h-4" />
                      <span className="text-xs">Stop</span>
                    </Button>
                  </div>

                  <Separator className="my-3 bg-white/20" />

                  {/* Secondary Actions */}
                  <div className="text-xs font-semibold mb-2 text-white/40 uppercase tracking-wider">Quick Actions</div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 backdrop-blur-lg bg-white/10 border border-white/30 hover:bg-white/20 text-white shadow-lg">
                      <ExternalLink className="w-3 h-3 mr-1" />
                      <span className="text-xs">LinkedIn Jobs</span>
                    </Button>
                    <Link to="/settings" className="flex-1">
                      <Button variant="outline" size="sm" className="w-full backdrop-blur-lg bg-white/10 border border-white/30 hover:bg-white/20 text-white shadow-lg">
                        <Settings className="w-3 h-3 mr-1" />
                        <span className="text-xs">Settings</span>
                      </Button>
                    </Link>
                  </div>
                </div>

                {/* Logs Section */}
                <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl shadow-xl overflow-hidden">
                  <button
                    onClick={() => setLogsExpanded(!logsExpanded)}
                    className="w-full p-4 flex items-center justify-between hover:bg-white/10 transition-colors border-b border-white/20"
                  >
                    <span className="text-xs font-semibold text-white/40 uppercase tracking-wider">Activity Logs</span>
                    {logsExpanded ? <ChevronUp className="w-4 h-4 text-white/60" /> : <ChevronDown className="w-4 h-4 text-white/60" />}
                  </button>
                  
                  {logsExpanded && (
                    <>
                      <ScrollArea className="h-[150px] border-b border-white/20">
                        <div className="p-3 space-y-2">
                          {logs.map((log, index) => (
                            <div key={index} className="backdrop-blur-lg bg-white/10 border border-white/20 rounded-lg p-2 shadow-lg">
                              <div className="flex items-start justify-between gap-2">
                                <span className="text-xs text-white/50">{log.time}</span>
                                <span className={`text-xs flex-1 ${
                                  log.type === "success" ? "text-green-300" :
                                  log.type === "error" ? "text-red-300" :
                                  log.type === "skipped" ? "text-yellow-300" :
                                  "text-white/70"
                                }`}>
                                  {log.message}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                      <div className="p-2 flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1 backdrop-blur-lg bg-white/10 border border-white/30 hover:bg-white/20 text-white shadow-lg">
                          <Copy className="w-3 h-3 mr-1" />
                          <span className="text-xs">Copy</span>
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1 backdrop-blur-lg bg-white/10 border border-white/30 hover:bg-white/20 text-white shadow-lg">
                          <Trash2 className="w-3 h-3 mr-1" />
                          <span className="text-xs">Clear</span>
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Footer Status Line */}
            <div className="backdrop-blur-xl bg-white/10 border-t border-white/20 p-3 shadow-xl">
              <div className="text-xs text-white/60 text-center">
                {runStatus === "idle" && "Ready to start applying"}
                {runStatus === "running" && "Processing job 12 of 50..."}
                {runStatus === "paused" && "Run paused - Resume to continue"}
                {runStatus === "waiting-input" && "Action required - Check floating panel"}
                {runStatus === "completed" && "All jobs processed"}
                {runStatus === "error" && "Error encountered - Check logs"}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}