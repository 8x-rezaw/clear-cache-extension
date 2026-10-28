#!/usr/bin/env python3
"""Builds the blocking rules in rules/ from public filter lists.

Outputs:
  rules/ads.json        declarativeNetRequest ruleset
  rules/generic.css     element hiding applied on every site
  rules/cosmetic.json   site-specific hiding, styles and procedural rules
  rules/scriptlets.js   site-specific scriptlets (MAIN world)

Usage: python3 tools/build-rules.py
"""
import json
import re
import urllib.request
from collections import defaultdict
from pathlib import Path

LISTS = {
    'easylist': 'https://easylist.to/easylist/easylist.txt',
    'ublock': 'https://ublockorigin.github.io/uAssets/filters/filters.txt',
    'peter-lowe': 'https://pgl.yoyo.org/adservers/serverlist.php?hostformat=adblockplus&showintro=0&mimetype=plaintext',
    'persianblocker': 'https://codeberg.org/KhodeKiaa/PersianBlocker/raw/branch/main/PersianBlocker.txt',
}

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'rules'
TEMPLATE = Path(__file__).resolve().parent / 'scriptlets.template.js'

MAX_RULES = 29000

SUB_TYPES = ['sub_frame', 'stylesheet', 'script', 'image', 'font', 'object',
             'xmlhttprequest', 'ping', 'media', 'websocket', 'webtransport', 'other']
TYPE_MAP = {
    'script': ['script'], 'image': ['image'], 'stylesheet': ['stylesheet'], 'css': ['stylesheet'],
    'subdocument': ['sub_frame'], 'frame': ['sub_frame'], 'xmlhttprequest': ['xmlhttprequest'], 'xhr': ['xmlhttprequest'],
    'media': ['media'], 'font': ['font'], 'object': ['object'], 'ping': ['ping'], 'beacon': ['ping'],
    'websocket': ['websocket'], 'other': ['other'], 'document': ['main_frame'], 'doc': ['main_frame'],
    'popup': ['main_frame'], 'all': SUB_TYPES + ['main_frame'],
}
PARTY = {'third-party': 'thirdParty', '3p': 'thirdParty', '~third-party': 'firstParty', '1p': 'firstParty',
         'first-party': 'firstParty', '~first-party': 'thirdParty', '~1p': 'thirdParty', '~3p': 'firstParty'}
IGNORED = {'important', 'match-case', 'strict1p', 'strict3p'}
HIDE_EXCEPTIONS = {'generichide', 'ghide', 'elemhide', 'ehide'}
DOMAIN = re.compile(r'^[a-z0-9.-]+\.[a-z0-9-]+$')
URL_FILTER = re.compile(r'[\x21-\x7e]+')

PROCEDURAL_OPS = ('has-text', 'upward', 'remove', 'style', 'min-text-length', 'matches-path')
UNSUPPORTED_CSS = re.compile(r':(-abp-|xpath|others|watch-attr|remove-attr|remove-class|matches-css|matches-attr|matches-prop|matches-media|if|if-not)\b|^\^')

SCRIPTLETS = {
    'set': 'set', 'set-constant': 'set',
    'aopr': 'aopr', 'abort-on-property-read': 'aopr',
    'aopw': 'aopw', 'abort-on-property-write': 'aopw',
    'acs': 'acs', 'abort-current-script': 'acs', 'acis': 'acs', 'abort-current-inline-script': 'acs',
    'aeld': 'aeld', 'addEventListener-defuser': 'aeld', 'prevent-addEventListener': 'aeld',
    'nostif': 'nostif', 'no-setTimeout-if': 'nostif', 'prevent-setTimeout': 'nostif',
    'nosiif': 'nosiif', 'no-setInterval-if': 'nosiif', 'prevent-setInterval': 'nosiif',
    'ra': 'ra', 'remove-attr': 'ra', 'rc': 'rc', 'remove-class': 'rc',
    'no-fetch-if': 'nofetch', 'prevent-fetch': 'nofetch',
    'json-prune': 'jsonprune',
}


def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=90) as r:
        return r.read().decode('utf-8', 'ignore').splitlines()


def split_domains(raw, sep=','):
    domains = [d.strip() for d in raw.split(sep) if d.strip() and d.strip() != '*']
    include = [d for d in domains if not d.startswith('~')]
    exclude = [d[1:] for d in domains if d.startswith('~')]
    ok = all(DOMAIN.match(d) for d in include + exclude)
    return include, exclude, ok


def parse_options(raw):
    opts = {'types': set(), 'excluded': set(), 'party': None, 'include': [], 'exclude': [], 'hide': False}
    for opt in filter(None, raw.split(',')) if raw else []:
        name, _, value = opt.partition('=')
        bare = name.lstrip('~')
        if name in IGNORED:
            continue
        if bare in HIDE_EXCEPTIONS:
            opts['hide'] = True
        elif name in PARTY:
            opts['party'] = PARTY[name]
        elif name in ('domain', 'from'):
            include, exclude, ok = split_domains(value, '|')
            if not ok:
                return None
            opts['include'] += include
            opts['exclude'] += exclude
        elif bare in TYPE_MAP:
            (opts['excluded'] if name.startswith('~') else opts['types']).update(TYPE_MAP[bare])
        else:
            return None
    return opts


def resource_types(opts):
    if opts['types']:
        return sorted(opts['types'])
    return sorted(t for t in SUB_TYPES if t not in opts['excluded'])


def split_args(raw):
    """Splits scriptlet arguments on commas, honouring backslash escapes."""
    args, cur, i = [], '', 0
    while i < len(raw):
        c = raw[i]
        if c == '\\' and i + 1 < len(raw) and raw[i + 1] == ',':
            cur += ','
            i += 2
            continue
        if c == ',':
            args.append(cur.strip())
            cur = ''
        else:
            cur += c
        i += 1
    args.append(cur.strip())
    return [a[1:-1] if len(a) > 1 and a[0] == a[-1] and a[0] in '"\'' else a for a in args]


def balanced(text, start):
    """Returns the index of the parenthesis closing the one at text[start]."""
    depth = 0
    i = start
    while i < len(text):
        if text[i] == '\\':
            i += 2
            continue
        if text[i] == '(':
            depth += 1
        elif text[i] == ')':
            depth -= 1
            if depth == 0:
                return i
        i += 1
    return -1


def parse_procedural(selector):
    """Turns 'div.ad:has-text(x):upward(2)' into a task, or None when unsupported."""
    if UNSUPPORTED_CSS.search(selector):
        return None
    path = None
    if selector.startswith(':matches-path('):
        end = balanced(selector, len(':matches-path'))
        if end < 0:
            return None
        path = selector[len(':matches-path('):end]
        selector = selector[end + 1:].strip()

    pattern = re.compile(r':(' + '|'.join(PROCEDURAL_OPS) + r')\(')
    m = pattern.search(selector)
    if not m:
        return {'sel': selector, 'ops': [], 'path': path} if selector else None
    base, rest, ops = selector[:m.start()], selector[m.start():], []
    if base.count('(') != base.count(')'):
        return None
    while rest:
        m = pattern.match(rest)
        if not m:
            return None
        end = balanced(rest, m.end() - 1)
        if end < 0:
            return None
        ops.append([m.group(1), rest[m.end():end]])
        rest = rest[end + 1:]
    if any(op in ('remove', 'style', 'matches-path') for op, _ in ops[:-1]) or ops[-1][0] == 'matches-path':
        return None
    return {'sel': base or None, 'ops': ops, 'path': path}


def prune(domains):
    keep = set(domains)
    for d in domains:
        parts = d.split('.')
        if any('.'.join(parts[i:]) in keep for i in range(1, len(parts) - 1)):
            keep.discard(d)
    return keep


def build():
    grouped = defaultdict(set)
    singles = []
    hide_off = set()
    generic = {}
    generic_except = defaultdict(set)
    site_css = defaultdict(set)
    procedural = defaultdict(list)
    cosmetic_except = defaultdict(set)
    scriptlets = defaultdict(list)
    seen = set()

    for name, url in LISTS.items():
        lines = fetch(url)
        print(f'{name}: {len(lines)} lines')
        for line in lines:
            line = line.strip()
            if not line or line[0] in '![' or line in seen:
                continue
            seen.add(line)

            if '#@#' in line:
                domains, selector = line.split('#@#', 1)
                include, _, ok = split_domains(domains)
                if ok and not selector.startswith('+js'):
                    for d in include or ['*']:
                        cosmetic_except[selector].add(d)
                continue

            if '##+js(' in line:
                domains, body = line.split('##+js(', 1)
                include, exclude, ok = split_domains(domains)
                args = split_args(body[:-1]) if body.endswith(')') else None
                if ok and include and not exclude and args and args[0].removesuffix('.js') in SCRIPTLETS:
                    entry = [SCRIPTLETS[args[0].removesuffix('.js')]] + args[1:]
                    for d in include:
                        if entry not in scriptlets[d]:
                            scriptlets[d].append(entry)
                continue

            if '#?#' in line or '##' in line:
                sep = '#?#' if '#?#' in line else '##'
                domains, selector = line.split(sep, 1)
                if '#$#' in line or not selector:
                    continue
                include, exclude, ok = split_domains(domains)
                if not ok:
                    continue
                task = parse_procedural(selector)
                if task is None:
                    continue
                plain = not task['ops'] and not task['path']
                if plain and include:
                    for d in include:
                        site_css[d].add(selector)
                elif plain:
                    if exclude:
                        generic_except[selector].update(exclude)
                    else:
                        generic.setdefault(selector, True)
                elif include:
                    ops = task['ops']
                    if len(ops) == 1 and ops[0][0] == 'style' and task['sel'] and not task['path']:
                        for d in include:
                            decls = ';'.join(re.sub(r'\s*!important\s*$', '', x.strip()) + ' !important'
                                             for x in ops[0][1].split(';') if ':' in x)
                            site_css[d].add(f'{task["sel"]}{{{decls}}}')
                    else:
                        for d in include:
                            procedural[d].append(task)
                continue

            allow = line.startswith('@@')
            body = line[2:] if allow else line
            if re.match(r'^/.*/(\$|$)', body):
                continue
            pattern, raw_opts = body, ''
            m = re.match(r'^(.*?)\$([a-z0-9~,=|._-]+)$', body)
            if m:
                pattern, raw_opts = m.group(1), m.group(2)
            opts = parse_options(raw_opts)
            if opts is None:
                continue
            if opts['hide']:
                m = re.fullmatch(r'\|\|([a-z0-9.-]+)\^?', pattern)
                if allow and m:
                    hide_off.add(m.group(1))
                continue
            if len(pattern) < 4 or not URL_FILTER.fullmatch(pattern) or pattern.startswith('||*'):
                continue

            m = re.fullmatch(r'\|\|([a-z0-9.-]+)\^?', pattern)
            if m and DOMAIN.match(m.group(1)) and not allow and not opts['include'] and not opts['exclude']:
                grouped[(opts['party'], tuple(resource_types(opts)))].add(m.group(1))
            else:
                singles.append((allow, pattern, opts))

    rules = []

    def add(rule):
        rule['id'] = len(rules) + 1
        rules.append(rule)

    def add_block(cond):
        sub = [t for t in cond['resourceTypes'] if t != 'main_frame']
        if sub:
            add({'priority': 1, 'action': {'type': 'block'}, 'condition': {**cond, 'resourceTypes': sub}})
        if 'main_frame' in cond['resourceTypes']:
            add({'priority': 1, 'action': {'type': 'redirect', 'redirect': {'extensionPath': '/blocked.html'}},
                 'condition': {**cond, 'resourceTypes': ['main_frame']}})

    for (party, types), domains in sorted(grouped.items(), key=lambda kv: str(kv[0])):
        cond = {'requestDomains': sorted(prune(domains)), 'resourceTypes': list(types)}
        if party:
            cond['domainType'] = party
        add_block(cond)

    # Exceptions first so they are never cut off by the rule limit.
    singles.sort(key=lambda s: not s[0])
    for allow, pattern, opts in singles:
        if len(rules) >= MAX_RULES:
            break
        cond = {'urlFilter': pattern, 'resourceTypes': resource_types(opts)}
        if opts['party']:
            cond['domainType'] = opts['party']
        if opts['include']:
            cond['initiatorDomains'] = sorted(set(opts['include']))
        if opts['exclude']:
            cond['excludedInitiatorDomains'] = sorted(set(opts['exclude']))
        if not allow:
            add_block(cond)
        elif set(cond['resourceTypes']) <= {'main_frame', 'sub_frame'}:
            add({'priority': 2, 'action': {'type': 'allowAllRequests'}, 'condition': cond})
        else:
            add({'priority': 2, 'action': {'type': 'allow'}, 'condition': cond})

    for selector, domains in cosmetic_except.items():
        if '*' in domains:
            generic.pop(selector, None)
            generic_except.pop(selector, None)
        elif selector in generic:
            del generic[selector]
            generic_except[selector].update(domains)
    site_except = {s: sorted(d - {'*'}) for s, d in sorted(cosmetic_except.items()) if d - {'*'}}

    OUT.mkdir(exist_ok=True)
    (OUT / 'ads.json').write_text(json.dumps(rules, separators=(',', ':')))
    (OUT / 'generic.css').write_text(''.join(f'{sel}{{display:none!important}}\n' for sel in sorted(generic)))
    cosmetic = {
        'genericExcept': {s: sorted(d) for s, d in sorted(generic_except.items())},
        'sites': {d: sorted(s) for d, s in sorted(site_css.items())},
        'except': site_except,
        'procedural': {d: t for d, t in sorted(procedural.items())},
        'genericOff': sorted(hide_off),
    }
    (OUT / 'cosmetic.json').write_text(json.dumps(cosmetic, ensure_ascii=False, separators=(',', ':')))
    table = json.dumps(dict(sorted(scriptlets.items())), ensure_ascii=False, separators=(',', ':'))
    (OUT / 'scriptlets.js').write_text(TEMPLATE.read_text().replace('/* RULES */ {}', table))

    print(f'network: {len(rules)} rules ({sum(len(d) for d in grouped.values())} domains grouped, {len(singles)} url filters)')
    print(f'cosmetic: {len(generic)} generic, {sum(map(len, site_css.values()))} site, '
          f'{sum(map(len, procedural.values()))} procedural, {len(hide_off)} generic-off sites')
    print(f'scriptlets: {sum(map(len, scriptlets.values()))} on {len(scriptlets)} sites')


if __name__ == '__main__':
    build()
