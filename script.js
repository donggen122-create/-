const STORAGE_KEY = "household-ledger-entries";

const form = document.getElementById("entry-form");
const tableBody = document.getElementById("entry-table-body");
const emptyMessage = document.getElementById("empty-message");
const totalIncome = document.getElementById("total-income");
const totalExpense = document.getElementById("total-expense");
const balanceEl = document.getElementById("balance");
const exportButton = document.getElementById("export-csv");
const clearButton = document.getElementById("clear-all");

const formatCurrency = (value) =>
  new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  }).format(value);

const loadEntries = () => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveEntries = (entries) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
};

let entries = loadEntries();

document.getElementById("date").valueAsDate = new Date();

const render = () => {
  tableBody.innerHTML = "";

  entries
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .forEach((entry) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${entry.date}</td>
        <td>${entry.type === "income" ? "수입" : "지출"}</td>
        <td>${entry.category}</td>
        <td>${formatCurrency(entry.amount)}</td>
        <td>${entry.memo || "-"}</td>
        <td><button class="delete-btn" data-id="${entry.id}">삭제</button></td>
      `;
      tableBody.appendChild(row);
    });

  const income = entries
    .filter((entry) => entry.type === "income")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const expense = entries
    .filter((entry) => entry.type === "expense")
    .reduce((sum, entry) => sum + entry.amount, 0);

  totalIncome.textContent = formatCurrency(income);
  totalExpense.textContent = formatCurrency(expense);
  balanceEl.textContent = formatCurrency(income - expense);

  emptyMessage.hidden = entries.length > 0;
  saveEntries(entries);
};

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const entry = {
    id: crypto.randomUUID(),
    date: document.getElementById("date").value,
    type: document.getElementById("type").value,
    category: document.getElementById("category").value.trim(),
    amount: Number(document.getElementById("amount").value),
    memo: document.getElementById("memo").value.trim(),
  };

  if (!entry.date || !entry.category || entry.amount <= 0) return;

  entries.push(entry);
  form.reset();
  document.getElementById("date").valueAsDate = new Date();
  render();
});

tableBody.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) return;

  const id = target.dataset.id;
  entries = entries.filter((entry) => entry.id !== id);
  render();
});

clearButton.addEventListener("click", () => {
  const ok = window.confirm("모든 내역을 삭제할까요?");
  if (!ok) return;

  entries = [];
  render();
});

exportButton.addEventListener("click", () => {
  if (entries.length === 0) {
    alert("내보낼 데이터가 없습니다.");
    return;
  }

  const header = ["날짜", "유형", "카테고리", "금액", "메모"];
  const rows = entries.map((entry) => [
    entry.date,
    entry.type === "income" ? "수입" : "지출",
    entry.category,
    String(entry.amount),
    entry.memo.replaceAll('"', '""'),
  ]);

  const csvContent = [header, ...rows]
    .map((row) => row.map((cell) => `"${cell}"`).join(","))
    .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `가계부_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
});

render();
