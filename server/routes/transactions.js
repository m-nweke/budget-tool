const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const transactions = db
    .prepare('SELECT id, amount, date, description, category_id FROM transactions')
    .all();
  res.json(transactions);
});

router.post('/', (req, res) => {
  const { amount, date, description, category_id } = req.body;
  if (amount === undefined || amount === null || !date || !category_id) {
    return res.status(400).json({ error: 'amount, date, and category_id are required' });
  }
  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(category_id);
  if (!category) {
    return res.status(400).json({ error: 'category_id does not reference an existing category' });
  }
  const result = db
    .prepare(
      'INSERT INTO transactions (amount, date, description, category_id, needs_approval, approved) VALUES (?, ?, ?, ?, 0, 0)'
    )
    .run(amount, date, description || null, category_id);
  const transaction = db
    .prepare('SELECT id, amount, date, description, category_id FROM transactions WHERE id = ?')
    .get(result.lastInsertRowid);
  res.status(201).json(transaction);
});

router.put('/:id', (req, res) => {
  const { amount, date, description, category_id } = req.body;
  if (amount === undefined || amount === null || !date || !category_id) {
    return res.status(400).json({ error: 'amount, date, and category_id are required' });
  }
  const existing = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'transaction not found' });
  }
  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(category_id);
  if (!category) {
    return res.status(400).json({ error: 'category_id does not reference an existing category' });
  }
  db.prepare(
    'UPDATE transactions SET amount = ?, date = ?, description = ?, category_id = ? WHERE id = ?'
  ).run(amount, date, description || null, category_id, req.params.id);
  const transaction = db
    .prepare('SELECT id, amount, date, description, category_id FROM transactions WHERE id = ?')
    .get(req.params.id);
  res.json(transaction);
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'transaction not found' });
  }
  db.prepare('DELETE FROM transactions WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

module.exports = router;
