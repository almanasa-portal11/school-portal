// 1. ضع رابط CSV الخاص بجدول جوجل هنا بين الكوتشين
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

let player = null;
let currentUnits = [];
let selectedSectionId = "";
let selectedSubjectId = "";

document.addEventListener('DOMContentLoaded', () => {
  // 1. تعبئة القوائم المنسدلة أولاً
  populateDropdowns();

  // 2. إظهار النافذة الترحيبية لاختيار الشعبة فوراً عند فتح الموقع
  showWelcomeModal();

  // 3. تهيئة مشغل الفيديو إذا كان موجوداً
  if (document.getElementById('player')) {
    player = new Plyr('#player', {
      controls: ['play-large', 'play', 'progress', 'current-time', 'duration', 'mute', 'volume', 'settings', 'fullscreen'],
      youtube: { noCookie: true, rel: 0, showinfo: 0, iv_load_policy: 3, modestbranding: 1 }
    });
  }

  // 4. جلب البيانات من جدول جوجل
  fetchLessonsFromSheet();
});

// إظهار النافذة الترحيبية
function showWelcomeModal() {
  const modal = document.getElementById('welcome-modal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex'); // لضمان ظهورها بموقع ممتاز في المنتصف
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

// جلب الحصص من شيت جوجل
async function fetchLessonsFromSheet() {
  if (!GOOGLE_SHEET_CSV_URL || GOOGLE_SHEET_CSV_URL === 'ضع_رابط_جدول_جوجل_هنا') {
    console.warn("تنبيه: لم يتم وضع رابط جدول جوجل بعد.");
    return;
  }

  try {
    const res = await fetch(GOOGLE_SHEET_CSV_URL);
    const text = await res.text();
    parseCSVToDatabase(text);
    
    // إذا كان الطالب قد اختار الشعبة سابقاً، يتم تحميل الحصص فوراً
    if (selectedSectionId) {
      loadSelectedCourseData();
    }
  } catch (err) {
    console.error("خطأ في جلب الحصص:", err);
  }
}

// تحويل الجدول إلى هيكل الموقع
function parseCSVToDatabase(csvText) {
  const lines = csvText.trim().split('\n');
  if (lines.length <= 1) return;

  platformData.lessonsDatabase = {};

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(',').map(cell => cell.trim().replace(/^"|"$/g, ''));
    if (row.length < 9) continue;

    const [sec, sub, unit, lessonId, title, youtubeId, duration, summary, pdfUrl] = row;
    const key = `${sec}_${sub}`;

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

// زر تأكيد اختيار الشعبة من النافذة الترحيبية
function confirmSectionSelection() {
  const select = document.getElementById('modal-section-select');
  if (select) {
    selectedSectionId = select.value;
  }
  
  hideWelcomeModal();
  loadSelectedCourseData();
}

// تغيير المادة من الشريط العلوي
function onSubjectChange() {
  const select = document.getElementById('header-subject-select');
  if (select) {
    selectedSubjectId = select.value;
  }
  loadSelectedCourseData();
}

// فتح النافذة الترحيبية يدوياً (إذا أراد تغيير شعبته)
function openSelectionModal() {
  showWelcomeModal();
}

// تحميل الفهرس في القائمة الجانبية
function loadSelectedCourseData() {
  const key = `${selectedSectionId}_${selectedSubjectId}`;
  currentUnits = platformData.lessonsDatabase[key] || [];

  const secName = platformData.sections.find(s => s.id === selectedSectionId)?.name || '';
  const label = document.getElementById('current-section-label');
  if (label) label.innerText = `الشعبة: ${secName}`;

  renderTree(currentUnits);
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
        <span>${unit.unitTitle}</span>
        <span class="text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800 px-2 py-0.5 rounded">${unit.lessons.length} حصة</span>
      </button>
    `;

    let lessonsList = `<div id="unit-${uIdx}" class="divide-y divide-slate-800/60">`;
    unit.lessons.forEach(lesson => {
      lessonsList += `
        <button onclick="loadLesson('${lesson.id}')" class="w-full text-right p-2.5 hover:bg-indigo-600/10 text-slate-300 hover:text-indigo-300 text-xs transition flex justify-between items-center group">
          <span class="truncate pl-2 font-medium">${lesson.title}</span>
          <span class="text-[10px] bg-slate-800 text-slate-400 group-hover:bg-indigo-950 group-hover:text-indigo-300 px-2 py-0.5 rounded transition">${lesson.duration}</span>
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

// تشغيل الفيديو وتحديث الملخص
function loadLesson(lessonId) {
  let selectedLesson = null;

  currentUnits.forEach(u => {
    const found = u.lessons.find(l => l.id === lessonId);
    if (found) selectedLesson = found;
  });

  if (!selectedLesson) return;

  if (player) {
    player.source = {
      type: 'video',
      sources: [{ src: selectedLesson.youtubeId, provider: 'youtube' }]
    };
  }

  const titleEl = document.getElementById('lesson-title');
  const durEl = document.getElementById('lesson-duration');
  const sumEl = document.getElementById('lesson-summary');

  if (titleEl) titleEl.innerText = selectedLesson.title;
  if (durEl) durEl.innerText = `المدة: ${selectedLesson.duration}`;
  if (sumEl) sumEl.innerHTML = selectedLesson.summary;

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