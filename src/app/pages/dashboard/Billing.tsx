import { useEffect, useMemo, useState } from "react";
import { Coins, RefreshCw, Wallet, ArrowDownLeft, ArrowUpRight, Zap, Crown, Briefcase, Check, X, Download } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useExtensionPipelineStats } from "../../hooks/useExtensionPipelineStats";

type WalletSummary = {
  plan: "free" | "pro" | "coach";
  hireBalance: number;
  hireSpent: number;
  hirePurchased: number;
  freeRemaining: number;
  dailyUsed: number;
  dailyCap: number;
  dailyRemaining: number;
  spendable: number;
  dailyResetTime: string;
};

type WalletTxn = {
  id: string;
  type: "credit_purchase" | "credit_bonus" | "debit_apply" | "refund_apply" | "admin_adjustment" | "subscription";
  status: "posted" | "voided";
  amount: number;
  balanceAfter: number;
  referenceType?: string | null;
  referenceId?: string | null;
  createdAt: string;
  plan?: string;
  providerSubscriptionId?: string | null;
  providerPlanId?: string | null;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
};

type TopupOrder = {
  provider: "razorpay";
  orderId: string;
  amount: number;
  currency: string;
  baseRupees: number;
  finalRupees: number;
  discountRupees: number;
  discountCode?: string | null;
  rupees: number;
  hires: number;
  keyId: string;
  minTopupRupees: number;
  conversion: string;
};

type DiscountPreview = {
  code: string;
  description?: string | null;
  baseRupees: number;
  discountRupees: number;
  finalRupees: number;
  hires: number;
};

const PLANS = [
  { id: "free", name: "Free", price: 0, period: "Forever", dailyApplies: "3/day", icon: Zap, gradient: "from-gray-500 to-gray-600", features: ["3 auto-apply/day", "300 Hires bonus", "Basic job matching"] },
  { id: "pro", name: "Pro", price: 99, period: "/month", dailyApplies: "Unlimited", icon: Crown, gradient: "from-[#6366F1] to-[#A855F7]", features: ["Unlimited auto-apply", "AI resume builder", "Interview prep tools", "Priority support"] },
  { id: "coach", name: "Coach", price: 299, period: "/month", dailyApplies: "200/day", icon: Briefcase, gradient: "from-orange-500 to-pink-500", features: ["200 auto-apply/day", "Multi-client dashboard", "Team collaboration", "Dedicated account manager"] },
];

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
    };
  }
}

async function ensureRazorpayScript() {
  if (window.Razorpay) return true;
  const existing = document.querySelector<HTMLScriptElement>('script[data-rzp="1"]');
  if (existing) return true;
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.dataset.rzp = "1";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay checkout script"));
    document.body.appendChild(script);
  });
  return Boolean(window.Razorpay);
}

export default function Billing() {
  const { user, refreshUser } = useAuth();
  const extensionStats = useExtensionPipelineStats();
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [txns, setTxns] = useState<WalletTxn[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [applyingDiscount, setApplyingDiscount] = useState(false);
  const [inrAmount, setInrAmount] = useState(100);
  const [discountCode, setDiscountCode] = useState("");
  const [discountPreview, setDiscountPreview] = useState<DiscountPreview | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [upgradingPlan, setUpgradingPlan] = useState<string | null>(null);
  const [showTopup, setShowTopup] = useState(false);
  const [receiptTxn, setReceiptTxn] = useState<WalletTxn | null>(null);
  const [txnTab, setTxnTab] = useState<"all" | "credit" | "debit" | "plan">("all");

  const minTopupRupees = 50;
  const belowMin = !Number.isFinite(inrAmount) || inrAmount < minTopupRupees;
  const computedHires = Math.max(0, Math.round(inrAmount));

  const loadWallet = async () => {
    try {
      setLoading(true);
      const [walletRes, txRes] = await Promise.all([
        fetch("/api/wallet", { credentials: "include" }),
        fetch("/api/wallet/transactions?limit=50", { credentials: "include" }),
      ]);
      const walletData = await walletRes.json();
      const txData = await txRes.json();
      if (!walletRes.ok || !walletData?.success) {
        throw new Error(walletData?.message || "Failed to fetch wallet");
      }
      setWallet(walletData.data as WalletSummary);
      setTxns((txData?.data?.transactions || []) as WalletTxn[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch wallet");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadWallet();
  }, []);

  const formattedReset = useMemo(() => {
    if (!wallet?.dailyResetTime) return "-";
    return new Date(wallet.dailyResetTime).toLocaleString();
  }, [wallet?.dailyResetTime]);

  const mergedDailyUsage = useMemo(() => {
    const cap = Math.max(1, wallet?.dailyCap ?? 3);
    const baseUsed = wallet?.dailyUsed ?? 0;
    const extensionUsedToday = extensionStats.loaded ? extensionStats.appliedToday : 0;
    const used = Math.min(cap, Math.max(baseUsed, extensionUsedToday));
    const remaining = Math.max(0, cap - used);
    const spendableBase = wallet?.spendable ?? 0;
    const spendable = Math.max(0, Math.min(spendableBase, remaining));
    return { used, cap, remaining, spendable };
  }, [wallet?.dailyCap, wallet?.dailyUsed, wallet?.spendable, extensionStats.loaded, extensionStats.appliedToday]);

  useEffect(() => {
    setDiscountPreview((prev) => {
      if (!prev) return prev;
      if (prev.baseRupees === inrAmount) return prev;
      return null;
    });
  }, [inrAmount]);

  const applyDiscount = async () => {
    try {
      if (belowMin) {
        throw new Error(`Minimum top-up is ₹${minTopupRupees}`);
      }
      const code = discountCode.trim().toUpperCase();
      if (!code) {
        setDiscountPreview(null);
        throw new Error("Enter a discount code");
      }
      setApplyingDiscount(true);
      setError("");
      setMessage("");
      const res = await fetch("/api/wallet/topup/discount/preview", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rupees: inrAmount,
          discountCode: code,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        setDiscountPreview(null);
        throw new Error(data?.message || "Failed to apply discount code");
      }
      setDiscountPreview(data.data as DiscountPreview);
      setMessage(`Discount code ${String(data?.data?.code || code)} applied.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to apply discount");
    } finally {
      setApplyingDiscount(false);
    }
  };

  const startTopup = async () => {
    try {
      if (!Number.isFinite(inrAmount) || inrAmount < minTopupRupees) {
        throw new Error(`Minimum top-up is ₹${minTopupRupees}`);
      }
      setProcessing(true);
      setMessage("");
      setError("");

      const orderRes = await fetch("/api/wallet/topup/order", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-idempotency-key": `wallet-${Date.now()}-${inrAmount}-${discountCode.trim().toUpperCase() || "nocode"}`,
        },
        body: JSON.stringify({
          rupees: inrAmount,
          discountCode: discountCode.trim().toUpperCase() || undefined,
        }),
      });
      const orderBody = await orderRes.json();
      if (!orderRes.ok || !orderBody?.success) {
        throw new Error(orderBody?.message || "Failed to create top-up order");
      }

      const order = orderBody.data as TopupOrder;
      await ensureRazorpayScript();
      if (!window.Razorpay) throw new Error("Razorpay checkout is not available");

      const razorpay = new window.Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amount,
        currency: order.currency,
        name: "AutoApply CV Hires Wallet",
        description: `${order.hires} Hires top-up${order.discountRupees > 0 ? ` (${order.discountCode} applied)` : ""}`,
        prefill: {
          name: user?.name || "",
          email: user?.email || "",
          contact: user?.phone || "",
        },
        method: {
          upi: true,
          card: true,
          netbanking: true,
          wallet: true,
          emi: true,
          paylater: true,
        },
        theme: { color: "#6366F1" },
        handler: async (response: Record<string, string>) => {
          const verifyRes = await fetch("/api/wallet/topup/verify", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });
          const verifyBody = await verifyRes.json();
          if (!verifyRes.ok || !verifyBody?.success) {
            setError(verifyBody?.message || "Payment verification failed");
            return;
          }
          setMessage(`Top-up successful. Credited ${verifyBody?.data?.creditedHires || order.hires} Hires.`);
          await loadWallet();
          await refreshUser();
        },
      });

      razorpay.open();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to process top-up");
    } finally {
      setProcessing(false);
    }
  };

  const startPlanUpgrade = async (planId: string) => {
    if (planId === "free" || planId === user?.plan) return;
    try {
      setUpgradingPlan(planId);
      setMessage("");
      setError("");

      const plan = PLANS.find((p) => p.id === planId);
      if (!plan || plan.price === 0) {
        throw new Error("Invalid plan selected");
      }

      const orderRes = await fetch("/api/billing/order", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId }),
      });
      const orderBody = await orderRes.json();
      if (!orderRes.ok || !orderBody?.success) {
        throw new Error(orderBody?.message || "Failed to create order");
      }

      const order = orderBody.data;
      await ensureRazorpayScript();
      if (!window.Razorpay) throw new Error("Razorpay checkout is not available");

      const razorpay = new window.Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amount,
        currency: order.currency,
        name: "AutoApply CV",
        description: `${plan.name} Plan - ₹${plan.price}/month`,
        prefill: {
          name: user?.name || "",
          email: user?.email || "",
          contact: user?.phone || "",
        },
        method: {
          upi: true,
          card: true,
          netbanking: true,
          wallet: true,
          emi: true,
          paylater: true,
        },
        theme: { color: "#6366F1" },
        handler: async (response: Record<string, string>) => {
          const verifyRes = await fetch("/api/billing/order/verify", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
              plan: planId,
            }),
          });
          const verifyBody = await verifyRes.json();
          if (!verifyRes.ok || !verifyBody?.success) {
            setError(verifyBody?.message || "Payment verification failed");
            return;
          }
          setMessage(`Successfully upgraded to ${plan.name} plan!`);
          await loadWallet();
          await refreshUser();
        },
      });

      razorpay.open();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to process plan upgrade");
    } finally {
      setUpgradingPlan(null);
    }
  };

  const txnLabel = (txn: WalletTxn) => {
    if (txn.type === "subscription") return `${(txn.plan || "pro").toUpperCase()} Plan Purchase`;
    if (txn.type === "credit_purchase") return "Top-up";
    if (txn.type === "debit_apply") return "Auto-Apply charge";
    if (txn.type === "refund_apply") return "Refund";
    if (txn.type === "credit_bonus") return "Bonus";
    return "Admin adjustment";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xs font-bold text-gray-900">Billing & Wallet</h1>
          <p className="text-gray-600 mt-1">Manage your subscription plan and buy Hires. 1 Hire = 1 Apply.</p>
        </div>
        <button
          onClick={() => void loadWallet()}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl font-semibold inline-flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {message ? <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-green-700 text-sm">{message}</div> : null}
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm">{error}</div> : null}

      <div className="grid md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-6 border-2 border-gray-200">
          <div className="text-xs uppercase text-gray-500">Balance</div>
          <div className="text-xs font-bold text-gray-900 mt-1 inline-flex items-center gap-2">
            <Wallet className="w-6 h-6 text-purple-600" />
            {wallet?.hireBalance ?? 0}
          </div>
          <div className="text-sm text-gray-500">Hires</div>
        </div>
        <div className="bg-white rounded-2xl p-6 border-2 border-gray-200">
          <div className="text-xs uppercase text-gray-500">Daily Usage</div>
          <div className="text-xs font-bold text-gray-900 mt-1">{mergedDailyUsage.used}/{mergedDailyUsage.cap}</div>
          <div className="text-sm text-gray-500">Spendable: {mergedDailyUsage.spendable}</div>
        </div>
        <div className="bg-white rounded-2xl p-6 border-2 border-gray-200">
          <div className="text-xs uppercase text-gray-500">Purchased</div>
          <div className="text-xs font-bold text-gray-900 mt-1">{wallet?.hirePurchased ?? 0}</div>
          <div className="text-sm text-gray-500">Hires</div>
        </div>
        <div className="bg-white rounded-2xl p-6 border-2 border-gray-200">
          <div className="text-xs uppercase text-gray-500">Daily Reset</div>
          <div className="text-sm font-semibold text-gray-900 mt-2">{formattedReset}</div>
          <div className="text-sm text-gray-500 mt-2">Free left: {wallet?.freeRemaining ?? 0}</div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {PLANS.map((plan) => {
          const isActive = wallet?.plan === plan.id;
          const Icon = plan.icon;
          return (
            <div
              key={plan.id}
              className={`bg-white rounded-2xl p-6 border-2 ${
                isActive ? "border-[#6366F1] ring-2 ring-[#6366F1]/20" : "border-gray-200"
              } transition-all`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${plan.gradient} flex items-center justify-center`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{plan.name}</h3>
                  <p className="text-xs text-gray-500">{plan.dailyApplies}</p>
                </div>
              </div>
              <div className="mb-4">
                <span className="text-xs font-bold text-gray-900">{plan.price === 0 ? "Free" : `₹${plan.price}`}</span>
                {plan.price > 0 && <span className="text-gray-500 text-sm ml-1">{plan.period}</span>}
              </div>
              <ul className="space-y-2 mb-4">
                {plan.features.map((feat) => (
                  <li key={feat} className="flex items-center gap-2 text-sm text-gray-600">
                    <Check className="w-4 h-4 text-green-500 shrink-0" />
                    {feat}
                  </li>
                ))}
              </ul>
              {isActive ? (
                <div className="px-4 py-2 rounded-xl bg-purple-50 text-purple-700 font-semibold text-sm text-center">
                  Current Plan
                </div>
              ) : (
                <button
                  onClick={() => void startPlanUpgrade(plan.id)}
                  disabled={processing || upgradingPlan === plan.id || plan.price === 0}
                  className={`w-full px-4 py-2 rounded-xl font-semibold text-sm ${
                    plan.price === 0
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                      : "bg-gradient-to-r from-[#6366F1] to-[#A855F7] text-white hover:opacity-90"
                  } disabled:opacity-60`}
                >
                  {upgradingPlan === plan.id ? "Processing..." : plan.price === 0 ? "Free Forever" : "Upgrade"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={() => setShowTopup(!showTopup)}
        className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${
          showTopup
            ? "bg-purple-100 text-purple-700 border-2 border-purple-200"
            : "bg-gradient-to-r from-[#6366F1] to-[#A855F7] text-white hover:opacity-90"
        }`}
      >
        {showTopup ? "Close Top Up" : "Add Hires (Top Up)"}
      </button>

      {showTopup && (
      <div className="bg-gradient-to-br from-[#6366F1] via-[#8B5CF6] to-[#A855F7] rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold">Top Up Hires</h2>
            <p className="text-sm text-purple-100">1 Hire = 1 Apply. Minimum top-up ₹50.</p>
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5 border border-white/20">
          <label className="block text-sm font-semibold text-purple-100 mb-3">Choose Amount</label>

          <div className="flex gap-2 mb-4">
            {[50, 100, 200, 500].map((amt) => (
              <button
                key={amt}
                onClick={() => setInrAmount(amt)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  inrAmount === amt
                    ? "bg-white text-purple-700 shadow-lg scale-105"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                ₹{amt}
              </button>
            ))}
          </div>

          <div className="relative mb-4">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-purple-300">₹</span>
            <input
              type="number"
              min={minTopupRupees}
              step={1}
              value={inrAmount}
              onChange={(e) => setInrAmount(Math.max(0, Number(e.target.value) || 0))}
              className={`w-full pl-10 pr-4 py-3 rounded-xl bg-white/10 border-2 text-white text-xs font-bold placeholder-purple-300 outline-none ${
                belowMin ? "border-red-400 focus:border-red-300" : "border-white/20 focus:border-white/50"
              }`}
              placeholder="Enter amount"
            />
          </div>

          {belowMin && (
            <div className="mb-3 text-xs font-semibold text-red-300 bg-red-500/20 px-3 py-2 rounded-lg">
              Minimum top-up is ₹{minTopupRupees}
            </div>
          )}

          <div className="flex items-center gap-2 mb-4 bg-white/10 rounded-xl px-4 py-3">
            <Zap className="w-5 h-5 text-yellow-300" />
            <span className="text-sm">
              You get <span className="font-bold text-white text-xs">{computedHires}</span> Hires
            </span>
            <span className="text-xs text-purple-200">(1 Hire = 1 Apply)</span>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <input
              type="text"
              value={discountCode}
              onChange={(e) => {
                setDiscountCode(String(e.target.value || "").toUpperCase());
                setDiscountPreview(null);
              }}
              placeholder="Discount code (optional)"
              className="flex-1 px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder-purple-300 outline-none focus:border-white/50 text-sm"
            />
            <button
              onClick={() => void applyDiscount()}
              disabled={applyingDiscount || belowMin}
              className="px-4 py-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-sm font-semibold transition-colors disabled:opacity-60"
            >
              {applyingDiscount ? "..." : "Apply"}
            </button>
          </div>

          {discountPreview && (
            <div className="mb-4 bg-green-500/20 border border-green-400/30 rounded-xl px-4 py-3 text-sm">
              <div className="font-semibold text-green-300">Code applied: {discountPreview.code}</div>
              <div className="text-green-200 mt-1">
                Base: ₹{discountPreview.baseRupees} → Pay: ₹{discountPreview.finalRupees} (save ₹{discountPreview.discountRupees})
              </div>
            </div>
          )}

          <button
            onClick={() => void startTopup()}
            disabled={processing || belowMin}
            className="w-full py-3.5 rounded-xl bg-white text-purple-700 font-bold text-xs hover:bg-gray-100 transition-all disabled:opacity-60 shadow-lg"
          >
            {processing ? (
              <span className="inline-flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-purple-300 border-t-purple-700 rounded-full animate-spin" />
                Processing...
              </span>
            ) : (
              `Pay ₹${computedHires} with Razorpay`
            )}
          </button>
        </div>
      </div>
      )}

      <div className="bg-white rounded-2xl border-2 border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-gray-900">Transaction History</h2>
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {[
              { key: "all" as const, label: "All", count: txns.length },
              { key: "credit" as const, label: "Credited", count: txns.filter((t) => t.amount > 0 && t.type !== "subscription").length, color: "green" },
              { key: "debit" as const, label: "Deducted", count: txns.filter((t) => t.amount < 0).length, color: "red" },
              { key: "plan" as const, label: "Plans", count: txns.filter((t) => t.type === "subscription").length, color: "purple" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setTxnTab(tab.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  txnTab === tab.key
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${
                  txnTab === tab.key
                    ? tab.color === "green" ? "bg-green-100 text-green-700" : tab.color === "red" ? "bg-red-100 text-red-700" : tab.color === "purple" ? "bg-purple-100 text-purple-700" : "bg-gray-200 text-gray-700"
                    : "bg-gray-200 text-gray-500"
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {loading ? <div className="text-sm text-gray-500">Loading...</div> : null}
        {!loading && txns.length === 0 ? (
          <div className="text-sm text-gray-400 py-8 text-center">No transactions yet</div>
        ) : null}

        <div className="space-y-2">
          {txns
            .filter((t) => {
              if (txnTab === "credit") return t.amount > 0 && t.type !== "subscription";
              if (txnTab === "debit") return t.amount < 0;
              if (txnTab === "plan") return t.type === "subscription";
              return true;
            })
            .map((txn) => {
              const isSubscription = txn.type === "subscription";
              const isCredit = txn.amount >= 0;
              const iconBg = isSubscription ? "bg-purple-100" : isCredit ? "bg-green-100" : "bg-red-100";
              const iconColor = isSubscription ? "text-purple-700" : isCredit ? "text-green-700" : "text-red-700";
              const hoverBorder = isSubscription ? "hover:border-purple-300" : isCredit ? "hover:border-green-300" : "hover:border-red-300";
              const amountColor = isSubscription ? "text-purple-700" : isCredit ? "text-green-700" : "text-red-700";
              const btnHover = isSubscription ? "hover:bg-purple-50 text-purple-600" : isCredit ? "hover:bg-green-50 text-green-600" : "hover:bg-red-50 text-red-600";
              const Icon = isSubscription ? Crown : isCredit ? ArrowDownLeft : ArrowUpRight;
              return (
                <div key={txn.id} className={`flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 transition-colors ${hoverBorder}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${iconBg}`}>
                      <Icon className={`w-4 h-4 ${iconColor}`} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{txnLabel(txn)}</div>
                      <div className="text-xs text-gray-500">{new Date(txn.createdAt).toLocaleString()}</div>
                      {isSubscription && txn.currentPeriodEnd && (
                        <div className="text-xs text-gray-400 mt-0.5">
                          Valid till {new Date(txn.currentPeriodEnd).toLocaleDateString()}
                          {txn.cancelAtPeriodEnd ? " (cancelling)" : ""}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className={`text-sm font-bold ${amountColor}`}>
                        {isSubscription ? `₹${txn.amount}/mo` : `${isCredit ? "+" : ""}${txn.amount} Hires`}
                      </div>
                      {!isSubscription && <div className="text-xs text-gray-500">Bal: {txn.balanceAfter}</div>}
                      {isSubscription && (
                        <div className={`text-xs font-semibold ${txn.status === "posted" ? "text-green-600" : "text-gray-500"}`}>
                          {txn.status === "posted" ? "Active" : "Inactive"}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => setReceiptTxn(txn)}
                      className={`p-1.5 rounded-lg transition-colors ${btnHover}`}
                      title="View Receipt"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Receipt Modal */}
      {receiptTxn && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-xs font-bold text-gray-900">Transaction Receipt</h3>
              <button onClick={() => setReceiptTxn(null)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="text-center pb-4 border-b border-gray-200">
                {receiptTxn.type === "subscription" ? (
                  <>
                    <div className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center bg-gradient-to-br from-[#6366F1] to-[#A855F7]">
                      <Crown className="w-7 h-7 text-white" />
                    </div>
                    <div className="text-xs font-bold text-purple-600">₹{receiptTxn.amount}/mo</div>
                    <div className="text-sm text-gray-500 mt-1">{txnLabel(receiptTxn)}</div>
                  </>
                ) : (
                  <>
                    <div className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center bg-gradient-to-br from-[#6366F1] to-[#A855F7]">
                      {receiptTxn.amount >= 0 ? (
                        <ArrowDownLeft className="w-7 h-7 text-white" />
                      ) : (
                        <ArrowUpRight className="w-7 h-7 text-white" />
                      )}
                    </div>
                    <div className={`text-xs font-bold ${receiptTxn.amount >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {receiptTxn.amount >= 0 ? "+" : ""}{receiptTxn.amount} Hires
                    </div>
                    <div className="text-sm text-gray-500 mt-1">{txnLabel(receiptTxn)}</div>
                  </>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-start gap-4">
                  <span className="text-sm text-gray-500 shrink-0">Transaction ID</span>
                  <span className="text-sm font-mono font-semibold text-gray-900 break-all text-right">{receiptTxn.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Type</span>
                  <span className="text-sm font-semibold text-gray-900">{txnLabel(receiptTxn)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Status</span>
                  <span className={`text-sm font-semibold ${receiptTxn.status === "posted" ? "text-green-600" : "text-gray-500"}`}>
                    {receiptTxn.status === "posted" ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Date & Time</span>
                  <span className="text-sm font-semibold text-gray-900">{new Date(receiptTxn.createdAt).toLocaleString()}</span>
                </div>
                {receiptTxn.type === "subscription" && receiptTxn.currentPeriodStart && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Period Start</span>
                    <span className="text-sm font-semibold text-gray-900">{new Date(receiptTxn.currentPeriodStart).toLocaleDateString()}</span>
                  </div>
                )}
                {receiptTxn.type === "subscription" && receiptTxn.currentPeriodEnd && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Period End</span>
                    <span className="text-sm font-semibold text-gray-900">{new Date(receiptTxn.currentPeriodEnd).toLocaleDateString()}</span>
                  </div>
                )}
                {receiptTxn.type === "subscription" && receiptTxn.providerSubscriptionId && (
                  <div className="flex justify-between items-start gap-4">
                    <span className="text-sm text-gray-500 shrink-0">Subscription ID</span>
                    <span className="text-sm font-mono text-gray-900 break-all text-right">{receiptTxn.providerSubscriptionId}</span>
                  </div>
                )}
                {receiptTxn.type === "subscription" && receiptTxn.cancelAtPeriodEnd && (
                  <div className="text-xs text-orange-600 bg-orange-50 px-3 py-2 rounded-lg">
                    This subscription will cancel at the end of the current period.
                  </div>
                )}
                {receiptTxn.type !== "subscription" && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Balance After</span>
                    <span className="text-sm font-semibold text-gray-900">{receiptTxn.balanceAfter} Hires</span>
                  </div>
                )}
                {receiptTxn.type !== "subscription" && receiptTxn.referenceId && (
                  <div className="flex justify-between items-start gap-4">
                    <span className="text-sm text-gray-500 shrink-0">Reference ID</span>
                    <span className="text-sm font-mono text-gray-900 break-all text-right">{receiptTxn.referenceId}</span>
                  </div>
                )}
                {receiptTxn.type !== "subscription" && receiptTxn.referenceType && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Reference Type</span>
                    <span className="text-sm font-semibold text-gray-900">{receiptTxn.referenceType}</span>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-gray-200 text-center">
                <div className="text-xs text-gray-400">AutoApply CV - Hires Wallet</div>
                <div className="text-xs text-gray-400">www.autoapplycv.in</div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => {
                  const w = window.open("", "_blank");
                  if (!w) return;
                  w.document.write(`
                    <!DOCTYPE html>
                    <html><head><title>Receipt - ${receiptTxn.id}</title>
                    <style>
                      body { font-family: 'Segoe UI', Arial, sans-serif; max-width: 400px; margin: 40px auto; padding: 20px; color: #1f2937; }
                      .header { text-align: center; margin-bottom: 24px; border-bottom: 2px solid #e5e7eb; padding-bottom: 16px; }
                      .logo { font-size: 20px; font-weight: bold; color: #6366f1; }
                      .amount { font-size: 36px; font-weight: bold; margin: 12px 0 4px; }
                      .amount.credit { color: #16a34a; }
                      .amount.debit { color: #dc2626; }
      .type { color: #6b7280; font-size: 14px; }
                      .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f3f4f6; font-size: 13px; }
                      .label { color: #6b7280; }
                      .value { font-weight: 600; text-align: right; word-break: break-all; max-width: 55%; }
                      .mono { font-family: monospace; font-size: 11px; }
                      .footer { text-align: center; margin-top: 20px; padding-top: 16px; border-top: 2px solid #e5e7eb; color: #9ca3af; font-size: 11px; }
                      @media print { body { margin: 0; } }
                    </style></head><body>
                      <div class="header">
                        <div class="logo">AutoApply CV</div>
                        <div style="color:#6b7280;font-size:12px;">Hires Wallet Receipt</div>
                      </div>
                      <div class="amount ${receiptTxn.amount >= 0 ? 'credit' : 'debit'}">${receiptTxn.amount >= 0 ? '+' : ''}${receiptTxn.amount} Hires</div>
                      <div class="type" style="text-align:center;">${txnLabel(receiptTxn)}</div>
                      <div style="margin-top:20px;">
                        <div class="row"><span class="label">Transaction ID</span><span class="value mono">${receiptTxn.id}</span></div>
                        <div class="row"><span class="label">Type</span><span class="value">${txnLabel(receiptTxn)}</span></div>
                        <div class="row"><span class="label">Status</span><span class="value" style="color:${receiptTxn.status === 'posted' ? '#16a34a' : '#6b7280'}">${receiptTxn.status === 'posted' ? 'Completed' : 'Voided'}</span></div>
                        <div class="row"><span class="label">Date & Time</span><span class="value">${new Date(receiptTxn.createdAt).toLocaleString()}</span></div>
                        <div class="row"><span class="label">Balance After</span><span class="value">${receiptTxn.balanceAfter} Hires</span></div>
                        ${receiptTxn.referenceId ? `<div class="row"><span class="label">Reference ID</span><span class="value mono">${receiptTxn.referenceId}</span></div>` : ''}
                        ${receiptTxn.referenceType ? `<div class="row"><span class="label">Reference Type</span><span class="value">${receiptTxn.referenceType}</span></div>` : ''}
                      </div>
                      <div class="footer">
                        <div>AutoApply CV - Hires Wallet</div>
                        <div>www.autoapplycv.in</div>
                      </div>
                    </body></html>
                  `);
                  w.document.close();
                  setTimeout(() => w.print(), 500);
                }}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#A855F7] text-white text-sm font-semibold hover:opacity-90 transition-all flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download / Print
              </button>
              <button
                onClick={() => setReceiptTxn(null)}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm font-semibold text-gray-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
