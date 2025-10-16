const form = document.getElementById('signup-form');
const errorMessage = document.getElementById('error-message');

form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    const response = await fetch('http://localhost:3000/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
    });

    if (response.ok) {
        alert('✅Signup Successful!!!');
        window.location.href = 'login.html'; // Redirect to login
    } else if (response.status === 409) {
        errorMessage.textContent = 'This username is already taken. Please choose another.';
    } else {
        errorMessage.textContent = 'An error occurred during signup.';
    }
});