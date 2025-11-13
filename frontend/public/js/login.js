const roleButtons = document.querySelectorAll('.role-btn');
let selectedRole = '';

function selectRole(btn) {
  roleButtons.forEach((b) => b.classList.remove('selected'));
  btn.classList.add('selected');
  selectedRole = btn.dataset.role;
}

roleButtons.forEach((btn) => {
  btn.addEventListener('click', () => selectRole(btn));
});

async function parseJsonResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.toLowerCase().includes('application/json')) {
    return response.json();
  }

  const text = await response.text();
  return {
    success: false,
    error: text || `Request failed with status ${response.status}`
  };
}

document.addEventListener('DOMContentLoaded', async () => {
  const loginForm = document.getElementById('loginForm');
  const emailInput = document.getElementById('email');
  const schoolSelect = document.getElementById('schoolSelect');
  const statusMessage = document.getElementById('statusMessage');
  const submitBtn = document.getElementById('submitBtn');

  try {
    await refreshSchoolOptions(schoolSelect);
  } catch (error) {
    showStatus(statusMessage, error.message, 'error');
  }

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearStatus(statusMessage);

    const email = emailInput.value.trim();
    const schoolId = schoolSelect.value;

    if (!selectedRole) {
      showStatus(statusMessage, 'Select whether you are a teacher or a student.', 'error');
      return;
    }

    if (!email) {
      showStatus(statusMessage, 'Please enter your email address.', 'error');
      return;
    }

    if (!schoolId) {
      showStatus(statusMessage, 'Please choose your school.', 'error');
      return;
    }

    submitBtn.disabled = true;
    const originalButtonContent = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span>Signing in…</span>';

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          role: selectedRole,
          email,
          schoolId
        })
      });

      const data = await parseJsonResponse(response);

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to sign in');
      }

      const user = data.user;
      localStorage.setItem('sessionUser', JSON.stringify(user));
      localStorage.setItem('userRole', user.role);
      localStorage.setItem('userEmail', user.email);
      localStorage.setItem('schoolId', user.schoolId);

      showStatus(statusMessage, 'Login successful! Redirecting…', 'success');

      setTimeout(() => {
        if (user.role === 'teacher') {
          window.location.href = 'teacher-dashboard.html';
        } else {
          window.location.href = 'student-dashboard.html';
        }
      }, 500);
    } catch (error) {
      showStatus(statusMessage, error.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalButtonContent;
    }
  });
});