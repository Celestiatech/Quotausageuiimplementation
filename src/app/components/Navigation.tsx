import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Menu, X, Sparkles, LogOut, LayoutDashboard, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function Navigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin, logout, user } = useAuth();

  const handleGetStarted = () => {
    if (isAuthenticated) {
      navigate(isAdmin ? '/admin' : '/dashboard');
    } else {
      navigate('/pricing');
    }
  };

  const handleAuthAction = () => {
    if (isAuthenticated) {
      logout();
      navigate('/');
    } else {
      navigate('/login');
    }
  };

  return (
    <>
      {/* Announcement Bar */}
      <div className="bg-gradient-to-r from-[#6366F1] via-[#8B5CF6] to-[#A855F7] text-white py-2.5 px-4 text-center text-sm">
        <span className="inline-flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-yellow-300" />
          <span><strong>Limited Offer:</strong> Get 50% OFF Pro plan - First 100 customers only!</span>
        </span>
      </div>

      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <img
                src="/logos/android-chrome-192x192.png"
                alt="AutoApply CV"
                className="w-10 h-10 rounded-xl shadow-lg"
                loading="eager"
                decoding="async"
              />
              <span className="text-xl font-bold bg-gradient-to-r from-[#6366F1] to-[#A855F7] bg-clip-text text-transparent">
                AutoApply CV
              </span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-8">
              <Link to="/features" className="text-gray-700 hover:text-[#8B5CF6] font-medium transition-colors">
                Features
              </Link>
              <Link to="/how-it-works" className="text-gray-700 hover:text-[#8B5CF6] font-medium transition-colors">
                How It Works
              </Link>
              <Link to="/pricing" className="text-gray-700 hover:text-[#8B5CF6] font-medium transition-colors">
                Pricing
              </Link>
              <Link to="/about" className="text-gray-700 hover:text-[#8B5CF6] font-medium transition-colors">
                About Us
              </Link>
              <Link to="/faq" className="text-gray-700 hover:text-[#8B5CF6] font-medium transition-colors">
                FAQ
              </Link>
              <Link to="/extension-design" className="text-gray-700 hover:text-[#8B5CF6] font-medium transition-colors">
                Extension Design
              </Link>
              <Link to="/blog" className="text-gray-700 hover:text-[#8B5CF6] font-medium transition-colors">
                Blog
              </Link>
            </div>

            {/* CTA Buttons */}
            <div className="hidden lg:flex items-center gap-4">
              {isAuthenticated ? (
                <>
                  <button
                    onClick={() => navigate(isAdmin ? '/admin' : '/dashboard')}
                    className="flex items-center gap-2 text-gray-700 hover:text-[#8B5CF6] font-medium transition-colors"
                  >
                    {isAdmin ? <Shield className="w-4 h-4" /> : <LayoutDashboard className="w-4 h-4" />}
                    {isAdmin ? 'Admin' : 'Dashboard'}
                  </button>
                  <button
                    onClick={handleAuthAction}
                    className="flex items-center gap-2 text-gray-700 hover:text-[#8B5CF6] font-medium transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleAuthAction}
                    className="text-gray-700 hover:text-[#8B5CF6] font-medium transition-colors"
                  >
                    Sign In
                  </button>
                  <button 
                    onClick={handleGetStarted}
                    className="px-6 py-2.5 bg-gradient-to-r from-[#6366F1] via-[#8B5CF6] to-[#A855F7] text-white rounded-lg font-semibold hover:shadow-xl hover:scale-105 transition-all duration-200"
                  >
                    Get Started
                  </button>
                </>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="lg:hidden py-4 border-t border-gray-200 animate-in slide-in-from-top duration-200">
              <div className="flex flex-col gap-4">
                <Link 
                  to="/features" 
                  className="text-gray-700 hover:text-[#8B5CF6] font-medium transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Features
                </Link>
                <Link 
                  to="/how-it-works" 
                  className="text-gray-700 hover:text-[#8B5CF6] font-medium transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  How It Works
                </Link>
                <Link 
                  to="/pricing" 
                  className="text-gray-700 hover:text-[#8B5CF6] font-medium transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Pricing
                </Link>
                <Link 
                  to="/about" 
                  className="text-gray-700 hover:text-[#8B5CF6] font-medium transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  About Us
                </Link>
                <Link 
                  to="/faq" 
                  className="text-gray-700 hover:text-[#8B5CF6] font-medium transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  FAQ
                </Link>
                <Link 
                  to="/blog" 
                  className="text-gray-700 hover:text-[#8B5CF6] font-medium transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Blog
                </Link>
                <Link
                  to="/extension-design"
                  className="text-gray-700 hover:text-[#8B5CF6] font-medium transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Extension Design
                </Link>
                <div className="pt-4 border-t border-gray-200 flex flex-col gap-2">
                  {isAuthenticated ? (
                    <>
                      <button
                        onClick={() => navigate(isAdmin ? '/admin' : '/dashboard')}
                        className="flex items-center gap-2 text-gray-700 hover:text-[#8B5CF6] font-medium transition-colors text-left"
                      >
                        {isAdmin ? <Shield className="w-4 h-4" /> : <LayoutDashboard className="w-4 h-4" />}
                        {isAdmin ? 'Admin' : 'Dashboard'}
                      </button>
                      <button
                        onClick={handleAuthAction}
                        className="flex items-center gap-2 text-gray-700 hover:text-[#8B5CF6] font-medium transition-colors text-left"
                      >
                        <LogOut className="w-4 h-4" />
                        Logout
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={handleAuthAction}
                        className="text-gray-700 hover:text-[#8B5CF6] font-medium transition-colors text-left"
                      >
                        Sign In
                      </button>
                      <button 
                        onClick={() => {
                          handleGetStarted();
                          setMobileMenuOpen(false);
                        }}
                        className="px-6 py-2.5 bg-gradient-to-r from-[#6366F1] via-[#8B5CF6] to-[#A855F7] text-white rounded-lg font-semibold"
                      >
                        Get Started
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </nav>
    </>
  );
}
