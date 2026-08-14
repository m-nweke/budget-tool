const express = require('express');
const categoryRepository = require('../repositories/categoryRepository');

const router = express.Router();

router.get('/', (req, res) => {
  res.json(categoryRepository.findAll());
});

router.post('/', (req, res) => {
  const { name, budgeted_amount } = req.body;
  if (!name || budgeted_amount === undefined || budgeted_amount === null) {
    return res.status(400).json({ error: 'name and budgeted_amount are required' });
  }
  const category = categoryRepository.create({ name, budgeted_amount });
  res.status(201).json(category);
});

router.put('/:id', (req, res) => {
  const { name, budgeted_amount } = req.body;
  if (!name || budgeted_amount === undefined || budgeted_amount === null) {
    return res.status(400).json({ error: 'name and budgeted_amount are required' });
  }
  const existing = categoryRepository.findById(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'category not found' });
  }
  const category = categoryRepository.update(req.params.id, { name, budgeted_amount });
  res.json(category);
});

router.delete('/:id', (req, res) => {
  const existing = categoryRepository.findById(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'category not found' });
  }
  if (categoryRepository.countTransactionsFor(req.params.id) > 0) {
    return res.status(400).json({ error: 'cannot delete a category that has transactions' });
  }
  categoryRepository.remove(req.params.id);
  res.status(204).end();
});

module.exports = router;
