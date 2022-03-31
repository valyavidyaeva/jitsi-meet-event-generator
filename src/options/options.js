function saveOptions(e) {
    e.preventDefault();

    checkDisablingServerCustomValue();
    checkServerCustomValue();
    checkDisablingConfNameCustomValue();
    checkConfNameCustomValue();

    browser.storage.local.set({
        "timezone": document.querySelector("#timezone").value,
        "timezone_text": document.querySelector("#timezone").dataset.text,
        "server": document.querySelector("[name='server']:checked").value,
        "server-custom-value": document.querySelector("#server-custom-value").value,
        "organizer": document.querySelector("#organizer").value,
        "conf-description": document.querySelector("#conf-description").value,
        "conf-name": document.querySelector("[name='conf-name']:checked").value,
        "conf-name-custom-value": document.querySelector("#conf-name-custom-value").value,
        "duration": document.querySelector("#duration").value,
        "required-user-name": document.querySelector("#required-user-name").checked,
        "no-sound": document.querySelector("#no-sound").checked,
        "no-video": document.querySelector("#no-video").checked,
        "alarm": document.querySelector("#alarm").value,
        "message-template": document.querySelector("#message-template").value,
    });
}

function fillOptionsValuesFromStorage() {
    const storage = browser.storage.local.get();
    storage.then((res) => {
        document.querySelector("#timezone").value = res.timezone;
        document.querySelector("#timezone").dataset.text = res.timezone_text;
        document.querySelector(`[name='server'][value='${ res.server }']`).checked = true;
        document.querySelector("#server-custom-value").value = res['server-custom-value'];
        document.querySelector("#organizer").value = res.organizer;
        document.querySelector("#conf-description").value = res['conf-description'];
        document.querySelector(`[name='conf-name'][value='${ res['conf-name'] }']`).checked = true;
        document.querySelector("#conf-name-custom-value").value = res['conf-name-custom-value'];
        document.querySelector("#duration").value = res.duration;
        document.querySelector("#required-user-name").checked = res['required-user-name'];
        document.querySelector("#no-sound").checked = res['no-sound'];
        document.querySelector("#no-video").checked = res['no-video'];
        document.querySelector("#alarm").value = res.alarm;
        document.querySelector("#message-template").value = res['message-template'];
        checkDisablingServerCustomValue();
        checkDisablingConfNameCustomValue();
    });
}

function createTimezonesSelector() {
    let selectList = document.getElementById("timezone");
    for (let i = 0; i < TZ.length; i++) {
        let option = document.createElement("option");
        option.value = TZ[i].tzCode;
        option.text = TZ[i].label;
        option.dataset.text = TZ[i].label;
        selectList.appendChild(option);
    }
}

function checkDisablingServerCustomValue() {
    const serverCustomRadio = document.getElementById('server-custom');
    const serverCustomField = document.getElementById('server-custom-value');
    serverCustomField.disabled = !serverCustomRadio.checked;
}

function checkServerCustomValue() {
    const serverCustomField = document.getElementById('server-custom-value');
    let value = serverCustomField.value;
    if (!value) {
        serverCustomField.value = JITSI_DOMAIN;
    }
    else {
        const backSlashRegex = /\/$/g;
        if (!backSlashRegex.test(value)) serverCustomField.value = value + '/';
    }
}

function checkDisablingConfNameCustomValue() {
    const confNameCustomRadio = document.getElementById('conf-name-custom');
    const confNameCustomField = document.getElementById('conf-name-custom-value');
    confNameCustomField.disabled = !confNameCustomRadio.checked;
}

function checkConfNameCustomValue() {
    const serverCustomField = document.getElementById('conf-name-custom-value');
    let value = serverCustomField.value;
    if (!value) {
        serverCustomField.value = getRandomString();
    }
}

(() => {
    createTimezonesSelector();
    fillOptionsValuesFromStorage();
    dataI18n();

    document.getElementById('options-form').addEventListener('submit', saveOptions);
    document.getElementById('server-public').addEventListener('change', checkDisablingServerCustomValue);
    document.getElementById('server-custom').addEventListener('change', checkDisablingServerCustomValue);
    document.getElementById('server-custom-value').addEventListener('change', checkServerCustomValue);
    document.getElementById('conf-name-random').addEventListener('change', checkDisablingConfNameCustomValue);
    document.getElementById('conf-name-custom').addEventListener('change', checkDisablingConfNameCustomValue);
    document.getElementById('conf-name-custom-value').addEventListener('change', checkConfNameCustomValue);
    document.getElementById('timezone').addEventListener('change', function (event){
        this.dataset.text = event.target.selectedOptions[0].dataset.text;
    })
    document.getElementById('conf-name-custom-value').addEventListener('change', function (event){
        event.target.value = toDashCase(event.target.value);
    })
    document.getElementById('duration').addEventListener('input', function (event){
    let value = Number(event.target.value);
    if (value && !isNaN(value)) {
        if (value > 0) event.target.value = value;
        else event.target.value = 30;
    }
    else {
        event.target.value = 30;
    }
})
})();