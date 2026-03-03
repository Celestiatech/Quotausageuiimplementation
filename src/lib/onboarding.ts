type OnboardingUser = {
  name?: string | null;
  phone?: string | null;
  currentCity?: string | null;
  addressLine?: string | null;
  linkedinUrl?: string | null;
  portfolioUrl?: string | null;
  resumeFileName?: string | null;
};

function hasValue(value: string | null | undefined) {
  return Boolean(value && value.trim().length > 0);
}

export function hasCompletedRequiredOnboarding(user: OnboardingUser | null | undefined) {
  if (!user) return false;
  return (
    hasValue(user.name) &&
    hasValue(user.phone) &&
    hasValue(user.currentCity) &&
    hasValue(user.addressLine) &&
    hasValue(user.linkedinUrl) &&
    hasValue(user.portfolioUrl) &&
    hasValue(user.resumeFileName)
  );
}
