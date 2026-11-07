# Verse translations

The 108 entries are matched by chapter and verse, never by array position in an external source. The combined entry `10.12-13` includes both verses. IDs, Sanskrit, Roman transliterations, audio paths and progress keys are preserved.

## English

The existing A.C. Bhaktivedanta Swami Prabhupada translation is retained. This correction removes redundant verse-number prefixes and literal Markdown escape characters, and fixes transcription errors (`purifled`, `progrese`, `conquerer`), punctuation and spacing. It does not claim that every interpretive difference between translations is an error.

Reference edition: [Bhagavad-gītā As It Is, VedaBase](https://vedabase.io/en/library/bg/). The app links to each verse. The original selection source remains in `SHLOKA_SOURCE`.

## Tamil

The previous Tamil meanings and purports contained pervasive OCR corruption. The meanings are replaced with an **edited version of Subramania Bharati's Tamil translation**, from [Project Madurai, text 529](https://www.projectmadurai.org/pm_etexts/utf8/pmuni0529.html). Bharati's original translation is a public-domain work. This is a different translator from the English edition; the app credits the two separately.

The importer normalizes Unicode and whitespace, removes page separators and speaker introductions belonging to the following verse, and combines verse ranges. Explicit editorial corrections are recorded in `CORRECTIONS` in [the importer](../scripts/fetch_tamil_data.py). These address transcription mistakes and incomplete or misleading readings, including 4.34 (inquiry), 7.25 (being concealed by yoga-māyā), 9.22 (provision and preservation), 15.15 (memory and the Vedas), 18.65 (worship and bowing) and 18.68 (the person explaining the teaching). These edited readings must not be presented as verbatim quotations of Bharati's edition.

The corrupted Prabhupada Tamil purports are removed, rather than represented as Bharati's commentary. No replacement purport is claimed. The displayed Tamil text is the verse meaning.

Regenerate the Tamil meanings with `python3 scripts/fetch_tamil_data.py`, or use `--source /path/to/pmuni0529.html` for a downloaded copy. The importer validates all chapter sequences, all selected references and the 108-entry count before writing. English and other verse fields are preserved. It replaces the former database importer, which could silently retain bad text and discard verse-range endings.

### Project Madurai source acknowledgement

பகவத் கீதை — சுப்ரமணிய பாரதியாரின் முன்னுரையும் விளக்க உரையும்

pakavat kItai - notes, commentary by ci. cupramaNiya paratiyAr. In tamil script, unicode/utf-8 format.

Text Input, Proof-reading, Web version: Dr. K. Kalyanasundaram.

Source: Bharathiyaarin Bhagavad Gitai, Kavitha Publications, 8, Muthukrishnan St, T. Nagar, Chennai-600 017, India.

© Project Madurai, 1998-2016. Project Madurai is an open, voluntary, worldwide initiative devoted to preparation of electronic texts of tamil literary works and to distribute them free on the Internet. Details of Project Madurai are available at [its website](https://www.projectmadurai.org/). You are welcome to freely distribute this file, provided this header page is kept intact.
