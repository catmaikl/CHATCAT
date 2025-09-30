class CallManager {
    constructor(messenger) {
        this.messenger = messenger;
        this.pc = null;
        this.localStream = null;
        this.remoteUserId = null;
        this.chatId = null;
        this.callType = 'audio';
        this.initialized = true;

        this.elements = {
            overlay: document.getElementById('callOverlay'),
            localVideo: document.getElementById('localVideo'),
            remoteVideo: document.getElementById('remoteVideo'),
            status: document.getElementById('callStatus'),
            toggleMic: document.getElementById('toggleMicBtn'),
            toggleCam: document.getElementById('toggleCamBtn'),
            endCall: document.getElementById('endCallBtn'),
        };

        this.bindControls();
    }

    bindControls() {
        if (this.elements.toggleMic) this.elements.toggleMic.onclick = () => this.toggleMic();
        if (this.elements.toggleCam) this.elements.toggleCam.onclick = () => this.toggleCam();
        if (this.elements.endCall) this.elements.endCall.onclick = () => this.endCall();
    }

    async initiateCall({ chatId, type }) {
        this.chatId = chatId;
        this.callType = type;

        // Выбираем собеседника из контактов текущего чата: упрощение — первый онлайн в списке контактов
        // В реальном приложении надо получать участников чата; используем эвент вызова, чтобы получить входящий на стороне собеседника
        // Покажем UI ожидания и начнем локальный стрим
        await this.preparePeerConnection();
        await this.acquireMedia();

        // Сообщим серверу о звонке: сервер доставит rtc_incoming_call адресату по user_id позже через UI принятия
        // Здесь нет выбора конкретного адресата, поэтому предлагаем пользователю в будущем доработать выбор; пока — noop
        this.showOverlay('Ожидание ответа…');
    }

    async onIncomingCall({ from_user_id, chat_id, type }) {
        this.remoteUserId = from_user_id;
        this.chatId = chat_id;
        this.callType = type || 'audio';
        await this.preparePeerConnection();
        await this.acquireMedia();
        this.showOverlay('Входящий звонок…');

        // Инициируем оффер от принимающей стороны для простоты (можно наоборот)
        const offer = await this.pc.createOffer();
        await this.pc.setLocalDescription(offer);
        this.sendSignal({ sdp: this.pc.localDescription });
    }

    async onSignal({ from_user_id, signal }) {
        if (!this.pc) {
            await this.preparePeerConnection();
        }
        if (signal.sdp) {
            await this.pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
            if (signal.sdp.type === 'offer') {
                const answer = await this.pc.createAnswer();
                await this.pc.setLocalDescription(answer);
                this.sendSignal({ sdp: this.pc.localDescription });
            }
        } else if (signal.candidate) {
            try { await this.pc.addIceCandidate(new RTCIceCandidate(signal.candidate)); } catch (e) {}
        }
    }

    async preparePeerConnection() {
        if (this.pc) return;
        this.pc = new RTCPeerConnection({ iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }] });
        this.pc.onicecandidate = (e) => {
            if (e.candidate && this.remoteUserId) {
                this.sendSignal({ candidate: e.candidate });
            }
        };
        this.pc.ontrack = (e) => {
            if (this.elements.remoteVideo) {
                this.elements.remoteVideo.srcObject = e.streams[0];
            }
        };
        this.pc.onconnectionstatechange = () => {
            const state = this.pc.connectionState;
            if (state === 'connected') this.updateStatus('Соединено');
            if (state === 'disconnected' || state === 'failed' || state === 'closed') this.hideOverlay();
        };
    }

    async acquireMedia() {
        if (this.localStream) return;
        const constraints = this.callType === 'video' ? { audio: true, video: true } : { audio: true, video: false };
        this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
        if (this.elements.localVideo) this.elements.localVideo.srcObject = this.localStream;
        this.localStream.getTracks().forEach(t => this.pc.addTrack(t, this.localStream));
    }

    sendSignal(signal) {
        this.messenger.socket.emit('rtc_signal', {
            to_user_id: this.remoteUserId,
            signal
        });
    }

    updateStatus(text) {
        if (this.elements.status) this.elements.status.textContent = text;
    }

    showOverlay(statusText) {
        if (this.elements.overlay) this.elements.overlay.style.display = 'flex';
        this.updateStatus(statusText || 'Звонок…');
    }

    hideOverlay() {
        if (this.elements.overlay) this.elements.overlay.style.display = 'none';
        this.cleanup();
    }

    toggleMic() {
        if (!this.localStream) return;
        this.localStream.getAudioTracks().forEach(t => t.enabled = !t.enabled);
    }

    toggleCam() {
        if (!this.localStream) return;
        this.localStream.getVideoTracks().forEach(t => t.enabled = !t.enabled);
    }

    endCall() {
        if (this.remoteUserId) {
            this.messenger.socket.emit('rtc_end_call', { to_user_id: this.remoteUserId });
        }
        this.hideOverlay();
    }

    onRemoteEndCall() {
        this.hideOverlay();
    }

    cleanup() {
        if (this.pc) try { this.pc.close(); } catch(e){}
        this.pc = null;
        if (this.localStream) {
            this.localStream.getTracks().forEach(t => t.stop());
            this.localStream = null;
        }
        this.remoteUserId = null;
        this.chatId = null;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (window.messenger) {
        window.callManager = new CallManager(window.messenger);
    } else {
        const wait = () => {
            if (window.messenger) {
                window.callManager = new CallManager(window.messenger);
            } else {
                setTimeout(wait, 300);
            }
        };
        wait();
    }
});



