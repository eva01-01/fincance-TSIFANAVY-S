import { useEffect, useMemo, useState } from 'react';
import { ArrowDownLeft, Banknote, BarChart3, Bell, CalendarDays, Check, ChevronDown, CircleDollarSign, CircleHelp, Download, FileDown, FileUp, Filter, HandCoins, House, KeyRound, Lock, Menu, Moon, Monitor, Palette, Pencil, PieChart, Plus, ReceiptText, Repeat, Search, Settings2, ShieldCheck, ShoppingBasket, Sun, Target, Trash2, TrendingUp, Wallet, X } from 'lucide-react';
import { CATEGORY_OPTIONS, budgetForMonth, currentMonth, debtPayoffEstimate, loadData, newId, normalizeData, paidOnDebt, remainingOnDebt, STORAGE_KEY, today, totalsForMonth, ariary } from './model.js';

const navItems = [
  { id: 'dashboard', label: 'Vue d’ensemble', icon: House },
  { id: 'incomes', label: 'Revenus', icon: ArrowDownLeft },
  { id: 'expenses', label: 'Dépenses', icon: ReceiptText },
  { id: 'budgets', label: 'Enveloppes', icon: Wallet },
  { id: 'provisions', label: 'Provisions', icon: ShoppingBasket },
  { id: 'debts', label: 'Dettes', icon: HandCoins },
  { id: 'goals', label: 'Épargne & projets', icon: Target },
  { id: 'analyses', label: 'Analyses', icon: PieChart },
];
const monthName = (month) => new Date(`${month}-02T12:00:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
const dateName = (date) => date ? new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const daysFromToday = (date) => Math.round((Date.parse(`${date}T12:00:00`) - Date.parse(`${today()}T12:00:00`)) / 86400000);
const freshEntry = (type) => ({ income: { label: '', amount: '', month: currentMonth(), recurring: false }, expense: { category: 'Sakafo', label: '', amount: '', date: today(), note: '', recurring: false }, provision: { label: '', category: 'PPN', amount: '', month: currentMonth(), dueDate: '', purchased: false, actualAmount: '', note: '' }, debt: { creditor: '', amount: '', months: '', startMonth: currentMonth(), note: '' }, goal: { name: '', targetAmount: '', monthlyAmount: '', savedAmount: '', deadline: '', note: '' }, payment: { amount: '', date: today() } }[type]);
const entityNames = { income: 'revenu', expense: 'dépense', provision: 'provision', debt: 'dette', goal: 'objectif', payment: 'paiement' };
const PREFERENCES_KEY = 'tsifanavy-family-budget-preferences-v1';
const themes = [{ id: 'light', label: 'Clair', icon: Sun }, { id: 'dark', label: 'Sombre', icon: Moon }, { id: 'system', label: 'Système', icon: Monitor }];
const colorOptions = [
  { id: 'forest', label: 'Forêt', accent: '#286246', dark: '#183d2e', soft: '#e8f1e9', softDark: '#263f31' },
  { id: 'ocean', label: 'Océan', accent: '#276a84', dark: '#174857', soft: '#e6f2f6', softDark: '#203c46' },
  { id: 'plum', label: 'Prune', accent: '#71529b', dark: '#453269', soft: '#f0eafb', softDark: '#382f4a' },
  { id: 'rose', label: 'Rose', accent: '#a95164', dark: '#6f3446', soft: '#f9e9ed', softDark: '#482c36' },
];
const defaultPreferences = { theme: 'light', color: 'forest' };
const loadPreferences = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(PREFERENCES_KEY) || 'null');
    return { theme: themes.some((item) => item.id === saved?.theme) ? saved.theme : defaultPreferences.theme, color: colorOptions.some((item) => item.id === saved?.color) ? saved.color : defaultPreferences.color };
  } catch {
    return defaultPreferences;
  }
};
const PIN_KEY = 'tsifanavy-family-budget-pin-v1';
const hashPin = (pin) => { let hash = 5381; for (let index = 0; index < pin.length; index += 1) hash = ((hash << 5) + hash + pin.charCodeAt(index)) >>> 0; return `pin-v1-${hash.toString(36)}`; };
const loadPinHash = () => { try { return localStorage.getItem(PIN_KEY) || ''; } catch { return ''; } };
const addMonths = (month, count) => { const [year, monthNumber] = month.split('-').map(Number); const date = new Date(year, monthNumber - 1 + count, 1); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; };
const clampedDay = (month, day) => { const [year, monthNumber] = month.split('-').map(Number); const lastDay = new Date(year, monthNumber, 0).getDate(); return `${month}-${String(Math.min(Math.max(1, day), lastDay)).padStart(2, '0')}`; };
const applyRecurring = (data, month) => {
  let changed = false;
  const incomes = [...data.incomes];
  const seenIncomes = new Set(incomes.filter((row) => row.month === month && row.recurringId).map((row) => row.recurringId));
  data.incomes.filter((row) => row.recurring && row.recurringId && row.month < month).sort((a, b) => b.month.localeCompare(a.month)).forEach((row) => {
    if (seenIncomes.has(row.recurringId)) return;
    incomes.push({ ...row, id: newId(), month });
    seenIncomes.add(row.recurringId);
    changed = true;
  });
  const expenses = [...data.expenses];
  const seenExpenses = new Set(expenses.filter((row) => row.date?.slice(0, 7) === month && row.recurringId).map((row) => row.recurringId));
  data.expenses.filter((row) => row.recurring && row.recurringId && row.date && row.date.slice(0, 7) < month).sort((a, b) => b.date.localeCompare(a.date)).forEach((row) => {
    if (seenExpenses.has(row.recurringId)) return;
    const { provisionId, ...rest } = row;
    expenses.push({ ...rest, id: newId(), date: clampedDay(month, Number(row.date.slice(8, 10)) || 1) });
    seenExpenses.add(row.recurringId);
    changed = true;
  });
  return changed ? { ...data, incomes, expenses } : data;
};

function FormDialog({ type, initial, onClose, onSave }) {
  const [values, setValues] = useState(() => ({ ...freshEntry(type), ...initial }));
  const [error, setError] = useState('');
  const update = (key, value) => setValues((current) => ({ ...current, [key]: value }));
  const submit = (event) => {
    event.preventDefault();
    const amount = Number(values.amount);
    if (type !== 'goal' && (!values.amount || !Number.isFinite(amount) || amount <= 0)) {
      setError('Saisis un montant supérieur à zéro.');
      return;
    }
    if ((type === 'income' && !values.label.trim()) || ((type === 'expense' || type === 'provision') && !values.label.trim()) || (type === 'debt' && !values.creditor.trim()) || (type === 'goal' && !values.name.trim())) {
      setError('Complète le nom ou le libellé.');
      return;
    }
    if (type === 'goal' && ((values.targetAmount && (!Number.isFinite(Number(values.targetAmount)) || Number(values.targetAmount) <= 0)) || !Number.isFinite(Number(values.monthlyAmount || 0)) || Number(values.monthlyAmount || 0) < 0 || !Number.isFinite(Number(values.savedAmount || 0)) || Number(values.savedAmount || 0) < 0)) {
      setError('Vérifie les montants de l’objectif.');
      return;
    }
    if (type === 'provision' && values.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(values.dueDate)) {
      setError('Vérifie la date de rappel.');
      return;
    }
    if (((type === 'income' || type === 'provision') && !/^\d{4}-(0[1-9]|1[0-2])$/.test(values.month)) || ((type === 'expense' || type === 'payment') && !/^\d{4}-\d{2}-\d{2}$/.test(values.date)) || (type === 'debt' && !/^\d{4}-(0[1-9]|1[0-2])$/.test(values.startMonth))) {
      setError('Vérifie la date ou le mois saisi.');
      return;
    }
    onSave({ ...values, amount, ...(type === 'debt' ? { months: values.months ? Math.max(1, Number(values.months)) : null } : {}), ...(type === 'goal' ? { targetAmount: values.targetAmount ? Number(values.targetAmount) : null, monthlyAmount: Number(values.monthlyAmount) || 0, savedAmount: Number(values.savedAmount) || 0 } : {}) });
  };
  const title = `${initial?.id ? 'Modifier' : 'Ajouter'} ${entityNames[type]}`;
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><div className="modal-head"><div><span className="eyebrow">BUDGET FAMILIAL</span><h2 id="dialog-title">{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Fermer"><X size={20} /></button></div><form onSubmit={submit} className="form-grid">
    {type === 'income' && <><Field label="Libellé" value={values.label} onChange={(v) => update('label', v)} required placeholder="Ex. Salaire" /><Field label="Montant (Ar)" value={values.amount} onChange={(v) => update('amount', v)} required type="number" min="1" /><Field label="Mois" value={values.month} onChange={(v) => update('month', v)} required type="month" /><label className="check-field"><input type="checkbox" checked={Boolean(values.recurring)} onChange={(event) => update('recurring', event.target.checked)} /><span><Repeat size={13} /> Revenu mensuel récurrent (copié automatiquement chaque mois)</span></label></>}
    {type === 'expense' && <><Field label="Libellé" value={values.label} onChange={(v) => update('label', v)} required placeholder="Ex. Courses du marché" /><Field label="Catégorie" value={values.category} onChange={(v) => update('category', v)} required list="category-options" /><datalist id="category-options">{[...new Set([...CATEGORY_OPTIONS.map((item) => item.name), ...(initial?.knownCategories || [])])].map((category) => <option key={category} value={category} />)}</datalist><Field label="Montant (Ar)" value={values.amount} onChange={(v) => update('amount', v)} required type="number" min="1" /><Field label="Date" value={values.date} onChange={(v) => update('date', v)} required type="date" /><Field label="Note" value={values.note} onChange={(v) => update('note', v)} placeholder="Facultatif" /><label className="check-field"><input type="checkbox" checked={Boolean(values.recurring)} onChange={(event) => update('recurring', event.target.checked)} /><span><Repeat size={13} /> Dépense mensuelle récurrente (copiée automatiquement chaque mois)</span></label> </>}
    {type === 'provision' && <><Field label="Article prévu" value={values.label} onChange={(v) => update('label', v)} required placeholder="Ex. Savon, riz, huile" /><Field label="Catégorie" value={values.category} onChange={(v) => update('category', v)} required list="category-options" /><Field label="Montant prévu (Ar)" value={values.amount} onChange={(v) => update('amount', v)} required type="number" min="1" /><Field label="Mois" value={values.month} onChange={(v) => update('month', v)} required type="month" /><Field label="Date à rappeler" value={values.dueDate} onChange={(v) => update('dueDate', v)} type="date" /><Field label="Note" value={values.note} onChange={(v) => update('note', v)} placeholder="Facultatif" /></>}
    {type === 'debt' && <><Field label="Créancier" value={values.creditor} onChange={(v) => update('creditor', v)} required placeholder="Nom du créancier" /><Field label="Montant total (Ar)" value={values.amount} onChange={(v) => update('amount', v)} required type="number" min="1" /><Field label="Durée (mois, facultative)" value={values.months || ''} onChange={(v) => update('months', v)} type="number" min="1" placeholder="Paiements libres" /><Field label="Début du remboursement" value={values.startMonth} onChange={(v) => update('startMonth', v)} type="month" /><Field label="Note" value={values.note} onChange={(v) => update('note', v)} placeholder="Facultatif" /></>}
    {type === 'goal' && <><Field label="Nom du projet" value={values.name} onChange={(v) => update('name', v)} required placeholder="Ex. Trano RAD" /><Field label="Cible (Ar, facultative)" value={values.targetAmount || ''} onChange={(v) => update('targetAmount', v)} type="number" min="1" placeholder="À définir plus tard" /><Field label="Épargne mensuelle (Ar)" value={values.monthlyAmount} onChange={(v) => update('monthlyAmount', v)} type="number" min="0" /><Field label="Déjà épargné (Ar)" value={values.savedAmount} onChange={(v) => update('savedAmount', v)} type="number" min="0" /><Field label="Échéance" value={values.deadline} onChange={(v) => update('deadline', v)} type="date" /><Field label="Note" value={values.note} onChange={(v) => update('note', v)} placeholder="Facultatif" /></>}
    {type === 'payment' && <><Field label="Montant payé (Ar)" value={values.amount} onChange={(v) => update('amount', v)} required type="number" min="1" /><Field label="Date du paiement" value={values.date} onChange={(v) => update('date', v)} required type="date" /></>}
    {error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="button button-quiet" onClick={onClose}>Annuler</button><button type="submit" className="button button-primary"><Check size={17} /> Enregistrer</button></div>
  </form></section></div>;
}

function Field({ label, value, onChange, ...props }) {
  return <label className="field"><span>{label}</span><input value={value ?? ''} onChange={(event) => onChange(event.target.value)} {...props} /></label>;
}

function EmptyState({ title, text }) {
  return <div className="empty-state"><span className="empty-icon"><Wallet size={21} /></span><strong>{title}</strong><p>{text}</p></div>;
}

function App() {
  const [data, setData] = useState(loadData);
  const [page, setPage] = useState('dashboard');
  const [month, setMonth] = useState(currentMonth());
  const [dialog, setDialog] = useState(null);
  const [notice, setNotice] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [pinHash, setPinHash] = useState(loadPinHash);
  const [locked, setLocked] = useState(() => Boolean(loadPinHash()));
  const [pinDialog, setPinDialog] = useState(false);
  const [preferences, setPreferences] = useState(loadPreferences);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches || false);
  const [expenseQuery, setExpenseQuery] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('all');
  const recentMonths = useMemo(() => Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - 5 + index);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }), []);
  const monthlySeries = useMemo(() => recentMonths.map((key) => ({ key, ...totalsForMonth(data, key) })), [data, recentMonths]);
  const totals = useMemo(() => totalsForMonth(data, month), [data, month]);
  const currentIncomes = data.incomes.filter((row) => row.month === month);
  const currentExpenses = data.expenses.filter((row) => row.date?.slice(0, 7) === month).sort((a, b) => b.date.localeCompare(a.date));
  const currentProvisions = data.provisions.filter((row) => row.month === month).sort((a, b) => Number(a.purchased) - Number(b.purchased) || (a.dueDate || '9999-12-31').localeCompare(b.dueDate || '9999-12-31') || a.label.localeCompare(b.label));
  const categories = [...new Set([...CATEGORY_OPTIONS.map((item) => item.name), ...data.expenses.map((row) => row.category), ...data.provisions.map((row) => row.category), ...data.budgets.map((row) => row.category)])];
  const budgetCategories = [...new Set([...CATEGORY_OPTIONS.map((item) => item.name), ...data.expenses.map((row) => row.category), ...data.provisions.map((row) => row.category || 'PPN'), ...data.budgets.map((row) => row.category)])];
  const budgetRows = budgetCategories.map((category) => ({ category, limit: budgetForMonth(data, month, category), spent: currentExpenses.filter((row) => row.category === category).reduce((sum, row) => sum + row.amount, 0) }));
  const needsBudget = budgetRows.filter((row) => CATEGORY_OPTIONS.some((item) => item.name === row.category && item.kind === 'besoin')).reduce((sum, row) => sum + row.limit, 0);
  const needsSpent = currentExpenses.filter((row) => CATEGORY_OPTIONS.some((item) => item.name === row.category && item.kind === 'besoin')).reduce((sum, row) => sum + row.amount, 0);
  const schoolAndFunBudget = budgetRows.filter((row) => CATEGORY_OPTIONS.some((item) => item.name === row.category && ['ecolage', 'plaisir'].includes(item.kind))).reduce((sum, row) => sum + row.limit, 0);
  const schoolAndFunSpent = currentExpenses.filter((row) => CATEGORY_OPTIONS.some((item) => item.name === row.category && ['ecolage', 'plaisir'].includes(item.kind))).reduce((sum, row) => sum + row.amount, 0);
  const dueProvisions = currentProvisions.filter((row) => !row.purchased && row.dueDate && daysFromToday(row.dueDate) >= 0 && daysFromToday(row.dueDate) <= 7);
  const overdueProvisions = currentProvisions.filter((row) => !row.purchased && row.dueDate && daysFromToday(row.dueDate) < 0);
  const visibleExpenses = currentExpenses.filter((row) => (expenseCategory === 'all' || row.category === expenseCategory) && (!expenseQuery.trim() || `${row.label} ${row.category} ${row.note || ''}`.toLocaleLowerCase('fr').includes(expenseQuery.trim().toLocaleLowerCase('fr'))));
  const resolvedTheme = preferences.theme === 'system' ? (systemDark ? 'dark' : 'light') : preferences.theme;
  const activeColor = colorOptions.find((option) => option.id === preferences.color) || colorOptions[0];
  const alerts = (() => {
    const list = [];
    const now = currentMonth();
    data.provisions.filter((row) => !row.purchased && row.dueDate && row.month <= now).forEach((row) => {
      const days = daysFromToday(row.dueDate);
      if (days < 0) list.push({ tone: 'danger', icon: CalendarDays, title: `Achat en retard : ${row.label}`, text: `Prévu le ${dateName(row.dueDate)} · ${ariary(row.amount)}`, page: 'provisions' });
      else if (days <= 7) list.push({ tone: 'warning', icon: CalendarDays, title: `Achat à prévoir : ${row.label}`, text: days === 0 ? 'À faire aujourd’hui' : `À prévoir le ${dateName(row.dueDate)}`, page: 'provisions' });
    });
    if (month === now) budgetRows.filter((row) => row.limit > 0 && row.spent > row.limit).forEach((row) => list.push({ tone: 'danger', icon: Wallet, title: `Enveloppe dépassée : ${row.category}`, text: `Dépassement de ${ariary(row.spent - row.limit)} sur ${monthName(month)}`, page: 'budgets' }));
    data.debts.filter((debt) => remainingOnDebt(debt) > 0 && debt.startMonth <= now && !debt.payments.some((payment) => payment.date?.slice(0, 7) === now)).forEach((debt) => list.push({ tone: 'warning', icon: HandCoins, title: `Paiement à prévoir : ${debt.creditor}`, text: `Encore ${ariary(remainingOnDebt(debt))} à rembourser`, page: 'debts' }));
    data.goals.filter((goal) => goal.deadline && goal.targetAmount && goal.savedAmount < goal.targetAmount).forEach((goal) => {
      const days = daysFromToday(goal.deadline);
      if (days >= 0 && days <= 30) list.push({ tone: 'warning', icon: Target, title: `Échéance proche : ${goal.name}`, text: `${ariary(goal.targetAmount - goal.savedAmount)} restants · ${days === 0 ? 'cible aujourd’hui' : `${days} jour${days === 1 ? '' : 's'} restant${days === 1 ? '' : 's'}`}`, page: 'goals' });
    });
    return list;
  })();
  const analysisMonths = useMemo(() => Array.from({ length: 12 }, (_, index) => addMonths(currentMonth(), index - 11)), []);
  const analysisSeries = useMemo(() => analysisMonths.map((key) => ({ key, ...totalsForMonth(data, key) })), [data, analysisMonths]);
  const categoryBreakdown = Object.entries(currentExpenses.reduce((acc, row) => { acc[row.category] = (acc[row.category] || 0) + row.amount; return acc; }, {})).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
  const activeSeries = monthlySeries.filter((item) => item.incomes || item.expenses);
  const averageExpenses = activeSeries.length ? activeSeries.reduce((sum, item) => sum + item.expenses, 0) / activeSeries.length : 0;
  const previousTotals = totalsForMonth(data, addMonths(month, -1));
  const expenseChange = previousTotals.expenses ? Math.round((totals.expenses - previousTotals.expenses) / previousTotals.expenses * 100) : null;
  const savingsRate = totals.incomes > 0 ? Math.round(totals.remaining / totals.incomes * 100) : null;

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = (event) => setSystemDark(event.matches);
    setSystemDark(media.matches);
    if (media.addEventListener) media.addEventListener('change', update);
    else media.addListener(update);
    return () => {
      if (media.removeEventListener) media.removeEventListener('change', update);
      else media.removeListener(update);
    };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.style.colorScheme = resolvedTheme;
    try {
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
    } catch {
      setNotice('Les préférences ne peuvent pas être sauvegardées sur cet appareil.');
    }
  }, [preferences, resolvedTheme]);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      setNotice('La sauvegarde locale est indisponible sur cet appareil.');
    }
  }, [data]);
  useEffect(() => {
    setData((current) => applyRecurring(current, currentMonth()));
  }, []);
  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(''), 3600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const saveRecord = (type, values) => {
    if (type === 'payment') {
      const debt = data.debts.find((row) => row.id === dialog.debtId);
      const paidWithoutEditedPayment = paidOnDebt(debt) - (values.id ? debt.payments.find((payment) => payment.id === values.id)?.amount || 0 : 0);
      if (Number(values.amount) + paidWithoutEditedPayment > debt.amount) {
        setNotice('Le paiement dépasse le solde restant de cette dette.');
        return;
      }
      setData((current) => ({ ...current, debts: current.debts.map((row) => row.id !== dialog.debtId ? row : { ...row, payments: values.id ? row.payments.map((payment) => payment.id === values.id ? { ...payment, ...values } : payment) : [...row.payments, { ...values, id: newId() }] }) }));
    } else {
      const key = type === 'income' ? 'incomes' : type === 'expense' ? 'expenses' : type === 'provision' ? 'provisions' : type === 'debt' ? 'debts' : 'goals';
      const record = { ...values, id: values.id || newId(), ...((type === 'income' || type === 'expense') ? { recurring: Boolean(values.recurring), recurringId: values.recurring ? values.recurringId || newId() : undefined } : {}), ...(type === 'debt' ? { payments: values.payments || [] } : {}) };
      setData((current) => {
        const updated = { ...current, [key]: values.id ? current[key].map((row) => row.id === values.id ? record : row) : [...current[key], record] };
        if (type === 'provision' && record.purchased) updated.expenses = updated.expenses.map((expense) => expense.provisionId === record.id ? { ...expense, category: record.category, label: record.label, amount: record.actualAmount, date: record.purchaseDate || expense.date } : expense);
        return updated;
      });
    }
    setDialog(null);
    setNotice('Modifications enregistrées sur cet appareil.');
  };

  const setCategoryBudget = (category, value) => {
    const limit = Math.max(0, Number(value) || 0);
    setData((current) => {
      const existing = current.budgets.find((row) => row.month === month && row.category === category);
      const record = { id: existing?.id || newId(), category, month, limit };
      return { ...current, budgets: existing ? current.budgets.map((row) => row.id === existing.id ? record : row) : [...current.budgets, record] };
    });
  };
  const markProvisionPurchased = (provision) => {
    const enteredAmount = window.prompt(`Montant réellement payé pour « ${provision.label} » (Ar)`, String(provision.amount));
    if (enteredAmount === null) return;
    const amount = Number(enteredAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setNotice('Saisis un montant valide supérieur à zéro.');
      return;
    }
    const date = today();
    setData((current) => ({ ...current, provisions: current.provisions.map((row) => row.id === provision.id ? { ...row, purchased: true, actualAmount: amount, purchaseDate: date } : row), expenses: [...current.expenses, { id: newId(), provisionId: provision.id, category: provision.category || 'PPN', label: provision.label, amount, date, note: 'Achat enregistré depuis les provisions' }] }));
    setNotice('Achat enregistré dans les dépenses réelles.');
  };
  const removeRecord = (key, id, description) => {
    if (!window.confirm(`Supprimer ${description} ? Cette action ne peut pas être annulée.`)) return;
    setData((current) => ({ ...current, [key]: current[key].filter((row) => row.id !== id) }));
    setNotice('Élément supprimé.');
  };
  const removePayment = (debtId, paymentId) => {
    if (!window.confirm('Supprimer ce paiement ?')) return;
    setData((current) => ({ ...current, debts: current.debts.map((debt) => debt.id === debtId ? { ...debt, payments: debt.payments.filter((payment) => payment.id !== paymentId) } : debt) }));
    setNotice('Paiement supprimé.');
  };
  const downloadBackup = () => {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    link.download = `budget-familial-${today()}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  };
  const downloadCsv = () => {
    const rows = [['Libellé', 'Catégorie', 'Date', 'Montant (Ar)', 'Note'], ...currentExpenses.map((row) => [row.label, row.category, row.date, row.amount, row.note || ''])];
    const csv = `\uFEFF${rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(';')).join('\r\n')}`;
    const link = document.createElement('a');
    const objectUrl = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    link.href = objectUrl;
    link.download = `depenses-${month}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  };
  const downloadMonthlySummary = () => {
    const rows = [['Résumé du budget familial', monthName(month)], ['Revenus', totals.incomes], ['Dépenses enregistrées', totals.expenses], ['Achats encore prévus', totals.provisions], ['Remboursements', totals.debtPayments], ['Épargne mensuelle planifiée', totals.monthlySavings], ['Solde prévisionnel', totals.remaining], [], ['Catégorie', 'Budget prévu (Ar)', 'Dépenses (Ar)', 'Reste (Ar)'], ...budgetRows.map((row) => [row.category, row.limit, row.spent, row.limit - row.spent]), [], ['Dette', 'Montant restant (Ar)'], ...data.debts.map((debt) => [debt.creditor, remainingOnDebt(debt)])];
    const csv = `\uFEFF${rows.map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(';')).join('\r\n')}`;
    const objectUrl = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = `resume-familial-${month}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  };
  const restoreBackup = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const restored = normalizeData(JSON.parse(await file.text()));
      if (!window.confirm('Remplacer les données locales par cette sauvegarde ?')) return;
      setData(restored);
      setNotice('Sauvegarde restaurée.');
    } catch (error) {
      setNotice(error.message || 'Impossible de lire cette sauvegarde.');
    } finally {
      event.target.value = '';
    }
  };
  const goTo = (next) => { setPage(next); setMenuOpen(false); };
  const editDialog = (type, record) => setDialog({ type, initial: { ...record, ...(type === 'expense' ? { knownCategories: categories } : {}) } });
  const startDialog = (type, initial) => setDialog({ type, initial: { ...initial, ...(type === 'expense' ? { knownCategories: categories } : {}) } });
  const dialogSave = (values) => saveRecord(dialog.type, values);

  return <div className="app-shell" style={{ '--green': activeColor.accent, '--green-dark': activeColor.dark, '--green-soft': resolvedTheme === 'dark' ? activeColor.softDark : activeColor.soft }}>
    <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}><div className="brand"><span className="brand-mark"><CircleDollarSign size={21} strokeWidth={1.8} /></span><span><strong>Fianakaviana</strong><small>BUDGET FAMILIAL</small></span></div><span className="nav-caption">GESTION</span><nav>{navItems.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-item ${page === id ? 'nav-active' : ''}`} onClick={() => goTo(id)}><Icon size={19} /><span>{label}</span>{page === id && <span className="nav-dot" />}</button>)}</nav><button className={`settings-trigger ${settingsOpen ? 'settings-active' : ''}`} onClick={() => { setSettingsOpen(true); setMenuOpen(false); }}><Settings2 size={18} /><span><strong>Apparence</strong><small>{themes.find((item) => item.id === preferences.theme)?.label} · {activeColor.label}</small></span><ChevronDown size={15} /></button><div className="sidebar-note"><span className="note-icon"><CircleHelp size={17} /></span><p>Vos données restent sur cet appareil.</p><small>Faites une sauvegarde régulière.</small></div><div className="sidebar-footer"><span className="status-dot" />Hors ligne · Ariary (Ar)</div></aside>
    <div className="main-area"><header className="topbar"><button className="icon-button mobile-menu" aria-label="Ouvrir le menu" onClick={() => setMenuOpen((open) => !open)}><Menu size={21} /></button><div className="breadcrumb">Maison <span>/</span> <strong>{navItems.find((item) => item.id === page)?.label}</strong></div><div className="topbar-actions"><label className="month-picker"><CalendarDays size={16} /><input aria-label="Choisir un mois" type="month" value={month} onChange={(event) => setMonth(event.target.value)} /><ChevronDown size={14} /></label><button className="button button-dark top-add" onClick={() => startDialog(page === 'incomes' ? 'income' : page === 'debts' ? 'debt' : page === 'goals' ? 'goal' : page === 'provisions' ? 'provision' : 'expense')}><Plus size={17} /><span>Nouvelle entrée</span></button></div></header>
      <main className="content">
        {page === 'dashboard' && <><div className="page-intro"><div><span className="eyebrow">SUIVI DU FOYER</span><h1>Un budget clair, <em>chaque mois.</em></h1><p>Vos finances familiales en un coup d’œil.</p></div><div className="dashboard-actions"><button className="button button-outline" onClick={downloadMonthlySummary}><Download size={16} /> Résumé du mois</button><button className="button button-outline" onClick={downloadBackup}><FileDown size={16} /> Sauvegarde</button></div></div><div className="summary-grid"><SummaryCard label="Revenus du mois" amount={totals.incomes} hint={monthName(month)} icon={Banknote} tone="green" /><SummaryCard label="Dépenses enregistrées" amount={totals.expenses} hint={`${currentExpenses.length} opération${currentExpenses.length === 1 ? '' : 's'}`} icon={ReceiptText} tone="coral" /><SummaryCard label="Solde prévisionnel" amount={totals.remaining} hint={`Épargne : ${ariary(totals.monthlySavings)} · Provisions : ${ariary(totals.provisions)} · Remboursements : ${ariary(totals.debtPayments)}`} icon={CircleDollarSign} tone="gold" /></div>{(month === currentMonth() && (overdueProvisions.length > 0 || dueProvisions.length > 0)) && <section className="panel dashboard-reminders"><span className="quick-icon"><CalendarDays size={18} /></span><div><strong>{overdueProvisions.length ? `${overdueProvisions.length} achat${overdueProvisions.length === 1 ? '' : 's'} en retard` : `${dueProvisions.length} achat${dueProvisions.length === 1 ? '' : 's'} à prévoir cette semaine`}</strong><span>{[...overdueProvisions, ...dueProvisions].slice(0, 3).map((row) => row.label).join(' · ')}</span></div><button className="button button-outline" onClick={() => goTo('provisions')}>Voir les rappels</button></section>}<section className="panel trend-panel"><div className="section-heading"><div><span className="eyebrow">TENDANCE</span><h2>Revenus et dépenses · 6 mois</h2></div><span className="trend-icon"><BarChart3 size={18} /></span></div><MonthlyTrend series={monthlySeries} /></section><div className="dashboard-grid"><section className="panel expenses-panel"><div className="section-heading"><div><span className="eyebrow">CE MOIS-CI</span><h2>Dernières dépenses</h2></div><button className="text-button" onClick={() => goTo('expenses')}>Tout voir <span>→</span></button></div>{currentExpenses.length ? <div className="transaction-list">{currentExpenses.slice(0, 6).map((row) => <TransactionRow key={row.id} record={row} onEdit={() => editDialog('expense', row)} onDelete={() => removeRecord('expenses', row.id, row.label)} />)}</div> : <EmptyState title="Pas encore de dépense" text="Ajoutez vos premières dépenses du mois." />}</section><section className="panel allocation-panel"><div className="section-heading"><div><span className="eyebrow">PLAN DU MOIS</span><h2>Essentiel & projets</h2></div><span className="plan-icon"><TrendingUp size={18} /></span></div><Allocation label="Besoins essentiels" amount={needsSpent} limit={needsBudget} color="var(--green)" /><Allocation label="Écolage & plaisir" amount={schoolAndFunSpent} limit={schoolAndFunBudget} color="var(--gold)" /><div className="project-mini-list">{data.goals.map((goal) => <div className="project-mini" key={goal.id}><span className="goal-dot" /><div><strong>{goal.name}</strong><small>{ariary(goal.monthlyAmount)} / mois</small></div></div>)}</div><button className="text-button project-link" onClick={() => goTo('goals')}>Gérer les objectifs <span>→</span></button></section></div><section className="quick-strip"><div className="quick-copy"><span className="quick-icon"><Banknote size={19} /></span><div><strong>Gérer vos dettes</strong><span>Suivez les remboursements à votre rythme.</span></div></div><button className="button button-outline" onClick={() => goTo('debts')}>Voir les dettes <span>→</span></button></section></>}
        {page === 'incomes' && <><PageHeading eyebrow="ENTRÉES D’ARGENT" title="Revenus" subtitle="Suivez les revenus du foyer, mois par mois." onAdd={() => startDialog('income')} button="Ajouter un revenu" /><section className="panel table-panel"><div className="table-toolbar"><div><strong>{currentIncomes.length} revenu{currentIncomes.length === 1 ? '' : 's'}</strong><span> {monthName(month)}</span></div><strong className="table-total">{ariary(totals.incomes)}</strong></div>{currentIncomes.length ? <div className="table-scroll"><table><thead><tr><th>Libellé</th><th>Mois</th><th>Montant</th><th>Actions</th></tr></thead><tbody>{currentIncomes.map((row) => <tr key={row.id}><td><span className="row-avatar avatar-green"><ArrowDownLeft size={17} /></span><strong>{row.label}</strong></td><td>{monthName(row.month)}</td><td className="amount-positive">+ {ariary(row.amount)}</td><td><RowActions onEdit={() => editDialog('income', row)} onDelete={() => removeRecord('incomes', row.id, row.label)} /></td></tr>)}</tbody></table></div> : <EmptyState title="Aucun revenu ce mois-ci" text="Ajoutez un salaire ou une autre source de revenu." />}</section></>}
        {page === 'expenses' && <><PageHeading eyebrow="SORTIES D’ARGENT" title="Dépenses" subtitle="Ajoutez, corrigez et classez chaque dépense." onAdd={() => startDialog('expense')} button="Ajouter une dépense" /><div className="expense-tools"><label className="search-field"><Search size={16} /><input value={expenseQuery} onChange={(event) => setExpenseQuery(event.target.value)} placeholder="Rechercher une dépense" aria-label="Rechercher une dépense" /></label><label className="category-filter"><Filter size={15} /><select value={expenseCategory} onChange={(event) => setExpenseCategory(event.target.value)} aria-label="Filtrer par catégorie"><option value="all">Toutes les catégories</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label><button className="button button-outline csv-button" onClick={downloadCsv}><Download size={16} /> Exporter CSV</button></div><section className="panel table-panel"><div className="table-toolbar"><div><strong>{currentExpenses.length} dépense{currentExpenses.length === 1 ? '' : 's'}</strong><span> {monthName(month)}</span></div><strong className="table-total">{ariary(totals.expenses)}</strong></div>{visibleExpenses.length ? <div className="table-scroll"><table><thead><tr><th>Dépense</th><th>Catégorie</th><th>Date</th><th>Montant</th><th>Actions</th></tr></thead><tbody>{visibleExpenses.map((row) => <tr key={row.id}><td><span className="row-avatar avatar-gold"><ReceiptText size={16} /></span><span className="table-main"><strong>{row.label}</strong>{row.note && <small>{row.note}</small>}</span></td><td><span className="category-chip">{row.category}</span></td><td>{dateName(row.date)}</td><td className="amount-negative">− {ariary(row.amount)}</td><td><RowActions onEdit={() => editDialog('expense', row)} onDelete={() => removeRecord('expenses', row.id, row.label)} /></td></tr>)}</tbody></table></div> : <EmptyState title={currentExpenses.length ? 'Aucun résultat' : 'Aucune dépense ce mois-ci'} text={currentExpenses.length ? 'Essayez une autre recherche ou catégorie.' : 'Enregistrez une dépense pour suivre le budget.'} />}</section></>}
        {page === 'budgets' && <><PageHeading eyebrow="LIMITES DU MOIS" title="Enveloppes familiales" subtitle="Fixez un plafond par catégorie et suivez ce qui est déjà dépensé." /><div className="budget-grid">{budgetRows.map((row) => { const remaining = row.limit - row.spent; const percent = row.limit > 0 ? Math.min(100, Math.round(row.spent / row.limit * 100)) : row.spent > 0 ? 100 : 0; return <article className="panel budget-card" key={row.category}><div className="budget-card-head"><div><span className="eyebrow">ENVELOPPE</span><h2>{row.category}</h2></div><span className={`budget-badge ${remaining < 0 ? 'over' : ''}`}>{row.limit ? `${percent}%` : 'À définir'}</span></div><div className="budget-input-row"><label>Plafond du mois (Ar)<input aria-label={`Budget ${row.category}`} type="number" min="0" step="100" value={row.limit} onChange={(event) => setCategoryBudget(row.category, event.target.value)} /></label><span className="budget-spent">Dépensé<strong>{ariary(row.spent)}</strong></span></div><div className="allocation-track"><span className={remaining < 0 ? 'budget-over-bar' : ''} style={{ width: `${percent}%` }} /></div><p className={`budget-balance ${remaining < 0 ? 'over' : ''}`}>{row.limit ? remaining >= 0 ? `Il reste ${ariary(remaining)}` : `Dépassement de ${ariary(Math.abs(remaining))}` : 'Indiquez une limite pour suivre cette enveloppe.'}</p></article>; })}</div><section className="panel budget-summary"><div><span className="eyebrow">RÉCAPITULATIF</span><h2>{monthName(month)}</h2><p>Les montants se mettent à jour dès qu’une dépense est enregistrée.</p></div><button className="button button-outline" onClick={downloadMonthlySummary}><Download size={16} /> Exporter le résumé</button></section></>}
        {page === 'provisions' && <><PageHeading eyebrow="ACHATS À PRÉVOIR" title="Provisions" subtitle="Planifiez les achats, ajoutez un rappel et enregistrez le prix réel quand ils sont achetés." onAdd={() => startDialog('provision')} button="Ajouter une provision" />{(month === currentMonth() && (overdueProvisions.length > 0 || dueProvisions.length > 0)) && <section className="panel reminder-panel"><div><span className="eyebrow">RAPPELS D’ACHATS</span><h2>{overdueProvisions.length ? `${overdueProvisions.length} rappel${overdueProvisions.length === 1 ? '' : 's'} en retard` : 'Achats à prévoir cette semaine'}</h2></div><div className="reminder-list">{[...overdueProvisions, ...dueProvisions].map((row) => <div className="reminder-item" key={row.id}><div><strong>{row.label}</strong><span>{row.dueDate && (daysFromToday(row.dueDate) < 0 ? `En retard · ${dateName(row.dueDate)}` : daysFromToday(row.dueDate) === 0 ? 'À faire aujourd’hui' : `À prévoir le ${dateName(row.dueDate)}`)}</span></div><button className="button button-outline" onClick={() => markProvisionPurchased(row)}>Acheté</button></div>)}</div></section>}<section className="panel table-panel"><div className="table-toolbar"><div><strong>{currentProvisions.filter((row) => !row.purchased).length} achat{currentProvisions.filter((row) => !row.purchased).length === 1 ? '' : 's'} à faire</strong><span> · {monthName(month)}</span></div><strong className="table-total">Prévu : {ariary(totals.provisions)}</strong></div>{currentProvisions.length ? <div className="table-scroll"><table><thead><tr><th>Article</th><th>Catégorie</th><th>Rappel</th><th>Montant prévu / payé</th><th>Actions</th></tr></thead><tbody>{currentProvisions.map((row) => <tr key={row.id}><td><span className="row-avatar avatar-gold"><ShoppingBasket size={16} /></span><span className="table-main"><strong>{row.label}</strong>{row.note && <small>{row.note}</small>}</span></td><td><span className="category-chip">{row.category || 'PPN'}</span></td><td>{row.dueDate ? dateName(row.dueDate) : '—'}</td><td className={row.purchased ? 'amount-positive' : 'amount-negative'}>{ariary(row.purchased ? row.actualAmount : row.amount)}{row.purchased && <small> · payé</small>}</td><td><div className="provision-actions"><RowActions onEdit={() => editDialog('provision', row)} onDelete={() => removeRecord('provisions', row.id, row.label)} />{!row.purchased && <button className="icon-button purchase-button" aria-label={`Enregistrer l’achat ${row.label}`} onClick={() => markProvisionPurchased(row)} title="Marquer comme acheté"><Check size={16} /></button>}</div></td></tr>)}</tbody></table></div> : <EmptyState title="Aucune provision ce mois-ci" text="Ajoutez des achats prévus pour les distinguer des dépenses déjà réglées." />}</section><div className="provision-note"><CircleHelp size={16} /> Enregistrer un achat l’ajoute aux dépenses avec son prix réel et le retire du montant encore prévu.</div></>}
        {page === 'debts' && <><PageHeading eyebrow="REMBOURSEMENTS" title="Dettes" subtitle="Enregistrez les paiements mensuels à votre rythme." onAdd={() => startDialog('debt')} button="Ajouter une dette" /><div className="debt-grid">{data.debts.map((debt) => { const paid = paidOnDebt(debt); const remaining = Math.max(0, debt.amount - paid); const progress = debt.amount ? Math.min(100, paid / debt.amount * 100) : 0; return <article className="panel debt-card" key={debt.id}><div className="debt-top"><span className="debt-icon"><HandCoins size={19} /></span><div className="row-actions"><button className="icon-button" aria-label={`Modifier la dette ${debt.creditor}`} onClick={() => editDialog('debt', debt)}><Pencil size={16} /></button><button className="icon-button danger-hover" aria-label={`Supprimer la dette ${debt.creditor}`} onClick={() => removeRecord('debts', debt.id, debt.creditor)}><Trash2 size={16} /></button></div></div><span className="eyebrow">{debt.months ? `${debt.months} MOIS` : 'PAIEMENTS LIBRES'}</span><h2>{debt.creditor}</h2><strong className="debt-remaining">{ariary(remaining)}</strong><span className="muted-text">restant sur {ariary(debt.amount)}</span>{debtPayoffEstimate(debt, month) && <span className="debt-estimate">Au rythme récent : environ {debtPayoffEstimate(debt, month)} mois</span>}<div className="progress-track"><span style={{ width: `${progress}%` }} /></div><div className="progress-label"><span>Déjà payé</span><strong>{ariary(paid)}</strong></div><button className="button button-primary full-button" onClick={() => setDialog({ type: 'payment', debtId: debt.id, initial: { ...freshEntry('payment') } })}><Plus size={16} /> Ajouter un paiement</button>{debt.payments.length > 0 && <div className="payment-history"><span className="eyebrow">HISTORIQUE</span>{[...debt.payments].sort((a, b) => b.date.localeCompare(a.date)).map((payment) => <div className="payment-row" key={payment.id}><span>{dateName(payment.date)}<strong>{ariary(payment.amount)}</strong></span><span className="row-actions"><button className="icon-button small" aria-label="Modifier le paiement" onClick={() => setDialog({ type: 'payment', debtId: debt.id, initial: payment })}><Pencil size={14} /></button><button className="icon-button small danger-hover" aria-label="Supprimer le paiement" onClick={() => removePayment(debt.id, payment.id)}><Trash2 size={14} /></button></span></div>)}</div>}</article>; })}</div></>}
        {page === 'goals' && <><PageHeading eyebrow="PROJETS DE FAMILLE" title="Épargne & projets" subtitle="Définissez un montant mensuel. La cible peut être ajoutée plus tard." onAdd={() => startDialog('goal')} button="Ajouter un objectif" /><div className="goal-grid">{data.goals.map((goal) => { const progress = goal.targetAmount ? Math.min(100, goal.savedAmount / goal.targetAmount * 100) : null; return <article className="panel goal-card" key={goal.id}><div className="goal-card-top"><span className="goal-large-icon"><Target size={20} /></span><RowActions onEdit={() => editDialog('goal', goal)} onDelete={() => removeRecord('goals', goal.id, goal.name)} /></div><span className="eyebrow">PROJET D’ÉPARGNE</span><h2>{goal.name}</h2>{goal.note && <p className="goal-note">{goal.note}</p>}<div className="goal-amounts"><div><strong>{ariary(goal.savedAmount)}</strong><span>déjà épargné</span></div><div><strong>{ariary(goal.monthlyAmount)}</strong><span>par mois</span></div></div>{goal.targetAmount ? <><div className="progress-track"><span style={{ width: `${progress}%` }} /></div><div className="progress-label"><span>Objectif : {ariary(goal.targetAmount)}</span><strong>{Math.round(progress)} %</strong></div></> : <div className="goal-target-hint">Cible à définir au moment souhaité.</div>}<button className="button button-primary full-button" onClick={() => setDialog({ type: 'contribution', goalId: goal.id })}><Plus size={16} /> Ajouter une épargne</button></article>; })}</div><section className="panel backup-panel"><div><span className="backup-icon"><FileDown size={20} /></span><div><strong>Vos données restent privées</strong><span>Les informations sont enregistrées dans le stockage local de cet appareil.</span></div></div><div className="backup-actions"><button className="button button-outline" onClick={downloadBackup}><Download size={16} /> Exporter</button><label className="button button-outline file-button"><FileUp size={16} /> Restaurer<input type="file" accept="application/json,.json" onChange={restoreBackup} /></label></div></section></>}
      </main><footer className="app-footer">Un budget serein, en famille <span>·</span> Données conservées localement</footer></div>
    {notice && <div className="toast" role="status"><Check size={17} />{notice}<button aria-label="Fermer" onClick={() => setNotice('')}><X size={16} /></button></div>}
    {settingsOpen && <AppearanceDialog preferences={preferences} activeColor={activeColor} onChange={setPreferences} onClose={() => setSettingsOpen(false)} />}
    {dialog && dialog.type !== 'contribution' && <FormDialog key={`${dialog.type}-${dialog.initial?.id || dialog.debtId || 'new'}`} type={dialog.type} initial={dialog.initial} onClose={() => setDialog(null)} onSave={dialogSave} />}
    {dialog?.type === 'contribution' && <ContributionDialog goal={data.goals.find((goal) => goal.id === dialog.goalId)} onClose={() => setDialog(null)} onSave={(amount) => { setData((current) => ({ ...current, goals: current.goals.map((goal) => goal.id === dialog.goalId ? { ...goal, savedAmount: goal.savedAmount + amount } : goal) })); setDialog(null); setNotice('Épargne ajoutée.'); }} />}
  </div>;
}

function ContributionDialog({ goal, onClose, onSave }) {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="modal" role="dialog" aria-modal="true"><div className="modal-head"><div><span className="eyebrow">ÉPARGNE</span><h2>Ajouter à « {goal?.name} »</h2></div><button className="icon-button" onClick={onClose} aria-label="Fermer"><X size={20} /></button></div><form className="form-grid" onSubmit={(event) => { event.preventDefault(); const value = Number(amount); if (!Number.isFinite(value) || value <= 0) { setError('Saisis un montant supérieur à zéro.'); return; } onSave(value); }}><Field label="Montant ajouté (Ar)" type="number" min="1" value={amount} onChange={setAmount} required />{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="button button-quiet" onClick={onClose}>Annuler</button><button className="button button-primary"><Check size={17} /> Enregistrer</button></div></form></section></div>;
}

function AppearanceDialog({ preferences, activeColor, onChange, onClose }) {
  return <div className="modal-backdrop settings-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="modal appearance-modal" role="dialog" aria-modal="true" aria-labelledby="appearance-title"><div className="modal-head"><div><span className="eyebrow">PERSONNALISATION</span><h2 id="appearance-title">Apparence</h2><p className="appearance-subtitle">Choisissez un thème et une couleur pour votre espace.</p></div><button className="icon-button" onClick={onClose} aria-label="Fermer les paramètres"><X size={20} /></button></div><div className="appearance-section"><div className="appearance-label"><strong>Thème</strong><span>Vous pouvez suivre le réglage de votre appareil.</span></div><div className="theme-options" role="group" aria-label="Choisir un thème">{themes.map(({ id, label, icon: Icon }) => <button type="button" key={id} className={`theme-option ${preferences.theme === id ? 'selected' : ''}`} aria-pressed={preferences.theme === id} onClick={() => onChange((current) => ({ ...current, theme: id }))}><Icon size={18} /><span>{label}</span></button>)}</div></div><div className="appearance-section"><div className="appearance-label"><strong>Couleur d’accent</strong><span>La couleur des boutons, repères et indicateurs.</span></div><div className="color-options" role="group" aria-label="Choisir une couleur">{colorOptions.map((option) => <button type="button" key={option.id} className={`color-option ${preferences.color === option.id ? 'selected' : ''}`} aria-pressed={preferences.color === option.id} onClick={() => onChange((current) => ({ ...current, color: option.id }))}><span className="color-swatch" style={{ '--swatch-color': option.accent }}>{preferences.color === option.id && <Check size={15} />}</span><span>{option.label}</span></button>)}</div></div><div className="appearance-preview"><span className="eyebrow">APERÇU</span><div className="preview-card"><span className="preview-icon" style={{ background: activeColor.soft, color: activeColor.accent }}><CircleDollarSign size={17} /></span><span><small>Solde prévisionnel</small><strong>230 000 Ar</strong></span><span className="preview-badge" style={{ background: activeColor.accent }}>Ce mois</span></div></div><div className="appearance-footer"><span>Préférences enregistrées uniquement sur cet appareil.</span><button type="button" className="button button-quiet" onClick={() => onChange(defaultPreferences)}>Réinitialiser</button><button type="button" className="button button-primary" onClick={onClose}>Terminé</button></div></section></div>;
}

function MonthlyTrend({ series }) {
  const ceiling = Math.max(1, ...series.flatMap((item) => [item.incomes, item.expenses]));
  return <><div className="trend-legend"><span><i className="legend-income" /> Revenus</span><span><i className="legend-expense" /> Dépenses</span></div><div className="trend-chart">{series.map((item) => <div className="trend-month" key={item.key} title={`${monthName(item.key)} · revenus ${ariary(item.incomes)} · dépenses ${ariary(item.expenses)}`}><div className="trend-bars"><span className="trend-bar income" style={{ height: `${Math.max(3, item.incomes / ceiling * 100)}%` }} /><span className="trend-bar expense" style={{ height: `${Math.max(3, item.expenses / ceiling * 100)}%` }} /></div><small>{new Date(`${item.key}-02T12:00:00`).toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '')}</small></div>)}</div></>;
}
function SummaryCard({ label, amount, hint, icon: Icon, tone }) {
  return <article className="summary-card"><div className={`summary-icon ${tone}`}><Icon size={19} /></div><span className="summary-label">{label}</span><strong className="summary-amount">{ariary(amount)}</strong><span className="summary-hint">{hint}</span></article>;
}
function PageHeading({ eyebrow, title, subtitle, onAdd, button }) {
  return <div className="page-intro"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{subtitle}</p></div><button className="button button-primary" onClick={onAdd}><Plus size={17} /> {button}</button></div>;
}
function RowActions({ onEdit, onDelete }) {
  return <div className="row-actions"><button className="icon-button" aria-label="Modifier" onClick={onEdit}><Pencil size={15} /></button><button className="icon-button danger-hover" aria-label="Supprimer" onClick={onDelete}><Trash2 size={15} /></button></div>;
}
function TransactionRow({ record, onEdit, onDelete }) {
  return <div className="transaction-row"><span className="transaction-icon"><ShoppingBasket size={17} /></span><div className="transaction-main"><strong>{record.label}</strong><span>{record.category} · {dateName(record.date)}</span></div><strong className="transaction-amount">− {ariary(record.amount)}</strong><RowActions onEdit={onEdit} onDelete={onDelete} /></div>;
}
function Allocation({ label, amount, limit, color }) {
  const percent = Math.min(100, Math.round(amount / limit * 100));
  return <div className="allocation-item"><div className="allocation-label"><span>{label}</span><strong>{ariary(amount)} <small>/ {ariary(limit)}</small></strong></div><div className="allocation-track"><span style={{ width: `${percent}%`, background: color }} /></div></div>;
}

export default App;
