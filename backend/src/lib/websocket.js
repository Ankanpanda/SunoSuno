const WebSocket = require('ws');

class WebSocketServer {
    constructor(server) {
        this.wss = new WebSocket.Server({ server });
        this.clients = new Map();
        this.setupWebSocket();
    }

    setupWebSocket() {
        this.wss.on('connection', (ws, req) => {
            const userId = req.url.split('?userId=')[1];
            this.clients.set(userId, ws);

            ws.on('message', (message) => {
                const data = JSON.parse(message);
                this.handleMessage(userId, data);
            });

            ws.on('close', () => {
                this.clients.delete(userId);
            });
        });
    }

    handleMessage(senderId, data) {
        const { type, targetUserId, payload } = data;

        switch (type) {
            case 'offer':
            case 'answer':
            case 'ice-candidate':
                const targetClient = this.clients.get(targetUserId);
                if (targetClient) {
                    targetClient.send(JSON.stringify({
                        type,
                        senderId,
                        payload
                    }));
                }
                break;
        }
    }
}

module.exports = WebSocketServer; 