<script setup lang="ts">
import { ref } from 'vue'

const bookmarkletCode = `javascript:(function(){if(document.getElementById('custom-section-nav'))return;const dialog=document.querySelector('dialog[class*="sectionNav"]');if(!dialog){alert('Section nav not found');return;}const labels=['Abilities','Actions','Inventory','Spells','Features','Background','Notes','Extras'];const navBar=document.createElement('div');navBar.id='custom-section-nav';navBar.style.cssText='position:fixed;bottom:0;left:0;right:0;background:#1c1c1e;padding:10px 10px calc(10px + env(safe-area-inset-bottom,0px));display:flex;justify-content:center;gap:12px;flex-wrap:wrap;z-index:99999;border-top:1px solid #333;touch-action:manipulation;';document.body.style.overscrollBehavior='none';document.documentElement.style.overscrollBehavior='none';const seen=new Set();let idx=0;let activeBtn=null;const buttons=[];const btnTitles=[];dialog.querySelectorAll('button[class*="sectionButton"]').forEach(btn=>{if(btn.className.includes('mobile'))return;const svg=btn.querySelector('svg');if(!svg)return;const title=btn.textContent.trim().split(',')[0];if(seen.has(title))return;seen.add(title);btnTitles.push(title);const wrapper=document.createElement('div');wrapper.style.cssText='display:flex;flex-direction:column;align-items:center;gap:4px;';const clone=document.createElement('button');clone.innerHTML=svg.outerHTML;clone.title=labels[idx]||title;clone.dataset.btnTitle=title;clone.style.cssText='width:56px;height:56px;border-radius:50%;background:#c53131;border:3px solid transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:12px;transition:all 0.15s ease;';const cloneSvg=clone.querySelector('svg');cloneSvg.style.cssText='width:100%;height:100%;';cloneSvg.querySelectorAll('*').forEach(el=>{el.removeAttribute('fill');el.removeAttribute('stroke');el.style.fill='white';el.style.stroke='none';});const label=document.createElement('span');label.textContent=labels[idx]||title;label.style.cssText='color:white;font-size:10px;text-align:center;transition:color 0.15s ease;';wrapper.appendChild(clone);wrapper.appendChild(label);clone.addEventListener('click',()=>{const dlg=document.querySelector('dialog[class*="sectionNav"]');if(!dlg)return;const targetTitle=clone.dataset.btnTitle;let found=null;dlg.querySelectorAll('button[class*="sectionButton"]').forEach(b=>{if(b.className.includes('mobile'))return;const t=b.textContent.trim().split(',')[0];if(t===targetTitle)found=b;});if(found)found.click();if(activeBtn){activeBtn.btn.style.border='3px solid transparent';activeBtn.btn.style.background='#c53131';activeBtn.label.style.color='white';}clone.style.border='3px solid #ff6b6b';clone.style.background='#8b0000';label.style.color='#ff6b6b';activeBtn={btn:clone,label};});buttons.push({clone,label});navBar.appendChild(wrapper);idx++;});const fsWrapper=document.createElement('div');fsWrapper.style.cssText='display:flex;flex-direction:column;align-items:center;gap:4px;margin-left:12px;border-left:1px solid #444;padding-left:12px;';const fsBtn=document.createElement('button');fsBtn.innerHTML='<svg viewBox="0 0 24 24" fill="white" style="width:100%;height:100%;"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>';fsBtn.title='Fullscreen';fsBtn.style.cssText='width:56px;height:56px;border-radius:50%;background:#444;border:3px solid transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:14px;transition:all 0.15s ease;';const fsLabel=document.createElement('span');fsLabel.textContent='Fullscreen';fsLabel.style.cssText='color:white;font-size:10px;text-align:center;';fsWrapper.appendChild(fsBtn);fsWrapper.appendChild(fsLabel);fsBtn.addEventListener('click',()=>{if(!document.fullscreenElement){document.documentElement.requestFullscreen();fsBtn.innerHTML='<svg viewBox="0 0 24 24" fill="white" style="width:100%;height:100%;"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>';}else{document.exitFullscreen();fsBtn.innerHTML='<svg viewBox="0 0 24 24" fill="white" style="width:100%;height:100%;"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>';}});navBar.appendChild(fsWrapper);document.body.appendChild(navBar);const sheet=document.querySelector('.ct-character-sheet');if(sheet)sheet.style.paddingBottom='110px';const toggle=document.querySelector('button[class*="navToggle"]');if(toggle)toggle.style.display='none';document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement)fsBtn.innerHTML='<svg viewBox="0 0 24 24" fill="white" style="width:100%;height:100%;"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>';});})();`

const copied = ref(false)

function copyToClipboard() {
  navigator.clipboard.writeText(bookmarkletCode)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}
</script>

<template>
  <div class="min-h-screen bg-zinc-950 text-zinc-100 px-4 py-8">
    <div class="max-w-3xl mx-auto">
      <h1 class="text-3xl font-bold text-red-500 mb-2">Tools</h1>
      <p class="text-zinc-400 mb-8">Useful utilities for your adventuring needs.</p>

      <!-- Chrome Extension -->
      <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-6">
        <div class="flex items-start gap-4 mb-4">
          <div class="w-12 h-12 bg-red-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
            <span class="text-2xl">🐉</span>
          </div>
          <div>
            <h2 class="text-xl font-semibold text-white mb-1">West Marches Companion</h2>
            <p class="text-zinc-400 text-sm">Chrome extension for D&D Beyond integration — quick nav, map sidebar, and more.</p>
          </div>
        </div>

        <div class="bg-zinc-950 rounded-lg p-4 mb-4">
          <h3 class="text-sm font-medium text-zinc-300 mb-3">Features</h3>
          <ul class="text-sm text-zinc-400 space-y-2">
            <li class="flex items-start gap-2">
              <span class="text-red-500 mt-0.5">•</span>
              <span><strong class="text-zinc-200">Command Palette</strong> (Ctrl+K) — Quick search for D&D Beyond pages and West Marches content</span>
            </li>
            <li class="flex items-start gap-2">
              <span class="text-red-500 mt-0.5">•</span>
              <span><strong class="text-zinc-200">Map Sidebar</strong> (Ctrl+Shift+M) — View the hex map without leaving D&D Beyond</span>
            </li>
            <li class="flex items-start gap-2">
              <span class="text-red-500 mt-0.5">•</span>
              <span><strong class="text-zinc-200">Quick NPC</strong> — Create NPCs on the fly during sessions</span>
            </li>
            <li class="flex items-start gap-2">
              <span class="text-red-500 mt-0.5">•</span>
              <span><strong class="text-zinc-200">Quick Notes</strong> — Jot down notes that sync to West Marches</span>
            </li>
          </ul>
        </div>

        <div class="bg-zinc-950 rounded-lg p-4 mb-4">
          <h3 class="text-sm font-medium text-zinc-300 mb-3">How to Install</h3>
          <ol class="text-sm text-zinc-400 space-y-3">
            <li class="flex items-start gap-3">
              <span class="w-5 h-5 bg-red-900/50 text-red-400 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold">1</span>
              <span><strong class="text-zinc-200">Download</strong> the extension zip file using the button below.</span>
            </li>
            <li class="flex items-start gap-3">
              <span class="w-5 h-5 bg-red-900/50 text-red-400 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold">2</span>
              <span><strong class="text-zinc-200">Extract</strong> the zip to a folder on your computer.</span>
            </li>
            <li class="flex items-start gap-3">
              <span class="w-5 h-5 bg-red-900/50 text-red-400 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold">3</span>
              <span>Open Chrome and go to <code class="bg-zinc-800 px-1.5 py-0.5 rounded text-red-400">chrome://extensions</code></span>
            </li>
            <li class="flex items-start gap-3">
              <span class="w-5 h-5 bg-red-900/50 text-red-400 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold">4</span>
              <span><strong class="text-zinc-200">Enable Developer mode</strong> (toggle in top right corner).</span>
            </li>
            <li class="flex items-start gap-3">
              <span class="w-5 h-5 bg-red-900/50 text-red-400 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold">5</span>
              <span>Click <strong class="text-zinc-200">"Load unpacked"</strong> and select the extracted folder.</span>
            </li>
          </ol>
        </div>

        <a
          href="/downloads/westmarches-companion.zip"
          download
          class="w-full py-3 px-4 rounded-lg font-medium bg-red-600 hover:bg-red-500 text-white transition-all flex items-center justify-center gap-2"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download Extension (.zip)
        </a>

        <p class="text-xs text-zinc-500 mt-3 text-center">
          Works on Chrome, Edge, Brave, and other Chromium browsers.
        </p>
      </div>

      <!-- D&D Beyond Nav Bookmarklet -->
      <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-6">
        <div class="flex items-start gap-4 mb-4">
          <div class="w-12 h-12 bg-red-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg class="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </div>
          <div>
            <h2 class="text-xl font-semibold text-white mb-1">D&D Beyond Quick Nav</h2>
            <p class="text-zinc-400 text-sm">Adds a bottom navigation bar to D&D Beyond character sheets for quick section access on mobile and tablet.</p>
          </div>
        </div>

        <div class="bg-zinc-950 rounded-lg p-4 mb-4">
          <h3 class="text-sm font-medium text-zinc-300 mb-3">Features</h3>
          <ul class="text-sm text-zinc-400 space-y-2">
            <li class="flex items-start gap-2">
              <span class="text-red-500 mt-0.5">•</span>
              <span>Quick access buttons for Abilities, Actions, Inventory, Spells, Features, Background, Notes, and Extras</span>
            </li>
            <li class="flex items-start gap-2">
              <span class="text-red-500 mt-0.5">•</span>
              <span>Active section highlighting — see which page you're on</span>
            </li>
            <li class="flex items-start gap-2">
              <span class="text-red-500 mt-0.5">•</span>
              <span>Fullscreen toggle for distraction-free viewing</span>
            </li>
            <li class="flex items-start gap-2">
              <span class="text-red-500 mt-0.5">•</span>
              <span>Prevents accidental swipe navigation on tablets</span>
            </li>
          </ul>
        </div>

        <div class="bg-zinc-950 rounded-lg p-4 mb-4">
          <h3 class="text-sm font-medium text-zinc-300 mb-3">How to Install</h3>
          <ol class="text-sm text-zinc-400 space-y-3">
            <li class="flex items-start gap-3">
              <span class="w-5 h-5 bg-red-900/50 text-red-400 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold">1</span>
              <span><strong class="text-zinc-200">Copy the bookmarklet code</strong> using the button below.</span>
            </li>
            <li class="flex items-start gap-3">
              <span class="w-5 h-5 bg-red-900/50 text-red-400 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold">2</span>
              <span><strong class="text-zinc-200">Create a new bookmark</strong> in your browser (right-click bookmark bar → "Add page" or similar).</span>
            </li>
            <li class="flex items-start gap-3">
              <span class="w-5 h-5 bg-red-900/50 text-red-400 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold">3</span>
              <span><strong class="text-zinc-200">Name it</strong> something like "DDB Nav".</span>
            </li>
            <li class="flex items-start gap-3">
              <span class="w-5 h-5 bg-red-900/50 text-red-400 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold">4</span>
              <span><strong class="text-zinc-200">Paste the code</strong> into the URL/Address field (replace any existing URL).</span>
            </li>
            <li class="flex items-start gap-3">
              <span class="w-5 h-5 bg-red-900/50 text-red-400 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold">5</span>
              <span><strong class="text-zinc-200">Save the bookmark.</strong></span>
            </li>
          </ol>
        </div>

        <div class="bg-zinc-950 rounded-lg p-4 mb-4">
          <h3 class="text-sm font-medium text-zinc-300 mb-3">How to Use</h3>
          <ol class="text-sm text-zinc-400 space-y-2">
            <li class="flex items-start gap-3">
              <span class="w-5 h-5 bg-zinc-800 text-zinc-400 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold">1</span>
              <span>Open your character sheet on <a href="https://www.dndbeyond.com" target="_blank" class="text-red-400 hover:text-red-300 underline">D&D Beyond</a>.</span>
            </li>
            <li class="flex items-start gap-3">
              <span class="w-5 h-5 bg-zinc-800 text-zinc-400 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold">2</span>
              <span>Click/tap the bookmarklet from your bookmarks.</span>
            </li>
            <li class="flex items-start gap-3">
              <span class="w-5 h-5 bg-zinc-800 text-zinc-400 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold">3</span>
              <span>The navigation bar will appear at the bottom of the screen!</span>
            </li>
          </ol>
        </div>

        <!-- Copy button -->
        <button
          @click="copyToClipboard"
          :class="[
            'w-full py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2',
            copied
              ? 'bg-green-600 text-white'
              : 'bg-red-600 hover:bg-red-500 text-white'
          ]"
        >
          <svg v-if="!copied" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
          </svg>
          <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          {{ copied ? 'Copied!' : 'Copy Bookmarklet Code' }}
        </button>

        <p class="text-xs text-zinc-500 mt-3 text-center">
          Works on desktop and mobile browsers. On iOS, you may need to add the bookmark via Safari on desktop and sync.
        </p>
      </div>
    </div>
  </div>
</template>
