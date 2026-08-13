// Canonical mapping from arbitrary screening-question text (as seen on LinkedIn,
// Indeed, Lever, Greenhouse, etc.) to the saved-answer keys used across the
// dashboard, sync-profile, and auto-apply resolution.
//
// A single LinkedIn question can be phrased many ways ("What's your name?",
// "Name", "Please enter your full name", ...) — all of those must resolve to the
// same saved-answer key (e.g. "full_name") so existing answers can be reused.

export function normalizeLabel(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type QuestionRule = {
  key: string;
  exact?: string[];
  all?: string[][];
  any?: string[];
  none?: string[];
  regex?: RegExp;
  keyOf?: (normalized: string) => string;
};

const QUESTION_RULES: QuestionRule[] = [
  // ---- Names (specific fields first, generic "name" last) ----
  {
    key: "first_name",
    exact: [
      "first name",
      "given name",
      "your first name",
      "what is your first name",
      "what s your first name",
      "enter your first name",
      "please enter your first name",
      "first name please",
      "your given name",
    ],
    all: [["first", "name"]],
    none: ["last", "company", "full", "middle"],
  },
  {
    key: "last_name",
    exact: [
      "last name",
      "family name",
      "surname",
      "your last name",
      "what is your last name",
      "what s your last name",
      "enter your last name",
      "please enter your last name",
      "family surname",
      "your family name",
    ],
    all: [["last", "name"], ["family", "name"], ["surname"]],
    none: ["first", "company"],
  },
  {
    key: "full_name",
    exact: [
      "full name",
      "full legal name",
      "legal name",
      "your full name",
      "your legal name",
      "name",
      "your name",
      "applicant name",
      "candidate name",
      "complete name",
      "what is your name",
      "what s your name",
      "whats your name",
      "what is your full name",
      "please enter your name",
      "please enter name",
      "enter your name",
      "enter name",
      "tell us your name",
      "tell me your name",
      "your complete name",
      "name please",
      "your name please",
      "how should we address you",
    ],
    all: [["name"]],
    none: [
      "first",
      "last",
      "given",
      "family",
      "surname",
      "company",
      "business",
      "referrer",
      "middle",
      "nickname",
      "employer",
      "contact",
    ],
  },

  // ---- Contact ----
  {
    key: "email_address",
    exact: [
      "email",
      "email address",
      "e mail",
      "e mail address",
      "your email",
      "your email address",
      "what is your email",
      "what is your email address",
      "what s your email",
      "enter your email",
      "enter email",
      "please enter your email",
      "please enter your email address",
      "contact email",
      "contact email address",
    ],
    all: [["email"], ["e", "mail"]],
    none: ["confirm", "verify", "retype", "re enter"],
  },
  {
    key: "phone_number",
    exact: [
      "phone",
      "phone number",
      "mobile",
      "mobile number",
      "mobile phone",
      "mobile phone number",
      "telephone",
      "telephone number",
      "contact number",
      "cell",
      "cell number",
      "cell phone",
      "your phone number",
      "what is your phone number",
      "what is your mobile number",
      "what is your mobile phone number",
      "enter your phone number",
      "contact phone",
      "best phone number",
      "phone contact",
      "how can we reach you",
    ],
    all: [["phone"], ["mobile"], ["telephone"], ["cell"]],
    none: ["extension"],
  },
  {
    key: "linkedin_url",
    exact: [
      "linkedin",
      "linkedin url",
      "linkedin profile",
      "linkedin profile url",
      "linkedin link",
      "your linkedin",
      "your linkedin profile",
      "what is your linkedin",
      "what is your linkedin profile",
      "enter your linkedin url",
      "please share your linkedin",
      "share your linkedin profile",
      "linkedin profile link",
      "profile url",
      "linkedin handle",
    ],
    all: [["linkedin"]],
    none: ["headline", "summary", "followers"],
  },
  {
    key: "portfolio_url",
    exact: [
      "portfolio",
      "portfolio url",
      "portfolio link",
      "personal website",
      "website",
      "your portfolio",
      "your website",
      "what is your portfolio",
      "enter your portfolio",
      "website url",
      "personal website url",
      "github",
      "github url",
      "your github",
    ],
    all: [["portfolio"], ["website"]],
    none: ["company", "preferred", "search"],
  },

  // ---- Location (preferences before current location) ----
  {
    key: "cp_pref_preferred_countries",
    exact: [
      "preferred countries",
      "preferred country",
      "countries",
      "which countries",
      "countries you want to work in",
      "target countries",
      "countries of interest",
    ],
    all: [["preferred", "country"], ["countries"]],
    none: [],
  },
  {
    key: "cp_pref_search_locations",
    exact: [
      "preferred locations",
      "preferred location",
      "job locations",
      "job location",
      "work locations",
      "work location",
      "location preference",
      "work location preference",
      "preferred job locations",
      "preferred work location",
      "locations you prefer",
      "where would you like to work",
    ],
    all: [["preferred", "location"], ["work", "location"], ["job", "location"], ["location", "preference"]],
    none: ["city"],
  },
  {
    key: "current_city",
    exact: [
      "city",
      "current city",
      "city of residence",
      "your city",
      "your current city",
      "current location",
      "your location",
      "what city",
      "what city do you live in",
      "where are you located",
      "where are you based",
      "where do you live",
      "what is your current city",
      "what is your current location",
      "city state",
      "city and state",
      "location city state",
      "current residence",
      "based in",
      "location",
    ],
    all: [["current", "city"], ["city"], ["current", "location"], ["based", "in"], ["where", "located"], ["where", "live"]],
    none: ["preferred", "work", "job"],
  },
  {
    key: "state_region",
    exact: [
      "state",
      "state region",
      "state province",
      "region",
      "province",
      "your state",
      "what state",
      "what state do you live in",
      "state or province",
      "state district",
    ],
    all: [["state"], ["region"], ["province"]],
    none: ["united states", "usa", "country", "work"],
  },
  {
    key: "country",
    exact: [
      "country",
      "your country",
      "what country",
      "what country are you in",
      "what country do you live in",
      "country of residence",
      "which country",
      "country residence",
    ],
    all: [["country"]],
    none: ["preferred", "work", "job", "cities"],
  },

  // ---- Work authorization / visa ----
  {
    key: "work_authorization_us",
    exact: [
      "work authorization",
      "us work authorization",
      "u s work authorization",
      "work authorization united states",
      "are you authorized to work in the united states",
      "are you legally authorized to work in the united states",
      "are you authorized to work in the us",
      "legally authorized to work",
      "right to work",
      "right to work in the us",
      "do you have the right to work",
      "authorized to work",
      "eligible to work",
      "are you eligible to work",
      "do you have work authorization",
      "your work authorization",
    ],
    all: [["authorized", "work"], ["right", "work"], ["work", "authorization"], ["eligible", "work"], ["legally", "authorized"]],
    none: ["sponsorship", "visa"],
  },
  {
    key: "visa_sponsorship_required",
    exact: [
      "visa sponsorship",
      "need visa sponsorship",
      "do you require visa sponsorship",
      "will you require visa sponsorship",
      "require visa sponsorship",
      "do you need sponsorship",
      "sponsorship",
      "visa",
      "are you seeking sponsorship",
      "require sponsorship",
      "visa status",
      "will you require sponsorship",
      "do you need visa sponsorship",
      "do you require sponsorship",
      "need sponsorship",
    ],
    all: [["sponsorship"], ["visa"], ["require", "sponsorship"]],
    none: ["authorized", "citizen", "right to work"],
  },

  // ---- Workplace comfort (before the generic work-mode rule) ----
  {
    key: "comfortable_working_onsite",
    exact: [
      "comfortable working onsite",
      "comfortable working on site",
      "are you comfortable working onsite",
      "are you comfortable working on site",
      "willing to work onsite",
      "willing to work on site",
      "onsite work",
      "work onsite",
      "on site work",
      "are you willing to work onsite",
    ],
    all: [["comfortable", "onsite"], ["comfortable", "on", "site"], ["willing", "onsite"], ["work", "onsite"]],
    none: [],
  },
  {
    key: "comfortable_commuting",
    exact: [
      "comfortable commuting",
      "are you comfortable commuting",
      "willing to commute",
      "commute",
      "commuting",
      "willing to travel to office",
      "are you willing to commute",
    ],
    all: [["commut"]],
    none: [],
  },
  {
    key: "comfortable_relocation",
    exact: [
      "comfortable relocating",
      "willing to relocate",
      "relocation",
      "relocate",
      "are you willing to relocate",
      "open to relocation",
      "willing to move",
      "are you willing to relocate for this role",
    ],
    all: [["relocat"]],
    none: [],
  },

  // ---- Job preferences ----
  {
    key: "cp_pref_work_mode",
    exact: [
      "work mode",
      "work arrangement",
      "workplace type",
      "remote onsite hybrid",
      "remote or onsite",
      "onsite remote hybrid",
      "work setup",
      "how do you prefer to work",
      "work type",
      "work model",
      "work preference",
      "workplace preference",
      "preferred work mode",
      "do you prefer remote onsite or hybrid",
      "remote hybrid or onsite",
    ],
    all: [["remote", "onsite"], ["remote", "hybrid"], ["work", "mode"], ["work", "arrangement"], ["workplace", "type"], ["onsite", "remote"], ["hybrid", "remote"], ["work", "model"], ["prefer", "remote"]],
    none: ["comfortable", "willing"],
  },
  {
    key: "cp_pref_job_types",
    exact: [
      "job types",
      "employment type",
      "employment types",
      "job type",
      "what type of employment",
      "type of employment",
      "employment preference",
      "employment type preference",
      "preferred employment type",
    ],
    all: [["employment", "type"], ["job", "type"], ["type", "employment"]],
    none: [],
  },
  {
    key: "cp_pref_search_terms",
    exact: [
      "preferred job titles",
      "preferred job title",
      "job titles",
      "job title",
      "desired job titles",
      "search terms",
      "preferred titles",
      "roles you are interested in",
      "desired roles",
      "what roles are you interested in",
      "positions of interest",
      "target roles",
      "preferred job titles search terms",
      "interested roles",
      "role preference",
      "preferred roles",
    ],
    all: [["job", "title"], ["preferred", "title"], ["search", "terms"], ["roles"]],
    none: ["current", "your title", "previous", "applying for"],
  },
  {
    key: "your_title",
    exact: [
      "your title",
      "current title",
      "current job title",
      "what is your title",
      "what is your current title",
      "what is your current job title",
      "your current title",
      "what s your title",
      "what is your job title",
      "your job title",
      "your current job title",
    ],
    all: [["your", "title"], ["current", "title"], ["current", "job", "title"]],
    none: ["preferred", "interest"],
  },

  // ---- Language / education ----
  {
    key: "english_proficiency",
    exact: [
      "english proficiency",
      "english level",
      "english fluency",
      "english language proficiency",
      "what is your english proficiency",
      "english skills",
      "proficiency in english",
      "level of english",
      "english proficiency level",
      "how would you rate your english",
    ],
    all: [["english", "proficiency"], ["english", "level"], ["english", "fluency"], ["english", "skill"], ["english", "language"]],
    none: [],
  },
  {
    key: "bachelors_degree_completed",
    exact: [
      "bachelors degree",
      "bachelor s degree",
      "bachelor degree",
      "have you completed a bachelors degree",
      "do you have a bachelors degree",
      "bachelor s degree completed",
      "bachelors degree completed",
      "do you have a bachelor s degree",
    ],
    all: [["bachelor", "degree"], ["bachelors", "degree"]],
    none: ["masters", "doctorate", "education level"],
  },
  {
    key: "education_level",
    exact: [
      "education level",
      "highest education",
      "highest education level",
      "education",
      "degree level",
      "highest degree",
      "what is your highest education",
      "highest level of education",
      "highest level of education completed",
      "education qualification",
      "level of education",
      "what is your education level",
      "highest level of schooling",
    ],
    all: [["education", "level"], ["education"], ["degree", "level"], ["highest", "education"], ["highest", "degree"]],
    none: ["bachelor", "field of study", "area of study", "major"],
  },

  // ---- Experience ----
  {
    key: "years_of_experience",
    exact: [
      "years of experience",
      "years experience",
      "total experience",
      "years of work experience",
      "work experience years",
      "how many years of experience",
      "how many years of experience do you have",
      "how many years of professional experience",
      "years of professional experience",
      "your experience in years",
      "number of years of experience",
      "how much experience do you have",
      "years of experience do you have",
      "how many years of work experience",
      "total years of experience",
      "overall years of experience",
    ],
    all: [["years", "experience"], ["year", "experience"], ["experience"]],
    none: [
      "with",
      "in",
      "notice",
      "job",
      "salary",
      "ctc",
      "min",
      "max",
      "golang",
      "python",
      "react",
      "node",
      "java",
      "aws",
      "sql",
    ],
  },
  {
    key: "what_is_your_experience_with",
    regex: /experience(?:\s+\w+){0,6}\s+(with|in|on)\s+([a-z0-9 ]+)/,
    keyOf: (normalized) => {
      const match = normalized.match(/experience(?:\s+\w+){0,6}\s+(with|in|on)\s+([a-z0-9 ]+)/);
      const tech = match ? match[2].replace(/\s+/g, "").toLowerCase() : "";
      return tech ? `what_is_your_experience_with_${tech}` : "";
    },
  },

  // ---- Notice period & start date ----
  {
    key: "notice_period_days",
    exact: [
      "notice period",
      "what is your notice period",
      "what s your notice period",
      "your notice period",
      "current notice period",
      "how long is your notice period",
      "notice period in days",
      "how much notice period",
      "notice period days",
      "what is your current notice period",
      "length of notice period",
    ],
    all: [["notice", "period"]],
    none: [],
  },
  {
    key: "start_date_availability",
    exact: [
      "start date",
      "what is your start date",
      "what s your start date",
      "earliest start date",
      "when can you start",
      "availability to start",
      "available to start",
      "available start date",
      "what is your earliest start date",
      "what is the earliest date you can start",
    ],
    all: [["start", "date"], ["available", "start"], ["can", "start"], ["when", "start"]],
    none: [],
  },

  // ---- Salary (specific ranges before generic expected/current) ----
  {
    key: "cp_pref_salary_min",
    exact: [
      "salary range min",
      "salary min",
      "minimum salary",
      "min salary",
      "salary minimum",
      "lowest salary",
      "salary from",
      "lower bound",
      "minimum expected salary",
    ],
    all: [["salary", "min"], ["minimum", "salary"], ["salary", "range", "min"]],
    none: ["max", "highest"],
  },
  {
    key: "cp_pref_salary_max",
    exact: [
      "salary range max",
      "salary max",
      "maximum salary",
      "max salary",
      "salary maximum",
      "highest salary",
      "salary to",
      "upper bound",
      "maximum expected salary",
    ],
    all: [["salary", "max"], ["maximum", "salary"], ["salary", "range", "max"]],
    none: ["min", "lowest"],
  },
  {
    key: "cp_pref_desired_salary",
    exact: [
      "desired salary",
      "your desired salary",
      "what is your desired salary",
      "target salary",
      "salary target",
      "desired annual salary",
      "what is your desired annual salary",
      "annual salary desired",
    ],
    all: [["desired", "salary"], ["target", "salary"]],
    none: [],
  },
  {
    key: "what_is_your_current_ctc",
    exact: [
      "current ctc",
      "what is your current ctc",
      "what is your current salary",
      "current salary",
      "present salary",
      "current compensation",
      "your current ctc",
      "what s your current ctc",
      "what is your present salary",
      "current annual salary",
      "your current salary",
      "what is your current annual salary",
    ],
    all: [["current", "ctc"], ["current", "salary"], ["present", "salary"], ["current", "compensation"]],
    none: ["expected", "desired", "min", "max"],
  },
  {
    key: "what_is_your_expected_ctc",
    exact: [
      "expected ctc",
      "what is your expected ctc",
      "what is your expected salary",
      "expected salary",
      "expected compensation",
      "salary expectation",
      "salary expectations",
      "what salary do you expect",
      "what are your salary expectations",
      "your expected ctc",
      "what s your expected ctc",
      "desired ctc",
      "expected annual salary",
      "what is your expected annual salary",
    ],
    all: [["expected", "ctc"], ["expected", "salary"], ["salary", "expect"], ["salary", "expectation"], ["expected", "compensation"]],
    none: ["min", "max", "range"],
  },

  // ---- Other preferences ----
  {
    key: "cp_pref_confidence_level",
    exact: ["confidence level", "confidence"],
    all: [["confidence", "level"]],
    none: [],
  },
  {
    key: "cp_pref_excluded_companies",
    exact: ["excluded companies", "companies to exclude", "exclude companies", "companies you want to avoid"],
    all: [["excluded", "companies"], ["exclude", "companies"]],
    none: [],
  },
  {
    key: "cp_pref_excluded_keywords",
    exact: ["excluded keywords", "keywords to exclude", "exclude keywords", "keywords to avoid"],
    all: [["excluded", "keywords"], ["exclude", "keywords"]],
    none: [],
  },

  // ---- Address ----
  {
    key: "address_line",
    exact: ["address", "street address", "your address", "current address", "what is your address", "address line", "street", "mailing address"],
    all: [["address"]],
    none: ["email", "linkedin"],
  },
];

function hasExclusion(normalized: string, none?: string[]): boolean {
  return Boolean(none && none.some((word) => normalized.includes(word)));
}

function matchRule(normalized: string, rule: QuestionRule): boolean {
  if (rule.exact && rule.exact.includes(normalized)) {
    return !hasExclusion(normalized, rule.none);
  }
  if (rule.all) {
    for (const words of rule.all) {
      if (words.every((word) => normalized.includes(word)) && !hasExclusion(normalized, rule.none)) {
        return true;
      }
    }
  }
  if (rule.any && rule.any.some((word) => normalized.includes(word))) {
    return !hasExclusion(normalized, rule.none);
  }
  if (rule.regex) {
    return rule.regex.test(normalized) && !hasExclusion(normalized, rule.none);
  }
  return false;
}

/**
 * Maps any screening-question text to its canonical saved-answer key.
 * Unknown questions fall back to a slugified version of the normalized label,
 * so custom answers captured from applications still match their own wording.
 */
export function toQuestionKey(value: string): string {
  const normalized = normalizeLabel(value);
  if (!normalized) return "";
  for (const rule of QUESTION_RULES) {
    if (matchRule(normalized, rule)) {
      if (rule.keyOf) {
        const dynamic = rule.keyOf(normalized);
        if (dynamic) return dynamic;
        continue;
      }
      return rule.key;
    }
  }
  return normalized.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 160);
}
