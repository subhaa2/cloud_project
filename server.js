const express = require('express');
const app = express();
const port = 8080;

// Import the new view routes file
const viewRoutes = require('./src/routes/views'); 

// Middleware Setup
app.use(express.static('public')); 
app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));

// View Routes
// By passing '/' as the path, all routes in viewRoutes (e.g., '/', '/newFlashcard')
// are now mapped directly from the application's root.
app.use('/', viewRoutes); 

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
