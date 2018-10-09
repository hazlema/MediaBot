/*************************************************************
 * Multiple Timers Module
 * 
 * With this module you can create multiple timers that will
 * trigger an event when there execution time is met.
 *
 * Creates a global event called TimerTick with a argument of 
 * the timer itself.
 *************************************************************/

/*************************************************************
 *    Class: Timer class
 *     Desc: Hold the values for one timer
 *************************************************************/
class Timer {
    constructor(name="unknown", minutes=5, paused=false) {
        this.name     = name;
        this.minutes  = minutes;
        this.elapsed  = 0;
        this.executed = 0;
        this.paused   = paused;
    }

    reset() {
        this.elapsed = 0;
    }

    rnd(min, max) {
        this.minutes = parseInt(Math.random() * (max - min) + min);
    }

    rndElapsed(min, max) {
        this.elapsed = parseInt(Math.random() * (max - min) + min);
    }
}

/*************************************************************
 *    Class: Timers class
 *     Desc: Collection of timers
 *************************************************************/
class Timers {
    constructor(data) {
        var me = this;          // Save this class instance
        this._timerList = [];   // Timer Array
        
        /*************************************************************
         * Create Timers
         *************************************************************/
        if (Array.isArray(data)) {
            data.forEach(function(element) {
                me.create(element[0], element[1], element[2]);
            })
        }

        /*************************************************************
         * Start internal timer event
         *************************************************************/
        setInterval(function() {me.tick();}, 60000);
    }

    /*************************************************************
     * Create a single timer
     *************************************************************/
    create(name="unknown", minutes=5, paused=false) {
        var tmp = new Timer(name, minutes, paused);
        tmp.elapsed  = 0;
        tmp.executed = 0;

        this._timerList.push(tmp);
        MediaBot.emit('log', `{Creating timer} [${name} @ ${minutes}min]`);
    }

    /*************************************************************
     * Add a timer object to the array
     *************************************************************/
    add(obj) {
        this._timerList.push(obj);
    }

    /*************************************************************
     * Locate a timer in the array and return its values
     *************************************************************/
    find(name) {
        var found = this._timerList.find(function(element) {
            if (element.name.toLowerCase() == name.toLowerCase()) return element;
        });

        return found;
    }

    /*************************************************************
     * Remove a timer from the array
     *************************************************************/
    remove(name) {
        var time = this.find(name);
        var ndx =  this._timerList.indexOf(time);
        this._timerList.splice(ndx, 1);
        MediaBot.emit('log', `{Removing timer} [${name}]`);
    }

    /*************************************************************
     * Internal tick, called every minutes, update all the timers
     * and if one should be executed raise the global TimerTick event
     *************************************************************/
    tick() {
        this._timerList.forEach(obj => {
            if (obj.paused == false) obj.elapsed += 1;
            
            if (obj.minutes <= obj.elapsed) {
                obj.executed += 1;
                obj.elapsed = 0;
                MediaBot.emit('tick', obj);
            }
        });
    }

    /*************************************************************
     * Execute and reset a timer
     *************************************************************/
    trigger(data) {
        if (this.find(data)) {
            this.find(data).elapsed = 0;
            MediaBot.emit('log', `{Timers} manual execution of [${data}]`);
            MediaBot.emit('tick', {name:data});
        }
    }

    /*************************************************************
     * Return an array of timers
     *************************************************************/
    toArray() {
        return this._timerList;
    }
}

module.exports = { Timer, Timers };