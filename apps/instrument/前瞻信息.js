import plugin from '../../../../lib/plugins/plugin.js'
import fetch from 'node-fetch'

export default class ForwardInfo extends plugin {
    constructor() {
        super({
            name: '不羡仙:兑换码',
            dsc: '原神/星铁/绝区零兑换码查询',
            event: 'message',
            priority: 100,
            rule: [
                { reg: '^(#原神兑换码|#星铁兑换码|#绝区零兑换码|#兑换码)$', fnc: 'getCode' }
            ]
        })
    }

    async getCode() {
        const games = [
            { name: '原神', uid: '75276539', gid: '2' },
            { name: '崩坏：星穹铁道', uid: '80823548', gid: '6' },
            { name: '绝区零', uid: '152039148', gid: '8' }
        ]

        let target
        if (/星铁/.test(this.e.msg)) target = games[1]
        else if (/绝区零/.test(this.e.msg)) target = games[2]
        else target = games[0]

        this.now = parseInt(Date.now() / 1000)
        this.gid = target.gid
        this.code_ver = ''

        let actid = await this.getActId(target.uid)
        if (!actid) actid = await this.getBackupActId(target.gid)
        if (!actid) {
            return await this.e.reply(`暂无${target.name}前瞻直播兑换码或已过期`, true)
        }

        this.actId = actid
        let index = await this.getData('index')
        if (!index?.data?.live) {
            return await this.e.reply('获取兑换码信息失败', true)
        }

        this.code_ver = index.data.live.code_ver
        let code = await this.getData('code')
        if (!code?.data?.code_list?.length) {
            return await this.e.reply('暂未找到可用的兑换码', true)
        }

        let codes = []
        for (const item of code.data.code_list) {
            if (item.code) codes.push(item.code)
        }
        if (!codes.length) {
            return await this.e.reply('暂未找到可用的兑换码', true)
        }

        await this.e.reply(codes.join('\n'))
        return true
    }

    async getActId(uid) {
        let ret = await this._fetch(
            `https://bbs-api.mihoyo.com/painter/api/user_instant/list?offset=0&size=20&uid=${uid}`,
            { Referer: 'https://www.miyoushe.com', 'User-Agent': 'Mozilla/5.0' }
        )
        if (ret?.data?.list) {
            for (const p of ret.data.list) {
                let post = p?.post?.post
                if (!post?.structured_content) continue
                let m = post.structured_content.match(/{"link":"https:\/\/webstatic.mihoyo.com\/bbs\/event\/live\/index.html\?act_id=(.*?)\\/)
                if (m) return m[1]
            }
        }
        return ''
    }

    async getBackupActId(gid) {
        let res = await this._fetch(
            `https://bbs-api.miyoushe.com/apihub/api/home/new?gids=${gid}&parts=1%2C3%2C4`,
            { Referer: 'https://www.miyoushe.com', 'User-Agent': 'Mozilla/5.0' }
        )
        if (res?.data?.navigator) {
            const item = res.data.navigator.find(i =>
                i.name?.match(/前瞻|特别节目/) && i.app_path?.includes('act_id=')
            )
            if (item) {
                let m = item.app_path.match(/act_id=([a-zA-Z0-9]+)/)
                if (m) return m[1]
            }
        }
        return null
    }

    async getData(type) {
        const urls = {
            index: 'https://api-takumi.mihoyo.com/event/miyolive/index',
            code: `https://api-takumi-static.mihoyo.com/event/miyolive/refreshCode?version=${this.code_ver}&time=${this.now}`
        }
        try {
            const res = await fetch(urls[type], {
                method: 'get',
                headers: { 'x-rpc-act_id': this.actId || '' }
            })
            if (!res.ok) return null
            return await res.json()
        } catch (e) {
            logger.error(`[云墨安] ${type}请求失败: ${e}`)
            return null
        }
    }

    async _fetch(url, headers) {
        try {
            const ctrl = new AbortController()
            const timer = setTimeout(() => ctrl.abort(), 10000)
            const res = await fetch(url, { headers, signal: ctrl.signal })
            clearTimeout(timer)
            if (!res.ok) return null
            return await res.json()
        } catch { return null }
    }
}