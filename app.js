/* ====== SUPABASE CONNECTION ====== */
const SUPABASE_URL = 'https://azqbzyxknfdwfuqevbrd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_OcR9EJnNuPqBWtZrmNVUdA_tt_CMCmR';
const configured = Boolean(SUPABASE_URL && SUPABASE_KEY && !SUPABASE_URL.includes('YOUR_PROJECT') && !SUPABASE_KEY.includes('YOUR_PUBLISHABLE_KEY'));
const db = configured ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true, flowType: 'pkce' }
}) : null;
/* ====== APP ====== */


const $ = (selector) => document.querySelector(selector);
// Supabase result guard used throughout the app. It intentionally lives near
// bootstrap so every auth/storage/database path can call it safely.
function check(result){
  if(result && typeof result === 'object' && result.error) throw result.error;
  return result && typeof result === 'object' && Object.prototype.hasOwnProperty.call(result,'data') ? result.data : result;
}
const escapeHtml = (v = '') => String(v ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state = { user:null, profile:null, artist:null, admin:false, page:'discover', songs:[], artists:[], favorites:[], playlists:[], playlistSongs:[], playlistCollaborators:[], albums:[], genres:[], plans:[], subscriptions:[], podcasts:[], episodes:[], myShows:[], history:[], members:[], selectedShow:null, selectedPlaylist:null, selectedArtist:null, podcastHistory:[], followers:[], following:[], player:null, playerToken:0, loading:false, error:'',coverUrls:{},subscriptionMembers:[],sharedMemberships:[],paymentRows:[],uiFilter:'all',libraryExpanded:true,navStack:[],navForward:[],songMenu:null, offlineDownloads:[], entitlement:null, socialSource:'user_follow', liked:[], likedIds:new Set(), likesAvailable:true, selectedAlbum:null, searchQuery:'', searchGenre:null, searchTab:'all', libFilter:'all', discoverFilter:'all', railTab:'now', hist:{i:0,max:0}, routeReady:false, installEvent:null, tint:null, focusSearch:null, libQuery:'', libSearchOpen:false };
Object.assign(state, { historyError: '', historyWriteError: '', episodeTitles: {}, likesMode: 'remote', artistFollowers: [], followerCounts: {}, socialProfiles: {}, socialRpc: { counts: false, mine: false, profiles: false }, profileStats:null, studioStats:null, royaltySummary:null, adminData:null, subscriptionRequests:[], lyricsCache:{}, profilePhotoUrl:null, ownedSongs:[], adminSelectedAlbum:null,adminTab:'accounts', adminQuery:'', adminStatus:'all', adminPriority:false, playlistInviteHandled:false, adminUserIds:[], adminView:'overview', artistStudioView:'overview', podcastStudioView:'overview',selectedPodcastStudioShow:null, selectedStudioAlbum:null, albumStreamCounts:{}, albumStreamLoading:{}, crossDeviceRefreshBound:false, mayaPaymentNotice:null, mayaReturnProcessing:false, subscriptionInviteProcessing:false, deactivationStatus:null });
let accountStatusChannel=null;
let accountStatusTimer=null;
let accountStatusChecking=false;
let genreOutsideClickHandler=null;
const dialogOpeners=new WeakMap();
const TRUSTED_COVER_HOSTS=new Set([location.hostname,new URL(SUPABASE_URL).hostname]);
function cleanupSessionRuntime(){
  clearInterval(accountStatusTimer);accountStatusTimer=null;
  if(typeof streamMetricsRefreshTimer!=='undefined')clearTimeout(streamMetricsRefreshTimer);
  if(typeof podcastMetricsRefreshTimer!=='undefined')clearTimeout(podcastMetricsRefreshTimer);
  for(const channel of [accountStatusChannel,realtimeChannel,playlistPresenceChannel,adminStreamChannel,creatorStreamChannel,podcastCreatorChannel]){try{if(channel)db?.removeChannel(channel);}catch{}}
  accountStatusChannel=null;realtimeChannel=null;playlistPresenceChannel=null;adminStreamChannel=null;creatorStreamChannel=null;podcastCreatorChannel=null;
}

const HISTORY_CACHE_LIMIT = 80;
const PODCAST_HISTORY_CACHE_LIMIT = 50;
function localKey(kind, userId = state.user?.id) { return userId ? `soundwave-${kind}-${userId}` : ''; }
function readLocalJson(key, fallback) { if (!key) return fallback; try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; } }
function writeLocalJson(key, value) { if (!key) return; try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }
function sortByStreamDate(rows = []) { return [...rows].sort((a, b) => new Date(b?.stream_date || 0) - new Date(a?.stream_date || 0)); }
function uniquePodcastRows(rows = []) { const seen = new Set(); return rows.filter((r) => { const key = r?.podcast_stream_id != null ? `id:${r.podcast_stream_id}` : `${r?.episode_id || ''}:${r?.stream_date || ''}`; if (seen.has(key)) return false; seen.add(key); return true; }); }
function mergeStreamHistory(remote = [], cached = []) { return sortByStreamDate(uniqueStreamRows([...(remote || []), ...(cached || [])])).slice(0, HISTORY_CACHE_LIMIT); }
function mergePodcastHistory(remote = [], cached = []) { return sortByStreamDate(uniquePodcastRows([...(remote || []), ...(cached || [])])).slice(0, PODCAST_HISTORY_CACHE_LIMIT); }
function readCachedHistory(userId = state.user?.id) { return mergeStreamHistory([], (readLocalJson(localKey('history', userId), []) || []).map((row) => ({ ...row, user_id: row?.user_id || userId }))); }
function readCachedPodcastHistory(userId = state.user?.id) { return mergePodcastHistory([], readLocalJson(localKey('podcast-history', userId), [])); }
function readCachedEpisodeTitles(userId = state.user?.id) { return readLocalJson(localKey('episode-titles', userId), {}); }
function readPlayerSnapshot(userId = state.user?.id) { return readLocalJson(localKey('last-player', userId), null); }

function readAllCachedHistories() {
  try {
    const rows = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) || '';
      if (!key.startsWith('soundwave-history-')) continue;
      const userId = key.slice('soundwave-history-'.length);
      const data = readLocalJson(key, []);
      if (Array.isArray(data)) rows.push(...data.map((row) => ({ ...row, user_id: row?.user_id || userId })));
    }
    return mergeStreamHistory(rows, []);
  } catch {
    return [];
  }
}
function readAllCachedPodcastHistories() {
  try {
    const rows = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) || '';
      if (!key.startsWith('soundwave-podcast-history-')) continue;
      const userId = key.slice('soundwave-podcast-history-'.length);
      const data = readLocalJson(key, []);
      if (Array.isArray(data)) rows.push(...data.map((row) => ({ ...row, user_id: row?.user_id || userId })));
    }
    return mergePodcastHistory(rows, []);
  } catch {
    return [];
  }
}
function isQualifiedPodcastStream(row) {
  const seconds = Number(row?.duration_played_seconds) || 0;
  return String(row?.completion_status || '').toLowerCase() === 'completed' || seconds >= 30;
}
function persistHistoryCache() {
  if (!state.user) return;
  writeLocalJson(localKey('history'), mergeStreamHistory((state.history || []).map((row) => ({ ...row, user_id: row?.user_id || state.user?.id })), []).slice(0, HISTORY_CACHE_LIMIT));
  writeLocalJson(localKey('podcast-history'), mergePodcastHistory((state.podcastHistory || []).map((row) => ({ ...row, user_id: row?.user_id || state.user?.id })), []).slice(0, PODCAST_HISTORY_CACHE_LIMIT));
  writeLocalJson(localKey('episode-titles'), state.episodeTitles || {});
}
function persistPlayerSnapshot(data = state.player, resumeAt = null) {
  if (!state.user || !data || data.kind !== 'song') return;
  const song = songById(data.id);
  writeLocalJson(localKey('last-player'), {
    id: data.id,
    kind: data.kind,
    title: data.title,
    artist: data.artist,
    duration: Number(data.duration || song?.duration_seconds || 0) || 0,
    resumeAt: Math.max(0, Math.floor(Number(resumeAt ?? data.resumeAt ?? 0) || 0)),
    savedAt: new Date().toISOString()
  });
}
Object.assign(state,{insightHistory:[],listeningStats:null,topWeekSongs:[],friendActivity:[],friendNow:[],artistThirtyDay:[],artistTopListeners:[],adminAnalyticsHistory:[],analyticsSongNames:{},artistPopularity:{},recentSearches:[],playlistPresence:[],competitionLoaded:false,podcastStudioHistory:[],podcastRecSignals:{categories:{},shows:[]},discoverExpanded:{albums:false,curated:false}});
const nice = (n) => Number.isFinite(Number(n)) ? `${Math.floor(n/60)}:${String(Math.floor(n%60)).padStart(2,'0')}` : '—';
const ANALYTICS_WINDOW_DAYS = 30;
const val = (id) => document.getElementById(id)?.value?.trim();
const opts = (rows,key,label) => rows.map(x=>`<option value="${escapeHtml(x[key])}">${escapeHtml(x[label])}</option>`).join('');
// ===================================================================
// SoundWave "Spotify-style" upgrade layer
// ===================================================================
const esc = escapeHtml;
const PREF_KEY = 'soundwave-prefs-v1';
const prefs = (() => {
  const d = { volume: .85, shuffle: false, repeat: 'off', muted: false, railHidden: false };
  try { return { ...d, ...JSON.parse(localStorage.getItem(PREF_KEY) || '{}') }; } catch { return d; }
})();
const savePrefs = () => { try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch {} };
// Keep the desktop Now Playing rail visible after a refresh. Hide/show remains session-interactive.
prefs.railHidden = false;
const shuffled = (a) => { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
const yearOf = (d) => (d ? String(d).slice(0, 4) : '');
const totalTime = (songs) => { const s = songs.reduce((t, x) => t + (Number(x.duration_seconds) || 0), 0); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h ? `${h} hr ${m} min` : `${Math.max(1, m)} min`; };
const TINTS = ['#4a3b8f', '#1f4e79', '#7a4d8f', '#2f6f6a', '#8f2f6b', '#7a2a3a', '#2c6e3a', '#3a4f8f', '#8a3a55', '#5a4a7a', '#6b6b2a', '#3a6f8a'];
const tintFor = (n = 0) => TINTS[Math.abs(Number(n) || 0) % TINTS.length];
const BROWSE_COLORS = ['#dc148c', '#006450', '#8400e7', '#1e3264', '#e8115b', '#477d95', '#e13300', '#7358ff', '#148a08', '#bc5900', '#503750', '#0d73ec'];

// Resolve artwork saved in several formats used by older SoundWave builds.
// New uploads store a Storage object path, while some seed/legacy rows contain
// a full URL or a path prefixed with "covers/".
function normalizedCoverPath(value){
  const raw=String(value||'').trim();
  if(!raw)return '';
  if(/^https?:\/\//i.test(raw)){
    try{
      const u=new URL(raw);
      const markers=['/storage/v1/object/public/covers/','/storage/v1/object/sign/covers/','/storage/v1/object/authenticated/covers/'];
      for(const marker of markers){
        const at=u.pathname.indexOf(marker);
        if(at>=0)return decodeURIComponent(u.pathname.slice(at+marker.length));
      }
      return raw;
    }catch{return raw;}
  }
  return raw.replace(/^\/+/, '').replace(/^covers\//i,'');
}
async function resolveCoverUrl(value){
  const raw=String(value||'').trim();
  if(!raw)return null;
  // Only same-origin or this project's Supabase host may be used for remote artwork.
  if(/^https?:\/\//i.test(raw) && !/\/storage\/v1\/object\//i.test(raw)){
    try{const u=new URL(raw);return u.protocol==='https:'&&TRUSTED_COVER_HOSTS.has(u.hostname)?u.href:null;}catch{return null;}
  }
  const path=normalizedCoverPath(raw);
  if(/^https?:\/\//i.test(path))return path;
  const signed=await db.storage.from('covers').createSignedUrl(path,3600);
  if(!signed.error && signed.data?.signedUrl)return signed.data.signedUrl;
  // Public buckets do not need a signed URL. This fallback also makes migrations
  // between private/public cover buckets less fragile.
  const pub=db.storage.from('covers').getPublicUrl(path);
  return pub.data?.publicUrl||null;
}

// ---------- Routing (URL <-> state) so refresh, deep links and the browser Back button all work ----------
const ROUTES = ['not-found','discover','home', 'listener-dashboard', 'artist-dashboard', 'admin-dashboard', 'music', 'artists', 'artist-detail', 'album-detail', 'liked-artists', 'liked-songs', 'followers', 'profile', 'playlists', 'history', 'downloads', 'podcasts', 'podcast-studio', 'plans', 'studio', 'admin'];
function pageToHash() {
  const p = state.page;
  const id = p === 'playlists' ? state.selectedPlaylist : p === 'artist-detail' ? state.selectedArtist : p === 'album-detail' ? state.selectedAlbum : p === 'podcasts' ? state.selectedShow : null;
  return `#/${p}${id ? '/' + id : ''}`;
}
function applyHash(hash) {
  const m = /^#\/([a-z-]+)(?:\/(\d+))?$/.exec(hash || '');
  if (!m || !ROUTES.includes(m[1])) { if(hash){ state.page='not-found'; return true; } return false; }
  let [, page, id] = m;
  if (page === 'home') page = 'discover';
  if (!pageAllowed(page)) return false;
  state.page = page;
  state.selectedPlaylist = page === 'playlists' && id ? Number(id) : null;
  state.selectedArtist = page === 'artist-detail' && id ? Number(id) : null;
  state.selectedAlbum = page === 'album-detail' && id ? Number(id) : null;
  state.selectedShow = page === 'podcasts' && id ? Number(id) : null;
  return true;
}
async function routeLoad() {
  if (state.page === 'playlists' && state.selectedPlaylist) {
    if (!state.playlists.some((p) => p.playlist_id === state.selectedPlaylist)) { state.selectedPlaylist = null; render(); return; }
    await playlistDetail();
  } else if (state.page === 'podcasts' && state.selectedShow) {
    await showDetail();
  } else if (state.page === 'artist-detail' && state.selectedArtist) {
    await loadArtistPopularity(state.selectedArtist);
    render();
    void refreshViewedArtistCover(state.selectedArtist);
  } else if (state.page === 'podcast-studio') {
    await refreshPodcastStudioMetrics();
    render();
  } else if (state.page === 'studio') {
    await refreshStreamMetrics();
    render();
  } else render();
}
function afterRender() {
  document.body.dataset.page = state.page;
  document.body.classList.toggle('rail-hidden', !!prefs.railHidden);
  if (!state.user) return;
  syncHearts(); markPlaying();
  if (state.page === 'artist-detail') bindArtistScrollBehavior();
  const h = pageToHash();
  if (!state.routeReady) { state.routeReady = true; window.history.replaceState({ i: state.hist.i }, '', h); }
  else if (location.hash !== h) { state.hist.i++; state.hist.max = state.hist.i; window.history.pushState({ i: state.hist.i }, '', h); }
}
window.addEventListener('popstate', (e) => {
  if (!state.user || !configured) return;
  state.hist.i = e.state?.i ?? 0;
  if (applyHash(location.hash)) action(routeLoad);
});
function openPlaylist(id) { state.page = 'playlists'; state.selectedPlaylist = Number(id); action(playlistDetail); }
function openShow(id) { state.page = 'podcasts'; state.selectedShow = Number(id); action(showDetail); }

// ---------- Catalog helpers ----------
let _albumCache = { src: null, val: [] };
function catalogAlbums() {
  if (_albumCache.src === state.songs) return _albumCache.val;
  const m = new Map();
  for (const s of state.songs) {
    const a = s.album; if (!a) continue;
    if (!m.has(a.album_id)) m.set(a.album_id, { album_id: a.album_id, title: a.album_title, description: a.description, release_type: a.release_type || 'Album', cover_path: a.cover_path, release_date: a.release_date, is_active: a.is_active !== false, artist: a.artist, songs: [] });
    m.get(a.album_id).songs.push(s);
  }
  for(const [albumId,al] of m){if(!al.songs.some(s=>s.is_active!==false)||al.is_active===false)m.delete(albumId);}
  for (const al of m.values()) al.songs.sort((x, y) => (x.track_number ?? 1e9) - (y.track_number ?? 1e9) || x.song_id - y.song_id);
  _albumCache = { src: state.songs, val: [...m.values()] };
  return _albumCache.val;
}
const albumById = (id) => catalogAlbums().find((a) => Number(a.album_id) === Number(id));
const songsByArtist = (artistId) => state.songs.filter((s) => Number(s.album?.artist?.artist_id) === Number(artistId));
const songById = (id) => state.songs.find((s) => Number(s.song_id) === Number(id));
const ids = (songs) => songs.map((s) => s.song_id);

// ---------- Liked songs ----------
const isLiked = (id) => state.likedIds.has(Number(id));
function heartBtn(id, cls = '') {
  const on = isLiked(id);
  return `<button type="button" class="heart-btn ${cls} ${on ? 'on' : ''}" data-like="${id}" aria-pressed="${on}" aria-label="${on ? 'Remove from Liked Songs' : 'Save to Liked Songs'}" title="${on ? 'Remove from Liked Songs' : 'Save to Liked Songs'}">${icon('heart')}</button>`;
}
// Likes are saved to your account (Supabase table saved_song). If that table has not been installed yet we
// fall back to saving on this device, so the heart ALWAYS works — and the likes move to your account later.
const likeKey = () => `soundwave-likes-${state.user?.id || 'anon'}`;
const readLocalLikes = () => { try { return JSON.parse(localStorage.getItem(likeKey()) || '[]').map(Number).filter(Boolean); } catch { return []; } };
const writeLocalLikes = (list) => { try { localStorage.setItem(likeKey(), JSON.stringify(list)); } catch {} };
const isMissingTable = (e) => /does not exist|schema cache|PGRST20\d|42P01|undefined_table/i.test(`${e?.code || ''} ${e?.message || ''}`);
const likesInFlight = new Set();
function applyLike(id, on) {
  state.likedIds[on ? 'add' : 'delete'](id);
  state.liked = state.liked.filter((x) => Number(x.song_id) !== id);
  if (on) state.liked.unshift({ song_id: id, liked_at: new Date().toISOString() });
  syncHearts(); renderLibraryList();
  if (state.page === 'liked-songs') render();
}
async function toggleLike(id) {
  id = Number(id);
  if (!id || likesInFlight.has(id)) return;
  likesInFlight.add(id);
  const wasLiked = isLiked(id);
  applyLike(id, !wasLiked); // instant feedback; rolled back below if saving fails
  try {
    if (state.likesMode === 'remote') {
      try {
        if (wasLiked) check(await db.from('saved_song').delete().eq('user_id', state.user.id).eq('song_id', id));
        else { const r = await db.from('saved_song').insert({ user_id: state.user.id, song_id: id }); if (r.error && r.error.code !== '23505') throw r.error; }
      } catch (e) {
        if (!isMissingTable(e)) throw e;
        state.likesMode = 'local';
        toast('Saved on this device. Run sql/RUN_ME_likes_and_followers.sql in Supabase to sync likes to your account.');
      }
    }
    if (state.likesMode === 'local') writeLocalLikes(state.liked.map((x) => Number(x.song_id)));
    if(!wasLiked)burstHearts(id);toast(wasLiked ? 'Removed from Liked Songs' : 'Added to Liked Songs');
  } catch (e) {
    applyLike(id, wasLiked);
    throw e;
  } finally { likesInFlight.delete(id); }
}
async function migrateLocalLikes(uid) {
  const local = readLocalLikes();
  if (!local.length) return;
  const have = new Set(state.liked.map((x) => Number(x.song_id)));
  let moved = 0;
  for (const sid of local) {
    if (have.has(sid)) continue;
    const r = await db.from('saved_song').insert({ user_id: uid, song_id: sid });
    if (!r.error || r.error.code === '23505') { moved++; state.liked.push({ song_id: sid, liked_at: new Date().toISOString() }); state.likedIds.add(sid); }
  }
  try { localStorage.removeItem(likeKey()); } catch {}
  if (moved) console.info(`Moved ${moved} on-device likes to your account.`);
}
const likesNotice = () => (state.likesMode === 'local' ? `<div class="notice">These likes are saved on this device only. To keep them on your account (and every device), run <code>sql/RUN_ME_likes_and_followers.sql</code> once in the Supabase SQL Editor, then refresh — your likes will move over automatically.</div>` : '');

// ---------- Following artists ----------
// "Follow" is stored in favorite_artist (the same table the app already used for saved artists).
const isFollowing = (artistId) => state.favorites.some((f) => Number(f.artist_id) === Number(artistId));
const isOwnArtist = (a) => Boolean(a && state.user && a.user_id && String(a.user_id) === String(state.user.id));
function followerText(artistId) {
  const n = state.followerCounts?.[Number(artistId)];
  return n == null ? '' : `${n} ${n === 1 ? 'follower' : 'followers'}`;
}
function mergeFollowerCountsPayload(payload, target = {}) {
  if (payload == null) return target;
  if (typeof payload === 'string') {
    try { return mergeFollowerCountsPayload(JSON.parse(payload), target); } catch { return target; }
  }
  if (Array.isArray(payload)) { payload.forEach((row) => mergeFollowerCountsPayload(row, target)); return target; }
  if (typeof payload !== 'object') return target;
  const artistId = Number(payload.artist_id ?? payload.artistid ?? payload.artistId ?? payload.id);
  const rawCount = payload.follower_count ?? payload.followers_count ?? payload.followerCount ?? payload.followers ?? payload.count ?? payload.total_followers ?? payload.total;
  const count = Number(rawCount);
  if (Number.isFinite(artistId) && Number.isFinite(count)) target[artistId] = Math.max(0, count);
  for (const key of ['data','rows','counts','result','artists']) {
    if (payload[key] != null) mergeFollowerCountsPayload(payload[key], target);
  }
  for (const [key, value] of Object.entries(payload)) {
    if (/^\d+$/.test(key) && Number.isFinite(Number(value))) target[Number(key)] = Math.max(0, Number(value));
  }
  return target;
}
function followBtn(a, cls = '') {
  if (!a || isOwnArtist(a)) return '';
  const on = isFollowing(a.artist_id);
  return `<button type="button" class="follow-btn ${cls} ${on ? 'on' : ''}" data-fav="${a.artist_id}" aria-pressed="${on}" aria-label="${on ? `Unfollow ${esc(a.artist_name||'artist')}` : `Follow ${esc(a.artist_name||'artist')}`}">${on ? 'Unfollow' : 'Follow'}</button>`;
}
const followInFlight = new Set();
function applyFollow(artistId, on, { adjustCount = true } = {}) {
  state.favorites = state.favorites.filter((f) => Number(f.artist_id) !== artistId);
  if (on) state.favorites.push({ user_id: state.user.id, artist_id: artistId });
  if (adjustCount && state.followerCounts && artistId in state.followerCounts) state.followerCounts[artistId] = Math.max(0, state.followerCounts[artistId] + (on ? 1 : -1));
  document.querySelectorAll(`[data-fav="${artistId}"]`).forEach((b) => { b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); b.textContent = on ? 'Unfollow' : 'Follow'; b.setAttribute('aria-label', on ? 'Unfollow artist' : 'Follow artist'); });
  document.querySelectorAll(`[data-follower-count="${artistId}"]`).forEach((el) => { el.textContent = followerText(artistId); });
  renderLibraryList(); refreshRail();
  if (state.page === 'liked-artists' || state.page === 'followers') render();
}
async function refreshFollowState(){
  if(!state.user)return;
  const fav=await db.from('favorite_artist').select('user_id,artist_id').eq('user_id',state.user.id);
  if(!fav.error)state.favorites=fav.data||[];
  const counts=await db.rpc('get_artist_follower_counts');
  if(!counts.error){const next={};for(const a of state.artists||[])next[Number(a.artist_id)]=0;mergeFollowerCountsPayload(counts.data,next);state.followerCounts=next;state.socialRpc.counts=true;}
  if(state.artist){const mine=await db.rpc('get_my_artist_followers');if(!mine.error&&Array.isArray(mine.data)){state.artistFollowers=mine.data;state.followerCounts[Number(state.artist.artist_id)]=mine.data.length;state.socialRpc.mine=true;}}
}
async function toggleFollow(artistId) {
  artistId = Number(artistId);
  const artist = state.artists.find((a) => Number(a.artist_id) === artistId);
  if (isOwnArtist(artist)) throw Error('This is your own artist profile.');
  if (!artistId || followInFlight.has(artistId)) return;
  followInFlight.add(artistId);
  const was = isFollowing(artistId), next=!was;
  applyFollow(artistId, next);
  try {
    const rpc=await db.rpc('soundwave_toggle_artist_follow',{p_artist_id:artistId,p_follow:next});
    if(rpc.error){
      if (was) check(await db.from('favorite_artist').delete().eq('user_id', state.user.id).eq('artist_id', artistId));
      else { const r = await db.from('favorite_artist').insert({ user_id: state.user.id, artist_id: artistId }); if (r.error && r.error.code !== '23505') throw r.error; }
    }
    await refreshFollowState();
    applyFollow(artistId,isFollowing(artistId),{adjustCount:false});
    toast(next ? `Following ${artist?.artist_name || 'artist'}` : `Unfollowed ${artist?.artist_name || 'artist'}`);
  } catch (e) {
    applyFollow(artistId, was);
    throw e;
  } finally { followInFlight.delete(artistId); }
}

function syncHearts() {
  document.querySelectorAll('[data-like]').forEach((b) => {
    const on = isLiked(b.dataset.like);
    b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on));
    const label = on ? 'Remove from Liked Songs' : 'Save to Liked Songs';
    b.setAttribute('aria-label', label); b.title = label;
  });
  document.querySelectorAll('[data-liked-count]').forEach((el) => { el.textContent = `${state.liked.length} ${state.liked.length === 1 ? 'song' : 'songs'}`; });
}

// ---------- Track list (Spotify-style table) ----------
function trackTable(songs, o = {}) {
  const { queue = ids(songs), remove = false, showAlbum = true, header = true, extraLabel = '', extraClass = '', extraCell = null } = o;
  if (!songs.length) return '<div class="empty">Nothing here yet.</div>';
  const q = queue.join(',');
  const hasExtra = Boolean(extraLabel && typeof extraCell === 'function');
  const extraTrackClass = `${showAlbum ? '' : ' no-album'}${hasExtra ? ' has-extra' : ''}${hasExtra && extraClass ? ` extra-${extraClass}` : ''}`;
  return `<div class="tracks${extraTrackClass}" role="table">${header ? `<div class="tracks-head" role="row"><span class="t-num">#</span><span>Title</span>${showAlbum ? '<span class="t-album">Album</span>' : ''}${hasExtra ? `<span class="t-extra ${extraClass?`t-extra-${extraClass}`:''}">${esc(extraLabel)}</span>` : ''}<span class="t-like"></span><span class="t-time" title="Duration">${icon('clock')}</span><span class="t-more"></span></div>` : ''}${songs.map((s, i) => trackRow(s, i, q, { showAlbum, remove, extraCell, extraClass, hasExtra })).join('')}</div>`;
}
function trackRow(s, i, q, { showAlbum, remove, albumHtml, histId, extraCell, extraClass, hasExtra }) {
  const artist = s.album?.artist;
  const downloaded = hasDownloadedSong(s.song_id);
  const extraHtml = hasExtra ? `<span class="t-extra ${extraClass?`t-extra-${extraClass}`:''}">${extraCell?.(s, i) ?? '—'}</span>` : '';
  return `<div class="track ${downloaded?'is-downloaded':''}" role="row" tabindex="0" data-song="${s.song_id}" data-queue="${q}"><span class="t-num"><b>${i + 1}</b><button type="button" class="t-play" data-play="${s.song_id}" aria-label="Play ${esc(s.song_title)}">${icon('play')}</button><i class="eq" aria-hidden="true"><s></s><s></s><s></s></i></span><span class="t-title">${albumArt(s, 'tiny')}<span class="t-text"><strong>${esc(s.song_title)}${downloaded?`<span class="track-state-badge" title="Downloaded for offline listening">${icon('download')} Downloaded</span>`:''}</strong><small>${artist ? `<a href="#/artist-detail/${artist.artist_id}" data-open-artist="${artist.artist_id}">${esc(artist.artist_name)}</a>` : 'SoundWave'}</small></span></span>${showAlbum ? `<span class="t-album">${albumHtml ?? (s.album ? `<a href="#/album-detail/${s.album.album_id}" data-open-album="${s.album.album_id}">${esc(s.album.album_title)}</a>` : '')}</span>` : ''}${extraHtml}<span class="t-like">${heartBtn(s.song_id)}</span><span class="t-time">${downloaded?`<span class="track-download-icon" title="Downloaded">${icon('download')}</span>`:''}${nice(s.duration_seconds)}</span><span class="t-more"><button type="button" class="song-more" data-song-menu="${s.song_id}" aria-label="More options for ${esc(s.song_title)}">${icon('dots')}</button>${remove ? `<button type="button" class="t-remove" data-remove="${s.song_id}" aria-label="Remove from playlist">${icon('close')}</button>` : ''}${histId ? `<button type="button" class="t-remove" data-histdelete="${histId}" aria-label="Remove from history" title="Remove from history">${icon('close')}</button>` : ''}</span></div>`;
}
function playRow(r) { const q = (r.dataset.queue || '').split(',').filter(Boolean).map(Number); action(() => playSong(Number(r.dataset.song), q)); }

// ---------- Shared tiles ----------
function albumTile(a) {
  const q = ids(a.songs).join(',');
  return `<article class="release-tile card-link" tabindex="0" role="link" data-open-album="${a.album_id}" data-queue="${q}"><span class="release-art">${albumArt({ song_id: a.album_id, album: a }, 'large')}<button type="button" class="hover-play" data-play="${a.songs[0].song_id}" aria-label="Play ${esc(a.title)}">${icon('play')}</button></span><strong>${esc(a.title)}</strong><small>${yearOf(a.release_date) ? yearOf(a.release_date) + ' · ' : ''}${esc(a.artist?.artist_name || 'SoundWave')}</small></article>`;
}
function publiclyReleasedArtist(a){return isOwnArtist(a)||songsByArtist(a.artist_id).some(s=>s.is_active!==false && s.album?.is_active!==false);}
function artistCard(a, i = 0, o = {}) {
  const songs = songsByArtist(a.artist_id);
  const ownVerified = isOwnArtist(a) && state.socialRpc?.mine;
  const hasVerifiedCount = state.socialRpc?.counts || ownVerified;
  const followerCount = hasVerifiedCount && state.followerCounts?.[Number(a.artist_id)] != null ? Number(state.followerCounts[Number(a.artist_id)]) : null;
  const followerLabel = followerCount == null ? 'Follower count unavailable' : `${followerCount.toLocaleString()} ${followerCount === 1 ? 'follower' : 'followers'}`;
  const rank = Number(o?.rank || 0);
  return `<article class="artist-card clickable ${o?.showFollowers ? 'ranked-artist-card' : ''}" tabindex="0" role="link" data-open-artist="${a.artist_id}" ${songs.length ? `data-queue="${ids(songs).join(',')}"` : ''}>${rank ? `<span class="artist-rank" aria-label="Rank ${rank}">#${rank}</span>` : ''}<span class="artist-round" style="background:${grad(i)}">${esc(a.artist_name?.[0] || 'A')}${songs.length ? `<button type="button" class="hover-play" data-play="${songs[0].song_id}" aria-label="Play ${esc(a.artist_name)}">${icon('play')}</button>` : ''}</span><strong>${esc(a.artist_name)}</strong><small>Artist</small>${o?.showFollowers ? `<span class="artist-follower-proof" data-follower-count="${a.artist_id}">${esc(followerLabel)}</span>` : (followerCount != null ? `<small data-follower-count="${a.artist_id}">${esc(followerLabel)}</small>` : '')}${o && o.follow === true ? followBtn(a, 'sm') : ''}</article>`;
}
function showCard(p, i = 0) {
  const art=p.cover_path&&state.coverUrls[p.cover_path]?`<img class="cover-img" src="${esc(state.coverUrls[p.cover_path])}" alt="${esc(p.show_title)}">`:icon('mic');
  return `<button type="button" class="cover-card" data-open-show="${p.show_id}"><span class="cover-art" style="background:${grad(i)}">${art}</span><strong>${esc(p.show_title)}</strong><small>${esc(p.category || 'Podcast')}</small></button>`;
}
// F-11: limited, deduplicated and dismissible notification stack.
const toastTimers=new WeakMap();
function toast(msg,error=false){
 let stack=document.getElementById('soundwave-toasts');
 if(!stack){stack=document.createElement('div');stack.id='soundwave-toasts';stack.className='toast-stack';stack.setAttribute('aria-live','polite');document.body.append(stack);}
 const key=(error?'error:':'info:')+String(msg);
 let el=[...stack.children].find(x=>x.dataset.toastKey===key);
 if(!el){el=document.createElement('div');el.className=`toast ${error?'error':''}`;el.dataset.toastKey=key;el.setAttribute('role',error?'alert':'status');
 const mark=document.createElement('span');mark.className='toast-mark';mark.textContent=error?'!':'✓';
 const message=document.createElement('span');message.textContent=String(msg);
 const close=document.createElement('button');close.type='button';close.className='toast-close';close.textContent='×';close.setAttribute('aria-label','Dismiss notification');close.onclick=()=>{clearTimeout(toastTimers.get(el));el.remove();};
 el.append(mark,message,close);stack.append(el);
 }else{el.classList.remove('toast-pulse');void el.offsetWidth;el.classList.add('toast-pulse');}
 while(stack.children.length>3)stack.firstElementChild.remove();
 const dismiss=()=>{clearTimeout(toastTimers.get(el));toastTimers.set(el,setTimeout(()=>el.remove(),error?5000:2400));};
 el.onmouseenter=()=>clearTimeout(toastTimers.get(el));el.onmouseleave=()=>{clearTimeout(toastTimers.get(el));toastTimers.set(el,setTimeout(()=>el.remove(),1200));};
 dismiss();requestAnimationFrame(()=>el.classList.add('show'));
}

function authErrorMessage(e){
  const code=String(e?.code||e?.error_code||'').toLowerCase();
  const msg=String(e?.message||e?.error_description||e||'');
  const hay=`${code} ${msg}`.toLowerCase();
  if(/invalid_credentials|invalid login credentials|wrong password/.test(hay))return 'Incorrect email or password. Check your credentials and try again.';
  if(/email_not_confirmed|email not confirmed/.test(hay))return 'Your email is not confirmed yet. Open the confirmation email first, then sign in.';
  if(/user_banned|banned|disabled user/.test(hay))return 'This sign-in account has been disabled. Contact an administrator if you think this is a mistake.';
  if(/user_already_exists|already registered|already been registered/.test(hay))return 'That email is already registered. Sign in instead, or use a different email.';
  if(/weak_password|password.*weak|password should/.test(hay))return 'That password is too weak. Use a longer password with letters, numbers, and symbols.';
  if(/email_address_invalid|invalid email|unable to validate email/.test(hay))return 'Enter a valid email address.';
  if(/signup_disabled|signups not allowed/.test(hay))return 'New account registration is currently disabled.';
  if(/provider_disabled|unsupported provider|provider is not enabled/.test(hay))return 'Google sign-in is not enabled correctly for this project.';
  if(/flow_state_not_found|flow state.*not found|code verifier/.test(hay))return 'The Google sign-in session expired or was opened in a different browser context. Start Google sign-in again from SoundWave.';
  if(/flow_state_expired|invalid grant|authorization code.*expired/.test(hay))return 'The Google sign-in link expired. Start Google sign-in again.';
  if(/identity_already_exists/.test(hay))return 'This Google identity is already linked to another account.';
  if(/over_request_rate_limit|rate limit|too many requests|429/.test(hay))return 'Too many attempts were made. Wait a short while, then try again.';
  if(/captcha_failed|captcha/.test(hay))return 'The security check failed. Refresh the page and try again.';
  if(/otp_expired|token.*expired|expired.*token/.test(hay))return 'That sign-in or confirmation link has expired. Request a new one.';
  if(/same_password/.test(hay))return 'Choose a password different from your current password.';
  if(/reauthentication_needed/.test(hay))return 'Please sign in again before making this security-sensitive change.';
  if(/access_denied|popup_closed|cancelled|canceled|user denied/.test(hay))return 'Google sign-in was cancelled before it finished.';
  if(/redirect_uri|redirect.*mismatch/.test(hay))return 'Google sign-in is misconfigured: the callback or redirect URL does not match the OAuth settings.';
  if(/provider|oauth|google/.test(hay))return `Google sign-in could not finish${msg?`: ${msg}`:''}`;
  return '';
}
function humanErr(e){
  const authMsg=authErrorMessage(e);if(authMsg)return authMsg;
  const code=String(e?.code||'');const msg=e?.message || String(e||'');const hay=`${code} ${msg}`;
  if(/row-level security|permission denied|42501/i.test(hay))return 'You do not have permission to perform that action with this account.';
  if(/23505|duplicate key|unique constraint/i.test(hay))return 'That value is already in use. Choose a different name or title.';
  if(/23514|check constraint/i.test(hay))return "One of the values does not follow SoundWave's rules. Review the highlighted fields and try again.";
  if(/23502|null value.*violates/i.test(hay))return 'A required field is missing. Complete all required fields and try again.';
  if(/23503|foreign key/i.test(hay))return 'That item is linked to another record and cannot be changed this way.';
  if(/payload too large|entity too large|maximum.*size|file.*too large/i.test(hay))return 'That file is too large. Choose a smaller file and try again.';
  if(/resource already exists|duplicate.*object/i.test(hay))return 'A file with that name already exists. Rename it or choose another file.';
  if(/failed to fetch|network|offline/i.test(hay))return 'SoundWave cannot reach the server right now. Check your connection and try again.';
  if(/jwt|session|auth/i.test(hay))return 'Your session is no longer valid. Sign in again.';
  return msg && msg.length<180 ? msg : 'Something went wrong. Please try again.';
}
async function action(fn){if(state.loading){toast('Please wait for the current action to finish.');return;}state.loading=true;showAsyncSkeleton();try{await fn();}catch(e){console.error(e);toast(humanErr(e),true);}finally{state.loading=false;hideAsyncSkeleton();document.querySelectorAll('[data-busy]').forEach(b=>b.disabled=false);}}
function requireConfig(){if(configured)return false; $('#app').innerHTML=`<main class="main" style="max-width:820px;padding-top:90px"><div class="brand"><span class="brand-icon">♫</span> SoundWave</div><div class="card"><span class="eyebrow">Setup required</span><h1 class="page-title">Connect your Supabase project</h1><p class="muted">Make a copy of <code>.env.example</code> named <code>.env</code> and add your real project URL and publishable key. Restart the development server.</p><pre style="overflow:auto;background:#0d1526;padding:20px;border-radius:13px">VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co\nVITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY</pre><p class="footnote">Never place your database password, secret key or service_role key in this application.</p></div></main>`;return true;}
const nav = [['music','♫','Search'],['artists','♥','Artists'],['playlists','▤','Your library'],['history','◷','Recently played'],['podcasts','◉','Podcasts'],['plans','♢','Premium']];
// Dashboard and capability are separate: Admin is an additional grant, while
// Listener tools are shared by Listener, Artist and Admin sessions.
function hasArtistAccess(){return state.profile?.account_type === 'Artist' && Boolean(state.artist?.is_active);}
function hasAdminAccess(){return state.admin === true;}
function primaryDashboard(){return hasAdminAccess()?'admin-dashboard':hasArtistAccess()?'artist-dashboard':'discover';}
function defaultLanding(){return hasAdminAccess()?'admin-dashboard':hasArtistAccess()?'artist-dashboard':'discover';}
// Refresh the public artist record when opening a profile. The browse catalog
// can be older than a newly uploaded artist banner (including across accounts).
let artistCoverRequestSequence = 0;
async function refreshViewedArtistCover(artistId) {
  if (!db || !artistId) return;
  const sequence = ++artistCoverRequestSequence;
  const response = await db.from('artist').select('artist_id,cover_path').eq('artist_id', Number(artistId)).eq('is_active', true).maybeSingle();
  if (response.error) {
    console.warn('Artist cover refresh failed:', response.error);
    return;
  }
  if (!response.data || sequence !== artistCoverRequestSequence) return;
  const artist = state.artists.find(item => Number(item.artist_id) === Number(artistId));
  if (!artist) return;
  const newPath = response.data.cover_path || null;
  const changed = artist.cover_path !== newPath;
  artist.cover_path = newPath;
  if (newPath) {
    // Refresh signed URLs when an artist is opened, but render the existing image immediately.
    // A newly uploaded cover has a unique object path, so it does not inherit stale artwork.
    const url = await resolveCoverUrl(newPath);
    if (url) state.coverUrls[newPath] = url;
  }
  if (sequence !== artistCoverRequestSequence || state.page !== 'artist-detail' || Number(state.selectedArtist) !== Number(artistId)) return;
  const banner = document.getElementById('artist-profile-hero');
  const sticky = document.getElementById('artist-sticky-bar');
  const url = newPath && state.coverUrls[newPath];
  for (const node of [banner, sticky]) {
    if (!node) continue;
    if (url) node.style.setProperty('--artist-cover', `url("${url.replaceAll('"', '%22')}")`);
    else node.style.removeProperty('--artist-cover');
  }
}
function navigate(page, extras = {}) {
  if (!pageAllowed(page)) return toast('This page is not available for your account.', true);
  if (page === 'playlists' && !('selectedPlaylist' in extras)) state.selectedPlaylist = null;
  state.page = page; Object.assign(state, extras);
  // Karaoke is a dedicated music view; navigating elsewhere restores the requested page.
  state.karaokeMode=false;
  document.body.classList.toggle('karaoke-mode', Boolean(state.karaokeMode && state.player?.kind==='song'));
  render();
  if (page === 'artist-detail') void refreshViewedArtistCover(state.selectedArtist);
  const main = document.getElementById('main-content'); if (main) main.scrollTop = 0;
  if (page === 'artist-detail' && state.selectedArtist) {
    // Search-card navigation renders immediately; the popularity RPC is async.
    // Refresh the visible artist only after the correct artist's counts arrive.
    const openedArtist = Number(state.selectedArtist);
    void loadArtistPopularity(openedArtist).then(() => {
      if (state.page === 'artist-detail' && Number(state.selectedArtist) === openedArtist) {
        const main = document.getElementById('main-content');
        const previousScroll = main?.scrollTop || 0;
        render();
        const updatedMain = document.getElementById('main-content');
        if (updatedMain) updatedMain.scrollTop = previousScroll;
      }
    }).catch(error => console.warn('Artist stream counts could not load:', error));
  }
  if (page === 'admin' || page === 'admin-dashboard') scheduleStreamMetricsRefresh();
  if (page === 'history') void refreshHistory(true);
}
// Persistent admin-dashboard navigation: survives every shell redraw and does not
// rely on handlers attached to individual buttons during rendering.
function openAdminDashboardSection(target) {
  if (!hasAdminAccess()) { toast('Admin access is required.', true); return; }
  const destination = String(target || '').toLowerCase();
  const valid = ['moderation', 'analytics', 'catalog', 'payments'];
  if (!valid.includes(destination)) return;
  state.adminView = destination === 'analytics' ? 'analytics'
    : destination === 'payments' ? 'payments' : 'moderation';
  if (destination === 'catalog') state.adminTab = 'songs';
  else if (destination === 'moderation') state.adminTab = 'accounts';
  state.adminQuery = '';
  state.adminStatus = 'all';
  state.adminPriority = false;
  navigate('admin');
  // Protect against route transitions that leave the former page rendered.
  if (state.page === 'admin') {
    const section = document.querySelector(`[data-admin-view="${state.adminView}"]`);
    if (section) section.hidden = false;
  }
}
document.addEventListener('click', (event) => {
  const button = event.target.closest?.('[data-admin-dashboard-action]');
  if (!button || !button.isConnected) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  openAdminDashboardSection(button.dataset.adminDashboardAction);
}, true);

// F-07: search accessory controls work after rerenders and at the search route.
document.addEventListener('input',event=>{
 if(!event.target.matches?.('#global-search,#page-search'))return;
 const wrap=event.target.closest('.global-search,.page-search');if(!wrap)return;
 const hasValue=Boolean(event.target.value.trim());wrap.dataset.hasValue=String(hasValue);
 const clear=wrap.querySelector('.search-clear'),browse=wrap.querySelector('.search-browse'),divider=wrap.querySelector('.search-divider');
 if(clear)clear.hidden=!hasValue;if(browse)browse.hidden=hasValue;if(divider)divider.hidden=hasValue;
});
document.addEventListener('click',event=>{
 const browse=event.target.closest?.('.search-browse');if(!browse)return;
 if(state.page!=='music')return;
 event.preventDefault();event.stopImmediatePropagation();
 state.searchQuery='';state.searchGenre=null;state.searchTab='all';
 document.querySelectorAll('#global-search,#page-search').forEach(input=>{input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));});
 renderSearchResults();
},true);


// FR-01: karaoke surface lives in the main dashboard region, not the right rail.
Object.assign(state,{karaokeMode:false,mobileLyricsOpen:false,mobileQueueOpen:false});
async function ensureLyricsLoaded(songId){
 if(!songId)return '';
 if(Object.prototype.hasOwnProperty.call(state.lyricsCache,songId))return state.lyricsCache[songId];
 const result=await db.from('song_lyrics').select('*').eq('song_id',songId).maybeSingle();
 if(result.error){console.warn('Lyrics could not be loaded',result.error);return '';}
 const lyrics=String(result.data?.lyrics_text??result.data?.lyrics??result.data?.content??'');
 state.lyricsCache[songId]=lyrics;return lyrics;
}
function mobileQueueRowHtml(song, idx = null){
 if(!song)return '';
 const action = idx == null ? ' aria-current="true"' : ` data-mobile-queue-jump="${idx}"`;
 const label = idx == null ? '<small>Now playing</small>' : `<small>Tap to play next #${idx + 1}</small>`;
 return `<button type="button" class="mobile-queue-row ${idx == null ? 'current' : ''}"${action}><span class="mobile-queue-art">${albumArt(song,'tiny')}</span><span class="mobile-queue-copy"><strong>${esc(song.song_title || 'Unknown track')}</strong><span>${esc(song.album?.artist?.artist_name || 'SoundWave')}</span>${label}</span></button>`;
}
function mobileQueueMarkup(){
 const p = state.player;
 if(!p || p.kind !== 'song') return '<p class="muted small">Nothing queued yet.</p>';
 const current = songById(p.id);
 const up = (p.order || []).slice((p.pos || 0) + 1).map((id, offset) => ({ s: songById(id), idx: (p.pos || 0) + 1 + offset })).filter((x) => x.s && x.s.is_active !== false);
 return `<div class="mobile-queue-group"><h3>Now playing</h3>${current ? mobileQueueRowHtml(current, null) : '<p class="muted small">No current song.</p>'}</div><div class="mobile-queue-group"><h3>Next up</h3>${up.length ? up.slice(0, 40).map((x) => mobileQueueRowHtml(x.s, x.idx)).join('') : '<p class="muted small">Nothing else in the queue yet.</p>'}</div>`;
}
async function syncKaraokePanel(){
 const main=document.getElementById('main-content');if(!main)return;
 main.querySelector('.karaoke-panel')?.remove();
 document.body.classList.toggle('karaoke-mode',Boolean(state.karaokeMode && state.player?.kind==='song'));
 if(!document.body.classList.contains('karaoke-mode'))return;
 const panel=document.createElement('section');panel.className='karaoke-panel';panel.setAttribute('aria-label','Karaoke lyrics');
 const heading=document.createElement('div');heading.className='karaoke-heading';heading.innerHTML='<span class="karaoke-kicker">KARAOKE MODE</span><h2></h2><small class="karaoke-subtitle"></small>';heading.querySelector('h2').textContent=state.player.title||'Karaoke';heading.querySelector('.karaoke-subtitle').textContent=state.player.artist||'';
 const lines=document.createElement('div');lines.className='karaoke-lines';lines.textContent='Loading lyrics…';panel.append(heading,lines);main.append(panel);
 const songId=state.player.id;
 const lyrics=await ensureLyricsLoaded(songId);
 if(panel.isConnected && state.player?.id===songId){lines.textContent=lyrics||'Lyrics aren’t available for this track yet.';lines.classList.toggle('karaoke-empty',!lyrics); }
}
document.addEventListener('click',e=>{if(!e.target.closest?.('[data-karaoke-toggle]'))return;e.preventDefault();state.karaokeMode=!state.karaokeMode;state.railTab=state.karaokeMode?'now':state.railTab;document.querySelectorAll('[data-karaoke-toggle]').forEach(b=>b.setAttribute('aria-pressed',String(state.karaokeMode)));void syncKaraokePanel();});


// F-09: independent lyrics overlay does not rebuild audio (avoids interrupted playback).
document.addEventListener('click',async e=>{
 const btn=e.target.closest?.('#mobile-lyrics-toggle');if(!btn)return;
 e.preventDefault();state.mobileLyricsOpen=!state.mobileLyricsOpen;
 const panel=document.getElementById('mobile-now-lyrics');if(!panel)return;
 panel.hidden=!state.mobileLyricsOpen;btn.setAttribute('aria-pressed',String(state.mobileLyricsOpen));
 document.getElementById('mobile-now-playing')?.classList.toggle('show-lyrics',state.mobileLyricsOpen);
 if(state.mobileLyricsOpen){
  state.mobileQueueOpen=false;
  const qPanel=document.getElementById('mobile-now-queue'); if(qPanel) qPanel.hidden=true;
  document.getElementById('mobile-now-playing')?.classList.remove('show-queue');
 }
 if(state.mobileLyricsOpen&&state.player?.kind==='song'){
  const id=state.player.id,lines=panel.querySelector('#mobile-now-lyrics-content');
  const lyrics=await ensureLyricsLoaded(id);if(lines&&state.player?.id===id)lines.textContent=lyrics||'Lyrics haven’t been added to this track yet.';
 }
});
document.addEventListener('click',e=>{
 const btn=e.target.closest?.('#mobile-queue-toggle'); if(!btn) return;
 e.preventDefault();
 state.mobileQueueOpen=!state.mobileQueueOpen;
 state.mobileLyricsOpen=false;
 const root=document.getElementById('mobile-now-playing');
 const panel=document.getElementById('mobile-now-queue');
 const lyricsPanel=document.getElementById('mobile-now-lyrics');
 if(panel){ panel.hidden=!state.mobileQueueOpen; const content=panel.querySelector('#mobile-now-queue-content'); if(content) content.innerHTML=mobileQueueMarkup(); }
 if(lyricsPanel) lyricsPanel.hidden=true;
 root?.classList.toggle('show-queue',state.mobileQueueOpen);
 root?.classList.remove('show-lyrics');
 btn.setAttribute('aria-pressed',String(state.mobileQueueOpen));
 const lyricBtn=document.getElementById('mobile-lyrics-toggle'); if(lyricBtn) lyricBtn.setAttribute('aria-pressed','false');
});
document.addEventListener('click',e=>{
 const row=e.target.closest?.('[data-mobile-queue-jump]'); if(!row) return;
 e.preventDefault();
 const p=state.player; if(!p || p.kind!=='song') return;
 const idx=Number(row.dataset.mobileQueueJump);
 action(() => playSong(p.order[idx], p.queue, { order: p.order, pos: idx }));
});

function goBack() { window.history.back(); }
function goForward() { window.history.forward(); }
function albumArt(song, size='tile'){
 const path=song?.cover_path||song?.album?.cover_path, url=path&&state.coverUrls?.[path];
 return url?`<img class="real-cover ${size}" src="${escapeHtml(url)}" alt="" loading="lazy">`:`<span class="placeholder-art ${size}" style="background:${grad(song?.song_id||0)}" aria-hidden="true">${icon('music')}</span>`;
}
function icon(name){const paths={pin:'<path d="M12 17v5M9 3h6l-1 6 3 3v2H7v-2l3-3z" fill="currentColor"/>',list:'<path d="M4 6h16M4 12h16M4 18h16"/>',grid:'<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',shuffle:'<path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>',repeat:'<path d="m17 2 4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',repeat1:'<path d="m17 2 4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/><path d="M11 10.5l1.5-1V15" stroke-width="1.5"/>',queue:'<path d="M3 6h13M3 11h13M3 16h7"/><path d="m15 14 6 3.5-6 3.5z" fill="currentColor"/>',mute:'<path d="M3 9v6h4l5 4V5L7 9zM16 9l5 6m0-6-5 6"/>',download:'<path d="M12 3v13m-5-5 5 5 5-5M4 21h16"/>',home:'<path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-7h6v7"/>',search:'<circle cx="10.8" cy="10.8" r="6.7"/><path d="m16 16 5 5"/>',library:'<path d="M5 4v16M10 4v16M15 7l6 12"/>',music:'<path d="M9 18V5l12-2v13M9 9l12-2"/><ellipse cx="6" cy="18" rx="3" ry="2"/><ellipse cx="18" cy="16" rx="3" ry="2"/>',plus:'<path d="M12 5v14M5 12h14"/>',play:'<path d="m8 5 12 7-12 7z" fill="currentColor" stroke="none"/>',pause:'<path d="M8 5v14M16 5v14" stroke-width="4"/>',next:'<path d="m5 5 11 7-11 7zM19 5v14"/>',prev:'<path d="m19 5-11 7 11 7zM5 5v14"/>',heart:'<path d="M20.8 5.6c-2.5-2.5-5.8-1.8-8.8 1.1-3-2.9-6.3-3.6-8.8-1.1-2.5 2.6-1.4 5.6.6 7.8L12 21l8.2-7.6c2-2.2 3.1-5.2.6-7.8z"/>',mic:'<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M6 10v2a6 6 0 0 0 12 0v-2M12 18v3M8 21h8"/>',album:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/>',settings:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M4.9 4.9 7 7m10 10 2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/>',upload:'<path d="M12 16V3m-5 5 5-5 5 5M3 16v5h18v-5"/>',back:'<path d="m14 5-7 7 7 7"/>',forward:'<path d="m10 5 7 7-7 7"/>',check:'<path d="m4 12 5 5L20 6"/>',dots:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',close:'<path d="M5 5 19 19M19 5 5 19"/>',users:'<circle cx="9" cy="8" r="3"/><path d="M2 20c0-4 3-6 7-6s7 2 7 6M16 6a3 3 0 0 1 0 6m2 2c3 1 4 3 4 6"/>',shield:'<path d="m12 2 9 4v6c0 6-5 9-9 10-4-1-9-4-9-10V6z"/><path d="m8 12 3 3 5-6"/>',chevron:'<path d="m8 10 4 4 4-4"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 3"/>',volume:'<path d="M3 9v6h4l5 4V5L7 9zM16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12"/>'};return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" aria-hidden="true">${paths[name]||paths.music}</svg>`;}
function quickTile(label, meta, body, target, kind = 'album', number = 0, attrs = '') {
  const route = target.startsWith('playlist:') ? `data-openplaylist="${target.split(':')[1]}"` : target.startsWith('artist:') ? `data-open-artist="${target.split(':')[1]}"` : target.startsWith('show:') ? `data-open-show="${target.split(':')[1]}"` : `data-nav="${target}"`;
  const inner = kind === 'artist' ? esc(label[0] || 'A') : icon(kind === 'podcast' ? 'mic' : kind === 'liked' ? 'heart' : kind === 'album' ? 'album' : 'music');
  return `<div class="quick-tile" role="link" tabindex="0" ${route} ${attrs} data-tint="${kind === 'liked' ? '#4a3b8f' : tintFor(number)}"><span class="tile-cover ${kind}" ${kind === 'liked' ? '' : `style="background:${grad(number)}"`}>${inner}</span><span class="tile-copy"><strong>${esc(label)}</strong><small>${esc(meta)}</small></span>${body || ''}</div>`;
}
function listeningShelf() {
  const f = state.uiFilter || 'all', tiles = [];
  if (f !== 'podcasts') {
    if (state.likesAvailable) {
      const liked = state.liked.map((x) => songById(x.song_id)).filter(Boolean);
      tiles.push(quickTile('Liked Songs', `${state.liked.length} ${state.liked.length === 1 ? 'song' : 'songs'}`, liked.length ? `<button type="button" class="hover-play small" data-play="${liked[0].song_id}" aria-label="Play Liked Songs">${icon('play')}</button>` : '', 'liked-songs', 'liked', 0, liked.length ? `data-queue="${ids(liked).join(',')}"` : ''));
    }
    state.playlists.slice(0, 3).forEach((p, i) => tiles.push(quickTile(p.playlist_name, 'Playlist', '', 'playlist:' + p.playlist_id, 'album', i + 1)));
    state.artists.filter((a) => state.favorites.some((x) => x.artist_id === a.artist_id)).slice(0, 3).forEach((a, i) => {
      const songs = songsByArtist(a.artist_id);
      tiles.push(quickTile(a.artist_name, 'Artist', songs.length ? `<button type="button" class="hover-play small" data-play="${songs[0].song_id}" aria-label="Play ${esc(a.artist_name)}">${icon('play')}</button>` : '', 'artist:' + a.artist_id, 'artist', i + 4, songs.length ? `data-queue="${ids(songs).join(',')}"` : ''));
    });
  }
  if (f !== 'music') state.podcasts.slice(0, f === 'podcasts' ? 8 : 2).forEach((p, i) => tiles.push(quickTile(p.show_title, 'Podcast', '', 'show:' + p.show_id, 'podcast', i + 6)));
  const picks = tiles.slice(0, 8);
  return `<div class="quick-grid">${picks.length ? picks.join('') : `${quickTile('Your library', 'Start your first playlist', '', 'playlists', 'album', 0)}${quickTile('Search', 'Explore the catalog', '', 'music', 'album', 1)}${quickTile('Podcasts', 'Find a show', '', 'podcasts', 'podcast', 2)}`}</div>`;
}
function artTile(song) {
  const album = song.album ? albumById(song.album.album_id) : null;
  const q = (album ? ids(album.songs) : [song.song_id]).join(',');
  return `<article class="release-tile card-link" tabindex="0" role="link" ${song.album ? `data-open-album="${song.album.album_id}"` : ''} data-queue="${q}"><span class="release-art">${albumArt(song, 'large')}<button type="button" class="hover-play" data-play="${song.song_id}" aria-label="Play ${esc(song.song_title)}">${icon('play')}</button></span><strong>${esc(song.song_title)}</strong><small>${esc(song.album?.artist?.artist_name || 'SoundWave artist')}</small></article>`;
}
function menu(){
 const items=[['discover','home','Discover'],['music','search','Search'],['playlists','library','Your library'],['artists','heart','Artists'],['podcasts','mic','Podcasts'],['podcast-studio','upload','Podcast Studio'],['history','clock','Recently played'],['plans','users','Premium']];
 if(hasArtistAccess())items.push(['studio','upload','Artist Studio']);
 if(hasAdminAccess())items.push(['admin','shield','Admin tools']);
 return items;
}
function pageAllowed(page){
 if(['artist-dashboard','studio'].includes(page))return hasArtistAccess();
 if(['admin-dashboard','admin'].includes(page))return hasAdminAccess();
 return true;
}

function shell(content, title, desc) {
  const display = state.profile?.display_name || state.user?.email?.split('@')[0] || 'Listener';
  const role = hasAdminAccess() ? (hasArtistAccess() ? 'Artist + Admin' : 'Admin') : hasArtistAccess() ? 'Artist' : 'Listener';
  const prevMain = document.getElementById('main-content'), key = pageToHash();
  const keep = prevMain && shell.lastKey === key ? prevMain.scrollTop : 0; shell.lastKey = key;
  const tint = state.tint || '#202522'; state.tint = null;
  const roleKey = hasAdminAccess() ? (hasArtistAccess() ? 'artist-admin' : 'admin') : hasArtistAccess() ? 'artist' : 'listener';
  document.body.dataset.role = roleKey;
  const roleMenuItems = ''; // Role dashboards remain available from the home logo and mobile dock.
  const mobileDashboard = hasAdminAccess() ? ['admin-dashboard','shield','Admin'] : hasArtistAccess() ? ['artist-dashboard','upload','Artist'] : ['discover','home','Discover'];
  const homeTarget = primaryDashboard();
  const homeLabel = hasAdminAccess() ? 'Admin Dashboard' : hasArtistAccess() ? 'Artist Dashboard' : 'Discover';
  const premiumMenuBadge = isPremiumUser() ? `<span class="mini-premium-chip">${icon('check')} Premium</span>` : '';
  const profileMenu = `<div class="profile-menu" id="profile-menu" hidden><div class="profile-menu-head"><div class="profile-menu-user"><strong>${esc(display)}</strong><small>${esc(role)}</small></div>${premiumMenuBadge}</div><span class="profile-menu-sep" aria-hidden="true"></span><button data-nav="profile">${icon('users')} Profile</button><button data-nav="${followNav()}">${icon('users')} ${followLabel()}</button><button data-nav="podcast-studio">${icon('mic')} Podcast Studio</button><button data-nav="plans">${icon('check')} ${isPremiumUser()?'Manage Premium':'Upgrade to Premium'}</button>${isPremiumUser() ? `<button data-nav="downloads">${icon('download')} Downloads</button>` : ''}<button data-nav="history">${icon('clock')} Recently played</button><span class="profile-menu-sep" aria-hidden="true"></span><button id="profile-signout">${icon('forward')} Log out</button></div>`;
  $('#app').innerHTML = `<div class="app-top"><div class="app-top-left"><button type="button" class="top-logo home-btn" data-nav="${homeTarget}" aria-label="Open ${homeLabel}">${icon('home')}</button><button type="button" class="history-btn" id="nav-back" aria-label="Go back" ${state.hist.i > 0 ? '' : 'disabled'}>${icon('back')}</button><button type="button" class="history-btn" id="nav-forward" aria-label="Go forward" ${state.hist.i < state.hist.max ? '' : 'disabled'}>${icon('forward')}</button>${searchFieldHtml('global-search','global-search','What do you want to play?','Search SoundWave')}</div><div class="top-actions">${(hasArtistAccess()||hasAdminAccess())?`<button type="button" class="top-listen-btn" data-nav="discover" aria-label="Listen to music">${icon('music')}<span>Listen</span></button>`:''}<span class="role-badge">${esc(role)}</span><div class="profile-wrap"><button type="button" class="avatar top-avatar ${isPremiumUser()?'premium-user':''}" id="profile-toggle" aria-label="Open profile menu" title="${esc(display)}">${state.profilePhotoUrl?`<img src="${esc(state.profilePhotoUrl)}" alt="${esc(display)}">`:esc(display[0]?.toUpperCase() || 'S')}</button>${profileMenu}</div></div></div>
<div class="workspace"><aside class="sidebar ${state.libraryExpanded ? '' : 'library-collapsed'}" aria-label="Your library"><div class="library-head"><button type="button" class="library-toggle" id="library-toggle" aria-expanded="${state.libraryExpanded}" title="${state.libraryExpanded ? 'Collapse' : 'Expand'} your library">${icon('library')}<span>Your Library</span></button><button type="button" class="library-create-btn" data-create-playlist aria-label="Create playlist" title="Create playlist">${icon('plus')}</button></div><div class="library-tools" id="library-tools">${libraryToolsHtml()}</div><div class="library-filter-shell"><div class="library-filter-row" id="library-filters">${libraryChips()}</div><button type="button" class="library-filter-arrow" id="library-filter-arrow" aria-label="Scroll library filters right" title="Scroll filters right">${icon('forward')}</button></div><div class="library-scroll" id="library-list">${libraryListHtml()}</div></aside>
<main class="main" id="main-content" style="--tint:${tint}"><div class="dashboard-content"><div class="page-intro"><h1 class="page-title">${esc(title)}</h1></div><div class="page-body">${content}</div></div></main>
<aside class="context-rail" id="context-rail" aria-label="Now playing">${railHtml()}</aside></div>
<nav class="mobile-dock" aria-label="Mobile navigation">${[mobileDashboard, ['music', 'search', 'Search'], ['playlists', 'library', 'Library'], ['podcasts', 'mic', 'Podcasts'], ['profile', 'users', 'You']].map(([id, ico, label]) => `<button type="button" data-nav="${id}" class="${state.page === id ? 'active' : ''}">${icon(ico)}<small>${label}</small></button>`).join('')}</nav>
${addToPlaylistDialog()}`;
  const main = document.getElementById('main-content'); if (keep) main.scrollTop = keep;
  bindShared(); bindMusic(); bindRail(); bindLibrary(); renderIdlePlayer();
  const g = $('#global-search');
  if (g) {
    g.addEventListener('input', () => setSearch(g.value, g));
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter') { rememberSearch(g.value); if (state.page !== 'music' && g.value.trim()) navigate('music'); } });
  }
  document.querySelectorAll('[data-clear-search]').forEach((btn) => btn.addEventListener('click', (e) => {
    e.preventDefault();
    const input = document.getElementById(btn.dataset.clearSearch);
    if (!input) return;
    state.searchQuery = '';
    document.querySelectorAll('#global-search,#page-search').forEach((el) => { el.value = ''; });
    if (state.page === 'music') renderSearchResults();
    else render();
    requestAnimationFrame(() => document.getElementById(btn.dataset.clearSearch)?.focus());
  }));
  if (state.focusSearch) { const el = document.getElementById(state.focusSearch); if (el) { el.focus(); const n = el.value.length; try { el.setSelectionRange(n, n); } catch {} } state.focusSearch = null; }
  $('#library-toggle')?.addEventListener('click', () => { state.libraryExpanded = !state.libraryExpanded; render(); });
  $('#nav-back')?.addEventListener('click', goBack); $('#nav-forward')?.addEventListener('click', goForward);
  $('#profile-toggle')?.addEventListener('click', (e) => { e.stopPropagation(); const m = $('#profile-menu'); m.hidden = !m.hidden; });
  $('#profile-signout')?.addEventListener('click', () => action(async () => { await stopAudio(); cleanupSessionRuntime(); document.getElementById('soundwave-player')?.remove(); check(await db.auth.signOut()); }));
  bindSongMenus();
}
function grad(i=0){return ['linear-gradient(135deg,#6564aa,#3a8069)','linear-gradient(135deg,#97734b,#527e5b)','linear-gradient(135deg,#72598c,#9a6c6d)','linear-gradient(135deg,#2f7b77,#a4a45f)'][Number(i)%4]}
function bindShared() {
  bindContent(document);
  document.querySelectorAll('[data-create-playlist]').forEach((b) => b.onclick = () => action(quickCreatePlaylist));
  const libraryFilters=$('#library-filters'),libraryFilterArrow=$('#library-filter-arrow');
  if(libraryFilters && libraryFilterArrow){
    // The arrow reveals clipped chips. It never selects or changes a filter.
    const pills=()=>[...libraryFilters.querySelectorAll('.filter-pill')];
    const updateArrow=()=>{
      const max=Math.max(0,libraryFilters.scrollWidth-libraryFilters.clientWidth);
      const atEnd=libraryFilters.scrollLeft>=max-3;
      libraryFilterArrow.hidden=max<3;
      libraryFilterArrow.disabled=max<3;
      libraryFilterArrow.classList.toggle('at-end',atEnd);
      libraryFilterArrow.setAttribute('aria-label',atEnd?'Reveal hidden filters on the left':'Reveal hidden filters on the right');
      libraryFilterArrow.title=atEnd?'Reveal previous hidden filters':'Reveal next hidden filters';
    };
    libraryFilterArrow.addEventListener('click',(event)=>{
      event.preventDefault();event.stopPropagation();
      const max=Math.max(0,libraryFilters.scrollWidth-libraryFilters.clientWidth);
      if(max<3)return;
      const atEnd=libraryFilters.scrollLeft>=max-3;
      const row=libraryFilters.getBoundingClientRect();
      const items=pills();
      const margin=5;
      let delta=0;
      if(atEnd){
        const clipped=[...items].reverse().find(el=>el.getBoundingClientRect().left<row.left-margin);
        if(clipped)delta=clipped.getBoundingClientRect().left-row.left-margin;
        else delta=-Math.min(libraryFilters.clientWidth*.8,libraryFilters.scrollLeft);
      }else{
        const clipped=items.find(el=>el.getBoundingClientRect().right>row.right+margin);
        if(clipped)delta=clipped.getBoundingClientRect().right-row.right+margin;
        else delta=Math.min(libraryFilters.clientWidth*.8,max-libraryFilters.scrollLeft);
      }
      libraryFilters.scrollBy({left:delta,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
      window.setTimeout(updateArrow,300);
    });
    libraryFilters.addEventListener('scroll',updateArrow,{passive:true});
    if(typeof ResizeObserver!=='undefined'){
      const observer=new ResizeObserver(updateArrow);
      observer.observe(libraryFilters);
    }
    requestAnimationFrame(updateArrow);
  }
  document.querySelectorAll('[data-open-modal]').forEach((b) => b.onclick = () => {const d=document.getElementById(b.dataset.openModal);if(!d)return;dialogOpeners.set(d,b);d.showModal();});
  document.querySelectorAll('[data-close-modal]').forEach((b) => b.onclick = () => b.closest('dialog')?.close());document.querySelectorAll('dialog').forEach(d=>{if(d.dataset.focusReturnBound)return;d.dataset.focusReturnBound='1';d.addEventListener('close',()=>dialogOpeners.get(d)?.focus());});
  document.querySelectorAll('[data-switch-modal]').forEach((b) => b.onclick = () => { b.closest('dialog')?.close(); document.getElementById(b.dataset.switchModal)?.showModal(); });
  document.querySelectorAll('dialog.sw-modal').forEach((d) => d.addEventListener('click', (e) => { if (e.target === d) d.close(); }));
  $('#signout')?.addEventListener('click', () => action(async () => { await stopAudio(); cleanupSessionRuntime(); document.getElementById('soundwave-player')?.remove(); check(await db.auth.signOut()); }));
  $('#refresh')?.addEventListener('click', () => action(async () => { await loadData(); render(); toast('Library refreshed'); }));
  document.querySelectorAll('[data-open-add]').forEach((b) => b.onclick = () => openAddToPlaylist(Number(b.dataset.openAdd)));
}
// Binds navigation-style controls inside a container (used for the page, the search results and the right rail).
function bindContent(root = document) {
  root.querySelectorAll('[data-nav]').forEach((b) => b.onclick = () => navigate(b.dataset.nav));
  root.querySelectorAll('[data-admin-target]').forEach((b)=>{if(b.closest('.admin-overview'))return;b.onclick=()=>{state.adminTab=b.dataset.adminTarget||'accounts';state.adminView='moderation';navigate('admin');};});
  root.querySelectorAll('[data-openplaylist]').forEach((b) => b.onclick = () => openPlaylist(b.dataset.openplaylist));
  root.querySelectorAll('[data-open-show]').forEach((b) => b.onclick = () => openShow(b.dataset.openShow));
  root.querySelectorAll('[data-open-artist]').forEach((b) => b.onclick = (e) => { e.preventDefault(); e.stopPropagation(); navigate('artist-detail', { selectedArtist: Number(b.dataset.openArtist) }); });
  root.querySelectorAll('[data-open-album]').forEach((b) => b.onclick = (e) => { e.preventDefault(); e.stopPropagation(); navigate('album-detail', { selectedAlbum: Number(b.dataset.openAlbum) }); });
  root.querySelectorAll('[data-filter]').forEach((b) => b.onclick = () => { state.uiFilter = b.dataset.filter; render(); });
  root.querySelectorAll('[data-discover-filter]').forEach((b) => b.onclick = () => { state.discoverFilter = b.dataset.discoverFilter || 'all'; render(); });
  root.querySelectorAll('[data-discover-showall]').forEach((b) => b.onclick = () => {
    const key=b.dataset.discoverShowall;
    state.discoverExpanded[key]=!state.discoverExpanded[key];
    render();
  });
  root.querySelectorAll('.quick-tile[data-tint]').forEach((t) => {
    const main = document.getElementById('main-content');
    t.addEventListener('mouseenter', () => main?.style.setProperty('--tint', t.dataset.tint));
    t.addEventListener('mouseleave', () => main?.style.setProperty('--tint', '#2d2d3d'));
  });
}
function playerRoot(){let el=document.getElementById('soundwave-player');if(!el){el=document.createElement('div');el.id='soundwave-player';document.body.appendChild(el)}return el}
function syncIdleLayout() { document.body.classList.toggle('is-idle', !state.player); }
function renderIdlePlayer() {
  syncIdleLayout();
  const existing = document.getElementById('soundwave-player');
  // Do not mount an empty player. The app shell expands to the viewport while idle.
  if (!state.user || !state.player) { existing?.remove(); return; }
}
function playerBarHtml(d) {
  const idle = !d, podcast = d?.kind === 'podcast', dis = idle ? 'disabled' : '';
  const song = d?.kind === 'song' ? songById(d.id) : null;
  const artistId = song?.album?.artist?.artist_id;
  const vol = prefs.muted ? 0 : Math.round(prefs.volume * 100);
  const thumb = idle ? icon('music') : podcast ? icon('mic') : albumArt(song, 'tiny');
  const fullArt = podcast ? `<span class="mobile-now-placeholder">${icon('mic')}</span>` : albumArt(song, 'large');
  const contextLabel = podcast ? 'Playing podcast' : 'Now playing';
  const mobileQuickActions = !idle&&!podcast ? `<div class="mobile-now-actions"><button type="button" id="mobile-queue-toggle" class="mobile-now-pill" aria-pressed="${Boolean(state.mobileQueueOpen)}" aria-label="Open queue">${icon('queue')}<span>Queue</span></button><button type="button" id="mobile-lyrics-toggle" class="mobile-now-pill" aria-pressed="${Boolean(state.mobileLyricsOpen)}" aria-label="Open lyrics">${icon('music')}<span>Lyrics</span></button></div>` : '';
  const mobileQueuePanel = !idle&&!podcast ? `<section class="mobile-now-queue" id="mobile-now-queue" hidden><div class="mobile-now-sheet-head"><h3>Queue</h3></div><div id="mobile-now-queue-content">${mobileQueueMarkup()}</div></section>` : '';
  return `<div class="custom-playbar ${idle ? 'idle-playbar' : ''}">
 <div class="player-song"><div class="mobile-now-open" id="mobile-now-open" role="button" tabindex="0" aria-label="Open now playing details"><span class="player-thumb ${idle ? 'idle-thumb' : ''}">${thumb}</span><span class="player-song-text"><strong>${esc(d?.title || 'SoundWave')}</strong><small>${idle ? 'Choose something to play' : artistId ? `<a href="#/artist-detail/${artistId}" data-open-artist="${artistId}">${esc(d.artist)}</a>` : esc(d.artist)}</small></span></div>${song ? heartBtn(song.song_id, 'player-heart') : ''}</div>
 <div class="player-center"><div class="play-controls">
  ${podcast ? '' : `<button type="button" id="sw-shuffle" class="icon-quiet mode ${prefs.shuffle ? 'active' : ''}" aria-pressed="${prefs.shuffle}" aria-label="Shuffle" title="Shuffle" ${dis}>${icon('shuffle')}</button>`}
  <button type="button" id="sw-prev" class="icon-quiet" aria-label="${podcast ? 'Back 15 seconds' : 'Previous song'}" title="${podcast ? 'Back 15 seconds' : 'Previous'}" ${dis}>${podcast ? '<span class="skip-15">−15</span>' : icon('prev')}</button>
  <span class="mini-visualizer" aria-hidden="true"><i></i><i></i><i></i><i></i></span><button type="button" id="sw-toggle" class="player-main-play" aria-label="${idle ? 'Play' : 'Pause'}" ${dis}>${icon(idle ? 'play' : 'pause')}</button>
  <button type="button" id="sw-next" class="icon-quiet" aria-label="${podcast ? 'Forward 15 seconds' : 'Next song'}" title="${podcast ? 'Forward 15 seconds' : 'Next'}" ${dis}>${podcast ? '<span class="skip-15">+15</span>' : icon('next')}</button>
  ${!idle&&!podcast?`<button type="button" id="sw-queue" class="icon-quiet transport-side-action ${state.railTab === 'queue' && !prefs.railHidden ? 'active' : ''}" aria-label="Queue" title="Queue">${icon('queue')}</button><button type="button" class="icon-quiet transport-side-action" data-karaoke-toggle aria-label="Toggle karaoke lyrics" aria-pressed="${Boolean(state.karaokeMode)}" title="Karaoke lyrics">${icon('mic')}</button>`:''}
  ${podcast ? '' : `<button type="button" id="sw-repeat" class="icon-quiet mode ${prefs.repeat !== 'off' ? 'active' : ''}" data-mode="${prefs.repeat}" aria-label="Repeat: ${prefs.repeat}" title="Repeat" ${dis}>${icon(prefs.repeat === 'one' ? 'repeat1' : 'repeat')}</button>`}
 </div><div class="player-timeline"><span id="sw-elapsed">0:00</span><input id="sw-seek" type="range" min="0" max="1000" value="0" style="--pct:0%" aria-label="Seek position" ${dis}><span id="sw-total">${nice(d?.duration || 0)}</span></div></div>
 <div class="player-right"><button type="button" id="sw-mute" class="icon-quiet" aria-label="Mute" title="Mute">${icon(vol === 0 ? 'mute' : 'volume')}</button><input id="sw-volume" type="range" min="0" max="100" value="${vol}" style="--pct:${vol}%" aria-label="Volume"><button type="button" id="sw-view" class="icon-quiet ${prefs.railHidden ? '' : 'active'}" aria-label="Now playing view" title="Now playing view">${icon('library')}</button></div>
 ${idle ? '' : `<audio id="sw-audio" preload="metadata" src="${esc(d.url)}"></audio><section class="mobile-now-playing" id="mobile-now-playing" aria-hidden="true"><div class="mobile-now-bg" aria-hidden="true"></div><section class="mobile-now-lyrics" id="mobile-now-lyrics" hidden><div class="mobile-now-sheet-head"><h3>Lyrics</h3></div><div id="mobile-now-lyrics-content">Loading lyrics…</div></section>${mobileQueuePanel}<div class="mobile-now-head"><button type="button" id="mobile-now-close" class="mobile-now-icon" aria-label="Close now playing">${icon('back')}</button><strong>${contextLabel}</strong><span class="mobile-now-spacer" aria-hidden="true"></span></div><div class="mobile-now-art">${fullArt}</div><div class="mobile-now-copy"><div><h2>${esc(d.title)}</h2><p>${esc(d.artist)}</p></div>${song ? heartBtn(song.song_id, 'mobile-now-heart') : ''}</div><div class="mobile-now-progress"><input id="mobile-now-seek" type="range" min="0" max="1000" value="0" aria-label="Seek position"><div><span id="mobile-now-elapsed">0:00</span><span id="mobile-now-total">${nice(d.duration || 0)}</span></div></div><div class="mobile-now-controls"><button type="button" id="mobile-now-prev" aria-label="${podcast ? 'Back 15 seconds' : 'Previous song'}">${podcast ? '<span class="skip-15">−15</span>' : icon('prev')}</button><button type="button" id="mobile-now-toggle" class="mobile-now-play" aria-label="Pause">${icon('pause')}</button><button type="button" id="mobile-now-next" aria-label="${podcast ? 'Forward 15 seconds' : 'Next song'}">${podcast ? '<span class="skip-15">+15</span>' : icon('next')}</button></div>${mobileQuickActions}</section>`}</div>`;
}
async function stopAudio() {
  const audio = document.getElementById('sw-audio');
  if (audio) {
    const duration = Number(audio.duration) || Number(state.player?.duration) || 0;
    const finished = audio.ended || (duration > 0 && Number(audio.currentTime || 0) >= Math.max(0, duration - 1));
    try { await saveListening(finished); } catch (e) { console.warn('Could not persist playback before closing the player:', e); }
    audio.pause();
    if (audio.src?.startsWith('blob:')) URL.revokeObjectURL(audio.src);
  }
  state.player = null; state.playerToken++; state.karaokeMode=false;document.body.classList.remove('karaoke-mode','mobile-player-open');
  document.title = 'SoundWave | Music for every moment';
  try { if ('mediaSession' in navigator) navigator.mediaSession.metadata = null; } catch {}
  const root = document.getElementById('soundwave-player');
  if (!state.user) { root?.remove(); return; }
  renderIdlePlayer(); refreshRail(); markPlaying();
}
function buildPlayback(songId, queueIds, opts = {}) {
  const id = Number(songId);
  const queue = (queueIds && queueIds.length ? queueIds : ids(state.songs)).map(Number);
  if (!queue.includes(id)) queue.unshift(id);
  let order = opts.order, pos = opts.pos;
  if (!order) {
    if (prefs.shuffle) { order = [id, ...shuffled(queue.filter((x) => x !== id))]; pos = 0; }
    else { order = [...queue]; pos = order.indexOf(id); }
  }
  return { queue, order, pos };
}
async function playSong(songId, queueIds = null, opts = {}) {
  await requirePlaybackAccess();
  const id = Number(songId);
  const cur = state.player, audio = document.getElementById('sw-audio');
  if (!opts.order && cur?.kind === 'song' && Number(cur.id) === id && audio) { if (audio.paused) await audio.play(); else audio.pause(); return; }
  const pb = buildPlayback(id, queueIds, opts);
  if (!navigator.onLine && state.offlineDownloads.some((x) => Number(x.songId) === id)) return playDownloaded(id, pb);
  const song = songById(id);
  if (!song?.audio_path) throw Error('This song has no playable audio uploaded yet.');
  const result = check(await db.storage.from('song-audio').createSignedUrl(song.audio_path, 3600));
  startPlayer({ kind: 'song', id: song.song_id, title: song.song_title, artist: song.album?.artist?.artist_name || 'SoundWave', url: result.signedUrl, duration: song.duration_seconds, fromSkip: !!opts.fromSkip, ...pb });
}
function reorderQueue() {
  const p = state.player; if (!p || p.kind !== 'song') return;
  const cur = Number(p.id);
  if (prefs.shuffle) { p.order = [cur, ...shuffled(p.queue.filter((x) => x !== cur))]; p.pos = 0; }
  else { p.order = [...p.queue]; p.pos = Math.max(0, p.order.indexOf(cur)); }
}
function updateModeButtons() {
  const sh = $('#sw-shuffle'), rp = $('#sw-repeat');
  if (sh) { sh.classList.toggle('active', prefs.shuffle); sh.setAttribute('aria-pressed', String(prefs.shuffle)); }
  if (rp) { rp.classList.toggle('active', prefs.repeat !== 'off'); rp.dataset.mode = prefs.repeat; rp.setAttribute('aria-label', `Repeat: ${prefs.repeat}`); rp.innerHTML = icon(prefs.repeat === 'one' ? 'repeat1' : 'repeat'); }
  document.querySelectorAll('[data-toggle-shuffle]').forEach((b) => b.classList.toggle('active', prefs.shuffle));
}
function toggleShuffle() { prefs.shuffle = !prefs.shuffle; savePrefs(); reorderQueue(); updateModeButtons(); refreshRail(); }
function addToQueue(id) {
  id = Number(id);
  const p = state.player;
  if (!p || p.kind !== 'song') { action(() => playSong(id, [id])); return; }
  if (!p.queue.includes(id)) p.queue.push(id);
  p.order.splice(p.pos + 1, 0, id);
  refreshRail(); toast('Added to queue');
}

function relatedSongsAfterQueue(player){
  const current=songById(player?.id);
  const genreId=Number(current?.genre_id||0);
  const already=new Set((player?.queue||[]).map(Number));
  let pool=(state.songs||[]).filter(s=>s?.is_active!==false&&s.audio_path&&!already.has(Number(s.song_id))&&(genreId?Number(s.genre_id)===genreId:true));
  if(!pool.length) pool=(state.songs||[]).filter(s=>s?.is_active!==false&&s.audio_path&&!already.has(Number(s.song_id)));
  return shuffled(pool).slice(0,20).map(s=>Number(s.song_id));
}
async function continueWithRelatedSongs(player){
  const related=relatedSongsAfterQueue(player);
  if(!related.length)return false;
  await playSong(related[0],related,{order:related,pos:0,fromSkip:true});
  toast('Playing similar music');
  return true;
}
async function skip(dir, auto = false) {
  const p = state.player, audio = document.getElementById('sw-audio');
  if (!p || !audio) return;
  if (p.kind !== 'song') { audio.currentTime = Math.max(0, audio.currentTime + (dir > 0 ? 15 : -15)); return; }
  if (dir < 0 && audio.currentTime > 3) { audio.currentTime = 0; return; }
  if (auto && prefs.repeat === 'one') { audio.currentTime = 0; await audio.play().catch(() => {}); return; }
  let pos = p.pos + dir;
  if (pos >= p.order.length) {
    if (auto && prefs.repeat !== 'all') {
      if(await continueWithRelatedSongs(p))return;
      audio.currentTime = 0; audio.pause(); return;
    }
    if (prefs.shuffle) p.order = shuffled(p.queue);
    pos = 0;
  }
  if (pos < 0) pos = p.order.length - 1;
  await playSong(p.order[pos], p.queue, { order: p.order, pos, fromSkip: true });
}
function startPlayer(details) {
  const old = document.getElementById('sw-audio');
  if (old) { void saveListening(old.ended); old.pause(); if (old.src?.startsWith('blob:')) URL.revokeObjectURL(old.src); }
  const wasIdle = !state.player;
  if(details.kind !== 'song') { state.karaokeMode=false; document.body.classList.remove('karaoke-mode'); }
  state.player = details; const token = ++state.playerToken; syncIdleLayout();
  if (details.kind === 'song') persistPlayerSnapshot(details, details.resumeAt || 0);
  // Restored players are intentionally quiet: they rebuild the bottom bar after login
  // without opening the right rail or creating a new listening-history row.
  if (!details.restored) {
    if (wasIdle) state.railTab = 'now';
    if (wasIdle || !details.fromSkip) toggleRail(false);
  }
  playerRoot().innerHTML = playerBarHtml(details);
  const audio = $('#sw-audio'); audio.volume = prefs.muted ? 0 : prefs.volume;
  if (details.resumeAt > 5) audio.addEventListener('loadedmetadata', () => { try { audio.currentTime = details.resumeAt; } catch {} }, { once: true });
  bindPlayerBar(audio, details, token);
  refreshRail(); markPlaying(); updateMediaSession(details);
  document.title = `${details.title} · ${details.artist}`;
  if (details.autoplay !== false) audio.play().catch(() => { toast('Press Play to start audio.'); });
}
function bindPlayerBar(audio, details, token) {
  let seeking = false;
  audio.addEventListener('play',()=>{void (async()=>{if(!(await verifyAccountAccess({silent:true}))){audio.pause();}})();});
  const podcast = details.kind === 'podcast';
  const live = () => token === state.playerToken;
  const dur = () => (audio.duration > 0 && isFinite(audio.duration) ? audio.duration : Number(details.duration) || 0);
  const sync = () => {
    if (!live() || !$('#sw-toggle')) return;
    $('#sw-toggle').innerHTML = icon(audio.paused ? 'play' : 'pause');
    $('#sw-toggle').setAttribute('aria-label', audio.paused ? 'Play' : 'Pause');
    const mt = $('#mobile-now-toggle'); if (mt) { mt.innerHTML = icon(audio.paused ? 'play' : 'pause'); mt.setAttribute('aria-label', audio.paused ? 'Play' : 'Pause'); }
    $('#sw-total').textContent = nice(dur());
    if (!seeking) {
      const pct = dur() > 0 ? Math.min(1000, Math.floor((audio.currentTime / dur()) * 1000)) : 0;
      $('#sw-elapsed').textContent = nice(audio.currentTime);
      const sk = $('#sw-seek'); sk.value = String(pct); sk.style.setProperty('--pct', `${pct / 10}%`);
      const msk = $('#mobile-now-seek'); if (msk) { msk.value = String(pct); msk.style.setProperty('--pct', `${pct / 10}%`); }
      if ($('#mobile-now-elapsed')) $('#mobile-now-elapsed').textContent = nice(audio.currentTime);
      if ($('#mobile-now-total')) $('#mobile-now-total').textContent = nice(dur());
    }
    try { if ('mediaSession' in navigator && dur() > 0) navigator.mediaSession.setPositionState({ duration: dur(), position: Math.min(audio.currentTime, dur()), playbackRate: audio.playbackRate }); } catch {}
  };
  $('#sw-toggle').onclick = () => { if (audio.paused) audio.play().catch((e) => toast(humanErr(e), true)); else audio.pause(); };
  $('#mobile-now-open')?.addEventListener('click', (e) => { if (e.target.closest('.heart-btn') || e.target.closest('a')) return; const panel=$('#mobile-now-playing'); if(panel){panel.classList.add('open');panel.setAttribute('aria-hidden','false');panel.classList.toggle('show-lyrics',Boolean(state.mobileLyricsOpen));panel.classList.toggle('show-queue',Boolean(state.mobileQueueOpen));document.body.classList.add('mobile-player-open');const lp=$('#mobile-now-lyrics'); if(lp) lp.hidden=!state.mobileLyricsOpen; const qp=$('#mobile-now-queue'); if(qp) qp.hidden=!state.mobileQueueOpen;} });
  $('#mobile-now-open')?.addEventListener('keydown', (e) => { if ((e.key==='Enter'||e.key===' ') && !e.target.closest('a')) { e.preventDefault(); $('#mobile-now-open').click(); } });
  $('#mobile-now-close')?.addEventListener('click', () => { const panel=$('#mobile-now-playing'); if(panel){panel.classList.remove('open');panel.setAttribute('aria-hidden','true');panel.classList.remove('show-lyrics','show-queue');document.body.classList.remove('mobile-player-open');} state.mobileLyricsOpen=false; state.mobileQueueOpen=false; const lp=$('#mobile-now-lyrics'); if(lp) lp.hidden=true; const qp=$('#mobile-now-queue'); if(qp) qp.hidden=true; });
  $('#mobile-now-toggle')?.addEventListener('click', () => { if (audio.paused) audio.play().catch((e) => toast(humanErr(e), true)); else audio.pause(); });
  $('#mobile-now-prev')?.addEventListener('click', () => action(() => skip(-1)));
  $('#mobile-now-next')?.addEventListener('click', () => action(() => skip(1)));
  const mobileSeek=$('#mobile-now-seek'); if(mobileSeek){mobileSeek.oninput=(e)=>{seeking=true;const v=Number(e.target.value);e.target.style.setProperty('--pct',`${v/10}%`);if($('#mobile-now-elapsed'))$('#mobile-now-elapsed').textContent=nice((dur()*v)/1000)};mobileSeek.onchange=(e)=>{if(dur()>0)audio.currentTime=(dur()*Number(e.target.value))/1000;seeking=false;sync();};}
  $('#sw-prev').onclick = () => action(() => skip(-1));
  $('#sw-next').onclick = () => action(() => skip(1));
  $('#sw-shuffle')?.addEventListener('click', toggleShuffle);
  $('#sw-repeat')?.addEventListener('click', () => { prefs.repeat = { off: 'all', all: 'one', one: 'off' }[prefs.repeat]; savePrefs(); updateModeButtons(); toast(prefs.repeat === 'off' ? 'Repeat off' : prefs.repeat === 'all' ? 'Repeating the queue' : 'Repeating this song'); });
  const seek = $('#sw-seek');
  seek.oninput = (e) => { seeking = true; const v = Number(e.target.value); e.target.style.setProperty('--pct', `${v / 10}%`); $('#sw-elapsed').textContent = nice((dur() * v) / 1000); };
  seek.onchange = (e) => { if (dur() > 0) audio.currentTime = (dur() * Number(e.target.value)) / 1000; seeking = false; sync(); };
  const vol = $('#sw-volume');
  const paintVol = () => { const v = prefs.muted ? 0 : Math.round(prefs.volume * 100); vol.value = String(v); vol.style.setProperty('--pct', `${v}%`); $('#sw-mute').innerHTML = icon(v === 0 ? 'mute' : 'volume'); audio.volume = v / 100; };
  vol.oninput = (e) => { prefs.volume = Number(e.target.value) / 100; prefs.muted = prefs.volume === 0; savePrefs(); paintVol(); };
  $('#sw-mute').onclick = () => { prefs.muted = !prefs.muted; if (!prefs.muted && prefs.volume === 0) prefs.volume = .5; savePrefs(); paintVol(); };
  $('#sw-queue').onclick = () => { state.railTab = state.railTab === 'queue' && !prefs.railHidden ? 'now' : 'queue'; if (prefs.railHidden) toggleRail(false); refreshRail(); };
  $('#sw-view').onclick = () => { toggleRail(); $('#sw-view').classList.toggle('active', !prefs.railHidden); refreshRail(); };
  audio.addEventListener('timeupdate', () => {
    sync();
    if (!live()) return;
    const seconds=Math.floor(Number(audio.currentTime)||0);
    if(seconds>=5 && (!details.checkpointAt || seconds-details.checkpointAt>=10)){
      details.checkpointAt=seconds;
      void saveListening(false);
    }
  }); audio.addEventListener('loadedmetadata', sync); audio.addEventListener('durationchange', sync);
  audio.onplay = () => { sync(); markPlaying(); if (live()) details.createPromise = createListening(); };
  audio.onpause = () => { sync(); markPlaying(); if (live()) void saveListening(false); };
  audio.onended = () => { sync(); markPlaying(); if (live()) action(async()=>{ await saveListening(true); if(details.kind==='song') await skip(1,true); }); };
  audio.onerror = async () => {
    if (!live() || details.retried || details.offline || details.kind !== 'song') { if (live()) toast('This track could not be played.', true); return; }
    details.retried = true;
    try { const song = songById(details.id); const r = check(await db.storage.from('song-audio').createSignedUrl(song.audio_path, 3600)); const t = audio.currentTime; audio.src = r.signedUrl; audio.currentTime = t; await audio.play(); } catch (e) { toast(humanErr(e), true); }
  };
}
function markPlaying() {
  const p = state.player, audio = document.getElementById('sw-audio'), playing = !!(audio && !audio.paused);
  document.querySelectorAll('.track[data-song]').forEach((r) => {
    if(r.closest('.history-tracks')){r.classList.remove('playing','paused');const b=r.querySelector('.t-play');if(b)b.innerHTML=icon('play');return;}
    const on = p?.kind === 'song' && Number(r.dataset.song) === Number(p.id);
    r.classList.toggle('playing', on); r.classList.toggle('paused', on && !playing);
    const b = r.querySelector('.t-play'); if (b) b.innerHTML = icon(on && playing ? 'pause' : 'play');
  });
}
function updateMediaSession(d) {
  if (!('mediaSession' in navigator)) return;
  try {
    const song = d.kind === 'song' ? songById(d.id) : null;
    const art = song?.album?.cover_path && state.coverUrls[song.album.cover_path];
    navigator.mediaSession.metadata = new MediaMetadata({ title: d.title, artist: d.artist, album: song?.album?.album_title || 'SoundWave', artwork: art ? [{ src: art, sizes: '512x512' }] : [] });
  } catch {}
}
function initMediaKeys() {
  if (!('mediaSession' in navigator)) return;
  const a = () => document.getElementById('sw-audio');
  const set = (n, f) => { try { navigator.mediaSession.setActionHandler(n, f); } catch {} };
  set('play', () => action(async()=>{await requirePlaybackAccess();await a()?.play();})); set('pause', () => a()?.pause());
  set('previoustrack', () => action(() => skip(-1))); set('nexttrack', () => action(() => skip(1)));
  set('seekto', (e) => { if (a() && e.seekTime != null) a().currentTime = e.seekTime; });
}
function isQualifiedStream(row){
  const seconds=Number(row?.duration_played_seconds)||0;
  return String(row?.completion_status||'').toLowerCase()==='completed' || seconds>=30;
}
function uniqueStreamRows(rows=[]){
  const seen=new Set();
  return rows.filter(r=>{const key=r.stream_id!=null?`id:${r.stream_id}`:`${r.user_id||''}:${r.song_id||''}:${r.stream_date||''}`;if(seen.has(key))return false;seen.add(key);return true;});
}
async function restoreLastSongPlayer(){
  if(!state.user||state.player||!db)return;
  const recent=(state.history||[]).find(r=>Number(r.song_id)&&isQualifiedStream(r)) || (state.history||[]).find(r=>Number(r.song_id));
  const snapshot=readPlayerSnapshot();
  const targetSongId=Number(recent?.song_id || snapshot?.id || 0);
  if(!targetSongId)return;
  const song=songById(targetSongId);
  if(!song?.audio_path)return;
  try{
    const signed=check(await db.storage.from('song-audio').createSignedUrl(song.audio_path,3600));
    const pb=buildPlayback(song.song_id,ids(state.songs));
    const resumeAt = recent && String(recent.completion_status || '').toLowerCase() !== 'completed'
      ? Math.max(0, Number(recent.duration_played_seconds) || 0)
      : Math.max(0, Number(snapshot?.resumeAt) || 0);
    startPlayer({kind:'song',id:song.song_id,title:song.song_title,artist:song.album?.artist?.artist_name||'SoundWave',url:signed.signedUrl,duration:song.duration_seconds,autoplay:false,restored:true,resumeAt,...pb});
  }catch(e){console.warn('Could not restore last played song:',e);}
}

async function createListening(){
 const p=state.player;if(!p||p.recorded||p.creating||!state.user)return;
 p.creating=true;p.historyEventId=p.historyEventId||crypto.randomUUID();
 const isPodcast=p.kind==='podcast',table=isPodcast?'podcast_listening_history':'listening_history',idKey=isPodcast?'podcast_stream_id':'stream_id';
 const payload=isPodcast?{user_id:state.user.id,episode_id:p.id,duration_played_seconds:0,resume_position_seconds:0,completion_status:'Partial',device_type:'Web',client_event_id:p.historyEventId}:{user_id:state.user.id,song_id:p.id,duration_played_seconds:0,completion_status:'Partial',device_type:'Web',stream_quality:'Standard',client_event_id:p.historyEventId};
 try{
   let insert=await db.from(table).insert(payload).select(idKey).maybeSingle();
   if(insert.error&&String(insert.error.code)==='23505')insert=await db.from(table).select(idKey).eq('client_event_id',p.historyEventId).maybeSingle();
   const q=check(insert);if(!q?.[idKey])throw Error('Listening history record could not be resolved.');
   p.historyId=q[idKey];p.recorded=true;p.historyRetryNeeded=false;state.historyWriteError='';
   const row=isPodcast?{podcast_stream_id:p.historyId,user_id:state.user.id,episode_id:p.id,stream_date:new Date().toISOString(),duration_played_seconds:0,resume_position_seconds:0,completion_status:'Partial'}:{stream_id:p.historyId,user_id:state.user.id,song_id:p.id,stream_date:new Date().toISOString(),duration_played_seconds:0,completion_status:'Partial'};
   const list=isPodcast?state.podcastHistory:state.history;if(!list.some(x=>Number(x[idKey])===Number(p.historyId)))list.unshift(row);
   if(isPodcast){state.episodeTitles[p.id]=p.title;schedulePodcastMetricsRefresh();}else{scheduleStreamMetricsRefresh();persistPlayerSnapshot(p,0);}
   persistHistoryCache();if(state.page==='history')render();
 }catch(e){
   console.warn('Listening-history write failed:',e);state.historyWriteError=humanErr(e);p.historyRetryNeeded=true;p.recorded=false;
   toast('Playback works, but history could not be recorded yet. SoundWave will retry.',true);if(state.page==='history')render();
 }finally{p.creating=false;}
}
async function retryHistoryUpdate(table,key,id,payload,attempt=1){
  await new Promise(resolve=>setTimeout(resolve,Math.min(8000,1000*2**(attempt-1))));
  const r=await db.from(table).update(payload).eq(key,id);
  if(r.error){if(attempt<3)return retryHistoryUpdate(table,key,id,payload,attempt+1);console.warn('Playback history remained unsynced after retries:',r.error);return false;}
  const isPodcast=table==='podcast_listening_history',list=isPodcast?state.podcastHistory:state.history,row=list.find(x=>Number(x[key])===Number(id));if(row)Object.assign(row,payload);persistHistoryCache();return true;
}
async function saveListening(ended=false){
 const p=state.player,audio=document.getElementById('sw-audio');if(!p||!audio)return;
 if(!p.historyId&&!p.creating){p.createPromise=createListening();await p.createPromise;}else if(p.createPromise)await p.createPromise;
 if(!p.historyId)return;
 const elapsed=Math.floor(Number(audio.currentTime)||0),maximum=Number(p.duration)||Math.ceil(audio.duration)||elapsed,seconds=Math.min(elapsed,maximum);
 if(seconds===p.lastSaved&&!ended)return;
 const isPodcast=p.kind==='podcast',payload={duration_played_seconds:seconds,completion_status:ended?'Completed':seconds<5?'Skipped':'Partial'};if(isPodcast)payload.resume_position_seconds=ended?0:seconds;
 const table=isPodcast?'podcast_listening_history':'listening_history',key=isPodcast?'podcast_stream_id':'stream_id';
 const r=await db.from(table).update(payload).eq(key,p.historyId);
 if(r.error){console.warn('Could not update playback history:',r.error);state.historyWriteError=humanErr(r.error);p.pendingHistoryPayload={...payload};void retryHistoryUpdate(table,key,p.historyId,payload);return;}
 p.lastSaved=seconds;p.pendingHistoryPayload=null;state.historyWriteError='';
 const list=isPodcast?state.podcastHistory:state.history,row=list.find(x=>Number(x[key])===Number(p.historyId));if(row)Object.assign(row,payload);
 if(!isPodcast)persistPlayerSnapshot(p,ended?0:seconds);persistHistoryCache();
 if(isPodcast){if(ended)await refreshPodcastStudioMetrics();else schedulePodcastMetricsRefresh();}
 else{if(ended)await refreshStreamMetrics();else scheduleStreamMetricsRefresh();}
}
let streamMetricsRefreshTimer=null;
let podcastMetricsRefreshTimer=null;
function schedulePodcastMetricsRefresh(){
  clearTimeout(podcastMetricsRefreshTimer);
  podcastMetricsRefreshTimer=setTimeout(()=>{void refreshPodcastStudioMetrics();},450);
}
function scheduleStreamMetricsRefresh(){
  clearTimeout(streamMetricsRefreshTimer);
  streamMetricsRefreshTimer=setTimeout(()=>{void refreshStreamMetrics();},450);
}
async function refreshPodcastStudioMetrics(){
  if(!state.user||!db)return;
  try{
    const ownShowIds=(state.myShows||[]).map(x=>Number(x.show_id)).filter(Boolean);
    if(!ownShowIds.length){state.podcastStudioHistory=[];return;}
    let episodes=state.episodes.filter(ep=>ownShowIds.includes(Number(ep.show_id)));
    if(!episodes.length){
      const er=await db.from('podcast_episode').select('episode_id,show_id,episode_title,description,duration_seconds,audio_path,release_at,is_active').in('show_id',ownShowIds).order('release_at',{ascending:false});
      if(!er.error){episodes=er.data||[];state.episodes=episodes;}
    }
    const episodeIds=episodes.map(x=>Number(x.episode_id)).filter(Boolean);
    if(!episodeIds.length){state.podcastStudioHistory=[];return;}
    const remote=await db.from('podcast_listening_history').select('podcast_stream_id,user_id,episode_id,stream_date,duration_played_seconds,resume_position_seconds,completion_status').in('episode_id',episodeIds).order('stream_date',{ascending:false}).limit(4000);
    const cached=readAllCachedPodcastHistories().filter(r=>episodeIds.includes(Number(r.episode_id)));
    state.podcastStudioHistory=mergePodcastHistory(remote.error?[]:(remote.data||[]),cached);
    if(state.page==='podcast-studio')render();
  }catch(e){console.warn('Could not refresh Podcast Studio analytics:',e);}
}

async function refreshStreamMetrics(){
  if(!state.user||!db)return;
  try{
    const now=Date.now(),since90=new Date(now-90*86400000).toISOString(),since30=new Date(now-30*86400000).toISOString();
    const hist=await db.from('listening_history').select('stream_id,user_id,song_id,stream_date,duration_played_seconds,completion_status').eq('user_id',state.user.id).gte('stream_date',since90).order('stream_date',{ascending:false}).limit(1500);
    if(!hist.error){
      state.insightHistory=mergeStreamHistory(hist.data||[], readCachedHistory());
      state.listeningStats=computeListeningStats(state.insightHistory);
      const weekCut=now-7*86400000,counts=new Map();
      state.insightHistory.filter(r=>new Date(r.stream_date).getTime()>=weekCut).forEach(r=>counts.set(Number(r.song_id),(counts.get(Number(r.song_id))||0)+1));
      state.topWeekSongs=[...counts.entries()].sort((a,b)=>b[1]-a[1]).map(([id])=>songById(id)).filter(Boolean).slice(0,20);
    }
    const ps=await db.rpc('profile_stats');
    if(!ps.error)state.profileStats=Array.isArray(ps.data)?ps.data[0]:ps.data;
    if(state.artist&&state.ownedSongs.length){
      const [serverRows,ss,roy]=await Promise.all([
        fetchArtistServerStreams(ANALYTICS_WINDOW_DAYS),
        db.rpc('artist_studio_stats'),
        db.rpc('artist_royalty_summary')
      ]);
      // Creator analytics must use only the authoritative server RPC. Never merge
      // browser-local history here, otherwise desktop and mobile can disagree.
      if(serverRows!==null) state.artistThirtyDay=serverRows;
      const listeners=new Map();state.artistThirtyDay.forEach(r=>listeners.set(String(r.user_id),(listeners.get(String(r.user_id))||0)+1));
      state.artistTopListeners=[...listeners.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5).map(([uid,count])=>({uid,count,name:state.socialProfiles[uid]?.display_name||`Listener ${String(uid).slice(0,6)}`}));
      if(!ss.error)state.studioStats=Array.isArray(ss.data)?ss.data[0]:ss.data;
      if(!roy.error)state.royaltySummary=Array.isArray(roy.data)?roy.data[0]:roy.data;
    }
    if(hasAdminAccess()){
      // Admin and Artist dashboards intentionally use the same 30-day qualified-stream
      // window so totals are directly comparable across roles and devices.
      const adminRows=await fetchAdminServerStreams(ANALYTICS_WINDOW_DAYS);
      if(adminRows!==null) state.adminAnalyticsHistory=adminRows;
    }
    if(['discover','listener-dashboard','artist-dashboard','studio','history','profile','admin','admin-dashboard'].includes(state.page))render();
  }catch(e){console.warn('Could not refresh stream-dependent metrics:',e);}
}

// Shown after sign-up (and when someone tries to sign in before confirming): tells them to check their inbox, with a resend button.
function confirmView(email) {
  authView(false);
  const box = document.querySelector('.auth-box'); if (!box) return;
  box.innerHTML = `<div class="eyebrow">One more step</div><h2>Check your email</h2><p class="muted">We sent a confirmation link to <strong>${esc(email)}</strong>. Open it to activate your account, then sign in. It can take a minute, and may land in spam.</p><div class="form"><button type="button" class="button" id="resend-confirm">Resend confirmation email</button><button type="button" class="button secondary" id="back-to-login">Back to sign in</button></div><p class="footnote" id="resend-note"></p>`;
  $('#back-to-login').onclick = () => authView(false);
  let wait = 0, timer = null;
  $('#resend-confirm').onclick = () => action(async () => {
    if (wait > 0) return;
    check(await db.auth.resend({ type: 'signup', email, options: { emailRedirectTo: window.location.origin } }));
    toast('Confirmation email sent again');
    const btn = $('#resend-confirm'); wait = 60; btn.disabled = true;
    timer = setInterval(() => { wait--; if (!document.body.contains(btn)) return clearInterval(timer); if (wait <= 0) { clearInterval(timer); btn.disabled = false; btn.textContent = 'Resend confirmation email'; } else btn.textContent = `Resend in ${wait}s`; }, 1000);
  });
}
const MAYA_RETURN_KEY='soundwave-pending-maya-return-v22';
function captureMayaReturn(){
  const params=new URLSearchParams(location.search);
  const result=params.get('maya');
  if(!result)return null;
  const payload={result,reference:params.get('rrn')||sessionStorage.getItem('soundwave-maya-reference')||'',captured_at:Date.now()};
  try{sessionStorage.setItem(MAYA_RETURN_KEY,JSON.stringify(payload));}catch{}
  params.delete('maya');params.delete('rrn');
  sessionStorage.removeItem('soundwave-maya-reference');
  const query=params.toString();
  window.history.replaceState(window.history.state||{},document.title,`${location.pathname}${query?`?${query}`:''}${location.hash||'#/plans'}`);
  return payload;
}
function pendingMayaReturn(){
  try{return JSON.parse(sessionStorage.getItem(MAYA_RETURN_KEY)||'null');}catch{return null;}
}
function clearPendingMayaReturn(){try{sessionStorage.removeItem(MAYA_RETURN_KEY);}catch{}}
function resolveMayaReturnFromActivePremium(message='Payment completed. Your Premium benefits are active.'){
  if(!isPremiumUser())return false;
  clearPendingMayaReturn();
  state.mayaPaymentNotice={type:'success',message};
  return true;
}
async function edgeFunctionMessage(error){
  try{
    const res=error?.context;
    if(res?.clone){const body=await res.clone().json().catch(()=>null);if(body?.error)return String(body.error);}
  }catch{}
  return error?.message||String(error||'Unknown error');
}
function schedulePendingPaymentVerification(delay=250){
  if(!state.user||!pendingMayaReturn())return;
  setTimeout(()=>{processPendingMayaReturn().catch(e=>console.warn('Maya verification deferred:',e));},delay);
}
async function processPendingMayaReturn(){
  if(!state.user||state.mayaReturnProcessing)return false;
  const pending=pendingMayaReturn();if(!pending)return false;
  state.mayaReturnProcessing=true;
  try{
    state.page='plans';
    // The subscription table / entitlement is the final source of truth inside SoundWave.
    // If Premium is already active, a leftover Maya return token must never keep the UI
    // stuck in a pending state or trigger repeated confirmation calls after login.
    if(resolveMayaReturnFromActivePremium('Your payment has already been applied. Premium is active.')){
      render();
      return true;
    }
    if(pending.result==='cancelled'){
      state.mayaPaymentNotice={type:'info',message:'Checkout was cancelled. No subscription was activated.'};
      clearPendingMayaReturn();render();return true;
    }
    if(pending.result!=='success'){
      state.mayaPaymentNotice={type:'error',message:'The payment was not completed. You can choose a plan and try again.'};
      clearPendingMayaReturn();render();return true;
    }
    if(!pending.reference){
      state.mayaPaymentNotice={type:'error',message:'The checkout returned without a payment reference. Your account is safe; start a new checkout when ready.'};
      clearPendingMayaReturn();render();return true;
    }
    state.mayaPaymentNotice={type:'pending',message:'Confirming your payment… You can keep using SoundWave while verification finishes.'};
    render();
    const {data,error}=await db.functions.invoke('maya-confirm-payment',{body:{reference:pending.reference}});
    if(error){
      // Confirmation may race with the webhook. Reload entitlement before showing a warning.
      try{await loadData();}catch{}
      if(resolveMayaReturnFromActivePremium('Payment confirmed through your active subscription. Premium is ready.')){render();return true;}
      const msg=await edgeFunctionMessage(error);
      state.mayaPaymentNotice={type:'pending',message:`Payment verification is pending. Your account is still signed in. ${msg}`};
      render();return true;
    }
    if(data?.pending){
      try{await loadData();}catch{}
      if(resolveMayaReturnFromActivePremium('Payment confirmed through your active subscription. Premium is ready.')){render();return true;}
      state.mayaPaymentNotice={type:'pending',message:data?.message||'The payment is still being finalized. Retry verification in a moment.'};
      render();return true;
    }
    if(data?.error){
      try{await loadData();}catch{}
      if(resolveMayaReturnFromActivePremium('Payment confirmed through your active subscription. Premium is ready.')){render();return true;}
      state.mayaPaymentNotice={type:'pending',message:`Payment verification is pending. ${data.error}`};
      render();return true;
    }
    clearPendingMayaReturn();
    await loadData();
    state.page='plans';
    state.mayaPaymentNotice={type:'success',message:'Payment verified. Your Premium benefits are now active.'};
    render();
    toast('Welcome to SoundWave Premium!');
    setTimeout(()=>document.getElementById('premium-welcome-dialog')?.showModal(),80);
    return true;
  }catch(e){
    console.error('Maya return processing failed:',e);
    state.mayaPaymentNotice={type:'pending',message:`Payment verification could not finish yet. Your login remains active. ${await edgeFunctionMessage(e)}`};
    render();return true;
  }finally{state.mayaReturnProcessing=false;}
}
async function acceptPendingSubscriptionInvite(){
  if(!state.user||state.subscriptionInviteProcessing)return false;
  const params=new URLSearchParams(location.search),token=params.get('subscription_invite');
  if(!token)return false;
  state.subscriptionInviteProcessing=true;
  try{
    const {data,error}=await db.rpc('accept_subscription_invite',{p_token:token});
    if(error)throw error;
    params.delete('subscription_invite');const q=params.toString();window.history.replaceState(window.history.state||{},document.title,`${location.pathname}${q?`?${q}`:''}#/plans`);
    await loadData();state.page='plans';render();toast('Premium plan invitation accepted.');return true;
  }catch(e){console.error(e);toast(`Could not accept subscription invite: ${e?.message||'Please try again.'}`,true);return false;}
  finally{state.subscriptionInviteProcessing=false;}
}
async function finishInteractiveSignIn(session){
  const user=session?.user;
  if(!user)throw Error('Sign-in succeeded but no session was returned. Please try again.');
  state.user=user;
  state.coverUrls={};
  state.selectedPlaylist=null;
  state.routeReady=false;
  await loadData();
  await loadCompetitionData();
  await restoreLastSongPlayer();
  setupRealtime();
  bindCrossDeviceRefresh();
  state.playlistInviteHandled=false;
  await acceptPendingPlaylistInvite();
  state.page=defaultLanding();
  render();
  // Payment and subscription-invite callbacks are intentionally processed only
  // after the authenticated app is already rendered. They can never reject login.
  setTimeout(()=>acceptPendingSubscriptionInvite(),120);
  schedulePendingPaymentVerification(180);
}
async function checkArtistIdentityAvailability(displayName, artistName){
  const {data,error}=await db.rpc('artist_identity_available_v31',{p_display_name:String(displayName||'').trim(),p_artist_name:String(artistName||'').trim()});
  if(error) throw error;
  const row=Array.isArray(data)?data[0]:data;
  return {displayAvailable:row?.display_available!==false,artistAvailable:row?.artist_available!==false};
}
async function checkSongTitleAvailability(title, excludeSongId=null){
  const {data,error}=await db.rpc('song_title_available_v31',{p_title:normalizedContentTitle(title),p_exclude_song_id:excludeSongId});
  if(error) throw error;
  return Boolean(Array.isArray(data)?data[0]:data);
}
async function checkAlbumTitleAvailability(title, excludeAlbumId=null){
  if(!state.artist?.artist_id) return true;
  const normalized=normalizedContentTitle(title).toLowerCase();
  const {data,error}=await db.from('album').select('album_id,album_title').eq('artist_id',state.artist.artist_id);
  if(error) throw error;
  return !(data||[]).some((row)=>Number(row.album_id)!==Number(excludeAlbumId||0) && normalizedContentTitle(row.album_title).toLowerCase()===normalized);
}
async function checkShowTitleAvailability(title, excludeShowId=null){
  if(!state.user?.id) return true;
  const normalized=normalizedContentTitle(title).toLowerCase();
  const {data,error}=await db.from('podcast_show').select('show_id,show_title').eq('user_id',state.user.id);
  if(error) throw error;
  return !(data||[]).some((row)=>Number(row.show_id)!==Number(excludeShowId||0) && normalizedContentTitle(row.show_title).toLowerCase()===normalized);
}
function setFieldState(input, small, ok, message){
  if(!input||!small)return;
  input.classList.toggle('field-invalid',ok===false);
  input.classList.toggle('field-valid',ok===true);
  small.className=`field-help availability ${ok===false?'bad':ok===true?'good':''}`;
  small.textContent=message||'';
}
function authView(register=false){
  document.getElementById('soundwave-player')?.remove();
  const emailOpen=register?' open':'';
  $('#app').innerHTML=`<div class="auth-wrap auth-v28">
    <section class="auth-show">
      <div class="brand"><span class="brand-icon">♫</span> SoundWave</div>
      <div class="auth-mobile-hero-copy">
        <div class="eyebrow">YOUR SOUND. YOUR SPACE.</div>
        <h1>${register?'Create your SoundWave account.':'Everything sounds better together.'}</h1>
        <p class="muted">Music, podcasts, playlists and creator tools in one place.</p>
      </div>
      <div class="small auth-show-note">Listen. Create. Share.</div>
    </section>
    <section class="auth-panel">
      <div class="auth-box">
        <div class="auth-mobile-heading">
          <span class="eyebrow">SOUNDWAVE</span>
          <h2>Log in or sign up</h2>
          <p class="muted">Continue with Google or use your email.</p>
        </div>
        <button type="button" class="button secondary auth-google" id="auth-google"><span class="auth-google-mark">G</span><span>Continue with Google</span></button>
        <button type="button" class="button secondary auth-email-toggle" id="auth-email-toggle">${icon('forward')}<span>Continue with email</span></button>
        <div class="auth-separator"><span>or</span></div>
        <div class="auth-email-shell${emailOpen}" id="auth-email-shell">
          <div class="auth-mode"><button class="button ${register?'secondary':''}" id="mode-login">Sign in</button><button class="button ${register?'':'secondary'}" id="mode-register">Sign up</button></div>
          <form class="form" id="authform" novalidate>
            <div class="auth-form-alert" id="auth-form-alert" role="alert" hidden></div>
            ${register?`<div class="field"><label>Display name</label><input id="display-name" required maxlength="90" placeholder="Alex Rivera"/><small class="field-help availability" id="display-name-status"></small></div><div class="field"><label>Account type</label><select id="account-type"><option value="Listener">Listener</option><option value="Artist">Artist</option></select></div><div class="field" id="artist-name-field" style="display:none"><label>Artist name</label><input id="artist-name" maxlength="100" placeholder="Your stage name"/><small class="field-help availability" id="artist-name-status"></small></div>`:''}
            <div class="field"><label>Email</label><input id="auth-email" type="email" autocomplete="email" required placeholder="you@example.com"/><small class="field-help auth-field-error" id="auth-email-error"></small></div>
            <div class="field"><label>Password</label><input id="auth-password" type="password" minlength="6" autocomplete="${register?'new-password':'current-password'}" required placeholder="At least 6 characters"/><small class="field-help auth-field-error" id="auth-password-error"></small></div>
            <button class="button auth-email-submit" data-busy>${register?'Create account':'Sign in'}</button>
          </form>
        </div>
        <p class="footnote auth-legal">By continuing, you agree to use SoundWave responsibly. Email confirmation may be required depending on your Supabase Auth settings.</p>
      </div>
    </section>
  </div>`;
  enhanceAuth();
  const shell=$('#auth-email-shell');
  const showAuthError=(message,field='')=>{const box=$('#auth-form-alert');if(box){box.textContent=message||'';box.hidden=!message;}if(field==='email')setFieldState($('#auth-email'),$('#auth-email-error'),false,message);if(field==='password')setFieldState($('#auth-password'),$('#auth-password-error'),false,message);};
  const clearAuthErrors=()=>{const box=$('#auth-form-alert');if(box){box.hidden=true;box.textContent='';}[$('#auth-email'),$('#auth-password')].forEach(el=>el?.classList.remove('field-invalid','field-valid'));[$('#auth-email-error'),$('#auth-password-error')].forEach(el=>{if(el){el.textContent='';el.className='field-help auth-field-error';}});};
  $('#auth-email-toggle')?.addEventListener('click',()=>{
    shell?.classList.toggle('open');
    if(shell?.classList.contains('open')) setTimeout(()=>$('#auth-email')?.focus(),80);
  });
  $('#mode-login').onclick=()=>authView(false);
  $('#mode-register').onclick=()=>authView(true);
  $('#auth-google')?.addEventListener('click',()=>action(async()=>{
    clearAuthErrors();
    const redirectTo=`${window.location.origin}/auth-callback.html`;
    const pendingParams=new URLSearchParams(location.search);const pendingInvite={playlist_invite:pendingParams.get('playlist_invite'),subscription_invite:pendingParams.get('subscription_invite')};if(pendingInvite.playlist_invite||pendingInvite.subscription_invite)sessionStorage.setItem('soundwave-pending-invite',JSON.stringify(pendingInvite));
    sessionStorage.setItem('soundwave-oauth-return','google');
    const {data,error}=await db.auth.signInWithOAuth({
      provider:'google',
      options:{redirectTo,scopes:'openid email profile',queryParams:{prompt:'select_account'},skipBrowserRedirect:true}
    });
    if(error){showAuthError(authErrorMessage(error)||humanErr(error));throw error;}
    if(!data?.url)throw Error('Google did not return an authorization URL. Check the Google provider configuration in Supabase.');
    window.location.assign(data.url);
  }));
  $('#account-type')?.addEventListener('change',e=>{const a=e.target.value==='Artist';$('#artist-name-field').style.display=a?'flex':'none';$('#artist-name').required=a;});
  if(register){
    const validateIdentity=async()=>{if(val('account-type')!=='Artist')return true;const display=val('display-name'),artist=val('artist-name');if(!display||!artist)return true;try{const r=await checkArtistIdentityAvailability(display,artist);setFieldState($('#display-name'),$('#display-name-status'),r.displayAvailable,r.displayAvailable?'Display name is available.':'That display name is already taken.');setFieldState($('#artist-name'),$('#artist-name-status'),r.artistAvailable,r.artistAvailable?'Artist name is available.':'That artist name is already taken.');return r.displayAvailable&&r.artistAvailable;}catch(err){console.warn('Name availability check failed',err);return true;}};
    $('#display-name')?.addEventListener('blur',validateIdentity);$('#artist-name')?.addEventListener('blur',validateIdentity);
  }
  $('#authform').onsubmit=e=>{e.preventDefault();action(async()=>{
    clearAuthErrors();
    const email=val('auth-email'),password=$('#auth-password').value;
    if(!email||!/^\S+@\S+\.\S+$/.test(email)){showAuthError('Enter a valid email address.','email');return;}
    if(!password){showAuthError('Enter your password.','password');return;}
    if(password.length<6){showAuthError('Password must contain at least 6 characters.','password');return;}
    if(!register){
      const r=await db.auth.signInWithPassword({email,password});
      if(r.error){if(/email_not_confirmed|not confirmed/i.test(`${r.error.code||''} ${r.error.message||''}`)){confirmView(email);return;}const friendly=authErrorMessage(r.error)||humanErr(r.error);showAuthError(friendly,/invalid_credentials|password/i.test(`${r.error.code||''} ${r.error.message||''}`)?'password':'');return;}
      await finishInteractiveSignIn(r.data?.session);toast('Signed in');return;
    }
    const account_type=val('account-type'),display_name=val('display-name'),artist_name=account_type==='Artist'?val('artist-name'):null;
    const displayProblem=plainNameProblem(display_name,'Display name',90);if(displayProblem){showAuthError(displayProblem);return;}
    if(account_type==='Artist'){
      if(!artist_name) throw Error('Artist name is required.');
      const available=await checkArtistIdentityAvailability(display_name,artist_name);
      if(!available.displayAvailable) throw Error('That display name is already taken. Choose another one.');
      if(!available.artistAvailable) throw Error('That artist name is already taken. Choose another one.');
    }
    const signup=await db.auth.signUp({email,password,options:{emailRedirectTo:`${window.location.origin}${window.location.pathname}`,data:{name:display_name,full_name:display_name,account_type,artist_name}}});
    if(signup.error){showAuthError(authErrorMessage(signup.error)||humanErr(signup.error));return;}
    const data=signup.data;
    if(data.user&&Array.isArray(data.user.identities)&&data.user.identities.length===0){toast('That email is already registered. Please sign in instead.',true);authView(false);return;}
    if(data.session){toast('Registration complete');await finishInteractiveSignIn(data.session);}else{confirmView(email);}
  });};
}
async function fetchAllPages(buildQuery,{pageSize=500,maxRows=5000}={}){
  const rows=[];for(let from=0;from<maxRows;from+=pageSize){const r=await buildQuery().range(from,from+pageSize-1);if(r.error)return r;rows.push(...(r.data||[]));if((r.data||[]).length<pageSize)break;}return {data:rows,error:null};
}
async function loadData(){if(!state.user)return;const id=state.user.id;const requests=[
 db.from('users').select('user_id,display_name,account_type,is_active,profile_photo_path').eq('user_id',id).maybeSingle(),
 db.from('artist').select('artist_id,user_id,artist_name,is_active,cover_path').eq('user_id',id).maybeSingle(),
 db.rpc('is_active_admin'),
 fetchAllPages(()=>db.from('song').select('song_id,song_title,description,cover_path,genre_id,track_number,duration_seconds,audio_path,is_active,album:album_id(album_id,album_title,description,release_type,cover_path,release_date,is_active,artist:artist_id(artist_id,user_id,artist_name,is_active))').eq('is_active',true).order('song_id',{ascending:false})),
 fetchAllPages(()=>db.from('artist').select('artist_id,user_id,artist_name,country,bio,is_active,cover_path').eq('is_active',true).order('artist_name')) ,
 db.from('favorite_artist').select('user_id,artist_id').eq('user_id',id),
 db.from('playlist').select('playlist_id,playlist_name,description,visibility,cover_path,is_active').eq('user_id',id).eq('is_active',true).order('playlist_id',{ascending:false}),
 db.from('genre').select('genre_id,genre_name').order('genre_name'),
 db.from('subscription_plan').select('plan_id,plan_name,monthly_price,max_members,is_active').eq('is_active',true),
 db.from('subscription').select('subscription_id,status,start_date,end_date,plan:plan_id(plan_name,max_members,monthly_price)').eq('user_id',id).order('subscription_id',{ascending:false}),
 fetchAllPages(()=>db.from('podcast_show').select('show_id,user_id,show_title,category,description,cover_path,is_active').eq('is_active',true).order('show_id',{ascending:false})),
 fetchAllPages(()=>db.from('podcast_show').select('show_id,user_id,show_title,category,description,cover_path,is_active').eq('user_id',id).order('show_id',{ascending:false})),
 db.from('listening_history').select('stream_id,song_id,stream_date,duration_played_seconds,completion_status').eq('user_id',id).order('stream_date',{ascending:false}).limit(35),
 db.from('podcast_listening_history').select('podcast_stream_id,episode_id,stream_date,duration_played_seconds,resume_position_seconds,completion_status').eq('user_id',id).order('stream_date',{ascending:false}).limit(30)
];const result=await Promise.all(requests);const names=['profile','artist','admin','songs','artists','favorites','playlists','genres','plans','subscriptions','podcasts','myShows','history','podcastHistory'];const requiredFailures=[];result.forEach((r,i)=>{if(r.error){console.warn(`Could not load ${names[i]}`,r.error);if(i===2){state.admin=false;}else if(i===1){state.artist=null;}else if(i===0||i===3||i===7){requiredFailures.push({name:names[i],error:r.error});}return;}state[names[i]]=r.data??((i===2)?false:[]);});if(requiredFailures.length){const first=requiredFailures[0];const err=new Error(`Required SoundWave data could not load (${first.name}): ${first.error?.message||'unknown error'}`);err.code=first.error?.code;throw err;}
 // Listener discovery uses an episode-backed publication gate, not the existence of a draft show row.
 // Fetch the active episode show IDs once; owners still see their drafts in Podcast Studio.
 const publicShowIds=(state.podcasts||[]).map(p=>Number(p.show_id)).filter(Boolean);
 if(publicShowIds.length){
   const published=await fetchAllPages(()=>db.from('podcast_episode').select('episode_id,show_id,release_at').in('show_id',publicShowIds).eq('is_active',true));
   if(!published.error){
     const now=Date.now(), eligible=new Set((published.data||[]).filter(e=>!e.release_at || new Date(e.release_at).getTime()<=now).map(e=>Number(e.show_id)));
     state.podcasts=state.podcasts.filter(p=>eligible.has(Number(p.show_id)));
   }else console.warn('Unable to filter public podcast drafts',published.error);
 }
 // Draft artist profiles are not promoted to listener discovery without a published track.
 const visibleCreatorIds=new Set((state.songs||[]).filter(song=>song.is_active!==false && song.album?.is_active!==false).map(song=>Number(song.album?.artist?.artist_id)));
 state.artists=(state.artists||[]).filter(a=>visibleCreatorIds.has(Number(a.artist_id)) || String(a.user_id)===String(state.user.id));
 state.history = mergeStreamHistory(state.history || [], readCachedHistory(id));
 state.podcastHistory = mergePodcastHistory(state.podcastHistory || [], readCachedPodcastHistory(id));
 state.episodeTitles = { ...readCachedEpisodeTitles(id), ...(state.episodeTitles || {}) };
 persistHistoryCache();
 // Only an explicitly classified Artist with an active matching profile receives Artist Studio access.
 // An orphan/stale artist row does not turn a Listener account into an Artist.
 if(state.profile?.account_type !== 'Artist' || !state.artist?.is_active){
   if(state.profile?.account_type === 'Listener' && state.artist){
     console.warn('Account mismatch: this Listener also has an artist row. Check public.users/account_type and public.artist.');
   }
   state.artist=null;
 }
 if(state.artist){const r=await db.from('album').select('album_id,album_title,description,release_type,release_date,cover_path,is_active').eq('artist_id',state.artist.artist_id).order('album_id',{ascending:false});state.albums=r.error?[]:r.data;const albumIds=state.albums.map(a=>a.album_id);if(albumIds.length){const sr=await db.from('song').select('song_id,album_id,genre_id,song_title,description,cover_path,duration_seconds,track_number,audio_path,is_active').in('album_id',albumIds).order('song_id',{ascending:false});state.ownedSongs=sr.error?[]:(sr.data||[]).map(song=>{const a=state.albums.find(x=>Number(x.album_id)===Number(song.album_id));return {...song,album:a?{...a,artist:state.artist}:null};});}else state.ownedSongs=[];}else{state.albums=[];state.ownedSongs=[];}if(state.selectedPlaylist && !state.playlists.some(p=>p.playlist_id===state.selectedPlaylist)){state.selectedPlaylist=null;state.playlistSongs=[];}
 // Keep Podcast Studio statistics accurate even before a show is opened.
 // showDetail() may later replace state.episodes with one selected show's rows.
 const ownShowIdsForStudio=state.myShows.map(x=>Number(x.show_id)).filter(Boolean);
 state.podcastStudioHistory=[];
 if(ownShowIdsForStudio.length){
   const er=await db.from('podcast_episode').select('episode_id,show_id,episode_title,description,duration_seconds,audio_path,release_at,is_active').in('show_id',ownShowIdsForStudio).order('release_at',{ascending:false});
   if(!er.error){
     state.episodes=er.data||[];
     const ownEpisodeIdsForStudio=state.episodes.map(x=>Number(x.episode_id)).filter(Boolean);
     if(ownEpisodeIdsForStudio.length){
       const ph=await db.from('podcast_listening_history').select('podcast_stream_id,user_id,episode_id,stream_date,duration_played_seconds,resume_position_seconds,completion_status').in('episode_id',ownEpisodeIdsForStudio).order('stream_date',{ascending:false}).limit(3000);
       if(!ph.error){const cached=readAllCachedPodcastHistories().filter(r=>ownEpisodeIdsForStudio.includes(Number(r.episode_id)));state.podcastStudioHistory=mergePodcastHistory(ph.data||[],cached);}else{state.podcastStudioHistory=readAllCachedPodcastHistories().filter(r=>ownEpisodeIdsForStudio.includes(Number(r.episode_id)));}
     }
   }else console.warn('Podcast Studio episodes unavailable',er.error);
 }else if(!state.selectedShow){state.episodes=[];}

 // Load owned subscription members; no auth.users enumeration in the browser.
 state.subscriptionMembers=[];state.sharedMemberships=[];state.paymentRows=[];
 const shared=await db.from('subscription_member').select('subscription_id,user_id').eq('user_id',id);if(!shared.error)state.sharedMemberships=shared.data||[];else console.warn('Shared memberships unavailable',shared.error);
 const ids=state.subscriptions.map(x=>x.subscription_id);
 if(ids.length){
  const [m,p]=await Promise.all([db.from('subscription_member').select('subscription_id,user_id').in('subscription_id',ids),db.from('payment').select('subscription_id,payment_amount,payment_status,payment_date,payment_method').in('subscription_id',ids).order('payment_date',{ascending:false}).limit(15)]);
  if(!m.error)state.subscriptionMembers=m.data||[];else console.warn('Subscription members unavailable',m.error);
  if(!p.error)state.paymentRows=p.data||[];else console.warn('Payment history unavailable',p.error);
 }
 state.followers=[];state.following=[];
 // RLS already limits social rows to relationships involving the signed-in user.
 // Select * so the frontend tolerates the two column-name variants that existed
 // across the SoundWave documentation and deployed schema.
 let social=await db.from('user_follow').select('*');
 if(social.error){
   const fallback=await db.from('user_follower').select('*');
   if(!fallback.error){social=fallback;state.socialSource='user_follower';}
 }
 if(!social.error){
   const normalized=(social.data||[]).map(r=>({
     follower_user_id:r.follower_user_id||r.follower_id||r.user_id||null,
     followed_user_id:r.followed_user_id||r.followed_id||null,
     date_followed:r.date_followed||r.datefollowed||r.dateFollowed||null
   })).filter(r=>r.follower_user_id&&r.followed_user_id);
   state.followers=normalized.filter(r=>String(r.followed_user_id)===String(id));
   state.following=normalized.filter(r=>String(r.follower_user_id)===String(id));
 }else console.warn('Followers unavailable',social.error);
 // Artist followers (people who tapped Follow on an artist). Needs the RPCs in sql/RUN_ME_likes_and_followers.sql.
 state.artistFollowers=[];state.socialProfiles={};state.followerCounts={};state.socialRpc={counts:false,mine:false,profiles:false};
 const [fcnt,fmine,fprof]=await Promise.all([db.rpc('get_artist_follower_counts'),state.artist?db.rpc('get_my_artist_followers'):Promise.resolve({data:[],error:null}),db.rpc('get_social_profiles')]);
 if(!fcnt.error){
   // A successful count RPC is authoritative, including legitimate zero-follower artists.
   // Seed every visible artist at zero, then merge the totals returned by Supabase.
   const parsed=mergeFollowerCountsPayload(fcnt.data,{});
   const complete={};
   (state.artists||[]).forEach(a=>{const aid=Number(a.artist_id);if(Number.isFinite(aid))complete[aid]=0;});
   Object.assign(complete,parsed);
   state.followerCounts=complete;
   state.socialRpc.counts=true;
   state.socialRpc.countSource='rpc';
 }else console.info('Follower-count RPC unavailable:',fcnt.error.message);
 // Safe fallback: only trust a direct favorite_artist aggregate when the session can
 // demonstrably see rows belonging to other users. This avoids displaying false 0s
 // when RLS exposes only the signed-in user's own favorite_artist rows.
 if(!state.socialRpc.counts){
   const allFav=await db.from('favorite_artist').select('user_id,artist_id');
   if(!allFav.error){
     const rows=allFav.data||[];
     const seesOtherUsers=rows.some(r=>String(r.user_id)!==String(state.user.id));
     if(seesOtherUsers){
       const counts={};
       rows.forEach(r=>{const id=Number(r.artist_id);if(Number.isFinite(id))counts[id]=(counts[id]||0)+1;});
       state.followerCounts=counts;
       state.socialRpc.counts=true;
       state.socialRpc.countSource='favorite_artist';
     }
   }
 }
 if(!fmine.error){
   state.socialRpc.mine=true;
   const mineRows=Array.isArray(fmine.data)?fmine.data:(fmine.data?[fmine.data]:[]);
   state.artistFollowers=mineRows.map(r=>({
     ...r,
     follower_user_id:r.follower_user_id??r.user_id??r.follower_id??null,
     display_name:r.display_name??r.name??r.full_name??'SoundWave listener',
     profile_photo_path:r.profile_photo_path??r.profile_photo_url??null
   })).filter(r=>r.follower_user_id);
   // get_my_artist_followers is authoritative for the signed-in artist even when
   // global follower counts are hidden by RLS. Keep the artist's own profile accurate.
   if(state.artist?.artist_id!=null){
     state.followerCounts[Number(state.artist.artist_id)]=state.artistFollowers.length;
   }
 }else console.info('Artist followers unavailable:',fmine.error.message);
 if(!fprof.error){state.socialRpc.profiles=true;(fprof.data||[]).forEach(p=>{state.socialProfiles[String(p.user_id)]=p;});}
 state.artistFollowers.forEach(r=>{if(r.display_name&&!state.socialProfiles[String(r.follower_user_id)])state.socialProfiles[String(r.follower_user_id)]={user_id:r.follower_user_id,display_name:r.display_name};});
 // Premium entitlement is primarily derived from the user's active subscription.
 // If the optional helper RPC is installed it also resolves Duo/Family members.
 state.entitlement=null;
 let ent=await db.rpc('soundwave_my_entitlement');
 if(ent.error)ent=await db.rpc('get_my_entitlement');
 if(!ent.error){state.entitlement=Array.isArray(ent.data)?ent.data[0]:ent.data;}
 else {
   const own=state.subscriptions.find(x=>String(x.status).toLowerCase()==='active');
   if(own)state.entitlement={is_premium:true,plan_name:own.plan?.plan_name||'Premium',subscription_id:own.subscription_id,plan_id:own.plan_id,relationship:'Owner',owner_user_id:id};
 }
 if(state.entitlement?.subscription_id){
   const memberRpc=await db.rpc('subscription_members_for_current_plan',{p_subscription_id:Number(state.entitlement.subscription_id)});
   if(!memberRpc.error&&Array.isArray(memberRpc.data))state.subscriptionMembers=memberRpc.data;
 }
 // Liked Songs: saved to your account; if the liked_song table is not installed yet, fall back to this device.
 const likedRes=await db.from('saved_song').select('song_id,date_saved').eq('user_id',id).order('date_saved',{ascending:false});
 state.likesAvailable=true;
 if(likedRes.error){state.likesMode='local';const local=readLocalLikes();state.liked=local.map(x=>({song_id:x,liked_at:null}));state.likedIds=new Set(local);console.info('saved_song table unavailable, saving likes on this device:',likedRes.error.message);}
 else{state.likesMode='remote';state.liked=(likedRes.data||[]).map(x=>({...x,liked_at:x.liked_at||x.date_saved||null}));state.likedIds=new Set(state.liked.map(x=>Number(x.song_id)));await migrateLocalLikes(id);}
 state.offlineDownloads=await listOfflineDownloads(id);
 if(!isPremiumUser() && state.offlineDownloads.length){await clearOfflineDownloads(id);state.offlineDownloads=[];}
  const newPaths=[...new Set([...state.songs.flatMap(x=>[x.cover_path,x.album?.cover_path]),...state.ownedSongs.map(x=>x.cover_path),...state.albums.map(x=>x.cover_path)].filter(x=>x&&!state.coverUrls[x]))].slice(0,220);
 if(newPaths.length){const urls=await Promise.all(newPaths.map(async path=>[path,await resolveCoverUrl(path)]));urls.forEach(([path,url])=>{if(url)state.coverUrls[path]=url;});}
 // Mission 4 feature append: use the newer helper RPCs when installed, but keep the original UI/data fallbacks.
 const [ps,ss,roy,ent2,adm,reqs,lib,social2,af2] = await Promise.all([
   db.rpc('profile_stats'),
   state.artist?db.rpc('artist_studio_stats'):Promise.resolve({data:null,error:null}),
   state.artist?db.rpc('artist_royalty_summary'):Promise.resolve({data:null,error:null}),
   db.rpc('soundwave_my_entitlement'),
   state.admin?db.rpc('admin_moderation_data'):Promise.resolve({data:null,error:null}),
   db.from('subscription_request').select('*').eq('user_id',id).order('created_at',{ascending:false}),
   db.rpc('my_library_playlists'),
   db.rpc('social_connections'),
   state.artist?db.rpc('artist_follower_list'):Promise.resolve({data:[],error:null})
 ]);
 state.profileStats=!ps.error?(Array.isArray(ps.data)?ps.data[0]:ps.data):null;
 state.studioStats=!ss.error?(Array.isArray(ss.data)?ss.data[0]:ss.data):null;
 state.royaltySummary=!roy.error?(Array.isArray(roy.data)?roy.data[0]:roy.data):null;
 if(!ent2.error){const e=Array.isArray(ent2.data)?ent2.data[0]:ent2.data;if(e)state.entitlement={...e,is_premium:String(e.status||'').toLowerCase()==='active' && String(e.plan_name||'').toLowerCase()!=='free'};}
 state.adminData=!adm.error?adm.data:null;
 if(state.admin){
  let albumRows=await db.from('album').select('album_id,artist_id,album_title,cover_path,is_active,admin_locked');
  if(albumRows.error && /admin_locked|column/i.test(String(albumRows.error.message||''))){
    albumRows=await db.from('album').select('album_id,artist_id,album_title,cover_path,is_active');
  }
  state.adminAlbumLoadError=albumRows.error?.message||'';
  if(!albumRows.error) state.adminAllAlbums=albumRows.data||[];
  else {state.adminAllAlbums=[];console.error('Admin cannot read all albums:',albumRows.error);}
  // The public album SELECT policy may hide inactive rows. The guarded RPC
  // lists all releases only for administrators, including moderation-locked ones.
  const canonical=await db.rpc('soundwave_admin_list_all_albums');
  if(!canonical.error){state.adminAllAlbums=canonical.data||[];state.adminAlbumLoadError='';}
  else if(!albumRows.error){state.adminAlbumLoadError='Admin-only album-list RPC unavailable. Inactive albums may be hidden by RLS. Install admin_album_access.sql.';}
}

 state.adminUserIds=[];
 if(state.admin){const ar=await db.rpc('admin_list_admin_user_ids');if(!ar.error)state.adminUserIds=(Array.isArray(ar.data)?ar.data:[]).map(x=>String(x.user_id??x));else console.info('Admin list helper unavailable:',ar.error.message);}
 state.subscriptionRequests=reqs.error?[]:(reqs.data||[]);
 if(!lib.error&&Array.isArray(lib.data)) state.playlists=lib.data;
 if(!social2.error&&social2.data){const so=Array.isArray(social2.data)?social2.data[0]:social2.data;state.followers=so?.followers||state.followers;state.following=so?.following||state.following;}
 if(!af2.error&&Array.isArray(af2.data)){state.artistFollowers=af2.data.map(x=>({follower_user_id:x.user_id,display_name:x.display_name,profile_photo_path:x.profile_photo_path||x.profile_photo_url||null}));state.socialRpc.mine=true;}
 if(state.profile?.profile_photo_path){const pr=db.storage.from('profile-images').getPublicUrl(state.profile.profile_photo_path);state.profilePhotoUrl=pr.data?.publicUrl||null;}else state.profilePhotoUrl=null;
 const extraCoverPaths=[...new Set([...state.playlists.map(x=>x.cover_path),...state.podcasts.map(x=>x.cover_path),...state.myShows.map(x=>x.cover_path),...state.artists.map(x=>x.cover_path),state.artist?.cover_path].filter(x=>x&&!state.coverUrls[x]))].slice(0,220);
 if(extraCoverPaths.length){const urls=await Promise.all(extraCoverPaths.map(async path=>[path,await resolveCoverUrl(path)]));urls.forEach(([path,url])=>{if(url)state.coverUrls[path]=url;});}
}

function isPremiumUser(){
 const e=state.entitlement;if(e && (e.is_premium===true||String(e.is_premium)==='true'))return true;
 return state.subscriptions.some(s=>String(s.status).toLowerCase()==='active' && !/^free$/i.test(s.plan?.plan_name||''));
}
function hasDownloadedSong(songId){
 return state.offlineDownloads.some((x)=>Number(x.songId)===Number(songId));
}
function premiumAccountBadge(label='Premium'){
 return `<button type="button" class="premium-account-pill" data-nav="plans" aria-label="Open subscription">${icon('check')}<span>${esc(label)}</span></button>`;
}

const OFFLINE_DB='soundwave-offline-v1', OFFLINE_DB_VERSION=3, OFFLINE_STORE='tracks', KEY_STORE='keys';
function requireOfflineCrypto(){
  if(!window.isSecureContext || !window.crypto || !window.crypto.subtle){
    throw new Error('Encrypted offline downloads require HTTPS or localhost. On this computer open http://localhost:5173. For phones or other devices, deploy SoundWave over HTTPS before using Download.');
  }
  return window.crypto;
}
function openOfflineDb(){return new Promise((resolve,reject)=>{const req=indexedDB.open(OFFLINE_DB,OFFLINE_DB_VERSION);req.onupgradeneeded=()=>{const d=req.result;if(!d.objectStoreNames.contains(OFFLINE_STORE))d.createObjectStore(OFFLINE_STORE,{keyPath:'key'});if(!d.objectStoreNames.contains(KEY_STORE))d.createObjectStore(KEY_STORE,{keyPath:'userId'});};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);req.onblocked=()=>reject(new Error('SoundWave offline storage upgrade is blocked. Close other SoundWave tabs and try again.'));});}
async function getOfflineKey(userId){const c=requireOfflineCrypto();const d=await openOfflineDb();const existing=await new Promise((resolve,reject)=>{const r=d.transaction(KEY_STORE).objectStore(KEY_STORE).get(userId);r.onsuccess=()=>resolve(r.result?.cryptoKey||null);r.onerror=()=>reject(r.error);});if(existing)return existing;const cryptoKey=await c.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);await new Promise((resolve,reject)=>{const tx=d.transaction(KEY_STORE,'readwrite');tx.objectStore(KEY_STORE).put({userId,cryptoKey});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});return cryptoKey;}
async function listOfflineDownloads(userId){if(!('indexedDB'in window)||!userId)return[];try{const d=await openOfflineDb();return await new Promise((resolve,reject)=>{const r=d.transaction(OFFLINE_STORE).objectStore(OFFLINE_STORE).getAll();r.onsuccess=()=>resolve((r.result||[]).filter(x=>x.userId===userId));r.onerror=()=>reject(r.error);});}catch(e){console.warn('Offline library unavailable',e);return[];}}
async function saveOfflineSong(song){if(!state.user||!isPremiumUser())throw Error('Offline downloads are available only with an active Premium plan.');if(!song?.audio_path)throw Error('This song has no downloadable audio.');const signed=check(await db.storage.from('song-audio').createSignedUrl(song.audio_path,900));const response=await fetch(signed.signedUrl);if(!response.ok)throw Error('Could not download the audio file.');const plain=await response.arrayBuffer();const c=requireOfflineCrypto();const iv=c.getRandomValues(new Uint8Array(12));const key=await getOfflineKey(state.user.id);const cipher=await c.subtle.encrypt({name:'AES-GCM',iv},key,plain);const d=await openOfflineDb();const row={key:`${state.user.id}:song:${song.song_id}`,userId:state.user.id,songId:song.song_id,title:song.song_title,artist:song.album?.artist?.artist_name||'SoundWave',album:song.album?.album_title||'Single',duration:song.duration_seconds,mime:response.headers.get('content-type')||'audio/mpeg',iv:Array.from(iv),cipher,validatedAt:Date.now()};await new Promise((resolve,reject)=>{const tx=d.transaction(OFFLINE_STORE,'readwrite');tx.objectStore(OFFLINE_STORE).put(row);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});state.offlineDownloads=await listOfflineDownloads(state.user.id);toast('Downloaded for offline listening');}
async function removeOfflineSong(songId){const d=await openOfflineDb();await new Promise((resolve,reject)=>{const tx=d.transaction(OFFLINE_STORE,'readwrite');tx.objectStore(OFFLINE_STORE).delete(`${state.user.id}:song:${songId}`);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});state.offlineDownloads=await listOfflineDownloads(state.user.id);}
async function clearOfflineDownloads(userId){if(!('indexedDB'in window))return;const rows=await listOfflineDownloads(userId);const d=await openOfflineDb();await new Promise((resolve,reject)=>{const tx=d.transaction(OFFLINE_STORE,'readwrite');for(const r of rows)tx.objectStore(OFFLINE_STORE).delete(r.key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
async function offlineBlobUrl(row){const c=requireOfflineCrypto();const key=await getOfflineKey(row.userId);const plain=await c.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(row.iv)},key,row.cipher);return URL.createObjectURL(new Blob([plain],{type:row.mime||'audio/mpeg'}));}
async function playDownloaded(songId, pb = null) {
  await requirePlaybackAccess();
  const row = state.offlineDownloads.find((x) => Number(x.songId) === Number(songId));
  if (!row) throw Error('This song is not downloaded.');
  const url = await offlineBlobUrl(row);
  const dl = state.offlineDownloads.map((x) => Number(x.songId));
  const keep = pb?.order && pb.order.every((x) => dl.includes(x));
  const b = buildPlayback(songId, dl, keep ? { order: pb.order, pos: pb.pos } : {});
  startPlayer({ kind: 'song', id: Number(row.songId), title: row.title, artist: row.artist, url, duration: row.duration, offline: true, ...b });
}

// ---------- Right-hand "Now playing / Queue" panel ----------
function downloadsPage(){if(!isPremiumUser())return plans();const rows=state.offlineDownloads;shell(`<section class="workspace-hero premium-hero"><div><span class="eyebrow">OFFLINE LIBRARY</span><h2>Your downloads.</h2><p>Premium downloads are stored encrypted in this browser for the signed-in account.</p></div><span class="hero-vinyl">↓</span></section><div class="section-heading"><h2>Downloaded music <span class="muted small">(${rows.length})</span></h2></div>${rows.length?`<div class="songlist">${rows.map((r,i)=>`<div class="songrow"><span class="tag">${i+1}</span><span class="placeholder-art tiny" style="background:${grad(i)}">♫</span><div class="grow"><strong>${escapeHtml(r.title)}</strong><small>${escapeHtml(r.artist)} · ${escapeHtml(r.album)}</small></div><span class="muted small">${nice(r.duration)}</span><button class="track-play" data-offline-play="${r.songId}">${icon('play')}</button><button class="button secondary sm" data-offline-remove="${r.songId}">Remove</button></div>`).join('')}</div>`:'<div class="empty">No downloads yet. Use a song’s ••• menu and choose Download.</div>'}<p class="footnote">The app rechecks Premium entitlement whenever you sign in. If entitlement expires, this local offline library is removed. Offline audio is encrypted at rest in this browser, but this does not protect it from malicious code running on the same SoundWave origin.</p>`,'Downloads',state.entitlement?.plan_name?`${state.entitlement.plan_name} offline listening`:'Premium offline listening');document.querySelectorAll('[data-offline-play]').forEach(b=>b.onclick=()=>action(()=>playDownloaded(Number(b.dataset.offlinePlay))));document.querySelectorAll('[data-offline-remove]').forEach(b=>b.onclick=()=>action(async()=>{await removeOfflineSong(Number(b.dataset.offlineRemove));render();toast('Download removed');}));}

async function loadArtistPopularity(artistId){
  const id=Number(artistId);
  if(!id||!db)return;
  const key=String(id);
  try{
    const {data,error}=await db.rpc('public_artist_song_stream_counts_v47',{p_artist_id:id});
    if(error)throw error;
    state.artistPopularity[key]=Object.fromEntries((data||[]).map(row=>[Number(row.song_id),Number(row.stream_count)||0]));
  }catch(error){
    console.warn('Public artist popularity unavailable:',error);
    state.artistPopularity[key]=state.artistPopularity[key]||{};
  }
}
function artistDetail() {
  const artist = state.artists.find((a) => Number(a.artist_id) === Number(state.selectedArtist) && (a.is_published !== false || isOwnArtist(a)));
  if (!artist) return artists();
  const popularity=state.artistPopularity?.[String(artist.artist_id)]||{};
  const popularityLoaded=Object.prototype.hasOwnProperty.call(state.artistPopularity||{},String(artist.artist_id));
  const releases = [...songsByArtist(artist.artist_id)].sort((a,b)=>(Number(popularity[b.song_id]||0)-Number(popularity[a.song_id]||0))||(Number(b.song_id)-Number(a.song_id)));
  const albums = catalogAlbums().filter((a) => Number(a.artist?.artist_id) === Number(artist.artist_id) && (a.is_published !== false || own));
  const own = isOwnArtist(artist), fc = followerText(artist.artist_id);
  const banner=artist.cover_path&&state.coverUrls[artist.cover_path];
  const bannerStyle=banner?`--artist-cover:url("${esc(banner)}");`:'';
  state.tint = tintFor(artist.artist_id);
  shell(`<div class="artist-sticky-bar" id="artist-sticky-bar" style="--artist-accent:${tintFor(artist.artist_id)};${bannerStyle}"><span class="artist-sticky-avatar" style="background:${grad(artist.artist_id)}">${esc(artist.artist_name?.[0] || 'A')}</span><strong>${esc(artist.artist_name)}</strong>${releases.length ? `<button type="button" class="artist-sticky-play" data-play-ids="${ids(releases).join(',')}" aria-label="Play ${esc(artist.artist_name)}">${icon('play')}</button>` : ''}</div><section class="artist-profile-hero" id="artist-profile-hero" style="--artist-accent:${tintFor(artist.artist_id)};${bannerStyle}"><span class="artist-profile-avatar" style="background:${grad(artist.artist_id)}">${esc(artist.artist_name?.[0] || 'A')}</span><div><span class="coll-kind">Artist</span><h1 class="coll-title">${esc(artist.artist_name)}</h1><p class="coll-sub">${fc ? `<strong data-follower-count="${artist.artist_id}">${fc}</strong> · ` : ''}${albums.length} ${albums.length === 1 ? 'release' : 'releases'} · ${releases.length} ${releases.length === 1 ? 'song' : 'songs'}${artist.country ? ' · ' + esc(artist.country) : ''}</p></div></section>
<div class="coll-actions artist-primary-actions">${releases.length ? `<button type="button" class="sw-big-play" data-play-ids="${ids(releases).join(',')}" aria-label="Play ${esc(artist.artist_name)}">${icon('play')}</button><button type="button" class="sw-quiet-action shuffle-toggle" data-toggle-shuffle aria-label="Shuffle">${icon('shuffle')}</button>` : ''}${own ? `<button type="button" class="follow-btn" data-nav="followers">View your followers</button>` : followBtn(artist)}</div>
${releases.length ? `<section class="artist-section"><div class="section-heading"><div><h2>Popular</h2><span class="muted small">Ranked by qualified stream count</span></div></div>${trackTable(releases.slice(0, 10), { queue: ids(releases), showAlbum: false, extraLabel: 'Streams', extraClass: 'streams', extraCell: (song)=>popularityLoaded ? Number(popularity[song.song_id]||0).toLocaleString() : '…' })}</section>` : ''}
${albums.length ? `<section class="shelf-section artist-section"><div class="section-heading"><h2>Discography</h2></div><div class="shelf">${albums.map(albumTile).join('')}</div></section>` : '<div class="empty">No published releases yet.</div>'}
${artist.bio ? `<section class="about-card artist-section"><h2>About</h2><p>${esc(artist.bio)}</p></section>` : ''}`, '', '');
}
function bindArtistScrollBehavior(){
  const main=document.querySelector('.main'),hero=document.getElementById('artist-profile-hero'),bar=document.getElementById('artist-sticky-bar');
  if(!main||!hero||!bar)return;
  let shown=false,raf=0;
  const update=()=>{
    raf=0;
    const threshold=Math.max(96,hero.offsetHeight*.58),top=main.scrollTop;
    const next=shown?top>Math.max(24,threshold-28):top>threshold;
    if(next!==shown){shown=next;bar.classList.toggle('show',shown);document.body.classList.toggle('artist-scrolled',shown);}
    if(top<=2){shown=false;bar.classList.remove('show');document.body.classList.remove('artist-scrolled');}
  };
  const onScroll=()=>{if(!raf)raf=requestAnimationFrame(update);};
  main.addEventListener('scroll',onScroll,{passive:true});
  update();
}
function songRows(rows, showAdd = false, queueIds = null) { return trackTable(rows, { queue: queueIds?.length ? queueIds : ids(rows) }); }
function recommendationShelf(){
  const picks=recommendationPicksDetailed();
  return `<div class="section-heading"><div><span class="eyebrow">CURATED FOR YOU</span><h2>Curated for you</h2></div><span class="muted small">Based on your likes, follows and listening</span></div><div class="shelf">${picks.map(curatedTile).join('')||'<div class="empty discover-empty"><span>♫</span><h3>Start listening to shape your recommendations</h3><p>Play songs, like tracks and follow artists. SoundWave will use those signals here.</p><button class="button" data-nav="music">Explore music</button></div>'}</div>`;
}
function recommendationPicksDetailed(limit=7){
  const recent=new Set(state.history.slice(0,10).map(r=>Number(r.song_id)));
  const followed=new Set(state.favorites.map(r=>Number(r.artist_id)));
  const likedSongs=state.liked.map(r=>songById(r.song_id)).filter(Boolean);
  const likedArtists=new Map(), genreScores=new Map(), playArtists=new Map();
  for(const s of likedSongs){const aid=Number(s.album?.artist?.artist_id);if(aid)likedArtists.set(aid,(likedArtists.get(aid)||0)+1);if(s.genre_id)genreScores.set(Number(s.genre_id),(genreScores.get(Number(s.genre_id))||0)+2);}
  for(const r of state.history){const song=songById(r.song_id);if(!song)continue;const aid=Number(song.album?.artist?.artist_id);if(aid)playArtists.set(aid,(playArtists.get(aid)||0)+1);if(song.genre_id)genreScores.set(Number(song.genre_id),(genreScores.get(Number(song.genre_id))||0)+1);}
  const now=Date.now();
  const scored=state.songs.filter(s=>!recent.has(Number(s.song_id))).map(song=>{
    const aid=Number(song.album?.artist?.artist_id), gid=Number(song.genre_id);let score=0;const reasons=[];
    if(followed.has(aid)){score+=40;reasons.push(`Because you follow ${song.album?.artist?.artist_name||'this artist'}`);}
    if(likedArtists.has(aid)){score+=Math.min(30,likedArtists.get(aid)*10);if(!reasons.length)reasons.push(`More from ${song.album?.artist?.artist_name||'an artist you like'}`);}
    if((playArtists.get(aid)||0)>=3){score+=25;if(!reasons.length)reasons.push(`Because you listen to ${song.album?.artist?.artist_name||'this artist'}`);}
    if(genreScores.has(gid)){score+=Math.min(20,genreScores.get(gid)*3);if(!reasons.length){const g=state.genres.find(x=>Number(x.genre_id)===gid);reasons.push(g?`More ${g.genre_name}`:'Matches your listening');}}
    const rd=song.album?.release_date?new Date(song.album.release_date).getTime():0;if(rd&&now-rd<=60*86400000)score+=5;
    return {song,score,reason:reasons[0]||'Explore something new'};
  }).sort((a,b)=>b.score-a.score||Number(b.song.song_id)-Number(a.song.song_id));
  const artistCounts=new Map(),out=[];
  for(const pick of scored){const aid=Number(pick.song.album?.artist?.artist_id)||0;if((artistCounts.get(aid)||0)>=2)continue;artistCounts.set(aid,(artistCounts.get(aid)||0)+1);out.push(pick);if(out.length===limit)break;}
  return out;
}
function curatedTile(pick){
  const song=pick.song,album=song.album?albumById(song.album.album_id):null,q=(album?ids(album.songs):[song.song_id]).join(',');
  return `<article class="release-tile curated-card card-link" tabindex="0" role="link" ${song.album?`data-open-album="${song.album.album_id}"`:''} data-queue="${q}"><span class="release-art">${albumArt(song,'large')}<button type="button" class="hover-play" data-play="${song.song_id}" aria-label="Play ${esc(song.song_title)}">${icon('play')}</button></span><strong>${esc(song.song_title)}</strong><small>${esc(song.album?.artist?.artist_name||'SoundWave artist')}</small><span class="reason-caption">${esc(pick.reason)}</span></article>`;
}
async function refreshPodcastRecommendationSignals(){
  const categoryCounts=new Map(),showCounts=new Map();
  const episodeIds=[...new Set((state.podcastHistory||[]).map(r=>Number(r.episode_id)).filter(Boolean))];
  if(episodeIds.length){
    const ep=await db.from('podcast_episode').select('episode_id,show_id').in('episode_id',episodeIds);
    if(!ep.error){
      const byEpisode=new Map((ep.data||[]).map(x=>[Number(x.episode_id),Number(x.show_id)]));
      for(const row of state.podcastHistory||[]){
        const sid=byEpisode.get(Number(row.episode_id));
        if(!sid)continue;
        showCounts.set(sid,(showCounts.get(sid)||0)+1);
        const show=state.podcasts.find(p=>Number(p.show_id)===sid);
        const cat=String(show?.category||'').trim();
        if(cat)categoryCounts.set(cat,(categoryCounts.get(cat)||0)+1);
      }
    }
  }
  state.podcastRecSignals={categories:Object.fromEntries(categoryCounts),shows:[...showCounts.entries()].map(([show_id,count])=>({show_id,count}))};
}
function recommendedPodcastsDetailed(limit=7){
  const cats=state.podcastRecSignals?.categories||{}, listened=new Map((state.podcastRecSignals?.shows||[]).map(x=>[Number(x.show_id),Number(x.count)||0]));
  const hasSignals=Object.keys(cats).length>0||listened.size>0;
  const rows=(state.podcasts||[]).filter(p=>p?.is_active!==false).map(show=>{
    const cat=String(show.category||'').trim();let score=0,reason='';
    if(cat&&cats[cat]){score+=Number(cats[cat])*30;reason=`Because you listen to ${cat}`;}
    const times=listened.get(Number(show.show_id))||0;
    if(!times)score+=hasSignals?12:0; else score+=Math.min(8,times*2);
    if(!reason)reason=hasSignals?(times?'Continue listening':'Explore something new'):'Popular on SoundWave';
    return {show,score,reason};
  }).sort((a,b)=>b.score-a.score||String(a.show.show_title||'').localeCompare(String(b.show.show_title||'')));
  return rows.slice(0,limit);
}
function podcastRecommendationCard(pick,i=0){
  const p=pick.show,art=p.cover_path&&state.coverUrls[p.cover_path]?`<img class="cover-img" src="${esc(state.coverUrls[p.cover_path])}" alt="${esc(p.show_title)}">`:icon('mic');
  return `<button type="button" class="cover-card podcast-recommend-card" data-open-show="${p.show_id}"><span class="cover-art" style="background:${grad(i)}">${art}</span><strong>${esc(p.show_title)}</strong><small>${esc(p.category||'Podcast')}</small><span class="reason-caption">${esc(pick.reason)}</span></button>`;
}
function discoverFilterChips(){
  return `<div class="discover-filter-wrap"><div class="discover-filter-bar" role="tablist" aria-label="Filter Discover">${[['all','All'],['music','Music'],['podcasts','Podcasts']].map(([key,label])=>`<button type="button" class="discover-filter-chip ${state.discoverFilter===key?'active':''}" data-discover-filter="${key}" role="tab" aria-selected="${state.discoverFilter===key}"><span>${label}</span></button>`).join('')}</div></div>`;
}
function hasListeningActivity(){
  return (state.history||[]).some(r=>Number(r.song_id)) || (state.podcastHistory||[]).some(r=>Number(r.episode_id));
}
function newListenerDashboard(){
  state.tint='#1d362b';
  shell(`<section class="new-listener-dashboard"><div class="new-listener-copy"><span class="eyebrow">WELCOME TO SOUNDWAVE</span><h2>Discover music.</h2><p>Your recommendations will appear here after you start listening. For now, explore the SoundWave catalog and find your first track.</p><div class="new-listener-actions"><button type="button" class="button" data-nav="music">${icon('search')} Discover music</button></div></div><div class="new-listener-art" aria-hidden="true"><span>${icon('music')}</span><i></i><i></i><i></i></div></section>`,'Discover music','Start listening to build your SoundWave recommendations.');
}
function discoverPage(){
  if(!hasArtistAccess()&&!hasAdminAccess()&&!hasListeningActivity()) return newListenerDashboard();
  const all=[...catalogAlbums()].filter(a=>a?.artist && a.is_active!==false && a.artist?.is_active!==false && a.songs?.some(s=>s.is_active!==false)).sort((a,b)=>String(b.release_date||'').localeCompare(String(a.release_date||''))||Number(b.album_id)-Number(a.album_id));
  const uniqueByArtist=(rows,limit=7)=>{const seen=new Set(),out=[];for(const a of rows){const id=Number(a.artist?.artist_id);if(!id||seen.has(id))continue;seen.add(id);out.push(a);if(out.length===limit)break;}return out;};
  const available=uniqueByArtist(all,all.length||1);
  const cutoff=Date.now()-60*86400000;
  const freshRows=all.filter(a=>a.release_date&&new Date(a.release_date).getTime()>=cutoff);const fresh=uniqueByArtist(freshRows,freshRows.length||1);
  const popular=[...state.artists].sort((a,b)=>(Number(state.followerCounts?.[Number(b.artist_id)]||0)-Number(state.followerCounts?.[Number(a.artist_id)]||0))||String(a.artist_name||'').localeCompare(String(b.artist_name||''))).slice(0,7);
  const shelf=(title,subtitle,action,html)=>`<section class="shelf-section"><div class="section-heading discover-heading"><div><h2>${title}</h2>${subtitle?`<p>${subtitle}</p>`:''}</div>${action||''}</div>${html}</section>`;
  const albumsExpanded=!!state.discoverExpanded.albums, curatedExpanded=!!state.discoverExpanded.curated;
  const visibleAlbums=albumsExpanded?available:available.slice(0,7);
  const curated=recommendationPicksDetailed(30);
  const podcastPicks=recommendedPodcastsDetailed(7);
  const filter=state.discoverFilter||'all';
  const showMusic=filter==='all'||filter==='music';
  const showPodcasts=filter==='all'||filter==='podcasts';
  const expandBtn=(key,expanded,canExpand)=>canExpand?`<button type="button" class="text-link" data-discover-showall="${key}">${expanded?'Show less':'Show all'}</button>`:'';
  const musicSections=showMusic?`${shelf('Available Albums','Active releases from across SoundWave',expandBtn('albums',albumsExpanded,available.length>7),available.length?`<div class="shelf ${albumsExpanded?'wrap discover-expanded':''}">${visibleAlbums.map(albumTile).join('')}</div>`:'<div class="empty discover-empty"><span>▣</span><h3>No albums are available yet</h3><p>Active releases will appear here as artists publish them.</p></div>')}
  ${shelf('Curated for you','Recommendations shaped by your listening signals',curated.length>1?`<div class="curated-slider-controls"><button type="button" data-curated-slide="prev" aria-label="Previous recommendations" title="Previous" disabled>${icon('back')}</button><button type="button" data-curated-slide="next" aria-label="Next recommendations" title="Next">${icon('forward')}</button></div>`:'',curated.length?`<div class="shelf curated-slider" id="curated-slider" aria-label="Curated recommendations">${curated.map(curatedTile).join('')}</div>`:'<div class="empty discover-empty"><span>✦</span><h3>Your recommendations are warming up</h3><p>Play music, like tracks and follow artists to personalize this shelf.</p><button class="button secondary" data-nav="music">Find music</button></div>')}
  ${shelf('New releases','Fresh releases from the last 60 days','<button type="button" class="text-link" data-nav="music">Browse catalog</button>',fresh.length?`<div class="shelf">${fresh.map(albumTile).join('')}</div>`:'<div class="empty discover-empty"><span>◷</span><h3>No fresh releases in the last 60 days</h3><p>Check Available Albums above for the full active catalog.</p></div>')}
  ${shelf('Popular artists',state.socialRpc?.counts?'Ranked by verified follower count':'Follower ranking unavailable until follower-count data loads','<button type="button" class="text-link" data-nav="artists">Show all</button>',popular.length?`<div class="shelf popular-artist-shelf">${popular.map((a,i)=>artistCard(a,i,{showFollowers:true,rank:i+1})).join('')}</div>`:'<div class="empty discover-empty"><span>◎</span><h3>Artists will appear here</h3><p>Follower activity will rank artists as the community grows.</p></div>')}`:'';
  const podcastSubtitle=(Object.keys(state.podcastRecSignals?.categories||{}).length||state.podcastRecSignals?.shows?.length)?'Based on the podcast categories and shows you listen to':'Active shows to help you start discovering podcasts';
  const podcastSections=showPodcasts?shelf('Podcasts for you',podcastSubtitle,'<button type="button" class="text-link" data-nav="podcasts">Show all</button>',podcastPicks.length?`<div class="shelf">${podcastPicks.map(podcastRecommendationCard).join('')}</div>`:'<div class="empty discover-empty"><span>◉</span><h3>No podcasts published yet</h3><p>Published shows will appear here automatically.</p><button class="button secondary" data-nav="podcasts">Explore podcasts</button></div>'):'';
  shell(`<section class="discover-hero"><div><span class="eyebrow">SOUNDWAVE DISCOVER</span><h2>Discover new music</h2><p>Albums, artists and shows picked to help you find your next favorite.</p><button type="button" class="button" data-nav="music">${icon('search')} Explore the catalog</button></div><span class="discover-orbit" aria-hidden="true">${icon('music')}</span></section>
  ${discoverFilterChips()}
  <div class="discover-filter-content">${musicSections}${podcastSections}</div>`,'Discover','');
}

function artistDashboard(){if(!hasArtistAccess())return discoverPage();
 const owned=state.ownedSongs||[];
 shell(`<section class="workspace-hero artist-hero"><div><span class="eyebrow">ARTIST STUDIO</span><h2>Your sound. Your space.</h2><p>See how your releases are performing, then jump into publishing when you are ready.</p><div class="hero-actions"><button class="button" data-nav="studio">${icon('upload')} Manage releases</button></div></div><span class="hero-vinyl">${icon('album')}</span></section>${artistAnalyticsHtml()}<div class="section-heading"><h2>Recent releases</h2><button class="text-link" data-nav="studio">Manage →</button></div><div class="release-grid">${owned.filter(x=>x.is_active).slice(0,5).map(artTile).join('')||quickTile('Create your first album','Start in Artist Studio','', 'studio','album',2)}</div>`,'Artist Studio',`Welcome back, ${state.artist?.artist_name||'Artist'}.`);
}
function adminDashboard(){if(!hasAdminAccess())return discoverPage();
 const d=state.adminData||{},users=d.users||[],artists=d.artists||[],songs=d.songs||state.songs||[],pods=d.podcasts||[];
 const activeUsers=users.filter(x=>x.is_active!==false).length,activeArtists=artists.filter(x=>x.is_active!==false).length;
 const inactiveContent=songs.filter(x=>x.is_active===false).length+pods.filter(x=>x.is_active===false).length;
 const chart=adminChartData();
 shell(`<section class="workspace-hero admin-hero"><div><span class="eyebrow">SOUNDWAVE ADMIN</span><h2>Platform control, without the clutter.</h2><p>Monitor account health, catalog activity and qualified streams, then open Moderation when action is needed.</p><div class="hero-actions"><button class="button" data-admin-dashboard-action="moderation">${icon('shield')} Open moderation</button></div></div><span class="hero-vinyl">${icon('shield')}</span></section>
 <section class="studio-stat-strip four admin-dashboard-stats"><div><small>Total users</small><strong data-count="${users.length}">${users.length}</strong><span>${activeUsers} active</span></div><div><small>Active creators</small><strong data-count="${activeArtists}">${activeArtists}</strong><span>${artists.length} artist profiles</span></div><div><small>Qualified streams</small><strong data-count="${chart.total}">${chart.total}</strong><span>Last 30 days</span></div><div><small>Needs attention</small><strong data-count="${inactiveContent}">${inactiveContent}</strong><span>Inactive content</span></div></section>
 <div class="creator-summary-grid admin-dashboard-actions"><article><span class="eyebrow">MODERATION</span><h3>User & content review</h3><p>Manage accounts, artists, songs and podcasts with the protected admin controls.</p><button class="button secondary" data-admin-dashboard-action="moderation">${icon('shield')} Open moderation</button></article><article><span class="eyebrow">PERFORMANCE</span><h3>${chart.most?esc(chart.most.name):'No streams yet'}</h3><p>${chart.most?`${chart.most.value.toLocaleString()} qualified streams on the leading track.`:'Platform stream analytics will appear after qualified plays are recorded.'}</p><button class="button secondary" data-admin-dashboard-action="analytics">${icon('chart')} View analytics</button></article><article><span class="eyebrow">CATALOG</span><h3>${songs.length} songs · ${pods.length} podcasts</h3><p>${inactiveContent?`${inactiveContent} item${inactiveContent===1?'':'s'} currently inactive and worth reviewing.`:'No inactive catalog items need attention.'}</p><button class="button secondary" data-admin-dashboard-action="catalog">${icon('music')} Review catalog</button></article></div>
 ${adminChartsHtml(users)}`,'Admin Dashboard',`Welcome back, ${state.profile?.display_name||'Admin'}.`);
 // Admin dashboard actions use the persistent delegated handler below.
}
function home(){const target=primaryDashboard();if(target==='admin-dashboard')return adminDashboard();if(target==='artist-dashboard')return artistDashboard();return discoverPage();}
function music() {
  state.tint = '#1d3a2f';
  shell(`${searchFieldHtml('page-search','page-search mobile-search','What do you want to play?','Search SoundWave')}${recentSearchesHtml()}<div id="search-results">${searchResultsHtml()}</div>`, 'Search', '');
  const pg = $('#page-search'); if(pg){pg.addEventListener('input', () => setSearch(pg.value, pg));pg.addEventListener('keydown',searchKeyboardNav);}document.querySelectorAll('[data-recent-search]').forEach(b=>b.onclick=()=>{state.searchQuery=b.dataset.recentSearch;render();});
  bindSearchBits(document.getElementById('search-results'));
  if (!state.searchQuery && !state.searchGenre && matchMedia('(hover: hover)').matches && !state.focusSearch) $('#global-search')?.focus();
}
function bindMusic(root = document) {
  root.querySelectorAll('[data-jump]').forEach((b) => b.onclick = () => navigate(b.dataset.jump));
  root.querySelectorAll('[data-play]').forEach((b) => b.onclick = (e) => {
    e.stopPropagation(); e.preventDefault();
    action(async () => { const row = b.closest('[data-queue]'); const q = row?.dataset.queue ? row.dataset.queue.split(',').filter(Boolean).map(Number) : null; await playSong(Number(b.dataset.play), q); });
  });
  root.querySelectorAll('[data-play-ids]').forEach((b) => b.onclick = (e) => {
    e.stopPropagation();
    const list = b.dataset.playIds.split(',').filter(Boolean).map(Number); if (!list.length) return;
    const start = prefs.shuffle ? list[Math.floor(Math.random() * list.length)] : list[0];
    action(() => playSong(start, list));
  });
  root.querySelectorAll('[data-toggle-shuffle]').forEach((b) => { b.classList.toggle('active', prefs.shuffle); b.onclick = toggleShuffle; });
  bindSongMenus();
}

// ---------- Library sidebar (Spotify-style "Your Library") ----------
function libraryChips() {
  const counts={playlists:state.playlists.length,artists:state.artists.filter(a=>state.favorites.some(x=>x.artist_id===a.artist_id)).length,podcasts:state.myShows.filter(s=>s.is_active).length};
  return [['playlists','Playlists'],['podcasts','Podcasts'],['artists','Artists']].map(([k, label]) => `<button type="button" class="filter-pill ${state.libFilter === k ? 'active' : ''}" data-lib-filter="${k}" aria-pressed="${state.libFilter === k}"><span class="pill-label">${label}</span><span class="filter-count">${counts[k]}</span></button>`).join('');
}
function libraryToolsHtml() {
  const open = state.libSearchOpen || state.libQuery;
  return `<button type="button" class="icon-quiet" id="lib-search-toggle" aria-label="Search in Your Library" title="Search in Your Library">${icon('search')}</button><input id="lib-search" class="lib-search" type="search" autocomplete="off" placeholder="Search in Your Library" aria-label="Search in Your Library" value="${esc(state.libQuery || '')}" ${open ? '' : 'hidden'}><button type="button" class="lib-sort" id="lib-sort" aria-haspopup="menu" aria-label="Sort library"><span id="lib-sort-label">${prefs.libSort === 'alpha' ? 'Alphabetical' : 'Recents'}</span>${icon('list')}</button>`;
}
function libraryEntries() {
  const f = state.libFilter, q = (state.libQuery || '').trim().toLowerCase(), out = [];
  const add = (name, meta, art, attrs, active, cls = '') => out.push({ name, meta, art, attrs, active, cls });
  if (f === 'all' || f === 'playlists') state.playlists.slice(0, 80).forEach((p, i) => {
    const playlistArt=p.cover_path&&state.coverUrls[p.cover_path]
      ? `<img class="cover-img" src="${esc(state.coverUrls[p.cover_path])}" alt="${esc(p.playlist_name)} cover" loading="lazy">`
      : icon('music');
    add(p.playlist_name, `Playlist · ${p.visibility}`, `<span class="library-art playlist-library-art" style="background:${grad(i)}">${playlistArt}</span>`, `data-openplaylist="${p.playlist_id}"`, state.page === 'playlists' && state.selectedPlaylist === p.playlist_id);
  });
  if (f === 'all' || f === 'podcasts') state.myShows.filter((s) => s.is_active).slice(0, 40).forEach((s, i) => {
    const podcastArt = s.cover_path && state.coverUrls[s.cover_path]
      ? `<img class="cover-img" src="${esc(state.coverUrls[s.cover_path])}" alt="${esc(s.show_title)}">`
      : icon('mic');
    add(s.show_title, 'Podcast · Your show', `<span class="library-art" style="background:${grad(i + 2)}">${podcastArt}</span>`, `data-open-show="${s.show_id}"`, state.page === 'podcasts' && state.selectedShow === s.show_id);
  });
  if (f === 'all' || f === 'artists') state.artists.filter((a) => state.favorites.some((x) => x.artist_id === a.artist_id)).slice(0, 80).forEach((a, i) => add(a.artist_name, 'Artist', `<span class="library-art round" style="background:${grad(i + 1)}">${esc(a.artist_name?.[0] || 'A')}</span>`, `data-open-artist="${a.artist_id}"`, state.page === 'artist-detail' && state.selectedArtist === a.artist_id, 'is-artist'));
  let rows = q ? out.filter((e) => e.name.toLowerCase().includes(q)) : out;
  if (prefs.libSort === 'alpha') rows = [...rows].sort((x, y) => x.name.localeCompare(y.name));
  return rows;
}
function libraryListHtml() {
  const f = state.libFilter, q = (state.libQuery || '').trim().toLowerCase(), grid = prefs.libView === 'grid';
  const item = (cls, art, name, metaHtml, attrs, active) => `<button type="button" class="library-item ${cls} ${active ? 'active' : ''}" ${attrs} title="${esc(name)}">${art}<span class="library-item-label"><strong>${esc(name)}</strong><small>${metaHtml}</small></span></button>`;
  const parts = [];
  // Liked Songs is always pinned first, exactly like Spotify.
  if ((f === 'all' || f === 'playlists') && (!q || 'liked songs'.includes(q))) {
    const meta = state.likesAvailable ? `${state.liked.length} ${state.liked.length === 1 ? 'song' : 'songs'}` : 'Set up needed';
    parts.push(item('liked pinned', `<span class="library-art liked-art">${icon('heart')}</span>`, 'Liked Songs', `<span class="pin-ico">${icon('pin')}</span>Playlist · ${meta}`, 'data-nav="liked-songs"', state.page === 'liked-songs'));
  }
  if ((f === 'all' || f === 'playlists') && state.topWeekSongs.length && (!q || 'your top songs of the week'.includes(q))) {
    parts.push(item('weekly pinned', `<span class="library-art weekly-art">${icon('music')}</span>`, 'Your Top Songs of the Week', `<span class="pin-ico">${icon('pin')}</span>Auto playlist · ${state.topWeekSongs.length} songs`, `data-play-ids="${state.topWeekSongs.map(x=>x.song_id).join(',')}"`, false));
  }
  libraryEntries().forEach((e) => parts.push(item(e.cls, e.art, e.name, esc(e.meta), e.attrs, e.active)));
  if (parts.length === ((f === 'all' || f === 'playlists') && (!q || 'liked songs'.includes(q)) ? 1 : 0) && !libraryEntries().length) {
    if (q) return parts.join('') + `<div class="library-empty"><strong>Couldn’t find “${esc(state.libQuery)}”</strong><p>Try searching again using a different spelling or keyword.</p></div>`;
    if (f === 'artists') return `<div class="library-empty-card"><strong>Follow your first artist</strong><p>Follow artists you like and they’ll show up here.</p><button type="button" class="button sm" data-nav="artists">Browse artists</button></div>`;
    if (f === 'podcasts') return `<div class="library-empty-card"><strong>Create your first podcast show</strong><p>Share a story with the world.</p><button type="button" class="button sm" data-create-show>Create show</button></div>`;
    return parts.join('') + `<div class="library-empty-card"><strong>Create your first playlist</strong><p>It’s easy, we’ll help you.</p><button type="button" class="button sm" data-create-playlist>Create playlist</button></div>`;
  }
  return parts.join('');
}
function renderLibraryList() {
  const list = document.getElementById('library-list'); if (!list) return;
  list.className = 'library-scroll';
  list.innerHTML = libraryListHtml();
  const chips = document.getElementById('library-filters'); if (chips) chips.innerHTML = libraryChips();
  const lab = document.getElementById('lib-sort-label'); if (lab) lab.textContent = prefs.libSort === 'alpha' ? 'Alphabetical' : 'Recents';
  const sortBtn = document.getElementById('lib-sort'); if (sortBtn) { sortBtn.querySelector('svg')?.remove(); sortBtn.insertAdjacentHTML('beforeend', icon('list')); }
  bindLibrary();
}
function popMenu(anchor, html, wire) {
  document.querySelector('.song-action-popover')?.remove();
  const pop = document.createElement('div'); pop.className = 'song-action-popover'; pop.setAttribute('role', 'menu'); pop.innerHTML = html; document.body.appendChild(pop);
  const r = anchor.getBoundingClientRect();
  pop.style.left = `${Math.max(8, Math.min(window.innerWidth - 250, r.left))}px`;
  pop.style.top = `${Math.min(window.innerHeight - (pop.offsetHeight || 200) - 100, r.bottom + 6)}px`;
  wire(pop, (sel, fn) => pop.querySelector(sel)?.addEventListener('click', () => { pop.remove(); fn(); }));
}
function openCreateShow() { navigate('podcasts'); setTimeout(() => document.getElementById('create-show-dialog')?.showModal(), 60); }
function bindLibrary() {
  const sb = document.querySelector('.sidebar'); if (!sb) return;
  bindContent(sb); bindMusic(sb);
  let motion=sb.querySelector('.sidebar-motion-indicator');
  if(motion)motion.remove(); motion=null;
  const moveIndicator=(item)=>{if(!item||!motion)return;const sr=sb.getBoundingClientRect(),ir=item.getBoundingClientRect();motion.style.top=`${Math.max(0,ir.top-sr.top)}px`;motion.style.height=`${Math.max(34,ir.height)}px`;motion.classList.add('visible');};
  const activeItem=sb.querySelector('.library-item.active');if(activeItem)requestAnimationFrame(()=>moveIndicator(activeItem));
  sb.addEventListener('click',(e)=>{const item=e.target.closest('.library-item,.filter-pill,.sidebar-role,.library-toggle');if(!item)return;item.classList.remove('sidebar-click-pop');void item.offsetWidth;item.classList.add('sidebar-click-pop');moveIndicator(item);setTimeout(()=>item.classList.remove('sidebar-click-pop'),420);},{capture:true});
  sb.querySelectorAll('[data-create-playlist]').forEach((b) => b.onclick = () => action(quickCreatePlaylist));
  sb.querySelectorAll('[data-create-show]').forEach((b) => b.onclick = openCreateShow);
  sb.querySelectorAll('[data-lib-filter]').forEach((b) => b.onclick = () => { state.libFilter = state.libFilter === b.dataset.libFilter ? 'all' : b.dataset.libFilter; renderLibraryList(); });
  const create = document.getElementById('library-create');
  if (create) create.onclick = (e) => { e.stopPropagation(); popMenu(create, `<button data-c-pl>${icon('music')} <span>Playlist<small class="menu-sub">Build a playlist with songs</small></span></button><button data-c-show>${icon('mic')} <span>Podcast show<small class="menu-sub">Start your own show</small></span></button>`, (pop, on) => { on('[data-c-pl]', () => action(quickCreatePlaylist)); on('[data-c-show]', openCreateShow); }); };
  const tog = document.getElementById('lib-search-toggle'), box = document.getElementById('lib-search');
  if (tog && box) {
    tog.onclick = () => { state.libSearchOpen = !state.libSearchOpen; if (!state.libSearchOpen) { state.libQuery = ''; box.value = ''; renderLibraryList(); } box.hidden = !(state.libSearchOpen || state.libQuery); if (!box.hidden) box.focus(); };
    box.oninput = () => { state.libQuery = box.value; renderLibraryList(); };
  }
  const sort = document.getElementById('lib-sort');
  if (sort) sort.onclick = (e) => { e.stopPropagation(); const chk = (c) => (c ? `<span class="menu-check">${icon('check')}</span>` : ''); popMenu(sort, `<div class="menu-label">Sort by</div><button data-s="recents">Recents ${chk(prefs.libSort !== 'alpha')}</button><button data-s="alpha">Alphabetical ${chk(prefs.libSort === 'alpha')}</button>`, (pop, on) => { on('[data-s="recents"]', () => { prefs.libSort = 'recents'; savePrefs(); renderLibraryList(); }); on('[data-s="alpha"]', () => { prefs.libSort = 'alpha'; savePrefs(); renderLibraryList(); }); }); };
}

// ---------- Search ----------
function searchFieldHtml(id, className, placeholder, label) {
  const hasValue = !!String(state.searchQuery || '').trim();
  return `<div class="${className}" data-has-value="${hasValue ? 'true' : 'false'}" role="search"><span class="search-icon" aria-hidden="true">${icon('search')}</span><input id="${id}" type="search" autocomplete="off" spellcheck="false" placeholder="${placeholder}" aria-label="${label}" value="${esc(state.searchQuery || '')}"><button type="button" class="search-clear" data-clear-search="${id}" aria-label="Clear search" ${hasValue ? '' : 'hidden'}>${icon('close')}</button><span class="search-divider" aria-hidden="true" ${hasValue ? 'hidden' : ''}></span><button type="button" class="search-browse" data-nav="music" aria-label="Browse music" title="Browse" ${hasValue ? 'hidden' : ''}>${icon('library')}</button></div>`;
}

function setSearch(q, from) {
  state.searchQuery = q;
  document.querySelectorAll('#global-search,#page-search').forEach((el) => { if (el !== from && el.value !== q) el.value = q; });
  if (state.page !== 'music') {
    if (!String(q || '').trim()) return;
    state.focusSearch = from?.id || 'global-search';
    state.page = 'music';
    render();
    return;
  }
  renderSearchResults();
}
function fuzzyScore(text, query){
  text=String(text||'').toLowerCase();query=String(query||'').trim().toLowerCase();if(!query)return 1;
  if(text===query)return 120;if(text.startsWith(query))return 100-query.length;if(text.includes(query))return 80-query.length;
  let qi=0,score=0,last=-2;for(let i=0;i<text.length&&qi<query.length;i++){if(text[i]===query[qi]){score+=i===last+1?6:2;last=i;qi++;}}
  return qi===query.length?score:0;
}
function searchData() {
  const q=(state.searchQuery||'').trim().toLowerCase(),g=state.searchGenre;
  let songs=state.songs,albums=catalogAlbums(),artists=state.artists,playlists=state.playlists,shows=state.podcasts;
  if(g){songs=songs.filter(s=>Number(s.genre_id)===Number(g));albums=albums.filter(a=>a.songs.some(s=>Number(s.genre_id)===Number(g)));const aids=new Set(songs.map(s=>s.album?.artist?.artist_id));artists=artists.filter(a=>aids.has(a.artist_id));playlists=[];shows=[];}
  const rank=(rows,fields)=>q?rows.map(row=>({row,score:Math.max(...fields.map(f=>fuzzyScore(f(row),q)))})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).map(x=>x.row):rows;
  songs=rank(songs,[s=>s.song_title,s=>s.album?.album_title,s=>s.album?.artist?.artist_name]);
  albums=rank(albums,[a=>a.title,a=>a.artist?.artist_name]);artists=rank(artists,[a=>a.artist_name,a=>a.country]);playlists=rank(playlists,[p=>p.playlist_name,p=>p.description]);shows=rank(shows,[p=>p.show_title,p=>p.category]);
  return {q,songs,albums,artists,playlists,shows};
}
function topResultHtml(d) {
  const q = d.q; if (!q) return '';
  const score = (n) => { n = String(n || '').toLowerCase(); return n === q ? 3 : n.startsWith(q) ? 2 : n.includes(q) ? 1 : 0; };
  const c = [...d.artists.map((a) => ({ t: 'artist', s: score(a.artist_name) * 10 + 3, a })), ...d.songs.map((s) => ({ t: 'song', s: score(s.song_title) * 10 + 2, song: s })), ...d.albums.map((a) => ({ t: 'album', s: score(a.title) * 10 + 1, a }))].sort((x, y) => y.s - x.s)[0];
  if (!c) return '';
  if (c.t === 'artist') { const songs = songsByArtist(c.a.artist_id); return `<article class="top-card clickable" tabindex="0" role="link" data-open-artist="${c.a.artist_id}" ${songs.length ? `data-queue="${ids(songs).join(',')}"` : ''}><span class="top-art round" style="background:${grad(c.a.artist_id)}">${esc(c.a.artist_name?.[0] || 'A')}</span><h3>${esc(c.a.artist_name)}</h3><span class="type-pill">Artist</span>${songs.length ? `<button type="button" class="hover-play" data-play="${songs[0].song_id}" aria-label="Play ${esc(c.a.artist_name)}">${icon('play')}</button>` : ''}</article>`; }
  if (c.t === 'album') return `<article class="top-card clickable" tabindex="0" role="link" data-open-album="${c.a.album_id}" data-queue="${ids(c.a.songs).join(',')}"><span class="top-art">${albumArt({ song_id: c.a.album_id, album: c.a }, 'large')}</span><h3>${esc(c.a.title)}</h3><p><span class="type-pill">Album</span> ${esc(c.a.artist?.artist_name || '')}</p><button type="button" class="hover-play" data-play="${c.a.songs[0].song_id}" aria-label="Play ${esc(c.a.title)}">${icon('play')}</button></article>`;
  const s = c.song;
  return `<article class="top-card clickable" tabindex="0" role="link" ${s.album ? `data-open-album="${s.album.album_id}"` : ''} data-queue="${ids(d.songs).join(',')}"><span class="top-art">${albumArt(s, 'large')}</span><h3>${esc(s.song_title)}</h3><p><span class="type-pill">Song</span> ${esc(s.album?.artist?.artist_name || '')}</p><button type="button" class="hover-play" data-play="${s.song_id}" aria-label="Play ${esc(s.song_title)}">${icon('play')}</button></article>`;
}
function browseAllHtml() {
  const g = state.genres;
  const tiles = g.length ? g.map((x, i) => `<button type="button" class="browse-tile" data-genre="${x.genre_id}" style="background:${BROWSE_COLORS[i % BROWSE_COLORS.length]}"><span>${esc(x.genre_name)}</span><i>${icon('music')}</i></button>`).join('')
    : [['Podcasts', 'podcasts', 'mic'], ['Your library', 'playlists', 'library'], ['Artists', 'artists', 'users'], ['Recently played', 'history', 'clock']].map(([label, page, ico], i) => `<button type="button" class="browse-tile" data-nav="${page}" style="background:${BROWSE_COLORS[i * 2 % BROWSE_COLORS.length]}"><span>${label}</span><i>${icon(ico)}</i></button>`).join('');
  return `<div class="section-heading"><h2>Browse all</h2></div><div class="browse-grid">${tiles}</div>`;
}
function searchResultsHtml() {
  const d = searchData(), tab = state.searchTab, genre = state.searchGenre && state.genres.find((x) => Number(x.genre_id) === Number(state.searchGenre));
  if (!d.q && !state.searchGenre) return browseAllHtml();
  const any = d.songs.length || d.artists.length || d.albums.length || d.playlists.length || d.shows.length;
  const genreChip = genre ? `<div class="genre-chip"><span>${esc(genre.genre_name)}</span><button type="button" data-clear-genre aria-label="Clear genre filter">${icon('close')}</button></div>` : '';
  if (!any) return `${genreChip}<div class="empty-state"><h3>No results found${d.q ? ` for “${esc(state.searchQuery)}”` : ''}</h3><p>Check your spelling, or try fewer or different keywords.</p></div>`;
  const tabs = [['all', 'All', true], ['songs', 'Songs', d.songs.length], ['artists', 'Artists', d.artists.length], ['albums', 'Albums', d.albums.length], ['playlists', 'Playlists', d.playlists.length], ['podcasts', 'Podcasts', d.shows.length]].filter((t) => t[2]).map(([k, l]) => `<button type="button" class="${tab === k ? 'active' : ''}" data-search-tab="${k}">${l}</button>`).join('');
  const sec = (title, html) => html ? `<section class="search-section"><div class="section-heading"><h2>${title}</h2></div>${html}</section>` : '';
  const songsHtml = (full) => d.songs.length ? trackTable(full ? d.songs : d.songs.slice(0, 4), { queue: ids(d.songs), header: false, showAlbum: full }) : '';
  const artistsHtml = d.artists.length ? `<div class="shelf">${d.artists.slice(0, tab === 'artists' ? 60 : 7).map(artistCard).join('')}</div>` : '';
  const albumsHtml = d.albums.length ? `<div class="shelf">${d.albums.slice(0, tab === 'albums' ? 60 : 7).map(albumTile).join('')}</div>` : '';
  const plHtml = d.playlists.length ? `<div class="shelf">${d.playlists.map((p, i) => `<article class="release-tile card-link" tabindex="0" role="link" data-openplaylist="${p.playlist_id}"><span class="release-art"><span class="placeholder-art large" style="background:${grad(i)}">${icon('music')}</span></span><strong>${esc(p.playlist_name)}</strong><small>Playlist · You</small></article>`).join('')}</div>` : '';
  const showHtml = d.shows.length ? `<div class="shelf">${d.shows.map(showCard).join('')}</div>` : '';
  let body;
  if (tab === 'songs') body = sec('Songs', songsHtml(true));
  else if (tab === 'artists') body = sec('Artists', artistsHtml);
  else if (tab === 'albums') body = sec('Albums', albumsHtml);
  else if (tab === 'playlists') body = sec('Playlists', plHtml);
  else if (tab === 'podcasts') body = sec('Podcasts', showHtml);
  else {
    const top = topResultHtml(d);
    body = `${top || d.songs.length ? `<div class="search-top">${top ? `<section><div class="section-heading"><h2>Top result</h2></div>${top}</section>` : ''}${d.songs.length ? `<section><div class="section-heading"><h2>Songs</h2></div>${songsHtml(false)}</section>` : ''}</div>` : ''}${sec('Artists', artistsHtml)}${sec('Albums', albumsHtml)}${sec('Playlists', plHtml)}${sec('Podcasts', showHtml)}`;
  }
  return `${genreChip}<div class="home-chips search-tabs">${tabs}</div>${body}`;
}
function renderSearchResults() {
  const box = document.getElementById('search-results'); if (!box) return;
  box.innerHTML = searchResultsHtml();
  bindContent(box); bindMusic(box); bindSearchBits(box); syncHearts(); markPlaying();
}
function bindSearchBits(root) {
  root.querySelectorAll('[data-search-tab]').forEach((b) => b.onclick = () => { state.searchTab = b.dataset.searchTab; renderSearchResults(); });
  root.querySelectorAll('[data-genre]').forEach((b) => b.onclick = () => { state.searchGenre = Number(b.dataset.genre); state.searchTab = 'all'; renderSearchResults(); });
  root.querySelectorAll('[data-clear-genre]').forEach((b) => b.onclick = () => { state.searchGenre = null; renderSearchResults(); });
}
function artists(){
 shell(`<div class="home-chips"><button class="active" data-nav="artists">Discover</button><button data-nav="liked-artists">Following</button></div><div class="artist-grid">${state.artists.map((a,i)=>artistCard(a,i,{follow:true})).join('')||'<div class="empty">No active artists found.</div>'}</div>`,'Artists','Discover and follow artists.');
}
function likedArtists(){ followers(); }
function bindFavoriteButtons(){ /* Follow buttons are handled globally (see the document click handler). */ }
const personName = (uid) => state.socialProfiles?.[String(uid)]?.display_name || `Listener ${String(uid || '').slice(0, 6)}`;
const fmtDate = (d) => { try { return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); } catch { return ''; } };
function followerRows() {
  // People who tapped Follow on this account's artist profile (listeners cannot be followed).
  return (state.artistFollowers || []).map((r) => ({ id: r.follower_user_id, name: r.display_name || personName(r.follower_user_id), since: r.followed_at }));
}
function myFollowerCount() { return Math.max(followerRows().length, state.artist ? (state.followerCounts?.[Number(state.artist.artist_id)] || 0) : 0); }
const followingArtists = () => state.artists.filter((a) => isFollowing(a.artist_id));
const followNav = () => (hasArtistAccess() ? 'followers' : 'liked-artists');
const followLabel = () => (hasArtistAccess() ? 'Followers' : 'Following');
function followers(){
 const isArtist=hasArtistAccess();
 const tab=!isArtist||state.page==='liked-artists'?'following':'followers';
 const fans=followerRows(),fArtists=followingArtists();
 const initial=(n,i=0)=>`<span class="member-avatar" style="background:${grad(i)}">${esc((n||'?')[0].toUpperCase())}</span>`;
 const followersList=fans.length?fans.map((r,i)=>`<div class="social-row">${initial(r.name,i)}<div><strong>${esc(r.name)}</strong><small>${r.since?`Followed you ${esc(fmtDate(r.since))}`:'Follows you'}</small></div></div>`).join(''):`<div class="empty">No followers yet. When a listener taps <b>Follow</b> on your artist page, they will show up here.</div>`;
 const followingList=fArtists.length?fArtists.map((a,i)=>`<div class="social-row"><button type="button" class="social-link" data-open-artist="${a.artist_id}"><span class="member-avatar" style="background:${grad(i)}">${esc(a.artist_name?.[0]||'A')}</span><span><strong>${esc(a.artist_name)}</strong><small>Artist${followerText(a.artist_id)?' · '+followerText(a.artist_id):''}</small></span></button>${followBtn(a,'sm')}</div>`).join(''):`<div class="empty">You are not following any artists yet. <button type="button" class="text-link" data-nav="artists">Find artists to follow</button></div>`;
 const needsSql=isArtist&&tab==='followers'&&!state.socialRpc?.mine;
 const chips=isArtist?`<div class="home-chips"><button class="${tab==='followers'?'active':''}" data-nav="followers">Followers</button><button class="${tab==='following'?'active':''}" data-nav="liked-artists">Following</button></div>`:`<div class="home-chips"><button data-nav="artists">Discover</button><button class="active" data-nav="liked-artists">Following</button></div>`;
 const stats=isArtist?`<div class="social-stats"><div><strong>${fans.length}</strong><span>Followers</span></div><div><strong>${fArtists.length}</strong><span>Following</span></div></div>`:`<div class="social-stats"><div><strong>${fArtists.length}</strong><span>Following</span></div></div>`;
 shell(`${chips}${stats}${needsSql?`<div class="notice">To see who follows your artist profile, run <code>sql/RUN_ME_likes_and_followers.sql</code> once in the Supabase SQL Editor, then refresh this page.</div>`:''}<section class="social-list">${tab==='followers'?followersList:followingList}</section>`,tab==='followers'?'Followers':'Following','Your SoundWave social connections.');
}

function profile(){
 const display=state.profile?.display_name||state.user?.email?.split('@')[0]||'SoundWave user';
 const st=state.profileStats||{};
 const followerCount=Number(st.follower_count ?? (hasArtistAccess()?followerRows().length:state.followers.length) ?? 0);
 const followingCount=Number(st.following_count ?? followingArtists().length ?? 0);
 const playlistCount=Number(st.playlist_count ?? state.playlists.length ?? 0);
 const role=hasAdminAccess()?(hasArtistAccess()?'Artist + Admin':'Admin'):hasArtistAccess()?'Artist':'Listener';
 const premiumName=state.entitlement?.plan_name||'Premium';
 const avatar=state.profilePhotoUrl?`<img src="${esc(state.profilePhotoUrl)}" alt="${esc(display)}">`:esc(display[0]?.toUpperCase()||'S');
 shell(`<section class="profile-card-v26"><div class="profile-identity-row"><button type="button" class="profile-avatar-v26 profile-photo-btn ${isPremiumUser()?'premium-user':''}" id="profile-photo-btn" title="Change profile photo">${avatar}<span class="profile-photo-edit">${icon('upload')}</span></button><div class="profile-identity-copy"><span class="eyebrow">YOUR PROFILE</span><h2>${esc(display)}</h2><div class="profile-badge-row"><span class="role-badge">${esc(role)}</span>${isPremiumUser()?`<span class="mini-premium-chip">${icon('check')} ${esc(premiumName)}</span>`:''}</div></div><button class="button secondary sm profile-edit-v26" id="edit-profile-btn">Edit</button></div><div class="profile-stat-row"><button ${hasArtistAccess()?'data-nav="followers"':'data-nav="liked-artists"'}><strong>${followerCount}</strong><span>Followers</span></button><button data-nav="liked-artists"><strong>${followingCount}</strong><span>Following</span></button><button data-nav="playlists"><strong>${playlistCount}</strong><span>Playlists</span></button>${isPremiumUser()?`<button data-nav="downloads"><strong>${state.offlineDownloads.length}</strong><span>Downloads</span></button>`:''}</div><div class="profile-action-grid-v26">${hasArtistAccess()?`<button data-nav="studio">${icon('upload')}<span><strong>Artist Studio</strong><small>Releases and analytics</small></span></button>`:''}<button data-nav="playlists">${icon('library')}<span><strong>Your Library</strong><small>Playlists and saved music</small></span></button><button data-nav="history">${icon('clock')}<span><strong>Recently played</strong><small>Your listening activity</small></span></button><button data-nav="plans">${icon('check')}<span><strong>${isPremiumUser()?'Manage Premium':'Premium'}</strong><small>${isPremiumUser()?esc(premiumName):'View available plans'}</small></span></button></div></section><div class="profile-danger-zone"><button class="button danger" id="deactivate-account">Deactivate account</button><button class="button secondary profile-signout" id="profile-page-signout">Sign out</button></div><input type="file" accept="image/jpeg,image/png,image/webp" id="profile-photo-file" hidden><dialog class="sw-modal" id="edit-profile-dialog"><div class="modal-head"><div><span class="eyebrow">PROFILE</span><h2>Edit your profile</h2></div><button class="modal-close" data-close-modal>${icon('close')}</button></div><form id="edit-profile-form"><label class="single-field">Display name<input id="profile-display-name" value="${esc(display)}" required maxlength="90"></label><p class="muted small">Profile photos are stored securely in your SoundWave profile.</p><div class="dialog-actions"><button type="button" class="button secondary" data-close-modal>Cancel</button><button class="button">Save</button></div></form></dialog>`,'Profile','Your SoundWave identity, library and account.');
 $('#edit-profile-btn').onclick=()=>$('#edit-profile-dialog').showModal();
 $('#profile-photo-btn').onclick=()=>$('#profile-photo-file').click();
 $('#profile-photo-file').onchange=e=>action(async()=>{const file=e.target.files?.[0];if(!file)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Choose a JPEG, PNG or WebP image.');if(file.size>5*1048576)throw Error('Profile photo must be under 5 MB.');const ext=(file.name.split('.').pop()||'jpg').toLowerCase();const path=`${state.user.id}/avatar.${ext}`;check(await db.storage.from('profile-images').upload(path,file,{upsert:true,contentType:file.type}));check(await db.from('users').update({profile_photo_path:path}).eq('user_id',state.user.id));await loadData();render();toast('Profile photo updated');});
 $('#edit-profile-form').onsubmit=e=>{e.preventDefault();action(async()=>{const displayName=val('profile-display-name');const problem=plainNameProblem(displayName,'Display name',90);if(problem)throw Error(problem);if(hasArtistAccess()){const availability=await checkArtistIdentityAvailability(displayName,state.artist?.artist_name||'');if(!availability.displayAvailable&&displayName.toLowerCase()!==String(state.profile?.display_name||'').trim().toLowerCase())throw Error('That display name is already taken. Choose another one.');}check(await db.from('users').update({display_name:displayName}).eq('user_id',state.user.id));await loadData();render();toast('Profile updated');});};
 $('#deactivate-account')?.addEventListener('click',()=>{if(!confirm('Deactivate your SoundWave account? Your public content will be hidden until you restore the account.'))return;action(async()=>{check(await db.rpc('deactivate_my_account'));await loadData();render();toast('Account deactivated');});});
 $('#profile-page-signout')?.addEventListener('click',()=>action(async()=>{await stopAudio();cleanupSessionRuntime();document.getElementById('soundwave-player')?.remove();check(await db.auth.signOut());}));
}

async function playlistDetail(){
 if(!state.selectedPlaylist)return;
 const chosen=state.playlists.find(p=>Number(p.playlist_id)===Number(state.selectedPlaylist));
 const collabQuery=chosen?.user_id===state.user.id?db.rpc('playlist_collaborators_for_owner',{p_playlist_id:state.selectedPlaylist}):db.from('playlist_collaborator').select('playlist_id,user_id,date_added').eq('playlist_id',state.selectedPlaylist).order('date_added');
 let playlistSongsQuery=await db.from('playlist_song').select('playlist_id,song_id,track_order,date_added').eq('playlist_id',state.selectedPlaylist).order('track_order');
 if(playlistSongsQuery.error && /date_added/i.test(String(playlistSongsQuery.error?.message||''))) playlistSongsQuery=await db.from('playlist_song').select('playlist_id,song_id,track_order').eq('playlist_id',state.selectedPlaylist).order('track_order');
 const c=await collabQuery;
 if(playlistSongsQuery.error){toast(humanErr(playlistSongsQuery.error),true);state.playlistSongs=[];}else state.playlistSongs=playlistSongsQuery.data||[];
 if(c.error){console.warn('Collaborators unavailable',c.error);state.playlistCollaborators=[];}else state.playlistCollaborators=c.data||[];
 render();
}
// Fast-create mirrors a listening-first library: no mandatory forms or interruptions.
// Private by default. Public requires at least one song (BR-017).
async function quickCreatePlaylist(){
 const next=state.playlists.reduce((highest,p)=>{const m=/^My Playlist #(\d+)$/i.exec(p.playlist_name||'');return m?Math.max(highest,Number(m[1])):highest;},0)+1;
 // Use the controlled RPC instead of a direct INSERT. This keeps playlist
 // creation stable even when playlist SELECT/RLS rules change later.
 const created=check(await db.rpc('create_my_playlist',{
   p_name:`My Playlist #${next}`,
   p_description:null,
   p_visibility:'Private'
 }));
 const result=Array.isArray(created)?created[0]:created;
 if(!result?.playlist_id)throw Error('Playlist was created but no playlist id was returned.');
 state.selectedPlaylist=Number(result.playlist_id);state.playlistSongs=[];state.page='playlists';
 await loadData();await playlistDetail();render();toast('Playlist created. Find your first song!');
}
function playlists() {
  const chosen = state.playlists.find((p) => p.playlist_id === state.selectedPlaylist);
  if (!chosen) return libraryOverview();
  const rows = state.playlistSongs.map((ps) => songById(ps.song_id) || { song_id: ps.song_id, song_title: `Song #${ps.song_id}`, duration_seconds: null, album: null });
  const queueIds = rows.map((s) => s.song_id);
  const available = state.songs.filter((s) => !state.playlistSongs.some((p) => p.song_id === s.song_id)).slice(0, 10);
  const idx = state.playlists.findIndex((p) => p.playlist_id === chosen.playlist_id);
  const display = state.profile?.display_name || 'You';
  const covers = rows.filter((s) => s.album?.cover_path && state.coverUrls[s.album.cover_path]);
  const collageTile=(song,n)=>{const path=song?.cover_path||song?.album?.cover_path,url=path&&state.coverUrls?.[path];return url?`<span class="cover-collage-tile"><img src="${esc(url)}" alt="" loading="lazy"></span>`:`<span class="cover-collage-tile placeholder-art" style="background:${grad((song?.song_id||0)+n)}">${icon('music')}</span>`;};
  const cover = chosen.cover_path&&state.coverUrls[chosen.cover_path]?`<img class="cover-img playlist-main-cover" src="${esc(state.coverUrls[chosen.cover_path])}" alt="${esc(chosen.playlist_name)}">`:covers.length >= 4 ? `<div class="cover-collage">${covers.slice(0, 4).map((s,n) => collageTile(s,n)).join('')}</div>` : covers.length ? `<img class="cover-img playlist-main-cover" src="${esc(state.coverUrls[covers[0].cover_path||covers[0].album?.cover_path])}" alt="" loading="lazy">` : `<span class="placeholder-art large" style="background:${grad(idx)}">${icon('music')}</span>`;
  const collab = state.playlistCollaborators.map((c, i) => `<div class="collab-row"><span class="member-avatar">${i + 1}</span><div><strong>${esc(c.display_name||('User '+String(c.user_id).slice(0,8)+'…'))}</strong><small>Collaborator${c.date_added ? ` · ${esc(c.date_added)}` : ''}</small></div><button type="button" class="icon-quiet" data-collab-remove="${esc(c.user_id)}" aria-label="Remove collaborator">${icon('close')}</button></div>`).join('');
  state.tint = tintFor(chosen.playlist_id);
  shell(`<header class="coll-hero"><div class="coll-cover">${cover}</div><div class="coll-meta"><span class="coll-kind">${esc(chosen.visibility)} playlist</span><h1 class="coll-title">${esc(chosen.playlist_name)}</h1>${chosen.description ? `<p class="coll-desc">${esc(chosen.description)}</p>` : ''}<p class="coll-sub"><span class="sw-owner-avatar">${esc(display[0]?.toUpperCase() || 'S')}</span><strong>${esc(display)}</strong> · ${rows.length} ${rows.length === 1 ? 'song' : 'songs'}${rows.length ? ', ' + totalTime(rows) : ''}${state.playlistCollaborators.length ? ` · ${state.playlistCollaborators.length} collaborators` : ''}</p><div id="playlist-presence" class="playlist-presence">${playlistPresenceHtml()}</div></div></header>
<div class="coll-actions"><button type="button" class="sw-big-play" data-play-ids="${queueIds.join(',')}" ${!queueIds.length ? 'disabled' : ''} aria-label="Play playlist">${icon('play')}</button><button type="button" class="sw-quiet-action shuffle-toggle" data-toggle-shuffle aria-label="Shuffle" ${!queueIds.length ? 'disabled' : ''}>${icon('shuffle')}</button><div class="more-wrap"><button type="button" class="sw-more" id="sw-more-menu" aria-label="More options">${icon('dots')}</button><div id="sw-more-options" class="sw-more-options" hidden><button type="button" data-open-modal="playlist-edit-dialog">${icon('settings')} Edit playlist</button><button type="button" data-open-modal="playlist-collab-dialog">${icon('users')} Collaborators</button><button type="button" id="deactivate">Delete playlist</button></div></div></div>
${rows.length ? trackTable(rows, { queue: queueIds, remove: true, extraLabel: 'Date added', extraClass: 'date-added', extraCell: (_, i) => { const added = playlistSongAddedAt(state.playlistSongs[i] || {}); return added ? `<span title="${esc(new Date(added).toLocaleString())}">${esc(agoText(added))}</span>` : 'Recently'; } }) : `<div class="sw-playlist-empty"><h3>Let’s find something for your playlist</h3><p>Add songs from the suggestions below, or use the ••• menu on any song.</p></div>`}
<section class="sw-add-section"><div class="section-heading"><h2>Recommended</h2><button type="button" class="text-link" data-nav="music">Browse all music</button></div><div class="sw-song-results">${playlistSongSuggestions(available)}</div></section>
<dialog class="sw-modal edit-surface-dialog reference-edit-dialog" id="playlist-edit-dialog"><div class="edit-surface-head"><div><span class="eyebrow">PLAYLIST SETTINGS</span><h2>Edit playlist</h2><p>Update how this playlist appears to listeners.</p></div><button type="button" class="modal-close" data-close-modal aria-label="Close">${icon('close')}</button></div><form class="edit-surface-form" id="editplaylist"><div class="edit-surface-grid reference-edit-grid"><div class="edit-art-column"><label class="cover-drop edit-cover-drop reference-cover-card" for="editplcover"><span id="playlist-cover-preview">${cover}</span><span class="cover-change-badge">${icon('album')}</span><input id="editplcover" type="file" accept="image/jpeg,image/png,image/webp" hidden></label><button type="button" class="button secondary artwork-trigger" onclick="document.getElementById('editplcover')?.click()">${icon('upload')} Change artwork</button><small>JPG, PNG or WebP · up to 5 MB</small></div><div class="edit-fields"><label class="single-field">Playlist name<input id="editplname" maxlength="100" value="${esc(chosen.playlist_name)}" required><small class="char-counter" id="playlist-name-count">${String(chosen.playlist_name||'').length} / 100</small></label><label class="single-field">Description <span class="field-optional">Optional</span><textarea id="editpldesc" maxlength="300" placeholder="Describe this playlist">${esc(chosen.description || '')}</textarea><small class="char-counter" id="playlist-desc-count">${String(chosen.description||'').length} / 300</small></label><div class="single-field"><span>Visibility</span><div class="visibility-cards"><label class="visibility-card"><input type="radio" name="playlist_visibility_choice" value="Public" ${chosen.visibility === 'Public' ? 'checked' : ''}><span>${icon('users')}</span><strong>Public</strong><small>Anyone can discover and listen</small><i></i></label><label class="visibility-card"><input type="radio" name="playlist_visibility_choice" value="Private" ${chosen.visibility !== 'Public' ? 'checked' : ''}><span>${icon('lock')}</span><strong>Private</strong><small>Only you can access this playlist</small><i></i></label></div><select id="editplvis" hidden><option value="Private" ${chosen.visibility === 'Private' ? 'selected' : ''}>Private</option><option value="Public" ${chosen.visibility === 'Public' ? 'selected' : ''}>Public</option></select><small class="field-help">Public playlists must contain at least one song.</small></div></div></div><div class="dialog-actions edit-surface-actions"><button type="button" class="button secondary" data-close-modal>Cancel</button><button class="button" data-busy>Save changes</button></div></form></dialog>
<dialog class="sw-modal" id="playlist-collab-dialog"><div class="modal-head"><div><span class="eyebrow">PLAYLIST</span><h2>Collaborators</h2></div><button type="button" class="modal-close" data-close-modal aria-label="Close">${icon('close')}</button></div><div class="collab-list">${collab || '<p class="muted">No collaborators yet.</p>'}</div><div class="collab-invite"><h3>Invite with a link</h3><p class="muted">Create a one-time link and send it to the person you want to collaborate with. They only need to sign in and open the link.</p><button type="button" class="button" id="create-collab-link">${icon('users')} Copy invite link</button><p class="footnote">No UUID is exposed to the user. Invite links expire after 7 days and can be used once.</p></div></dialog>`, '', '');
  $('#editplcover')?.addEventListener('change',e=>{const file=e.target.files?.[0],preview=$('#playlist-cover-preview');if(!file||!preview)return;const url=URL.createObjectURL(file);preview.innerHTML=`<img class="cover-img" src="${esc(url)}" alt="Selected playlist cover">`;preview.querySelector('img')?.addEventListener('load',()=>URL.revokeObjectURL(url),{once:true});});
  document.querySelectorAll('input[name="playlist_visibility_choice"]').forEach(r=>r.addEventListener('change',()=>{const sel=$('#editplvis');if(sel)sel.value=r.value;}));
  const plName=$('#editplname'),plDesc=$('#editpldesc');
  plName?.addEventListener('input',()=>{const el=$('#playlist-name-count');if(el)el.textContent=`${plName.value.length} / 100`;});
  plDesc?.addEventListener('input',()=>{const el=$('#playlist-desc-count');if(el)el.textContent=`${plDesc.value.length} / 300`;});
  $('#editplaylist')?.addEventListener('submit', (e) => { e.preventDefault(); action(async () => { const playlistName=val('editplname'),nameProblem=plainNameProblem(playlistName,'Playlist name',100);if(nameProblem)throw Error(nameProblem);const visibility = val('editplvis'); if (visibility === 'Public' && !state.playlistSongs.length) throw Error('BR-017: Add at least one song before making this playlist public.'); let cover_path=chosen.cover_path||null;const cf=$('#editplcover')?.files?.[0];if(cf){if(!['image/jpeg','image/png','image/webp'].includes(cf.type))throw Error('Choose a JPEG, PNG or WebP cover.');if(cf.size>5*1048576)throw Error('Playlist artwork must be under 5 MB.');const ext=(cf.name.split('.').pop()||'jpg').toLowerCase();cover_path=`${state.user.id}/playlists/${state.selectedPlaylist}/cover.${ext}`;check(await db.storage.from('covers').upload(cover_path,cf,{upsert:true,contentType:cf.type}));}const updatePayload={p_playlist_id:Number(state.selectedPlaylist),p_name:playlistName,p_description:val('editpldesc')||null,p_visibility:visibility,p_cover_path:cover_path};const rpcUpdate=await db.rpc('update_my_playlist_details',updatePayload);if(rpcUpdate.error){check(await db.from('playlist').update({ playlist_name:updatePayload.p_name, description:updatePayload.p_description, visibility:updatePayload.p_visibility, cover_path:updatePayload.p_cover_path }).eq('playlist_id', state.selectedPlaylist).eq('user_id', state.user.id));}await loadData();await playlistDetail();toast('Playlist updated'); }); });
  $('#create-collab-link')?.addEventListener('click',()=>action(async()=>{const data=check(await db.rpc('create_playlist_invite',{p_playlist_id:state.selectedPlaylist}));const token=Array.isArray(data)?data[0]?.token:data?.token||data; if(!token)throw Error('Could not create invite link.');const url=`${location.origin}${location.pathname}?playlist_invite=${encodeURIComponent(token)}#/discover`;await navigator.clipboard.writeText(url);toast('Collaborator invite link copied');}));
  document.querySelectorAll('[data-collab-remove]').forEach((b) => b.onclick = () => action(async () => { check(await db.from('playlist_collaborator').delete().eq('playlist_id', state.selectedPlaylist).eq('user_id', b.dataset.collabRemove)); await playlistDetail(); toast('Collaborator removed'); }));
  $('#sw-more-menu')?.addEventListener('click', (e) => { e.stopPropagation(); const m = $('#sw-more-options'); m.hidden = !m.hidden; });
  $('#deactivate')?.addEventListener('click', () => { if (!confirm('Delete this playlist?')) return; action(async () => { check(await db.from('playlist').update({ is_active: false }).eq('playlist_id', state.selectedPlaylist).eq('user_id', state.user.id)); state.selectedPlaylist = null; state.playlistSongs = []; await loadData(); render(); toast('Playlist deleted'); }); });
  bindAddSong(); bindMusic();
}
function libraryOverview() {
  const liked = state.likesAvailable ? `<article class="release-tile card-link" tabindex="0" role="link" data-nav="liked-songs"><span class="release-art"><span class="placeholder-art large liked-cover">${icon('heart')}</span></span><strong>Liked Songs</strong><small data-liked-count>${state.liked.length} songs</small></article>` : '';
  const pls = state.playlists.map((p, i) => `<article class="release-tile card-link" tabindex="0" role="link" data-openplaylist="${p.playlist_id}"><span class="release-art">${p.cover_path&&state.coverUrls[p.cover_path]?`<img class="cover-img" src="${esc(state.coverUrls[p.cover_path])}" alt="">`:`<span class="placeholder-art large" style="background:${grad(i)}">${icon('music')}</span>`}</span><strong>${esc(p.playlist_name)}</strong><small>Playlist · ${esc(p.visibility)}</small></article>`).join('');
  const fav = state.artists.filter((a) => state.favorites.some((x) => x.artist_id === a.artist_id));
  state.tint = '#2d2d3d';
  shell(`<div class="section-heading"><h2>Playlists</h2></div><div class="shelf wrap"><article class="release-tile card-link create-tile" tabindex="0" role="button" data-create-playlist><span class="release-art"><span class="placeholder-art large">${icon('plus')}</span></span><strong>Create playlist</strong><small>Start a new collection</small></article>${liked}${pls}</div>${fav.length ? `<section class="shelf-section"><div class="section-heading"><h2>Artists you follow</h2></div><div class="shelf wrap">${fav.map(artistCard).join('')}</div></section>` : ''}`, 'Your Library', '');
}
function playlistSongSuggestions(songs){return songs.length?songs.map((s,i)=>`<div class="sw-suggest-row"><div class="sw-suggest-art" style="background:${grad(i)}">♫</div><span class="sw-suggest-meta"><strong>${escapeHtml(s.song_title)}</strong><small>${escapeHtml(s.album?.artist?.artist_name||'SoundWave')} · ${escapeHtml(s.album?.album_title||'Song')}</small></span><span class="sw-suggest-duration">${nice(s.duration_seconds)}</span><button type="button" class="sw-add-btn" data-addsong="${s.song_id}">＋ Add</button></div>`).join(''):'<p class="sw-no-match">Your playlist already contains the available songs.</p>';}
function bindAddSong(){document.querySelectorAll('[data-addsong]').forEach(b=>b.onclick=()=>action(async()=>{const song_id=Number(b.dataset.addsong);check(await db.from('playlist_song').insert({playlist_id:state.selectedPlaylist,song_id,track_order:null}));await playlistDetail();toast('Song added');}));document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>action(async()=>{const playlist=state.playlists.find(x=>x.playlist_id===state.selectedPlaylist);if(playlist?.visibility==='Public'&&state.playlistSongs.length<=1)throw Error('BR-017: Make the playlist Private before removing its last song.');check(await db.from('playlist_song').delete().eq('playlist_id',state.selectedPlaylist).eq('song_id',Number(b.dataset.remove)));await playlistDetail();toast('Song removed');}));}

function addToPlaylistDialog(){
 return `<dialog class="sw-modal playlist-picker" id="add-to-playlist-dialog"><div class="modal-head"><div><span class="eyebrow">ADD TO PLAYLIST</span><h2>Choose a playlist</h2></div><button class="modal-close" data-close-modal>${icon('close')}</button></div><div class="playlist-picker-list">${state.playlists.length?state.playlists.map((p,i)=>`<button data-pick-playlist="${p.playlist_id}"><span class="library-art" style="background:${grad(i)}">${icon('music')}</span><span><strong>${escapeHtml(p.playlist_name)}</strong><small>${escapeHtml(p.visibility)} playlist</small></span>${icon('plus')}</button>`).join(''):'<p class="muted">Create a playlist first.</p>'}</div></dialog>`;
}
function openAddToPlaylist(songId){
 state.songMenu=Number(songId);const d=$('#add-to-playlist-dialog');if(!d)return;d.showModal();
 document.querySelectorAll('[data-pick-playlist]').forEach(b=>b.onclick=()=>action(async()=>{check(await db.from('playlist_song').insert({playlist_id:Number(b.dataset.pickPlaylist),song_id:state.songMenu,track_order:null}));d.close();toast('Added to playlist');if(state.selectedPlaylist===Number(b.dataset.pickPlaylist))await playlistDetail();}));
}
function bindSongMenus() {
  document.querySelectorAll('[data-song-menu]').forEach((b) => b.onclick = (e) => {
    e.stopPropagation();
    const songId = Number(b.dataset.songMenu), song = songById(songId);
    document.querySelector('.song-action-popover')?.remove();
    const pop = document.createElement('div'); pop.className = 'song-action-popover';
    const downloaded = state.offlineDownloads.some((x)=>Number(x.songId)===songId);
    const downloadLabel = isPremiumUser()
      ? (downloaded ? 'Remove download' : 'Download')
      : 'Download · Premium';
    pop.innerHTML = `${state.likesAvailable ? `<button data-menu-like>${icon('heart')} ${isLiked(songId) ? 'Remove from Liked Songs' : 'Save to Liked Songs'}</button>` : ''}<button data-menu-queue>${icon('queue')} Add to queue</button><button data-menu-add>${icon('plus')} Add to playlist</button>${song?.album ? `<button data-menu-album>${icon('album')} Go to album</button>` : ''}<button data-menu-artist>${icon('users')} Go to artist</button><button data-menu-download>${icon('download')} ${downloadLabel}</button><button data-menu-share>${icon('forward')} Share</button>`;
    document.body.appendChild(pop);
    const r = b.getBoundingClientRect(), h = pop.offsetHeight || 260;
    pop.style.left = `${Math.max(8, Math.min(window.innerWidth - 250, r.left - 190))}px`;
    pop.style.top = `${Math.max(8, Math.min(window.innerHeight - h - 100, r.bottom + 6))}px`;
    const on = (sel, fn) => pop.querySelector(sel)?.addEventListener('click', () => { pop.remove(); fn(); });
    on('[data-menu-like]', () => action(() => toggleLike(songId)));
    on('[data-menu-queue]', () => addToQueue(songId));
    on('[data-menu-add]', () => openAddToPlaylist(songId));
    on('[data-menu-album]', () => navigate('album-detail', { selectedAlbum: Number(song.album.album_id) }));
    on('[data-menu-artist]', () => { const aid = song?.album?.artist?.artist_id; if (aid) navigate('artist-detail', { selectedArtist: Number(aid) }); });
    on('[data-menu-download]', () => action(async()=>{
      if(!isPremiumUser()){
        toast('Offline downloads are a Premium feature.');
        navigate('plans');
        return;
      }
      const downloaded=state.offlineDownloads.some((x)=>Number(x.songId)===songId);
      if(downloaded){
        await removeOfflineSong(songId);
        toast('Download removed');
      }else{
        await saveOfflineSong(song);
      }
      render();
    }));
    on('[data-menu-share]', async () => {
      const url = `${location.origin}${location.pathname}${song?.album ? `#/album-detail/${song.album.album_id}` : ''}`;
      const text = `${song?.song_title || 'SoundWave song'} — ${song?.album?.artist?.artist_name || 'SoundWave'}`;
      try { if (navigator.share) await navigator.share({ title: song?.song_title || 'SoundWave', text, url }); else { await navigator.clipboard.writeText(`${text} ${url}`); toast('Link copied'); } } catch {}
    });
  });
}
async function showDetail(){if(!state.selectedShow)return;const chosen=[...state.podcasts,...state.myShows].find(p=>Number(p.show_id)===Number(state.selectedShow));let q=db.from('podcast_episode').select('episode_id,show_id,episode_title,description,duration_seconds,audio_path,release_at,is_active').eq('show_id',state.selectedShow).order('release_at',{ascending:false});if(chosen?.user_id!==state.user.id)q=q.eq('is_active',true);const r=await q;if(r.error){state.episodes=[];toast(humanErr(r.error),true)}else state.episodes=r.data||[];render();}
function podcasts(){
 const chosen=[...state.podcasts,...state.myShows].find(p=>Number(p.show_id)===Number(state.selectedShow));
 state.tint='#2f4b56';
 if(chosen){
   const visibleEpisodes=state.episodes.filter(ep=>ep.is_active||chosen.user_id===state.user.id);
   const art=chosen.cover_path&&state.coverUrls[chosen.cover_path]?`<img class="cover-img" src="${esc(state.coverUrls[chosen.cover_path])}" alt="${esc(chosen.show_title)}">`:`<span class="placeholder-art large">${icon('mic')}</span>`;
   const episodeRows=visibleEpisodes.length?visibleEpisodes.map((ep,i)=>`<article class="podcast-episode-row ${ep.is_active?'':'inactive'}"><button type="button" class="podcast-episode-art" ${ep.is_active?`data-episode="${ep.episode_id}"`:''} aria-label="${ep.is_active?`Play ${esc(ep.episode_title)}`:`${esc(ep.episode_title)} is inactive`}">${chosen.cover_path&&state.coverUrls[chosen.cover_path]?`<img class="cover-img" src="${esc(state.coverUrls[chosen.cover_path])}" alt="">`:`<span class="placeholder-art large">${icon('mic')}</span>`}${ep.is_active?`<span class="episode-play-overlay">${icon('play')}</span>`:''}</button><div class="podcast-episode-copy"><span class="episode-number">Episode ${i+1}</span><strong>${escapeHtml(ep.episode_title)}</strong><p>${escapeHtml(ep.description||'No episode description yet.')}</p><div class="episode-meta"><span>${nice(ep.duration_seconds)}</span>${ep.release_at?`<span>${new Date(ep.release_at).toLocaleDateString()}</span>`:''}${ep.is_active?'':'<span>Inactive</span>'}</div>${episodeProgressHtml(ep)}</div>${ep.is_active?`<button type="button" class="episode-listen-btn" data-episode="${ep.episode_id}">${icon('play')}<span>Play</span></button>`:''}</article>`).join(''):`<div class="empty podcast-empty"><span>${icon('mic')}</span><h3>No episodes yet</h3><p>Episodes published for this show will appear here.</p></div>`;
   shell(`<section class="podcast-show-view"><button type="button" class="podcast-back" data-podcast-back>${icon('back')}<span>All podcasts</span></button><div class="podcast-show-hero"><div class="podcast-show-cover">${art}</div><div class="podcast-show-info"><span class="eyebrow">PODCAST</span><h2>${escapeHtml(chosen.show_title)}</h2><p class="podcast-show-category">${escapeHtml(chosen.category||'Podcast')}</p><p class="podcast-show-description">${escapeHtml(chosen.description||'Explore the latest episodes from this show.')}</p><div class="inline">${visibleEpisodes.some(ep=>ep.is_active)?`<button type="button" class="button podcast-play-latest" data-episode="${visibleEpisodes.find(ep=>ep.is_active)?.episode_id}">${icon('play')} Play latest</button>`:''}${chosen.user_id===state.user.id?'<button class="button secondary" data-nav="podcast-studio">Open in Podcast Studio</button>':''}</div></div></div><div class="podcast-episodes-head"><div><span class="eyebrow">EPISODES</span><h3>${visibleEpisodes.length} ${visibleEpisodes.length===1?'episode':'episodes'}</h3></div></div><div class="podcast-episode-list">${episodeRows}</div></section>`,'','');
   document.querySelector('[data-podcast-back]')?.addEventListener('click',()=>{state.selectedShow=null;navigate('podcasts');});
 }else{
   shell(`<div class="hero hero-podcast"><div><span class="eyebrow">STORIES WORTH HEARING</span><h2>Podcasts for every mood.</h2><p>Discover active shows and listen to the latest episodes.</p><button class="button secondary" data-nav="podcast-studio">${icon('upload')} Podcast Studio</button></div><div class="hero-art">${icon('mic')}</div></div><div class="section-heading"><h2>Explore shows</h2><button class="text-link" data-nav="podcast-studio">Manage your podcasts</button></div><div class="cover-grid podcast-show-grid">${state.podcasts.map((p,i)=>showCard(p,i)).join('')||'<div class="empty">No active shows published yet.</div>'}</div>`,'Podcasts','Discover shows. Publishing and management live in Podcast Studio.');
 }
 document.querySelectorAll('[data-episode]').forEach(b=>b.onclick=()=>action(async()=>{await requirePlaybackAccess();const ep=state.episodes.find(x=>String(x.episode_id)===b.dataset.episode);if(!ep?.audio_path)throw Error('Episode has no uploaded audio.');const u=check(await db.storage.from('podcast-audio').createSignedUrl(ep.audio_path,3600));startPlayer({kind:'podcast',id:ep.episode_id,title:ep.episode_title,artist:chosen?.show_title||'SoundWave podcasts',url:u.signedUrl,duration:ep.duration_seconds,resumeAt:Number(state.podcastHistory.find(h=>String(h.episode_id)===String(ep.episode_id)&&Number(h.resume_position_seconds)>5)?.resume_position_seconds)||0});}));
}

function podcastStudioAnalytics(){
  const ownShowIds=new Set((state.myShows||[]).map(p=>Number(p.show_id)));
  const ownEpisodes=(state.episodes||[]).filter(ep=>ownShowIds.has(Number(ep.show_id)));
  const epMap=new Map(ownEpisodes.map(ep=>[Number(ep.episode_id),ep]));
  const qualified=(state.podcastStudioHistory||[]).filter(r=>epMap.has(Number(r.episode_id))&&isQualifiedPodcastStream(r));
  const byEpisode=new Map(),byShow=new Map(),days=Array(30).fill(0),listeners=new Set();
  let seconds=0,completed=0;
  for(const r of qualified){
    const eid=Number(r.episode_id),ep=epMap.get(eid);if(!ep)continue;
    const sid=Number(ep.show_id);
    byEpisode.set(eid,(byEpisode.get(eid)||0)+1);
    byShow.set(sid,(byShow.get(sid)||0)+1);
    seconds+=Number(r.duration_played_seconds)||0;
    if(String(r.completion_status||'').toLowerCase()==='completed')completed++;
    if(r.user_id)listeners.add(String(r.user_id));
    const diff=Math.floor((Date.now()-new Date(r.stream_date).getTime())/86400000);if(diff>=0&&diff<30)days[29-diff]++;
  }
  const topEpisodes=[...byEpisode.entries()].map(([id,value])=>({id,name:epMap.get(id)?.episode_title||`Episode ${id}`,value})).sort((a,b)=>b.value-a.value);
  const topShows=[...byShow.entries()].map(([id,value])=>({id,name:(state.myShows||[]).find(s=>Number(s.show_id)===id)?.show_title||`Show ${id}`,value})).sort((a,b)=>b.value-a.value);
  return {qualified,total:qualified.length,unique:listeners.size,minutes:Math.round(seconds/60),completionRate:qualified.length?Math.round((completed/qualified.length)*100):0,days,topEpisodes,topShows};
}

function podcastStudio(){
 const studioRole=hasAdminAccess()?(hasArtistAccess()?'artist-admin':'admin'):'artist';
 const activeShows=state.myShows.filter(p=>p.is_active);
 const ownShowIds=new Set(state.myShows.map(p=>Number(p.show_id)));
 const ownEpisodes=state.episodes.filter(ep=>ownShowIds.has(Number(ep.show_id)));
 const activeEpisodes=ownEpisodes.filter(ep=>ep.is_active!==false).length;
 const metrics=podcastStudioAnalytics();
 const totalListens=metrics.total;
 const showCards=state.myShows.map((p,i)=>{const listens=metrics.topShows.find(x=>Number(x.id)===Number(p.show_id))?.value||0;const eps=ownEpisodes.filter(ep=>Number(ep.show_id)===Number(p.show_id)).length;return `<article class="podcast-studio-card">${eps===0?`<span class="status-pill draft">Draft · 0 episodes</span>`:''}<div class="podcast-card-art-wrap"><div class="podcast-card-art" style="background:${grad(i)}">${p.cover_path&&state.coverUrls[p.cover_path]?`<img class="cover-img" src="${esc(state.coverUrls[p.cover_path])}" alt="${esc(p.show_title)}" loading="lazy">`:icon('mic')}</div><span class="podcast-card-state status-pill ${p.is_active?'active':'inactive'}">${p.is_active?'Active':'Inactive'}</span></div><div class="podcast-card-copy"><span class="podcast-card-category">${esc(p.category||'Podcast')}</span><strong class="podcast-card-title">${esc(p.show_title)}</strong><p>${esc(p.description||'No description yet. Add a short description so listeners know what your show is about.')}</p><div class="podcast-card-metrics"><span><b>${listens}</b> listens</span><span><b>${eps}</b> episodes</span></div></div><div class="card-actions podcast-card-actions"><button type="button" class="button secondary sm" data-podcast-catalog-show="${p.show_id}">${icon('play')}<span>Episodes</span></button><button class="button secondary sm" data-studio-show="${p.show_id}" aria-label="Edit ${esc(p.show_title)}">${icon('settings')} <span>Edit show</span></button><button class="button secondary sm ${p.is_active?'danger-soft':''}" data-show-active="${p.show_id}" data-active="${p.is_active?'false':'true'}" aria-label="${p.is_active?'Deactivate':'Restore'} ${esc(p.show_title)}">${p.is_active?'Deactivate':'Restore'}</button></div></article>`}).join('');
 shell(`<section class="workspace-hero podcast-studio-hero podcast-studio-hero--${studioRole}" data-studio-role="${studioRole}"><div><span class="eyebrow">${studioRole==='admin'?'MODERATOR WORKSPACE':studioRole==='artist-admin'?'CREATOR + MODERATOR WORKSPACE':'CREATOR WORKSPACE'}</span><h2>Podcast Studio</h2><p>${studioRole==='admin'?'Oversee podcast catalog status and performance.':'Publish, manage and understand your podcast catalog with separate focused views.'}</p><div class="inline"><button class="button hero-cta" data-open-modal="create-show-dialog">${icon('plus')} Create show</button><button class="button secondary" data-open-modal="publish-episode-dialog" ${!activeShows.length?'disabled':''}>${icon('upload')} Publish episode</button></div></div><span class="hero-vinyl">${icon('mic')}</span></section>
 <nav class="creator-view-tabs" aria-label="Podcast Studio views"><button class="${state.podcastStudioView==='overview'?'active':''}" data-podcast-studio-view-btn="overview">Overview</button><button class="${state.podcastStudioView==='analytics'?'active':''}" data-podcast-studio-view-btn="analytics">Analytics</button><button class="${state.podcastStudioView==='shows'?'active':''}" data-podcast-studio-view-btn="shows">Shows</button><button class="${state.podcastStudioView==='publish'?'active':''}" data-podcast-studio-view-btn="publish">Publish</button></nav>
 <section class="creator-view-block" data-podcast-studio-view="overview" ${state.podcastStudioView!=='overview'?'hidden':''}><section class="studio-stat-strip four podcast-kpis"><button type="button" data-podcast-open="shows"><small>Shows</small><strong data-count="${state.myShows.length}">${state.myShows.length}</strong><span>Your podcast catalog</span></button><button type="button" data-podcast-open="shows"><small>Active episodes</small><strong data-count="${activeEpisodes}">${activeEpisodes}</strong><span>Currently available</span></button><button type="button" data-podcast-open="analytics"><small>Qualified listens</small><strong data-count="${totalListens}">${totalListens}</strong><span>30s+ or completed</span></button><button type="button" data-podcast-open="analytics"><small>Unique listeners</small><strong data-count="${metrics.unique}">${metrics.unique}</strong><span>${metrics.minutes} minutes listened</span></button></section><div class="creator-summary-grid"><article><span class="eyebrow">PUBLISH</span><h3>Keep your show active</h3><p>Create a show or publish a new episode from one dedicated workspace.</p><button class="button secondary" data-podcast-open="publish">Open publishing</button></article><article><span class="eyebrow">PERFORMANCE</span><h3>${metrics.total} qualified listens</h3><p>See listening trend, top episodes and completion rate without catalog controls in the way.</p><button class="button secondary" data-podcast-open="analytics">View analytics</button></article><article><span class="eyebrow">CATALOG</span><h3>${state.myShows.length} shows</h3><p>Edit show information and availability from the Shows view.</p><button class="button secondary" data-podcast-open="shows">Manage shows</button></article></div></section>
 <section class="creator-view-block" data-podcast-studio-view="analytics" ${state.podcastStudioView!=='analytics'?'hidden':''}><section class="analytics-suite podcast-analytics-suite"><div class="section-heading"><div><span class="eyebrow">PERFORMANCE</span><h2>Podcast analytics</h2></div><span class="muted small">Last 30 days · qualified listens</span></div><div class="chart-grid"><article class="chart-card chart-wide"><div class="chart-head"><div><small>Listen trend</small><strong>${metrics.total}</strong></div><span>30 days</span></div>${sparkline(metrics.days)}</article><article class="chart-card"><div class="chart-head"><div><small>Top episodes</small><strong class="chart-title">${esc(metrics.topEpisodes[0]?.name||'No listens yet')}</strong></div><span>${metrics.topEpisodes[0]?.value||0} plays</span></div>${chartBars(metrics.topEpisodes)}</article><article class="chart-card"><div class="chart-head"><div><small>Listens by show</small><strong>${metrics.topShows.length}</strong></div><span>shows</span></div>${chartBars(metrics.topShows)}</article><article class="chart-card podcast-completion-card"><div class="chart-head"><div><small>Completion rate</small><strong>${metrics.completionRate}%</strong></div><span>${metrics.unique} listeners</span></div><div class="metric-ring" style="--metric:${metrics.completionRate}"><span>${metrics.completionRate}%</span><small>completed</small></div></article></div></section></section>
 <section class="creator-view-block" data-podcast-studio-view="shows" ${state.podcastStudioView!=='shows'?'hidden':''}><div class="section-heading"><div><span class="eyebrow">YOUR SHOWS</span><h2>Manage your podcasts</h2></div><button class="text-link" data-nav="podcasts">Explore podcasts</button></div><div class="podcast-studio-grid podcast-catalog-rail">${showCards||`<div class="empty studio-empty"><span>${icon('mic')}</span><h3>Start your first show</h3><p>Create a show, add cover art, then publish your first episode.</p><button class="button" data-open-modal="create-show-dialog">${icon('plus')} Create show</button></div>`}</div><section class="podcast-catalog-episodes" aria-label="Episodes in selected show"><div class="section-heading"><div><span class="eyebrow">PODCAST EPISODES</span><h2>${esc(state.myShows.find(p=>Number(p.show_id)===Number(state.selectedPodcastStudioShow))?.show_title||'Select a podcast show')}</h2><p class="muted small">Episodes belong to a podcast show. Music releases are managed separately in Artist Studio.</p></div><button class="button sm" type="button" data-open-modal="publish-episode-dialog">${icon('upload')} Publish episode</button></div>${state.selectedPodcastStudioShow?ownEpisodes.filter(ep=>Number(ep.show_id)===Number(state.selectedPodcastStudioShow)).map(ep=>`<article class="podcast-episode-catalog-row"><span class="podcast-episode-icon">${icon('mic')}</span><div><strong>${esc(ep.episode_title||'Untitled episode')}</strong><small>${nice(ep.duration_seconds)} · ${ep.is_active===false?'Inactive':'Active'} · Podcast episode</small></div></article>`).join('')||'<div class="empty compact-empty">No episodes yet. Publish the first episode to make this show discoverable.</div>':'<div class="empty compact-empty">Choose a show above to inspect its episodes.</div>'}</section></section>
 <section class="creator-view-block" data-podcast-studio-view="publish" ${state.podcastStudioView!=='publish'?'hidden':''}><div class="section-heading"><div><span class="eyebrow">PUBLISH</span><h2>Creation tools</h2></div></div><div class="creator-summary-grid publish-grid"><article><span class="studio-action-art gradient-one">${icon('mic')}</span><h3>Create a show</h3><p>Set the title, category, description and cover art for a new podcast.</p><button class="button" data-open-modal="create-show-dialog">${icon('plus')} Create show</button></article><article><span class="studio-action-art gradient-two">${icon('upload')}</span><h3>Publish an episode</h3><p>Choose a show, upload audio and add episode details through the guided workflow.</p><button class="button" data-open-modal="publish-episode-dialog" ${!activeShows.length?'disabled':''}>${icon('upload')} Publish episode</button></article></div></section>
<dialog class="sw-modal creator-dialog release-create-dialog upload-surface-dialog" id="create-show-dialog"><div class="release-dialog-head"><div><span class="eyebrow">NEW SHOW</span><h2>Create a podcast show</h2><p>Set the artwork, title and category listeners will discover in SoundWave Podcasts.</p></div><button type="button" class="modal-close" data-close-modal aria-label="Close create show dialog">${icon('close')}</button></div><form id="showform" class="release-create-form upload-surface-form"><div class="release-create-grid upload-surface-grid"><div class="release-art-panel"><label class="cover-drop creator-cover-drop release-cover-drop" for="showcover"><span id="show-cover-preview">${icon('mic')}</span><strong>Choose show artwork</strong><small>Square JPG, PNG or WebP · up to 5 MB</small><em>Recommended: 1400 × 1400</em><input id="showcover" type="file" accept="image/png,image/jpeg,image/webp" hidden></label><div class="release-art-tip"><strong>Show artwork tips</strong><span>Use a bold square image that represents the show. Avoid screenshots and text that is too small to read.</span></div></div><div class="release-meta-panel"><label class="single-field release-title-field">Show title<input id="showtitle" maxlength="140" required placeholder="e.g. Midnight Tech Talk" autocomplete="off"><small class="field-help">Use a real show title. Placeholder or random text is blocked.</small><small class="field-help availability" id="show-title-status"></small></label><label class="single-field">Category<input id="showcategory" maxlength="60" placeholder="Technology, Life, Education"></label><label class="single-field">Description <span class="field-optional">Optional</span><textarea id="showdesc" maxlength="1600" placeholder="What is this show about?"></textarea></label></div></div><div class="release-form-note">After creating the show, you can immediately publish your first episode from Podcast Studio.</div><div class="dialog-actions release-dialog-actions"><button type="button" class="button secondary" data-close-modal>Cancel</button><button class="button" data-busy>Create show</button></div></form></dialog>
<dialog class="sw-modal edit-surface-dialog" id="edit-show-dialog"><div class="edit-surface-head"><div><span class="eyebrow">PODCAST STUDIO</span><h2>Edit show</h2><p>Keep your show identity and discovery information up to date.</p></div><button type="button" class="modal-close" data-close-modal aria-label="Close edit show dialog">${icon('close')}</button></div><form id="editshow" class="edit-surface-form"><input type="hidden" id="editshowid"><div class="edit-surface-grid"><label class="cover-drop edit-cover-drop" for="editshowcover"><span id="edit-show-cover-preview">${icon('mic')}</span><strong>Show artwork</strong><small>Leave unchanged to keep the current image</small><input id="editshowcover" type="file" accept="image/png,image/jpeg,image/webp" hidden></label><div class="edit-fields"><label class="single-field">Show title<input id="editshowtitle" required maxlength="140"></label><label class="single-field">Category<input id="editshowcategory" maxlength="60"></label><label class="single-field">Description <span class="field-optional">Optional</span><textarea id="editshowdesc" maxlength="1600"></textarea></label></div></div><div class="dialog-actions edit-surface-actions"><button type="button" class="button secondary" data-close-modal>Cancel</button><button class="button">Save changes</button></div></form></dialog>
<dialog class="sw-modal studio-dialog wizard-dialog creator-dialog upload-wizard-dialog" id="publish-episode-dialog"><div class="upload-hero-strip podcast"><span>${icon('mic')}</span><div><small>PODCAST UPLOAD</small><strong>Publish a polished episode</strong></div></div><div class="modal-head"><div><span class="eyebrow wizard-eyebrow">STEP 1 OF 3</span><h2>Publish an episode</h2></div><button type="button" class="modal-close" data-close-modal aria-label="Close publish episode dialog">${icon('close')}</button></div><form id="episodeform">${wizardNav(['Show','Audio','Details'])}<section class="upload-step" data-step="1"><div class="step-icon">${icon('mic')}</div><h3>Choose a show</h3><p class="step-desc">Episodes are published into one of your active podcast shows.</p>${activeShows.length?`<label class="single-field">Your show<select id="epshow" required>${opts(activeShows,'show_id','show_title')}</select><small class="field-help">Select the show where this episode should appear.</small></label>`:'<p class="notice">Create and activate a show first.</p>'}</section><section class="upload-step" data-step="2" hidden><div class="step-icon">${icon('upload')}</div><h3>Add your audio file</h3><p class="step-desc">Upload the final exported episode file that listeners will stream.</p>${audioDropHtml('ep')}</section><section class="upload-step" data-step="3" hidden><div class="step-icon">${icon('settings')}</div><h3>Episode details</h3><p class="step-desc">Confirm the listener-facing title and optional description before publishing.</p><label class="single-field">Episode title<input id="eptitle" maxlength="140" required placeholder="e.g. Episode 12: Building Better Habits"></label><label class="single-field">Description<textarea id="epdesc" maxlength="1600" placeholder="What is this episode about?"></textarea></label><div id="ep-final"></div></section><div class="dialog-actions"><button type="button" class="button secondary wiz-back" hidden>Back</button><button type="button" class="button wiz-next" ${activeShows.length?'':'disabled'}>Continue</button><button type="submit" class="button wiz-finish" data-busy hidden>Publish episode</button></div></form></dialog>`,'Podcast Studio','Create shows, publish episodes and manage availability.');
 const setPodcastStudioView=(view)=>{if(view==='shows'&&!state.selectedPodcastStudioShow&&state.myShows.length)state.selectedPodcastStudioShow=Number(state.myShows[0].show_id);state.podcastStudioView=view;document.querySelectorAll('[data-podcast-studio-view-btn]').forEach(b=>b.classList.toggle('active',b.dataset.podcastStudioViewBtn===view));document.querySelectorAll('[data-podcast-studio-view]').forEach(s=>s.hidden=s.dataset.podcastStudioView!==view);};
 document.querySelectorAll('[data-podcast-studio-view-btn]').forEach(b=>b.onclick=()=>setPodcastStudioView(b.dataset.podcastStudioViewBtn));
 document.querySelectorAll('[data-podcast-open]').forEach(b=>b.onclick=()=>setPodcastStudioView(b.dataset.podcastOpen));
 const previewFile=(inputId,previewId)=>{const inp=$(inputId),preview=$(previewId);if(!inp||!preview)return;inp.onchange=e=>{const f=e.target.files?.[0];if(!f)return;const u=URL.createObjectURL(f);preview.innerHTML=`<img class="cover-img" src="${esc(u)}" alt="Selected cover">`;preview.querySelector('img')?.addEventListener('load',()=>URL.revokeObjectURL(u),{once:true});};};
 previewFile('#showcover','#show-cover-preview');previewFile('#editshowcover','#edit-show-cover-preview');
 document.querySelectorAll('[data-view-show]').forEach(b=>b.onclick=()=>openShow(b.dataset.viewShow));
 document.querySelectorAll('[data-podcast-catalog-show]').forEach(b=>b.onclick=()=>{state.selectedPodcastStudioShow=Number(b.dataset.podcastCatalogShow);render();});
 document.querySelectorAll('[data-studio-show]').forEach(b=>b.onclick=()=>{const p=state.myShows.find(x=>Number(x.show_id)===Number(b.dataset.studioShow));if(!p)return;$('#editshowid').value=p.show_id;$('#editshowtitle').value=p.show_title||'';$('#editshowcategory').value=p.category||'';$('#editshowdesc').value=p.description||'';$('#edit-show-cover-preview').innerHTML=p.cover_path&&state.coverUrls[p.cover_path]?`<img class="cover-img" src="${esc(state.coverUrls[p.cover_path])}" alt="">`:icon('mic');$('#edit-show-dialog').showModal();});
 document.querySelectorAll('[data-show-active]').forEach(b=>b.onclick=()=>action(async()=>{const active=b.dataset.active==='true';check(await db.rpc('set_my_podcast_show_active',{p_show_id:Number(b.dataset.showActive),p_active:active}));await loadData();render();toast(active?'Podcast show restored':'Podcast show deactivated with its episodes');}));
 $('#showform').onsubmit=e=>{e.preventDefault();action(async()=>{const titleProblem=contentTitleProblem($('#showtitle')?.value,'Show title',140);if(titleProblem)throw Error(titleProblem);if(!(await checkShowTitleAvailability($('#showtitle')?.value)))throw Error('You already have a podcast show with this title. Choose a different title.');let cover_path=null;const file=$('#showcover')?.files?.[0];if(file){if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('Choose a JPEG, PNG or WebP cover.');if(file.size>5*1048576)throw Error('Podcast artwork must be under 5 MB.');const ext=(file.name.split('.').pop()||'jpg').toLowerCase();cover_path=`${state.user.id}/podcasts/${crypto.randomUUID()}.${ext}`;check(await db.storage.from('covers').upload(cover_path,file,{upsert:false,contentType:file.type}));}try{check(await db.from('podcast_show').insert({user_id:state.user.id,show_title:normalizedContentTitle(val('showtitle')),category:val('showcategory')||null,description:val('showdesc')||null,cover_path,is_active:true}));}catch(err){if(cover_path)await db.storage.from('covers').remove([cover_path]);throw err;}await loadData();state.podcastStudioView='shows';render();toast('Podcast show created');});};
 $('#editshow').onsubmit=e=>{e.preventDefault();action(async()=>{const show_id=Number(val('editshowid'));const existing=state.myShows.find(x=>Number(x.show_id)===show_id);if(!existing)throw Error('Podcast show not found.');const showTitle=val('editshowtitle'),titleProblem=contentTitleProblem(showTitle,'Show title',140);if(titleProblem)throw Error(titleProblem);if(!(await checkShowTitleAvailability(showTitle,show_id)))throw Error('You already have a podcast show with this title. Choose a different title.');let cover_path=existing.cover_path||null,newPath=null;const file=$('#editshowcover')?.files?.[0];try{if(file){if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('Choose a JPEG, PNG or WebP cover.');if(file.size>5*1048576)throw Error('Podcast artwork must be under 5 MB.');const ext=(file.name.split('.').pop()||'jpg').toLowerCase();newPath=`${state.user.id}/podcasts/${crypto.randomUUID()}.${ext}`;check(await db.storage.from('covers').upload(newPath,file,{upsert:false,contentType:file.type}));cover_path=newPath;}check(await db.from('podcast_show').update({show_title:normalizedContentTitle(showTitle),category:val('editshowcategory')||null,description:val('editshowdesc')||null,cover_path}).eq('show_id',show_id).eq('user_id',state.user.id));if(newPath&&existing.cover_path&&existing.cover_path!==newPath)await db.storage.from('covers').remove([existing.cover_path]);}catch(err){if(newPath)await db.storage.from('covers').remove([newPath]);throw err;}$('#edit-show-dialog').close();await loadData();state.podcastStudioView='shows';render();toast('Podcast show updated');});};
 bindAudioDrop('ep');
 const epForm=$('#episodeform');
 const epWiz=bindWizard(epForm,{validate:(st)=>{if(st===1&&!val('epshow'))return 'Choose one of your shows first.';if(st===2){const f=$('#ep-file').files?.[0];if(!f)return 'Choose your audio file first.';return audioProblem(f);}return '';}});
 epForm.addEventListener('wizardstep',e=>{if(e.detail!==3)return;const f=$('#ep-file').files?.[0];const sel=$('#epshow');$('#ep-final').innerHTML=summaryHtml([['Show',sel?.selectedOptions?.[0]?.textContent],['File',f?.name],['Size',f?`${(f.size/1048576).toFixed(2)} MB`:'']]);});
 epForm.onsubmit=e=>{e.preventDefault();action(async()=>{if(epWiz.step!==3)throw Error('Complete the upload steps first.');const show_id=Number(val('epshow'));if(!state.myShows.some(p=>Number(p.show_id)===show_id&&p.is_active))throw Error('Select an active show that you own.');const file=$('#ep-file').files?.[0];if(!file)throw Error('Choose an audio file.');const bad=audioProblem(file);if(bad)throw Error(bad);const epTitleProblem=contentTitleProblem($('#eptitle')?.value,'Episode title',140);if(epTitleProblem)throw Error(epTitleProblem);const duration_seconds=await audioDuration(file);if(!(duration_seconds>0))throw Error('Audio metadata is unavailable.');const safe=file.name.replace(/[^a-z0-9._-]/gi,'_').slice(-80);const path=`${state.user.id}/episodes/${crypto.randomUUID()}_${safe}`;const fin=epForm.querySelector('.wiz-finish');setPublishing(fin,true,'Publish episode');try{check(await db.storage.from('podcast-audio').upload(path,file,{upsert:false,contentType:file.type||'audio/mpeg'}));try{check(await db.from('podcast_episode').insert({show_id,episode_title:normalizedContentTitle($('#eptitle')?.value),description:val('epdesc')||null,duration_seconds,audio_path:path,release_at:new Date().toISOString(),is_active:true}));}catch(err){await db.storage.from('podcast-audio').remove([path]);throw err;}}finally{setPublishing(fin,false,'Publish episode');}await loadData();state.podcastStudioView='shows';render();toast('Episode published');});};
}

// ---------- Listening history ----------
const agoText = (d) => { const t = new Date(d).getTime(); if (!t) return ''; const sec = Math.max(0, (Date.now() - t) / 1000); if (sec < 60) return 'Just now'; if (sec < 3600) return `${Math.floor(sec / 60)} min ago`; if (sec < 86400) return `${Math.floor(sec / 3600)} hr ago`; if (sec < 604800) return `${Math.floor(sec / 86400)} d ago`; return new Date(t).toLocaleDateString(); };

const compactNumber = (n) => {
  const num = Number(n) || 0;
  try { return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(num); }
  catch { return String(num); }
};
const playlistSongAddedAt = (row = {}) => row.date_added || row.created_at || row.inserted_at || null;
function songVisibleStreamCount(songId) {
  const sid = Number(songId);
  const total = Number(state.albumStreamCounts?.[sid]);
  if (Number.isFinite(total)) return total;
  const source = hasAdminAccess() ? (state.adminAnalyticsHistory || []) : hasArtistAccess() ? (state.artistThirtyDay || []) : [];
  return source.reduce((count, row) => count + (Number(row?.song_id) === sid ? 1 : 0), 0);
}
async function ensureAlbumStreamCounts(album) {
  if (!album?.songs?.length) return;
  const ids = album.songs.map((s) => Number(s.song_id)).filter(Boolean);
  if (!ids.length || state.albumStreamLoading[album.album_id]) return;
  const missing = ids.filter((id) => state.albumStreamCounts[id] == null);
  if (!missing.length) return;
  state.albumStreamLoading[album.album_id] = true;
  try {
    const rows = [];
    if (hasAdminAccess() || hasArtistAccess()) {
      const serverRows = hasAdminAccess() ? await fetchAdminServerStreams(36500) : await fetchArtistServerStreams(36500);
      // Album stream totals also use only the server analytics RPC. Falling back to
      // a device-visible RLS query can make phone and desktop totals disagree.
      if(serverRows) rows.push(...serverRows.filter(r=>missing.includes(Number(r.song_id))));
      const counts = { ...(state.albumStreamCounts || {}) };
      for (const id of missing) counts[id] = 0;
      for (const row of rows) {
        if (!isQualifiedStream(row)) continue;
        const id = Number(row.song_id);
        if (counts[id] == null) counts[id] = 0;
        counts[id] += 1;
      }
      state.albumStreamCounts = counts;
      if (state.page === 'album-detail' && Number(state.selectedAlbum) === Number(album.album_id)) render();
    }
  } catch (e) { console.warn('Could not load album stream counts', e); }
  finally { state.albumStreamLoading[album.album_id] = false; }
}
let _histFetchAt = 0;
async function refreshHistory(force = false) {
  if (!state.user || !configured) return;
  if (!force && Date.now() - _histFetchAt < 1500) return;
  _histFetchAt = Date.now();
  const uid = state.user.id;
  const cachedMusic = readCachedHistory(uid), cachedPodcasts = readCachedPodcastHistory(uid);
  state.episodeTitles = { ...readCachedEpisodeTitles(uid), ...(state.episodeTitles || {}) };
  const [m, p] = await Promise.all([
    db.from('listening_history').select('stream_id,song_id,stream_date,duration_played_seconds,completion_status').eq('user_id', uid).order('stream_date', { ascending: false }).limit(50),
    db.from('podcast_listening_history').select('podcast_stream_id,episode_id,stream_date,duration_played_seconds,resume_position_seconds,completion_status').eq('user_id', uid).order('stream_date', { ascending: false }).limit(30)
  ]);
  state.historyError = m.error && !cachedMusic.length && !(state.history||[]).length ? humanErr(m.error) : '';
  if (m.error) console.warn('Could not refresh listening history', m.error);
  const before = JSON.stringify([state.history, state.podcastHistory, state.episodeTitles, state.historyError]);
  state.history = m.error ? cachedMusic : mergeStreamHistory(m.data || [], cachedMusic);
  state.podcastHistory = p.error ? cachedPodcasts : mergePodcastHistory(p.data || [], cachedPodcasts);
  const missing = [...new Set(state.podcastHistory.map((r) => r.episode_id))].filter((id) => !state.episodeTitles[id]);
  if (missing.length) {
    const e = await db.from('podcast_episode').select('episode_id,episode_title').in('episode_id', missing);
    if (!e.error) (e.data || []).forEach((x) => { state.episodeTitles[x.episode_id] = x.episode_title; });
  }
  persistHistoryCache();
  if (state.page === 'history' && before !== JSON.stringify([state.history, state.podcastHistory, state.episodeTitles, state.historyError])) render();
}
function historyTable(rows) {
  const q = [...new Set(rows.map((x) => x.s.song_id))].join(',');
  return `<div class="tracks history-tracks" role="table"><div class="tracks-head" role="row"><span class="t-num">#</span><span>Title</span><span class="t-album">Played</span><span class="t-like"></span><span class="t-time" title="Duration">${icon('clock')}</span><span class="t-more"></span></div>${rows.map(({ r, s }, i) => trackRow(s, i, q, { showAlbum: true, histId: r.stream_id, albumHtml: `<span title="${esc(new Date(r.stream_date).toLocaleString())}">${esc(agoText(r.stream_date))}${r.duration_played_seconds ? ` · ${nice(r.duration_played_seconds)} listened` : ''}</span>` })).join('')}</div>`;
}
function history() {
  const rows = state.history.map((r) => ({ r, s: songById(r.song_id) })).filter((x) => x.s);
  const notice = state.historyWriteError ? `<div class="notice">Your plays are not being saved: ${esc(state.historyWriteError)}. Run <code>sql/RUN_ME_listening_history.sql</code> once in the Supabase SQL Editor, then play a song again.</div>` : state.historyError ? `<div class="notice">Could not load your history: ${esc(state.historyError)}</div>` : '';
  const pod = state.podcastHistory.length ? `<div class="history-toolbar"><span>${state.podcastHistory.length} podcast ${state.podcastHistory.length===1?'entry':'entries'}</span><button type="button" class="button danger sm" id="clear-podcast-history">Remove all</button></div><div class="songlist podcast-history-list">${state.podcastHistory.map((r, i) => `<div class="songrow"><div class="songicon" style="background:${grad(i + 2)}">${icon('mic')}</div><div class="grow"><strong>${esc(state.episodeTitles[r.episode_id] || `Episode #${r.episode_id}`)}</strong><small>${esc(r.completion_status || 'Partial')} · ${nice(r.duration_played_seconds)} listened · ${esc(agoText(r.stream_date))}</small></div><button class="button secondary sm" data-poddelete="${r.podcast_stream_id}">Remove</button></div>`).join('')}</div>` : '<div class="empty">No podcast history yet.</div>';
  shell(`${notice}<div class="section-heading"><h2>Recently played</h2></div>${rows.length ? historyTable(rows) : '<div class="empty">No music history yet. Play a song to start tracking your activity.</div>'}<div class="section-heading"><h2>Podcast listening</h2></div>${pod}`, 'Listening history', 'Your recent listening, newest first.');
  document.querySelectorAll('[data-histdelete]').forEach((b) => b.onclick = (e) => { e.stopPropagation(); action(async () => { check(await db.from('listening_history').delete().eq('stream_id', Number(b.dataset.histdelete)).eq('user_id', state.user.id)); state.history = state.history.filter((x) => String(x.stream_id) !== b.dataset.histdelete); persistHistoryCache(); render(); toast('Removed from history'); }); });
  document.querySelectorAll('[data-poddelete]').forEach((b) => b.onclick = () => action(async () => { const id=Number(b.dataset.poddelete);const rpc=await db.rpc('delete_my_podcast_history',{p_podcast_stream_id:id,p_delete_all:false});if(rpc.error){check(await db.from('podcast_listening_history').delete().eq('podcast_stream_id',id).eq('user_id',state.user.id));}state.podcastHistory=state.podcastHistory.filter((x)=>Number(x.podcast_stream_id)!==id);persistHistoryCache();render();toast('Podcast history entry removed'); }));
  $('#clear-podcast-history')?.addEventListener('click',()=>{if(!confirm('Remove all podcast listening history?'))return;action(async()=>{const rpc=await db.rpc('delete_my_podcast_history',{p_podcast_stream_id:null,p_delete_all:true});if(rpc.error){check(await db.from('podcast_listening_history').delete().eq('user_id',state.user.id));}state.podcastHistory=[];writeLocalJson(localKey('podcast-history'),[]);persistHistoryCache();render();toast('Podcast history cleared');});});
}
function plans(){
 const ent=state.entitlement;
 const current=ent && String(ent.status||'Active').toLowerCase()==='active' ? ent : null;
 const relationship=(current?.relationship||'Owner');
 const currentPlan=state.plans.find(p=>String(p.plan_id)===String(current?.plan_id)) || null;
 const maxMembers=Number(current?.max_members||currentPlan?.max_members||1);
 const ownedMembers=current?.subscription_id?state.subscriptionMembers.filter(m=>String(m.subscription_id)===String(current.subscription_id)&&String(m.user_id)!==String(current.owner_user_id||state.user?.id)):[];
 const isPlanOwner=String(relationship).toLowerCase()==='owner';
 const usedSeats=Math.min(maxMembers,1+ownedMembers.length);
 const availableSeats=Math.max(0,maxMembers-usedSeats);
 const ownerId=current?.owner_user_id||state.user?.id;
 const memberCards=[`<div class="subscription-member-chip owner"><span class="member-avatar">${esc(String(ownerId||'O').slice(0,1).toUpperCase())}</span><span><strong>${isPlanOwner?'You':'Plan owner'}</strong><small>Owner</small></span></div>`];
 ownedMembers.forEach((m,i)=>{const memberLabel=String(m.user_id)===String(state.user?.id)?'You':('Member '+(i+1));const removeButton=isPlanOwner&&String(m.user_id)!==String(state.user?.id)?`<button type="button" class="icon-quiet" data-remove-sub-member="${esc(m.user_id)}" title="Remove member">${icon('close')}</button>`:'';memberCards.push(`<div class="subscription-member-chip"><span class="member-avatar">${esc(String(m.user_id||'U').slice(0,1).toUpperCase())}</span><span><strong>${esc(memberLabel)}</strong><small>Shared Premium seat</small></span>${removeButton}</div>`);});
 const sharedMemberRows=`<div class="subscription-members-list">${memberCards.join('')}</div>`;
 const sharedMemberInfo=state.sharedMemberships.length?`<div class="subscription-shared-note">${icon('users')} You are currently included in ${state.sharedMemberships.length} shared plan${state.sharedMemberships.length===1?'':'s'}.</div>`:'';
 const paymentRows=(state.paymentRows||[]).slice(0,5).map(r=>`<div class="subscription-payment-row"><span><strong>${esc(r.payment_status||'Recorded')}</strong><small>${esc(r.payment_method||'Payment')}</small></span><span>${r.payment_amount!=null?`₱${Number(r.payment_amount).toFixed(2)}`:'—'}</span><span>${esc(String(r.payment_date||'—').slice(0,10))}</span></div>`).join('');
 const cards=state.plans.map(p=>{
   const isCurrent=current&&String(current.plan_id)===String(p.plan_id);
   const price=Number(p.monthly_price||0);
   const action=isCurrent?`<button class="button secondary" disabled>${icon('check')} Current plan</button>`:price<=0?`<button class="button secondary" disabled>Free access</button>`:`<button class="button" data-maya-plan="${p.plan_id}">${icon('forward')} Continue to payment</button>`;
   return `<article class="plan-card ${isCurrent?'current-plan':''}"><span>${esc(p.plan_name)}</span><strong>₱${price.toFixed(0)}<small>/month</small></strong><p>${p.max_members} ${Number(p.max_members)===1?'member':'members'}</p><small class="plan-meta">${Number(p.max_members)>1?'Best for shared listening':'Great for personal listening'}</small>${action}</article>`;
 }).join('');
 const manageSection=current?`<section class="subscription-minimal"><article class="subscription-current-card"><div class="subscription-current-main"><div><span class="eyebrow">YOUR PLAN</span><h3>${esc(current.plan_name||'Premium')}</h3><p>${esc(relationship)} · active until ${esc(current.end_date||'—')}</p></div><span class="status-pill active">${icon('check')} Active</span></div><div class="subscription-compact-stats"><span><small>Downloads</small><strong>${state.offlineDownloads.length}</strong></span><span><small>Seats</small><strong>${usedSeats}/${maxMembers}</strong></span><span><small>Renews / ends</small><strong>${esc(String(current.end_date||'—').slice(0,10))}</strong></span></div>${sharedMemberInfo}${maxMembers>1&&isPlanOwner?`<div class="subscription-inline-action"><span>${availableSeats?`${availableSeats} shared seat${availableSeats===1?'':'s'} available`:'All shared seats are in use'}</span><button type="button" class="button secondary sm" id="invite-plan-member" ${availableSeats<1?'disabled':''}>${icon('users')} ${availableSeats>0?'Invite member':'Plan full'}</button></div>`:''}</article><details class="subscription-details"><summary>Members <span>${usedSeats}/${maxMembers}</span></summary><div class="subscription-details-body">${sharedMemberRows}</div></details>${paymentRows?`<details class="subscription-details"><summary>Payment history <span>${(state.paymentRows||[]).length}</span></summary><div class="subscription-details-body subscription-payment-list">${paymentRows}</div></details>`:''}</section>`:`<section class="subscription-layout"><article class="subscription-panel"><div class="subscription-panel-head"><div><span class="eyebrow">PREMIUM</span><h3>Upgrade in a few steps</h3></div></div><div class="subscription-flow"><div><strong>1. Choose a plan</strong><p>Select the plan and number of seats that fit your account.</p></div><div><strong>2. Complete checkout</strong><p>Continue to the secure payment page to confirm your subscription.</p></div><div><strong>3. Automatic verification</strong><p>SoundWave verifies the completed transaction and updates your account.</p></div><div><strong>4. Premium activates</strong><p>Your plan, downloads, and eligible sharing benefits become available automatically.</p></div></div></article></section>`;
 if(current && state.mayaPaymentNotice?.type==='pending'){
   clearPendingMayaReturn();
   state.mayaPaymentNotice={type:'success',message:'Your subscription is active. Premium benefits are ready to use.'};
 }
 const paymentNotice=state.mayaPaymentNotice?`<div class="payment-return-notice ${esc(state.mayaPaymentNotice.type||'info')}"><span>${state.mayaPaymentNotice.type==='success'?icon('check'):icon('clock')}</span><div><strong>${state.mayaPaymentNotice.type==='success'?'Premium activated':state.mayaPaymentNotice.type==='pending'?'Payment verification':'Checkout update'}</strong><p>${esc(state.mayaPaymentNotice.message||'')}</p></div>${state.mayaPaymentNotice.type==='pending'?`<button type="button" class="button secondary sm" id="retry-maya-payment">Retry verification</button>`:''}</div>`:'';
 shell(`${paymentNotice}${current?`<section class="workspace-hero premium-hero"><div><span class="eyebrow">SUBSCRIPTION</span><h2>${esc(current.plan_name||'Premium')} is active.</h2><p>${esc(relationship)} · ${esc(current.start_date||'')} → ${esc(current.end_date||'')}</p><div class="inline hero-inline-pills">${premiumAccountBadge(current.plan_name||'Premium')}</div></div><span class="hero-vinyl">✓</span></section>`:`<section class="workspace-hero premium-hero"><div><span class="eyebrow">PREMIUM</span><h2>Upgrade to SoundWave Premium.</h2><p>Choose a plan and complete checkout to activate your Premium benefits.</p></div><span class="hero-vinyl">M</span></section>`}${manageSection}<div class="section-heading subscription-heading"><div><h2>Available plans</h2><small class="muted">Choose the plan that fits your listening.</small></div></div><div class="plan-grid">${cards}</div>
 <dialog class="sw-modal maya-checkout-dialog" id="maya-checkout-dialog"><div class="modal-head"><div><span class="eyebrow">SECURE CHECKOUT</span><h2 id="maya-checkout-title">Confirm plan</h2></div><button class="modal-close" data-close-modal>${icon('close')}</button></div><div class="maya-checkout-body"><div class="maya-order-summary"><span class="maya-mark">M</span><div><small>SoundWave Premium</small><strong id="maya-plan-name">Premium</strong><p id="maya-plan-members">1 member</p></div><strong id="maya-plan-price">₱0</strong></div><div class="maya-test-notice">${icon('shield')} <span><strong>Secure payment</strong><small>Your plan activates after the transaction is verified.</small></span></div><ol class="maya-checkout-steps"><li><span>1</span>SoundWave creates a secure checkout session.</li><li><span>2</span>You finish payment on the secure checkout page.</li><li><span>3</span>SoundWave verifies the payment and activates Premium.</li></ol><div class="dialog-actions"><button type="button" class="button secondary" data-close-modal>Cancel</button><button type="button" class="button maya-pay-button" id="maya-start-checkout">Continue to payment</button></div></div></dialog>
 <dialog class="sw-modal" id="subscription-invite-dialog"><div class="modal-head"><div><span class="eyebrow">SHARE PREMIUM</span><h2>Invite a member</h2></div><button class="modal-close" data-close-modal>${icon('close')}</button></div><div class="form"><p class="muted">Generate a one-time link. The other person signs in to SoundWave and opens the link to use one available seat.</p><button type="button" class="button" id="generate-sub-invite">${icon('users')} Generate invite link</button><label class="single-field" id="sub-invite-result" hidden>Invite link<input id="sub-invite-url" readonly></label><div class="dialog-actions"><button type="button" class="button secondary" data-close-modal>Done</button><button type="button" class="button secondary" id="copy-sub-invite" hidden>Copy link</button></div></div></dialog>
 <dialog class="sw-modal premium-welcome-dialog" id="premium-welcome-dialog"><div class="modal-head"><div><span class="eyebrow">WELCOME TO PREMIUM</span><h2>Your Premium plan is active.</h2></div><button class="modal-close" data-close-modal>${icon('close')}</button></div><div class="premium-benefit-grid"><div>${icon('download')}<strong>Offline downloads</strong><small>Save supported songs to this device.</small></div><div>${icon('check')}<strong>Premium status</strong><small>Your account now shows its active Premium plan.</small></div><div>${icon('users')}<strong>Plan sharing</strong><small>Eligible multi-seat plans can invite other SoundWave users.</small></div></div><div class="dialog-actions"><button type="button" class="button" data-close-modal>Start listening</button></div></dialog>`,'Subscription',current?`${current.plan_name} subscription`:'Manage your Premium subscription.');
 let chosenPlan=null;
 document.querySelectorAll('[data-maya-plan]').forEach(b=>b.onclick=()=>{chosenPlan=state.plans.find(x=>String(x.plan_id)===String(b.dataset.mayaPlan));if(!chosenPlan)return;$('#maya-plan-name').textContent=chosenPlan.plan_name;$('#maya-plan-members').textContent=`${chosenPlan.max_members} ${Number(chosenPlan.max_members)===1?'member':'members'}`;$('#maya-plan-price').textContent=`₱${Number(chosenPlan.monthly_price||0).toFixed(2)}`;$('#maya-checkout-title').textContent=`Choose ${chosenPlan.plan_name}`;$('#maya-checkout-dialog').showModal();});
 $('#maya-start-checkout')?.addEventListener('click',()=>action(async()=>{
   if(!chosenPlan){toast('Choose a Premium plan first.',true);return;}
   const btn=$('#maya-start-checkout');btn.disabled=true;btn.textContent='Creating checkout…';
   try{
     const {data,error}=await db.functions.invoke('maya-create-checkout',{body:{plan_id:Number(chosenPlan.plan_id)}});
     if(error){toast(`Could not start checkout: ${await edgeFunctionMessage(error)}`,true);return;}
     if(data?.error){toast(`Could not start checkout: ${data.error}`,true);return;}
     if(!data?.checkout_url){toast('The payment service did not return a checkout URL. Please try again.',true);return;}
     const checkoutUrl=new URL(data.checkout_url);if(checkoutUrl.protocol!=='https:'||!/(^|\.)paymaya\.com$|(^|\.)maya\.ph$/i.test(checkoutUrl.hostname))throw Error('Payment checkout returned an unexpected destination.');
     sessionStorage.setItem('soundwave-maya-reference',String(data.reference||''));
     window.location.assign(checkoutUrl.href);
   }finally{btn.disabled=false;btn.textContent='Continue to payment';}
 }));
 $('#retry-maya-payment')?.addEventListener('click',()=>{state.mayaPaymentNotice={type:'pending',message:'Retrying payment verification…'};processPendingMayaReturn();});
 $('#invite-plan-member')?.addEventListener('click',()=>document.getElementById('subscription-invite-dialog')?.showModal());
 $('#generate-sub-invite')?.addEventListener('click',()=>action(async()=>{
   if(!current?.subscription_id)throw Error('No active subscription was found.');
   const {data,error}=await db.rpc('create_subscription_invite',{p_subscription_id:Number(current.subscription_id)});
   if(error)throw error;const token=Array.isArray(data)?data[0]?.token??data[0]:data?.token??data;if(!token)throw Error('No invite token was returned.');
   const url=`${location.origin}${location.pathname}?subscription_invite=${encodeURIComponent(String(token))}#/plans`;
   document.getElementById('sub-invite-url').value=url;document.getElementById('sub-invite-result').hidden=false;document.getElementById('copy-sub-invite').hidden=false;
 }));
 $('#copy-sub-invite')?.addEventListener('click',async()=>{const input=document.getElementById('sub-invite-url');if(!input?.value)return;try{await navigator.clipboard.writeText(input.value);toast('Premium invite link copied');}catch{input.select();document.execCommand?.('copy');toast('Invite link ready to share');}});
 document.querySelectorAll('[data-remove-sub-member]').forEach(b=>b.onclick=()=>{if(!confirm('Remove this member from the Premium plan?'))return;action(async()=>{const {error}=await db.rpc('remove_subscription_member',{p_subscription_id:Number(current.subscription_id),p_user_id:b.dataset.removeSubMember});if(error)throw error;await loadData();render();toast('Member removed');});});
}

// Maya return processing is handled by captureMayaReturn/processPendingMayaReturn above.

// ---------- Step-by-step upload helpers (songs + podcasts) ----------
function howItWorks(steps) {
  return `<ol class="how-steps">${steps.map(([t, d], i) => `<li><span class="how-num">${i + 1}</span><span><strong>${esc(t)}</strong><small>${esc(d)}</small></span></li>`).join('')}</ol>`;
}
function wizardNav(labels) {
  return `<ol class="wizard-steps" aria-label="Upload progress">${labels.map((l, i) => `<li class="${i === 0 ? 'current' : ''}"><span>${i + 1}</span>${esc(l)}</li>`).join('')}</ol>`;
}
const AUDIO_EXT = /\.(mp3|wav|m4a|aac|ogg|oga|opus|flac|weba)$/i;
function audioProblem(f) {
  if(!f||f.size<=0)return 'Choose a non-empty audio file.';
  const mime=String(f.type||'').toLowerCase(),extOk=AUDIO_EXT.test(String(f.name||''));
  const mimeOk=/^audio\/(mpeg|mp3|wav|x-wav|mp4|m4a|aac|ogg|opus|flac|webm)$/i.test(mime);
  if(!extOk||(!mimeOk&&mime))return 'That does not look like a supported audio file. Use MP3, WAV, M4A, AAC, OGG, OPUS, FLAC or WebM audio.';
  if (f.size > 35 * 1048576) return `That file is ${(f.size / 1048576).toFixed(1)} MB. Please choose one under 35 MB.`;
  return '';
}
function plainNameProblem(value,label='Name',max=100){
  const raw=String(value||''),t=raw.trim();
  if(!t)return `${label} is required.`;
  if(t.length<2)return `${label} must be at least 2 characters.`;
  if(t.length>max)return `${label} must be ${max} characters or fewer.`;
  if(raw!==t)return `${label} cannot start or end with spaces.`;
  if(/\s{2,}/.test(t))return `${label} cannot contain repeated spaces.`;
  if(/[<>]/.test(t))return `${label} contains unsupported characters.`;
  return '';
}
function contentTitleProblem(value,label='Title',max=120){
  const v=String(value||'');const t=v.trim();
  if(t.length<2)return `${label} must be at least 2 characters.`;
  if(t.length>max)return `${label} must be ${max} characters or fewer.`;
  if(v!==t)return `${label} cannot start or end with spaces.`;
  if(/\s{2,}/.test(t))return `${label} cannot contain repeated spaces.`;
  if(/\.(mp3|wav|m4a|aac|ogg|flac|webp|png|jpe?g)$/i.test(t))return `${label} should be a title, not a filename.`;
  if(!/^[\p{L}\p{N}][\p{L}\p{N} '&.,!?()\-–—:+]*$/u.test(t))return `${label} contains unsupported symbols. Use letters, numbers, spaces, and normal punctuation.`;
  const letters=(t.match(/\p{L}/gu)||[]).length;
  const digits=(t.match(/\p{N}/gu)||[]).length;
  const compact=t.replace(/[^\p{L}\p{N}]/gu,'');
  if(letters<2)return `${label} must contain at least 2 letters.`;
  if(digits>0 && digits/Math.max(1,letters+digits)>.45)return `${label} contains too many numbers. Use a meaningful release or track name.`;
  if(/(.)\1{3,}/iu.test(t))return `${label} contains too many repeated characters.`;
  if(/(?:asdf|qwer|zxcv|hjkl|poiuy|lkjh|mnbv|12345|98765)/i.test(t))return `${label} looks like placeholder or random text.`;
  const words=t.toLowerCase().match(/[\p{L}\p{N}]+/gu)||[];
  if(words.some(w=>w.length>=7 && !/[aeiouy]/i.test(w) && !/\d/.test(w)))return `${label} looks like random letters. Use a meaningful word or phrase.`;
  if(compact.length>=8 && /^[a-z]+$/i.test(compact) && new Set(compact.toLowerCase()).size<=2)return `${label} looks like repeated placeholder text.`;
  return '';
}
function normalizedContentTitle(value){return String(value||'').trim().replace(/\s+/g,' ');}
function safeUploadFilename(file){
  const raw=String(file?.name||'audio').normalize('NFKD');
  const dot=raw.lastIndexOf('.'),ext=(dot>=0?raw.slice(dot+1):'bin').toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,8)||'bin';
  const base=(dot>=0?raw.slice(0,dot):raw).replace(/[^a-z0-9_-]+/gi,'-').replace(/^-+|-+$/g,'').slice(0,42)||'track';
  return `${base}.${ext}`;
}

// Read duration from the selected local audio file before uploading it.
// Returns a Promise<number> in seconds. Used by both song and podcast uploads.
function audioDuration(file) {
  return new Promise((resolve, reject) => {
    if (!file) { reject(new Error('No audio file selected.')); return; }
    const audio = document.createElement('audio');
    const objectUrl = URL.createObjectURL(file);
    let settled = false;
    const cleanup = () => {
      try { URL.revokeObjectURL(objectUrl); } catch (_) {}
      audio.removeAttribute('src');
      try { audio.load(); } catch (_) {}
    };
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn(value);
    };
    const timer = setTimeout(() => finish(reject, new Error('Timed out while reading audio metadata.')), 12000);
    const ok = () => {
      clearTimeout(timer);
      const duration = Number(audio.duration);
      if (Number.isFinite(duration) && duration > 0) finish(resolve, Math.ceil(duration));
      else finish(reject, new Error('Could not read the audio duration.'));
    };
    const fail = () => { clearTimeout(timer); finish(reject, new Error('Could not read audio metadata.')); };
    audio.preload = 'metadata';
    audio.addEventListener('loadedmetadata', ok, { once: true });
    audio.addEventListener('durationchange', () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) ok();
    }, { once: true });
    audio.addEventListener('error', fail, { once: true });
    audio.src = objectUrl;
    try { audio.load(); } catch (e) { fail(); }
  });
}
function audioDropHtml(p) {
  return `<label class="audio-drop" id="${p}-drop" for="${p}-file">${icon('upload')}<strong id="${p}-drop-title">Choose an audio file</strong><small>Or drag and drop it here</small><input id="${p}-file" type="file" accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac" hidden></label><div id="${p}-summary" class="audio-summary"></div>`;
}
function bindAudioDrop(p) {
  const input = document.getElementById(`${p}-file`), zone = document.getElementById(`${p}-drop`);
  if (!input || !zone) return;
  const show = () => {
    const f = input.files?.[0]; if (!f) return;
    document.getElementById(`${p}-drop-title`).textContent = f.name;
    const bad = audioProblem(f);
    const sum=document.getElementById(`${p}-summary`);
    if(sum){
      if(bad){sum.textContent=bad;}
      else{sum.innerHTML=`<div class="selected-audio-card"><span class="selected-audio-art">${icon('music')}</span><div><strong>${esc(f.name)}</strong><small>${(f.size/1048576).toFixed(2)} MB · Ready to upload</small></div><span class="audio-ready">${icon('check')} Ready</span></div>`;}
      sum.classList.toggle('bad',Boolean(bad));
    }
  };
  input.addEventListener('change', show);
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', (e) => { e.preventDefault(); zone.classList.remove('drag-over'); if (e.dataTransfer.files.length) { input.files = e.dataTransfer.files; show(); } });
}
const summaryHtml = (rows) => `<dl class="upload-summary">${rows.filter((r) => r[1]).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`;
function bindWizard(form, { validate = () => '' } = {}) {
  const dialog = form.closest('dialog');
  const steps = [...form.querySelectorAll('.upload-step')], total = steps.length;
  const back = form.querySelector('.wiz-back'), next = form.querySelector('.wiz-next'), finish = form.querySelector('.wiz-finish');
  const label = dialog?.querySelector('.wizard-eyebrow');
  let step = 1;
  const go = (n) => {
    step = Math.max(1, Math.min(total, n));
    steps.forEach((el, i) => { el.hidden = i + 1 !== step; });
    form.querySelectorAll('.wizard-steps li').forEach((li, i) => { const current=i+1===step;li.classList.toggle('current',current);li.classList.toggle('done',i+1<step);if(current)li.setAttribute('aria-current','step');else li.removeAttribute('aria-current'); });
    if (label) label.textContent = `STEP ${step} OF ${total}`;
    back.hidden = step === 1; next.hidden = step === total; finish.hidden = step !== total;
    form.dispatchEvent(new CustomEvent('wizardstep', { detail: step }));
  };
  next.onclick = () => { const err = validate(step); if (err) return toast(err, true); go(step + 1); };
  back.onclick = () => go(step - 1);
  dialog?.addEventListener('close', () => go(1));
  go(1);
  return { go, get step() { return step; } };
}
function setPublishing(btn,on,idle){if(!btn)return;btn.disabled=on;btn.textContent=on?'Uploading… keep this window open':idle;btn.closest('form')?.classList.toggle('is-publishing',on);}

function studio(){if(!hasArtistAccess())return discoverPage();
 const validAlbums=state.albums.filter(a=>a.is_active);
 const ownedSongs=state.ownedSongs||[];
 const streams=Number(state.artistThirtyDay.length||0);
 const followers=myFollowerCount();
 const estimated=Number(state.royaltySummary?.estimated_royalty||0);
 const days=Array(30).fill(0);for(const r of state.artistThirtyDay||[]){const d=Math.floor((Date.now()-new Date(r.stream_date).getTime())/86400000);if(d>=0&&d<30)days[29-d]++;}
 if(state.artistStudioView==='catalog' && !state.selectedStudioAlbum && state.albums.length) state.selectedStudioAlbum=Number(state.albums[0].album_id);
 const selectedAlbumId=Number(state.selectedStudioAlbum||0);
 const selectedRelease=state.albums.find(a=>Number(a.album_id)===selectedAlbumId)||null;
 const catalogSongs=selectedRelease?ownedSongs.filter(song=>Number(song.album?.album_id||song.album_id)===selectedAlbumId):[];
 const albums=state.albums.map((a,i)=>`<article class="studio-release-card ${Number(a.album_id)===selectedAlbumId?'selected-release':''}"><button class="studio-release-main" data-album-select="${a.album_id}" aria-label="Show songs from ${esc(a.album_title)}" aria-pressed="${Number(a.album_id)===selectedAlbumId}"><span class="studio-album-art" style="background:${grad(i)}">${a.cover_path&&state.coverUrls[a.cover_path]?`<img src="${escapeHtml(state.coverUrls[a.cover_path])}" alt="${esc(a.album_title)} cover">`:icon('album')}</span><span class="studio-release-copy"><span class="card-title-line"><strong>${escapeHtml(a.album_title)}</strong><span class="status-pill ${a.is_active?'active':'inactive'}">${a.is_active?'Active':'Inactive'}</span></span><small><span class="release-type-pill">${esc(a.release_type||'Album')}</span> ${a.release_date?`· ${esc(String(a.release_date).slice(0,10))}`:''}</small></span></button><button type="button" class="button secondary sm studio-deactivate" data-album-active="${a.album_id}" data-active="${a.is_active?'false':'true'}" ${a.admin_locked?'disabled title="Locked by administrator"':''}>${a.admin_locked?'Admin locked':a.is_active?'Deactivate':'Restore'}</button></article>`).join('');
 shell(`<section class="workspace-hero artist-studio-hero"><div><span class="eyebrow">SOUNDWAVE FOR ARTISTS</span><h2>Artist Studio</h2><p>Release, manage and understand your music without crowding everything into one page.</p><div class="hero-actions"><button class="button hero-cta" data-open-modal="new-song-modal">${icon('upload')} Upload a song</button></div></div><span class="hero-vinyl">${icon('album')}</span></section>
 <section class="artist-cover-settings"><div><span class="eyebrow">ARTIST IDENTITY</span><h3>Profile cover photo</h3><p>Personalize your artist page with a wide banner image. Recommended 1600 × 500, JPEG, PNG or WebP (max 5 MB).</p></div><div class="artist-cover-controls"><div id="artist-cover-preview" class="artist-cover-preview" aria-label="Current artist cover">${state.artist?.cover_path&&state.coverUrls[state.artist.cover_path]?`<img src="${esc(state.coverUrls[state.artist.cover_path])}" alt="Current artist banner">`:`<span>No cover image yet</span>`}</div><button type="button" class="button secondary" id="artist-cover-choose">${icon('upload')} Choose cover photo</button><input type="file" id="artist-cover-upload" accept="image/jpeg,image/png,image/webp" class="artist-cover-file-input" aria-label="Artist cover photo"><small id="artist-cover-status" role="status" aria-live="polite">Choose an image to upload.</small></div></section>
 <nav class="creator-view-tabs" aria-label="Artist Studio views"><button class="${state.artistStudioView==='overview'?'active':''}" data-artist-view-btn="overview">Overview</button><button class="${state.artistStudioView==='analytics'?'active':''}" data-artist-view-btn="analytics">Analytics</button><button class="${state.artistStudioView==='catalog'?'active':''}" data-artist-view-btn="catalog">Catalog</button><button class="${state.artistStudioView==='publish'?'active':''}" data-artist-view-btn="publish">Publish</button><button class="${state.artistStudioView==='earnings'?'active':''}" data-artist-view-btn="earnings">Earnings</button></nav>
 <section class="creator-view-block" data-artist-view="overview" ${state.artistStudioView!=='overview'?'hidden':''}><section class="studio-stat-strip four"><div><small>Streams</small><strong data-count="${streams}">${streams}</strong><span>Last 30 days</span></div><div><small>Followers</small><strong data-count="${followers}">${followers}</strong><span>Your audience</span></div><div><small>Releases</small><strong data-count="${state.albums.length}">${state.albums.length}</strong><span>Albums and singles</span></div><div><small>Estimated royalty</small><strong>₱${estimated.toFixed(2)}</strong><span>Current estimate</span></div></section><div class="creator-summary-grid"><article><span class="eyebrow">NEXT STEP</span><h3>Publish new music</h3><p>Create a release or upload a track without leaving Artist Studio.</p><button class="button secondary" data-artist-open="publish">Open publishing</button></article><article><span class="eyebrow">PERFORMANCE</span><h3>${state.artistThirtyDay.length} streams in 30 days</h3><p>Open Analytics for trends, top songs, releases and listeners.</p><button class="button secondary" data-artist-open="analytics">View analytics</button></article><article><span class="eyebrow">CATALOG</span><h3>${state.albums.length} releases</h3><p>Manage release and track availability in one focused view.</p><button class="button secondary" data-artist-open="catalog">Manage catalog</button></article></div></section>
 <section class="creator-view-block" data-artist-view="analytics" ${state.artistStudioView!=='analytics'?'hidden':''}>${artistChartsHtml()}</section>
 <section class="creator-view-block" data-artist-view="publish" ${state.artistStudioView!=='publish'?'hidden':''}><div class="section-heading"><div><span class="eyebrow">CREATE</span><h2>Release tools</h2></div></div><div class="studio-actions redesign-actions"><button data-open-modal="new-album-modal"><span class="studio-action-art gradient-one">${icon('album')}</span><strong>New album / single</strong><small>Create release details and cover art</small><span class="studio-arrow">${icon('plus')}</span></button><button data-open-modal="new-song-modal"><span class="studio-action-art gradient-two">${icon('upload')}</span><strong>Upload a song</strong><small>Audio, artwork, genre and review</small><span class="studio-arrow">${icon('plus')}</span></button><button data-open-modal="edit-song-modal"><span class="studio-action-art gradient-three">${icon('settings')}</span><strong>Edit a release</strong><small>Update an existing song title</small><span class="studio-arrow">${icon('forward')}</span></button></div></section>
 <section class="creator-view-block" data-artist-view="catalog" ${state.artistStudioView!=='catalog'?'hidden':''}><div class="section-heading"><div><span class="eyebrow">CATALOG</span><h2>Your releases <span class="muted small">(${state.albums.length})</span></h2><p class="muted small">Select a release to manage only the tracks inside it.</p></div><button class="text-link" data-open-modal="new-album-modal">+ Add album</button></div><div class="studio-release-grid">${albums||`<div class="empty studio-empty"><span>${icon('album')}</span><h3>Release your first album</h3><p>Create an album or single, add artwork, then upload your first track.</p><button class="button" data-open-modal="new-album-modal">${icon('plus')} Create a release</button></div>`}</div><div class="section-heading catalog-track-heading"><div><span class="eyebrow">TRACKS</span><h2>${selectedRelease?esc(selectedRelease.album_title):'Select a release'}</h2><p class="muted small">${selectedRelease?`${catalogSongs.length} ${catalogSongs.length===1?'track':'tracks'} in this release`:'Choose an album or single above to manage its songs.'}</p></div><button class="text-link" data-open-modal="new-song-modal">+ Upload song</button></div><div class="song-manager-grid">${selectedRelease?(catalogSongs.length?catalogSongs.map(song=>`<article class="song-manager-card">${albumArt(song,'large')}<div class="song-manager-copy"><div class="card-title-line"><strong>${esc(song.song_title)}</strong><span class="status-pill ${song.is_active?'active':'inactive'}">${song.is_active?'Active':'Inactive'}</span></div><small>${esc(song.album?.album_title||'Release')}</small><div class="song-manager-meta"><span>${esc(state.genres.find(g=>Number(g.genre_id)===Number(song.genre_id))?.genre_name||'Uncategorized')}</span><span>${nice(song.duration_seconds)}</span></div></div><div class="song-manager-actions"><button type="button" class="button secondary sm" data-open-modal="edit-song-modal" data-edit-song-id="${song.song_id}">Edit</button><button class="button secondary sm" data-own-song-active="${song.song_id}" data-active="${song.is_active?'false':'true'}">${song.is_active?'Deactivate':'Restore'}</button></div></article>`).join(''):`<div class="empty catalog-song-empty"><span>${icon('music')}</span><h3>No songs in ${esc(selectedRelease.album_title)}</h3><p>Upload a track and choose this release.</p><button class="button" data-open-modal="new-song-modal">Upload song</button></div>`):'<div class="empty">Select a release above.</div>'}</div></section>
 <section class="creator-view-block" data-artist-view="earnings" ${state.artistStudioView!=='earnings'?'hidden':''}><div class="section-heading"><div><span class="eyebrow">EARNINGS</span><h2>Royalty overview</h2></div><button class="text-link" data-open-modal="royalty-info-dialog">How royalties work</button></div><section class="royalty-upgrade"><div class="royalty-figure"><small>Estimated royalty</small><strong>₱${estimated.toFixed(2)}</strong><span>${streams} qualified streams in 30 days · rate ₱${Number(state.royaltySummary?.royalty_rate||0).toFixed(4)}</span></div><div class="royalty-spark"><div><small>30-day streams</small><strong>${state.artistThirtyDay.length}</strong></div>${sparkline(days)}</div></section></section>
 <dialog class="sw-modal info-dialog" id="royalty-info-dialog"><div class="modal-head"><div><span class="eyebrow">ROYALTIES</span><h2>How royalties work</h2></div><button type="button" class="modal-close" data-close-modal aria-label="Close royalties information">${icon('close')}</button></div><div class="info-stack"><p>SoundWave estimates royalties using your visible stream count multiplied by the royalty rate returned by your existing royalty summary data.</p><div class="notice">This is an estimate for your project dashboard, not a payout guarantee.</div><button type="button" class="button" data-close-modal>Got it</button></div></dialog>
 <dialog class="sw-modal studio-dialog release-create-dialog" id="new-album-modal"><div class="release-dialog-head"><div><span class="eyebrow">NEW RELEASE</span><h2>Create a release</h2><p>Set the artwork and metadata listeners will see across SoundWave.</p></div><button type="button" class="modal-close" data-close-modal aria-label="Close new release dialog">${icon('close')}</button></div><form id="albumform" class="release-create-form"><div class="release-create-grid"><div class="release-art-panel"><label class="cover-drop creator-cover-drop release-cover-drop" id="cover-drop" for="albumcover"><span id="cover-preview">${icon('album')}</span><strong>Add cover artwork</strong><small>Square JPG, PNG or WebP · up to 5 MB</small><em>Recommended: 1400 × 1400</em><input type="file" id="albumcover" accept="image/png,image/jpeg,image/webp" hidden></label><div class="release-art-tip"><strong>Artwork tips</strong><span>Use a clear square image without tiny text. Avoid screenshots or unrelated images.</span></div></div><div class="release-meta-panel"><div class="release-type-switch"><label><input type="radio" name="release_type_choice" value="Album" checked><span>${icon('album')} Album</span></label><label><input type="radio" name="release_type_choice" value="Single"><span>${icon('music')} Single</span></label><select id="releasetype" hidden><option value="Album" selected>Album</option><option value="Single">Single</option></select></div><label class="single-field release-title-field">Release title<input id="albumtitle" required maxlength="120" placeholder="e.g. Midnight Signals" autocomplete="off"><small class="field-help">Use a real title. Random letters, repeated characters, and number-heavy names are blocked.</small><small class="field-help availability" id="album-title-status"></small></label><label class="single-field">Description <span class="field-optional">Optional</span><textarea id="albumdesc" maxlength="1200" placeholder="What is this release about?"></textarea></label><label class="single-field">Release date<input id="releasedate" type="date" required value="${new Date().toISOString().slice(0,10)}"></label></div></div><div class="release-form-note">You can add tracks after the release is created. Metadata can be edited later from Catalog.</div><div class="dialog-actions release-dialog-actions"><button type="button" class="button secondary" data-close-modal>Cancel</button><button class="button" data-busy>Create release</button></div></form></dialog>
 <dialog class="sw-modal studio-dialog wizard-dialog upload-wizard-dialog" id="new-song-modal"><div class="upload-hero-strip"><span>${icon('upload')}</span><div><small>ARTIST UPLOAD</small><strong>Publish a polished track</strong></div></div><div class="modal-head"><div><span class="eyebrow wizard-eyebrow">STEP 1 OF 4</span><h2>Upload a track</h2></div><button type="button" class="modal-close" data-close-modal aria-label="Close upload track dialog">${icon('close')}</button></div><form id="songform">${wizardNav(['Album','Audio','Details','Review'])}<section class="upload-step" data-step="1"><div class="step-icon">${icon('album')}</div><h3>Choose the release</h3><p class="step-desc">Every track belongs to a release. Pick the album or single that should contain this song.</p><div class="album-picks">${validAlbums.map((a,i)=>`<label class="album-pick"><input type="radio" name="albumchoice" value="${a.album_id}" ${i===0?'checked':''}><span style="background:${grad(i)}">${icon('album')}</span><strong>${escapeHtml(a.album_title)}</strong><small>${esc(a.release_type||'Album')}</small>${icon('check')}</label>`).join('')||'<p class="notice">You do not have an album yet. Create one first, then come back to upload.</p>'}</div><button type="button" class="button secondary" data-switch-modal="new-album-modal">${icon('plus')} Create a release</button></section><section class="upload-step" data-step="2" hidden><div class="step-icon">${icon('upload')}</div><h3>Add your audio file</h3><p class="step-desc">Upload the final mastered track that listeners will stream on SoundWave.</p>${audioDropHtml('song')}</section><section class="upload-step" data-step="3" hidden><div class="step-icon">${icon('settings')}</div><h3>Track details</h3><p class="step-desc">Complete the title, description, artwork and genre before publishing.</p><div class="track-detail-grid"><div class="track-detail-fields"><label class="single-field">Song title<input id="songtitle" maxlength="120" minlength="2" required placeholder="e.g. Midnight Drive" autocomplete="off"><small class="field-help">2–120 characters · no file extensions · normal punctuation only</small><small class="field-help availability" id="song-title-status"></small></label><label class="single-field">Description <span class="field-optional">Optional</span><textarea id="songdesc" maxlength="300" placeholder="Tell listeners about this song"></textarea></label><div class="single-field genre-field"><span class="field-label">Genre</span><input id="songgenre" type="hidden" required><button type="button" class="genre-select-trigger" id="genre-select-trigger" aria-haspopup="listbox" aria-expanded="false"><span id="genre-select-label">Choose a genre</span>${icon('forward')}</button><div class="genre-select-menu" id="genre-select-menu" role="listbox" hidden><div class="genre-select-search">${icon('search')}<input id="genre-search" type="search" placeholder="Search genres" autocomplete="off"></div><div class="genre-option-list">${state.genres.map(g=>`<button type="button" class="genre-option" role="option" data-genre-value="${g.genre_id}" data-genre-label="${esc(g.genre_name)}"><span>${esc(g.genre_name)}</span>${icon('check')}</button>`).join('')}</div></div><small class="field-help">Required for search, recommendations and autoplay.</small></div></div><div class="track-art-column"><span class="field-label">Artwork</span><label class="cover-drop song-cover-drop compact-art-drop" for="songcover"><span id="song-cover-preview">${icon('album')}</span><span class="cover-change-badge">${icon('album')}</span><input id="songcover" type="file" accept="image/jpeg,image/png,image/webp" hidden></label><button type="button" class="button secondary artwork-trigger" onclick="document.getElementById('songcover')?.click()">${icon('upload')} Change artwork</button><small>JPG, PNG or WebP · up to 5 MB</small></div></div></section><section class="upload-step review-step" data-step="4" hidden><div class="step-icon">${icon('check')}</div><h3>Review before publishing</h3><p class="step-desc">Confirm the release, file and metadata before SoundWave uploads anything.</p><div id="song-final"></div><div class="notice">Publishing uses your existing Supabase storage and song insert workflow. Keep this dialog open until the upload completes.</div></section><div class="dialog-actions"><button type="button" class="button secondary wiz-back" hidden>Back</button><button type="button" class="button wiz-next" ${validAlbums.length?'':'disabled'}>Continue</button><button type="submit" class="button wiz-finish" data-busy hidden>Publish song</button></div></form></dialog>
 <dialog class="sw-modal edit-surface-dialog edit-song-dialog" id="edit-song-modal"><div class="edit-surface-head"><div><span class="eyebrow">CATALOG EDITOR</span><h2>Edit song details</h2><p>Search your catalog, choose one track, then update its listener-facing title.</p></div><button type="button" class="modal-close" data-close-modal aria-label="Close edit song dialog">${icon('close')}</button></div><form class="edit-surface-form" id="editsong"><input type="hidden" id="owned-song" required><div class="edit-song-picker"><label class="edit-song-search">${icon('search')}<input id="owned-song-search" type="search" autocomplete="off" placeholder="Search songs or releases" aria-label="Search your songs"></label><div class="edit-song-results" id="owned-song-results" role="listbox" aria-label="Your songs">${ownedSongs.map(song=>`<button type="button" class="edit-song-option" role="option" aria-selected="false" data-edit-song-option="${song.song_id}" data-edit-song-search="${esc(`${song.song_title||''} ${song.album?.album_title||''}`.toLowerCase())}">${albumArt(song,'tiny')}<span><strong>${esc(song.song_title||'Untitled song')}</strong><small>${esc(song.album?.album_title||'Release')} · ${nice(song.duration_seconds)}</small></span><i>${icon('chevron')}</i></button>`).join('')||`<div class="empty compact-empty"><p>No songs are available to edit yet.</p></div>`}</div><div class="edit-song-selected" id="edit-song-selected" hidden><small>Selected track</small><strong id="edit-song-selected-title"></strong><span id="edit-song-selected-release"></span></div></div><div class="edit-fields single-column"><label class="single-field">Song title<input id="owned-song-title" required maxlength="120" placeholder="Choose a song above first" disabled><small class="field-help">The same title and anti-placeholder rules used during upload apply here.</small></label></div><div class="dialog-actions edit-surface-actions"><button type="button" class="button secondary" data-close-modal>Cancel</button><button class="button" data-busy id="edit-song-save" disabled>Save changes</button></div></form></dialog>`,'Artist Studio','Release, manage and understand your music.');
 const artistCoverInput=$('#artist-cover-upload');
 const coverChoose=$('#artist-cover-choose'),coverStatus=$('#artist-cover-status');
 if(coverChoose&&artistCoverInput)coverChoose.onclick=()=>artistCoverInput.click();
 if(artistCoverInput)artistCoverInput.onchange=async()=>{
   const file=artistCoverInput.files?.[0];if(!file)return;
   if(state.loading){toast('Wait for the current action before uploading a cover.',true);return;}
   const report=(message,error=false)=>{if(coverStatus){coverStatus.textContent=message;coverStatus.classList.toggle('upload-error',error);} };
   report(`Uploading ${file.name}…`);if(coverChoose)coverChoose.disabled=true;
   try{
     if(!state.artist?.artist_id)throw Error('Your artist profile could not be loaded. Confirm the artist cover SQL migration has been run.');
     if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Choose a JPEG, PNG or WebP image.');
     if(file.size>5*1048576)throw Error('Artist cover photo must be smaller than 5 MB.');
     const ext=({'image/jpeg':'jpg','image/png':'png','image/webp':'webp'})[file.type];
     const path=`${state.user.id}/artists/${crypto.randomUUID()}.${ext}`;
     const upload=await db.storage.from('covers').upload(path,file,{upsert:false,contentType:file.type});
     if(upload.error)throw Error(`Storage upload failed: ${upload.error.message}. Check the covers bucket INSERT policy for your user ID.`);
     try{
       const result=await db.from('artist').update({cover_path:path}).eq('artist_id',state.artist.artist_id).eq('user_id',state.user.id).select('artist_id,cover_path').maybeSingle();
       if(result.error)throw Error(`Artist profile update failed: ${result.error.message}. Run RUN_ME_v48_artist_cover.sql and check artist UPDATE permissions.`);
       if(!result.data)throw Error('Artist profile update changed no rows. Check artist ownership and RLS policies.');
     }catch(error){await db.storage.from('covers').remove([path]);throw error;}
     state.artist.cover_path=path;
     const entry=state.artists.find(x=>Number(x.artist_id)===Number(state.artist.artist_id));if(entry)entry.cover_path=path;
     const url=await resolveCoverUrl(path);
     if(!url)throw Error('Cover saved, but its Storage URL could not be resolved. Check covers bucket read permissions.');
     const displayUrl=url+(url.includes('?')?'&':'?')+'sw_uploaded='+Date.now();
     const visible=await new Promise(resolve=>{const img=new Image();img.onload=()=>resolve(true);img.onerror=()=>resolve(false);img.src=displayUrl;});
     if(!visible)throw Error('Cover was saved but the image cannot be displayed. Check covers bucket SELECT policies and signed/public access.');
     state.coverUrls[path]=displayUrl;
     report('Cover uploaded and verified. Open your artist profile to see it.');
     toast('Artist cover uploaded and verified');
     render();
   }catch(error){console.error('Artist cover upload failed:',error);report(error.message||'Upload failed',true);toast(humanErr(error),true);}
   finally{if(coverChoose&&coverChoose.isConnected)coverChoose.disabled=false;artistCoverInput.value='';}
 };
 const setArtistView=(view)=>{state.artistStudioView=view;if(view==='catalog'){if(!state.selectedStudioAlbum&&state.albums.length)state.selectedStudioAlbum=Number(state.albums[0].album_id);render();requestAnimationFrame(()=>document.querySelector('[data-artist-view="catalog"]')?.scrollIntoView({behavior:'smooth',block:'start'}));return;}document.querySelectorAll('[data-artist-view-btn]').forEach(b=>b.classList.toggle('active',b.dataset.artistViewBtn===view));document.querySelectorAll('[data-artist-view]').forEach(s=>s.hidden=s.dataset.artistView!==view);document.querySelector(`[data-artist-view="${view}"]`)?.scrollIntoView({behavior:'smooth',block:'nearest'});if(view==='analytics')void refreshCrossDeviceMetrics();};
 document.querySelectorAll('[data-artist-view-btn]').forEach(b=>b.onclick=()=>setArtistView(b.dataset.artistViewBtn));
 document.querySelectorAll('[data-artist-open]').forEach(b=>b.onclick=()=>setArtistView(b.dataset.artistOpen));
 // Step-by-step upload: each step only shows what is needed for it.
 bindAudioDrop('song');
 const songForm=$('#songform');
 let songTitleCheckTimer=null;$('#songtitle')?.addEventListener('input',()=>{clearTimeout(songTitleCheckTimer);songTitleCheckTimer=setTimeout(async()=>{const input=$('#songtitle'),status=$('#song-title-status');const problem=contentTitleProblem(input?.value,'Song title',120);if(problem){setFieldState(input,status,false,problem);return;}try{const available=await checkSongTitleAvailability(input.value);setFieldState(input,status,available,available?'Song title is available.':'You already have a song with this title.');}catch(err){console.warn('Song title availability check failed',err);}},350);});
 document.querySelectorAll('input[name="release_type_choice"]').forEach(r=>r.addEventListener('change',()=>{const s=$('#releasetype');if(s)s.value=r.value;}));
 const albumTitleInput=$('#albumtitle'),albumTitleStatus=$('#album-title-status');
 let albumTitleCheckTimer=null;
 albumTitleInput?.addEventListener('input',()=>{clearTimeout(albumTitleCheckTimer);albumTitleCheckTimer=setTimeout(async()=>{const problem=contentTitleProblem(albumTitleInput.value,'Release title',120);if(problem){setFieldState(albumTitleInput,albumTitleStatus,false,problem);return;}try{const available=await checkAlbumTitleAvailability(albumTitleInput.value);setFieldState(albumTitleInput,albumTitleStatus,available,available?'Release title is available.':'You already have a release with this title.');}catch(err){console.warn('Release title availability check failed',err);setFieldState(albumTitleInput,albumTitleStatus,true,'Title format looks good.');}},350);});
 let showTitleCheckTimer=null;$('#showtitle')?.addEventListener('input',()=>{clearTimeout(showTitleCheckTimer);showTitleCheckTimer=setTimeout(async()=>{const input=$('#showtitle'),status=$('#show-title-status');const problem=contentTitleProblem(input?.value,'Show title',140);if(problem){setFieldState(input,status,false,problem);return;}try{const available=await checkShowTitleAvailability(input.value);setFieldState(input,status,available,available?'Show title is available.':'You already have a podcast show with this title.');}catch(err){console.warn('Show title availability check failed',err);setFieldState(input,status,true,'Title format looks good.');}},350);});
 const genreTrigger=$('#genre-select-trigger'),genreMenu=$('#genre-select-menu'),genreSearch=$('#genre-search');
 const closeGenreMenu=()=>{if(!genreMenu||!genreTrigger)return;genreMenu.hidden=true;genreTrigger.setAttribute('aria-expanded','false');};
 const visibleGenreOptions=()=>[...document.querySelectorAll('.genre-option')].filter(btn=>!btn.hidden);
 const chooseGenre=(btn)=>{const input=$('#songgenre'),label=$('#genre-select-label');if(input)input.value=btn.dataset.genreValue||'';if(label)label.textContent=btn.dataset.genreLabel||'Choose a genre';document.querySelectorAll('.genre-option').forEach(x=>{const active=x===btn;x.classList.toggle('active',active);x.setAttribute('aria-selected',String(active));});genreTrigger?.classList.add('has-value');closeGenreMenu();genreTrigger?.focus();};
 genreTrigger?.addEventListener('click',(e)=>{e.stopPropagation();const opening=genreMenu?.hidden!==false;if(genreMenu)genreMenu.hidden=!opening;genreTrigger.setAttribute('aria-expanded',String(opening));if(opening)setTimeout(()=>genreSearch?.focus(),30);});
 genreTrigger?.addEventListener('keydown',(e)=>{if(['ArrowDown','ArrowUp','Enter',' '].includes(e.key)&&genreMenu?.hidden!==false){e.preventDefault();genreMenu.hidden=false;genreTrigger.setAttribute('aria-expanded','true');setTimeout(()=>genreSearch?.focus(),0);}});
 genreSearch?.addEventListener('input',()=>{const q=genreSearch.value.trim().toLowerCase();document.querySelectorAll('.genre-option').forEach(btn=>btn.hidden=q&&!String(btn.dataset.genreLabel||'').toLowerCase().includes(q));});
 genreSearch?.addEventListener('keydown',(e)=>{const options=visibleGenreOptions();if(!options.length)return;if(e.key==='ArrowDown'){e.preventDefault();options[0].focus();}else if(e.key==='Escape'){e.preventDefault();closeGenreMenu();genreTrigger?.focus();}});
 document.querySelectorAll('.genre-option').forEach(btn=>{btn.addEventListener('click',()=>chooseGenre(btn));btn.addEventListener('keydown',(e)=>{const options=visibleGenreOptions(),i=options.indexOf(btn);if(e.key==='ArrowDown'){e.preventDefault();options[(i+1)%options.length]?.focus();}else if(e.key==='ArrowUp'){e.preventDefault();options[(i-1+options.length)%options.length]?.focus();}else if(e.key==='Enter'||e.key===' '){e.preventDefault();chooseGenre(btn);}else if(e.key==='Escape'){e.preventDefault();closeGenreMenu();genreTrigger?.focus();}});});
 if(genreOutsideClickHandler)document.removeEventListener('click',genreOutsideClickHandler);genreOutsideClickHandler=(e)=>{if(!e.target.closest('.genre-field'))closeGenreMenu();};document.addEventListener('click',genreOutsideClickHandler);
 const wiz=bindWizard(songForm,{validate:(st)=>{if(st===1&&!document.querySelector('input[name="albumchoice"]:checked'))return 'Choose an album or create one first.';if(st===2){const f=$('#song-file').files?.[0];if(!f)return 'Choose your audio file first.';return audioProblem(f);}if(st===3){const problem=contentTitleProblem($('#songtitle')?.value,'Song title',120);if(problem)return problem;if(!val('songgenre'))return 'Select a genre.';}return '';}});
 songForm.addEventListener('wizardstep',e=>{if(e.detail!==4)return;const f=$('#song-file').files?.[0];const pick=document.querySelector('input[name="albumchoice"]:checked');const alb=state.albums.find(a=>String(a.album_id)===pick?.value);const g=state.genres.find(x=>String(x.genre_id)===String(val('songgenre')));$('#song-final').innerHTML=summaryHtml([['Title',normalizedContentTitle($('#songtitle')?.value)],['Album',alb?.album_title],['Genre',g?.genre_name],['File',f?.name],['Size',f?`${(f.size/1048576).toFixed(2)} MB`:'']]);});
 document.querySelectorAll('[data-album-select]').forEach(b=>b.onclick=()=>{state.selectedStudioAlbum=Number(b.dataset.albumSelect);state.artistStudioView='catalog';render();requestAnimationFrame(()=>document.querySelector('.catalog-track-heading')?.scrollIntoView({behavior:'smooth',block:'nearest'}));});
 $('#albumcover').onchange=e=>{const file=e.target.files[0];const preview=$('#cover-preview');if(file){const url=URL.createObjectURL(file);preview.innerHTML=`<img src="${escapeHtml(url)}" alt="Selected album artwork">`;preview.querySelector('img').onload=()=>URL.revokeObjectURL(url);}};
 $('#songcover').onchange=e=>{const file=e.target.files?.[0],preview=$('#song-cover-preview');if(file&&preview){const url=URL.createObjectURL(file);preview.innerHTML=`<img src="${escapeHtml(url)}" alt="Selected song artwork">`;preview.querySelector('img').onload=()=>URL.revokeObjectURL(url);}};
 const editSongDialog=$('#edit-song-modal'),editSongSearch=$('#owned-song-search'),editSongInput=$('#owned-song'),editSongTitle=$('#owned-song-title'),editSongSave=$('#edit-song-save');
 const chooseEditSong=(songId)=>{const song=ownedSongs.find(x=>Number(x.song_id)===Number(songId));if(!song)return;editSongInput.value=String(song.song_id);editSongTitle.value=song.song_title||'';editSongTitle.disabled=false;editSongSave.disabled=false;$('#edit-song-selected-title').textContent=song.song_title||'Untitled song';$('#edit-song-selected-release').textContent=song.album?.album_title||'Release';$('#edit-song-selected').hidden=false;document.querySelectorAll('[data-edit-song-option]').forEach(option=>{const selected=Number(option.dataset.editSongOption)===Number(song.song_id);option.classList.toggle('selected',selected);option.setAttribute('aria-selected',String(selected));});};
 const filterEditSongs=()=>{const q=String(editSongSearch?.value||'').trim().toLowerCase();document.querySelectorAll('[data-edit-song-option]').forEach(option=>{option.hidden=!!q&&!String(option.dataset.editSongSearch||'').includes(q);});};
 editSongSearch?.addEventListener('input',filterEditSongs);
 document.querySelectorAll('[data-edit-song-option]').forEach(option=>option.onclick=()=>chooseEditSong(option.dataset.editSongOption));
 document.querySelectorAll('[data-open-modal="edit-song-modal"]').forEach(button=>{button.onclick=()=>{dialogOpeners.set(editSongDialog,button);editSongSearch.value='';filterEditSongs();if(button.dataset.editSongId)chooseEditSong(button.dataset.editSongId);else if(selectedRelease){const first=catalogSongs[0];if(first)chooseEditSong(first.song_id);}editSongDialog.showModal();requestAnimationFrame(()=>editSongSearch?.focus());};});
 editSongDialog?.addEventListener('close',()=>{editSongInput.value='';editSongSearch.value='';editSongTitle.value='';editSongTitle.disabled=true;editSongSave.disabled=true;$('#edit-song-selected').hidden=true;document.querySelectorAll('[data-edit-song-option]').forEach(option=>{option.hidden=false;option.classList.remove('selected');option.setAttribute('aria-selected','false');});});
 $('#editsong').onsubmit=e=>{e.preventDefault();action(async()=>{if(!val('owned-song'))throw Error('Choose a song to edit.');const songId=Number(val('owned-song'));const title=val('owned-song-title');const problem=contentTitleProblem(title,'Song title',120);if(problem)throw Error(problem);if(!(await checkSongTitleAvailability(title,songId)))throw Error('Another song in your catalog already uses this title.');check(await db.from('song').update({song_title:normalizedContentTitle(title)}).eq('song_id',songId));await loadData();state.artistStudioView='catalog';render();toast('Song title updated');});};
 document.querySelectorAll('[data-album-active]').forEach(b=>b.onclick=()=>action(async()=>{const active=b.dataset.active==='true';check(await db.rpc('set_my_album_active',{p_album_id:Number(b.dataset.albumActive),p_active:active}));
 const verified=await db.from('album').select('is_active,admin_locked').eq('album_id',Number(b.dataset.albumActive)).single();
 if(verified.error)throw verified.error;
 await loadData();render();
 if(Boolean(verified.data?.is_active)!==active){toast(verified.data?.admin_locked?'This album is locked by moderation. Ask an administrator to restore it.':'Album status did not change. Refresh and review the release status.',true);return;}
 toast(active?'Album is active (verified)':'Album is inactive (verified)');}));
 document.querySelectorAll('[data-own-song-active]').forEach(b=>b.onclick=()=>action(async()=>{
 const id=Number(b.dataset.ownSongActive), next=b.dataset.active==='true';
 const before=await db.from('song').select('album_id,admin_locked').eq('song_id',id).single();
 if(before.error)throw before.error;
 const parent=await db.from('album').select('is_active,admin_locked').eq('album_id',before.data.album_id).single();
 if(parent.error)throw parent.error;
 if(next&&(before.data.admin_locked||parent.data.admin_locked||parent.data.is_active===false))throw Error('An administrator or inactive parent release is blocking this song. Contact an administrator.');
 check(await db.from('song').update({is_active:next}).eq('song_id',id));
 const after=await db.from('song').select('is_active').eq('song_id',id).single();
 if(after.error)throw after.error;
 await loadData();render();
 if(Boolean(after.data.is_active)!==next)throw Error('Song status was not changed. Check administrative moderation locks.');
 toast(next?'Song restored (verified)':'Song deactivated (verified)');
}));
 $('#albumform').onsubmit=e=>{e.preventDefault();action(async()=>{const titleProblem=contentTitleProblem($('#albumtitle')?.value,'Release title',120);if(titleProblem)throw Error(titleProblem);if(!(await checkAlbumTitleAvailability($('#albumtitle')?.value)))throw Error('You already have a release with this title. Choose a different title.');let cover_path=null;const file=$('#albumcover').files?.[0];if(file){if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('Choose a JPEG, PNG or WebP cover.');if(file.size>5*1048576)throw Error('Album artwork must be under 5 MB.');const ext=file.name.split('.').pop().toLowerCase();cover_path=`${state.user.id}/albums/${crypto.randomUUID()}.${ext}`;check(await db.storage.from('covers').upload(cover_path,file,{upsert:false,contentType:file.type}));}
 try{check(await db.from('album').insert({artist_id:state.artist.artist_id,album_title:normalizedContentTitle($('#albumtitle')?.value),description:val('albumdesc')||null,release_type:val('releasetype')||'Album',release_date:val('releasedate'),cover_path,is_active:true}));}catch(error){if(cover_path)await db.storage.from('covers').remove([cover_path]);throw error;}
 await loadData();state.artistStudioView='catalog';render();toast('Release created. You can now upload songs.');});};
 $('#songform').onsubmit=e=>{e.preventDefault();action(async()=>{if(wiz.step!==4)throw Error('Complete the upload steps first.');const file=$('#song-file').files?.[0];if(!file)throw Error('Choose an audio file.');const bad=audioProblem(file);if(bad)throw Error(bad);const album_id=Number(document.querySelector('input[name="albumchoice"]:checked')?.value);if(!validAlbums.some(a=>a.album_id===album_id))throw Error('Select an active album you own.');const titleProblem=contentTitleProblem($('#songtitle')?.value,'Song title',120);if(titleProblem)throw Error(titleProblem);if(!val('songgenre'))throw Error('Select a genre.');if(!(await checkSongTitleAvailability($('#songtitle')?.value)))throw Error('You already have a song with this title. Choose a different title.');const duration_seconds=await audioDuration(file);if(!Number.isFinite(duration_seconds)||duration_seconds<1)throw Error('Could not read the audio duration.');const path=`${state.user.id}/songs/${crypto.randomUUID()}_${safeUploadFilename(file)}`;
 const fin=songForm.querySelector('.wiz-finish');setPublishing(fin,true,'Publish song');let cover_path=null,audioUploaded=false,coverUploaded=false;
 try{
 const trackQuery=await db.from('song').select('track_number').eq('album_id',album_id).order('track_number',{ascending:false}).limit(1);
 if(trackQuery.error)throw trackQuery.error;
 const track_number=(Number(trackQuery.data?.[0]?.track_number)||0)+1;
 check(await db.storage.from('song-audio').upload(path,file,{upsert:false,contentType:file.type||'audio/mpeg'}));audioUploaded=true;
 const cover=$('#songcover')?.files?.[0];if(cover){if(!['image/png','image/jpeg','image/webp'].includes(cover.type))throw Error('Choose a JPEG, PNG or WebP song cover.');if(cover.size>5*1048576)throw Error('Song artwork must be under 5 MB.');const ext=(cover.name.split('.').pop()||'jpg').toLowerCase();cover_path=`${state.user.id}/songs/${crypto.randomUUID()}.${ext}`;check(await db.storage.from('covers').upload(cover_path,cover,{upsert:false,contentType:cover.type}));coverUploaded=true;}
 check(await db.from('song').insert({album_id,genre_id:Number(val('songgenre')),song_title:normalizedContentTitle($('#songtitle')?.value),description:val('songdesc')||null,cover_path,duration_seconds,track_number,audio_path:path,is_active:true}));
 }catch(error){if(audioUploaded)await db.storage.from('song-audio').remove([path]);if(coverUploaded&&cover_path)await db.storage.from('covers').remove([cover_path]);throw error;}finally{setPublishing(fin,false,'Publish song');}
 await loadData();state.artistStudioView='catalog';render();toast('Your track has been released!');});};
}
function admin(){if(!hasAdminAccess())return discoverPage();
 const d=state.adminData||{};const users=d.users||[],artists=d.artists||[],songs=d.songs||state.songs||[],pods=d.podcasts||[];
 const activeUsers=users.filter(x=>x.is_active!==false).length;
 const cellStatus=(active)=>`<span class="status-pill ${active===false?'inactive':'active'}">${active===false?'Inactive':'Active'}</span>`;
 const empty=(iconText,title,msg)=>`<div class="empty admin-empty"><span>${iconText}</span><h3>${title}</h3><p>${msg}</p></div>`;
 const accountRows=users.map(u=>{const isAdmin=Boolean(u.is_admin)||String(u.account_type||'').toLowerCase()==='admin'||state.adminUserIds.includes(String(u.user_id));return `<tr data-admin-row data-search="${esc(`${u.display_name||'User'} ${u.account_type||'Listener'} ${u.user_id||''}`.toLowerCase())}" data-sort-name="${esc((u.display_name||'User').toLowerCase())}" data-sort-status="${u.is_active===false?'inactive':'active'}" data-priority="${u.is_active===false?'true':'false'}"><td data-label="Account"><div class="entity-cell"><span class="member-avatar">${esc((u.display_name||'U')[0].toUpperCase())}</span><span><strong>${esc(u.display_name||'User')}</strong>${isAdmin?'<small class="admin-role-note">Administrator</small>':''}</span></div></td><td data-label="Type">${esc(u.account_type||'Listener')}</td><td data-label="Joined">${esc(String(u.created_at||u.date_created||'—').slice(0,10))}</td><td data-label="Status">${cellStatus(u.is_active)}</td><td data-label="Actions"><div class="admin-row-actions">${isAdmin?`<span class="status-pill admin-access">Admin access</span>`:`<button class="button admin-promote sm" data-promote-admin="${esc(u.user_id)}" data-promote-name="${esc(u.display_name||'User')}">${icon('shield')} Promote to admin</button>`}<button class="button secondary sm" data-entity="users" data-name="${esc(u.display_name||'User')}" data-id="${esc(u.user_id)}" data-active="${u.is_active===false?'true':'false'}">${u.is_active===false?'Restore':'Deactivate'}</button></div></td></tr>`;}).join('');
 const artistRows=artists.map(a=>`<tr data-admin-row data-search="${esc(`${a.artist_name||'Artist'} ${a.country||''}`.toLowerCase())}" data-priority="${a.is_active===false?'true':'false'}" data-sort-name="${esc((a.artist_name||'Artist').toLowerCase())}" data-sort-status="${a.is_active===false?'inactive':'active'}"><td data-label="Artist"><div class="entity-cell"><span class="member-avatar">${esc((a.artist_name||'A')[0].toUpperCase())}</span><strong>${esc(a.artist_name||'Artist')}</strong></div></td><td data-label="Country">${esc(a.country||'—')}</td><td data-label="Songs">${state.songs.filter(s=>Number(s.album?.artist?.artist_id)===Number(a.artist_id)).length}</td><td data-label="Status">${cellStatus(a.is_active)}</td><td data-label="Actions"><button class="button secondary sm" data-entity="artist" data-name="${esc(a.artist_name||'Artist')}" data-id="${a.artist_id}" data-active="${a.is_active===false?'true':'false'}">${a.is_active===false?'Restore':'Deactivate'}</button></td></tr>`).join('');
 const songRows=songs.map(row=>{const live=state.songs.find(s=>Number(s.song_id)===Number(row.song_id))||row;const artist=live.album?.artist?.artist_name||row.artist_name||'—',album=live.album?.album_title||row.album_title||'—';return `<tr data-admin-row data-search="${esc(`${row.song_title||'Song'} ${artist} ${album}`.toLowerCase())}" data-priority="${row.is_active===false?'true':'false'}" data-sort-name="${esc((row.song_title||'Song').toLowerCase())}" data-sort-status="${row.is_active===false?'inactive':'active'}"><td data-label="Song"><div class="entity-cell song-entity">${albumArt(live,'tiny')}<strong>${esc(row.song_title||'Song')}</strong></div></td><td data-label="Artist">${esc(artist)}</td><td data-label="Album">${esc(album)}</td><td data-label="Duration">${nice(row.duration_seconds||live.duration_seconds)}</td><td data-label="Status">${cellStatus(row.is_active)}</td><td data-label="Actions"><button class="button secondary sm" data-entity="song" data-name="${esc(row.song_title||'Song')}" data-id="${row.song_id}" data-active="${row.is_active===false?'true':'false'}">${row.is_active===false?'Restore':'Deactivate'}</button></td></tr>`;}).join('');
 const adminAlbumGroups = new Map();
 const allAlbums = [...(state.adminAllAlbums||[]), ...(state.albums||[]), ...catalogAlbums()];
 for (const al of allAlbums) {
   const id=Number(al.album_id); if(!id || adminAlbumGroups.has(id))continue;
   adminAlbumGroups.set(id,{id,title:al.album_title||al.title||`Album #${id}`,artist:al.artist?.artist_name||artists.find(a=>Number(a.artist_id)===Number(al.artist_id))?.artist_name||'Artist',cover:al.cover_path||'',active:al.is_active!==false,songs:[]});
 }
 for(const row of songs){const live=state.songs.find(x=>Number(x.song_id)===Number(row.song_id))||row;
   const id=Number(live.album_id||live.album?.album_id||row.album_id);if(!id)continue;
   if(!adminAlbumGroups.has(id))adminAlbumGroups.set(id,{id,title:live.album?.album_title||row.album_title||`Album #${id}`,artist:live.album?.artist?.artist_name||row.artist_name||'Artist',cover:live.album?.cover_path||'',active:live.album?.is_active!==false,songs:[]});
   adminAlbumGroups.get(id).songs.push({row,live});
 }
 // The public song catalog is filtered: canonical album rows take precedence for moderation.
 for (const source of state.adminAllAlbums||[]) {
   const group=adminAlbumGroups.get(Number(source.album_id));
   if(group){ group.active=source.is_active===true; group.adminLocked=source.admin_locked===true; group.cover=source.cover_path||group.cover; }
 }
 const adminAlbumList=[...adminAlbumGroups.values()];
 const selectedAdminAlbum=adminAlbumGroups.get(Number(state.adminSelectedAlbum));
 const adminAlbumPanel=selectedAdminAlbum?`<div class="admin-album-detail"><button type="button" class="button secondary sm" data-admin-album-back>← All albums</button><div class="admin-album-heading"><h3>${esc(selectedAdminAlbum.title)}</h3><span>${selectedAdminAlbum.songs.length} tracks</span><button class="button secondary sm" data-entity="album" data-name="${esc(selectedAdminAlbum.title)}" data-id="${selectedAdminAlbum.id}" data-active="${selectedAdminAlbum.active?'false':'true'}">${selectedAdminAlbum.active?'Deactivate entire album':'Restore album'}</button></div><div class="admin-song-manager">${selectedAdminAlbum.songs.map(({row,live})=>`<article class="admin-song-card" data-admin-row data-search="${esc(`${row.song_title||'Song'} ${selectedAdminAlbum.artist} ${selectedAdminAlbum.title}`.toLowerCase())}" data-sort-status="${row.is_active===false?'inactive':'active'}" data-priority="${row.is_active===false?'true':'false'}">${albumArt(live,'large')}<div class="admin-song-card-copy"><strong>${esc(row.song_title||'Song')}</strong><small>${esc(selectedAdminAlbum.artist)} · ${nice(row.duration_seconds||live.duration_seconds)}</small></div>${cellStatus(row.is_active)}<button class="button secondary sm" data-entity="song" data-name="${esc(row.song_title||'Song')}" data-id="${row.song_id}" data-active="${row.is_active===false?'true':'false'}">${row.is_active===false?'Restore':'Deactivate'}</button></article>`).join('')||empty('♫','Empty album','This album has no songs yet.')}</div></div>`:`${state.adminAlbumLoadError?`<div class="notice" role="alert">Unable to load the complete album catalog: ${esc(state.adminAlbumLoadError)}. Check administrator SELECT permissions on public.album.</div>`:""}<div class="admin-albums-grid">${adminAlbumList.map(a=>`<article class="admin-album-card" data-admin-row data-search="${esc(`${a.title} ${a.artist}`.toLowerCase())}" data-sort-status="${a.active?'active':'inactive'}" data-priority="${a.active?'false':'true'}"><div class="admin-album-cover">${a.cover&&state.coverUrls?.[a.cover]?`<img src="${esc(state.coverUrls[a.cover])}" alt="" loading="lazy">`:icon('album')}</div><div class="admin-album-copy"><strong title="${esc(a.title)}">${esc(a.title)}</strong><small>${esc(a.artist)}</small><span class="admin-album-count">${a.songs.length?a.songs.length+' song'+(a.songs.length===1?'':'s'):'Draft · 0 songs'}</span>${cellStatus(a.active)}</div><div class="admin-album-actions"><button type="button" class="button secondary sm" data-admin-album-select="${a.id}">View songs</button><button type="button" class="button secondary sm" data-entity="album" data-id="${a.id}" data-name="${esc(a.title)}" data-active="${a.active?'false':'true'}">${a.active?'Deactivate':'Restore'}</button></div></article>`).join('')||empty('♫','No albums','Albums will appear here when creators add releases.')}</div>`;
 const podRows=pods.map(p=>`<tr data-admin-row data-search="${esc(`${p.show_title||'Podcast'} ${p.category||''}`.toLowerCase())}" data-priority="${p.is_active===false?'true':'false'}" data-sort-name="${esc((p.show_title||'Podcast').toLowerCase())}" data-sort-status="${p.is_active===false?'inactive':'active'}"><td data-label="Podcast"><div class="entity-cell">${p.cover_path&&state.coverUrls[p.cover_path]?`<img class="admin-cover" src="${esc(state.coverUrls[p.cover_path])}" alt="">`:`<span class="member-avatar">${icon('mic')}</span>`}<strong>${esc(p.show_title||'Podcast')}</strong></div></td><td data-label="Category">${esc(p.category||'—')}</td><td data-label="Episodes">${state.episodes.filter(e=>Number(e.show_id)===Number(p.show_id)).length}</td><td data-label="Status">${cellStatus(p.is_active)}</td><td data-label="Actions"><button class="button secondary sm" data-entity="podcast_show" data-name="${esc(p.show_title||'Podcast')}" data-id="${p.show_id}" data-active="${p.is_active===false?'true':'false'}">${p.is_active===false?'Restore':'Deactivate'}</button></td></tr>`).join('');
 const table=(heads,rows,emptyHtml)=>rows?`<div class="admin-table-wrap"><table class="admin-table"><thead><tr>${heads.map(([k,l])=>`<th><button type="button" data-admin-sort="${k}">${l}${k==='name'?' ↕':''}</button></th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`:emptyHtml;

 shell(`<section class="workspace-hero moderation-hero"><div><span class="eyebrow">ADMIN WORKSPACE</span><h2>Admin Dashboard</h2><p>Review platform analytics and moderate accounts, artists, songs, and podcasts.</p></div><span class="hero-vinyl">${icon('shield')}</span></section>
 <nav class="admin-view-tabs" aria-label="Admin views"><button class="${state.adminView==='overview'?'active':''}" data-admin-view-btn="overview">Overview</button><button class="${state.adminView==='analytics'?'active':''}" data-admin-view-btn="analytics">Analytics</button><button class="${state.adminView==='moderation'?'active':''}" data-admin-view-btn="moderation">Moderation</button></nav>
 <section class="admin-block" data-admin-view="overview" ${state.adminView!=='overview'?'hidden':''}><section class="admin-overview"><button type="button" data-admin-target="accounts" aria-label="Open Accounts moderation"><small>Active accounts</small><strong>${activeUsers}</strong><span>Review accounts</span></button><button type="button" data-admin-target="artists" aria-label="Open Artists moderation"><small>Artists</small><strong>${artists.length}</strong><span>Catalog owners</span></button><button type="button" data-admin-target="songs" aria-label="Open Songs moderation"><small>Songs</small><strong>${songs.length}</strong><span>Tracks in catalog</span></button><button type="button" data-admin-target="podcasts" aria-label="Open Podcasts moderation"><small>Podcasts</small><strong>${pods.length}</strong><span>Published shows</span></button></section><section class="admin-summary-grid"><article class="admin-summary-card"><span class="eyebrow">QUICK ACTION</span><h3>Promote trusted users</h3><p>Use the Accounts queue to grant admin access only to trusted users.</p><button class="button secondary" type="button" data-admin-open="accounts">Open accounts</button></article><article class="admin-summary-card"><span class="eyebrow">CATALOG</span><h3>${songs.length + pods.length} content items</h3><p>Songs and podcasts can be reviewed from the Moderation view with search, status filters, and attention flags.</p><button class="button secondary" type="button" data-admin-open="songs">Open moderation</button></article></section></section>
 <section class="admin-block" data-admin-view="analytics" ${state.adminView!=='analytics'?'hidden':''}>${adminChartsHtml(users)}</section>
 <section class="admin-block" data-admin-view="moderation" ${state.adminView!=='moderation'?'hidden':''}><section class="moderation-commandbar" aria-label="Moderation tools"><label class="moderation-search">${icon('search')}<input id="admin-search" type="search" autocomplete="off" placeholder="Search accounts, artists, titles…" value="${esc(state.adminQuery||'')}" aria-label="Search moderation data"></label><select id="admin-status-filter" aria-label="Filter moderation status"><option value="all" ${state.adminStatus==='all'?'selected':''}>All statuses</option><option value="active" ${state.adminStatus==='active'?'selected':''}>Active only</option><option value="inactive" ${state.adminStatus==='inactive'?'selected':''}>Inactive only</option></select><button type="button" class="button secondary ${state.adminPriority?'active':''}" id="admin-priority-filter" aria-pressed="${state.adminPriority}">${icon('shield')} Needs attention</button><span class="moderation-visible-count" id="moderation-visible-count"></span></section><nav class="admin-tabbar" aria-label="Moderation sections"><button class="${state.adminTab==='accounts'?'active':''}" data-admin-tab="accounts">Accounts</button><button class="${state.adminTab==='artists'?'active':''}" data-admin-tab="artists">Artists</button><button class="${state.adminTab==='songs'?'active':''}" data-admin-tab="songs">Albums → Songs</button><button class="${state.adminTab==='podcasts'?'active':''}" data-admin-tab="podcasts">Podcasts</button></nav><section class="admin-panel" data-admin-panel="accounts" ${state.adminTab!=='accounts'?'hidden':''}>${table([['name','Account'],['type','Type'],['joined','Joined'],['status','Status'],['actions','Actions']],accountRows,empty('◎','No account data','Account moderation data will appear when the existing admin RPC returns rows.'))}</section><section class="admin-panel" data-admin-panel="artists" ${state.adminTab!=='artists'?'hidden':''}>${table([['name','Artist'],['country','Country'],['songs','Songs'],['status','Status'],['actions','Actions']],artistRows,empty('♫','No artists to review','Artist accounts will appear here.'))}</section><section class="admin-panel" data-admin-panel="songs" ${state.adminTab!=='songs'?'hidden':''}>${adminAlbumPanel}</section><section class="admin-panel" data-admin-panel="podcasts" ${state.adminTab!=='podcasts'?'hidden':''}>${table([['name','Podcast'],['category','Category'],['episodes','Episodes'],['status','Status'],['actions','Actions']],podRows,empty('◉','No podcasts to review','Published shows will appear here.'))}</section></section>
 <dialog class="sw-modal confirm-dialog" id="admin-confirm-dialog"><div class="modal-head"><div><span class="eyebrow">CONFIRM ACTION</span><h2 id="admin-confirm-title">Are you sure?</h2></div><button type="button" class="modal-close" data-close-modal aria-label="Close confirmation">${icon('close')}</button></div><p id="admin-confirm-message" class="confirm-message"></p><div class="dialog-actions"><button type="button" class="button secondary" data-close-modal>Cancel</button><button type="button" class="button" id="admin-confirm-action">Confirm</button></div></dialog>`,'Admin Dashboard','Manage SoundWave with clearer sections.');
 // Keep moderation search immediately below the main admin tabs rather than buried
 // inside a scrolled panel. Moving the existing node preserves its input handlers.
 const adminViewTabs=document.querySelector('.admin-view-tabs');
 const moderationToolbar=document.querySelector('.moderation-commandbar');
 if(adminViewTabs && moderationToolbar){
   adminViewTabs.insertAdjacentElement('afterend',moderationToolbar);
   moderationToolbar.classList.add('moderation-top-toolbar');
 }
 const setAdminView=(view)=>{if(!['overview','analytics','moderation'].includes(view))view='overview';state.adminView=view;if(moderationToolbar)moderationToolbar.hidden=view!=='moderation';document.querySelectorAll('[data-admin-view-btn]').forEach(x=>x.classList.toggle('active',x.dataset.adminViewBtn===view));document.querySelectorAll('[data-admin-view]').forEach(x=>x.hidden=x.dataset.adminView!==view);};
 const switchTab=(tab,{scroll=true}={})=>{state.adminTab=tab;state.adminQuery='';const searchBox=document.getElementById('admin-search');if(searchBox)searchBox.value='';document.querySelectorAll('[data-admin-tab]').forEach(x=>x.classList.toggle('active',x.dataset.adminTab===tab));document.querySelectorAll('[data-admin-panel]').forEach(p=>p.hidden=p.dataset.adminPanel!==tab);document.querySelectorAll('.admin-overview [data-admin-target]').forEach(x=>{const on=x.dataset.adminTarget===tab;x.classList.toggle('active',on);x.setAttribute('aria-pressed',String(on));});if(scroll&&state.adminView==='moderation') document.querySelector('.admin-view-tabs')?.scrollIntoView({behavior:'auto',block:'start'});};
 setAdminView(state.adminView||'overview');
 switchTab(state.adminTab,{scroll:false});
 document.querySelectorAll('[data-admin-view-btn]').forEach(b=>b.onclick=()=>setAdminView(b.dataset.adminViewBtn));
 document.querySelectorAll('[data-admin-open]').forEach(b=>b.onclick=()=>{const target=b.dataset.adminOpen;setAdminView('moderation');switchTab(target,{scroll:true});requestAnimationFrame(applyModerationFilters);});
 document.querySelectorAll('.admin-overview [data-admin-target]').forEach(b=>b.onclick=()=>{setAdminView('moderation');switchTab(b.dataset.adminTarget);requestAnimationFrame(applyModerationFilters);});
 document.querySelectorAll('[data-admin-tab]').forEach(b=>b.onclick=()=>switchTab(b.dataset.adminTab));
 document.querySelectorAll('[data-admin-album-select]').forEach(b=>b.onclick=()=>{state.adminSelectedAlbum=Number(b.dataset.adminAlbumSelect);render();});
 document.querySelectorAll('[data-admin-album-back]').forEach(b=>b.onclick=()=>{state.adminSelectedAlbum=null;render();});
 const applyModerationFilters=()=>{if(state.adminView!=='moderation'){const counter=$('#moderation-visible-count');if(counter)counter.textContent='';return;}const panel=document.querySelector(`[data-admin-panel="${state.adminTab}"]`);if(!panel)return;const q=String(state.adminQuery||'').trim().toLowerCase();let visible=0,total=0;panel.querySelectorAll('[data-admin-row]').forEach(row=>{total++;const search=String(row.dataset.search||row.textContent||'').toLowerCase(),status=row.dataset.sortStatus||'active',priority=row.dataset.priority==='true';const show=(!q||search.includes(q))&&(state.adminStatus==='all'||state.adminStatus===status)&&(!state.adminPriority||priority);row.hidden=!show;if(show)visible++;});const counter=$('#moderation-visible-count');if(counter)counter.textContent=total?`${visible} of ${total} visible`:'';};
 const adminSearch=$('#admin-search'),adminStatus=$('#admin-status-filter'),adminPriority=$('#admin-priority-filter');
 if(adminSearch)adminSearch.oninput=()=>{state.adminQuery=adminSearch.value;applyModerationFilters();};
 if(adminStatus)adminStatus.onchange=()=>{state.adminStatus=adminStatus.value;applyModerationFilters();};
 if(adminPriority)adminPriority.onclick=()=>{state.adminPriority=!state.adminPriority;adminPriority.classList.toggle('active',state.adminPriority);adminPriority.setAttribute('aria-pressed',String(state.adminPriority));applyModerationFilters();};
 document.querySelectorAll('[data-admin-tab]').forEach(b=>b.addEventListener('click',()=>requestAnimationFrame(applyModerationFilters)));
 applyModerationFilters();
 const confirmDialog=$('#admin-confirm-dialog'),confirmAction=$('#admin-confirm-action');let pendingAction=null;
 const ask=(title,message,label,tone,fn)=>{pendingAction=fn;$('#admin-confirm-title').textContent=title;$('#admin-confirm-message').textContent=message;confirmAction.textContent=label;confirmAction.className=`button ${tone||''}`;confirmDialog.showModal();};
 confirmAction.onclick=()=>{const fn=pendingAction;pendingAction=null;confirmDialog.close();if(fn)fn();};
 document.querySelectorAll('[data-entity]').forEach(b=>b.onclick=()=>{const run=()=>action(async()=>{const makeActive=b.dataset.active==='true';let r;if(b.dataset.entity==='users'){r=await db.rpc('admin_set_account_active_v31',{p_user_id:b.dataset.id,p_active:makeActive});}else if(['album','song'].includes(b.dataset.entity)){r=await db.rpc('soundwave_admin_moderate_release',{p_entity:b.dataset.entity,p_id:Number(b.dataset.id),p_active:makeActive});}else{r=await db.rpc('admin_set_entity_active',{p_entity:b.dataset.entity,p_id:b.dataset.id,p_active:makeActive});}if(r?.error){if(['album','song'].includes(b.dataset.entity)&&/not found|schema cache|404|PGRST202/i.test(String(r.error.message||'')))throw Error('Run sql/RUN_ME_admin_release_locks.sql before using album/song moderation.');throw r.error;}await loadData();
 if(b.dataset.entity==='album' || b.dataset.entity==='song'){
   const table=b.dataset.entity==='album'?'album':'song';
   const key=table==='album'?'album_id':'song_id';
   const verified=await db.from(table).select('is_active,admin_locked').eq(key,Number(b.dataset.id)).single();
   if(verified.error)throw verified.error;
   if(Boolean(verified.data?.is_active)!==makeActive)throw Error('The requested moderation status did not persist. Review the moderation trigger and refresh.');
   if(table==='album'){state.adminAllAlbums=(state.adminAllAlbums||[]).map(x=>Number(x.album_id)===Number(b.dataset.id)?{...x,...verified.data}:x);}
 }
 render();toast(makeActive?'Content status verified: active':'Content status verified: inactive');});if(b.dataset.active==='false')ask(`Deactivate ${b.dataset.name}?`,`This will make ${b.dataset.name} inactive until an administrator restores it.`,'Deactivate','danger',run);else run();});
 document.querySelectorAll('[data-promote-admin]').forEach(b=>b.onclick=()=>{const name=b.dataset.promoteName||'this user',uid=b.dataset.promoteAdmin;ask('Promote to administrator?',`${name} will receive protected administrator access. Only promote users you trust.`, 'Promote to admin','approve-btn',()=>action(async()=>{const r=await db.rpc('admin_set_user_admin',{p_user_id:uid,p_make_admin:true});if(r.error){if(/function .*admin_set_user_admin|does not exist|not found/i.test(String(r.error.message||'')))throw Error('Admin promotion helper is not installed yet. Run sql/RUN_ME_admin_promotion.sql in Supabase SQL Editor, then try again.');throw r.error;}await loadData();render();toast(`${name} is now an administrator`);}));});
 document.querySelectorAll('[data-admin-sort="name"]').forEach(b=>b.onclick=()=>{const tbody=b.closest('table')?.tBodies?.[0];if(!tbody)return;const rows=[...tbody.rows],asc=b.dataset.dir!=='asc';rows.sort((x,y)=>String(x.dataset.sortName||'').localeCompare(String(y.dataset.sortName||''))*(asc?1:-1));rows.forEach(r=>tbody.append(r));b.dataset.dir=asc?'asc':'desc';});
}
function deactivatedAccountView(){
 const name=state.profile?.display_name||state.user?.email?.split('@')[0]||'SoundWave user';
 $('#app').innerHTML=`<main class="deactivated-wrap"><section class="deactivated-card"><span class="eyebrow">ACCOUNT DEACTIVATED</span><h1>${esc(name)}</h1><p id="deactivated-copy">Checking whether this account can be restored…</p><div class="inline" id="deactivated-actions"><button class="button secondary" id="deactivated-signout">Sign out</button></div></section></main>`;
 $('#deactivated-signout').onclick=()=>action(async()=>{cleanupSessionRuntime();check(await db.auth.signOut());});
 action(async()=>{
   const {data,error}=await db.rpc('my_deactivation_status_v31');
   if(error) throw error;
   const row=Array.isArray(data)?data[0]:data||{};state.deactivationStatus=row;
   const copy=$('#deactivated-copy'),actions=$('#deactivated-actions');
   if(row.admin_locked){copy.textContent='This account was deactivated by an administrator. Only an administrator can restore it.';return;}
   copy.textContent='You deactivated this account yourself. You can restore it and make your SoundWave content available again.';
   const btn=document.createElement('button');btn.className='button';btn.id='restore-account';btn.textContent='Restore account';actions.prepend(btn);
   btn.onclick=()=>action(async()=>{check(await db.rpc('restore_my_account_v31'));await loadData();render();toast('Account restored');});
 });
}



function showAsyncSkeleton(){const main=document.getElementById('main-content');if(!main||main.querySelector('.async-skeleton'))return;const el=document.createElement('div');el.className='async-skeleton';el.innerHTML='<div class="skeleton-line big"></div><div class="skeleton-line"></div><div class="skeleton-line" style="width:72%"></div><div class="skeleton-grid"><div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div></div>';main.append(el);}function hideAsyncSkeleton(){document.querySelector('.async-skeleton')?.remove();}
function enhanceAuth(){
  const show=document.querySelector('.auth-show');
  if(!show||show.querySelector('.auth-waveform')) return;
  const wave=document.createElement('div');
  wave.className='auth-waveform';
  wave.setAttribute('aria-hidden','true');
  wave.innerHTML=Array.from({length:34},(_,i)=>`<i style="--i:${i}"></i>`).join('');
  show.append(wave);
  const particles=document.createElement('div');
  particles.className='note-particles';
  particles.setAttribute('aria-hidden','true');
  particles.innerHTML=Array.from({length:14},(_,i)=>`<span style="--n:${i}">${i%3===0?'♫':i%3===1?'♪':'♬'}</span>`).join('');
  show.append(particles);
  let pulse=0;
  document.querySelectorAll('.auth-panel input,.auth-panel select').forEach(el=>{
    el.addEventListener('input',()=>{
      pulse++;
      wave.querySelectorAll('i').forEach((bar,i)=>bar.style.setProperty('--boost',String(1+((i+pulse)%7)/4)));
      wave.classList.remove('typing');
      void wave.offsetWidth;
      wave.classList.add('typing');
    });
  });
}
function burstHearts(id){if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;document.querySelectorAll(`[data-like="${id}"]`).forEach(btn=>{const b=document.createElement('span');b.className='heart-burst';b.innerHTML='<i>♥</i><i>♥</i><i>♥</i><i>♥</i><i>♥</i>';btn.append(b);setTimeout(()=>b.remove(),800);});}
// ================= COMPETITION UPGRADE: insights, realtime, search, onboarding =================
const RECENT_SEARCH_KEY='soundwave-recent-searches-v1';
function rememberSearch(q){q=String(q||'').trim();if(!q)return;state.recentSearches=[q,...state.recentSearches.filter(x=>x.toLowerCase()!==q.toLowerCase())].slice(0,6);try{localStorage.setItem(RECENT_SEARCH_KEY,JSON.stringify(state.recentSearches));}catch{}}
function recentSearchesHtml(){if(state.searchQuery||!state.recentSearches.length)return '';return `<div class="recent-searches"><span>Recent</span>${state.recentSearches.map(q=>`<button type="button" data-recent-search="${esc(q)}">${esc(q)}</button>`).join('')}</div>`;}
function searchKeyboardNav(e){if(!['ArrowDown','ArrowUp','Enter'].includes(e.key))return;const rows=[...document.querySelectorAll('#search-results .track[data-song],#search-results [data-open-artist],#search-results [data-open-album],#search-results [data-openplaylist],#search-results [data-open-show]')];if(!rows.length)return;const cur=document.activeElement?.dataset?.searchKbdIndex;let i=Number.isFinite(Number(cur))?Number(cur):-1;if(e.key==='Enter'){rememberSearch(e.currentTarget.value);if(i>=0)rows[i]?.click();return;}e.preventDefault();i=e.key==='ArrowDown'?Math.min(rows.length-1,i+1):Math.max(0,i-1);rows.forEach((r,n)=>{r.dataset.searchKbdIndex=n;r.classList.toggle('kbd-active',n===i);});rows[i]?.focus();}
function cacheSongMetadata(){try{const rows=state.songs.slice(0,50).map(s=>({song_id:s.song_id,song_title:s.song_title,duration_seconds:s.duration_seconds,genre_id:s.genre_id,cover_path:s.cover_path,album:s.album&&{album_id:s.album.album_id,album_title:s.album.album_title,artist:s.album.artist&&{artist_id:s.album.artist.artist_id,artist_name:s.album.artist.artist_name}}}));localStorage.setItem('soundwave-song-cache-v1',JSON.stringify({savedAt:Date.now(),songs:rows}));}catch{}}
function computeListeningStats(rows){const bySong=new Map(),byArtist=new Map(),byGenre=new Map(),days=new Set();let seconds=0;for(const r of rows){const s=songById(r.song_id);if(!s)continue;seconds+=Number(r.duration_played_seconds)||0;bySong.set(s.song_id,(bySong.get(s.song_id)||0)+1);const aid=s.album?.artist?.artist_id;if(aid)byArtist.set(aid,(byArtist.get(aid)||0)+1);if(s.genre_id)byGenre.set(s.genre_id,(byGenre.get(s.genre_id)||0)+1);if(r.stream_date)days.add(String(r.stream_date).slice(0,10));}let streak=0;for(let d=new Date(),i=0;i<365;i++,d.setDate(d.getDate()-1)){const k=d.toISOString().slice(0,10);if(days.has(k))streak++;else if(i>0)break;}const top=(map,lookup,n=5)=>[...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,n).map(([id,count])=>({id,count,item:lookup(id)})).filter(x=>x.item);return {minutes:Math.round(seconds/60),streak,topSongs:top(bySong,id=>songById(id)),topArtists:top(byArtist,id=>state.artists.find(a=>Number(a.artist_id)===Number(id))),favoriteGenre:top(byGenre,id=>state.genres.find(g=>Number(g.genre_id)===Number(id)),1)[0]?.item||null};}
function svgBars(items){const max=Math.max(1,...items.map(x=>x.count));return `<svg class="mini-bars" viewBox="0 0 320 110" role="img" aria-label="Top listening counts">${items.map((x,i)=>{const h=Math.max(8,(x.count/max)*78),w=44,g=18;return `<g transform="translate(${18+i*(w+g)} 0)"><rect x="0" y="${88-h}" width="${w}" height="${h}" rx="7"></rect><text x="${w/2}" y="104" text-anchor="middle">${i+1}</text></g>`}).join('')}</svg>`;}
function listeningStatsHtml(){const st=state.listeningStats;if(!st)return '';return `<section class="insights-panel"><div class="section-heading"><div><span class="eyebrow">YOUR LISTENING</span><h2>SoundWave Stats</h2></div><span class="muted small">Based on your listening history</span></div><div class="insight-grid"><div class="insight-number"><strong data-count="${st.minutes}">${st.minutes}</strong><span>minutes listened</span></div><div class="insight-number"><strong data-count="${st.streak}">${st.streak}</strong><span>day streak</span></div><div class="insight-number"><strong>${esc(st.favoriteGenre?.genre_name||'Explore more')}</strong><span>favorite genre</span></div><div class="insight-chart">${svgBars(st.topSongs)}</div></div><div class="insight-lists"><div><h3>Top artists</h3>${st.topArtists.map((x,i)=>`<button type="button" data-open-artist="${x.id}"><b>${i+1}</b><span>${esc(x.item.artist_name)}</span><small>${x.count} plays</small></button>`).join('')||'<p class="muted">Listen to artists to build your stats.</p>'}</div><div><h3>Top songs</h3>${st.topSongs.map((x,i)=>`<button type="button" data-play="${x.id}"><b>${i+1}</b><span>${esc(x.item.song_title)}</span><small>${x.count} plays</small></button>`).join('')||'<p class="muted">Your top tracks will appear here.</p>'}</div></div></section>`;}
function weeklyTopHtml(){if(!state.topWeekSongs.length)return '';return `<section class="weekly-mix"><div class="weekly-cover"><span>7</span><small>DAYS</small></div><div><span class="eyebrow">AUTO PLAYLIST</span><h2>Your Top Songs of the Week</h2><p>${state.topWeekSongs.length} tracks ranked from your real listening history. It updates automatically.</p><div class="inline"><button type="button" class="button" data-play-ids="${state.topWeekSongs.map(s=>s.song_id).join(',')}">${icon('play')} Play mix</button><span class="muted small">Cannot be deleted</span></div></div></section>`;}
function chartBars(items,{label='name',value='value',maxItems=6}={}){const rows=(items||[]).slice(0,maxItems),max=Math.max(1,...rows.map(x=>Number(x[value])||0));return `<div class="rank-bars">${rows.map((x,i)=>`<div class="rank-bar"><div><span>${i+1}</span><strong>${esc(x[label]||'Unknown')}</strong><b>${Number(x[value])||0}</b></div><i><s style="width:${Math.max(4,((Number(x[value])||0)/max)*100)}%"></s></i></div>`).join('')||'<p class="muted small">No stream data is visible yet.</p>'}</div>`;}
function roleDistributionHtml(users=[]){const counts={Listener:0,Artist:0,Admin:0};for(const u of users){const t=String(u.account_type||'Listener');counts[t]=(counts[t]||0)+1;}if(hasAdminAccess())counts.Admin=Math.max(counts.Admin,1);const total=Math.max(1,Object.values(counts).reduce((a,b)=>a+b,0));return `<div class="role-distribution">${Object.entries(counts).map(([k,v])=>`<div><span><i class="role-dot role-${k.toLowerCase()}"></i>${k}</span><strong>${v}</strong><small>${Math.round(v/total*100)}%</small></div>`).join('')}</div>`;}
function artistChartData(){const bySong=new Map(),byAlbum=new Map();for(const r of state.artistThirtyDay||[]){bySong.set(Number(r.song_id),(bySong.get(Number(r.song_id))||0)+1);const song=songById(r.song_id),al=song?.album?.album_title||'Unknown release';byAlbum.set(al,(byAlbum.get(al)||0)+1);}const topSongs=[...bySong.entries()].map(([id,value])=>({name:songById(id)?.song_title||`Song ${id}`,value,id})).sort((a,b)=>b.value-a.value);const releases=[...byAlbum.entries()].map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);return {topSongs,releases,most:topSongs[0]||null,unique:new Set((state.artistThirtyDay||[]).map(r=>String(r.user_id))).size};}
function analyticsSongTitle(id){return songById(id)?.song_title||state.analyticsSongNames?.[Number(id)]||'Inactive or unavailable track';}
function adminChartData(){const rows=state.adminAnalyticsHistory||[],days=Array(30).fill(0),bySong=new Map(),byArtist=new Map();for(const r of rows){const diff=Math.floor((Date.now()-new Date(r.stream_date).getTime())/86400000);if(diff>=0&&diff<30)days[29-diff]++;bySong.set(Number(r.song_id),(bySong.get(Number(r.song_id))||0)+1);const song=songById(r.song_id),aid=song?.album?.artist?.artist_id;if(aid)byArtist.set(Number(aid),(byArtist.get(Number(aid))||0)+1);}const topSongs=[...bySong.entries()].map(([id,value])=>({name:analyticsSongTitle(id),value})).sort((a,b)=>b.value-a.value);const topArtists=[...byArtist.entries()].map(([id,value])=>({name:state.artists.find(a=>Number(a.artist_id)===id)?.artist_name||`Artist ${id}`,value})).sort((a,b)=>b.value-a.value);return {days,topSongs,topArtists,most:topSongs[0]||null,total:rows.length,unique:new Set(rows.map(r=>String(r.user_id))).size};}
function artistChartsHtml(){const d=artistChartData(),days=Array(30).fill(0);for(const r of state.artistThirtyDay||[]){const x=Math.floor((Date.now()-new Date(r.stream_date).getTime())/86400000);if(x>=0&&x<30)days[29-x]++;}return `<section class="analytics-suite artist-suite">${state.analyticsSyncError?`<div class="notice compact-notice">Analytics refresh failed. Showing the last successfully loaded server data.</div>`:''}<div class="section-heading"><div><span class="eyebrow">PERFORMANCE</span><h2>Music analytics</h2></div><span class="muted small">Last 30 days</span></div><div class="chart-grid"><article class="chart-card chart-wide"><div class="chart-head"><div><small>Stream trend</small><strong>${state.artistThirtyDay.length}</strong></div><span>30 days</span></div>${sparkline(days)}</article><article class="chart-card"><div class="chart-head"><div><small>Most streamed song</small><strong class="chart-title">${esc(d.most?.name||'No streams yet')}</strong></div><span>${d.most?.value||0} plays</span></div>${chartBars(d.topSongs)}</article><article class="chart-card"><div class="chart-head"><div><small>Streams by release</small><strong>${d.releases.length}</strong></div><span>releases</span></div>${chartBars(d.releases)}</article><article class="chart-card"><div class="chart-head"><div><small>Unique listeners</small><strong>${d.unique}</strong></div><span>visible listeners</span></div><div class="metric-ring"><span>${d.unique}</span><small>people</small></div></article></div></section>`;}
function adminChartsHtml(users=[]){const d=adminChartData();return `<section class="analytics-suite admin-suite">${state.analyticsSyncError?`<div class="notice compact-notice">Analytics refresh failed. Showing the last successfully loaded server data.</div>`:''}<div class="section-heading"><div><span class="eyebrow">PLATFORM ANALYTICS</span><h2>What is happening on SoundWave</h2></div><span class="muted small">Qualified streams · 30s+ or completed</span></div><div class="chart-grid"><article class="chart-card chart-wide"><div class="chart-head"><div><small>Streams</small><strong>${d.total}</strong></div><span>last 30 days</span></div>${sparkline(d.days)}</article><article class="chart-card"><div class="chart-head"><div><small>Most streamed songs</small><strong class="chart-title">${esc(d.most?.name||'No streams yet')}</strong></div><span>${d.most?.value||0} plays</span></div>${chartBars(d.topSongs)}</article><article class="chart-card"><div class="chart-head"><div><small>Top artists</small><strong>${d.topArtists.length}</strong></div><span>by streams</span></div>${chartBars(d.topArtists)}</article><article class="chart-card"><div class="chart-head"><div><small>Account mix</small><strong>${users.length}</strong></div><span>accounts</span></div>${roleDistributionHtml(users)}</article></div></section>`;}
function sparkline(rows){const pts=rows.length?rows:[0];const max=Math.max(1,...pts);return `<svg class="sparkline" viewBox="0 0 360 95" preserveAspectRatio="none" aria-label="30 day streams"><polyline points="${pts.map((v,i)=>`${(i/(pts.length-1||1))*360},${88-(v/max)*72}`).join(' ')}" fill="none" vector-effect="non-scaling-stroke"></polyline></svg>`;}
function artistAnalyticsHtml(){if(!state.artist)return '';const days=Array(30).fill(0);for(const r of state.artistThirtyDay){const diff=Math.floor((Date.now()-new Date(r.stream_date).getTime())/86400000);if(diff>=0&&diff<30)days[29-diff]++;}const roy=state.royaltySummary||{};const rate=Number(roy.royalty_rate||0);return `<section class="artist-analytics"><div class="section-heading"><div><span class="eyebrow">LAST 30 DAYS</span><h2>Audience pulse</h2></div></div><div class="artist-analytics-grid"><div class="analytics-chart"><strong>${state.artistThirtyDay.length}</strong><span>visible streams</span>${sparkline(days)}</div><div class="top-listeners"><h3>Top listeners</h3>${state.artistTopListeners.map((x,i)=>`<div><span class="member-avatar">${i+1}</span><strong>${esc(x.name)}</strong><small>${x.count} streams</small></div>`).join('')||'<p class="muted small">No listener rows are visible under the current RLS policy yet.</p>'}</div><div class="royalty-calc"><h3>Royalty estimator</h3><strong>₱${(state.artistThirtyDay.length*rate).toFixed(2)}</strong><small>${state.artistThirtyDay.length} streams × ₱${rate.toFixed(4)}</small></div></div></section>`;}
function episodeProgressHtml(ep){const h=state.podcastHistory.find(x=>String(x.episode_id)===String(ep.episode_id));const pos=Number(h?.resume_position_seconds)||0,dur=Number(ep.duration_seconds)||0,pct=dur?Math.min(100,(pos/dur)*100):0;return pct>1?`<div class="episode-progress" title="Resume at ${nice(pos)}"><span style="width:${pct}%"></span></div>`:'';}
function friendNowHtml(){if(!state.friendNow.length)return '';return `<section class="rail-card friend-now"><h4>Friends listening now</h4>${state.friendNow.slice(0,5).map(x=>`<button type="button" data-play="${x.song_id}"><span class="presence-dot"></span><span><strong>${esc(x.name)}</strong><small>${esc(x.song_title)} · ${esc(x.artist_name)}</small></span></button>`).join('')}</section>`;}
function friendActivityHtml(){if(!state.friendActivity.length)return '';return `<section class="rail-card friend-feed"><h4>Friend activity</h4>${state.friendActivity.slice(0,6).map(x=>`<div><span class="member-avatar">${esc(x.initial)}</span><p><strong>${esc(x.name)}</strong> ${esc(x.text)}<small>${esc(agoText(x.at))}</small></p></div>`).join('')}</section>`;}
function playlistPresenceHtml(){if(!state.playlistPresence.length)return '<span class="muted small">Live collaboration ready</span>';return `<span class="presence-label">Viewing now</span>${state.playlistPresence.slice(0,5).map((p,i)=>`<span class="presence-avatar" title="${esc(p.name)}">${esc((p.name||'?')[0].toUpperCase())}</span>`).join('')}`;}
let realtimeChannel=null,playlistPresenceChannel=null,adminStreamChannel=null,creatorStreamChannel=null,podcastCreatorChannel=null;
function normalizeAnalyticsRpcRows(data){
  let rows=data;
  if(typeof rows==='string'){try{rows=JSON.parse(rows);}catch{return null;}}
  if(rows&&typeof rows==='object'&&!Array.isArray(rows)&&Array.isArray(rows.rows))rows=rows.rows;
  if(!Array.isArray(rows))return null;
  return uniqueStreamRows(rows).filter(isQualifiedStream);
}
async function fetchArtistServerStreams(days=ANALYTICS_WINDOW_DAYS){
  if(!state.artist)return null;
  const artistId=Number(state.artist.artist_id);
  let rpc=await db.rpc('artist_stream_rows_v26',{p_artist_id:artistId,p_days:days});
  if(!rpc.error){state.analyticsSyncError='';return normalizeAnalyticsRpcRows(rpc.data)??[];}
  console.warn('v26 artist analytics RPC unavailable:',rpc.error);
  // Backward-compatible fallback while the v26 SQL is being installed.
  rpc=await db.rpc('artist_stream_rows',{p_days:days});
  if(rpc.error){state.analyticsSyncError=humanErr(rpc.error);console.warn('Artist analytics sync failed:',rpc.error);return null;}
  state.analyticsSyncError='';
  return normalizeAnalyticsRpcRows(rpc.data)??[];
}
async function fetchAdminServerStreams(days=ANALYTICS_WINDOW_DAYS){
  if(!hasAdminAccess())return null;
  let rpc=await db.rpc('admin_stream_rows_v26',{p_days:days});
  let rows=null;
  if(!rpc.error) rows=normalizeAnalyticsRpcRows(rpc.data)??[];
  else{
    console.warn('v26 admin analytics RPC unavailable:',rpc.error);
    rpc=await db.rpc('admin_stream_rows',{p_days:days});
    if(rpc.error){state.analyticsSyncError=humanErr(rpc.error);console.warn('Admin analytics sync failed:',rpc.error);return null;}
    rows=normalizeAnalyticsRpcRows(rpc.data)??[];
  }
  state.analyticsSyncError='';
  const missing=[...new Set(rows.map(r=>Number(r.song_id)).filter(id=>id&&!songById(id)&&!state.analyticsSongNames?.[id]))];
  if(missing.length){
    const meta=await db.from('song').select('song_id,song_title').in('song_id',missing).limit(500);
    if(!meta.error){state.analyticsSongNames={...(state.analyticsSongNames||{}),...Object.fromEntries((meta.data||[]).map(s=>[Number(s.song_id),s.song_title]))};}
  }
  return rows;
}
async function refreshCrossDeviceMetrics({renderIfNeeded=true}={}){
  if(!state.user)return;
  try{
    let changed=false;
    if(state.artist){
      const rows=await fetchArtistServerStreams(ANALYTICS_WINDOW_DAYS);
      if(rows){
        state.artistThirtyDay=rows;
        const listeners=new Map();rows.forEach(r=>listeners.set(String(r.user_id),(listeners.get(String(r.user_id))||0)+1));
        state.artistTopListeners=[...listeners.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5).map(([uid,count])=>({uid,count,name:state.socialProfiles[uid]?.display_name||`Listener ${String(uid).slice(0,6)}`}));
        changed=true;
      }
    }
    if(hasAdminAccess()){
      const rows=await fetchAdminServerStreams(ANALYTICS_WINDOW_DAYS);
      if(rows){state.adminAnalyticsHistory=rows;changed=true;}
    }
    if(changed&&renderIfNeeded&&['artist-dashboard','studio','admin','admin-dashboard','album-detail'].includes(state.page))render();
  }catch(e){console.warn('Cross-device analytics refresh failed',e);}
}
function hasOpenFileWorkflow(){return !!document.querySelector('dialog[open], input[type="file"]:focus');}
function bindCrossDeviceRefresh(){
  if(state.crossDeviceRefreshBound)return;
  state.crossDeviceRefreshBound=true;
  let lastHiddenAt=0;
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')lastHiddenAt=Date.now();else if(!hasOpenFileWorkflow()&&Date.now()-lastHiddenAt>1200)void refreshCrossDeviceMetrics();});
  window.addEventListener('focus',()=>{setTimeout(()=>{if(!hasOpenFileWorkflow())void refreshCrossDeviceMetrics();},500);});
}
async function handleSuspendedAccount(message='This account has been suspended by an administrator.'){
  if(state.profile) state.profile={...state.profile,is_active:false};
  try{await stopAudio();}catch(e){console.warn('Could not stop playback during suspension',e);}
  state.player=null;
  render();
  toast(message,true);
}
async function verifyAccountAccess({silent=false}={}){
  if(!state.user?.id||accountStatusChecking)return state.profile?.is_active!==false;
  accountStatusChecking=true;
  try{
    const {data,error}=await db.from('users').select('is_active').eq('user_id',state.user.id).maybeSingle();
    if(error){if(!silent)console.warn('Account access check failed',error);return state.profile?.is_active!==false;}
    const active=data?.is_active!==false;
    if(state.profile)state.profile={...state.profile,is_active:active};
    if(!active){await handleSuspendedAccount();return false;}
    return true;
  }finally{accountStatusChecking=false;}
}
async function requirePlaybackAccess(){
  const allowed=await verifyAccountAccess();
  if(!allowed)throw Error('This account is suspended. Playback is disabled until an administrator restores it.');
  return true;
}
function setupAccountAccessGuard(){
  if(!db||!state.user?.id)return;
  if(accountStatusTimer)clearInterval(accountStatusTimer);
  accountStatusTimer=setInterval(()=>{if(state.user?.id)void verifyAccountAccess({silent:true});},5000);
  if(accountStatusChannel){db.removeChannel(accountStatusChannel);accountStatusChannel=null;}
  accountStatusChannel=db.channel(`soundwave-account-access-${state.user.id}`)
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'users',filter:`user_id=eq.${state.user.id}`},payload=>{
      if(payload.new?.is_active===false)void handleSuspendedAccount();
    }).subscribe();
}
function setupRealtime(){
 if(!db||!state.user)return;
 setupAccountAccessGuard();
 if(realtimeChannel)db.removeChannel(realtimeChannel);
 if(adminStreamChannel){db.removeChannel(adminStreamChannel);adminStreamChannel=null;}
 if(creatorStreamChannel){db.removeChannel(creatorStreamChannel);creatorStreamChannel=null;}
 if(podcastCreatorChannel){db.removeChannel(podcastCreatorChannel);podcastCreatorChannel=null;}
 realtimeChannel=db.channel(`soundwave-listening-${state.user.id}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'listening_history'},payload=>{const r=payload.new||{},followed=new Set(state.following.map(x=>String(x.followed_user_id)));if(!followed.has(String(r.user_id)))return;const s=songById(r.song_id);const prof=state.socialProfiles[String(r.user_id)];if(!s)return;state.friendNow=[{user_id:r.user_id,song_id:r.song_id,name:prof?.display_name||'A friend',song_title:s.song_title,artist_name:s.album?.artist?.artist_name||'SoundWave',at:r.stream_date||new Date().toISOString()},...state.friendNow.filter(x=>String(x.user_id)!==String(r.user_id))].slice(0,8);refreshRail();}).subscribe();
 if(state.artist&&state.ownedSongs.length){
   const ownedIds=new Set(state.ownedSongs.map(s=>Number(s.song_id)));
   const refreshArtist=payload=>{const r=payload.new||{};if(!ownedIds.has(Number(r.song_id)))return;void refreshStreamMetrics();};
   creatorStreamChannel=db.channel(`soundwave-artist-streams-${state.user.id}`)
     .on('postgres_changes',{event:'INSERT',schema:'public',table:'listening_history'},refreshArtist)
     .on('postgres_changes',{event:'UPDATE',schema:'public',table:'listening_history'},refreshArtist)
     .subscribe();
 }
 if(state.myShows?.length){
   const ownShowIds=new Set(state.myShows.map(s=>Number(s.show_id)));
   const ownEpisodeIds=new Set((state.episodes||[]).filter(ep=>ownShowIds.has(Number(ep.show_id))).map(ep=>Number(ep.episode_id)));
   const refreshPodcast=payload=>{const r=payload.new||{};if(!ownEpisodeIds.has(Number(r.episode_id)))return;void refreshPodcastStudioMetrics();};
   podcastCreatorChannel=db.channel(`soundwave-podcast-streams-${state.user.id}`)
     .on('postgres_changes',{event:'INSERT',schema:'public',table:'podcast_listening_history'},refreshPodcast)
     .on('postgres_changes',{event:'UPDATE',schema:'public',table:'podcast_listening_history'},refreshPodcast)
     .subscribe();
 }
 if(hasAdminAccess()){
  const refreshAdmin=()=>{void refreshCrossDeviceMetrics();};
  adminStreamChannel=db.channel(`soundwave-admin-streams-${state.user.id}`)
   .on('postgres_changes',{event:'INSERT',schema:'public',table:'listening_history'},refreshAdmin)
   .on('postgres_changes',{event:'UPDATE',schema:'public',table:'listening_history'},refreshAdmin)
   .subscribe();
 }
}
function setupPlaylistPresence(){if(!db||!state.user||state.page!=='playlists'||!state.selectedPlaylist){if(playlistPresenceChannel){db.removeChannel(playlistPresenceChannel);playlistPresenceChannel=null;}return;}const id=state.selectedPlaylist;if(playlistPresenceChannel)db.removeChannel(playlistPresenceChannel);playlistPresenceChannel=db.channel(`playlist-presence-${id}`,{config:{presence:{key:state.user.id}}});playlistPresenceChannel.on('presence',{event:'sync'},()=>{const pres=playlistPresenceChannel.presenceState();state.playlistPresence=Object.values(pres).flat().filter(Boolean).map(x=>({user_id:x.user_id,name:x.name||'Listener'}));const el=document.getElementById('playlist-presence');if(el)el.innerHTML=playlistPresenceHtml();}).subscribe(async status=>{if(status==='SUBSCRIBED')await playlistPresenceChannel.track({user_id:state.user.id,name:state.profile?.display_name||'Listener',at:new Date().toISOString()});});}
async function loadCompetitionData(){if(!state.user)return;try{state.recentSearches=JSON.parse(localStorage.getItem(RECENT_SEARCH_KEY)||'[]').slice(0,6);}catch{state.recentSearches=[];}if(!state.songs.length){try{const cached=JSON.parse(localStorage.getItem('soundwave-song-cache-v1')||'{}');if(Array.isArray(cached.songs)&&cached.songs.length){state.songs=cached.songs;toast('You are viewing your recent SoundWave catalog offline.');}}catch{}}const now=Date.now(),since90=new Date(now-90*86400000).toISOString(),since30=new Date(now-30*86400000).toISOString();const hist=await db.from('listening_history').select('stream_id,user_id,song_id,stream_date,duration_played_seconds,completion_status').eq('user_id',state.user.id).gte('stream_date',since90).order('stream_date',{ascending:false}).limit(1500);state.insightHistory=hist.error?(state.history||[]):mergeStreamHistory(hist.data||[], readCachedHistory());state.listeningStats=computeListeningStats(state.insightHistory);const weekCut=now-7*86400000,counts=new Map();state.insightHistory.filter(r=>new Date(r.stream_date).getTime()>=weekCut).forEach(r=>counts.set(Number(r.song_id),(counts.get(Number(r.song_id))||0)+1));state.topWeekSongs=[...counts.entries()].sort((a,b)=>b[1]-a[1]).map(([id])=>songById(id)).filter(Boolean).slice(0,20);cacheSongMetadata();const friendIds=[...new Set(state.following.map(x=>x.followed_user_id).filter(Boolean))];state.friendActivity=[];state.friendNow=[];if(friendIds.length){const [fh,likes,pls,social]=await Promise.all([db.from('listening_history').select('user_id,song_id,stream_date').in('user_id',friendIds).order('stream_date',{ascending:false}).limit(40),db.from('saved_song').select('user_id,song_id,date_saved,liked_at').in('user_id',friendIds).limit(60),db.from('playlist').select('user_id,playlist_name,created_at,date_created').in('user_id',friendIds).eq('is_active',true).limit(40),db.from('user_follow').select('follower_user_id,followed_user_id,date_followed,created_at').in('follower_user_id',friendIds).limit(100)]);if(!fh.error)state.friendNow=(fh.data||[]).filter(r=>now-new Date(r.stream_date).getTime()<10*60*1000).map(r=>{const s=songById(r.song_id),p=state.socialProfiles[String(r.user_id)];return s?{user_id:r.user_id,song_id:r.song_id,name:p?.display_name||'A friend',song_title:s.song_title,artist_name:s.album?.artist?.artist_name||'SoundWave',at:r.stream_date}:null;}).filter(Boolean).filter((x,i,a)=>a.findIndex(y=>String(y.user_id)===String(x.user_id))===i);const events=[];if(!likes.error)(likes.data||[]).forEach(r=>{const s=songById(r.song_id),p=state.socialProfiles[String(r.user_id)];if(s)events.push({name:p?.display_name||'A friend',initial:(p?.display_name||'F')[0],text:`liked ${s.song_title}`,at:r.date_saved||r.liked_at||new Date().toISOString()});});if(!pls.error)(pls.data||[]).forEach(r=>{const p=state.socialProfiles[String(r.user_id)];events.push({name:p?.display_name||'A friend',initial:(p?.display_name||'F')[0],text:`created ${r.playlist_name||'a playlist'}`,at:r.created_at||r.date_created||new Date().toISOString()});});if(!social.error)(social.data||[]).forEach(r=>{const uid=r.follower_user_id||r.follower_id||r.user_id;if(!friendIds.some(x=>String(x)===String(uid)))return;const p=state.socialProfiles[String(uid)];events.push({name:p?.display_name||'A friend',initial:(p?.display_name||'F')[0],text:'followed someone new',at:r.date_followed||r.created_at||new Date().toISOString()});});state.friendActivity=events.sort((a,b)=>new Date(b.at)-new Date(a.at)).slice(0,20);}if(state.artist&&state.ownedSongs.length){const initialArtistRows=await fetchArtistServerStreams(ANALYTICS_WINDOW_DAYS);if(initialArtistRows!==null)state.artistThirtyDay=initialArtistRows;const counts2=new Map();state.artistThirtyDay.forEach(r=>counts2.set(String(r.user_id),(counts2.get(String(r.user_id))||0)+1));state.artistTopListeners=[...counts2.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5).map(([uid,count])=>({uid,count,name:state.socialProfiles[uid]?.display_name||`Listener ${String(uid).slice(0,6)}`}));}
if(hasAdminAccess()){const initialAdminRows=await fetchAdminServerStreams(ANALYTICS_WINDOW_DAYS);if(initialAdminRows!==null)state.adminAnalyticsHistory=initialAdminRows;}else state.adminAnalyticsHistory=[];
await refreshPodcastRecommendationSignals();state.competitionLoaded=true;}
function showOnboarding(){
 const roleKey=hasAdminAccess()?(hasArtistAccess()?'artist-admin':'admin'):hasArtistAccess()?'artist':'listener';
 const key=`soundwave-onboarded-${roleKey}-${state.user?.id}`;if(!state.user||localStorage.getItem(key))return;
 const tours={
  listener:[['Welcome to Discover','Discover brings albums, recommendations, new releases, artists and podcasts into one focused page.','♫'],['Search and save','Find music fast, like songs, follow artists and build playlists.','♥'],['Keep the music moving','Use the player, queue and podcast resume tools across desktop and mobile.','▶']],
  artist:[['Welcome to Artist Studio','Your sidebar has one clear Studio entry for releases and performance.','✦'],['Publish with confidence','Create albums and songs using your existing SoundWave catalog workflow.','♫'],['Read your audience','Track streams, top listeners and royalty estimates without leaving Studio.','↗']],
  admin:[['Welcome to Moderation','Your sidebar has one clear Moderation entry for protected admin work.','◆'],['Review safely','Manage accounts, artists, songs and podcasts through existing RLS/RPC rules.','✓'],['Stay focused','Listener tools remain available, but dashboard links no longer compete for attention.','◎']],
  'artist-admin':[['Two roles, two workspaces','Artist Studio and Moderation are the only dashboard destinations in your sidebar.','✦'],['Create and review','Publish your own catalog in Studio, then switch to Moderation for protected admin actions.','◆'],['No duplicate routes','Profile and top-bar dashboard shortcuts are removed to keep navigation predictable.','✓']]
 };
 const slides=tours[roleKey];let i=0;const wrap=document.createElement('div');wrap.className='onboarding';
 const close=()=>{localStorage.setItem(key,'1');wrap.remove();};
 const draw=()=>{const [t,d,ico]=slides[i];wrap.innerHTML=`<div class="onboarding-card"><div class="onboarding-illustration">${ico}<i></i><i></i><i></i></div><span class="eyebrow">${roleKey.replace('-',' + ').toUpperCase()} TOUR · ${i+1}/3</span><h2>${t}</h2><p>${d}</p><div class="onboarding-dots">${slides.map((_,n)=>`<span class="${n===i?'active':''}"></span>`).join('')}</div><div class="inline"><button class="button secondary" id="tour-skip">Skip</button><button class="button" id="tour-next">${i===2?'Done':'Next'}</button></div></div>`;wrap.querySelector('#tour-skip').onclick=close;wrap.querySelector('#tour-next').onclick=()=>{if(i===2)close();else{i++;draw();}};};
 document.body.append(wrap);draw();}
function animateCounters(){document.querySelectorAll('[data-count]').forEach(el=>{const end=Number(el.dataset.count)||0;if(matchMedia('(prefers-reduced-motion: reduce)').matches){el.textContent=end;return;}let start=0,t0=performance.now();const tick=t=>{const p=Math.min(1,(t-t0)/700);el.textContent=Math.round(end*(1-Math.pow(1-p,3)));if(p<1)requestAnimationFrame(tick)};requestAnimationFrame(tick);});}
function afterCompetitionRender(){document.getElementById('app')?.classList.add('route-enter');requestAnimationFrame(()=>document.getElementById('app')?.classList.remove('route-enter'));animateCounters();setupPlaylistPresence();showOnboarding();}

function notFound(){state.tint='#37204a';shell(`<section class="not-found"><div class="not-found-code">404</div><div><span class="eyebrow">TRACK NOT FOUND</span><h2>This page skipped a beat.</h2><p>The link may be old, private, or unavailable to your account.</p><button type="button" class="button" data-nav="discover">Back to SoundWave</button></div></section>`,'Lost in the mix','');}
function render() {
  if (requireConfig()) return;
  if (!state.user) { authView(); return; }
  if (state.profile && state.profile.is_active === false) { deactivatedAccountView(); return; }
  if (!pageAllowed(state.page)) state.page = 'discover';
  if (state.karaokeMode && !['music','discover','artist-detail','album-detail','playlists'].includes(state.page)) {state.karaokeMode=false;document.body.classList.remove('karaoke-mode');}
  switch (state.page) {
    case 'discover': discoverPage(); break;
    case 'home': home(); break;
    case 'listener-dashboard': discoverPage(); break;
    case 'artist-dashboard': artistDashboard(); break;
    case 'admin-dashboard': adminDashboard(); break;
    case 'history': history(); refreshHistory(); break;
    case 'music': music(); break;
    case 'artists': artists(); break;
    case 'artist-detail': artistDetail(); break;
    case 'album-detail': albumDetail(); break;
    case 'liked-artists': likedArtists(); break;
    case 'liked-songs': likedSongsPage(); break;
    case 'followers': followers(); break;
    case 'profile': profile(); break;
    case 'playlists': playlists(); break;
    case 'downloads': downloadsPage(); break;
    case 'podcasts': podcasts(); break;
    case 'podcast-studio': podcastStudio(); break;
    case 'plans': plans(); break;
    case 'studio': studio(); break;
    case 'admin': admin(); break;
    case 'not-found': notFound(); break;
    default: home();
  }
  afterRender();
  afterCompetitionRender();
}
async function acceptPendingPlaylistInvite(){
 if(state.playlistInviteHandled||!state.user)return;
 const token=new URLSearchParams(location.search).get('playlist_invite');
 if(!token)return;
 state.playlistInviteHandled=true;
 try{
   const data=check(await db.rpc('accept_playlist_invite',{p_token:token}));
   toast('Playlist collaboration accepted');
   await loadData();
   const u=new URL(window.location.href);
   u.searchParams.delete('playlist_invite');
   const cleanUrl=u.pathname+u.search+(u.hash||'#/playlists');
   window.history.replaceState(window.history.state||{},document.title,cleanUrl);
 }catch(e){console.error(e);toast(humanErr(e),true);}
}
async function ensureOAuthProfile(user){
  if(!user?.id)return;
  const existing=await db.from('users').select('user_id').eq('user_id',user.id).maybeSingle();
  if(existing.error && existing.error.code!=='PGRST116') console.warn('Could not check OAuth profile',existing.error);
  if(existing.data)return;
  const meta=user.user_metadata||{};
  const display=String(meta.full_name||meta.name||user.email?.split('@')[0]||'SoundWave Listener').trim().slice(0,100);
  const payload={user_id:user.id,display_name:display||'SoundWave Listener',account_type:'Listener',is_active:true};
  const created=await db.from('users').insert(payload);
  if(created.error && !/duplicate|already exists|23505/i.test(String(created.error.message||''))) console.warn('Could not create OAuth listener profile',created.error);
}
async function waitForAuthSession(timeoutMs=7000){
  const started=Date.now();
  while(Date.now()-started<timeoutMs){
    const {data,error}=await db.auth.getSession();
    if(error)throw error;
    if(data?.session?.user)return data.session;
    await new Promise(resolve=>setTimeout(resolve,150));
  }
  return null;
}
function cleanOAuthUrl(){
  const u=new URL(window.location.href);
  ['code','oauth','error','error_code','error_description'].forEach(k=>u.searchParams.delete(k));
  if(/^#(?:access_token|error|type|expires_in|provider_token)/i.test(u.hash||''))u.hash='#/discover';
  window.history.replaceState(window.history.state||{},document.title,`${u.pathname}${u.search}${u.hash||'#/discover'}`);
  sessionStorage.removeItem('soundwave-oauth-return');
}
async function completeOAuthReturn(){
  const params=new URLSearchParams(location.search);
  const oauthError=params.get('error_description')||params.get('error');
  if(oauthError){const err=new Error(oauthError);err.code=params.get('error_code')||'oauth_error';cleanOAuthUrl();throw err;}
  // A code beginning with 4/ is a Google authorization code. It must never be
  // delivered directly to the SPA; Google must redirect to Supabase first.
  const rawCode=params.get('code')||'';
  if(/^4\//.test(rawCode)){
    const err=new Error('Google returned a raw authorization code directly to SoundWave. In Google Cloud Console, the Authorized redirect URI must be exactly https://azqbzyxknfdwfuqevbrd.supabase.co/auth/v1/callback. Remove any soundwave-gold.vercel.app redirect URI from the Google OAuth client.');
    err.code='google_redirect_misconfigured';
    cleanOAuthUrl();
    throw err;
  }
  const expected=sessionStorage.getItem('soundwave-oauth-return')==='google'||/access_token=|error_description=/i.test(String(location.hash||''));
  if(!expected)return null;
  const session=await waitForAuthSession(12000);
  if(!session){const err=new Error('Google returned to SoundWave, but Supabase did not create a session. Check the Supabase redirect URL and Google OAuth callback settings.');err.code='oauth_session_missing';throw err;}
  cleanOAuthUrl();
  return session;
}
async function boot(){
 if(requireConfig())return;
 captureMayaReturn();
 try{
   let oauthSession=null;
   const oauthParams=new URLSearchParams(location.search);
   if(oauthParams.has('code')||oauthParams.has('error')||/access_token=|error_description=/i.test(String(location.hash||''))||sessionStorage.getItem('soundwave-oauth-return')==='google'){
     oauthSession=await completeOAuthReturn();
   }
   let result=oauthSession?{data:{session:oauthSession},error:null}:await db.auth.getSession();
   if(result.error)throw result.error;
   state.user=result.data.session?.user||null;state.hist.i=window.history.state?.i??0;state.hist.max=state.hist.i;
   if(state.user){
     await ensureOAuthProfile(state.user);
     await loadData();await loadCompetitionData();await restoreLastSongPlayer();setupRealtime();bindCrossDeviceRefresh();await acceptPendingPlaylistInvite();
     const matched=applyHash(location.hash),firstRoleEntry=!sessionStorage.getItem('soundwave-role-entry');
     const roleLanding=defaultLanding(),listenerLanding=roleLanding==='discover';
     if(!matched||(firstRoleEntry&&/^#\/(?:discover|home)?$/.test(location.hash||'#/discover'))||(!listenerLanding&&state.page==='discover'))state.page=roleLanding;
     sessionStorage.setItem('soundwave-role-entry','1');
   }
   await routeLoad();
   if(state.user){setTimeout(()=>acceptPendingSubscriptionInvite(),120);schedulePendingPaymentVerification(180);}
 }catch(e){
   console.error(e);state.error=humanErr(e);
   let session=null;try{session=(await db.auth.getSession()).data?.session||null;}catch{}
   if(session?.user){
     state.user=session.user;
     try{await ensureOAuthProfile(state.user);await loadData();}catch(dataErr){console.error('Authenticated, but app data initialization failed',dataErr);state.error=`Signed in, but SoundWave could not load all account data: ${humanErr(dataErr)}`;}
     render();toast(state.error,true);
   }else{authView();toast(state.error,true);}
 }
 db.auth.onAuthStateChange((event,session)=>{
   setTimeout(()=>{action(async()=>{
     const newUser=session?.user||null;if(newUser?.id===state.user?.id)return;
     await stopAudio();cleanupSessionRuntime();state.user=newUser;state.coverUrls={};state.selectedPlaylist=null;state.page='discover';state.routeReady=false;
     if(newUser){await ensureOAuthProfile(newUser);await loadData();await loadCompetitionData();await restoreLastSongPlayer();setupRealtime();bindCrossDeviceRefresh();state.playlistInviteHandled=false;await acceptPendingPlaylistInvite();state.page=defaultLanding();}
     render();
     if(newUser){setTimeout(()=>acceptPendingSubscriptionInvite(),120);schedulePendingPaymentVerification(180);}
   });},0);
 });
}
function queueRow(item, idx) {
  return `<button type="button" class="queue-row ${idx == null ? 'current' : ''}" ${idx != null ? `data-queue-jump="${idx}"` : ''}><span class="queue-art">${item.song ? albumArt(item.song, 'tiny') : `<span class="placeholder-art tiny">${icon('mic')}</span>`}</span><span class="queue-text"><strong>${esc(item.title)}</strong><small>${esc(item.artist)}</small></span></button>`;
}
function railHtml() {
  const p = state.player, tab = state.railTab === 'lyrics' ? 'now' : state.railTab;
  const head = `<div class="rail-title"><h2>${tab === 'queue' ? 'Queue' : tab === 'lyrics' ? 'Lyrics' : 'Now playing'}</h2><div class="rail-tools"><button type="button" class="icon-quiet ${tab === 'queue' ? 'active' : ''}" data-rail-tab="queue" aria-label="Show queue" title="Queue">${icon('queue')}</button><button type="button" id="close-rail" class="icon-quiet" aria-label="Hide this panel" title="Hide">${icon('close')}</button></div></div>`;
  if (!p) return `${head}<div class="now-card empty-now"><span class="now-art placeholder">${icon('music')}</span><h3>Nothing playing</h3><p class="muted">Pick a song and its details will show up here.</p></div>${friendNowHtml()}${friendActivityHtml()}`;
  const song = p.kind === 'song' ? songById(p.id) : null;
  const current = { song, title: p.title, artist: p.artist };
  if (tab === 'queue') {
    const up = p.kind === 'song' ? p.order.slice(p.pos + 1).map((id, k) => ({ id, idx: p.pos + 1 + k, s: songById(id) })).filter((x) => x.s) : [];
    return `${head}<div class="queue-block"><h4>Now playing</h4>${queueRow(current, null)}</div><div class="queue-block"><h4>Next up</h4>${up.length ? up.slice(0, 60).map((x) => queueRow({ song: x.s, title: x.s.song_title, artist: x.s.album?.artist?.artist_name || 'SoundWave' }, x.idx)).join('') : '<p class="muted small">Nothing queued. Play an album or playlist, or choose “Add to queue”.</p>'}</div>`;
  }
  if (tab === 'lyrics' && song) {
    const lyric = state.lyricsCache[String(song.song_id)];
    return `${head}<section class="rail-card lyrics-rail"><h4>${esc(song.song_title)}</h4>${lyric===undefined?'<p class="muted">Loading lyrics…</p>':lyric?`<div class="lyrics-display">${esc(lyric).replace(/\n/g,'<br>')}</div>`:'<p class="muted">Lyrics have not been added for this song yet.</p>'}</section>`;
  }
  const artist = song?.album?.artist;
  const full = artist && state.artists.find((a) => Number(a.artist_id) === Number(artist.artist_id));
  const saved = full && state.favorites.some((f) => Number(f.artist_id) === Number(full.artist_id));
  const nextId = p.kind === 'song' ? p.order[p.pos + 1] : null, next = nextId != null ? songById(nextId) : null;
  if(p.kind==='podcast'){
    const episode=state.episodes.find(e=>Number(e.episode_id)===Number(p.id));
    const show=state.podcasts.find(x=>Number(x.show_id)===Number(episode?.show_id||p.show_id));
    const subtitle=show?.show_title||p.artist||'SoundWave Podcasts';
    return `${head}<div class="podcast-rail-feature"><div class="podcast-rail-art">${icon('mic')}<span class="podcast-rail-pulse"></span></div><span class="podcast-rail-kicker">NOW PLAYING · PODCAST</span><h3>${esc(p.title||'Podcast episode')}</h3><p>${esc(subtitle)}</p><div class="podcast-rail-meta"><span>${icon('headphones')} Listening now</span>${episode?.duration_seconds?`<span>${nice(episode.duration_seconds)}</span>`:''}</div></div><section class="podcast-rail-details"><span class="eyebrow">EPISODE DETAILS</span><h4>${esc(p.title||'Episode')}</h4><p>${esc(episode?.description||show?.description||'Listen to this episode and explore more from the show.')}</p>${show?`<button type="button" class="button secondary" data-open-show="${show.show_id}">View podcast ${icon('forward')}</button>`:''}</section><section class="podcast-rail-tip">${icon('headphones')}<span>Continue listening from the player below. Your queue and episode controls remain available.</span></section>`;
  }
  return `${head}<div class="now-card"><span class="now-art">${p.kind === 'podcast' ? `<span class="placeholder-art large">${icon('mic')}</span>` : albumArt(song, 'large')}</span><div class="now-title"><div><h3>${esc(p.title)}</h3><p class="muted">${artist ? `<a href="#/artist-detail/${artist.artist_id}" data-open-artist="${artist.artist_id}">${esc(p.artist)}</a>` : esc(p.artist)}</p></div>${song ? heartBtn(song.song_id) : ''}</div></div>
 ${full ? `<section class="rail-card about"><h4>About the artist</h4><span class="about-art" style="background:${grad(full.artist_id)}">${esc(full.artist_name?.[0] || 'A')}</span><strong>${esc(full.artist_name)}</strong><p>${esc(full.bio || full.country || 'SoundWave artist')}</p>${followBtn(full, 'sm')}</section>` : ''}
 ${next ? `<section class="rail-card"><div class="rail-card-head"><h4>Next in queue</h4><button type="button" class="text-link" data-rail-tab="queue">Open queue</button></div>${queueRow({ song: next, title: next.song_title, artist: next.album?.artist?.artist_name || 'SoundWave' }, p.pos + 1)}</section>` : ''}${friendNowHtml()}${friendActivityHtml()}`;
}
function refreshRail() {
  const el = document.getElementById('context-rail'); if (!el) return;
  el.innerHTML = railHtml(); bindRail();
  $('#sw-queue')?.classList.toggle('active', state.railTab === 'queue' && !prefs.railHidden);
}
function bindRail() {
  const rail = document.getElementById('context-rail'); if (!rail) return;
  rail.querySelector('#close-rail')?.addEventListener('click', () => { toggleRail(true); $('#sw-view')?.classList.remove('active'); });
  rail.querySelectorAll('[data-rail-tab]').forEach((b) => b.onclick = () => { const next=b.dataset.railTab;state.railTab = next===state.railTab?'now':next;refreshRail();if(state.railTab==='lyrics'&&state.player?.kind==='song'){const sid=String(state.player.id);if(state.lyricsCache[sid]===undefined){db.from('song_lyrics').select('lyrics').eq('song_id',state.player.id).maybeSingle().then(r=>{state.lyricsCache[sid]=r.error?'':(r.data?.lyrics||'');if(state.railTab==='lyrics')refreshRail();});}} });
  rail.querySelectorAll('[data-queue-jump]').forEach((b) => b.onclick = () => { const p = state.player; if (!p) return; const idx = Number(b.dataset.queueJump); action(() => playSong(p.order[idx], p.queue, { order: p.order, pos: idx })); });
  bindFavoriteButtons(new Set(state.favorites.map((f) => String(f.artist_id))));
  bindContent(rail);
}
function toggleRail(force) { prefs.railHidden = force ?? !prefs.railHidden; savePrefs(); document.body.classList.toggle('rail-hidden', prefs.railHidden); }
function albumDetail() {
  const al = albumById(state.selectedAlbum);
  if (!al) return music();
  const owner = al.artist, total = totalTime(al.songs);
  const canSeeStreams = hasArtistAccess() || hasAdminAccess();
  void ensureAlbumStreamCounts(al);
  state.tint = tintFor(al.album_id);
  shell(`<header class="coll-hero"><div class="coll-cover">${albumArt({ song_id: al.album_id, album: al }, 'large')}</div><div class="coll-meta"><span class="coll-kind">${esc(al.release_type||'Album')}</span><h1 class="coll-title">${esc(al.title)}</h1>${al.description?`<p class="coll-desc">${esc(al.description)}</p>`:''}<p class="coll-sub">${owner ? `<a href="#/artist-detail/${owner.artist_id}" data-open-artist="${owner.artist_id}"><strong>${esc(owner.artist_name)}</strong></a> · ` : ''}${yearOf(al.release_date) ? yearOf(al.release_date) + ' · ' : ''}${al.songs.length} ${al.songs.length === 1 ? 'song' : 'songs'}, ${total}</p></div></header>
<div class="coll-actions"><button type="button" class="sw-big-play" data-play-ids="${ids(al.songs).join(',')}" aria-label="Play ${esc(al.title)}">${icon('play')}</button><button type="button" class="sw-quiet-action shuffle-toggle" data-toggle-shuffle aria-label="Shuffle">${icon('shuffle')}</button></div>
${canSeeStreams ? `<p class="muted small album-stream-note">Visible qualified streams per song${state.albumStreamLoading[al.album_id] ? ' · updating…' : ''}</p>` : ''}
${trackTable(al.songs, { queue: ids(al.songs), showAlbum: false, extraLabel: canSeeStreams ? 'Streams' : '', extraClass: 'streams', extraCell: canSeeStreams ? ((song) => `<span class="stream-pill">${compactNumber(songVisibleStreamCount(song.song_id))}</span>`) : null })}
${(() => { const more = catalogAlbums().filter((a) => a.album_id !== al.album_id && Number(a.artist?.artist_id) === Number(owner?.artist_id)); return more.length ? `<section class="shelf-section"><div class="section-heading"><h2>More by ${esc(owner.artist_name)}</h2></div><div class="shelf">${more.map(albumTile).join('')}</div></section>` : ''; })()}`, '', '');
}
function likedSongsPage() {
  const songs = state.liked.map((x) => songById(x.song_id)).filter(Boolean);
  const display = state.profile?.display_name || 'You';
  state.tint = '#4a3b8f';
  shell(`<header class="coll-hero"><div class="coll-cover liked-cover">${icon('heart')}</div><div class="coll-meta"><span class="coll-kind">Playlist</span><h1 class="coll-title">Liked Songs</h1><p class="coll-sub"><span class="sw-owner-avatar">${esc(display[0]?.toUpperCase() || 'S')}</span><strong>${esc(display)}</strong> · <span data-liked-count>${songs.length} ${songs.length === 1 ? 'song' : 'songs'}</span></p></div></header>${likesNotice()}
<div class="coll-actions">${songs.length ? `<button type="button" class="sw-big-play" data-play-ids="${ids(songs).join(',')}" aria-label="Play Liked Songs">${icon('play')}</button><button type="button" class="sw-quiet-action shuffle-toggle" data-toggle-shuffle aria-label="Shuffle">${icon('shuffle')}</button>` : ''}</div>
${songs.length ? trackTable(songs, { queue: ids(songs) }) : `<div class="empty-state"><h3>Songs you like will appear here</h3><p>Save songs by tapping the heart icon.</p><button type="button" class="button" data-nav="music">Find something to play</button></div>`}`, '', '');
}
// ---------- Global interactions ----------
document.addEventListener('click', (e) => {
  const like = e.target.closest('[data-like]');
  if (like) { e.preventDefault(); e.stopPropagation(); toggleLike(like.dataset.like).catch((err) => { console.error(err); toast(humanErr(err), true); }); return; }
  const fav = e.target.closest('[data-fav]');
  if (fav) { e.preventDefault(); e.stopPropagation(); toggleFollow(fav.dataset.fav).catch((err) => { console.error(err); toast(humanErr(err), true); }); return; }
  if (!e.target.closest('.song-action-popover,[data-song-menu]')) document.querySelector('.song-action-popover')?.remove();
  if (!e.target.closest('.profile-wrap')) { const m = document.getElementById('profile-menu'); if (m) m.hidden = true; }
  if (!e.target.closest('.more-wrap')) { const m = document.getElementById('sw-more-options'); if (m) m.hidden = true; }
  const row = e.target.closest('.track[data-song]');
  if (row && !e.target.closest('button,a,input')) {
    document.querySelectorAll('.track.selected').forEach((x) => x.classList.remove('selected')); row.classList.add('selected');
    if (matchMedia('(hover: none)').matches) playRow(row);
  }
}, true);
document.addEventListener('dblclick', (e) => { const row = e.target.closest('.track[data-song]'); if (row && !e.target.closest('button,a,input')) playRow(row); });
document.addEventListener('keydown',(e)=>{if(!['ArrowDown','ArrowUp'].includes(e.key))return;const active=e.target.closest?.('#search-results .track[data-song],#search-results [data-open-artist],#search-results [data-open-album],#search-results [data-openplaylist],#search-results [data-open-show]');if(!active)return;const rows=[...document.querySelectorAll('#search-results .track[data-song],#search-results [data-open-artist],#search-results [data-open-album],#search-results [data-openplaylist],#search-results [data-open-show]')];const i=rows.indexOf(active);if(i<0)return;e.preventDefault();const n=e.key==='ArrowDown'?Math.min(rows.length-1,i+1):Math.max(0,i-1);rows[n]?.focus();rows.forEach((r,j)=>r.classList.toggle('kbd-active',j===n));});
document.addEventListener('keydown', (e) => {
  const t = e.target, typing = t.matches?.('input,textarea,select,[contenteditable="true"]');
  if (e.key === 'Escape') { document.querySelector('.song-action-popover')?.remove(); return; }
  if (!state.user) return;
  if ((e.key === 'Enter' || e.key === ' ') && t.matches?.('[role="link"][tabindex],.track[data-song]') && !e.target.closest('button,a,input')) {
    e.preventDefault();
    if (t.matches('.track')) playRow(t); else t.click();
    return;
  }
  if (typing || document.querySelector('dialog[open]')) return;
  const audio = document.getElementById('sw-audio');
  if (e.key === ' ' && audio && !t.matches?.('button,a,[role="button"]')) { e.preventDefault(); if (audio.paused) audio.play().catch(() => {}); else audio.pause(); }
  else if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowRight') { e.preventDefault(); action(() => skip(1)); }
  else if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowLeft') { e.preventDefault(); action(() => skip(-1)); }
  else if (e.key === '/' ) { e.preventDefault(); document.getElementById('global-search')?.focus(); }
});
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); state.installEvent = e; const b = document.getElementById('install-app'); if (b) b.hidden = false; });
window.addEventListener('appinstalled', () => { state.installEvent = null; const b = document.getElementById('install-app'); if (b) b.hidden = true; });
initMediaKeys();
if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js?v=47').catch(()=>{});
boot();

/* Card hover effects: cursor spotlight + subtle 3D tilt (works for cards rendered later too) */
(() => {
  const fine = matchMedia('(hover:hover) and (pointer:fine)').matches;
  const calm = matchMedia('(prefers-reduced-motion:reduce)').matches;
  if (!fine || calm) return;
  const SEL = '.release-tile,.artist-card,.cover-card';
  let raf = 0;
  document.addEventListener('mousemove', e => {
    const card = e.target.closest && e.target.closest(SEL);
    if (!card) return;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const r = card.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      card.style.setProperty('--mx', x + 'px');
      card.style.setProperty('--my', y + 'px');
      card.style.setProperty('--ry', ((x / r.width - .5) * 6).toFixed(2) + 'deg');
      card.style.setProperty('--rx', ((.5 - y / r.height) * 6).toFixed(2) + 'deg');
    });
  }, { passive: true });
  document.addEventListener('mouseout', e => {
    const card = e.target.closest && e.target.closest(SEL);
    if (!card || card.contains(e.relatedTarget)) return;
    card.style.setProperty('--rx', '0deg');
    card.style.setProperty('--ry', '0deg');
  });
})();


// Curated carousel: accessible buttons that reveal the next/previous visible cards.
(function bindCuratedCarousel(){
  function update(){
    const rail=document.getElementById('curated-slider');if(!rail)return;
    const prev=document.querySelector('[data-curated-slide="prev"]'),next=document.querySelector('[data-curated-slide="next"]');
    if(prev)prev.disabled=rail.scrollLeft<=3;
    if(next)next.disabled=rail.scrollLeft+rail.clientWidth>=rail.scrollWidth-3;
  }
  document.addEventListener('click',event=>{
    const b=event.target.closest?.('[data-curated-slide]');if(!b)return;
    const rail=document.getElementById('curated-slider');if(!rail)return;
    event.preventDefault();
    const card=rail.querySelector('.curated-card');
    const distance=Math.max(card?.getBoundingClientRect().width||180, Math.floor(rail.clientWidth*0.8));
    rail.scrollBy({left:(b.dataset.curatedSlide==='prev'?-1:1)*distance,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
    setTimeout(update,340);
  });
  document.addEventListener('scroll',event=>{if(event.target?.id==='curated-slider')update();},true);
  new MutationObserver(()=>{if(document.getElementById('curated-slider'))requestAnimationFrame(update);}).observe(document.body,{childList:true,subtree:true});
})();
