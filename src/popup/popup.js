let composeActionTabId;
let windowId;
let emailInitialState = {}
let storageData = {};

(async () => {
    await setInitials();
    await setInitialPopupValues();
    dataI18n();
    setListeners();
})();

async function setInitials() {
    const tabs = await messenger.tabs.query({
        active: true,
        currentWindow: true,
    });
    composeActionTabId = tabs[0].id;
    windowId = tabs[0].windowId;
}

async function getWindowStorage() {
    const storage = await browser.storage.local.get([`windowId-${windowId}`]);
    return JSON.parse(storage[`windowId-${windowId}`]);
}

async function setWindowStorage(newData) {
    const currentStorage = await browser.storage.local.get([`windowId-${windowId}`]);
    const currentStorageObject = JSON.parse(currentStorage[`windowId-${windowId}`]);
    const newStorage = Object.assign(currentStorageObject, newData);
    await browser.storage.local.set({ [`windowId-${windowId}`]: JSON.stringify(newStorage) });
}

async function setInitialPopupValues() {
    const storage = await browser.storage.local.get();
    storageData = Object.assign({}, storage);
    const windowStorage = await getWindowStorage();
    emailInitialState = windowStorage.emailInitialState;
    const popupFormFromWindowStorage = windowStorage.popupFormObject;

    if (popupFormFromWindowStorage && popupFormFromWindowStorage['conf-name-custom-value']) {
        document.getElementById('conf-name-custom-value').value = popupFormFromWindowStorage['conf-name-custom-value'];
    }
    else if (storageData['conf-name'] === 'random') {
        document.getElementById('conf-name-custom-value').value = getRandomString();
    }
    else if (storageData['conf-name-custom-value']) {
        document.getElementById('conf-name-custom-value').value = storageData['conf-name-custom-value'];
    }

    if (popupFormFromWindowStorage && popupFormFromWindowStorage['conf-subject']) {
        document.getElementById('conf-subject').value = popupFormFromWindowStorage['conf-subject'];
    }

    document.getElementById('js-timezone-value').innerText = storageData.timezone_text;
    const startDateField = document.getElementById('conf-start-date');
    const startTimeField = document.getElementById('conf-start-time');
    if (popupFormFromWindowStorage && popupFormFromWindowStorage['conf-start-date']) {
        startDateField.value = popupFormFromWindowStorage['conf-start-date'];
        startTimeField.value = popupFormFromWindowStorage['conf-start-time']
    }
    else {
        const start = new Date();
        startDateField.value = `${start.getFullYear()}-${(start.getMonth() + 1).toString().padStart(2, '0')}-${(start.getDate()).toString().padStart(2, '0')}`;
        startTimeField.value = start.getHours().toString().padStart(2, '0') + ':' + start.getMinutes().toString().padStart(2, '0');
    }
    if (popupFormFromWindowStorage && popupFormFromWindowStorage['conf-duration']) {
        document.getElementById('conf-duration').value = popupFormFromWindowStorage['conf-duration'];
    }
    else {
        document.getElementById('conf-duration').value = storageData.duration;
    }
    handleDateInputChange();
}

function setListeners() {
    document.getElementById('create-btn').addEventListener('click', createMessage);
    document.getElementById('cancel-btn').addEventListener('click', deleteMessage);
    document.getElementById('conf-duration').addEventListener('input', (event) => handleDurationInput(event));
    document.querySelectorAll('.js-date-time-input').forEach(item => {
        item.addEventListener('change', (event) => handleDateInputChange(event));
    });
    document.getElementById('conf-name-custom-value').addEventListener('change', function (event){
        event.target.value = toDashCase(event.target.value);
    });
}

async function createMessage(e) {
    e.preventDefault();

    const fileObj = {
        file: createIcsFile(),
        name: 'jitsi-invite.ics',
    };
    const currentAttachments = await messenger.compose.listAttachments(composeActionTabId);

    if (currentAttachments.length) {
        const index = currentAttachments.findIndex(file => file.name === 'jitsi-invite.ics');
        if (index > -1) {
            await messenger.compose.updateAttachment(composeActionTabId, currentAttachments[index].id, fileObj);
        }
        else {
            await messenger.compose.addAttachment(composeActionTabId, fileObj);
        }
    }
    else {
        await messenger.compose.addAttachment(composeActionTabId, fileObj);
    }

    const subjectValue = document.getElementById('conf-subject').value;
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

    await updatePopupFormData();
}

async function deleteMessage() {
    const currentData = await messenger.compose.getComposeDetails(composeActionTabId);
    const currentAttachments = await messenger.compose.listAttachments(composeActionTabId);

    if (emailInitialState.subject !== currentData.subject) {
        messenger.compose.setComposeDetails(composeActionTabId, {
            subject: emailInitialState.subject,
        });
    }

    let parsedInitialBody = new DOMParser().parseFromString(emailInitialState.initialBody, 'text/html');
    let html = new XMLSerializer().serializeToString(parsedInitialBody);
    messenger.compose.setComposeDetails(composeActionTabId, { body: html });

    if (currentAttachments.length) {
        const index = currentAttachments.findIndex(file => file.name === 'jitsi-invite.ics');
        if (index > -1) {
            await messenger.compose.removeAttachment(composeActionTabId, currentAttachments[index].id);
        }
    }

    await setWindowStorage({ 'popupFormObject': null })
    await setInitialPopupValues();
}

function createIcsFile() {
    const eventDate = {
            start: document.querySelector('#conf-start-date').value,
            end: document.querySelector('#conf-end-date').value
        };
    const eventTime = {
            start: document.querySelector('#conf-start-time').value,
            end: document.querySelector('#conf-end-time').value
        };
    const timezone = storageData.timezone;
    const location = storageData.server === 'custom' && storageData['server-custom-value'] ? storageData['server-custom-value'] : JITSI_DOMAIN;
    const messageBody = createMessageBody();

    const data = createIcsEvent({
        uid: UIDGenerator(eventDate, eventTime, timezone),
        date: eventDate,
        time: eventTime,
        timezone,
        location,
        summary: document.getElementById('conf-subject').value,
        description: messageBody.bodyString,
        organizer: storageData.organizer,
        alarm: storageData.alarm,
        url: createConfLink(),
    });
    return new File([data], 'jitsi-invite.ics', { type: 'text/calendar' });
}

function createIcsEvent(data) {
    const { uid, date, time, timezone, location, summary, description, organizer, alarm, url } = data;
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
        "PRODID:-//Jitsi Meet Event//EN\n" +
        "VERSION:2.0\n" +
        "CALSCALE:GREGORIAN\n" +
        "METHOD:REQUEST\n" +
        alarmBlock +
        "BEGIN:VEVENT\n" +
        "DTSTAMP:" + convertDate(date.start, time.start) + "\n" +
        "DTSTART;TZID=" + timezone + ":" + convertDate(date.start, time.start) + "\n" +
        "DTEND;TZID=" + timezone + ":" + convertDate(date.end, time.end) + "\n" +
        "UID:" + uid + "\n" +
        "LOCATION:" + location + "\n" +
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
    let bodyString = '';

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
        const parsedMessageTemplateArr = parsedMessageTemplate.split('\n');
        parsedMessageTemplateArr.forEach(item => {
            bodyHtml += `<p>${ item }</p>`;
        });
        bodyText = parsedMessageTemplate;
        bodyString = parsedMessageTemplateArr.join('\\n').toString();
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
            Начало ${startDateStr} в ${startTime}, \n
            окончание ${endDateStr} в ${endTime} (${duration} мин), \n
            временная зона – ${storageData.timezone_text} \n
            ${confLink}
        `;

        bodyString += `
            Начало ${startDateStr} в ${startTime}, \n
            окончание ${endDateStr} в ${endTime} (${duration} мин), \n
            временная зона – ${storageData.timezone_text} \n
            ${confLink}
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

    return { bodyText, bodyHtml, bodyString };
}

function createConfLink() {
    // Docs https://jitsi.github.io/handbook/docs/user-guide/user-guide-advanced

    let domain = JITSI_DOMAIN;
    if (storageData['server-custom-value']) {
        domain = storageData['server-custom-value'];
    }

    const confNameValue = document.getElementById('conf-name-custom-value').value;
    let confName = getRandomString();
    if (storageData['conf-name'] === 'custom' && storageData['conf-name-custom-value']) {
        confName = storageData['conf-name-custom-value'];
    }
    if (confNameValue) {
        confName = confNameValue;
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
    let value = Number(event.target.value);
    if (value && !isNaN(value)) {
        if (value > 0) event.target.value = value;
        else event.target.value = storageData.duration;
    }
    else {
        event.target.value = storageData.duration;
    }
    handleDateInputChange();
}

function handleDateInputChange() {
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

    if (startDateValue && startTimeValue && durationValue) {
        const startDateArr = startDateValue.split('-').map(_ => Number(_));
        const startTimeArr = startTimeValue.split(':').map(_ => Number(_));
        const startDate = new Date(startDateArr[0], startDateArr[1] - 1, startDateArr[2], startTimeArr[0], startTimeArr[1]);
        const end = new Date(startDate.getTime() + durationValue*60*1000);
        endDateField.value = `${end.getFullYear()}-${(end.getMonth() + 1).toString().padStart(2, '0')}-${(end.getDate()).toString().padStart(2, '0')}`;
        endTimeField.value = end.getHours().toString().padStart(2, '0') + ':' + end.getMinutes().toString().padStart(2, '0');
    }
    else if (endDateValue && endTimeValue && durationValue) {
        const endDateArr = endDateValue.split('-').map(_ => Number(_));
        const endTimeArr = endTimeValue.split(':').map(_ => Number(_));
        const endDate = new Date(endDateArr[0], endDateArr[1] - 1, endDateArr[2], endTimeArr[0], endTimeArr[1]);
        const start = new Date(endDate.getTime() - durationValue*60*1000);
        startDateField.value = `${start.getFullYear()}-${(start.getMonth() + 1).toString().padStart(2, '0')}-${(start.getDate()).toString().padStart(2, '0')}`;
        startTimeField.value = start.getHours().toString().padStart(2, '0') + ':' + start.getMinutes().toString().padStart(2, '0');
    }

    document.getElementById('create-btn').disabled = !(startDateField.value && startTimeField.value && endDateField.value && endTimeField.value);
}

async function updatePopupFormData() {
    const formElement = document.getElementById('conf-form');
    let popupFormData = new FormData(formElement);
    let popupFormObject = {};
    for (let pair of popupFormData.entries()) {
        popupFormObject[pair[0]] = pair[1];
    }
    await setWindowStorage({ popupFormObject });
}