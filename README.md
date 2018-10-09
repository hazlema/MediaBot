# MediaBot, v2.4

MediaBot is a Discord bot that pulls data from multiple information sources and posts the links
to discord using a queueing system [***configurable***]. This program was designed specificity so you
can add new data sources as easily as installing a plugin.  Look for more modules to be created
in the future.

**Included modules**:
- YouTube
- Twitter 
- BitChute

**Note**: You do not need API keys for any of these platforms.  Data is obtained via processing the raw HTML

## Whats New

v**2.4**: 
- Rebuilt polling 
- Fixed small memory leak

v**2.3**: 
- Polling Updates
- Fixed a parsing error
- Added version/update checking

## Log Screenshots

Discord channel log
![Discord](/img/discord_log.gif)

Terminal log
![Terminal](/img/terminal_log.gif)

## How-to Install

- You must have NodeJS installed to use this bot. [https://nodejs.org/]
- Just unpack in any directory you wish, this bot will run on any architecture (Linux, Windows, Mac).
- You will have to create a bot under your user account and add it to your Discord channel. Do that here: [https://discordapp.com/developers/applications/]

**If you need more help there are tons of guides on the internet on how to make a discord bot.**

## Brief Usage

To start the bot, change to the directory the files are located and type **npm start** or **node ./index.js**.
Once you have the bot in your channel and running you will need to tell it where to post.  

**Change to the channel and type one of the following**:
- .set twitter
- .set bitchute
- .set youtube
- .set botlog

## Database Commands (Rebuild/Compact the databases)
- .rebuild twitter
- .rebuild youtube
- .rebuild bitchute
- .rebuildall

**Note:** This is automated and should no longer be necessary unless you manually add new polling options to the **config.json** file.

## Other Commands

### Add/Remove authorized users
- .adduser [user]
- .deluser [user]
- .listusers

**The owner of the bot is automatically authorized**

### Misc Commands
- .stats (Forces a status update)
- .queue (Forces the next post out of the queue)
- .help (Shows the help)
- .ver (Checks for an upgrade)

**Note:** The bot only listens to authorized users<br>
**Note:** Most commands output to the **botlog** channel and the terminal. 
You can set the **botlog** channel inside **Discord** by using the command **.botlog**

## Changing the sites polled

All the settings are in the [**config.json**] file. You will find a list of
url's that the bot checks, just edit the list as you see fit.  Be sure to preserve any formatting.

To automatically rebuild the database indexes delete the **streams.json** and **queue.json**
files.  Or, you can rebuild the indexes after you start the bot by pressing **b** in the
terminal or typing **.rebuildall** in Discord.

## Other config settings

|    Config Setting    |                       Description            | Default |
| -------------------- | -------------------------------------------- | ------- |
| timers.status        | How often to display status (minutes)        | 10      |
| timers.queue         | How often to post from the queue (minutes)   | 5       |
| autoskip.time        | How old a post can be before it is skipped   | 6       |
| autoskip.unit        | Unit of time (hours or days)                 | "h"     |
| database.rebuild     | Max database records before a rebuild        | 2000    |
| mediabot.showconsole | Display console commands in the status       | "true"  |
| mediabot.showconfig  | Display config in the status                 | "false" |
| mediabot.showdata    | Display database stats in the status         | "true"  |
| mediabot.showstatus  | Display statistics in the status             | "true"  |
| mediabot.showtimers  | Display timers in the status                 | "true"  |
| mediabot.shownotify  | Display notifications in the status          | "false" |

## Bot Script file

Sometimes the **Discord API** goes down or the **Google Gateway** or even your 
**internet connection**.  MediaBot has a lot of error handling but sometimes
can not recover and shuts down.  (This is rare)

You can safe guard this by starting the bot with a script. An exit code of 100 is a 
normal exit for the bot.  If the bot crashes the exit code **will not be** 100.

Here is a sample bash script that will restart the bot automatically unless you
specificity exited the program.

```bash
#!/bin/bash
exitcode=0

cd ~/Projects/Node/MediaBot

while [ $exitcode != 100 ]
do
    node ./index.js
    exitcode=$?
done
```
