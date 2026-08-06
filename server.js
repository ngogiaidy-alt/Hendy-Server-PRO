const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 8080;
const SECRET_KEY = process.env.SECRET_KEY || 'HENDY_VIP_PRO_2026'; // Chìa khóa bảo mật

// ==============================================================
// 🧠 CỤC RAM VĨNH CỬU (DATABASE TẠM)
// ==============================================================
const DB = {
    master: null,             // Socket của Trạm Mẹ (Tool điều khiển)
    dashboard: null,          // Socket của Giao diện Web Giám Sát
    slaves: new Map(),        // Sổ Nam Tào ghi chú Đàn em
    logs: []                  // Lưu lại 50 dòng log gần nhất
};

// Hàm gửi log ra Dashboard web
function sysLog(msg, type = 'info') {
    const time = new Date().toLocaleTimeString('vi-VN');
    const logStr = `[${time}] ${msg}`;
    console.log(logStr);
    
    DB.logs.push({ time, msg, type });
    if (DB.logs.length > 50) DB.logs.shift();

    if (DB.dashboard && DB.dashboard.readyState === WebSocket.OPEN) {
        DB.dashboard.send(JSON.stringify({ action: 'UPDATE_LOGS', value: DB.logs }));
    }
}

// Cập nhật lại UI cho Dashboard
function syncDashboard() {
    if (DB.dashboard && DB.dashboard.readyState === WebSocket.OPEN) {
        const slavesData = Array.from(DB.slaves.values());
        DB.dashboard.send(JSON.stringify({ 
            action: 'SYNC_DASHBOARD', 
            masterOnline: !!DB.master,
            slaves: slavesData 
        }));
    }
}

// ==============================================================
// 🌐 GIAO DIỆN GIÁM SÁT TRÊN TRÌNH DUYỆT (CYBERPUNK DASHBOARD)
// ==============================================================
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="vi">
        <head>
            <meta charset="UTF-8">
            <title>🛸 TRẠM VŨ TRỤ HENDY HUB</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap');
                * { box-sizing: border-box; }
                body { background: #050208; color: #00e5ff; font-family: 'Share Tech Mono', monospace; margin: 0; padding: 20px; }
                .container { max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: 1fr 300px; gap: 20px; }
                @media (max-width: 768px) { .container { grid-template-columns: 1fr; } }
                
                .box { border: 1px solid #c840ff; padding: 20px; border-radius: 8px; background: rgba(10,4,16,0.8); box-shadow: 0 0 15px rgba(200,64,255,0.2); }
                .header { text-align: center; grid-column: 1 / -1; }
                h1 { color: #ffcc00; text-shadow: 0 0 10px rgba(255,204,0,0.5); margin-top: 0; }
                
                .status-badge { padding: 5px 10px; border-radius: 4px; font-weight: bold; border: 1px solid; display: inline-block; }
                .online { color: #00ffcc; border-color: #00ffcc; background: rgba(0,255,204,0.1); box-shadow: 0 0 8px rgba(0,255,204,0.4); }
                .offline { color: #ff3366; border-color: #ff3366; background: rgba(255,51,102,0.1); box-shadow: 0 0 8px rgba(255,51,102,0.4); }
                
                table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                th, td { border-bottom: 1px dashed #5a1885; padding: 10px; text-align: left; }
                th { color: #c840ff; }
                .tag { font-size: 10px; padding: 2px 5px; background: #333; border-radius: 3px; color: #fff; }
                
                .terminal { background: #000; border: 1px solid #333; border-radius: 4px; height: 400px; overflow-y: auto; padding: 10px; font-size: 12px; }
                .terminal p { margin: 3px 0; }
                .log-info { color: #aaa; }
                .log-warn { color: #ffcc00; }
                .log-err { color: #ff3366; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="box header">
                    <h1>🚀 HENDY CYBERPUNK HUB 🚀</h1>
                    <p>Hệ thống giám sát Đàn em tự động hóa thời gian thực</p>
                </div>
                
                <div class="box">
                    <h3 style="color:#fff; margin-top:0">👥 DANH SÁCH ĐÀN EM (<span id="slaveCount">0</span>)</h3>
                    <div style="overflow-x:auto;">
                        <table>
                            <thead><tr><th>ID / Tên</th><th>Nền tảng</th><th>Trạng thái</th></tr></thead>
                            <tbody id="slaveTable">
                                <tr><td colspan="3" style="text-align:center; color:#555;">Đang chờ kết nối...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <div class="box">
                    <h3 style="color:#fff; margin-top:0">⚙️ TRẠNG THÁI HỆ THỐNG</h3>
                    <div style="margin-bottom: 20px;">
                        <div>Trạm Mẹ (Master Script):</div>
                        <div id="masterStatus" class="status-badge offline" style="margin-top:5px;">🔴 MẤT KẾT NỐI</div>
                    </div>
                    
                    <h3 style="color:#fff;">🖥 TERMINAL LOG</h3>
                    <div class="terminal" id="termLog"></div>
                </div>
            </div>

            <script>
                // Tự động kết nối WebSocket từ trình duyệt về chính server này
                const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                const ws = new WebSocket(protocol + '//' + window.location.host);
                
                ws.onopen = () => {
                    ws.send(JSON.stringify({ action: 'SYNC_REGISTER_DASHBOARD', key: '${SECRET_KEY}' }));
                };

                ws.onmessage = (event) => {
                    const data = JSON.parse(event.data);
                    
                    if (data.action === 'SYNC_DASHBOARD') {
                        // Cập nhật trạng thái Master
                        const ms = document.getElementById('masterStatus');
                        ms.className = data.masterOnline ? 'status-badge online' : 'status-badge offline';
                        ms.innerText = data.masterOnline ? '🟢 ĐÃ KẾT NỐI' : '🔴 MẤT KẾT NỐI';
                        
                        // Cập nhật danh sách Đàn em
                        document.getElementById('slaveCount').innerText = data.slaves.length;
                        const tbody = document.getElementById('slaveTable');
                        if (data.slaves.length === 0) {
                            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#555;">Không có Đàn em nào online</td></tr>';
                        } else {
                            tbody.innerHTML = data.slaves.map(s => \`
                                <tr>
                                    <td><b style="color:#00e5ff">\${s.name || 'Khách'}</b><br><span style="font-size:10px;color:#888">\${s.id}</span></td>
                                    <td><span class="tag" style="background:\${s.brand==='C168'?'#2980b9':(s.brand==='SC88'?'#c0392b':'#d35400')}">\${s.brand || 'CM88'}</span></td>
                                    <td style="color:#0f0">Online</td>
                                </tr>
                            \`).join('');
                        }
                    }
                    
                    if (data.action === 'UPDATE_LOGS') {
                        const term = document.getElementById('termLog');
                        term.innerHTML = data.value.map(l => 
                            \`<p class="log-\${l.type}">[\${l.time}] \${l.msg}</p>\`
                        ).join('');
                        term.scrollTop = term.scrollHeight;
                    }
                };
            </script>
        </body>
        </html>
    `);
});

// ==============================================================
// ⚡ XỬ LÝ GIAO TIẾP WEBSOCKET (TRÁI TIM HỆ THỐNG)
// ==============================================================
wss.on('connection', (ws, req) => {
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            const action = data.action;

            // 0. ĐĂNG KÝ GIAO DIỆN WEB GIÁM SÁT
            if (action === 'SYNC_REGISTER_DASHBOARD') {
                if (data.key === SECRET_KEY) {
                    DB.dashboard = ws;
                    sysLog('💻 Dashboard Giám sát đã kết nối thành công!', 'info');
                    syncDashboard();
                    ws.send(JSON.stringify({ action: 'UPDATE_LOGS', value: DB.logs }));
                } else {
                    ws.close(); // Sai pass thì sút
                }
                return;
            }

            // 1. TRẠM MẸ XƯNG DANH
            if (action === 'SYNC_REGISTER_MASTER') {
                DB.master = ws;
                sysLog('👑 [MASTER] Trạm Mẹ đã lên sóng!', 'warn');
                ws.send(JSON.stringify({ action: 'SYNC_TAB_LIST', value: Array.from(DB.slaves.values()) }));
                syncDashboard();
                return;
            }

            // 2. ĐÀN EM XƯNG DANH
            if (action === 'SYNC_REGISTER_TAB' || action === 'SYNC_PING_RESPONSE') {
                if (data.value && data.value.id) {
                    // Trích xuất thương hiệu web từ URL nếu có
                    let brand = 'CM88';
                    if (data.value.url) {
                        if (data.value.url.includes('c168')) brand = 'C168';
                        if (data.value.url.includes('sc88')) brand = 'SC88';
                    }
                    data.value.brand = brand;

                    DB.slaves.set(data.value.id, data.value);
                    ws.slaveId = data.value.id; 
                    
                    if(action === 'SYNC_REGISTER_TAB') {
                        sysLog(`🟢 [SLAVE IN] Đàn em [${data.value.name || ws.slaveId}] (${brand}) báo cáo!`, 'info');
                        syncDashboard();
                        // Báo cho Trạm Mẹ biết có lính mới
                        if (DB.master && DB.master.readyState === WebSocket.OPEN) {
                            DB.master.send(JSON.stringify({ action: 'SYNC_TAB_LIST', value: Array.from(DB.slaves.values()) }));
                        }
                    }
                }
                return;
            }

            // 3. KHI TRẠM MẸ CHỦ ĐỘNG HỎI
            if (action === 'SYNC_REQUEST_TAB_LIST') {
                if (DB.master && DB.master.readyState === WebSocket.OPEN) {
                    DB.master.send(JSON.stringify({ action: 'SYNC_TAB_LIST', value: Array.from(DB.slaves.values()) }));
                }
                return; 
            }

            // 4. PHÁT LỆNH BÌNH THƯỜNG (Cướp kèo, Chạy Code...)
            // Phát cho tất cả trừ Dashboard và người gửi
            wss.clients.forEach((client) => {
                if (client !== ws && client !== DB.dashboard && client.readyState === WebSocket.OPEN) {
                    client.send(message.toString());
                }
            });

        } catch (err) {
            // sysLog('❌ Lỗi xử lý tin nhắn: Dữ liệu rác', 'err');
        }
    });

    // 5. XỬ LÝ KHI CÓ KẺ RỚT MẠNG
    ws.on('close', () => {
        if (ws === DB.dashboard) {
            DB.dashboard = null;
        } else if (ws === DB.master) {
            sysLog('⚠️ [MASTER OUT] Trạm Mẹ đã ngắt kết nối!', 'err');
            DB.master = null;
            syncDashboard();
        } else if (ws.slaveId) {
            const slaveData = DB.slaves.get(ws.slaveId);
            const name = slaveData ? slaveData.name : ws.slaveId;
            sysLog(`🔴 [SLAVE OUT] Đàn em [${name}] đã chết hoặc rớt mạng.`, 'warn');
            
            DB.slaves.delete(ws.slaveId);
            syncDashboard();
            
            // Báo cáo Trạm Mẹ trừ quân số
            if (DB.master && DB.master.readyState === WebSocket.OPEN) {
                DB.master.send(JSON.stringify({ action: 'SYNC_TAB_LIST', value: Array.from(DB.slaves.values()) }));
            }
        }
    });
});

// ==============================================================
// 💓 NHỊP TIM BẢO VỆ MẠNG (TỐI ƯU CHO RENDER/RAILWAY)
// ==============================================================
const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
            if (ws.slaveId) {
                DB.slaves.delete(ws.slaveId);
                syncDashboard();
            }
            return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
    });
}, 15000); 

wss.on('close', () => clearInterval(interval));

// ==============================================================
// 🚀 KHỞI ĐỘNG ĐỘNG CƠ
// ==============================================================
server.listen(PORT, () => {
    console.log(`
   ██╗  ██╗███████╗███╗   ██╗██████╗ ██╗   ██╗
   ██║  ██║██╔════╝████╗  ██║██╔══██╗╚██╗ ██╔╝
   ███████║█████╗  ██╔██╗ ██║██║  ██║ ╚████╔╝ 
   ██╔══██║██╔══╝  ██║╚██╗██║██║  ██║  ╚██╔╝  
   ██║  ██║███████╗██║ ╚████║██████╔╝   ██║   
   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═══╝╚═════╝    ╚═╝   
    `);
    console.log(`🚀 TỔNG ĐÀI HENDY HUB ĐÃ LÊN SÓNG TẠI PORT ${PORT} 🚀`);
});