class TelegramMessenger {
    constructor() {
        this.socket = null;
        this.currentUser = null;
        this.currentChat = null;
        this.chats = [];
        this.contacts = [];
        this.isConnected = false;
        this.typingTimeout = null;
        
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
                if (userData.status === 'success') {
                    this.currentUser = userData.user;
                    this.showMainInterface();
                    this.loadInitialData();
                } else {
                    this.showAuthInterface();
                }
            } else {
                this.showAuthInterface();
            }
        } catch (error) {
            console.error('Authentication check failed:', error);
            this.showAuthInterface();
        }
    }

    showAuthInterface() {
        document.getElementById('loadingScreen').style.display = 'none';
        window.location.href = '/';
    }

    showMainInterface() {
        document.getElementById('loadingScreen').style.display = 'none';
        document.getElementById('mainInterface').style.display = 'flex';
        this.updateUserInfo();
        this.loadTheme();
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
        
        // Кнопка переключения темы
        const themeToggleBtn = document.getElementById('themeToggleBtn');
        if (themeToggleBtn) {
            themeToggleBtn.addEventListener('click', () => this.toggleTheme());
        }
        
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

        // Кнопки звонков
        const voiceCallBtn = document.getElementById('voiceCallBtn');
        const videoCallBtn = document.getElementById('videoCallBtn');
        if (voiceCallBtn) voiceCallBtn.addEventListener('click', () => this.startCall('audio'));
        if (videoCallBtn) videoCallBtn.addEventListener('click', () => this.startCall('video'));

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
        document.getElementById('changePasswordBtn').addEventListener('click', () => this.changePassword());

        // Мобильная навигация
        this.initializeMobileNavigation();
        
        // Обработка изменения размера окна
        window.addEventListener('resize', () => this.handleResize());
        
        // Предотвращение зума на iOS при фокусе на input
        this.preventIOSZoom();
    }

    async changePassword() {
        try {
            const currentPassword = prompt('Введите текущий пароль:');
            if (!currentPassword) return;
            const newPassword = prompt('Введите новый пароль (минимум 6 символов):');
            if (!newPassword || newPassword.length < 6) {
                alert('Пароль слишком короткий!');
                return;
            }
            const response = await fetch('/api/user/change-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    current_password: currentPassword,
                    new_password: newPassword
                })
            });
            const data = await response.json();
            if (data.status === 'success') {
                alert('Пароль успешно изменён!');
            } else {
                alert('Ошибка: ' + data.message);
            }
        } catch (error) {
            alert('Ошибка смены пароля');
        }
    }

    initializeMobileNavigation() {
        // Создаем оверлей для мобильной навигации
        const overlay = document.createElement('div');
        overlay.className = 'mobile-overlay';
        overlay.id = 'mobileOverlay';
        document.body.appendChild(overlay);

        // Обработчик для кнопки меню в заголовке чата
        const chatHeader = document.querySelector('.chat-header');
        if (chatHeader) {
            const menuBtn = chatHeader.querySelector('.menu-btn');
            if (menuBtn) {
                menuBtn.addEventListener('click', () => this.toggleMobileSidebar());
            }
        }

        // Закрытие по клику на оверлей
        overlay.addEventListener('click', () => this.closeMobileSidebar());
    }

    toggleMobileSidebar() {
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.getElementById('mobileOverlay');
        
        if (sidebar.classList.contains('mobile-open')) {
            this.closeMobileSidebar();
        } else {
            this.openMobileSidebar();
        }
    }

    openMobileSidebar() {
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.getElementById('mobileOverlay');
        
        sidebar.classList.add('mobile-open');
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    closeMobileSidebar() {
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.getElementById('mobileOverlay');
        
        sidebar.classList.remove('mobile-open');
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    }

    handleResize() {
        if (window.innerWidth > 768) {
            this.closeMobileSidebar();
        }
    }

    preventIOSZoom() {
        const inputs = document.querySelectorAll('input, textarea');
        inputs.forEach(input => {
            input.addEventListener('focus', () => {
                if (this.isIOS()) {
                    const viewport = document.querySelector('meta[name=viewport]');
                    if (viewport) {
                        viewport.setAttribute(
                            'content', 
                            'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no'
                        );
                    }
                }
            });
            
            input.addEventListener('blur', () => {
                if (this.isIOS()) {
                    const viewport = document.querySelector('meta[name=viewport]');
                    if (viewport) {
                        viewport.setAttribute(
                            'content', 
                            'width=device-width, initial-scale=1'
                        );
                    }
                }
            });
        });
    }

    isIOS() {
        return /iPad|iPhone|iPod/.test(navigator.userAgent);
    }

    initializeSocket() {
        if (typeof io === 'undefined') {
            console.error('Socket.io not loaded');
            return;
        }

        this.socket = io({
            withCredentials: true,
            transports: ['websocket', 'polling'],
        });
        
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

        // WebRTC signaling events
        this.socket.on('rtc_incoming_call', (data) => {
            if (window.callManager) {
                window.callManager.onIncomingCall(data);
            }
        });
        this.socket.on('rtc_signal', (data) => {
            if (window.callManager) {
                window.callManager.onSignal(data);
            }
        });
        this.socket.on('rtc_end_call', (data) => {
            if (window.callManager) {
                window.callManager.onRemoteEndCall(data);
            }
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
        if (!chatsList) return;
        
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
                <img src="${chat.avatar || '/static/images/default-chat.svg'}" alt="${chat.name}" onerror="this.src='/static/images/default-chat.svg'">
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
        document.querySelectorAll('.chat-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const chatElement = document.querySelector(`.chat-item[data-chat-id="${chatId}"]`);
        if (chatElement) {
            chatElement.classList.add('active');
        }
        
        this.currentChat = this.chats.find(chat => chat.id === chatId);
        
        if (this.currentChat) {
            const currentChatName = document.getElementById('currentChatName');
            const currentChatAvatar = document.getElementById('currentChatAvatar');
            
            if (currentChatName) {
                currentChatName.textContent = this.currentChat.name;
            }
            if (currentChatAvatar) {
                currentChatAvatar.innerHTML = 
                    `<img src="${this.currentChat.avatar || '/static/images/default-chat.svg'}" alt="${this.currentChat.name}">`;
            }
        }
        
        await this.loadChatMessages(chatId);
        
        if (this.socket) {
            this.socket.emit('join_chat', { chat_id: chatId });
        }
    }

    startCall(type) {
        if (!this.currentChat || !this.currentUser) return;
        if (window.callManager) {
            window.callManager.initiateCall({
                chatId: this.currentChat.id,
                type: type
            });
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
        if (!messagesList) return;
        
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
        
        div.dataset.messageId = message.id;
        div.dataset.senderId = message.sender_id;
        
        let replyBlock = '';
        if (message.reply_to) {
            const replyText = this.escapeHtml(message.reply_to.content || '');
            replyBlock = `
                <div class="message-reply">
                    <div class="reply-author">${message.reply_to.sender_id === this.currentUser.id ? 'Вы' : 'Собеседник'}</div>
                    <div class="reply-preview">${replyText}</div>
                </div>
            `;
        }

        div.innerHTML = `
            <div class="message-bubble">
                ${replyBlock}
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
        if (!input) return;
        
        const content = input.value.trim();
        
        if (!content || !this.currentChat) return;
        
        try {
            const payload = {
                content: content,
                content_type: 'text'
            };
            
            if (window.chatFeatures && window.chatFeatures.replyToId) {
                payload.reply_to_id = window.chatFeatures.replyToId;
            }

            const response = await fetch(`/api/chats/${this.currentChat.id}/send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });
            
            const data = await response.json();
            
            if (data.status === 'success') {
                input.value = '';
                this.adjustTextareaHeight(input);
                
                if (window.chatFeatures && window.chatFeatures.clearReply) {
                    window.chatFeatures.clearReply();
                }
            }
        } catch (error) {
            console.error('Failed to send message:', error);
        }
    }

    handleNewMessage(data) {
        if (data.chat_id === this.currentChat?.id) {
            const messagesList = document.getElementById('messagesList');
            if (messagesList) {
                const messageElement = this.createMessageElement(data);
                messagesList.appendChild(messageElement);
                this.scrollToBottom();
            }
        }
        
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
        const typingText = document.getElementById('typingText');
        const typingIndicator = document.getElementById('typingIndicator');
        
        if (!typingText || !typingIndicator) return;
        
        const user = this.contacts.find(contact => contact.id === userId);
        if (user) {
            typingText.textContent = `${user.first_name} печатает...`;
            typingIndicator.style.display = 'flex';
        }
    }

    hideTypingIndicator(userId) {
        const typingIndicator = document.getElementById('typingIndicator');
        if (typingIndicator) {
            typingIndicator.style.display = 'none';
        }
    }

    showNewChatModal() {
        const modalOverlay = document.getElementById('modalOverlay');
        const newChatModal = document.getElementById('newChatModal');
        
        if (modalOverlay && newChatModal) {
            modalOverlay.style.display = 'flex';
            newChatModal.style.display = 'block';
            this.renderNewChatContacts();
        }
    }

    showSettingsModal() {
        const modalOverlay = document.getElementById('modalOverlay');
        const settingsModal = document.getElementById('settingsModal');
        
        if (modalOverlay && settingsModal) {
            modalOverlay.style.display = 'flex';
            settingsModal.style.display = 'block';
            this.loadUserSettings();
        }
    }

    hideModals() {
        const modalOverlay = document.getElementById('modalOverlay');
        if (modalOverlay) {
            modalOverlay.style.display = 'none';
        }
        
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
    }

    renderNewChatContacts() {
        const contactsList = document.getElementById('newChatContacts');
        if (!contactsList) return;
        
        contactsList.innerHTML = '';

        const addContactDiv = document.createElement('div');
        addContactDiv.className = 'contact-item add-contact';
        addContactDiv.innerHTML = `
            <div class="contact-avatar">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="#0088cc">
                    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                </svg>
            </div>
            <div class="contact-details">
                <div class="contact-name">Добавить контакт</div>
                <div class="contact-status">Найти пользователя по имени</div>
            </div>
        `;
        addContactDiv.addEventListener('click', () => this.showAddContactForm());
        contactsList.appendChild(addContactDiv);

        this.contacts.forEach(contact => {
            const div = document.createElement('div');
            div.className = 'contact-item';
            div.innerHTML = `
                <div class="contact-avatar">
                    <img src="${contact.avatar || '/static/images/default-avatar.svg'}" alt="${contact.first_name}" onerror="this.src='/static/images/default-avatar.svg'">
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

    showAddContactForm() {
        const username = prompt('Введите имя пользователя для добавления в контакты:');
        if (username && username.trim()) {
            this.addContact(username.trim());
        }
    }

    async addContact(username) {
        try {
            const response = await fetch('/api/contacts/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: username
                })
            });
            
            const data = await response.json();
            
            if (data.status === 'success') {
                alert('Контакт успешно добавлен!');
                await this.loadContacts();
                this.hideModals();
                if (data.chat_id) {
                    await this.loadChats();
                    this.selectChat(data.chat_id);
                }
            } else {
                alert('Ошибка: ' + data.message);
            }
        } catch (error) {
            console.error('Failed to add contact:', error);
            alert('Ошибка при добавлении контакта');
        }
    }

    async startChatWithContact(contactId) {
        try {
            const existingChat = this.chats.find(chat => 
                !chat.is_group && chat.members && chat.members.some(member => member.id === contactId)
            );
            
            if (existingChat) {
                this.hideModals();
                this.selectChat(existingChat.id);
                return;
            }
            
            const contact = this.contacts.find(c => c.id === contactId);
            if (contact) {
                const response = await fetch('/api/contacts/add', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        username: contact.username
                    })
                });
                
                const data = await response.json();
                
                if (data.status === 'success') {
                    this.hideModals();
                    await this.loadChats();
                    if (data.chat_id) {
                        this.selectChat(data.chat_id);
                    }
                } else {
                    alert('Ошибка создания чата: ' + data.message);
                }
            }
        } catch (error) {
            console.error('Failed to create chat:', error);
            alert('Ошибка создания чата');
        }
    }

    async loadUserSettings() {
        if (this.currentUser) {
            const firstNameInput = document.getElementById('profileFirstName');
            const lastNameInput = document.getElementById('profileLastName');
            const bioInput = document.getElementById('profileBio');
            
            if (firstNameInput) firstNameInput.value = this.currentUser.first_name || '';
            if (lastNameInput) lastNameInput.value = this.currentUser.last_name || '';
            if (bioInput) bioInput.value = this.currentUser.bio || '';
        }
    }

    async saveSettings() {
        try {
            const firstNameInput = document.getElementById('profileFirstName');
            const lastNameInput = document.getElementById('profileLastName');
            const bioInput = document.getElementById('profileBio');
            
            if (!firstNameInput || !lastNameInput || !bioInput) return;
            
            const response = await fetch('/api/user/profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    first_name: firstNameInput.value,
                    last_name: lastNameInput.value,
                    bio: bioInput.value
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
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.remove('active');
        });
        
        const targetTab = document.querySelector(`.tab[data-tab="${tabName}"]`);
        if (targetTab) {
            targetTab.classList.add('active');
        }
    }

    scrollToBottom() {
        const container = document.getElementById('messagesContainer');
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
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
        const contactElements = document.querySelectorAll(`[data-user-id="${userId}"]`);
        contactElements.forEach(element => {
            const statusElement = element.querySelector('.contact-status, .chat-status');
            if (statusElement) {
                statusElement.textContent = isOnline ? 'online' : 'offline';
                statusElement.style.color = isOnline ? '#4CAF50' : '#666';
            }
        });
    }

    toggleTheme() {
        const body = document.body;
        const themeToggleBtn = document.getElementById('themeToggleBtn');
        
        if (!themeToggleBtn) return;
        
        if (body.classList.contains('dark-theme')) {
            body.classList.remove('dark-theme');
            themeToggleBtn.innerHTML = '🔥';
            localStorage.setItem('theme', 'fire');
        } else {
            body.classList.add('dark-theme');
            themeToggleBtn.innerHTML = '🌋';
            localStorage.setItem('theme', 'dark-fire');
        }
    }

    loadTheme() {
        const savedTheme = localStorage.getItem('theme');
        const themeToggleBtn = document.getElementById('themeToggleBtn');
        
        if (savedTheme === 'dark-fire') {
            document.body.classList.add('dark-theme');
            if (themeToggleBtn) {
                themeToggleBtn.innerHTML = '🌋';
            }
        } else {
            document.body.classList.remove('dark-theme');
            if (themeToggleBtn) {
                themeToggleBtn.innerHTML = '🔥';
            }
        }
    }
}

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    window.messenger = new TelegramMessenger();
});