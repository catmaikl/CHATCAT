class TelegramMessenger {
    constructor() {
        this.socket = null;
        this.currentUser = null;
        this.currentChat = null;
        this.chats = [];
        this.contacts = [];
        this.isConnected = false;
        
        this.initializeApp();
    }

    initializeApp() {
        this.checkAuthentication();
        this.initializeEventListeners();
        this.initializeSocket();
    }

    async checkAuthentication() {
        try {
            const response = await fetch('/api/user');
            if (response.ok) {
                const userData = await response.json();
                this.currentUser = userData;
                this.showMainInterface();
                this.loadInitialData();
            } else {
                this.showAuthInterface();
            }
        } catch (error) {
            console.error('Authentication check failed:', error);
            this.showAuthInterface();
        }
    }

    showAuthInterface() {
        // Здесь будет код для показа интерфейса аутентификации
        document.getElementById('loadingScreen').style.display = 'none';
        // Показываем форму входа/регистрации
    }

    showMainInterface() {
        document.getElementById('loadingScreen').style.display = 'none';
        document.getElementById('mainInterface').style.display = 'flex';
        this.updateUserInfo();
    }

    updateUserInfo() {
        if (this.currentUser) {
            document.getElementById('userName').textContent = 
                `${this.currentUser.first_name} ${this.currentUser.last_name || ''}`.trim();
        }
    }

    initializeEventListeners() {
        // Кнопки боковой панели
        document.getElementById('newChatBtn').addEventListener('click', () => this.showNewChatModal());
        document.getElementById('settingsBtn').addEventListener('click', () => this.showSettingsModal());
        
        // Вкладки
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // Ввод сообщения
        document.getElementById('messageInput').addEventListener('input', (e) => this.handleMessageInput(e));
        document.getElementById('sendMessageBtn').addEventListener('click', () => this.sendMessage());
        document.getElementById('messageInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Модальные окна
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => this.hideModals());
        });

        document.getElementById('modalOverlay').addEventListener('click', (e) => {
            if (e.target === document.getElementById('modalOverlay')) {
                this.hideModals();
            }
        });

        // Настройки
        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());
        document.getElementById('saveSettingsBtn').addEventListener('click', () => this.saveSettings());
    }

    initializeSocket() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            this.isConnected = true;
            console.log('Connected to server');
        });

        this.socket.on('disconnect', () => {
            this.isConnected = false;
            console.log('Disconnected from server');
        });

        this.socket.on('new_message', (data) => {
            this.handleNewMessage(data);
        });

        this.socket.on('user_typing', (data) => {
            this.showTypingIndicator(data.user_id);
        });

        this.socket.on('user_stopped_typing', (data) => {
            this.hideTypingIndicator(data.user_id);
        });

        this.socket.on('user_online', (data) => {
            this.updateUserOnlineStatus(data.user_id, true);
        });

        this.socket.on('user_offline', (data) => {
            this.updateUserOnlineStatus(data.user_id, false);
        });
    }

    async loadInitialData() {
        await this.loadChats();
        await this.loadContacts();
    }

    async loadChats() {
        try {
            const response = await fetch('/api/chats');
            const data = await response.json();
            
            if (data.status === 'success') {
                this.chats = data.chats;
                this.renderChatsList();
            }
        } catch (error) {
            console.error('Failed to load chats:', error);
        }
    }

    async loadContacts() {
        try {
            const response = await fetch('/api/contacts');
            const data = await response.json();
            
            if (data.status === 'success') {
                this.contacts = data.contacts;
            }
        } catch (error) {
            console.error('Failed to load contacts:', error);
        }
    }

    renderChatsList() {
        const chatsList = document.getElementById('chatsList');
        chatsList.innerHTML = '';

        this.chats.forEach(chat => {
            const chatElement = this.createChatElement(chat);
            chatsList.appendChild(chatElement);
        });
    }

    createChatElement(chat) {
        const div = document.createElement('div');
        div.className = 'chat-item';
        div.dataset.chatId = chat.id;
        
        const lastMessage = chat.last_message ? 
            (chat.last_message.sender_id === this.currentUser.id ? 'Вы: ' : '') + 
            chat.last_message.content : 'Нет сообщений';
            
        const time = chat.last_message ? 
            this.formatTime(new Date(chat.last_message.created_at)) : '';
            
        div.innerHTML = `
            <div class="chat-avatar">
                <img src="${chat.avatar || '/static/images/default-chat.png'}" alt="${chat.name}">
            </div>
            <div class="chat-details">
                <div class="chat-header-row">
                    <div class="chat-name">${chat.name}</div>
                    <div class="chat-time">${time}</div>
                </div>
                <div class="chat-last-message">${lastMessage}</div>
                ${chat.unread_count > 0 ? `<div class="chat-unread">${chat.unread_count}</div>` : ''}
            </div>
        `;
        
        div.addEventListener('click', () => this.selectChat(chat.id));
        
        return div;
    }

    async selectChat(chatId) {
        // Убираем выделение у всех чатов
        document.querySelectorAll('.chat-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // Выделяем выбранный чат
        const chatElement = document.querySelector(`.chat-item[data-chat-id="${chatId}"]`);
        if (chatElement) {
            chatElement.classList.add('active');
        }
        
        this.currentChat = this.chats.find(chat => chat.id === chatId);
        
        // Обновляем заголовок чата
        document.getElementById('currentChatName').textContent = this.currentChat.name;
        document.getElementById('currentChatAvatar').innerHTML = 
            `<img src="${this.currentChat.avatar || '/static/images/default-chat.png'}" alt="${this.currentChat.name}">`;
        
        // Загружаем сообщения
        await this.loadChatMessages(chatId);
        
        // Присоединяемся к комнате чата
        if (this.socket) {
            this.socket.emit('join_chat', { chat_id: chatId });
        }
    }

    async loadChatMessages(chatId) {
        try {
            const response = await fetch(`/api/chats/${chatId}/messages`);
            const data = await response.json();
            
            if (data.status === 'success') {
                this.renderMessages(data.messages);
            }
        } catch (error) {
            console.error('Failed to load messages:', error);
        }
    }

    renderMessages(messages) {
        const messagesList = document.getElementById('messagesList');
        messagesList.innerHTML = '';

        messages.forEach(message => {
            const messageElement = this.createMessageElement(message);
            messagesList.appendChild(messageElement);
        });

        this.scrollToBottom();
    }

    createMessageElement(message) {
        const div = document.createElement('div');
        div.className = `message ${message.sender_id === this.currentUser.id ? 'sent' : 'received'}`;
        
        const time = this.formatTime(new Date(message.created_at));
        
        div.innerHTML = `
            <div class="message-bubble">
                <div class="message-content">${this.escapeHtml(message.content)}</div>
                <div class="message-time">${time}</div>
                ${message.sender_id === this.currentUser.id ? 
                    `<div class="message-status">${message.is_read ? '✓✓' : '✓'}</div>` : ''}
            </div>
        `;
        
        return div;
    }

    async sendMessage() {
        const input = document.getElementById('messageInput');
        const content = input.value.trim();
        
        if (!content || !this.currentChat) return;
        
        try {
            const response = await fetch(`/api/chats/${this.currentChat.id}/send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    content: content,
                    content_type: 'text'
                })
            });
            
            const data = await response.json();
            
            if (data.status === 'success') {
                input.value = '';
                this.adjustTextareaHeight(input);
                
                // Сообщение будет добавлено через WebSocket
            }
        } catch (error) {
            console.error('Failed to send message:', error);
        }
    }

    handleNewMessage(data) {
        if (data.chat_id === this.currentChat?.id) {
            const messageElement = this.createMessageElement(data);
            document.getElementById('messagesList').appendChild(messageElement);
            this.scrollToBottom();
        }
        
        // Обновляем список чатов
        this.loadChats();
    }

    handleMessageInput(e) {
        this.adjustTextareaHeight(e.target);
        
        if (this.currentChat && this.socket) {
            this.socket.emit('typing_start', { chat_id: this.currentChat.id });
            
            clearTimeout(this.typingTimeout);
            this.typingTimeout = setTimeout(() => {
                this.socket.emit('typing_stop', { chat_id: this.currentChat.id });
            }, 1000);
        }
    }

    adjustTextareaHeight(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }

    showTypingIndicator(userId) {
        const user = this.contacts.find(contact => contact.id === userId);
        if (user) {
            document.getElementById('typingText').textContent = `${user.first_name} печатает...`;
            document.getElementById('typingIndicator').style.display = 'flex';
        }
    }

    hideTypingIndicator(userId) {
        document.getElementById('typingIndicator').style.display = 'none';
    }

    showNewChatModal() {
        document.getElementById('modalOverlay').style.display = 'flex';
        document.getElementById('newChatModal').style.display = 'block';
        this.renderNewChatContacts();
    }

    showSettingsModal() {
        document.getElementById('modalOverlay').style.display = 'flex';
        document.getElementById('settingsModal').style.display = 'block';
        this.loadUserSettings();
    }

    hideModals() {
        document.getElementById('modalOverlay').style.display = 'none';
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
    }

    renderNewChatContacts() {
        const contactsList = document.getElementById('newChatContacts');
        contactsList.innerHTML = '';

        this.contacts.forEach(contact => {
            const div = document.createElement('div');
            div.className = 'contact-item';
            div.innerHTML = `
                <div class="contact-avatar">
                    <img src="${contact.avatar || '/static/images/default-avatar.png'}" alt="${contact.first_name}">
                </div>
                <div class="contact-details">
                    <div class="contact-name">${contact.first_name} ${contact.last_name || ''}</div>
                    <div class="contact-status">${contact.is_online ? 'online' : 'offline'}</div>
                </div>
            `;
            
            div.addEventListener('click', () => this.startChatWithContact(contact.id));
            contactsList.appendChild(div);
        });
    }

    async startChatWithContact(contactId) {
        try {
            const response = await fetch('/api/chats/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contact_id: contactId
                })
            });
            
            const data = await response.json();
            
            if (data.status === 'success') {
                this.hideModals();
                await this.loadChats();
                this.selectChat(data.chat_id);
            }
        } catch (error) {
            console.error('Failed to create chat:', error);
        }
    }

    async loadUserSettings() {
        if (this.currentUser) {
            document.getElementById('profileFirstName').value = this.currentUser.first_name || '';
            document.getElementById('profileLastName').value = this.currentUser.last_name || '';
            document.getElementById('profileBio').value = this.currentUser.bio || '';
        }
    }

    async saveSettings() {
        try {
            const response = await fetch('/api/user/profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    first_name: document.getElementById('profileFirstName').value,
                    last_name: document.getElementById('profileLastName').value,
                    bio: document.getElementById('profileBio').value
                })
            });
            
            const data = await response.json();
            
            if (data.status === 'success') {
                this.currentUser = data.user;
                this.updateUserInfo();
                this.hideModals();
            }
        } catch (error) {
            console.error('Failed to save settings:', error);
        }
    }

    async logout() {
        try {
            await fetch('/api/logout', { method: 'POST' });
            window.location.reload();
        } catch (error) {
            console.error('Failed to logout:', error);
        }
    }

    switchTab(tabName) {
        // Убираем активный класс у всех вкладок
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.remove('active');
        });
        
        // Добавляем активный класс выбранной вкладке
        document.querySelector(`.tab[data-tab="${tabName}"]`).classList.add('active');
        
        // Здесь можно добавить логику загрузки данных для вкладки
    }

    scrollToBottom() {
        const container = document.getElementById('messagesContainer');
        container.scrollTop = container.scrollHeight;
    }

    formatTime(date) {
        const now = new Date();
        const diff = now - date;
        
        if (diff < 24 * 60 * 60 * 1000) {
            return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        } else if (diff < 7 * 24 * 60 * 60 * 1000) {
            return date.toLocaleDateString('ru-RU', { weekday: 'short' });
        } else {
            return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    updateUserOnlineStatus(userId, isOnline) {
        // Обновляем статус в списке контактов и чатов
        const contactElements = document.querySelectorAll(`[data-user-id="${userId}"]`);
        contactElements.forEach(element => {
            const statusElement = element.querySelector('.contact-status, .chat-status');
            if (statusElement) {
                statusElement.textContent = isOnline ? 'online' : 'offline';
                statusElement.style.color = isOnline ? '#4CAF50' : '#666';
            }
        });
    }
}

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    window.messenger = new TelegramMessenger();
})