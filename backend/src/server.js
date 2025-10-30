const express = require('express');
const app = express();
const port = 5000; // Changed this to match the Dockerfile and compose

// Define a simple route for the root URL
app.get('/', (req, res) => {
  res.send('Hello World from Express.js!');
});

// Start the server
app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});