const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const adapter = new FileSync('data/db.json');
const db = low(adapter);

function getUser(userId, chatId) {
  return db.get('chats').find({ id: chatId }).get('users').find({ id: userId }).value();
}

function getTeam(teamId, chatId) {
  return db.get('chats').find({ id: chatId }).get('teams').find({ id: teamId }).value();
}

function getChat(chatId) {
  return db.get('chats').find({ id: chatId }).value();
}

/**
 * Add new chat and admin to database.
 */
module.exports.addNewChat = function(chatId, userId) {
  return new Promise((resolve, reject) => {
    if(db.get("chats").find({ id: chatId }).value() != undefined){
      resolve(false);
    } else {
      db.get("chats")
        .push({ id: chatId, teams: [], users: [{ id: userId }]})
        .write();
      
      resolve(true);
    }
  });
};

/**
 * Add a team.
 * @param {string} teamId - ID of the team to add the score.
 * @param {integer} score - Score to be added.
 * @param {integer} userId - ID of the user invoking this request.
 * @param {integer} chatId - ID of chat invoking this request.
 */
module.exports.addTeam = function(teamName, teamId, userId, chatId) {
  return new Promise((resolve, reject) => {
    const user = getUser(userId, chatId);
    const chat = getChat(chatId);

    if(getTeam(teamId, chatId) != undefined){
      reject('This team ID already exists.');
      return;
    }

    if (teamName === undefined || teamId === undefined){
      reject('Please define a team name and id.');
      return;
    }
    
    if (user === undefined) {
      reject('Error adding score: invalid user');
      return;
    }
    
    if (chat === undefined) {
      reject('Please /start the bot first.');
      return;
    }
    
    db.get("chats")
      .find({ id: chatId })
      .get('teams')
      .push({ id: teamId, name: teamName, score: 0})
      .write();
    
    resolve();
  });
};

/**
 * Remove a team.
 * @param {string} teamId - ID of the team to add the score.
 * @param {integer} score - Score to be added.
 * @param {integer} userId - ID of the user invoking this request.
 * @param {integer} chatId - ID of chat invoking this request.
 * @returns {object} - Removed team object.
 */
module.exports.removeTeam = function(teamId, userId, chatId) {
  return new Promise((resolve, reject) => {
    const user = getUser(userId, chatId);
    const chat = getChat(chatId);
    const team = getTeam(teamId, chatId);

    if (teamId === undefined){
      reject('Please enter a team id.');
      return;
    }
    
    if(team === undefined){
      reject('This team ID does not exist.');
      return;
    }
    
    if (user === undefined) {
      reject('Error adding score: invalid user');
      return;
    }
    
    if (chat === undefined) {
      reject('Please /start the bot first.');
      return;
    }
    
    db.get("chats")
      .find({ id: chatId })
      .get('teams')
      .remove({ id: teamId })
      .write();
    
    resolve({ team });
  });
};

/**
 * Add score to a team.
 * @param {string} teamId - ID of the team to add the score.
 * @param {integer} score - Score to be added.
 * @param {integer} userId - ID of the user invoking this request.
 * @param {integer} chatId - ID of chat invoking this request.
 * @returns {object} - Updated team object.
 */
module.exports.addTeamScore = function(teamId, score, userId, chatId) {
  return new Promise((resolve, reject) => {
    const user = getUser(userId, chatId);
    const team = getTeam(teamId, chatId);

    if (user === undefined) {
      reject('Error adding score: invalid user');
      return;
    }
    
    if (team === undefined) {
      reject('Error adding score: invalid team id');
      return;
    }
    
    if (!Number.isInteger(score)) {
      reject('Error adding score: score not an integer');
      return;
    }
    
    db.get("chats")
      .find({ id: chatId })
      .get('teams')
      .find({ id: teamId })
      .set('score', team.score + score)
      .write();
    
    resolve({ team });
  });
};

/**
 * Add new user.
 *
 * @param {string} targetId - ID of  new user.
 * @param {integer} userId - ID of the user invoking this request.
 * @param {integer} chatId - ID of chat invoking this request.
 */
module.exports.addUser = function(targetId, userId, chatId) {
  // TODO: Check if user already in db...
  return new Promise((resolve, reject) => {
    const user = getUser(userId, chatId);

    if (user === undefined) {
      reject('Error adding user: invalid user');
      return;
    }
    
    db.get("chats")
      .find({ id: chatId })
      .get('users')
      .push({ id: targetId })
      .write();
    
    resolve();
  });
};

/**
 * Get database.
 * @returns {array} - Array of objects, each is a team.
 */
module.exports.getTeamsModel = function(chatId) {
  return new Promise((resolve, reject) => {
    resolve(db.get('chats').find({ id: chatId }).get('teams').value());
  });
};
