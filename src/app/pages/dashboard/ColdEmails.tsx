"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Search,
  Mail,
  Send,
  User,
  Building2,
  Linkedin,
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Copy,
  Check,
  ExternalLink,
  Download,
  Play,
  Square,
  Target,
  Briefcase,
  Hash,
  ChevronDown,
  MailCheck,
  Users,
  Zap,
  FileText,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CollectedHR {
  id: string;
  name: string;
  title: string;
  company: string;
  email: string;
  phone?: string;
  category: string;
  linkedinUrl: string;
  sourcePostUrl?: string;
  collectedAt: string;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  textContent: string;
  category: string;
}

type Tab = "collect" | "list" | "templates";

// ─── Built-in Cold Email Templates ────────────────────────────────────────────

const BUILTIN_TEMPLATES: EmailTemplate[] = [
  {
    id: "cold-short",
    name: "Impact-driven",
    subject: "{role} with {skills} — quick intro for {company}",
    category: "cold-outreach",
    textContent: `Hi {name},

I came across {company} and I'm genuinely impressed by what you're building. I'm reaching out because I believe my background in {field} could be a strong fit for your team.

About me:
• {years}+ years of experience in {field}
• Core strengths: {skills}
• Based in {location}

I'd love to jump on a quick 10-minute call this week to discuss how I can contribute to {company}'s success.

Best,
{senderName}
{senderEmail} | {senderPhone}
{senderLinkedin}`,
  },
  {
    id: "value-based",
    name: "Value-First",
    subject: "Adding value at {company} as a {role}",
    category: "cold-outreach",
    textContent: `Hi {name},

I've been following {company}'s recent work and I'm excited about the direction you're heading. Your focus on innovation aligns perfectly with my experience.

Here's what I bring to the table:
• {years}+ years of experience in {field}
• Skilled in: {skills}
• Track record of delivering {results}
• {location}-based, ready to hit the ground running

I'd love the opportunity to share my portfolio and discuss how I can contribute to your upcoming projects.

Looking forward to connecting,
{senderName}
{senderEmail}
{senderLinkedin}`,
  },
  {
    id: "high-converting",
    name: "Professional (Formal)",
    subject: "Application for {role} position at {company}",
    category: "cold-outreach",
    textContent: `Dear {name},

I am writing to express my strong interest in the {role} role at {company}. With {years} years of comprehensive experience in {field}, I have a proven track record of delivering measurable results.

My expertise spans:
• {skills}
• {years}+ years delivering {results}
• Strong background in {field}

I would welcome the opportunity to discuss how my experience aligns with {company}'s objectives. I've attached my resume for your review and am available for an interview at your convenience.

Thank you for your time and consideration.

Sincerely,
{senderName}
{senderEmail} | {senderPhone}
{senderLinkedin} | {senderPortfolio}`,
  },
  {
    id: "remote-us-ca",
    name: "Remote-Ready (US/CA)",
    subject: "Remote {role} — {years}+ years, available immediately",
    category: "cold-outreach",
    textContent: `Hi {name},

I noticed {company} is actively growing and I'm reaching out because I believe my skills as a {role} would be a great addition to your team.

I am a remote-first professional based in {location} with {years}+ years of experience in {field}. I've successfully collaborated across time zones and delivered high-impact results:

• Technical skills: {skills}
• Proven track record: {results}
• Fully equipped for remote work with a reliable setup

I'd love to connect briefly to discuss how I can help {company} achieve its goals.

Best regards,
{senderName}
{senderEmail}
{senderLinkedin}`,
  },
  {
    id: "bold-direct",
    name: "Bold & Direct",
    subject: "{role} — I can help {company} scale",
    category: "cold-outreach",
    textContent: `Hi {name},

I'll keep this brief: I'm a {role} with {years}+ years in {field} and a strong track record of delivering results. I've been watching {company} and I know I can contribute immediately.

Key highlights:
• {skills}
• {years}+ years shipping production-grade work
• Based in {location} — remote or onsite

I'm not sending a generic application — I genuinely believe I can move the needle for {company}. Let's set up a 10-minute call this week.

Let's talk,
{senderName}
{senderEmail} | {senderPhone}
{senderLinkedin}`,
  },
  {
    id: "storytelling",
    name: "Storytelling",
    subject: "My journey in {field} — and why {company} caught my eye",
    category: "cold-outreach",
    textContent: `Hi {name},

I'll be honest — I don't usually reach out to companies cold. But when I came across {company}, something clicked.

I've spent the last {years} years building my career in {field}, working on challenging problems and delivering real results. My core strengths — {skills} — have helped me ship products that users love and stakeholders trust.

I'm currently exploring {role} opportunities and would love to see if my background aligns with what {company} needs next. I've attached my portfolio for a deeper look.

Would you have 10 minutes this week for a quick chat?

Warmly,
{senderName}
{senderEmail}
{senderLinkedin} | {senderPortfolio}`,
  },
];

const CATEGORY_OPTIONS = [
  "Software Engineering",
  "Product Management",
  "Design / UX",
  "Data Science / AI",
  "Marketing",
  "Sales",
  "Finance",
  "HR / People Ops",
  "Operations",
  "Customer Success",
  "DevOps / Cloud",
  "Cybersecurity",
];

const KEYWORD_SUGGESTIONS = [
  "we are hiring software engineer",
  "we are hiring product manager",
  "we are hiring data scientist",
  "we are hiring designer",
  "we are hiring remote developer",
  "now hiring full stack",
  "hiring frontend engineer",
  "hiring backend developer",
  "open positions java developer",
  "looking for talented engineers",
];

const MAX_CONTACTS = 100;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadContacts(): CollectedHR[] {
  try {
    const saved = localStorage.getItem("cold_emails_contacts");
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return [];
}

function saveContacts(contacts: CollectedHR[]) {
  localStorage.setItem("cold_emails_contacts", JSON.stringify(contacts));
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ColdEmails() {
  const [activeTab, setActiveTab] = useState<Tab>("collect");

  // ── Collect Tab State ──
  const [keyword, setKeyword] = useState("we are hiring software engineer");
  const [timeRange, setTimeRange] = useState("any");
  const [isCollecting, setIsCollecting] = useState(false);
  const [collectStatus, setCollectStatus] = useState("");

  // ── Extension state ──
  const [extensionConnected, setExtensionConnected] = useState(false);
  const [extensionChecking, setExtensionChecking] = useState(true);
  const [extCount, setExtCount] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const detectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── List Tab State ──
  const [contacts, setContacts] = useState<CollectedHR[]>(() => loadContacts());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newContact, setNewContact] = useState({
    name: "", title: "", company: "", email: "", phone: "", category: "", linkedinUrl: "",
  });

  // ── Templates tab ──
  const [copiedTemplateId, setCopiedTemplateId] = useState<string | null>(null);

  // ── Persist contacts ──
  useEffect(() => {
    saveContacts(contacts);
  }, [contacts]);

  // ── hroRpc ─────────────────────────────────────────────────────────────────
  const hroRpc = useCallback((type: string, extra?: Record<string, unknown>, timeoutMs = 5000): Promise<any> => {
    return new Promise((resolve, reject) => {
      const _id = `hro_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const timer = setTimeout(() => {
        window.removeEventListener("message", onRes);
        reject(new Error("timeout"));
      }, timeoutMs);
      function onRes(event: MessageEvent) {
        const d = event.data;
        if (d?._src === "hro_bridge" && d?.type === "HRO_RES" && d?._id === _id) {
          clearTimeout(timer);
          window.removeEventListener("message", onRes);
          if (d.error) reject(new Error(d.error));
          else resolve(d.data);
        }
      }
      window.addEventListener("message", onRes);
      window.postMessage({ _src: "webapp", type, _id, ...extra }, "*");
    });
  }, []);

  // ── Sync from extension ──
  const syncFromExtension = useCallback(async () => {
    try {
      const res = await hroRpc("HRO_GET_CONTACTS", undefined, 4000);
      if (res?.contacts) {
        setExtCount(res.count || res.contacts.length || 0);
        setExtensionConnected(true);
        setContacts((prev) => {
          const existing = new Set(prev.map((c) => c.email.toLowerCase()));
          const merged = [...prev];
          for (const c of res.contacts) {
            if (c.email && !existing.has(c.email.toLowerCase())) {
              merged.push({
                id: c.id || `ext_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                name: c.name || "Unknown",
                title: c.title || "",
                company: c.company || "",
                email: c.email,
                phone: c.phone || "",
                category: c.category || "",
                linkedinUrl: c.linkedinUrl || "",
                sourcePostUrl: c.sourcePostUrl || "",
                collectedAt: c.collectedAt || new Date().toISOString(),
              });
              existing.add(c.email.toLowerCase());
            }
          }
          saveContacts(merged);
          return merged;
        });
      }
    } catch {
      // context invalidated or timeout
    }
  }, [hroRpc]);

  // ── Extension detection ──
  useEffect(() => {
    let mounted = true;

    detectTimeoutRef.current = setTimeout(() => {
      if (mounted && !extensionConnected) {
        setExtensionChecking(false);
      }
    }, 6000);

    const handler = (event: MessageEvent) => {
      if (event.data?._src !== "hro_bridge") return;
      if (event.data?.type === "HRO_BRIDGE_READY") {
        clearTimeout(detectTimeoutRef.current);
        setTimeout(() => {
          if (mounted) syncFromExtension();
        }, 1500);
      } else if (event.data?.type === "HRO_BRIDGE_DISCONNECTED") {
        setExtensionConnected(false);
        setExtensionChecking(true);
      }
    };
    window.addEventListener("message", handler);

    syncFromExtension().catch(() => {});

    pollRef.current = setInterval(async () => {
      try {
        const status = await hroRpc("HRO_GET_STATUS", undefined, 3000);
        setExtensionConnected(true);
        setExtensionChecking(false);
        setExtCount(status.count || 0);
        setIsCollecting(status.isCollecting || false);
      } catch {
        setExtensionConnected(false);
      }
    }, 4000);

    return () => {
      mounted = false;
      window.removeEventListener("message", handler);
      if (pollRef.current) clearInterval(pollRef.current);
      if (detectTimeoutRef.current) clearTimeout(detectTimeoutRef.current);
    };
  }, [syncFromExtension, hroRpc]);

  // ── Collect actions ──
  const buildLinkedInUrl = useCallback((kw: string, range: string) => {
    const base = `https://www.linkedin.com/search/results/content/?keywords=${encodeURIComponent(kw)}&origin=GLOBAL_SEARCH_HEADER`;
    if (range && range !== "any") return `${base}&datesPosted=${range}`;
    return base;
  }, []);

  const handleStartCollect = async () => {
    try {
      setIsCollecting(true);
      setCollectStatus("Opening LinkedIn search page...");
      await hroRpc("HRO_START_COLLECTING", { keyword, timeRange });
      window.open(buildLinkedInUrl(keyword, timeRange), "_blank");
    } catch {
      setIsCollecting(false);
      setCollectStatus("Failed to start collection. Is the extension connected?");
    }
  };

  const handleStopCollect = async () => {
    try {
      await hroRpc("HRO_STOP_COLLECTING");
      setIsCollecting(false);
      setCollectStatus("Stopped.");
    } catch {
      setIsCollecting(false);
    }
  };

  // ── List helpers ──
  const handleCopyEmail = (id: string, email: string) => {
    navigator.clipboard.writeText(email).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleDeleteContact = (id: string) => {
    setContacts((prev) => prev.filter((c) => c.id !== id));
  };

  const handleAddContact = () => {
    if (!newContact.email) return;
    const hr: CollectedHR = {
      id: `manual_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      ...newContact,
      collectedAt: new Date().toISOString(),
    };
    setContacts((prev) => [...prev, hr]);
    setNewContact({ name: "", title: "", company: "", email: "", phone: "", category: "", linkedinUrl: "" });
    setShowAddForm(false);
  };

  const handleExportCSV = () => {
    const headers = ["Name", "Title", "Company", "Email", "Phone", "Category", "LinkedIn URL", "Collected At"];
    const rows = contacts.map((c) => [
      c.name, c.title, c.company, c.email, c.phone || "", c.category, c.linkedinUrl, c.collectedAt,
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${(v ?? "")}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hr_contacts_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyTemplate = (id: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedTemplateId(id);
      setTimeout(() => setCopiedTemplateId(null), 2000);
    });
  };

  const filteredContacts = contacts.filter((c) => {
    if (!searchFilter) return true;
    const q = searchFilter.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.company.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q)
    );
  });

  const contactsWithEmail = contacts.filter((c) => c.email).length;

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  const progressPct = Math.min(100, Math.round((contacts.length / MAX_CONTACTS) * 100));

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <MailCheck className="w-7 h-7 text-indigo-600" />
            Cold Emails
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            Collect HR contacts from LinkedIn hiring posts. Send from HR Outreach page (1 Hire per email).
          </p>
        </div>
        <div className="flex items-center gap-3">
          {extensionConnected && (
            <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Extension Connected
            </span>
          )}
          <span className="text-xs font-medium text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full">
            <Users className="w-3.5 h-3.5 inline mr-1" />
            {contacts.length} / {MAX_CONTACTS} collected
          </span>
          {contacts.length > 0 && (
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 border border-indigo-200 hover:border-indigo-400 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          )}
        </div>
      </div>

      {/* ── Progress Bar ── */}
      <div className="bg-white/80 backdrop-blur border border-white/60 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Collection Progress</span>
          <span className="text-sm font-bold text-indigo-600">{contacts.length} / {MAX_CONTACTS}</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
          <motion.div
            className="h-3 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500"
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-gray-100/80 p-1 rounded-xl w-fit">
        {(
          [
            { id: "collect", label: "Collect HRs", icon: Search },
            { id: "list", label: `Contacts (${contacts.length})`, icon: Users },
            { id: "templates", label: "Templates", icon: FileText },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === id
                ? "bg-white text-indigo-700 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB: COLLECT HRs                                                      */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence mode="wait">
        {activeTab === "collect" && (
          <motion.div
            key="collect"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="space-y-5"
          >
            {/* Search Config Card */}
            <div className="bg-white/80 backdrop-blur border border-white/60 rounded-2xl p-6 shadow-sm space-y-5">
              <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                <Linkedin className="w-5 h-5 text-blue-600" />
                LinkedIn Hiring Post Search
              </h2>

              {/* Extension Status */}
              {!extensionChecking && !extensionConnected && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Extension not detected</p>
                    <p className="text-xs text-amber-600 mt-1">Install and enable the HR Outreach extension, then refresh this page.</p>
                  </div>
                </div>
              )}

              {/* Keyword */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Search Keyword</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder="e.g. we are hiring software engineer"
                    className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>
                {/* Quick Suggestions */}
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {KEYWORD_SUGGESTIONS.slice(0, 5).map((s) => (
                    <button
                      key={s}
                      onClick={() => setKeyword(s)}
                      className="text-xs px-2.5 py-1 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-full transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time Range */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Time Range</label>
                <select
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 cursor-pointer"
                >
                  <option value="any">Any time</option>
                  <option value="past24h">Past 24 hours</option>
                  <option value="pastWeek">Past week</option>
                  <option value="pastMonth">Past month</option>
                </select>
              </div>

              {/* How it works */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700 space-y-1">
                <p className="font-medium flex items-center gap-1"><Sparkles className="w-4 h-4" /> How it works</p>
                <ul className="list-disc list-inside space-y-0.5 text-blue-600 text-xs ml-1">
                  <li>Opens LinkedIn post search with your keyword and time filter</li>
                  <li>Extension auto-scrolls and extracts HR name, email, phone</li>
                  <li>Contacts sync back here automatically</li>
                  <li>Send emails from the HR Outreach page (1 Hire per email)</li>
                </ul>
              </div>

              {/* Action Row */}
              <div className="flex items-center gap-3">
                {!isCollecting ? (
                  <button
                    onClick={handleStartCollect}
                    disabled={contacts.length >= MAX_CONTACTS || (!extensionConnected && !extensionChecking)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity shadow-md"
                  >
                    <Play className="w-4 h-4" />
                    Start Collecting
                  </button>
                ) : (
                  <button
                    onClick={handleStopCollect}
                    className="flex items-center gap-2 px-5 py-2.5 bg-red-500 text-white text-sm font-semibold rounded-xl hover:bg-red-600 transition-colors shadow-md"
                  >
                    <Square className="w-4 h-4" />
                    Stop
                  </button>
                )}
                {contacts.length > 0 && (
                  <button
                    onClick={() => {
                      if (window.confirm("Clear all collected contacts?")) {
                        setContacts([]);
                        setCollectStatus("");
                      }
                    }}
                    className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 px-3 py-2.5 rounded-xl transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Clear All
                  </button>
                )}
              </div>

              {/* Status Message */}
              <AnimatePresence>
                {(isCollecting || collectStatus) && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100"
                  >
                    {isCollecting && (
                      <RefreshCw className="w-4 h-4 text-indigo-500 animate-spin flex-shrink-0" />
                    )}
                    <span>{collectStatus}</span>
                    {isCollecting && (
                      <a
                        href={buildLinkedInUrl(keyword, timeRange)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Open LinkedIn
                      </a>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[
                { label: "Collected", value: contacts.length, icon: Users, color: "text-indigo-600", bg: "bg-indigo-50" },
                { label: "With Email", value: contactsWithEmail, icon: Mail, color: "text-emerald-600", bg: "bg-emerald-50" },
                { label: "Remaining", value: MAX_CONTACTS - contacts.length, icon: Target, color: "text-amber-600", bg: "bg-amber-50" },
              ].map(({ label, value, icon: Icon, color, bg }) => (
                <div key={label} className="bg-white/80 backdrop-blur border border-white/60 rounded-2xl p-4 shadow-sm flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${color}`} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">{label}</p>
                    <p className={`text-xl font-bold ${color}`}>{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* TAB: CONTACTS LIST                                                   */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === "list" && (
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Filter by name, company, email..."
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleExportCSV}
                  disabled={contacts.length === 0}
                  className="flex items-center gap-1.5 text-sm text-gray-600 border border-gray-200 hover:border-gray-400 px-3 py-2 rounded-xl transition-colors disabled:opacity-40"
                >
                  <Download className="w-4 h-4" /> Export CSV
                </button>
                <button
                  onClick={() => setShowAddForm((v) => !v)}
                  className="flex items-center gap-1.5 text-sm text-white bg-gradient-to-r from-indigo-600 to-purple-600 px-3 py-2 rounded-xl hover:opacity-90 transition-opacity shadow-sm"
                >
                  <Plus className="w-4 h-4" /> Add Contact
                </button>
              </div>
            </div>

            {/* Add Contact Form */}
            <AnimatePresence>
              {showAddForm && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-white/80 backdrop-blur border border-indigo-100 rounded-2xl p-5 shadow-sm"
                >
                  <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                    <Plus className="w-4 h-4 text-indigo-500" /> Add HR Contact Manually
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { key: "name", placeholder: "Full Name", icon: User },
                      { key: "title", placeholder: "Job Title (e.g. HR Manager)", icon: Briefcase },
                      { key: "company", placeholder: "Company Name", icon: Building2 },
                      { key: "email", placeholder: "Email Address *", icon: Mail },
                      { key: "phone", placeholder: "Phone Number", icon: Hash },
                      { key: "linkedinUrl", placeholder: "LinkedIn Profile URL", icon: Linkedin },
                    ].map(({ key, placeholder, icon: Icon }) => (
                      <div key={key} className="relative">
                        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          value={(newContact as Record<string, string>)[key]}
                          onChange={(e) => setNewContact((p) => ({ ...p, [key]: e.target.value }))}
                          placeholder={placeholder}
                          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                        />
                      </div>
                    ))}
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <select
                        value={newContact.category}
                        onChange={(e) => setNewContact((p) => ({ ...p, category: e.target.value }))}
                        className="w-full appearance-none pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                      >
                        <option value="">Select Category</option>
                        {CATEGORY_OPTIONS.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={handleAddContact}
                      disabled={!newContact.email}
                      className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-colors"
                    >
                      Add Contact
                    </button>
                    <button
                      onClick={() => setShowAddForm(false)}
                      className="px-4 py-2 text-gray-600 text-sm border border-gray-200 rounded-xl hover:border-gray-400 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Contact Cards */}
            {filteredContacts.length === 0 ? (
              <div className="bg-white/80 backdrop-blur border border-white/60 rounded-2xl p-12 shadow-sm text-center">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No contacts yet</p>
                <p className="text-gray-400 text-sm mt-1">
                  {contacts.length === 0
                    ? 'Go to "Collect HRs" tab to start collecting contacts.'
                    : "No contacts match your filter."}
                </p>
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredContacts.map((contact) => (
                  <motion.div
                    key={contact.id}
                    layout
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    className="bg-white/80 backdrop-blur border border-white/60 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center gap-3"
                  >
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-indigo-600 font-bold text-sm">
                        {contact.name.charAt(0).toUpperCase()}
                      </span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <p className="font-semibold text-gray-900 text-sm">{contact.name}</p>
                        {contact.title && (
                          <span className="text-xs text-gray-500">· {contact.title}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Building2 className="w-3 h-3" />{contact.company}
                        </span>
                        {contact.category && (
                          <span className="text-xs text-indigo-500 flex items-center gap-1">
                            <Hash className="w-3 h-3" />{contact.category}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                        <Mail className="w-3 h-3" />{contact.email}
                      </p>
                      {contact.phone && (
                        <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                          <Hash className="w-3 h-3" />{contact.phone}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleCopyEmail(contact.id, contact.email)}
                        title="Copy email"
                        className="w-8 h-8 rounded-lg bg-gray-50 hover:bg-indigo-50 text-gray-500 hover:text-indigo-600 flex items-center justify-center transition-colors"
                      >
                        {copiedId === contact.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      {contact.linkedinUrl && (
                        <a
                          href={contact.linkedinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-8 h-8 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-500 flex items-center justify-center transition-colors"
                          title="View LinkedIn"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button
                        onClick={() => handleDeleteContact(contact.id)}
                        className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-600 flex items-center justify-center transition-colors"
                        title="Remove contact"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* TAB: TEMPLATES (read-only, copy to clipboard)                          */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === "templates" && (
          <motion.div
            key="templates"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <div className="bg-white/80 backdrop-blur border border-white/60 rounded-2xl p-6 shadow-sm space-y-2">
              <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" /> Email Templates
              </h2>
              <p className="text-sm text-gray-500">
                Preview and copy these templates. Use them when sending from the HR Outreach page.
              </p>
            </div>

            <div className="grid gap-4">
              {BUILTIN_TEMPLATES.map((tpl) => (
                <div key={tpl.id} className="bg-white/80 backdrop-blur border border-white/60 rounded-2xl p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-800 text-sm">{tpl.name}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">Subject: {tpl.subject}</p>
                    </div>
                    <button
                      onClick={() => handleCopyTemplate(tpl.id, tpl.textContent)}
                      className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 border border-indigo-200 hover:border-indigo-400 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      {copiedTemplateId === tpl.id ? (
                        <><Check className="w-3 h-3 text-emerald-500" /> Copied</>
                      ) : (
                        <><Copy className="w-3 h-3" /> Copy</>
                      )}
                    </button>
                  </div>
                  <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-xs text-gray-600 whitespace-pre-wrap font-mono leading-relaxed max-h-40 overflow-y-auto">
                    {tpl.textContent}
                  </div>
                  <p className="text-xs text-gray-400">
                    Placeholders:{" "}
                    <code className="bg-gray-100 px-1 rounded">{"{name}"}</code>{" "}
                    <code className="bg-gray-100 px-1 rounded">{"{company}"}</code>{" "}
                    <code className="bg-gray-100 px-1 rounded">{"{role}"}</code>{" "}
                    <code className="bg-gray-100 px-1 rounded">{"{senderName}"}</code>{" "}
                    <code className="bg-gray-100 px-1 rounded">{"{skills}"}</code>{" "}
                    <code className="bg-gray-100 px-1 rounded">{"{field}"}</code>{" "}
                    <code className="bg-gray-100 px-1 rounded">{"{years}"}</code>{" "}
                    <code className="bg-gray-100 px-1 rounded">{"{location}"}</code>{" "}
                    <code className="bg-gray-100 px-1 rounded">{"{senderEmail}"}</code>{" "}
                    <code className="bg-gray-100 px-1 rounded">{"{senderPhone}"}</code>{" "}
                    <code className="bg-gray-100 px-1 rounded">{"{senderLinkedin}"}</code>{" "}
                    <code className="bg-gray-100 px-1 rounded">{"{senderPortfolio}"}</code>{" "}
                    <code className="bg-gray-100 px-1 rounded">{"{results}"}</code>
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
