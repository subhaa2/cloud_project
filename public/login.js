// Get role selection buttons
const roleButtons = document.querySelectorAll('.role-btn');
let selectedRole = '';

// Handle role selection
roleButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        // Remove selected class from all buttons
        roleButtons.forEach(b => b.classList.remove('selected'));
        // Add selected class to clicked button
        btn.classList.add('selected');
        selectedRole = btn.dataset.role;
    });
});

// Handle form submission
document.getElementById('loginForm').addEventListener('submit', (e) => {
    e.preventDefault();

    const username = document.getElementById('username').value;

    if (!selectedRole) {
        alert('Please select whether you are a teacher or student');
        return;
    }

    if (!username) {
        alert('Please enter your username');
        return;
    }

    // Save to localStorage for now
      localStorage.setItem('userRole', selectedRole);
      localStorage.setItem('username', username);



    // Redirect to appropriate dashboard
    if (selectedRole === 'teacher') {
        window.location.href = 'main.html';
    } else {
        const redirectUrl = `/allDecks?username=${encodeURIComponent(username)}`;
        window.location.href = redirectUrl;;
    }
});


