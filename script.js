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
const savedUser = localStorage.getItem('chatUser');
if (!savedUser) {
    window.location.href = 'login.html';
}
const currentUser = JSON.parse(savedUser);

// --- INITIALIZATION ---
loadUsersAndRestoreState();

// --- CORE FUNCTIONS ---
async function loadUsersAndRestoreState() {
    try {
        const response = await fetch(`${backendUrl}/users`);
        if (!response.ok) throw new Error('Failed to fetch users');
        const users = await response.json();

        UI.userList.innerHTML = '';
        users.forEach(user => {
            if (user.id === currentUser.id) return;
            const userElement = document.createElement('a');
            userElement.href = '#';
            userElement.id = `user-${user.id}`;
            userElement.className = 'list-group-item list-group-item-action';
            userElement.textContent = user.username;
            userElement.onclick = () => selectUserToChat(user);
            UI.userList.appendChild(userElement);
        });

        const urlParams = new URLSearchParams(window.location.search);
        const chatWithId = urlParams.get('chatWith');
        if (chatWithId) {
            const chatWithUser = users.find(u => u.id === parseInt(chatWithId));
            if (chatWithUser) selectUserToChat(chatWithUser);
        }
    } catch (error) {
        console.error("Error loading users:", error);
    }
}

async function selectUserToChat(user) {
    UI.userListContainer.classList.add('d-none');
    UI.chatContainer.classList.remove('d-none');
    UI.chatContainer.classList.add('d-flex');

    UI.chatHeader.textContent = `Chat with ${user.username}`;
    UI.messageArea.innerHTML = 'Loading messages...';

    document.querySelectorAll('#user-list .list-group-item').forEach(el => el.classList.remove('active'));
    const userElement = document.getElementById(`user-${user.id}`);
    if (userElement) userElement.classList.add('active');

    try {
        const response = await fetch(`${backendUrl}/chat/conversation/find-or-create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user1Id: currentUser.id, user2Id: user.id }),
        });
        if (!response.ok) throw new Error('Failed to find or create conversation');
        const conversation = await response.json();

        if (activeConversationId !== conversation.id) {
            activeConversationId = conversation.id;
            socket.emit('joinRoom', { conversationId: activeConversationId });
            await fetchMessageHistory(activeConversationId);
        }

        const url = new URL(window.location);
        url.searchParams.set('chatWith', user.id);
        history.pushState({}, '', url);

    } catch (error) {
        console.error("Error selecting user or fetching conversation:", error);
        UI.messageArea.innerHTML = 'Error loading chat.';
    }
}

async function fetchMessageHistory(conversationId) {
    UI.messageArea.innerHTML = '';
    try {
        const response = await fetch(`${backendUrl}/chat/conversation/${conversationId}`);
        if (!response.ok) throw new Error('Failed to fetch messages');
        const messages = await response.json();
        messages.forEach(displayMessage);
    } catch (error) {
        console.error("Error fetching message history:", error);
        UI.messageArea.innerHTML = 'Could not load message history.';
    }
}

// --- REAL-TIME & SENDING LOGIC ---
socket.on('receiveMessage', (message) => {
    if (message.conversation?.id === activeConversationId) {
        displayMessage(message);
    }
});

function sendMessage(contentOverride = null) {
    const content = contentOverride || UI.messageInput.value.trim();
    if (content && activeConversationId) {
        const messageData = {
            content: content,
            userId: currentUser.id,
            conversationId: activeConversationId
        };
        socket.emit('sendMessage', messageData);
        UI.messageInput.value = '';
    }
}

// --- EVENT LISTENERS ---
UI.backButton.addEventListener('click', () => {
    UI.userListContainer.classList.remove('d-none');
    UI.chatContainer.classList.add('d-none');
    UI.chatContainer.classList.remove('d-flex');
    document.querySelectorAll('#user-list .list-group-item').forEach(el => el.classList.remove('active'));
    UI.chatHeader.textContent = 'Select a user to chat';
    activeConversationId = null;
});

UI.sendButton.addEventListener('click', () => sendMessage());
UI.messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

UI.attachButton.addEventListener('click', () => UI.fileInput.click());

UI.logoutButton.addEventListener('click', () => {
    localStorage.removeItem('chatUser');
    window.location.href = 'login.html';
});

UI.fileInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file || !activeConversationId) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch(`${backendUrl}/chat/upload`, {
            method: 'POST',
            body: formData
        });
        if (!response.ok) throw new Error('File upload failed');
        const result = await response.json();
        sendMessage(result.url);
    } catch (error) {
        console.error("Error uploading file:", error);
        alert("File upload failed.");
    } finally {
        UI.fileInput.value = '';
    }
});

// --- DISPLAY LOGIC ---
function displayMessage(message) {
    const messageType = message.user.id === currentUser.id ? 'sent' : 'received';
    addMessageToUI(message.user.username, message.content, messageType);

    // ✅ Improvement 1: Ensure auto-scroll after rendering new message
    setTimeout(() => {
        UI.messageArea.scrollTop = UI.messageArea.scrollHeight;
    }, 50);
}

function addMessageToUI(sender, content, type) {
    const messageWrapper = document.createElement('div');
    messageWrapper.classList.add('d-flex', type === 'sent' ? 'justify-content-end' : 'justify-content-start', 'mb-3');

    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', type);

    const senderDiv = document.createElement('div');
    senderDiv.classList.add('message-sender', 'fw-bold');
    senderDiv.textContent = sender;

    const contentDiv = document.createElement('div');
    contentDiv.classList.add('message-content');

<<<<<<< HEAD
    // ✅ Detect media content (works for both absolute and relative URLs)
    const fileUrlPattern = /^https?:\/\/.+\.(jpeg|jpg|png|gif|webp|mp4|pdf|docx?|xlsx?)$/i;

    if (fileUrlPattern.test(content)) {
        if (content.match(/\.(jpeg|jpg|png|gif|webp)$/i)) {
            const img = document.createElement('img');
            img.src = content;
            img.alt = 'Uploaded file';
=======
    if (content.startsWith(`${backendUrl}/uploads/`)) {
        if (content.match(/\.(jpeg|jpg|gif|png|webp)$/i)) {
            const img = document.createElement('img');
            img.src = content;
>>>>>>> 19fcfe52fc7bd2929343b5bac145df6e0d4db60d
            img.style.maxWidth = '200px';
            img.style.borderRadius = '10px';
            img.style.cursor = 'pointer';
            img.onclick = () => window.open(content, '_blank');
            contentDiv.appendChild(img);
        } else if (content.match(/\.(mp4)$/i)) {
            const video = document.createElement('video');
            video.src = content;
            video.controls = true;
            video.style.maxWidth = '250px';
            video.style.borderRadius = '10px';
            contentDiv.appendChild(video);
        } else {
            const link = document.createElement('a');
            link.href = content;
<<<<<<< HEAD
            link.textContent = content.split('/').pop();
=======
            link.textContent = content.split('-').slice(2).join('-') || 'Download File';
>>>>>>> 19fcfe52fc7bd2929343b5bac145df6e0d4db60d
            link.target = '_blank';
            contentDiv.appendChild(link);
        }
    } else {
<<<<<<< HEAD
        // Normal text
=======
>>>>>>> 19fcfe52fc7bd2929343b5bac145df6e0d4db60d
        contentDiv.textContent = content;
    }

    messageDiv.appendChild(senderDiv);
    messageDiv.appendChild(contentDiv);
    messageWrapper.appendChild(messageDiv);

    UI.messageArea.appendChild(messageWrapper);
    UI.messageArea.scrollTop = UI.messageArea.scrollHeight;
}

<<<<<<< HEAD


=======
>>>>>>> 19fcfe52fc7bd2929343b5bac145df6e0d4db60d
// ✅ Improvement 2: Ensure layout correction on window resize (mobile ↔ desktop)
window.addEventListener('resize', () => {
    if (window.innerWidth >= 768) {
        UI.userListContainer.classList.remove('d-none');
        UI.chatContainer.classList.add('d-flex');
    }
});
