const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs').promises;

class Database {
    constructor() {
        this.db = new sqlite3.Database(path.join(__dirname, '../database/device.db'));
    }

    async init() {
        // 创建表
        await this.createTable();
        // 导入数据
        await this.importInitialData();
        console.log('Database initialized successfully');
    }

    async createTable() {
        return new Promise((resolve, reject) => {
            this.db.run(`
                CREATE TABLE IF NOT EXISTS device_status (
                    sn TEXT PRIMARY KEY,
                    modify_flag INTEGER DEFAULT 0,
                    modify_time DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    async importInitialData() {
        try {
            // 读取CSV文件
            const content = await fs.readFile(path.join(__dirname, '../snlist.csv'), 'utf-8');
            const snList = content.split('\n').map(sn => sn.trim()).filter(sn => sn);

            // 批量插入数据
            const stmt = this.db.prepare('INSERT OR IGNORE INTO device_status (sn) VALUES (?)');
            for (const sn of snList) {
                stmt.run(sn);
            }
            stmt.finalize();

            console.log(`Imported ${snList.length} SNs from file`);
        } catch (error) {
            console.error('Error importing initial data:', error);
        }
    }

    async markModified(sn) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE device_status SET modify_flag = 1, modify_time = CURRENT_TIMESTAMP WHERE sn = ?',
                [sn],
                (err) => err ? reject(err) : resolve()
            );
        });
    }

    async getAllDevices() {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT * FROM device_status ORDER BY created_at DESC',
                [],
                (err, rows) => err ? reject(err) : resolve(rows)
            );
        });
    }

    async getUnmodifiedDevices() {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT sn FROM device_status WHERE modify_flag = 0',
                [],
                (err, rows) => err ? reject(err) : resolve(rows.map(row => row.sn))
            );
        });
    }
}

// 如果直接运行此文件，则初始化数据库
if (require.main === module) {
    const db = new Database();
    db.init().then(() => {
        console.log('Database initialization complete');
        process.exit(0);
    }).catch(error => {
        console.error('Database initialization failed:', error);
        process.exit(1);
    });
}

module.exports = new Database();
