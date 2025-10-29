// Use your live backend URL here
const backendUrl = 'https://chatbackend-1-w5o6.onrender.com';
const socket = io(backendUrl);

// --- GLOBAL VARIABLES ---
let activeConversationId = null;
const UI = {
    userListContainer: document.getElementById('user-list-container'),
    userList: document.getElementById('user-list'),
    chatContainer: document.getElementById('chat-container'),
    chatHeader: document.getElementById('chat-header'),
    messageArea: document.getElementById('message-area'),
    messageInput: document.getElementById('message-input'),
    sendButton: document.getElementById('send-button'),
    attachButton: document.getElementById('attach-button'),
    fileInput: document.getElementById('file-input'),
    logoutButton: document.getElementById('logout-button'),
    backButton: document.getElementById('back-button') // Mobile back button
};

// --- AUTHENTICATION ---
// Get logged-in user details from browser storage
const savedUser = localStorage.getItem('chatUser');
if (!savedUser) {
    // If no user is logged in, redirect to login page
    window.location.href = 'login.html';
}
const currentUser = JSON.parse(savedUser);

// --- INITIALIZATION ---
// Load users and restore previous chat session on page load
loadUsersAndRestoreState();

// --- CORE FUNCTIONS ---

/**
 * Fetches the list of users from the backend and displays them.
 * Also checks the URL to see if a chat should be automatically loaded.
 */
async function loadUsersAndRestoreState() {
    try {
        const response = await fetch(`${backendUrl}/users`);
        if (!response.ok) throw new Error('Failed to fetch users');
        const users = await response.json();

        UI.userList.innerHTML = ''; // Clear existing list
        users.forEach(user => {
            // Don't show the current user in the list of people to chat with
            if (user.id === currentUser.id) return;

            // Create a clickable element for each user
            const userElement = document.createElement('a');
            userElement.href = '#';
            userElement.id = `user-${user.id}`; // Unique ID for highlighting
            userElement.className = 'list-group-item list-group-item-action';
            userElement.textContent = user.username;
            userElement.onclick = () => selectUserToChat(user); // Set action on click
            UI.userList.appendChild(userElement);
        });

        // Check if the URL has a 'chatWith' parameter from a previous session
        const urlParams = new URLSearchParams(window.location.search);
        const chatWithId = urlParams.get('chatWith');
        if (chatWithId) {
            // Find the user object corresponding to the ID in the URL
            const chatWithUser = users.find(u => u.id === parseInt(chatWithId));
            if (chatWithUser) {
                // If found, automatically select that user's chat
                selectUserToChat(chatWithUser);
            }
        }
    } catch (error) {
        console.error("Error loading users:", error);
        // You might want to display an error message to the user here
    }
}

/**
 * Handles selecting a user from the list to start or continue a chat.
 * @param {object} user - The user object that was clicked.
 */
async function selectUserToChat(user) {
    // --- MOBILE VIEWPORT LOGIC ---
    // On mobile, hide the user list and show the chat window
    UI.userListContainer.classList.add('d-none');
    UI.chatContainer.classList.remove('d-none');
    UI.chatContainer.classList.add('d-flex');
    // --- END MOBILE LOGIC ---

    UI.chatHeader.textContent = `Chat with ${user.username}`;
    UI.messageArea.innerHTML = 'Loading messages...'; // Placeholder text

    // Highlight the selected user in the list
    document.querySelectorAll('#user-list .list-group-item').forEach(el => el.classList.remove('active'));
    const userElement = document.getElementById(`user-${user.id}`);
    if (userElement) userElement.classList.add('active');

    try {
        // Ask the backend to find or create a 1-on-1 conversation
        const response = await fetch(`${backendUrl}/chat/conversation/find-or-create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user1Id: currentUser.id, user2Id: user.id }),
        });
        if (!response.ok) throw new Error('Failed to find or create conversation');
        const conversation = await response.json();

        // If this is a new or different chat than the one currently active
        if (activeConversationId !== conversation.id) {
            activeConversationId = conversation.id;
            // Join the specific WebSocket room for this chat
            socket.emit('joinRoom', { conversationId: activeConversationId });
            // Load the message history for this chat
            await fetchMessageHistory(activeConversationId);
        }

        // Update the browser URL to remember the active chat (without reloading page)
        const url = new URL(window.location);
        url.searchParams.set('chatWith', user.id);
        history.pushState({}, '', url);

    } catch (error) {
        console.error("Error selecting user or fetching conversation:", error);
        UI.messageArea.innerHTML = 'Error loading chat.';
    }
}

/**
 * Fetches the message history for a specific conversation from the backend.
 * @param {number} conversationId - The ID of the conversation to load.
 */
async function fetchMessageHistory(conversationId) {
    UI.messageArea.innerHTML = ''; // Clear previous messages
    try {
        const response = await fetch(`${backendUrl}/chat/conversation/${conversationId}`);
        if (!response.ok) throw new Error('Failed to fetch messages');
        const messages = await response.json();
        messages.forEach(displayMessage); // Display each message
    } catch (error) {
        console.error("Error fetching message history:", error);
        UI.messageArea.innerHTML = 'Could not load message history.';
    }
}

// --- REAL-TIME & SENDING LOGIC ---

// Listen for new messages coming from the WebSocket server
socket.on('receiveMessage', (message) => {
    // Only display the message if it belongs to the currently active chat
    if (message.conversation?.id === activeConversationId) {
        displayMessage(message);
    }
});

/**
 * Sends a text message or a file URL to the backend via WebSocket.
 * @param {string|null} contentOverride - Optional. If provided, sends this content instead of the input box value (used for file URLs).
 */
function sendMessage(contentOverride = null) {
    const content = contentOverride || UI.messageInput.value.trim();
    // Only send if there's content and a chat is active
    if (content && activeConversationId) {
        const messageData = {
            content: content,
            userId: currentUser.id,
            conversationId: activeConversationId
        };
        // Emit the message event to the server
        socket.emit('sendMessage', messageData);
        UI.messageInput.value = ''; // Clear the input box
    }
}

// --- EVENT LISTENERS ---

// ** MOBILE "Back" button listener **
UI.backButton.addEventListener('click', () => {
    // Show the user list
    UI.userListContainer.classList.remove('d-none');
    // Hide the chat window
    UI.chatContainer.classList.add('d-none');
    UI.chatContainer.classList.remove('d-flex');
    // De-select any active user
    document.querySelectorAll('#user-list .list-group-item').forEach(el => el.classList.remove('active'));
    UI.chatHeader.textContent = 'Select a user to chat';
    activeConversationId = null;
});

// Send message when Send button is clicked
UI.sendButton.addEventListener('click', () => sendMessage());

// Send message when Enter key is pressed in the input box
UI.messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

// Open the hidden file input when the attach button is clicked
UI.attachButton.addEventListener('click', () => UI.fileInput.click());

// Handle logout button click
UI.logoutButton.addEventListener('click', () => {
    localStorage.removeItem('chatUser'); // Clear login state
    window.location.href = 'login.html'; // Go back to login page
});

// Handle file selection
UI.fileInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file || !activeConversationId) return; // Need a file and active chat

    const formData = new FormData();
    formData.append('file', file);

    try {
        // Upload the file to the backend's /chat/upload endpoint
        const response = await fetch(`${backendUrl}/chat/upload`, {
            method: 'POST',
            body: formData
        });
        if (!response.ok) throw new Error('File upload failed');
        const result = await response.json();
        // Send the returned file URL as a message
        sendMessage(result.url);
    } catch (error) {
        console.error("Error uploading file:", error);
        alert("File upload failed.");
    } finally {
        // Reset file input to allow uploading the same file again if needed
        UI.fileInput.value = '';
    }
});

// --- DISPLAY LOGIC ---

/**
 * Takes a message object and determines if it was sent or received.
 * @param {object} message - The message object from the backend.
 */
function displayMessage(message) {
    // Check if the message's user ID matches the currently logged-in user's ID
    const messageType = message.user.id === currentUser.id ? 'sent' : 'received';
    // Add the message bubble to the UI
    addMessageToUI(message.user.username, message.content, messageType);
}

/**
 * Creates and appends a message bubble to the chat area.
 * @param {string} sender - The username of the message sender.
 * @param {string} content - The message content (text or URL).
 * @param {string} type - 'sent' or 'received'.
 */
function addMessageToUI(sender, content, type) {
    const messageWrapper = document.createElement('div');
    messageWrapper.classList.add('d-flex', type === 'sent' ? 'justify-content-end' : 'justify-content-start', 'mb-3');

    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', type); // Applies 'message sent' or 'message received' class

    const senderDiv = document.createElement('div');
    senderDiv.classList.add('message-sender', 'fw-bold');
    senderDiv.textContent = sender;

    const contentDiv = document.createElement('div');
    contentDiv.classList.add('message-content');

    // Check if the content is an uploaded file URL from our backend
    if (content.startsWith(`${backendUrl}/uploads/`)) {
        // Check if it's a common image type
        if (content.match(/\.(jpeg|jpg|gif|png|webp)$/i)) { // Added webp and case-insensitive match
            const img = document.createElement('img');
            img.src = content;
            img.style.maxWidth = '200px'; // Limit image size
            img.style.borderRadius = '10px';
            img.style.cursor = 'pointer';
            img.onclick = () => window.open(content, '_blank'); // Open full image in new tab
            contentDiv.appendChild(img);
        } else {
            // Otherwise, create a download link
            const link = document.createElement('a');
            link.href = content;
            // Try to extract original filename for display
            link.textContent = content.split('-').slice(2).join('-') || 'Download File';
            link.target = '_blank'; // Open in new tab
            contentDiv.appendChild(link);
        }
    } else {
        // If it's not an upload URL, display it as plain text
        contentDiv.textContent = content;
    }

    messageDiv.appendChild(senderDiv);
    messageDiv.appendChild(contentDiv);
    messageWrapper.appendChild(messageDiv);

    UI.messageArea.appendChild(messageWrapper);
    // Auto-scroll to the bottom of the chat area
    UI.messageArea.scrollTop = UI.messageArea.scrollHeight;
}