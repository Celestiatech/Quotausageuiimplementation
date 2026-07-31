export type ResumeData = {
  name: string;
  headline: string;
  email: string;
  phone: string;
  currentCity: string;
  linkedinUrl: string;
  portfolioUrl: string;
  summary: string;
  skills: {
    frontend: string[];
    backend: string[];
    other: string[];
  };
  experience: Array<{
    title: string;
    company: string;
    location?: string;
    startDate: string;
    endDate?: string;
    description?: string[];
  }>;
  projects: Array<{
    name: string;
    description?: string;
    technologies?: string[];
    link?: string;
  }>;
  education: Array<{
    degree: string;
    field?: string;
    institution: string;
    location?: string;
    startDate?: string;
    endDate?: string;
  }>;
};

function escapeHtml(text: unknown): string {
  const s = text == null ? "" : String(text);
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function wrap(data: ResumeData, bodyHtml: string, extraCss: string = ""): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(data.name)} - Resume</title><style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{color:#111;font-family:Arial,Helvetica,sans-serif;font-size:10pt;line-height:1.4}
body{margin:0;padding:0;background:#fff}
${extraCss}
</style></head><body>${bodyHtml}</body></html>`;
}

export function templateClassic(data: ResumeData): string {
  const s = data.skills;
  const allSkills = [...s.frontend, ...s.backend, ...s.other];
  const body = `
<div style="max-width:800px;margin:0 auto;padding:40px 48px">
  <h1 style="font-size:20pt;margin:0 0 2px;letter-spacing:.3px">${escapeHtml(data.name)}</h1>
  <div style="font-size:11pt;margin:0 0 8px;color:#444">${escapeHtml(data.headline)}</div>
  <div style="font-size:9pt;color:#666;margin:0 0 18px">
    ${escapeHtml(data.currentCity)}${data.currentCity && data.phone ? " &nbsp;|&nbsp; " : ""}${escapeHtml(data.phone)}${(data.currentCity || data.phone) && data.email ? " &nbsp;|&nbsp; " : ""}${escapeHtml(data.email)}
    ${data.linkedinUrl ? ` &nbsp;|&nbsp; <a href="${escapeHtml(data.linkedinUrl)}" style="color:#2563eb;text-decoration:none">LinkedIn</a>` : ""}
    ${data.portfolioUrl ? ` &nbsp;|&nbsp; <a href="${escapeHtml(data.portfolioUrl)}" style="color:#2563eb;text-decoration:none">Portfolio</a>` : ""}
  </div>

  ${data.summary ? `<h2 style="font-size:11pt;margin:0 0 6px;padding-bottom:4px;border-bottom:1.5px solid #ddd;text-transform:uppercase;letter-spacing:.5px">Summary</h2><p style="margin:0 0 16px;color:#333">${escapeHtml(data.summary)}</p>` : ""}

  ${allSkills.length > 0 ? `<h2 style="font-size:11pt;margin:0 0 6px;padding-bottom:4px;border-bottom:1.5px solid #ddd;text-transform:uppercase;letter-spacing:.5px">Core Skills</h2><div style="columns:2;column-gap:20px;margin:0 0 16px"><ul style="margin:4px 0 0 16px;padding:0">${allSkills.map(sk => `<li style="margin:0 0 3px">${escapeHtml(sk)}</li>`).join("")}</ul></div>` : ""}

  ${data.experience.length > 0 ? `<h2 style="font-size:11pt;margin:0 0 6px;padding-bottom:4px;border-bottom:1.5px solid #ddd;text-transform:uppercase;letter-spacing:.5px">Experience</h2>${data.experience.map(job => `
  <div style="margin:0 0 12px">
    <h3 style="font-size:10.5pt;margin:8px 0 2px">${escapeHtml(job.title)} — ${escapeHtml(job.company)}</h3>
    <div style="color:#666;font-size:9pt;margin:0 0 4px">${escapeHtml(job.startDate)} – ${escapeHtml(job.endDate || "Present")}${job.location ? ` &nbsp;|&nbsp; ${escapeHtml(job.location)}` : ""}</div>
    ${job.description?.length ? `<ul style="margin:2px 0 0 16px;padding:0">${job.description.map(d => `<li style="margin:0 0 2px">${escapeHtml(d)}</li>`).join("")}</ul>` : ""}
  </div>`).join("")}` : ""}

  ${data.projects.length > 0 ? `<h2 style="font-size:11pt;margin:0 0 6px;padding-bottom:4px;border-bottom:1.5px solid #ddd;text-transform:uppercase;letter-spacing:.5px">Projects</h2>${data.projects.map(proj => `
  <div style="margin:0 0 10px">
    <h3 style="font-size:10.5pt;margin:8px 0 2px">${escapeHtml(proj.name)}${proj.link ? ` &nbsp; <a href="${escapeHtml(proj.link)}" style="color:#2563eb;font-size:9pt;text-decoration:none">🔗</a>` : ""}</h3>
    ${proj.description ? `<p style="color:#333;margin:0 0 3px">${escapeHtml(proj.description)}</p>` : ""}
    ${proj.technologies?.length ? `<div style="color:#666;font-size:9pt">${proj.technologies.map(t => escapeHtml(t)).join(" &bull; ")}</div>` : ""}
  </div>`).join("")}` : ""}

  ${data.education.length > 0 ? `<h2 style="font-size:11pt;margin:0 0 6px;padding-bottom:4px;border-bottom:1.5px solid #ddd;text-transform:uppercase;letter-spacing:.5px">Education</h2>${data.education.map(edu => `
  <div style="margin:0 0 6px">
    <strong>${escapeHtml(edu.degree)}${edu.field ? ` in ${escapeHtml(edu.field)}` : ""}</strong> — ${escapeHtml(edu.institution)}${edu.endDate ? ` | ${escapeHtml(edu.endDate)}` : ""}
    ${edu.location ? `<span style="color:#666"> &nbsp;—&nbsp; ${escapeHtml(edu.location)}</span>` : ""}
  </div>`).join("")}` : ""}
</div>`;
  return wrap(data, body, `
h2{font-family:Arial,Helvetica,sans-serif}
a:hover{text-decoration:underline!important}
@media print{body{padding:0}div{max-width:100%}}
`);
}

export function templateModern(data: ResumeData): string {
  const s = data.skills;
  const hasSkills = s.frontend.length > 0 || s.backend.length > 0 || s.other.length > 0;

  const sidebarContent = `
    <div style="padding:32px 20px">
      <div style="width:100px;height:100px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#a855f7);margin:0 auto 16px;display:flex;align-items:center;justify-content:center">
        <span style="color:#fff;font-size:32pt;font-weight:700">${escapeHtml(data.name.charAt(0).toUpperCase())}</span>
      </div>
      <h1 style="font-size:16pt;color:#fff;text-align:center;margin:0 0 4px">${escapeHtml(data.name)}</h1>
      <div style="font-size:9pt;color:#c4b5fd;text-align:center;margin:0 0 20px">${escapeHtml(data.headline)}</div>

      <div style="font-size:8.5pt;color:#ddd;margin:0 0 20px;text-align:center">
        <div>${escapeHtml(data.currentCity)}</div>
        <div>${escapeHtml(data.phone)}</div>
        <div>${escapeHtml(data.email)}</div>
        ${data.linkedinUrl ? `<div style="margin-top:4px"><a href="${escapeHtml(data.linkedinUrl)}" style="color:#a5b4fc;text-decoration:none">LinkedIn</a></div>` : ""}
        ${data.portfolioUrl ? `<div><a href="${escapeHtml(data.portfolioUrl)}" style="color:#a5b4fc;text-decoration:none">Portfolio</a></div>` : ""}
      </div>

      ${hasSkills ? `<h2 style="font-size:9pt;color:#fff;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;border-bottom:1px solid rgba(255,255,255,.2);padding-bottom:4px">Skills</h2><div style="font-size:8.5pt;color:#e0e7ff">${[
        ...(s.frontend.length > 0 ? [`<div style="font-weight:700;margin:6px 0 2px;color:#c4b5fd">Frontend</div><div>${s.frontend.map(sk => escapeHtml(sk)).join(" &middot; ")}</div>`] : []),
        ...(s.backend.length > 0 ? [`<div style="font-weight:700;margin:6px 0 2px;color:#c4b5fd">Backend</div><div>${s.backend.map(sk => escapeHtml(sk)).join(" &middot; ")}</div>`] : []),
        ...(s.other.length > 0 ? [`<div style="font-weight:700;margin:6px 0 2px;color:#c4b5fd">Other</div><div>${s.other.map(sk => escapeHtml(sk)).join(" &middot; ")}</div>`] : []),
      ].join("")}</div>` : ""}
    </div>
  `;

  const mainContent = `
    <div style="padding:32px 36px">
      ${data.summary ? `<h2 style="font-size:10pt;text-transform:uppercase;letter-spacing:.8px;color:#6366f1;margin:0 0 8px;padding-bottom:3px;border-bottom:1.5px solid #e0e7ff">Summary</h2><p style="font-size:9.5pt;color:#444;margin:0 0 20px;line-height:1.5">${escapeHtml(data.summary)}</p>` : ""}

      ${data.experience.length > 0 ? `<h2 style="font-size:10pt;text-transform:uppercase;letter-spacing:.8px;color:#6366f1;margin:0 0 8px;padding-bottom:3px;border-bottom:1.5px solid #e0e7ff">Experience</h2>${data.experience.map(job => `
      <div style="margin:0 0 14px">
        <div style="display:flex;justify-content:space-between;align-items:baseline">
          <h3 style="font-size:10pt;font-weight:700;color:#111">${escapeHtml(job.title)} — ${escapeHtml(job.company)}</h3>
          <span style="font-size:8pt;color:#888">${escapeHtml(job.startDate)} – ${escapeHtml(job.endDate || "Present")}</span>
        </div>
        ${job.location ? `<div style="font-size:8pt;color:#888;margin:0 0 4px">${escapeHtml(job.location)}</div>` : ""}
        ${job.description?.length ? `<ul style="margin:2px 0 0 14px;padding:0;font-size:9pt;color:#444">${job.description.map(d => `<li style="margin:0 0 2px">${escapeHtml(d)}</li>`).join("")}</ul>` : ""}
      </div>`).join("")}` : ""}

      ${data.projects.length > 0 ? `<h2 style="font-size:10pt;text-transform:uppercase;letter-spacing:.8px;color:#6366f1;margin:0 0 8px;padding-bottom:3px;border-bottom:1.5px solid #e0e7ff">Projects</h2>${data.projects.map(proj => `
      <div style="margin:0 0 12px">
        <h3 style="font-size:10pt;font-weight:700;color:#111">${escapeHtml(proj.name)}${proj.link ? ` <a href="${escapeHtml(proj.link)}" style="color:#6366f1;font-size:8pt;text-decoration:none">↗</a>` : ""}</h3>
        ${proj.description ? `<p style="font-size:9pt;color:#444;margin:2px 0">${escapeHtml(proj.description)}</p>` : ""}
        ${proj.technologies?.length ? `<div style="font-size:8pt;color:#888;margin-top:2px">${proj.technologies.map(t => escapeHtml(t)).join(" &bull; ")}</div>` : ""}
      </div>`).join("")}` : ""}

      ${data.education.length > 0 ? `<h2 style="font-size:10pt;text-transform:uppercase;letter-spacing:.8px;color:#6366f1;margin:0 0 8px;padding-bottom:3px;border-bottom:1.5px solid #e0e7ff">Education</h2>${data.education.map(edu => `
      <div style="margin:0 0 6px;font-size:9pt">
        <strong>${escapeHtml(edu.degree)}${edu.field ? ` in ${escapeHtml(edu.field)}` : ""}</strong> — ${escapeHtml(edu.institution)}
        ${edu.endDate ? `<span style="color:#888"> | ${escapeHtml(edu.endDate)}</span>` : ""}
      </div>`).join("")}` : ""}
    </div>
  `;

  const body = `
<div style="display:flex;min-height:100vh;max-width:1000px;margin:0 auto">
  <div style="width:280px;background:linear-gradient(180deg,#1e1b4b,#312e81);flex-shrink:0">${sidebarContent}</div>
  <div style="flex:1;background:#fafafa">${mainContent}</div>
</div>`;
  return wrap(data, body);
}

export function templateProfessional(data: ResumeData): string {
  const s = data.skills;
  const allSkills = [...s.frontend, ...s.backend, ...s.other];
  const body = `
<div style="max-width:850px;margin:0 auto">
  <div style="background:linear-gradient(90deg,#1e40af,#3b82f6);padding:32px 48px;color:#fff">
    <h1 style="font-size:22pt;margin:0 0 4px;letter-spacing:.5px;font-weight:300">${escapeHtml(data.name)}</h1>
    <div style="font-size:11pt;margin:0 0 12px;opacity:.9;font-weight:300">${escapeHtml(data.headline)}</div>
    <div style="font-size:9pt;opacity:.8;display:flex;gap:16px;flex-wrap:wrap">
      <span>${escapeHtml(data.currentCity)}</span>
      ${data.phone ? `<span>${escapeHtml(data.phone)}</span>` : ""}
      <span>${escapeHtml(data.email)}</span>
      ${data.linkedinUrl ? `<a href="${escapeHtml(data.linkedinUrl)}" style="color:#93c5fd;text-decoration:none">LinkedIn</a>` : ""}
      ${data.portfolioUrl ? `<a href="${escapeHtml(data.portfolioUrl)}" style="color:#93c5fd;text-decoration:none">Portfolio</a>` : ""}
    </div>
  </div>

  <div style="padding:28px 48px">
    ${data.summary ? `<h2 style="font-size:10pt;text-transform:uppercase;letter-spacing:1px;color:#1e40af;margin:0 0 10px">Professional Summary</h2><p style="font-size:9.5pt;color:#444;margin:0 0 24px;line-height:1.55;border-left:3px solid #3b82f6;padding-left:14px">${escapeHtml(data.summary)}</p>` : ""}

    ${allSkills.length > 0 ? `<h2 style="font-size:10pt;text-transform:uppercase;letter-spacing:1px;color:#1e40af;margin:0 0 10px">Technical Skills</h2><div style="margin:0 0 24px;display:flex;flex-wrap:wrap;gap:4px">${allSkills.map(sk => `<span style="background:#eff6ff;color:#1e40af;padding:3px 10px;border-radius:3px;font-size:8.5pt;border:1px solid #bfdbfe">${escapeHtml(sk)}</span>`).join("")}</div>` : ""}

    ${data.experience.length > 0 ? `<h2 style="font-size:10pt;text-transform:uppercase;letter-spacing:1px;color:#1e40af;margin:0 0 10px">Experience</h2>${data.experience.map(job => `
    <div style="margin:0 0 18px">
      <div style="display:flex;justify-content:space-between;align-items:baseline">
        <h3 style="font-size:10.5pt;color:#111;font-weight:700">${escapeHtml(job.title)}</h3>
        <span style="font-size:8.5pt;color:#888">${escapeHtml(job.startDate)} – ${escapeHtml(job.endDate || "Present")}</span>
      </div>
      <div style="font-size:9.5pt;color:#2563eb;margin:0 0 4px;font-weight:600">${escapeHtml(job.company)}${job.location ? ` &mdash; ${escapeHtml(job.location)}` : ""}</div>
      ${job.description?.length ? `<ul style="margin:2px 0 0 14px;padding:0;font-size:9pt;color:#444">${job.description.map(d => `<li style="margin:0 0 2px">${escapeHtml(d)}</li>`).join("")}</ul>` : ""}
    </div>`).join("")}` : ""}

    ${data.projects.length > 0 ? `<h2 style="font-size:10pt;text-transform:uppercase;letter-spacing:1px;color:#1e40af;margin:0 0 10px">Projects</h2>${data.projects.map(proj => `
    <div style="margin:0 0 14px">
      <h3 style="font-size:10pt;color:#111;font-weight:700">${escapeHtml(proj.name)}${proj.link ? ` <a href="${escapeHtml(proj.link)}" style="color:#3b82f6;font-size:8pt;text-decoration:none">↗</a>` : ""}</h3>
      ${proj.description ? `<p style="font-size:9pt;color:#444;margin:2px 0">${escapeHtml(proj.description)}</p>` : ""}
      ${proj.technologies?.length ? `<div style="font-size:8pt;color:#666;margin-top:2px">${proj.technologies.map(t => escapeHtml(t)).join(" &bull; ")}</div>` : ""}
    </div>`).join("")}` : ""}

    ${data.education.length > 0 ? `<h2 style="font-size:10pt;text-transform:uppercase;letter-spacing:1px;color:#1e40af;margin:0 0 10px">Education</h2>${data.education.map(edu => `
    <div style="margin:0 0 8px;font-size:9.5pt">
      <strong>${escapeHtml(edu.degree)}${edu.field ? ` in ${escapeHtml(edu.field)}` : ""}</strong>
      <span style="color:#444"> — ${escapeHtml(edu.institution)}</span>
      ${edu.endDate ? `<span style="color:#888"> | ${escapeHtml(edu.endDate)}</span>` : ""}
    </div>`).join("")}` : ""}
  </div>
</div>`;
  return wrap(data, body);
}
