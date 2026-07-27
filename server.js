const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// 🔥 Thêm biến lưu trữ Database trên RAM (Cloud Sync)
let cloudDatabase = {};

// Route mặc định để Railway kiểm tra ping xem server còn sống không
app.get('/', (req, res) => {
    res.send('👑 HENDY CYBERPUNK WEBSOCKET SERVER IS ONLINE!');
});

// Xử lý kết nối WebSocket từ Master và các Tab Đàn Em
wss.on('connection', (ws, req) => {
    console.log('[🌐 CLIENT CONNECTED] Có một kết nối mới vừa tham gia!');

    ws.on('message', (message) => {
        try {
            // Phân tích dữ liệu JSON nhận được từ Client
            const data = JSON.parse(message.toString());

            // ==========================================
            // 🔥 XỬ LÝ LỆNH LƯU TRỮ CLOUD DATABASE 🔥
            // ==========================================
            if (data.action === 'SYNC_BACKUP_CONFIG') {
                cloudDatabase = data.value;
                console.log("[☁️ CLOUD] Đã sao lưu (Backup) cấu hình từ Master lên server!");
                return; // Lưu xong thì dừng, không cần broadcast lệnh này đi lung tung
            } 
            else if (data.action === 'SYNC_RESTORE_CONFIG') {
                console.log("[☁️ CLOUD] Master đang yêu cầu tải dữ liệu về...");
                // Gửi trả lại cấu hình cho đúng cái máy (Master) vừa yêu cầu tải về
                ws.send(JSON.stringify({ action: 'SYNC_RESTORE_CONFIG', value: cloudDatabase }));
                return; 
            }

            // ==========================================
            // CHUYỂN TIẾP LỆNH BÌNH THƯỜNG (BROADCAST)
            // ==========================================
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
