
// 租賃住宅管理人員測驗系統核心邏輯
const AppState = {
  activeTab: "home",
  activeCategory: null,
  questions: [],
  currentIndex: 0,
  userAnswers: {},
  starred: new Set(),
  wrongRecords: {},
  examHistory: [],
  timerInterval: null,
  timerSeconds: 0,
  isExamSubmitted: false,
  searchTerm: "",
  theme: "light"
};

function loadLocalData() {
  try {
    const savedStars = localStorage.getItem("rh_starred");
    if (savedStars) AppState.starred = new Set(JSON.parse(savedStars));
    const savedWrongs = localStorage.getItem("rh_wrong");
    if (savedWrongs) AppState.wrongRecords = JSON.parse(savedWrongs);
    const savedHistory = localStorage.getItem("rh_history");
    if (savedHistory) AppState.examHistory = JSON.parse(savedHistory);
    const savedTheme = localStorage.getItem("rh_theme") || "light";
    setTheme(savedTheme);
  } catch (e) {
    console.error("載入本地資料失敗:", e);
  }
}

function saveLocalData() {
  try {
    localStorage.setItem("rh_starred", JSON.stringify(Array.from(AppState.starred)));
    localStorage.setItem("rh_wrong", JSON.stringify(AppState.wrongRecords));
    localStorage.setItem("rh_history", JSON.stringify(AppState.examHistory));
  } catch (e) {
    console.error("儲存本地資料失敗:", e);
  }
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

function switchTab(tabId, param = null) {
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
    case "exam": initExamMode(mainContainer, param); break;
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
  const totalQ = QUESTION_DATABASE.length;
  const starredQ = AppState.starred.size;
  const wrongQ = Object.keys(AppState.wrongRecords).length;
  const examCount = AppState.examHistory.length;

  let html = `
    <div class="hero-banner">
      <div class="hero-title">🏛️ 租賃住宅管理人員資格訓練測驗系統</div>
      <p class="hero-desc">
        依據內政部地政司與全聯會最新公告法規製作，包含精準法條依據、考點陷阱提醒與專業助教詳解。
      </p>
      <div class="hero-stats">
        <div class="stat-chip">📚 題庫收錄：<strong>${totalQ}</strong> 題</div>
        <div class="stat-chip">📝 模擬考紀錄：<strong>${examCount}</strong> 次</div>
        <div class="stat-chip">⭐ 個人收藏：<strong>${starredQ}</strong> 題</div>
        <div class="stat-chip">⚠️ 待複習錯題：<strong>${wrongQ}</strong> 題</div>
      </div>
    </div>

    <h3 style="margin-bottom: 1rem; font-weight: 800;">🎯 測驗與練習模式</h3>
    <div class="mode-grid">
      <div class="mode-card" onclick="switchTab('exam', 20)">
        <div>
          <div class="mode-icon-box" style="background: #e0e7ff; color: #4338ca;">⚡</div>
          <h3>快速隨機模擬考</h3>
          <p>隨機抽取 20 題核心考古題，限時 25 分鐘，即時掌握常考重點觀念。</p>
        </div>
        <span class="mode-badge" style="background: #e0e7ff; color: #4338ca;">20 題 · 限時 25 分</span>
      </div>

      <div class="mode-card" onclick="switchTab('exam', 50)">
        <div>
          <div class="mode-icon-box" style="background: #fee2e2; color: #b91c1c;">🏆</div>
          <h3>標準實戰模擬考</h3>
          <p>模擬正式證照考試規範（及格門檻 60 分），50 題考科落點精準診斷。</p>
        </div>
        <span class="mode-badge" style="background: #fee2e2; color: #b91c1c;">50 題 · 限時 60 分</span>
      </div>

      <div class="mode-card" onclick="switchTab('exam', 100)">
        <div>
          <div class="mode-icon-box" style="background: #fdf2f8; color: #db2777;">💯</div>
          <h3>100 題結訓全真模考</h3>
          <p>完全比照官方正式結訓 100 題測驗，涵蓋 10 大官方章節，沉浸式考前衝刺。</p>
        </div>
        <span class="mode-badge" style="background: #fdf2f8; color: #db2777;">100 題 · 限時 90 分</span>
      </div>

      <div class="mode-card" onclick="switchTab('practice')">
        <div>
          <div class="mode-icon-box" style="background: #dcfce7; color: #15803d;">📖</div>
          <h3>分主題章節刷題</h3>
          <p>依據 10 大官方章節單元逐題精讀，支援「即選即看詳解與法條依據」。</p>
        </div>
        <span class="mode-badge" style="background: #dcfce7; color: #15803d;">10 大官方章節</span>
      </div>

      <div class="mode-card" onclick="switchTab('wrong')">
        <div>
          <div class="mode-icon-box" style="background: #fef3c7; color: #b45309;">💡</div>
          <h3>個人錯題筆記本</h3>
          <p>自動收錄做錯的題目，提供弱點重測與觀念徹底釐清。</p>
        </div>
        <span class="mode-badge" style="background: #fef3c7; color: #b45309;">${wrongQ} 道錯題待加強</span>
      </div>
    </div>

    <h3 style="margin-top: 2rem; margin-bottom: 0.5rem; font-weight: 800;">📚 測驗主題單元（點擊直接開始章節練習）</h3>
    <div class="category-list">
  `;

  EXAM_CATEGORIES.forEach(cat => {
    const count = QUESTION_DATABASE.filter(q => q.categoryId === cat.id).length;
    html += `
      <div class="cat-card" onclick="switchTab('practice', '${cat.id}')">
        <div class="cat-icon-badge">📁</div>
        <div class="cat-info">
          <h4>${cat.name}</h4>
          <p>${cat.desc}</p>
          <div style="margin-top: 0.4rem; font-size: 0.75rem; color: var(--primary); font-weight: 700;">
            共 ${count} 題 · 點擊刷題 →
          </div>
        </div>
      </div>
    `;
  });

  html += `</div>`;
  container.innerHTML = html;
}

function initPracticeMode(container, categoryId = null) {
  AppState.activeCategory = categoryId;
  AppState.userAnswers = {};
  AppState.currentIndex = 0;

  if (categoryId) {
    AppState.questions = QUESTION_DATABASE.filter(q => q.categoryId === categoryId);
  } else {
    AppState.questions = [...QUESTION_DATABASE];
  }

  renderPracticeLayout(container);
}

function renderPracticeLayout(container) {
  const currentCat = EXAM_CATEGORIES.find(c => c.id === AppState.activeCategory);
  const catTitle = currentCat ? currentCat.name : "全部章節題庫";

  let html = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 0.75rem;">
      <div>
        <h2 style="font-weight: 800; font-size: 1.4rem;">📖 單元章節刷題：${catTitle}</h2>
        <p style="color: var(--text-muted); font-size: 0.875rem;">共 ${AppState.questions.length} 題 · 即選即看官方條文依據與專業助教解析</p>
      </div>
      <div style="display: flex; gap: 0.5rem; align-items: center;">
        <select id="catSelector" class="tool-btn" style="padding: 0.5rem;" onchange="switchTab('practice', this.value === 'all' ? null : this.value)">
          <option value="all" ${!AppState.activeCategory ? 'selected' : ''}>全科目所有題目</option>
          ${EXAM_CATEGORIES.map(c => `<option value="${c.id}" ${AppState.activeCategory === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
        </select>
        <button class="tool-btn" onclick="printQuestions()">🖨️ 列印試卷</button>
      </div>
    </div>

    <div class="exam-layout">
      <div id="practiceQuestionsContainer"></div>
      <div class="sidebar-panel">
        <div class="panel-title">
          <span>題號導覽</span>
          <span style="font-size: 0.8rem; color: var(--text-muted);">${AppState.questions.length} 題</span>
        </div>
        <div class="q-grid" id="practiceNavGrid"></div>
        <div class="exam-controls">
          <button class="btn-secondary" onclick="switchTab('home')">返回首頁</button>
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

  grid.innerHTML = AppState.questions.map((q, idx) => {
    const isAnswered = AppState.userAnswers[q.id] !== undefined;
    const isCurrent = idx === AppState.currentIndex;
    const isStarred = AppState.starred.has(q.id);

    return `
      <button class="q-grid-btn ${isAnswered ? 'answered' : ''} ${isCurrent ? 'current' : ''} ${isStarred ? 'starred' : ''}"
              onclick="jumpToQuestion(${idx})">
        ${idx + 1}
      </button>
    `;
  }).join('');
}

function jumpToQuestion(index) {
  AppState.currentIndex = index;
  renderCurrentPracticeQuestion();
  renderPracticeNavGrid();
}

function renderCurrentPracticeQuestion() {
  const container = document.getElementById("practiceQuestionsContainer");
  if (!container) return;

  const q = AppState.questions[AppState.currentIndex];
  if (!q) {
    container.innerHTML = `<div class="question-card">本單元暫無題目。</div>`;
    return;
  }

  const selectedOpt = AppState.userAnswers[q.id];
  const isAnswered = selectedOpt !== undefined;
  const isStarred = AppState.starred.has(q.id);
  const optLabels = ["(A)", "(B)", "(C)", "(D)"];

  let html = `
    <div class="question-card">
      <div class="q-header">
        <span class="q-badge">第 ${AppState.currentIndex + 1} / ${AppState.questions.length} 題 · ${q.categoryName}</span>
        <div class="q-actions">
          <button class="btn-icon ${isStarred ? 'active' : ''}" title="${isStarred ? '取消收藏' : '收藏題目'}" onclick="toggleStarQuestion(${q.id})">
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
            ${selectedOpt === q.answer ? '✅ 恭喜答對！' : '❌ 答錯了！正確答案是：' + optLabels[q.answer]}
          </div>
          <div class="exp-law">
            📜 <strong>法規依據：</strong>${q.lawSource}
          </div>
          <div style="margin-top: 0.5rem; line-height: 1.6;">
            💡 <strong>助教解析：</strong>${q.explanation}
          </div>
          ${q.trapTip ? `
            <div class="exp-trap">
              ⚠️ <strong>考點陷阱提醒：</strong>${q.trapTip}
            </div>
          ` : ''}
        </div>
      ` : ''}

      <div style="display: flex; justify-content: space-between; margin-top: 1.5rem;">
        <button class="btn-secondary" ${AppState.currentIndex === 0 ? 'disabled style="opacity:0.5"' : ''} onclick="jumpToQuestion(${AppState.currentIndex - 1})">
          ← 上一題
        </button>
        <button class="btn-primary" ${AppState.currentIndex === AppState.questions.length - 1 ? 'disabled style="opacity:0.5"' : ''} onclick="jumpToQuestion(${AppState.currentIndex + 1})">
          下一題 →
        </button>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

function handlePracticeAnswer(questionId, optIndex) {
  if (AppState.userAnswers[questionId] !== undefined) return;

  AppState.userAnswers[questionId] = optIndex;
  const q = AppState.questions.find(item => item.id === questionId);

  if (q && optIndex !== q.answer) {
    AppState.wrongRecords[q.id] = (AppState.wrongRecords[q.id] || 0) + 1;
    saveLocalData();
  }

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
  }
}

function initExamMode(container, questionCount = 50) {
  AppState.isExamSubmitted = false;
  AppState.userAnswers = {};
  AppState.currentIndex = 0;

  const shuffled = [...QUESTION_DATABASE].sort(() => Math.random() - 0.5);
  AppState.questions = shuffled.slice(0, Math.min(questionCount, shuffled.length));

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
  let html = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 0.75rem;">
      <div>
        <h2 style="font-weight: 800; font-size: 1.4rem;">🏆 租賃住宅管理人員模擬測驗</h2>
        <p style="color: var(--text-muted); font-size: 0.875rem;">共 ${AppState.questions.length} 題 · 及格標準：60 分 · 模擬全真試場規範</p>
      </div>
      <div style="display: flex; gap: 0.5rem; align-items: center;">
        <button class="btn-success" onclick="confirmSubmitExam()">📝 提早交卷評分</button>
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
          <span>答題進度</span>
          <span style="font-size: 0.8rem; color: var(--text-muted);" id="answeredCount">已答 0 / ${AppState.questions.length}</span>
        </div>
        <div class="q-grid" id="examNavGrid"></div>
        <div class="exam-controls">
          <button class="btn-primary" style="width: 100%;" onclick="confirmSubmitExam()">確認交卷</button>
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
        <span class="q-badge">第 ${AppState.currentIndex + 1} / ${AppState.questions.length} 題 · ${q.categoryName}</span>
        <div class="q-actions">
          <button class="btn-icon ${isStarred ? 'active' : ''}" title="${isStarred ? '取消標記' : '標記此題'}" onclick="toggleStarQuestion(${q.id})">
            ${isStarred ? '★ 已標記' : '☆ 標記'}
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

      <div style="display: flex; justify-content: space-between; margin-top: 1.5rem;">
        <button class="btn-secondary" ${AppState.currentIndex === 0 ? 'disabled style="opacity:0.5"' : ''} onclick="jumpToExamQuestion(${AppState.currentIndex - 1})">
          ← 上一題
        </button>
        <button class="btn-primary" ${AppState.currentIndex === AppState.questions.length - 1 ? 'disabled style="opacity:0.5"' : ''} onclick="jumpToExamQuestion(${AppState.currentIndex + 1})">
          下一題 →
        </button>
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
    msg += `\n確定要交卷評分嗎？`;
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

      <h2 style="font-size: 1.5rem; font-weight: 800; color: ${result.isPass ? 'var(--success)' : 'var(--danger)'}">
        ${result.isPass ? '🎉 測驗合格！成績達到及格標準' : '💪 未達 60 分及格標準，再接再厲！'}
      </h2>
      <p style="color: var(--text-muted); margin-top: 0.5rem;">
        本次測驗共 ${result.total} 題，答對 ${result.correctCount} 題，答錯 ${result.total - result.correctCount} 題。
      </p>

      <div class="result-breakdown">
        <div class="breakdown-box">
          <div class="lbl">答對題數</div>
          <div class="val" style="color: var(--success);">${result.correctCount} 題</div>
        </div>
        <div class="breakdown-box">
          <div class="lbl">答錯題數</div>
          <div class="val" style="color: var(--danger);">${result.total - result.correctCount} 題</div>
        </div>
        <div class="breakdown-box">
          <div class="lbl">答對率</div>
          <div class="val">${result.score}%</div>
        </div>
      </div>

      <div style="display: flex; gap: 0.75rem; justify-content: center; margin-bottom: 2rem;">
        <button class="btn-primary" onclick="switchTab('exam', 50)">🔄 再測一次</button>
        <button class="btn-secondary" onclick="switchTab('wrong')">⚠️ 查看錯題本</button>
        <button class="btn-secondary" onclick="switchTab('home')">返回首頁</button>
      </div>
    </div>

    <div style="max-width: 800px; margin: 2.5rem auto 0;">
      <h3 style="font-size: 1.3rem; font-weight: 800; margin-bottom: 1rem; border-left: 4px solid var(--primary); padding-left: 0.75rem;">
        📋 本次測驗試題全詳解與檢討
      </h3>
  `;

  AppState.questions.forEach((q, idx) => {
    const userAns = AppState.userAnswers[q.id];
    const isCorrect = userAns === q.answer;
    const isStarred = AppState.starred.has(q.id);

    html += `
      <div class="question-card" style="border-left: 4px solid ${isCorrect ? 'var(--success)' : 'var(--danger)'}">
        <div class="q-header">
          <span class="q-badge" style="${isCorrect ? 'background: var(--success-bg); color: var(--success)' : 'background: var(--danger-bg); color: var(--danger)'}">
            第 ${idx + 1} 題 · ${isCorrect ? '✅ 答對' : '❌ 答錯'} (${q.categoryName})
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
          <div class="exp-law">📜 <strong>法規依據：</strong>${q.lawSource}</div>
          <div style="margin-top: 0.5rem;">💡 <strong>助教解析：</strong>${q.explanation}</div>
          ${q.trapTip ? `<div class="exp-trap">⚠️ <strong>陷阱提醒：</strong>${q.trapTip}</div>` : ''}
        </div>
      </div>
    `;
  });

  html += `</div>`;
  container.innerHTML = html;
}

function renderWrongBook(container) {
  const wrongIds = Object.keys(AppState.wrongRecords).map(Number);
  const wrongQuestions = QUESTION_DATABASE.filter(q => wrongIds.includes(q.id));

  let html = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 0.75rem;">
      <div>
        <h2 style="font-weight: 800; font-size: 1.4rem;">💡 個人錯題筆記本</h2>
        <p style="color: var(--text-muted); font-size: 0.875rem;">已記錄 ${wrongQuestions.length} 道錯題 · 針對答錯觀念精準加強複習</p>
      </div>
      <div>
        ${wrongQuestions.length > 0 ? `
          <button class="btn-secondary" onclick="clearAllWrongRecords()">清空錯題記錄</button>
        ` : ''}
      </div>
    </div>
  `;

  if (wrongQuestions.length === 0) {
    html += `
      <div class="result-card" style="margin-top: 2rem;">
        <div style="font-size: 3rem; margin-bottom: 1rem;">🎉</div>
        <h3>太棒了！目前沒有任何錯題記錄</h3>
        <p style="color: var(--text-muted); margin: 0.75rem 0 1.5rem;">在模擬考或章節練習時答錯的題目，系統將自動為您歸納於此。</p>
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
          <span class="q-badge" style="background: var(--danger-bg); color: var(--danger)">
            錯題 #${idx + 1} · 累積答錯 ${wrongCount} 次 (${q.categoryName})
          </span>
          <div class="q-actions">
            <button class="btn-icon ${isStarred ? 'active' : ''}" onclick="toggleStarQuestion(${q.id})">
              ${isStarred ? '★ 已收藏' : '☆ 收藏'}
            </button>
            <button class="btn-icon" style="color: var(--danger)" title="從錯題本移除" onclick="removeSingleWrong(${q.id})">
              🗑️ 移除
            </button>
          </div>
        </div>

        <div class="q-title">${q.question}</div>

        <div class="options-list">
          ${q.options.map((opt, optIdx) => `
            <div class="option-item ${optIdx === q.answer ? 'correct' : ''}">
              <span class="opt-prefix">${optLabels[optIdx]}</span>
              <span>${opt}</span>
            </div>
          `).join('')}
        </div>

        <div class="explanation-box">
          <div class="exp-law">📜 <strong>法規依據：</strong>${q.lawSource}</div>
          <div style="margin-top: 0.5rem;">💡 <strong>助教解析：</strong>${q.explanation}</div>
          ${q.trapTip ? `<div class="exp-trap">⚠️ <strong>陷阱提醒：</strong>${q.trapTip}</div>` : ''}
        </div>
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
        <h2 style="font-weight: 800; font-size: 1.4rem;">⭐ 重點收藏題庫</h2>
        <p style="color: var(--text-muted); font-size: 0.875rem;">已收藏 ${starredQuestions.length} 題 · 考前衝刺必背精華題庫</p>
      </div>
    </div>
  `;

  if (starredQuestions.length === 0) {
    html += `
      <div class="result-card" style="margin-top: 2rem;">
        <div style="font-size: 3rem; margin-bottom: 1rem;">⭐</div>
        <h3>目前尚未收藏任何題目</h3>
        <p style="color: var(--text-muted); margin: 0.75rem 0 1.5rem;">在練習題目時點擊右上角的「☆ 收藏」按鈕，即可將重要題目儲存於此。</p>
        <button class="btn-primary" onclick="switchTab('practice')">開始瀏覽題庫 →</button>
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
          <span class="q-badge">收藏題 #${idx + 1} · ${q.categoryName}</span>
          <button class="btn-icon active" onclick="toggleStarQuestion(${q.id})">★ 取消收藏</button>
        </div>

        <div class="q-title">${q.question}</div>

        <div class="options-list">
          ${q.options.map((opt, optIdx) => `
            <div class="option-item ${optIdx === q.answer ? 'correct' : ''}">
              <span class="opt-prefix">${optLabels[optIdx]}</span>
              <span>${opt}</span>
            </div>
          `).join('')}
        </div>

        <div class="explanation-box">
          <div class="exp-law">📜 <strong>法規依據：</strong>${q.lawSource}</div>
          <div style="margin-top: 0.5rem;">💡 <strong>助教解析：</strong>${q.explanation}</div>
          ${q.trapTip ? `<div class="exp-trap">⚠️ <strong>陷阱提醒：</strong>${q.trapTip}</div>` : ''}
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function renderSearch(container) {
  let html = `
    <div>
      <h2 style="font-weight: 800; font-size: 1.4rem; margin-bottom: 0.5rem;">🔍 題庫與法規檢索</h2>
      <p style="color: var(--text-muted); font-size: 0.875rem; margin-bottom: 1.5rem;">
        輸入條文名稱（如：第25條、押金、自住稅率、買賣不破租賃）或關鍵字快速檢索題庫與詳解。
      </p>

      <div class="search-bar-wrap">
        <input type="text" id="searchInput" class="search-input" placeholder="輸入法條關鍵字、題目內容或考點..." oninput="handleSearch(this.value)">
      </div>

      <div id="searchResultsCount" style="margin-bottom: 1rem; font-size: 0.9rem; color: var(--text-muted);">
        輸入關鍵字開始檢索全題庫...
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

function handleSearch(term) {
  AppState.searchTerm = term.trim().toLowerCase();
  const list = document.getElementById("searchResultsList");
  const countEl = document.getElementById("searchResultsCount");
  if (!list || !countEl) return;

  if (!AppState.searchTerm) {
    countEl.textContent = "輸入關鍵字開始檢索全題庫...";
    list.innerHTML = "";
    return;
  }

  const results = QUESTION_DATABASE.filter(q => {
    return (
      q.question.toLowerCase().includes(AppState.searchTerm) ||
      q.lawSource.toLowerCase().includes(AppState.searchTerm) ||
      q.explanation.toLowerCase().includes(AppState.searchTerm) ||
      (q.trapTip && q.trapTip.toLowerCase().includes(AppState.searchTerm)) ||
      q.options.some(opt => opt.toLowerCase().includes(AppState.searchTerm))
    );
  });

  countEl.textContent = `找到 ${results.length} 筆符合「${AppState.searchTerm}」的題目：`;

  if (results.length === 0) {
    list.innerHTML = `<div class="question-card" style="text-align: center; color: var(--text-muted);">查無符合條件之題目，請嘗試其他關鍵字。</div>`;
    return;
  }

  const optLabels = ["(A)", "(B)", "(C)", "(D)"];

  list.innerHTML = results.map(q => {
    const isStarred = AppState.starred.has(q.id);
    return `
      <div class="question-card">
        <div class="q-header">
          <span class="q-badge">${q.categoryName}</span>
          <button class="btn-icon ${isStarred ? 'active' : ''}" onclick="toggleStarQuestion(${q.id})">
            ${isStarred ? '★ 已收藏' : '☆ 收藏'}
          </button>
        </div>

        <div class="q-title">${q.question}</div>

        <div class="options-list">
          ${q.options.map((opt, optIdx) => `
            <div class="option-item ${optIdx === q.answer ? 'correct' : ''}">
              <span class="opt-prefix">${optLabels[optIdx]}</span>
              <span>${opt}</span>
            </div>
          `).join('')}
        </div>

        <div class="explanation-box">
          <div class="exp-law">📜 <strong>法規依據：</strong>${q.lawSource}</div>
          <div style="margin-top: 0.5rem;">💡 <strong>助教解析：</strong>${q.explanation}</div>
          ${q.trapTip ? `<div class="exp-trap">⚠️ <strong>陷阱提醒：</strong>${q.trapTip}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function renderAnalytics(container) {
  const history = AppState.examHistory;
  const totalTests = history.length;
  const passTests = history.filter(h => h.isPass).length;
  const passRate = totalTests > 0 ? Math.round((passTests / totalTests) * 100) : 0;
  const avgScore = totalTests > 0 ? Math.round(history.reduce((sum, h) => sum + h.score, 0) / totalTests) : 0;

  let html = `
    <div>
      <h2 style="font-weight: 800; font-size: 1.4rem; margin-bottom: 0.5rem;">📊 學習戰報與歷程分析</h2>
      <p style="color: var(--text-muted); font-size: 0.875rem; margin-bottom: 1.5rem;">追蹤歷次模擬考成績與單元弱點分佈</p>

      <div class="result-breakdown" style="grid-template-columns: repeat(4, 1fr);">
        <div class="breakdown-box">
          <div class="lbl">累計測驗次數</div>
          <div class="val">${totalTests} 次</div>
        </div>
        <div class="breakdown-box">
          <div class="lbl">合格通過率</div>
          <div class="val" style="color: var(--success);">${passRate}%</div>
        </div>
        <div class="breakdown-box">
          <div class="lbl">平均得分</div>
          <div class="val" style="color: var(--primary);">${avgScore} 分</div>
        </div>
        <div class="breakdown-box">
          <div class="lbl">待複習錯題數</div>
          <div class="val" style="color: var(--warning);">${Object.keys(AppState.wrongRecords).length} 題</div>
        </div>
      </div>

      <h3 style="font-size: 1.2rem; font-weight: 800; margin: 2rem 0 1rem;">📚 歷次模擬考成績紀錄</h3>
  `;

  if (history.length === 0) {
    html += `
      <div class="question-card" style="text-align: center; color: var(--text-muted);">
        尚無測驗紀錄，完成模擬考後將自動在此記錄成績趨勢！
      </div>
    `;
  } else {
    html += `
      <div class="question-card" style="padding: 0; overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem; min-width: 500px;">
          <thead>
            <tr style="background: var(--bg-main); text-align: left; border-bottom: 1px solid var(--border-color);">
              <th style="padding: 0.75rem 1rem;">測驗時間</th>
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
                <td style="padding: 0.75rem 1rem;">${h.totalQuestions} 題</td>
                <td style="padding: 0.75rem 1rem;">${h.correctCount} / ${h.totalQuestions - h.correctCount}</td>
                <td style="padding: 0.75rem 1rem; font-weight: 800; color: ${h.isPass ? 'var(--success)' : 'var(--danger)'}">${h.score} 分</td>
                <td style="padding: 0.75rem 1rem;">
                  <span style="padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 700; ${h.isPass ? 'background: var(--success-bg); color: var(--success)' : 'background: var(--danger-bg); color: var(--danger)'}">
                    ${h.isPass ? '合格' : '未達標'}
                  </span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <div style="margin-top: 1rem; text-align: right;">
        <button class="tool-btn" onclick="clearExamHistory()">清空歷史成績</button>
      </div>
    `;
  }

  html += `</div>`;
  container.innerHTML = html;
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
