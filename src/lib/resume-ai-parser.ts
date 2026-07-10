export type AiParsedResume = {
  name?: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  country?: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
  yearsOfExperience?: string;
  educationLevel?: string;
  skills?: string[];
  jobTitles?: string[];
  workAuthorization?: string;
  summary?: string;
  experience?: Array<{
    title: string;
    company: string;
    location?: string;
    startDate: string;
    endDate?: string;
    description?: string[];
  }>;
  projects?: Array<{
    name: string;
    description?: string;
    technologies?: string[];
    link?: string;
  }>;
  education?: Array<{
    degree: string;
    field?: string;
    institution: string;
    location?: string;
    startDate?: string;
    endDate?: string;
  }>;
  certifications?: Array<{
    name: string;
    issuer?: string;
    date?: string;
  }>;
};

const SYSTEM_PROMPT = `You extract structured data from resumes. Return ONLY valid JSON with these fields:
{
  "name": "Full name",
  "email": "Email address",
  "phone": "Phone number",
  "city": "City",
  "state": "State or region",
  "country": "Country",
  "linkedinUrl": "LinkedIn profile URL",
  "portfolioUrl": "Portfolio or personal website URL",
  "yearsOfExperience": "Total years of professional experience (number only)",
  "educationLevel": "Highest education level (High School, Bachelor's, Master's, PhD, etc.)",
  "skills": ["skill1", "skill2", ...],
  "jobTitles": ["Most recent job titles"],
  "workAuthorization": "Work authorization status if mentioned",
  "summary": "Professional summary (2-4 sentences)",
  "experience": [
    {
      "title": "Job title",
      "company": "Company name",
      "location": "City, State, Country (optional)",
      "startDate": "YYYY-MM or Month YYYY",
      "endDate": "YYYY-MM or Month YYYY or Present",
      "description": ["bullet point 1", "bullet point 2"]
    }
  ],
  "projects": [
    {
      "name": "Project name",
      "description": "Brief description",
      "technologies": ["tech1", "tech2"],
      "link": "Project URL (optional)"
    }
  ],
  "education": [
    {
      "degree": "Degree name (e.g., B.Tech, M.S., PhD)",
      "field": "Field of study",
      "institution": "University/Institution name",
      "location": "City, State, Country (optional)",
      "startDate": "YYYY or Month YYYY (optional)",
      "endDate": "YYYY or Month YYYY (optional)"
    }
  ],
  "certifications": [
    {
      "name": "Certification name",
      "issuer": "Issuing organization",
      "date": "YYYY-MM or YYYY (optional)"
    }
  ]
}

  }
}

Use null for missing fields. Do not include any text outside the JSON.
Extract ALL experience entries, ALL projects, ALL education, ALL certifications, and ALL skills completely. Do not skip or summarize any items. Include every bullet point from each experience entry. Include every project with its full description, technologies, and link. The output JSON must contain the complete data from the resume without omission.`;

export async function parseResumeWithAi(
  resumeText: string,
  signal?: AbortSignal,
): Promise<AiParsedResume> {
  const apiKey = process.env.GROQ_API_KEY || "";
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not configured");
  }

  const truncated = resumeText.slice(0, 30000);

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Extract data from this resume:\n\n${truncated}` },
      ],
      temperature: 0.1,
      max_tokens: 8192,
      response_format: { type: "json_object" },
    }),
    signal,
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Groq API error (${res.status}): ${errBody}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Groq returned empty response");
  }

  try {
    const raw = JSON.parse(content) as Record<string, unknown>;
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (v === null || v === undefined) continue;
      if (k === "yearsOfExperience") cleaned[k] = String(v);
      else if (k === "skills" || k === "jobTitles") cleaned[k] = Array.isArray(v) ? v : [];
      else if (k === "experience" || k === "projects" || k === "education" || k === "certifications") {
        cleaned[k] = Array.isArray(v) ? v : [];
      }
      else if (typeof v === "string") cleaned[k] = v;
      else if (typeof v === "number") cleaned[k] = String(v);
      else cleaned[k] = v;
    }
    return cleaned as unknown as AiParsedResume;
  } catch {
    throw new Error(`Failed to parse AI response as JSON: ${content.slice(0, 200)}`);
  }
}
