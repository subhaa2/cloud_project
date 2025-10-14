const express = require('express');
const app = express();
const port = 8080;

// Define a simple route for the root URL
app.get('/', (req, res) => {
  res.send('Hello World from Express.js!');
});

// Start the server
app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});