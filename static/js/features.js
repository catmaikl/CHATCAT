/**
 * Расширенные функции для Little Kitten Chat
 * Включает: эмодзи, темы, поиск, реакции, редактирование и многое другое
 */

class ChatFeatures {
    constructor(messenger) {
        this.messenger = messenger;
        this.currentTheme = 'light';
        this.emojiPicker = null;
        this.searchResults = [];
        this.notifications = [];
        
        this.initializeFeatures();
    }

    initializeFeatures() {
        this.initializeThemes();
        this.initializeEmojiPicker();
        this.initializeSearch();
        this.initializeNotifications();
        this.initializeFileUpload();
        this.initializeMessageActions();
        this.loadUserSettings();
    }

    // ========== ТЕМЫ ==========
    initializeThemes() {
        console.log('Initializing themes...');
        
        // Проверяем, не добавлена ли уже кнопка
        if (document.querySelector('.theme-toggle')) {
            console.log('Theme toggle button already exists');
            return;
        }
        
        // Создаем переключатель тем
        const themeToggle = document.createElement('button');
        themeToggle.className = 'icon-btn theme-toggle';
        themeToggle.innerHTML = '🌙';
        themeToggle.title = 'Переключить тему';
        themeToggle.style.fontSize = '18px';
        themeToggle.addEventListener('click', () => this.toggleTheme());
        
        // Добавляем в заголовок как первую кнопку
        const headerActions = document.querySelector('.header-actions');
        if (headerActions) {
            headerActions.insertBefore(themeToggle, headerActions.firstChild);
            console.log('Theme toggle button added to header');
        } else {
            console.error('Header actions not found, trying alternative approach...');
            
            // Альтернативный подход - создаем контейнер для кнопок
            const sidebarHeader = document.querySelector('.sidebar-header');
            if (sidebarHeader) {
                const userInfo = sidebarHeader.querySelector('.user-info');
                if (userInfo) {
                    const actionsContainer = document.createElement('div');
                    actionsContainer.className = 'header-actions';
                    actionsContainer.appendChild(themeToggle);
                    sidebarHeader.appendChild(actionsContainer);
                    console.log('Created header actions container and added theme toggle');
                }
            }
        }
    }

    toggleTheme() {
        this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.applyTheme(this.currentTheme);
        this.saveUserSettings({ theme: this.currentTheme });
    }

    applyTheme(theme) {
        document.body.className = theme === 'dark' ? 'dark-theme' : '';
        
        // Обновляем иконку
        const themeToggle = document.querySelector('.theme-toggle');
        if (themeToggle) {
            themeToggle.innerHTML = theme === 'dark' ? '☀️' : '🌙';
        }
    }

    // ========== ЭМОДЗИ ПИКЕР ==========
    initializeEmojiPicker() {
        const emojiBtn = document.getElementById('emojiBtn');
        if (emojiBtn) {
            emojiBtn.addEventListener('click', () => this.showEmojiPicker());
        }
        
        this.createEmojiPicker();
    }

    createEmojiPicker() {
        const emojiPicker = document.createElement('div');
        emojiPicker.className = 'emoji-picker';
        emojiPicker.id = 'emojiPicker';
        emojiPicker.style.display = 'none';
        
        const emojis = [
            '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
            '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
            '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩',
            '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣',
            '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬',
            '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗',
            '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯',
            '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐',
            '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈',
            '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉',
            '👆', '🖕', '👇', '☝️', '👋', '🤚', '🖐️', '✋', '🖖', '👏',
            '🙌', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦿',
            '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
            '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️',
            '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐',
            '⭐', '🌟', '✨', '⚡', '☄️', '💥', '🔥', '🌈', '☀️', '🌤️'
        ];
        
        emojis.forEach(emoji => {
            const emojiBtn = document.createElement('button');
            emojiBtn.className = 'emoji-btn';
            emojiBtn.textContent = emoji;
            emojiBtn.addEventListener('click', () => this.insertEmoji(emoji));
            emojiPicker.appendChild(emojiBtn);
        });
        
        document.body.appendChild(emojiPicker);
        this.emojiPicker = emojiPicker;
    }

    showEmojiPicker() {
        if (this.emojiPicker.style.display === 'none') {
            this.emojiPicker.style.display = 'block';
            this.positionEmojiPicker();
        } else {
            this.emojiPicker.style.display = 'none';
        }
    }

    positionEmojiPicker() {
        const emojiBtn = document.getElementById('emojiBtn');
        const rect = emojiBtn.getBoundingClientRect();
        
        this.emojiPicker.style.position = 'fixed';
        this.emojiPicker.style.bottom = (window.innerHeight - rect.top + 10) + 'px';
        this.emojiPicker.style.left = rect.left + 'px';
    }

    insertEmoji(emoji) {
        const messageInput = document.getElementById('messageInput');
        const cursorPos = messageInput.selectionStart;
        const textBefore = messageInput.value.substring(0, cursorPos);
        const textAfter = messageInput.value.substring(cursorPos);
        
        messageInput.value = textBefore + emoji + textAfter;
        messageInput.focus();
        messageInput.setSelectionRange(cursorPos + emoji.length, cursorPos + emoji.length);
        
        this.emojiPicker.style.display = 'none';
    }

    // ========== ПОИСК ==========
    initializeSearch() {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.performSearch(e.target.value);
                }
            });
        }
    }

    handleSearch(query) {
        if (query.length < 2) {
            this.clearSearchResults();
            return;
        }
        
        // Поиск по чатам
        this.searchChats(query);
    }

    searchChats(query) {
        const chatItems = document.querySelectorAll('.chat-item');
        chatItems.forEach(item => {
            const chatName = item.querySelector('.chat-name').textContent.toLowerCase();
            const lastMessage = item.querySelector('.chat-last-message').textContent.toLowerCase();
            
            if (chatName.includes(query.toLowerCase()) || lastMessage.includes(query.toLowerCase())) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    }

    async performSearch(query) {
        if (!this.messenger.currentChat || !query.trim()) return;
        
        try {
            const response = await fetch(`/api/chats/${this.messenger.currentChat.id}/search?q=${encodeURIComponent(query)}`);
            const data = await response.json();
            
            if (data.status === 'success') {
                this.displaySearchResults(data.results);
            }
        } catch (error) {
            console.error('Search error:', error);
        }
    }

    displaySearchResults(results) {
        // Создаем модальное окно с результатами поиска
        const modal = this.createSearchModal(results);
        document.body.appendChild(modal);
    }

    createSearchModal(results) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal search-modal">
                <div class="modal-header">
                    <h3>Результаты поиска</h3>
                    <button class="icon-btn close-search-modal">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                        </svg>
                    </button>
                </div>
                <div class="modal-content">
                    <div class="search-results">
                        ${results.map(result => `
                            <div class="search-result-item" data-message-id="${result.id}">
                                <div class="search-result-content">${this.highlightSearchTerm(result.content)}</div>
                                <div class="search-result-date">${this.formatDate(new Date(result.created_at))}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
        
        // Обработчики событий
        modal.querySelector('.close-search-modal').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
        
        return modal;
    }

    highlightSearchTerm(text) {
        // Подсветка поискового термина из текущего поля поиска
        const searchInput = document.getElementById('searchInput');
        const query = searchInput ? searchInput.value.trim() : '';
        if (!query) return this.escapeHtml(text);

        const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${safeQuery})`, 'gi');
        const escaped = this.escapeHtml(text);
        return escaped.replace(regex, '<mark>$1</mark>');
    }

    // Вспомогательное экранирование
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    clearSearchResults() {
        const chatItems = document.querySelectorAll('.chat-item');
        chatItems.forEach(item => {
            item.style.display = 'flex';
        });
    }

    // ========== УВЕДОМЛЕНИЯ ==========
    initializeNotifications() {
        this.requestNotificationPermission();
        this.loadNotifications();
        
        // Создаем кнопку уведомлений
        this.createNotificationButton();
    }

    async requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            await Notification.requestPermission();
        }
    }

    createNotificationButton() {
        const notificationBtn = document.createElement('button');
        notificationBtn.className = 'icon-btn notification-btn';
        notificationBtn.innerHTML = '🔔';
        notificationBtn.title = 'Уведомления';
        notificationBtn.addEventListener('click', () => this.showNotifications());
        
        const headerActions = document.querySelector('.header-actions');
        if (headerActions) {
            headerActions.appendChild(notificationBtn);
        }
    }

    async loadNotifications() {
        try {
            const response = await fetch('/api/notifications');
            const data = await response.json();
            
            if (data.status === 'success') {
                this.notifications = data.notifications;
                this.updateNotificationBadge();
            }
        } catch (error) {
            console.error('Load notifications error:', error);
        }
    }

    updateNotificationBadge() {
        const unreadCount = this.notifications.filter(n => !n.is_read).length;
        const notificationBtn = document.querySelector('.notification-btn');
        
        if (notificationBtn) {
            if (unreadCount > 0) {
                notificationBtn.innerHTML = `🔔 <span class="notification-badge">${unreadCount}</span>`;
            } else {
                notificationBtn.innerHTML = '🔔';
            }
        }
    }

    showNotifications() {
        const modal = this.createNotificationModal();
        document.body.appendChild(modal);
    }

    createNotificationModal() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal notification-modal">
                <div class="modal-header">
                    <h3>Уведомления</h3>
                    <button class="icon-btn close-notification-modal">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                        </svg>
                    </button>
                </div>
                <div class="modal-content">
                    <div class="notifications-list">
                        ${this.notifications.map(notification => `
                            <div class="notification-item ${notification.is_read ? 'read' : 'unread'}" data-id="${notification.id}">
                                <div class="notification-title">${notification.title}</div>
                                <div class="notification-message">${notification.message}</div>
                                <div class="notification-date">${this.formatDate(new Date(notification.created_at))}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
        
        // Обработчики событий
        modal.querySelector('.close-notification-modal').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
        
        return modal;
    }

    showNotification(title, message, options = {}) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, {
                body: message,
                icon: '/static/images/icon-192.png',
                ...options
            });
        }
    }

    // ========== ЗАГРУЗКА ФАЙЛОВ ==========
    initializeFileUpload() {
        const attachBtn = document.getElementById('attachFileBtn');
        if (attachBtn) {
            attachBtn.addEventListener('click', () => this.showFileUploadOptions());
        }
        
        this.createFileInput();
    }

    createFileInput() {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.id = 'fileInput';
        fileInput.style.display = 'none';
        fileInput.multiple = true;
        fileInput.addEventListener('change', (e) => this.handleFileUpload(e.target.files));
        
        document.body.appendChild(fileInput);
    }

    showFileUploadOptions() {
        const fileInput = document.getElementById('fileInput');
        fileInput.click();
    }

    async handleFileUpload(files) {
        for (const file of files) {
            await this.uploadFile(file);
        }
    }

    async uploadFile(file) {
        // Проверяем размер файла (максимум 10MB)
        if (file.size > 10 * 1024 * 1024) {
            alert('Файл слишком большой. Максимальный размер: 10MB');
            return;
        }
        
        // Проверяем тип файла
        const allowedTypes = [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp',
            'application/pdf', 'text/plain',
            'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'audio/mpeg', 'audio/wav', 'audio/ogg',
            'video/mp4', 'video/webm', 'video/ogg'
        ];
        
        if (!allowedTypes.includes(file.type)) {
            alert('Неподдерживаемый тип файла');
            return;
        }
        
        const formData = new FormData();
        formData.append('file', file);
        
        // Показываем индикатор загрузки
        this.showUploadProgress();
        
        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.status === 'success') {
                this.sendFileMessage(data);
                this.showToast('Файл успешно загружен');
            } else {
                alert('Ошибка загрузки файла: ' + data.message);
            }
        } catch (error) {
            console.error('File upload error:', error);
            if (error.message.includes('404')) {
                alert('Функция загрузки файлов временно недоступна');
            } else {
                alert('Ошибка загрузки файла: ' + error.message);
            }
        } finally {
            this.hideUploadProgress();
        }
    }

    sendFileMessage(fileData) {
        const messageInput = document.getElementById('messageInput');
        messageInput.value = `📎 ${fileData.filename}`;
        
        // Отправляем сообщение с файлом
        this.messenger.sendMessage();
    }

    // ========== ДЕЙСТВИЯ С СООБЩЕНИЯМИ ==========
    initializeMessageActions() {
        // Добавляем контекстное меню для сообщений
        document.addEventListener('contextmenu', (e) => {
            const messageElement = e.target.closest('.message');
            if (messageElement) {
                e.preventDefault();
                this.showMessageContextMenu(e, messageElement);
            }
        });
        
        // Закрываем контекстное меню при клике вне его
        document.addEventListener('click', () => {
            this.hideMessageContextMenu();
        });
    }

    showMessageContextMenu(event, messageElement) {
        this.hideMessageContextMenu();
        
        const messageId = messageElement.dataset.messageId;
        const senderId = messageElement.dataset.senderId;
        const isOwnMessage = senderId == this.messenger.currentUser.id;
        
        const contextMenu = document.createElement('div');
        contextMenu.className = 'message-context-menu';
        contextMenu.style.position = 'fixed';
        contextMenu.style.left = event.clientX + 'px';
        contextMenu.style.top = event.clientY + 'px';
        
        const menuItems = [];
        
        // Ответить
        menuItems.push({
            text: 'Ответить',
            icon: '↩️',
            action: () => this.replyToMessage(messageId)
        });
        
        // Реакция
        menuItems.push({
            text: 'Реакция',
            icon: '😀',
            action: () => this.showReactionPicker(messageId)
        });
        
        // Копировать
        menuItems.push({
            text: 'Копировать',
            icon: '📋',
            action: () => this.copyMessage(messageElement)
        });
        
        if (isOwnMessage) {
            // Редактировать
            menuItems.push({
                text: 'Редактировать',
                icon: '✏️',
                action: () => this.editMessage(messageId, messageElement)
            });
            
            // Удалить
            menuItems.push({
                text: 'Удалить',
                icon: '🗑️',
                action: () => this.deleteMessage(messageId)
            });
        }
        
        // Закрепить (только для админов)
        menuItems.push({
            text: 'Закрепить',
            icon: '📌',
            action: () => this.pinMessage(messageId)
        });
        
        contextMenu.innerHTML = menuItems.map(item => `
            <div class="context-menu-item" data-action="${item.action}">
                <span class="context-menu-icon">${item.icon}</span>
                <span class="context-menu-text">${item.text}</span>
            </div>
        `).join('');
        
        // Добавляем обработчики
        contextMenu.querySelectorAll('.context-menu-item').forEach((item, index) => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                menuItems[index].action();
                this.hideMessageContextMenu();
            });
        });
        
        document.body.appendChild(contextMenu);
        this.currentContextMenu = contextMenu;
    }

    hideMessageContextMenu() {
        if (this.currentContextMenu) {
            document.body.removeChild(this.currentContextMenu);
            this.currentContextMenu = null;
        }
    }

    async editMessage(messageId, messageElement) {
        const currentContent = messageElement.querySelector('.message-content').textContent;
        const newContent = prompt('Редактировать сообщение:', currentContent);
        
        if (newContent && newContent !== currentContent) {
            try {
                const response = await fetch(`/api/messages/${messageId}/edit`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ content: newContent })
                });
                
                const data = await response.json();
                
                if (data.status === 'success') {
                    messageElement.querySelector('.message-content').textContent = newContent;
                    messageElement.classList.add('edited');
                } else {
                    alert('Ошибка: ' + data.message);
                }
            } catch (error) {
                console.error('Edit message error:', error);
                alert('Ошибка редактирования соо��щения');
            }
        }
    }

    async deleteMessage(messageId) {
        if (confirm('Удалить сообщение?')) {
            try {
                const response = await fetch(`/api/messages/${messageId}/delete`, {
                    method: 'DELETE'
                });
                
                const data = await response.json();
                
                if (data.status === 'success') {
                    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
                    if (messageElement) {
                        messageElement.classList.add('deleted');
                        messageElement.querySelector('.message-content').textContent = '[Сообщение удалено]';
                    }
                } else {
                    alert('Ошибка: ' + data.message);
                }
            } catch (error) {
                console.error('Delete message error:', error);
                alert('Ошибка удаления сообщения');
            }
        }
    }

    async pinMessage(messageId) {
        try {
            const response = await fetch(`/api/messages/${messageId}/pin`, {
                method: 'POST'
            });
            
            const data = await response.json();
            
            if (data.status === 'success') {
                alert('Сообщение закреплено');
            } else {
                alert('Ошибка: ' + data.message);
            }
        } catch (error) {
            console.error('Pin message error:', error);
            alert('Ошибка закрепления сообщения');
        }
    }

    copyMessage(messageElement) {
        const content = messageElement.querySelector('.message-content').textContent;
        navigator.clipboard.writeText(content).then(() => {
            this.showToast('Сообщение скопировано');
        });
    }

    replyToMessage(messageId) {
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
        if (!messageElement) return;

        const content = messageElement.querySelector('.message-content')?.textContent || '';
        const preview = content.length > 120 ? content.slice(0, 120) + '…' : content;

        // Рендерим панель ответа над инпутом
        let replyBar = document.getElementById('replyBar');
        if (!replyBar) {
            replyBar = document.createElement('div');
            replyBar.id = 'replyBar';
            replyBar.className = 'reply-bar';
            const inputContainer = document.querySelector('.message-input-container');
            if (inputContainer) {
                inputContainer.parentNode.insertBefore(replyBar, inputContainer);
            } else {
                document.body.appendChild(replyBar);
            }
        }

        replyBar.innerHTML = `
            <div class="reply-bar-content">
                <div class="reply-bar-text">Ответ на: ${this.escapeHtml(preview)}</div>
                <button class="icon-btn reply-bar-close" title="Отменить">✖</button>
            </div>
        `;

        // Обработчик отмены
        replyBar.querySelector('.reply-bar-close').addEventListener('click', () => this.clearReply());

        // Сохраняем выбранное сообщение для ответа
        this.replyToId = messageId;
    }

    clearReply() {
        const replyBar = document.getElementById('replyBar');
        if (replyBar && replyBar.parentNode) replyBar.parentNode.removeChild(replyBar);
        this.replyToId = null;
    }

    showReactionPicker(messageId) {
        const reactions = ['👍', '👎', '❤️', '😂', '😮', '😢', '😡'];
        
        const picker = document.createElement('div');
        picker.className = 'reaction-picker';
        picker.innerHTML = reactions.map(emoji => 
            `<button class="reaction-btn" data-emoji="${emoji}">${emoji}</button>`
        ).join('');
        
        picker.querySelectorAll('.reaction-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.addReaction(messageId, btn.dataset.emoji);
                document.body.removeChild(picker);
            });
        });
        
        document.body.appendChild(picker);
        
        // Позиционируем пи��ер
        picker.style.position = 'fixed';
        picker.style.left = '50%';
        picker.style.top = '50%';
        picker.style.transform = 'translate(-50%, -50%)';
    }

    async addReaction(messageId, emoji) {
        try {
            const response = await fetch(`/api/messages/${messageId}/react`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ emoji })
            });
            
            const data = await response.json();
            
            if (data.status === 'success') {
                // Обновляем UI с реакцией
                this.updateMessageReactions(messageId, emoji, data.action);
            }
        } catch (error) {
            console.error('Add reaction error:', error);
        }
    }

    updateMessageReactions(messageId, emoji, action) {
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
        if (messageElement) {
            let reactionsContainer = messageElement.querySelector('.message-reactions');
            
            if (!reactionsContainer) {
                reactionsContainer = document.createElement('div');
                reactionsContainer.className = 'message-reactions';
                messageElement.querySelector('.message-bubble').appendChild(reactionsContainer);
            }
            
            // Обновляем реакции
            if (action === 'added' || action === 'updated') {
                const reactionBtn = document.createElement('button');
                reactionBtn.className = 'reaction';
                reactionBtn.textContent = emoji;
                reactionsContainer.appendChild(reactionBtn);
            }
        }
    }

    // ========== НАСТРОЙКИ ==========
    async loadUserSettings() {
        try {
            const response = await fetch('/api/user/settings');
            const data = await response.json();
            
            if (data.status === 'success') {
                this.applySettings(data.settings);
            }
        } catch (error) {
            console.error('Load settings error:', error);
        }
    }

    async saveUserSettings(settings) {
        try {
            const response = await fetch('/api/user/settings', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(settings)
            });
            
            const data = await response.json();
            
            if (data.status !== 'success') {
                console.error('Save settings error:', data.message);
            }
        } catch (error) {
            console.error('Save settings error:', error);
        }
    }

    applySettings(settings) {
        if (settings.theme) {
            this.currentTheme = settings.theme;
            this.applyTheme(settings.theme);
        }
        
        if (settings.font_size) {
            document.body.className += ` font-${settings.font_size}`;
        }
    }

    // ========== УТИЛИТЫ ==========
    formatDate(date) {
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

    showToast(message, duration = 3000) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('show');
        }, 100);
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(toast);
            }, 300);
        }, duration);
    }

    showUploadProgress() {
        const progress = document.createElement('div');
        progress.className = 'upload-progress';
        progress.id = 'uploadProgress';
        progress.innerHTML = `
            <div class="upload-progress-content">
                <div class="upload-spinner"></div>
                <div class="upload-text">Загрузка файла...</div>
            </div>
        `;
        
        document.body.appendChild(progress);
    }

    hideUploadProgress() {
        const progress = document.getElementById('uploadProgress');
        if (progress) {
            document.body.removeChild(progress);
        }
    }
}

// Инициализация расширенных функций
document.addEventListener('DOMContentLoaded', () => {
    // Ждем, пока основной мессенджер будет готов
    const initFeatures = () => {
        if (window.messenger) {
            console.log('Initializing chat features...');
            window.chatFeatures = new ChatFeatures(window.messenger);
            // Инициализация модуля звонков, когда есть сокет и пользователь
            const tryInitCalls = () => {
                if (window.messenger.socket && window.messenger.currentUser) {
                    if (window.callManager && window.callManager.initialized) return;
                    const script = document.createElement('script');
                    script.src = '/static/js/calls.js';
                    document.body.appendChild(script);
                } else {
                    setTimeout(tryInitCalls, 300);
                }
            };
            tryInitCalls();
        } else {
            console.log('Messenger not ready, retrying in 500ms...');
            setTimeout(initFeatures, 500);
        }
    };
    
    initFeatures();
});