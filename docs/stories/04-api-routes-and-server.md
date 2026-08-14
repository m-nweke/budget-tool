# Story 4: API Routes, Middleware & Server Entry — How It Works

## Concept: route = validate, delegate, respond

```ts
categoriesRouter.post('/', (req, res) => {
  const { name, budgeted_amount, department_id, start_on } = req.body;

  if (typeof name !== 'string' || !name.trim()) throw new HttpError(400, 'name is required');
  if (typeof budgeted_amount !== 'number' || budgeted_amount < 0) {
    throw new HttpError(400, 'budgeted_amount must be a non-negative number');
  }

  const category = categoryRepo.create({ name, budgeted_amount, department_id, start_on });
  res.status(201).json(category);
});
```

No SQL, no business logic beyond input shape validation. Express 4 catches synchronous `throw`s inside route handlers automatically and forwards them to error-handling middleware — that's why `throw new HttpError(...)` works without an explicit `try/catch` in every handler.

## Concept: the category delete guard, reading as two named checks

```ts
categoriesRouter.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = categoryRepo.findById(id);
  if (!existing) throw new HttpError(404, 'Category not found');

  const txCount = categoryRepo.countTransactionsForCategory(id);
  const recurringCount = categoryRepo.countRecurringForCategory(id);
  if (txCount > 0 || recurringCount > 0) {
    throw new HttpError(400, 'Cannot delete a category that still has transactions or recurring templates referencing it');
  }

  categoryRepo.remove(id);
  res.status(204).send();
});
```

`countRecurringForCategory` counts *all* recurring templates referencing the category, active or cancelled — a cancelled template still has rows in the table (soft-delete via `active = 0`, not a real `DELETE`), so it still blocks category deletion. This is intentional: the recurring template's own history (including its now-inactive config) still references the category by foreign key.

## Concept: middleware scoping — `generateDueMiddleware` on three routers, not global

```ts
app.use('/api/categories', categoriesRouter);                                    // no generateDue
app.use('/api/transactions', generateDueMiddleware, transactionsRouter);
app.use('/api/recurring-transactions', generateDueMiddleware, recurringTransactionsRouter);
app.use('/api/dashboard', generateDueMiddleware, dashboardRouter);
```

Categories never need due-occurrence generation to run first — nothing about a category read depends on whether a recurring transaction has fired. Attaching the middleware per-router (rather than once globally with `app.use(generateDueMiddleware)`) keeps that cost off requests that don't need it.

## Concept: server.ts middleware order

```ts
app.use(express.json());
app.use('/api/categories', categoriesRouter);
app.use('/api/transactions', generateDueMiddleware, transactionsRouter);
app.use('/api/recurring-transactions', generateDueMiddleware, recurringTransactionsRouter);
app.use('/api/dashboard', generateDueMiddleware, dashboardRouter);

app.use(express.static(clientDist));          // 1. serve built Vue assets
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));  // 2. JSON 404 for API typos
app.use((_req, res) => res.sendFile(path.join(clientDist, 'index.html')));      // 3. SPA fallback (Vue Router refresh survives)
app.use(errorHandler);                         // 4. always last
```

The order is load-bearing: a request to `/api/nonsense` falls through the API routers (no match), then `express.static` (no such static file), then hits the `/api` 404 handler *before* reaching the SPA catch-all — so it gets clean JSON, not `index.html`. A request to `/transactions` (direct page refresh) falls through everything else and hits the SPA fallback, which serves `index.html` and lets Vue Router take over client-side.
