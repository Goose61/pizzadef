const Telebot = require('telebot')
const Model = require('./model')

// setting up bot
const bot = new Telebot(process.env.BOT_TOKEN)

// start command
bot.on('/start', async (msg) => {
  let message = ''
  
  if(await Model.addNewChat(msg.chat.id, msg.from.id)){
    message += 'Hello! I can help keep track of scores for you!\n'
    message += 'For available commands, type /help.'
  } else {
    message += 'I was already running. :)'
  }
  
  msg.reply.text(message)
})

// help command
bot.on('/help', (msg) => {
  let message = 'Add [score] to [Id].\n'
  message += '/addscore [Id] [score]\n'
  message += '/t [Id] [score]\n'
  message += '\n'
  message += 'Add [userId] as admin. User can change scores and add more admins.\n'
  message += '/adduser [userId]\n'
  message += '\n'
  message += 'Add [TeamName] as a new team with [teamId] as shorthand.\n'
  message += '/addteam [TeamName] [teamId]\n'
  message += '\n'
  message += 'Remove [teamId].\n'
  message += '/removeteam [teamId]\n'
  message += '\n'
  message += 'Display score.\n'
  message += '/displayscore\n'
  message += '/ds\n'
  message += '\n'
  message += 'Get user ID.\n'
  message += '/who'
  
  msg.reply.text(message)
})

// removeteam command
bot.on('/removeteam', async (msg) => {
  let args = msg.text.split(' ')
  let teamId = args[1]
  let userId = msg.from.id
  let chatId = msg.chat.id
  
  try {
    let res = await Model.removeTeam(teamId, userId, chatId)
    let message = `*${res.team.name}* (${teamId}) removed.`
    msg.reply.text(message)
  } catch (err) {
    msg.reply.text(err)
  }
})

// addteam command
bot.on('/addteam', async (msg) => {
  let args = msg.text.split(' ')
  let teamName = args[1]
  let teamId = args[2]
  let userId = msg.from.id
  let chatId = msg.chat.id
  
  try {
    await Model.addTeam(teamName, teamId, userId, chatId)
    let message = `*${teamName}* (${teamId}) created.`
    msg.reply.text(message)
  } catch (err) {
    msg.reply.text(err)
  }
})

// addscore command
bot.on(['/addscore', '/t'], async (msg) => {
  let args = msg.text.split(' ')
  let teamId = args[1]
  let score = Number(args[2])
  let userId = msg.from.id
  let chatId = msg.chat.id
 
  try {
    let res = await Model.addTeamScore(teamId, score, userId, chatId)
    let message = `*${res.team.name}* has *${res.team.score}* points.`
    msg.reply.text(message)
  } catch (err) {
    msg.reply.text(err)
  }
})

// adduser command
bot.on('/adduser', async (msg) => {
  let args = msg.text.split(' ')
  let targetId = Number(args[1])
  let userId = msg.from.id
  let chatId = msg.chat.id
  
  try {
    await Model.addUser(targetId, userId, chatId)
    let message = `User ${targetId} has been added`
    msg.reply.text(message)
  } catch (err) {
    msg.reply.text(err)
  }
})

// displayscore command
bot.on(['/displayscore', '/ds'], async (msg) => {
  let teamsModel = await Model.getTeamsModel(msg.chat.id)
  let message = "Current score: \n"
  
  if(teamsModel != undefined){
    teamsModel.forEach(function (team) {
      message += `${team.name} (${team.id}): *${team.score}*\n`
    });
  } else {
    message += "No scores yet."
  }

  msg.reply.text(message)
})

// who command
bot.on('/who', (msg) => {
  msg.reply.text(`${msg.from.first_name} your ID is \`${msg.from.id}\``)
})

// start bot
bot.start()
console.log("Bot polling.")
