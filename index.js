const Alexa = require('alexa-sdk');
const ical = require('ical');
const utils = require('util');

const states = {
    SEARCHMODE: '_SEARCHMODE',
    DESCRIPTION: '_DESKMODE',
};
let alexa;

let APP_ID = "amzn1.ask.skill.13acd6b0-a967-409f-95a3-a81d18d88ac5";

const URL = "http://events.stanford.edu/eventlist.ics";

const skillName = "Events calendar:";

const welcomeMessage = "You can ask for the events today. Search for events by date. or say help. What would you like? ";

const HelpMessage = "Here are some things you can say: Get me events for today. Tell me whats happening on the 18th of July. What events are happening next week? Get me stuff happening tomorrow. ";

const descriptionStateHelpMessage = "Here are some things you can say: Tell me about event one";

const NoDataMessage = "Sorry there aren't any events scheduled. Would you like to search again?";

const shutdownMessage = "Ok see you again soon.";

const oneEventMessage = "There is 1 event ";

const multipleEventMessage = "There are %d events ";

const scheduledEventMessage = "scheduled for this time frame. I've sent the details to your Alexa app: ";

const firstThreeMessage = "Here are the first %d. ";

const eventSummary = "The %s event is, %s at %s on %s ";

const cardContentSummary = "%s at %s on %s ";

const haveEventsreprompt = "Give me an event number to hear more information.";

const dateOutOfRange = "Date is out of range please choose another date";

const eventOutOfRange = "Event number is out of range please choose another event";

const descriptionMessage = "Here's the description ";

const killSkillMessage = "Ok, great, see you next time.";

const eventNumberMoreInfoText = "For more information on a specific event number, try saying: what's event one?";

const cardTitle = "Events";

let output = "";

let relevantEvents = new Array();

const newSessionHandlers = {
    'LaunchRequest': function () {
        this.handler.state = states.SEARCHMODE;
        this.response.speak(skillName + " " + welcomeMessage).listen(welcomeMessage);
        this.emit(':responseReady');
    },
    "SearchIntent": function()
    {
        this.handler.state = states.SEARCHMODE;
        this.emitWithState("SearchIntent");
    },
    'Unhandled': function () {
        this.response.speak(HelpMessage).listen(HelpMessage);
        this.emit(':responseReady');
    },
};

const startSearchHandlers = Alexa.CreateStateHandler(states.SEARCHMODE, {
    'AMAZON.YesIntent': function () {
        output = welcomeMessage;
        alexa.response.speak(output).listen(welcomeMessage);
        this.emit(':responseReady');
    },

    'AMAZON.NoIntent': function () {
        this.response.speak(shutdownMessage);
        this.emit(':responseReady');
    },

    'AMAZON.RepeatIntent': function () {
        this.response.speak(output).listen(HelpMessage);
    },

    'SearchIntent': function () {
        let eventList = new Array();
        const slotValue = this.event.request.intent.slots.date.value;
        if (slotValue != undefined)
        {
            let parent = this;

            ical.fromURL(URL, {}, function (error, data) {
                for (let k in data) {
                    if (data.hasOwnProperty(k)) {
                        let ev = data[k];
                        let eventData = {
                            summary: removeTags(ev.summary),
                            location: removeTags(ev.location),
                            description: removeTags(ev.description),
                            start: ev.start
                        };
                        eventList.push(eventData);
                    }
                }
                if (eventList.length > 0) {
                    const eventDate = getDateFromSlot(slotValue);
                    if (eventDate.startDate && eventDate.endDate) {
                        relevantEvents = getEventsBetweenDates(eventDate.startDate, eventDate.endDate, eventList);

                        if (relevantEvents.length > 0) {
                            parent.handler.state = states.DESCRIPTION;

                            let cardContent = "";
                            output = oneEventMessage;
                            if (relevantEvents.length > 1) {
                                output = utils.format(multipleEventMessage, relevantEvents.length);
                            }

                            output += scheduledEventMessage;

                            if (relevantEvents.length > 1) {
                                output += utils.format(firstThreeMessage, relevantEvents.length > 3 ? 3 : relevantEvents.length);
                            }

                            if (relevantEvents[0] != null) {
                                let date = new Date(relevantEvents[0].start);
                                output += utils.format(eventSummary, "First", removeTags(relevantEvents[0].summary), relevantEvents[0].location, date.toDateString() + ".");
                            }
                            if (relevantEvents[1]) {
                                let date = new Date(relevantEvents[1].start);
                                output += utils.format(eventSummary, "Second", removeTags(relevantEvents[1].summary), relevantEvents[1].location, date.toDateString() + ".");
                            }
                            if (relevantEvents[2]) {
                                let date = new Date(relevantEvents[2].start);
                                output += utils.format(eventSummary, "Third", removeTags(relevantEvents[2].summary), relevantEvents[2].location, date.toDateString() + ".");
                            }

                            for (let i = 0; i < relevantEvents.length; i++) {
                                let date = new Date(relevantEvents[i].start);
                                cardContent += utils.format(cardContentSummary, removeTags(relevantEvents[i].summary), removeTags(relevantEvents[i].location), date.toDateString()+ "\n\n");
                            }

                            output += eventNumberMoreInfoText;
                            alexa.response.cardRenderer(cardTitle, cardContent);
                            alexa.response.speak(output).listen(haveEventsreprompt);
                        } else {
                            output = NoDataMessage;
                            alexa.emit(output).listen(output);
                        }
                    }
                    else {
                        output = NoDataMessage;
                        alexa.emit(output).listen(output);
                    }
                } else {
                    output = NoDataMessage;
                    alexa.emit(output).listen(output);
                }
            });
        }
        else{
            this.response.speak("I'm sorry.  What day did you want me to look for events?").listen("I'm sorry.  What day did you want me to look for events?");
        }

        this.emit(':responseReady');
    },

    'AMAZON.HelpIntent': function () {
        output = HelpMessage;
        this.response.speak(output).listen(output);
        this.emit(':responseReady');
    },

    'AMAZON.StopIntent': function () {
        this.response.speak(killSkillMessage);
    },

    'AMAZON.CancelIntent': function () {
        this.response.speak(killSkillMessage);
    },

    'SessionEndedRequest': function () {
        this.emit('AMAZON.StopIntent');
    },

    'Unhandled': function () {
        this.response.speak(HelpMessage).listen(HelpMessage);
        this.emit(':responseReady');
    }
});

const descriptionHandlers = Alexa.CreateStateHandler(states.DESCRIPTION, {
    'EventIntent': function () {

        const reprompt = " Would you like to hear another event?";
        let slotValue = this.event.request.intent.slots.number.value;

        const index = parseInt(slotValue, 10) - 1;

        if (relevantEvents[index]) {

            output = descriptionMessage + removeTags(relevantEvents[index].description);

            output += reprompt;

            this.response.cardRenderer(relevantEvents[index].summary, output);
            this.response.speak(output).listen(reprompt);
        } else {
            this.response.speak(eventOutOfRange).listen(welcomeMessage);
        }

        this.emit(':responseReady');
    },

    'AMAZON.HelpIntent': function () {
        this.response.speak(descriptionStateHelpMessage).listen(descriptionStateHelpMessage);
        this.emit(':responseReady');
    },

    'AMAZON.StopIntent': function () {
        this.response.speak(killSkillMessage);
        this.emit(':responseReady');
    },

    'AMAZON.CancelIntent': function () {
        this.response.speak(killSkillMessage);
        this.emit(':responseReady');
    },

    'AMAZON.NoIntent': function () {
        this.response.speak(shutdownMessage);
        this.emit(':responseReady');
    },

    'AMAZON.YesIntent': function () {
        output = welcomeMessage;
        alexa.response.speak(eventNumberMoreInfoText).listen(eventNumberMoreInfoText);
        this.emit(':responseReady');
    },

    'SessionEndedRequest': function () {
        this.emit('AMAZON.StopIntent');
    },

    'Unhandled': function () {
        this.response.speak(HelpMessage).listen(HelpMessage);
        this.emit(':responseReady');
    }
});

exports.handler = function (event, context, callback) {
    alexa = Alexa.handler(event, context);
    alexa.appId = "amzn1.ask.skill.13acd6b0-a967-409f-95a3-a81d18d88ac5";
    alexa.registerHandlers(newSessionHandlers, startSearchHandlers, descriptionHandlers);
    alexa.execute();
};

function removeTags(str) {
    if (str) {
        return str.replace(/<(?:.|\n)*?>/gm, '');
    }
}

function getDateFromSlot(rawDate) {
    let date = new Date(Date.parse(rawDate));
    let eventDate = {

    };

    if (isNaN(date)) {
        const res = rawDate.split("-");
        if (res.length === 2 && res[1].indexOf('W') > -1) {
            let dates = getWeekData(res);
            eventDate["startDate"] = new Date(dates.startDate);
            eventDate["endDate"] = new Date(dates.endDate);
        } else if (res.length === 3) {
            let dates = getWeekendData(res);
            eventDate["startDate"] = new Date(dates.startDate);
            eventDate["endDate"] = new Date(dates.endDate);
        } else {
            eventDate["error"] = dateOutOfRange;
        }
    } else {
        eventDate["startDate"] = new Date(date).setUTCHours(0, 0, 0, 0);
        eventDate["endDate"] = new Date(date).setUTCHours(24, 0, 0, 0);
    }
    return eventDate;
}

function getWeekendData(res) {
    if (res.length === 3) {
        const saturdayIndex = 5;
        const sundayIndex = 6;
        const weekNumber = res[1].substring(1);

        const weekStart = w2date(res[0], weekNumber, saturdayIndex);
        const weekEnd = w2date(res[0], weekNumber, sundayIndex);

        return {
            startDate: weekStart,
            endDate: weekEnd,
        };
    }
}

function getWeekData(res) {
    if (res.length === 2) {

        const mondayIndex = 0;
        const sundayIndex = 6;

        const weekNumber = res[1].substring(1);

        const weekStart = w2date(res[0], weekNumber, mondayIndex);
        const weekEnd = w2date(res[0], weekNumber, sundayIndex);

        return {
            startDate: weekStart,
            endDate: weekEnd,
        };
    }
}

const w2date = function (year, wn, dayNb) {
    const day = 86400000;

    const j10 = new Date(year, 0, 10, 12, 0, 0),
        j4 = new Date(year, 0, 4, 12, 0, 0),
        mon1 = j4.getTime() - j10.getDay() * day;
    return new Date(mon1 + ((wn - 1) * 7 + dayNb) * day);
};

function getEventsBetweenDates(startDate, endDate, eventList) {

    const start = new Date(startDate);
    const end = new Date(endDate);

    let data = new Array();

    for (let i = 0; i < eventList.length; i++) {
        if (start <= eventList[i].start && end >= eventList[i].start) {
            data.push(eventList[i]);
        }
    }

    console.log("FOUND " + data.length + " events between those times");
    return data;
}