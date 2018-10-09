class Utils {
    // DateStamp
    //
    static dateStamp() {
        var event = new Date();
        return event.toISOString().slice(0, 10).trim() + ' ' + event.toTimeString().slice(0, 8).trim();
    }

    // TimeStamp
    //
    static timeStamp() {
        return new Date().toTimeString().slice(0, 8).trim();
    }
  
    // Strip http and https from a string
    //
    static httpStrip(display) {
        return display.replace('https://', '').replace('http://', '');
    }

    // Process uptime
    //
    static uptime() {
        var secs = Math.floor( process.uptime() );
        var minutes = secs / 60; secs = secs % 60;
        var hours = minutes / 60; minutes = minutes % 60;
        var days = hours / 24; hours = hours % 24;

        return `${parseInt(days)}d, ${parseInt(hours)}hrs, ${parseInt(minutes)}min, ${parseInt(secs)}sec`;
    }

    static cpuinfo() {
        var os = require("os");

        var cpu   = os.loadavg();
        
        // Converted to MB
        var total = Math.round(os.totalmem() / 1024 / 1024 * 100) / 100;
        var used  = Math.round(process.memoryUsage().rss / 1024 / 1024 * 100) / 100;
        var per   = ((used * 100) / total).toFixed(2);

        return `current/avg load: [${Number(cpu[0]).toLocaleString()}% / ${Number(cpu[1]).toLocaleString()}%], memory: [${used} MB (${per}%)]`;
    }

    // Check for typos in the URL
    //
    static urlCleaner(address) {
        const URL   = require('url');
        const myurl = URL.parse(address);
        myurl.pathname = myurl.pathname.replace(/\/$/, "").replace(/(\/){2,}/g, "/");
        
        return `${myurl.protocol}//${myurl.host}${myurl.pathname}`;
    }

    // Connect to GITHUB and check if there 
    // is a more recent ver
    //
    static versionCheck(currentVer, quiet=false) {
        var req = require("request");
        var ver = "0";

        req("https://raw.githubusercontent.com/hazlema/MediaBot/master/VERSION", function (error, response, body) {
            if (response.statusCode != 200) {
                MediaBot.emit('log', `{Version} error occurred connecting to [github.com] request error: [${response.statusCode}]`);
                MediaBot.emit('notify', `{Version} error occurred connecting to [github.com] request error: [${response.statusCode}]`);
            } else {
                if (parseFloat(body) > parseFloat(currentVer)) {
                    MediaBot.emit('log', `<UPGRADE> MediaBot (v${body}) is available at [http://github.com/hazlema/MediaBot]`);
                } else {
                    if (!quiet) {
                        MediaBot.emit('log', `{Version} MediaBot (v${currentVer}) is the most recent version`);
                    }
                }
            }
        });
    }

    // Build the polling class
    // Read the files for each polling module and add 
    // them to the end of the class file (polling.js)
    //
    static buildPolling(data) {
        const fs    = require('fs');
        const path  = require("path");
        
        var code = fs.readFileSync(path.join(__dirname, 'polling.js'));
        
        code += data.map(function(file) { 
            var file = path.join(__dirname, file);
            
            if (!fs.existsSync(file)) {
                MediaBot('log', `<ERROR> polling module [${file}] does not exist`);
                throw new error(`"Pulling Module [${file}] NOT FOUND`);
            }

            return fs.readFileSync(file); 
        });
        
        code += 'module.exports = {Polling};';
    
        return code;
    }

    // Process uptime
    //
    static formatBotText(data) {
        return data
            .replace(/\*\*/g, "")
            .replace(/\[/g, "[**")
            .replace(/\]/g, "**]")
            .replace(/\(/g, "(__")
            .replace(/\)/g, "__)")
            .replace(/\{/g, "{**")
            .replace(/\}/g, "**}")
            .replace(/\</g, "<**")
            .replace(/\>/g, "**>");
    }
}
        
module.exports = { Utils };
