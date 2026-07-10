const SYSTEM_PROMPT = `You are an ATS resume expert. Generate a clean, ATS-friendly HTML resume.
Use the exact CSS and HTML structure below — only change the content.

CSS:
:root { --text: #111; --muted: #444; --rule: #ddd; }
body { color: var(--text); font-family: Arial, Helvetica, sans-serif; font-size: 11pt; line-height: 1.35; margin: 32px; }
h1 { font-size: 18pt; margin: 0 0 2px 0; letter-spacing: 0.2px; }
.headline { font-size: 12pt; margin: 0 0 10px 0; }
.contact { margin: 0 0 16px 0; color: var(--muted); }
h2 { font-size: 12pt; margin: 16px 0 6px 0; padding-bottom: 4px; border-bottom: 1px solid var(--rule); text-transform: uppercase; letter-spacing: 0.6px; }
h3 { font-size: 11pt; margin: 10px 0 2px 0; }
.meta { color: var(--muted); margin: 0 0 6px 0; }
ul { margin: 6px 0 0 18px; padding: 0; }
li { margin: 0 0 4px 0; }
.two-col { columns: 2; column-gap: 22px; }
.two-col ul { margin-left: 16px; }
a { color: inherit; text-decoration: none; }

Structure:
<h1>FULL NAME</h1>
<div class="headline">Professional title / headline</div>
<div class="contact">Location | Phone | Email | LinkedIn URL</div>

<h2>Summary</h2>
<p>2-3 sentence professional summary</p>

<h2>Core Skills</h2>
<div class="two-col"><ul><li>skill</li>... (12-15 skills)</ul></div>

<h2>Experience</h2>
For each job:
<h3>Job Title — Company</h3>
<div class="meta">Start – End</div>
<ul><li>achievement</li>...</ul>

<h2>Education</h2>
<div><strong>Degree</strong> — Institution | Year</div>

Return ONLY the HTML starting from <h1>. No markdown, no explanation.`;

export async function generateAtsResume(
  parsedData: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY || "";
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not configured");
  }

  const userPrompt = `Generate an ATS-friendly HTML resume using this data:
${JSON.stringify(parsedData, null, 2)}

Return the HTML starting from <h1>. Use the exact CSS and structure specified.`;

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
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 4096,
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

  const html = content
    .replace(/^```html\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  if (!html.startsWith("<h1")) {
    throw new Error("AI did not return valid HTML");
  }

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Resume</title><style>
:root{--text:#111;--muted:#444;--rule:#ddd}
html,body{color:var(--text);font-family:Arial,Helvetica,sans-serif;font-size:11pt;line-height:1.35}
body{margin:32px}
h1{font-size:18pt;margin:0 0 2px 0;letter-spacing:.2px}
.headline{font-size:12pt;margin:0 0 10px 0}
.contact{margin:0 0 16px 0;color:var(--muted)}
h2{font-size:12pt;margin:16px 0 6px 0;padding-bottom:4px;border-bottom:1px solid var(--rule);text-transform:uppercase;letter-spacing:.6px}
h3{font-size:11pt;margin:10px 0 2px 0}
.meta{color:var(--muted);margin:0 0 6px 0}
ul{margin:6px 0 0 18px;padding:0}
li{margin:0 0 4px 0}
.two-col{columns:2;column-gap:22px}
.two-col ul{margin-left:16px}
a{color:inherit;text-decoration:none}
</style></head><body>${html}</body></html>`;
}
