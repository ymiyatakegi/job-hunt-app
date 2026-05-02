const WORDS_STORAGE_KEY = "fe-basic-words-v1";
const STATS_STORAGE_KEY = "fe-basic-stats-v1";

const FIELD_TREE = {
  "テクノロジ系": [
    "基礎理論",
    "アルゴリズムとプログラミング",
    "コンピュータ構成要素",
    "システム構成要素",
    "ソフトウェア",
    "ハードウェア",
    "ユーザーインタフェース",
    "情報メディア",
    "データベース",
    "ネットワーク",
    "セキュリティ",
    "システム開発技術",
    "ソフトウェア開発管理技術"
  ],
  "マネジメント系": [
    "プロジェクトマネジメント",
    "サービスマネジメント",
    "システム監査"
  ],
  "ストラテジ系": [
    "システム戦略",
    "システム企画",
    "経営戦略マネジメント",
    "技術戦略マネジメント",
    "ビジネスインダストリ",
    "企業活動",
    "法務"
  ]
};

const FIELD_OPTIONS = Object.entries(FIELD_TREE).flatMap(([group, fields]) =>
  fields.map((field) => ({ group, field, label: `${group} > ${field}` }))
);

function createWord() {
  return {
    id: `word-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    categoryGroup: "テクノロジ系",
    categoryField: "基礎理論",
    word: "",
    note: "",
    noteImageData: "",
    noteImageName: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function normalizeWord(item) {
  const fallback = createWord();
  const hasGroup = item && FIELD_TREE[item.categoryGroup];
  const group = hasGroup ? item.categoryGroup : fallback.categoryGroup;
  const fields = FIELD_TREE[group];
  const field = item && fields.includes(item.categoryField) ? item.categoryField : fields[0];
  return {
    id: item && item.id ? String(item.id) : fallback.id,
    categoryGroup: group,
    categoryField: field,
    word: item && item.word ? String(item.word) : "",
    note: item && item.note ? String(item.note) : "",
    noteImageData: item && item.noteImageData ? String(item.noteImageData) : "",
    noteImageName: item && item.noteImageName ? String(item.noteImageName) : "",
    createdAt: item && item.createdAt ? String(item.createdAt) : fallback.createdAt,
    updatedAt: item && item.updatedAt ? String(item.updatedAt) : fallback.updatedAt
  };
}

function loadWords() {
  try {
    const parsed = JSON.parse(localStorage.getItem(WORDS_STORAGE_KEY) || "[]");
    if (Array.isArray(parsed) && parsed.length) {
      return parsed.map(normalizeWord);
    }
  } catch (error) {
  }
  return [createWord()];
}

function saveWords(words) {
  localStorage.setItem(WORDS_STORAGE_KEY, JSON.stringify(words.map(normalizeWord)));
}

function emptyStats() {
  return {
    attempts: 0,
    correct: 0,
    lastAnsweredAt: "",
    lastResult: "",
    history: []
  };
}

function normalizeStatsMap(raw) {
  const result = {};
  if (!raw || typeof raw !== "object") {
    return result;
  }
  Object.entries(raw).forEach(([key, value]) => {
    result[key] = {
      attempts: Number(value && value.attempts) || 0,
      correct: Number(value && value.correct) || 0,
      lastAnsweredAt: value && value.lastAnsweredAt ? String(value.lastAnsweredAt) : "",
      lastResult: value && value.lastResult ? String(value.lastResult) : "",
      history: Array.isArray(value && value.history)
        ? value.history
            .filter((item) => item && item.at && (item.result === "correct" || item.result === "wrong"))
            .map((item) => ({ at: String(item.at), result: item.result }))
        : []
    };
  });
  return result;
}

function loadStats() {
  try {
    return normalizeStatsMap(JSON.parse(localStorage.getItem(STATS_STORAGE_KEY) || "{}"));
  } catch (error) {
    return {};
  }
}

function saveStats(stats) {
  localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(normalizeStatsMap(stats)));
}

function ensureStats(statsMap, wordId) {
  if (!statsMap[wordId]) {
    statsMap[wordId] = emptyStats();
  }
  return statsMap[wordId];
}

function answerWord(statsMap, wordId, isCorrect, at = new Date()) {
  const stat = ensureStats(statsMap, wordId);
  stat.attempts += 1;
  if (isCorrect) {
    stat.correct += 1;
  }
  stat.lastAnsweredAt = at.toISOString();
  stat.lastResult = isCorrect ? "correct" : "wrong";
  stat.history.push({ at: at.toISOString(), result: isCorrect ? "correct" : "wrong" });
  return stat;
}

function calcAccuracy(stat) {
  if (!stat || !stat.attempts) {
    return 0;
  }
  return stat.correct / stat.attempts;
}

function getFieldLabel(word) {
  return `${word.categoryGroup} > ${word.categoryField}`;
}

function isMastered(stat) {
  return !!stat && stat.attempts >= 3 && calcAccuracy(stat) >= 0.8;
}

function formatDateTime(value) {
  if (!value) {
    return "未回答";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "未回答";
  }
  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function shuffle(list) {
  const cloned = [...list];
  for (let i = cloned.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [cloned[i], cloned[j]] = [cloned[j], cloned[i]];
  }
  return cloned;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function buildMasteredStatsAt(stat, cutoff) {
  if (!stat) {
    return emptyStats();
  }
  const limitedHistory = stat.history.filter((item) => {
    const at = new Date(item.at);
    return !Number.isNaN(at.getTime()) && at.getTime() <= cutoff.getTime();
  });
  const attempts = limitedHistory.length;
  const correct = limitedHistory.filter((item) => item.result === "correct").length;
  return {
    attempts,
    correct,
    lastAnsweredAt: limitedHistory.length ? limitedHistory[limitedHistory.length - 1].at : "",
    lastResult: limitedHistory.length ? limitedHistory[limitedHistory.length - 1].result : "",
    history: limitedHistory
  };
}
