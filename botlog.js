/*******************************************
 * This module buffers log events and
 * sends them as chunks of data to the
 * MediaBot.sendlog event.  
 * 
 * If these were sent line by line, you would
 * flood discord and the output would be slow.
 * 
 * Discord has a 2000 char limit per message
 * Check for data every 5 seconds or a char limit
 ********************************************/
const ansi   = require('ansi');
const cursor = ansi(process.stdout);

class BotLog {
    constructor() {
        var me = this;

        this._log = { elapsed: 0, data: "" };
        setInterval(function() { me.tick(); }, 250);
    }    

    tick() {
        if ( this._log.data.length >= 1500 || this._log.elapsed <= 1 ) {
            
            if (this._log.data) {
                MediaBot.emit("sendLog", this._log.data);
            }
            
            this._log.data    = "";
            this._log.elapsed = 0;
        } else {
            this._log.elapsed += 1;
        }
    }

    add(str) {
        this._log.data += str + "\n";
        
        // Too much data, send it and reset
        if (this._log.data.length >= 1500) {
            this.tick();
        }
    }  

    /*******************************************
     * MediaBot console output
     * 
     * @arg string
     *******************************************/
    colorLog(display) {
        display = display.replace(/\*\*/g, '');

        for (var counter = 0; counter < display.length; counter++) {
              
            switch (display[counter]) {
                case '[': cursor.brightBlack();   cursor.write("["); cursor.brightYellow(); break;
                case ']': cursor.brightBlack();   cursor.write("]"); cursor.brightWhite();  break;
                case '(': cursor.brightMagenta(); cursor.write("("); cursor.brightRed();    break;
                case ')': cursor.brightMagenta(); cursor.write(")"); cursor.brightWhite();  break;
                case '{': cursor.brightGreen();   cursor.write("{"); cursor.brightCyan();   break;
                case '}': cursor.brightGreen();   cursor.write("}"); cursor.brightWhite();  break;
                case '<': cursor.red();   cursor.write("<"); cursor.brightRed();   break;
                case '>': cursor.red();   cursor.write(">"); cursor.brightWhite();  break;
                default: cursor.write(display[counter]);
            }
        }
      
        console.log();
    }

}
    
module.exports = { BotLog };
