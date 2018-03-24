let bot_token = process.env.SLACK_BOT_TOKEN || '';
let super_users = process.env.SUPER_USERS || '';
let debugging = process.env.DEBUGGING || false;
let RtmClient = require('@slack/client').RtmClient;
let RTM_EVENTS = require('@slack/client').RTM_EVENTS;
let rtm = new RtmClient(bot_token);
let CLIENT_EVENTS = require('@slack/client').CLIENT_EVENTS;
let WebClient = require('@slack/client').WebClient;
let web = new WebClient(bot_token);
let fs = require('fs');

let triggerWords = JSON.parse(fs.readFileSync('./trigger-words.json', 'utf8'));
let superUsers = JSON.parse(super_users);
let botChannel = 'general';

let TOPICS = Object.keys(triggerWords.public_commands);
let PROTECTED_COMMANDS = Object.keys(triggerWords.magic_commands);
let COMMANDS_PUBLIC = JSON.parse(JSON.stringify(triggerWords.public_commands));
let COMMANDS_ENABLED_FLAT = {};
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
let HELP_RESPONSE = "Please type `!help` in a private chat to me, to show all available help topics.";
let HELP_PUBLIC_CHAT_RESPONSE = "Kindly send me commands as direct messages (by talking to me directly). This keeps the channels nice and clean.\n\n";

// The client will emit an RTM.AUTHENTICATED event on successful connection, with the `rtm.start` payload
rtm.on(CLIENT_EVENTS.RTM.AUTHENTICATED, (rtmStartData) => {
  for (const c of rtmStartData.channels) {
      if (c.is_member && (c.name === 'botchat'  || c.name === 'test_lab')) {
          if(debugging) {
              console.log('Found ' +c.name);
          }
          botChannel = c.id;
      }
  }
  console.log(`Logged in as ${rtmStartData.self.name} of team ${rtmStartData.team.name} in channel ${botChannel}`);
});

// you need to wait for the client to fully connect before you can send messages
rtm.on(CLIENT_EVENTS.RTM.RTM_CONNECTION_OPENED, function () {
    rtm.sendMessage("Bot is online!", botChannel);
});

rtm.on(RTM_EVENTS.MESSAGE, function handleRtmMessage(message) {
    try {
        if(message.text.substr(0,1) === "!") {
            //console.log("Command is for DM channel, remembering and removing ! from string");
            //message.text = message.text.substr(1, message.text.length);
            try {
                web.channels.info(message.channel).then(info => {
                    if(info.ok) {
                        if(debugging) {
                            console.log("This is public channel received");
                            console.log("Message");
                            console.log(message);
                            console.log("Info");
                            console.log(info);
                        }
                        prepareMessage(message.user, message, true);
                    }
                }).catch(function (e) {
                    if(debugging) {
                        console.log("This is private channel received");
                        console.log("Message");
                        console.log(message);
                        console.log(e);
                    }
                    prepareMessage(message.user, message, false);
                });
            } catch(e) {
                if(debugging) {
                    console.log('Error on matching channels.info with a channel');
                }
            }
        }
    } catch(e) {
        if(debugging) {
            console.log('Couldn\'t match message.text.substr(0,1) === "!"');
            console.log(e);
        }
    }
});

rtm.start();

/**
 * Pads and prepends and extends message strings before sending it to a
 * recipient
 * @param channel The channel the message is supposed to be sent to
 * @param message The contents of the message as it is now
 * @param prepend What to prepend the message with, if anything
 */
function prepareMessage(channel, message, prepend) {
    let description = undefined;
    let mainCommand = undefined;
    let compoundCommand = undefined;
    let taggedUser = undefined;
    let response = "";
    let commandingUser = channel;
    if(debugging) {
        console.log("Commanding user: " + commandingUser);
    }
    message.text = message.text.split(' ').slice(0,2);
    try {
        if(PROTECTED_COMMANDS.indexOf(message.text[0]) > -1 || Object.keys(COMMANDS_ENABLED_FLAT).indexOf(message.text[0]) > -1) {
            mainCommand = message.text[0];
        }
    } catch(e) {}

    try {
        if(message.text[1].indexOf("@U") > -1) {
            taggedUser = message.text[1].substring(2, message.text[1].length-1);
        } else if(TOPICS.indexOf(message.text[1]) > -1) {
            compoundCommand = TOPICS[TOPICS.indexOf(message.text[1])];
        }
    } catch(e) {}

    if(debugging) {
        console.log("messageText: [" + message.text + "] mainCommand [" + mainCommand + "] compoundCommand [" + compoundCommand + "]");
    }
    if(mainCommand === "!help" && compoundCommand !== undefined) {
        let compoundCommandKeys = Object.keys(COMMANDS_PUBLIC[compoundCommand]);
        response += "*" + COMMANDS_PUBLIC[compoundCommand].description + "*\n";
        for (let j = 0; j < compoundCommandKeys.length; j++) {
            if(compoundCommandKeys[j] !== "description") {
                response += compoundCommandKeys[j] + "\n";
            }
        }
    } else if(mainCommand === "!all") {
        for(let i = 0; i < TOPICS.length; i++) {
            if(TOPICS[i] !== undefined) {
                response += "*" +TOPICS[i]+ "*\n";
                let commandsInTopic = Object.keys(COMMANDS_PUBLIC[TOPICS[i]]);
                for(let j = 0; j < commandsInTopic.length; j++) {
                    if(commandsInTopic[j] !== undefined && commandsInTopic[j] !== "description") {
                        response += commandsInTopic[j] +"\n";
                    }
                }
            }
        }
    } else if(mainCommand === "!help" || mainCommand === "!hepl" || mainCommand === "!halp") {
        response += "Below is a list of topics highlighted in bold, and also a description of each topic.\n\nType `!help [topic]` to get a list of commands for that topic.\n\n";
        for (let i = 0; i < TOPICS.length; i++) {
            if (TOPICS[i] !== undefined) {
                description = COMMANDS_PUBLIC[TOPICS[i]]["description"];
                response += "*" + TOPICS[i] + "*" + ": " + description + "\n";
            }
        }
        response += "\n\nType `!all` to see all available commands in all topics.";
    } else if(mainCommand !== undefined) {
        if(debugging) {
            console.log("Finding message for command in list");
            response += COMMANDS_ENABLED_FLAT[mainCommand];
        }
    } else {
        response += "BLEEP, BLOOP. I didn't understand that command.\n\n" + HELP_RESPONSE;
    }

    if(taggedUser !== undefined) {
        if(superUsers.indexOf(commandingUser) > -1) {
            if(debugging) {
                console.log("This user is a madmin, passing message along...");
            }
            sendDM(taggedUser, response);
        } else {
            if(debugging) {
                console.log("This user isn't a madmin, Duin' nuth'n'!");
            }
        }
    } else {
        if(prepend) {
            response = HELP_PUBLIC_CHAT_RESPONSE + response;
        }
        sendDM(channel, response);
    }
}

/**
 * Sends a message to a recipient
 * @param channel The receiving channel; a user ID as a string
 * @param message The complete message as a string
 */
function sendDM(channel, message) {
    // TODO Fuck: https://github.com/slackapi/node-slack-sdk/issues/69
    // https://github.com/slackapi/node-slack-sdk/issues/148
    web.im.open(channel, function(err, resp) {
        if(debugging) {
            console.log('sendDM()');
            console.log(err);
            console.log(resp);
        }
        // Check `err` for any errors.
        // `resp` is the parsed response from the api.
        // Check API docs for what `resp` can be.
        // console.log(resp);
        rtm.sendMessage(message, resp.channel.id);
    });
}