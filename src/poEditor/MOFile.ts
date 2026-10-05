import type { POFile } from './POFile';

interface MOEntry {
    original: string;
    translation: string;
}

export function compileMO(file: POFile): Uint8Array {

    const entries: MOEntry[] = [];

    // Header entry
    entries.push({
        original: '',
        translation: buildHeader(file)
    });

    for (const entry of file.entries) {

        // gettext/msgfmt ignores fuzzy entries.
        const isFuzzy =
            entry.comments.some(
                comment =>
                    /^#,\s*.*\bfuzzy\b/i.test(comment)
            );

        if (isFuzzy) {
            continue;
        }

        let original = entry.msgid;

        if (entry.context) {
            original =
                `${entry.context}\x04${original}`;
        }

        if (entry.msgidPlural !== undefined) {

            original =
                `${original}\0${entry.msgidPlural}`;

            const translations =
                entry.msgstrPlural.length > 0
                    ? entry.msgstrPlural
                    : [entry.msgstr];

            entries.push({
                original,
                translation:
                    translations.join('\0')
            });

            continue;
        }

        entries.push({
            original,
            translation: entry.msgstr
        });
    }

    /*
     * GNU gettext expects msgids sorted lexicographically.
     *
     * We sort using UTF-8 bytes instead of localeCompare()
     * so the ordering is deterministic.
     */
    entries.sort((a, b) => {

        const aBuffer =
            Buffer.from(a.original, 'utf8');

        const bBuffer =
            Buffer.from(b.original, 'utf8');

        return aBuffer.compare(bBuffer);
    });

    return createMO(entries);
}


function buildHeader(file: POFile): string {

    const lines = [
        `Project-Id-Version: ${file.header.projectIdVersion}`,
        `Report-Msgid-Bugs-To: ${file.header.reportMsgidBugsTo}`,
        `POT-Creation-Date: ${file.header.potCreationDate}`,
        `PO-Revision-Date: ${file.header.poRevisionDate}`,
        `Last-Translator: ${buildTranslator(file)}`,
        `Language-Team: ${file.header.languageTeam}`,
        `Language: ${file.header.language}`,
        `MIME-Version: ${file.header.mimeVersion}`,
        `Content-Type: ${file.header.contentType}`,
        `Content-Transfer-Encoding: ${file.header.contentTransferEncoding}`,
        `Plural-Forms: ${file.header.pluralForms}`
    ];

    if (file.header.textDomain.trim()) {

        lines.push(
            `X-Domain: ${file.header.textDomain}`
        );
    }

    for (const extra of file.header.extras) {

        lines.push(
            `${extra.key}: ${extra.value}`
        );
    }

    return lines.join('\n') + '\n';
}


function buildTranslator(file: POFile): string {

    const name =
        file.header.lastTranslatorName.trim();

    const email =
        file.header.lastTranslatorEmail.trim();

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


function createMO(entries: MOEntry[]): Uint8Array {

    const count = entries.length;

    /*
     * Header:
     *
     * magic
     * revision
     * number of strings
     * original table offset
     * translation table offset
     * hash size
     * hash offset
     */

    const headerSize = 28;

    const originalTableOffset =
        headerSize;

    const translationTableOffset =
        originalTableOffset + count * 8;

    const stringDataOffset =
        translationTableOffset + count * 8;

    const originalBuffers =
        entries.map(entry =>
            Buffer.from(
                entry.original,
                'utf8'
            )
        );

    const translationBuffers =
        entries.map(entry =>
            Buffer.from(
                entry.translation,
                'utf8'
            )
        );

    let stringSize = 0;

    for (const buffer of originalBuffers) {
        stringSize += buffer.length + 1;
    }

    for (const buffer of translationBuffers) {
        stringSize += buffer.length + 1;
    }

    const result = Buffer.alloc(
        stringDataOffset + stringSize
    );

    // GNU MO magic number.
    result.writeUInt32LE(
        0x950412de,
        0
    );

    // Format revision.
    result.writeUInt32LE(
        0,
        4
    );

    // Number of strings.
    result.writeUInt32LE(
        count,
        8
    );

    // Original string table.
    result.writeUInt32LE(
        originalTableOffset,
        12
    );

    // Translation string table.
    result.writeUInt32LE(
        translationTableOffset,
        16
    );

    // No hash table.
    result.writeUInt32LE(
        0,
        20
    );

    result.writeUInt32LE(
        0,
        24
    );

    let currentOffset =
        stringDataOffset;

    const originalOffsets: {
        length: number;
        offset: number;
    }[] = [];

    const translationOffsets: {
        length: number;
        offset: number;
    }[] = [];

    for (const buffer of originalBuffers) {

        originalOffsets.push({
            length: buffer.length,
            offset: currentOffset
        });

        buffer.copy(
            result,
            currentOffset
        );

        currentOffset +=
            buffer.length;

        result[currentOffset] = 0;

        currentOffset++;
    }

    for (const buffer of translationBuffers) {

        translationOffsets.push({
            length: buffer.length,
            offset: currentOffset
        });

        buffer.copy(
            result,
            currentOffset
        );

        currentOffset +=
            buffer.length;

        result[currentOffset] = 0;

        currentOffset++;
    }

    for (let i = 0; i < count; i++) {

        const original =
            originalOffsets[i];

        result.writeUInt32LE(
            original.length,
            originalTableOffset + i * 8
        );

        result.writeUInt32LE(
            original.offset,
            originalTableOffset + i * 8 + 4
        );

        const translation =
            translationOffsets[i];

        result.writeUInt32LE(
            translation.length,
            translationTableOffset + i * 8
        );

        result.writeUInt32LE(
            translation.offset,
            translationTableOffset + i * 8 + 4
        );
    }

    return result;
}
