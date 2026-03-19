"use client";

import { useState, useEffect, useRef } from "react";
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
  X,
  Download,
  Play,
  Square,
  Target,
  Briefcase,
  Hash,
  ChevronDown,
  Eye,
  MailCheck,
  Users,
  Zap,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CollectedHR {
  id: string;
  name: string;
  title: string;
  company: string;
  email: string;
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
  htmlContent?: string;
  category: string;
}

interface SendRecord {
  id: string;
  email: string;
  name: string;
  company: string;
  subject: string;
  sentAt: string;
  status: "sent" | "failed";
  error?: string;
}

type Tab = "collect" | "list" | "send";

// ─── Built-in Cold Email Templates ────────────────────────────────────────────

const BUILTIN_TEMPLATES: EmailTemplate[] = [
  {
    id: "cold-short",
    name: "Short & Catchy",
    subject: "Quick intro — open to {role} roles",
    category: "cold-outreach",
    textContent: `Hi {name},

I came across {company} and I'm genuinely impressed by what you're building.

I'm currently exploring {role} opportunities and thought I'd reach out directly. I have experience in [your skills] and would love to contribute to your team.

Would you be open to a quick 10-minute call this week?

Best,
{senderName}`,
    htmlContent: "",
  },
  {
    id: "value-based",
    name: "Value-Based (LinkedIn Style)",
    subject: "Interested in joining {company} — {role}",
    category: "cold-outreach",
    textContent: `Hi {name},

I noticed {company} is hiring for {role} roles — I've been following your work and the direction you're heading looks exciting.

A bit about me: [2–3 bullet points of your top achievements].

I'd love to learn more about the team and see if there's a fit. Happy to share my resume or portfolio anytime.

Thanks for reading,
{senderName}`,
    htmlContent: "",
  },
  {
    id: "high-converting",
    name: "High-Converting (Formal)",
    subject: "Application: {role} at {company}",
    category: "cold-outreach",
    textContent: `Dear {name},

I am writing to express my strong interest in {role} opportunities at {company}. With [X years] of experience in [your field], I have consistently delivered [specific result].

I have attached my resume for your review. I would welcome the chance to discuss how my background aligns with your team's goals.

Thank you for your time and consideration.

Sincerely,
{senderName}`,
    htmlContent: "",
  },
  {
    id: "remote-us-ca",
    name: "Remote (US / Canada HR)",
    subject: "Remote {role} candidate — available immediately",
    category: "cold-outreach",
    textContent: `Hi {name},

I'm reaching out because {company} caught my attention and I'm actively looking for remote {role} positions.

I'm based in [your location] and have been working remotely for [X years], delivering results across time zones with minimal friction.

Key strengths: [skill 1] · [skill 2] · [skill 3].

Would love to connect — even a brief chat would be great!

Cheers,
{senderName}`,
    htmlContent: "",
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

// ─── Component ────────────────────────────────────────────────────────────────

export default function ColdEmails() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("collect");

  // ── Collect Tab State ──
  const [keyword, setKeyword] = useState("we are hiring");
  const [category, setCategory] = useState("");
  const [isCollecting, setIsCollecting] = useState(false);
  const [collectProgress, setCollectProgress] = useState(0);
  const [collectStatus, setCollectStatus] = useState("");
  const stopRef = useRef(false);

  // ── List Tab State ──
  const [contacts, setContacts] = useState<CollectedHR[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newContact, setNewContact] = useState({
    name: "", title: "", company: "", email: "", category: "", linkedinUrl: "",
  });

  // ── Send Tab State ──
  const [templates, setTemplates] = useState<EmailTemplate[]>(BUILTIN_TEMPLATES);
  const [selectedTemplateId, setSelectedTemplateId] = useState(BUILTIN_TEMPLATES[0].id);
  const [customSubject, setCustomSubject] = useState("");
  const [customBody, setCustomBody] = useState("");
  const [senderName, setSenderName] = useState(user?.name ?? "");
  const [role, setRole] = useState("");
  const [sendRecords, setSendRecords] = useState<SendRecord[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState(0);
  const [sendStatus, setSendStatus] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);

  // ── Load saved contacts from localStorage ──
  useEffect(() => {
    try {
      const saved = localStorage.getItem("cold_emails_contacts");
      if (saved) setContacts(JSON.parse(saved));
      const savedRecords = localStorage.getItem("cold_emails_sent");
      if (savedRecords) setSendRecords(JSON.parse(savedRecords));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    localStorage.setItem("cold_emails_contacts", JSON.stringify(contacts));
  }, [contacts]);

  useEffect(() => {
    localStorage.setItem("cold_emails_sent", JSON.stringify(sendRecords));
  }, [sendRecords]);

  // ── Fetch DB templates ──
  useEffect(() => {
    fetch("/api/user/email-templates", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data?.templates) && data.templates.length > 0) {
          setTemplates([...BUILTIN_TEMPLATES, ...data.templates]);
        }
      })
      .catch(() => {});
  }, []);

  // ── Sync template body when selection changes ──
  useEffect(() => {
    const tpl = templates.find((t) => t.id === selectedTemplateId);
    if (tpl) {
      setCustomSubject(tpl.subject);
      setCustomBody(tpl.textContent);
    }
  }, [selectedTemplateId, templates]);

  // ─────────────────────────────────────────────────────────────────────────────
  // COLLECT: Search LinkedIn via the existing hr-outreach/search API
  // ─────────────────────────────────────────────────────────────────────────────
  const handleStartCollect = async () => {
    if (contacts.length >= MAX_CONTACTS) {
      setCollectStatus(`✅ Already collected ${MAX_CONTACTS} contacts. Clear list to start fresh.`);
      return;
    }
    stopRef.current = false;
    setIsCollecting(true);
    setCollectStatus("🔍 Searching LinkedIn for hiring posts…");

    const needed = MAX_CONTACTS - contacts.length;
    let gathered = 0;
    const seen = new Set(contacts.map((c) => c.email.toLowerCase()));
    const queries = [
      keyword,
      `${keyword} ${category}`,
      `site:linkedin.com/posts "${keyword}"`,
    ].filter(Boolean);

    for (const q of queries) {
      if (stopRef.current || gathered >= needed) break;

      try {
        setCollectStatus(`🔍 Querying: "${q}"…`);
        const res = await fetch("/api/user/hr-outreach/search", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: q, platform: "linkedin", country: "all" }),
        });
        const data = await res.json();
        const results: Array<{
          name?: string; title?: string; company?: string;
          email?: string; linkedinUrl?: string;
        }> = Array.isArray(data?.results)
          ? data.results
          : (Array.isArray(data?.contacts) ? data.contacts : []);

        for (const r of results) {
          if (stopRef.current || gathered >= needed) break;
          if (!r.email || seen.has(r.email.toLowerCase())) continue;

          seen.add(r.email.toLowerCase());
          const newHR: CollectedHR = {
            id: `hr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            name: r.name ?? "Unknown",
            title: r.title ?? "HR / Recruiter",
            company: r.company ?? "Unknown Company",
            email: r.email,
            category: category || CATEGORY_OPTIONS[0],
            linkedinUrl: r.linkedinUrl ?? "",
            collectedAt: new Date().toISOString(),
          };

          setContacts((prev) => {
            const updated = [...prev, newHR];
            setCollectProgress(Math.min(updated.length, MAX_CONTACTS));
            return updated;
          });
          gathered++;
          setCollectStatus(`✅ Collected ${contacts.length + gathered} contacts so far…`);
          await new Promise((r) => setTimeout(r, 300));
        }
      } catch {
        setCollectStatus("⚠️ Search error, retrying next query…");
      }
    }

    setIsCollecting(false);
    const total = contacts.length + gathered;
    if (total >= MAX_CONTACTS) {
      setCollectStatus(`🎯 Cap reached! ${MAX_CONTACTS} HR contacts collected. Head to Email List.`);
    } else if (gathered === 0) {
      setCollectStatus("ℹ️ No new contacts found. Try a different keyword or category.");
    } else {
      setCollectStatus(`✅ Done! Collected ${gathered} new contacts (${total} total).`);
    }
  };

  const handleStopCollect = () => {
    stopRef.current = true;
    setIsCollecting(false);
    setCollectStatus("⏹ Collection stopped.");
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // LIST helpers
  // ─────────────────────────────────────────────────────────────────────────────
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
    const contact: CollectedHR = {
      id: `hr_manual_${Date.now()}`,
      ...newContact,
      collectedAt: new Date().toISOString(),
    };
    setContacts((prev) => [...prev, contact]);
    setNewContact({ name: "", title: "", company: "", email: "", category: "", linkedinUrl: "" });
    setShowAddForm(false);
  };

  const handleExportCSV = () => {
    const headers = ["Name", "Title", "Company", "Email", "Category", "LinkedIn URL", "Collected At"];
    const rows = contacts.map((c) => [
      c.name, c.title, c.company, c.email, c.category, c.linkedinUrl, c.collectedAt,
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v ?? ""}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hr_contacts_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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

  // ─────────────────────────────────────────────────────────────────────────────
  // SEND
  // ─────────────────────────────────────────────────────────────────────────────
  const buildBody = (contact: CollectedHR) =>
    customBody
      .replace(/{name}/g, contact.name.split(" ")[0] || contact.name)
      .replace(/{company}/g, contact.company)
      .replace(/{role}/g, role || "Software Engineer")
      .replace(/{senderName}/g, senderName || user?.name || "");

  const buildSubject = (contact: CollectedHR) =>
    customSubject
      .replace(/{name}/g, contact.name.split(" ")[0] || contact.name)
      .replace(/{company}/g, contact.company)
      .replace(/{role}/g, role || "Software Engineer");

  const handleSendCampaign = async () => {
    const targets = contacts.filter((c) => c.email);
    if (targets.length === 0) {
      setSendStatus("⚠️ No contacts with emails in your list.");
      return;
    }
    setIsSending(true);
    setSendProgress(0);
    setSendStatus(`📤 Sending to ${targets.length} contacts…`);

    let sent = 0;
    const newRecords: SendRecord[] = [];

    for (const contact of targets) {
      try {
        const body = buildBody(contact);
        const subject = buildSubject(contact);
        const res = await fetch("/api/user/hr-outreach/send", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            toEmail: contact.email,
            toName: contact.name,
            subject,
            body,
            company: contact.company,
          }),
        });
        const data = await res.json();
        newRecords.push({
          id: `send_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          email: contact.email,
          name: contact.name,
          company: contact.company,
          subject,
          sentAt: new Date().toISOString(),
          status: res.ok ? "sent" : "failed",
          error: !res.ok ? (data?.error ?? "Unknown error") : undefined,
        });
        sent++;
      } catch (e: unknown) {
        newRecords.push({
          id: `send_${Date.now()}`,
          email: contact.email,
          name: contact.name,
          company: contact.company,
          subject: buildSubject(contact),
          sentAt: new Date().toISOString(),
          status: "failed",
          error: e instanceof Error ? e.message : "Network error",
        });
      }
      setSendProgress(Math.round(((sent) / targets.length) * 100));
      await new Promise((r) => setTimeout(r, 200));
    }

    setSendRecords((prev) => [...newRecords, ...prev]);
    setIsSending(false);
    const successCount = newRecords.filter((r) => r.status === "sent").length;
    setSendStatus(`✅ Done! ${successCount}/${targets.length} emails sent successfully.`);
  };

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
            Collect HR contacts from LinkedIn hiring posts and send targeted cold emails.
          </p>
        </div>
        <div className="flex items-center gap-3">
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
        {contacts.length >= MAX_CONTACTS && (
          <p className="text-xs text-emerald-600 font-medium mt-2 flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5" /> Target reached! Ready to send campaign.
          </p>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-gray-100/80 p-1 rounded-xl w-fit">
        {(
          [
            { id: "collect", label: "Collect HRs", icon: Search },
            { id: "list", label: `Email List (${contacts.length})`, icon: Users },
            { id: "send", label: "Send Campaign", icon: Send },
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

              {/* Category */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                  <Hash className="w-3.5 h-3.5" /> Job Category (optional)
                </label>
                <div className="relative">
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full appearance-none px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                  >
                    <option value="">All Categories</option>
                    {CATEGORY_OPTIONS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* How it works */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700 space-y-1">
                <p className="font-medium flex items-center gap-1"><Sparkles className="w-4 h-4" /> How it works</p>
                <ul className="list-disc list-inside space-y-0.5 text-blue-600 text-xs ml-1">
                  <li>Searches LinkedIn hiring posts using your keyword + category</li>
                  <li>Extracts HR name, company, job category, and email</li>
                  <li>Stops automatically at {MAX_CONTACTS} unique contacts</li>
                  <li>All contacts are saved locally and persist across sessions</li>
                </ul>
              </div>

              {/* Action Row */}
              <div className="flex items-center gap-3">
                {!isCollecting ? (
                  <button
                    onClick={handleStartCollect}
                    disabled={contacts.length >= MAX_CONTACTS}
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
                        setCollectProgress(0);
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
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Collected", value: contacts.length, icon: Users, color: "text-indigo-600", bg: "bg-indigo-50" },
                { label: "Remaining", value: MAX_CONTACTS - contacts.length, icon: Target, color: "text-amber-600", bg: "bg-amber-50" },
                { label: "Sent", value: sendRecords.filter((r) => r.status === "sent").length, icon: MailCheck, color: "text-emerald-600", bg: "bg-emerald-50" },
                { label: "Failed", value: sendRecords.filter((r) => r.status === "failed").length, icon: AlertCircle, color: "text-red-500", bg: "bg-red-50" },
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
        {/* TAB: EMAIL LIST                                                        */}
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
                  placeholder="Filter by name, company, email…"
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
        {/* TAB: SEND CAMPAIGN                                                     */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === "send" && (
          <motion.div
            key="send"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="space-y-5"
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Left: Compose */}
              <div className="bg-white/80 backdrop-blur border border-white/60 rounded-2xl p-6 shadow-sm space-y-5">
                <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                  <Mail className="w-5 h-5 text-indigo-600" /> Compose Email
                </h2>

                {/* Sender Name & Role */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">Your Name</label>
                    <input
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      placeholder="Your full name"
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">Target Role</label>
                    <input
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      placeholder="e.g. Frontend Developer"
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    />
                  </div>
                </div>

                {/* Template Selector */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Email Template</label>
                  <div className="relative">
                    <select
                      value={selectedTemplateId}
                      onChange={(e) => setSelectedTemplateId(e.target.value)}
                      className="w-full appearance-none px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                    >
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>

                {/* Subject */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Subject</label>
                  <input
                    value={customSubject}
                    onChange={(e) => setCustomSubject(e.target.value)}
                    placeholder="Email subject"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>

                {/* Body */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-gray-600">Email Body</label>
                    <button
                      onClick={() => setPreviewOpen((v) => !v)}
                      className="text-xs text-indigo-600 hover:underline flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" /> Preview
                    </button>
                  </div>
                  <textarea
                    value={customBody}
                    onChange={(e) => setCustomBody(e.target.value)}
                    rows={10}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                  />
                  <p className="text-xs text-gray-400">
                    Placeholders: <code className="bg-gray-100 px-1 rounded">{"{name}"}</code>{" "}
                    <code className="bg-gray-100 px-1 rounded">{"{company}"}</code>{" "}
                    <code className="bg-gray-100 px-1 rounded">{"{role}"}</code>{" "}
                    <code className="bg-gray-100 px-1 rounded">{"{senderName}"}</code>
                  </p>
                </div>

                {/* Preview Panel */}
                <AnimatePresence>
                  {previewOpen && contacts.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-wrap font-mono"
                    >
                      <p className="text-xs font-semibold text-gray-500 mb-1">PREVIEW (using first contact)</p>
                      <p className="font-semibold">Subject: {buildSubject(contacts[0])}</p>
                      <hr className="my-2" />
                      {buildBody(contacts[0])}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Send Button */}
                <div className="space-y-3">
                  <button
                    onClick={handleSendCampaign}
                    disabled={isSending || contacts.length === 0}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity shadow-md"
                  >
                    {isSending ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Sending… {sendProgress}%
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4" />
                        Send to All {contacts.length} Contacts
                      </>
                    )}
                  </button>

                  {/* Send Progress Bar */}
                  {isSending && (
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                      <motion.div
                        className="h-2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"
                        animate={{ width: `${sendProgress}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                  )}

                  {sendStatus && (
                    <p className="text-sm text-gray-600 text-center">{sendStatus}</p>
                  )}
                </div>
              </div>

              {/* Right: Sent History */}
              <div className="bg-white/80 backdrop-blur border border-white/60 rounded-2xl p-6 shadow-sm flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                    <MailCheck className="w-5 h-5 text-emerald-600" /> Sent History
                  </h2>
                  {sendRecords.length > 0 && (
                    <button
                      onClick={() => {
                        if (window.confirm("Clear sent history?")) setSendRecords([]);
                      }}
                      className="text-xs text-red-400 hover:text-red-600"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {sendRecords.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
                    <Send className="w-10 h-10 text-gray-200 mb-3" />
                    <p className="text-gray-400 text-sm">No emails sent yet</p>
                  </div>
                ) : (
                  <div className="space-y-2 overflow-y-auto max-h-[480px] pr-1">
                    {sendRecords.map((rec) => (
                      <div
                        key={rec.id}
                        className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors"
                      >
                        <div className="mt-0.5 flex-shrink-0">
                          {rec.status === "sent" ? (
                            <CheckCircle className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-red-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{rec.name}</p>
                          <p className="text-xs text-gray-500 truncate">{rec.email} · {rec.company}</p>
                          <p className="text-xs text-gray-400 truncate">{rec.subject}</p>
                          {rec.error && (
                            <p className="text-xs text-red-400 mt-0.5">{rec.error}</p>
                          )}
                        </div>
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
                            rec.status === "sent"
                              ? "bg-emerald-50 text-emerald-600"
                              : "bg-red-50 text-red-500"
                          }`}
                        >
                          {rec.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
