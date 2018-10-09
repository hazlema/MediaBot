/*************************************************************
 * Database Module
 *     
 * The idea of this module is to keep all the databases in
 * a temporary data store. This should keep the instances 
 * of this class down to just one. (Memory Thing)
 * 
 * The data returned is transmitted via the 'DataEvent' event
 *************************************************************/
const {taffy} = require('taffydb');

/*************************************************************
 *    Class: Database class
 *     Desc: Holds all the databases, use the constructor to
 *           load the databases.  
 * 
 *       Ex: db = new Database(['db1.json', 'db2.json']);
 *************************************************************/
class Database {
    constructor(dbs) {
        var me = this;

        // Init Store
        this._dbStore = new taffy();
        
        // Setup deffered save facility
        this.defferedSave = {
            dbs:    [],
            records: 0,
            saveIn: 15,
            active: false
        };

        setInterval(function(){
            me._defferedSave();
        }, 5000);
        
        // Load dbs
        if (dbs) {
            this.loadJSON(dbs);
        }
    }

    /*************************************************************
     * Func: isDatabase
     * Desc: Determine if the specified database is loaded in the 
     *       data store
     * 
     * @string: Name of the database
     *************************************************************/
    isDatabase(db) {
        return (this._dbStore({name:db}).count() == 1);
    }

    /*************************************************************
     * Func: _readFile
     * Desc: Load a JSON database file (Internal)
     * 
     * @string: Name of the file
     *************************************************************/
    _readFile(file) {
        const fs   = require('fs');
        const path = require('path');

        if (fs.existsSync(file)) {
            return require(path.join(__dirname, file));
        }

        MediaBot.emit('log', `Database (${file}) [does not exist], will create`);
        return [];
    }

    /*************************************************************
     * Func: loadJSON
     * Desc: Load a JSON database file(s) into the data store
     * 
     * @array/string: An array or a single file
     *************************************************************/
    loadJSON(toLoad) {
        var dbs = [];

        if (Array.isArray(toLoad)) {
            dbs = toLoad;
        } else {
            dbs.push(toLoad);
        }

        dbs.forEach(db => {
            MediaBot.emit('log', `{Loading} the (${db}) database.`);

            this._dbStore.insert({
                name: db,
                data: new taffy(this._readFile(db))
            });
        });
     }

    /*************************************************************
     * Func: Insert
     * Desc: Insert JSON formatted data into the database
     * 
     * @string: Name of the database
     * @json:   The data to be inserted
     *************************************************************/
    insert(db, data) {
        if (this.isDatabase(db)) {

            this._dbStore({name:db})
                .select("data")[0]
                .insert(data);

            /********************************************************
             * Upon a record being inserted a deffered save is 
             * scheduled to be executed in 15 seconds.  If there are
             * more inserts within this window the deffered save window
             * will be reset.  This will ensure all the data
             * will be written to the database before it is saved.
             ********************************************************/

            if (!this.defferedSave.dbs.includes(db)) {
                this.defferedSave.dbs.push(db);
            }
    
            this.defferedSave.records += 1;
            this.defferedSave.saveIn = 15;
            this.defferedSave.active = true;
        }
    }

    /*************************************************************
     * Func: exists
     * Desc: Check if {data} exists in the database
     * 
     * @string: Name of the database
     * @json:   Data to look for
     *************************************************************/
    exists(db, data) {
        if (this.isDatabase(db)) {
            return (this._dbStore({name:db})
                .select("data")[0](data)
                .count() != 0)
        }

        return false;
    }

    /*************************************************************
     * Func: Next
     * Desc: Return the next record in a database
     *       Returns the record via an event 'next:databaseName'
     * 
     * @string: Name of the database
     *************************************************************/
    next(db) { 
        if (this.isDatabase(db)) {
            
            // is there a record?
            if (this._dbStore({name:db})
                .select("data")[0]()
                .count() != 0) {

                // Get the next records URL
                var retval = this._dbStore({name:db})
                    .select("data")[0]()
                    .limit(1)
                    .get()[0];

                // Remove the record
                this._dbStore({name:db})
                    .select("data")[0]({"___id":retval["___id"]})
                    .remove();

                // Send event
                MediaBot.emit('next:' + db, retval);

                this.save(db);
            }
        }
    }

    /*************************************************************
     * Func: count
     * Desc: Returns the record count from a section
     *************************************************************/
    count(db) {
        return this._dbStore({name:db})
            .select("data")[0]().count();
    }

    remove(db, data) {
        return this._dbStore({name:db})
            .select("data")[0](data).remove();
    }


    /*************************************************************
     * Func: getSetting
     * Desc: Returns an element from the database
     *************************************************************/
    getSetting(db, setting, def=null) {
        var result = this._dbStore({name:db})
            .select("data")[0]()
            .select(setting)[0];

        if (!result && def) {
            result = def;
        }

        return result;
    }
    
    /*************************************************************
     * Func: getSection
     * Desc: Returns an element from the database
     *************************************************************/
    getSection(db, section) {
        return this.getSetting(db, section);
    }

    /*************************************************************
     * Func: getSection
     * Desc: Returns an element from the database with a filter
     *************************************************************/
    getSectionFiltered(db, section, filter, exclude=[]) {
        var retval = [];
        var result = this.getSection(db, section);

        for (var count=0; count<result.length; count++) {
            var item = result[count][filter];
            
            if (!exclude.includes(item)) {
                retval.push(item);
            }
        }    

        return retval;
    }

    /*************************************************************
     * Func: find
     * Desc: find a key in a database section
     *************************************************************/
    find(db, section, key, value) {
        var data = this.getSetting(db, section);

        return data.find(function(entry) {
            if (entry[key] === this[0]) {
                return entry;
            }
        }, [value]);
    }

    /*************************************************************
     * Func: sectionRemove
     * Desc: Remove an object (record) from a section
     * 
     * @args key is a pseudo primary key
     * @args data is an object specifying what to look for
     * 
     * ex. [{name: "Matthew", id:1}, {name:'Peter', id:2}]
     *     sectionRemove(db, section, "id", "{id:2}")
     * 
     *     Will remove the Peter record
     *************************************************************/
    sectionRemove(db, section, key, data, save=true) {
        var sectionData = this.getSection(db, section);
        var newSection  = [];

        for (var count=0; count<sectionData.length; count++) {
            if (sectionData[count][key] != data[key]) {
                newSection.push(sectionData[count]);
            }
        }

        if (save) {
            // Update DB
            this._dbStore({name:db})
                .select("data")[0]()
                .update(function() {
                    this[section] = newSection;
                    return this;
                });

            this.save(db, false);
        }

        return newSection;
    }

    /*************************************************************
     * Func: sectionInsert
     * Desc: Remove an object (record) from a section then
     *       Add it again
     * 
     * @args key is a pseudo primary key
     * @args data is an object specifying what to look for
     * 
     * ex. [ {name: "Matthew", id:1}, {name:"Peter", id:2}];
     *     sectionInsert(db, section, "id", {name:'Fran', id:2})
     * 
     *     Will remove the Peter record then replace it with the 
     *     Fran record
     *************************************************************/
    sectionInsert(db, section, key, data) {
        var sectionData;
        
        if (key) {
            // If a key was specified then check for it and remove
            sectionData = this.sectionRemove(db, section, key, data, false);
        } else {
            // Load the section
            sectionData = this.getSection(db, section);
        }
        
        // Add the new data
        sectionData.push(data);

        // Update DB
        this._dbStore({name:db})
            .select("data")[0]()
            .update(function() {
                this[section] = sectionData;
                return this;
            });

        this.save(db, false);
    }

    /*************************************************************
     * Func: _defferedSave
     * Desc: Waits till all data is inserted into the db before 
     *       saving. This fn is called every 5 seconds. (Internal)
     *************************************************************/
    _defferedSave() {
        if (this.defferedSave.active == true) {
            if (this.defferedSave.saveIn > 0) {
                this.defferedSave.saveIn -= 5;
            } else {
                var todo = this.defferedSave.dbs;
                
                MediaBot.emit('log', `{Deferred} inserted: [${this.defferedSave.records} records] into: (${todo.join(', ')})`);

                todo.forEach(db => {
                    this.save(db, true, true);
                });

                this.defferedSave.active  = false;
                this.defferedSave.records = 0;
                this.defferedSave.saveIn  = 15;
                this.defferedSave.dbs     = [];
            }
        }
    }

    /*************************************************************
     * Func: Save
     * Desc: Save the database
     * 
     * @string: Name of database
     *************************************************************/
    save(db, sort=true, isDeffered=false) {
        const fs   = require('fs');
        const path = require('path');

        if (this.isDatabase(db)) {
            var data;
            
            if (!isDeffered) {
                MediaBot.emit('log', `{Writing} database (${db})`);
            } else {
               MediaBot.emit('log', `{Deferred} writing: (${db})`);
            }

            if (sort) {
                data = this._dbStore({name:db})
                    .select("data")[0]()
                    .order("source asec, name asec, date desc")
                    .get();
            } else {
                data = this._dbStore({name:db})
                .select("data")[0]()
                .get();
            }

            var fixData = function(k, v) {
                if (k == '___id' || k == '___s') return undefined;
                return v;
            }
       
            fs.writeFile(
                path.join(__dirname, db), 
                JSON.stringify(data, fixData, 4), 
                null, 
                function(){}
            );
        }
    }
}

module.exports = { Database };
