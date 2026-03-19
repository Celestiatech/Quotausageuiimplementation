"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Search,
  Mail,
  Send,
  User,
  Building2,
  MapPin,
  Linkedin,
  Globe,
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  Clock,
  RefreshCw,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  ExternalLink,
  Target,
  X,
  FileText,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface HRContact {
  id: string;
  name: string;
  title: string;
  company: string;
  email: string;
  linkedinUrl?: string;
  websiteUrl?: string;
  country: string;
  source: "google" | "manual";
  addedAt: string;
}

interface OutreachRecord {
  id: string;
  contactEmail: string;
  contactName: string;
  company: string;
  subject: string;
  body: string;
  sentAt: string;
  status: "sent" | "failed";
  error?: string;
}

interface SearchResult {
  name: string;
  title: string;
  company: string;
  email: string;
  linkedinUrl?: string;
  websiteUrl?: string;
  snippet: string;
}

type Tab = "search" | "contacts" | "history";
type SearchPlatform = "google" | "linkedin" | "indeed";
type SearchCountry = "US" | "CA" | "UK" | "AU" | "all";

// ─── Email Templates ───────────────────────────────────────────────────────────

const EMAIL_TEMPLATES = [
  {
    id: "cold-short",
    label: "Short & Catchy (Instagram / DM)",
    subject: "Quick website improvement idea for {company}",
    body: `Hi {name},

I came across {company} and really liked what you're doing 👏

I noticed your website could be improved to attract more customers.

I'm a WordPress developer and can help you with a clean, modern, high-converting site.

Would you like me to share a quick idea for your website?

Best regards,
{sender}`,
  },
  {
    id: "value-based",
    label: "Value-Based (LinkedIn / Job Apply)",
    subject: "WordPress Developer — helping {company} improve online presence",
    body: `Hi {name},

I was checking {company}'s website and noticed a few areas where you might be losing potential customers (design, speed, mobile experience).

I'm a WordPress developer focused on creating fast, conversion-friendly websites.

I'd love to share a few quick suggestions that could improve your online presence — no pressure, just helpful insights 🙂

Here's my portfolio: [Your Portfolio Link]

Best,
{sender}`,
  },
  {
    id: "high-converting",
    label: "High-Converting (Email / Serious Clients)",
    subject: "2–3 quick improvements for {company}'s website",
    body: `Hi {name},

I came across {company} and took a quick look at your website. You have a great offering, but I noticed a few improvements that could significantly increase your leads and customer engagement.

I'm a WordPress developer specializing in modern, fast, and user-friendly websites.

I'd be happy to share 2–3 quick suggestions (free of cost) that could improve your site's performance.

Let me know if you're open to it 👍

Best regards,
{sender}`,
  },
  {
    id: "job-application",
    label: "Remote Job Application (US / Canada HR)",
    subject: "Senior WordPress Developer — Open to Remote Opportunities",
    body: `Hi {name},

I came across {company} and noticed you may be looking for experienced web talent.

I'm a senior WordPress developer with [X years] of experience building high-performance sites for agencies and startups — including WooCommerce stores, custom theme development, and performance optimization.

I'm actively seeking remote opportunities with US/Canada-based companies.

Portfolio: [Your Portfolio Link]
LinkedIn: [Your LinkedIn]

Would love to connect — happy to share more details or jump on a quick call.

Best,
{sender}`,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function applyTemplate(body: string, contact: Partial<HRContact>, senderName: string) {
  return body
    .replace(/\{name\}/g, contact.name || "there")
    .replace(/\{company\}/g, contact.company || "your company")
    .replace(/\{sender\}/g, senderName || "your name");
}

function loadContacts(): HRContact[] {
  try {
    return JSON.parse(localStorage.getItem("cp_hr_contacts") || "[]");
  } catch {
    return [];
  }
}

function saveContacts(contacts: HRContact[]) {
  localStorage.setItem("cp_hr_contacts", JSON.stringify(contacts));
}

function loadHistory(): OutreachRecord[] {
  try {
    return JSON.parse(localStorage.getItem("cp_hr_history") || "[]");
  } catch {
    return [];
  }
}

function saveHistory(history: OutreachRecord[]) {
  localStorage.setItem("cp_hr_history", JSON.stringify(history));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: "sent" | "failed" }) {
  if (status === "sent") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">
        <CheckCircle className="w-3 h-3" />
        Sent
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200">
      <AlertCircle className="w-3 h-3" />
      Failed
    </span>
  );
}

function ContactCard({
  contact,
  onRemove,
  onSendEmail,
}: {
  contact: HRContact;
  onRemove: (id: string) => void;
  onSendEmail: (contact: HRContact) => void;
}) {
  const [copied, setCopied] = useState(false);

  const copyEmail = () => {
    void navigator.clipboard.writeText(contact.email);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className="bg-white/80 backdrop-blur-sm border border-white/60 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            {(contact.name || "?")[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 truncate">{contact.name}</p>
            <p className="text-sm text-gray-500 truncate">{contact.title}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <Building2 className="w-3 h-3 text-gray-400" />
              <span className="text-sm text-gray-600 truncate">{contact.company}</span>
            </div>
          </div>
        </div>
        <button
          onClick={() => onRemove(contact.id)}
          className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
          title="Remove"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-2 py-1 flex-1 min-w-0">
          <Mail className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <span className="text-xs text-gray-700 truncate">{contact.email}</span>
          <button onClick={copyEmail} className="ml-auto flex-shrink-0 text-gray-400 hover:text-indigo-600">
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
        {contact.linkedinUrl && (
          <a
            href={contact.linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg bg-[#0A66C2]/10 text-[#0A66C2] hover:bg-[#0A66C2]/20 transition-colors"
            title="LinkedIn"
          >
            <Linkedin className="w-3.5 h-3.5" />
          </a>
        )}
        {contact.websiteUrl && (
          <a
            href={contact.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
            title="Website"
          >
            <Globe className="w-3.5 h-3.5" />
          </a>
        )}
      </div>

      <div className="mt-3">
        <button
          onClick={() => onSendEmail(contact)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-medium rounded-lg hover:from-indigo-600 hover:to-purple-700 transition-all shadow-sm"
        >
          <Send className="w-3.5 h-3.5" />
          Compose & Send Email
        </button>
      </div>
    </motion.div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function HROutreach() {
  const [activeTab, setActiveTab] = useState<Tab>("search");

  // Search state
  const [searchQuery, setSearchQuery] = useState("Hiring WordPress Developer Remote");
  const [searchCountry, setSearchCountry] = useState<SearchCountry>("US");
  const [searchPlatform, setSearchPlatform] = useState<SearchPlatform>("google");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchError, setSearchError] = useState("");

  // Contacts state
  const [contacts, setContacts] = useState<HRContact[]>(() => loadContacts());

  // Manual add contact form
  const [showAddManual, setShowAddManual] = useState(false);
  const [manualForm, setManualForm] = useState({
    name: "",
    title: "HR Manager",
    company: "",
    email: "",
    linkedinUrl: "",
    websiteUrl: "",
    country: "US",
  });

  // Email compose state
  const [composeContact, setComposeContact] = useState<HRContact | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState(EMAIL_TEMPLATES[3].id);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [senderName, setSenderName] = useState(() => localStorage.getItem("cp_sender_name") || "");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [sendSuccess, setSendSuccess] = useState(false);

  // History state
  const [history, setHistory] = useState<OutreachRecord[]>(() => loadHistory());

  // ── Search ──────────────────────────────────────────────────────────────────

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchError("");
    setSearchResults([]);

    try {
      const res = await fetch("/api/user/hr-outreach/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: searchQuery,
          country: searchCountry,
          platform: searchPlatform,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "Search failed");
      }

      const data = (await res.json()) as { results: SearchResult[] };
      setSearchResults(data.results || []);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }, [searchQuery, searchCountry, searchPlatform]);

  const addToContacts = (result: SearchResult) => {
    const existing = contacts.find((c) => c.email === result.email);
    if (existing) return;
    const newContact: HRContact = {
      id: generateId(),
      name: result.name,
      title: result.title,
      company: result.company,
      email: result.email,
      linkedinUrl: result.linkedinUrl,
      websiteUrl: result.websiteUrl,
      country: searchCountry,
      source: "google",
      addedAt: new Date().toISOString(),
    };
    const updated = [newContact, ...contacts];
    setContacts(updated);
    saveContacts(updated);
  };

  // ── Manual Contact ──────────────────────────────────────────────────────────

  const addManualContact = () => {
    if (!manualForm.email || !manualForm.name) return;
    const newContact: HRContact = {
      id: generateId(),
      ...manualForm,
      source: "manual",
      addedAt: new Date().toISOString(),
    };
    const updated = [newContact, ...contacts];
    setContacts(updated);
    saveContacts(updated);
    setManualForm({ name: "", title: "HR Manager", company: "", email: "", linkedinUrl: "", websiteUrl: "", country: "US" });
    setShowAddManual(false);
  };

  const removeContact = (id: string) => {
    const updated = contacts.filter((c) => c.id !== id);
    setContacts(updated);
    saveContacts(updated);
  };

  // ── Compose Email ────────────────────────────────────────────────────────────

  const openCompose = (contact: HRContact) => {
    const template = EMAIL_TEMPLATES.find((t) => t.id === selectedTemplate) || EMAIL_TEMPLATES[3];
    setEmailSubject(applyTemplate(template.subject, contact, senderName));
    setEmailBody(applyTemplate(template.body, contact, senderName));
    setComposeContact(contact);
    setSendError("");
    setSendSuccess(false);
  };

  const applyTemplateToCompose = (templateId: string) => {
    setSelectedTemplate(templateId);
    if (!composeContact) return;
    const template = EMAIL_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    setEmailSubject(applyTemplate(template.subject, composeContact, senderName));
    setEmailBody(applyTemplate(template.body, composeContact, senderName));
  };

  const sendEmail = async () => {
    if (!composeContact || !emailSubject || !emailBody) return;
    setSending(true);
    setSendError("");
    setSendSuccess(false);

    try {
      const res = await fetch("/api/user/hr-outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: composeContact.email,
          name: composeContact.name,
          company: composeContact.company,
          subject: emailSubject,
          body: emailBody,
        }),
      });

      const data = (await res.json()) as { success?: boolean; error?: string };

      const record: OutreachRecord = {
        id: generateId(),
        contactEmail: composeContact.email,
        contactName: composeContact.name,
        company: composeContact.company,
        subject: emailSubject,
        body: emailBody,
        sentAt: new Date().toISOString(),
        status: res.ok && data.success ? "sent" : "failed",
        error: data.error,
      };

      const updatedHistory = [record, ...history];
      setHistory(updatedHistory);
      saveHistory(updatedHistory);

      if (res.ok && data.success) {
        setSendSuccess(true);
        setTimeout(() => {
          setComposeContact(null);
          setSendSuccess(false);
          setActiveTab("history");
        }, 1500);
      } else {
        throw new Error(data.error || "Failed to send");
      }
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "search", label: "🔍 Find HR Contacts" },
    { id: "contacts", label: "📋 Outreach List", count: contacts.length },
    { id: "history", label: "📨 Sent History", count: history.length },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6 relative z-0">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="space-y-1">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
            <Target className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">HR Direct Outreach</h1>
            <p className="text-sm text-gray-500">Find HR contacts & send personalized outreach emails</p>
          </div>
        </div>

        {/* Tips banner */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mt-4 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-4"
        >
          <div className="flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-indigo-800 space-y-1">
              <p className="font-semibold">🚀 Pro Strategy for US/Canada Remote Jobs</p>
              <p>Search for HR Managers at agencies, startups & e-commerce brands → Add them to your list → Send a personalized email daily (10–20/day). First response usually comes within 7–15 days.</p>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/70 border border-gray-200 rounded-xl p-1 backdrop-blur-sm">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-sm"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                  activeTab === tab.id ? "bg-white/20 text-white" : "bg-indigo-100 text-indigo-700"
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── TAB: Search ── */}
      <AnimatePresence mode="wait">
        {activeTab === "search" && (
          <motion.div
            key="search"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-5"
          >
            {/* Search Form */}
            <div className="bg-white/80 backdrop-blur-sm border border-white/60 rounded-xl p-5 shadow-sm space-y-4">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <Search className="w-4 h-4 text-indigo-500" />
                Search for HR / Hiring Managers
              </h2>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">
                    Search Keywords
                  </label>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && void handleSearch()}
                    placeholder='e.g. "Hiring WordPress Developer Remote" or "HR Manager agency USA"'
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent bg-white"
                  />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {[
                      "Hiring WordPress Developer Remote",
                      "WordPress Developer job US remote",
                      "Web Designer job Canada remote",
                      "WooCommerce developer hiring",
                      "Web agency hiring developer",
                      "WordPress HR contact email",
                    ].map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => setSearchQuery(suggestion)}
                        className="text-xs px-2.5 py-1 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-full hover:bg-indigo-100 transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">
                      Country
                    </label>
                    <select
                      value={searchCountry}
                      onChange={(e) => setSearchCountry(e.target.value as SearchCountry)}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    >
                      <option value="US">🇺🇸 United States</option>
                      <option value="CA">🇨🇦 Canada</option>
                      <option value="UK">🇬🇧 United Kingdom</option>
                      <option value="AU">🇦🇺 Australia</option>
                      <option value="all">🌍 All Countries</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">
                      Platform
                    </label>
                    <select
                      value={searchPlatform}
                      onChange={(e) => setSearchPlatform(e.target.value as SearchPlatform)}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    >
                      <option value="google">🔍 Google Search</option>
                      <option value="linkedin">💼 LinkedIn</option>
                      <option value="indeed">🏢 Indeed</option>
                    </select>
                  </div>
                </div>

                <button
                  onClick={() => void handleSearch()}
                  disabled={searching || !searchQuery.trim()}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-xl shadow-sm hover:from-indigo-600 hover:to-purple-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                >
                  {searching ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Searching Google...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      Find HR Contacts
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Search Error */}
            {searchError && (
              <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Search failed</p>
                  <p className="text-red-600 mt-0.5">{searchError}</p>
                  <p className="text-red-500 mt-1 text-xs">
                    Make sure <code className="font-mono bg-red-100 px-1 rounded">GOOGLE_CSE_API_KEY</code> and{" "}
                    <code className="font-mono bg-red-100 px-1 rounded">GOOGLE_CSE_ID</code> are set in your environment.
                  </p>
                </div>
              </div>
            )}

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-800">
                    Found {searchResults.length} contacts
                  </h3>
                  <span className="text-xs text-gray-400">Click + to add to outreach list</span>
                </div>
                {searchResults.map((result, idx) => {
                  const alreadyAdded = contacts.some((c) => c.email === result.email);
                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.04 }}
                      className="bg-white/80 backdrop-blur-sm border border-white/60 rounded-xl p-4 shadow-sm"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                          {(result.name || "?")[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-semibold text-gray-900">{result.name}</p>
                              <p className="text-sm text-gray-500">{result.title}</p>
                              <div className="flex items-center gap-1 mt-0.5">
                                <Building2 className="w-3 h-3 text-gray-400" />
                                <span className="text-sm text-gray-600">{result.company}</span>
                              </div>
                            </div>
                            <button
                              onClick={() => addToContacts(result)}
                              disabled={alreadyAdded}
                              className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                alreadyAdded
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default"
                                  : "bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100"
                              }`}
                            >
                              {alreadyAdded ? (
                                <>
                                  <Check className="w-3 h-3" /> Added
                                </>
                              ) : (
                                <>
                                  <Plus className="w-3 h-3" /> Add
                                </>
                              )}
                            </button>
                          </div>

                          <div className="mt-2 flex items-center gap-2 flex-wrap">
                            <div className="flex items-center gap-1 bg-gray-50 rounded-lg px-2 py-1">
                              <Mail className="w-3 h-3 text-gray-400" />
                              <span className="text-xs text-gray-700">{result.email}</span>
                            </div>
                            {result.linkedinUrl && (
                              <a
                                href={result.linkedinUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs text-[#0A66C2] hover:underline"
                              >
                                <Linkedin className="w-3 h-3" />
                                LinkedIn
                              </a>
                            )}
                            {result.websiteUrl && (
                              <a
                                href={result.websiteUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs text-gray-500 hover:underline"
                              >
                                <Globe className="w-3 h-3" />
                                Website
                              </a>
                            )}
                          </div>

                          {result.snippet && (
                            <p className="mt-2 text-xs text-gray-400 line-clamp-2">{result.snippet}</p>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Empty search hint */}
            {!searching && searchResults.length === 0 && !searchError && (
              <div className="text-center py-12 text-gray-400">
                <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium text-gray-500">Search for HR contacts above</p>
                <p className="text-sm mt-1">Results will appear here from Google Custom Search</p>
              </div>
            )}
          </motion.div>
        )}

        {/* ── TAB: Contacts ── */}
        {activeTab === "contacts" && (
          <motion.div
            key="contacts"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {/* Action bar */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                {contacts.length} contact{contacts.length !== 1 ? "s" : ""} in your outreach list
              </p>
              <button
                onClick={() => setShowAddManual((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Manually
              </button>
            </div>

            {/* Manual add form */}
            <AnimatePresence>
              {showAddManual && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-white/80 backdrop-blur-sm border border-indigo-200 rounded-xl p-5 shadow-sm space-y-3 overflow-hidden"
                >
                  <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                    <User className="w-4 h-4 text-indigo-500" />
                    Add Contact Manually
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key: "name", label: "Full Name *", placeholder: "Sarah Johnson" },
                      { key: "title", label: "Job Title", placeholder: "HR Manager" },
                      { key: "company", label: "Company", placeholder: "Acme Corp" },
                      { key: "email", label: "Email *", placeholder: "sarah@acme.com" },
                      { key: "linkedinUrl", label: "LinkedIn URL", placeholder: "https://linkedin.com/in/..." },
                      { key: "websiteUrl", label: "Company Website", placeholder: "https://acme.com" },
                    ].map(({ key, label, placeholder }) => (
                      <div key={key} className={key === "linkedinUrl" || key === "websiteUrl" ? "col-span-2 md:col-span-1" : ""}>
                        <label className="text-xs font-medium text-gray-500 mb-1 block">{label}</label>
                        <input
                          type={key === "email" ? "email" : "text"}
                          value={manualForm[key as keyof typeof manualForm]}
                          onChange={(e) => setManualForm((f) => ({ ...f, [key]: e.target.value }))}
                          placeholder={placeholder}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={addManualContact}
                      disabled={!manualForm.email || !manualForm.name}
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-medium rounded-lg disabled:opacity-50 hover:from-indigo-600 hover:to-purple-700 transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Contact
                    </button>
                    <button
                      onClick={() => setShowAddManual(false)}
                      className="px-4 py-2 text-gray-600 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Sender name setting */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-3">
              <User className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <div className="flex-1">
                <label className="text-xs font-medium text-amber-700 block mb-1">Your Name (shown in emails)</label>
                <input
                  type="text"
                  value={senderName}
                  onChange={(e) => {
                    setSenderName(e.target.value);
                    localStorage.setItem("cp_sender_name", e.target.value);
                  }}
                  placeholder="e.g. Alex Kumar"
                  className="w-full px-3 py-1.5 border border-amber-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            </div>

            {/* Contacts grid */}
            {contacts.length === 0 ? (
              <div className="text-center py-16">
                <Mail className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="font-medium text-gray-500">No contacts yet</p>
                <p className="text-sm text-gray-400 mt-1">
                  Search for HR contacts or add them manually
                </p>
                <button
                  onClick={() => setActiveTab("search")}
                  className="mt-4 px-4 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-colors"
                >
                  Go to Search
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <AnimatePresence>
                  {contacts.map((contact) => (
                    <ContactCard
                      key={contact.id}
                      contact={contact}
                      onRemove={removeContact}
                      onSendEmail={openCompose}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        )}

        {/* ── TAB: History ── */}
        {activeTab === "history" && (
          <motion.div
            key="history"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-3"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                {history.length} email{history.length !== 1 ? "s" : ""} sent
              </p>
              {history.length > 0 && (
                <button
                  onClick={() => {
                    if (confirm("Clear all sent history?")) {
                      setHistory([]);
                      saveHistory([]);
                    }
                  }}
                  className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <div className="text-center py-16">
                <Clock className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="font-medium text-gray-500">No emails sent yet</p>
                <p className="text-sm text-gray-400 mt-1">Your outreach history will appear here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {history.map((record) => (
                  <HistoryRecord key={record.id} record={record} />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Email Compose Modal ── */}
      <AnimatePresence>
        {composeContact && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && setComposeContact(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.97 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
              {/* Modal header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <div>
                  <h2 className="font-bold text-gray-900 flex items-center gap-2">
                    <Send className="w-4 h-4 text-indigo-500" />
                    Compose Email
                  </h2>
                  <p className="text-sm text-gray-500 mt-0.5">
                    To: <span className="font-medium text-gray-700">{composeContact.name}</span>
                    {" "}·{" "}
                    <span className="text-gray-500">{composeContact.email}</span>
                  </p>
                </div>
                <button
                  onClick={() => setComposeContact(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {/* Template selector */}
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">
                    Email Template
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {EMAIL_TEMPLATES.map((tmpl) => (
                      <button
                        key={tmpl.id}
                        onClick={() => applyTemplateToCompose(tmpl.id)}
                        className={`text-left px-3 py-2 rounded-lg border text-xs transition-all ${
                          selectedTemplate === tmpl.id
                            ? "border-indigo-400 bg-indigo-50 text-indigo-700 font-medium"
                            : "border-gray-200 text-gray-600 hover:border-indigo-300 hover:bg-indigo-50/50"
                        }`}
                      >
                        <FileText className="w-3 h-3 inline mr-1.5" />
                        {tmpl.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Subject */}
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">
                    Subject Line
                  </label>
                  <input
                    type="text"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                  />
                </div>

                {/* Body */}
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">
                    Email Body
                  </label>
                  <textarea
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    rows={12}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white resize-y"
                  />
                </div>

                {/* Errors / Success */}
                {sendError && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {sendError}
                  </div>
                )}
                {sendSuccess && (
                  <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-700">
                    <CheckCircle className="w-4 h-4 flex-shrink-0" />
                    Email sent successfully!
                  </div>
                )}

                {/* Send button */}
                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => void sendEmail()}
                    disabled={sending || !emailSubject || !emailBody}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-xl shadow-sm hover:from-indigo-600 hover:to-purple-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                  >
                    {sending ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Send Email
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setComposeContact(null)}
                    className="px-5 py-3 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── History Record sub-component ────────────────────────────────────────────

function HistoryRecord({ record }: { record: OutreachRecord }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white/80 backdrop-blur-sm border border-white/60 rounded-xl shadow-sm overflow-hidden">
      <div
        className="flex items-start gap-3 p-4 cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
          {(record.contactName || "?")[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-gray-900 text-sm">{record.contactName}</p>
              <p className="text-xs text-gray-500">{record.company} · {record.contactEmail}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <StatusBadge status={record.status} />
              {expanded ? (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
            </div>
          </div>
          <p className="text-sm font-medium text-gray-700 mt-1 truncate">{record.subject}</p>
          <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {new Date(record.sentAt).toLocaleString()}
          </p>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-gray-100 pt-3">
              {record.error && (
                <div className="mb-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  Error: {record.error}
                </div>
              )}
              <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono bg-gray-50 rounded-lg p-3 max-h-48 overflow-y-auto">
                {record.body}
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
