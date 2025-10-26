const express = require('express');
const path = require('path');
const app = express();
const port = 8080;

// Serve static files from the public directory
app.use(express.static('public'));

// Parse JSON bodies
app.use(express.json());

// Define a simple route for the root URL
//app.get('/', (req, res) => {
//  res.send('Hello World from Express.js!');
//});

// Start the server
app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});