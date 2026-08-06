"""
Multi-platform job application support.
Provides automated application for Greenhouse, Lever, Workable, Glassdoor, SmartRecruiters, and Ashby job boards.
"""
from .router import (
    detect_platform,
    is_supported_platform,
    apply_to_job,
    get_platform_info,
    is_platform_url,
    get_supported_platforms,
)
from .tracker import (
    PlatformTracker,
    get_platform_tracker,
    record_platform_application,
    get_platform_summary,
)

__all__ = [
    "detect_platform",
    "is_supported_platform",
    "apply_to_job",
    "get_platform_info",
    "is_platform_url",
    "get_supported_platforms",
    "PlatformTracker",
    "get_platform_tracker",
    "record_platform_application",
    "get_platform_summary",
]
