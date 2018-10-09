/*******************************************************
 * Dynamic Polling Module
 *
 * Send logging data to terminal and web:
 * MediaBot.emit('log', [text]);
 *
 * Send error string:
 * MediaBot.emit('notify', [text]);
 *
 * Send log & error:
 * MediaBot.emit('log-notify', [text]);
 *
 * Send data to database:
 * MediaBot.emit('polling-data', { name, url, date, source });
 ********************************************************/
const request  = require("request");
const path     = require("path");
const {Utils}  = require(path.join(__dirname, 'utils'));

class Polling {
    openUrl(url, tag) {
        return new Promise(function(resolve, reject) {
            request(url, function (error, response, body) {
                if (!error) {
                    if (response.statusCode != 200) {
                        MediaBot.emit('log-notify', `{${tag}} <WARNING> http error: [${response.statusCode}], url: [${Utils.httpStrip(url)}]`);
                        resolve(null);
                    } else {
                        resolve(body);
                    }
                } else {
                    MediaBot.emit('log-notify', `{${tag}} <WARNING> request error: [${error}], url: [${Utils.httpStrip(url)}]`);
                    resolve(null);
                }
            });
        });
    };
}
