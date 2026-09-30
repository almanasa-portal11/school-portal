// 1. رابط CSV الخاص بجدول جوجل
const GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTu3rXbsh0yGGUB8dkB7pKgkpnQMb9gAi-J-8uw6O95DT7s8ogGc_TQ1EP3L12yjdKdp-8g1vfDwK7j/pub?output=csv';

// هيكل البيانات الرئيسي
const platformData = {
  sections: [
    { id: "sec-ab", name: "شعبة (أ + ب)" },
    { id: "sec-cd", name: "شعبة (ج + د)" },
    { id: "sec-ef", name: "شعبة (و + ه)" }
  ],
  subjects: [
    { id: "arabic", name: "اللغة العربية" },
    { id: "english", name: "اللغة الإنجليزية" },
    { id: "islamic", name: "التربية الإسلامية" },
    { id: "math", name: "الرياضيات" },
    { id: "biology", name: "العلوم الحياتية (الأحياء)" },
    { id: "chemistry", name: "الكيمياء" },
    { id: "physics", name: "الفيزياء" },
    { id: "technology", name: "التكنولوجيا" }
  ],
  lessonsDatabase: {}
};

let currentUnits = [];
let selectedSectionId = "";
let selectedSubjectId = "";

document.addEventListener('DOMContentLoaded', () => {
  populateDropdowns();
  showWelcomeModal();
  fetchLessonsFromSheet();
});

// إظهار النافذة الترحيبية
function showWelcomeModal() {
  const modal = document.getElementById('welcome-modal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}

// إخفاء النافذة الترحيبية
function hideWelcomeModal() {
  const modal = document.getElementById('welcome-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

// تعبئة الخيارات في القوائم المنسدلة
function populateDropdowns() {
  const secSelect = document.getElementById('modal-section-select');
  const subSelect = document.getElementById('header-subject-select');

  if (secSelect) {
    secSelect.innerHTML = '';
    platformData.sections.forEach(sec => {
      secSelect.innerHTML += `<option value="${sec.id}">${sec.name}</option>`;
    });
  }

  if (subSelect) {
    subSelect.innerHTML = '';
    platformData.subjects.forEach(sub => {
      subSelect.innerHTML += `<option value="${sub.id}">${sub.name}</option>`;
    });
  }

  selectedSubjectId = platformData.subjects[0]?.id || "";
}

// جلب الحصص مع الكاش الفوري
async function fetchLessonsFromSheet() {
  if (!GOOGLE_SHEET_CSV_URL || GOOGLE_SHEET_CSV_URL.includes('ضع_رابط')) return;

  const cachedData = localStorage.getItem('school_portal_lessons_cache');
  if (cachedData) {
    try {
      platformData.lessonsDatabase = JSON.parse(cachedData);
      if (selectedSectionId) {
        loadSelectedCourseData();
      }
    } catch (e) {
      console.error("Cache read error", e);
    }
  }

  try {
    const res = await fetch(GOOGLE_SHEET_CSV_URL);
    const text = await res.text();
    parseCSVToDatabase(text);
    
    localStorage.setItem('school_portal_lessons_cache', JSON.stringify(platformData.lessonsDatabase));
    
    if (selectedSectionId) {
      loadSelectedCourseData();
    }
  } catch (err) {
    console.error("خطأ في جلب الحصص من الشيت:", err);
  }
}

// تفكيك CSV
function parseCSVRows(csvText) {
  const rows = [];
  let currentRow = [];
  let currentCell = '';
  let insideQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentCell += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentCell.trim());
      if (currentRow.some(c => c !== '')) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }

  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some(c => c !== '')) {
      rows.push(currentRow);
    }
  }

  return rows;
}

// مطابقة الشعب والمواد
function resolveSectionId(secStr) {
  if (!secStr) return '';
  secStr = secStr.trim();
  const matched = platformData.sections.find(s => s.id === secStr || s.name === secStr);
  return matched ? matched.id : secStr;
}

function resolveSubjectId(subStr) {
  if (!subStr) return '';
  subStr = subStr.trim();
  const matched = platformData.subjects.find(s => s.id === subStr || s.name === subStr);
  return matched ? matched.id : subStr;
}

// استخراج المعرف (يوتيوب أو جوجل درايف)
function extractVideoId(urlOrId) {
  if (!urlOrId) return { type: 'youtube', id: '' };
  urlOrId = urlOrId.trim();

  if (urlOrId.includes('drive.google.com')) {
    const driveMatch = urlOrId.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (driveMatch && driveMatch[1]) {
      return { type: 'drive', id: driveMatch[1] };
    }
  }

  const ytRegExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = urlOrId.match(ytRegExp);
  if (match && match[2] && match[2].length === 11) {
    return { type: 'youtube', id: match[2] };
  }

  if (urlOrId.length === 11 && !urlOrId.includes('/')) {
    return { type: 'youtube', id: urlOrId };
  }

  return { type: 'drive', id: urlOrId };
}

// تحويل CSV إلى بيانات المنصة
function parseCSVToDatabase(csvText) {
  const rows = parseCSVRows(csvText);
  if (rows.length <= 1) return;

  platformData.lessonsDatabase = {};

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 6) continue;

    let [sec, sub, unit, lessonId, title, youtubeId, duration = '', summary = '', pdfUrl = ''] = row;
    
    const cleanSec = resolveSectionId(sec);
    const cleanSub = resolveSubjectId(sub);
    const key = `${cleanSec}_${cleanSub}`;

    if (!platformData.lessonsDatabase[key]) {
      platformData.lessonsDatabase[key] = [];
    }

    let unitGroup = platformData.lessonsDatabase[key].find(u => u.unitTitle === unit);
    if (!unitGroup) {
      unitGroup = { unitTitle: unit, lessons: [] };
      platformData.lessonsDatabase[key].push(unitGroup);
    }

    unitGroup.lessons.push({
      id: lessonId,
      title: title,
      youtubeId: youtubeId,
      duration: duration,
      summary: summary,
      pdfUrl: pdfUrl
    });
  }
}

// تأكيد اختيار الشعبة
function confirmSectionSelection() {
  const select = document.getElementById('modal-section-select');
  if (select) {
    selectedSectionId = select.value;
  }
  
  hideWelcomeModal();
  loadSelectedCourseData();
}

// تغيير المادة
function onSubjectChange() {
  const select = document.getElementById('header-subject-select');
  if (select) {
    selectedSubjectId = select.value;
  }
  loadSelectedCourseData();
}

// فتح النافذة الترحيبية
function openSelectionModal() {
  showWelcomeModal();
}

// تحميل بيانات المادة
function loadSelectedCourseData() {
  const key = `${selectedSectionId}_${selectedSubjectId}`;
  currentUnits = platformData.lessonsDatabase[key] || [];

  const secName = platformData.sections.find(s => s.id === selectedSectionId)?.name || '';
  const label = document.getElementById('current-section-label');
  if (label) label.innerText = `الشعبة: ${secName}`;

  renderTree(currentUnits);

  if (currentUnits.length > 0 && currentUnits[0].lessons.length > 0) {
    loadLesson(currentUnits[0].lessons[0].id);
  }
}

// رسم القائمة الجانبية
function renderTree(units) {
  const container = document.getElementById('course-tree');
  if (!container) return;
  container.innerHTML = '';

  let totalLessons = 0;

  if (units.length === 0) {
    const countBadge = document.getElementById('lesson-count-badge');
    if (countBadge) countBadge.innerText = `0 حصة`;
    container.innerHTML = `
      <div class="text-center py-12 text-slate-500 text-xs leading-relaxed">
        لا توجد حصص مسجلة حالياً<br>لهذه المادة والشعبة.
      </div>
    `;
    return;
  }

  units.forEach((unit, uIdx) => {
    totalLessons += unit.lessons.length;

    const unitBox = document.createElement('div');
    unitBox.className = 'border border-slate-800 rounded-lg overflow-hidden bg-slate-950/40 mb-2';

    const unitHeader = `
      <button onclick="toggleUnit(${uIdx})" class="w-full text-right p-3 bg-slate-800/60 font-bold text-slate-200 hover:bg-slate-800 flex justify-between items-center text-xs border-b border-slate-800">
        <span class="truncate pl-2">${unit.unitTitle}</span>
        <span class="text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800 px-2 py-0.5 rounded shrink-0">${unit.lessons.length} حصة</span>
      </button>
    `;

    let lessonsList = `<div id="unit-${uIdx}" class="divide-y divide-slate-800/60">`;
    unit.lessons.forEach(lesson => {
      lessonsList += `
        <button onclick="loadLesson('${lesson.id}')" class="w-full text-right p-2.5 hover:bg-indigo-600/10 text-slate-300 hover:text-indigo-300 text-xs transition flex justify-between items-center group">
          <span class="truncate pl-2 font-medium">${lesson.title}</span>
          <span class="text-[10px] bg-slate-800 text-slate-400 group-hover:bg-indigo-950 group-hover:text-indigo-300 px-2 py-0.5 rounded transition shrink-0">${lesson.duration}</span>
        </button>
      `;
    });
    lessonsList += `</div>`;

    unitBox.innerHTML = unitHeader + lessonsList;
    container.appendChild(unitBox);
  });

  const countBadge = document.getElementById('lesson-count-badge');
  if (countBadge) countBadge.innerText = `${totalLessons} حصة`;
}

function toggleUnit(idx) {
  const el = document.getElementById(`unit-${idx}`);
  if (el) el.classList.toggle('hidden');
}

// ============================================================
// مشغل الحصص المتطور (CSS + YouTube API + Google Drive)
// ============================================================

(function injectPlayerStyles() {
  if (document.getElementById('vp-styles')) return;
  const css = `
    .vp-wrap { width: 100%; max-width: 100%; }
    .vp-ratio {
      position: relative;
      width: 100%;
      height: 0;
      padding-top: 56.25%;
      overflow: hidden;
      border-radius: 12px;
      background: #000;
      box-shadow: 0 10px 25px -5px rgba(0,0,0,.5);
    }
    .vp-ratio iframe {
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 100%;
      border: 0; display: block;
    }
    .vp-controls {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      margin-top: 10px;
    }
    .vp-group { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
    .vp-label { font-size: 13px; opacity: .75; margin-inline-end: 2px; }
    .vp-btn {
      min-height: 38px;
      padding: 6px 12px;
      border: 1px solid rgba(128,128,128,.4);
      border-radius: 8px;
      background: transparent;
      color: inherit;
      font: inherit;
      font-size: 14px;
      cursor: pointer;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      -webkit-tap-highlight-color: transparent;
    }
    .vp-btn.vp-active { background: #2563eb; border-color: #2563eb; color: #fff; }
    .vp-select {
      min-height: 38px;
      padding: 6px 10px;
      border: 1px solid rgba(128,128,128,.4);
      border-radius: 8px;
      background: transparent;
      color: inherit;
      font: inherit;
      font-size: 14px;
    }
    .vp-select option { color: #000; }
    .vp-hint { font-size: 13px; opacity: .75; }
    @media (max-width: 480px) {
      .vp-ratio { border-radius: 8px; }
      .vp-btn { padding: 6px 10px; }
    }
  `;
  const style = document.createElement('style');
  style.id = 'vp-styles';
  style.textContent = css;
  document.head.appendChild(style);
})();

let ytPlayer = null;
let ytApiPromise = null;
let lessonLoadToken = 0;

function loadYouTubeApi() {
  if (window.YT && window.YT.Player) return Promise.resolve();
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise(resolve => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prev === 'function') prev();
      resolve();
    };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(s);
  });
  return ytApiPromise;
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function buildYouTubeControls(container) {
  const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
  const qualities = [
    { label: 'تلقائي', value: 'default' },
    { label: '360p',   value: 'medium' },
    { label: '480p',   value: 'large' },
    { label: '720p',   value: 'hd720' },
    { label: '1080p',  value: 'hd1080' }
  ];

  const speedBtns = speeds.map(s =>
    `<button type="button" class="vp-btn${s === 1 ? ' vp-active' : ''}" data-speed="${s}">${s}x</button>`
  ).join('');

  const qualityOpts = qualities.map(q =>
    `<option value="${q.value}">${q.label}</option>`
  ).join('');

  container.innerHTML = `
    <div class="vp-group">
      <span class="vp-label">السرعة:</span>${speedBtns}
    </div>
    <div class="vp-group">
      <span class="vp-label">الجودة:</span>
      <select class="vp-select" id="vp-quality">${qualityOpts}</select>
    </div>
  `;

  container.querySelectorAll('[data-speed]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!ytPlayer || !ytPlayer.setPlaybackRate) return;
      ytPlayer.setPlaybackRate(parseFloat(btn.dataset.speed));
      container.querySelectorAll('[data-speed]').forEach(b => b.classList.remove('vp-active'));
      btn.classList.add('vp-active');
    });
  });

  const qSelect = container.querySelector('#vp-quality');
  if (qSelect) {
    qSelect.addEventListener('change', () => {
      if (!ytPlayer || !ytPlayer.setPlaybackQuality) return;
      ytPlayer.setPlaybackQuality(qSelect.value);
    });
  }
}

function loadLesson(lessonId) {
  let selectedLesson = null;

  currentUnits.forEach(u => {
    const found = u.lessons.find(l => String(l.id) === String(lessonId));
    if (found) selectedLesson = found;
  });

  if (!selectedLesson) return;

  const token = ++lessonLoadToken;

  if (ytPlayer && typeof ytPlayer.destroy === 'function') {
    try { ytPlayer.destroy(); } catch (e) {}
  }
  ytPlayer = null;

  const playerEl = document.getElementById('player');
  if (playerEl && selectedLesson.youtubeId) {
    const videoData = extractVideoId(selectedLesson.youtubeId);
    const safeTitle = escapeHtml(selectedLesson.title);

    if (videoData.type === 'drive') {
      playerEl.innerHTML = `
        <div class="vp-wrap">
          <div class="vp-ratio">
            <iframe
              src="https://drive.google.com/file/d/${videoData.id}/preview"
              title="${safeTitle}"
              allow="autoplay; encrypted-media; fullscreen"
              loading="lazy"
              allowfullscreen>
            </iframe>
          </div>
          <div class="vp-controls">
            <span class="vp-hint">للسرعة والجودة: اضغط أيقونة ⚙️ داخل المشغل</span>
            <a class="vp-btn" href="https://drive.google.com/file/d/${videoData.id}/view"
               target="_blank" rel="noopener">فتح في درايف</a>
          </div>
        </div>
      `;
    } else {
      playerEl.innerHTML = `
        <div class="vp-wrap">
          <div class="vp-ratio"><div id="yt-target"></div></div>
          <div class="vp-controls" id="vp-controls"></div>
        </div>
      `;

      loadYouTubeApi().then(() => {
        if (token !== lessonLoadToken) return;
        ytPlayer = new YT.Player('yt-target', {
          host: 'https://www.youtube-nocookie.com',
          videoId: videoData.id,
          playerVars: {
            rel: 0,
            modestbranding: 1,
            controls: 1,
            playsinline: 1,
            origin: window.location.origin
          },
          events: {
            onReady: () => {
              const controls = document.getElementById('vp-controls');
              if (controls && token === lessonLoadToken) buildYouTubeControls(controls);
            }
          }
        });
      });
    }
  }

  const titleEl = document.getElementById('lesson-title');
  const durEl = document.getElementById('lesson-duration');
  const sumEl = document.getElementById('lesson-summary');

  if (titleEl) titleEl.innerText = selectedLesson.title;
  if (durEl) durEl.innerText = `المدة: ${selectedLesson.duration}`;

  if (sumEl) {
    sumEl.innerHTML = selectedLesson.summary ? selectedLesson.summary.replace(/\n/g, '<br>') : '';
  }

  const pdfBtn = document.getElementById('pdf-btn');
  if (pdfBtn) {
    if (selectedLesson.pdfUrl && selectedLesson.pdfUrl !== '#') {
      pdfBtn.href = selectedLesson.pdfUrl;
      pdfBtn.classList.remove('hidden');
    } else {
      pdfBtn.classList.add('hidden');
    }
  }
}
