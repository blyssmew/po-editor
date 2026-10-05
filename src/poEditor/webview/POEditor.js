const vscode = acquireVsCodeApi();

const state = {
    mode: 'new',
    model: null
};


const languageOptions = [
    'fr',
    'fr-ca',
    'en',
    'en-gb',
    'en-ca',
    'en-au',

    'zh-cn',
    'zh-tw',
    'de',
    'it',
    'ja',
    'ko',
    'ru',
    'es',
    'es-419',
    'pt-br',
    'tr',
    'pl',
    'cs',

    'uk',
    'pt-pt',
    'nl',
    'hu',
    'sv',
    'da',
    'fi',
    'no',
    'ro',
    'sk',
    'sl',
    'el',
    'bg',
    'hr',
    'sr',
    'vi',
    'th',
    'id',
    'hi',
    'ar',
    'he',
    'fa'
];


const elements = {

    newButton:
        document.getElementById('new-button'),

    openButton:
        document.getElementById('open-button'),

    buildMoButton:
        document.getElementById('build-mo-button'),

    saveButton:
        document.getElementById('save-button'),


    addEntryButton:
        document.getElementById('add-entry-button'),


    documentStatus:
        document.getElementById('document-status'),


    entryCount:
        document.getElementById('entry-count'),

    entries:
        document.getElementById('entries'),

    emptyState:
        document.getElementById('empty-state'),


    notification:
        document.getElementById('notification'),


    projectIdVersion:
        document.getElementById('project-id-version'),

    reportMsgidBugsTo:
        document.getElementById('report-msgid-bugs-to'),

    potCreationDate:
        document.getElementById('pot-creation-date'),

    poRevisionDate:
        document.getElementById('po-revision-date'),

    lastTranslatorName:
        document.getElementById('last-translator-name'),

    lastTranslatorEmail:
        document.getElementById('last-translator-email'),

    languageTeam:
        document.getElementById('language-team'),

    language:
        document.getElementById('language'),

    textDomain:
        document.getElementById('text-domain'),


    customLanguageField:
        document.getElementById('custom-language-field'),

    customLanguage:
        document.getElementById('custom-language'),


    pluralForms:
        document.getElementById('plural-forms'),

    customPluralField:
        document.getElementById('custom-plural-field'),

    customPluralForms:
        document.getElementById('custom-plural-forms')
};


function init() {

    bindEvents();

    vscode.postMessage({
        type: 'ready'
    });
}


function bindEvents() {

    elements.newButton.addEventListener(
        'click',
        () => {

            vscode.postMessage({
                type: 'new-po'
            });
        }
    );


    elements.openButton.addEventListener(
        'click',
        () => {

            vscode.postMessage({
                type: 'open-po'
            });
        }
    );


    elements.buildMoButton.addEventListener(
        'click',
        () => {

            vscode.postMessage({
                type: 'build-mo',
                model: state.model
            });
        }
    );


    elements.saveButton.addEventListener(
        'click',
        save
    );


    elements.addEntryButton.addEventListener(
        'click',
        addEntry
    );


    bindHeaderInput(
        elements.projectIdVersion,
        value => {
            state.model.header.projectIdVersion = value;
        }
    );


    bindHeaderInput(
        elements.reportMsgidBugsTo,
        value => {
            state.model.header.reportMsgidBugsTo = value;
        }
    );


    bindHeaderInput(
        elements.lastTranslatorName,
        value => {
            state.model.header.lastTranslatorName = value;
        }
    );


    bindHeaderInput(
        elements.lastTranslatorEmail,
        value => {
            state.model.header.lastTranslatorEmail = value;
        }
    );


    bindHeaderInput(
        elements.languageTeam,
        value => {
            state.model.header.languageTeam = value;
        }
    );


    bindHeaderInput(
        elements.textDomain,
        value => {
            state.model.header.textDomain = value;
        }
    );


    elements.potCreationDate.addEventListener(
        'input',
        event => {

            state.model.header.potCreationDate =
                inputToPoDate(
                    event.target.value
                );

            markDirty();
        }
    );


    elements.poRevisionDate.addEventListener(
        'input',
        event => {

            state.model.header.poRevisionDate =
                inputToPoDate(
                    event.target.value
                );

            markDirty();
        }
    );


    elements.language.addEventListener(
        'change',
        event => {

            changeLanguage(
                event.target.value
            );
        }
    );


    elements.customLanguage.addEventListener(
        'input',
        event => {

            state.model.header.language =
                event.target.value.trim();

            markDirty();
        }
    );


    elements.customPluralForms.addEventListener(
        'input',
        event => {

            state.model.header.pluralForms =
                event.target.value;

            updatePluralDisplay();

            markDirty();
        }
    );


    document.addEventListener(
        'keydown',
        event => {

            if (
                (event.ctrlKey || event.metaKey) &&
                event.key.toLowerCase() === 's'
            ) {

                event.preventDefault();

                save();
            }
        }
    );
}


function bindHeaderInput(
    element,
    callback
) {

    element.addEventListener(
        'input',
        event => {

            callback(
                event.target.value
            );

            markDirty();
        }
    );


    element.addEventListener(
        'change',
        () => {

            sync();
        }
    );
}


function changeLanguage(language) {

    if (language === '__custom__') {

        elements.customLanguageField
            .classList.remove('hidden');

        elements.customPluralField
            .classList.remove('hidden');

        state.model.header.language =
            elements.customLanguage.value.trim();

        updatePluralDisplay();

        markDirty();

        return;
    }


    elements.customLanguageField
        .classList.add('hidden');

    elements.customPluralField
        .classList.add('hidden');


    state.model.header.language =
        language;


    state.model.header.pluralForms =
        getPluralForms(language);


    elements.customLanguage.value = '';


    updatePluralDisplay();

    markDirty();

    sync();
}


function getPluralForms(language) {

    const normalized =
        language
            .toLowerCase()
            .replace('_', '-');


    const base =
        normalized.split('-')[0];


    switch (base) {

        case 'fr':
            return 'nplurals=2; plural=(n > 1);';


        case 'ja':
        case 'ko':
        case 'zh':
        case 'th':
        case 'vi':
            return 'nplurals=1; plural=0;';


        case 'ru':
        case 'uk':
            return 'nplurals=3; plural=(n%10==1 && n%100!=11 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2);';


        case 'pl':
            return 'nplurals=3; plural=(n==1 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2);';


        case 'cs':
        case 'sk':
            return 'nplurals=3; plural=(n==1 ? 0 : n>=2 && n<=4 ? 1 : 2);';


        case 'sl':
            return 'nplurals=4; plural=(n%100==1 ? 1 : n%100==2 ? 2 : n%100==3 || n%100==4 ? 3 : 0);';


        case 'ar':
            return 'nplurals=6; plural=(n==0 ? 0 : n==1 ? 1 : n==2 ? 2 : n%100>=3 && n%100<=10 ? 3 : n%100>=11 && n%100<=99 ? 4 : 5);';


        case 'ro':
            return 'nplurals=3; plural=(n==1 ? 0 : n==0 || (n%100>0 && n%100<20) ? 1 : 2);';


        default:
            return 'nplurals=2; plural=(n != 1);';
    }
}


function render(model, mode) {

    state.model = model;
    state.mode = mode;


    renderHeader();
    renderEntries();
    updateModeUI();
}


function renderHeader() {

    const header =
        state.model.header;


    elements.projectIdVersion.value =
        header.projectIdVersion;


    elements.reportMsgidBugsTo.value =
        header.reportMsgidBugsTo;


    elements.potCreationDate.value =
        poDateToInput(
            header.potCreationDate
        );


    elements.poRevisionDate.value =
        poDateToInput(
            header.poRevisionDate
        );


    elements.lastTranslatorName.value =
        header.lastTranslatorName;


    elements.lastTranslatorEmail.value =
        header.lastTranslatorEmail;


    elements.languageTeam.value =
        header.languageTeam;


    elements.textDomain.value =
        header.textDomain;


    renderLanguage();

    updatePluralDisplay();
}


function renderLanguage() {

    const language =
        state.model.header.language;


    const normalizedLanguage =
        language
            .toLowerCase()
            .replace('_', '-');


    const matchingOption =
        languageOptions.find(
            option =>
                option.toLowerCase() ===
                normalizedLanguage
        );


    if (matchingOption) {

        elements.language.value =
            matchingOption;


        elements.customLanguageField
            .classList.add('hidden');


        elements.customPluralField
            .classList.add('hidden');


        return;
    }


    elements.language.value =
        '__custom__';


    elements.customLanguage.value =
        language;


    elements.customLanguageField
        .classList.remove('hidden');


    elements.customPluralField
        .classList.remove('hidden');
}


function updatePluralDisplay() {

    elements.pluralForms.value =
        state.model.header.pluralForms;
}


function renderEntries() {

    elements.entries.innerHTML = '';


    const entries =
        state.model.entries;


    elements.entryCount.textContent =
        String(entries.length);


    elements.emptyState.classList.toggle(
        'hidden',
        entries.length > 0
    );


    for (
        let index = 0;
        index < entries.length;
        index++
    ) {

        renderEntry(
            entries[index],
            index
        );
    }
}


function renderEntry(entry, index) {

    const row =
        document.createElement('tr');


    // =========================
    // NUMBER
    // =========================

    const numberCell =
        document.createElement('td');

    numberCell.className =
        'number-column';


    const number =
        document.createElement('div');

    number.className =
        'entry-number';

    number.textContent =
        String(index + 1);


    numberCell.appendChild(
        number
    );


    // =========================
    // ORIGINAL
    // =========================

    const originalCell =
        document.createElement('td');


    const original =
        document.createElement('textarea');

    original.className =
        'entry-input';

    original.value =
        entry.msgid;


    original.setAttribute(
        'aria-label',
        `Original string ${index + 1}`
    );


    original.addEventListener(
        'input',
        () => {

            entry.msgid =
                original.value;

            markDirty();
        }
    );


    original.addEventListener(
        'change',
        () => {

            sync();
        }
    );


    originalCell.appendChild(
        original
    );


    // =========================
    // TRANSLATION
    // =========================

    const translationCell =
        document.createElement('td');


    const translation =
        document.createElement('textarea');

    translation.className =
        'entry-input';

    translation.value =
        entry.msgstr;


    translation.setAttribute(
        'aria-label',
        `Translation ${index + 1}`
    );


    translation.addEventListener(
        'input',
        () => {

            entry.msgstr =
                translation.value;


            if (
                Array.isArray(
                    entry.msgstrPlural
                ) &&
                entry.msgstrPlural.length > 0
            ) {

                entry.msgstrPlural[0] =
                    translation.value;
            }


            markDirty();
        }
    );


    translation.addEventListener(
        'change',
        () => {

            sync();
        }
    );


    translationCell.appendChild(
        translation
    );


    // =========================
    // DELETE
    // =========================

    const actionCell =
        document.createElement('td');

    actionCell.className =
        'action-column';


    const actions =
        document.createElement('div');

    actions.className =
        'entry-actions';


    const deleteButton =
        document.createElement('button');

    deleteButton.className =
        'button danger';

    deleteButton.type =
        'button';

    deleteButton.textContent =
        'Delete';


    deleteButton.addEventListener(
        'click',
        () => {

            removeEntry(index);
        }
    );


    actions.appendChild(
        deleteButton
    );


    actionCell.appendChild(
        actions
    );


    // =========================
    // MAIN ROW
    // =========================

    row.appendChild(
        numberCell
    );

    row.appendChild(
        originalCell
    );

    row.appendChild(
        translationCell
    );

    row.appendChild(
        actionCell
    );


    // =========================
    // CONTEXT ROW
    // =========================

    const contextRow =
        document.createElement('tr');

    contextRow.className =
        'context-row';


    const contextCell =
        document.createElement('td');

    contextCell.colSpan = 4;


    const contextDetails =
        document.createElement('details');

    contextDetails.className =
        'context-details';


    if (entry.context) {
        contextDetails.open = true;
    }


    const contextSummary =
        document.createElement('summary');

    contextSummary.textContent =
        entry.context
            ? 'Context'
            : '+ Context';


    const contextInput =
        document.createElement('input');

    contextInput.className =
        'context-input';

    contextInput.type =
        'text';

    contextInput.placeholder =
        'Optional context...';

    contextInput.value =
        entry.context ?? '';


    contextInput.addEventListener(
        'input',
        () => {

            const value =
                contextInput.value.trim();


            entry.context =
                value || undefined;


            contextSummary.textContent =
                value
                    ? 'Context'
                    : '+ Context';


            markDirty();
        }
    );


    contextInput.addEventListener(
        'change',
        () => {

            sync();
        }
    );


    contextDetails.appendChild(
        contextSummary
    );

    contextDetails.appendChild(
        contextInput
    );


    contextCell.appendChild(
        contextDetails
    );

    contextRow.appendChild(
        contextCell
    );


    // =========================
    // ADD ROWS
    // =========================

    elements.entries.appendChild(
        row
    );

    elements.entries.appendChild(
        contextRow
    );
}


function addEntry() {

    state.model.entries.push({

        comments: [],

        msgid: '',
        msgstr: '',

        msgstrPlural: []
    });


    renderEntries();

    markDirty();


    const lastRow =
        elements.entries.lastElementChild;


    lastRow
        ?.querySelector('.entry-input')
        ?.focus();


    sync();
}


function removeEntry(index) {

    state.model.entries.splice(
        index,
        1
    );


    renderEntries();

    markDirty();

    sync();
}


function updateModeUI() {

    const isNew =
        state.mode === 'new';


    elements.saveButton.textContent =
        isNew
            ? 'Create PO'
            : 'Save';


    elements.documentStatus.textContent =
        isNew
            ? 'New PO file'
            : 'Editing PO file';
}


function sync() {

    if (state.mode !== 'file') {
        return;
    }


    vscode.postMessage({

        type: 'sync',

        model: state.model
    });
}


function save() {

    if (state.mode === 'new') {

        vscode.postMessage({

            type: 'create-po',

            model: state.model
        });

        return;
    }


    vscode.postMessage({

        type: 'save',

        model: state.model
    });
}


function markDirty() {

    if (state.mode === 'new') {

        elements.documentStatus.textContent =
            'New PO file';

        return;
    }


    elements.documentStatus.textContent =
        'Unsaved changes';
}


function poDateToInput(value) {

    const match =
        value.match(
            /^(\d{4}-\d{2}-\d{2})\s+(\d{2}):(\d{2})/
        );


    if (!match) {
        return '';
    }


    return (
        `${match[1]}T` +
        `${match[2]}:${match[3]}`
    );
}


function inputToPoDate(value) {

    if (!value) {
        return '';
    }


    const date =
        new Date(value);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return '';
    }


    const year =
        date.getFullYear();


    const month =
        String(
            date.getMonth() + 1
        ).padStart(
            2,
            '0'
        );


    const day =
        String(
            date.getDate()
        ).padStart(
            2,
            '0'
        );


    const hours =
        String(
            date.getHours()
        ).padStart(
            2,
            '0'
        );


    const minutes =
        String(
            date.getMinutes()
        ).padStart(
            2,
            '0'
        );


    const offset =
        -date.getTimezoneOffset();


    const sign =
        offset >= 0
            ? '+'
            : '-';


    const absoluteOffset =
        Math.abs(offset);


    const offsetHours =
        String(
            Math.floor(
                absoluteOffset / 60
            )
        ).padStart(
            2,
            '0'
        );


    const offsetMinutes =
        String(
            absoluteOffset % 60
        ).padStart(
            2,
            '0'
        );


    return (
        `${year}-${month}-${day} ` +
        `${hours}:${minutes}` +
        `${sign}${offsetHours}${offsetMinutes}`
    );
}


function showNotification(
    message,
    isError = false
) {

    elements.notification.textContent =
        message;


    elements.notification.classList.remove(
        'hidden'
    );


    if (isError) {

        elements.notification.style.borderColor =
            'var(--vscode-testing-iconFailed)';

    } else {

        elements.notification.style.borderColor =
            'var(--vscode-focusBorder)';
    }


    clearTimeout(
        showNotification.timeout
    );


    showNotification.timeout =
        setTimeout(
            () => {

                elements.notification
                    .classList.add(
                        'hidden'
                    );

            },
            3000
        );
}


window.addEventListener(
    'message',
    event => {

        const message =
            event.data;


        switch (message.type) {

            case 'state':

                render(
                    message.model,
                    message.mode
                );

                break;


            case 'status':

                showNotification(
                    message.message
                );


                if (
                    message.message ===
                    'Saved'
                ) {

                    elements.documentStatus.textContent =
                        'Saved';
                }

                break;


            case 'error':

                showNotification(
                    message.message,
                    true
                );

                break;
        }
    }
);


init();
