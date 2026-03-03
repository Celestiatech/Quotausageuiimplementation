import { useState } from "react";
import { Link } from "react-router";
import { ChevronDown, ChevronUp, ArrowLeft, Save, RotateCcw, AlertCircle, Settings2 } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Separator } from "./ui/separator";
import { Switch } from "./ui/switch";
import { ScrollArea } from "./ui/scroll-area";
import { Textarea } from "./ui/textarea";

export function SettingsView() {
  const [advancedExpanded, setAdvancedExpanded] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  // Form state
  const [maxApplications, setMaxApplications] = useState("50");
  const [dailyLimit, setDailyLimit] = useState("100");
  const [delayBetweenApps, setDelayBetweenApps] = useState("5");
  
  const [searchKeywords, setSearchKeywords] = useState("Software Engineer");
  const [locationFilter, setLocationFilter] = useState("Remote");
  const [experienceLevel, setExperienceLevel] = useState("Mid-Senior");
  
  const [fullName, setFullName] = useState("John Doe");
  const [email, setEmail] = useState("john.doe@example.com");
  const [phone, setPhone] = useState("+1 234 567 8900");
  const [yearsExperience, setYearsExperience] = useState("5");
  const [defaultCoverLetter, setDefaultCoverLetter] = useState("");
  
  const [autoSkipApplied, setAutoSkipApplied] = useState(true);
  const [pauseOnError, setPauseOnError] = useState(true);
  const [debugMode, setDebugMode] = useState(false);

  const handleSave = () => {
    setSaveStatus("saving");
    setTimeout(() => {
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    }, 1000);
  };

  const handleReset = () => {
    if (confirm("Reset all settings to defaults?")) {
      // Reset logic here
    }
  };

  return (
    <div className="w-full min-h-screen relative overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-violet-500/20 via-fuchsia-500/20 to-pink-500/20 animate-gradient-shift"></div>
      <div className="absolute inset-0 bg-gradient-to-tl from-blue-500/10 via-transparent to-purple-500/10 animate-pulse-slow"></div>
      
      {/* Glass container */}
      <div className="relative min-h-screen backdrop-blur-2xl bg-white/5">
        {/* Header */}
        <div className="sticky top-0 z-50 backdrop-blur-xl bg-white/10 border-b border-white/20 shadow-xl">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-pink-500/5"></div>
          <div className="relative max-w-5xl mx-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <Link to="/">
                  <Button variant="outline" size="sm" className="backdrop-blur-lg bg-white/10 border border-white/30 hover:bg-white/20 text-white shadow-lg">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                </Link>
                <div className="flex items-center gap-2 backdrop-blur-lg bg-white/20 border border-white/30 px-4 py-2 rounded-xl shadow-lg">
                  <Settings2 className="w-5 h-5 text-purple-300" />
                  <span className="text-lg font-semibold bg-gradient-to-r from-purple-200 to-pink-200 bg-clip-text text-transparent">
                    Settings
                  </span>
                </div>
              </div>
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleReset}
                  className="backdrop-blur-lg bg-white/10 border border-white/30 hover:bg-white/20 text-white shadow-lg"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reset
                </Button>
                <Button 
                  size="sm" 
                  onClick={handleSave}
                  disabled={saveStatus !== "idle"}
                  className="backdrop-blur-lg bg-gradient-to-r from-purple-500/80 to-pink-500/80 hover:from-purple-500/90 hover:to-pink-500/90 border border-white/30 text-white shadow-xl"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {saveStatus === "saving" && "Saving..."}
                  {saveStatus === "saved" && "Saved!"}
                  {saveStatus === "idle" && "Save Changes"}
                </Button>
              </div>
            </div>
            {saveStatus === "saved" && (
              <div className="backdrop-blur-lg bg-green-500/20 border border-green-300/30 rounded-xl p-3 shadow-lg">
                <div className="text-sm text-green-100 flex items-center gap-2">
                  <span>✓</span> Settings saved successfully
                </div>
              </div>
            )}
          </div>
        </div>

        <ScrollArea className="h-[calc(100vh-120px)]">
          <div className="max-w-5xl mx-auto p-6 space-y-6">
            
            {/* Safety Settings */}
            <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-6 shadow-2xl">
              <div className="flex items-start gap-3 mb-6">
                <div className="backdrop-blur-lg bg-gradient-to-br from-red-400/30 to-orange-400/30 border border-white/30 rounded-xl p-3 shadow-lg">
                  <AlertCircle className="w-6 h-6 text-orange-200" />
                </div>
                <div>
                  <div className="text-xl font-bold text-white mb-1">Safety Limits</div>
                  <div className="text-sm text-white/60">
                    Controls to prevent excessive usage and protect your account
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="backdrop-blur-lg bg-white/5 border border-white/20 rounded-2xl p-4">
                    <Label htmlFor="maxApps" className="text-xs font-semibold text-white/60 mb-2 block uppercase tracking-wider">
                      Max applications per run
                    </Label>
                    <Input
                      id="maxApps"
                      type="number"
                      value={maxApplications}
                      onChange={(e) => setMaxApplications(e.target.value)}
                      className="backdrop-blur-lg bg-white/10 border-2 border-white/30 text-white placeholder:text-white/40 shadow-lg"
                    />
                    <div className="text-xs text-white/50 mt-2">
                      Stop after this many applications
                    </div>
                  </div>

                  <div className="backdrop-blur-lg bg-white/5 border border-white/20 rounded-2xl p-4">
                    <Label htmlFor="dailyLimit" className="text-xs font-semibold text-white/60 mb-2 block uppercase tracking-wider">
                      Daily application limit
                    </Label>
                    <Input
                      id="dailyLimit"
                      type="number"
                      value={dailyLimit}
                      onChange={(e) => setDailyLimit(e.target.value)}
                      className="backdrop-blur-lg bg-white/10 border-2 border-white/30 text-white placeholder:text-white/40 shadow-lg"
                    />
                    <div className="text-xs text-white/50 mt-2">
                      Maximum per 24-hour period
                    </div>
                  </div>
                </div>

                <div className="backdrop-blur-lg bg-white/5 border border-white/20 rounded-2xl p-4">
                  <Label htmlFor="delay" className="text-xs font-semibold text-white/60 mb-2 block uppercase tracking-wider">
                    Delay between applications (seconds)
                  </Label>
                  <Input
                    id="delay"
                    type="number"
                    value={delayBetweenApps}
                    onChange={(e) => setDelayBetweenApps(e.target.value)}
                    className="backdrop-blur-lg bg-white/10 border-2 border-white/30 text-white placeholder:text-white/40 shadow-lg w-64"
                  />
                  <div className="text-xs text-white/50 mt-2">
                    Recommended: 5-10 seconds to avoid detection
                  </div>
                </div>

                <Separator className="bg-white/20" />

                <div className="flex items-start justify-between p-4 backdrop-blur-lg bg-white/5 border border-white/20 rounded-2xl">
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-white mb-1">Auto-skip already applied jobs</div>
                    <div className="text-xs text-white/60">
                      Skip jobs you've already applied to
                    </div>
                  </div>
                  <Switch
                    checked={autoSkipApplied}
                    onCheckedChange={setAutoSkipApplied}
                    className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-purple-500 data-[state=checked]:to-pink-500"
                  />
                </div>

                <div className="flex items-start justify-between p-4 backdrop-blur-lg bg-white/5 border border-white/20 rounded-2xl">
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-white mb-1">Pause on error</div>
                    <div className="text-xs text-white/60">
                      Stop the run if an error occurs
                    </div>
                  </div>
                  <Switch
                    checked={pauseOnError}
                    onCheckedChange={setPauseOnError}
                    className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-purple-500 data-[state=checked]:to-pink-500"
                  />
                </div>
              </div>
            </div>

            {/* Search Preferences */}
            <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-6 shadow-2xl">
              <div className="text-xl font-bold text-white mb-1">Search Preferences</div>
              <div className="text-sm text-white/60 mb-6">
                Define what jobs to target during auto-apply runs
              </div>

              <div className="space-y-5">
                <div className="backdrop-blur-lg bg-white/5 border border-white/20 rounded-2xl p-4">
                  <Label htmlFor="keywords" className="text-xs font-semibold text-white/60 mb-2 block uppercase tracking-wider">
                    Search keywords
                  </Label>
                  <Input
                    id="keywords"
                    value={searchKeywords}
                    onChange={(e) => setSearchKeywords(e.target.value)}
                    className="backdrop-blur-lg bg-white/10 border-2 border-white/30 text-white placeholder:text-white/40 shadow-lg"
                    placeholder="e.g., Software Engineer, Frontend Developer"
                  />
                  <div className="text-xs text-white/50 mt-2">
                    Job titles or keywords to search for
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="backdrop-blur-lg bg-white/5 border border-white/20 rounded-2xl p-4">
                    <Label htmlFor="location" className="text-xs font-semibold text-white/60 mb-2 block uppercase tracking-wider">
                      Location filter
                    </Label>
                    <Input
                      id="location"
                      value={locationFilter}
                      onChange={(e) => setLocationFilter(e.target.value)}
                      className="backdrop-blur-lg bg-white/10 border-2 border-white/30 text-white placeholder:text-white/40 shadow-lg"
                      placeholder="e.g., Remote, San Francisco"
                    />
                  </div>

                  <div className="backdrop-blur-lg bg-white/5 border border-white/20 rounded-2xl p-4">
                    <Label htmlFor="experience" className="text-xs font-semibold text-white/60 mb-2 block uppercase tracking-wider">
                      Experience level
                    </Label>
                    <Input
                      id="experience"
                      value={experienceLevel}
                      onChange={(e) => setExperienceLevel(e.target.value)}
                      className="backdrop-blur-lg bg-white/10 border-2 border-white/30 text-white placeholder:text-white/40 shadow-lg"
                      placeholder="e.g., Entry, Mid-Senior"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Profile & Default Answers */}
            <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-6 shadow-2xl">
              <div className="text-xl font-bold text-white mb-1">Profile & Default Answers</div>
              <div className="text-sm text-white/60 mb-6">
                Your information used to auto-fill application forms
              </div>

              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="backdrop-blur-lg bg-white/5 border border-white/20 rounded-2xl p-4">
                    <Label htmlFor="fullName" className="text-xs font-semibold text-white/60 mb-2 block uppercase tracking-wider">
                      Full name
                    </Label>
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="backdrop-blur-lg bg-white/10 border-2 border-white/30 text-white placeholder:text-white/40 shadow-lg"
                    />
                  </div>

                  <div className="backdrop-blur-lg bg-white/5 border border-white/20 rounded-2xl p-4">
                    <Label htmlFor="email" className="text-xs font-semibold text-white/60 mb-2 block uppercase tracking-wider">
                      Email address
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="backdrop-blur-lg bg-white/10 border-2 border-white/30 text-white placeholder:text-white/40 shadow-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="backdrop-blur-lg bg-white/5 border border-white/20 rounded-2xl p-4">
                    <Label htmlFor="phone" className="text-xs font-semibold text-white/60 mb-2 block uppercase tracking-wider">
                      Phone number
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="backdrop-blur-lg bg-white/10 border-2 border-white/30 text-white placeholder:text-white/40 shadow-lg"
                    />
                  </div>

                  <div className="backdrop-blur-lg bg-white/5 border border-white/20 rounded-2xl p-4">
                    <Label htmlFor="years" className="text-xs font-semibold text-white/60 mb-2 block uppercase tracking-wider">
                      Years of experience
                    </Label>
                    <Input
                      id="years"
                      type="number"
                      value={yearsExperience}
                      onChange={(e) => setYearsExperience(e.target.value)}
                      className="backdrop-blur-lg bg-white/10 border-2 border-white/30 text-white placeholder:text-white/40 shadow-lg"
                    />
                  </div>
                </div>

                <div className="backdrop-blur-lg bg-white/5 border border-white/20 rounded-2xl p-4">
                  <Label htmlFor="coverLetter" className="text-xs font-semibold text-white/60 mb-2 block uppercase tracking-wider">
                    Default cover letter (optional)
                  </Label>
                  <Textarea
                    id="coverLetter"
                    value={defaultCoverLetter}
                    onChange={(e) => setDefaultCoverLetter(e.target.value)}
                    className="backdrop-blur-lg bg-white/10 border-2 border-white/30 text-white placeholder:text-white/40 shadow-lg min-h-[120px]"
                    placeholder="Enter a default cover letter that will be used when required..."
                  />
                  <div className="text-xs text-white/50 mt-2">
                    Used when a cover letter field is detected
                  </div>
                </div>
              </div>
            </div>

            {/* Advanced Settings */}
            <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl shadow-2xl overflow-hidden">
              <button
                onClick={() => setAdvancedExpanded(!advancedExpanded)}
                className="w-full p-6 flex items-center justify-between hover:bg-white/5 transition-colors"
              >
                <div className="text-left">
                  <div className="text-xl font-bold text-white mb-1">Advanced Behavior</div>
                  <div className="text-sm text-white/60">
                    Expert settings for fine-tuning assistant behavior
                  </div>
                </div>
                {advancedExpanded ? <ChevronUp className="w-6 h-6 text-white/60" /> : <ChevronDown className="w-6 h-6 text-white/60" />}
              </button>

              {advancedExpanded && (
                <div className="border-t border-white/20 p-6 backdrop-blur-lg bg-white/5">
                  <div className="space-y-5">
                    <div className="flex items-start justify-between p-4 backdrop-blur-lg bg-white/10 border border-white/20 rounded-2xl">
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-white mb-1">Debug mode</div>
                        <div className="text-xs text-white/60">
                          Show detailed logs and diagnostic information
                        </div>
                      </div>
                      <Switch
                        checked={debugMode}
                        onCheckedChange={setDebugMode}
                        className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-purple-500 data-[state=checked]:to-pink-500"
                      />
                    </div>

                    <div className="backdrop-blur-lg bg-white/5 border border-white/20 rounded-2xl p-4">
                      <Label className="text-xs font-semibold text-white/60 mb-2 block uppercase tracking-wider">
                        Retry attempts on failure
                      </Label>
                      <Input
                        type="number"
                        defaultValue="3"
                        className="backdrop-blur-lg bg-white/10 border-2 border-white/30 text-white placeholder:text-white/40 shadow-lg w-40"
                      />
                      <div className="text-xs text-white/50 mt-2">
                        How many times to retry a failed application
                      </div>
                    </div>

                    <div className="backdrop-blur-lg bg-white/5 border border-white/20 rounded-2xl p-4">
                      <Label className="text-xs font-semibold text-white/60 mb-2 block uppercase tracking-wider">
                        Timeout per application (seconds)
                      </Label>
                      <Input
                        type="number"
                        defaultValue="60"
                        className="backdrop-blur-lg bg-white/10 border-2 border-white/30 text-white placeholder:text-white/40 shadow-lg w-40"
                      />
                      <div className="text-xs text-white/50 mt-2">
                        Maximum time to spend on each application
                      </div>
                    </div>

                    <Separator className="bg-white/20" />

                    <div className="p-4 backdrop-blur-lg bg-amber-500/20 border border-amber-300/30 rounded-2xl">
                      <div className="text-sm text-amber-100 flex items-center gap-2">
                        <span className="text-lg">⚠</span> 
                        <span>Warning: Modifying advanced settings may affect assistant performance</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Info Section */}
            <div className="backdrop-blur-xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-white/20 rounded-3xl p-6 shadow-xl">
              <div className="space-y-3 text-sm text-white/80">
                <div className="flex items-start gap-3">
                  <span className="text-xl">💡</span>
                  <div>
                    <strong className="text-white">Tip:</strong> Start with conservative limits until you're comfortable with the assistant's behavior.
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-xl">🔒</span>
                  <div>
                    <strong className="text-white">Privacy:</strong> Your profile data is stored locally and never sent to external servers.
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-xl">📝</span>
                  <div>
                    <strong className="text-white">Note:</strong> Changes take effect immediately for new runs. Active runs continue with previous settings.
                  </div>
                </div>
              </div>
            </div>

          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
