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
  // 1. تعبئة القوائم المنسدلة
  populateDropdowns();

  // 2. إظهار النافذة الترحيبية لاختيار الشعبة
  showWelcomeModal();

  // 3. جلب البيانات من جدول جوجل
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

// جلب الحصص من شيت جوجل
async function fetchLessonsFromSheet() {
  if (!GOOGLE_SHEET_CSV_URL || GOOGLE_SHEET_CSV_URL.includes('ضع_رابط')) {
    return;
  }

  try {
    const res = await fetch(GOOGLE_SHEET_CSV_URL);
    const text = await res.text();
    parseCSVToDatabase(text);
    
    if (selectedSectionId) {
      loadSelectedCourseData();
    }
  } catch (err) {
    console.error("خطأ في جلب الحصص:", err);
  }
}

// دالة تفكيك CSV
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

// استخراج كود يوتيوب تلقائياً
function extractYouTubeId(urlOrId) {
  if (!urlOrId) return '';
  urlOrId = urlOrId.trim();
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = urlOrId.match(regExp);
  if (match && match[2].length === 11) {
    return match[2];
  }
  return urlOrId;
}

// تحويل CSV إلى بيانات المنصة
function parseCSVToDatabase(csvText) {
  const rows = parseCSVRows(csvText);
  if (rows.length <= 1) return;

  platformData.lessonsDatabase = {};

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 9) continue;

    let [sec, sub, unit, lessonId, title, youtubeId, duration, summary, pdfUrl] = row;
    
    const cleanYoutubeId = extractYouTubeId(youtubeId);
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
      youtubeId: cleanYoutubeId,
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

  // تشغيل الحصة الأولى تلقائياً إن وجدت
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

// تشغيل الفيديو وتحديث الملخص (حل الشاشة السوداء)
function loadLesson(lessonId) {
  let selectedLesson = null;

  currentUnits.forEach(u => {
    const found = u.lessons.find(l => l.id === lessonId);
    if (found) selectedLesson = found;
  });

  if (!selectedLesson) return;

  // تضمين الفيديو بشكل مباشر ومضمون على الجوال والكمبيوتر
  const playerEl = document.getElementById('player');
  if (playerEl && selectedLesson.youtubeId) {
    playerEl.innerHTML = `
      <iframe 
        src="https://www.youtube-nocookie.com/embed/${selectedLesson.youtubeId}?rel=0" 
        title="${selectedLesson.title}"
        style="width: 100%; height: 100%; min-height: 220px; aspect-ratio: 16/9; border: 0; border-radius: 12px;"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
        allowfullscreen>
      </iframe>
    `;
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
