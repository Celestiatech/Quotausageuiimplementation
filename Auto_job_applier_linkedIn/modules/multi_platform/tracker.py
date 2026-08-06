"""
Multi-platform application tracker.
Tracks statistics across all supported job boards.
"""
import json
import os
from datetime import datetime
from collections import defaultdict
from typing import Dict, List, Optional, Set


class PlatformTracker:
    """
    Tracks job application statistics across multiple platforms.
    Includes duplicate detection to avoid applying to the same company twice.
    """
    
    def __init__(self, save_path: str = "platform_stats.json"):
        self.save_path = save_path
        self.stats = {
            "total_applied": 0,
            "total_skipped": 0,
            "total_failed": 0,
            "total_duplicates": 0,
            "platforms": defaultdict(lambda: {
                "applied": 0,
                "skipped": 0,
                "failed": 0,
                "jobs": []
            }),
            "applied_companies": [],  # Track companies we've applied to
            "session_start": None,
            "last_updated": None,
        }
        self._applied_companies_set: Set[str] = set()
        self.load_stats()
    
    def load_stats(self):
        """Load statistics from file."""
        try:
            if os.path.exists(self.save_path):
                with open(self.save_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    self.stats.update(data)
                    # Convert platforms back to defaultdict
                    if "platforms" in data:
                        platforms = defaultdict(lambda: {
                            "applied": 0,
                            "skipped": 0,
                            "failed": 0,
                            "jobs": []
                        })
                        platforms.update(data["platforms"])
                        self.stats["platforms"] = platforms
                    # Rebuild set from list
                    if "applied_companies" in data:
                        self._applied_companies_set = set(data["applied_companies"])
        except Exception:
            pass
    
    def save_stats(self):
        """Save statistics to file."""
        try:
            self.stats["last_updated"] = datetime.now().isoformat()
            # Sync set to list for JSON serialization
            self.stats["applied_companies"] = list(self._applied_companies_set)
            with open(self.save_path, 'w', encoding='utf-8') as f:
                json.dump(self.stats, f, indent=2, default=str)
        except Exception:
            pass
    
    def is_company_applied(self, company: str) -> bool:
        """
        Check if we've already applied to this company.
        
        Args:
            company: Company name to check
        
        Returns:
            True if already applied, False otherwise
        """
        company_lower = company.strip().lower()
        return company_lower in self._applied_companies_set
    
    def mark_company_applied(self, company: str):
        """
        Mark a company as applied to.
        
        Args:
            company: Company name to mark
        """
        company_lower = company.strip().lower()
        self._applied_companies_set.add(company_lower)
        self.save_stats()
    
    def start_session(self):
        """Mark session start."""
        self.stats["session_start"] = datetime.now().isoformat()
        self.save_stats()
    
    def record_application(self, platform: str, job_title: str, company: str,
                          status: str, details: str = ""):
        """
        Record a job application attempt.
        
        Args:
            platform: Platform name (e.g., 'greenhouse', 'linkedin')
            job_title: Job title
            company: Company name
            status: 'applied', 'skipped', or 'failed'
            details: Additional details (e.g., skip reason)
        """
        platform_data = self.stats["platforms"][platform]
        
        if status == "applied":
            platform_data["applied"] += 1
            self.stats["total_applied"] += 1
            # Mark company as applied
            self.mark_company_applied(company)
        elif status == "skipped":
            platform_data["skipped"] += 1
            self.stats["total_skipped"] += 1
        elif status == "failed":
            platform_data["failed"] += 1
            self.stats["total_failed"] += 1
        elif status == "duplicate":
            self.stats["total_duplicates"] += 1
            platform_data["skipped"] += 1  # Count duplicates as skipped
        
        # Add job record (keep last 100 per platform)
        job_record = {
            "title": job_title,
            "company": company,
            "status": status,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        platform_data["jobs"].append(job_record)
        if len(platform_data["jobs"]) > 100:
            platform_data["jobs"] = platform_data["jobs"][-100:]
        
        self.save_stats()
    
    def get_platform_stats(self, platform: str) -> Dict:
        """Get statistics for a specific platform."""
        return dict(self.stats["platforms"].get(platform, {
            "applied": 0,
            "skipped": 0,
            "failed": 0,
            "jobs": []
        }))
    
    def get_all_stats(self) -> Dict:
        """Get all statistics."""
        return {
            "total_applied": self.stats["total_applied"],
            "total_skipped": self.stats["total_skipped"],
            "total_failed": self.stats["total_failed"],
            "total_duplicates": self.stats.get("total_duplicates", 0),
            "unique_companies_applied": len(self._applied_companies_set),
            "platforms": dict(self.stats["platforms"]),
            "session_start": self.stats.get("session_start"),
            "last_updated": self.stats.get("last_updated"),
        }
    
    def get_summary(self) -> str:
        """Generate a human-readable summary report."""
        lines = []
        lines.append("=" * 60)
        lines.append("MULTI-PLATFORM JOB APPLICATION SUMMARY")
        lines.append("=" * 60)
        lines.append(f"Session Start: {self.stats.get('session_start', 'N/A')}")
        lines.append(f"Last Updated: {self.stats.get('last_updated', 'N/A')}")
        lines.append("")
        
        # Overall totals
        lines.append("OVERALL TOTALS:")
        lines.append(f"  Applied:  {self.stats['total_applied']}")
        lines.append(f"  Skipped:  {self.stats['total_skipped']}")
        lines.append(f"  Failed:   {self.stats['total_failed']}")
        lines.append(f"  Duplicates Skipped: {self.stats.get('total_duplicates', 0)}")
        lines.append(f"  Unique Companies Applied: {len(self._applied_companies_set)}")
        total = self.stats['total_applied'] + self.stats['total_skipped'] + self.stats['total_failed']
        lines.append(f"  Total Attempts:    {total}")
        lines.append("")
        
        # Per-platform breakdown
        lines.append("PER-PLATFORM BREAKDOWN:")
        lines.append("-" * 60)
        
        for platform, data in sorted(self.stats["platforms"].items()):
            if isinstance(data, dict):
                applied = data.get("applied", 0)
                skipped = data.get("skipped", 0)
                failed = data.get("failed", 0)
                total = applied + skipped + failed
                
                if total > 0:
                    lines.append(f"\n{platform.upper()}:")
                    lines.append(f"  Applied: {applied}  Skipped: {skipped}  Failed: {failed}  Total: {total}")
                    
                    # Show last 3 jobs
                    jobs = data.get("jobs", [])
                    if jobs:
                        lines.append("  Recent jobs:")
                        for job in jobs[-3:]:
                            status_icon = "✓" if job.get("status") == "applied" else "○" if job.get("status") == "skipped" else "✗"
                            lines.append(f"    {status_icon} {job.get('title', 'N/A')} at {job.get('company', 'N/A')}")
        
        lines.append("")
        lines.append("=" * 60)
        
        return "\n".join(lines)
    
    def reset_stats(self):
        """Reset all statistics."""
        self.stats = {
            "total_applied": 0,
            "total_skipped": 0,
            "total_failed": 0,
            "platforms": defaultdict(lambda: {
                "applied": 0,
                "skipped": 0,
                "failed": 0,
                "jobs": []
            }),
            "session_start": None,
            "last_updated": None,
        }
        self.save_stats()


# Global tracker instance
_platform_tracker: Optional[PlatformTracker] = None


def get_platform_tracker() -> PlatformTracker:
    """Get or create the global platform tracker."""
    global _platform_tracker
    if _platform_tracker is None:
        _platform_tracker = PlatformTracker()
    return _platform_tracker


def record_platform_application(platform: str, job_title: str, company: str,
                               status: str, details: str = ""):
    """Convenience function to record an application."""
    tracker = get_platform_tracker()
    tracker.record_application(platform, job_title, company, status, details)


def get_platform_summary() -> str:
    """Convenience function to get summary."""
    tracker = get_platform_tracker()
    return tracker.get_summary()
