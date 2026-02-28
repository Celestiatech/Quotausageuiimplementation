import * as Dialog from '@radix-ui/react-dialog';
import { X, Zap, Check } from 'lucide-react';

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UpgradeModal({ open, onOpenChange }: UpgradeModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-in fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg bg-white rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200">
          <div className="relative">
            {/* Header */}
            <div className="px-8 pt-8 pb-6 border-b border-gray-100">
              <Dialog.Close className="absolute right-6 top-6 rounded-full p-2 hover:bg-gray-100 transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </Dialog.Close>
              
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0EA5E9] to-[#06B6D4] flex items-center justify-center">
                  <Zap className="w-6 h-6 text-white fill-white" />
                </div>
                <div>
                  <Dialog.Title className="text-2xl font-semibold text-[#030213]">
                    Unlock Unlimited Auto-Apply
                  </Dialog.Title>
                </div>
              </div>
              
              <Dialog.Description className="text-gray-600 text-base">
                You've reached your daily limit. Upgrade to Pro for unlimited Auto-Apply actions and accelerate your job search.
              </Dialog.Description>
            </div>

            {/* Content */}
            <div className="px-8 py-6 space-y-6">
              {/* Pro Plan Card */}
              <div className="relative rounded-xl border-2 border-[#0EA5E9] bg-gradient-to-br from-blue-50/50 to-cyan-50/50 p-6">
                <div className="absolute -top-3 left-6 bg-gradient-to-r from-[#0EA5E9] to-[#06B6D4] text-white text-xs font-semibold px-3 py-1 rounded-full">
                  MOST POPULAR
                </div>
                
                <div className="mb-4">
                  <h3 className="text-xl font-semibold text-[#030213] mb-1">Pro Plan</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-[#030213]">$29</span>
                    <span className="text-gray-600">/month</span>
                  </div>
                </div>

                <ul className="space-y-3 mb-6">
                  {[
                    'Unlimited Auto-Apply actions',
                    'Advanced job matching algorithm',
                    'Priority application processing',
                    'AI-powered resume optimization',
                    'Interview preparation tools',
                    'Weekly analytics & insights'
                  ].map((feature, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-[#0EA5E9] flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                      <span className="text-gray-700 text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button className="w-full bg-gradient-to-r from-[#0EA5E9] to-[#06B6D4] text-white py-3 rounded-lg font-semibold hover:shadow-lg hover:scale-[1.02] transition-all duration-200">
                  Upgrade to Pro
                </button>
              </div>

              {/* Free Plan Info */}
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <h4 className="text-sm font-semibold text-[#030213] mb-2">Stay on Free Plan</h4>
                <p className="text-sm text-gray-600 mb-3">
                  Continue with 3 Auto-Apply actions per day. Your quota resets every 24 hours.
                </p>
                <button
                  onClick={() => onOpenChange(false)}
                  className="text-sm text-[#0EA5E9] font-medium hover:underline"
                >
                  Maybe later
                </button>
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
