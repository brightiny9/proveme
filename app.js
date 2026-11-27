"use strict";

const ROUND = 5;          // questions per run
const PASS = 4;           // correct answers needed for the share card
const SECONDS = 60;       // per question
const FEEDBACK_MS = 900;  // how long the right/wrong colours stay before the next question
const SHARE_URL = location.origin + location.pathname + "?ref=share";

const $ = (id) => document.getElementById(id);
let pool = [];
let picked = [];
let index = 0;
let correct = 0;
let deadline = 0;
let tick = null;
let cardBlob = null;

// Custom events go to GoatCounter when its script is enabled in index.html; otherwise nothing is sent.
function track(name) {
  if (window.goatcounter && window.goatcounter.count) {
    window.goatcounter.count({ path: name, title: name, event: true });
  }
}

function show(id) {
  for (const s of document.querySelectorAll(".screen")) s.hidden = s.id !== id;
  window.scrollTo(0, 0);
}

function shuffle(a) {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

function start() {
  track("start");
  picked = shuffle(pool).slice(0, ROUND);
  index = 0;
  correct = 0;
  show("quiz");
  ask();
}

function ask() {
  const q = picked[index];
  $("progress").textContent = `${index + 1} / ${ROUND}`;
  $("q-text").textContent = q.question;
  $("q-passage").hidden = !q.passage;
  $("q-passage").textContent = q.passage || "";
  $("q-source").textContent = `출처: 한국산업인력공단, ${q.year}년 제${q.round}회 세무사 1차 ${q.subject} ${q.number}번`;
  const list = $("choices");
  list.innerHTML = "";
  q.choices.forEach((text, i) => {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.innerHTML = `<span class="n">${"①②③④⑤"[i]}</span><span></span>`;
    b.lastChild.textContent = text;
    b.addEventListener("click", () => answer(i + 1));
    li.appendChild(b);
    list.appendChild(li);
  });
  deadline = Date.now() + SECONDS * 1000;
  clearInterval(tick);
  tick = setInterval(update, 100);
  update();
}

function update() {
  const left = Math.max(0, deadline - Date.now());
  const s = Math.ceil(left / 1000);
  $("seconds").textContent = s;
  $("seconds").classList.toggle("low", s <= 10);
  document.querySelector(".timer").classList.toggle("low", s <= 10);
  $("timer-bar").style.transform = `scaleX(${left / (SECONDS * 1000)})`;
  if (left === 0) answer(0); // timeout counts as wrong
}

function answer(choice) {
  clearInterval(tick);
  const q = picked[index];
  const buttons = $("choices").querySelectorAll("button");
  buttons.forEach((b, i) => {
    b.disabled = true;
    if (i + 1 === q.answer) b.classList.add("correct");
    else if (i + 1 === choice) b.classList.add("wrong");
  });
  if (choice === q.answer) correct++;
  setTimeout(() => {
    index++;
    if (index < ROUND) ask();
    else finish();
  }, FEEDBACK_MS);
}

function finish() {
  const passed = correct >= PASS;
  $("score").textContent = `${correct} / ${ROUND}`;
  $("verdict").textContent = passed
    ? "통과! 60초 챌린지를 넘었어요."
    : `아쉬워요. ${PASS}문항 이상 맞히면 통과예요. 이 결과는 어디에도 남지 않아요.`;
  $("pass-box").hidden = !passed;
  $("share-btn").hidden = !navigator.share;
  $("copy-msg").hidden = true;
  show("result");
  if (passed) {
    track("pass");
    drawCard(correct);
  }
}

function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
}

function drawCard(score) {
  const W = 1080, H = 1080;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");
  const font = getComputedStyle(document.body).fontFamily;
  const ink = "#1d1b18", paper = "#f4efe6", accent = "#e2471b", muted = "#6b655c";

  g.fillStyle = paper;
  g.fillRect(0, 0, W, H);
  g.strokeStyle = ink;
  g.lineWidth = 6;
  g.strokeRect(48, 48, W - 96, H - 96);

  g.fillStyle = accent;
  g.beginPath();
  g.arc(120, 140, 16, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = ink;
  g.textBaseline = "middle";
  g.font = `800 52px ${font}`;
  g.fillText("ProveMe", 152, 142);

  g.textBaseline = "alphabetic";
  g.font = `800 300px ${font}`;
  g.fillText(`${score}/${ROUND}`, 96, 540);

  g.fillStyle = accent;
  g.font = `800 64px ${font}`;
  g.fillText("60초 챌린지 통과", 104, 680);

  g.fillStyle = ink;
  g.font = `600 46px ${font}`;
  g.fillText("세무사 1차 기출 5문항 × 60초", 104, 770);
  g.fillText(today(), 104, 836);

  g.fillStyle = muted;
  g.font = `500 30px ${font}`;
  g.fillText("brightiny9.github.io/proveme", 104, 950);
  g.fillText("재미용 챌린지 · 문제 출처: 한국산업인력공단(공공누리 제1유형)", 104, 994);

  c.toBlob((blob) => {
    cardBlob = blob;
    const url = URL.createObjectURL(blob);
    $("card-img").src = url;
    $("download-btn").href = url;
  }, "image/png");
}

async function share() {
  track("share");
  const file = cardBlob && new File([cardBlob], "proveme.png", { type: "image/png" });
  const data = { title: "ProveMe", text: "AI 없이, 세무사 1차 기출 5문항을 60초씩. 너도 풀 수 있어?", url: SHARE_URL };
  try {
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ ...data, files: [file] });
    } else {
      await navigator.share(data);
    }
  } catch (e) {
    // The user closed the share sheet or the browser refused; the save/copy buttons stay available.
  }
}

async function copyLink() {
  track("share");
  try {
    await navigator.clipboard.writeText(SHARE_URL);
  } catch (e) {
    prompt("이 링크를 복사하세요", SHARE_URL);
    return;
  }
  $("copy-msg").hidden = false;
}

$("start-btn").addEventListener("click", start);
$("retry-btn").addEventListener("click", start);
$("share-btn").addEventListener("click", share);
$("copy-btn").addEventListener("click", copyLink);
$("download-btn").addEventListener("click", () => track("share"));

if (new URLSearchParams(location.search).get("ref") === "share") {
  // GoatCounter loads async; wait for it before counting the shared visit.
  window.addEventListener("load", () => setTimeout(() => track("ref-share"), 1000));
}

fetch("questions.json")
  .then((r) => r.json())
  .then((qs) => {
    pool = qs;
    $("start-btn").disabled = false;
    $("start-btn").textContent = "도전하기";
  })
  .catch(() => {
    $("start-btn").textContent = "문제를 불러오지 못했어요. 새로고침해 주세요.";
  });
