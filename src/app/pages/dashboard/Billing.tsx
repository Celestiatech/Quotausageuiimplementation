import { useEffect, useMemo, useState } from "react";
import { Coins, RefreshCw, Wallet, ArrowDownLeft, ArrowUpRight } from "lucide-react";
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
  type: "credit_purchase" | "credit_bonus" | "debit_apply" | "refund_apply" | "admin_adjustment";
  status: "posted" | "voided";
  amount: number;
  balanceAfter: number;
  referenceType?: string | null;
  referenceId?: string | null;
  createdAt: string;
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
  const [usdAmount, setUsdAmount] = useState(1.0);
  const [discountCode, setDiscountCode] = useState("");
  const [discountPreview, setDiscountPreview] = useState<DiscountPreview | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const INR_PER_USD = 92.5;
  const minTopupRupees = 50;
  const minTopupUsd = 0.54;
  const minTopupUsdCents = Math.round(minTopupUsd * 100);

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

  const usdAmountCents = Math.round((Number.isFinite(usdAmount) ? usdAmount : 0) * 100);
  const belowMinUsd = !Number.isFinite(usdAmount) || usdAmountCents < minTopupUsdCents;
  const effectiveUsdAmount = belowMinUsd ? minTopupUsd : usdAmount;
  const computedRupees = Math.max(minTopupRupees, Math.round(effectiveUsdAmount * INR_PER_USD));
  const computedHires = Math.max(0, computedRupees);

  useEffect(() => {
    setDiscountPreview((prev) => {
      if (!prev) return prev;
      if (prev.baseRupees === computedRupees) return prev;
      return null;
    });
  }, [computedRupees]);

  const applyDiscount = async () => {
    try {
      if (belowMinUsd) {
        throw new Error(`Minimum top-up is $${minTopupUsd.toFixed(2)} before discount`);
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
          rupees: computedRupees,
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
      const cents = Math.round((Number.isFinite(usdAmount) ? usdAmount : 0) * 100);
      if (!Number.isFinite(usdAmount) || cents < minTopupUsdCents) {
        throw new Error(`Minimum top-up is $${minTopupUsd.toFixed(2)}`);
      }
      setProcessing(true);
      setMessage("");
      setError("");

      const orderRes = await fetch("/api/wallet/topup/order", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-idempotency-key": `wallet-${Date.now()}-${usdAmount.toFixed(2)}-${discountCode.trim().toUpperCase() || "nocode"}`,
        },
        body: JSON.stringify({
          rupees: computedRupees,
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

  const txnLabel = (txn: WalletTxn) => {
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
          <h1 className="text-3xl font-bold text-gray-900">Hires Wallet</h1>
          <p className="text-gray-600 mt-1">Buy Hires in USD. 1 Hire = 1 Apply. Minimum top-up $0.54.</p>
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
          <div className="text-3xl font-bold text-gray-900 mt-1 inline-flex items-center gap-2">
            <Wallet className="w-6 h-6 text-purple-600" />
            {wallet?.hireBalance ?? 0}
          </div>
          <div className="text-sm text-gray-500">Hires</div>
        </div>
        <div className="bg-white rounded-2xl p-6 border-2 border-gray-200">
          <div className="text-xs uppercase text-gray-500">Daily Usage</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">{mergedDailyUsage.used}/{mergedDailyUsage.cap}</div>
          <div className="text-sm text-gray-500">Spendable: {mergedDailyUsage.spendable}</div>
        </div>
        <div className="bg-white rounded-2xl p-6 border-2 border-gray-200">
          <div className="text-xs uppercase text-gray-500">Purchased</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">{wallet?.hirePurchased ?? 0}</div>
          <div className="text-sm text-gray-500">Hires</div>
        </div>
        <div className="bg-white rounded-2xl p-6 border-2 border-gray-200">
          <div className="text-xs uppercase text-gray-500">Daily Reset</div>
          <div className="text-sm font-semibold text-gray-900 mt-2">{formattedReset}</div>
          <div className="text-sm text-gray-500 mt-2">Free left: {wallet?.freeRemaining ?? 0}</div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 border-2 border-gray-200">
        <h2 className="text-xl font-bold text-gray-900 mb-4 inline-flex items-center gap-2">
          <Coins className="w-5 h-5 text-purple-600" />
          Top Up Hires
        </h2>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Top-up Amount (USD)
              <span className="ml-2 text-xs font-semibold text-gray-500">(minimum ${minTopupUsd.toFixed(2)})</span>
            </label>
            <input
              type="number"
              min={minTopupUsd}
              step={0.01}
              value={usdAmount}
              onChange={(e) => setUsdAmount(Math.max(0, Number(e.target.value) || 0))}
              className={`px-4 py-2 rounded-xl border-2 outline-none ${
                belowMinUsd ? "border-red-300 focus:border-red-400" : "border-gray-200 focus:border-purple-400"
              }`}
            />
            {belowMinUsd ? (
              <div className="mt-2 text-xs font-semibold text-red-600">
                Minimum top-up is ${minTopupUsd.toFixed(2)}. Amounts like $0.00 or $0.53 will not create an order.
              </div>
            ) : null}
          </div>
          <div className="text-sm text-gray-600 pb-2">
            You will get <span className="font-semibold">{computedHires} Hires</span>. (1 Hire = 1 Apply)
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Discount Code (optional)</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={discountCode}
                onChange={(e) => {
                  setDiscountCode(String(e.target.value || "").toUpperCase());
                  setDiscountPreview(null);
                }}
                placeholder="WELCOME10"
                className="px-4 py-2 rounded-xl border-2 border-gray-200 focus:border-purple-400 outline-none uppercase"
              />
              <button
                onClick={() => void applyDiscount()}
                disabled={applyingDiscount || belowMinUsd}
                className="px-4 py-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-sm font-semibold disabled:opacity-60"
              >
                {applyingDiscount ? "Applying..." : "Apply"}
              </button>
            </div>
          </div>
          <button
            onClick={() => void startTopup()}
            disabled={processing || belowMinUsd}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#A855F7] text-white font-semibold disabled:opacity-60"
          >
            {processing ? "Processing..." : "Pay with Razorpay"}
          </button>
        </div>
        {discountPreview ? (
          <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            <div className="font-semibold">Code applied: {discountPreview.code}</div>
            <div className="mt-1">
              Base: INR {discountPreview.baseRupees} | Discount: INR {discountPreview.discountRupees} | Payable: INR{" "}
              {discountPreview.finalRupees}
            </div>
            {discountPreview.description ? <div className="text-xs mt-1 text-green-700">{discountPreview.description}</div> : null}
          </div>
        ) : null}
        <div className="mt-2 text-xs text-gray-500">
          Charged in INR at approximate rate: $1 = INR {INR_PER_USD.toFixed(1)}.
        </div>
      </div>

      <div className="bg-white rounded-2xl border-2 border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Transaction History</h2>
        {loading ? <div className="text-sm text-gray-500">Loading wallet...</div> : null}
        {!loading && txns.length === 0 ? <div className="text-sm text-gray-500">No wallet transactions yet.</div> : null}
        <div className="space-y-2">
          {txns.map((txn) => (
            <div key={txn.id} className="flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${txn.amount >= 0 ? "bg-green-100" : "bg-red-100"}`}>
                  {txn.amount >= 0 ? <ArrowDownLeft className="w-4 h-4 text-green-700" /> : <ArrowUpRight className="w-4 h-4 text-red-700" />}
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-900">{txnLabel(txn)}</div>
                  <div className="text-xs text-gray-500">{new Date(txn.createdAt).toLocaleString()}</div>
                </div>
              </div>
              <div className="text-right">
                <div className={`text-sm font-bold ${txn.amount >= 0 ? "text-green-700" : "text-red-700"}`}>
                  {txn.amount >= 0 ? "+" : ""}{txn.amount} Hires
                </div>
                <div className="text-xs text-gray-500">Bal: {txn.balanceAfter}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
