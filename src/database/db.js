const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs').promises;

class Database {
    constructor() {
        this.db = new sqlite3.Database(path.join(__dirname, 'device.db'));
    }

    async importInitialData() {
        return new Promise(async (resolve, reject) => {
            try {
                // 读取CSV文件
                const content = await fs.readFile(path.join(__dirname, 'snlist.csv'), 'utf-8');
                const snList = content.split('\n').map(sn => sn.trim()).filter(sn => sn);

                // 获取当前数据库中的记录数
                const beforeCount = await this.getTotal();

                // 开始事务
                this.db.serialize(() => {
                    this.db.run('BEGIN TRANSACTION');
                    
                    const stmt = this.db.prepare('INSERT OR IGNORE INTO device_status (sn) VALUES (?)');
                    snList.forEach(sn => {
                        stmt.run(sn);
                    });
                    
                    stmt.finalize();
                    
                    this.db.run('COMMIT', async (err) => {
                        if (err) {
                            console.error('Error committing transaction:', err);
                            reject(err);
                        } else {
                            // 获取更新后的记录数
                            const afterCount = await this.getTotal();
                            const newRecords = afterCount - beforeCount;
                            
                            if (newRecords > 0) {
                                console.log(`Added ${newRecords} new SNs to database`);
                            } else {
                                console.log('No new SNs to add');
                            }
                            resolve();
                        }
                    });
                });
            } catch (error) {
                console.error('Error importing initial data:', error);
                reject(error);
            }
        });
    }

    async init() {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                // 只创建表（如果不存在）
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS device_status (
                        sn TEXT PRIMARY KEY,
                        modify_flag INTEGER DEFAULT 0,
                        modify_time DATETIME,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `, async (err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    
                    try {
                        await this.importInitialData();
                        resolve();
                    } catch (error) {
                        reject(error);
                    }
                });
            });
        });
    }

    // 获取总记录数的辅助方法
    async getTotal() {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT COUNT(*) as count FROM device_status', (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row.count);
                }
            });
        });
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
                'SELECT * FROM device_status',
                [],
                (err, rows) => err ? reject(err) : resolve(rows)
            );
        });
    }

    close() {
        return new Promise((resolve, reject) => {
            this.db.close((err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }
}

// 如果直接运行此文件，则初始化数据库
if (require.main === module) {
    const db = new Database();
    db.init().then(async () => {
        // 获取并显示当前总记录数
        const total = await db.getTotal();
        console.log(`Total records in database: ${total}`);
        
        // 关闭数据库连接
        await db.close();
        process.exit(0);
    }).catch(error => {
        console.error('Database initialization failed:', error);
        process.exit(1);
    });
}

module.exports = new Database();
