import { useMemo, useState } from 'react';
import { Banknote, Plus, Pencil, Trash2, Tag, Calendar } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { SearchBar } from '@/components/ui/SearchBar';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Input, Textarea } from '@/components/ui/Input';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { useExpenseStore } from '@/store/expenseStore';
import { useLanguage } from '@/hooks/useLanguage';
import { usePermissions } from '@/hooks/usePermissions';
import { formatCurrency, formatDate, todayISO, matchesDateFilter, type DateFilter } from '@/lib/utils';
import { toast } from '@/components/ui/Toast';
import type { Expense } from '@/types';

export default function ExpensesPage() {
  const { t, language } = useLanguage();
  const { can } = usePermissions();
  const { expenses, addExpense, updateExpense, deleteExpense } = useExpenseStore();

  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', description: '', amount: 0, date: todayISO() });

  const filtered = useMemo(
    () => expenses.filter((e) => e.name.toLowerCase().includes(search.toLowerCase()) && matchesDateFilter(e.date, dateFilter)),
    [expenses, search, dateFilter]
  );
  const total = useMemo(() => filtered.reduce((s, e) => s + e.amount, 0), [filtered]);

  const openCreate = () => { setEditing(null); setForm({ name: '', description: '', amount: 0, date: todayISO() }); setFormOpen(true); };
  const openEdit = (e: Expense) => { setEditing(e); setForm({ name: e.name, description: e.description, amount: e.amount, date: e.date }); setFormOpen(true); };

  const handleSubmit = () => {
    if (!form.name.trim() || form.amount <= 0) { toast.error('Nom et montant requis'); return; }
    if (editing) { updateExpense(editing.id, { ...form, amount: Number(form.amount) }); toast.success('Dépense modifiée'); }
    else { addExpense({ ...form, amount: Number(form.amount) }); toast.success('Dépense créée'); }
    setFormOpen(false);
  };

  return (
    <div>
      <PageHeader title={t('expenses')} icon={<Banknote size={24} />} subtitle={`Total: ${formatCurrency(total)}`}
        actions={can('expenses', 'create') && <Button variant="gold" onClick={openCreate}><Plus size={18} /> {t('newExpense')}</Button>} />

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex-1 min-w-[200px]"><SearchBar value={search} onChange={setSearch} placeholder={t('search')} /></div>
        <Select value={dateFilter} onChange={(e) => setDateFilter(e.target.value as DateFilter)}
          options={[{ value: 'all', label: t('all') }, { value: 'today', label: t('today') }, { value: 'week', label: t('week') }, { value: 'month', label: t('month') }]} className="max-w-[180px]" />
      </div>

      {filtered.length === 0 ? <EmptyState message={t('noData')} /> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((e, i) => (
            <Card key={e.id} index={i} hoverable className="flex flex-col">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-display font-semibold text-text-primary flex items-center gap-2"><Tag size={16} className="text-caramel" /> {e.name}</h3>
                <span className="text-xs text-text-muted flex items-center gap-1"><Calendar size={11} /> {formatDate(e.date, language)}</span>
              </div>
              <p className="text-sm text-text-secondary mb-3 line-clamp-2">{e.description}</p>
              <p className="text-2xl font-bold text-rose-deep tabular mb-1">{formatCurrency(e.amount)}</p>
              {e.createdBy && <p className="text-xs text-text-muted mb-3">{t('createdBy')}: {e.createdBy}</p>}
              <div className="flex gap-2 mt-auto">
                {can('expenses', 'edit') && <Button size="sm" variant="secondary" className="flex-1" onClick={() => openEdit(e)}><Pencil size={14} /> {t('edit')}</Button>}
                {can('expenses', 'delete') && <Button size="sm" variant="ghost" onClick={() => setDeleteId(e.id)}><Trash2 size={14} className="text-rose-deep" /></Button>}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? t('edit') : t('newExpense')} size="sm">
        <div className="space-y-4">
          <Input label={`${t('name')} *`} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Textarea label={t('description')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Input label={`${t('amount')} (DA) *`} type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
            <Input label={`${t('date')} *`} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setFormOpen(false)}>{t('cancel')}</Button>
            <Button variant="gold" onClick={handleSubmit}>{t('save')}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => { if (deleteId) { deleteExpense(deleteId); toast.success('Dépense supprimée'); } }} />
    </div>
  );
}
