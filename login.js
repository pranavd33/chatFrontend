const form = document.getElementById('login-form');
const errorMessage = document.getElementById('error-message');

form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    const response = await fetch('http://localhost:3000/auth/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
    });

    if (response.ok) {
        const user = await response.json();
        
        // Store the full user object in local storage
        localStorage.setItem('chatUser', JSON.stringify(user));
        
        // **THE FIX:** Redirect to index.html and add the user's ID to the URL
        window.location.href = `index.html?user=${user.id}`;

    } else {
        errorMessage.textContent = 'Login failed. Please check your username and password.';
    }
});