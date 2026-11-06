const makeId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const STORAGE_KEY = 'tsifanavy-family-budget-v1';
export const CATEGORY_OPTIONS = [
  { name: 'Frais', kind: 'besoin' },
  { name: 'Sakafo', kind: 'besoin' },
  { name: 'Lamba', kind: 'besoin' },
  { name: 'PPN', kind: 'besoin' },
  { name: 'Rano', kind: 'besoin' },
  { name: 'Écolage', kind: 'ecolage' },
  { name: 'Plaisir', kind: 'plaisir' },
  { name: 'À répartir', kind: 'besoin' },
  { name: 'Autre', kind: 'autre' },
];

export const currentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const defaultBudgets = (month) => [
  ['Frais', 40000], ['Sakafo', 40000], ['Lamba', 10000], ['PPN', 38400], ['Rano', 12000], ['Écolage', 65000], ['Plaisir', 20000], ['À répartir', 100],
].map(([category, limit]) => ({ id: makeId(), category, limit, month }));

export const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

export const makeSeed = () => {
  const month = currentMonth();
  const date = `${month}-01`;
  const members = ['Famille'];
  const needs = [
    ['Frais', 'Frais du mois', 40000],
    ['Sakafo', 'Alimentation du mois', 40000],
    ['Lamba', 'Vêtements', 10000],
    ['PPN', 'Savon citron', 5500],
    ['PPN', 'Huile (menaka)', 5500],
    ['PPN', 'Savon', 9000],
    ['PPN', 'Lessive (vovon-tsavony)', 2800],
    ['PPN', 'Dentifrice (Colgate)', 1300],
    ['PPN', 'Sel (sira)', 300],
    ['PPN', 'Sucre (siramamy 1/2)', 2500],
    ['PPN', 'Charbon', 6000],
    ['PPN', 'Piles', 2000],
    ['PPN', 'Papier', 1000],
    ['PPN', 'Anti-moustique (ody moka)', 2500],
    ['Rano', 'Eau', 12000],
    ['À répartir', 'Ajustement du budget besoins', 100],
  ];

  return {
    version: 1,
    members,
    incomes: [{ id: makeId(), label: 'Karama', amount: 500000, month, member: 'Famille' }],
    expenses: [
      ...needs.map(([category, label, amount]) => ({ id: makeId(), category, label, amount, date, note: 'Budget initial', member: 'Famille' })),
      { id: makeId(), category: 'Plaisir', label: 'Restaurant', amount: 20000, date, note: 'Budget initial', member: 'Famille' },
      { id: makeId(), category: 'Écolage', label: 'Écolage Pierre', amount: 65000, date, note: 'Budget initial', member: 'Famille' },
    ],
    provisions: [],
    budgets: defaultBudgets(month),
    debts: [
      { id: makeId(), creditor: 'Créancier A', amount: 500000, months: 6, startMonth: month, note: '', payments: [] },
      { id: makeId(), creditor: 'Créancier B', amount: 300000, months: null, startMonth: month, note: 'Paiements mensuels, montant libre', payments: [] },
      { id: makeId(), creditor: 'Écolage', amount: 480000, months: null, startMonth: month, note: 'Paiements mensuels, montant libre', payments: [] },
    ],
    goals: [
      { id: makeId(), name: 'Épargne familiale', targetAmount: null, monthlyAmount: 20000, savedAmount: 0, deadline: '', note: '' },
      { id: makeId(), name: 'Projet avenir — Trano RAD', targetAmount: null, monthlyAmount: 100000, savedAmount: 0, deadline: '', note: 'Cible à définir plus tard' },
    ],
  };
};

const validRecord = (record) => record && typeof record === 'object' && typeof record.id === 'string';

export const normalizeData = (value) => {
  if (!value || typeof value !== 'object') throw new Error('Fichier de sauvegarde invalide.');
  const collections = ['incomes', 'expenses', 'debts', 'goals'];
  if (collections.some((key) => !Array.isArray(value[key]) || value[key].some((record) => !validRecord(record))) || (value.provisions !== undefined && (!Array.isArray(value.provisions) || value.provisions.some((record) => !validRecord(record)))) || (value.budgets !== undefined && (!Array.isArray(value.budgets) || value.budgets.some((record) => !validRecord(record))))) {
    throw new Error('La sauvegarde ne contient pas les données attendues.');
  }
  return {
    version: 1,
    members: Array.isArray(value.members) && value.members.length ? value.members.map(String) : ['Famille'],
    incomes: value.incomes.map((row) => ({ ...row, amount: Number(row.amount) || 0, member: row.member || 'Famille' })),
    expenses: value.expenses.map((row) => ({ ...row, amount: Number(row.amount) || 0, member: row.member || 'Famille' })),
    provisions: (value.provisions || []).map((row) => ({ ...row, category: row.category || 'PPN', amount: Number(row.amount) || 0, purchased: Boolean(row.purchased), actualAmount: Number(row.actualAmount) || 0 })),
    budgets: (value.budgets || defaultBudgets(currentMonth())).map((row) => ({ ...row, limit: Number(row.limit) || 0 })),
    debts: value.debts.map((row) => ({ ...row, amount: Number(row.amount) || 0, months: row.months ? Number(row.months) : null, payments: Array.isArray(row.payments) ? row.payments.map((payment) => ({ ...payment, id: String(payment.id || makeId()), amount: Number(payment.amount) || 0 })) : [] })),
    goals: value.goals.map((row) => ({ ...row, targetAmount: row.targetAmount ? Number(row.targetAmount) : null, monthlyAmount: Number(row.monthlyAmount) || 0, savedAmount: Number(row.savedAmount) || 0 })),
  };
};

export const loadData = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? normalizeData(JSON.parse(saved)) : makeSeed();
  } catch {
    return makeSeed();
  }
};

export const newId = makeId;
export const money = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
export const ariary = (amount) => `${money.format(Math.round(Number(amount) || 0))} Ar`;

export const totalsForMonth = (data, month) => {
  const incomes = data.incomes.filter((row) => row.month === month).reduce((sum, row) => sum + row.amount, 0);
  const expenses = data.expenses.filter((row) => row.date?.slice(0, 7) === month).reduce((sum, row) => sum + row.amount, 0);
  const provisions = (data.provisions || []).filter((row) => row.month === month && !row.purchased).reduce((sum, row) => sum + row.amount, 0);
  const needs = data.expenses.filter((row) => row.date?.slice(0, 7) === month && CATEGORY_OPTIONS.some((category) => category.name === row.category && category.kind === 'besoin')).reduce((sum, row) => sum + row.amount, 0);
  const monthlySavings = data.goals.reduce((sum, goal) => sum + goal.monthlyAmount, 0);
  const debtPayments = data.debts.reduce((sum, debt) => sum + debt.payments.filter((payment) => payment.date?.slice(0, 7) === month).reduce((paid, payment) => paid + payment.amount, 0), 0);
  return { incomes, expenses, provisions, needs, monthlySavings, debtPayments, remaining: incomes - expenses - provisions - monthlySavings - debtPayments };
};

export const paidOnDebt = (debt) => debt.payments.reduce((sum, payment) => sum + payment.amount, 0);
export const remainingOnDebt = (debt) => Math.max(0, debt.amount - paidOnDebt(debt));

export const budgetForMonth = (data, month, category) => {
  const exact = data.budgets.find((row) => row.month === month && row.category === category);
  if (exact) return exact.limit;
  const latest = data.budgets.filter((row) => row.category === category).sort((a, b) => b.month.localeCompare(a.month))[0];
  if (latest) return latest.limit;
  const defaultBudget = defaultBudgets(month).find((row) => row.category === category);
  return defaultBudget?.limit || 0;
};

export const debtPayoffEstimate = (debt, month) => {
  const balance = remainingOnDebt(debt);
  const cursor = new Date(`${month}-01T12:00:00`);
  const months = Array.from({ length: 3 }, (_, index) => {
    const date = new Date(cursor);
    date.setMonth(date.getMonth() - index);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  });
  const payments = debt.payments.filter((payment) => months.includes(payment.date?.slice(0, 7)));
  if (!payments.length || balance === 0) return null;
  const monthlyAverage = payments.reduce((sum, payment) => sum + payment.amount, 0) / new Set(payments.map((payment) => payment.date.slice(0, 7))).size;
  return Math.ceil(balance / monthlyAverage);
};

export const monthProjection = (data, month) => {
  const now = new Date();
  const isCurrentMonth = month === currentMonth();
  const [year, monthNumber] = month.split('-').map(Number);
  const daysInMonth = new Date(year, monthNumber, 0).getDate();
  const daysElapsed = isCurrentMonth ? now.getDate() : daysInMonth;
  const totals = totalsForMonth(data, month);
  const dailyRate = daysElapsed > 0 ? totals.expenses / daysElapsed : 0;
  const projectedExpenses = Math.round(dailyRate * daysInMonth);
  const projectedRemaining = totals.incomes - projectedExpenses - totals.provisions - totals.monthlySavings - totals.debtPayments;
  return { daysInMonth, daysElapsed, dailyRate, projectedExpenses, projectedRemaining, isCurrentMonth };
};

export const debtSchedule = (debt, month) => {
  if (!debt.months || !debt.startMonth) return null;
  const monthlyDue = Math.ceil(debt.amount / debt.months);
  const expectedMonths = Array.from({ length: debt.months }, (_, index) => addMonthsLocal(debt.startMonth, index));
  const paidMonths = new Set(debt.payments.filter((payment) => payment.date).map((payment) => payment.date.slice(0, 7)));
  const dueMonths = expectedMonths.filter((expected) => expected < month);
  const missedMonths = dueMonths.filter((expected) => !paidMonths.has(expected));
  const endMonth = expectedMonths[expectedMonths.length - 1];
  return { monthlyDue, expectedMonths, paidCount: paidMonths.size, missedMonths, endMonth };
};

function addMonthsLocal(month, count) {
  const [year, monthNumber] = month.split('-').map(Number);
  const date = new Date(year, monthNumber - 1 + count, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}
