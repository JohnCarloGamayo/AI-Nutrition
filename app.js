// DOM references
const chat = document.getElementById('chat');
const inputField = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const form = document.getElementById('inputForm');
const themeToggle = document.getElementById('themeToggle');
const menuToggle = document.getElementById('menuToggle');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');
const currentChatTitle = document.getElementById('currentChatTitle');
const chatContainer = document.getElementById('chatContainer');

// --- Theme handling ---
function initTheme() {
  if (localStorage.getItem('theme') === 'dark' || 
      (window.matchMedia('(prefers-color-scheme: dark)').matches && !localStorage.getItem('theme'))) {
    document.body.classList.add('dark-theme');
  }
}

function toggleTheme() {
  document.body.classList.toggle('dark-theme');
  localStorage.setItem('theme', document.body.classList.contains('dark-theme') ? 'dark' : 'light');
}

// --- Mobile sidebar handling ---
function toggleSidebar() {
  sidebar.classList.toggle('open');
  overlay.classList.toggle('active');
  document.body.classList.toggle('sidebar-open');
}

function closeSidebar() {
  sidebar.classList.remove('open');
  overlay.classList.remove('active');
  document.body.classList.remove('sidebar-open');
}

// --- Auto-resize textarea ---
function autoResizeTextarea() {
  inputField.style.height = 'auto';
  inputField.style.height = (inputField.scrollHeight) + 'px';
}

// --- Chat session management ---
let chatSessions = [];
let currentChatId = null;
let conversation = [];

// Load all chat sessions from localStorage
function loadChatSessions() {
  chatSessions = JSON.parse(localStorage.getItem('ai_chat_sessions') || '[]');
  renderChatList();
}

// Save all chat sessions to localStorage
function saveChatSessions() {
  localStorage.setItem('ai_chat_sessions', JSON.stringify(chatSessions));
}

// Create a new chat session
function createNewChat() {
  const id = Date.now().toString();
  const name = `New Chat`;
  const session = { id, name, conversation: [] };
  chatSessions.unshift(session);
  saveChatSessions();
  selectChat(id);
}

// Select a chat session by id
function selectChat(id) {
  currentChatId = id;
  const session = chatSessions.find(s => s.id === id);
  conversation = session ? session.conversation : [];
  
  // Update the chat title
  currentChatTitle.textContent = session ? session.name : 'AI Assistant';
  
  renderConversation();
  renderChatList();
  
  // Close sidebar on mobile after selection
  if (window.innerWidth <= 900) {
    closeSidebar();
  }
}

// Render the chat list in the sidebar
function renderChatList() {
  const chatList = document.getElementById('chatList');
  chatList.innerHTML = '';
  
  chatSessions.forEach(session => {
    const li = document.createElement('li');
    li.textContent = session.name;
    if (session.id === currentChatId) li.classList.add('active');
    li.onclick = () => selectChat(session.id);
    chatList.appendChild(li);
  });
}

// Render the conversation in the chat area
function renderConversation() {
  chat.innerHTML = '';
  
  let currentSender = null;
  let currentGroup = null;
  
  conversation.forEach((msg, index) => {
    // Check if we need to start a new message group
    if (msg.sender !== currentSender) {
      currentSender = msg.sender;
      currentGroup = document.createElement('div');
      currentGroup.classList.add('message-group', currentSender);
      chat.appendChild(currentGroup);
    }
    
    appendMessageToGroup(currentGroup, msg.content, msg.sender, msg.error, false);
  });
  
  scrollToBottom();
}

// Save the current conversation to the selected session
function saveCurrentConversation() {
  const session = chatSessions.find(s => s.id === currentChatId);
  if (session) {
    session.conversation = conversation;
    saveChatSessions();
  }
}

// Append a message to a message group
function appendMessageToGroup(group, content, sender = 'bot', error = false, save = true) {
  // Create message bubble
  const messageBubble = document.createElement('div');
  messageBubble.classList.add('message', sender);
  
  if (error) {
    messageBubble.classList.add('error');
    messageBubble.innerHTML = `
      <div class="error-content">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
          <path d="M12 9v4"></path>
          <path d="M12 17h.01"></path>
        </svg>
        ${content}
      </div>
      <button class="retry-button" id="retryBtn">Retry</button>
    `;
  } else if (sender === 'bot') {
    // Format bot messages with markdown-like syntax
    messageBubble.innerHTML = formatBotMessage(content);
  } else {
    messageBubble.textContent = content;
  }
  
  group.appendChild(messageBubble);
  
  // Add timestamp below message
  const metaDiv = document.createElement('div');
  metaDiv.classList.add('message-meta');
  metaDiv.textContent = getTimeString();
  group.appendChild(metaDiv);
  
  // Add click handler for retry button if it's an error message
  if (error) {
    const retryBtn = messageBubble.querySelector('#retryBtn');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        group.remove();
        sendMessage(lastUserMessage);
      });
    }
  }
  
  // Save to conversation history
  if (save) {
    conversation.push({ content, sender, error });
    saveCurrentConversation();
  }
  
  scrollToBottom();
  
  // Generate chat title for new conversations
  if (
    save &&
    conversation.length === 2 && // first user + first bot
    conversation[0].sender === 'user' &&
    conversation[1].sender === 'bot'
  ) {
    generateChatTitle(conversation).then(title => {
      const session = chatSessions.find(s => s.id === currentChatId);
      if (session && title) {
        session.name = title;
        currentChatTitle.textContent = title;
        saveChatSessions();
        renderChatList();
      }
    });
  }
}

// Helper to format bot messages
function formatBotMessage(content) {
  return content
    .replace(/`{3}(\w*)\n([\s\S]*?)\n`{3}/g, '<pre><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
}

// Create a new message group
function createMessageGroup(sender) {
  const group = document.createElement('div');
  group.classList.add('message-group', sender);
  chat.appendChild(group);
  return group;
}

// Add a message to the chat
function appendMessage(content, sender = 'bot', error = false, save = true) {
  let group;
  
  // Check if we need to create a new group or use the last one
  const lastGroup = chat.lastElementChild;
  
  if (lastGroup && lastGroup.classList.contains(sender)) {
    group = lastGroup;
  } else {
    group = createMessageGroup(sender);
  }
  
  appendMessageToGroup(group, content, sender, error, save);
}

// Show typing indicator
function showTypingIndicator() {
  const indicator = document.createElement('div');
  indicator.id = 'typingIndicator';
  indicator.classList.add('typing-indicator');
  indicator.innerHTML = `
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
  `;
  
  // Create or get the bot message group
  let group = chat.lastElementChild;
  if (!group || !group.classList.contains('bot')) {
    group = createMessageGroup('bot');
  }
  
  group.appendChild(indicator);
  scrollToBottom();
}

// Remove typing indicator
function removeTypingIndicator() {
  const indicator = document.getElementById('typingIndicator');
  if (indicator) {
    indicator.remove();
  }
}

// Store the last user message for retry functionality
let lastUserMessage = '';

// Send message to AI
async function sendMessage(userText = null) {
  userText = userText || inputField.value.trim();
  if (!userText) return;
  
  lastUserMessage = userText;
  
  sendBtn.disabled = true;
  inputField.disabled = true;
  
  appendMessage(userText, 'user');
  inputField.value = '';
  inputField.style.height = 'auto';
  
  showTypingIndicator();
  
  try {
    const response = await fetch(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer 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',
          'HTTP-Referer': 'https://www.sitename.com',
          'X-Title': 'SiteName',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'microsoft/mai-ds-r1:free',
          messages: [
            { role: 'system', content: "You are a helpful nutrition specialist. Answer all questions with expertise in nutrition, diet, and healthy eating. I am developed by John Carlo Gamayo" },
            { role: 'user', content: userText }
          ],
        }),
      }
    );
    
    const data = await response.json();
    
    removeTypingIndicator();
    
    if (data.choices?.[0]?.message?.content) {
      appendMessage(data.choices[0].message.content, 'bot');
    } else {
      appendMessage('Sorry, I could not generate a response. Please try again.', 'bot', true);
    }
  } catch (error) {
    removeTypingIndicator();
    appendMessage('Unable to connect to the AI service. Please check your internet connection and try again.', 'bot', true);
    console.error('Error:', error);
  } finally {
    sendBtn.disabled = false;
    inputField.disabled = false;
    inputField.focus();
  }
}

// Generate a short title for the chat based on the first user message and AI response
async function generateChatTitle(messages) {
  // Use the first user message and first bot reply for context
  const prompt = `Summarize this conversation in 3-5 words for a chat title:\nUser: ${messages[0]?.content}\nAI: ${messages[1]?.content}`;
  
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer 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',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'microsoft/mai-ds-r1:free',
        messages: [
          { role: 'system', content: "You are a helpful assistant that creates short chat titles." },
          { role: 'user', content: prompt }
        ],
      }),
    });
    
    const data = await response.json();
    return data.choices?.[0]?.message?.content?.replace(/["\n]/g, '').trim() || "New Chat";
  } catch (error) {
    console.error('Error generating title:', error);
    return "New Chat";
  }
}

// Get current time formatted as HH:MM
function getTimeString() {
  const now = new Date();
  return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Scroll chat to bottom
function scrollToBottom() {
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Welcome message
function showWelcomeMessage() {
  setTimeout(() => {
    if (conversation.length === 0) {
      appendMessage("👋 Hi! I'm your nutrition AI assistant. How can I help with your diet and nutrition questions today?", 'bot');
    }
  }, 500);
}

// --- Event Listeners ---
// Form submission
form.addEventListener('submit', (e) => {
  e.preventDefault();
  sendMessage();
});

// Auto-resize textarea as user types
inputField.addEventListener('input', autoResizeTextarea);

// Handle keyboard shortcuts
inputField.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// Theme toggle
themeToggle.addEventListener('click', toggleTheme);

// Sidebar toggle for mobile
menuToggle.addEventListener('click', toggleSidebar);
overlay.addEventListener('click', closeSidebar);

// New Chat button
document.getElementById('newChatBtn').addEventListener('click', createNewChat);

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  // Initialize theme
  initTheme();
  
  // Load chat sessions
  loadChatSessions();
  
  // Create a new chat if none exist
  if (chatSessions.length === 0) {
    createNewChat();
  } else {
    selectChat(chatSessions[0].id);
  }
  
  // Show welcome message if this is a new chat
  showWelcomeMessage();
  
  // Focus input field
  inputField.focus();
});