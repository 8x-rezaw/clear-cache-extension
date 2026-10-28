#!/usr/bin/env python3
"""Builds rules/ads.json (declarativeNetRequest) and rules/cosmetic.json from public filter lists.

Usage: python3 tools/build-rules.py
"""
import json
import re
import urllib.request
from collections import defaultdict
from pathlib import Path

LISTS = {
    'easylist_adservers': 'https://raw.githubusercontent.com/easylist/easylist/master/easylist/easylist_adservers.txt',
    'easylist_adservers_popup': 'https://raw.githubusercontent.com/easylist/easylist/master/easylist/easylist_adservers_popup.txt',
    'persianblocker': 'https://codeberg.org/KhodeKiaa/PersianBlocker/raw/branch/main/PersianBlocker.txt',
}

OUT = Path(__file__).resolve().parent.parent / 'rules'

SUB_TYPES = ['sub_frame', 'stylesheet', 'script', 'image', 'font', 'object',
             'xmlhttprequest', 'ping', 'media', 'websocket', 'webtransport', 'other']
TYPE_MAP = {
    'script': ['script'], 'image': ['image'], 'stylesheet': ['stylesheet'], 'css': ['stylesheet'],
    'subdocument': ['sub_frame'], 'frame': ['sub_frame'], 'xmlhttprequest': ['xmlhttprequest'], 'xhr': ['xmlhttprequest'],
    'media': ['media'], 'font': ['font'], 'object': ['object'], 'ping': ['ping'], 'websocket': ['websocket'],
    'other': ['other'], 'document': ['main_frame'], 'doc': ['main_frame'], 'popup': ['main_frame'],
    'all': SUB_TYPES + ['main_frame'],
}
PARTY = {'third-party': 'thirdParty', '3p': 'thirdParty', '~third-party': 'firstParty', '1p': 'firstParty', 'first-party': 'firstParty'}
IGNORED = {'important', 'match-case', 'badfilter', 'strict1p', 'strict3p'}
UNSUPPORTED = re.compile(r'^(removeparam|redirect|redirect-rule|csp|cookie|replace|header|permissions|uritransform|urlskip|empty|mp4|rewrite|generichide|elemhide|specifichide|ehide|ghide|shide|inline-script|inline-font|to|denyallow|method)\b')
DOMAIN = re.compile(r'^[a-z0-9.-]+\.[a-z0-9-]+$')
URL_FILTER = re.compile(r'[\x21-\x7e]+')
PROCEDURAL = re.compile(r':(has-text|upward|remove|style|matches-|xpath|others|watch-attr|min-text-length|remove-attr|remove-class|if|if-not|-abp-)')


def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode('utf-8', 'ignore').splitlines()


def parse_options(raw):
    """Returns a dict describing the rule options, or None when the rule can't be expressed."""
    opts = {'types': set(), 'excluded': set(), 'party': None, 'include': [], 'exclude': []}
    for opt in filter(None, raw.split(',')) if raw else []:
        name, _, value = opt.partition('=')
        if name in IGNORED:
            continue
        if UNSUPPORTED.match(name.lstrip('~')):
            return None
        if name in PARTY:
            opts['party'] = PARTY[name]
        elif name in ('domain', 'from'):
            for d in value.split('|'):
                (opts['exclude'] if d.startswith('~') else opts['include']).append(d.lstrip('~'))
            if any(not DOMAIN.match(d) for d in opts['include'] + opts['exclude']):
                return None
        elif name.lstrip('~') in TYPE_MAP:
            target = opts['excluded'] if name.startswith('~') else opts['types']
            target.update(TYPE_MAP[name.lstrip('~')])
        else:
            return None
    return opts


def resource_types(opts):
    if opts['types']:
        return sorted(opts['types'])
    return sorted(t for t in SUB_TYPES if t not in opts['excluded'])


def condition(opts, **extra):
    cond = dict(extra)
    cond['resourceTypes'] = resource_types(opts)
    if opts['party']:
        cond['domainType'] = opts['party']
    if opts['include']:
        cond['initiatorDomains'] = sorted(set(opts['include']))
    if opts['exclude']:
        cond['excludedInitiatorDomains'] = sorted(set(opts['exclude']))
    return cond


def build():
    grouped = defaultdict(set)
    singles = []
    cosmetic_generic = {}
    cosmetic_site = defaultdict(set)
    cosmetic_except = defaultdict(set)

    for name, url in LISTS.items():
        lines = fetch(url)
        print(f'{name}: {len(lines)} lines')
        for line in lines:
            line = line.strip()
            if not line or line[0] in '![' or '##+js' in line or '#?#' in line or '#$#' in line:
                continue

            if '#@#' in line:
                domains, selector = line.split('#@#', 1)
                for d in domains.split(','):
                    if DOMAIN.match(d):
                        cosmetic_except[selector].add(d)
                continue
            if '##' in line:
                domains, selector = line.split('##', 1)
                if PROCEDURAL.search(selector) or not selector or selector.startswith('^'):
                    continue
                domains = [d for d in domains.split(',') if d and d != '*']
                include = [d for d in domains if not d.startswith('~')]
                exclude = [d[1:] for d in domains if d.startswith('~')]
                if any(not DOMAIN.match(d) for d in include + exclude):
                    continue
                if include:
                    for d in include:
                        cosmetic_site[d].add(selector)
                else:
                    cosmetic_generic.setdefault(selector, set()).update(exclude)
                continue

            allow = line.startswith('@@')
            body = line[2:] if allow else line
            if body.startswith('/') and body.rstrip('/').count('/') >= 1 and re.match(r'^/.*/(\$|$)', body):
                continue
            pattern, _, raw_opts = body.partition('$')
            opts = parse_options(raw_opts)
            if opts is None or len(pattern) < 4 or not URL_FILTER.fullmatch(pattern) or pattern.startswith('||*'):
                continue

            m = re.fullmatch(r'\|\|([a-z0-9.-]+)\^?', pattern)
            simple = m and DOMAIN.match(m.group(1)) and not opts['include'] and not opts['exclude']
            if simple and not allow:
                key = (opts['party'], tuple(resource_types(opts)))
                grouped[key].add(m.group(1))
            else:
                singles.append((allow, pattern, opts))

    rules = []

    def add(rule):
        rule['id'] = len(rules) + 1
        rules.append(rule)

    for (party, types), domains in sorted(grouped.items(), key=lambda kv: str(kv[0])):
        domains = sorted(prune(domains))
        cond = {'requestDomains': domains, 'resourceTypes': list(types)}
        if party:
            cond['domainType'] = party
        sub = [t for t in types if t != 'main_frame']
        if sub:
            add({'priority': 1, 'action': {'type': 'block'}, 'condition': {**cond, 'resourceTypes': sub}})
        if 'main_frame' in types:
            add({'priority': 1, 'action': {'type': 'redirect', 'redirect': {'extensionPath': '/blocked.html'}},
                 'condition': {**cond, 'resourceTypes': ['main_frame']}})

    for allow, pattern, opts in singles:
        cond = condition(opts, urlFilter=pattern)
        if allow:
            add({'priority': 2, 'action': {'type': 'allow'}, 'condition': cond})
            continue
        sub = [t for t in cond['resourceTypes'] if t != 'main_frame']
        if sub:
            add({'priority': 1, 'action': {'type': 'block'}, 'condition': {**cond, 'resourceTypes': sub}})
        if 'main_frame' in cond['resourceTypes']:
            add({'priority': 1, 'action': {'type': 'redirect', 'redirect': {'extensionPath': '/blocked.html'}},
                 'condition': {**cond, 'resourceTypes': ['main_frame']}})

    cosmetic = {
        'generic': sorted(s for s, ex in cosmetic_generic.items() if not ex and s not in cosmetic_except),
        'genericExcept': {s: sorted(ex) for s, ex in sorted(cosmetic_generic.items()) if ex},
        'sites': {d: sorted(s) for d, s in sorted(cosmetic_site.items())},
        'except': {s: sorted(d) for s, d in sorted(cosmetic_except.items())},
    }

    OUT.mkdir(exist_ok=True)
    (OUT / 'ads.json').write_text(json.dumps(rules, separators=(',', ':')))
    (OUT / 'cosmetic.json').write_text(json.dumps(cosmetic, ensure_ascii=False, separators=(',', ':')))
    print(f'network rules: {len(rules)} ({sum(len(d) for d in grouped.values())} domains grouped)')
    print(f'cosmetic: {len(cosmetic["generic"])} generic, {sum(map(len, cosmetic["sites"].values()))} site-specific')


def prune(domains):
    """Drops domains already covered by a listed parent domain."""
    keep = set(domains)
    for d in domains:
        parts = d.split('.')
        if any('.'.join(parts[i:]) in keep for i in range(1, len(parts) - 1)):
            keep.discard(d)
    return keep


if __name__ == '__main__':
    build()
