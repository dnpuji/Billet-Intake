const ENDPOINT_URL = "https://billet-intake.dnpuji01.workers.dev/"; // GANTI LANGKAH 6
const INGEST_KEY   = "<0419d82a6c2da9f20f6d9e0e176242d1668834c008b862729c4435475d3db422>";                         // GANTI LANGKAH 6
const ALLOWED_CATEGORIES = new Set(["pengisian_bahan","menunggu_bibit","transport_planter","mengisi_bibit","breakdown","menunggu_mekanik","menunggu_bibit_datang"]);

const statusBox = document.getElementById('status');
const $ = id => document.getElementById(id);

function tzFormat(date, timeZone) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone, year:'numeric', month:'2-digit', day:'2-digit',
    hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false
  }).format(date).replace('T',' ').replace(/\u202F/g,' ').replace(',', '');
}

let db; const DB_NAME='billet-outbox', STORE='outbox';
function openDB(){ return new Promise((res,rej)=>{ const r=indexedDB.open(DB_NAME,1); r.onupgradeneeded=()=>r.result.createObjectStore(STORE,{keyPath:'event_id'}); r.onsuccess=()=>{db=r.result;res();}; r.onerror=()=>rej(r.error); }); }
function putOutbox(o){ return new Promise((res,rej)=>{ const tx=db.transaction(STORE,'readwrite'); tx.objectStore(STORE).put(o); tx.oncomplete=()=>res(); tx.onerror=()=>rej(tx.error); }); }
function getAllOutbox(){ return new Promise((res,rej)=>{ const tx=db.transaction(STORE,'readonly'); const q=tx.objectStore(STORE).getAll(); q.onsuccess=()=>res(q.result||[]); q.onerror=()=>rej(q.error); }); }
function delOutbox(id){ return new Promise((res,rej)=>{ const tx=db.transaction(STORE,'readwrite'); tx.objectStore(STORE).delete(id); tx.oncomplete=()=>res(); tx.onerror=()=>rej(tx.error); }); }

function notifyOk(m){ statusBox.innerHTML=`<p class="ok">✅ ${m}</p>` }
function notifyErr(m){ statusBox.innerHTML=`<p class="err">❌ ${m}</p>` }
function deviceId(){ let id=localStorage.getItem('device_id'); if(!id){id='web-'+Math.random().toString(36).slice(2,10); localStorage.setItem('device_id',id);} return id; }

async function submitNow(payload){
  const res = await fetch(ENDPOINT_URL, { method:"POST",
    headers:{ "Content-Type":"application/json", "X-Ingest-Key": INGEST_KEY },
    body: JSON.stringify(payload) });
  if(!res.ok) throw new Error(await res.text());
  return res.json();
}
async function trySync(){
  const items = await getAllOutbox();
  if(!items.length || !navigator.onLine) return;
  for(const it of items){
    try{ await submitNow(it); await delOutbox(it.event_id); notifyOk(`Terkirim: ${it.event_id}`); }
    catch(e){ notifyErr(`Gagal kirim sebagian: ${e.message}`); break; }
  }
}

document.getElementById('submitBtn').addEventListener('click', async ()=>{
  const planter_id = [...document.querySelectorAll('input[name="planter_id"]')].find(i=>i.checked).value;
  const tanggal = $('tanggal').value, start_time = $('start_time').value, end_time = $('end_time').value;
  const kategori = $('kategori').value, lokasi = $('lokasi').value.trim(), catatan = $('catatan').value.trim(), input_by = $('input_by').value.trim();
  if(!tanggal || !start_time || !end_time || !input_by) { notifyErr("Lengkapi field wajib"); return; }
  if(!ALLOWED_CATEGORIES.has(kategori)) { notifyErr("Kategori tidak valid"); return; }
  const s = new Date(`${tanggal}T${start_time}`), e = new Date(`${tanggal}T${end_time}`);
  if(!(e>s)){ notifyErr("end_time harus > start_time"); return; }
  const durasi_menit = Math.round((e - s)/60000);
  const now = new Date();
  const payload = {
    event_id: crypto.randomUUID(),
    planter_id, tanggal, start_time, end_time, durasi_menit,
    kategori, lokasi, catatan, input_by,
    device_id: deviceId(),
    entered_at_utc9: tzFormat(now,'Asia/Jayapura'),
    entered_at_utc:  tzFormat(now,'UTC'),
    entered_device_tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    entered_device_time: tzFormat(now, Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"),
  };
  try{
    if(navigator.onLine){ await submitNow(payload); notifyOk("Tersimpan & terkirim."); }
    else { await putOutbox(payload); notifyOk("Tersimpan (offline). Akan terkirim saat online."); }
  }catch(e){
    await putOutbox(payload);
    notifyErr("Server/koneksi bermasalah. Data disimpan dan akan dicoba kirim ulang.");
  }
});
window.addEventListener('online', trySync);
openDB().then(trySync);
