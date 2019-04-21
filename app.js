let Axios = require('axios');
let WebSocketAsPromised = require('websocket-as-promised');
let W3CWebSocket = require('websocket').w3cwebsocket;
let logger = require('./logger');

// Config for websocket-as-promised
const wsp = new WebSocketAsPromised('ws://localhost:6700', {
    createWebSocket: url => new W3CWebSocket(url)
});

let config = require('./settings');

let token = null;
let lastMessageTimestamp = 1355603863114;

const axiosInstance = Axios.create({
    timeout: 3000,
    headers: {
        'Host': 'pocketapi.48.cn',
        'accept': '*/*',
        'Accept-Language': 'zh-Hans-CN;q=1',
        'User-Agent': 'PocketFans201807/6.0.0 (iPhone; iOS 12.2; Scale/2.00)',
        'Accept-Encoding': 'gzip, deflate',
        'appInfo': '{"vendor":"apple","deviceId":"0","appVersion":"6.0.0","appBuild":"190409","osVersion":"12.2.0","osType":"ios","deviceName":"iphone","os":"ios"}',
        'Content-Type': 'application/json;charset=utf-8',
        'Connection': 'keep-alive',
        'token': { toString() { return token } },
    }
});

async function login(mobile, password) {
    const loginUrl = "https://pocketapi.48.cn/user/api/v1/login/app/mobile";
    const payload = {
        mobile: mobile,
        pwd: password,
    };
    try {
        let resp = await axiosInstance.post(loginUrl, payload);
        token = resp.data.content.token;
        logger.log({ level: 'info', message: 'logged in with token: ' + token });
    } catch(err) {
        logger.log({ level: 'error', message: err });
    }
}

async function getRoomMessages(ownerId, roomId) {
    roomMessageUrl = 'https://pocketapi.48.cn/im/api/v1/chatroom/msg/list/homeowner';
    const payload = { ownerId, roomId };
    try {
        let resp = await axiosInstance.post(roomMessageUrl, payload);
        if ( resp.data.status > 401000 ) {
            await login(config.mobile, config.password);
        } else {
            const messages = resp.data.content.message.reverse();
            for (var message of messages) {
                if (message.msgTime > lastMessageTimestamp) {
                    lastMessageTimestamp = message.msgTime;
                    await sendWebsocketMessage(makeBroadcastPayload(message));
                }
            }
        }
    } catch(err) {
        logger.log({ level: 'error', message: err });
    }
}

function makeBroadcastPayload(message) {
    if (message.msgType === 'TEXT') {
        return broadcastTextMessagePayload(message);
    } else if (message.msgType === 'IMAGE') {
        return broadcastImageMessagePayload(message);
    } else if (message.msgType === 'AUDIO') {
        return broadcastAudioMessagePayload(message);
    } else if (message.msgType ==='EXPRESS') {
        return broadcastExpressMessagePayload(message);
    } else {
        logger.log({ level: 'error', message: 'Unknown message type.' });
        logger.log({ level: 'error', message: message });
        return null;
    }
}

function broadcastTextMessagePayload(message) {
    const extInfo = JSON.parse(message.extInfo);
    const { messageType } = extInfo;
    let messagePayload = null;
    if ( messageType === 'TEXT' ) {
        const { text, user: { nickName } } = extInfo;
        messagePayload = `${nickName}: ${text}`;
    } else if ( messageType === 'REPLY' ) {
        const { replyName, replyText, user: { nickName }, text} = extInfo;
        messagePayload = `${replyName}: ${replyText}\n----------\n${nickName}: ${text}`;
    } else if ( messageType === 'LIVEPUSH' ) {
        messagePayload = '蕾蕾开直播啦~请打开口袋48观看。'
    } else if ( messageType === 'FLIPCARD' ) {
        const { question, user: { nickName }, answer } = extInfo;
        messagePayload = `${question}\n----------\n${nickName}: ${answer}`;
    } else {
        logger.log({ level: 'error', message: 'Unknown message type.' });
        logger.log({ level: 'error', message: message });
    }
    return [messagePayload];
}

function broadcastImageMessagePayload(message) {
    const extInfo = JSON.parse(message.extInfo);
    const body = JSON.parse(message.bodys);
    const { url } = body;
    const { user: { nickName } } = extInfo;
    return [`${nickName}发送了一张图片:\n[CQ:image,file=${url}]`];
}

function broadcastAudioMessagePayload(message) {
    const extInfo = JSON.parse(message.extInfo);
    const body = JSON.parse(message.bodys);
    const { url } = body;
    const { user: { nickName } } = extInfo;
    return [`${nickName}发送了一条语音:`, `[CQ:record,file=${url}]`];
}

function broadcastExpressMessagePayload(message) {

}

async function sendWebsocketMessage(messages) {
    const makePayload = (groupChatId) => {
        return {
            action: 'send_group_msg',
            params: {
                group_id: groupChatId,
                message,
            }
        }
    }
    for (message of messages) {
        try {
            await wsp.open();
            logger.log({ level: 'info', message: 'Broadcasting message: ' + message });
            for (fanclub of config.fanclubChatNumber) {
                wsp.send(JSON.stringify(makePayload(fanclub)));
            }
        } catch(err) {
            logger.log({ level: 'error', message: err });
        } finally {
            await wsp.close();
        }
    }
}

async function searchMember(name) {
    const searchUrl = "https://pocketapi.48.cn/im/api/v1/im/search";
    const payload = { name };
    let resp = await axiosInstance.post(searchUrl, payload);
    console.log(resp.data.content.data);
}

async function main() {
    await getRoomMessages(63572, 67370548);
}

setInterval(function() {
    main();
}, 20000);