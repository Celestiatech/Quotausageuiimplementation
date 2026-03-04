import { Link } from 'react-router';
import { Twitter, Linkedin, Github, Mail } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-gradient-to-br from-gray-50 to-purple-50/30 border-t border-gray-200">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-12 mb-12">
          {/* Company Info */}
          <div className="lg:col-span-2">
            <Link to="/" className="flex items-center gap-2 mb-4 hover:opacity-80 transition-opacity">
              <img
                src="/logos/android-chrome-192x192.png"
                alt="CareerPilot"
                className="w-10 h-10 rounded-xl shadow-lg"
                loading="lazy"
                decoding="async"
              />
              <span className="text-xl font-bold bg-gradient-to-r from-[#6366F1] to-[#A855F7] bg-clip-text text-transparent">
                CareerPilot
              </span>
            </Link>
            <p className="text-gray-600 mb-6 leading-relaxed">
              AI-powered career platform helping engineers land better jobs, faster. Join 50,000+ successful job seekers.
            </p>
            <div className="flex gap-3">
              <a
                href="#"
                className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] hover:from-[#8B5CF6] hover:to-[#A855F7] text-white flex items-center justify-center transition-all duration-200 hover:scale-110 shadow-md"
              >
                <Twitter className="w-5 h-5" />
              </a>
              <a
                href="#"
                className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] hover:from-[#8B5CF6] hover:to-[#A855F7] text-white flex items-center justify-center transition-all duration-200 hover:scale-110 shadow-md"
              >
                <Linkedin className="w-5 h-5" />
              </a>
              <a
                href="#"
                className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] hover:from-[#8B5CF6] hover:to-[#A855F7] text-white flex items-center justify-center transition-all duration-200 hover:scale-110 shadow-md"
              >
                <Github className="w-5 h-5" />
              </a>
              <a
                href="#"
                className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] hover:from-[#8B5CF6] hover:to-[#A855F7] text-white flex items-center justify-center transition-all duration-200 hover:scale-110 shadow-md"
              >
                <Mail className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-4">Product</h4>
            <ul className="space-y-3">
              <li>
                <Link to="/features" className="text-gray-600 hover:text-[#8B5CF6] transition-colors">
                  Features
                </Link>
              </li>
              <li>
                <Link to="/pricing" className="text-gray-600 hover:text-[#8B5CF6] transition-colors">
                  Pricing
                </Link>
              </li>
              <li>
                <Link to="/how-it-works" className="text-gray-600 hover:text-[#8B5CF6] transition-colors">
                  How It Works
                </Link>
              </li>
              <li>
                <a href="#" className="text-gray-600 hover:text-[#8B5CF6] transition-colors">
                  Roadmap
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-4">Company</h4>
            <ul className="space-y-3">
              <li>
                <Link to="/about" className="text-gray-600 hover:text-[#8B5CF6] transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <a href="#" className="text-gray-600 hover:text-[#8B5CF6] transition-colors">
                  Careers
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-600 hover:text-[#8B5CF6] transition-colors">
                  Contact
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-600 hover:text-[#8B5CF6] transition-colors">
                  Press Kit
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-4">Resources</h4>
            <ul className="space-y-3">
              <li>
                <Link to="/blog" className="text-gray-600 hover:text-[#8B5CF6] transition-colors">
                  Blog
                </Link>
              </li>
              <li>
                <Link to="/faq" className="text-gray-600 hover:text-[#8B5CF6] transition-colors">
                  FAQ
                </Link>
              </li>
              <li>
                <a href="#" className="text-gray-600 hover:text-[#8B5CF6] transition-colors">
                  Help Center
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-600 hover:text-[#8B5CF6] transition-colors">
                  Community
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-gray-600 text-sm">
            (c) 2026 CareerPilot. All rights reserved.
          </p>
          <div className="flex gap-6">
            <a href="#" className="text-sm text-gray-600 hover:text-[#8B5CF6] transition-colors">
              Privacy Policy
            </a>
            <a href="#" className="text-sm text-gray-600 hover:text-[#8B5CF6] transition-colors">
              Terms of Service
            </a>
            <a href="#" className="text-sm text-gray-600 hover:text-[#8B5CF6] transition-colors">
              Cookie Policy
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}


