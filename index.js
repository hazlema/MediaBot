const Discord     = require('discord.js');
const events      = require('events');
const path        = require("path");
const fs          = require("fs");
const ago         = require("ago");
const {Database}  = require(path.join(__dirname, 'database'));
const {Timers}    = require(path.join(__dirname, 'timer'));
const {Utils}     = require(path.join(__dirname, 'utils'));
const {BotLog}    = require(path.join(__dirname, 'botlog'));
const {Stats}     = require(path.join(__dirname, 'stats'));

const Ver    = "2.4";
const Bot    = new Discord.Client();
const botlog = new BotLog();
const stats  = new Stats();

var owner        = null;
var rebuildTasks = [];
var errors       = [];
var isRebuild    = false;

global.MediaBot = new events.EventEmitter();

// Keyboard input
//
var stdin = process.openStdin(); 
stdin.setRawMode( true );
stdin.resume();
stdin.setEncoding( 'utf8' );

/*******************************************
 * MediaBot Configuration
 * 
 * Configuration fail messages
 *******************************************/
var showConfigCopy = function() {
    console.log();
    MediaBot.emit('log', `MediaBot (v${Ver}) is missing a configuration file`);
    MediaBot.emit('log', `please [copy] (config.json.sample) to (config.json)`);
    MediaBot.emit('log', `and add the [oAuth] key to the (config.json) file`);
    MediaBot.emit('log', `in the field [discord.oAuth].`);
    console.log();
    MediaBot.emit('log', `To create a key use the discord web site:`);
    MediaBot.emit('log', `https://discordapp.com/developers/applications/`);
    console.log();
    process.exit(5);
}

var showConfigKey = function() {
    console.log();
    MediaBot.emit('log', `MediaBot (v${Ver}) is missing an authorization key or the key is invalid.`);
    MediaBot.emit('log', `Add the (oAuth) key to the [config.json] file in the field [discord.oAuth].`);
    console.log();
    MediaBot.emit('log', `-or- The internet could be offline.`);
    console.log();
    MediaBot.emit('log', `To create a key use the discord web site:`);
    MediaBot.emit('log', `https://discordapp.com/developers/applications/`);
    console.log();
    process.exit(5);
}

// Does the config.json file exist?
//
if (!fs.existsSync(path.join(__dirname, 'config.json'))) {
    showConfigCopy();
}

/*******************************************
 * MediaBot Log Event
 * 
 * This has to be at the top of the code
 * to function properly
 *******************************************/
MediaBot.on('log', data => {
    botlog.add(`[${Utils.timeStamp()}] ${data}`);           // Buffer log data
    botlog.colorLog(`[${Utils.timeStamp()}] ${data}`);      // Terminal Output

    // Deferred Write trigger
    if ( isRebuild && data.indexOf('{Deferred} writing') !== -1 ) {
        MediaBot.emit('rebuildEnd', 'done');
    }
});

/*******************************************
 * MediaBot Notify Event
 * 
 * Save this log entry to an array
 *******************************************/
MediaBot.on('notify', data => {
    errors.push(`[${Utils.timeStamp()}] ${data}`);
});

/*******************************************
 * MediaBot log-notify Event
 * 
 * Send to the log and notify events
 *******************************************/
MediaBot.on('log-notify', data => {
    MediaBot.emit('log', data);
    MediaBot.emit('notify', data);
});

/*******************************************
 * MediaBot Owner Information
 * 
 * Receive the owners information
 *******************************************/
MediaBot.on('owner', data => {
    owner = data;

    // After receiving the info trigger a 
    // status update
    //
    MediaBot.emit("tick", {name:"status"});
});

/*******************************************
 * MediaBot Databases
 * Initialize / Open Databases
 * 
 *    - config.db  = Configuration Options
 *    - streams.db = Processed Streams
 *    - queue.db   = Discord Post Queue
 *******************************************/
var database = new Database([
    'config.json',
    'streams.json',
    'queue.json'
]);


/*******************************************
 * MediaBot Timers
 * Initialize Dynamic Polling & Static event
 * Timers.  Randomize elapsed time for 
 * dynamic timers upon creation
 * 
 * Create Args:
 *   Timer Name
 *   Timer Minutes
 *   Timer Paused
 *******************************************/
var timers = new Timers();
var load = [];

database.getSection('config.json', 'polling').forEach(host => {
    if (host.disabled == false) {
        load.push('polling.' + host.name + '.js');
        timers.create('polling.' + host.name, host.time, false);
        timers.find('polling.' + host.name).rndElapsed(1, host.time);
    }
});

timers.create("queue",  database.getSetting('config.json', 'timers.queue', 5),  false);
timers.create("status", database.getSetting('config.json', 'timers.status', 3), false);

MediaBot.emit('log', `{Randomizing} Elapsed minutes on the [polling timers]`);


/*[ Polling Events ]**************************************************************************************/

/*******************************************
 * MediaBot Polling Class
 * Build and activate class
 *******************************************/
const {Polling} = eval( Utils.buildPolling(load) );
const polling   = new Polling();

/*******************************************
 * MediaBot Polling data
 * Receives data from multiple sources
 * 
 * TODO: Error Checking
 * TODO: Date Filtering
 *******************************************/
MediaBot.on('polling-data', data => {
    var sourceCfg = database.find('config.json', 'polling', 'name', data.source);

    if (!database.exists('streams.json', {url:data.url})) {
        database.insert('streams.json', data);
        stats.inc("insert");
        
        // Skip the queue if rebuilding
        //
        if (!isRebuild) {
            // If the post is older then today minus
            // the window?
            //
            // ago(num, [ 'days', 'hours' ])
            //
            var skipTime = database.getSetting('config.json', 'autoskip.time', 6);
            var skipUnit = database.getSetting('config.json', 'autoskip.unit', 'h');
            
            var postDate = new Date(data.date);
            var today    = new Date(ago(skipTime, skipUnit));  
            var skip     = false;

            if (postDate < today) {
                skip = true;
            }

            // Old Video/post ?
            // YouTube sometimes will include an old video in the feed
            // 
            if (!skip) {

                // Was this source configured to skip the queue
                //
                if (!sourceCfg.skipQueue) {  
                    database.insert('queue.json', data);
                } else {
                    var sendTo = database.getSection('config.json', 'channels.' + data.source);

                    sendTo.forEach(host => {
                        stats.inc("post");
                        MediaBot.emit('log', `{Direct Post} url: [${Utils.httpStrip(data.url)}], to: [${host.text}]`);
                        var channel = getChannel(host.guild, host.channel);
                        channel.send(data.url);
                    });
                }
            } else {
                // Post date was to old
                //
                stats.inc("skip");

                var postDate = new Date(data.date);
                MediaBot.emit('log', `{Skipping} url: [${Utils.httpStrip(data.url)}], date: [${postDate.toDateString()}]`);
                MediaBot.emit('notify', `{Skipping} url: [${Utils.httpStrip(data.url)}], date: [${postDate.toDateString()}]`);
            }
        }
    }
});

/*******************************************
 * MediaBot Queue
 * 
 * Spit out the next queued url
 *******************************************/
MediaBot.on('next:queue.json', data => {
    // What mapping should we use for this data?
    //
    var source = database.find('config.json', 'polling', 'name', data.source);

    // What servers/channels should we send it to?
    //
    var sendTo = database.getSection('config.json', 'channels.' + source.name);

    sendTo.forEach(host => {
        stats.inc("post");
        MediaBot.emit('log', `{Queue Post} url: [${Utils.httpStrip(data.url)}], to: [${host.text}]`);
        var channel = getChannel(host.guild, host.channel);
        channel.send(data.url);
    });
});

/*[ Status Functions ]**************************************************************************************/

// Show Commands
// (Output these to console only)
//
showcommands = function() {
    botlog.colorLog(`[${Utils.timeStamp()}] {Console} [s] status update   [d] database stats  [p] poll a data source`);
    botlog.colorLog(`[${Utils.timeStamp()}] {Console} [q] queue post      [n] show notify     [c] clear notify`);
    botlog.colorLog(`[${Utils.timeStamp()}] {Console} [i] show cfg        [t] show timers     [b] rebuild all`);
    botlog.colorLog(`[${Utils.timeStamp()}] {Console} [v] check version   [r] restart         [x] exit`);
}

// Show DB Stats
//
showdatabase = function() {
    var q = path.join(__dirname, 'queue.json');
    var s = path.join(__dirname, 'streams.json');

    function getSize(file) {
        var size  = '0';

        if (fs.existsSync(file)) {
            var fd = fs.openSync(file, 'r+');
            size   = Number( fs.fstatSync(fd).size ).toLocaleString();
        }

        return size;
    }

    MediaBot.emit('log', `{Database} queue: [${database.count('queue.json')} records (${getSize(q)} bytes)]`);
    MediaBot.emit('log', `{Database} streams: [${database.count('streams.json')} records (${getSize(s)} bytes)]`);
}

// Show Notifications
//
shownotify = function() {
    if (errors.length != 0) {
        errors.forEach(obj => {
            MediaBot.emit('log', `<Notify> ${obj}`);
        });
    } else {
        MediaBot.emit('log', `<Notify> [Nothing to show]`);
    }
}

// Show Config
//
showcfg = function() {
    var tag = Bot.users.get(owner).tag;
   
    MediaBot.emit('log', `{Config} bot admin: [${tag} (${owner})]`);
    MediaBot.emit('log', `{Config} rebuild at: [${database.getSetting('config.json', 'database.rebuild', 2000)} records]`);
    MediaBot.emit('log', `{Config} autoskip time: [${database.getSetting('config.json', 'autoskip.time', 6)}${database.getSetting('config.json', 'autoskip.unit', 6)}]`);
}

// Show Timers
//
showtimers = function() {
    timers.toArray().forEach(obj => {
        MediaBot.emit('log', `{Timers} ${obj.name}: [${obj.elapsed}min/${obj.minutes}min]`);
    });
}

// Show Bot Status
//
showstatus = function() {
    var os = require("os");

    // Not supported on winblows
    if (os.type == "Linux" || os.type == "Darwin") {
        MediaBot.emit('log', `{System} ${Utils.cpuinfo()}`);
    }

    MediaBot.emit('log', `{Status} uptime: [${Utils.uptime()}]`);
    MediaBot.emit('log', `{Status} posts: [${stats.posts}]`);
    MediaBot.emit('log', `{Status} skips: [${stats.skips}]`);
    MediaBot.emit('log', `{Status} streams in: [${stats.inserts}]`);
    MediaBot.emit('log', `{Status} rebuilds: [${stats.rebuilds}]`);
    MediaBot.emit('log', `{Status} notify: [${errors.length}]`);
}

/*[ Timer Events ]**************************************************************************************/

MediaBot.on('tick', data => {
    // Status Event
    if (data.name=="status") {
        // Show status info
        if (database.getSetting('config.json', 'mediabot.showconsole', 'true') == 'true')  showcommands();
        if (database.getSetting('config.json', 'mediabot.showconfig', 'false') == 'true')  showcfg();
        if (database.getSetting('config.json', 'mediabot.showdata', 'false') == 'true')    showdatabase();
        if (database.getSetting('config.json', 'mediabot.showstatus', 'true') == 'true')   showstatus();
        if (database.getSetting('config.json', 'mediabot.showtimers', 'true') == 'true')   showtimers();
        if (database.getSetting('config.json', 'mediabot.shownotify', 'false') == 'true')  shownotify();
        
        // Check for a database rebuild
        if (!isRebuild) doRebuild();
    }

    // Handles ALL the Polling Events
    if (data.name && data.name.indexOf("polling.") !== -1) {
        const cmd  = data.name;  // polling.[site]
        const args = JSON.stringify(database.getSection("config.json", data.name));
        const exec = `${cmd}(${args})`;
        
        eval(exec);
    }

    // Queue Event
    if (data.name == "queue") {
        database.next('queue.json');
    }

    // Rebuild Timeout
    // An error occurred during the rebuild event.  A data source did not return
    // any records and the bot is in limbo.  Give it a jump start.
    if (data.name == "rebuild") {
        MediaBot.emit('log', `{MediaBot} Rebuild Timeout`);
        MediaBot.emit('rebuildEnd', "");
    }

});
  
/*[ Keyboard Events ]**************************************************************************************/

/*******************************************
 * MediaBot Keyboard Input Handler
 *******************************************/
stdin.on('data', function (key) {
    var hosts = database.getSectionFiltered('config.json', 'polling', 'name', ['botlog']);
    var ndx   = parseInt(key);
    
    // If number, exec polling event
    //
    if (ndx && ndx <= hosts.length) {
        timers.trigger(`polling.${hosts[parseInt(key) - 1]}`);
    }

    // Process letter keys
    //
    switch (key.toLowerCase()) {
        case '\u0003': process.exit(100);               break;  // Ctrl-C
        case 's':      timers.trigger("status");        break;
        case 'q':      timers.trigger("queue");         break;
        case 'v':      Utils.versionCheck(Ver);         break;
        case 'x':      process.exit(100);               break;
        case "r":      process.exit();                  break;
        case "b":      if (!isRebuild) doRebuild(true); break;
        case "?":
        case "h":      showcommands();                  break;
        case "d":      showdatabase();                  break;
        case "n":      shownotify();                    break;
        case "i":      showcfg();                       break;
        case "t":      showtimers();                    break;
        case 'p': 
            var display = [];
            var index   = 1;

            for (var count=0; count<hosts.length; count++) {
                display.push(`[${count + 1}] ${hosts[count]}`);
            }

            // Console output
            botlog.colorLog(`[${Utils.timeStamp()}] {Console} select: ${display.join(', ')}`);
            break;
        case "c": 
            errors = [];
            MediaBot.emit('log', `{MediaBot} clearing notifications`);
            break;
    }
});

/*[ Rebuild Events ]**************************************************************************************/

// MediaBot database rebuild
// @arg string
//
MediaBot.on('rebuildStart', data => { 
    const source  = data;

    if (database.find('config.json', 'polling', 'name', source) != null) {
        const hosts = `polling.${source}`;

        // Set isRebuild
        //
        isRebuild = true;
        stats.inc("rebuild");

        // Pause Timers
        //
        timers.toArray().forEach(timer => {
            if (timer.paused == false) {
                MediaBot.emit('log', `{MediaBot} pausing timer [${timer.name}]`);
                timer.paused = true;
            }
        });

        // Catastrophic Rebuild Timeout Failure
        //
        // If you rebuild a data source, and the polling dosn't return even one
        // record the deferred write event will never be called.  This is the backup plan
        // so the bot won't just hang in limbo.  It will give you 3 minutes to rebuild
        // the data source then exec the end event.
        //
        timers.create("rebuild",  3,  false);

        // Remove source from database
        //
        MediaBot.emit('log', `{MediaBot} removing [${source}] from (streams.json)`);
        database.remove('streams.json', {source:source});

        // MediaBot.emit('log', `{MediaBot} removing [${source}] from (queue.json)`);
        // database.remove('queue.json', {source:source});

        // Do polling 
        // Wait for 'Deferred Write' Trigger
        // 
        const cmd  = `polling.${source}`;  // polling.[site]
        const args = JSON.stringify(database.getSection("config.json", `polling.${source}`));
        const exec = `${cmd}(${args})`;

        eval(exec);

        //const {poll} = require(path.join(__dirname, 'polling.' + source));
        //new poll(database.getSection("config.json", 'polling.' + source));
    } else {
        MediaBot.emit('rebuildEnd', "");
    }
});

// Rebuild the database index end event
// 
MediaBot.on('rebuildEnd', data => { 

    // Delete the rebuild timer
    //
    if (timers.find("rebuild")) {
        timers.remove("rebuild");
    }

    if (rebuildTasks.length != 0) {
        MediaBot.emit('rebuildStart', rebuildTasks.shift())
    } else {
        isRebuild = false;

        // Restart Timers
        //
        timers.toArray().forEach(timer => {
            MediaBot.emit('log', `{MediaBot} starting timer [${timer.name}]`);
            timer.paused = false;
        });

        MediaBot.emit('log', `{MediaBot} Completed database rebuild(s)`);
    }
});

// Check if the DB needs to be rebuilt
//
var doRebuild = function(force=false) {
  
    // If no records, force a rebuild or
    // there are to many records
    //
    // Configuration setting: database.rebuild
    //
    if (force ||
        database.count('streams.json') == 0 ||
        database.count('streams.json') >= database.getSetting('config.json', 'database.rebuild', 2000)) {

        rebuildTasks = database.getSectionFiltered('config.json', 'polling', 'name', ['botlog']);
    
        MediaBot.emit('log', `<Rebuild> Rebuild of [${rebuildTasks.join(', ')}] in 30 seconds.`);
        MediaBot.emit('log', `<Rebuild> Waiting for any tasks to complete, please wait!`);

        // Pause Timers
        //
        timers.toArray().forEach(timer => {
            if (timer.paused == false) {
                MediaBot.emit('log', `{MediaBot} pausing timer [${timer.name}]`);
                timer.paused = true;
            }
        });

        isRebuild = true;

        setTimeout(function() {
            MediaBot.emit('rebuildStart', rebuildTasks.shift());
        }, 30000);
    }    
}

/*[ Bot Stuff ]**************************************************************************************/

/*******************************************
 * MediaBot Fetch the owner info
 *******************************************/
var oAuthOwner = function() {
    Bot.fetchApplication() 
        .then(application => {
            MediaBot.emit('owner', application.owner.id);
        })
}

/*******************************************
 * MediaBot Build a Discord Embed
 *******************************************/
var discordEmbed = function(desc) {
    var embed = new Discord.RichEmbed()
        .setColor("GREEN")
        .setDescription(desc);
    
    return embed;
}

/*******************************************
 * MediaBot Helper
 * Get a channels object
 * 
 * Ex: getChannel("1234", "1234").send("Message");
 * 
 * @arg guildId: id of the guild in a string
 * @arg channelId: id of the channel in a string
 * @return: channel object
 *******************************************/
getChannel = function(guildId, channelId) {
    var guild, channel;
    
    if (Bot.guilds.has(guildId)) 
        guild = Bot.guilds.get(guildId)
    
    if (guild) {
        if (Bot.channels.has(channelId)) 
            channel = Bot.channels.get(channelId)
    }
    
    if (guild && channel) return channel;
}

/*******************************************
 * MediaBot Log Output (to bot channel)
 * 
 * Display the buffered log data
 * Called from botlog.js
 *******************************************/
MediaBot.on('sendLog', data => { 
    var sendTo = database.getSection('config.json', 'channels.botlog');
    
    sendTo.forEach(host => {
        var channel = getChannel(host.guild, host.channel);
        
        if (channel) {
            channel.send("\n" + Utils.formatBotText(data));
        }
    });
});

/*******************************************
 * MediaBot User Message Processing
 *******************************************/
Bot.on('message', message => {
    var msg = message.content.replace(/\s+/gi, ' ');      // Strip extra spaces
        msg = msg.toLowerCase().trim();                   // Lower Case & Trim
        msg = msg.split(' ');
    
        var cmd = msg.shift();

    // Check that owner is defined and this user is the owner
    // -or see if they are authorized manually (in the database)
    // if they are not authorized just ignore them
    //
    if (owner && ((message.author.id == owner) || database.find('config.json', 'mediabot.users', 'id', message.author.id))) {
        
        // Display Help
        //
        if (cmd == ".help") {
            var tag  = Bot.users.get(owner).tag;
            var help = `**Media Bot Help**\n\n**Set/UnSet Polling Channel**\n`;

            database.getSection('config.json', 'polling').forEach(host => {
                help += `    **.set ${host.name}**: Direct (**${host.name}**) posts to go to [**${message.guild.name}**/**${message.channel.name}**]\n`;
            });
                
            help += `\n**Database**\n`;
            database.getSection('config.json', 'polling').forEach(host => {
                if (host.name != "botlog") {
                    help += `    **.rebuild ${host.name}**: Rebuild/Compress the db for ${host.name}\n`;
                }
            });
            help += `    **.rebuildall**: Rebuild/Compress all the db's\n`;

            help += `\n**User Settings**\n`;
            help += `    **.adduser**: Add an authorized user\n`;
            help += `    **.deluser**: Delete an authorized user\n`;
            help += `    **.listusers**: List the authorized users\n\n`;
            help += `**NOTE:** The bot owner [**${tag}**] is authorized automatically\n`;

            help += `\n**Misc Settings**\n`;
            help += `    **.stats**: Force a status update, Outputs in [**channels.botlog**]\n`;
            help += `    **.notify [clear]**: Show/Clear notifications\n`;
            help += `    **.queue**: Force a post from the queue\n`;
            help += `    **.ver**: Check for an upgrade\n`;

            message.channel.send( discordEmbed(help) );
        }

        // Force a status update
        //
        if (cmd == ".stats") {
            MediaBot.emit("tick", {name:"status"});
        }

        // Force a post from the queue
        //
        if (cmd == ".queue") {
            MediaBot.emit("tick", {name:"queue"});
        }

        // Authorized User Management
        //
        if (cmd == ".adduser" || cmd == ".deluser") {
            if (message.mentions.users.first()) {
                const user   = message.mentions.users.first();
                const insert = `Adding [**${user.tag}**] to authorized users`;
                const remove = `Removing [**${user.tag}**] from authorized users`;

                switch (cmd) {
                    case ".adduser": 
                        MediaBot.emit('log', `{MediaBot} ${insert}`);
                        message.channel.send( discordEmbed(insert) );

                        database.sectionInsert('config.json', 'mediabot.users', 'id', {
                            tag: user.tag,
                            name: user.username,
                            id: user.id
                        });
                        break;

                    case ".deluser": 
                        MediaBot.emit('log', `{MediaBot} ${remove}`);
                        message.channel.send( discordEmbed(remove) );

                        database.sectionRemove('config.json', 'mediabot.users', 'id', {
                            id: user.id
                        });
                        break;
                    }
                } else {
                    message.channel.send( discordEmbed("Invalid user") );
                }
        }

        // Authorized User Management
        //
        if (cmd == ".listusers") {
            var users = database.getSection('config.json', 'mediabot.users');
            var output = "";

            for (var count = 0; count < users.length; count ++) {
                output += `**${users[count].name}**, tag: [**${users[count].tag}**], id: [#${users[count].id}]\n`;
            }

            message.channel.send( discordEmbed(`**MediaBot Users**\n\n${output}`));
        }

        // Channel Mapping
        //
        if (cmd == ".set" || cmd == ".unset" ) {
            const source  = msg.shift();
            const error   = `Error [**${source}**] is not a supported data source`;
            const insert  = `Routing [**${source}**] posts to [**${message.guild.name}**/**${message.channel.name}**]`;
            const remove  = `Clearing routing for [**${source}**] on channel [**${message.guild.name}**/**${message.channel.name}**]`;

            // Does this section exist in the database?
            //
            if (database.find('config.json', 'polling', 'name', source) != null) {
                const section = `channels.${source}`;
                const guild   = message.guild.id;
                const channel = message.channel.id;
            
                if (cmd == ".unset") {
                    MediaBot.emit('log', `{MediaBot} ${remove}`);
                    message.channel.send( discordEmbed(remove) );

                    database.sectionRemove('config.json', section, guild, {guild: guild});
                } else {
                    MediaBot.emit('log', `{MediaBot} ${insert}`);
                    message.channel.send( discordEmbed(insert) );

                    database.sectionInsert('config.json', section, 'guild', {
                        text: `${message.guild.name}/${message.channel.name}`,
                        guild:   guild,
                        channel: channel
                    });
                }
            } else {
                message.channel.send( discordEmbed(error) );
            }
        } 
        
        // Rebuild Index of data source
        //
        if (cmd == ".rebuild" ) {
            if (!isRebuild) {
                var source = msg.shift();

                MediaBot.emit('log', `{MediaBot} Starting database rebuild for [${source}]`);
                message.channel.send( discordEmbed(`Starting database rebuild for [${source}], go to the [botlog] channel for more info.`) );

                MediaBot.emit('rebuildStart', source);
                isRebuild = true;
            } else {
                MediaBot.emit('log', `{MediaBot} Currently preforming a rebuild, try again later.`);
            }
        }

        // Rebuild all indexes
        //
        if (cmd == ".rebuildall" ) {
            if (!isRebuild) {
                    database.getSection('config.json', 'polling').forEach(host => {
                    if (host.name != "botlog") {
                        rebuildTasks.push(host.name);
                    }
                });

                MediaBot.emit('log', `{MediaBot} Starting database rebuild for [${rebuildTasks.join(', ')}]`);
                message.channel.send( discordEmbed(`Starting database rebuild for [${rebuildTasks.join(', ')}], go to the [botlog] channel for more info.`) );
                
                MediaBot.emit('rebuildStart', rebuildTasks.shift());
                isRebuild = true;
            } else {
                MediaBot.emit('log', `{MediaBot} Currently preforming a rebuild, try again later.`);
            }
        }

        // Notify [clear]
        // Show Notify or Clear Notify
        //
        if (cmd == ".notify" ) {
            var arg = msg.shift();

            if (arg == 'clear') {
                errors = [];
                MediaBot.emit('log', `{MediaBot} clearing notifications`);
            } else {
                shownotify();
            }
        }

        if (cmd == ".ver") {
            Utils.versionCheck(Ver);
        }
    }
});

// Version Test
//
setInterval(function() {
    Utils.versionCheck(Ver, true);
}, 60000 * 60);

Bot.on('disconnect', () => {
    MediaBot.emit('log', `<Websocket> Error, the [Internet, Google or Discord] hiccuped. Process exiting (Code: 10)`);
    process.exit(10);
});

Bot.on('error', () => {
    MediaBot.emit('log', `<Websocket> Error, the [Internet, Google or Discord] hiccuped. Process exiting (Code: 10)`);
    process.exit(10);
});

Bot.on('ready', () => {
    MediaBot.emit('log', `{MediaBot} MediaBot (v${Ver}) is [=ONLINE=]`);
    oAuthOwner();
    Utils.versionCheck(Ver, true);
});

// process.on('uncaughtException', function(err) {
//     MediaBot.emit('log', `<ERROR> unhandled exception [${err}], Trying to resume...`);
//     MediaBot.emit('notify', `<ERROR> unhandled exception [${err}]`);

//     fs.appendFileSync(path.join(__dirname, 'MediaBot_errors.log'), `---\nDate: ${Utils.dateStamp()}\n${err}\n`);
// });

var oAuth = database.getSetting('config.json', 'discord.oAuth');
Bot.login(oAuth).catch( function(){ showConfigKey() } );
