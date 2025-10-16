const form = document.getElementById('login-form');
const errorMessage = document.getElementById('error-message');

form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    // ✅ USE YOUR LIVE BACKEND URL HERE
    const backendUrl = 'https://chatbackend-1-w5o6.onrender.com';
    const response = await fetch(`${backendUrl}/auth/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
    });

    if (response.ok) {
        const user = await response.json();
        localStorage.setItem('chatUser', JSON.stringify(user));
        
        // This line is now redundant if your main script.js uses localStorage,
        // but it doesn't hurt to keep it.
        window.location.href = `index.html`;

    } else {
        errorMessage.textContent = 'Login failed. Please check your username and password.';
    }
});