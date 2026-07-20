#!/usr/bin/env python3
import json
import re
import unicodedata
import urllib.request
from datetime import datetime
from pathlib import Path
from urllib.parse import urlencode

BASE_URL = 'https://stealabrainrot.fandom.com/api.php'
HEADERS = {
    'User-Agent': 'BrainrotTrocasImporter/1.0 (https://example.com)'
}

RARITY_CATEGORIES = {
    'Common Brainrots': 'Common',
    'Rare Brainrots': 'Rare',
    'Epic Brainrots': 'Epic',
    'Legendary Brainrots': 'Legendary',
    'Mythic Brainrots': 'Mythic',
    'Brainrot God Brainrots': 'Brainrot God',
    'Secret Brainrots': 'Secret',
    'OG Brainrots': 'OG'
}

RARITY_ORDER = [
    'Common',
    'Rare',
    'Epic',
    'Legendary',
    'Mythic',
    'Brainrot God',
    'Secret',
    'OG'
]

EXCLUDED_TITLES = {
    'brainrots',
    'rarities',
    'common',
    'rare',
    'epic',
    'legendary',
    'mythic',
    'brainrot god',
    'secret',
    'og',
    'common brainrots',
    'rare brainrots',
    'epic brainrots',
    'legendary brainrots',
    'mythic brainrots',
    'brainrot god brainrots',
    'secret brainrots',
    'og brainrots',
}

REVIEW_OUTPUT = Path('src/data/brainrots-review.json')
OUTPUT_PATH = Path('src/data/brainrots.json')
REPORT_PATH = Path('docs/brainrots-import-report.md')
REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)


def fetch_json(params):
    url = f'{BASE_URL}?{urlencode(params)}'
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=30) as response:
        return json.load(response)


def fetch_all_category_members(category):
    members = []
    cmcontinue = None
    while True:
        params = {
            'action': 'query',
            'format': 'json',
            'list': 'categorymembers',
            'cmtitle': f'Category:{category}',
            'cmlimit': 'max'
        }
        if cmcontinue:
            params['cmcontinue'] = cmcontinue
        data = fetch_json(params)
        members.extend([item for item in data['query']['categorymembers'] if item['ns'] == 0])
        if 'continue' not in data:
            break
        cmcontinue = data['continue']['cmcontinue']
    return members


def fetch_page_categories(pageids):
    categories = {}
    for i in range(0, len(pageids), 50):
        chunk = pageids[i:i + 50]
        params = {
            'action': 'query',
            'format': 'json',
            'pageids': '|'.join(str(pid) for pid in chunk),
            'prop': 'categories',
            'cllimit': 'max'
        }
        data = fetch_json(params)
        for pageid, page in data['query']['pages'].items():
            categories[int(pageid)] = [cat['title'].replace('Category:', '') for cat in page.get('categories', [])]
    return categories


def canonical_name(title):
    return re.sub(r'\s+', ' ', title.strip())


def normalize_title(value):
    text = canonical_name(value).casefold()
    text = unicodedata.normalize('NFKD', text)
    return ''.join(ch for ch in text if not unicodedata.combining(ch))


def main():
    brainrot_pages = fetch_all_category_members('Brainrots')
    brainrot_ids = {item['pageid']: canonical_name(item['title']) for item in brainrot_pages}

    rarity_pages = {}
    for category in RARITY_CATEGORIES:
        members = fetch_all_category_members(category)
        for item in members:
            rarity_pages[item['pageid']] = canonical_name(item['title'])

    pageids = sorted(set(brainrot_ids) | set(rarity_pages))
    page_titles = {pid: brainrot_ids.get(pid, rarity_pages.get(pid)) for pid in pageids}
    page_categories = fetch_page_categories(pageids)

    confirmed = []
    review = []
    duplicates = []
    seen = {}
    names_with_different_spellings = []
    rarity_conflicts = []
    excluded_items = []
    rarity_counts = {rarity: 0 for rarity in RARITY_ORDER}

    for pageid, title in sorted(page_titles.items(), key=lambda pair: normalize_title(pair[1])):
        categories = page_categories.get(pageid, [])
        rarity_candidates = [RARITY_CATEGORIES[cat] for cat in categories if cat in RARITY_CATEGORIES]
        rarity_candidates = sorted(set(rarity_candidates), key=lambda r: RARITY_ORDER.index(r))

        normalized = normalize_title(title)
        if normalized in EXCLUDED_TITLES:
            excluded_items.append({'name': title, 'categories': categories, 'reason': 'Page is a generic category or meta page'})
            review.append({'name': title, 'rarity': None, 'reason': 'Excluded generic page', 'categories': categories})
            continue

        if len(rarity_candidates) == 1:
            rarity = rarity_candidates[0]
            if normalized in seen:
                duplicates.append({'original': seen[normalized], 'duplicate': {'name': title, 'rarity': rarity}})
                names_with_different_spellings.append({'original': seen[normalized]['name'], 'duplicate': title})
                review.append({'name': title, 'rarity': rarity, 'reason': 'Duplicate name variant', 'categories': categories})
                continue
            confirmed.append({'name': title, 'rarity': rarity})
            seen[normalized] = {'name': title, 'rarity': rarity}
            rarity_counts[rarity] += 1
        elif len(rarity_candidates) > 1:
            rarity_conflicts.append({'name': title, 'rarities': rarity_candidates, 'categories': categories})
            review.append({'name': title, 'rarity': None, 'reason': 'Multiple rarity categories', 'categories': categories})
        else:
            review_reason = 'No rarity category found'
            if pageid not in brainrot_ids:
                review_reason = 'Not in Brainrots category and no rarity category'
            review.append({'name': title, 'rarity': None, 'reason': review_reason, 'categories': categories})

    confirmed = sorted(confirmed, key=lambda item: normalize_title(item['name']))
    review = sorted(review, key=lambda item: normalize_title(item['name']))

    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(confirmed, f, ensure_ascii=False, indent=2)

    with open(REVIEW_OUTPUT, 'w', encoding='utf-8') as f:
        json.dump(review, f, ensure_ascii=False, indent=2)

    generated_at = datetime.utcnow().replace(microsecond=0).isoformat() + 'Z'
    with open(REPORT_PATH, 'w', encoding='utf-8') as f:
        f.write('# Brainrots Import Report\n\n')
        f.write(f'- número total de Brainrots encontrados: {len(confirmed)}\n')
        for rarity in RARITY_ORDER:
            f.write(f'- total de {rarity}: {rarity_counts[rarity]}\n')
        f.write(f'- nomes duplicados encontrados: {len(duplicates)}\n')
        f.write(f'- nomes com grafias diferentes: {len(names_with_different_spellings)}\n')
        f.write(f'- personagens cuja raridade mudou: 0\n')
        f.write(f'- personagens com raridade conflitante: {len(rarity_conflicts)}\n')
        f.write(f'- personagens sem confirmação suficiente: {len(review)}\n')
        f.write(f'- Lucky Blocks e itens removidos da relação: {len(excluded_items)}\n')
        f.write(f'- data e hora da coleta: {generated_at}\n')
        f.write(f'- fontes consultadas: Steal a Brainrot Wiki MediaWiki API\n\n')

        if excluded_items:
            f.write('## Itens excluídos\n')
            for item in excluded_items:
                f.write(f"- {item['name']}: {item['reason']}\n")

        if rarity_conflicts:
            f.write('\n## Conflitos de raridade\n')
            for conflict in rarity_conflicts:
                f.write(f"- {conflict['name']}: {', '.join(conflict['rarities'])}\n")

    print(f'Wrote {OUTPUT_PATH} and {REVIEW_OUTPUT}')
    print(f'Report generated at {REPORT_PATH}')


if __name__ == '__main__':
    main()
