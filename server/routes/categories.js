const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const categories = db.prepare('SELECT * FROM categories').all();
  res.json(categories);
});

router.post('/', (req, res) => {
  const { name, budgeted_amount } = req.body;
  if (!name || budgeted_amount === undefined || budgeted_amount === null) {
    return res.status(400).json({ error: 'name and budgeted_amount are required' });
  }
  const result = db
    .prepare('INSERT INTO categories (name, budgeted_amount) VALUES (?, ?)')
    .run(name, budgeted_amount);
  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(category);
});

router.put('/:id', (req, res) => {
  const { name, budgeted_amount } = req.body;
  if (!name || budgeted_amount === undefined || budgeted_amount === null) {
    return res.status(400).json({ error: 'name and budgeted_amount are required' });
  }
  const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'category not found' });
  }
  db.prepare('UPDATE categories SET name = ?, budgeted_amount = ? WHERE id = ?').run(
    name,
    budgeted_amount,
    req.params.id
  );
  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  res.json(category);
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'category not found' });
  }
  const { count } = db
    .prepare('SELECT COUNT(*) AS count FROM transactions WHERE category_id = ?')
    .get(req.params.id);
  if (count > 0) {
    return res.status(400).json({ error: 'cannot delete a category that has transactions' });
  }
  db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

module.exports = router;
