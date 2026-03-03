import { Link } from "react-router";
import { ArrowLeft, ArrowRight, Circle, Square, BookOpen } from "lucide-react";
import { Button } from "./ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { ScrollArea } from "./ui/scroll-area";

export function DocumentationView() {
  return (
    <div className="w-full min-h-screen relative overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 via-indigo-500/20 to-purple-500/20 animate-gradient-shift"></div>
      <div className="absolute inset-0 bg-gradient-to-tl from-cyan-500/10 via-transparent to-pink-500/10 animate-pulse-slow"></div>
      
      {/* Glass container */}
      <div className="relative min-h-screen backdrop-blur-2xl bg-white/5">
        {/* Header */}
        <div className="sticky top-0 z-50 backdrop-blur-xl bg-white/10 border-b border-white/20 shadow-xl">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5"></div>
          <div className="relative max-w-7xl mx-auto p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link to="/">
                  <Button variant="outline" size="sm" className="backdrop-blur-lg bg-white/10 border border-white/30 hover:bg-white/20 text-white shadow-lg">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Popup
                  </Button>
                </Link>
                <div className="flex items-center gap-2 backdrop-blur-lg bg-white/20 border border-white/30 px-4 py-2 rounded-xl shadow-lg">
                  <BookOpen className="w-5 h-5 text-blue-300" />
                  <span className="text-lg font-semibold bg-gradient-to-r from-blue-200 to-purple-200 bg-clip-text text-transparent">
                    UX Documentation
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <Link to="/floating-panel">
                  <Button variant="outline" size="sm" className="backdrop-blur-lg bg-white/10 border border-white/30 hover:bg-white/20 text-white shadow-lg">
                    View Floating Panel
                  </Button>
                </Link>
                <Link to="/settings">
                  <Button variant="outline" size="sm" className="backdrop-blur-lg bg-white/10 border border-white/30 hover:bg-white/20 text-white shadow-lg">
                    View Settings
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>

        <ScrollArea className="h-[calc(100vh-100px)]">
          <div className="max-w-7xl mx-auto p-6">
            <Tabs defaultValue="screen-map" className="w-full">
              <TabsList className="w-full justify-start backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-1 mb-6 shadow-xl">
                <TabsTrigger 
                  value="screen-map" 
                  className="backdrop-blur-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500/40 data-[state=active]:to-blue-500/40 data-[state=active]:text-white text-white/60 rounded-xl px-4 border border-transparent data-[state=active]:border-white/30 data-[state=active]:shadow-lg"
                >
                  Screen Map
                </TabsTrigger>
                <TabsTrigger 
                  value="state-diagram" 
                  className="backdrop-blur-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500/40 data-[state=active]:to-blue-500/40 data-[state=active]:text-white text-white/60 rounded-xl px-4 border border-transparent data-[state=active]:border-white/30 data-[state=active]:shadow-lg"
                >
                  State Transitions
                </TabsTrigger>
                <TabsTrigger 
                  value="user-journeys" 
                  className="backdrop-blur-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500/40 data-[state=active]:to-blue-500/40 data-[state=active]:text-white text-white/60 rounded-xl px-4 border border-transparent data-[state=active]:border-white/30 data-[state=active]:shadow-lg"
                >
                  User Journeys
                </TabsTrigger>
                <TabsTrigger 
                  value="components" 
                  className="backdrop-blur-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500/40 data-[state=active]:to-blue-500/40 data-[state=active]:text-white text-white/60 rounded-xl px-4 border border-transparent data-[state=active]:border-white/30 data-[state=active]:shadow-lg"
                >
                  Component List
                </TabsTrigger>
              </TabsList>

              {/* Screen Map */}
              <TabsContent value="screen-map" className="mt-6">
                <div className="border-2 border-gray-400 p-6">
                  <h2 className="font-mono text-xl mb-6">SCREEN MAP</h2>
                  
                  <div className="space-y-8">
                    {/* Overview */}
                    <div className="border border-gray-400 p-4 bg-gray-50">
                      <div className="font-mono mb-2">Architecture Overview</div>
                      <div className="text-sm text-gray-700 font-mono leading-relaxed">
                        The extension consists of 3 primary screens, each serving distinct user contexts:
                        <ul className="list-disc list-inside mt-2 ml-4 space-y-1">
                          <li>Popup: Quick access control panel (browser action)</li>
                          <li>Floating Panel: Contextual assistant on LinkedIn (content script)</li>
                          <li>Settings: Full configuration interface (extension page)</li>
                        </ul>
                      </div>
                    </div>

                    {/* Visual Map */}
                    <div className="border-2 border-gray-800 p-6 bg-white">
                      <pre className="font-mono text-xs leading-relaxed">
{`
┌─────────────────────────────────────────────────────────────────┐
│                        EXTENSION SCREENS                         │
└─────────────────────────────────────────────────────────────────┘

    ┌──────────────┐         ┌──────────────┐         ┌──────────────┐
    │    POPUP     │         │   FLOATING   │         │   SETTINGS   │
    │  (380x600)   │─────────│    PANEL     │─────────│   (FULLPAGE) │
    │              │  linked │  (400x600)   │  linked │              │
    └──────────────┘         └──────────────┘         └──────────────┘
          │                         │                         │
          │                         │                         │
    ┌─────▼──────┐           ┌─────▼──────┐           ┌─────▼──────┐
    │  Header    │           │ Top Area   │           │  Header    │
    │  Status    │           │ Controls   │           │  Save/Reset│
    └────────────┘           └────────────┘           └────────────┘
          │                         │                         │
    ┌─────▼──────┐           ┌─────▼──────┐           ┌─────▼──────┐
    │  Account   │           │ Job Context│           │  Safety    │
    │  State     │           │ Current Job│           │  Limits    │
    └────────────┘           └────────────┘           └────────────┘
          │                         │                         │
    ┌─────▼──────┐           ┌─────▼──────┐           ┌─────▼──────┐
    │  Main Run  │           │  Activity  │           │  Search    │
    │  Controls  │           │  Timeline  │           │  Prefs     │
    │  Counters  │           │  (Scroll)  │           └────────────┘
    └────────────┘           └────────────┘                  │
          │                         │                  ┌─────▼──────┐
    ┌─────▼──────┐           ┌─────▼──────┐           │  Profile   │
    │  Activity  │           │ User Input │           │  Defaults  │
    │  Logs      │           │ Command    │           └────────────┘
    │(Collapsible)           └────────────┘                  │
    └────────────┘                  │                  ┌─────▼──────┐
          │                         │                  │  Advanced  │
    ┌─────▼──────┐           ┌─────▼──────┐           │ (Collapsed)│
    │  Footer    │           │State Indic.│           └────────────┘
    │  Status    │           └────────────┘
    └────────────┘

NAVIGATION FLOWS:
━━━━━━━━━━━━━━━
Popup ──[Settings button]──> Settings ──[Back button]──> Popup
Popup ──[LinkedIn Jobs]────> LinkedIn (external)
Floating Panel <────[Auto-appears on LinkedIn]────> Content Script
`}
                      </pre>
                    </div>

                    {/* Screen Details */}
                    <div className="space-y-4">
                      <div className="border border-gray-400 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Square className="w-4 h-4" />
                          <span className="font-mono">1. POPUP SCREEN</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm font-mono">
                          <div>
                            <div className="text-gray-600 mb-1">Context:</div>
                            <div>Browser extension popup</div>
                          </div>
                          <div>
                            <div className="text-gray-600 mb-1">Size:</div>
                            <div>380px × 600px (fixed)</div>
                          </div>
                          <div>
                            <div className="text-gray-600 mb-1">Access:</div>
                            <div>Click extension icon in toolbar</div>
                          </div>
                          <div>
                            <div className="text-gray-600 mb-1">Purpose:</div>
                            <div>Quick run control & monitoring</div>
                          </div>
                        </div>
                      </div>

                      <div className="border border-gray-400 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Square className="w-4 h-4" />
                          <span className="font-mono">2. FLOATING PANEL SCREEN</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm font-mono">
                          <div>
                            <div className="text-gray-600 mb-1">Context:</div>
                            <div>Content script on LinkedIn</div>
                          </div>
                          <div>
                            <div className="text-gray-600 mb-1">Size:</div>
                            <div>400px × 600px (draggable)</div>
                          </div>
                          <div>
                            <div className="text-gray-600 mb-1">Access:</div>
                            <div>Auto-appears when on LinkedIn jobs</div>
                          </div>
                          <div>
                            <div className="text-gray-600 mb-1">Purpose:</div>
                            <div>Real-time assistance & input</div>
                          </div>
                        </div>
                      </div>

                      <div className="border border-gray-400 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Square className="w-4 h-4" />
                          <span className="font-mono">3. SETTINGS SCREEN</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm font-mono">
                          <div>
                            <div className="text-gray-600 mb-1">Context:</div>
                            <div>Full-page extension view</div>
                          </div>
                          <div>
                            <div className="text-gray-600 mb-1">Size:</div>
                            <div>Responsive (scrollable)</div>
                          </div>
                          <div>
                            <div className="text-gray-600 mb-1">Access:</div>
                            <div>Settings button in popup</div>
                          </div>
                          <div>
                            <div className="text-gray-600 mb-1">Purpose:</div>
                            <div>Comprehensive configuration</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* State Diagram */}
              <TabsContent value="state-diagram" className="mt-6">
                <div className="border-2 border-gray-400 p-6">
                  <h2 className="font-mono text-xl mb-6">STATE TRANSITION DIAGRAM</h2>

                  <div className="space-y-8">
                    {/* Run States */}
                    <div className="border-2 border-gray-800 p-6 bg-white">
                      <div className="font-mono mb-4 text-lg">Run State Machine</div>
                      <pre className="font-mono text-xs leading-relaxed overflow-x-auto">
{`
                     ┌─────────────┐
                     │    IDLE     │ ◄───────── [Initial State]
                     └──────┬──────┘
                            │
                    [Start Button]
                            │
                            ▼
                     ┌─────────────┐
            ┌────────│   RUNNING   │────────┐
            │        └──────┬──────┘        │
            │               │               │
    [Pause Button]    [Error Occurs]  [Question Detected]
            │               │               │
            ▼               ▼               ▼
     ┌─────────────┐ ┌─────────────┐ ┌─────────────────┐
     │   PAUSED    │ │    ERROR    │ │ WAITING-INPUT   │
     └──────┬──────┘ └──────┬──────┘ └────────┬────────┘
            │               │                  │
     [Resume Button]  [Retry/Stop]     [User Submits]
            │               │                  │
            └───────────────┴──────────────────┘
                            │
                    [Max Reached / Stop]
                            │
                            ▼
                     ┌─────────────┐
                     │  COMPLETED  │
                     └──────┬──────┘
                            │
                    [Start New Run]
                            │
                            ▼
                     ┌─────────────┐
                     │    IDLE     │
                     └─────────────┘


STATE DESCRIPTIONS:
═══════════════════

IDLE
├─ No active run in progress
├─ Counters reset to 0
├─ Controls: [Start] enabled, [Pause][Stop] disabled
└─ Footer: "Ready to start applying"

RUNNING
├─ Actively processing job applications
├─ Counters incrementing in real-time
├─ Controls: [Start] disabled, [Pause][Stop] enabled
└─ Footer: "Processing job X of Y..."

PAUSED
├─ Run temporarily halted by user
├─ State preserved, ready to resume
├─ Controls: [Start/Resume] enabled, [Stop] enabled
└─ Footer: "Run paused - Resume to continue"

WAITING-INPUT
├─ Required field needs user response
├─ Automatically pauses run
├─ Floating panel highlights question
└─ Footer: "Action required - Check floating panel"

ERROR
├─ Critical error stopped the run
├─ Error details shown in logs
├─ Controls: [Start] to retry, [Stop] to reset
└─ Footer: "Error encountered - Check logs"

COMPLETED
├─ Run finished successfully
├─ Final counts displayed
├─ Controls: [Start] to begin new run
└─ Footer: "All jobs processed"
`}
                      </pre>
                    </div>

                    {/* Auth States */}
                    <div className="border-2 border-gray-800 p-6 bg-white">
                      <div className="font-mono mb-4 text-lg">Authentication State Flow</div>
                      <pre className="font-mono text-xs leading-relaxed">
{`
     ┌──────────────────┐
     │  NOT-SIGNED-IN   │ ◄──── [Initial Load / Logout]
     └────────┬─────────┘
              │
      [Sign In Button]
              │
              ▼
     ┌──────────────────┐
     │    SIGNED-IN     │
     └────────┬─────────┘
              │
      [Main UI Visible]
              │
    ┌─────────┴─────────┐
    │                   │
[Run Controls]    [Settings Access]
`}
                      </pre>
                    </div>

                    {/* Panel States */}
                    <div className="border-2 border-gray-800 p-6 bg-white">
                      <div className="font-mono mb-4 text-lg">Floating Panel States</div>
                      <pre className="font-mono text-xs leading-relaxed">
{`
Panel State synchronizes with Run State but has unique UI behaviors:

IDLE STATE
└─ Timeline: Empty or shows "No active job"
   Input: Disabled with message "Start a run to activate"

RUNNING STATE
├─ Timeline: Real-time activity updates streaming
├─ Current Job: Shows job being processed
└─ Input: Enabled for commands (e.g., "skip", "pause")

WAITING-INPUT STATE
├─ Timeline: Last item highlighted with ⚠ warning
├─ Input: Focused and highlighted
├─ Help text: "Type your answer here..."
└─ Auto-resume after submission

PAUSED STATE
├─ Timeline: Frozen at current point
└─ Input: Enabled but shows "Resume to continue"

COMPLETED STATE
├─ Timeline: Shows full history
├─ Success summary displayed
└─ Input: Disabled until new run
`}
                      </pre>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* User Journeys */}
              <TabsContent value="user-journeys" className="mt-6">
                <div className="border-2 border-gray-400 p-6">
                  <h2 className="font-mono text-xl mb-6">USER JOURNEYS</h2>

                  <div className="space-y-6">
                    {/* First-Time User */}
                    <div className="border-2 border-gray-800 p-6 bg-white">
                      <div className="flex items-center gap-2 mb-4">
                        <Circle className="w-4 h-4 fill-current" />
                        <span className="font-mono text-lg">Journey 1: First-Time User</span>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="border border-gray-400 p-3 bg-gray-50">
                          <div className="font-mono text-sm mb-2">STEP 1: Install Extension</div>
                          <div className="text-sm text-gray-700 font-mono pl-4">
                            • User installs from Chrome Web Store<br/>
                            • Extension icon appears in toolbar<br/>
                            • First-time setup notification (optional)
                          </div>
                        </div>

                        <div className="flex justify-center">
                          <ArrowRight className="w-5 h-5 text-gray-400" />
                        </div>

                        <div className="border border-gray-400 p-3 bg-gray-50">
                          <div className="font-mono text-sm mb-2">STEP 2: Open Popup & Sign In</div>
                          <div className="text-sm text-gray-700 font-mono pl-4">
                            • Click extension icon to open popup<br/>
                            • See "Sign in required" message<br/>
                            • Click "Sign In with LinkedIn" button<br/>
                            • Complete OAuth flow in new tab<br/>
                            • Return to popup (now shows "Connected")
                          </div>
                        </div>

                        <div className="flex justify-center">
                          <ArrowRight className="w-5 h-5 text-gray-400" />
                        </div>

                        <div className="border border-gray-400 p-3 bg-gray-50">
                          <div className="font-mono text-sm mb-2">STEP 3: Complete Onboarding</div>
                          <div className="text-sm text-gray-700 font-mono pl-4">
                            • Click "Settings" button<br/>
                            • Fill in profile information (name, email, phone)<br/>
                            • Set search preferences (keywords, location)<br/>
                            • Review safety limits (keep defaults)<br/>
                            • Click "Save Changes"
                          </div>
                        </div>

                        <div className="flex justify-center">
                          <ArrowRight className="w-5 h-5 text-gray-400" />
                        </div>

                        <div className="border border-gray-400 p-3 bg-gray-50">
                          <div className="font-mono text-sm mb-2">STEP 4: Run First Auto-Apply</div>
                          <div className="text-sm text-gray-700 font-mono pl-4">
                            • Return to popup (click Back)<br/>
                            • Navigate to LinkedIn Jobs in separate tab<br/>
                            • Search for desired positions manually<br/>
                            • Floating panel appears automatically<br/>
                            • Click "Start" in popup or floating panel<br/>
                            • Watch real-time progress in floating panel<br/>
                            • If question appears: type answer → submit<br/>
                            • Assistant auto-resumes after input<br/>
                            • Run completes → see final statistics
                          </div>
                        </div>

                        <div className="mt-4 p-3 border border-blue-400 bg-blue-50">
                          <div className="text-sm font-mono text-blue-800">
                            <strong>Expected Duration:</strong> 5-10 minutes for complete onboarding<br/>
                            <strong>Success Criteria:</strong> User successfully submits first application via assistant
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Returning User */}
                    <div className="border-2 border-gray-800 p-6 bg-white">
                      <div className="flex items-center gap-2 mb-4">
                        <Circle className="w-4 h-4 fill-current" />
                        <span className="font-mono text-lg">Journey 2: Returning User</span>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="border border-gray-400 p-3 bg-gray-50">
                          <div className="font-mono text-sm mb-2">STEP 1: Open Popup</div>
                          <div className="text-sm text-gray-700 font-mono pl-4">
                            • Click extension icon<br/>
                            • Already signed in → main UI visible<br/>
                            • See previous run stats (if applicable)
                          </div>
                        </div>

                        <div className="flex justify-center">
                          <ArrowRight className="w-5 h-5 text-gray-400" />
                        </div>

                        <div className="border border-gray-400 p-3 bg-gray-50">
                          <div className="font-mono text-sm mb-2">STEP 2: Verify Status</div>
                          <div className="text-sm text-gray-700 font-mono pl-4">
                            • Check current run status (idle/paused/running)<br/>
                            • Review counters (applied, skipped, failed)<br/>
                            • Optionally check activity logs
                          </div>
                        </div>

                        <div className="flex justify-center">
                          <ArrowRight className="w-5 h-5 text-gray-400" />
                        </div>

                        <div className="border border-gray-400 p-3 bg-gray-50">
                          <div className="font-mono text-sm mb-2">STEP 3: Start or Resume Run</div>
                          <div className="text-sm text-gray-700 font-mono pl-4">
                            • If idle: Click "Start" to begin new run<br/>
                            • If paused: Click "Start" to resume<br/>
                            • Navigate to LinkedIn jobs if needed<br/>
                            • Monitor progress via popup or floating panel
                          </div>
                        </div>

                        <div className="mt-4 p-3 border border-green-400 bg-green-50">
                          <div className="text-sm font-mono text-green-800">
                            <strong>Expected Duration:</strong> {'<'}30 seconds to resume work<br/>
                            <strong>Success Criteria:</strong> User quickly resumes applying without friction
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Interrupted Run */}
                    <div className="border-2 border-gray-800 p-6 bg-white">
                      <div className="flex items-center gap-2 mb-4">
                        <Circle className="w-4 h-4 fill-current" />
                        <span className="font-mono text-lg">Journey 3: Interrupted Run</span>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="border border-gray-400 p-3 bg-gray-50">
                          <div className="font-mono text-sm mb-2">STEP 1: Detect Pause/Error</div>
                          <div className="text-sm text-gray-700 font-mono pl-4">
                            <strong>Scenario A: User Input Required</strong><br/>
                            • Assistant encounters unknown question<br/>
                            • Run auto-pauses to WAITING-INPUT state<br/>
                            • Popup status badge shows "Waiting for Input"<br/>
                            • Footer message: "Action required - Check floating panel"<br/>
                            <br/>
                            <strong>Scenario B: Error Occurred</strong><br/>
                            • Network error or form submission fails<br/>
                            • Run transitions to ERROR state<br/>
                            • Error details logged in activity logs<br/>
                            • Status badge shows "Error"
                          </div>
                        </div>

                        <div className="flex justify-center">
                          <ArrowRight className="w-5 h-5 text-gray-400" />
                        </div>

                        <div className="border border-gray-400 p-3 bg-gray-50">
                          <div className="font-mono text-sm mb-2">STEP 2: Show Reason</div>
                          <div className="text-sm text-gray-700 font-mono pl-4">
                            <strong>For WAITING-INPUT:</strong><br/>
                            • Floating panel shows highlighted question<br/>
                            • Input field focused with clear label<br/>
                            • Example answer or hint provided (if available)<br/>
                            <br/>
                            <strong>For ERROR:</strong><br/>
                            • Activity logs show error details<br/>
                            • Expandable logs section shows full trace<br/>
                            • Suggestion for resolution (if known)
                          </div>
                        </div>

                        <div className="flex justify-center">
                          <ArrowRight className="w-5 h-5 text-gray-400" />
                        </div>

                        <div className="border border-gray-400 p-3 bg-gray-50">
                          <div className="font-mono text-sm mb-2">STEP 3: Provide Next Best Action</div>
                          <div className="text-sm text-gray-700 font-mono pl-4">
                            <strong>For WAITING-INPUT:</strong><br/>
                            • Type answer in floating panel input<br/>
                            • Press Enter or click Send<br/>
                            • Assistant auto-resumes from same point<br/>
                            • Continue watching progress<br/>
                            <br/>
                            <strong>For ERROR:</strong><br/>
                            • Option 1: Click "Start" to retry (skips failed job)<br/>
                            • Option 2: Click "Stop" to end run and review<br/>
                            • Option 3: Copy logs and adjust settings<br/>
                            • Footer provides clear next step
                          </div>
                        </div>

                        <div className="mt-4 p-3 border border-yellow-400 bg-yellow-50">
                          <div className="text-sm font-mono text-yellow-800">
                            <strong>Recovery Success:</strong> User understands issue and takes appropriate action<br/>
                            <strong>Key UX Principle:</strong> Never leave user confused about what to do next
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Edge Cases */}
                    <div className="border border-gray-400 p-4 bg-gray-50">
                      <div className="font-mono mb-3">Additional Journey Considerations</div>
                      <div className="space-y-2 text-sm font-mono">
                        <div>
                          <strong>• Daily Limit Reached:</strong> Clear notification → prompt to adjust settings or return tomorrow
                        </div>
                        <div>
                          <strong>• Session Expired:</strong> Detect auth failure → show re-login prompt → preserve run state if possible
                        </div>
                        <div>
                          <strong>• LinkedIn UI Changed:</strong> Detection failure → pause run → notify user → offer manual mode or update check
                        </div>
                        <div>
                          <strong>• Multiple Tabs:</strong> Warn user if LinkedIn is open in multiple tabs → suggest closing duplicates
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Component List */}
              <TabsContent value="components" className="mt-6">
                <div className="border-2 border-gray-400 p-6">
                  <h2 className="font-mono text-xl mb-6">COMPONENT LIST WITH PURPOSE</h2>

                  <div className="space-y-6">
                    {/* Popup Components */}
                    <div className="border-2 border-gray-800 p-4">
                      <div className="font-mono text-lg mb-4">POPUP SCREEN COMPONENTS</div>
                      
                      <div className="space-y-3">
                        <div className="grid grid-cols-3 gap-4 border-b border-gray-300 pb-2 text-xs font-mono text-gray-600">
                          <div>Component</div>
                          <div>Type</div>
                          <div>Purpose</div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-sm font-mono items-start border-b border-gray-200 pb-3">
                          <div className="font-bold">Header</div>
                          <div className="text-gray-600">Section</div>
                          <div className="text-gray-700">Display product name and current run status at a glance</div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-sm font-mono items-start border-b border-gray-200 pb-3">
                          <div className="font-bold">Status Badge</div>
                          <div className="text-gray-600">Indicator</div>
                          <div className="text-gray-700">Visual state indicator (idle/running/paused/waiting/error/completed)</div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-sm font-mono items-start border-b border-gray-200 pb-3">
                          <div className="font-bold">Account State</div>
                          <div className="text-gray-600">Section</div>
                          <div className="text-gray-700">Show auth status; provide sign-in if needed; display user identity when connected</div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-sm font-mono items-start border-b border-gray-200 pb-3">
                          <div className="font-bold">Sign In Button</div>
                          <div className="text-gray-600">Action</div>
                          <div className="text-gray-700">Initiate LinkedIn OAuth flow (only shown when not signed in)</div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-sm font-mono items-start border-b border-gray-200 pb-3">
                          <div className="font-bold">User Identity</div>
                          <div className="text-gray-600">Display</div>
                          <div className="text-gray-700">Show connected account info (avatar, email) for confirmation</div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-sm font-mono items-start border-b border-gray-200 pb-3">
                          <div className="font-bold">Current Run Summary</div>
                          <div className="text-gray-600">Section</div>
                          <div className="text-gray-700">Describe what's happening now in plain language (e.g., "Applying to Software Engineer positions...")</div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-sm font-mono items-start border-b border-gray-200 pb-3">
                          <div className="font-bold">Counters (3x)</div>
                          <div className="text-gray-600">Metrics</div>
                          <div className="text-gray-700">Display applied/skipped/failed counts for quick performance assessment</div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-sm font-mono items-start border-b border-gray-200 pb-3">
                          <div className="font-bold">Start Button</div>
                          <div className="text-gray-600">Primary Action</div>
                          <div className="text-gray-700">Begin new run or resume paused run</div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-sm font-mono items-start border-b border-gray-200 pb-3">
                          <div className="font-bold">Pause Button</div>
                          <div className="text-gray-600">Primary Action</div>
                          <div className="text-gray-700">Temporarily halt current run (preserves state)</div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-sm font-mono items-start border-b border-gray-200 pb-3">
                          <div className="font-bold">Stop Button</div>
                          <div className="text-gray-600">Primary Action</div>
                          <div className="text-gray-700">End current run and reset to idle state</div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-sm font-mono items-start border-b border-gray-200 pb-3">
                          <div className="font-bold">LinkedIn Jobs Link</div>
                          <div className="text-gray-600">Secondary Action</div>
                          <div className="text-gray-700">Quick navigation to LinkedIn jobs search page</div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-sm font-mono items-start border-b border-gray-200 pb-3">
                          <div className="font-bold">Settings Link</div>
                          <div className="text-gray-600">Secondary Action</div>
                          <div className="text-gray-700">Navigate to full settings page</div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-sm font-mono items-start border-b border-gray-200 pb-3">
                          <div className="font-bold">Activity Logs</div>
                          <div className="text-gray-600">Section</div>
                          <div className="text-gray-700">Collapsible log viewer showing recent actions with timestamps</div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-sm font-mono items-start border-b border-gray-200 pb-3">
                          <div className="font-bold">Log Entries</div>
                          <div className="text-gray-600">List Items</div>
                          <div className="text-gray-700">Individual activity records with time, type (success/error/info), and message</div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-sm font-mono items-start border-b border-gray-200 pb-3">
                          <div className="font-bold">Copy Logs Button</div>
                          <div className="text-gray-600">Action</div>
                          <div className="text-gray-700">Copy all logs to clipboard for sharing or debugging</div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-sm font-mono items-start border-b border-gray-200 pb-3">
                          <div className="font-bold">Clear Logs Button</div>
                          <div className="text-gray-600">Action</div>
                          <div className="text-gray-700">Remove all log entries from view (doesn't affect current run)</div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-sm font-mono items-start">
                          <div className="font-bold">Footer Status</div>
                          <div className="text-gray-600">Feedback</div>
                          <div className="text-gray-700">Concise status message contextual to current state</div>
                        </div>
                      </div>
                    </div>

                    {/* Floating Panel Components */}
                    <div className="border-2 border-gray-800 p-4">
                      <div className="font-mono text-lg mb-4">FLOATING PANEL COMPONENTS</div>
                      
                      <div className="space-y-3">
                        <div className="grid grid-cols-3 gap-4 border-b border-gray-300 pb-2 text-xs font-mono text-gray-600">
                          <div>Component</div>
                          <div>Type</div>
                          <div>Purpose</div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-sm font-mono items-start border-b border-gray-200 pb-3">
                          <div className="font-bold">Panel Header</div>
                          <div className="text-gray-600">Section</div>
                          <div className="text-gray-700">Identify panel and show current state with visual badge</div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-sm font-mono items-start border-b border-gray-200 pb-3">
                          <div className="font-bold">Quick Controls</div>
                          <div className="text-gray-600">Action Group</div>
                          <div className="text-gray-700">Duplicate Start/Pause/Stop buttons for convenience while on LinkedIn</div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-sm font-mono items-start border-b border-gray-200 pb-3">
                          <div className="font-bold">Current Job Context</div>
                          <div className="text-gray-600">Display</div>
                          <div className="text-gray-700">Show which job is being processed right now with company and title</div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-sm font-mono items-start border-b border-gray-200 pb-3">
                          <div className="font-bold">Current Step</div>
                          <div className="text-gray-600">Display</div>
                          <div className="text-gray-700">Describe current action (e.g., "Filling application form...")</div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-sm font-mono items-start border-b border-gray-200 pb-3">
                          <div className="font-bold">Activity Timeline</div>
                          <div className="text-gray-600">Section</div>
                          <div className="text-gray-700">Scrollable chat-like history of all steps taken for current job</div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-sm font-mono items-start border-b border-gray-200 pb-3">
                          <div className="font-bold">Timeline Entry</div>
                          <div className="text-gray-600">List Item</div>
                          <div className="text-gray-700">Individual step with icon (✓/!/✗), timestamp, description, and details</div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-sm font-mono items-start border-b border-gray-200 pb-3">
                          <div className="font-bold">Question Highlight</div>
                          <div className="text-gray-600">State Indicator</div>
                          <div className="text-gray-700">Visual emphasis on timeline entry requiring user input</div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-sm font-mono items-start border-b border-gray-200 pb-3">
                          <div className="font-bold">User Input Field</div>
                          <div className="text-gray-600">Input</div>
                          <div className="text-gray-700">Text input for answering questions or sending commands</div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-sm font-mono items-start border-b border-gray-200 pb-3">
                          <div className="font-bold">Send Button</div>
                          <div className="text-gray-600">Action</div>
                          <div className="text-gray-700">Submit user response (triggers auto-resume if in waiting state)</div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-sm font-mono items-start">
                          <div className="font-bold">State Indicator</div>
                          <div className="text-gray-600">Feedback</div>
                          <div className="text-gray-700">Bottom-bar message explaining current panel mode and behavior</div>
                        </div>
                      </div>
                    </div>

                    {/* Settings Components */}
                    <div className="border-2 border-gray-800 p-4">
                      <div className="font-mono text-lg mb-4">SETTINGS PAGE COMPONENTS</div>
                      
                      <div className="space-y-3">
                        <div className="grid grid-cols-3 gap-4 border-b border-gray-300 pb-2 text-xs font-mono text-gray-600">
                          <div>Component</div>
                          <div>Type</div>
                          <div>Purpose</div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-sm font-mono items-start border-b border-gray-200 pb-3">
                          <div className="font-bold">Settings Header</div>
                          <div className="text-gray-600">Section</div>
                          <div className="text-gray-700">Navigation (back to popup), title, and save/reset actions</div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-sm font-mono items-start border-b border-gray-200 pb-3">
                          <div className="font-bold">Back Button</div>
                          <div className="text-gray-600">Navigation</div>
                          <div className="text-gray-700">Return to popup view</div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-sm font-mono items-start border-b border-gray-200 pb-3">
                          <div className="font-bold">Save Button</div>
                          <div className="text-gray-600">Action</div>
                          <div className="text-gray-700">Validate and persist all setting changes</div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-sm font-mono items-start border-b border-gray-200 pb-3">
                          <div className="font-bold">Reset Button</div>
                          <div className="text-gray-600">Action</div>
                          <div className="text-gray-700">Restore all settings to factory defaults (with confirmation)</div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-sm font-mono items-start border-b border-gray-200 pb-3">
                          <div className="font-bold">Safety Limits Section</div>
                          <div className="text-gray-600">Group</div>
                          <div className="text-gray-700">Controls to prevent account issues: max apps, daily limit, delays, auto-behaviors</div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-sm font-mono items-start border-b border-gray-200 pb-3">
                          <div className="font-bold">Search Preferences</div>
                          <div className="text-gray-600">Group</div>
                          <div className="text-gray-700">Define target jobs: keywords, location, experience level filters</div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-sm font-mono items-start border-b border-gray-200 pb-3">
                          <div className="font-bold">Profile Section</div>
                          <div className="text-gray-600">Group</div>
                          <div className="text-gray-700">Personal info for auto-fill: name, email, phone, experience, cover letter</div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-sm font-mono items-start border-b border-gray-200 pb-3">
                          <div className="font-bold">Advanced Section</div>
                          <div className="text-gray-600">Group (Collapsible)</div>
                          <div className="text-gray-700">Expert settings: debug mode, retry attempts, timeouts (hidden by default)</div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-sm font-mono items-start border-b border-gray-200 pb-3">
                          <div className="font-bold">Input Fields</div>
                          <div className="text-gray-600">Form Controls</div>
                          <div className="text-gray-700">Text, number, and textarea inputs with labels and help text</div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-sm font-mono items-start border-b border-gray-200 pb-3">
                          <div className="font-bold">Toggle Switches</div>
                          <div className="text-gray-600">Form Controls</div>
                          <div className="text-gray-700">Binary on/off settings with clear labels and descriptions</div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-sm font-mono items-start border-b border-gray-200 pb-3">
                          <div className="font-bold">Field Descriptions</div>
                          <div className="text-gray-600">Help Text</div>
                          <div className="text-gray-700">Explain what each setting affects and recommended values</div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-sm font-mono items-start border-b border-gray-200 pb-3">
                          <div className="font-bold">Save Confirmation</div>
                          <div className="text-gray-600">Feedback</div>
                          <div className="text-gray-700">Visual success message after settings are saved</div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-sm font-mono items-start">
                          <div className="font-bold">Info Section</div>
                          <div className="text-gray-600">Help</div>
                          <div className="text-gray-700">Tips, privacy notes, and usage guidelines at bottom of page</div>
                        </div>
                      </div>
                    </div>

                    {/* Shared Components */}
                    <div className="border border-gray-400 p-4 bg-gray-50">
                      <div className="font-mono mb-3">SHARED UI PATTERNS</div>
                      <div className="space-y-2 text-sm font-mono">
                        <div>
                          <strong>• Borders & Wireframe Style:</strong> All components use visible borders (gray-400/800) to emphasize structure over aesthetics
                        </div>
                        <div>
                          <strong>• Monospace Font:</strong> Used throughout for a technical, blueprint-like appearance
                        </div>
                        <div>
                          <strong>• Status Badges:</strong> Consistent visual language for states across all screens
                        </div>
                        <div>
                          <strong>• Icon + Text Pattern:</strong> All actions pair icons with text labels for clarity
                        </div>
                        <div>
                          <strong>• Progressive Disclosure:</strong> Advanced/less-used features hidden in collapsible sections
                        </div>
                        <div>
                          <strong>• Contextual Help:</strong> Small gray helper text appears below inputs to guide users
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}