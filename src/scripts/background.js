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

document.addEventListener('DOMContentLoaded', () => {
    setInitialStorageOptions();
});
