export type VacancyFieldSpec = {
  label?: string;
  type?: string;
  required?: boolean | string;
  options?: Array<string | { label?: string }>;
};

export type VacancyAnswer = { label: string; value: string };

export type ScreeningAnswersMap = Record<string, string>;

export type FieldResolverProfile = {
  name?: string;
  email?: string;
  phone?: string;
  currentCity?: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
  skills?: string[];
  jobTitles?: string[];
  yearsOfExperience?: string;
  workAuthorization?: string;
  summary?: string;
};

function normalizeKey(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[\t\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findSavedAnswer(answers: ScreeningAnswersMap, ...keys: string[]): string {
  if (!answers || typeof answers !== "object") return "";
  for (const key of keys) {
    const direct = answers[key];
    if (direct !== undefined && direct !== null && String(direct).trim() !== "") {
      return String(direct).trim();
    }
  }
  for (const [k, v] of Object.entries(answers)) {
    if (!v || String(v).trim() === "") continue;
    const keyNorm = normalizeKey(k);
    for (const key of keys) {
      if (keyNorm === normalizeKey(key)) return String(v).trim();
    }
  }
  return "";
}

function parseNumeric(value: unknown): number | null {
  const cleaned = String(value || "").replace(/[^0-9.-]/g, "");
  const num = parseFloat(cleaned);
  return Number.isNaN(num) ? null : num;
}

function toLpaString(value: unknown): string {
  const num = parseNumeric(value);
  if (num === null) return "";
  const lpa = num >= 100000 ? num / 100000 : num;
  return String(Math.round(lpa * 10) / 10);
}

function normalizeOptionText(option: string | { label?: string }): string {
  if (typeof option === "string") return option;
  return String(option?.label || "");
}

function matchOption(options: Array<string | { label?: string }> | undefined, value: string): string {
  const list = Array.isArray(options) ? options : [];
  if (!list.length) return "";
  const valueNorm = normalizeKey(value);
  const num = parseNumeric(value);

  const texts = list.map(normalizeOptionText);
  const exact = texts.find((o) => normalizeKey(o) === valueNorm);
  if (exact) return exact;

  if (num !== null) {
    for (const o of texts) {
      const nums = String(o || "").match(/\d+(\.\d+)?/g);
      if (!nums || !nums.length) continue;
      const parsed = nums.map(Number);
      if (parsed.length >= 2) {
        const lo = Math.min(...parsed);
        const hi = Math.max(...parsed);
        if (num >= lo && num <= hi) return o;
      } else if (parsed.length === 1) {
        if (Math.abs(parsed[0] - num) <= 0.01) return o;
      }
    }
  }

  let contains = texts.find((o) => valueNorm && normalizeKey(o).includes(valueNorm));
  if (contains) return contains;
  contains = texts.find(
    (o) => valueNorm && valueNorm.includes(normalizeKey(o)) && normalizeKey(o).length > 2,
  );
  return contains || "";
}

export function resolveVacancyFields(
  fields: VacancyFieldSpec[],
  answers: ScreeningAnswersMap,
  profile?: FieldResolverProfile | null,
): { answers: VacancyAnswer[]; unresolved: VacancyFieldSpec[] } {
  const answersList: VacancyAnswer[] = [];
  const unresolved: VacancyFieldSpec[] = [];

  for (const field of fields) {
    const label = normalizeKey(field.label || "");
    if (!label) {
      unresolved.push(field);
      continue;
    }

    let value = "";

    if (label.includes("english")) {
      const eng = findSavedAnswer(
        answers,
        "english_proficiency",
        "English Proficiency",
        "What is your English Proficiency?",
        "englishProficiency",
      );
      if (eng) {
        const e = normalizeKey(eng);
        if (/professional|advanced|fluent|native/.test(e)) value = "Fluent/Native-like or Advanced";
        else if (/intermediate|beginner|basic/.test(e)) value = "Intermediate or Beginner";
        else value = eng;
      }
    }

    if (!value && /salary|ctc|compensation|lpa|\bpay\b/.test(label)) {
      const isCurrent = /current|existing|present/.test(label);
      const isExpected = /expected|minimum|min|desired|target|asking/.test(label);
      let raw = "";
      if (isCurrent) {
        raw = findSavedAnswer(
          answers,
          "what_is_your_current_ctc",
          "What is your Current CTC?",
          "What is your current salary?",
          "current_ctc",
          "currentCtc",
          "Current CTC",
          "current salary",
          "current_salary",
        );
      }
      if (isExpected) {
        raw = findSavedAnswer(
          answers,
          "what_is_your_expected_ctc",
          "What is your Expected CTC?",
          "What is your Expected Salary?",
          "expected_ctc",
          "expectedCtc",
          "Expected CTC",
          "Desired Salary",
          "desired_salary",
          "expected_salary",
        );
      }
      if (raw) {
        const lpa = toLpaString(raw);
        if (lpa) {
          if (Array.isArray(field.options) && field.options.length) {
            const matched = matchOption(field.options, lpa);
            value = matched || lpa;
          } else {
            value = lpa;
          }
        }
      }
    }

    if (!value && (label.includes("start date") || label.includes("available to start") || label.includes("earliest start"))) {
      const notice = findSavedAnswer(
        answers,
        "what_is_your_notice_period",
        "What Is Your Notice Period",
        "What is your Notice Period?",
        "notice_period_days",
        "noticePeriodDays",
        "notice period",
        "Notice Period",
      );
      const days = parseNumeric(notice);
      if (days !== null) {
        const option = days <= 0 ? "I am available immediately" : days <= 30 ? "In 30 days" : days <= 45 ? "In 45 days" : "More than 45 days";
        if (Array.isArray(field.options) && field.options.length) {
          const matched = matchOption(field.options, option);
          value = matched || option;
        } else {
          value = option;
        }
      }
    }

    if (!value && label.includes("notice") && label.includes("period")) {
      const notice = findSavedAnswer(
        answers,
        "what_is_your_notice_period",
        "What Is Your Notice Period",
        "What is your Notice Period?",
        "notice_period_days",
        "noticePeriodDays",
        "notice period",
        "Notice Period",
      );
      const days = parseNumeric(notice);
      if (days !== null) {
        const asText = days <= 0 ? "0" : String(days);
        if (Array.isArray(field.options) && field.options.length) {
          const matched = matchOption(field.options, asText);
          value = matched || asText;
        } else {
          value = asText;
        }
      }
    }

    if (!value && label.includes("experience")) {
      const techs = ["golang", "go", "python", "react", "node", "java", "javascript", "typescript", "aws", "sql", "docker", "kubernetes", "system design", "ai", "api", "graphql"];
      for (const tech of techs) {
        if (!label.includes(tech)) continue;
        const saved = findSavedAnswer(
          answers,
          `what_is_your_experience_with_${tech.replace(/[^a-z]/g, "")}`,
          `What is your experience with ${tech}?`,
          `What is your experience with ${tech}`,
          `experience with ${tech}`,
          `${tech} experience`,
        );
        if (saved) {
          if (Array.isArray(field.options) && field.options.length) {
            const matched = matchOption(field.options, saved);
            value = matched || String(saved).trim();
          } else {
            value = String(saved).trim();
          }
        }
        break;
      }
    }

    if (!value && (label.includes("acknowledge") || label.includes("read and understand") || label.includes("confirm"))) {
      if (Array.isArray(field.options) && field.options.length) {
        const yes =
          field.options.find((o) => normalizeKey(normalizeOptionText(o)) === "yes") ||
          field.options.find((o) => /^yes$/i.test(normalizeOptionText(o)));
        value = yes ? normalizeOptionText(yes) : "Yes";
      } else {
        value = "Yes";
      }
    }

    if (!value && label.includes("negotiation")) {
      const saved = findSavedAnswer(answers, "open to negotiation", "open_to_negotiation", "negotiable");
      if (saved) {
        if (Array.isArray(field.options) && field.options.length) {
          const matched = matchOption(field.options, saved);
          value = matched || String(saved).trim();
        } else {
          value = String(saved).trim();
        }
      }
    }

    if (!value && profile) {
      value = resolveFromProfile(field, profile);
    }

    if (value) {
      answersList.push({ label: String(field.label || "").trim(), value });
    } else {
      unresolved.push(field);
    }
  }

  return { answers: answersList, unresolved };
}

function resolveFromProfile(field: VacancyFieldSpec, profile: FieldResolverProfile): string {
  const label = normalizeKey(field.label || "");

  if (/name\b/.test(label) && !label.includes("company")) {
    if (profile.name) return profile.name;
  }
  if (label.includes("email")) {
    if (profile.email) return profile.email;
  }
  if (label.includes("phone") || label.includes("mobile") || label.includes("telephone") || label.includes("contact number")) {
    if (profile.phone) return profile.phone;
  }
  if (label.includes("linkedin") || label.includes("profile url")) {
    if (profile.linkedinUrl) return profile.linkedinUrl;
  }
  if (label.includes("portfolio") || label.includes("website")) {
    if (profile.portfolioUrl) return profile.portfolioUrl;
  }
  if (label.includes("city") || label.includes("location") || label.includes("based in")) {
    if (profile.currentCity) {
      if (Array.isArray(field.options) && field.options.length) {
        const matched = matchOption(field.options, profile.currentCity);
        if (matched) return matched;
      }
      return profile.currentCity;
    }
  }
  if (label.includes("authorization") || label.includes("right to work") || label.includes("sponsorship")) {
    if (Array.isArray(field.options) && field.options.length) {
      const auth = profile.workAuthorization || "";
      const yes = field.options.find((o) => /^yes$/i.test(normalizeOptionText(o)));
      if (/yes|authorized|eligible|citizen|permanent|green card/.test(normalizeKey(auth)) && yes) return normalizeOptionText(yes);
      if (/no|requires|needs sponsorship/.test(normalizeKey(auth))) {
        const no = field.options.find((o) => /^no$/i.test(normalizeOptionText(o)));
        if (no) return normalizeOptionText(no);
      }
    } else if (profile.workAuthorization) {
      return profile.workAuthorization;
    }
  }
  if (label.includes("experience") && !label.includes("with")) {
    if (Array.isArray(field.options) && field.options.length && profile.yearsOfExperience) {
      const matched = matchOption(field.options, profile.yearsOfExperience);
      if (matched) return matched;
    }
    if (profile.yearsOfExperience) return profile.yearsOfExperience;
  }
  if (label.includes("summary") || label.includes("cover letter") || label.includes("tell us about yourself")) {
    if (profile.summary) return profile.summary;
  }

  return "";
}
