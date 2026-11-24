// Run against a production server: pnpm start --port 3002, then pnpm test:browser.
// All authentication is mocked in an isolated browser context; Firestore is blocked.
import { readFile, mkdir } from 'node:fs/promises';
const { chromium, webkit } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
// GITA_BROWSER=webkit runs the same flow in WebKit (Safari's engine).
const engine = process.env.GITA_BROWSER === 'webkit' ? webkit : chromium;
const { default: AxeBuilder } = await import(process.env.AXE_MODULE || '@axe-core/playwright');
await mkdir('test-results', { recursive: true });
const base = process.env.GITA_BASE_URL || 'http://localhost:3002';
const browser = await engine.launch({ headless: true, ...(engine === chromium && { args: ['--disable-features=HardwareMediaKeyHandling,MediaSessionService'] }) });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
const uid = 'local-e2e-learner';
const chapterFixture = await readFile('public/audio/1.1.mp3');
const chapterRequests = [];
context.on('request', request => {
 if (/\/chapter-\d+\.mp3$/.test(new URL(request.url()).pathname)) chapterRequests.push(request.url());
});
await context.route(/\/chapter-\d+\.mp3(?:\?.*)?$/, route => {
 const range = /^bytes=(\d+)-(\d*)$/.exec(route.request().headers().range || '');
 const headers = {'Content-Type':'audio/mpeg','Accept-Ranges':'bytes'};
 if (!range) return route.fulfill({headers,body:chapterFixture});
 const start = Number(range[1]);
 const end = Math.min(range[2] ? Number(range[2]) : chapterFixture.length - 1, chapterFixture.length - 1);
 if (start > end) return route.fulfill({status:416,headers:{...headers,'Content-Range':`bytes */${chapterFixture.length}`}});
 return route.fulfill({status:206,headers:{...headers,'Content-Range':`bytes ${start}-${end}/${chapterFixture.length}`},body:chapterFixture.subarray(start,end+1)});
});
await context.addInitScript(() => {
 // Headless browsers exercise the app's callbacks with real audio elements. A phone drives the system widget.
 const actions = new Map();
 const media = {
  actions, metadata:null, playbackState:'none', position:null,
  setActionHandler(action, handler) { if (handler) actions.set(action,handler); else actions.delete(action); },
  setPositionState(position) { this.position = position ?? null; },
 };
 Object.defineProperty(navigator,'mediaSession',{configurable:true,value:media});
 if (!window.MediaMetadata) window.MediaMetadata = class { constructor(value) { Object.assign(this,value); } };
});
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

const assert = (value, message) => { if (!value) throw new Error(message); };
async function capture(name) { await page.screenshot({path:`test-results/${name}.png`,fullPage:true}); }
async function axeCheck(name) {
 await page.evaluate(()=>Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{}))));
 const audit = await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
 assert(!audit.violations.length,`${name}: ${JSON.stringify(audit.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,failure:n.failureSummary}))})))}`);
}
async function findVerse(reference) {
 await page.getByRole('button',{name:'Find a verse',exact:true}).click();
 await page.getByLabel('Search verses',{exact:true}).fill(reference);
 await page.locator('.verse-result').filter({hasText:`Verse ${reference}`}).first().click();
}
async function openTools() {
 const details=page.locator('details').filter({has:page.locator('summary').filter({hasText:'Pronunciation & offline tools'})}).first();
 if(!(await details.evaluate(el=>el.open)))await details.locator(':scope > summary').click();
}
try {
await page.goto(base);await page.reload();await page.getByRole('heading',{name:'Bhagavad Gita',exact:true}).waitFor({timeout:30000});
// Signed-in UI appears once the mocked auth session is restored; WebKit restores it slower than Chromium.
await page.getByRole('link',{name:'Open profile',exact:true}).waitFor({timeout:30000}).catch(()=>{throw new Error('Mocked sign-in was not restored (login screen still showing)');});
assert(!(await page.getByText('Session Progress',{exact:true}).count()),'Session progress still occupies the reader');
assert(await page.getByRole('link',{name:'Open profile',exact:true}).count()===1,'Separate profile navigation missing');
assert((await page.getByRole('region',{name:'Audio player',exact:true}).boundingBox()).height<=80,'Collapsed player is too tall');
for(const width of [320,390,768,1024,1440]) {
 await page.setViewportSize({width,height:844});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Horizontal overflow at ${width}`);
 const brand=await page.locator('.brand-link').boundingBox();const profile=await page.locator('.header-actions').boundingBox();
 assert(brand.x+brand.width<=profile.x,`Header overlaps at ${width}`);
 await capture(`reading-${width}`);
}
await page.setViewportSize({width:390,height:844});await axeCheck('Reader');

assert(chapterRequests.length === 0,'Opening the reader requested chapter audio');
assert(await page.evaluate(()=>navigator.mediaSession.metadata === null),'An idle reader published media metadata');
const mediaAction = action => page.evaluate(name => {
 const handler = navigator.mediaSession.actions.get(name);
 if (!handler) throw new Error(`Media action unavailable: ${name}`);
 handler({action:name});
}, action);
async function checkMediaResume(selector, title) {
 const album = selector.startsWith('.compact-player') ? 'Gita 108' : 'All chapters';
 await page.waitForFunction(({selector,title,album})=>{
  const audio = document.querySelector(selector);
  const metadata = navigator.mediaSession.metadata;
  return audio && !audio.paused && audio.currentTime>0.2 && metadata?.album === album && metadata.title.includes(title);
 }, {selector,title,album});
 await mediaAction('pause');
 await page.waitForFunction(selector=>document.querySelector(selector).paused, selector);
 const pausedAt = await page.locator(selector).evaluate(audio=>audio.currentTime);
 assert(await page.evaluate(()=>navigator.mediaSession.playbackState==='paused'&&navigator.mediaSession.actions.has('play')),'Pause dropped the active media session');
 await mediaAction('play');
 await page.waitForFunction(({selector,pausedAt})=>{
  const audio = document.querySelector(selector);
  return audio && !audio.paused && audio.currentTime>pausedAt+0.1 && navigator.mediaSession.playbackState==='playing';
 }, {selector,pausedAt});
}
await page.getByRole('button',{name:'Play audio',exact:true}).click();
await checkMediaResume('.compact-player audio','Verse 1');
await page.getByRole('link',{name:'All Chapter Audios',exact:true}).click();
await page.getByRole('heading',{name:'Now playing',exact:true}).waitFor();
assert(chapterRequests.length===0,'Opening the chapter player requested an unplayed track');
assert(await page.evaluate(()=>navigator.mediaSession.metadata===null&&!navigator.mediaSession.actions.has('play')),'Leaving the reader kept stale verse actions');
await page.getByRole('button',{name:'Play audio',exact:true}).click();
await checkMediaResume('audio','Chapter 1');
await page.getByRole('link',{name:'Back to reading',exact:true}).click();
await page.getByRole('region',{name:'Now playing',exact:true}).waitFor();
await checkMediaResume('audio[preload="none"]','Chapter 1');
await page.getByRole('button',{name:'Play audio',exact:true}).click();
await checkMediaResume('.compact-player audio','Verse 1');
assert(await page.evaluate(()=>document.querySelector('audio[preload="none"]').paused&&!navigator.mediaSession.actions.has('seekto')),'Chapter media controls survived the verse handoff');
await page.getByRole('button',{name:'Play chapter audio',exact:true}).click();
await checkMediaResume('audio[preload="none"]','Chapter 1');
await mediaAction('pause');
await page.reload();
const resumedChapter = page.getByRole('region',{name:'Now playing',exact:true});
await resumedChapter.getByRole('button',{name:/Chapter 1: .*open player/}).waitFor();
assert(await page.locator('audio[preload="none"]').evaluate(audio=>!audio.hasAttribute('src')),'Reopening auto-loaded chapter media');
await resumedChapter.getByRole('button',{name:'Stop chapter audio',exact:true}).click();
console.log('Deferred chapter audio, Media Session pause/resume, player handoff and reopen passed');

const searchRequests = [];
const trackSearch = (request) => {
 const path = new URL(request.url()).pathname;
 if (path.startsWith('/api/chapters/')) searchRequests.push(path);
};
page.on('request', trackSearch);
await page.getByRole('button',{name:'Find a verse',exact:true}).click();
const searchInput = page.getByLabel('Search verses',{exact:true});
for (const reference of ['2', '2.', '2.4', '2.47']) {
 await searchInput.fill(reference);
 await page.waitForTimeout(250); // Exercise each prefix after the word-search debounce window.
}
assert(searchRequests.length === 0, `Reference search downloaded chapter data: ${searchRequests.join(', ')}`);
await page.locator('.verse-result').filter({hasText:'Verse 2.47'}).first().waitFor();
await searchInput.fill('eyes full of tears');
const searchResult = page.locator('.verse-result').filter({has:page.getByText('Verse 2.1',{exact:true})});
await searchResult.getByText('Read · sañjaya uvāca',{exact:true}).waitFor();
assert(searchRequests.join(',') === '/api/chapters/search', `Word search requested unexpected data: ${searchRequests.join(', ')}`);
await page.getByRole('button',{name:'Cancel',exact:true}).click();
page.off('request', trackSearch);

await page.getByRole('button',{name:'Read all',exact:true}).click();await findVerse('2.6');
for(const ref of ['2.6','2.7','2.8']) {await page.locator('#verse-heading').filter({hasText:new RegExp(`^Sloka ${ref.split('.')[1]}$`)}).waitFor().catch(()=>{throw new Error(`Reading skipped ${ref}`);});await page.getByRole('button',{name:'Next',exact:true}).click();}
assert(await page.getByRole('button',{name:'Read all',exact:true}).getAttribute('aria-pressed')==='true','Reading silently switched collections');
await page.getByRole('button',{name:'Learn 108',exact:true}).click();await findVerse('1.1');
await page.getByRole('button',{name:'English',exact:true}).click();await page.getByRole('button',{name:'Read purport',exact:true}).click();
const purport=page.getByRole('region',{name:'Purport',exact:true});
await purport.getByText('Purport by A.C. Bhaktivedanta Swami Prabhupada').waitFor();
assert(await purport.evaluate(el=>getComputedStyle(el).maxHeight==='none'&&getComputedStyle(el).overflowY==='visible'),'Purport has a nested scroll container');
await purport.locator('p').first().scrollIntoViewIfNeeded();const before=await page.evaluate(()=>scrollY);await page.mouse.move(195,420);await page.mouse.wheel(0,500);await page.waitForTimeout(200);assert(await page.evaluate(()=>scrollY)>before,'Scrolling the purport does not move the page');
await capture('reading-purport');await axeCheck('Expanded purport');
await page.getByRole('button',{name:'Tamil',exact:true}).click();await page.getByRole('button',{name:'பொருளுரையைப் படிக்க',exact:true}).click();
assert(await page.getByRole('region',{name:'பொருளுரை',exact:true}).evaluate(el=>getComputedStyle(el).overflowY==='visible'),'Tamil purport traps scrolling');
await page.getByRole('button',{name:'Sloka',exact:true}).click();
await page.locator('summary').filter({hasText:'Memorize this verse'}).click();await page.getByRole('button',{name:'Play recording',exact:true}).click();
await page.waitForFunction(()=>document.querySelector('.compact-player audio').currentTime>0.1);
assert(!await page.evaluate(uid=>JSON.parse(localStorage.getItem(`gita-learning-state-v4:${uid}`)).completed['GS-001']?.listen,uid),'Playing incorrectly marks Listen complete');
await page.getByRole('button',{name:'I’ve listened',exact:true}).click();await page.getByRole('button',{name:'I’ve repeated it',exact:true}).click();await page.getByRole('button',{name:'I understand the meaning',exact:true}).click();await page.getByRole('button',{name:'Test my recall',exact:true}).click();
await page.getByRole('button',{name:'Reveal verse',exact:true}).click();await page.getByRole('button',{name:'Forgot',exact:true}).click();await page.getByRole('button',{name:'Reveal verse',exact:true}).click();await page.getByRole('button',{name:'Easy',exact:true}).click();
assert(await page.getByText('Verse learned. Review it in 3 days.',{exact:true}).isVisible(),'Recall result missing');
const recall=await page.evaluate(uid=>JSON.parse(localStorage.getItem(`gita-learning-state-v4:${uid}`)),uid);assert(recall.recallAttempts===2&&recall.recallWins===1,'Guided recall double-counts attempts');
await page.getByRole('button',{name:'Next',exact:true}).click();await page.locator('summary').filter({hasText:'Memorize this verse'}).click();await page.getByRole('button',{name:'Already know this verse? Mark as learned',exact:true}).click();await page.getByRole('button',{name:'Mark learned',exact:true}).click();await page.getByText('Today’s practice is complete.',{exact:true}).waitFor();await capture('reading-goal-complete');
await page.reload();await page.getByText('Today’s practice is complete.',{exact:true}).waitFor();
console.log('Learning actions, single-count recall, daily completion and reading-mode continuity passed');
await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
await openTools();await page.getByRole('button',{name:'Download 2.11',exact:true}).click();await page.getByText('1 new verse(s) saved for offline playback.',{exact:true}).waitFor();
await page.locator('summary').filter({hasText:'Line-by-line practice'}).click();await page.getByRole('button',{name:'Practise from line 1',exact:true}).waitFor();
await page.locator('summary').filter({hasText:'Adjust line timings (optional)'}).click();await page.getByRole('button',{name:'Set line timings',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.compact-player audio').currentTime>0.1&&!document.querySelector('.compact-player audio').paused);
const lineDetails=page.locator('details').filter({has:page.locator('summary').filter({hasText:'Line-by-line practice'})}).last();const n=await lineDetails.locator('ol li').count();
for(let i=0;i<n;i++){await page.evaluate(time=>{const audio=document.querySelector('.compact-player audio');audio.pause();audio.currentTime=time;},(i+1)*0.5);await page.waitForFunction(()=>!document.querySelector('.compact-player audio').seeking);await page.getByRole('button',{name:`Mark end of line ${i+1}`,exact:true}).click();}
await page.getByText('Line timings saved for this recording.',{exact:false}).waitFor();await page.getByLabel('Repetitions',{exact:false}).selectOption('1');await page.getByLabel('Continue to next line',{exact:true}).uncheck();await page.getByRole('button',{name:'Practise from line 1',exact:true}).click();await page.getByText('Your turn — chant this line',{exact:true}).waitFor();
await page.getByRole('button',{name:'Expand audio controls',exact:true}).click();await page.getByRole('button',{name:'Stop playback',exact:true}).click();await page.waitForTimeout(1400);assert(await page.locator('.compact-player audio').evaluate(a=>a.paused),'Stopped line practice restarted audio');
const seek=page.getByRole('slider',{name:'Audio position',exact:true});await seek.focus();await page.keyboard.press('ArrowRight');assert(await page.locator('#verse-heading').innerText()==='Sloka 11','Seeking navigated away');
await page.getByRole('button',{name:'Collapse audio controls',exact:true}).click();
await page.locator('summary').filter({hasText:'Pronunciation & word meanings'}).click();await axeCheck('Expanded tools');
await page.evaluate(uid=>{const key=`gita-learning-state-v4:${uid}`;const s=JSON.parse(localStorage.getItem(key));s.reviews['GS-001'].dueDate='2000-01-01';localStorage.setItem(key,JSON.stringify(s));},uid);await page.reload();
await page.getByRole('button',{name:'Start review',exact:true}).click();await page.getByRole('button',{name:'Reveal verse',exact:true}).click();await page.getByRole('button',{name:'Forgot',exact:false}).click();await page.getByRole('button',{name:'Reveal verse',exact:true}).click();await page.getByRole('button',{name:'Difficult',exact:false}).click();await page.getByText('Reviews complete for today.',{exact:false}).waitFor();await page.getByRole('button',{name:'Close',exact:true}).click();
console.log('Optional calibration, line response pauses, stop, seeking and revision passed');
await page.getByRole('link',{name:'Open profile',exact:true}).click();await page.getByRole('heading',{name:'Your profile',exact:true}).waitFor();await axeCheck('Profile');await capture('reading-profile');
await page.getByRole('button',{name:'Favorites (1)',exact:true}).click();assert(await page.getByRole('link',{name:/Verse 1.1/}).isVisible(),'Favorites cannot be retrieved');
await page.getByLabel('Lite · 1 verse a day',{exact:true}).check();await page.getByLabel('Normal · 2 verses a day',{exact:true}).check();
await page.getByLabel('Appearance',{exact:true}).selectOption('dark');await axeCheck('Dark profile');await page.getByRole('link',{name:'Back to reading',exact:true}).click();await page.getByRole('heading',{name:'Bhagavad Gita',exact:true}).waitFor();await axeCheck('Dark reader');await capture('reading-dark');
await page.getByRole('link',{name:'Open profile',exact:true}).click();await page.getByRole('heading',{name:'Your profile',exact:true}).waitFor();
const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Export backup',exact:true}).click();const download=await downloadEvent;const path=await download.path();const fs=await import('node:fs/promises');const backup=JSON.parse(await fs.readFile(path,'utf8'));assert(backup.profile.favorites.includes('GS-001'),'Backup lost favorite');assert(backup.profile.lineCues['GS-003'].length===n+1,'Backup lost timings');
const chooserEvent=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Import backup',exact:true}).click();await(await chooserEvent).setFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});await page.getByRole('heading',{name:'Restore this backup?',exact:true}).waitFor();await page.getByRole('button',{name:'Cancel',exact:true}).click();
const oldChooserEvent=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Import backup',exact:true}).click();await(await oldChooserEvent).setFiles({name:'old.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup.progress))});await page.getByRole('button',{name:'Merge backup',exact:true}).click();await page.getByRole('heading',{name:'Your profile',exact:true}).waitFor();
await context.setOffline(true);await page.reload();await page.getByRole('heading',{name:'Your profile',exact:true}).waitFor();await page.getByRole('link',{name:'Back to reading',exact:true}).click();await page.getByRole('heading',{name:'Bhagavad Gita',exact:true}).waitFor();
const range=await page.evaluate(async()=>{const r=await fetch('/audio/2.11.mp3',{headers:{Range:'bytes=0-15'}});return{status:r.status,length:(await r.arrayBuffer()).byteLength};});assert(range.status===206&&range.length===16,'Offline audio byte range failed');await page.getByRole('button',{name:'Play audio',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.compact-player audio').currentTime>0.1);await page.getByRole('button',{name:'Pause audio',exact:true}).click();await context.setOffline(false);
await page.evaluate(async()=>{await navigator.serviceWorker.register('/sw.js?browser-check=update',{scope:'/',updateViaCache:'none'});});await page.getByRole('button',{name:'Update now',exact:true}).waitFor();const reloaded=page.waitForEvent('load');await page.getByRole('button',{name:'Update now',exact:true}).click();await reloaded;await page.getByRole('heading',{name:'Bhagavad Gita',exact:true}).waitFor();
assert(!errors.length,`Browser errors: ${errors.join(', ')}`);console.log('Profile, backups, light/dark accessibility, offline routes/audio and app updates passed');
} catch(e){console.error((await page.locator('body').innerText()).slice(-3500));await capture('reading-failure');throw e;}finally{await browser.close();}
