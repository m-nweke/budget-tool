import express, { Request, Response } from 'express';
import transactionRepository from '../repositories/transactionRepository';
import categoryRepository from '../repositories/categoryRepository';
import { requireRole, resolveScope, userCanAccessResource } from '../middleware/scoping';
import type { CreateTransactionDto, AuthUser, Category } from '../types';

const router = express.Router();

function computeApproval(amount: number, category: Category): { needsApproval: boolean; approved: boolean } {
  const needsApproval = category.approval_threshold !== null && amount > category.approval_threshold;
  return { needsApproval, approved: !needsApproval };
}

// An owner's access boundary is their tenant, not a department — "this
// department" would be a lie for that role, so approve/reject give each
// role the message that matches how it's actually scoped.
function notAuthorizedForResourceMessage(user: AuthUser): string {
  return user.role === 'owner' ? 'Not authorized for this tenant' : 'Not authorized for this department';
}

router.get('/', (req: Request, res: Response) => {
  const scope = resolveScope(req.user as AuthUser);
  res.json(transactionRepository.findAll(scope.departmentIds, scope.tenantId));
});

router.post('/', (req: Request<{}, {}, CreateTransactionDto>, res: Response) => {
  const { amount, date, description, category_id } = req.body;
  if (amount === undefined || amount === null || !date || !category_id) {
    return res.status(400).json({ error: 'amount, date, and category_id are required' });
  }
  const category = categoryRepository.findById(category_id);
  if (!category) {
    return res.status(400).json({ error: 'category_id does not reference an existing category' });
  }
  const user = req.user as AuthUser;
  if (!userCanAccessResource(user, category)) {
    return res.status(403).json({ error: 'Not authorized for this department' });
  }
  const { needsApproval, approved } = computeApproval(amount, category);
  const transaction = transactionRepository.create(
    { amount, date, description, category_id },
    user.id,
    needsApproval,
    approved
  );
  res.status(201).json(transaction);
});

router.put('/:id', (req: Request<{ id: string }, {}, CreateTransactionDto>, res: Response) => {
  const { amount, date, description, category_id } = req.body;
  if (amount === undefined || amount === null || !date || !category_id) {
    return res.status(400).json({ error: 'amount, date, and category_id are required' });
  }
  const existing = transactionRepository.findById(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'transaction not found' });
  }
  const category = categoryRepository.findById(category_id);
  if (!category) {
    return res.status(400).json({ error: 'category_id does not reference an existing category' });
  }
  const user = req.user as AuthUser;
  const existingCategory = categoryRepository.findById(existing.category_id);
  if (!existingCategory || !userCanAccessResource(user, existingCategory) || !userCanAccessResource(user, category)) {
    return res.status(403).json({ error: 'Not authorized for this department' });
  }
  // Only re-run the threshold check when amount or category actually
  // changed — those are the only inputs computeApproval depends on. A
  // no-op edit (e.g. fixing the description) must not touch
  // needs_approval/approved: recomputing unconditionally would silently
  // discard a head's approval or revive a rejected transaction back onto
  // the pending queue with no material change and no audit trail of the
  // fact that a decision got undone.
  const approvalChanged = amount !== existing.amount || category_id !== existing.category_id;
  let needsApproval = existing.needs_approval;
  let approved = existing.approved;
  if (approvalChanged) {
    const computed = computeApproval(amount, category);
    // A transaction that was explicitly rejected (needs_approval=false,
    // approved=false — the one state that can only be reached via
    // POST /:id/reject) never gets to flip straight to approved just
    // because the edited amount happens to fall back under threshold.
    // That would let anyone with edit access silently overturn a head's
    // rejection with no re-review. It goes back to pending instead, so a
    // head has to make a fresh decision on the changed amount.
    const wasRejected = !existing.needs_approval && !existing.approved;
    if (wasRejected && !computed.needsApproval) {
      needsApproval = true;
      approved = false;
    } else {
      needsApproval = computed.needsApproval;
      approved = computed.approved;
    }
  }
  const transaction = transactionRepository.update(
    req.params.id,
    { amount, date, description, category_id },
    needsApproval,
    approved
  );
  res.json(transaction);
});

// Head-or-owner-only: an employee who could freely delete any transaction
// (including one a head already approved or rejected) would undercut the
// audit trail reject() is specifically designed to preserve. Confirmed
// with the user before implementing — the tradeoff is employees can no
// longer delete their own mistaken entries, only heads can. An 'owner' can
// still delete freely — including a pending one, sidestepping approve/
// reject entirely — since there's no one else in a personal tenant whose
// review that would undercut.
router.delete(
  '/:id',
  requireRole('department_head', 'owner'),
  (req: Request<{ id: string }>, res: Response) => {
    const existing = transactionRepository.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'transaction not found' });
    }
    const category = categoryRepository.findById(existing.category_id);
    const user = req.user as AuthUser;
    if (!category || !userCanAccessResource(user, category)) {
      return res.status(403).json({ error: 'Not authorized for this department' });
    }
    transactionRepository.remove(req.params.id);
    res.status(204).end();
  }
);

// Head-or-owner, access-checked against the transaction's category
// (department for enterprise, tenant for personal). Reject clears the
// pending flag without deleting the row — it stays for audit visibility
// (see transactionRepository.approve). An enterprise head can't
// approve/reject their own submission — the whole point of requiring
// approval is a second set of eyes, and heads can create transactions too
// (see POST above). A personal tenant has no second person to provide that
// — its 'owner' can set an approval_threshold on their own categories (see
// routes/categories.ts) and must be able to clear their own pending
// transactions, so the self-check is inverted for 'owner' instead of
// skipped: it must be their own transaction, not someone else's.
router.post(
  '/:id/approve',
  requireRole('department_head', 'owner'),
  (req: Request<{ id: string }>, res: Response) => {
    const existing = transactionRepository.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'transaction not found' });
    }
    const user = req.user as AuthUser;
    const category = categoryRepository.findById(existing.category_id);
    if (!category || !userCanAccessResource(user, category)) {
      return res.status(403).json({ error: notAuthorizedForResourceMessage(user) });
    }
    if (user.role === 'owner') {
      // created_by is null for transactions the recurring-transaction
      // generator creates on an owner's behalf (see
      // recurringTransactionRepository.generateDue) — those aren't "someone
      // else's" transaction, just nobody's, so they must clear the same as
      // a self-created one or they'd be stuck in needs_approval forever.
      if (existing.created_by !== null && existing.created_by !== user.id) {
        return res.status(403).json({ error: 'Not authorized for this transaction' });
      }
    } else if (existing.created_by === user.id) {
      return res.status(403).json({ error: 'Cannot approve your own transaction' });
    }
    res.json(transactionRepository.approve(req.params.id, true));
  }
);

router.post(
  '/:id/reject',
  requireRole('department_head', 'owner'),
  (req: Request<{ id: string }>, res: Response) => {
    const existing = transactionRepository.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'transaction not found' });
    }
    const user = req.user as AuthUser;
    const category = categoryRepository.findById(existing.category_id);
    if (!category || !userCanAccessResource(user, category)) {
      return res.status(403).json({ error: notAuthorizedForResourceMessage(user) });
    }
    if (user.role === 'owner') {
      // See the matching comment in /approve above — created_by null means
      // recurring-generator-created, not "someone else's".
      if (existing.created_by !== null && existing.created_by !== user.id) {
        return res.status(403).json({ error: 'Not authorized for this transaction' });
      }
    } else if (existing.created_by === user.id) {
      return res.status(403).json({ error: 'Cannot reject your own transaction' });
    }
    res.json(transactionRepository.approve(req.params.id, false));
  }
);

export default router;
