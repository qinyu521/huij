// _worker.js — CF-Workers-SUB + Grok 每小时自动更新（含严格过滤）
//
// 必备绑定：KV（binding 名必须为 "KV"）
//
// 环境变量（Vars/Secrets）
// ── 基本订阅 ──────────────────────────────────────────────────────────────
// TOKEN        管理页与 KV 键（默认 "auto"，即 /auto）
// SUBAPI       订阅转换后端根地址，例如 "https://SUBAPI.cmliussss.net"（可留空则不开转换跳转）
// SUBCONFIG    转换配置 RAW 地址，例如 ACL4SSR_Online_MultiCountry.ini
// SUBNAME      转换后的订阅名（默认 "CF-Workers-SUB"）
// GUEST        （可选）访客只读 token，开启后 /sub?token=GUEST 可读取原样订阅
//
// ── Grok（xAI OpenAI 兼容 API）────────────────────────────────────────────
// GROK_API_KEY  （Secret）xAI API Key（必填）
// GROK_BASE_URL 可选，默认 https://api.x.ai/v1
// GROK_SOURCE_URL 必填，要提取节点的网页或订阅链接
// GROK_PROMPT  可选，默认使用你给出的中文提示词
// RELOAD_KEY   可选，手动触发 /grok/reload 的鉴权 key
//
// ── 其他可选 ─────────────────────────────────────────────────────────────
// WANT_HTTP_SUBS  "1"/"0" 是否接受 http(s) 订阅链接（默认 "1" 接受）
//
// 路由：
// /           简要说明
// /<TOKEN>    管理页（GET 查看/POST 保存）
// /raw        原始内容（纯文本）
// /sub        合并去重后的原样订阅（不转换）
// /sub/clash  跳转到 SUBAPI 做 clash 转换
// /sub/singbox 跳转到 SUBAPI 做 singbox 转换
// /sub/loon   跳转到 SUBAPI 做 loon 转换
// /grok/reload 手动触发从 Grok 拉取、过滤并写入 KV

const HTML = {
  page(title, body) {
    return `<!doctype html><html lang="zh-CN"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title}</title>
<style>
:root{color-scheme:light dark}
body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;margin:0;padding:24px;line-height:1.6}
h1{margin:0 0 16px 0;font-size:20px}
.card{max-width:980px;margin:0 auto;border:1px solid #8883;border-radius:12px;padding:16px}
label{font-weight:600;display:block;margin:12px 0 6px}
textarea{width:100%;min-height:260px;font-family:ui-monospace,Menlo,Consolas,monospace;border:1px solid #8883;border-radius:10px;padding:10px}
button{padding:10px 16px;border-radius:10px;border:0;background:#4f46e5;color:#fff;cursor:pointer}
hr{border:none;border-top:1px solid #8883;margin:16px 0}
.notice{padding:8px 12px;border-left:4px solid #4f46e5;background:#4f46e511;border-radius:8px}
.links a{display:inline-block;margin-right:10px}
code{opacity:.8}
</style>
</head><body><div class="card">${body}</div></body></html>`;
  },
  home({ token, host, hasGuest, guest, subapi, subconfig, subname, rawPreview }) {
    const base = `${host}`;
    const raw = `${base}/raw`;
    const sub = `${base}/sub`;
    const q = (t) => encodeURIComponent(t);

    const conv = (target) => {
      if (!subapi) return "";
      const url = `${subapi}/api/v1/client/subscribe?`
        + `target=${target}`
        + `&url=${q(raw)}`
        + (subconfig ? `&config=${q(subconfig)}` : "")
        + `&emoji=true&list=false&udp=true&tfo=false&scv=true&expand=true&rename=true&append_type=true`
        + `&sub=${q(subname || "CF-Workers-SUB")}`;
      return `<div><a href="${url}" target="_blank">${target} 订阅</a></div>`;
    };

    return HTML.page(
      `订阅管理 /${token}`,
      `
<h1>订阅管理 <code>/${token}</code></h1>
<p class="notice">在此处保存<strong>原始节点/订阅链接</strong>（一行一个）。系统会合并去重；并且每小时由 Grok 自动拉取更新写入 KV。</p>

<form method="post" action="/${token}">
  <label>原始节点/订阅链接（逐行）</label>
  <textarea name="content" spellcheck="false" placeholder="vless://...&#10;vmess://...&#10;https://your-subscription.example/..." >${rawPreview}</textarea>
  <div style="display:flex;gap:8px;margin-top:12px">
    <button type="submit">保存到 KV</button>
    <a href="${raw}" target="_blank"><button type="button">查看原始（/raw）</button></a>
    <a href="/grok/reload" target="_blank"><button type="button">手动拉取（/grok/reload）</button></a>
  </div>
</form>

<hr/>
<h3>聚合后的订阅地址</h3>
<div class="links">
  <div><a href="${sub}" target="_blank">原样订阅（合并去重，不转换）</a></div>
  ${subapi ? conv("clash") : ""}
  ${subapi ? conv("singbox") : ""}
  ${subapi ? conv("loon") : ""}
</div>

<hr/>
<h3>访客订阅（可选）</h3>
<p>${hasGuest ? `开启：<code>${base}/sub?token=${guest}</code>` : "未开启。设置环境变量 GUEST 可对外只读订阅。"}</p>

<hr/>
<h3>Grok 定时拉取（已内置）</h3>
<pre>必填：
GROK_API_KEY    = 你的 xAI API Key（Secret）
GROK_SOURCE_URL = 要提取节点的页面/订阅
可选：
GROK_BASE_URL   = https://api.x.ai/v1
GROK_PROMPT     = 自定义提示词（已内置你的中文提示词）
RELOAD_KEY      = 手动触发鉴权 ?key=...</pre>
`);}
};

// ===== 过滤：只允许节点/订阅链接 =====
const NODE_SCHEMES = ["vless", "vmess", "trojan", "ss", "ssr", "hy2"];

function extractNodesAndSubs(text, wantHttpSubs = true) {
  if (!text) return [];
  const cleaned = text
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```/g, "")) // 去围栏保留内容
    .replace(/\u200B|\u200C|\u200D|\uFEFF/g, ""); // 零宽字符

  const lines = cleaned.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const keep = [];
  const seen = new Set();

  for (let line of lines) {
    line = line.replace(/[，。；、]+$/g, ""); // 去中文标点

    // 节点
    const mNode = line.match(/^(vless|vmess|trojan|ss|ssr|hy2):\/\/\S+$/i);
    if (mNode) {
      const ok = validateNode(line);
      if (ok && !seen.has(ok)) { seen.add(ok); keep.push(ok); }
      continue;
    }

    // 订阅链接
    if (wantHttpSubs) {
      const mHttp = line.match(/^https?:\/\/\S+$/i);
      if (mHttp) {
        // 启发式判断：更像订阅的 URL
        const looksLikeSub = /sub|subscribe|list|txt|yaml|yml|clash|sing|nodes?/i.test(line);
        if (looksLikeSub && !seen.has(line)) { seen.add(line); keep.push(line); }
        continue;
      }
    }
    // 其他忽略
  }

  return keep;
}

function validateNode(url) {
  try {
    const u = new URL(url);
    const scheme = u.protocol.replace(":", "").toLowerCase();
    if (!NODE_SCHEMES.includes(scheme)) return "";

    if (scheme === "vmess") {
      const b64 = url.replace(/^vmess:\/\//i, "");
      const json = JSON.parse(decodeBase64(b64));
      const host = json.add || json.host || json.address;
      const port = json.port || json.p;
      if (!host || !port) return "";
      return url.trim();
    }

    if (!u.hostname) return "";
    return url.trim();
  } catch {
    return "";
  }
}

function decodeBase64(b64) {
  b64 = b64.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4;
  if (pad) b64 += "=".repeat(4 - pad);
  return atob(b64);
}

// ===== 工具函数 =====
async function readBody(req) {
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("application/json")) return await req.json();
  if (ct.includes("application/x-www-form-urlencoded")) {
    const f = await req.formData();
    return Object.fromEntries([...f.entries()]);
  }
  return { content: await req.text() };
}

async function readKV(env) {
  const token = env.TOKEN || "auto";
  return (await env.KV.get(token)) || "";
}

async function writeKV(env, content) {
  const token = env.TOKEN || "auto";
  await env.KV.put(token, (content || "").trim());
}

function mergeLines(text) {
  const lines = (text || "").split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const set = new Set(lines);
  return Array.from(set).join("\n");
}

function urlBase(req) {
  const u = new URL(req.url);
  return `${u.protocol}//${u.host}`;
}

function allowGuest(env, req) {
  const g = env.GUEST;
  if (!g) return false;
  const url = new URL(req.url);
  return url.searchParams.get("token") === g;
}

// ===== Grok API 调用（已内置你的中文提示词为默认）=====
async function pullWithGrok(env) {
  const base = env.GROK_BASE_URL || "https://api.x.ai/v1";
  const apiKey = env.GROK_API_KEY;
  if (!apiKey) throw new Error("GROK_API_KEY 未设置");
  const source = env.GROK_SOURCE_URL || "";
  if (!source) throw new Error("GROK_SOURCE_URL 未设置");

  const defaultPrompt =
`请搜索并整理出今日最新的免费告诉v2ray节点，要适合电信线路，只输出“订阅链接或节点链接”，逐行返回，不要任何解释、前后缀或 Markdown。
必须满足以下其一：
1) 节点：行首是以下任一协议并紧跟内容：vless://  vmess://  trojan://  ss://  ssr://  hy2://
2) 订阅链接：行首为 http:// 或 https:// 且返回的是订阅(纯文本、多行节点)，不要返回网页介绍链接。
禁止输出空行、序号、注释、中文标点、标题、说明。
输出格式：每行一个链接，且整段内容只有这些行。信息源：${source}`;

  const prompt = env.GROK_PROMPT || defaultPrompt;

  const resp = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "grok-4-mini",
      messages: [
        { role: "system", content: "你只能输出符合规则的链接，若没有则输出空字符串。" },
        { role: "user", content: prompt },
      ],
      temperature: 0,
    }),
  });

  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Grok API 调用失败：${resp.status} ${t}`);
  }
  const data = await resp.json();
  const content =
    data?.choices?.[0]?.message?.content ??
    data?.choices?.[0]?.delta?.content ??
    "";
  return content;
}

async function saveListToKV(env, list) {
  const token = env.TOKEN || "auto";
  await env.KV.put(token, (list || []).join("\n"));
  return { key: token, count: list.length };
}

// ===== 主体路由 & 定时任务 =====
export default {
  async fetch(req, env, ctx) {
    const token = env.TOKEN || "auto";
    const url = new URL(req.url);
    const pathname = url.pathname;

    // 管理页
    if (pathname === `/${token}` && req.method === "GET") {
      const raw = await readKV(env);
      return new Response(
        HTML.home({
          token,
          host: urlBase(req),
          hasGuest: !!env.GUEST,
          guest: env.GUEST || "",
          subapi: env.SUBAPI || "",
          subconfig: env.SUBCONFIG || "",
          subname: env.SUBNAME || "CF-Workers-SUB",
          rawPreview: raw,
        }),
        { headers: { "content-type": "text/html; charset=utf-8" } }
      );
    }

    // 保存
    if (pathname === `/${token}` && req.method === "POST") {
      const body = await readBody(req);
      await writeKV(env, body.content || "");
      return new Response("保存成功。", { status: 200 });
    }

    // 原始
    if (pathname === "/raw") {
      const raw = await readKV(env);
      return new Response(raw, { headers: { "content-type": "text/plain; charset=utf-8" } });
    }

    // 合并后的原样订阅
    if (pathname === "/sub") {
      if (!(allowGuest(env, req) || url.searchParams.get("admin") === "1")) {
        // 默认公开；如需私有可自行加限制
      }
      const raw = await readKV(env);
      const merged = mergeLines(raw);
      return new Response(merged, { headers: { "content-type": "text/plain; charset=utf-8" } });
    }

    // 转换跳转
    if (/^\/sub\/(clash|singbox|loon)$/i.test(pathname)) {
      const target = pathname.split("/").pop();
      const subapi = env.SUBAPI;
      if (!subapi) return new Response("SUBAPI 未配置", { status: 400 });
      const subconfig = env.SUBCONFIG || "";
      const subname = env.SUBNAME || "CF-Workers-SUB";
      const rawUrl = `${urlBase(req)}/raw`;
      const q = encodeURIComponent;
      const final = `${subapi}/api/v1/client/subscribe?target=${target}`
        + `&url=${q(rawUrl)}`
        + (subconfig ? `&config=${q(subconfig)}` : "")
        + `&emoji=true&list=false&udp=true&tfo=false&scv=true&expand=true&rename=true&append_type=true`
        + `&sub=${q(subname)}`;
      return Response.redirect(final, 302);
    }

    // 手动拉取
    if (pathname === "/grok/reload") {
      const must = env.RELOAD_KEY;
      if (must && url.searchParams.get("key") !== must) {
        return new Response("Unauthorized", { status: 401 });
      }
      try {
        const raw = await pullWithGrok(env);
        const wantHttp = (env.WANT_HTTP_SUBS || "1") === "1";
        const list = extractNodesAndSubs(raw, wantHttp);
        const res = await saveListToKV(env, list);
        return new Response(JSON.stringify({ ok: true, ...res }), {
          headers: { "content-type": "application/json" },
        });
      } catch (e) {
        return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), {
          status: 500,
          headers: { "content-type": "application/json" },
        });
      }
    }

    if (pathname === "/" || pathname === "") {
      return new Response(
        `OK. 管理页：/${token}    原始：/raw    订阅：/sub    转换：/sub/clash /sub/singbox /sub/loon    手动拉取：/grok/reload`,
        { headers: { "content-type": "text/plain; charset=utf-8" } }
      );
    }

    return new Response("Not Found", { status: 404 });
  },

  // 每小时：Grok 拉取 → 过滤 → 写 KV
  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      try {
        const raw = await pullWithGrok(env);
        const wantHttp = (env.WANT_HTTP_SUBS || "1") === "1";
        const list = extractNodesAndSubs(raw, wantHttp);
        await saveListToKV(env, list);
      } catch (e) {
        console.error("定时更新失败:", e);
      }
    })());
  }
};
