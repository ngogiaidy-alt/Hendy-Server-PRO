const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Route mặc định để Railway kiểm tra ping xem server còn sống không
app.get('/', (req, res) => {
    res.send('👑 HENDY CYBERPUNK WEBSOCKET SERVER IS ONLINE!');
});

// Xử lý kết nối WebSocket từ Master và các Tab Đàn Em
wss.on('connection', (ws, req) => {
    console.log('[🌐 CLIENT CONNECTED] Có một kết nối mới vừa tham gia!');

    ws.on('message', (message) => {
        try {
            // Chuyển tiếp tin nhắn đến toàn bộ các máy khác (Broadcast)
            wss.clients.forEach((client) => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(message.toString());
                }
            });
        } catch (e) {
            console.error('[❌ ERROR] Lỗi phân tích dữ liệu WebSocket:', e);
        }
    });

    ws.on('close', () => {
        console.log('[🔌 CLIENT DISCONNECTED] Một kết nối vừa ngắt.');
    });

    ws.on('error', (error) => {
        console.error('[❌ WS ERROR] Lỗi kết nối:', error);
    });
});

// BẮT BUỘC CÓ: Lấy cổng động từ hệ thống Railway cấp phát
const PORT = process.env.PORT || 8080;

server.listen(PORT, () => {
    console.log(`🚀 HENDY SERVER ĐANG CHẠY THÀNH CÔNG TRÊN CỔNG ${PORT}`);
});