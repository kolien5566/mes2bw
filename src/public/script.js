const { createApp, ref, computed } = Vue;

createApp({
    setup() {
        const devices = ref([]);
        const pendingSearch = ref('');
        const modifiedSearch = ref('');
        
        // 过滤待修改设备
        const filteredPendingDevices = computed(() => {
            return devices.value
                .filter(device => !device.modify_flag)
                .filter(device => 
                    device.sn.toLowerCase().includes(pendingSearch.value.toLowerCase())
                );
        });

        // 过滤已修改设备
        const filteredModifiedDevices = computed(() => {
            return devices.value
                .filter(device => device.modify_flag)
                .filter(device => 
                    device.sn.toLowerCase().includes(modifiedSearch.value.toLowerCase())
                );
        });

        // 加载数据
        const loadDevices = async () => {
            try {
                const response = await fetch('/api/devices');
                devices.value = await response.json();
            } catch (error) {
                console.error('Error loading devices:', error);
                alert('加载数据失败，请重试');
            }
        };

        // 刷新数据
        const refreshData = async () => {
            await loadDevices();
        };

        // 格式化时间
        const formatTime = (timestamp) => {
            if (!timestamp) return '';
            return new Date(timestamp).toLocaleString();
        };

        // 初始加载
        loadDevices();

        return {
            devices,
            pendingSearch,
            modifiedSearch,
            filteredPendingDevices,
            filteredModifiedDevices,
            refreshData,
            formatTime
        };
    }
}).mount('#app');
