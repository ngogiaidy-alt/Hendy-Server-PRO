const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// ==========================================
// ☁️ CẤU HÌNH CLOUDFLARE KV DATABASE ☁️
// ==========================================
const CF_ACCOUNT_ID = 'de52fb6407e307a6f0c2f8958c0b7653';
const CF_NAMESPACE_ID = '7634f67edcff467eb4c90accaf77c028';
const CF_API_TOKEN = 'cfut_ug52v8mTlvSQVCnuCW2KhTVQtOCViLUqZCj8Z30ne7dda34e'; 

const KV_KEY = 'master_config'; // Tên file lưu trong Database
const KV_URL = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/storage/kv/namespaces/${CF_NAMESPACE_ID}/values/${KV_KEY}`;

// Hàm lưu dữ liệu lên Cloudflare
async function saveToCloudflare(data) {
    if (!CF_API_TOKEN || CF_API_TOKEN.includes('ĐIỀN_API_TOKEN')) {
        console.log("[⚠️ CẢNH BÁO] API Token chưa hợp lệ, không thể lưu lên Cloudflare!");
        return;
    }
    try {
        await fetch(KV_URL, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${CF_API_TOKEN}` },
            body: JSON.stringify(data)
        });
        console.log("[☁️ CLOUD] Đã lưu thành công vào Cloudflare KV!");
    } catch (e) {
        console.error("[❌ CLOUD ERROR] Lỗi khi lưu lên Cloudflare:", e);
    }
}

// Hàm tải dữ liệu từ Cloudflare về
async function getFromCloudflare() {
    if (!CF_API_TOKEN || CF_API_TOKEN.includes('ĐIỀN_API_TOKEN')) return {};
    try {
        let res = await fetch(KV_URL, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${CF_API_TOKEN}` }
        });
        if (res.ok) {
            return await res.json();
        }
        return {};
    } catch (e) {
        console.error("[❌ CLOUD ERROR] Lỗi khi tải từ Cloudflare:", e);
        return {};
    }
}

// Biến lưu đệm trên RAM để máy chủ chạy nhanh
let cloudDatabase = {};

// Khởi động server, tự động kéo data từ DB về RAM
getFromCloudflare().then(data => {
    if (Object.keys(data).length > 0) {
        cloudDatabase = data;
        console.log("[☁️ CLOUD] Đã kéo xong Dữ liệu cũ từ Database lúc khởi động!");
    }
});

// Route test Server
app.get('/', (req, res) => {
    res.send('👑 HENDY CYBERPUNK WEBSOCKET SERVER IS ONLINE & SYNCED WITH CLOUDFLARE!');
});

// Xử lý WebSocket
wss.on('connection', (ws, req) => {
    console.log('[🌐 CLIENT CONNECTED] Có kết nối mới!');

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message.toString());

            // 🔥 XỬ LÝ LỆNH TỪ DATABASE 🔥
            if (data.action === 'SYNC_BACKUP_CONFIG') {
                cloudDatabase = data.value; // Lưu tạm vào RAM
                await saveToCloudflare(cloudDatabase); // Đẩy chết cứng lên Cloudflare
                return;
            } 
            else if (data.action === 'SYNC_RESTORE_CONFIG') {
                console.log("[☁️ CLOUD] Master đang tải dữ liệu về máy...");
                let dbData = await getFromCloudflare(); // Kéo từ Cloudflare về
                if (Object.keys(dbData).length > 0) {
                    cloudDatabase = dbData; 
                }
                ws.send(JSON.stringify({ action: 'SYNC_RESTORE_CONFIG', value: cloudDatabase }));
                return; 
            }

            // CHUYỂN TIẾP LỆNH XUỐNG ĐÀN EM (Broadcast)
            wss.clients.forEach((client) => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(message.toString());
                }
            });
            
        } catch (e) {
            console.error('[❌ ERROR] Lỗi WS:', e);
        }
    });

    ws.on('close', () => console.log('[🔌 CLIENT DISCONNECTED] Ngắt kết nối.'));
    ws.on('error', (err) => console.error('[❌ WS ERROR]:', err));
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`🚀 HENDY SERVER ĐANG CHẠY TRÊN CỔNG ${PORT}`);
});
