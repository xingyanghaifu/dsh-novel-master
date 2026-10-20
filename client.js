/* Hand-written DSH ModuleLoader client, following the installed Our Free Model
 * entry pattern. Uses the shell's React; no JSX, bundler, or extra dependency. */
window.__ModuleLoader__.load({
  id: 'dsh-novel-master',
  factory: require => {
    const React = require('react')
    const { createElement: h, useState, useEffect, useRef } = React
    const API = new URL('api/novel-master/', document.baseURI).pathname
    const CSS = `
.nm-settings,.nm-atlas,.nm-art{--nm-r-sm:6px;--nm-r-md:10px;--nm-r-lg:14px;--nm-r-xl:20px;--nm-t-fast:120ms;--nm-t-base:200ms;--nm-ease-out:cubic-bezier(.22,1,.36,1);--nm-ease-std:cubic-bezier(.4,0,.2,1);--nm-ring:0 0 0 .5px var(--nm-hairline);--nm-hairline:color-mix(in srgb,var(--nm-text) 11%,transparent)}
.nm-settings{--nm-bg:var(--dsw-alias-bg-layer-1,Canvas);--nm-card:var(--dsw-alias-bg-layer-2,Canvas);--nm-text:var(--dsw-alias-label-primary,CanvasText);--nm-muted:var(--dsw-alias-label-secondary,GrayText);--nm-caption:var(--dsw-alias-label-secondary,GrayText);--nm-border:var(--dsw-alias-border-l2,color-mix(in srgb,CanvasText 14%,transparent));--nm-border-glow:color-mix(in srgb,var(--nm-accent) 22%,var(--nm-border));--nm-accent:var(--dsw-alias-state-business-primary,var(--dsw-alias-link,#5275d8));--nm-good:var(--dsw-alias-state-success-primary,#25836b);--nm-error:var(--dsw-alias-state-error-primary,#c84d55);--nm-raised:color-mix(in srgb,var(--nm-text) 4%,var(--nm-card));max-width:1200px;margin:0 auto;padding:32px 28px;color:var(--nm-text);font-size:13px;line-height:1.65;display:flex;flex-direction:column;gap:28px}
.nm-settings *{box-sizing:border-box}.nm-settings [hidden]{display:none!important}.nm-settings h2,.nm-settings h3,.nm-settings h4,.nm-settings p{margin:0}.nm-settings h2{font-size:26px;font-weight:700;letter-spacing:-.6px}.nm-settings h3{font-size:17px;font-weight:600;display:flex;align-items:center;gap:10px}.nm-settings h4{font-size:14px;font-weight:600}.nm-settings .nm-muted{color:var(--nm-muted);font-size:12px}
/* Hero 卡：原来是一层 18% 彩色径向光晕 + 145deg 对角渐变。深色下前者就是一块
   蓝斑，后者在近黑底上会显出「幕布折痕」。改成几乎不可见的顶部微亮 + 0.5px
   边环 + 双层阴影 —— 层次靠明度与边环表达，不靠彩色氛围。 */
.nm-settings .nm-hero{padding:26px 28px;border:0;border-radius:var(--nm-r-xl);background:var(--nm-card);box-shadow:var(--nm-ring),0 1px 2px color-mix(in srgb,var(--nm-text) 8%,transparent),0 10px 30px -12px color-mix(in srgb,var(--nm-text) 22%,transparent),inset 0 1px 0 color-mix(in srgb,#fff 5%,transparent);display:flex;flex-direction:column;gap:20px;position:relative}
.nm-settings .nm-row{display:flex;align-items:center;gap:14px;flex-wrap:wrap}.nm-settings .nm-between{justify-content:space-between}.nm-settings .nm-brand{display:flex;align-items:center;gap:18px}.nm-settings .nm-logo{width:58px;height:58px;display:grid;place-items:center;border-radius:20px;color:var(--nm-accent);background:linear-gradient(135deg,color-mix(in srgb,var(--nm-accent) 16%,var(--nm-card)),color-mix(in srgb,var(--nm-accent) 10%,var(--nm-card)));border:1px solid color-mix(in srgb,var(--nm-accent) 35%,transparent);box-shadow:0 6px 18px -4px color-mix(in srgb,var(--nm-accent) 30%,transparent);transition:background-color var(--nm-t-fast) var(--nm-ease-out),border-color var(--nm-t-fast) var(--nm-ease-out),color var(--nm-t-fast) var(--nm-ease-out),box-shadow var(--nm-t-base) var(--nm-ease-out),transform var(--nm-t-fast) var(--nm-ease-out)}.nm-settings .nm-logo:hover{box-shadow:0 8px 24px -4px color-mix(in srgb,var(--nm-accent) 40%,transparent)}.nm-settings .nm-logo svg{width:32px;height:32px}
.nm-settings .nm-badge,.nm-settings .nm-chip{font-size:11px;border:1px solid var(--nm-border);border-radius:999px;padding:5px 13px;display:inline-flex;align-items:center;gap:8px;background:var(--nm-card);color:var(--nm-muted);transition:background-color var(--nm-t-fast) var(--nm-ease-out),border-color var(--nm-t-fast) var(--nm-ease-out),color var(--nm-t-fast) var(--nm-ease-out),box-shadow var(--nm-t-base) var(--nm-ease-out),transform var(--nm-t-fast) var(--nm-ease-out)}.nm-settings .nm-badge{color:var(--nm-accent);font-weight:650;background:linear-gradient(135deg,color-mix(in srgb,var(--nm-accent) 12%,var(--nm-card)),color-mix(in srgb,var(--nm-accent) 8%,var(--nm-card)));border-color:color-mix(in srgb,var(--nm-accent) 30%,transparent);box-shadow:0 2px 8px color-mix(in srgb,var(--nm-accent) 15%,transparent)}.nm-settings .nm-chip{backdrop-filter:blur(8px)}.nm-settings .nm-chip i{width:7px;height:7px;border-radius:50%;background:var(--nm-muted);transition:background .2s ease;box-shadow:0 0 0 0 transparent}.nm-settings .nm-chip[data-on=true]{color:var(--nm-text);border-color:color-mix(in srgb,var(--nm-good) 35%,var(--nm-border));background:color-mix(in srgb,var(--nm-good) 8%,var(--nm-card))}.nm-settings .nm-chip[data-on=true] i{background:var(--nm-good);box-shadow:0 0 8px var(--nm-good),0 0 0 2px color-mix(in srgb,var(--nm-good) 20%,transparent)}
.nm-settings .nm-tabs{display:flex;gap:8px;padding:8px;border:1px solid var(--nm-border);background:var(--nm-bg);border-radius:14px;overflow:auto;box-shadow:0 2px 8px rgba(0,0,0,0.04)}.nm-settings .nm-tabs button{flex:1;white-space:nowrap;border:0;background:transparent;border-radius:12px;color:var(--nm-muted);padding:11px 20px;font-weight:550;transition:background-color var(--nm-t-fast) var(--nm-ease-out),border-color var(--nm-t-fast) var(--nm-ease-out),color var(--nm-t-fast) var(--nm-ease-out),box-shadow var(--nm-t-base) var(--nm-ease-out),transform var(--nm-t-fast) var(--nm-ease-out);position:relative}.nm-settings .nm-tabs button:hover:not([aria-selected=true]){color:var(--nm-text);background:color-mix(in srgb,CanvasText 5%,transparent)}.nm-settings .nm-tabs button[aria-selected=true]{background:linear-gradient(135deg,var(--nm-raised),color-mix(in srgb,var(--nm-accent) 5%,var(--nm-raised)));color:var(--nm-accent);box-shadow:0 3px 12px color-mix(in srgb,CanvasText 10%,transparent),0 0 0 1px color-mix(in srgb,var(--nm-accent) 20%,transparent);font-weight:700}
.nm-settings button{font:inherit;cursor:pointer;color:var(--nm-text);border:1px solid var(--nm-border);border-radius:12px;background:var(--nm-raised);padding:9px 16px;transition:background-color var(--nm-t-fast) var(--nm-ease-out),border-color var(--nm-t-fast) var(--nm-ease-out),color var(--nm-t-fast) var(--nm-ease-out),box-shadow var(--nm-t-base) var(--nm-ease-out),transform var(--nm-t-fast) var(--nm-ease-out);font-weight:550}.nm-settings button:hover:not(:disabled){border-color:var(--nm-accent);background:color-mix(in srgb,var(--nm-accent) 10%,var(--nm-raised));transform:translateY(-2px);box-shadow:0 4px 12px color-mix(in srgb,var(--nm-accent) 20%,transparent)}.nm-settings button:active:not(:disabled){transform:translateY(0)}.nm-settings button:focus-visible,.nm-settings input:focus-visible,.nm-settings summary:focus-visible,.nm-settings select:focus-visible{outline:2px solid var(--nm-accent);outline-offset:3px}.nm-settings button:disabled{opacity:.45;cursor:not-allowed;transform:none}
.nm-settings .nm-primary{background:linear-gradient(135deg,color-mix(in srgb,var(--nm-accent) 18%,var(--nm-card)),color-mix(in srgb,var(--nm-accent) 12%,var(--nm-card)));border-color:color-mix(in srgb,var(--nm-accent) 60%,var(--nm-border));color:var(--nm-accent);font-weight:650;box-shadow:0 3px 10px -2px color-mix(in srgb,var(--nm-accent) 35%,transparent)}.nm-settings .nm-primary:hover:not(:disabled){background:linear-gradient(135deg,color-mix(in srgb,var(--nm-accent) 25%,var(--nm-card)),color-mix(in srgb,var(--nm-accent) 18%,var(--nm-card)));border-color:var(--nm-accent);box-shadow:0 6px 16px -2px color-mix(in srgb,var(--nm-accent) 45%,transparent)}.nm-settings .nm-quiet{background:transparent;border-color:transparent;color:var(--nm-muted);font-size:12px}.nm-settings .nm-stack{display:flex;flex-direction:column;gap:24px}
.nm-settings .nm-card{padding:28px;border:0;box-shadow:var(--nm-ring),0 1px 2px color-mix(in srgb,var(--nm-text) 7%,transparent),0 8px 24px -12px color-mix(in srgb,var(--nm-text) 20%,transparent);border-radius:20px;background:var(--nm-card);display:flex;flex-direction:column;gap:20px;min-width:0;transition:background-color var(--nm-t-fast) var(--nm-ease-out),border-color var(--nm-t-fast) var(--nm-ease-out),color var(--nm-t-fast) var(--nm-ease-out),box-shadow var(--nm-t-base) var(--nm-ease-out),transform var(--nm-t-fast) var(--nm-ease-out)}.nm-settings .nm-card:hover{box-shadow:var(--nm-ring),0 2px 4px color-mix(in srgb,var(--nm-text) 8%,transparent),0 14px 32px -14px color-mix(in srgb,var(--nm-text) 24%,transparent)}.nm-settings .nm-cardhead{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
.nm-settings .nm-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.nm-settings .nm-wide{grid-column:1/-1}.nm-settings .nm-toolbar{display:flex;gap:12px;align-items:center;flex-wrap:wrap}.nm-settings .nm-search{flex:1;min-width:220px;box-shadow:0 2px 6px color-mix(in srgb,CanvasText 5%,transparent);border-radius:12px}
.nm-settings input:not([type=checkbox]),.nm-settings select.nm-select{font:inherit;color:var(--nm-text);width:100%;min-width:0;border:1px solid var(--nm-border);border-radius:12px;background:var(--nm-bg);padding:11px 16px;transition:background-color var(--nm-t-fast) var(--nm-ease-out),border-color var(--nm-t-fast) var(--nm-ease-out),color var(--nm-t-fast) var(--nm-ease-out),box-shadow var(--nm-t-base) var(--nm-ease-out),transform var(--nm-t-fast) var(--nm-ease-out)}.nm-settings select.nm-select{cursor:pointer}.nm-settings select.nm-select option{background:var(--nm-card);color:var(--nm-text)}.nm-settings input:not([type=checkbox]):hover,.nm-settings select.nm-select:hover{border-color:color-mix(in srgb,var(--nm-accent) 40%,var(--nm-border))}.nm-settings input:not([type=checkbox]):focus,.nm-settings select.nm-select:focus{border-color:var(--nm-accent);box-shadow:0 0 0 4px color-mix(in srgb,var(--nm-accent) 18%,transparent)}.nm-settings input:disabled,.nm-settings select:disabled{opacity:.55}
.nm-settings .nm-field{display:flex;flex-direction:column;gap:8px;min-width:0}.nm-settings .nm-field>span{font-weight:600;font-size:13px;color:var(--nm-text)}
.nm-settings .nm-switch{display:flex;align-items:center;justify-content:space-between;gap:18px;position:relative;cursor:pointer;min-height:48px;padding:4px 0}.nm-settings .nm-switch input{position:absolute;right:0;top:50%;transform:translateY(-50%);width:46px;height:26px;opacity:0;margin:0;cursor:pointer}.nm-settings .nm-switch input:focus-visible + .nm-track{outline:2px solid var(--nm-accent);outline-offset:5px}.nm-settings .nm-track{width:46px;height:26px;border-radius:99px;border:1px solid var(--nm-border);background:var(--nm-bg);position:relative;flex:none;pointer-events:none;transition:background-color var(--nm-t-fast) var(--nm-ease-out),border-color var(--nm-t-fast) var(--nm-ease-out),color var(--nm-t-fast) var(--nm-ease-out),box-shadow var(--nm-t-base) var(--nm-ease-out),transform var(--nm-t-fast) var(--nm-ease-out);box-shadow:inset 0 2px 4px rgba(0,0,0,0.06)}.nm-settings .nm-track:after{content:'';position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:var(--nm-muted);transition:background-color var(--nm-t-fast) var(--nm-ease-out),border-color var(--nm-t-fast) var(--nm-ease-out),color var(--nm-t-fast) var(--nm-ease-out),box-shadow var(--nm-t-base) var(--nm-ease-out),transform var(--nm-t-fast) var(--nm-ease-out);box-shadow:0 2px 4px rgba(0,0,0,0.15)}.nm-settings .nm-switch input:checked + .nm-track{background:linear-gradient(135deg,color-mix(in srgb,var(--nm-accent) 28%,var(--nm-bg)),color-mix(in srgb,var(--nm-accent) 22%,var(--nm-bg)));border-color:var(--nm-accent);box-shadow:inset 0 2px 4px color-mix(in srgb,var(--nm-accent) 30%,transparent)}.nm-settings .nm-switch input:checked + .nm-track:after{transform:translateX(20px);background:white;box-shadow:0 2px 8px color-mix(in srgb,var(--nm-accent) 60%,transparent),0 0 12px color-mix(in srgb,var(--nm-accent) 40%,transparent)}.nm-settings .nm-switch:has(input:disabled){opacity:.55;cursor:not-allowed}
.nm-settings .nm-switchcopy{display:flex;flex-direction:column;gap:4px;min-width:0}.nm-settings .nm-switchcopy strong{font-size:14px;font-weight:650;color:var(--nm-text)}.nm-settings .nm-switchcopy small{font-size:12px;color:var(--nm-muted);line-height:1.6}.nm-settings .nm-group{padding:0;border:0;min-width:0;margin:0}.nm-settings .nm-group legend{font-weight:700;font-size:16px;margin-bottom:14px;width:100%;color:var(--nm-text)}.nm-settings .nm-features{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px}
.nm-settings .nm-feature{padding:16px 18px;border:1px solid var(--nm-border);border-radius:14px;background:linear-gradient(135deg,var(--nm-bg),color-mix(in srgb,var(--nm-card) 95%,var(--nm-bg)));transition:background-color var(--nm-t-fast) var(--nm-ease-out),border-color var(--nm-t-fast) var(--nm-ease-out),color var(--nm-t-fast) var(--nm-ease-out),box-shadow var(--nm-t-base) var(--nm-ease-out),transform var(--nm-t-fast) var(--nm-ease-out);display:flex;flex-direction:column;justify-content:space-between;gap:10px;box-shadow:0 2px 8px rgba(0,0,0,0.03)}.nm-settings .nm-feature:hover{border-color:color-mix(in srgb,var(--nm-accent) 65%,var(--nm-border));transform:translateY(-3px);box-shadow:0 6px 18px -4px color-mix(in srgb,var(--nm-accent) 25%,transparent),0 0 0 1px color-mix(in srgb,var(--nm-accent) 15%,transparent)}
.nm-settings .nm-feature code{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:11px;color:var(--nm-accent);background:linear-gradient(135deg,color-mix(in srgb,var(--nm-accent) 10%,var(--nm-card)),color-mix(in srgb,var(--nm-accent) 7%,var(--nm-card)));padding:4px 9px;border-radius:6px;border:1px solid color-mix(in srgb,var(--nm-accent) 22%,transparent);cursor:pointer;overflow-wrap:anywhere;display:inline-flex;align-items:center;gap:6px;width:fit-content;transition:background-color var(--nm-t-fast) var(--nm-ease-out),border-color var(--nm-t-fast) var(--nm-ease-out),color var(--nm-t-fast) var(--nm-ease-out),box-shadow var(--nm-t-base) var(--nm-ease-out),transform var(--nm-t-fast) var(--nm-ease-out);font-weight:600}.nm-settings .nm-feature code:hover{background:linear-gradient(135deg,color-mix(in srgb,var(--nm-accent) 22%,var(--nm-card)),color-mix(in srgb,var(--nm-accent) 16%,var(--nm-card)));border-color:var(--nm-accent);transform:scale(1.03);box-shadow:0 3px 10px color-mix(in srgb,var(--nm-accent) 25%,transparent)}
.nm-settings .nm-savebar{display:flex;align-items:center;justify-content:space-between;gap:14px;padding-top:18px;border-top:1px solid var(--nm-border);flex-wrap:wrap}.nm-settings .nm-dirty{color:var(--nm-accent);font-size:13px;font-weight:650;display:flex;align-items:center;gap:7px}.nm-settings .nm-callout{padding:16px 20px;border-radius:14px;border:1px solid color-mix(in srgb,var(--nm-accent) 30%,var(--nm-border));background:linear-gradient(135deg,color-mix(in srgb,var(--nm-accent) 8%,var(--nm-card)),color-mix(in srgb,var(--nm-accent) 5%,var(--nm-card)));color:var(--nm-text);font-size:13px;line-height:1.7;box-shadow:0 2px 8px color-mix(in srgb,var(--nm-accent) 12%,transparent)}.nm-settings .nm-alert{padding:18px 20px;border-radius:14px;border:1px solid color-mix(in srgb,var(--nm-error) 45%,var(--nm-border));background:linear-gradient(135deg,color-mix(in srgb,var(--nm-error) 9%,var(--nm-card)),color-mix(in srgb,var(--nm-error) 6%,var(--nm-card)));display:flex;align-items:center;justify-content:space-between;gap:14px;white-space:pre-wrap;overflow-wrap:anywhere;box-shadow:0 3px 12px color-mix(in srgb,var(--nm-error) 15%,transparent)}.nm-settings .nm-success{border-color:color-mix(in srgb,var(--nm-good) 45%,var(--nm-border));background:linear-gradient(135deg,color-mix(in srgb,var(--nm-good) 9%,var(--nm-card)),color-mix(in srgb,var(--nm-good) 6%,var(--nm-card)));box-shadow:0 3px 12px color-mix(in srgb,var(--nm-good) 15%,transparent)}
.nm-settings details{border:1px solid var(--nm-border);border-radius:14px;padding:16px 18px;background:color-mix(in srgb,var(--nm-bg) 65%,var(--nm-card));transition:background-color var(--nm-t-fast) var(--nm-ease-out),border-color var(--nm-t-fast) var(--nm-ease-out),color var(--nm-t-fast) var(--nm-ease-out),box-shadow var(--nm-t-base) var(--nm-ease-out),transform var(--nm-t-fast) var(--nm-ease-out)}.nm-settings details:hover{border-color:color-mix(in srgb,var(--nm-accent) 30%,var(--nm-border))}.nm-settings summary{cursor:pointer;color:var(--nm-muted);font-weight:650;font-size:13px}.nm-settings details[open]>summary{margin-bottom:18px;color:var(--nm-text)}.nm-settings .nm-metric{padding:20px;border:1px solid var(--nm-border);background:linear-gradient(135deg,var(--nm-bg),color-mix(in srgb,var(--nm-card) 97%,var(--nm-bg)));border-radius:14px;min-width:0;box-shadow:0 3px 10px color-mix(in srgb,CanvasText 4%,transparent);transition:background-color var(--nm-t-fast) var(--nm-ease-out),border-color var(--nm-t-fast) var(--nm-ease-out),color var(--nm-t-fast) var(--nm-ease-out),box-shadow var(--nm-t-base) var(--nm-ease-out),transform var(--nm-t-fast) var(--nm-ease-out)}.nm-settings .nm-metric:hover{box-shadow:0 5px 16px color-mix(in srgb,CanvasText 7%,transparent);border-color:color-mix(in srgb,var(--nm-accent) 25%,var(--nm-border))}.nm-settings .nm-metric span{font-size:11px;color:var(--nm-muted);display:block;font-weight:600}.nm-settings .nm-metric strong{display:block;font-size:24px;font-weight:750;margin:8px 0;color:var(--nm-text);letter-spacing:-.5px}.nm-settings .nm-metric code{display:block;font-size:11px;color:var(--nm-accent);overflow-wrap:anywhere;font-weight:600}
.nm-settings .nm-three{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.nm-settings .nm-skeleton{height:110px;border-radius:14px;background:linear-gradient(100deg,var(--nm-card),var(--nm-raised),var(--nm-card));background-size:200% 100%;animation:nm-settings-load 1.6s ease infinite}.nm-settings .nm-empty{text-align:center;padding:40px;color:var(--nm-muted);font-size:14px}.nm-settings .nm-footer{font-size:12px;color:var(--nm-muted);text-align:center;padding:16px 0}
.nm-settings .nm-inlinecode{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:11px;background:color-mix(in srgb,var(--nm-accent) 12%,var(--nm-bg));color:var(--nm-accent);padding:4px 10px;border-radius:6px;border:1px solid color-mix(in srgb,var(--nm-accent) 25%,transparent);overflow-wrap:anywhere;font-weight:600}
.nm-settings .nm-workbench-pipeline{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;padding:18px;background:var(--nm-bg);border:1px solid var(--nm-border);border-radius:14px}
.nm-settings .nm-pipeline-step{display:flex;flex-direction:column;gap:8px;padding:14px 16px;border-radius:14px;background:linear-gradient(135deg,var(--nm-card),color-mix(in srgb,var(--nm-bg) 98%,var(--nm-card)));border:1px solid var(--nm-border);transition:background-color var(--nm-t-fast) var(--nm-ease-out),border-color var(--nm-t-fast) var(--nm-ease-out),color var(--nm-t-fast) var(--nm-ease-out),box-shadow var(--nm-t-base) var(--nm-ease-out),transform var(--nm-t-fast) var(--nm-ease-out);box-shadow:0 2px 6px rgba(0,0,0,0.03)}.nm-settings .nm-pipeline-step:hover{border-color:var(--nm-accent);box-shadow:0 6px 16px -3px color-mix(in srgb,var(--nm-accent) 25%,transparent)}
.nm-settings .nm-pipeline-badge{font-size:11px;font-weight:700;color:var(--nm-accent);display:inline-flex;align-items:center;gap:7px}
.nm-settings .nm-pipeline-title{font-size:14px;font-weight:650;color:var(--nm-text)}
.nm-settings .nm-pipeline-desc{font-size:11px;color:var(--nm-muted);line-height:1.5}
/* 模型选择：带搜索的浮层，模型多时按关键词过滤 */
.nm-settings .nm-modelpick{flex:none;white-space:nowrap;font-size:12px;padding:9px 14px}
.nm-settings .nm-modelpop{display:flex;flex-direction:column;gap:8px;padding:10px;border:1px solid var(--nm-border);border-radius:12px;background:var(--nm-card);box-shadow:0 8px 24px -8px color-mix(in srgb,CanvasText 22%,transparent);margin-top:8px}
.nm-settings .nm-modelsearch{width:100%}
.nm-settings .nm-modelhint{font-size:11px;color:var(--nm-muted);padding:0 2px}
.nm-settings .nm-modellist{display:flex;flex-direction:column;gap:2px;max-height:260px;overflow-y:auto;overscroll-behavior:contain}
.nm-settings .nm-modelitem{display:flex;align-items:baseline;gap:8px;width:100%;text-align:left;border:0;border-radius:8px;background:transparent;padding:7px 9px;cursor:pointer;font:inherit;font-size:12px;color:var(--nm-text)}
.nm-settings .nm-modelitem:hover{background:color-mix(in srgb,var(--nm-accent) 12%,transparent)}
.nm-settings .nm-modelitem[aria-selected=true]{background:color-mix(in srgb,var(--nm-accent) 16%,transparent);color:var(--nm-accent);font-weight:650}
.nm-settings .nm-modelprov{flex:none;font-size:10.5px;color:var(--nm-muted);min-width:64px}
.nm-settings .nm-modelname{font-family:var(--nm-mono,ui-monospace,monospace);font-size:11.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nm-settings .nm-modelempty{font-size:11.5px;color:var(--nm-muted);padding:12px 10px;text-align:center;line-height:1.6}
.nm-settings .nm-quick-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:14px}
.nm-settings .nm-quick-card{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;background:linear-gradient(135deg,var(--nm-bg),color-mix(in srgb,var(--nm-card) 97%,var(--nm-bg)));border:1px solid var(--nm-border);border-radius:14px;cursor:pointer;gap:14px;transition:background-color var(--nm-t-fast) var(--nm-ease-out),border-color var(--nm-t-fast) var(--nm-ease-out),color var(--nm-t-fast) var(--nm-ease-out),box-shadow var(--nm-t-base) var(--nm-ease-out),transform var(--nm-t-fast) var(--nm-ease-out);box-shadow:0 2px 6px rgba(0,0,0,0.03)}.nm-settings .nm-quick-card:hover{border-color:var(--nm-accent);background:linear-gradient(135deg,color-mix(in srgb,var(--nm-accent) 8%,var(--nm-bg)),color-mix(in srgb,var(--nm-accent) 5%,var(--nm-card)));transform:translateY(-2px);box-shadow:0 5px 14px color-mix(in srgb,var(--nm-accent) 20%,transparent)}
.nm-settings .nm-toast{position:fixed;bottom:32px;right:32px;z-index:9999;padding:12px 24px;border-radius:999px;background:linear-gradient(135deg,var(--nm-raised),color-mix(in srgb,var(--nm-card) 95%,var(--nm-raised)));border:1px solid color-mix(in srgb,var(--nm-accent) 40%,var(--nm-border));color:var(--nm-text);font-size:13px;font-weight:650;box-shadow:0 10px 32px -6px rgba(0,0,0,0.35),0 0 0 1px color-mix(in srgb,var(--nm-accent) 20%,transparent);display:flex;align-items:center;gap:10px;animation:nm-toast-in .3s cubic-bezier(0.34,1.56,0.64,1);backdrop-filter:blur(12px)}
.nm-settings .nm-topic-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:14px}
.nm-settings .nm-path-box{display:flex;gap:8px;align-items:center}
/* 输入框吃掉剩余宽度，按钮保持自身宽度不换行 —— 否则窄一点就把
   「📁 浏览…」挤成两行，按钮高度跟着变，整行错位。 */
.nm-path-box>input{flex:1;min-width:0}
.nm-path-box>button{flex:none;white-space:nowrap}
@keyframes nm-toast-in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@keyframes nm-settings-load{to{background-position:-200% 0}}@media(max-width:700px){.nm-settings{padding:16px;gap:16px}.nm-settings .nm-hero{padding:20px}.nm-settings .nm-grid,.nm-settings .nm-three,.nm-settings .nm-workbench-pipeline,.nm-settings .nm-quick-grid,.nm-settings .nm-topic-grid{grid-template-columns:1fr}.nm-settings .nm-card{padding:18px}.nm-settings .nm-tabs button{padding:9px 12px}.nm-settings h2{font-size:22px}.nm-settings .nm-features{grid-template-columns:1fr}}@media(prefers-reduced-motion:reduce){.nm-settings *{animation:none!important;transition:none!important}}
/* 帮助按钮。这个圆钮前后挪过三次，每次都是被前一次的问题逼的：
   1) 「.nm-settings button」优先级 0,1,1，会盖掉「.nm-help-btn」的 0,1,0，
      于是 border-radius 被改成 12px、padding 被改成 9px 16px —— 圆形变圆角
      方形，问号被 padding 挤得偏右上。选择器必须带上 .nm-settings。
   2) 问号不垂直居中：按钮继承了父级 line-height:1.65，字框比 34px 高，
      grid 居中居的是那个更高的字框。显式 line-height:1 后用 padding 微调
      字形自身的光学重心。
   3) 位置。先是 absolute 贴右上角 —— 正好压住「刷新设置与状态」，文字被遮
      掉一半。再改成流内 margin-left:auto —— 但 .nm-hero 是 column 方向的
      flex，流内子项各自占一行，于是它单独占了一整行浮在标题上方，右边多出
      一条空带。最终把它和刷新按钮并成右侧按钮组：有伴才站得住，也不会互相
      遮挡。 */
.nm-settings .nm-help-btn{flex:none;align-self:center;width:34px;height:34px;padding:0 0 1px;line-height:1;font-size:15px;font-weight:600;color:var(--nm-muted);background:transparent;border:1px solid var(--nm-border);border-radius:50%;cursor:pointer;display:grid;place-items:center;z-index:1;transition:color var(--nm-t-fast) var(--nm-ease-out),border-color var(--nm-t-fast) var(--nm-ease-out),background-color var(--nm-t-fast) var(--nm-ease-out)}
.nm-settings .nm-hero-actions{display:flex;align-items:center;gap:10px;flex:none}
.nm-settings .nm-help-btn:hover{color:var(--nm-text);border-color:var(--nm-hairline);background:var(--nm-raised);transform:none;box-shadow:none}
.nm-guide-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.6);backdrop-filter:blur(6px);display:grid;place-items:center;z-index:9999;animation:nm-fade-in .25s ease;padding:20px}
.nm-guide-box{background:var(--nm-card);border-radius:20px;box-shadow:0 24px 70px rgba(0,0,0,0.35),0 0 0 1px color-mix(in srgb,var(--nm-accent) 15%,transparent);max-width:700px;width:100%;max-height:90vh;display:flex;flex-direction:column;animation:nm-slide-up .35s cubic-bezier(0.34,1.56,0.64,1);overflow:hidden}
.nm-guide-header{padding:32px 32px 24px;background:linear-gradient(135deg,color-mix(in srgb,var(--nm-accent) 8%,var(--nm-card)),var(--nm-card));border-bottom:1px solid color-mix(in srgb,var(--nm-accent) 15%,var(--nm-border));display:flex;align-items:center;gap:16px;position:relative}
.nm-guide-icon{font-size:48px;line-height:1;filter:drop-shadow(0 2px 8px rgba(0,0,0,0.12))}
.nm-guide-title{font-size:24px;font-weight:750;margin:0;flex:1;color:var(--nm-text);letter-spacing:-.5px}
.nm-guide-close{position:absolute;top:24px;right:24px;background:color-mix(in srgb,var(--nm-bg) 80%,transparent);border:0;color:var(--nm-muted);font-size:20px;cursor:pointer;width:36px;height:36px;border-radius:10px;display:grid;place-items:center;transition:background-color var(--nm-t-fast) var(--nm-ease-out),border-color var(--nm-t-fast) var(--nm-ease-out),color var(--nm-t-fast) var(--nm-ease-out),box-shadow var(--nm-t-base) var(--nm-ease-out),transform var(--nm-t-fast) var(--nm-ease-out);backdrop-filter:blur(8px)}
.nm-guide-close:hover{background:var(--nm-bg);color:var(--nm-text);transform:rotate(90deg)}
.nm-guide-content{padding:32px;overflow-y:auto;flex:1;line-height:1.7}
.nm-guide-intro{font-size:15px;color:var(--nm-text);margin:0 0 28px;padding:18px 20px;background:color-mix(in srgb,var(--nm-accent) 6%,var(--nm-bg));border-left:3px solid var(--nm-accent);border-radius:10px}
.nm-guide-section{margin:20px 0;padding:20px;background:var(--nm-bg);border-radius:14px;border:1px solid var(--nm-border);transition:background-color var(--nm-t-fast) var(--nm-ease-out),border-color var(--nm-t-fast) var(--nm-ease-out),color var(--nm-t-fast) var(--nm-ease-out),box-shadow var(--nm-t-base) var(--nm-ease-out),transform var(--nm-t-fast) var(--nm-ease-out)}
.nm-guide-section:hover{border-color:color-mix(in srgb,var(--nm-accent) 30%,var(--nm-border));box-shadow:0 4px 12px rgba(0,0,0,0.05)}
.nm-guide-section-header{display:flex;align-items:center;gap:12px;margin-bottom:12px}
.nm-guide-section-icon{font-size:28px;line-height:1}
.nm-guide-section-title{font-size:16px;font-weight:700;color:var(--nm-text);margin:0}
.nm-guide-section-content{color:var(--nm-text);font-size:13px;line-height:1.7}
.nm-guide-section-content p{margin:8px 0}
.nm-guide-section-content ul{margin:10px 0;padding-left:0;list-style:none}
.nm-guide-section-content li{margin:8px 0;padding-left:24px;position:relative}
.nm-guide-section-content li:before{content:'→';position:absolute;left:0;color:var(--nm-accent);font-weight:700}
.nm-guide-commands{display:grid;gap:10px;margin-top:12px}
.nm-guide-cmd{display:flex;align-items:center;gap:12px;padding:12px 16px;background:var(--nm-card);border:1px solid var(--nm-border);border-radius:10px;transition:background-color var(--nm-t-fast) var(--nm-ease-out),border-color var(--nm-t-fast) var(--nm-ease-out),color var(--nm-t-fast) var(--nm-ease-out),box-shadow var(--nm-t-base) var(--nm-ease-out),transform var(--nm-t-fast) var(--nm-ease-out)}
.nm-guide-cmd:hover{border-color:var(--nm-accent);background:color-mix(in srgb,var(--nm-accent) 4%,var(--nm-card))}
.nm-guide-cmd code{font-family:ui-monospace,monospace;font-size:12px;background:color-mix(in srgb,var(--nm-accent) 12%,var(--nm-bg));color:var(--nm-accent);padding:5px 12px;border-radius:6px;border:1px solid color-mix(in srgb,var(--nm-accent) 20%,transparent);flex:1;font-weight:600}
.nm-guide-cmd-desc{font-size:11px;color:var(--nm-muted);white-space:nowrap}
.nm-guide-footer{padding:24px 32px;background:linear-gradient(to top,color-mix(in srgb,var(--nm-accent) 4%,var(--nm-card)),transparent);border-top:1px solid color-mix(in srgb,var(--nm-accent) 12%,var(--nm-border));display:flex;align-items:center;justify-content:space-between;gap:16px}
.nm-guide-footer-tip{font-size:12px;color:var(--nm-muted);display:flex;align-items:center;gap:8px}
.nm-guide-footer button{background:linear-gradient(135deg,var(--nm-accent),color-mix(in srgb,var(--nm-accent) 90%,#6366f1));border:0;color:white;cursor:pointer;font-size:14px;font-weight:650;padding:13px 32px;border-radius:12px;transition:background-color var(--nm-t-fast) var(--nm-ease-out),border-color var(--nm-t-fast) var(--nm-ease-out),color var(--nm-t-fast) var(--nm-ease-out),box-shadow var(--nm-t-base) var(--nm-ease-out),transform var(--nm-t-fast) var(--nm-ease-out);box-shadow:0 4px 14px color-mix(in srgb,var(--nm-accent) 30%,transparent)}
.nm-guide-footer button:hover{transform:translateY(-2px);box-shadow:0 6px 20px color-mix(in srgb,var(--nm-accent) 40%,transparent)}
.nm-guide-wide{max-width:860px}
.nm-guide-note{margin:10px 0;padding:10px 14px;background:color-mix(in srgb,var(--nm-accent) 7%,var(--nm-bg));border-radius:10px;border-left:3px solid var(--nm-accent);font-size:12px;line-height:1.65}
.nm-guide-section-content code{font-family:ui-monospace,monospace;font-size:11.5px;background:color-mix(in srgb,var(--nm-accent) 10%,var(--nm-bg));padding:2px 7px;border-radius:6px;color:var(--nm-accent);white-space:nowrap}
.nm-guide-section-content strong{color:var(--nm-text);font-weight:650}
@keyframes nm-fade-in{from{opacity:0}}
@keyframes nm-slide-up{from{transform:translateY(40px) scale(0.96);opacity:0}to{transform:translateY(0) scale(1);opacity:1}}
.nm-atlas{--nm-bg:var(--dsw-alias-bg-layer-1,Canvas);--nm-card:var(--dsw-alias-bg-layer-2,Canvas);--nm-text:var(--dsw-alias-label-primary,CanvasText);--nm-muted:var(--dsw-alias-label-secondary,GrayText);--nm-caption:var(--dsw-alias-label-secondary,GrayText);--nm-border:var(--dsw-alias-border-l2,color-mix(in srgb,CanvasText 14%,transparent));--nm-accent:var(--dsw-alias-state-business-primary,var(--dsw-alias-link,#5275d8));--nm-good:var(--dsw-alias-state-success-primary,#25836b);--nm-error:var(--dsw-alias-state-error-primary,#c84d55);--nm-raised:color-mix(in srgb,var(--nm-text) 4%,var(--nm-card));height:100%;min-height:0;display:flex;flex-direction:column;color:var(--nm-text);font-size:13px;line-height:1.5}
.nm-atlas *{box-sizing:border-box}.nm-atlas button{font:inherit;color:inherit}
.nm-atlas-head{flex:none;display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid var(--nm-border);flex-wrap:wrap}
.nm-atlas-head select{flex:1;min-width:0;font:inherit;color:var(--nm-text);background:var(--nm-bg);border:1px solid var(--nm-border);border-radius:8px;padding:5px 8px}
.nm-atlas-refresh{flex:none;border:1px solid var(--nm-border);background:var(--nm-card);border-radius:8px;padding:5px 10px;cursor:pointer}
.nm-atlas-refresh:hover:not(:disabled){border-color:var(--nm-accent)}
.nm-atlas-refresh:disabled{opacity:.55;cursor:default}
.nm-atlas-scroll{flex:1;min-height:0;overflow:auto;padding:10px 10px 16px}
.nm-atlas-progress{padding:12px;border:1px solid var(--nm-border);border-radius:12px;background:var(--nm-card);margin-bottom:12px;display:flex;flex-direction:column;gap:8px}
.nm-atlas-progress-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;flex-wrap:wrap}
.nm-atlas-bar{height:8px;border-radius:99px;background:var(--nm-bg);border:1px solid var(--nm-border);overflow:hidden}
.nm-atlas-bar-fill{height:100%;background:linear-gradient(90deg,var(--nm-accent),color-mix(in srgb,var(--nm-accent) 55%,var(--nm-good)));transition:width .3s ease}
.nm-atlas-stats{display:flex;flex-wrap:wrap;gap:6px}
.nm-atlas-chip{font-size:11px;color:var(--nm-muted);border:1px solid var(--nm-border);border-radius:999px;padding:2px 9px;white-space:nowrap}
.nm-atlas-chip[data-warn=true]{color:var(--nm-accent);border-color:color-mix(in srgb,var(--nm-accent) 45%,var(--nm-border))}
.nm-atlas-level{list-style:none;margin:0;padding:0}
.nm-atlas-level .nm-atlas-level{border-left:1px solid var(--nm-border);margin-left:15px}
.nm-atlas-item{margin:0;padding:0}
.nm-atlas-row{width:100%;display:flex;align-items:center;gap:6px;text-align:left;border:0;background:transparent;border-radius:8px;padding:4px 8px;cursor:pointer;min-width:0}
.nm-atlas-row:hover:not([data-leaf=true]){background:var(--dsw-alias-interactive-bg-hover,color-mix(in srgb,CanvasText 6%,transparent))}
.nm-atlas-row[data-leaf=true]{cursor:default}
.nm-atlas-row:focus-visible{outline:2px solid var(--nm-accent);outline-offset:-2px}
.nm-atlas-chevron{flex:none;width:12px;color:var(--nm-muted);font-size:10px;text-align:center}
.nm-atlas-label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nm-atlas-meta{flex:none;font-size:11px;color:var(--nm-muted)}
.nm-atlas-row[data-missing=true] .nm-atlas-label,.nm-atlas-row[data-missing=true] .nm-atlas-chevron{color:var(--nm-muted);opacity:.75}
.nm-atlas-message{padding:16px 10px;font-size:12px;color:var(--nm-muted);line-height:1.7}
.nm-atlas-title-icon{flex:none}
.nm-atlas-seg{flex:none;display:flex;gap:2px;padding:2px;border:1px solid var(--nm-border);border-radius:10px;background:var(--nm-bg)}
.nm-atlas-seg button{border:0;background:transparent;color:var(--nm-muted);border-radius:6px;padding:4px 10px;cursor:pointer;font-size:12px}
.nm-atlas-seg button[aria-pressed=true]{background:var(--nm-card);color:var(--nm-text);box-shadow:0 1px 4px color-mix(in srgb,CanvasText 12%,transparent)}
.nm-atlas-graph{flex:1;min-height:0;overflow:auto;padding:6px 10px 20px}
.nm-atlas-svg{display:block}
.nm-atlas-link{fill:none;stroke-width:1.6;opacity:.55}
.nm-atlas-text{fill:var(--nm-text);font-size:11.5px;paint-order:stroke;stroke:var(--nm-bg);stroke-width:3px;stroke-linejoin:round}
.nm-atlas-text-root{font-size:13px;font-weight:650}
.nm-atlas-more{fill:var(--nm-muted);font-size:10px;paint-order:stroke;stroke:var(--nm-bg);stroke-width:3px;stroke-linejoin:round}
.nm-atlas-gnode{cursor:pointer}
.nm-atlas-gnode:hover .nm-atlas-text{text-decoration:underline}
.nm-atlas-gnode:focus-visible{outline:2px solid var(--nm-accent)}
.nm-atlas-map{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;align-items:start}
.nm-atlas-world{border:1px solid var(--nm-border);border-radius:12px;overflow:hidden;background:var(--nm-map-sea,#24333f);line-height:0}
/* 地图底图切换条 */
.nm-atlas-artbar{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:7px 11px;border:1px solid var(--nm-border);border-radius:10px;background:var(--nm-card);margin-top:8px;line-height:1.5}
.nm-atlas-artbar .nm-muted{font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nm-atlas-arttoggle{font:inherit;font-size:11px;cursor:pointer;color:var(--nm-accent);border:1px solid color-mix(in srgb,var(--nm-accent) 40%,var(--nm-border));border-radius:6px;background:transparent;padding:4px 11px;flex:none;transition:background-color var(--nm-t-fast) var(--nm-ease-out),border-color var(--nm-t-fast) var(--nm-ease-out),color var(--nm-t-fast) var(--nm-ease-out),box-shadow var(--nm-t-base) var(--nm-ease-out),transform var(--nm-t-fast) var(--nm-ease-out)}
.nm-atlas-arttoggle:hover{background:color-mix(in srgb,var(--nm-accent) 12%,transparent)}
.nm-atlas-world-wrap{display:flex;flex-direction:column;gap:8px}
.nm-atlas-world-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;flex-wrap:wrap}
.nm-atlas-world-title{font-size:12px;font-weight:600;color:var(--nm-text)}
.nm-atlas-world-sub{font-size:10.5px;color:var(--nm-muted)}
.nm-atlas-legend{display:flex;flex-wrap:wrap;gap:8px;padding:0 2px}
.nm-atlas-legend-item{display:inline-flex;align-items:center;gap:5px;font-size:10.5px;color:var(--nm-muted)}
.nm-atlas-legend-swatch{width:10px;height:10px;border-radius:4px;border:1px solid rgba(0,0,0,0.35)}
.nm-atlas-region{border:1px solid var(--nm-border);border-radius:12px;background:var(--nm-card);padding:10px;display:flex;flex-direction:column;gap:6px;min-width:0}
.nm-atlas-terrain{border-radius:8px;overflow:hidden;line-height:0;border:1px solid var(--nm-border)}
.nm-atlas-region-meta{font-size:10.5px;color:var(--nm-muted);display:flex;gap:4px;flex-wrap:wrap}
.nm-atlas-region-head{display:flex;align-items:center;gap:6px;border:0;background:transparent;padding:0;cursor:pointer;min-width:0;width:100%}
.nm-atlas-swatch{width:9px;height:9px;border-radius:50%;flex:none}
.nm-atlas-region-title-text{font-size:12.5px;font-weight:650;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nm-atlas-count{margin-left:auto;flex:none;font-size:10.5px;color:var(--nm-muted);border:1px solid var(--nm-border);border-radius:999px;padding:1px 7px}
.nm-atlas-region-desc{font-size:11px;color:var(--nm-muted);line-height:1.5;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
/* ── 生图工作台 ── */
/* 面板贴边时每个框的边框都会顶到滚动条，留出左右呼吸空间 */
.nm-art{padding-left:14px;padding-right:14px}
/* 面板不在 .nm-settings 作用域内，必须自带控件样式，否则按钮会退化成纯文本 */
.nm-art button{font:inherit;font-size:12px;cursor:pointer;color:var(--nm-text);border:1px solid var(--nm-border);border-radius:10px;background:var(--nm-raised);padding:8px 14px;transition:background-color var(--nm-t-fast) var(--nm-ease-out),border-color var(--nm-t-fast) var(--nm-ease-out),color var(--nm-t-fast) var(--nm-ease-out),box-shadow var(--nm-t-base) var(--nm-ease-out),transform var(--nm-t-fast) var(--nm-ease-out);font-weight:550}
.nm-art button:hover:not(:disabled){border-color:var(--nm-accent);background:color-mix(in srgb,var(--nm-accent) 10%,var(--nm-raised))}
.nm-art button:disabled{opacity:.45;cursor:not-allowed}
.nm-art button.nm-primary{background:linear-gradient(135deg,color-mix(in srgb,var(--nm-accent) 20%,var(--nm-card)),color-mix(in srgb,var(--nm-accent) 13%,var(--nm-card)));border-color:color-mix(in srgb,var(--nm-accent) 60%,var(--nm-border));color:var(--nm-accent);font-weight:700;box-shadow:0 2px 8px -2px color-mix(in srgb,var(--nm-accent) 35%,transparent)}
.nm-art button.nm-primary:hover:not(:disabled){background:linear-gradient(135deg,color-mix(in srgb,var(--nm-accent) 28%,var(--nm-card)),color-mix(in srgb,var(--nm-accent) 20%,var(--nm-card)));border-color:var(--nm-accent)}
.nm-art select,.nm-art input[type=text],.nm-art input[type=password]{font:inherit;font-size:12px;color:var(--nm-text);width:100%;min-width:0;border:1px solid var(--nm-border);border-radius:10px;background:var(--nm-bg);padding:8px 11px}
.nm-art select{cursor:pointer}
.nm-art select option{background:var(--nm-card);color:var(--nm-text)}
.nm-art select:focus,.nm-art input:focus,.nm-art textarea:focus{outline:none;border-color:var(--nm-accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--nm-accent) 16%,transparent)}
.nm-art .nm-field{display:flex;flex-direction:column;gap:6px;min-width:0}
.nm-art .nm-field>span{font-weight:600;font-size:11.5px;color:var(--nm-text)}
.nm-art .nm-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.nm-art .nm-muted{font-size:11px;color:var(--nm-muted)}
.nm-art .nm-alert{font-size:11.5px;color:#e06c75;background:color-mix(in srgb,#e06c75 10%,transparent);border:1px solid color-mix(in srgb,#e06c75 30%,transparent);border-radius:8px;padding:8px 10px;line-height:1.6}
.nm-art-form{display:flex;flex-direction:column;gap:9px;padding:12px 0 4px;min-width:0}
.nm-art-toolbar{display:flex;align-items:center;gap:8px;margin-top:10px}
.nm-art-toolbar select{flex:1;min-width:0}
.nm-art-textarea{width:100%;resize:vertical;font:inherit;font-size:12px;line-height:1.6;padding:8px 10px;border-radius:10px;border:1px solid var(--nm-border);background:var(--nm-card);color:var(--nm-text)}
.nm-art-textarea:focus{outline:none;border-color:var(--nm-accent)}
.nm-art-preview{position:relative;display:flex;align-items:center;justify-content:center;min-height:260px;max-height:440px;border:1px solid var(--nm-border);border-radius:12px;background:var(--nm-card);overflow:hidden;margin-top:10px}
/* 空状态收矮，避免把下方的生成按钮推出可视区 */
.nm-art-preview[data-empty=true]{min-height:130px;max-height:170px}
.nm-art-preview img{max-width:100%;max-height:440px;display:block;object-fit:contain}
/* 主按钮全宽显示，明确告诉用户「点这里」 */
.nm-art-form>.nm-row>button.nm-primary{width:100%;padding:11px 16px;font-size:12.5px;letter-spacing:.02em}
.nm-art-placeholder{font-size:11px;color:var(--nm-muted);padding:24px;text-align:center;line-height:1.7}
.nm-art-steps{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
.nm-art-step{display:flex;align-items:center;gap:5px;font-size:10.5px;color:var(--nm-muted);padding:3px 9px;border-radius:999px;border:1px solid var(--nm-border);background:var(--nm-card)}
.nm-art-step[data-on=run]{border-color:var(--nm-accent);color:var(--nm-accent)}
.nm-art-step[data-on=done]{border-color:color-mix(in srgb,var(--nm-accent) 45%,transparent);color:var(--nm-accent);background:color-mix(in srgb,var(--nm-accent) 8%,var(--nm-card))}
.nm-art-stepnum{display:inline-flex;align-items:center;justify-content:center;width:15px;height:15px;border-radius:50%;background:color-mix(in srgb,CanvasText 8%,transparent);font-size:9.5px;font-weight:700}
/* 垫图区 */
.nm-art-ref{display:flex;flex-direction:column;gap:7px;padding:10px;border:1px dashed var(--nm-border);border-radius:10px;background:color-mix(in srgb,CanvasText 2%,transparent)}
.nm-art-reflabel{font-size:10.5px;color:var(--nm-muted);font-weight:600}
.nm-art-refpick{display:flex;align-items:center;justify-content:center;padding:14px;border-radius:8px;border:1px dashed var(--nm-border);cursor:pointer;font-size:11.5px;color:var(--nm-accent);background:var(--nm-card);transition:border-color .15s}
.nm-art-refpick:hover{border-color:var(--nm-accent)}
.nm-art-refbox{display:flex;align-items:center;gap:10px}
.nm-art-refbox img{width:64px;height:64px;object-fit:cover;border-radius:8px;border:1px solid var(--nm-border);flex:none}
.nm-art-refinfo{display:flex;flex-direction:column;gap:5px;min-width:0;flex:1}
.nm-art-refinfo .nm-muted{font-size:10.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nm-art-refclear{align-self:flex-start;font-size:10.5px;padding:2px 9px}
.nm-art-strength{gap:4px}
.nm-art-strength input[type=range]{width:100%;accent-color:var(--nm-accent)}
/* 构图控制：宽高比 / 分辨率 / 张数 / 透明背景 */
.nm-art-compose{display:flex;flex-direction:column;gap:9px;padding:11px 12px;border:1px solid var(--nm-border);border-radius:10px;background:color-mix(in srgb,CanvasText 2%,transparent)}
.nm-compose-row{display:flex;align-items:center;gap:9px;flex-wrap:wrap}
.nm-compose-label{flex:none;font-size:10.5px;font-weight:600;color:var(--nm-muted);min-width:56px;white-space:nowrap}
.nm-compose-group{display:flex;gap:5px;flex-wrap:wrap;flex:1;min-width:0}
.nm-compose-chip{flex:none;font-size:10.5px;padding:4px 9px;border-radius:6px;border:1px solid var(--nm-border);background:var(--nm-card);color:var(--nm-muted);cursor:pointer;font-family:inherit;transition:background-color var(--nm-t-fast) var(--nm-ease-out),border-color var(--nm-t-fast) var(--nm-ease-out),color var(--nm-t-fast) var(--nm-ease-out),box-shadow var(--nm-t-base) var(--nm-ease-out),transform var(--nm-t-fast) var(--nm-ease-out);line-height:1.5}
.nm-compose-chip:hover:not(:disabled){border-color:var(--nm-accent);color:var(--nm-accent)}
/* 选中态用「正文色填充 + 背景色文字」的反色方案。
   不用品牌色是因为 --nm-accent 在某些主题下解析出接近底色，
   会导致「浅底 + 浅字」整块看不见（实测截图就是这个现象）。
   反色方案的对比度恒等于正文对比度，任何主题都不会失效。 */
.nm-compose-chip[data-active=true]{background:var(--nm-text);border-color:var(--nm-text);color:var(--nm-bg);font-weight:700;box-shadow:none}
.nm-compose-chip[data-active=true]:hover:not(:disabled){background:var(--nm-text);border-color:var(--nm-text);color:var(--nm-bg)}
.nm-compose-chip:disabled{opacity:.5;cursor:not-allowed}
.nm-compose-hint{flex:none;font-size:10px;color:var(--nm-muted);white-space:nowrap}
.nm-compose-switch{flex:none;font-size:10.5px;padding:4px 12px;border-radius:999px;border:1px solid var(--nm-border);background:var(--nm-card);color:var(--nm-muted);cursor:pointer;font-family:inherit;transition:background-color var(--nm-t-fast) var(--nm-ease-out),border-color var(--nm-t-fast) var(--nm-ease-out),color var(--nm-t-fast) var(--nm-ease-out),box-shadow var(--nm-t-base) var(--nm-ease-out),transform var(--nm-t-fast) var(--nm-ease-out)}
/* 开关开启态同样用反色，避免依赖 --nm-good 的实际亮度 */
.nm-compose-switch[data-on=true]{background:var(--nm-text);border-color:var(--nm-text);color:var(--nm-bg);font-weight:700}
.nm-compose-switch:disabled{opacity:.5;cursor:not-allowed}
/* 多图缩略图条 */
.nm-art-thumbs{display:flex;align-items:center;gap:7px;flex-wrap:wrap;padding:8px 10px;border:1px solid var(--nm-border);border-radius:10px;background:color-mix(in srgb,CanvasText 2%,transparent)}
.nm-art-thumb{padding:0;border:2px solid transparent;border-radius:6px;background:none;cursor:pointer;line-height:0;overflow:hidden;flex:none;transition:border-color .14s}
.nm-art-thumb img{width:52px;height:52px;object-fit:cover;display:block}
.nm-art-thumb[data-active=true]{border-color:var(--nm-accent)}
.nm-art-thumb:hover{border-color:color-mix(in srgb,var(--nm-accent) 55%,transparent)}
.nm-subhead{margin:14px 0 6px;font-size:12px;font-weight:700;color:var(--nm-text)}.nm-atlas-spoke{margin-top:6px;border-top:1px dashed var(--nm-border);padding-top:8px}
.nm-atlas-timeline{position:relative;padding-left:20px;display:flex;flex-direction:column}
.nm-atlas-trail{position:absolute;left:5px;top:6px;bottom:6px;width:2px;background:var(--nm-border)}
.nm-atlas-tgroup{margin:12px 0 6px;font-size:11px;font-weight:650;color:var(--nm-muted)}
.nm-atlas-trow{position:relative;padding:5px 0}
.nm-atlas-tdot{position:absolute;left:-18px;top:11px;width:9px;height:9px;border-radius:50%;box-shadow:0 0 0 2px var(--nm-bg)}
.nm-atlas-tline{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
.nm-atlas-tline strong{font-size:11px;color:var(--nm-accent);flex:none}
.nm-atlas-ttitle{font-size:12px;line-height:1.5}
.nm-atlas-tmeta{display:flex;gap:6px;flex-wrap:wrap;margin-top:3px}
/* ── 生成进度面板 ──────────────────────────────────────────────
   侧边栏宽度通常只有 300–360px，所以全部按单列竖排设计：环形总览在上，
   清单在中，批量写作在下。字号比设置页再小一号，因为这里离眼睛更远，
   而且旁边就是正文。 */
.nm-prog{height:100%;min-height:0;display:flex;flex-direction:column;overflow-y:auto;overflow-x:hidden;padding:12px 12px 18px;gap:14px;scrollbar-width:thin}
/* 关键：面板内所有直接子块一律不许收缩。
   flex 容器的默认 flex-shrink 是 1，空间不够时每个子块按比例被压扁 ——
   地图、环形卡、清单会一层层叠到一起，看起来像「文字插进了别处」。
   正确做法是让它们保持自然高度，超出部分交给 .nm-prog 自己滚。 */
.nm-prog > *{flex:0 0 auto}
.nm-prog-actions{display:flex;align-items:center;gap:8px;margin-left:auto}
.nm-prog-auto{display:inline-flex;align-items:center;gap:5px;font-size:11px;color:var(--nm-muted);cursor:pointer;user-select:none;white-space:nowrap}
.nm-prog-auto input{width:12px;height:12px;accent-color:var(--nm-accent);cursor:pointer;margin:0}
.nm-prog-select{flex:1;min-width:0}
/* 总览卡：环形进度 + 文字。用 1px 半透明描边 + 极淡渐变做出层次，
   不靠重阴影——深色主题下重阴影会显脏。左上角那道 accent 微光让卡片
   和背景分离，又不至于抢走正文的注意力。 */
.nm-prog-hero{position:relative;display:flex;align-items:center;gap:14px;padding:14px 15px;border-radius:14px;border:1px solid var(--nm-border);background:radial-gradient(120% 130% at 0% 0%,color-mix(in srgb,var(--nm-accent) 11%,transparent),transparent 62%),var(--nm-card);overflow:hidden}
.nm-prog-ring{position:relative;flex:none;width:60px;height:60px;display:grid;place-items:center}
/* 只给 inset 不给宽高，SVG 会在 grid 里塌成 0×0 —— 预览时就是这里让
   进度弧整条不可见，只剩外圈的圆环背景。明确写出 60×60。 */
.nm-prog-ring svg{position:absolute;inset:0;width:60px;height:60px;overflow:visible}
/* 颜色一律走 CSS 规则，不写 stroke="var(--nm-accent)" 这种表现属性 ——
   表现属性里的 var() 不保证被解析，变量取不到时整条弧直接变成不可见，
   而且不报错，最难查。 */
.nm-prog-ring-track{stroke:var(--nm-border);fill:none}
.nm-prog-ring-arc{stroke:var(--nm-accent);fill:none;transition:stroke-dashoffset .6s cubic-bezier(.22,.61,.36,1);filter:drop-shadow(0 0 3px color-mix(in srgb,var(--nm-accent) 45%,transparent))}
.nm-prog-ring-num{position:relative;font-size:14px;font-weight:700;letter-spacing:-.4px;color:var(--nm-text);font-variant-numeric:tabular-nums;line-height:1}
.nm-prog-hero-text{min-width:0;flex:1;display:flex;flex-direction:column;gap:7px}
.nm-prog-hero-title{font-size:12px;color:var(--nm-muted);display:flex;align-items:baseline;gap:6px}
.nm-prog-hero-title b{font-size:15px;color:var(--nm-text);font-weight:700;font-variant-numeric:tabular-nums;letter-spacing:-.2px}
.nm-prog-next{font-size:11px;color:var(--nm-muted);display:flex;align-items:center;gap:6px;flex-wrap:wrap;line-height:1.5}
.nm-prog-next code{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:10.5px;padding:2px 7px;border-radius:6px;background:color-mix(in srgb,var(--nm-accent) 13%,var(--nm-bg));color:var(--nm-accent);border:1px solid color-mix(in srgb,var(--nm-accent) 26%,transparent);font-weight:600}
.nm-prog-allset{color:var(--nm-good)}
.nm-prog-section{display:flex;flex-direction:column;gap:7px}
.nm-prog-section-head{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:11px;font-weight:700;color:var(--nm-muted);letter-spacing:.4px;text-transform:uppercase}
.nm-prog-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:0}
/* 行高压到 30px：八项资产用两行间距会吃掉侧边栏一半高度，而这里每项
   只需要「名字 + 状态」两段信息，不需要呼吸感。 */
.nm-prog-item{display:flex;align-items:center;gap:9px;padding:6px 8px;border-radius:8px;font-size:12px;transition:background .16s ease}
.nm-prog-item:hover{background:color-mix(in srgb,CanvasText 4%,transparent)}
.nm-prog-item[data-state=missing] .nm-prog-label{color:var(--nm-muted)}
.nm-prog-label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nm-prog-meta{flex:none;font-size:10.5px;color:var(--nm-muted);font-variant-numeric:tabular-nums}
.nm-prog-item[data-state=done] .nm-prog-meta{color:color-mix(in srgb,var(--nm-good) 80%,var(--nm-muted))}
.nm-prog-item[data-state=empty] .nm-prog-meta{color:color-mix(in srgb,var(--nm-accent) 70%,var(--nm-muted))}
/* 状态点：已写好是实心绿勾，空文件是空心环，没建过是虚线圈。
   三种状态的形状本身不同，不依赖颜色区分——灰度下也读得出来。 */
.nm-prog-mark{flex:none;width:14px;height:14px;display:grid;place-items:center;color:var(--nm-muted)}
.nm-prog-mark[data-state=done]{color:var(--nm-good)}
.nm-prog-mark[data-state=empty]{color:var(--nm-accent)}
.nm-prog-mark[data-state=missing]{color:color-mix(in srgb,var(--nm-muted) 65%,transparent)}
.nm-prog-phase{flex:none;font-size:10px;padding:2px 8px;border-radius:999px;border:1px solid var(--nm-border);background:var(--nm-card);color:var(--nm-muted);font-weight:600;letter-spacing:0;text-transform:none}
.nm-prog-phase[data-phase=running]{color:var(--nm-accent);border-color:color-mix(in srgb,var(--nm-accent) 40%,transparent);background:color-mix(in srgb,var(--nm-accent) 12%,var(--nm-card))}
.nm-prog-phase[data-phase=complete]{color:var(--nm-good);border-color:color-mix(in srgb,var(--nm-good) 40%,transparent);background:color-mix(in srgb,var(--nm-good) 12%,var(--nm-card))}
.nm-prog-phase[data-phase=error]{color:var(--nm-error);border-color:color-mix(in srgb,var(--nm-error) 40%,transparent);background:color-mix(in srgb,var(--nm-error) 12%,var(--nm-card))}
.nm-prog-bar{height:5px;border-radius:999px;background:color-mix(in srgb,CanvasText 9%,transparent);overflow:hidden}
.nm-prog-bar-fill{height:100%;border-radius:inherit;background:linear-gradient(90deg,color-mix(in srgb,var(--nm-accent) 75%,transparent),var(--nm-accent));transition:width .5s cubic-bezier(.22,.61,.36,1)}
.nm-prog-bar-fill[data-phase=complete]{background:linear-gradient(90deg,color-mix(in srgb,var(--nm-good) 75%,transparent),var(--nm-good))}
.nm-prog-bar-fill[data-phase=error],.nm-prog-bar-fill[data-phase=aborted]{background:linear-gradient(90deg,color-mix(in srgb,var(--nm-error) 70%,transparent),var(--nm-error))}
.nm-prog-batch-meta{font-size:11px;color:var(--nm-muted);display:flex;gap:6px;flex-wrap:wrap;font-variant-numeric:tabular-nums}
.nm-prog-stale{color:color-mix(in srgb,var(--nm-error) 80%,var(--nm-muted))}
.nm-prog-error{font-size:11px;color:var(--nm-error);line-height:1.55;padding:7px 9px;border-radius:8px;background:color-mix(in srgb,var(--nm-error) 9%,transparent);border:1px solid color-mix(in srgb,var(--nm-error) 22%,transparent);overflow-wrap:anywhere}
/* 页脚也去掉 margin-top:auto。auto 外边距在**空间不够**时并不会让位，
   它只是把元素推到容器末尾，剩余高度为负时就会和上面的内容叠在一起。
   内容短的时候靠面板自身的 gap 已经足够分开，不需要再顶。 */
.nm-prog-foot{padding-top:10px;border-top:1px solid var(--nm-border);font-size:10.5px;color:var(--nm-muted);font-variant-numeric:tabular-nums}
/* 中间区块走自然高度，**不要** flex:1 + min-height:0。
   这两个属性合起来会把容器压到「剩余空间」的高度，而容器内部没有自己的
   滚动条，一旦内容比这个高度长，就会溢出到外面直接盖住页脚 —— 表现是
   「正文 40/40 章」那行插进资产清单中间，压住「伏笔」「剧情树」。
   整块面板本身已经是 overflow:auto，溢出交给它滚就够了。 */
.nm-prog-sections{flex:none;display:flex;flex-direction:column;gap:16px}
/* 世界地貌：等高线地形图。
   换成地图学里成熟的表达 —— 一条线一个高程，线越密坡越陡，这是地形图
   上百年没变的语言，自带「精确」的观感，而且矢量绘制不像素化。
   进度语义是「水位下降」：地形从水下逐层浮出，当前水面线就是世界的前沿。 */
.nm-terra{display:flex;flex-direction:column;gap:10px;padding:13px 13px 12px;border-radius:var(--nm-r-lg);background:var(--nm-raised);box-shadow:var(--nm-ring)}
.nm-terra-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px}
.nm-terra-title{font-size:11px;font-weight:600;letter-spacing:.6px;color:var(--nm-muted)}
.nm-terra-pct{font-size:13px;font-weight:700;color:var(--nm-text);font-variant-numeric:tabular-nums;letter-spacing:-.2px}
/* 画布保持接近正方。底色用很深的蓝黑而不是纯黑 —— 地形图的「水下」是
   有色调的，纯黑会让等高线看起来像描在虚空里，没有空间感。 */
.nm-terra-canvas{position:relative;width:100%;aspect-ratio:1;border-radius:10px;overflow:hidden;background:radial-gradient(120% 120% at 50% 42%,#0d1620 0%,#080c12 62%,#05070a 100%);box-shadow:inset 0 0 0 1px color-mix(in srgb,#8fd3ff 9%,transparent)}
.nm-terra-svg{position:absolute;inset:0;width:100%;height:100%;display:block}
/* 地名标注。字号用 SVG 用户单位（画布 84），换算下来在侧边栏里约 8–9px。
   不能再小：再小就糊成一团墨点，比不标还糟。描边用底色的 stroke 加在字后面，
   保证压在最亮的等高线上也读得出来 —— 这是地图标注的通用做法，
   比加半透明底板干净，也不会挡住地形。 */
.nm-terra-site-label{font-size:2.9px;font-family:var(--nm-font,ui-sans-serif,system-ui,"PingFang SC","Microsoft YaHei",sans-serif);font-weight:600;letter-spacing:.02px;fill:#d8ecfa;paint-order:stroke fill;stroke:#060a0f;stroke-width:.42px;stroke-linejoin:round}
/* 前沿那一条要能「呼吸」，但不能抢戏：慢速脉冲，幅度极小。 */
.nm-terra-front{animation:nm-terra-pulse 3.6s var(--nm-ease-std) infinite}
@keyframes nm-terra-pulse{0%,100%{opacity:.95}50%{opacity:.62}}
.nm-terra-glow{animation:nm-terra-glow 5s var(--nm-ease-std) infinite}
@keyframes nm-terra-glow{0%,100%{opacity:.34}50%{opacity:.6}}
/* 高程色标：横条把配色说清楚，不需要额外图例文字。
   <i> 是行内元素，直接给 height 不生效 —— 必须 display:block，
   否则整条塌成 0 高，只剩文字旁边一片空白。 */
.nm-terra-scale{display:flex;align-items:center;gap:8px}
.nm-terra-scale-label{flex:none;font-size:9.5px;letter-spacing:.5px;color:var(--nm-muted);opacity:.75}
.nm-terra-scale-bar{display:block;flex:1;height:4px;border-radius:999px;background:linear-gradient(90deg,rgb(36 52 70) 0%,rgb(58 88 112) 28%,rgb(104 143 172) 55%,rgb(168 200 222) 78%,rgb(226 240 250) 100%)}
.nm-terra-bar{display:block;height:3px;border-radius:2px;background:color-mix(in srgb,#8fd3ff 14%,transparent);overflow:hidden}
.nm-terra-bar-fill{display:block;height:100%;border-radius:2px;background:linear-gradient(90deg,#3d7ea6,#8fd3ff);transition:width 420ms var(--nm-ease-std)}
/* 存为地图资产。放在进度条下面一行，和「高程」图例同区域 —— 
   它是这张图的一个动作，不该跑到卡片外面去。 */
.nm-terra-save{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:2px}
.nm-terra-save-btn{padding:6px 13px;font-size:11.5px;font-weight:600;color:var(--nm-text);background:var(--nm-card);border:1px solid var(--nm-border);border-radius:8px;cursor:pointer;transition:background-color var(--nm-t-fast) var(--nm-ease-out),border-color var(--nm-t-fast) var(--nm-ease-out),color var(--nm-t-fast) var(--nm-ease-out)}
.nm-terra-save-btn:hover:not(:disabled){border-color:color-mix(in srgb,var(--nm-accent) 55%,var(--nm-border));color:var(--nm-accent)}
.nm-terra-save-btn:disabled{opacity:.55;cursor:default}
.nm-terra-save-ok{font-size:11px;color:var(--nm-good)}
.nm-terra-save-err{font-size:11px;color:var(--nm-error)}
/* 气候推演。放在「存为地图资产」下面 —— 前者是动作，后者是核对结果，
   顺序上先给动作再给解释，作者点完能立刻看到这张图合不合理。 */
.nm-world{display:flex;flex-direction:column;gap:7px;margin-top:4px;padding-top:10px;border-top:1px solid var(--nm-border-soft)}
.nm-world-head{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
.nm-world-title{font-size:10.5px;font-weight:600;letter-spacing:.4px;color:var(--nm-muted);text-transform:uppercase}
.nm-world-hint{font-size:10px;color:var(--nm-muted);opacity:.6}
.nm-world-list{display:flex;flex-direction:column;gap:3px;margin:0;padding:0;list-style:none}
.nm-world-row{display:grid;grid-template-columns:1fr auto auto auto auto;align-items:baseline;gap:8px;font-size:11.5px;line-height:1.5}
.nm-world-name{color:var(--nm-text);font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nm-world-band,.nm-world-terrain{font-size:10.5px;color:var(--nm-muted);white-space:nowrap}
.nm-world-terrain{opacity:.8}
/* 设定级限定（无源质/永冬）。用描边小标签，和右侧的推演结论区分开 ——
   它是作者写的，不该看起来像算出来的。 */
.nm-world-mark{font-size:9.5px;padding:1px 5px;border-radius:4px;white-space:nowrap;color:color-mix(in srgb,var(--nm-accent) 65%,var(--nm-muted));border:1px solid color-mix(in srgb,var(--nm-accent) 30%,transparent);cursor:help}
.nm-world-climate{font-size:10.5px;color:var(--nm-accent);white-space:nowrap;font-variant-numeric:tabular-nums}
.nm-world-issues{display:flex;flex-direction:column;gap:5px;margin-top:3px;padding:8px 10px;border-radius:8px;background:color-mix(in srgb,var(--nm-error) 7%,transparent);border:1px solid color-mix(in srgb,var(--nm-error) 22%,transparent)}
.nm-world-issues-head{display:flex;align-items:center;gap:6px;font-size:10.5px;font-weight:600;color:var(--nm-error)}
.nm-world-issues-count{display:inline-flex;align-items:center;justify-content:center;min-width:15px;height:15px;padding:0 4px;font-size:9.5px;border-radius:999px;background:color-mix(in srgb,var(--nm-error) 18%,transparent);font-variant-numeric:tabular-nums}
.nm-world-issue-list{display:flex;flex-direction:column;gap:4px;margin:0;padding:0;list-style:none}
.nm-world-issue{display:flex;flex-wrap:wrap;gap:2px 5px;font-size:11px;line-height:1.5;color:var(--nm-muted);cursor:help}
.nm-world-issue b{flex:none;font-weight:600;color:var(--nm-text)}
.nm-world-issue span{overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
/* 检索词：一行灰字，跟着问题走。它的作用是「想查的时候不用自己想关键词」，
   所以不能做成按钮 —— 这是提示，不是入口。 */
.nm-world-research{display:block;flex:none;margin-top:2px;font-size:9.5px;font-style:normal;letter-spacing:.2px;color:var(--nm-muted);opacity:.55}
.nm-world-issue:hover .nm-world-research{opacity:.85}
.nm-world-issue-high b{color:var(--nm-error)}
.nm-world-issue-mid b{color:color-mix(in srgb,var(--nm-accent) 70%,var(--nm-text))}
.nm-world-issue-low b{color:var(--nm-muted)}
.nm-world-more{font-size:10px;color:var(--nm-muted);opacity:.7}
/* 尊重系统的减少动效设置。 */
@media (prefers-reduced-motion:reduce){.nm-prog-ring-arc,.nm-prog-bar-fill,.nm-terra-front,.nm-terra-glow,.nm-terra-bar-fill{transition:none;animation:none}}
`
    const LABELS = {
      novel: '一键完本', continue: '续写', study: '拆书', outline: '大纲', cast: '人设',
      map: '地图',
      rewrite: '改写', review: '审校', idea: '构思', spark: '灵感', world: '世界', role: '角色',
      stats: '统计', export: '导出', conflict: '冲突分析', pace: '节奏分析', reader: '虚拟读者',
      dialogue: '对话增强', emotion: '情感曲线', market: '市场分析', compare: '作品对比',
      chapter: '章节生成', tips: '写作建议', trope: '套路分析', backup: '备份', merge: '合并', split: '拆分',
      learn: '学习记录', memory: '学习库', decide: '辅助决策', research: '资料检索',
    }
    const GROUPS = [
      ['writing', '写作', ['novel', 'continue', 'chapter', 'rewrite']],
      ['planning', '规划', ['idea', 'outline', 'cast', 'map', 'world', 'role', 'spark']],
      ['analysis', '分析', ['study', 'review', 'conflict', 'pace', 'reader', 'dialogue', 'emotion', 'market', 'compare']],
      ['management', '管理', ['stats', 'export', 'backup', 'merge', 'split', 'tips', 'trope']],
      ['intelligence', '学习与决策', ['learn', 'memory', 'decide']],
    ]
    const PIPELINE_STEPS = [
      { step: '01', title: '脑洞构思', cmd: '/novel-idea 你的脑洞', desc: '提炼核心看点与矛盾' },
      { step: '02', title: '世界与人设', cmd: '/novel-cast + /novel-world', desc: '建立人物谱系与环境法则' },
      { step: '03', title: '分卷与细纲', cmd: '/novel-outline 60章', desc: '规划每卷起承转合与钩子' },
      { step: '04', title: '正文生成', cmd: '/novel-chapter 1', desc: '去机械化、真人作者质感' },
      { step: '05', title: '审校与反馈', cmd: '/novel-review + /novel-reader', desc: '模拟读者画像、把控节奏' },
    ]
    const QUICK_ACTIONS = [
      { label: '快速立项建书', cmd: '/novel 你的脑洞 60章 --auto', desc: '从设定到分卷一气呵成' },
      { label: '生成指定新章节', cmd: '/novel-chapter 1 本章要写出压迫感', desc: '安全生成不覆盖原稿' },
      { label: '拆解爆款文风', cmd: '/novel-study ./样章.txt --to 书名', desc: '提取词频习惯与黄金节奏' },
      { label: '多重读者审校', cmd: '/novel-reader 1-3 --persona 挑刺党', desc: '挑刺党/催更党多维打分' },
    ]
    const LEARNING_TOPICS = [
      { id: 'cast', label: '人设塑造与动态心流', desc: '角色的说话口吻、行事动机、反差与性格弧光' },
      { id: 'pacing', label: '叙事节奏与黄金悬念', desc: '起承转合、章末断章钩子、信息梯度释放' },
      { id: 'conflict', label: '矛盾升级与张力制造', desc: '多方博弈、危机压迫感、爽点爆发与情绪拉扯' },
      { id: 'dialogue', label: '对白潜台词与真人质感', desc: '剔除AI机械腔、言外之意、符合身份的口语表达' },
      { id: 'style', label: '文风语感与画面修辞', desc: '长短句律动、临场感烘托、动作细节特写' },
      { id: 'world', label: '世界观细节与法则自洽', desc: '力量阶梯、设定自然带出、社会与自然法则' },
    ]
    const FALLBACK_MODELS = [
      { provider: 'hajimi', model: 'gemini-3.8-flash', label: 'hajimi / gemini-3.8-flash (主会话模型)' },
      { provider: 'workbuddy', model: 'deepseek-v4.1-flash', label: 'workbuddy / deepseek-v4.1-flash' },
      { provider: 'our-free-model', model: 'mimo-v2.6-flash-free', label: 'our-free-model / mimo-v2.6-flash-free' },
      { provider: 'our-free-model', model: 'space-bunny-free', label: 'our-free-model / space-bunny-free' },
      { provider: 'workbuddy', model: 'hy4-preview-f', label: 'workbuddy / hy4-preview-f' },
    ]
    const GUIDANCE = { enabled: false, provider: '', model: '', reasoningEffort: '', writingProvider: '', writingModel: '', writingReasoningEffort: '', guidanceStyle: 'detailed' }
    const LEARNING = { enabled: false, autoSummarize: true, reuse: true, storageDir: 'novel_learning', summaryProvider: '', summaryModel: '', summaryReasoningEffort: '', maxInputChars: 12000, maxRecords: 500, cooldownSeconds: 60, topics: [] }
    const DECISION = { enabled: false, provider: '', model: '', reasoningEffort: '', minConfidence: 0.7, timeoutMs: 30000 }
    const RESEARCH = { enabled: false, provider: '', model: '', reasoningEffort: '', storageDir: 'novel_research', maxResults: 5, maxSourceChars: 12000, timeoutMs: 60000 }
    const BATCH = { provider: '', model: '', reasoningEffort: '', chaptersPerRequest: 20 }
    // 作者人格：拆书分析用一档，听懂自然语言用另一档。两者独立，留空各有回退。
    const PERSONA = { provider: '', model: '', reasoningEffort: '' }
    const PERSONA_INTENT = { provider: '', model: '', reasoningEffort: '' }
    
    const TUTORIAL_STEPS = [
      {
        title: '欢迎使用小说创作大师',
        icon: '📚',
        content: '这是一个强大的 AI 辅助小说创作插件，帮助您轻松完成长篇小说创作。\n\n核心功能：\n• 一键完本 - 输入脑洞自动规划并写完整本\n• 智能续写 - 接着已有内容继续创作\n• 引导-写作分离 - 双模型协作提升质量\n• 学习总结 - 自动总结历史经验\n• AI 决策助手 - 剧情分岔智能建议'
      },
      {
        title: '引导-写作分离架构',
        icon: '🎯',
        content: '使用强模型引导规划 + 快速模型执行写作的双模型协作架构。\n\n工作原理：\n• 引导模型（如 Claude Opus）负责分析上下文、拆解任务、生成详细大纲\n• 写作模型（如 Gemini Flash）接收大纲指令、专注文字生成\n\n推荐配置：\n• 引导模型：Claude Opus 5.5\n• 写作模型：Gemini 2.0 Flash\n• 引导风格：详细模式（推荐）\n\n效果提升：\n• 质量：Flash 单模型 45分 → Flash+Opus 引导 85分\n• 成本：比 GPT-4o 节省 88%'
      },
      {
        title: '学习总结功能',
        icon: '📖',
        content: '自动总结每章创作的关键信息，建立项目知识库。\n\n核心功能：\n• 自动提取剧情要点、人物状态、伏笔线索\n• 后续章节自动复用历史总结\n• 支持多主题分类存储\n\n使用建议：\n• 启用自动总结\n• 设置总结模型（推荐 Gemini 2.0 Flash）\n• 按需调整最大输入字符数（默认 12000）'
      },
      {
        title: 'AI 决策助手',
        icon: '🤔',
        content: '在剧情分岔、审校取舍等场景提供智能建议。\n\n应用场景：\n• 剧情发展方向选择\n• 人物命运走向判断\n• 内容质量评审建议\n\n配置说明：\n• 设置决策模型（推荐 DeepSeek R1）\n• 调整最小置信度（默认 0.7）\n• 设置超时时间（默认 30 秒）'
      },
      {
        title: '快速开始',
        icon: '🚀',
        content: '常用命令示例：\n\n一键完本：\n/novel 网管发现网吧的电脑能修仙 60章\n\n智能续写：\n/novel-continue 项目名 续写20章\n\n写单章：\n/novel-chapter 项目名 写第5章\n\n更新插件：\n/novel-update check\n/novel-update apply\n\n更多命令请使用 /help novel 查看详细文档。'
      }
    ]
    
    const TUTORIAL_STORAGE_KEY = 'novel-master-tutorial-completed'
    
    const short = value => value ? value.slice(0, 12) : '提交未知'
    const version = value => `${value?.version ?? '未知'} · ${short(value?.commit)}`

    async function api(action, { body, signal, timeoutMs = 20000 } = {}) {
      const controller = new AbortController()
      const abort = () => controller.abort()
      signal?.addEventListener('abort', abort, { once: true })
      if (signal?.aborted) controller.abort()
      const timer = setTimeout(abort, timeoutMs)
      try {
        const response = await fetch(`${API}${action}`, {
          method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', redirect: 'error',
          headers: { 'content-type': 'application/json', 'x-novel-master': 'settings' },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: controller.signal,
        })
        let payload
        if (typeof response.text === 'function') {
          const text = await response.text()
          try { payload = text ? JSON.parse(text) : {} } catch {
            throw new Error(`${action} · HTTP ${response.status ?? '未知'}：${response.status === 404 ? '插件后端尚未就绪，请重启 DSH 后重试。' : response.status === 401 ? '登录状态已失效，请刷新当前页面。' : '后端未返回有效数据，请刷新状态或重启 DSH。'}`)
          }
        } else payload = await response.json()
        if (!response.ok) throw new Error(`${action} · HTTP ${response.status ?? '未知'}：${payload.error ?? (response.status === 404 ? '插件后端尚未就绪，请重启 DSH 后重试。' : '请求失败，请稍后重试。')}`)
        return payload
      } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort) }
    }

    /**
     * 错误边界。设置区是宿主渲染的一块独立区域，React 只要在渲染中抛错，
     * 宿主会把那片区域整个清空 —— 用户看到一块白板，既不知道发生了什么，
     * 也点不到任何按钮。
     *
     * 包一层之后，同样的错误会变成一张写着原因和堆栈的卡片，能直接念出来，
     * 也知道该重试还是该报问题。这类兜底不该建立在「不出错」的假设上。
     *
     * 必须用类组件：错误边界只有 getDerivedStateFromError / componentDidCatch
     * 两个生命周期，函数组件没有等价物。
     * React.Component 不存在时（测试里的极简 React 就没有）不挂边界，
     * 否则「兜底」本身会挡住所有内容。判断放在挂载处，见 settings.section。
     */
    const hasErrorBoundary = typeof React.Component === 'function'
    class SettingsBoundaryClass extends (hasErrorBoundary ? React.Component : class {}) {
      constructor(props) {
        super(props)
        if (!hasErrorBoundary) this.props = props ?? {}
        this.state = { error: null }
      }
      static getDerivedStateFromError(error) {
        return { error }
      }
      componentDidCatch(error, info) {
        // 留一份到控制台：白屏时用户通常不会打开开发者工具，真要排查时
        // 完整堆栈只有那里有。
        try { console.error('[novel-master] 设置区渲染失败', error, info) } catch { /* 控制台不可用就算了 */ }
      }
      render() {
        const { error } = this.state
        if (!error) return this.props.children
        const detail = String(error?.stack ?? error?.message ?? error)
        return h('div', { className: 'nm-settings' }, h('style', null, CSS),
          h('div', { className: 'nm-card nm-empty', role: 'alert' },
            h('h3', null, '设置面板渲染出错'),
            h('p', null, '插件本身仍在运行，只是这一块界面没能画出来。把下面的信息发给我可以更快定位。'),
            h('pre', {
              style: {
                margin: '10px 0 0', padding: '10px', borderRadius: '8px',
                background: 'color-mix(in srgb, currentColor 8%, transparent)',
                fontSize: '11px', lineHeight: '1.5', whiteSpace: 'pre-wrap',
                wordBreak: 'break-word', maxHeight: '220px', overflow: 'auto',
              },
            }, detail),
            h('button', {
              type: 'button', className: 'nm-primary', style: { marginTop: '12px' },
              onClick: () => this.setState({ error: null }),
            }, '重试渲染')))
      }
    }

    function SettingsPage(props) {
      // 宿主上下文在这里取一次。此前只有 loadModels 内部声明了 const ctx，
      // 而三个「浏览」按钮在 render 时引用的是外层作用域里的 ctx —— 那里
      // 根本没有这个变量，点下去直接抛 ReferenceError，连 toast 都来不及
      // 显示，用户看到的就是「按钮没反应」。
      const ctx = props?.ctx
      const [form, setForm] = useState(null)
      const [state, setState] = useState(null)
      const [busy, setBusy] = useState('')
      const [error, setError] = useState('')
      const [notice, setNotice] = useState('')
      const [directory, setDirectory] = useState('')
      const [proxy, setProxy] = useState('')
      const [guidance, setGuidance] = useState({ ...GUIDANCE, ...form?.value?.guidance })
      const [learning, setLearning] = useState({ ...LEARNING, ...form?.value?.learning })
      const [decision, setDecision] = useState({ ...DECISION, ...form?.value?.decision })
      const [research, setResearch] = useState({ ...RESEARCH, ...form?.value?.research })
      const [batchWrite, setBatchWrite] = useState({ ...BATCH, ...form?.value?.batch })
      const [persona, setPersona] = useState({ ...PERSONA, ...form?.value?.persona })
      const [personaIntent, setPersonaIntent] = useState({ ...PERSONA_INTENT, ...form?.value?.personaIntent })
      const [activity, setActivity] = useState(null)
      const [activityError, setActivityError] = useState('')
      const [activityBusy, setActivityBusy] = useState(false)
      const [tab, setTab] = useState('features')
      const [search, setSearch] = useState('')
      const [loading, setLoading] = useState(!form)
      const [toast, setToast] = useState('')
      const [availableModels, setAvailableModels] = useState(FALLBACK_MODELS)
      // 生图卡片的状态提示放在 ref 上：设置页的 useState 顺序被既有测试
      // 按索引消费，新增 state 会平移后续取值，因此这里不占用 hook 槽位。
      const imageModelHintRef = useRef({ hint: '', error: '' })
      // 模型选择浮层的开关与搜索词。放在 ref 上会与重绘时机不同步，
      // 这里用 state，占用 hook 槽位是可接受的（测试按索引取用的状态在其之前）。
      const [modelOpen, setModelOpen] = useState('')
      const [modelQuery, setModelQuery] = useState({ llm: '', image: '' })
      const [showTutorial, setShowTutorial] = useState(false)
      const [tutorialStep, setTutorialStep] = useState(0)
      // 系统目录选择器要两三秒才弹出来，这段时间按钮必须显示「正在唤起」，
      // 否则用户以为没点中就反复点，最后叠出好几个文件夹窗口。
      const [picking, setPicking] = useState(false)
      const alive = useRef(true)
      const saving = useRef(false)
      const operation = useRef(null)
      const dirty = useRef({})
      const pickingRef = useRef(false)
      const activityRequest = useRef(null)
      const toastTimer = useRef(null)
      const showToast = text => {
        setToast(text)
        if (toastTimer.current) clearTimeout(toastTimer.current)
        // 定时器只在还挂着的时候才有意义。node --test 会等所有定时器跑完
        // 才算这个进程结束 —— 一个 2.2 秒的 toast 定时器能让「点一下就完事」
        // 的测试白白多等两秒，单条从 170ms 涨到 2.4s。浏览器里没这个代价，
        // 但代价转移到了跑测试的人身上，所以卸载时统一清掉。
        toastTimer.current = setTimeout(() => {
          toastTimer.current = null
          if (alive.current) setToast('')
        }, 2200)
        // 允许运行环境主动回收（测试会调它），避免拖住进程退出。
        if (typeof toastTimer.current?.unref === 'function') toastTimer.current.unref()
      }

      const copyCommand = (cmdText, label = '') => {
        try {
          if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(cmdText).catch(() => {})
          }
        } catch {}
        showToast(`已复制：${cmdText}`)
      }

      /**
       * 用服务端返回的配置刷新本地状态。
       *
       * 这里原本无条件地连打 10 个 setState：form 一次，外加九个子配置各一次。
       * 每个 setState 都要用展开运算符重建一个新对象，而 React 只按引用判断
       * 变化 —— 即使服务端返回的子配置与本地完全相同，也会被判为「变了」，
       * 触发整页重渲染。设置页有 700 多个节点，首屏打开时的卡顿主要来自这里。
       *
       * 现在只在真的不同时才写状态：内容相同就跳过，省掉那一轮重渲染。
       */
      const acceptForm = (next, saved = {}) => {
        setForm(next)
        for (const key of Object.keys(saved)) delete dirty.current[key]
        // 比较时只认自有可枚举键；子配置都是扁平的小对象，JSON 比对足够快
        // （每个只有十几个字段），比给它写深比较划算。
        const same = (draft, base, incoming) => {
          const merged = { ...base, ...incoming }
          return JSON.stringify(merged) === JSON.stringify(draft)
        }
        const sync = (dirtyKey, incoming, base, setter) => {
          if (dirty.current[dirtyKey]) return
          setter(current => (same(current, base, incoming) ? current : { ...base, ...incoming }))
        }
        if (!dirty.current.projectsDir) setDirectory(next.value?.projectsDir ?? 'novel_projects')
        if (!dirty.current.updateProxy) setProxy(next.value?.updateProxy ?? '')
        sync('guidance', next.value?.guidance, GUIDANCE, setGuidance)
        sync('learning', next.value?.learning, LEARNING, setLearning)
        sync('decision', next.value?.decision, DECISION, setDecision)
        sync('research', next.value?.research, RESEARCH, setResearch)
        sync('batch', next.value?.batch, BATCH, setBatchWrite)
        // 漏掉这两行时，保存作者人格后输入框仍显示旧草稿，而 dirty 标记永远
        // 清不掉 —— 界面说「已保存」，用户看到的却是没保存的那份。
        sync('persona', next.value?.persona, PERSONA, setPersona)
        sync('personaIntent', next.value?.personaIntent, PERSONA_INTENT, setPersonaIntent)
      }
      const changed = (draft, original) => Object.keys(draft).some(key => String(draft[key]) !== String(original[key]))
      const editGuidance = (key, next) => setGuidance(current => { const draft = { ...current, [key]: next }; dirty.current.guidance = changed(draft, { ...GUIDANCE, ...form?.value?.guidance }); return draft })
      const editLearning = (key, next) => setLearning(current => { const draft = { ...current, [key]: next }; dirty.current.learning = changed(draft, { ...LEARNING, ...form?.value?.learning }); return draft })
      const editDecision = (key, next) => setDecision(current => { const draft = { ...current, [key]: next }; dirty.current.decision = changed(draft, { ...DECISION, ...form?.value?.decision }); return draft })
      const editResearch = (key, next) => setResearch(current => { const draft = { ...current, [key]: next }; dirty.current.research = changed(draft, { ...RESEARCH, ...form?.value?.research }); return draft })
      const editBatch = (key, next) => setBatchWrite(current => { const draft = { ...current, [key]: next }; dirty.current.batch = changed(draft, { ...BATCH, ...form?.value?.batch }); return draft })
      const editPersona = (key, next) => setPersona(current => { const draft = { ...current, [key]: next }; dirty.current.persona = changed(draft, { ...PERSONA, ...form?.value?.persona }); return draft })
      const editPersonaIntent = (key, next) => setPersonaIntent(current => { const draft = { ...current, [key]: next }; dirty.current.personaIntent = changed(draft, { ...PERSONA_INTENT, ...form?.value?.personaIntent }); return draft })

      const toggleTopic = id => {
        setLearning(current => {
          const currentTopics = Array.isArray(current.topics) ? current.topics : []
          const nextTopics = currentTopics.includes(id)
            ? currentTopics.filter(t => t !== id)
            : [...currentTopics, id]
          const draft = { ...current, topics: nextTopics }
          dirty.current.learning = changed(draft, { ...LEARNING, ...form?.value?.learning })
          return draft
        })
      }

      const pickDirectory = async (targetField, ctxRef) => {
        // DSH 通过 ctx.remote.directoryPicker.pick() 弹系统文件夹选择框。
        // 早期版本这里读的是 window.__DSH_DIRECTORY_PICKER__，那个全局并不存在，
        // 所以浏览按钮一直只会提示「请手动输入路径」。
        const picker = ctxRef?.remote?.directoryPicker
        if (!picker || typeof picker.pick !== 'function') {
          showToast('当前 DSH 版本不提供目录选择器，请在输入框中手动填写文件夹路径。')
          return
        }
        // 系统选择器本身要两三秒才弹出来（宿主侧的开窗开销，插件改不了），
        // 所以点击后必须立刻给反馈 —— 否则按钮看着像没点中，用户会连点几下，
        // 最后叠出好几个文件夹窗口。这里先把按钮置成「正在唤起」。
        if (pickingRef.current) return
        pickingRef.current = true
        setPicking(true)
        try {
          const picked = await picker.pick()
          // 系统选择框是模态的，用户可能在这个过程中把设置弹窗关掉。
          // await 之后组件已经卸载、却还往状态里写，正是「关掉选择器后
          // 插件页面整块空白」的触发器 —— 所以每个 await 之后先确认还活着。
          if (!alive.current) return
          if (!picked) return
          // 宿主理论上返回字符串，但不同版本返回过对象形态。归一化一下，
          // 否则 showToast 会拼出 "[object Object]"。
          const chosen = typeof picked === 'string' ? picked : picked?.path ?? picked?.value ?? ''
          if (!chosen) return
          if (targetField === 'storageDir') editResearch('storageDir', chosen)
          else if (targetField === 'learningStorageDir') editLearning('storageDir', chosen)
          else if (targetField === 'projectsDir') { setDirectory(chosen); dirty.current.projectsDir = true }
          showToast(`已选定目录：${chosen}`)
        } catch (failure) {
          // 用户点取消时也可能走到这里，不要报成错误
          const message = String(failure?.message ?? failure ?? '')
          if (/cancel|abort|取消/iu.test(message)) return
          showToast(`无法启动系统目录选择器（${message}），请手动填写路径。`)
        } finally {
          pickingRef.current = false
          if (alive.current) setPicking(false)
        }
      }

      const openGuide = () => setShowTutorial(true)
      const closeGuide = () => setShowTutorial(false)

      async function loadModels(signal) {
        if (!alive.current || signal?.aborted) return
        if (ctx?.remote?.llm && typeof ctx.remote.llm.listProviders === 'function') {
          try {
            const [reg, decl] = await Promise.all([
              ctx.remote.llm.listProviders(),
              typeof ctx.remote.llm.listConfigurableProviders === 'function' ? ctx.remote.llm.listConfigurableProviders() : { ok: false },
            ])
            
            if (!alive.current || signal?.aborted) return
            
            const list = []
            const seen = new Set()
            const add = (p, m, l, efforts) => {
              const k = `${p}::${m}`
              if (!seen.has(k)) { seen.add(k); list.push({ provider: p, model: m, label: l || `${p} / ${m}`, efforts: efforts || [] }) }
            }
            if (reg?.ok && Array.isArray(reg.value)) {
              for (const prov of reg.value) {
                if (prov?.models && Array.isArray(prov.models)) {
                  for (const m of prov.models) {
                    const id = typeof m === 'string' ? m : m?.id
                    const name = typeof m === 'object' && m?.name ? m.name : id
                    const efforts = typeof m === 'object' && m?.reasoning?.efforts ? m.reasoning.efforts : []
                    if (id) add(prov.id, id, `${prov.name || prov.id} / ${name}`, efforts)
                  }
                }
              }
            }
            if (list.length > 0) {
              if (alive.current && !signal?.aborted) setAvailableModels(list)
              return
            }
          } catch (err) {
            if (!alive.current || signal?.aborted) return
          }
        }

        try {
          const res = await api('models', { signal })
          if (alive.current && !signal?.aborted && Array.isArray(res?.models) && res.models.length > 0) {
            setAvailableModels(res.models)
          }
        } catch (err) {
          // Ignore errors in loadModels
        }
      }

      async function load(signal) {
        if (!alive.current || signal?.aborted) return
        setLoading(true)
        const results = await Promise.allSettled([api('settings', { signal }), api('status', { signal })])
        if (!alive.current || signal?.aborted) return
        if (results[0].status === 'fulfilled') acceptForm(results[0].value)
        if (results[1].status === 'fulfilled') setState(results[1].value)
        const failures = results.filter(result => result.status === 'rejected').map(result => result.reason.message)
        if (failures.length && alive.current) setError(failures.join('\n'))
        if (alive.current) setLoading(false)
        loadModels(signal).catch(() => {})
      }
      useEffect(() => {
        alive.current = true
        const controller = new AbortController()
        load(controller.signal)
        return () => { alive.current = false; controller.abort(); operation.current?.abort(); activityRequest.current?.abort(); if (toastTimer.current) clearTimeout(toastTimer.current) }
      }, [])

      async function refresh(signal) { 
        if (!alive.current) return
        setError('')
        const controller = signal ?? new AbortController()
        await load(controller.signal)
      }
      async function save(patch) {
        if (!form || saving.current || operation.current || activityRequest.current || busy || state?.busy) return
        saving.current = true; setBusy('save'); setError(''); setNotice('')
        try {
          const next = await api('settings', { body: { patch, revision: form.revision } })
          if (alive.current) { acceptForm(next, patch); setNotice('配置已保存。') }
        } catch (reason) {
          if (alive.current) { 
            const refreshController = new AbortController()
            await refresh(refreshController.signal)
            if (alive.current) setError(`保存失败：${reason.message}`) 
          }
        } finally { saving.current = false; if (alive.current) setBusy('') }
      }
      async function run(action) {
        if (operation.current || saving.current || activityRequest.current || busy || state?.busy) return
        const controller = new AbortController()
        operation.current = controller
        setBusy(action); setError(''); setNotice('')
        try {
          const next = await api(action, { body: {}, signal: controller.signal, timeoutMs: action === 'apply' ? 195000 : 20000 })
          if (!alive.current) return
          if (action === 'reload') {
            const message = next.diagnostic ?? `重载结果：${next.application ?? (next.ok ? '成功' : '未完成')}`
            if (next.application === 'applied') setNotice(message)
            else setError(message)
          } else {
            setState(next)
            if (next.result) {
              const result = next.result
              const detail = result.error?.diagnostic ?? result.error?.code ?? ''
              const scripts = result.pendingBuilds?.length ? ` 构建脚本未获自动批准，请在插件管理器处理：${result.pendingBuilds.join(', ')}。` : ''
              const reload = result.codeReload ? ` 代码重载：${result.codeReload.application}。${result.codeReload.diagnostic ?? ''}` : ''
              const text = `安装结果：${result.application}。${detail}${scripts}${reload}${result.application === 'restart-required' ? (result.codeReload?.application === 'applied' ? ' Host 代码已切换；界面请刷新，新增页面仍可能需要重启。' : ' 请重启 DSH。') : ''}`
              if (['failed', 'cancelled', 'overridden'].includes(result.application) || result.codeReload?.application === 'failed') setError(text)
              else setNotice(text)
            }
          }
        } catch (reason) { if (alive.current) setError(reason.name === 'AbortError' ? '请求已取消或超时，请刷新状态确认安装结果。' : reason.message) }
        finally { operation.current = null; if (alive.current) setBusy('') }
      }
      async function cancel() {
        try {
          const result = await api('cancel', { body: {} })
          if (alive.current) setNotice(`取消结果：${result.status}。安装锁会保留到插件管理器结束操作。`)
        } catch (reason) { if (alive.current) setError(reason.message) }
      }
      async function readActivity() {
        if (activityRequest.current || saving.current || operation.current || busy || state?.busy) return
        const controller = new AbortController()
        activityRequest.current = controller; setActivityBusy(true); setActivityError('')
        try {
          const next = await api('intelligence/status', { signal: controller.signal })
          if (alive.current) setActivity(next)
        } catch (reason) { if (alive.current && !controller.signal.aborted) setActivityError(`读取活动失败：${reason.message}`) }
        finally { activityRequest.current = null; if (alive.current) setActivityBusy(false) }
      }
      function saveGuidance(event) {
        event.preventDefault()
        const next = {
          ...guidance,
          provider: guidance.provider.trim(),
          model: guidance.model.trim(),
          reasoningEffort: guidance.reasoningEffort.trim(),
          writingProvider: guidance.writingProvider.trim(),
          writingModel: guidance.writingModel.trim(),
          writingReasoningEffort: guidance.writingReasoningEffort.trim(),
          guidanceStyle: guidance.guidanceStyle.trim() || 'detailed'
        }
        if (next.enabled && (!next.provider || !next.model)) return setError('引导模型需要明确配置提供方和模型。')
        if (!!next.writingProvider !== !!next.writingModel) return setError('写作模型提供方和模型必须同时填写，或同时留空使用会话主模型。')
        return save({ guidance: next })
      }
      function saveLearning(event) {
        event.preventDefault()
        const next = { ...learning, storageDir: learning.storageDir.trim(), summaryProvider: learning.summaryProvider.trim(), summaryModel: learning.summaryModel.trim() }
        if (!next.topics || (Array.isArray(next.topics) && next.topics.length === 0 && (!form?.value?.learning?.topics || form.value.learning.topics.length === 0))) {
          if (!('topics' in (form?.value?.learning ?? {}))) delete next.topics
        }
        if (!next.summaryReasoningEffort && !('summaryReasoningEffort' in (form?.value?.learning ?? {}))) delete next.summaryReasoningEffort
        if (!next.storageDir) return setError('学习存储目录不能为空；支持绝对路径或相对路径。')
        if (!!next.summaryProvider !== !!next.summaryModel) return setError('摘要提供方和模型必须同时填写，或同时留空。')
        const ranges = { maxInputChars: [1000, 24000], maxRecords: [1, 10000], cooldownSeconds: [0, 86400] }
        for (const [key, [min, max]] of Object.entries(ranges)) {
          next[key] = Number(next[key])
          if (!Number.isSafeInteger(next[key]) || next[key] < min || next[key] > max) return setError(`${key} 必须为 ${min} 到 ${max} 之间的整数。`)
        }
        return save({ learning: next })
      }
      function saveDecision(event) {
        event.preventDefault()
        const next = { ...decision, provider: decision.provider.trim(), model: decision.model.trim(), reasoningEffort: decision.reasoningEffort.trim(), minConfidence: Number(decision.minConfidence), timeoutMs: Number(decision.timeoutMs) }
        if (!!next.provider !== !!next.model || (next.enabled && (!next.provider || !next.model))) return setError('决策需要明确配置提供方和模型，必须成对填写。')
        if (!Number.isFinite(next.minConfidence) || next.minConfidence < 0 || next.minConfidence > 1) return setError('最低置信度必须是 0 到 1 之间的数值。')
        if (!Number.isSafeInteger(next.timeoutMs) || next.timeoutMs < 1000 || next.timeoutMs > 120000) return setError('决策超时必须为 1000 到 120000 毫秒之间的整数。')
        return save({ decision: next })
      }
      function saveResearch(event) {
        event.preventDefault()
        const next = { ...research, provider: research.provider.trim(), model: research.model.trim(), reasoningEffort: research.reasoningEffort.trim(), storageDir: research.storageDir.trim(), maxResults: Number(research.maxResults), maxSourceChars: Number(research.maxSourceChars), timeoutMs: Number(research.timeoutMs) }
        if (!!next.provider !== !!next.model || (next.enabled && (!next.provider || !next.model))) return setError('资料检索需要明确配置提供方和模型，必须成对填写。')
        if (!next.storageDir) return setError('资料存储目录不能为空。')
        if (!Number.isSafeInteger(next.maxResults) || next.maxResults < 1 || next.maxResults > 10) return setError('最多来源数必须为 1 到 10 之间的整数。')
        if (!Number.isSafeInteger(next.maxSourceChars) || next.maxSourceChars < 1000 || next.maxSourceChars > 24000) return setError('单来源字符上限必须为 1000 到 24000 之间的整数。')
        if (!Number.isSafeInteger(next.timeoutMs) || next.timeoutMs < 1000 || next.timeoutMs > 120000) return setError('检索超时必须为 1000 到 120000 毫秒之间的整数。')
        return save({ research: next })
      }
      function saveBatch(event) {
        event.preventDefault()
        const next = { ...batchWrite, provider: batchWrite.provider.trim(), model: batchWrite.model.trim(), reasoningEffort: batchWrite.reasoningEffort.trim(), chaptersPerRequest: Number(batchWrite.chaptersPerRequest) }
        if (!!next.provider !== !!next.model) return setError('批量写作的提供方和模型必须成对填写，或都留空使用会话模型。')
        if (!Number.isSafeInteger(next.chaptersPerRequest) || next.chaptersPerRequest < 1 || next.chaptersPerRequest > 37) return setError('每次请求章数必须为 1 到 37 之间的整数（实测单次上限约 37 章）。')
        return save({ batch: next })
      }
      function savePersona(event) {
        event.preventDefault()
        const clean = (draft, name) => {
          const next = { provider: draft.provider.trim(), model: draft.model.trim(), reasoningEffort: draft.reasoningEffort.trim() }
          if (!!next.provider !== !!next.model) {
            return { error: `${name}的提供方和模型必须成对填写；两项都留空表示不启用这一档。` }
          }
          return { next }
        }
        const main = clean(persona, '拆书分析')
        if (main.error) return setError(main.error)
        const intent = clean(personaIntent, '意图解析')
        if (intent.error) return setError(intent.error)
        // 意图解析两项都留空时不要写入空串：留空在服务端表示「沿用拆书那档」，
        // 写成 '' 会让配置看起来填过，排查时容易误判。
        const patch = { persona: main.next }
        patch.personaIntent = intent.next.provider && intent.next.model
          ? intent.next
          : {}
        return save(patch)
      }
      const value = form?.value ?? {}
      const locked = !!busy || state?.busy || activityBusy
      const commandKeys = Object.keys(value?.commands ?? {}).filter(key => key !== 'update' && key !== 'novel-update')
      const known = new Set(GROUPS.flatMap(([, , keys]) => keys))
      const groups = [...GROUPS, ['other', '其他', commandKeys.filter(key => !known.has(key))]]
      const enabledCount = keys => (Array.isArray(keys) ? keys : []).filter(key => value?.commands?.[key] !== false).length
      const batch = (keys, enabled) => { if (!locked && !saving.current) return save({ commands: Object.fromEntries(keys.map(key => [key, enabled])) }) }
      const field = (label, key, draft, edit, type = 'text', props = {}) => h('label', { className: 'nm-field' }, h('span', null, label),
        h('input', { type, value: draft[key], disabled: locked, 'aria-label': label, ...props, onChange: event => edit(key, event.target.value) }))
      const toggle = (label, checked, onChange, description, aria = label) => h('label', { className: 'nm-switch' },
        h('span', { className: 'nm-switchcopy' }, h('strong', null, label), description && h('small', null, description)),
        h('input', { type: 'checkbox', role: 'switch', 'aria-label': aria, checked, disabled: locked, onChange: event => onChange(event.target.checked) }), h('i', { className: 'nm-track', 'aria-hidden': true }))
      const check = (label, key, draft, edit, description) => toggle(label, draft[key] === true, next => edit(key, next), description)
      const card = (title, description, ...children) => h('div', { className: 'nm-card' }, h('div', null, h('h3', null, title), description && h('p', { className: 'nm-muted' }, description)), ...children)
      const actionButton = (label, onClick, disabled = locked, primary = false) => h('button', { type: 'button', onClick, disabled, className: primary ? 'nm-primary' : '' }, label)
      const saveBar = (section, label, disabled = false) => h('div', { className: 'nm-savebar' }, h('span', { className: dirty.current[section] ? 'nm-dirty' : 'nm-muted' }, dirty.current[section] ? '● 有未保存的修改' : '✓ 配置已同步'), h('button', { type: 'submit', className: 'nm-primary', disabled: locked || disabled }, busy === 'save' ? '正在保存…' : label))
      const panel = (id, ...children) => h('section', { id: `nm-panel-${id}`, role: 'tabpanel', 'aria-labelledby': `nm-tab-${id}`, hidden: tab !== id, className: 'nm-stack', tabIndex: 0 }, ...children)
      const chip = (label, on) => h('span', { className: 'nm-chip', 'data-on': on === true }, h('i', { 'aria-hidden': true }), label)
      const query = search.trim().toLowerCase()
      const matches = key => !query || `${LABELS[key] ?? key} novel-${key}`.toLowerCase().includes(query)
      const descriptions = { novel: '从脑洞到完整长篇', continue: '接续项目或导入作品', chapter: '按指定章号生成新稿', rewrite: '调整表达与叙事方式', idea: '展开脑洞与故事方向', outline: '搭建分卷与章节结构', cast: '建立角色档案', world: '查看或推演世界状态', role: '查看与调整角色设定', spark: '为创作卡点提供灵感', study: '拆解参考作品的风格', review: '检查逻辑与文字问题', conflict: '梳理冲突与升级空间', pace: '检查叙事节奏和张弛', reader: '模拟不同读者的反馈', dialogue: '检查人物口吻与对话', emotion: '追踪情绪变化与弧线', market: '讨论平台适配方向', compare: '作品对比差异与优势', stats: '计算字数与章节进度', export: '导出可阅读的整书文件', backup: '保留可恢复的项目快照', merge: '将选定章节合成新文件', split: '按长度拆分为新文件', tips: '获取针对性的写作建议', trope: '设计套路变体与风险', learn: '提炼可复用的写作经验', memory: '查询模型专属经验', decide: '获得有依据的取舍建议' }
      const applyPreset = keys => { if (!locked && !saving.current) return save({ commands: Object.fromEntries(commandKeys.map(key => [key, keys.includes(key)])) }) }
      const activityPanel = h('div', { className: 'nm-card' }, h('div', { className: 'nm-cardhead' }, h('div', null, h('h3', null, '智能活动'), h('p', { className: 'nm-muted' }, '按需读取实际运行状态，不推测当前模型。')), actionButton(activityBusy ? '正在读取活动…' : '读取学习与决策活动', readActivity)),
        activityError && h('p', { role: 'alert', className: 'nm-alert' }, activityError),
        activity ? h('div', { role: 'status', className: 'nm-stack' }, h('div', { className: 'nm-row' }, chip(`学习：${activity.learningEnabled === true ? '启用' : activity.learningEnabled === false ? '关闭' : '未知'}`, activity.learningEnabled), chip(`决策：${activity.decisionEnabled === true ? '启用' : activity.decisionEnabled === false ? '关闭' : '未知'}`, activity.decisionEnabled)),
          h('p', { className: 'nm-muted' }, `配置存储地址：${activity.storageDir ?? '未返回'}；最近实际目录：${activity.location ?? '尚未访问'}`),
          h('p', { className: 'nm-muted' }, `跟踪会话：${activity.trackedSessions ?? '未返回'}；活动任务：${activity.activeJobs ?? '未返回'}；本次运行写入：${activity.recordsWrittenThisRun ?? '未返回'}`), activity.lastError && h('p', { role: 'alert' }, `最近错误：${activity.lastError}`)) : h('p', { className: 'nm-muted' }, '尚未读取。使用 /novel-memory 可查询已保存的经验。'))

      const workbenchCard = form && card('创作流水线工作台', '标准网文创作五阶段流转，点击指令代码可快速复制使用。',
        h('div', { className: 'nm-workbench-pipeline' },
          ...PIPELINE_STEPS.map(item => h('div', { className: 'nm-pipeline-step', key: item.step },
            h('span', { className: 'nm-pipeline-badge' }, `阶段 ${item.step}`),
            h('div', { className: 'nm-pipeline-title' }, item.title),
            h('div', { className: 'nm-pipeline-desc' }, item.desc),
            h('code', { className: 'nm-inlinecode', onClick: () => copyCommand(item.cmd), title: '点击复制指令' }, item.cmd)
          ))
        ),
        h('div', { className: 'nm-quick-grid' },
          ...QUICK_ACTIONS.map(item => h('div', { className: 'nm-quick-card', key: item.label, onClick: () => copyCommand(item.cmd) },
            h('div', null, h('strong', { style: { display: 'block', marginBottom: '3px' } }, item.label), h('span', { className: 'nm-muted' }, item.desc)),
            h('code', { className: 'nm-inlinecode' }, '复制')
          ))
        )
      )

      // ── AI 生图配置卡片：对话模型 + 生图模型，两个通道独立配置 ──
      const imageDraft = value.image ?? {}
      const llmDraft = value.llm ?? {}
      // 从中转站拉取模型列表：仅供提示，不自动写入配置，避免覆盖手填值。
      const fetchModels = async (channel) => {
        imageModelHintRef.current = { hint: '正在从中转站读取模型列表…', error: '' }
        try {
          const payload = await api(`llm/models?channel=${encodeURIComponent(channel)}`)
          const models = Array.isArray(payload?.models) ? payload.models : []
          if (!models.length) {
            imageModelHintRef.current = { hint: '中转站没有返回任何模型；可直接手填模型名称。', error: '' }
          } else {
            const shown = models.slice(0, 40).join('、')
            const more = models.length > 40 ? ` 等 ${models.length} 个` : ''
            imageModelHintRef.current = { hint: `可用模型（${models.length}）：${shown}${more}`, error: '' }
          }
        } catch (failure) {
          imageModelHintRef.current = { hint: '', error: `拉取失败：${failure?.message ?? failure}` }
        }
        showToast?.(imageModelHintRef.current.hint || imageModelHintRef.current.error)
      }

      // DSH 已注册模型按「疑似生图 / 其余文本」分类，供两个通道各自下拉
      const IMAGE_HINT = /image|dall[-_ ]?e|flux|stable[-_ ]?diffusion|sdxl|midjourney|\bmj\b|seedream|cogview|imagen|kolors|wanx|seed/i
      const dshModels = availableModels.map((item) => ({
        ...item,
        image: IMAGE_HINT.test(String(item.model) + ' ' + String(item.label ?? '')),
      }))
      const imageCapable = dshModels.filter((item) => item.image)
      const textCapable = dshModels.filter((item) => !item.image)

      // 模型选择：既能从 DSH 列表里选，也能直接手填（中转站模型常不在 DSH 列表里）。
      // 模型多了以后单纯下拉很难找，所以做成「带搜索框的浮层选择器」。
      const modelPicker = (draft, channel, label, candidates) => {
        const query = (modelQuery[channel] ?? '').trim().toLowerCase()
        const filtered = query
          ? candidates.filter(item => `${item.provider} ${item.model} ${item.label ?? ''}`.toLowerCase().includes(query))
          : candidates
        const open = modelOpen === channel
        const current = draft?.model ?? ''
        return h('div', { className: 'nm-field' },
          h('span', null, label),
          h('div', { className: 'nm-row', style: { gap: '6px' } },
            h('input', {
              type: 'text', value: current, disabled: locked,
              placeholder: channel === 'image' ? 'gpt-image-1' : 'gpt-4o',
              'aria-label': label,
              onChange: event => save({ [channel]: { ...draft, model: event.target.value.trim() } }),
            }),
            candidates.length
              ? h('button', {
                type: 'button', className: 'nm-modelpick', 'aria-expanded': open,
                'aria-label': `从 DSH 选择${label}`,
                onClick: () => setModelOpen(open ? '' : channel),
              }, open ? '收起' : `选择 (${candidates.length})`)
              : null),
          open
            ? h('div', { className: 'nm-modelpop' },
              h('input', {
                className: 'nm-modelsearch', type: 'search', value: modelQuery[channel] ?? '',
                placeholder: `搜索 ${candidates.length} 个模型…`, 'aria-label': `${label}搜索`,
                autoFocus: true,
                onChange: event => setModelQuery({ ...modelQuery, [channel]: event.target.value }),
              }),
              h('div', { className: 'nm-modelhint' },
                query
                  ? `匹配 ${filtered.length} / ${candidates.length} 个模型`
                  : `共 ${candidates.length} 个模型，输入关键词过滤`),
              h('div', { className: 'nm-modellist', role: 'listbox', 'aria-label': `${label}候选` },
                filtered.length === 0
                  ? h('div', { className: 'nm-modelempty' }, query ? '没有匹配的模型，可直接在上方手填。' : '没有可选模型。')
                  : filtered.slice(0, 200).map(item => h('button', {
                    key: `${item.provider}::${item.model}`, type: 'button', role: 'option',
                    className: 'nm-modelitem', 'aria-selected': item.model === current,
                    onClick: () => {
                      save({ [channel]: { ...draft, model: item.model } })
                      setModelOpen('')
                      setModelQuery({ ...modelQuery, [channel]: '' })
                    },
                  },
                    h('span', { className: 'nm-modelprov' }, item.provider),
                    h('span', { className: 'nm-modelname' }, item.model))),
                filtered.length > 200
                  ? h('div', { className: 'nm-modelempty' }, `仅显示前 200 个，共 ${filtered.length} 个，请继续输入缩小范围。`)
                  : null))
            : null)
      }
      const imageSettingsCard = form && card('AI 生图与提示词扩写', '地址填到 /v1 为止，插件自动拼 /chat/completions 与 /images/generations。请求由宿主进程发出，不受浏览器跨域限制。模型名既能从 DSH 已配置列表里选，也能直接手填中转站的模型 ID。',
        h('h4', { className: 'nm-subhead' }, '① 对话模型（把一句话扩写成生图提示词）'),
        toggle('启用对话模型', llmDraft.enabled === true, next => save({ llm: { ...llmDraft, enabled: next } }), '扩写按钮可用；关闭后只能手写提示词。'),
        h('div', { className: 'nm-field' },
          h('span', null, '接口地址'),
          h('input', { type: 'text', value: llmDraft.baseURL ?? '', disabled: locked, placeholder: 'https://api.example.com/v1', 'aria-label': '对话模型接口地址', onChange: event => save({ llm: { ...llmDraft, baseURL: event.target.value.trim() } }) })),
        modelPicker(llmDraft, 'llm', '模型名称', textCapable),
        h('div', { className: 'nm-field' },
          h('span', null, '密钥'),
          h('input', { type: 'password', value: llmDraft.apiKey ?? '', placeholder: '由本机配置保存', autoComplete: 'off', 'aria-label': '对话模型密钥', onChange: event => save({ llm: { ...llmDraft, apiKey: event.target.value } }) })),
        h('div', { className: 'nm-row' },
          actionButton('从中转站拉取模型列表', () => fetchModels('llm'), locked),
          h('span', { className: 'nm-muted' }, `DSH 已配置 ${dshModels.length} 个模型。`)),

        h('h4', { className: 'nm-subhead' }, '② 生图模型'),
        toggle('启用 AI 生图', imageDraft.enabled === true, next => save({ image: { ...imageDraft, enabled: next } }), '工作台与设定树地图的生图功能。'),
        h('div', { className: 'nm-field' },
          h('span', null, '接口地址'),
          h('input', { type: 'text', value: imageDraft.baseURL ?? '', disabled: locked, placeholder: 'https://api.example.com/v1', 'aria-label': '生图接口地址', onChange: event => save({ image: { ...imageDraft, baseURL: event.target.value.trim() } }) })),
        modelPicker(imageDraft, 'image', '模型名称', imageCapable.length ? imageCapable : dshModels),
        h('div', { className: 'nm-field' },
          h('span', null, '密钥'),
          h('input', { type: 'password', value: imageDraft.apiKey ?? '', placeholder: '由本机配置保存', autoComplete: 'off', 'aria-label': '生图密钥', onChange: event => save({ image: { ...imageDraft, apiKey: event.target.value } }) })),
        h('div', { className: 'nm-three' },
          field('图片尺寸', 'size', imageDraft, (key, val) => save({ image: { ...imageDraft, [key]: val.trim() } }), 'text', { placeholder: '1024x1024' }),
          field('画质（可空）', 'quality', imageDraft, (key, val) => save({ image: { ...imageDraft, [key]: val.trim() } }), 'text', { placeholder: 'standard / hd' })),
        h('div', { className: 'nm-row' },
          actionButton('从中转站拉取模型列表', () => fetchModels('image'), locked),
          h('span', { className: 'nm-muted' }, imageCapable.length
            ? `DSH 里有 ${imageCapable.length} 个疑似生图模型。`
            : 'DSH 未发现生图模型，多数中转站的 /models 也不列，直接手填模型 ID 即可。')),
        imageModelHintRef.current.error ? h('p', { role: 'alert', className: 'nm-alert' }, imageModelHintRef.current.error) : null
      )

      const renderReasoningSelect = (label, currentEffort, onSelectEffort, provider, model) => {
        const curEff = currentEffort || ''
        const targetModel = availableModels.find(x => x.provider === provider && x.model === model)
        const efforts = targetModel?.efforts || []
        const hasCustomEffort = curEff && !['', 'low', 'medium', 'high', 'extra_high'].includes(curEff) && !efforts.some(e => e.id === curEff)
        return h('div', { className: 'nm-field' },
          h('span', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
            label,
            h('small', { className: 'nm-muted' }, efforts.length ? `模型已声明 ${efforts.length} 档思考等级` : '留空使用默认强度')
          ),
          h('select', {
            className: 'nm-select',
            value: curEff,
            disabled: locked,
            'aria-label': `${label}选择器`,
            onChange: event => {
              const val = event.target.value
              onSelectEffort(val)
              showToast(val ? `思考强度已切换为：${val}` : '思考强度已切换为：默认强度')
            }
          },
            h('option', { value: '' }, '⚡ 默认思考强度 (Default)'),
            h('option', { value: 'low' }, '🌱 低思考强度 (Low · 极速响应)'),
            h('option', { value: 'medium' }, '⚖️ 中等思考强度 (Medium · 平衡)'),
            h('option', { value: 'high' }, '🧠 高深度思考 (High · 严密推演)'),
            h('option', { value: 'extra_high' }, '🔥 极限思考模式 (Extra High)'),
            hasCustomEffort && h('option', { value: curEff }, `⚙️ 自定义强度：${curEff}`),
            ...efforts.filter(e => !['low', 'medium', 'high', 'extra_high'].includes(e.id)).map(e => h('option', { key: e.id, value: e.id }, `💡 ${e.name || e.id}`))
          )
        )
      }

      const renderModelSelect = (label, currentProvider, currentModel, onSelect, isSummary = false) => {
        const curKey = currentProvider && currentModel ? `${currentProvider}::${currentModel}` : ''
        const isCustom = curKey && !availableModels.some(m => `${m.provider}::${m.model}` === curKey)
        return h('div', { className: 'nm-field', style: { marginBottom: '6px' } },
          h('span', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
            label,
            h('small', { className: 'nm-muted' }, isCustom ? '当前选用自定义模型' : `已实时发现 ${availableModels.length} 个 DSH 可用模型`)
          ),
          h('select', {
            className: 'nm-select',
            value: curKey,
            disabled: locked,
            'aria-label': `${label}选择器`,
            onChange: event => {
              const val = event.target.value
              if (!val) {
                onSelect('', '')
                showToast('已选用：跟随来源 (默认)')
              } else {
                const [p, m] = val.split('::')
                onSelect(p, m)
                const target = availableModels.find(x => x.provider === p && x.model === m)
                showToast(`已选用：${target?.label || m}`)
              }
            }
          },
            isSummary && h('option', { value: '' }, '✨ 跟随来源 (默认，不指定独立模型)'),
            !isSummary && h('option', { value: '', disabled: true }, '-- 请在现有模型列表中选择 --'),
            isCustom && h('option', { value: curKey }, `⚙️ 当前配置：${currentProvider} / ${currentModel}`),
            ...availableModels.map(m => h('option', {
              key: `${m.provider}::${m.model}`,
              value: `${m.provider}::${m.model}`
            }, m.label || `${m.provider} / ${m.model}`))
          )
        )
      }

      const activeTopics = Array.isArray(learning.topics) ? learning.topics : []

      return h('div', { className: 'nm-settings' }, h('style', null, CSS),
        h('header', { className: 'nm-hero', style: { position: 'relative' } },
          h('div', { className: 'nm-row nm-between' }, h('div', { className: 'nm-brand' }, h('div', { className: 'nm-logo', 'aria-hidden': true }, h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' }, h('path', { d: 'M12 6c-3-2-6-2-9-1v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1Z' }), h('path', { d: 'M12 6v14M6 9h3M6 12h3M15 9h3M15 12h3' }))), h('div', null, h('div', { className: 'nm-row' }, h('h2', null, '小说创作大师'), h('span', { className: 'nm-badge' }, 'v1.4.3')), h('p', { className: 'nm-muted' }, '把创作、经验与判断，整理成自己的写作工作台。'))),
            // 「?」和刷新按钮并排成一组，而不是单独飘在卡片右上角 ——
            // 标题只有一行，右上角那片空白撑不起一个孤立的圆钮。
            h('div', { className: 'nm-hero-actions' },
              actionButton('刷新设置与状态', refresh),
              h('button', { className: 'nm-help-btn', onClick: openGuide, 'aria-label': '查看帮助', title: '查看功能介绍' }, '?'))),
          h('div', { className: 'nm-row' }, chip(form ? value.enabled === false ? '小说功能已关闭' : '小说功能已启用' : '配置待连接', form && value.enabled !== false), chip(form ? `已选择 ${enabledCount(commandKeys)} / ${commandKeys.length} 项功能` : '功能加载中', !!form), chip(!form ? '引导模型待连接' : value.guidance?.enabled ? value.enabled === false ? '引导模型已暂停' : '引导模型已启用' : '引导模型未启用', !!form && value.enabled !== false && value.guidance?.enabled), chip(!form ? '学习状态待连接' : value.learning?.enabled ? value.enabled === false ? '学习总结已暂停' : '学习总结已启用' : '学习总结未启用', !!form && value.enabled !== false && value.learning?.enabled), chip(!form ? '决策状态待连接' : value.decision?.enabled ? value.enabled === false ? '决策助手已暂停' : '决策助手已启用' : '决策助手未启用', !!form && value.enabled !== false && value.decision?.enabled))),
        error && h('div', { role: 'alert', className: 'nm-alert' }, h('div', null, h('strong', null, '暂时无法完成操作'), h('p', null, error)), actionButton('重试连接', refresh)),
        // 空提示不占位：`notice` 可能是空串或只有空白，truthy 判断会把
        // 一条只有边框的绿色空条渲染出来，看着像布局坏了。
        (notice && String(notice).trim() ? h('div', { role: 'status', className: 'nm-alert nm-success' }, notice) : null),
        h('nav', { role: 'tablist', 'aria-label': '小说设置导航', className: 'nm-tabs' }, ...[['features', '功能选择'], ['guidance', '引导模型'], ['learning', '学习总结'], ['decision', '决策助手'], ['research', '资料检索'], ['batch', '批量写作'], ['persona', '作者人格'], ['image', 'AI 生图'], ['updates', '更新维护']].map(([id, label], index, tabs) => h('button', { type: 'button', role: 'tab', id: `nm-tab-${id}`, 'aria-controls': `nm-panel-${id}`, 'aria-selected': tab === id, tabIndex: tab === id ? 0 : -1, onClick: () => setTab(id), onKeyDown: event => { const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1; if (next >= 0) { event.preventDefault(); setTab(tabs[next][0]); event.currentTarget.parentElement?.querySelector(`#nm-tab-${tabs[next][0]}`)?.focus() } } }, label))),
        !form && loading && h('div', { className: 'nm-grid', role: 'status', 'aria-label': '正在加载设置' }, ...[0, 1, 2, 3].map(key => h('div', { className: 'nm-skeleton', key }))),
        !form && !loading && h('div', { className: 'nm-card nm-empty' }, h('h3', null, '配置服务尚未连接'), h('p', null, '请确认插件已启用；安装或更新后可重启 DSH 再连接。'), actionButton('重新读取配置', refresh)),
        panel('features', form && card('创作工作台', '关闭总开关会移除功能命令并停止智能处理，配置和更新入口仍保留。',
          toggle('启用小说功能', value.enabled !== false, next => save({ enabled: next }), '已运行的写作目标可通过 /goal pause 暂停。'),
          h('form', { 'aria-label': '项目目录配置', onSubmit: event => { event.preventDefault(); if (directory.trim()) save({ projectsDir: directory.trim() }) } },
            h('div', { className: 'nm-field' },
              h('span', null, '项目目录'),
              h('div', { className: 'nm-path-box' },
                h('input', { type: 'text', value: directory, disabled: locked, required: true, 'aria-label': '项目目录', placeholder: 'novel_projects', onChange: event => { dirty.current.projectsDir = event.target.value !== (value.projectsDir ?? 'novel_projects'); setDirectory(event.target.value) } }),
                actionButton(picking ? '正在唤起选择器…' : '📁 浏览…', () => pickDirectory('projectsDir', ctx), locked || picking)
              )
            ),
            h('p', { className: 'nm-muted' }, '相对于工作目录保存小说项目，也可以点击“浏览”选择自定义绝对路径。'),
            saveBar('projectsDir', '保存项目目录', !directory.trim())
          )),
          workbenchCard,


          form && card('选择适合你的工具', '按创作阶段选择，开关保存后立即生效；更新维护始终保留。',
            h('div', { className: 'nm-toolbar' }, h('input', { className: 'nm-search', type: 'search', value: search, placeholder: '搜索功能名称或命令…', 'aria-label': '搜索功能', onChange: event => setSearch(event.target.value) }), actionButton('全部开启', () => batch(commandKeys, true), locked || !commandKeys.length), actionButton('全部关闭', () => batch(commandKeys, false), locked || !commandKeys.length)),
            h('div', { className: 'nm-row' }, h('span', { className: 'nm-muted' }, '快速选择'), actionButton('基础工具', () => applyPreset(['novel', 'continue', 'chapter', 'outline', 'cast', 'stats', 'export', 'backup'])), actionButton('写作进阶', () => applyPreset(GROUPS.slice(0, 4).flatMap(([, , keys]) => keys))), actionButton('完整工具', () => applyPreset(commandKeys))),
            h('p', { role: 'status', className: 'nm-muted' }, `已选择 ${enabledCount(commandKeys)} / ${commandKeys.length} 项创作功能${value.enabled === false ? '（总开关已关闭）' : ''}`),
            ...groups.map(([id, label, keys]) => { const available = keys.filter(key => commandKeys.includes(key)); const visible = available.filter(matches); if (!available.length || !visible.length) return null
              return h('fieldset', { className: 'nm-group', key: id, 'aria-label': `${label}功能` }, h('legend', null, `${label} · ${enabledCount(available)} / ${available.length}`), h('div', { className: 'nm-row' }, actionButton(`${label}全开`, () => batch(available, true)), actionButton(`${label}全关`, () => batch(available, false))), h('div', { className: 'nm-features' }, ...visible.map(key => {
                const cmdStr = `/${key === 'novel' ? 'novel' : `novel-${key}`}`
                return h('div', { className: 'nm-feature', key },
                  toggle(LABELS[key] ?? key, value?.commands?.[key] !== false, next => batch([key], next), descriptions[key] ?? '按需加入你的创作工作流。'),
                  h('code', { onClick: () => copyCommand(cmdStr), title: '点击复制指令' }, cmdStr)
                )
              }))) }),
            !commandKeys.some(matches) && h('div', { className: 'nm-empty', role: 'status' }, '没有找到匹配功能，试试其他关键词。'))),
        panel('guidance', form && !value.guidance ? card('引导配置尚未就绪', '当前 Host 尚未提供引导配置，请重载插件或重启 DSH。') : form && h('form', { className: 'nm-stack', 'aria-label': '引导配置', onSubmit: saveGuidance },
          card('智能引导-写作分离架构', '由引导模型负责规划与拆解，写作模型专注文字生成。适合用顶尖模型引导、快速模型执行，达成质量与成本的最佳平衡。', 
            check('启用引导模型', 'enabled', guidance, editGuidance, '引导模型会分析上下文、拆解任务、生成详细写作大纲，再交由写作模型执行。'),
            h('div', { className: 'nm-callout' }, '💡 推荐配置：Claude Opus 5.5 引导 + Gemini 2.0 Flash 写作，兼顾质量与速度。')),
          card('引导模型配置（规划与拆解）', '负责分析项目状态、拆解任务、生成详细执行大纲与写作要求。',
            h('div', { className: 'nm-stack' },
              renderModelSelect('从现有模型列表中选择引导模型', guidance.provider, guidance.model, (p, m) => { editGuidance('provider', p); editGuidance('model', m) }, false),
              renderReasoningSelect('引导模型思考/推理强度 (Reasoning Effort)', guidance.reasoningEffort, val => editGuidance('reasoningEffort', val), guidance.provider, guidance.model),
              h('div', { className: 'nm-grid' },
                field('引导模型提供方', 'provider', guidance, editGuidance, 'text', { placeholder: '例如 anthropic', required: guidance.enabled }),
                field('引导模型 ID', 'model', guidance, editGuidance, 'text', { placeholder: '例如 claude-opus-5.5', required: guidance.enabled })
              )
            )),
          card('写作模型配置（文字生成）', '负责接收引导大纲并生成最终文字。留空则使用会话主模型。',
            h('div', { className: 'nm-stack' },
              renderModelSelect('从现有模型列表中选择写作模型', guidance.writingProvider, guidance.writingModel, (p, m) => { editGuidance('writingProvider', p); editGuidance('writingModel', m) }, true),
              renderReasoningSelect('写作模型思考/推理强度 (Reasoning Effort)', guidance.writingReasoningEffort, val => editGuidance('writingReasoningEffort', val), guidance.writingProvider, guidance.writingModel),
              h('div', { className: 'nm-grid' },
                field('写作模型提供方', 'writingProvider', guidance, editGuidance, 'text', { placeholder: '留空使用会话主模型' }),
                field('写作模型 ID', 'writingModel', guidance, editGuidance, 'text', { placeholder: '留空使用会话主模型' })
              )
            )),
          card('引导风格', '决定引导模型输出的详细程度。',
            h('div', { className: 'nm-field' },
              h('span', null, '引导详细度'),
              h('select', { value: guidance.guidanceStyle, disabled: locked, 'aria-label': '引导风格', onChange: event => editGuidance('guidanceStyle', event.target.value) },
                h('option', { value: 'concise' }, '简明 (Concise) - 简短要点，适合经验丰富的写作模型'),
                h('option', { value: 'detailed' }, '详细 (Detailed) - 完整大纲与细节要求（推荐）'),
                h('option', { value: 'verbose' }, '极详细 (Verbose) - 包含示例与参考，适合弱写作模型')
              )
            ),
            h('p', { className: 'nm-muted' }, '建议：Flash 模型使用"极详细"；GPT-4/Claude 使用"详细"；o1/DeepSeek-R1 使用"简明"。')),
          saveBar('guidance', '保存引导配置'))),
        panel('learning', form && !value.learning ? card('学习配置尚未就绪', '当前 Host 尚未提供学习配置，请重载插件或重启 DSH。') : form && h('form', { className: 'nm-stack', 'aria-label': '学习配置', onSubmit: saveLearning },
          card('让每次创作留下经验', '从小说任务的成功输出中总结经验，按工作目录与实际提供方 / 模型分别保存。', check('启用学习', 'enabled', learning, editLearning, '保存可查询的经验，不训练模型权重，也不收集任意聊天。'), h('div', { className: 'nm-grid' }, h('div', { className: 'nm-feature' }, check('自动生成摘要', 'autoSummarize', learning, editLearning, '小说任务完成后自动总结。')), h('div', { className: 'nm-feature' }, check('复用学习记录', 'reuse', learning, editLearning, '将同模型经验加入后续任务参考。')))),
          card('经验存储地点（自主选择）', '您可以自由指定学习资料存储在任意本地文件夹，支持相对路径或系统绝对路径。',
            h('div', { className: 'nm-field' },
              h('span', null, '学习存储目录'),
              h('div', { className: 'nm-path-box' },
                h('input', { type: 'text', value: learning.storageDir, disabled: locked, required: true, 'aria-label': '学习存储目录', placeholder: 'novel_learning 或 C:\\MyNovels\\learning', onChange: event => editLearning('storageDir', event.target.value) }),
                actionButton(picking ? '正在唤起选择器…' : '📁 浏览目录…', () => pickDirectory('learningStorageDir', ctx), locked || picking)
              )
            ),
            h('p', { className: 'nm-callout' }, '提示：点击【📁 浏览目录…】可通过桌面窗口自由挑选存储文件夹；不同目录与模型相互隔离，随时可自由更换。')
          ),
          card('学习总结维度自由定制（人设与写作方法）', '自由勾选您希望模型重点提炼与复用的创作经验维度。全不勾选时默认进行全局综合总结。',
            h('div', { className: 'nm-topic-grid' },
              ...LEARNING_TOPICS.map(topic => h('div', { className: 'nm-feature', key: topic.id },
                toggle(topic.label, activeTopics.includes(topic.id), () => toggleTopic(topic.id), topic.desc)
              ))
            ),
            h('p', { className: 'nm-muted', style: { marginTop: '8px' } }, `当前已选定 ${activeTopics.length} 个重点提炼维度${activeTopics.length === 0 ? '（全局综合提取模式）' : ''}。`)
          ),
          card('摘要生成模型与思考强度', '留空跟随被总结结果的来源模型；指定其他模型时仍保留原始归属。',
            h('div', { className: 'nm-stack' },
              renderModelSelect('从现有模型列表中选择', learning.summaryProvider, learning.summaryModel, (p, m) => { editLearning('summaryProvider', p); editLearning('summaryModel', m) }, true),
              renderReasoningSelect('摘要模型思考/推理强度 (Reasoning Effort)', learning.summaryReasoningEffort, val => editLearning('summaryReasoningEffort', val), learning.summaryProvider, learning.summaryModel),
              h('div', { className: 'nm-grid' },
                field('摘要生成提供方', 'summaryProvider', learning, editLearning, 'text', { placeholder: '留空跟随来源' }),
                field('摘要生成模型', 'summaryModel', learning, editLearning, 'text', { placeholder: '填写准确的 model ID' })
              )
            ),
            h('details', null, h('summary', null, '高级设置 · 输入与存储限额'), h('div', { className: 'nm-grid' }, field('学习输入字符上限', 'maxInputChars', learning, editLearning, 'number', { required: true, min: 1000, max: 24000, step: 1 }), field('学习记录上限', 'maxRecords', learning, editLearning, 'number', { required: true, min: 1, max: 10000, step: 1 }), field('学习冷却秒数', 'cooldownSeconds', learning, editLearning, 'number', { required: true, min: 0, max: 86400, step: 1 })), h('p', { className: 'nm-muted' }, '达到记录上限停止追加，不自动删除旧资料。')), saveBar('learning', '保存学习配置'))), activityPanel),
        panel('decision', form && !value.decision ? card('决策配置尚未就绪', '当前 Host 尚未提供决策配置，请重载插件或重启 DSH。') : form && h('form', { className: 'nm-stack', 'aria-label': '决策配置', onSubmit: saveDecision },
          card('为关键取舍增加第二种判断', '在剧情分岔与审校选择中，调用你指定的模型提供有依据的建议。', check('启用辅助决策', 'enabled', decision, editDecision, '返回选择、简短理由、置信度与人工复核要求。'), h('div', { className: 'nm-callout' }, '决策仅作建议；低置信度或调用失败时交回用户，永不授权删除或恢复操作。')),
          card('决策模型与思考强度', '明确指定已注册的模型路由，不根据名称推断模型能力。',
            h('div', { className: 'nm-stack' },
              renderModelSelect('从现有模型列表中选择', decision.provider, decision.model, (p, m) => { editDecision('provider', p); editDecision('model', m) }, false),
              renderReasoningSelect('决策模型思考/推理强度 (Reasoning Effort)', decision.reasoningEffort, val => editDecision('reasoningEffort', val), decision.provider, decision.model),
              h('div', { className: 'nm-grid' },
                field('决策提供方', 'provider', decision, editDecision, 'text', { placeholder: 'provider ID' }),
                field('决策模型', 'model', decision, editDecision, 'text', { placeholder: 'model ID' })
              )
            ),
            h('details', null, h('summary', null, '高级设置 · 推理与复核'), h('div', { className: 'nm-grid' }, field('决策推理强度', 'reasoningEffort', decision, editDecision, 'text', { placeholder: '留空使用模型默认值' }), field('最低决策置信度', 'minConfidence', decision, editDecision, 'number', { required: true, min: 0, max: 1, step: 0.01 }), field('决策超时毫秒', 'timeoutMs', decision, editDecision, 'number', { required: true, min: 1000, max: 120000, step: 1 })), h('p', { className: 'nm-muted' }, '推理强度需由所选模型支持。低于置信度阈值的结果须人工复核。')), saveBar('decision', '保存决策配置'))), h('div', { className: 'nm-callout' }, '手动发起：', h('code', { className: 'nm-inlinecode' }, '/novel-decide 问题 | 选项A | 选项B'))),
        
                      panel('research', form && h('form', { className: 'nm-stack', 'aria-label': '资料检索配置', onSubmit: saveResearch }, card('联网资料检索', '默认关闭。启用后通过 /novel-research 检索并保存来源报告。', check('启用资料检索', 'enabled', research, editResearch, '检索默认关闭，需选择模型并指定目录。')),
           card('检索模型和存储目录', '指定研究模型，并设置资料报告存储路径。', h('div', { className: 'nm-stack' },

             renderModelSelect('从现有模型列表中选择检索模型', research.provider, research.model, (p, m) => { editResearch('provider', p); editResearch('model', m) }, false),
             renderReasoningSelect('检索模型思考/推理强度 (Reasoning Effort)', research.reasoningEffort, val => editResearch('reasoningEffort', val), research.provider, research.model),
             h('div', { className: 'nm-grid' }, field('检索模型提供方', 'provider', research, editResearch, 'text', { placeholder: 'provider ID', required: research.enabled }), field('检索模型 ID', 'model', research, editResearch, 'text', { placeholder: 'model ID', required: research.enabled })),
             h('div', { className: 'nm-path-box' }, field('资料存储目录', 'storageDir', research, editResearch, 'text', { placeholder: 'novel_research 或绝对路径', required: true }), actionButton('📁 浏览目录…', () => pickDirectory('storageDir', ctx), locked)),
             h('div', { className: 'nm-grid' }, field('最多来源数', 'maxResults', research, editResearch, 'number', { min: 1, max: 10, step: 1 }), field('单来源字符上限', 'maxSourceChars', research, editResearch, 'number', { min: 1000, max: 24000, step: 1 }), field('检索超时毫秒', 'timeoutMs', research, editResearch, 'number', { min: 1000, max: 120000, step: 1 }))
           ), saveBar('research', '保存资料检索配置')))),

         panel('batch', form && h('form', { className: 'nm-stack', 'aria-label': '批量写作配置', onSubmit: saveBatch }, card('按次计费批量写作', '一次模型请求连续写多章，请求次数就是花费次数。', h('p', { className: 'nm-muted' }, '按次计费模型选这里。每批章数越多，请求次数越少；提供方与模型都留空时，使用本会话最近一次实际路由。')),
           card('模型与批量大小', '指定按次计费模型，并设置每次请求写几章。', h('div', { className: 'nm-stack' },
             renderModelSelect('从现有模型列表中选择批量写作模型', batchWrite.provider, batchWrite.model, (p, m) => { editBatch('provider', p); editBatch('model', m) }, false),
             renderReasoningSelect('批量写作思考/推理强度 (Reasoning Effort)', batchWrite.reasoningEffort, val => editBatch('reasoningEffort', val), batchWrite.provider, batchWrite.model),
             h('div', { className: 'nm-grid' }, field('批量写作提供方', 'provider', batchWrite, editBatch, 'text', { placeholder: '留空使用会话模型' }), field('批量写作模型 ID', 'model', batchWrite, editBatch, 'text', { placeholder: '留空使用会话模型' }), field('每次请求章数', 'chaptersPerRequest', batchWrite, editBatch, 'number', { required: true, min: 1, max: 37, step: 1 })),
             h('p', { className: 'nm-muted' }, '输出上限由模型自身决定。章数设得过大时模型可能提前截断，这种情况下该批不会写入任何文件，可调小后重试。')
           ), saveBar('batch', '保存批量写作配置')),
           h('div', { className: 'nm-callout' }, '手动发起：', h('code', { className: 'nm-inlinecode' }, '/novel-batch 项目名 60章 --每批20章 --auto')))),
         panel('persona', form && h('form', { className: 'nm-stack', 'aria-label': '作者人格配置', onSubmit: savePersona },
           card('拆书分析模型', '用 /novel-persona-study 分析参考作品，提炼成可套用的写作风格。整本参考作品都会发给这个模型，所以这一步才是真正费 token 的。',
             h('p', { className: 'nm-muted' }, '留空时使用本会话最近一次实际路由；在命令里写 --provider/--model 优先级更高。'),
             h('div', { className: 'nm-stack' },
               renderModelSelect('从现有模型列表中选择拆书模型', persona.provider, persona.model, (p, m) => { editPersona('provider', p); editPersona('model', m) }, false),
               renderReasoningSelect('拆书模型思考/推理强度 (Reasoning Effort)', persona.reasoningEffort, val => editPersona('reasoningEffort', val), persona.provider, persona.model),
               h('div', { className: 'nm-grid' }, field('拆书提供方', 'provider', persona, editPersona, 'text', { placeholder: '留空使用会话模型' }), field('拆书模型 ID', 'model', persona, editPersona, 'text', { placeholder: '留空使用会话模型' }))
             )),
           card('自然语言意图解析模型', '只用来听懂 /novel-persona-study 后面那句人话，比如「这本对话写得好，拼到《某书》上」。请求很短，几百 token 就结束。',
             h('p', { className: 'nm-muted' }, '单独配一档，是因为这件事跟拆书不是同一种能力：拆书要长文本分析，听懂一句话要的是对口语的理解，成本也差得远。留空则沿用上面的拆书模型。'),
             h('div', { className: 'nm-stack' },
               renderModelSelect('从现有模型列表中选择意图解析模型', personaIntent.provider, personaIntent.model, (p, m) => { editPersonaIntent('provider', p); editPersonaIntent('model', m) }, false),
               renderReasoningSelect('意图解析思考/推理强度 (Reasoning Effort)', personaIntent.reasoningEffort, val => editPersonaIntent('reasoningEffort', val), personaIntent.provider, personaIntent.model),
               h('div', { className: 'nm-grid' }, field('意图解析提供方', 'provider', personaIntent, editPersonaIntent, 'text', { placeholder: '留空沿用拆书模型' }), field('意图解析模型 ID', 'model', personaIntent, editPersonaIntent, 'text', { placeholder: '留空沿用拆书模型' })),
               h('p', { className: 'nm-muted' }, '规则能认全的说法不会调用模型，所以这一档只在必要时才花一次请求。')
             )),
           card('用法', '两档模型都留空也能用：只靠规则识别，认不出的说法会给出参数写法。',
             h('div', { className: 'nm-callout' }, h('code', { className: 'nm-inlinecode' }, '/novel-persona 项目名 wangyu-classic'), ' → 先建基础风格'),
             h('div', { className: 'nm-callout' }, h('code', { className: 'nm-inlinecode' }, '/novel-persona-study 参考.txt --只取 对话 --to 项目名'), ' → 只把对话这一维拼过来'),
             h('div', { className: 'nm-callout' }, h('code', { className: 'nm-inlinecode' }, '/novel-persona-study --list-models'), ' → 列出宿主里所有可用模型'),
             h('details', null, h('summary', null, '优先级与回退规则'),
               h('ul', { className: 'nm-muted' },
                 h('li', null, '命令行 --provider/--model 最高优先，当场指定的就该生效。'),
                 h('li', null, '意图解析：命令行 > 这一档设置 > 拆书设置 > 会话实际路由。'),
                 h('li', null, '拆书分析：命令行 > 拆书设置 > 会话实际路由。'),
                 h('li', null, '只填了提供方没填模型时，自动退回下一档，不会让命令失效。')
               ))),
           saveBar('persona', '保存作者人格配置')
         )),
         panel('image', imageSettingsCard),
        panel('updates', card('版本与更新', '按完整提交 SHA 安装，保留安装结果与代码重载结果。', h('div', { className: 'nm-three' }, ...[['当前运行', state?.running], ['磁盘安装', state?.disk], ['main 最新', state?.latest]].map(([label, info]) => h('div', { className: 'nm-metric', key: label }, h('span', null, label), h('strong', null, info?.version ?? (label === 'main 最新' ? '尚未检查' : '未知')), h('code', null, short(info?.commit))))),
          state?.latest && h('p', { className: 'nm-callout' }, state.updateAvailable === false ? '磁盘已是此提交。' : state.updateAvailable === null ? '本地提交未知，版本号相同不能证明代码相同。' : '发现可安装的提交。检查后拉取会锁定本次完整 SHA。'),
          h('div', { className: 'nm-row' }, actionButton(busy === 'check' ? '检查中…' : '检查更新', () => run('check'), locked, true), actionButton(busy === 'apply' ? '正在拉取并安装…' : '拉取此提交', () => run('apply'), locked || !state?.latest), (busy === 'apply' || state?.busy) && actionButton('取消安装', cancel, false)), state?.result && h('p', { className: 'nm-callout' }, `最近安装结果：${state.result.application}${state.result.codeReload ? `；代码重载：${state.result.codeReload.application}` : ''}`)),
          form && card('更新网络', '代理只影响更新检查；安装使用 DSH 插件管理器的网络设置。', h('form', { 'aria-label': '更新代理配置', onSubmit: event => { event.preventDefault(); save({ updateProxy: proxy.trim() }) } }, field('更新检查代理', 'proxy', { proxy }, (_, next) => { dirty.current.updateProxy = next !== (value.updateProxy ?? ''); setProxy(next) }, 'text', { placeholder: 'http://127.0.0.1:7897' }), h('p', { className: 'nm-muted' }, '留空使用代理环境变量或直连。'), saveBar('updateProxy', '保存更新代理'))),
          card('运行维护', '代码重载切换 Host 运行实例，刷新界面只重新加载浏览器页面。', h('div', { className: 'nm-row' }, actionButton('重载插件', () => run('reload'), locked || !state?.reloadSupported), actionButton('刷新界面', () => window.location.reload(), !!busy)), !state?.reloadSupported && h('p', { className: 'nm-muted' }, '当前运行实例未提供可用重载入口，需要时请重启 DSH。'))),
        toast && h('div', { className: 'nm-toast', role: 'status' }, toast),
        showTutorial && h('div', { className: 'nm-guide-overlay', onClick: closeGuide },
          h('div', { className: 'nm-guide-box nm-guide-wide', onClick: e => e.stopPropagation() },
            h('div', { className: 'nm-guide-header' },
              h('div', { className: 'nm-guide-icon' }, '📚'),
              h('h3', { className: 'nm-guide-title' }, '小说创作大师 · 功能总览'),
              h('button', { className: 'nm-guide-close', onClick: closeGuide, 'aria-label': '关闭' }, '✕')
            ),
            h('div', { className: 'nm-guide-content' },
              h('p', { className: 'nm-guide-intro' },
                '一站式 AI 长篇小说创作插件：从一句脑洞到一键完本，从世界观设定到可视化进度地图。',
                h('br'),
                '核心思路是「引导-写作分离」——强模型负责规划与审视，快模型负责落笔，人只做决定。'),

              /* ---------- 一、创作流水线 ---------- */
              h('div', { className: 'nm-guide-section' },
                h('div', { className: 'nm-guide-section-header' },
                  h('div', { className: 'nm-guide-section-icon' }, '🎯'),
                  h('h4', { className: 'nm-guide-section-title' }, '创作流水线：从脑洞到完本')
                ),
                h('div', { className: 'nm-guide-section-content' },
                  h('p', null, '每个命令都对应一个真实项目目录里的文件，随时可以手改，插件不会覆盖你的编辑。'),
                  h('ul', null,
                    h('li', null, '一键完本：给一句话脑洞 + 目标章节数，自动生成设定、人设、大纲、分卷、逐章写作、审校、伏笔回收'),
                    h('li', null, '智能续写：读取已有正文与设定，续写指定章数，自动延续文风与伏笔'),
                    h('li', null, '写单章：指定章节号重写或补写一章，自动带上前情提要'),
                    h('li', null, '拆书学习：把参考书拆成结构、节奏、写法样本，沉淀进学习库供后续复用'),
                    h('li', null, '审校/改写：按写作规范逐章质检，给出问题清单并可选自动改写')
                  )
                )
              ),

              /* ---------- 二、设定树面板（本次重点） ---------- */
              h('div', { className: 'nm-guide-section' },
                h('div', { className: 'nm-guide-section-header' },
                  h('div', { className: 'nm-guide-section-icon' }, '🌳'),
                  h('h4', { className: 'nm-guide-section-title' }, '设定树面板：四种进度视图')
                ),
                h('div', { className: 'nm-guide-section-content' },
                  h('p', null, '在会话右侧栏打开「设定树」页签，顶部可切换四个视图，全部由项目里的 Markdown 自动推导，无需额外维护。'),
                  h('ul', null,
                    h('li', null, h('strong', null, '图谱'), '：世界观为根、分卷章节为枝叶的自上而下树状图，一眼看清整本书的骨架'),
                    h('li', null, h('strong', null, '地图'), '：真正的领土地图——六边形地块拼成连续世界，地区之间共享边界、外围海岸线，地形决定底色（沙漠黄、雪原白、森林绿、山地灰、水域蓝、城邦米、地下紫、火山赭、沼泽橄榄、原野草绿），带指北针、比例尺与图例；点地块展开该地区详情与事件辐射图'),
                    h('li', null, h('strong', null, '时间轴'), '：事件按章号纵向排列，彩点颜色对应地区，分「背景·尾声」与「正文章节」两段，每条标注来源（大纲/剧情树/伏笔/世界时钟）与状态'),
                    h('li', null, h('strong', null, '列表'), '：传统缩进树，适合逐项核对文件与条目数量')
                  ),
                  h('p', { className: 'nm-guide-note' },
                    '地图会随剧情自动扩展：在 地区.md 里加一行，地图立即重新分区；事件多的地区地块会略微变大。')
                )
              ),

              /* ---------- 三、地图与事件数据从哪来 ---------- */
              h('div', { className: 'nm-guide-section' },
                h('div', { className: 'nm-guide-section-header' },
                  h('div', { className: 'nm-guide-section-icon' }, '🗺️'),
                  h('h4', { className: 'nm-guide-section-title' }, '地图与时间轴的数据来源')
                ),
                h('div', { className: 'nm-guide-section-content' },
                  h('p', null, '两个可选文件（没有也能用，有则更丰富）：'),
                  h('ul', null,
                    h('li', null, h('code', null, '地区.md'), '：表格 地区 | 方位 | 地形 | 说明 | 人物。方位决定在地图上的位置，地形决定地块颜色与地貌小图'),
                    h('li', null, h('code', null, '事件.md'), '：表格 事件 | 章号 | 地区 | 状态。章号写「第N章」；背景/尾声事件章号留空即可进对应分段')
                  ),
                  h('p', { className: 'nm-guide-note' },
                    '未填这两个文件时，插件会自动推导：地区回退到 设定.md 的「地理」分支，事件回退到 大纲 逐章、剧情树分岔点、伏笔埋设表、世界状态的世界时钟。'),
                  h('p', null, h('strong', null, '一键生成：'), '发送 ', h('code', null, '/novel-map'), '（可带项目名），让模型读设定/大纲/正文后写出上面两个表格——决定地图长相与时间轴内容。')
                )
              ),

              /* ---------- 四、全部命令速查 ---------- */
              h('div', { className: 'nm-guide-section' },
                h('div', { className: 'nm-guide-section-header' },
                  h('div', { className: 'nm-guide-section-icon' }, '⌨️'),
                  h('h4', { className: 'nm-guide-section-title' }, '命令速查')
                ),
                h('div', { className: 'nm-guide-section-content' },
                  h('div', { className: 'nm-guide-commands' },
                    ...[
                      ['/novel 脑洞 60章', '一键完本：全流程自动写完整本'],
                      ['/novel-continue 项目 20章', '智能续写：接续现有内容'],
                      ['/novel-chapter 项目 第5章', '写单章：指定章节重写/补写'],
                      ['/novel-outline 项目 [要求]', '大纲：分卷、逐章梗概、分岔点、高潮'],
                      ['/novel-cast 项目', '人设：角色档案与关系'],
                      ['/novel-map 项目 [要求]', '地图：生成 地区.md 与 事件.md，点亮地图与时间轴'],
                      ['/novel-world 项目', '世界：设定与规则体系'],
                      ['/novel-role 项目', '角色：查看当前角色状态'],
                      ['/novel-review 项目', '审校：按写作规范逐章质检'],
                      ['/novel-rewrite 项目', '改写：按审校意见重写'],
                      ['/novel-idea /novel-spark', '构思 / 灵感：选题与桥段发散'],
                      ['/novel-study 参考书', '拆书：结构、节奏、写法样本'],
                      ['/novel-stats 项目', '统计：字数、章节、完成度'],
                      ['/novel-export 项目', '导出：合并成整本'],
                      ['/novel-update check', '检查插件更新'],
                      ['/novel-update reload', '重载宿主代码（改插件后必做）']
                    ].map(([cmd, desc]) => h('div', { className: 'nm-guide-cmd', key: cmd },
                      h('code', null, cmd),
                      h('span', { className: 'nm-guide-cmd-desc' }, desc)
                    ))
                  )
                )
              ),

              /* ---------- 五、配置与架构 ---------- */
              h('div', { className: 'nm-guide-section' },
                h('div', { className: 'nm-guide-section-header' },
                  h('div', { className: 'nm-guide-section-icon' }, '⚙️'),
                  h('h4', { className: 'nm-guide-section-title' }, '配置要点')
                ),
                h('div', { className: 'nm-guide-section-content' },
                  h('ul', null,
                    h('li', null, h('strong', null, '引导-写作分离'), '：引导模型（分析/拆解/大纲）+ 写作模型（专注落笔），换用不同模型即可兼顾质量与成本'),
                    h('li', null, h('strong', null, '项目目录'), '：可在设置里指定 projectsDir；留空则用当前工作区的 novel_projects'),
                    h('li', null, h('strong', null, '命令开关'), '：每个命令都能单独启用/停用，避免占满输入框'),
                    h('li', null, h('strong', null, '学习总结'), '：自动沉淀每章要点，后续章节复用，越写越稳'),
                    h('li', null, h('strong', null, '代码重载'), '：改了插件源码后，设置页「运行维护」点重载，或发送 ', h('code', null, '/novel-update reload'), '；只刷新页面不会重载宿主')
                  )
                )
              ),

              /* ---------- 六、小贴士 ---------- */
              h('div', { className: 'nm-guide-section' },
                h('div', { className: 'nm-guide-section-header' },
                  h('div', { className: 'nm-guide-section-icon' }, '💡'),
                  h('h4', { className: 'nm-guide-section-title' }, '小贴士')
                ),
                h('div', { className: 'nm-guide-section-content' },
                  h('ul', null,
                    h('li', null, '所有产物都是普通 Markdown，随时可以手改；插件尊重你的编辑，不会悄悄覆盖'),
                    h('li', null, '地图上地区挤在一起时，调整 地区.md 的「方位」列（北/南/西/东/中/东北等）即可重新排布'),
                    h('li', null, '时间轴想更完整，就跑一次 ', h('code', null, '/novel-map'), ' 补齐 事件.md'),
                    h('li', null, '写不动的时候用 /novel-review 先体检，再决定改哪一章，比硬写省一半时间')
                  )
                )
              )
            ),
            h('div', { className: 'nm-guide-footer' },
              h('div', { className: 'nm-guide-footer-tip' },
                h('span', null, '💡'),
                h('span', null, '点击右上角 ? 可随时查看本页')
              ),
              h('button', { onClick: closeGuide }, '开始创作 →')
            )
          )
        ),
        h('footer', { className: 'nm-footer' }, '创作由你掌舵 · 功能按需开启 · 配置保存后生效'))
    }
    /* ---------- 设定树：右侧栏页签（世界观 / 人设 / 大纲 / 进度 树状视图） ---------- */
    const ATLAS_ID = 'dsh-novel-master/atlas'
    const ATLAS_KIND = 'novelAtlas'
    const ART_ID = 'dsh-novel-master/art'
    const ART_KIND = 'novelArt'

    function AtlasGlyph({ size = 16 } = {}) {
      return h('svg', {
        viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor',
        strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, className: 'nm-atlas-title-icon',
      },
        h('circle', { cx: 12, cy: 5, r: 2.2 }),
        h('circle', { cx: 5.5, cy: 12.5, r: 2.2 }),
        h('circle', { cx: 18.5, cy: 12.5, r: 2.2 }),
        h('circle', { cx: 5.5, cy: 19.5, r: 2.2 }),
        h('circle', { cx: 18.5, cy: 19.5, r: 2.2 }),
        h('path', { d: 'M12 7.4v2.4M12 9.8H6.2a.7.7 0 0 0-.7.7v1.2M12 9.8h5.8a.7.7 0 0 1 .7.7v1.2M5.5 14.9v2.4M18.5 14.9v2.4' }))
    }

    function AtlasRow({ node, expanded, toggle, depth }) {
      const children = Array.isArray(node.children) ? node.children : []
      const hasChildren = children.length > 0
      const open = expanded[node.id] ?? depth === 0
      return h('li', { className: 'nm-atlas-item' },
        h('button', {
          className: 'nm-atlas-row', type: 'button',
          style: { paddingLeft: `${8 + depth * 12}px` },
          'data-leaf': String(!hasChildren),
          'data-missing': String(node.missing === true),
          ...(hasChildren ? { 'aria-expanded': open, onClick: () => toggle(node.id, open) } : {}),
        },
          h('span', { className: 'nm-atlas-chevron' }, hasChildren ? (open ? '▾' : '▸') : '·'),
          h('span', { className: 'nm-atlas-label', title: node.label }, node.label),
          node.meta ? h('span', { className: 'nm-atlas-meta' }, node.meta) : null),
        hasChildren && open
          ? h('ul', { className: 'nm-atlas-level' },
            children.map((child) => h(AtlasRow, { key: child.id, node: child, expanded, toggle, depth: depth + 1 })))
          : null)
    }

    function atlasProgressCard(project) {
      const p = project.progress ?? {}
      const percent = p.percent ?? null
      return h('div', { className: 'nm-atlas-progress' },
        h('div', { className: 'nm-atlas-progress-head' },
          h('strong', null, `《${project.title ?? project.name}》`),
          h('span', { className: 'nm-atlas-meta' },
            p.goal ? `进度 ${p.last}/${p.goal} 章${percent === null ? '' : ` · ${percent}%`}` : `已写 ${p.chapters} 章 · 未设目标章数`)),
        h('div', {
          className: 'nm-atlas-bar', role: 'progressbar', 'aria-label': '写作进度',
          'aria-valuemin': 0, 'aria-valuemax': 100, ...(percent === null ? {} : { 'aria-valuenow': percent }),
        }, h('div', { className: 'nm-atlas-bar-fill', style: { width: `${percent ?? 100}%` } })),
        h('div', { className: 'nm-atlas-stats' },
          h('span', { className: 'nm-atlas-chip' }, `${((p.chars ?? 0) / 10000).toFixed(1)} 万字`),
          h('span', { className: 'nm-atlas-chip' }, `${p.chapters ?? 0} 章`),
          p.avg ? h('span', { className: 'nm-atlas-chip' }, `均 ${p.avg} 字/章`) : null,
          h('span', { className: 'nm-atlas-chip', 'data-warn': String((p.foreshadowOpen ?? 0) > 0) },
            `伏笔 ${p.foreshadowOpen ?? 0}/${p.foreshadowTotal ?? 0} 未回收`),
          h('span', { className: 'nm-atlas-chip' }, `剧情分岔 ${p.branches ?? 0}`),
          (p.missing ?? []).length
            ? h('span', { className: 'nm-atlas-chip', 'data-warn': 'true' }, `缺章 ${p.missing.join('、')}`)
            : null))
    }

    /* ---- 图谱视图：根在顶部一点，向下分化（每列一枝，瀑布式下钻） ---- */
    const GRAPH_COLORS = ['#6ea8fe', '#7bdcb5', '#f6c177', '#eb6f92', '#c4a7e7', '#9ccfd8', '#ea9a97', '#f2a65e']
    const GRAPH_COL = 178
    const GRAPH_ROW = 24
    const GRAPH_PAD = 14
    const GRAPH_ROOT_Y = 42
    const GRAPH_CAT_Y = 128
    const GRAPH_BANDS = 4

    const graphText = (text, max) => {
      const chars = [...String(text)]
      return chars.length > max ? `${chars.slice(0, max).join('')}…` : chars.join('')
    }

    /** 提升文档 H1 空壳（宿主旧数据可能没提升，前端容错）。 */
    const hoist = (nodes) => (nodes.length === 1 && (nodes[0].children ?? []).length > 0 ? nodes[0].children : nodes)

    /** 从上到下布局：根在顶部中央，八大主枝每行 4 列向下分化，列内瀑布式堆叠。 */
    function layoutGraph(groups, expanded, rootLabel) {
      const items = []
      const links = []
      const bands = []
      for (let i = 0; i < groups.length; i += GRAPH_BANDS) bands.push(groups.slice(i, i + GRAPH_BANDS))
      const width = GRAPH_PAD * 2 + Math.max(1, (bands[0]?.length ?? 1)) * GRAPH_COL
      const root = {
        node: { id: '__root', label: rootLabel, children: groups },
        depth: 0, branch: -1, x: width / 2, y: GRAPH_ROOT_Y, open: true, hidden: 0, bottom: GRAPH_ROOT_Y,
      }
      items.push(root)
      const place = (node, depth, branch, x, y, colRight) => {
        const open = depth === 0 ? true : (expanded[node.id] ?? depth <= 1)
        const children = open ? (node.children ?? []) : []
        const item = { node, depth, branch, x, y, open, colRight, hidden: (node.children ?? []).length - children.length }
        items.push(item)
        let cursor = y
        for (const child of children) {
          const childItem = place(child, depth + 1, branch, x + 15, cursor + GRAPH_ROW, colRight)
          links.push({ from: item, to: childItem })
          cursor = childItem.bottom
        }
        item.bottom = children.length ? cursor : y + GRAPH_ROW * 0.72
        return item
      }
      let bandTop = GRAPH_CAT_Y
      for (const band of bands) {
        let bandBottom = bandTop
        band.forEach((group, index) => {
          const colX = GRAPH_PAD + index * GRAPH_COL
          const cat = place(group, 1, index, colX + 12, bandTop, colX + GRAPH_COL - 10)
          links.push({ from: root, to: cat })
          if (cat.bottom > bandBottom) bandBottom = cat.bottom
        })
        bandTop = bandBottom + 66
      }
      return { items, links, width, height: bandTop + GRAPH_PAD }
    }

    function AtlasGraph({ project, groups, expanded, toggle }) {
      const progress = project.progress ?? {}
      const rootLabel = `《${project.title ?? project.name}》` +
        (progress.goal ? ` ${progress.last}/${progress.goal} 章` : ` ${progress.chapters} 章`)
      const { items, links, width, height } = layoutGraph(groups, expanded, rootLabel)
      return h('svg', {
        className: 'nm-atlas-svg', width, height,
        viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': '设定树图谱',
      },
          links.map((link, index) => {
            const { from, to } = link
            const color = to.branch >= 0 ? GRAPH_COLORS[to.branch % GRAPH_COLORS.length] : null
            const middle = (from.y + to.y) / 2
            const base = {
              fill: 'none', strokeWidth: from.depth === 0 ? 2.2 : 1.6,
              opacity: 0.62, strokeLinecap: 'round',
            }
            return h('path', {
              key: `link${index}`, className: 'nm-atlas-link',
              d: `M${from.x},${from.y + (from.depth === 0 ? 10 : 6)} C${from.x},${middle} ${to.x},${middle} ${to.x},${to.y - 6}`,
              ...(color ? { ...base, stroke: color } : { ...base, style: { stroke: 'var(--nm-accent)' } }),
            })
          }),
          items.map((item) => {
            const { node, depth, branch, x, y, open, hidden, colRight } = item
            const children = node.children ?? []
            const color = branch >= 0 ? GRAPH_COLORS[branch % GRAPH_COLORS.length] : null
            const budget = depth === 0 ? 22 : Math.max(5, Math.floor(((colRight ?? x + 130) - x - 24) / 11.9))
            const label = graphText(node.label, budget)
            const more = hidden > 0 ? ` +${hidden}` : ''
            const textStyle = {
              fill: depth === 0 ? 'var(--nm-accent)' : 'var(--nm-text)',
              fontSize: depth === 0 ? 13 : depth === 1 ? 12.2 : 11.5,
              fontWeight: depth <= 1 ? 650 : 400,
              paintOrder: 'stroke', stroke: 'var(--nm-bg)', strokeWidth: 3, strokeLinejoin: 'round',
            }
            return h('g', {
              key: node.id, className: 'nm-atlas-gnode', transform: `translate(${x},${y})`,
              ...(depth > 0 && children.length > 0
                ? { onClick: () => toggle(node.id, open), role: 'button', tabIndex: 0, onKeyDown: (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle(node.id, open) } } }
                : {}),
            },
              h('title', null, `${node.label}${node.meta ? ` · ${node.meta}` : ''}${hidden > 0 ? ` · 还有 ${hidden} 个子节点未展开` : ''}`),
              h('circle', {
                r: depth === 0 ? 8 : 5, strokeWidth: 2, stroke: 'var(--nm-bg)',
                ...(color ? { fill: color } : { style: { fill: 'var(--nm-accent)' } }),
              }),
              h('text', {
                ...(depth === 0
                  ? { x: 0, y: -18, textAnchor: 'middle' }
                  : { x: 11, y: 0, dominantBaseline: 'middle' }),
                style: textStyle,
              }, label),
              more ? h('text', {
                x: 13 + label.length * 11.9, y: 0, dominantBaseline: 'middle',
                style: { ...textStyle, fill: 'var(--nm-muted)', fontSize: 10 },
              }, more) : null)
          }))
    }

    /* ---- 地图视图：按方位铺地区块，点开看该地区的事件辐射图 ---- */
    const posCell = (pos) => {
      const text = String(pos ?? '')
      if (!/[东南西北]/u.test(text)) return text.includes('中') ? { row: 2, col: 2 } : null
      const row = /北/u.test(text) ? 1 : /南/u.test(text) ? 3 : 2
      const col = /西/u.test(text) ? 1 : /东/u.test(text) ? 3 : 2
      return { row, col }
    }

    /* ---- 地形：按 地区.md 的「地形」列（或说明文字）识别，生成地貌小图 ---- */
    const TERRAIN_KINDS = [
      { kind: 'volcano', label: '火山', words: /火山|熔岩/u },
      { kind: 'snow', label: '雪原', words: /雪|冰|寒|冻/u },
      { kind: 'desert', label: '沙漠', words: /沙漠|沙丘|荒漠|戈壁|沙海/u },
      { kind: 'ocean', label: '水域', words: /海|湖|河|江|湾|洋|水域/u },
      { kind: 'swamp', label: '沼泽', words: /沼|湿地|泥潭/u },
      { kind: 'cave', label: '地下', words: /洞|穴|窟|地下|深渊|矿|墓/u },
      { kind: 'island', label: '岛屿', words: /岛|群岛|半岛/u },
      { kind: 'city', label: '城邦', words: /城|都|镇|村|堡|宫|塔|市/u },
      { kind: 'forest', label: '森林', words: /林|森|树|丛林/u },
      { kind: 'mountain', label: '山地', words: /山|峰|岭|高原|峡谷|崖|谷地/u },
      { kind: 'plain', label: '原野', words: /原|野|草原|平原|牧场/u },
    ]

    const terrainOf = (region) => {
      const text = `${region?.terrain ?? ''} ${region?.desc ?? ''} ${region?.name ?? ''}`
      return TERRAIN_KINDS.find((entry) => entry.words.test(text)) ?? TERRAIN_KINDS[TERRAIN_KINDS.length - 1]
    }

    /** 程序化地貌小图（240x60 viewBox，纯 SVG，随卡片宽度裁切）。 */
    function TerrainArt({ kind }) {
      const scenes = {
        mountain: [
          h('rect', { key: 'sky', width: 240, height: 60, fill: '#8fb6d9' }),
          h('circle', { key: 'sun', cx: 198, cy: 15, r: 8, fill: '#ffd97a' }),
          h('polygon', { key: 'a', points: '0,60 44,16 88,60', fill: '#6b829e' }),
          h('polygon', { key: 'b', points: '52,60 118,8 184,60', fill: '#4a5f7d' }),
          h('polygon', { key: 'c', points: '150,60 196,24 240,60', fill: '#6b829e' }),
        ],
        snow: [
          h('rect', { key: 'sky', width: 240, height: 60, fill: '#cfe2f2' }),
          h('ellipse', { key: 'a', cx: 60, cy: 62, rx: 95, ry: 28, fill: '#f4f9ff' }),
          h('ellipse', { key: 'b', cx: 188, cy: 64, rx: 100, ry: 26, fill: '#e2edf8' }),
          h('polygon', { key: 't1', points: '30,58 42,30 54,58', fill: '#3c5a4a' }),
          h('polygon', { key: 't2', points: '196,58 206,36 216,58', fill: '#3c5a4a' }),
          ...[[40, 14], [92, 22], [150, 12], [212, 26], [122, 34]].map(([x, y], i) =>
            h('circle', { key: `s${i}`, cx: x, cy: y, r: 2, fill: '#ffffff' })),
        ],
        forest: [
          h('rect', { key: 'sky', width: 240, height: 60, fill: '#b9d9ae' }),
          h('ellipse', { key: 'g', cx: 120, cy: 66, rx: 170, ry: 26, fill: '#6f9c5f' }),
          ...[[24, 34], [56, 26], [92, 36], [148, 28], [184, 34], [218, 24]].map(([x, hgt], i) =>
            h('polygon', { key: `t${i}`, points: `${x - 11},58 ${x},${hgt} ${x + 11},58`, fill: i % 2 ? '#2c4f30' : '#38603a' })),
        ],
        desert: [
          h('rect', { key: 'sky', width: 240, height: 60, fill: '#f2d9a0' }),
          h('circle', { key: 'sun', cx: 62, cy: 16, r: 9, fill: '#fff1c2' }),
          h('ellipse', { key: 'a', cx: 70, cy: 62, rx: 115, ry: 24, fill: '#e0b06a' }),
          h('ellipse', { key: 'b', cx: 195, cy: 64, rx: 115, ry: 26, fill: '#c9944f' }),
        ],
        ocean: [
          h('rect', { key: 'sky', width: 240, height: 60, fill: '#a9d3e8' }),
          h('circle', { key: 'sun', cx: 204, cy: 14, r: 8, fill: '#fff1c2' }),
          h('rect', { key: 'sea', y: 34, width: 240, height: 26, fill: '#3f7fa6' }),
          h('path', { key: 'w1', d: 'M0,42 Q30,36 60,42 T120,42 T180,42 T240,42', fill: 'none', stroke: '#7fb6d6', strokeWidth: 2.4 }),
          h('path', { key: 'w2', d: 'M0,52 Q30,46 60,52 T120,52 T180,52 T240,52', fill: 'none', stroke: '#5c9cc4', strokeWidth: 2.4 }),
        ],
        swamp: [
          h('rect', { key: 'sky', width: 240, height: 60, fill: '#b9c49a' }),
          h('rect', { key: 'a', y: 38, width: 240, height: 22, fill: '#5d6b45' }),
          h('rect', { key: 'b', y: 47, width: 240, height: 13, fill: '#47522f' }),
          ...[36, 88, 150, 206].map((x, i) =>
            h('line', { key: `r${i}`, x1: x, y1: 40, x2: x + 3, y2: 22 - (i % 2) * 6, stroke: '#3a4426', strokeWidth: 2.4, strokeLinecap: 'round' })),
          ...[[64, 44], [124, 48], [186, 43]].map(([x, y], i) =>
            h('circle', { key: `b${i}`, cx: x, cy: y, r: 2.4, fill: '#8fa06a' })),
        ],
        city: [
          h('rect', { key: 'sky', width: 240, height: 60, fill: '#a8b2c4' }),
          ...[[16, 26, 24, 34], [46, 14, 28, 46], [80, 30, 20, 30], [106, 20, 26, 40], [138, 34, 18, 26], [162, 12, 28, 48], [196, 28, 24, 32]]
            .map(([x, y, w, hgt], i) =>
              h('rect', { key: `b${i}`, x, y, width: w, height: hgt, fill: i % 2 ? '#5b6474' : '#414a5c' })),
          ...[[52, 22], [58, 32], [170, 20], [178, 30], [122, 28], [206, 36]].map(([x, y], i) =>
            h('rect', { key: `w${i}`, x, y, width: 3, height: 3, fill: '#ffd97a' })),
        ],
        plain: [
          h('rect', { key: 'sky', width: 240, height: 60, fill: '#b7d9ef' }),
          h('ellipse', { key: 'c1', cx: 52, cy: 16, rx: 18, ry: 7, fill: '#ffffff', opacity: 0.8 }),
          h('ellipse', { key: 'c2', cx: 178, cy: 12, rx: 22, ry: 8, fill: '#ffffff', opacity: 0.8 }),
          h('ellipse', { key: 'a', cx: 62, cy: 62, rx: 115, ry: 24, fill: '#8fbb74' }),
          h('ellipse', { key: 'b', cx: 192, cy: 64, rx: 115, ry: 22, fill: '#77a761' }),
          ...[[30, 46], [88, 50], [150, 47], [212, 51]].map(([x, y], i) =>
            h('line', { key: `g${i}`, x1: x, y1: y, x2: x + 2, y2: y - 7, stroke: '#4f7d3f', strokeWidth: 2, strokeLinecap: 'round' })),
        ],
        cave: [
          h('rect', { key: 'sky', width: 240, height: 60, fill: '#4a4a5c' }),
          h('path', { key: 'arch', d: 'M52,60 C52,18 188,18 188,60 Z', fill: '#191922' }),
          h('polygon', { key: 's1', points: '84,22 90,38 96,22', fill: '#2c2c38' }),
          h('polygon', { key: 's2', points: '140,24 146,40 152,24', fill: '#2c2c38' }),
          h('circle', { key: 'glow', cx: 120, cy: 46, r: 8, fill: '#8a6fd1', opacity: 0.55 }),
        ],
        volcano: [
          h('rect', { key: 'sky', width: 240, height: 60, fill: '#c9a08c' }),
          h('polygon', { key: 'cone', points: '52,60 120,12 188,60', fill: '#6b4a3f' }),
          h('polygon', { key: 'lava', points: '113,18 127,18 142,60 98,60', fill: '#ff7a45' }),
          h('circle', { key: 'sm1', cx: 120, cy: 8, r: 5, fill: '#d8c7bd' }),
          h('circle', { key: 'sm2', cx: 133, cy: 4, r: 4, fill: '#d8c7bd' }),
        ],
        island: [
          h('rect', { key: 'sky', width: 240, height: 60, fill: '#a9d3e8' }),
          h('rect', { key: 'sea', y: 36, width: 240, height: 24, fill: '#3f7fa6' }),
          h('ellipse', { key: 'sand', cx: 120, cy: 42, rx: 66, ry: 12, fill: '#e0c98a' }),
          h('ellipse', { key: 'green', cx: 120, cy: 38, rx: 36, ry: 10, fill: '#7fae6a' }),
          h('path', { key: 'w', d: 'M8,50 Q20,46 32,50 T56,50', fill: 'none', stroke: '#7fb6d6', strokeWidth: 2 }),
        ],
      }
      const scene = scenes[kind] ?? scenes.plain
      return h('svg', {
        viewBox: '0 0 240 60', width: '100%', height: 52,
        preserveAspectRatio: 'xMidYMid slice', 'aria-hidden': true, style: { display: 'block' },
      }, scene)
    }

    function RegionSpoke({ events, color }) {
      const rowH = 22
      const list = events.slice(0, 30)
      const height = Math.max(1, list.length) * rowH + 16
      if (list.length === 0) return h('div', { className: 'nm-atlas-spoke nm-atlas-message' }, '该地区暂无事件记录。')
      return h('div', { className: 'nm-atlas-spoke' },
        h('svg', { width: '100%', height, viewBox: `0 0 300 ${height}`, role: 'img', 'aria-label': '地区事件图' },
          h('circle', { cx: 16, cy: height / 2, r: 6, fill: color }),
          list.map((event, index) => {
            const y = 16 + index * rowH
            return h('g', { key: event.id },
              h('path', {
                d: `M16,${height / 2} C84,${height / 2} 84,${y} 132,${y}`,
                fill: 'none', stroke: color, strokeWidth: 1.4, opacity: 0.5, strokeLinecap: 'round',
              }),
              h('circle', { cx: 136, cy: y, r: 3.5, fill: color }),
              h('text', {
                x: 146, y, dominantBaseline: 'middle',
                style: {
                  fill: 'var(--nm-text)', fontSize: 11,
                  paintOrder: 'stroke', stroke: 'var(--nm-bg)', strokeWidth: 3, strokeLinejoin: 'round',
                },
              }, `${event.chapter === null ? '背景 · ' : `第${event.chapter}章 · `}${graphText(event.title, 10)}`))
          })))
    }

    /* ---- 领土地图：六边形网格 + 加权 Voronoi，地区拼成连续地块并共享边界 ---- */
    const TERRAIN_FILL = {
      mountain: '#8e8b8f', snow: '#e6eef7', forest: '#4f7a4a', desert: '#dcbe86',
      ocean: '#3f7fa3', swamp: '#697d57', cave: '#6f6d80', city: '#a3937f',
      plain: '#8fb277', volcano: '#a46750', island: '#7fb0c4',
    }
    const HEX_R = 20
    const HEX_W = Math.sqrt(3) * HEX_R
    const MAP_COLS = 13
    const MAP_ROWS = 8
    const MAP_W = MAP_COLS * HEX_W + HEX_W / 2
    const MAP_H = MAP_ROWS * 1.5 * HEX_R + HEX_R / 2

    /* ── 真实地形图：确定性扰动 + 地形符号 ── */

    /** 确定性伪随机：同一坐标永远得到同一结果，重绘不会抖动。 */
    const hash2 = (x, y) => {
      const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
      return v - Math.floor(v)
    }

    /**
     * 顶点扰动。相邻六边形共享同一个顶点，用取整后的坐标做种子，
     * 保证共享顶点扰动结果一致——否则接缝处会裂开露出底色。
     */
    const warpPoint = (point, amplitude = 4.2) => {
      const kx = Math.round(point.x * 2)
      const ky = Math.round(point.y * 2)
      return {
        x: point.x + (hash2(kx, ky) - 0.5) * amplitude,
        y: point.y + (hash2(ky + 13.7, kx + 7.3) - 0.5) * amplitude,
      }
    }

    /** 扰动后的地块路径：不再是正六边形，而是有机的不规则多边形。 */
    const warpedHexPoints = (cx, cy) => hexCorners(cx, cy)
      .map((corner) => warpPoint(corner))
      .map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ')

    /** 平滑曲线路径：把一串点连成柔和的闭合轮廓（海岸线/边界用）。 */
    const smoothPath = (points) => {
      if (points.length < 3) return ''
      const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
      const first = mid(points[points.length - 1], points[0])
      let d = `M${first.x.toFixed(1)},${first.y.toFixed(1)}`
      for (let i = 0; i < points.length; i++) {
        const current = points[i]
        const next = points[(i + 1) % points.length]
        const end = mid(current, next)
        d += ` Q${current.x.toFixed(1)},${current.y.toFixed(1)} ${end.x.toFixed(1)},${end.y.toFixed(1)}`
      }
      return d + ' Z'
    }

    /** 单个地形符号（小尺寸，密集撒点形成纹理感）。 */
    const terrainSymbol = (kind, x, y, seed, color) => {
      const k = `s-${x.toFixed(1)}-${y.toFixed(1)}`
      if (kind === 'mountain') {
        const size = 4.6 + seed * 2.2
        return h('path', {
          key: k, d: `M${x - size},${y + size * 0.6} L${x},${y - size} L${x + size},${y + size * 0.6}`,
          fill: 'none', stroke: color, strokeWidth: 1.1, strokeLinejoin: 'round', opacity: 0.55,
        })
      }
      if (kind === 'forest') {
        return h('circle', { key: k, cx: x, cy: y, r: 2 + seed * 1.1, fill: color, opacity: 0.4 })
      }
      if (kind === 'desert') {
        return h('path', {
          key: k, d: `M${x - 5},${y} Q${x},${y - 2.4} ${x + 5},${y}`,
          fill: 'none', stroke: color, strokeWidth: 0.9, opacity: 0.45,
        })
      }
      if (kind === 'snow') {
        return h('path', {
          key: k, d: `M${x - 3.4},${y} L${x},${y - 2.6} L${x + 3.4},${y} L${x},${y + 1.8} Z`,
          fill: color, opacity: 0.35,
        })
      }
      if (kind === 'city') {
        return h('rect', {
          key: k, x: x - 1.6, y: y - 1.6, width: 3.2, height: 3.2,
          fill: 'none', stroke: color, strokeWidth: 1, opacity: 0.5,
        })
      }
      if (kind === 'ocean' || kind === 'island') {
        return h('path', {
          key: k, d: `M${x - 5},${y} q2.5,-1.8 5,0 q2.5,1.8 5,0`,
          fill: 'none', stroke: color, strokeWidth: 0.9, opacity: 0.4,
        })
      }
      if (kind === 'swamp') {
        return h('line', { key: k, x1: x - 3, y1: y, x2: x + 3, y2: y, stroke: color, strokeWidth: 1, opacity: 0.4 })
      }
      if (kind === 'volcano') {
        return h('circle', { key: k, cx: x, cy: y, r: 1.6 + seed, fill: color, opacity: 0.45 })
      }
      if (kind === 'cave') {
        return h('circle', { key: k, cx: x, cy: y, r: 1.4, fill: 'none', stroke: color, strokeWidth: 0.9, opacity: 0.5 })
      }
      return h('circle', { key: k, cx: x, cy: y, r: 1.2, fill: color, opacity: 0.28 })
    }

    /** 在区域内撒地形符号，形成真实地形图的纹理。 */
    const terrainTexture = (group, kind, regionIndex) => {
      const marks = []
      const palette = {
        mountain: 'rgba(46,42,48,0.72)', snow: 'rgba(120,140,165,0.6)', forest: '#26502c', desert: '#8a6a34',
        ocean: '#d8ecf5', swamp: '#3c4a2c', cave: '#cfd2e0', city: '#4a3b2a',
        plain: '#3d5a2a', volcano: '#5c2a1c', island: '#2f5a44',
      }
      const color = palette[kind] ?? palette.plain
      const density = kind === 'mountain' || kind === 'forest' ? 2 : 1
      group.forEach((cell, i) => {
        for (let n = 0; n < density; n++) {
          const a = hash2(regionIndex * 31 + i * 7 + n, 17.3)
          const b = hash2(i * 13 + n * 3, 41.7)
          const x = cell.x + (a - 0.5) * HEX_W * 0.66
          const y = cell.y + (b - 0.5) * HEX_R * 0.95
          marks.push(terrainSymbol(kind, x, y, a, color))
        }
        // 山地/雪山额外加等高线，这是真实地形图最标志性的元素
        if (kind === 'mountain' || kind === 'snow') {
          const ring = 6.5 + hash2(i, 9.1) * 4
          marks.push(h('ellipse', {
            key: `contour-${i}`, cx: cell.x, cy: cell.y, rx: ring, ry: ring * 0.66,
            fill: 'none', stroke: 'rgba(248,244,232,0.24)', strokeWidth: 0.65,
          }))
          marks.push(h('ellipse', {
            key: `contour2-${i}`, cx: cell.x, cy: cell.y - 0.6, rx: ring * 0.6, ry: ring * 0.4,
            fill: 'none', stroke: 'rgba(248,244,232,0.16)', strokeWidth: 0.55,
          }))
        }
      })
      return marks
    }

    const hexCenter = (row, col) => ({
      x: HEX_W / 2 + col * HEX_W + (row % 2 ? HEX_W / 2 : 0),
      y: HEX_R + row * 1.5 * HEX_R,
    })

    const hexCorners = (cx, cy) => Array.from({ length: 6 }, (_, i) => {
      const angle = (Math.PI / 180) * (60 * i - 90)
      return { x: cx + HEX_R * Math.cos(angle), y: cy + HEX_R * Math.sin(angle) }
    })

    const slotKey = (slot) => (slot ? `${slot.row}:${slot.col}` : 'none')

    /**
     * 两级分区：先按方位把画布切成「西/中/东 × 北/中/南」的区块，区块面积正比于
     * 该方向的地区数量；区块内部再等分成子格。这样每个地区面积相当、彼此接壤，
     * 又大致保留方位关系——新增地区只需加一行，地图自动重新分区。
     */
    const regionSeeds = (regions) => {
      const buckets = new Map()
      regions.forEach((region, index) => {
        const slot = posCell(region.pos) ?? { row: 2, col: 2 }
        const key = slotKey(slot)
        if (!buckets.has(key)) buckets.set(key, { slot, items: [] })
        buckets.get(key).items.push(index)
      })
      const zones = [...buckets.values()]

      const rowWeight = new Map()
      const colWeight = new Map()
      for (const zone of zones) {
        rowWeight.set(zone.slot.row, (rowWeight.get(zone.slot.row) ?? 0) + zone.items.length)
        colWeight.set(zone.slot.col, (colWeight.get(zone.slot.col) ?? 0) + zone.items.length)
      }
      const totalRows = [...rowWeight.values()].reduce((sum, value) => sum + value, 0)
      const totalCols = [...colWeight.values()].reduce((sum, value) => sum + value, 0)

      // 每一行/列在地图上占的纵向/横向比例
      const rowSpan = (row) => {
        let before = 0
        for (const r of [1, 2, 3]) {
          if (r === row) return { from: before / totalRows, to: (before + (rowWeight.get(r) ?? 0)) / totalRows }
          before += rowWeight.get(r) ?? 0
        }
        return { from: 0, to: 1 }
      }
      const colSpan = (col) => {
        let before = 0
        for (const c of [1, 2, 3]) {
          if (c === col) return { from: before / totalCols, to: (before + (colWeight.get(c) ?? 0)) / totalCols }
          before += colWeight.get(c) ?? 0
        }
        return { from: 0, to: 1 }
      }

      const seeds = new Array(regions.length)
      for (const zone of zones) {
        const rows = rowSpan(zone.slot.row)
        const cols = colSpan(zone.slot.col)
        const left = MAP_W * cols.from
        const right = MAP_W * cols.to
        const top = MAP_H * rows.from
        const bottom = MAP_H * rows.to
        const total = zone.items.length
        const cellsX = Math.max(1, Math.ceil(Math.sqrt(total)))
        const cellsY = Math.max(1, Math.ceil(total / cellsX))
        zone.items.forEach((index, k) => {
          const cx = k % cellsX
          const cy = Math.floor(k / cellsX)
          seeds[index] = {
            x: left + ((right - left) * (cx + 0.5)) / cellsX,
            y: top + ((bottom - top) * (cy + 0.5)) / cellsY,
          }
        })
      }
      return seeds
    }

    /** 加权 Voronoi 划分：事件多的地区占地更大（剧情推进 → 地图扩张）。 */
    const buildTerritory = (regions, counts) => {
      const seeds = regionSeeds(regions)
      // 权重上限压住，避免事件多的地区吞掉整张图；只做温和扩张
      const weights = regions.map((_, index) => 1 + Math.min(0.8, Math.sqrt(counts[index] ?? 0) / 7))
      const cells = []
      for (let row = 0; row < MAP_ROWS; row++) {
        for (let col = 0; col < MAP_COLS; col++) {
          const center = hexCenter(row, col)
          let best = 0
          let bestScore = Infinity
          for (let i = 0; i < seeds.length; i++) {
            const dx = center.x - seeds[i].x
            const dy = center.y - seeds[i].y
            const score = (dx * dx + dy * dy) / weights[i]
            if (score < bestScore) {
              bestScore = score
              best = i
            }
          }
          cells.push({ x: center.x, y: center.y, row, col, region: best })
        }
      }
      return cells
    }

    function AtlasMap({ project }) {
      const regions = project.regions ?? []
      const events = project.events ?? []
      const [openRegion, setOpenRegion] = useState('')
      // 地图底图：AI 生成并绑定到「地图」的图片，可切换显示
      const [showArt, setShowArt] = useState(true)
      const mapArt = (project.assets ?? []).find((item) => item.kind === 'map')
      const eventsFor = (name) => events.filter((event) => (event.region || '') === name)
      const unassigned = events.filter((event) => !event.region)
      if (regions.length === 0 && events.length === 0 && !(project.assets ?? []).some((item) => item.kind === 'map')) {
        return h('div', { className: 'nm-atlas-message' },
          '还没有地区/事件数据。在项目里建 地区.md（表格：地区 | 方位 | 地形 | 说明 | 人物）和 事件.md（表格：事件 | 章号 | 地区 | 状态），或在 设定.md 的「地理」分支下按地区分节，这里会自动画出地区领土地图。')
      }

      const counts = regions.map((region) => eventsFor(region.name).length)
      const cells = buildTerritory(regions, counts)
      const byRegion = regions.map((_, index) => cells.filter((cell) => cell.region === index))
      const keyOf = (x, y) => `${Math.round(x)}:${Math.round(y)}`
      const cellByKey = new Map(cells.map((cell) => [keyOf(cell.x, cell.y), cell]))

      // 相邻但归属不同 → 地区边界；没有邻居 → 海岸线
      const borderSeen = new Set()
      const borders = []
      const coast = []
      for (const cell of cells) {
        const corners = hexCorners(cell.x, cell.y)
        corners.forEach((corner, index) => {
          const next = corners[(index + 1) % 6]
          const midX = (corner.x + next.x) / 2
          const midY = (corner.y + next.y) / 2
          const neighbor = cellByKey.get(keyOf(cell.x + (midX - cell.x) * 2, cell.y + (midY - cell.y) * 2))
          const segment = { x1: corner.x, y1: corner.y, x2: next.x, y2: next.y }
          if (!neighbor) {
            coast.push(segment)
            return
          }
          if (neighbor.region === cell.region) return
          const seenKey = `${keyOf(midX, midY)}:${Math.min(cell.region, neighbor.region)}:${Math.max(cell.region, neighbor.region)}`
          if (borderSeen.has(seenKey)) return
          borderSeen.add(seenKey)
          borders.push(segment)
        })
      }

      const centroid = (index) => {
        const group = byRegion[index]
        if (group.length === 0) return { x: MAP_W / 2, y: MAP_H / 2 }
        const sum = group.reduce((acc, cell) => ({ x: acc.x + cell.x, y: acc.y + cell.y }), { x: 0, y: 0 })
        return { x: sum.x / group.length, y: sum.y / group.length }
      }

      const terrains = regions.map((region) => terrainOf(region))
      const legendKinds = [...new Set(terrains.map((terrain) => terrain.kind))]

      // ---- SVG 图层：先组装成数组，再一次性交给 h，避免深层嵌套出错 ----
      const layers = []
      // 海面：径向渐变底色 + 柔和波纹，营造地图纸张感
      layers.push(h('rect', { key: 'sea', x: 0, y: 0, width: MAP_W, height: MAP_H, fill: 'url(#nm-sea-grad)' }))
      for (let i = 0; i < 5; i += 1) {
        const ratio = 0.1 + i * 0.2
        const y = MAP_H * ratio
        layers.push(h('path', {
          key: 'sea-wave-' + i,
          d: 'M0,' + y.toFixed(0) + ' Q' + (MAP_W * 0.25).toFixed(0) + ',' + (y - 5).toFixed(0) + ' ' + (MAP_W * 0.5).toFixed(0) + ',' + y.toFixed(0) + ' T' + MAP_W.toFixed(0) + ',' + y.toFixed(0),
          fill: 'none', stroke: 'rgba(160,200,220,0.1)', strokeWidth: 1.2,
        }))
      }

      // 地块：扰动后的有机多边形 + 地形色 + 区域色薄染 + 地形符号
      regions.forEach((region, index) => {
        const terrainFill = TERRAIN_FILL[terrains[index].kind] ?? TERRAIN_FILL.plain
        const group = byRegion[index]
        const land = []
        group.forEach((cell) => {
          // 不描边：同地区相邻地块同色，连成完整大陆块，消除六边形拼贴感
          land.push(h('polygon', {
            key: 'land-' + cell.row + '-' + cell.col,
            points: warpedHexPoints(cell.x, cell.y),
            fill: terrainFill,
            stroke: 'none',
          }))
        })
        // 区域色薄染：区分势力范围，但不盖住地形色
        group.forEach((cell) => {
          land.push(h('polygon', {
            key: 'tint-' + cell.row + '-' + cell.col,
            points: warpedHexPoints(cell.x, cell.y),
            fill: GRAPH_COLORS[index % GRAPH_COLORS.length],
            opacity: openRegion === region.name ? 0.22 : 0.12,
            stroke: 'none',
          }))
        })
        // 地形纹理：山脊/树冠/沙脊等符号铺满区域
        land.push(h('g', { key: 'tex' }, ...terrainTexture(group, terrains[index].kind, index)))
        // 柔和起伏阴影：把整块陆地的轮廓描成半透明曲线，模拟地形的高低层次
        if (group.length > 2) {
          const outline = group.map((cell) => warpPoint(hexCorners(cell.x, cell.y)[0]))
          land.push(h('path', {
            key: 'relief', d: smoothPath(outline),
            fill: 'rgba(12,18,14,0.10)', stroke: 'rgba(250,246,235,0.10)', strokeWidth: 1,
            pointerEvents: 'none',
          }))
        }
        layers.push(h('g', {
          key: 'territory-' + index, style: { cursor: 'pointer' },
          onClick: () => setOpenRegion(openRegion === region.name ? '' : region.name),
        }, land))
      })

      // 地区边界：与地块共用扰动顶点，线条才不会和地块错位
      borders.forEach((segment, index) => {
        const a = warpPoint({ x: segment.x1, y: segment.y1 })
        const b = warpPoint({ x: segment.x2, y: segment.y2 })
        layers.push(h('line', {
          key: 'border-' + index, x1: a.x, y1: a.y, x2: b.x, y2: b.y,
          stroke: 'rgba(12,16,24,0.55)', strokeWidth: 1.9, strokeLinecap: 'round',
          strokeDasharray: '5 3',
        }))
      })
      // 海岸线：双描边（外圈深色 + 内圈浅色）模拟真实地图的海岸
      coast.forEach((segment, index) => {
        const a = warpPoint({ x: segment.x1, y: segment.y1 })
        const b = warpPoint({ x: segment.x2, y: segment.y2 })
        layers.push(h('line', {
          key: 'coast-outer-' + index, x1: a.x, y1: a.y, x2: b.x, y2: b.y,
          stroke: 'rgba(6,12,18,0.85)', strokeWidth: 3.4, strokeLinecap: 'round',
        }))
        layers.push(h('line', {
          key: 'coast-inner-' + index, x1: a.x, y1: a.y, x2: b.x, y2: b.y,
          stroke: 'rgba(200,225,235,0.5)', strokeWidth: 1.1, strokeLinecap: 'round',
        }))
      })
      regions.forEach((region, index) => {
        if (byRegion[index].length === 0) return
        const spot = centroid(index)
        const color = GRAPH_COLORS[index % GRAPH_COLORS.length]
        // 地图注记风格：名称用浅色衬底 + 深色描边，像纸图上的地名
        const labelGroup = []
        labelGroup.push(h('circle', { key: 'dot', cx: spot.x, cy: spot.y - 9, r: 2.6, fill: color, stroke: '#f4f7fb', strokeWidth: 1.1 }))
        labelGroup.push(h('text', {
          key: 'name', x: spot.x, y: spot.y + 7, textAnchor: 'middle',
          style: {
            fill: '#fdfcf7', fontSize: 11, fontWeight: 700, letterSpacing: '0.03em',
            paintOrder: 'stroke', stroke: 'rgba(10,14,20,0.9)', strokeWidth: 3.2, strokeLinejoin: 'round',
          },
        }, region.name))
        labelGroup.push(h('text', {
          key: 'count', x: spot.x, y: spot.y + 19, textAnchor: 'middle',
          style: {
            fill: 'rgba(253,252,247,0.82)', fontSize: 8.5,
            paintOrder: 'stroke', stroke: 'rgba(10,14,20,0.85)', strokeWidth: 2.8, strokeLinejoin: 'round',
          },
        }, counts[index] + ' 事件'))
        layers.push(h('g', {
          key: 'label-' + index, style: { cursor: 'pointer' },
          onClick: () => setOpenRegion(openRegion === region.name ? '' : region.name),
        }, labelGroup))
      })
      // 指北针：做成罗盘样式（双环 + 四向）
      layers.push(h('g', { key: 'compass', transform: 'translate(26,30)' },
        h('circle', { key: 'ring', cx: 0, cy: 0, r: 13, fill: 'rgba(10,16,24,0.42)', stroke: 'rgba(226,238,245,0.55)', strokeWidth: 1 }),
        h('circle', { key: 'ring2', cx: 0, cy: 0, r: 9.5, fill: 'none', stroke: 'rgba(226,238,245,0.28)', strokeWidth: 0.6 }),
        h('polygon', { key: 'needle', points: '0,-9.5 3.4,1.5 0,0 -3.4,1.5', fill: '#f4f7fb' }),
        h('polygon', { key: 'needle-s', points: '0,9.5 3.4,-1.5 0,0 -3.4,-1.5', fill: 'rgba(244,247,251,0.4)' }),
        h('text', {
          key: 'north', x: 0, y: -16, textAnchor: 'middle',
          style: { fill: '#f4f7fb', fontSize: 8.5, fontWeight: 700, paintOrder: 'stroke', stroke: 'rgba(8,12,18,0.85)', strokeWidth: 2.4 },
        }, '北')))
      // 比例尺：黑白交替分段，像地图上的标准比例尺
      const scaleGroup = []
      scaleGroup.push(h('rect', { key: 'bg', x: -6, y: -16, width: 108, height: 24, rx: 4, fill: 'rgba(10,16,24,0.36)' }))
      for (let seg = 0; seg < 4; seg += 1) {
        scaleGroup.push(h('rect', {
          key: 'seg-' + seg, x: seg * 22, y: -3, width: 22, height: 4,
          fill: seg % 2 === 0 ? 'rgba(244,247,251,0.9)' : 'rgba(10,16,24,0.75)',
        }))
      }
      scaleGroup.push(h('text', {
        key: 'txt', x: 44, y: -6, textAnchor: 'middle',
        style: { fill: 'rgba(244,247,251,0.9)', fontSize: 8 },
      }, '百里'))
      layers.push(h('g', {
        key: 'scale', transform: 'translate(' + (MAP_W - 112).toFixed(0) + ',' + (MAP_H - 14).toFixed(0) + ')',
      }, scaleGroup))
      // 图廓：细边框 + 四角刻线，收束画面
      layers.push(h('rect', {
        key: 'frame', x: 6, y: 6, width: MAP_W - 12, height: MAP_H - 12,
        fill: 'none', stroke: 'rgba(226,238,245,0.22)', strokeWidth: 1.2, rx: 2,
      }))
      layers.push(h('rect', {
        key: 'frame-in', x: 9.5, y: 9.5, width: MAP_W - 19, height: MAP_H - 19,
        fill: 'none', stroke: 'rgba(226,238,245,0.12)', strokeWidth: 0.7, rx: 1,
      }))
      // 暗角：压暗四周，让视觉聚焦在地图中心
      layers.push(h('rect', {
        key: 'vignette', x: 0, y: 0, width: MAP_W, height: MAP_H,
        fill: 'url(#nm-map-vign)', pointerEvents: 'none',
      }))

      const detail = (() => {
        const index = regions.findIndex((region) => region.name === openRegion)
        if (index < 0) return null
        const region = regions[index]
        const list = eventsFor(region.name)
        const color = GRAPH_COLORS[index % GRAPH_COLORS.length]
        return h('div', { className: 'nm-atlas-region', key: 'detail' },
          h('div', { className: 'nm-atlas-terrain' }, h(TerrainArt, { kind: terrains[index].kind })),
          h('div', { className: 'nm-atlas-region-meta' },
            h('span', { className: 'nm-atlas-swatch', style: { background: color } }),
            terrains[index].label, region.pos ? ' · ' + region.pos : '', ' · ' + list.length + ' 事件'),
          region.desc ? h('div', { className: 'nm-atlas-region-desc' }, region.desc) : null,
          region.people ? h('div', { className: 'nm-atlas-region-desc' }, '👤 ' + region.people) : null,
          h(RegionSpoke, { events: list, color }))
      })()

      const legend = h('div', { className: 'nm-atlas-legend' },
        legendKinds.map((kind) => {
          const label = TERRAIN_KINDS.find((entry) => entry.kind === kind)?.label ?? kind
          return h('span', { key: kind, className: 'nm-atlas-legend-item' },
            h('span', { className: 'nm-atlas-legend-swatch', style: { background: TERRAIN_FILL[kind] ?? TERRAIN_FILL.plain } }),
            label)
        }))

      const unassignedBlock = unassigned.length
        ? h('div', { key: '__unassigned', className: 'nm-atlas-region' },
          h('button', {
            type: 'button', className: 'nm-atlas-region-head', 'aria-expanded': openRegion === '__none',
            onClick: () => setOpenRegion(openRegion === '__none' ? '' : '__none'),
          },
            h('span', { className: 'nm-atlas-swatch', style: { background: 'var(--nm-muted)' } }),
            h('span', { className: 'nm-atlas-region-title-text' }, '未归类事件'),
            h('span', { className: 'nm-atlas-count' }, unassigned.length + ' 事件')),
          openRegion === '__none' ? h(RegionSpoke, { events: unassigned, color: 'var(--nm-muted)' }) : null)
        : null

      return h('div', { className: 'nm-atlas-world-wrap' },
        h('div', { className: 'nm-atlas-world-head' },
          h('span', { className: 'nm-atlas-world-title' }, '领土地图'),
          h('span', { className: 'nm-atlas-world-sub' },
            regions.length + ' 个地区 · ' + events.length + ' 条事件 · 新增地区/事件后自动扩展')),
        h('div', { className: 'nm-atlas-world' },
          h('svg', {
            viewBox: '0 0 ' + MAP_W.toFixed(0) + ' ' + MAP_H.toFixed(0), width: '100%',
            role: 'img', 'aria-label': '地区领土地图',
          },
            // defs：海面径向渐变 + 陆地暗角，做出纸图的立体感
            h('defs', { key: 'defs' },
              h('radialGradient', { key: 'sea-grad', id: 'nm-sea-grad', cx: '50%', cy: '45%', r: '75%' },
                h('stop', { key: 's0', offset: '0%', stopColor: '#31505f' }),
                h('stop', { key: 's1', offset: '60%', stopColor: '#243c49' }),
                h('stop', { key: 's2', offset: '100%', stopColor: '#182a34' })),
              h('radialGradient', { key: 'vign', id: 'nm-map-vign', cx: '50%', cy: '50%', r: '72%' },
                h('stop', { key: 'v0', offset: '55%', stopColor: 'rgba(0,0,0,0)' }),
                h('stop', { key: 'v1', offset: '100%', stopColor: 'rgba(0,0,0,0.34)' }))),
            // 底图优先：绑定了 AI 地图就铺在矢量层之下，矢量层半透明叠加
            mapArt && showArt
              ? h('image', {
                key: 'art-base', href: API + 'image/file/' + encodeURIComponent(project.name + '/' + mapArt.file),
                x: 0, y: 0, width: MAP_W, height: MAP_H,
                preserveAspectRatio: 'xMidYMid slice', opacity: 0.92,
              })
              : null,
            h('g', { key: 'layers', opacity: mapArt && showArt ? 0.34 : 1 }, layers)
          )
        ),
        mapArt
          ? h('div', { className: 'nm-atlas-artbar' },
            h('span', { className: 'nm-muted' }, '底图：' + mapArt.name),
            h('button', {
              type: 'button', className: 'nm-atlas-arttoggle',
              onClick: () => setShowArt(!showArt),
            }, showArt ? '只看底图' : '叠加矢量层'))
          : null,
        legend,
        detail,
        unassignedBlock)
    }

    /* ---- 时间轴视图：按章号纵向排布，颜色区分地区 ---- */
    function AtlasTimeline({ project }) {
      const regions = project.regions ?? []
      const events = project.events ?? []
      const colorOf = (regionName) => {
        const index = regions.findIndex((region) => region.name === regionName)
        return index >= 0 ? GRAPH_COLORS[index % GRAPH_COLORS.length] : 'var(--nm-muted)'
      }
      const background = events.filter((event) => event.chapter === null)
      const timed = events.filter((event) => event.chapter !== null).sort((a, b) => a.chapter - b.chapter)
      const row = (event) => h('div', { key: event.id, className: 'nm-atlas-trow' },
        h('span', { className: 'nm-atlas-tdot', style: { background: colorOf(event.region) } }),
        h('div', null,
          h('div', { className: 'nm-atlas-tline' },
            h('strong', null, event.chapter === null ? '背景' : `第${event.chapter}章`),
            h('span', { className: 'nm-atlas-ttitle' }, event.title)),
          h('div', { className: 'nm-atlas-tmeta' },
            h('span', { className: 'nm-atlas-chip' }, event.source),
            event.region ? h('span', { className: 'nm-atlas-chip' }, event.region) : null,
            event.status ? h('span', { className: 'nm-atlas-chip' }, event.status) : null)))
      return h('div', { className: 'nm-atlas-timeline' },
        h('div', { className: 'nm-atlas-trail' }),
        background.length ? h('div', { className: 'nm-atlas-tgroup' }, `背景 · 尾声（${background.length}）`) : null,
        background.map(row),
        timed.length ? h('div', { className: 'nm-atlas-tgroup' }, `正文章节（${timed.length}）`) : null,
        timed.map(row))
    }

    function AtlasBody(props) {
      const { sessionId } = props ?? {}
      const useSessionsHook = typeof props?.useSessions === 'function' ? props.useSessions : () => undefined
      const cwd = useSessionsHook((state) => (sessionId === undefined ? undefined : state?.byId?.[sessionId]?.cwd))
      const [data, setData] = useState(null)
      const [error, setError] = useState('')
      const [busy, setBusy] = useState(false)
      const [selected, setSelected] = useState('')
      const [expanded, setExpanded] = useState({})
      const [view, setView] = useState('graph')
      const alive = useRef(true)
      const toggle = (id, open) => setExpanded((prev) => ({ ...prev, [id]: !open }))
      const load = () => {
        setBusy(true)
        setError('')
        api(`atlas?cwd=${encodeURIComponent(cwd ?? '')}`)
          .then((payload) => {
            if (!alive.current) return
            setData(payload)
            setSelected((prev) => (prev && (payload.projects ?? []).some((p) => p.name === prev))
              ? prev
              : (payload.defaultProject ?? payload.projects?.[0]?.name ?? ''))
          })
          .catch((e) => { if (alive.current) setError(e?.message ?? String(e)) })
          .finally(() => { if (alive.current) setBusy(false) })
      }
      useEffect(() => { alive.current = true; load(); return () => { alive.current = false } }, [cwd])

      const projects = data?.projects ?? []
      const project = projects.find((p) => p.name === selected) ?? null
      const groups = []
      for (const section of project?.sections ?? []) {
        groups.push({
          id: `section/${section.key}`,
          label: `${section.label}（${section.file}）`,
          meta: section.exists ? `${section.headings} 项${section.truncated ? '+' : ''}` : '未创建',
          missing: !section.exists,
          children: hoist(section.nodes ?? []),
        })
      }
      if (project) {
        groups.push({
          id: 'section/chapters',
          label: '正文',
          meta: `${project.chapterList?.count ?? 0} 章`,
          children: project.chapterList?.nodes ?? [],
        })
      }

      const messages = [
        error ? h('div', { key: 'err', className: 'nm-atlas-message' }, `设定树读取失败：${error}`) : null,
        !error && data?.error ? h('div', { key: 'api', className: 'nm-atlas-message' }, data.message ?? data.error) : null,
        !error && data && !data.error && !project
          ? h('div', { key: 'empty', className: 'nm-atlas-message' },
            '还没有小说项目。用 /novel 或 /novel-idea 立项后，这里会以树状图展示世界观、人设、大纲、伏笔与写作进度。')
          : null,
      ]
      return h('div', { className: 'nm-atlas' },
        // 样式随面板自身挂载：设置页此前是唯一的样式注入点，面板独立渲染时
        // 整张样式表都不存在（这就是图谱全黑的根因）。
        h('style', null, CSS),
        h('div', { className: 'nm-atlas-head' },
          h('select', {
            value: selected, 'aria-label': '选择小说项目（设定地图）',
            onChange: (event) => { setSelected(event.target.value); setExpanded({}) },
          }, projects.length === 0
            ? h('option', { value: '' }, '暂无项目')
            : projects.map((p) => h('option', { key: p.name, value: p.name }, `《${p.title ?? p.name}》`))),
          h('div', { className: 'nm-atlas-seg', role: 'group', 'aria-label': '视图切换' },
            [['graph', '图谱'], ['map', '地图'], ['time', '时间轴'], ['list', '列表']].map(([key, text]) =>
              h('button', {
                key, type: 'button', 'aria-pressed': view === key, onClick: () => setView(key),
              }, text))),
          h('button', { className: 'nm-atlas-refresh', type: 'button', onClick: load, disabled: busy },
            busy ? '读取中…' : '刷新')),
        h('div', { className: 'nm-atlas-graph' },
          ...messages,
          project ? atlasProgressCard(project) : null,
          project
            ? (view === 'graph'
              ? h(AtlasGraph, { project, groups, expanded, toggle })
              : view === 'map'
                ? h(AtlasMap, { project })
                : view === 'time'
                  ? h(AtlasTimeline, { project })
                  : h('ul', { className: 'nm-atlas-level' },
                    groups.map((group) => h(AtlasRow, { key: group.id, node: group, expanded, toggle, depth: 0 }))))
            : null))
    }

    function AtlasTitle(props) {
      const useTabInfoHook = typeof props?.useTabInfo === 'function' ? props.useTabInfo : () => null
      const info = useTabInfoHook()
      return h(React.Fragment, null, h(AtlasGlyph, { size: 16 }), info?.tab?.title ?? '设定树')
    }

    // ────────────────────────────────────────────────────────────
    // 生成进度：把「基础资产做齐了没」和「批量写作写到第几章」放在一屏
    //
    // 这里刻意不显示「模型正在写第几段」——插件拿不到宿主的流式事件，
    // 硬装成实时只会显示假数据。能做到并且可靠的是：每隔几秒重读一次
    // atlas，把文件真的出现了这件事告诉你。
    // ────────────────────────────────────────────────────────────
    const PROGRESS_ID = 'dsh-novel-master/progress'
    const PROGRESS_KIND = 'novelProgress'

    function ProgressGlyph({ size = 16 } = {}) {
      return h('svg', {
        viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor',
        strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, className: 'nm-progress-title-icon',
      },
        h('circle', { cx: 12, cy: 12, r: 8.5, opacity: 0.35 }),
        h('path', { d: 'M12 3.5a8.5 8.5 0 0 1 8.5 8.5', strokeWidth: 2.2 }),
        h('path', { d: 'M12 7.5V12l3 1.8' }))
    }

    /**
     * 世界地貌 —— 用真实等高线渲一张地形图。
     *
     * 前面几版都在追「像不像 Minecraft 的加载屏」，越追越糟：方块地图的
     * 表达力全在「像素密度」上，一旦画布只有三百来像素宽，密不起来就只剩
     * 彩色方格子。换个思路 —— 加载屏之所以好看，不是因为方块，是因为它
     * 把「世界正在成形」这件事变成了空间上的推进。
     *
     * 这里用地图学的正统做法：等高线 + 高程配色（hypsometric tint）。
     * 一条等值线代表一个高程，线越密坡度越陡，这是地形图一百多年没变的
     * 语言，天然带有「精确」的观感，而且矢量绘制不受分辨率限制。
     *
     * 进度语义换成「水位下降」：想象这块陆地原来沉在水下，随着内容写完，
     * 水位一点点退，地形逐层浮出水面。当前水面高度的等值线就是「世界已经
     * 长到哪儿」的前沿，用亮色描出来。
     *
     * 等高线用 marching squares 逐格求等值点再串成折线 —— 不是贴图，是算
     * 出来的。整张地形只算一次并缓存：它由确定性噪声决定，与进度无关，
     * 进度只决定「露出哪些层」。
     */
    const TERRA = { size: 84, levels: 12, cache: null, seed: '' }

    /**
     * 把设定资产摆到地图上，形成地形骨架。
     *
     * 之前的地形完全由噪声决定 —— 好看，但和这部小说没有任何关系：换个项目
     * 山形一样，写没写世界观也一样。既然已经有 `items`（每项资产的完成度）
     * 和地区名，就让它参与造山：
     *
     *   · 每项资产落到一个由**名字哈希**决定的固定位置。同一部小说每次打开
     *     山都在原地 —— 位置不能随刷新乱跳，否则用户没法靠地形记住进度。
     *   · 写得越完整（chars 越多），那一点越高，形成山峰；只写了个标题就是
     *     矮丘。于是「哪里有山」直接对应「哪部分设定写得厚」。
     *   · 相邻的山头之间用一条低矮的山脊连起来，避免各长各的变成一堆孤岛。
     *
     * 这是叠加在高程场上的偏置，不是替换：底噪仍然决定山体的细部走向，
     * 资产只决定大尺度的隆起位置。两者相加才不会看起来像贴了几个圆点。
     */
    function terraSites(items) {
      const list = Array.isArray(items) ? items : []
      const sites = []
      // 记录每个方位格子里已经放了几处，同格的地点要按黄金角错开
      const cellsTaken = new Map()
      const total = list.filter(Boolean).length || 1
      for (let index = 0; index < list.length; index++) {
        const item = list[index]
        if (!item) continue
        const key = String(item.name ?? item.key ?? item.id ?? '')
        if (!key) continue
        // 位置：按序号均匀铺在环上，再用名字散列微扰。
        //
        // 一开始纯用哈希定位，结果几个资产算出的坐标几乎重合 —— 它们的
        // 隆起叠成一大片高地，顶上平坦，等高线绕着平台边缘走，正中裂出
        // 一个巨大的空洞。均匀铺开后每个资产各占一方，既不会撞在一起，
        // 也符合「资产就是地图上的一个地点」这个直觉。
        // 微扰只负责让不同项目的同一序号不完全重合。
        let acc = 2166136261
        for (let i = 0; i < key.length; i++) {
          acc ^= key.charCodeAt(i)
          acc = Math.imul(acc, 16777619) >>> 0
        }
        const jitter = ((acc % 1000) / 1000 - 0.5)
        const angle = (index / total) * Math.PI * 2 + jitter * 0.55
        // 半径在 0.38–0.60 之间。这个区间比看上去要紧：范围放宽到
        // 0.34–0.62 时，两个相邻序号可能一个贴内圈一个贴外圈，
        // 角度又恰好靠近，实测最近间距掉到 0.14，隆起连成一片。
        // 收窄之后相邻山头始终有足够的角向余量。
        const radius = 0.38 + (((acc >>> 11) % 1000) / 1000) * 0.22
        // 有方位词就按方位词摆，序号只负责在同方位的几个地点之间错开。
        //
        // 「白塔在平原中央」「深渊裂谷在极北」这类句子本来就写清了相对位置，
        // 按序号均匀铺等于把这层信息扔掉，然后再由哈希随机决定 —— 图上是
        // 散的，读者却对不上原文。方位词只用 9 个格子，同格内的地点再按
        // 序号在格子里散开，既守住语义又不会重叠。
        const cell = posCell(item.pos)
        let x; let y
        if (cell) {
          // posCell 给的是 1..3 的格号：1=北/西，2=中，3=南/东。
          // 换算成画布比例时，1→0.18、2→0.5、3→0.82，
          // 让地点落在格子中部而不是贴着画布边缘。
          const toRatio = (n) => (n - 1) * 0.32 + 0.18
          const gridX = toRatio(cell.col)
          const gridY = toRatio(cell.row)
          // 同一格子里可能有多个地点，用序号算一个小偏移（半径 0.09 内）
          const sameCell = cellsTaken.get(`${cell.row}:${cell.col}`) ?? 0
          cellsTaken.set(`${cell.row}:${cell.col}`, sameCell + 1)
          const spread = 0.09
          const slotAngle = sameCell * 2.399963 // 黄金角，第 n 个点分布最匀
          const push = sameCell === 0 ? 0 : spread * Math.min(1, sameCell / 3)
          x = gridX + Math.cos(slotAngle) * push
          y = gridY + Math.sin(slotAngle) * push
        } else {
          x = (Math.cos(angle) * radius + 1) / 2
          y = (Math.sin(angle) * radius + 1) / 2
        }
        // 体量：有字数按字数，没有就按 done 标记。封顶在 1。
        //
        // 地区没有「正文字数」，它的厚度取说明写得多细 —— 一句「主舞台，
        // 四族共存」和一段「建在源质最浓的平原中央，塔身由白曜石砌成」，
        // 后者显然写得更多，山头也该更高。所以地区把 desc 长度塞进 chars，
        // 在这里走同一条曲线，不用为地区单开一套参数。
        const mass = Math.max(0, Math.min(1, Number(item.chars) > 0
          ? Math.log10(1 + Number(item.chars)) / 3.2
          : item.done ? 0.55 : 0.12))
        // 一点保底高度：地区都写出来了却因为说明太短而完全看不见，会让人
        // 以为地名丢了。0.18 的起跳刚好比海岸线高一线，看得见又不抢山。
        const heightBoost = item.pos !== undefined || item.terrain !== undefined ? 0.12 : 0
        sites.push({
          key,
          // 用上面算好的位置：有方位词走格子，没有就按序号铺
          x,
          y,
          // 影响半径压得比较小（0.11–0.17）。给大了相邻山头会连成一片，
          // 又会退回「中间是平台」的老问题。
          reach: 0.11 + mass * 0.06,
          height: Math.min(1, 0.18 + mass * 0.62 + heightBoost),
          // 地区可以带方位词，摆位时优先按它来，而不是纯按序号
          pos: item.pos,
        })
      }
      return sites
    }

    /** 高斯隆起：距离中心越近越高，到 reach 处衰减到 0。 */
    function terraBump(site, u, v) {
      const dx = u - site.x
      const dy = v - site.y
      const d2 = (dx * dx + dy * dy) / (site.reach * site.reach)
      if (d2 >= 1) return 0
      // (1-d²)² 在边缘一阶导为零，接缝不会出现折痕
      const falloff = 1 - d2
      return site.height * falloff * falloff
    }

    /** 确定性哈希。面板每 4 秒轮询，非确定性的场会让整张图每次刷新都重排。 */
    function terraHash(x, y) {
      const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
      return s - Math.floor(s)
    }
    function terraSmooth(t) { return t * t * (3 - 2 * t) }
    function terraNoise(x, y) {
      const xi = Math.floor(x); const yi = Math.floor(y)
      const u = terraSmooth(x - xi); const v = terraSmooth(y - yi)
      const a = terraHash(xi, yi); const b = terraHash(xi + 1, yi)
      const c = terraHash(xi, yi + 1); const d = terraHash(xi + 1, yi + 1)
      return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v
    }

    /** 高程色阶：低处冷而暗（水下/滩涂），高处提亮偏白（山脊），整体压低饱和度。 */
    const TERRA_RAMP = [
      [0.00, [36, 52, 70]],
      [0.28, [58, 88, 112]],
      [0.55, [104, 143, 172]],
      [0.78, [168, 200, 222]],
      [1.00, [226, 240, 250]],
    ]
    function terraColor(t) {
      const stops = TERRA_RAMP
      for (let i = 1; i < stops.length; i++) {
        if (t <= stops[i][0]) {
          const [t0, c0] = stops[i - 1]; const [t1, c1] = stops[i]
          const k = t1 === t0 ? 0 : (t - t0) / (t1 - t0)
          const rgb = c0.map((v, j) => Math.round(v + (c1[j] - v) * k))
          return `rgb(${rgb[0]} ${rgb[1]} ${rgb[2]})`
        }
      }
      const last = stops[stops.length - 1][1]
      return `rgb(${last[0]} ${last[1]} ${last[2]})`
    }

    /**
     * 对一层高程求等值线，返回 SVG path 的 d 串。
     *
     * marching squares：每个小方格的四个角与等值比较，得出 16 种穿越形态，
     * 在边上线性插值求出交点。相邻格共用同一条边，插值参数完全相同，
     * 所以端点能逐位相等 —— 后面才能用字符串键把线段接成折线。
     */
    function terraContour(field, n, level) {
      const at = (x, y) => field[y * n + x]
      const segs = []
      for (let y = 0; y < n - 1; y++) {
        for (let x = 0; x < n - 1; x++) {
          const v0 = at(x, y); const v1 = at(x + 1, y)
          const v2 = at(x + 1, y + 1); const v3 = at(x, y + 1)
          let idx = 0
          if (v0 >= level) idx |= 1
          if (v1 >= level) idx |= 2
          if (v2 >= level) idx |= 4
          if (v3 >= level) idx |= 8
          if (idx === 0 || idx === 15) continue
          // 四条边上的交点。分母为 0（两侧等高）时取边中点，避免 NaN。
          //
          // 这四条插值必须严格对称，否则相邻格在公共边上算出的交点对不齐，
          // 线段就接不起来。此前 left 写成
          //   [x, y + 1 + (level - v3) / (v0 - v3)]
          // 既多加了 +1 又把斜率方向用反了，左侧交点整体下偏一格：
          // 实测 344 个端点里 216 个是孤立的，等高线全断成短笔。
          // 左边正确的参数化是从 (x, y+1) 沿 y 负方向走 t，
          //   t = (level - v3) / (v0 - v3)  ⇒  y = y + 1 - t
          const top = [x + (v1 === v0 ? 0.5 : (level - v0) / (v1 - v0)), y]
          const right = [x + 1, y + (v2 === v1 ? 0.5 : (level - v1) / (v2 - v1))]
          const bottom = [x + (v2 === v3 ? 0.5 : (level - v3) / (v2 - v3)), y + 1]
          const left = [x, y + 1 - (v0 === v3 ? 0.5 : (level - v3) / (v0 - v3))]
          const push = (a, b) => segs.push([a[0], a[1], b[0], b[1]])
          switch (idx) {
            case 1: case 14: push(left, top); break
            case 2: case 13: push(top, right); break
            case 3: case 12: push(left, right); break
            case 4: case 11: push(right, bottom); break
            case 6: case 9: push(top, bottom); break
            case 7: case 8: push(left, bottom); break
            // 5 与 10 是鞍点，两条线可能交叉，需要用中心值决定连法。
            case 5: {
              const mid = (v0 + v1 + v2 + v3) / 4
              if (mid >= level) { push(left, bottom); push(top, right) }
              else { push(left, top); push(right, bottom) }
              break
            }
            case 10: {
              const mid = (v0 + v1 + v2 + v3) / 4
              if (mid >= level) { push(left, top); push(right, bottom) }
              else { push(left, bottom); push(top, right) }
              break
            }
            default: break
          }
        }
      }
      if (segs.length === 0) return ''

      // 把散线段按端点接成折线。
      //
      // 这里有个必须做对的地方：marching squares 产出的线段是无向的，
      // 同一条等值线上的相邻两段，可能一段是 A→B、另一段是 B→A。
      // 早先的版本只用「当前段终点」去找下一段，遇到反向的那一半就断了 ——
      // 结果是 788 条折线里有 705 条只有 2 个点（89.5% 碎线），
      // 等高线渲出来全是短促的断笔。必须两个方向都能接。
      //
      // 端点键取到千分位：相邻格共用同一条边，插值参数逐位相同，
      // 所以能精确对上；用 toFixed 反而会被浮点数格式化截断。
      const key = (x, y) => `${Math.round(x * 1000)}:${Math.round(y * 1000)}`
      const endsAt = new Map()
      const link = (k, i) => {
        if (!endsAt.has(k)) endsAt.set(k, [])
        endsAt.get(k).push(i)
      }
      for (let i = 0; i < segs.length; i++) {
        link(key(segs[i][0], segs[i][1]), i)
        link(key(segs[i][2], segs[i][3]), i)
      }
      const other = (i, k) => {
        // 取同一段线段的另一个端点，用于「反向续接」
        const s = segs[i]
        return key(s[0], s[1]) === k ? [s[2], s[3]] : [s[0], s[1]]
      }
      const used = new Uint8Array(segs.length)
      const parts = []

      for (let i = 0; i < segs.length; i++) {
        if (used[i]) continue
        used[i] = 1
        // 以线段 i 为种子，向两端各长一次，最后整体反转前半段拼起来。
        const forward = [[segs[i][0], segs[i][1]], [segs[i][2], segs[i][3]]]
        let tail = key(segs[i][2], segs[i][3])
        const head = [segs[i][0], segs[i][1]]
        for (;;) {
          const next = (endsAt.get(tail) ?? []).find((j) => !used[j])
          if (next === undefined) break
          used[next] = 1
          const p = other(next, tail)
          forward.push(p)
          tail = key(p[0], p[1])
        }
        // 再往种子起点那侧长
        let backKey = key(head[0], head[1])
        const backward = []
        for (;;) {
          const prev = (endsAt.get(backKey) ?? []).find((j) => !used[j])
          if (prev === undefined) break
          used[prev] = 1
          const p = other(prev, backKey)
          backward.push(p)
          backKey = key(p[0], p[1])
        }
        const pts = backward.reverse().concat(forward)
        if (pts.length < 2) continue
        parts.push('M' + pts.map((p) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join('L'))
      }
      return parts.join('')
    }

    /** 一次性算出地形与全部高程层，之后只按进度决定露哪些层。 */
    function terraLayers(items) {
      // 缓存必须把「资产指纹」算进去。地形现在由 items 决定，只按空缓存判断
      // 的话，写完一章再回来山还是旧形状 —— 那正是这次要修的问题。
      const sites = terraSites(items)
      const seed = sites.map(s => `${s.key}:${s.height.toFixed(2)}`).join('|') || 'bare'
      if (TERRA.cache && TERRA.seed === seed) return TERRA.cache
      TERRA.seed = seed
      const n = TERRA.size
      const field = new Float32Array(n * n)
      let peak = 0
      let peakAt = n * n >> 1
      for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
          // 域扭曲（domain warp）：先把采样点本身用两层低频噪声推开，再取
          // 高程。不做这一步，fBm 出来的等高线是一圈套一圈的洋葱 —— 前两版
          // 都是同心环。推一下之后山脊会弯、会分叉、会出现鞍部，才有地形感。
          const wx = x + 34 * (terraNoise(x / 19 + 5.2, y / 19 + 1.3) - 0.5)
          const wy = y + 34 * (terraNoise(x / 19 + 9.7, y / 19 + 4.8) - 0.5)
          // 五层八度。振幅衰减要慢（0.58）—— 衰减太快时高频几乎不出力，
          // 地形就成了一个大缓坡；衰减太慢又会变成满屏椒盐。0.58 配五次
          // 叠加，山体上既有大起伏也有支脉。
          let amp = 1; let freq = 1 / 34; let sum = 0; let norm = 0
          for (let o = 0; o < 5; o++) {
            sum += amp * terraNoise(wx * freq + o * 17.3, wy * freq + o * 31.7)
            norm += amp
            amp *= 0.58
            freq *= 2.11
          }
          // 边缘软掩膜。陆地必须收在画面内，等高线才全是闭合环。
          //
          // 但掩膜本身不能用纯径向 —— 那等于把整个场乘上一个圆锥，等值线
          // 收到边界时必然收成同心圆，外围看着像洋葱。前三版都是这个毛病。
          // 解法是先把半径本身用噪声推歪：r 不再等于到中心的距离，而是一条
          // 被扰动的「海岸线半径」，于是陆地边缘呈半岛与海湾状，边界那一圈
          // 等高线自然跟着歪。
          const nx = (x / (n - 1)) * 2 - 1
          const ny = (y / (n - 1)) * 2 - 1
          const ang = Math.atan2(ny, nx)
          // 极坐标下取两层噪声，形成连续但不重复的海岸形状。
          const coast = 0.20 * (terraNoise(Math.cos(ang) * 1.9 + 11, Math.sin(ang) * 1.9 + 7) - 0.5) * 2
            + 0.12 * (terraNoise(Math.cos(ang) * 4.1 + 23, Math.sin(ang) * 4.1 + 19) - 0.5) * 2
          const r = Math.hypot(nx, ny) + coast * 0.42
          const edge = 1 - terraSmooth(Math.min(1, Math.max(0, (r - 0.52) / 0.46)))
          const raw = sum / norm
          // 把噪声归一到 0–1 后再乘掩膜，幅度才稳定。幂次略大于 1，
          // 低处（浅滩）因此更平缓，等高线在岸边疏、在山腰密。
          let h = Math.pow(Math.max(0, Math.min(1, (raw - 0.16) / 0.66)), 1.15) * edge
          // 叠加资产隆起。
          //
          // 这一步前后试错三次，值得记下来：
          // ① 权重 0.66 —— 浅资产的隆起（0.18–0.44）压不过底噪的峰（0.84），
          //    「空项目」和「写了三项」画出来一模一样，看着像没生效。
          // ② Math.min(1, ...) 硬截断 —— 几个山头一起顶到 1.0，中间成为
          //    一片高程相同的平地，顶层等值线全挤到边缘，正中裂出巨大空洞。
          // ③ 软饱和（1-e^-x）—— 空洞小了一点，但还是平台，还是空洞。
          //
          // 症结在于「只要出现平台，等值线就会绕着平台走，平台内部空掉」。
          // 所以根本不该截断：先按无上限累加，循环结束后整场归一化。
          // 这样每一处都保留原本的起伏，量级问题交给最后那一次缩放解决。
          if (sites.length) {
            let lift = 0
            for (let s = 0; s < sites.length; s++) lift += terraBump(sites[s], x / (n - 1), y / (n - 1))
            if (lift > 0) h += lift * 1.6 * edge
          }
          field[y * n + x] = h
          if (h > peak) { peak = h; peakAt = y * n + x }
        }
      }

      // 整场归一到 0–1。隆起不设上限，最后统一缩放 —— 这样任何一处都
      // 不会因为「顶到天花板」而变成平台。
      if (peak > 1) {
        const scale = 1 / peak
        for (let i = 0; i < field.length; i++) field[i] *= scale
        peak = 1
      }

      // 高程层用「等面积分位」定阈值，而不是固定步长。
      // 固定步长在噪声分布上一头密一头疏；按分位取，每层覆盖的面积相当，
      // 等高线的疏密只反映坡度本身 —— 这才是地形图的读法。
      const sorted = Array.from(field).sort((a, b) => a - b)
      const nth = (q) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(q * sorted.length)))]
      const levels = []
      for (let i = 1; i <= TERRA.levels; i++) {
        const q = i / (TERRA.levels + 1)
        const t = nth(q)
        if (!(t > 0)) continue
        const d = terraContour(field, n, t)
        if (d) levels.push({ t, frac: q, d })
      }
      TERRA.peak = { x: peakAt % n, y: Math.floor(peakAt / n), h: peak }
      TERRA.cache = levels
      return levels
    }

    /**
     * 地名标注的避让。
     *
     * 山头位置由资产序号决定，两个相邻序号本来就挨得不远，标签一长就直接
     * 压在一起 —— 实测「世界状态」把「大纲」盖掉了，两个名字都读不出来。
     *
     * 做法是沿径向把过近的标签往外推：标签相对自己那个山头往外挪，
     * 挪到与已放置的标签都不冲突为止。只推标签不推标杆，标杆位置始终
     * 忠实反映山头 —— 那是数据，不能被排版挪动。
     *
     * 推不动了（推到画布边缘）就放弃这个标签，而不是硬挤着画。
     * 少一个名字，好过两个名字糊成一团。
     */
    function terraLabelLayout(sites, size, reach) {
      const placed = []
      const out = []
      // 所有标杆的位置都要预留出来 —— 文字不能盖住任何一个标杆。
      //
      // 之前的判定只比较「文字框之间」是否相交，于是「艾尔登维尔大陆」
      // 这几个字正好压在白塔的圆点上，把那个地点的标记整个盖掉了。
      // 标杆是数据，比文字重要，所以它必须先占位。
      const pins = sites.map((site) => ({ x: site.x * size, y: site.y * size }))
      // 标签的估算占位。字号 2.9，中文按一个字 2.9 宽算，再留两个字的余量
      const widthOf = (text) => 2.9 * Math.min(9, Math.max(2, String(text).length)) + 2
      for (const site of sites) {
        const label = String(site.label ?? site.key ?? '')
        if (!label) continue
        const cx = site.x * size
        const cy = site.y * size
        // 没探明的不标 —— 和等高线保持同一套「还没长出来」的语义
        if (Math.hypot(cx - size / 2, cy - size / 2) > reach + 1) continue
        // 往外推的方向：从画布中心指向该点。正好在中心时给个默认方向。
        let ux = cx - size / 2
        let uy = cy - size / 2
        const len = Math.hypot(ux, uy) || 1
        ux /= len; uy /= len
        const w = widthOf(label)
        const hgt = 3.6
        let best = null
        // 候选位置：先沿径向试，再试 8 个方向。
        //
        // 一开始只沿径向往外推，结果在中心附近的地点怎么推都往同一侧走 ——
        // 「艾尔登维尔大陆」正好横在一座塔的圆点上，把那个地点盖住了。
        // 单一方向在拥挤的地图上必然有解不开的死角，多给几个方向就能绕开。
        const directions = [[ux, uy]]
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2
          directions.push([Math.cos(a), Math.sin(a)])
        }
        outer:
        for (const [dx, dy] of directions) {
          for (let push = 0; push <= 16; push += 1.6) {
            const ax = cx + dx * push
            const ay = cy + dy * push
            // 文字从锚点向内侧展开，贴边时翻转锚点，避免被裁
            const flip = ax > size * 0.66
            const left = flip ? ax - w - 2.4 : ax + 2.4
            const box = { x1: left, y1: ay - hgt / 2, x2: left + w, y2: ay + hgt / 2 }
            // 出界就不考虑这个位置
            if (box.x1 < 0.5 || box.x2 > size - 0.5 || box.y1 < 0.5 || box.y2 > size - 0.5) continue
            const clash = placed.some((p) => box.x1 < p.x2 && box.x2 > p.x1 && box.y1 < p.y2 && box.y2 > p.y1)
            // 文字框碰到任何一个标杆也算冲突（留 1.2 的余量，别贴着圆点）
            const onPin = pins.some((pin) => pin.x > box.x1 - 1.2 && pin.x < box.x2 + 1.2
              && pin.y > box.y1 - 1.2 && pin.y < box.y2 + 1.2)
            if (!clash && !onPin) { best = { ax, ay, flip, box }; break outer }
          }
        }
        if (!best) continue
        placed.push(best.box)
        out.push({ key: site.key, label, cx, cy, ax: best.ax, ay: best.ay, flip: best.flip })
      }
      return out
    }

    function TerrainGlyph({ items, percent, project }) {
      const [saving, setSaving] = useState(false)
      const [saved, setSaved] = useState('')
      const [saveError, setSaveError] = useState('')
      const alive = useRef(true)
      useEffect(() => () => { alive.current = false }, [])
      const list = items ?? []
      const total = list.length
      const done = list.filter((i) => i.exists).length
      // 完成度：资产数与百分比取较大者，中途刷新时地貌不会倒退。
      const p = total > 0 ? Math.max(done / total, (percent ?? 0) / 100) : (percent ?? 0) / 100
      const pct = Math.min(1, Math.max(0, p))
      const complete = total > 0 && done >= total
      const peak = TERRA.peak ?? { x: TERRA.size / 2, y: TERRA.size / 2 }
      const S = TERRA.size
      // ---- 造山用的「地点」从哪来 ----
      //
      // 优先用项目里真实的地理设定（地区.md / 设定.md「地理」/ 世界状态.md「地理」）。
      // 没有地理设定时才退回按资产分山头。
      //
      // 之前一直用的是后者，于是地图上标的是「设定」「角色」「大纲」——
      // 那是文档名，不是地名。作者写了「白塔在源质最浓的平原中央」，
      // 图上却只会写「设定」，这张图就白画了。
      const regions = Array.isArray(project?.regions) ? project.regions : []
      const placeLike = regions
        .filter((region) => region && String(region.name ?? '').trim())
        .map((region) => ({
          name: String(region.name).trim(),
          desc: String(region.desc ?? '').trim(),
          pos: String(region.pos ?? '').trim(),
          terrain: String(region.terrain ?? '').trim(),
          // 后端推演好的气候直接带过来。前端不重算 —— 两处各算一套，
          // 迟早会出现「图上写着湿热、侧栏写着干旱」这种自相矛盾。
          climate: region.climate ?? null,
          // 地区的「厚」按说明写得多细算，而不是按正文字数 —— 地区没有字数
          chars: String(region.desc ?? '').length,
        }))
      const sites = terraSites(placeLike.length ? placeLike : list).map((site) => ({
        ...site,
        label: String(site.key).replace(/\.(md|txt|json)$/iu, ''),
      }))
      // 地形与标注必须用同一组地点，否则山和名字会错位
      const hills = placeLike.length ? placeLike : list
      const layers = terraLayers(hills)

      // 揭示半径：进度从中心向外扩张，把已经「写出来」的那一块显影。
      //
      // 之前两版的语义都错了：一版按高程水位（低处先出），一版 slice 前 N 层
      // （同样把最高的几层切掉）。两者都会在画面正中留下一个大空洞 —— 因为
      // 山峰恰恰是最高那层，最先被砍掉的就是它。
      //
      // 正确的心智模型是「一块已探明的地域在扩大」：地形本身完整存在，
      // 进度决定其中多大的范围被清楚地看见。半径用 sqrt 映射，让面积的
      // 增长与百分比同步 —— 线性映射半径时，前 20% 才覆盖 4% 的面积，
      // 观感上会显得「卡住不动」。
      const reach = Math.sqrt(pct) * S * 0.80
      // 标注的最终位置：避让、边界裁剪、未探明过滤都在这个函数里做
      const labelPlan = terraLabelLayout(sites, S, reach)

      /**
       * 把当前地形与地名交给后端落盘。
       *
       * 客户端只发「地名、位置、高度、等高线路径」，SVG 由服务端拼 ——
       * 让前端提交成品文件等于给这个接口开了个通用写文件口子。
       *
       * 只发已经探明的地名：没写完的资产在界面上没标，存下来也不该有。
       */
      async function saveMapAsset() {
        if (saving) return
        setSaving(true)
        setSaved('')
        setSaveError('')
        try {
          const projectName = project?.name ?? project?.project ?? ''
          if (!projectName) throw new Error('还没选中项目')
          const result = await api('atlas/map', {
            body: {
              project: projectName,
              cwd: project?.cwd ?? '',
              size: S,
              layers: layers.map((layer) => layer.d),
              sites: labelPlan.map((plan) => ({
                name: plan.label,
                x: plan.cx / S,
                y: plan.cy / S,
                height: (sites.find((site) => site.key === plan.key)?.height ?? 0.3),
              })),
            },
          })
          if (!alive.current) return
          if (result?.error) throw new Error(result.error)
          setSaved((result?.files ?? []).join('、') || '地图')
        } catch (error) {
          if (alive.current) setSaveError(String(error?.message ?? error))
        } finally {
          if (alive.current) setSaving(false)
        }
      }

      return h('div', { className: 'nm-terra', 'data-complete': complete ? '1' : '0' },
        h('div', { className: 'nm-terra-head' },
          h('span', { className: 'nm-terra-title' }, complete ? '世界已成形' : '世界生成中'),
          h('span', { className: 'nm-terra-pct' }, `${percent ?? 0}%`)),
        h('div', { className: 'nm-terra-canvas', role: 'img', 'aria-label': `地貌生成 ${percent ?? 0}%，${total} 项基础资产已完成 ${done} 项` },
          h('svg', {
            viewBox: `0 0 ${S} ${S}`,
            preserveAspectRatio: 'none',
            className: 'nm-terra-svg', 'aria-hidden': true,
          },
          // 遮罩：一块以画面中心为心、半径随进度扩张的圆。
          //
          // 这里踩过一个坑：最初把渐变放在遮罩内部（radialGradient 配
          // userSpaceOnUse 的圆），指望边缘有软过渡。但 radialGradient 给的是
          // objectBoundingBox 时，它的参照是那个小圆本身，半径越小渐变越失效，
          // 低进度下画布四角会冒出奇怪弧线。改成纯色圆 + 单独一层柔边圆环，
          // 行为跟半径无关，任何进度都稳定。
          h('mask', { id: 'nm-terra-reveal', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: S, height: S },
            h('circle', { cx: S / 2, cy: S / 2, r: Math.max(0.01, reach), fill: '#fff' })),
          // ---- 未探明的地形：极淡，只作为「还没长出来」的暗示 ----
          h('g', { opacity: 0.16 },
            layers.map((layer) => h('path', {
              key: `u${layer.t.toFixed(3)}`,
              d: layer.d, fill: 'none',
              stroke: terraColor(layer.frac * 0.6),
              strokeWidth: 0.2, strokeLinejoin: 'round',
            }))),
          // ---- 已探明的地形：走遮罩，两遍描出厚度 ----
          h('g', { mask: 'url(#nm-terra-reveal)' },
            layers.map((layer) => h('path', {
              key: `b${layer.t.toFixed(3)}`,
              d: layer.d, fill: 'none',
              stroke: terraColor(layer.frac * 0.5),
              strokeWidth: 0.66 - 0.3 * layer.frac,
              strokeLinejoin: 'round',
              opacity: 0.2 + 0.18 * layer.frac,
            })),
            layers.map((layer) => h('path', {
              key: `l${layer.t.toFixed(3)}`,
              d: layer.d, fill: 'none',
              stroke: terraColor(Math.min(1, layer.frac * 1.12 + 0.14)),
              strokeWidth: 0.28 - 0.13 * layer.frac,
              strokeLinejoin: 'round',
              opacity: 0.5 + 0.46 * layer.frac,
            }))),
          // 揭示边界本身：一圈亮环，就是「世界已经长到哪儿」。
          !complete && reach > 0.5 ? h('circle', {
            cx: S / 2, cy: S / 2, r: reach,
            fill: 'none', stroke: '#9adcff', strokeWidth: 0.5,
            opacity: 0.5, className: 'nm-terra-front',
          }) : null,
          // 完稿后在最高峰点一个极小的光点，收束视线。
          // 用同心双环而不是实心圆：实心小圆在深底上读起来像一粒灰尘或
          // 渲染瑕疵，双环加柔光才像「山顶的光」，也才配得上地形图的气质。
          complete ? h('g', { className: 'nm-terra-glow' },
            h('circle', { cx: peak.x, cy: peak.y, r: 4.2, fill: 'none', stroke: '#9adcff', strokeWidth: 0.35, opacity: 0.45 }),
            h('circle', { cx: peak.x, cy: peak.y, r: 1.5, fill: '#dff3ff', opacity: 0.95 })) : null,
          // ---- 地名标注 ----
          //
          // 只标「已经探明」的那几个：地名跟着资产走，没写完的资产本来就
          // 还没定名，提前把名字钉在地图上属于剧透自己。
          // 揭示遮罩不作用于文字 —— 文字半透明压在等高线上会看不清，
          // 而看不清的地图等于没有地图。这里改用 opacity 直接控制。
          // 位置由 terraLabelLayout 统一避让，见那个函数的注释。
          labelPlan.length ? h('g', { className: 'nm-terra-sites' },
            labelPlan.map((plan) => h('g', { key: plan.key, opacity: 0.86 },
              // 标杆固定在山头真实位置，只有文字被推开
              h('circle', { cx: plan.cx, cy: plan.cy, r: 0.85, fill: '#dff3ff', opacity: 0.9 }),
              h('circle', { cx: plan.cx, cy: plan.cy, r: 2.1, fill: 'none', stroke: '#9adcff', strokeWidth: 0.22, opacity: 0.5 }),
              // 文字被推远时，用一根细线连回标杆，才看得出这个地名属于哪个山头
              Math.hypot(plan.ax - plan.cx, plan.ay - plan.cy) > 1.8 ? h('line', {
                x1: plan.cx, y1: plan.cy, x2: plan.ax, y2: plan.ay,
                stroke: '#9adcff', strokeWidth: 0.16, opacity: 0.4,
              }) : null,
              h('text', {
                x: plan.ax + (plan.flip ? -2.4 : 2.4), y: plan.ay + 1.05,
                textAnchor: plan.flip ? 'end' : 'start',
                className: 'nm-terra-site-label',
              }, plan.label)))) : null)),
        h('div', { className: 'nm-terra-scale' },
          h('span', { className: 'nm-terra-scale-label' }, '高程'),
          h('i', { className: 'nm-terra-scale-bar' })),
        h('div', { className: 'nm-terra-bar', role: 'progressbar', 'aria-valuenow': percent ?? 0, 'aria-valuemin': 0, 'aria-valuemax': 100 },
          h('div', { className: 'nm-terra-bar-fill', style: { width: `${percent ?? 0}%` } })),
        // ---- 存为地图资产 ----
        //
        // 这张图光在面板里看有点浪费：它其实是这部小说的地理结构。
        // 存成项目里的 地图.svg + 地图.md 之后，它能被大纲引用、被模型读到、
        // 也能直接拿去当生图参考。
        h('div', { className: 'nm-terra-save' },
          h('button', {
            type: 'button',
            className: 'nm-terra-save-btn',
            disabled: saving || !project,
            onClick: saveMapAsset,
            title: '把当前地形连同地名存成项目里的 地图.svg 与 地图.md',
          }, saving ? '正在保存…' : '存为地图资产'),
          saved ? h('span', { className: 'nm-terra-save-ok', role: 'status' }, `已保存 ${saved}`) : null,
          saveError ? h('span', { className: 'nm-terra-save-err', role: 'alert' }, saveError) : null),
        // ---- 世界讲不讲得通 ----
        //
        // 地名表本身看不出问题：六个地名并排放着，谁也不会觉得「雪原在赤道」
        // 有什么不对。只有把位置和地形的后果算出来，矛盾才会浮到纸面上。
        // 这段就是那个结果，作者不用自己去推。
        WorldNotes(h, { regions: placeLike, world: project?.world }))
    }

    /**
     * 世界概览：每个地区的纬度带、地形、气候，以及讲不通的地方。
     *
     * 为什么单独一块而不是塞进地名标签里：标签上最多再放两个字，
     * 「温带·凉爽半干」放不下，而且一挤就把地名本身挤没了。
     * 气候是**核对**用的，不是瞄一眼用的，放在图下面更合适。
     *
     * 数据全部来自后端（atlas 的 world 字段），前端不重算。
     */
    function WorldNotes(h, { regions, world }) {
      // 只有真的有地区才显示。空项目不该多出一块空表格。
      const list = Array.isArray(regions) ? regions.filter((r) => r && r.climate) : []
      if (list.length === 0) return null
      const issues = Array.isArray(world?.issues) ? world.issues : []
      // high 级问题用错误色提醒，其余用中性色 —— 全都标红等于都没标红
      const marks = { high: 'nm-world-issue-high', medium: 'nm-world-issue-mid', low: 'nm-world-issue-low' }
      return h('div', { className: 'nm-world' },
        h('div', { className: 'nm-world-head' },
          h('span', { className: 'nm-world-title' }, '气候推演'),
          h('span', { className: 'nm-world-hint' }, '按方位与地形推出，不是你写的')),
        h('ul', { className: 'nm-world-list' },
          list.map((region) => h('li', { key: region.name, className: 'nm-world-row' },
            h('span', { className: 'nm-world-name' }, region.name),
            h('span', { className: 'nm-world-band' }, region.climate.bandLabel),
            h('span', { className: 'nm-world-terrain' }, region.climate.terrainLabel),
            // 作者自己写的设定（无源质、永冬）要跟推演结论区分开。
            // 混在一起会让人以为这些也是算出来的，反而没人去看原文。
            region.climate.marks?.length
              ? h('span', { className: 'nm-world-mark', title: '来自你的设定，不是推出来的' }, region.climate.marks.join('·'))
              : null,
            h('span', {
              className: 'nm-world-climate',
              title: region.climate.derived ? '按方位与地形推演' : '来自设定，未参与推演',
            }, region.climate.summary)))),
        issues.length > 0
          ? h('div', { className: 'nm-world-issues' },
            h('div', { className: 'nm-world-issues-head' },
              // 标题按最重的那条定，不能一律写「讲不通」——
              // 列表里混着 medium 时，那个标题就成了冤枉人。
              world?.coherent ? '可能有出入的地方' : '讲不通的地方',
              h('span', { className: 'nm-world-issues-count' }, `${issues.length}`)),
            h('ul', { className: 'nm-world-issue-list' },
              issues.slice(0, 5).map((issue, index) => h('li', {
                key: `${issue.kind}-${issue.region}-${index}`,
                className: `nm-world-issue ${marks[issue.severity] ?? ''}`,
                // 完整解释放在 title 里：列表要短，作者想知道细节时再展开
                title: `${issue.message}\n\n建议：${issue.suggestion}`,
              },
              h('b', null, issue.region),
              h('span', null, issue.message),
              // 想知道现实里怎么解释，得知道搜什么。给个现成的检索词，
              // 比让他自己想「赤道雪山叫什么」靠谱 —— 后者会搜到旅游攻略。
              issue.research
                ? h('i', { className: 'nm-world-research', title: `可搜索：${issue.research}` }, issue.research)
                : null))),
            issues.length > 5
              ? h('div', { className: 'nm-world-more' }, `还有 ${issues.length - 5} 条，见 /novel-world`)
              : null)
          : null)
    }

    /** 资产清单里每一项的图标：已写好打勾，空文件是空心点，没建过是虚线圈。 */
    function ReadinessMark({ item }) {      const state = item.exists ? 'done' : item.created ? 'empty' : 'missing'
      return h('span', { className: 'nm-prog-mark', 'data-state': state, 'aria-hidden': true },
        h('svg', { viewBox: '0 0 16 16', width: 14, height: 14, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
          state === 'done' ? h('path', { d: 'M3 8.5 6.2 12 13 4.5' }) : null,
          state === 'empty' ? h('circle', { cx: 8, cy: 8, r: 4.5, strokeWidth: 1.6, opacity: 0.7 }) : null,
          state === 'missing' ? h('circle', { cx: 8, cy: 8, r: 6, strokeWidth: 1.4, strokeDasharray: '2.5 3', opacity: 0.55 }) : null))
    }

    /** 「下一步该做什么」：给一句能直接照抄的命令，而不是只甩一个词。 */
    const NEXT_HINT = {
      setting: ['补齐世界观', '/novel-setup'],
      cast: ['创建人设', '/novel-cast'],
      outline: ['生成大纲', '/novel-outline'],
      worldstate: ['建立世界状态', '/novel-state'],
      foreshadow: ['登记伏笔', '/novel-foreshadow'],
      plot: ['搭剧情树', '/novel-plot'],
      rules: ['确定写作规范', '/novel-style'],
      chapters: ['开始写正文', '/novel-write'],
    }

    function ProgressBody(props) {
      const { sessionId } = props ?? {}
      const useSessionsHook = typeof props?.useSessions === 'function' ? props.useSessions : () => undefined
      const cwd = useSessionsHook((state) => (sessionId === undefined ? undefined : state?.byId?.[sessionId]?.cwd))
      const [data, setData] = useState(null)
      const [error, setError] = useState('')
      const [busy, setBusy] = useState(false)
      const [selected, setSelected] = useState('')
      const [auto, setAuto] = useState(true)
      const alive = useRef(true)
      const loading = useRef(false)

      const load = (quiet) => {
        // 自动刷新和手动刷新可能叠在一起，抢同一个 setState 会闪；用 ref 挡住
        // 重入，静默刷新也不显示 loading 骨架。
        if (loading.current) return
        loading.current = true
        if (!quiet) setBusy(true)
        setError('')
        api(`atlas?cwd=${encodeURIComponent(cwd ?? '')}`)
          .then((payload) => {
            if (!alive.current) return
            setData(payload)
            setSelected((prev) => (prev && (payload.projects ?? []).some((p) => p.name === prev))
              ? prev
              : (payload.defaultProject ?? payload.projects?.[0]?.name ?? ''))
          })
          .catch((e) => { if (alive.current) setError(e?.message ?? String(e)) })
          .finally(() => { if (alive.current && !quiet) setBusy(false); loading.current = false })
      }

      useEffect(() => { alive.current = true; load(); return () => { alive.current = false } }, [cwd])

      // 自动刷新只在页签可见时跑：切走就停，不在后台空转打接口。
      useEffect(() => {
        if (!auto || typeof document === 'undefined') return undefined
        if (document.visibilityState === 'hidden') return undefined
        const timer = setInterval(() => { if (!document.hidden) load(true) }, 4000)
        return () => clearInterval(timer)
      }, [auto, cwd])

      const projects = data?.projects ?? []
      const project = projects.find((p) => p.name === selected) ?? null

      // 样式必须随面板自己挂载。设置页不是总开着，图谱/进度独立渲染时
      // 整张样式表都不存在 —— 表现就是裸的圆点列表、环形图消失、全黑。
      // 统一包一层，所有分支（含出错与空态）都不会漏掉。
      const frame = (...children) => h('div', { className: 'nm-atlas nm-prog' },
        h('style', null, CSS), ...children)

      if (error) {
        return frame(
          h('div', { className: 'nm-atlas-message' }, '读取进度失败：', error),
          h('button', { type: 'button', className: 'nm-atlas-refresh', onClick: () => load() }, '重试'))
      }
      if (!data) return frame(h('div', { className: 'nm-atlas-message' }, busy ? '正在读取进度…' : '暂无进度'))
      if (data.error === 'no-cwd') {
        return frame(h('div', { className: 'nm-atlas-message' }, data.message ?? '无法定位项目目录'))
      }
      if (projects.length === 0) {
        return frame(h('div', { className: 'nm-atlas-message' }, '还没有小说项目。先用 /novel 起一部，这里就会显示进度。'))
      }

      const readiness = project?.readiness
      const batch = project?.batch
      const chapters = project?.progress?.chapters ?? 0
      const goal = project?.progress?.goal ?? 0
      const next = readiness?.next ? NEXT_HINT[readiness.next] : null

      return frame(
        h('div', { className: 'nm-atlas-head' },
          projects.length > 1
            ? h('select', {
              className: 'nm-select nm-prog-select', value: selected, 'aria-label': '选择小说项目（生成进度）',
              onChange: (event) => setSelected(event.target.value),
            }, projects.map((p) => h('option', { key: p.name, value: p.name }, p.title ?? p.name)))
            : h('span', { className: 'nm-atlas-title-icon' }, h(ProgressGlyph, { size: 15 }), project?.title ?? project?.name ?? ''),
          h('div', { className: 'nm-prog-actions' },
            h('label', { className: 'nm-prog-auto' },
              h('input', { type: 'checkbox', checked: auto, onChange: (event) => setAuto(event.target.checked), 'aria-label': '自动刷新进度' }),
              h('span', null, '自动刷新')),
            h('button', { type: 'button', className: 'nm-atlas-refresh', onClick: () => load(), disabled: busy, 'aria-label': '刷新进度' },
              h('svg', { viewBox: '0 0 16 16', width: 13, height: 13, fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' },
                h('path', { d: 'M13.5 8a5.5 5.5 0 1 1-1.9-4.2' }), h('path', { d: 'M13.5 2v3.2h-3.2' }))))),

        // 总览：一个环形进度 + 两个关键数字
        // 地貌等高线：把「8 项里完成了几项」变成一块正在浮出水面的陆地。
        // 环形图保留在上方给一个精确数字，两者互补 —— 图给直觉，环给刻度。
        h(TerrainGlyph, { items: readiness?.items, percent: readiness?.percent ?? 0, project }),

        h('div', { className: 'nm-prog-hero' },
          h('div', { className: 'nm-prog-ring', style: { '--pct': readiness?.percent ?? 0 }, role: 'img', 'aria-label': `基础资产完成 ${readiness?.percent ?? 0}%` },
            h('svg', { viewBox: '0 0 48 48', width: 60, height: 60 },
              h('circle', { cx: 24, cy: 24, r: 19, strokeWidth: 5, className: 'nm-prog-ring-track' }),
              h('circle', {
                cx: 24, cy: 24, r: 19, strokeWidth: 5, strokeLinecap: 'round',
                strokeDasharray: 119.4, strokeDashoffset: 119.4 - (119.4 * (readiness?.percent ?? 0)) / 100,
                transform: 'rotate(-90 24 24)', className: 'nm-prog-ring-arc',
              })),
            h('span', { className: 'nm-prog-ring-num' }, `${readiness?.percent ?? 0}%`)),
          h('div', { className: 'nm-prog-hero-text' },
            h('div', { className: 'nm-prog-hero-title' }, '基础资产', h('b', null, `${readiness?.done ?? 0}/${readiness?.total ?? 0}`)),
            next
              ? h('div', { className: 'nm-prog-next' },
                h('span', null, '下一步：', next[0]),
                h('code', { className: 'nm-inlinecode' }, next[1]))
              : h('div', { className: 'nm-prog-next nm-prog-allset' }, '基础资产已齐，可以开写了'))),

        // 清单与批量进度放在一起，交给 nm-prog-sections 分配剩余高度，
        // 避免内容少时页面下半截空一片。
        h('div', { className: 'nm-prog-sections' },
          // 资产清单
          h('div', { className: 'nm-prog-section' },
            h('div', { className: 'nm-prog-section-head' }, '资产清单'),
            h('ul', { className: 'nm-prog-list' },
              (readiness?.items ?? []).map((item) => h('li', { key: item.key, className: 'nm-prog-item', 'data-state': item.exists ? 'done' : item.created ? 'empty' : 'missing' },
                h(ReadinessMark, { item }),
                h('span', { className: 'nm-prog-label' }, item.label),
                h('span', { className: 'nm-prog-meta' },
                  item.exists
                    ? (item.key === 'chapters' ? `${item.headings} 章` : `${item.headings} 节`)
                    : item.created ? '空文件' : '未创建'))))),

          // 批量写作：只有真的跑过才显示，避免空面板占位
          batch
            ? h('div', { className: 'nm-prog-section' },
              h('div', { className: 'nm-prog-section-head' },
                '批量写作',
                h('span', { className: 'nm-prog-phase', 'data-phase': batch.phase }, batch.phaseLabel)),
              batch.percent !== null
                ? h('div', { className: 'nm-prog-bar', role: 'progressbar', 'aria-valuenow': batch.percent, 'aria-valuemin': 0, 'aria-valuemax': 100 },
                  h('div', { className: 'nm-prog-bar-fill', style: { width: `${batch.percent}%` }, 'data-phase': batch.phase }))
                : null,
              h('div', { className: 'nm-prog-batch-meta' },
                batch.target > 0 ? `${batch.done} / ${batch.target} 章` : `${batch.done} 章`,
                batch.staleMs !== null && batch.phase === 'running' && batch.staleMs > 180000
                  ? h('span', { className: 'nm-prog-stale' }, '· 有一阵没动静了，可能已中断')
                  : null),
              batch.lastError ? h('div', { className: 'nm-prog-error' }, batch.lastError) : null)
            : null),

        h('div', { className: 'nm-prog-foot' },
          `正文 ${chapters}${goal > 0 ? ` / ${goal}` : ''} 章`,
          project?.progress?.chars ? ` · ${project.progress.chars} 字` : null))
    }
    function ProgressTitle(props) {
      const useTabInfoHook = typeof props?.useTabInfo === 'function' ? props.useTabInfo : () => null
      const info = useTabInfoHook()
      return h(React.Fragment, null, h(ProgressGlyph, { size: 16 }), info?.tab?.title ?? '生成进度')
    }

    // ────────────────────────────────────────────────────────────
    // 生图工作台：左侧输入 → LLM 扩写 → 生成图片 → 绑定资产
    // ────────────────────────────────────────────────────────────
    const ART_KINDS = [
      ['character', '角色立绘'],
      ['region', '场景地图'],
      ['item', '物品道具'],
      ['map', '世界地图底图'],
    ]

    // 构图控制：与后端 artwork.js 的预设保持一致（纯展示用，不在前端算像素）
    const ASPECT_PRESETS = [
      { key: '1:1', label: '1:1' }, { key: '16:9', label: '16:9' }, { key: '9:16', label: '9:16' },
      { key: '4:3', label: '4:3' }, { key: '3:4', label: '3:4' }, { key: '3:2', label: '3:2' },
      { key: '2:3', label: '2:3' }, { key: '5:4', label: '5:4' }, { key: '4:5', label: '4:5' },
      { key: '21:9', label: '21:9' },
    ]
    const RESOLUTION_TIERS = [
      { key: 'auto', label: 'Auto' }, { key: '1k', label: '1K' },
      { key: '2k', label: '2K' }, { key: '4k', label: '4K' },
    ]
    /** 在界面上预告实际会请求的像素尺寸，免得用户生成完才发现比例不对。 */
    function predictSize(aspect, tier) {
      const preset = ASPECT_PRESETS.find((item) => item.key === aspect)
      const longEdge = { auto: 0, '1k': 1024, '2k': 2048, '4k': 4096 }[tier] ?? 0
      if (!preset || !longEdge) return '按模型默认尺寸'
      const [w, h] = aspect.split(':').map(Number)
      const round = (value) => Math.max(64, Math.round(value / 64) * 64)
      const ratio = w / h
      const width = ratio >= 1 ? longEdge : round(longEdge * ratio)
      const height = ratio >= 1 ? round(longEdge / ratio) : longEdge
      return `${width} × ${height}`
    }

    function ArtGlyph(props) {
      const size = props?.size ?? 16
      return h('svg', {
        width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round',
        'aria-hidden': true,
      },
        h('rect', { x: 3, y: 3, width: 18, height: 18, rx: 3 }),
        h('circle', { cx: 8.5, cy: 8.5, r: 1.6 }),
        h('path', { d: 'M21 15l-5-5L5 21' }))
    }

    function ArtBody(props) {
      const { sessionId } = props ?? {}
      const useSessionsHook = typeof props?.useSessions === 'function' ? props.useSessions : () => undefined
      const cwd = useSessionsHook((state) => (sessionId === undefined ? undefined : state?.byId?.[sessionId]?.cwd))

      const [projects, setProjects] = useState([])
      const [project, setProject] = useState('')
      const [kind, setKind] = useState('character')
      const [brief, setBrief] = useState('')
      const [prompt, setPrompt] = useState('')
      const [image, setImage] = useState('')          // 已生成图片的相对路径
      const [bindName, setBindName] = useState('')
      const [targets, setTargets] = useState([])      // 可绑定的角色名/地名
      const [bound, setBound] = useState('')
      const [busy, setBusy] = useState('')
      const [error, setError] = useState('')
      const [notice, setNotice] = useState('')
      const [reference, setReference] = useState(null)   // 垫图 { name, dataUrl, mime }
      const [strength, setStrength] = useState('0.6')    // 垫图影响强度
      const [genModel, setGenModel] = useState('')       // 本次生成覆盖的模型
      const [artModels, setArtModels] = useState([])     // DSH 已配置的生图候选
      const [aspect, setAspect] = useState('1:1')        // 宽高比预设
      const [tier, setTier] = useState('1k')             // 分辨率档位
      const [count, setCount] = useState(1)              // 生成张数
      const [transparent, setTransparent] = useState(false) // 透明背景
      const [imageList, setImageList] = useState([])     // 本轮全部结果（n>1 时多张）
      const [activeIndex, setActiveIndex] = useState(0)  // 当前预览第几张
      const alive = useRef(true)
      const sizeHint = predictSize(aspect, tier)

      // 读取项目列表，供顶部选择器使用
      useEffect(() => {
        alive.current = true
        api(`atlas?cwd=${encodeURIComponent(cwd ?? '')}`)
          .then((payload) => {
            if (!alive.current) return
            const list = payload?.projects ?? []
            setProjects(list)
            setProject((prev) => prev || payload?.defaultProject || list[0]?.name || '')
          })
          .catch((failure) => { if (alive.current) setError(`读取项目失败：${failure?.message ?? failure}`) })
        return () => { alive.current = false }
      }, [cwd])

      // 切换资产类型时刷新可绑定目标（角色名 / 地名）
      useEffect(() => {
        if (!project) { setTargets([]); return }
        api(`atlas?cwd=${encodeURIComponent(cwd ?? '')}`)
          .then((payload) => {
            const found = (payload?.projects ?? []).find((item) => item.name === project)
            if (!found) { setTargets([]); return }
            if (kind === 'region') {
              setTargets((found.regions ?? []).map((region) => region.name).filter(Boolean))
            } else if (kind === 'character') {
              const cast = (found.sections ?? []).find((section) => section.key === 'cast')
              const names = (cast?.nodes ?? []).map((node) => String(node.label ?? '').split('（')[0].trim()).filter(Boolean)
              setTargets(names)
            } else {
              setTargets([])
            }
          })
          .catch(() => setTargets([]))
      }, [project, kind, cwd])

      // 读取 DSH 已配置模型，筛出疑似生图的作为本次可选模型
      useEffect(() => {
        let cancelled = false
        const remoteLlm = props?.ctx?.remote?.llm
        if (!remoteLlm || typeof remoteLlm.listProviders !== 'function') return undefined
        remoteLlm.listProviders()
          .then((result) => {
            if (cancelled || !result?.ok || !Array.isArray(result.value)) return
            const hint = /image|dall[-_ ]?e|flux|stable[-_ ]?diffusion|sdxl|midjourney|\bmj\b|seedream|cogview|imagen|kolors|wanx|seed/i
            const rows = []
            for (const prov of result.value) {
              for (const item of prov?.models ?? []) {
                const id = typeof item === 'string' ? item : item?.id
                if (!id) continue
                rows.push({ provider: prov.id, model: id, image: hint.test(String(id)) })
              }
            }
            // 疑似生图模型排前面，其余保留供手选
            setArtModels([...rows.filter((row) => row.image), ...rows.filter((row) => !row.image)])
          })
          .catch(() => { /* 读不到就用设置里的默认模型 */ })
        return () => { cancelled = true }
      }, [])

      const post = (action, body) => api(action, { body, timeoutMs: 200000 })

      const doExpand = async () => {
        if (!brief.trim()) { setError('请先输入一句简短描述'); return }
        setBusy('expand'); setError(''); setNotice('')
        try {
          const result = await post('llm/expand', { brief: brief.trim(), kind })
          setPrompt(result?.prompt ?? '')
          setNotice('提示词已扩写，可直接修改后再生成。')
        } catch (failure) {
          setError(`扩写失败：${failure?.message ?? failure}`)
        } finally { setBusy('') }
      }

      const doGenerate = async () => {
        if (!prompt.trim()) { setError('提示词为空，请先扩写或手写'); return }
        if (!project) { setError('请先选择项目'); return }
        setBusy('generate'); setError(''); setNotice(''); setImage(''); setImageList([]); setActiveIndex(0)
        try {
          const result = await post('image/generate', {
            cwd, project, prompt: prompt.trim(),
            name: bindName || 'art',
            prefix: kind === 'region' ? 'region' : kind === 'character' ? 'cast' : kind === 'map' ? 'map' : 'item',
            // 构图控制
            aspect, tier, count, transparent,
            // 垫图：把原图作为参考一并送出生图接口
            reference: reference ? { dataUrl: reference.dataUrl, mime: reference.mime } : undefined,
            strength: reference ? Number(strength) : undefined,
            // 本次自选的模型优先于设置里的默认值
            model: genModel || undefined,
          })
          const files = result?.files ?? (result?.file ? [result.file] : [])
          setImageList(files)
          setImage(files[0] ?? '')
          const skipped = (result?.failed ?? []).length
          setNotice([
            files.length > 1 ? `已生成 ${files.length} 张并保存到 插图/ 目录。` : '图片已生成并保存到 插图/ 目录。',
            result?.referenceIgnored ? '该中转站不支持垫图，本次未使用参考图。' : '',
            skipped ? `${skipped} 张下载失败，已跳过。` : '',
          ].filter(Boolean).join(' '))
        } catch (failure) {
          setError(`生成失败：${failure?.message ?? failure}`)
        } finally { setBusy('') }
      }

      // 选中本地图片作为垫图：读成 dataURL，稍后随请求提交
      const pickReference = (event) => {
        const file = event?.target?.files?.[0]
        if (!file) return
        if (!/^image\//u.test(file.type)) { setError('请选择图片文件'); return }
        if (file.size > 6 * 1024 * 1024) { setError('垫图请小于 6MB'); return }
        const reader = new FileReader()
        reader.onload = () => {
          setReference({ name: file.name, dataUrl: String(reader.result ?? ''), mime: file.type })
          setError('')
          setNotice(`已选垫图：${file.name}`)
        }
        reader.onerror = () => setError('读取图片失败')
        reader.readAsDataURL(file)
      }

      const doBind = async () => {
        if (!image) { setError('请先生成图片'); return }
        if (!bindName.trim()) { setError('请填写要绑定的角色名或地名'); return }
        setBusy('bind'); setError(''); setNotice('')
        try {
          await post('asset/bind', {
            cwd, project, kind, name: bindName.trim(),
            file: image, prompt: prompt.trim(),
          })
          setBound(bindName.trim())
          setNotice(`已绑定到「${bindName.trim()}」。`)
        } catch (failure) {
          setError(`绑定失败：${failure?.message ?? failure}`)
        } finally { setBusy('') }
      }

      const imageUrl = image
        ? `${API}image/file/${encodeURIComponent(`${project}/${image}`)}`
        : ''

      const step = (index, label, running, done) => h('div', {
        className: 'nm-art-step', 'data-on': done ? 'done' : running ? 'run' : '',
      }, h('span', { className: 'nm-art-stepnum' }, done ? '✓' : String(index)), label)

      return h('div', { className: 'nm-atlas nm-art' },
        h('style', null, CSS),
        h('div', { className: 'nm-art-head' },
          h('select', {
            value: project, 'aria-label': '选择小说项目（AI 生图）',
            onChange: (event) => setProject(event.target.value),
          }, projects.length === 0
            ? h('option', { value: '' }, '暂无项目')
            : projects.map((item) => h('option', { key: item.name, value: item.name }, `《${item.title ?? item.name}》`))),
          h('select', {
            value: kind, 'aria-label': '资产类型',
            onChange: (event) => setKind(event.target.value),
          }, ART_KINDS.map(([value, text]) => h('option', { key: value, value }, text)))),
        h('div', { className: 'nm-art-toolbar' },
          h('span', { className: 'nm-muted' }, '模型'),
          h('select', {
            value: genModel, 'aria-label': '本次生成使用的模型',
            onChange: (event) => setGenModel(event.target.value),
          },
            h('option', { value: '' }, '使用设置里的默认生图模型'),
            ...artModels.map((item) => h('option', {
              key: `${item.provider}::${item.model}`, value: item.model,
            }, `${item.provider} / ${item.model}`)))),
        // 步骤条置顶，让流程一眼可见
        h('div', { className: 'nm-art-steps' },
          step(1, '扩写提示词', busy === 'expand', !!prompt),
          step(2, '生成图片', busy === 'generate', !!image),
          step(3, '绑定资产', busy === 'bind', !!bound)),
        // 预览区：有图才占大面积，没图时给矮占位，避免把按钮推到屏幕外
        h('div', { className: 'nm-art-preview', 'data-empty': image ? '' : 'true' },
          image
            ? h('img', { src: imageUrl, alt: '生成结果', loading: 'lazy' })
            : h('div', { className: 'nm-art-placeholder' }, '生成后的图片会显示在这里')),
        // 多图：一次生成多张时给缩略图条，点选切换预览
        imageList.length > 1
          ? h('div', { className: 'nm-art-thumbs' },
            imageList.map((file, index) => h('button', {
              key: file, type: 'button', className: 'nm-art-thumb',
              'data-active': index === activeIndex ? 'true' : 'false',
              'aria-label': `查看第 ${index + 1} 张`,
              onClick: () => { setActiveIndex(index); setImage(file) },
            }, h('img', { src: API + 'image/file/' + encodeURIComponent(project + '/' + file), alt: `第 ${index + 1} 张` }))),
            h('span', { className: 'nm-muted' }, `${activeIndex + 1} / ${imageList.length}`))
          : null,
        // 输入区：单列铺满，避免左右两栏在窄侧边栏里挤压
        h('div', { className: 'nm-art-form' },
          h('label', { className: 'nm-field' },
            h('span', null, '一句话描述'),
            h('textarea', {
              className: 'nm-art-textarea', rows: 2, value: brief,
              placeholder: kind === 'character' ? '一个穿着红袍的精灵弓箭手'
                : kind === 'region' ? '终年被灰烬覆盖的边境城邦'
                  : kind === 'map' ? '一张奇幻世界的全境地图，有山脉、河流与海岸线'
                    : '一枚刻着古老符文的青铜戒指',
              onChange: (event) => setBrief(event.target.value),
            })),
          h('div', { className: 'nm-row' },
            h('button', { type: 'button', className: 'nm-primary', disabled: !!busy || !brief.trim(), onClick: doExpand },
              busy === 'expand' ? '正在扩写…' : '① 智能扩写提示词')),
          // 构图控制：宽高比 / 分辨率 / 张数 / 透明背景
          h('div', { className: 'nm-art-compose' },
            h('div', { className: 'nm-compose-row' },
              h('span', { className: 'nm-compose-label' }, '宽高比'),
              h('div', { className: 'nm-compose-group' },
                ASPECT_PRESETS.map((preset) => h('button', {
                  key: preset.key, type: 'button', className: 'nm-compose-chip',
                  'data-active': aspect === preset.key ? 'true' : 'false',
                  disabled: !!busy,
                  onClick: () => setAspect(preset.key),
                }, preset.label)))),
            h('div', { className: 'nm-compose-row' },
              h('span', { className: 'nm-compose-label' }, '分辨率'),
              h('div', { className: 'nm-compose-group' },
                RESOLUTION_TIERS.map((item) => h('button', {
                  key: item.key, type: 'button', className: 'nm-compose-chip',
                  'data-active': tier === item.key ? 'true' : 'false',
                  disabled: !!busy,
                  onClick: () => setTier(item.key),
                }, item.label))),
              h('span', { className: 'nm-compose-hint' }, sizeHint)),
            h('div', { className: 'nm-compose-row' },
              h('span', { className: 'nm-compose-label' }, '生成张数'),
              h('div', { className: 'nm-compose-group' },
                [1, 2, 3, 4].map((n) => h('button', {
                  key: n, type: 'button', className: 'nm-compose-chip',
                  'data-active': count === n ? 'true' : 'false',
                  disabled: !!busy,
                  onClick: () => setCount(n),
                }, `${n} 张`)))),
            h('div', { className: 'nm-compose-row' },
              h('span', { className: 'nm-compose-label' }, '透明背景'),
              h('button', {
                type: 'button', className: 'nm-compose-switch',
                'data-on': transparent ? 'true' : 'false',
                'aria-pressed': transparent, disabled: !!busy,
                onClick: () => setTransparent(!transparent),
              }, transparent ? '已开启' : '关闭'),
              h('span', { className: 'nm-compose-hint' }, '仅部分模型支持，不支持时按普通背景生成'))),
          h('label', { className: 'nm-field' },
            h('span', null, '提示词（可编辑）'),
            h('textarea', {
              className: 'nm-art-textarea', rows: 5, value: prompt,
              placeholder: '点击上方按钮自动生成，或直接手写英文提示词…',
              onChange: (event) => setPrompt(event.target.value),
            })),
          // 垫图区
          h('div', { className: 'nm-art-ref' },
            h('div', { className: 'nm-art-reflabel' }, '垫图（可选参考图，用于保持风格/构图）'),
            reference
              ? h('div', { className: 'nm-art-refbox' },
                h('img', { src: reference.dataUrl, alt: '垫图预览' }),
                h('div', { className: 'nm-art-refinfo' },
                  h('span', { className: 'nm-muted' }, reference.name),
                  h('button', {
                    type: 'button', className: 'nm-art-refclear',
                    onClick: () => { setReference(null); setNotice('已移除垫图') },
                  }, '移除')))
              : h('label', { className: 'nm-art-refpick' },
                h('input', {
                  type: 'file', accept: 'image/*', style: { display: 'none' },
                  onChange: pickReference, disabled: !!busy,
                }),
                h('span', null, '＋ 选择垫图')),
            reference
              ? h('label', { className: 'nm-field nm-art-strength' },
                h('span', null, `影响强度 ${strength}`),
                h('input', {
                  type: 'range', min: 0.1, max: 1, step: 0.1, value: strength,
                  onChange: (event) => setStrength(event.target.value),
                }))
              : null),
          h('div', { className: 'nm-row' },
            h('button', { type: 'button', className: 'nm-primary', disabled: !!busy || !prompt.trim(), onClick: doGenerate },
              busy === 'generate' ? '正在生成图片…' : '② 生成图片')),
          h('label', { className: 'nm-field' },
            h('span', null, kind === 'region' ? '绑定到地区名' : kind === 'character' ? '绑定到角色名' : '绑定名称'),
            targets.length
              ? h('select', {
                value: bindName, 'aria-label': '选择绑定目标',
                onChange: (event) => setBindName(event.target.value),
              },
                h('option', { value: '' }, '— 选择 —'),
                targets.map((name) => h('option', { key: name, value: name }, name)))
              : h('input', {
                type: 'text', value: bindName, placeholder: '直接输入名称',
                onChange: (event) => setBindName(event.target.value),
              })),
          h('div', { className: 'nm-row' },
            h('button', { type: 'button', disabled: !!busy || !image || !bindName.trim(), onClick: doBind },
              busy === 'bind' ? '正在绑定…' : '③ 保存并绑定到资产')),
          bound ? h('p', { className: 'nm-muted' }, `已绑定：${bound}`) : null),
        error ? h('p', { role: 'alert', className: 'nm-alert' }, error) : null,
        notice ? h('p', { className: 'nm-muted', role: 'status' }, notice) : null)
    }

    function ArtTitle(props) {
      const useTabInfoHook = typeof props?.useTabInfo === 'function' ? props.useTabInfo : () => null
      const info = useTabInfoHook()
      return h(React.Fragment, null, h(ArtGlyph, { size: 16 }), info?.tab?.title ?? '生图工作台')
    }

    return {
      name: 'novel-master', inject: ['slots', 'remote', 'remote.llm', 'remote.directoryPicker'],
      apply(ctx) {
        ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section', id: 'novel-master', order: 36, label: () => '小说创作大师',
        // 真实 React 下包一层错误边界，避免渲染异常把整块设置区变成白板。
        // 极简渲染环境不具备类组件能力，直接渲染。
        }, props => (hasErrorBoundary
          ? h(SettingsBoundaryClass, null, h(SettingsPage, { ...props, ctx }))
          : h(SettingsPage, { ...props, ctx }))))

        // 设定树：右侧栏页签。类型注册（ctx.sidebarRightTabs）+ 正文/标题两个
        // 键控座位，契约与 dsh-client-ui-plan / ui-sidebar-files 完全一致。
        const mountAtlas = (scope) => {
          const tabs = scope?.sidebarRightTabs
          const slots = scope?.slots
          if (!tabs || typeof tabs.register !== 'function' || typeof slots?.inject !== 'function') return undefined
          const cleanups = []
          cleanups.push(tabs.register({
            id: ATLAS_ID,
            kind: ATLAS_KIND,
            title: () => '设定树',
            guide: [{
              id: 'atlas', order: 20,
              title: () => '设定树',
              description: () => '世界观 · 人设 · 大纲 · 写作进度',
              icon: AtlasGlyph,
            }],
          }))
          cleanups.push(slots.inject('sidebar.right.pane.tab', () =>
            slots.register({ name: 'sidebar.right.pane.tab', key: ATLAS_ID }, AtlasBody)))
          cleanups.push(slots.inject('sidebar.right.pane.tab.title', () =>
            slots.register({ name: 'sidebar.right.pane.tab.title', key: ATLAS_ID }, AtlasTitle)))

          // 生图工作台：独立右侧栏页签，排在设定树之后。
          cleanups.push(tabs.register({
            id: ART_ID,
            kind: ART_KIND,
            title: () => '生图工作台',
            guide: [{
              id: 'art', order: 22,
              title: () => '生图工作台',
              description: () => '角色立绘 · 场景地图 · 物品道具',
              icon: ArtGlyph,
            }],
          }))
          cleanups.push(slots.inject('sidebar.right.pane.tab', () =>
            slots.register({ name: 'sidebar.right.pane.tab', key: ART_ID }, ArtBody)))
          cleanups.push(slots.inject('sidebar.right.pane.tab.title', () =>
            slots.register({ name: 'sidebar.right.pane.tab.title', key: ART_ID }, ArtTitle)))

          // 生成进度：排在设定树之后、生图之前 —— 它是「我现在该干什么」，
          // 比「我已经有什么」更需要一眼看到。
          cleanups.push(tabs.register({
            id: PROGRESS_ID,
            kind: PROGRESS_KIND,
            title: () => '生成进度',
            guide: [{
              id: 'progress', order: 21,
              title: () => '生成进度',
              description: () => '基础资产完成度 · 批量写作进度',
              icon: ProgressGlyph,
            }],
          }))
          cleanups.push(slots.inject('sidebar.right.pane.tab', () =>
            slots.register({ name: 'sidebar.right.pane.tab', key: PROGRESS_ID }, ProgressBody)))
          cleanups.push(slots.inject('sidebar.right.pane.tab.title', () =>
            slots.register({ name: 'sidebar.right.pane.tab.title', key: PROGRESS_ID }, ProgressTitle)))
          return () => {
            for (const clean of cleanups.splice(0).reverse()) {
              try { clean?.() } catch { /* 清理失败不能阻塞卸载 */ }
            }
          }
        }
        if (typeof ctx.inject === 'function') {
          // sidebarRightTabs 是可选服务：缺失时插件保持安静，不影响设置页。
          const fork = ctx.inject(['slots', 'sidebarRightTabs'], mountAtlas)
          if (typeof fork === 'function') ctx.effect(() => fork, 'novel-master: atlas tab')
        } else {
          const cleanup = mountAtlas(ctx)
          if (typeof cleanup === 'function') ctx.effect(() => cleanup, 'novel-master: atlas tab')
        }
      },
    }
  },
})
