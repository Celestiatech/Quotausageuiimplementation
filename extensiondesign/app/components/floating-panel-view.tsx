import { useState } from "react";
import { Play, Pause, Square, Send, CheckCircle2, XCircle, Clock, Zap } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";

type PanelState = "idle" | "running" | "paused" | "waiting-input" | "completed";

export function FloatingPanelView() {
  const [panelState, setPanelState] = useState<PanelState>("running");
  const [userInput, setUserInput] = useState("");

  // Mock timeline/activity data
  const activities = [
    { 
      id: 1, 
      step: "Job detected", 
      time: "14:32:45", 
      status: "completed",
      detail: "Software Engineer at TechCorp"
    },
    { 
      id: 2, 
      step: "Form analysis", 
      time: "14:32:47", 
      status: "completed",
      detail: "Found 8 fields to fill"
    },
    { 
      id: 3, 
      step: "Auto-filling fields", 
      time: "14:32:49", 
      status: "completed",
      detail: "Name, Email, Phone, Resume uploaded"
    },
    { 
      id: 4, 
      step: "Question detected", 
      time: "14:32:52", 
      status: "waiting",
      detail: "How many years of experience with React?"
    },
  ];

  const getCurrentJob = () => {
    switch (panelState) {
      case "running":
        return "Software Engineer at TechCorp";
      case "paused":
        return "Software Engineer at TechCorp (Paused)";
      case "waiting-input":
        return "Software Engineer at TechCorp (Action Required)";
      case "completed":
        return "Application Submitted";
      default:
        return "No active job";
    }
  };

  const getCurrentStep = () => {
    switch (panelState) {
      case "running":
        return "Filling application form...";
      case "paused":
        return "Process paused";
      case "waiting-input":
        return "Waiting for your response";
      case "completed":
        return "Ready for next application";
      default:
        return "Idle - Start a run to begin";
    }
  };

  const handleSendInput = () => {
    if (userInput.trim()) {
      setPanelState("running");
      setUserInput("");
    }
  };

  return (
    <div className="w-[400px] h-[600px] relative overflow-hidden rounded-3xl">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-pink-500/20 animate-gradient-shift"></div>
      <div className="absolute inset-0 bg-gradient-to-tl from-cyan-500/10 via-transparent to-blue-500/10 animate-pulse-slow"></div>
      
      {/* Glass container */}
      <div className="relative w-full h-full backdrop-blur-3xl bg-white/10 border border-white/20 shadow-2xl flex flex-col">
        {/* Top Area - Status & Controls */}
        <div className="relative backdrop-blur-xl bg-gradient-to-r from-purple-500/10 to-blue-500/10 border-b border-white/20 p-4">
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-purple-300 animate-pulse" />
                <div className="text-xs font-semibold text-white/60 uppercase tracking-wider">Assistant Panel</div>
              </div>
              <Badge 
                className={`backdrop-blur-lg border border-white/30 shadow-lg ${
                  panelState === "running" ? "bg-green-500/30 text-green-100" :
                  panelState === "paused" ? "bg-yellow-500/30 text-yellow-100" :
                  panelState === "waiting-input" ? "bg-orange-500/30 text-orange-100" :
                  "bg-blue-500/30 text-blue-100"
                }`}
              >
                {panelState === "running" && "● RUNNING"}
                {panelState === "paused" && "|| PAUSED"}
                {panelState === "waiting-input" && "? NEEDS INPUT"}
                {panelState === "completed" && "✓ COMPLETED"}
                {panelState === "idle" && "○ IDLE"}
              </Badge>
            </div>

            {/* Quick Controls */}
            <div className="grid grid-cols-3 gap-2">
              <Button 
                size="sm" 
                onClick={() => setPanelState("running")}
                disabled={panelState === "running"}
                className="backdrop-blur-lg bg-gradient-to-br from-green-500/50 to-emerald-500/50 hover:from-green-500/70 hover:to-emerald-500/70 border border-white/30 text-white h-10 shadow-xl disabled:opacity-40"
              >
                <Play className="w-3 h-3 mr-1" />
                <span className="text-xs">Start</span>
              </Button>
              <Button 
                size="sm" 
                onClick={() => setPanelState("paused")}
                disabled={panelState !== "running"}
                className="backdrop-blur-lg bg-gradient-to-br from-yellow-500/50 to-orange-500/50 hover:from-yellow-500/70 hover:to-orange-500/70 border border-white/30 text-white h-10 shadow-xl disabled:opacity-40"
              >
                <Pause className="w-3 h-3 mr-1" />
                <span className="text-xs">Pause</span>
              </Button>
              <Button 
                size="sm" 
                onClick={() => setPanelState("idle")}
                disabled={panelState === "idle"}
                className="backdrop-blur-lg bg-gradient-to-br from-red-500/50 to-pink-500/50 hover:from-red-500/70 hover:to-pink-500/70 border border-white/30 text-white h-10 shadow-xl disabled:opacity-40"
              >
                <Square className="w-3 h-3 mr-1" />
                <span className="text-xs">Stop</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Middle Area - Current Context & Timeline */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Current Job Context */}
          <div className="backdrop-blur-xl bg-white/5 border-b border-white/20 p-4">
            <div className="backdrop-blur-lg bg-white/10 border border-white/20 rounded-2xl p-4 shadow-xl">
              <div className="text-xs font-semibold mb-2 text-white/40 uppercase tracking-wider">Current Job</div>
              <div className="text-sm font-semibold text-white mb-1">{getCurrentJob()}</div>
              <div className="text-xs text-white/60 flex items-center gap-2">
                {panelState === "running" && (
                  <span className="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                )}
                {getCurrentStep()}
              </div>
            </div>
          </div>

          {/* Activity Timeline */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="backdrop-blur-lg bg-white/5 p-3 border-b border-white/20">
              <div className="text-xs font-semibold text-white/40 uppercase tracking-wider">Activity Timeline</div>
            </div>
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-3">
                {activities.map((activity) => (
                  <div 
                    key={activity.id} 
                    className={`backdrop-blur-xl border rounded-2xl p-4 shadow-xl transition-all ${
                      activity.status === "waiting" 
                        ? "bg-orange-500/20 border-orange-300/30 ring-2 ring-orange-400/30" 
                        : "bg-white/10 border-white/20"
                    }`}
                  >
                    <div className="flex items-start gap-3 mb-2">
                      {activity.status === "completed" && (
                        <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0 drop-shadow-lg" />
                      )}
                      {activity.status === "waiting" && (
                        <Clock className="w-5 h-5 text-orange-300 mt-0.5 flex-shrink-0 animate-pulse drop-shadow-lg" />
                      )}
                      {activity.status === "failed" && (
                        <XCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0 drop-shadow-lg" />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold text-white">{activity.step}</span>
                          <span className="text-xs text-white/50">{activity.time}</span>
                        </div>
                        <div className="text-xs text-white/70">{activity.detail}</div>
                      </div>
                    </div>
                    
                    {/* Show input field if waiting for input */}
                    {activity.status === "waiting" && panelState === "waiting-input" && (
                      <div className="mt-3 p-3 backdrop-blur-lg bg-orange-400/20 border border-orange-300/30 rounded-xl">
                        <div className="text-xs font-semibold text-orange-100 flex items-center gap-2">
                          <span>⚠</span> This field requires your input
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Bottom Area - User Input */}
        <div className="backdrop-blur-xl bg-gradient-to-t from-purple-500/10 to-transparent border-t border-white/20 p-4">
          <div className="text-xs font-semibold mb-2 text-white/40 uppercase tracking-wider">
            {panelState === "waiting-input" 
              ? "Your Answer" 
              : "Command or Answer"}
          </div>
          <div className="flex gap-2">
            <Input
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendInput()}
              placeholder={
                panelState === "waiting-input" 
                  ? "Type your answer here..." 
                  : "Type a command..."
              }
              className="flex-1 backdrop-blur-lg bg-white/10 border-2 border-white/30 text-white placeholder:text-white/40 shadow-xl focus:border-purple-400/50 focus:ring-2 focus:ring-purple-400/20"
              disabled={panelState === "idle"}
            />
            <Button 
              onClick={handleSendInput}
              disabled={!userInput.trim() || panelState === "idle"}
              className="backdrop-blur-lg bg-gradient-to-r from-purple-500/70 to-blue-500/70 hover:from-purple-500/90 hover:to-blue-500/90 border border-white/30 shadow-xl"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <div className="mt-2 text-xs text-white/50 text-center">
            {panelState === "waiting-input" && "Press Enter or click Send to submit"}
            {panelState === "running" && "You can type commands while the assistant is running"}
            {panelState === "paused" && "Resume to continue processing"}
            {panelState === "idle" && "Start a run to activate the assistant"}
          </div>
        </div>

        {/* State Indicator */}
        <div className="backdrop-blur-lg bg-white/5 border-t border-white/30 px-4 py-2">
          <div className="text-xs text-white/50 flex items-center justify-between">
            <span>Panel Mode: <span className="text-white/70 font-semibold">{panelState.toUpperCase()}</span></span>
            <span className="text-xs">
              {panelState === "waiting-input" && "⏸ Paused for input"}
              {panelState === "running" && "▶ Auto-processing"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}