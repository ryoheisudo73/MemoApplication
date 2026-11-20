// =====================================================
// LocalTraveler - app.js
// LocalStorage（キー: travelTrips）をデータベースとして使う
//
// 保存形式:
// {
//   "currentTripId": "1700000000000",
//   "trips": [ { id, destination, themeStyle, destinationImagePath,
//                activities, restaurants, shops, prepTasks }, ... ]
// }
// =====================================================

const STORAGE_KEY = "travelTrips";
const OLD_STORAGE_KEY = "travelData"; // 旧バージョン（旅行1件のみ）のキー
const ALERT_DAYS = 3; // 本日〜3日以内をアラート対象とする

// 1件の旅行の初期データ
function createTrip() {
  return {
    id: String(Date.now()),
    destination: "",
    startDate: "", // 出発日 "YYYY-MM-DD"
    endDate: "",   // 帰着日 "YYYY-MM-DD"
    themeStyle: "",
    destinationImagePath: "",
    activities: [],
    restaurants: [],
    shops: [],
    prepTasks: [],
  };
}

// store      : LocalStorage に「登録済み」のデータ
// travelData : 画面で編集中のデータ（store のコピー）。「登録」ボタンで store に反映する
let store = loadStore();
let travelData = loadCurrentTrip();
let isDirty = false; // 未登録の変更があるか

// ---------- LocalStorage 読み書き ----------
function loadStore() {
  try {
    const json = localStorage.getItem(STORAGE_KEY);
    if (json) {
      const data = JSON.parse(json);
      // 足りない項目はデフォルト値で補う
      data.trips = data.trips.map((t) => ({ ...createTrip(), ...t }));
      return data;
    }

    // 旧形式（travelData）があれば、1件目の旅行として引き継ぐ
    const oldJson = localStorage.getItem(OLD_STORAGE_KEY);
    if (oldJson) {
      const trip = { ...createTrip(), ...JSON.parse(oldJson) };
      const migrated = { currentTripId: trip.id, trips: [trip] };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      localStorage.removeItem(OLD_STORAGE_KEY);
      return migrated;
    }
  } catch (e) {
    console.error("データの読み込みに失敗しました", e);
  }
  return { currentTripId: null, trips: [] };
}

// 登録済みの旅行を編集用にコピーして取り出す（なければ新しい旅行）
function loadCurrentTrip() {
  const trip = store.trips.find((t) => t.id === store.currentTripId) || store.trips[0];
  return trip ? structuredClone(trip) : createTrip();
}

// store を LocalStorage に書き込む
function persistStore() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    return true;
  } catch (e) {
    // LocalStorage の容量（ブラウザごとに約5MB）を超えた場合
    console.error("保存に失敗しました", e);
    alert("保存容量の上限に達しました。不要な旅行や画像を削除してください。");
    return false;
  }
}

// 画面で何か変更したら呼ぶ（まだ LocalStorage には保存しない）
function markDirty() {
  isDirty = true;
  renderRegisterStatus();
}

// ---------- 登録ボタン ----------
const registerBtn = document.getElementById("registerBtn");
const registerStatus = document.getElementById("registerStatus");

function isRegistered(trip) {
  return store.trips.some((t) => t.id === trip.id);
}

function renderRegisterStatus() {
  // 未登録の旅行は「登録」、登録済みの旅行は「変更」
  registerBtn.textContent = isRegistered(travelData) ? "変更" : "登録";
  registerBtn.disabled = !isDirty;
  if (isDirty) {
    registerStatus.textContent = isRegistered(travelData)
      ? "保存されていない変更があります"
      : "まだ登録されていません";
    registerStatus.className = "register-status dirty";
  } else {
    registerStatus.textContent = isRegistered(travelData) ? "登録済み" : "";
    registerStatus.className = "register-status";
  }
}

registerBtn.addEventListener("click", () => {
  const backup = structuredClone(store);
  const index = store.trips.findIndex((t) => t.id === travelData.id);
  const copy = structuredClone(travelData);
  if (index === -1) store.trips.push(copy);
  else store.trips[index] = copy;
  store.currentTripId = travelData.id;

  if (!persistStore()) {
    store = backup; // 保存失敗時は登録前の状態に戻す（編集内容は画面に残る）
    return;
  }
  isDirty = false;
  renderTripSelect();
  renderRegisterStatus();
});

// 未登録のままページを閉じようとしたら警告
window.addEventListener("beforeunload", (e) => {
  if (isDirty) e.preventDefault();
});

// 未登録の変更を捨ててよいか確認
function confirmDiscard() {
  return !isDirty || confirm("未登録の変更があります。破棄してよろしいですか？");
}

// ---------- 旅行の切り替え ----------
const tripSelect = document.getElementById("tripSelect");
const newTripBtn = document.getElementById("newTripBtn");
const deleteTripBtn = document.getElementById("deleteTripBtn");

function tripLabel(trip) {
  return trip.destination.trim() || "（行き先未設定）";
}

// ドロップダウン用の表示名（例：台北・九份　2026/12/20〜12/25）
function optionLabel(trip) {
  const range = formatRange(trip);
  let label = tripLabel(trip) + (range ? "　" + range : "");
  if (!isRegistered(trip)) label += "（未登録）";
  return label;
}

function renderTripSelect() {
  tripSelect.innerHTML = "";
  const trips = [...store.trips];
  // 編集中の旅行がまだ未登録なら、一覧の末尾に仮表示する
  if (!isRegistered(travelData)) trips.push(travelData);

  trips.forEach((trip) => {
    const option = document.createElement("option");
    option.value = trip.id;
    option.textContent = optionLabel(trip);
    tripSelect.appendChild(option);
  });
  tripSelect.value = travelData.id;
  renderTimeline(); // 登録済み一覧が変わるタイミングで年表も更新
}

// 登録済みの旅行を開く
function openTrip(id) {
  store.currentTripId = id;
  persistStore(); // 最後に開いた旅行だけ記録
  travelData = loadCurrentTrip();
  isDirty = false;
  renderAll();
}

// 新しい（未登録の）旅行を開く
function openNewTrip() {
  travelData = createTrip();
  isDirty = false;
  renderAll();
}

tripSelect.addEventListener("change", () => {
  if (!confirmDiscard()) {
    tripSelect.value = travelData.id; // 選択を元に戻す
    return;
  }
  const id = tripSelect.value;
  if (isRegistered({ id })) openTrip(id);
});

newTripBtn.addEventListener("click", () => {
  if (!confirmDiscard()) return;
  openNewTrip();
  destinationInput.focus();
});

deleteTripBtn.addEventListener("click", () => {
  if (!confirm(`「${tripLabel(travelData)}」を削除しますか？\nこの操作は元に戻せません。`)) return;

  store.trips = store.trips.filter((t) => t.id !== travelData.id);
  persistStore();
  if (store.trips.length > 0) openTrip(store.trips[0].id);
  else openNewTrip();
});

// ---------- 日付ユーティリティ ----------
// 今日の 0:00:00
function getToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

// "YYYY-MM-DD" をローカル時刻の 0:00 として Date に変換
// （new Date("2026-12-10") だと UTC 扱いになり日本時間でずれるため）
function parseDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// 今日から期日までの日数差
function daysUntil(dateStr) {
  const diffMs = parseDate(dateStr) - getToday();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

// "2026-12-20" → "2026/12/20"
function formatDate(dateStr) {
  return dateStr.replaceAll("-", "/");
}

// 旅行の日程を文字列に（同じ年なら帰着日の年を省略）
// 例："2026/12/20〜12/25"、"2026/12/30〜2027/01/03"、"2026/12/20〜"
function formatRange(trip) {
  const { startDate, endDate } = trip;
  if (!startDate && !endDate) return "";
  if (!endDate) return formatDate(startDate) + "〜";
  if (!startDate) return "〜" + formatDate(endDate);
  const sameYear = startDate.slice(0, 4) === endDate.slice(0, 4);
  return formatDate(startDate) + "〜" + (sameYear ? formatDate(endDate.slice(5)) : formatDate(endDate));
}

// 旅行の状態（出発まであと○日 / 旅行中 / 旅行済み）
function tripStatus(trip) {
  if (!trip.startDate) return null;
  const toStart = daysUntil(trip.startDate);
  const toEnd = daysUntil(trip.endDate || trip.startDate);
  if (toStart > 0) return { type: "upcoming", text: `あと${toStart}日` };
  if (toEnd >= 0) return { type: "ongoing", text: "旅行中" };
  return { type: "done", text: "旅行済み" };
}

// ---------- ① 背景テーマ ----------
const themeSelect = document.getElementById("themeSelect");

function applyTheme(themeClass) {
  document.body.className = themeClass || "";
}

themeSelect.addEventListener("change", () => {
  travelData.themeStyle = themeSelect.value;
  applyTheme(travelData.themeStyle);
  markDirty();
});

// ---------- 行き先 ----------
const destinationInput = document.getElementById("destination");

destinationInput.addEventListener("input", () => {
  travelData.destination = destinationInput.value;
  markDirty();
  // 未登録の旅行は、切り替えドロップダウンの仮表示名も更新
  // （登録済みの旅行名は「登録」ボタンを押したときに更新される）
  if (!isRegistered(travelData)) {
    tripSelect.selectedOptions[0].textContent = optionLabel(travelData);
  }
  renderTripSummary();
});

// ---------- 旅行の日程 ----------
const startDateInput = document.getElementById("startDate");
const endDateInput = document.getElementById("endDate");
const dateWarning = document.getElementById("dateWarning");
const tripSummary = document.getElementById("tripSummary");

function renderDates() {
  startDateInput.value = travelData.startDate;
  endDateInput.value = travelData.endDate;
  endDateInput.min = travelData.startDate; // 出発日より前は選べないように
  dateWarning.hidden = !(
    travelData.startDate && travelData.endDate && travelData.endDate < travelData.startDate
  );
}

// ヘッダーに「行き先・日程・あと○日」を表示
function renderTripSummary() {
  tripSummary.innerHTML = "";
  const range = formatRange(travelData);
  if (!travelData.destination.trim() && !range) {
    tripSummary.hidden = true;
    return;
  }

  const name = document.createElement("span");
  name.className = "summary-name";
  name.textContent = tripLabel(travelData);
  tripSummary.appendChild(name);

  if (range) {
    const dates = document.createElement("span");
    dates.className = "summary-dates";
    dates.textContent = range;
    tripSummary.appendChild(dates);
  }

  const status = tripStatus(travelData);
  if (status) {
    const badge = document.createElement("span");
    badge.className = "badge badge-" + status.type;
    badge.textContent = status.text;
    tripSummary.appendChild(badge);
  }
  tripSummary.hidden = false;
}

function onDateChange() {
  travelData.startDate = startDateInput.value;
  travelData.endDate = endDateInput.value;
  markDirty();
  renderDates();
  renderTripSummary();
  if (!isRegistered(travelData)) {
    tripSelect.selectedOptions[0].textContent = optionLabel(travelData);
  }
}
startDateInput.addEventListener("change", onDateChange);
endDateInput.addEventListener("change", onDateChange);

// ---------- 旅行の年表（登録済みの旅行のみ） ----------
const timelineList = document.getElementById("timelineList");
const timelineDetails = document.getElementById("timelineDetails");
const TIMELINE_OPEN_KEY = "timelineOpen"; // 年表の開閉状態（旅行データとは別に保存）

// 前回の開閉状態を復元
try {
  if (localStorage.getItem(TIMELINE_OPEN_KEY) === "false") timelineDetails.open = false;
} catch (e) { /* 保存できない環境では常に開いた状態 */ }

timelineDetails.addEventListener("toggle", () => {
  try {
    localStorage.setItem(TIMELINE_OPEN_KEY, String(timelineDetails.open));
  } catch (e) { /* 無視 */ }
});

function renderTimeline() {
  timelineList.innerHTML = "";

  if (store.trips.length === 0) {
    const p = document.createElement("p");
    p.className = "empty";
    p.textContent = "登録した旅行がここに並びます";
    timelineList.appendChild(p);
    return;
  }

  // 出発日順（日程未定は最後）
  const sorted = [...store.trips].sort((a, b) => {
    if (!a.startDate) return 1;
    if (!b.startDate) return -1;
    return a.startDate.localeCompare(b.startDate);
  });

  let currentGroup = null;
  let ul = null;

  sorted.forEach((trip) => {
    // 年ごとに見出しを入れる
    const group = trip.startDate ? trip.startDate.slice(0, 4) + "年" : "日程未定";
    if (group !== currentGroup) {
      currentGroup = group;
      const h = document.createElement("h3");
      h.className = "timeline-year";
      h.textContent = group;
      ul = document.createElement("ul");
      ul.className = "timeline-items";
      timelineList.append(h, ul);
    }

    const status = tripStatus(trip);
    const li = document.createElement("li");
    li.className = "timeline-item" + (status ? " is-" + status.type : "");
    if (trip.id === travelData.id) li.classList.add("is-current");

    const btn = document.createElement("button");
    btn.type = "button";
    btn.title = "この旅行を開く";

    const dates = document.createElement("span");
    dates.className = "timeline-dates";
    dates.textContent = trip.startDate ? formatRange(trip).slice(5) : "―"; // 年は見出しにあるので省略

    const name = document.createElement("span");
    name.className = "timeline-name";
    name.textContent = tripLabel(trip);

    btn.append(dates, name);
    if (status) {
      const badge = document.createElement("span");
      badge.className = "badge badge-" + status.type;
      badge.textContent = status.text;
      btn.appendChild(badge);
    }

    btn.addEventListener("click", () => {
      if (trip.id === travelData.id || !confirmDiscard()) return;
      openTrip(trip.id);
    });

    li.appendChild(btn);
    ul.appendChild(li);
  });
}

// ---------- ② 行き先画像 ----------
const imageFileInput = document.getElementById("imageFile");
const destinationImage = document.getElementById("destinationImage");
const imageMessage = document.getElementById("imageMessage");
const imagePathInput = document.getElementById("imagePath");
const clearImageBtn = document.getElementById("clearImageBtn");
const pickImageBtn = document.getElementById("pickImageBtn");
const toggleUrlBtn = document.getElementById("toggleUrlBtn");

// URL 入力欄の表示・非表示
function showUrlInput(show) {
  imagePathInput.hidden = !show;
  toggleUrlBtn.setAttribute("aria-expanded", String(show));
  toggleUrlBtn.classList.toggle("is-open", show);
}

pickImageBtn.addEventListener("click", () => imageFileInput.click());

toggleUrlBtn.addEventListener("click", () => {
  const show = imagePathInput.hidden;
  showUrlInput(show);
  if (show) imagePathInput.focus();
});

const IMAGE_MAX_SIZE = 800;   // 長辺の最大ピクセル数
const IMAGE_QUALITY = 0.8;    // JPEG 画質（0〜1）

function renderImage() {
  const path = travelData.destinationImagePath;
  const isUrl = path !== "" && !path.startsWith("data:"); // data:〜 はファイルから取り込んだ画像
  // URL で指定している画像のときだけ URL 欄を開いて表示する
  imagePathInput.value = isUrl ? path : "";
  showUrlInput(isUrl);
  pickImageBtn.textContent = path ? "画像を変更" : "ファイルを選択";
  clearImageBtn.hidden = !path;

  if (!path) {
    // 前の旅行の画像が残らないよう、読み込み先ごと消す
    destinationImage.removeAttribute("src");
    destinationImage.hidden = true;
    imageMessage.textContent = "画像が未設定です";
    imageMessage.hidden = false;
    return;
  }
  destinationImage.src = path;
}

destinationImage.addEventListener("load", () => {
  destinationImage.hidden = false;
  imageMessage.hidden = true;
});

destinationImage.addEventListener("error", () => {
  destinationImage.hidden = true;
  imageMessage.textContent = "画像を読み込めませんでした。URL またはファイルを確認してください。";
  imageMessage.hidden = false;
});

// 選択した画像を縮小し、data URL（画像そのものを文字列化したもの）に変換する
// ※ ブラウザではファイルのフルパスを取得できないため、画像データ自体を保存する
function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, IMAGE_MAX_SIZE / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", IMAGE_QUALITY));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("画像を読み込めませんでした"));
    };
    img.src = url;
  });
}

function setImagePath(path) {
  travelData.destinationImagePath = path;
  markDirty();
  renderImage();
}

imageFileInput.addEventListener("change", async () => {
  const file = imageFileInput.files[0];
  if (!file) return;
  try {
    setImagePath(await resizeImage(file));
  } catch (e) {
    alert(e.message);
  }
  imageFileInput.value = "";
});

// URL / パスの直接入力（入力確定時に反映）
imagePathInput.addEventListener("change", () => {
  setImagePath(imagePathInput.value.trim());
});

clearImageBtn.addEventListener("click", () => {
  setImagePath("");
});

// ---------- 目的別リスト（やりたいこと / レストラン / お店） ----------
const LIST_KEYS = ["activities", "restaurants", "shops"];

function renderList(key) {
  const ul = document.getElementById("list-" + key);
  ul.innerHTML = "";

  if (travelData[key].length === 0) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "まだ登録がありません";
    ul.appendChild(li);
    return;
  }

  travelData[key].forEach((item, index) => {
    const li = document.createElement("li");

    const span = document.createElement("span");
    span.className = "text";
    span.textContent = item; // textContent を使い HTML として解釈させない

    const delBtn = document.createElement("button");
    delBtn.className = "delete-btn";
    delBtn.textContent = "削除";
    delBtn.addEventListener("click", () => {
      travelData[key].splice(index, 1);
      markDirty();
      renderList(key);
    });

    li.append(span, delBtn);
    ul.appendChild(li);
  });
}

document.querySelectorAll(".add-form[data-list]").forEach((form) => {
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const key = form.dataset.list;
    const input = form.querySelector("input");
    const value = input.value.trim();
    if (!value) return;

    travelData[key].push(value);
    markDirty();
    renderList(key);
    input.value = "";
    input.focus();
  });
});

// ---------- 事前準備タスク ----------
const taskForm = document.getElementById("taskForm");
const taskNameInput = document.getElementById("taskName");
const taskDueInput = document.getElementById("taskDueDate");
const taskList = document.getElementById("taskList");

function renderTasks() {
  taskList.innerHTML = "";

  if (travelData.prepTasks.length === 0) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "まだタスクがありません";
    taskList.appendChild(li);
    return;
  }

  // 期日の近い順に表示
  const sorted = [...travelData.prepTasks].sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  sorted.forEach((task) => {
    const li = document.createElement("li");
    const diff = daysUntil(task.dueDate);
    if (task.isCompleted) li.classList.add("completed");
    if (diff < 0) li.classList.add("overdue");
    else if (diff <= ALERT_DAYS) li.classList.add("near-due");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = task.isCompleted;
    checkbox.addEventListener("change", () => {
      task.isCompleted = checkbox.checked;
      markDirty();
      renderTasks();
      renderAlert();
    });

    const span = document.createElement("span");
    span.className = "text";
    span.textContent = task.taskName;

    const due = document.createElement("span");
    due.className = "due";
    due.textContent = "期日: " + task.dueDate;

    const delBtn = document.createElement("button");
    delBtn.className = "delete-btn";
    delBtn.textContent = "削除";
    delBtn.addEventListener("click", () => {
      travelData.prepTasks = travelData.prepTasks.filter((t) => t.id !== task.id);
      markDirty();
      renderTasks();
      renderAlert();
    });

    li.append(checkbox, span, due, delBtn);
    taskList.appendChild(li);
  });
}

taskForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const taskName = taskNameInput.value.trim();
  const dueDate = taskDueInput.value;
  if (!taskName || !dueDate) return;

  travelData.prepTasks.push({
    id: String(Date.now()),
    taskName,
    dueDate,
    isCompleted: false,
  });
  markDirty();
  renderTasks();
  renderAlert();
  taskForm.reset();
  taskNameInput.focus();
});

// ---------- ③ 期日接近アラート ----------
const alertArea = document.getElementById("alertArea");

function renderAlert() {
  // 未完了 かつ 期日まで 0〜3日 のタスクを抽出
  const nearTasks = travelData.prepTasks.filter((task) => {
    if (task.isCompleted) return false;
    const diff = daysUntil(task.dueDate);
    return diff >= 0 && diff <= ALERT_DAYS;
  });

  alertArea.innerHTML = "";
  if (nearTasks.length === 0) {
    alertArea.hidden = true;
    return;
  }

  const title = document.createElement("strong");
  title.textContent = `⚠ 期日が近い未完了タスクが ${nearTasks.length} 件あります`;
  const ul = document.createElement("ul");

  nearTasks.forEach((task) => {
    const diff = daysUntil(task.dueDate);
    const li = document.createElement("li");
    const label = diff === 0 ? "今日まで" : `あと${diff}日`;
    li.textContent = `${task.taskName}（${task.dueDate}・${label}）`;
    ul.appendChild(li);
  });

  alertArea.append(title, ul);
  alertArea.hidden = false;
}

// ---------- 現在の旅行を画面に展開（起動時・切り替え時） ----------
function renderAll() {
  renderTripSelect();
  destinationInput.value = travelData.destination;
  renderDates();
  renderTripSummary();
  imageFileInput.value = ""; // 前の旅行で選んだファイル名をクリア
  taskForm.reset();
  themeSelect.value = travelData.themeStyle;
  applyTheme(travelData.themeStyle);
  renderImage();
  LIST_KEYS.forEach(renderList);
  renderTasks();
  renderAlert();
  renderRegisterStatus();
}

renderAll();
