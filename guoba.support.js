import path from 'path'
import { readYamlConfig, writeYamlConfig } from './guoba/utils.js'
import { allSchemas, getAllData, setAllData } from './guoba/loader.js'

export function supportGuoba() {
    return {
        pluginInfo: {
            name: 'BXX-plugin',
            title: '不羡仙插件',
            author: '@不羡仙',
            authorLink: 'https://github.com/Muoan/BXX-plugin',
            isV3: true,
            isV2: false,
            description: '不羡仙插件提供娱乐/管理/API功能，Yunzai论坛：https://yunz.cc，交流群：872488071',
            showInMenu: 'auto',
            icon: 'mdi:rocket-launch',
            iconColor: '#00a2ffff'
        },
        configInfo: {
            schemas: allSchemas,
            getConfigData() {
                return getAllData(readYamlConfig)
            },
            setConfigData(configData) {
                return setAllData(configData, writeYamlConfig)
            }
        }
    }
}
