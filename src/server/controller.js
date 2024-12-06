const cron = require('node-cron');
const api = require('./api');
const db = require('../database/db');

class Controller {
    async processDevices() {
        // 1. Login
        const loginSuccess = await api.login();
        if (!loginSuccess) {
            console.error('Login failed, stopping process');
            return;
        }

        // 2. Get online systems
        const onlineSNList = await api.getOnlineSystems();
        console.log(`Found ${onlineSNList.length} online systems`);

        // 3. Get unmodified devices from DB
        const bwDevices = await this.getAllDevices();
        const bwSNList = bwDevices.map(item => item.sn);

        // 4. Find intersection
        const devicesToUpdate = onlineSNList.filter(sn => bwSNList.includes(sn));
        console.log(`Update ${devicesToUpdate}`);

        // 5. Send commands and update DB
        for (const deviceSN of devicesToUpdate) {
            const success = await api.sendSwitchCommand(deviceSN);
            if (success) {
                await db.markModified(deviceSN);
                console.log(`Successfully updated device: ${deviceSN}`);
            }
        }
    }

    async getAllDevices() {
        return await db.getAllDevices();
    }

    startScheduler() {
        // 立即执行一次
        this.processDevices().catch(error => {
            console.error('Error in process:', error);
        });

        // 每小时执行一次
        cron.schedule('*/15 * * * *', () => {
            this.processDevices().catch(error => {
                console.error('Error in scheduled process:', error);
            });
        });
    }
}

module.exports = new Controller();
