// Run against a production server: pnpm start --port 3002, then pnpm test:browser.
// All authentication is mocked in an isolated browser context; Firestore is blocked.
import { readFile, mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { default: AxeBuilder } = await import(process.env.AXE_MODULE || '@axe-core/playwright');
await mkdir('test-results', { recursive: true });
const base = process.env.GITA_BASE_URL || 'http://localhost:3002';
const engine = 'chromium';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
const uid = 'local-e2e-learner';
const apiKey = (await readFile('src/lib/firebase.ts', 'utf8')).match(/apiKey: "([^"]+)/)[1];
const token = ['eyJhbGciOiJub25lIn0', Buffer.from(JSON.stringify({ sub: uid, user_id: uid, aud: 'bhagavad-gita-pwa', iss: 'https://securetoken.google.com/bhagavad-gita-pwa', exp: Math.floor(Date.now()/1000)+86400, iat: Math.floor(Date.now()/1000), auth_time: Math.floor(Date.now()/1000), firebase: { sign_in_provider: 'google.com' } })).toString('base64url'), 'test'].join('.');
await context.route('**/identitytoolkit.googleapis.com/**', route => route.fulfill({headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET, POST, OPTIONS'},contentType:'application/json',body:JSON.stringify({ users:[{localId:uid,email:'learner@example.test',emailVerified:true,displayName:'Test Learner',providerUserInfo:[],lastLoginAt:String(Date.now()),createdAt:String(Date.now())}]})}));
await context.route('**/securetoken.googleapis.com/**', route => route.fulfill({headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET, POST, OPTIONS'},contentType:'application/json',body:JSON.stringify({access_token:token,expires_in:'86400',refresh_token:'test',token_type:'Bearer',user_id:uid,project_id:'669306804260'})}));
await context.route('**/firestore.googleapis.com/**', route => route.abort());
await context.addInitScript(async ({uid, apiKey, token}) => {
  if (!location.origin.startsWith('http')) return;
  if (!sessionStorage.getItem('seeded')) {
    const today = new Date(); const date = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    localStorage.setItem(`gita-learning-state-v4:${uid}`,JSON.stringify({schemaVersion:4,startedAt:date,lastActiveDate:date,lastPracticeDate:'',streakCount:0,activeMode:'normal',completed:{},recallWins:0,recallAttempts:0,activeIndex:0,contentMode:'transliteration'}));
    localStorage.setItem(`gita-profile-v1:${uid}`,JSON.stringify({customName:'Test Learner',favorites:['GS-001'],lineCues:{}}));
    sessionStorage.setItem('seeded','1');
  }
  // Local persistence is seeded synchronously too: WebKit does not wait for async init scripts.
  localStorage.setItem(`firebase:authUser:${apiKey}:[DEFAULT]`, JSON.stringify({uid,email:'learner@example.test',emailVerified:true,displayName:'Test Learner',isAnonymous:false,providerData:[],stsTokenManager:{refreshToken:'test',accessToken:token,expirationTime:Date.now()+86400000},createdAt:String(Date.now()),lastLoginAt:String(Date.now()),apiKey,appName:'[DEFAULT]'}));
  const db = await new Promise((resolve,reject)=> { const r=indexedDB.open('firebaseLocalStorageDb',1); r.onupgradeneeded=()=>r.result.createObjectStore('firebaseLocalStorage',{keyPath:'fbase_key'}); r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error); });
  const tx = db.transaction('firebaseLocalStorage','readwrite');
  tx.objectStore('firebaseLocalStorage').put({ fbase_key:`firebase:authUser:${apiKey}:[DEFAULT]`, value:{uid,email:'learner@example.test',emailVerified:true,displayName:'Test Learner',isAnonymous:false,providerData:[],stsTokenManager:{refreshToken:'test',accessToken:token,expirationTime:Date.now()+86400000},createdAt:String(Date.now()),lastLoginAt:String(Date.now()),apiKey,appName:'[DEFAULT]'} });
  await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=reject}); db.close();
}, {uid,apiKey,token});
const page = await context.newPage(); page.setDefaultTimeout(15000); if(process.env.GITA_DEBUG_AUTH) { page.on('console',m=>console.log('Browser:',m.type(),m.text())); page.on('requestfailed',r=>console.log('Request failed:',r.url(),r.failure()?.errorText)); } const errors=[];page.on('pageerror',e=>errors.push(e.message));
try {
await page.goto(base); await page.reload(); await page.getByText('Daily Goal:',{exact:false}).waitFor({timeout:30000});
console.log('Logged into isolated test session');
const assert = (value, message) => { if (!value) throw new Error(message); };
await page.getByRole('button',{name:'Learned',exact:true}).click();
await page.getByRole('button',{name:'Yes, Mark Learned'}).click();
await page.getByText('Daily Goal: 1 / 2 completed',{exact:true}).waitFor();
await page.getByRole('button',{name:'Learned',exact:true}).click();
await page.getByRole('button',{name:'Yes, Mark Learned'}).click();
await page.getByText('Daily Goal: 2 / 2 completed',{exact:true}).waitFor();
await page.reload(); await page.getByText('Daily Goal: 2 / 2 completed',{exact:true}).waitFor();
console.log('Daily count advances one verse at a time and survives reload');
await page.evaluate(async () => { await navigator.serviceWorker.ready; });
await page.waitForFunction(() => !!navigator.serviceWorker.controller);
await page.getByRole('button',{name:'Download 2.11',exact:true}).click();
await page.getByText('1 new verse(s) saved for offline playback.',{exact:true}).waitFor();
console.log('Downloaded the active verse');
await page.locator('summary').filter({hasText:'Pronunciation & word meanings'}).click();
assert(await page.getByText('Chant in Tamil · தமிழ் உச்சரிப்பு',{exact:true}).isVisible(),'Tamil pronunciation missing');
await page.locator('summary').filter({hasText:'Line-by-line practice'}).click();
await page.getByRole('button',{name:'Set line timings',exact:true}).waitFor();
await page.waitForFunction(() => document.querySelector('audio').duration > 0);
await page.getByRole('button',{name:'Set line timings',exact:true}).click(); await page.waitForFunction(()=>document.querySelector('audio').currentTime>0.1 && !document.querySelector('audio').paused);
const n=await page.locator('details').filter({has:page.locator('summary').filter({hasText:'Line-by-line practice'})}).locator('ol li').count();
for(let i=0;i<n;i++) {
  await page.evaluate(time=>{const audio=document.querySelector('audio');audio.pause();audio.currentTime=time;},(i+1)*0.5); await page.waitForFunction(()=>!document.querySelector('audio').seeking);
  await page.getByRole('button',{name:`Mark end of line ${i+1}`,exact:true}).click();
}
await page.getByText('Line timings saved for this recording.',{exact:false}).waitFor();
await page.getByLabel('Repetitions',{exact:false}).selectOption('1');
await page.getByLabel('Continue to next line',{exact:true}).uncheck();
await page.getByRole('button',{name:'Practise from line 1',exact:true}).click();
await page.getByText('Your turn — chant this line',{exact:true}).waitFor();
await page.getByText('Practice finished. Try recalling the verse.',{exact:true}).waitFor();
console.log('Calibrated line boundaries, played a line and waited for the learner response');
await page.getByRole('button',{name:'Practise from line 1',exact:true}).click();
await page.getByText('Your turn — chant this line',{exact:true}).waitFor();
await page.getByRole('button',{name:'Stop playback',exact:true}).click();
await page.waitForTimeout(1400); // Longer than the response timer in this short calibrated fixture.
assert(await page.locator('audio').evaluate(a=>a.paused),'Stopping practice allowed delayed audio to restart');
const seek=page.getByRole('slider',{name:'Audio position',exact:true});
await seek.focus(); await page.keyboard.press('ArrowRight');
assert(await page.getByText(/Ch 2.*Shloka 11/i).count()>0,'Seek key navigated to another verse');
// Seed an overdue date to exercise revision UI with real saved progress.
await page.evaluate(uid => {const key=`gita-learning-state-v4:${uid}`; const s=JSON.parse(localStorage.getItem(key));s.reviews['GS-001'].dueDate='2000-01-01';localStorage.setItem(key,JSON.stringify(s));},uid);
await page.reload(); await page.getByRole('button',{name:'Start review',exact:true}).click();
await page.getByRole('button',{name:'Reveal verse',exact:true}).click();
await page.getByRole('button',{name:'Forgot',exact:false}).click();
await page.getByRole('button',{name:'Reveal verse',exact:true}).click();
await page.getByRole('button',{name:'Difficult',exact:false}).click();
await page.getByText('Reviews complete for today.',{exact:false}).waitFor();
await page.getByRole('button',{name:'Close',exact:true}).click();
console.log('Forgot keeps a verse due; Difficult schedules it for tomorrow');
await page.getByRole('button',{name:'Open profile',exact:true}).click();
const downloadEvent = page.waitForEvent('download'); await page.getByRole('button',{name:'Export',exact:true}).click();
const download=await downloadEvent; const path=await download.path();
const fs=await import('node:fs/promises'); const backup=JSON.parse(await fs.readFile(path,'utf8'));
assert(backup.profile.favorites.includes('GS-001'),'Favourite missing from backup');
assert(backup.profile.lineCues['GS-003'].length===n+1,'Line timings missing from backup');
const chooserEvent=page.waitForEvent('filechooser'); await page.getByRole('button',{name:'Import',exact:true}).click(); const chooser=await chooserEvent;
await chooser.setFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
await page.getByRole('heading',{name:'Restore this backup?',exact:true}).waitFor();
await page.getByRole('button',{name:'Cancel',exact:true}).click();
const oldChooserEvent=page.waitForEvent('filechooser'); await page.getByRole('button',{name:'Import',exact:true}).click();
const oldChooser=await oldChooserEvent;
await oldChooser.setFiles({name:'old-progress.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup.progress))});
await page.getByRole('button',{name:'Merge backup',exact:true}).click();
await page.getByText('Daily Goal: 2 / 2 completed',{exact:true}).waitFor();
assert(await page.evaluate(uid=>JSON.parse(localStorage.getItem(`gita-profile-v1:${uid}`)).favorites.includes('GS-001'),uid),'Old backup import lost favourites');
console.log('Full backup includes favourites and timings; old progress backups merge without losing them');
await context.setOffline(true);
await page.reload(); await page.getByText('Daily Goal: 2 / 2 completed',{exact:true}).waitFor();
// navigator.onLine reflects OS connectivity and can remain true under simulated packet loss.
const range = await page.evaluate(async()=>{const r=await fetch('/audio/2.11.mp3',{headers:{Range:'bytes=0-15'}});return {status:r.status,length:(await r.arrayBuffer()).byteLength};});
assert(range.status===206 && range.length===16,'Offline byte range failed');
await page.getByRole('button',{name:'Play audio',exact:true}).click();
await page.waitForFunction(()=>document.querySelector('audio').currentTime>0.1);
await page.getByRole('button',{name:'Pause audio',exact:true}).click();
console.log('Production shell reloads offline, and downloaded audio plays with HTTP range support');
await context.setOffline(false);
for(const width of [320,768,1024,1440]) {
 await page.setViewportSize({width,height:900});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Horizontal overflow at ${width}`);
 await page.screenshot({path:`test-results/learning-${engine}-${width}.png`,fullPage:true});
}
const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
assert(axe.violations.length === 0, `Accessibility issues: ${JSON.stringify(axe.violations.map(v => ({id:v.id,nodes:v.nodes.map(n=>n.target)})))}`);
// Expanded tools and dark mode must also remain accessible.
for (const summary of await page.locator('main details > summary').all()) {
 if (!(await summary.evaluate(el=>el.parentElement.open))) await summary.click();
}
const expanded=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
assert(expanded.violations.length===0, `Expanded tool accessibility: ${JSON.stringify(expanded.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})))}`);
await page.getByRole('button',{name:'Toggle theme',exact:true}).click();
await page.waitForFunction(()=>document.documentElement.classList.contains('dark'));
const dark=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
assert(dark.violations.length===0, `Dark mode accessibility: ${JSON.stringify(dark.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})))}`);
await page.screenshot({path:`test-results/learning-${engine}-dark.png`,fullPage:true});
await page.getByRole('button',{name:'Open profile',exact:true}).click();
const profileAudit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
assert(profileAudit.violations.length===0, `Profile accessibility: ${JSON.stringify(profileAudit.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})))}`);
await page.getByRole('button',{name:'Close',exact:true}).click();
console.log('Expanded study tools, dark theme and profile pass accessibility checks');
// A changed registration URL exercises a genuine waiting-worker lifecycle without changing app files.
await page.evaluate(async()=>{await navigator.serviceWorker.register('/sw.js?browser-check=update',{scope:'/',updateViaCache:'none'});});
await page.getByRole('button',{name:'Update now',exact:true}).waitFor();
const reloaded=page.waitForEvent('load'); await page.getByRole('button',{name:'Update now',exact:true}).click(); await reloaded;
await page.getByText('Daily Goal: 2 / 2 completed',{exact:true}).waitFor();
console.log('Waiting update prompts before reload and preserves saved progress');
assert(errors.length===0,`Browser errors: ${errors.join(', ')}`);
console.log('Responsive widths and accessibility checks passed; no browser errors.');
await browser.close();

} catch (e) { console.log((await page.locator('body').innerText()).slice(-3500)); await page.screenshot({path:`test-results/learning-${engine}-failure.png`,fullPage:true}); await browser.close(); throw e; }
