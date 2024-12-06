const axios = require('axios');

const api = axios.create({
    baseURL: "http://mes.alphaess.com:8000",
    headers: {
        'Content-Type': 'application/json;charset=UTF-8',
    }
});

class MesApi {
    constructor() {
        this.token = null;
    }

    async login() {
        try {
            const response = await api.post('/api/Account/Login', {
                username: 'RD_inverter',
                password: '1234'
            });

            if (response.data.code === 200) {
                this.token = response.data.data.AccessToken;
                api.defaults.headers.common['Authorization'] = `Bearer ${this.token}`;
                return true;
            }
            return false;
        } catch (error) {
            console.error('Login failed:', error.message);
            return false;
        }
    }

    async getOnlineSystems() {
        try {
            // 定义三种状态
            const states = ['normal', 'protection', 'fault'];

            // 使用 Promise.all 并行请求三个状态的数据
            const results = await Promise.all(states.map(state =>
                api.post('/api/ESS/GetSystems', {
                    sortBy: "registrationtime",
                    searchBy: "sn",
                    state: state,
                    keyword: "",
                    pageIndex: 1,
                    pageSize: 1000,
                    dataCount: 1
                })
            ));

            const allSystems = new Set(
                results.flatMap(response => {
                    // 检查response及其属性链是否存在
                    if (response?.data?.data?.data) {
                        return response.data.data.data.map(item => item.sys_sn);
                    }
                    return []; // 如果数据不存在，返回空数组
                })
            );

            return Array.from(allSystems);

        } catch (error) {
            console.error('Get systems failed:', error.message);
            return [];
        }
    }


    async sendSwitchCommand(sn) {
        try {
            const response = await api.post('/api/ESSMainTain/ActualESSCmdModel', {
                sys_sn: sn,
                cmd_code: "Extra",
                language_code: "zh-CN",
                start_time: "4",
                remark: "6"
            });

            return response.data.code === 200;
        } catch (error) {
            console.error(`Send switch command failed for ${sn}:`, error.message);
            return false;
        }
    }
}

module.exports = new MesApi();
