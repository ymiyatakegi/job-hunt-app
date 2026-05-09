const STORAGE_KEY = "company-info-records-v1";

const companyList = document.querySelector("#companyList");
const companyCount = document.querySelector("#companyCount");
const companyForm = document.querySelector("#companyForm");
const editorTitle = document.querySelector("#editorTitle");
const addCompanyButton = document.querySelector("#addCompanyButton");
const deleteCompanyButton = document.querySelector("#deleteCompanyButton");
const exportButton = document.querySelector("#exportButton");
const companyButtonTemplate = document.querySelector("#companyButtonTemplate");
const fieldTemplate = document.querySelector("#fieldTemplate");
const shortFieldTemplate = document.querySelector("#shortFieldTemplate");

const fields = [
  { key: "name", label: "企業名", type: "short" },
  { key: "industry", label: "業界", type: "short" },
  { key: "business", label: "主な事業" },
  { key: "products", label: "主力製品・サービス" },
  { key: "customers", label: "顧客" },
  { key: "strengths", label: "強み" },
  { key: "competitors", label: "競合他社" },
  { key: "difference", label: "競合との違い" },
  { key: "focusAreas", label: "最近力を入れている分野" },
  { key: "researchConnection", label: "自分の研究・経験とつながる点", wide: true },
  { key: "jobType", label: "応募職種", type: "short" },
  { key: "afterJoining", label: "入社後やりたいこと" },
  { key: "idealCandidate", label: "求める人物像" },
  { key: "salary", label: "平均年収", type: "short" },
  { key: "startingSalary", label: "初任給", type: "short" },
  { key: "overtime", label: "残業時間", type: "short" },
  { key: "locations", label: "勤務地", type: "short" },
  { key: "benefits", label: "福利厚生" },
  { key: "briefingImpression", label: "説明会・社員から聞いた印象", wide: true },
  { key: "motivationPoints", label: "志望理由に使えそうな要素", wide: true },
  { key: "interviewTopics", label: "面接で話すネタ", wide: true },
  { key: "question1", label: "逆質問 1" },
  { key: "question2", label: "逆質問 2" },
  { key: "question3", label: "逆質問 3" },
  { key: "concerns", label: "不安点・確認したい点", wide: true }
];

let companies = loadCompanies();
let activeCompanyId = companies[0]?.id ?? null;

function createCompany(name) {
  return fields.reduce((company, field) => {
    company[field.key] = field.key === "name" ? name : "";
    return company;
  }, {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    updatedAt: Date.now()
  });
}

function loadCompanies() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    return [createCompany("企業A"), createCompany("企業B")];
  }

  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) && parsed.length ? parsed : [createCompany("企業A"), createCompany("企業B")];
  } catch {
    return [createCompany("企業A"), createCompany("企業B")];
  }
}

function saveCompanies() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(companies));
}

function getActiveCompany() {
  return companies.find((company) => company.id === activeCompanyId) ?? companies[0];
}

function renderCompanyList() {
  companyCount.textContent = `${companies.length}社`;
  companyList.replaceChildren();

  companies.forEach((company) => {
    const button = companyButtonTemplate.content.firstElementChild.cloneNode(true);
    button.classList.toggle("is-active", company.id === activeCompanyId);
    button.querySelector(".company-name").textContent = company.name || "名称未入力";
    button.querySelector(".company-industry").textContent = company.industry || "業界未入力";
    button.addEventListener("click", () => {
      activeCompanyId = company.id;
      render();
    });
    companyList.append(button);
  });
}

function renderForm() {
  const company = getActiveCompany();
  if (!company) return;

  editorTitle.textContent = company.name || "名称未入力";
  companyForm.replaceChildren();

  fields.forEach((field) => {
    const template = field.type === "short" ? shortFieldTemplate : fieldTemplate;
    const node = template.content.firstElementChild.cloneNode(true);
    const input = node.querySelector("input, textarea");
    node.classList.toggle("wide", Boolean(field.wide));
    node.querySelector(".field-label").textContent = `${field.label}:`;
    input.value = company[field.key] ?? "";

    input.addEventListener("input", () => {
      company[field.key] = input.value;
      company.updatedAt = Date.now();
      saveCompanies();

      if (field.key === "name" || field.key === "industry") {
        renderCompanyList();
        editorTitle.textContent = company.name || "名称未入力";
      }
    });

    companyForm.append(node);
  });
}

function render() {
  if (!getActiveCompany()) {
    const company = createCompany("企業A");
    companies.push(company);
    activeCompanyId = company.id;
    saveCompanies();
  }

  renderCompanyList();
  renderForm();
}

addCompanyButton.addEventListener("click", () => {
  const company = createCompany(`企業${String.fromCharCode(65 + companies.length)}`);
  companies.push(company);
  activeCompanyId = company.id;
  saveCompanies();
  render();
});

deleteCompanyButton.addEventListener("click", () => {
  const company = getActiveCompany();
  if (!company) return;

  companies = companies.filter((item) => item.id !== company.id);
  activeCompanyId = companies[0]?.id ?? null;
  saveCompanies();
  render();
});

exportButton.addEventListener("click", () => {
  const backup = {
    exportedAt: new Date().toISOString(),
    companies
  };
  const objectUrl = URL.createObjectURL(
    new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" })
  );
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = `企業情報記録-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(objectUrl);
});

render();
