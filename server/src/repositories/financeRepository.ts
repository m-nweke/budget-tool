import { query, transaction } from '../db';
import { randomUUID, createHash } from 'node:crypto';
import type { Commitment, FinanceAccount, FinanceData, FinanceSettings, Movement } from '../types/finance';
import { addDays, cents, occurrences, todayIn, validDate } from '../services/financeForecast';

type Row = Record<string, unknown>;
const n = (row: Row, key: string) => Number(row[key]);
const s = (row: Row, key: string) => String(row[key] ?? '');
const money = (row: Row, key: string) => Math.round(n(row, key) * 100);
const nullableId = (row: Row, key: string) => row[key] == null ? null : n(row, key);
const rows = async (sql: string, values: unknown[] = []) => (await query<Row>(sql, values)).rows;
export class FinanceError extends Error { constructor(message: string, public status = 400) { super(message); } }

export async function assertAccount(tenantId: number, id: unknown): Promise<void> {
  if (!Number.isSafeInteger(id) || !(await rows('SELECT id FROM bank_accounts WHERE id=$1 AND tenant_id=$2', [id, tenantId])).length) throw new FinanceError('Account does not belong to this personal budget.');
}
export async function validateMovement(tenantId: number, value: Movement, asOf: string): Promise<void> {
  if (!value || !validDate(value.date) || value.date > asOf || !cents(value.amount_cents, true) || !['income','expense','transfer'].includes(value.kind)) throw new FinanceError('Use a valid settled date, positive integer USD cents, and income, expense or transfer.');
  if (value.description != null && (typeof value.description !== 'string' || value.description.length > 500)) throw new FinanceError('Description must be at most 500 characters.');
  await assertAccount(tenantId, value.account_id);
  if (value.kind === 'transfer') {
    await assertAccount(tenantId, value.transfer_account_id);
    if (value.account_id === value.transfer_account_id) throw new FinanceError('Transfer accounts must differ.');
  } else if (value.transfer_account_id != null) throw new FinanceError('Only transfers have a destination account.');
  if (value.category_id != null && !(await rows('SELECT id FROM categories WHERE id=$1 AND tenant_id=$2', [value.category_id,tenantId])).length) throw new FinanceError('Category does not belong to this budget.');
  if (value.commitment_key) {
    const split = value.commitment_key.lastIndexOf('@'); const key = value.commitment_key.slice(0, split); const date = value.commitment_key.slice(split + 1);
    const data = await loadFinance(tenantId); const commitment = data.commitments.find(c => c.key === key && c.active !== false);
    if (!commitment || !validDate(date) || !occurrences(commitment.next_date,commitment.frequency,date).includes(date) || (commitment.end_date && date > commitment.end_date)) throw new FinanceError('Payment must match an existing scheduled occurrence.');
    if (value.account_id !== commitment.account_id || (commitment.kind === 'income') !== (value.kind === 'income')) throw new FinanceError('Payment direction and funding account must match its commitment.');
    if (commitment.transfer_account_id && value.transfer_account_id !== commitment.transfer_account_id) throw new FinanceError('Contribution must use the scheduled destination account.');
  }
}

export async function loadFinance(tenantId: number): Promise<FinanceData> {
  const [accountsRaw,movementsRaw,settingsRaw,goalsRaw,bills,debts,investments,paychecks,splits,recurring,overrides,legacy,essential] = await Promise.all([
    rows('SELECT * FROM bank_accounts WHERE tenant_id=$1 ORDER BY id',[tenantId]),
    rows('SELECT * FROM transactions WHERE finance_tenant_id=$1 AND finance_kind IS NOT NULL ORDER BY date DESC,id DESC',[tenantId]),
    rows('SELECT * FROM finance_settings WHERE tenant_id=$1',[tenantId]),
    rows('SELECT * FROM savings_goals WHERE tenant_id=$1',[tenantId]),
    rows('SELECT * FROM bills WHERE tenant_id=$1 AND active=1',[tenantId]),
    rows('SELECT * FROM debts WHERE tenant_id=$1',[tenantId]),
    rows('SELECT * FROM investments WHERE tenant_id=$1 AND active=1',[tenantId]),
    rows('SELECT * FROM paychecks WHERE tenant_id=$1',[tenantId]),
    rows('SELECT ps.* FROM paycheck_splits ps JOIN paychecks p ON p.id=ps.paycheck_id WHERE p.tenant_id=$1',[tenantId]),
    rows('SELECT r.* FROM recurring_transactions r JOIN categories c ON c.id=r.category_id WHERE c.tenant_id=$1 AND r.active=1',[tenantId]),
    rows('SELECT * FROM finance_commitments WHERE tenant_id=$1',[tenantId]),
    rows('SELECT COUNT(*) AS count FROM transactions t JOIN categories c ON c.id=t.category_id WHERE c.tenant_id=$1 AND t.finance_kind IS NULL',[tenantId]),
    rows('SELECT * FROM categories WHERE tenant_id=$1 AND essential=TRUE',[tenantId]),
  ]);
  const settings: FinanceSettings = settingsRaw.length ? { timezone:s(settingsRaw[0],'timezone'),cushion_cents:n(settingsRaw[0],'cushion_cents'),essential_allowance_cents:n(settingsRaw[0],'essential_allowance_cents'),spending_account_ids:settingsRaw[0].spending_account_ids as number[] } : {timezone:'America/Chicago',cushion_cents:0,essential_allowance_cents:0,spending_account_ids:[]};
  const as_of = todayIn(settings.timezone); const warnings: string[] = [];
  const accounts: FinanceAccount[] = accountsRaw.map(a => ({id:n(a,'id'),name:s(a,'name'),type:s(a,'finance_type') || s(a,'type'),opening_balance_cents:a.opening_balance_cents == null ? money(a,'current_balance') : n(a,'opening_balance_cents'),opening_on:s(a,'opening_on'),balance_cents:0,spendable:a.spendable === true} as FinanceAccount));
  const movements: Movement[] = movementsRaw.map(m => ({id:n(m,'id'),date:s(m,'date'),kind:s(m,'finance_kind') as Movement['kind'],amount_cents:n(m,'amount_cents'),account_id:n(m,'account_id'),transfer_account_id:nullableId(m,'transfer_account_id'),category_id:nullableId(m,'category_id'),description:s(m,'description'),commitment_key:m.commitment_key == null ? null : s(m,'commitment_key')}));
  for (const account of accounts) account.balance_cents = account.opening_balance_cents + movements.filter(m => m.date > account.opening_on && m.date <= as_of).reduce((sum,m) => sum + (m.account_id === account.id ? (m.kind === 'income' ? m.amount_cents : -m.amount_cents) : 0) + (m.kind === 'transfer' && m.transfer_account_id === account.id ? m.amount_cents : 0),0);
  const commitments: Commitment[] = [];
  const monthly = (row: Row, kind: Commitment['kind'], source: string, amount: string, day: string) => {
    if (row[amount] == null || n(row,amount) <= 0 || row[day] == null) return;
    const anchor = new Date(`${as_of.slice(0,7)}-01T00:00:00Z`); const last = new Date(Date.UTC(anchor.getUTCFullYear(),anchor.getUTCMonth()+1,0)).getUTCDate();
    const next = `${as_of.slice(0,7)}-${String(Math.min(n(row,day),last)).padStart(2,'0')}`;
    // Current month's unpaid obligations remain overdue until explicitly matched.
    commitments.push({key:`${source}:${n(row,'id')}`,name:s(row,'name'),kind,amount_cents:money(row,amount),account_id:nullableId(row,'bank_account_id'),frequency:'monthly',next_date:s(row,'start_on') > next ? s(row,'start_on') : next,end_date:row.end_date == null ? null : s(row,'end_date')});
  };
  bills.forEach(b => monthly(b,'bill','bill','amount','due_day'));
  debts.forEach(d => monthly(d,'debt','debt','minimum_payment','due_day'));
  investments.forEach(i => monthly(i,'investment','investment','monthly_contribution','contribution_day'));
  for (const paycheck of paychecks) {
    const allocation = splits.filter(p => n(p,'paycheck_id') === n(paycheck,'id')); let allocated = 0;
    for (const split of allocation) {
      const amount = s(split,'split_type') === 'percentage' ? Math.round(money(paycheck,'amount') * n(split,'value') / 100) : money(split,'value'); allocated += amount;
      commitments.push({key:`paycheck:${n(paycheck,'id')}:${n(split,'id')}`,name:s(paycheck,'label'),kind:'income',amount_cents:amount,account_id:n(split,'bank_account_id'),frequency:s(paycheck,'frequency') as Commitment['frequency'],next_date:s(paycheck,'next_pay_date')});
    }
    if (!allocation.length || allocated !== money(paycheck,'amount')) warnings.push(`Allocate the full paycheck for ${s(paycheck,'label')}; allocated ${allocated} of ${money(paycheck,'amount')} cents.`);
  }
  for (const r of recurring) commitments.push({key:`recurring:${n(r,'id')}`,name:s(r,'description') || 'Recurring expense',kind:'expense',amount_cents:money(r,'amount'),account_id:null,frequency:s(r,'interval') as Commitment['frequency'],next_date:s(r,'next_run_date'),end_date:r.end_date == null ? null : s(r,'end_date')});
  const normalized = overrides.map(o => ({key:s(o,'key'),name:s(o,'name'),kind:s(o,'kind'),amount_cents:n(o,'amount_cents'),account_id:nullableId(o,'account_id'),transfer_account_id:nullableId(o,'transfer_account_id'),frequency:s(o,'frequency'),next_date:s(o,'next_date'),end_date:o.end_date == null ? null : s(o,'end_date'),active:o.active === true} as Commitment));
  for (const override of normalized) { const index = commitments.findIndex(c => c.key === override.key); if (index >= 0) commitments[index] = {...commitments[index],...override}; else commitments.push(override); }
  if (n(legacy[0],'count') > 0) warnings.push(`${n(legacy[0],'count')} existing expenses have no account mapping. Reconcile balances and map or remove these historical rows before relying on the forecast.`);
  if (essential.length) {
    const month = as_of.slice(0,7);
    settings.essential_allowance_cents = essential.reduce((total,c) => {
      const spent = movements.filter(m => m.kind === 'expense' && m.category_id === n(c,'id') && m.date.startsWith(month)).reduce((sum,m) => sum+m.amount_cents,0);
      // A mapped recurrence owns its fixed obligation; its category budget is not another bill.
      const scheduled = recurring.filter(r => n(r,'category_id') === n(c,'id')).reduce((sum,r) => sum+money(r,'amount'),0);
      return total + Math.max(0,money(c,'budgeted_amount') - spent - scheduled);
    },0);
  }
  return {as_of,accounts,movements,commitments,settings,warnings,goals:goalsRaw.map(g => ({id:n(g,'id'),name:s(g,'name'),target_cents:money(g,'target_amount'),saved_cents:money(g,'saved_amount'),account_id:nullableId(g,'bank_account_id'),target_date:g.target_date == null ? null : s(g,'target_date')}))};
}

export async function saveAccount(tenantId: number, input: FinanceAccount, id?: number) {
  if (!input || typeof input.name !== 'string' || !input.name.trim() || input.name.length > 100 || !['checking','savings','cash','credit_card','investment','other'].includes(input.type) || !cents(input.opening_balance_cents) || !validDate(input.opening_on) || input.opening_on > todayIn((await loadFinance(tenantId)).settings.timezone)) throw new FinanceError('Provide account name/type, valid snapshot date and integer opening cents.');
  if (input.spendable && !['checking','cash'].includes(input.type)) throw new FinanceError('Only checking and cash accounts can be spendable.');
  const legacyType = ['checking','savings'].includes(input.type) ? input.type : 'other';
  if (id) {
    await assertAccount(tenantId,id);
    return (await rows('UPDATE bank_accounts SET name=$1,type=$2,finance_type=$3,opening_balance_cents=$4,opening_on=$5,spendable=$6,current_balance=$7 WHERE id=$8 AND tenant_id=$9 RETURNING id',[input.name.trim(),legacyType,input.type,input.opening_balance_cents,input.opening_on,Boolean(input.spendable),input.opening_balance_cents/100,id,tenantId]))[0];
  }
  return (await rows('INSERT INTO bank_accounts (tenant_id,name,type,finance_type,opening_balance_cents,opening_on,spendable,current_balance) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',[tenantId,input.name.trim(),legacyType,input.type,input.opening_balance_cents,input.opening_on,Boolean(input.spendable),input.opening_balance_cents/100]))[0];
}

export async function saveMovement(tenantId: number, userId: number, input: Movement, id?: number, importKey?: string) {
  await validateMovement(tenantId,input,(await loadFinance(tenantId)).as_of);
  const values = [input.amount_cents/100,input.date,input.description ?? '',input.category_id ?? null,userId,tenantId,input.kind,input.amount_cents,input.account_id,input.transfer_account_id ?? null,input.commitment_key ?? null];
  if (id) {
    const result = await rows('UPDATE transactions SET amount=$1,date=$2,description=$3,category_id=$4,created_by=$5,finance_tenant_id=$6,finance_kind=$7,amount_cents=$8,account_id=$9,transfer_account_id=$10,commitment_key=$11 WHERE id=$12 AND finance_tenant_id=$6 RETURNING id',[...values,id]);
    if (!result.length) throw new FinanceError('Movement not found.',404); return result[0];
  }
  return (await rows('INSERT INTO transactions(amount,date,description,category_id,created_by,finance_tenant_id,finance_kind,amount_cents,account_id,transfer_account_id,commitment_key,approved,needs_approval,import_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,1,0,$12) ON CONFLICT (finance_tenant_id,import_key) WHERE import_key IS NOT NULL DO NOTHING RETURNING id',[...values,importKey ?? null]))[0];
}
export async function saveCommitment(tenantId: number, input: Commitment, key?: string) {
  if (!input || typeof input.name !== 'string' || !input.name.trim() || input.name.length>100 || !cents(input.amount_cents,true) || !validDate(input.next_date) || !['income','bill','debt','savings','investment','expense'].includes(input.kind) || !['once','weekly','biweekly','semimonthly','monthly'].includes(input.frequency) || (input.end_date != null && (!validDate(input.end_date) || input.end_date<input.next_date))) throw new FinanceError('Provide a name, kind, positive cents and valid schedule.');
  await assertAccount(tenantId,input.account_id);
  if (input.transfer_account_id != null) { await assertAccount(tenantId,input.transfer_account_id); if(input.account_id === input.transfer_account_id) throw new FinanceError('Contribution accounts must differ.'); }
  if (key && !(await loadFinance(tenantId)).commitments.some(c => c.key === key)) throw new FinanceError('Commitment not found.',404);
  key = key ?? `custom:${randomUUID()}`;
  await rows('INSERT INTO finance_commitments(tenant_id,key,name,kind,amount_cents,account_id,transfer_account_id,frequency,next_date,end_date,active) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,TRUE) ON CONFLICT(tenant_id,key) DO UPDATE SET name=EXCLUDED.name,kind=EXCLUDED.kind,amount_cents=EXCLUDED.amount_cents,account_id=EXCLUDED.account_id,transfer_account_id=EXCLUDED.transfer_account_id,frequency=EXCLUDED.frequency,next_date=EXCLUDED.next_date,end_date=EXCLUDED.end_date,active=TRUE',[tenantId,key,input.name.trim(),input.kind,input.amount_cents,input.account_id,input.transfer_account_id ?? null,input.frequency,input.next_date,input.end_date ?? null]);
  return {key};
}
export async function disableCommitment(tenantId: number, key: string) {
  const found = (await loadFinance(tenantId)).commitments.find(c => c.key===key);
  if (!found) throw new FinanceError('Commitment not found.',404);
  // Source-backed entries remain visible to show they have been explicitly superseded.
  if (!found.account_id) {
    await rows('INSERT INTO finance_commitments(tenant_id,key,name,kind,amount_cents,frequency,next_date,active) VALUES($1,$2,$3,$4,$5,$6,$7,FALSE) ON CONFLICT(tenant_id,key) DO UPDATE SET active=FALSE',[tenantId,key,found.name,found.kind,found.amount_cents,found.frequency,found.next_date]);
  } else { await saveCommitment(tenantId,found,key); await rows('UPDATE finance_commitments SET active=FALSE WHERE tenant_id=$1 AND key=$2',[tenantId,key]); }
}
export async function saveSettings(tenantId: number, value: FinanceSettings) {
  try { todayIn(value.timezone); } catch { throw new FinanceError('Use an IANA timezone.'); }
  if (!cents(value.cushion_cents) || value.cushion_cents<0 || !cents(value.essential_allowance_cents) || value.essential_allowance_cents<0 || !Array.isArray(value.spending_account_ids) || new Set(value.spending_account_ids).size !== value.spending_account_ids.length) throw new FinanceError('Use nonnegative integer reserves and unique spending account IDs.');
  const data = await loadFinance(tenantId);
  for (const id of value.spending_account_ids) if (!data.accounts.some(a => a.id===id && a.spendable && ['checking','cash'].includes(a.type))) throw new FinanceError('Select only spendable checking/cash accounts in this budget.');
  await rows('INSERT INTO finance_settings(tenant_id,timezone,cushion_cents,essential_allowance_cents,spending_account_ids) VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT(tenant_id) DO UPDATE SET timezone=EXCLUDED.timezone,cushion_cents=EXCLUDED.cushion_cents,essential_allowance_cents=EXCLUDED.essential_allowance_cents,spending_account_ids=EXCLUDED.spending_account_ids',[tenantId,value.timezone,value.cushion_cents,value.essential_allowance_cents,JSON.stringify(value.spending_account_ids)]);
}
export async function previewImport(tenantId: number, input: {rows: Movement[]; batch_key: string}) {
  if (!Array.isArray(input.rows) || !input.rows.length || input.rows.length>1000 || typeof input.batch_key !== 'string' || !input.batch_key.trim() || input.batch_key.length>100) throw new FinanceError('Use 1–1000 normalized rows and a stable statement batch key.');
  const data = await loadFinance(tenantId); const existing = await rows('SELECT import_key,date,finance_kind,amount_cents,account_id,transfer_account_id,description FROM transactions WHERE finance_tenant_id=$1',[tenantId]);
  const result = [];
  for (let index=0;index<input.rows.length;index++) {
    const row = input.rows[index]; const errors: string[] = [];
    try { await validateMovement(tenantId,row,data.as_of); } catch (error) { errors.push((error as Error).message); }
    const fingerprint = createHash('sha256').update(JSON.stringify([row.date,row.kind,row.amount_cents,row.account_id,row.transfer_account_id ?? null,row.description ?? ''])).digest('hex');
    // Position preserves legitimate identical twins within the same statement.
    const import_key = createHash('sha256').update(`${input.batch_key}:${index}:${fingerprint}`).digest('hex');
    const repeated = existing.some(e => e.import_key===import_key);
    const possible_duplicate = !repeated && existing.some(e => s(e,'date')===row.date && s(e,'finance_kind')===row.kind && n(e,'amount_cents')===row.amount_cents && n(e,'account_id')===row.account_id && nullableId(e,'transfer_account_id')===(row.transfer_account_id ?? null) && s(e,'description')===(row.description ?? ''));
    result.push({row:index+1,valid:errors.length===0,errors,duplicate:repeated,possible_duplicate,import_key,movement:row});
  }
  return {rows:result,can_import:result.every(r => r.valid && !r.possible_duplicate)};
}
export async function importMovements(tenantId: number,userId: number,input: {rows: Movement[];batch_key:string;confirm_possible_duplicates?:boolean}) {
  return transaction(async () => {
    const preview = await previewImport(tenantId,input);
    if (preview.rows.some(r => !r.valid) || (!input.confirm_possible_duplicates && preview.rows.some(r => r.possible_duplicate))) throw new FinanceError('Resolve invalid rows and explicitly confirm possible duplicates before importing.');
    let imported=0; let skipped=0;
    for (const row of preview.rows) { if(row.duplicate) {skipped++;continue;} const saved = await saveMovement(tenantId,userId,row.movement,undefined,row.import_key); if(saved) imported++; else skipped++; }
    return {imported,skipped};
  });
}

export async function reconcile(tenantId:number,id:number,balance:number,date:string) {
  if(!cents(balance)||!validDate(date)||date>(await loadFinance(tenantId)).as_of) throw new FinanceError('Use integer balance cents and a valid settled date.');
  await assertAccount(tenantId,id);
  await rows('UPDATE bank_accounts SET opening_balance_cents=$1,opening_on=$2,current_balance=$3 WHERE tenant_id=$4 AND id=$5',[balance,date,balance/100,tenantId,id]);
}
export async function deleteMovement(tenantId:number,id:number) { const result=await rows('DELETE FROM transactions WHERE finance_tenant_id=$1 AND id=$2 RETURNING id',[tenantId,id]); if(!result.length) throw new FinanceError('Movement not found.',404); }
export async function markEssential(tenantId:number,id:number,essential:boolean) { if(typeof essential !== 'boolean') throw new FinanceError('Essential must be boolean.');const result=await rows('UPDATE categories SET essential=$1 WHERE id=$2 AND tenant_id=$3 RETURNING id',[essential,id,tenantId]);if(!result.length) throw new FinanceError('Category not found.',404); }
