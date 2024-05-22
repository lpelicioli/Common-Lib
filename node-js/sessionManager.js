"use strict";
var tokenGenerator = require('./tokenGenerator.js');
var object = require('./object.js');
var logger = require('./logger.js');
var dataAuthentications = { sessions: [] };

var settings = {
    tokenLength: 30,
    needRenew: true,
    tokenMaxTimeSec: 300,
    clearDeadSessionTime: 300
}



module.exports = {
    init: function (tokenLength = 30, clearDeadSessionTimeSec = 60, needRenew = false, tokenMaxTimeSec = 300) {
        settings = {
            tokenLength: Number(tokenLength),
            needRenew: needRenew,
            tokenMaxTimeSec: Number(tokenMaxTimeSec),
            clearDeadSessionTime: Number(clearDeadSessionTimeSec)
        }
        if (needRenew)
            setInterval(clear, (Number(clearDeadSessionTimeSec) * 1000)); //pulisce le sessioni ogni 5 min
    },
    add: function (userid, name = "Unknown") {
        return generateNewSession(userid, name);
    },
    renew: function (token) {
        return renewSessionFn(token)
    },
    get: function (token) {
        return getDataUserFromToken(token);
    },
    remove: function (token) {
        return removeSession(token)
    },
    isSessionExpired: function (token) {
        return isTokenExpired(token)
    },

};

exports.clear = clear;

function clear() {
    var session = getSessionLenght();
    clearDeadSession();
    var sessionCleared = session - getSessionLenght()
    if (sessionCleared > 0) {
        logger.info("sessionManager.js", "Clear dead sessions...Session cleared: " + sessionCleared)
        if (session > 0)
            printActiveSession();
    }
}


function getDataUserFromToken(token) {

    if (!object.isNullOrEmpty(token) && token.length == settings.tokenLength) //se il token non è nullo
    {
        for (var c = 0; c < getSessionLenght(); c++) {
            if (dataAuthentications.sessions[c].token == token || dataAuthentications.sessions[c].oldToken == token) {//test
                return dataAuthentications.sessions[c].userid;
            }
        }
    }
    else
        logger.warning("sessionManager.js", "Token invalid")
}


function clearDeadSession() {
    for (var i = 0; i < getSessionLenght(); i++) {
        var currtoken = dataAuthentications.sessions[i].token
        if (isTokenExpired(currtoken)) {
            logger.warning("sessionManager.js", "clearDeadSession: Session expired for " + dataAuthentications.sessions[i].username)
            dataAuthentications.sessions.splice(i, 1);
        }
    }
}

function removeSession(token) {

    if (!object.isNullOrEmpty(token) && token.length == settings.tokenLength) //se il token non è nullo
    {
        for (var c = 0; c < getSessionLenght(); c++) {
            if (dataAuthentications.sessions[c].token == token || dataAuthentications.sessions[c].oldToken == token) {//test
                var data = dataAuthentications.sessions[c];
                dataAuthentications.sessions.splice(c, 1)
                logger.info("sessionManager.js", "Current sessions active: " + getSessionLenght())
                printActiveSession();
                return data;
            }
        }

        logger.warning("sessionManager.js", "Token not found")
    }
    else
        logger.warning("sessionManager.js", "Token invalid")

    return {};
}

function printListSession(array) {
    var string = ''
    string += '\n | Username | first Login       | Last Renew        | Activity time     |\n'
    string += ' | -------- | ----------------- | ----------------- | ----------------- |\n'
    var sessionLength = getSessionLenght()
    if (sessionLength == 0)
        string += ' |          |                   |                   |                   |\n'
    else
        for (var c = 0; c < sessionLength; c++) {
            var current = array[c]
            var moment = require('moment');
            moment.locale("it");
            var lastRequestTime = moment(current.lastrequest)
            var creationTime = moment(current.creationDate)

            var now = moment(new Date())
            var duration = moment.duration(now.diff(creationTime))
            string += ' | ' + current.username + '       | ' + creationTime.format('lll') + ' | ' + lastRequestTime.format('lll') + ' | ' + duration.days() + 'dd ' + duration.hours() + 'hh ' + duration.minutes() + 'mm ' + duration.seconds() + 'ss |\n'
        }
    string += ' | -------- | ----------------- | ----------------- | ----------------- |\n'
    console.log(string)
}

function printActiveSession() {
    printListSession(dataAuthentications.sessions)
}

function renewSessionFn(token) {
    var newtoken = "";
    if (settings.needRenew == true) {
        if (!isTokenExpired(token)) {
            for (var c = 0; c < getSessionLenght(); c++) {
                if (dataAuthentications.sessions[c].token == token) {
                    var now = new Date();
                    dataAuthentications.sessions[c].lastrequest = now;
                    dataAuthentications.sessions[c].oldToken = dataAuthentications.sessions[c].token; //test
                    return dataAuthentications.sessions[c].token = generateToken();
                }
            }
        }
    }
    else
        return token;

    return newtoken;
}

function getSessionLenght() {
    return dataAuthentications.sessions.length;
}

function generateToken() {
    var ntoken = "";
    var found = false;
    while (!found) { //fino a che non trova un token che non è gia presente
        ntoken = tokenGenerator.generateRandomKey(settings.tokenLength); //genera un token di  caratteri

        found = true;
        for (var c = 0; c < getSessionLenght(); c++) {
            if (dataAuthentications.sessions[c].token == ntoken) {
                found = false;
                break;
            }
        }
    }
    return ntoken;
}


function isTokenExpired(token) //controlla che il token non sia scaduto
{
    if (!object.isNullOrEmpty(token) && token.length == settings.tokenLength) //se il token non è nullo
    {
        for (var c = 0; c < getSessionLenght(); c++) {
            if (dataAuthentications.sessions[c].token == token || dataAuthentications.sessions[c].oldToken == token) {
                if (dataAuthentications.sessions[c].oldToken == token)
                    logger.warning("sessionManager.js", "Old token found " + dataAuthentications.sessions[c].username)

                if (settings.needRenew == true) {
                    var moment = require('moment');
                    moment.locale("it");

                    var now = moment(new Date())
                    var lastReq = moment(dataAuthentications.sessions[c].lastrequest);

                    var duration = moment.duration(now.diff(lastReq))
                    var durationSec = duration.as('seconds')
                    if (durationSec <= settings.tokenMaxTimeSec && durationSec >= 0)
                        return false;
                    else {
                        logger.warning("sessionManager.js", "Session expired for " + dataAuthentications.sessions[c].username)
                        return true;
                    }
                }
                else
                    return false;
            }
        }


        logger.warning("sessionManager.js", "Token not found")
    }
    else
        logger.warning("sessionManager.js", "Token invalid")


    return true;
}


function generateNewSession(userid, username) {
    if (!object.isNullOrEmpty(String(userid))) {
        var now = new Date();
        var data = {
            token: generateToken(),
            userid: userid,
            username: username,
            creationDate: now,
            lastrequest: now,
            oldToken:""
        };

        dataAuthentications.sessions.push(data);
        printActiveSession()

        return data.token
    }
    else
        logger.warning("sessionManager.js", "Invalid userid unable to create token")
    return "";
}
