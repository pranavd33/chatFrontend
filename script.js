const backendUrl = 'https://chatbackend-1-w5o6.onrender.com';
const socket = io(backendUrl);

// --- GLOBAL VARIABLES ---
let activeConversationId = null;
const UI = {
  userList: document.getElementById('user-list'),
  chatContainer: document.getElementById('chat-container'),
  chatHeader: document.getElementById('chat-header'),
  messageArea: document.getElementById('message-area'),
  messageInput: document.getElementById('message-input'),
  sendButton: document.getElementById('send-button'),
  attachButton: document.getElementById('attach-button'),
  fileInput: document.getElementById('file-input'),
  logoutButton: document.getElementById('logout-button'),
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
  const response = await fetch(`${backendUrl}/users`);
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
    if (chatWithUser) {
        selectUserToChat(chatWithUser);
    }
  }
}

async function selectUserToChat(user) {
  UI.chatHeader.textContent = `Chat with ${user.username}`;
  UI.chatContainer.classList.remove('d-none');
  UI.messageArea.innerHTML = 'Loading messages...';

  document.querySelectorAll('#user-list .list-group-item').forEach(el => el.classList.remove('active'));

  const userElement = document.getElementById(`user-${user.id}`);
  if (userElement) {
    userElement.classList.add('active');
  }

  const response = await fetch(`${backendUrl}/chat/conversation/find-or-create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user1Id: currentUser.id, user2Id: user.id }),
  });
  const conversation = await response.json();

  if (activeConversationId !== conversation.id) {
    activeConversationId = conversation.id;
    socket.emit('joinRoom', { conversationId: activeConversationId });
    await fetchMessageHistory(activeConversationId);
  }

  const url = new URL(window.location);
  url.searchParams.set('chatWith', user.id);
  history.pushState({}, '', url);
}

async function fetchMessageHistory(conversationId) {
  UI.messageArea.innerHTML = '';
  const response = await fetch(`${backendUrl}/chat/conversation/${conversationId}`);
  const messages = await response.json();
  messages.forEach(displayMessage);
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
      conversationId: activeConversationId,
    };
    socket.emit('sendMessage', messageData);
    UI.messageInput.value = '';
  }
}

// --- EVENT LISTENERS ---
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
  const response = await fetch(`${backendUrl}/chat/upload`, { method: 'POST', body: formData });
  const result = await response.json();
  sendMessage(result.url);
});

// --- DISPLAY LOGIC ---
function displayMessage(message) {
  const messageType = message.user.id === currentUser.id ? 'sent' : 'received';
  addMessageToUI(message.user.username, message.content, messageType);
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

  if (content.match(/\.(jpeg|jpg|gif|png)$/)) {
    const img = document.createElement('img');
    img.src = content;
    img.style.maxWidth = '200px';
    img.style.borderRadius = '10px';
    contentDiv.appendChild(img);
  } else if (content.startsWith(backendUrl)) {
    const link = document.createElement('a');
    link.href = content;
    link.textContent = content.split('-').slice(2).join('-') || 'Download File';
    link.target = '_blank';
    contentDiv.appendChild(link);
  } else {
    contentDiv.textContent = content;
  }

  messageDiv.appendChild(senderDiv);
  messageDiv.appendChild(contentDiv);
  messageWrapper.appendChild(messageDiv);

  UI.messageArea.appendChild(messageWrapper);
  UI.messageArea.scrollTop = UI.messageArea.scrollHeight;
}