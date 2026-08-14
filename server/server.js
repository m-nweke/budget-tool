const path = require('path');
const express = require('express');

const categoriesRouter = require('./routes/categories');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use('/api/categories', categoriesRouter);

const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));

app.use((req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
