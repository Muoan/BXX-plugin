import plugin from '../../../../lib/plugins/plugin.js';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import yaml from 'yaml';

export class IDC extends plugin {
  constructor() {
    super({
      name: '不羡仙:IDC上游商品查询',
      dsc: '查询上游IDC商品名称与地址',
      event: 'message',
      priority: 0,
      rule: [
        {
          reg: '^#([\\s\\S]+)上游商品(\\d+)查询$',
          fnc: 'queryIdcProduct'
        }
      ]
    });
  }

  async getApiConfig() {
    try {
      const rootPath = process.cwd();
      const apiPath = path.join(rootPath, 'plugins/BXX-plugin/data/API/TOOLAPI.yaml');
      const keyPath = path.join(rootPath, 'plugins/BXX-plugin/data/KEY/TOOLKEY.yaml');
      if (!fs.existsSync(apiPath)) throw new Error('TOOLAPI.yaml 配置文件不存在');
      if (!fs.existsSync(keyPath)) throw new Error('TOOLKEY.yaml 配置文件不存在');

      const apiContent = fs.readFileSync(apiPath, 'utf8');
      const keyContent = fs.readFileSync(keyPath, 'utf8');
      const apiConfig = yaml.parse(apiContent);
      const keyConfig = yaml.parse(keyContent);
      const apiUrl = apiConfig['IDCAPI'];
      const apiKey = keyConfig['IDCKEY'];

      if (!apiUrl || typeof apiUrl !== 'string') throw new Error('IDCAPI 配置无效');
      if (!apiKey || typeof apiKey !== 'string') throw new Error('IDCKEY 配置无效');

      return { apiUrl, apiKey };
    } catch (err) {
      throw new Error('读取配置失败: ' + err.message);
    }
  }

  async queryIdcProduct(e) {
    try {
      const match = e.msg.match(/^#([\s\S]+)上游商品(\d+)查询$/);
      if (!match || !match[1] || !match[2]) {
        return await e.reply('命令格式错误！\n正确格式：#【域名/网址】上游商品【PID】查询\n示例：#02vps.cn上游商品123查询');
      }
      const userUrl = match[1].trim(); // 值1：域名/网址
      const userPid = match[2].trim(); // 值2：商品PID
      const { apiUrl, apiKey } = await this.getApiConfig();
      const requestUrl = `${apiUrl}?apikey=${apiKey}&url=${encodeURIComponent(userUrl)}&pid=${userPid}`;
      const response = await axios.get(requestUrl, {
        timeout: 15000,
        headers: { 'User-Agent': 'BXX-Plugin/IDC' }
      });

      const result = response.data;

      if (result.code !== 1) {
        return await e.reply(`❌ 查询失败\n原因：${result.msg || '接口返回异常'}`);
      }

      const { product_name, product_url } = result.data;
      const replyMsg = [
        '✅ 上游商品查询成功',
        `商品名称：${product_name || '未获取到商品名'}`,
        `商品地址：${product_url || '未获取到商品地址'}`
      ].join('\n');

      await e.reply(replyMsg);

    } catch (err) {
      console.error('IDC上游商品查询错误:', err);
      await e.reply(`❌ 查询异常\n${err.message.slice(0, 100)}`);
    }
  }
}

export default IDC;