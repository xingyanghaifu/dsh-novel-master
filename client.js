/* Hand-written DSH ModuleLoader client, following the installed Our Free Model
 * entry pattern. Uses the shell's React; no JSX, bundler, or extra dependency. */
window.__ModuleLoader__.load({
  id: 'dsh-novel-master',
  factory: require => {
    const React = require('react')
    const { createElement: h, useState, useEffect, useRef } = React
    const API = new URL('api/novel-master/', document.baseURI).pathname
    const CSS = `
.nm-settings{--nm-bg:var(--dsw-alias-bg-layer-1,Canvas);--nm-card:var(--dsw-alias-bg-layer-2,Canvas);--nm-raised:var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-layer-3,Canvas));--nm-text:var(--dsw-alias-label-primary,CanvasText);--nm-muted:var(--dsw-alias-label-secondary,GrayText);--nm-border:var(--dsw-alias-border-l2,color-mix(in srgb,CanvasText 14%,transparent));--nm-border-glow:color-mix(in srgb,var(--nm-accent) 26%,var(--nm-border));--nm-accent:var(--dsw-alias-brand-primary,var(--dsw-alias-state-business-primary,#5275d8));--nm-good:var(--dsw-alias-state-success-primary,#25836b);--nm-error:var(--dsw-alias-state-error-primary,#c84d55);max-width:1200px;margin:0 auto;padding:32px 28px;color:var(--nm-text);font-size:13px;line-height:1.65;display:flex;flex-direction:column;gap:28px}
.nm-settings *{box-sizing:border-box}.nm-settings [hidden]{display:none!important}.nm-settings h2,.nm-settings h3,.nm-settings h4,.nm-settings p{margin:0}.nm-settings h2{font-size:28px;font-weight:750;letter-spacing:-.8px}.nm-settings h3{font-size:18px;font-weight:700;display:flex;align-items:center;gap:10px}.nm-settings h4{font-size:15px;font-weight:650}.nm-settings .nm-muted{color:var(--nm-muted);font-size:12px}.nm-settings .nm-hero{padding:32px;border-radius:24px;border:1px solid var(--nm-border-glow);background:radial-gradient(ellipse at 95% 0%,color-mix(in srgb,var(--nm-accent) 18%,transparent),transparent 70%),linear-gradient(145deg,color-mix(in srgb,var(--nm-raised) 92%,var(--nm-accent) 6%),var(--nm-card));box-shadow:0 8px 32px -8px color-mix(in srgb,CanvasText 9%,transparent);display:flex;flex-direction:column;gap:24px}
.nm-settings .nm-row{display:flex;align-items:center;gap:14px;flex-wrap:wrap}.nm-settings .nm-between{justify-content:space-between}.nm-settings .nm-brand{display:flex;align-items:center;gap:18px}.nm-settings .nm-logo{width:58px;height:58px;display:grid;place-items:center;border-radius:20px;color:var(--nm-accent);background:linear-gradient(135deg,color-mix(in srgb,var(--nm-accent) 16%,var(--nm-card)),color-mix(in srgb,var(--nm-accent) 10%,var(--nm-card)));border:1px solid color-mix(in srgb,var(--nm-accent) 35%,transparent);box-shadow:0 6px 18px -4px color-mix(in srgb,var(--nm-accent) 30%,transparent);transition:all .3s ease}.nm-settings .nm-logo:hover{transform:translateY(-2px);box-shadow:0 8px 24px -4px color-mix(in srgb,var(--nm-accent) 40%,transparent)}.nm-settings .nm-logo svg{width:32px;height:32px}
.nm-settings .nm-badge,.nm-settings .nm-chip{font-size:11px;border:1px solid var(--nm-border);border-radius:999px;padding:5px 13px;display:inline-flex;align-items:center;gap:8px;background:var(--nm-card);color:var(--nm-muted);transition:all .2s ease}.nm-settings .nm-badge{color:var(--nm-accent);font-weight:650;background:linear-gradient(135deg,color-mix(in srgb,var(--nm-accent) 12%,var(--nm-card)),color-mix(in srgb,var(--nm-accent) 8%,var(--nm-card)));border-color:color-mix(in srgb,var(--nm-accent) 30%,transparent);box-shadow:0 2px 8px color-mix(in srgb,var(--nm-accent) 15%,transparent)}.nm-settings .nm-chip{backdrop-filter:blur(8px)}.nm-settings .nm-chip i{width:7px;height:7px;border-radius:50%;background:var(--nm-muted);transition:background .2s ease;box-shadow:0 0 0 0 transparent}.nm-settings .nm-chip[data-on=true]{color:var(--nm-text);border-color:color-mix(in srgb,var(--nm-good) 35%,var(--nm-border));background:color-mix(in srgb,var(--nm-good) 8%,var(--nm-card))}.nm-settings .nm-chip[data-on=true] i{background:var(--nm-good);box-shadow:0 0 8px var(--nm-good),0 0 0 2px color-mix(in srgb,var(--nm-good) 20%,transparent)}
.nm-settings .nm-tabs{display:flex;gap:8px;padding:8px;border:1px solid var(--nm-border);background:var(--nm-bg);border-radius:16px;overflow:auto;box-shadow:0 2px 8px rgba(0,0,0,0.04)}.nm-settings .nm-tabs button{flex:1;white-space:nowrap;border:0;background:transparent;border-radius:12px;color:var(--nm-muted);padding:11px 20px;font-weight:550;transition:all .2s ease;position:relative}.nm-settings .nm-tabs button:hover:not([aria-selected=true]){color:var(--nm-text);background:color-mix(in srgb,CanvasText 5%,transparent)}.nm-settings .nm-tabs button[aria-selected=true]{background:linear-gradient(135deg,var(--nm-raised),color-mix(in srgb,var(--nm-accent) 5%,var(--nm-raised)));color:var(--nm-accent);box-shadow:0 3px 12px color-mix(in srgb,CanvasText 10%,transparent),0 0 0 1px color-mix(in srgb,var(--nm-accent) 20%,transparent);font-weight:700}
.nm-settings button{font:inherit;cursor:pointer;color:var(--nm-text);border:1px solid var(--nm-border);border-radius:12px;background:var(--nm-raised);padding:9px 16px;transition:all .2s ease;font-weight:550}.nm-settings button:hover:not(:disabled){border-color:var(--nm-accent);background:color-mix(in srgb,var(--nm-accent) 10%,var(--nm-raised));transform:translateY(-2px);box-shadow:0 4px 12px color-mix(in srgb,var(--nm-accent) 20%,transparent)}.nm-settings button:active:not(:disabled){transform:translateY(0)}.nm-settings button:focus-visible,.nm-settings input:focus-visible,.nm-settings summary:focus-visible,.nm-settings select:focus-visible{outline:2px solid var(--nm-accent);outline-offset:3px}.nm-settings button:disabled{opacity:.45;cursor:not-allowed;transform:none}
.nm-settings .nm-primary{background:linear-gradient(135deg,color-mix(in srgb,var(--nm-accent) 18%,var(--nm-card)),color-mix(in srgb,var(--nm-accent) 12%,var(--nm-card)));border-color:color-mix(in srgb,var(--nm-accent) 60%,var(--nm-border));color:var(--nm-accent);font-weight:650;box-shadow:0 3px 10px -2px color-mix(in srgb,var(--nm-accent) 35%,transparent)}.nm-settings .nm-primary:hover:not(:disabled){background:linear-gradient(135deg,color-mix(in srgb,var(--nm-accent) 25%,var(--nm-card)),color-mix(in srgb,var(--nm-accent) 18%,var(--nm-card)));border-color:var(--nm-accent);box-shadow:0 6px 16px -2px color-mix(in srgb,var(--nm-accent) 45%,transparent)}.nm-settings .nm-quiet{background:transparent;border-color:transparent;color:var(--nm-muted);font-size:12px}.nm-settings .nm-stack{display:flex;flex-direction:column;gap:24px}
.nm-settings .nm-card{padding:28px;border:1px solid var(--nm-border);border-radius:20px;background:linear-gradient(180deg,color-mix(in srgb,var(--nm-card) 98%,white 1%),var(--nm-card));box-shadow:0 4px 20px -6px color-mix(in srgb,CanvasText 6%,transparent);display:flex;flex-direction:column;gap:20px;min-width:0;transition:all .25s ease}.nm-settings .nm-card:hover{box-shadow:0 8px 28px -6px color-mix(in srgb,CanvasText 9%,transparent);border-color:color-mix(in srgb,var(--nm-accent) 20%,var(--nm-border))}.nm-settings .nm-cardhead{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
.nm-settings .nm-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.nm-settings .nm-wide{grid-column:1/-1}.nm-settings .nm-toolbar{display:flex;gap:12px;align-items:center;flex-wrap:wrap}.nm-settings .nm-search{flex:1;min-width:220px;box-shadow:0 2px 6px color-mix(in srgb,CanvasText 5%,transparent);border-radius:12px}
.nm-settings input:not([type=checkbox]),.nm-settings select.nm-select{font:inherit;color:var(--nm-text);width:100%;min-width:0;border:1px solid var(--nm-border);border-radius:12px;background:var(--nm-bg);padding:11px 16px;transition:all .2s ease}.nm-settings select.nm-select{cursor:pointer}.nm-settings select.nm-select option{background:var(--nm-card);color:var(--nm-text)}.nm-settings input:not([type=checkbox]):hover,.nm-settings select.nm-select:hover{border-color:color-mix(in srgb,var(--nm-accent) 40%,var(--nm-border))}.nm-settings input:not([type=checkbox]):focus,.nm-settings select.nm-select:focus{border-color:var(--nm-accent);box-shadow:0 0 0 4px color-mix(in srgb,var(--nm-accent) 18%,transparent)}.nm-settings input:disabled,.nm-settings select:disabled{opacity:.55}
.nm-settings .nm-field{display:flex;flex-direction:column;gap:8px;min-width:0}.nm-settings .nm-field>span{font-weight:600;font-size:13px;color:var(--nm-text)}
.nm-settings .nm-switch{display:flex;align-items:center;justify-content:space-between;gap:18px;position:relative;cursor:pointer;min-height:48px;padding:4px 0}.nm-settings .nm-switch input{position:absolute;right:0;top:50%;transform:translateY(-50%);width:46px;height:26px;opacity:0;margin:0;cursor:pointer}.nm-settings .nm-switch input:focus-visible + .nm-track{outline:2px solid var(--nm-accent);outline-offset:5px}.nm-settings .nm-track{width:46px;height:26px;border-radius:99px;border:1px solid var(--nm-border);background:var(--nm-bg);position:relative;flex:none;pointer-events:none;transition:all .25s cubic-bezier(.4,0,.2,1);box-shadow:inset 0 2px 4px rgba(0,0,0,0.06)}.nm-settings .nm-track:after{content:'';position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:var(--nm-muted);transition:all .25s cubic-bezier(.4,0,.2,1);box-shadow:0 2px 4px rgba(0,0,0,0.15)}.nm-settings .nm-switch input:checked + .nm-track{background:linear-gradient(135deg,color-mix(in srgb,var(--nm-accent) 28%,var(--nm-bg)),color-mix(in srgb,var(--nm-accent) 22%,var(--nm-bg)));border-color:var(--nm-accent);box-shadow:inset 0 2px 4px color-mix(in srgb,var(--nm-accent) 30%,transparent)}.nm-settings .nm-switch input:checked + .nm-track:after{transform:translateX(20px);background:white;box-shadow:0 2px 8px color-mix(in srgb,var(--nm-accent) 60%,transparent),0 0 12px color-mix(in srgb,var(--nm-accent) 40%,transparent)}.nm-settings .nm-switch:has(input:disabled){opacity:.55;cursor:not-allowed}
.nm-settings .nm-switchcopy{display:flex;flex-direction:column;gap:4px;min-width:0}.nm-settings .nm-switchcopy strong{font-size:14px;font-weight:650;color:var(--nm-text)}.nm-settings .nm-switchcopy small{font-size:12px;color:var(--nm-muted);line-height:1.6}.nm-settings .nm-group{padding:0;border:0;min-width:0;margin:0}.nm-settings .nm-group legend{font-weight:700;font-size:16px;margin-bottom:14px;width:100%;color:var(--nm-text)}.nm-settings .nm-features{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px}
.nm-settings .nm-feature{padding:16px 18px;border:1px solid var(--nm-border);border-radius:14px;background:linear-gradient(135deg,var(--nm-bg),color-mix(in srgb,var(--nm-card) 95%,var(--nm-bg)));transition:all .25s ease;display:flex;flex-direction:column;justify-content:space-between;gap:10px;box-shadow:0 2px 8px rgba(0,0,0,0.03)}.nm-settings .nm-feature:hover{border-color:color-mix(in srgb,var(--nm-accent) 65%,var(--nm-border));transform:translateY(-3px);box-shadow:0 6px 18px -4px color-mix(in srgb,var(--nm-accent) 25%,transparent),0 0 0 1px color-mix(in srgb,var(--nm-accent) 15%,transparent)}
.nm-settings .nm-feature code{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:11px;color:var(--nm-accent);background:linear-gradient(135deg,color-mix(in srgb,var(--nm-accent) 10%,var(--nm-card)),color-mix(in srgb,var(--nm-accent) 7%,var(--nm-card)));padding:4px 9px;border-radius:7px;border:1px solid color-mix(in srgb,var(--nm-accent) 22%,transparent);cursor:pointer;overflow-wrap:anywhere;display:inline-flex;align-items:center;gap:6px;width:fit-content;transition:all .2s ease;font-weight:600}.nm-settings .nm-feature code:hover{background:linear-gradient(135deg,color-mix(in srgb,var(--nm-accent) 22%,var(--nm-card)),color-mix(in srgb,var(--nm-accent) 16%,var(--nm-card)));border-color:var(--nm-accent);transform:scale(1.03);box-shadow:0 3px 10px color-mix(in srgb,var(--nm-accent) 25%,transparent)}
.nm-settings .nm-savebar{display:flex;align-items:center;justify-content:space-between;gap:14px;padding-top:18px;border-top:1px solid var(--nm-border);flex-wrap:wrap}.nm-settings .nm-dirty{color:var(--nm-accent);font-size:13px;font-weight:650;display:flex;align-items:center;gap:7px}.nm-settings .nm-callout{padding:16px 20px;border-radius:14px;border:1px solid color-mix(in srgb,var(--nm-accent) 30%,var(--nm-border));background:linear-gradient(135deg,color-mix(in srgb,var(--nm-accent) 8%,var(--nm-card)),color-mix(in srgb,var(--nm-accent) 5%,var(--nm-card)));color:var(--nm-text);font-size:13px;line-height:1.7;box-shadow:0 2px 8px color-mix(in srgb,var(--nm-accent) 12%,transparent)}.nm-settings .nm-alert{padding:18px 20px;border-radius:15px;border:1px solid color-mix(in srgb,var(--nm-error) 45%,var(--nm-border));background:linear-gradient(135deg,color-mix(in srgb,var(--nm-error) 9%,var(--nm-card)),color-mix(in srgb,var(--nm-error) 6%,var(--nm-card)));display:flex;align-items:center;justify-content:space-between;gap:14px;white-space:pre-wrap;overflow-wrap:anywhere;box-shadow:0 3px 12px color-mix(in srgb,var(--nm-error) 15%,transparent)}.nm-settings .nm-success{border-color:color-mix(in srgb,var(--nm-good) 45%,var(--nm-border));background:linear-gradient(135deg,color-mix(in srgb,var(--nm-good) 9%,var(--nm-card)),color-mix(in srgb,var(--nm-good) 6%,var(--nm-card)));box-shadow:0 3px 12px color-mix(in srgb,var(--nm-good) 15%,transparent)}
.nm-settings details{border:1px solid var(--nm-border);border-radius:14px;padding:16px 18px;background:color-mix(in srgb,var(--nm-bg) 65%,var(--nm-card));transition:all .2s ease}.nm-settings details:hover{border-color:color-mix(in srgb,var(--nm-accent) 30%,var(--nm-border))}.nm-settings summary{cursor:pointer;color:var(--nm-muted);font-weight:650;font-size:13px}.nm-settings details[open]>summary{margin-bottom:18px;color:var(--nm-text)}.nm-settings .nm-metric{padding:20px;border:1px solid var(--nm-border);background:linear-gradient(135deg,var(--nm-bg),color-mix(in srgb,var(--nm-card) 97%,var(--nm-bg)));border-radius:15px;min-width:0;box-shadow:0 3px 10px color-mix(in srgb,CanvasText 4%,transparent);transition:all .2s ease}.nm-settings .nm-metric:hover{box-shadow:0 5px 16px color-mix(in srgb,CanvasText 7%,transparent);border-color:color-mix(in srgb,var(--nm-accent) 25%,var(--nm-border))}.nm-settings .nm-metric span{font-size:11px;color:var(--nm-muted);display:block;font-weight:600}.nm-settings .nm-metric strong{display:block;font-size:24px;font-weight:750;margin:8px 0;color:var(--nm-text);letter-spacing:-.5px}.nm-settings .nm-metric code{display:block;font-size:11px;color:var(--nm-accent);overflow-wrap:anywhere;font-weight:600}
.nm-settings .nm-three{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.nm-settings .nm-skeleton{height:110px;border-radius:16px;background:linear-gradient(100deg,var(--nm-card),var(--nm-raised),var(--nm-card));background-size:200% 100%;animation:nm-settings-load 1.6s ease infinite}.nm-settings .nm-empty{text-align:center;padding:40px;color:var(--nm-muted);font-size:14px}.nm-settings .nm-footer{font-size:12px;color:var(--nm-muted);text-align:center;padding:16px 0}
.nm-settings .nm-inlinecode{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:11px;background:color-mix(in srgb,var(--nm-accent) 12%,var(--nm-bg));color:var(--nm-accent);padding:4px 10px;border-radius:7px;border:1px solid color-mix(in srgb,var(--nm-accent) 25%,transparent);overflow-wrap:anywhere;font-weight:600}
.nm-settings .nm-workbench-pipeline{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;padding:18px;background:var(--nm-bg);border:1px solid var(--nm-border);border-radius:16px}
.nm-settings .nm-pipeline-step{display:flex;flex-direction:column;gap:8px;padding:14px 16px;border-radius:13px;background:linear-gradient(135deg,var(--nm-card),color-mix(in srgb,var(--nm-bg) 98%,var(--nm-card)));border:1px solid var(--nm-border);transition:all .2s ease;box-shadow:0 2px 6px rgba(0,0,0,0.03)}.nm-settings .nm-pipeline-step:hover{transform:translateY(-3px);border-color:var(--nm-accent);box-shadow:0 6px 16px -3px color-mix(in srgb,var(--nm-accent) 25%,transparent)}
.nm-settings .nm-pipeline-badge{font-size:11px;font-weight:700;color:var(--nm-accent);display:inline-flex;align-items:center;gap:7px}
.nm-settings .nm-pipeline-title{font-size:14px;font-weight:650;color:var(--nm-text)}
.nm-settings .nm-pipeline-desc{font-size:11px;color:var(--nm-muted);line-height:1.5}
.nm-settings .nm-quick-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:14px}
.nm-settings .nm-quick-card{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;background:linear-gradient(135deg,var(--nm-bg),color-mix(in srgb,var(--nm-card) 97%,var(--nm-bg)));border:1px solid var(--nm-border);border-radius:13px;cursor:pointer;gap:14px;transition:all .2s ease;box-shadow:0 2px 6px rgba(0,0,0,0.03)}.nm-settings .nm-quick-card:hover{border-color:var(--nm-accent);background:linear-gradient(135deg,color-mix(in srgb,var(--nm-accent) 8%,var(--nm-bg)),color-mix(in srgb,var(--nm-accent) 5%,var(--nm-card)));transform:translateY(-2px);box-shadow:0 5px 14px color-mix(in srgb,var(--nm-accent) 20%,transparent)}
.nm-settings .nm-toast{position:fixed;bottom:32px;right:32px;z-index:9999;padding:12px 24px;border-radius:999px;background:linear-gradient(135deg,var(--nm-raised),color-mix(in srgb,var(--nm-card) 95%,var(--nm-raised)));border:1px solid color-mix(in srgb,var(--nm-accent) 40%,var(--nm-border));color:var(--nm-text);font-size:13px;font-weight:650;box-shadow:0 10px 32px -6px rgba(0,0,0,0.35),0 0 0 1px color-mix(in srgb,var(--nm-accent) 20%,transparent);display:flex;align-items:center;gap:10px;animation:nm-toast-in .3s cubic-bezier(0.34,1.56,0.64,1);backdrop-filter:blur(12px)}
.nm-settings .nm-topic-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:14px}
.nm-settings .nm-path-box{display:flex;gap:8px;align-items:center}
@keyframes nm-toast-in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@keyframes nm-settings-load{to{background-position:-200% 0}}@media(max-width:700px){.nm-settings{padding:16px;gap:16px}.nm-settings .nm-hero{padding:20px}.nm-settings .nm-grid,.nm-settings .nm-three,.nm-settings .nm-workbench-pipeline,.nm-settings .nm-quick-grid,.nm-settings .nm-topic-grid{grid-template-columns:1fr}.nm-settings .nm-card{padding:18px}.nm-settings .nm-tabs button{padding:9px 12px}.nm-settings h2{font-size:22px}.nm-settings .nm-features{grid-template-columns:1fr}}@media(prefers-reduced-motion:reduce){.nm-settings *{animation:none!important;transition:none!important}}
.nm-help-btn{position:absolute;top:28px;right:28px;background:linear-gradient(135deg,var(--nm-accent),color-mix(in srgb,var(--nm-accent) 85%,#6366f1));color:white;border:0;border-radius:50%;width:44px;height:44px;font-size:22px;font-weight:700;cursor:pointer;display:grid;place-items:center;box-shadow:0 4px 16px rgba(0,0,0,0.18),0 0 0 0 var(--nm-accent);transition:all .25s ease;z-index:10}
.nm-help-btn:hover{transform:scale(1.08) rotate(5deg);box-shadow:0 8px 24px rgba(0,0,0,0.28),0 0 0 4px color-mix(in srgb,var(--nm-accent) 20%,transparent)}
.nm-guide-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.6);backdrop-filter:blur(6px);display:grid;place-items:center;z-index:9999;animation:nm-fade-in .25s ease;padding:20px}
.nm-guide-box{background:var(--nm-card);border-radius:24px;box-shadow:0 24px 70px rgba(0,0,0,0.35),0 0 0 1px color-mix(in srgb,var(--nm-accent) 15%,transparent);max-width:700px;width:100%;max-height:90vh;display:flex;flex-direction:column;animation:nm-slide-up .35s cubic-bezier(0.34,1.56,0.64,1);overflow:hidden}
.nm-guide-header{padding:32px 32px 24px;background:linear-gradient(135deg,color-mix(in srgb,var(--nm-accent) 8%,var(--nm-card)),var(--nm-card));border-bottom:1px solid color-mix(in srgb,var(--nm-accent) 15%,var(--nm-border));display:flex;align-items:center;gap:16px;position:relative}
.nm-guide-icon{font-size:48px;line-height:1;filter:drop-shadow(0 2px 8px rgba(0,0,0,0.12))}
.nm-guide-title{font-size:24px;font-weight:750;margin:0;flex:1;color:var(--nm-text);letter-spacing:-.5px}
.nm-guide-close{position:absolute;top:24px;right:24px;background:color-mix(in srgb,var(--nm-bg) 80%,transparent);border:0;color:var(--nm-muted);font-size:20px;cursor:pointer;width:36px;height:36px;border-radius:10px;display:grid;place-items:center;transition:all .2s ease;backdrop-filter:blur(8px)}
.nm-guide-close:hover{background:var(--nm-bg);color:var(--nm-text);transform:rotate(90deg)}
.nm-guide-content{padding:32px;overflow-y:auto;flex:1;line-height:1.7}
.nm-guide-intro{font-size:15px;color:var(--nm-text);margin:0 0 28px;padding:18px 20px;background:color-mix(in srgb,var(--nm-accent) 6%,var(--nm-bg));border-left:3px solid var(--nm-accent);border-radius:10px}
.nm-guide-section{margin:20px 0;padding:20px;background:var(--nm-bg);border-radius:14px;border:1px solid var(--nm-border);transition:all .2s ease}
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
.nm-guide-cmd{display:flex;align-items:center;gap:12px;padding:12px 16px;background:var(--nm-card);border:1px solid var(--nm-border);border-radius:10px;transition:all .2s ease}
.nm-guide-cmd:hover{border-color:var(--nm-accent);background:color-mix(in srgb,var(--nm-accent) 4%,var(--nm-card))}
.nm-guide-cmd code{font-family:ui-monospace,monospace;font-size:12px;background:color-mix(in srgb,var(--nm-accent) 12%,var(--nm-bg));color:var(--nm-accent);padding:5px 12px;border-radius:7px;border:1px solid color-mix(in srgb,var(--nm-accent) 20%,transparent);flex:1;font-weight:600}
.nm-guide-cmd-desc{font-size:11px;color:var(--nm-muted);white-space:nowrap}
.nm-guide-footer{padding:24px 32px;background:linear-gradient(to top,color-mix(in srgb,var(--nm-accent) 4%,var(--nm-card)),transparent);border-top:1px solid color-mix(in srgb,var(--nm-accent) 12%,var(--nm-border));display:flex;align-items:center;justify-content:space-between;gap:16px}
.nm-guide-footer-tip{font-size:12px;color:var(--nm-muted);display:flex;align-items:center;gap:8px}
.nm-guide-footer button{background:linear-gradient(135deg,var(--nm-accent),color-mix(in srgb,var(--nm-accent) 90%,#6366f1));border:0;color:white;cursor:pointer;font-size:14px;font-weight:650;padding:13px 32px;border-radius:12px;transition:all .2s ease;box-shadow:0 4px 14px color-mix(in srgb,var(--nm-accent) 30%,transparent)}
.nm-guide-footer button:hover{transform:translateY(-2px);box-shadow:0 6px 20px color-mix(in srgb,var(--nm-accent) 40%,transparent)}
@keyframes nm-fade-in{from{opacity:0}}
@keyframes nm-slide-up{from{transform:translateY(40px) scale(0.96);opacity:0}to{transform:translateY(0) scale(1);opacity:1}}
`
    const LABELS = {
      novel: '一键完本', continue: '续写', study: '拆书', outline: '大纲', cast: '人设',
      rewrite: '改写', review: '审校', idea: '构思', spark: '灵感', world: '世界', role: '角色',
      stats: '统计', export: '导出', conflict: '冲突分析', pace: '节奏分析', reader: '虚拟读者',
      dialogue: '对话增强', emotion: '情感曲线', market: '市场分析', compare: '作品对比',
      chapter: '章节生成', tips: '写作建议', trope: '套路分析', backup: '备份', merge: '合并', split: '拆分',
      learn: '学习记录', memory: '学习库', decide: '辅助决策', research: '资料检索',
    }
    const GROUPS = [
      ['writing', '写作', ['novel', 'continue', 'chapter', 'rewrite']],
      ['planning', '规划', ['idea', 'outline', 'cast', 'world', 'role', 'spark']],
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

    function SettingsPage(props) {
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
      const [activity, setActivity] = useState(null)
      const [activityError, setActivityError] = useState('')
      const [activityBusy, setActivityBusy] = useState(false)
      const [tab, setTab] = useState('features')
      const [search, setSearch] = useState('')
      const [loading, setLoading] = useState(!form)
      const [toast, setToast] = useState('')
      const [availableModels, setAvailableModels] = useState(FALLBACK_MODELS)
      const [showTutorial, setShowTutorial] = useState(false)
      const [tutorialStep, setTutorialStep] = useState(0)
      const alive = useRef(true)
      const saving = useRef(false)
      const operation = useRef(null)
      const dirty = useRef({})
      const activityRequest = useRef(null)
      const toastTimer = useRef(null)

      const showToast = text => {
        setToast(text)
        if (toastTimer.current) clearTimeout(toastTimer.current)
        toastTimer.current = setTimeout(() => { if (alive.current) setToast('') }, 2200)
      }

      const copyCommand = (cmdText, label = '') => {
        try {
          if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(cmdText).catch(() => {})
          }
        } catch {}
        showToast(`已复制：${cmdText}`)
      }

      const acceptForm = (next, saved = {}) => {
        setForm(next)
        for (const key of Object.keys(saved)) delete dirty.current[key]
        if (!dirty.current.projectsDir) setDirectory(next.value?.projectsDir ?? 'novel_projects')
        if (!dirty.current.updateProxy) setProxy(next.value?.updateProxy ?? '')
        if (!dirty.current.guidance) setGuidance({ ...GUIDANCE, ...next.value?.guidance })
        if (!dirty.current.learning) setLearning({ ...LEARNING, ...next.value?.learning })
        if (!dirty.current.decision) setDecision({ ...DECISION, ...next.value?.decision })
        if (!dirty.current.research) setResearch({ ...RESEARCH, ...next.value?.research })
        if (!dirty.current.batch) setBatchWrite({ ...BATCH, ...next.value?.batch })
      }
      const changed = (draft, original) => Object.keys(draft).some(key => String(draft[key]) !== String(original[key]))
      const editGuidance = (key, next) => setGuidance(current => { const draft = { ...current, [key]: next }; dirty.current.guidance = changed(draft, { ...GUIDANCE, ...form?.value?.guidance }); return draft })
      const editLearning = (key, next) => setLearning(current => { const draft = { ...current, [key]: next }; dirty.current.learning = changed(draft, { ...LEARNING, ...form?.value?.learning }); return draft })
      const editDecision = (key, next) => setDecision(current => { const draft = { ...current, [key]: next }; dirty.current.decision = changed(draft, { ...DECISION, ...form?.value?.decision }); return draft })
      const editResearch = (key, next) => setResearch(current => { const draft = { ...current, [key]: next }; dirty.current.research = changed(draft, { ...RESEARCH, ...form?.value?.research }); return draft })
      const editBatch = (key, next) => setBatchWrite(current => { const draft = { ...current, [key]: next }; dirty.current.batch = changed(draft, { ...BATCH, ...form?.value?.batch }); return draft })

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

      const pickDirectory = async targetField => {
        try {
          if (typeof window !== 'undefined' && window.__DSH_DIRECTORY_PICKER__?.pick) {
            const picked = await window.__DSH_DIRECTORY_PICKER__.pick()
            if (picked) {
              if (targetField === 'storageDir') editResearch('storageDir', picked)
              else if (targetField === 'learningStorageDir') editLearning('storageDir', picked)
              else if (targetField === 'projectsDir') { setDirectory(picked); dirty.current.projectsDir = true }
              showToast(`已选定目录：${picked}`)
            }
          } else {
            showToast('请在输入框中直接输入目标文件夹路径（支持绝对或相对路径）')
          }
        } catch {
          showToast('无法启动系统目录选择器，请手动输入路径。')
        }
      }

      const openGuide = () => setShowTutorial(true)
      const closeGuide = () => setShowTutorial(false)

      async function loadModels(signal) {
        if (!alive.current || signal?.aborted) return
        
        const ctx = props?.ctx
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
          h('button', { className: 'nm-help-btn', onClick: openGuide, 'aria-label': '查看帮助', title: '查看功能介绍' }, '?'),
          h('div', { className: 'nm-row nm-between' }, h('div', { className: 'nm-brand' }, h('div', { className: 'nm-logo', 'aria-hidden': true }, h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' }, h('path', { d: 'M12 6c-3-2-6-2-9-1v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1Z' }), h('path', { d: 'M12 6v14M6 9h3M6 12h3M15 9h3M15 12h3' }))), h('div', null, h('div', { className: 'nm-row' }, h('h2', null, '小说创作大师'), h('span', { className: 'nm-badge' }, 'v1.4.3')), h('p', { className: 'nm-muted' }, '把创作、经验与判断，整理成自己的写作工作台。'))), actionButton('刷新设置与状态', refresh)),
          h('div', { className: 'nm-row' }, chip(form ? value.enabled === false ? '小说功能已关闭' : '小说功能已启用' : '配置待连接', form && value.enabled !== false), chip(form ? `已选择 ${enabledCount(commandKeys)} / ${commandKeys.length} 项功能` : '功能加载中', !!form), chip(!form ? '引导模型待连接' : value.guidance?.enabled ? value.enabled === false ? '引导模型已暂停' : '引导模型已启用' : '引导模型未启用', !!form && value.enabled !== false && value.guidance?.enabled), chip(!form ? '学习状态待连接' : value.learning?.enabled ? value.enabled === false ? '学习总结已暂停' : '学习总结已启用' : '学习总结未启用', !!form && value.enabled !== false && value.learning?.enabled), chip(!form ? '决策状态待连接' : value.decision?.enabled ? value.enabled === false ? '决策助手已暂停' : '决策助手已启用' : '决策助手未启用', !!form && value.enabled !== false && value.decision?.enabled))),
        error && h('div', { role: 'alert', className: 'nm-alert' }, h('div', null, h('strong', null, '暂时无法完成操作'), h('p', null, error)), actionButton('重试连接', refresh)),
        notice && h('div', { role: 'status', className: 'nm-alert nm-success' }, notice),
        h('nav', { role: 'tablist', 'aria-label': '小说设置导航', className: 'nm-tabs' }, ...[['features', '功能选择'], ['guidance', '引导模型'], ['learning', '学习总结'], ['decision', '决策助手'], ['research', '资料检索'], ['batch', '批量写作'], ['updates', '更新维护']].map(([id, label], index, tabs) => h('button', { type: 'button', role: 'tab', id: `nm-tab-${id}`, 'aria-controls': `nm-panel-${id}`, 'aria-selected': tab === id, tabIndex: tab === id ? 0 : -1, onClick: () => setTab(id), onKeyDown: event => { const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1; if (next >= 0) { event.preventDefault(); setTab(tabs[next][0]); event.currentTarget.parentElement?.querySelector(`#nm-tab-${tabs[next][0]}`)?.focus() } } }, label))),
        !form && loading && h('div', { className: 'nm-grid', role: 'status', 'aria-label': '正在加载设置' }, ...[0, 1, 2, 3].map(key => h('div', { className: 'nm-skeleton', key }))),
        !form && !loading && h('div', { className: 'nm-card nm-empty' }, h('h3', null, '配置服务尚未连接'), h('p', null, '请确认插件已启用；安装或更新后可重启 DSH 再连接。'), actionButton('重新读取配置', refresh)),
        panel('features', form && card('创作工作台', '关闭总开关会移除功能命令并停止智能处理，配置和更新入口仍保留。',
          toggle('启用小说功能', value.enabled !== false, next => save({ enabled: next }), '已运行的写作目标可通过 /goal pause 暂停。'),
          h('form', { 'aria-label': '项目目录配置', onSubmit: event => { event.preventDefault(); if (directory.trim()) save({ projectsDir: directory.trim() }) } },
            h('div', { className: 'nm-field' },
              h('span', null, '项目目录'),
              h('div', { className: 'nm-path-box' },
                h('input', { type: 'text', value: directory, disabled: locked, required: true, 'aria-label': '项目目录', placeholder: 'novel_projects', onChange: event => { dirty.current.projectsDir = event.target.value !== (value.projectsDir ?? 'novel_projects'); setDirectory(event.target.value) } }),
                actionButton('📁 浏览…', () => pickDirectory('projectsDir'), locked)
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
                actionButton('📁 浏览目录…', () => pickDirectory('learningStorageDir'), locked)
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
             h('div', { className: 'nm-path-box' }, field('资料存储目录', 'storageDir', research, editResearch, 'text', { placeholder: 'novel_research 或绝对路径', required: true }), actionButton('📁 浏览目录…', () => pickDirectory('storageDir'), locked)),
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
         panel('updates', card('版本与更新', '按完整提交 SHA 安装，保留安装结果与代码重载结果。', h('div', { className: 'nm-three' }, ...[['当前运行', state?.running], ['磁盘安装', state?.disk], ['main 最新', state?.latest]].map(([label, info]) => h('div', { className: 'nm-metric', key: label }, h('span', null, label), h('strong', null, info?.version ?? (label === 'main 最新' ? '尚未检查' : '未知')), h('code', null, short(info?.commit))))),
          state?.latest && h('p', { className: 'nm-callout' }, state.updateAvailable === false ? '磁盘已是此提交。' : state.updateAvailable === null ? '本地提交未知，版本号相同不能证明代码相同。' : '发现可安装的提交。检查后拉取会锁定本次完整 SHA。'),
          h('div', { className: 'nm-row' }, actionButton(busy === 'check' ? '检查中…' : '检查更新', () => run('check'), locked, true), actionButton(busy === 'apply' ? '正在拉取并安装…' : '拉取此提交', () => run('apply'), locked || !state?.latest), (busy === 'apply' || state?.busy) && actionButton('取消安装', cancel, false)), state?.result && h('p', { className: 'nm-callout' }, `最近安装结果：${state.result.application}${state.result.codeReload ? `；代码重载：${state.result.codeReload.application}` : ''}`)),
          form && card('更新网络', '代理只影响更新检查；安装使用 DSH 插件管理器的网络设置。', h('form', { 'aria-label': '更新代理配置', onSubmit: event => { event.preventDefault(); save({ updateProxy: proxy.trim() }) } }, field('更新检查代理', 'proxy', { proxy }, (_, next) => { dirty.current.updateProxy = next !== (value.updateProxy ?? ''); setProxy(next) }, 'text', { placeholder: 'http://127.0.0.1:7897' }), h('p', { className: 'nm-muted' }, '留空使用代理环境变量或直连。'), saveBar('updateProxy', '保存更新代理'))),
          card('运行维护', '代码重载切换 Host 运行实例，刷新界面只重新加载浏览器页面。', h('div', { className: 'nm-row' }, actionButton('重载插件', () => run('reload'), locked || !state?.reloadSupported), actionButton('刷新界面', () => window.location.reload(), !!busy)), !state?.reloadSupported && h('p', { className: 'nm-muted' }, '当前运行实例未提供可用重载入口，需要时请重启 DSH。'))),
        toast && h('div', { className: 'nm-toast', role: 'status' }, toast),
        showTutorial && h('div', { className: 'nm-guide-overlay', onClick: closeGuide },
          h('div', { className: 'nm-guide-box', onClick: e => e.stopPropagation() },
            h('div', { className: 'nm-guide-header' },
              h('div', { className: 'nm-guide-icon' }, '📚'),
              h('h3', { className: 'nm-guide-title' }, '小说创作大师'),
              h('button', { className: 'nm-guide-close', onClick: closeGuide, 'aria-label': '关闭' }, '✕')
            ),
            h('div', { className: 'nm-guide-content' },
              h('p', { className: 'nm-guide-intro' }, '强大的 AI 辅助小说创作插件，帮助您轻松完成长篇小说创作'),
              
              h('div', { className: 'nm-guide-section' },
                h('div', { className: 'nm-guide-section-header' },
                  h('div', { className: 'nm-guide-section-icon' }, '🎯'),
                  h('h4', { className: 'nm-guide-section-title' }, '引导-写作分离架构')
                ),
                h('div', { className: 'nm-guide-section-content' },
                  h('p', null, '使用强模型引导规划 + 快速模型执行写作的双模型协作架构'),
                  h('ul', null,
                    h('li', null, '引导模型（如 Claude Opus）负责分析上下文、拆解任务、生成详细大纲'),
                    h('li', null, '写作模型（如 Gemini 4 Argon）接收大纲指令、专注文字生成'),
                    h('li', null, '推荐配置：Claude Opus 5.5 (引导) + Gemini 4 Argon (写作)'),
                    h('li', null, '预算友好：Claude Opus 5.5 (引导) + Gemini 2.5 Flash (写作)')
                  )
                )
              ),
              
              h('div', { className: 'nm-guide-section' },
                h('div', { className: 'nm-guide-section-header' },
                  h('div', { className: 'nm-guide-section-icon' }, '📖'),
                  h('h4', { className: 'nm-guide-section-title' }, '学习总结功能')
                ),
                h('div', { className: 'nm-guide-section-content' },
                  h('p', null, '自动总结每章创作的关键信息，建立项目知识库，后续章节自动复用历史总结')
                )
              ),
              
              h('div', { className: 'nm-guide-section' },
                h('div', { className: 'nm-guide-section-header' },
                  h('div', { className: 'nm-guide-section-icon' }, '🤔'),
                  h('h4', { className: 'nm-guide-section-title' }, 'AI 决策助手')
                ),
                h('div', { className: 'nm-guide-section-content' },
                  h('p', null, '在剧情分岔、审校取舍等场景提供智能建议，帮助您做出更好的创作决策')
                )
              ),
              
              h('div', { className: 'nm-guide-section' },
                h('div', { className: 'nm-guide-section-header' },
                  h('div', { className: 'nm-guide-section-icon' }, '🚀'),
                  h('h4', { className: 'nm-guide-section-title' }, '常用命令')
                ),
                h('div', { className: 'nm-guide-section-content' },
                  h('div', { className: 'nm-guide-commands' },
                    h('div', { className: 'nm-guide-cmd' },
                      h('code', null, '/novel 网管发现网吧的电脑能修仙 60章'),
                      h('span', { className: 'nm-guide-cmd-desc' }, '一键完本')
                    ),
                    h('div', { className: 'nm-guide-cmd' },
                      h('code', null, '/novel-continue 项目名 续写20章'),
                      h('span', { className: 'nm-guide-cmd-desc' }, '智能续写')
                    ),
                    h('div', { className: 'nm-guide-cmd' },
                      h('code', null, '/novel-chapter 项目名 写第5章'),
                      h('span', { className: 'nm-guide-cmd-desc' }, '写单章')
                    ),
                    h('div', { className: 'nm-guide-cmd' },
                      h('code', null, '/novel-update check'),
                      h('span', { className: 'nm-guide-cmd-desc' }, '检查更新')
                    )
                  ),
                  h('p', { style: { marginTop: '12px', fontSize: '12px', color: 'var(--nm-muted)' } }, 
                    '更多命令请使用 ', h('code', null, '/help novel'), ' 查看详细文档'
                  )
                )
              )
            ),
            h('div', { className: 'nm-guide-footer' },
              h('div', { className: 'nm-guide-footer-tip' },
                h('span', null, '💡'),
                h('span', null, '点击右上角 ? 可随时查看')
              ),
              h('button', { onClick: closeGuide }, '开始使用 →')
            )
          )
        ),
        h('footer', { className: 'nm-footer' }, '创作由你掌舵 · 功能按需开启 · 配置保存后生效'))
    }
    return {
      name: 'novel-master', inject: ['slots', 'remote', 'remote.llm'],
      apply(ctx) {
        ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section', id: 'novel-master', order: 36, label: () => '小说创作大师',
        }, props => h(SettingsPage, { ...props, ctx })))
      },
    }
  },
})
