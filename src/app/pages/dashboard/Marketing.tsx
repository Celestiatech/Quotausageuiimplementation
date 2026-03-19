"use client";

import { useState, useEffect } from "react";
import {
  Mail,
  Plus,
  Send,
  Calendar,
  Users,
  TrendingUp,
  BarChart2,
  Edit,
  Trash2,
  Play,
  Pause,
  RefreshCw,
  FileText,
  Eye,
  Clock,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

interface Campaign {
  id: string;
  name: string;
  subject: string;
  status: "draft" | "scheduled" | "sending" | "sent" | "paused";
  scheduledAt: string | null;
  createdAt: string;
  updatedAt: string;
  templateId: string | null;
  recipientList: string[];
  stats: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    unsubscribed: number;
  };
  _count?: {
    emails: number;
  };
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  category: string;
  isGlobal: boolean;
  createdAt: string;
}

export default function Marketing() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"campaigns" | "templates">("campaigns");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewCampaign, setShowNewCampaign] = useState(false);
  const [showNewTemplate, setShowNewTemplate] = useState(false);

  // New Campaign Form State
  const [newCampaign, setNewCampaign] = useState({
    name: "",
    subject: "",
    templateId: "",
    scheduledAt: "",
    recipientList: [] as string[],
    status: "draft" as const,
  });

  // New Template Form State
  const [newTemplate, setNewTemplate] = useState({
    name: "",
    subject: "",
    htmlContent: "",
    textContent: "",
    category: "general",
  });

  useEffect(() => {
    void loadCampaigns();
    void loadTemplates();
  }, []);

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/marketing/campaigns");
      if (response.ok) {
        const data = await response.json();
        setCampaigns(data.campaigns || []);
      }
    } catch (error) {
      console.error("Failed to load campaigns:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadTemplates = async () => {
    try {
      const response = await fetch("/api/marketing/templates");
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates || []);
      }
    } catch (error) {
      console.error("Failed to load templates:", error);
    }
  };

  const createCampaign = async () => {
    try {
      const response = await fetch("/api/marketing/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCampaign),
      });

      if (response.ok) {
        await loadCampaigns();
        setShowNewCampaign(false);
        setNewCampaign({
          name: "",
          subject: "",
          templateId: "",
          scheduledAt: "",
          recipientList: [],
          status: "draft",
        });
      }
    } catch (error) {
      console.error("Failed to create campaign:", error);
    }
  };

  const createTemplate = async () => {
    try {
      const response = await fetch("/api/marketing/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTemplate),
      });

      if (response.ok) {
        await loadTemplates();
        setShowNewTemplate(false);
        setNewTemplate({
          name: "",
          subject: "",
          htmlContent: "",
          textContent: "",
          category: "general",
        });
      }
    } catch (error) {
      console.error("Failed to create template:", error);
    }
  };

  const deleteCampaign = async (id: string) => {
    if (!confirm("Are you sure you want to delete this campaign?")) return;
    
    try {
      const response = await fetch(`/api/marketing/campaigns?id=${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await loadCampaigns();
      }
    } catch (error) {
      console.error("Failed to delete campaign:", error);
    }
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm("Are you sure you want to delete this template?")) return;
    
    try {
      const response = await fetch(`/api/marketing/templates?id=${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await loadTemplates();
      }
    } catch (error) {
      console.error("Failed to delete template:", error);
    }
  };

  const getStatusColor = (status: Campaign["status"]) => {
    const colors = {
      draft: "bg-gray-100 text-gray-700",
      scheduled: "bg-blue-100 text-blue-700",
      sending: "bg-yellow-100 text-yellow-700",
      sent: "bg-green-100 text-green-700",
      paused: "bg-orange-100 text-orange-700",
    };
    return colors[status] || colors.draft;
  };

  const getStatusIcon = (status: Campaign["status"]) => {
    const icons = {
      draft: FileText,
      scheduled: Clock,
      sending: Play,
      sent: CheckCircle,
      paused: Pause,
    };
    const Icon = icons[status] || FileText;
    return <Icon className="w-4 h-4" />;
  };

  const totalStats = campaigns.reduce(
    (acc, campaign) => ({
      sent: acc.sent + campaign.stats.sent,
      delivered: acc.delivered + campaign.stats.delivered,
      opened: acc.opened + campaign.stats.opened,
      clicked: acc.clicked + campaign.stats.clicked,
    }),
    { sent: 0, delivered: 0, opened: 0, clicked: 0 }
  );

  const openRate = totalStats.delivered > 0 
    ? ((totalStats.opened / totalStats.delivered) * 100).toFixed(1)
    : "0";

  const clickRate = totalStats.opened > 0
    ? ((totalStats.clicked / totalStats.opened) * 100).toFixed(1)
    : "0";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Marketing Campaigns</h1>
          <p className="text-gray-600">
            Create and manage email marketing campaigns to engage with your audience
          </p>
        </div>
        <button
          onClick={() => void loadCampaigns()}
          className="px-5 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl font-semibold transition-colors flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <Mail className="w-8 h-8 text-purple-600" />
            <span className="text-sm font-medium text-gray-500">Total Sent</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{totalStats.sent.toLocaleString()}</div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle className="w-8 h-8 text-green-600" />
            <span className="text-sm font-medium text-gray-500">Delivered</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{totalStats.delivered.toLocaleString()}</div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <Eye className="w-8 h-8 text-blue-600" />
            <span className="text-sm font-medium text-gray-500">Open Rate</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{openRate}%</div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="w-8 h-8 text-orange-600" />
            <span className="text-sm font-medium text-gray-500">Click Rate</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{clickRate}%</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="border-b border-gray-200">
          <div className="flex gap-6 px-6">
            <button
              onClick={() => setActiveTab("campaigns")}
              className={`py-4 px-2 font-medium border-b-2 transition-colors ${
                activeTab === "campaigns"
                  ? "border-purple-600 text-purple-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Campaigns ({campaigns.length})
            </button>
            <button
              onClick={() => setActiveTab("templates")}
              className={`py-4 px-2 font-medium border-b-2 transition-colors ${
                activeTab === "templates"
                  ? "border-purple-600 text-purple-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Email Templates ({templates.length})
            </button>
          </div>
        </div>

        <div className="p-6">
          {activeTab === "campaigns" ? (
            <div className="space-y-4">
              {/* New Campaign Button */}
              {!showNewCampaign && (
                <button
                  onClick={() => setShowNewCampaign(true)}
                  className="w-full py-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-purple-500 hover:bg-purple-50 transition-colors flex items-center justify-center gap-2 text-gray-600 hover:text-purple-600 font-medium"
                >
                  <Plus className="w-5 h-5" />
                  Create New Campaign
                </button>
              )}

              {/* New Campaign Form */}
              {showNewCampaign && (
                <div className="bg-gray-50 rounded-xl p-6 space-y-4">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <Plus className="w-5 h-5" />
                    New Campaign
                  </h3>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Campaign Name
                    </label>
                    <input
                      type="text"
                      value={newCampaign.name}
                      onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="e.g., Welcome Series"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Subject
                    </label>
                    <input
                      type="text"
                      value={newCampaign.subject}
                      onChange={(e) => setNewCampaign({ ...newCampaign, subject: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="e.g., Welcome to Free Auto Apply CV!"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Template
                    </label>
                    <select
                      value={newCampaign.templateId}
                      onChange={(e) => setNewCampaign({ ...newCampaign, templateId: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="">Select a template</option>
                      {templates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Schedule Date (Optional)
                    </label>
                    <input
                      type="datetime-local"
                      value={newCampaign.scheduledAt}
                      onChange={(e) => setNewCampaign({ ...newCampaign, scheduledAt: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => void createCampaign()}
                      className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors font-semibold flex items-center justify-center gap-2"
                    >
                      <Send className="w-4 h-4" />
                      Create Campaign
                    </button>
                    <button
                      onClick={() => setShowNewCampaign(false)}
                      className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors font-semibold"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Campaigns List */}
              {loading ? (
                <div className="text-center py-12">
                  <RefreshCw className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-4" />
                  <p className="text-gray-600">Loading campaigns...</p>
                </div>
              ) : campaigns.length === 0 ? (
                <div className="text-center py-12">
                  <Mail className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600 mb-2">No campaigns yet</p>
                  <p className="text-sm text-gray-500">Create your first campaign to start engaging with your audience</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {campaigns.map((campaign) => (
                    <div
                      key={campaign.id}
                      className="border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-bold text-gray-900">{campaign.name}</h3>
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${getStatusColor(campaign.status)}`}>
                              {getStatusIcon(campaign.status)}
                              {campaign.status}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">
                            <strong>Subject:</strong> {campaign.subject}
                          </p>
                          {campaign.scheduledAt && (
                            <p className="text-sm text-gray-500 flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              Scheduled: {new Date(campaign.scheduledAt).toLocaleString()}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => alert("Edit feature coming soon")}
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => void deleteCampaign(campaign.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Campaign Stats */}
                      <div className="grid grid-cols-6 gap-3 pt-4 border-t border-gray-100">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-gray-900">{campaign.stats.sent}</div>
                          <div className="text-xs text-gray-500">Sent</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-gray-900">{campaign.stats.delivered}</div>
                          <div className="text-xs text-gray-500">Delivered</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-gray-900">{campaign.stats.opened}</div>
                          <div className="text-xs text-gray-500">Opened</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-gray-900">{campaign.stats.clicked}</div>
                          <div className="text-xs text-gray-500">Clicked</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-gray-900">{campaign.stats.bounced}</div>
                          <div className="text-xs text-gray-500">Bounced</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-gray-900">{campaign.stats.unsubscribed}</div>
                          <div className="text-xs text-gray-500">Unsub</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* New Template Button */}
              {!showNewTemplate && (
                <button
                  onClick={() => setShowNewTemplate(true)}
                  className="w-full py-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-purple-500 hover:bg-purple-50 transition-colors flex items-center justify-center gap-2 text-gray-600 hover:text-purple-600 font-medium"
                >
                  <Plus className="w-5 h-5" />
                  Create New Template
                </button>
              )}

              {/* New Template Form */}
              {showNewTemplate && (
                <div className="bg-gray-50 rounded-xl p-6 space-y-4">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <Plus className="w-5 h-5" />
                    New Email Template
                  </h3>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Template Name
                    </label>
                    <input
                      type="text"
                      value={newTemplate.name}
                      onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="e.g., Welcome Email"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Subject Line
                    </label>
                    <input
                      type="text"
                      value={newTemplate.subject}
                      onChange={(e) => setNewTemplate({ ...newTemplate, subject: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="e.g., Welcome to AutoApply CV!"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Category
                    </label>
                    <select
                      value={newTemplate.category}
                      onChange={(e) => setNewTemplate({ ...newTemplate, category: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="general">General</option>
                      <option value="welcome">Welcome</option>
                      <option value="promotional">Promotional</option>
                      <option value="newsletter">Newsletter</option>
                      <option value="transactional">Transactional</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      HTML Content
                    </label>
                    <textarea
                      value={newTemplate.htmlContent}
                      onChange={(e) => setNewTemplate({ ...newTemplate, htmlContent: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      rows={10}
                      placeholder="Enter HTML content..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Plain Text Content
                    </label>
                    <textarea
                      value={newTemplate.textContent}
                      onChange={(e) => setNewTemplate({ ...newTemplate, textContent: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      rows={6}
                      placeholder="Enter plain text version..."
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => void createTemplate()}
                      className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors font-semibold flex items-center justify-center gap-2"
                    >
                      <FileText className="w-4 h-4" />
                      Create Template
                    </button>
                    <button
                      onClick={() => setShowNewTemplate(false)}
                      className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors font-semibold"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Templates List */}
              {templates.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600 mb-2">No templates yet</p>
                  <p className="text-sm text-gray-500">Create your first email template to use in campaigns</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className="border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="text-lg font-bold text-gray-900">{template.name}</h3>
                            {template.isGlobal && (
                              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-semibold">
                                Global
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mb-2">
                            <strong>Subject:</strong> {template.subject}
                          </p>
                          <p className="text-xs text-gray-500 capitalize">
                            Category: {template.category}
                          </p>
                        </div>
                        {!template.isGlobal && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => alert("Edit feature coming soon")}
                              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => void deleteTemplate(template.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                      <button className="w-full mt-3 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
                        <Eye className="w-4 h-4" />
                        Preview
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
