const express = require('express');
const path = require('path');
const controller = require('./controller');

const app = express();

// 静态文件服务
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json());

// API路由
app.get('/api/devices', async (req, res) => {
    try {
        const devices = await controller.getAllDevices();
        res.json(devices);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = 3001;
// 启动服务器
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    // 启动定时任务
    controller.startScheduler();
});
