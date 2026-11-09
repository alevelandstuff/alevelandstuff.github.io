/*
 * Google account sign-in and cloud-saved progress for every lab.
 * Uses Firebase Authentication (Google provider) and Cloud Firestore.
 * Settings live in firebase-config.js; access rules live in firestore.rules.
 *
 * Each lab page calls Account.start(...) once its code has loaded. Signed-out
 * visitors see the sign up / log in screen on the home page; lab pages send
 * them there first and return them to the lab after they sign in.
 */
const Account=(()=>{
 const SDK='https://www.gstatic.com/firebasejs/10.14.1/';
 const LABS={'/physicslab':'Physics Lab','/cslab':'CS Lab'};
 const config=window.FIREBASE_CONFIG||{};
 const configured=Boolean(config.apiKey&&config.projectId&&!/^YOUR_/.test(config.apiKey)&&!/^YOUR_/.test(config.projectId));
 let auth=null,db=null,user=null,options={},busy=false,error='';
 let pending=null,timer=null,lastSaved=null,signingOut=false;

 const app=()=>document.getElementById('app');
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const brand='<span class="lab-home-brand">a level<span>&amp;</span>stuff.</span>';
 const googleLogo='<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';

 function nextLab(){
  const next=new URLSearchParams(location.search).get('next')||'';
  const path=next.replace(/\/+$/,'');
  return LABS[path]?path+'/':null;
 }
 function loadScript(src){
  return new Promise((resolve,reject)=>{
   const script=document.createElement('script');
   script.src=src;script.onload=resolve;script.onerror=()=>reject(Object.assign(new Error('Could not load '+src),{code:'sdk-unavailable'}));
   document.head.append(script);
  });
 }
 async function init(){
  if(!configured)throw Object.assign(new Error('Firebase is not configured'),{code:'not-configured'});
  if(!window.firebase?.firestore){
   await loadScript(SDK+'firebase-app-compat.js');
   await Promise.all([loadScript(SDK+'firebase-auth-compat.js'),loadScript(SDK+'firebase-firestore-compat.js')]);
  }
  if(!firebase.apps.length)firebase.initializeApp(config);
  auth=firebase.auth();db=firebase.firestore();
  // Keeps a local copy so answers given offline sync when the connection returns.
  try{await db.enablePersistence({synchronizeTabs:true});}catch{}
 }

 /* ---------- Screens ---------- */
 function splash(message,actions=''){
  injectStyles();
  app().innerHTML='<main class="account-splash"><div class="account-splash-inner" role="status">'+(actions?'':'<span class="account-spinner" aria-hidden="true"></span>')+'<p>'+message+'</p>'+actions+'</div></main>';
 }
 function errorMessage(err){
  switch(err?.code){
   case 'auth/popup-closed-by-user':case 'auth/cancelled-popup-request':case 'auth/user-cancelled':return '';
   case 'auth/network-request-failed':case 'sdk-unavailable':return 'Couldn’t reach Google. Check your internet connection and try again.';
   case 'auth/unauthorized-domain':return 'This web address isn’t allowed to sign in yet. Add it in Firebase under Authentication → Settings → Authorised domains.';
   case 'auth/operation-not-allowed':return 'Google sign-in is switched off. Enable it in Firebase under Authentication → Sign-in method.';
   case 'not-configured':return 'Accounts aren’t set up yet. Add the Firebase settings to firebase-config.js (see README).';
   default:return 'Sign-in didn’t work. Please try again.';
  }
 }
 function showGate(){
  injectStyles();
  const next=nextLab(),disabled=busy||!configured||!auth;
  document.title='A level & stuff — Log in';
  app().innerHTML='<main class="lab-home account-gate"><header class="lab-home-header">'+brand+'</header>'+
   '<section class="lab-home-content account-content" aria-labelledby="account-title"><div class="account-card">'+
   '<div class="eyebrow">YOUR REVISION SPACE</div>'+
   '<h1 id="account-title">Log in to start revising.</h1>'+
   '<p class="account-lead">'+(next?'Log in to open '+LABS[next.slice(0,-1)]+'.':'Your progress is saved to your account and follows you to any device.')+'</p>'+
   '<ul class="account-points"><li>Every lab’s progress, exam drafts and best scores.</li><li>Only your name, email and revision progress are stored.</li></ul>'+
   '<button type="button" class="account-google" data-account-signin '+(disabled?'disabled':'')+'>'+googleLogo+'<span>'+(busy?'Waiting for Google…':'Log in with Google')+'</span></button>'+
   '<p class="account-error" role="alert">'+esc(error)+'</p>'+
   '<p class="account-note">First time here? Your account is created automatically.</p>'+
   '</div></section>'+
   '<footer class="lab-home-footer">Progress saved in this browser before accounts existed moves into your account the first time you log in here.</footer></main>';
 }

 /* ---------- Sign in / out ---------- */
 async function signIn(){
  if(busy||!auth)return;
  busy=true;error='';showGate();
  const provider=new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({prompt:'select_account'});
  try{
   await auth.signInWithPopup(provider);
  }catch(err){
   if(err?.code==='auth/popup-blocked'){try{await auth.signInWithRedirect(provider);return;}catch(redirectError){err=redirectError;}}
   busy=false;error=errorMessage(err);
   if(!user)showGate();
  }
 }
 async function signOut(){
  if(!auth||(options.beforeSignOut&&!options.beforeSignOut()))return;
  // Give queued progress a moment to reach the server before the session ends.
  await Promise.race([flush(),new Promise(r=>setTimeout(r,2500))]).catch(()=>{});
  options.onSignOut?.();
  signingOut=true;
  await auth.signOut();
 }

 /* ---------- Progress storage ---------- */
 const docRef=()=>db.collection('users').doc(user.uid).collection('labs').doc(options.key);
 function write(json){
  return docRef().set({progress:json,updatedAt:firebase.firestore.FieldValue.serverTimestamp()})
   .then(()=>{options.onSync?.(true);},err=>{console.error('Saving progress failed',err);if(lastSaved===json)lastSaved=null;options.onSync?.(false);throw err;});
 }
 async function load(){
  const snap=await docRef().get();
  let cloud=null,local=null;
  if(snap.exists){try{cloud=JSON.parse(snap.data().progress);}catch{}}
  try{local=JSON.parse(localStorage.getItem(options.key));}catch{}
  if(!local||typeof local!=='object'){lastSaved=cloud?JSON.stringify(cloud):null;return cloud;}
  // One-time move of progress saved in this browser before accounts existed.
  const data=cloud&&options.merge?options.merge(cloud,local):{...(cloud||{}),...local};
  lastSaved=JSON.stringify(data);
  write(lastSaved).then(()=>{try{localStorage.removeItem(options.key);}catch{}},()=>{});
  return data;
 }
 function save(data){
  if(!user||!db)return;
  pending=data;clearTimeout(timer);timer=setTimeout(flush,800);
 }
 function flush(){
  clearTimeout(timer);timer=null;
  if(!pending||!user||!db)return Promise.resolve();
  const json=JSON.stringify(pending);pending=null;
  if(json===lastSaved)return Promise.resolve();
  lastSaved=json;
  return write(json).catch(()=>{});
 }

 /* ---------- Lifecycle ---------- */
 async function handleUser(signedIn){
  user=signedIn;busy=false;
  if(!user){
   pending=null;lastSaved=null;
   if(options.home)showGate();
   else location.replace(signingOut?'/':'/?next='+encodeURIComponent(location.pathname));
   return;
  }
  error='';signingOut=false;
  const next=nextLab();
  if(options.home&&next){location.replace(next);return;}
  splash('Loading your progress…');
  try{
   const data=await load();
   if(user!==signedIn)return;
   options.onReady?.(data,user);
  }catch(err){
   console.error('Loading progress failed',err);
   splash('Couldn’t load your progress. Check your internet connection and try again.','<div class="account-splash-actions"><button type="button" class="account-retry" data-account-retry>Try again</button><button type="button" class="account-signout" data-account-signout>Sign out</button></div>');
  }
 }
 function start(settings){
  options=settings||{};
  splash('Loading your account…');
  init().then(()=>{
   auth.getRedirectResult().catch(err=>{error=errorMessage(err);if(!user&&options.home)showGate();});
   auth.onAuthStateChanged(handleUser);
  }).catch(err=>{
   console.error('Account setup failed',err);
   if(!options.home){location.replace('/?next='+encodeURIComponent(location.pathname));return;}
   error=errorMessage(err);showGate();
  });
 }
 function markup(){
  if(!user)return '';
  const name=user.displayName||user.email||'Account',first=name.split(/\s+/)[0];
  const avatar=user.photoURL?'<img src="'+esc(user.photoURL)+'" alt="" referrerpolicy="no-referrer">':'<span>'+esc(first.charAt(0).toUpperCase())+'</span>';
  return '<div class="account-chip" title="Signed in as '+esc(user.email||name)+'"><span class="account-avatar" aria-hidden="true">'+avatar+'</span><span class="account-name">'+esc(first)+'</span><button type="button" class="account-signout" data-account-signout aria-label="Sign out of '+esc(user.email||name)+'">Sign out</button></div>';
 }

 document.addEventListener('click',event=>{
  const el=event.target.closest?.('[data-account-signin],[data-account-signout],[data-account-retry]');
  if(!el||el.disabled)return;
  if(el.hasAttribute('data-account-signin'))signIn();
  else if(el.hasAttribute('data-account-signout'))signOut();
  else if(el.hasAttribute('data-account-retry'))handleUser(user);
 });
 document.addEventListener('visibilitychange',()=>{if(document.hidden)flush();});
 window.addEventListener('pagehide',flush);

 function injectStyles(){
  if(document.getElementById('account-styles'))return;
  const style=document.createElement('style');style.id='account-styles';
  style.textContent=`
.account-splash{min-height:100svh;display:grid;place-items:center;padding:24px;background:var(--bg,#f6f7f3);color:var(--muted,#697873);text-align:center;font-size:14px}
.account-splash-inner{display:flex;flex-direction:column;align-items:center;gap:14px;max-width:360px}
.account-splash p{margin:0}
.account-spinner{width:28px;height:28px;border-radius:50%;border:3px solid var(--line,#e0e6df);border-top-color:var(--green,#145c4c);animation:account-spin .8s linear infinite}
@keyframes account-spin{to{transform:rotate(360deg)}}
.account-splash-actions{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}
.account-retry{border:0;background:var(--green,#145c4c);color:#fff;border-radius:10px;padding:9px 16px;font:inherit;font-size:13px;font-weight:600;cursor:pointer}
.account-content{display:flex;flex-direction:column;align-items:center;max-width:460px;padding-top:40px}
.account-card{width:100%;background:#fff;border:1px solid var(--line,#e0e6df);border-radius:22px;padding:34px 32px 26px;box-shadow:0 18px 50px #183e3712}
.account-card h1{font-size:clamp(30px,4.5vw,40px);line-height:1.15;letter-spacing:-1.2px;margin:8px 0 10px}
.account-lead{font-size:14.5px;color:#748271;line-height:1.6;margin:0 0 22px}
.account-points{list-style:none;padding:0;margin:0 0 22px;display:grid;gap:9px;font-size:13.5px;color:var(--ink,#1e302d)}
.account-points li{position:relative;padding-left:26px;line-height:1.5}
.account-points li::before{content:'✓';position:absolute;left:0;top:1px;width:18px;height:18px;border-radius:50%;background:var(--lime,#d5ef9a);color:var(--green,#145c4c);font-size:11px;font-weight:800;display:grid;place-items:center}
.account-google{width:100%;display:flex;align-items:center;justify-content:center;gap:12px;border:1px solid #c9d1c5;background:#fff;color:#1f1f1f;border-radius:12px;padding:12px 16px;font:inherit;font-size:14.5px;font-weight:600;cursor:pointer;transition:background .2s,border-color .2s,transform .15s}
.account-google svg{width:20px;height:20px;flex-shrink:0}
.account-google:hover:not(:disabled){background:#f6f8f3;border-color:#9fb091}
.account-google:active:not(:disabled){transform:scale(.98)}
.account-google:disabled{opacity:.55;cursor:not-allowed}
.account-google:focus-visible,.account-signout:focus-visible{outline:3px solid #94b97b;outline-offset:2px}
.account-note{margin:18px 0 0;font-size:13px;color:var(--muted,#697873);text-align:center}
.account-error{min-height:0;margin:10px 0 0;font-size:13px;color:var(--red,#b2443f);line-height:1.5}
.account-error:empty{display:none}
.account-actions{display:flex;align-items:center;gap:10px}
.account-chip{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--ink,#1e302d);min-width:0}
.account-avatar{width:30px;height:30px;border-radius:50%;overflow:hidden;flex-shrink:0;display:grid;place-items:center;background:var(--lime,#d5ef9a);color:var(--green,#145c4c);font-weight:800;font-size:13px}
.account-avatar img{width:100%;height:100%;object-fit:cover}
.account-name{font-weight:600;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.account-signout{border:1px solid var(--line,#e0e6df);background:#fff;color:var(--muted,#697873);border-radius:10px;padding:6px 10px;font:inherit;font-size:11px;cursor:pointer;white-space:nowrap}
.account-signout:hover{color:var(--ink,#1e302d);border-color:#b4c5a7}
@media(max-width:760px){.account-name{display:none}.account-card{padding:28px 20px 22px;border-radius:18px}.account-content{padding-top:24px}}
@media(prefers-reduced-motion:reduce){.account-spinner{animation:none}.account-google{transition:none}}
`;
  document.head.append(style);
 }

 return {start,save,flush,markup,signOut,get user(){return user;}};
})();
