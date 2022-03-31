async function setInitialStorageOptions() {
    const systemTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const foundedTz = TZ.find(item => item.tzCode === systemTz);
    const defaultAccount = await browser.accounts.getDefault();
    const defaultValues = {
        'timezone': foundedTz.tzCode,
        'timezone_text': foundedTz.label,
        'server': 'public',
        'server-custom-value': '',
        'organizer': defaultAccount.identities[0].email,
        'conf-description': '',
        'conf-name': 'random',
        'conf-name-custom-value': '',
        'duration': 30,
        'required-user-name': true,
        'no-sound': true,
        'no-video': true,
        'alarm': 0,
        'message-template':
            '${confSubject}\n' +
            '${description}\n' +
            '${organizer}\n' +
            '${startDate}, ${startTime}\n' +
            '${endDate}, ${endTime} (${duration})\n' +
            '${timezone}\n' +
            '${confLink}\n',
    };

    const storage = browser.storage.local.get();
    storage.then((res) => {
        browser.storage.local.set(Object.assign(defaultValues, res));
    });
}

async function setInitialWindowStorage(window) {
    const tabs = await browser.tabs.query({windowId: window.id});
    const composeActionTabId = tabs[0].id;

    const emailInitialState = {
        attachments: [],
        subject: '',
        initialBody: '',
    };
    emailInitialState.attachments = await messenger.compose.listAttachments(composeActionTabId);
    const currentData = await messenger.compose.getComposeDetails(composeActionTabId);
    emailInitialState.subject = currentData.subject;
    if (currentData.isPlainText) {
        emailInitialState.initialBody = currentData.plainTextBody;
    }
    else {
        emailInitialState.initialBody = currentData.body;
    }

    browser.storage.local.set({ [`windowId-${window.id}`]: JSON.stringify({ emailInitialState }) });
}

(() => {
    setInitialStorageOptions();

    browser.windows.onCreated.addListener((window) => setInitialWindowStorage(window));

    browser.windows.onRemoved.addListener(window => {
        browser.storage.local.remove([`windowId-${window}`]);
    });
})();

