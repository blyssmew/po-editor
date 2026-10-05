export interface POHeaderExtra {
    key: string;
    value: string;
}

export interface POHeader {
    projectIdVersion: string;
    reportMsgidBugsTo: string;
    potCreationDate: string;
    poRevisionDate: string;

    lastTranslatorName: string;
    lastTranslatorEmail: string;

    languageTeam: string;
    language: string;
    textDomain: string;

    mimeVersion: string;
    contentType: string;
    contentTransferEncoding: string;
    pluralForms: string;

    extras: POHeaderExtra[];
}

export interface POEntry {
    comments: string[];

    context?: string;

    msgid: string;
    msgidPlural?: string;

    msgstr: string;
    msgstrPlural: string[];
}

export interface POFile {
    header: POHeader;
    entries: POEntry[];
}

const KNOWN_HEADER_KEYS = new Set([
    'Project-Id-Version',
    'Report-Msgid-Bugs-To',
    'POT-Creation-Date',
    'PO-Revision-Date',
    'Last-Translator',
    'Language-Team',
    'Language',
    'MIME-Version',
    'Content-Type',
    'Content-Transfer-Encoding',
    'Plural-Forms'
]);

export function createEmptyPOFile(): POFile {

    const now = formatPoDate(new Date());

    return {
        header: {
            projectIdVersion: '',
            reportMsgidBugsTo: '',
            potCreationDate: now,
            poRevisionDate: now,

            lastTranslatorName: '',
            lastTranslatorEmail: '',

            languageTeam: 'French',
            language: 'fr_CA',
            textDomain: '',

            mimeVersion: '1.0',
            contentType: 'text/plain; charset=UTF-8',
            contentTransferEncoding: '8bit',
            pluralForms: 'nplurals=2; plural=(n > 1);',

            extras: []
        },

        entries: []
    };
}

export function parsePO(content: string): POFile {

    const result = createEmptyPOFile();

    const normalized = content
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n');

    if (normalized.trim() === '') {
        return result;
    }

    const blocks = normalized
        .trim()
        .split(/\n\s*\n/);

    let headerFound = false;

    for (const block of blocks) {

        const parsed = parseBlock(block);

        if (!parsed) {
            continue;
        }

        if (parsed.msgid === '') {

            if (!headerFound) {
                parseHeader(parsed.msgstr, result.header);
                headerFound = true;
            }

            continue;
        }

        result.entries.push(parsed);
    }

    return result;
}

function parseBlock(block: string): POEntry | undefined {

    const lines = block.split('\n');

    const comments: string[] = [];

    let msgid: string | undefined;
    let msgstr = '';

    let context: string | undefined;
    let msgidPlural: string | undefined;

    const msgstrPlural: string[] = [];

    let index = 0;

    while (index < lines.length) {

        const line = lines[index];

        if (line.startsWith('#')) {
            comments.push(line);
            index++;
            continue;
        }

        const field = readField(lines, index);

        if (!field) {
            index++;
            continue;
        }

        switch (field.name) {

            case 'msgctxt':
                context = field.value;
                break;

            case 'msgid':
                msgid = field.value;
                break;

            case 'msgid_plural':
                msgidPlural = field.value;
                break;

            case 'msgstr':
                msgstr = field.value;
                break;

            default: {

                const pluralMatch = field.name.match(/^msgstr\[(\d+)\]$/);

                if (pluralMatch) {
                    const pluralIndex = Number(pluralMatch[1]);
                    msgstrPlural[pluralIndex] = field.value;

                    if (pluralIndex === 0) {
                        msgstr = field.value;
                    }
                }

                break;
            }
        }

        index = field.nextIndex;
    }

    if (msgid === undefined) {
        return undefined;
    }

    return {
        comments,
        context,
        msgid,
        msgidPlural,
        msgstr,
        msgstrPlural
    };
}

function readField(
    lines: string[],
    startIndex: number
): {
    name: string;
    value: string;
    nextIndex: number;
} | undefined {

    const firstLine = lines[startIndex];

    const match = firstLine.match(
        /^([A-Za-z_]+(?:\[\d+\])?)\s+(".*")$/
    );

    if (!match) {
        return undefined;
    }

    const name = match[1];

    let value = unquotePoString(match[2]);

    let index = startIndex + 1;

    while (index < lines.length) {

        const continuation = lines[index].match(
            /^"(.*)"$/
        );

        if (!continuation) {
            break;
        }

        value += unescapePoString(continuation[1]);

        index++;
    }

    return {
        name,
        value,
        nextIndex: index
    };
}

function parseHeader(
    value: string,
    header: POHeader
): void {

    const lines = value.split('\n');

    for (const line of lines) {

        if (!line.trim()) {
            continue;
        }

        const separator = line.indexOf(':');

        if (separator <= 0) {
            continue;
        }

        const key = line.slice(0, separator).trim();
        const headerValue = line
            .slice(separator + 1)
            .trim();

        switch (key) {

            case 'Project-Id-Version':
                header.projectIdVersion = headerValue;
                break;

            case 'Report-Msgid-Bugs-To':
                header.reportMsgidBugsTo = headerValue;
                break;

            case 'POT-Creation-Date':
                header.potCreationDate = headerValue;
                break;

            case 'PO-Revision-Date':
                header.poRevisionDate = headerValue;
                break;

            case 'Last-Translator': {

                const translatorMatch = headerValue.match(
                    /^(.*?)\s*<([^<>]*)>\s*$/
                );

                if (translatorMatch) {
                    header.lastTranslatorName = translatorMatch[1].trim();
                    header.lastTranslatorEmail = translatorMatch[2].trim();
                } else {
                    header.lastTranslatorName = headerValue;
                    header.lastTranslatorEmail = '';
                }

                break;
            }

            case 'Language-Team':
                header.languageTeam = headerValue;
                break;

            case 'Language':
                header.language = headerValue;
                break;

            case 'X-Domain':
                header.textDomain = headerValue;
                break;

            case 'MIME-Version':
                header.mimeVersion = headerValue;
                break;

            case 'Content-Type':
                header.contentType = headerValue;
                break;

            case 'Content-Transfer-Encoding':
                header.contentTransferEncoding = headerValue;
                break;

            case 'Plural-Forms':
                header.pluralForms = headerValue;
                break;

            default:
                header.extras.push({
                    key,
                    value: headerValue
                });
                break;
        }
    }
}

export function serializePO(file: POFile): string {

    const languagePluralForms = getPluralForms(file.header.language);

    const pluralForms =
        languagePluralForms
        ?? file.header.pluralForms;

    const lastTranslator = buildLastTranslator(
        file.header.lastTranslatorName,
        file.header.lastTranslatorEmail
    );

    const headerLines = [
        `Project-Id-Version: ${file.header.projectIdVersion}`,
        `Report-Msgid-Bugs-To: ${file.header.reportMsgidBugsTo}`,
        `POT-Creation-Date: ${file.header.potCreationDate}`,
        `PO-Revision-Date: ${file.header.poRevisionDate}`,
        `Last-Translator: ${lastTranslator}`,
        `Language-Team: ${file.header.languageTeam}`,
        `Language: ${file.header.language}`,
        `MIME-Version: ${file.header.mimeVersion}`,
        `Content-Type: ${file.header.contentType}`,
        `Content-Transfer-Encoding: ${file.header.contentTransferEncoding}`,
        `Plural-Forms: ${pluralForms}`
    ];

    if (file.header.textDomain.trim()) {
        headerLines.push(
            `X-Domain: ${file.header.textDomain}`
        );
    }

    for (const extra of file.header.extras) {

        if (KNOWN_HEADER_KEYS.has(extra.key)) {
            continue;
        }

        headerLines.push(
            `${extra.key}: ${extra.value}`
        );
    }

    const blocks: string[] = [];

    blocks.push([
        'msgid ""',
        'msgstr ""',
        ...headerLines.map(
            line => `"${escapePoString(line)}\\n"`
        )
    ].join('\n'));

    for (const entry of file.entries) {

        const lines: string[] = [];

        lines.push(...entry.comments);

        if (entry.context) {
            lines.push(
                ...serializeField('msgctxt', entry.context)
            );
        }

        lines.push(
            ...serializeField('msgid', entry.msgid)
        );

        if (entry.msgidPlural !== undefined) {

            lines.push(
                ...serializeField(
                    'msgid_plural',
                    entry.msgidPlural
                )
            );

            const pluralValues =
                entry.msgstrPlural.length > 0
                    ? entry.msgstrPlural
                    : [entry.msgstr];

            for (let i = 0; i < pluralValues.length; i++) {

                lines.push(
                    ...serializeField(
                        `msgstr[${i}]`,
                        pluralValues[i] ?? ''
                    )
                );
            }

        } else {

            lines.push(
                ...serializeField('msgstr', entry.msgstr)
            );
        }

        blocks.push(lines.join('\n'));
    }

    return blocks.join('\n\n') + '\n';
}

function serializeField(
    name: string,
    value: string
): string[] {

    if (!value.includes('\n')) {
        return [
            `${name} "${escapePoString(value)}"`
        ];
    }

    const lines = [
        `${name} ""`
    ];

    const valueLines = value.split('\n');

    for (let i = 0; i < valueLines.length; i++) {

        const suffix =
            i < valueLines.length - 1
                ? '\\n'
                : '';

        lines.push(
            `"${escapePoString(valueLines[i])}${suffix}"`
        );
    }

    return lines;
}

function escapePoString(value: string): string {

    return value
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\t/g, '\\t')
        .replace(/\r/g, '\\r');
}

function unquotePoString(value: string): string {

    return unescapePoString(
        value.slice(1, -1)
    );
}

function unescapePoString(value: string): string {

    return value
        .replace(
            /\\x([0-9A-Fa-f]{2})/g,
            (_, hex: string) =>
                String.fromCharCode(parseInt(hex, 16))
        )
        .replace(
            /\\([0-7]{1,3})/g,
            (_, octal: string) =>
                String.fromCharCode(parseInt(octal, 8))
        )
        .replace(
            /\\([nrtbfva\\"])/g,
            (_, character: string) => {

                switch (character) {

                    case 'n':
                        return '\n';

                    case 'r':
                        return '\r';

                    case 't':
                        return '\t';

                    case 'b':
                        return '\b';

                    case 'f':
                        return '\f';

                    case 'v':
                        return '\v';

                    case 'a':
                        return '\a';

                    case '\\':
                        return '\\';

                    case '"':
                        return '"';

                    default:
                        return character;
                }
            }
        );
}

function buildLastTranslator(
    name: string,
    email: string
): string {

    if (name && email) {
        return `${name} <${email}>`;
    }

    if (name) {
        return name;
    }

    if (email) {
        return `<${email}>`;
    }

    return '';
}

export function formatPoDate(date: Date): string {

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    const offset = -date.getTimezoneOffset();

    const sign = offset >= 0 ? '+' : '-';

    const absoluteOffset = Math.abs(offset);

    const offsetHours = String(
        Math.floor(absoluteOffset / 60)
    ).padStart(2, '0');

    const offsetMinutes = String(
        absoluteOffset % 60
    ).padStart(2, '0');

    return (
        `${year}-${month}-${day} ` +
        `${hours}:${minutes}` +
        `${sign}${offsetHours}${offsetMinutes}`
    );
}

export function getPluralForms(
    language: string
): string | undefined {

    const normalized = language
        .toLowerCase()
        .replace('_', '-');

    const baseLanguage =
        normalized.split('-')[0];

    switch (baseLanguage) {

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

export function validatePOFile(
    file: POFile
): string | undefined {

    if (!file.header.language) {
        return 'Language is required.';
    }

    const seenEntries = new Set<string>();

    for (const entry of file.entries) {

        if (entry.msgid.length === 0) {
            return 'A translation entry cannot have an empty msgid.';
        }

        const key =
            `${entry.context ?? ''}\0${entry.msgid}`;

        if (seenEntries.has(key)) {
            return `Duplicate translation found for "${entry.msgid}" with the same context.`;
        }

        seenEntries.add(key);
    }

    return undefined;
}
