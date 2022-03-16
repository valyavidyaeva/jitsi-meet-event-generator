let emailState = {
    attachments: [],
    subject: '',
    initialBody: '',
};
let storageData = {};
let composeActionTabId;

document.addEventListener('DOMContentLoaded', () => {
    setInitials();
    setDefaultPopupValues();
    dataI18n();
    setListeners();
});

async function setInitials() {
    const tabs = await messenger.tabs.query({
        active: true,
        currentWindow: true,
    });
    composeActionTabId = tabs[0].id;
    emailState.attachments = await messenger.compose.listAttachments(composeActionTabId);
    const currentData = await messenger.compose.getComposeDetails(composeActionTabId);
    if (currentData.isPlainText) {
        emailState.initialBody = currentData.plainTextBody;
    }
    else {
        emailState.initialBody = new DOMParser().parseFromString(currentData.body, 'text/html');
    }
}

function setDefaultPopupValues() {
    const storage = browser.storage.local.get();
    storage.then((res) => {
        storageData = Object.assign({}, res);
        if (res['conf-name'] === 'random') {
            document.getElementById('conf-name').value = getRandomString();
        }
        else if (res['conf-name-custom-value']) {
            document.getElementById('conf-name').value = res['conf-name-custom-value'];
        }

        document.getElementById('js-timezone-value').innerText = storageData.timezone_text;
    });
}

function setListeners() {
    document.getElementById('create-btn').addEventListener('click', createMessage);
    document.getElementById('cancel-btn').addEventListener('click', deleteMessage);
    document.getElementById('conf-duration').addEventListener('input', (event) => handleDurationInput(event));
    document.querySelectorAll('.js-date-time-input').forEach(item => {
        item.addEventListener('change', (event) => handleDateInputChange(event));
    });
}

async function createMessage(e) {
    e.preventDefault();

    const fileObj = {
        file: createIcsFile(),
        name: 'jitsi-invite.ics',
    };

    if (emailState.attachments.length) {
        const index = emailState.attachments.findIndex(file => file.name === 'jitsi-invite.ics');
        if (index > -1) {
            await messenger.compose.updateAttachment(composeActionTabId, emailState.attachments[index].id, fileObj);
        }
        else {
            await messenger.compose.addAttachment(composeActionTabId, fileObj);
        }
    }
    else {
        await messenger.compose.addAttachment(composeActionTabId, fileObj);
    }
    emailState.attachments = await messenger.compose.listAttachments(composeActionTabId);

    const subjectValue = document.getElementById('conf-subject').value;
    emailState.subject = subjectValue;
    messenger.compose.setComposeDetails(composeActionTabId, {
        subject: subjectValue,
    });

    const currentData = await messenger.compose.getComposeDetails(composeActionTabId);
    const messageBody = createMessageBody();
    if (currentData.isPlainText) {
        let body = currentData.plainTextBody;
        body += messageBody.bodyText;
        messenger.compose.setComposeDetails(composeActionTabId, { plainTextBody: body });
    }
    else {
        let document = new DOMParser().parseFromString(currentData.body, 'text/html');
        document.body.insertAdjacentHTML( 'beforeend', messageBody.bodyHtml);
        let html = new XMLSerializer().serializeToString(document);
        messenger.compose.setComposeDetails(composeActionTabId, { body: html });
    }
}

async function deleteMessage() {
    const currentData = await messenger.compose.getComposeDetails(composeActionTabId);

    if (emailState.subject === currentData.subject) {
        messenger.compose.setComposeDetails(composeActionTabId, {
            subject: '',
        });
        emailState.subject = '';
    }

    let html = new XMLSerializer().serializeToString(emailState.initialBody);
    messenger.compose.setComposeDetails(composeActionTabId, { body: html });

    if (emailState.attachments.length) {
        const index = emailState.attachments.findIndex(file => file.name === 'jitsi-invite.ics');
        if (index > -1) {
            await messenger.compose.removeAttachment(composeActionTabId, emailState.attachments[index].id);
            emailState.attachments = await messenger.compose.listAttachments(composeActionTabId);
        }
    }

    if (storageData['conf-name'] === 'random') {
        document.getElementById('conf-name').value = getRandomString();
    }
    else if (storageData['conf-name-custom-value']) {
        document.getElementById('conf-name').value = storageData['conf-name-custom-value'];
    }
}

function createIcsFile() {
    const eventDate = {
            start: document.querySelector('#conf-start-date').value,
            end: document.querySelector('#conf-end-date').value
        },
        eventTime = {
            start: document.querySelector('#conf-start-time').value,
            end: document.querySelector('#conf-end-time').value
        },
        timezone = storageData.timezone;

    const data = createIcsEvent({
        uid: UIDGenerator(eventDate, eventTime, timezone),
        date: eventDate,
        time: eventTime,
        timezone,
        summary: document.getElementById('conf-subject').value,
        description: storageData['conf-description'],
        organizer: storageData.organizer,
        alarm: storageData.alarm,
        url: createConfLink(),
    });
    return new File([data], 'jitsi-invite.ics', { type: 'text/calendar' });
}

function createIcsEvent(data) {
    const { uid, date, time, timezone, summary, description, organizer, alarm, url } = data;
    let alarmBlock = "";
    if (alarm) {
        alarmBlock =
            "BEGIN:VALARM\n" +
            "TRIGGER:" + alarm + "\n" +
            "ACTION:DISPLAY\n" +
            "DESCRIPTION:" + description + "\n" +
            "END:VALARM\n"
        ;
    }
    return "BEGIN:VCALENDAR\n" +
        "PRODID:-//Test Cal//EN\n" +
        "VERSION:2.0\n" +
        "CALSCALE:GREGORIAN\n" +
        "METHOD:REQUEST\n" +
        alarmBlock +
        "BEGIN:VEVENT\n" +
        "DTSTAMP:" + convertDate(date.start, time.start) + "\n" +
        "DTSTART;TZID=" + timezone + ":" + convertDate(date.start, time.start) + "\n" +
        "DTEND;TZID=" + timezone + ":" + convertDate(date.end, time.end) + "\n" +
        "UID:" + uid + "\n" +
        "LOCATION:" + url + "\n" +
        "URL:" + url + "\n" +
        (organizer ? "ORGANIZER;CN=" + organizer + ":mailto:" + organizer + "\n" : "") +
        (description ? "DESCRIPTION:" + description + "\n" : "") +
        (summary ? "SUMMARY:" + summary + "\n" : "") +
        "SEQUENCE:0\n" +
        "TRANSP:OPAQUE\n" +
        "END:VEVENT\n" +
        "END:VCALENDAR";
}

function convertDate(date, time) {
    const dateStr = date.split('-').join('');
    const timeStr = 'T' + time.split(':').join('') + '00';
    return dateStr + timeStr;
}

function createMessageBody() {
    const confLink = createConfLink();
    const confSubject = document.getElementById('conf-subject').value;
    const startDate = document.getElementById('conf-start-date').value;
    const startDateStr = startDate.split('-').reverse().join('.');
    const startTime = document.getElementById('conf-start-time').value;
    const endDate = document.getElementById('conf-end-date').value;
    const endDateStr = endDate.split('-').reverse().join('.');
    const endTime = document.getElementById('conf-end-time').value;
    const duration = document.getElementById('conf-duration').value;

    let bodyText = '';
    let bodyHtml = '';

    const messageTemplate = storageData['message-template'];
    if (messageTemplate) {
        const dict = {
            description: storageData['conf-description'],
            organizer: storageData.organizer,
            startDate: startDateStr,
            startTime: startTime,
            endDate: endDateStr,
            endTime: endTime,
            timezone: storageData.timezone_text,
            duration: duration,
            confLink: confLink,
            confSubject: confSubject,
        };
        let parsedMessageTemplate = messageTemplate;
        for (const [key, value] of Object.entries(dict)) {
            const searchedStr = '${' + key + '}';
            parsedMessageTemplate = parsedMessageTemplate.replace(searchedStr, value);
        }
        const parsedMessageTemplateArr = parsedMessageTemplate.split("\n");
        parsedMessageTemplateArr.forEach(item => {
            bodyHtml += `<p>${ item }</p>`;
        });
        bodyText = parsedMessageTemplateArr.join('\n');
    }
    else {
        if (storageData['conf-description']) {
            bodyText += `${storageData['conf-description']} \n`;
            bodyHtml += `<p>${storageData['conf-description']}</p>`;
        }
        if (storageData['organizer']) {
            bodyText += `Организатор: ${storageData.organizer} \n`;
            bodyHtml += `<p>Организатор: ${storageData.organizer}</p>`;
        }

        bodyText += `
            Начало ${startDateStr} в ${startTime},
            окончание ${endDateStr} в ${endTime},
            (${duration} мин),
            временная зона – ${storageData.timezone_text} \n
            ${confLink} \n
        `;

        bodyHtml += `
            <p>
                Начало ${startDateStr} в ${startTime},
                окончание ${endDateStr} в ${endTime},
                (${duration} мин),
                временная зона – ${storageData.timezone_text}
             </p>
            <p>${confLink}</p>
        `;
    }

    return { bodyText, bodyHtml };
}

function createConfLink() {
    // Docs https://jitsi.github.io/handbook/docs/user-guide/user-guide-advanced
    const JITSI_DOMAIN = 'https://meet.jit.si/';

    let domain;
    if (storageData['server-custom-value']) {
        domain = storageData['server-custom-value'];
    }
    else {
        domain = JITSI_DOMAIN;
    }

    let confName = '';
    if (storageData['conf-name'] === 'custom' && storageData['conf-name-custom-value']) {
        confName = storageData['conf-name-custom-value'];
    }
    else {
        confName = getRandomString();
    }

    let confLink = '';
    confLink += domain;
    confLink += confName;
    confLink += `#config.requireDisplayName=${!!storageData['required-user-name']}`;
    confLink += `&config.startWithVideoMuted=${storageData['no-video']}`;
    confLink += `&config.startWithAudioMuted=${storageData['no-sound']}`;
    confLink += '&interfaceConfig.SHOW_CHROME_EXTENSION_BANNER=false';
    return confLink;
}

function UIDGenerator(date, time, timezone) {
    return 'jitsimeetEvent' + convertDate(date.start, time.start) + convertDate(date.end, time.end) + timezone;
}

function handleDurationInput(event) {
    event.target.value = event.target.value.replace(/[^\d,]/gi, '');
    handleDateInputChange(event);
}

function handleDateInputChange(event) {
    const changedField = event.target.id;
    const startDateField = document.getElementById('conf-start-date');
    const startTimeField = document.getElementById('conf-start-time');
    const endDateField = document.getElementById('conf-end-date');
    const endTimeField = document.getElementById('conf-end-time');
    const durationField = document.getElementById('conf-duration');
    const startDateValue = startDateField.value;
    const startTimeValue = startTimeField.value;
    const endDateValue = endDateField.value;
    const endTimeValue = endTimeField.value;
    const durationValue = Number(durationField.value);

    if (changedField === 'conf-duration') {
        if (durationValue && !isNaN(durationValue)) {
            if (startDateValue && startTimeValue) {
                const startDateArr = startDateValue.split('-').map(_ => Number(_));
                const startTimeArr = startTimeValue.split(':').map(_ => Number(_));
                const startDate = new Date(startDateArr[0], startDateArr[1] - 1, startDateArr[2], startTimeArr[0], startTimeArr[1]);
                const end = new Date(startDate.getTime() + durationValue*60*1000);
                endDateField.value = `${end.getFullYear()}-${(end.getMonth() + 1).toString().padStart(2, '0')}-${(end.getDate()).toString().padStart(2, '0')}`;
                endTimeField.value = end.getHours().toString().padStart(2, '0') + ':' + end.getMinutes().toString().padStart(2, '0');
            }
            else if (endDateValue && endTimeValue) {
                const endDateArr = endDateValue.split('-').map(_ => Number(_));
                const endTimeArr = endTimeValue.split(':').map(_ => Number(_));
                const endDate = new Date(endDateArr[0], endDateArr[1] - 1, endDateArr[2], endTimeArr[0], endTimeArr[1]);
                const start = new Date(endDate.getTime() - durationValue*60*1000);
                startDateField.value = `${start.getFullYear()}-${(start.getMonth() + 1).toString().padStart(2, '0')}-${(start.getDate()).toString().padStart(2, '0')}`;
                startTimeField.value = start.getHours().toString().padStart(2, '0') + ':' + start.getMinutes().toString().padStart(2, '0');
            }
        }
        else {
            endDateField.value = '';
            endTimeField.value = '';
        }
    }
    else {
        if (startDateValue && startTimeValue && endDateValue && endTimeValue) {
            const startDateArr = startDateValue.split('-').map(_ => Number(_));
            const startTimeArr = startTimeValue.split(':').map(_ => Number(_));
            const endDateArr = endDateValue.split('-').map(_ => Number(_));
            const endTimeArr = endTimeValue.split(':').map(_ => Number(_));
            const startDate = new Date(startDateArr[0], startDateArr[1] - 1, startDateArr[2]);
            const startDatetime = new Date(startDateArr[0], startDateArr[1] - 1, startDateArr[2], startTimeArr[0], startTimeArr[1]);
            const endDate = new Date(endDateArr[0], endDateArr[1] - 1, endDateArr[2]);
            const endDatetime = new Date(endDateArr[0], endDateArr[1] - 1, endDateArr[2], endTimeArr[0], endTimeArr[1]);
            if (endDatetime.getTime() > startDatetime.getTime()) {
                durationField.value = Math.abs((endDatetime.getTime() - startDatetime.getTime()) / 60 / 1000);
            }
            else {
                if (endDate.getTime() <= startDate.getTime()) {
                    endDateField.value = '';
                }
                endTimeField.value = '';
                durationField.value = '';
            }
        }
        else {
            durationField.value = '';
        }
    }

    if (startDateField.value && startTimeField.value && endDateField.value && endTimeField.value) {
        document.getElementById('create-btn').disabled = false;
    }
    else {
        document.getElementById('create-btn').disabled = true;
    }
}