import { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { motion } from 'motion/react';
import { Mail, Lock, User, Eye, EyeOff, Briefcase, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpMessage, setOtpMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const navigate = useNavigate();
  const { signup } = useAuth();

  const sendOtp = async () => {
    setErrorMessage('');
    setOtpMessage('');
    if (!email.trim()) {
      setErrorMessage('Enter your email first');
      return;
    }

    setIsSendingOtp(true);
    try {
      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || 'Failed to send OTP');
      }
      const devOtp = data?.data?.otp as string | undefined;
      setOtpSent(true);
      setOtpVerified(false);
      if (devOtp) {
        setOtp(devOtp);
        setOtpMessage(`Dev OTP: ${devOtp}`);
      } else {
        setOtpMessage('OTP sent to your email');
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to send OTP');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const verifyOtpCode = async () => {
    setErrorMessage('');
    setOtpMessage('');
    if (!otp.trim()) {
      setErrorMessage('Enter OTP to verify');
      return;
    }

    setIsVerifyingOtp(true);
    try {
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || 'OTP verification failed');
      }
      setOtpVerified(true);
      setOtpMessage('Email verified successfully');
    } catch (error) {
      setOtpVerified(false);
      setErrorMessage(error instanceof Error ? error.message : 'OTP verification failed');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpVerified) {
      setErrorMessage('Please verify your email with OTP before creating account');
      return;
    }
    setIsLoading(true);
    setErrorMessage('');
    
    try {
      await signup(name, email, password);
      navigate('/dashboard');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Signup failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="absolute inset-0 bg-grid-pattern opacity-40"></div>
      
      <div className="max-w-6xl w-full relative">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Side */}
          <motion.div
            className="hidden lg:block"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Link to="/" className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center shadow-premium">
                <Briefcase className="w-7 h-7 text-white" />
              </div>
              <span className="text-2xl font-bold text-gradient">CareerPilot</span>
            </Link>

            <h1 className="text-5xl font-bold text-gray-900 mb-6">
              Start your journey to{' '}
              <span className="text-gradient">career success</span>
            </h1>

            <p className="text-xl text-gray-600 mb-8">
              Join 50,000+ engineers who've landed their dream jobs
            </p>

            <div className="space-y-4">
              {[
                'Free forever - No credit card required',
                '3 Auto-Apply actions per day',
                'AI-powered resume optimization',
                'Smart job matching algorithm',
                'Application tracking dashboard'
              ].map((feature, index) => (
                <motion.div
                  key={index}
                  className="flex items-center gap-3"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.3 + index * 0.1 }}
                >
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-gray-700">{feature}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Right Side - Signup Form */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="glass rounded-3xl shadow-premium-lg p-8 lg:p-10 border-2 border-white">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Create Account</h2>
                <p className="text-gray-600">Get started with your free account</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {errorMessage && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {errorMessage}
                  </div>
                )}
                {/* Name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all outline-none"
                      placeholder="John Doe"
                      required
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Email Address
                  </label>
                  <div className="flex gap-3">
                    <div className="relative flex-1">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          setOtpVerified(false);
                        }}
                        className="w-full pl-12 pr-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all outline-none"
                        placeholder="you@example.com"
                        required
                      />
                    </div>
                    <button
                      type="button"
                      onClick={sendOtp}
                      disabled={isSendingOtp}
                      className="px-4 py-3 rounded-xl bg-purple-100 text-purple-700 font-semibold hover:bg-purple-200 transition-colors disabled:opacity-60"
                    >
                      {isSendingOtp ? 'Sending...' : 'Send OTP'}
                    </button>
                  </div>
                </div>

                {/* OTP */}
                {otpSent && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Email OTP
                    </label>
                    <div className="flex gap-3">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                        className="flex-1 px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all outline-none tracking-widest"
                        placeholder="Enter 6-digit OTP"
                        required
                      />
                      <button
                        type="button"
                        onClick={verifyOtpCode}
                        disabled={isVerifyingOtp}
                        className="px-4 py-3 rounded-xl bg-emerald-100 text-emerald-700 font-semibold hover:bg-emerald-200 transition-colors disabled:opacity-60"
                      >
                        {isVerifyingOtp ? 'Verifying...' : 'Verify'}
                      </button>
                    </div>
                    {otpMessage && (
                      <p className={`mt-2 text-sm ${otpVerified ? 'text-emerald-600' : 'text-gray-600'}`}>
                        {otpMessage}
                      </p>
                    )}
                  </div>
                )}

                {/* Password */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-12 pr-12 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all outline-none"
                      placeholder="••••••••"
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Must be at least 8 characters</p>
                </div>

                {/* Terms */}
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" required className="w-5 h-5 mt-0.5 rounded border-gray-300" />
                  <span className="text-sm text-gray-600">
                    I agree to the{' '}
                    <a href="#" className="text-purple-600 hover:text-purple-700 font-semibold">
                      Terms of Service
                    </a>{' '}
                    and{' '}
                    <a href="#" className="text-purple-600 hover:text-purple-700 font-semibold">
                      Privacy Policy
                    </a>
                  </span>
                </label>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading || !otpVerified}
                  className="w-full btn-premium gradient-primary text-white py-4 rounded-xl font-bold shadow-premium hover:shadow-premium-lg transition-all duration-300 disabled:opacity-50"
                >
                  {isLoading ? 'Creating account...' : 'Create Free Account'}
                </button>
              </form>

              {/* Sign In Link */}
              <p className="text-center text-gray-600 mt-6">
                Already have an account?{' '}
                <Link to="/login" className="text-purple-600 hover:text-purple-700 font-semibold">
                  Sign in
                </Link>
              </p>

              {/* Back to Home */}
              <div className="text-center mt-4">
                <Link to="/" className="text-sm text-gray-500 hover:text-gray-700">
                  ← Back to home
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
