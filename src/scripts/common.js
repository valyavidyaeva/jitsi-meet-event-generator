const JITSI_DOMAIN = 'https://meet.jit.si/';

function i18n(messageName, substitutions = undefined) {
    if (substitutions === undefined) {
        return browser.i18n.getMessage(messageName);
    } else {
        return browser.i18n.getMessage(messageName, substitutions);
    }
}

function dataI18n() {
    document.querySelectorAll('[data-i18n]').forEach(element => {
        // NOTE: we only support _ONE_ attribute (separated by '|') atm!
        let [text, attr] = element.dataset.i18n.split('|');

        if (attr) {
            if (attr.charAt(0) === "$") {
                attr = i18n(attr.substring(1));
            }

            text = i18n(text, attr);
        } else {
            text = i18n(text);
        }

        element.appendChild(document.createTextNode(text));
    });
}

function getRandomString() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function toDashCase(string){
    let value = string;
    value = value.replace(/^\s+/gi, '');
    value = value.replace(/\s+$/gi, '');
    value = value.replace(/\s+/gi, '-');
    return value;
}

function foldLine(line) {
    const parts = []
    let length = 75
    while (line.length > length) {
        parts.push(line.slice(0, length))
        line = line.slice(length)
        length = 74
    }
    parts.push(line)
    return parts.join('\r\n\t')
}