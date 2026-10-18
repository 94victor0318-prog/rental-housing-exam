// 租賃住宅管理人員資格訓練與換證測驗系統核心邏輯（115.02.06 最新官方題庫優化版）
const AppState = {
  activeTab: "home",
  activeBank: "full996", // full996 | qual966 | renew379 | all1345
  activeCategory: null,
  activeSection: "all",
  practiceModeType: "normal", // normal | wrong_drill | star_drill
  studyRevealMode: false,
  shufflePractice: false,
  questions: [],
  currentIndex: 0,
  userAnswers: {},
  practiceHistory: {}, // questionId -> selectedOptIndex
  starred: new Set(),
  wrongRecords: {},
  examHistory: [],
  timerInterval: null,
  timerSeconds: 0,
  isExamSubmitted: false,
  searchTerm: "",
  searchCategory: "all",
  searchLimit: 50,
  hideWrongAnswers: false,
  hideStarAnswers: false,
  theme: "light"
};

function getActiveBankMeta() {
  if (typeof QUESTION_BANKS !== "undefined") {
    return QUESTION_BANKS.find(b => b.id === AppState.activeBank) || QUESTION_BANKS[0];
  }
  return { id: "full996", name: "🏆 996 題全真題庫", shortName: "996 題全真版", count: QUESTION_DATABASE.length };
}

function getActiveDatabase() {
  switch (AppState.activeBank) {
    case "qual966":
      return QUESTION_DATABASE.filter(q => q.bank === "qual");
    case "renew379":
      return QUESTION_DATABASE.filter(q => q.bank === "renew");
    case "all1345":
      return QUESTION_DATABASE;
    case "full996":
    default:
      return QUESTION_DATABASE.filter(q => q.in996);
  }
}

function loadLocalData() {
  try {
    const savedBank = localStorage.getItem("rh_bank");
    if (savedBank && ["full996", "qual966", "renew379", "all1345"].includes(savedBank)) {
      AppState.activeBank = savedBank;
    }
    const savedStars = localStorage.getItem("rh_starred");
    if (savedStars) AppState.starred = new Set(JSON.parse(savedStars));
    const savedWrongs = localStorage.getItem("rh_wrong");
    if (savedWrongs) AppState.wrongRecords = JSON.parse(savedWrongs);
    const savedHistory = localStorage.getItem("rh_history");
    if (savedHistory) AppState.examHistory = JSON.parse(savedHistory);
    const savedPractice = localStorage.getItem("rh_practice_answers");
    if (savedPractice) AppState.practiceHistory = JSON.parse(savedPractice);
    const savedTheme = localStorage.getItem("rh_theme") || "light";
    setTheme(savedTheme);
    syncHeaderUI();
  } catch (e) {
    console.error("載入本地資料失敗:", e);
  }
}

function saveLocalData() {
  try {
    localStorage.setItem("rh_bank", AppState.activeBank);
    localStorage.setItem("rh_starred", JSON.stringify(Array.from(AppState.starred)));
    localStorage.setItem("rh_wrong", JSON.stringify(AppState.wrongRecords));
    localStorage.setItem("rh_history", JSON.stringify(AppState.examHistory));
    localStorage.setItem("rh_practice_answers", JSON.stringify(AppState.practiceHistory));
    syncHeaderUI();
  } catch (e) {
    console.error("儲存本地資料失敗:", e);
  }
}

function syncHeaderUI() {
  const bankSel = document.getElementById("headerBankSelector");
  if (bankSel) bankSel.value = AppState.activeBank;

  const wrongBadge = document.getElementById("navWrongBadge");
  if (wrongBadge) {
    const wCount = Object.keys(AppState.wrongRecords).length;
    wrongBadge.textContent = wCount;
    wrongBadge.style.display = wCount > 0 ? "inline-block" : "none";
  }

  const starBadge = document.getElementById("navStarBadge");
  if (starBadge) {
    const sCount = AppState.starred.size;
    starBadge.textContent = sCount;
    starBadge.style.display = sCount > 0 ? "inline-block" : "none";
  }
}

function changeQuestionBank(bankId) {
  if (AppState.activeTab === "exam" && !AppState.isExamSubmitted) {
    if (!confirm("模擬測驗正在進行中，切換題庫版本將重新開始，確定要切換嗎？")) {
      syncHeaderUI();
      return;
    }
    clearInterval(AppState.timerInterval);
  }
  AppState.activeBank = bankId;
  AppState.activeSection = "all";
  saveLocalData();
  switchTab(AppState.activeTab === "result" ? "home" : AppState.activeTab, AppState.activeCategory);
}

function setTheme(theme) {
  AppState.theme = theme;
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("rh_theme", theme);
  const themeBtn = document.getElementById("themeToggleBtn");
  if (themeBtn) {
    themeBtn.innerHTML = theme === "dark" ? "☀️ 淺色" : "🌙 深色";
  }
}

function stopSpeech() {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

function speakQuestion(questionId) {
  if (!("speechSynthesis" in window)) {
    alert("您的瀏覽器目前不支援語音朗讀功能。");
    return;
  }
  const q = QUESTION_DATABASE.find(item => item.id === questionId);
  if (!q) return;

  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
    return;
  }

  const optLabels = ["選項 A，", "選項 B，", "選項 C，", "選項 D，"];
  const optsText = q.options.map((o, i) => optLabels[i] + o).join("。");
  const isAnswered = AppState.userAnswers[q.id] !== undefined || AppState.studyRevealMode;
  let fullText = `第 ${q.qno || q.id} 題：${q.question}。${optsText}。`;
  if (isAnswered) {
    const ansLabel = ["A", "B", "C", "D"][q.answer];
    fullText += `本題官方正解為 ${ansLabel}，${q.options[q.answer]}。法規依據：${q.lawSource}`;
  }

  const utter = new SpeechSynthesisUtterance(fullText);
  utter.lang = "zh-TW";
  utter.rate = 1.05;
  window.speechSynthesis.speak(utter);
}

function fisherYatesShuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function switchTab(tabId, param = null) {
  stopSpeech();
  if (AppState.activeTab === "exam" && !AppState.isExamSubmitted && tabId !== "exam" && tabId !== "result") {
    if (!confirm("模擬測驗正在進行中，確定要離開嗎？未交卷的成績將不會被保存。")) {
      return;
    }
    clearInterval(AppState.timerInterval);
  }

  AppState.activeTab = tabId;
  AppState.isExamSubmitted = false;

  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("data-tab") === tabId);
  });

  const mainContainer = document.getElementById("mainContent");
  mainContainer.innerHTML = "";

  switch (tabId) {
    case "home": renderHome(mainContainer); break;
    case "practice": initPracticeMode(mainContainer, param); break;
    case "exam": initExamMode(mainContainer, param || 50); break;
    case "wrong": renderWrongBook(mainContainer); break;
    case "bookmarks": renderBookmarks(mainContainer); break;
    case "search": renderSearch(mainContainer); break;
    case "analytics": renderAnalytics(mainContainer); break;
    case "result": renderExamResult(mainContainer); break;
    default: renderHome(mainContainer);
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderHome(container) {
  const activeDB = getActiveDatabase();
  const bankMeta = getActiveBankMeta();
  const totalQ = activeDB.length;
  const starredQ = AppState.starred.size;
  const wrongQ = Object.keys(AppState.wrongRecords).length;
  const examCount = AppState.examHistory.length;
  const practicedInBank = activeDB.filter(q => AppState.practiceHistory[q.id] !== undefined).length;
  const overallProgress = totalQ > 0 ? Math.round((practicedInBank / totalQ) * 100) : 0;

  let html = `
    <div class="hero-banner">
      <div class="hero-title">
        <span>🏛️ 租賃住宅管理人員資格訓練測驗系統</span>
        <span style="font-size: 0.82rem; background: rgba(255,255,255,0.22); padding: 0.2rem 0.65rem; border-radius: 999px; font-weight: 700;">
          115.02.06 全聯會最新公告題庫
        </span>
      </div>
      <p class="hero-desc">
        依據內政部地政司與中華民國租賃住宅服務商業同業公會全國聯合會最新公告（115年2月6日更新版）建置，每題皆經「含法源／不含法源」雙版本 100% 交叉校對，附帶完整條文依據與正修助教考點叮嚀。
      </p>
      <div class="hero-stats">
        <div class="stat-chip">📚 當前題庫：<strong>${bankMeta.shortName}（${totalQ} 題）</strong></div>
        <div class="stat-chip">✍️ 已刷進度：<strong>${practicedInBank} / ${totalQ} 題（${overallProgress}%）</strong></div>
        <div class="stat-chip">📝 模擬考紀錄：<strong>${examCount}</strong> 次</div>
        <div class="stat-chip">⭐ 個人收藏：<strong>${starredQ}</strong> 題</div>
        <div class="stat-chip">⚠️ 待複習錯題：<strong>${wrongQ}</strong> 題</div>
      </div>

      <div class="bank-switcher-bar">
        ${(typeof QUESTION_BANKS !== "undefined" ? QUESTION_BANKS : []).map(b => `
          <button class="bank-pill ${AppState.activeBank === b.id ? 'active' : ''}" onclick="changeQuestionBank('${b.id}')">
            <div class="bank-pill-title">
              <span>${b.shortName}</span>
              <span>${b.count} 題</span>
            </div>
            <div class="bank-pill-desc">${b.desc}</div>
          </button>
        `).join('')}
      </div>
    </div>

    <h3 style="margin-bottom: 1rem; font-weight: 800;">🎯 測驗與練習模式</h3>
    <div class="mode-grid">
      <div class="mode-card" onclick="switchTab('exam', 20)">
        <div>
          <div class="mode-icon-box" style="background: #e0e7ff; color: #4338ca;">⚡</div>
          <h3>快速隨機模擬考</h3>
          <p>依章節比例隨機抽取 20 題核心考古題，限時 25 分鐘，快速檢測常考重點觀念。</p>
        </div>
        <span class="mode-badge" style="background: #e0e7ff; color: #4338ca;">20 題 · 限時 25 分</span>
      </div>

      <div class="mode-card" onclick="switchTab('exam', 50)">
        <div>
          <div class="mode-icon-box" style="background: #fee2e2; color: #b91c1c;">🏆</div>
          <h3>標準實戰模擬考</h3>
          <p>模擬正式證照考試配題規範（及格門檻 60 分），50 題全科落點精準診斷。</p>
        </div>
        <span class="mode-badge" style="background: #fee2e2; color: #b91c1c;">50 題 · 限時 60 分</span>
      </div>

      <div class="mode-card" onclick="switchTab('exam', 100)">
        <div>
          <div class="mode-icon-box" style="background: #fdf2f8; color: #db2777;">💯</div>
          <h3>100 題結訓全真模考</h3>
          <p>比照正式結訓 100 題大考規模，涵蓋 10 大官方章節，考前沉浸式實戰衝刺。</p>
        </div>
        <span class="mode-badge" style="background: #fdf2f8; color: #db2777;">100 題 · 限時 90 分</span>
      </div>

      <div class="mode-card" onclick="switchTab('practice')">
        <div>
          <div class="mode-icon-box" style="background: #dcfce7; color: #15803d;">📖</div>
          <h3>分章節／子單元刷題</h3>
          <p>支援 10 大章節與 31 個子法規單元精讀、背題模式、語音朗讀與鍵盤快捷鍵作答。</p>
        </div>
        <span class="mode-badge" style="background: #dcfce7; color: #15803d;">${totalQ} 題 · 自動記憶進度</span>
      </div>

      <div class="mode-card" onclick="switchTab('wrong')">
        <div>
          <div class="mode-icon-box" style="background: #fef3c7; color: #b45309;">💡</div>
          <h3>錯題本與弱點重測</h3>
          <p>自動收錄練習與模考答錯題目，支援「一鍵啟動錯題專項重測挑戰」。</p>
        </div>
        <span class="mode-badge" style="background: #fef3c7; color: #b45309;">${wrongQ} 道錯題待加強</span>
      </div>
    </div>

    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 2rem; margin-bottom: 0.5rem; flex-wrap: wrap; gap: 0.5rem;">
      <h3 style="font-weight: 800;">📚 十大官方測驗主題單元（點擊直接進入該章節刷題）</h3>
      ${practicedInBank > 0 ? `<button class="tool-btn" onclick="resetAllPracticeProgress()">🔄 重置刷題進度</button>` : ''}
    </div>
    <div class="category-list">
  `;

  EXAM_CATEGORIES.forEach((cat, idx) => {
    const catQs = activeDB.filter(q => q.categoryId === cat.id);
    const count = catQs.length;
    const doneQs = catQs.filter(q => AppState.practiceHistory[q.id] !== undefined);
    const doneCount = doneQs.length;
    const correctCount = doneQs.filter(q => AppState.practiceHistory[q.id] === q.answer).length;
    const pct = count > 0 ? Math.round((doneCount / count) * 100) : 0;
    const acc = doneCount > 0 ? Math.round((correctCount / doneCount) * 100) : 0;

    html += `
      <div class="cat-card" onclick="switchTab('practice', '${cat.id}')">
        <div class="cat-icon-badge">${idx + 1}</div>
        <div class="cat-info">
          <h4>${cat.name}</h4>
          <p>${cat.desc}</p>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.55rem; font-size: 0.76rem; font-weight: 700;">
            <span style="color: var(--primary);">共 ${count} 題 · 已刷 ${doneCount} 題 (${pct}%)</span>
            ${doneCount > 0 ? `<span style="color: ${acc >= 60 ? 'var(--success)' : 'var(--warning)'};">正確率 ${acc}%</span>` : `<span style="color: var(--text-muted);">點擊開始 →</span>`}
          </div>
          <div class="progress-bar-wrap">
            <div class="progress-bar-fill" style="width: ${pct}%;"></div>
          </div>
        </div>
      </div>
    `;
  });

  html += `</div>`;
  container.innerHTML = html;
}

function resetAllPracticeProgress() {
  if (confirm("確定要重置所有章節的已刷題進度紀錄嗎？（錯題本與收藏不會受到影響）")) {
    AppState.practiceHistory = {};
    AppState.userAnswers = {};
    saveLocalData();
    renderHome(document.getElementById("mainContent"));
  }
}

function initPracticeMode(container, param = null) {
  AppState.practiceModeType = "normal";
  AppState.activeSection = "all";

  const activeDB = getActiveDatabase();
  if (param === "__wrong_drill__") {
    AppState.practiceModeType = "wrong_drill";
    AppState.activeCategory = null;
    const wrongIds = new Set(Object.keys(AppState.wrongRecords).map(Number));
    AppState.questions = QUESTION_DATABASE.filter(q => wrongIds.has(q.id));
    AppState.userAnswers = {};
  } else if (param === "__star_drill__") {
    AppState.practiceModeType = "star_drill";
    AppState.activeCategory = null;
    AppState.questions = QUESTION_DATABASE.filter(q => AppState.starred.has(q.id));
    AppState.userAnswers = {};
  } else {
    AppState.activeCategory = param;
    if (param) {
      AppState.questions = activeDB.filter(q => q.categoryId === param);
    } else {
      AppState.questions = [...activeDB];
    }
    AppState.userAnswers = { ...AppState.practiceHistory };
  }

  if (AppState.shufflePractice) {
    AppState.questions = fisherYatesShuffle(AppState.questions);
  }

  // Jump to first unanswered question if any
  const firstUnanswered = AppState.questions.findIndex(q => AppState.userAnswers[q.id] === undefined);
  AppState.currentIndex = firstUnanswered >= 0 ? firstUnanswered : 0;

  renderPracticeLayout(container);
}

function filterPracticeBySection(sectionVal) {
  AppState.activeSection = sectionVal;
  const activeDB = getActiveDatabase();
  let pool = AppState.activeCategory
    ? activeDB.filter(q => q.categoryId === AppState.activeCategory)
    : [...activeDB];

  if (sectionVal !== "all") {
    pool = pool.filter(q => q.sectionName === sectionVal);
  }
  if (AppState.shufflePractice) {
    pool = fisherYatesShuffle(pool);
  }
  AppState.questions = pool;
  AppState.currentIndex = 0;
  renderPracticeLayout(document.getElementById("mainContent"));
}

function toggleStudyRevealMode() {
  AppState.studyRevealMode = !AppState.studyRevealMode;
  renderPracticeLayout(document.getElementById("mainContent"));
}

function toggleShufflePractice() {
  AppState.shufflePractice = !AppState.shufflePractice;
  if (AppState.shufflePractice) {
    AppState.questions = fisherYatesShuffle(AppState.questions);
  } else {
    AppState.questions.sort((a, b) => a.id - b.id);
  }
  AppState.currentIndex = 0;
  renderPracticeLayout(document.getElementById("mainContent"));
}

function resetCurrentPracticeSet() {
  if (!confirm("確定要清空本單元目前的作答紀錄，重新開始刷題嗎？")) return;
  AppState.questions.forEach(q => {
    delete AppState.userAnswers[q.id];
    if (AppState.practiceModeType === "normal") {
      delete AppState.practiceHistory[q.id];
    }
  });
  AppState.currentIndex = 0;
  saveLocalData();
  renderPracticeLayout(document.getElementById("mainContent"));
}

function renderPracticeLayout(container) {
  const activeDB = getActiveDatabase();
  const currentCat = EXAM_CATEGORIES.find(c => c.id === AppState.activeCategory);
  let catTitle = currentCat ? currentCat.name : "全部章節題庫";
  if (AppState.practiceModeType === "wrong_drill") catTitle = "🎯 錯題專項重測特訓";
  if (AppState.practiceModeType === "star_drill") catTitle = "⭐ 收藏重點題專項特訓";

  // Available sub-sections in current category
  const basePool = AppState.activeCategory
    ? activeDB.filter(q => q.categoryId === AppState.activeCategory)
    : activeDB;
  const sections = Array.from(new Set(basePool.map(q => q.sectionName).filter(Boolean)));

  let html = `
    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.75rem;">
      <div>
        <h2 style="font-weight: 800; font-size: 1.35rem;">📖 ${catTitle}</h2>
        <p style="color: var(--text-muted); font-size: 0.86rem;">
          共 ${AppState.questions.length} 題 · 即選即看官方法源依據與助教考點解析
        </p>
      </div>
      <div style="display: flex; gap: 0.45rem; align-items: center; flex-wrap: wrap;">
        ${AppState.practiceModeType === "normal" ? `
          <select id="catSelector" class="tool-btn" onchange="switchTab('practice', this.value === 'all' ? null : this.value)">
            <option value="all" ${!AppState.activeCategory ? 'selected' : ''}>全部 10 大章節 (${activeDB.length}題)</option>
            ${EXAM_CATEGORIES.map(c => {
              const cnt = activeDB.filter(q => q.categoryId === c.id).length;
              return `<option value="${c.id}" ${AppState.activeCategory === c.id ? 'selected' : ''}>${c.name} (${cnt}題)</option>`;
            }).join('')}
          </select>
          ${sections.length > 1 ? `
            <select id="secSelector" class="tool-btn" style="max-width: 240px;" onchange="filterPracticeBySection(this.value)">
              <option value="all" ${AppState.activeSection === 'all' ? 'selected' : ''}>全部子單元 (${basePool.length}題)</option>
              ${sections.map(sec => `<option value="${sec}" ${AppState.activeSection === sec ? 'selected' : ''}>${sec}</option>`).join('')}
            </select>
          ` : ''}
        ` : ''}
        <button class="tool-btn ${AppState.studyRevealMode ? 'active-toggle' : ''}" onclick="toggleStudyRevealMode()" title="直接展開正確答案與法規詳解">
          👁️ ${AppState.studyRevealMode ? '背題模式：開' : '背題模式'}
        </button>
        <button class="tool-btn ${AppState.shufflePractice ? 'active-toggle' : ''}" onclick="toggleShufflePractice()" title="隨機打亂題目順序">
          🔀 ${AppState.shufflePractice ? '已隨機排序' : '隨機順序'}
        </button>
        <button class="tool-btn" onclick="resetCurrentPracticeSet()" title="重置本單元作答紀錄">🔄 重刷本單元</button>
        <button class="tool-btn" onclick="printQuestions()">🖨️ 列印</button>
      </div>
    </div>

    <div class="exam-layout">
      <div id="practiceQuestionsContainer"></div>
      <div class="sidebar-panel">
        <div class="panel-title">
          <span>題號導覽</span>
          <span style="font-size: 0.8rem; color: var(--text-muted);" id="practiceStatsLabel"></span>
        </div>
        <div class="q-grid" id="practiceNavGrid"></div>
        <div class="exam-controls">
          <button class="btn-secondary" onclick="switchTab('home')">🏠 返回首頁</button>
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;
  renderCurrentPracticeQuestion();
  renderPracticeNavGrid();
}

function renderPracticeNavGrid() {
  const grid = document.getElementById("practiceNavGrid");
  if (!grid) return;

  let answeredCount = 0;
  let correctCount = 0;

  grid.innerHTML = AppState.questions.map((q, idx) => {
    const userAns = AppState.userAnswers[q.id];
    const isAnswered = userAns !== undefined;
    if (isAnswered) {
      answeredCount++;
      if (userAns === q.answer) correctCount++;
    }
    const isCurrent = idx === AppState.currentIndex;
    const isStarred = AppState.starred.has(q.id);
    let statusClass = "";
    if (isAnswered) {
      statusClass = userAns === q.answer ? "answered-correct" : "answered-wrong";
    }

    return `
      <button class="q-grid-btn ${statusClass} ${isCurrent ? 'current' : ''} ${isStarred ? 'starred' : ''}"
              onclick="jumpToQuestion(${idx})">
        ${idx + 1}
      </button>
    `;
  }).join('');

  const statsEl = document.getElementById("practiceStatsLabel");
  if (statsEl) {
    const acc = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0;
    statsEl.textContent = `已答 ${answeredCount}/${AppState.questions.length} (${acc}%)`;
  }
}

function jumpToQuestion(index) {
  if (index < 0 || index >= AppState.questions.length) return;
  stopSpeech();
  AppState.currentIndex = index;
  renderCurrentPracticeQuestion();
  renderPracticeNavGrid();
}

function renderCurrentPracticeQuestion() {
  const container = document.getElementById("practiceQuestionsContainer");
  if (!container) return;

  const q = AppState.questions[AppState.currentIndex];
  if (!q) {
    container.innerHTML = `<div class="question-card">本單元暫無符合條件之題目。</div>`;
    return;
  }

  const selectedOpt = AppState.userAnswers[q.id];
  const isAnswered = selectedOpt !== undefined || AppState.studyRevealMode;
  const isStarred = AppState.starred.has(q.id);
  const optLabels = ["(A)", "(B)", "(C)", "(D)"];
  const bankTag = q.bank === "renew" ? "換證題庫" : "資格題庫";

  let html = `
    <div class="question-card">
      <div class="q-header">
        <div class="q-badge-group">
          <span class="q-badge">第 ${AppState.currentIndex + 1} / ${AppState.questions.length} 題 · ${q.categoryName}</span>
          <span class="q-sub-badge">${bankTag} #${q.qno || q.id} · ${q.sectionName || ''}</span>
        </div>
        <div class="q-actions">
          <button class="btn-icon" title="語音朗讀題目與解析 (快捷鍵 R)" onclick="speakQuestion(${q.id})">🔊 朗讀</button>
          <button class="btn-icon ${isStarred ? 'active' : ''}" title="${isStarred ? '取消收藏 (快捷鍵 S)' : '收藏題目 (快捷鍵 S)'}" onclick="toggleStarQuestion(${q.id})">
            ${isStarred ? '★ 已收藏' : '☆ 收藏'}
          </button>
        </div>
      </div>

      <div class="q-title">${q.question}</div>

      <div class="options-list">
        ${q.options.map((opt, optIdx) => {
          let optClass = "option-item";
          if (isAnswered) {
            if (optIdx === q.answer) {
              optClass += " correct";
            } else if (optIdx === selectedOpt) {
              optClass += " wrong";
            }
          } else if (selectedOpt === optIdx) {
            optClass += " selected";
          }

          return `
            <div class="${optClass}" onclick="handlePracticeAnswer(${q.id}, ${optIdx})">
              <span class="opt-prefix">${optLabels[optIdx]}</span>
              <span>${opt}</span>
            </div>
          `;
        }).join('')}
      </div>

      ${isAnswered ? `
        <div class="explanation-box">
          <div class="exp-header">
            ${selectedOpt === undefined
              ? `👁️ 背題模式：官方標準答案為 ${optLabels[q.answer]}`
              : (selectedOpt === q.answer
                  ? `✅ 恭喜答對！官方標準答案：${optLabels[q.answer]}`
                  : `❌ 答錯了！您選擇 ${optLabels[selectedOpt]}，官方正確答案應為：${optLabels[q.answer]}`)}
          </div>
          <div class="exp-law">
            📜 <strong>官方法源依據：</strong>${q.lawSource}
          </div>
          <div style="margin-top: 0.55rem; line-height: 1.65; white-space: pre-line;">
            💡 <strong>正解確認：</strong>${q.options[q.answer]}
          </div>
          ${q.trapTip ? `
            <div class="exp-trap">
              ${q.trapTip}
            </div>
          ` : ''}
        </div>
      ` : ''}

      <div style="display: flex; justify-content: space-between; margin-top: 1.5rem; gap: 0.75rem;">
        <button class="btn-secondary" ${AppState.currentIndex === 0 ? 'disabled style="opacity:0.45;cursor:not-allowed;"' : ''} onclick="jumpToQuestion(${AppState.currentIndex - 1})">
          ← 上一題
        </button>
        <button class="btn-primary" ${AppState.currentIndex === AppState.questions.length - 1 ? 'disabled style="opacity:0.45;cursor:not-allowed;"' : ''} onclick="jumpToQuestion(${AppState.currentIndex + 1})">
          下一題 →
        </button>
      </div>

      <div class="shortcut-hint">
        <span>⌨️ 鍵盤快捷鍵：按 <strong>1~4</strong> 或 <strong>A~D</strong> 選擇答案 ｜ <strong>← →</strong> 切換上/下一題 ｜ <strong>S</strong> 收藏 ｜ <strong>R</strong> 語音朗讀</span>
        <span>題庫編號：#${q.id}</span>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

function handlePracticeAnswer(questionId, optIndex) {
  AppState.userAnswers[questionId] = optIndex;
  if (AppState.practiceModeType === "normal") {
    AppState.practiceHistory[questionId] = optIndex;
  }

  const q = AppState.questions.find(item => item.id === questionId);
  if (q && optIndex !== q.answer) {
    AppState.wrongRecords[q.id] = (AppState.wrongRecords[q.id] || 0) + 1;
  }
  saveLocalData();

  renderCurrentPracticeQuestion();
  renderPracticeNavGrid();
}

function toggleStarQuestion(questionId) {
  if (AppState.starred.has(questionId)) {
    AppState.starred.delete(questionId);
  } else {
    AppState.starred.add(questionId);
  }
  saveLocalData();

  if (AppState.activeTab === "practice") {
    renderCurrentPracticeQuestion();
    renderPracticeNavGrid();
  } else if (AppState.activeTab === "exam") {
    renderCurrentExamQuestion();
    renderExamNavGrid();
  } else if (AppState.activeTab === "bookmarks") {
    renderBookmarks(document.getElementById("mainContent"));
  } else if (AppState.activeTab === "wrong") {
    renderWrongBook(document.getElementById("mainContent"));
  } else if (AppState.activeTab === "search") {
    handleSearch(AppState.searchTerm);
  } else if (AppState.activeTab === "result") {
    renderExamResult(document.getElementById("mainContent"));
  }
}

// Stratified proportional sampling across all 10 chapters
function sampleExamQuestions(pool, targetCount) {
  if (pool.length <= targetCount) return fisherYatesShuffle(pool);

  const selected = [];
  const usedIds = new Set();

  EXAM_CATEGORIES.forEach(cat => {
    const catPool = fisherYatesShuffle(pool.filter(q => q.categoryId === cat.id));
    const quota = Math.max(1, Math.round((catPool.length / pool.length) * targetCount));
    for (let i = 0; i < Math.min(quota, catPool.length); i++) {
      if (selected.length < targetCount) {
        selected.push(catPool[i]);
        usedIds.add(catPool[i].id);
      }
    }
  });

  if (selected.length < targetCount) {
    const remaining = fisherYatesShuffle(pool.filter(q => !usedIds.has(q.id)));
    for (const q of remaining) {
      if (selected.length >= targetCount) break;
      selected.push(q);
    }
  }

  return fisherYatesShuffle(selected.slice(0, targetCount));
}

function initExamMode(container, questionCount = 50) {
  AppState.isExamSubmitted = false;
  AppState.userAnswers = {};
  AppState.currentIndex = 0;

  const activeDB = getActiveDatabase();
  AppState.questions = sampleExamQuestions(activeDB, questionCount);

  const totalMinutes = questionCount <= 20 ? 25 : (questionCount <= 50 ? 60 : 90);
  AppState.timerSeconds = totalMinutes * 60;

  clearInterval(AppState.timerInterval);
  AppState.timerInterval = setInterval(() => {
    AppState.timerSeconds--;
    updateExamTimer();
    if (AppState.timerSeconds <= 0) {
      clearInterval(AppState.timerInterval);
      alert("考試時間到！系統將自動為您交卷評分。");
      submitExam();
    }
  }, 1000);

  renderExamLayout(container);
}

function updateExamTimer() {
  const timerEl = document.getElementById("examTimer");
  if (!timerEl) return;

  const mins = Math.floor(AppState.timerSeconds / 60);
  const secs = AppState.timerSeconds % 60;
  timerEl.textContent = `⏱️ ${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  if (AppState.timerSeconds < 300) {
    timerEl.classList.add("timer-warning");
  }
}

function renderExamLayout(container) {
  const bankMeta = getActiveBankMeta();
  let html = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.75rem;">
      <div>
        <h2 style="font-weight: 800; font-size: 1.35rem;">🏆 租賃住宅管理人員模擬測驗（${bankMeta.shortName}）</h2>
        <p style="color: var(--text-muted); font-size: 0.86rem;">
          共 ${AppState.questions.length} 題 · 依 10 大章節權重配題 · 及格標準：60 分
        </p>
      </div>
      <div style="display: flex; gap: 0.5rem; align-items: center;">
        <button class="tool-btn" onclick="initExamMode(document.getElementById('mainContent'), 20)">20 題快測</button>
        <button class="tool-btn" onclick="initExamMode(document.getElementById('mainContent'), 50)">50 題標準</button>
        <button class="tool-btn" onclick="initExamMode(document.getElementById('mainContent'), 100)">100 題全真</button>
        <button class="btn-success" onclick="confirmSubmitExam()">📝 交卷評分</button>
      </div>
    </div>

    <div class="exam-layout">
      <div id="examQuestionContainer"></div>
      <div class="sidebar-panel">
        <div class="panel-title">
          <span>剩餘時間</span>
          <span id="examTimer" class="timer-display">⏱️ --:--</span>
        </div>
        <hr style="border: none; border-top: 1px solid var(--border-color); margin: 0.75rem 0;">
        <div class="panel-title">
          <span>作答進度</span>
          <span style="font-size: 0.8rem; color: var(--text-muted);" id="answeredCount">已答 0 / ${AppState.questions.length}</span>
        </div>
        <div class="q-grid" id="examNavGrid"></div>
        <div class="exam-controls">
          <button class="btn-primary" style="width: 100%;" onclick="confirmSubmitExam()">✅ 確認交卷</button>
          <button class="btn-secondary" style="width: 100%;" onclick="switchTab('home')">放棄本次測驗</button>
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;
  updateExamTimer();
  renderCurrentExamQuestion();
  renderExamNavGrid();
}

function renderExamNavGrid() {
  const grid = document.getElementById("examNavGrid");
  if (!grid) return;

  const answeredTotal = Object.keys(AppState.userAnswers).length;
  const countEl = document.getElementById("answeredCount");
  if (countEl) countEl.textContent = `已答 ${answeredTotal} / ${AppState.questions.length}`;

  grid.innerHTML = AppState.questions.map((q, idx) => {
    const isAnswered = AppState.userAnswers[q.id] !== undefined;
    const isCurrent = idx === AppState.currentIndex;
    const isStarred = AppState.starred.has(q.id);

    return `
      <button class="q-grid-btn ${isAnswered ? 'answered' : ''} ${isCurrent ? 'current' : ''} ${isStarred ? 'starred' : ''}"
              onclick="jumpToExamQuestion(${idx})">
        ${idx + 1}
      </button>
    `;
  }).join('');
}

function jumpToExamQuestion(index) {
  if (index < 0 || index >= AppState.questions.length) return;
  AppState.currentIndex = index;
  renderCurrentExamQuestion();
  renderExamNavGrid();
}

function renderCurrentExamQuestion() {
  const container = document.getElementById("examQuestionContainer");
  if (!container) return;

  const q = AppState.questions[AppState.currentIndex];
  if (!q) return;

  const selectedOpt = AppState.userAnswers[q.id];
  const isStarred = AppState.starred.has(q.id);
  const optLabels = ["(A)", "(B)", "(C)", "(D)"];

  let html = `
    <div class="question-card">
      <div class="q-header">
        <div class="q-badge-group">
          <span class="q-badge">第 ${AppState.currentIndex + 1} / ${AppState.questions.length} 題 · ${q.categoryName}</span>
        </div>
        <div class="q-actions">
          <button class="btn-icon ${isStarred ? 'active' : ''}" title="${isStarred ? '取消標記' : '標記此題'}" onclick="toggleStarQuestion(${q.id})">
            ${isStarred ? '★ 已標記' : '☆ 標記待查'}
          </button>
        </div>
      </div>

      <div class="q-title">${q.question}</div>

      <div class="options-list">
        ${q.options.map((opt, optIdx) => {
          const isSelected = selectedOpt === optIdx;
          return `
            <div class="option-item ${isSelected ? 'selected' : ''}" onclick="handleExamSelectAnswer(${q.id}, ${optIdx})">
              <span class="opt-prefix">${optLabels[optIdx]}</span>
              <span>${opt}</span>
            </div>
          `;
        }).join('')}
      </div>

      <div style="display: flex; justify-content: space-between; margin-top: 1.5rem; gap: 0.75rem;">
        <button class="btn-secondary" ${AppState.currentIndex === 0 ? 'disabled style="opacity:0.45;cursor:not-allowed;"' : ''} onclick="jumpToExamQuestion(${AppState.currentIndex - 1})">
          ← 上一題
        </button>
        <button class="btn-primary" ${AppState.currentIndex === AppState.questions.length - 1 ? 'disabled style="opacity:0.45;cursor:not-allowed;"' : ''} onclick="jumpToExamQuestion(${AppState.currentIndex + 1})">
          下一題 →
        </button>
      </div>

      <div class="shortcut-hint">
        <span>⌨️ 鍵盤快捷鍵：按 <strong>1~4</strong> 或 <strong>A~D</strong> 作答 ｜ <strong>← →</strong> 切換題目 ｜ <strong>S</strong> 標記題目</span>
        <span>未作答：${AppState.questions.length - Object.keys(AppState.userAnswers).length} 題</span>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

function handleExamSelectAnswer(questionId, optIndex) {
  AppState.userAnswers[questionId] = optIndex;
  renderCurrentExamQuestion();
  renderExamNavGrid();
}

function confirmSubmitExam() {
  const answeredCount = Object.keys(AppState.userAnswers).length;
  const total = AppState.questions.length;
  const unanswered = total - answeredCount;

  let msg = `您目前已作答 ${answeredCount} / ${total} 題。`;
  if (unanswered > 0) {
    msg += `\n尚有 ${unanswered} 題未作答，確定要現在交卷嗎？`;
  } else {
    msg += `\n已完成所有題目，確定要交卷評分嗎？`;
  }

  if (confirm(msg)) {
    clearInterval(AppState.timerInterval);
    submitExam();
  }
}

function submitExam() {
  AppState.isExamSubmitted = true;
  let correctCount = 0;

  AppState.questions.forEach(q => {
    const userAns = AppState.userAnswers[q.id];
    if (userAns !== undefined) {
      AppState.practiceHistory[q.id] = userAns;
    }
    if (userAns === q.answer) {
      correctCount++;
    } else {
      AppState.wrongRecords[q.id] = (AppState.wrongRecords[q.id] || 0) + 1;
    }
  });

  const total = AppState.questions.length;
  const score = Math.round((correctCount / total) * 100);
  const isPass = score >= 60;

  const record = {
    id: Date.now(),
    date: new Date().toLocaleString("zh-TW"),
    bankName: getActiveBankMeta().shortName,
    totalQuestions: total,
    correctCount: correctCount,
    score: score,
    isPass: isPass
  };
  AppState.examHistory.unshift(record);
  saveLocalData();

  AppState.lastExamResult = {
    score,
    isPass,
    correctCount,
    total,
    record
  };

  switchTab("result");
}

function renderExamResult(container) {
  const result = AppState.lastExamResult;
  if (!result) {
    switchTab("home");
    return;
  }

  const optLabels = ["(A)", "(B)", "(C)", "(D)"];

  let html = `
    <div class="result-card">
      <div class="score-circle ${result.isPass ? 'pass' : 'fail'}">
        <div class="score-num">${result.score}</div>
        <div class="score-total">/ 100 分</div>
      </div>

      <h2 style="font-size: 1.45rem; font-weight: 800; color: ${result.isPass ? 'var(--success)' : 'var(--danger)'}">
        ${result.isPass ? '🎉 恭喜測驗合格！成績已達 60 分及格標準' : '💪 尚未達 60 分及格門檻，助教陪您繼續衝刺！'}
      </h2>
      <p style="color: var(--text-muted); margin-top: 0.45rem;">
        本次測驗共 ${result.total} 題，答對 ${result.correctCount} 題，答錯或未答 ${result.total - result.correctCount} 題。
      </p>

      <div class="result-breakdown">
        <div class="breakdown-box">
          <div class="lbl">答對題數</div>
          <div class="val" style="color: var(--success);">${result.correctCount} 題</div>
        </div>
        <div class="breakdown-box">
          <div class="lbl">答錯／未答</div>
          <div class="val" style="color: var(--danger);">${result.total - result.correctCount} 題</div>
        </div>
        <div class="breakdown-box">
          <div class="lbl">換算總分</div>
          <div class="val">${result.score} 分</div>
        </div>
      </div>

      <div style="display: flex; gap: 0.65rem; justify-content: center; flex-wrap: wrap;">
        <button class="btn-primary" onclick="switchTab('exam', ${result.total})">🔄 再測一次 (${result.total}題)</button>
        <button class="btn-secondary" onclick="switchTab('wrong')">⚠️ 前往錯題本</button>
        <button class="btn-secondary" onclick="switchTab('home')">🏠 返回首頁</button>
      </div>
    </div>

    <div style="max-width: 880px; margin: 2.25rem auto 0;">
      <h3 style="font-size: 1.25rem; font-weight: 800; margin-bottom: 1rem; border-left: 4px solid var(--primary); padding-left: 0.75rem;">
        📋 本次測驗試題逐題詳解與法條檢討
      </h3>
  `;

  AppState.questions.forEach((q, idx) => {
    const userAns = AppState.userAnswers[q.id];
    const isCorrect = userAns === q.answer;
    const isStarred = AppState.starred.has(q.id);

    html += `
      <div class="question-card" style="border-left: 4px solid ${isCorrect ? 'var(--success)' : 'var(--danger)'}">
        <div class="q-header">
          <span class="q-badge" style="${isCorrect ? 'background: var(--success-bg); color: var(--success-text)' : 'background: var(--danger-bg); color: var(--danger-text)'}">
            第 ${idx + 1} 題 · ${isCorrect ? '✅ 答對' : (userAns === undefined ? '⚪ 未作答' : '❌ 答錯')} (${q.categoryName})
          </span>
          <button class="btn-icon ${isStarred ? 'active' : ''}" onclick="toggleStarQuestion(${q.id})">
            ${isStarred ? '★ 已收藏' : '☆ 收藏'}
          </button>
        </div>

        <div class="q-title">${q.question}</div>

        <div class="options-list">
          ${q.options.map((opt, optIdx) => {
            let optClass = "option-item";
            if (optIdx === q.answer) {
              optClass += " correct";
            } else if (optIdx === userAns) {
              optClass += " wrong";
            }
            return `
              <div class="${optClass}">
                <span class="opt-prefix">${optLabels[optIdx]}</span>
                <span>${opt}</span>
              </div>
            `;
          }).join('')}
        </div>

        <div class="explanation-box">
          <div class="exp-law">📜 <strong>官方法源依據：</strong>${q.lawSource}</div>
          <div style="margin-top: 0.45rem;">💡 <strong>正解確認：</strong>${optLabels[q.answer]} ${q.options[q.answer]}</div>
          ${q.trapTip ? `<div class="exp-trap">${q.trapTip}</div>` : ''}
        </div>
      </div>
    `;
  });

  html += `</div>`;
  container.innerHTML = html;
}

function renderWrongBook(container) {
  const wrongIds = Object.keys(AppState.wrongRecords).map(Number);
  const wrongQuestions = QUESTION_DATABASE.filter(q => wrongIds.includes(q.id))
    .sort((a, b) => (AppState.wrongRecords[b.id] || 1) - (AppState.wrongRecords[a.id] || 1));

  let html = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 0.75rem;">
      <div>
        <h2 style="font-weight: 800; font-size: 1.35rem;">💡 個人錯題筆記本</h2>
        <p style="color: var(--text-muted); font-size: 0.86rem;">
          已收錄 ${wrongQuestions.length} 道錯題（依答錯頻率由高至低排序）· 支援錯題重測挑戰
        </p>
      </div>
      <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
        ${wrongQuestions.length > 0 ? `
          <button class="btn-primary" onclick="switchTab('practice', '__wrong_drill__')">🎯 啟動錯題重測特訓 (${wrongQuestions.length}題)</button>
          <button class="tool-btn ${AppState.hideWrongAnswers ? 'active-toggle' : ''}" onclick="AppState.hideWrongAnswers = !AppState.hideWrongAnswers; renderWrongBook(document.getElementById('mainContent'))">
            👁️ ${AppState.hideWrongAnswers ? '顯示正解與解析' : '遮蔽答案自測'}
          </button>
          <button class="tool-btn" onclick="clearAllWrongRecords()">🗑️ 清空錯題</button>
        ` : ''}
      </div>
    </div>
  `;

  if (wrongQuestions.length === 0) {
    html += `
      <div class="result-card" style="margin-top: 2rem;">
        <div style="font-size: 3rem; margin-bottom: 1rem;">🎉</div>
        <h3>太棒了！目前沒有任何錯題記錄</h3>
        <p style="color: var(--text-muted); margin: 0.75rem 0 1.5rem;">在模擬考或章節刷題時答錯的題目，系統將自動為您歸納於此，方便考前集中複習。</p>
        <button class="btn-primary" onclick="switchTab('exam', 20)">前往隨機模擬考 →</button>
      </div>
    `;
    container.innerHTML = html;
    return;
  }

  const optLabels = ["(A)", "(B)", "(C)", "(D)"];

  wrongQuestions.forEach((q, idx) => {
    const wrongCount = AppState.wrongRecords[q.id] || 1;
    const isStarred = AppState.starred.has(q.id);

    html += `
      <div class="question-card" id="wrong-card-${q.id}">
        <div class="q-header">
          <div class="q-badge-group">
            <span class="q-badge" style="background: var(--danger-bg); color: var(--danger-text)">
              錯題 #${idx + 1} · 累積答錯 ${wrongCount} 次
            </span>
            <span class="q-sub-badge">${q.categoryName} · ${q.sectionName || ''}</span>
          </div>
          <div class="q-actions">
            <button class="btn-icon" onclick="speakQuestion(${q.id})">🔊 朗讀</button>
            <button class="btn-icon ${isStarred ? 'active' : ''}" onclick="toggleStarQuestion(${q.id})">
              ${isStarred ? '★ 已收藏' : '☆ 收藏'}
            </button>
            <button class="btn-icon" style="color: var(--danger)" title="已學會，從錯題本移除" onclick="removeSingleWrong(${q.id})">
              ✓ 已掌握移除
            </button>
          </div>
        </div>

        <div class="q-title">${q.question}</div>

        <div class="options-list">
          ${q.options.map((opt, optIdx) => `
            <div class="option-item ${!AppState.hideWrongAnswers && optIdx === q.answer ? 'correct' : ''}">
              <span class="opt-prefix">${optLabels[optIdx]}</span>
              <span>${opt}</span>
            </div>
          `).join('')}
        </div>

        ${!AppState.hideWrongAnswers ? `
          <div class="explanation-box">
            <div class="exp-law">📜 <strong>官方法源依據：</strong>${q.lawSource}</div>
            <div style="margin-top: 0.45rem;">💡 <strong>正解確認：</strong>${optLabels[q.answer]} ${q.options[q.answer]}</div>
            ${q.trapTip ? `<div class="exp-trap">${q.trapTip}</div>` : ''}
          </div>
        ` : ''}
      </div>
    `;
  });

  container.innerHTML = html;
}

function removeSingleWrong(questionId) {
  delete AppState.wrongRecords[questionId];
  saveLocalData();
  renderWrongBook(document.getElementById("mainContent"));
}

function clearAllWrongRecords() {
  if (confirm("確定要清空所有錯題筆記記錄嗎？")) {
    AppState.wrongRecords = {};
    saveLocalData();
    renderWrongBook(document.getElementById("mainContent"));
  }
}

function renderBookmarks(container) {
  const starredIds = Array.from(AppState.starred);
  const starredQuestions = QUESTION_DATABASE.filter(q => starredIds.includes(q.id));

  let html = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 0.75rem;">
      <div>
        <h2 style="font-weight: 800; font-size: 1.35rem;">⭐ 重點收藏題庫</h2>
        <p style="color: var(--text-muted); font-size: 0.86rem;">已收藏 ${starredQuestions.length} 題 · 考前衝刺必背精華清單</p>
      </div>
      <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
        ${starredQuestions.length > 0 ? `
          <button class="btn-primary" onclick="switchTab('practice', '__star_drill__')">🎯 啟動收藏題特訓 (${starredQuestions.length}題)</button>
          <button class="tool-btn ${AppState.hideStarAnswers ? 'active-toggle' : ''}" onclick="AppState.hideStarAnswers = !AppState.hideStarAnswers; renderBookmarks(document.getElementById('mainContent'))">
            👁️ ${AppState.hideStarAnswers ? '顯示正解與解析' : '遮蔽答案自測'}
          </button>
        ` : ''}
      </div>
    </div>
  `;

  if (starredQuestions.length === 0) {
    html += `
      <div class="result-card" style="margin-top: 2rem;">
        <div style="font-size: 3rem; margin-bottom: 1rem;">⭐</div>
        <h3>目前尚未收藏任何題目</h3>
        <p style="color: var(--text-muted); margin: 0.75rem 0 1.5rem;">在刷題或模考時點擊右上角的「☆ 收藏」（或按鍵盤 S 鍵），即可將重要考題收納於此。</p>
        <button class="btn-primary" onclick="switchTab('practice')">開始章節刷題 →</button>
      </div>
    `;
    container.innerHTML = html;
    return;
  }

  const optLabels = ["(A)", "(B)", "(C)", "(D)"];

  starredQuestions.forEach((q, idx) => {
    html += `
      <div class="question-card">
        <div class="q-header">
          <div class="q-badge-group">
            <span class="q-badge">收藏題 #${idx + 1} · ${q.categoryName}</span>
            <span class="q-sub-badge">${q.sectionName || ''}</span>
          </div>
          <div class="q-actions">
            <button class="btn-icon" onclick="speakQuestion(${q.id})">🔊 朗讀</button>
            <button class="btn-icon active" onclick="toggleStarQuestion(${q.id})">★ 取消收藏</button>
          </div>
        </div>

        <div class="q-title">${q.question}</div>

        <div class="options-list">
          ${q.options.map((opt, optIdx) => `
            <div class="option-item ${!AppState.hideStarAnswers && optIdx === q.answer ? 'correct' : ''}">
              <span class="opt-prefix">${optLabels[optIdx]}</span>
              <span>${opt}</span>
            </div>
          `).join('')}
        </div>

        ${!AppState.hideStarAnswers ? `
          <div class="explanation-box">
            <div class="exp-law">📜 <strong>官方法源依據：</strong>${q.lawSource}</div>
            <div style="margin-top: 0.45rem;">💡 <strong>正解確認：</strong>${optLabels[q.answer]} ${q.options[q.answer]}</div>
            ${q.trapTip ? `<div class="exp-trap">${q.trapTip}</div>` : ''}
          </div>
        ` : ''}
      </div>
    `;
  });

  container.innerHTML = html;
}

function highlightKeyword(text, term) {
  if (!term || !text) return text;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(`(${escaped})`, "gi"), '<mark class="hl">$1</mark>');
}

function renderSearch(container) {
  const hotTags = ["押金", "30日", "買賣不破租賃", "包租業", "代管業", "營業保證金", "罰鍰", "審閱期", "遺留物", "點交", "滅火器", "室內裝修", "房屋稅", "所得稅"];

  let html = `
    <div>
      <h2 style="font-weight: 800; font-size: 1.35rem; margin-bottom: 0.4rem;">🔍 題庫與法規條文智慧檢索</h2>
      <p style="color: var(--text-muted); font-size: 0.86rem; margin-bottom: 1.15rem;">
        支援跨題幹、選項、法條依據與助教叮嚀全文檢索（當前範圍：${getActiveBankMeta().shortName}，共 ${getActiveDatabase().length} 題）
      </p>

      <div class="search-bar-wrap">
        <input type="text" id="searchInput" class="search-input" placeholder="輸入法條（如：第17條、第425條）或考點關鍵字（如：押金、轉租、30日）..." oninput="AppState.searchLimit = 50; handleSearch(this.value)">
        <select id="searchCatSelect" class="tool-btn" onchange="AppState.searchCategory = this.value; handleSearch(document.getElementById('searchInput').value)">
          <option value="all">全部 10 大章節</option>
          ${EXAM_CATEGORIES.map(c => `<option value="${c.id}" ${AppState.searchCategory === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
        </select>
      </div>

      <div class="quick-tags">
        <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600;">🔥 高頻考點快搜：</span>
        ${hotTags.map(tag => `<button class="tag-chip" onclick="quickSearchTag('${tag}')">${tag}</button>`).join('')}
      </div>

      <div id="searchResultsCount" style="margin-bottom: 1rem; font-size: 0.9rem; color: var(--text-muted); font-weight: 600;">
        請輸入關鍵字或點擊上方高頻考點標籤開始檢索...
      </div>

      <div id="searchResultsList"></div>
    </div>
  `;

  container.innerHTML = html;
  if (AppState.searchTerm) {
    const input = document.getElementById("searchInput");
    if (input) {
      input.value = AppState.searchTerm;
      handleSearch(AppState.searchTerm);
    }
  }
}

function quickSearchTag(tag) {
  const input = document.getElementById("searchInput");
  if (input) {
    input.value = tag;
    AppState.searchLimit = 50;
    handleSearch(tag);
  }
}

function handleSearch(term) {
  AppState.searchTerm = (term || "").trim();
  const qLower = AppState.searchTerm.toLowerCase();
  const list = document.getElementById("searchResultsList");
  const countEl = document.getElementById("searchResultsCount");
  if (!list || !countEl) return;

  const activeDB = getActiveDatabase();

  if (!qLower && AppState.searchCategory === "all") {
    countEl.textContent = "請輸入關鍵字或點擊上方高頻考點標籤開始檢索...";
    list.innerHTML = "";
    return;
  }

  const results = activeDB.filter(q => {
    if (AppState.searchCategory !== "all" && q.categoryId !== AppState.searchCategory) {
      return false;
    }
    if (!qLower) return true;
    return (
      q.question.toLowerCase().includes(qLower) ||
      q.lawSource.toLowerCase().includes(qLower) ||
      (q.sectionName && q.sectionName.toLowerCase().includes(qLower)) ||
      (q.trapTip && q.trapTip.toLowerCase().includes(qLower)) ||
      q.options.some(opt => opt.toLowerCase().includes(qLower))
    );
  });

  countEl.textContent = `共找到 ${results.length} 筆符合條件之題目：`;

  if (results.length === 0) {
    list.innerHTML = `<div class="question-card" style="text-align: center; color: var(--text-muted);">查無符合條件之題目，建議嘗試其他關鍵字或切換至「1,345 題全集」。</div>`;
    return;
  }

  const optLabels = ["(A)", "(B)", "(C)", "(D)"];
  const visibleResults = results.slice(0, AppState.searchLimit);

  let html = visibleResults.map(q => {
    const isStarred = AppState.starred.has(q.id);
    return `
      <div class="question-card">
        <div class="q-header">
          <div class="q-badge-group">
            <span class="q-badge">${q.categoryName}</span>
            <span class="q-sub-badge">#${q.qno || q.id} · ${q.sectionName || ''}</span>
          </div>
          <div class="q-actions">
            <button class="btn-icon" onclick="speakQuestion(${q.id})">🔊 朗讀</button>
            <button class="btn-icon ${isStarred ? 'active' : ''}" onclick="toggleStarQuestion(${q.id})">
              ${isStarred ? '★ 已收藏' : '☆ 收藏'}
            </button>
          </div>
        </div>

        <div class="q-title">${highlightKeyword(q.question, AppState.searchTerm)}</div>

        <div class="options-list">
          ${q.options.map((opt, optIdx) => `
            <div class="option-item ${optIdx === q.answer ? 'correct' : ''}">
              <span class="opt-prefix">${optLabels[optIdx]}</span>
              <span>${highlightKeyword(opt, AppState.searchTerm)}</span>
            </div>
          `).join('')}
        </div>

        <div class="explanation-box">
          <div class="exp-law">📜 <strong>官方法源依據：</strong>${highlightKeyword(q.lawSource, AppState.searchTerm)}</div>
          ${q.trapTip ? `<div class="exp-trap">${highlightKeyword(q.trapTip, AppState.searchTerm)}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');

  if (results.length > AppState.searchLimit) {
    html += `
      <div style="text-align: center; margin: 1.5rem 0;">
        <button class="btn-secondary" onclick="AppState.searchLimit += 50; handleSearch(AppState.searchTerm)">
          顯示更多結果（尚有 ${results.length - AppState.searchLimit} 題）↓
        </button>
      </div>
    `;
  }

  list.innerHTML = html;
}

function renderAnalytics(container) {
  const activeDB = getActiveDatabase();
  const history = AppState.examHistory;
  const totalTests = history.length;
  const passTests = history.filter(h => h.isPass).length;
  const passRate = totalTests > 0 ? Math.round((passTests / totalTests) * 100) : 0;
  const avgScore = totalTests > 0 ? Math.round(history.reduce((sum, h) => sum + h.score, 0) / totalTests) : 0;

  let html = `
    <div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.75rem;">
        <div>
          <h2 style="font-weight: 800; font-size: 1.35rem;">📊 學習戰報、章節診斷與官方資源專區</h2>
          <p style="color: var(--text-muted); font-size: 0.86rem;">全方位追蹤十大章節掌握度、歷次模擬考成績與 115.02.06 官方題庫原檔下載</p>
        </div>
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          <button class="tool-btn" onclick="exportStudyData()">📤 匯出學習紀錄備份</button>
          <button class="tool-btn" onclick="document.getElementById('importFileInput').click()">📥 匯入學習紀錄</button>
          <input type="file" id="importFileInput" accept=".json" style="display:none" onchange="importStudyData(event)">
        </div>
      </div>

      <div class="result-breakdown">
        <div class="breakdown-box">
          <div class="lbl">累積模擬考次數</div>
          <div class="val">${totalTests} 次</div>
        </div>
        <div class="breakdown-box">
          <div class="lbl">模考合格率</div>
          <div class="val" style="color: var(--success);">${passRate}%</div>
        </div>
        <div class="breakdown-box">
          <div class="lbl">平均模考得分</div>
          <div class="val" style="color: var(--primary);">${avgScore} 分</div>
        </div>
        <div class="breakdown-box">
          <div class="lbl">待複習錯題／已收藏</div>
          <div class="val" style="color: var(--warning);">${Object.keys(AppState.wrongRecords).length} / ${AppState.starred.size} 題</div>
        </div>
      </div>

      <h3 style="font-size: 1.18rem; font-weight: 800; margin: 2rem 0 0.85rem;">🎯 十大章節掌握度與弱點診斷表（${getActiveBankMeta().shortName}）</h3>
      <div class="question-card" style="padding: 0; overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; font-size: 0.88rem; min-width: 620px;">
          <thead>
            <tr style="background: var(--bg-subtle); text-align: left; border-bottom: 1px solid var(--border-color);">
              <th style="padding: 0.75rem 1rem;">章節名稱</th>
              <th style="padding: 0.75rem 1rem;">題數</th>
              <th style="padding: 0.75rem 1rem;">已刷進度</th>
              <th style="padding: 0.75rem 1rem;">答對率</th>
              <th style="padding: 0.75rem 1rem;">待加強錯題</th>
              <th style="padding: 0.75rem 1rem;">快速行動</th>
            </tr>
          </thead>
          <tbody>
            ${EXAM_CATEGORIES.map(cat => {
              const catQs = activeDB.filter(q => q.categoryId === cat.id);
              const doneQs = catQs.filter(q => AppState.practiceHistory[q.id] !== undefined);
              const correctQs = doneQs.filter(q => AppState.practiceHistory[q.id] === q.answer);
              const wrongInCat = catQs.filter(q => AppState.wrongRecords[q.id]).length;
              const pct = catQs.length > 0 ? Math.round((doneQs.length / catQs.length) * 100) : 0;
              const acc = doneQs.length > 0 ? Math.round((correctQs.length / doneQs.length) * 100) : 0;
              return `
                <tr style="border-bottom: 1px solid var(--border-color);">
                  <td style="padding: 0.75rem 1rem; font-weight: 700;">${cat.name}</td>
                  <td style="padding: 0.75rem 1rem;">${catQs.length} 題</td>
                  <td style="padding: 0.75rem 1rem;">${doneQs.length} / ${catQs.length} (${pct}%)</td>
                  <td style="padding: 0.75rem 1rem; font-weight: 700; color: ${doneQs.length === 0 ? 'var(--text-muted)' : (acc >= 60 ? 'var(--success)' : 'var(--danger)')};">
                    ${doneQs.length > 0 ? acc + '%' : '尚未練習'}
                  </td>
                  <td style="padding: 0.75rem 1rem; color: ${wrongInCat > 0 ? 'var(--danger)' : 'var(--text-muted)'}; font-weight: 700;">
                    ${wrongInCat} 題
                  </td>
                  <td style="padding: 0.75rem 1rem;">
                    <button class="tool-btn" style="padding: 0.25rem 0.6rem; font-size: 0.78rem;" onclick="switchTab('practice', '${cat.id}')">進入刷題 →</button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <h3 style="font-size: 1.18rem; font-weight: 800; margin: 2rem 0 0.85rem;">📥 全聯會 115.02.06 最新官方題庫 PDF 原檔下載</h3>
      <div class="mode-grid" style="margin-bottom: 2rem;">
        <a class="mode-card" href="https://rentalh.org.tw/public/downinfo/42_11775807287.pdf" target="_blank" rel="noopener" style="text-decoration:none;">
          <div>
            <h3>📘 資格訓練題庫（含法源依據）</h3>
            <p>115.02.06 最新更新版 · 共 357 頁 · 全 966 題完整條文依據</p>
          </div>
          <span class="mode-badge" style="background: var(--primary-light); color: var(--primary);">官方 PDF 下載 (4.2 MB) ↗</span>
        </a>
        <a class="mode-card" href="https://rentalh.org.tw/public/downinfo/43_11775807159.pdf" target="_blank" rel="noopener" style="text-decoration:none;">
          <div>
            <h3>📗 資格訓練題庫（不含法源依據）</h3>
            <p>115.02.06 最新更新版 · 共 202 頁 · 適合快速翻閱刷題</p>
          </div>
          <span class="mode-badge" style="background: #dcfce7; color: #15803d;">官方 PDF 下載 (2.0 MB) ↗</span>
        </a>
        <a class="mode-card" href="https://rentalh.org.tw/public/downinfo/44_11776651645.pdf" target="_blank" rel="noopener" style="text-decoration:none;">
          <div>
            <h3>📙 換證訓練題庫（含法源依據）</h3>
            <p>115.02.06 最新更新版 · 共 190 頁 · 全 379 題換證複訓專用</p>
          </div>
          <span class="mode-badge" style="background: #fef3c7; color: #b45309;">官方 PDF 下載 (2.0 MB) ↗</span>
        </a>
        <a class="mode-card" href="https://rentalh.org.tw/public/downinfo/45_11776651677.pdf" target="_blank" rel="noopener" style="text-decoration:none;">
          <div>
            <h3>📕 換證訓練題庫（不含法源依據）</h3>
            <p>115.02.06 最新更新版 · 共 80 頁 · 換證訓練精簡版題庫</p>
          </div>
          <span class="mode-badge" style="background: #fdf2f8; color: #db2777;">官方 PDF 下載 (871 KB) ↗</span>
        </a>
      </div>

      <h3 style="font-size: 1.18rem; font-weight: 800; margin: 2rem 0 0.85rem;">📚 歷次模擬考成績紀錄</h3>
  `;

  if (history.length === 0) {
    html += `
      <div class="question-card" style="text-align: center; color: var(--text-muted);">
        尚無模擬測驗紀錄，完成模擬考後將自動在此記錄您的成績趨勢！
      </div>
    `;
  } else {
    html += `
      <div class="question-card" style="padding: 0; overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; font-size: 0.88rem; min-width: 540px;">
          <thead>
            <tr style="background: var(--bg-subtle); text-align: left; border-bottom: 1px solid var(--border-color);">
              <th style="padding: 0.75rem 1rem;">測驗時間</th>
              <th style="padding: 0.75rem 1rem;">題庫版本</th>
              <th style="padding: 0.75rem 1rem;">題數</th>
              <th style="padding: 0.75rem 1rem;">答對 / 答錯</th>
              <th style="padding: 0.75rem 1rem;">得分</th>
              <th style="padding: 0.75rem 1rem;">及格判定</th>
            </tr>
          </thead>
          <tbody>
            ${history.map(h => `
              <tr style="border-bottom: 1px solid var(--border-color);">
                <td style="padding: 0.75rem 1rem;">${h.date}</td>
                <td style="padding: 0.75rem 1rem;">${h.bankName || '996 題全真版'}</td>
                <td style="padding: 0.75rem 1rem;">${h.totalQuestions} 題</td>
                <td style="padding: 0.75rem 1rem;">${h.correctCount} / ${h.totalQuestions - h.correctCount}</td>
                <td style="padding: 0.75rem 1rem; font-weight: 800; color: ${h.isPass ? 'var(--success)' : 'var(--danger)'}">${h.score} 分</td>
                <td style="padding: 0.75rem 1rem;">
                  <span style="padding: 0.2rem 0.55rem; border-radius: 4px; font-size: 0.75rem; font-weight: 700; ${h.isPass ? 'background: var(--success-bg); color: var(--success-text)' : 'background: var(--danger-bg); color: var(--danger-text)'}">
                    ${h.isPass ? '合格' : '未達標'}
                  </span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <div style="margin-top: 1rem; text-align: right;">
        <button class="tool-btn" onclick="clearExamHistory()">🗑️ 清空歷史成績</button>
      </div>
    `;
  }

  html += `</div>`;
  container.innerHTML = html;
}

function exportStudyData() {
  const payload = {
    exportedAt: new Date().toISOString(),
    activeBank: AppState.activeBank,
    starred: Array.from(AppState.starred),
    wrongRecords: AppState.wrongRecords,
    examHistory: AppState.examHistory,
    practiceHistory: AppState.practiceHistory
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `租賃住宅管理人員題庫_學習紀錄備份_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importStudyData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (Array.isArray(data.starred)) AppState.starred = new Set(data.starred);
      if (data.wrongRecords) AppState.wrongRecords = data.wrongRecords;
      if (Array.isArray(data.examHistory)) AppState.examHistory = data.examHistory;
      if (data.practiceHistory) AppState.practiceHistory = data.practiceHistory;
      saveLocalData();
      alert("✅ 學習紀錄匯入成功！");
      renderAnalytics(document.getElementById("mainContent"));
    } catch (err) {
      alert("❌ 匯入失敗：檔案格式不正確。");
    }
  };
  reader.readAsText(file);
}

function clearExamHistory() {
  if (confirm("確定要清空歷次模擬測驗的成績紀錄嗎？")) {
    AppState.examHistory = [];
    saveLocalData();
    renderAnalytics(document.getElementById("mainContent"));
  }
}

function printQuestions() {
  window.print();
}

// Global Keyboard Shortcuts for Practice & Exam Mode
document.addEventListener("keydown", e => {
  if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) return;
  if (AppState.activeTab !== "practice" && AppState.activeTab !== "exam") return;

  const q = AppState.questions[AppState.currentIndex];
  if (!q) return;

  const key = e.key.toUpperCase();
  const optMap = { "1": 0, "2": 1, "3": 2, "4": 3, "A": 0, "B": 1, "C": 2, "D": 3 };

  if (key in optMap) {
    e.preventDefault();
    if (AppState.activeTab === "practice") {
      handlePracticeAnswer(q.id, optMap[key]);
    } else {
      handleExamSelectAnswer(q.id, optMap[key]);
    }
  } else if (e.key === "ArrowRight") {
    e.preventDefault();
    if (AppState.activeTab === "practice") jumpToQuestion(AppState.currentIndex + 1);
    else jumpToExamQuestion(AppState.currentIndex + 1);
  } else if (e.key === "ArrowLeft") {
    e.preventDefault();
    if (AppState.activeTab === "practice") jumpToQuestion(AppState.currentIndex - 1);
    else jumpToExamQuestion(AppState.currentIndex - 1);
  } else if (key === "S") {
    e.preventDefault();
    toggleStarQuestion(q.id);
  } else if (key === "R" && AppState.activeTab === "practice") {
    e.preventDefault();
    speakQuestion(q.id);
  }
});

async function openConnectionModal() {
  let existing = document.getElementById("connectionModalOverlay");
  if (existing) existing.remove();

  const permanentCloudUrl = "https://94victor0318-prog.github.io/rental-housing-exam/";
  const localUrl = "http://localhost:5500/";
  const qrImgHtml = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(permanentCloudUrl)}" alt="手機掃描永久雲端網址 QR Code" style="width:160px;height:160px;border-radius:12px;border:4px solid #fff;box-shadow:0 4px 14px rgba(0,0,0,0.12);" />`;

  const modal = document.createElement("div");
  modal.id = "connectionModalOverlay";
  modal.style.cssText = "position:fixed;inset:0;background:rgba(15,23,42,0.65);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem;";
  modal.onclick = (ev) => { if (ev.target === modal) modal.remove(); };

  modal.innerHTML = `
    <div style="background:var(--bg-card);color:var(--text-primary);max-width:560px;width:100%;border-radius:18px;padding:1.5rem;box-shadow:0 20px 50px rgba(0,0,0,0.3);border:1px solid var(--border-color);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
        <h3 style="margin:0;font-size:1.18rem;font-weight:800;">🌐 永久雲端連網網址 ＆ 手機跨裝置 QR Code</h3>
        <button onclick="document.getElementById('connectionModalOverlay').remove()" style="background:none;border:none;font-size:1.3rem;cursor:pointer;color:var(--text-secondary);">✕</button>
      </div>

      <div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.28);border-radius:12px;padding:1rem;margin-bottom:1rem;">
        <div style="font-weight:800;color:#10b981;margin-bottom:0.35rem;">⭐ 1. GitHub Pages 永久雲端網址（24 小時全年無休、電腦關機也能連！）</div>
        <div style="font-size:0.84rem;color:var(--text-secondary);margin-bottom:0.65rem;">
          此網址部署於 GitHub 全球雲端 CDN，<strong>網址永遠固定不變、絕不過期</strong>！請按 <code>Ctrl + D</code> 將此網址加入 Chrome 書籤列，手機／平板掃描下方 QR Code 即可隨時刷題：
        </div>
        <div style="display:flex;gap:0.5rem;align-items:center;margin-bottom:0.9rem;">
          <input type="text" readonly value="${permanentCloudUrl}" style="flex:1;padding:0.5rem 0.75rem;border-radius:8px;border:1px solid var(--border-color);background:var(--bg-main);color:var(--text-primary);font-family:monospace;font-size:0.88rem;" />
          <button class="btn btn-primary" style="padding:0.5rem 0.9rem;font-size:0.85rem;white-space:nowrap;background:#10b981;border-color:#10b981;" onclick="copyTextHelper('${permanentCloudUrl}', this)">複製永久網址</button>
        </div>
        <div style="text-align:center;">
          ${qrImgHtml}
        </div>
      </div>

      <div style="background:rgba(37,99,235,0.08);border:1px solid rgba(37,99,235,0.25);border-radius:12px;padding:0.9rem 1rem;">
        <div style="font-weight:800;color:var(--primary-color);margin-bottom:0.3rem;">🖥️ 2. 電腦本機開發網址</div>
        <div style="display:flex;gap:0.5rem;align-items:center;">
          <input type="text" readonly value="${localUrl}" style="flex:1;padding:0.45rem 0.75rem;border-radius:8px;border:1px solid var(--border-color);background:var(--bg-main);color:var(--text-primary);font-family:monospace;font-size:0.88rem;" />
          <button class="btn btn-primary" style="padding:0.45rem 0.85rem;font-size:0.84rem;white-space:nowrap;" onclick="copyTextHelper('${localUrl}', this)">複製本機</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function copyTextHelper(text, btnEl) {
  navigator.clipboard.writeText(text).then(() => {
    const old = btnEl.textContent;
    btnEl.textContent = "✅ 已複製";
    setTimeout(() => { btnEl.textContent = old; }, 1800);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  loadLocalData();
  const themeBtn = document.getElementById("themeToggleBtn");
  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      const nextTheme = AppState.theme === "dark" ? "light" : "dark";
      setTheme(nextTheme);
    });
  }
  switchTab("home");
});

