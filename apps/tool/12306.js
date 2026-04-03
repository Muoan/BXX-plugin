import plugin from '../../../../lib/plugins/plugin.js';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import yaml from 'yaml';

export class TrainStationScreen extends plugin {
  constructor() {
    super({
      name: '不羡仙:12306火车站大屏',
      dsc: '查询指定火车站的实时候车与到达信息',
      event: 'message',
      priority: 500,
      rule: [
        {
          reg: '^#([\\u4e00-\\u9fa5a-zA-Z0-9]+)火车站大屏$',
          fnc: 'queryStationScreen'
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
      const apiUrl = apiConfig['12306API'];
      const apiKey = keyConfig['12306KEY'];

      if (!apiUrl || typeof apiUrl !== 'string') throw new Error('12306API 配置无效');
      if (!apiKey || typeof apiKey !== 'string') throw new Error('12306KEY 配置无效');

      return { apiUrl, apiKey };
    } catch (err) {
      throw new Error('读取配置失败: ' + err.message);
    }
  }

  buildTrainMessage(train, type) {
    let msg = '';
    switch (type) {
      case 'waiting': // 正在候车
        msg = `🚆 车次：${train.trainNo}\n` +
              `终点站：${train.endStationName}\n` +
              `发车时间：${train.departTime}\n` +
              `候车室/检票口：${train.waitingRoom || '未知'}/${train.wicket || '未知'}\n` +
              `状态：${train.waitingState || '正在候车'}\n` +
              `计划时间：${train.departDateTime || '未知'}`;
        break;
      case 'invalidWaiting': // 已出发
        msg = `🚆 车次：${train.trainNo}\n` +
              `终点站：${train.endStationName}\n` +
              `发车时间：${train.departTime}\n` +
              `状态：${train.waitingState || '已出发'}\n` +
              `计划时间：${train.departDateTime || '未知'}`;
        break;
      case 'arrival': // 未到站
        msg = `🚆 车次：${train.trainNo}\n` +
              `始发站：${train.startStationName}\n` +
              `到达时间：${train.arrivalTime}\n` +
              `出口：${train.exitingPort || '未知'}\n` +
              `状态：${train.arrivalState || '正点'}`;
        break;
      case 'invalidArrival': // 已到站
        msg = `🚆 车次：${train.trainNo}\n` +
              `始发站：${train.startStationName}\n` +
              `到达时间：${train.arrivalTime}\n` +
              `出口：${train.exitingPort || '未知'}\n` +
              `状态：${train.arrivalState || '已到站'}`;
        break;
      default:
        msg = `车次：${train.trainNo}\n其他信息请查看详情`;
    }
    return msg;
  }

  async sendSplitForwardMsg(e, msgList, title = '火车站大屏信息') {
    if (!msgList || msgList.length === 0) {
      await e.reply('暂无相关车次信息');
      return;
    }

    const forwardItems = msgList.map(text => ({
      message: text,
      nickname: Bot.nickname || '不羡仙机器人',
      user_id: Bot.uin || e.self_id
    }));

    const chunkSize = 100;
    const chunks = [];
    for (let i = 0; i < forwardItems.length; i += chunkSize) {
      chunks.push(forwardItems.slice(i, i + chunkSize));
    }

    for (let idx = 0; idx < chunks.length; idx++) {
      const chunk = chunks[idx];
      try {
        let forwardMsg;
        if (e.friend) {
          forwardMsg = await Bot.makeForwardMsg(chunk);
        } else if (e.group) {
          forwardMsg = await e.group.makeForwardMsg(chunk);
        } else {
          forwardMsg = await Bot.makeForwardMsg(chunk);
        }
        await e.reply(forwardMsg);
        if (idx < chunks.length - 1) await this.sleep(500);
      } catch (err) {
        console.error('合并转发发送失败:', err);
        await e.reply(`部分信息发送失败：${err.message.slice(0, 100)}`);
      }
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async queryStationScreen(e) {
    const match = e.msg.match(/^#([\u4e00-\u9fa5a-zA-Z0-9]+)火车站大屏$/);
    if (!match || !match[1]) {
      return await e.reply('命令格式错误，请使用 #【火车站名】火车站大屏，例如 #北京火车站大屏');
    }
    const stationName = match[1];
    try {
      const { apiUrl, apiKey } = await this.getApiConfig();
      const requestUrl = `${apiUrl}?apikey=${apiKey}&stationName=${encodeURIComponent(stationName)}`;
      const response = await axios.get(requestUrl, { timeout: 15000 });
      const result = response.data;

      if (result.code !== 1) {
        return await e.reply(result.msg || '查询失败，请稍后重试');
      }

      const data = result.data;
      if (!data || (!data.departure && !data.arrival)) {
        return await e.reply('未查询到该火车站的相关信息');
      }

      const messageList = [];

      messageList.push(`🚉 【${stationName}】火车站大屏信息（仅供参考）\n查询时间：${new Date().toLocaleString()}`);

      if (data.departure?.stationWaitingScreens?.length > 0) {
        messageList.push(`\n📌 【正在候车】共 ${data.departure.stationWaitingScreens.length} 趟`);
        data.departure.stationWaitingScreens.forEach(train => {
          messageList.push(this.buildTrainMessage(train, 'waiting'));
        });
      } else {
        messageList.push('\n📌 【正在候车】暂无');
      }

      if (data.departure?.invalidWaitingScreens?.length > 0) {
        messageList.push(`\n🚀 【已出发车次】共 ${data.departure.invalidWaitingScreens.length} 趟`);
        data.departure.invalidWaitingScreens.forEach(train => {
          messageList.push(this.buildTrainMessage(train, 'invalidWaiting'));
        });
      } else {
        messageList.push('\n🚀 【已出发车次】暂无');
      }

      if (data.arrival?.stationArrivalScreens?.length > 0) {
        messageList.push(`\n🛬 【未到站车次】共 ${data.arrival.stationArrivalScreens.length} 趟`);
        data.arrival.stationArrivalScreens.forEach(train => {
          messageList.push(this.buildTrainMessage(train, 'arrival'));
        });
      } else {
        messageList.push('\n🛬 【未到站车次】暂无');
      }

      if (data.arrival?.invalidArrivalScreens?.length > 0) {
        messageList.push(`\n✅ 【已到站车次】共 ${data.arrival.invalidArrivalScreens.length} 趟`);
        data.arrival.invalidArrivalScreens.forEach(train => {
          messageList.push(this.buildTrainMessage(train, 'invalidArrival'));
        });
      } else {
        messageList.push('\n✅ 【已到站车次】暂无');
      }

      messageList.push('\n⚠️ 以上信息来源于第三方接口，仅供参考，请以车站实际公告为准。');

      await this.sendSplitForwardMsg(e, messageList, `${stationName}火车站大屏`);

    } catch (err) {
      console.error('12306大屏查询错误:', err);
      await e.reply(`查询失败：${err.message || '未知错误'}`);
    }
  }
}

export default TrainStationScreen;