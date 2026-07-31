"use client";

import { useState } from "react";
import { Plus, Trash2, MoveUp, MoveDown, Image, Type, Heading, Minus, MousePointerClick } from "lucide-react";

type BlockType = "heading" | "text" | "image" | "button" | "divider" | "footer";

interface ContentBlock {
  id: string;
  type: BlockType;
  content: string;
  extra?: string;
}

interface TemplateDesign {
  id: string;
  name: string;
  desc: string;
  preview: string;
  getHtml: (blocks: ContentBlock[]) => string;
}

const DESIGNS: TemplateDesign[] = [
  {
    id: "clean",
    name: "Clean Professional",
    desc: "White background, centered, elegant",
    preview: "bg-white text-center font-sans",
    getHtml: (blocks) => `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:20px"><tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.05)">${renderBlocks(blocks, "clean")}</table></td></tr></table></body></html>`,
  },
  {
    id: "bold",
    name: "Bold Marketing",
    desc: "Colorful header, strong CTAs",
    preview: "bg-gradient-to-r from-purple-600 to-pink-500 text-white font-bold",
    getHtml: (blocks) => `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:20px"><tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden"><tr><td style="background:linear-gradient(135deg,#7c3aed,#ec4899);padding:30px;text-align:center"><h1 style="color:#fff;margin:0;font-size:28px">🚀</h1></td></tr><tr><td style="padding:30px">${renderBlocks(blocks, "bold")}</td></tr></table></td></tr></table></body></html>`,
  },
  {
    id: "modern",
    name: "Modern Dark",
    desc: "Dark theme with accent colors",
    preview: "bg-gray-900 text-white font-mono",
    getHtml: (blocks) => `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#0f0f0f;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f0f;padding:20px"><tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#1a1a2e;border-radius:12px;overflow:hidden"><tr><td style="padding:30px">${renderBlocks(blocks, "modern")}</td></tr></table></td></tr></table></body></html>`,
  },
  {
    id: "minimal",
    name: "Minimal",
    desc: "Simple text-only, elegant",
    preview: "bg-gray-50 text-gray-700 font-serif",
    getHtml: (blocks) => `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#fafafa;font-family:Georgia,'Times New Roman',serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;padding:40px 20px"><tr><td align="center"><table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #eee">${renderBlocks(blocks, "minimal")}</table></td></tr></table></body></html>`,
  },
  {
    id: "newsletter",
    name: "Newsletter",
    desc: "Multi-section with image + text",
    preview: "bg-white border-l-4 border-blue-500 font-sans",
    getHtml: (blocks) => `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#e8f0fe;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e8f0fe;padding:20px"><tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden"><tr><td style="background:#3b82f6;padding:20px 30px"><h1 style="color:#fff;margin:0;font-size:22px">📬 Newsletter</h1></td></tr><tr><td style="padding:30px">${renderBlocks(blocks, "newsletter")}</td></tr><tr><td style="background:#f8fafc;padding:15px 30px;text-align:center;font-size:12px;color:#94a3b8"><p style="margin:0">You're receiving this because you signed up. <a href="#" style="color:#3b82f6">Unsubscribe</a></p></td></tr></table></td></tr></table></body></html>`,
  },
];

function renderBlocks(blocks: ContentBlock[], designId: string): string {
  const isDark = designId === "modern";
  const textColor = isDark ? "#e2e8f0" : "#333";
  const accentColor = designId === "bold" ? "#7c3aed" : designId === "modern" ? "#6366f1" : designId === "newsletter" ? "#3b82f6" : "#555";

  return blocks
    .map((block) => {
      switch (block.type) {
        case "heading":
          return `<h2 style="color:${accentColor};margin:20px 0 10px;font-size:22px;line-height:1.3">${block.content}</h2>`;
        case "text":
          return `<p style="color:${textColor};margin:10px 0;font-size:15px;line-height:1.7">${block.content}</p>`;
        case "image":
          return block.content
            ? `<div style="margin:15px 0;text-align:center"><img src="${block.content}" alt="" style="max-width:100%;height:auto;border-radius:6px" /></div>`
            : "";
        case "button":
          return `<div style="margin:20px 0;text-align:center"><a href="${block.extra || "#"}" style="display:inline-block;background:${accentColor};color:#fff;padding:12px 30px;border-radius:6px;text-decoration:none;font-size:15px;font-weight:bold">${block.content || "Click Here"}</a></div>`;
        case "divider":
          return `<hr style="border:none;border-top:1px solid ${isDark ? "#334" : "#e5e7eb"};margin:20px 0" />`;
        case "footer":
          return `<div style="margin-top:20px;padding-top:15px;border-top:1px solid ${isDark ? "#334" : "#e5e7eb"};font-size:12px;color:#94a3b8;text-align:center"><p style="margin:2px 0">${block.content}</p></div>`;
        default:
          return "";
      }
    })
    .join("");
}

type Props = {
  initialHtml?: string;
  onHtmlChange: (html: string) => void;
};

let blockIdCounter = 0;
function newBlockId(): string {
  blockIdCounter++;
  return `blk_${blockIdCounter}_${Date.now()}`;
}

export default function TemplateDesigner({ initialHtml, onHtmlChange }: Props) {
  const [selectedDesign, setSelectedDesign] = useState("clean");
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);

  const addBlock = (type: BlockType) => {
    const defaults: Record<BlockType, { content: string; extra?: string }> = {
      heading: { content: "Your Heading Here" },
      text: { content: "Your text content goes here. Write something engaging for your readers." },
      image: { content: "", extra: "https://via.placeholder.com/600x300" },
      button: { content: "Click Here", extra: "https://example.com" },
      divider: { content: "" },
      footer: { content: "© 2026 Your Company. All rights reserved." },
    };
    const d = defaults[type];
    const newBlock: ContentBlock = { id: newBlockId(), type, content: d.content, extra: d.extra };
    const updated = [...blocks, newBlock];
    setBlocks(updated);
    onHtmlChange(generateHtml(selectedDesign, updated));
  };

  const removeBlock = (id: string) => {
    const updated = blocks.filter((b) => b.id !== id);
    setBlocks(updated);
    onHtmlChange(generateHtml(selectedDesign, updated));
  };

  const moveBlock = (id: string, dir: "up" | "down") => {
    const idx = blocks.findIndex((b) => b.id === id);
    if (idx === -1) return;
    if (dir === "up" && idx === 0) return;
    if (dir === "down" && idx === blocks.length - 1) return;
    const updated = [...blocks];
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    [updated[idx], updated[swapIdx]] = [updated[swapIdx], updated[idx]];
    setBlocks(updated);
    onHtmlChange(generateHtml(selectedDesign, updated));
  };

  const updateBlock = (id: string, field: "content" | "extra", value: string) => {
    const updated = blocks.map((b) => (b.id === id ? { ...b, [field]: value } : b));
    setBlocks(updated);
    onHtmlChange(generateHtml(selectedDesign, updated));
  };

  const selectDesign = (id: string) => {
    setSelectedDesign(id);
    onHtmlChange(generateHtml(id, blocks));
  };

  const generateHtml = (designId: string, blks: ContentBlock[]) => {
    const design = DESIGNS.find((d) => d.id === designId);
    if (!design) return "";
    return design.getHtml(blks);
  };

  const blockIcons: Record<BlockType, React.ReactNode> = {
    heading: <Heading className="w-4 h-4" />,
    text: <Type className="w-4 h-4" />,
    image: <Image className="w-4 h-4" />,
    button: <MousePointerClick className="w-4 h-4" />,
    divider: <Minus className="w-4 h-4" />,
    footer: <Type className="w-4 h-4" />,
  };

  return (
    <div className="space-y-6">
      {/* Design Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">Choose a Design</label>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {DESIGNS.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => selectDesign(d.id)}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                selectedDesign === d.id
                  ? "border-purple-500 bg-purple-50 shadow-md"
                  : "border-gray-200 hover:border-gray-300 bg-white"
              }`}
            >
              <div className={`h-10 rounded-lg mb-2 flex items-center justify-center text-xs font-bold ${d.preview}`}>
                {d.name.split(" ")[0]}
              </div>
              <div className="text-sm font-semibold text-gray-900">{d.name}</div>
              <div className="text-xs text-gray-500 mt-0.5">{d.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Content Blocks */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="block text-sm font-medium text-gray-700">Content Blocks</label>
          <div className="flex gap-1">
            {(["heading", "text", "image", "button", "divider", "footer"] as BlockType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => addBlock(type)}
                className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
                title={`Add ${type}`}
              >
                {blockIcons[type]}
              </button>
            ))}
          </div>
        </div>

        {blocks.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
            <Plus className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Add content blocks to build your template</p>
          </div>
        ) : (
          <div className="space-y-3">
            {blocks.map((block, idx) => (
              <div key={block.id} className="border border-gray-200 rounded-xl p-4 bg-white">
                <div className="flex items-center gap-2 mb-2">
                  <span className="flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase bg-gray-100 px-2 py-0.5 rounded">
                    {blockIcons[block.type]}
                    {block.type}
                  </span>
                  <div className="ml-auto flex gap-1">
                    <button
                      type="button"
                      onClick={() => moveBlock(block.id, "up")}
                      disabled={idx === 0}
                      className="p-1 rounded hover:bg-gray-100 text-gray-400 disabled:opacity-30"
                    >
                      <MoveUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveBlock(block.id, "down")}
                      disabled={idx === blocks.length - 1}
                      className="p-1 rounded hover:bg-gray-100 text-gray-400 disabled:opacity-30"
                    >
                      <MoveDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeBlock(block.id)}
                      className="p-1 rounded hover:bg-red-50 text-red-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {block.type === "image" ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={block.content}
                      onChange={(e) => updateBlock(block.id, "content", e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Image URL..."
                    />
                    {block.content && (
                      <div className="rounded-lg overflow-hidden border border-gray-100">
                        <img src={block.content} alt="" className="max-h-32 mx-auto" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      </div>
                    )}
                  </div>
                ) : block.type === "button" ? (
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={block.content}
                      onChange={(e) => updateBlock(block.id, "content", e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Button text..."
                    />
                    <input
                      type="text"
                      value={block.extra || ""}
                      onChange={(e) => updateBlock(block.id, "extra", e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Link URL..."
                    />
                  </div>
                ) : (
                  <textarea
                    value={block.content}
                    onChange={(e) => updateBlock(block.id, "content", e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    rows={block.type === "footer" ? 2 : 3}
                    placeholder={`Enter ${block.type} content...`}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Live Preview */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Live Preview</label>
        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
          <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-yellow-400" />
            <div className="w-3 h-3 rounded-full bg-green-400" />
            <span className="text-xs text-gray-400 ml-2">Preview</span>
          </div>
          <div className="p-4 max-h-96 overflow-y-auto">
            <div
              className="scale-[0.8] origin-top"
              dangerouslySetInnerHTML={{ __html: generateHtml(selectedDesign, blocks) }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
