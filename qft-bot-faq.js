const fs = require('fs');
const faqHandler = require('./faq-handler.js');
const CONFIGURATION = require('./configuration-local.json');
const bot_token = process.env.SLACK_BOT_TOKEN || CONFIGURATION['bot-token'] || '';
const scriptPath = CONFIGURATION['script-path'] || './';
const scraperPath = CONFIGURATION['scraper-path'] || '../qft-bot-delisted-scraper/';
const coinStatusHandler = require(scriptPath + 'coinstatus-handler.js');
const botChannel = CONFIGURATION['bot-channel'] || 'G854US8MR';
process.on('SIGUSR1', function() {
    let delisterSql = "SELECT * FROM statuses WHERE reported_in_slack IS NOT 1 AND notice <> ''";
    let delisterMessage = "*COIN SCRAPER REPORT*\n";
    let coinStatuses = {};
    try {
        db.all(delisterSql, function (err, rows) {
            //console.log(rows);
            if(rows.length == 0) {
                return;
            }
            rows.forEach(function (row) {
                let coinStatus = {};
                coinStatus.exchange = row.exchange;
                coinStatus.coin = row.currency;
                coinStatus.marketName = row.market_name;
                coinStatus.lastSynced = row.last_synced;
                coinStatus.notice = row.notice;
                coinStatuses[row.currency] = coinStatus;
                //console.log("Exchange: " + row.exchange + ", last synced: " + row.last_synced + ", notice: " + row.notice);
            });
            //console.log(Object.keys(coinStatuses));
            let coinStatusesCoins = Object.keys(coinStatuses );
            for(let i = 0; i < coinStatusesCoins.length; i++) {
                if(coinStatuses[coinStatusesCoins[i]].exchange == 1) {
                    delisterMessage += "Exchange: BITTREX\n";
                } else {
                    delisterMessage += "Exchange: Binance\n";
                }
                if(coinStatuses[coinStatusesCoins[i]].coin) {
                    delisterMessage += "Coin: " + coinStatuses[coinStatusesCoins[i]].coin + "\n";
                } else {
                    delisterMessage += "Coin: " + coinStatuses[coinStatusesCoins[i]].marketName + "\n";
                }
                if(coinStatuses[coinStatusesCoins[i]].notice.toLowerCase().indexOf("delisted") === -1) {
                    delisterMessage += "Notice: " + coinStatuses[coinStatusesCoins[i]].notice + "\n";
                } else {
                    delisterMessage += "_Notice: " + coinStatuses[coinStatusesCoins[i]].notice + "_\n";
                }
                delisterMessage += "Last synced: " + coinStatuses[coinStatusesCoins[i]].lastSynced + "\n\n";
            }
            rtm.sendMessage(delisterMessage, botChannel);
            db.run("UPDATE statuses SET reported_in_slack = ? WHERE reported_in_slack IS NOT 1 AND notice <> ''", 1);
        });
    } catch(error) {

    }
});

RtmClient = require('@slack/client').RtmClient;
RTM_EVENTS = require('@slack/client').RTM_EVENTS;
rtm = new RtmClient(bot_token);
CLIENT_EVENTS = require('@slack/client').CLIENT_EVENTS;
WebClient = require('@slack/client').WebClient;
web = new WebClient(bot_token);

sqlite3 = require('sqlite3').verbose();
db = new sqlite3.Database(scraperPath + '/qft-bot-delisted-scraper.sqlite', (err) => {
    if (err) {
        return console.log(err.message);
    }
    console.log('Database connected');
    start();
});
triggerWords = JSON.parse(fs.readFileSync(scriptPath + 'trigger-words.json', 'utf8'));
//let superUsers = JSON.parse(super_users);
debugging = process.env.DEBUGGING || CONFIGURATION['debugging'] || false;
superUsers = process.env.SUPER_USERS || CONFIGURATION['super-users'];

TOPICS = Object.keys(triggerWords.public_commands);
PROTECTED_COMMANDS = Object.keys(triggerWords.magic_commands);
COMMANDS_PUBLIC = JSON.parse(JSON.stringify(triggerWords.public_commands));
COMMANDS_ENABLED_FLAT = {};
for(let i = 0; i < TOPICS.length; i++) {
    if(triggerWords.public_commands[TOPICS[i]].enabled) {
        if(debugging) {
            console.log("Enabled: " + TOPICS[i]);
        }
        COMMANDS_ENABLED_FLAT = Object.assign(COMMANDS_ENABLED_FLAT, triggerWords.public_commands[TOPICS[i]]);
        delete COMMANDS_ENABLED_FLAT["enabled"];
        delete COMMANDS_ENABLED_FLAT["description"];
        delete COMMANDS_PUBLIC[TOPICS[i]]["enabled"];
    } else {
        if(debugging) {
            console.log("Disabled: " + TOPICS[i]);
        }
        delete COMMANDS_PUBLIC[TOPICS[i]];
        delete TOPICS[i];
    }
}
HELP_RESPONSE = "Please type `!help` in a private chat to me, to show all available help topics.";
HELP_PUBLIC_CHAT_RESPONSE = "Kindly send me commands as direct messages (by talking to me directly). This keeps the channels nice and clean.\n\n";

EXCHANGES = JSON.parse(JSON.stringify(triggerWords.exchanges));
coinsStatuses = {};
marketStatuses = {};
url = 'http://www.bittrex.com/status';

Array.prototype.diff = function(arr2) {
    let ret = [];
    for(let i in this) {
        if(arr2.indexOf( this[i] ) > -1){
            ret.push( this[i] );
        }
    }
    return ret;
};

function start() {
// The client will emit an RTM.AUTHENTICATED event on successful connection, with the `rtm.start` payload
    rtm.on(CLIENT_EVENTS.RTM.AUTHENTICATED, (rtmStartData) => {
        for (const c of rtmStartData.channels) {
            if (c.is_member && (c.name === 'botchat' || c.name === 'test_lab')) {
                if (debugging) {
                    console.log('Found ' + c.name);
                }
                //botChannel = c.id;
            }
        }
        console.log(`Logged in as ${rtmStartData.self.name} of team ${rtmStartData.team.name} in channel ${botChannel}`);
    });

// you need to wait for the client to fully connect before you can send messages
    rtm.on(CLIENT_EVENTS.RTM.RTM_CONNECTION_OPENED, function () {
        rtm.sendMessage("Bot is online!", botChannel);
    });

    rtm.on(RTM_EVENTS.MESSAGE, function handleRtmMessage(message) {
        if ((message.subtype && message.subtype === 'bot_message') ||
            (!message.subtype && message.user === rtm.activeUserId) || message.user === undefined) {
            return;
        }
        try {
            if (message.text.substr(0, 1) === '!') {

                if (message.text.substr(0, 5) === '!coin' || message.text.substr(0, 5) === '!coinstatus') {
                    coinStatusHandler.processCoinStatus(message);
                    return;
                } else {
                    console.log("Not a coin command");
                }

                faqHandler.processFaq(message, debugging);
                //processFaq(message);
            }
        } catch(e) {
            if(debugging) {
                console.log('Couldn\'t match message.text.substr(0,1) === "!"');
                console.log(e);
            }
        }
    });
    rtm.start();
}
